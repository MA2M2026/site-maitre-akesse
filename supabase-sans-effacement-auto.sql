-- =====================================================================================================
-- Plus AUCUN effacement automatique des candidatures ni de leurs photos (17/11/2026, décision de la propriétaire)
-- =====================================================================================================
-- Deux anciennes règles tournaient chaque nuit :
--   1. nettoyer_photos_traitees_anciennes (3 h) : retirait de l Administration les photos des candidatures
--      « Retenue » ou « Refusée » depuis 5 jours (et celles des inscriptions payées ou annulées). Les photos
--      disparaissaient donc des fiches, alors que les fichiers restaient dans Google Drive
--   2. effacer_anciennes_candidatures (3 h 30) : supprimait les dossiers refusés après 30 jours et tous les
--      autres après 6 mois.
-- Désormais rien n est retiré ni supprimé tout seul : un dossier ne part que par le bouton « Supprimer ce
-- dossier » de l administratrice principale. Les deux fonctions restent (elles ne font plus rien) pour qu aucun
-- ancien appel ne tombe en erreur. Les tâches de nuit sont retirées.
-- A COLLER UNE FOIS dans Supabase (SQL Editor, Run). Rien n est effacé par ce fichier. Peut être recollé sans risque.

create or replace function nettoyer_photos_traitees_anciennes()
returns integer language sql security definer set search_path = public as $$
  select 0
$$;
revoke all on function nettoyer_photos_traitees_anciennes() from public, anon, authenticated;

create or replace function effacer_anciennes_candidatures()
returns integer language sql security definer set search_path = public as $$
  select 0
$$;
revoke all on function effacer_anciennes_candidatures() from public, anon, authenticated;

select cron.unschedule('nettoyage-photos-traitees') where exists (select 1 from cron.job where jobname = 'nettoyage-photos-traitees');
select cron.unschedule('effacement-anciennes-candidatures') where exists (select 1 from cron.job where jobname = 'effacement-anciennes-candidatures');

NOTIFY pgrst, 'reload schema';

-- Contrôle : 0 tâche de nuit restante et 2 fonctions sans effet
select 'Effacement automatique arrêté : ' ||
  (case when not exists (select 1 from cron.job where jobname in ('nettoyage-photos-traitees', 'effacement-anciennes-candidatures')) then 1 else 0 end
   + (select count(*) from pg_proc where proname in ('nettoyer_photos_traitees_anciennes', 'effacer_anciennes_candidatures') and prosrc not ilike '%delete%')) || ' éléments sur 3' as controle;
