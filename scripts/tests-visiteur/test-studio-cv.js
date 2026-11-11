// Écran « Mon CV » de l'application (11/11/2026, maquette validée par la propriétaire), comme une vraie mannequin,
// sur téléphone : depuis Mon profil › Mon CV, la photo du CV touchée → la galerie → la photo part dans le Book ET
// devient la photo du CV ; la liste « Complet / À compléter » mène à la partie à remplir ; l'aperçu est le vrai CV ;
// « PDF » et « Image » téléchargent le CV. Base et stockage SIMULÉS : rien n'est écrit pour de vrai.
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
  await p.goto(BASE + '/app/espace-mannequin.html#cv'); await p.waitForSelector('.sc-studio', { timeout: 15000 }).catch(() => {});
  ok(/Mon CV/.test(await p.textContent('.sc-tete')) && (await p.$$('.scv-liste button')).length === 5 && /Complet|À compléter/.test(await p.textContent('.scv-liste')),
    'l’écran Mon CV : photo du CV, liste de ce que contient le CV avec « Complet / À compléter »');
  await p.waitForSelector('#scvApercu img', { timeout: 30000 }).catch(() => {});
  ok(!!(await p.$('#scvApercu img')), 'l’aperçu est l’image du vrai CV');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'rien ne dépasse de l’écran (390 px)');
  await p.setInputFiles('[data-scv-photo]', path.join(__dirname, 'medias/photo4.jpg'));
  await p.waitForSelector('.scv-vignette img', { timeout: 30000 }).catch(() => {});
  ok(!!(await p.$('.scv-vignette img')) && journal.some((j) => j[0] === 'POST' && j[1] === 'model_photos') && journal.some((j) => j[0] === 'PATCH' && j[1] === 'model_photos' && /"photo_cv":true/.test(j[3] || '')),
    'photo du CV choisie depuis la galerie : ajoutée au Book et devenue la photo du CV');
  const [pdf] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }).catch(() => null), p.click('#scvPdf')]);
  ok(pdf && /\.pdf$/.test(pdf.suggestedFilename()), '« PDF » : le CV téléchargé en PDF');
  const [img] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }).catch(() => null), p.click('#scvJpeg')]);
  ok(img && /\.jpg$/.test(img.suggestedFilename()), '« Image » : le CV téléchargé en image');
  if (img && process.env.CV_IMAGE) await img.saveAs(process.env.CV_IMAGE);
  await p.click('[data-scv-aller="physique"]'); await p.waitForTimeout(800);
  ok(!(await p.$('.sc-studio')) && /physique|mensurations/i.test(await p.textContent('#app')), '« Mensurations » touché : la partie à remplir s’ouvre');
  ok(!errs.length, 'aucune erreur ' + (errs.length ? JSON.stringify(errs.slice(0, 3)) : ''));
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  if (ko) process.exitCode = 1; await b.close(); srv.kill();
})();
