// Les 6 étapes du profil d'une mannequin pas encore en ligne (07/11/2026, plainte de la propriétaire : sur certains
// téléphones les cases s'alignaient sur une ligne et « Récapitulatif » sortait de l'écran ; impossible de mettre son
// profil en ligne). Comme une vraie personne, base SIMULÉE, sur un petit téléphone ancien (320 px), un téléphone et une
// tablette ; et un navigateur ANCIEN simulé (sans grille CSS ni « gap ») :
//  - les 6 cases sont visibles en entier, 3 par ligne, rien ne dépasse sur le côté ;
//  - « Voir le récapitulatif et mettre mon profil en ligne » sous chaque étape mène au récapitulatif (« Soumettre »).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path');
const PORT = String(9840 + Math.floor(Math.random() * 30));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran, ancien] of [['petit téléphone 320 px', { width: 320, height: 640 }, false], ['téléphone', { width: 390, height: 844 }, false], ['tablette', { width: 820, height: 1180 }, false], ['vieux navigateur (sans grille ni gap), 360 px', { width: 360, height: 740 }, true]]) {
    const q = await (await b.newContext({ viewport: ecran, isMobile: ecran.width < 700, hasTouch: true })).newPage(); const errs = [], journal = [];
    q.on('pageerror', (e) => errs.push(e.message));
    await q.addInitScript((vieux) => {
      const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const exp = Math.floor(Date.now() / 1000) + 36000;
      const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
      localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'awa@test.ci' } }));
      // (vieux navigateur : la grille CSS et « gap » n'existent pas — leurs règles sont ignorées)
      if (vieux) document.addEventListener('DOMContentLoaded', () => { for (const f of document.styleSheets) { try { for (const r of f.cssRules) { if (r.style) { if (r.style.display === 'grid') r.style.removeProperty('display'); r.style.removeProperty('gap'); r.style.removeProperty('grid-template-columns'); } } } catch (e) { /* feuille illisible */ } } });
    }, ancien);
    await brancher(q, { tables: { model_profiles: [{ id: 'admin-1', full_name: 'AWA KONÉ', published: false, desactive: false }], model_photos: [] }, rpc: {} }, journal);
    await q.goto('http://127.0.0.1:' + PORT + '/app/espace-mannequin.html'); await q.waitForSelector('.stepper .step-tab', { timeout: 10000 }).catch(() => {});
    const cases = await q.$$eval('.stepper .step-tab', (l) => l.map((x) => { const r = x.getBoundingClientRect(); return { g: r.left, d: r.right, h: Math.round(r.top) }; }));
    const lignes = [...new Set(cases.map((c) => c.h))];
    ok(cases.length === 6 && cases.every((c) => c.g >= 0 && c.d <= innerWidthOf(ecran)) && lignes.length === 2, nom + ' : les 6 cases visibles en entier, sur 2 lignes de 3 (« Récapitulatif » compris)');
    ok(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), nom + ' : rien ne dépasse sur le côté');
    ok(await q.isVisible('.aller-recap button'), nom + ' : « Voir le récapitulatif et mettre mon profil en ligne » sous l’étape');
    await q.click('.aller-recap button'); await q.waitForTimeout(500);
    ok(/Récapitulatif/.test(await q.textContent('.panel')) && await q.$('#submitProfile') && !(await q.$('.aller-recap')), nom + ' : le bouton mène au récapitulatif, avec « Soumettre mon profil »');
    ok(!errs.length, nom + ' : aucune erreur ' + errs.join(' | '));
    await q.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
function innerWidthOf(e) { return e.width; }
