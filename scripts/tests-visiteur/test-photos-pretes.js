// Photos des formulaires lues et allégées DÈS LE CHOIX (12/11/2026 : deux candidates d'Intégrer l'agence ont eu
// « Photo 1 : illisible » à l'envoi, après 8 minutes de formulaire : sur certains Android, une photo de la galerie ne
// se relit plus quelques minutes après le choix). On vérifie, sur Intégrer l'agence (téléphone) :
//  - les 4 photos choisies sont préparées et COPIÉES EN MÉMOIRE (le téléphone peut ensuite « perdre » les originales) ;
//  - une photo déjà illisible au moment du choix est signalée TOUT DE SUITE, avec la marche à suivre ;
//  - à l'envoi, les photos préparées partent même si les fichiers d'origine sont devenus illisibles.
// Base et Google Drive SIMULÉS : rien n'est envoyé pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const { brancher } = require('./faux-serveur');
const PORT = String(9700 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = [], journal = [], envois = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await brancher(p, { tables: {}, rpc: { casting_ouvert: true } }, journal);
  await p.route(/script\.google\.com/, (route) => {
    const c = JSON.parse(route.request().postData() || '{}'); envois.push(c);
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, liens: (c.photos || []).map((x, i) => 'https://drive.google.com/photo-' + i), dossier: 'd1' }) });
  });
  await p.goto('http://127.0.0.1:' + PORT + '/integrer-agence.html'); await p.waitForTimeout(1500);

  // 1. quatre vraies photos : préparées, copiées en mémoire
  await p.setInputFiles('#ca-photos', [0, 1, 2, 3].map((i) => path.join(__dirname, 'medias', 'photo' + i + '.jpg')));
  await p.waitForFunction(() => photosSelectionnees.length === 4, null, { timeout: 15000 }).catch(() => {});
  const r1 = await p.evaluate(() => ({ n: photosSelectionnees.length, fichiers: photosSelectionnees.every((f) => f instanceof File && f.size > 0),
    apercus: document.querySelectorAll('#ca-photos-apercu img').length, compteur: document.getElementById('ca-photos-compteur').textContent }));
  ok(r1.n === 4 && r1.fichiers && r1.apercus === 4 && !/Préparation/.test(r1.compteur), 'les 4 photos sont prêtes dès le choix, avec leur aperçu (' + r1.compteur + ')');

  // 2. une photo déjà illisible au moment du choix : signalée tout de suite
  await p.evaluate(() => {
    const casse = new File(['x'], 'IMG_2026.jpg', { type: 'image/jpeg' });
    const refus = () => Promise.reject(new DOMException('The requested file could not be read', 'NotReadableError'));
    casse.arrayBuffer = refus; casse.slice = () => { throw new DOMException('illisible', 'NotReadableError'); };
    preparerPuis([casse], (pretes) => { photosSelectionnees.push(...pretes); });
  });
  await p.waitForTimeout(1500);
  const r2 = await p.evaluate(() => ({ n: photosSelectionnees.length, compteur: document.getElementById('ca-photos-compteur').textContent }));
  ok(r2.n === 4 && /n’a pas pu être lue/.test(r2.compteur) && /choisissez-la à nouveau/.test(r2.compteur), 'une photo illisible est signalée tout de suite, sans être gardée : « ' + r2.compteur + ' »');

  // 3. à l'envoi : les photos préparées partent, sans relire le téléphone (lecture des originaux rendue impossible)
  const r3 = await p.evaluate(async () => {
    const lire = FileReader.prototype.readAsDataURL, pretes = new Set(photosSelectionnees);
    FileReader.prototype.readAsDataURL = function (f) { if (!pretes.has(f)) throw new DOMException('original illisible', 'NotReadableError'); return lire.call(this, f); };
    const b64 = [];
    for (const f of photosSelectionnees) b64.push(await fichierEnBase64(f));
    FileReader.prototype.readAsDataURL = lire;
    return b64.filter((x) => /^data:image\//.test(x)).length;
  });
  ok(r3 === 4, 'à l’envoi, les 4 photos préparées se lisent depuis la mémoire (originaux devenus illisibles) : ' + r3 + ' / 4');
  ok(!errs.length, 'aucune erreur de page ' + errs.join(' | '));
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Photos prêtes dès le choix : tout passe');
  process.exit(ko ? 1 : 0);
})();
