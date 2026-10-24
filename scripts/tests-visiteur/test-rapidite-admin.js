// Rapidité de l'Administration (23/10/2026 : la propriétaire la trouvait lente quand on rafraîchit
// une page) : connexion d'Abidjan simulée (150 ms par requête), chaque espace est rafraîchi puis
// rouvert depuis l'accueil ; l'écran doit être prêt (vrai contenu, pas la page « n'a pas pu être
// chargée ») en moins de 3 s (rafraîchi) et 1,5 s (ouvert). Les questions à la base attendent
// aussi 150 ms : un écran qui les pose l'une après l'autre se voit.
// Base simulée : rien n'est écrit.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const admin = require('./donnees-nouvelle-admin');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PORT = String(9500 + Math.floor(Math.random() * 90)); const BASE = 'http://127.0.0.1:' + PORT + '/';
let srv; process.on('exit', () => srv && srv.kill());
(async () => {
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  // chaque requête vers le site attend 150 ms (aller-retour Abidjan ↔ serveur)
  await p.route(/127\.0\.0\.1/, async (r) => { await new Promise(x => setTimeout(x, 150)); r.fallback(); });
  const d = admin.donnees('principal'); await brancher(p, d, []); await admin.photosLocales(p);
  // (après le faux serveur : ce délai passe en premier, puis la réponse simulée de la base)
  await p.route(/dfhghgmwmxiguhtxtsle\.supabase\.co\/rest\//, async (r) => { await new Promise(x => setTimeout(x, 150)); r.fallback(); });
  // règle de sécurité stricte de l'Administration, posée par le serveur comme en ligne (vercel.json,
  // 24/10/2026) : aucun programme écrit dans la page ; écrite DANS la page, elle ralentissait tout
  // (le navigateur ne préchargeait plus les programmes : 5,5 s au lieu de 1,2 s)
  // (posée par admin.seConnecter, donnees-nouvelle-admin.js)
  const refus = []; p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) refus.push(m.text().slice(0, 160)); });
  await admin.seConnecter(p, BASE + 'admin/'); await p.waitForSelector('.accueil-tete', { timeout: 30000 });
  for (const h of (process.argv[2] || '#/site/b2-candidatures,#/site/b2-mannequins-publies,#/site/b2-convocations,#/site/b2-places,#/paiements/tableau,#/compta/mois,#/compta/cachets').split(',')) {
    await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(3000);
    const t0 = Date.now(); await p.reload();
    await p.waitForFunction(() => { const c = document.querySelector('#contenu'); return c && c.querySelector('h1, h2') && !/Chargement/.test(c.textContent.slice(0, 80)) && !/pas pu être chargée/.test(c.textContent); }, null, { timeout: 60000 });
    const t = (Date.now() - t0) / 1000; ok(t < 3, h + ' : rafraîchi en ' + t.toFixed(1) + ' s');
    const t1 = Date.now(); await p.evaluate(() => { location.hash = '#/'; }); await p.waitForSelector('.accueil-tete'); await p.evaluate((x) => { location.hash = x; }, h);
    await p.waitForFunction(() => { const c = document.querySelector('#contenu'); return c && c.querySelector('h1, h2') && !/Chargement/.test(c.textContent.slice(0, 80)) && !/pas pu être chargée/.test(c.textContent); }, null, { timeout: 60000 });
    const u = (Date.now() - t1) / 1000; ok(u < 1.5, h + ' : ouvert depuis l’accueil en ' + u.toFixed(1) + ' s');
  }
  ok(!refus.length, 'règle de sécurité stricte : rien de bloqué ' + refus.slice(0, 2).join(' | '));
  await b.close(); srv.kill();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
