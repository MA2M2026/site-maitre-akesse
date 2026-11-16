// Formulaire de candidature (audit du 16/11/2026, chantier L-5), comme une vraie candidate sur un téléphone Android,
// base SIMULÉE (rien n'est envoyé) :
//  - R-05 : un PDF choisi comme « photo » est refusé tout de suite (il ne compte pas dans le minimum) ;
//  - R-06 : une grosse capture PNG (plus de 900 Ko) est allégée en JPEG dès qu'elle est choisie ;
//  - R-04 : la bande « Appli MA2M » ne s'affiche pas sur la page du formulaire (elle couvrait « Envoyer ») ;
//  - R-07 : un faux fichier vidéo n'est plus annoncé « Vidéo prête ».
const { chromium, devices } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { tables, rpc } = require('./pages-publiques');
const path = require('path'), fs = require('fs'), zlib = require('zlib');
const PORT = String(9840 + Math.floor(Math.random() * 30));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PHOTO = fs.readFileSync(path.join(__dirname, 'medias', 'photo1.jpg'));
// une « capture d'écran » PNG de 1200 × 1200 pixels au hasard : environ 4 Mo, impossible à compresser
function pngAuHasard(cote) {
  const crc = (b) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xffffffff; for (const x of b) r = t[(r ^ x) & 0xff] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
  const morceau = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(cote, 0); ihdr.writeUInt32BE(cote, 4); ihdr[8] = 8; ihdr[9] = 2;
  const lignes = Buffer.alloc((cote * 3 + 1) * cote); for (let i = 0; i < lignes.length; i++) lignes[i] = i % (cote * 3 + 1) === 0 ? 0 : (Math.random() * 256) | 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), morceau('IHDR', ihdr), morceau('IDAT', zlib.deflateSync(lignes, { level: 0 })), morceau('IEND', Buffer.alloc(0))]);
}
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ctx = await b.newContext(Object.assign({}, devices['Pixel 5'], { serviceWorkers: 'block' }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await brancher(p, { tables, rpc }, []);
  await p.goto('http://127.0.0.1:' + PORT + '/candidature.html'); await p.waitForTimeout(2500);
  if (await p.isVisible('#bandeau-cookies [data-cookies="non"]')) { await p.click('#bandeau-cookies [data-cookies="non"]'); await p.waitForTimeout(800); }
  ok(!(await p.$('#ma2m-installer')), 'Android : pas de bande « Appli MA2M » sur la page de candidature (elle couvrait « Envoyer »)');
  // la page des actualités (pas de formulaire) la garde
  const q = await ctx.newPage(); await brancher(q, { tables, rpc }, []);
  await q.goto('http://127.0.0.1:' + PORT + '/actualites.html'); await q.waitForTimeout(2500);
  if (await q.isVisible('#bandeau-cookies [data-cookies="non"]')) { await q.click('#bandeau-cookies [data-cookies="non"]'); await q.waitForTimeout(800); }
  ok(!!(await q.$('#ma2m-installer')), 'Android : la bande reste sur une page sans formulaire (actualités)');
  await q.close();
  // photos : 1 vraie, 1 PDF, 1 grosse capture PNG
  const png = pngAuHasard(1200);
  await p.setInputFiles('#ca-photos', [
    { name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: PHOTO },
    { name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF') },
    { name: 'Capture.png', mimeType: 'image/png', buffer: png }]);
  await p.waitForFunction(() => document.querySelectorAll('#ca-photos-apercu .ca-photo-vignette').length >= 1 && !/Préparation/.test(document.getElementById('ca-photos-compteur').textContent), null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(500);
  const etat = await p.evaluate(() => ({ n: document.querySelectorAll('#ca-photos-apercu .ca-photo-vignette').length, texte: document.getElementById('ca-photos-compteur').textContent }));
  ok(etat.n === 2 && /pas pu être lue/.test(etat.texte), 'PDF choisi comme photo : refusé tout de suite, 2 photos comptées sur 3 fichiers (« ' + etat.texte.slice(0, 90) + ' »)');
  const tailles = await p.evaluate(() => Promise.all([...document.querySelectorAll('#ca-photos-apercu img')].map(async (i) => { const r = await fetch(i.src); const bl = await r.blob(); return [bl.type, bl.size]; })));
  ok(png.length > 900 * 1024 && tailles[1] && tailles[1][0] === 'image/jpeg' && tailles[1][1] < png.length / 2,
    'grosse capture PNG (' + Math.round(png.length / 1024) + ' Ko) allégée en JPEG (' + (tailles[1] ? Math.round(tailles[1][1] / 1024) + ' Ko' : '?') + ')');
  // faux fichier vidéo
  await p.setInputFiles('#ca-video', { name: 'presentation.mp4', mimeType: 'video/mp4', buffer: Buffer.from('ceci n’est pas une vidéo'.repeat(20)) });
  await p.waitForTimeout(6000);
  const video = await p.textContent('#ca-video-info');
  ok(!/Vidéo prête/.test(video) && /n'arrive pas à la lire/.test(video), 'faux fichier vidéo : plus de « Vidéo prête », la candidate est invitée à vérifier (« ' + video.slice(0, 80) + ' »)');
  ok(!errs.length, 'aucune erreur de la page ' + errs.join(' | '));
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
