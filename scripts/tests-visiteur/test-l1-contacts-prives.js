// Audit L-1 partie 2 (16/11/2026) : contacts des parents cachés à l'« Administrateur du site ».
// Base SIMULÉE comme la vraie base après supabase-l1-contacts-prives.sql : les colonnes privées ne viennent plus avec
// la liste (colonnes_lisibles), et dossiers_prives ne les rend qu'au principal. On vérifie, sur téléphone et ordinateur :
//  - l'Administration ne demande plus jamais « toutes les colonnes » (select=*) des candidatures ;
//  - rôle « site » : ni téléphone ni e-mail du parent d'une mineure, et JAMAIS le numéro de la mineure à la place ;
//  - principal : les contacts du parent reviennent (fonction contrôlée), WhatsApp vers le parent.
// Rien n'est écrit ni envoyé pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const PORT = String(9300 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PRIVEES = ['parent_telephone', 'parent_email'];

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const role of ['site', 'principal']) {
    for (const ecran of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
      const tel = ecran.width < 700, n = 'rôle « ' + role + ' » ' + (tel ? 'téléphone' : 'ordinateur') + ' : ';
      const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
      const p = await ctx.newPage(); const errs = [], journal = [], etoiles = [];
      p.on('pageerror', (e) => errs.push(e.message));
      p.on('dialog', (dl) => dl.accept());
      p.on('request', (r) => { const u = r.url(); if (/\/rest\/v1\/casting_applications\?/.test(u) && r.method() === 'GET' && /[?&]select=\*(&|$)/.test(u)) etoiles.push(u); });
      const d = donnees(role);
      const prives = {};
      d.tables.casting_applications = d.tables.casting_applications.map((l) => {
        prives[l.id] = {}; const reste = {};
        Object.keys(l).forEach((k) => { if (PRIVEES.includes(k)) prives[l.id][k] = l[k]; else reste[k] = l[k]; });
        return reste;
      });
      const colonnes = [...new Set(d.tables.casting_applications.flatMap((l) => Object.keys(l)))];
      d.rpc = Object.assign({}, d.rpc, {
        colonnes_lisibles: (c) => c.p_table === 'casting_applications' ? colonnes : [],
        dossiers_prives: (c) => role === 'site' ? {} : Object.fromEntries((c.p_ids || []).map((id) => [id, Object.assign({ parent_telephone: null, parent_email: null }, prives[id] || {})]))
      });
      await brancher(p, d, journal); await photosLocales(p);
      await seConnecter(p, URL_ADMIN); await p.waitForSelector(role === 'site' ? '.coque:not(.sans-menu)' : '.accueil-tete');
      await p.goto(URL_ADMIN + '#/site/b2-candidatures'); await p.waitForSelector('.dossier-carte', { timeout: 15000 }); await p.waitForTimeout(1000);
      const liens = await p.$$eval('a[href^="https://wa.me/"]', (l) => l.map((a) => a.href));
      await p.click('.dossier-carte .dossier-lien[href$="/c4"]'); await p.waitForSelector('.fiche-tete'); await p.waitForTimeout(1200);
      const fiche = await p.textContent('#contenu');
      const liensFiche = await p.$$eval('#contenu a[href^="https://wa.me/"]', (l) => l.map((a) => a.href));
      ok(!etoiles.length, n + 'jamais « toutes les colonnes » des candidatures (' + etoiles.length + ')');
      if (role === 'site') {
        ok(!/0707070707|mere@test\.ci/.test(fiche), n + 'fiche de la mineure : ni téléphone ni e-mail du parent');
        ok(!liensFiche.some((h) => /0101010101/.test(h)) && !liens.some((h) => /0101010101/.test(h)), n + 'jamais de WhatsApp vers la mineure elle-même');
        ok(/contacté par l’administrateur principal ou les encaissements/.test(fiche), n + 'une phrase dit qui contacte le parent');
        ok(/Madame Ama Mère/.test(fiche), n + 'le nom du parent reste affiché');
      } else {
        ok(/0707070707/.test(fiche) && liensFiche.some((h) => /707070707/.test(h)), n + 'fiche de la mineure : WhatsApp vers son parent (contacts lus par la fonction contrôlée)');
        ok(!liensFiche.some((h) => /0101010101/.test(h)), n + 'jamais de WhatsApp vers la mineure elle-même');
      }
      ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
      await ctx.close();
    }
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ contacts des parents (audit L-1) : tout passe');
  process.exit(ko ? 1 : 0);
})();
