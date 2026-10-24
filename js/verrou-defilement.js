// ================== Verrou de défilement fiable, y compris sur iPhone ==================
// `overflow: hidden` seul (utilisé auparavant) ne bloque PAS le défilement tactile sur
// iOS Safari — limitation connue et documentée d'iOS, pas un bug ponctuel. La seule
// méthode qui fonctionne réellement sur iPhone consiste à figer la page en
// position:fixed à sa position de défilement exacte, puis à la restaurer à l'identique
// une fois déverrouillée. Un compteur permet à plusieurs éléments (menu, lightbox,
// modales) de verrouiller/déverrouiller sans se marcher dessus si jamais ils se
// chevauchent. Utilisé par le menu et toutes les superpositions plein écran du site.
//
// Fichier à part (12/10/2026 : avant, recopié dans js/app.js et dans le script du haut de
// l'accueil) : chargé SANS async ni defer, juste avant js/app.js sur toutes les pages (l'accueil
// compris depuis la refonte « Magazine » du 20/10/2026, qui a retiré la porte d'entrée).
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
      // ordinateur : la barre de défilement disparaît ; sa place est gardée, sinon toute la page
      // s'élargit d'un coup et « saute » (journal du 24/10/2026, écran d'entrée de l'accueil)
      const barre = window.innerWidth - document.documentElement.clientWidth;
      if (barre > 0) document.body.style.paddingRight = barre + 'px';
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
      document.body.style.paddingRight = '';
      window.scrollTo(0, positionSauvegardee);
      document.removeEventListener('touchmove', bloquerGesteTactile, { passive: false });
    }
  };
})();

// ================== Bouton « retour » du téléphone : il ferme la fenêtre ouverte ==================
// (20/10/2026, visite « comme une humaine » sur Android) : un article, un album, une photo en
// grand ou la fiche d'un partenaire s'ouvrent par-dessus la page ; le geste « retour » faisait
// QUITTER la page au lieu de refermer la fenêtre. À l'ouverture, une étape est ajoutée à
// l'historique du navigateur (même adresse) ; « retour » la retire et referme la fenêtre du
// dessus. Fermée par sa croix, la fenêtre retire elle-même son étape. Le menu n'est pas
// concerné : ses liens mènent à d'autres pages (une étape en trop resterait derrière).
//   window.fenetreOuverte(fermer) à l'ouverture, window.fenetreFermee(fermer) à la fermeture.
(function retourFermeLesFenetres() {
  const pile = [];          // fonctions de fermeture des fenêtres ouvertes, la dernière en haut
  let retourAttendu = 0;    // retours lancés par nous-mêmes (croix), à ne pas traiter
  window.fenetreOuverte = function (fermer) {
    if (pile.indexOf(fermer) !== -1) return;
    pile.push(fermer);
    try { history.pushState({ ma2mFenetre: pile.length }, '', location.href); } catch (e) {}
  };
  window.fenetreFermee = function (fermer) {
    const i = pile.lastIndexOf(fermer);
    if (i === -1) return;   // déjà retirée (fermée par le bouton retour)
    pile.splice(i, 1);
    if (history.state && history.state.ma2mFenetre) { retourAttendu++; history.back(); }
  };
  window.addEventListener('popstate', function () {
    if (retourAttendu) { retourAttendu--; return; }
    const fermer = pile.pop();
    if (fermer) fermer();
  });
})();
