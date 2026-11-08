-- Essais de supabase-securite-appareils.sql (Extension 158, 08/11/2026) : les parties anciennes de l'Administration
-- (règles fondées sur « admins », fonctions qui lisent « admins ») suivent maintenant les verrous de l'appareil,
-- comme les espaces récents : appareil en règle → ouvert ; écran verrouillé (15 minutes), appareil révoqué, sans
-- identifiant d'appareil, sans double authentification → fermé. L'écran de verrouillage marche toujours.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
-- (le principal a1 dans « admins », comme après une connexion complète ; une mannequin avec son numéro)
insert into admins (user_id) values ('00000000-0000-0000-0000-0000000000a1') on conflict (user_id) do nothing;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c158', 'mannequin158@test.ci') on conflict do nothing;
insert into model_profiles (id, full_name, phone) values ('00000000-0000-0000-0000-00000000c158', 'ESSAI CENT CINQUANTE-HUIT', '0700000158') on conflict (id) do nothing;
-- (appareil verrouillé : code à 4 chiffres en place, 20 minutes sans activité)
insert into staff_codes_appareil (user_id, appareil, code_hash, derniere_activite, verrouille, essais)
values ('00000000-0000-0000-0000-0000000000a1', 'appareil-verrou-0158', extensions.crypt('1580', extensions.gen_salt('bf')), now() - interval '20 minutes', false, 0)
on conflict (user_id, appareil) do update set code_hash = excluded.code_hash, derniere_activite = excluded.derniere_activite, verrouille = false, verrouille_le = null, essais = 0;
-- (appareil révoqué)
insert into staff_devices (user_id, appareil, libelle) values ('00000000-0000-0000-0000-0000000000a1', 'appareil-revoque-0158', 'Téléphone perdu') on conflict (user_id, appareil) do nothing;
alter table staff_devices disable trigger user;
update staff_devices set revoque = true where appareil = 'appareil-revoque-0158';
alter table staff_devices enable trigger user;
select essai(not (select pg_get_functiondef('contacts_mannequins_admin()'::regprocedure)) ~ 'portail_mfa_ok\(\)', 'fonctions anciennes : la règle complète remplace la seule double authentification');
-- (relecture du 08/11/2026) l'ancien code de validation, appelé par le serveur sans l'en-tête de l'appareil, garde sa règle
select essai(to_regprocedure('verifier_code_validation(text)') is null or pg_get_functiondef('verifier_code_validation(text)'::regprocedure) !~ 'portail_admin_ok', 'ancien code de validation : inchangé (le serveur l''appelle sans identifiant d''appareil)');

set role authenticated;
-- appareil en règle : tout s'ouvre comme avant
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 30, 'appareil-essai-0158');
select essai(portail_admin_ok(), 'appareil en règle : portail_admin_ok');
select essai(exists (select 1 from admins where user_id = auth.uid()), 'appareil en règle : la base reconnaît l''administratrice');
select essai(exists (select 1 from contacts_mannequins_admin() where model_id = '00000000-0000-0000-0000-00000000c158'), 'appareil en règle : contacts des mannequins lisibles');
select essai(exists (select 1 from profils_prives(array['00000000-0000-0000-0000-00000000c158']::uuid[])), 'appareil en règle : profils privés lisibles');

-- écran verrouillé (15 minutes sans activité, dernier code de l'application il y a 1 heure)
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 3600, 'appareil-verrou-0158');
select essai(not portail_admin_ok(), 'écran verrouillé : fermé');
select essai(not exists (select 1 from admins where user_id = auth.uid()), 'écran verrouillé : règles anciennes fermées (candidatures, fiches…)');
select essai(not exists (select 1 from contacts_mannequins_admin()), 'écran verrouillé : contacts des mannequins fermés');
select essai(not exists (select 1 from profils_prives(array['00000000-0000-0000-0000-00000000c158']::uuid[])), 'écran verrouillé : profils privés fermés');
-- l'écran de verrouillage marche toujours : le code à 4 chiffres rouvre tout
select essai((portail_code_appareil_etat('appareil-verrou-0158') ->> 'verrouille')::boolean, 'écran de verrouillage : il demande le code');
select essai(portail_code_appareil_verifier('appareil-verrou-0158', '1580') ->> 'ok' = 'true', 'le code à 4 chiffres déverrouille');
select essai(portail_admin_ok() and exists (select 1 from contacts_mannequins_admin()), 'après le code : de nouveau ouvert');

-- appareil révoqué, sans identifiant d'appareil, sans double authentification : fermé
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 30, 'appareil-revoque-0158');
select essai(not portail_admin_ok() and not exists (select 1 from contacts_mannequins_admin()), 'appareil révoqué : fermé');
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 30, '');
select essai(not portail_admin_ok() and not exists (select 1 from admins where user_id = auth.uid()), 'sans identifiant d''appareil : fermé');
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal1', 30, 'appareil-essai-0158');
select essai(not portail_admin_ok() and not exists (select 1 from contacts_mannequins_admin()), 'sans double authentification : fermé (comme avant)');

-- site vivant : préparer le lien d'accord d'un parent suit la même règle
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 3600, 'appareil-verrou-0158');
reset role;
update staff_codes_appareil set derniere_activite = now() - interval '20 minutes', verrouille = false, verrouille_le = null where appareil = 'appareil-verrou-0158';
set role authenticated;
select essai_refuse($$select accord_parent_demander('00000000-0000-0000-0000-00000000c158')$$, 'écran verrouillé : pas de lien d''accord du parent');
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 30, 'appareil-essai-0158');
select essai(accord_parent_demander('00000000-0000-0000-0000-00000000c158') is not null, 'appareil en règle : lien d''accord du parent préparé');
-- (correction du 08/11/2026) un simple visiteur : le site public se lit toujours (fiches et photos publiées), il n'est
-- jamais administratrice. Le droit manquait : plus aucune mannequin ni photo sur le site en ligne.
reset role;
update model_profiles set published = true where id = '00000000-0000-0000-0000-00000000c158';
select set_config('request.jwt.claims', '', false);
set role anon;
select essai(exists (select 1 from model_profiles where published), 'visiteur : les fiches publiées se lisent');
select essai((select count(*) >= 0 from model_photos), 'visiteur : les photos se lisent (aucun refus)');
select essai(not portail_admin_ok(), 'visiteur : jamais administratrice');
reset role;
update model_profiles set published = false where id = '00000000-0000-0000-0000-00000000c158';
set role authenticated;
-- une mannequin (sans rôle d'équipe) : rien ne change pour elle
select essai_qui('00000000-0000-0000-0000-00000000c158', 'aal1', 30, '');
select essai(not portail_admin_ok() and not exists (select 1 from contacts_mannequins_admin()), 'une mannequin : jamais administratrice');
reset role;
select set_config('request.jwt.claims', '', false);
select '✅ verrous des téléphones partout : tous les essais passent';
