// Images d'essai d'un film à des instants choisis, AVANT le long rendu (13/11/2026) :
//   node apercu.js <film.html> <vertical|large> <dossier de sortie> t1 t2 …   (t en secondes)
// Le minutage (timing-*.js) doit déjà exister : FILM=… VOIX=… IMAGES=… node fabrique-talons.js vertical --minutage
// Affiche les mots introuvables (MANQUES), le nombre d'effets sonores et les erreurs de la page.
const { chromium } = require('playwright'); const path = require('path');
const [film, fmt, sortie, ...ts] = process.argv.slice(2); const L = fmt === 'large';
if (!film || !sortie || !ts.length) { console.error('node apercu.js <film.html> <vertical|large> <dossier> t1 t2 …'); process.exit(1); }
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: L ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, film) + (L ? '?format=large' : ''));
  await p.evaluate(() => document.fonts.ready); await p.evaluate(() => window.PRET); await p.waitForTimeout(500);
  console.log('mots introuvables', JSON.stringify(await p.evaluate(() => window.MANQUES)), '· effets sonores', await p.evaluate(() => (window.EFFETS || []).length));
  for (const t of ts) { await p.evaluate((x) => window.rendre(x), +t); await p.screenshot({ path: path.join(sortie, fmt + '-' + t + '.jpg'), type: 'jpeg', quality: 80 }); }
  if (errs.length) console.log('ERREURS :\n' + errs.join('\n'));
  await b.close();
})();
