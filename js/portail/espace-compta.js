// Portail — Espace 3 : Comptabilité (cahier v2.3, section 8). Le comptable ne voit jamais de
// nom de mannequin : les recettes des mannequins portent un numéro de reçu, et leurs totaux
// viennent de la vue v_compta_encaissements_agreges.
(function () {
  'use strict';
  const P = window.Portail;
  const NAV = [
    ['tableau', 'Tableau de bord'], ['recettes', 'Recettes'], ['factures', 'Devis, proforma, factures'], ['depenses', 'Dépenses et charges'],
    ['impots', 'Impôts et taxes'], ['tresorerie', 'Trésorerie'], ['cloture', 'Clôture mensuelle'], ['demandes', 'Demandes du comptable'],
    ['acces', 'Accès du comptable', () => P.moi.role === 'principal'], ['entite', 'Paramètres de l’entité']
  ];
  // Catégories de dépenses alignées sur le plan SYSCOHADA révisé (à valider par le comptable)
  const CATEGORIES = ['Loyer et studio', 'Transport', 'Communication et publicité', 'Matériel et fournitures', 'Frais Wave et bancaires',
    'Honoraires', 'Impôts et taxes', 'Cachets reversés aux mannequins', 'Prestataires', 'Charges de personnel', 'Autre'];
  const TYPES = { devis: 'Devis', proforma: 'Proforma', facture: 'Facture', avoir: 'Avoir' };
  const STATUT_DOC = { brouillon: ['Brouillon', 'alerte'], emis: ['Émis', 'alerte'], envoye: ['Envoyé', 'info'], partiel: ['Partiellement payé', 'alerte'], paye: ['Payé', 'ok'], annule: ['Annulé', 'erreur'] };
  let activites = null, comptes = null, entite = null;

  async function avant() {
    if (!activites) {
      [activites, comptes] = await Promise.all([P.bd(sb.from('activities').select('*').order('libelle')), P.bd(sb.from('treasury_accounts').select('*'))]);
    }
    entite = (await P.bd(sb.from('company_settings').select('*').limit(1)))[0];
  }
  const libelleActivite = (code) => (activites.find((a) => a.code === code) || {}).libelle || code || '—';
  const libelleCompte = (code) => (comptes.find((a) => a.code === code) || {}).libelle || code;
  const optionsActivites = (choisi) => activites.map((a) => '<option value="' + a.code + '"' + (a.code === choisi ? ' selected' : '') + '>' + P.esc(a.libelle) + '</option>').join('');
  const optionsComptes = () => comptes.map((c) => '<option value="' + c.code + '">' + P.esc(c.libelle) + '</option>').join('');
  function moisChoisi() { return P.etat.moisCompta || P.moisCourant(); }
  function finDeMois(m) { const d = new Date(m); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('fr-CA'); }
  function selecteurMois() {
    const d = new Date(P.moisCourant()), options = [];
    for (let i = 0; i < 18; i++) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1), v = x.toLocaleDateString('fr-CA').slice(0, 8) + '01';
      options.push('<option value="' + v + '"' + (v === moisChoisi() ? ' selected' : '') + '>' + P.mois(v) + '</option>');
    }
    return '<label class="fl" for="cm-mois" style="flex-direction:row;align-items:center;gap:8px">Mois<select id="cm-mois" data-change="compta-mois" style="width:auto">' + options.join('') + '</select></label>';
  }
  P.changements['compta-mois'] = (el) => { P.etat.moisCompta = el.value; P.afficher(); };
  const ecrituresDuMois = (m) => P.bd(sb.from('ledger_entries').select('*').gte('date_ecriture', m).lte('date_ecriture', finDeMois(m)).order('date_ecriture'));

  // ---------- Tableau de bord ----------
  async function tableau() {
    const m = moisChoisi();
    const [lignes, agreges, factures] = await Promise.all([
      ecrituresDuMois(m), P.bd(sb.from('v_compta_encaissements_agreges').select('*').eq('mois', m)),
      P.bd(sb.from('invoices').select('total_ttc, paye, statut, type').eq('type', 'facture').in('statut', ['emis', 'envoye', 'partiel']))
    ]);
    const recettes = lignes.filter((e) => e.sens === 'recette'), depenses = lignes.filter((e) => e.sens === 'depense');
    const somme = (l) => l.reduce((s, e) => s + e.montant, 0);
    const tr = somme(recettes), td = somme(depenses);
    const parActivite = {}; recettes.forEach((e) => { parActivite[e.activite] = (parActivite[e.activite] || 0) + e.montant; });
    const max = Math.max(1, ...Object.values(parActivite));
    const parCompte = {}; lignes.forEach((e) => { parCompte[e.compte] = (parCompte[e.compte] || 0) + (e.sens === 'recette' ? e.montant : -e.montant); });
    const aEncaisser = factures.reduce((s, f) => s + f.total_ttc - f.paye, 0);
    const payeurs = agreges.reduce((s, a) => s + Number(a.nombre_payants), 0), totalMannequins = agreges.reduce((s, a) => s + Number(a.total), 0);
    const principal = P.moi.role === 'principal';
    const legalComplet = entite && entite.raison_sociale && entite.rccm && entite.ncc && entite.regime && entite.assujetti_tva != null;
    return P.entete('Tableau de bord · ' + P.mois(m), selecteurMois()) +
      '<div class="carte ligne ecartee"><div style="max-width:560px"><div class="etape">Mode actuel</div><h2 style="font-size:22px">' + (entite.mode_legal ? 'Légal' : 'Pré-légal') + '</h2>' +
      '<p class="petit-texte doux">' + (entite.mode_legal ? 'Factures complètes, TVA et FNE actives.' : 'Les factures sont des documents internes « non fiscaux ». La FNE et la TVA sont prévues et s’activeront avec l’interrupteur légal.') + '</p></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px"><button class="btn' + (entite.mode_legal ? '' : ' rouge') + '" data-action="compta-legal" data-actif="' + (entite.mode_legal ? '1' : '0') + '"' + (principal && (legalComplet || entite.mode_legal) ? '' : ' disabled') + '>' +
      (entite.mode_legal ? 'Revenir en mode pré-légal' : 'Activer le mode légal et la FNE') + '</button><span class="petit-texte doux">' +
      (principal ? (legalComplet ? 'Champs légaux complets.' : 'À renseigner dans « Paramètres de l’entité » : raison sociale, RCCM, NCC, régime, TVA.') : 'Réservé à l’administrateur principal.') + '</span></div></div>' +
      '<div class="grille chiffres">' + P.chiffre('Recettes du mois', P.fcfa(tr), 'vert') + P.chiffre('Dépenses du mois', P.fcfa(td), 'rouge') + P.chiffre('Résultat', P.fcfa(tr - td)) + P.chiffre('Factures à encaisser', P.fcfa(aEncaisser)) + '</div>' +
      '<div class="grille deux"><div class="carte"><h2>Recettes par activité</h2><div class="barres" style="margin-top:14px">' +
      (Object.keys(parActivite).length ? Object.keys(parActivite).sort((a, b) => parActivite[b] - parActivite[a]).map((k, i) => P.barre(libelleActivite(k), parActivite[k], max, i === 0)).join('') : '<p class="doux">Aucune recette ce mois-ci.</p>') + '</div>' +
      '<p class="petit-texte doux" style="border-top:1px solid var(--lignes);padding-top:10px;margin-top:10px">Encaissements des mannequins, en totaux seulement : ' + payeurs + ' payant(s), ' + P.fcfa(totalMannequins) + '. Aucun nom.</p></div>' +
      '<div class="carte"><h2>Trésorerie du mois</h2><div class="barres" style="margin-top:14px">' + (Object.keys(parCompte).length ? Object.keys(parCompte).map((k) =>
        P.barre(libelleCompte(k), Math.max(parCompte[k], 0), Math.max(tr, 1)) + '<div class="petit-texte doux" style="margin-top:-6px">Solde du mois : ' + P.fcfa(parCompte[k]) + '</div>').join('') : '<p class="doux">Aucun mouvement ce mois-ci.</p>') + '</div></div></div>';
  }
  P.actions['compta-legal'] = async (el) => {
    const activer = el.getAttribute('data-actif') !== '1';
    if (activer && !confirm('Activer le mode légal ? Il n’est pas rétroactif : les documents déjà émis restent des documents internes.')) return;
    await P.sensible(() => P.rpc('compta_mode_legal', { p_actif: activer }));
    P.message(activer ? 'Mode légal activé. Inscrivez maintenant l’agence sur la plateforme FNE de la DGI (procédure ci-dessous).' : 'Retour en mode pré-légal.');
    if (activer) P.fenetre('<h2>Inscription sur la plateforme FNE</h2><ol><li>Se rendre sur la plateforme de facturation électronique de la DGI (Côte d’Ivoire) avec le numéro de compte contribuable.</li><li>Créer le compte de l’entreprise et obtenir les accès (plateforme web ou API).</li><li>Transmettre ces accès au développeur : la transmission réelle remplacera la version d’essai.</li></ol><p class="petit-texte doux">À faire valider par votre comptable.</p><button class="btn" data-action="fermer-fenetre">Compris</button>');
    P.afficher();
  };

  // ---------- Recettes ----------
  async function recettes() {
    const m = moisChoisi();
    const lignes = (await ecrituresDuMois(m)).filter((e) => e.sens === 'recette');
    return P.entete('Recettes', selecteurMois()) +
      '<details class="carte"><summary>Ajouter une recette manuelle</summary><form class="f" data-form="compta-recette" style="margin-top:12px">' +
      '<label class="fl" for="cr-act">Activité<select id="cr-act" name="activite">' + optionsActivites('masterclass') + '</select></label>' +
      '<label class="fl" for="cr-mt">Montant (FCFA)<input id="cr-mt" name="montant" type="number" min="1" step="1" required></label>' +
      '<label class="fl" for="cr-lib">Libellé<input id="cr-lib" name="libelle" required></label>' +
      '<label class="fl" for="cr-date">Date<input id="cr-date" name="date" type="date" value="' + P.aujourdhui() + '" required></label>' +
      '<label class="fl" for="cr-cpt">Compte<select id="cr-cpt" name="compte">' + optionsComptes() + '</select></label>' +
      '<label class="fl" for="cr-ref">Pièce (reçu, facture)<input id="cr-ref" name="reference" required></label><button class="btn rouge" type="submit">Enregistrer</button></form></details>' +
      P.tableau(['Date', 'Pièce', 'Activité', 'Origine', 'Compte', '#Montant'], lignes.slice().reverse().map((e) =>
        '<tr><td>' + P.date(e.date_ecriture) + '</td><td><b>' + P.esc(e.reference) + '</b></td><td>' + P.esc(libelleActivite(e.activite)) + '</td><td>' + P.esc(e.libelle || e.source) + '</td><td>' + P.esc(libelleCompte(e.compte)) + '</td><td class="nombre">' + P.fcfa(e.montant) + '</td></tr>')) +
      '<p class="petit-texte doux">Total du mois : ' + P.fcfa(lignes.reduce((s, e) => s + e.montant, 0)) + '. Les paiements des mannequins arrivent seuls (numéro de reçu, sans nom).</p>';
  }
  P.formulaires['compta-recette'] = async (f) => {
    await P.bd(sb.from('ledger_entries').insert({
      date_ecriture: f.get('date'), sens: 'recette', montant: Math.round(Number(f.get('montant'))), activite: f.get('activite'),
      compte: f.get('compte'), source: 'manuel', reference: String(f.get('reference')).trim(), libelle: String(f.get('libelle')).trim()
    }));
    P.message('Recette enregistrée.');
    P.afficher();
  };

  // ---------- Documents ----------
  async function factures() {
    const [docs, clients] = await Promise.all([
      P.bd(sb.from('invoices').select('*, client:clients(nom), lignes:invoice_lines(*)').order('cree_le', { ascending: false }).limit(200)),
      P.bd(sb.from('clients').select('*').order('nom'))
    ]);
    P.etat.documents = docs;
    return P.entete('Devis, proforma, factures') + (entite.mode_legal ? '' : '<div class="note">Mode pré-légal : tout document porte la mention « Document non fiscal, non valable pour la déduction de TVA ».</div>') +
      '<details class="carte"' + (docs.length ? '' : ' open') + '><summary>Nouveau document</summary><form class="f" data-form="compta-document" style="margin-top:12px">' +
      '<label class="fl" for="cd-type">Type<select id="cd-type" name="type"><option value="devis">Devis</option><option value="proforma">Proforma</option><option value="facture" selected>Facture</option></select></label>' +
      '<label class="fl" for="cd-client">Client<input id="cd-client" name="client" list="cd-clients" required placeholder="Nom du client"><datalist id="cd-clients">' + clients.map((c) => '<option value="' + P.esc(c.nom) + '">').join('') + '</datalist></label>' +
      '<label class="fl" for="cd-act">Activité<select id="cd-act" name="activite">' + optionsActivites('casting') + '</select></label>' +
      '<label class="fl" for="cd-ech">Échéance de paiement<input id="cd-ech" name="echeance" type="date"></label>' +
      '<label class="fl large" for="cd-des">Désignation (une ligne par prestation : « libellé ; quantité ; prix unitaire »)<textarea id="cd-des" name="lignes" required placeholder="Casting, 2 jours ; 1 ; 150000"></textarea></label>' +
      (entite.mode_legal && entite.assujetti_tva ? '<label class="case large"><input type="checkbox" name="tva" checked> TVA ' + P.esc(entite.taux_tva) + ' %</label>' : '') +
      '<label class="fl large" for="cd-cond">Conditions de paiement<input id="cd-cond" name="conditions" placeholder="Paiement à 30 jours, par Wave ou virement"></label>' +
      '<div class="ligne large"><button class="btn rouge" type="submit" name="emettre" value="1">Émettre</button><button class="btn" type="submit" name="emettre" value="0">Garder en brouillon</button></div></form>' +
      '<p class="petit-texte doux">Un document émis ne se modifie plus : on le corrige par un avoir. Numérotation continue, sans trou.</p></details>' +
      P.tableau(['Numéro', 'Client', 'Activité', '#Total', 'Statut', 'Action'], docs.map((d) =>
        '<tr><td><b>' + P.esc(d.numero || 'Brouillon') + '</b><div class="petit-texte doux">' + TYPES[d.type] + ' · ' + P.date(d.date_emission || d.cree_le) + '</div></td>' +
        '<td>' + P.esc(d.client ? d.client.nom : '—') + '<div class="petit-texte doux">' + P.esc((d.lignes[0] || {}).designation || '') + '</div></td><td>' + P.esc(libelleActivite(d.activite)) + '</td>' +
        '<td class="nombre">' + P.fcfa(d.total_ttc) + (d.total_tva ? '<div class="petit-texte doux">dont TVA ' + P.fcfa(d.total_tva) + '</div>' : '') + (d.paye && d.statut !== 'paye' ? '<div class="petit-texte doux">payé ' + P.fcfa(d.paye) + '</div>' : '') + '</td>' +
        '<td>' + P.pastille(STATUT_DOC[d.statut][0], STATUT_DOC[d.statut][1]) + '</td><td class="ligne">' +
        (d.statut === 'brouillon' ? '<button class="btn petit" data-action="compta-emettre" data-id="' + d.id + '">Émettre</button>' : '<button class="btn petit" data-action="compta-pdf" data-id="' + d.id + '">PDF</button>') +
        (d.type !== 'facture' && d.statut === 'emis' ? '<button class="btn petit" data-action="compta-convertir" data-id="' + d.id + '" data-vers="' + (d.type === 'devis' ? 'proforma' : 'facture') + '">→ ' + (d.type === 'devis' ? 'Proforma' : 'Facture') + '</button>' : '') +
        (d.type === 'facture' && ['emis', 'envoye', 'partiel'].includes(d.statut) ? '<button class="btn petit" data-action="compta-encaisser" data-id="' + d.id + '" data-reste="' + (d.total_ttc - d.paye) + '">Encaissement</button><button class="btn petit" data-action="compta-avoir" data-id="' + d.id + '">Avoir</button>' : '') +
        '</td></tr>'));
  }
  async function clientId(nom) {
    const trouve = await P.bd(sb.from('clients').select('id').ilike('nom', nom.replace(/[%_]/g, '')).limit(1));
    if (trouve.length) return trouve[0].id;
    return (await P.bd(sb.from('clients').insert({ nom }).select('id')))[0].id;
  }
  function lireLignes(texte, tva) {
    return String(texte).split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
      const p = l.split(';').map((x) => x.trim());
      const prix = Math.round(Number(String(p[2] || p[1] || '0').replace(/\s/g, '')));
      return { designation: p[0], quantite: p[2] ? Number(p[1]) || 1 : 1, prix_unitaire: prix, tva: !!tva, ordre: i };
    });
  }
  P.formulaires['compta-document'] = async (f, form) => {
    const lignes = lireLignes(f.get('lignes'), f.get('tva'));
    if (!lignes.length || lignes.some((l) => !l.designation || !(l.prix_unitaire >= 0))) { P.message('Chaque ligne : « libellé ; quantité ; prix unitaire ».'); return; }
    const emettre = (form.querySelector('[type="submit"]:focus') || {}).value !== '0';
    const doc = (await P.bd(sb.from('invoices').insert({
      type: f.get('type'), client_id: await clientId(String(f.get('client')).trim()), activite: f.get('activite'),
      echeance: f.get('echeance') || null, conditions: String(f.get('conditions') || '').trim() || null
    }).select('id')))[0];
    await P.bd(sb.from('invoice_lines').insert(lignes.map((l) => Object.assign({ invoice_id: doc.id }, l))));
    if (emettre) {
      const numero = await P.rpc('compta_emettre', { p_invoice: doc.id });
      P.message('Document ' + numero + ' émis.');
    } else P.message('Brouillon enregistré.');
    P.afficher();
  };
  P.actions['compta-emettre'] = async (el) => {
    const numero = await P.sensible(() => P.rpc('compta_emettre', { p_invoice: el.getAttribute('data-id') }));
    P.message('Document ' + numero + ' émis.');
    P.afficher();
  };
  // devis → proforma → facture, en un clic (nouveau document, mêmes lignes)
  P.actions['compta-convertir'] = async (el) => {
    const d = P.etat.documents.find((x) => x.id === el.getAttribute('data-id'));
    const nouveau = (await P.bd(sb.from('invoices').insert({ type: el.getAttribute('data-vers'), client_id: d.client_id, activite: d.activite, origine_id: d.id, conditions: d.conditions, echeance: d.echeance }).select('id')))[0];
    await P.bd(sb.from('invoice_lines').insert(d.lignes.map((l) => ({ invoice_id: nouveau.id, designation: l.designation, quantite: l.quantite, prix_unitaire: l.prix_unitaire, remise: l.remise, tva: l.tva, ordre: l.ordre }))));
    const numero = await P.rpc('compta_emettre', { p_invoice: nouveau.id });
    P.message(TYPES[el.getAttribute('data-vers')] + ' ' + numero + ' créée depuis ' + d.numero + '.');
    P.afficher();
  };
  P.actions['compta-avoir'] = async (el) => {
    const d = P.etat.documents.find((x) => x.id === el.getAttribute('data-id'));
    if (!confirm('Annuler la facture ' + d.numero + ' par un avoir ?')) return;
    await P.sensible(async () => {
      const av = (await P.bd(sb.from('invoices').insert({ type: 'avoir', client_id: d.client_id, activite: d.activite, origine_id: d.id }).select('id')))[0];
      await P.bd(sb.from('invoice_lines').insert(d.lignes.map((l) => ({ invoice_id: av.id, designation: 'Annulation : ' + l.designation, quantite: l.quantite, prix_unitaire: l.prix_unitaire, tva: l.tva, ordre: l.ordre }))));
      return P.rpc('compta_emettre', { p_invoice: av.id });
    });
    P.message('Facture annulée par un avoir.');
    P.afficher();
  };
  P.actions['compta-encaisser'] = (el) => {
    P.fenetre('<form data-form="compta-encaisser" class="f"><h2>Encaissement de facture</h2><input type="hidden" name="id" value="' + P.esc(el.getAttribute('data-id')) + '">' +
      '<label class="fl" for="ce-mt">Montant reçu<input id="ce-mt" name="montant" type="number" min="1" max="' + P.esc(el.getAttribute('data-reste')) + '" value="' + P.esc(el.getAttribute('data-reste')) + '" required></label>' +
      '<label class="fl" for="ce-cpt">Compte<select id="ce-cpt" name="compte">' + optionsComptes() + '</select></label>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">Enregistrer</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
  };
  P.formulaires['compta-encaisser'] = async (f) => {
    await P.rpc('compta_encaisser', { p_invoice: f.get('id'), p_montant: Math.round(Number(f.get('montant'))), p_compte: f.get('compte') });
    P.fenetre('');
    P.message('Encaissement enregistré : recette et trésorerie mises à jour.');
    P.afficher();
  };
  P.actions['compta-pdf'] = (el) => window.MA2M_DOCUMENT(P.etat.documents.find((x) => x.id === el.getAttribute('data-id')), entite);

  // ---------- Dépenses ----------
  async function depenses() {
    const m = moisChoisi();
    const [liste, periode] = await Promise.all([
      P.bd(sb.from('expenses').select('*').gte('date_depense', m).lte('date_depense', finDeMois(m)).order('date_depense', { ascending: false })),
      sb.from('fiscal_periods').select('statut').eq('mois', m).maybeSingle()
    ]);
    const verrouille = periode.data && periode.data.statut === 'verrouillee';
    return P.entete('Dépenses et charges', selecteurMois()) + (verrouille ? '<div class="note erreur">La période est verrouillée : aucune écriture n’est possible.</div>' : '') +
      '<details class="carte"' + (liste.length ? '' : ' open') + '><summary>Enregistrer une dépense</summary><form class="f" data-form="compta-depense" style="margin-top:12px">' +
      '<label class="fl" for="dp-lib">Fournisseur ou objet<input id="dp-lib" name="libelle" required></label>' +
      '<label class="fl" for="dp-cat">Catégorie<select id="dp-cat" name="categorie">' + CATEGORIES.map((c) => '<option>' + P.esc(c) + '</option>').join('') + '</select></label>' +
      '<label class="fl" for="dp-mt">Montant (FCFA)<input id="dp-mt" name="montant" type="number" min="1" step="1" required></label>' +
      '<label class="fl" for="dp-date">Date<input id="dp-date" name="date" type="date" value="' + P.aujourdhui() + '" required></label>' +
      '<label class="fl" for="dp-cpt">Compte<select id="dp-cpt" name="compte">' + optionsComptes() + '</select></label>' +
      '<label class="fl" for="dp-just">Justificatif (obligatoire, photo ou PDF)<input id="dp-just" name="justificatif" type="file" accept="image/*,application/pdf" required></label>' +
      '<button class="btn rouge" type="submit"' + (verrouille ? ' disabled' : '') + '>Enregistrer</button></form></details>' +
      P.tableau(['Date', 'Pièce', 'Catégorie', 'Objet', 'Justificatif', '#Montant'], liste.map((e) =>
        '<tr><td>' + P.date(e.date_depense) + '</td><td><b>' + P.esc(e.numero) + '</b></td><td>' + P.esc(e.categorie) + '</td><td>' + P.esc(e.libelle) + '</td><td>' +
        (e.justificatif ? '<button class="btn petit" data-action="compta-piece" data-chemin="' + P.esc(e.justificatif) + '">Voir</button>' : P.pastille('Manquant', 'erreur')) + '</td><td class="nombre">' + P.fcfa(e.montant) + '</td></tr>')) +
      '<p class="petit-texte doux">Total du mois : ' + P.fcfa(liste.reduce((s, e) => s + e.montant, 0)) + '.</p>';
  }
  P.formulaires['compta-depense'] = async (f) => {
    const fichier = f.get('justificatif');
    if (!fichier || !fichier.size) { P.message('Le justificatif est obligatoire.'); return; }
    if (fichier.size > 10 * 1024 * 1024 || !/^(image\/|application\/pdf)/.test(fichier.type)) { P.message('Photo ou PDF de 10 Mo au plus.'); return; }
    const ext = fichier.type === 'application/pdf' ? 'pdf' : (fichier.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    const chemin = f.get('date').slice(0, 7) + '/' + crypto.randomUUID() + '.' + ext; // nom de fichier régénéré
    await P.bd(sb.storage.from('pieces-comptables').upload(chemin, fichier, { contentType: fichier.type, upsert: false }));
    const numero = await P.rpc('compta_depense', {
      p_date: f.get('date'), p_montant: Math.round(Number(f.get('montant'))), p_categorie: f.get('categorie'), p_libelle: String(f.get('libelle')).trim(),
      p_compte: f.get('compte'), p_justificatif: 'pieces-comptables/' + chemin, p_fournisseur: null
    });
    P.message('Dépense ' + numero + ' enregistrée.');
    P.afficher();
  };
  // pièces en stockage privé : lien signé valable 2 minutes
  P.actions['compta-piece'] = async (el) => {
    const chemin = el.getAttribute('data-chemin').replace(/^pieces-comptables\//, '');
    const r = await P.bd(sb.storage.from('pieces-comptables').createSignedUrl(chemin, 120));
    window.open(r.signedUrl, '_blank', 'noopener');
  };

  // ---------- Impôts ----------
  async function impots() {
    const liste = await P.bd(sb.from('tax_obligations').select('*').order('echeance'));
    const bientot = (e) => e.statut === 'a_faire' && (new Date(e.echeance) - Date.now()) / 864e5 <= e.rappel_jours;
    return P.entete('Impôts et taxes') + '<div class="note">Échéancier à définir avec le comptable. La déclaration reste faite par le comptable ; ici, on suit les rappels et on enregistre les impôts payés comme dépenses (catégorie « Impôts et taxes »).</div>' +
      '<form class="carte f" data-form="compta-impot"><label class="fl" for="im-ob">Obligation<input id="im-ob" name="obligation" required></label>' +
      '<label class="fl" for="im-ech">Échéance<input id="im-ech" name="echeance" type="date" required></label><label class="fl" for="im-r">Rappel (jours avant)<input id="im-r" name="rappel" type="number" min="0" value="7"></label>' +
      '<button class="btn rouge" type="submit">Ajouter le rappel</button></form>' +
      P.tableau(['Obligation', 'Échéance', 'Statut', 'Action'], liste.map((e) => '<tr class="' + (bientot(e) ? 'en-retard' : '') + '"><td><b>' + P.esc(e.obligation) + '</b></td><td>' + P.date(e.echeance) + '</td><td>' +
        P.pastille(e.statut === 'fait' ? 'Fait' : bientot(e) ? 'Bientôt' : 'À faire', e.statut === 'fait' ? 'ok' : bientot(e) ? 'erreur' : 'alerte') + '</td><td><button class="btn petit" data-action="compta-impot-fait" data-id="' + e.id + '" data-statut="' + e.statut + '">' + (e.statut === 'fait' ? 'Rouvrir' : 'Marquer fait') + '</button></td></tr>'));
  }
  P.formulaires['compta-impot'] = async (f) => {
    await P.bd(sb.from('tax_obligations').insert({ obligation: String(f.get('obligation')).trim(), echeance: f.get('echeance'), rappel_jours: Number(f.get('rappel')) || 7 }));
    P.message('Rappel ajouté.');
    P.afficher();
  };
  P.actions['compta-impot-fait'] = async (el) => {
    await P.bd(sb.from('tax_obligations').update({ statut: el.getAttribute('data-statut') === 'fait' ? 'a_faire' : 'fait' }).eq('id', el.getAttribute('data-id')));
    P.afficher();
  };

  // ---------- Trésorerie et rapprochement Wave ----------
  async function tresorerie() {
    const m = moisChoisi(), lignes = await ecrituresDuMois(m);
    const parCompte = {};
    comptes.forEach((c) => { parCompte[c.code] = { entrees: 0, sorties: 0 }; });
    lignes.forEach((e) => { const c = parCompte[e.compte] || (parCompte[e.compte] = { entrees: 0, sorties: 0 }); c[e.sens === 'recette' ? 'entrees' : 'sorties'] += e.montant; });
    return P.entete('Trésorerie', selecteurMois()) +
      P.tableau(['Compte', '#Entrées', '#Sorties', '#Solde du mois'], Object.keys(parCompte).map((k) => '<tr><td><b>' + P.esc(libelleCompte(k)) + '</b></td><td class="nombre">' + P.fcfa(parCompte[k].entrees) +
        '</td><td class="nombre">' + P.fcfa(parCompte[k].sorties) + '</td><td class="nombre">' + P.fcfa(parCompte[k].entrees - parCompte[k].sorties) + '</td></tr>')) +
      '<div class="carte"><h2>Rapprochement avec le relevé Wave Business</h2><p class="doux">Importez le relevé exporté depuis Wave Business (fichier CSV) : chaque transaction est comparée aux écritures du compte Wave (montant et date). Les écarts s’affichent ci-dessous.</p>' +
      '<label class="fl" for="tr-csv" style="margin-top:10px">Relevé Wave (CSV)<input id="tr-csv" type="file" accept=".csv,text/csv" data-change="compta-releve"></label><div id="ecarts" style="margin-top:12px"></div></div>';
  }
  P.changements['compta-releve'] = async (el) => {
    const fichier = el.files && el.files[0];
    if (!fichier) return;
    const texte = await fichier.text();
    const lignes = texte.split(/\r?\n/).filter(Boolean);
    const sep = (lignes[0].match(/;/g) || []).length > (lignes[0].match(/,/g) || []).length ? ';' : ',';
    const tete = lignes[0].toLowerCase().split(sep);
    const iMontant = tete.findIndex((h) => /montant|amount/.test(h)), iDate = tete.findIndex((h) => /date/.test(h));
    if (iMontant < 0 || iDate < 0) { document.getElementById('ecarts').innerHTML = '<div class="note erreur">Colonnes « date » et « montant » introuvables dans ce fichier.</div>'; return; }
    const releve = lignes.slice(1).map((l) => l.split(sep)).map((c) => ({ date: String(c[iDate] || '').slice(0, 10), montant: Math.abs(Math.round(Number(String(c[iMontant]).replace(/[^\d,.-]/g, '').replace(',', '.')))) })).filter((x) => x.montant);
    const ecritures = (await ecrituresDuMois(moisChoisi())).filter((e) => e.compte === 'wave').map((e) => Object.assign({ pris: false }, e));
    const seuls = releve.filter((t) => {
      const e = ecritures.find((x) => !x.pris && x.montant === t.montant);
      if (e) { e.pris = true; return false; }
      return true;
    });
    const orphelines = ecritures.filter((e) => !e.pris);
    document.getElementById('ecarts').innerHTML = '<div class="note ' + (seuls.length || orphelines.length ? 'erreur' : 'ok') + '">' + (releve.length - seuls.length) + ' transaction(s) rapprochée(s). ' +
      seuls.length + ' transaction(s) du relevé sans écriture, ' + orphelines.length + ' écriture(s) sans transaction.</div>' +
      (seuls.length ? P.tableau(['Relevé Wave : date', '#Montant'], seuls.map((t) => '<tr><td>' + P.esc(t.date) + '</td><td class="nombre">' + P.fcfa(t.montant) + '</td></tr>')) : '') +
      (orphelines.length ? P.tableau(['Écriture sans transaction', 'Pièce', '#Montant'], orphelines.map((e) => '<tr><td>' + P.date(e.date_ecriture) + '</td><td>' + P.esc(e.reference) + '</td><td class="nombre">' + P.fcfa(e.montant) + '</td></tr>')) : '');
  };

  // ---------- Clôture ----------
  async function cloture() {
    const m = moisChoisi();
    const [lignes, depensesMois, enAttente, nonPayees, periode] = await Promise.all([
      ecrituresDuMois(m),
      P.bd(sb.from('expenses').select('numero, justificatif').gte('date_depense', m).lte('date_depense', finDeMois(m))),
      sb.from('payment_declarations').select('*', { count: 'exact', head: true }).eq('statut', 'declare'),
      P.bd(sb.from('invoices').select('numero, total_ttc, paye').eq('type', 'facture').in('statut', ['emis', 'envoye', 'partiel'])),
      sb.from('fiscal_periods').select('*').eq('mois', m).maybeSingle()
    ]);
    const sansPiece = depensesMois.filter((e) => !e.justificatif).length;
    const verrouille = periode.data && periode.data.statut === 'verrouillee';
    const controles = [
      [sansPiece === 0, 'Toutes les dépenses ont un justificatif' + (sansPiece ? ' (' + sansPiece + ' manquant)' : '')],
      [!enAttente.count, 'Aucun paiement de mannequin en attente de rapprochement' + (enAttente.count ? ' (' + enAttente.count + ')' : '') + ' (vu en totaux, sans nom)'],
      [true, 'Recettes enregistrées avec leur reçu ou leur facture'],
      [nonPayees.length === 0, nonPayees.length + ' facture(s) émise(s) non payée(s) : à suivre (n’empêche pas la clôture)']
    ];
    P.etat.journal = lignes;
    return P.entete('Clôture de ' + P.mois(m), selecteurMois()) +
      '<div class="carte"><h2>Liste de contrôle</h2><div class="grille" style="gap:10px;margin-top:12px">' + controles.map((c) => '<div class="ligne">' + P.pastille(c[0] ? '✓' : '!', c[0] ? 'ok' : 'erreur') + '<span>' + P.esc(c[1]) + '</span></div>').join('') + '</div>' +
      '<div class="ligne" style="margin-top:16px"><button class="btn rouge" data-action="compta-verrouiller"' + (verrouille || sansPiece ? ' disabled' : '') + '>' + (verrouille ? 'Période verrouillée le ' + P.dateHeure(periode.data.verrouille_le) : 'Verrouiller la période') + '</button></div></div>' +
      '<div class="carte"><h2>Dossier du mois pour le comptable</h2><p class="doux">Journal des recettes et des dépenses, liste des factures émises, état de trésorerie et des créances.</p>' +
      '<div class="ligne" style="margin-top:12px"><button class="btn" data-action="compta-export-journal">Journal (Excel, CSV)</button><button class="btn" data-action="compta-export-factures">Factures émises (CSV)</button><button class="btn" data-action="imprimer">État du mois (PDF)</button></div>' +
      '<pre class="journal" style="margin-top:12px">' + P.esc(['date;sens;activite;montant;piece;compte;libelle'].concat(lignes.map((e) => [e.date_ecriture, e.sens, e.activite, e.montant, e.reference, e.compte, e.libelle].join(';'))).join('\n')) + '</pre></div>' +
      '<div class="carte"><h2>Ce que demande un cabinet chaque fin de mois</h2><ul class="petit-texte"><li>Journal des ventes et des achats</li><li>Relevés de caisse, banque et mobile money (Wave)</li><li>Factures émises et reçues, justificatifs</li><li>État des créances</li><li>Charges de personnel, pièces fiscales</li></ul><p class="petit-texte doux">Liste de départ à faire valider par le cabinet retenu.</p></div>';
  }
  P.actions['compta-verrouiller'] = async () => {
    if (!confirm('Verrouiller ' + P.mois(moisChoisi()) + ' ? Plus aucune écriture ne sera possible sur ce mois (sauf administrateur principal).')) return;
    await P.rpc('compta_verrouiller', { p_mois: moisChoisi() });
    P.message('Période verrouillée.');
    P.afficher();
  };
  P.actions['compta-export-journal'] = () => P.telecharger(P.csv(['Date', 'Sens', 'Activité', 'Montant', 'Pièce', 'Compte', 'Libellé'],
    P.etat.journal.map((e) => [P.date(e.date_ecriture), e.sens, libelleActivite(e.activite), e.montant, e.reference, libelleCompte(e.compte), e.libelle])), 'journal-' + moisChoisi().slice(0, 7) + '.csv');
  P.actions['compta-export-factures'] = async () => {
    const m = moisChoisi();
    const docs = await P.bd(sb.from('invoices').select('numero, type, date_emission, total_ht, total_tva, total_ttc, paye, statut, client:clients(nom)').not('numero', 'is', null).gte('date_emission', m).lte('date_emission', finDeMois(m)).order('numero'));
    P.telecharger(P.csv(['Numéro', 'Type', 'Date', 'Client', 'HT', 'TVA', 'TTC', 'Payé', 'Statut'], docs.map((d) => [d.numero, TYPES[d.type], P.date(d.date_emission), d.client && d.client.nom, d.total_ht, d.total_tva, d.total_ttc, d.paye, STATUT_DOC[d.statut][0]])), 'factures-' + m.slice(0, 7) + '.csv');
  };

  // ---------- Demandes du comptable ----------
  async function demandes() {
    const liste = await P.bd(sb.from('accountant_requests').select('*').order('cree_le', { ascending: false }));
    return P.entete('Demandes du comptable') + '<div class="note info">Le comptable demande une pièce ou une précision sur une écriture ; l’administrateur principal répond ici.</div>' +
      '<form class="carte f" data-form="compta-demande"><label class="fl large" for="dm-obj">Demande<input id="dm-obj" name="objet" required placeholder="Ex. justificatif de la dépense DEP-2026-0012"></label><button class="btn rouge" type="submit">Envoyer la demande</button></form>' +
      P.tableau(['Date', 'Demande', 'Statut', 'Réponse'], liste.map((d) => '<tr><td>' + P.dateHeure(d.cree_le) + '</td><td>' + P.esc(d.objet) + '</td><td>' + P.pastille(d.statut === 'ouverte' ? 'Ouverte' : 'Traitée', d.statut === 'ouverte' ? 'alerte' : 'ok') + '</td><td>' +
        (d.statut === 'ouverte' && P.moi.role === 'principal' ? '<form data-form="compta-reponse" class="ligne"><input type="hidden" name="id" value="' + d.id + '"><input name="reponse" aria-label="Réponse" required style="min-width:180px"><button class="btn petit" type="submit">Répondre</button></form>' : P.esc(d.reponse || '—')) + '</td></tr>'));
  }
  P.formulaires['compta-demande'] = async (f) => {
    await P.bd(sb.from('accountant_requests').insert({ objet: String(f.get('objet')).trim(), cree_par: (await sb.auth.getUser()).data.user.id }));
    P.message('Demande envoyée à l’administrateur principal.');
    P.afficher();
  };
  P.formulaires['compta-reponse'] = async (f) => {
    await P.bd(sb.from('accountant_requests').update({ reponse: String(f.get('reponse')).trim(), statut: 'traitee', traite_le: new Date().toISOString() }).eq('id', f.get('id')));
    P.afficher();
  };

  // ---------- Accès du comptable (administrateur principal) ----------
  async function acces() {
    if (P.moi.role !== 'principal') return P.refuse();
    const comptesPortail = await P.bd(sb.from('staff_profiles').select('*, appareils:staff_devices(id, revoque)').eq('role', 'compta'));
    return P.entete('Accès du comptable') + '<div class="note">Le comptable installe l’application chez lui avec un lien d’invitation et sa double authentification. Vous pouvez couper son accès à tout moment : il est refusé immédiatement, même si l’application reste installée.</div>' +
      P.tableau(['Compte', 'E-mail', 'Appareils', 'Accès', 'Action'], comptesPortail.map((a) => '<tr><td><b>' + P.esc(a.nom) + '</b></td><td>' + P.esc(a.email) + '</td><td>' + (a.appareils || []).filter((x) => !x.revoque).length + '</td><td>' +
        P.pastille(a.actif ? 'Actif' : 'Coupé', a.actif ? 'ok' : 'erreur') + '</td><td><button class="btn petit" data-action="securite-actif" data-id="' + a.user_id + '" data-actif="' + (a.actif ? '1' : '0') + '">' + (a.actif ? 'Couper l’accès' : 'Rétablir') + '</button></td></tr>')) +
      '<p><a class="btn" href="#/securite/comptes">Inviter un comptable</a></p>';
  }

  // ---------- Entité ----------
  async function entitePage() {
    const e = entite, modifiable = P.moi.role === 'principal' || P.moi.role === 'compta';
    const champ = (nom, libelle) => '<label class="fl" for="en-' + nom + '">' + libelle + '<input id="en-' + nom + '" name="' + nom + '" value="' + P.esc(e[nom] || '') + '"' + (modifiable ? '' : ' disabled') + '></label>';
    return P.entete('Paramètres de l’entité') + '<form class="carte f" data-form="compta-entite"><h2>Identité légale (à renseigner après constitution)</h2>' +
      champ('raison_sociale', 'Raison sociale') + champ('rccm', 'Numéro RCCM') + champ('ncc', 'Numéro de compte contribuable') + champ('regime', 'Régime d’imposition') +
      '<label class="fl" for="en-tva">Assujettissement à la TVA<select id="en-tva" name="assujetti_tva"><option value="">À préciser</option><option value="oui"' + (e.assujetti_tva === true ? ' selected' : '') + '>Oui</option><option value="non"' + (e.assujetti_tva === false ? ' selected' : '') + '>Non</option></select></label>' +
      '<label class="fl" for="en-taux">Taux de TVA (%)<input id="en-taux" name="taux_tva" type="number" step="0.01" min="0" value="' + P.esc(e.taux_tva) + '"></label>' +
      '<div class="note">L’interrupteur légal ne s’active que si ces champs sont remplis. Il n’est pas rétroactif : les documents déjà émis restent des documents internes. Taux normal en Côte d’Ivoire : 18 %, à confirmer par le comptable.</div>' +
      (modifiable ? '<button class="btn rouge" type="submit">Enregistrer</button>' : '') + '</form>';
  }
  P.formulaires['compta-entite'] = async (f) => {
    const tva = f.get('assujetti_tva');
    await P.bd(sb.from('company_settings').update({
      raison_sociale: String(f.get('raison_sociale')).trim() || null, rccm: String(f.get('rccm')).trim() || null, ncc: String(f.get('ncc')).trim() || null,
      regime: String(f.get('regime')).trim() || null, assujetti_tva: tva === '' ? null : tva === 'oui', taux_tva: Number(f.get('taux_tva')) || 18, modifie_le: new Date().toISOString()
    }).eq('id', true));
    P.message('Identité légale enregistrée.');
    P.afficher();
  };

  P.espaces.compta = { nav: NAV, avant, pages: { tableau, recettes, factures, depenses, impots, tresorerie, cloture, demandes, acces, entite: entitePage } };
})();
