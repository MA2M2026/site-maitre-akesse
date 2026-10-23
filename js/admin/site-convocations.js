// Nouvelle Administration — Convocations (bloc 1, étape 2). Même écran et même logique que
// l'ancien tableau de bord, sans recopie : l'écran vient de js/convocations-gabarit.js, la
// logique de js/convocations-page.js (projet, mannequins choisies sur un mur de visages) et de
// js/convocations-admin.js (participants, aperçu, envoi, suivi, réponses, relances, rappels).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  // « Annoncer la sélection » (23/10/2026, demande de la propriétaire) : sa propre ligne dans le
  // menu ; c'est le même écran, avec le message de sélection déjà choisi.
  const ecran = async () => '<div class="ecran-partage ecran-convocations" id="ecran-convocations">' + window.GABARIT_CONVOCATIONS + '</div>';
  // « Rappeler l'information » (23/10/2026, demande de la propriétaire) : sa ligne dans le menu,
  // même écran, avec le rappel (date, heure, lieu) déjà choisi.
  const demarrer = (sorte) => () => {
    const selection = sorte === 'selection';
    window.convocationSorteImposee = sorte;
    const racine = document.getElementById('ecran-convocations');
    if (sorte === 'rappel_avant') {
      racine.querySelector('h2').textContent = '🔔 Rappeler l’information';
      racine.querySelector('h2 + p').textContent = 'Choisissez le projet, puis envoyez le rappel quand vous le voulez (par exemple 3 jours avant) : chaque personne déjà prévenue reçoit la date, l’heure de convocation et le lieu. Celles qui n’ont pas encore répondu reçoivent aussi leur lien pour confirmer. Rien à voir avec les relances.';
    }
    if (selection) {
      racine.querySelector('h2').textContent = '🎉 Annoncer la sélection';
      racine.querySelector('h2 + p').textContent = 'Choisissez le projet, cochez les mannequins sélectionnées, puis envoyez : chacune reçoit un message de félicitations avec la date, l’heure, le lieu et son lien « Confirmez votre participation ». La convocation détaillée se fait ensuite dans « Convocations ».';
    }
    window.demarrerConvocationsPanneau();
    window.demarrerConvocationsPage(racine);
  };
  P.espaces.site.pages['b2-selection'] = ecran;
  P.espaces.site.apres['b2-selection'] = demarrer('selection');
  P.espaces.site.pages['b2-convocations'] = ecran;
  P.espaces.site.apres['b2-convocations'] = demarrer(null);
  P.espaces.site.pages['b2-rappel'] = ecran;
  P.espaces.site.apres['b2-rappel'] = demarrer('rappel_avant');
})();
