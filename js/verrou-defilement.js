// ================== Verrou de défilement fiable, y compris sur iPhone ==================
// `overflow: hidden` seul (utilisé auparavant) ne bloque PAS le défilement tactile sur
// iOS Safari — limitation connue et documentée d'iOS, pas un bug ponctuel. La seule
// méthode qui fonctionne réellement sur iPhone consiste à figer la page en
// position:fixed à sa position de défilement exacte, puis à la restaurer à l'identique
// une fois déverrouillée. Un compteur permet à plusieurs éléments (porte d'entrée, menu,
// modales) de verrouiller/déverrouiller sans se marcher dessus si jamais ils se
// chevauchent. Utilisé par le menu et toutes les superpositions plein écran du site.
//
// Fichier à part (12/10/2026 : avant, recopié dans js/app.js et dans le script du haut de
// l'accueil) : chargé SANS async ni defer, juste avant js/app.js sur toutes les pages, et tout
// en haut du <body> sur l'accueil (avant js/accueil-debut.js), pour verrouiller la porte
// d'entrée immédiatement, sans laisser à un visiteur rapide le temps de faire défiler.
(function verrouDefilementIOS() {
  let positionSauvegardee = 0;
  let compteur = 0;

  // Deuxième ligne de défense : certains navigateurs/WebViews embarqués (in-app
  // browsers de messageries, réseaux sociaux, etc.) ignorent parfois le simple
  // position:fixed. On bloque donc aussi directement le geste de balayage tactile
  // tant que la page est verrouillée — sauf à l'intérieur des zones qui ont
  // légitimement leur propre défilement interne (menu, fiches, tiroir du tableau
  // de bord), pour ne pas les casser.
  const ZONES_DEFILEMENT_AUTORISE = '.menu-overlay, .news-modal-contenu, .modal-overlay, .tdb-menu-panel, .projets-liste-scroll, .redaction-shell';
  function bloquerGesteTactile(e) {
    if (e.target.closest(ZONES_DEFILEMENT_AUTORISE)) return;
    e.preventDefault();
  }

  window.verrouillerDefilement = function () {
    if (compteur === 0) {
      positionSauvegardee = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + positionSauvegardee + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.addEventListener('touchmove', bloquerGesteTactile, { passive: false });
    }
    compteur++;
  };

  window.deverrouillerDefilement = function () {
    compteur = Math.max(0, compteur - 1);
    if (compteur === 0) {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      window.scrollTo(0, positionSauvegardee);
      document.removeEventListener('touchmove', bloquerGesteTactile, { passive: false });
    }
  };
})();
