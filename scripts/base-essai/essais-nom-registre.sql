-- Extension 156 : une fiche du registre « Sans nom » reprend le nom écrit ensuite par la mannequin sur son profil ;
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
-- un nom écrit par l'agence n'est jamais remplacé.
insert into auth.users (id) values ('00000000-0000-0000-0000-000000156e01'), ('00000000-0000-0000-0000-000000156e02') on conflict do nothing;
insert into model_profiles (id, full_name) values ('00000000-0000-0000-0000-000000156e01', null), ('00000000-0000-0000-0000-000000156e02', null) on conflict (id) do nothing;
select essai((select full_name from agence_mannequins where user_id = '00000000-0000-0000-0000-000000156e01') = 'Sans nom', 'compte créé sans nom : fiche « Sans nom »');
update agence_mannequins set full_name = 'NOM DONNÉ PAR L''AGENCE' where user_id = '00000000-0000-0000-0000-000000156e02';
update model_profiles set full_name = '  Awa Essai Nom  ' where id in ('00000000-0000-0000-0000-000000156e01', '00000000-0000-0000-0000-000000156e02');
select essai((select full_name from agence_mannequins where user_id = '00000000-0000-0000-0000-000000156e01') = 'Awa Essai Nom', 'la mannequin écrit son nom : la fiche du registre le reprend');
select essai((select full_name from agence_mannequins where user_id = '00000000-0000-0000-0000-000000156e02') = 'NOM DONNÉ PAR L''AGENCE', 'un nom écrit par l''agence n''est jamais remplacé');
select essai(true, 'nom du registre : tous les essais passent');
-- (limite d'appels des envois de photos, api/_commun.js limiteDebit) : 12 appels de suite d'un même compte et d'une même
-- adresse passent avec une limite de 600 ; la limite est bien appliquée au-delà
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.9"}', false);
select essai((select bool_and(limiter_soumissions_publiques_ip('api:r2-presigner:essai', 600, 600)) from generate_series(1, 12)), 'envoi de photos : 12 appels de suite passent (pas de limite cachée de 3)');
select essai(not (select bool_and(limiter_soumissions_publiques_ip('api:supprimer-mannequin:essai', 5, 5)) from generate_series(1, 6)), 'au-delà de la limite choisie (5) : refusé');
select set_config('request.headers', '', false);
