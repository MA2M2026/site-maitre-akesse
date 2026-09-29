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
// Le motif est cherché dans le message, le détail ET l'identité du navigateur.
// Robots et copies de test de Vercel : date lointaine (2100) = toujours effacés, car
// ils peuvent encore utiliser une ancienne version du site gardée en mémoire.
// Format : { motif: 'texte exact à chercher', corrige_le: 'AAAA-MM-JJTHH:MM:SSZ' (UTC), note: 'quoi' }
window.MA2M_ERREURS_CORRIGEES = [
  { motif: 'inscriptions_mannequins.genre does not exist', corrige_le: '2026-09-29T15:02:31Z', note: 'Colonne « genre » ajoutée dans Supabase (Extension 48 lancée par la propriétaire) — formulaire d’inscription réparé' },
  { motif: "la page s'affiche dézoomée", corrige_le: '2026-09-29T15:41:02Z', note: 'Faux signalement : page ouverte dans une fenêtre invisible (écran 0×0, aperçu de lien ou préchargement) — ces fenêtres sont désormais ignorées' },
  { motif: 'footer.site-footer', corrige_le: '2026-09-29T15:52:23Z', note: 'Actualités / Événements : place du bloc « À la une » réservée pendant le chargement, le bas de page ne saute plus' },
  { motif: 'meta-externalagent', corrige_le: '2100-01-01T00:00:00Z', note: 'Robot de Facebook (aperçus de liens) : toujours ignoré (il garde parfois une ancienne version du site en mémoire)' },
  { motif: 'section#mot-responsable', corrige_le: '2026-09-29T16:26:11Z', note: 'Accueil : place réservée pour « Mot de Maître Akesse » pendant le chargement' },
  { motif: '« 02 — La vision', corrige_le: '2026-09-29T16:26:11Z', note: 'Accueil : place réservée pour « Mannequin à la une » pendant le chargement' },
  { motif: '__firefox__', corrige_le: '2026-09-29T16:37:12Z', note: 'Programmes injectés par le navigateur Brave (iPhone) : ignorés par le journal' },
  { motif: 'window.ethereum', corrige_le: '2026-09-29T16:37:12Z', note: 'Portefeuille de cryptomonnaie injecté par le navigateur : ignoré par le journal' },
  { motif: '[Erreur JavaScript] Script error.', corrige_le: '2026-09-29T16:37:12Z', note: 'Message vide du navigateur pour du code venant d’un autre site : ignoré par le journal' },
  { motif: 'Google-Read-Aloud', corrige_le: '2100-01-01T00:00:00Z', note: 'Lecture à voix haute de Google (robot) : toujours ignorée' },
  { motif: 'vercel.live', corrige_le: '2100-01-01T00:00:00Z', note: 'Barre d’outils de Vercel sur ses copies de test : pas une page vue par les visiteurs' },
  { motif: '.vercel.app/', corrige_le: '2100-01-01T00:00:00Z', note: 'Copie de test de Vercel (adresse …vercel.app) : pas une page vue par les visiteurs' },
  { motif: 'section#fiche-book', corrige_le: '2026-09-29T21:38:20Z', note: 'Fiche mannequin : place de la fiche réservée pendant le chargement, le Book et le bas de page ne sautent plus' }
];
