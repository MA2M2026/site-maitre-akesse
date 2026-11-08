-- Essais de supabase-site-vivant.sql (Extension 157) : qui peut paraître dans la vitrine de l'accueil (majeure,
-- ou mineure avec l'accord donné par un parent ; jamais exclue, en sourdine ou non publiée) ; lien d'accord.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into auth.users (id) values ('00000000-0000-0000-0000-000000157e01'), ('00000000-0000-0000-0000-000000157e02'), ('00000000-0000-0000-0000-000000157e03'), ('00000000-0000-0000-0000-000000157e04') on conflict do nothing;
insert into model_profiles (id, full_name, published, date_naissance) values
  ('00000000-0000-0000-0000-000000157e01', 'Majeure Essai', true, current_date - interval '20 years'),
  ('00000000-0000-0000-0000-000000157e02', 'Mineure Essai Vitrine', true, current_date - interval '15 years'),
  ('00000000-0000-0000-0000-000000157e03', 'Majeure Exclue', true, current_date - interval '25 years'),
  ('00000000-0000-0000-0000-000000157e04', 'Majeure Pas Publiee', false, current_date - interval '25 years')
on conflict (id) do update set published = excluded.published, date_naissance = excluded.date_naissance;
update model_profiles set exclue_vitrine = true where id = '00000000-0000-0000-0000-000000157e03';
set role anon;
select essai(exists (select 1 from vitrine_eligibles() where model_id = '00000000-0000-0000-0000-000000157e01'), 'majeure publiée : dans la vitrine');
select essai(not exists (select 1 from vitrine_eligibles() where model_id = '00000000-0000-0000-0000-000000157e02'), 'mineure sans accord des parents : JAMAIS dans la vitrine');
select essai(not exists (select 1 from vitrine_eligibles() where model_id in ('00000000-0000-0000-0000-000000157e03', '00000000-0000-0000-0000-000000157e04')), 'exclue par l''agence ou pas publiée : jamais dans la vitrine');
select essai_refuse($$select accord_parent_demander('00000000-0000-0000-0000-000000157e02')$$, 'visiteur : ne crée pas de lien d''accord');
select essai_refuse($$select * from accords_parents$$, 'visiteur : ne lit pas les accords');
reset role;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select set_config('essai.jeton', accord_parent_demander('00000000-0000-0000-0000-000000157e02')::text, false);
reset role;
set role anon;
select essai((accord_parent_lire(current_setting('essai.jeton')::uuid) ->> 'etat') = 'en_attente' and (accord_parent_lire(current_setting('essai.jeton')::uuid) ->> 'prenom') = 'Mineure', 'le parent ouvre son lien : prénom de sa fille, en attente');
select essai(accord_parent_lire(gen_random_uuid()) is null, 'un faux lien ne montre rien');
select essai_refuse(format($$select accord_parent_repondre(%L, true, 'X')$$, current_setting('essai.jeton')), 'accord sans nom complet du parent : refusé');
select essai(accord_parent_repondre(current_setting('essai.jeton')::uuid, true, 'Awa Parent Essai') = 'accepte', 'le parent accepte, avec son nom');
select essai(exists (select 1 from vitrine_eligibles() where model_id = '00000000-0000-0000-0000-000000157e02'), 'mineure avec l''accord du parent : dans la vitrine');
select essai(accord_parent_repondre(current_setting('essai.jeton')::uuid, false, null) = 'retire', 'le parent retire son accord');
select essai(not exists (select 1 from vitrine_eligibles() where model_id = '00000000-0000-0000-0000-000000157e02'), 'accord retiré : plus dans la vitrine');
reset role;
select essai(true, 'site vivant : tous les essais passent');
