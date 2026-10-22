// Nouvelle Administration — Agenda du site (bloc 1, étape 5). Même écran et même logique que
// l'ancien tableau de bord, sans recopie : l'écran vient de js/agenda-gabarit.js, la logique de
// js/agenda-admin.js (projet jour par jour, intervenants, partenaires, mannequins, Convoquer).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  P.espaces.site.pages['b3c-agenda'] = async () => '<div class="ecran-partage ecran-agenda" id="ecran-agenda">' + window.GABARIT_AGENDA + '</div>';
  P.espaces.site.apres['b3c-agenda'] = () => window.demarrerAgendaAdmin(document.getElementById('ecran-agenda'));
})();
