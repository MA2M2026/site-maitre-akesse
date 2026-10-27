// Écran de connexion de l'application en plein écran (application installée, sans barre du navigateur).
const { chromium, devices } = require('playwright'); const { spawn } = require('child_process');
const RACINE = __dirname + '/../../';
const { brancher } = require(RACINE + 'scripts/tests-visiteur/faux-serveur');
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '9796'], { cwd: RACINE, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); await brancher(p, { tables: {}, rpc: {} }, []);
  await p.goto('http://127.0.0.1:9796/app/', { waitUntil: 'load' }); await p.waitForTimeout(2500);
  await p.evaluate(() => { const b = document.getElementById('ma2m-installer'); if (b) b.remove(); document.body.classList.remove('ma2m-installer-visible'); });
  await p.screenshot({ path: __dirname + '/ecran-appli.png' });
  await b.close(); srv.kill();
})();
