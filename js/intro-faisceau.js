// Intro de l'accueil : l'animation « faisceau de lumière » (js/faisceau.js) en plein écran,
// à la place du logo fixe. Chargé juste après #logo-splash. Si l'appareil demande moins
// d'animations, si le canvas n'est pas disponible ou si l'image ne charge pas, l'ancien
// logo fixe reste affiché tel quel.
(function () {
  var html = document.documentElement;
  var splash = document.getElementById('logo-splash');
  if (!splash || !html.classList.contains('intro-a-venir')) return;
  try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  var cv = document.createElement('canvas');
  if (!cv.getContext || !cv.getContext('2d') || !window.ma2mFaisceau) return;

  // Durée totale de l'intro, lue par js/accueil.js pour fermer l'écran au bon moment.
  var DUREE = 7.2;
  window.MA2M_INTRO_DUREE = DUREE * 1000;
  cv.className = 'splash-canvas';
  cv.setAttribute('aria-hidden', 'true');
  splash.classList.add('intro-anime');
  splash.insertBefore(cv, splash.firstChild);

  var anim = window.ma2mFaisceau(cv, { mode: 'intro', duree: DUREE, mesurer: function () { return { W: window.innerWidth, H: window.innerHeight }; } });
  var debut = null;
  function image(maintenant) {
    // L'intro a été fermée (fin normale ou « Passer l'intro ») : on arrête de dessiner.
    if (!html.classList.contains('intro-a-venir')) return;
    if (debut === null) debut = maintenant;
    anim.dessiner(Math.min(DUREE, (maintenant - debut) / 1000));
    requestAnimationFrame(image);
  }
  window.addEventListener('resize', function () { if (html.classList.contains('intro-a-venir')) anim.dimensionner(); });
  anim.pret.then(function () { anim.dimensionner(); requestAnimationFrame(image); }, function () {
    // image introuvable : on revient à l'ancien logo fixe
    splash.classList.remove('intro-anime'); cv.remove(); window.MA2M_INTRO_DUREE = null;
  });
})();
