// Nouvelle Administration — Agenda du site (bloc 1, étape 5). Même écran et même logique que
// l'ancien tableau de bord, sans recopie : l'écran vient de js/agenda-gabarit.js, la logique de
// js/agenda-admin.js (projet jour par jour, intervenants, partenaires, mannequins, Convoquer).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  P.espaces.site.pages['b3c-agenda'] = async () => '<div class="ecran-partage ecran-agenda" id="ecran-agenda">' + window.GABARIT_AGENDA + '</div>';
  // la liste des projets d'abord ; le formulaire s'ouvre avec « ＋ Ajouter un projet » ou « Modifier »
  P.espaces.site.apres['b3c-agenda'] = () => {
    const ecran = document.getElementById('ecran-agenda'), form = document.getElementById('agenda-form');
    form.classList.add('replie');
    const bouton = document.createElement('button');
    bouton.type = 'button'; bouton.className = 'btn rouge agenda-ouvrir'; bouton.textContent = '＋ Ajouter un projet';
    form.before(bouton);
    const ouvrir = () => { form.classList.remove('replie'); bouton.hidden = true; };
    bouton.addEventListener('click', () => { ouvrir(); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.getElementById('agenda-titre').focus(); });
    ecran.addEventListener('click', (e) => { if (e.target.closest('[data-modifier]')) ouvrir(); }, true);
    window.demarrerAgendaAdmin(ecran);
  };
})();
