-- Essais de supabase-anti-robots.sql (Extension 152) : les visiteurs n'écrivent plus directement les formulaires ;
-- seul le serveur (service_role) enregistre, avec les mêmes limites qu'avant.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
-- un visiteur ne peut plus écrire directement
select essai_refuse($$set role anon; insert into messages_contact (id, nom, email, message) values ('00000000-0000-0000-0000-00000000ab01', 'Robot', 'r@b.ot', 'spam')$$, 'visiteur : écriture directe d''un message de contact refusée');
reset role;
select essai_refuse($$set role anon; insert into recruiter_requests (id, company, contact_name, email) values ('00000000-0000-0000-0000-00000000ab02', 'Robot', 'Robot', 'r@b.ot')$$, 'visiteur : écriture directe d''une demande de recruteur refusée');
reset role;
select essai_refuse($$set role anon; select formulaire_public_enregistrer('messages_contact', '{"nom":"x"}'::jsonb, '1.2.3.4')$$, 'visiteur : la fonction du serveur lui est interdite');
reset role;
-- le serveur (service_role) enregistre, colonne par colonne, et les limites restent
set role service_role;
select essai(formulaire_public_enregistrer('messages_contact', '{"id":"00000000-0000-0000-0000-00000000ab03","nom":"Awa","email":"awa@test.ci","message":"Bonjour"}'::jsonb, '1.2.3.4') = '00000000-0000-0000-0000-00000000ab03', 'serveur : message de contact enregistré');
select essai_refuse($$select formulaire_public_enregistrer('model_profiles', '{"full_name":"x"}'::jsonb, '1.2.3.4')$$, 'serveur : une autre table que les 3 formulaires est refusée');
select formulaire_public_enregistrer('messages_contact', jsonb_build_object('nom', 'Awa', 'email', 'awa@test.ci', 'message', 'Bonjour ' || g), '5.6.7.8') from generate_series(1, 3) g;
select essai_refuse($$select formulaire_public_enregistrer('messages_contact', '{"nom":"Awa","email":"awa@test.ci","message":"4e"}'::jsonb, '5.6.7.8')$$, 'serveur : 4e message de la même adresse dans la minute refusé (LIMITE_ATTEINTE)');
select essai(formulaire_public_enregistrer('messages_contact', '{"nom":"Bintou","email":"b@test.ci","message":"Bonjour"}'::jsonb, '9.9.9.9') is not null, 'serveur : une autre adresse passe');
select essai_refuse($$select formulaire_public_enregistrer('recruiter_requests', '{"company":"x","contact_name":"x","email":"x@x.ci","status":"traitee"}'::jsonb, '1.1.1.1')$$, 'serveur : un statut forcé est refusé');
select essai(formulaire_public_enregistrer('recruiter_requests', '{"id":"00000000-0000-0000-0000-00000000ab04","company":"Agence","contact_name":"Mme Koné","email":"k@test.ci"}'::jsonb, '2.2.2.2') = '00000000-0000-0000-0000-00000000ab04', 'serveur : demande de recruteur enregistrée');
reset role;
-- liste des mannequins : seulement pour une demande toute récente
select essai_refuse($$set role anon; insert into recruiter_request_models (request_id, model_name_snapshot) values ('00000000-0000-0000-0000-0000000000ff', 'x')$$, 'visiteur : mannequins pour une demande inexistante refusés');
reset role;
set role anon;
insert into recruiter_request_models (request_id, model_name_snapshot) values ('00000000-0000-0000-0000-00000000ab04', 'Awa Koné');
reset role;
select essai((select count(*) from recruiter_request_models where request_id = '00000000-0000-0000-0000-00000000ab04') = 1, 'visiteur : mannequins d''une demande toute récente acceptés');
