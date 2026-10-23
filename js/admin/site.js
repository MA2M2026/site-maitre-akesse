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
    [null, 'Castings'],
    ['b2-candidatures', 'Candidatures casting'], ['b2-projets', 'Projets et castings'],
    ['b2-messages-groupes', 'Messages groupés'], ['b2-places', 'Places limitées'], ['b2-selection', 'Annoncer la sélection'], ['b2-convocations', 'Convocations'],
    [null, 'Mannequins'],
    ['b2-mannequins-publies', 'Mannequins'], ['b2-validations', 'Validations en attente'], ['b3c-vedette-admin', 'Mannequin à la une'],
    ['b2-tri-photos', 'Photos mises de côté'], ['b2-rapport-profils', 'Rapport des profils'], ['b2-fiches-evenement', 'Fiches événement'],
    [null, 'Relations'],
    ['b2-recruteurs', 'Demandes recruteurs'], ['b2-contacts', 'Messages de contact'],
    [null, 'Contenu du site'],
    ['actualites', 'Actualités'], ['evenements', 'Événements'], ['partenaires', 'Partenaires'],
    ['b3c-mot-fondateur', 'Mot du fondateur'], ['b3c-agenda', 'Agenda du site'], ['b3d-video-accueil', 'Vidéo de la page d’accueil'], ['b3c-instagram', 'Flux Instagram'],
    [null, 'Accès et outils'],
    ['b3b-codes-inscription', 'Codes d’accès'], ['b3b-acces-bloques', 'Accès bloqués'], ['b3a-drive', 'Drive et transferts'],
    ['b3a-nettoyage', 'Nettoyage des photos'], ['b3a-erreurs', 'Erreurs du site']
  ];
  // Chaque rubrique est remplie par sa pièce js/admin/site-*.js (toutes reconstruites le 22/10/2026).
  // La page de secours ci-dessous doit exister dès le départ : le portail vérifie la rubrique
  // demandée AVANT de charger les pièces ; elle ne s'affiche que si une pièce n'a pas pu arriver.
  const pages = {};
  MENU.forEach((m) => {
    if (m[0]) pages[m[0]] = async () => P.entete(m[1]) + '<div class="carte vide">Cette rubrique n’a pas pu être chargée. Vérifiez la connexion puis rechargez la page.</div>';
  });
  // Pièces réservées (middleware.js) : la clé d'accès est posée par le serveur après la double
  // authentification (api/acces-tableau.js), puis les pièces sont chargées une seule fois, dans
  // l'ordre. Sans clé (compte sans droit), elles restent introuvables : la page le dit.
  const PIECES = ['/js/messages-convocations.js', '/js/messages-candidats.js', '/js/agenda-outils.js',
    '/js/convocations-gabarit.js', '/js/convocations-page.js', '/js/convocations-admin.js',
    '/js/messages-groupes-gabarit.js', '/js/messages-groupes.js',
    '/js/admin/site-dossiers.js', '/js/admin/site-convocations.js', '/js/admin/site-places.js', '/js/admin/site-messages-groupes.js', '/js/admin/site-projets.js', '/js/admin/site-mannequins.js',
    '/js/photos-mises-de-cote-gabarit.js', '/js/photos-mises-de-cote.js', '/js/rapport-profils-gabarit.js', '/js/rapport-profils-admin.js',
    '/js/fiches-evenement-gabarit.js', '/js/fiches-evenement-admin.js', '/js/admin/site-outils-mannequins.js', '/js/admin/site-pilotage.js',
    '/js/publications.js', '/js/partenaires-communs.js', '/js/admin/site-contenu.js', '/js/admin/site-vitrine.js',
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
    if (session) await fetch('/api/acces-tableau', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token }, credentials: 'same-origin' }).catch(() => { /* hors ligne : les pièces déjà en mémoire suffisent */ });
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
