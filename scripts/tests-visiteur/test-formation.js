// Formation de 18 mois de cours (chantier 14, partie 2, 01/11/2026 ; décisions de la propriétaire), comme une
// vraie personne, base SIMULÉE (rien n'est écrit pour de vrai) :
//  - « Mes paiements » de la mannequin : 18 mois de cours numérotés, congés (décembre, janvier, février) en gris
//    sans mensualité, un mois de congé payé « compte pour le mois de cours suivant », paiement à l'avance sans congé ;
//  - Administration (Paiements) : pendant les congés, pas d'appel ; formation terminée : pas d'appel ; paiements
//    mois par mois avec ○ congés, ◇ formation terminée, ✓ mois réglé par un congé payé ; récapitulatif sans
//    congés comptés comme impayés ; sorties : « Formation terminée (18 mois de cours) ».
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const chemin = require('path');
const PORT = String(9530 + Math.floor(Math.random() * 40));
const BASE = 'http://127.0.0.1:' + PORT;
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JETON = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'u-awa', role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 }) + '.c2ln';
const SESSION = { access_token: JETON, refresh_token: 'faux', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: 'u-awa', email: 'awa@test.ci', aud: 'authenticated', role: 'authenticated' } };
const ici = new Date();
const iso = (dec) => { const d = new Date(ici.getFullYear(), ici.getMonth() + dec, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };
const conge = (m) => [12, 1, 2].includes(Number(m.slice(5, 7)));
const COURANT = iso(0);

// calendrier de la mannequin : du mois en cours jusqu'au 18e mois de cours ; le mois en cours payé (ou congé),
// le PREMIER mois de congé payé (il compte pour le mois de cours suivant), le reste à venir
function calendrier() {
  const mois = []; let cours = 0, congePaye = false;
  for (let i = 0; cours < 18; i++) {
    const m = iso(i), c = conge(m);
    let etat = c ? 'conge' : 'a_venir';
    if (i === 0) etat = c ? 'conge' : 'paye';
    else if (c && !congePaye) { etat = 'paye'; congePaye = true; }
    if (!c) cours++;
    mois.push({ mois: m, etat, conge: c });
  }
  return mois;
}

async function mesPaiements(b) {
  const MOIS = calendrier();
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const n = 'Mes paiements, ' + nomEcran + ' : ';
    const ctx = await b.newContext({ viewport: ecran }); const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript((s) => { localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify(s)); }, SESSION);
    await brancher(p, { tables: {}, rpc: { mes_mensualites: () => ({ inscrit: true, nom: 'KONÉ AWA', mensualite: 20000, statut: 'actif', mineur: false, total: 18, fin: MOIS[MOIS.length - 1].mois, mois: MOIS }),
      lien_paiement: () => null, mes_recus: () => [], mes_cachets: () => [] } }, journal);
    await p.goto(BASE + '/app/mes-paiements.html'); await p.waitForSelector('.mp-calendrier', { timeout: 8000 });
    const t = await p.evaluate(() => document.getElementById('mp-zone').innerText);
    const payesCours = MOIS.filter((m) => !m.conge && m.etat === 'paye').length;
    ok(/Ma formation · 18 mois de cours/i.test(t) && new RegExp(payesCours + ' mois réglés? sur 18').test(t), n + '« 18 mois de cours », ' + payesCours + ' réglé(s) sur 18 (le congé payé n’est pas compté deux fois)');
    const nums = await p.$$eval('.mp-calendrier .mp-mois', (l) => l.map((x) => (x.querySelector('.mp-mois-num') || { textContent: '' }).textContent));
    ok(nums.filter(Boolean).join(',') === Array.from({ length: 18 }, (_, i) => i + 1).join(',') && nums.length === MOIS.length, n + 'les mois de cours numérotés de 1 à 18, les congés sans numéro');
    const congesGris = await p.$$eval('.mp-calendrier .mp-mois.conge', (l) => l.map((x) => x.innerText));
    ok(congesGris.length === MOIS.filter((m) => m.conge && m.etat === 'conge').length && congesGris.every((x) => /Congés : pas de mensualité/.test(x)), n + 'congés en gris : « Congés : pas de mensualité »');
    ok(/Payé · compte pour le mois de cours suivant/.test(t), n + 'un mois de congé déjà payé : « compte pour le mois de cours suivant »');
    const avance = await p.$eval('#avance', (x) => x.innerText).catch(() => '');
    const prochains = MOIS.filter((m) => !m.conge && m.mois > COURANT).slice(0, 3).map((m) => m.mois);
    ok(avance && !/décembre|janvier|février/i.test(avance.split('Mois payés')[1] || '') && (await p.$$eval('#mp-avance-nb option', (o) => o.length)) === prochains.length,
      n + 'paiement à l’avance : les 3 prochains mois de cours, jamais un mois de congé');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne déborde');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 3).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
}

async function administration(b) {
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = 'Administration, ' + nomEcran + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (dl) => dl.accept());
    const d = donnees('principal');
    const ids = d.tables.agence_mannequins.map((m) => m.id);
    // scénario 1 : mois de cours ; r0 formation terminée (fin il y a 2 mois), les autres en cours
    let scenario = 'cours';
    d.rpc.mensualites_etats = (x) => {
      const debut = x.p_debut, fin = x.p_fin, liste = [];
      for (let i = 0; ; i++) { const dd = new Date(Number(debut.slice(0, 4)), Number(debut.slice(5, 7)) - 1 + i, 1); const m = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-01'; if (m > fin) break; liste.push(m); }
      const congesPeriode = scenario === 'conges' ? liste.filter((m) => m === COURANT || conge(m)) : liste.filter(conge);
      return { conges: congesPeriode, mannequins: ids.map((id) => ({ id, debut: '2025-03-01', fin: id === 'r0' ? iso(-2) : '2027-11-01',
        etats: Object.fromEntries(liste.map((m) => [m, congesPeriode.includes(m) ? 'conge' : id === 'r0' && m > iso(-2) ? 'termine' : id === 'r3' && m === iso(-1) ? 'paye' : scenario === 'conges' && m < COURANT ? 'paye' : m > COURANT ? 'a_venir' : m < COURANT ? 'non_paye' : 'a_payer'])) })) };
    };
    d.rpc.mensualites_appeler = () => [];
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, BASE + '/admin/'); await p.waitForSelector('.accueil-tete', { timeout: 10000 }).catch(() => {});
    // appel du mois
    await p.goto(BASE + '/admin/#/paiements/mensualites'); await p.waitForSelector('form[data-form="mensualites-appel"]', { timeout: 8000 }).catch(() => {});
    const r0 = await p.$('input[name="ids"][value="r0"]');
    ok(r0 && await r0.isDisabled() && !(await r0.isChecked()) && /Formation terminée/.test(await p.textContent('.contenu')), n + 'appel du mois : formation terminée → pas cochée, impossible à appeler');
    ok(await p.isChecked('input[name="ids"][value="r4"]').catch(() => false), n + 'appel du mois : une mannequin en formation reste cochée');
    // paiements mois par mois
    await p.goto(BASE + '/admin/#/paiements/matrice'); await p.waitForSelector('.matrice, .tableau', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(600);
    const sr = await p.$$eval('.sr-only', (l) => l.map((x) => x.textContent).join(' | '));
    ok(/congés, pas de mensualité/.test(sr) && /formation terminée/.test(sr), n + 'mois par mois : ○ congés et ◇ formation terminée (lus aussi par les lecteurs d’écran)');
    ok(iso(-1).slice(0, 4) !== COURANT.slice(0, 4) || conge(iso(-1)) || /payé par un mois de congé réglé plus tôt/.test(sr), n + 'mois par mois : un mois réglé par un congé payé est vert');
    ok(/○ congés/.test(await p.textContent('.contenu')) && /◇ formation terminée/.test(await p.textContent('.contenu')), n + 'mois par mois : la légende explique les nouveaux signes');
    // sorties : formation terminée
    await p.goto(BASE + '/admin/#/paiements/sorties'); await p.waitForTimeout(1500);
    const ts = await p.textContent('.contenu');
    ok(/Formation terminée \(18 mois de cours\)/.test(ts) && (await p.$$('[data-action="sortie-formation-terminee"]')).length === 1, n + 'sorties : la mannequin dont les 18 mois de cours sont finis est proposée à la sortie');
    // récapitulatif : une mannequin dont la formation est finie garde ses mois impayés d'avant la fin
    await p.goto(BASE + '/admin/#/paiements/recapitulatif'); await p.waitForTimeout(1800);
    const nomR0 = d.tables.agence_mannequins[0].full_name;
    const nonPaye = await p.evaluate(() => [...document.querySelectorAll('.contenu .carte')].filter((c) => /Non payé/.test((c.querySelector('h2') || {}).textContent || '')).map((c) => c.innerText).join(' '));
    ok(nonPaye.includes(nomR0), n + 'récapitulatif : formation terminée, mais ses mois impayés d’avant restent dus (« Non payé »)');
    // scénario 2 : le mois en cours est un mois de congé
    scenario = 'conges';
    await p.goto(BASE + '/admin/#/paiements/tableau'); await p.waitForTimeout(300);
    await p.goto(BASE + '/admin/#/paiements/mensualites'); await p.waitForTimeout(1800);
    const tm = await p.textContent('.contenu');
    ok(/pas de mensualité, pas d’appel ni de relance/.test(tm) && !(await p.$('form[data-form="mensualites-appel"]')), n + 'pendant les congés : pas d’appel du mois, et c’est expliqué');
    await p.goto(BASE + '/admin/#/paiements/recapitulatif'); await p.waitForTimeout(1800);
    const tr = (await p.textContent('.contenu')).replace(/\s+/g, ' ');
    ok(/Non payé\s*0(?!\d)/i.test(tr), n + 'récapitulatif pendant les congés (mois d’avant réglés) : personne n’est compté comme impayé ' + tr.slice(0, 140));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne déborde');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  await mesPaiements(b);
  await administration(b);
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
