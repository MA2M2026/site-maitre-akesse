// Nouvelle Administration — Vidéo de l'accueil (bloc 1, étape 5). Même écran et même logique que
// l'ancien tableau de bord, sans recopie : l'écran vient de js/video-accueil-gabarit.js, la
// logique (compression, envoi, aperçu, retrait) de js/couverture-admin.js.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  P.espaces.site.pages['b3d-video-accueil'] = async () => '<div class="ecran-partage ecran-video" id="ecran-video">' + window.GABARIT_VIDEO_ACCUEIL + '</div>';
  P.espaces.site.apres['b3d-video-accueil'] = () => window.demarrerVideosSite();
})();
