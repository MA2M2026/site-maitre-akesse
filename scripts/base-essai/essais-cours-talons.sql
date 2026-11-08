-- Essais de supabase-cours-talons.sql (Extension 160, 08/11/2026) : les visiteurs s'inscrivent seulement par le
-- serveur (anti-robots) ; le statut et le montant sont décidés par la base ; seule l'équipe du site lit, suit et valide.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
select essai_refuse($$set role anon; insert into cours_talons (formule, nom, telephone) values ('groupe', 'Robot', '0700000000')$$, 'visiteur : écriture directe refusée');
reset role;
select essai_refuse($$set role anon; select count(*) from cours_talons$$, 'visiteur : ne lit pas les inscriptions');
reset role;
set role service_role;
-- payer maintenant → « paiement envoyé », montant de la formule imposé (un statut ou un montant envoyé est ignoré)
select formulaire_public_enregistrer('cours_talons',
  '{"id":"00000000-0000-0000-0000-0000000c0001","formule":"groupe","nom":"Awa Koné","telephone":"+2250700000001","age":22,"objectif":"miss","concours":"Miss Côte d''Ivoire","decision":"maintenant","reference_wave":"WAVE123","statut":"inscrite","montant":1,"photos":["https://drive.test/p1"]}'::jsonb, '3.3.3.3');
select formulaire_public_enregistrer('cours_talons',
  '{"id":"00000000-0000-0000-0000-0000000c0002","formule":"prive_salle","nom":"Bintou","telephone":"+2250700000002","age":30,"decision":"plus_tard"}'::jsonb, '3.3.3.4');
reset role;
select essai((select statut = 'paiement_envoye' and montant = 30000 and reference_wave = 'WAVE123' from cours_talons where nom = 'Awa Koné'), 'serveur : payer maintenant → paiement envoyé, 30 000 imposés (statut et montant envoyés ignorés)');
select essai(exists (select 1 from cours_talons where id = '00000000-0000-0000-0000-0000000c0001' and nom = 'Awa Koné'), 'serveur : l''identifiant tiré par la page est gardé (un nouvel essai ne double pas l''inscription)');
set role service_role;
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0001","formule":"groupe","nom":"Awa Koné","telephone":"+2250700000001","age":22}'::jsonb, '3.3.3.9')$$, 'même inscription envoyée deux fois : pas de doublon (le serveur répond « déjà enregistrée »)');
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"Sans âge","telephone":"+2250700000021"}'::jsonb, '3.3.5.1')$$, 'âge manquant : refusé (sinon une mineure passerait sans parent)');
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"Lien piège","telephone":"+2250700000022","age":22,"photos":["javascript:alert(1)"]}'::jsonb, '3.3.5.2')$$, 'photo qui n''est pas une adresse https : refusée');
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"Objet","telephone":"+2250700000023","age":22,"photos":[{"x":1}]}'::jsonb, '3.3.5.3')$$, 'photo qui n''est pas un texte : refusée');
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"Vidéo piège","telephone":"+2250700000024","age":22,"video":"data:text/html,x"}'::jsonb, '3.3.5.4')$$, 'vidéo qui n''est pas une adresse https : refusée');
reset role;
select essai((select statut = 'plus_tard' and montant = 25000 from cours_talons where nom = 'Bintou'), 'serveur : plus tard → statut plus tard, 25 000 en salle');
set role service_role;
-- privé = prix PAR SÉANCE (décision du 08/11/2026) ; le groupe reste un forfait de 4 séances
select formulaire_public_enregistrer('cours_talons', '{"formule":"prive_salle","nom":"Dix séances","telephone":"+2250700000011","age":25,"nb_seances":10}'::jsonb, '3.3.4.1');
select essai((select montant = 250000 and nb_seances = 10 from cours_talons where nom = 'Dix séances'), 'privé en salle, 10 séances : 250 000');
select formulaire_public_enregistrer('cours_talons', '{"formule":"prive_exterieur","nom":"Deux dehors","telephone":"+2250700000012","age":25,"nb_seances":2}'::jsonb, '3.3.4.2');
select essai((select montant = 60000 from cours_talons where nom = 'Deux dehors'), 'privé à l''extérieur, 2 séances : 60 000 (au départ)');
select formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"Groupe neuf","telephone":"+2250700000013","age":25,"nb_seances":9}'::jsonb, '3.3.4.3');
select essai((select montant = 30000 and nb_seances = 4 from cours_talons where nom = 'Groupe neuf'), 'groupe : toujours 30 000 les 4 séances, quel que soit le nombre envoyé');
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"formule":"prive_salle","nom":"Trop","telephone":"+2250700000014","age":25,"nb_seances":40}'::jsonb, '3.3.4.4')$$, 'privé : plus de 30 séances refusé');
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"Mineure","telephone":"+2250700000003","age":15}'::jsonb, '3.3.3.5')$$, 'mineure sans téléphone d''un parent : refusée');
select essai(formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"Mineure","telephone":"+2250700000003","age":15,"parent_nom":"Mme Yao","parent_telephone":"+2250700000004"}'::jsonb, '3.3.3.5') is not null, 'mineure avec un parent : acceptée');
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"formule":"vip","nom":"X","telephone":"0700000000"}'::jsonb, '3.3.3.6')$$, 'formule inconnue : refusée');
select formulaire_public_enregistrer('cours_talons', jsonb_build_object('formule', 'groupe', 'nom', 'Série ' || g, 'telephone', '070000000' || g, 'age', 20), '7.7.7.7') from generate_series(1, 3) g;
select essai_refuse($$select formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"4e","telephone":"0700000009","age":20}'::jsonb, '7.7.7.7')$$, '4e inscription de la même adresse dans la minute : refusée');
-- les autres formulaires gardent leurs règles
select essai_refuse($$select formulaire_public_enregistrer('recruiter_requests', '{"company":"x","contact_name":"x","email":"x@x.ci","status":"traitee"}'::jsonb, '8.8.8.8')$$, 'recruteur : statut forcé toujours refusé');
reset role;
-- l'équipe du site (a2) lit et valide : recette « Cours de talons » en Compta, une seule fois
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai((select count(*) from cours_talons) >= 6, 'équipe du site : lit les inscriptions');
select essai((cours_talons_valider((select id from cours_talons where nom = 'Awa Koné'))).statut = 'inscrite', 'équipe du site : valide le paiement');
select cours_talons_valider((select id from cours_talons where nom = 'Awa Koné'));
-- annulée puis validée à nouveau : toujours une seule recette ; une inscription annulée jamais payée ne se valide pas
update cours_talons set statut = 'annulee' where nom = 'Awa Koné';
select cours_talons_valider((select id from cours_talons where nom = 'Awa Koné'));
update cours_talons set statut = 'annulee' where nom = 'Bintou';
select essai_refuse($$select cours_talons_valider((select id from cours_talons where nom = 'Bintou'))$$, 'inscription annulée : pas de validation avant de la rouvrir');
reset role;
select essai((select count(*) from compta_ecritures e join cours_talons c on c.ecriture_id = e.id where c.nom = 'Awa Koné' and e.categorie = 'cours_talons' and e.montant = 30000 and not e.annule) = 1
  and (select count(*) from compta_ecritures where categorie = 'cours_talons') = 1, 'Compta : une seule recette « Cours de talons » de 30 000');
-- une personne sans rôle ne lit ni ne valide rien
set role authenticated;
select essai_qui('00000000-0000-0000-0000-000000000fd3', 'aal2', 30, 'appareil-demande-0003');
select essai((select count(*) from cours_talons) = 0, 'personne sans rôle : ne voit aucune inscription');
select essai_refuse($$select cours_talons_valider('00000000-0000-0000-0000-0000000c0009')$$, 'personne sans rôle : ne valide pas');
reset role;
