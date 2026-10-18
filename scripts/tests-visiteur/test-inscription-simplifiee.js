// Parcours d'inscription simplifié après casting (inscription-nouveau.html, démonstration 18/10/2026).
// Il fait comme une vraie personne, sur téléphone et ordinateur : code + date de naissance,
// récapitulatif (« Oui » ou « Corriger »), règlement + numéro Wave (+ accord du parent si mineur),
// paiement, « J'ai payé ». Vérifie aussi : 3 essais ratés bloquent le code, aucun appel d'écriture
// vers la base, aucune erreur de page, et que chaque texte visible est lisible (contraste 4,5 : 1).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9700 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

function contrastes() { // lancé dans la page : liste les textes trop pâles sur leur fond
  const lum = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rgba = s => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const fond = el => { for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c.a > 0.9) return c; } return { r: 255, g: 255, b: 255 }; };
  const mauvais = [];
  document.querySelectorAll('#inn-ecran h1, #inn-ecran h2, #inn-ecran p, #inn-ecran label, #inn-ecran span, #inn-ecran b, #inn-ecran button, #inn-ecran .inn-bandeau').forEach(el => {
    if (!el.offsetParent || !(el.innerText || '').trim()) return;
    if (el.disabled) return; // les boutons grisés sont volontairement atténués
    const c = rgba(getComputedStyle(el).color), f = fond(el);
    const l1 = lum(c.r, c.g, c.b), l2 = lum(f.r, f.g, f.b), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < 4.5) mauvais.push((el.innerText || '').trim().slice(0, 30) + ' (' + ratio.toFixed(1) + ')');
  });
  return mauvais;
}

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
    const voir = async t => p.waitForSelector('#inn-ecran >> text=' + t, { timeout: 4000 }).then(() => true).catch(() => false);
    const remplir = async (code, nais) => { await p.fill('#inn-code', code); await p.fill('#inn-naissance', nais); await p.click('[data-a=entrer]'); await p.waitForFunction(() => { const b = document.querySelector('[data-a=entrer]'); return !b || !b.disabled; }); };

    // 1. mauvais essais : le code se bloque au 3e
    await p.goto(url); await p.waitForTimeout(800);
    await remplir('ma2m-demo-01', '2000-01-01'); ok(await voir('Essai 1 sur 3'), nom + ' : 1er essai raté annoncé');
    await remplir('MA2M-DEMO-01', '2000-01-02'); await remplir('MA2M-DEMO-01', '2000-01-03');
    ok(await voir('Code bloqué'), nom + ' : code bloqué après 3 essais');
    await remplir('MA2M-DEMO-01', '2001-03-12'); ok(await voir('Code bloqué'), nom + ' : même la bonne date ne débloque pas le code');
    await remplir('N-IMPORTE-QUOI', '2001-03-12'); ok(await voir('incorrect'), nom + ' : code inconnu refusé');

    // 2. parcours d'une majeure, avec correction du téléphone
    await p.goto(url); await p.waitForTimeout(500);
    await remplir('MA2M-DEMO-02', '2010-05-03'); ok(await voir('Bonjour Yao'), nom + ' : le code du mineur reconnaît son dossier');
    ok(await p.locator('text=Parent de Yao').count() > 0, nom + ' : le parent est affiché au récapitulatif');
    await p.click('[data-a=oui]'); await p.waitForSelector('#inn-num');
    ok(await p.isDisabled('#inn-vers-paiement'), nom + ' : paiement bloqué tant que rien n\'est coché');
    await p.check('#inn-regl'); ok(await p.isDisabled('#inn-vers-paiement'), nom + ' : mineur : le règlement seul ne suffit pas (accord du parent exigé)');
    await p.check('#inn-parent'); ok(!(await p.isDisabled('#inn-vers-paiement')), nom + ' : mineur : accord du parent + règlement + numéro → paiement possible');
    const mal = await p.evaluate(contrastes); ok(!mal.length, nom + ' : textes lisibles (contraste) à l\'écran règlement ' + mal.join(' | '));

    await p.goto(url); await p.waitForTimeout(500);
    await remplir('MA2M-DEMO-01', '2001-03-12');
    // (le code 01 est bloqué dans cette page rechargée ? non : le blocage vit en mémoire de la page)
    ok(await voir('Bonjour Awa'), nom + ' : la majeure est reconnue après rechargement (blocage en mémoire de la démo)');
    let m1 = await p.evaluate(contrastes); ok(!m1.length, nom + ' : textes lisibles au récapitulatif ' + m1.join(' | '));
    await p.click('[data-a=corriger]'); await p.fill('#inn-tel', '07 11 22 33 44'); await p.fill('#inn-mail', 'awa.nouveau@exemple.com'); await p.click('[data-a=enregistrer]');
    await p.waitForSelector('#inn-num'); ok((await p.inputValue('#inn-num')) === '07 11 22 33 44', nom + ' : le numéro corrigé est repris pour le paiement');
    ok(await p.locator('#inn-parent').count() === 0, nom + ' : majeure : pas de case « parent »');
    await p.check('#inn-regl'); await p.click('#inn-vers-paiement'); await p.waitForSelector('[data-a=wave]');
    ok(await p.isDisabled('[data-a=paye]'), nom + ' : « J\'ai payé » grisé avant d\'avoir payé');
    await p.click('[data-a=wave]'); ok(!(await p.isDisabled('[data-a=paye]')), nom + ' : « J\'ai payé » disponible après « Payer avec Wave »');
    ok(await p.locator('text=25 000 FCFA').count() > 0, nom + ' : montant de 25 000 FCFA affiché');
    const m3 = await p.evaluate(contrastes); ok(!m3.length, nom + ' : textes lisibles à l\'écran paiement ' + m3.join(' | '));
    await p.screenshot({ path: '/tmp/shots/insc-simple-' + (mobile ? 'm' : 'd') + '-paiement.png' });
    await p.click('[data-a=paye]'); ok(await voir('L\'agence vérifie votre paiement'), nom + ' : message de fin après « J\'ai payé »');
    ok(!errs.length, nom + ' : aucune erreur de page ' + errs.join(' | '));
    const ecritures = journal.filter(e => ['POST', 'PATCH', 'PUT', 'DELETE', 'EMAIL', 'API'].includes(e[0]) && e[1] !== 'page_views' && e[1] !== 'client_errors').map(e => e.slice(0, 2).join(' '));
    ok(!ecritures.length, nom + ' : le parcours n\'écrit rien en base ni n\'envoie rien (hors compteur de visites) ' + ecritures.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
