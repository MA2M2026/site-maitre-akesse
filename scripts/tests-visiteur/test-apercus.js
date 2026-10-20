// Aperçus des liens partagés (WhatsApp, Facebook…), demande de la propriétaire du 14/10/2026 :
// chaque page publique a SA propre image (assets/apercus/, faite par scripts/apercus/generer.js),
// au format 1200 × 630, qui montre le nom de la page. Vérifie les balises og: de chaque page.
const fs = require('fs'); const path = require('path');
const racine = path.resolve(__dirname, '../..');
let ko = 0; const ok = (c, m) => { if (!c) { ko++; console.log('❌ ÉCHEC ' + m); } };
const { PAGES } = require('../apercus/generer.js'); // même liste que le programme qui fait les images
const fichiers = PAGES.flatMap(([page, fr, en]) => [fr && page + '.html', en && 'en/' + page + '.html']).filter(Boolean);
const vues = new Set();
// dimensions d'un JPEG (marqueur SOF)
function taille(buf) {
  for (let i = 2; i + 9 < buf.length;) {
    const m = buf[i + 1], l = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
    i += 2 + l;
  }
  return [0, 0];
}
for (const f of fichiers) {
  const html = fs.readFileSync(path.join(racine, f), 'utf8');
  const image = (html.match(/<meta property="og:image" content="https:\/\/www\.maitreakessemodelmanagement\.com\/(assets\/apercus\/[a-z-]+\.jpg)\?v=\d+">/) || [])[1];
  ok(image, f + ' : image d’aperçu propre à la page');
  if (!image) continue;
  const attendu = (f.startsWith('en/') ? 'en-' : 'fr-') + path.basename(f, '.html') + '.jpg';
  ok(path.basename(image) === attendu, f + ' : image ' + image + ' (attendu ' + attendu + ')');
  ok(!vues.has(image), f + ' : image déjà utilisée par une autre page'); vues.add(image);
  const chemin = path.join(racine, image);
  ok(fs.existsSync(chemin), f + ' : fichier ' + image + ' présent');
  if (fs.existsSync(chemin)) { const [l, h] = taille(fs.readFileSync(chemin)); ok(l === 1200 && h === 630, f + ' : 1200 × 630 (' + l + ' × ' + h + ')'); }
  ok(/og:image:width" content="1200"/.test(html) && /og:image:height" content="630"/.test(html), f + ' : dimensions annoncées');
  const ogComplet = (html.match(/<meta property="og:image" content="([^"]*)">/) || [])[1];
  const twitter = (html.match(/<meta name="twitter:image" content="([^"]*)">/) || [])[1];
  ok(!twitter || twitter === ogComplet, f + ' : twitter:image identique à og:image');
  ok(/og:image:alt" content="[^"]+"/.test(html), f + ' : texte de l’image (og:image:alt)');
  ok(/og:title" content="[^"]+"/.test(html) && /og:description" content="[^"]+"/.test(html), f + ' : titre et description');
}
// Boutique « La Maison MA2M » (20/10/2026) : vitrine et fiche d'une pièce, une image commune
for (const f of ['marketplace/index.html', 'marketplace/produit.html']) {
  const html = fs.readFileSync(path.join(racine, f), 'utf8');
  ok(/<meta property="og:image" content="https:\/\/www\.maitreakessemodelmanagement\.com\/assets\/apercus\/fr-boutique\.jpg\?v=\d+">/.test(html), f + ' : image d’aperçu de la boutique');
  ok(/og:title" content="[^"]+"/.test(html) && /og:image:alt" content="[^"]+"/.test(html), f + ' : titre et texte de l’image');
}
const boutique = path.join(racine, 'assets/apercus/fr-boutique.jpg');
ok(fs.existsSync(boutique) && taille(fs.readFileSync(boutique)).join('×') === '1200×630', 'assets/apercus/fr-boutique.jpg : 1200 × 630');
console.log((ko ? '❌ ÉCHEC' : '✓') + ' aperçus des liens : ' + fichiers.length + ' pages (+ la boutique) vérifiées' + (ko ? ', ' + ko + ' problème(s)' : ', chacune avec sa propre image 1200 × 630'));
if (ko) process.exitCode = 1;
