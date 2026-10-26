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
// Facultatif : navigateur: 'texte' — la règle ne vaut que pour les navigateurs dont l'identité
// contient ce texte (ex. 'Brave') ; une même erreur venue d'un autre navigateur reste visible.
window.MA2M_ERREURS_CORRIGEES = [
  // journal du 24/10/2026 (copié par la propriétaire)
  { motif: 'user-script:1', corrige_le: '2100-01-01T00:00:00Z', note: 'Programme ajouté par Chrome sur iPhone (remplissage automatique des formulaires) : pas un défaut du site, toujours ignoré' },
  { motif: 'kaspersky-labs.com', corrige_le: '2100-01-01T00:00:00Z', note: 'Antivirus Kaspersky du visiteur, qui ajoute ses propres programmes aux pages : pas un défaut du site, toujours ignoré' },
  { motif: '/confirmer : a.introuvable-logo', corrige_le: '2026-10-22T20:18:00Z', note: 'Logo de « Confirmer ma présence » : ne dépasse plus de l’écran (corrigé le 22/10, vérifié de 240 à 412 px)' },
  { motif: 'header.site-header-v2', corrige_le: '2026-10-24T23:30:00Z', note: 'Fausse alerte : la page était décalée sur le côté par un geste (rebond de l’iPhone) ; le détecteur ne mesure plus pendant un tel décalage' },
  { motif: '/tableau-de-bord : ', corrige_le: '2026-10-24T23:30:00Z', note: 'Ancien tableau de bord démoli (22-23/10) : l’Agenda et les Convocations vivent dans la nouvelle Administration, lignes en colonne sur téléphone' },
  { motif: 'div.lignes « Les nouveaux visages', corrige_le: '2026-10-24T23:30:00Z', note: 'Accueil : liste des mannequins, mot de Maître Akesse et casting écrits par le serveur dans la page : plus rien n’arrive après coup' },
  { motif: 'inscriptions_mannequins.genre does not exist', corrige_le: '2026-09-29T15:02:31Z', note: 'Colonne « genre » ajoutée dans Supabase (Extension 48 lancée par la propriétaire), formulaire d’inscription réparé' },
  { motif: "la page s'affiche dézoomée", corrige_le: '2026-09-29T15:41:02Z', note: 'Faux signalement : page ouverte dans une fenêtre invisible (écran 0×0, aperçu de lien ou préchargement), ces fenêtres sont désormais ignorées' },
  { motif: 'footer.site-footer', corrige_le: '2026-09-29T15:52:23Z', note: 'Actualités / Événements : place du bloc « À la une » réservée pendant le chargement, le bas de page ne saute plus' },
  { motif: 'meta-externalagent', corrige_le: '2100-01-01T00:00:00Z', note: 'Robot de Facebook (aperçus de liens) : toujours ignoré (il garde parfois une ancienne version du site en mémoire)' },
  { motif: 'section#mot-responsable', corrige_le: '2026-09-29T16:26:11Z', note: 'Accueil : place réservée pour « Mot de Maître Akesse » pendant le chargement' },
  { motif: '« 02 · La vision', corrige_le: '2026-09-29T16:26:11Z', note: 'Accueil : place réservée pour « Mannequin à la une » pendant le chargement' },
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
  { motif: 'Notification e-mail non envoyée : {"status":0', corrige_le: '2026-09-30T13:15:00Z', note: 'Coupure de connexion pendant l’essai de 11 h 57 (la vidéo n’était pas partie non plus), les vidéos partent maintenant en morceaux avec reprise. S’il revient, il réapparaîtra ici' },
  { motif: 'div.mg-actions', corrige_le: '2026-09-30T13:15:00Z', note: 'Messages groupés : page revue le 30/09 (consigne quand le message est vide, compteur). S’il revient, il réapparaîtra ici' },
  { motif: '[Zoom automatique] /espace-mannequin', corrige_le: '2026-09-30T16:12:00Z', note: 'Espace mannequin : tous les champs à 16 px sur téléphone, l’iPhone ne zoome plus tout seul' },
  { motif: "[Page plus large que l'écran] /espace-mannequin", corrige_le: '2026-09-30T16:12:00Z', note: 'Espace mannequin : conséquence du zoom automatique de l’iPhone (corrigé) ; champs limités à leur colonne' },
  { motif: 'div.ref-core-grid', corrige_le: '2026-09-30T16:25:00Z', note: 'Tableau de bord, Statistiques : place réservée aux graphiques pendant le chargement, plus de faux pourcentages' },
  { motif: 'invalid_credentials', corrige_le: '2100-01-01T00:00:00Z', note: 'Mauvais e-mail ou mot de passe tapé par une personne : pas un défaut du site (toujours ignoré)' },
  { motif: '[Page figée] /tableau-de-bord', corrige_le: '2026-09-30T17:10:00Z', note: 'Fausse alerte : temps passé dans la fenêtre « Envoyer ce message ? » ou dans WhatsApp, désormais écarté par le journal' },
  { motif: 'auth-tab-connexion', corrige_le: '2026-09-30T17:10:00Z', note: 'Onglet « Se connecter » touché plusieurs fois alors qu’il était déjà ouvert (juste après un mauvais mot de passe) : pas un défaut' },
  { motif: '[Zoom inattendu]', corrige_le: '2026-09-30T18:45:00Z', note: 'Zoom fait par la personne (pincement sur l’écran ou le pavé tactile, Ctrl + molette) ou rétabli par le téléphone au retour du choix d’une vidéo : ces gestes sont maintenant reconnus, et un seul signalement par page. S’il revient, il réapparaîtra ici' },
  { motif: 'missing email or phone', corrige_le: '2026-09-30T18:45:00Z', note: 'Espace mannequin : « Se connecter » touché avec l’e-mail vide, le site le dit maintenant tout de suite, sans interroger le serveur' },
  { motif: '/tableau-de-bord : div#liste-erreurs', corrige_le: '2026-09-30T18:45:00Z', note: 'Tableau de bord : liste d’erreurs vidée juste après un clic de la propriétaire, une page qui change en réponse à un clic n’est plus comptée comme un « saut »' },
  { motif: '[Zoom automatique] /mannequins', corrige_le: '2026-10-12T12:17:00Z', note: 'The Book : champs de recherche à 16 px sur téléphone (règle commune à tout le site), l’iPhone ne zoome plus tout seul' },
  { motif: '[Zoom automatique] /en/mannequins', corrige_le: '2026-10-12T12:17:00Z', note: 'The Book (anglais) : même correction' },
  { motif: 'input#f-sans-instagram', corrige_le: '2026-10-12T12:17:00Z', note: 'Case à cocher « Je n’ai pas Instagram » : une case ne fait pas zoomer l’iPhone ; fausse alerte (ordinateur zoomé), le détecteur ignore désormais les cases' },
  { motif: 'button.filtre-btn.filtre-niveau-btn', corrige_le: '2026-10-12T12:17:00Z', note: 'The Book : boutons de niveau qui passent à la ligne sur petit écran (vérifié à 320 px)' },
  { motif: '/book/bolli : table', corrige_le: '2026-10-12T12:17:00Z', note: 'Tableau des équivalences de tailles : il défile dans son cadre, la page ne dépasse plus (vérifié à 360 et 411 px)' },
  { motif: ': img dépasse de 25 px', corrige_le: '2026-10-12T12:17:00Z', note: 'Photo de couverture de la fiche légèrement agrandie (effet voulu), coupée par son cadre : fausse alerte corrigée dans le détecteur' },
  { motif: 'section#couverture-faisceau', corrige_le: '2026-10-12T12:17:00Z', note: 'Espace mannequin : non reproduit (vérifié à 390 px)' },
  { motif: 'input#f-tel-numero', corrige_le: '2026-10-12T12:17:00Z', note: 'Espace mannequin : pays et numéro côte à côte ou l’un sous l’autre (correction du 07/10, vérifiée à 390 px)' },
  { motif: 'connect.facebook.net', corrige_le: '2026-10-12T12:17:00Z', note: 'Code ajouté par le navigateur intégré d’Instagram / Facebook : ignoré par le journal' },
  { motif: 'www.google.com/g/collect', corrige_le: '2026-10-12T12:17:00Z', note: 'Statistiques Google : adresse de secours de Google, sans effet pour les visiteurs ; ignorée par le journal' },
  { motif: 'gstatic.com/_/translate', corrige_le: '2026-10-12T12:17:00Z', note: 'Traduction automatique de Google Chrome : ignorée par le journal' },
  { motif: 'DarkReader', corrige_le: '2100-01-01T00:00:00Z', note: 'Extension « Dark Reader » du visiteur : pas un défaut du site (toujours ignorée)' },
  { motif: 'style-src-attr → script/style en ligne', navigateur: 'Brave', corrige_le: '2026-10-12T12:17:00Z', note: 'Styles ajoutés par le navigateur Brave (iPhone) : aucun style de ce type dans le code du site ; ignorés par le journal' },
  { motif: 'style-src-elem → script/style en ligne', navigateur: 'PHX/', corrige_le: '2026-10-12T12:17:00Z', note: 'Styles ajoutés par le navigateur PHX (téléphones TECNO / Infinix) : ignorés par le journal' },
  { motif: '[Erreur JavaScript] Erreur inconnue', navigateur: 'PHX/', corrige_le: '2026-10-12T12:17:00Z', note: '« Erreur inconnue » sans aucun détail, venant du navigateur PHX (TECNO / Infinix) : ignorée par le journal' },
  { motif: 'refresh_token_not_found', corrige_le: '2100-01-01T00:00:00Z', note: 'Session expirée (connexion trop ancienne) : la personne se reconnecte, pas un défaut du site (toujours ignoré)' },
  { motif: '/api/trier-photo', corrige_le: '2100-01-01T00:00:00Z', note: 'Tri des photos par IA retiré du site le 07/10 : anciens signalements' },
  { motif: '/api/code-protege → 502', corrige_le: '2026-10-11T16:52:02Z', note: '« Créer mon compte » réparé le 11/10 (Extensions 133-134)' },
  { motif: '[Erreur JavaScript] The I/O read operation failed', corrige_le: '2026-10-12T12:17:00Z', note: 'Vidéo illisible sur le téléphone pendant son allègement : déjà rattrapée par le formulaire (signalée « Vidéo non allégée »), plus comptée en double' },
  { motif: '/en/mannequins:479', corrige_le: '2026-10-07T23:59:00Z', note: 'Code ajouté par la traduction automatique (ligne qui n’existe pas dans la page) : ignoré par le journal depuis le 07/10' },
];
