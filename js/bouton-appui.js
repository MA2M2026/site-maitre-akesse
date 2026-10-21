// Signal d'appui sur les boutons (demande de la propriétaire, 18/10/2026) : tous les boutons
// sont rouges, il faut donc VOIR celui qu'on vient de toucher.
//  - à l'appui : le bouton s'enfonce et s'entoure d'un liseré blanc pendant un court instant
//    (sur téléphone, le doigt cache le bouton : l'effet reste visible après), petite vibration ;
//  - à l'envoi d'un formulaire : le bouton d'envoi passe « en cours » (points qui défilent)
//    jusqu'à ce que la page réponde, pour ne pas appuyer deux fois.
// Le bouton « choisi » (filtre, onglet, page ouverte) garde, lui, son liseré blanc en
// permanence (css/bouton-ma2m.css). Chargé sur toutes les pages, y compris le portail /admin.
(function () {
  var BOUTONS = 'button, input[type="submit"], input[type="button"], [role="button"], .btn, .bouton, .btn-mini-admin, .filtre-btn, .filtre-pill, .fiche-partage-btn, .journal-btn, .lang-switch, .mp-panier-btn, .mpg-bouton-danger, .tuile, .btn-pill';
  function marquerAppui(el, classe) {
    el.classList.add(classe);
    setTimeout(function () { el.classList.remove(classe); }, 450);
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) { /* vibration indisponible */ }
  }
  document.addEventListener('pointerdown', function (e) {
    // boutons ronds de l'en-tête (EN/FR, Menu, css/charte-ma2m.css) : ils s'enfoncent et passent au vert
    var rond = e.target.closest && e.target.closest('.site-header-v2 .lang-switch, .site-header-v2 .menu-trigger');
    if (rond) { marquerAppui(rond, 'rond-appuye'); return; }
    var t = e.target.closest && e.target.closest(BOUTONS);
    if (!t || t.disabled || t.closest('.cliquable, [data-bouton-libre]')) return;
    marquerAppui(t, 'touche-appuyee');
  }, { passive: true });
  document.addEventListener('submit', function (e) {
    var b = e.submitter;
    if (!b || !b.classList) return;
    b.classList.add('en-cours'); b.setAttribute('aria-busy', 'true');
    // la page a répondu (bouton remplacé ou formulaire redessiné) ou, au pire, après 10 s
    setTimeout(function () { b.classList.remove('en-cours'); b.removeAttribute('aria-busy'); }, 10000);
  });
})();
