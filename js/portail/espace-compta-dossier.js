// Espace 3 — Comptabilité, morceau E (cahier v2.4, section 6) : « Dossier du mois pour le
// comptable », en un clic : en Excel les journaux et les états (P.xlsx, compta-xlsx.js), en PDF
// un résumé complet du mois suivi des justificatifs (P.comptaPdf, compta-pdf.js : photos mises
// en page, PDF ajoutés tels quels ; un fichier illisible est signalé, jamais oublié en silence).
(function () {
  'use strict';
  const P = window.Portail, C = P.compta;
  const TYPES_DOC = { devis: 'Devis', proforma: 'Proforma', facture: 'Facture', avoir: 'Avoir', recu: 'Reçu' };
  const ETATS_MAT = { en_service: 'En service', en_panne: 'En panne', sorti: 'Sorti' };
  const cat = (k) => C.RECETTES[k] || C.DEPENSES[k] || (k === 'virement' ? 'Virement' : k);

  // Tout ce qu'il faut pour le mois m (AAAA-MM-01)
  async function rassembler(m) {
    const fin = C.bornes(m)[1];
    const [ecritures, tresorerie, comptes, creances, dettes, docs, impots, materiel, tiers, r, paiements] = await Promise.all([
      C.ecritures(m), P.rpc('compta_tresorerie', { p_debut: m, p_fin: fin }), C.comptes(true), C.dettes('creance'), C.dettes('dette'),
      P.bd(sb.from('compta_documents').select('*').gte('date_doc', m).lt('date_doc', fin).order('numero')),
      P.bd(sb.from('compta_impots').select('*').order('echeance')),
      P.bd(sb.from('compta_materiel').select('*').order('date_achat')),
      P.bd(sb.from('compta_tiers').select('id, nom')),
      P.bd(sb.from('compta_reglages').select('*').eq('id', 1).single()),
      C.paiementsImpots()  // (quel que soit leur mois)
    ]);
    const paiement = (i) => C.paiementImpot(i, paiements);
    const duMois = ecritures.slice().reverse();  // (ordre des dates, du 1er au dernier jour)
    const noms = {}, nomsTiers = {};
    comptes.forEach((c) => { noms[c.id] = c.nom; });
    tiers.forEach((x) => { nomsTiers[x.id] = x.nom; });
    const valides = duMois.filter((e) => !e.annule);
    const total = (sens) => valides.filter((e) => e.sens === sens).reduce((s, e) => s + e.montant, 0);
    const parCategorie = (sens) => {
      const t = {};
      valides.filter((e) => e.sens === sens).forEach((e) => { t[e.categorie] = (t[e.categorie] || 0) + e.montant; });
      return Object.keys(t).sort((a, b) => t[b] - t[a]).map((k) => [cat(k), t[k]]);
    };
    return { m, fin, r, duMois, valides, noms, nomsTiers, tresorerie, creances, dettes, docs,
      // impôts à payer dans le mois, ou payés dans le mois
      impots: impots.map((i) => Object.assign({}, i, { paye: !!paiement(i) }))
        .filter((i) => (i.echeance >= m && i.echeance < fin) || (paiement(i) && paiement(i).date_op >= m && paiement(i).date_op < fin)),
      materiel, recettes: total('recette'), depenses: total('depense'), parCategorie,
      tva: docs.filter((d) => d.fiscal && !d.annule).reduce((s, d) => s + (d.type === 'facture' ? d.tva : d.type === 'avoir' ? -d.tva : 0), 0) };
  }
  const etatDette = (d) => (d.annule ? 'Annulée' : !d.reste ? 'Payé' : d.retard ? 'En retard' : d.regle ? 'Payé en partie' : 'À payer');
  const nomFichier = (m) => 'Dossier-' + m.slice(0, 7) + '-MA2M';

  // ---------- Excel : journaux et états ----------
  function excel(x) {
    const journal = (sens) => [['Date', 'Libellé', 'Catégorie', sens === 'recette' ? 'Client' : 'Fournisseur / bénéficiaire', 'Compte', 'Montant (FCFA)', 'Origine', 'Justificatif', 'Annulée', 'Motif']]
      .concat(x.duMois.filter((e) => e.sens === sens).map((e) => [P.date(e.date_op), e.libelle, cat(e.categorie), e.tiers || '', x.noms[e.compte_id] || '', e.montant,
        e.source === 'espace2' ? 'Espace 2 (automatique)' : 'Saisie', e.justificatif ? 'Oui' : 'Non', e.annule ? 'Oui' : '', e.motif_annulation || '']));
    const dettes = (l, quoi) => [[quoi, 'Libellé', 'Facture', 'Date', 'Échéance', 'Montant', 'Réglé', 'Avoirs', 'Reste', 'État']]
      .concat(l.map((d) => [x.nomsTiers[d.tiers_id] || '', d.libelle, d.facture || '', P.date(d.date_op), d.echeance ? P.date(d.echeance) : '', d.montant, Number(d.regle), Number(d.avoirs || 0), Number(d.reste), etatDette(d)]));
    const resume = [['Rubrique', 'Valeur'], ['Mois', P.mois(x.m)], ['Agence', x.r.mode_legal ? x.r.raison_sociale : x.r.nom_commercial], ['Mode', x.r.mode_legal ? 'Légal (vraies factures, TVA)' : 'Non fiscal'],
      ['Recettes du mois (FCFA)', x.recettes], ['Dépenses du mois (FCFA)', x.depenses], ['Résultat du mois (FCFA)', x.recettes - x.depenses],
      ['On nous doit, à ce jour (FCFA)', x.creances.reduce((s, d) => s + Number(d.reste), 0)], ['Nous devons, à ce jour (FCFA)', x.dettes.reduce((s, d) => s + Number(d.reste), 0)]]
      .concat(x.r.mode_legal ? [['TVA collectée du mois (FCFA)', x.tva]] : [])
      .concat([['', ''], ['Recettes par catégorie', '']], x.parCategorie('recette'), [['', ''], ['Dépenses par catégorie', '']], x.parCategorie('depense'));
    return P.xlsx([
      { nom: 'Résumé', lignes: resume, largeurs: [38, 30] },
      { nom: 'Recettes', lignes: journal('recette'), largeurs: [11, 40, 24, 22, 18, 14, 20, 11, 9, 24] },
      { nom: 'Dépenses', lignes: journal('depense'), largeurs: [11, 40, 24, 22, 18, 14, 20, 11, 9, 24] },
      { nom: 'Virements', lignes: [['Date', 'Libellé', 'Depuis', 'Vers', 'Montant (FCFA)', 'Annulé']].concat(x.duMois.filter((e) => e.sens === 'virement')
        .map((e) => [P.date(e.date_op), e.libelle, x.noms[e.compte_id] || '', x.noms[e.compte_dest_id] || '', e.montant, e.annule ? 'Oui' : ''])), largeurs: [11, 40, 20, 20, 14, 9] },
      { nom: 'Trésorerie', lignes: [['Compte', 'Solde au début du mois', 'Entrées', 'Sorties', 'Solde à la fin du mois']]
        .concat(x.tresorerie.map((c) => [c.nom, c.ouvert ? Number(c.debut) : 'compte ouvert après ce mois', Number(c.entrees), Number(c.sorties), c.ouvert ? Number(c.fin) : ''])), largeurs: [24, 22, 14, 14, 22] },
      { nom: 'Clients (on nous doit)', lignes: dettes(x.creances, 'Client'), largeurs: [22, 34, 18, 11, 11, 12, 12, 12, 12, 14] },
      { nom: 'Fournisseurs (on doit)', lignes: dettes(x.dettes, 'Fournisseur'), largeurs: [22, 34, 18, 11, 11, 12, 12, 12, 12, 14] },
      { nom: 'Documents', lignes: [['Numéro', 'Type', 'Client', 'Date', 'Hors taxes', 'TVA', 'Total', 'Fiscal', 'N° FNE', 'Annulé', 'Motif']]
        .concat(x.docs.map((d) => [d.numero, TYPES_DOC[d.type], (d.destinataire || {}).nom || '', P.date(d.date_doc), d.total_ht, d.tva, d.total_ttc, d.fiscal ? 'Oui' : 'Non fiscal', d.fne_reference || '', d.annule ? 'Oui' : '', d.motif_annulation || ''])),
        largeurs: [20, 10, 24, 11, 12, 10, 12, 11, 14, 8, 24] },
      { nom: 'Personnel', lignes: [['Date', 'Personne', 'Libellé', 'Compte', 'Montant (FCFA)', 'Justificatif', 'Annulé']].concat(x.duMois.filter((e) => e.categorie === 'personnel')
        .map((e) => [P.date(e.date_op), x.nomsTiers[e.tiers_id] || e.tiers || '', e.libelle, x.noms[e.compte_id] || '', e.montant, e.justificatif ? 'Oui' : 'Non', e.annule ? 'Oui' : ''])), largeurs: [11, 24, 36, 18, 14, 11, 8] },
      { nom: 'Impôts et taxes', lignes: [['Impôt ou taxe', 'Période', 'Date limite', 'Montant prévu', 'Payé', 'Annulé']].concat(x.impots
        .map((i) => [i.nom, i.periode || '', P.date(i.echeance), i.montant, i.paye ? 'Oui' : 'Non', i.annule ? 'Oui' : ''])), largeurs: [28, 12, 12, 14, 8, 8] },
      { nom: 'Matériel', lignes: [['Matériel', 'Date d’achat', 'Prix (FCFA)', 'N° de série', 'Où', 'État', 'Sortie', 'Motif']].concat(x.materiel
        .map((t) => [t.designation, P.date(t.date_achat), t.montant, t.numero_serie || '', t.emplacement || '', ETATS_MAT[t.etat], t.date_sortie ? P.date(t.date_sortie) : '', t.motif_sortie || ''])), largeurs: [28, 12, 14, 16, 16, 12, 11, 24] }
    ]);
  }

  // ---------- PDF : résumé complet du mois, puis les justificatifs ----------
  async function versJpeg(blob) {
    const image = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    const k = Math.min(1, 1600 / Math.max(image.width, image.height));
    c.width = Math.round(image.width * k); c.height = Math.round(image.height * k);
    c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
    return new Uint8Array(await (await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85))).arrayBuffer());
  }
  async function pdf(x) {
    const m = await P.comptaPdf.mise(), F = P.fcfa;
    P.comptaPdf.entete(m, x.r, x.r.mode_legal);
    m.ecrire('Dossier du mois pour le comptable — ' + P.mois(x.m), { taille: 16, gras: true, couleur: m.rouge });
    m.ecrire('Préparé le ' + P.dateHeure(new Date().toISOString()) + ' · ' + (x.r.mode_legal ? 'mode légal' : 'mode non fiscal (agence pas encore immatriculée)'), { taille: 9, couleur: m.gris });
    m.titre('1. Résultat du mois');
    m.tableau([{ titre: 'Rubrique', part: 3 }, { titre: 'Montant', part: 1.4, droite: true }], [['Recettes', F(x.recettes)], ['Dépenses', F(x.depenses)],
      Object.assign(['Résultat (recettes − dépenses)', F(x.recettes - x.depenses)], { gras: true })].concat(x.r.mode_legal ? [['TVA collectée', F(x.tva)]] : []));
    m.titre('2. Recettes et dépenses par catégorie', 12);
    m.tableau([{ titre: 'Recettes', part: 3 }, { titre: 'Montant', part: 1.4, droite: true }], x.parCategorie('recette').map((c) => [c[0], F(c[1])]));
    m.tableau([{ titre: 'Dépenses', part: 3 }, { titre: 'Montant', part: 1.4, droite: true }], x.parCategorie('depense').map((c) => [c[0], F(c[1])]));
    m.titre('3. Trésorerie', 12);
    m.tableau([{ titre: 'Compte', part: 2.4 }, { titre: 'Début du mois', part: 1.4, droite: true }, { titre: 'Entrées', part: 1.3, droite: true }, { titre: 'Sorties', part: 1.3, droite: true }, { titre: 'Fin du mois', part: 1.4, droite: true }],
      x.tresorerie.map((c) => [c.nom, c.ouvert ? F(c.debut) : '—', F(c.entrees), F(c.sorties), c.ouvert ? F(c.fin) : '—']));
    m.titre('4. Ce qu’on nous doit et ce qu’on doit (à ce jour)', 12);
    const ouvertes = (l) => l.filter((d) => Number(d.reste) > 0);
    m.tableau([{ titre: 'Client', part: 2 }, { titre: 'Libellé', part: 3 }, { titre: 'Échéance', part: 1.2 }, { titre: 'Reste', part: 1.4, droite: true }, { titre: 'État', part: 1.2 }],
      ouvertes(x.creances).map((d) => [x.nomsTiers[d.tiers_id] || '', d.libelle, d.echeance ? P.date(d.echeance) : '—', F(d.reste), etatDette(d)]));
    m.tableau([{ titre: 'Fournisseur', part: 2 }, { titre: 'Libellé', part: 3 }, { titre: 'Échéance', part: 1.2 }, { titre: 'Reste', part: 1.4, droite: true }, { titre: 'État', part: 1.2 }],
      ouvertes(x.dettes).map((d) => [x.nomsTiers[d.tiers_id] || '', d.libelle, d.echeance ? P.date(d.echeance) : '—', F(d.reste), etatDette(d)]));
    m.titre('5. Documents émis', 12);
    m.tableau([{ titre: 'Numéro', part: 2 }, { titre: 'Type', part: 1.1 }, { titre: 'Client', part: 2.2 }, { titre: 'Date', part: 1.1 }, { titre: 'Total', part: 1.4, droite: true }],
      x.docs.map((d) => [d.numero + (d.annule ? ' (annulé)' : ''), TYPES_DOC[d.type], (d.destinataire || {}).nom || '', P.date(d.date_doc), F(d.total_ttc)]));
    m.titre('6. Impôts et taxes du mois', 12);
    m.tableau([{ titre: 'Impôt ou taxe', part: 3 }, { titre: 'Date limite', part: 1.2 }, { titre: 'Montant', part: 1.4, droite: true }, { titre: 'Payé', part: 0.8 }],
      x.impots.filter((i) => !i.annule).map((i) => [i.nom + (i.periode ? ' · ' + i.periode : ''), P.date(i.echeance), F(i.montant), i.paye ? 'Oui' : 'Non']));
    m.titre('7. Journal du mois', 12);
    m.tableau([{ titre: 'Date', part: 1 }, { titre: 'Libellé', part: 3.4 }, { titre: 'Catégorie', part: 1.8 }, { titre: 'Compte', part: 1.5 }, { titre: 'Montant', part: 1.4, droite: true }, { titre: 'Justif.', part: 0.8 }],
      x.duMois.map((e) => [P.date(e.date_op), (e.sens === 'depense' ? '− ' : e.sens === 'virement' ? '⇄ ' : '+ ') + e.libelle + (e.annule ? ' (annulée : ' + (e.motif_annulation || '') + ')' : ''),
        cat(e.categorie), x.noms[e.compte_id] || '', F(e.montant), e.justificatif ? 'Oui' : e.sens === 'depense' ? 'MANQUE' : '']), { taille: 8 });
    // Justificatifs des écritures du mois (hors annulées)
    const avec = x.valides.filter((e) => e.justificatif);
    m.titre('8. Justificatifs (' + avec.length + ')', 12);
    const absents = [];
    for (let i = 0; i < avec.length; i++) {
      const e = avec[i], legende = 'Justificatif ' + (i + 1) + ' · ' + P.date(e.date_op) + ' · ' + e.libelle + ' · ' + F(e.montant);
      P.message('Justificatifs : ' + (i + 1) + ' sur ' + avec.length + '…');
      try {
        const blob = await P.bd(sb.storage.from('compta-justificatifs').download(e.justificatif));
        if (/\.pdf$/i.test(e.justificatif)) {
          const source = await m.L.PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true });
          m.nouvellePage(); m.ecrire(legende + ' (pages suivantes)', { taille: 10, gras: true });
          (await m.doc.copyPages(source, source.getPageIndices())).forEach((pg) => m.doc.addPage(pg));
          m.page = null;
        } else {
          const octets = /\.png$/i.test(e.justificatif) ? new Uint8Array(await blob.arrayBuffer()) : /\.jpe?g$/i.test(e.justificatif) ? new Uint8Array(await blob.arrayBuffer()) : await versJpeg(blob);
          const image = /\.png$/i.test(e.justificatif) ? await m.doc.embedPng(octets) : await m.doc.embedJpg(octets);
          m.nouvellePage(); m.ecrire(legende, { taille: 10, gras: true });
          const k = Math.min(m.largeur / image.width, (m.y - 70) / image.height, 1.5);
          m.page.drawImage(image, { x: 46, y: m.y - image.height * k - 6, width: image.width * k, height: image.height * k });
          m.page = null;
        }
      } catch (err) { absents.push(legende); }
    }
    if (absents.length) {
      m.titre('Justificatifs à consulter dans l’Administration (format non lisible ici)', 11);
      absents.forEach((l) => m.ecrire('• ' + l, { taille: 9 }));
    }
    return m.finir('Dossier du mois · ' + P.mois(x.m) + (x.r.mode_legal ? '' : ' · non fiscal'));
  }

  async function dossier() {
    const m = C.moisChoisi();
    const liste = await C.ecritures(m);
    const justifs = liste.filter((e) => !e.annule && e.justificatif).length, manquants = liste.filter((e) => !e.annule && e.sens === 'depense' && !e.justificatif).length;
    return P.entete('Dossier du mois · ' + P.mois(m), C.choixMois()) +
      '<div class="grille chiffres">' + P.chiffre('Écritures du mois', liste.length) + P.chiffre('Justificatifs joints', justifs) +
      P.chiffre('Dépenses sans justificatif', manquants, manquants ? 'orange' : '') + '</div>' +
      (manquants ? '<div class="note">Il manque ' + manquants + ' justificatif(s) de dépense : joignez-les (page Dépenses, bouton « Joindre ») avant d’envoyer le dossier.</div>' : '') +
      '<div class="carte"><h2>Pour le comptable, en un clic</h2>' +
      '<p><b>Excel</b> : résumé, journal des recettes, journal des dépenses, virements, trésorerie, clients, fournisseurs, documents émis, personnel, impôts et taxes, matériel.</p>' +
      '<p><b>PDF</b> : un résumé complet du mois, puis tous les justificatifs du mois (photos et PDF).</p>' +
      '<div class="ligne" style="margin-top:12px"><button class="btn rouge" type="button" data-action="compta-dossier" data-format="xlsx">Télécharger en Excel</button>' +
      '<button class="btn rouge" type="button" data-action="compta-dossier" data-format="pdf">Télécharger en PDF</button></div></div>';
  }
  P.actions['compta-dossier'] = async (el) => {
    const format = el.getAttribute('data-format'), m = C.moisChoisi();
    el.disabled = true;
    try {
      P.message('Préparation du dossier…');
      const x = await rassembler(m);
      if (format === 'xlsx') P.telecharger(excel(x), nomFichier(m) + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      else P.telecharger(await pdf(x), nomFichier(m) + '.pdf', 'application/pdf');
      P.message('Dossier téléchargé.');
    } catch (e) { P.message(P.erreurTexte(e)); } finally { if (el.isConnected) el.disabled = false; }
  };

  const esp = P.espaces.compta;
  // (juste après « Tableau du mois » : c'est ce que le comptable demande chaque mois)
  esp.nav.splice(esp.nav.findIndex((n) => n[0] === 'mois') + 1, 0, ['dossier', 'Dossier du mois']);
  esp.pages.dossier = dossier;

  // ---------- Accès du comptable (administrateur principal seul) ----------
  // Invitation et coupure : mêmes outils que « Sécurité » (js/portail/securite.js), ici à portée de main.
  async function acces() {
    if (P.moi.role !== 'principal') return P.refuse();
    const liste = await P.bd(sb.from('staff_profiles').select('user_id, nom, email, actif, cree_le').eq('role', 'compta').order('cree_le'));
    return P.entete('Accès du comptable', P.pastille('Administrateur principal seul', 'neutre')) +
      '<div class="note info">Le comptable reçoit un lien d’invitation par e-mail, choisit son mot de passe et active sa double authentification. Il ne voit aucun nom de mannequin. Vous pouvez couper son accès à tout moment : l’accès est alors fermé immédiatement.</div>' +
      '<div class="carte"><h2>Comptable' + (liste.length > 1 ? 's' : '') + '</h2>' +
      (liste.length ? P.tableau(['Personne', 'Accès', 'Depuis', ''], liste.map((c) => '<tr><td><b>' + P.esc(c.nom) + '</b><div class="petit-texte doux">' + P.esc(c.email) + '</div></td>' +
        '<td>' + P.pastille(c.actif ? 'Actif' : 'Coupé', c.actif ? 'ok' : 'erreur') + '</td><td>' + P.date(c.cree_le) + '</td>' +
        '<td><button class="btn petit' + (c.actif ? '' : ' rouge') + '" type="button" data-action="securite-actif" data-id="' + c.user_id + '" data-actif="' + (c.actif ? '1' : '0') + '">' + (c.actif ? 'Couper l’accès' : 'Rétablir') + '</button></td></tr>'))
        : '<p class="doux">Aucun comptable invité pour l’instant.</p>') +
      '<div class="ligne"><a class="btn rouge" href="#/securite/comptes">Inviter le comptable</a></div></div>';
  }
  esp.pages.acces = acces;
  // Ordre du plan validé (Portail_Admin_MA2M.html) : 8 entrées simples en tête, le reste regroupé dessous.
  // Les pages et les données ne changent pas, seuls l'ordre et les titres du menu.
  const PLAN = [['mois', 'Tableau de bord'], ['recettes', 'Recettes'], ['documents', 'Devis, proforma, factures'], ['depenses', 'Dépenses et charges'], ['cachets', 'Payer les mannequins'],
    ['impots', 'Impôts et taxes'], ['dossier', 'Clôture mensuelle'], ['acces', 'Accès du comptable', () => P.moi && P.moi.role === 'principal'], ['identite', 'Paramètres de l’entité']];
  const cles = PLAN.map((n) => n[0]);
  const autres = esp.nav.filter((n) => n[0] !== null && !cles.includes(n[0]));
  esp.nav.length = 0;
  esp.nav.push([null, 'Comptabilité']);
  PLAN.forEach((n) => { if (esp.pages[n[0]]) esp.nav.push(n); });
  if (autres.length) { esp.nav.push([null, 'Suivi et trésorerie']); autres.forEach((n) => esp.nav.push(n)); }
})();
