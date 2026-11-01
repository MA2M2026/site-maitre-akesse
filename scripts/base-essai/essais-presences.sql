-- Essais de supabase-presences.sql (Extension 142, 01/11/2026) : liste de présence des cours du dimanche.
-- L'équipe coche (présente, excusée), décoche, annule une séance ; jamais un autre jour qu'un dimanche,
-- jamais un dimanche à venir ; la mannequin lit SES présences et ne peut rien écrire ; un visiteur rien.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
update staff_profiles set actif = true;
update agence_mannequins set statut = 'actif' where id = '00000000-0000-0000-0000-0000000000d1';
create temp table jours as select
  (current_date - (extract(isodow from current_date)::int % 7))::date as dernier,     -- dimanche passé (ou aujourd'hui)
  (current_date - (extract(isodow from current_date)::int % 7) - 7)::date as avant,   -- celui d'avant
  (current_date - (extract(isodow from current_date)::int % 7) + 7)::date as prochain; -- à venir
grant select on jours to authenticated, anon;

-- Gestion du site (rôle « site ») : coche, change, décoche
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select presence_marquer('00000000-0000-0000-0000-0000000000d1', (select dernier from jours), 'present');
select essai_refuse($$select * from presences$$, 'lecture directe de la table : refusée (fonctions seulement)');
select essai(((presences_mois((select dernier from jours)) -> 'presences') -> 0 ->> 'etat') = 'present', 'équipe : présente cochée (vert)');
select presence_marquer('00000000-0000-0000-0000-0000000000d1', (select dernier from jours), 'excuse');
select essai(((presences_mois((select dernier from jours)) -> 'presences') -> 0 ->> 'etat') = 'excuse', 'équipe : changée en absence excusée (orange)');
select presence_marquer('00000000-0000-0000-0000-0000000000d1', (select avant from jours), 'present');
select presence_marquer('00000000-0000-0000-0000-0000000000d1', (select avant from jours), null);
select essai(json_array_length(presences_periode((select avant from jours), (select dernier from jours)) -> 'presences') = 1, 'équipe : décocher efface la présence');
select essai(exists (select 1 from json_array_elements(presences_mois((select dernier from jours)) -> 'mannequins') m where m ->> 'nom' = 'KONÉ AWA'), 'les mannequins actives du registre sont sur la liste');
select essai_refuse($$select presence_marquer('00000000-0000-0000-0000-0000000000d1', (select dernier from jours) - 1, 'present')$$, 'un samedi : refusé (dimanches seulement)');
select essai_refuse($$select presence_marquer('00000000-0000-0000-0000-0000000000d1', (select prochain from jours), 'present')$$, 'un dimanche à venir : refusé');
select essai_refuse($$select presence_marquer('00000000-0000-0000-0000-0000000000d1', (select dernier from jours), 'absent')$$, 'état inconnu : refusé');
select essai_refuse($$insert into presences (mannequin_id, dimanche, etat) values ('00000000-0000-0000-0000-0000000000d1', (select avant from jours), 'present')$$, 'écriture directe dans la table : refusée');
-- séance annulée : ne compte pour personne, efface les cases du jour, interdit de cocher ; rétablie : on recoche
select presence_marquer('00000000-0000-0000-0000-0000000000d1', (select avant from jours), 'present');
select presences_seance_annuler((select avant from jours), true, 'Fête de l''agence');
select essai((presences_mois((select avant from jours)) -> 'annulees') -> 0 ->> 'motif' = 'Fête de l''agence', 'séance annulée, avec son motif');
select essai(not exists (select 1 from json_array_elements(presences_periode((select avant from jours), (select avant from jours)) -> 'presences') p where p ->> 'dimanche' = (select avant from jours)::text), 'séance annulée : ses cases cochées sont effacées');
select essai_refuse($$select presence_marquer('00000000-0000-0000-0000-0000000000d1', (select avant from jours), 'present')$$, 'séance annulée : on ne coche pas');
select presences_seance_annuler((select avant from jours), false, null);
select presence_marquer('00000000-0000-0000-0000-0000000000d1', (select avant from jours), 'present');
select essai(json_array_length(presences_periode((select avant from jours), (select dernier from jours)) -> 'presences') = 2, 'séance rétablie : on recoche');

-- Signe « mensualité à payer » : seulement pour qui a accès aux Paiements
select essai(not exists (select 1 from json_array_elements(presences_mois(current_date) -> 'mannequins') m where m ->> 'mensualite' is not null), 'gestion du site (sans les Paiements) : aucune information de paiement');
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai(exists (select 1 from json_array_elements(presences_mois(current_date) -> 'mannequins') m where m ->> 'nom' = 'KONÉ AWA' and m ->> 'mensualite' in ('a_payer', 'non_paye', 'paye', 'attente')), 'principal : l''état de la mensualité du mois est là');
select essai_qui('00000000-0000-0000-0000-0000000000a2');
-- Encaissements (rôle « caisse ») : pas l'espace « site », donc rien (relecture du 01/11/2026)
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai_refuse($$select presences_mois(current_date)$$, 'encaissements : pas d''accès à la liste de présence');
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai(presences_mois(current_date) is not null, 'principal : voit la liste');
-- Sans double authentification, ou compte sans rôle : rien
select essai_qui('00000000-0000-0000-0000-0000000000a2', 'aal1');
select essai_refuse($$select presences_mois(current_date)$$, 'sans double authentification : refusé');
select essai_qui('00000000-0000-0000-0000-0000000000a6');
select essai_refuse($$select presence_marquer('00000000-0000-0000-0000-0000000000d1', (select dernier from jours), 'present')$$, 'compte sans rôle : refusé');

-- La mannequin connectée (Roxane, b1) : lit SES présences, ne coche rien, ne voit pas la liste
reset role;
select set_config('request.jwt.claims', '', false);
insert into presences (mannequin_id, dimanche, etat) select id, (select dernier from jours), 'present' from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1'
  on conflict do nothing;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai(json_array_length(mes_presences() -> 'presences') = 1 and (mes_presences() -> 'presences') -> 0 ->> 'etat' = 'present', 'mannequin : voit SA présence');
select essai(mes_presences()::text not like '%KONÉ%', 'mannequin : ne voit rien des autres');
select essai_refuse($$select presence_marquer((select id from agence_mannequins limit 1), (select dernier from jours), 'present')$$, 'mannequin : ne peut pas se cocher elle-même');
select essai_refuse($$select presences_mois(current_date)$$, 'mannequin : ne voit pas la liste de l''agence');
select essai_refuse($$select presences_seance_annuler((select dernier from jours), true, 'x')$$, 'mannequin : n''annule pas une séance');

-- Un visiteur non connecté : rien
reset role;
select set_config('request.jwt.claims', '', false);
set role anon;
select essai_refuse($$select mes_presences()$$, 'visiteur : refusé');
select essai_refuse($$select presences_mois(current_date)$$, 'visiteur : pas de liste');
reset role;
