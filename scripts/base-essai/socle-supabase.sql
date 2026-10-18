-- Socle minimal imitant Supabase, pour ESSAYER les fichiers SQL du site sur une base
-- Postgres locale (scripts/base-essai/lancer.sh). Jamais utilisé sur la vraie base.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
alter database essai set search_path = public, extensions;
set search_path = public, extensions;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text, phone text, created_at timestamptz default now(),
  raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}',
  email_confirmed_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz,
  encrypted_password text, deleted_at timestamptz
);
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), provider text, identity_data jsonb);
create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id));
create table auth.refresh_tokens (id bigserial primary key, user_id text, session_id uuid, revoked boolean);
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), status text, factor_type text);
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(auth.jwt() ->> 'role', '') $$;
create or replace function auth.email() returns text language sql stable as $$
  select auth.jwt() ->> 'email' $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, owner uuid,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(),
  last_accessed_at timestamptz, path_tokens text[]);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create or replace function storage.filename(name text) returns text language sql immutable as $$
  select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
create or replace function storage.extension(name text) returns text language sql immutable as $$
  select reverse(split_part(reverse(name), '.', 1)) $$;
create schema net;
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000)
returns bigint language sql as $$ select 1::bigint $$;
create schema vault;
create table vault.decrypted_secrets (name text, decrypted_secret text);
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create or replace function cron.schedule(nom text, quand text, commande text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (nom, quand, commande)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
create or replace function cron.unschedule(nom text) returns boolean language sql as $$
  delete from cron.job where jobname = nom returning true $$;
