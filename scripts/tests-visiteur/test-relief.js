// « Site en relief » sur The Book (js/relief.js, css/relief.css ; 08/11/2026, phase 3 V3), comme un vrai visiteur
// sur téléphone et ordinateur, FR et EN, base SIMULÉE :
//  - animations permises : le relief démarre APRÈS l'affichage complet ; les photos penchent au défilement, se
//    tournent vers la souris (ordinateur) ; les photos à l'écran respirent, les autres sont en pause ;
//  - aucun saut d'affichage (score de stabilité) ; défilement fluide (images par seconde, processeur ralenti) ;
//  - coupé si : moins d'animations demandé, économie de données, connexion lente, peu de mémoire ;
//  - sans JavaScript : les cartes sont là quand même (page écrite pour tous).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9600 + Math.floor(Math.random() * 90));
const BASE = 'http://127.0.0.1:' + PORT + '/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const profils = Array.from({ length: 24 }, (_, i) => ({ id: '00000000-0000-0000-0000-0000000000' + String(i).padStart(2, '0'), full_name: 'Mannequin ' + i, city: 'Abidjan', category: i % 2 ? 'homme' : 'femme', height_cm: 170 + i, published: true }));
const photos = profils.map((m, i) => ({ id: 'p' + i, model_id: m.id, url: '/icons/apple-touch-icon.png', url_miniature: '/icons/apple-touch-icon.png', principale: true }));

async function ouvrir(b, page, o) {
  const tel = o.tel;
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1366, height: 900 }, isMobile: tel, hasTouch: tel, reducedMotion: o.reduit ? 'reduce' : 'no-preference', javaScriptEnabled: !o.sansJs });
  const p = await ctx.newPage(); const errs = [], css = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('request', (r) => { if (/relief\.css/.test(r.url())) css.push(r.url()); });
  await p.addInitScript((o) => {
    window.__score = 0;
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__score += e.value; })).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
    if (o.saveData || o.lent) Object.defineProperty(navigator, 'connection', { value: { saveData: !!o.saveData, effectiveType: o.lent ? '2g' : '4g' } });
    if (o.memoire) Object.defineProperty(navigator, 'deviceMemory', { value: o.memoire });
  }, o);
  await brancher(p, { tables: { model_profiles: profils, model_photos: photos }, rpc: {} }, []);
  await p.goto(BASE + page, { waitUntil: 'load' }); await p.waitForTimeout(2500);
  return { ctx, p, errs, css };
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [page, tel] of [['mannequins.html', true], ['mannequins.html', false], ['en/mannequins.html', true]]) {
    const n = (tel ? 'téléphone' : 'ordinateur') + (page.startsWith('en/') ? ' EN' : '') + ' : ';
    // 1. animations permises
    const e = await ouvrir(b, page, { tel }); const p = e.p;
    const cartes = await p.$$eval('#grille .medaillon-carte', (l) => l.length);
    ok(cartes === 24 && await p.evaluate(() => document.documentElement.classList.contains('relief')) && e.css.length === 1, n + 'relief en marche après l’affichage (' + cartes + ' cartes, styles chargés une fois)');
    // (sauts du chargement lui-même mis à part : ce petit serveur d'essai n'écrit pas la page d'avance comme le vrai ;
    // le chargement réel est mesuré à part, avant / après, sur la page écrite par le serveur)
    await p.evaluate(() => { window.__score = 0; });
    const avant = await p.$eval('#grille .medaillon-photo', (x) => getComputedStyle(x).transform);
    await p.mouse.wheel(0, 500); await p.waitForTimeout(700);
    const angles = await p.$$eval('#grille .medaillon-photo.relief-vue', (l) => l.map((x) => x.style.getPropertyValue('--relief-sx')));
    ok(angles.length > 0 && new Set(angles).size > 1 && angles.every((a) => Math.abs(parseFloat(a)) <= 8.5), n + 'au défilement, les photos penchent selon leur place dans l’écran (' + angles.slice(0, 4).join(', ') + ')');
    const anim = await p.evaluate(() => { const vues = [...document.querySelectorAll('#grille .medaillon-photo')]; const a = (x) => getComputedStyle(x.querySelector('img')).animationPlayState;
      return { vue: vues.filter((x) => x.classList.contains('relief-vue')).map(a), hors: vues.filter((x) => !x.classList.contains('relief-vue')).map(a) }; });
    ok(anim.vue.length && anim.vue.every((s) => s === 'running') && anim.hors.every((s) => s === 'paused'), n + 'les photos à l’écran respirent, les autres sont en pause (' + anim.vue.length + ' / ' + anim.hors.length + ')');
    if (!tel) {
      const c = await p.$('#grille .medaillon-photo.relief-vue'); const r = await c.boundingBox();
      await p.mouse.move(r.x + r.width * 0.9, r.y + r.height * 0.2); await p.waitForTimeout(500);
      const ry = await c.evaluate((x) => parseFloat(x.style.getPropertyValue('--relief-ry'))), tr = await c.evaluate((x) => getComputedStyle(x).transform);
      ok(ry > 3 && tr !== avant && tr !== 'none', n + 'sous la souris, la photo se tourne vers elle (' + ry + '°)');
      await p.mouse.move(5, 5); await p.waitForTimeout(500);
      ok(await c.evaluate((x) => x.style.getPropertyValue('--relief-ry')) === '0deg', n + 'la souris partie, la photo se remet droite');
    }
    // fluidité : processeur ralenti 4 fois (téléphone moyen), défilement continu pendant 2 s
    const cdp = await e.ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const ips = await p.evaluate(() => new Promise((fin) => {
      let images = 0, t0 = performance.now(), y = 0;
      const pas = () => { images++; y += 12; window.scrollTo(0, y % (document.body.scrollHeight - innerHeight)); if (performance.now() - t0 < 2000) requestAnimationFrame(pas); else fin(images / ((performance.now() - t0) / 1000)); };
      requestAnimationFrame(pas);
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    ok(ips >= 50, n + 'défilement fluide, processeur ralenti 4 fois : ' + ips.toFixed(0) + ' images par seconde (≥ 50)');
    const score = await p.evaluate(() => window.__score);
    ok(score < 0.01, n + 'relief en marche, défilement, souris : aucun saut d’affichage (score ' + score.toFixed(4) + ')');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran (cartes penchées comprises)');
    ok(!e.errs.length, n + 'aucune erreur de page ' + e.errs.join(' | '));
    await e.ctx.close();
    // 2. coupé quand il le faut : la page reste celle d'avant, les styles ne sont même pas demandés
    for (const [cas, o] of [['moins d’animations demandé', { reduit: true }], ['économie de données', { saveData: true }], ['connexion lente', { lent: true }], ['peu de mémoire (2 Go)', { memoire: 2 }]]) {
      const f = await ouvrir(b, page, Object.assign({ tel }, o));
      ok(!(await f.p.evaluate(() => document.documentElement.classList.contains('relief'))) && !f.css.length && (await f.p.$$('#grille .medaillon-carte')).length === 24 && !f.errs.length, n + cas + ' : pas de relief, page normale');
      await f.ctx.close();
    }
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
