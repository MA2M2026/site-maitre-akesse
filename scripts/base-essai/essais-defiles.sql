-- Essais de supabase-defiles.sql : réservé à l'agence (avec le code), une personne une seule fois
-- dans le vivier, suppression du projet → tout part avec lui.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
insert into agenda_projets (id, type, titre, date_debut, date_fin) values ('00000000-0000-0000-0000-0000000000e1', 'defile', 'FASHION WEEK', current_date + 30, current_date + 32) on conflict (id) do nothing;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal1');
select essai_refuse($$insert into defile_passages (projet_id, jour, femmes) values ('00000000-0000-0000-0000-0000000000e1', current_date + 30, 5)$$, 'sans le code : passage refusé');
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2');
insert into defile_passages (id, projet_id, jour, debut, salle, femmes, hommes) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', current_date + 30, '17:00', 'Salle A', 5, 2);
select essai_refuse($$insert into defile_passages (projet_id, jour, debut) values ('00000000-0000-0000-0000-0000000000e1', current_date + 30, '5h')$$, 'heure mal écrite : refusée');
insert into defile_vivier (id, projet_id, model_id, sexe) values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'femme');
select essai_refuse($$insert into defile_vivier (projet_id, model_id, sexe) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'femme')$$, 'la même mannequin deux fois dans le vivier : refusé');
insert into defile_affectations (passage_id, vivier_id) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2');
select essai((select count(*) from defile_affectations) = 1, 'affectation enregistrée');
select essai(defile_participants('00000000-0000-0000-0000-0000000000e1') = 1, '« Convoquer » : une mannequin placée');
select essai((select '00000000-0000-0000-0000-0000000000b1'::uuid = any(mannequin_ids) from agenda_projets where id = '00000000-0000-0000-0000-0000000000e1'), '« Convoquer » : elle entre dans le projet');
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal1');
select essai_refuse($$select defile_participants('00000000-0000-0000-0000-0000000000e1')$$, 'sans le code : « Convoquer » refusé');
reset role;
insert into convocation_participants (projet_id, model_id, nom, jeton) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'Mademoiselle AWA KONÉ', repeat('z', 36));
set role anon;
select essai_refuse($$select * from defile_passages$$, 'visiteur : rien à lire');
select essai((defile_programme(repeat('z', 36)) -> 'passages' -> 0 ->> 'moi')::boolean and defile_programme(repeat('z', 36)) -> 'passages' -> 0 -> 'mannequins' -> 0 ->> 'nom' = 'AWA KONÉ'
  and defile_programme(repeat('z', 36))::text not like '%telephone%', 'fiche programme : ses passages marqués, les visages et noms des autres, aucun numéro');
select essai(defile_programme(repeat('y', 36)) is null and defile_programme('court') is null, 'lien inconnu : rien');
reset role;
-- convoquée au projet mais pas retenue pour le défilé : pas de programme
insert into convocation_participants (projet_id, model_id, nom, jeton) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b9', 'Bintou', repeat('x', 36));
-- profil retiré du site : son nom reste, sa photo n'est plus montrée (photo propre à cet essai ;
-- l'état « publié » d'avant est remis à la fin)
create temp table essai_b1 as select published from model_profiles where id = '00000000-0000-0000-0000-0000000000b1';
set session_replication_role = replica;  -- sans les garde-fous des profils et des photos (essai seulement)
insert into model_photos (model_id, url, principale) values ('00000000-0000-0000-0000-0000000000b1', 'https://exemple.ci/defile.jpg', false);
update model_profiles set published = false where id = '00000000-0000-0000-0000-0000000000b1';
set session_replication_role = origin;
set role anon;
select essai(defile_programme(repeat('x', 36)) is null, 'pas dans le vivier du défilé : pas de programme');
select essai(defile_programme(repeat('z', 36)) -> 'passages' -> 0 -> 'mannequins' -> 0 ->> 'photo' is null, 'profil retiré du site : pas de photo sur la fiche programme');
reset role;
set session_replication_role = replica;  -- sans le garde-fou des profils (essai seulement)
update model_profiles set published = true where id = '00000000-0000-0000-0000-0000000000b1';
set session_replication_role = origin;
set role anon;
select essai(defile_programme(repeat('z', 36)) -> 'passages' -> 0 -> 'mannequins' -> 0 ->> 'photo' is not null, 'profil publié : sa photo sur la fiche programme');
reset role;
set session_replication_role = replica;
update model_profiles set published = (select published from essai_b1) where id = '00000000-0000-0000-0000-0000000000b1';
delete from model_photos where url = 'https://exemple.ci/defile.jpg';
set session_replication_role = origin;
drop table essai_b1;
delete from agenda_projets where id = '00000000-0000-0000-0000-0000000000e1';
select essai((select count(*) from defile_passages where projet_id = '00000000-0000-0000-0000-0000000000e1') = 0 and (select count(*) from defile_affectations) = 0, 'projet supprimé : passages et affectations partent avec lui');
