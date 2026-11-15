-- Essais de supabase-rappels-talons.sql (notification la veille de chaque cours de talons, 15/11/2026)
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
-- un groupe de 2 élèves demain à la même heure (dans 23 h 30), un cours privé, une séance faite, une annulée
insert into cours_talons (id, formule, nom, telephone, age, statut, valide_le, civilite, parent_telephone) values
  ('00000000-0000-0000-0000-0000000c0a01', 'groupe', 'Rappel Groupe Un', '+2250700000301', 30, 'inscrite', now(), 'madame', null),
  ('00000000-0000-0000-0000-0000000c0a02', 'groupe', 'Rappel Groupe Deux', '+2250700000302', 30, 'inscrite', now(), 'madame', null),
  ('00000000-0000-0000-0000-0000000c0a03', 'prive_salle', 'Rappel Privee', '+2250700000303', 16, 'inscrite', now(), null, '+2250500000303'),
  ('00000000-0000-0000-0000-0000000c0a04', 'prive_salle', 'Rappel Annulee', '+2250700000304', 30, 'annulee', now(), 'madame', null);
delete from cours_talons_seances where inscription_id in ('00000000-0000-0000-0000-0000000c0a01', '00000000-0000-0000-0000-0000000c0a02', '00000000-0000-0000-0000-0000000c0a03', '00000000-0000-0000-0000-0000000c0a04');
select date_trunc('minute', now() + interval '23 hours 30 minutes') as dem \gset
insert into cours_talons_seances (inscription_id, debut, fin, lieu, theme) values
  ('00000000-0000-0000-0000-0000000c0a01', :'dem', :'dem'::timestamptz + interval '3 hours', 'Salle MA2M, Riviera Faya', 'Posture et équilibre'),
  ('00000000-0000-0000-0000-0000000c0a02', :'dem', :'dem'::timestamptz + interval '3 hours', 'Salle MA2M, Riviera Faya', 'Posture et équilibre'),
  ('00000000-0000-0000-0000-0000000c0a03', :'dem'::timestamptz + interval '10 minutes', :'dem'::timestamptz + interval '130 minutes', 'Cocody Angré', 'Les tenues'),
  ('00000000-0000-0000-0000-0000000c0a04', :'dem', :'dem'::timestamptz + interval '2 hours', 'Salle MA2M, Riviera Faya', null),
  ('00000000-0000-0000-0000-0000000c0a03', now() + interval '48 hours', now() + interval '50 hours', 'Cocody Angré', null);
-- un mois du groupe pas encore réglé (mois 2, 1 mois payé) : pas compté
update cours_talons set mois_payes = 1 where id in ('00000000-0000-0000-0000-0000000c0a01', '00000000-0000-0000-0000-0000000c0a02');
insert into cours_talons (id, formule, nom, telephone, age, statut, valide_le, civilite, nb_mois, paiement, mois_payes) values
  ('00000000-0000-0000-0000-0000000c0a05', 'groupe', 'Rappel Mois Deux', '+2250700000305', 30, 'inscrite', now(), 'madame', 3, 'mensuel', 1);
update cours_talons set mois_payes = 1 where id = '00000000-0000-0000-0000-0000000c0a05';
insert into cours_talons_seances (inscription_id, debut, fin, lieu, mois) values ('00000000-0000-0000-0000-0000000c0a05', :'dem', :'dem'::timestamptz + interval '3 hours', 'Salle MA2M, Riviera Faya', 2);
select essai(cours_talons_rappels_preparer() = 2, 'deux rappels : le groupe en une ligne, le cours privé');
select essai((select nb from cours_talons_rappels where formule = 'groupe' and debut = :'dem') = 2, 'groupe : 2 élèves dans le même rappel');
select essai((select nom from cours_talons_rappels where formule = 'prive_salle' and debut = :'dem'::timestamptz + interval '10 minutes') = 'Mlle Rappel Privee', 'privé : « Mlle » (mineure), son nom');
select essai(not exists (select 1 from cours_talons_rappels where nom like '%Annulee%'), 'inscription annulée : pas de rappel');
select essai(not exists (select 1 from cours_talons_rappels where debut > now() + interval '30 hours'), 'cours dans 2 jours : pas encore');
select essai(cours_talons_rappels_preparer() = 0, 'relancé dans l''heure : jamais deux fois le même rappel');
-- un cours fixé moins de 24 h avant (dans 3 h) : rattrapé à l'heure suivante
insert into cours_talons_seances (inscription_id, debut, fin, lieu) values ('00000000-0000-0000-0000-0000000c0a03', now() + interval '3 hours', now() + interval '5 hours', 'Cocody Angré');
select essai(cours_talons_rappels_preparer() = 1, 'cours fixé moins de 24 h avant : rappel quand même');
-- une séance privée déplacée après son rappel : nouveau rappel pour la nouvelle date
update cours_talons_seances set debut = debut - interval '1 hour', fin = fin - interval '1 hour' where inscription_id = '00000000-0000-0000-0000-0000000c0a03' and debut = :'dem'::timestamptz + interval '10 minutes';
select essai(cours_talons_rappels_preparer() = 1, 'séance déplacée : un nouveau rappel');
select essai(exists (select 1 from pg_trigger where tgname = 'trg_notif_cours_talons_rappels'), 'chaque rappel déclenche la notification');
select essai(exists (select 1 from cron.job where jobname = 'talons-rappels-veille' and schedule = '0 * * * *'), 'préparé toutes les heures');
select essai_refuse($$set role anon; select count(*) from cours_talons_rappels$$, 'visiteur : ne lit pas les rappels');
reset role;
select essai_refuse($$set role anon; select cours_talons_rappels_preparer()$$, 'visiteur : ne lance pas les rappels');
reset role;
