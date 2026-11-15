-- Cours PRIVÉS de talons : l'élève choisit ses créneaux LIBRES à l'inscription (maquette validée par la propriétaire,
-- 14/11/2026 : maquettes/creneaux-prives.html). Rejouable.
--   * du lundi au samedi, de 10 h à 20 h ; une séance dure 2 h et commence à une heure pile (10 h à 18 h) ;
--   * 1 h 30 de pause au moins entre deux cours (toutes les séances de la table comptent : celles des autres élèves
--     et celles ajoutées à la main par l'agence) ;
--   * les créneaux réservés par une inscription « paiera plus tard » sont gardés 48 h, puis redeviennent libres
--     (« paiement envoyé » : gardés jusqu'à ce que l'agence valide ou annule) ;
--   * ou « dates à convenir ensemble » (aucun créneau : l'agence appelle l'élève).
-- Abidjan est à l'heure UTC toute l'année : les heures sont en UTC.
-- Le visiteur ne voit QUE des heures libres (aucun nom, aucune séance) : cours_talons_creneaux_libres.

alter table cours_talons add column if not exists creneaux timestamptz[];
-- séance réservée par l'élève elle-même à l'inscription (la garde de 48 h ne vaut que pour elles)
alter table cours_talons_seances add column if not exists reservee boolean not null default false;
create index if not exists cours_talons_seances_debut on cours_talons_seances (debut);

-- un créneau proposable : lundi à samedi, heure pile de 10 h à 18 h, à partir de demain, dans les 250 jours
create or replace function cours_talons_creneau_valide(t timestamptz) returns boolean
language sql stable set search_path = public as $$
  select extract(isodow from t at time zone 'UTC') between 1 and 6
     and extract(hour from t at time zone 'UTC') between 10 and 18
     and date_trunc('hour', t at time zone 'UTC') = t at time zone 'UTC'
     and (t at time zone 'UTC')::date > (now() at time zone 'UTC')::date
     and (t at time zone 'UTC')::date <= (now() at time zone 'UTC')::date + 250
$$;

-- LA règle « cette séance occupe-t-elle l'agenda ? » (une seule source : le site public, la réservation et
-- « Cette semaine » de l'Administration la lisent ici, en colonne calculée « occupe » pour l'Administration) :
-- jamais une inscription annulée ; une séance réservée par une élève « paiera plus tard » ou « nouvelle », pas encore
-- validée, seulement pendant 48 h
create or replace function occupe(s cours_talons_seances) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select c.statut <> 'annulee'
      and not (s.reservee and c.valide_le is null and c.statut in ('nouvelle', 'plus_tard') and c.cree_le <= now() - interval '48 hours')
    from cours_talons c where c.id = s.inscription_id), true)
$$;
revoke all on function occupe(cours_talons_seances) from public, anon;
grant execute on function occupe(cours_talons_seances) to authenticated;

-- libre : aucune séance occupée à moins de 1 h 30 avant ou après la séance de 2 h (les siennes exceptées)
create or replace function cours_talons_creneau_libre(t timestamptz, p_sauf uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from cours_talons_seances s
    where s.inscription_id is distinct from p_sauf
      and s.debut < t + interval '210 minutes' and s.fin > t - interval '90 minutes'
      and occupe(s))
$$;
revoke all on function cours_talons_creneau_libre(timestamptz, uuid) from public, anon, authenticated;

-- pour la page d'inscription : les heures de début libres, de p_du pendant p_jours (au plus 250 jours). Les séances
-- occupées de la période sont lues UNE fois, puis chaque heure est comparée à elles.
create or replace function cours_talons_creneaux_libres(p_du date, p_jours int default 28) returns setof timestamptz
language sql stable security definer set search_path = public as $$
  with heures as (
    select ((p_du + i)::timestamp + make_interval(hours => h)) at time zone 'UTC' as t
    from generate_series(0, greatest(1, least(coalesce(p_jours, 28), 250)) - 1) i, generate_series(10, 18) h),
  prises as (
    select s.debut, s.fin from cours_talons_seances s
    where s.debut < (p_du + least(coalesce(p_jours, 28), 250) + 1)::timestamp at time zone 'UTC'
      and s.fin > (p_du - 1)::timestamp at time zone 'UTC'
      and occupe(s))
  select t from heures
  where cours_talons_creneau_valide(t)
    and not exists (select 1 from prises p where p.debut < t + interval '210 minutes' and p.fin > t - interval '90 minutes')
  order by t
$$;
revoke all on function cours_talons_creneaux_libres(date, int) from public;
grant execute on function cours_talons_creneaux_libres(date, int) to anon, authenticated;

-- avant l'enregistrement : créneaux remis en ordre, sans doublon, au plus le nombre de séances ; pas de créneau
-- pour le groupe ; la date de première séance = le premier créneau
create or replace function cours_talons_creneaux_avant() returns trigger language plpgsql set search_path = public as $$
begin
  if new.formule = 'groupe' or coalesce(array_length(new.creneaux, 1), 0) = 0 then new.creneaux := null; return new; end if;
  select array_agg(distinct t order by t) into new.creneaux from unnest(new.creneaux) t where t is not null;
  if array_length(new.creneaux, 1) > new.nb_seances then raise exception 'CRENEAUX_INVALIDES'; end if;
  new.date_seance := (new.creneaux[1] at time zone 'UTC')::date;
  return new;
end;
$$;
revoke all on function cours_talons_creneaux_avant() from public, anon, authenticated;
drop trigger if exists cours_talons_creneaux_avant on cours_talons;
create trigger cours_talons_creneaux_avant before insert on cours_talons for each row execute function cours_talons_creneaux_avant();

-- après l'enregistrement : les réservations expirées (48 h sans paiement) sont d'abord retirées (elles ne
-- reviendront pas si l'élève paie plus tard : ses souhaits restent écrits, l'agence refixe les dates) ; puis chaque
-- créneau est vérifié (encore libre, 1 h 30 entre ses propres séances) et réservé (séance de 2 h, à la salle ou à
-- son adresse ; le thème suivant de son programme est mis par cours_talons_seance_theme). Un créneau pris
-- entre-temps : RIEN n'est enregistré (CRENEAU_PRIS), la page lui propose d'en choisir un autre. Un verrou évite
-- que deux élèves réservent la même heure au même instant.
create or replace function cours_talons_creneaux_reserver() returns trigger language plpgsql security definer set search_path = public as $$
declare
  t timestamptz;
  avant timestamptz;
begin
  if new.creneaux is null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('cours_talons_creneaux'));
  delete from cours_talons_seances s using cours_talons c
    where c.id = s.inscription_id and s.reservee and c.statut <> 'annulee' and not occupe(s);
  foreach t in array new.creneaux loop
    if not cours_talons_creneau_valide(t) then raise exception 'CRENEAU_PRIS'; end if;   -- (devenu passé : « plus disponible »)
    if avant is not null and t < avant + interval '210 minutes' then raise exception 'CRENEAUX_INVALIDES'; end if;
    if not cours_talons_creneau_libre(t, new.id) then raise exception 'CRENEAU_PRIS'; end if;
    insert into cours_talons_seances (inscription_id, debut, fin, lieu, reservee)
      values (new.id, t, t + interval '2 hours', case when new.formule = 'prive_exterieur' then coalesce(nullif(trim(new.adresse), ''), 'Salle MA2M, Riviera Faya') else 'Salle MA2M, Riviera Faya' end, true);
    avant := t;
  end loop;
  return new;
end;
$$;
revoke all on function cours_talons_creneaux_reserver() from public, anon, authenticated;
drop trigger if exists cours_talons_creneaux_reserver on cours_talons;
create trigger cours_talons_creneaux_reserver after insert on cours_talons for each row execute function cours_talons_creneaux_reserver();

-- Contrôle (à lire après « Run ») : 6 éléments attendus
select 'Créneaux des cours privés installés : ' || (
  (select count(*) from information_schema.columns where (table_name, column_name) in (('cours_talons', 'creneaux'), ('cours_talons_seances', 'reservee'))) +
  (select count(*) from pg_proc where proname in ('occupe', 'cours_talons_creneau_libre', 'cours_talons_creneaux_libres')) +
  (select count(*) from pg_trigger where tgname = 'cours_talons_creneaux_reserver')) || ' éléments sur 6' as controle;
