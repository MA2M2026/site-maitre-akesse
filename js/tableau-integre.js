// Rubriques de l'ancien tableau de bord ouvertes DANS l'administration (portail /admin, 19/10/2026) :
// le portail les affiche dans son cadre (adresse ?depuis=portail&integre=1#rubrique). Ici, on retire
// tout ce qui fait double emploi avec le portail (en-tête du site, menu de gauche, blocs, pied de
// page, bouton WhatsApp) : seule la rubrique demandée reste, dans l'administration.
(function () {
  'use strict';
  var p = new URLSearchParams(location.search);
  if (p.get('integre') !== '1' || window.top === window) return;
  document.documentElement.classList.add('tdb-integre');
  // la rubrique change : le portail recharge le cadre avec une autre ancre
  addEventListener('hashchange', function () { location.reload(); });
})();
