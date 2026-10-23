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
-- (23/10/2026, demande de la propriétaire) une invitation peut aussi viser une mannequin du
-- registre de l'agence (espace Paiements) qui n'a pas encore de compte sur le site : mannequin_id
alter table places_invitations add column if not exists mannequin_id uuid references agence_mannequins(id) on delete cascade;
alter table places_invitations alter column model_id drop not null;
create unique index if not exists places_invitations_registre on places_invitations (projet_id, mannequin_id) where mannequin_id is not null;
-- (23/10/2026) … ou une personne extérieure, ajoutée à la main par l'agence (« ＋ Ajouter une
-- personne ») et gardée dans le carnet des Convocations : contact_id
alter table places_invitations add column if not exists contact_id uuid references contacts_externes(id) on delete cascade;
create unique index if not exists places_invitations_contact on places_invitations (projet_id, contact_id) where contact_id is not null;
alter table places_invitations drop constraint if exists places_invitations_quelquun;
alter table places_invitations add constraint places_invitations_quelquun check (model_id is not null or mannequin_id is not null or contact_id is not null);
-- le carnet des non-inscrits garde le lien avec le registre (convocation d'une mannequin du
-- registre qui a pris sa place)
alter table contacts_externes add column if not exists mannequin_id uuid unique references agence_mannequins(id) on delete set null;
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

-- 4) Préparer les liens : une invitation pour chaque mannequin de l'agence du sexe demandé —
--    profil du site (publié dans le Book ou pas encore, jamais en sourdine, jamais une fiche sans
--    nom) ET mannequin active du registre (espace Paiements) sans compte sur le site (demandes de
--    la propriétaire du 23/10/2026) ; celles déjà invitées gardent leur lien. Renvoie le nombre
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
    where not m.desactive and length(trim(coalesce(m.full_name, ''))) > 0
      and ((places_sexe(m.category, m.civilite) = 'femme' and ap.places_femmes > 0)
        or (places_sexe(m.category, m.civilite) = 'homme' and ap.places_hommes > 0))
  on conflict (projet_id, model_id) do nothing;
  insert into places_invitations (projet_id, mannequin_id, sexe)
    select p_projet, r.id, coalesce(r.genre, 'femme')
    from agence_mannequins r
    where r.statut = 'actif' and r.user_id is null and length(trim(r.full_name)) > 0
      and ((coalesce(r.genre, 'femme') = 'femme' and ap.places_femmes > 0)
        or (r.genre = 'homme' and ap.places_hommes > 0))
  on conflict (projet_id, mannequin_id) where mannequin_id is not null do nothing;
  -- une fiche du site sans nom (compte jamais rempli) invitée par erreur avant : retirée si rien n'est parti
  delete from places_invitations i using model_profiles m
    where i.projet_id = p_projet and m.id = i.model_id and length(trim(coalesce(m.full_name, ''))) = 0
      and i.statut in ('invite', 'exclu') and i.envoye_le is null and i.parent_envoye_le is null;
  select count(*) into n from places_invitations where projet_id = p_projet;
  return n;
end;
$$;
revoke all on function places_preparer(uuid) from public, anon;
grant execute on function places_preparer(uuid) to authenticated;

-- 4 bis) Coordonnées des mannequins du registre invitées (sans compte sur le site) : réservé à
--    l'agence, comme convocation_contacts_mannequins.
create or replace function places_contacts_registre(p_ids uuid[])
returns table(mannequin_id uuid, full_name text, genre text, phone text, contact_email text,
              date_naissance date, parent_nom text, parent_telephone text, parent_email text)
language sql stable security definer set search_path = public as $$
  select r.id, r.full_name, r.genre, r.telephone, r.email, r.date_naissance, r.parent_nom, r.parent_telephone, r.parent_email
  from agence_mannequins r
  where r.id = any(p_ids) and exists (select 1 from admins where user_id = auth.uid());
$$;
revoke all on function places_contacts_registre(uuid[]) from public, anon;
grant execute on function places_contacts_registre(uuid[]) to authenticated;

-- 4 ter) places_participant_registre (mannequin du registre qui prend sa place → participant du
--    projet) : définie dans supabase-personnes.sql (23/10/2026, parent facultatif).

-- les participants du projet qui correspondent à une invitation (profil du site, registre ou
-- personne extérieure du carnet)
drop function if exists places_participants_de(uuid, uuid, uuid);
create or replace function places_participants_de(p_inv places_invitations)
returns setof uuid language sql stable security definer set search_path = public as $$
  select cp.id from convocation_participants cp
  where cp.projet_id = p_inv.projet_id
    and ((p_inv.model_id is not null and cp.model_id = p_inv.model_id)
      or (p_inv.mannequin_id is not null and cp.contact_id = (select c.id from contacts_externes c where c.mannequin_id = p_inv.mannequin_id))
      or (p_inv.contact_id is not null and cp.contact_id = p_inv.contact_id));
$$;
revoke all on function places_participants_de(places_invitations) from public, anon, authenticated;

-- une personne extérieure qui prend sa place : participant du projet, pour la convocation
create or replace function places_participant_contact(p_projet uuid, p_contact uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare part uuid;
begin
  select id into part from convocation_participants where projet_id = p_projet and contact_id = p_contact;
  if part is null then
    insert into convocation_participants (projet_id, contact_id, nom, email, telephone)
      select p_projet, c.id, left(trim(coalesce(c.civilite || ' ', '') || c.nom), 160), c.email, c.telephone
      from contacts_externes c where c.id = p_contact
      returning id into part;
  end if;
  return part;
end;
$$;
revoke all on function places_participant_contact(uuid, uuid) from public, anon, authenticated;

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
  r agence_mannequins;
  ce contacts_externes;
begin
  if length(coalesce(p_jeton, '')) <> 36 then return null; end if;
  select * into inv from places_invitations where jeton = p_jeton and statut <> 'exclu';
  if not found then return null; end if;
  select * into ap from places_appels where projet_id = inv.projet_id;
  select * into a from agenda_projets where id = inv.projet_id;
  select * into m from model_profiles where id = inv.model_id;
  select * into r from agence_mannequins where id = inv.mannequin_id;
  select * into ce from contacts_externes where id = inv.contact_id;
  return jsonb_build_object(
    'titre', a.titre, 'type', a.type, 'date_debut', a.date_debut, 'date_fin', a.date_fin,
    'heure_evenement', a.heure_evenement, 'lieu', a.lieu, 'ville', a.ville,
    'nom', coalesce(m.full_name, r.full_name, ce.nom),
    'civilite', case when inv.model_id is not null then m.civilite when inv.contact_id is not null then ce.civilite when r.genre = 'homme' then 'Monsieur' else 'Mademoiselle' end, 'sexe', inv.sexe, 'statut', inv.statut, 'pris_par', inv.pris_par,
    'ouvert', ap.ouvert and not a.annule, 'passe', a.annule or coalesce(a.date_fin, a.date_debut) < current_date,
    'places_femmes', ap.places_femmes, 'places_hommes', ap.places_hommes,
    'pris', coalesce((
      select jsonb_agg(jsonb_build_object(
          'sexe', i.sexe, 'moi', i.id = inv.id,
          'initiales', upper(left(split_part(trim(coalesce(p.full_name, rg.full_name, cx.nom)), ' ', 1), 1) || left(split_part(trim(coalesce(p.full_name, rg.full_name, cx.nom)), ' ', 2), 1)),
          'photo', case when p.published and p.date_naissance is not null and p.date_naissance <= current_date - interval '18 years' then
            (select coalesce(ph.url_miniature, ph.url) from model_photos ph where ph.model_id = i.model_id order by ph.principale desc, ph.created_at asc limit 1) end)
        order by i.pris_le)
      from places_invitations i left join model_profiles p on p.id = i.model_id left join agence_mannequins rg on rg.id = i.mannequin_id left join contacts_externes cx on cx.id = i.contact_id
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
  if inv.model_id is not null then
    update agenda_projets set mannequin_ids = array_append(array_remove(mannequin_ids, inv.model_id), inv.model_id), updated_at = now()
      where id = projet;
  elsif inv.mannequin_id is not null then
    -- mannequin du registre (sans compte) : ajoutée aux participants du projet, pour la convocation
    perform places_participant_registre(projet, inv.mannequin_id);
  else
    -- personne extérieure (carnet) : idem
    perform places_participant_contact(projet, inv.contact_id);
  end if;
  -- place reprise après un désistement : plus « absente », et les rappels (veille, quelques jours
  -- avant), annulés par le désistement, repartent s'ils sont encore à venir
  if inv.statut = 'desiste' then
    update convocation_participants set reponse = null, repondu_le = null
      where id in (select places_participants_de(inv)) and reponse = 'absent';
    update convocation_envois e set statut = 'programme'
      where e.participant_id in (select places_participants_de(inv))
        and e.sorte in ('rappel', 'rappel_avant') and e.statut = 'annule' and e.prevu_le > now();
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
  if inv.model_id is not null then
    update agenda_projets set mannequin_ids = array_remove(mannequin_ids, inv.model_id), updated_at = now() where id = projet;
  end if;
  update convocation_participants set reponse = 'absent', repondu_le = now()
    where id in (select places_participants_de(inv));
  update convocation_envois e set statut = 'annule'
    where e.participant_id in (select places_participants_de(inv)) and e.statut = 'programme';
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
    where i.projet_id = NEW.id and i.statut = 'pris' and i.model_id is not null and not (i.model_id = any(NEW.mannequin_ids))), '{}');
  return NEW;
end;
$$;
drop trigger if exists places_garder_selectionnees on agenda_projets;
create trigger places_garder_selectionnees before update of mannequin_ids on agenda_projets
  for each row execute function places_garder_selectionnees();

NOTIFY pgrst, 'reload schema';
