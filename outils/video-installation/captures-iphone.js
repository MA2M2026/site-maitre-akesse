// Captures de l'iPhone pour la vidéo : la page ouverte depuis WhatsApp (barre rouge
// « Télécharger l'application » en bas) puis la fenêtre d'aide « Installer en 3 touches » (guideIOS, js/app.js).
const { chromium, devices } = require('playwright'); const { spawn } = require('child_process');
const RACINE = __dirname + '/../../';
const { brancher } = require(RACINE + 'scripts/tests-visiteur/faux-serveur');
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '9795'], { cwd: RACINE, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 690 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); await brancher(p, { tables: {}, rpc: {} }, []);
  await p.goto('http://127.0.0.1:9795/app/', { waitUntil: 'load' }); await p.waitForSelector('#ma2m-installer', { timeout: 15000 }); await p.waitForTimeout(800);
  await p.screenshot({ path: __dirname + '/iphone-page-barre.png' });
  await p.click('#ma2m-installer .ma2m-installer-ouvrir'); await p.waitForSelector('#ma2m-guide'); await p.waitForTimeout(700);
  await p.screenshot({ path: __dirname + '/iphone-guide.png' });
  await b.close(); srv.kill();
})();
