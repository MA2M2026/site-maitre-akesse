-- Essais de supabase-creneaux-prives.sql (cours privés : créneaux libres choisis à l'inscription, 14/11/2026)
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
-- un mardi dans une à deux semaines (Abidjan = UTC)
select (current_date + 7 + ((2 - extract(dow from current_date + 7)::int + 7) % 7))::date as mardi \gset
select essai(extract(isodow from :'mardi'::date) = 2, 'jour d''essai : un mardi');
-- le visiteur lit les heures libres : du lundi au samedi, 10 h à 18 h pile, jamais le dimanche
set role anon;
select essai((select count(*) from cours_talons_creneaux_libres(:'mardi', 1)) = 9, 'un mardi libre : 9 heures de début (10 h à 18 h)');
select essai((select count(*) from cours_talons_creneaux_libres(:'mardi'::date - 2, 1)) = 0, 'le dimanche : aucun créneau privé');
select essai((select count(*) from cours_talons_creneaux_libres(current_date - 3, 3)) = 0, 'rien dans le passé ni aujourd''hui');
select essai_refuse($$set role anon; select cours_talons_creneau_libre(now())$$, 'visiteur : n''appelle pas la vérification interne');
reset role;
-- une élève réserve mardi 14 h (2 séances : mardi 14 h et le mardi suivant 14 h)
set role service_role;
select formulaire_public_enregistrer('cours_talons', jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0901', 'formule', 'prive_salle', 'nb_seances', 2,
  'nom', 'Créneau Une', 'telephone', '+2250700000201', 'age', 30, 'decision', 'plus_tard',
  'creneaux', jsonb_build_array((:'mardi'::date + time '14:00') at time zone 'UTC', (:'mardi'::date + 7 + time '14:00') at time zone 'UTC')), '4.4.5.1');
reset role;
select essai((select count(*) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0901') = 2, 'ses 2 créneaux sont réservés (2 séances)');
select essai((select bool_and(fin - debut = interval '2 hours' and lieu = 'Salle MA2M, Riviera Faya' and theme is not null) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0901'), 'séances de 2 h, à la salle, avec leur thème');
select essai((select date_seance = :'mardi'::date from cours_talons where id = '00000000-0000-0000-0000-0000000c0901'), 'date de première séance = le premier créneau');
-- 14 h – 16 h pris, 1 h 30 de pause : 11 h, 12 h, 13 h, 14 h, 15 h, 16 h, 17 h pris ; restent 10 h et 18 h
set role anon;
select essai((select array_agg(extract(hour from t at time zone 'UTC')::int order by t) from cours_talons_creneaux_libres(:'mardi', 1) t) = array[10, 18], 'mardi : restent 10 h et 18 h (1 h 30 de pause autour de 14 h – 16 h)');
reset role;
-- une autre élève essaie 15 h le même mardi : refusé, rien n'est enregistré
select essai_refuse($$set role service_role; select formulaire_public_enregistrer('cours_talons', jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0902', 'formule', 'prive_exterieur', 'nb_seances', 1,
  'nom', 'Créneau Deux', 'telephone', '+2250700000202', 'age', 30, 'adresse', 'Cocody', 'creneaux', jsonb_build_array((current_date + 7 + ((2 - extract(dow from current_date + 7)::int + 7) % 7) + time '15:00') at time zone 'UTC')), '4.4.5.2')$$, 'créneau déjà pris : refusé (CRENEAU_PRIS)');
reset role;
select essai(not exists (select 1 from cours_talons where id = '00000000-0000-0000-0000-0000000c0902'), 'créneau pris : l''inscription n''est pas enregistrée');
-- 18 h à l'extérieur : accepté, à son adresse
set role service_role;
select formulaire_public_enregistrer('cours_talons', jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0903', 'formule', 'prive_exterieur', 'nb_seances', 1,
  'nom', 'Créneau Trois', 'telephone', '+2250700000203', 'age', 30, 'adresse', 'Cocody Angré', 'creneaux', jsonb_build_array((:'mardi'::date + time '18:00') at time zone 'UTC')), '4.4.5.3');
reset role;
select essai((select lieu from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0903') = 'Cocody Angré', 'à l''extérieur : la séance est à son adresse');
-- ses propres créneaux trop proches (10 h et 12 h) : refusés ; un dimanche ou 19 h : refusés ; trop de créneaux : refusés
select essai_refuse($$set role service_role; select formulaire_public_enregistrer('cours_talons', jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0904', 'formule', 'prive_salle', 'nb_seances', 2,
  'nom', 'Trop Proches', 'telephone', '+2250700000204', 'age', 30, 'creneaux', jsonb_build_array((current_date + 30 + time '10:00') at time zone 'UTC', (current_date + 30 + time '12:00') at time zone 'UTC')), '4.4.5.4')$$, 'deux séances à moins de 1 h 30 de pause : refusées');
reset role;
select essai_refuse($$set role service_role; select formulaire_public_enregistrer('cours_talons', jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0905', 'formule', 'prive_salle', 'nb_seances', 1,
  'nom', 'Le Soir', 'telephone', '+2250700000205', 'age', 30, 'creneaux', jsonb_build_array((current_date + 30 + time '19:00') at time zone 'UTC')), '4.4.5.5')$$, '19 h (finirait après 20 h) : refusé');
reset role;
select essai_refuse($$set role service_role; select formulaire_public_enregistrer('cours_talons', jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0906', 'formule', 'prive_salle', 'nb_seances', 1,
  'nom', 'Trop', 'telephone', '+2250700000206', 'age', 30, 'creneaux', jsonb_build_array((current_date + 40 + time '10:00') at time zone 'UTC', (current_date + 41 + time '10:00') at time zone 'UTC')), '4.4.5.6')$$, 'plus de créneaux que de séances : refusé');
reset role;
-- « dates à convenir ensemble » : aucun créneau, rien de réservé
set role service_role;
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0907","formule":"prive_salle","nb_seances":3,"nom":"A Convenir","telephone":"+2250700000207","age":30}'::jsonb, '4.4.5.7');
reset role;
select essai((select creneaux is null from cours_talons where id = '00000000-0000-0000-0000-0000000c0907') and not exists (select 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0907'), 'dates à convenir : aucune séance réservée');
-- « paiement envoyé » (à vérifier par l'agence) : gardé même après 48 h
set role service_role;
select formulaire_public_enregistrer('cours_talons', jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0909', 'formule', 'prive_salle', 'nb_seances', 1, 'decision', 'maintenant',
  'nom', 'Paiement Envoye', 'telephone', '+2250700000209', 'age', 30, 'creneaux', jsonb_build_array((:'mardi'::date + 1 + time '10:00') at time zone 'UTC')), '4.4.5.9');
reset role;
update cours_talons set cree_le = now() - interval '5 days' where id = '00000000-0000-0000-0000-0000000c0909';
select essai((select statut from cours_talons where id = '00000000-0000-0000-0000-0000000c0909') = 'paiement_envoye', 'payé à l''inscription : statut « paiement envoyé »');
set role anon;
select essai((select min(extract(hour from t at time zone 'UTC')) from cours_talons_creneaux_libres(:'mardi'::date + 1, 1) t) = 14, 'paiement envoyé il y a 5 jours : son créneau reste gardé (pas avant 14 h le mercredi)');
reset role;
-- une séance ajoutée À LA MAIN par l'agence pour une élève « plus tard » : jamais libérée au bout de 48 h
insert into cours_talons_seances (inscription_id, debut, fin, lieu) values ('00000000-0000-0000-0000-0000000c0907', (:'mardi'::date + 3 + time '10:00') at time zone 'UTC', (:'mardi'::date + 3 + time '12:00') at time zone 'UTC', 'Salle MA2M, Riviera Faya');
update cours_talons set cree_le = now() - interval '5 days' where id = '00000000-0000-0000-0000-0000000c0907';
set role anon;
select essai((select min(extract(hour from t at time zone 'UTC')) from cours_talons_creneaux_libres(:'mardi'::date + 3, 1) t) = 14, 'séance fixée à la main par l''agence : reste occupée');
reset role;
-- 48 h sans paiement : les créneaux redeviennent libres ; une fois payée, ils restent pris
update cours_talons set cree_le = now() - interval '49 hours' where id in ('00000000-0000-0000-0000-0000000c0901', '00000000-0000-0000-0000-0000000c0903');
set role anon;
select essai((select count(*) from cours_talons_creneaux_libres(:'mardi', 1)) = 9, 'plus de 48 h sans paiement : le mardi redevient libre');
reset role;
update cours_talons set statut = 'inscrite', valide_le = now() where id = '00000000-0000-0000-0000-0000000c0901';
select essai(exists (select 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0903'), 'réservation expirée : encore là tant que personne ne réserve');
set role anon;
select essai((select array_agg(extract(hour from t at time zone 'UTC')::int order by t) from cours_talons_creneaux_libres(:'mardi', 1) t) = array[10, 18], 'payée : ses créneaux restent pris');
reset role;
update cours_talons set statut = 'annulee' where id = '00000000-0000-0000-0000-0000000c0901';
set role anon;
select essai((select count(*) from cours_talons_creneaux_libres(:'mardi', 1)) = 9, 'inscription annulée : ses créneaux sont libérés');
select essai((select count(*) from cours_talons_creneaux_libres(current_date, 900)) <= 250 * 9, 'au plus 250 jours lus d''un coup');
reset role;
-- le groupe ignore les créneaux
set role service_role;
select formulaire_public_enregistrer('cours_talons', jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0908', 'formule', 'groupe', 'nom', 'Groupe Creneau', 'telephone', '+2250700000208', 'age', 30,
  'creneaux', jsonb_build_array((current_date + 50 + time '10:00') at time zone 'UTC')), '4.4.5.8');
reset role;
select essai((select creneaux is null from cours_talons where id = '00000000-0000-0000-0000-0000000c0908') and not exists (select 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0908'), 'groupe : les créneaux sont ignorés');
-- une nouvelle réservation retire les réservations expirées (jamais celles d'une élève payée ni les séances à la main)
set role service_role;
select formulaire_public_enregistrer('cours_talons', jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0910', 'formule', 'prive_salle', 'nb_seances', 1,
  'nom', 'Nouvelle Venue', 'telephone', '+2250700000210', 'age', 30, 'creneaux', jsonb_build_array((current_date + 60 + time '10:00') at time zone 'UTC')), '4.4.5.10');
reset role;
select essai(not exists (select 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0903'), 'réservation expirée retirée à la réservation suivante');
select essai(exists (select 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0907') and exists (select 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0909'), 'séance à la main et « paiement envoyé » : gardées');
select essai((select bool_and(reservee) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0910'), 'séance réservée par l''élève : marquée « réservée »');
-- v2 (15/11/2026) : indisponibilités de l'agence ; « je choisirai après mon paiement » ; déplacer une séance
select (current_date + 70 + ((3 - extract(dow from current_date + 70)::int + 7) % 7))::date as merc \gset
-- l'agence n'est pas là le mercredi de 10 h à 14 h
insert into cours_talons_indispo (debut, fin, raison) values ((:'merc'::date + time '10:00') at time zone 'UTC', (:'merc'::date + time '14:00') at time zone 'UTC', 'Shooting');
set role anon;
select essai((select array_agg(extract(hour from t at time zone 'UTC')::int order by t) from cours_talons_creneaux_libres(:'merc', 1) t) = array[14, 15, 16, 17, 18], 'indisponibilité de 10 h à 14 h : rien proposé avant 14 h');
select essai_refuse($$set role anon; select count(*) from cours_talons_indispo$$, 'visiteur : ne lit pas les indisponibilités');
reset role;
select essai_refuse($$set role service_role; select formulaire_public_enregistrer('cours_talons', jsonb_build_object('id', '00000000-0000-0000-0000-0000000c0911', 'formule', 'prive_salle', 'nb_seances', 1,
  'nom', 'Pendant Indispo', 'telephone', '+2250700000211', 'age', 30, 'creneaux', jsonb_build_array((current_date + 70 + ((3 - extract(dow from current_date + 70)::int + 7) % 7) + time '12:00') at time zone 'UTC')), '4.4.5.11')$$, 'réserver pendant une indisponibilité : refusé');
reset role;
-- « je choisirai après mon paiement » : rien de réservé, puis elle choisit sur son lien une fois payée
set role service_role;
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0912","formule":"prive_salle","nb_seances":3,"nom":"Choisira Apres","telephone":"+2250700000212","age":30,"choix_creneaux":"apres"}'::jsonb, '4.4.5.12');
select formulaire_public_enregistrer('cours_talons', '{"id":"00000000-0000-0000-0000-0000000c0913","formule":"prive_salle","nb_seances":1,"nom":"Faux Maintenant","telephone":"+2250700000213","age":30,"choix_creneaux":"maintenant"}'::jsonb, '4.4.5.13');
reset role;
select essai((select choix_creneaux from cours_talons where id = '00000000-0000-0000-0000-0000000c0912') = 'apres' and not exists (select 1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0912'), '« après mon paiement » : noté, rien de réservé');
select essai((select choix_creneaux from cours_talons where id = '00000000-0000-0000-0000-0000000c0913') = 'convenir', '« maintenant » sans aucun créneau : rangé dans « à convenir »');
select jeton as japres from cours_talons where id = '00000000-0000-0000-0000-0000000c0912' \gset
select essai_refuse($$set role anon; select programme_talons_choisir('$$ || :'japres' || $$', array[(current_date + 80 + time '10:00') at time zone 'UTC'])$$, 'avant le paiement : elle ne peut pas encore choisir');
reset role;
update cours_talons set statut = 'inscrite', valide_le = now() where id = '00000000-0000-0000-0000-0000000c0912';
select (current_date + 90 + ((1 - extract(dow from current_date + 90)::int + 7) % 7))::date as lundi \gset
set role anon;
select essai(programme_talons_choisir(:'japres', array[(:'lundi'::date + time '10:00') at time zone 'UTC', (:'lundi'::date + 7 + time '10:00') at time zone 'UTC']) = 2, 'payée : elle choisit 2 créneaux sur son lien');
reset role;
select essai((select count(*) from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0912') = 2, 'ses 2 séances sont dans son programme');
select essai_refuse($$set role anon; select programme_talons_choisir('$$ || :'japres' || $$', array[(current_date + 120 + time '10:00') at time zone 'UTC', (current_date + 121 + time '10:00') at time zone 'UTC'])$$, 'plus que les séances restantes (1) : refusé');
reset role;
select essai_refuse($$set role anon; select programme_talons_choisir('$$ || :'japres' || $$', array[(current_date + 90 + ((1 - extract(dow from current_date + 90)::int + 7) % 7) + time '12:00') at time zone 'UTC'])$$, 'à moins de 1 h 30 de sa propre séance : refusé');
reset role;
select essai_refuse($$set role anon; select programme_talons_choisir('ffffffffffffffffffffffffffffffffffff', array[(current_date + 130 + time '10:00') at time zone 'UTC'])$$, 'mauvais lien : refusé');
reset role;
-- déplacer : la séance du lundi passe au mardi 15 h ; jamais à moins de 24 h, jamais la séance d'une autre
select id as s1 from cours_talons_seances where inscription_id = '00000000-0000-0000-0000-0000000c0912' order by debut limit 1 \gset
set role anon;
select essai(programme_talons_deplacer(:'japres', :'s1', (:'lundi'::date + 1 + time '15:00') at time zone 'UTC'), 'elle déplace sa séance au mardi 15 h');
reset role;
select essai((select debut = (:'lundi'::date + 1 + time '15:00') at time zone 'UTC' and fin - debut = interval '2 hours' from cours_talons_seances where id = :'s1'), 'séance déplacée, toujours 2 h');
set role anon;
select essai(programme_talons_deplacer(:'japres', :'s1', (:'lundi'::date + 1 + time '16:00') at time zone 'UTC'), 'déplacer d''une heure seulement : permis (sa propre séance ne la bloque pas)');
reset role;
update cours_talons_seances set debut = now() + interval '20 hours', fin = now() + interval '22 hours' where id = :'s1';
select essai_refuse($$set role anon; select programme_talons_deplacer('$$ || :'japres' || $$', '$$ || :'s1' || $$', (current_date + 140 + time '10:00') at time zone 'UTC')$$, 'à moins de 24 h : plus déplaçable');
reset role;
select id as autre from cours_talons_seances where inscription_id <> '00000000-0000-0000-0000-0000000c0912' limit 1 \gset
select essai_refuse($$set role anon; select programme_talons_deplacer('$$ || :'japres' || $$', '$$ || :'autre' || $$', (current_date + 150 + time '10:00') at time zone 'UTC')$$, 'la séance d''une autre élève : refusé');
reset role;
-- « Déplacer » : sur sa page, les heures voisines de SA séance ne sont pas bloquées par elle (jamais celles d'une autre)
update cours_talons_seances set debut = (:'lundi'::date + 14 + time '14:00') at time zone 'UTC', fin = (:'lundi'::date + 14 + time '16:00') at time zone 'UTC' where id = :'s1';
set role anon;
select essai((select count(*) from cours_talons_creneaux_libres(:'lundi'::date + 14, 1)) = 2, 'lundi avec sa séance de 14 h : seulement 10 h et 18 h pour les autres');
select essai((select count(*) from cours_talons_creneaux_libres(:'lundi'::date + 14, 1, :'japres', :'s1')) = 9, 'en la déplaçant : toutes les heures du lundi lui sont proposées');
select essai((select count(*) from cours_talons_creneaux_libres(:'lundi'::date + 14, 1, 'ffffffffffffffffffffffffffffffffffff', :'s1')) = 2, 'un autre lien ne libère pas sa séance');
select essai(programme_talons_lire(:'japres')->>'choix_creneaux' = 'apres', 'sa page connaît sa façon de choisir (« après »)');
reset role;
-- « à convenir » : l'agence fixe les dates, la page ne laisse pas choisir
update cours_talons set statut = 'inscrite', valide_le = now(), choix_creneaux = 'convenir' where id = '00000000-0000-0000-0000-0000000c0907';
select jeton as jconv from cours_talons where id = '00000000-0000-0000-0000-0000000c0907' \gset
select essai_refuse($$set role anon; select programme_talons_choisir('$$ || :'jconv' || $$', array[(current_date + 160 + time '10:00') at time zone 'UTC'])$$, '« à convenir » : elle ne choisit pas elle-même');
reset role;
