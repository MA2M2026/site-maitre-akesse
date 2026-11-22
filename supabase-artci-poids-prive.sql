-- =====================================================================================================
-- Minimisation ARTCI (22/11/2026, décision de la propriétaire) : le poids des mannequins n est plus public
-- =====================================================================================================
-- Les visiteurs du site (rôle anon) ne peuvent plus lire la colonne weight_kg de model_profiles.
-- Les comptes connectés (mannequins, équipe) la lisent toujours. Limite connue : un compte mannequin connecté
-- pourrait lire le poids des autres fiches publiées (le fermer demanderait une fonction dédiée, à prévoir).
-- A COLLER APRÈS la mise en ligne du site qui ne lit plus ce champ sur les pages publiques
-- (sinon les fiches publiques en panne). Rien n est effacé. Peut être recollé sans risque.
-- Retour arrière si besoin : grant select (weight_kg) on model_profiles to anon

revoke select (weight_kg) on model_profiles from anon;

-- Contrôle
select case when not has_column_privilege('anon', 'public.model_profiles', 'weight_kg', 'select')
  then '✅ ARTCI : le poids des mannequins n est plus lisible par les visiteurs'
  else '❌ ARTCI : le poids est encore lisible par les visiteurs' end as controle;
