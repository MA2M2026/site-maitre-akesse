// Espace 3 — Comptabilité, morceaux A et B (cahier v2.4, section 6), essayé comme une vraie personne
// (le comptable), sur téléphone et ordinateur, avec une base SIMULÉE (rien n'est écrit pour de vrai) :
//  - tableau du mois : recettes, dépenses, résultat, dépenses sans justificatif, trésorerie ;
//  - recettes de l'espace 2 arrivées toutes seules, sans nom de mannequin, non annulables ;
//  - nouvelle dépense avec justificatif (photo ou PDF), mauvais fichier refusé ;
//  - justificatif joint après coup, justificatif ouvert par un lien temporaire ;
//  - annulation avec motif (rien ne s'efface) ;
//  - trésorerie : virement entre deux comptes, ajout d'un compte, solde de départ ;
//  - morceau B : ce qu'on nous doit / ce qu'on doit (règlement en plusieurs fois, retard,
//    annulation), paiement du personnel, matériel durable (achat, sortie avec motif), carnet ;
//  - le responsable des encaissements n'entre pas dans la comptabilité.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const { verifierBoutons } = require('./boutons');
const PORT = String(9400 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const MOIS = new Date().toISOString().slice(0, 7), JOUR = MOIS + '-02';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function donnees(role) {
  const d = {
    portail: { aal: 'aal1', facteurs: true },
    tables: {
      compta_comptes: [{ id: 'c1', nom: 'Caisse (espèces)', type: 'caisse', solde_initial: 0, date_initiale: MOIS + '-01', actif: true, cree_le: '2026-10-01' },
        { id: 'c2', nom: 'Wave Business', type: 'wave', solde_initial: 100000, date_initiale: MOIS + '-01', actif: true, cree_le: '2026-10-02' }],
      compta_ecritures: [
        { id: 'e1', sens: 'recette', date_op: JOUR, montant: 15000, compte_id: 'c2', categorie: 'inscription', libelle: 'Droit d’inscription d’un mannequin', source: 'espace2', annule: false },
        { id: 'e2', sens: 'recette', date_op: JOUR, montant: 50000, compte_id: 'c1', categorie: 'casting', libelle: 'Casting défilé', tiers: 'Client essai', source: 'manuel', annule: false },
        { id: 'e3', sens: 'depense', date_op: JOUR, montant: 30000, compte_id: 'c1', categorie: 'loyer', libelle: 'Loyer du bureau', source: 'manuel', annule: false },
        { id: 'e4', sens: 'depense', date_op: JOUR, montant: 5000, compte_id: 'c2', categorie: 'frais_wave', libelle: 'Frais Wave', source: 'manuel', annule: false, justificatif: MOIS + '/1-2-3-4.pdf' },
        { id: 'e5', sens: 'virement', date_op: JOUR, montant: 20000, compte_id: 'c2', compte_dest_id: 'c1', categorie: 'virement', libelle: 'Retrait Wave pour la caisse', source: 'manuel', annule: false },
        { id: 'e6', sens: 'recette', date_op: JOUR, montant: 40000, compte_id: 'c2', categorie: 'casting', libelle: 'Règlement : Défilé Sococé', tiers_id: 't1', tiers: 'Sococé', dette_id: 'd1', source: 'manuel', annule: false }],
      compta_tiers: [{ id: 't1', nom: 'Sococé', type: 'client', actif: true }, { id: 't2', nom: 'Imprimerie Plateau', type: 'fournisseur', actif: true },
        { id: 't3', nom: 'Assistante Fatou', type: 'personnel', actif: true }],
      // d1 : 300 000 dus par le client, 40 000 déjà réglés, échéance passée ; d2 : facture fournisseur à payer
      compta_dettes: [{ id: 'd1', sens: 'creance', tiers_id: 't1', date_op: JOUR, echeance: '2026-01-01', montant: 300000, categorie: 'casting', libelle: 'Défilé Sococé', annule: false },
        { id: 'd2', sens: 'dette', tiers_id: 't2', date_op: JOUR, echeance: '2099-12-31', montant: 80000, categorie: 'communication', libelle: 'Impression des books', annule: false }],
      compta_materiel: [{ id: 'm1', designation: 'Appareil photo', date_achat: JOUR, montant: 400000, etat: 'en_service', emplacement: 'Studio' }]
    },
    rpc: {
      portail_moi: { role, mfa: true, nom: role === 'compta' ? 'Comptable' : 'Encaissements', actif: true, membre: true, espaces: { site: false, paiements: role === 'caisse', compta: role === 'compta' }, contacts_prives: false, noms_payeurs: role === 'caisse' },
      portail_enregistrer_appareil: { ok: true, nouveau: false },
      portail_code_appareil_etat: { defini: true, verrouille: false },
      compta_soldes: [{ compte_id: 'c1', nom: 'Caisse (espèces)', type: 'caisse', solde: 40000 }, { compte_id: 'c2', nom: 'Wave Business', type: 'wave', solde: 90000 }],
      // (la vraie base calcule réglé / reste / retard : compta_dettes_etat)
      compta_dettes_etat: (q) => d.tables.compta_dettes.filter((x) => x.sens === q.p_sens).map((x) => {
        const regle = d.tables.compta_ecritures.filter((e) => e.dette_id === x.id && !e.annule).reduce((s, e) => s + e.montant, 0);
        const reste = x.annule ? 0 : x.montant - regle;
        return Object.assign({}, x, { regle, avoirs: 0, reste, retard: reste > 0 && x.echeance < new Date().toISOString().slice(0, 10), facture: null });
      })
    }
  };
  return d;
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const url = 'http://127.0.0.1:' + PORT + '/admin/';
  const ouvrir = async (role, ecran) => {
    const ctx = await b.newContext({ viewport: ecran, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const d = donnees(role);
    await brancher(p, d, journal);
    await p.goto(url); await p.waitForSelector('#cx-mail', { timeout: 6000 });
    await p.fill('#cx-mail', 'k@test.ci'); await p.fill('#cx-mdp', 'motdepasse-tres-long'); await p.click('form[data-form="connexion"] [type=submit]');
    await p.waitForSelector('#cx-code'); await p.fill('#cx-code', '123456'); await p.click('form[data-form="code"] [type=submit]');
    return { ctx, p, errs, journal, d };
  };
  const texte = (p) => p.evaluate(() => document.getElementById('contenu').innerText);
  const aller = async (p, page) => {
    await p.goto(url + '#/compta/' + page);
    await p.waitForFunction(() => document.querySelector('#contenu h1') && !document.querySelector('#contenu .chargement'), null, { timeout: 6000 }).catch(() => {});
  };
  const controler = async (p, nom) => {
    const boutons = (await p.evaluate(verifierBoutons)).map((x) => x.texte); ok(!boutons.length, nom + ' : boutons au modèle rouge ' + boutons.join(' | '));
    const pales = (await lirePageEntiere(p)).map((x) => x.texte.slice(0, 25) + ' (' + x.contraste + ')'); ok(!pales.length, nom + ' : textes lisibles ' + pales.join(' | '));
    const deborde = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); ok(!deborde, nom + ' : rien ne dépasse sur le côté');
  };
  const envoi = (journal, methode, table) => journal.filter((j) => j[0] === methode && j[1] === table).map((j) => JSON.parse(j[3] || '{}'));

  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const { ctx, p, errs, journal, d } = await ouvrir('compta', ecran);
    await p.waitForFunction(() => location.hash === '#/compta/mois' && document.querySelector('#contenu h1'), null, { timeout: 6000 }).catch(() => {});
    ok(p.url().endsWith('#/compta/mois'), nomEcran + ' : le comptable arrive sur le tableau du mois');
    await p.waitForFunction(() => !document.querySelector('#contenu .chargement'), null, { timeout: 6000 }).catch(() => {});
    let t = await texte(p);
    ok(/Recettes du mois\s*105 000 FCFA/i.test(t) && /Dépenses du mois\s*35 000 FCFA/i.test(t) && /Résultat du mois\s*70 000 FCFA/i.test(t),
      nomEcran + ' : recettes 105 000, dépenses 35 000, résultat 70 000 (le virement ne compte ni en recette ni en dépense)');
    ok(/On nous doit\s*260 000 FCFA/i.test(t) && /Nous devons\s*80 000 FCFA/i.test(t), nomEcran + ' : on nous doit 260 000, nous devons 80 000');
    ok(/Dépenses sans justificatif\s*1/i.test(t) && /Wave Business\s*90 000 FCFA/i.test(t), nomEcran + ' : dépense sans justificatif signalée, soldes de trésorerie');
    await controler(p, nomEcran + ' : tableau du mois');
    ok(/Tableau de bord/.test(t) && /Mode actuel : Pré-légal/.test(t) && /Activer le mode légal et la FNE/.test(t), nomEcran + ' : tableau de bord avec le mode légal / FNE en évidence');
    if (ecran.width > 860) {
      const menu = await p.$$eval('.menu a, nav a', (l) => l.map((a) => a.textContent.trim()));
      const ordre = ['Tableau de bord', 'Recettes', 'Devis, proforma, factures', 'Dépenses et charges', 'Impôts et taxes', 'Clôture mensuelle', 'Paramètres de l’entité'];
      const pos = ordre.map((x) => menu.indexOf(x));
      ok(pos.every((x, i) => x >= 0 && (i === 0 || x > pos[i - 1])), nomEcran + ' : menu dans l’ordre du plan ' + JSON.stringify(menu.slice(0, 12)));
    }

    // Recettes : celle de l'espace 2 est marquée « automatique » et ne s'annule pas d'ici
    await aller(p, 'recettes'); t = await texte(p);
    ok(t.includes('Espace 2 · automatique') && (await p.$$('[data-action="compta-annuler"]')).length === 2 && !(await p.$('[data-action="compta-annuler"][data-id="e1"]')), nomEcran + ' : recette de l’espace 2 automatique, sans bouton « Annuler »');
    await controler(p, nomEcran + ' : recettes');

    // Dépenses : mauvais fichier refusé, puis une vraie dépense avec son justificatif
    await aller(p, 'depenses');
    await controler(p, nomEcran + ' : dépenses');
    await p.fill('#cp-montant', '12000'); await p.selectOption('#cp-cat', 'transport'); await p.fill('#cp-libelle', 'Taxi casting');
    await p.setInputFiles('#cp-justif', { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('essai') });
    await p.click('form[data-form="compta-ecrire"] [type=submit]'); await p.waitForTimeout(500);
    ok((await p.textContent('#calque')).includes('une photo') && !envoi(journal, 'POST', 'compta_ecritures').length, nomEcran + ' : un fichier qui n’est ni photo ni PDF est refusé');
    await p.setInputFiles('#cp-justif', { name: 'recu.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 essai') });
    await p.click('form[data-form="compta-ecrire"] [type=submit]'); await p.waitForTimeout(800);
    const depot = journal.find((j) => j[0] === 'STOCKAGE');
    const dep = envoi(journal, 'POST', 'compta_ecritures')[0] || {};
    ok(depot && depot[1].startsWith('compta-justificatifs/' + MOIS + '/') && depot[1].endsWith('.pdf'), nomEcran + ' : justificatif déposé dans le stockage privé');
    ok(dep.sens === 'depense' && dep.montant === 12000 && dep.categorie === 'transport' && dep.justificatif && depot[1].endsWith(dep.justificatif), nomEcran + ' : dépense enregistrée avec son justificatif');
    ok((await p.textContent('#calque')).includes('Dépense enregistrée'), nomEcran + ' : message « Dépense enregistrée »');

    // Photo d'iPhone (HEIC) : convertie en JPEG quand le navigateur la lit, sinon gardée telle quelle
    await p.fill('#cp-montant', '3000'); await p.fill('#cp-libelle', 'Photo iPhone lisible');
    await p.setInputFiles('#cp-justif', { name: 'recu.heic', mimeType: 'image/heic', buffer: PNG });
    await p.click('form[data-form="compta-ecrire"] [type=submit]'); await p.waitForTimeout(1000);
    let depots = journal.filter((j) => j[0] === 'STOCKAGE');
    ok(/\.jpg$/.test(depots[depots.length - 1][1]), nomEcran + ' : photo HEIC lisible → convertie en JPEG avant l’envoi');
    await p.fill('#cp-montant', '3000'); await p.fill('#cp-libelle', 'Photo iPhone illisible ici');
    await p.setInputFiles('#cp-justif', { name: 'recu2.heic', mimeType: 'image/heic', buffer: Buffer.from('pas une photo') });
    await p.click('form[data-form="compta-ecrire"] [type=submit]'); await p.waitForTimeout(1000);
    depots = journal.filter((j) => j[0] === 'STOCKAGE');
    ok(/\.heic$/.test(depots[depots.length - 1][1]), nomEcran + ' : photo HEIC que ce navigateur ne lit pas → gardée telle quelle');
    ok(!(await p.$('[data-action="compta-justif-joindre"][data-id="e4"]')) && await p.$('[data-action="compta-justif-voir"][data-id="e4"]'),
      nomEcran + ' : un justificatif déjà joint ne se remplace pas (pas de bouton « Joindre »)');

    // refus de la base (droits) : annoncé, jamais « Justificatif joint »
    await p.click('[data-action="compta-justif-joindre"][data-id="e3"]'); await p.waitForSelector('#cp-justif2');
    const e3 = d.tables.compta_ecritures.splice(d.tables.compta_ecritures.findIndex((e) => e.id === 'e3'), 1)[0];
    await p.setInputFiles('#cp-justif2', { name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await p.click('form[data-form="compta-justif"] [type=submit]'); await p.waitForTimeout(800);
    ok((await p.textContent('#calque')).includes('Action refusée'), nomEcran + ' : justificatif refusé par la base → « Action refusée »');
    d.tables.compta_ecritures.push(e3); await p.click('[data-action="fermer-fenetre"]');
    // Justificatif joint après coup au loyer, puis ouvert
    await p.click('[data-action="compta-justif-joindre"][data-id="e3"]'); await p.waitForSelector('#cp-justif2');
    await p.setInputFiles('#cp-justif2', { name: 'quittance.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
    await p.click('form[data-form="compta-justif"] [type=submit]'); await p.waitForTimeout(800);
    const joint = envoi(journal, 'PATCH', 'compta_ecritures').pop() || {};
    ok(/\.jpg$/.test(joint.justificatif || '') && !(await p.isVisible('#cp-justif2')), nomEcran + ' : justificatif joint au loyer après coup');
    await p.click('[data-action="compta-justif-voir"][data-id="e4"]'); await p.waitForSelector('#fenetre a.btn');
    ok(/token=essai/.test(await p.getAttribute('#fenetre a.btn', 'href')), nomEcran + ' : justificatif ouvert par un lien temporaire');
    await p.click('[data-action="fermer-fenetre"]');

    // Annulation : sans motif rien ne se passe ; avec motif, l'écriture reste, barrée
    const avantAnnul = envoi(journal, 'PATCH', 'compta_ecritures').length;
    p.once('dialog', (dl) => dl.dismiss());
    await p.click('[data-action="compta-annuler"][data-id="e3"]'); await p.waitForTimeout(400);
    ok(envoi(journal, 'PATCH', 'compta_ecritures').length === avantAnnul, nomEcran + ' : annulation abandonnée → rien n’est envoyé');
    p.once('dialog', (dl) => dl.accept('Saisi deux fois'));
    await p.click('[data-action="compta-annuler"][data-id="e3"]'); await p.waitForTimeout(800);
    const annul = envoi(journal, 'PATCH', 'compta_ecritures')[avantAnnul] || {};
    ok(annul.annule === true && annul.motif_annulation === 'Saisi deux fois', nomEcran + ' : annulation envoyée avec son motif');
    ok(await p.isVisible('tr.annulee') && (await texte(p)).includes('Saisi deux fois'), nomEcran + ' : l’écriture annulée reste visible, barrée, avec le motif');

    // Trésorerie : virement, compte ajouté, solde de départ
    await aller(p, 'tresorerie'); t = await texte(p);
    ok(/Total disponible\s*130 000 FCFA/i.test(t), nomEcran + ' : total disponible de la trésorerie');
    await controler(p, nomEcran + ' : trésorerie');
    await p.fill('#vi-montant', '10000'); await p.fill('#vi-libelle', 'Dépôt à la banque');
    await p.selectOption('#vi-vers', 'c1'); await p.selectOption('#vi-de', 'c1');
    await p.click('form[data-form="compta-virement"] [type=submit]'); await p.waitForTimeout(400);
    ok((await p.textContent('#calque')).includes('deux comptes différents'), nomEcran + ' : virement vers le même compte refusé');
    await p.selectOption('#vi-de', 'c2');
    await p.click('form[data-form="compta-virement"] [type=submit]'); await p.waitForTimeout(800);
    const vir = envoi(journal, 'POST', 'compta_ecritures').pop() || {};
    ok(vir.sens === 'virement' && vir.compte_id === 'c2' && vir.compte_dest_id === 'c1' && vir.montant === 10000, nomEcran + ' : virement Wave → caisse enregistré');
    await p.fill('#co-nom', 'Banque essai'); await p.selectOption('#co-type', 'banque'); await p.fill('#co-solde', '250000');
    await p.click('form[data-form="compta-compte"] [type=submit]'); await p.waitForTimeout(800);
    const cpt = envoi(journal, 'POST', 'compta_comptes')[0] || {};
    ok(cpt.nom === 'Banque essai' && cpt.type === 'banque' && cpt.solde_initial === 250000, nomEcran + ' : compte bancaire ajouté avec son solde de départ');
    await p.click('[data-action="compta-compte-modifier"][data-id="c1"]'); await p.waitForSelector('#cm-solde');
    await p.fill('#cm-solde', '75000'); await p.click('form[data-form="compta-compte-modifier"] [type=submit]'); await p.waitForTimeout(800);
    const modif = envoi(journal, 'PATCH', 'compta_comptes')[0] || {};
    ok(modif.solde_initial === 75000 && modif.actif === true && (await p.textContent('#calque')).includes('Compte enregistré'), nomEcran + ' : solde de départ de la caisse corrigé');
    d.refus = { compta_comptes: 'Gardez au moins un compte Wave actif : les paiements de l’espace 2 y arrivent.' };
    await p.click('[data-action="compta-compte-modifier"][data-id="c2"]'); await p.waitForSelector('#cm-actif');
    await p.uncheck('#cm-actif'); await p.click('form[data-form="compta-compte-modifier"] [type=submit]'); await p.waitForTimeout(800);
    ok((await p.textContent('#calque')).includes('Gardez au moins un compte Wave actif'), nomEcran + ' : fermer le dernier compte Wave → refusé, avec l’explication');
    d.refus = null; await p.click('[data-action="fermer-fenetre"]');

    // Morceau B — ce qu'on nous doit : reste, retard, encaissement partiel
    await aller(p, 'a-recevoir'); t = await texte(p);
    ok(/Reste à encaisser\s*260 000 FCFA/i.test(t) && t.includes('En retard') && !(await p.$('[data-action="compta-annuler"][data-id="d1"]')),
      nomEcran + ' : créance en retard, reste 260 000, pas d’annulation après un règlement');
    ok((await p.$$eval('#dt-tiers option', (l) => l.map((o) => o.textContent))).join('|') === 'Sococé', nomEcran + ' : seuls les clients sont proposés');
    await controler(p, nomEcran + ' : ce qu’on nous doit');
    await p.click('[data-action="compta-regler"][data-id="d1"]'); await p.waitForSelector('#rg-montant');
    ok(await p.inputValue('#rg-montant') === '260000', nomEcran + ' : « Encaisser » propose le reste dû');
    await p.fill('#rg-montant', '300000'); await p.click('form[data-form="compta-regler"] [type=submit]'); await p.waitForTimeout(400);
    ok((await p.textContent('#calque')).includes('entre 1 et 260 000'), nomEcran + ' : encaisser plus que le reste est refusé');
    await p.fill('#rg-montant', '60000'); await p.click('form[data-form="compta-regler"] [type=submit]'); await p.waitForTimeout(800);
    let rg = envoi(journal, 'POST', 'compta_ecritures').pop() || {};
    ok(rg.dette_id === 'd1' && rg.sens === 'recette' && rg.montant === 60000 && rg.categorie === 'casting' && (await p.textContent('#calque')).includes('Reste 200 000'),
      nomEcran + ' : encaissement partiel enregistré comme recette, reste 200 000 annoncé');
    await p.fill('#dt-montant', '150000'); await p.fill('#dt-libelle', 'Shooting catalogue'); await p.fill('#dt-echeance', '2099-01-31');
    await p.click('form[data-form="compta-dette"] [type=submit]'); await p.waitForTimeout(800);
    const cr = envoi(journal, 'POST', 'compta_dettes').pop() || {};
    ok(cr.sens === 'creance' && cr.tiers_id === 't1' && cr.montant === 150000 && cr.echeance === '2099-01-31', nomEcran + ' : nouvelle somme due par un client');

    // Ce qu'on doit : annulation avec motif, paiement en totalité
    await aller(p, 'a-payer');
    await controler(p, nomEcran + ' : ce qu’on doit');
    p.once('dialog', (dl) => dl.accept('Facture en double'));
    await p.click('[data-action="compta-annuler"][data-id="d2"]'); await p.waitForTimeout(800);
    const an = envoi(journal, 'PATCH', 'compta_dettes').pop() || {};
    ok(an.annule === true && an.motif_annulation === 'Facture en double' && journal.some((j) => j[0] === 'PATCH' && j[1] === 'compta_dettes' && /id=eq\.d2/.test(j[2])),
      nomEcran + ' : facture fournisseur annulée avec son motif');
    d.tables.compta_dettes[1].annule = false;  // (base simulée : on la remet pour essayer le paiement)
    await aller(p, 'carnet'); await aller(p, 'a-payer');
    await p.click('[data-action="compta-regler"][data-id="d2"]'); await p.waitForSelector('#rg-montant');
    await p.click('form[data-form="compta-regler"] [type=submit]'); await p.waitForTimeout(800);
    rg = envoi(journal, 'POST', 'compta_ecritures').pop() || {};
    ok(rg.dette_id === 'd2' && rg.sens === 'depense' && rg.montant === 80000 && (await p.textContent('#calque')).includes('Réglé en totalité'), nomEcran + ' : facture payée en totalité, dépense enregistrée');

    // Personnel et prestataires
    await aller(p, 'personnel');
    await controler(p, nomEcran + ' : personnel');
    await p.fill('#pe-montant', '75000'); await p.fill('#pe-libelle', 'Salaire d’octobre');
    await p.setInputFiles('#pe-justif', { name: 'recu.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await p.click('form[data-form="compta-payer-personne"] [type=submit]'); await p.waitForTimeout(800);
    const pe = envoi(journal, 'POST', 'compta_ecritures').pop() || {};
    ok(pe.categorie === 'personnel' && pe.tiers_id === 't3' && pe.montant === 75000 && pe.justificatif, nomEcran + ' : paiement du personnel avec son justificatif');

    // Matériel durable : achat (dépense + inventaire en une fois), sortie avec motif
    await aller(p, 'materiel'); t = await texte(p);
    ok(/Valeur d’achat\s*400 000 FCFA/i.test(t), nomEcran + ' : inventaire du matériel et sa valeur');
    await controler(p, nomEcran + ' : matériel');
    await p.fill('#ma-nom', 'Projecteur LED'); await p.fill('#ma-montant', '120000'); await p.fill('#ma-serie', 'PX-9');
    await p.click('form[data-form="compta-materiel"] [type=submit]'); await p.waitForTimeout(800);
    const ach = journal.filter((j) => j[0] === 'rpc' && j[1] === 'compta_materiel_acheter').map((j) => JSON.parse(j[2])).pop() || {};
    ok(ach.p_designation === 'Projecteur LED' && ach.p_montant === 120000 && ach.p_numero_serie === 'PX-9' && ach.p_compte, nomEcran + ' : achat de matériel enregistré');
    await p.click('[data-action="compta-materiel-modifier"][data-id="m1"]'); await p.waitForSelector('#mm-etat');
    await p.selectOption('#mm-etat', 'sorti'); await p.click('form[data-form="compta-materiel-modifier"] [type=submit]'); await p.waitForTimeout(400);
    ok((await p.textContent('#calque')).includes('motif'), nomEcran + ' : sortie sans motif refusée');
    await p.fill('#mm-motif', 'Volé'); p.once('dialog', (dl) => dl.accept());
    await p.click('form[data-form="compta-materiel-modifier"] [type=submit]'); await p.waitForTimeout(800);
    const so = envoi(journal, 'PATCH', 'compta_materiel').pop() || {};
    ok(so.etat === 'sorti' && so.motif_sortie === 'Volé' && so.date_sortie, nomEcran + ' : matériel sorti de l’inventaire avec son motif');

    // Carnet
    await aller(p, 'carnet');
    await controler(p, nomEcran + ' : carnet');
    await p.fill('#ti-nom', 'Studio Lumière'); await p.selectOption('#ti-type', 'prestataire'); await p.fill('#ti-tel', '0101010101');
    await p.click('form[data-form="compta-tiers"] [type=submit]'); await p.waitForTimeout(800);
    const ti = envoi(journal, 'POST', 'compta_tiers').pop() || {};
    ok(ti.nom === 'Studio Lumière' && ti.type === 'prestataire', nomEcran + ' : prestataire ajouté au carnet');
    await p.click('[data-action="compta-tiers-modifier"][data-id="t2"]'); await p.waitForSelector('#ti-actif');
    await p.uncheck('#ti-actif'); await p.click('form[data-form="compta-tiers-modifier"] [type=submit]'); await p.waitForTimeout(800);
    ok((envoi(journal, 'PATCH', 'compta_tiers').pop() || {}).actif === false, nomEcran + ' : fournisseur marqué « plus en relation »');

    // Autre mois
    await aller(p, 'mois');
    await p.fill('#cp-mois', '2026-09'); await p.click('form[data-form="compta-mois"] [type=submit]'); await p.waitForTimeout(800);
    ok((await texte(p)).includes('septembre 2026'), nomEcran + ' : choix du mois affiché');
    ok(!errs.length, nomEcran + ' : aucune erreur de page ' + errs.join(' | '));
    await ctx.close();

    // Le responsable des encaissements n'a pas accès à la comptabilité
    const c = await ouvrir('caisse', ecran);
    await c.p.waitForFunction(() => location.hash.startsWith('#/paiements/'), null, { timeout: 6000 }).catch(() => {});
    await c.p.goto(url + '#/compta/mois'); await c.p.waitForTimeout(600);
    ok((await texte(c.p)).includes('Accès refusé') && !c.journal.some((j) => j[0] === 'rpc' && j[1] === 'compta_soldes'), nomEcran + ' : encaissements → comptabilité refusée, rien n’est demandé à la base');
    await c.ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ comptabilité (morceaux A et B) : tout est bon');
  process.exit(ko ? 1 : 0);
})();
