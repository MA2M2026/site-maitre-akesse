-- Essais de supabase-mannequin-du-mois.sql (Extension 144, 01/11/2026) : l'équipe choisit la mannequin du
-- mois (active seulement, pas un mois passé), elle reçoit son message ; le public ne la voit que si sa fiche
-- est publiée ; personne d'autre ne choisit.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
update agence_mannequins set statut = 'actif' where user_id = '00000000-0000-0000-0000-0000000000b1';
update model_profiles set published = false where id = '00000000-0000-0000-0000-0000000000b1';
create temp table roxane as select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1';
grant select on roxane to authenticated, anon;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select mannequin_du_mois_choisir(current_date, (select id from roxane), 'Toujours à l''heure');
select essai(json_array_length(mannequins_du_mois_historique()) = 1, 'équipe : la mannequin du mois est choisie');
select essai_refuse($$select mannequin_du_mois_choisir((current_date - interval '2 months')::date, (select id from roxane), null)$$, 'on ne change pas un mois passé');
select essai_refuse($$select mannequin_du_mois_choisir(current_date, '00000000-0000-0000-0000-000000000ae3', null)$$, 'une mannequin sortie de l''agence : refusée');
reset role;
select essai((select count(*) from app_messages where user_id = '00000000-0000-0000-0000-0000000000b1' and titre like '🏆%' and texte like '%Toujours à l''heure%') = 1, 'la mannequin choisie reçoit son message de félicitations');
set role anon;
select essai(mannequin_du_mois_actuelle() is null, 'fiche pas publiée : le public ne voit pas son nom');
reset role;
update model_profiles set published = true where id = '00000000-0000-0000-0000-0000000000b1';
set role anon;
select essai(mannequin_du_mois_actuelle() ->> 'compte' = '00000000-0000-0000-0000-0000000000b1', 'fiche publiée : le site la met à l''honneur');
select essai_refuse($$select mannequin_du_mois_choisir(current_date, '00000000-0000-0000-0000-0000000000d1', null)$$, 'visiteur : ne choisit pas');
select essai_refuse($$select * from mannequin_du_mois$$, 'visiteur : la table n''est pas lisible directement');
reset role;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai_refuse($$select mannequin_du_mois_choisir(current_date, (select id from roxane), null)$$, 'une mannequin ne se choisit pas elle-même');
select essai_refuse($$select mannequins_du_mois_historique()$$, 'une mannequin ne lit pas l''historique de l''agence');
reset role;
-- changement d'avis (relecture du 01/11/2026) : la première choisie ne garde pas son message de félicitations
update agence_mannequins set statut = 'actif' where id = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select mannequin_du_mois_choisir(current_date, '00000000-0000-0000-0000-0000000000d1', null);
reset role;
select essai((select count(*) from app_messages where user_id = '00000000-0000-0000-0000-0000000000b1' and titre like '🏆%') = 0, 'changement d''avis : le message de la mannequin choisie avant est retiré');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select mannequin_du_mois_choisir(current_date, (select id from roxane), 'Toujours à l''heure');
reset role;
select essai((select count(*) from app_messages where user_id = '00000000-0000-0000-0000-0000000000b1' and titre like '🏆%') = 1, 'choisie de nouveau : son message revient (une seule fois)');
