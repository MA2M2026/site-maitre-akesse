-- =====================================================================================================
-- Mission sécurité du 17/11/2026 (demande de la propriétaire) : petits renforcements de la base
-- =====================================================================================================
-- 1. Trois fonctions de calcul n avaient pas de chemin de recherche fixe (avertissement de Supabase
--    « function_search_path_mutable ») : il est fixé à public, comme pour toutes les autres.
-- 2. Vieux journal de mise au point (debug_journal_validation_publication, créé à la main lors d une ancienne
--    réparation de la publication des mannequins, plus rempli, illisible depuis le site) : supprimé, avec l accord
--    de la propriétaire. Il ne contenait que des traces techniques (aucune photo, aucun dossier).
-- A COLLER UNE FOIS dans Supabase (SQL Editor, Run). Rien n est effacé. Peut être recollé sans risque.

alter function compta_type_du_mode(text) set search_path = public;
alter function cours_talons_prix_mois() set search_path = public;
alter function cours_talons_module(text, int[], int) set search_path = public;

drop table if exists debug_journal_validation_publication;

-- Contrôle
select 'Sécurité 17/11 : ' || (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('compta_type_du_mode', 'cours_talons_prix_mois', 'cours_talons_module') and proconfig is not null)
  + (case when to_regclass('public.debug_journal_validation_publication') is null then 1 else 0 end) || ' éléments sur 4' as controle;
