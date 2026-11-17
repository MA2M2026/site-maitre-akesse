// Étiquette « À vérifier » (17/11/2026, décision de la propriétaire) : une candidature envoyée SANS la vérification
// anti-robots (téléphone qui ne charge pas Cloudflare) porte « ⚠ À vérifier » dans la liste et dans sa fiche ; le bouton
// « C'est une vraie personne » retire l'étiquette. Comme une vraie personne dans l'Administration, base SIMULÉE.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const path = require('path');
const PORT = String(9900 + Math.floor(Math.random() * 25)), URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [role, ecran] of [['principal', { width: 390, height: 844 }], ['site', { width: 1366, height: 860 }]]) {
    const tel = ecran.width < 700, n = role + ' (' + (tel ? 'téléphone' : 'ordinateur') + ') : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const d = donnees(role); d.memoriser = true;
    d.tables.envois_a_verifier = [{ ref: 'c1', table_nom: 'casting_applications', raison: 'pas de jeton', cree_le: '2026-11-17T08:19:00Z' }];
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForFunction(() => document.querySelector('.accueil-tete, .coque:not(.sans-menu)'), null, { timeout: 15000 }); await p.waitForTimeout(1200);
    // la liste : l'étiquette sur la seule candidature notée
    await p.goto(URL_ADMIN + '#/site/b2-candidatures'); await p.waitForTimeout(2200);
    const cartes = await p.$$eval('.dossier-carte', (l) => l.map((c) => ({ href: (c.querySelector('.dossier-lien') || {}).getAttribute?.('href') || '', texte: c.textContent })));
    const marquees = cartes.filter((c) => /À vérifier/.test(c.texte));
    ok(marquees.length === 1 && /\/c1$/.test(marquees[0].href), n + 'liste : « ⚠ À vérifier » sur la seule candidature envoyée sans vérification (' + marquees.length + ')');
    // la fiche : encart + bouton
    await p.goto(URL_ADMIN + '#/site/b2-candidatures/c1'); await p.waitForTimeout(2200);
    ok(!!(await p.$('.a-verifier [data-action="dossier-a-verifier-ok"]')), n + 'fiche : encart « À vérifier » avec « C’est une vraie personne »');
    const deborde = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(!deborde, n + 'fiche : rien ne déborde');
    await p.click('[data-action="dossier-a-verifier-ok"]'); await p.waitForTimeout(1500);
    ok(d.tables.envois_a_verifier.length === 0 && !(await p.$('.a-verifier')) && !/À vérifier/.test(await p.textContent('#contenu')), n + '« C’est une vraie personne » : l’étiquette disparaît partout (base et page)');
    // une autre candidature, jamais notée : rien
    await p.goto(URL_ADMIN + '#/site/b2-candidatures/c2'); await p.waitForTimeout(1800);
    ok(!(await p.$('.a-verifier')), n + 'candidature normale : aucune étiquette');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
