-- Essais de supabase-publication-protegee.sql (audit L-2, 16/11/2026) : une mannequin ne se publie pas seule
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000c2a01', 'majeure@test.ci'), ('00000000-0000-0000-0000-0000000c2a02', 'mineure@test.ci') on conflict do nothing;
insert into model_profiles (id, full_name, date_naissance) values
  ('00000000-0000-0000-0000-0000000c2a01', 'AÏCHA MAJEURE', current_date - interval '25 years'),
  ('00000000-0000-0000-0000-0000000c2a02', 'BINTOU MINEURE', current_date - interval '15 years') on conflict (id) do nothing;
set role authenticated;
-- 1. la majeure, jamais validée : se met « première publication faite », puis publie
select essai_qui('00000000-0000-0000-0000-0000000c2a01', 'aal1');
do $$ begin update model_profiles set premiere_publication_faite = true where id = '00000000-0000-0000-0000-0000000c2a01'; exception when insufficient_privilege then null; end $$;
update model_profiles set published = true where id = '00000000-0000-0000-0000-0000000c2a01';
reset role;
select essai((select not published and en_attente_validation and not premiere_publication_faite from model_profiles where id = '00000000-0000-0000-0000-0000000c2a01'),
  'mannequin jamais validée : « première publication faite » écrite par elle est ignorée, sa publication part en validation');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000c2a01', 'aal1');
-- elle ne s'enlève pas de la file d'attente, ne se retire pas de la sourdine, n'efface pas un refus
-- (chaque colonne à part : dans la base d'essai, certaines sont déjà fermées par les droits de colonnes ; dans la
-- vraie base, l'agent D les a vues ouvertes : le gardien doit tenir dans les deux cas)
do $$ begin update model_profiles set en_attente_validation = false where id = '00000000-0000-0000-0000-0000000c2a01'; exception when insufficient_privilege then null; end $$;
do $$ begin update model_profiles set raison_refus = 'rien' where id = '00000000-0000-0000-0000-0000000c2a01'; exception when insufficient_privilege then null; end $$;
do $$ begin update model_profiles set exclue_vitrine = true where id = '00000000-0000-0000-0000-0000000c2a01'; exception when insufficient_privilege then null; end $$;
reset role;
select essai((select en_attente_validation and raison_refus is null and not exclue_vitrine from model_profiles where id = '00000000-0000-0000-0000-0000000c2a01'),
  'mannequin : file d''attente, motif de refus et vitrine restent ceux de l''agence');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000c2a01', 'aal1');
-- elle peut toujours modifier son profil
update model_profiles set bio = 'Nouvelle bio' where id = '00000000-0000-0000-0000-0000000c2a01';
select essai((select bio from model_profiles where id = '00000000-0000-0000-0000-0000000c2a01') = 'Nouvelle bio', 'mannequin : elle modifie toujours son profil');
-- 2. l'agence valide : publiée
select essai_qui('00000000-0000-0000-0000-0000000000a1');
update model_profiles set published = true where id = '00000000-0000-0000-0000-0000000c2a01';
select essai((select published and premiere_publication_faite and not en_attente_validation from model_profiles where id = '00000000-0000-0000-0000-0000000c2a01'), 'agence : elle publie directement');
-- 3. validée une fois et majeure : elle se retire puis revient seule (comme avant)
select essai_qui('00000000-0000-0000-0000-0000000c2a01', 'aal1');
update model_profiles set published = false where id = '00000000-0000-0000-0000-0000000c2a01';
update model_profiles set published = true where id = '00000000-0000-0000-0000-0000000c2a01';
select essai((select published from model_profiles where id = '00000000-0000-0000-0000-0000000c2a01'), 'mannequin déjà validée et majeure : elle republie seule (inchangé)');
-- 4. la mineure, même déjà validée une fois par l'agence, ne se republie pas en se vieillissant
reset role;
select set_config('request.jwt.claims', '', false);
update model_profiles set premiere_publication_faite = true, published = false where id = '00000000-0000-0000-0000-0000000c2a02';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000c2a02', 'aal1');
update model_profiles set date_naissance = current_date - interval '30 years', published = true where id = '00000000-0000-0000-0000-0000000c2a02';
reset role;
select essai((select not published and en_attente_validation from model_profiles where id = '00000000-0000-0000-0000-0000000c2a02'),
  'mineure qui change sa date de naissance pour paraître majeure : pas publiée, la demande part en validation');
reset role;
select set_config('request.jwt.claims', '', false);
