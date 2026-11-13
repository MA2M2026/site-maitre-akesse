// Photos qui défilent en boucle (13/11/2026, demande de la propriétaire : « les images sont fixes, est-ce qu'elles
// ne peuvent pas s'alterner ? ») sur les pages « luxe » Intégrer l'agence et Atelier talons (FR et EN) : la grande
// photo du haut, les trois photos de la galerie et la photo du défilé passent l'une après l'autre en fondu.
// UNE copie pour les 4 pages. Seulement les photos de l'agence déjà choisies pour ces pages (jamais de mineure).
// Rien ne bouge si le visiteur a demandé moins d'animations ; la page n'anime que ce qui est à l'écran.
(function () {
  'use strict';
  const PHOTOS = ['assets/cours-talons/mannequin-podium.jpg?v=2', 'assets/cours-talons/galerie-tailleur.jpg?v=1',
    'assets/cours-talons/galerie-blanc.jpg?v=1', 'assets/cours-talons/galerie-drapeau.jpg?v=1',
    'assets/cours-talons/mannequin-defile.jpg?v=2', 'assets/reseaux/ma2m-book-4.jpg'];
  const FONDU = 1200;  // ms
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // pages en anglais (/en/…) : les chemins des photos remontent d'un dossier
  const prefixe = /\/en\//.test(location.pathname) ? '../' : '';
  const chemin = (p) => prefixe + p;
  const sansVersion = (u) => u.replace(/\?.*$/, '').replace(/^.*\/assets\//, 'assets/');

  function animer(img, pas, decalage) {
    const parent = img.parentElement;
    // la photo du moment et la suivante, superposées (la suivante prend la place exacte de la première)
    const dessus = img.cloneNode(false);
    dessus.removeAttribute('fetchpriority'); dessus.alt = ''; dessus.setAttribute('aria-hidden', 'true');
    dessus.style.opacity = '0'; dessus.style.transition = 'opacity ' + FONDU + 'ms ease';
    if (getComputedStyle(img).position !== 'absolute') {
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      dessus.style.position = 'absolute'; dessus.style.inset = '0';
    }
    parent.insertBefore(dessus, img.nextSibling);
    const depart = Math.max(0, PHOTOS.findIndex((p) => sansVersion(p) === sansVersion(img.getAttribute('src') || '')));
    let rang = depart, visible = img, cache = dessus, minuteur = null, aLEcran = false;

    function suivante() {
      rang = (rang + 1) % PHOTOS.length;
      const url = chemin(PHOTOS[rang]);
      const pret = new Image(); pret.src = url;
      (pret.decode ? pret.decode() : Promise.resolve()).catch(() => {}).then(() => {
        // la nouvelle photo vient AU-DESSUS et apparaît en fondu ; l'ancienne ne disparaît qu'ensuite (pas de trou)
        cache.style.transition = 'none'; cache.style.opacity = '0'; cache.src = url;
        parent.insertBefore(cache, visible.nextSibling);
        void cache.offsetWidth;
        cache.style.transition = 'opacity ' + FONDU + 'ms ease'; cache.style.opacity = '1';
        const avant = visible; visible = cache; cache = avant;
        setTimeout(() => { cache.style.transition = 'none'; cache.style.opacity = '0'; }, FONDU + 50);
        planifier(pas);
      });
    }
    function planifier(d) { clearTimeout(minuteur); minuteur = aLEcran ? setTimeout(suivante, d) : null; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => { const avant = aLEcran; aLEcran = e[0].isIntersecting; if (aLEcran && !avant) planifier(pas + decalage); if (!aLEcran) clearTimeout(minuteur); }).observe(parent.closest('section') || parent);  // (la section : sur téléphone, la galerie défile de côté)
    } else { aLEcran = true; planifier(pas + decalage); }
  }

  function lancer() {
    document.querySelectorAll('.lx-hero-photo').forEach((img) => animer(img, 6000, 0));
    document.querySelectorAll('.lx-galerie-photo img').forEach((img, i) => animer(img, 5200, 900 * i));
    document.querySelectorAll('.lx-defile-photo').forEach((img) => animer(img, 6000, 1500));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer); else lancer();
})();
