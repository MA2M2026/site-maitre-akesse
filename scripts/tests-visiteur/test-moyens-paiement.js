// Moyens de paiement des mannequins (12/11/2026, demande de la propriétaire ; js/moyens-paiement.js,
// supabase-moyens-paiement.sql), comme une vraie personne, téléphone et ordinateur, base SIMULÉE :
//  - « Mes paiements » : sans le fichier de la base, Wave seul et les autres « bientôt » ;
//  - moyens allumés : choix en pastilles ; Orange Money → numéro de l'agence affiché, « J'ai payé » sans lien,
//    « J'ai payé » envoie le moyen (mensualite_declarer_avec_numero avec p_moyen) ; virement → RIB ; carte → lien d'abord ;
//  - Administration > Paramètres : les 6 moyens, « Modifier » (numéro, allumé) enregistré ; un rôle non principal
//    ne voit pas « Modifier » ;
//  - Paiements à valider : le moyen déclaré est affiché.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const { verifierBoutons } = require('./boutons');
const PORT = String(9200 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JETON = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'u-awa', role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 }) + '.c2ln';
const SESSION = { access_token: JETON, refresh_token: 'faux', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: 'u-awa', email: 'awa@test.ci', aud: 'authenticated', role: 'authenticated' } };
const ici = new Date(), iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
const m0 = new Date(ici.getFullYear(), ici.getMonth(), 1);
const MOIS = Array.from({ length: 24 }, (_, i) => ({ mois: iso(new Date(m0.getFullYear(), m0.getMonth() + i, 1)), etat: i === 0 ? 'a_payer' : 'a_venir' }));
const ALLUMES = [{ code: 'wave', nom: 'Wave' }, { code: 'orange_money', nom: 'Orange Money', numero: '07 11 22 33 44', titulaire: 'MA2M' },
  { code: 'carte', nom: 'Carte bancaire (Visa)', lien: 'https://paiement.exemple.ci/ma2m' }, { code: 'virement', nom: 'Virement bancaire', rib: 'Banque Essai · CI000 00000 0000000000 00', titulaire: 'MA2M SARL' }];
const sansEspaces = (x) => x.replace(/[  ]/g, ' ');

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const mannequin = async (ecran, moyens) => {
    const ctx = await b.newContext({ viewport: ecran }); const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript((s) => { localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify(s)); }, SESSION);
    await brancher(p, { tables: {}, rpc: { mes_mensualites: () => ({ inscrit: true, nom: 'KONÉ AWA', mensualite: 10000, statut: 'actif', mineur: false, mois: MOIS }),
      mes_recus: () => [], mes_cachets: () => [], mensualite_declarer_avec_numero: null, ...(moyens ? { moyens_paiement_publics: moyens } : {}) } }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/app/mes-paiements.html'); await p.waitForSelector('.mp-calendrier', { timeout: 8000 }); await p.waitForTimeout(400);
    return { ctx, p, errs, journal, t: async () => sansEspaces(await p.evaluate(() => document.getElementById('mp-zone').innerText)) };
  };
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    // 1. fichier de la base pas encore collé : Wave seul, comme avant
    let s = await mannequin(ecran, null);
    ok(await s.p.$('[data-mp=wave]') && (await s.p.$$eval('.pp-moyen', (l) => l.map((x) => (x.disabled ? '-' : '+') + [...x.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()).join('|'))) === '+Wave|-Orange Money · bientôt|-MTN Money · bientôt|-Moov Money · bientôt|-Carte bancaire · bientôt|-Virement bancaire · bientôt', nomEcran + ' : sans la base, Wave seul, les 5 autres en tuiles « bientôt » (non cliquables)');
    await s.ctx.close();
    // 2. moyens allumés
    s = await mannequin(ecran, ALLUMES); const p = s.p;
    ok(await p.$$eval('.pp-moyen:not([disabled])', (l) => l.map((x) => [...x.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()).join('|')) === 'Wave|Orange Money|Carte bancaire (Visa)|Virement bancaire' && (await p.$$eval('.pp-moyen[disabled]', (l) => l.length)) === 2, nomEcran + ' : les 4 moyens allumés au choix, les 2 autres « bientôt »');
    await p.click('.pp-moyen[data-moyen="orange_money"]'); await p.waitForTimeout(200);
    ok(/Envoyez 10 000 FCFA par Orange Money au numéro de l’agence \(au nom de MA2M\) :\s*07 11 22 33 44\s*Copier/.test(await s.t()) && !(await p.$('[data-mp=wave]')), nomEcran + ' : Orange Money → numéro de l’agence et montant affichés');
    ok(await p.isDisabled('[data-mp=paye]'), nomEcran + ' : « J’ai payé » attend le numéro du payeur');
    await p.fill('.mp-num', '07 01 02 03 04'); ok(!(await p.isDisabled('[data-mp=paye]')), nomEcran + ' : Orange Money : « J’ai payé » s’ouvre sans passer par un lien');
    const boutons = (await p.evaluate(verifierBoutons)).map((x) => x.texte); ok(!boutons.length, nomEcran + ' : boutons au modèle rouge ' + boutons.join(' | '));
    const pales = (await lirePageEntiere(p)).map((x) => x.texte.slice(0, 25)); ok(!pales.length, nomEcran + ' : textes lisibles ' + pales.join(' | '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nomEcran + ' : rien ne dépasse sur le côté');
    await p.click('[data-mp=paye]'); await p.waitForTimeout(800);
    const declare = s.journal.find((j) => j[0] === 'rpc' && j[1] === 'mensualite_declarer_avec_numero');
    ok(declare && JSON.parse(declare[2]).p_numero === '07 01 02 03 04' && JSON.parse(declare[2]).p_moyen === 'orange_money' && /L’agence vérifie/.test(await s.t()),
      nomEcran + ' : « J’ai payé » déclaré avec le moyen « Orange Money »');
    await s.ctx.close();
    // 3. virement (RIB) et carte (lien d'abord) ; Wave ne note rien de plus
    s = await mannequin(ecran, ALLUMES);
    await s.p.click('.pp-moyen[data-moyen="virement"]'); await s.p.waitForTimeout(200);
    ok(/Virez 10 000 FCFA à MA2M SARL/.test(await s.t()) && /CI000 00000/.test(await s.t()) && /Votre numéro de téléphone/.test(await s.t()), nomEcran + ' : virement → banque et RIB affichés');
    await s.p.click('.pp-moyen[data-moyen="carte"]'); await s.p.waitForTimeout(200);
    ok(await s.p.getAttribute('[data-mp=lien]', 'href') === 'https://paiement.exemple.ci/ma2m', nomEcran + ' : carte → lien de paiement');
    await s.p.fill('.mp-num', '07 01 02 03 04');
    ok(await s.p.isDisabled('[data-mp=paye]'), nomEcran + ' : carte : « J’ai payé » attend le passage par le lien');
    await s.p.locator('[data-mp=lien]').evaluate((a) => { a.removeAttribute('target'); a.addEventListener('click', (e) => e.preventDefault()); });
    await s.p.click('[data-mp=lien]'); await s.p.waitForTimeout(500);
    ok(!(await s.p.isDisabled('[data-mp=paye]')), nomEcran + ' : carte : après le lien, « J’ai payé » s’ouvre');
    await s.p.click('.pp-moyen[data-moyen="wave"]'); await s.p.waitForTimeout(200);
    await s.p.locator('[data-mp=wave]').evaluate((a) => { a.removeAttribute('target'); a.addEventListener('click', (e) => e.preventDefault()); });
    await s.p.click('[data-mp=wave]'); await s.p.waitForTimeout(500); await s.p.click('[data-mp=paye]'); await s.p.waitForTimeout(800);
    const w = s.journal.find((j) => j[1] === 'mensualite_declarer_avec_numero');
    ok(w && !('p_moyen' in JSON.parse(w[2])), nomEcran + ' : Wave : déclaré comme avant, sans moyen (Wave par défaut)');
    ok(!s.errs.length, nomEcran + ' : aucune erreur de page ' + s.errs.join(' | '));
    await s.ctx.close();
  }

  // 4. Administration : Paramètres > Moyens de paiement, Paiements à valider
  const TABLE = [{ code: 'wave', nom: 'Wave', actif: true, ordre: 1 }, { code: 'orange_money', nom: 'Orange Money', actif: false, ordre: 2 }, { code: 'mtn_money', nom: 'MTN Money', actif: false, ordre: 3 },
    { code: 'moov_money', nom: 'Moov Money', actif: false, ordre: 4 }, { code: 'carte', nom: 'Carte bancaire (Visa)', actif: false, ordre: 5 }, { code: 'virement', nom: 'Virement bancaire', actif: false, ordre: 6 }];
  for (const [nomEcran, ecran, role] of [['téléphone', { width: 390, height: 844 }, 'principal'], ['ordinateur', { width: 1280, height: 900 }, 'principal'], ['ordinateur', { width: 1280, height: 900 }, 'caisse']]) {
    const n = nomEcran + ' (' + role + ') : ';
    const ctx = await b.newContext({ viewport: ecran, serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { portail: { aal: 'aal1', facteurs: true }, tables: { moyens_paiement: TABLE.map((x) => Object.assign({}, x)), liens_wave: [] },
      rpc: { portail_moi: { role, mfa: true, nom: 'Admin', actif: true, membre: true, espaces: { site: false, paiements: true, compta: false }, contacts_prives: false, noms_payeurs: true },
        portail_enregistrer_appareil: { ok: true, nouveau: false }, portail_code_appareil_etat: { defini: true, verrouille: false } } }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/admin/'); await p.waitForSelector('#cx-mail', { timeout: 6000 });
    await p.fill('#cx-mail', 'k@test.ci'); await p.fill('#cx-mdp', 'motdepasse-tres-long'); await p.click('form[data-form="connexion"] [type=submit]');
    await p.waitForSelector('#cx-code'); await p.fill('#cx-code', '123456'); await p.click('form[data-form="code"] [type=submit]');
    await p.waitForTimeout(1500);
    await p.goto('http://127.0.0.1:' + PORT + '/admin/#/paiements/parametres');
    await p.waitForFunction(() => /Moyens de paiement des mannequins/.test((document.getElementById('contenu') || {}).innerText || ''), null, { timeout: 8000 }).catch(() => {});
    const t = await p.evaluate(() => document.getElementById('contenu').innerText);
    ok(/Moyens de paiement des mannequins/.test(t) && ['Wave', 'Orange Money', 'MTN Money', 'Moov Money', 'Carte bancaire (Visa)', 'Virement bancaire'].every((x) => t.includes(x)), n + 'les 6 moyens dans les Paramètres');
    const modifier = await p.$$('[data-action="moyen-modifier"]');
    if (role !== 'principal') { ok(!modifier.length && /Seul l’administrateur principal peut modifier les moyens/.test(t), n + 'pas de « Modifier » pour un autre rôle'); await ctx.close(); continue; }
    ok(modifier.length === 6, n + '« Modifier » sur les 6 moyens');
    const pales = (await lirePageEntiere(p)).map((x) => x.texte.slice(0, 25)); ok(!pales.length, n + 'textes lisibles ' + pales.join(' | '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse sur le côté');
    await p.click('[data-action="moyen-modifier"][data-code="orange_money"]'); await p.waitForSelector('#mo-numero');
    await p.fill('#mo-numero', 'abc'); await p.check('form[data-form="moyen-enregistrer"] [name=actif]'); await p.click('form[data-form="moyen-enregistrer"] [type=submit]'); await p.waitForTimeout(400);
    ok(!journal.some((j) => j[0] === 'PATCH' && j[1] === 'moyens_paiement'), n + 'numéro invalide refusé avant l’envoi');
    await p.fill('#mo-numero', '07 11 22 33 44'); await p.fill('#mo-titulaire', 'MA2M');
    await p.click('form[data-form="moyen-enregistrer"] [type=submit]'); await p.waitForTimeout(1200);
    const patch = journal.filter((j) => j[0] === 'PATCH' && j[1] === 'moyens_paiement').map((j) => JSON.parse(j[3] || '{}')).pop() || {};
    ok(patch.actif === true && patch.numero === '07 11 22 33 44' && patch.titulaire === 'MA2M', n + 'Orange Money allumé avec son numéro ' + JSON.stringify(patch));
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ moyens de paiement : tout est bon'); process.exit(ko ? 1 : 0);
})();
