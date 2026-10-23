-- « Places limitées » (23/10/2026, demande de la propriétaire) : pour un projet de l'agenda,
-- l'agence ouvre un nombre de places par sexe (ex. 15 femmes, 5 hommes) et envoie à CHAQUE
-- mannequin, un message à la fois sur WhatsApp, son lien personnel (le même pour une mineure et
-- son parent). Premier arrivé, premier servi : « Bravo, vous êtes sélectionné(e) » ou « Oups…
-- plus de place disponible ». On peut se désister : la place se libère. Une place prise ajoute la
-- mannequin au projet (agenda_projets.mannequin_ids) : elle apparaît dans « Convoquer » pour
-- l'annonce de la sélection, la convocation et les relances.
-- À exécuter une fois dans Supabase (SQL Editor), après supabase-convocations.sql. Rejouable.

-- 1) L'appel à places d'un projet : nombre de places par sexe, ouvert ou fermé
create table if not exists places_appels (
  projet_id uuid primary key references agenda_projets(id) on delete cascade,
  places_femmes int not null default 0 check (places_femmes between 0 and 500),
  places_hommes int not null default 0 check (places_hommes between 0 and 500),
  ouvert boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) Une invitation par mannequin et par projet, avec son lien personnel (jeton impossible à
--    deviner). statut : invite → pris (place prise) → desiste (place rendue, reprenable s'il en reste) ;
--    exclu : décochée par l'agence (« Qui reçoit le lien ? ») : ne reçoit rien, ne peut rien prendre.
create table if not exists places_invitations (
  id uuid primary key default gen_random_uuid(),
  projet_id uuid not null references places_appels(projet_id) on delete cascade,
  model_id uuid not null references model_profiles(id) on delete cascade,
  sexe text not null check (sexe in ('femme', 'homme')),
  jeton text not null default encode(extensions.gen_random_bytes(18), 'hex'),
  statut text not null default 'invite',
  pris_par text check (pris_par is null or pris_par in ('mannequin', 'parent')),
  pris_le timestamptz,
  desiste_le timestamptz,
  envoye_le timestamptz,          -- message WhatsApp ouvert pour la mannequin
  parent_envoye_le timestamptz,   -- … et pour son parent (mineure)
  created_at timestamptz not null default now(),
  unique (projet_id, model_id)
);
-- (la liste des statuts s'est agrandie le 23/10/2026 : « exclu »)
alter table places_invitations drop constraint if exists places_invitations_statut_check;
alter table places_invitations add constraint places_invitations_statut_check check (statut in ('invite', 'pris', 'desiste', 'exclu'));
create unique index if not exists places_invitations_jeton on places_invitations (jeton);
create index if not exists places_invitations_projet on places_invitations (projet_id, sexe, statut);

-- Réservé à l'agence (comme les convocations) ; les mannequins passent par les fonctions ci-dessous
alter table places_appels enable row level security;
alter table places_invitations enable row level security;
revoke all on places_appels from anon;
revoke all on places_invitations from anon;
drop policy if exists "Places : admins seulement" on places_appels;
create policy "Places : admins seulement" on places_appels for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));
drop policy if exists "Places : admins seulement" on places_invitations;
create policy "Places : admins seulement" on places_invitations for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- 3) Sexe d'une mannequin : catégorie « homme » ou civilité « Monsieur », sinon femme
create or replace function places_sexe(p_category text, p_civilite text)
returns text language sql immutable as $$
  select case when lower(coalesce(p_category, '')) = 'homme' or p_civilite = 'Monsieur' then 'homme' else 'femme' end;
$$;

-- 4) Préparer les liens : une invitation pour chaque mannequin de l'agence (profil publié, pas
--    en sourdine) du sexe demandé ; celles déjà invitées gardent leur lien. Renvoie le nombre
--    d'invitations du projet.
create or replace function places_preparer(p_projet uuid)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  ap places_appels;
  n int;
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then raise exception 'Réservé à l''agence.'; end if;
  select * into ap from places_appels where projet_id = p_projet;
  if not found then raise exception 'Aucun appel à places pour ce projet.'; end if;
  insert into places_invitations (projet_id, model_id, sexe)
    select p_projet, m.id, places_sexe(m.category, m.civilite)
    from model_profiles m
    where m.published and not m.desactive
      and ((places_sexe(m.category, m.civilite) = 'femme' and ap.places_femmes > 0)
        or (places_sexe(m.category, m.civilite) = 'homme' and ap.places_hommes > 0))
  on conflict (projet_id, model_id) do nothing;
  select count(*) into n from places_invitations where projet_id = p_projet;
  return n;
end;
$$;
revoke all on function places_preparer(uuid) from public, anon;
grant execute on function places_preparer(uuid) to authenticated;

-- 5) Page publique du lien (sans compte) : le projet (sans adresse ni programme), la personne,
--    les places et la grille des places prises : photo (miniature) d'une personne majeure dont le
--    profil est publié dans le Book ; sinon les initiales. Jamais les noms des autres ; jamais le
--    visage d'un(e) mineur(e) (le lien peut être transféré).
create or replace function places_lire(p_jeton text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  inv places_invitations;
  ap places_appels;
  a agenda_projets;
  m model_profiles;
begin
  if length(coalesce(p_jeton, '')) <> 36 then return null; end if;
  select * into inv from places_invitations where jeton = p_jeton and statut <> 'exclu';
  if not found then return null; end if;
  select * into ap from places_appels where projet_id = inv.projet_id;
  select * into a from agenda_projets where id = inv.projet_id;
  select * into m from model_profiles where id = inv.model_id;
  return jsonb_build_object(
    'titre', a.titre, 'type', a.type, 'date_debut', a.date_debut, 'date_fin', a.date_fin,
    'heure_evenement', a.heure_evenement, 'lieu', a.lieu, 'ville', a.ville,
    'nom', m.full_name, 'civilite', m.civilite, 'sexe', inv.sexe, 'statut', inv.statut, 'pris_par', inv.pris_par,
    'ouvert', ap.ouvert and not a.annule, 'passe', a.annule or coalesce(a.date_fin, a.date_debut) < current_date,
    'places_femmes', ap.places_femmes, 'places_hommes', ap.places_hommes,
    'pris', coalesce((
      select jsonb_agg(jsonb_build_object(
          'sexe', i.sexe, 'moi', i.id = inv.id,
          'initiales', upper(left(split_part(trim(p.full_name), ' ', 1), 1) || left(split_part(trim(p.full_name), ' ', 2), 1)),
          'photo', case when p.published and p.date_naissance is not null and p.date_naissance <= current_date - interval '18 years' then
            (select coalesce(ph.url_miniature, ph.url) from model_photos ph where ph.model_id = i.model_id order by ph.principale desc, ph.created_at asc limit 1) end)
        order by i.pris_le)
      from places_invitations i join model_profiles p on p.id = i.model_id
      where i.projet_id = inv.projet_id and i.statut = 'pris'), '[]'::jsonb));
end;
$$;
revoke all on function places_lire(text) from public;
grant execute on function places_lire(text) to anon, authenticated;

-- 6) Prendre sa place : premier arrivé, premier servi. Le verrou sur l'appel fait passer les
--    clics un par un : jamais plus de places prises que prévu, même si tout le monde clique en
--    même temps. Réponses : pris, deja, complet, ferme, termine, inconnu.
create or replace function places_prendre(p_jeton text, p_parent boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  projet uuid;
  inv places_invitations;
  ap places_appels;
  a agenda_projets;
  n int;
  places int;
begin
  if length(coalesce(p_jeton, '')) <> 36 then return 'inconnu'; end if;
  select projet_id into projet from places_invitations where jeton = p_jeton;
  if not found then return 'inconnu'; end if;
  select * into ap from places_appels where projet_id = projet for update;
  select * into inv from places_invitations where jeton = p_jeton;
  if inv.statut = 'exclu' then return 'inconnu'; end if;
  select * into a from agenda_projets where id = projet;
  if a.annule or coalesce(a.date_fin, a.date_debut) < current_date then return 'termine'; end if;
  if inv.statut = 'pris' then return 'deja'; end if;
  if not ap.ouvert then return 'ferme'; end if;
  select count(*) into n from places_invitations where projet_id = projet and sexe = inv.sexe and statut = 'pris';
  places := case inv.sexe when 'homme' then ap.places_hommes else ap.places_femmes end;
  if n >= places then return 'complet'; end if;
  update places_invitations set statut = 'pris', pris_le = now(), desiste_le = null,
      pris_par = case when p_parent then 'parent' else 'mannequin' end
    where id = inv.id;
  update agenda_projets set mannequin_ids = array_append(array_remove(mannequin_ids, inv.model_id), inv.model_id), updated_at = now()
    where id = projet;
  -- place reprise après un désistement : plus « absente », et le rappel de la veille (annulé par
  -- le désistement) repart s'il est encore à venir
  if inv.statut = 'desiste' then
    update convocation_participants set reponse = null, repondu_le = null
      where projet_id = projet and model_id = inv.model_id and reponse = 'absent';
    update convocation_envois e set statut = 'programme'
      from convocation_participants cp
      where cp.id = e.participant_id and cp.projet_id = projet and cp.model_id = inv.model_id
        and e.sorte = 'rappel' and e.statut = 'annule' and e.prevu_le > now();
  end if;
  return 'pris';
end;
$$;
revoke all on function places_prendre(text, boolean) from public;
grant execute on function places_prendre(text, boolean) to anon, authenticated;

-- 7) Se désister : la place se libère, la mannequin quitte le projet ; si elle avait déjà été
--    prévenue (sélection, convocation), elle est notée « absente » et ses envois programmés
--    sont annulés. Réponses : desiste, pas_pris, termine, inconnu.
create or replace function places_rendre(p_jeton text)
returns text language plpgsql security definer set search_path = public as $$
declare
  projet uuid;
  inv places_invitations;
  a agenda_projets;
begin
  if length(coalesce(p_jeton, '')) <> 36 then return 'inconnu'; end if;
  select projet_id into projet from places_invitations where jeton = p_jeton;
  if not found then return 'inconnu'; end if;
  perform 1 from places_appels where projet_id = projet for update;
  select * into inv from places_invitations where jeton = p_jeton;
  select * into a from agenda_projets where id = projet;
  if a.annule or coalesce(a.date_fin, a.date_debut) < current_date then return 'termine'; end if;
  if inv.statut <> 'pris' then return 'pas_pris'; end if;
  update places_invitations set statut = 'desiste', desiste_le = now() where id = inv.id;
  update agenda_projets set mannequin_ids = array_remove(mannequin_ids, inv.model_id), updated_at = now() where id = projet;
  update convocation_participants set reponse = 'absent', repondu_le = now()
    where projet_id = projet and model_id = inv.model_id;
  update convocation_envois e set statut = 'annule'
    from convocation_participants cp
    where cp.id = e.participant_id and cp.projet_id = projet and cp.model_id = inv.model_id and e.statut = 'programme';
  return 'desiste';
end;
$$;
revoke all on function places_rendre(text) from public;
grant execute on function places_rendre(text) to anon, authenticated;

-- 8) Le formulaire de l'agenda ou des Convocations enregistre la liste des mannequins telle
--    qu'elle était à son ouverture : une mannequin qui a pris sa place entre-temps est gardée
--    dans le projet (sinon elle disparaîtrait de « Convoquer »).
create or replace function places_garder_selectionnees()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  NEW.mannequin_ids := NEW.mannequin_ids || coalesce((
    select array_agg(i.model_id) from places_invitations i
    where i.projet_id = NEW.id and i.statut = 'pris' and not (i.model_id = any(NEW.mannequin_ids))), '{}');
  return NEW;
end;
$$;
drop trigger if exists places_garder_selectionnees on agenda_projets;
create trigger places_garder_selectionnees before update of mannequin_ids on agenda_projets
  for each row execute function places_garder_selectionnees();

NOTIFY pgrst, 'reload schema';
