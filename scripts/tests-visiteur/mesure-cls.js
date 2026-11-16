// Mesure du « contenu qui saute » (CLS) au chargement, comme un visiteur sur téléphone en 4G lente (audit L-9).
// Usage : node mesure-cls.js [pages séparées par des virgules]. Base simulée ; affiche le CLS et les éléments qui bougent.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const chemin = require('path');
const PAGES = (process.argv[2] || 'integrer-agence.html,cours-talons.html,candidature.html,en/integrer-agence.html,en/cours-talons.html,en/candidature.html').split(',');
const PORT = String(9500 + Math.floor(Math.random() * 60));
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch(); const resultats = [];
  for (const page of PAGES) for (const ecran of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
    const tel = ecran.width < 700;
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ }
      window.__cls = 0; window.__sauts = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value;
        window.__sauts.push([Math.round(e.value * 1000) / 1000, (e.sources || []).map((s) => s.node ? (s.node.id ? '#' + s.node.id : (s.node.className && typeof s.node.className === 'string' ? '.' + s.node.className.split(' ')[0] : s.node.nodeName)) : '?').join(' ')]); } })
        .observe({ type: 'layout-shift', buffered: true });
    });
    await brancher(p, { tables: { castings: [], agenda_projets: [] }, rpc: {} }, []);
    const cdp = await ctx.newCDPSession(p);
    if (tel) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: tel ? 4 : 1 });
    await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(4000);
    const r = await p.evaluate(() => ({ cls: Math.round(window.__cls * 1000) / 1000, sauts: window.__sauts.filter((s) => s[0] >= 0.01).slice(0, 6) }));
    resultats.push([page, ecran.width, r.cls, r.sauts]);
    console.log(page + ' ' + ecran.width + 'px : CLS ' + r.cls + '  ' + JSON.stringify(r.sauts));
    await ctx.close();
  }
  await b.close(); srv.kill();
})();
