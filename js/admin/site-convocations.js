// Nouvelle Administration — Convocations (bloc 1, étape 2). Même écran et même logique que
// l'ancien tableau de bord, sans recopie : l'écran vient de js/convocations-gabarit.js, la
// logique de js/convocations-page.js (projet, mannequins choisies sur un mur de visages) et de
// js/convocations-admin.js (participants, aperçu, envoi, suivi, réponses, relances).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  P.espaces.site.pages['b2-convocations'] = async () => '<div class="ecran-partage ecran-convocations" id="ecran-convocations">' + window.GABARIT_CONVOCATIONS + '</div>';
  P.espaces.site.apres['b2-convocations'] = () => {
    window.demarrerConvocationsPanneau();
    window.demarrerConvocationsPage(document.getElementById('ecran-convocations'));
  };
})();
