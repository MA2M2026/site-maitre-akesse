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
