-- Essais de supabase-sans-effacement-auto.sql (17/11/2026) : plus aucun effacement automatique
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into casting_applications (id, full_name, email, status, statut_change_at) values
  ('00000000-0000-0000-0000-0000000e5a01', 'ESSAI VIEILLE REFUSEE', 'essai@test.ci', 'refusée', now() - interval '400 days') on conflict do nothing;
insert into casting_photos (application_id, url, chemin) values ('00000000-0000-0000-0000-0000000e5a01', 'r2:candidatures/00000000-0000-0000-0000-0000000e5a01/a.jpg', 'r2:candidatures/00000000-0000-0000-0000-0000000e5a01/a.jpg');
select essai(nettoyer_photos_traitees_anciennes() = 0 and effacer_anciennes_candidatures() = 0, 'les deux anciennes règles ne font plus rien');
select essai((select count(*) from casting_photos where application_id = '00000000-0000-0000-0000-0000000e5a01') = 1
  and (select count(*) from casting_applications where id = '00000000-0000-0000-0000-0000000e5a01') = 1, 'vieille candidature refusée : dossier et photo gardés');
select essai(not exists (select 1 from cron.job where jobname in ('nettoyage-photos-traitees', 'effacement-anciennes-candidatures')), 'plus de tâche de nuit d''effacement');
delete from casting_applications where id = '00000000-0000-0000-0000-0000000e5a01';
