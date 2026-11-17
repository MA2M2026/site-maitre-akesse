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
-- la surveillance efface ensuite le journal medias_drive des lignes disparues : le numéro du dossier reste connu
update medias_drive set cree_le = now() - interval '8 days' where ref in ('00000000-0000-0000-0000-0000000d1801', '00000000-0000-0000-0000-0000000d1802');
select medias_drive_surveiller();
select essai((select count(*) from medias_drive where ref = '00000000-0000-0000-0000-0000000d1802') = 0
  and media_drive_a_jeter('secret-essai', 'candidature', '00000000-0000-0000-0000-0000000d1802') = '["DOSSIER_CANDIDATE_1234"]'::jsonb,
  'journal effacé par la surveillance : le dossier à jeter reste connu');
-- Google n'a pas répondu : la relance de chaque heure redemande (pas avant 50 minutes, 5 essais au plus)
select essai(medias_drive_corbeille_relancer() = 0, 'relance : rien tant que la dernière demande a moins de 50 minutes');
update medias_drive_corbeille set dernier = now() - interval '1 hour';
select essai(medias_drive_corbeille_relancer() = 2, 'relance : deux demandes renvoyées');
-- (lu dans une seconde requête : la première ne voit pas encore ses propres écritures)
select essai(true
  and (select count(*) from essai_appels_google where corps->>'action' = 'corbeille') = 4
  and (select essais from medias_drive_corbeille where ref = '00000000-0000-0000-0000-0000000d1802') = 2,
  'relance : les deux demandes non faites sont renvoyées');
update medias_drive_corbeille set dernier = now() - interval '1 hour';
update medias_drive_corbeille set essais = 5 where ref = '00000000-0000-0000-0000-0000000d1802';
select essai(medias_drive_corbeille_relancer() = 1, 'relance : arrêt après 5 essais');
select essai(media_drive_jete('secret-essai', '00000000-0000-0000-0000-0000000d1801', 1), 'programme Google : « fait » répond vrai (200, pas 204)');
select essai(media_drive_a_jeter('secret-essai', 'cours_talons', '00000000-0000-0000-0000-0000000d1801') = '[]'::jsonb
  and (select nb from medias_drive_corbeille where ref = '00000000-0000-0000-0000-0000000d1801') = 1,
  'programme Google : une fois fait, plus rien à jeter (pas de second passage)');
update medias_drive_corbeille set dernier = now() - interval '1 hour';
select essai(medias_drive_corbeille_relancer() = 0, 'relance : rien pour une demande faite ou épuisée');

-- un visiteur ne lit pas la liste de la corbeille
set role anon;
select essai((select count(*) from medias_drive_corbeille) = 0, 'visiteur : la corbeille Drive est invisible');
reset role;
-- remise de l'imitation d'origine
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000)
returns bigint language sql as $$ select 1::bigint $$;
drop table essai_appels_google;
