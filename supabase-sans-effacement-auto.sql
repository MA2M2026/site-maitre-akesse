-- =====================================================================================================
-- Plus AUCUN effacement automatique des candidatures ni de leurs photos (17/11/2026, décision de la propriétaire)
-- =====================================================================================================
-- Deux anciennes règles tournaient chaque nuit :
--   1. nettoyer_photos_traitees_anciennes (3 h) : retirait de l Administration les photos des candidatures
--      « Retenue » ou « Refusée » depuis 5 jours (et celles des inscriptions payées ou annulées). Les photos
--      disparaissaient donc des fiches, alors que les fichiers restaient dans Google Drive
--   2. effacer_anciennes_candidatures (3 h 30) : supprimait les dossiers refusés après 30 jours et tous les
--      autres après 6 mois.
-- Désormais les photos ne sont plus jamais retirées, et un dossier ne part que par le bouton « Supprimer ce
-- dossier » de l administratrice principale, SAUF une seule règle promise par la politique de confidentialité :
-- candidature refusée (ou inscription annulée) effacée 2 ans après la réponse (version 2, 17/11 au soir).
-- A COLLER UNE FOIS dans Supabase (SQL Editor, Run). Rien n est effacé par ce fichier. Peut être recollé sans risque.

create or replace function nettoyer_photos_traitees_anciennes()
returns integer language sql security definer set search_path = public as $$
  select 0
$$;
revoke all on function nettoyer_photos_traitees_anciennes() from public, anon, authenticated;

-- UNE seule règle automatique, conforme à la politique de confidentialité du site (choix de la propriétaire) :
-- une candidature REFUSÉE est effacée 2 ans après la réponse de l agence, une inscription ANNULÉE aussi.
-- Rien d autre n est jamais effacé tout seul (retenues, en attente, mannequins, cours de talons : jamais).
create or replace function effacer_anciennes_candidatures()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer;
  m integer;
begin
  delete from casting_applications where status = 'refusée' and statut_change_at < now() - interval '2 years';
  get diagnostics n = row_count;
  delete from inscriptions_mannequins where statut = 'annulée' and statut_change_at < now() - interval '2 years';
  get diagnostics m = row_count;
  return n + m;
end;
$$;
revoke all on function effacer_anciennes_candidatures() from public, anon, authenticated;

-- (un ancien onglet de l Administration encore ouvert peut appeler l ancien bouton : réponse 0, pas d erreur)
grant execute on function nettoyer_photos_traitees_anciennes() to authenticated;

select cron.unschedule('nettoyage-photos-traitees') where exists (select 1 from cron.job where jobname = 'nettoyage-photos-traitees');
select cron.unschedule('effacement-anciennes-candidatures') where exists (select 1 from cron.job where jobname = 'effacement-anciennes-candidatures');
select cron.unschedule('effacement-candidatures-2-ans') where exists (select 1 from cron.job where jobname = 'effacement-candidatures-2-ans');
select cron.schedule('effacement-candidatures-2-ans', '30 3 * * *', 'select effacer_anciennes_candidatures();');

NOTIFY pgrst, 'reload schema';

-- Contrôle : les 2 anciennes tâches parties, la règle des 2 ans en place, plus aucune photo retirée
select 'Effacement automatique : ' ||
  (case when not exists (select 1 from cron.job where jobname in ('nettoyage-photos-traitees', 'effacement-anciennes-candidatures')) then 1 else 0 end
   + (select count(*) from cron.job where jobname = 'effacement-candidatures-2-ans')
   + (select count(*) from pg_proc where proname = 'nettoyer_photos_traitees_anciennes' and prosrc not ilike '%delete%')
   + (select count(*) from pg_proc where proname = 'effacer_anciennes_candidatures' and prosrc ilike '%2 years%')) || ' éléments sur 4' as controle;
