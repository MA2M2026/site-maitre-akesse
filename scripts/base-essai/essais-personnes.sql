-- Essais : ajouter une personne (agence / extérieure), parent facultatif, « déjà répondu »
-- (supabase-personnes.sql), sur la base LOCALE jetable.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
grant execute on function essai(boolean, text) to anon;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
set role authenticated;
create temp table ajout_agence as select personne_ajouter(true, 'Mademoiselle', 'NOUVELLE AGENCE', '2250701010101', 'Madame Mère Agence', '2250702020202') as r;
create temp table ajout_ext as select personne_ajouter(false, 'Monsieur', 'PARTENAIRE EXT', '2250703030303') as r;
select essai_refuse('select personne_ajouter(false, ''Madame'', ''EXT AVEC PARENT'', ''2250704040404'', ''X'', ''2250705050505'')', 'extérieure : pas de parent (toujours majeure)');
select essai_refuse('select personne_ajouter(true, ''Madame'', ''PARENT INCOMPLET'', ''2250704040404'', ''Madame X'', null)', 'parent : le nom ET le numéro, ou rien');
select essai_refuse('select personne_ajouter(true, ''Madame'', ''MAUVAIS'', ''12'')', 'numéro WhatsApp pas valable : refusé');
reset role;
select essai((select full_name = 'NOUVELLE AGENCE' and genre = 'femme' and user_id is null and parent_nom = 'Madame Mère Agence' and statut = 'actif'
  from agence_mannequins where id = ((select r from ajout_agence) ->> 'mannequin_id')::uuid), 'agence : dans le registre (sans compte), avec son parent');
select essai((select mannequin_id is not null and parent_telephone = '2250702020202' from contacts_externes where id = ((select r from ajout_agence) ->> 'contact_id')::uuid), 'agence : aussi dans le carnet, liée au registre');
select essai((select mannequin_id is null from contacts_externes where id = ((select r from ajout_ext) ->> 'contact_id')::uuid)
  and not exists (select 1 from agence_mannequins where full_name = 'PARTENAIRE EXT'), 'extérieure : dans le carnet seulement, jamais dans le registre');
-- elle prend une place : elle ET son parent deviennent participants du projet
insert into agenda_projets (id, type, titre, date_debut) values ('00000000-0000-0000-0000-0000000000e9', 'defile', 'PROJET PARENT', current_date + 20);
select places_participant_registre('00000000-0000-0000-0000-0000000000e9', ((select r from ajout_agence) ->> 'mannequin_id')::uuid);
select essai((select count(*) from convocation_participants where projet_id = '00000000-0000-0000-0000-0000000000e9') = 2
  and exists (select 1 from convocation_participants where projet_id = '00000000-0000-0000-0000-0000000000e9' and parent and parent_nom = 'Madame Mère Agence' and telephone = '2250702020202'), 'place prise : la mannequin et son parent sont tous deux convoqués');
-- « déjà répondu » : la mannequin confirme, son parent le voit sur son lien
update convocation_participants set reponse = 'confirme', repondu_le = now() where projet_id = '00000000-0000-0000-0000-0000000000e9' and not parent;
create temp table jetons_pp as select parent, jeton from convocation_participants where projet_id = '00000000-0000-0000-0000-0000000000e9';
grant select on jetons_pp to anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
set role anon;
select essai((select autre_reponse from convocation_lire((select jeton from jetons_pp where parent))) = 'confirme', 'le parent voit que sa fille a déjà confirmé');
select essai((select autre_reponse from convocation_lire((select jeton from jetons_pp where not parent))) is null, 'la fille : son parent n''a pas encore répondu');
reset role;
-- un compte sans droit d'agence ne peut rien ajouter
select essai_qui('00000000-0000-0000-0000-0000000000a5');
set role authenticated;
select essai_refuse('select personne_ajouter(true, ''Madame'', ''INTRUSE'', ''2250709090909'')', 'compte mannequin : ne peut pas ajouter de personne');
reset role;
