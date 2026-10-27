const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('requestfailed', (r) => errs.push('manque ' + r.url()));
  await p.goto('file://' + __dirname + '/' + (process.argv[3] || 'film.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  for (const u of JSON.parse(process.argv[2])) { await p.evaluate((x) => window.rendre(x), u); await p.screenshot({ path: __dirname + '/ap-' + u + '.jpg', type: 'jpeg', quality: 70 }); }
  console.log('erreurs', errs); await b.close();
})();
