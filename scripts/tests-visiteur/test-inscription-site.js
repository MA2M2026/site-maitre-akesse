// (22/11/2026, demande de la propriétaire) l'Inscription est une page du SITE, comme les autres : en-tête avec le logo,
// le bouton de langue et le menu, bas de page, en français et en anglais, sur téléphone et ordinateur ; le parcours en
// 4 écrans (code personnel + date de naissance) s'affiche ; le menu du site y mène (plus vers l'application).
// Base SIMULÉE : rien n'est envoyé.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const PORT = String(9500 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [page, w, en] of [['/inscription-mannequin.html', 390, false], ['/inscription-mannequin.html', 1366, false], ['/en/inscription-mannequin.html', 390, true], ['/en/inscription-mannequin.html', 1366, true]]) {
    const n = page + ' (' + w + 'px) : ';
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 700, hasTouch: w < 700, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await p.goto('http://127.0.0.1:' + PORT + page); await p.waitForTimeout(2000);
    const r = await p.evaluate(() => ({
      logo: !!document.querySelector('.site-header-v2 a[href*="index"], .site-header-v2 img, .site-header-v2 svg'),
      langue: (document.querySelector('.site-header-v2') || {}).textContent || '',
      menu: !!document.querySelector('.menu-overlay a'),
      pied: !!document.querySelector('.site-footer a'),
      appli: !!document.querySelector('.ap-tete'),
      code: !!document.querySelector('#inn-ecran input'), date: !!document.querySelector('#inn-ecran input[type="date"]'), tel4: !!document.querySelector('#inn-tel4'),
      lienMenu: [...document.querySelectorAll('.menu-overlay a')].map((a) => a.getAttribute('href') || '').filter((h) => /inscription-mannequin/.test(h)),
      debord: document.documentElement.scrollWidth > innerWidth + 1
    }));
    ok(r.logo && r.menu && r.pied && !r.appli, n + 'en-tête, menu et bas de page du site (pas l’en-tête de l’application)');
    ok(en ? /FR/.test(r.langue) : /EN/.test(r.langue), n + 'bouton de langue présent');
    ok(r.code && r.date && r.tel4, n + 'le parcours d’inscription s’affiche (code personnel, date de naissance, 4 derniers chiffres du WhatsApp)');
    ok(!r.lienMenu.some((h) => /mannequin\.maitreakesse|\/app\//.test(h)), n + 'le menu mène à la page du site, plus à l’application (' + r.lienMenu.join(', ') + ')');
    ok(!r.debord, n + 'rien ne dépasse de l’écran');
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Inscription : page du site en français et en anglais');
  process.exit(ko ? 1 : 0);
})();
