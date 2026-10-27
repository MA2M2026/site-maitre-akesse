const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + __dirname + '/film2.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
  const IPS = 30, N = Math.ceil(await p.evaluate(() => window.DUREE) * IPS);
  for (let i = 0; i < N; i++) {
    await p.evaluate((x) => window.rendre(x), i / IPS);
    await p.screenshot({ path: __dirname + '/frames/f' + String(i).padStart(5, '0') + '.jpg', type: 'jpeg', quality: 94 });
    if (i % 150 === 0) console.log('image', i, '/', N);
  }
  await b.close();
})();
