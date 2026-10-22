// Menu au clavier (20/10/2026, visite sur ordinateur) : menu ouvert, la touche Tab partait sur
// les liens de la page cachée derrière. Désormais le focus entre dans le menu, y reste (Tab et
// Maj+Tab tournent sur ses liens), Échap le ferme et le focus revient au bouton « Menu »
// (js/menu.js). Ordinateur, FR et EN. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { tables, rpc } = require('./pages-publiques');
const PORT = String(8900 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const page of ['qui-sommes-nous.html', 'en/mannequins.html']) {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables, rpc }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    if (await p.isVisible('#bandeau-cookies [data-cookies="non"]')) await p.click('#bandeau-cookies [data-cookies="non"]');
    await p.focus('.menu-trigger'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
    const dansMenu = () => p.evaluate(() => !!document.activeElement.closest('.menu-overlay'));
    const entre = await dansMenu();
    let resteDedans = true;
    for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); if (!(await dansMenu())) { resteDedans = false; break; } }
    for (let i = 0; i < 5; i++) { await p.keyboard.press('Shift+Tab'); if (!(await dansMenu())) { resteDedans = false; break; } }
    ok(entre && resteDedans, page + ' : menu ouvert au clavier, Tab et Maj+Tab restent dans le menu');
    await p.keyboard.press('Escape'); await p.waitForTimeout(500);
    const retour = await p.evaluate(() => document.activeElement.classList.contains('menu-trigger') && !document.querySelector('.menu-overlay').classList.contains('active'));
    ok(retour, page + ' : Échap ferme le menu, le focus revient au bouton « Menu »');
    ok(!errs.length, page + ' : aucune erreur ' + errs.join(' | '));
    await p.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
