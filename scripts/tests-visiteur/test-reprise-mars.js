// Reprise du 1er mars 2027 (PLAN-REPRISE-MARS.md ; supabase-reprise-mars.sql), comme une vraie personne, sur
// téléphone et ordinateur, base SIMULÉE (rien n'est écrit pour de vrai) :
//  - Paiements › Reprise du 1er mars : fiche de formation de chaque mannequin (niveaux, mois déjà faits), inscriptions
//    jamais notées (déjà payée, à recevoir, abandonnée, toutes d'un coup), plus de bilan d'ouverture (07/11/2026 ; avant :
//    un écart sans raison est refusé, avec raison il part) ;
//  - Paiements : les mois du rodage « jamais réclamés » (tableau du mois, mois par mois) ;
//  - Archives – période de rodage : lecture seule, copie Excel (feuilles relues) et PDF (texte relu) ;
//  - Comptabilité › Clôture guidée : un paiement en attente bloque ; comptage, écart avec raison, mois verrouillé,
//    bilan du mois ; le comptable ne voit aucun nom de mannequin ;
//  - application des mannequins : « Niveau 1 sur 2 · mois 7 sur 9 · il reste 11 mois », « agence fermée jusqu'au 1er mars ».
const { chromium } = require('playwright'); const { spawn, execFileSync } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const chemin = require('path');
const PORT = String(9600 + Math.floor(Math.random() * 40));
const BASE = 'http://127.0.0.1:' + PORT;
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const python = (code, f) => JSON.parse(execFileSync('python3', ['-I', '-c', code, f]).toString());
const LIRE_XLSX = 'import sys, json, openpyxl\nw = openpyxl.load_workbook(sys.argv[1])\nprint(json.dumps({n: [[c for c in r] for r in w[n].iter_rows(values_only=True)] for n in w.sheetnames}, default=str))';
const LIRE_PDF = 'import sys, json, pypdf\nr = pypdf.PdfReader(sys.argv[1])\nprint(json.dumps({"pages": len(r.pages), "texte": "\\n".join(p.extract_text() or "" for p in r.pages)}))';
const ici = new Date();
const iso = (dec) => { const d = new Date(ici.getFullYear(), ici.getMonth() + dec, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };
const AUJ = ici.toISOString().slice(0, 10), PASSE = iso(-1);
const rpc = (journal, nom) => journal.filter((j) => j[0] === 'rpc' && j[1] === nom).map((j) => JSON.parse(j[2] || '{}'));
const sansDebord = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const texte = (p) => p.evaluate(() => document.getElementById('contenu').innerText);
async function aller(p, hash, attendre) {
  // (même adresse : passer d'abord par l'accueil, sinon la page n'est pas redessinée)
  if (p.url() === BASE + '/admin/#/' + hash) { await p.goto(BASE + '/admin/#/'); await p.waitForTimeout(300); }
  await p.goto(BASE + '/admin/#/' + hash);
  await p.waitForFunction((h) => location.hash === '#/' + h && document.querySelector('#contenu h1') && !document.querySelector('#contenu .chargement'), hash, { timeout: 8000 }).catch(() => {});
  if (attendre) await p.waitForSelector(attendre, { timeout: 6000 }).catch(() => {});
}
async function telecharger(p, selecteur) {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click(selecteur)]);
  const f = chemin.join(require('os').tmpdir(), 'essai-' + Date.now() + '-' + dl.suggestedFilename());
  await dl.saveAs(f);
  return { nom: dl.suggestedFilename(), f };
}

function etatReprise(d, ouvert) {
  const m = d.tables.agence_mannequins;
  return { date_reprise: ouvert ? iso(0) : '2027-03-01', aujourdhui: AUJ, ouverture: null,
    comptes: [{ id: 'c1', nom: 'Caisse (espèces)', type: 'caisse' }, { id: 'c2', nom: 'Wave Business', type: 'wave' }],
    mannequins: m.map((x, i) => ({ id: x.id, nom: x.full_name, statut: x.statut, niveaux: 2, mois_faits: i === 0 ? 7 : null, vue_le: i === 0 ? '2026-11-07T10:00:00Z' : null,
      inscription: i === 0 ? 'wave' : null, inscription_reprise: i === 1 ? 'a_recevoir' : null, inscription_due: i === 1 })) };
}
const TRESO = [{ compte_id: 'c1', nom: 'Caisse (espèces)', ouvert: true, debut: 0, entrees: 50000, sorties: 20000, fin: 30000 },
  { compte_id: 'c2', nom: 'Wave Business', ouvert: true, debut: 0, entrees: 15000, sorties: 0, fin: 15000 }];

async function paiements(b) {
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = 'Reprise, ' + nomEcran + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block', acceptDownloads: true });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (dl) => dl.accept());
    const d = donnees('principal');
    const ouvert = false;
    d.tables.compta_comptes = [{ id: 'c1', nom: 'Caisse (espèces)', type: 'caisse', actif: true, date_initiale: '2026-01-01', cree_le: '2026-01-01' }, { id: 'c2', nom: 'Wave Business', type: 'wave', actif: true, date_initiale: '2026-01-01', cree_le: '2026-01-02' }];
    d.rpc.reprise_etat = () => etatReprise(d, ouvert);
    d.rpc.compta_tresorerie = TRESO;
    d.rpc.reprise_mannequin_enregistrer = (x) => ({ id: x.p_id, reste: x.p_niveaux * 9 - x.p_mois_faits, debut: '2027-03-01', fin: '2028-11-01' });
    d.rpc.reprise_inscription = (x) => x.p_choix;
    d.rpc.compta_ouverture = [];
    const ids = d.tables.agence_mannequins.map((m) => m.id);
    // le mois en cours et les précédents : rodage (jamais réclamé)
    d.rpc.mensualites_etats = (x) => ({ conges: [], mannequins: ids.map((id) => ({ id, debut: '2027-03-01', fin: '2028-11-01', etats: (() => {
      const o = {}; for (let i = -14; i <= 2; i++) o[iso(i)] = iso(i) > iso(0) ? 'a_venir' : 'rodage'; return o; })() })) });
    d.rpc.archives_rodage = { debut: '2026-09-01', fin: '2026-11-01',
      mannequins: d.tables.agence_mannequins.slice(0, 3).map((m, i) => ({ id: m.id, nom: m.full_name, statut: 'actif', mensualite: 10000, etats: { '2026-09-01': i ? 'rodage' : 'paye', '2026-10-01': 'rodage', '2026-11-01': i === 2 ? 'attente' : 'rodage' } })),
      paiements: [{ nom: d.tables.agence_mannequins[0].full_name, objet: 'mensualite', mois: '2026-09-01', montant: 10000, mode: 'wave', statut: 'valide', le: '2026-09-03T10:00:00Z' }],
      ecritures: [{ date: '2026-09-03', sens: 'recette', montant: 10000, compte: 'Wave Business', categorie: 'formation', libelle: 'Mensualité de septembre', annule: false }],
      tresorerie: TRESO };
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, BASE + '/admin/'); await p.waitForSelector('.accueil-tete', { timeout: 10000 }).catch(() => {});

    // 1. assistant de reprise, avant le 1er mars
    await aller(p, 'paiements/reprise', 'form[data-form="reprise-mannequin"]');
    let t = await texte(p);
    ok(/Reprise du 1er mars/.test(t) && /1 sur 6 revues/.test(t), n + 'l’assistant s’ouvre : 1 mannequin revue sur 6');
    ok(/fermée jusqu’au 1er mars 2027/.test(t) && /10 000 FCFA par mois et 15 000 FCFA/.test(t), n + 'il explique : agence fermée jusqu’au 1er mars, 10 000 et 15 000 pour toutes');
    ok(/il reste 11 mois/.test(t), n + 'une fiche déjà revue : « il reste 11 mois » (7 mois faits sur 18)');
    ok((await p.$$('nav a[href="#/paiements/reprise"]')).length >= 1 || /Reprise du 1er mars/.test(await p.textContent('body')), n + 'l’entrée « Reprise du 1er mars » est dans le menu');
    // une mannequin : 1 niveau, 4 mois faits
    const id = ids[2];
    await p.selectOption('select[form="rp-' + id + '"][name="niveaux"]', '1');
    await p.fill('input[form="rp-' + id + '"][name="mois_faits"]', '12');
    await p.click('#rp-' + id + ' button[type=submit]'); await p.waitForTimeout(500);
    ok(!rpc(journal, 'reprise_mannequin_enregistrer').length && /de 0 à 9 pour 1 niveau/.test(await p.textContent('body')), n + '12 mois faits pour 1 niveau de 9 : refusé avec une phrase claire, rien n’est envoyé');
    await p.fill('input[form="rp-' + id + '"][name="mois_faits"]', '4');
    await p.click('#rp-' + id + ' button[type=submit]'); await p.waitForTimeout(800);
    const env = rpc(journal, 'reprise_mannequin_enregistrer')[0] || {};
    ok(env.p_id === id && env.p_niveaux === 1 && env.p_mois_faits === 4 && env.p_statut === 'actif', n + 'fiche enregistrée : 1 niveau, 4 mois faits, statut gardé');
    ok(/il reste 5 mois/.test(await p.textContent('body')), n + 'le site répond « il reste 5 mois de formation »');
    // inscriptions : la mannequin sans inscription (ni due) → « À recevoir »
    await aller(p, 'paiements/reprise', 'button[data-action="reprise-inscription"]');
    const boutons = await p.$$eval('button[data-action="reprise-inscription"]', (l) => [...new Set(l.map((x) => x.getAttribute('data-id')))]);
    ok(!boutons.includes(ids[0]) && !boutons.includes(ids[1]) && boutons.length === 4, n + 'inscriptions : seules celles jamais notées sont proposées (ni la payée, ni celle déjà « à recevoir »)');
    await p.click('button[data-action="reprise-inscription"][data-id="' + ids[3] + '"][data-choix="a_recevoir"]'); await p.waitForTimeout(800);
    const ins = rpc(journal, 'reprise_inscription')[0] || {};
    ok(ins.p_id === ids[3] && ins.p_choix === 'a_recevoir' && ins.p_montant === 15000, n + 'inscription « À recevoir » : 15 000 FCFA envoyés vers « Ce qu’on nous doit »');
    // toutes d'un coup : « réglées avant le nouveau système » (décision du 07/11/2026), sans bilan d'ouverture
    await aller(p, 'paiements/reprise', 'button[data-action="reprise-inscriptions-toutes"]');
    t = await texte(p);
    ok(!/Bilan d’ouverture/.test(t) && !(await p.$('form[data-form="reprise-ouverture"]')) && /comptabilité est repartie de zéro/.test(t), n + 'plus de bilan d’ouverture : la comptabilité est repartie de zéro, et c’est dit');
    await p.click('button[data-action="reprise-inscriptions-toutes"]'); await p.waitForTimeout(1500);
    const toutes = rpc(journal, 'reprise_inscription').slice(1);
    ok(toutes.length === 4 && toutes.every((x) => x.p_choix === 'encaissee' && x.p_montant === 15000), n + 'un seul bouton : les 4 inscriptions restantes notées « réglées avant le nouveau système » (rien dans la comptabilité)');
    ok(await sansDebord(p), n + 'assistant : rien ne déborde');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'assistant : textes lisibles ' + pales.slice(0, 3).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));

    // 3. le rodage n'est jamais réclamé
    await aller(p, 'paiements/tableau', '.tableau');
    t = await texte(p);
    ok(/Rodage : jamais réclamé/.test(t) && /Attendu\s*0 FCFA/i.test(t) && /période de rodage/i.test(t) && !/Relancer/.test(t), n + 'tableau du mois : « Rodage : jamais réclamé », rien d’attendu, pas de relance');
    await aller(p, 'paiements/matrice', '.matrice'); await p.waitForTimeout(400);
    ok(/rodage, jamais réclamé/.test(await p.$$eval('.sr-only', (l) => l.map((x) => x.textContent).join(' | '))) && /R rodage/.test(await texte(p)), n + 'mois par mois : « R » rodage, expliqué dans la légende');
    await aller(p, 'paiements/mensualites', '.contenu');
    ok(!(await p.$('form[data-form="mensualites-appel"]')) && /rien n’est réclamé, pas d’appel ni de relance/.test(await texte(p)), n + 'appel du mois : pas d’appel pendant le rodage, et c’est expliqué');

    // 4. archives du rodage
    await aller(p, 'paiements/archives-rodage', 'button[data-action="archives-copie"]');
    t = await texte(p);
    ok(/Lecture seule/.test(t) && /jamais réclamés/.test(t) && /Non payé \(jamais réclamé\)/.test(t) && !(await p.$('#contenu input, #contenu select, #contenu form')), n + 'archives : lecture seule, mois non payés « jamais réclamés », rien à modifier');
    const x = await telecharger(p, 'button[data-action="archives-copie"][data-format="xlsx"]');
    const classeur = python(LIRE_XLSX, x.f);
    ok(/^Archives-rodage-2026-09-a-2026-11-MA2M\.xlsx$/.test(x.nom) && ['Mannequins', 'Paiements', 'Écritures', 'Trésorerie'].every((f) => classeur[f]) && classeur.Mannequins.length === 4 && classeur.Paiements[1][3] === 10000,
      n + 'archives : copie Excel (mannequins, paiements, écritures, trésorerie ; les nombres restent des nombres)');
    const pdf = python(LIRE_PDF, (await telecharger(p, 'button[data-action="archives-copie"][data-format="pdf"]')).f);
    ok(/Archives . période de rodage/.test(pdf.texte) && /jamais\s+réclamé/.test(pdf.texte) && pdf.texte.includes(d.tables.agence_mannequins[0].full_name), n + 'archives : copie PDF lisible');
    ok(await sansDebord(p), n + 'archives : rien ne déborde');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
}

async function cloture(b) {
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = 'Clôture guidée, ' + nomEcran + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (dl) => dl.accept());
    const d = donnees('compta');
    d.tables.compta_comptes = [{ id: 'c1', nom: 'Caisse (espèces)', type: 'caisse', actif: true, date_initiale: '2026-01-01', cree_le: '2026-01-01' }, { id: 'c2', nom: 'Wave Business', type: 'wave', actif: true, date_initiale: '2026-01-01', cree_le: '2026-01-02' }];
    d.tables.compta_clotures = [];
    let enAttente = 1;
    d.rpc.cloture_en_attente = () => enAttente;
    d.rpc.compta_tresorerie = TRESO;
    d.rpc.compta_cloturer_complet = (x) => { d.tables.compta_clotures.push({ mois: x.p_mois, recettes: 65000, depenses: 20000, nb_ecritures: 3, note: x.p_note, cloture_le: AUJ + 'T10:00:00Z' }); return { mois: x.p_mois }; };
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, BASE + '/admin/'); await p.waitForTimeout(800);
    await aller(p, 'compta/cloture-guidee', '#cp-mois');
    ok(/n’est pas terminé/.test(await texte(p)), n + 'le mois en cours ne se clôture pas, et c’est dit');
    await p.fill('#cp-mois', PASSE.slice(0, 7)); await p.click('form[data-form="compta-mois"] [type=submit]');
    await p.waitForSelector('form[data-form="cloture-guidee"]', { timeout: 6000 }).catch(() => {});
    let t = await texte(p);
    ok(/1 paiement\(s\) « J’ai payé » à vérifier/.test(t) && await p.isDisabled('form[data-form="cloture-guidee"] button[type=submit]'), n + 'un paiement « J’ai payé » en attente bloque la clôture');
    ok(!/MARIAM|GRÂCE|AYA/.test(t), n + 'le comptable ne voit aucun nom de mannequin');
    enAttente = 0;
    await aller(p, 'compta/mois', null); await aller(p, 'compta/cloture-guidee', 'form[data-form="cloture-guidee"]');
    ok(/Aucun paiement en attente/.test(await texte(p)), n + 'plus rien en suspens');
    await p.fill('input[name="montant-c2"]', '14500');
    await p.click('form[data-form="cloture-guidee"] button[type=submit]'); await p.waitForTimeout(500);
    ok(!rpc(journal, 'compta_cloturer_complet').length && /indiquez-en la raison/.test(await p.textContent('body')), n + 'écart Wave sans raison : refusé');
    await p.fill('input[name="motif-c2"]', 'Frais Wave du mois');
    await p.click('form[data-form="cloture-guidee"] button[type=submit]'); await p.waitForTimeout(1000);
    const c = rpc(journal, 'compta_cloturer_complet')[0] || {};
    ok(c.p_mois === PASSE && (c.p_comptages || []).length === 2 && c.p_comptages[1].montant === 14500 && c.p_comptages[1].motif === 'Frais Wave du mois', n + 'clôture envoyée : mois, chaque compte compté, raison de l’écart');
    t = await texte(p);
    ok(/Mois clôturé le/.test(t) && /ne change plus/.test(t) && await p.$('button[data-action="compta-dossier"][data-format="pdf"]') && await p.$('button[data-action="compta-dossier"][data-format="xlsx"]'), n + 'mois verrouillé, bilan du mois en PDF et en Excel proposé');
    ok(/Clôture guidée/.test(await p.textContent('nav, .menu, body')), n + 'l’entrée « Clôture guidée » est dans le menu de la Comptabilité');
    ok(!(await p.$('a[href="#/paiements/archives-rodage"]')), n + 'le comptable n’a pas les archives du rodage (noms des mannequins)');
    ok(await sansDebord(p), n + 'rien ne déborde');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
}

async function application(b) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const JETON = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'u-awa', role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 }) + '.c2ln';
  const SESSION = { access_token: JETON, refresh_token: 'faux', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: 'u-awa', email: 'awa@test.ci', aud: 'authenticated', role: 'authenticated' } };
  const mois = [];
  for (let i = 0; i < 8; i++) mois.push({ mois: iso(i), etat: iso(i) < '2027-03-01' ? ([12, 1, 2].includes(Number(iso(i).slice(5, 7))) ? 'conge' : 'rodage') : 'a_venir', conge: [12, 1, 2].includes(Number(iso(i).slice(5, 7))) });
  const MM = { inscrit: true, nom: 'KONÉ AWA', mensualite: 10000, statut: 'actif', mineur: false, total: 18, niveaux: 2, faits_avant: 7, niveau: 1, mois_niveau: 7, reste: 11, termine: false,
    fermee_jusqu_au: '2027-03-01', prochaine: '2027-03-01', fin: '2028-11-01', mois };
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const n = 'Application, ' + nomEcran + ' : ';
    const ctx = await b.newContext({ viewport: ecran }); const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript((s) => { localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify(s)); }, SESSION);
    await brancher(p, { tables: {}, rpc: { mes_mensualites: () => MM, lien_paiement: () => null, mes_recus: () => [], mes_cachets: () => [] } }, journal);
    await p.goto(BASE + '/app/mes-paiements.html'); await p.waitForSelector('.mp-calendrier', { timeout: 8000 }).catch(() => {});
    const t = await p.evaluate(() => document.getElementById('mp-zone').innerText);
    ok(/Ma formation · Niveau 1 sur 2/i.test(t) && /Mois 7 sur 9 · il reste 11 mois/.test(t), n + '« Niveau 1 sur 2 · mois 7 sur 9 · il reste 11 mois »');
    ok(/Agence fermée jusqu’au 1er mars 2027 : aucune mensualité à payer/.test(t) && /Prochaine mensualité : mars 2027 · 10 000 FCFA/.test(t), n + '« Agence fermée jusqu’au 1er mars 2027 », prochaine mensualité : mars 2027');
    ok(!/À payer avant le 5|n’est pas encore fait/.test(t) && !(await p.$('.mp-carte:not(#avance) [data-payer], .mp-carte:not(#avance) .mp-wave')), n + 'rien à payer pendant la fermeture (seul le paiement à l’avance reste possible)');
    const nums = await p.$$eval('.mp-calendrier .mp-mois-num', (l) => l.map((x) => x.textContent));
    ok(nums[0] === '8', n + 'le premier mois de cours de la reprise porte le numéro 8 (après les 7 déjà faits) ' + nums.join(','));
    ok(await sansDebord(p), n + 'rien ne déborde');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 3).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  await paiements(b);
  await cloture(b);
  await application(b);
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
