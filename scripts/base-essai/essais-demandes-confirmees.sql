-- Essais de supabase-demandes-confirmees.sql (audit L-6, 16/11/2026) : une demande d'accès n'est visible et
-- acceptable qu'une fois l'adresse e-mail confirmée
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000c6d01', 'pas-confirmee@test.ci', null),
  ('00000000-0000-0000-0000-0000000c6d02', 'confirmee@test.ci', now()) on conflict do nothing;
insert into staff_demandes (id, user_id, nom, email) values
  ('00000000-0000-0000-0000-0000000c6e01', '00000000-0000-0000-0000-0000000c6d01', 'Pas Confirmée', 'pas-confirmee@test.ci'),
  ('00000000-0000-0000-0000-0000000c6e02', '00000000-0000-0000-0000-0000000c6d02', 'Confirmée', 'confirmee@test.ci') on conflict do nothing;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai(portail_demandes_liste()::text not like '%pas-confirmee@test.ci%', 'adresse pas encore confirmée : la demande n''apparaît pas à la propriétaire');
select essai(portail_demandes_liste()::text like '%"confirmee@test.ci"%', 'adresse confirmée : la demande apparaît');
select essai_refuse($$select portail_demande_accepter('00000000-0000-0000-0000-0000000c6e01', 'site')$$, 'adresse pas confirmée : accepter est refusé (aucun rôle)');
select portail_demande_accepter('00000000-0000-0000-0000-0000000c6e02', 'site');
reset role;
select set_config('request.jwt.claims', '', false);
select essai((select role from staff_profiles where user_id = '00000000-0000-0000-0000-0000000c6d02') = 'site', 'adresse confirmée : acceptée avec le rôle choisi');
select essai(not exists (select 1 from staff_profiles where user_id = '00000000-0000-0000-0000-0000000c6d01'), 'adresse pas confirmée : toujours aucun rôle');
