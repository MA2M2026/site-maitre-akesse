// Phase 3 V1 — le GESTE RÉEL d'un visiteur (08/11/2026, plainte de la propriétaire : « quand on appuie sur le menu, 3 à 4 s ») :
// menu → appui sur un élément → nouvelle page affichée. Heure de l'appui prise dans la page, heure d'affichage = premier
// affichage de la nouvelle page. Téléphone ; réseau « 4g » (normal) ou « 4g-lente ». Lecture seule.
//   node scripts/visiteur/geste-menu.mjs <adresse du site> [4g|4g-lente] [nombre de tours]
// (comparer deux versions : lancer la même commande sur les deux, dans les mêmes conditions)
import { createRequire } from 'module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
(async () => {
  const base = process.argv[2], reseau = process.argv[3] || '4g', tours = Number(process.argv[4] || 3);
  const b = await chromium.launch();
  const res = {};
  for (let t = 0; t < tours; t++) {
    const ctx = await b.newContext({ ...devices['Pixel 7'] });
    await ctx.addInitScript(() => {
      try { localStorage.setItem('ma2m_cookies', 'non'); } catch (e) {}
      document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#menuOverlay a[href]')) sessionStorage.setItem('__appui', String(performance.timeOrigin + performance.now())); }, true);
    });
    await ctx.route(/googletagmanager|google-analytics|sentry/, (r) => r.abort());
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    if (reseau === '4g-lente') await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    else await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 9 * 1024 * 1024 / 8, uploadThroughput: 3 * 1024 * 1024 / 8 });
    for (const [depart, cible] of [['/', 'actualites'], ['/actualites', 'evenements'], ['/evenements', 'mannequins'], ['/mannequins', 'qui-sommes-nous'], ['/qui-sommes-nous', 'agenda'], ['/agenda', 'contact']]) {
      await p.goto(base + depart, { waitUntil: 'load', timeout: 90000 }); await p.waitForTimeout(2500);
      await p.click('.menu-trigger'); await p.waitForTimeout(1600);
      await p.click('#menuOverlay a[href*="' + cible + '"]', { noWaitAfter: true });
      await p.waitForURL('**/' + cible + '**', { timeout: 30000 }).catch(() => {});
      await p.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0, null, { timeout: 30000 }).catch(() => {});
      const ms = await p.evaluate(() => { const f = performance.getEntriesByName('first-contentful-paint')[0]; const a = Number(sessionStorage.getItem('__appui')); return f && a ? Math.round(performance.timeOrigin + f.startTime - a) : null; });
      (res[depart + ' → ' + cible] = res[depart + ' → ' + cible] || []).push(ms);
    }
    await ctx.close();
  }
  const med = (l) => { const s = l.filter((x) => x != null).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  for (const [k, l] of Object.entries(res)) console.log(k.padEnd(32), 'médiane', String(med(l)).padStart(5), 'ms', JSON.stringify(l));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
