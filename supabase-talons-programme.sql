-- =====================================================================================================
-- Atelier Talons et Elegance : programme des eleves (13/11/2026, maquette validee par la proprietaire)
--  1) les seances de chaque eleve (talons_seances), creees toutes seules pour le groupe (4 dimanches)
--  2) la page privee Mon programme (lien personnel programme_jeton, lecture talons_programme_lire)
--  3) les disponibilites de l agence pour les cours prives et les creneaux libres proposes aux visiteurs
--     (1 h 30 d ecart entre deux eleves, creneaux reserves 48 h en attendant le paiement)
--  4) la notification sur le telephone 24 h avant chaque seance
-- A COLLER UNE FOIS dans Supabase (SQL Editor), APRES supabase-cours-talons.sql et
-- supabase-moyens-inscriptions.sql. Bouton orange Run without RLS s il est propose.
-- Rien n est efface, peut etre recolle sans risque.
-- Attention : aucune apostrophe ni point-virgule dans les commentaires (editeur de Supabase).
-- =====================================================================================================

-- ---------- 1) Reglages de l atelier (une seule ligne, modifiable dans l Administration) ----------
create table if not exists talons_reglages (
  id int primary key default 1 check (id = 1),
  salle_nom text not null default 'Salle MA2M' check (length(salle_nom) between 1 and 120),
  salle_adresse text not null default 'Riviera Faya, Abidjan' check (length(salle_adresse) <= 300),
  salle_maps text check (salle_maps is null or salle_maps ~ '^https://'),
  groupe_debut time not null default '15:00',
  groupe_fin time not null default '18:00',
  duree_prive int not null default 120 check (duree_prive between 30 and 300),
  ecart_minutes int not null default 90 check (ecart_minutes between 0 and 300),
  a_prevoir text[] not null default array['Talons de 7 à 10 cm', 'Tenue près du corps', 'Une bouteille d’eau', 'Des ballerines pour la pause', 'Arriver 15 min avant'],
  themes_groupe text[] not null default array['Posture et équilibre', 'Démarche et port de tête', 'Fluidité et tours', 'Défilé final'],
  modifie_le timestamptz not null default now()
);
insert into talons_reglages (id) values (1) on conflict (id) do nothing;
alter table talons_reglages enable row level security;
revoke all on talons_reglages from anon, authenticated;
grant select, update on talons_reglages to authenticated;
drop policy if exists talons_reglages_site on talons_reglages;
create policy talons_reglages_site on talons_reglages for all using (portail_peut('site')) with check (portail_peut('site'));

-- ---------- 2) Disponibilites de l agence pour les cours prives ----------
-- jour : 1 lundi ... 7 dimanche (comme isodow)
create table if not exists talons_disponibilites (
  id uuid primary key default gen_random_uuid(),
  jour int not null check (jour between 1 and 7),
  debut time not null,
  fin time not null check (fin > debut),
  cree_le timestamptz not null default now()
);
create table if not exists talons_indisponibles (
  jour date primary key,
  motif text check (motif is null or length(motif) <= 160)
);
alter table talons_disponibilites enable row level security;
alter table talons_indisponibles enable row level security;
revoke all on talons_disponibilites, talons_indisponibles from anon, authenticated;
grant select, insert, update, delete on talons_disponibilites, talons_indisponibles to authenticated;
drop policy if exists talons_dispo_site on talons_disponibilites;
create policy talons_dispo_site on talons_disponibilites for all using (portail_peut('site')) with check (portail_peut('site'));
drop policy if exists talons_indispo_site on talons_indisponibles;
create policy talons_indispo_site on talons_indisponibles for all using (portail_peut('site')) with check (portail_peut('site'));

-- ---------- 3) Seances des eleves ----------
create table if not exists talons_seances (
  id uuid primary key default gen_random_uuid(),
  inscription_id uuid not null references cours_talons(id) on delete cascade,
  debut timestamptz not null,
  fin timestamptz not null check (fin > debut),
  lieu text check (lieu is null or length(lieu) <= 300),
  theme text check (theme is null or length(theme) <= 120),
  statut text not null default 'prevue' check (statut in ('reservee', 'prevue', 'faite', 'annulee')),
  reservee_jusqu timestamptz,
  rappel_le timestamptz,
  cree_le timestamptz not null default now()
);
create index if not exists talons_seances_debut on talons_seances (debut);
create index if not exists talons_seances_inscription on talons_seances (inscription_id, debut);
alter table talons_seances enable row level security;
revoke all on talons_seances from anon, authenticated;
grant select, insert, update, delete on talons_seances to authenticated;
drop policy if exists talons_seances_site on talons_seances;
create policy talons_seances_site on talons_seances for all using (portail_peut('site')) with check (portail_peut('site'));

-- ---------- 4) Lien personnel de la page Mon programme, creneaux souhaites ----------
alter table cours_talons add column if not exists programme_jeton uuid not null default gen_random_uuid();
create unique index if not exists cours_talons_programme_jeton on cours_talons (programme_jeton);
alter table cours_talons add column if not exists programme_envoye_le timestamptz;
-- creneaux choisis par la visiteuse sur la page publique (cours prives) : debuts en ISO, au plus 30
alter table cours_talons add column if not exists creneaux_souhaites jsonb
  check (creneaux_souhaites is null or (jsonb_typeof(creneaux_souhaites) = 'array' and jsonb_array_length(creneaux_souhaites) <= 30));
alter table cours_talons add column if not exists a_convenir boolean not null default false;
grant update (programme_envoye_le) on cours_talons to authenticated;

-- Creneaux libres des cours prives sur les 21 prochains jours (a partir de demain) : debuts possibles dans les
-- disponibilites, sans chevaucher une seance existante (ecart garde avant et apres), hors jours bloques.
-- Pour la page publique : seulement des heures, aucune information sur les autres eleves.
create or replace function talons_creneaux_libres(p_jours int default 21)
returns table(debut timestamptz, fin timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  r talons_reglages;
  j date;
  d record;
  t timestamptz;
  fin_t timestamptz;
  pas interval;
  ecart interval;
begin
  select * into r from talons_reglages where id = 1;
  if r.id is null then return; end if;
  pas := make_interval(mins => r.duree_prive + r.ecart_minutes);
  ecart := make_interval(mins => r.ecart_minutes);
  for j in select generate_series(current_date + 1, current_date + least(greatest(coalesce(p_jours, 21), 1), 60), interval '1 day')::date loop
    continue when exists (select 1 from talons_indisponibles i where i.jour = j);
    for d in select * from talons_disponibilites where jour = extract(isodow from j)::int order by debut loop
      t := (j + d.debut) at time zone 'Africa/Abidjan';
      loop
        fin_t := t + make_interval(mins => r.duree_prive);
        exit when fin_t > (j + d.fin) at time zone 'Africa/Abidjan';
        if not exists (
          select 1 from talons_seances s
          where (s.statut in ('prevue', 'faite') or (s.statut = 'reservee' and coalesce(s.reservee_jusqu, now()) > now()))
            and s.debut < fin_t + ecart and s.fin + ecart > t
        ) then
          debut := t; fin := fin_t; return next;
        end if;
        t := t + pas;
      end loop;
    end loop;
  end loop;
end;
$$;
revoke all on function talons_creneaux_libres(int) from public;
grant execute on function talons_creneaux_libres(int) to anon, authenticated;

-- Toute nouvelle inscription : un lien personnel neuf (jamais choisi par la visiteuse), et ses creneaux
-- souhaites deviennent des seances reservees 48 h (cours prives seulement), si elles sont encore libres.
create or replace function cours_talons_nouvelle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  NEW.programme_jeton := gen_random_uuid();
  NEW.programme_envoye_le := null;
  if NEW.formule = 'groupe' then NEW.creneaux_souhaites := null; end if;
  if NEW.creneaux_souhaites is not null and jsonb_array_length(NEW.creneaux_souhaites) > NEW.nb_seances then
    raise exception 'Trop de créneaux choisis.';
  end if;
  return NEW;
end;
$$;
revoke all on function cours_talons_nouvelle() from public, anon, authenticated;
drop trigger if exists cours_talons_nouvelle on cours_talons;
create trigger cours_talons_nouvelle before insert on cours_talons for each row execute function cours_talons_nouvelle();

create or replace function cours_talons_reserver()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r talons_reglages;
  c jsonb;
  t timestamptz;
begin
  if NEW.creneaux_souhaites is null or NEW.formule = 'groupe' then return NEW; end if;
  select * into r from talons_reglages where id = 1;
  -- un seul enregistrement a la fois : deux visiteuses ne prennent jamais le meme creneau
  perform pg_advisory_xact_lock(hashtext('talons_creneaux'));
  for c in select * from jsonb_array_elements(NEW.creneaux_souhaites) loop
    t := (c #>> '{}')::timestamptz;
    if not exists (select 1 from talons_creneaux_libres(60) l where l.debut = t) then
      raise exception 'CRENEAU_PRIS';
    end if;
    insert into talons_seances (inscription_id, debut, fin, lieu, statut, reservee_jusqu)
    values (NEW.id, t, t + make_interval(mins => r.duree_prive),
      case when NEW.formule = 'prive_salle' then r.salle_nom || ', ' || r.salle_adresse else NEW.adresse end,
      'reservee', now() + interval '48 hours');
  end loop;
  return NEW;
end;
$$;
revoke all on function cours_talons_reserver() from public, anon, authenticated;
drop trigger if exists cours_talons_reserver on cours_talons;
create trigger cours_talons_reserver after insert on cours_talons for each row execute function cours_talons_reserver();

-- ---------- 5) Paiement valide : le programme se cree ou se confirme tout seul ----------
-- groupe : les 4 dimanches qui suivent le jour de la validation, aux heures et avec les themes des reglages
-- prive : les seances reservees deviennent prevues (plus de limite de 48 h)
create or replace function cours_talons_programme()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r talons_reglages;
  dimanche date;
  k int;
begin
  if NEW.statut <> 'inscrite' or OLD.statut = 'inscrite' then return NEW; end if;
  select * into r from talons_reglages where id = 1;
  if NEW.formule = 'groupe' then
    if not exists (select 1 from talons_seances where inscription_id = NEW.id and statut <> 'annulee') then
      dimanche := current_date + (7 - extract(isodow from current_date)::int);
      if dimanche = current_date then dimanche := dimanche + 7; end if;
      for k in 0..3 loop
        insert into talons_seances (inscription_id, debut, fin, lieu, theme, statut)
        values (NEW.id, (dimanche + 7 * k + r.groupe_debut) at time zone 'Africa/Abidjan', (dimanche + 7 * k + r.groupe_fin) at time zone 'Africa/Abidjan',
          r.salle_nom || ', ' || r.salle_adresse, r.themes_groupe[k + 1], 'prevue');
      end loop;
    end if;
  else
    update talons_seances set statut = 'prevue', reservee_jusqu = null where inscription_id = NEW.id and statut = 'reservee';
  end if;
  return NEW;
end;
$$;
revoke all on function cours_talons_programme() from public, anon, authenticated;
drop trigger if exists cours_talons_programme on cours_talons;
create trigger cours_talons_programme after update of statut on cours_talons for each row execute function cours_talons_programme();

-- ---------- 6) Page Mon programme : lecture par le seul lien personnel ----------
create or replace function talons_programme_lire(p_jeton uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'prenom', split_part(trim(c.nom), ' ', 1),
    'nom', c.nom,
    'formule', c.formule,
    'nb_seances', c.nb_seances,
    'statut', c.statut,
    'photo', c.photos ->> 0,
    'seances', coalesce((select jsonb_agg(jsonb_build_object('debut', s.debut, 'fin', s.fin, 'lieu', s.lieu, 'theme', s.theme, 'statut', s.statut) order by s.debut)
                         from talons_seances s where s.inscription_id = c.id and s.statut <> 'annulee'), '[]'::jsonb),
    'salle_nom', r.salle_nom, 'salle_adresse', r.salle_adresse, 'salle_maps', r.salle_maps,
    'a_prevoir', to_jsonb(r.a_prevoir))
  from cours_talons c cross join talons_reglages r
  where c.programme_jeton = p_jeton and r.id = 1 and c.statut in ('inscrite', 'terminee');
$$;
revoke all on function talons_programme_lire(uuid) from public;
grant execute on function talons_programme_lire(uuid) to anon, authenticated;

-- ---------- 7) Rappel 24 h avant chaque seance : une ligne par rappel, qui part en notification ----------
create table if not exists talons_rappels (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references talons_seances(id) on delete cascade,
  nom text,
  debut timestamptz,
  lieu text,
  cree_le timestamptz not null default now()
);
alter table talons_rappels enable row level security;
revoke all on talons_rappels from anon, authenticated;
grant select on talons_rappels to authenticated;
drop policy if exists talons_rappels_site on talons_rappels;
create policy talons_rappels_site on talons_rappels for select using (portail_peut('site'));

create or replace function talons_rappels_reveil()
returns void language plpgsql security definer set search_path = public as $$
declare s record;
begin
  -- les reservations non payees au bout de 48 h liberent leurs creneaux
  update talons_seances set statut = 'annulee' where statut = 'reservee' and reservee_jusqu < now();
  for s in select ts.id, ts.debut, ts.lieu, c.nom from talons_seances ts join cours_talons c on c.id = ts.inscription_id
           where ts.statut = 'prevue' and ts.rappel_le is null and ts.debut between now() + interval '20 hours' and now() + interval '26 hours' loop
    insert into talons_rappels (seance_id, nom, debut, lieu) values (s.id, s.nom, s.debut, s.lieu);
    update talons_seances set rappel_le = now() where id = s.id;
  end loop;
end;
$$;
revoke all on function talons_rappels_reveil() from public, anon, authenticated;

drop trigger if exists trg_notif_talons_rappels on talons_rappels;
create trigger trg_notif_talons_rappels after insert on talons_rappels for each row execute function notifier_push_notification();
insert into notifications_reglages (cle, actif) values ('evenement_talons_rappel', true) on conflict (cle) do nothing;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'talons-rappels';
select cron.schedule('talons-rappels', '0 * * * *', $$select talons_rappels_reveil();$$);

NOTIFY pgrst, 'reload schema';
select 'Programme des cours de talons en place' as resultat;
