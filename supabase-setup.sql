-- ===================================================================
-- Maître Akesse Model Management — Configuration Supabase
-- À copier-coller intégralement dans Supabase > SQL Editor > New query
-- puis cliquer sur "Run".
-- ===================================================================

-- 1. Table des codes d'invitation (donnés par l'agence aux mannequins)
create table if not exists invite_codes (
  code text primary key,
  used boolean not null default false,
  used_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 2. Table des profils mannequins
create table if not exists model_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  bio text,
  height_cm int,
  city text,
  instagram text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3. Table des photos des mannequins
create table if not exists model_photos (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references model_profiles(id) on delete cascade,
  url text not null,
  chemin text,
  created_at timestamptz not null default now()
);

-- 4. Bucket de stockage pour les photos (public en lecture)
insert into storage.buckets (id, name, public)
values ('model-photos', 'model-photos', true)
on conflict (id) do nothing;

-- 5. Activer la sécurité au niveau des lignes (RLS)
alter table invite_codes enable row level security;
alter table model_profiles enable row level security;
alter table model_photos enable row level security;

-- 6. Politiques : profils
drop policy if exists "Profils publiés visibles de tous" on model_profiles;
create policy "Profils publiés visibles de tous"
  on model_profiles for select
  using (published = true);

drop policy if exists "Le mannequin gère son propre profil" on model_profiles;
create policy "Le mannequin gère son propre profil"
  on model_profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 7. Politiques : photos
drop policy if exists "Photos visibles si profil publié" on model_photos;
create policy "Photos visibles si profil publié"
  on model_photos for select
  using (exists (
    select 1 from model_profiles p
    where p.id = model_photos.model_id and p.published = true
  ));

drop policy if exists "Le mannequin gère ses propres photos" on model_photos;
create policy "Le mannequin gère ses propres photos"
  on model_photos for all
  using (exists (
    select 1 from model_profiles p
    where p.id = model_photos.model_id and p.id = auth.uid()
  ))
  with check (exists (
    select 1 from model_profiles p
    where p.id = model_photos.model_id and p.id = auth.uid()
  ));

-- 8. Politiques : stockage des photos
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

-- 9. Fonction : vérifier un code d'invitation (sans le consommer)
create or replace function check_invite_code(code_input text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from invite_codes where code = code_input and used = false
  );
$$;

revoke all on function check_invite_code from public;
grant execute on function check_invite_code to anon, authenticated;

-- 10. Fonction : consommer un code d'invitation (une seule fois, de façon sûre)
create or replace function consume_invite_code(code_input text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  nb_lignes int;
begin
  update invite_codes
  set used = true, used_by = auth.uid()
  where code = code_input and used = false;

  get diagnostics nb_lignes = row_count;
  return nb_lignes > 0;
end;
$$;

revoke all on function consume_invite_code from public;
grant execute on function consume_invite_code to authenticated;

-- ===================================================================
-- Fin du script.
-- Étape suivante : va dans Authentication > Providers > Email
-- et désactive "Confirm email" pour que les mannequins puissent
-- utiliser leur compte immédiatement après inscription.
-- ===================================================================
