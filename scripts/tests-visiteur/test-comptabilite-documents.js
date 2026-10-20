// Espace 3 — Comptabilité, morceaux C, D et E (cahier v2.4, section 6), essayés comme une vraie
// personne, sur téléphone et ordinateur, avec une base SIMULÉE (rien n'est écrit pour de vrai) :
//  - documents : devis (lignes), facture tirée d'un devis, avoir, reçu d'une recette, états,
//    annulation avec motif, PDF d'une facture « non fiscal » (texte relu dans le PDF) ;
//  - impôts et taxes : échéancier répété chaque mois, paiement, TVA désactivée hors mode légal ;
//  - identité et mode légal : lecture seule pour le comptable, activation par l'administrateur
//    principal ;
//  - dossier du mois : Excel (feuilles et montants relus) et PDF (résumé + justificatifs : PDF
//    ajouté, photo mise en page, format illisible signalé).
const { chromium } = require('playwright'); const { spawn, execFileSync } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const { verifierBoutons } = require('./boutons');
const PDFLib = require('../../js/vendor/pdf-lib-1.17.1.min.js');
const PORT = String(9500 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const MOIS = new Date().toISOString().slice(0, 7), JOUR = MOIS + '-02', AN = MOIS.slice(0, 4);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
// lecture des fichiers téléchargés (Excel : openpyxl ; PDF : pypdf)
const python = (code, chemin) => JSON.parse(execFileSync('python3', ['-I', '-c', code, chemin]).toString());
const LIRE_XLSX = 'import sys, json, openpyxl\nw = openpyxl.load_workbook(sys.argv[1])\nprint(json.dumps({n: [[c for c in r] for r in w[n].iter_rows(values_only=True)] for n in w.sheetnames}, default=str))';
const LIRE_PDF = 'import sys, json, pypdf\nr = pypdf.PdfReader(sys.argv[1])\nprint(json.dumps({"pages": len(r.pages), "texte": "\\n".join(p.extract_text() or "" for p in r.pages)}))';

function donnees(role, fichiers) {
  const d = {
    portail: { aal: 'aal1', facteurs: true },
    fichiers,
    tables: {
      compta_comptes: [{ id: 'c1', nom: 'Caisse (espèces)', type: 'caisse', solde_initial: 10000, date_initiale: '2026-01-01', actif: true, cree_le: '2026-01-01' },
        { id: 'c2', nom: 'Wave Business', type: 'wave', solde_initial: 0, date_initiale: '2026-01-01', actif: true, cree_le: '2026-01-02' }],
      compta_ecritures: [
        { id: 'e1', sens: 'recette', date_op: JOUR, montant: 50000, compte_id: 'c1', categorie: 'casting', libelle: 'Casting défilé', tiers: 'Sococé', source: 'manuel', annule: false, justificatif: MOIS + '/a.pdf' },
        { id: 'e4', sens: 'recette', date_op: JOUR, montant: 15000, compte_id: 'c2', categorie: 'inscription', libelle: 'Droit d’inscription d’un mannequin', source: 'espace2', annule: false },
        { id: 'e2', sens: 'depense', date_op: JOUR, montant: 30000, compte_id: 'c1', categorie: 'loyer', libelle: 'Loyer du bureau', source: 'manuel', annule: false, justificatif: MOIS + '/b.png' },
        { id: 'e3', sens: 'depense', date_op: JOUR, montant: 2000, compte_id: 'c1', categorie: 'transport', libelle: 'Taxi', source: 'manuel', annule: false },
        { id: 'e5', sens: 'depense', date_op: JOUR, montant: 8000, compte_id: 'c2', categorie: 'communication', libelle: 'Crédit téléphone', source: 'manuel', annule: false, justificatif: MOIS + '/c.heic' },
        { id: 'e6', sens: 'depense', date_op: JOUR, montant: 25000, compte_id: 'c1', categorie: 'impots', libelle: 'CNPS · ' + MOIS, source: 'manuel', annule: false }],
      compta_tiers: [{ id: 't1', nom: 'Sococé', type: 'client', actif: true, telephone: '0102030405' }, { id: 't2', nom: 'Imprimerie Plateau', type: 'fournisseur', actif: true }],
      compta_documents: [
        { id: 'dv1', type: 'devis', numero: 'NF-DEV-' + AN + '-0001', fiscal: false, date_doc: JOUR, tiers_id: 't1', destinataire: { nom: 'Sococé', telephone: '0102030405' }, etat: 'en_attente', annule: false,
          lignes: [{ designation: 'Défilé', quantite: 2, prix: 100000 }], total_ht: 200000, tva: 0, tva_taux: 0, total_ttc: 200000, cree_le: JOUR + 'T09:00:00Z' },
        { id: 'fa1', type: 'facture', numero: 'NF-FAC-' + AN + '-0001', fiscal: false, date_doc: JOUR, tiers_id: 't1', destinataire: { nom: 'Sococé', telephone: '0102030405' }, etat: 'emis', annule: false,
          lignes: [{ designation: 'Shooting catalogue', quantite: 1, prix: 200000 }], total_ht: 200000, tva: 0, tva_taux: 0, total_ttc: 200000, dette_id: 'dd1', cree_le: JOUR + 'T08:00:00Z' }],
      compta_reglages: [{ id: 1, nom_commercial: 'Maître Akesse Model Management', telephone: '0700000000', adresse: 'Abidjan, Cocody', tva_taux: 18, mode_legal: false }],
      compta_impots: [{ id: 'i1', nom: 'Patente', periode: AN, echeance: '2026-01-15', montant: 120000, annule: false },
        { id: 'i2', nom: 'CNPS', periode: MOIS, echeance: JOUR, montant: 25000, ecriture_id: 'e6', annule: false }],
      compta_materiel: []
    },
    rpc: {
      portail_moi: { role, mfa: true, nom: role === 'principal' ? 'Maître Akesse' : 'Comptable', actif: true, membre: true, espaces: { site: role === 'principal', paiements: role === 'principal', compta: true }, contacts_prives: role === 'principal', noms_payeurs: role === 'principal' },
      portail_enregistrer_appareil: { ok: true, nouveau: false },
      portail_code_appareil_etat: { defini: true, verrouille: false },
      compta_soldes: [{ compte_id: 'c1', nom: 'Caisse (espèces)', type: 'caisse', solde: 3000 }, { compte_id: 'c2', nom: 'Wave Business', type: 'wave', solde: 7000 }],
      compta_tresorerie: [{ compte_id: 'c1', nom: 'Caisse (espèces)', ouvert: true, debut: 10000, entrees: 50000, sorties: 57000, fin: 3000 },
        { compte_id: 'c2', nom: 'Wave Business', ouvert: true, debut: 0, entrees: 15000, sorties: 8000, fin: 7000 }],
      compta_dettes_etat: (q) => (q.p_sens === 'creance' ? [{ id: 'dd1', sens: 'creance', tiers_id: 't1', date_op: JOUR, echeance: null, montant: 200000, categorie: 'prestation', libelle: 'Facture NF-FAC-' + AN + '-0001',
        annule: false, regle: 0, avoirs: 0, reste: 200000, retard: false, facture: 'NF-FAC-' + AN + '-0001' }] : []),
      compta_document_creer: (q) => ({ id: 'nouveau', numero: 'NF-' + q.p.type.toUpperCase() + '-' + AN + '-0009' }),
      compta_impot_payer: 'e-nouveau'
    }
  };
  return d;
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  // justificatif PDF d'essai (1 page avec un texte reconnaissable)
  const source = await PDFLib.PDFDocument.create();
  const police = await source.embedFont(PDFLib.StandardFonts.Helvetica);
  source.addPage([300, 300]).drawText('Quittance de loyer essai', { x: 20, y: 150, size: 14, font: police });
  const fichiers = { ['compta-justificatifs/' + MOIS + '/a.pdf']: { type: 'application/pdf', octets: Buffer.from(await source.save()) },
    ['compta-justificatifs/' + MOIS + '/b.png']: { type: 'image/png', octets: PNG },
    ['compta-justificatifs/' + MOIS + '/c.heic']: { type: 'image/heic', octets: Buffer.from('pas une vraie photo') } };
  const b = await chromium.launch();
  const url = 'http://127.0.0.1:' + PORT + '/admin/';
  const ouvrir = async (role, ecran) => {
    const ctx = await b.newContext({ viewport: ecran, serviceWorkers: 'block', acceptDownloads: true });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const d = donnees(role, fichiers);
    await brancher(p, d, journal);
    await p.goto(url); await p.waitForSelector('#cx-mail', { timeout: 6000 });
    await p.fill('#cx-mail', 'k@test.ci'); await p.fill('#cx-mdp', 'motdepasse-tres-long'); await p.click('form[data-form="connexion"] [type=submit]');
    await p.waitForSelector('#cx-code'); await p.fill('#cx-code', '123456'); await p.click('form[data-form="code"] [type=submit]');
    await p.waitForFunction(() => document.querySelector('.tuile, #contenu h1'), null, { timeout: 6000 }).catch(() => {});
    return { ctx, p, errs, journal, d };
  };
  const texte = (p) => p.evaluate(() => document.getElementById('contenu').innerText);
  const calque = (p) => p.textContent('#calque');
  const aller = async (p, page) => {
    await p.goto(url + '#/compta/' + page);
    await p.waitForFunction((pg) => location.hash === '#/compta/' + pg && document.querySelector('#contenu h1') && !document.querySelector('#contenu .chargement'), page, { timeout: 8000 }).catch(() => {});
  };
  const controler = async (p, nom) => {
    const boutons = (await p.evaluate(verifierBoutons)).map((x) => x.texte); ok(!boutons.length, nom + ' : boutons au modèle rouge ' + boutons.join(' | '));
    const pales = (await lirePageEntiere(p)).map((x) => x.texte.slice(0, 25) + ' (' + x.contraste + ')'); ok(!pales.length, nom + ' : textes lisibles ' + pales.join(' | '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nom + ' : rien ne dépasse sur le côté');
  };
  const rpc = (journal, nom) => journal.filter((j) => j[0] === 'rpc' && j[1] === nom).map((j) => JSON.parse(j[2] || '{}'));
  const patch = (journal, table) => journal.filter((j) => j[0] === 'PATCH' && j[1] === table).map((j) => JSON.parse(j[3] || '{}'));
  const telecharger = async (p, selecteur) => {
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click(selecteur)]);
    // (copié sous son vrai nom : openpyxl reconnaît un Excel à son extension)
    const chemin = require('path').join(require('os').tmpdir(), 'essai-' + Date.now() + '-' + dl.suggestedFilename());
    await dl.saveAs(chemin);
    return { nom: dl.suggestedFilename(), chemin };
  };

  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const { ctx, p, errs, journal } = await ouvrir('compta', ecran);

    // ---------- C. Documents ----------
    await aller(p, 'documents'); let t = await texte(p);
    ok(t.includes('Mode non fiscal') && t.includes('NF-FAC-' + AN + '-0001') && t.includes('NF-DEV-' + AN + '-0001'), nomEcran + ' : documents du mois, mode non fiscal annoncé');
    ok(!(await p.$('[data-action="compta-doc-fne"]')), nomEcran + ' : pas de « N° FNE » pour un document non fiscal');
    ok(await p.getAttribute('#do-date', 'max') === new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Abidjan' }), nomEcran + ' : la date d’un document ne peut pas être dans le futur');
    await controler(p, nomEcran + ' : documents');
    await p.selectOption('#do-type', 'facture');
    ok(await p.isVisible('#do-echeance') && !(await p.isVisible('#do-validite')) && !(await p.isVisible('#do-recette')), nomEcran + ' : facture → date limite de paiement, pas de validité');
    await p.selectOption('#do-type', 'devis');
    await p.click('form[data-form="compta-document"] [type=submit]'); await p.waitForTimeout(400);
    ok((await calque(p)).includes('au moins une ligne') && !rpc(journal, 'compta_document_creer').length, nomEcran + ' : devis sans ligne refusé');
    await p.fill('#dl-d0', 'Défilé de mode'); await p.fill('#dl-q0', '2'); await p.fill('#dl-p0', '150000');
    await p.click('[data-action="compta-doc-ligne"]'); await p.waitForSelector('#dl-d3');
    await p.fill('#dl-d3', 'Maquillage'); await p.fill('#dl-p3', '20000'); await p.fill('#do-validite', '2099-12-31');
    await p.click('form[data-form="compta-document"] [type=submit]'); await p.waitForTimeout(800);
    let cr = (rpc(journal, 'compta_document_creer').pop() || {}).p || {};
    ok(cr.type === 'devis' && cr.tiers_id === 't1' && cr.lignes.length === 2 && cr.lignes[0].quantite === 2 && cr.lignes[0].prix === 150000 && cr.lignes[1].quantite === 1 && cr.validite === '2099-12-31',
      nomEcran + ' : devis de deux lignes envoyé (la base numérote et calcule)');
    ok((await calque(p)).includes('NF-DEVIS-' + AN + '-0009'), nomEcran + ' : numéro du nouveau document annoncé');
    p.once('dialog', (dl) => dl.accept());
    await p.click('[data-action="compta-doc-facturer"][data-id="dv1"]'); await p.waitForTimeout(800);
    cr = (rpc(journal, 'compta_document_creer').pop() || {}).p || {};
    ok(cr.type === 'facture' && cr.origine_id === 'dv1' && cr.lignes[0].designation === 'Défilé' && (await calque(p)).includes('Ce qu’on nous doit'), nomEcran + ' : « Facturer » le devis → facture et somme due');
    await p.click('[data-action="compta-doc-accepte"][data-id="dv1"]'); await p.waitForTimeout(600);
    ok((patch(journal, 'compta_documents').pop() || {}).etat === 'accepte', nomEcran + ' : devis marqué « accepté »');
    await p.click('[data-action="compta-doc-avoir"][data-id="fa1"]'); await p.waitForSelector('#av-motif');
    await p.fill('#av-motif', 'Remise fidélité'); await p.fill('#av-montant', '20000'); await p.click('form[data-form="compta-doc-avoir"] [type=submit]'); await p.waitForTimeout(800);
    cr = (rpc(journal, 'compta_document_creer').pop() || {}).p || {};
    ok(cr.type === 'avoir' && cr.origine_id === 'fa1' && cr.lignes[0].prix === 20000 && cr.lignes[0].designation === 'Remise fidélité', nomEcran + ' : avoir sur la facture');
    await p.selectOption('#do-type', 'recu');
    ok(await p.isVisible('#do-recette') && !(await p.isVisible('#do-lignes')), nomEcran + ' : reçu → choix de la recette encaissée, sans lignes à taper');
    const proposees = await p.$$eval('#do-recette option', (l) => l.map((o) => o.value));
    ok(proposees.join() === 'e1', nomEcran + ' : seules les recettes saisies (pas celles de l’espace 2) sont proposées');
    await p.click('form[data-form="compta-document"] [type=submit]'); await p.waitForTimeout(800);
    cr = (rpc(journal, 'compta_document_creer').pop() || {}).p || {};
    ok(cr.type === 'recu' && cr.ecriture_id === 'e1' && cr.lignes[0].prix === 50000, nomEcran + ' : reçu de la recette (50 000)');
    p.once('dialog', (dl) => dl.accept('Client a changé d’avis'));
    await p.click('[data-action="compta-doc-annuler"][data-id="dv1"]'); await p.waitForTimeout(800);
    ok((patch(journal, 'compta_documents').pop() || {}).motif_annulation === 'Client a changé d’avis', nomEcran + ' : devis annulé avec son motif');
    ok(!(await p.$('[data-action="compta-doc-annuler"][data-id="fa1"]')), nomEcran + ' : une facture n’a pas de bouton « Annuler » (avoir)');
    let f = await telecharger(p, '[data-action="compta-doc-pdf"][data-id="fa1"]');
    let lu = python(LIRE_PDF, f.chemin);
    ok(f.nom === 'NF-FAC-' + AN + '-0001.pdf' && /FACTURE N° NF-FAC-\d{4}-0001/.test(lu.texte) && lu.texte.includes('Document non fiscal') && lu.texte.includes('Sococé') && lu.texte.includes('200 000 FCFA'),
      nomEcran + ' : PDF de la facture (numéro, client, total, « Document non fiscal »)');

    await p.click('[data-action="compta-doc-envoyer"][data-id="fa1"]'); await p.waitForSelector('#fenetre .boite', { timeout: 15000 }).catch(() => {});
    const boite = await p.evaluate(() => { const b = document.querySelector('#fenetre .boite'); return b ? { texte: b.innerText, liens: Array.from(b.querySelectorAll('a')).map((a) => a.getAttribute('href')) } : null; });
    ok(boite && /Envoyer NF-FAC/.test(boite.texte) && boite.liens.some((h) => /^https:\/\/wa\.me\/\d+\?text=/.test(h) && /NF-FAC/.test(decodeURIComponent(h))) && boite.liens.some((h) => /^mailto:/.test(h)),
      nomEcran + ' : « Envoyer » propose WhatsApp (numéro du client, message prêt) et e-mail ' + JSON.stringify(boite && boite.liens));
    ok(await p.$('[data-action="compta-doc-telecharger-envoi"]') !== null, nomEcran + ' : le PDF peut être téléchargé depuis la fenêtre d’envoi');
    await p.click('[data-action="fermer-fenetre"]'); await p.waitForTimeout(300);

    // ---------- D. Impôts et taxes ----------
    await aller(p, 'impots'); t = await texte(p);
    ok(/En retard\s*1/i.test(t) && /Reste à payer\s*120 000 FCFA/i.test(t) && /Désactivée/i.test(t), nomEcran + ' : patente en retard, 120 000 à payer, TVA désactivée');
    ok(!(await p.$('[data-action="compta-impot-payer"][data-id="i2"]')), nomEcran + ' : la CNPS payée n’a plus de bouton « Payer »');
    await controler(p, nomEcran + ' : impôts');
    await p.fill('#im-nom', 'ITS (impôt sur les salaires)'); await p.fill('#im-montant', '15000'); await p.fill('#im-date', '2026-01-31'); await p.selectOption('#im-repet', 'm');
    await p.click('form[data-form="compta-impot"] [type=submit]'); await p.waitForTimeout(800);
    const ech = JSON.parse((journal.filter((j) => j[0] === 'POST' && j[1] === 'compta_impots').pop() || [])[3] || '[]');
    ok(ech.length === 12 && ech[1].echeance === '2026-02-28' && ech[11].echeance === '2026-12-31' && ech[0].periode === 'janv. 2026', nomEcran + ' : échéance répétée 12 mois (fin de mois respectée)');
    await p.click('[data-action="compta-impot-payer"][data-id="i1"]'); await p.waitForSelector('#ip-montant');
    await p.click('form[data-form="compta-impot-payer"] [type=submit]'); await p.waitForTimeout(800);
    const pay = rpc(journal, 'compta_impot_payer').pop() || {};
    ok(pay.p_id === 'i1' && pay.p_montant === 120000 && pay.p_compte, nomEcran + ' : patente payée (dépense « Impôts et taxes »)');

    // ---------- Identité : lecture seule pour le comptable ----------
    await aller(p, 'identite');
    ok(await p.isDisabled('#rg-raison_sociale') && !(await p.$('[data-action="compta-mode-legal"]')), nomEcran + ' : comptable → identité en lecture seule, pas d’interrupteur');
    await controler(p, nomEcran + ' : identité');

    // ---------- E. Dossier du mois ----------
    await aller(p, 'dossier'); t = await texte(p);
    ok(/Dépenses sans justificatif\s*2/i.test(t) && t.includes('Il manque 2 justificatif'), nomEcran + ' : dossier → 2 dépenses sans justificatif signalées');
    await controler(p, nomEcran + ' : dossier');
    f = await telecharger(p, '[data-action="compta-dossier"][data-format="xlsx"]');
    const x = python(LIRE_XLSX, f.chemin);
    const feuilles = Object.keys(x);
    ok(f.nom === 'Dossier-' + MOIS + '-MA2M.xlsx' && feuilles.length === 11 && feuilles.includes('Recettes') && feuilles.includes('Clients (on nous doit)'), nomEcran + ' : Excel de 11 feuilles ' + feuilles.join(', '));
    const resume = Object.fromEntries(x['Résumé'].slice(1).map((r) => [r[0], r[1]]));
    ok(resume['Recettes du mois (FCFA)'] === 65000 && resume['Dépenses du mois (FCFA)'] === 65000 && resume['On nous doit, à ce jour (FCFA)'] === 200000, nomEcran + ' : Excel → recettes 65 000, dépenses 65 000, on nous doit 200 000');
    ok(x['Recettes'].length === 3 && x['Dépenses'].length === 5 && x['Recettes'].some((r) => r[5] === 50000) && x['Documents'].length === 3, nomEcran + ' : Excel → journaux et documents complets, montants en nombres');
    const treso = x['Trésorerie'].find((r) => r[0] === 'Caisse (espèces)');
    ok(treso && treso[4] === 10000 + 50000 - 30000 - 2000 - 25000, nomEcran + ' : Excel → solde de la caisse en fin de mois');
    f = await telecharger(p, '[data-action="compta-dossier"][data-format="pdf"]');
    lu = python(LIRE_PDF, f.chemin);
    ok(lu.texte.includes('Dossier du mois pour le comptable') && lu.texte.includes('Résultat') && lu.texte.includes('MANQUE'), nomEcran + ' : PDF → résumé complet, justificatifs manquants marqués');
    ok(lu.texte.includes('Quittance de loyer essai') && lu.texte.includes('Justificatif 2') && /Crédit t[ée]l[ée]phone/.test(lu.texte.split('consulter dans')[1] || ''),
      nomEcran + ' : PDF → justificatif PDF ajouté, photo mise en page, format illisible signalé (' + lu.pages + ' pages)');
    ok(!errs.length, nomEcran + ' : aucune erreur de page ' + errs.join(' | '));
    await ctx.close();

    // ---------- Mode légal : administrateur principal ----------
    const a = await ouvrir('principal', ecran);
    let demandes = 0;
    a.d.tables.compta_reglages[0].mode_legal = false;
    await aller(a.p, 'identite');
    await a.p.fill('#rg-raison_sociale', 'MA2M SARL'); await a.p.fill('#rg-rccm', 'CI-ABJ-2027-B-1'); await a.p.fill('#rg-ncc', '2700001A');
    await a.p.click('form[data-form="compta-identite"] [type=submit]'); await a.p.waitForTimeout(800);
    const id = patch(a.journal, 'compta_reglages').pop() || {};
    ok(id.raison_sociale === 'MA2M SARL' && id.ncc === '2700001A' && id.tva_taux === 18, nomEcran + ' : principal → identité légale enregistrée');
    a.p.on('dialog', (dl) => { demandes++; dl.accept(); });
    await a.p.click('[data-action="compta-mode-legal"]'); await a.p.waitForTimeout(800);
    ok(demandes === 1 && (patch(a.journal, 'compta_reglages').pop() || {}).mode_legal === true && (await calque(a.p)).includes('Mode légal activé'), nomEcran + ' : mode légal activé après confirmation');
    ok((await texte(a.p)).includes('Activé'), nomEcran + ' : l’interrupteur affiche « Activé », sans retour possible');
    a.d.tables.staff_profiles = (a.d.tables.staff_profiles || []).concat([{ user_id: 'u-cpt', nom: 'Awa Comptable', email: 'awa@exemple.ci', role: 'compta', actif: true, cree_le: '2026-10-01T10:00:00Z' }]);
    await aller(a.p, 'acces'); const tAcces = await texte(a.p);
    ok(/Accès du comptable/.test(tAcces) && /Awa Comptable/.test(tAcces) && /Couper l’accès/.test(tAcces) && (await a.p.$('a[href="#/securite/comptes"]')) !== null, nomEcran + ' : page « Accès du comptable » (liste, couper l’accès, inviter)');
    ok((await a.p.$$eval('a', (l) => l.map((x) => x.textContent.trim()))).includes('Accès du comptable'), nomEcran + ' : « Accès du comptable » dans le menu du principal');
    ok(!a.errs.length, nomEcran + ' : aucune erreur de page (principal) ' + a.errs.join(' | '));
    await a.ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ comptabilité (morceaux C, D et E) : tout est bon');
  process.exit(ko ? 1 : 0);
})();
