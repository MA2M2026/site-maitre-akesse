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
//   - une bibliothèque indispensable (Supabase) qui ne s'est jamais chargée.
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
    const co = navigator.connection && navigator.connection.effectiveType ? ' · réseau ' + navigator.connection.effectiveType : '';
    return (appli ? 'depuis ' + appli : '') + co;
  }

  function signaler(categorie, message, detail) {
    try {
      if (!message) return;
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
  function codeEtranger(texte) {
    return /iabjs:\/\/|Java object is gone|chrome-extension:\/\/|moz-extension:\/\/|safari-(web-)?extension:\/\//i.test(texte || '');
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
      signaler(type, nomCourt(url), url);
      return;
    }
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
          signaler('Requête en échec', methode + ' ' + nomCourt(url) + ' → ' + rep.status, url);
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
      // Pages qui chargent supabase-js : s'il n'est toujours pas là, rien ne s'affichera.
      const attendSupabase = !!document.querySelector('script[src*="supabase-js"], script[src*="/supabase.js"]');
      if (attendSupabase && typeof window.supabase === 'undefined') {
        signaler('Bibliothèque non chargée', 'supabase-js absent : la page ne peut afficher aucune donnée', '');
      }
    }, 0);
  });
})();
