// ================== Surveillance des erreurs et dysfonctionnements ==================
// Chargé tout en haut de CHAQUE page (juste après Sentry), avant tout le reste, pour
// ne rien laisser passer — y compris ce qui se produit avant que la page ait fini de
// charger, ou quand une bibliothèque externe (Supabase…) n'arrive jamais.
//
// Pourquoi ce fichier (28 septembre 2026) : l'ancienne surveillance (dans js/app.js)
// et Sentry ne voyaient que les erreurs qui « plantent » le code. Or les bugs du jour
// étaient silencieux : QR code du CV bloqué par le CSP sans message, photos qui ne
// s'affichent pas depuis Facebook, génération de fichier qui échoue proprement… La
// propriétaire veut que le site détecte TOUT dysfonctionnement, pas seulement les
// plantages. On capte donc aussi :
//   - les images / scripts / feuilles de style qui n'arrivent pas à charger ;
//   - tout ce que le CSP (règles de sécurité) bloque ;
//   - les appels réseau qui échouent (Supabase, /api, R2…), même si le code gère
//     l'erreur sans rien afficher ;
//   - les console.error (le code du site en écrit dans ses « catch ») ;
//   - les pages très lentes à charger (avec les fichiers les plus lourds) ;
//   - une bibliothèque indispensable (Supabase) qui ne s'est jamais chargée ;
//   - une page plus large que l'écran (ce qui permettait de dézoomer et de balayer
//     l'accueil sur le côté, 28 septembre 2026), avec l'élément responsable ;
//   - (29 septembre 2026, demande de la propriétaire : « détecter tout, et dire
//     précisément où ») : zoom automatique ou inattendu de l'écran, affichage qui
//     saute, page figée, page restée vide, clics répétés sur un bouton qui ne
//     réagit pas. Chaque signalement indique aussi l'appareil, la taille d'écran,
//     le zoom, une éventuelle coupure de connexion et le dernier élément cliqué.
// Chaque signalement part dans la table journal_erreurs (section « 🔴 Erreurs
// réelles du site » du tableau de bord) ET dans Sentry.
//
// Envoi direct par fetch vers l'API REST de Supabase (clé publique anon, la même que
// js/supabase-config.js) plutôt que via supabase-js : ainsi une erreur est signalée
// même quand supabase-js n'a pas pu se charger — c'est justement un des cas à voir.
//
// Utilisable partout ailleurs : window.signalerErreur('Catégorie', 'message', détail).
(function () {
  if (window.signalerErreur) return;

  const URL_JOURNAL = 'https://dfhghgmwmxiguhtxtsle.supabase.co/rest/v1/journal_erreurs';
  const CLE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmaGdoZ213bXhpZ3VodHh0c2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NzI1ODQsImV4cCI6MjEwNDI0ODU4NH0.S-JftGJNtPMLZdK6Jy9AUwwOl56JzyllkEJ0GN0eZ-M';
  const MAX_PAR_PAGE = 25; // garde-fou : une page qui boucle sur une erreur ne remplit pas le journal
  const fetchOriginal = window.fetch ? window.fetch.bind(window) : null;
  let nbEnvoyes = 0;
  let pageQuittee = false;
  window.addEventListener('pagehide', function () { pageQuittee = true; });

  // Contexte utile au diagnostic, ajouté à chaque signalement : dans quelle appli
  // (Facebook, Instagram, TikTok…) et sur quel réseau le visiteur se trouvait.
  function contexte() {
    const ua = navigator.userAgent || '';
    let appli = '';
    if (/FBAN|FBAV|FB_IAB/.test(ua)) appli = 'Facebook';
    else if (/Instagram/.test(ua)) appli = 'Instagram';
    else if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) appli = 'TikTok';
    else if (/WhatsApp/i.test(ua)) appli = 'WhatsApp';
    // effectiveType n'est PAS le type de connexion (Wi-Fi, 4G…) mais une catégorie de
    // vitesse mesurée : « 4g » s'affiche aussi en Wi-Fi rapide. Libellé clarifié le
    // 29/09/2026 (la propriétaire, en Wi-Fi, lisait « réseau 4g »).
    const vitesses = { '4g': 'rapide', '3g': 'moyenne', '2g': 'lente', 'slow-2g': 'très lente' };
    const type = navigator.connection && navigator.connection.effectiveType;
    const parties = [typeAppareil(), 'écran ' + window.innerWidth + '×' + window.innerHeight];
    const vv = window.visualViewport;
    if (vv && Math.abs(vv.scale - 1) > 0.05) parties.push('zoom ×' + vv.scale.toFixed(2));
    if (appli) parties.push('depuis ' + appli);
    if (type) parties.push('connexion ' + (vitesses[type] || type));
    if (navigator.onLine === false) parties.push('HORS LIGNE');
    let texte = 'Contexte : ' + parties.join(' · ');
    if (dernierClic && Date.now() - dernierClic.t < 60000) {
      texte += '\nDernier clic : ' + dernierClic.desc + ' (il y a ' + Math.round((Date.now() - dernierClic.t) / 1000) + ' s)';
    }
    return texte;
  }

  function typeAppareil() {
    const ua = navigator.userAgent || '';
    const tactile = navigator.maxTouchPoints > 1 || 'ontouchstart' in window;
    const petitCote = Math.min(screen.width || 0, screen.height || 0);
    if (/iPad|Tablet|SM-T\d|Tab\b/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) || (/Macintosh/.test(ua) && tactile)) return 'tablette';
    if (/Mobi|iPhone|Android/i.test(ua) || (tactile && petitCote && petitCote < 600)) return 'téléphone';
    return 'ordinateur';
  }

  // Dernier élément cliqué par le visiteur : ajouté à chaque signalement, il dit
  // « où » le visiteur était en train d'agir quand le problème est arrivé.
  let dernierClic = null;

  // Robots (aperçus Facebook/WhatsApp, moteurs de recherche, outils d'analyse) : ce ne
  // sont pas de vrais visiteurs, leurs « erreurs » (polices non chargées, etc.) ne
  // disent rien de l'état du site. Constaté le 29/09 : « meta-externalagent »
  // (robot de Facebook) signalait des polices non chargées. On les ignore.
  // Ajout du 29/09 au soir : lecture à voix haute de Google (« Google-Read-Aloud »).
  // (« bot/ » et non « bot » seul : les téléphones de marque Cubot sont de vrais visiteurs.
  // navigator.webdriver : navigateur piloté par un programme — y compris nos tests.)
  const ROBOT = /bot\/|crawler|spider|externalagent|read-aloud|googleother|google-inspectiontool|facebookexternalhit|facebot|headless|lighthouse|pagespeed|slurp|preview|bytespider|petalbot|ahrefs|semrush|yandex|baiduspider|duckduck|embedly|iframely|whatsapp\//i.test(navigator.userAgent || '') || navigator.webdriver === true;

  // Copies de test de Vercel (adresses « …vercel.app ») : Vercel y ajoute sa propre
  // barre d'outils (vercel.live), bloquée par la sécurité du site. Ce ne sont pas des
  // pages vues par les visiteurs : le journal ne suit que la vraie adresse du site
  // (constaté le 29/09).
  const COPIE_DE_TEST = /\.vercel\.app$/i.test(location.hostname || '');

  function signaler(categorie, message, detail) {
    try {
      if (!message || ROBOT || COPIE_DE_TEST || /vercel\.live/i.test(String(message) + ' ' + (detail || ''))) return;
      const texte = ('[' + categorie + '] ' + String(message)).slice(0, 500);
      // Anti-doublon : une même erreur n'est envoyée qu'une fois par session de
      // navigation (elle reste comptée une fois par visiteur concerné).
      try {
        const cle = 'ma2m_err_' + texte.slice(0, 120);
        if (sessionStorage.getItem(cle)) return;
        sessionStorage.setItem(cle, '1');
      } catch (e) {}
      if (nbEnvoyes >= MAX_PAR_PAGE) return;
      nbEnvoyes++;

      const ctx = contexte();
      const pile = ((ctx ? ctx + '\n' : '') + (detail ? String(detail) : '')).slice(0, 1000) || null;

      if (window.Sentry && typeof window.Sentry.captureMessage === 'function') {
        try { window.Sentry.captureMessage(texte, 'error'); } catch (e) {}
      }
      if (!fetchOriginal) return;
      fetchOriginal(URL_JOURNAL, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: CLE_ANON, Authorization: 'Bearer ' + CLE_ANON, Prefer: 'return=minimal' },
        body: JSON.stringify({
          message: texte,
          page: (location.pathname + location.search).slice(0, 200),
          pile: pile,
          user_agent: (navigator.userAgent || '').slice(0, 300)
        })
      }).catch(function () {});
    } catch (e) { /* la surveillance ne doit jamais casser la page */ }
  }
  window.signalerErreur = signaler;

  function nomCourt(url) {
    try { const u = new URL(url, location.href); return (u.host === location.host ? '' : u.host) + u.pathname.slice(-120); }
    catch (e) { return String(url).slice(0, 150); }
  }

  // Code qui n'est PAS celui du site : navigateurs intégrés d'Instagram/Facebook
  // (scripts « iabjs:// », pont Java d'Android « Java object is gone »), extensions
  // de navigateur. Leurs erreurs ne disent rien de l'état du site — les ignorer
  // (constaté dans le journal le 28 septembre 2026).
  // Ajout du 29/09 : programmes que certains navigateurs injectent eux-mêmes dans
  // chaque page — Brave/Firefox sur iPhone (« __firefox__ »), Chrome sur iPhone
  // (« __gCrWeb »), portefeuilles de cryptomonnaie (« ethereum »). Aucun de ces mots
  // n'existe dans le code du site : une vraie erreur du site n'est jamais écartée.
  function codeEtranger(texte) {
    return /iabjs:\/\/|Java object is gone|chrome-extension:\/\/|moz-extension:\/\/|safari-(web-)?extension:\/\/|__firefox__|__gCrWeb|\bethereum\b/i.test(texte || '');
  }

  // --- Erreurs JavaScript + fichiers (images, scripts, styles) qui ne chargent pas ---
  // Écoute en phase de capture : c'est la seule façon de voir l'échec d'une <img>,
  // d'un <script> ou d'un <link>, qui ne remonte pas jusqu'à window autrement.
  window.addEventListener('error', function (e) {
    const cible = e.target;
    if (cible && cible !== window && (cible.tagName === 'IMG' || cible.tagName === 'SCRIPT' || cible.tagName === 'LINK' || cible.tagName === 'VIDEO' || cible.tagName === 'SOURCE' || cible.tagName === 'IFRAME')) {
      const url = cible.currentSrc || cible.src || cible.href || '';
      // Une <img src=""> en attente (remplie plus tard par le JS) « échoue » en
      // pointant vers la page elle-même : ce n'est pas une vraie erreur.
      const attr = cible.getAttribute('src') !== null ? cible.getAttribute('src') : cible.getAttribute('href');
      if (!url || !attr || url.indexOf('data:') === 0 || url.split('#')[0] === location.href.split('#')[0] || pageQuittee || /googletagmanager\.com|google-analytics\.com/.test(url)) return;
      const type = cible.tagName === 'IMG' ? 'Image non chargée' : cible.tagName === 'SCRIPT' ? 'Script non chargé' : cible.tagName === 'LINK' ? 'Style non chargé' : 'Média non chargé';
      if (cible.tagName === 'IMG') {
        // Fausses alertes du 29/09 : 9 miniatures « non chargées » dans la même seconde
        // (4G, page quittée ou chargement interrompu), alors que les photos
        // s'ouvraient normalement. On ne signale donc une image qu'après un second
        // essai de chargement, quelques secondes plus tard, qui échoue lui aussi.
        setTimeout(function () {
          if (pageQuittee) return;
          const essai = new Image();
          essai.onload = function () {};
          essai.onerror = function () { if (!pageQuittee) signaler(type, nomCourt(url), url); };
          essai.src = url;
        }, 4000);
        return;
      }
      signaler(type, nomCourt(url), url);
      return;
    }
    // « Script error. » sans aucun détail : le navigateur masque ainsi les erreurs du
    // code venant d'un AUTRE site (Google, extensions…). Tout le code du site est
    // hébergé chez nous : ses erreurs arrivent toujours avec message, fichier et ligne.
    if (/^Script error\.?$/i.test(e.message || '') && !e.filename && !e.error) return;
    const pileJs = (e.error && e.error.stack) || (e.filename ? e.filename + ':' + e.lineno : '');
    if (codeEtranger(pileJs + ' ' + (e.filename || '') + ' ' + (e.message || ''))) return;
    signaler('Erreur JavaScript', e.message || 'Erreur inconnue', pileJs);
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    const r = e.reason;
    if (codeEtranger((r && r.stack) || '') || codeEtranger(String(r && r.message || r))) return;
    signaler('Erreur JavaScript', r && r.message ? r.message : String(r), r && r.stack);
  });

  // --- Ce que les règles de sécurité (CSP) bloquent — c'était le cas du QR code ---
  document.addEventListener('securitypolicyviolation', function (e) {
    signaler('Bloqué par la sécurité', (e.effectiveDirective || e.violatedDirective) + ' → ' + (e.blockedURI || 'script/style en ligne'), (e.sourceFile ? e.sourceFile + ':' + e.lineNumber : ''));
  });

  // --- console.error : le code du site y écrit quand il rattrape une erreur ---
  if (window.console && console.error) {
    const errorOriginal = console.error.bind(console);
    console.error = function () {
      try {
        const parties = Array.prototype.map.call(arguments, function (a) {
          if (a && a.message) return a.message;
          if (typeof a === 'object') { try { return JSON.stringify(a); } catch (x) { return String(a); } }
          return String(a);
        });
        const pile = Array.prototype.map.call(arguments, function (a) { return a && a.stack ? a.stack : ''; }).join('\n');
        signaler('Erreur signalée par le code', parties.join(' ').slice(0, 400), pile);
      } catch (e) {}
      return errorOriginal.apply(console, arguments);
    };
  }

  // --- Appels réseau qui échouent (base de données, /api, envoi de photos…) ---
  // Codes ignorés car normaux : 401/403 (pas connecté), 404/406 (« aucun résultat »
  // de Supabase, ex. fiche non publiée), 409 (doublon ignoré volontairement).
  // Services de mesure d'audience, souvent bloqués par les bloqueurs de publicité des
  // visiteurs : leur échec n'est pas un dysfonctionnement du site (le code s'en passe).
  const IGNORES = /api\.ipify\.org|google-analytics\.com|googletagmanager\.com|analytics\.google\.com|sentry\.io|sentry-cdn\.com/;
  if (fetchOriginal) {
    window.fetch = function (entree, options) {
      const url = typeof entree === 'string' ? entree : (entree && entree.url) || '';
      const methode = ((options && options.method) || (entree && entree.method) || 'GET').toUpperCase();
      return fetchOriginal(entree, options).then(function (rep) {
        // Réponse « opaque » (envoi sans lecture de la réponse, statut 0) : normal,
        // ce n'est pas un échec (ex. statistiques Google).
        if (!rep.ok && rep.type !== 'opaque' && [401, 403, 404, 406, 409].indexOf(rep.status) === -1 && url.indexOf('journal_erreurs') === -1 && !IGNORES.test(url)) {
          // On joint la raison renvoyée par le serveur (ex. Supabase : « la colonne
          // genre n'existe pas »), lue sur une COPIE de la réponse pour ne pas priver
          // le code du site de sa lecture. Sans elle, un « 400 » ne dit pas quoi corriger.
          const message = methode + ' ' + nomCourt(url) + ' → ' + rep.status;
          rep.clone().text().then(function (corps) {
            signaler('Requête en échec', message, (corps ? 'Réponse : ' + corps.slice(0, 300) + ' · ' : '') + url);
          }, function () {
            signaler('Requête en échec', message, url);
          });
        }
        return rep;
      }, function (err) {
        if (!pageQuittee && !(err && err.name === 'AbortError') && url.indexOf('journal_erreurs') === -1 && !IGNORES.test(url)) {
          signaler('Réseau injoignable', methode + ' ' + nomCourt(url) + ' → ' + (err && err.message ? err.message : err), url);
        }
        throw err;
      });
    };
  }

  // --- Page plus large que l'écran ---
  // Un élément qui dépasse sur le côté (texte trop long, image, bandeau…) permettait
  // de dézoomer et de balayer la page à gauche et à droite. La protection CSS
  // (overflow-x: clip dans css/style.css) coupe ce dépassement, mais on veut SAVOIR
  // quand il se produit pour corriger l'élément en cause : on cherche ici les éléments
  // visibles qui sortent de l'écran sans être coupés par un de leurs conteneurs, et on
  // signale le premier trouvé (page + élément + largeur), une fois par session.
  function decrireElement(el) {
    let nom = el.tagName.toLowerCase();
    if (el.id) nom += '#' + el.id;
    const classes = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    if (classes) nom += '.' + classes;
    if (el.getAttribute && el.getAttribute('name')) nom += '[name=' + el.getAttribute('name') + ']';
    const texte = ((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('alt'))) || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return nom + (texte ? ' « ' + texte + ' »' : '');
  }

  function estCoupeParUnParent(el, largeur) {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.position === 'fixed') return true; // un élément fixe ne peut pas élargir la page
      if (cs.overflowX !== 'visible') {
        const r = p.getBoundingClientRect();
        if (r.left >= -2 && r.right <= largeur + 2) return true;
      }
    }
    return false;
  }

  function verifierDebordement() {
    try {
      if (/^\/outils\//.test(location.pathname)) return; // affiches à imprimer, larges par nature
      const largeur = document.documentElement.clientWidth;
      if (!largeur) return;
      const elements = document.body ? document.body.getElementsByTagName('*') : [];
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.right <= largeur + 2 && r.left >= -2) continue;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        if (estCoupeParUnParent(el, largeur)) continue;
        const depasse = Math.round(Math.max(r.right - largeur, -r.left));
        // Sur ordinateur, les blocs « plein écran » (largeur 100vw) incluent la barre de
        // défilement : ils dépassent de quelques pixels, coupés sans effet visible.
        // Fausses alertes du 29/09 (8 px sur un écran de 1521 px) : on les ignore.
        const barreDefilement = window.innerWidth - largeur;
        if (depasse <= barreDefilement + 1) continue;
        signaler('Page plus large que l\'écran',
          location.pathname + ' : ' + decrireElement(el) + ' dépasse de ' + depasse + ' px',
          'Écran de ' + largeur + ' px ; élément de ' + Math.round(r.width) + ' px (gauche ' + Math.round(r.left) + ', droite ' + Math.round(r.right) + ')');
        return;
      }
    } catch (e) {}
  }
  window.addEventListener('orientationchange', function () { setTimeout(verifierDebordement, 1500); });

  // --- Dernier clic + clics répétés sur un élément qui ne réagit pas ---
  // Quatre clics sur le même bouton en moins de 2 secondes : le visiteur s'impatiente,
  // le bouton ne répond sans doute pas (ou trop lentement). Les flèches de galerie,
  // qu'on touche plusieurs fois exprès, ne comptent pas.
  let clicsRecents = [];
  document.addEventListener('click', function (e) {
    try {
      const brut = e.target && e.target.nodeType === 1 ? e.target : null;
      if (!brut) return;
      const cible = brut.closest('a, button, [role="button"], input, select, label, summary') || brut;
      dernierClic = { desc: decrireElement(cible), t: Date.now() };
      // Seuls les liens et boutons comptent pour les clics répétés (pas les champs
      // de saisie, où l'on clique souvent pour placer le curseur).
      if (!brut.closest('a, button, [role="button"]')) { clicsRecents = []; return; }
      const zone = cible.closest('[class*="lightbox"], [class*="galerie"], [class*="carrousel"], [class*="carousel"]');
      const nomCible = (cible.className || '') + ' ' + (cible.getAttribute('aria-label') || '');
      if (zone || /suivant|précédent|next|prev|fleche|flèche|arrow/i.test(nomCible)) return;
      const maintenant = Date.now();
      clicsRecents = clicsRecents.filter(function (c) { return c.el === cible && maintenant - c.t < 2000; });
      clicsRecents.push({ el: cible, t: maintenant });
      if (clicsRecents.length === 4) {
        signaler('Clics répétés sans effet', location.pathname + ' : ' + decrireElement(cible) + ' cliqué 4 fois en 2 s',
          'Le visiteur a cliqué plusieurs fois de suite sur cet élément : il ne réagissait pas, ou trop lentement.');
      }
    } catch (x) {}
  }, true);

  // --- Zoom de l'écran qui change tout seul ---
  // Cas classique : sur iPhone, toucher un champ de formulaire dont le texte fait
  // moins de 16 px fait zoomer la page automatiquement (et elle reste zoomée). On
  // signale aussi tout zoom qui change sans que le visiteur ait touché l'écran.
  // Un pincement ou un double-tap du visiteur (geste volontaire) est ignoré.
  const vv = window.visualViewport;
  const tactile = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  if (vv && tactile) {
    let dernierToucher = 0;
    let pincement = false;
    let echelle = vv.scale;
    document.addEventListener('touchstart', function (e) {
      dernierToucher = Date.now();
      if (e.touches && e.touches.length > 1) pincement = true;
    }, { passive: true, capture: true });
    document.addEventListener('touchend', function (e) {
      dernierToucher = Date.now();
      if (!e.touches || e.touches.length === 0) setTimeout(function () { pincement = false; }, 1000);
    }, { passive: true, capture: true });
    vv.addEventListener('resize', function () {
      try {
        const s = vv.scale;
        if (window.innerWidth < 50 || window.innerHeight < 50) return;
        if (Math.abs(s - echelle) < 0.05) return;
        echelle = s;
        if (pincement || s <= 1.05) return;
        const actif = document.activeElement;
        if (actif && /^(INPUT|TEXTAREA|SELECT)$/.test(actif.tagName)) {
          const taille = parseFloat(getComputedStyle(actif).fontSize) || 0;
          if (taille && taille < 16) {
            signaler('Zoom automatique', location.pathname + ' : ' + decrireElement(actif) + ' (texte ' + Math.round(taille) + ' px)',
              'Le téléphone a zoomé tout seul quand le visiteur a touché ce champ : son texte fait moins de 16 px (règle des iPhone). Zoom ×' + s.toFixed(2));
            return;
          }
        }
        if (Date.now() - dernierToucher > 1500) {
          signaler('Zoom inattendu', location.pathname + ' : zoom passé à ×' + s.toFixed(2) + ' sans geste du visiteur',
            'Élément actif : ' + (actif && actif !== document.body ? decrireElement(actif) : 'aucun'));
        }
      } catch (x) {}
    });
  }

  // --- Affichage qui « saute » (des blocs qui bougent pendant la lecture) ---
  // Mesure du navigateur (Chrome/Android) : au-delà de 0,25, Google considère que la
  // page bouge de façon gênante. Signalé quand le visiteur quitte la page, avec les
  // éléments qui ont le plus bougé.
  const typesMesures = (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes) || [];
  if (typesMesures.indexOf('layout-shift') !== -1) {
    let totalSauts = 0;
    let pireSaut = null;
    try {
      new PerformanceObserver(function (liste) {
        liste.getEntries().forEach(function (en) {
          if (en.hadRecentInput) return;
          totalSauts += en.value;
          if (!pireSaut || en.value > pireSaut.value) pireSaut = en;
        });
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (x) {}
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'hidden' || totalSauts < 0.25 || !pireSaut) return;
      const sources = (pireSaut.sources || []).map(function (s) {
        return s.node && s.node.nodeType === 1 ? decrireElement(s.node) : '';
      }).filter(Boolean).slice(0, 2).join(' ; ');
      signaler('Affichage qui saute', location.pathname + ' : ' + (sources || 'élément non identifié'),
        'Score ' + totalSauts.toFixed(2) + ' (gênant au-delà de 0,25) ; plus gros saut ' + pireSaut.value.toFixed(2) + ', ' + Math.round(pireSaut.startTime / 1000) + ' s après l\'ouverture');
      totalSauts = 0;
    });
  }

  // --- Page figée (le téléphone ne répond plus pendant plusieurs secondes) ---
  // Fausses alertes écartées (30/09, messages groupés) : le temps passé dans une
  // fenêtre de confirmation du navigateur (« Envoyer ce message ? »), ou dans une autre
  // appli ouverte depuis la page (WhatsApp), compte comme « page bloquée » pour le
  // navigateur. On note ces moments et on ignore un blocage qui les chevauche.
  var momentsExcuses = [];
  ['alert', 'confirm', 'prompt', 'open'].forEach(function (nom) {
    var origine = window[nom];
    if (typeof origine !== 'function') return;
    window[nom] = function () {
      var t0 = performance.now();
      try { return origine.apply(window, arguments); }
      finally { momentsExcuses.push([t0, performance.now() + (nom === 'open' ? 3000 : 500)]); }
    };
  });
  var debutCache = null;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') debutCache = performance.now();
    else if (debutCache !== null) { momentsExcuses.push([debutCache, performance.now() + 1000]); debutCache = null; }
  });
  function blocageExcuse(debut, fin) {
    if (debutCache !== null) return true;
    return momentsExcuses.some(function (m) { return m[0] < fin && m[1] > debut; });
  }
  if (typesMesures.indexOf('longtask') !== -1) {
    try {
      new PerformanceObserver(function (liste) {
        liste.getEntries().forEach(function (en) {
          if (en.duration < 3000) return;
          if (blocageExcuse(en.startTime, en.startTime + en.duration)) return;
          signaler('Page figée', location.pathname + ' : bloquée ' + (en.duration / 1000).toFixed(1) + ' s',
            'La page ne répondait plus aux gestes du visiteur pendant ce temps (' + Math.round(en.startTime / 1000) + ' s après l\'ouverture).');
        });
      }).observe({ type: 'longtask', buffered: true });
    } catch (x) {}
  }

  // --- Page restée vide ou dézoomée ---
  // Écran de 0×0 (ou presque) : la page a été ouverte dans une fenêtre invisible
  // (aperçu de lien, préchargement par le navigateur ou une appli), pas par un vrai
  // visiteur. Le zoom mesuré n'y veut rien dire (×0.25 constaté le 29/09).
  function ecranInvisible() {
    return window.innerWidth < 50 || window.innerHeight < 50;
  }
  function verifierPageVisible() {
    try {
      if (/^\/outils\//.test(location.pathname) || document.visibilityState === 'hidden' || ecranInvisible()) return;
      const texte = (document.body && document.body.innerText || '').replace(/\s+/g, ' ').trim();
      if (texte.length < 30) {
        signaler('Page vide', location.pathname + ' : presque aucun texte affiché 8 s après l\'ouverture', 'Texte visible : « ' + texte + ' »');
      }
      if (vv && tactile && vv.scale < 0.95) {
        signaler('Page dézoomée', location.pathname + ' : la page s\'affiche dézoomée (×' + vv.scale.toFixed(2) + ')',
          'Le contenu est plus large que l\'écran : le téléphone a réduit la page pour tout faire tenir.');
      }
    } catch (x) {}
  }

  // --- Page très lente + bibliothèque indispensable jamais chargée ---
  window.addEventListener('load', function () {
    setTimeout(function () {
      try {
        const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
        const duree = nav ? nav.loadEventStart : 0;
        if (duree > 12000) {
          const lourds = (performance.getEntriesByType('resource') || [])
            .filter(function (r) { return r.transferSize || r.duration; })
            .sort(function (a, b) { return (b.duration || 0) - (a.duration || 0); })
            .slice(0, 4)
            .map(function (r) { return nomCourt(r.name) + ' (' + Math.round(r.duration / 100) / 10 + 's' + (r.transferSize ? ', ' + Math.round(r.transferSize / 1024) + ' Ko' : '') + ')'; });
          signaler('Page très lente', 'chargement complet en ' + Math.round(duree / 1000) + ' s', 'Fichiers les plus longs : ' + lourds.join(' ; '));
        }
      } catch (e) {}
      // Contrôle du débordement une fois les données chargées (actualités, mannequins…),
      // puis une seconde fois plus tard pour les contenus arrivés en retard.
      setTimeout(verifierDebordement, 4000);
      setTimeout(verifierDebordement, 15000);
      setTimeout(verifierPageVisible, 8000);
      // Pages qui chargent supabase-js : s'il n'est toujours pas là, rien ne s'affichera.
      const attendSupabase = !!document.querySelector('script[src*="supabase-js"], script[src*="/supabase.js"]');
      if (attendSupabase && typeof window.supabase === 'undefined') {
        signaler('Bibliothèque non chargée', 'supabase-js absent : la page ne peut afficher aucune donnée', '');
      }
    }, 0);
  });
})();
