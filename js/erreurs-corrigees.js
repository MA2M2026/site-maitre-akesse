// ================== Erreurs corrigées (nettoyage automatique du journal) ==================
// Demande de la propriétaire (29/09/2026) : une fois qu'un problème du journal des
// erreurs (tableau de bord) a été corrigé, il doit DISPARAÎTRE tout seul ; s'il est
// encore là, c'est qu'il n'est pas réglé.
//
// Fonctionnement : à chaque correction, on ajoute ici une ligne avec un morceau de
// texte qui identifie l'erreur (cherché dans le message ET le détail technique) et
// la date/heure de mise en ligne de la correction. Le tableau de bord efface alors
// automatiquement toutes les occurrences de cette erreur survenues AVANT cette date.
// Si la même erreur se reproduit APRÈS, elle réapparaît : la correction n'a pas suffi.
//
// Format : { motif: 'texte exact à chercher', corrige_le: 'AAAA-MM-JJTHH:MM:SSZ' (UTC), note: 'quoi' }
window.MA2M_ERREURS_CORRIGEES = [
  { motif: 'inscriptions_mannequins.genre does not exist', corrige_le: '2026-09-29T15:02:31Z', note: 'Colonne « genre » ajoutée dans Supabase (Extension 48 lancée par la propriétaire) — formulaire d’inscription réparé' },
  { motif: "la page s'affiche dézoomée", corrige_le: '2026-09-29T15:41:02Z', note: 'Faux signalement : page ouverte dans une fenêtre invisible (écran 0×0, aperçu de lien ou préchargement) — ces fenêtres sont désormais ignorées' },
  { motif: 'footer.site-footer', corrige_le: '2026-09-29T15:52:23Z', note: 'Actualités / Événements : place du bloc « À la une » réservée pendant le chargement, le bas de page ne saute plus' }
];
