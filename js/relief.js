// « Site en relief » (08/11/2026, phase 3 V3 ; décision de la propriétaire, DECISIONS.md) : échantillon sur The Book,
// à valider par elle avant de l'étendre au reste du site. Le site lui-même paraît en relief et en mouvement
// (jamais les mannequins en 3D) :
//  - les photos s'inclinent doucement au défilement, comme des cartes posées en profondeur, et vers la souris
//    sur ordinateur, avec un reflet de lumière qui suit le pointeur ;
//  - les photos « respirent » (zoom très lent), seulement celles à l'écran ;
//  - les cartes apparaissent en se redressant ; le titre s'éloigne en profondeur au défilement.
// Règles : rien ne change sans ce fichier (la page reste entière, écrite par le serveur) ; il ne démarre qu'APRÈS
// l'affichage complet de la page (jamais avant la grande photo) ; rien n'est déplacé dans la page (seulement des
// transformations : aucun saut d'affichage) ; coupé si le téléphone demande moins d'animations, économise les
// données, a peu de mémoire ou une connexion lente. Styles : css/relief.css, chargé par ce fichier.
(function () {
  'use strict';
  var mm = window.matchMedia ? function (q) { return window.matchMedia(q).matches; } : function () { return false; };
  var co = navigator.connection || {};
  function permis() {
    if (mm('(prefers-reduced-motion: reduce)')) return false;
    if (co.saveData || /(^|-)2g$/.test(co.effectiveType || '')) return false;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return false;
    return 'IntersectionObserver' in window && !!(window.CSS && CSS.supports && CSS.supports('scale', '1'));
  }
  if (!permis()) return;

  var grille, titre, visibles = new Set(), demande = 0, survol = null;
  var fin = mm('(hover: hover) and (pointer: fine)');

  // inclinaison au défilement : la carte penche selon sa hauteur dans l'écran (lectures, puis écritures)
  function image() {
    demande = 0;
    var h = window.innerHeight, mesures = [];
    visibles.forEach(function (c) { var r = c.getBoundingClientRect(); mesures.push([c, (r.top + r.height / 2) / h - 0.5]); });
    mesures.forEach(function (m) { m[0].style.setProperty('--relief-sx', (Math.max(-0.6, Math.min(0.6, m[1])) * -14).toFixed(2) + 'deg'); });
    if (titre) {
      var y = Math.min(window.scrollY, h);
      titre.style.setProperty('--relief-ty', (y * 0.35).toFixed(1) + 'px');
      titre.style.setProperty('--relief-to', Math.max(0, 1 - y / (h * 0.7)).toFixed(3));
    }
  }
  function prevoir() { if (!demande) demande = requestAnimationFrame(image); }

  var vue = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) {
      e.target.classList.toggle('relief-vue', e.isIntersecting);
      if (e.isIntersecting) visibles.add(e.target); else visibles.delete(e.target);
    });
    prevoir();
  }, { rootMargin: '10% 0px' });
  function suivre() { grille.querySelectorAll('.medaillon-photo').forEach(function (p) { vue.observe(p); }); }

  // ordinateur : la photo sous la souris se tourne vers elle, le reflet suit le pointeur
  function pointer(e) {
    var p = e.target.closest && e.target.closest('.medaillon-photo');
    if (survol && survol !== p) relacher();
    if (!p) return;
    survol = p;
    var r = p.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    p.style.setProperty('--relief-rx', ((0.5 - y) * 12).toFixed(2) + 'deg');
    p.style.setProperty('--relief-ry', ((x - 0.5) * 14).toFixed(2) + 'deg');
    p.style.setProperty('--relief-gx', (x * 100).toFixed(1) + '%');
    p.style.setProperty('--relief-gy', (y * 100).toFixed(1) + '%');
  }
  function relacher() {
    if (!survol) return;
    survol.style.setProperty('--relief-rx', '0deg'); survol.style.setProperty('--relief-ry', '0deg');
    survol = null;
  }

  function demarrer() {
    grille = document.getElementById('grille');
    if (!grille) return;
    titre = document.querySelector('main h1');
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = '/css/relief.css'; // (chargé par un script : sans ?v=, revérifié à chaque fois, comme les autres)
    l.onload = function () {
      document.documentElement.classList.add('relief');
      suivre();
      // cartes redessinées par les filtres (js/mannequins.js) : suivies aussi
      new MutationObserver(function () { vue.disconnect(); visibles.clear(); suivre(); }).observe(grille, { childList: true });
      window.addEventListener('scroll', prevoir, { passive: true });
      window.addEventListener('resize', prevoir, { passive: true });
      if (fin) { grille.addEventListener('pointermove', pointer, { passive: true }); grille.addEventListener('pointerleave', relacher, { passive: true }); }
      // l'utilisateur change d'avis en cours de visite (moins d'animations) : tout s'arrête
      if (window.matchMedia) window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function (e) { if (e.matches) document.documentElement.classList.remove('relief'); });
    };
    document.head.appendChild(l);
  }
  // après l'affichage complet, quand le téléphone est libre
  function plusTard() { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(demarrer, { timeout: 2000 }); }
  if (document.readyState === 'complete') plusTard(); else window.addEventListener('load', plusTard, { once: true });
})();
