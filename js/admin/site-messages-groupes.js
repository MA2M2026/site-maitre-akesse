// Nouvelle Administration — Messages groupés (bloc 1, étape 2). Même écran et même logique que
// l'ancien tableau de bord, sans recopie : écran js/messages-groupes-gabarit.js, logique
// js/messages-groupes.js (un message à chaque personne séparément ; e-mails automatiques ;
// WhatsApp une personne après l'autre).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  // (11/11/2026, demande de la propriétaire : « trop procédurier ») trois étapes, une seule à l'écran :
  // 1 · À qui ? (qui, statut, destinataires), 2 · Le message (rendez-vous, texte, image, aperçu), 3 · Envoyer
  P.espaces.site.pages['b2-messages-groupes'] = async () => '<div class="ecran-partage ecran-mg" id="ecran-mg" data-etape="1">' + window.GABARIT_MESSAGES_GROUPES + '</div>';
  P.espaces.site.apres['b2-messages-groupes'] = () => {
    window.demarrerMessagesGroupes();
    const racine = document.getElementById('ecran-mg');
    const resume = () => {
      const n = racine.querySelectorAll('#mg-liste input[type=checkbox]:checked').length;
      const img = racine.querySelector('#mg-image .ij-choisie');
      racine.querySelector('#mg-resume-envoi').innerHTML = '<b>' + P.pluriel(n, 'personne', 'personnes') + '</b> choisie' + (n > 1 ? 's' : '') + ' · ' +
        P.esc((racine.querySelector('#mg-source').selectedOptions[0] || {}).textContent || '') + (img ? ' · 🖼️ avec l’image' : '');
    };
    const aller = (n) => {
      racine.dataset.etape = String(n);
      P.marquerEtapes(racine.querySelectorAll('.mg-etapes [data-mg-etape]'), n, 'mgEtape');  // (js/admin/coque.js)
      if (n === 3) resume();
      racine.scrollIntoView({ block: 'start' });
    };
    racine.addEventListener('click', (e) => { const b = e.target.closest('[data-mg-etape]'); if (b) aller(Number(b.dataset.mgEtape)); });
    aller(1);
  };
})();
