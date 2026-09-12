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
revoke all on function stats_visites_reelles_site from public;
grant execute on function stats_visites_reelles_site to authenticated;

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
revoke all on function stats_classement_mannequins from public;
grant execute on function stats_classement_mannequins to authenticated;

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
