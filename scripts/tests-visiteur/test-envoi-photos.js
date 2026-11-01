// Envoi des photos par une mannequin (01/11/2026, plainte de la propriétaire : « très lent, ça bug, la jauge en haut
// n'est pas stable »), comme une vraie personne, sur téléphone, réseau SIMULÉ lent (chaque envoi au stockage met
// 600 ms, comme en 4G moyenne), base SIMULÉE (rien n'est écrit) :
//  - 4 photos choisies d'un coup : jauge EN BAS de l'écran, « Photos envoyées : n / 4 », verte à la fin ;
//  - les versions d'une photo partent en même temps, 2 photos à la fois : bien plus rapide qu'avant ;
//  - une seule vérification par photo (l'originale), pas pour les copies fabriquées par le téléphone.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path'), fs = require('fs');
const PORT = String(9800 + Math.floor(Math.random() * 30));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PHOTO = fs.readFileSync(path.join(__dirname, 'medias', 'photo1.jpg'));

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const q = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage(); const errs = [], journal = [], envois = [], verifs = [];
  q.on('pageerror', (e) => errs.push(e.message));
  await q.addInitScript(() => {
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 36000;
    const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
    localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'awa@test.ci' } }));
    // la jauge, relevée pendant l'envoi
    window.__jauges = [];
    setInterval(() => { const j = document.querySelector('.barre-envoi'); if (j) window.__jauges.push(j.textContent + '|' + (j.getBoundingClientRect().top > innerHeight / 2 ? 'bas' : 'haut') + '|' + getComputedStyle(j.querySelector('.barre-envoi-plein')).backgroundColor); }, 100);
  });
  await brancher(q, { tables: { model_profiles: [{ id: 'admin-1', full_name: 'AWA KONÉ', published: false, desactive: false }], model_photos: [] }, rpc: {} }, journal);
  await q.route(/\/api\/r2-presigner/, async (r) => {
    const corps = JSON.parse(r.request().postData() || '{}');
    if (corps.action === 'verifier') { verifs.push(corps.chemin); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    envois.push(corps.chemin);
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uploadUrl: 'http://127.0.0.1:' + PORT + '/__stockage', publicUrl: 'https://photos.test/' + corps.chemin }) });
  });
  await q.route(/__stockage/, async (r) => { await new Promise((x) => setTimeout(x, 600)); r.fulfill({ status: 200, body: '' }); });
  await q.goto('http://127.0.0.1:' + PORT + '/app/espace-mannequin.html'); await q.waitForTimeout(4000);
  for (let n = 1; n <= 6 && !(await q.$('#fBook')); n++) { await q.click('.step-tab[data-goto="' + n + '"]').catch(() => {}); await q.waitForTimeout(400); }
  const t0 = Date.now();
  await q.setInputFiles('#fBook', [1, 2, 3, 4].map((i) => ({ name: 'IMG_000' + i + '.jpg', mimeType: 'image/jpeg', buffer: PHOTO })));
  await q.waitForFunction(() => document.querySelectorAll('.barre-envoi').length === 0 && window.__jauges.length > 0, null, { timeout: 60000 }).catch(() => {});
  const duree = Date.now() - t0;
  const jauges = await q.evaluate(() => window.__jauges);
  const lignes = journal.filter((j) => j[0] === 'POST' && j[1] === 'model_photos');
  ok(lignes.length === 4, '4 photos choisies : les 4 sont ajoutées au Book (' + lignes.length + ')');
  ok(jauges.some((j) => /Photos envoyées : 0 \/ 4/.test(j)) && jauges.some((j) => /Photos envoyées : [23] \/ 4/.test(j)) && jauges.every((j) => /\|bas\|/.test(j)), 'jauge EN BAS de l’écran : « Photos envoyées : n / 4 » qui avance');
  ok(jauges.some((j) => /100 %.*rgb\(30, 122, 69\)/.test(j)), 'jauge verte à 100 % à la fin');
  ok(verifs.length === 4 && verifs.every((c) => !/miniatures|moyennes|petites/.test(c)), 'une seule vérification par photo (l’originale), aucune pour les copies (' + verifs.length + ')');
  // avant : 7 fichiers par photo l'un après l'autre, 4 photos l'une après l'autre (≥ 4 × 7 × 0,6 s ≈ 17 s rien qu'en envois)
  ok(duree < 9000, 'rapide : 4 photos en ' + (duree / 1000).toFixed(1) + ' s avec un réseau lent (avant : plus de 17 s)');
  ok(!errs.length, 'aucune erreur ' + errs.join(' | '));
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
