// ================== Écran d'entrée de l'accueil (FR et EN) ==================
// Validé par la propriétaire le 21/10/2026 (maquettes et vidéos montrées une à une) :
//  1. animation du logo, sur un modèle Pinterest qu'elle a choisi : le logo éclate en grand en
//     tournant, se referme en losange rouge, le bloc se dédouble, tombe, une tige le remonte,
//     une onde s'élargit, puis les morceaux ressortent en spirale et se rassemblent (≈ 3,7 s) ;
//  2. « Bienvenue sur notre site » écrit à la main (police Allison) : vague, les lettres
//     deviennent des points qui tournent en cercle, puis reviennent ;
//  3. trois boutons en verre (Intégrer l'agence, Visiter le Book, Participer à un casting) :
//     à l'appui, le bouton s'enfonce et son rond passe du rouge au vert ;
//  4. jauge « Entrer sur le site » qui se remplit en 5 s, puis l'écran s'efface.
// Une seule fois par visite (sessionStorage). Mouvements réduits demandés par le téléphone :
// pas d'animation, l'écran s'affiche directement. Les navigateurs automatisés (tests, robots)
// ne le voient pas, sauf si un test le demande (localStorage ma2m_test_ecran_entree = 1).
// Pas d'étape ajoutée à l'historique (contrairement aux fenêtres du site) : l'écran s'ouvre à
// l'arrivée, le bouton « retour » ramène simplement d'où l'on vient.
// Chargé dans le <head> SANS defer : il pose aussitôt un voile (css/ecran-entree.css) pour que
// l'accueil n'apparaisse pas une fraction de seconde avant l'écran.
(function () {
  var CLE = 'ma2m_ecran_entree';
  function aMontrer() {
    try {
      if (sessionStorage.getItem(CLE)) return false;
      if (navigator.webdriver && localStorage.getItem('ma2m_test_ecran_entree') !== '1') return false;
      return true;
    } catch (e) { return false; }   // stockage bloqué : on ne pourrait pas retenir « déjà vu »
  }
  if (!aMontrer()) return;
  var racine = document.documentElement;
  racine.classList.add('ee-actif');

  var EN = racine.lang === 'en';
  var TEXTES = EN
    ? { bienvenue: 'Welcome to our website', entrer: 'Enter the website →', boutons: [['Join the agency', '/en/integrer-agence'], ['Visit the Book', '/en/mannequins'], ['Take part in a casting', '/en/candidature']] }
    : { bienvenue: 'Bienvenue sur notre site', entrer: 'Entrer sur le site →', boutons: [['Intégrer l’agence', '/integrer-agence'], ['Visiter le Book', '/mannequins'], ['Participer à un casting', '/candidature']] };
  var DUREE_JAUGE = 5;      // secondes avant l'entrée automatique
  var DEBUT_CHOIX = 3.7;    // fin de l'animation du logo
  var calme = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cl = function (x) { return Math.max(0, Math.min(1, x)); };
  var expo = function (x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * cl(x)); };
  var io = function (x) { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  var rebond = function (x) { x = cl(x); var c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  function el(balise, classe, parent) { var e = document.createElement(balise); if (classe) e.className = classe; if (parent) parent.appendChild(e); return e; }

  var ecran, zone, lettres = [], points = [], centres = null, milieu = [0, 0];
  var scene, morceaux = [], arcs = [], formes = {}, tige, intro, plein, clair;
  var debut = 0, ferme = false, boucle = 0;

  function construire() {
    ecran = el('div', 'ee');
    ecran.setAttribute('role', 'dialog');
    ecran.setAttribute('aria-modal', 'true');
    ecran.setAttribute('aria-label', TEXTES.bienvenue);
    ecran.tabIndex = -1;

    // « Bienvenue » découpé en lettres (et un point par lettre pour le cercle)
    zone = el('h2', 'ee-accueil', ecran);
    el('span', 'u-lecteur-ecran', zone).textContent = TEXTES.bienvenue;   // lu par les lecteurs d'écran
    TEXTES.bienvenue.split(' ').forEach(function (m, k, mots) {
      var mot = el('span', 'ee-mot', zone);
      mot.setAttribute('aria-hidden', 'true');
      Array.from(m).forEach(function (c) { var l = el('span', 'ee-l', mot); l.textContent = c; lettres.push(l); });
      if (k < mots.length - 1) zone.appendChild(document.createTextNode(' '));
    });
    lettres.forEach(function () { points.push(el('i', 'ee-pt', zone)); });

    var rangee = el('div', 'ee-rangee', ecran);
    TEXTES.boutons.forEach(function (b) {
      var a = el('a', 'ee-bouton', rangee);
      a.href = b[1];
      el('span', 'ee-point', a).setAttribute('aria-hidden', 'true');
      a.appendChild(document.createTextNode(b[0]));
      a.addEventListener('pointerdown', function () { a.classList.add('ee-appui'); try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) { /* indisponible */ } });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { a.addEventListener(t, function () { if (!a.dataset.choisi) a.classList.remove('ee-appui'); }); });
      a.addEventListener('click', function (e) {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;   // nouvel onglet : comportement normal
        e.preventDefault();
        a.dataset.choisi = '1'; a.classList.add('ee-appui');
        retenir();
        setTimeout(function () { location.href = a.href; }, 220);   // le temps de voir le vert
      });
    });

    var jauge = el('a', 'ee-jauge', ecran);
    jauge.href = EN ? '/en/' : '/';
    plein = el('i', 'ee-plein', jauge);
    el('span', 'ee-sombre', jauge).textContent = TEXTES.entrer;
    clair = el('span', 'ee-clair', jauge);
    clair.textContent = TEXTES.entrer;
    clair.setAttribute('aria-hidden', 'true');
    jauge.addEventListener('click', function (e) { e.preventDefault(); fermer(); });

    if (!calme) {
      intro = el('div', 'ee-intro', ecran);
      intro.setAttribute('aria-hidden', 'true');
      scene = el('div', 'ee-scene', intro);
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'ee-arcs'); svg.setAttribute('viewBox', '-450 -450 900 900');
      for (var i = 0; i < 3; i++) arcs.push(svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path')));
      scene.appendChild(svg);
      formes.onde = el('i', 'ee-forme ee-onde', scene);
      formes.fantome = el('i', 'ee-forme ee-fantome', scene);
      tige = el('i', 'ee-tige', scene);
      formes.contour = el('i', 'ee-forme ee-contour', scene);
      formes.plein = el('i', 'ee-forme ee-plein-forme', scene);
      // le logo en 9 morceaux [haut, droite, bas, gauche en %] : 6 tranches du grand nom,
      // 2 du sous-titre, le trait rouge
      var decoupe = [];
      for (var k = 0; k < 6; k++) decoupe.push([0, 100 - (k + 1) * 100 / 6, 37.5, k * 100 / 6]);
      decoupe.push([72, 50, 15, 0], [72, 0, 15, 50], [90, 0, 0, 0]);
      decoupe.forEach(function (d, n) {
        var m = el('i', 'ee-morceau', scene);
        m.style.clipPath = 'inset(' + d[0] + '% ' + d[1] + '% ' + d[2] + '% ' + d[3] + '%)';
        var cx = (d[3] + (100 - d[1])) / 2, cy = (d[0] + (100 - d[2])) / 2;
        m.style.transformOrigin = cx + '% ' + cy + '%';
        morceaux.push({ el: m, dx: (cx - 50) / 100, dy: (cy - 50) / 100, k: n });
      });
    }
    document.body.appendChild(ecran);
    racine.classList.add('ee-pret');
    // le verrou de défilement (js/verrou-defilement.js) arrive avec les scripts du bas de page
    if (window.verrouillerDefilement) verrouiller();
    else document.addEventListener('DOMContentLoaded', verrouiller, { once: true });
    document.addEventListener('keydown', clavier);
    ecran.focus({ preventScroll: true });
    if (document.fonts && document.fonts.load) document.fonts.load('80px "Allison"').then(mesurer, mesurer); else mesurer();
    addEventListener('resize', mesurer);
    debut = performance.now();
    boucle = requestAnimationFrame(image);
  }

  function mesurer() {
    if (!zone) return;
    var z = zone.getBoundingClientRect();
    lettres.forEach(function (l) { l.style.transform = 'none'; });
    centres = lettres.map(function (l) { var r = l.getBoundingClientRect(); return [r.left - z.left + r.width / 2, r.top - z.top + r.height * 0.62]; });
    milieu = [z.width / 2, z.height / 2];
  }

  // --- « Bienvenue » : vague, lettres → points en cercle, retour ---
  function vague(t, t0, i, n) {
    var c = (t - t0) / 1.0 * (n + 6) - 3, d = i - c;
    return (t < t0 || t > t0 + 1.1) ? 0 : Math.exp(-d * d / 3);
  }
  function rendreChoix(t, tJauge) {
    var q = cl(tJauge / DUREE_JAUGE);
    plein.style.width = (q * 100).toFixed(2) + '%';
    clair.style.clipPath = 'inset(0 ' + ((1 - q) * 100).toFixed(2) + '% 0 0)';
    if (!centres) return;
    var n = lettres.length, R = Math.min(78, zone.getBoundingClientRect().width * 0.18), rot = t * 140;
    lettres.forEach(function (l, i) {
      var b = vague(t, 0.2, i, n) + vague(t, 3.75, i, n);
      var sortie = cl((t - (1.1 + i * 0.035)) / 0.22), retour = rebond((t - (3.15 + i * 0.035 + 0.3)) / 0.35);
      var s = (1 + 0.28 * b) * (t < 3.15 ? 1 - sortie : retour);
      l.style.transform = 'translateY(' + (-22 * b).toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
      var a = (-90 + i * 360 / n + rot) * Math.PI / 180;
      var lx = centres[i][0], ly = centres[i][1], cx = milieu[0] + Math.cos(a) * R, cy = milieu[1] + Math.sin(a) * R;
      var aller = io((t - (1.1 + i * 0.035)) / 0.7), venir = io((t - (3.15 + i * 0.035)) / 0.55);
      var x = lx + (cx - lx) * aller, y = ly + (cy - ly) * aller - Math.sin(aller * Math.PI) * 40;
      x += (lx - x) * venir; y += (ly - y) * venir - Math.sin(venir * Math.PI) * 30;
      var visible = t >= 1.1 + i * 0.035 && t < 3.15 + i * 0.035 + 0.55;
      var taille = visible ? Math.min(expo((t - (1.1 + i * 0.035)) / 0.25), 1 - cl((t - (3.15 + i * 0.035 + 0.35)) / 0.2)) : 0;
      points[i].style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + taille.toFixed(3) + ')';
    });
  }

  // --- Animation du logo ---
  function arc(p, r, depart, longueur) {   // arc de cercle (degrés) : trait de vitesse
    if (longueur <= 1) { p.setAttribute('d', ''); return; }
    var pt = function (d) { return [r * Math.cos(d * Math.PI / 180), r * Math.sin(d * Math.PI / 180)]; };
    var a = pt(depart), b = pt(depart + longueur);
    p.setAttribute('d', 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + (longueur > 180 ? 1 : 0) + ' 1 ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1));
  }
  function forme(f, x, y, s, r, op) {
    f.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + (45 + r).toFixed(2) + 'deg) scale(' + Math.max(0, s).toFixed(3) + ')';
    f.style.opacity = cl(op).toFixed(3);
  }
  function rendreIntro(t) {
    var W = scene.offsetWidth, H = scene.offsetHeight;
    // morceaux : A (0–0,95 s) éclatement en grand puis fermeture au centre ;
    //            B (2,15–3,15 s) sortie en spirale, très grand, puis rassemblement
    var eclat = io((t - 0.3) / 0.45), fermeture = Math.pow(cl((t - 0.72) / 0.22), 2);
    var spirale = expo((t - 2.15) / 0.45), resserre = rebond((t - 2.55) / 0.6);
    morceaux.forEach(function (m) {
      var dx = m.dx * W, dy = m.dy * H, sens = m.k % 2 ? 1 : -1, ecart, rot, s, op;
      if (t < 1.0) {
        ecart = (1 + 1.6 * eclat) * (1 - fermeture);
        rot = sens * 28 * eclat + sens * 160 * fermeture;
        s = (1 + 0.35 * eclat) * (1 - fermeture);
        op = t < 0.95 ? 1 : 0;
      } else {
        ecart = 2.4 * spirale * (1 - resserre) + resserre;
        rot = sens * (220 * (1 - spirale) + 30 * (1 - resserre)) * (1 - resserre);
        s = (0.2 + 1.1 * spirale) * (1 - resserre) + resserre;
        op = t < 2.15 ? 0 : 1;
      }
      m.el.style.opacity = op;
      m.el.style.transform = 'translate(' + (dx * (ecart - 1)).toFixed(1) + 'px,' + (dy * (ecart - 1) * 1.6).toFixed(1) + 'px) rotate(' + rot.toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
    });
    // traits de vitesse pendant les deux grands mouvements
    var v = Math.max(Math.sin(cl((t - 0.3) / 0.6) * Math.PI), Math.sin(cl((t - 2.2) / 0.7) * Math.PI));
    var base = t < 1.5 ? t * 260 : -t * 300;
    arc(arcs[0], W * 0.62, base, 70 * v); arc(arcs[1], W * 0.55, base + 150, 55 * v); arc(arcs[2], W * 0.68, base + 255, 40 * v);
    // losange rouge (l'accent du Î) : contour → bloc plein qui se dédouble, tombe, remonte par
    // une tige dans le fantôme → onde → contour → les morceaux ressortent
    var c1 = t > 0.88 && t < 1.04, c2 = t > 2.05 && t < 2.22;
    forme(formes.contour, 0, 0, c1 ? 1.25 - 0.4 * cl((t - 0.88) / 0.16) : (c2 ? 0.6 + 0.7 * cl((t - 2.05) / 0.17) : 0), (t - 0.88) * 200, c1 || c2 ? 1 : 0);
    var hauteur = H * 0.75 * (expo((t - 1.1) / 0.25) - io((t - 1.6) / 0.25));
    var pleinVisible = t >= 1.03 && t < 2.08;
    forme(formes.plein, 0, hauteur, 0.72 * (pleinVisible ? (t < 1.95 ? 1 : 1 - cl((t - 1.95) / 0.12) * 0.5) : 0), 0, pleinVisible ? 1 : 0);
    forme(formes.fantome, 0, 0, 0.95, 0, t > 1.1 && t < 1.85 ? 1 : 0);
    var tg = cl((t - 1.25) / 0.2) * (t < 1.85 ? 1 : 0);
    tige.style.height = (hauteur * tg).toFixed(1) + 'px';
    tige.style.opacity = tg > 0 ? 1 : 0;
    var o = cl((t - 1.85) / 0.35);
    forme(formes.onde, 0, 0, 0.95 + o * 5.5, 0, o > 0 && o < 1 ? 1 - o : 0);
    // sortie : le logo s'efface vers le haut
    var fin = io((t - 3.45) / 0.5);
    scene.style.transform = 'translateY(' + (-fin * 40).toFixed(1) + 'px) scale(' + (1 - fin * 0.08).toFixed(3) + ')';
    intro.style.opacity = (1 - fin).toFixed(3);
    if (fin >= 1) { intro.remove(); intro = null; }
  }

  function image(maintenant) {
    if (ferme) return;
    var t = (maintenant - debut) / 1000;
    if (calme) rendreChoix(99, t);
    else {
      if (intro) rendreIntro(t);
      var tc = Math.max(0, t - DEBUT_CHOIX);
      rendreChoix(tc, tc);
    }
    var tJauge = calme ? t : t - DEBUT_CHOIX;
    if (tJauge >= DUREE_JAUGE) { fermer(); return; }
    boucle = requestAnimationFrame(image);
  }

  var verrouille = false;
  function verrouiller() { if (!ferme && !verrouille && window.verrouillerDefilement) { window.verrouillerDefilement(); verrouille = true; } }
  function retenir() { try { sessionStorage.setItem(CLE, '1'); } catch (e) { /* stockage bloqué */ } }
  // Échap ferme l'écran ; Tab reste dans l'écran (l'accueil dessous est caché)
  function clavier(e) {
    if (e.key === 'Escape') { fermer(); return; }
    if (e.key !== 'Tab') return;
    var liens = Array.prototype.slice.call(ecran.querySelectorAll('a'));
    var i = liens.indexOf(document.activeElement), n = liens.length;
    e.preventDefault();
    if (i === -1) liens[e.shiftKey ? n - 1 : 0].focus();
    else liens[(i + (e.shiftKey ? n - 1 : 1)) % n].focus();
  }

  function fermer() {
    if (ferme) return;
    ferme = true;
    cancelAnimationFrame(boucle);
    retenir();
    document.removeEventListener('keydown', clavier);
    removeEventListener('resize', mesurer);
    if (verrouille) window.deverrouillerDefilement();
    ecran.classList.add('ee-sortie');
    setTimeout(function () { ecran.remove(); racine.classList.remove('ee-actif', 'ee-pret'); }, 460);
  }

  // Construit dès que <body> existe (sans attendre les scripts du bas de page : sur connexion
  // faible, le voile beige resterait sinon plusieurs secondes). Au moindre problème, le voile
  // est retiré : l'accueil reste toujours accessible.
  function lancer() {
    try { construire(); } catch (e) {
      ferme = true;
      racine.classList.remove('ee-actif', 'ee-pret');
      if (ecran && ecran.parentNode) ecran.remove();
      if (window.signalerErreur) window.signalerErreur('Erreur signalée par le code', 'Écran d’entrée : ' + (e && e.message));
    }
  }
  (function attendreBody() { if (document.body) lancer(); else setTimeout(attendreBody, 10); })();
})();
