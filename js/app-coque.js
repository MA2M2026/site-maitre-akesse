// Coquille partagée de l'application MA2M Mannequin (/app/, 25/10/2026) : le menu du bas, les
// liens qui restent DANS l'application (l'Espace mannequin et Mes paiements ont leur version à
// l'intérieur : app/espace-mannequin.html, app/mes-paiements.html, app/inscription-mannequin.html — on ne repasse jamais par le
// site) et le service worker (app/sw.js). Utilisée par l'application (js/mannequin-app.js) et par
// ces pages, qui y affichent le même menu (<nav data-app-nav="profil">).
(function () {
  'use strict';
  const ONGLETS = [['accueil', 'Accueil', '🏠'], ['evenements', 'Événements', '📅'], ['profil', 'Profil', '👤'], ['paiements', 'Paiements', '💳'], ['alertes', 'Messages', '✉️']];
  // page du site → sa version dans l'application
  const DANS_APP = {
    '/': '/app/', '/index.html': '/app/', '/index': '/app/',
    '/espace-mannequin': '/app/espace-mannequin.html', '/espace-mannequin.html': '/app/espace-mannequin.html',
    '/mes-paiements': '/app/mes-paiements.html', '/mes-paiements.html': '/app/mes-paiements.html',
    '/inscription-mannequin': '/app/inscription-mannequin.html', '/inscription-mannequin.html': '/app/inscription-mannequin.html'
  };
  // menu du bas ; badges : { onglet: nombre } ; surPlace : dans l'application elle-même, les onglets
  // changent sans recharger la page (« #événements ») ; ailleurs ils y ramènent (« /app/#… »)
  function nav(actif, badges, surPlace) {
    return '<nav class="ap-nav" aria-label="Menu">' + ONGLETS.map((x) => {
      const n = (badges && badges[x[0]]) || 0;
      return '<a href="' + (surPlace ? '' : '/app/') + '#' + x[0] + '"' + (x[0] === actif ? ' class="actif" aria-current="page"' : '') + '><i aria-hidden="true">' + x[2] + '</i>' + x[1] +
        (n ? '<b aria-label="' + n + ' nouveau(x)">' + n + '</b>' : '') + '</a>';
    }).join('') + '</nav>';
  }
  // un lien du site qui a sa version dans l'application y est envoyé (même s'il est écrit par
  // l'Espace mannequin ou Mes paiements, qui ne savent pas qu'ils sont dans l'application)
  // (clic, clic du milieu, appui long « ouvrir dans un onglet »)
  function garderDansApp(e) {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self')) return;
    let u;
    try { u = new URL(a.getAttribute('href'), document.baseURI); } catch (err) { return; }  // adresse mal écrite : laissée telle quelle
    if (u.origin === location.origin && DANS_APP[u.pathname]) a.setAttribute('href', DANS_APP[u.pathname] + u.search + u.hash);
  }
  ['click', 'auxclick', 'contextmenu'].forEach((sorte) => document.addEventListener(sorte, garderDansApp, true));
  if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).catch(() => { /* sans copie de secours */ }); });
  document.querySelectorAll('[data-app-nav]').forEach((n) => { n.outerHTML = nav(n.getAttribute('data-app-nav')); });
  window.MA2M_APP = { ONGLETS, nav, DANS_APP };
})();
