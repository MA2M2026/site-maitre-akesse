// Nouvelle Administration — bloc 1 « Administration du site », reconstruit à neuf, rubrique par
// rubrique (PLAN-NOUVELLE-ADMINISTRATION.md). Plus de cadre vers l'ancien tableau de bord :
// chaque rubrique est une page du portail, dans un fichier js/admin/site-*.js qui l'ajoute à
// P.espaces.site.pages.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P) return;
  // [clé, libellé] ; une entrée sans clé est un titre de groupe
  const MENU = [
    [null, 'Pilotage'],
    ['v2-ensemble', 'Vue d’ensemble'], ['b1-a-traiter', 'À traiter'], ['v2-top3', 'Top 3 et classement'],
    ['b1-repartition', 'Répartition des profils'], ['b1-evolution', 'Évolution des candidatures'],
    // (24/10/2026, demande de la propriétaire : un compartiment par sujet — tout ce qui sert à un
    // projet, de l'agenda aux convocations, est au même endroit)
    [null, 'Castings et demandes'],
    ['b2-candidatures', 'Candidatures casting'], ['b2-projets', 'Projets et castings'], ['b2-recruteurs', 'Demandes recruteurs'], ['b2-contacts', 'Messages de contact'], ['b2-cours-talons', 'Cours de talons'],
    [null, 'Projets et convocations'],
    ['b3c-agenda', 'Agenda des projets'], ['b2-selection', 'Annoncer la sélection'], ['b2-convocations', 'Convocations'], ['b2-rappel', 'Rappeler l’information'],
    ['b2-places', 'Places limitées'], ['b2-defiles', 'Programmation défilé'], ['b2-cartes', 'Cartes d’événement'], ['b2-infos', 'Informations agence'], ['b2-messages-groupes', 'Messages groupés'], ['b2-fiches-evenement', 'Fiches événement'],
    [null, 'Mannequins'],
    ['b2-mannequins-publies', 'Mannequins'], ['b2-presences', 'Liste de présence'], ['b2-bulletins', 'Bulletins trimestriels'], ['b2-documents', 'Documents des mannequins'], ['b2-exterieures', 'Mannequins extérieures'], ['b2-validations', 'Validations en attente'], ['b3c-vedette-admin', 'Mannequin à la une'],
    ['b2-tri-photos', 'Photos mises de côté'], ['b2-rapport-profils', 'Rapport des profils'],
    [null, 'Contenu du site'],
    ['actualites', 'Actualités'], ['evenements', 'Événements'], ['partenaires', 'Partenaires'],
    ['b3c-mot-fondateur', 'Mot du fondateur'], ['b3d-video-accueil', 'Vidéo de la page d’accueil'], ['b3c-instagram', 'Flux Instagram'],
    ['b3c-textes-pages', 'Textes des pages'], ['b3c-traductions', 'Traductions anglaises'],
    [null, 'Accès et outils'],
    ['b3b-codes-inscription', 'Codes d’accès'], ['b3b-acces-bloques', 'Accès bloqués'], ['b3a-drive', 'Drive et transferts'],
    ['b3a-nettoyage', 'Nettoyage des photos'], ['b3a-erreurs', 'Erreurs du site']
  ];
  // Les TUILES (11/11/2026, maquette validée par la propriétaire : « trop touffu, trop surchargé ») : l'accueil
  // montre 8 grandes tuiles au lieu des rubriques ; chaque tuile garde ses rubriques utiles (pages) et range
  // les outils rares dans « Plus d'outils » (plus). Chaque rubrique du MENU est dans UNE tuile (vérifié par
  // test-nouvelle-admin.js) ; les adresses des rubriques ne changent pas (#/site/<rubrique>).
  const TUILES = [
    { cle: 'castings', ic: '✨', titre: 'Castings', sous: 'Candidatures, projets, recruteurs',
      pages: ['b2-candidatures', 'b2-projets', 'b2-recruteurs', 'b2-cours-talons'],
      plus: ['b1-a-traiter', 'v2-ensemble', 'v2-top3', 'b1-repartition', 'b1-evolution'] },
    { cle: 'mannequins', ic: '💃', titre: 'Mannequins', sous: 'Fiches, présences, bulletins', visages: true,
      pages: ['b2-mannequins-publies', 'b2-validations', 'b2-presences', 'b2-bulletins', 'b2-documents'],
      plus: ['b2-exterieures', 'b3c-vedette-admin', 'b2-tri-photos', 'b2-rapport-profils'] },
    { cle: 'evenements', ic: '👠', titre: 'Événements', sous: 'Convocations, défilés, cartes',
      pages: ['b3c-agenda', 'b2-convocations', 'b2-defiles', 'b2-cartes'],
      plus: ['b2-selection', 'b2-rappel', 'b2-places', 'b2-fiches-evenement'] },
    { cle: 'messages', ic: '💌', titre: 'Messages', sous: 'Convoquer, annoncer, informer', envoi: true,
      pages: ['b2-messages-groupes', 'b2-infos', 'b2-contacts'], plus: [] },
    { cle: 'site', ic: '🌐', titre: 'Le site', sous: 'Actualités, textes, vidéo', discret: true,
      pages: ['actualites', 'evenements', 'b3c-textes-pages', 'b3d-video-accueil'],
      plus: ['partenaires', 'b3c-mot-fondateur', 'b3c-instagram', 'b3c-traductions'] },
    { cle: 'reglages', ic: '⚙️', titre: 'Réglages', sous: 'Accès, outils, erreurs', discret: true,
      pages: ['b3b-codes-inscription', 'b3b-acces-bloques', 'b3a-erreurs'],
      plus: ['b3a-drive', 'b3a-nettoyage'] }
  ];
  // [icône, explication courte] de chaque rubrique, affichées dans sa tuile
  const INFOS = {
    'b2-candidatures': ['📥', 'Les nouvelles candidatures à étudier'], 'b2-projets': ['🎬', 'Castings ouverts et projets du site'],
    'b2-recruteurs': ['🤝', 'Marques et organisateurs qui cherchent des mannequins'], 'b2-cours-talons': ['👠', 'Inscriptions au cours de talons'],
    'b1-a-traiter': ['📌', 'Tout ce qui attend une action'], 'v2-ensemble': ['📊', 'Les chiffres du site'], 'v2-top3': ['🏆', 'Profils les plus vus'],
    'b1-repartition': ['🧭', 'Profils par catégorie et par ville'], 'b1-evolution': ['📈', 'Candidatures mois par mois'],
    'b2-mannequins-publies': ['💃', 'Chercher, ouvrir une fiche'], 'b2-validations': ['✅', 'Profils envoyés par les mannequins'],
    'b2-presences': ['📋', 'Cocher les présentes du dimanche'], 'b2-bulletins': ['📝', 'Notes et appréciations'], 'b2-documents': ['📄', 'Contrats, pièces d’identité'],
    'b2-exterieures': ['🌍', 'Mannequins hors agence'], 'b3c-vedette-admin': ['⭐', 'La mannequin mise en avant sur le site'],
    'b2-tri-photos': ['🗂️', 'Photos écartées du Book'], 'b2-rapport-profils': ['🧾', 'Profils incomplets'],
    'b3c-agenda': ['🗓️', 'Tous les projets à venir'], 'b2-convocations': ['📨', 'Convoquer et suivre les réponses'],
    'b2-defiles': ['💃', 'Passages et salles des défilés'], 'b2-cartes': ['🎫', 'Cartes d’accès à imprimer'],
    'b2-selection': ['🎉', 'Annoncer les mannequins retenues'], 'b2-rappel': ['⏰', 'Rappeler l’information avant le jour J'],
    'b2-places': ['🎟️', 'Événements à places limitées'], 'b2-fiches-evenement': ['🗒️', 'Fiches pratiques des événements'],
    'b2-messages-groupes': ['💌', 'WhatsApp, e-mail et application, à plusieurs'], 'b2-infos': ['📢', 'Une information de l’agence à toutes'],
    'b2-contacts': ['✉️', 'Messages reçus depuis le site'],
    'actualites': ['📰', 'Les actualités du site'], 'evenements': ['🎆', 'Les événements affichés sur le site'],
    'b3c-textes-pages': ['✍️', 'Modifier les textes des pages'], 'b3d-video-accueil': ['🎞️', 'La vidéo de la page d’accueil'],
    'partenaires': ['🤝', 'Logos des partenaires'], 'b3c-mot-fondateur': ['🖋️', 'Le mot du fondateur'], 'b3c-instagram': ['📸', 'Le flux Instagram du site'],
    'b3c-traductions': ['🇬🇧', 'Les textes en anglais'],
    'b3b-codes-inscription': ['🔑', 'Codes pour créer un compte'], 'b3b-acces-bloques': ['🚫', 'Comptes bloqués à débloquer'],
    'b3a-erreurs': ['🩺', 'Le journal des erreurs du site'], 'b3a-drive': ['☁️', 'Drive et transferts de photos'], 'b3a-nettoyage': ['🧹', 'Nettoyage des photos inutiles']
  };
  const libelle = (cle) => (MENU.find((m) => m[0] === cle) || [])[1] || cle;
  const tuileDe = (page) => TUILES.find((t) => 'tuile-' + t.cle === page || t.pages.includes(page) || t.plus.includes(page)) || null;
  P.TUILES_SITE = TUILES;
  P.tuileDe = tuileDe;
  P.libelleRubrique = libelle;
  // menu de gauche d'une rubrique : seulement les rubriques de SA tuile (js/admin/coque.js)
  P.menuTuile = (t) => [[null, t.ic + ' ' + t.titre], ['tuile-' + t.cle, 'Toute la tuile']].concat(t.pages.map((k) => [k, libelle(k)]))
    .concat(t.plus.length ? [[null, 'Plus d’outils']].concat(t.plus.map((k) => [k, libelle(k)])) : []);
  // (11/11/2026, demande de la propriétaire : « l'envoi des messages est trop procédurier ») la tuile Messages
  // commence par UNE question, « Que voulez-vous envoyer ? » : chaque réponse ouvre directement le bon écran,
  // avec le bon message déjà choisi (convocation, sélection, rappel, information, candidats).
  const ENVOIS = [
    ['b2-convocations', '📨', 'Convoquer à un événement', 'Date, heure, lieu, programme et lien « Je confirme »'],
    ['b2-selection', '🎉', 'Annoncer une sélection', 'Félicitations aux mannequins retenues pour un projet'],
    ['b2-rappel', '🔔', 'Rappeler un événement', 'La date, l’heure et le lieu, à celles déjà prévenues'],
    ['b2-infos', '📢', 'Donner une information', 'Casting, défilé, remerciement… à toutes ou à quelques-unes'],
    ['b2-messages-groupes', '✨', 'Écrire à des candidates', 'Candidatures du site, retenues, inscriptions']
  ];
  const blocEnvoi = () => '<h2 class="tu-question">Que voulez-vous envoyer ?</h2><div class="tu-envois">' + ENVOIS.map((e) =>
    '<a class="tu-envoi" href="#/site/' + e[0] + '"><em aria-hidden="true">' + e[1] + '</em><span><b>' + P.esc(e[2]) + '</b><small>' + P.esc(e[3]) + '</small></span><i aria-hidden="true">›</i></a>').join('') + '</div>' +
    '<p class="tu-astuce">Chaque message part par WhatsApp, e-mail et dans l’application des mannequins.</p>';
  // la page d'une tuile : (visages,) rubriques utiles, puis « Plus d'outils » repliés
  async function pageTuile(t) {
    if (P.rafraichirCompteursSite) await P.essai(P.rafraichirCompteursSite());
    const compte = (P.espaces.site && P.espaces.site.compteur) || {};
    const ligne = (k) => '<a class="tu-ligne" href="#/site/' + k + '"><em aria-hidden="true">' + ((INFOS[k] || [])[0] || '•') + '</em><span>' + P.esc(libelle(k)) +
      '<small>' + P.esc((INFOS[k] || [])[1] || '') + '</small></span>' + (compte[k] ? '<b>' + compte[k] + '</b>' : '<i aria-hidden="true">›</i>') + '</a>';
    let visages = '';
    if (t.visages) {
      const l = await P.essai(P.bd(sb.from('model_profiles').select('id, full_name').eq('published', true).order('created_at', { ascending: false }).limit(12))) || [];
      const photos = await P.essai(P.photosCouverture(l.map((m) => m.id))) || {};
      visages = l.filter((m) => photos[m.id]).slice(0, 8).map((m) => '<a class="tu-visage" href="#/site/b2-mannequins-publies/' + P.esc(encodeURIComponent(m.id)) + '">' +
        P.visage(photos[m.id], m.full_name) + '<span>' + P.esc(String(m.full_name).split(' ').slice(-1)[0]) + '</span></a>').join('');
    }
    return '<div class="tu-page"><div class="tu-tete"><a class="tu-retour" href="#/" aria-label="Retour à l’accueil">‹</a><h1>' + P.esc(t.titre) + '</h1></div>' +
      (visages ? '<div class="tu-visages">' + visages + '</div>' : '') +
      (t.envoi ? blocEnvoi() + '<h2 class="tu-question">Aussi dans Messages</h2>' : '') +
      '<div class="tu-liste">' + t.pages.map(ligne).join('') + '</div>' +
      (t.plus.length ? '<details class="tu-plus"><summary>Plus d’outils (' + t.plus.length + ')</summary><div class="tu-liste">' + t.plus.map(ligne).join('') + '</div></details>' : '') + '</div>';
  }
  // Chaque rubrique est remplie par sa pièce js/admin/site-*.js (toutes reconstruites le 22/10/2026).
  // La page de secours ci-dessous doit exister dès le départ : le portail vérifie la rubrique
  // demandée AVANT de charger les pièces ; elle ne s'affiche que si une pièce n'a pas pu arriver.
  const pages = {};
  TUILES.forEach((t) => { pages['tuile-' + t.cle] = () => pageTuile(t); });
  MENU.forEach((m) => {
    if (m[0]) pages[m[0]] = async () => P.entete(m[1]) + '<div class="carte vide">Cette rubrique n’a pas pu être chargée. Vérifiez la connexion puis rechargez la page.</div>';
  });
  // Pièces réservées (middleware.js) : la clé d'accès est posée par le serveur après la double
  // authentification (api/acces-tableau.js), puis les pièces sont chargées une seule fois, dans
  // l'ordre. Sans clé (compte sans droit), elles restent introuvables : la page le dit.
  const PIECES = ['/js/images-site-ecriture.js', '/js/messages-convocations.js', '/js/messages-candidats.js', '/js/agenda-outils.js',
    '/js/image-jointe.js', '/js/convocations-gabarit.js', '/js/convocations-page.js', '/js/convocations-admin.js',
    '/js/messages-groupes-gabarit.js', '/js/messages-groupes.js',
    '/js/admin/photos-choisies.js', '/js/presences-calcul.js', '/js/admin/site-presences.js', '/js/admin/site-bulletins.js', '/js/documents-communs.js', '/js/admin/site-documents.js', '/js/admin/site-dossiers.js', '/js/admin/site-convocations.js', '/js/admin/site-places.js', '/js/defile-repartition.js', '/js/admin/site-defiles.js', '/js/cartes-acces.js', '/js/admin/site-exterieures.js', '/js/admin/site-cours-talons.js', '/js/admin/site-messages-groupes.js', '/js/admin/site-infos.js', '/js/admin/site-projets.js', '/js/admin/site-mannequins.js',
    '/js/photos-mises-de-cote-gabarit.js', '/js/photos-mises-de-cote.js', '/js/rapport-profils-gabarit.js', '/js/rapport-profils-admin.js',
    '/js/fiches-evenement-gabarit.js', '/js/fiches-evenement-admin.js', '/js/admin/site-outils-mannequins.js', '/js/admin/site-pilotage.js',
    '/js/rendu-publications.js', '/js/publications-lecture.js', '/js/publications-ecriture.js', '/js/partenaires-communs.js', '/js/admin/brouillons.js', '/js/admin/site-contenu.js', '/js/admin/site-vitrine.js', '/js/admin/site-traductions.js', '/js/admin/site-textes.js',
    '/js/agenda-gabarit.js', '/js/agenda-admin.js', '/js/admin/site-agenda.js',
    '/js/video-accueil-gabarit.js', '/js/couverture-admin.js', '/js/admin/site-video.js',
    '/js/note-integration.js', '/js/nettoyage-supabase.js', '/js/admin/site-acces.js',
    '/js/erreurs-corrigees.js', '/js/erreurs-gabarit.js', '/js/erreurs-site.js', '/js/admin/site-erreurs.js'];
  const charges = new Set();  // une pièce déjà chargée ne l'est jamais deux fois
  const charger = (src) => charges.has(src) ? Promise.resolve() : new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = src; s.async = false;
    s.onload = () => { charges.add(src); ok(); };
    s.onerror = () => { s.remove(); ko(new Error('Accès refusé à cette partie de l’Administration (reconnectez-vous).')); };
    document.body.appendChild(s);
  });
  P.chargerScript = charger;  // aussi pour les outils lourds chargés à la demande (éditeur de texte…)
  let pret = null;
  async function preparer() {
    const session = (await sb.auth.getSession()).data.session;
    if (session) await fetch('/api/acces-tableau', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token, 'x-appareil': identifiantAppareilPortail() }, credentials: 'same-origin' }).catch(() => { /* hors ligne : les pièces déjà en mémoire suffisent */ });
    // toutes les pièces TÉLÉCHARGÉES en même temps (« preload », 23/10/2026 : une par une, un
    // rafraîchissement prenait ~7 s avec une connexion d'Abidjan), puis exécutées une par une dans
    // l'ordre, comme avant : la première qui manque arrête tout (jamais une pièce sans celles dont
    // elle dépend, jamais une pièce exécutée deux fois)
    PIECES.forEach((src) => {
      if (charges.has(src) || document.querySelector('link[rel="preload"][href="' + src + '"]')) return;
      const l = document.createElement('link');
      l.rel = 'preload'; l.as = 'script'; l.href = src;
      document.head.appendChild(l);
    });
    for (const src of PIECES) await charger(src);
  }
  // pastilles « à traiter » du menu : rafraîchies sans faire attendre la page, au plus une fois par minute
  let pastillesLe = 0;
  function pastilles() {
    if (!P.rafraichirCompteursSite || Date.now() - pastillesLe < 60000) return;
    pastillesLe = Date.now();
    P.rafraichirCompteursSite().catch(() => { pastillesLe = 0; });
  }
  P.espaces.site = { nav: MENU, pages, apres: {}, avant: () => (pret || (pret = preparer().catch((e) => { pret = null; throw e; }))).then(pastilles) };
})();
