// L-18 (c) (17/11/2026, demande de la propriétaire) : bouton « Supprimer » d'une inscription au cours de talons, dans
// l'Administration, comme l'agence, sur téléphone et ordinateur, base SIMULÉE (rien n'est supprimé pour de vrai) :
//  - administrateur principal : bouton visible ; après confirmation, l'inscription part de la base (DELETE), PUIS ses
//    photos Cloudflare sont effacées par le serveur ; la liste se met à jour ;
//  - SQL pas encore collé (la base refuse : 0 ligne supprimée) : message clair, rien d'effacé chez Cloudflare ;
//  - rôle « site » : aucun bouton Supprimer.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, seConnecter, photosLocales } = require('./donnees-nouvelle-admin');
const PORT = String(9300 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const ID = '9b2f6c1e-1111-4a11-8a11-123456789abc', CT = 'cours-talons/' + ID + '/' + 'c'.repeat(32) + '.jpg';

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran, role, baseRefuse] of [['téléphone', { width: 390, height: 844 }, 'principal', false], ['ordinateur', { width: 1366, height: 900 }, 'principal', false],
    ['ordinateur, SQL pas encore collé', { width: 1366, height: 900 }, 'principal', true], ['téléphone, rôle « site »', { width: 390, height: 844 }, 'site', false]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [], effaces = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (dl) => dl.accept());
    const d = donnees(role);
    d.memoriser = true;
    d.tables.cours_talons = [
      { id: ID, cree_le: '2026-11-16T10:00:00Z', formule: 'groupe', nb_seances: 4, nom: 'AYA À SUPPRIMER', telephone: '+2250700000009', age: 22,
        photos: ['r2:' + CT], decision: 'plus_tard', statut: 'plus_tard', montant: 30000 },
      { id: 't-garde', cree_le: '2026-11-15T10:00:00Z', formule: 'groupe', nb_seances: 4, nom: 'AYA GARDÉE', telephone: '+2250700000010', age: 25,
        photos: [], decision: 'plus_tard', statut: 'plus_tard', montant: 30000 }];
    d.tables.cours_talons_seances = []; d.tables.cours_talons_indispo = [];
    await brancher(p, d, journal); await photosLocales(p);
    if (baseRefuse) await p.route(/\/rest\/v1\/cours_talons\?/, (r) => (r.request().method() === 'DELETE' ? r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }) : r.fallback()));
    await p.route('**/api/r2-presigner', async (route) => {
      const c = JSON.parse(route.request().postData() || '{}');
      if (c.action === 'candidature_lire') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ adresses: Object.fromEntries(c.chemins.map((x) => [x, 'https://photos.maitreakessemodelmanagement.com/m0/' + x + '?signature=x'])) }) });
      if (c.action === 'candidature_supprimer') { effaces.push(...(c.chemins || [c.chemin])); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
      return route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
    });
    await seConnecter(p, URL_ADMIN); await p.waitForSelector(role === 'principal' ? '.accueil-tete' : '.coque:not(.sans-menu)');
    await p.goto(URL_ADMIN + '#/site/b2-cours-talons'); await p.waitForSelector('.ct-fiche', { timeout: 10000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.ct-fiche').forEach((f) => { if (f.closest('details')) f.closest('details').open = true; }));
    const bouton = p.locator('.ct-fiche[data-id="' + ID + '"] [data-action="talons-supprimer"]');
    if (role !== 'principal') {
      ok(!(await bouton.count()), n + 'aucun bouton « Supprimer » pour le rôle « site »');
    } else {
      ok(await bouton.count() === 1, n + 'bouton « Supprimer » visible pour l’administrateur principal');
      await bouton.click();
      await p.waitForTimeout(1500);
      const ordre = journal.filter((j) => j[0] === 'DELETE' && j[1] === 'cours_talons');
      const reste = d.tables.cours_talons.map((x) => x.id);
      const message = await p.evaluate(() => document.body.innerText);
      if (!baseRefuse) {
        ok(ordre.length === 1 && !reste.includes(ID) && reste.includes('t-garde'), n + 'l’inscription est supprimée de la base, l’autre reste');
        ok(effaces.length === 1 && effaces[0] === CT, n + 'PUIS ses photos Cloudflare sont effacées (' + effaces.join(', ') + ')');
        ok(!(await p.locator('.ct-fiche[data-id="' + ID + '"]').count()), n + 'elle disparaît de la liste');
      } else {
        ok(reste.includes(ID) && !effaces.length && /supabase-l18-supprimer-talons\.sql/.test(message), n + 'base qui refuse : rien d’effacé chez Cloudflare, message clair');
      }
    }
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Suppression d’une inscription au cours de talons');
  process.exit(ko ? 1 : 0);
})();
