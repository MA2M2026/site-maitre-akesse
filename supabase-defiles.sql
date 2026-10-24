-- =====================================================================================
-- Programmation défilé (24/10/2026, demande de la propriétaire)
-- =====================================================================================
-- Un défilé = un projet de l'Agenda (agenda_projets), sur un ou plusieurs jours. Il se découpe en
-- PASSAGES (un jour, une heure, une salle / un lieu, un nombre de femmes et d'hommes, un thème ou
-- un créateur). L'agence choisit le VIVIER (mannequins retenues : du site, du registre de
-- l'agence sans compte, ou extérieures du carnet), puis la répartition se fait automatiquement
-- (js/defile-repartition.js) et se corrige à la main. Réservé à l'agence ; la fiche programme de
-- chaque mannequin passera par son lien personnel (étape 2).
-- À coller en entier dans Supabase › SQL Editor › Run. Aucune donnée supprimée ; peut être rejoué.

create table if not exists defile_passages (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references agenda_projets(id) on delete cascade,
  jour date not null,
  debut text check (debut is null or debut ~ '^[0-2][0-9]:[0-5][0-9]$'),
  salle text check (salle is null or length(salle) <= 120),
  theme text check (theme is null or length(theme) <= 160),
  femmes int not null default 0 check (femmes between 0 and 200),
  hommes int not null default 0 check (hommes between 0 and 200),
  created_at timestamptz not null default now()
);
create index if not exists defile_passages_projet on defile_passages (projet_id, jour, debut);

create table if not exists defile_vivier (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references agenda_projets(id) on delete cascade,
  model_id uuid references model_profiles(id) on delete cascade,
  mannequin_id uuid references agence_mannequins(id) on delete cascade,
  contact_id uuid references contacts_externes(id) on delete cascade,
  sexe text not null check (sexe in ('femme', 'homme')),
  created_at timestamptz not null default now(),
  constraint defile_vivier_quelquun check (num_nonnulls(model_id, mannequin_id, contact_id) = 1)
);
create unique index if not exists defile_vivier_site on defile_vivier (projet_id, model_id) where model_id is not null;
create unique index if not exists defile_vivier_registre on defile_vivier (projet_id, mannequin_id) where mannequin_id is not null;
create unique index if not exists defile_vivier_contact on defile_vivier (projet_id, contact_id) where contact_id is not null;

create table if not exists defile_affectations (
  passage_id uuid not null references defile_passages(id) on delete cascade,
  vivier_id uuid not null references defile_vivier(id) on delete cascade,
  a_la_main boolean not null default false,  -- choisie à la main : gardée par « Répartir »
  primary key (passage_id, vivier_id)
);

-- Réservé à l'agence, avec le code de l'application d'authentification (supabase-admins-aal2.sql)
alter table defile_passages enable row level security;
alter table defile_vivier enable row level security;
alter table defile_affectations enable row level security;
revoke all on defile_passages, defile_vivier, defile_affectations from anon;
drop policy if exists "Défilé : agence" on defile_passages;
create policy "Défilé : agence" on defile_passages for all
  using (exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()))
  with check (exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()));
drop policy if exists "Défilé : agence" on defile_vivier;
create policy "Défilé : agence" on defile_vivier for all
  using (exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()))
  with check (exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()));
drop policy if exists "Défilé : agence" on defile_affectations;
create policy "Défilé : agence" on defile_affectations for all
  using (exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()))
  with check (exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()));

-- Nom et visage d'une personne du vivier (profil du site publié : sa photo de couverture, petite
-- version si elle existe ; profil retiré du site : son nom seul ; registre ou carnet : son nom seul, les initiales s'affichent)
create or replace function defile_personne(v defile_vivier)
returns table(nom text, photo text) language sql stable security definer set search_path = public as $$
  select coalesce(m.full_name, r.full_name, trim(coalesce(c.civilite || ' ', '') || c.nom), '?'),
    (select coalesce(ph.url_petite, ph.url_miniature, ph.url) from model_photos ph where ph.model_id = v.model_id and m.published
      order by ph.principale desc, ph.created_at asc limit 1)
  from (select 1) x
  left join model_profiles m on m.id = v.model_id
  left join agence_mannequins r on r.id = v.mannequin_id
  left join contacts_externes c on c.id = v.contact_id;
$$;
revoke all on function defile_personne(defile_vivier) from public, anon, authenticated;

-- « Convoquer » (Administration) : chaque mannequin placée devient participante du projet — profil
-- du site : ajouté au projet (mannequin_ids) ; registre et carnet : participante des convocations
-- (mêmes fonctions que les Places limitées, supabase-personnes.sql / supabase-places.sql)
create or replace function defile_participants(p_projet uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v defile_vivier; n int := 0;
begin
  if not exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()) then raise exception 'Réservé à l''agence.'; end if;
  for v in select distinct dv.* from defile_vivier dv join defile_affectations a on a.vivier_id = dv.id where dv.projet_id = p_projet loop
    if v.model_id is not null then
      update agenda_projets set mannequin_ids = array_append(array_remove(mannequin_ids, v.model_id), v.model_id), updated_at = now() where id = p_projet;
    elsif v.mannequin_id is not null then perform places_participant_registre(p_projet, v.mannequin_id);
    else perform places_participant_contact(p_projet, v.contact_id);
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function defile_participants(uuid) from public, anon;
grant execute on function defile_participants(uuid) to authenticated;

-- Fiche programme (page « Confirmer ma présence », lien personnel de la convocation) : tous les
-- passages du défilé avec les visages, et ceux de la personne marqués (« moi »). Le lien seul donne
-- accès ; rien d'autre n'est lisible (pas de numéro, pas d'adresse e-mail).
create or replace function defile_programme(p_jeton text)
returns json language plpgsql stable security definer set search_path = public as $$
declare cp convocation_participants; registre uuid; moi uuid;
begin
  if length(coalesce(p_jeton, '')) <> 36 then return null; end if;
  select * into cp from convocation_participants where jeton = p_jeton;
  if not found or not exists (select 1 from defile_passages where projet_id = cp.projet_id) then return null; end if;
  if cp.contact_id is not null then select mannequin_id into registre from contacts_externes where id = cp.contact_id; end if;
  select id into moi from defile_vivier v where v.projet_id = cp.projet_id and ((cp.model_id is not null and v.model_id = cp.model_id)
    or (cp.contact_id is not null and v.contact_id = cp.contact_id) or (registre is not null and v.mannequin_id = registre)) limit 1;
  -- seules les mannequins retenues pour ce défilé voient le programme
  if moi is null then return null; end if;
  return json_build_object('passages', coalesce((
    select json_agg(json_build_object('jour', p.jour, 'debut', p.debut, 'salle', p.salle, 'theme', p.theme,
      'moi', exists (select 1 from defile_affectations a where a.passage_id = p.id and a.vivier_id = moi),
      'mannequins', coalesce((select json_agg(json_build_object('nom', pe.nom, 'photo', pe.photo, 'moi', a.vivier_id = moi) order by v.sexe, pe.nom)
        from defile_affectations a join defile_vivier v on v.id = a.vivier_id cross join lateral defile_personne(v) pe where a.passage_id = p.id), '[]'::json))
      order by p.jour, p.debut nulls last)
    from defile_passages p where p.projet_id = cp.projet_id), '[]'::json));
end;
$$;
revoke all on function defile_programme(text) from public;
grant execute on function defile_programme(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
