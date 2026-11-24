-- Essais de supabase-parent-candidature.sql : candidature de mineur, le parent ne peut pas être la candidate,
-- lien personnel, confirmation ou refus par le parent, preuve non modifiable par l équipe ni par un visiteur.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
-- copies refusées par le même chemin que le site (formulaire public)
select essai_refuse($$select formulaire_public_enregistrer('casting_applications', '{"full_name":"Amon Emira","email":"emira@exemple.ci","phone":"+225 0103961603","mineur":true,"genre":"femme","parent_nom":"Madame Emira Amon","parent_telephone":"+225 0703000000","parent_email":"maman@exemple.ci","type_candidature":"agence"}'::jsonb, '9.9.9.20')$$,
  'mineure : nom du parent = son propre nom (civilité et ordre des mots ignorés) : refusé');
select essai_refuse($$select formulaire_public_enregistrer('casting_applications', '{"full_name":"Amon Emira","email":"emira@exemple.ci","phone":"+225 0103961603","mineur":true,"genre":"femme","parent_nom":"Madame Awa Kone","parent_telephone":"0103961603","parent_email":"maman@exemple.ci","type_candidature":"agence"}'::jsonb, '9.9.9.21')$$,
  'mineure : WhatsApp du parent = son propre numéro (même sans indicatif) : refusé');
select essai_refuse($$select formulaire_public_enregistrer('casting_applications', '{"full_name":"Amon Emira","email":"emira@exemple.ci","phone":"+225 0103961603","mineur":true,"genre":"femme","parent_nom":"Madame Awa Kone","parent_telephone":"+225 0703000000","parent_email":"Emira@Exemple.ci","type_candidature":"agence"}'::jsonb, '9.9.9.22')$$,
  'mineure : e-mail du parent = son propre e-mail : refusé');
select set_config('essai.cand', formulaire_public_enregistrer('casting_applications', '{"full_name":"Amon Emira","email":"emira@exemple.ci","phone":"+225 0103961603","mineur":true,"genre":"femme","parent_nom":"Madame Awa Amon","parent_telephone":"+225 0703000000","parent_email":"maman@exemple.ci","type_candidature":"agence"}'::jsonb, '9.9.9.23')::text, false);
select essai((select parent_jeton is not null and parent_confirme_le is null from casting_applications where id = current_setting('essai.cand')::uuid),
  'vrai parent (même nom de famille accepté) : candidature enregistrée, lien personnel créé, pas encore confirmée');
select set_config('essai.majeure', formulaire_public_enregistrer('casting_applications', '{"full_name":"Kone Majeure","email":"m@exemple.ci","phone":"+225 0505050505","mineur":false,"genre":"femme","type_candidature":"agence"}'::jsonb, '9.9.9.24')::text, false);
select essai((select parent_jeton is null from casting_applications where id = current_setting('essai.majeure')::uuid), 'majeure : pas de lien parent');
select set_config('essai.jeton', (select parent_jeton::text from casting_applications where id = current_setting('essai.cand')::uuid), false);
-- un visiteur ne crée ni ne lit de lien, et ne peut pas se confirmer lui-même sans le lien
set role anon;
select essai_refuse(format($$select candidature_parent_lien(%L)$$, current_setting('essai.cand')), 'visiteur : ne récupère pas le lien du parent');
select essai(candidature_parent_lire(gen_random_uuid()) is null, 'faux lien : rien n est montré');
select essai((candidature_parent_lire(current_setting('essai.jeton')::uuid) ->> 'etat') = 'en_attente', 'le parent ouvre son lien : en attente');
select essai_refuse(format($$select candidature_parent_repondre(%L, true, 'X')$$, current_setting('essai.jeton')), 'confirmation sans nom complet : refusée');
select essai_refuse(format($$select candidature_parent_repondre(%L, true, 'Emira Amon')$$, current_setting('essai.jeton')), 'confirmation avec le nom de la candidate : refusée');
select essai(candidature_parent_repondre(current_setting('essai.jeton')::uuid, true, 'Awa Amon') = 'confirme', 'le parent confirme, avec son nom');
reset role;
select essai((select parent_confirme_le is not null and parent_confirme_nom = 'Awa Amon' from casting_applications where id = current_setting('essai.cand')::uuid), 'confirmation et nom du parent enregistrés');
-- l équipe ne peut pas fabriquer ni effacer une confirmation
update casting_applications set parent_confirme_le = null, parent_confirme_nom = 'Faux', parent_jeton = gen_random_uuid(), status = 'en étude' where id = current_setting('essai.cand')::uuid;
select essai((select parent_confirme_le is not null and parent_confirme_nom = 'Awa Amon' and parent_jeton = current_setting('essai.jeton')::uuid and status = 'en étude' from casting_applications where id = current_setting('essai.cand')::uuid),
  'modification du dossier : le statut change, mais la réponse du parent et son lien restent intacts');
update casting_applications set parent_confirme_le = now(), parent_confirme_nom = 'Faux' where id = current_setting('essai.majeure')::uuid;
select essai((select parent_confirme_le is null from casting_applications where id = current_setting('essai.majeure')::uuid), 'personne ne peut écrire une fausse confirmation à la main');
-- refus par le parent
set role anon;
select essai(candidature_parent_repondre(current_setting('essai.jeton')::uuid, false, 'Awa Amon') = 'refuse', 'le parent peut aussi refuser');
reset role;
select essai((select parent_refuse_le is not null and parent_confirme_le is null from casting_applications where id = current_setting('essai.cand')::uuid), 'refus du parent enregistré');
-- ancienne candidature de mineur sans lien : l agence le crée
insert into casting_applications (id, full_name, email, phone, mineur, parent_nom, parent_telephone)
  values ('00000000-0000-0000-0000-0000000a2401', 'Ancienne Mineure', 'a@exemple.ci', '+225 0101010101', true, 'Papa Essai', '+225 0202020202');
select set_config('ma2m.parent_reponse', '1', false);
update casting_applications set parent_jeton = null where id = '00000000-0000-0000-0000-0000000a2401';
select set_config('ma2m.parent_reponse', '', false);
select essai((select parent_jeton is null from casting_applications where id = '00000000-0000-0000-0000-0000000a2401'), '(préparation : ancienne candidature sans lien)');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai(candidature_parent_lien('00000000-0000-0000-0000-0000000a2401') is not null, 'agence : lien du parent obtenu pour une candidature de mineur');
select essai_refuse(format($$select candidature_parent_lien(%L)$$, current_setting('essai.majeure')), 'agence : pas de lien parent pour une majeure');
reset role;
select essai(true, 'parent des candidatures : tous les essais passent');
