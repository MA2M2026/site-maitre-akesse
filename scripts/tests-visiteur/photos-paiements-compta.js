// Photos de chaque rubrique de Paiements et de Comptabilité (base SIMULÉE, administrateur principal), téléphone et
// ordinateur, pour travailler leur présentation (12/11/2026). Usage : CAPTURES=dossier node photos-paiements-compta.js
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const PORT = String(9500 + Math.floor(Math.random() * 90));
const SORTIE = process.env.CAPTURES || path.join(__dirname, 'captures');
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['tel', { width: 390, height: 844 }], ['ordi', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700;
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, donnees('principal'), []); await photosLocales(p);
    await seConnecter(p, 'http://127.0.0.1:' + PORT + '/admin/'); await p.waitForTimeout(1500);
    const liste = await p.evaluate(() => ['paiements', 'compta'].flatMap((esp) => ((window.Portail.espaces[esp] || {}).nav || []).filter((n) => n[0]).map((n) => [esp, n[0], n[1]])));
    for (const [esp, id] of liste) {
      await p.goto('http://127.0.0.1:' + PORT + '/admin/#/' + esp + '/' + id); await p.waitForTimeout(1800);
      await p.screenshot({ path: path.join(SORTIE, nom + '-' + esp + '-' + id + '.png') });
    }
    console.log(nom + ' : ' + liste.length + ' rubriques' + (errs.length ? ' · erreurs : ' + errs.join(' | ') : ''));
    await ctx.close();
  }
  await b.close();
})();
