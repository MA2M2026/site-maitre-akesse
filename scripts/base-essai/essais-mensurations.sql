-- Essais de supabase-mensurations.sql (Extension 146, 01/11/2026) : un relevé daté à chaque changement de
-- mensurations (même fait par la mannequin elle-même), rien si autre chose change, lecture par l'équipe.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
create temp table releves_avant as select count(*) n from mensurations_historique where model_id = '00000000-0000-0000-0000-0000000000b1';
grant select on releves_avant to authenticated, anon;
-- la mannequin connectée change sa taille et sa poitrine depuis son application
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
update model_profiles set height_cm = 177, chest_cm = 84 where id = '00000000-0000-0000-0000-0000000000b1';
update model_profiles set city = 'Abidjan' where id = '00000000-0000-0000-0000-0000000000b1';
reset role;
select essai((select count(*) from mensurations_historique where model_id = '00000000-0000-0000-0000-0000000000b1') = (select n from releves_avant) + 1, 'un relevé daté quand les mensurations changent (rien quand la ville change)');
select essai((select valeurs ->> 'height_cm' from mensurations_historique where model_id = '00000000-0000-0000-0000-0000000000b1' order by releve_le desc limit 1) = '177', 'le relevé garde les nouvelles valeurs');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai(json_array_length(mensurations_historique_lire('00000000-0000-0000-0000-0000000000b1')) >= 1, 'équipe : lit l''historique');
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai_refuse($$select mensurations_historique_lire('00000000-0000-0000-0000-0000000000b1')$$, 'mannequin : pas l''historique de l''agence');
select essai_refuse($$select * from mensurations_historique$$, 'table pas lisible directement');
reset role;
set role anon;
select essai_refuse($$select mensurations_historique_lire('00000000-0000-0000-0000-0000000000b1')$$, 'visiteur : refusé');
reset role;
