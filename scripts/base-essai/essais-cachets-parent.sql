-- Essais : parent d'une mineure enregistré depuis « Payer les mannequins » (supabase-cachets-parent.sql)
\set ON_ERROR_STOP 1
set search_path = public, extensions;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'mineure@test.ci') on conflict do nothing;
insert into model_profiles (id, full_name) values ('00000000-0000-0000-0000-0000000000f1', 'PETITE AMA') on conflict (id) do nothing;
-- (le registre reçoit tout seul la mannequin inscrite sur le site : on lui donne l'identifiant de l'essai)
insert into agence_mannequins (id, full_name, date_naissance, user_id)
  select '00000000-0000-0000-0000-0000000000f2', 'PETITE AMA', current_date - interval '15 years', '00000000-0000-0000-0000-0000000000f1'
  where not exists (select 1 from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000f1');
update agence_mannequins set id = '00000000-0000-0000-0000-0000000000f2', date_naissance = current_date - interval '15 years' where user_id = '00000000-0000-0000-0000-0000000000f1';
insert into agence_mannequins (id, full_name, date_naissance) values ('00000000-0000-0000-0000-0000000000f3', 'PETIT ZIE', current_date - interval '14 years');
-- l'administrateur principal enregistre le parent (depuis « Payer les mannequins »)
select essai_qui('00000000-0000-0000-0000-0000000000a1');
set role authenticated;
select cachet_enregistrer_parent('00000000-0000-0000-0000-0000000000f2', 'Madame Ama Mère', '2250707070707');
select cachet_enregistrer_parent('00000000-0000-0000-0000-0000000000f3', 'Monsieur Zié Père', '2250505050505');
select essai_refuse('select cachet_enregistrer_parent(''00000000-0000-0000-0000-0000000000f2'', ''Madame Ama Mère'', ''12'')', 'numéro Wave du parent pas valable : refusé');
select essai_refuse('select cachet_enregistrer_parent(''00000000-0000-0000-0000-0000000000f2'', '' '', ''2250707070707'')', 'nom du parent vide : refusé');
reset role;
select essai((select parent_nom = 'Madame Ama Mère' and parent_telephone = '2250707070707' from agence_mannequins where id = '00000000-0000-0000-0000-0000000000f2'), 'parent enregistré dans le registre');
select essai((select parent_nom = 'Madame Ama Mère' and parent_telephone = '2250707070707' from contacts_parents where model_id = '00000000-0000-0000-0000-0000000000f1'), 'mannequin inscrite sur le site : parent aussi sur sa fiche');
select essai((select parent_nom from agence_mannequins where id = '00000000-0000-0000-0000-0000000000f3') = 'Monsieur Zié Père', 'mannequin sans compte sur le site : parent dans le registre seulement');
-- une majeure, ou quelqu'un hors du registre : refusé
insert into agence_mannequins (id, full_name, date_naissance) values ('00000000-0000-0000-0000-0000000000f4', 'MAJEURE', '1999-01-01');
select essai_qui('00000000-0000-0000-0000-0000000000a1');
set role authenticated;
select essai_refuse('select cachet_enregistrer_parent(''00000000-0000-0000-0000-0000000000f4'', ''Quelqu''''un'', ''2250101010101'')', 'mannequin majeure : refusé');
select essai_refuse('select cachet_enregistrer_parent(''00000000-0000-0000-0000-0000000000a5'', ''Quelqu''''un'', ''2250101010101'')', 'pas dans le registre : refusé');
reset role;
-- la gestion du site (ni paiements ni comptabilité) : refusé ; un visiteur : refusé
select essai_qui('00000000-0000-0000-0000-0000000000a2');
set role authenticated;
select essai_refuse('select cachet_enregistrer_parent(''00000000-0000-0000-0000-0000000000f2'', ''Quelqu''''un'', ''2250101010101'')', 'gestion du site : ne change pas le parent');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
select essai_refuse('select cachet_enregistrer_parent(''00000000-0000-0000-0000-0000000000f2'', ''Quelqu''''un'', ''2250101010101'')', 'visiteur : refusé');
reset role;
