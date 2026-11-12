// Reprise d'un envoi coupé (12/11/2026, demande de la propriétaire : « même si la personne quitte la page, que ça
// s'envoie quand même »). Base et Google Drive SIMULÉS : rien n'est envoyé pour de vrai. Sur Intégrer l'agence :
//  1. un dossier gardé dans le téléphone (photos prêtes + vidéo) dont l'envoi a été coupé PENDANT LA VIDÉO ;
//  2. sur une autre page du site : bandeau « Votre envoi n'est pas terminé » → « Terminer l'envoi » ;
//  3. au retour sur la page du formulaire : la vidéo repart toute seule, les photos ne sont PAS renvoyées, l'agence
//     est prévenue une seule fois, le dossier est oublié du téléphone et le message de fin s'affiche.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'); const fs = require('fs');
const { brancher } = require('./faux-serveur');
const PORT = String(9600 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = [], journal = [], drive = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await brancher(p, { tables: {}, rpc: { casting_ouvert: true, ajouter_video_candidature: null } }, journal);
  await p.route(/script\.google\.com/, (route) => {
    const c = JSON.parse(route.request().postData() || '{}'); drive.push(c.action || (c.photos ? 'photos' : 'autre'));
    const rep = c.action === 'video_debut' ? { ok: true, session: 's1', dossier: 'd1' } : c.action === 'video_morceau' ? { ok: true, video: 'https://drive.google.com/video' }
      : c.action === 'video_etat' ? { ok: true, recu: 0 } : { ok: true, liens: (c.photos || []).map((x, i) => 'https://drive.google.com/photo-' + i), dossier: 'd1' };
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rep) });
  });
  const base = 'http://127.0.0.1:' + PORT;
  // 1. un envoi coupé pendant la vidéo : photos déjà arrivées (photosFaites), vidéo pas encore
  await p.goto(base + '/index.html'); await p.waitForTimeout(800);
  const photo = fs.readFileSync(path.join(__dirname, 'medias', 'photo0.jpg')).toString('base64');
  await p.evaluate(async (photo) => {
    const octets = Uint8Array.from(atob(photo), (c) => c.charCodeAt(0));
    const f = new File([octets], 'photo.jpg', { type: 'image/jpeg' }), v = new File([new Uint8Array(200000)], 'video.mp4', { type: 'video/mp4' });
    await EnvoiFiable.garder('candidature', { candidature: { id: '11111111-2222-3333-4444-555555555555', full_name: 'Awa Koné', email: 'awa@test.ci', phone: '+2250700000001', experience_mannequin: 'non' },
      projetNom: '', mineur: false, parcours: 'agence', photos: [f, f, f], video: v, page: '/integrer-agence.html', photosFaites: true, dossier: 'd1', nbPhotosEchouees: 0 });
  }, photo);
  // 2. bandeau sur une autre page
  await p.goto(base + '/index.html'); await p.waitForSelector('#envoi-a-finir', { timeout: 8000 }).catch(() => {});
  const bandeau = await p.evaluate(() => { const b = document.getElementById('envoi-a-finir'); return b ? { texte: b.innerText, lien: b.querySelector('a').getAttribute('href') } : null; });
  ok(bandeau && /pas terminé/.test(bandeau.texte) && bandeau.lien === '/integrer-agence.html', 'autre page du site : bandeau « Votre envoi n’est pas terminé » → « Terminer l’envoi » ' + JSON.stringify(bandeau));
  // 3. retour sur le formulaire : la reprise se fait toute seule
  drive.length = 0;
  await p.click('#envoi-a-finir a'); await p.waitForTimeout(500);
  await p.waitForFunction(() => /Merci|reste repartira/.test((document.getElementById('ca-msg') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
  const fin = await p.evaluate(async () => ({ msg: document.getElementById('ca-msg').textContent, garde: await EnvoiFiable.lire('candidature'), bandeau: !!document.getElementById('envoi-a-finir') }));
  const courriels = journal.filter((j) => j[0] === 'EMAIL').length;
  ok(drive.includes('video_debut') && !drive.includes('photos'), 'reprise : la vidéo repart toute seule, les photos ne sont pas renvoyées (' + drive.join(', ') + ')');
  ok(/Merci/.test(fin.msg) && fin.garde === null && !fin.bandeau, 'reprise : message de fin, dossier oublié du téléphone, pas de bandeau sur le formulaire');
  ok(courriels === 1, 'l’agence est prévenue une seule fois (' + courriels + ')');
  // 4. cours de talons : inscription coupée pendant la vidéo (photos déjà arrivées) → au retour, la vidéo repart,
  //    l'inscription est enregistrée une fois, puis oubliée du téléphone
  drive.length = 0; const avantTalons = journal.length;
  await p.evaluate(async (photo) => {
    const octets = Uint8Array.from(atob(photo), (c) => c.charCodeAt(0));
    const f = new File([octets], 'photo.jpg', { type: 'image/jpeg' }), v = new File([new Uint8Array(200000)], 'marche.mp4', { type: 'video/mp4' });
    await EnvoiFiable.garder('cours-talons', { ligne: { id: '66666666-7777-8888-9999-000000000000', formule: 'groupe', nb_seances: 4, nom: 'Aya Test', telephone: '+2250700000002', age: 22, decision: 'plus_tard' },
      montant: '30 000 FCFA', photos: [f, f], video: v, d: { liens: ['https://drive.google.com/photo-0', 'https://drive.google.com/photo-1'], rangs: [0, 1], dossier: 'd2', video: null }, page: '/cours-talons.html' });
  }, photo);
  await p.goto(base + '/cours-talons.html');
  await p.waitForFunction(() => !document.getElementById('ct-merci').classList.contains('u-hidden'), null, { timeout: 30000 }).catch(() => {});
  const t = await p.evaluate(async () => ({ merci: document.getElementById('ct-merci').innerText, garde: await EnvoiFiable.lire('cours-talons') }));
  const inscrits = journal.slice(avantTalons).filter((j) => j[0] === 'POST' && j[1] === 'cours_talons');
  ok(drive.includes('video_debut') && !drive.includes('photos'), 'cours de talons, reprise : la vidéo repart, les photos ne sont pas renvoyées (' + drive.join(', ') + ')');
  ok(inscrits.length === 1 && /photo-1/.test(inscrits[0][3]) && /drive\.google\.com\/video/.test(inscrits[0][3]) && /Merci/.test(t.merci) && t.garde === null,
    'cours de talons, reprise : inscription enregistrée une fois (photos + vidéo), « Merci », oubliée du téléphone');
  ok(!errs.length, 'aucune erreur de page ' + errs.join(' | '));
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Reprise d’un envoi coupé : tout passe');
  process.exit(ko ? 1 : 0);
})();
