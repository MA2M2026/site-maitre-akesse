-- Essais de supabase-programme-talons.sql (« Mon programme » de l'Atelier talons, 14/11/2026) : séances remplies
-- toutes seules pour le groupe, page de l'élève lisible avec le seul jeton et seulement après le paiement validé.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
set role service_role;
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0101","formule":"groupe","nom":"Aya Programme","telephone":"+2250700000101","age":28}'::jsonb, '4.4.4.1');
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0102","formule":"prive_salle","nom":"Privée Programme","telephone":"+2250700000102","age":16,"parent_nom":"M. Yao","parent_telephone":"+2250700000103","nb_seances":2}'::jsonb, '4.4.4.2');
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0103","formule":"groupe","nom":"Jeton Choisi","telephone":"+2250700000104","age":30,"jeton":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'::jsonb, '4.4.4.3');
reset role;
select essai((select jeton <> 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' and length(jeton) = 36 from cours_talons where id = '00000000-0000-0000-0000-0000000c0103'), 'jeton envoyé par un visiteur : ignoré, la base tire le sien');
-- date de première séance notée un samedi (dans un an) : les dimanches partent du lendemain
update cours_talons set date_seance = (current_date + 365) + ((6 - extract(dow from current_date + 365)::int + 7) % 7) where id = '00000000-0000-0000-0000-0000000c0103';
select essai((select length(jeton) = 36 from cours_talons where id = '00000000-0000-0000-0000-0000000c0101'), 'chaque inscription a un jeton de 36 caractères');
select jeton as j1 from cours_talons where id = '00000000-0000-0000-0000-0000000c0101' \gset
-- avant le paiement : la page ne montre rien
set role anon;
select essai(programme_talons_lire(:'j1') is null, 'avant le paiement validé : la page ne montre rien');
reset role;
select essai_refuse($$set role anon; select count(*) from cours_talons_seances$$, 'visiteur : ne lit pas les séances directement');
reset role;
select essai_refuse($$set role anon; insert into cours_talons_seances (inscription_id, debut, fin) values ('00000000-0000-0000-0000-0000000c0101', now(), now() + interval '1 hour')$$, 'visiteur : n''ajoute pas de séance');
reset role;
-- l'équipe du site valide le groupe : 4 dimanches de 15 h à 18 h remplis tout seuls
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select cours_talons_valider('00000000-0000-0000-0000-0000000c0101');
select essai((select count(*) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0101') = 4, 'groupe validé : 4 séances remplies');
select cours_talons_valider('00000000-0000-0000-0000-0000000c0103');
select essai((select bool_and(extract(dow from s.debut at time zone 'UTC') = 0) and min(s.debut at time zone 'UTC')::date = min(c.date_seance) + 1
  from cours_talons_seances s join cours_talons c on c.id = s.inscription_id where c.id = '00000000-0000-0000-0000-0000000c0103'), 'date notée un samedi : les séances partent du dimanche suivant, jamais un samedi');
select essai((select bool_and(extract(dow from debut at time zone 'UTC') = 0 and extract(hour from debut at time zone 'UTC') = 15 and fin - debut = interval '3 hours' and debut > now())
  from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0101'), 'les 4 séances : dimanches à venir, 15 h – 18 h');
select essai((select max(debut) - min(debut) = interval '21 days' from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0101'), 'quatre dimanches qui se suivent');
-- rouvrir puis revalider : jamais de doublon
update cours_talons set statut = 'terminee' where id = '00000000-0000-0000-0000-0000000c0101';
update cours_talons set statut = 'inscrite' where id = '00000000-0000-0000-0000-0000000c0101';
select essai((select count(*) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0101') = 4, 'inscription rouverte : toujours 4 séances (pas de doublon)');
-- privé : rien de rempli tout seul ; l'équipe ajoute, change, coche, retire une séance
select cours_talons_valider('00000000-0000-0000-0000-0000000c0102');
select essai((select count(*) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0102') = 0, 'privé validé : aucune séance ajoutée toute seule');
insert into cours_talons_seances (inscription_id, debut, fin, lieu) values ('00000000-0000-0000-0000-0000000c0102', '2030-01-05 10:00Z', '2030-01-05 12:00Z', 'Salle MA2M, Riviera Faya');
update cours_talons_seances set faite = true where inscription_id = '00000000-0000-0000-0000-0000000c0102';
select essai_refuse($$insert into cours_talons_seances (inscription_id, debut, fin) values ('00000000-0000-0000-0000-0000000c0102', '2030-01-06 12:00Z', '2030-01-06 10:00Z')$$, 'séance qui finit avant de commencer : refusée');
reset role;
-- la page de l'élève : avec le jeton seulement, sans téléphone ni photos
set role anon;
select essai((programme_talons_lire(:'j1')->>'civilite') = 'Madame' and jsonb_array_length(programme_talons_lire(:'j1')->'seances') = 4
  and programme_talons_lire(:'j1')->>'telephone' is null and programme_talons_lire(:'j1')->>'photos' is null, 'page de l''élève : ses 4 séances, « Madame », ni téléphone ni photos');
reset role;
select essai((select programme_talons_lire(jeton)->>'civilite' = 'Mademoiselle' from cours_talons where id = '00000000-0000-0000-0000-0000000c0102'), 'élève mineure : « Mademoiselle »');
set role anon;
select essai(programme_talons_lire('000000000000000000000000000000000000') is null and programme_talons_lire('x') is null and programme_talons_lire(null) is null, 'mauvais jeton : rien');
-- (14/11/2026) civilité choisie et groupe sur plusieurs mois
set role service_role;
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0201","formule":"groupe","nom":"Mois Par Mois","telephone":"+2250700000201","age":24,"civilite":"mademoiselle","nb_mois":3,"paiement":"mensuel","mois_payes":5}'::jsonb, '4.4.5.1');
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0202","formule":"groupe","nom":"Tout Payé","telephone":"+2250700000202","age":40,"civilite":"madame","nb_mois":3,"paiement":"tout"}'::jsonb, '4.4.5.2');
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0203","formule":"groupe","nom":"Trop De Mois","telephone":"+2250700000203","age":40,"nb_mois":50,"paiement":"mensuel"}'::jsonb, '4.4.5.3');
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0204","formule":"prive_salle","nom":"Privée Mois","telephone":"+2250700000204","age":40,"nb_seances":2,"nb_mois":6,"paiement":"mensuel"}'::jsonb, '4.4.5.4');
reset role;
select essai_refuse($$set role service_role; select formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"Civilité piège","telephone":"+2250700000209","age":40,"civilite":"monsieur"}'::jsonb, '4.4.5.9')$$, 'civilité inconnue : refusée');
reset role;
select essai((select montant = 30000 and nb_mois = 3 and paiement = 'mensuel' and mois_payes = 0 and civilite = 'mademoiselle' from cours_talons where id = '00000000-0000-0000-0000-0000000c0201'), '3 mois payés mois par mois : 30 000 à payer maintenant (mois payés envoyés par le visiteur ignorés)');
select essai((select montant = 90000 and nb_mois = 3 and paiement = 'tout' from cours_talons where id = '00000000-0000-0000-0000-0000000c0202'), '3 mois payés d''un coup : 90 000');
select essai((select nb_mois = 12 and montant = 30000 from cours_talons where id = '00000000-0000-0000-0000-0000000c0203'), '50 mois demandés : ramenés à 12');
select essai((select nb_mois = 1 and paiement = 'tout' and montant = 50000 from cours_talons where id = '00000000-0000-0000-0000-0000000c0204'), 'privé : pas de mois, prix à la séance inchangé (50 000)');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai_refuse($$select cours_talons_mois_payer('00000000-0000-0000-0000-0000000c0201', 1)$$, 'mois suivant avant la validation du premier paiement : refusé');
select cours_talons_valider('00000000-0000-0000-0000-0000000c0201', 90000);
select cours_talons_valider('00000000-0000-0000-0000-0000000c0202');
select essai((select montant = 30000 from cours_talons where id = '00000000-0000-0000-0000-0000000c0201'), 'mois par mois : 90 000 tapés à la validation → 30 000 encaissés (le mois 1 seulement)');
-- ligne mise « inscrite » à la main AVANT la validation : la validation compte quand même son mois et ses dimanches
update cours_talons set statut = 'inscrite' where id = '00000000-0000-0000-0000-0000000c0203';
select cours_talons_valider('00000000-0000-0000-0000-0000000c0203');
select essai((select mois_payes = 1 from cours_talons where id = '00000000-0000-0000-0000-0000000c0203') and (select count(*) = 48 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0203'), 'déjà « inscrite » à la main puis validée : 1 mois payé, 48 dimanches prévus');
select essai((select mois_payes = 1 from cours_talons where id = '00000000-0000-0000-0000-0000000c0201') and (select mois_payes = 3 from cours_talons where id = '00000000-0000-0000-0000-0000000c0202'), 'validation : mois par mois → 1 mois payé ; d''un coup → 3 mois payés');
select essai((select count(*) = 12 and bool_and(extract(dow from debut at time zone 'UTC') = 0) and max(debut) - min(debut) = interval '77 days' from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0201'), '3 mois : 12 dimanches qui se suivent, prévus dès la validation');
select essai((select count(*) = 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0201' and mois = 3 and theme = 'Poses et arrêts') and (select count(*) = 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0201' and mois = 1 and theme = 'Premier défilé'), 'le programme progresse : mois 1 « Premier défilé », mois 3 « Poses et arrêts »');
reset role;
select essai((select libelle = 'Cours de talons en groupe, mois 1 sur 3' from compta_ecritures e join cours_talons c on c.ecriture_id = e.id where c.id = '00000000-0000-0000-0000-0000000c0201')
  and (select libelle = 'Cours de talons en groupe, 3 mois payés d''un coup' and e.montant = 90000 from compta_ecritures e join cours_talons c on c.ecriture_id = e.id where c.id = '00000000-0000-0000-0000-0000000c0202'), 'Compta : libellé juste à la validation (« mois 1 sur 3 », « 3 mois payés d''un coup »)');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select cours_talons_mois_payer('00000000-0000-0000-0000-0000000c0201', 2);
select essai_refuse($$select cours_talons_mois_payer('00000000-0000-0000-0000-0000000c0201', 2)$$, 'deuxième appui sur « Mois 2 payé » : refusé (jamais deux recettes)');
select cours_talons_mois_payer('00000000-0000-0000-0000-0000000c0201', 3, true);
select essai((select mois_payes = 3 and nb_mois = 3 and montant = 90000 from cours_talons where id = '00000000-0000-0000-0000-0000000c0201')
  and (select count(*) = 12 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0201'), 'mois 2 et 3 payés : 3 / 3, 90 000 encaissés, toujours 12 dimanches');
-- renouvellement : un 4e mois, ses 4 dimanches à la suite
select cours_talons_mois_payer('00000000-0000-0000-0000-0000000c0201', 4);
select essai((select mois_payes = 4 and nb_mois = 4 and paiement = 'mensuel' from cours_talons where id = '00000000-0000-0000-0000-0000000c0201')
  and (select count(*) = 16 and bool_and(extract(dow from debut at time zone 'UTC') = 0) and max(debut) - min(debut) = interval '105 days' from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0201')
  and (select count(*) = 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0201' and mois = 4 and theme = 'Marcher en rythme sur la musique'), 'renouvellement : 4e mois, 4 dimanches ajoutés juste après');
select essai_refuse($$select cours_talons_mois_payer('00000000-0000-0000-0000-0000000c0102', 1)$$, 'privé : pas de paiement au mois');
reset role;
select essai((select count(*) = 4 and sum(montant) = 120000 from compta_ecritures where categorie = 'cours_talons' and tiers = 'Mois Par Mois' and libelle like 'Cours de talons en groupe, mois %'), 'Compta : une recette de 30 000 par mois payé (mois 1 à 4)');
select essai((select (programme_talons_lire(jeton)->>'civilite') = 'Mademoiselle' and (programme_talons_lire(jeton)->>'mois_payes')::int = 4 and jsonb_array_length(programme_talons_lire(jeton)->'seances') = 16
  from cours_talons where id = '00000000-0000-0000-0000-0000000c0201') and (select programme_talons_lire(jeton)->'titres_mois'->>'2' = 'L''assurance' from cours_talons where id = '00000000-0000-0000-0000-0000000c0201'), 'page de l''élève : « Mademoiselle » (son choix), 4 mois payés, 16 séances, titres des mois');
select essai((select count(*) = 4 and bool_and(theme in ('Séance adaptée à votre niveau', 'Défilé du mois')) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0203' and mois = 12), '12e mois : perfectionnement, le dernier dimanche reste un défilé');
select essai((select programme_talons_lire(jeton)->>'civilite' = 'Madame' from cours_talons where id = '00000000-0000-0000-0000-0000000c0202'), 'civilité choisie « Madame » : Madame');
-- (14/11/2026) parcours : « j'ai déjà la base » → ses thèmes choisis, en groupe comme en privé
set role service_role;
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0301","formule":"groupe","nom":"Base Groupe","telephone":"+2250700000301","age":25,"civilite":"madame","parcours":"base","modules":[3,3,4],"nb_mois":9}'::jsonb, '4.4.6.1');
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0302","formule":"prive_salle","nom":"Base Privée","telephone":"+2250700000302","age":25,"civilite":"madame","parcours":"base","modules":[5],"nb_seances":1}'::jsonb, '4.4.6.2');
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0303","formule":"prive_salle","nom":"Débute Privée","telephone":"+2250700000303","age":25,"civilite":"madame","parcours":"debut","modules":[6],"nb_seances":6}'::jsonb, '4.4.6.3');
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0304","formule":"groupe","nom":"Base Vide","telephone":"+2250700000304","age":25,"parcours":"base","modules":[]}'::jsonb, '4.4.6.4');
reset role;
select essai_refuse($$set role service_role; select formulaire_public_enregistrer('cours_talons', '{"formule":"groupe","nom":"Module piège","telephone":"+2250700000309","age":25,"parcours":"base","modules":[9]}'::jsonb, '4.4.6.9')$$, 'thème inconnu (module 9) : refusé');
reset role;
select essai((select nb_mois = 3 and montant = 90000 from cours_talons where id = '00000000-0000-0000-0000-0000000c0301'), 'groupe, j''ai la base : La prestance 2 mois + Le podium 1 mois = 3 mois, 90 000 (la durée envoyée est ignorée)');
select essai((select nb_seances = 4 and montant = 100000 from cours_talons where id = '00000000-0000-0000-0000-0000000c0302'), 'privé, j''ai la base : Les tenues = 4 séances, 100 000');
select essai((select parcours = 'debut' and modules is null and nb_seances = 6 from cours_talons where id = '00000000-0000-0000-0000-0000000c0303'), 'privé, je débute : 6 séances, modules envoyés ignorés');
select essai((select parcours = 'debut' from cours_talons where id = '00000000-0000-0000-0000-0000000c0304'), 'j''ai la base sans rien cocher : traité comme « je débute »');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select cours_talons_valider('00000000-0000-0000-0000-0000000c0301');
select cours_talons_valider('00000000-0000-0000-0000-0000000c0302');
select cours_talons_valider('00000000-0000-0000-0000-0000000c0303');
select essai((select array_agg(theme order by debut) = array['Regard et expression', 'Gestuelle des mains', 'Poses et arrêts', 'Défilé du mois',
    'Regard et expression (approfondissement)', 'Gestuelle des mains (approfondissement)', 'Poses et arrêts (approfondissement)', 'Défilé du mois (approfondissement)',
    'Marcher en rythme sur la musique', 'Demi-tours et tours complets', 'Défiler à plusieurs', 'Défilé du mois']
  and array_agg(module order by debut) = array[3,3,3,3,3,3,3,3,4,4,4,4] from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0301'), 'groupe, j''ai la base : ses dimanches suivent SES thèmes (La prestance, approfondie, puis Le podium)');
-- privé : l'agence pose les dates, le thème suit tout seul son programme
insert into cours_talons_seances (inscription_id, debut, fin) values ('00000000-0000-0000-0000-0000000c0302', '2030-03-02 10:00Z', '2030-03-02 12:00Z'), ('00000000-0000-0000-0000-0000000c0302', '2030-03-04 10:00Z', '2030-03-04 12:00Z');
insert into cours_talons_seances (inscription_id, debut, fin) values ('00000000-0000-0000-0000-0000000c0303', '2030-03-02 14:00Z', '2030-03-02 16:00Z');
select essai((select array_agg(theme order by debut) = array['Robe longue et traîne', 'Tailleur et tenue courte'] and bool_and(module = 5) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0302')
  and (select theme = 'Posture et équilibre' and module = 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0303'), 'privé : chaque séance ajoutée prend le thème suivant de son programme (Les tenues ; Les bases pour celle qui débute)');
insert into cours_talons_seances (inscription_id, debut, fin, theme) values ('00000000-0000-0000-0000-0000000c0303', '2030-03-03 14:00Z', '2030-03-03 16:00Z', 'Thème choisi par l''agence');
select essai((select count(*) = 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0303' and theme = 'Thème choisi par l''agence' and module is null), 'privé : un thème écrit par l''agence est gardé tel quel');
reset role;
select essai((select programme_talons_lire(jeton)->>'parcours' = 'base' and programme_talons_lire(jeton)->'modules' = '[3, 3, 4]'::jsonb from cours_talons where id = '00000000-0000-0000-0000-0000000c0301'), 'page de l''élève : son parcours et ses thèmes');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-000000000fd3', 'aal2', 30, 'appareil-demande-0003');
select essai_refuse($$select cours_talons_mois_payer('00000000-0000-0000-0000-0000000c0201', 5)$$, 'personne sans rôle : n''encaisse pas de mois');
reset role;
-- une personne sans rôle ne voit ni ne change aucune séance
set role authenticated;
select essai_qui('00000000-0000-0000-0000-000000000fd3', 'aal2', 30, 'appareil-demande-0003');
select essai((select count(*) from cours_talons_seances) = 0, 'personne sans rôle : ne voit aucune séance');
reset role;
