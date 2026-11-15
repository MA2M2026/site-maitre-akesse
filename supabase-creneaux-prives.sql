-- Cours PRIVÉS de talons : l'élève choisit ses créneaux LIBRES à l'inscription (maquette validée par la propriétaire,
-- 14/11/2026 : maquettes/creneaux-prives.html). Rejouable.
--   * du lundi au samedi, de 10 h à 20 h ; une séance dure 2 h et commence à une heure pile (10 h à 18 h) ;
--   * 1 h 30 de pause au moins entre deux cours (toutes les séances de la table comptent : celles des autres élèves
--     et celles ajoutées à la main par l'agence) ;
--   * les créneaux réservés par une inscription « paiera plus tard » sont gardés 48 h, puis redeviennent libres
--     (« paiement envoyé » : gardés jusqu'à ce que l'agence valide ou annule) ;
--   * ou « je choisirai après mon paiement » : elle choisit plus tard sur son lien personnel (programme-talons) ;
--   * ou « dates à convenir ensemble » (aucun créneau : l'agence appelle l'élève).
-- v2 (15/11/2026, maquette validée : maquettes/creneaux-prives-v2.html) : les INDISPONIBILITÉS de l'agence (ces heures
-- ne sont plus proposées) ; sur son lien, une fois payée, l'élève choisit ses créneaux ou déplace une séance (jusqu'à
-- 24 h avant).
-- Abidjan est à l'heure UTC toute l'année : les heures sont en UTC.
-- Le visiteur ne voit QUE des heures libres (aucun nom, aucune séance) : cours_talons_creneaux_libres.

alter table cours_talons add column if not exists creneaux timestamptz[];
-- séance réservée par l'élève elle-même à l'inscription (la garde de 48 h ne vaut que pour elles)
alter table cours_talons_seances add column if not exists reservee boolean not null default false;
create index if not exists cours_talons_seances_debut on cours_talons_seances (debut);
-- la façon choisie à l'inscription (privé) : maintenant, après le paiement, ou à convenir ensemble
alter table cours_talons add column if not exists choix_creneaux text check (choix_creneaux is null or choix_creneaux in ('maintenant', 'apres', 'convenir'));

-- indisponibilités de l'agence (Administration, équipe du site) : jamais proposées aux élèves
create table if not exists cours_talons_indispo (
  id uuid primary key default gen_random_uuid(),
  debut timestamptz not null,
  fin timestamptz not null,
  raison text check (raison is null or length(raison) <= 120),
  cree_le timestamptz not null default now(),
  check (fin > debut and fin <= debut + interval '120 days')
);
create index if not exists cours_talons_indispo_debut on cours_talons_indispo (debut);
alter table cours_talons_indispo enable row level security;
revoke all on cours_talons_indispo from anon, authenticated;
grant select, insert, delete on cours_talons_indispo to authenticated;
drop policy if exists "Indisponibilités talons : l'équipe du site" on cours_talons_indispo;
create policy "Indisponibilités talons : l'équipe du site" on cours_talons_indispo for all
  using (portail_peut('site')) with check (portail_peut('site'));

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

-- libre : aucune séance occupée à moins de 1 h 30 avant ou après la séance de 2 h (celles de p_sauf, ou la séance
-- p_sauf_seance qu'on déplace, exceptées), et aucune indisponibilité de l'agence pendant ces 2 h
drop function if exists cours_talons_creneau_libre(timestamptz, uuid);
create or replace function cours_talons_creneau_libre(t timestamptz, p_sauf uuid default null, p_sauf_seance uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from cours_talons_seances s
    where s.inscription_id is distinct from p_sauf and s.id is distinct from p_sauf_seance
      and s.debut < t + interval '210 minutes' and s.fin > t - interval '90 minutes'
      and occupe(s))
  and not exists (select 1 from cours_talons_indispo i where i.debut < t + interval '2 hours' and i.fin > t)
$$;
revoke all on function cours_talons_creneau_libre(timestamptz, uuid, uuid) from public, anon, authenticated;

-- pour la page d'inscription : les heures de début libres, de p_du pendant p_jours (au plus 250 jours). Les séances
-- occupées de la période sont lues UNE fois, puis chaque heure est comparée à elles. Pour « Déplacer » (page de
-- l'élève) : p_jeton + p_seance laissent de côté la séance qu'elle déplace (la sienne seulement).
drop function if exists cours_talons_creneaux_libres(date, int);
create or replace function cours_talons_creneaux_libres(p_du date, p_jours int default 28, p_jeton text default null, p_seance uuid default null) returns setof timestamptz
language sql stable security definer set search_path = public as $$
  with sauf as (
    select s.id from cours_talons_seances s join cours_talons c on c.id = s.inscription_id
    where p_seance is not null and s.id = p_seance and length(coalesce(p_jeton, '')) = 36 and c.jeton = p_jeton),
  heures as (
    select ((p_du + i)::timestamp + make_interval(hours => h)) at time zone 'UTC' as t
    from generate_series(0, greatest(1, least(coalesce(p_jours, 28), 250)) - 1) i, generate_series(10, 18) h),
  prises as (
    select s.debut, s.fin from cours_talons_seances s
    where s.debut < (p_du + least(coalesce(p_jours, 28), 250) + 1)::timestamp at time zone 'UTC'
      and s.fin > (p_du - 1)::timestamp at time zone 'UTC'
      and s.id not in (select id from sauf)
      and occupe(s))
  select t from heures
  where cours_talons_creneau_valide(t)
    and not exists (select 1 from prises p where p.debut < t + interval '210 minutes' and p.fin > t - interval '90 minutes')
    and not exists (select 1 from cours_talons_indispo i where i.debut < t + interval '2 hours' and i.fin > t)
  order by t
$$;
revoke all on function cours_talons_creneaux_libres(date, int, text, uuid) from public;
grant execute on function cours_talons_creneaux_libres(date, int, text, uuid) to anon, authenticated;

-- avant l'enregistrement : créneaux remis en ordre, sans doublon, au plus le nombre de séances ; pas de créneau
-- pour le groupe ; la date de première séance = le premier créneau
create or replace function cours_talons_creneaux_avant() returns trigger language plpgsql set search_path = public as $$
begin
  if new.formule = 'groupe' then new.creneaux := null; new.choix_creneaux := null; return new; end if;
  if coalesce(array_length(new.creneaux, 1), 0) = 0 then
    new.creneaux := null;
    if new.choix_creneaux = 'maintenant' then new.choix_creneaux := 'convenir'; end if;
    return new;
  end if;
  new.choix_creneaux := 'maintenant';
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

-- Sur SON lien (programme-talons?c=jeton), une fois payée : elle choisit ses créneaux restants (cours privés). Mêmes
-- vérifications qu'à l'inscription ; ses propres séances comptent (1 h 30 de pause avec elles aussi).
create or replace function programme_talons_choisir(p_jeton text, p_creneaux timestamptz[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  c cours_talons;
  l timestamptz[];
  t timestamptz;
  avant timestamptz;
  deja int;
begin
  select * into c from cours_talons where length(coalesce(p_jeton, '')) = 36 and jeton = p_jeton and statut = 'inscrite' and formule <> 'groupe'
    and choix_creneaux is distinct from 'convenir';   -- (« à convenir » : l'agence fixe les dates avec elle)
  if c.id is null then raise exception 'LIEN_INVALIDE'; end if;
  perform pg_advisory_xact_lock(hashtext('cours_talons_creneaux'));
  select array_agg(distinct x order by x) into l from unnest(p_creneaux) x where x is not null;
  select count(*) into deja from cours_talons_seances where inscription_id = c.id;
  if coalesce(array_length(l, 1), 0) = 0 or array_length(l, 1) > c.nb_seances - deja then raise exception 'CRENEAUX_INVALIDES'; end if;
  foreach t in array l loop
    if avant is not null and t < avant + interval '210 minutes' then raise exception 'CRENEAUX_INVALIDES'; end if;
    if not cours_talons_creneau_valide(t) or not cours_talons_creneau_libre(t) then raise exception 'CRENEAU_PRIS'; end if;
    insert into cours_talons_seances (inscription_id, debut, fin, lieu)
      values (c.id, t, t + interval '2 hours', case when c.formule = 'prive_exterieur' then coalesce(nullif(trim(c.adresse), ''), 'Salle MA2M, Riviera Faya') else 'Salle MA2M, Riviera Faya' end);
    avant := t;
  end loop;
  return array_length(l, 1);
end;
$$;
revoke all on function programme_talons_choisir(text, timestamptz[]) from public;
grant execute on function programme_talons_choisir(text, timestamptz[]) to anon, authenticated;

-- Sur SON lien : déplacer une de ses séances privées, jusqu'à 24 h avant (jamais une séance faite)
create or replace function programme_talons_deplacer(p_jeton text, p_seance uuid, p_debut timestamptz) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  c cours_talons;
  s cours_talons_seances;
begin
  select * into c from cours_talons where length(coalesce(p_jeton, '')) = 36 and jeton = p_jeton and statut = 'inscrite' and formule <> 'groupe';
  if c.id is null then raise exception 'LIEN_INVALIDE'; end if;
  perform pg_advisory_xact_lock(hashtext('cours_talons_creneaux'));
  select * into s from cours_talons_seances where id = p_seance and inscription_id = c.id for update;
  if s.id is null or s.faite or s.debut <= now() + interval '24 hours' then raise exception 'SEANCE_FIGEE'; end if;
  if not cours_talons_creneau_valide(p_debut) or not cours_talons_creneau_libre(p_debut, null, s.id) then raise exception 'CRENEAU_PRIS'; end if;
  update cours_talons_seances set debut = p_debut, fin = p_debut + interval '2 hours' where id = s.id;
  return true;
end;
$$;
revoke all on function programme_talons_deplacer(text, uuid, timestamptz) from public;
grant execute on function programme_talons_deplacer(text, uuid, timestamptz) to anon, authenticated;

-- Page « Mon programme » : comme dans supabase-programme-talons.sql (même texte, gardé identique), avec la façon de
-- choisir ses créneaux (« à convenir » : la page ne propose pas de les choisir)
create or replace function programme_talons_lire(p_jeton text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nom', c.nom,
    'civilite', case coalesce(c.civilite, case when c.age < 18 then 'mademoiselle' end) when 'mademoiselle' then 'Mademoiselle' else 'Madame' end,
    'formule', c.formule, 'nb_seances', c.nb_seances, 'statut', c.statut,
    'titres_mois', (select jsonb_object_agg(mois, titre) from cours_talons_programme),
    'parcours', c.parcours, 'modules', c.modules,
    'nb_mois', c.nb_mois, 'mois_payes', c.mois_payes, 'paiement', c.paiement, 'prix_mois', cours_talons_prix_mois(),
    'choix_creneaux', to_jsonb(c)->>'choix_creneaux',
    'numero', 'TAL-' || upper(left(replace(c.id::text, '-', ''), 6)),
    'seances', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'mois', s.mois, 'module', s.module, 'debut', s.debut, 'fin', s.fin, 'lieu', s.lieu, 'theme', s.theme, 'faite', s.faite) order by s.debut)
      from cours_talons_seances s where s.inscription_id = c.id), '[]'::jsonb))
  from cours_talons c
  where length(coalesce(p_jeton, '')) = 36 and c.jeton = p_jeton and c.statut in ('inscrite', 'terminee');
$$;
revoke all on function programme_talons_lire(text) from public;
grant execute on function programme_talons_lire(text) to anon, authenticated;

-- Contrôle (à lire après « Run ») : 10 éléments attendus
select 'Créneaux des cours privés installés : ' || (
  (select count(*) from information_schema.columns where (table_name, column_name) in (('cours_talons', 'creneaux'), ('cours_talons', 'choix_creneaux'), ('cours_talons_seances', 'reservee'))) +
  (select count(*) from information_schema.tables where table_name = 'cours_talons_indispo') +
  (select count(*) from pg_proc where proname in ('occupe', 'cours_talons_creneau_libre', 'cours_talons_creneaux_libres', 'programme_talons_choisir', 'programme_talons_deplacer')) +
  (select count(*) from pg_trigger where tgname = 'cours_talons_creneaux_reserver')) || ' éléments sur 10' as controle;
