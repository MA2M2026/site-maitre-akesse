// Surveillance des erreurs (js/surveillance.js), grande revue du 12/11/2026 : quand la base demande le code à 6 chiffres
// avant une action sensible (réponse « AUTH_RECENTE »), l'Administration affiche la demande de code et recommence : ce
// n'est PAS une panne, rien ne doit partir dans le journal des erreurs. Une vraie requête en échec, elle, est toujours
// signalée. Base simulée, aucune écriture réelle.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const PORT = String(9300 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch(); const journal = [];
  // (un vrai téléphone : la surveillance ignore les robots et les navigateurs automatiques)
  const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' });
  const p = await ctx.newPage();
  await p.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  await p.route('https://dfhghgmwmxiguhtxtsle.supabase.co/**', (route) => {
    const u = route.request().url();
    if (/journal_erreurs/.test(u)) { journal.push(route.request().postData() || ''); return route.fulfill({ status: 201, body: '' }); }
    if (/rpc\/action_sensible/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'P0001', message: "AUTH_RECENTE: confirmez votre code de l'application d'authentification pour cette action." }) });
    if (/rpc\/vraie_panne/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: '42703', message: 'column "genre" does not exist' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await p.goto('http://127.0.0.1:' + PORT + '/contact.html'); await p.waitForTimeout(1500);
  await p.evaluate(() => fetch('https://dfhghgmwmxiguhtxtsle.supabase.co/rest/v1/rpc/action_sensible', { method: 'POST' }).catch(() => null));
  await p.waitForTimeout(2500);
  ok(!journal.some((j) => /action_sensible|AUTH_RECENTE/.test(j)), 'demande du code à 6 chiffres (AUTH_RECENTE) : rien dans le journal des erreurs');
  await p.evaluate(() => fetch('https://dfhghgmwmxiguhtxtsle.supabase.co/rest/v1/rpc/vraie_panne', { method: 'POST' }).catch(() => null));
  await p.waitForTimeout(2500);
  ok(journal.some((j) => /vraie_panne/.test(j)), 'une vraie requête en échec est toujours signalée');
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
