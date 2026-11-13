-- =====================================================================================================
-- L'âge des mannequins n'est plus public (13/11/2026, décision de la propriétaire)
-- La fiche publique n'affiche plus l'âge et le site n'appelle plus la fonction ages_mannequins.
-- Ce fichier ferme son accès aux visiteurs et aux comptes connectés : l'âge reste visible seulement
-- dans l'Administration. À COLLER UNE FOIS dans Supabase (SQL Editor), bouton orange « Run without RLS »
-- s'il est proposé. Rien n'est effacé, peut être recollé sans risque.
-- =====================================================================================================

revoke execute on function ages_mannequins(uuid[]) from public, anon, authenticated;

NOTIFY pgrst, 'reload schema';
select 'Âge des mannequins retiré de l’accès public' as resultat;
