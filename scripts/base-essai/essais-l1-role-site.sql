-- Essais de supabase-l1-role-site.sql (audit L-1, 16/11/2026) : l'« Administrateur du site » ne valide plus aucun
-- paiement des cours de talons ; les encaissements et le principal, oui ; le suivi (notes, date, terminé, annulé,
-- rouvert) reste à l'équipe du site.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
select set_config('request.jwt.claims', '', false);
-- (insertion directe : les limites d'envois par minute des formulaires sont déjà essayées ailleurs)
insert into cours_talons (id, formule, nom, telephone, age, nb_seances) values
  ('00000000-0000-0000-0000-0000000c1101', 'prive_salle', 'Awa L1', '+2250700001101', 25, 1);
insert into cours_talons (id, formule, paiement, nb_mois, nom, telephone, age) values
  ('00000000-0000-0000-0000-0000000c1102', 'groupe', 'mensuel', 3, 'Bintou L1', '+2250700001102', 27);
update cours_talons set montant = 25000 where id = '00000000-0000-0000-0000-0000000c1101';

-- l'équipe du site (a2) : plus aucun encaissement
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai(portail_peut('site') and not portail_peut('paiements'), 'compte d''essai « site » : espace site oui, encaissements non');
select essai_refuse($$select cours_talons_valider('00000000-0000-0000-0000-0000000c1101')$$, 'site : « Paiement reçu » refusé');
select essai_refuse($$select cours_talons_valider('00000000-0000-0000-0000-0000000c1101', 25000, true)$$, 'site : « Payé en espèces » refusé');
select essai_refuse($$update cours_talons set statut = 'inscrite' where id = '00000000-0000-0000-0000-0000000c1101'$$, 'site : passer l''élève « inscrite » à la main (sans paiement validé) refusé');
select essai_refuse($$update cours_talons set valide_le = now() where id = '00000000-0000-0000-0000-0000000c1101'$$, 'site : écrire une date de validation refusé');
select essai_refuse($$update cours_talons set mois_payes = 2 where id = '00000000-0000-0000-0000-0000000c1102'$$, 'site : écrire des mois payés refusé');
-- le suivi reste possible
update cours_talons set notes = 'Appeler samedi', date_seance = current_date + 7, montant = 30000 where id = '00000000-0000-0000-0000-0000000c1101';
select essai((select notes = 'Appeler samedi' and montant = 30000 from cours_talons where id = '00000000-0000-0000-0000-0000000c1101'), 'site : notes, date et montant AVANT paiement modifiables (suivi)');
reset role;
select essai((select count(*) = 0 from compta_ecritures where categorie = 'cours_talons' and tiers in ('Awa L1', 'Bintou L1')), 'aucune recette créée par les essais refusés');

-- encaissements (a3) : valide, la recette part en Comptabilité
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a3');
select cours_talons_valider('00000000-0000-0000-0000-0000000c1101');
reset role;
select essai((select statut = 'inscrite' and valide_le is not null and ecriture_id is not null from cours_talons where id = '00000000-0000-0000-0000-0000000c1101'), 'encaissements : paiement validé, recette créée');

-- principal (a1) : valide le groupe et un mois de plus
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a1');
select cours_talons_valider('00000000-0000-0000-0000-0000000c1102');
select cours_talons_mois_payer('00000000-0000-0000-0000-0000000c1102', 2);
reset role;
select essai((select statut = 'inscrite' and mois_payes = 2 from cours_talons where id = '00000000-0000-0000-0000-0000000c1102'), 'principal : premier paiement et mois 2 validés');

-- site, après le paiement : le montant payé ne bouge plus ; le suivi continue
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000a2');
select essai_refuse($$select cours_talons_mois_payer('00000000-0000-0000-0000-0000000c1102', 3)$$, 'site : « Mois 3 payé » refusé');
select essai_refuse($$update cours_talons set montant = 1 where id = '00000000-0000-0000-0000-0000000c1101'$$, 'site : changer le montant déjà payé refusé');
update cours_talons set statut = 'annulee' where id = '00000000-0000-0000-0000-0000000c1101';
update cours_talons set statut = 'inscrite' where id = '00000000-0000-0000-0000-0000000c1101';
update cours_talons set statut = 'terminee' where id = '00000000-0000-0000-0000-0000000c1101';
select essai((select statut = 'terminee' from cours_talons where id = '00000000-0000-0000-0000-0000000c1101'), 'site : annuler, rouvrir (paiement déjà validé) et « Cours terminés » restent possibles');
reset role;

-- le serveur (clé secrète) n'est pas gêné
set role service_role;
select set_config('request.jwt.claims', '', false);
update cours_talons set notes = 'serveur' where id = '00000000-0000-0000-0000-0000000c1102';
reset role;
select essai((select notes = 'serveur' from cours_talons where id = '00000000-0000-0000-0000-0000000c1102'), 'serveur (clé secrète) : écritures non bloquées');
select '✅ L-1 partie 1 : tous les essais passent';
