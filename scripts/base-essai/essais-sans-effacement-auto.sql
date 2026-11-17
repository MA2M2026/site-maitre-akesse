-- Essais de supabase-sans-effacement-auto.sql (17/11/2026) : plus aucune photo retirée ; une seule règle automatique,
-- celle de la politique de confidentialité (candidature refusée ou inscription annulée effacée après 2 ans)
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into casting_applications (id, full_name, email, status) values
  ('00000000-0000-0000-0000-0000000e5a01', 'ESSAI REFUSEE 400 JOURS', 'essai@test.ci', 'refusée'),
  ('00000000-0000-0000-0000-0000000e5a02', 'ESSAI REFUSEE 3 ANS', 'essai@test.ci', 'refusée'),
  ('00000000-0000-0000-0000-0000000e5a03', 'ESSAI RETENUE 3 ANS', 'essai@test.ci', 'retenue') on conflict do nothing;
-- (statut et date posés après coup : des déclencheurs remettent « nouvelle » et la date du jour)
alter table casting_applications disable trigger user;
update casting_applications set status = 'refusée', statut_change_at = now() - interval '400 days' where id = '00000000-0000-0000-0000-0000000e5a01';
update casting_applications set status = 'refusée', statut_change_at = now() - interval '3 years' where id = '00000000-0000-0000-0000-0000000e5a02';
update casting_applications set status = 'retenue', statut_change_at = now() - interval '3 years' where id = '00000000-0000-0000-0000-0000000e5a03';
alter table casting_applications enable trigger user;
insert into casting_photos (application_id, url, chemin) values
  ('00000000-0000-0000-0000-0000000e5a01', 'r2:candidatures/00000000-0000-0000-0000-0000000e5a01/a.jpg', 'r2:candidatures/00000000-0000-0000-0000-0000000e5a01/a.jpg'),
  ('00000000-0000-0000-0000-0000000e5a03', 'r2:candidatures/00000000-0000-0000-0000-0000000e5a03/a.jpg', 'r2:candidatures/00000000-0000-0000-0000-0000000e5a03/a.jpg');
insert into inscriptions_mannequins (id, full_name, statut) values ('00000000-0000-0000-0000-0000000e5b01', 'ESSAI INSCRIPTION PAYEE', 'payée') on conflict do nothing;
alter table inscriptions_mannequins disable trigger user;
update inscriptions_mannequins set statut = 'payée', statut_change_at = now() - interval '30 days' where id = '00000000-0000-0000-0000-0000000e5b01';
alter table inscriptions_mannequins enable trigger user;
insert into inscriptions_photos (inscription_id, url) values ('00000000-0000-0000-0000-0000000e5b01', 'https://drive.google.com/thumbnail?id=essai');

select essai(nettoyer_photos_traitees_anciennes() = 0, 'l ancien nettoyage des photos ne fait plus rien');
select essai((select count(*) from casting_photos where application_id in ('00000000-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5a03')) = 2
  and (select count(*) from inscriptions_photos where inscription_id = '00000000-0000-0000-0000-0000000e5b01') = 1,
  'photos des candidatures traitées et des inscriptions payées : gardées');
select essai(effacer_anciennes_candidatures() = 1, 'règle des 2 ans : une seule candidature effacée');
select essai((select count(*) from casting_applications where id = '00000000-0000-0000-0000-0000000e5a02') = 0
  and (select count(*) from casting_applications where id in ('00000000-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5a03')) = 2,
  'refusée depuis 3 ans : effacée ; refusée depuis 400 jours et retenue depuis 3 ans : gardées');
select essai(not exists (select 1 from cron.job where jobname in ('nettoyage-photos-traitees', 'effacement-anciennes-candidatures'))
  and exists (select 1 from cron.job where jobname = 'effacement-candidatures-2-ans'), 'tâches de nuit : seulement la règle des 2 ans');
delete from casting_applications where id in ('00000000-0000-0000-0000-0000000e5a01', '00000000-0000-0000-0000-0000000e5a03');
delete from inscriptions_mannequins where id = '00000000-0000-0000-0000-0000000e5b01';
