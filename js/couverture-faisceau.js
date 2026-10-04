// Couverture animée en haut de l'accueil (essai demandé par la propriétaire, 04/10/2026) :
// la même animation « faisceau de lumière » que l'intro (js/faisceau.js), au format des
// couvertures de réseaux sociaux (Facebook sur ordinateur, 16:9 sur téléphone — voir
// css/splash.css). Elle se joue quand la couverture apparaît à l'écran, puis le logo reste
// en place et un reflet repasse de temps en temps. Elle ne tourne que lorsqu'elle est
// visible. Moins d'animations demandé ou image introuvable : logo fixe (image de secours).
(function () {
  var sec = document.getElementById('couverture-faisceau');
  if (!sec || !window.ma2mFaisceau) return;
  try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  var cv = sec.querySelector('canvas');
  if (!cv || !cv.getContext || !cv.getContext('2d')) return;

  var anim = window.ma2mFaisceau(cv, { mode: 'couverture', mesurer: function () { return { W: sec.clientWidth, H: sec.clientHeight }; } });
  var t = 0, precedent = null, visible = false, enCours = false;

  function image(ms) {
    if (!visible) { enCours = false; precedent = null; return; }
    // le temps n'avance que pendant que la couverture est visible
    if (precedent !== null) t += Math.min(.1, (ms - precedent) / 1000);
    precedent = ms;
    anim.dessiner(t);
    requestAnimationFrame(image);
  }
  function relancer() { if (visible && !enCours) { enCours = true; requestAnimationFrame(image); } }

  anim.pret.then(function () {
    sec.classList.add('anime');
    anim.dimensionner(); anim.dessiner(0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entrees) {
        visible = entrees[0].isIntersecting; relancer();
      }, { threshold: .25 }).observe(sec);
    } else { visible = true; relancer(); }
    window.addEventListener('resize', function () { anim.dimensionner(); anim.dessiner(t); });
  }, function () { /* image introuvable : le logo fixe reste affiché */ });
})();
