// Comptabilité — « Payer les mannequins » (js/portail/espace-compta-cachets.js), essayé comme
// l'agence sur téléphone et ordinateur dans la nouvelle Administration, base SIMULÉE : nouveau
// cachet (mannequin du registre ou personne extérieure), numéro mis au format Wave, « Marquer
// payé » (compte Wave proposé d'abord, code redemandé par la base si besoin), annulation avec
// motif ; le comptable prépare mais ne paie pas. Aucun argent ne bouge, rien n'est écrit.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9200 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const capture = (p, nom) => process.env.CAPTURES ? p.screenshot({ path: process.env.CAPTURES + '/' + nom + '.png', fullPage: true }) : null;

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ', suffixe = tel ? '-tel' : '-pc';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    const d = donnees('principal');
    // une mannequin mineure (avec son parent) déjà payée : son reçu doit partir au parent
    Object.assign(d.tables.agence_mannequins[5], { date_naissance: '2012-03-03', parent_nom: 'Madame Diallo Mère', parent_telephone: '0707000005' });
    d.tables.cachets_mannequins.push({ id: 'cc9', beneficiaire: d.tables.agence_mannequins[5].full_name, telephone: '2250700000015', montant: 8000, prestation: 'Shooting photo · essai', motif: 'shooting',
      numero_recu: 'MA2M-CA-2026-0002', jeton: '99999999-2222-3333-4444-555555555555', statut: 'paye', mode: 'wave_manuel', compte_id: 'k2', agence_mannequin_id: 'r5', paye_le: '2026-10-16T10:00:00Z', cree_le: '2026-10-16T09:00:00Z' });
    await brancher(p, d, journal);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');

    await p.goto(URL_ADMIN + '#/compta/cachets'); await p.waitForSelector('[data-action="cachet-nouveau"]', { timeout: 10000 }); await p.waitForTimeout(800);
    ok(/Rien à payer/.test(await p.textContent('#contenu')) && /GRÂCE YAO/.test(await p.textContent('#contenu')) && /réf\. T_AB12/.test(await p.textContent('#contenu')), n + 'rien à payer ; l’historique montre le cachet déjà payé et sa référence');
    // reçu du cachet payé : WhatsApp avec le reçu, et sa page
    const waRecu = await p.$$eval('.cachet.fait a[href^="https://wa.me/"]', (l) => l.map((a) => a.href).find((h) => /0001/.test(decodeURIComponent(h))) || '');
    const texteRecu = decodeURIComponent((waRecu || '').split('?text=')[1] || '');
    ok(/^https:\/\/wa\.me\/2250700000012\?text=/.test(waRecu || '') && /Reçu n° MA2M-CA-2026-0001/.test(texteRecu) && /Montant reçu : 15 000 FCFA/.test(texteRecu) && /\/recu\?r=11111111-2222-3333-4444-555555555555/.test(texteRecu),
      n + 'cachet payé : « Envoyer le reçu sur WhatsApp » avec le numéro, le montant et le lien du reçu');
    ok(!!(await p.$('.cachet.fait a[href$="/recu?r=11111111-2222-3333-4444-555555555555"]')), n + 'cachet payé : « Voir le reçu »');
    const waMineure = await p.$$eval('.cachet.fait a[href^="https://wa.me/"]', (l) => l.map((a) => a.href).find((h) => /0002/.test(decodeURIComponent(h))) || '');
    ok(/^https:\/\/wa\.me\/2250707000005\?/.test(waMineure) && /Bonjour Madame Diallo Mère/.test(decodeURIComponent(waMineure)) && /paiement du cachet de /.test(decodeURIComponent(waMineure)),
      n + 'mannequin mineure : le reçu part à son parent, qui est salué');
    ok(await p.$('#menu-lateral a.nav[href="#/compta/cachets"]') !== null, n + '« Payer les mannequins » dans le menu de la Comptabilité');
    // 1. mannequin du registre : nom et numéro remplis d'office
    await p.click('[data-action="cachet-nouveau"]'); await p.waitForSelector('#ca-qui', { state: 'attached' }); await p.waitForTimeout(600);
    // la mannequin se choisit par sa photo (23/10/2026)
    ok((await p.$$('.choix-visages .cvi-item .vis')).length >= 1 && await p.isVisible('.cvi-item[data-valeur="r0"]'), n + '« Qui ? » : les mannequins du registre avec leur photo');
    await p.click('.cvi-item[data-valeur="r0"]'); await p.waitForTimeout(200);
    ok(await p.inputValue('#ca-nom') === 'AYA KOUASSI' && await p.inputValue('#ca-tel') === '0700000010', n + 'mannequin du registre : nom et numéro remplis');
    await p.selectOption('#ca-projet', 'p1'); await p.fill('#ca-montant', '25000');
    // motif choisi dans une liste (22/10/2026)
    ok((await p.$$eval('#ca-motif option', (o) => o.map((x) => x.textContent))).join('|') === '— Choisir —|Défilé|Shooting photo|Campagne publicitaire|Tournage vidéo|Événement / hôtesse|Casting rémunéré|Autre', n + 'motif du cachet : liste de choix');
    await p.selectOption('#ca-motif', 'defile');
    // commission de l'agence (22/10/2026) : montant total saisi, commission et part de la mannequin affichées
    ok(/Montant total de la prestation/.test(await p.textContent('label[for="ca-montant"]')) && /20 % : 5 000 FCFA · à verser à la mannequin : 20 000 FCFA/.test((await p.textContent('#ca-calcul')).replace(/\u202f|\u00a0/g, ' ')), n + 'commission de 20 % et montant à verser affichés pendant la saisie');
    await p.click('form[data-form="cachet-ajouter"] [type=submit]'); await p.waitForTimeout(1200);
    const cree = journal.filter((j) => j[0] === 'POST' && j[1] === 'cachets_mannequins').map((j) => JSON.parse(j[3]))[0] || {};
    ok(cree.montant_prestation === 25000, n + 'montant total de la prestation envoyé : la base calcule la commission');
    ok(cree.motif === 'defile' && /^Défilé · ABIDJAN BORDER FORUM/.test(cree.prestation), n + 'motif enregistré, et repris en tête de la prestation (' + cree.prestation + ')');
    ok(await p.$('.cachet .visage-lien .vis') !== null, n + 'cachet d’une mannequin du registre : sa photo en médaillon, qui ouvre sa fiche');
    ok(cree.telephone === '2250700000010' && cree.montant === 25000 && cree.projet_id === 'p1' && /ABIDJAN BORDER FORUM/.test(cree.prestation) && cree.agence_mannequin_id === 'r0', n + 'cachet ajouté : numéro au format Wave, prestation reprise du projet (' + JSON.stringify(cree).slice(0, 120) + ')');
    // 2. personne extérieure, numéro faux refusé
    await p.click('[data-action="cachet-nouveau"]'); await p.waitForSelector('#ca-nom');
    await p.fill('#ca-nom', 'Koné Styliste'); await p.fill('#ca-tel', '12'); await p.selectOption('#ca-motif', 'autre'); await p.fill('#ca-prestation', 'Maquillage défilé'); await p.fill('#ca-montant', '10000');
    await p.click('form[data-form="cachet-ajouter"] [type=submit]'); await p.waitForTimeout(500);
    ok(journal.filter((j) => j[0] === 'POST' && j[1] === 'cachets_mannequins').length === 1, n + 'numéro Wave non valable : refusé');
    await p.fill('#ca-tel', '05 05 05 05 05'); await p.click('form[data-form="cachet-ajouter"] [type=submit]'); await p.waitForTimeout(1200);
    ok(journal.filter((j) => j[0] === 'POST' && j[1] === 'cachets_mannequins').length === 2 && (await p.$$('.cachet [data-action="cachet-payer"]')).length === 2, n + 'personne extérieure ajoutée ; 2 cachets à payer');
    ok(/35 000 FCFA/.test(await p.textContent('#contenu').then((x) => x.replace(/ | /g, ' '))), n + 'total à payer affiché');
    await capture(p, 'cachets' + suffixe);
    // 3. Marquer payé : compte Wave proposé d'abord, la base enregistre la dépense
    await p.click('.cachet [data-action="cachet-payer"]'); await p.waitForSelector('#cp-compte');
    ok(await p.inputValue('#cp-compte') === 'k2' && /AYA KOUASSI|Koné Styliste/.test(await p.textContent('.recap-cachet')), n + 'confirmation : récapitulatif, compte Wave proposé');
    ok(/Deux lignes entrent dans la comptabilité : la recette de la prestation/.test(await p.textContent('#fenetre')), n + 'confirmation : recette de la prestation et dépense du cachet annoncées (commission)');
    await capture(p, 'cachet-confirmer' + suffixe);
    await p.fill('#cp-ref', 'T_XY99'); await p.click('form[data-form="cachet-confirmer"] [type=submit]'); await p.waitForTimeout(1200);
    ok(journal.some((j) => j[0] === 'rpc' && j[1] === 'cachet_payer' && /"p_compte":"k2"/.test(j[2]) && /T_XY99/.test(j[2])), n + 'paiement enregistré (cachet_payer : dépense + cachet payé)');
    // 4. Annuler l'autre, avec motif
    await p.click('.cachet [data-action="cachet-annuler"]'); await p.fill('#cn-motif', 'Prestation annulée'); await p.click('form[data-form="cachet-annuler"] [type=submit]'); await p.waitForTimeout(1000);
    ok(journal.some((j) => j[0] === 'rpc' && j[1] === 'cachet_annuler' && /Prestation annulée/.test(j[2])), n + 'cachet annulé avec motif');
    // le pourcentage se règle ici (administrateur principal)
    await p.fill('#cc-taux', '25'); await p.click('form[data-form="cachet-commission"] [type=submit]'); await p.waitForTimeout(1000);
    const regl = journal.filter((j) => j[0] === 'PATCH' && j[1] === 'compta_reglages').map((j) => JSON.parse(j[3])).pop() || {};
    ok(regl.commission_taux === 25, n + 'commission de l’agence modifiable : 25 % enregistré');
    // 5. mannequin mineure sans parent enregistré : payée sur le Wave du parent, saisi ici et gardé (23/10/2026)
    Object.assign(d.tables.agence_mannequins[2], { date_naissance: '2013-05-05', parent_nom: null, parent_telephone: null });
    await p.goto(URL_ADMIN + '#/compta'); await p.waitForTimeout(400); await p.goto(URL_ADMIN + '#/compta/cachets'); await p.waitForSelector('[data-action="cachet-nouveau"]'); await p.waitForTimeout(800);
    await p.click('[data-action="cachet-nouveau"]'); await p.waitForSelector('.cvi-item[data-valeur="r2"]'); await p.click('.cvi-item[data-valeur="r2"]'); await p.waitForTimeout(200);
    ok(await p.isVisible('#ca-mineure') && await p.isVisible('#ca-parent-nom') && /Numéro Wave du parent/.test(await p.textContent('#ca-tel-libelle')) && (await p.inputValue('#ca-tel')) === '',
      n + 'mineure : « versé sur le Wave de son parent », nom et numéro du parent demandés');
    await p.selectOption('#ca-motif', 'shooting'); await p.fill('#ca-prestation', 'Shooting enfants'); await p.fill('#ca-montant', '10000'); await p.fill('#ca-tel', '07 07 12 12 12');
    await p.click('form[data-form="cachet-ajouter"] [type=submit]'); await p.waitForTimeout(600);
    ok(!journal.some((j) => j[0] === 'rpc' && j[1] === 'cachet_enregistrer_parent'), n + 'mineure : sans le nom du parent, rien n’est enregistré');
    await p.fill('#ca-parent-nom', 'Madame Yao Mère'); await p.click('form[data-form="cachet-ajouter"] [type=submit]'); await p.waitForTimeout(1200);
    const parentRpc = journal.filter((j) => j[0] === 'rpc' && j[1] === 'cachet_enregistrer_parent').map((j) => JSON.parse(j[2]))[0] || {};
    const creeMineure = journal.filter((j) => j[0] === 'POST' && j[1] === 'cachets_mannequins').map((j) => JSON.parse(j[3])).pop() || {};
    ok(parentRpc.p_mannequin === 'r2' && parentRpc.p_nom === 'Madame Yao Mère' && parentRpc.p_telephone === '2250707121212', n + 'parent enregistré dans le registre et sur la fiche (cachet_enregistrer_parent)');
    ok(creeMineure.agence_mannequin_id === 'r2' && creeMineure.telephone === '2250707121212' && creeMineure.parent_nom === 'Madame Yao Mère' && creeMineure.beneficiaire === 'GRÂCE YAO', n + 'cachet de la mineure : versé au numéro du parent, nom du parent gardé');
    ok(/versé au parent : Madame Yao Mère/.test(await p.textContent('#contenu')), n + 'liste « À payer » : « versé au parent »');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran');
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  // 4bis. SQL de la commission pas encore exécuté : saisie du montant versé, comme avant
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage(); const journal = [];
    const d = donnees('principal'); delete d.tables.compta_reglages[0].commission_taux;
    await brancher(p, d, journal); await seConnecter(p, URL_ADMIN); await p.waitForTimeout(1500);
    await p.goto(URL_ADMIN + '#/compta/cachets'); await p.waitForSelector('[data-action="cachet-nouveau"]', { timeout: 10000 }); await p.waitForTimeout(800);
    await p.click('[data-action="cachet-nouveau"]'); await p.waitForSelector('#ca-montant');
    ok(/Montant à verser/.test(await p.textContent('label[for="ca-montant"]')) && !(await p.$('#ca-calcul')) && !(await p.$('form[data-form="cachet-commission"]')), 'commission pas encore activée : « Montant à verser », sans calcul ni réglage');
    await ctx.close();
  }
  // 5. Le comptable prépare les cachets mais ne paie pas
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
    const d = donnees('compta'); d.tables.cachets_mannequins.push({ id: 'cc1', beneficiaire: 'AYA KOUASSI', telephone: '2250700000010', montant: 20000, prestation: 'Défilé', statut: 'a_payer', cree_le: new Date().toISOString() });
    await brancher(p, d, []); await seConnecter(p, URL_ADMIN); await p.waitForTimeout(1500);
    await p.goto(URL_ADMIN + '#/compta/cachets'); await p.waitForSelector('[data-action="cachet-nouveau"]', { timeout: 10000 }); await p.waitForTimeout(800);
    ok((await p.$$('[data-action="cachet-payer"]')).length === 0 && (await p.$$('[data-action="cachet-copier"]')).length === 1, 'comptable : voit et prépare, mais « Marquer payé » est réservé à l’administrateur principal');
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
