// Nouvelle Administration — Erreurs du site (bloc 1, étape 6). Même écran et même logique que
// l'ancien tableau de bord, sans recopie : l'écran vient de js/erreurs-gabarit.js, la logique
// (classement, gravité, effacement, copie et fichier pour Claude) de js/erreurs-site.js.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  P.espaces.site.pages['b3a-erreurs'] = async () => '<div class="ecran-partage ecran-erreurs" id="ecran-erreurs">' + window.GABARIT_ERREURS + '</div>';
  P.espaces.site.apres['b3a-erreurs'] = () => window.demarrerErreursSite(true);
})();
