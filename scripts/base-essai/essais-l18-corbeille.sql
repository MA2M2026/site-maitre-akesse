-- Essais de supabase-l18-supprimer-talons.sql (17/11/2026, L-18 c et d) : seul le principal supprime une inscription
-- au cours de talons ; une suppression faite par l'agence (connectée) demande au programme Google de mettre le
-- dossier Drive à la corbeille ; le nettoyage automatique (personne connectée) ne touche jamais au Drive ; le
-- programme Google ne reçoit des dossiers à jeter qu'avec le mot secret, et seulement pour une ligne disparue.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
-- imitation de pg_net qui garde la trace des appels
create table if not exists essai_appels_google (corps jsonb);
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000)
returns bigint language sql security definer as $$ insert into public.essai_appels_google values (body) returning 1::bigint $$;
update medias_drive_reglage set script_a_jour = true;
insert into medias_drive_reglage (empreinte, script_a_jour) values (encode(digest('secret-essai', 'sha256'), 'hex'), true)
  on conflict (id) do update set empreinte = excluded.empreinte, script_a_jour = true;
insert into cours_talons (id, formule, nom, telephone) values ('00000000-0000-0000-0000-0000000d1801', 'groupe', 'ESSAI TALONS', '0700000000') on conflict do nothing;
insert into casting_applications (id, full_name, email, status) values
  ('00000000-0000-0000-0000-0000000d1802', 'ESSAI CANDIDATE', 'essai@test.ci', 'nouvelle'),
  ('00000000-0000-0000-0000-0000000d1803', 'ESSAI NUIT', 'essai@test.ci', 'refusée') on conflict do nothing;
insert into medias_drive (source, ref, genre, lien) values
  ('cours_talons', '00000000-0000-0000-0000-0000000d1801', 'dossier', 'DOSSIER_TALONS_1234'),
  ('candidature', '00000000-0000-0000-0000-0000000d1802', 'dossier', 'DOSSIER_CANDIDATE_1234'),
  ('candidature', '00000000-0000-0000-0000-0000000d1803', 'dossier', 'DOSSIER_NUIT_1234') on conflict do nothing;

-- ligne encore là : rien à jeter, même avec le mot secret
select essai(media_drive_a_jeter('secret-essai', 'candidature', '00000000-0000-0000-0000-0000000d1802') = '[]'::jsonb,
  'programme Google : rien à jeter tant que la candidature existe');

-- l'équipe du site : ne supprime pas une inscription au cours de talons
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
delete from cours_talons where id = '00000000-0000-0000-0000-0000000d1801';
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select count(*) from cours_talons where id = '00000000-0000-0000-0000-0000000d1801') = 1
  and (select count(*) from essai_appels_google where corps->>'action' = 'corbeille') = 0,
  'administrateur du site : ne supprime pas une inscription, aucun appel au programme Google');

-- le principal : supprime l'inscription et la candidature, la base demande la corbeille pour les deux
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
delete from cours_talons where id = '00000000-0000-0000-0000-0000000d1801';
delete from casting_applications where id = '00000000-0000-0000-0000-0000000d1802';
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select count(*) from cours_talons where id = '00000000-0000-0000-0000-0000000d1801') = 0
  and (select count(*) from essai_appels_google where corps->>'action' = 'corbeille' and corps->>'source' = 'cours_talons'
       and corps->>'ref' = '00000000-0000-0000-0000-0000000d1801') = 1
  and (select count(*) from essai_appels_google where corps->>'action' = 'corbeille' and corps->>'source' = 'candidature'
       and corps->>'ref' = '00000000-0000-0000-0000-0000000d1802') = 1,
  'principal : inscription et candidature supprimées, corbeille Drive demandée pour chacune');

-- le nettoyage automatique de la nuit (personne connectée) : aucune corbeille
delete from casting_applications where id = '00000000-0000-0000-0000-0000000d1803';
select essai((select count(*) from essai_appels_google where corps->>'action' = 'corbeille' and corps->>'ref' = '00000000-0000-0000-0000-0000000d1803') = 0
  and media_drive_a_jeter('secret-essai', 'candidature', '00000000-0000-0000-0000-0000000d1803') = '[]'::jsonb,
  'suppression automatique : le Drive n''est jamais touché');

-- le programme Google : mauvais mot secret refusé ; bon mot secret → le dossier de la ligne disparue
select essai_refuse($q$select media_drive_a_jeter('mauvais', 'cours_talons', '00000000-0000-0000-0000-0000000d1801')$q$,
  'programme Google : mauvais mot secret refusé');
select essai(media_drive_a_jeter('secret-essai', 'cours_talons', '00000000-0000-0000-0000-0000000d1801') = '["DOSSIER_TALONS_1234"]'::jsonb
  and media_drive_a_jeter('secret-essai', 'candidature', '00000000-0000-0000-0000-0000000d1801') = '[]'::jsonb,
  'programme Google : le bon dossier à jeter, rien avec une mauvaise source');
select media_drive_jete('secret-essai', '00000000-0000-0000-0000-0000000d1801', 1);
select essai(media_drive_a_jeter('secret-essai', 'cours_talons', '00000000-0000-0000-0000-0000000d1801') = '[]'::jsonb
  and (select nb from medias_drive_corbeille where ref = '00000000-0000-0000-0000-0000000d1801') = 1,
  'programme Google : une fois fait, plus rien à jeter (pas de second passage)');

-- un visiteur ne lit pas la liste de la corbeille
set role anon;
select essai((select count(*) from medias_drive_corbeille) = 0, 'visiteur : la corbeille Drive est invisible');
reset role;
-- remise de l'imitation d'origine
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000)
returns bigint language sql as $$ select 1::bigint $$;
drop table essai_appels_google;
