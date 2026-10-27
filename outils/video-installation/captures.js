// Captures de l'écran de l'application tel qu'un iPhone le montre (copie locale, base simulée vide).
const { chromium, devices } = require('playwright'); const { spawn } = require('child_process');
const T = __dirname + '/../wt11/';
const { brancher } = require(T + 'scripts/tests-visiteur/faux-serveur');
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '9792'], { cwd: T, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, plein] of [['android', 'a']]) {
    const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: plein === 'a' ? 760 : plein ? 844 : 690 }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    await brancher(p, { tables: {}, rpc: {} }, []);
    await p.goto('http://127.0.0.1:9792/app/', { waitUntil: 'load' }); await p.waitForTimeout(2500);
    await p.evaluate(() => { const b = document.getElementById('ma2m-installer'); if (b) b.remove(); document.body.classList.remove('ma2m-installer-visible'); });
    await p.screenshot({ path: __dirname + '/ecran-' + nom + '.png' });
    await ctx.close();
  }
  await b.close(); srv.kill();
})();
