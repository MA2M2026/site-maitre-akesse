// Étape C (01/11/2026) : Administration › Textes des pages, comme l'administratrice, sur téléphone et ordinateur,
// base SIMULÉE (rien n'est écrit) : choisir une page, changer un texte en français et en anglais, enregistrer ;
// seuls les textes changés partent ; un texte remis comme à l'origine repart vide (= texte d'origine).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const chemin = require('path'), fs = require('fs');
const RACINE = chemin.resolve(__dirname, '../..');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PORT = String(9700 + Math.floor(Math.random() * 30)), URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const d = donnees('principal');
    d.tables.textes_pages = [{ page: 'services', cle: 'services-3', fr: 'Académie MA2M', en: null }];
    d.rpc.textes_pages_enregistrer = () => 1;
    await brancher(p, d, journal); await photosLocales(p);
    // (adresses propres du site, comme en ligne : /services → services.html)
    await p.route(/127\.0\.0\.1:\d+\/(en\/)?services$/, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
      body: fs.readFileSync(chemin.join(RACINE, (/\/en\//.test(r.request().url()) ? 'en/' : '') + 'services.html'), 'utf8') }));
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete', { timeout: 10000 });
    await p.goto(URL_ADMIN + '#/site/b3c-textes-pages'); await p.waitForSelector('.tuile-texte', { timeout: 8000 }).catch(() => {});
    ok((await p.$$('.tuile-texte')).length === 5, n + 'les 5 pages au choix');
    await p.click('.tuile-texte[href$="/services"]'); await p.waitForSelector('form[data-form="textes-enregistrer"]', { timeout: 8000 }).catch(() => {});
    const nb = (await p.$$('.texte-zone')).length;
    ok(nb === 53, n + 'Services : ses 53 textes, chacun en français et en anglais (' + nb + ')');
    ok(await p.inputValue('textarea[name="services-1|fr"]') === 'Nos services' && await p.inputValue('textarea[name="services-1|en"]') !== '' && await p.inputValue('textarea[name="services-3|fr"]') === 'Académie MA2M',
      n + 'texte d’origine pré-rempli ; un texte déjà changé montre sa version enregistrée');
    await p.fill('textarea[name="services-2|fr"]', 'Un nouveau paragraphe\navec deux lignes');
    await p.fill('textarea[name="services-2|en"]', 'A new paragraph');
    await p.fill('textarea[name="services-3|fr"]', 'Académie');  // (remis comme à l'origine)
    await p.click('form[data-form="textes-enregistrer"] [type=submit]'); await p.waitForTimeout(900);
    const envoi = journal.filter((j) => j[0] === 'rpc' && j[1] === 'textes_pages_enregistrer').map((j) => JSON.parse(j[2] || '{}')).pop() || {};
    const t = envoi.p_textes || [];
    ok(envoi.p_page === 'services' && t.length === 2 && t.some((x) => x.cle === 'services-2' && x.fr === 'Un nouveau paragraphe\navec deux lignes' && x.en === 'A new paragraph') && t.some((x) => x.cle === 'services-3' && x.fr === '' && x.en === ''),
      n + 'seuls les textes changés partent ; un texte remis comme avant = texte d’origine ' + JSON.stringify(t).slice(0, 160));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne déborde');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
