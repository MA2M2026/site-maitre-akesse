// Parcours d'inscription simplifié après casting (inscription-nouveau.html, démonstration 18/10/2026).
// Il fait comme une vraie personne, sur téléphone et ordinateur : code + date de naissance,
// récapitulatif (« Oui » ou « Corriger »), règlement + numéro Wave (+ accord du parent si mineur),
// paiement, « J'ai payé ». Vérifie aussi : 3 essais ratés bloquent le code, aucun appel d'écriture
// vers la base, aucune erreur de page, connexion coupée sans blocage, et que chaque texte visible
// est lisible (contrôle commun lisibilite.js).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
// contrôle de lisibilité commun à tous les tests (contraste 4,5 : 1, 3 : 1 pour un grand texte)
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9700 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [nom, vp, mobile] of [['téléphone', { width: 390, height: 844 }, true], ['ordinateur', { width: 1280, height: 800 }, false]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
    const p = await ctx.newPage(); const errs = [], journal = [];
    await brancher(p, { tables: {}, rpc: {} }, journal); // base SIMULÉE : rien n'est écrit pour de vrai
    p.on('pageerror', e => errs.push(e.message));
    const url = 'http://127.0.0.1:' + PORT + '/inscription-nouveau.html';
    const pales = async () => (await lirePageEntiere(p)).map(x => x.texte.slice(0, 30) + ' (' + x.contraste + ')');
    const voir = async t => p.waitForSelector('#inn-ecran >> text=' + t, { timeout: 4000 }).then(() => true).catch(() => false);
    const remplir = async (code, nais) => { await p.fill('#inn-code', code); await p.fill('#inn-naissance', nais); await p.click('[data-a=entrer]'); await p.waitForFunction(() => { const b = document.querySelector('[data-a=entrer]'); return !b || !b.disabled; }); };

    // 1. mauvais essais : le code se bloque au 3e
    await p.goto(url); await p.waitForTimeout(800);
    await remplir('ma2m-demo-01', '2000-01-01'); ok(await voir('Essai 1 sur 3'), nom + ' : 1er essai raté annoncé');
    await remplir('MA2M-DEMO-01', '2000-01-02'); await remplir('MA2M-DEMO-01', '2000-01-03');
    ok(await voir('Code bloqué'), nom + ' : code bloqué après 3 essais');
    await remplir('MA2M-DEMO-01', '2001-03-12'); ok(await voir('Code bloqué'), nom + ' : même la bonne date ne débloque pas le code');
    await remplir('N-IMPORTE-QUOI', '2001-03-12'); ok(await voir('incorrect'), nom + ' : code inconnu refusé');

    // 1 bis. connexion coupée pendant la vérification du code : message clair, bouton de nouveau
    // utilisable (il restait bloqué sur « en cours » avant le 18/10/2026), puis nouvel essai réussi
    await p.goto(url); await p.waitForTimeout(500);
    // une fonction de la source simulée « coupe la connexion » le temps d'un essai, puis revient
    const couper = (nom) => p.evaluate((nom) => { const s = window.MA2M_INSCRIPTION_SOURCE; s['_' + nom] = s[nom]; s[nom] = () => Promise.reject(new Error('réseau coupé')); }, nom);
    const retablir = (nom) => p.evaluate((nom) => { const s = window.MA2M_INSCRIPTION_SOURCE; if (s['_' + nom]) s[nom] = s['_' + nom]; }, nom);
    await couper('verifierCode');
    try {
      await p.fill('#inn-code', 'MA2M-DEMO-01'); await p.fill('#inn-naissance', '2001-03-12'); await p.click('[data-a=entrer]');
      ok(await voir('Connexion impossible'), nom + ' : connexion coupée → message « Connexion impossible »');
      ok(!(await p.isDisabled('[data-a=entrer]')), nom + ' : connexion coupée → le bouton n\'est pas bloqué');
    } finally { await retablir('verifierCode'); }
    await p.click('[data-a=entrer]'); ok(await voir('Bonjour Awa'), nom + ' : connexion revenue → le nouvel essai passe');

    // 2. parcours d'une majeure, avec correction du téléphone
    await p.goto(url); await p.waitForTimeout(500);
    await remplir('MA2M-DEMO-02', '2010-05-03'); ok(await voir('Bonjour Yao'), nom + ' : le code du mineur reconnaît son dossier');
    ok(await p.locator('text=Parent de Yao').count() > 0, nom + ' : le parent est affiché au récapitulatif');
    await p.click('[data-a=oui]'); await p.waitForSelector('#inn-num');
    ok(await p.isDisabled('#inn-vers-paiement'), nom + ' : paiement bloqué tant que rien n\'est coché');
    await p.check('#inn-regl'); ok(await p.isDisabled('#inn-vers-paiement'), nom + ' : mineur : le règlement seul ne suffit pas (accord du parent exigé)');
    await p.check('#inn-parent'); ok(!(await p.isDisabled('#inn-vers-paiement')), nom + ' : mineur : accord du parent + règlement + numéro → paiement possible');
    const mal = await pales(); ok(!mal.length, nom + ' : textes lisibles (contraste) à l\'écran règlement ' + mal.join(' | '));

    await p.goto(url); await p.waitForTimeout(500);
    await remplir('MA2M-DEMO-01', '2001-03-12');
    // (le code 01 est bloqué dans cette page rechargée ? non : le blocage vit en mémoire de la page)
    ok(await voir('Bonjour Awa'), nom + ' : la majeure est reconnue après rechargement (blocage en mémoire de la démo)');
    let m1 = await pales(); ok(!m1.length, nom + ' : textes lisibles au récapitulatif ' + m1.join(' | '));
    await p.click('[data-a=corriger]'); await p.fill('#inn-tel', '07 11 22 33 44'); await p.fill('#inn-mail', 'awa.nouveau@exemple.com');
    await couper('corriger');
    try {
      await p.click('[data-a=enregistrer]');
      ok(await voir('Connexion impossible'), nom + ' : « Corriger » avec connexion coupée → message');
      ok((await p.inputValue('#inn-tel')) === '07 11 22 33 44' && (await p.inputValue('#inn-mail')) === 'awa.nouveau@exemple.com', nom + ' : « Corriger » avec connexion coupée → ce qui a été tapé est gardé');
    } finally { await retablir('corriger'); }
    await p.click('[data-a=enregistrer]');
    await p.waitForSelector('#inn-num'); ok((await p.inputValue('#inn-num')) === '07 11 22 33 44', nom + ' : le numéro corrigé est repris pour le paiement');
    ok(await p.locator('#inn-parent').count() === 0, nom + ' : majeure : pas de case « parent »');
    await p.check('#inn-regl'); await p.click('#inn-vers-paiement'); await p.waitForSelector('[data-a=wave]');
    ok(await p.isDisabled('[data-a=paye]'), nom + ' : « J\'ai payé » grisé avant d\'avoir payé');
    await p.click('[data-a=wave]'); ok(!(await p.isDisabled('[data-a=paye]')), nom + ' : « J\'ai payé » disponible après « Payer avec Wave »');
    ok(await p.locator('text=25 000 FCFA').count() > 0, nom + ' : montant de 25 000 FCFA affiché');
    const m3 = await pales(); ok(!m3.length, nom + ' : textes lisibles à l\'écran paiement ' + m3.join(' | '));
    await p.screenshot({ path: '/tmp/shots/insc-simple-' + (mobile ? 'm' : 'd') + '-paiement.png' });
    await couper('declarerPaiement');
    try {
      await p.click('[data-a=paye]');
      ok(await voir('peut-être pas été reçue'), nom + ' : « J\'ai payé » avec connexion coupée → message prudent');
      ok(!(await p.isDisabled('[data-a=paye]')), nom + ' : « J\'ai payé » avec connexion coupée → bouton de nouveau utilisable');
    } finally { await retablir('declarerPaiement'); }
    await p.click('[data-a=paye]'); ok(await voir('L\'agence vérifie votre paiement'), nom + ' : message de fin après « J\'ai payé »');
    ok(!errs.length, nom + ' : aucune erreur de page ' + errs.join(' | '));
    const ecritures = journal.filter(e => ['POST', 'PATCH', 'PUT', 'DELETE', 'EMAIL', 'API'].includes(e[0]) && e[1] !== 'page_views' && e[1] !== 'client_errors').map(e => e.slice(0, 2).join(' '));
    ok(!ecritures.length, nom + ' : le parcours n\'écrit rien en base ni n\'envoie rien (hors compteur de visites) ' + ecritures.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
