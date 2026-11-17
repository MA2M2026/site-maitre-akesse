-- Essais de supabase-a-verifier.sql (17/11/2026) : seul le serveur ajoute une étiquette « À vérifier » ; l'équipe
-- de l'agence la lit et la retire ; un visiteur ne voit rien ; l'étiquette part avec la candidature supprimée.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into casting_applications (id, full_name, email, status) values
  ('00000000-0000-0000-0000-0000000a7e01', 'ESSAI DOUTEUX', 'essai@test.ci', 'nouvelle'),
  ('00000000-0000-0000-0000-0000000a7e02', 'ESSAI DOUTEUX 2', 'essai@test.ci', 'nouvelle') on conflict do nothing;
insert into envois_a_verifier (ref, table_nom, raison) values
  ('00000000-0000-0000-0000-0000000a7e01', 'casting_applications', 'pas de jeton'),
  ('00000000-0000-0000-0000-0000000a7e02', 'casting_applications', 'pas de jeton') on conflict do nothing;
-- un visiteur : ne lit rien, n'ajoute rien
set role anon;
select essai_refuse($q$select count(*) from envois_a_verifier$q$, 'visiteur : la liste « À vérifier » est fermée');
select essai_refuse($q$insert into envois_a_verifier (ref, table_nom) values ('00000000-0000-0000-0000-0000000a7e09', 'casting_applications')$q$, 'visiteur : ne peut pas ajouter d''étiquette');
reset role;
-- l'équipe du site : lit, n'ajoute pas, retire
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai((select count(*) from envois_a_verifier where ref in ('00000000-0000-0000-0000-0000000a7e01', '00000000-0000-0000-0000-0000000a7e02')) = 2, 'équipe du site : voit les étiquettes « À vérifier »');
select essai_refuse($q$insert into envois_a_verifier (ref, table_nom) values ('00000000-0000-0000-0000-0000000a7e09', 'casting_applications')$q$, 'équipe du site : n''ajoute pas d''étiquette (seul le serveur)');
delete from envois_a_verifier where ref = '00000000-0000-0000-0000-0000000a7e01';
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select count(*) from envois_a_verifier where ref = '00000000-0000-0000-0000-0000000a7e01') = 0, 'équipe du site : « C''est une vraie personne » retire l''étiquette');
-- candidature supprimée : son étiquette part avec elle
delete from casting_applications where id = '00000000-0000-0000-0000-0000000a7e02';
select essai((select count(*) from envois_a_verifier where ref = '00000000-0000-0000-0000-0000000a7e02') = 0, 'candidature supprimée : son étiquette part avec elle');
delete from casting_applications where id = '00000000-0000-0000-0000-0000000a7e01';
