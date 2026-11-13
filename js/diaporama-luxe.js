// Photos qui défilent en boucle (13/11/2026, demande de la propriétaire : « les images sont fixes, est-ce qu'elles
// ne peuvent pas s'alterner ? ») sur les pages « luxe » Intégrer l'agence et Atelier talons (FR et EN) : la grande
// photo du haut, les trois photos de la galerie et la photo du défilé passent l'une après l'autre en fondu.
// UNE copie pour les 4 pages. Seulement les photos de l'agence déjà choisies pour ces pages (jamais de mineure).
//  - deux calques par zone, l'un sur l'autre (z-index), jamais déplacés dans la page : la nouvelle photo apparaît
//    au-dessus, l'ancienne ne s'efface qu'ensuite (pas de trou, pas de clignotement) ;
//  - photo préchargée par prechargerPhoto (js/photos.js) : une photo qui ne vient pas n'est jamais montrée ;
//  - jamais la même photo à deux endroits en même temps ;
//  - seulement quand la section est à l'écran et l'onglet visible ; rien ne bouge si le visiteur demande moins
//    d'animations.
(function () {
  'use strict';
  const NOMS = ['mannequin-podium.jpg', 'galerie-tailleur.jpg', 'galerie-blanc.jpg', 'galerie-drapeau.jpg', 'mannequin-defile.jpg', 'ma2m-book-4.jpg'];
  const FONDU = 1200;  // ms
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const EN = /^en/i.test(document.documentElement.lang || '');
  const prefixe = /\/en\//.test(location.pathname) ? '../' : '';
  const nomDe = (u) => (u || '').replace(/\?.*$/, '').replace(/^.*\//, '');
  // l'adresse de chaque photo : celle déjà écrite dans la page (avec son numéro de version), sinon le dossier connu
  const adresses = {};
  document.querySelectorAll('img[src]').forEach((i) => { const n = nomDe(i.getAttribute('src')); if (NOMS.includes(n) && !adresses[n]) adresses[n] = i.getAttribute('src'); });
  const adresse = (n) => adresses[n] || prefixe + (n.startsWith('ma2m-book') ? 'assets/reseaux/' : 'assets/cours-talons/') + n;
  const ALT = EN ? 'Agency model' : 'Mannequin de l’agence';
  const zones = [];
  // (les photos montrées ET celles en cours de chargement : deux cadres ne choisissent jamais la même)
  const montrees = () => new Set(zones.flatMap((z) => [z.nom, z.reserve]).filter(Boolean));
  const precharger = (url, ok) => {
    if (typeof window.prechargerPhoto === 'function') return window.prechargerPhoto(url, ok);
    const i = new Image(); i.onload = () => ok(url); i.src = url;
  };

  function zone(img, pas, decalage) {
    const parent = img.parentElement;
    if (getComputedStyle(img).position !== 'absolute') {  // (galerie) deux calques absolus dans leur cadre (aspect-ratio)
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      img.style.position = 'absolute'; img.style.inset = '0';
      parent.style.isolation = 'isolate';  // (son propre étage : le calque du dessous reste dans le cadre)
    }
    const base = parseInt(getComputedStyle(img).zIndex, 10) || 0;
    const autre = img.cloneNode(false);
    autre.removeAttribute('fetchpriority'); autre.removeAttribute('loading');
    // l'ancienne transition (zoom au survol de la galerie) est gardée, l'opacité s'y ajoute
    const t = getComputedStyle(img).transition;
    const transition = (t && !/^all 0s/.test(t) ? t + ', ' : '') + 'opacity ' + FONDU + 'ms ease';
    // photo décorative (alt vide) : le reste ; sinon une description qui reste vraie quelle que soit la photo
    const alt = img.getAttribute('alt') ? ALT : '';
    [img, autre].forEach((x) => { x.style.transition = transition; x.alt = alt; });
    autre.style.opacity = '0'; autre.setAttribute('aria-hidden', 'true'); autre.style.zIndex = String(base - 1);  // (jamais au-dessus de l'étage d'origine : voiles et cadres restent devant)
    img.style.zIndex = String(base);
    parent.insertBefore(autre, img.nextSibling);
    const z = { nom: nomDe(img.getAttribute('src')), visible: img, cache: autre, minuteur: null, aLEcran: false, pas, decalage, section: parent.closest('section') || parent };
    z.suivante = () => {
      if (document.hidden || !z.aLEcran) return;
      const prises = montrees(), k = NOMS.indexOf(z.nom);
      let nom = null;
      for (let i = 1; i <= NOMS.length; i++) { const c = NOMS[(k + i + NOMS.length) % NOMS.length]; if (!prises.has(c)) { nom = c; break; } }
      if (!nom) return planifier(z, pas);
      z.reserve = nom;
      let fait = false;
      const secours = setTimeout(() => { if (!fait) { fait = true; z.reserve = null; planifier(z, pas); } }, 8000);  // photo qui ne vient pas : on attend la suivante
      precharger(adresse(nom), (url) => {
        if (fait) return;
        fait = true; clearTimeout(secours);
        const visible = z.visible, cache = z.cache;
        cache.style.transition = 'none'; cache.style.opacity = '0'; cache.src = url;
        cache.style.zIndex = String(base); visible.style.zIndex = String(base - 1);
        void cache.offsetWidth;
        cache.style.transition = transition; cache.style.opacity = '1';
        cache.removeAttribute('aria-hidden'); visible.setAttribute('aria-hidden', 'true');
        z.visible = cache; z.cache = visible; z.nom = nom; z.reserve = null;
        setTimeout(() => { visible.style.transition = 'none'; visible.style.opacity = '0'; void visible.offsetWidth; visible.style.transition = transition; }, FONDU + 50);
        planifier(z, pas);
      });
    };
    zones.push(z);
  }
  function planifier(z, d) { clearTimeout(z.minuteur); z.minuteur = z.aLEcran && !document.hidden ? setTimeout(z.suivante, d) : null; }
  const reprendre = (z) => planifier(z, z.pas + z.decalage);

  function lancer() {
    document.querySelectorAll('.lx-hero-photo').forEach((img) => zone(img, 6000, 0));
    document.querySelectorAll('.lx-galerie-photo img').forEach((img, i) => zone(img, 5200, 900 * i));
    document.querySelectorAll('.lx-defile-photo').forEach((img) => zone(img, 6000, 1500));
    // UN observateur pour toutes les zones : chacune ne vit que quand sa section est à l'écran
    // (la section entière : sur téléphone, la galerie défile de côté)
    const voir = (z, oui) => { const avant = z.aLEcran; z.aLEcran = oui; if (oui && !avant) reprendre(z); if (!oui) clearTimeout(z.minuteur); };
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entrees) => entrees.forEach((e) => zones.filter((z) => z.section === e.target).forEach((z) => voir(z, e.isIntersecting))));
      new Set(zones.map((z) => z.section)).forEach((s) => obs.observe(s));
    } else zones.forEach((z) => voir(z, true));
    // onglet caché : tout s'arrête ; de retour : ça repart
    document.addEventListener('visibilitychange', () => zones.forEach((z) => { if (document.hidden) clearTimeout(z.minuteur); else if (z.aLEcran) reprendre(z); }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer); else lancer();
})();
