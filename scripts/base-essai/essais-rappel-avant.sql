-- Essais du rappel quelques jours avant (supabase-convocations.sql, ajouts du 23/10/2026) sur la base LOCALE jetable.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
insert into agenda_projets (id, type, titre, date_debut) values ('00000000-0000-0000-0000-0000000000e1', 'defile', 'RAPPEL ESSAI', current_date + 30);
select essai((select rappel_avant and rappel_avant_jours = 3 and rappel_avant_heure = '10:00' from agenda_projets where id = '00000000-0000-0000-0000-0000000000e1'), 'nouveau projet : rappel 3 jours avant à 10h00, coché d''office');
select essai(convocation_heure_rappel_avant(date '2026-11-15', 3, '10:00') = timestamptz '2026-11-12 10:00:00+00', 'heure du rappel : 3 jours avant, 10h00 (Abidjan = UTC)');
insert into convocation_participants (id, projet_id, nom, reponse) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1', 'Mademoiselle Awa', 'confirme'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e1', 'Monsieur Jean', 'absent');
insert into convocation_envois (projet_id, participant_id, sorte, canal, statut, prevu_le) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2', 'rappel_avant', 'email', 'programme', convocation_heure_rappel_avant(current_date + 30, 3, '10:00')),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e3', 'rappel_avant', 'email', 'programme', now() - interval '5 minutes');
-- la date change : le rappel suit
update agenda_projets set date_debut = current_date + 40 where id = '00000000-0000-0000-0000-0000000000e1';
select essai((select prevu_le from convocation_envois where participant_id = '00000000-0000-0000-0000-0000000000e2' and sorte = 'rappel_avant') = convocation_heure_rappel_avant(current_date + 40, 3, '10:00'), 'date du projet changée : le rappel suit');
update agenda_projets set rappel_avant_jours = 5, rappel_avant_heure = '09:30' where id = '00000000-0000-0000-0000-0000000000e1';
select essai((select prevu_le from convocation_envois where participant_id = '00000000-0000-0000-0000-0000000000e2' and sorte = 'rappel_avant') = convocation_heure_rappel_avant(current_date + 40, 5, '09:30'), 'réglage changé (5 jours, 9h30) : le rappel suit');
update agenda_projets set rappel_avant = false where id = '00000000-0000-0000-0000-0000000000e1';
select essai((select statut from convocation_envois where participant_id = '00000000-0000-0000-0000-0000000000e2' and sorte = 'rappel_avant') = 'annule', 'rappel décoché : annulé');
update agenda_projets set rappel_avant = true where id = '00000000-0000-0000-0000-0000000000e1';
select essai((select statut from convocation_envois where participant_id = '00000000-0000-0000-0000-0000000000e2' and sorte = 'rappel_avant') = 'programme', 'rappel recoché : de nouveau programmé');
select essai_refuse('update agenda_projets set rappel_avant_jours = 1 where id = ''00000000-0000-0000-0000-0000000000e1''', 'rappel « 1 jour avant » refusé (c''est le rappel de la veille)');
-- l'envoi du serveur : la personne « absente » ne reçoit pas de rappel
update convocation_envois set statut = 'programme', prevu_le = now() - interval '5 minutes' where participant_id = '00000000-0000-0000-0000-0000000000e3';
create temp table tour1 as select convocations_a_traiter() as v;
select essai(not ((select v from tour1)::text like '%00000000-0000-0000-0000-0000000000e3%') and (select statut from convocation_envois where participant_id = '00000000-0000-0000-0000-0000000000e3') = 'programme', 'personne absente : son rappel n''est pas envoyé (il reste en attente)');
-- elle change d'avis : son rappel repart
update convocation_participants set reponse = 'confirme' where id = '00000000-0000-0000-0000-0000000000e3';
create temp table tour1b as select convocations_a_traiter() as v;
select essai((select v from tour1b)::text like '%00000000-0000-0000-0000-0000000000e3%', 'elle se ravise et confirme : son rappel part');
update convocation_envois set prevu_le = now() - interval '5 minutes' where participant_id = '00000000-0000-0000-0000-0000000000e2';
create temp table tour2 as select convocations_a_traiter() as v;
select essai(exists (select 1 from jsonb_array_elements((select v from tour2)) x where x ->> 'sorte' = 'rappel_avant' and x -> 'participant' ->> 'id' = '00000000-0000-0000-0000-0000000000e2'), 'personne qui a confirmé : son rappel part à l''heure');
