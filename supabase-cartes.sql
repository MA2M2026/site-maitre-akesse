-- =====================================================================================
-- Cartes d'événement : photos ajoutées pour les cartes (25/10/2026, demande de la propriétaire)
-- =====================================================================================
-- Une mannequin sans photo (extérieure, autre agence, ou de l'agence sans photo dans le Book)
-- reçoit une photo ajoutée par l'agence, gardée pour les prochains événements. Elle sert
-- SEULEMENT aux cartes d'événement : jamais dans le Book ni sur le site (stockage privé).
-- Clé de la personne : « m:<profil du site> », « r:<registre de l'agence> », « c:<carnet> ».
-- Réservé à l'agence avec le code (portail_mfa_ok). À coller en entier dans Supabase ›
-- SQL Editor › Run. Aucune donnée supprimée ; peut être rejoué.

create table if not exists cartes_photos (
  cle text primary key check (cle ~ '^[mrc]:[A-Za-z0-9-]{1,64}$'),
  chemin text not null check (chemin ~ '^[mrc]-[A-Za-z0-9-]{1,64}/[0-9-]{3,60}\.jpg$'),
  mis_a_jour timestamptz not null default now()
);
alter table cartes_photos enable row level security;
drop policy if exists "Cartes : agence" on cartes_photos;
create policy "Cartes : agence" on cartes_photos for all
  using (exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()))
  with check (exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()));
revoke all on cartes_photos from anon;

-- stockage privé des photos (JPEG refait par l'Administration, 5 Mo au plus)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cartes-photos', 'cartes-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Cartes : agence lit" on storage.objects;
create policy "Cartes : agence lit" on storage.objects for select
  using (bucket_id = 'cartes-photos' and exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()));
drop policy if exists "Cartes : agence dépose" on storage.objects;
create policy "Cartes : agence dépose" on storage.objects for insert
  with check (bucket_id = 'cartes-photos' and exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()));
drop policy if exists "Cartes : agence retire" on storage.objects;
create policy "Cartes : agence retire" on storage.objects for delete
  using (bucket_id = 'cartes-photos' and exists (select 1 from admins where user_id = auth.uid() and portail_mfa_ok()));

NOTIFY pgrst, 'reload schema';

-- Contrôle : doit afficher 1 table et 1 stockage
select (select count(*) from pg_tables where tablename = 'cartes_photos') as table_cartes,
  (select count(*) from storage.buckets where id = 'cartes-photos') as stockage_cartes;
