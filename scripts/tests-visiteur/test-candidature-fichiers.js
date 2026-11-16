// Formulaire de candidature (audit du 16/11/2026, lot L-5 : R-04, R-05, R-06, R-07), comme une candidate sur téléphone,
// sur Intégrer l'agence :
//  - un PDF n'est plus compté comme photo : il est écarté, avec un message clair (R-05) ;
//  - un faux fichier « .jpg » qui ne s'affiche pas est signalé comme illisible (R-05) ;
//  - une vraie photo de galerie Android sans type ni extension reste acceptée ;
//  - une capture d'écran PNG lourde est allégée en JPEG avant l'envoi (R-06) ;
//  - deux appuis très rapides sur « Envoyer » ne lancent qu'UN envoi (R-07) ;
//  - la bande « Appli MA2M » n'apparaît pas sur les pages de formulaire (elle cachait « Envoyer ») mais reste sur
//    l'accueil (R-04).
// Base et Google Drive SIMULÉS : rien n'est envoyé pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const { brancher } = require('./faux-serveur');
const PORT = String(9600 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = [], journal = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await brancher(p, { tables: {}, rpc: { casting_ouvert: true } }, journal);
  await p.route(/script\.google\.com/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"liens":[],"dossier":"d1"}' }));
  await p.goto('http://127.0.0.1:' + PORT + '/integrer-agence.html'); await p.waitForTimeout(1500);
  const compteur = () => p.textContent('#ca-photos-compteur');

  // 1. un PDF : écarté, avec « n'est pas une photo »
  await p.setInputFiles('#ca-photos', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 essai') });
  await p.waitForFunction(() => !/Préparation/.test(document.getElementById('ca-photos-compteur').textContent), null, { timeout: 15000 }).catch(() => {});
  const n1 = await p.evaluate(() => photosSelectionnees.length), c1 = await compteur();
  ok(n1 === 0 && /n’est pas une photo/.test(c1), 'un PDF n’est pas compté comme photo, et c’est dit : « ' + c1 + ' »');

  // 2. un faux .jpg (contenu qui ne s'affiche pas) : signalé comme illisible, pas gardé
  await p.setInputFiles('#ca-photos', { name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('ceci n’est pas une image') });
  await p.waitForFunction(() => !/Préparation/.test(document.getElementById('ca-photos-compteur').textContent), null, { timeout: 15000 }).catch(() => {});
  const n2 = await p.evaluate(() => photosSelectionnees.length), c2 = await compteur();
  ok(n2 === 0 && /n’a pas pu être lue/.test(c2), 'un faux fichier .jpg est signalé et écarté : « ' + c2 + ' »');

  // 2 bis. une vraie photo de la galerie Android sans type ni extension : acceptée
  const photoSansType = require('fs').readFileSync(path.join(__dirname, 'medias', 'photo0.jpg')).toString('base64');
  const r2b = await p.evaluate(async (b64) => {
    const octets = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const f = new File([octets], '1000012345');  // (sans type ni extension, comme certaines galeries Android)
    const { pretes, illisibles, pasPhotos } = await preparerPhotosEnvoi([f]);
    return { type: f.type, pretes: pretes.length, illisibles: illisibles.length, pasPhotos: pasPhotos.length };
  }, photoSansType);
  ok(r2b.type === '' && r2b.pretes === 1 && !r2b.illisibles && !r2b.pasPhotos, 'une vraie photo de galerie Android sans type ni extension est acceptée (' + JSON.stringify(r2b) + ')');
  // 3. une capture d'écran PNG lourde : allégée en JPEG (moins de 1,5 Mo, 1600 px au plus)
  const r3 = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 2200; c.height = 2200;
    const g = c.getContext('2d'), img = g.createImageData(2200, 2200);
    for (let i = 0; i < img.data.length; i += 4) { img.data[i] = Math.random() * 255; img.data[i + 1] = Math.random() * 255; img.data[i + 2] = Math.random() * 255; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const png = new File([blob], 'Capture.png', { type: 'image/png' });
    const { pretes } = await preparerPhotosEnvoi([png]);
    const f = pretes[0]; if (!f) return { avant: png.size, apres: 0 };
    const bm = await createImageBitmap(f);
    return { avant: png.size, apres: f.size, type: f.type, cote: Math.max(bm.width, bm.height) };
  });
  ok(r3.avant > 1.5 * 1048576 && r3.apres > 0 && r3.apres < 1.5 * 1048576 && r3.type === 'image/jpeg' && r3.cote <= 1600,
    'capture PNG lourde allégée : ' + (r3.avant / 1048576).toFixed(1) + ' Mo → ' + (r3.apres / 1048576).toFixed(2) + ' Mo, ' + r3.type + ', ' + r3.cote + ' px');

  // 4. deux appuis très rapides sur « Envoyer » : un seul envoi (le traitement de l'envoi est remplacé par un compteur)
  const r4 = await p.evaluate(async () => {
    let appels = 0;
    window.soumettreCandidature = async () => { appels++; await new Promise((r) => setTimeout(r, 400)); };
    const f = document.getElementById('form-casting');
    f.dispatchEvent(new Event('submit', { cancelable: true })); f.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 700));
    const pendant = appels;
    f.dispatchEvent(new Event('submit', { cancelable: true })); await new Promise((r) => setTimeout(r, 600));
    return { pendant, apres: appels };
  });
  ok(r4.pendant === 1 && r4.apres === 2, 'deux appuis rapides : un seul envoi (' + r4.pendant + ') ; un nouvel appui après la fin repart normalement (' + r4.apres + ')');

  // 5. la bande « Appli MA2M » : cachée sur les formulaires, visible sur l'accueil
  const bande = () => p.evaluate(() => {
    const d = document.createElement('div'); d.id = 'ma2m-installer'; d.className = 'ma2m-installer ma2m-installer--site'; d.textContent = 'Appli MA2M';
    document.body.appendChild(d); document.body.classList.add('ma2m-installer-visible');
    return getComputedStyle(d).display;
  });
  const surFormulaire = await bande();
  await p.goto('http://127.0.0.1:' + PORT + '/cours-talons.html'); await p.waitForTimeout(1200);
  const surTalons = await bande();
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await p.waitForTimeout(1200);
  const surAccueil = await bande();
  ok(surFormulaire === 'none' && surTalons === 'none' && surAccueil !== 'none', 'bande « Appli MA2M » : cachée sur Intégrer l’agence (' + surFormulaire + ') et Cours de talons (' + surTalons + '), visible sur l’accueil (' + surAccueil + ')');

  ok(!errs.length, 'aucune erreur de page ' + errs.join(' | '));
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Fichiers et envoi de la candidature : tout passe');
  process.exit(ko ? 1 : 0);
})();
