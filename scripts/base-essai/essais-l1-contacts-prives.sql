-- Essais de supabase-l1-contacts-prives.sql (audit L-1 partie 2, 16/11/2026) : contacts des parents et références de
-- paiement illisibles par l'équipe du site ; lisibles par le principal et les encaissements, par une fonction contrôlée.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
-- comme dans la vraie base (D-01) : le compte « site » est dans admins (portail_enregistrer_appareil l'y ajoute)
insert into admins (user_id) values ('00000000-0000-0000-0000-0000000000a2') on conflict do nothing;
insert into casting_applications (id, full_name, email, phone, date_naissance, parent_nom, parent_telephone, parent_email, type_candidature)
  values ('00000000-0000-0000-0000-0000000ca201', 'Jeune L1', 'jeune@test.ci', '+2250700002201', current_date - interval '15 years', 'M. Parent', '+2250500002201', 'parent@test.ci', 'agence');
insert into cours_talons (id, formule, nom, telephone, age, parent_nom, parent_telephone, nb_seances, reference_wave)
  values ('00000000-0000-0000-0000-0000000c2201', 'prive_salle', 'Mineure L1', '+2250700002202', 15, 'Mme Parent', '+2250500002202', 1, 'T_REF_L1');

-- l'équipe du site (a2)
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai_refuse($$select parent_telephone from casting_applications$$, 'site : téléphone du parent d''une candidate illisible');
select essai_refuse($$select parent_email from casting_applications$$, 'site : e-mail du parent d''une candidate illisible');
select essai_refuse($$select * from casting_applications$$, 'site : « toutes les colonnes » des candidatures refusé (l''Administration demande la liste)');
select essai_refuse($$select parent_telephone from cours_talons$$, 'site : téléphone du parent d''une élève illisible');
select essai_refuse($$select reference_wave from cours_talons$$, 'site : référence de paiement Wave illisible');
select essai_refuse($$select reference_paiement from inscriptions_mannequins$$, 'site : référence de paiement des inscriptions illisible');
select essai((select full_name = 'Jeune L1' and parent_nom = 'M. Parent' from casting_applications where id = '00000000-0000-0000-0000-0000000ca201'), 'site : le dossier se lit toujours (nom, nom du parent…)');
select essai((select nom = 'Mineure L1' from cours_talons where id = '00000000-0000-0000-0000-0000000c2201'), 'site : l''élève se lit toujours');
select essai(not ('parent_telephone' = any (colonnes_lisibles('casting_applications'))) and 'full_name' = any (colonnes_lisibles('casting_applications')), 'colonnes_lisibles : sans les colonnes privées');
select essai(not ('reference_wave' = any (colonnes_lisibles('cours_talons'))) and 'statut' = any (colonnes_lisibles('cours_talons')), 'colonnes_lisibles (cours de talons) : sans la référence Wave');
select essai(dossiers_prives('casting_applications', array['00000000-0000-0000-0000-0000000ca201'::uuid]) = '{}'::jsonb, 'site : la fonction des contacts privés ne lui donne rien');
update casting_applications set status = 'vue' where id = '00000000-0000-0000-0000-0000000ca201';
select essai((select status = 'vue' from casting_applications where id = '00000000-0000-0000-0000-0000000ca201'), 'site : traiter le dossier (statut) reste possible');
select essai(colonnes_lisibles('staff_profiles') is null, 'colonnes_lisibles : seulement les 3 tables prévues');
reset role;

-- principal (a1) et encaissements (a3) : par la fonction contrôlée
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai((dossiers_prives('casting_applications', array['00000000-0000-0000-0000-0000000ca201'::uuid]) -> '00000000-0000-0000-0000-0000000ca201' ->> 'parent_telephone') = '+2250500002201', 'principal : téléphone du parent lu par la fonction contrôlée');
select essai((dossiers_prives('cours_talons', array['00000000-0000-0000-0000-0000000c2201'::uuid]) -> '00000000-0000-0000-0000-0000000c2201' ->> 'reference_wave') = 'T_REF_L1', 'principal : référence Wave lue par la fonction contrôlée');
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai((dossiers_prives('cours_talons', array['00000000-0000-0000-0000-0000000c2201'::uuid]) -> '00000000-0000-0000-0000-0000000c2201' ->> 'parent_telephone') = '+2250500002202', 'encaissements : téléphone du parent de l''élève lu');
select essai_refuse($$select dossiers_prives('staff_profiles', array[]::uuid[])$$, 'fonction contrôlée : seulement les 3 tables prévues');
reset role;

-- les fonctions de la base lisent toujours tout (rien n'est déplacé)
select essai((select parent_telephone = '+2250500002201' from casting_applications where id = '00000000-0000-0000-0000-0000000ca201'), 'base : le téléphone du parent est toujours là (rien n''est effacé ni déplacé)');
set role anon;
select essai_refuse($$select dossiers_prives('casting_applications', array['00000000-0000-0000-0000-0000000ca201'::uuid])$$, 'visiteur : pas d''accès à la fonction contrôlée');
reset role;
select '✅ L-1 partie 2 : tous les essais passent';
