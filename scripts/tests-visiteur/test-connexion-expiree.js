// « Tout est 0 » dans Candidatures (capture de la propriétaire, 12/11/2026) : sa connexion avait expiré, la base ne
// montrait plus rien, sans erreur. Base SIMULÉE. On vérifie :
//  - connexion valable et vraiment aucune candidature : pas d'alerte (seulement « 0 au total ») ;
//  - connexion expirée (plus de session) : « Votre connexion a expiré » + bouton « Se reconnecter », au lieu des faux 0.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const PORT = String(9300 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const d = donnees('principal'); d.tables.casting_applications = []; d.tables.casting_photos = [];
  await brancher(p, d, []); await photosLocales(p);
  await seConnecter(p, 'http://127.0.0.1:' + PORT + '/admin/'); await p.waitForTimeout(1200);
  await p.goto('http://127.0.0.1:' + PORT + '/admin/#/site/b2-candidatures'); await p.waitForSelector('.etude-lancer', { timeout: 15000 }).catch(() => {});
  ok(/0 au total/.test(await p.textContent('#contenu')) && !(await p.$('#contenu .note.erreur [data-action="deconnexion"]')), 'connexion valable, aucune candidature : « 0 au total », sans alerte');
  // la connexion expire : la base ne renvoie plus rien
  await p.evaluate(() => { sb.auth.getSession = async () => ({ data: { session: null }, error: null }); return window.Portail.afficher(); });
  await p.waitForTimeout(1500);
  const t = await p.textContent('#contenu');
  ok(/Votre connexion a expiré/.test(t) && /données sont intactes/.test(t) && !!(await p.$('#contenu .note.erreur [data-action="deconnexion"]')), 'connexion expirée : « Votre connexion a expiré » et « Se reconnecter » au lieu des faux 0');
  ok(!errs.length, 'aucune erreur de page ' + errs.join(' | '));
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Connexion expirée : tout passe');
  process.exit(ko ? 1 : 0);
})();
