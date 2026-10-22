// Contrôle de lisibilité (chantier D du cahier « Architecture », 18/10/2026) : pour chaque texte
// visible à l'écran, contraste entre sa couleur et ce qui est réellement peint dessous
// (norme WCAG AA : 4,5 pour 1, ou 3 pour 1 pour un grand texte). Exécuté DANS la page
// (page.evaluate). Le fond est cherché sous le texte (elementsFromPoint) : un texte posé sur
// une photo ou une vidéo n'est pas jugé (fond non mesurable) ; un dégradé est mesuré à l'endroit du texte.
function verifierLisibilite(options) {
  const seuilNormal = (options && options.seuil) || 4.5;
  const lire = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || '');
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const poser = (dessus, dessous) => ({ r: dessus.r * dessus.a + dessous.r * (1 - dessus.a), g: dessus.g * dessus.a + dessous.g * (1 - dessus.a), b: dessus.b * dessus.a + dessous.b * (1 - dessus.a), a: 1 });
  const opaciteTotale = (el) => { let o = 1; for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  // Couleur d'un dégradé simple (linéaire, ou radial avec tailles en %) au point (x, y) ;
  // null si le dégradé est d'une autre forme (alors chacune de ses couleurs est essayée)
  function couleurDegrade(img, boite, x, y) {
    const m = /^(linear|radial)-gradient\((.*)\)$/.exec(img.trim());
    if (!m || /\)\s*,\s*[a-z-]+-gradient/.test(img)) return null; // plusieurs dégradés superposés
    const morceaux = m[2].split(/,(?![^(]*\))/).map((t) => t.trim());
    let t;
    if (m[1] === 'linear') {
      let angle = 180;
      if (!/^rgba?\(/.test(morceaux[0])) {
        const tete = morceaux.shift(), deg = /^(-?[\d.]+)deg$/.exec(tete);
        const sens = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 };
        if (deg) angle = parseFloat(deg[1]); else if (tete in sens) angle = sens[tete]; else return null;
      }
      const a = angle * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
      const longueur = Math.abs(boite.width * dx) + Math.abs(boite.height * dy);
      t = ((x - boite.left - boite.width / 2) * dx + (y - boite.top - boite.height / 2) * dy) / longueur + 0.5;
    } else {
      const forme = /^([\d.]+)% ([\d.]+)% at ([\d.]+)% ([\d.]+)%$/.exec(morceaux[0]);
      if (!forme) return null;
      morceaux.shift();
      const [rx, ry, cx, cy] = forme.slice(1).map(Number);
      const ex = (x - boite.left - boite.width * cx / 100) / (boite.width * rx / 100);
      const ey = (y - boite.top - boite.height * cy / 100) / (boite.height * ry / 100);
      t = Math.sqrt(ex * ex + ey * ey);
    }
    const arrets = morceaux.map((a, k) => {
      const c = lire(a), suite = a.slice(a.indexOf(')') + 1).trim(), pos = /^([\d.]+)%$/.exec(suite);
      if (suite && !pos) return null; // position en px ou double : dégradé jugé sur toutes ses couleurs
      return c && { c, p: pos ? parseFloat(pos[1]) / 100 : k / Math.max(morceaux.length - 1, 1) };
    });
    if (arrets.some((a) => !a)) return null;
    t = Math.min(Math.max(t, arrets[0].p), arrets[arrets.length - 1].p);
    for (let k = 1; k < arrets.length; k++) {
      const a = arrets[k - 1], b = arrets[k];
      if (t <= b.p) {
        const u = b.p > a.p ? (t - a.p) / (b.p - a.p) : 1, mix = (v, w) => v + (w - v) * u;
        return { r: mix(a.c.r, b.c.r), g: mix(a.c.g, b.c.g), b: mix(a.c.b, b.c.b), a: mix(a.c.a, b.c.a) };
      }
    }
    return arrets[arrets.length - 1].c;
  }
  // ce qui est peint sous le point (x, y), en dessous de l'élément de texte. Un dégradé (sans
  // photo) compte pour chacune de ses couleurs : le texte doit rester lisible sur la pire.
  function fondSous(el, x, y) {
    let pile = document.elementsFromPoint(x, y);
    let i = pile.indexOf(el);
    if (i === -1) {
      // élément « transparent au doigt » (pointer-events: none), absent de la pile : son fond
      // est cherché dans ses parents
      if (getComputedStyle(el).pointerEvents !== 'none') return { cache: true };
      pile = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) pile.push(e);
      i = 0;
    }
    // texte recouvert par autre chose (menu ouvert, fenêtre) : pas jugé, il n'est pas vu
    for (const e of pile.slice(0, i)) {
      if (el.contains(e)) continue;
      const s = getComputedStyle(e), c = lire(s.backgroundColor);
      if (/^(IMG|VIDEO|CANVAS|PICTURE|IFRAME)$/i.test(e.tagName) || (s.backgroundImage && s.backgroundImage !== 'none' && !/(^|\s)0(%|px)/.test(s.backgroundSize)) || (c && c.a >= 0.99)) return { cache: true };
    }
    const couches = []; // de la plus haute à la plus basse ; chaque couche = liste de couleurs possibles
    for (const e of pile.slice(i)) {
      if (/^(IMG|VIDEO|CANVAS|PICTURE|IFRAME|SVG)$/i.test(e.tagName)) return { image: true };
      const s = getComputedStyle(e);
      const img = s.backgroundImage;
      // un dégradé de taille nulle (effet de survol pas encore déclenché) n'est pas peint
      if (img && img !== 'none' && !/(^|\s)0(%|px)/.test(s.backgroundSize)) {
        if (/url\(/.test(img)) return { image: true };
        const ici = couleurDegrade(img, e.getBoundingClientRect(), x, y);
        const arrets = ici ? [ici] : (img.match(/rgba?\([^)]+\)/g) || []).map(lire).filter(Boolean);
        if (arrets.length) couches.push(arrets);
      }
      const c = lire(s.backgroundColor);
      if (c && c.a > 0) { couches.push([c]); if (c.a >= 0.99) break; }
    }
    let fonds = [{ r: 255, g: 255, b: 255, a: 1 }];
    for (let k = couches.length - 1; k >= 0; k--) {
      fonds = fonds.flatMap((f) => couches[k].map((c) => poser(c, f))).slice(0, 512);
    }
    return { couleurs: fonds };
  }
  const nom = (el) => {
    let n = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
    const parent = el.parentElement && el.parentElement.closest('[id]');
    return (parent && parent !== el ? '#' + parent.id + ' ' : '') + n;
  };
  const vus = new Set(), problemes = [];
  const marche = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = marche.nextNode(); t; t = marche.nextNode()) {
    const texte = t.nodeValue.replace(/\s+/g, ' ').trim();
    const el = t.parentElement;
    if (!texte || !el || vus.has(el) || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION|TITLE)$/.test(el.tagName)) continue;
    const s = getComputedStyle(el);
    if (s.visibility !== 'visible' || s.display === 'none') continue;
    if (el.closest('button:disabled, button[aria-disabled="true"], [role="button"][aria-disabled="true"]')) continue; // bouton grisé : volontairement atténué (exempté par la norme)
    const plage = document.createRange(); plage.selectNodeContents(t);
    const r = [...plage.getClientRects()].find((x) => x.width > 2 && x.height > 2);
    if (!r || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue; // hors de l'écran
    const op = opaciteTotale(el);
    if (op < 0.5) continue; // en train d'apparaître ou volontairement effacé
    const x = Math.min(Math.max(r.left + Math.min(r.width / 2, 20), 1), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
    const f = fondSous(el, x, y);
    if (!f.couleurs) continue;
    vus.add(el); // un élément n'est jugé qu'une fois (sur son premier texte visible)
    const c = lire(s.color); if (!c) continue;
    c.a *= op;
    let ratio = Infinity;
    for (const fond of f.couleurs) {
      const l1 = lum(poser(c, fond)), l2 = lum(fond);
      ratio = Math.min(ratio, (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05));
    }
    const taille = parseFloat(s.fontSize), gras = parseInt(s.fontWeight, 10) >= 700;
    const grand = taille >= 24 || (gras && taille >= 18.66);
    const seuil = grand ? 3 : seuilNormal;
    if (ratio < seuil) problemes.push({ element: nom(el), texte: texte.slice(0, 50), contraste: Math.round(ratio * 100) / 100, seuil });
  }
  return problemes;
}
// Côté test (Node) : parcourt toute la page écran par écran (les blocs qui apparaissent au
// défilement sont ainsi vus) et renvoie les textes trop pâles, sans doublon
async function lirePageEntiere(p) {
  const hauteurEcran = await p.evaluate(() => innerHeight);
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  const trouves = [], vus = new Set();
  for (let y = 0; y < h; y += Math.round(hauteurEcran * 0.85)) {
    await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await p.waitForTimeout(250);
    // apparitions en fondu (nouvelle Administration) : mesurer le texte une fois arrivé, pas en chemin
    await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect.getComputedTiming().iterations === Infinity), null, { timeout: 4000 }).catch(() => {});
    for (const x of await p.evaluate(verifierLisibilite)) {
      const cle = x.element + '|' + x.texte;
      if (!vus.has(cle)) { vus.add(cle); trouves.push(x); }
    }
  }
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  return trouves;
}
module.exports = { verifierLisibilite, lirePageEntiere };
