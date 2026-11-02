// Jauge des envois et travail automatique de l'Administration (02/11/2026, capture de la propriétaire : « dès que je
// touche le portail, la jauge de photos s'active, comme si j'envoyais une photo »). Cause : 8 s après l'ouverture,
// l'Administration fabrique toute seule les versions légères des photos du Book envoyées depuis un téléphone
// (rattraperPhotosEnArrierePlan, js/photos.js) ; depuis la jauge du 01/11/2026, ces envois l'affichaient.
// Sur tablette et ordinateur, base SIMULÉE (rien n'est écrit pour de vrai) :
//  - le travail automatique envoie bien les versions (et met à jour la fiche des photos) ;
//  - la jauge « Envoi de la photo… » n'apparaît JAMAIS pendant ce temps.
// (La jauge des envois choisis par une personne reste vérifiée par test-envoi-photos.js.)
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const chemin = require('path');
const PORT = String(9300 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['tablette', { width: 1024, height: 1366 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = []; let envois = 0;
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    // la jauge, relevée toutes les 100 ms pendant toute la visite
    await p.addInitScript(() => { window.__jauges = []; setInterval(() => { const j = document.querySelector('.barre-envoi'); if (j) window.__jauges.push(j.textContent); }, 100); });
    const d = donnees('principal'); d.rattrapage = true;  // (travail automatique laissé actif : il refait les versions légères)
    await brancher(p, d, journal); await photosLocales(p);
    await p.route(/__stockage/, async (r) => { envois++; await new Promise((x) => setTimeout(x, 300)); r.fulfill({ status: 200, body: '' }); });
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    // le travail automatique démarre 8 s après l'ouverture ; on attend qu'il ait envoyé et mis à jour des photos
    const debut = Date.now();
    while (Date.now() - debut < 40000 && !journal.some((j) => j[0] === 'PATCH' && j[1] === 'model_photos')) await p.waitForTimeout(500);
    await p.waitForTimeout(2500);
    const majPhotos = journal.filter((j) => j[0] === 'PATCH' && j[1] === 'model_photos').length;
    const jauges = await p.evaluate(() => window.__jauges);
    ok(envois > 0 && majPhotos > 0, n + 'le travail automatique fabrique et envoie bien les versions légères (' + envois + ' fichiers, ' + majPhotos + ' photo(s) mise(s) à jour)');
    ok(jauges.length === 0, n + 'la jauge « Envoi de la photo… » n’apparaît jamais pendant ce travail automatique' + (jauges.length ? ' (vue : ' + jauges[0] + ')' : ''));
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
