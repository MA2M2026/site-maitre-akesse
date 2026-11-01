-- Essais de supabase-appareil-confiance.sql (Extension 149, 01/11/2026) : appareil de confiance 30 jours
-- après une connexion complète ; verrou fort (mot de passe + code à 4 chiffres) après 1 h 30 sans activité
-- ou « Se déconnecter » ; « Oublier », révocation, 30 jours : connexion complète ; rien ne se contourne.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
-- (compte « site » a2, appareil neuf)
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 30, 'appareil-confiance-0001');
select portail_enregistrer_appareil('appareil-confiance-0001', 'Android, Chrome');
select essai(portail_code_appareil_etat('appareil-confiance-0001') ->> 'confiance' = 'false', 'sans code à 4 chiffres : pas encore de confiance');
select portail_code_appareil_definir('appareil-confiance-0001', '2580');
select essai((portail_code_appareil_etat('appareil-confiance-0001') ->> 'confiance')::boolean, 'connexion complète + code à 4 chiffres : appareil de confiance');
reset role;
select essai((select confiance_jusqua between now() + interval '29 days' and now() + interval '31 days' from staff_devices where appareil = 'appareil-confiance-0001'), 'confiance pour 30 jours');
set role authenticated;
-- 9 heures plus tard : l'appareil de confiance garde l'accès, un autre appareil non
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 9 * 3600, 'appareil-confiance-0001');
select essai(portail_role() = 'site', 'appareil de confiance : toujours ouvert après 9 heures');
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 9 * 3600, 'appareil-essai-0001');
select essai(portail_role() is null, 'autre appareil (pas de confiance) : fermé après 8 heures, comme avant');
-- 31 jours : fermé partout
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 31 * 86400, 'appareil-confiance-0001');
select essai(portail_role() is null, 'après 30 jours : connexion complète obligatoire');
select essai((portail_code_appareil_verifier('appareil-confiance-0001', '2580') ->> 'bloque')::boolean, 'après 30 jours : le code à 4 chiffres ne suffit plus');
-- personne ne prolonge la confiance à la main (même le principal)
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 30);
select essai_refuse($$update staff_devices set confiance_jusqua = now() + interval '10 years' where appareil = 'appareil-confiance-0001'$$, 'principal : ne prolonge pas une confiance à la main');
select essai_refuse($$select portail_mot_de_passe_verifie('00000000-0000-0000-0000-0000000000a2', 'appareil-confiance-0001')$$, 'navigateur : ne déclare pas un mot de passe vérifié (serveur seulement)');
-- 2 heures sans activité : mot de passe exigé, le code à 4 chiffres seul ne suffit pas
reset role;
update staff_codes_appareil set derniere_activite = now() - interval '2 hours', verrouille = false, verrouille_le = null where appareil = 'appareil-confiance-0001';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 10 * 3600, 'appareil-confiance-0001');
select essai(portail_role() is null, '2 heures sans activité : fermé');
select essai((portail_code_appareil_etat('appareil-confiance-0001') ->> 'mot_de_passe')::boolean, '2 heures sans activité : l''écran demande le mot de passe');
select essai((portail_code_appareil_verifier('appareil-confiance-0001', '2580') ->> 'mot_de_passe')::boolean, 'le code à 4 chiffres seul est refusé (mot de passe d''abord)');
reset role;
select essai((select essais from staff_codes_appareil where appareil = 'appareil-confiance-0001') = 0, 'ce refus ne compte pas comme un code faux');
set role service_role;
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
select essai(portail_mot_de_passe_verifie('00000000-0000-0000-0000-0000000000a2', 'appareil-confiance-0001'), 'serveur : mot de passe juste, noté pour cet appareil');
reset role;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 10 * 3600, 'appareil-confiance-0001');
select essai(portail_role() is null, 'mot de passe seul : encore fermé (le code à 4 chiffres manque)');
select essai(portail_code_appareil_verifier('appareil-confiance-0001', '2580') ->> 'ok' = 'true', 'puis le code à 4 chiffres : déverrouillé');
select essai(portail_role() = 'site', 'mot de passe + code à 4 chiffres : de nouveau ouvert, sans l''application d''authentification');
-- « Se déconnecter » sur l'appareil de confiance : verrou fort tout de suite
select essai(portail_appareil_deconnecter('appareil-confiance-0001'), '« Se déconnecter » : verrou fort');
select essai(portail_role() is null and (portail_code_appareil_etat('appareil-confiance-0001') ->> 'mot_de_passe')::boolean, 'après « Se déconnecter » : mot de passe exigé');
reset role;
set role service_role;
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
select portail_mot_de_passe_verifie('00000000-0000-0000-0000-0000000000a2', 'appareil-confiance-0001');
reset role;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 10 * 3600, 'appareil-confiance-0001');
select essai(portail_code_appareil_verifier('appareil-confiance-0001', '2580') ->> 'ok' = 'true', 'revenir : mot de passe puis code à 4 chiffres');
select essai(portail_role() = 'site', 'puis tout est rouvert');
-- une connexion complète (code de l'application) lève aussi le verrou fort
select portail_appareil_deconnecter('appareil-confiance-0001');
select pg_sleep(1.5);  -- (la connexion complète vient APRÈS la déconnexion)
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 0, 'appareil-confiance-0001');
select essai(portail_code_appareil_etat('appareil-confiance-0001') ->> 'verrouille' = 'false', 'connexion complète : l''écran se déverrouille');
select essai(portail_role() = 'site', 'connexion complète : tout est rouvert');
-- « Oublier cet appareil » : plus de confiance
select portail_appareil_oublier('appareil-confiance-0001');
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 9 * 3600, 'appareil-confiance-0001');
select essai(portail_role() is null, '« Oublier cet appareil » : de nouveau 8 heures au plus');
select essai(not portail_appareil_deconnecter('appareil-confiance-0001'), 'appareil oublié : « Se déconnecter » ferme complètement');
-- de nouveau de confiance (connexion complète), puis révoqué par le principal : plus rien
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 30, 'appareil-confiance-0001');
select portail_enregistrer_appareil('appareil-confiance-0001', 'Android, Chrome');
select essai((portail_code_appareil_etat('appareil-confiance-0001') ->> 'confiance')::boolean, 'connexion complète : de nouveau de confiance');
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 30);
update staff_devices set revoque = true where appareil = 'appareil-confiance-0001';
reset role;
select essai((select confiance_jusqua is null from staff_devices where appareil = 'appareil-confiance-0001'), 'appareil révoqué : sa confiance tombe');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2', 9 * 3600, 'appareil-confiance-0001');
select essai(portail_role() is null, 'appareil révoqué : fermé');
-- remise en état pour les essais suivants
reset role;
select set_config('request.jwt.claims', '', false);
set session_replication_role = replica;
update staff_devices set revoque = false, confiance_jusqua = null where appareil = 'appareil-confiance-0001';
update staff_profiles set sessions_valides_apres = null where user_id = '00000000-0000-0000-0000-0000000000a2';
set session_replication_role = default;
set role anon;
select essai_refuse($$select portail_appareil_deconnecter('x')$$, 'visiteur : refusé');
reset role;
