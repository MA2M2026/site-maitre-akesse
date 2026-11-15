-- Essais de supabase-carte-mannequin.sql (carte « MANNEQUIN MA2M », catégorie New Face / Professionnelle, 15/11/2026)
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000c0b01', 'nouvelle@test.ci'), ('00000000-0000-0000-0000-0000000c0b02', 'ancienne@test.ci'),
  ('00000000-0000-0000-0000-0000000c0b03', 'experte@test.ci') on conflict do nothing;
insert into model_profiles (id, full_name, niveau_mannequin) values ('00000000-0000-0000-0000-0000000c0b01', 'AYA NOUVELLE', 'Professionnel'),
  ('00000000-0000-0000-0000-0000000c0b02', 'FATOU ANCIENNE', 'New Face'), ('00000000-0000-0000-0000-0000000c0b03', 'MARIAM EXPERTE', 'New Face') on conflict (id) do nothing;
-- (le registre les reçoit tout seul : dates d'entrée de l'essai)
update agence_mannequins set date_entree = current_date - interval '4 months' where user_id = '00000000-0000-0000-0000-0000000c0b01';
update agence_mannequins set date_entree = current_date - interval '2 years 1 month' where user_id = '00000000-0000-0000-0000-0000000c0b02';
update agence_mannequins set date_entree = current_date - interval '1 month' where user_id = '00000000-0000-0000-0000-0000000c0b03';
-- l'experte a défilé en 2020 et 2023 (fiche publique), arrivée le mois dernier
insert into model_projects (model_id, type_projet, titre, periode) values ('00000000-0000-0000-0000-0000000c0b03', 'défilé', 'Abidjan Fashion', 'Mars 2020'), ('00000000-0000-0000-0000-0000000c0b03', 'défilé', 'Dakar', '2023');
select essai(categorie_mannequin_calculee('00000000-0000-0000-0000-0000000c0b01') = 'New Face', 'arrivée il y a 4 mois, sans expérience : New Face (même si elle avait coché « Professionnel »)');
select essai(categorie_mannequin_calculee('00000000-0000-0000-0000-0000000c0b02') = 'Professionnel', '2 ans à l''agence : Professionnelle');
select essai(categorie_mannequin_calculee('00000000-0000-0000-0000-0000000c0b03') = 'Professionnel', 'arrivée le mois dernier, défilés depuis 2020 : Professionnelle tout de suite');
select essai(categories_mannequins_mettre_a_jour() >= 2, 'les fiches sont rangées d''un coup (celles qui ont changé)');
select essai((select string_agg(niveau_mannequin, ',' order by full_name) from model_profiles where id::text like '00000000-0000-0000-0000-0000000c0b0%') = 'New Face,Professionnel,Professionnel', 'fiches : AYA New Face, FATOU et MARIAM Professionnelles');
select essai(categories_mannequins_mettre_a_jour() = 0, 'relancé : rien à changer');
-- carte : rien tant que l'agence ne l'active pas
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000c0b01","role":"authenticated"}', false);
select essai(ma_carte_mannequin() is null, 'carte pas activée : la mannequin ne la voit pas');
select essai_refuse($$select carte_mannequin_de((select id from agence_mannequins limit 1))$$, 'une mannequin ne lit pas la carte d''une autre par l''agence');
reset role;
select set_config('request.jwt.claims', '', false);
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
update agence_mannequins set carte_active = true, carte_validite_ans = 5 where user_id = '00000000-0000-0000-0000-0000000c0b01';
select essai((carte_mannequin_de((select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000c0b01'))->>'matricule') ~ ('^MA2M · ' || extract(year from current_date - interval '4 months')::int || ' · [0-9]{4}$'), 'activée : numéro « MA2M · année d''entrée · 0001 »');
select carte_numero as num1 from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000c0b01' \gset
update agence_mannequins set carte_active = false, carte_numero = 999 where user_id = '00000000-0000-0000-0000-0000000c0b01';
update agence_mannequins set carte_active = true where user_id = '00000000-0000-0000-0000-0000000c0b01';
select essai((select carte_numero from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000c0b01') = :num1, 'le numéro ne change jamais (désactivée puis réactivée, ou modifié)');
select essai((carte_mannequin_de((select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000c0b01'))->>'valable')::date = (current_date - interval '4 months' + interval '5 years')::date, 'valable 5 ans après l''entrée (durée du contrat)');
-- l'agence choisit la catégorie à la main, puis revient au calcul
select essai(mannequin_categorie_choisir((select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000c0b01'), 'Professionnel') = 'Professionnel', 'choix de l''agence : Professionnelle');
reset role;
select essai((select niveau_mannequin from model_profiles where id = '00000000-0000-0000-0000-0000000c0b01') = 'Professionnel', 'la fiche publique suit tout de suite le choix de l''agence');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai(mannequin_categorie_choisir((select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000c0b01'), null) = 'New Face', 'retour au calcul : New Face');
update agence_mannequins set carte_formation = '  Recyclage  ' where user_id = '00000000-0000-0000-0000-0000000c0b01';
reset role;
select essai((select carte_formation from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000c0b01') = 'Recyclage', 'texte « Formation » choisi par l''agence (espaces retirés)');
-- la mannequin lit SA carte
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000c0b01","role":"authenticated"}', false);
select essai(ma_carte_mannequin()->>'nom' = 'AYA NOUVELLE' and ma_carte_mannequin()->>'categorie' = 'New Face' and ma_carte_mannequin()->>'formation' = 'Recyclage', 'la mannequin lit sa carte activée : nom, catégorie, formation');
select essai_refuse($$select mannequin_categorie_choisir((select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000c0b01'), 'Professionnel')$$, 'une mannequin ne change pas sa catégorie');
reset role;
select set_config('request.jwt.claims', '', false);
select essai(exists (select 1 from cron.job where jobname = 'categories-mannequins'), 'rangées tous les jours');
-- une mannequin ne se donne pas la catégorie : niveau_manuel refusé, niveau_mannequin recalculé
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000c0b01","role":"authenticated"}', false);
select essai_refuse($$update model_profiles set niveau_manuel = 'Professionnel' where id = '00000000-0000-0000-0000-0000000c0b01'$$, 'une mannequin ne choisit pas sa catégorie (niveau_manuel)');
update model_profiles set niveau_mannequin = 'Professionnel' where id = '00000000-0000-0000-0000-0000000c0b01';
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select niveau_mannequin from model_profiles where id = '00000000-0000-0000-0000-0000000c0b01') = 'New Face', 'ce qu''elle écrit dans niveau_mannequin est remplacé par la règle');
-- renouveler : le contrat repart d'aujourd'hui
update agence_mannequins set carte_debut = current_date where user_id = '00000000-0000-0000-0000-0000000c0b01';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai((carte_mannequin_de((select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000c0b01'))->>'valable')::date = (current_date + interval '5 years')::date, 'renouvelée aujourd''hui : valable 5 ans à partir d''aujourd''hui');
reset role;
select set_config('request.jwt.claims', '', false);
