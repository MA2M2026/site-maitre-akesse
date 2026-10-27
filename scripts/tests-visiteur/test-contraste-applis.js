// Couleurs des deux applications (27/10/2026, choix de la propriétaire : fond rouge très mat,
// blocs blancs, css/applis-rouge-mat.css) : chaque texte de CHAQUE page du menu de l'Administration
// (les trois espaces), sur ordinateur et sur téléphone (menu ouvert compris), doit rester lisible
// (norme WCAG AA, lisibilite.js) ; et le rouge mat est bien le fond. Base SIMULÉE : rien n'est écrit.
// (L'application des mannequins : même contrôle dans test-app-mannequin.js, écran par écran.)
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const chemin = require('path');
const PORT = String(9600 + Math.floor(Math.random() * 90)), BASE = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['ordinateur', { width: 1366, height: 900 }], ['téléphone', { width: 390, height: 844 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.dismiss());
    await brancher(p, donnees('principal'), []); await photosLocales(p);
    await seConnecter(p, BASE); await p.waitForSelector('.accueil-tete');
    ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(124, 33, 40)'), n + 'fond rouge très mat (#7C2128)');
    // toutes les pages des menus des trois espaces
    const pages = ['#/'];
    for (const esp of ['site', 'paiements', 'compta']) {
      await p.goto(BASE + '#/' + esp); await p.waitForSelector('.lateral .nav', { state: 'attached', timeout: 10000 });
      for (const h of await p.$$eval('.lateral a.nav', (l) => l.map((a) => a.getAttribute('href')))) if (h && !pages.includes(h)) pages.push(h);
    }
    const pales = [];
    for (const h of pages) {
      await p.goto(BASE + h); await p.waitForTimeout(900);
      for (const x of await lirePageEntiere(p)) pales.push(h + ' ' + x.element + ' « ' + x.texte + ' » ' + x.contraste);
    }
    if (tel) {  // le menu du téléphone (feuille qui monte du bas), ouvert
      await p.goto(BASE + '#/site'); await p.waitForTimeout(900);
      await p.evaluate(() => document.documentElement.classList.add('menu-ouvert')); await p.waitForTimeout(600);
      for (const x of await lirePageEntiere(p)) pales.push('menu ' + x.element + ' « ' + x.texte + ' » ' + x.contraste);
    }
    ok(pages.length > 40 && !pales.length, n + pages.length + ' pages : tous les textes lisibles' + (pales.length ? ' — trop pâles : ' + pales.slice(0, 12).join(' | ') : ''));
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
