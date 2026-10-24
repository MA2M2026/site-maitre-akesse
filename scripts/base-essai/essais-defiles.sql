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
select essai(defile_participants('00000000-0000-0000-0000-0000000000e1') = 1 and (select '00000000-0000-0000-0000-0000000000b1'::uuid = any(mannequin_ids) from agenda_projets where id = '00000000-0000-0000-0000-0000000000e1'),
  '« Convoquer » : la mannequin placée entre dans le projet');
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
delete from agenda_projets where id = '00000000-0000-0000-0000-0000000000e1';
select essai((select count(*) from defile_passages where projet_id = '00000000-0000-0000-0000-0000000000e1') = 0 and (select count(*) from defile_affectations) = 0, 'projet supprimé : passages et affectations partent avec lui');
