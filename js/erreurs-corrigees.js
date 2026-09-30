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
  { motif: 'section#fiche-book', corrige_le: '2026-09-29T21:38:20Z', note: 'Fiche mannequin : place de la fiche réservée pendant le chargement, le Book et le bas de page ne sautent plus' },
  { motif: 'Googlebot', corrige_le: '2100-01-01T00:00:00Z', note: 'Robot de Google : toujours ignoré (il garde parfois une ancienne version du site en mémoire, d’où des appels déjà retirés comme ipify)' },
  { motif: '/partenaires : footer.site-footer', corrige_le: '2026-09-30T03:22:02Z', note: 'Partenaires : place de la liste réservée pendant le chargement, le bas de page ne saute plus' },
  { motif: 'style-src-attr → inline', corrige_le: '2026-09-30T03:22:02Z', note: 'Un seul cas (Brave sur iPhone), non reproduit : aucun style de ce type dans le code du site. S’il revient, il réapparaîtra ici' },
  { motif: 'nettoyage-supabase-btn', corrige_le: '2026-09-30T03:22:02Z', note: 'Pause de 3 s pendant le nettoyage ponctuel des photos Supabase : normal, l’outil vérifie toutes les fiches d’un coup' },
  { motif: 'selection : footer.site-footer', corrige_le: '2026-09-30T04:51:00Z', note: 'Ma sélection : la page sait dès le départ si la sélection est vide, le bas de page ne saute plus' },
  { motif: 'mannequins : footer.site-footer', corrige_le: '2026-09-30T04:51:00Z', note: 'The Book : les cartes ont leur taille définitive avant l’arrivée des photos, le bas de page ne saute plus' },
  { motif: 'media-src → blob', corrige_le: '2026-09-30T13:15:00Z', note: 'Candidature : la durée de la vidéo est lue dans le fichier, plus par un lecteur vidéo bloqué par la sécurité du site' },
  { motif: 'Notification e-mail non envoyée : {"status":0', corrige_le: '2026-09-30T13:15:00Z', note: 'Coupure de connexion pendant l’essai de 11 h 57 (la vidéo n’était pas partie non plus) — les vidéos partent maintenant en morceaux avec reprise. S’il revient, il réapparaîtra ici' },
  { motif: 'div.mg-actions', corrige_le: '2026-09-30T13:15:00Z', note: 'Messages groupés : page revue le 30/09 (consigne quand le message est vide, compteur). S’il revient, il réapparaîtra ici' },
  { motif: '[Zoom automatique] /espace-mannequin', corrige_le: '2026-09-30T16:12:00Z', note: 'Espace mannequin : tous les champs à 16 px sur téléphone, l’iPhone ne zoome plus tout seul' },
  { motif: "[Page plus large que l'écran] /espace-mannequin", corrige_le: '2026-09-30T16:12:00Z', note: 'Espace mannequin : conséquence du zoom automatique de l’iPhone (corrigé) ; champs limités à leur colonne' },
  { motif: 'div.ref-core-grid', corrige_le: '2026-09-30T16:25:00Z', note: 'Tableau de bord, Statistiques : place réservée aux graphiques pendant le chargement, plus de faux pourcentages' },
  { motif: '[Zoom inattendu]', corrige_le: '2026-09-30T16:55:00Z', note: 'Zoom fait avec les doigts sur la tablette (appareil qui se présente comme un ordinateur) : pas un défaut du site. S’il revient sans geste, il réapparaîtra ici' }
];
