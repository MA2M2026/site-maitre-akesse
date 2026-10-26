-- Essais de supabase-paiement-avance.sql (26/10/2026) : la mannequin connectée paie jusqu'à 3 mois
-- à l'avance ; tous les mois déclarés ensemble, à la même heure (une seule ligne à vérifier pour
-- l'agence), avec son numéro ; tout ou rien ; jamais pour un visiteur.
\set ON_ERROR_STOP 1
set search_path = public, extensions;
reset role;
-- une mannequin du registre avec son compte, entrée ce mois-ci, sans paiement à venir
delete from paiements_mannequins where mannequin_id in (select id from agence_mannequins where user_id = '00000000-0000-0000-0000-0000000000b1')
  and objet = 'mensualite' and mois > date_trunc('month', now())::date;
update agence_mannequins set date_entree = current_date, cree_le = now(), statut = 'actif' where user_id = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
select essai_refuse($$select mensualites_payer_avance(4, '+225 07 01 02 03 04')$$, 'pas plus de 3 mois à l''avance');
select essai_refuse($$select mensualites_payer_avance(2, 'abc')$$, 'numéro mobile money invalide refusé');
select essai(mensualites_payer_avance(2, '+225 07 01 02 03 04') = 2, 'deux mois payés à l''avance');
reset role;
select essai((select count(*) from paiements_mannequins p join agence_mannequins a on a.id = p.mannequin_id
  where a.user_id = '00000000-0000-0000-0000-0000000000b1' and p.objet = 'mensualite' and p.statut = 'declare'
    and p.mois in ((date_trunc('month', now()) + interval '1 month')::date, (date_trunc('month', now()) + interval '2 months')::date)) = 2,
  'les deux mois SUIVANTS sont déclarés (en attente de l''agence)');
select essai((select count(distinct p.declare_le) from paiements_mannequins p join agence_mannequins a on a.id = p.mannequin_id
  where a.user_id = '00000000-0000-0000-0000-0000000000b1' and p.objet = 'mensualite' and p.mois > date_trunc('month', now())::date) = 1,
  'déclarés à la même heure : une seule ligne au montant total à vérifier pour l''agence');
select essai((select count(*) from rapprochements r join paiements_mannequins p on p.id = r.paiement_id join agence_mannequins a on a.id = p.mannequin_id
  where a.user_id = '00000000-0000-0000-0000-0000000000b1' and p.mois > date_trunc('month', now())::date and r.numero_payeur = '+225 07 01 02 03 04') = 2,
  'le numéro du payeur est noté pour chaque mois');
set role authenticated;
select essai_qui('00000000-0000-0000-0000-0000000000b1', 'aal1');
-- il ne reste qu'un mois payable à l'avance : en demander 2 ne déclare RIEN (tout ou rien)
select essai_refuse($$select mensualites_payer_avance(2, '+225 07 01 02 03 04')$$, 'plus de mois que possible : refusé');
reset role;
select essai((select count(*) from paiements_mannequins p join agence_mannequins a on a.id = p.mannequin_id
  where a.user_id = '00000000-0000-0000-0000-0000000000b1' and p.objet = 'mensualite' and p.mois > date_trunc('month', now())::date) = 2,
  'tout ou rien : aucun mois de plus déclaré après le refus');
set role anon;
select essai_refuse($$select mensualites_payer_avance(1, '+225 07 01 02 03 04')$$, 'visiteur non connecté : refusé');
reset role;
