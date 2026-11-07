-- Essais de supabase-reprise-mars.sql (Extension 154, 07/11/2026) : rodage jamais réclamé, fiche de formation de la
-- reprise (niveaux, mois déjà faits → il reste N mois), inscriptions de la reprise, bilan d'ouverture, clôture guidée
-- (comptage, écart en régularisation avec motif, mois verrouillé), archives du rodage, application des mannequins.
-- Base d'essai LOCALE seulement (jamais la vraie base).
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
select essai(reprise_date() = '2027-03-01' and mois_rodage('2026-09-15') and mois_rodage('2026-11-01') and not mois_rodage('2026-12-01') and not mois_rodage('2027-03-01'),
  'réglages : reprise le 1er mars 2027, rodage de septembre à novembre 2026');
select essai((select count(*) from formation_mois_n('2027-03-01', 11)) = 11 and (select max(m) from formation_mois_n('2027-03-01', 11) m) = '2028-04-01',
  '11 mois de cours dès mars 2027 : le dernier en avril 2028 (congés sautés)');
insert into agence_mannequins (id, full_name, statut, date_entree, cree_le, mensualite) values
  ('00000000-0000-0000-0000-000000154e01', 'ESSAI REPRISE NIVEAU 2', 'actif', '2026-09-10', '2026-09-10', 10000),
  ('00000000-0000-0000-0000-000000154e02', 'ESSAI REPRISE NIVEAU 1 FINI', 'actif', '2026-09-10', '2026-09-10', 10000),
  ('00000000-0000-0000-0000-000000154e03', 'ESSAI REPRISE INSCRIPTION DUE', 'actif', '2026-10-01', '2026-10-01', 10000)
on conflict (id) do nothing;
insert into paiements_mannequins (mannequin_id, objet, mois, montant, mode, statut) values
  ('00000000-0000-0000-0000-000000154e01', 'mensualite', '2026-10-01', 10000, 'especes', 'valide')
on conflict do nothing;

set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');   -- (Encaissements : Paiements)
select essai(mensualite_etat('00000000-0000-0000-0000-000000154e01', '2026-09-01') = 'rodage' and mensualite_etat('00000000-0000-0000-0000-000000154e01', '2026-11-01') = 'rodage',
  'rodage : septembre et novembre 2026 non payés → « rodage », jamais « non payé »');
select essai(mensualite_etat('00000000-0000-0000-0000-000000154e01', '2026-10-01') = 'paye', 'rodage : un mois payé reste payé');
select essai(mensualite_etat('00000000-0000-0000-0000-000000154e01', '2026-12-01') = 'conge' and mensualite_etat('00000000-0000-0000-0000-000000154e01', '2027-02-01') = 'conge',
  'décembre à février : congés');
select essai_refuse($$select mensualites_appeler('2026-11-01', array['00000000-0000-0000-0000-000000154e01'::uuid])$$, 'aucun appel avant la reprise (rodage)');
-- fiche de formation (assistant de reprise)
select essai((reprise_mannequin_enregistrer('00000000-0000-0000-0000-000000154e01', 'actif', 2, 7) ->> 'reste')::int = 11, 'reprise : niveau 2, 7 mois déjà faits → il reste 11 mois');
reset role;
select essai(formation_debut('00000000-0000-0000-0000-000000154e01') = '2027-03-01' and formation_fin('00000000-0000-0000-0000-000000154e01') = '2028-04-01',
  'reprise : départ le 1er mars 2027, dernier mois en avril 2028');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai(mensualite_etat('00000000-0000-0000-0000-000000154e01', '2028-04-01') <> 'termine' and mensualite_etat('00000000-0000-0000-0000-000000154e01', '2028-05-01') = 'termine',
  'après le dernier mois : formation terminée');
select essai((reprise_mannequin_enregistrer('00000000-0000-0000-0000-000000154e02', 'actif', 1, 9) ->> 'reste')::int = 0, 'reprise : niveau 1 seulement, 9 mois faits → rien à payer');
select essai(mensualite_etat('00000000-0000-0000-0000-000000154e02', '2027-03-01') = 'termine', 'niveau 1 terminé : mars 2027 « terminé », jamais réclamé');
select essai_refuse($$select reprise_mannequin_enregistrer('00000000-0000-0000-0000-000000154e03', 'actif', 1, 12)$$, 'mois déjà faits plus nombreux que les niveaux : refusé');
select essai_refuse($$select reprise_mannequin_enregistrer('00000000-0000-0000-0000-000000154e03', 'perdu', 2, 0)$$, 'statut inconnu : refusé');
-- inscriptions de la reprise
select essai(reprise_inscription('00000000-0000-0000-0000-000000154e01', 'encaissee', 15000) = 'encaissee', 'inscription encaissée avant le système : enregistrée');
select essai_refuse($$select reprise_inscription('00000000-0000-0000-0000-000000154e01', 'abandonnee')$$, 'une inscription déjà enregistrée ne se reprend pas');
select essai(reprise_inscription('00000000-0000-0000-0000-000000154e03', 'a_recevoir', 15000) = 'a_recevoir', 'inscription à recevoir : dans « Ce qu''on nous doit »');
select essai_refuse($$select reprise_inscription('00000000-0000-0000-0000-000000154e03', 'a_recevoir', 15000)$$, 'la même créance deux fois : refusée');
reset role;
select essai(not exists (select 1 from compta_ecritures where paiement_id in (select id from paiements_mannequins where mannequin_id = '00000000-0000-0000-0000-000000154e01' and objet = 'inscription')),
  'inscription d''avant le système : aucune recette (l''argent n''est pas sur les comptes)');
select essai(exists (select 1 from compta_dettes d join compta_tiers t on t.id = d.tiers_id where d.sens = 'creance' and d.categorie = 'inscription' and t.nom = 'ESSAI REPRISE INSCRIPTION DUE' and d.montant = 15000),
  'créance de 15 000 FCFA au nom de la mannequin');

-- clôture guidée d'un mois passé (comptes ouverts depuis janvier 2026 pour l'essai)
update compta_comptes set date_initiale = '2026-01-01', solde_initial = 0;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');   -- (principal)
insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle)
  values ('recette', '2026-06-10', 5000, (select id from compta_comptes where type = 'caisse' order by cree_le limit 1), 'autre', 'Essai recette de juin');
select essai_refuse($$insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle)
  values ('recette', '2026-06-11', 100, (select id from compta_comptes where type = 'caisse' order by cree_le limit 1), 'regularisation', 'Écart à la main')$$,
  'une régularisation ne se saisit pas à la main');
select essai_refuse(format($$select compta_cloturer_complet('2026-06-01', %L::jsonb)$$, json_build_array()::text), 'clôture sans comptage des comptes : refusée');
select essai_refuse(format($$select compta_cloturer_complet('2026-06-01', %L::jsonb)$$,
  (select json_agg(json_build_object('compte_id', id, 'montant', case when type = 'caisse' then 5500 else 0 end)) from compta_comptes where actif)::text),
  'écart sans raison : refusé');
select essai((compta_cloturer_complet('2026-06-01',
  (select json_agg(json_build_object('compte_id', id, 'montant', case when type = 'caisse' then 5500 else 0 end, 'motif', 'Billet de 500 oublié')) from compta_comptes where actif)::jsonb,
  'Essai de clôture') ->> 'mois') = '2026-06-01', 'clôture guidée de juin 2026 : caisse comptée 5 500 pour 5 000 au système, raison donnée');
reset role;
select essai(exists (select 1 from compta_ecritures where categorie = 'regularisation' and sens = 'recette' and montant = 500 and date_op = '2026-06-30' and libelle like 'Écart de clôture%'),
  'écart de 500 : une écriture de régularisation au 30 juin, avec le motif');
select essai((select ecart from compta_comptages c join compta_comptes k on k.id = c.compte_id where c.nature = 'cloture' and c.mois = '2026-06-01' and k.type = 'caisse') = 500,
  'comptage noté : écart de 500');
select essai(exists (select 1 from compta_clotures where mois = '2026-06-01'), 'juin 2026 clôturé (photo des chiffres)');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai_refuse($$insert into compta_ecritures (sens, date_op, montant, compte_id, categorie, libelle)
  values ('depense', '2026-06-20', 100, (select id from compta_comptes where type = 'caisse' order by cree_le limit 1), 'autre', 'Oubli de juin')$$,
  'mois clôturé verrouillé : plus d''écriture à une date de juin');
select essai_refuse($$update compta_ecritures set annule = true, motif_annulation = 'essai' where libelle = 'Essai recette de juin'$$, 'mois clôturé : une écriture de juin ne s''annule plus');
select essai_refuse($$select compta_cloturer_complet('2026-06-01', '[]'::jsonb)$$, 'un mois déjà clôturé ne se reclôture pas');
select essai((select fin from compta_tresorerie('2026-07-01', '2026-08-01') t join compta_comptes k on k.id = t.compte_id where k.type = 'caisse') = 5500,
  'solde reporté : la caisse commence juillet à 5 500');

-- bilan d'ouverture (la date de reprise est avancée au mois en cours pour l'essai, puis remise)
reset role;
update reglages_reprise set rodage_debut = '2025-09-01', rodage_fin = '2025-11-01', date_reprise = date_trunc('month', current_date)::date;
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai_refuse($$select compta_ouverture('[]'::jsonb)$$, 'bilan d''ouverture : réservé à la Compta');
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select essai(json_array_length(compta_ouverture((select json_agg(json_build_object('compte_id', t.compte_id, 'montant', greatest(t.fin, 0) + case when k.type = 'wave' then -1000 else 0 end, 'motif', 'Frais Wave non notés'))
  from compta_tresorerie(date_trunc('month', current_date)::date, current_date + 1) t join compta_comptes k on k.id = t.compte_id where k.actif)::jsonb)) >= 2,
  'bilan d''ouverture : chaque compte compté (Wave 1 000 de moins, raison donnée)');
select essai_refuse($$select compta_ouverture('[]'::jsonb)$$, 'le bilan d''ouverture ne se fait qu''une fois');
reset role;
select essai(exists (select 1 from compta_ecritures where categorie = 'regularisation' and sens = 'depense' and montant = 1000 and libelle like 'Écart constaté à la reprise%'),
  'écart d''ouverture : une écriture de régularisation (dépense de 1 000)');
update reglages_reprise set rodage_debut = '2026-09-01', rodage_fin = '2026-11-01', date_reprise = '2027-03-01';

-- archives du rodage, état de la reprise
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select essai((archives_rodage() ->> 'debut') = '2026-09-01' and json_array_length(archives_rodage() -> 'mannequins') >= 3
  and (select x -> 'etats' ->> '2026-09-01' from json_array_elements(archives_rodage() -> 'mannequins') x where x ->> 'id' = '00000000-0000-0000-0000-000000154e01') = 'rodage',
  'archives du rodage : chaque mannequin et ses mois (septembre « rodage »)');
select essai((select x ->> 'mois_faits' from json_array_elements(reprise_etat() -> 'mannequins') x where x ->> 'id' = '00000000-0000-0000-0000-000000154e01') = '7',
  'état de la reprise : la fiche saisie est relue');
reset role;
set role anon;
select essai_refuse($$select archives_rodage()$$, 'visiteur : archives refusées');
select essai_refuse($$select reprise_etat()$$, 'visiteur : état de la reprise refusé');
select essai_refuse($$select reprise_mannequin_enregistrer('00000000-0000-0000-0000-000000154e01', 'actif', 2, 0)$$, 'visiteur : fiche de formation refusée');
reset role;

-- application des mannequins (b1) : où elle en est
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai(mes_mensualites() ->> 'reste' is not null and mes_mensualites() ->> 'niveau' in ('1', '2') and (mes_mensualites() ->> 'fermee_jusqu_au') = '2027-03-01',
  'application : niveau, mois restants, « agence fermée jusqu''au 1er mars 2027 »');
select essai_refuse($$select reprise_mannequin_enregistrer('00000000-0000-0000-0000-000000154e01', 'actif', 2, 0)$$, 'une mannequin ne change pas sa fiche de formation');
select essai_refuse($$select archives_rodage()$$, 'une mannequin ne lit pas les archives');
reset role;
select essai(true, 'reprise de mars : tous les essais passent');
