// Contrôle « un seul bouton pour tout le site » (décision de la propriétaire, 18/10/2026) : chaque
// bouton visible de la page suit le modèle (css/bouton-ma2m.css, 28/10/2026) : sur le rouge, BLANC à
// écriture rouge mat ; dans un bloc blanc, rouge mat à écriture blanche ; coins arrondis (2 px au moins).
// Compte aussi comme bouton un lien habillé en bouton (fond ou cadre, marge intérieure) : il suit
// le même modèle. Ne sont pas concernés : les liens dans le texte, les photos cliquables
// (.cliquable), le bouton WhatsApp flottant et les logos de réseaux (couleurs de marque).
// Utilisé par test-visuel.js (pages publiques) et les essais de l'Administration (/admin/) ;
// dans la nouvelle Administration, règle du 22/10/2026 (voir plus bas).

// Exécutée DANS la page : renvoie la liste des boutons qui ne suivent pas le modèle.
function verifierBoutons() {
  // fond d'un bouton : blanc (ou gris très clair au survol) sur le rouge ; rouge mat #7C2128 (ou
  // rouge profond #5A141B au survol) dans un bloc blanc ; et tout l'entre-deux (transition)
  const rvb0 = (c) => { const m = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(c); return m ? [+m[1], +m[2], +m[3]] : null; };
  const blanc = (c) => { const v = rvb0(c); return !!v && v.every((x) => x >= 240); };
  const rougeMat = (c) => { const v = rvb0(c); return !!v && v[0] >= 85 && v[0] <= 128 && v[1] >= 18 && v[1] <= 36 && v[2] >= 25 && v[2] <= 42; };
  const auModele = (s) => (blanc(s.backgroundColor) && rougeMat(s.color)) || (rougeMat(s.backgroundColor) && s.color === 'rgb(255, 255, 255)')
    // filtres en fine pilule (28/10/2026) : fond transparent, contour de la couleur de l'écriture, blanc ou rouge mat
    || (s.backgroundColor === 'rgba(0, 0, 0, 0)' && s.borderTopColor === s.color && (s.color === 'rgb(255, 255, 255)' || rougeMat(s.color)));
  // .nav : entrées du menu latéral du portail (un menu, comme le menu du site, pas des boutons)
  const exclu = (e) => e.closest('.nav, .cliquable, .mpg-produit, .mpg-commande, .whatsapp-flottant, [data-bouton-libre], .reseaux, .footer-social, .site-footer-reseaux');
  const visible = (e) => {
    // dans un volet replié (<details> fermé), hors de son titre : pas affiché
    const volet = e.closest('details:not([open])');
    if (volet && !e.closest('summary')) return false;
    const q = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return q.width > 4 && q.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const transparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  const adminVivante = !!document.querySelector('link[href*="admin-vivante"]');
  const rvb = (c) => (/rgba?\((\d+), (\d+), (\d+)/.exec(c) || [0, 255, 255, 255]).slice(1, 4).map(Number);
  const lum = (c) => { const [r, g, b] = rvb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  // contraste du texte sur le premier fond non transparent (le bouton ou ce qui est derrière)
  const contraste = (e) => {
    let x = e; while (x && transparent(getComputedStyle(x).backgroundColor)) x = x.parentElement;
    const fond = x ? getComputedStyle(x).backgroundColor : 'rgb(255, 255, 255)';
    const a = lum(getComputedStyle(e).color), f = lum(fond);
    return (Math.max(a, f) + 0.05) / (Math.min(a, f) + 0.05);
  };
  const habille = (e) => {
    const s = getComputedStyle(e);
    const cadre = Number.parseFloat(s.borderTopWidth) > 0 && Number.parseFloat(s.borderBottomWidth) > 0 && Number.parseFloat(s.borderLeftWidth) > 0 && !transparent(s.borderTopColor);
    return (!transparent(s.backgroundColor) || cadre) && Number.parseFloat(s.paddingLeft) >= 6 && Number.parseFloat(s.paddingTop) >= 3;
  };
  const SEL = 'button, input[type=submit], input[type=button], input[type=reset], [role=button], .btn';
  const candidats = new Set([...document.querySelectorAll(SEL)]);
  // lien habillé en bouton (sauf une carte qui contient déjà son propre bouton, ou une image)
  for (const a of document.querySelectorAll('a[href]')) {
    // (un vrai bouton dedans : fond ET écriture au modèle — un simple bloc blanc ne compte pas)
    const contientBouton = [...a.querySelectorAll('*')].some((x) => auModele(getComputedStyle(x)));
    if (habille(a) && !contientBouton && !a.querySelector('img, video, svg:only-child')) candidats.add(a);
  }
  const mauvais = [];
  for (const e of candidats) {
    if (!visible(e) || exclu(e)) continue;
    const s = getComputedStyle(e);
    const rayon = Number.parseFloat(s.borderTopLeftRadius);
    // le texte ne doit pas déborder du bouton (signalé par la propriétaire le 19/10/2026)
    // (mesuré sur le texte lui-même : la coche posée dans le coin d'un filtre choisi, en dehors
    // du bouton, ne compte pas — 20/10/2026)
    let deborde;
    const coche = e.matches('.filtre-btn, .filtre-pill') && e.matches('.actif, [aria-pressed="true"]');
    if (!coche) deborde = e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2;
    else {
      const plage = document.createRange(); plage.selectNodeContents(e);
      const texte = plage.getBoundingClientRect();
      const interieur = e.clientWidth - Number.parseFloat(s.paddingLeft) - Number.parseFloat(s.paddingRight);
      deborde = texte.width > interieur + 2 || texte.height > e.clientHeight + 2;
    }
    // Nouvelle Administration (choix de la propriétaire, 22/10/2026) : rouge pour les actions
    // importantes, boutons clairs ou noirs pour les autres — chaque bouton doit seulement rester
    // bien lisible (contraste du texte sur son fond d'au moins 4,5).
    const modele = adminVivante ? auModele(s) || contraste(e) >= 4.5 : auModele(s);
    const ok = modele && rayon >= 2 && !deborde;
    if (!ok) {
      const nom = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].map((c) => '.' + c).join('');
      mauvais.push({ deborde, element: nom, texte: (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30), fond: s.backgroundColor, couleur: s.color, rayon: s.borderTopLeftRadius });
    }
  }
  return mauvais;
}

// Nouvelle Administration : les formulaires de saisie sont repliés derrière « ＋ titre »
// (js/admin/coque.js, SAISIES) ; on les ouvre comme une personne, en touchant ce bouton.
async function ouvrirSaisies(p) {
  await p.waitForTimeout(400);  // (le repli se fait juste après l'affichage de la page)
  for (const b of await p.$$('#contenu .ouvrir-saisie')) await b.click().catch(() => {});
}

module.exports = { verifierBoutons, ouvrirSaisies };
