-- Essais de supabase-artci-majeure-mineure.sql et supabase-artci-poids-prive.sql (minimisation ARTCI, 22/11/2026)
-- Base LOCALE et jetable : jamais la vraie base.

-- 1. cours de talons : « majeure / mineure » au lieu de l'âge ; une mineure sans parent est refusée
reset role;
set role service_role;
select formulaire_public_enregistrer('cours_talons',
  '{"id":"00000000-0000-0000-0000-0000000a0001","formule":"groupe","nom":"Majeure Sans Age","telephone":"+2250700000101","mineure":false,"decision":"plus_tard"}'::jsonb, '7.7.7.1');
reset role;
select essai(exists (select 1 from cours_talons where id = '00000000-0000-0000-0000-0000000a0001' and age is null and mineure = false),
             'cours de talons : inscription acceptée sans âge (choix « 18 ans ou plus »)');
select essai_refuse($$set role service_role; select formulaire_public_enregistrer('cours_talons',
  '{"id":"00000000-0000-0000-0000-0000000a0002","formule":"groupe","nom":"Mineure Sans Parent","telephone":"+2250700000102","mineure":true,"decision":"plus_tard"}'::jsonb, '7.7.7.2')$$,
  'cours de talons : mineure sans téléphone du parent refusée');
reset role;
select essai_refuse($$set role service_role; select formulaire_public_enregistrer('cours_talons',
  '{"id":"00000000-0000-0000-0000-0000000a0003","formule":"groupe","nom":"Ni Age Ni Choix","telephone":"+2250700000103","decision":"plus_tard"}'::jsonb, '7.7.7.3')$$,
  'cours de talons : ni âge ni choix majeure/mineure : refusé');
reset role;

-- 2. candidatures : une personne déclarée mineure doit donner le téléphone de son parent
select essai_refuse($$insert into casting_applications (id, full_name, email, phone, mineur) values ('00000000-0000-0000-0000-0000000a00c1', 'MINEURE SANS PARENT', 'm@test.ci', '+2250700001111', true)$$,
  'candidature : mineure sans téléphone du parent refusée');

-- 3. inscription d'une candidature SANS date de naissance (nouveau formulaire), déclarée mineure
insert into casting_applications (id, full_name, email, phone, genre, mineur, parent_nom, parent_telephone)
values ('00000000-0000-0000-0000-0000000a00c2', 'AYA NOUVELLE', 'aya@test.ci', '+225 07 00 00 12 34', 'femme', true, 'Mme Aya', '+2250500000000');
update casting_applications set status = 'retenue' where id = '00000000-0000-0000-0000-0000000a00c2';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai(code_individuel_creer('00000000-0000-0000-0000-0000000a00c2') ~ '^MA2M-', 'code d''inscription créé pour une candidature sans date de naissance');
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select set_config('essai.code', (select code from codes_inscription where candidature_id = '00000000-0000-0000-0000-0000000a00c2'), false);
select essai(inscription_code_lire(current_setting('essai.code'), '2000-01-01', '9999') is null, 'mauvais 4 derniers chiffres du WhatsApp : refusé');
select essai(inscription_code_lire(current_setting('essai.code'), '2000-01-01', null) is null, 'sans les 4 chiffres : refusé');
select essai(inscription_code_lire(current_setting('essai.code'), '2000-01-01') is null, 'ancienne version (code + date seulement) : refusée pour une candidature sans date');
select essai(inscription_code_lire(current_setting('essai.code'), (current_date - interval '12 years')::date, '1234') is null, 'moins de 14 ans à l''inscription : refusé');
select essai((inscription_code_lire(current_setting('essai.code'), '2000-01-01', '1234') ->> 'mineur')::boolean,
             'déclarée mineure à la candidature, date d''adulte tapée : reste MINEURE (accord du parent exigé)');
select essai_refuse($$select inscription_simplifiee_payer(current_setting('essai.code'), '2000-01-01', '{"full_name":"Aya Nouvelle","telephone":"0700001234","reglement":"accepte","tel4":"1234"}')$$,
  'mineure sans accord du parent : inscription refusée');

-- 5. le poids n'est plus lisible par les visiteurs
select set_config('request.jwt.claims', '', false);
select essai(not has_column_privilege('anon', 'public.model_profiles', 'weight_kg', 'select'), 'visiteur : le poids des mannequins n''est plus lisible');
select essai(has_column_privilege('anon', 'public.model_profiles', 'height_cm', 'select'), 'visiteur : la taille reste lisible (fiche publique)');
