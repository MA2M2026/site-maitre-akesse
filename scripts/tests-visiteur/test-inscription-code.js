// Inscription officielle par code individuel (inscription-mannequin.html FR et EN, cahier v2.3
// section 14), branchée sur le vrai serveur du site (api/portail.js, ici SIMULÉ) : comme une vraie
// personne, sur téléphone et ordinateur. Vérifie : les textes anglais, ce qui est envoyé au serveur
// (code, date de naissance, numéro payeur, règlement accepté, accord du parent pour un mineur),
// l'ouverture du lien Wave Business, l'écran de fin, le blocage par le serveur (trop d'essais).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9200 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const CANDIDATS = {
  'MA2M-K7P4-92': { nom: 'Awa Koné', naissance: '2001-03-12', telephone: '0700000001', email: 'awa@test.ci', origine: 'Casting en ligne', parent: null },
  'MA2M-YB2X-35': { nom: 'Yao Bamba', naissance: '2012-05-03', telephone: '0700000002', email: '', origine: 'Casting direct', parent: { nom: 'Parent de Yao', telephone: '0700000012' } }
};
function serveur(appels) {
  return (c) => {
    appels.push(c);
    const cand = CANDIDATS[c.code];
    if (c.action === 'inscription_verifier') {
      if (!cand || cand.naissance !== c.naissance) return { ok: false, raison: 'inconnu', essais: 1 };
      return { ok: true, montant: 25000, droit_inscription: 15000, premier_mois: 10000, lien_wave: 'https://pay.wave.com/m/essai-25000', note: null, candidat: cand };
    }
    return { ok: !!cand };
  };
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [page, en, ecran] of [['inscription-mannequin.html', false, { width: 390, height: 844 }], ['en/inscription-mannequin.html', true, { width: 1280, height: 900 }],
    ['inscription-mannequin.html', false, { width: 1280, height: 900 }], ['en/inscription-mannequin.html', true, { width: 390, height: 844 }]]) {
    const nom = page + ' (' + ecran.width + ' px)';
    const ctx = await b.newContext({ viewport: ecran }); const p = await ctx.newPage(); const errs = [], appels = [], ouverts = [];
    p.on('pageerror', (e) => errs.push(e.message));
    ctx.on('page', (x) => ouverts.push(x));
    await brancher(p, { tables: {}, api: { '/api/portail': serveur(appels) } }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForSelector('#inn-code');
    const t = () => p.evaluate(() => document.getElementById('inn-ecran').innerText);
    ok((en ? /new model registration/i : /inscription nouveaux mannequins/i).test(await t()), nom + ' : titre dans la bonne langue');
    ok(!(await p.$('#inn-demo')) || !(await p.isVisible('#inn-demo')), nom + ' : pas de bandeau « démonstration » sur la vraie page');
    // mauvais code : message neutre
    await p.fill('#inn-code', 'ma2m-k7p4-92'); await p.fill('#inn-naissance', '2001-03-13'); await p.click('[data-a=entrer]');
    await p.waitForSelector('.inn-bandeau.erreur');
    ok(en ? (await t()).includes('Incorrect code or date of birth') : (await t()).includes('Code ou date de naissance incorrect'), nom + ' : erreur neutre (ne dit pas si c’est le code ou la date)');
    ok(appels[0] && appels[0].code === 'MA2M-K7P4-92', nom + ' : le code est envoyé en majuscules');
    // parcours d'un mineur : l'accord du parent est obligatoire et transmis
    await p.fill('#inn-code', 'MA2M-YB2X-35'); await p.fill('#inn-naissance', '2012-05-03'); await p.click('[data-a=entrer]');
    await p.waitForSelector('[data-a=oui]');
    ok((await t()).includes('Parent de Yao'), nom + ' : récapitulatif prérempli avec le parent');
    ok(en ? (await t()).includes('Direct casting') : (await t()).includes('Casting direct'), nom + ' : origine traduite');
    await p.click('[data-a=oui]'); await p.waitForSelector('#inn-num');
    await p.check('#inn-regl');
    ok(await p.isDisabled('#inn-vers-paiement'), nom + ' : mineur sans accord du parent → paiement bloqué');
    await p.check('#inn-parent'); await p.click('#inn-vers-paiement');
    await p.waitForSelector('[data-a=wave]');
    ok((await t()).includes('25 000 FCFA') && (await t()).includes('15 000 FCFA'), nom + ' : montants venant du serveur');
    ok(await p.isDisabled('[data-a=paye]'), nom + ' : « J’ai payé » grisé avant d’ouvrir Wave');
    await p.click('[data-a=wave]'); await p.waitForTimeout(400);
    ok(ouverts.length === 1, nom + ' : « Payer avec Wave » ouvre le lien Wave Business');
    await p.click('[data-a=paye]'); await p.waitForSelector('.inn-bandeau.info');
    ok(en ? (await t()).includes('The agency is checking your payment') : (await t()).includes('L\'agence vérifie votre paiement'), nom + ' : écran de fin');
    const dec = appels.find((a) => a.action === 'inscription_declarer');
    ok(dec && dec.naissance === '2012-05-03' && dec.numero === '0700000002' && dec.reglement === true && dec.parent === true, nom + ' : déclaration envoyée avec date, numéro payeur, règlement et accord du parent');
    ok(!errs.length, nom + ' : aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  // trop d'essais : le serveur bloque (429) → message « bloqué »
  {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    await brancher(p, { tables: {}, api: {} }, []);
    await p.route(/\/api\/portail/, (r) => r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"bloque"}' }));
    await p.goto('http://127.0.0.1:' + PORT + '/inscription-mannequin.html'); await p.waitForSelector('#inn-code');
    await p.fill('#inn-code', 'MA2M-K7P4-92'); await p.fill('#inn-naissance', '2001-03-12'); await p.click('[data-a=entrer]');
    await p.waitForSelector('.inn-bandeau.erreur');
    ok((await p.evaluate(() => document.getElementById('inn-ecran').innerText)).includes('Code bloqué'), 'blocage du serveur : message « Code bloqué… contactez l’agence »');
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
