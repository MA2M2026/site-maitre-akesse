-- =====================================================================================
-- Remise à zéro de l'espace Paiements (08/11/2026, demande de la propriétaire, après la comptabilité le 07/11) :
-- on repart de zéro au 1er mars ; l'historique du rodage (septembre à novembre 2026) faussait les écrans
-- (90 000 FCFA « validés » en novembre, septembre et octobre cochés). Copie gardée avant : Excel et PDF du 07/11
-- (evidence/, hors dépôt). Les mois déjà faits par chaque mannequin se notent dans « Reprise du 1er mars ».
-- NE TOUCHE PAS : les mannequins, leurs fiches, leurs choix de la reprise (inscription_reprise), les sorties.
-- À coller UNE fois dans Supabase › SQL Editor › Run. Contrôle en bas.
-- =====================================================================================
begin;
delete from rapprochements;
delete from mensualites_appels;
-- (les reçus sont en lecture seule : le verrou est levé le temps de l'effacement, puis remis)
alter table recus_paiements disable trigger recus_lecture_seule;
delete from recus_paiements;
alter table recus_paiements enable trigger recus_lecture_seule;
delete from paiements_mannequins;
commit;
NOTIFY pgrst, 'reload schema';
select case when (select count(*) from paiements_mannequins) = 0 and (select count(*) from recus_paiements) = 0
              and (select count(*) from rapprochements) = 0 and (select count(*) from mensualites_appels) = 0
              and (select count(*) from pg_trigger where tgname = 'recus_lecture_seule' and tgenabled = 'O') = 1
            then '✅ Paiements remis à zéro (verrou des reçus remis)' else '❌ Remise à zéro incomplète' end as controle;
