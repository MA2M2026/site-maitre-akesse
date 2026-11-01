// Bulletins trimestriels dans l'Administration (chantier 14, partie 3, 01/11/2026), comme l'agence, sur
// téléphone et ordinateur, base SIMULÉE (rien n'est écrit pour de vrai) : le trimestre et ses mannequins,
// les présences du trimestre (liste de présence), cinq notes sur 5, l'appréciation ; « Enregistrer »
// (brouillon), « Enregistrer et publier » (la mannequin le verra), « Imprimer » un seul bulletin.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const chemin = require('path');
require(chemin.join(__dirname, '../../js/presences-calcul.js'));
const C = globalThis.Presences;
const PORT = String(9450 + Math.floor(Math.random() * 40));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const t = C.trimestre(C.jourIso(new Date()));
const premierDimanche = C.dimanchesDuMois(t.debut)[0];
const M = [{ id: 'r1', nom: 'AWA KONÉ', compte: 'm1', date_entree: '2025-01-01', mineur: false },
  { id: 'r2', nom: 'BINTOU TRAORÉ', compte: null, date_entree: '2025-01-01', mineur: true, parent_nom: 'Madame Traoré' }];

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (dl) => dl.accept());
    const d = donnees('principal');
    d.rpc.bulletins_trimestre = () => ({ trimestre: t.cle, mannequins: M, bulletins: [{ mannequin: 'r2', notes: { marche: 3 }, appreciation: 'À encourager', publie: true }] });
    d.rpc.presences_periode = () => ({ mannequins: M, annulees: [], presences: [{ mannequin: 'r1', dimanche: premierDimanche, etat: 'present' }] });
    d.rpc.bulletin_enregistrer = () => null;
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    const appels = () => journal.filter((j) => j[0] === 'rpc' && j[1] === 'bulletin_enregistrer').map((j) => JSON.parse(j[2] || '{}'));
    await p.goto(URL_ADMIN + '#/site/b2-bulletins'); await p.waitForSelector('.bul-carte'); await p.waitForTimeout(600);
    ok(/Bulletins trimestriels/.test(await p.textContent('body')) && new RegExp(t.nom).test(await p.textContent('.pr-barre')) && (await p.$$('.bul-carte')).length === 2, n + 'le trimestre (' + t.nom + ') et une fiche par mannequin');
    ok(/Cours du dimanche/.test(await p.textContent('.bul-carte:nth-of-type(1)')) && /1 sur/.test(await p.textContent('.bul-carte:nth-of-type(1) .bul-presences')), n + 'les présences du trimestre viennent de la liste de présence');
    ok(/Publié/.test(await p.textContent('.bul-carte:nth-of-type(2) .bul-etat')) && /parent : Madame Traoré/.test(await p.textContent('.bul-carte:nth-of-type(2)')), n + 'bulletin déjà publié : marqué ; mineure : le parent est indiqué');
    // noter Awa, enregistrer (brouillon), puis publier
    const f = '.bul-carte:nth-of-type(1) ';
    for (const [k, v] of [['marche', '4'], ['posture', '5'], ['photo', '3'], ['expression', '4'], ['attitude', '5']]) await p.selectOption(f + 'select[name="' + k + '"]', v);
    await p.fill(f + 'textarea[name="appreciation"]', 'Très bon trimestre, continue !');
    await p.click(f + 'button[type="submit"]'); await p.waitForTimeout(800);
    const a1 = appels().pop() || {};
    ok(a1.p_mannequin === 'r1' && a1.p_notes.posture === 5 && a1.p_notes.photo === 3 && /Très bon trimestre/.test(a1.p_appreciation) && a1.p_publier === false, n + '« Enregistrer » : les 5 notes et l’appréciation, pas encore publié');
    await p.waitForSelector('.bul-carte');
    await p.click('.bul-carte:nth-of-type(1) [data-action="bulletin-publier"]'); await p.waitForTimeout(800);
    ok((appels().pop() || {}).p_publier === true, n + '« Enregistrer et publier » : publié (après confirmation)');
    // « Enregistrer et publier » qui échoue, puis « Enregistrer » : jamais publié par erreur (relecture du 01/11/2026)
    await p.waitForSelector('.bul-carte');
    d.rpc.bulletin_enregistrer = { erreur: 'réseau coupé' };
    await p.click('.bul-carte:nth-of-type(1) [data-action="bulletin-publier"]'); await p.waitForTimeout(800);
    d.rpc.bulletin_enregistrer = () => null;
    await p.click('.bul-carte:nth-of-type(1) button[type="submit"]'); await p.waitForTimeout(800);
    ok((appels().pop() || {}).p_publier === false, n + 'après un échec de « publier », « Enregistrer » ne publie pas');
    await p.waitForSelector('.bul-carte');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne déborde de l’écran');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 3).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    // imprimer un seul bulletin
    await p.evaluate(() => { window.print = () => { window.__imprime = [...document.querySelectorAll('.bul-carte')].map((c) => c.classList.contains('a-imprimer')); }; });
    await p.click('.bul-carte:nth-of-type(2) [data-action="bulletin-imprimer"]'); await p.waitForTimeout(300);
    ok(JSON.stringify(await p.evaluate(() => window.__imprime)) === '[false,true]', n + '« Imprimer » : seulement ce bulletin');
    // trimestre suivant : pas encore commencé, rien à enregistrer
    await p.click('[data-action="bulletins-trimestre"][data-pas="1"]'); await p.waitForTimeout(800);
    ok(new RegExp(C.trimestreVoisin(t, 1).nom).test(await p.textContent('.pr-barre')) && !(await p.$('.bul-carte button[type="submit"]')), n + 'trimestre à venir : on ne peut pas encore enregistrer');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
