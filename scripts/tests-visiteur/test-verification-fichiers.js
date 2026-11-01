// Contenu réel des fichiers envoyés (lot 3, étape 4 de PLAN-SERVEUR.md, 01/11/2026) : après chaque envoi vers
// le stockage R2, le serveur lit les premiers octets ; un fichier qui n'est pas du format annoncé (par exemple
// une page web déguisée en photo) est SUPPRIMÉ et l'envoi refusé. Stockage SIMULÉ : rien n'est écrit.
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const commun = require('../../api/_commun.js');
const fichiers = {}, supprimes = [];
commun.creerClientR2 = () => ({ send: async (cmd) => {
  const nom = cmd.constructor.name, cle = cmd.input.Key;
  if (nom === 'GetObjectCommand') { if (!(cle in fichiers)) throw new Error('NoSuchKey'); return { Body: { transformToByteArray: async () => Uint8Array.from(fichiers[cle].slice(0, 32)) } }; }
  if (nom === 'DeleteObjectCommand') { supprimes.push(cle); delete fichiers[cle]; return {}; }
  return {};
} });
const { familleDuContenu, repondreR2 } = require('../../api/_r2.js');
const octets = (s) => Array.from(Buffer.from(s, 'binary'));
const JPEG = [0xFF, 0xD8, 0xFF, 0xE0, ...octets('\0\x10JFIF\0\x01\x01\0\0\x01')];
const PNG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, ...octets('IHDR')];
const WEBP = octets('RIFF\x10\0\0\0WEBPVP8 ');
const HEIC = octets('\0\0\0\x18ftypheic\0\0\0\0mif1');
const MP4 = octets('\0\0\0\x20ftypisom\0\0\x02\0isom');
const WEBM = [0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81, 1, 0x42, 0xF7, 0x81];
const PDF = octets('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
const HTML = octets('<!doctype html><script>alert(1)</script>');
const SVG = octets('<svg xmlns="http://www.w3.org/2000/svg" onload="x()">');
ok(familleDuContenu(JPEG) === 'image' && familleDuContenu(PNG) === 'image' && familleDuContenu(WEBP) === 'image' && familleDuContenu(HEIC) === 'image' && familleDuContenu(octets('GIF89a\x01\0\x01\0\0\0')) === 'image', 'vraies photos reconnues : JPEG, PNG, WebP, HEIC, GIF');
ok(familleDuContenu(MP4) === 'video' && familleDuContenu(WEBM) === 'video' && familleDuContenu(PDF) === 'pdf', 'vidéos MP4 et WebM, document PDF reconnus');
ok(familleDuContenu(HTML) === null && familleDuContenu(SVG) === null && familleDuContenu([1, 2]) === null, 'page web, SVG, fichier vide : pas une photo');

(async () => {
  const appeler = async (chemin, type) => { let statut = 0, corps = null; await repondreR2({ status(s) { statut = s; return this; }, json(c) { corps = c; return this; } }, 'verifier', chemin, type, undefined, 0); return { statut, corps }; };
  fichiers['m1/photo.jpg'] = JPEG;
  let r = await appeler('m1/photo.jpg', 'image/jpeg');
  ok(r.statut === 200 && !supprimes.length, 'vraie photo : acceptée, gardée');
  fichiers['m1/piege.jpg'] = HTML;
  r = await appeler('m1/piege.jpg', 'image/jpeg');
  ok(r.statut === 422 && r.corps.refuse && /pas une vraie photo/.test(r.corps.error) && supprimes.includes('m1/piege.jpg') && !('m1/piege.jpg' in fichiers), 'page web déguisée en photo : refusée ET supprimée du stockage');
  fichiers['site/video/v.mp4'] = PDF;
  r = await appeler('site/video/v.mp4', 'video/mp4');
  ok(r.statut === 422 && /vidéo/.test(r.corps.error), 'PDF annoncé comme vidéo : refusé');
  fichiers['site/video/v2.mp4'] = MP4;
  ok((await appeler('site/video/v2.mp4', 'video/mp4')).statut === 200, 'vraie vidéo : acceptée');
  fichiers['m1/migr.bin'] = PNG;
  ok((await appeler('m1/migr.bin', 'application/octet-stream')).statut === 200, 'type « octet-stream » (anciennes migrations) : accepté seulement si c’est une vraie image');
  fichiers['m1/migr2.bin'] = PDF;
  ok((await appeler('m1/migr2.bin', 'application/octet-stream')).statut === 422, '« octet-stream » qui n’est pas une image : refusé');
  // (01/11/2026, panne : les mannequins ne pouvaient plus ajouter de photos) relecture impossible : l'envoi n'est PAS bloqué
  { const r = await appeler('m1/absent.jpg', 'image/jpeg'); ok(r.statut === 200 && r.corps.verifie === false && !supprimes.includes('m1/absent.jpg'), 'relecture impossible (droit de lecture, réseau…) : la photo passe, rien n’est supprimé'); }
  // dans le navigateur : après un refus, l'envoi s'arrête (pas 3 essais), le message est clair ; vraie photo : envoyée
  const { chromium } = require('playwright'); const { spawn } = require('child_process');
  const PORT = String(9570 + Math.floor(Math.random() * 20));
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' });
  process.on('exit', () => srv.kill());
  await new Promise((x) => setTimeout(x, 900));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route(/supabase\.co|googletagmanager|google-analytics/, (x) => x.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await p.goto('http://127.0.0.1:' + PORT + '/candidature.html'); await p.waitForTimeout(800);
  const essai = (verdict) => p.evaluate(async (v) => {
    const appels = [];
    window.jetonSessionCourante = async () => 'jeton';
    window.fetch = async (url, o) => {
      const corps = o && typeof o.body === 'string' ? JSON.parse(o.body) : {};
      appels.push(String(url).includes('upload') ? 'PUT' : corps.action || 'signer');
      if (String(url).includes('upload')) return new Response('', { status: 200 });
      if (corps.action === 'verifier') return new Response(JSON.stringify(v === 200 ? { ok: true } : { error: 'Ce fichier n’est pas une vraie photo : il a été refusé.', refuse: true }), { status: v });
      return new Response(JSON.stringify({ uploadUrl: 'https://r2.test/upload', publicUrl: 'https://r2.test/m1/p.jpg' }), { status: 200 });
    };
    // envoi vers le stockage (XMLHttpRequest, pour la barre de progression) : à moitié, puis terminé
    window.__barre = [];
    window.XMLHttpRequest = class {
      constructor() { this.upload = {}; }
      open() {} setRequestHeader() {}
      send() {
        appels.push('PUT');
        setTimeout(() => {
          if (this.upload.onprogress) this.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 });
          const t = document.querySelector('.barre-envoi'); window.__barre.push(t ? t.textContent + '|' + (t.getBoundingClientRect().top > innerHeight / 2 ? 'bas' : 'haut') : '');
          this.status = 200; this.onload();
        }, 30);
      }
    };
    try { const u = await uploaderVersR2('m1', 'm1/p.jpg', new Blob(['x']), 'image/jpeg'); return { u, appels }; } catch (e) { return { erreur: e.message, appels }; }
  }, verdict);
  const refuse = await essai(422);
  ok(/pas une vraie photo/.test(refuse.erreur || '') && refuse.appels.join() === 'signer,PUT,verifier', 'navigateur : fichier refusé → message clair, un seul essai (' + refuse.appels.join() + ')');
  const accepte = await essai(200);
  ok(accepte.u === 'https://r2.test/m1/p.jpg' && accepte.appels.join() === 'signer,PUT,verifier', 'navigateur : vraie photo → envoyée puis vérifiée');
  ok((await p.evaluate(() => window.__barre)).includes('Envoi de la photo…50 %|bas'), 'navigateur : pendant l’envoi, une jauge EN BAS de l’écran (« Envoi de la photo… 50 % ») ' + JSON.stringify(await p.evaluate(() => window.__barre)));
  await p.waitForTimeout(2000);
  ok(!(await p.$('.barre-envoi')), 'navigateur : la jauge disparaît une fois l’envoi terminé');
  for (const statut of [404, 500, 403]) {
    const r = await essai(statut);
    ok(r.u === 'https://r2.test/m1/p.jpg' && r.appels.join() === 'signer,PUT,verifier', 'navigateur : vérification impossible (' + statut + ') → la photo est quand même ajoutée, un seul envoi (' + r.appels.join() + ')');
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
