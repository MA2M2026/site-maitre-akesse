// Captures pour la vidéo v4 (28/10/2026) : l'application des mannequins telle qu'elle est
// aujourd'hui (rouge mat), ouverte depuis WhatsApp. iPhone : page + barre rouge, puis la nouvelle
// aide (nouveau Safari, sans flèche). Android : page sous la barre de Chrome. Base simulée.
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const RACINE = __dirname + '/../../';
const { brancher } = require(RACINE + 'scripts/tests-visiteur/faux-serveur');
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '9796'], { cwd: RACINE, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  async function page(ua, hauteur) {
    const ctx = await b.newContext({ viewport: { width: 390, height: hauteur }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: ua, serviceWorkers: 'block' });
    const p = await ctx.newPage(); await brancher(p, { tables: {}, rpc: {} }, []);
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.goto('http://127.0.0.1:9796/app/', { waitUntil: 'load' }); await p.waitForSelector('#ma2m-installer', { timeout: 15000 }); await p.waitForTimeout(900);
    return p;
  }
  let p = await page(IOS, 690);   // sous la barre d'adresse du bas de Safari (112 px) et la barre d'état (50 px)
  await p.screenshot({ path: __dirname + '/v4-iphone-page.png' });
  await p.click('#ma2m-installer .ma2m-installer-ouvrir'); await p.waitForSelector('#ma2m-guide'); await p.waitForTimeout(900);
  await p.screenshot({ path: __dirname + '/v4-iphone-guide.png' });
  p = await page(AND, 764);       // sous la barre d'état (32 px) et la barre de Chrome (56 px)
  await p.screenshot({ path: __dirname + '/v4-android-page.png' });
  await b.close(); srv.kill();
})();
