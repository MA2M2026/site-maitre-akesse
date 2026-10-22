// Nouvelle Administration — Convocations (même écran et même logique que l'ancien tableau de bord :
// js/convocations-gabarit.js, js/convocations-page.js, js/convocations-admin.js), essayées comme
// l'agence sur téléphone et ordinateur, base SIMULÉE : projet du jour, mur de visages (toucher un
// visage le choisit), enregistrement, panneau d'envoi, e-mails partis, bouton « WhatsApp suivant »,
// « Voir les réponses ». Rien n'est envoyé pour de vrai. CAPTURES=dossier : captures d'écran.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9500 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/nouvelle/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const capture = (p, nom) => process.env.CAPTURES ? p.screenshot({ path: process.env.CAPTURES + '/' + nom + '.png' }) : null;
const ecrits = (journal, m, table) => journal.filter((j) => j[0] === m && j[1] === table).map((j) => JSON.parse(j[3] || 'null'));

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ', suffixe = tel ? '-tel' : '-pc';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept());
    await brancher(p, donnees('principal'), journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    // l'affiche du projet du jour mène aux convocations
    await p.click('.affiche'); await p.waitForSelector('#cv-form', { timeout: 10000 }); await p.waitForTimeout(1500);
    ok(/#\/site\/b2-convocations$/.test(p.url()) && await p.isVisible('#cv-form'), n + 'l’affiche du jour ouvre les Convocations');
    const choix = await p.$$eval('#cv-projet option', (os) => os.map((o) => o.textContent));
    ok(choix.some((t) => /ABIDJAN BORDER FORUM/.test(t)) && choix.some((t) => /SHOOTING CACAO/.test(t)), n + 'projets à venir proposés');
    await p.selectOption('#cv-projet', 'p1'); await p.waitForTimeout(500);
    const mur = await p.evaluate(() => ({ visages: document.querySelectorAll('#cv-mannequins.mur-visages .choix-visage .vis img').length, coches: document.querySelectorAll('#cv-mannequins input:checked').length }));
    ok(mur.visages === 12 && mur.coches === 4, n + 'mur de visages : 12 mannequins, les 4 du projet déjà choisies');
    await p.locator('.choix-visage', { hasText: 'SARAH KONAN' }).click(); await p.waitForTimeout(300);
    ok((await p.$$('#cv-mannequins input:checked')).length === 5 && /5 mannequins choisis/.test(await p.textContent('#cv-compte')), n + 'toucher un visage le choisit (5 choisies)');
    await p.fill('#cv-recherche', 'grâce'); await p.waitForTimeout(200);
    ok((await p.$$eval('.choix-visage', (ls) => ls.filter((l) => !l.hidden).length)) === 1, n + 'recherche par nom dans le mur');
    await p.fill('#cv-recherche', '');
    await p.fill('#cv-heure-convocation', '15:00');
    await p.locator('#cv-mannequins').scrollIntoViewIfNeeded();
    await capture(p, 'convocations-mur' + suffixe);
    await p.$eval('#cv-enregistrer', (x) => x.click()); await p.waitForTimeout(2200);
    const maj = ecrits(journal, 'PATCH', 'agenda_projets').pop() || {};
    ok(maj.heure_convocation === '15:00' && (maj.mannequin_ids || []).length === 5, n + 'projet enregistré avec l’heure et les 5 mannequins');
    ok(await p.isVisible('#convoc-panneau') && (await p.$$('#convoc-participants .convoc-personne')).length === 5, n + 'panneau d’envoi ouvert, 5 participants');
    await p.click('#convoc-programmer');
    for (let i = 0; i < 40 && !/envoyé\(s\) sur/.test(await p.textContent('#convoc-msg')); i++) await p.waitForTimeout(400);
    const mails = journal.filter((j) => j[0] === 'EMAIL').length;
    ok(mails === 5 && /5 e-mail\(s\) envoyé\(s\) sur 5/.test(await p.textContent('#convoc-msg')), n + '5 e-mails partis, bilan affiché');
    ok(/Envoyer le WhatsApp suivant.*5 restants/.test(await p.textContent('.convoc-suivant')), n + 'bouton « WhatsApp suivant » (5 restants)');
    await p.locator('.convoc-suivant').scrollIntoViewIfNeeded(); await capture(p, 'convocations-suivi' + suffixe);
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran');
    // Voir les réponses
    await p.click('#cv-voir-reponses'); await p.waitForTimeout(1000);
    ok(await p.isVisible('#cv-reponses-projet'), n + '« Voir les réponses » s’ouvre');
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
