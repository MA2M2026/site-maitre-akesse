-- Essais de supabase-formation.sql (Extension 148, 01/11/2026) : 18 mois de cours, congés (décembre, janvier,
-- février) sans mensualité, ni appel, ni relance ; un mois de congé payé compte pour le prochain mois de cours ;
-- formation terminée après le 18e mois ; écran de l'Administration réservé aux Paiements.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
select essai(mois_conge('2025-12-01') and mois_conge('2026-01-15') and mois_conge('2026-02-01') and not mois_conge('2026-03-01') and not mois_conge('2026-11-01'), 'congés : décembre, janvier, février');
select essai((select count(*) from formation_mois('2025-03-01')) = 18 and (select max(m) from formation_mois('2025-03-01') m) = '2026-11-01', 'entrée en mars 2025 : 18 mois de cours, le dernier en novembre 2026');
select essai(not exists (select 1 from formation_mois('2025-03-01') m where mois_conge(m)), 'aucun mois de congé dans les 18 mois');
select essai((select min(m) from formation_mois('2025-12-15') m) = '2026-03-01', 'entrée pendant les congés : les cours commencent en mars');
-- mannequins d'essai : fa1 (formation finie en novembre 2025), fa2 (décembre 2024 payé), fa3 (décembre payé ET mars payé)
insert into agence_mannequins (id, full_name, statut, date_entree, cree_le, mensualite) values
  ('00000000-0000-0000-0000-000000000fa1', 'ESSAI FORMATION FINIE', 'actif', '2024-03-01', '2024-03-01', 20000),
  ('00000000-0000-0000-0000-000000000fa2', 'ESSAI CONGÉ PAYÉ', 'actif', '2024-03-01', '2024-03-01', 20000),
  ('00000000-0000-0000-0000-000000000fa3', 'ESSAI CONGÉ ET MARS PAYÉS', 'actif', '2024-03-01', '2024-03-01', 20000)
on conflict (id) do nothing;
insert into paiements_mannequins (mannequin_id, objet, mois, montant, mode, statut) values
  ('00000000-0000-0000-0000-000000000fa1', 'mensualite', '2024-03-01', 20000, 'especes', 'valide'),
  ('00000000-0000-0000-0000-000000000fa2', 'mensualite', '2024-03-01', 20000, 'especes', 'valide'),
  ('00000000-0000-0000-0000-000000000fa2', 'mensualite', '2024-12-01', 20000, 'especes', 'valide'),
  ('00000000-0000-0000-0000-000000000fa3', 'mensualite', '2024-03-01', 20000, 'especes', 'valide'),
  ('00000000-0000-0000-0000-000000000fa3', 'mensualite', '2024-12-01', 20000, 'especes', 'valide'),
  ('00000000-0000-0000-0000-000000000fa3', 'mensualite', '2025-03-01', 20000, 'especes', 'valide')
on conflict do nothing;
select essai(formation_fin('00000000-0000-0000-0000-000000000fa1') = '2025-11-01', 'entrée en mars 2024 : formation finie en novembre 2025');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai(mensualite_etat('00000000-0000-0000-0000-000000000fa1', '2024-12-01') = 'conge' and mensualite_etat('00000000-0000-0000-0000-000000000fa1', '2025-02-01') = 'conge', 'un mois de congé non payé : « congé », jamais « non payé »');
select essai(mensualite_etat('00000000-0000-0000-0000-000000000fa1', '2025-11-01') = 'non_paye', 'le 18e mois de cours non payé : en retard');
select essai(mensualite_etat('00000000-0000-0000-0000-000000000fa1', '2026-03-01') = 'termine', 'après le 18e mois : formation terminée, plus rien à payer');
select essai(mensualite_etat('00000000-0000-0000-0000-000000000fa2', '2024-12-01') = 'paye', 'un mois de congé payé reste noté payé');
select essai(mensualite_etat('00000000-0000-0000-0000-000000000fa2', '2025-03-01') = 'paye' and mensualite_etat('00000000-0000-0000-0000-000000000fa2', '2025-04-01') = 'non_paye', 'décembre payé : compte pour mars (le prochain mois de cours), pas pour avril');
select essai(mensualite_etat('00000000-0000-0000-0000-000000000fa3', '2025-03-01') = 'paye' and mensualite_etat('00000000-0000-0000-0000-000000000fa3', '2025-04-01') = 'paye' and mensualite_etat('00000000-0000-0000-0000-000000000fa3', '2025-05-01') = 'non_paye', 'mars déjà payé : décembre compte pour avril');
select essai(json_array_length(mensualites_etats('2024-11-01', '2025-04-01') -> 'conges') = 3, 'Administration : les 3 mois de congé de la période');
select essai((select (x -> 'etats' ->> '2025-03-01') from json_array_elements(mensualites_etats('2024-11-01', '2025-04-01') -> 'mannequins') x where x ->> 'id' = '00000000-0000-0000-0000-000000000fa2') = 'paye'
  and (select (x ->> 'fin') from json_array_elements(mensualites_etats('2024-11-01', '2025-04-01') -> 'mannequins') x where x ->> 'id' = '00000000-0000-0000-0000-000000000fa1') = '2025-11-01', 'Administration : les états et la fin de formation de chaque mannequin');
select essai_refuse($$select mensualites_etats('2024-01-01', '2025-06-01')$$, 'plus de 12 mois d''un coup : refusé');
select essai_refuse($$select mensualites_appeler('2026-12-01', array['00000000-0000-0000-0000-000000000fa2'::uuid])$$, 'pas d''appel pendant les congés');
select essai(json_array_length(mensualites_appeler('2026-03-01', array['00000000-0000-0000-0000-000000000fa1'::uuid])) = 0, 'pas d''appel à une mannequin dont la formation est terminée');
reset role;
select essai(not exists (select 1 from mensualites_appels where mannequin_id = '00000000-0000-0000-0000-000000000fa1'), 'aucun appel noté pour elle');
-- côté mannequin connectée (b1)
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai((mes_mensualites() ->> 'total')::int = 18, 'mannequin : 18 mensualités en tout');
select essai((select count(*) from json_array_elements(mes_mensualites() -> 'mois') x where not (x ->> 'conge')::boolean) = 18, 'mannequin : exactement 18 mois de cours dans son calendrier');
select essai((select bool_and(x ->> 'etat' in ('conge', 'paye', 'attente')) from json_array_elements(mes_mensualites() -> 'mois') x where (x ->> 'conge')::boolean), 'mannequin : les congés en gris (sauf un mois déjà payé)');
select essai_refuse(format('select mensualite_declarer(%L)', make_date(extract(year from now())::int, 12, 1)), 'mannequin : on ne paie pas un mois de congé');
select essai_refuse(format('select mensualite_declarer_avec_numero(%L, %L)', make_date(extract(year from now())::int + 1, 1, 1), '+225 07 01 02 03 04'), 'mannequin : pas de mensualité en janvier non plus (avec numéro)');
select essai(mensualites_payer_avance(1, '+225 07 01 02 03 04') = 1, 'paiement à l''avance : un mois de cours');
reset role;
select essai((select bool_and(not mois_conge(p.mois)) from paiements_mannequins p join agence_mannequins a on a.id = p.mannequin_id
  where a.user_id = '00000000-0000-0000-0000-0000000000b1' and p.objet = 'mensualite'
    and p.declare_le = (select max(q.declare_le) from paiements_mannequins q where q.mannequin_id = a.id)), 'paiement à l''avance : jamais un mois de congé (sautés)');
set role anon;
select essai_refuse($$select mensualites_etats('2025-01-01', '2025-03-01')$$, 'visiteur : refusé');
reset role;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai_refuse($$select mensualites_etats('2025-01-01', '2025-03-01')$$, 'mannequin : pas d''accès aux états de toutes les mannequins');
select essai_refuse($$select formation_fin('00000000-0000-0000-0000-000000000fa1')$$, 'fonctions internes : fermées');
reset role;
