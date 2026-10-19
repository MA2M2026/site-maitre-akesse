// Les espaces 2 et 3 de l'Administration (cahier v2.3, mise à jour v2.4 du 19/10/2026), en
// attendant leur construction, étape par étape : chaque tuile ouvre son espace, qui dit
// simplement ce qui y viendra. Remplacés un par un par espace-paiements.js et espace-compta.js,
// après validation de chaque écran par le maître d'ouvrage (espace 1 : espace-site.js).
(function () {
  'use strict';
  const P = window.Portail;
  const A_VENIR = {
    compta: ['Recettes, dépenses, devis, proformas, factures, trésorerie, impôts.',
      'Dossier du mois pour le comptable, en Excel et en PDF ; interrupteur « mode légal » (FNE).']
  };
  Object.keys(A_VENIR).forEach((module) => {
    P.espaces[module] = {
      nav: [['accueil', 'Accueil de l’espace']],
      pages: {
        accueil: async () => P.entete(P.ESPACES[module]) +
          '<div class="carte"><h2>En construction</h2><p class="doux">Cet espace sera construit à l’étape suivante, puis présenté pour validation.</p><ul>' +
          A_VENIR[module].map((t) => '<li>' + P.esc(t) + '</li>').join('') + '</ul></div>'
      }
    };
  });
})();
