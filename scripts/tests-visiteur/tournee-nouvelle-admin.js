// Tournée photographique de la nouvelle Administration (base SIMULÉE, rien de réel) : une capture
// de chaque rubrique du bloc 1, sur téléphone et ordinateur, pour les visites « comme un patron
// d'agence ». Usage : CAPTURES=dossier [ESPACE=site|paiements|compta] node tournee-nouvelle-admin.js
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const chemin = require('path'), fs = require('fs');
const PORT = String(9300 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/nouvelle/';
const DOSSIER = process.env.CAPTURES || '.', ESPACE = process.env.ESPACE || 'site';
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore', stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const menu = fs.readFileSync(chemin.resolve(__dirname, '../../js/admin/site.js'), 'utf8');
  let pages = ['', ...[...menu.matchAll(/\['([a-z0-9-]+)', '/g)].map((m) => m[1]), 'b2-candidatures/c4', 'b2-mannequins-publies/m0', 'actualites/a1'];
  const b = await chromium.launch();
  for (const [nom, ecran] of [['tel', { width: 390, height: 844 }], ['pc', { width: 1366, height: 900 }]]) {
    const ctx = await b.newContext({ viewport: ecran, isMobile: nom === 'tel', hasTouch: nom === 'tel', serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, donnees('principal'), []); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    // autres blocs : les rubriques sont lues dans le menu de l'espace
    if (ESPACE !== 'site') pages = await p.evaluate((e) => window.Portail.espaces[e].nav.filter((n) => n[0]).map((n) => n[0]), ESPACE);
    for (const page of pages) {
      await p.goto(URL_ADMIN + (page ? '#/' + ESPACE + '/' + page : '#/')); await p.waitForTimeout(2600);
      await p.screenshot({ path: DOSSIER + '/' + nom + '-' + (ESPACE === 'site' ? '' : ESPACE + '-') + (page || 'accueil').replace(/\//g, '_') + '.png', fullPage: true });
    }
    console.log(nom + ' : ' + pages.length + ' pages, erreurs : ' + (errs.join(' | ') || 'aucune'));
    await ctx.close();
  }
  await b.close(); process.exit(0);
})();
