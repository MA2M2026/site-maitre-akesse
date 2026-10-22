// Nouvelle Administration — Photos mises de côté, Rapport des profils, Fiches événement (bloc 1,
// groupe Mannequins). Mêmes écrans et même logique que l'ancien tableau de bord, sans recopie :
// écrans js/photos-mises-de-cote-gabarit.js, js/rapport-profils-gabarit.js,
// js/fiches-evenement-gabarit.js ; logique js/photos-mises-de-cote.js, js/rapport-profils-admin.js,
// js/fiches-evenement-admin.js (section ouverte d'office, chargement immédiat).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  [['b2-tri-photos', 'GABARIT_PHOTOS_MISES_DE_COTE', 'demarrerPhotosMisesDeCote'],
    ['b2-rapport-profils', 'GABARIT_RAPPORT_PROFILS', 'demarrerRapportProfils'],
    ['b2-fiches-evenement', 'GABARIT_FICHES_EVENEMENT', 'demarrerFichesEvenement']].forEach(([cle, gabarit, demarrer]) => {
    P.espaces.site.pages[cle] = async () => '<div class="ecran-partage section-ouverte">' + window[gabarit].replace(/<details id="/, '<details open id="') + '</div>';
    P.espaces.site.apres[cle] = () => window[demarrer]();
  });
})();
