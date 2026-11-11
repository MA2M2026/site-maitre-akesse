// Écran « Ma compcard » de l'application (11/11/2026, maquette validée par la propriétaire), comme une vraie
// mannequin, sur téléphone : depuis Mon profil › Compcard, les 5 cases (1 principale), une case vide touchée → la
// galerie → la photo part dans le Book ET prend la case (3 / 5 → 4 / 5) ; « Voir ma compcard » ; « PDF » et
// « Image » téléchargent la compcard. Base et stockage SIMULÉS : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  const PORT = String(9300 + Math.floor(Math.random() * 90)), BASE = 'http://127.0.0.1:' + PORT;
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [], journal = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => {
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 36000;
    const j = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
    localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: j, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'aya@test.ci' } }));
  });
  const photo = (i) => '/scripts/tests-visiteur/medias/photo' + i + '.jpg';
  await brancher(p, { memoriser: true, tables: {
    model_profiles: [{ id: 'admin-1', full_name: 'AYA KOUASSI', category: 'femme', published: true, premiere_publication_faite: true, height_cm: 178, chest_cm: 84, waist_cm: 61, hips_cm: 90, city: 'Abidjan', desactive: false }],
    model_photos: [1, 2, 3].map((i) => ({ id: 'ph' + i, model_id: 'admin-1', url: photo(i), url_miniature: photo(i), chemin: 'admin-1/' + i + '.jpg', compcard_ordre: i, principale: i === 1, created_at: '2026-09-0' + i + 'T10:00:00Z' })) }, rpc: {} }, journal);
  await p.route(/\/api\/r2-presigner/, (r) => { const c = JSON.parse(r.request().postData() || '{}');
    if (c.action === 'verifier') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uploadUrl: BASE + '/__stockage', publicUrl: BASE + photo(4) }) }); });
  await p.route(/__stockage/, (r) => r.fulfill({ status: 200, body: '' }));
  await p.goto(BASE + '/app/espace-mannequin.html#compcard'); await p.waitForSelector('.sc-studio', { timeout: 15000 }).catch(() => {});
  ok(await p.$$eval('.sc-case', (l) => l.length) === 5 && /PRINCIPALE/.test(await p.textContent('.sc-case-1')) && /3 \/ 5/.test(await p.textContent('.sc-prog')),
    'les 5 cases, la 1 « Principale », 3 photos sur 5 déjà choisies');
  ok(await p.$$eval('.sc-case.pleine img', (l) => l.length) === 3 && /Plein pied|Profil|Mouvement|Libre/.test(await p.textContent('.sc-case-4')),
    'cases remplies avec leur photo et « Changer », cases vides avec « ＋ » et leur nom');
  ok(await p.evaluate(() => { const r = document.querySelector('.sc-studio').getBoundingClientRect(); return r.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }), 'rien ne dépasse de l’écran (390 px)');
  // case 4 touchée : la galerie, puis la photo rejoint le Book et prend la case
  await p.setInputFiles('[data-sc-case="4"]', path.join(__dirname, 'medias/photo4.jpg'));
  // (11/11/2026, captures de la propriétaire) plus de rectangle blanc en haut à droite pendant l'envoi : seule la barre du bas
  await p.waitForSelector('.barre-envoi', { timeout: 5000 }).catch(() => {});
  ok(!!(await p.$('.barre-envoi')) && !(await p.$$eval('.toast', (l) => l.some((t) => /Envoi de la photo/.test(t.textContent)))),
    'envoi d’une photo : seulement la barre « Envoi de la photo… » en bas, plus de message en haut à droite');
  if (process.env.CAPTURES) await p.screenshot({ path: path.join(process.env.CAPTURES, 'compcard-envoi.png') });
  await p.waitForFunction(() => /4 \/ 5/.test((document.querySelector('.sc-prog') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
  ok(/4 \/ 5/.test(await p.textContent('.sc-prog')) && !!(await p.$('.sc-case-4.pleine img')), 'case 4 remplie depuis la galerie : 4 / 5');
  ok(journal.some((j) => j[0] === 'POST' && j[1] === 'model_photos') && journal.some((j) => j[0] === 'PATCH' && j[1] === 'model_photos' && /"compcard_ordre":4/.test(j[3] || '')),
    'la photo est ajoutée au Book et reçoit la case 4');
  // aperçu, PDF, image
  await p.click('#scVoir'); await p.waitForTimeout(800);
  ok(await p.isVisible('.compcard-model'), '« Voir ma compcard » : l’aperçu de la vraie compcard');
  await p.click('#closeOv').catch(() => {}); await p.waitForTimeout(300);
  const [pdf] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }).catch(() => null), p.click('#scPdf')]);
  ok(pdf && /\.pdf$/.test(pdf.suggestedFilename()), '« PDF » : la compcard téléchargée en PDF');
  const [img] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }).catch(() => null), p.click('#scJpeg')]);
  ok(img && /\.jpg$/.test(img.suggestedFilename()), '« Image » : la compcard téléchargée en image');
  ok((await p.getAttribute('.sc-retour', 'href')) === '/app/#profil', '« ‹ » ramène à Mon profil');
  ok(!errs.length, 'aucune erreur ' + (errs.length ? JSON.stringify(errs.slice(0, 3)) : ''));
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  if (ko) process.exitCode = 1; await b.close(); srv.kill();
})();
