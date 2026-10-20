// Espace 3 — Comptabilité, morceaux C et D (cahier v2.4, section 6, points 3 et 6, interrupteur
// « mode légal ») : devis, proformas, factures, avoirs et reçus numérotés sans trou (la base
// donne le numéro et calcule les totaux, compta_document_creer) et leur PDF ; impôts et taxes
// (échéancier, paiement = dépense liée, TVA collectée en mode légal) ; identité de l'agence et
// mode légal (administrateur principal seulement, définitif).
// Outils communs : P.compta (espace-compta.js), P.comptaPdf (compta-pdf.js).
(function () {
  'use strict';
  const P = window.Portail, C = P.compta;
  const TYPES = { devis: 'Devis', proforma: 'Proforma', facture: 'Facture', avoir: 'Avoir', recu: 'Reçu' };
  const FILTRES = { tous: 'Tous', devis: 'Devis', proforma: 'Proformas', facture: 'Factures', avoir: 'Avoirs', recu: 'Reçus' };
  const ETATS = { emis: ['Émis', 'neutre'], en_attente: ['En attente', 'info'], accepte: ['Accepté', 'ok'], refuse: ['Refusé', 'erreur'], facture: ['Facturé', 'ok'] };
  const IMPOTS = ['Patente', 'Impôt synthétique', 'CNPS (cotisations sociales)', 'ITS (impôt sur les salaires)', 'TVA', 'Taxe communale', 'Impôt foncier'];
  const t = C.champ;
  const reglages = () => P.bd(sb.from('compta_reglages').select('*').eq('id', 1).single());
  const actualiser = C.actualiser;
  const bouton = (action, id, libelle, rouge) => '<button class="btn petit' + (rouge ? ' rouge' : '') + '" type="button" data-action="' + action + '" data-id="' + id + '">' + libelle + '</button>';
  const fermer = '<button class="btn" type="button" data-action="fermer-fenetre">Fermer</button>';

  // ---------- Documents ----------
  const ligneSaisie = (i) => '<div class="grille-lignes" data-ligne>' +
    '<label class="fl" for="dl-d' + i + '">Désignation<input id="dl-d' + i + '" name="designation" maxlength="300"></label>' +
    '<label class="fl" for="dl-q' + i + '">Quantité<input id="dl-q' + i + '" name="quantite" type="number" inputmode="decimal" min="0" step="any" value="1"></label>' +
    '<label class="fl" for="dl-p' + i + '">Prix unitaire (FCFA)<input id="dl-p' + i + '" name="prix" type="number" inputmode="numeric" min="0" step="1"></label></div>';
  async function documents() {
    const m = C.moisChoisi(), debut = m;
    const fin = C.bornes(m)[1];
    const [docs, clients, r, recettes] = await Promise.all([
      P.bd(sb.from('compta_documents').select('*').gte('date_doc', debut).lt('date_doc', fin).order('cree_le', { ascending: false })),
      P.bd(sb.from('compta_tiers').select('*').eq('type', 'client').eq('actif', true).order('nom')),
      reglages(), C.ecritures(m, 'recette')
    ]);
    const filtre = P.etat.filtreDocuments || 'tous';
    const liste = docs.filter((d) => filtre === 'tous' || d.type === filtre);
    P.etat.comptaDocs = docs;
    const sansRecu = recettes.filter((e) => !e.annule && e.source === 'manuel' && !docs.some((d) => d.ecriture_id === e.id && !d.annule));
    return P.entete('Documents · ' + P.mois(m), C.choixMois()) +
      (r.mode_legal ? '<div class="note ok">Mode légal activé : les nouvelles factures sont de vraies factures, avec TVA (' + P.esc(String(r.tva_taux).replace('.', ',')) + ' %).</div>'
        : '<div class="note info">Mode non fiscal : chaque document porte la mention « non fiscal », sans TVA. Les numéros se suivent sans trou ; un document ne s’efface jamais (une facture se corrige par un avoir).</div>') +
      (clients.length ? '<form class="carte f" data-form="compta-document" id="form-document"><h2>Nouveau document</h2>' +
        '<label class="fl" for="do-type">Type<select id="do-type" name="type" data-change="compta-doc-type">' + ['devis', 'proforma', 'facture', 'recu'].map((k) => '<option value="' + k + '">' + TYPES[k] + '</option>').join('') + '</select></label>' +
        '<label class="fl" for="do-client">Client<select id="do-client" name="tiers_id" required>' + clients.map((x) => '<option value="' + x.id + '">' + P.esc(x.nom) + '</option>').join('') + '</select></label>' +
        '<label class="fl" for="do-date">Date<input id="do-date" name="date_doc" type="date" required max="' + P.aujourdhui() + '" value="' + P.aujourdhui() + '"></label>' +
        '<label class="fl" for="do-validite" data-pour="devis proforma">Valable jusqu’au (facultatif)<input id="do-validite" name="validite" type="date"></label>' +
        '<label class="fl" for="do-echeance" data-pour="facture" hidden>À payer avant le (facultatif)<input id="do-echeance" name="echeance" type="date"></label>' +
        '<label class="fl" for="do-cat" data-pour="facture" hidden>Catégorie de recette<select id="do-cat" name="categorie">' + C.optionsCategories(C.RECETTES) + '</select></label>' +
        '<label class="fl large" for="do-recette" data-pour="recu" hidden>Recette encaissée<select id="do-recette" name="ecriture_id">' +
          (sansRecu.length ? sansRecu.map((e) => '<option value="' + e.id + '">' + P.esc(P.date(e.date_op) + ' · ' + e.libelle + ' · ' + P.fcfa(e.montant)) + '</option>').join('') : '<option value="">Aucune recette de ce mois sans reçu</option>') + '</select></label>' +
        '<div class="large" data-pour="devis proforma facture" id="do-lignes">' + [0, 1, 2].map(ligneSaisie).join('') + '</div>' +
        '<div class="large ligne" data-pour="devis proforma facture"><button class="btn petit" type="button" data-action="compta-doc-ligne">＋ Ajouter une ligne</button></div>' +
        '<label class="fl large" for="do-notes">Conditions ou remarques (facultatif)<textarea id="do-notes" name="notes" maxlength="1000"></textarea></label>' +
        '<div class="large ligne"><button class="btn rouge" type="submit">Créer le document</button></div></form>'
        : '<div class="note">Ajoutez d’abord un client dans le <a href="#/compta/carnet">carnet</a>.</div>') +
      '<div class="segments">' + Object.entries(FILTRES).map((x) => '<button class="btn petit' + (x[0] === filtre ? ' actif' : '') + '" type="button" data-action="compta-doc-filtre" data-filtre="' + x[0] + '">' + P.esc(x[1]) + '</button>').join('') + '</div>' +
      P.tableau(['Numéro', 'Client', 'Date', '#Total', 'État', ''], liste.map((d) => {
        const actions = [bouton('compta-doc-pdf', d.id, 'PDF')];
        if (!d.annule && d.type !== 'recu') actions.push(bouton('compta-doc-envoyer', d.id, 'Envoyer', true));
        if (!d.annule && (d.type === 'devis' || d.type === 'proforma') && d.etat !== 'facture') {
          actions.push(bouton('compta-doc-facturer', d.id, 'Facturer', true));
          if (d.etat !== 'accepte') actions.push(bouton('compta-doc-accepte', d.id, 'Accepté'));
          if (d.etat !== 'refuse') actions.push(bouton('compta-doc-refuse', d.id, 'Refusé'));
        }
        if (d.type === 'facture') actions.push(bouton('compta-doc-avoir', d.id, 'Avoir'));
        if (d.fiscal && !d.fne_reference && (d.type === 'facture' || d.type === 'avoir')) actions.push(bouton('compta-doc-fne', d.id, 'N° FNE'));
        if (!d.annule && ['devis', 'proforma', 'recu'].indexOf(d.type) !== -1) actions.push(bouton('compta-doc-annuler', d.id, 'Annuler'));
        const origine = d.origine_id && docs.find((x) => x.id === d.origine_id);
        return '<tr' + (d.annule ? ' class="annulee"' : '') + '><td><b>' + P.esc(d.numero) + '</b><div class="petit-texte doux">' + TYPES[d.type] + (d.fiscal ? '' : ' · non fiscal') +
          (origine ? ' · ' + P.esc(origine.numero) : '') + (d.fne_reference ? ' · FNE ' + P.esc(d.fne_reference) : '') + '</div></td>' +
          '<td>' + P.esc((d.destinataire || {}).nom || '') + '</td><td>' + P.date(d.date_doc) + '</td><td class="nombre">' + P.fcfa(d.total_ttc) + '</td>' +
          '<td>' + (d.annule ? P.pastille('Annulé', 'erreur') + '<div class="petit-texte">' + P.esc(d.motif_annulation) + '</div>' : P.pastille(ETATS[d.etat][0], ETATS[d.etat][1])) + '</td>' +
          '<td><div class="ligne">' + actions.join('') + '</div></td></tr>';
      }));
  }
  // champs propres à chaque type (data-pour="types…")
  P.changements['compta-doc-type'] = (el) => {
    const form = el.closest('form');
    form.querySelectorAll('[data-pour]').forEach((x) => { x.hidden = x.getAttribute('data-pour').split(' ').indexOf(el.value) === -1; });
  };
  P.actions['compta-doc-ligne'] = () => {
    const zone = document.getElementById('do-lignes');
    if (zone && zone.children.length < 50) zone.insertAdjacentHTML('beforeend', ligneSaisie(zone.children.length));
  };
  P.actions['compta-doc-filtre'] = (el) => { P.etat.filtreDocuments = el.getAttribute('data-filtre'); P.afficher(); };
  function lireLignes(form) {
    return Array.from(form.querySelectorAll('[data-ligne]')).map((l) => ({
      designation: l.querySelector('[name=designation]').value.trim(), quantite: Number(l.querySelector('[name=quantite]').value), prix: Math.round(Number(l.querySelector('[name=prix]').value))
    })).filter((l) => l.designation || l.prix);
  }
  async function creer(params, texte) {
    const r = await P.rpc('compta_document_creer', { p: params });
    await actualiser(texte.replace('{n}', r.numero));
    return r;
  }
  P.formulaires['compta-document'] = async (f, form) => {
    const type = t(f, 'type');
    const p = { type, tiers_id: t(f, 'tiers_id'), date_doc: t(f, 'date_doc'), notes: t(f, 'notes') };
    if (type === 'recu') {
      const e = (await C.ecritures(C.moisChoisi(), 'recette')).find((x) => x.id === t(f, 'ecriture_id'));
      if (!e) return P.message('Choisissez la recette encaissée.');
      Object.assign(p, { ecriture_id: e.id, lignes: [{ designation: e.libelle, quantite: 1, prix: e.montant }] });
    } else {
      p.lignes = lireLignes(form);
      if (!p.lignes.length) return P.message('Ajoutez au moins une ligne.');
      if (p.lignes.some((l) => !l.designation || !(l.quantite > 0) || !(l.prix >= 0))) return P.message('Chaque ligne : désignation, quantité et prix.');
      if (type === 'facture') Object.assign(p, { echeance: t(f, 'echeance'), categorie: t(f, 'categorie') });
      else p.validite = t(f, 'validite');
    }
    try {
      await creer(p, TYPES[type] + ' {n} créé.' + (type === 'facture' ? ' La somme due est dans « Ce qu’on nous doit ».' : ''));
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  const trouver = (id) => (P.etat.comptaDocs || []).find((d) => d.id === id);
  P.actions['compta-doc-pdf'] = async (el) => {
    const d = trouver(el.getAttribute('data-id'));
    if (!d) return;
    P.message('Préparation du PDF…');
    const [r, origine] = await Promise.all([reglages(), d.origine_id ? P.bd(sb.from('compta_documents').select('numero').eq('id', d.origine_id).single()) : null]);
    P.telecharger(await P.comptaPdf.documentPdf(d, r, origine && origine.numero), d.numero + '.pdf', 'application/pdf');
  };
  // Envoyer un document au client : le PDF est préparé, puis partagé (WhatsApp, e-mail… au choix de
  // l'appareil), ou envoyé par un lien WhatsApp / e-mail avec le message déjà écrit (PDF à joindre).
  const LIBELLE_DOC = { devis: 'devis', proforma: 'facture proforma', facture: 'facture', avoir: 'avoir' };
  P.actions['compta-doc-envoyer'] = async (el) => {
    const d = trouver(el.getAttribute('data-id'));
    if (!d) return;
    P.message('Préparation du document…');
    try {
      const [r, origine, tiers] = await Promise.all([
        reglages(),
        d.origine_id ? P.bd(sb.from('compta_documents').select('numero').eq('id', d.origine_id).single()) : null,
        d.tiers_id ? P.bd(sb.from('compta_tiers').select('nom, telephone, email').eq('id', d.tiers_id).maybeSingle()) : null
      ]);
      const contenu = await P.comptaPdf.documentPdf(d, r, origine && origine.numero);
      const nomFichier = d.numero + '.pdf';
      const fichier = new File([contenu], nomFichier, { type: 'application/pdf' });
      const nomClient = (tiers && tiers.nom) || (d.destinataire || {}).nom || '';
      const agence = r.nom_commercial || 'Maître Akesse Model Management';
      const libelle = LIBELLE_DOC[d.type] || 'document';
      const texte = 'Bonjour' + (nomClient ? ' ' + nomClient : '') + ',\n\nVeuillez trouver ci-joint votre ' + libelle + ' N° ' + d.numero + ' d’un montant de ' + P.fcfa(d.total_ttc) + '.\n\nCordialement,\n' + agence;
      P.etat.docPartage = { fichier, contenu, nomFichier, texte };
      const n = tiers && tiers.telephone && window.numeroWhatsAppMa2m ? window.numeroWhatsAppMa2m(tiers.telephone) : '';
      const lienWa = 'https://wa.me/' + (n || '') + '?text=' + encodeURIComponent(texte);
      const lienMail = 'mailto:' + encodeURIComponent((tiers && tiers.email) || '') + '?subject=' + encodeURIComponent(libelle.charAt(0).toUpperCase() + libelle.slice(1) + ' N° ' + d.numero + ' · ' + agence) + '&body=' + encodeURIComponent(texte);
      const peutPartager = !!(navigator.canShare && navigator.canShare({ files: [fichier] }));
      P.fenetre('<h2>Envoyer ' + P.esc(d.numero) + '</h2><p class="doux">' + (nomClient ? 'Pour ' + P.esc(nomClient) + '. ' : '') +
        (peutPartager ? 'Le plus simple : « Partager le PDF », puis choisissez WhatsApp ou votre messagerie.' : 'Téléchargez le PDF, puis envoyez-le avec WhatsApp ou par e-mail (le message est déjà écrit).') + '</p>' +
        '<div class="ligne">' + (peutPartager ? '<button class="btn rouge" type="button" data-action="compta-doc-partager">Partager le PDF</button>' : '') +
        '<button class="btn' + (peutPartager ? '' : ' rouge') + '" type="button" data-action="compta-doc-telecharger-envoi">Télécharger le PDF</button>' +
        '<a class="btn" href="' + P.esc(lienWa) + '" target="_blank" rel="noopener">WhatsApp</a>' +
        '<a class="btn" href="' + P.esc(lienMail) + '">E-mail</a>' + fermer + '</div>' +
        (n ? '' : '<p class="petit-texte doux">Pas de numéro WhatsApp pour ce client : WhatsApp s’ouvrira sans destinataire, vous le choisirez.</p>') +
        ((tiers && tiers.email) ? '' : '<p class="petit-texte doux">Pas d’e-mail pour ce client : vous saisirez l’adresse dans votre messagerie.</p>'));
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['compta-doc-partager'] = async () => {
    const x = P.etat.docPartage;
    if (!x) return;
    try { await navigator.share({ files: [x.fichier], text: x.texte, title: x.nomFichier }); }
    catch (e) { if (!e || e.name !== 'AbortError') P.message('Le partage n’a pas abouti : téléchargez le PDF et envoyez-le avec WhatsApp ou par e-mail.'); }
  };
  P.actions['compta-doc-telecharger-envoi'] = () => {
    const x = P.etat.docPartage;
    if (x) P.telecharger(x.contenu, x.nomFichier, 'application/pdf');
  };
  const changerEtat = (etat, texte) => async (el) => {
    const r = await P.bd(sb.from('compta_documents').update({ etat }).eq('id', el.getAttribute('data-id')).select('id'));
    if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
    await actualiser(texte);
  };
  P.actions['compta-doc-accepte'] = changerEtat('accepte', 'Marqué « accepté ».');
  P.actions['compta-doc-refuse'] = changerEtat('refuse', 'Marqué « refusé ».');
  P.actions['compta-doc-facturer'] = async (el) => {
    const d = trouver(el.getAttribute('data-id'));
    if (!d || !confirm('Créer la facture à partir de « ' + d.numero + ' » (' + P.fcfa(d.total_ht) + ' hors taxes) ?')) return;
    el.disabled = true;  // (la base refuse de toute façon une deuxième facture du même devis)
    try {
      await creer({ type: 'facture', tiers_id: d.tiers_id, origine_id: d.id, lignes: d.lignes, notes: d.notes, categorie: 'prestation' }, 'Facture {n} créée. La somme due est dans « Ce qu’on nous doit ».');
    } finally { if (el.isConnected) el.disabled = false; }
  };
  P.actions['compta-doc-avoir'] = (el) => {
    const d = trouver(el.getAttribute('data-id'));
    if (!d) return;
    P.fenetre('<form data-form="compta-doc-avoir" data-id="' + d.id + '" class="grille" style="gap:12px"><h2>Avoir sur ' + P.esc(d.numero) + '</h2>' +
      '<p class="doux">Pour corriger la facture : erreur, remise, prestation annulée. La somme due par le client baisse d’autant' + (d.tva ? ' (TVA comprise)' : '') + '.</p>' +
      '<label class="fl" for="av-motif">Motif<input id="av-motif" name="designation" required maxlength="300" placeholder="Ex. : remise accordée"></label>' +
      '<label class="fl" for="av-montant">Montant' + (d.tva ? ' hors taxes' : '') + ' (FCFA)<input id="av-montant" name="prix" type="number" inputmode="numeric" min="1" step="1" required></label>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Créer l’avoir</button>' + fermer + '</div></form>');
  };
  P.formulaires['compta-doc-avoir'] = async (f, form) => {
    const d = trouver(form.getAttribute('data-id')), prix = Math.round(Number(f.get('prix')));
    if (!d || !(prix > 0)) return P.message('Indiquez le montant.');
    try { await creer({ type: 'avoir', tiers_id: d.tiers_id, origine_id: d.id, lignes: [{ designation: t(f, 'designation'), quantite: 1, prix }] }, 'Avoir {n} créé.'); } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['compta-doc-fne'] = async (el) => {
    const ref = (prompt('Numéro FNE donné par la plateforme de la DGI pour ce document :') || '').trim();
    if (!ref) return;
    const r = await P.bd(sb.from('compta_documents').update({ fne_reference: ref }).eq('id', el.getAttribute('data-id')).select('id'));
    if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
    await actualiser('Numéro FNE enregistré.');
  };
  P.actions['compta-doc-annuler'] = async (el) => {
    const d = trouver(el.getAttribute('data-id'));
    if (!d) return;
    const motif = (prompt('Annuler ' + d.numero + ' ? Le numéro reste pris, le document reste visible. Motif :') || '').trim();
    if (!motif) return;
    const r = await P.bd(sb.from('compta_documents').update({ annule: true, motif_annulation: motif }).eq('id', d.id).select('id'));
    if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
    await actualiser('Document annulé.');
  };

  // ---------- Impôts et taxes ----------
  async function impots() {
    const m = C.moisChoisi();
    const fin = C.bornes(m)[1];
    const [liste, payes, r, cpts, fiscaux] = await Promise.all([
      P.bd(sb.from('compta_impots').select('*').order('echeance')),
      C.paiementsImpots(),
      reglages(), C.comptes(false),
      P.bd(sb.from('compta_documents').select('type, tva, annule').eq('fiscal', true).gte('date_doc', m).lt('date_doc', fin))
    ]);
    const paye = (i) => !!C.paiementImpot(i, payes);
    const retard = (i) => !i.annule && !paye(i) && i.echeance < P.aujourdhui();
    P.etat.comptaImpots = liste.map((i) => Object.assign({}, i, { paye: paye(i) }));
    const aPayer = liste.filter((i) => !i.annule && !paye(i));
    const tva = fiscaux.filter((d) => !d.annule).reduce((s, d) => s + (d.type === 'facture' ? d.tva : d.type === 'avoir' ? -d.tva : 0), 0);
    return P.entete('Impôts et taxes', C.choixMois()) +
      '<div class="grille chiffres">' + P.chiffre('Reste à payer', P.fcfa(aPayer.reduce((s, i) => s + i.montant, 0)), 'rouge') +
      P.chiffre('En retard', liste.filter(retard).length, liste.some(retard) ? 'rouge' : '') +
      P.chiffre('TVA collectée · ' + P.mois(m), r.mode_legal ? P.fcfa(tva) : 'Désactivée') + '</div>' +
      (r.mode_legal ? '<div class="note info">TVA collectée = TVA des vraies factures du mois moins celle des avoirs. La TVA à reverser et le classement des opérations sont à valider par le comptable.</div>'
        : '<div class="note info">TVA désactivée tant que le mode légal n’est pas activé (agence pas encore immatriculée).</div>') +
      '<form class="carte f" data-form="compta-impot"><h2>Nouvelle échéance</h2>' +
      '<label class="fl" for="im-nom">Impôt ou taxe<input id="im-nom" name="nom" required maxlength="120" list="im-liste" placeholder="Ex. : Patente"></label><datalist id="im-liste">' +
        IMPOTS.map((x) => '<option value="' + P.esc(x) + '">').join('') + '</datalist>' +
      '<label class="fl" for="im-montant">Montant prévu (FCFA)<input id="im-montant" name="montant" type="number" inputmode="numeric" min="0" step="1" required></label>' +
      '<label class="fl" for="im-date">Date limite<input id="im-date" name="echeance" type="date" required></label>' +
      '<label class="fl" for="im-repet">Répéter<select id="im-repet" name="repeter"><option value="1">Une seule fois</option><option value="m">Chaque mois (12 mois)</option>' +
        '<option value="t">Chaque trimestre (4 trimestres)</option><option value="a">Chaque année (3 ans)</option></select></label>' +
      '<div class="large ligne"><button class="btn rouge" type="submit">Ajouter à l’échéancier</button></div></form>' +
      P.tableau(['Impôt ou taxe', 'Date limite', '#Montant', 'État', ''], liste.map((i) => {
        const p = paye(i);
        return '<tr' + (i.annule ? ' class="annulee"' : retard(i) ? ' class="en-retard"' : '') + '><td><b>' + P.esc(i.nom) + '</b>' + (i.periode ? '<div class="petit-texte doux">' + P.esc(i.periode) + '</div>' : '') +
          (i.annule ? '<div class="petit-texte">' + P.esc(i.motif_annulation) + '</div>' : '') + '</td><td>' + P.date(i.echeance) + '</td><td class="nombre">' + P.fcfa(i.montant) + '</td>' +
          '<td>' + (i.annule ? P.pastille('Annulé', 'erreur') : p ? P.pastille('Payé', 'ok') : retard(i) ? P.pastille('En retard', 'erreur') : P.pastille('À payer', 'info')) + '</td>' +
          '<td><div class="ligne">' + (!i.annule && !p ? bouton('compta-impot-payer', i.id, 'Payer', true) + bouton('compta-impot-modifier', i.id, 'Modifier') + bouton('compta-impot-annuler', i.id, 'Annuler') : '') + '</div></td></tr>';
      })) + '<template id="im-comptes">' + C.optionsComptes(cpts) + '</template>';
  }
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  P.formulaires['compta-impot'] = async (f) => {
    const nom = t(f, 'nom'), montant = Math.round(Number(f.get('montant'))), debut = t(f, 'echeance'), rep = t(f, 'repeter');
    if (!nom || !(montant >= 0) || !debut) return P.message('Nom, montant et date limite.');
    const [a, mo, j] = debut.split('-').map(Number);
    const pas = { m: [12, 1], t: [4, 3], a: [3, 12] }[rep] || [1, 0];
    const lignes = [];
    for (let k = 0; k < pas[0]; k++) {
      const d = new Date(Date.UTC(a, mo - 1 + k * pas[1], 1));
      const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      const date = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(Math.min(j, dernier)).padStart(2, '0');
      const periode = rep === 'm' ? MOIS_COURTS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : rep === 't' ? 'T' + (Math.floor(d.getUTCMonth() / 3) + 1) + ' ' + d.getUTCFullYear() : rep === 'a' ? String(d.getUTCFullYear()) : null;
      lignes.push({ nom, periode, echeance: date, montant });
    }
    try {
      await P.bd(sb.from('compta_impots').insert(lignes));
      await actualiser(lignes.length > 1 ? lignes.length + ' échéances ajoutées.' : 'Échéance ajoutée.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  const impot = (id) => (P.etat.comptaImpots || []).find((i) => i.id === id);
  P.actions['compta-impot-payer'] = (el) => {
    const i = impot(el.getAttribute('data-id'));
    if (!i) return;
    P.fenetre('<form data-form="compta-impot-payer" data-id="' + i.id + '" class="grille" style="gap:12px"><h2>Payer : ' + P.esc(i.nom) + '</h2><p class="doux">' + P.esc(i.periode || '') + ' · date limite ' + P.date(i.echeance) + '</p>' +
      '<label class="fl" for="ip-montant">Montant payé (FCFA)<input id="ip-montant" name="montant" type="number" inputmode="numeric" min="1" step="1" required value="' + i.montant + '"></label>' +
      '<label class="fl" for="ip-compte">Payé depuis<select id="ip-compte" name="compte_id" required>' + document.getElementById('im-comptes').innerHTML + '</select></label>' +
      '<label class="fl" for="ip-date">Date<input id="ip-date" name="date_op" type="date" required value="' + P.aujourdhui() + '"></label>' +
      '<label class="fl" for="ip-justif">Quittance (photo ou PDF, 10 Mo au plus)<input id="ip-justif" name="justificatif" type="file" accept="image/*,application/pdf"></label>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Enregistrer le paiement</button>' + fermer + '</div></form>');
  };
  P.formulaires['compta-impot-payer'] = async (f, form) => {
    const montant = Math.round(Number(f.get('montant')));
    if (!(montant > 0)) return P.message('Indiquez le montant.');
    try {
      const justificatif = await C.deposerJustificatif(f.get('justificatif'));
      await P.rpc('compta_impot_payer', { p_id: form.getAttribute('data-id'), p_compte: t(f, 'compte_id'), p_date: t(f, 'date_op'), p_montant: montant, p_justificatif: justificatif });
      await actualiser('Paiement enregistré dans les dépenses (Impôts et taxes).');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['compta-impot-modifier'] = (el) => {
    const i = impot(el.getAttribute('data-id'));
    if (!i) return;
    P.fenetre('<form data-form="compta-impot-modifier" data-id="' + i.id + '" class="grille" style="gap:12px"><h2>' + P.esc(i.nom) + '</h2>' +
      '<label class="fl" for="iq-montant">Montant prévu (FCFA)<input id="iq-montant" name="montant" type="number" inputmode="numeric" min="0" step="1" required value="' + i.montant + '"></label>' +
      '<label class="fl" for="iq-date">Date limite<input id="iq-date" name="echeance" type="date" required value="' + P.esc(i.echeance) + '"></label>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Enregistrer</button>' + fermer + '</div></form>');
  };
  P.formulaires['compta-impot-modifier'] = async (f, form) => {
    try {
      const r = await P.bd(sb.from('compta_impots').update({ montant: Math.round(Number(f.get('montant'))), echeance: t(f, 'echeance') }).eq('id', form.getAttribute('data-id')).select('id'));
      if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
      await actualiser('Échéance modifiée.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['compta-impot-annuler'] = async (el) => {
    const i = impot(el.getAttribute('data-id'));
    if (!i) return;
    const motif = (prompt('Retirer « ' + i.nom + ' » ' + (i.periode || '') + ' de l’échéancier ? Motif :') || '').trim();
    if (!motif) return;
    const r = await P.bd(sb.from('compta_impots').update({ annule: true, motif_annulation: motif }).eq('id', i.id).select('id'));
    if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
    await actualiser('Échéance retirée.');
  };

  // ---------- Identité de l'agence et mode légal ----------
  async function identite() {
    const r = await reglages(), principal = P.moi.role === 'principal';
    const champ = (nom, libelle, o) => '<label class="fl' + (o && o.large ? ' large' : '') + '" for="rg-' + nom + '">' + libelle +
      (o && o.zone ? '<textarea id="rg-' + nom + '" name="' + nom + '" maxlength="500"' + (principal ? '' : ' disabled') + '>' + P.esc(r[nom] || '') + '</textarea>'
        : '<input id="rg-' + nom + '" name="' + nom + '" maxlength="200" value="' + P.esc(r[nom] == null ? '' : r[nom]) + '"' + (o && o.type ? ' type="' + o.type + '"' : '') + (principal ? '' : ' disabled') + '>') + '</label>';
    return P.entete('Identité et mode légal') +
      (principal ? '' : '<div class="note info">Seul l’administrateur principal modifie l’identité de l’agence et le mode légal.</div>') +
      '<form class="carte f" data-form="compta-identite"><h2>Sur tous les documents</h2>' +
      champ('nom_commercial', 'Nom de l’agence') + champ('telephone', 'Téléphone') + champ('email', 'E-mail', { type: 'email' }) + champ('adresse', 'Adresse', { large: true }) +
      champ('pied_de_page', 'Bas de page (conditions de paiement, coordonnées Wave…)', { large: true, zone: true }) +
      '<h2>Identité légale (le jour où l’agence est constituée)</h2>' +
      champ('raison_sociale', 'Raison sociale') + champ('forme_juridique', 'Forme juridique (SARL, SAS…)') + champ('rccm', 'RCCM') +
      champ('ncc', 'Numéro de compte contribuable (NCC)') + champ('regime_fiscal', 'Régime fiscal') + champ('tva_taux', 'Taux de TVA (%)', { type: 'number' }) +
      (principal ? '<div class="large ligne"><button class="btn" type="submit">Enregistrer</button></div>' : '') + '</form>' +
      '<div class="carte"><h2>Mode légal</h2>' + (r.mode_legal
        ? '<p>' + P.pastille('Activé', 'ok') + ' depuis le ' + P.esc(P.dateHeure(r.mode_legal_le)) + '. Les nouvelles factures sont de vraies factures, avec TVA. Les anciens documents restent « non fiscal ».</p>' +
          '<p class="doux petit-texte">FNE (facture normalisée électronique de la DGI) : le branchement direct se fera avec le comptable. En attendant, chaque vraie facture a un bouton « N° FNE » pour noter le numéro donné par la plateforme de la DGI.</p>'
        : '<p>' + P.pastille('Non fiscal', 'neutre') + ' Aujourd’hui : documents marqués « non fiscal », TVA et FNE désactivées.</p>' +
          '<p class="doux">Le jour où l’agence est constituée : remplissez l’identité légale ci-dessus, enregistrez, puis activez. C’est définitif. Rien n’est perdu ni à ressaisir : les nouvelles factures prennent une nouvelle série de numéros (FAC-…), avec la TVA.</p>' +
          (principal ? '<div class="ligne"><button class="btn rouge" type="button" data-action="compta-mode-legal">Activer le mode légal</button></div>' : '')) + '</div>';
  }
  P.formulaires['compta-identite'] = async (f) => {
    const maj = {};
    ['nom_commercial', 'telephone', 'email', 'adresse', 'pied_de_page', 'raison_sociale', 'forme_juridique', 'rccm', 'ncc', 'regime_fiscal'].forEach((k) => { maj[k] = t(f, k); });
    if (!maj.nom_commercial) return P.message('Le nom de l’agence est obligatoire.');
    maj.tva_taux = Number(f.get('tva_taux')) || 0;
    try {
      const r = await P.bd(sb.from('compta_reglages').update(maj).eq('id', 1).select('id'));
      if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
      await actualiser('Identité enregistrée.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['compta-mode-legal'] = async () => {
    if (!confirm('Activer le mode légal ? C’est définitif : les nouvelles factures seront de vraies factures avec TVA.')) return;
    try {
      const r = await P.sensible(() => P.bd(sb.from('compta_reglages').update({ mode_legal: true }).eq('id', 1).select('id')));
      if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
      await actualiser('Mode légal activé.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  const esp = P.espaces.compta;
  esp.nav.push([null, 'Documents et impôts'], ['documents', 'Devis, factures, reçus'], ['impots', 'Impôts et taxes'], ['identite', 'Identité et mode légal']);
  Object.assign(esp.pages, { documents, impots, identite });
})();
