-- ===================================================================
-- Extension : catégories, vidéo runway, candidatures de casting
-- À coller dans Supabase > SQL Editor > New query > Run
-- ===================================================================

-- 1. Nouveaux champs sur les profils mannequins
alter table model_profiles add column if not exists category text default 'new-faces';
-- valeurs attendues : 'homme', 'femme', 'new-faces'
alter table model_profiles add column if not exists video_url text;
-- lien YouTube ou Vimeo non-listé (runway walk)
alter table model_profiles add column if not exists chest_cm int;
alter table model_profiles add column if not exists waist_cm int;
alter table model_profiles add column if not exists hips_cm int;
alter table model_profiles add column if not exists shoe_size text;

-- 2. Table des candidatures de casting (formulaire public)
create table if not exists casting_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  city text,
  height_cm int,
  chest_cm int,
  waist_cm int,
  hips_cm int,
  shoe_size text,
  message text,
  status text not null default 'nouvelle', -- nouvelle / vue / retenue / refusée
  created_at timestamptz not null default now()
);

create table if not exists casting_photos (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references casting_applications(id) on delete cascade,
  url text not null,
  chemin text,
  created_at timestamptz not null default now()
);

-- 3. Bucket de stockage pour les photos de candidature (privé, l'agence seule y accède)
insert into storage.buckets (id, name, public)
values ('casting-applications', 'casting-applications', false)
on conflict (id) do nothing;

-- 4. Sécurité
alter table casting_applications enable row level security;
alter table casting_photos enable row level security;

-- N'importe quel visiteur peut soumettre une candidature (insert seul, pas de lecture)
drop policy if exists "Tout le monde peut candidater" on casting_applications;
create policy "Tout le monde peut candidater"
  on casting_applications for insert
  with check (true);

drop policy if exists "Tout le monde peut joindre des photos de candidature" on casting_photos;
create policy "Tout le monde peut joindre des photos de candidature"
  on casting_photos for insert
  with check (true);

-- Upload de photo de candidature autorisé pour tous (écriture seule)
drop policy if exists "Upload candidature" on storage.objects;
create policy "Upload candidature"
  on storage.objects for insert
  with check (bucket_id = 'casting-applications');

-- Personne ne peut lire les candidatures ni leurs photos publiquement :
-- consulte-les depuis Supabase (Table Editor / Storage), en tant que propriétaire du projet.

NOTIFY pgrst, 'reload schema';
-- ===================================================================

-- ===================================================================
-- Extension 2 : informations compcard complètes pour les recruteurs
-- ===================================================================
alter table model_profiles add column if not exists carnation text;
-- valeurs libres, ex: Claire, Métisse claire, Métisse foncée, Foncée, Très foncée
alter table model_profiles add column if not exists clothing_size text;
-- taille de vêtements, ex: S, M, L, 38, 40...

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 3 : compléter la fiche technique (compcard) du mannequin
-- ===================================================================
alter table model_profiles add column if not exists date_naissance date;
alter table model_profiles add column if not exists eye_color text;
alter table model_profiles add column if not exists hair_color text;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 4 : demandes de casting des recruteurs (panier de sélection)
-- ===================================================================
create table if not exists recruiter_requests (
  id uuid primary key default gen_random_uuid(),
  company text,
  contact_name text not null,
  email text not null,
  phone text,
  whatsapp text,
  project_type text,
  event_date date,
  city text,
  message text,
  status text not null default 'nouvelle', -- nouvelle / vue / traitée
  created_at timestamptz not null default now()
);

create table if not exists recruiter_request_models (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references recruiter_requests(id) on delete cascade,
  model_id uuid references model_profiles(id),
  model_name_snapshot text,
  model_height_snapshot int,
  created_at timestamptz not null default now()
);

alter table recruiter_requests enable row level security;
alter table recruiter_request_models enable row level security;

drop policy if exists "Tout le monde peut envoyer une demande de casting" on recruiter_requests;
create policy "Tout le monde peut envoyer une demande de casting"
  on recruiter_requests for insert
  with check (true);

drop policy if exists "Tout le monde peut joindre des mannequins a une demande" on recruiter_request_models;
create policy "Tout le monde peut joindre des mannequins a une demande"
  on recruiter_request_models for insert
  with check (true);

-- Personne ne peut lire ces demandes publiquement : consulte-les via Supabase Table Editor.

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Réparation : forcer les buckets et les règles de stockage
-- ===================================================================

-- Certains buckets ont pu être créés "privés" par erreur — on force le mode public
update storage.buckets set public = true where id = 'model-photos';

-- On nettoie et recrée proprement toutes les règles de stockage pour model-photos
drop policy if exists "Upload dans son propre dossier" on storage.objects;
create policy "Upload dans son propre dossier"
  on storage.objects for insert
  with check (bucket_id = 'model-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Suppression dans son propre dossier" on storage.objects;
create policy "Suppression dans son propre dossier"
  on storage.objects for delete
  using (bucket_id = 'model-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Photos visibles publiquement" on storage.objects;
create policy "Photos visibles publiquement"
  on storage.objects for select
  using (bucket_id = 'model-photos');

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 5 : page Actualités & Activités (avec publication admin)
-- ===================================================================
create table if not exists admins (
  user_id uuid primary key references auth.users(id)
);

create table if not exists actualites (
  id uuid primary key default gen_random_uuid(),
  titre text,
  image_url text not null,
  chemin text,
  commentaire text,
  created_at timestamptz not null default now()
);

alter table actualites enable row level security;
alter table admins enable row level security;

drop policy if exists "Actualites visibles de tous" on actualites;
create policy "Actualites visibles de tous"
  on actualites for select using (true);

drop policy if exists "Seuls les admins publient" on actualites;
create policy "Seuls les admins publient"
  on actualites for insert
  with check (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins suppriment" on actualites;
create policy "Seuls les admins suppriment"
  on actualites for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

insert into storage.buckets (id, name, public)
values ('actualites-images', 'actualites-images', true)
on conflict (id) do nothing;

drop policy if exists "Admins uploadent actualites" on storage.objects;
create policy "Admins uploadent actualites"
  on storage.objects for insert
  with check (bucket_id = 'actualites-images' and exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Actualites images visibles" on storage.objects;
create policy "Actualites images visibles"
  on storage.objects for select
  using (bucket_id = 'actualites-images');

NOTIFY pgrst, 'reload schema';
-- ===================================================================
-- Après avoir exécuté ce bloc :
-- 1. Authentication > Add user > crée-toi un compte admin (email + mot de passe)
-- 2. Copie son "User UID"
-- 3. Table Editor > admins > Insert row > colle cet UID dans "user_id"
-- ===================================================================

-- ===================================================================
-- Correctif : autoriser la lecture de la table admins (RLS manquante)
-- ===================================================================
drop policy if exists "Un utilisateur peut verifier son statut admin" on admins;
create policy "Un utilisateur peut verifier son statut admin"
  on admins for select
  using (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 6 : vidéos dans les actualités + inscription nouveaux mannequins
-- ===================================================================
alter table actualites add column if not exists video_url text;

create table if not exists codes_inscription (
  code text primary key,
  created_at timestamptz not null default now()
);

create table if not exists inscriptions_mannequins (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  date_naissance date,
  height_cm int,
  clothing_size text,
  code_utilise text,
  statut text not null default 'en attente de paiement',
  created_at timestamptz not null default now()
);

create table if not exists inscriptions_photos (
  id uuid primary key default gen_random_uuid(),
  inscription_id uuid references inscriptions_mannequins(id) on delete cascade,
  url text not null,
  chemin text,
  created_at timestamptz not null default now()
);

alter table codes_inscription enable row level security;
alter table inscriptions_mannequins enable row level security;
alter table inscriptions_photos enable row level security;

-- Personne ne lit directement la liste des codes : uniquement via cette fonction
create or replace function verifier_code_inscription(code_input text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from codes_inscription where code = code_input);
$$;
revoke all on function verifier_code_inscription from public;
grant execute on function verifier_code_inscription to anon, authenticated;

drop policy if exists "Tout le monde peut s'inscrire" on inscriptions_mannequins;
create policy "Tout le monde peut s'inscrire"
  on inscriptions_mannequins for insert with check (true);

drop policy if exists "Tout le monde peut joindre des photos d'inscription" on inscriptions_photos;
create policy "Tout le monde peut joindre des photos d'inscription"
  on inscriptions_photos for insert with check (true);

insert into storage.buckets (id, name, public)
values ('inscriptions-photos', 'inscriptions-photos', false)
on conflict (id) do nothing;

drop policy if exists "Upload photos inscription" on storage.objects;
create policy "Upload photos inscription"
  on storage.objects for insert
  with check (bucket_id = 'inscriptions-photos');

NOTIFY pgrst, 'reload schema';
-- ===================================================================
-- Ajoute ton code d'inscription général ici (remplace VOTRECODE) :
-- insert into codes_inscription (code) values ('VOTRECODE');
-- ===================================================================

-- ===================================================================
-- Extension 7 : coordonnées du mannequin sur la fiche d'inscription
-- ===================================================================
alter table inscriptions_mannequins add column if not exists phone text;
alter table inscriptions_mannequins add column if not exists email text;
alter table inscriptions_mannequins add column if not exists instagram text;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 8 : taille minimale candidature + galerie actualités + statistiques
-- ===================================================================
alter table casting_applications add column if not exists genre text;

-- Galerie multi-photos pour les actualités
alter table actualites alter column image_url drop not null;
create table if not exists actualite_photos (
  id uuid primary key default gen_random_uuid(),
  actualite_id uuid references actualites(id) on delete cascade,
  url text not null,
  chemin text,
  created_at timestamptz not null default now()
);
alter table actualite_photos enable row level security;

drop policy if exists "Photos actualites visibles de tous" on actualite_photos;
create policy "Photos actualites visibles de tous"
  on actualite_photos for select using (true);

drop policy if exists "Seuls les admins ajoutent des photos actu" on actualite_photos;
create policy "Seuls les admins ajoutent des photos actu"
  on actualite_photos for insert
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- Compteur de visites (statistiques simples pour le tableau de bord)
create table if not exists page_views (
  id bigint generated always as identity primary key,
  page text,
  created_at timestamptz not null default now()
);
alter table page_views enable row level security;

drop policy if exists "Tout le monde peut logger une visite" on page_views;
create policy "Tout le monde peut logger une visite"
  on page_views for insert with check (true);

drop policy if exists "Seuls les admins consultent les visites" on page_views;
create policy "Seuls les admins consultent les visites"
  on page_views for select
  using (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 9 : autoriser l'administrateur à consulter les données
-- (jusqu'ici seule l'écriture était permise — nécessaire pour le tableau de bord)
-- ===================================================================
drop policy if exists "Les admins consultent toutes les candidatures" on casting_applications;
create policy "Les admins consultent toutes les candidatures"
  on casting_applications for select
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins consultent toutes les demandes recruteurs" on recruiter_requests;
create policy "Les admins consultent toutes les demandes recruteurs"
  on recruiter_requests for select
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins consultent toutes les inscriptions" on inscriptions_mannequins;
create policy "Les admins consultent toutes les inscriptions"
  on inscriptions_mannequins for select
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins consultent toutes les photos" on model_photos;
create policy "Les admins consultent toutes les photos"
  on model_photos for select
  using (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 10 : contact personnel du mannequin (usage interne agence
-- uniquement — jamais affiché publiquement)
-- ===================================================================
alter table model_profiles add column if not exists phone text;
alter table model_profiles add column if not exists contact_email text;

-- Double sécurité : même si un futur code demandait "select *" sur une
-- page publique par erreur, ces deux colonnes restent invisibles pour
-- les visiteurs non connectés (rôle anon).
revoke select (phone, contact_email) on model_profiles from anon;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 11 : expérience, type de modèle et projets réalisés
-- (visible par les recruteurs sur la fiche publique mannequin.html)
-- ===================================================================
alter table model_profiles add column if not exists years_experience int;
alter table model_profiles add column if not exists model_types text[];
-- model_types valeurs possibles : 'catwalk', 'photo', 'publicite', 'commercial', 'autre'

create table if not exists model_projects (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references model_profiles(id) on delete cascade,
  type_projet text not null, -- défilé / shoot photo / publicité / autre
  titre text,
  periode text,
  pays text,
  ville text,
  promoteur text,
  created_at timestamptz not null default now()
);

alter table model_projects enable row level security;

drop policy if exists "Projets visibles si profil publié" on model_projects;
create policy "Projets visibles si profil publié"
  on model_projects for select
  using (exists (
    select 1 from model_profiles p
    where p.id = model_projects.model_id and p.published = true
  ));

drop policy if exists "Le mannequin gère ses propres projets" on model_projects;
create policy "Le mannequin gère ses propres projets"
  on model_projects for all
  using (auth.uid() = model_id)
  with check (auth.uid() = model_id);

drop policy if exists "Les admins consultent tous les projets" on model_projects;
create policy "Les admins consultent tous les projets"
  on model_projects for select
  using (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 12 : carte de présentation du mannequin — langues, disponibilité
-- (le lien vidéo runway est retiré, remplacé par la section Projets réalisés
-- qui remonte plus haut dans le profil)
-- ===================================================================
alter table model_profiles add column if not exists languages text;
-- texte libre, ex: "Français, Anglais"
alter table model_profiles add column if not exists availability text;
-- valeurs attendues : 'immediate', 'rdv', 'mobile'

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 13 : mensuration spécifique aux mannequins hommes (entrejambe)
-- ===================================================================
alter table model_profiles add column if not exists inseam_cm int;
-- entrejambe (cm) — mesure standard pour les mannequins hommes, remplace "Hanches"

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 14 : modification et suppression des actualités par l'admin
-- ===================================================================
drop policy if exists "Seuls les admins modifient" on actualites;
create policy "Seuls les admins modifient"
  on actualites for update
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins modifient les photos actu" on actualite_photos;
create policy "Seuls les admins modifient les photos actu"
  on actualite_photos for update
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins suppriment les photos actu" on actualite_photos;
create policy "Seuls les admins suppriment les photos actu"
  on actualite_photos for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Admins suppriment fichiers actualites" on storage.objects;
create policy "Admins suppriment fichiers actualites"
  on storage.objects for delete
  using (bucket_id = 'actualites-images' and exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 15 : mannequin à la une (page d'accueil)
-- ===================================================================
alter table model_profiles add column if not exists featured boolean default false;

drop policy if exists "Les admins mettent en avant un mannequin" on model_profiles;
create policy "Les admins mettent en avant un mannequin"
  on model_profiles for update
  using (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 16 : partenaires/contacts associés à une actualité
-- (pour la section "Ils nous ont fait confiance" de la page d'accueil)
-- ===================================================================
create table if not exists actualite_partenaires (
  id uuid primary key default gen_random_uuid(),
  actualite_id uuid references actualites(id) on delete cascade,
  role text not null, -- DA, Promoteur, Porteur de projet, Régisseur, Superviseur projet, Autre
  nom text not null,  -- nom de la personne ou de l'institution
  logo_url text,
  logo_chemin text,
  created_at timestamptz not null default now()
);

alter table actualite_partenaires enable row level security;

drop policy if exists "Partenaires visibles de tous" on actualite_partenaires;
create policy "Partenaires visibles de tous"
  on actualite_partenaires for select using (true);

drop policy if exists "Seuls les admins ajoutent des partenaires" on actualite_partenaires;
create policy "Seuls les admins ajoutent des partenaires"
  on actualite_partenaires for insert
  with check (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins suppriment des partenaires" on actualite_partenaires;
create policy "Seuls les admins suppriment des partenaires"
  on actualite_partenaires for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

insert into storage.buckets (id, name, public)
values ('partenaires-logos', 'partenaires-logos', true)
on conflict (id) do nothing;

drop policy if exists "Admins uploadent logos partenaires" on storage.objects;
create policy "Admins uploadent logos partenaires"
  on storage.objects for insert
  with check (bucket_id = 'partenaires-logos' and exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Logos partenaires visibles" on storage.objects;
create policy "Logos partenaires visibles"
  on storage.objects for select
  using (bucket_id = 'partenaires-logos');

drop policy if exists "Admins suppriment logos partenaires" on storage.objects;
create policy "Admins suppriment logos partenaires"
  on storage.objects for delete
  using (bucket_id = 'partenaires-logos' and exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 17 : page "Nos partenaires" — indépendante des actualités
-- (remplace l'usage de actualite_partenaires, qui reste en base mais n'est
-- plus utilisé par le site ; tu peux la supprimer plus tard si tu veux)
-- ===================================================================
create table if not exists partenaires (
  id uuid primary key default gen_random_uuid(),
  nom text not null,          -- nom de la personne ou de l'institution
  structure text,             -- structure/organisation qu'elle représente
  evenement text,             -- événement associé (ex: Cacao Fashion Show)
  role text,                  -- DA, Styliste, Directeur de casting, Promoteur, Organisateur, Régisseur, Autre
  description text,           -- notes libres sur la collaboration
  logo_url text,
  logo_chemin text,
  created_at timestamptz not null default now()
);

alter table partenaires enable row level security;

drop policy if exists "Partenaires visibles de tous" on partenaires;
create policy "Partenaires visibles de tous"
  on partenaires for select using (true);

drop policy if exists "Seuls les admins ajoutent un partenaire" on partenaires;
create policy "Seuls les admins ajoutent un partenaire"
  on partenaires for insert
  with check (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins modifient un partenaire" on partenaires;
create policy "Seuls les admins modifient un partenaire"
  on partenaires for update
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins suppriment un partenaire" on partenaires;
create policy "Seuls les admins suppriment un partenaire"
  on partenaires for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 18 : AUDIT DE SÉCURITÉ — corrections
-- ===================================================================

-- 1. Empêche un mannequin de s'auto-désigner "mannequin à la une" (featured)
--    en modifiant sa propre fiche par un appel direct à l'API (la case à
--    cocher "featured" doit rester strictement réservée à l'admin).
create or replace function proteger_featured()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.featured is distinct from old.featured then
    if not exists (select 1 from admins where user_id = auth.uid()) then
      new.featured := old.featured;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_featured on model_profiles;
create trigger trg_proteger_featured
  before update on model_profiles
  for each row execute function proteger_featured();

-- 2. Empêche de falsifier le statut d'une candidature, d'une demande recruteur
--    ou d'une inscription au moment de l'envoi (un visiteur ne doit jamais
--    pouvoir s'auto-valider "retenue" ou "traitée" en contournant le formulaire).
create or replace function forcer_statut_nouvelle_candidature()
returns trigger language plpgsql as $$
begin
  new.status := 'nouvelle';
  return new;
end;
$$;
drop trigger if exists trg_statut_candidature on casting_applications;
create trigger trg_statut_candidature
  before insert on casting_applications
  for each row execute function forcer_statut_nouvelle_candidature();

create or replace function forcer_statut_nouvelle_demande()
returns trigger language plpgsql as $$
begin
  new.status := 'nouvelle';
  return new;
end;
$$;
drop trigger if exists trg_statut_recruteur on recruiter_requests;
create trigger trg_statut_recruteur
  before insert on recruiter_requests
  for each row execute function forcer_statut_nouvelle_demande();

create or replace function forcer_statut_inscription()
returns trigger language plpgsql as $$
begin
  new.statut := 'en attente de paiement';
  return new;
end;
$$;
drop trigger if exists trg_statut_inscription on inscriptions_mannequins;
create trigger trg_statut_inscription
  before insert on inscriptions_mannequins
  for each row execute function forcer_statut_inscription();

-- 3. Restreint les buckets de photos aux formats image réels, avec une taille
--    maximale (empêche l'envoi de fichiers exécutables/scripts déguisés en photo,
--    et les envois disproportionnés).
update storage.buckets
set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'],
    file_size_limit = 10485760 -- 10 Mo
where id in ('model-photos','actualites-images','partenaires-logos','casting-applications','inscriptions-photos');

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 19 : formulaire de contact enrichi + enregistrement en base
-- ===================================================================
create table if not exists messages_contact (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text,
  email text not null,
  type_contact text, -- Marque/Entreprise, Média/Presse, Mannequin, Particulier, Autre
  structure text,
  ville text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table messages_contact enable row level security;

drop policy if exists "Tout le monde peut envoyer un message de contact" on messages_contact;
create policy "Tout le monde peut envoyer un message de contact"
  on messages_contact for insert
  with check (true);

drop policy if exists "Seuls les admins consultent les messages de contact" on messages_contact;
create policy "Seuls les admins consultent les messages de contact"
  on messages_contact for select
  using (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 20 : "Activité à la une" — écran plein écran entre le logo
-- d'ouverture et la porte d'entrée du site (met en avant une actualité,
-- choisie par l'admin uniquement — jamais automatique)
-- ===================================================================
alter table actualites add column if not exists featured boolean default false;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 21 : visites réelles (empreinte IP anonymisée) + classement mannequins
-- ===================================================================
alter table page_views add column if not exists ip_hash text;
alter table page_views add column if not exists model_id uuid references model_profiles(id) on delete cascade;

create index if not exists idx_page_views_model on page_views(model_id);
create index if not exists idx_page_views_ip on page_views(ip_hash);

-- Calcule les vraies visites (personnes distinctes) côté serveur, plus fiable et
-- plus rapide que de recompter dans le navigateur.
create or replace function stats_visites_reelles_site()
returns bigint
language sql stable
as $$
  select count(distinct ip_hash) from page_views where ip_hash is not null;
$$;
revoke all on function stats_visites_reelles_site() from public;
grant execute on function stats_visites_reelles_site() to authenticated;

create or replace function stats_classement_mannequins()
returns table(model_id uuid, nb_visites bigint)
language sql stable
as $$
  select model_id, count(distinct ip_hash) as nb_visites
  from page_views
  where model_id is not null and ip_hash is not null
  group by model_id
  order by nb_visites desc;
$$;
revoke all on function stats_classement_mannequins() from public;
grant execute on function stats_classement_mannequins() to authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 22 : statistiques de visites par période (aujourd'hui / 7 jours /
-- total), comme le font les vrais outils d'analyse d'audience — appliqué au
-- site dans son ensemble ET au classement des mannequins.
-- ===================================================================
drop function if exists stats_visites_reelles_site();
create or replace function stats_visites_reelles_site(depuis timestamptz default null)
returns bigint
language sql stable
as $$
  select count(distinct ip_hash) from page_views
  where ip_hash is not null and (depuis is null or created_at >= depuis);
$$;
revoke all on function stats_visites_reelles_site(timestamptz) from public;
grant execute on function stats_visites_reelles_site(timestamptz) to authenticated;

drop function if exists stats_classement_mannequins();
create or replace function stats_classement_mannequins(depuis timestamptz default null)
returns table(model_id uuid, nb_visites bigint)
language sql stable
as $$
  select model_id, count(distinct ip_hash) as nb_visites
  from page_views
  where model_id is not null and ip_hash is not null and (depuis is null or created_at >= depuis)
  group by model_id
  order by nb_visites desc;
$$;
revoke all on function stats_classement_mannequins(timestamptz) from public;
grant execute on function stats_classement_mannequins(timestamptz) to authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 23 : "Contenu à la une" — RESET complet, système indépendant
-- des actualités. L'admin choisit une image, un texte ou une vidéo,
-- modifiable/supprimable à tout moment. (Remplace l'ancien système lié
-- à actualites.featured, qui reste en base mais n'est plus utilisé.)
-- ===================================================================
create table if not exists contenu_a_la_une (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('image','texte','video')),
  titre text,
  texte text,
  image_url text,
  image_chemin text,
  video_url text,
  actif boolean default false,
  created_at timestamptz not null default now()
);

alter table contenu_a_la_une enable row level security;

drop policy if exists "Contenu à la une visible de tous" on contenu_a_la_une;
create policy "Contenu à la une visible de tous"
  on contenu_a_la_une for select using (true);

drop policy if exists "Seuls les admins ajoutent un contenu à la une" on contenu_a_la_une;
create policy "Seuls les admins ajoutent un contenu à la une"
  on contenu_a_la_une for insert
  with check (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins modifient un contenu à la une" on contenu_a_la_une;
create policy "Seuls les admins modifient un contenu à la une"
  on contenu_a_la_une for update
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins suppriment un contenu à la une" on contenu_a_la_une;
create policy "Seuls les admins suppriment un contenu à la une"
  on contenu_a_la_une for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 24 : Catégories d'actualités — pastilles de filtre côté
-- public (Casting, Mannequinat, Conseils, Événements, Général). Colonne
-- nullable et rétrocompatible : les actualités déjà publiées restent
-- affichées (sans catégorie) sans aucune migration de données requise.
-- ===================================================================
alter table actualites add column if not exists categorie text;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 25 : Bandeau d'annonce (bande défilante de l'accueil) —
-- remplace le système "Contenu à la une" (écran d'ouverture image/texte/
-- vidéo), retiré car peu fiable. Une ligne unique, activable/désactivable
-- et éditable depuis le tableau de bord. Quand "actif" est faux (ou vide),
-- le site affiche automatiquement le texte par défaut de la bande.
-- ===================================================================
create table if not exists bandeau_annonce (
  id text primary key default 'principal',
  texte text,
  actif boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table bandeau_annonce enable row level security;

drop policy if exists "Bandeau visible de tous" on bandeau_annonce;
create policy "Bandeau visible de tous"
  on bandeau_annonce for select using (true);

drop policy if exists "Seuls les admins modifient le bandeau" on bandeau_annonce;
create policy "Seuls les admins modifient le bandeau"
  on bandeau_annonce for update
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

insert into bandeau_annonce (id, texte, actif) values ('principal', null, false)
  on conflict (id) do nothing;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 26 : AUDIT DE SÉCURITÉ #2 — fuite du téléphone/e-mail privé
-- des mannequins vers tout compte authentifié (pas seulement les visiteurs
-- anonymes). La colonne était retirée du rôle "anon" (Extension 10) mais
-- pas du rôle "authenticated" : n'importe quel compte connecté (recruteur,
-- autre mannequin...) pouvait interroger l'API Supabase directement et lire
-- le téléphone/e-mail privé de TOUS les mannequins publiés, en contournant
-- entièrement le site. Corrigé en retirant aussi l'accès à "authenticated",
-- et en donnant au mannequin une fonction dédiée pour lire uniquement SA
-- PROPRE fiche (utilisée par espace-mannequin.html).
-- ===================================================================
revoke select (phone, contact_email) on model_profiles from authenticated;

create or replace function mon_contact_prive()
returns table(phone text, contact_email text)
language sql security definer
set search_path = public
as $$
  select phone, contact_email from model_profiles where id = auth.uid();
$$;
revoke all on function mon_contact_prive from public;
grant execute on function mon_contact_prive to authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 27 : consultation des photos de candidature/inscription +
-- mise à jour du statut depuis le tableau de bord. Jusqu'ici, aucune
-- politique RLS ne permettait à l'admin de lire les tables casting_photos
-- et inscriptions_photos, ni de modifier le statut d'une candidature ou
-- d'une inscription : les photos envoyées par les candidats étaient
-- invisibles nulle part sur le site, même pour l'agence.
-- ===================================================================
drop policy if exists "Les admins consultent les photos de candidature" on casting_photos;
create policy "Les admins consultent les photos de candidature"
  on casting_photos for select
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins consultent les photos d'inscription" on inscriptions_photos;
create policy "Les admins consultent les photos d'inscription"
  on inscriptions_photos for select
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins modifient le statut d'une candidature" on casting_applications;
create policy "Les admins modifient le statut d'une candidature"
  on casting_applications for update
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins modifient le statut d'une inscription" on inscriptions_mannequins;
create policy "Les admins modifient le statut d'une inscription"
  on inscriptions_mannequins for update
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- Les deux buckets de stockage sont privés (public = false) : sans règle de
-- lecture, même un admin ne peut pas afficher les fichiers, la ligne en base
-- ne suffit pas.
drop policy if exists "Admins consultent les fichiers de candidature" on storage.objects;
create policy "Admins consultent les fichiers de candidature"
  on storage.objects for select
  using (bucket_id = 'casting-applications' and exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Admins consultent les fichiers d'inscription" on storage.objects;
create policy "Admins consultent les fichiers d'inscription"
  on storage.objects for select
  using (bucket_id = 'inscriptions-photos' and exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 28 : demandes recruteurs visibles dans le tableau de bord (avec
-- le détail des mannequins sélectionnés) + suppression d'une photo de
-- candidature/inscription directement depuis le tableau de bord (fichier de
-- stockage ET ligne en base supprimés ensemble).
-- ===================================================================
drop policy if exists "Les admins consultent les mannequins d'une demande" on recruiter_request_models;
create policy "Les admins consultent les mannequins d'une demande"
  on recruiter_request_models for select
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins modifient le statut d'une demande recruteur" on recruiter_requests;
create policy "Les admins modifient le statut d'une demande recruteur"
  on recruiter_requests for update
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins suppriment une photo de candidature" on casting_photos;
create policy "Les admins suppriment une photo de candidature"
  on casting_photos for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins suppriment une photo d'inscription" on inscriptions_photos;
create policy "Les admins suppriment une photo d'inscription"
  on inscriptions_photos for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Admins suppriment les fichiers de candidature" on storage.objects;
create policy "Admins suppriment les fichiers de candidature"
  on storage.objects for delete
  using (bucket_id = 'casting-applications' and exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Admins suppriment les fichiers d'inscription" on storage.objects;
create policy "Admins suppriment les fichiers d'inscription"
  on storage.objects for delete
  using (bucket_id = 'inscriptions-photos' and exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 29 : référence de transaction Wave sur une inscription mannequin.
-- Permet de vérifier facilement un paiement (recherche de la référence dans
-- l'application Wave) au lieu de deviner par nom/montant/heure. Ce n'est pas
-- un encaissement automatique (Wave ne confirme rien de son côté) — juste
-- une preuve fournie par la personne, à vérifier manuellement par l'agence.
-- ===================================================================
alter table inscriptions_mannequins add column if not exists reference_paiement text;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 30 : codes d'inscription à usage unique. Jusqu'ici,
-- verifier_code_inscription() ne faisait que VÉRIFIER qu'un code existait —
-- rien ne l'invalidait jamais après usage. Un même code pouvait donc être
-- utilisé par plusieurs personnes, y compris exactement en même temps
-- ("simultanément"). On ajoute une consommation atomique du code au moment
-- de l'envoi du dossier : si deux personnes soumettent le même code au même
-- instant, la base de données garantit qu'une seule des deux réussit.
-- ===================================================================
alter table codes_inscription add column if not exists utilise boolean not null default false;
alter table codes_inscription add column if not exists utilise_le timestamptz;

create or replace function verifier_code_inscription(code_input text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from codes_inscription where code = code_input and utilise = false);
$$;

create or replace function utiliser_code_inscription(code_input text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_lignes int;
begin
  update codes_inscription set utilise = true, utilise_le = now()
  where code = code_input and utilise = false;
  get diagnostics nb_lignes = row_count;
  return nb_lignes > 0;
end;
$$;
revoke all on function utiliser_code_inscription from public;
grant execute on function utiliser_code_inscription to anon, authenticated;

-- Sécurité rétroactive : les codes déjà utilisés par une inscription passée
-- sont marqués "utilisé" dès maintenant, pour ne pas pouvoir resservir.
update codes_inscription c set utilise = true, utilise_le = now()
where utilise = false
  and exists (select 1 from inscriptions_mannequins i where i.code_utilise = c.code);

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 31 : gestion des codes d'inscription depuis le tableau de bord.
-- Jusqu'ici, un code ne pouvait être ajouté que manuellement en SQL — aucune
-- interface n'existait pour l'admin. On ajoute la lecture et la création de
-- codes, réservées aux admins.
-- ===================================================================
drop policy if exists "Les admins consultent les codes d'inscription" on codes_inscription;
create policy "Les admins consultent les codes d'inscription"
  on codes_inscription for select
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins créent des codes d'inscription" on codes_inscription;
create policy "Les admins créent des codes d'inscription"
  on codes_inscription for insert
  with check (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins suppriment un code d'inscription" on codes_inscription;
create policy "Les admins suppriment un code d'inscription"
  on codes_inscription for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 32 : une référence de paiement Wave ne peut plus servir deux
-- fois. Jusqu'ici, rien n'empêchait de recopier une ancienne référence
-- (même déjà utilisée sur un autre dossier) — le formulaire l'acceptait
-- sans broncher. Une vraie référence Wave étant unique par transaction, on
-- interdit désormais tout doublon au niveau de la base de données : la
-- deuxième tentative avec la même référence est rejetée automatiquement.
-- Attention : ceci ne prouve toujours pas qu'une référence est authentique
-- (ça, seule une vérification manuelle dans l'appli Wave le peut) — ça
-- empêche seulement la RÉUTILISATION d'une référence déjà vue par le site.
-- ===================================================================
create unique index if not exists inscriptions_reference_paiement_unique
  on inscriptions_mannequins (reference_paiement)
  where reference_paiement is not null and reference_paiement <> '';

-- Si l'envoi du dossier échoue après que le code a été consommé (référence en
-- doublon, coupure réseau...), on relibère le code pour que la personne
-- puisse corriger son erreur et renvoyer son dossier sans avoir besoin d'un
-- nouveau code auprès de l'agence.
create or replace function liberer_code_inscription(code_input text)
returns void
language sql
security definer
set search_path = public
as $$
  update codes_inscription set utilise = false, utilise_le = null where code = code_input;
$$;
revoke all on function liberer_code_inscription from public;
grant execute on function liberer_code_inscription to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 33 : AUDIT DE SÉCURITÉ #3 — correction d'une faille critique
-- introduite par l'Extension 32. liberer_code_inscription() ne vérifiait
-- absolument rien avant de réactiver un code : n'importe qui connaissant un
-- code déjà utilisé (donc n'importe quel mannequin déjà inscrit, puisqu'il
-- a lui-même tapé son code) pouvait l'appeler directement depuis la console
-- du navigateur pour réactiver CE code à volonté et recommencer une
-- inscription indéfiniment — annulant complètement la protection "usage
-- unique" de l'Extension 30.
--
-- Correction en profondeur : au lieu de "consommer le code" puis "insérer
-- le dossier" en deux étapes séparées (avec une fonction de rattrapage
-- exploitable entre les deux), tout se fait maintenant en une seule
-- transaction atomique. Si l'insertion échoue pour n'importe quelle raison
-- (référence de paiement en double, etc.), la consommation du code est
-- automatiquement annulée par la base de données elle-même — pas besoin
-- d'une fonction de "libération" séparée, donc plus aucune surface
-- exploitable.
-- ===================================================================
drop function if exists liberer_code_inscription(text);
revoke all on function utiliser_code_inscription(text) from anon, authenticated;

create or replace function soumettre_inscription_mannequin(
  p_code text,
  p_full_name text,
  p_date_naissance date,
  p_height_cm int,
  p_clothing_size text,
  p_phone text,
  p_reference_paiement text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_lignes int;
  nouvel_id uuid;
begin
  update codes_inscription set utilise = true, utilise_le = now()
  where code = p_code and utilise = false;
  get diagnostics nb_lignes = row_count;
  if nb_lignes = 0 then
    raise exception 'code_invalide_ou_deja_utilise';
  end if;

  insert into inscriptions_mannequins
    (full_name, date_naissance, height_cm, clothing_size, phone, code_utilise, reference_paiement)
  values
    (p_full_name, p_date_naissance, p_height_cm, p_clothing_size, p_phone, p_code, nullif(p_reference_paiement, ''))
  returning id into nouvel_id;

  return nouvel_id;
end;
$$;
revoke all on function soumettre_inscription_mannequin(text, text, date, int, text, text, text) from public;
grant execute on function soumettre_inscription_mannequin(text, text, date, int, text, text, text) to anon, authenticated;

-- Défense en profondeur : même un compte admin compromis ne peut plus écrire
-- un statut arbitraire (ex. contenant du code HTML) dans ces colonnes.
alter table casting_applications drop constraint if exists casting_applications_status_check;
alter table casting_applications add constraint casting_applications_status_check
  check (status in ('nouvelle', 'vue', 'retenue', 'refusée'));

alter table inscriptions_mannequins drop constraint if exists inscriptions_mannequins_statut_check;
alter table inscriptions_mannequins add constraint inscriptions_mannequins_statut_check
  check (statut in ('en attente de paiement', 'payée', 'annulée'));

alter table recruiter_requests drop constraint if exists recruiter_requests_status_check;
alter table recruiter_requests add constraint recruiter_requests_status_check
  check (status in ('nouvelle', 'vue', 'traitée'));

-- page_views.ip_hash doit toujours être soit vide, soit une vraie empreinte
-- SHA-256 (64 caractères hexadécimaux) — bloque au moins l'insertion de
-- valeurs de complaisance grossières visant à fausser le classement des
-- mannequins les plus consultés.
alter table page_views drop constraint if exists page_views_ip_hash_format;
alter table page_views add constraint page_views_ip_hash_format
  check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$');

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 34 : photo de profil choisie par le mannequin (au lieu de
-- toujours prendre la plus ancienne photo envoyée), et suppression complète
-- d'un dossier (candidature / inscription / demande recruteur) depuis le
-- tableau de bord.
-- ===================================================================
alter table model_photos add column if not exists principale boolean not null default false;

drop policy if exists "Les admins suppriment une candidature" on casting_applications;
create policy "Les admins suppriment une candidature"
  on casting_applications for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins suppriment une inscription" on inscriptions_mannequins;
create policy "Les admins suppriment une inscription"
  on inscriptions_mannequins for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins suppriment une demande recruteur" on recruiter_requests;
create policy "Les admins suppriment une demande recruteur"
  on recruiter_requests for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 35 : l'agence fait aussi du mannequinat pour enfants — les
-- candidatures/inscriptions de mineurs doivent pouvoir renseigner un
-- contact parent/tuteur pour validation. On ajoute aussi la possibilité de
-- retirer UN SEUL mannequin d'une sélection recruteur (sans supprimer toute
-- la demande), demandée pour affiner la suppression dans le tableau de bord.
-- ===================================================================
alter table casting_applications add column if not exists date_naissance date;
alter table casting_applications add column if not exists parent_nom text;
alter table casting_applications add column if not exists parent_telephone text;

alter table inscriptions_mannequins add column if not exists parent_nom text;
alter table inscriptions_mannequins add column if not exists parent_telephone text;

drop policy if exists "Les admins suppriment un mannequin d'une sélection" on recruiter_request_models;
create policy "Les admins suppriment un mannequin d'une sélection"
  on recruiter_request_models for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

-- La fonction d'inscription doit maintenant accepter les coordonnées du
-- parent/tuteur (facultatives — remplies seulement si le mannequin est
-- mineur). On supprime l'ancienne version (signature différente) avant de
-- recréer, Postgres distinguant les fonctions par leur liste de paramètres.
drop function if exists soumettre_inscription_mannequin(text, text, date, int, text, text, text);

create or replace function soumettre_inscription_mannequin(
  p_code text,
  p_full_name text,
  p_date_naissance date,
  p_height_cm int,
  p_clothing_size text,
  p_phone text,
  p_reference_paiement text,
  p_parent_nom text default null,
  p_parent_telephone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_lignes int;
  nouvel_id uuid;
begin
  update codes_inscription set utilise = true, utilise_le = now()
  where code = p_code and utilise = false;
  get diagnostics nb_lignes = row_count;
  if nb_lignes = 0 then
    raise exception 'code_invalide_ou_deja_utilise';
  end if;

  insert into inscriptions_mannequins
    (full_name, date_naissance, height_cm, clothing_size, phone, code_utilise, reference_paiement, parent_nom, parent_telephone)
  values
    (p_full_name, p_date_naissance, p_height_cm, p_clothing_size, p_phone, p_code, nullif(p_reference_paiement, ''), p_parent_nom, p_parent_telephone)
  returning id into nouvel_id;

  return nouvel_id;
end;
$$;
revoke all on function soumettre_inscription_mannequin(text, text, date, int, text, text, text, text, text) from public;
grant execute on function soumettre_inscription_mannequin(text, text, date, int, text, text, text, text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 36 : le mannequin choisit lui-même les 5 photos qui apparaîtront
-- sur sa fiche Compcard (PDF/JPEG). Sans sélection, le système retombe
-- automatiquement sur les 5 meilleures par défaut (photo de profil en
-- premier, puis les plus anciennes) — rien ne casse pour les profils
-- existants qui n'utilisent pas encore cette option.
-- ===================================================================
alter table model_photos add column if not exists compcard_ordre int;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 37 : passage à l'échelle de "The Book" pour un grand nombre de
-- mannequins. La correction précédente (une seule requête pour toutes les
-- photos de couverture, au lieu d'une par mannequin) reste limitée par le
-- plafond par défaut de Supabase (1000 lignes par requête) : avec, par
-- exemple, 100 mannequins ayant chacun 20 photos dans leur book, la requête
-- pourrait dépasser cette limite et "perdre" silencieusement la couverture
-- des derniers mannequins de la liste. Cette fonction ne renvoie qu'UNE
-- SEULE ligne par mannequin (sa photo de couverture), quel que soit le
-- nombre total de photos existantes — le volume ne grossit plus jamais avec
-- la taille du book de chaque mannequin, seulement avec le nombre de
-- mannequins affichés.
-- ===================================================================
create or replace function photos_couverture_mannequins(ids uuid[])
returns table(model_id uuid, url text)
language sql
stable
as $$
  select distinct on (model_id) model_id, url
  from model_photos
  where model_id = any(ids)
  order by model_id, principale desc, created_at asc;
$$;
grant execute on function photos_couverture_mannequins to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 38 : type de candidature (rejoindre l'agence VS un projet ou
-- événement précis lancé par l'agence). Le menu "Candidature" devient
-- "Postuler à un casting" côté site ; ce candidat doit maintenant préciser
-- pour quoi il postule. La liste des projets/événements est gérée depuis le
-- tableau de bord (table casting_projets) ; le candidat peut aussi taper un
-- nom libre si son casting n'y figure pas encore ("Autre").
-- ===================================================================
create table if not exists casting_projets (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
alter table casting_projets enable row level security;

drop policy if exists "Tout le monde voit les projets actifs" on casting_projets;
create policy "Tout le monde voit les projets actifs"
  on casting_projets for select
  using (actif = true);

drop policy if exists "Les admins voient tous les projets" on casting_projets;
create policy "Les admins voient tous les projets"
  on casting_projets for select
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins créent des projets" on casting_projets;
create policy "Les admins créent des projets"
  on casting_projets for insert
  with check (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins modifient un projet" on casting_projets;
create policy "Les admins modifient un projet"
  on casting_projets for update
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins suppriment un projet" on casting_projets;
create policy "Les admins suppriment un projet"
  on casting_projets for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

alter table casting_applications add column if not exists type_candidature text not null default 'agence';
alter table casting_applications add column if not exists projet_nom text;
alter table casting_applications drop constraint if exists casting_applications_type_check;
alter table casting_applications add constraint casting_applications_type_check
  check (type_candidature in ('agence', 'projet'));

-- Résumé pour le tableau de bord : combien de candidatures pour rejoindre
-- l'agence, et combien pour chaque projet/événement précis — la RLS de
-- casting_applications (admins uniquement) s'applique aussi ici, donc un
-- appel par un compte non-admin ne renvoie simplement aucune ligne.
create or replace function resume_candidatures_par_projet()
returns table(type_candidature text, projet_nom text, total bigint)
language sql
stable
as $$
  select type_candidature, projet_nom, count(*) as total
  from casting_applications
  group by type_candidature, projet_nom
  order by total desc;
$$;
grant execute on function resume_candidatures_par_projet to authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 39 : correctif — deux versions de soumettre_inscription_mannequin
-- (l'ancienne à 7 paramètres et la nouvelle à 9, avec parent/tuteur) se sont
-- retrouvées présentes en même temps dans la base, rendant toute référence
-- "nue" à son nom ambiguë ("function name ... is not unique"). On supprime
-- explicitement les deux signatures possibles avant de recréer proprement la
-- seule version à jour (9 paramètres).
-- ===================================================================
drop function if exists soumettre_inscription_mannequin(text, text, date, int, text, text, text);
drop function if exists soumettre_inscription_mannequin(text, text, date, int, text, text, text, text, text);

create or replace function soumettre_inscription_mannequin(
  p_code text,
  p_full_name text,
  p_date_naissance date,
  p_height_cm int,
  p_clothing_size text,
  p_phone text,
  p_reference_paiement text,
  p_parent_nom text default null,
  p_parent_telephone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_lignes int;
  nouvel_id uuid;
begin
  update codes_inscription set utilise = true, utilise_le = now()
  where code = p_code and utilise = false;
  get diagnostics nb_lignes = row_count;
  if nb_lignes = 0 then
    raise exception 'code_invalide_ou_deja_utilise';
  end if;

  insert into inscriptions_mannequins
    (full_name, date_naissance, height_cm, clothing_size, phone, code_utilise, reference_paiement, parent_nom, parent_telephone)
  values
    (p_full_name, p_date_naissance, p_height_cm, p_clothing_size, p_phone, p_code, nullif(p_reference_paiement, ''), p_parent_nom, p_parent_telephone)
  returning id into nouvel_id;

  return nouvel_id;
end;
$$;
revoke all on function soumettre_inscription_mannequin(text, text, date, int, text, text, text, text, text) from public;
grant execute on function soumettre_inscription_mannequin(text, text, date, int, text, text, text, text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 40 : le poids est l'une des mensurations les plus demandées par
-- les recruteurs (mode commerciale, catalogue, e-commerce) et manquait
-- jusqu'ici. Ajouté sur le profil mannequin (rempli par le mannequin lui-même
-- depuis son espace) et sur les candidatures "Postuler à un casting" —
-- volontairement PAS sur inscriptions_mannequins, qui ne collecte déjà que
-- taille/vêtements à l'inscription (le reste se complète ensuite dans
-- l'espace mannequin), pour ne pas toucher à soumettre_inscription_mannequin
-- une nouvelle fois.
-- ===================================================================
alter table model_profiles add column if not exists weight_kg int;
alter table casting_applications add column if not exists weight_kg int;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 41 : outil admin pour alléger les photos déjà en ligne. Les
-- photos envoyées AVANT la mise en place du redimensionnement automatique
-- sont restées à leur poids d'origine (plusieurs Mo), ce qui rend le book
-- très lent à charger sur téléphone — au point de bloquer le site le temps
-- que les images arrivent. Un outil dans le tableau de bord va remplacer
-- chaque photo trop lourde par une version allégée, AU MÊME EMPLACEMENT
-- (donc sans rien changer aux liens déjà enregistrés). Cela demande de
-- donner aux admins le droit d'écrire dans le dossier de n'importe quel
-- mannequin dans le bucket "model-photos" (jusqu'ici réservé au mannequin
-- propriétaire du dossier).
-- ===================================================================
drop policy if exists "Les admins remplacent une photo (optimisation)" on storage.objects;
create policy "Les admins remplacent une photo (optimisation)"
  on storage.objects for update
  using (bucket_id = 'model-photos' and exists (select 1 from admins where user_id = auth.uid()))
  with check (bucket_id = 'model-photos' and exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins déposent une photo (optimisation)" on storage.objects;
create policy "Les admins déposent une photo (optimisation)"
  on storage.objects for insert
  with check (bucket_id = 'model-photos' and exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 42 : annule l'Extension 41. Décision prise : les photos du book
-- des mannequins (bucket "model-photos") doivent rester intactes à 100%,
-- sans aucun outil de compression — l'outil d'optimisation du tableau de
-- bord a donc été retiré du site. Les deux policies qui lui donnaient le
-- droit d'écrire dans le dossier de n'importe quel mannequin n'ont plus de
-- raison d'exister : les retirer réduit la surface d'attaque (un compte
-- admin compromis ne pourrait plus écraser les photos des mannequins) et
-- évite tout risque qu'un futur clic accidentel ne relance une compression
-- que l'on a explicitement décidé de ne plus jamais faire sur ce bucket.
-- ===================================================================
drop policy if exists "Les admins remplacent une photo (optimisation)" on storage.objects;
drop policy if exists "Les admins déposent une photo (optimisation)" on storage.objects;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 43 : distingue la toute première inscription (où chaque bloc du
-- formulaire espace-mannequin doit être rempli avant de pouvoir publier, avec
-- un seul bouton de validation final) de toutes les connexions suivantes (où
-- chaque bloc redevient autonome, avec son propre bouton "Enregistrer").
-- Cette colonne passe à "true" une fois pour toutes dès la première
-- publication réussie, et ne repasse jamais à "false" ensuite (même si le
-- mannequin dépublie son profil plus tard) : une fois qu'on a appris à se
-- servir de l'espace mannequin, plus besoin de repasser par le mode guidé.
-- ===================================================================
alter table model_profiles add column if not exists premiere_publication_faite boolean not null default false;

-- Sans ce rattrapage, TOUS les mannequins déjà inscrits avant ce jour (y compris
-- ceux déjà publiés et actifs depuis longtemps) se retrouveraient soudainement
-- en "mode guidé" (boutons de blocs cachés) à leur prochaine connexion, puisque
-- la nouvelle colonne démarre à "false" pour tout le monde. On marque donc comme
-- déjà formés : les profils actuellement publiés, ET ceux qui ont manifestement
-- déjà été remplis sérieusement (nom + au moins une photo + au moins un projet)
-- même s'ils sont dépubliés au moment de cette migration.
update model_profiles p
set premiere_publication_faite = true
where p.published = true
   or (
     p.full_name is not null
     and exists (select 1 from model_photos where model_id = p.id)
     and exists (select 1 from model_projects where model_id = p.id)
   );

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 44 : surveillance des erreurs réelles du site. Jusqu'ici, un
-- bug en production n'était découvert que si quelqu'un le signalait par
-- hasard, ou lors d'une relecture manuelle du code — jamais en temps réel.
-- Chaque page capte désormais silencieusement toute erreur JavaScript qui
-- se produit réellement dans le navigateur d'un visiteur (pas une relecture
-- de code : une vraie erreur survenue en conditions réelles) et l'enregistre
-- ici, consultable depuis le tableau de bord. Écriture ouverte à tous (comme
-- page_views) car n'importe quel visiteur anonyme peut déclencher une
-- erreur ; lecture réservée aux admins.
-- ===================================================================
create table if not exists journal_erreurs (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  page text,
  pile text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table journal_erreurs enable row level security;

drop policy if exists "Tout le monde peut logger une erreur" on journal_erreurs;
create policy "Tout le monde peut logger une erreur"
  on journal_erreurs for insert
  with check (
    char_length(message) <= 500
    and (page is null or char_length(page) <= 200)
    and (pile is null or char_length(pile) <= 1000)
    and (user_agent is null or char_length(user_agent) <= 300)
  );

drop policy if exists "Les admins consultent le journal d'erreurs" on journal_erreurs;
create policy "Les admins consultent le journal d'erreurs"
  on journal_erreurs for select
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins suppriment une entree du journal" on journal_erreurs;
create policy "Les admins suppriment une entree du journal"
  on journal_erreurs for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

create index if not exists idx_journal_erreurs_created on journal_erreurs(created_at desc);

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 45 : miniatures des photos, pour réduire la consommation de
-- bande passante Supabase ("Cached Egress" — dépassé : 11+ Go/mois utilisés
-- sur 5 Go inclus dans le plan gratuit). Les photos du book restent 100%
-- intactes et en pleine qualité (jamais compressées, jamais modifiées) pour
-- l'usage Compcard/téléchargement : on ajoute simplement, À CÔTÉ, une
-- version réduite utilisée uniquement pour l'affichage en grille (Book
-- public, galerie de la fiche mannequin), là où la pleine résolution
-- n'apporte rien de visible mais coûte beaucoup de données à chaque visite.
-- ===================================================================
alter table model_photos add column if not exists url_miniature text;
alter table model_photos add column if not exists chemin_miniature text;

-- Un admin doit pouvoir générer les miniatures manquantes des photos déjà
-- en ligne (rattrapage ponctuel depuis le tableau de bord), pour tous les
-- mannequins — jamais utilisé pour autre chose que ces deux colonnes.
drop policy if exists "Les admins renseignent les miniatures" on model_photos;
create policy "Les admins renseignent les miniatures"
  on model_photos for update
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- Autorise l'admin à déposer une miniature dans le dossier de N'IMPORTE QUEL
-- mannequin, mais UNIQUEMENT dans un sous-dossier "miniatures" — impossible
-- avec cette policy de créer ou d'écraser un fichier à l'emplacement d'une
-- photo originale (qui n'a qu'un seul niveau de dossier : {id-mannequin}/...).
drop policy if exists "Les admins generent les miniatures manquantes" on storage.objects;
create policy "Les admins generent les miniatures manquantes"
  on storage.objects for insert
  with check (
    bucket_id = 'model-photos'
    and (storage.foldername(name))[2] = 'miniatures'
    and exists (select 1 from admins where user_id = auth.uid())
  );

-- La photo de couverture utilisée sur "The Book" (page publique qui liste
-- tous les mannequins) sert désormais la miniature quand elle existe, sinon
-- la photo d'origine (pour ne rien casser tant que le rattrapage n'est pas
-- fait sur les anciennes photos).
create or replace function photos_couverture_mannequins(ids uuid[])
returns table(model_id uuid, url text)
language sql
stable
as $$
  select distinct on (model_id) model_id, coalesce(url_miniature, url) as url
  from model_photos
  where model_id = any(ids)
  order by model_id, principale desc, created_at asc;
$$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 46 : recompression des photos ORIGINALES déjà en ligne (pas
-- seulement leur miniature). Les nouveaux envois compressent désormais
-- l'originale elle-même (voir `compresserPhotoOrigine()` dans
-- espace-mannequin.html) ; ce rattrapage applique la même chose aux photos
-- déjà publiées avant ce changement.
--
-- Contrairement à l'ancien outil retiré en Extension 42 (qui écrasait les
-- fichiers en place et avait été jugé trop risqué), le remplacement se fait
-- ici en 3 temps sûrs, gérés côté JS dans tableau-de-bord.html : 1) la
-- version compressée est envoyée à un NOUVEL emplacement, 2) la fiche
-- model_photos n'est mise à jour vers ce nouvel emplacement qu'une fois cet
-- envoi confirmé réussi, 3) l'ancien fichier n'est supprimé qu'après cette
-- mise à jour. À aucun moment une photo ne peut se retrouver manquante ou
-- corrompue si une étape échoue en cours de route.
-- ===================================================================
alter table model_photos add column if not exists originale_optimisee boolean not null default false;
-- Empêche de retélécharger et retraiter (donc de reconsommer de la bande
-- passante pour rien) une photo déjà passée par la compression — que ce
-- soit au moment de l'envoi initial ou via ce rattrapage.

-- Remplace la policy de dépôt de miniatures (Extension 45), désormais trop
-- étroite : un admin doit pouvoir déposer n'importe où dans ce bucket (pas
-- seulement dans un sous-dossier "miniatures") pour y placer une originale
-- recompressée.
drop policy if exists "Les admins generent les miniatures manquantes" on storage.objects;
drop policy if exists "Les admins deposent une photo optimisee" on storage.objects;
create policy "Les admins deposent une photo optimisee"
  on storage.objects for insert
  with check (
    bucket_id = 'model-photos'
    and exists (select 1 from admins where user_id = auth.uid())
  );

drop policy if exists "Les admins suppriment une ancienne version de photo" on storage.objects;
create policy "Les admins suppriment une ancienne version de photo"
  on storage.objects for delete
  using (
    bucket_id = 'model-photos'
    and exists (select 1 from admins where user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 47 : retrait des outils "Miniatures des photos" et
-- "Recompresser les photos originales existantes" du tableau de bord
-- (demande explicite du propriétaire du site — nettoyage après plusieurs
-- soucis d'affichage/erreurs rencontrés en les utilisant). Cette extension
-- révoque uniquement les autorisations admin qui n'étaient utiles qu'à ces
-- deux outils, aujourd'hui retirés de tableau-de-bord.html — sans toucher
-- aux colonnes model_photos.url_miniature / chemin_miniature /
-- originale_optimisee, toujours utilisées par les NOUVEAUX envois de photo
-- (espace-mannequin.html, qui génère sa propre miniature et compresse
-- l'originale à l'envoi, indépendamment de ces outils admin).
-- ===================================================================
drop policy if exists "Les admins deposent une photo optimisee" on storage.objects;
drop policy if exists "Les admins suppriment une ancienne version de photo" on storage.objects;
drop policy if exists "Les admins renseignent les miniatures" on model_photos;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 48 : ajout d'un champ "Genre" au formulaire d'inscription des
-- nouveaux mannequins (jusqu'ici demandé uniquement à l'étape "Postuler à un
-- casting"), pour appliquer la même règle de taille minimale obligatoire —
-- 1m75 pour les femmes, 1m85 pour les hommes (mineurs exemptés, comme pour
-- les candidatures) — également à l'inscription, en plus du contrôle déjà
-- fait côté JavaScript avant l'envoi.
-- ===================================================================
alter table inscriptions_mannequins add column if not exists genre text;

drop function if exists soumettre_inscription_mannequin(text, text, date, int, text, text, text, text, text);

create or replace function soumettre_inscription_mannequin(
  p_code text,
  p_full_name text,
  p_date_naissance date,
  p_genre text,
  p_height_cm int,
  p_clothing_size text,
  p_phone text,
  p_reference_paiement text,
  p_parent_nom text default null,
  p_parent_telephone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_lignes int;
  nouvel_id uuid;
begin
  update codes_inscription set utilise = true, utilise_le = now()
  where code = p_code and utilise = false;
  get diagnostics nb_lignes = row_count;
  if nb_lignes = 0 then
    raise exception 'code_invalide_ou_deja_utilise';
  end if;

  insert into inscriptions_mannequins
    (full_name, date_naissance, genre, height_cm, clothing_size, phone, code_utilise, reference_paiement, parent_nom, parent_telephone)
  values
    (p_full_name, p_date_naissance, p_genre, p_height_cm, p_clothing_size, p_phone, p_code, nullif(p_reference_paiement, ''), p_parent_nom, p_parent_telephone)
  returning id into nouvel_id;

  return nouvel_id;
end;
$$;
revoke all on function soumettre_inscription_mannequin(text, text, date, text, int, text, text, text, text, text) from public;
grant execute on function soumettre_inscription_mannequin(text, text, date, text, int, text, text, text, text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 49 : PHASE DE CONSOLIDATION / SÉCURISATION — ralentissement
-- anti-brute-force sur verifier_code_inscription().
--
-- (Les limites de taille/type de fichier par bucket existent déjà depuis
-- plus tôt dans ce fichier ["Restreint les buckets de photos aux formats
-- image réels..."] — pas besoin d'y retoucher, elles fonctionnent déjà.)
--
-- Jusqu'ici, rien n'empêchait un script d'appeler verifier_code_inscription()
-- (ouverte à "anon") des milliers de fois par minute pour deviner un code
-- par essais successifs. On journalise chaque tentative dans une table sans
-- aucune policy (donc illisible/inmodifiable depuis le site — seule la
-- fonction, en security definer, peut y écrire) et on ralentit
-- volontairement (pg_sleep) la réponse dès qu'un volume anormal de
-- tentatives est détecté sur la dernière minute. Ça ne bloque jamais un
-- usage normal (une poignée de tentatives), mais rend un balayage
-- automatisé de codes beaucoup trop lent pour être rentable.
-- ===================================================================

create table if not exists tentatives_verification_code (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now()
);
alter table tentatives_verification_code enable row level security;
-- Aucune policy créée volontairement : ni lecture ni écriture directe
-- possible depuis le site, y compris par un compte authentifié — seule la
-- fonction verifier_code_inscription() (security definer) peut y toucher.

create or replace function verifier_code_inscription(code_input text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_recentes int;
begin
  insert into tentatives_verification_code default values;
  -- Nettoyage au passage : pas besoin d'un job séparé pour purger la table.
  delete from tentatives_verification_code where cree_le < now() - interval '10 minutes';

  select count(*) into nb_recentes from tentatives_verification_code
  where cree_le > now() - interval '1 minute';

  if nb_recentes > 20 then
    perform pg_sleep(3);
  end if;

  return exists (select 1 from codes_inscription where code = code_input and utilise = false);
end;
$$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 50 : CODE PERMANENT pour le portail "Créer mon compte" de
-- l'espace mannequin (fonctions check_invite_code / consume_invite_code,
-- appelées par espace-mannequin.html — leur définition d'origine n'était
-- présente nulle part dans ce fichier suivi, seulement en direct dans
-- Supabase : elles sont recréées ici proprement, versionnées, et rendues
-- PERMANENTES sur demande explicite de l'agence).
--
-- Différence avec codes_inscription (inscription-mannequin.html), qui reste
-- INCHANGÉ : ici un seul code, le même pour tout le monde, ne devient
-- JAMAIS invalide après usage — l'agence le communique à chaque nouveau
-- mannequin pour qu'il crée son compte, et peut le changer à tout moment
-- (ex. si le code a trop circulé) sans casser l'inscription des suivants.
--
-- Sécurité appliquée :
-- - Le code n'est JAMAIS stocké ni renvoyé en clair : seul son hash
--   (bcrypt, via pgcrypto) est conservé en base. Même en lisant
--   directement la table depuis Supabase, le code réel reste illisible.
-- - Aucune policy de lecture sur la table : ni le site ni un compte
--   authentifié ne peuvent la consulter, seules les fonctions
--   security definer y touchent.
-- - Ralentissement anti-brute-force (même principe qu'Extension 49) sur
--   check_invite_code(), qui reste la seule fonction ouverte à "anon".
-- - consume_invite_code() ne "consomme" plus rien (le code est permanent)
--   mais revérifie quand même sa validité avant de laisser la création de
--   compte se terminer — conservé uniquement pour ne rien changer côté
--   JavaScript (espace-mannequin.html appelle déjà cette fonction).
-- - Seul un admin peut définir/changer le code (definir_code_portail()),
--   jamais un mannequin ni un visiteur.
-- ===================================================================
create extension if not exists pgcrypto;

create table if not exists code_portail_mannequin (
  id boolean primary key default true,
  code_hash text,
  modifie_le timestamptz not null default now(),
  modifie_par uuid,
  constraint code_portail_mannequin_singleton check (id)
);
alter table code_portail_mannequin enable row level security;
-- Aucune policy : ni lecture ni écriture directe, même authentifié — tout
-- passe obligatoirement par les fonctions ci-dessous.

create table if not exists tentatives_verification_code_portail (
  id bigint generated always as identity primary key,
  cree_le timestamptz not null default now()
);
alter table tentatives_verification_code_portail enable row level security;

-- Admin uniquement : définit ou change le code permanent.
create or replace function definir_code_portail(nouveau_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'non_autorise';
  end if;
  if nouveau_code is null or length(trim(nouveau_code)) < 6 then
    raise exception 'code_trop_court';
  end if;
  insert into code_portail_mannequin (id, code_hash, modifie_le, modifie_par)
  values (true, crypt(trim(nouveau_code), gen_salt('bf')), now(), auth.uid())
  on conflict (id) do update
    set code_hash = excluded.code_hash, modifie_le = excluded.modifie_le, modifie_par = excluded.modifie_par;
end;
$$;
revoke all on function definir_code_portail(text) from public;
grant execute on function definir_code_portail(text) to authenticated;

-- Ouvert à "anon" (appelé avant la création du compte) : vérifie le code,
-- ralenti volontairement au-delà d'un volume anormal de tentatives.
create or replace function check_invite_code(code_input text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_recentes int;
  hash_stocke text;
begin
  insert into tentatives_verification_code_portail default values;
  delete from tentatives_verification_code_portail where cree_le < now() - interval '10 minutes';
  select count(*) into nb_recentes from tentatives_verification_code_portail
  where cree_le > now() - interval '1 minute';
  if nb_recentes > 20 then
    perform pg_sleep(3);
  end if;

  select code_hash into hash_stocke from code_portail_mannequin where id = true;
  if hash_stocke is null or code_input is null then return false; end if;
  return hash_stocke = crypt(code_input, hash_stocke);
end;
$$;
revoke all on function check_invite_code(text) from public;
grant execute on function check_invite_code(text) to anon, authenticated;

-- Revérifie le code (le code étant permanent, rien n'est jamais "consommé"
-- ni invalidé) — gardé pour compatibilité avec l'appel déjà fait par
-- espace-mannequin.html juste après la création du compte.
create or replace function consume_invite_code(code_input text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hash_stocke text;
begin
  select code_hash into hash_stocke from code_portail_mannequin where id = true;
  if hash_stocke is null or code_input is null then return false; end if;
  return hash_stocke = crypt(code_input, hash_stocke);
end;
$$;
revoke all on function consume_invite_code(text) from public;
grant execute on function consume_invite_code(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 51 : verrouillage colonne par colonne de model_profiles pour
-- le rôle "anon" (visiteurs non connectés — c'est eux qui consultent The
-- Book et les fiches publiques). Jusqu'ici, la protection en place ne
-- portait que sur les LIGNES (RLS : seuls les profils "published = true"
-- sont visibles) — pas sur les COLONNES. Or PostgREST/Supabase autorisent
-- par défaut la lecture de N'IMPORTE QUELLE colonne d'une ligne visible,
-- pas seulement celles que le site affiche à l'écran : n'importe qui
-- connaissant l'URL Supabase et la clé publique (déjà visibles dans le
-- code source du site) pouvait interroger directement l'API et demander
-- par exemple le téléphone ou l'e-mail d'un mannequin publié — même si le
-- site lui-même ne les affiche jamais.
--
-- Correction : on retire l'accès en lecture "table entière" pour "anon"
-- et on ne lui rend explicitement que les colonnes réellement utilisées
-- par les pages publiques (accueil, The Book, fiche mannequin), vérifiées
-- une par une dans le code de ces trois pages. Téléphone, e-mail et tout
-- champ non listé ci-dessous restent donc désormais strictement
-- impossibles à lire pour un visiteur non connecté, quelle que soit la
-- requête envoyée.
--
-- Rappel : le rôle "authenticated" (mannequin connecté à son propre
-- espace) n'est PAS touché ici — sa restriction sur téléphone/e-mail avait
-- déjà été faite séparément (voir commentaire dans espace-mannequin.html,
-- fonction mon_contact_prive()).
-- ===================================================================
revoke select on model_profiles from anon;
grant select (
  id, full_name, city, category, height_cm, carnation, clothing_size,
  availability, published, created_at, featured, date_naissance,
  weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, shoe_size,
  eye_color, hair_color, bio, years_experience, model_types,
  languages, video_url
) on model_profiles to anon;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 52 : RÉTABLIT l'outil de rattrapage des miniatures manquantes
-- (retiré en Extension 47, à tort — sa vraie cause de panne était le bug
-- CSP "blob:" dans vercel.json, corrigé la même nuit, AVANT le retrait).
-- Cause très probable du dépassement de quota constaté (253% en 9 jours) :
-- toute photo envoyée avant l'ajout des miniatures (Extension 45) n'en a
-- toujours pas, et continue donc d'être servie en pleine résolution sur
-- Le Book à chaque visite.
--
-- Policy volontairement plus étroite que la version d'origine : limitée au
-- dépôt d'un fichier miniature (jamais un remplacement de l'originale),
-- et seulement dans le sous-dossier "miniatures/" de chaque mannequin —
-- un admin ne peut toujours pas écrire ailleurs dans le bucket.
-- ===================================================================
drop policy if exists "Les admins deposent une miniature manquante" on storage.objects;
create policy "Les admins deposent une miniature manquante"
  on storage.objects for insert
  with check (
    bucket_id = 'model-photos'
    and (storage.foldername(name))[2] = 'miniatures'
    and exists (select 1 from admins where user_id = auth.uid())
  );

drop policy if exists "Les admins renseignent les miniatures" on model_photos;
create policy "Les admins renseignent les miniatures"
  on model_photos for update
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 53 : nettoyage ponctuel de 3 photos "fantômes" repérées via
-- l'outil de rattrapage des miniatures — leur fichier réel est introuvable
-- (404 "Object not found") ou corrompu, alors que leur fiche existait
-- toujours dans model_photos (probablement un envoi resté incomplet, il y
-- a longtemps). Elles s'affichaient en image cassée sur la fiche publique
-- du mannequin concerné. Ciblage par URL exacte (aucune autre photo
-- touchée) — vérifié avant suppression : les 2 premières renvoient bien un
-- 404 côté stockage, la 3e une image invalide.
--
-- (Suppression du fichier de stockage correspondant à la 3e photo non
-- incluse ici : Supabase interdit la suppression directe de storage.objects
-- par SQL, "Use the Storage API instead". Le fichier corrompu restera seul
-- dans le stockage, sans aucune fiche pour y faire référence — quelques Ko
-- perdus, sans aucun impact réel.)
-- ===================================================================
delete from model_photos
where url in (
  'https://dfhghgmwmxiguhtxtsle.supabase.co/storage/v1/object/public/model-photos/c402a4a3-a090-421f-bdcc-b94fece2da4f/1789055934200-Capture%20One%20Catalog%201828.jpeg',
  'https://dfhghgmwmxiguhtxtsle.supabase.co/storage/v1/object/public/model-photos/c402a4a3-a090-421f-bdcc-b94fece2da4f/1789055984263-Capture%20One%20Catalog%201833.jpeg',
  'https://dfhghgmwmxiguhtxtsle.supabase.co/storage/v1/object/public/model-photos/c402a4a3-a090-421f-bdcc-b94fece2da4f/1789056565393-temp_image_C5E6109C-E03D-46E3-AD56-1B680D35918D.webp'
);

-- ===================================================================
-- Extension 54 : les 2 photos restantes de l'Extension 53 n'ont pas été
-- supprimées — leur URL en base diffère probablement légèrement de la
-- copie affichée à l'écran (encodage des espaces). Ciblage cette fois par
-- le préfixe numérique (l'horodatage du nom de fichier), unique et sans
-- ambiguïté d'encodage, plutôt que l'URL complète.
-- ===================================================================
delete from model_photos
where url like '%1789055934200-Capture%'
   or url like '%1789055984263-Capture%';

-- ===================================================================
-- Extension 55 : protection anti-spam/automatisation sur les formulaires
-- publics (candidature, demande recruteur, contact) — jusqu'ici ouverts à
-- un envoi en nombre illimité, sans aucune limite. Un script pouvait
-- soumettre des centaines de fausses candidatures/messages par minute.
--
-- Fonctionnement : chaque formulaire est limité à un nombre raisonnable de
-- soumissions par minute (largement au-dessus d'un usage normal, même en
-- cas d'afflux réel après une annonce de casting) ; au-delà, l'envoi est
-- refusé côté serveur (pas juste ralenti comme pour les codes — ici on
-- bloque net, un formulaire n'a pas besoin d'être retenté immédiatement).
-- N'affecte jamais un visiteur normal, seulement un envoi massif automatisé.
-- ===================================================================
create table if not exists soumissions_formulaires_publics (
  id bigint generated always as identity primary key,
  formulaire text not null,
  cree_le timestamptz not null default now()
);
alter table soumissions_formulaires_publics enable row level security;
-- Aucune policy : illisible/inmodifiable directement, seule la fonction ci-dessous y touche.

create or replace function limiter_soumissions_publiques(p_formulaire text, p_max_par_minute int default 10)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_recentes int;
begin
  delete from soumissions_formulaires_publics where cree_le < now() - interval '10 minutes';
  select count(*) into nb_recentes from soumissions_formulaires_publics
    where formulaire = p_formulaire and cree_le > now() - interval '1 minute';
  if nb_recentes >= p_max_par_minute then
    return false;
  end if;
  insert into soumissions_formulaires_publics (formulaire) values (p_formulaire);
  return true;
end;
$$;
revoke all on function limiter_soumissions_publiques(text, int) from public;
grant execute on function limiter_soumissions_publiques(text, int) to anon, authenticated;

drop policy if exists "Tout le monde peut candidater" on casting_applications;
create policy "Tout le monde peut candidater"
  on casting_applications for insert
  with check (limiter_soumissions_publiques('candidature'));

drop policy if exists "Tout le monde peut envoyer une demande de casting" on recruiter_requests;
create policy "Tout le monde peut envoyer une demande de casting"
  on recruiter_requests for insert
  with check (limiter_soumissions_publiques('recruteur'));

drop policy if exists "Tout le monde peut envoyer un message de contact" on messages_contact;
create policy "Tout le monde peut envoyer un message de contact"
  on messages_contact for insert
  with check (limiter_soumissions_publiques('contact'));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 59 : même famille de faille que l'Extension 58, sur les
-- candidatures et demandes recruteurs — moins grave (le statut ne
-- déverrouille aucun accès, contrairement au paiement) mais tout aussi
-- réel : les policies d'insertion ci-dessus ne vérifient que le
-- rate-limit, jamais la valeur envoyée pour "status". Un appel direct à
-- l'API aurait pu créer une candidature ou une demande recruteur déjà
-- marquée 'retenue' / 'traitée', ce qui aurait pu la faire ignorer par
-- l'agence lors du tri des dossiers.
--
-- candidature.html et selection.html n'envoient jamais "status" à
-- l'insertion (ils comptent sur sa valeur par défaut 'nouvelle') : ce
-- durcissement n'a donc aucun impact sur le fonctionnement réel du site.
-- ===================================================================
drop policy if exists "Tout le monde peut candidater" on casting_applications;
create policy "Tout le monde peut candidater"
  on casting_applications for insert
  with check (limiter_soumissions_publiques('candidature') and status = 'nouvelle');

drop policy if exists "Tout le monde peut envoyer une demande de casting" on recruiter_requests;
create policy "Tout le monde peut envoyer une demande de casting"
  on recruiter_requests for insert
  with check (limiter_soumissions_publiques('recruteur') and status = 'nouvelle');

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 56 : empêche réellement (pas seulement côté JavaScript) la
-- publication automatique d'un profil de mineur sur Le Book. Un mannequin
-- authentifié pourrait techniquement appeler l'API Supabase directement
-- (contournant le formulaire) pour forcer published=true malgré son âge —
-- ce déclencheur l'en empêche indépendamment de toute policy RLS déjà en
-- place, quelle qu'en soit la définition exacte (jamais vue dans ce
-- fichier — encore un morceau du schéma de base non versionné).
--
-- Les admins restent libres de publier un profil de mineur manuellement
-- (depuis Supabase directement, après validation — contact du parent/
-- tuteur, etc.), le temps qu'un outil dédié existe dans le tableau de bord.
-- ===================================================================
create or replace function bloquer_publication_mineur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  age_ans int;
  est_admin boolean;
begin
  if NEW.published is distinct from true then
    return NEW;
  end if;
  if NEW.date_naissance is null then
    return NEW;
  end if;
  age_ans := extract(year from age(NEW.date_naissance));
  if age_ans >= 18 then
    return NEW;
  end if;
  select exists(select 1 from admins where user_id = auth.uid()) into est_admin;
  if est_admin then
    return NEW;
  end if;
  NEW.published := false;
  return NEW;
end;
$$;

drop trigger if exists trg_bloquer_publication_mineur on model_profiles;
create trigger trg_bloquer_publication_mineur
  before insert or update on model_profiles
  for each row execute function bloquer_publication_mineur();

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 57 : limite réelle (côté serveur) du nombre de photos par
-- mannequin. Jusqu'ici, seuls le type de fichier et la taille étaient
-- vérifiés côté serveur (allowed_mime_types / file_size_limit sur le
-- bucket model-photos) — rien n'empêchait un compte de téléverser un
-- nombre illimité de photos, ce qui pèse directement sur le quota de
-- stockage/bande passante Supabase (déjà sous tension cette session,
-- cf. nettoyage des photos orphelines). Un mannequin peut avoir jusqu'à
-- 30 photos dans son book — largement suffisant pour un portfolio pro.
-- Les admins restent exemptés (rattrapage, gestion depuis le tableau de
-- bord). Un contrôle côté JavaScript existe aussi (espace-mannequin.html)
-- pour éviter un téléversement inutile, mais celui-ci est la vraie
-- barrière : il s'applique même à un appel direct de l'API.
-- ===================================================================
create or replace function limiter_nombre_photos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_photos int;
  est_admin boolean;
begin
  select exists(select 1 from admins where user_id = auth.uid()) into est_admin;
  if est_admin then
    return NEW;
  end if;
  select count(*) into nb_photos from model_photos where model_id = NEW.model_id;
  if nb_photos >= 30 then
    raise exception 'Limite de 30 photos atteinte pour ce book. Supprimez une photo avant d''en ajouter une nouvelle.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_limiter_nombre_photos on model_photos;
create trigger trg_limiter_nombre_photos
  before insert on model_photos
  for each row execute function limiter_nombre_photos();

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 58 : FAILLE RÉELLE trouvée et corrigée — le statut de paiement
-- d'une inscription pouvait être falsifié directement via l'API.
--
-- La policy RLS "Tout le monde peut s'inscrire" (Extension 1) autorisait
-- n'importe quel insert anonyme sur inscriptions_mannequins avec
-- with check (true) — sans passer par soumettre_inscription_mannequin().
-- Or la colonne "statut" accepte la valeur 'payée' (contrainte de la
-- ligne ~1130), et rien n'empêchait un appel direct à l'API REST
-- Supabase (POST /rest/v1/inscriptions_mannequins avec la clé anon,
-- publique dans js/supabase-config.js) de créer une inscription avec
-- statut='payée' d'emblée — sans code valide, sans paiement réel, sans
-- validation de l'agence.
--
-- La fonction soumettre_inscription_mannequin() est SECURITY DEFINER :
-- elle continue de fonctionner normalement sans cette policy (elle
-- s'exécute avec les droits du propriétaire, qui contourne RLS). Cette
-- policy n'était donc utile à aucune fonctionnalité réelle du site —
-- seule une requête directe malveillante pouvait s'en servir.
-- ===================================================================
drop policy if exists "Tout le monde peut s'inscrire" on inscriptions_mannequins;

-- Durcissement secondaire : l'ajout de photos d'inscription (inscriptions_photos)
-- passe lui par un vrai insert client (pas de RPC), donc la policy doit rester
-- permissive pour ne pas casser la fonctionnalité — mais on réduit la surface :
-- on n'autorise plus l'ajout de photo que sur une inscription encore "en attente
-- de paiement" (pas sur une inscription déjà traitée/annulée, ancienne ou
-- appartenant à quelqu'un d'autre dont le dossier est déjà clos).
drop policy if exists "Tout le monde peut joindre des photos d'inscription" on inscriptions_photos;
create policy "Tout le monde peut joindre des photos d'inscription"
  on inscriptions_photos for insert
  with check (
    exists (
      select 1 from inscriptions_mannequins m
      where m.id = inscription_id and m.statut = 'en attente de paiement'
    )
  );

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 60 : même famille de faille que l'Extension 58, cette fois sur
-- les photos de candidature (casting_photos). La policy d'insertion était
-- with check (true) sans aucune condition — n'importe qui pouvait, via un
-- appel direct à l'API, joindre un nombre illimité de photos à N'IMPORTE
-- QUELLE candidature existante (même une ancienne déjà traitée), ce qui
-- pèse sur le stockage et pourrait polluer le dossier d'un vrai candidat.
--
-- candidature.html n'envoie les photos qu'immédiatement après avoir créé
-- la candidature (statut encore 'nouvelle' à ce moment) : ce durcissement
-- n'a donc aucun impact sur le fonctionnement réel. Plafond de 12 photos
-- par candidature (le formulaire en demande 4 minimum).
-- ===================================================================
drop policy if exists "Tout le monde peut joindre des photos de candidature" on casting_photos;
create policy "Tout le monde peut joindre des photos de candidature"
  on casting_photos for insert
  with check (
    exists (
      select 1 from casting_applications a
      where a.id = application_id and a.status = 'nouvelle'
    )
    and (select count(*) from casting_photos p where p.application_id = application_id) < 12
  );

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 61 : verrou IDOR indépendant sur model_profiles (une fois pour
-- toutes, sans dépendre d'une policy RLS qu'on ne voit pas).
--
-- La policy RLS qui autorise un mannequin à modifier SA PROPRE fiche
-- (model_profiles) n'a jamais été créée via ce fichier — elle existe déjà
-- en base, d'avant le début du suivi SQL versionné ici, et son contenu
-- exact n'est donc pas vérifiable depuis ce dépôt. Le code du site
-- (espace-mannequin.html) envoie toujours id: user.id (jamais une valeur
-- venant d'un formulaire ou d'une URL), donc AUCUNE fonctionnalité du
-- site ne peut aujourd'hui provoquer le problème — mais si cette policy
-- RLS invisible est plus permissive que prévu, un appel direct à l'API
-- pourrait modifier la fiche de N'IMPORTE QUEL AUTRE mannequin.
--
-- Ce déclencheur agit indépendamment de cette policy (comme pour les
-- mineurs, Extension 56) : il vérifie lui-même, à chaque insert/update,
-- que la fiche modifiée appartient bien à la personne connectée — sauf
-- pour les admins, qui doivent pouvoir mettre en avant un profil
-- (featured, déjà protégé séparément) ou intervenir en gestion.
--
-- ⚠️ Fiche à tester après exécution : modifier son propre profil doit
-- toujours fonctionner normalement (rien ne devrait changer, mais cette
-- fiche est centrale — un test réel après coup est indispensable).
-- ===================================================================
create or replace function proteger_proprietaire_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  est_admin boolean;
begin
  select exists(select 1 from admins where user_id = auth.uid()) into est_admin;
  if est_admin then
    return NEW;
  end if;
  if auth.uid() is null or NEW.id is distinct from auth.uid() then
    raise exception 'Modification refusée : ce profil ne vous appartient pas.';
  end if;
  if TG_OP = 'UPDATE' and OLD.id is distinct from NEW.id then
    raise exception 'Modification refusée : identifiant du profil non modifiable.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_proteger_proprietaire_profil on model_profiles;
create trigger trg_proteger_proprietaire_profil
  before insert or update on model_profiles
  for each row execute function proteger_proprietaire_profil();

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 62 : même trou que l'Extension 61, mais sur model_photos —
-- et plus large cette fois (lecture, modification ET suppression).
--
-- En auditant le code, aucune policy RLS pour model_photos n'apparaît
-- dans ce fichier pour : l'insertion d'une photo, la modification d'une
-- photo (photo principale, ordre compcard), la suppression d'une photo,
-- ni la lecture de ses propres photos dans l'Espace mannequin. Ces
-- actions fonctionnent pourtant toutes sur le site — les policies qui
-- les autorisent existent donc déjà en base, mais d'avant le suivi SQL
-- ici, comme pour model_profiles (Extension 61).
--
-- Risque concret trouvé : espace-mannequin.html supprime/modifie une
-- photo uniquement par son id (sb.from('model_photos').update/delete()
-- .eq('id', ...)) SANS jamais vérifier côté client que cette photo lui
-- appartient. Seule la policy RLS invisible protège ça aujourd'hui.
-- (Risque réel limité en pratique : cet id n'est jamais exposé nulle
-- part publiquement — vérifié dans index.html, mannequin.html — donc
-- pas devinable, mais le trou reste réel si cette policy est trop
-- permissive.)
--
-- Deux corrections indépendantes de cette policy invisible :
-- 1. Un déclencheur qui vérifie lui-même la propriété sur insert/update/
--    delete (comme l'Extension 61), admins exemptés.
-- 2. Une policy RESTRICTIVE en lecture (elle s'ajoute en ET, pas en OU,
--    à toute policy permissive existante — donc elle RESTREINT
--    vraiment l'accès quelle que soit la policy déjà en place) :
--    une photo n'est visible que par son propriétaire, par un admin, ou
--    publiquement si le profil du mannequin est publié.
-- ===================================================================
create or replace function proteger_proprietaire_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  est_admin boolean;
begin
  select exists(select 1 from admins where user_id = auth.uid()) into est_admin;
  if est_admin then
    return coalesce(NEW, OLD);
  end if;

  if TG_OP = 'DELETE' then
    if auth.uid() is null or OLD.model_id is distinct from auth.uid() then
      raise exception 'Action refusée : cette photo ne vous appartient pas.';
    end if;
    return OLD;
  end if;

  if auth.uid() is null or NEW.model_id is distinct from auth.uid() then
    raise exception 'Action refusée : cette photo ne vous appartient pas.';
  end if;
  if TG_OP = 'UPDATE' and OLD.model_id is distinct from auth.uid() then
    raise exception 'Action refusée : cette photo ne vous appartient pas.';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_proteger_proprietaire_photo on model_photos;
create trigger trg_proteger_proprietaire_photo
  before insert or update or delete on model_photos
  for each row execute function proteger_proprietaire_photo();

drop policy if exists "Restriction lecture photos (IDOR)" on model_photos;
create policy "Restriction lecture photos (IDOR)"
  on model_photos as restrictive for select
  using (
    model_id = auth.uid()
    or exists (select 1 from admins where user_id = auth.uid())
    or exists (select 1 from model_profiles p where p.id = model_photos.model_id and p.published = true)
  );

-- ===================================================================
-- Extension 63 : "Mot du fondateur" sur la page d'accueil — photo et
-- message modifiables par l'admin depuis le tableau de bord, sans
-- toucher au code. Même schéma en ligne unique que bandeau_annonce.
--
-- La photo est stockée dans le bucket "partenaires-logos" (déjà
-- accessible en écriture aux admins, cf. plus haut dans ce fichier) —
-- pas besoin d'un nouveau bucket ni d'une nouvelle policy de stockage.
-- ===================================================================
create table if not exists mot_responsable (
  id text primary key default 'principal',
  nom text,
  titre text,
  message text,
  photo_url text,
  updated_at timestamptz default now()
);

alter table mot_responsable enable row level security;

drop policy if exists "Mot du fondateur visible de tous" on mot_responsable;
create policy "Mot du fondateur visible de tous"
  on mot_responsable for select using (true);

drop policy if exists "Seuls les admins modifient le mot du fondateur" on mot_responsable;
create policy "Seuls les admins modifient le mot du fondateur"
  on mot_responsable for update
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

insert into mot_responsable (id, nom, titre, message, photo_url) values (
  'principal',
  'Maître Akesse',
  'Fondateur',
  'Chaque grand parcours commence par un rêve. Le nôtre a commencé ici, à Abidjan, porté par une conviction simple : le mannequinat ivoirien mérite un accompagnement sérieux, exigeant et humain. J''ai fondé Maître Akesse Model Management pour donner à chaque talent les moyens de construire une vraie carrière, pas à pas, avec rigueur et bienveillance. Cette agence, je la vois comme une famille où chaque profil est préparé, protégé et poussé vers le meilleur de lui-même. Merci de faire partie de cette aventure, ou de vous apprêter à la rejoindre.',
  null
) on conflict (id) do nothing;

NOTIFY pgrst, 'reload schema';

-- Extension 64 : file d'attente de validation admin — avant, seuls les
-- profils de mineurs étaient bloqués (Extension 56), et même pour eux il
-- n'existait aucun outil dans le tableau de bord pour les retrouver (le
-- commentaire de l'Extension 56 le disait déjà : "le temps qu'un outil
-- dédié existe"). Cette extension généralise le principe : TOUTE fiche
-- (mineur ou non) doit être validée manuellement par l'agence avant sa
-- toute première publication, pour éviter qu'une photo de mauvaise
-- qualité dégrade l'image du Book dès le départ. Une fois cette première
-- validation faite, le mannequin redevient autonome pour ses mises à jour
-- suivantes — même principe que premiere_publication_faite déjà en place
-- pour le mode guidé.
--
-- Remplace le déclencheur de l'Extension 56 (logique des mineurs
-- réintégrée ici, avec le même comportement : eux restent bloqués à
-- CHAQUE tentative de publication, pas seulement la première, en plus
-- d'apparaître maintenant dans la file d'attente comme tout le monde).
-- ===================================================================
alter table model_profiles add column if not exists en_attente_validation boolean not null default false;
alter table model_profiles add column if not exists raison_refus text;

drop trigger if exists trg_bloquer_publication_mineur on model_profiles;

create or replace function gerer_validation_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  est_admin boolean;
  age_ans int;
  est_mineur boolean := false;
begin
  select exists(select 1 from admins where user_id = auth.uid()) into est_admin;

  if NEW.date_naissance is not null then
    age_ans := extract(year from age(NEW.date_naissance));
    est_mineur := age_ans < 18;
  end if;

  if NEW.published is true then
    if est_admin then
      -- Publication par un admin = validation manuelle : la fiche entre
      -- en ligne, la file d'attente est levée, et la première publication
      -- est marquée comme faite (mode guidé → boutons autonomes ensuite).
      NEW.en_attente_validation := false;
      NEW.premiere_publication_faite := true;
    elsif est_mineur or not coalesce(OLD.premiere_publication_faite, false) then
      -- Un mannequin (mineur, ou en première publication) ne peut jamais
      -- se publier lui-même : basculé en attente de validation.
      NEW.published := false;
      NEW.en_attente_validation := true;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_gerer_validation_publication on model_profiles;
create trigger trg_gerer_validation_publication
  before insert or update on model_profiles
  for each row execute function gerer_validation_publication();

-- Lecture de la file d'attente réservée aux admins (le mannequin voit
-- déjà son propre en_attente_validation/raison_refus via sa policy de
-- lecture existante sur sa propre fiche, sans besoin d'ajout ici).
drop policy if exists "Les admins gerent la file de validation" on model_profiles;
create policy "Les admins gerent la file de validation"
  on model_profiles for select
  using (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 65 : flux Instagram automatique sur le site (accueil).
--
-- Deux tables séparées, volontairement, pour ne jamais risquer d'exposer
-- le jeton d'accès Instagram publiquement :
-- - instagram_config : réservée aux admins (lecture ET écriture), stocke
--   le jeton d'accès de longue durée et sa date d'expiration.
-- - instagram_posts_cache : lecture publique (comme les autres tables
--   d'affichage du site), écriture réservée aux admins. Contient
--   uniquement les publications déjà récupérées (image, légende, lien),
--   jamais le jeton lui-même — c'est cette table que les pages publiques
--   du site interrogent.
--
-- Le rafraîchissement (appel réel à l'API Instagram Graph) se fait
-- depuis le tableau de bord admin (bouton dédié), jamais automatiquement
-- en arrière-plan — ce site n'a pas de tâche planifiée serveur, et ça
-- évite aussi de multiplier les appels à l'API pour rien.
-- ===================================================================
create table if not exists instagram_config (
  id text primary key default 'principal',
  access_token text,
  ig_user_id text, -- identifiant du compte professionnel Instagram (Meta Graph API Explorer)
  token_expire_le timestamptz,
  updated_at timestamptz default now()
);

alter table instagram_config enable row level security;

drop policy if exists "Seuls les admins lisent la config Instagram" on instagram_config;
create policy "Seuls les admins lisent la config Instagram"
  on instagram_config for select
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins modifient la config Instagram" on instagram_config;
create policy "Seuls les admins modifient la config Instagram"
  on instagram_config for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create table if not exists instagram_posts_cache (
  id text primary key default 'principal',
  posts jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

alter table instagram_posts_cache enable row level security;

drop policy if exists "Le flux Instagram en cache est visible de tous" on instagram_posts_cache;
create policy "Le flux Instagram en cache est visible de tous"
  on instagram_posts_cache for select using (true);

drop policy if exists "Seuls les admins mettent a jour le cache Instagram" on instagram_posts_cache;
create policy "Seuls les admins mettent a jour le cache Instagram"
  on instagram_posts_cache for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

insert into instagram_config (id) values ('principal') on conflict (id) do nothing;
insert into instagram_posts_cache (id) values ('principal') on conflict (id) do nothing;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 66 : corrige "function gen_salt(unknown) does not exist" sur
-- definir_code_portail() (Extension 50) — sur Supabase, l'extension
-- pgcrypto s'installe dans le schéma "extensions", pas "public". Les
-- fonctions fixaient `set search_path = public` (sans "extensions"), donc
-- gen_salt()/crypt() restaient introuvables même après `create extension
-- pgcrypto` réussi. On ajoute "extensions" au search_path des 3 fonctions
-- concernées — comportement inchangé sinon, simple correction de chemin.
-- ===================================================================
create or replace function definir_code_portail(nouveau_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'non_autorise';
  end if;
  if nouveau_code is null or length(trim(nouveau_code)) < 6 then
    raise exception 'code_trop_court';
  end if;
  insert into code_portail_mannequin (id, code_hash, modifie_le, modifie_par)
  values (true, crypt(trim(nouveau_code), gen_salt('bf')), now(), auth.uid())
  on conflict (id) do update
    set code_hash = excluded.code_hash, modifie_le = excluded.modifie_le, modifie_par = excluded.modifie_par;
end;
$$;

create or replace function check_invite_code(code_input text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  nb_recentes int;
  hash_stocke text;
begin
  insert into tentatives_verification_code_portail default values;
  delete from tentatives_verification_code_portail where cree_le < now() - interval '10 minutes';
  select count(*) into nb_recentes from tentatives_verification_code_portail
  where cree_le > now() - interval '1 minute';
  if nb_recentes > 20 then
    perform pg_sleep(3);
  end if;

  select code_hash into hash_stocke from code_portail_mannequin where id = true;
  if hash_stocke is null or code_input is null then return false; end if;
  return hash_stocke = crypt(code_input, hash_stocke);
end;
$$;

create or replace function consume_invite_code(code_input text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  hash_stocke text;
begin
  select code_hash into hash_stocke from code_portail_mannequin where id = true;
  if hash_stocke is null or code_input is null then return false; end if;
  return hash_stocke = crypt(code_input, hash_stocke);
end;
$$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 67 : brève description par projet/casting (table
-- casting_projets), affichée au candidat sur "Postuler à un casting"
-- une fois son projet sélectionné dans le formulaire.
-- ===================================================================
alter table casting_projets add column if not exists description text;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 68 : statuts manquants du cahier des charges (candidatures
-- casting + inscriptions mannequins), pour permettre les notifications
-- de statut (WhatsApp/e-mail) prévues aux étapes 7-8 et 10 du cahier.
--
-- IMPORTANT : les valeurs de statut EXISTANTES ne sont PAS renommées.
-- On se contente d'AJOUTER les valeurs manquantes aux contraintes CHECK.
-- Une valeur comme 'en attente de paiement' reste inchangée en base
-- (seul son libellé affiché dans le dashboard change, côté site) car
-- elle est vérifiée telle quelle par la policy RLS de sécurité de
-- l'Extension 58 (protection contre la falsification du statut de
-- paiement) — la renommer casserait cette protection sans qu'on s'en
-- rende compte.
--
-- casting_applications.status : ajoute 'en étude' et 'en attente'
-- (le cahier en demande 6 au total : nouvelle / vue / en étude /
-- en attente / retenue / refusée — les 4 premières existaient déjà).
--
-- inscriptions_mannequins.statut : ajoute 'dossier en vérification'
-- (étape intermédiaire entre la vérification du paiement et la
-- validation finale). Les libellés affichés dans le dashboard sont
-- désormais : "Paiement à vérifier" / "Dossier en vérification" /
-- "Inscription validée" / "Refusée" — alignés sur le cahier, sans
-- toucher aux valeurs stockées.
-- ===================================================================
alter table casting_applications drop constraint if exists casting_applications_status_check;
alter table casting_applications add constraint casting_applications_status_check
  check (status in ('nouvelle', 'vue', 'en étude', 'en attente', 'retenue', 'refusée'));

alter table inscriptions_mannequins drop constraint if exists inscriptions_mannequins_statut_check;
alter table inscriptions_mannequins add constraint inscriptions_mannequins_statut_check
  check (statut in ('en attente de paiement', 'dossier en vérification', 'payée', 'annulée'));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 69 : FAILLE/BUG RÉEL trouvé et corrigé — aucune photo de
-- candidature n'a jamais pu s'enregistrer dans Supabase depuis la migration
-- vers Google Drive (confirmée en production via la console du navigateur :
-- chaque insert dans casting_photos échouait avec l'erreur Postgres 42P17
-- "infinite recursion detected in policy for relation casting_photos").
--
-- Cause : la policy d'insertion posée à l'Extension 60 vérifie un plafond de
-- 12 photos avec "(select count(*) from casting_photos p where ...)" —
-- une sous-requête qui interroge la table casting_photos DEPUIS SA PROPRE
-- règle de sécurité. PostgreSQL refuse ce genre d'auto-référence directe
-- dans une policy RLS (peu importe la policy SELECT qui s'applique par
-- ailleurs) et renvoie une erreur de récursion plutôt que d'évaluer la
-- requête. Résultat concret : les photos arrivaient bien dans Google Drive
-- (l'appel au script Apps Script réussit avant l'étape Supabase), mais la
-- ligne permettant au tableau de bord de les retrouver n'était jamais
-- enregistrée — d'où des photos invisibles malgré un envoi réussi.
--
-- Correctif : la vérification du plafond passe maintenant par une fonction
-- SECURITY DEFINER, qui compte les photos en contournant RLS pour cette
-- seule lecture interne (schéma standard et sûr pour éviter ce piège) —
-- le plafond de 12 photos par candidature reste appliqué à l'identique,
-- rien d'autre ne change dans les règles de sécurité.
-- ===================================================================
create or replace function compter_photos_candidature(p_application_id uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer from casting_photos where application_id = p_application_id;
$$;

drop policy if exists "Tout le monde peut joindre des photos de candidature" on casting_photos;
create policy "Tout le monde peut joindre des photos de candidature"
  on casting_photos for insert
  with check (
    exists (
      select 1 from casting_applications a
      where a.id = application_id and a.status = 'nouvelle'
    )
    and compter_photos_candidature(application_id) < 12
  );

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 70 : nettoyage automatique des photos de candidature/inscription
-- une fois le dossier traité, pour ne pas surcharger le tableau de bord.
--
-- IMPORTANT : ceci ne supprime QUE la ligne en base qui permet d'afficher
-- la photo dans le tableau de bord (casting_photos / inscriptions_photos).
-- Les fichiers eux-mêmes restent dans Google Drive comme archive — ce
-- nettoyage n'y touche pas (Postgres ne peut pas appeler l'API Drive).
--
-- Un dossier est considéré "traité" quand son statut est définitif
-- (candidature : retenue/refusée — inscription : payée/annulée). Un
-- dossier encore "nouvelle", "vue", "en étude", "en attente", "en
-- attente de paiement" ou "dossier en vérification" n'est jamais
-- concerné : ses photos restent visibles indéfiniment tant qu'aucune
-- décision n'a été prise.
--
-- Délai : 5 jours après le dernier changement de statut (le plus généreux
-- des deux délais demandés — 72h ou 5 jours — pour laisser une marge de
-- sécurité). Une colonne statut_change_at (mise à jour uniquement par un
-- trigger, jamais modifiable depuis le site) enregistre CE moment précis,
-- distinct de la date de création du dossier.
-- ===================================================================
alter table casting_applications add column if not exists statut_change_at timestamptz not null default now();
alter table inscriptions_mannequins add column if not exists statut_change_at timestamptz not null default now();

create or replace function maj_statut_change_at_candidature()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and NEW.status is distinct from OLD.status then
    NEW.statut_change_at := now();
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_statut_change_at_candidature on casting_applications;
create trigger trg_statut_change_at_candidature
  before update on casting_applications
  for each row execute function maj_statut_change_at_candidature();

create or replace function maj_statut_change_at_inscription()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and NEW.statut is distinct from OLD.statut then
    NEW.statut_change_at := now();
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_statut_change_at_inscription on inscriptions_mannequins;
create trigger trg_statut_change_at_inscription
  before update on inscriptions_mannequins
  for each row execute function maj_statut_change_at_inscription();

-- Fonction de nettoyage — appelable manuellement (bouton du tableau de bord,
-- utile pour tester) ET planifiée automatiquement ci-dessous. Renvoie le
-- nombre de photos supprimées, pour un affichage honnête du résultat.
create or replace function nettoyer_photos_traitees_anciennes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer := 0;
  n integer;
begin
  delete from casting_photos
  where application_id in (
    select id from casting_applications
    where status in ('retenue', 'refusée')
      and statut_change_at < now() - interval '5 days'
  );
  get diagnostics n = row_count;
  total := total + n;

  delete from inscriptions_photos
  where inscription_id in (
    select id from inscriptions_mannequins
    where statut in ('payée', 'annulée')
      and statut_change_at < now() - interval '5 days'
  );
  get diagnostics n = row_count;
  total := total + n;

  return total;
end;
$$;

-- Planification automatique quotidienne (nécessite l'extension pg_cron,
-- disponible sur Supabase). Si votre projet ne l'autorise pas, cette
-- dernière instruction échouera seule — tout le reste ci-dessus reste
-- valable, et le bouton manuel du tableau de bord fonctionnera quand même.
create extension if not exists pg_cron;
select cron.schedule(
  'nettoyage-photos-traitees',
  '0 3 * * *',
  $$select nettoyer_photos_traitees_anciennes();$$
);

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 71 : code de validation admin (2e facteur), en plus de
-- l'e-mail + mot de passe habituels, avec récupération par e-mail en
-- cas d'oubli. Même principe de sécurité que le code portail mannequin
-- (Extension 50/66) : seul un hash (bcrypt, pgcrypto) est stocké, jamais
-- le code en clair. La table n'a AUCUNE policy directe (RLS activé,
-- zéro policy = tout accès direct refusé) : seules les fonctions
-- security definer ci-dessous, propriétaires de la table, peuvent y
-- toucher — comme pour code_portail_mannequin plus haut.
-- ===================================================================
create extension if not exists pgcrypto;

create table if not exists admin_securite (
  admin_user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text,
  email_recuperation text,
  reset_token_hash text,
  reset_token_expire_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table admin_securite enable row level security;

-- Anti brute-force sur la vérification du code, même principe que
-- tentatives_verification_code_portail (Extension 50) : ralentit
-- (pg_sleep) sans jamais bloquer un usage normal.
create table if not exists tentatives_code_validation_admin (
  cree_le timestamptz not null default now()
);
alter table tentatives_code_validation_admin enable row level security;

create or replace function code_validation_statut()
returns table(defini boolean, email_recuperation text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_email text;
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'non_autorise';
  end if;
  select code_hash, email_recuperation into v_hash, v_email
    from admin_securite where admin_user_id = auth.uid();
  return query select (v_hash is not null), v_email;
end;
$$;

create or replace function definir_code_validation(p_code text, p_email_recuperation text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'non_autorise';
  end if;
  if p_code is null or length(trim(p_code)) < 4 then
    raise exception 'code_trop_court';
  end if;
  if p_email_recuperation is null or trim(p_email_recuperation) = '' then
    raise exception 'email_recuperation_requis';
  end if;
  insert into admin_securite (admin_user_id, code_hash, email_recuperation, updated_at)
  values (auth.uid(), crypt(trim(p_code), gen_salt('bf')), trim(p_email_recuperation), now())
  on conflict (admin_user_id) do update
    set code_hash = excluded.code_hash,
        email_recuperation = excluded.email_recuperation,
        reset_token_hash = null,
        reset_token_expire_at = null,
        updated_at = now();
end;
$$;

create or replace function verifier_code_validation(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  nb_recentes int;
  hash_stocke text;
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'non_autorise';
  end if;

  insert into tentatives_code_validation_admin default values;
  delete from tentatives_code_validation_admin where cree_le < now() - interval '10 minutes';
  select count(*) into nb_recentes from tentatives_code_validation_admin
  where cree_le > now() - interval '1 minute';
  if nb_recentes > 20 then
    perform pg_sleep(3);
  end if;

  select code_hash into hash_stocke from admin_securite where admin_user_id = auth.uid();
  if hash_stocke is null or p_code is null then return false; end if;
  return hash_stocke = crypt(p_code, hash_stocke);
end;
$$;

-- Génère un jeton de réinitialisation (30 min) et le renvoie EN CLAIR une
-- seule fois, pour que le tableau de bord construise le lien envoyé par
-- e-mail (via EmailJS, côté client) ; seul son hash (sha256) est stocké.
create or replace function demander_reinitialisation_code_validation()
returns table(token text, email_destination text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_email text;
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'non_autorise';
  end if;

  select email_recuperation into v_email from admin_securite where admin_user_id = auth.uid();
  if v_email is null or trim(v_email) = '' then
    raise exception 'aucun_email_recuperation';
  end if;

  v_token := encode(gen_random_bytes(24), 'hex');
  update admin_securite
    set reset_token_hash = encode(digest(v_token, 'sha256'), 'hex'),
        reset_token_expire_at = now() + interval '30 minutes'
    where admin_user_id = auth.uid();

  return query select v_token, v_email;
end;
$$;

create or replace function reinitialiser_code_validation(p_token text, p_nouveau_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_expire timestamptz;
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'non_autorise';
  end if;
  if p_nouveau_code is null or length(trim(p_nouveau_code)) < 4 then
    raise exception 'code_trop_court';
  end if;

  select reset_token_hash, reset_token_expire_at into v_hash, v_expire
    from admin_securite where admin_user_id = auth.uid();

  if v_hash is null or p_token is null or v_hash <> encode(digest(p_token, 'sha256'), 'hex') or v_expire is null or v_expire < now() then
    raise exception 'lien_invalide_ou_expire';
  end if;

  update admin_securite
    set code_hash = crypt(trim(p_nouveau_code), gen_salt('bf')),
        reset_token_hash = null,
        reset_token_expire_at = null,
        updated_at = now()
    where admin_user_id = auth.uid();
end;
$$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 72 : page "Nos Événements" — un album (titre/date/lieu) par
-- événement réalisé ou auquel nos mannequins ont participé, chacun avec
-- sa propre galerie de photos. Même principe que Actualités (Extension
-- 5/8/14) : table + table de photos liées, bucket public dédié, RLS
-- lecture publique / écriture admin uniquement.
-- ===================================================================
create table if not exists evenements (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  date_evenement date,
  lieu text,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);
alter table evenements enable row level security;

drop policy if exists "Evenements visibles de tous" on evenements;
create policy "Evenements visibles de tous"
  on evenements for select using (true);

drop policy if exists "Seuls les admins publient des evenements" on evenements;
create policy "Seuls les admins publient des evenements"
  on evenements for insert
  with check (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins modifient les evenements" on evenements;
create policy "Seuls les admins modifient les evenements"
  on evenements for update
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins suppriment les evenements" on evenements;
create policy "Seuls les admins suppriment les evenements"
  on evenements for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

create table if not exists evenement_photos (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid references evenements(id) on delete cascade,
  url text not null,
  chemin text,
  created_at timestamptz not null default now()
);
alter table evenement_photos enable row level security;

drop policy if exists "Photos evenements visibles de tous" on evenement_photos;
create policy "Photos evenements visibles de tous"
  on evenement_photos for select using (true);

drop policy if exists "Seuls les admins ajoutent des photos evenement" on evenement_photos;
create policy "Seuls les admins ajoutent des photos evenement"
  on evenement_photos for insert
  with check (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins modifient les photos evenement" on evenement_photos;
create policy "Seuls les admins modifient les photos evenement"
  on evenement_photos for update
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Seuls les admins suppriment les photos evenement" on evenement_photos;
create policy "Seuls les admins suppriment les photos evenement"
  on evenement_photos for delete
  using (exists (select 1 from admins where user_id = auth.uid()));

insert into storage.buckets (id, name, public)
values ('evenements-images', 'evenements-images', true)
on conflict (id) do nothing;

drop policy if exists "Admins uploadent evenements" on storage.objects;
create policy "Admins uploadent evenements"
  on storage.objects for insert
  with check (bucket_id = 'evenements-images' and exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Evenements images visibles" on storage.objects;
create policy "Evenements images visibles"
  on storage.objects for select
  using (bucket_id = 'evenements-images');

drop policy if exists "Admins suppriment fichiers evenements" on storage.objects;
create policy "Admins suppriment fichiers evenements"
  on storage.objects for delete
  using (bucket_id = 'evenements-images' and exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 73 : suppression d'une photo de mannequin déjà publié
-- (gestion admin, tableau de bord) sans effet — le bouton affiche la
-- confirmation, ne renvoie aucune erreur, mais la photo reste en place.
--
-- Cause : comme documenté à l'Extension 62, aucune policy RLS pour
-- model_photos (ni pour le bucket de stockage model-photos) n'apparaît
-- dans ce fichier — elles existent déjà en base, d'avant le suivi SQL
-- ici, et leur contenu exact n'est pas vérifiable depuis ce dépôt.
-- Le déclencheur trg_proteger_proprietaire_photo (Extension 62) exempte
-- bien les admins, mais si la policy RLS invisible sous-jacente ne les
-- exempte pas, elle bloque silencieusement le DELETE (0 ligne affectée,
-- sans erreur renvoyée) — exactement le symptôme observé.
--
-- Ajoute des policies PERMISSIVES supplémentaires, réservées aux admins,
-- sur la table et sur le bucket de stockage : elles s'additionnent (OU)
-- à toute policy déjà en place, donc sans rien retirer ni casser
-- l'existant, seulement garantir que l'admin peut toujours agir.
-- ===================================================================
drop policy if exists "Les admins gerent toutes les photos" on model_photos;
create policy "Les admins gerent toutes les photos"
  on model_photos for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Admins gerent le stockage model-photos" on storage.objects;
create policy "Admins gerent le stockage model-photos"
  on storage.objects for all
  using (bucket_id = 'model-photos' and exists (select 1 from admins where user_id = auth.uid()))
  with check (bucket_id = 'model-photos' and exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 75 : limite anti-spam PAR VISITEUR sur les formulaires
-- publics (candidature, recruteur, contact), en plus de la limite
-- globale existante (Extension 58, limiter_soumissions_publiques).
--
-- Jusqu'ici, la limite était uniquement globale : 10 envois/minute pour
-- TOUS les visiteurs confondus, par formulaire. Un seul visiteur
-- malveillant envoyant 10 requêtes en rafale bloquait donc, pendant la
-- minute suivante, tous les visiteurs légitimes du même formulaire —
-- un point relevé par un audit de sécurité externe (17-20 sept. 2026).
--
-- Cette extension ajoute une limite plus stricte (3/minute) propre à
-- chaque visiteur, identifié par son adresse IP transmise par Supabase
-- via l'en-tête HTTP "x-forwarded-for". Si cette adresse n'est pas
-- disponible pour une raison quelconque (configuration, absence de
-- l'en-tête...), la fonction ignore silencieusement cette limite
-- supplémentaire — la limite globale déjà en place continue de
-- s'appliquer normalement, donc aucun risque de bloquer un envoi
-- légitime par accident. Remplace limiter_soumissions_publiques() sans
-- changer sa signature : les policies existantes qui l'appellent
-- (candidature, recruteur, contact) n'ont pas besoin d'être modifiées.
-- ===================================================================

create table if not exists soumissions_formulaires_publics_ip (
  id bigint generated always as identity primary key,
  formulaire text not null,
  ip text not null,
  cree_le timestamptz not null default now()
);
alter table soumissions_formulaires_publics_ip enable row level security;
-- Aucune policy : illisible/inmodifiable directement, seule la fonction ci-dessous y touche.

create or replace function limiter_soumissions_publiques(p_formulaire text, p_max_par_minute int default 10)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_recentes int;
  ip_visiteur text;
  nb_recentes_ip int;
begin
  delete from soumissions_formulaires_publics where cree_le < now() - interval '10 minutes';
  select count(*) into nb_recentes from soumissions_formulaires_publics
    where formulaire = p_formulaire and cree_le > now() - interval '1 minute';
  if nb_recentes >= p_max_par_minute then
    return false;
  end if;

  begin
    ip_visiteur := nullif(trim(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)), '');
  exception when others then
    ip_visiteur := null;
  end;

  if ip_visiteur is not null then
    delete from soumissions_formulaires_publics_ip where cree_le < now() - interval '10 minutes';
    select count(*) into nb_recentes_ip from soumissions_formulaires_publics_ip
      where formulaire = p_formulaire and ip = ip_visiteur and cree_le > now() - interval '1 minute';
    if nb_recentes_ip >= 3 then
      return false;
    end if;
    insert into soumissions_formulaires_publics_ip (formulaire, ip) values (p_formulaire, ip_visiteur);
  end if;

  insert into soumissions_formulaires_publics (formulaire) values (p_formulaire);
  return true;
end;
$$;
revoke all on function limiter_soumissions_publiques(text, int) from public;
grant execute on function limiter_soumissions_publiques(text, int) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 76 : même limite anti-spam (globale + par IP, Extension 75)
-- appliquée à page_views et journal_erreurs (SEC-06 / SEC-07 de l'audit
-- de sécurité externe) — ces deux tables acceptaient jusqu'ici des
-- écritures anonymes totalement illimitées, contrairement aux
-- formulaires publics.
--
-- Seuils plus généreux que pour les formulaires, car une navigation
-- normale génère naturellement plusieurs page_views par minute (et,
-- plus rarement, plusieurs erreurs JS de suite sur une page cassée) :
-- - page_views : 300/minute au total, 30/minute par visiteur.
-- - journal_erreurs : 60/minute au total, 10/minute par visiteur.
-- Un visiteur normal ne s'approche jamais de ces seuils ; seul un
-- balayage automatisé les atteint.
--
-- Nouvelle fonction séparée (limiter_soumissions_publiques_ip), plutôt
-- que de modifier limiter_soumissions_publiques() : cette dernière est
-- déjà utilisée par 5 policies existantes (candidature, recruteur,
-- contact) qui fonctionnent bien avec ses seuils actuels (10/min
-- global, 3/min par IP) — la remplacer aurait exigé de la supprimer
-- puis recréer ces 5 policies, un risque inutile pour ce qui doit
-- rester une simple addition. La nouvelle fonction réutilise les mêmes
-- tables (soumissions_formulaires_publics / _ip) que l'Extension 75,
-- juste avec des seuils propres à p_max_par_minute / p_max_par_ip.
-- ===================================================================

create or replace function limiter_soumissions_publiques_ip(p_formulaire text, p_max_par_minute int, p_max_par_ip int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_recentes int;
  ip_visiteur text;
  nb_recentes_ip int;
begin
  delete from soumissions_formulaires_publics where cree_le < now() - interval '10 minutes';
  select count(*) into nb_recentes from soumissions_formulaires_publics
    where formulaire = p_formulaire and cree_le > now() - interval '1 minute';
  if nb_recentes >= p_max_par_minute then
    return false;
  end if;

  begin
    ip_visiteur := nullif(trim(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1)), '');
  exception when others then
    ip_visiteur := null;
  end;

  if ip_visiteur is not null then
    delete from soumissions_formulaires_publics_ip where cree_le < now() - interval '10 minutes';
    select count(*) into nb_recentes_ip from soumissions_formulaires_publics_ip
      where formulaire = p_formulaire and ip = ip_visiteur and cree_le > now() - interval '1 minute';
    if nb_recentes_ip >= p_max_par_ip then
      return false;
    end if;
    insert into soumissions_formulaires_publics_ip (formulaire, ip) values (p_formulaire, ip_visiteur);
  end if;

  insert into soumissions_formulaires_publics (formulaire) values (p_formulaire);
  return true;
end;
$$;
revoke all on function limiter_soumissions_publiques_ip(text, int, int) from public;
grant execute on function limiter_soumissions_publiques_ip(text, int, int) to anon, authenticated;

drop policy if exists "Tout le monde peut logger une visite" on page_views;
create policy "Tout le monde peut logger une visite"
  on page_views for insert with check (limiter_soumissions_publiques_ip('page_views', 300, 30));

drop policy if exists "Tout le monde peut logger une erreur" on journal_erreurs;
create policy "Tout le monde peut logger une erreur"
  on journal_erreurs for insert
  with check (
    char_length(message) <= 500
    and (page is null or char_length(page) <= 200)
    and (pile is null or char_length(pile) <= 1000)
    and (user_agent is null or char_length(user_agent) <= 300)
    and limiter_soumissions_publiques_ip('journal_erreurs', 60, 10)
  );

NOTIFY pgrst, 'reload schema';

-- Extension 77 : relecture de toutes les fonctions SECURITY DEFINER
-- (SEC-08 de l'audit de sécurité externe).
--
-- 1) Deux fonctions orphelines, ouvertes à "anon" et SANS AUCUNE
--    protection (ni vérification d'auteur, ni limite de fréquence) :
--    utiliser_code_inscription() et liberer_code_inscription().
--    Vérifié par recherche exhaustive : aucune page du site actuel ne
--    les appelle — le flux d'inscription actuel (soumettre_inscription_
--    mannequin, Extension 33/36/59) gère la consommation du code de
--    façon atomique en interne, sans jamais passer par ces deux
--    fonctions. Laissées ouvertes, n'importe qui aurait pu :
--    - utiliser_code_inscription(code) : invalider en masse les codes
--      d'inscription de l'agence sans jamais inscrire personne (essais
--      successifs sur des codes devinés/brute-forcés) ;
--    - liberer_code_inscription(code) : réactiver un code déjà utilisé
--      par un vrai mannequin, contournant tout le principe d'usage
--      unique des codes.
--    On retire simplement leur accès public (fonctions conservées,
--    juste rendues inappelables depuis le site) — réversible, et sans
--    aucun effet puisque rien ne les appelle aujourd'hui.
--
-- 2) Les 5 fonctions du code de validation admin (2FA : code_validation_
--    statut, definir_code_validation, verifier_code_validation,
--    demander_reinitialisation_code_validation, reinitialiser_code_
--    validation) n'avaient jamais de revoke/grant explicite dans ce
--    fichier suivi. Vérifié : chacune vérifie elle-même "auth.uid() est
--    bien admin" en tout premier, donc pas de faille active — mais on
--    ajoute quand même un verrou explicite au niveau des privilèges,
--    en plus de cette vérification interne, par prudence (défense en
--    profondeur demandée par l'audit).
-- ===================================================================

-- Chaque instruction ci-dessous ne s'exécute que si la fonction visée
-- existe réellement dans la base (to_regprocedure renvoie null sinon) —
-- évite toute erreur "function does not exist" si une fonction du
-- fichier suivi n'a en réalité jamais été créée en base, ou a déjà été
-- retirée par ailleurs. Sans effet sur les fonctions qui existent bel
-- et bien : le comportement est strictement identique à des revoke/
-- grant directs dans ce cas.
do $$
begin
  if to_regprocedure('public.utiliser_code_inscription(text)') is not null then
    revoke all on function utiliser_code_inscription(text) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.liberer_code_inscription(text)') is not null then
    revoke all on function liberer_code_inscription(text) from public, anon, authenticated;
  end if;

  if to_regprocedure('public.code_validation_statut()') is not null then
    revoke all on function code_validation_statut() from public;
    grant execute on function code_validation_statut() to authenticated;
  end if;

  if to_regprocedure('public.definir_code_validation(text, text)') is not null then
    revoke all on function definir_code_validation(text, text) from public;
    grant execute on function definir_code_validation(text, text) to authenticated;
  end if;

  if to_regprocedure('public.verifier_code_validation(text)') is not null then
    revoke all on function verifier_code_validation(text) from public;
    grant execute on function verifier_code_validation(text) to authenticated;
  end if;

  if to_regprocedure('public.demander_reinitialisation_code_validation()') is not null then
    revoke all on function demander_reinitialisation_code_validation() from public;
    grant execute on function demander_reinitialisation_code_validation() to authenticated;
  end if;

  if to_regprocedure('public.reinitialiser_code_validation(text, text)') is not null then
    revoke all on function reinitialiser_code_validation(text, text) from public;
    grant execute on function reinitialiser_code_validation(text, text) to authenticated;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 78 : journal des photos de candidature/inscription qui
-- n'ont pas pu être envoyées vers Google Drive, même après une
-- nouvelle tentative automatique côté client (voir js/app.js,
-- envoyerPhotosVersDrive / journaliserPhotosEchouees).
--
-- Jusqu'ici, quand l'envoi des photos échouait (coupure réseau, script
-- Apps Script temporairement indisponible...), le dossier candidature/
-- inscription était bien enregistré, mais rien ne signalait à l'agence
-- qu'il manquait des photos — il fallait ouvrir chaque dossier un par
-- un pour s'en apercevoir. Ce journal rend le problème visible,
-- consultable par les admins uniquement.
--
-- Écriture ouverte à "anon" (comme journal_erreurs/page_views), car
-- c'est le visiteur anonyme qui soumet le formulaire — protégée par la
-- même limite anti-spam par IP que les autres tables de diagnostic
-- (Extension 76).
-- ===================================================================

create table if not exists photos_upload_echouees (
  id bigint generated always as identity primary key,
  source text not null check (source in ('candidature', 'inscription')),
  dossier_id uuid not null,
  nb_photos_echouees int not null default 0,
  cree_le timestamptz not null default now(),
  traite boolean not null default false
);
alter table photos_upload_echouees enable row level security;

drop policy if exists "Tout le monde peut signaler des photos echouees" on photos_upload_echouees;
create policy "Tout le monde peut signaler des photos echouees"
  on photos_upload_echouees for insert
  with check (
    nb_photos_echouees > 0 and nb_photos_echouees <= 20
    and limiter_soumissions_publiques_ip('photos_upload_echouees', 30, 5)
  );

drop policy if exists "Les admins consultent le journal des photos echouees" on photos_upload_echouees;
create policy "Les admins consultent le journal des photos echouees"
  on photos_upload_echouees for select
  using (exists (select 1 from admins where user_id = auth.uid()));

drop policy if exists "Les admins marquent une entree comme traitee" on photos_upload_echouees;
create policy "Les admins marquent une entree comme traitee"
  on photos_upload_echouees for update
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create index if not exists idx_photos_upload_echouees_traite on photos_upload_echouees(traite, cree_le desc);

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 79 : VRAIE cause trouvée pour "aucune photo de candidature
-- ne s'enregistre" — confirmée par un message d'erreur exact capturé en
-- production (journal_erreurs, code Postgres 42501 : violation RLS
-- simple, PAS la récursion 42P17 déjà réglée à l'Extension 69).
--
-- La policy d'insertion de casting_photos (Extension 69) vérifie que la
-- candidature existe et a le statut 'nouvelle' via :
--   exists (select 1 from casting_applications a where a.id = ... )
-- Cette sous-requête interroge casting_applications SANS passer par une
-- fonction security definer — elle reste donc soumise aux droits RLS du
-- rôle qui écrit, c'est-à-dire "anon" (le visiteur qui vient de
-- soumettre sa candidature). Or la SEULE policy de lecture sur
-- casting_applications (Extension 9) réserve la consultation aux
-- admins. Résultat : pour un visiteur anonyme, cette sous-requête ne
-- voit JAMAIS sa propre candidature (RLS la filtre silencieusement à
-- zéro ligne, même si elle existe bel et bien) — la condition échoue
-- systématiquement, quel que soit l'état réel des données.
--
-- Correctif : la vérification d'existence passe elle aussi par une
-- fonction SECURITY DEFINER (même principe que compter_photos_
-- candidature à l'Extension 69), qui contourne RLS pour cette seule
-- lecture interne — rien d'autre ne change : le visiteur ne gagne
-- toujours aucun accès de lecture sur casting_applications, seule
-- cette vérification ponctuelle et précise (booléenne) le permet.
-- ===================================================================

create or replace function candidature_prete_pour_photo(p_application_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from casting_applications
    where id = p_application_id and status = 'nouvelle'
  );
$$;

drop policy if exists "Tout le monde peut joindre des photos de candidature" on casting_photos;
create policy "Tout le monde peut joindre des photos de candidature"
  on casting_photos for insert
  with check (
    candidature_prete_pour_photo(application_id)
    and compter_photos_candidature(application_id) < 12
  );

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 80 : version "moyenne" des photos (en plus de la miniature
-- 500px de l'Extension 45), pour les 2 seules grandes images plein écran
-- de la page d'accueil (bannière de la porte d'entrée, mannequin à la
-- une) — là où la miniature 500px serait trop floue une fois étirée sur
-- un grand écran, mais où la photo d'origine (souvent plusieurs Mo,
-- format appareil photo) est inutilement lourde et fait grimper le LCP
-- mesuré (jusqu'à ~15s sur mobile avant ce correctif). ~1600px de côté
-- max, qualité 82% : visuellement quasi indiscernable de l'originale en
-- plein écran, mais 3 à 5 fois plus légère. Comme pour la miniature, la
-- photo d'origine n'est jamais touchée (Compcard/téléchargement intacts).
-- ===================================================================
alter table model_photos add column if not exists url_moyenne text;
alter table model_photos add column if not exists chemin_moyenne text;

-- La policy d'update "Les admins renseignent les miniatures" (Extension 45)
-- s'applique déjà à toute la ligne (pas de restriction par colonne) : ces 2
-- nouvelles colonnes sont donc déjà couvertes, aucune policy à modifier.

-- Un mannequin peut déjà déposer n'importe quel sous-dossier dans son propre
-- espace ("Envoi dans son propre dossier", Extension initiale) — le
-- sous-dossier "moyennes" (comme "miniatures") en profite donc sans policy
-- supplémentaire. Il ne reste qu'à autoriser l'admin à en déposer dans le
-- dossier de N'IMPORTE quel mannequin (rattrapage depuis le tableau de bord,
-- ou ajout de photo pour le compte d'un mannequin) :
drop policy if exists "Les admins generent les versions moyennes manquantes" on storage.objects;
create policy "Les admins generent les versions moyennes manquantes"
  on storage.objects for insert
  with check (
    bucket_id = 'model-photos'
    and (storage.foldername(name))[2] = 'moyennes'
    and exists (select 1 from admins where user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 81 : refonte "CV premium" de l'espace mannequin — nouveaux champs
-- Formation et Compétences, demandés pour reproduire la maquette CV validée
-- (colonne dark identité/contact + colonne claire profil/formation/
-- expérience/compétences + bandeau agence et 5 photos en bas, identiques
-- à celles déjà choisies pour le compcard existant, compcard_ordre).
--
-- "competences" est un JSON plutôt que 8-9 colonnes séparées : ce sont des
-- notes 1 à 5 que le mannequin s'attribue lui-même (Runway, Pose photo,
-- Editorial, Fashion campaign, Fitting, Présentation de collection,
-- Expression corporelle, Travail en équipe, Discipline professionnelle) —
-- la liste peut évoluer sans nouvelle migration à chaque fois.
--
-- Pas de nouveau champ "Amateur/Professionnel" : ce niveau est déduit à
-- l'affichage à partir de years_experience (déjà existant, Extension 11) —
-- ne pas demander une seconde fois au mannequin une info déjà donnée.
-- ===================================================================
alter table model_profiles add column if not exists niveau_etude text;
alter table model_profiles add column if not exists etablissement text;
alter table model_profiles add column if not exists formation_particuliere text;
alter table model_profiles add column if not exists formation_mannequin text;
alter table model_profiles add column if not exists competences jsonb;
alter table model_profiles add column if not exists citation text;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 82 : préparation de l'intégration Premium 20 — champs
-- identité manquants + 2 rôles de photo supplémentaires.
--
-- lieu_naissance / nationalite : demandés par la maquette CV, absents de
-- model_profiles jusqu'ici. "nationalite" reste en saisie libre (pas de
-- valeur par défaut stockée en base) : le pré-remplissage "Ivoirienne"
-- pour un nouveau profil est géré côté formulaire, pas ici, pour ne pas
-- attribuer silencieusement une nationalité aux profils déjà existants
-- qui ne l'ont jamais confirmée.
--
-- photo_cv / photo_pleinpied : Premium 20 distingue 3 photos principales
-- indépendantes (CV, Profil, Plein pied) alors que le système actuel n'en
-- avait qu'une seule ("principale", déjà utilisée par tout le site pour
-- la photo de profil / THE BOOK — on n'y touche pas, zéro régression).
-- On ajoute donc seulement les 2 rôles manquants, avec la même règle
-- qu'existante pour "principale" : une seule photo par mannequin peut
-- avoir chaque flag à true (appliqué côté application, comme pour
-- "principale" aujourd'hui).
-- ===================================================================
alter table model_profiles add column if not exists lieu_naissance text;
alter table model_profiles add column if not exists nationalite text;

alter table model_photos add column if not exists photo_cv boolean not null default false;
alter table model_photos add column if not exists photo_pleinpied boolean not null default false;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 83 : quartier (Abidjan) + photo de couverture.
--
-- quartier : précision facultative sous la commune, uniquement pertinente
-- quand la ville est Abidjan (aucune liste fixe de quartiers n'existe —
-- texte libre, comme "ville-autre"/"commune-autre").
--
-- photo_couverture : 4e rôle de photo indépendant (en plus de principale/
-- photo_cv/photo_pleinpied), pour le futur profil public façon page de
-- profil (bandeau de couverture + photo de profil). Même règle qu'existante
-- pour les 3 autres rôles : une seule photo par mannequin peut avoir ce
-- flag à true, appliqué côté application.
-- ===================================================================
alter table model_profiles add column if not exists quartier text;
alter table casting_applications add column if not exists quartier text;
alter table model_photos add column if not exists photo_couverture boolean not null default false;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 84 : catégorie (New Face / Amateur / Professionnel) choisie
-- directement par la mannequin dans le bloc Expérience de
-- espace-mannequin.html, au lieu d'être seulement calculée à l'affichage
-- à partir de years_experience (deriverNiveauMannequin() reste utilisée
-- comme suggestion par défaut la première fois, et reste la seule règle
-- pour la fiche publique mannequin.html, où ce champ n'existe pas).
-- Valeur libre côté base (pas de contrainte check) pour rester tolérant
-- si le vocabulaire évolue plus tard ; les 3 valeurs utilisées aujourd'hui
-- par le formulaire sont exactement 'New Face', 'Amateur', 'Professionnel'.
-- ===================================================================
alter table model_profiles add column if not exists niveau_mannequin text;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 85 : cadrage de la photo de couverture (haut / centre / bas).
--
-- Une photo de couverture peut être plus grande que le bandeau qui l'affiche
-- (ex. une photo plein pied dans un bandeau large et bas) : ce champ permet
-- à la mannequin d'ajuster quelle partie de la photo reste visible (le
-- visage, typiquement), sans recadrer le fichier lui-même. Appliqué en
-- object-position à l'affichage (espace-mannequin.html en aperçu, et sur la
-- fiche publique mannequin.html/en/mannequin.html). 'center' par défaut,
-- comme le comportement actuel (object-position par défaut du navigateur).
-- ===================================================================
alter table model_photos add column if not exists couverture_position text not null default 'center';

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 86 : ville de naissance (texte libre), en plus du pays déjà
-- choisi (lieu_naissance, Extension 82) — sur la plaquette de référence,
-- "Lieu de naissance" affiche ville ET pays ("Abidjan, Côte d'Ivoire").
-- Champ facultatif, jamais requis, distinct de "Ville de résidence" (city).
-- ===================================================================
alter table model_profiles add column if not exists ville_naissance text;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 87 : autoriser la suppression d'un profil mannequin même s'il
-- a déjà été proposé à un recruteur — recruiter_request_models.model_id
-- référençait model_profiles(id) SANS "on delete cascade" ni "set null",
-- ce qui bloquait (violation de contrainte) toute suppression d'un
-- mannequin dès qu'il avait été proposé au moins une fois. La table garde
-- déjà une "photo" du nom/de la taille au moment de la proposition
-- (model_name_snapshot / model_height_snapshot), donc l'historique du
-- recruteur reste lisible même une fois le profil disparu — la ligne peut
-- donc sans risque perdre sa référence (set null) plutôt que bloquer.
-- ===================================================================
alter table recruiter_request_models drop constraint if exists recruiter_request_models_model_id_fkey;
alter table recruiter_request_models
  add constraint recruiter_request_models_model_id_fkey
  foreign key (model_id) references model_profiles(id) on delete set null;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 88 : le déclencheur proteger_proprietaire_photo() (Extension
-- 62) bloquait AUSSI toute suppression de photo sans jeton de connexion
-- (auth.uid() alors NULL) — pas seulement les mannequins non concernés.
-- Or c'est exactement le contexte : suppression directe dans l'éditeur
-- Supabase (Table Editor/SQL Editor), et suppression en cascade depuis
-- l'API Admin Auth (utilisée par api/supprimer-mannequin.js pour effacer
-- un compte) : aucune des deux ne passe par une requête authentifiée
-- classique, donc auth.uid() y est NULL — le déclencheur les bloquait
-- TOUJOURS avec "cette photo ne vous appartient pas", même pour vous.
--
-- Correctif : l'exigence de propriété ne s'applique plus que lorsqu'il y
-- a réellement un utilisateur connecté qui fait la demande (auth.uid()
-- non NULL) — exactement le cas qu'elle est censée couvrir (empêcher un
-- mannequin de toucher aux photos d'un autre via le site). Un accès sans
-- jeton (vous, ou une action serveur) reste un accès privilégié par
-- nature et n'a plus besoin d'être bloqué ici.
-- ===================================================================
create or replace function proteger_proprietaire_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  est_admin boolean;
begin
  select exists(select 1 from admins where user_id = auth.uid()) into est_admin;
  if est_admin then
    return coalesce(NEW, OLD);
  end if;

  if TG_OP = 'DELETE' then
    if auth.uid() is not null and OLD.model_id is distinct from auth.uid() then
      raise exception 'Action refusée : cette photo ne vous appartient pas.';
    end if;
    return OLD;
  end if;

  if auth.uid() is not null and NEW.model_id is distinct from auth.uid() then
    raise exception 'Action refusée : cette photo ne vous appartient pas.';
  end if;
  if TG_OP = 'UPDATE' and auth.uid() is not null and OLD.model_id is distinct from auth.uid() then
    raise exception 'Action refusée : cette photo ne vous appartient pas.';
  end if;
  return NEW;
end;
$$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 89 : colonne "niveau_mannequin" oubliée dans le verrouillage
-- colonne par colonne de l'Extension 51 — cause réelle des "profils
-- invisibles" (mannequin.html / en/mannequin.html sélectionnent cette
-- colonne pour toute fiche individuelle ; PostgREST refuse la requête
-- ENTIÈRE avec 401 dès qu'une seule colonne demandée n'a pas de droit de
-- lecture pour "anon" — pas seulement la colonne en question). Le Book et
-- l'accueil ne demandent pas cette colonne, d'où leur affichage normal
-- pendant que les fiches individuelles échouaient.
-- ===================================================================
grant select (niveau_mannequin) on model_profiles to anon;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 90 : migration des photos du domaine partagé Cloudflare R2
-- ("pub-....r2.dev", explicitement documenté par Cloudflare comme non
-- destiné à la production) vers le domaine personnalisé dédié
-- "photos.maitreakessemodelmanagement.com", connecté au même compartiment
-- R2 après passage du DNS du domaine principal chez Cloudflare. Cause
-- réelle du bug "photos du Book invisibles sur Android et iPhone" :
-- ce domaine partagé r2.dev échoue de façon intermittente
-- (ERR_CONNECTION_ABORTED) spécifiquement sur les navigateurs mobiles.
-- ===================================================================
update model_photos
set
  url = replace(url, 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev', 'https://photos.maitreakessemodelmanagement.com'),
  url_miniature = replace(url_miniature, 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev', 'https://photos.maitreakessemodelmanagement.com'),
  url_moyenne = replace(url_moyenne, 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev', 'https://photos.maitreakessemodelmanagement.com')
where
  url like 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev%'
  or url_miniature like 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev%'
  or url_moyenne like 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev%';

-- ===================================================================
-- Extension 91 : retour en arrière TEMPORAIRE de l'Extension 90 —
-- le nouveau domaine personnalisé "photos.maitreakessemodelmanagement.com"
-- répond en NXDOMAIN pour la propriétaire et des tiers non liés à elle
-- (vraisemblablement délai de propagation DNS régional en Côte d'Ivoire /
-- Afrique de l'Ouest, la résolution mondiale étant déjà confirmée OK),
-- alors que toutes les photos y pointent déjà exclusivement : plus aucune
-- photo du Book n'est visible nulle part, pire que le bug d'origine
-- (mobile uniquement). Restaure temporairement l'ancien domaine partagé
-- r2.dev, en attendant que la propagation régionale se termine, pour ne
-- pas laisser le site sans aucune photo pendant ce délai. À annuler (en
-- ré-exécutant l'Extension 90) dès que
-- https://photos.maitreakessemodelmanagement.com/ répond correctement
-- depuis la Côte d'Ivoire.
-- ===================================================================
update model_photos
set
  url = replace(url, 'https://photos.maitreakessemodelmanagement.com', 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev'),
  url_miniature = replace(url_miniature, 'https://photos.maitreakessemodelmanagement.com', 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev'),
  url_moyenne = replace(url_moyenne, 'https://photos.maitreakessemodelmanagement.com', 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev')
where
  url like 'https://photos.maitreakessemodelmanagement.com%'
  or url_miniature like 'https://photos.maitreakessemodelmanagement.com%'
  or url_moyenne like 'https://photos.maitreakessemodelmanagement.com%';

-- ===================================================================
-- Extension 92 : nouvelle architecture définitive pour les photos du
-- Book — au lieu d'un domaine séparé (Extension 90, abandonné après
-- incident NXDOMAIN) ou du domaine partagé r2.dev exposé directement au
-- visiteur (Extension 91, temporaire, capricieux sur mobile), les photos
-- passent désormais par le domaine du site lui-même : Vercel relaie la
-- requête vers r2.dev côté serveur (voir "rewrites" dans vercel.json),
-- donc le navigateur du visiteur ne contacte jamais r2.dev. Réécrit les
-- 276 lignes de model_photos vers ce nouveau chemin.
-- ===================================================================
update model_photos
set
  url = replace(url, 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev', 'https://www.maitreakessemodelmanagement.com/book-photos'),
  url_miniature = replace(url_miniature, 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev', 'https://www.maitreakessemodelmanagement.com/book-photos'),
  url_moyenne = replace(url_moyenne, 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev', 'https://www.maitreakessemodelmanagement.com/book-photos')
where
  url like 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev%'
  or url_miniature like 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev%'
  or url_moyenne like 'https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev%';

-- ===================================================================
-- Extension 93 : cœurs (likes) sur les photos du Book, visibles par tout
-- visiteur (comme sur un réseau social), + petit indicateur "nouveaux
-- cœurs reçus" dans l'espace mannequin (pas d'e-mail à chaque cœur, pour
-- éviter le spam si une photo devient populaire — demande explicite de
-- la propriétaire, 28 septembre 2026). Réutilise le même principe
-- d'empreinte IP anonymisée que page_views (Extension 21) pour empêcher
-- un même visiteur de liker 50 fois la même photo, sans jamais stocker
-- son adresse IP en clair.
-- ===================================================================
create table if not exists photo_likes (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references model_photos(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  constraint photo_likes_ip_hash_format check (ip_hash ~ '^[0-9a-f]{64}$'),
  unique (photo_id, ip_hash)
);
create index if not exists idx_photo_likes_photo on photo_likes(photo_id);
alter table photo_likes enable row level security;
-- Pas de policy directe : toute lecture/écriture passe par les fonctions
-- SECURITY DEFINER ci-dessous (même approche que le reste du site).

-- Nombre de cœurs par photo + si CE visiteur (identifié par son empreinte)
-- a déjà aimé chacune, en un seul aller-retour (même principe de lot que
-- photos_couverture_mannequins).
create or replace function etat_likes_photos(p_ids uuid[], p_ip_hash text)
returns table(photo_id uuid, total bigint, aime_par_moi boolean)
language sql
security definer
set search_path = public
as $$
  select
    mp.id,
    (select count(*) from photo_likes pl where pl.photo_id = mp.id),
    exists(select 1 from photo_likes pl where pl.photo_id = mp.id and pl.ip_hash = p_ip_hash)
  from model_photos mp
  where mp.id = any(p_ids);
$$;
grant execute on function etat_likes_photos(uuid[], text) to anon;

-- Ajoute ou retire le cœur de ce visiteur sur cette photo (bascule),
-- renvoie le nouvel état pour mettre à jour l'affichage immédiatement.
create or replace function basculer_like_photo(p_photo_id uuid, p_ip_hash text)
returns table(aime boolean, total bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existe boolean;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'empreinte invalide';
  end if;
  select exists(select 1 from photo_likes where photo_id = p_photo_id and ip_hash = p_ip_hash) into v_existe;
  if v_existe then
    delete from photo_likes where photo_id = p_photo_id and ip_hash = p_ip_hash;
  else
    insert into photo_likes (photo_id, ip_hash) values (p_photo_id, p_ip_hash);
  end if;
  return query select not v_existe, (select count(*) from photo_likes where photo_id = p_photo_id);
end;
$$;
grant execute on function basculer_like_photo(uuid, text) to anon;

-- Petit indicateur côté espace mannequin : total de cœurs reçus sur son
-- Book, et combien sont "nouveaux" depuis sa dernière visite de cet
-- indicateur (pas depuis sa dernière connexion générale).
alter table model_profiles add column if not exists derniere_consultation_likes timestamptz;

create or replace function mes_likes_book()
returns table(total bigint, nouveaux bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model_id uuid := auth.uid();
  v_depuis timestamptz;
begin
  select derniere_consultation_likes into v_depuis from model_profiles where id = v_model_id;
  return query
    select
      count(*),
      count(*) filter (where v_depuis is null or pl.created_at > v_depuis)
    from photo_likes pl
    join model_photos mp on mp.id = pl.photo_id
    where mp.model_id = v_model_id;
end;
$$;
grant execute on function mes_likes_book() to authenticated;

create or replace function marquer_likes_vus()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update model_profiles set derniere_consultation_likes = now() where id = auth.uid();
end;
$$;
grant execute on function marquer_likes_vus() to authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 94 : classement de la page "Nos Mannequins" par popularité
-- (total de cœurs reçus sur le Book), demande explicite de la
-- propriétaire pour "booster" les mannequins les plus appréciés — plus
-- de cœurs, plus de visibilité en tête de liste.
-- ===================================================================
create or replace function likes_totaux_mannequins(p_ids uuid[])
returns table(model_id uuid, total bigint)
language sql
security definer
set search_path = public
as $$
  select mp.model_id, count(*)
  from photo_likes pl
  join model_photos mp on mp.id = pl.photo_id
  where mp.model_id = any(p_ids)
  group by mp.model_id;
$$;
grant execute on function likes_totaux_mannequins(uuid[]) to anon;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 95 : durcissement des cœurs (Extension 93) suite au
-- diagnostic de sécurité du 28 septembre 2026 — deux points mineurs,
-- aucun risque de fuite de données, mais à fermer par principe :
-- 1. Un cœur ne peut plus être posé sur la photo d'un profil non publié.
-- 2. Un même visiteur ne peut plus déclencher la fonction plus de 30
--    fois par minute (réutilise la même limite anti-spam par IP déjà en
--    place sur les formulaires publics, Extension 75).
-- ===================================================================
create or replace function etat_likes_photos(p_ids uuid[], p_ip_hash text)
returns table(photo_id uuid, total bigint, aime_par_moi boolean)
language sql
security definer
set search_path = public
as $$
  select
    mp.id,
    (select count(*) from photo_likes pl where pl.photo_id = mp.id),
    exists(select 1 from photo_likes pl where pl.photo_id = mp.id and pl.ip_hash = p_ip_hash)
  from model_photos mp
  join model_profiles pr on pr.id = mp.model_id
  where mp.id = any(p_ids) and pr.published = true;
$$;

create or replace function basculer_like_photo(p_photo_id uuid, p_ip_hash text)
returns table(aime boolean, total bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existe boolean;
  v_publie boolean;
begin
  if p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'empreinte invalide';
  end if;
  if not limiter_soumissions_publiques('like_photo', 30) then
    raise exception 'Trop de tentatives, réessayez dans un instant.';
  end if;

  select pr.published into v_publie
  from model_photos mp join model_profiles pr on pr.id = mp.model_id
  where mp.id = p_photo_id;
  if v_publie is not true then
    raise exception 'Photo introuvable.';
  end if;

  select exists(select 1 from photo_likes where photo_id = p_photo_id and ip_hash = p_ip_hash) into v_existe;
  if v_existe then
    delete from photo_likes where photo_id = p_photo_id and ip_hash = p_ip_hash;
  else
    insert into photo_likes (photo_id, ip_hash) values (p_photo_id, p_ip_hash);
  end if;
  return query select not v_existe, (select count(*) from photo_likes where photo_id = p_photo_id);
end;
$$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 96 : relève la limite de photos par mannequin de 30 à 60
-- (Extension 57). La raison d'origine (quota de stockage/bande passante
-- Supabase) ne s'applique plus depuis que les photos du Book vivent chez
-- Cloudflare R2, largement plus généreux — demande explicite de la
-- propriétaire, 28 septembre 2026.
-- ===================================================================
create or replace function limiter_nombre_photos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_photos int;
  est_admin boolean;
begin
  select exists(select 1 from admins where user_id = auth.uid()) into est_admin;
  if est_admin then
    return NEW;
  end if;
  select count(*) into nb_photos from model_photos where model_id = NEW.model_id;
  if nb_photos >= 60 then
    raise exception 'Limite de 60 photos atteinte pour ce book. Supprimez une photo avant d''en ajouter une nouvelle.';
  end if;
  return NEW;
end;
$$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 97 : corrige code_validation_statut() — colonne ambiguë
-- "email_recuperation" (RETURNS TABLE déclare une colonne de sortie du
-- même nom que la colonne lue dans admin_securite ; PL/pgSQL ne peut
-- alors plus savoir laquelle des deux est visée dans le SELECT, et
-- échoue systématiquement avec "column reference "email_recuperation"
-- is ambiguous"). Résultat concret côté propriétaire : reconnexion au
-- tableau de bord impossible à CHAQUE tentative (même juste après
-- réinitialisation du mot de passe), pris à tort pour un problème de
-- mot de passe puis de réseau — diagnostiqué le 28 septembre 2026 en
-- affichant temporairement le détail de l'erreur à l'écran. Simple
-- qualification de la colonne table (admin_securite.email_recuperation)
-- pour lever l'ambiguïté ; comportement inchangé sinon.
-- ===================================================================
create or replace function code_validation_statut()
returns table(defini boolean, email_recuperation text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_email text;
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'non_autorise';
  end if;
  select code_hash, admin_securite.email_recuperation into v_hash, v_email
    from admin_securite where admin_user_id = auth.uid();
  return query select (v_hash is not null), v_email;
end;
$$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 98 : BOUTIQUE MA2M (Marketplace) — socle de la base de données
-- (cahier des charges du 29 septembre 2026, étape 1).
--
-- Principes :
--   - Boutique FERMÉE par défaut (boutique_reglages.ouverte = false) : tant
--     qu'elle est fermée, seuls les admins voient catalogue, stock et réglages.
--   - Les prix, frais de livraison et totaux sont TOUJOURS calculés ici, dans
--     la base (fonction boutique_passer_commande), jamais par le navigateur.
--   - Le stock est réservé au moment de la commande (ligne verrouillée : pas
--     de double vente du dernier article) et rendu automatiquement si la
--     commande est annulée ou n'est pas payée dans le délai.
--   - Commandes, clients et journal : lisibles uniquement par les admins ;
--     un client ne voit que SA commande, via numéro + code de suivi.
--   - Photos des produits : sur Cloudflare R2 (colonnes url/chemin), jamais
--     dans Supabase Storage.
-- Sans effet sur le reste du site. Peut être relancée sans risque.
-- ===================================================================

-- --- Outils communs ---------------------------------------------------
create or replace function boutique_est_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create table if not exists boutique_reglages (
  id text primary key default 'principal' check (id = 'principal'),
  ouverte boolean not null default false,
  nom text not null default 'Boutique MA2M',
  numero_wave text,
  numero_orange_money text,
  numero_mtn_momo text,
  delai_paiement_heures int not null default 24 check (delai_paiement_heures between 1 and 168),
  livraison_offerte_des_fcfa int check (livraison_offerte_des_fcfa is null or livraison_offerte_des_fcfa >= 0),
  updated_at timestamptz not null default now()
);
insert into boutique_reglages (id) values ('principal') on conflict (id) do nothing;

create or replace function boutique_ouverte()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select ouverte from boutique_reglages where id = 'principal'), false);
$$;

-- --- Catalogue --------------------------------------------------------
create table if not exists boutique_categories (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(trim(nom)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  parent_id uuid references boutique_categories(id) on delete set null,
  ordre int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists boutique_produits (
  id uuid primary key default gen_random_uuid(),
  categorie_id uuid references boutique_categories(id) on delete set null,
  type text not null default 'physique' check (type in ('physique', 'billet', 'service')),
  nom text not null check (length(trim(nom)) between 1 and 140),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  composition text,
  entretien text,
  prix_fcfa int not null check (prix_fcfa >= 0),
  prix_promo_fcfa int check (prix_promo_fcfa is null or prix_promo_fcfa >= 0),
  promo_debut timestamptz,
  promo_fin timestamptz,
  poids_g int check (poids_g is null or poids_g >= 0),
  statut text not null default 'brouillon' check (statut in ('brouillon', 'en_vente', 'retire')),
  mis_en_avant boolean not null default false,
  ordre int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists boutique_photos (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references boutique_produits(id) on delete cascade,
  url text not null,
  url_miniature text,
  chemin text,
  ordre int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists boutique_variantes (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references boutique_produits(id) on delete cascade,
  taille text,
  couleur text,
  reference_interne text,
  prix_fcfa int check (prix_fcfa is null or prix_fcfa >= 0),
  stock int not null default 0 check (stock >= 0),
  actif boolean not null default true,
  ordre int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists boutique_variantes_produit_idx on boutique_variantes (produit_id);
create index if not exists boutique_photos_produit_idx on boutique_photos (produit_id);

-- --- Livraison --------------------------------------------------------
create table if not exists boutique_zones_livraison (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (length(trim(nom)) between 1 and 80),
  tarif_fcfa int not null check (tarif_fcfa >= 0),
  delai text,
  ordre int not null default 0,
  actif boolean not null default true
);

-- --- Commandes --------------------------------------------------------
-- Compteurs SANS TROU (numéros de commande et surtout de facture : la loi exige une
-- numérotation continue). Contrairement à une « sequence », ce compteur n'avance
-- que si l'opération réussit (il est annulé avec elle en cas d'erreur).
-- Repart à 1 chaque année : MA2M-2026-00001, F-2026-00001, puis MA2M-2027-00001…
create table if not exists boutique_compteurs (
  nom text primary key,
  annee int not null,
  valeur int not null default 0
);
alter table boutique_compteurs enable row level security;

create or replace function boutique_prochain_numero(p_nom text)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_annee int := extract(year from now() at time zone 'Africa/Abidjan')::int;
  v_valeur int;
begin
  insert into boutique_compteurs (nom, annee, valeur) values (p_nom, v_annee, 1)
    on conflict (nom) do update
      set valeur = case when boutique_compteurs.annee = excluded.annee then boutique_compteurs.valeur + 1 else 1 end,
          annee = excluded.annee
    returning valeur into v_valeur;
  return v_valeur;
end;
$$;
revoke all on function boutique_prochain_numero(text) from public;

create table if not exists boutique_commandes (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  numero_facture text unique,
  jeton_suivi uuid not null default gen_random_uuid(),
  statut text not null default 'en_attente_paiement' check (statut in (
    'en_attente_paiement', 'paiement_declare', 'payee', 'en_preparation',
    'expediee', 'livree', 'annulee', 'remboursee')),
  client_nom text not null,
  client_telephone text not null,
  client_email text,
  adresse_commune text,
  adresse_quartier text,
  adresse_repere text,
  zone_id uuid references boutique_zones_livraison(id) on delete set null,
  zone_nom text,
  sous_total_fcfa int not null check (sous_total_fcfa >= 0),
  frais_livraison_fcfa int not null default 0 check (frais_livraison_fcfa >= 0),
  total_fcfa int not null check (total_fcfa >= 0),
  moyen_paiement text check (moyen_paiement is null or moyen_paiement in ('wave', 'orange_money', 'mtn_momo')),
  reference_paiement text,
  note_client text,
  note_interne text,
  livreur_nom text,
  livreur_telephone text,
  cgv_acceptees_le timestamptz not null,
  expire_le timestamptz not null,
  paiement_declare_le timestamptz,
  payee_le timestamptz,
  expediee_le timestamptz,
  livree_le timestamptz,
  annulee_le timestamptz,
  motif_annulation text,
  stock_rendu boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists boutique_commandes_reference_unique
  on boutique_commandes (reference_paiement) where reference_paiement is not null;
create index if not exists boutique_commandes_statut_idx on boutique_commandes (statut, created_at desc);
create index if not exists boutique_commandes_tel_idx on boutique_commandes (client_telephone, created_at desc);

create table if not exists boutique_lignes (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references boutique_commandes(id) on delete cascade,
  produit_id uuid references boutique_produits(id) on delete set null,
  variante_id uuid references boutique_variantes(id) on delete set null,
  nom_produit text not null,
  libelle_variante text,
  prix_unitaire_fcfa int not null check (prix_unitaire_fcfa >= 0),
  quantite int not null check (quantite between 1 and 20),
  total_fcfa int not null check (total_fcfa >= 0)
);
create index if not exists boutique_lignes_commande_idx on boutique_lignes (commande_id);

-- Qui a fait quoi, quand (traçabilité des validations de paiement, etc.)
create table if not exists boutique_journal (
  id bigint generated always as identity primary key,
  commande_id uuid references boutique_commandes(id) on delete cascade,
  admin_user_id uuid,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists boutique_journal_commande_idx on boutique_journal (commande_id, created_at);

-- --- Règles d'accès (RLS) ----------------------------------------------
alter table boutique_reglages enable row level security;
alter table boutique_categories enable row level security;
alter table boutique_produits enable row level security;
alter table boutique_photos enable row level security;
alter table boutique_variantes enable row level security;
alter table boutique_zones_livraison enable row level security;
alter table boutique_commandes enable row level security;
alter table boutique_lignes enable row level security;
alter table boutique_journal enable row level security;

drop policy if exists "boutique reglages lecture" on boutique_reglages;
create policy "boutique reglages lecture" on boutique_reglages for select
  using (boutique_est_admin() or ouverte);
drop policy if exists "boutique reglages admin" on boutique_reglages;
create policy "boutique reglages admin" on boutique_reglages for update
  using (boutique_est_admin()) with check (boutique_est_admin());

drop policy if exists "boutique categories lecture" on boutique_categories;
create policy "boutique categories lecture" on boutique_categories for select
  using (boutique_est_admin() or (boutique_ouverte() and actif));
drop policy if exists "boutique categories admin" on boutique_categories;
create policy "boutique categories admin" on boutique_categories for all
  using (boutique_est_admin()) with check (boutique_est_admin());

drop policy if exists "boutique produits lecture" on boutique_produits;
create policy "boutique produits lecture" on boutique_produits for select
  using (boutique_est_admin() or (boutique_ouverte() and statut = 'en_vente'));
drop policy if exists "boutique produits admin" on boutique_produits;
create policy "boutique produits admin" on boutique_produits for all
  using (boutique_est_admin()) with check (boutique_est_admin());

drop policy if exists "boutique photos lecture" on boutique_photos;
create policy "boutique photos lecture" on boutique_photos for select
  using (boutique_est_admin() or (boutique_ouverte() and exists (
    select 1 from boutique_produits p where p.id = produit_id and p.statut = 'en_vente')));
drop policy if exists "boutique photos admin" on boutique_photos;
create policy "boutique photos admin" on boutique_photos for all
  using (boutique_est_admin()) with check (boutique_est_admin());

drop policy if exists "boutique variantes lecture" on boutique_variantes;
create policy "boutique variantes lecture" on boutique_variantes for select
  using (boutique_est_admin() or (boutique_ouverte() and actif and exists (
    select 1 from boutique_produits p where p.id = produit_id and p.statut = 'en_vente')));
drop policy if exists "boutique variantes admin" on boutique_variantes;
create policy "boutique variantes admin" on boutique_variantes for all
  using (boutique_est_admin()) with check (boutique_est_admin());

drop policy if exists "boutique zones lecture" on boutique_zones_livraison;
create policy "boutique zones lecture" on boutique_zones_livraison for select
  using (boutique_est_admin() or (boutique_ouverte() and actif));
drop policy if exists "boutique zones admin" on boutique_zones_livraison;
create policy "boutique zones admin" on boutique_zones_livraison for all
  using (boutique_est_admin()) with check (boutique_est_admin());

-- Commandes, lignes, journal : admins uniquement (les clients passent par les
-- fonctions ci-dessous, qui ne renvoient que LEUR commande).
drop policy if exists "boutique commandes admin" on boutique_commandes;
create policy "boutique commandes admin" on boutique_commandes for all
  using (boutique_est_admin()) with check (boutique_est_admin());
drop policy if exists "boutique lignes admin" on boutique_lignes;
create policy "boutique lignes admin" on boutique_lignes for all
  using (boutique_est_admin()) with check (boutique_est_admin());
drop policy if exists "boutique journal admin" on boutique_journal;
create policy "boutique journal admin" on boutique_journal for select
  using (boutique_est_admin());

-- --- Annulation des commandes non payées dans le délai -----------------
create or replace function boutique_annuler_expirees()
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_commande record;
  v_nb int := 0;
begin
  for v_commande in
    select id from boutique_commandes
    where statut = 'en_attente_paiement' and expire_le < now()
    for update skip locked
  loop
    update boutique_variantes v set stock = v.stock + l.quantite
      from boutique_lignes l
      where l.commande_id = v_commande.id and l.variante_id = v.id;
    update boutique_commandes
      set statut = 'annulee', annulee_le = now(), updated_at = now(), stock_rendu = true,
          motif_annulation = 'Délai de paiement dépassé'
      where id = v_commande.id;
    insert into boutique_journal (commande_id, action, detail)
      values (v_commande.id, 'annulation_automatique', 'Délai de paiement dépassé');
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;

-- --- Passer commande (client) -------------------------------------------
-- p_articles : [{"variante_id": "...", "quantite": 2}, ...]
-- p_client   : {"nom","telephone","email","commune","quartier","repere","note"}
create or replace function boutique_passer_commande(
  p_articles jsonb,
  p_client jsonb,
  p_zone_id uuid,
  p_cgv_acceptees boolean
)
returns table(numero text, jeton_suivi uuid, total_fcfa int, expire_le timestamptz)
language plpgsql security definer
set search_path = public
as $$
declare
  v_reglages boutique_reglages;
  v_nom text := trim(coalesce(p_client->>'nom', ''));
  v_tel text := regexp_replace(coalesce(p_client->>'telephone', ''), '[^0-9+]', '', 'g');
  v_email text := nullif(trim(coalesce(p_client->>'email', '')), '');
  v_article record;
  v_var record;
  v_prix int;
  v_sous_total int := 0;
  v_frais int := 0;
  v_physique boolean := false;
  v_zone boutique_zones_livraison;
  v_commande_id uuid := gen_random_uuid();
  v_numero text;
  v_jeton uuid := gen_random_uuid();
  v_expire timestamptz;
  v_nb_lignes int := 0;
begin
  select * into v_reglages from boutique_reglages where id = 'principal';
  if not coalesce(v_reglages.ouverte, false) and not boutique_est_admin() then
    raise exception 'boutique_fermee';
  end if;
  if p_cgv_acceptees is not true then
    raise exception 'cgv_non_acceptees';
  end if;
  if length(v_nom) < 2 or length(v_nom) > 120 then raise exception 'nom_invalide'; end if;
  if length(v_tel) < 8 or length(v_tel) > 20 then raise exception 'telephone_invalide'; end if;
  if v_email is not null and (length(v_email) > 160 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'email_invalide';
  end if;
  if jsonb_typeof(p_articles) is distinct from 'array' or jsonb_array_length(p_articles) = 0 then
    raise exception 'panier_vide';
  end if;
  if jsonb_array_length(p_articles) > 50 then raise exception 'panier_trop_grand'; end if;

  -- Garde-fou contre les commandes en rafale (robots) : 3 commandes non payées
  -- maximum par téléphone sur la dernière heure.
  if (select count(*) from boutique_commandes c
      where c.client_telephone = v_tel and c.statut = 'en_attente_paiement'
        and c.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'trop_de_commandes';
  end if;

  perform boutique_annuler_expirees();

  v_numero := 'MA2M-' || to_char(now() at time zone 'Africa/Abidjan', 'YYYY') || '-'
              || lpad(boutique_prochain_numero('commande')::text, 5, '0');
  v_expire := now() + make_interval(hours => v_reglages.delai_paiement_heures);

  insert into boutique_commandes (id, numero, jeton_suivi, client_nom, client_telephone, client_email,
      adresse_commune, adresse_quartier, adresse_repere, note_client,
      sous_total_fcfa, frais_livraison_fcfa, total_fcfa, cgv_acceptees_le, expire_le)
    values (v_commande_id, v_numero, v_jeton, v_nom, v_tel, v_email,
      left(nullif(trim(coalesce(p_client->>'commune', '')), ''), 80),
      left(nullif(trim(coalesce(p_client->>'quartier', '')), ''), 120),
      left(nullif(trim(coalesce(p_client->>'repere', '')), ''), 240),
      left(nullif(trim(coalesce(p_client->>'note', '')), ''), 500),
      0, 0, 0, now(), v_expire);

  -- Articles regroupés par variante (un même article envoyé deux fois = une ligne),
  -- verrouillés dans un ordre fixe pour éviter tout blocage entre deux commandes.
  for v_article in
    select (a->>'variante_id')::uuid as variante_id, sum((a->>'quantite')::int) as quantite
    from jsonb_array_elements(p_articles) a
    group by 1
    order by 1
  loop
    if v_article.quantite is null or v_article.quantite < 1 or v_article.quantite > 20 then
      raise exception 'quantite_invalide';
    end if;
    select v.id, v.stock, v.prix_fcfa as prix_variante, v.taille, v.couleur, v.actif,
           p.id as produit_id, p.nom, p.type, p.statut, p.prix_fcfa, p.prix_promo_fcfa, p.promo_debut, p.promo_fin
      into v_var
      from boutique_variantes v join boutique_produits p on p.id = v.produit_id
      where v.id = v_article.variante_id
      for update of v;
    if not found or not v_var.actif or v_var.statut <> 'en_vente' then
      raise exception 'article_indisponible';
    end if;
    if v_var.stock < v_article.quantite then
      raise exception 'stock_insuffisant';
    end if;
    v_prix := coalesce(v_var.prix_variante,
      case when v_var.prix_promo_fcfa is not null
            and (v_var.promo_debut is null or now() >= v_var.promo_debut)
            and (v_var.promo_fin is null or now() < v_var.promo_fin)
           then v_var.prix_promo_fcfa else v_var.prix_fcfa end);
    update boutique_variantes set stock = stock - v_article.quantite where id = v_var.id;
    insert into boutique_lignes (commande_id, produit_id, variante_id, nom_produit, libelle_variante,
        prix_unitaire_fcfa, quantite, total_fcfa)
      values (v_commande_id, v_var.produit_id, v_var.id, v_var.nom,
        nullif(concat_ws(' · ', v_var.taille, v_var.couleur), ''),
        v_prix, v_article.quantite, v_prix * v_article.quantite);
    v_sous_total := v_sous_total + v_prix * v_article.quantite;
    v_physique := v_physique or v_var.type = 'physique';
    v_nb_lignes := v_nb_lignes + 1;
  end loop;

  if v_physique then
    select * into v_zone from boutique_zones_livraison z where z.id = p_zone_id and z.actif;
    if not found then raise exception 'zone_livraison_invalide'; end if;
    if length(coalesce(p_client->>'commune', '') || coalesce(p_client->>'quartier', '')) < 2 then
      raise exception 'adresse_invalide';
    end if;
    v_frais := case when v_reglages.livraison_offerte_des_fcfa is not null
                     and v_sous_total >= v_reglages.livraison_offerte_des_fcfa then 0
                    else v_zone.tarif_fcfa end;
  end if;

  update boutique_commandes set
      sous_total_fcfa = v_sous_total, frais_livraison_fcfa = v_frais, total_fcfa = v_sous_total + v_frais,
      zone_id = case when v_physique then v_zone.id end, zone_nom = case when v_physique then v_zone.nom end
    where id = v_commande_id;
  insert into boutique_journal (commande_id, action, detail)
    values (v_commande_id, 'commande_creee', v_nb_lignes || ' ligne(s), total ' || (v_sous_total + v_frais) || ' FCFA');

  return query select v_numero, v_jeton, v_sous_total + v_frais, v_expire;
end;
$$;

-- --- Déclarer son paiement (client) --------------------------------------
create or replace function boutique_declarer_paiement(
  p_numero text,
  p_jeton uuid,
  p_moyen text,
  p_reference text
)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_commande boutique_commandes;
  v_reference text := upper(regexp_replace(coalesce(p_reference, ''), '\s', '', 'g'));
begin
  if p_moyen not in ('wave', 'orange_money', 'mtn_momo') then raise exception 'moyen_invalide'; end if;
  if length(v_reference) < 4 or length(v_reference) > 60 then raise exception 'reference_invalide'; end if;
  perform boutique_annuler_expirees();
  select * into v_commande from boutique_commandes c
    where c.numero = p_numero and c.jeton_suivi = p_jeton for update;
  if not found then raise exception 'commande_introuvable'; end if;
  if v_commande.statut <> 'en_attente_paiement' then raise exception 'statut_incompatible'; end if;
  begin
    update boutique_commandes set statut = 'paiement_declare', moyen_paiement = p_moyen,
        reference_paiement = v_reference, paiement_declare_le = now(), updated_at = now()
      where id = v_commande.id;
  exception when unique_violation then
    raise exception 'reference_deja_utilisee';
  end;
  insert into boutique_journal (commande_id, action, detail)
    values (v_commande.id, 'paiement_declare', p_moyen || ' ' || v_reference);
  return 'paiement_declare';
end;
$$;

-- --- Suivre sa commande (client) -----------------------------------------
-- Par le lien reçu (numéro + code de suivi) OU par numéro + téléphone.
create or replace function boutique_suivi_commande(
  p_numero text,
  p_jeton uuid default null,
  p_telephone text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_commande boutique_commandes;
  v_tel text := regexp_replace(coalesce(p_telephone, ''), '[^0-9+]', '', 'g');
begin
  perform boutique_annuler_expirees();
  select * into v_commande from boutique_commandes c
    where c.numero = p_numero
      and ((p_jeton is not null and c.jeton_suivi = p_jeton)
        or (length(v_tel) >= 8 and c.client_telephone = v_tel));
  if not found then raise exception 'commande_introuvable'; end if;
  return jsonb_build_object(
    'numero', v_commande.numero,
    'jeton_suivi', v_commande.jeton_suivi,
    'statut', v_commande.statut,
    'numero_facture', v_commande.numero_facture,
    'client_nom', v_commande.client_nom,
    'zone_nom', v_commande.zone_nom,
    'adresse_commune', v_commande.adresse_commune,
    'adresse_quartier', v_commande.adresse_quartier,
    'sous_total_fcfa', v_commande.sous_total_fcfa,
    'frais_livraison_fcfa', v_commande.frais_livraison_fcfa,
    'total_fcfa', v_commande.total_fcfa,
    'moyen_paiement', v_commande.moyen_paiement,
    'expire_le', v_commande.expire_le,
    'created_at', v_commande.created_at,
    'payee_le', v_commande.payee_le,
    'expediee_le', v_commande.expediee_le,
    'livree_le', v_commande.livree_le,
    'livreur_nom', v_commande.livreur_nom,
    'livreur_telephone', v_commande.livreur_telephone,
    'lignes', coalesce((select jsonb_agg(jsonb_build_object(
        'nom_produit', l.nom_produit, 'libelle_variante', l.libelle_variante,
        'prix_unitaire_fcfa', l.prix_unitaire_fcfa, 'quantite', l.quantite, 'total_fcfa', l.total_fcfa)
        order by l.nom_produit)
      from boutique_lignes l where l.commande_id = v_commande.id), '[]'::jsonb)
  );
end;
$$;

-- --- Changer le statut d'une commande (admin) -----------------------------
create or replace function boutique_changer_statut(
  p_commande_id uuid,
  p_statut text,
  p_detail text default null,
  p_livreur_nom text default null,
  p_livreur_telephone text default null
)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_commande boutique_commandes;
  v_permis boolean;
begin
  if not boutique_est_admin() then raise exception 'non_autorise'; end if;
  select * into v_commande from boutique_commandes where id = p_commande_id for update;
  if not found then raise exception 'commande_introuvable'; end if;

  v_permis := case v_commande.statut
    when 'en_attente_paiement' then p_statut in ('payee', 'annulee')
    when 'paiement_declare'    then p_statut in ('payee', 'en_attente_paiement', 'annulee')
    when 'payee'               then p_statut in ('en_preparation', 'expediee', 'remboursee')
    when 'en_preparation'      then p_statut in ('expediee', 'remboursee')
    when 'expediee'            then p_statut in ('livree', 'remboursee')
    when 'livree'              then p_statut in ('remboursee')
    else false end;
  if not v_permis then raise exception 'transition_interdite'; end if;

  if p_statut = 'annulee' and not v_commande.stock_rendu then
    update boutique_variantes v set stock = v.stock + l.quantite
      from boutique_lignes l where l.commande_id = v_commande.id and l.variante_id = v.id;
  end if;

  update boutique_commandes set
      statut = p_statut,
      updated_at = now(),
      -- Paiement refusé : retour « en attente », référence effacée, nouveau délai.
      reference_paiement = case when p_statut = 'en_attente_paiement' then null else reference_paiement end,
      moyen_paiement = case when p_statut = 'en_attente_paiement' then null else moyen_paiement end,
      paiement_declare_le = case when p_statut = 'en_attente_paiement' then null else paiement_declare_le end,
      expire_le = case when p_statut = 'en_attente_paiement'
                       then now() + make_interval(hours => (select delai_paiement_heures from boutique_reglages where id = 'principal'))
                       else expire_le end,
      payee_le = case when p_statut = 'payee' then now() else payee_le end,
      numero_facture = case when p_statut = 'payee' and numero_facture is null
                            then 'F-' || to_char(now() at time zone 'Africa/Abidjan', 'YYYY') || '-'
                                 || lpad(boutique_prochain_numero('facture')::text, 5, '0')
                            else numero_facture end,
      expediee_le = case when p_statut = 'expediee' then now() else expediee_le end,
      livreur_nom = case when p_statut = 'expediee' then coalesce(nullif(trim(p_livreur_nom), ''), livreur_nom) else livreur_nom end,
      livreur_telephone = case when p_statut = 'expediee' then coalesce(nullif(trim(p_livreur_telephone), ''), livreur_telephone) else livreur_telephone end,
      livree_le = case when p_statut = 'livree' then now() else livree_le end,
      annulee_le = case when p_statut = 'annulee' then now() else annulee_le end,
      motif_annulation = case when p_statut = 'annulee' then nullif(trim(p_detail), '') else motif_annulation end,
      stock_rendu = stock_rendu or p_statut = 'annulee'
    where id = v_commande.id;

  insert into boutique_journal (commande_id, admin_user_id, action, detail)
    values (v_commande.id, auth.uid(), v_commande.statut || ' → ' || p_statut, nullif(trim(p_detail), ''));
  return p_statut;
end;
$$;

-- --- Droits d'exécution ----------------------------------------------------
revoke all on function boutique_annuler_expirees() from public;
grant execute on function boutique_annuler_expirees() to authenticated;
revoke all on function boutique_passer_commande(jsonb, jsonb, uuid, boolean) from public;
grant execute on function boutique_passer_commande(jsonb, jsonb, uuid, boolean) to anon, authenticated;
revoke all on function boutique_declarer_paiement(text, uuid, text, text) from public;
grant execute on function boutique_declarer_paiement(text, uuid, text, text) to anon, authenticated;
revoke all on function boutique_suivi_commande(text, uuid, text) from public;
grant execute on function boutique_suivi_commande(text, uuid, text) to anon, authenticated;
revoke all on function boutique_changer_statut(uuid, text, text, text, text) from public;
grant execute on function boutique_changer_statut(uuid, text, text, text, text) to authenticated;

NOTIFY pgrst, 'reload schema';


-- ===================================================================
-- Extension 99 : BOUTIQUE MA2M — trois univers (articles, billets,
-- services), billets à code, informations du vendeur pour les factures.
-- (Demande de la propriétaire du 29/09/2026 : « tout créer maintenant ».)
--
--   - Produits : date et lieu pour un billet d'événement, modalités pour un
--     service. Le « stock » d'un billet = le nombre de places.
--   - Lignes de commande : on garde la sorte de produit (livraison seulement
--     pour les articles).
--   - Billets : un billet par place, avec un code unique, créé quand l'agence
--     valide le paiement ; annulé si la commande est annulée ou remboursée ;
--     contrôlé (et marqué « utilisé ») à l'entrée par un administrateur.
--   - Réglages : identité légale du vendeur, imprimée sur les factures.
-- Boutique toujours FERMÉE par défaut. Sans effet sur le reste du site.
-- Peut être relancée sans risque.
-- ===================================================================
alter table boutique_produits add column if not exists evenement_debut timestamptz;
alter table boutique_produits add column if not exists evenement_lieu text;
alter table boutique_produits add column if not exists service_modalites text;

alter table boutique_lignes add column if not exists type_produit text not null default 'physique';
do $$ begin
  alter table boutique_lignes add constraint boutique_lignes_type_check check (type_produit in ('physique', 'billet', 'service'));
exception when duplicate_object then null; end $$;

alter table boutique_reglages add column if not exists vendeur_raison_sociale text;
alter table boutique_reglages add column if not exists vendeur_forme_juridique text;
alter table boutique_reglages add column if not exists vendeur_rccm text;
alter table boutique_reglages add column if not exists vendeur_ncc text;
alter table boutique_reglages add column if not exists vendeur_adresse text;
alter table boutique_reglages add column if not exists vendeur_telephone text;
alter table boutique_reglages add column if not exists vendeur_email text;
alter table boutique_reglages add column if not exists mention_fiscale text;

create table if not exists boutique_billets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  commande_id uuid not null references boutique_commandes(id) on delete cascade,
  ligne_id uuid not null references boutique_lignes(id) on delete cascade,
  produit_id uuid references boutique_produits(id) on delete set null,
  nom_evenement text not null,
  libelle text,
  evenement_debut timestamptz,
  evenement_lieu text,
  statut text not null default 'valide' check (statut in ('valide', 'utilise', 'annule')),
  utilise_le timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists boutique_billets_commande_idx on boutique_billets (commande_id);
alter table boutique_billets enable row level security;
drop policy if exists "boutique billets admin" on boutique_billets;
create policy "boutique billets admin" on boutique_billets for select
  using (boutique_est_admin());

-- Un billet par place payée (sans doublon si on la rappelle).
create or replace function boutique_emettre_billets(p_commande_id uuid)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_ligne record;
  v_deja int;
  v_nb int := 0;
begin
  for v_ligne in
    select l.*, p.evenement_debut, p.evenement_lieu
      from boutique_lignes l left join boutique_produits p on p.id = l.produit_id
      where l.commande_id = p_commande_id and l.type_produit = 'billet'
  loop
    select count(*) into v_deja from boutique_billets where ligne_id = v_ligne.id;
    for i in (v_deja + 1)..v_ligne.quantite loop
      insert into boutique_billets (code, commande_id, ligne_id, produit_id, nom_evenement, libelle, evenement_debut, evenement_lieu)
        values ('MA2M-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5)) || '-'
                        || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5)),
                p_commande_id, v_ligne.id, v_ligne.produit_id, v_ligne.nom_produit, v_ligne.libelle_variante,
                v_ligne.evenement_debut, v_ligne.evenement_lieu);
      v_nb := v_nb + 1;
    end loop;
  end loop;
  return v_nb;
end;
$$;
revoke all on function boutique_emettre_billets(uuid) from public;

-- --- Passer commande : + sorte de produit par ligne, billets d'un événement passé refusés
create or replace function boutique_passer_commande(
  p_articles jsonb,
  p_client jsonb,
  p_zone_id uuid,
  p_cgv_acceptees boolean
)
returns table(numero text, jeton_suivi uuid, total_fcfa int, expire_le timestamptz)
language plpgsql security definer
set search_path = public
as $$
declare
  v_reglages boutique_reglages;
  v_nom text := trim(coalesce(p_client->>'nom', ''));
  v_tel text := regexp_replace(coalesce(p_client->>'telephone', ''), '[^0-9+]', '', 'g');
  v_email text := nullif(trim(coalesce(p_client->>'email', '')), '');
  v_article record;
  v_var record;
  v_prix int;
  v_sous_total int := 0;
  v_frais int := 0;
  v_physique boolean := false;
  v_zone boutique_zones_livraison;
  v_commande_id uuid := gen_random_uuid();
  v_numero text;
  v_jeton uuid := gen_random_uuid();
  v_expire timestamptz;
  v_nb_lignes int := 0;
begin
  select * into v_reglages from boutique_reglages where id = 'principal';
  if not coalesce(v_reglages.ouverte, false) and not boutique_est_admin() then
    raise exception 'boutique_fermee';
  end if;
  if p_cgv_acceptees is not true then
    raise exception 'cgv_non_acceptees';
  end if;
  if length(v_nom) < 2 or length(v_nom) > 120 then raise exception 'nom_invalide'; end if;
  if length(v_tel) < 8 or length(v_tel) > 20 then raise exception 'telephone_invalide'; end if;
  if v_email is not null and (length(v_email) > 160 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'email_invalide';
  end if;
  if jsonb_typeof(p_articles) is distinct from 'array' or jsonb_array_length(p_articles) = 0 then
    raise exception 'panier_vide';
  end if;
  if jsonb_array_length(p_articles) > 50 then raise exception 'panier_trop_grand'; end if;

  -- Garde-fou contre les commandes en rafale (robots) : 3 commandes non payées
  -- maximum par téléphone sur la dernière heure.
  if (select count(*) from boutique_commandes c
      where c.client_telephone = v_tel and c.statut = 'en_attente_paiement'
        and c.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'trop_de_commandes';
  end if;

  perform boutique_annuler_expirees();

  v_numero := 'MA2M-' || to_char(now() at time zone 'Africa/Abidjan', 'YYYY') || '-'
              || lpad(boutique_prochain_numero('commande')::text, 5, '0');
  v_expire := now() + make_interval(hours => v_reglages.delai_paiement_heures);

  insert into boutique_commandes (id, numero, jeton_suivi, client_nom, client_telephone, client_email,
      adresse_commune, adresse_quartier, adresse_repere, note_client,
      sous_total_fcfa, frais_livraison_fcfa, total_fcfa, cgv_acceptees_le, expire_le)
    values (v_commande_id, v_numero, v_jeton, v_nom, v_tel, v_email,
      left(nullif(trim(coalesce(p_client->>'commune', '')), ''), 80),
      left(nullif(trim(coalesce(p_client->>'quartier', '')), ''), 120),
      left(nullif(trim(coalesce(p_client->>'repere', '')), ''), 240),
      left(nullif(trim(coalesce(p_client->>'note', '')), ''), 500),
      0, 0, 0, now(), v_expire);

  -- Articles regroupés par variante (un même article envoyé deux fois = une ligne),
  -- verrouillés dans un ordre fixe pour éviter tout blocage entre deux commandes.
  for v_article in
    select (a->>'variante_id')::uuid as variante_id, sum((a->>'quantite')::int) as quantite
    from jsonb_array_elements(p_articles) a
    group by 1
    order by 1
  loop
    if v_article.quantite is null or v_article.quantite < 1 or v_article.quantite > 20 then
      raise exception 'quantite_invalide';
    end if;
    select v.id, v.stock, v.prix_fcfa as prix_variante, v.taille, v.couleur, v.actif,
           p.id as produit_id, p.nom, p.type, p.statut, p.evenement_debut, p.prix_fcfa, p.prix_promo_fcfa, p.promo_debut, p.promo_fin
      into v_var
      from boutique_variantes v join boutique_produits p on p.id = v.produit_id
      where v.id = v_article.variante_id
      for update of v;
    if not found or not v_var.actif or v_var.statut <> 'en_vente' then
      raise exception 'article_indisponible';
    end if;
    if v_var.type = 'billet' and v_var.evenement_debut is not null and v_var.evenement_debut < now() then
      raise exception 'evenement_passe';
    end if;
    if v_var.stock < v_article.quantite then
      raise exception 'stock_insuffisant';
    end if;
    v_prix := coalesce(v_var.prix_variante,
      case when v_var.prix_promo_fcfa is not null
            and (v_var.promo_debut is null or now() >= v_var.promo_debut)
            and (v_var.promo_fin is null or now() < v_var.promo_fin)
           then v_var.prix_promo_fcfa else v_var.prix_fcfa end);
    update boutique_variantes set stock = stock - v_article.quantite where id = v_var.id;
    insert into boutique_lignes (commande_id, produit_id, variante_id, type_produit, nom_produit, libelle_variante,
        prix_unitaire_fcfa, quantite, total_fcfa)
      values (v_commande_id, v_var.produit_id, v_var.id, v_var.type, v_var.nom,
        nullif(concat_ws(' · ', v_var.taille, v_var.couleur), ''),
        v_prix, v_article.quantite, v_prix * v_article.quantite);
    v_sous_total := v_sous_total + v_prix * v_article.quantite;
    v_physique := v_physique or v_var.type = 'physique';
    v_nb_lignes := v_nb_lignes + 1;
  end loop;

  if v_physique then
    select * into v_zone from boutique_zones_livraison z where z.id = p_zone_id and z.actif;
    if not found then raise exception 'zone_livraison_invalide'; end if;
    if length(coalesce(p_client->>'commune', '') || coalesce(p_client->>'quartier', '')) < 2 then
      raise exception 'adresse_invalide';
    end if;
    v_frais := case when v_reglages.livraison_offerte_des_fcfa is not null
                     and v_sous_total >= v_reglages.livraison_offerte_des_fcfa then 0
                    else v_zone.tarif_fcfa end;
  end if;

  update boutique_commandes set
      sous_total_fcfa = v_sous_total, frais_livraison_fcfa = v_frais, total_fcfa = v_sous_total + v_frais,
      zone_id = case when v_physique then v_zone.id end, zone_nom = case when v_physique then v_zone.nom end
    where id = v_commande_id;
  insert into boutique_journal (commande_id, action, detail)
    values (v_commande_id, 'commande_creee', v_nb_lignes || ' ligne(s), total ' || (v_sous_total + v_frais) || ' FCFA');

  return query select v_numero, v_jeton, v_sous_total + v_frais, v_expire;
end;
$$;

-- --- Changer le statut : payée → terminée possible (billets, services) ; billets émis / annulés
create or replace function boutique_changer_statut(
  p_commande_id uuid,
  p_statut text,
  p_detail text default null,
  p_livreur_nom text default null,
  p_livreur_telephone text default null
)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_commande boutique_commandes;
  v_permis boolean;
begin
  if not boutique_est_admin() then raise exception 'non_autorise'; end if;
  select * into v_commande from boutique_commandes where id = p_commande_id for update;
  if not found then raise exception 'commande_introuvable'; end if;

  v_permis := case v_commande.statut
    when 'en_attente_paiement' then p_statut in ('payee', 'annulee')
    when 'paiement_declare'    then p_statut in ('payee', 'en_attente_paiement', 'annulee')
    when 'payee'               then p_statut in ('en_preparation', 'expediee', 'livree', 'remboursee')
    when 'en_preparation'      then p_statut in ('expediee', 'livree', 'remboursee')
    when 'expediee'            then p_statut in ('livree', 'remboursee')
    when 'livree'              then p_statut in ('remboursee')
    else false end;
  if not v_permis then raise exception 'transition_interdite'; end if;

  if p_statut = 'annulee' and not v_commande.stock_rendu then
    update boutique_variantes v set stock = v.stock + l.quantite
      from boutique_lignes l where l.commande_id = v_commande.id and l.variante_id = v.id;
  end if;

  update boutique_commandes set
      statut = p_statut,
      updated_at = now(),
      -- Paiement refusé : retour « en attente », référence effacée, nouveau délai.
      reference_paiement = case when p_statut = 'en_attente_paiement' then null else reference_paiement end,
      moyen_paiement = case when p_statut = 'en_attente_paiement' then null else moyen_paiement end,
      paiement_declare_le = case when p_statut = 'en_attente_paiement' then null else paiement_declare_le end,
      expire_le = case when p_statut = 'en_attente_paiement'
                       then now() + make_interval(hours => (select delai_paiement_heures from boutique_reglages where id = 'principal'))
                       else expire_le end,
      payee_le = case when p_statut = 'payee' then now() else payee_le end,
      numero_facture = case when p_statut = 'payee' and numero_facture is null
                            then 'F-' || to_char(now() at time zone 'Africa/Abidjan', 'YYYY') || '-'
                                 || lpad(boutique_prochain_numero('facture')::text, 5, '0')
                            else numero_facture end,
      expediee_le = case when p_statut = 'expediee' then now() else expediee_le end,
      livreur_nom = case when p_statut = 'expediee' then coalesce(nullif(trim(p_livreur_nom), ''), livreur_nom) else livreur_nom end,
      livreur_telephone = case when p_statut = 'expediee' then coalesce(nullif(trim(p_livreur_telephone), ''), livreur_telephone) else livreur_telephone end,
      livree_le = case when p_statut = 'livree' then now() else livree_le end,
      annulee_le = case when p_statut = 'annulee' then now() else annulee_le end,
      motif_annulation = case when p_statut = 'annulee' then nullif(trim(p_detail), '') else motif_annulation end,
      stock_rendu = stock_rendu or p_statut = 'annulee'
    where id = v_commande.id;

  -- Billets : émis au moment où le paiement est validé, annulés avec la commande.
  if p_statut = 'payee' then
    perform boutique_emettre_billets(v_commande.id);
  elsif p_statut in ('annulee', 'remboursee') then
    update boutique_billets set statut = 'annule' where commande_id = v_commande.id and statut = 'valide';
  end if;

  insert into boutique_journal (commande_id, admin_user_id, action, detail)
    values (v_commande.id, auth.uid(), v_commande.statut || ' → ' || p_statut, nullif(trim(p_detail), ''));
  return p_statut;
end;
$$;

-- --- Suivre sa commande (client) : + sortes de lignes, billets, vendeur ------
create or replace function boutique_suivi_commande(
  p_numero text,
  p_jeton uuid default null,
  p_telephone text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_commande boutique_commandes;
  v_reglages boutique_reglages;
  v_tel text := regexp_replace(coalesce(p_telephone, ''), '[^0-9+]', '', 'g');
begin
  perform boutique_annuler_expirees();
  select * into v_commande from boutique_commandes c
    where c.numero = upper(trim(p_numero))
      and ((p_jeton is not null and c.jeton_suivi = p_jeton)
        or (length(v_tel) >= 8 and c.client_telephone = v_tel));
  if not found then raise exception 'commande_introuvable'; end if;
  select * into v_reglages from boutique_reglages where id = 'principal';
  return jsonb_build_object(
    'numero', v_commande.numero,
    'jeton_suivi', v_commande.jeton_suivi,
    'statut', v_commande.statut,
    'numero_facture', v_commande.numero_facture,
    'client_nom', v_commande.client_nom,
    'client_telephone', v_commande.client_telephone,
    'client_email', v_commande.client_email,
    'zone_nom', v_commande.zone_nom,
    'adresse_commune', v_commande.adresse_commune,
    'adresse_quartier', v_commande.adresse_quartier,
    'adresse_repere', v_commande.adresse_repere,
    'sous_total_fcfa', v_commande.sous_total_fcfa,
    'frais_livraison_fcfa', v_commande.frais_livraison_fcfa,
    'total_fcfa', v_commande.total_fcfa,
    'moyen_paiement', v_commande.moyen_paiement,
    'reference_paiement', v_commande.reference_paiement,
    'expire_le', v_commande.expire_le,
    'created_at', v_commande.created_at,
    'cgv_acceptees_le', v_commande.cgv_acceptees_le,
    'paiement_declare_le', v_commande.paiement_declare_le,
    'payee_le', v_commande.payee_le,
    'expediee_le', v_commande.expediee_le,
    'livree_le', v_commande.livree_le,
    'annulee_le', v_commande.annulee_le,
    'motif_annulation', v_commande.motif_annulation,
    'livreur_nom', v_commande.livreur_nom,
    'livreur_telephone', v_commande.livreur_telephone,
    'lignes', coalesce((select jsonb_agg(jsonb_build_object(
        'nom_produit', l.nom_produit, 'libelle_variante', l.libelle_variante, 'type_produit', l.type_produit,
        'prix_unitaire_fcfa', l.prix_unitaire_fcfa, 'quantite', l.quantite, 'total_fcfa', l.total_fcfa)
        order by l.nom_produit)
      from boutique_lignes l where l.commande_id = v_commande.id), '[]'::jsonb),
    'billets', coalesce((select jsonb_agg(jsonb_build_object(
        'code', b.code, 'nom_evenement', b.nom_evenement, 'libelle', b.libelle,
        'evenement_debut', b.evenement_debut, 'evenement_lieu', b.evenement_lieu, 'statut', b.statut)
        order by b.nom_evenement, b.code)
      from boutique_billets b where b.commande_id = v_commande.id), '[]'::jsonb),
    'paiement', case when v_commande.statut = 'en_attente_paiement' then jsonb_build_object(
        'wave', v_reglages.numero_wave, 'orange_money', v_reglages.numero_orange_money,
        'mtn_momo', v_reglages.numero_mtn_momo) end,
    'vendeur', jsonb_build_object(
        'nom', coalesce(v_reglages.vendeur_raison_sociale, 'Maître Akesse Model Management'),
        'forme_juridique', v_reglages.vendeur_forme_juridique,
        'rccm', v_reglages.vendeur_rccm, 'ncc', v_reglages.vendeur_ncc,
        'adresse', v_reglages.vendeur_adresse, 'telephone', v_reglages.vendeur_telephone,
        'email', v_reglages.vendeur_email, 'mention_fiscale', v_reglages.mention_fiscale)
  );
end;
$$;

-- --- Contrôle d'un billet à l'entrée (admin) ---------------------------------
create or replace function boutique_controler_billet(p_code text, p_marquer boolean default false)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_billet boutique_billets;
  v_commande boutique_commandes;
  v_etait text;
begin
  if not boutique_est_admin() then raise exception 'non_autorise'; end if;
  select * into v_billet from boutique_billets
    where code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) for update;
  if not found then raise exception 'billet_introuvable'; end if;
  v_etait := v_billet.statut;
  if p_marquer and v_billet.statut = 'valide' then
    update boutique_billets set statut = 'utilise', utilise_le = now() where id = v_billet.id
      returning * into v_billet;
    insert into boutique_journal (commande_id, admin_user_id, action, detail)
      values (v_billet.commande_id, auth.uid(), 'billet_utilise', v_billet.code);
  end if;
  select * into v_commande from boutique_commandes where id = v_billet.commande_id;
  return jsonb_build_object(
    'code', v_billet.code, 'statut', v_billet.statut, 'statut_avant', v_etait,
    'nom_evenement', v_billet.nom_evenement, 'libelle', v_billet.libelle,
    'evenement_debut', v_billet.evenement_debut, 'evenement_lieu', v_billet.evenement_lieu,
    'utilise_le', v_billet.utilise_le,
    'client_nom', v_commande.client_nom, 'commande', v_commande.numero);
end;
$$;

revoke all on function boutique_passer_commande(jsonb, jsonb, uuid, boolean) from public;
grant execute on function boutique_passer_commande(jsonb, jsonb, uuid, boolean) to anon, authenticated;
revoke all on function boutique_suivi_commande(text, uuid, text) from public;
grant execute on function boutique_suivi_commande(text, uuid, text) to anon, authenticated;
revoke all on function boutique_changer_statut(uuid, text, text, text, text) from public;
grant execute on function boutique_changer_statut(uuid, text, text, text, text) to authenticated;
revoke all on function boutique_controler_billet(text, boolean) from public;
grant execute on function boutique_controler_billet(text, boolean) to authenticated;

NOTIFY pgrst, 'reload schema';


-- ===================================================================
-- Extension 100 : BOUTIQUE MA2M — rayons rangés dans les trois portes
-- (Demande de la propriétaire du 29/09/2026.)
--   - Chaque catégorie (« rayon ») appartient à une porte : articles
--     (physique), billets (billet) ou services (service).
--   - Rayons de départ, modifiables ensuite dans Gestion → Catégories :
--       Articles : Vêtements, Accessoires, Objets de l'agence
--       Billets  : Défilés, Galas et soirées, Castings, Ateliers et masterclass
--       Services : Shooting photo, Formation privée, Coaching et
--                  accompagnement, Autres services
-- Sans effet sur le reste du site. Peut être relancée sans risque (un rayon
-- déjà présent n'est pas dupliqué ; son nom et son ordre ne sont pas écrasés).
-- ===================================================================
alter table boutique_categories add column if not exists univers text not null default 'physique';
do $$ begin
  alter table boutique_categories add constraint boutique_categories_univers_check check (univers in ('physique', 'billet', 'service'));
exception when duplicate_object then null; end $$;

insert into boutique_categories (nom, slug, univers, ordre) values
  ('Vêtements', 'vetements', 'physique', 1),
  ('Accessoires', 'accessoires', 'physique', 2),
  ('Objets de l''agence', 'objets-de-l-agence', 'physique', 3),
  ('Défilés', 'defiles', 'billet', 1),
  ('Galas et soirées', 'galas-et-soirees', 'billet', 2),
  ('Castings', 'castings', 'billet', 3),
  ('Ateliers et masterclass', 'ateliers-et-masterclass', 'billet', 4),
  ('Shooting photo', 'shooting-photo', 'service', 1),
  ('Formation privée', 'formation-privee', 'service', 2),
  ('Coaching et accompagnement', 'coaching-et-accompagnement', 'service', 3),
  ('Autres services', 'autres-services', 'service', 4)
on conflict (slug) do update set univers = excluded.univers;

NOTIFY pgrst, 'reload schema';


-- ===================================================================
-- Extension 101 : BOUTIQUE MA2M — message du bandeau défilant
-- Réglé dans Gestion → Réglages (demande de la propriétaire du 29/09/2026).
-- Désactivé ou vide : le bandeau affiche le texte habituel de la Maison.
-- Peut être relancée sans risque.
-- ===================================================================
alter table boutique_reglages add column if not exists bandeau_texte text;
alter table boutique_reglages add column if not exists bandeau_actif boolean not null default false;
do $$ begin
  alter table boutique_reglages add constraint boutique_reglages_bandeau_longueur check (bandeau_texte is null or length(bandeau_texte) <= 160);
exception when duplicate_object then null; end $$;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 102 : formulaires publics — limites relevées pour les vrais
-- afflux (audit du 30/09/2026).
--
-- Jusqu'ici : 10 candidatures par minute pour TOUT le site, et 3 par minute
-- depuis une même connexion. Après une annonce de casting, ou le jour d'un
-- casting où les candidates sont toutes sur le même Wi-Fi (ou chez le même
-- opérateur mobile, qui partage souvent une même adresse entre des milliers
-- d'abonnés), la 11e candidate de la minute recevait « Erreur lors de
-- l'envoi ». Le site retente désormais tout seul (insererAvecPatience dans
-- js/app.js) ; cette extension relève en plus les plafonds :
--   - candidatures : 60 par minute pour tout le site, 6 par connexion ;
--   - demandes de sélection (recruteurs) et messages de contact : 30 par
--     minute pour tout le site, 3 par connexion.
-- Les robots restent freinés (un robot seul ne peut plus bloquer tout le
-- monde plus d'une minute, et pas au-delà de 6 envois).
-- ===================================================================
drop policy if exists "Tout le monde peut candidater" on casting_applications;
create policy "Tout le monde peut candidater"
  on casting_applications for insert
  with check (limiter_soumissions_publiques_ip('candidature', 60, 6) and status = 'nouvelle');

drop policy if exists "Tout le monde peut envoyer une demande de casting" on recruiter_requests;
create policy "Tout le monde peut envoyer une demande de casting"
  on recruiter_requests for insert
  with check (limiter_soumissions_publiques_ip('recruteur', 30, 3) and status = 'nouvelle');

drop policy if exists "Tout le monde peut envoyer un message de contact" on messages_contact;
create policy "Tout le monde peut envoyer un message de contact"
  on messages_contact for insert
  with check (limiter_soumissions_publiques_ip('contact', 30, 3));

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 103 : effacement automatique des anciennes candidatures
-- (décision de la propriétaire, 30/09/2026).
--
--   - candidatures REFUSÉES : effacées 30 jours après le refus ;
--   - candidatures RETENUES, EN ÉTUDE, EN ATTENTE et NOUVELLES : effacées
--     après 6 mois sans aucun changement de statut.
-- Le statut « Vue » est retiré (il faisait double emploi avec « En étude ») :
-- les candidatures encore « vue » passent « en étude ».
-- Le délai part du dernier changement de statut (statut_change_at, mis à
-- jour par un trigger, Extension 70). Les liens de photos de la candidature
-- partent avec elle (casting_photos, « on delete cascade ») ; les photos
-- elles-mêmes restent dans le Google Drive de l'agence.
-- Les INSCRIPTIONS des mannequins ne sont jamais touchées ici.
--
-- Pourquoi : pas pour la place (une candidature ≈ 2 Ko, la base gratuite
-- en contient 500 Mo), mais pour ne pas garder des données personnelles
-- plus longtemps que nécessaire, et garder un tableau de bord lisible.
-- ===================================================================
update casting_applications set status = 'en étude' where status = 'vue';

create or replace function effacer_anciennes_candidatures()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from casting_applications
  where (status = 'refusée' and statut_change_at < now() - interval '30 days')
     or (status <> 'refusée' and statut_change_at < now() - interval '6 months');
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function effacer_anciennes_candidatures() from public, anon, authenticated;

-- Chaque nuit à 3 h 30 (même principe que le nettoyage des photos traitées).
create extension if not exists pg_cron;
select cron.schedule(
  'effacement-anciennes-candidatures',
  '30 3 * * *',
  $$select effacer_anciennes_candidatures();$$
);

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 104 : nouveau formulaire de candidature (validé par la
-- propriétaire le 30/09/2026).
--   - « Intégrer l'agence » : parcours Débutant·e (formulaire allégé) ou
--     Déjà mannequin (formulaire complet) ;
--   - niveau d'études, taille de vêtements, vidéo de présentation.
-- La vidéo est rangée dans le Google Drive de l'agence (jamais dans Supabase) :
-- seul son lien est enregistré, APRÈS l'envoi de la candidature, par la fonction
-- ajouter_video_candidature() — le site ne peut pas modifier une candidature
-- lui-même, et cette fonction n'accepte qu'un seul lien Google Drive, une seule
-- fois, sur une candidature toute récente.
-- ===================================================================
alter table casting_applications add column if not exists experience_mannequin text;   -- 'oui' / 'non'
alter table casting_applications add column if not exists situation_scolaire text;     -- 'en cours' / 'plus à l''école' / 'jamais scolarisé(e)'
alter table casting_applications add column if not exists niveau_etudes text;          -- ex. « Secondaire — 3e »
alter table casting_applications add column if not exists clothing_size text;
alter table casting_applications add column if not exists video_url text;

create or replace function ajouter_video_candidature(p_id uuid, p_url text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_url is null or p_url !~ '^https://drive\.google\.com/file/d/[A-Za-z0-9_-]+/view$' then
    return false;
  end if;
  update casting_applications
     set video_url = p_url
   where id = p_id
     and video_url is null
     and status = 'nouvelle'
     and created_at > now() - interval '2 hours';
  return found;
end;
$$;
revoke all on function ajouter_video_candidature(uuid, text) from public;
grant execute on function ajouter_video_candidature(uuid, text) to anon, authenticated;

-- ===================================================================
-- Extension 105 : Cahier des charges V2, Grand 1 — séparation de
-- « Intégrer l'agence » (integrer-agence.html) et « Postuler à un
-- casting » (candidature.html, désormais casting uniquement).
--
--   - C-7 : un casting a désormais une date, un lieu et un ordre
--     d'affichage (en plus du nom/actif/description déjà existants
--     depuis l'Extension 38/67).
--   - C-8/C-9/C-10 : quand AUCUN casting n'est ouvert (aucune ligne
--     casting_projets avec actif = true), candidature.html masque son
--     formulaire côté interface (déjà fait, voir ca-aucun-casting dans
--     la page) ET le serveur refuse toute candidature de type 'projet'
--     dans ce cas — un appel direct à l'API qui contournerait
--     l'interface est donc bloqué lui aussi, pas seulement le bouton.
--     Les candidatures de type 'agence' (integrer-agence.html) ne sont
--     jamais concernées par cette règle.
-- ===================================================================
alter table casting_projets add column if not exists date_casting date;
alter table casting_projets add column if not exists lieu text;
alter table casting_projets add column if not exists ordre_affichage int not null default 0;

create or replace function casting_ouvert()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from casting_projets where actif = true);
$$;
revoke all on function casting_ouvert() from public;
grant execute on function casting_ouvert() to anon, authenticated;

drop policy if exists "Tout le monde peut candidater" on casting_applications;
create policy "Tout le monde peut candidater"
  on casting_applications for insert
  with check (
    limiter_soumissions_publiques('candidature')
    and status = 'nouvelle'
    and (type_candidature <> 'projet' or casting_ouvert())
  );

NOTIFY pgrst, 'reload schema';

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 107 — Grand 3 (N-5 à N-20) : notifications push réelles
-- sur le téléphone de l'administration, déclenchées par le SERVEUR
-- (triggers de base de données), pas par le navigateur du visiteur.
-- =====================================================================

-- Appareils (téléphones/navigateurs) abonnés aux notifications push.
-- Un admin peut en enregistrer plusieurs (N-8).
create table if not exists push_abonnements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  appareil text,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
alter table push_abonnements enable row level security;

drop policy if exists "Un admin gère ses propres appareils" on push_abonnements;
create policy "Un admin gère ses propres appareils"
  on push_abonnements for all
  using (user_id = auth.uid() and exists (select 1 from admins where user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (select 1 from admins where user_id = auth.uid()));

-- Réglages : quels événements et quels canaux sont actifs (N-13).
create table if not exists notifications_reglages (
  cle text primary key,
  actif boolean not null default true
);
alter table notifications_reglages enable row level security;

drop policy if exists "Tout le monde lit les réglages de notifications" on notifications_reglages;
create policy "Tout le monde lit les réglages de notifications"
  on notifications_reglages for select using (true);

drop policy if exists "Les admins modifient les réglages de notifications" on notifications_reglages;
create policy "Les admins modifient les réglages de notifications"
  on notifications_reglages for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

insert into notifications_reglages (cle, actif) values
  ('evenement_candidature_casting', true),
  ('evenement_integration_agence', true),
  ('evenement_message_recruteur', true),
  ('evenement_message_visiteur', true),
  ('canal_push', true)
on conflict (cle) do nothing;

-- Journal des envois (N-11) : visible uniquement par les admins.
create table if not exists notifications_journal (
  id uuid primary key default gen_random_uuid(),
  evenement text not null,
  canal text not null default 'push',
  statut text not null,
  cible_table text,
  cible_id uuid,
  resume text,
  erreur text,
  cree_le timestamptz not null default now()
);
alter table notifications_journal enable row level security;

drop policy if exists "Les admins lisent le journal des notifications" on notifications_journal;
create policy "Les admins lisent le journal des notifications"
  on notifications_journal for select
  using (exists (select 1 from admins where user_id = auth.uid()));

-- Déclencheurs serveur : après chaque enregistrement réussi dans les 3 tables
-- existantes qui couvrent les 4 événements (N-1 à N-4), le serveur appelle
-- directement notre fonction d'envoi — indépendant du navigateur du visiteur
-- (N-9), et la candidature/le message est déjà enregistré avant cet appel
-- (N-10 : aucune perte de données même si l'envoi échoue).
--
-- ⚠️ Remplacez <WEBHOOK_SECRET> ci-dessous par la valeur secrète donnée
-- séparément (jamais dans ce fichier versionné, voir N-17) avant d'exécuter.
--
-- Utilise l'extension pg_net (standard chez Supabase) plutôt que
-- supabase_functions.http_request, absente sur certains projets.

create extension if not exists pg_net with schema extensions;

create or replace function notifier_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://www.maitreakessemodelmanagement.com/api/notifications-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', '<WEBHOOK_SECRET>'),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', row_to_json(NEW))
  );
  return new;
end;
$$;

drop trigger if exists trg_notif_casting_applications on casting_applications;
create trigger trg_notif_casting_applications
  after insert on casting_applications
  for each row execute function notifier_push_notification();

drop trigger if exists trg_notif_recruiter_requests on recruiter_requests;
create trigger trg_notif_recruiter_requests
  after insert on recruiter_requests
  for each row execute function notifier_push_notification();

drop trigger if exists trg_notif_messages_contact on messages_contact;
create trigger trg_notif_messages_contact
  after insert on messages_contact
  for each row execute function notifier_push_notification();

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 109 — Grand 4 (S-1 à S-16) : blocage après trop de codes/mots
-- de passe erronés. Protège 3 endroits : connexion admin (mot de passe),
-- code de validation admin (2FA), connexion espace mannequin (mot de
-- passe). Tout le comptage et le blocage sont en base de données, jamais
-- dans le navigateur (S-6) — un visiteur qui vide ses cookies ou passe en
-- navigation privée reste bloqué.
--
-- Interprétation appliquée (comme indiqué dans le cahier) : 3 erreurs
-- normales, puis 2 dernières tentatives averties, soit 5 erreurs avant
-- blocage. Valeurs modifiables sans toucher au code (table ci-dessous).
-- =====================================================================

create table if not exists connexion_reglages (
  cle text primary key,
  valeur int not null
);
alter table connexion_reglages enable row level security;
insert into connexion_reglages (cle, valeur) values
  ('essais_avertissement_des', 3),
  ('essais_avant_blocage', 5),
  ('duree_blocage_minutes', 60),
  ('duree_blocage_recidive_minutes', 120),
  ('expiration_compteur_minutes', 30)
on conflict (cle) do nothing;

-- Nouveau type d'événement de notification (réutilise notifications_reglages
-- de l'Extension 107) pour les blocages de connexion.
insert into notifications_reglages (cle, actif) values
  ('evenement_blocage_connexion', true)
on conflict (cle) do nothing;

-- Deux compteurs indépendants (S-8) : par IP (protège contre un robot qui
-- essaie plein de comptes depuis une seule adresse) et par compte visé
-- (protège un compte précis même si l'attaque change d'IP). Le blocage le
-- plus strict des deux s'applique.
create table if not exists connexion_tentatives_ip (
  ip text not null,
  espace text not null,
  compteur int not null default 0,
  derniere_tentative timestamptz not null default now(),
  bloque_jusqua timestamptz,
  primary key (ip, espace)
);
create table if not exists connexion_tentatives_compte (
  identifiant text not null,
  espace text not null,
  compteur int not null default 0,
  derniere_tentative timestamptz not null default now(),
  bloque_jusqua timestamptz,
  primary key (identifiant, espace)
);

-- IP de confiance de l'agence, jamais bloquées (S-14).
create table if not exists connexion_liste_blanche (
  ip text primary key,
  note text,
  ajoute_le timestamptz not null default now()
);

-- Journal des blocages (S-12) + déclenche une notification push (réutilise
-- le système du Grand 3, S-15) — aucune donnée sensible : identifiant
-- masqué, jamais le code/mot de passe.
create table if not exists blocages_connexion (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  identifiant text,
  espace text not null,
  duree_minutes int not null,
  recidive boolean not null default false,
  cree_le timestamptz not null default now()
);

alter table connexion_tentatives_ip enable row level security;
alter table connexion_tentatives_compte enable row level security;
alter table connexion_liste_blanche enable row level security;
alter table blocages_connexion enable row level security;
-- Aucune policy publique sur ces 4 tables : seule la clé service_role
-- (utilisée uniquement par les fonctions api/ côté serveur) peut les lire
-- ou les modifier — un visiteur ne peut jamais toucher à son propre
-- compteur depuis le navigateur.

-- Vérifie si ip+espace ou identifiant+espace est actuellement bloqué,
-- SANS vérifier le mot de passe/code (S-6 : pendant un blocage, on refuse
-- avant même de regarder si le code est bon).
create or replace function connexion_verifier_blocage(p_ip text, p_identifiant text, p_espace text)
returns table(bloque boolean, minutes_restantes int)
language plpgsql
security definer
as $$
declare
  v_ip_bloque timestamptz;
  v_compte_bloque timestamptz;
  v_max timestamptz;
begin
  if exists (select 1 from connexion_liste_blanche where ip = p_ip) then
    return query select false, 0;
    return;
  end if;
  select bloque_jusqua into v_ip_bloque from connexion_tentatives_ip where ip = p_ip and espace = p_espace;
  select bloque_jusqua into v_compte_bloque from connexion_tentatives_compte where identifiant = p_identifiant and espace = p_espace;
  v_max := greatest(coalesce(v_ip_bloque, 'epoch'::timestamptz), coalesce(v_compte_bloque, 'epoch'::timestamptz));
  if v_max > now() then
    return query select true, greatest(1, ceil(extract(epoch from (v_max - now())) / 60)::int);
  else
    return query select false, 0;
  end if;
end;
$$;

-- Enregistre un échec, incrémente les deux compteurs, déclenche le
-- blocage (avec récidive = nouveau blocage dans les 24h) si le seuil est
-- atteint.
create or replace function connexion_enregistrer_echec(p_ip text, p_identifiant text, p_espace text)
returns table(bloque boolean, avertissement boolean, essais_restants int, minutes_blocage int)
language plpgsql
security definer
as $$
declare
  v_expir int; v_avert int; v_max int; v_duree int; v_duree_recid int;
  v_ip_row connexion_tentatives_ip%rowtype;
  v_compte_row connexion_tentatives_compte%rowtype;
  v_compteur int;
  v_recidive boolean;
  v_duree_appliquee int;
begin
  select
    max(valeur) filter (where cle = 'expiration_compteur_minutes'),
    max(valeur) filter (where cle = 'essais_avertissement_des'),
    max(valeur) filter (where cle = 'essais_avant_blocage'),
    max(valeur) filter (where cle = 'duree_blocage_minutes'),
    max(valeur) filter (where cle = 'duree_blocage_recidive_minutes')
  into v_expir, v_avert, v_max, v_duree, v_duree_recid
  from connexion_reglages;
  v_expir := coalesce(v_expir, 30); v_avert := coalesce(v_avert, 3); v_max := coalesce(v_max, 5);
  v_duree := coalesce(v_duree, 60); v_duree_recid := coalesce(v_duree_recid, 120);

  select * into v_ip_row from connexion_tentatives_ip where ip = p_ip and espace = p_espace for update;
  if not found or v_ip_row.derniere_tentative < now() - (v_expir || ' minutes')::interval then
    insert into connexion_tentatives_ip (ip, espace, compteur, derniere_tentative, bloque_jusqua)
      values (p_ip, p_espace, 1, now(), null)
      on conflict (ip, espace) do update set compteur = 1, derniere_tentative = now()
      returning * into v_ip_row;
  else
    update connexion_tentatives_ip set compteur = compteur + 1, derniere_tentative = now()
      where ip = p_ip and espace = p_espace returning * into v_ip_row;
  end if;

  select * into v_compte_row from connexion_tentatives_compte where identifiant = p_identifiant and espace = p_espace for update;
  if not found or v_compte_row.derniere_tentative < now() - (v_expir || ' minutes')::interval then
    insert into connexion_tentatives_compte (identifiant, espace, compteur, derniere_tentative, bloque_jusqua)
      values (p_identifiant, p_espace, 1, now(), null)
      on conflict (identifiant, espace) do update set compteur = 1, derniere_tentative = now()
      returning * into v_compte_row;
  else
    update connexion_tentatives_compte set compteur = compteur + 1, derniere_tentative = now()
      where identifiant = p_identifiant and espace = p_espace returning * into v_compte_row;
  end if;

  v_compteur := greatest(v_ip_row.compteur, v_compte_row.compteur);

  if v_compteur >= v_max then
    v_recidive := (v_ip_row.bloque_jusqua is not null and v_ip_row.bloque_jusqua > now() - interval '24 hours')
               or (v_compte_row.bloque_jusqua is not null and v_compte_row.bloque_jusqua > now() - interval '24 hours');
    v_duree_appliquee := case when v_recidive then v_duree_recid else v_duree end;
    update connexion_tentatives_ip set bloque_jusqua = now() + (v_duree_appliquee || ' minutes')::interval, compteur = 0
      where ip = p_ip and espace = p_espace;
    update connexion_tentatives_compte set bloque_jusqua = now() + (v_duree_appliquee || ' minutes')::interval, compteur = 0
      where identifiant = p_identifiant and espace = p_espace;
    insert into blocages_connexion (ip, identifiant, espace, duree_minutes, recidive)
      values (p_ip, left(p_identifiant, 2) || '***', p_espace, v_duree_appliquee, v_recidive);
    return query select true, false, 0, v_duree_appliquee;
  elsif v_compteur >= v_avert then
    return query select false, true, (v_max - v_compteur), 0;
  else
    return query select false, false, (v_max - v_compteur), 0;
  end if;
end;
$$;

-- Remet les deux compteurs à zéro après une connexion réussie (S-4).
create or replace function connexion_enregistrer_succes(p_ip text, p_identifiant text, p_espace text)
returns void
language plpgsql
security definer
as $$
begin
  delete from connexion_tentatives_ip where ip = p_ip and espace = p_espace;
  delete from connexion_tentatives_compte where identifiant = p_identifiant and espace = p_espace;
end;
$$;

revoke all on function connexion_verifier_blocage(text, text, text) from public, anon, authenticated;
revoke all on function connexion_enregistrer_echec(text, text, text) from public, anon, authenticated;
revoke all on function connexion_enregistrer_succes(text, text, text) from public, anon, authenticated;

-- Même notification push que le Grand 3, pour chaque blocage (S-15).
drop trigger if exists trg_notif_blocages_connexion on blocages_connexion;
create trigger trg_notif_blocages_connexion
  after insert on blocages_connexion
  for each row execute function notifier_push_notification();

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 110 — Grand 4, complément (demande du 04/10/2026) :
-- 1) Le code d'inscription (inscription-mannequin.html) et le code
--    d'invitation (« Créer mon compte » de espace-mannequin.html) étaient
--    vérifiés directement depuis le navigateur, sans aucun blocage. Ils
--    passent désormais par api/code-protege.js (même blocage que les mots
--    de passe), et ne sont plus appelables depuis le navigateur.
-- 2) Compteur commun à tout le site pour un même téléphone : chaque erreur
--    (mot de passe, code admin, code d'inscription, code d'invitation)
--    compte dans un compteur partagé (espace '*', identifiant
--    'appareil:<id>'), et les avertissements « il vous reste N
--    tentatives » / le blocage suivent ce compteur partout. Une connexion
--    réussie ne remet PAS ce compteur commun à zéro (sinon il suffirait de
--    se connecter à son propre compte pour repartir de zéro ailleurs) : il
--    s'efface seul après 30 min sans erreur.
-- Les anciennes versions à 3 paramètres restent (elles appellent les
-- nouvelles) pour que la mise en ligne du site et de ce SQL puisse se
-- faire dans n'importe quel ordre sans rien casser.
-- =====================================================================

create or replace function connexion_verifier_blocage(p_ip text, p_identifiant text, p_espace text, p_appareil text)
returns table(bloque boolean, minutes_restantes int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max timestamptz;
begin
  if exists (select 1 from connexion_liste_blanche where ip = p_ip) then
    return query select false, 0;
    return;
  end if;
  select greatest(
    coalesce((select bloque_jusqua from connexion_tentatives_ip where ip = p_ip and espace = p_espace), 'epoch'::timestamptz),
    coalesce((select bloque_jusqua from connexion_tentatives_compte where identifiant = p_identifiant and espace = p_espace), 'epoch'::timestamptz),
    coalesce((select bloque_jusqua from connexion_tentatives_compte where p_appareil is not null and identifiant = 'appareil:' || p_appareil and espace = '*'), 'epoch'::timestamptz)
  ) into v_max;
  if v_max > now() then
    return query select true, greatest(1, ceil(extract(epoch from (v_max - now())) / 60)::int);
  else
    return query select false, 0;
  end if;
end;
$$;

-- Incrémente (ou remet à 1 si expiré) un compteur de la table _compte.
create or replace function connexion_incrementer_compte(p_identifiant text, p_espace text, p_expir int)
returns connexion_tentatives_compte
language plpgsql
security definer
set search_path = public
as $$
declare
  r connexion_tentatives_compte%rowtype;
begin
  select * into r from connexion_tentatives_compte where identifiant = p_identifiant and espace = p_espace for update;
  if not found or r.derniere_tentative < now() - (p_expir || ' minutes')::interval then
    insert into connexion_tentatives_compte (identifiant, espace, compteur, derniere_tentative, bloque_jusqua)
      values (p_identifiant, p_espace, 1, now(), r.bloque_jusqua)
      on conflict (identifiant, espace) do update set compteur = 1, derniere_tentative = now()
      returning * into r;
  else
    update connexion_tentatives_compte set compteur = compteur + 1, derniere_tentative = now()
      where identifiant = p_identifiant and espace = p_espace returning * into r;
  end if;
  return r;
end;
$$;

create or replace function connexion_enregistrer_echec(p_ip text, p_identifiant text, p_espace text, p_appareil text)
returns table(bloque boolean, avertissement boolean, essais_restants int, minutes_blocage int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expir int; v_avert int; v_max int; v_duree int; v_duree_recid int;
  v_ip_row connexion_tentatives_ip%rowtype;
  v_compte_row connexion_tentatives_compte%rowtype;
  v_app_row connexion_tentatives_compte%rowtype;
  v_app_id text := case when p_appareil is null then null else 'appareil:' || p_appareil end;
  v_compteur int;
  v_recidive boolean;
  v_duree_appliquee int;
begin
  select
    max(valeur) filter (where cle = 'expiration_compteur_minutes'),
    max(valeur) filter (where cle = 'essais_avertissement_des'),
    max(valeur) filter (where cle = 'essais_avant_blocage'),
    max(valeur) filter (where cle = 'duree_blocage_minutes'),
    max(valeur) filter (where cle = 'duree_blocage_recidive_minutes')
  into v_expir, v_avert, v_max, v_duree, v_duree_recid
  from connexion_reglages;
  v_expir := coalesce(v_expir, 30); v_avert := coalesce(v_avert, 3); v_max := coalesce(v_max, 5);
  v_duree := coalesce(v_duree, 60); v_duree_recid := coalesce(v_duree_recid, 120);

  select * into v_ip_row from connexion_tentatives_ip where ip = p_ip and espace = p_espace for update;
  if not found or v_ip_row.derniere_tentative < now() - (v_expir || ' minutes')::interval then
    insert into connexion_tentatives_ip (ip, espace, compteur, derniere_tentative, bloque_jusqua)
      values (p_ip, p_espace, 1, now(), v_ip_row.bloque_jusqua)
      on conflict (ip, espace) do update set compteur = 1, derniere_tentative = now()
      returning * into v_ip_row;
  else
    update connexion_tentatives_ip set compteur = compteur + 1, derniere_tentative = now()
      where ip = p_ip and espace = p_espace returning * into v_ip_row;
  end if;

  v_compte_row := connexion_incrementer_compte(p_identifiant, p_espace, v_expir);
  if v_app_id is not null then
    v_app_row := connexion_incrementer_compte(v_app_id, '*', v_expir);
  end if;

  v_compteur := greatest(v_ip_row.compteur, v_compte_row.compteur, coalesce(v_app_row.compteur, 0));

  if v_compteur >= v_max then
    v_recidive := (v_ip_row.bloque_jusqua is not null and v_ip_row.bloque_jusqua > now() - interval '24 hours')
               or (v_compte_row.bloque_jusqua is not null and v_compte_row.bloque_jusqua > now() - interval '24 hours')
               or (v_app_row.bloque_jusqua is not null and v_app_row.bloque_jusqua > now() - interval '24 hours');
    v_duree_appliquee := case when v_recidive then v_duree_recid else v_duree end;
    update connexion_tentatives_ip set bloque_jusqua = now() + (v_duree_appliquee || ' minutes')::interval, compteur = 0
      where ip = p_ip and espace = p_espace;
    update connexion_tentatives_compte set bloque_jusqua = now() + (v_duree_appliquee || ' minutes')::interval, compteur = 0
      where (identifiant = p_identifiant and espace = p_espace)
         or (v_app_id is not null and identifiant = v_app_id and espace = '*');
    insert into blocages_connexion (ip, identifiant, espace, duree_minutes, recidive)
      values (p_ip, left(p_identifiant, 2) || '***', p_espace, v_duree_appliquee, v_recidive);
    return query select true, false, 0, v_duree_appliquee;
  elsif v_compteur >= v_avert then
    return query select false, true, (v_max - v_compteur), 0;
  else
    return query select false, false, (v_max - v_compteur), 0;
  end if;
end;
$$;

-- Succès : remet à zéro les compteurs de CET espace seulement (pas le
-- compteur commun du téléphone, voir en-tête).
create or replace function connexion_enregistrer_succes(p_ip text, p_identifiant text, p_espace text, p_appareil text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from connexion_tentatives_ip where ip = p_ip and espace = p_espace;
  delete from connexion_tentatives_compte where identifiant = p_identifiant and espace = p_espace;
end;
$$;

-- Anciennes signatures (3 paramètres) : redirigées vers les nouvelles.
create or replace function connexion_verifier_blocage(p_ip text, p_identifiant text, p_espace text)
returns table(bloque boolean, minutes_restantes int)
language sql security definer set search_path = public
as $$ select * from connexion_verifier_blocage(p_ip, p_identifiant, p_espace, null::text); $$;
create or replace function connexion_enregistrer_echec(p_ip text, p_identifiant text, p_espace text)
returns table(bloque boolean, avertissement boolean, essais_restants int, minutes_blocage int)
language sql security definer set search_path = public
as $$ select * from connexion_enregistrer_echec(p_ip, p_identifiant, p_espace, null::text); $$;
create or replace function connexion_enregistrer_succes(p_ip text, p_identifiant text, p_espace text)
returns void
language sql security definer set search_path = public
as $$ select connexion_enregistrer_succes(p_ip, p_identifiant, p_espace, null::text); $$;

revoke all on function connexion_verifier_blocage(text, text, text, text) from public, anon, authenticated;
revoke all on function connexion_enregistrer_echec(text, text, text, text) from public, anon, authenticated;
revoke all on function connexion_enregistrer_succes(text, text, text, text) from public, anon, authenticated;
revoke all on function connexion_incrementer_compte(text, text, int) from public, anon, authenticated;
revoke all on function connexion_verifier_blocage(text, text, text) from public, anon, authenticated;
revoke all on function connexion_enregistrer_echec(text, text, text) from public, anon, authenticated;
revoke all on function connexion_enregistrer_succes(text, text, text) from public, anon, authenticated;
grant execute on function connexion_verifier_blocage(text, text, text, text) to service_role;
grant execute on function connexion_enregistrer_echec(text, text, text, text) to service_role;
grant execute on function connexion_enregistrer_succes(text, text, text, text) to service_role;
grant execute on function connexion_incrementer_compte(text, text, int) to service_role;
grant execute on function connexion_verifier_blocage(text, text, text) to service_role;
grant execute on function connexion_enregistrer_echec(text, text, text) to service_role;
grant execute on function connexion_enregistrer_succes(text, text, text) to service_role;

-- Les fonctions qui vérifient un code ne sont plus appelables depuis le
-- navigateur (sinon un script pourrait contourner le blocage en les
-- appelant directement) : seul api/code-protege.js (clé service_role) y a
-- accès. Boucle sur toutes les versions existantes, au cas où.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('verifier_code_inscription', 'soumettre_inscription_mannequin', 'check_invite_code', 'consume_invite_code')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 111 — WhatsApp (projet du 04/10/2026) : journal des
-- informations envoyées par Meta à api/whatsapp-webhook.js — état de
-- chaque message envoyé par l'agence (sent / delivered / read / failed +
-- raison de l'échec) et messages reçus en réponse. Seule la fonction
-- serveur (clé service_role) écrit ; seuls les admins lisent.
-- =====================================================================
create table if not exists whatsapp_evenements (
  id uuid primary key default gen_random_uuid(),
  recu_le timestamptz not null default now(),
  type text not null,
  message_id text,
  statut text,
  numero text,
  texte text,
  erreur_code text,
  erreur_titre text,
  erreur_detail text,
  brut jsonb,
  signature_verifiee boolean not null default false
);
create index if not exists whatsapp_evenements_recu_le on whatsapp_evenements (recu_le desc);
create index if not exists whatsapp_evenements_message_id on whatsapp_evenements (message_id);
alter table whatsapp_evenements enable row level security;

drop policy if exists "Les admins lisent les événements WhatsApp" on whatsapp_evenements;
create policy "Les admins lisent les événements WhatsApp"
  on whatsapp_evenements for select
  using (exists (select 1 from admins where user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 112 — Test de sécurité externe (04/10/2026) : l'ancien
-- stockage des photos des mannequins chez Supabase (bucket model-photos,
-- d'avant le passage à Cloudflare R2) pouvait être LISTÉ par n'importe
-- qui avec la clé publique du site : liste des dossiers, puis des photos
-- de chaque dossier — y compris celles de mannequins non publiés.
-- Lister n'est utile qu'au mannequin (son propre dossier) et aux admins.
-- Les photos déjà affichées sur le site gardent leur adresse publique :
-- dans un bucket public, l'affichage d'une photo dont on connaît l'adresse
-- ne dépend pas de cette règle — seule l'énumération disparaît.
-- =====================================================================
drop policy if exists "Photos visibles publiquement" on storage.objects;
drop policy if exists "Photos model-photos : liste par le mannequin et les admins" on storage.objects;
create policy "Photos model-photos : liste par le mannequin et les admins"
  on storage.objects for select
  using (
    bucket_id = 'model-photos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from admins where user_id = auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 113 — Couverture du site (04/10/2026) : réglages simples du
-- site, modifiables depuis le tableau de bord. Première utilisation : la
-- couverture fixe en haut de toutes les pages (cle = 'couverture') —
-- soit l'animation du logo (par défaut), soit une vidéo envoyée par
-- l'agence ({ "type": "video", "url": ..., "chemin": ... }).
-- Lecture publique (les pages doivent savoir quoi afficher, rien de
-- secret) ; écriture réservée aux admins.
-- =====================================================================
create table if not exists reglages_site (
  cle text primary key,
  valeur jsonb not null default '{}'::jsonb,
  maj timestamptz not null default now()
);
alter table reglages_site enable row level security;

drop policy if exists "Tout le monde lit les réglages du site" on reglages_site;
create policy "Tout le monde lit les réglages du site"
  on reglages_site for select using (true);

drop policy if exists "Les admins modifient les réglages du site" on reglages_site;
create policy "Les admins modifient les réglages du site"
  on reglages_site for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

grant select on reglages_site to anon, authenticated;
grant insert, update, delete on reglages_site to authenticated;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 114 — Âge des mannequins sans la date de naissance (décision
-- de la propriétaire, 06/10/2026) : sur la fiche publique, seul l'âge
-- doit apparaître ; la date de naissance complète ne doit plus pouvoir
-- être lue par un visiteur, même en interrogeant la base directement.
--  1) la base calcule l'âge elle-même (fonction ages_mannequins), pour les
--     seuls mannequins publiés ;
--  2) la colonne date_naissance n'est plus lisible par les visiteurs
--     (rôle « anon »). Le tableau de bord et l'espace mannequin (comptes
--     connectés) ne sont pas touchés.
-- À exécuter APRÈS la mise en ligne des fiches qui utilisent
-- ages_mannequins (06/10/2026) — sinon l'âge disparaît des fiches.
-- =====================================================================
create or replace function ages_mannequins(ids uuid[])
returns table(model_id uuid, age int)
language sql stable security definer
set search_path = public
as $$
  select id, extract(year from age(current_date, date_naissance))::int
  from model_profiles
  where id = any(ids) and published = true and date_naissance is not null;
$$;
revoke all on function ages_mannequins(uuid[]) from public;
grant execute on function ages_mannequins(uuid[]) to anon, authenticated;

revoke select (date_naissance) on model_profiles from anon;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 115 — Niveau des mannequins en deux catégories (décision de la
-- propriétaire, 06/10/2026) : « New Face » et « Professionnel » (affiché
-- « Main Board » sur le site public, la compcard et le CV). Le mot
-- « Amateur » n'est plus utilisé. Reclassement des mannequins déjà
-- inscrites selon les années d'expérience qu'elles avaient déclarées :
-- de 0 à 2 ans (ou non renseigné) → New Face ; plus de 2 ans → Professionnel.
-- Les nouvelles inscrites cochent leur niveau ; le site le contrôle ensuite
-- (« Professionnel » seulement avec plus de 2 ans d'expériences).
-- =====================================================================
-- Le déclencheur proteger_proprietaire_profil (Extension 60) refuse toute
-- modification faite hors connexion de la mannequin (cas de l'éditeur SQL) :
-- il est suspendu le temps de cette seule mise à jour, dans une transaction
-- (en cas d'erreur, rien n'est modifié et il reste actif).
begin;
alter table model_profiles disable trigger trg_proteger_proprietaire_profil;

update model_profiles
set niveau_mannequin = case when coalesce(years_experience, 0) > 2 then 'Professionnel' else 'New Face' end
where true; -- toutes les fiches, volontairement

alter table model_profiles enable trigger trg_proteger_proprietaire_profil;
commit;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 116 — Tri automatique des photos par IA (demande de la
-- propriétaire, 06/10/2026) : à chaque envoi, une IA (Claude, fonction
-- serveur api/trier-photo.js) range la photo en « book » (photo
-- professionnelle), « digital » (photo naturelle au téléphone, valable pour
-- les recruteurs) ou « ecartee » (photo inutilisable). Une photo écartée
-- n'est JAMAIS supprimée : elle est seulement cachée — au public comme à la
-- mannequin elle-même — et reste visible dans le tableau de bord, où un
-- admin peut la remettre d'un clic.
--  1) colonnes du tri (vides tant que la photo n'est pas triée) ;
--     « a_verifier » = l'IA hésite : la photo reste visible et l'admin la voit ;
--  2) lecture : une photo écartée n'est visible que par un admin ;
--  3) seuls un admin ou la fonction serveur peuvent écrire ces colonnes
--     (une mannequin ne peut pas « dé-écarter » sa photo elle-même) ;
--  4) la limite de 60 photos ne compte plus les photos écartées.
-- À exécuter APRÈS la mise en ligne du site du 06/10/2026 (tri des photos).
-- =====================================================================
alter table model_photos add column if not exists tri_statut text
  check (tri_statut in ('book', 'digital', 'ecartee', 'a_verifier'));
alter table model_photos add column if not exists tri_raison text;
alter table model_photos add column if not exists tri_confiance real;
alter table model_photos add column if not exists tri_date timestamptz;
alter table model_photos add column if not exists tri_manuel boolean not null default false;

drop policy if exists "Photos écartées cachées (tri IA)" on model_photos;
create policy "Photos écartées cachées (tri IA)"
  on model_photos as restrictive for select
  using (
    tri_statut is distinct from 'ecartee'
    or exists (select 1 from admins where user_id = auth.uid())
  );

create or replace function proteger_tri_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- fonction serveur (clé de service, sans connexion) ou admin : libre
  if auth.uid() is null or exists (select 1 from admins where user_id = auth.uid()) then
    return NEW;
  end if;
  if TG_OP = 'INSERT' then
    NEW.tri_statut := null; NEW.tri_raison := null; NEW.tri_confiance := null;
    NEW.tri_date := null; NEW.tri_manuel := false;
  else
    NEW.tri_statut := OLD.tri_statut; NEW.tri_raison := OLD.tri_raison;
    NEW.tri_confiance := OLD.tri_confiance; NEW.tri_date := OLD.tri_date;
    NEW.tri_manuel := OLD.tri_manuel;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_proteger_tri_photo on model_photos;
create trigger trg_proteger_tri_photo
  before insert or update on model_photos
  for each row execute function proteger_tri_photo();

create or replace function limiter_nombre_photos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_photos int;
  est_admin boolean;
begin
  select exists(select 1 from admins where user_id = auth.uid()) into est_admin;
  if est_admin then
    return NEW;
  end if;
  select count(*) into nb_photos from model_photos
    where model_id = NEW.model_id and tri_statut is distinct from 'ecartee';
  if nb_photos >= 60 then
    raise exception 'Limite de 60 photos atteinte pour ce book. Supprimez une photo avant d''en ajouter une nouvelle.';
  end if;
  return NEW;
end;
$$;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 117 — Rapports de revue des books (demande de la propriétaire,
-- 06/10/2026) : la revue stricte du book par l'IA (api/_revue-book.js) produit,
-- pour chaque mannequin, un rapport détaillé (points forts, points à améliorer)
-- et une fiche technique (les photos à refaire, comment les faire), ainsi
-- qu'un message prêt à envoyer au mannequin par WhatsApp.
--  1) table revues_book : le dernier rapport de chaque mannequin, lisible et
--     modifiable par les seuls admins (écrit par la fonction serveur) ;
--  2) contacts_mannequins_admin() : le numéro de téléphone des mannequins,
--     pour le bouton « Envoyer par WhatsApp » — réservé aux admins (le numéro
--     reste invisible pour tous les autres, Extensions 10 et 26) ;
--  3) un numéro fixe sur chaque photo (voir plus bas).
-- =====================================================================
create table if not exists revues_book (
  model_id uuid primary key references model_profiles(id) on delete cascade,
  rapport jsonb not null,
  revu_le timestamptz not null default now(),
  envoye_le timestamptz
);
alter table revues_book enable row level security;
drop policy if exists "Les admins gèrent les revues de book" on revues_book;
create policy "Les admins gèrent les revues de book"
  on revues_book for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create or replace function contacts_mannequins_admin()
returns table(model_id uuid, phone text)
language sql stable security definer
set search_path = public
as $$
  select id, phone from model_profiles
  where exists (select 1 from admins where user_id = auth.uid());
$$;
revoke all on function contacts_mannequins_admin() from public;
grant execute on function contacts_mannequins_admin() to authenticated;

-- 3) Numéro fixe pour chaque photo (N° 1, 2, 3… dans l'ordre d'envoi, par
--    mannequin), affiché dans l'Espace mannequin et le tableau de bord, et
--    utilisé dans les rapports : « la photo n° 12 ». Le numéro ne change jamais,
--    même quand d'autres photos sont supprimées.
alter table model_photos add column if not exists numero int;
update model_photos m set numero = t.n
from (select id, row_number() over (partition by model_id order by created_at, id) as n from model_photos) t
where m.id = t.id and m.numero is null;

create or replace function numeroter_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext(NEW.model_id::text));
    select coalesce(max(numero), 0) + 1 into NEW.numero from model_photos where model_id = NEW.model_id;
  else
    NEW.numero := OLD.numero;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_numeroter_photo on model_photos;
create trigger trg_numeroter_photo
  before insert or update on model_photos
  for each row execute function numeroter_photo();

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 118 — Adresses lisibles des fiches (demande de la propriétaire,
-- 06/10/2026) : …/book/roxane-ouattara au lieu de …/mannequin?id=077ac8a8-….
--  1) colonne slug : le nom d'adresse de chaque mannequin, unique, fabriqué
--     à partir de son nom (accents retirés, tirets), « -2 », « -3 »… en cas
--     d'homonyme ; il ne change plus ensuite (les liens partagés restent bons),
--     seul un admin peut le modifier ;
--  2) lisible par les visiteurs (comme le nom) ;
--  3) rattrapage des mannequins déjà inscrites (déclencheur de protection du
--     profil suspendu le temps de cette seule mise à jour, comme l'Extension 115).
-- Les anciennes adresses avec le numéro continuent de fonctionner.
-- =====================================================================
alter table model_profiles add column if not exists slug text;
create unique index if not exists model_profiles_slug_unique on model_profiles (slug);

create or replace function slug_depuis_nom(nom text)
returns text
language sql immutable
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(nom, '')),
      'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ’''',
      'aaaaaaceeeeiiiinooooouuuuyyoa--'),
    '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function attribuer_slug_mannequin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidat text;
  n int := 1;
begin
  -- Seuls un admin ou le serveur choisissent un nom d'adresse ; une mannequin ne
  -- peut ni le choisir ni le changer (il est fabriqué à partir de son nom, puis fixe).
  if auth.uid() is not null and not exists (select 1 from admins where user_id = auth.uid()) then
    if TG_OP = 'INSERT' then NEW.slug := null; else NEW.slug := OLD.slug; end if;
  elsif NEW.slug is not null then
    NEW.slug := left(slug_depuis_nom(NEW.slug), 60);  -- toujours au bon format
  end if;
  if coalesce(length(NEW.slug), 0) = 0 and length(trim(coalesce(NEW.full_name, ''))) > 0 then
    base := left(slug_depuis_nom(NEW.full_name), 60);
    if length(base) = 0 then return NEW; end if;
    candidat := base;
    while exists (select 1 from model_profiles where slug = candidat and id <> NEW.id) loop
      n := n + 1;
      candidat := base || '-' || n;
    end loop;
    NEW.slug := candidat;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_attribuer_slug_mannequin on model_profiles;
create trigger trg_attribuer_slug_mannequin
  before insert or update on model_profiles
  for each row execute function attribuer_slug_mannequin();

grant select (slug) on model_profiles to anon;

begin;
alter table model_profiles disable trigger trg_proteger_proprietaire_profil;
-- une ligne à la fois, dans l'ordre d'inscription : la plus ancienne garde le nom sans numéro
do $$
declare r record;
begin
  for r in select id from model_profiles where slug is null and coalesce(trim(full_name), '') <> '' order by created_at, id loop
    update model_profiles set slug = null where id = r.id;
  end loop;
end $$;
alter table model_profiles enable trigger trg_proteger_proprietaire_profil;
commit;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 119 — Profils dépubliés par les mises à jour de la base
-- (signalé par la propriétaire le 06/10/2026 : Mélina et Enoa repassaient
-- « en attente de validation » après chaque grosse modification). Cause : le
-- déclencheur gerer_validation_publication() (Extension 60) traitait TOUTE
-- mise à jour d'un profil publié comme une demande de publication par le
-- mannequin ; pour un mannequin mineur, ou dont la première publication n'a
-- jamais été marquée, il remettait la fiche en attente — y compris lors des
-- mises à jour faites par l'agence dans l'éditeur SQL (Extensions 115, 118).
-- Correctif : sans utilisateur connecté (éditeur SQL, serveur), le
-- déclencheur ne touche plus à la publication. Exécutée le 06/10/2026.
-- =====================================================================
create or replace function gerer_validation_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  est_admin boolean;
  age_ans int;
  est_mineur boolean := false;
begin
  if auth.uid() is null then
    return NEW;
  end if;

  select exists(select 1 from admins where user_id = auth.uid()) into est_admin;

  if NEW.date_naissance is not null then
    age_ans := extract(year from age(NEW.date_naissance));
    est_mineur := age_ans < 18;
  end if;

  if NEW.published is true then
    if est_admin then
      NEW.en_attente_validation := false;
      NEW.premiere_publication_faite := true;
    elsif est_mineur or not coalesce(OLD.premiere_publication_faite, false) then
      NEW.published := false;
      NEW.en_attente_validation := true;
    end if;
  end if;

  return NEW;
end;
$$;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 120 — Fiche événement (demande de la propriétaire, 06/10/2026) :
-- les mannequins complètent dans leur Espace des informations utiles aux
-- organisateurs de défilés (taille haut / bas, régime et allergies, TikTok,
-- Facebook, droit à l'image) ; seule l'agence télécharge, depuis le tableau de
-- bord, une fiche PDF complète (identité, contacts, mensurations, réseaux).
-- Jamais de pièce d'identité. Ces informations ne sont jamais publiques :
--  1) table fiche_evenement à part (pas dans model_profiles, lisible par tous
--     les comptes connectés) : chaque mannequin lit et modifie SA ligne, les
--     admins toutes ;
--  2) fiche_evenement_admin(id) : toutes les données de la fiche en une fois
--     (téléphone et e-mail compris), réservée aux admins.
-- =====================================================================
create table if not exists fiche_evenement (
  model_id uuid primary key references model_profiles(id) on delete cascade,
  taille_haut text,
  taille_bas text,
  regime_allergies text,
  tiktok text,
  facebook text,
  droit_image boolean,
  mis_a_jour timestamptz not null default now()
);
alter table fiche_evenement enable row level security;
drop policy if exists "Le mannequin gère sa fiche événement" on fiche_evenement;
create policy "Le mannequin gère sa fiche événement"
  on fiche_evenement for all
  using (model_id = auth.uid() or exists (select 1 from admins where user_id = auth.uid()))
  with check (model_id = auth.uid() or exists (select 1 from admins where user_id = auth.uid()));
revoke all on fiche_evenement from anon;

create or replace function fiche_evenement_admin(id_mannequin uuid)
returns json
language sql stable security definer
set search_path = public
as $$
  select case when exists (select 1 from admins where user_id = auth.uid()) then
    json_build_object(
      'full_name', p.full_name, 'category', p.category,
      'age', case when p.date_naissance is null then null else extract(year from age(current_date, p.date_naissance))::int end,
      'nationalite', p.nationalite, 'phone', p.phone, 'email', p.contact_email,
      'city', p.city, 'quartier', p.quartier,
      'height_cm', p.height_cm, 'weight_kg', p.weight_kg, 'chest_cm', p.chest_cm, 'waist_cm', p.waist_cm,
      'hips_cm', p.hips_cm, 'inseam_cm', p.inseam_cm, 'shoe_size', p.shoe_size, 'clothing_size', p.clothing_size,
      'eye_color', p.eye_color, 'hair_color', p.hair_color, 'instagram', p.instagram, 'slug', p.slug,
      'taille_haut', f.taille_haut, 'taille_bas', f.taille_bas, 'regime_allergies', f.regime_allergies,
      'tiktok', f.tiktok, 'facebook', f.facebook, 'droit_image', f.droit_image, 'mis_a_jour', f.mis_a_jour
    )
  end
  from model_profiles p left join fiche_evenement f on f.model_id = p.id
  where p.id = id_mannequin;
$$;
revoke all on function fiche_evenement_admin(uuid) from public;
grant execute on function fiche_evenement_admin(uuid) to authenticated;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 121 — Mensurations complètes (demande de la propriétaire,
-- 06/10/2026) : largeur d'épaules, longueur de bras, tour de cou (hommes) et
-- tour de tête, en plus des mesures existantes. Publiques comme les autres
-- mensurations (utiles aux recruteurs). Les tailles (haut, bas, générale,
-- chemise, costume) et leurs équivalences internationales sont CALCULÉES à
-- partir des mensurations (js/tailles.js), jamais saisies : toujours cohérentes.
-- =====================================================================
alter table model_profiles add column if not exists shoulder_cm int;
alter table model_profiles add column if not exists arm_cm int;
alter table model_profiles add column if not exists neck_cm int;
alter table model_profiles add column if not exists head_cm int;
grant select (shoulder_cm, arm_cm, neck_cm, head_cm) on model_profiles to anon;

-- Fiche événement : les nouvelles mensurations en plus ; le téléphone et l'e-mail du
-- mannequin ne sont plus transmis (la fiche n'affiche que les contacts de l'agence).
create or replace function fiche_evenement_admin(id_mannequin uuid)
returns json
language sql stable security definer
set search_path = public
as $$
  select case when exists (select 1 from admins where user_id = auth.uid()) then
    json_build_object(
      'full_name', p.full_name, 'category', p.category,
      'age', case when p.date_naissance is null then null else extract(year from age(current_date, p.date_naissance))::int end,
      'nationalite', p.nationalite, 'city', p.city, 'quartier', p.quartier,
      'height_cm', p.height_cm, 'weight_kg', p.weight_kg, 'chest_cm', p.chest_cm, 'waist_cm', p.waist_cm,
      'hips_cm', p.hips_cm, 'inseam_cm', p.inseam_cm, 'shoe_size', p.shoe_size, 'clothing_size', p.clothing_size,
      'shoulder_cm', p.shoulder_cm, 'arm_cm', p.arm_cm, 'neck_cm', p.neck_cm, 'head_cm', p.head_cm,
      'eye_color', p.eye_color, 'hair_color', p.hair_color, 'instagram', p.instagram, 'slug', p.slug,
      'regime_allergies', f.regime_allergies, 'tiktok', f.tiktok, 'facebook', f.facebook,
      'droit_image', f.droit_image, 'mis_a_jour', f.mis_a_jour
    )
  end
  from model_profiles p left join fiche_evenement f on f.model_id = p.id
  where p.id = id_mannequin;
$$;
revoke all on function fiche_evenement_admin(uuid) from public;
grant execute on function fiche_evenement_admin(uuid) to authenticated;

-- Mesures incohérentes (décision de la propriétaire, 06/10/2026) : si le haut et le
-- bas ne vont pas ensemble, la fiche publique cache les mensurations (site) ; sans
-- correction sous 7 jours, la fiche est mise en sourdine (invisible du public) ;
-- dès que la mannequin corrige, tout revient automatiquement.
-- MÊME BARÈME ET MÊME RÈGLE que js/tailles.js (à modifier aux deux endroits) :
-- rang 0 = XXS … 7 = XXXL ; femmes : haut = poitrine, bas = hanches, le bas peut
-- dépasser le haut de 2 tailles (morphologies africaines), l'inverse de 1 ;
-- hommes : haut = poitrine, bas = tour de taille, le haut peut dépasser le bas de
-- 2 tailles (silhouette athlétique), l'inverse de 1.
alter table model_profiles add column if not exists mesures_a_reprendre_depuis timestamptz;

create or replace function rang_taille(mesure numeric, bornes int[])
returns int language sql immutable as $$
  select case when mesure is null or mesure <= 0 then null
    else (select count(*) from unnest(bornes) b where round(mesure) > b)::int end;
$$;

create or replace function mesures_incoherentes(categorie text, poitrine numeric, tour_taille numeric, hanches numeric)
returns boolean language sql immutable as $$
  select case when categorie = 'homme' then
    coalesce((rang_taille(tour_taille, array[67,72,77,83,89,95,101])
            - rang_taille(poitrine, array[81,87,93,99,105,111,117])) not between -2 and 1, false)
  else
    coalesce((rang_taille(hanches, array[85,89,93,97,101,107,113])
            - rang_taille(poitrine, array[77,81,85,89,93,99,105])) not between -1 and 2, false)
  end;
$$;

-- Date de début du problème : posée par la base, jamais par la mannequin (elle ne
-- peut ni l'effacer ni la repousser) ; effacée dès que les mesures sont cohérentes.
create or replace function suivre_mesures_a_reprendre()
returns trigger language plpgsql as $$
begin
  if mesures_incoherentes(new.category, new.chest_cm, new.waist_cm, new.hips_cm) then
    new.mesures_a_reprendre_depuis := case when tg_op = 'UPDATE' then coalesce(old.mesures_a_reprendre_depuis, now()) else now() end;
  else
    new.mesures_a_reprendre_depuis := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_suivre_mesures_a_reprendre on model_profiles;
create trigger trg_suivre_mesures_a_reprendre
  before insert or update on model_profiles
  for each row execute function suivre_mesures_a_reprendre();

-- Profils actuels : le délai de 7 jours démarre aujourd'hui. Le déclencheur
-- proteger_proprietaire_profil refuse les modifications faites depuis l'éditeur SQL :
-- suspendu le temps de cette seule mise à jour, dans une transaction (même méthode
-- que pour les noms d'adresse, Extension 118).
begin;
alter table model_profiles disable trigger trg_proteger_proprietaire_profil;
update model_profiles set mesures_a_reprendre_depuis = now()
where mesures_incoherentes(category, chest_cm, waist_cm, hips_cm) and mesures_a_reprendre_depuis is null;
alter table model_profiles enable trigger trg_proteger_proprietaire_profil;
commit;

-- Visibilité publique : publiée ET pas en sourdine (mesures à reprendre depuis plus
-- de 7 jours). La mannequin voit toujours sa fiche (sa propre règle) ; les admins aussi.
drop policy if exists "Profils publiés visibles de tous" on model_profiles;
create policy "Profils publiés visibles de tous"
  on model_profiles for select
  using (published = true and (mesures_a_reprendre_depuis is null or mesures_a_reprendre_depuis > now() - interval '7 days'));

NOTIFY pgrst, 'reload schema';

-- Vérification (résultat affiché) : les règles de lecture des profils, pour
-- s'assurer qu'aucune autre règle ne laisse voir une fiche en sourdine.
select policyname, cmd, roles, qual from pg_policies
where tablename = 'model_profiles' and cmd in ('SELECT', 'ALL') order by policyname;

-- =====================================================================
-- Extension 122 — Sauvegarde des photos des mannequins sur Google Drive
-- (décision de la propriétaire, 06/10/2026). Un script Google Apps Script,
-- installé dans SON compte Google, demande chaque heure la liste des photos et
-- copie les nouvelles dans son Drive (rien n'est jamais effacé du Drive).
-- La liste n'est donnée qu'avec la clé secrète créée ci-dessous : la base n'en
-- garde que l'empreinte (sha256) ; la clé s'affiche UNE fois, à coller
-- directement dans le script Google (jamais dans une conversation). Relancer
-- ce bloc crée une nouvelle clé et annule l'ancienne.
-- =====================================================================
create table if not exists cle_sauvegarde_photos (
  id int primary key default 1 check (id = 1),
  cle_empreinte text not null,
  cree_le timestamptz not null default now()
);
alter table cle_sauvegarde_photos enable row level security;
revoke all on cle_sauvegarde_photos from anon, authenticated;

create or replace function photos_a_sauvegarder(cle text)
returns table(mannequin text, model_id uuid, photo_id uuid, numero int, url text, ajoutee_le timestamptz)
language plpgsql stable security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if cle is null or length(cle) < 32 or not exists (
    select 1 from cle_sauvegarde_photos c where c.cle_empreinte = encode(sha256(convert_to(cle, 'UTF8')), 'hex')
  ) then
    raise exception 'Clé de sauvegarde invalide';
  end if;
  return query
    select coalesce(nullif(trim(p.full_name), ''), 'Sans nom'), ph.model_id, ph.id, ph.numero, ph.url, ph.created_at
    from model_photos ph left join model_profiles p on p.id = ph.model_id
    where ph.url is not null
    order by ph.created_at;
end;
$$;
revoke all on function photos_a_sauvegarder(text) from public;
grant execute on function photos_a_sauvegarder(text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Nouvelle clé (affichée une seule fois dans le résultat ci-dessous).
with nouvelle as (
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as cle
), enregistree as (
  insert into cle_sauvegarde_photos (id, cle_empreinte)
  select 1, encode(sha256(convert_to(cle, 'UTF8')), 'hex') from nouvelle
  on conflict (id) do update set cle_empreinte = excluded.cle_empreinte, cree_le = now()
  returning 1
)
select nouvelle.cle as "Clé à coller dans le script Google" from nouvelle, enregistree;

-- =====================================================================
-- Extension 123 — Grille des mensurations MA2M (décision de la propriétaire,
-- 06/10/2026, soir) : nouvelles bornes de tailles, les mêmes que js/tailles.js
-- (femmes : poitrine XS 78–83, S 84–87, M 88–93, L 94–100 ; bassin XS 84–89,
-- S 90–93, M 94–99, L 100–106 — hommes : poitrine XS 86–91, S 92–95, M 96–101,
-- L 102–108 ; taille XS 68–73, S 74–77, M 78–83, L 84–90 ; au-delà, pas de 6 cm).
-- La règle de cohérence (écarts admis) ne change pas. Les dates « mesures à
-- reprendre » sont recalculées pour tous les profils avec la nouvelle grille.
-- =====================================================================
create or replace function mesures_incoherentes(categorie text, poitrine numeric, tour_taille numeric, hanches numeric)
returns boolean language sql immutable as $$
  select case when categorie = 'homme' then
    coalesce((rang_taille(tour_taille, array[67,73,77,83,90,96,102])
            - rang_taille(poitrine, array[85,91,95,101,108,114,120])) not between -2 and 1, false)
  else
    coalesce((rang_taille(hanches, array[83,89,93,99,106,112,118])
            - rang_taille(poitrine, array[77,83,87,93,100,106,112])) not between -1 and 2, false)
  end;
$$;

begin;
alter table model_profiles disable trigger trg_proteger_proprietaire_profil;
update model_profiles set mesures_a_reprendre_depuis =
  case when mesures_incoherentes(category, chest_cm, waist_cm, hips_cm) then coalesce(mesures_a_reprendre_depuis, now()) else null end
where (mesures_a_reprendre_depuis is not null) <> mesures_incoherentes(category, chest_cm, waist_cm, hips_cm);
alter table model_profiles enable trigger trg_proteger_proprietaire_profil;
commit;

-- Vérification (résultat affiché) : les mannequins dont les mesures sont à reprendre.
select full_name, mesures_a_reprendre_depuis from model_profiles
where mesures_a_reprendre_depuis is not null order by full_name;

-- =====================================================================
-- Extension 124 — Agenda MA2M (idée de la propriétaire, 06/10/2026) :
-- le programme de l'agence (shootings, défilés, castings, formations,
-- événements) saisi dans le tableau de bord et montré aux clients sur le
-- site. Sécurité : la table n'est lisible que par les admins ; le public
-- passe par agenda_public(), qui ne renvoie JAMAIS l'adresse, l'heure ni
-- les notes internes (personne ne doit savoir où trouver une mannequin à
-- un moment précis), et ne cite que les mannequins dont le profil est
-- visible sur le site (mêmes règles que le Book).
-- =====================================================================
create table if not exists agenda_projets (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'shooting'
    check (type in ('shooting', 'defile', 'casting', 'formation', 'evenement', 'autre')),
  titre text not null check (length(trim(titre)) between 1 and 160),
  date_debut date not null,
  date_fin date check (date_fin is null or date_fin >= date_debut),
  ville text check (ville is null or length(ville) <= 80),
  description text check (description is null or length(description) <= 1200),
  photographe text check (photographe is null or length(photographe) <= 120),
  partenaire_ids uuid[] not null default '{}',
  mannequin_ids uuid[] not null default '{}',
  visible boolean not null default true,
  -- informations internes, jamais montrées au public
  adresse text check (adresse is null or length(adresse) <= 300),
  heure text check (heure is null or length(heure) <= 40),
  notes_internes text check (notes_internes is null or length(notes_internes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table agenda_projets enable row level security;
create index if not exists agenda_projets_date_idx on agenda_projets (date_debut);

drop policy if exists "Agenda : admins seulement" on agenda_projets;
create policy "Agenda : admins seulement"
  on agenda_projets for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));
revoke all on agenda_projets from anon;

-- Règle unique « profil visible du public » (publié, et pas en sourdine depuis plus de
-- 7 jours pour mesures à reprendre) : utilisée par la règle de lecture du Book ET par
-- l'agenda public, pour qu'elles ne puissent jamais diverger.
create or replace function profil_visible_public(publie boolean, a_reprendre_depuis timestamptz)
returns boolean language sql stable as $$
  select coalesce(publie, false) and (a_reprendre_depuis is null or a_reprendre_depuis > now() - interval '7 days');
$$;
drop policy if exists "Profils publiés visibles de tous" on model_profiles;
create policy "Profils publiés visibles de tous"
  on model_profiles for select
  using (profil_visible_public(published, mesures_a_reprendre_depuis));

-- Version publique : projets visibles des 12 derniers mois et à venir, par date.
-- seulement_a_venir + limite : pour l'encart de l'accueil (3 prochains projets).
drop function if exists agenda_public();
create or replace function agenda_public(seulement_a_venir boolean default false, limite int default 300)
returns table(
  id uuid, type text, titre text, date_debut date, date_fin date, ville text,
  description text, photographe text, partenaires jsonb, mannequins jsonb
)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.type, a.titre, a.date_debut, a.date_fin, a.ville, a.description, a.photographe,
    coalesce((select jsonb_agg(jsonb_build_object('id', pa.id, 'nom', pa.nom, 'logo_url', pa.logo_url) order by pa.nom)
              from partenaires pa where pa.id = any(a.partenaire_ids)), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nom', p.full_name, 'slug', p.slug) order by p.full_name)
              from model_profiles p
              where p.id = any(a.mannequin_ids)
                and profil_visible_public(p.published, p.mesures_a_reprendre_depuis)), '[]'::jsonb)
  from agenda_projets a
  where a.visible
    and coalesce(a.date_fin, a.date_debut) >= case when seulement_a_venir then current_date
                                                  else current_date - interval '12 months' end
  order by a.date_debut
  limit least(greatest(coalesce(limite, 300), 1), 300);
$$;
revoke all on function agenda_public(boolean, int) from public;
grant execute on function agenda_public(boolean, int) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 125 — Agenda généraliste (demande de la propriétaire, 06/10/2026) :
--  - plus de types de projet (show, essayages, masterclass, rencontre…) ;
--  - « intervenants » libres (rôle + nom : photographe, chorégraphe, styliste…)
--    à la place du seul « photographe » (les photographes déjà saisis sont repris) ;
--  - lieu visible (ex. « Noom Hôtel »), l'adresse exacte restant interne ;
--  - horaires jour par jour (une activité sur plusieurs jours peut avoir des heures
--    différentes chaque jour), montrés sur le site seulement si la case
--    « horaires visibles » est cochée pour ce projet.
-- =====================================================================
alter table agenda_projets add column if not exists lieu text check (lieu is null or length(lieu) <= 160);
alter table agenda_projets add column if not exists intervenants jsonb not null default '[]'::jsonb
  check (jsonb_typeof(intervenants) = 'array' and jsonb_array_length(intervenants) <= 30);
alter table agenda_projets add column if not exists seances jsonb not null default '[]'::jsonb
  check (jsonb_typeof(seances) = 'array' and jsonb_array_length(seances) <= 60);
alter table agenda_projets add column if not exists horaires_publics boolean not null default false;

alter table agenda_projets drop constraint if exists agenda_projets_type_check;
alter table agenda_projets add constraint agenda_projets_type_check check (type in (
  'shooting', 'defile', 'show', 'casting', 'essayage', 'masterclass', 'formation', 'rencontre', 'evenement', 'autre'));

update agenda_projets
set intervenants = jsonb_build_array(jsonb_build_object('role', 'Photographe', 'nom', photographe))
where photographe is not null and trim(photographe) <> '' and intervenants = '[]'::jsonb;

drop function if exists agenda_public();
drop function if exists agenda_public(boolean, int);
create or replace function agenda_public(seulement_a_venir boolean default false, limite int default 300)
returns table(
  id uuid, type text, titre text, date_debut date, date_fin date, ville text, lieu text,
  description text, intervenants jsonb, seances jsonb, partenaires jsonb, mannequins jsonb
)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.type, a.titre, a.date_debut, a.date_fin, a.ville, a.lieu, a.description,
    a.intervenants,
    case when a.horaires_publics then a.seances else '[]'::jsonb end,
    coalesce((select jsonb_agg(jsonb_build_object('id', pa.id, 'nom', pa.nom, 'logo_url', pa.logo_url) order by pa.nom)
              from partenaires pa where pa.id = any(a.partenaire_ids)), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nom', p.full_name, 'slug', p.slug) order by p.full_name)
              from model_profiles p
              where p.id = any(a.mannequin_ids)
                and profil_visible_public(p.published, p.mesures_a_reprendre_depuis)), '[]'::jsonb)
  from agenda_projets a
  where a.visible
    and coalesce(a.date_fin, a.date_debut) >= case when seulement_a_venir then current_date
                                                  else current_date - interval '12 months' end
  order by a.date_debut
  limit least(greatest(coalesce(limite, 300), 1), 300);
$$;
revoke all on function agenda_public(boolean, int) from public;
grant execute on function agenda_public(boolean, int) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 126 — Instagram obligatoire dans l'Espace mannequin (décision de la
-- propriétaire, 07/10/2026) : chaque mannequin indique son compte Instagram, ou
-- coche « Je n'ai pas Instagram » (enregistré ici). Pas d'accès anonyme (anon) ;
-- comme les autres colonnes de model_profiles, lisible par les comptes connectés. Le tour de tête n'est plus demandé ni affiché ; la
-- colonne head_cm est gardée telle quelle (aucune donnée effacée).
-- =====================================================================
alter table model_profiles add column if not exists sans_instagram boolean not null default false;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 127 — Deux catégories de photos, classées par le site SANS IA (décision de
-- la propriétaire, 07/10/2026) : « book » (photos professionnelles : appareil photo
-- ou retouche pro) et « lifestyle » (photos de téléphone, polaroïds, sorties). La
-- catégorie est décidée à l'envoi d'après les informations de l'appareil (EXIF, voir
-- categoriePhoto dans js/app.js) ; en cas de doute : book. Toutes les photos déjà en
-- ligne sont rangées dans le Book (rien n'est supprimé ni caché). La mannequin (ses
-- photos) et l'agence peuvent changer la catégorie d'un clic.
-- =====================================================================
alter table model_photos add column if not exists categorie text not null default 'book'
  check (categorie in ('book', 'lifestyle'));
-- Photos que l'agence avait elle-même rangées dans les Digitals (choix manuel) : gardées.
update model_photos set categorie = 'lifestyle' where tri_statut = 'digital' and tri_manuel = true;

NOTIFY pgrst, 'reload schema';

-- ===================================================================
-- Extension 128 — Catégorie des photos : une mannequin peut passer une photo du Book vers
-- Lifestyle, jamais l'inverse ; seule l'agence (admin) remet une photo dans le Book
-- (décision de la propriétaire, 07/10/2026 : éviter qu'une mannequin « gonfle » son Book).
-- Une photo envoyée par la mannequin garde la catégorie décidée par le site (EXIF).
-- =====================================================================
create or replace function proteger_categorie_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or exists (select 1 from admins where user_id = auth.uid()) then
    return NEW;
  end if;
  if OLD.categorie = 'lifestyle' and NEW.categorie = 'book' then
    NEW.categorie := 'lifestyle';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_proteger_categorie_photo on model_photos;
create trigger trg_proteger_categorie_photo
  before update of categorie on model_photos
  for each row execute function proteger_categorie_photo();

-- =====================================================================
-- Extension 129 — L'e-mail partout, et les contacts du parent pour les mineurs
-- (décision de la propriétaire, 07/10/2026 : « on doit habituer les mannequins au
-- mail » ; pour un mineur, ce sont l'e-mail et le WhatsApp du parent).
--  1) Inscription mannequin : l'e-mail est désormais demandé dans le formulaire
--     (la colonne inscriptions_mannequins.email existait déjà, Extension 7).
--  2) Candidatures et inscriptions : e-mail du parent / tuteur (le téléphone du
--     parent existait déjà : parent_telephone, désormais son WhatsApp).
--  3) Espace mannequin : une mannequin mineure garde ses propres contacts, et on
--     ajoute le nom, le WhatsApp et l'e-mail de son parent, dans une TABLE À PART
--     (contacts_parents) et non dans model_profiles : les droits « colonne par
--     colonne » de model_profiles ne suffisent pas à cacher une colonne aux comptes
--     connectés (ils ont la lecture de toute la table). Ici, la règle est simple :
--     chaque mannequin ne voit et ne modifie QUE sa ligne ; l'agence voit tout.
-- =====================================================================
alter table casting_applications add column if not exists parent_email text;
alter table inscriptions_mannequins add column if not exists parent_email text;

create table if not exists contacts_parents (
  model_id uuid primary key references model_profiles(id) on delete cascade,
  parent_nom text,
  parent_telephone text,
  parent_email text,
  mis_a_jour timestamptz not null default now()
);
alter table contacts_parents enable row level security;
revoke all on contacts_parents from anon;
drop policy if exists "La mannequin gère le contact de son parent" on contacts_parents;
create policy "La mannequin gère le contact de son parent"
  on contacts_parents for all
  using (model_id = auth.uid() or exists (select 1 from admins where user_id = auth.uid()))
  with check (model_id = auth.uid() or exists (select 1 from admins where user_id = auth.uid()));

-- Le dossier d'inscription reçoit l'e-mail et l'e-mail du parent.
drop function if exists soumettre_inscription_mannequin(text, text, date, text, int, text, text, text, text, text);
create or replace function soumettre_inscription_mannequin(
  p_code text,
  p_full_name text,
  p_date_naissance date,
  p_genre text,
  p_height_cm int,
  p_clothing_size text,
  p_phone text,
  p_reference_paiement text,
  p_parent_nom text default null,
  p_parent_telephone text default null,
  p_email text default null,
  p_parent_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_lignes int;
  nouvel_id uuid;
begin
  update codes_inscription set utilise = true, utilise_le = now()
  where code = p_code and utilise = false;
  get diagnostics nb_lignes = row_count;
  if nb_lignes = 0 then
    raise exception 'code_invalide_ou_deja_utilise';
  end if;

  insert into inscriptions_mannequins
    (full_name, date_naissance, genre, height_cm, clothing_size, phone, code_utilise, reference_paiement, parent_nom, parent_telephone, email, parent_email)
  values
    (p_full_name, p_date_naissance, p_genre, p_height_cm, p_clothing_size, p_phone, p_code, nullif(p_reference_paiement, ''), p_parent_nom, p_parent_telephone,
     nullif(lower(trim(p_email)), ''), nullif(lower(trim(p_parent_email)), ''))
  returning id into nouvel_id;

  return nouvel_id;
end;
$$;
revoke all on function soumettre_inscription_mannequin(text, text, date, text, int, text, text, text, text, text, text, text) from public;
grant execute on function soumettre_inscription_mannequin(text, text, date, text, int, text, text, text, text, text, text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 130 — Téléphone et e-mail des mannequins VRAIMENT verrouillés
-- (demande de la propriétaire, 07/10/2026 : « aucun élément ne doit être visible pour
-- quelqu'un qui fait un appel »).
-- Faille : les Extensions 10 et 26 retiraient la lecture de phone / contact_email
-- « colonne par colonne », mais le rôle authenticated (tout compte connecté :
-- mannequin, recruteur…) gardait la lecture de TOUTE la table, ce qui annule un retrait
-- colonne par colonne. Avec la règle « Profils publiés visibles de tous », un compte
-- connecté pouvait donc lire le téléphone et l'e-mail privés de toutes les mannequins
-- publiées en interrogeant la base directement.
-- Correction : on retire la lecture de la table entière à authenticated et on lui rend
-- toutes les colonnes SAUF phone et contact_email (liste calculée automatiquement).
-- La mannequin lit les siens par mon_contact_prive(), l'agence par
-- contacts_mannequins_admin() / fiche_evenement_admin() (fonctions sécurisées).
-- ⚠️ Toute NOUVELLE colonne de model_profiles doit ensuite être ouverte à la lecture :
--    grant select (nouvelle_colonne) on model_profiles to authenticated;
--    (et to anon si elle s'affiche sur les pages publiques) — ou relancer ce bloc.
-- =====================================================================
do $$
declare colonnes text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into colonnes
  from information_schema.columns
  where table_schema = 'public' and table_name = 'model_profiles'
    and column_name not in ('phone', 'contact_email');
  execute 'revoke select on model_profiles from authenticated';
  execute format('grant select (%s) on model_profiles to authenticated', colonnes);
end $$;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 131 — Toutes les informations personnelles des mannequins verrouillées
-- (décision de la propriétaire, 07/10/2026 : « tout ce qui est information personnelle
-- doit être verrouillé » ; les administrateurs gardent l'accès pour envoyer les messages).
-- Comme pour le téléphone et l'e-mail (Extension 130), un compte connecté (autre
-- mannequin, recruteur…) ne peut plus lire directement : date de naissance, ville et
-- pays de naissance, nationalité, quartier, établissement scolaire, commentaire de refus.
-- La mannequin (sa propre fiche) et l'agence les obtiennent par profils_prives().
-- (Les visiteurs non connectés ne les ont jamais eus : Extension 47.)
-- ⚠️ Même règle qu'en Extension 130 pour toute NOUVELLE colonne de model_profiles.
-- =====================================================================
create or replace function profils_prives(ids uuid[] default null)
returns table(id uuid, date_naissance date, ville_naissance text, lieu_naissance text, nationalite text,
              quartier text, raison_refus text, etablissement text)
language sql stable security definer
set search_path = public
as $$
  select p.id, p.date_naissance, p.ville_naissance, p.lieu_naissance, p.nationalite, p.quartier, p.raison_refus, p.etablissement
  from model_profiles p
  where (p.id = auth.uid() or exists (select 1 from admins where user_id = auth.uid()))
    and (ids is null or p.id = any(ids));
$$;
revoke all on function profils_prives(uuid[]) from public;
grant execute on function profils_prives(uuid[]) to authenticated;

do $$
declare colonnes text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into colonnes
  from information_schema.columns
  where table_schema = 'public' and table_name = 'model_profiles'
    and column_name not in ('phone', 'contact_email', 'date_naissance', 'ville_naissance', 'lieu_naissance',
                            'nationalite', 'quartier', 'raison_refus', 'etablissement');
  execute 'revoke select on model_profiles from authenticated';
  execute format('grant select (%s) on model_profiles to authenticated', colonnes);
end $$;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Extension 132 — Civilité choisie par la candidate (décision de la propriétaire,
-- 07/10/2026 : « être professionnel ») : Madame ou Mademoiselle pour une femme,
-- Monsieur pour un homme. Les messages commencent par « Bonjour Madame Awa Koné ».
-- =====================================================================
alter table casting_applications add column if not exists civilite text;
alter table inscriptions_mannequins add column if not exists civilite text;

drop function if exists soumettre_inscription_mannequin(text, text, date, text, int, text, text, text, text, text, text, text);
create or replace function soumettre_inscription_mannequin(
  p_code text,
  p_full_name text,
  p_date_naissance date,
  p_genre text,
  p_height_cm int,
  p_clothing_size text,
  p_phone text,
  p_reference_paiement text,
  p_parent_nom text default null,
  p_parent_telephone text default null,
  p_email text default null,
  p_parent_email text default null,
  p_civilite text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_lignes int;
  nouvel_id uuid;
begin
  update codes_inscription set utilise = true, utilise_le = now()
  where code = p_code and utilise = false;
  get diagnostics nb_lignes = row_count;
  if nb_lignes = 0 then
    raise exception 'code_invalide_ou_deja_utilise';
  end if;

  insert into inscriptions_mannequins
    (full_name, date_naissance, genre, height_cm, clothing_size, phone, code_utilise, reference_paiement, parent_nom, parent_telephone, email, parent_email, civilite)
  values
    (p_full_name, p_date_naissance, p_genre, p_height_cm, p_clothing_size, p_phone, p_code, nullif(p_reference_paiement, ''), p_parent_nom, p_parent_telephone,
     nullif(lower(trim(p_email)), ''), nullif(lower(trim(p_parent_email)), ''),
     case when p_civilite in ('Madame', 'Mademoiselle', 'Monsieur') then p_civilite end)
  returning id into nouvel_id;

  return nouvel_id;
end;
$$;
revoke all on function soumettre_inscription_mannequin(text, text, date, text, int, text, text, text, text, text, text, text, text) from public;
grant execute on function soumettre_inscription_mannequin(text, text, date, text, int, text, text, text, text, text, text, text, text) to anon, authenticated;

NOTIFY pgrst, 'reload schema';
