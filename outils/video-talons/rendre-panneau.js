// Images du panneau horizontal (panneau-large.html) : node rendre-panneau.js <dossier> <durée en secondes> [--apercu]
const path = require('path'); const { chromium } = require('playwright');
(async () => {
  const [dossier, duree] = process.argv.slice(2); const IPS = 30, N = Math.ceil(Number(duree) * IPS);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const erreurs = []; p.on('pageerror', (e) => erreurs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'panneau-large.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  if (erreurs.length) { console.error(erreurs); process.exit(1); }
  const liste = process.argv.includes('--apercu') ? JSON.parse(process.argv[process.argv.indexOf('--apercu') + 1]) : [...Array(N).keys()].map((i) => i / IPS);
  for (let i = 0; i < liste.length; i++) {
    await p.evaluate((x) => window.rendre(x), liste[i]);
    await p.screenshot({ path: path.join(dossier, 'p' + String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
  }
  await b.close();
})();
