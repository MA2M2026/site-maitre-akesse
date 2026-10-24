-- Essais de supabase-admins-aal2.sql (24/10/2026) sur la base LOCALE jetable : un administrateur
-- connecté par mot de passe seul (aal1) n'a plus aucun droit ; avec le code (aal2), tout marche.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
insert into admins (user_id) values ('00000000-0000-0000-0000-0000000000a2') on conflict do nothing;
select essai((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc like '%from admins where user_id = auth.uid())%') = 0, 'toutes les fonctions vérifient le code');
select essai((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc like '%from admins where user_id = auth.uid() and portail_mfa_ok())%') > 10, 'fonctions réécrites');
set role authenticated;
-- mot de passe seul : rien
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal1');
select essai(not exists (select 1 from admins), 'sans le code : la table admins ne la reconnaît pas');
select essai((select count(*) from places_appels) = 0, 'sans le code : rien à lire dans les places');
select essai_refuse($$insert into agenda_projets (type, titre, date_debut) values ('defile', 'PIRATE', current_date + 5)$$, 'sans le code : écriture refusée');
select essai_refuse($$select places_preparer('00000000-0000-0000-0000-0000000000c1')$$, 'sans le code : fonction de l''agence refusée');
-- avec le code : tout marche
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal2');
select essai(exists (select 1 from admins), 'avec le code : administratrice reconnue');
select essai((select count(*) from places_appels) > 0, 'avec le code : les places se lisent');
insert into agenda_projets (type, titre, date_debut) values ('defile', 'ESSAI AAL2', current_date + 5);
select essai(exists (select 1 from agenda_projets where titre = 'ESSAI AAL2'), 'avec le code : écriture acceptée');
select essai(places_preparer('00000000-0000-0000-0000-0000000000c1') >= 0, 'avec le code : fonction de l''agence acceptée');
reset role;
