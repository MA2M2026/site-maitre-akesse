// Nouvelle Administration — Messages groupés (bloc 1, étape 2). Même écran et même logique que
// l'ancien tableau de bord, sans recopie : écran js/messages-groupes-gabarit.js, logique
// js/messages-groupes.js (un message à chaque personne séparément ; e-mails automatiques ;
// WhatsApp une personne après l'autre).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  P.espaces.site.pages['b2-messages-groupes'] = async () => '<div class="ecran-partage">' + window.GABARIT_MESSAGES_GROUPES + '</div>';
  P.espaces.site.apres['b2-messages-groupes'] = () => window.demarrerMessagesGroupes();
})();
