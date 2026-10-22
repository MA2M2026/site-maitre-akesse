// Administration quand la connexion est mauvaise ou coupée (22/10/2026, signalé par la propriétaire :
// « ça montre une page comme si c'était le code ») : le service worker (admin/sw.js) rangeait
// TOUTE adresse commençant par /admin sous la clé « /admin/ » — le fichier manifest.webmanifest
// remplaçait donc la page dans la copie de secours, et sans réseau on voyait ce texte JSON.
// Essai : première visite (copie faite), puis connexion coupée → la page de l'Administration
// doit revenir, pas le manifeste. Rien n'est envoyé : aucune connexion, serveur local.
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const PORT = String(9600 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore', stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // aucune base : les appels sortants sont coupés (la page de connexion suffit)
  await ctx.route(/supabase\.co|googletagmanager|google-analytics|sentry/, (r) => r.abort());
  const p = await ctx.newPage();
  const url = 'http://127.0.0.1:' + PORT + '/admin/';
  await p.goto(url); await p.waitForTimeout(2500);
  const actif = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; }).catch(() => false);
  ok(actif, 'copie de secours de l’Administration installée');
  // deuxième visite : la page et le manifeste passent par le service worker
  await p.reload(); await p.waitForTimeout(2500);
  await p.evaluate(() => fetch('/admin/manifest.webmanifest').then((r) => r.text())).catch(() => '');
  await p.waitForTimeout(800);
  if (process.env.DEBUG) console.log(await p.evaluate(async () => { const n = await caches.keys(); const c = await caches.open(n[0]); const r = await c.match('/admin/'); return n.join() + ' | ' + (r ? (await r.text()).slice(0, 80) : 'rien') + ' | contrôlée: ' + !!navigator.serviceWorker.controller; }));
  // connexion coupée : le serveur ne répond plus du tout
  srv.kill(); srv = null; await new Promise((r) => setTimeout(r, 500));
  // nouvelle adresse : la mémoire ordinaire du navigateur ne peut pas répondre, seule la copie de secours
  await p.goto(url + '?hors-ligne=1').catch(() => {}); await p.waitForTimeout(2000);
  if (process.env.DEBUG) console.log('adresse :', p.url());
  const page = await p.evaluate(() => ({ texte: document.body ? document.body.innerText.slice(0, 200) : '', html: !!document.querySelector('#app') }));
  ok(page.html && !/"short_name"|"start_url"|"icons"/.test(page.texte), 'connexion coupée : la page de l’Administration revient, pas le texte du manifeste (' + page.texte.replace(/\s+/g, ' ').slice(0, 60) + ')');
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
