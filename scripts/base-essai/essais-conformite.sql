-- Essais de supabase-conformite-consentement-traces.sql (23/11/2026). Base LOCALE et jetable : jamais la vraie base.

-- 1. un message de contact envoyé par le site : version de la politique gardée, date posée par la base (pas par la page)
reset role;
set role service_role;
select formulaire_public_enregistrer('messages_contact',
  '{"id":"00000000-0000-0000-0000-0000000c0001","nom":"Essai Consentement","email":"c@test.ci","message":"bonjour","politique_version":"2026-11-23","consentement_le":"2000-01-01T00:00:00Z"}'::jsonb, '7.7.8.1');
reset role;
select essai(exists (select 1 from messages_contact where id = '00000000-0000-0000-0000-0000000c0001'
                and politique_version = '2026-11-23' and consentement_le > now() - interval '1 minute'),
             'consentement : version gardée, date posée par la base (la date envoyée par la page est ignorée)');

-- 2. une fiche créée sans la case (ex. par l agence) : pas de fausse preuve
insert into messages_contact (id, nom, email, message) values ('00000000-0000-0000-0000-0000000c0002', 'Sans Case', 's@test.ci', 'x');
select essai((select consentement_le is null and politique_version is null from messages_contact where id = '00000000-0000-0000-0000-0000000c0002'),
             'sans version de la politique : aucune date de consentement inventée');

-- 3. la preuve ne se modifie pas après coup
update messages_contact set politique_version = 'falsifiee', consentement_le = '2001-01-01' where id = '00000000-0000-0000-0000-0000000c0001';
select essai((select politique_version = '2026-11-23' and consentement_le > now() - interval '1 minute' from messages_contact where id = '00000000-0000-0000-0000-0000000c0001'),
             'la preuve du consentement ne peut pas être modifiée');

-- 4. effacement des traces techniques : seulement les vieilles traces, jamais les dossiers
insert into page_views (created_at) values (now() - interval '15 months'), (now() - interval '2 months');
insert into journal_erreurs (message, created_at) values ('vieille erreur essai', now() - interval '7 months'), ('erreur recente essai', now() - interval '1 month');
insert into audit_log (action, cree_le) values ('vieille action essai', now() - interval '13 months'), ('action recente essai', now() - interval '1 month');
insert into soumissions_formulaires_publics_ip (formulaire, ip, cree_le) values ('contact', '9.9.9.1', now() - interval '13 months'), ('contact', '9.9.9.2', now() - interval '1 day');
insert into connexion_tentatives_ip (ip, espace, derniere_tentative, bloque_jusqua) values
  ('9.9.9.3', 'essai', now() - interval '13 months', null), ('9.9.9.4', 'essai', now() - interval '13 months', now() + interval '1 day');
insert into connexion_tentatives_compte (identifiant, espace, derniere_tentative) values ('vieux-essai', 'essai', now() - interval '13 months'), ('recent-essai', 'essai', now() - interval '1 day');
insert into blocages_connexion (ip, identifiant, espace, duree_minutes, cree_le) values ('9.9.9.5', 'vieux-essai', 'essai', 15, now() - interval '13 months'), ('9.9.9.6', 'recent-essai', 'essai', 15, now() - interval '1 day');
update messages_contact set created_at = now() - interval '5 years' where id = '00000000-0000-0000-0000-0000000c0002';
select set_config('essai.dossiers', (select count(*) from casting_applications)::text || '/' || (select count(*) from messages_contact)::text || '/' || (select count(*) from cours_talons)::text || '/' || (select count(*) from recruiter_requests)::text || '/' || (select count(*) from inscriptions_mannequins)::text, false);
select effacer_traces_techniques();
select essai(not exists (select 1 from page_views where created_at < now() - interval '14 months') and exists (select 1 from page_views where created_at > now() - interval '3 months'),
             'statistiques : plus de 14 mois effacées, récentes gardées');
select essai(not exists (select 1 from journal_erreurs where message = 'vieille erreur essai') and exists (select 1 from journal_erreurs where message = 'erreur recente essai'),
             'erreurs techniques : plus de 6 mois effacées, récentes gardées');
select essai(exists (select 1 from audit_log where action = 'vieille action essai'),
             'journal de l équipe : jamais effacé (écriture seule, sécurité)');
select essai(not exists (select 1 from soumissions_formulaires_publics_ip where ip = '9.9.9.1') and exists (select 1 from soumissions_formulaires_publics_ip where ip = '9.9.9.2'),
             'adresses IP des formulaires : plus de 12 mois effacées');
select essai(not exists (select 1 from connexion_tentatives_ip where ip = '9.9.9.3') and exists (select 1 from connexion_tentatives_ip where ip = '9.9.9.4'),
             'adresses IP des connexions : vieilles effacées, mais pas une adresse encore bloquée');
select essai(not exists (select 1 from connexion_tentatives_compte where identifiant = 'vieux-essai') and exists (select 1 from connexion_tentatives_compte where identifiant = 'recent-essai')
             and not exists (select 1 from blocages_connexion where ip = '9.9.9.5') and exists (select 1 from blocages_connexion where ip = '9.9.9.6'),
             'compteurs et journal des blocages de connexion : plus de 12 mois effacés');
select essai(current_setting('essai.dossiers') = (select count(*) from casting_applications)::text || '/' || (select count(*) from messages_contact)::text || '/' || (select count(*) from cours_talons)::text || '/' || (select count(*) from recruiter_requests)::text || '/' || (select count(*) from inscriptions_mannequins)::text,
             'aucun dossier effacé (candidatures, messages, cours de talons, recruteurs, inscriptions)');
select essai(not has_function_privilege('anon', 'effacer_traces_techniques()', 'execute') and not has_function_privilege('authenticated', 'effacer_traces_techniques()', 'execute'),
             'personne ne peut lancer l effacement depuis le site');
