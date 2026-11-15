-- Essais de supabase-categorie-immediate.sql (fiche publique rangée tout de suite, 16/11/2026)
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000c1d01', 'immediate@test.ci') on conflict do nothing;
insert into model_profiles (id, full_name) values ('00000000-0000-0000-0000-0000000c1d01', 'AWA IMMEDIATE') on conflict (id) do nothing;
update agence_mannequins set date_entree = current_date - interval '2 months', parcours_arrivee = null where user_id = '00000000-0000-0000-0000-0000000c1d01';
select essai((select niveau_mannequin from model_profiles where id = '00000000-0000-0000-0000-0000000c1d01') = 'New Face', 'arrivée il y a 2 mois, sans expérience : New Face');
-- l'agence la note « déjà formée » (par la carte, comme dans la fiche Mannequins)
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select carte_mannequin_regler((select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000c1d01'), '{"parcours":"formee"}');
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select niveau_mannequin from model_profiles where id = '00000000-0000-0000-0000-0000000c1d01') = 'Professionnel', 'notée « déjà formée » : fiche publique Main Board TOUT DE SUITE (sans attendre la nuit)');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select carte_mannequin_regler((select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000c1d01'), '{"parcours":"debutante"}');
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select niveau_mannequin from model_profiles where id = '00000000-0000-0000-0000-0000000c1d01') = 'New Face', 'remise « débutante » : New Face tout de suite');
-- elle ajoute un défilé de 2020 sur sa fiche, puis le retire
insert into model_projects (model_id, type_projet, titre, periode) values ('00000000-0000-0000-0000-0000000c1d01', 'défilé', 'Essai', '2020');
select essai((select niveau_mannequin from model_profiles where id = '00000000-0000-0000-0000-0000000c1d01') = 'Professionnel', 'expérience de 2020 ajoutée : Main Board tout de suite');
update model_projects set periode = '2026' where model_id = '00000000-0000-0000-0000-0000000c1d01';
select essai((select niveau_mannequin from model_profiles where id = '00000000-0000-0000-0000-0000000c1d01') = 'New Face', 'date corrigée en 2026 : New Face tout de suite');
update model_projects set periode = '2020' where model_id = '00000000-0000-0000-0000-0000000c1d01';
delete from model_projects where model_id = '00000000-0000-0000-0000-0000000c1d01';
select essai((select niveau_mannequin from model_profiles where id = '00000000-0000-0000-0000-0000000c1d01') = 'New Face', 'expérience retirée : New Face tout de suite');
