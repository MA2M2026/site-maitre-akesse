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
