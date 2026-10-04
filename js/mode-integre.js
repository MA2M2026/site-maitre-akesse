// ================== Mode intégré (page affichée à l'intérieur du tableau de bord) ==================
// Demande de la propriétaire (04/10/2026) : publier une actualité ou un événement sans quitter
// le tableau de bord. Le tableau de bord affiche actualites.html / evenements.html dans un cadre,
// avec ?integre=1 : la page masque alors son en-tête, son pied de page et son titre public pour
// ne garder que l'espace de publication (voir css/mode-integre.css).
(function () {
  var integre = /[?&]integre=1\b/.test(location.search) && window.top !== window.self;
  if (!integre) return;
  document.documentElement.classList.add('mode-integre');

  // Rédiger dans le cadre compte comme une activité pour le tableau de bord (sinon il se
  // verrouillerait au bout de 15 minutes en pleine rédaction d'un article).
  var derniere = 0;
  ['pointerdown', 'keydown', 'input', 'wheel', 'touchstart', 'scroll'].forEach(function (evt) {
    document.addEventListener(evt, function () {
      var t = Date.now();
      if (t - derniere < 2000) return;
      derniere = t;
      try { window.parent.document.dispatchEvent(new Event('input')); } catch (e) {}
    }, { capture: true, passive: true });
  });

  // Un lien vers une autre page du site s'ouvre dans un nouvel onglet plutôt qu'à
  // l'intérieur du cadre (le tableau de bord reste en place).
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target) return;
    var h = a.getAttribute('href') || '';
    if (!h || h.charAt(0) === '#' || /^(javascript|mailto|tel):/i.test(h)) return;
    e.preventDefault();
    window.open(a.href, '_blank', 'noopener');
  }, true);
})();
