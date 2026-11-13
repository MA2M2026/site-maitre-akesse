// L'espace mannequin (profil, compcard, CV) s'ouvre vite même avec une base lente (13/11/2026, revue de nuit : 7,5 s,
// 13 lectures l'une après l'autre ; désormais lancées ensemble). Base SIMULÉE où CHAQUE réponse met 400 ms : l'ancienne
// façon prenait plus de 5 s ; on exige moins de 3,5 s jusqu'à l'affichage, et les lectures du profil doivent se chevaucher.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path');
const PORT = String(9870 + Math.floor(Math.random() * 20));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, page] of [['profil', '/app/espace-mannequin.html'], ['compcard', '/app/espace-mannequin.html#compcard']]) {
    const q = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage(); const errs = [], journal = [];
    q.on('pageerror', (e) => errs.push(e.message));
    await q.addInitScript(() => {
      const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const exp = Math.floor(Date.now() / 1000) + 36000;
      const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'm-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
      localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'm-1', aud: 'authenticated', role: 'authenticated', email: 'm@test.ci' } }));
    });
    await brancher(q, { tables: { model_profiles: [{ id: 'm-1', full_name: 'AWA KONÉ', published: false, desactive: false }], model_photos: [], model_projects: [] }, rpc: {} }, journal);
    // chaque requête vers la base attend 400 ms (base lente), et on note quand elle part et quand elle revient
    const vols = [];
    await q.route(/supabase\.co\/rest\//, async (route) => { const debut = Date.now(); await new Promise((r) => setTimeout(r, 400)); vols.push([debut, Date.now()]); return route.fallback(); });
    const t0 = Date.now();
    await q.goto('http://127.0.0.1:' + PORT + page);
    await q.waitForFunction(() => !/Chargement de votre espace/.test(document.body.innerText) && document.body.innerText.trim().length > 50, null, { timeout: 20000 }).catch(() => {});
    const duree = Date.now() - t0;
    // le plus grand nombre de lectures en vol en même temps
    let max = 0; vols.forEach(([d]) => { max = Math.max(max, vols.filter(([a, z]) => a <= d && d < z).length); });
    ok(duree < 3500, nom + ' : affiché en ' + (duree / 1000).toFixed(1) + ' s avec une base lente (moins de 3,5 s ; avant : plus de 5 s)');
    ok(max >= 6, nom + ' : les lectures du profil partent ensemble (' + max + ' en même temps)');
    ok(!errs.length, nom + ' : aucune erreur de page ' + errs.join(' | '));
    await q.context().close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ espace mannequin rapide : tout est bon'); process.exit(ko ? 1 : 0);
})();
