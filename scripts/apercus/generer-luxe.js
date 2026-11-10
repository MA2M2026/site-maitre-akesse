// Images d'aperçu « luxe » des liens partagés (WhatsApp, Facebook…) pour les 3 pages de la nouvelle présentation
// (10/11/2026, demande de la propriétaire : « améliorer les prévisualisations quand on envoie chaque page ») :
// Cours de talons, Intégrer l'agence, Postuler à un casting, en français et en anglais. 1200 × 630 (format conseillé
// par Facebook et WhatsApp). Même univers que les pages (css/luxe.css) : photo de mannequin à droite, velours rouge,
// cadre fin, titre en Cormorant Garamond, logo. Rendu par Chromium avec les polices du site (assets/polices), sans
// réseau, puis enregistré dans assets/apercus/<langue>-<page>-luxe.jpg.
//   node scripts/apercus/generer-luxe.js
// Après un changement : augmenter le numéro ?v= des og:image des pages (sinon WhatsApp et Facebook gardent l'ancienne
// image en mémoire). Les autres pages gardent leurs aperçus (scripts/apercus/generer.js).
const fs = require('node:fs'); const path = require('node:path');
const { chromium } = require('playwright');
const RACINE = path.resolve(__dirname, '../..');
// [page, photo, position de la photo, [surtitre, titre, phrase] FR, [idem] EN]
const PAGES = [
  ['cours-talons', 'assets/cours-talons/mannequin-podium.jpg', '30% 62%',
    ['Ouvert à toutes · Abidjan', 'Atelier Talons<br>&amp; Élégance', 'Marchez en talons avec grâce et assurance'],
    ['Open to all · Abidjan', 'Talons &amp; Élégance<br>Workshop', 'Walk in heels with grace and confidence']],
  ['integrer-agence', 'assets/cours-talons/galerie-tailleur.jpg', '50% 20%',
    ['Devenir mannequin', 'Intégrer<br>l’agence', 'Votre parcours <em>commence ici</em>'],
    ['Become a model', 'Join<br>the Agency', 'Your journey <em>starts here</em>']],
  ['candidature', 'assets/cours-talons/mannequin-defile.jpg', '50% 8%',
    ['Castings', 'Postuler<br>à un casting', 'Votre talent, <em>mis en lumière</em>'],
    ['Castings', 'Apply for<br>a Casting', 'Your talent, <em>in the spotlight</em>']],
];
const url = (f) => 'file://' + path.join(RACINE, f);
const police = (fichier, poids, style) => `@font-face { font-family: 'Cormorant Garamond'; font-weight: ${poids}; font-style: ${style}; src: url('${url('assets/polices/' + fichier)}') format('woff2'); }`;
const POLICES = [police('cormorant-garamond-latin-500-normal.woff2', 500, 'normal'), police('cormorant-garamond-latin-ext-500-normal.woff2', 500, 'normal'),
  police('cormorant-garamond-latin-400-italic.woff2', 400, 'italic'), police('cormorant-garamond-latin-ext-400-italic.woff2', 400, 'italic'),
  `@font-face { font-family: 'Work Sans'; font-weight: 600; src: url('${url('assets/polices/work-sans-latin-600-normal.woff2')}') format('woff2'); }`,
  `@font-face { font-family: 'Work Sans'; font-weight: 600; src: url('${url('assets/polices/work-sans-latin-ext-600-normal.woff2')}') format('woff2'); }`].join('\n');

function dessin(photo, position, [surtitre, titre, phrase]) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${POLICES}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #5A141B; position: relative; color: #fff; font-family: 'Work Sans', sans-serif; }
  .photo { position: absolute; top: 0; right: 0; width: 600px; height: 630px; object-fit: cover; object-position: ${position}; -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 30%); mask-image: linear-gradient(90deg, transparent 0%, #000 30%); }
  .voile { position: absolute; inset: 0; background: linear-gradient(90deg, #5A141B 0%, #5A141B 50%, rgba(90, 20, 27, 0.35) 64%, rgba(90, 20, 27, 0) 78%),
    radial-gradient(ellipse at 20% 30%, rgba(124, 33, 40, 0.9), rgba(124, 33, 40, 0) 60%); }
  .cadre { position: absolute; inset: 22px; border: 1px solid rgba(255, 255, 255, 0.4); }
  .texte { position: absolute; left: 86px; top: 0; bottom: 0; width: 600px; display: flex; flex-direction: column; justify-content: center; }
  .logo { width: 210px; filter: brightness(0) invert(1); margin-bottom: 46px; }
  .surtitre { font-size: 17px; font-weight: 600; letter-spacing: 0.34em; text-transform: uppercase; display: flex; align-items: center; gap: 16px; }
  .surtitre::before { content: ""; width: 40px; height: 1px; background: #fff; }
  h1 { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 86px; line-height: 0.95; margin: 22px 0 26px; }
  .ornement { position: relative; width: 150px; height: 1px; background: linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0)); margin-bottom: 26px; }
  .ornement::after { content: ""; position: absolute; left: 0; top: -4px; width: 8px; height: 8px; transform: rotate(45deg); border: 1px solid #fff; background: #7C2128; }
  .phrase { font-family: 'Cormorant Garamond', serif; font-size: 36px; font-style: normal; }
  .phrase em { font-style: italic; }
  .site { position: absolute; left: 86px; bottom: 44px; font-size: 13px; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0.9; }
  </style></head><body>
  <img class="photo" src="${url(photo)}"><div class="voile"></div><div class="cadre"></div>
  <div class="texte"><img class="logo" src="${url('assets/logo-header.png')}"><p class="surtitre">${surtitre}</p><h1>${titre}</h1><span class="ornement"></span><p class="phrase">${phrase}</p></div>
  <p class="site">maitreakessemodelmanagement.com</p>
  </body></html>`;
}

module.exports = { PAGES };
if (require.main === module) (async () => {
  const navigateur = await chromium.launch();
  const p = await navigateur.newPage({ viewport: { width: 1200, height: 630 } });
  for (const [page, photo, position, fr, en] of PAGES) {
    for (const [langue, textes] of [['fr', fr], ['en', en]]) {
      const html = path.join(RACINE, 'scripts/apercus/.apercu-luxe.html');
      fs.writeFileSync(html, dessin(photo, position, textes));
      await p.goto('file://' + html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
      const sortie = path.join(RACINE, `assets/apercus/${langue}-${page}-luxe.jpg`);
      await p.screenshot({ path: sortie, type: 'jpeg', quality: 86 });
      console.log('✓', path.relative(RACINE, sortie), Math.round(fs.statSync(sortie).size / 1024) + ' Ko');
      fs.unlinkSync(html);
    }
  }
  await navigateur.close();
})().catch((e) => { console.error('Images d’aperçu non faites :', e); process.exitCode = 1; });
