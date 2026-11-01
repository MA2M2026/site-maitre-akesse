-- Essais de supabase-demandes-acces.sql (Extension 150, 01/11/2026) : une personne qui a créé son compte n'a
-- AUCUN accès tant que l'administratrice principale n'a pas accepté ; accepter donne le rôle choisi ;
-- refuser laisse sans accès ; personne d'autre ne voit ni ne décide.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000fd1', 'nouvelle@test.ci'), ('00000000-0000-0000-0000-000000000fd2', 'refusee@test.ci'), ('00000000-0000-0000-0000-000000000fd3', 'attente@test.ci') on conflict do nothing;
insert into staff_demandes (id, user_id, nom, email, telephone) values
  ('00000000-0000-0000-0000-000000000fe1', '00000000-0000-0000-0000-000000000fd1', 'Nouvelle Recrue', 'nouvelle@test.ci', '0707070707'),
  ('00000000-0000-0000-0000-000000000fe2', '00000000-0000-0000-0000-000000000fd2', 'Refusée', 'refusee@test.ci', null),
  ('00000000-0000-0000-0000-000000000fe3', '00000000-0000-0000-0000-000000000fd3', 'En attente', 'attente@test.ci', null)
on conflict do nothing;
set role authenticated;
-- demande en attente : aucun accès, même avec la double authentification
select essai_qui('00000000-0000-0000-0000-000000000fd1', 'aal2', 30, 'appareil-demande-0001');
select essai(portail_role() is null, 'demande en attente : aucun accès à l''Administration');
select essai_refuse($$select portail_demandes_liste()$$, 'demande en attente : ne voit pas les demandes');
select essai_refuse($$select portail_demande_accepter('00000000-0000-0000-0000-000000000fe1', 'site')$$, 'une personne ne s''accepte pas elle-même');
-- l'administrateur du site (a2) non plus
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai_refuse($$select portail_demandes_liste()$$, 'administrateur du site : ne voit pas les demandes');
select essai_refuse($$select portail_demande_accepter('00000000-0000-0000-0000-000000000fe1', 'site')$$, 'administrateur du site : ne décide pas');
-- l'administratrice principale : voit, accepte (rôle choisi), refuse
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 30);
select essai(json_array_length(portail_demandes_liste()) = 3, 'principale : voit les 3 demandes');
select essai_refuse($$select portail_demande_accepter('00000000-0000-0000-0000-000000000fe1', 'principal')$$, 'on ne donne jamais le rôle principal');
select portail_demande_accepter('00000000-0000-0000-0000-000000000fe1', 'site');
select portail_demande_refuser('00000000-0000-0000-0000-000000000fe2');
select essai_refuse($$select portail_demande_accepter('00000000-0000-0000-0000-000000000fe2', 'site')$$, 'demande refusée : ne s''accepte plus');
select essai_qui('00000000-0000-0000-0000-0000000000a1', 'aal2', 3600);
select essai_refuse($$select portail_demande_accepter('00000000-0000-0000-0000-000000000fe3', 'site')$$, 'accepter sans code récent : refusé');
-- après acceptation : accès avec le rôle choisi ; la refusée : toujours rien
select essai_qui('00000000-0000-0000-0000-000000000fd1', 'aal2', 30, 'appareil-demande-0001');
select essai(portail_role() = 'site', 'acceptée : accès avec le rôle choisi (Administration du site)');
select essai_qui('00000000-0000-0000-0000-000000000fd1', 'aal1', 30, 'appareil-demande-0001');
select essai(portail_role() is null, 'acceptée mais sans double authentification : toujours aucun accès');
select essai_qui('00000000-0000-0000-0000-000000000fd2', 'aal2', 30, 'appareil-demande-0002');
select essai(portail_role() is null, 'refusée : aucun accès');
reset role;
select essai_refuse($$set role anon; select * from staff_demandes$$, 'visiteur : la table n''est pas lisible');
reset role;
