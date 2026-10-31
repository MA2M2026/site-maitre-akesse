-- Essais de supabase-bulletins.sql (Extension 145, 01/11/2026) : l'équipe note (1 à 5) et publie ; la
-- mannequin ne voit que SES bulletins publiés et ne peut rien écrire ; un visiteur rien.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
create temp table bul as select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1';
grant select on bul to authenticated, anon;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select bulletin_enregistrer((select id from bul), current_date, '{"marche": 4, "posture": 5, "photo": 3, "expression": 4, "attitude": 5}', 'Très bon trimestre', false);
select essai((bulletins_trimestre(current_date) -> 'bulletins') -> 0 -> 'notes' ->> 'posture' = '5', 'équipe : bulletin enregistré');
select essai_refuse($$select bulletin_enregistrer((select id from bul), current_date, '{"marche": 7}', null, false)$$, 'note hors de 1 à 5 : refusée');
select essai_refuse($$select bulletin_enregistrer((select id from bul), current_date, '{"beaute": 5}', null, false)$$, 'compétence inconnue : refusée');
select essai_refuse($$select bulletin_enregistrer((select id from bul), (current_date + interval '6 months')::date, '{}', null, false)$$, 'trimestre à venir : refusé');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai(json_array_length(mes_bulletins()) = 0, 'mannequin : un bulletin pas encore publié ne se voit pas');
select essai_refuse($$select bulletin_enregistrer((select id from bul), current_date, '{"marche": 5}', 'Je me note', true)$$, 'mannequin : ne peut pas écrire son bulletin');
select essai_refuse($$select bulletins_trimestre(current_date)$$, 'mannequin : ne voit pas les bulletins des autres');
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select bulletin_enregistrer((select id from bul), current_date, '{"marche": 4, "posture": 5, "photo": 3, "expression": 4, "attitude": 5}', 'Très bon trimestre', true);
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai(json_array_length(mes_bulletins()) = 1 and mes_bulletins() -> 0 ->> 'appreciation' = 'Très bon trimestre', 'publié : la mannequin voit SON bulletin');
reset role;
select essai((select count(*) from app_messages where user_id = '00000000-0000-0000-0000-0000000000b1' and titre like '📘%') = 1, 'publié : elle reçoit un message (une seule fois)');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select bulletin_enregistrer((select id from bul), current_date, '{"marche": 5}', 'Corrigé', true);
reset role;
select essai((select count(*) from app_messages where user_id = '00000000-0000-0000-0000-0000000000b1' and titre like '📘%') = 1, 'corrigé après publication : pas de second message');
select essai_refuse($$set role authenticated; select * from bulletins$$, 'la table n''est pas lisible directement');
reset role;
set role anon;
select essai_refuse($$select mes_bulletins()$$, 'visiteur : refusé');
reset role;
