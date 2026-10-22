// Espace 3 — Comptabilité, morceau B (cahier v2.4, section 6, points 5, 7 et 8) : ce qu'on nous
// doit (clients) et ce qu'on doit (fournisseurs), réglés en une ou plusieurs fois ; paiements du
// personnel et des prestataires avec justificatifs (sans calcul de la paie) ; matériel durable
// acheté, suivi à part ; carnet des clients, fournisseurs, personnel et prestataires.
// Outils communs : P.compta (js/portail/espace-compta.js, à charger avant).
// Base : compta_tiers, compta_dettes, compta_materiel, compta_materiel_acheter() (section 10).
(function () {
  'use strict';
  const P = window.Portail, C = P.compta;
  const TYPES = { client: 'Client', fournisseur: 'Fournisseur', personnel: 'Personnel', prestataire: 'Prestataire' };
  const ETATS = { en_service: ['En service', 'ok'], en_panne: ['En panne', 'alerte'], sorti: ['Sorti de l’inventaire', 'neutre'] };
  const t = C.champ;
  const montantDe = (f) => Math.round(Number(f.get('montant')));
  async function tiers(types) {
    const l = await P.bd(sb.from('compta_tiers').select('*').order('nom'));
    return types ? l.filter((x) => types.indexOf(x.type) !== -1) : l;
  }
  const optionsTiers = (l) => l.filter((x) => x.actif).map((x) => '<option value="' + x.id + '">' + P.esc(x.nom) + '</option>').join('');
  const champJustif = (id) => '<label class="fl" for="' + id + '">Justificatif (photo ou PDF, 10 Mo au plus)<input id="' + id + '" name="justificatif" type="file" accept="image/*,application/pdf"></label>';
  const champDate = (id, nom, libelle, valeur, requis) => '<label class="fl" for="' + id + '">' + libelle + '<input id="' + id + '" name="' + nom + '" type="date"' +
    (requis ? ' required' : '') + ' value="' + P.esc(valeur || '') + '"></label>';
  const champMontant = (id, valeur) => '<label class="fl" for="' + id + '">Montant (FCFA)<input id="' + id + '" name="montant" type="number" inputmode="numeric" min="1" step="1" required' +
    (valeur ? ' value="' + valeur + '"' : '') + '></label>';
  const actualiser = C.actualiser;

  // ---------- Ce qu'on nous doit / ce qu'on doit ----------
  function ecranDettes(sens) {
    const creance = sens === 'creance';
    return async () => {
      const [liste, carnet] = await Promise.all([C.dettes(sens), tiers()]);
      const noms = {};
      carnet.forEach((x) => { noms[x.id] = x.nom; });
      const tout = !!P.etat['dettesTout' + sens];
      const visibles = liste.filter((d) => tout || (!d.annule && d.reste > 0));
      P.etat.comptaListe = liste;
      const proposes = carnet.filter((x) => x.type === (creance ? 'client' : 'fournisseur'));
      const statut = (d) => d.annule ? P.pastille('Annulée', 'erreur') : !d.reste ? P.pastille('Payé', 'ok') : d.retard ? P.pastille('En retard', 'erreur') :
        P.pastille(d.regle ? 'Payé en partie' : 'À payer', d.regle ? 'alerte' : 'info');
      const bouton = (action, d, libelle) => '<button class="btn petit" type="button" data-action="' + action + '" data-table="compta_dettes" data-id="' + d.id + '">' + libelle + '</button>';
      return P.entete(creance ? 'Ce qu’on nous doit' : 'Ce qu’on doit') +
        '<div class="grille chiffres">' + P.chiffre(creance ? 'Reste à encaisser' : 'Reste à payer', P.fcfa(liste.reduce((s, d) => s + d.reste, 0)), creance ? 'vert' : 'rouge') +
        P.chiffre('En retard', liste.filter((d) => d.retard).length, liste.some((d) => d.retard) ? 'rouge' : '') + '</div>' +
        '<div class="note info">' + (creance ? 'Une prestation faite mais pas encore payée par le client (casting, défilé…). Quand il paie, même en plusieurs fois, cliquez « Encaisser » : la recette s’enregistre toute seule.'
          : 'Une facture reçue d’un fournisseur mais pas encore payée. Quand vous la payez, même en plusieurs fois, cliquez « Payer » : la dépense s’enregistre toute seule.') + '</div>' +
        (proposes.length ? '<form class="carte f" data-form="compta-dette" data-sens="' + sens + '"><h2>' + (creance ? 'Nouvelle somme due par un client' : 'Nouvelle facture à payer') + '</h2>' +
          '<label class="fl" for="dt-tiers">' + (creance ? 'Client' : 'Fournisseur') + '<select id="dt-tiers" name="tiers_id" required>' + optionsTiers(proposes) + '</select></label>' +
          champMontant('dt-montant') +
          '<label class="fl" for="dt-cat">Catégorie<select id="dt-cat" name="categorie" required>' + C.optionsCategories(creance ? C.RECETTES : C.DEPENSES) + '</select></label>' +
          champDate('dt-date', 'date_op', 'Date', P.aujourdhui(), true) + champDate('dt-echeance', 'echeance', 'À payer avant le (facultatif)', '', false) +
          '<label class="fl large" for="dt-libelle">Libellé<input id="dt-libelle" name="libelle" required maxlength="200" placeholder="' + (creance ? 'Ex. : défilé du 12 octobre' : 'Ex. : impression des books') + '"></label>' +
          champJustif('dt-justif') + '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer</button></div></form>'
          : '<div class="note">Ajoutez d’abord un ' + (creance ? 'client' : 'fournisseur') + ' dans le <a href="#/compta/carnet">carnet</a>.</div>') +
        '<div class="segments"><button class="btn petit' + (tout ? '' : ' actif') + '" type="button" data-action="compta-dettes-tout" data-sens="' + sens + '" data-tout="">Restant à ' + (creance ? 'encaisser' : 'payer') + '</button>' +
        '<button class="btn petit' + (tout ? ' actif' : '') + '" type="button" data-action="compta-dettes-tout" data-sens="' + sens + '" data-tout="1">Tout l’historique</button></div>' +
        P.tableau([creance ? 'Client' : 'Fournisseur', 'Libellé', 'Échéance', '#Montant', '#Reste', 'État', ''], visibles.map((d) =>
          '<tr' + (d.annule ? ' class="annulee"' : d.retard ? ' class="en-retard"' : '') + '><td><b>' + P.esc(noms[d.tiers_id] || '—') + '</b></td>' +
          '<td>' + P.esc(d.libelle) + '<div class="petit-texte doux">' + P.date(d.date_op) + (d.avoirs ? ' · avoirs ' + P.fcfa(d.avoirs) : '') + (d.annule ? ' · ' + P.esc(d.motif_annulation) : '') + '</div></td>' +
          '<td>' + P.date(d.echeance) + '</td><td class="nombre">' + P.fcfa(d.montant) + '</td><td class="nombre">' + P.fcfa(d.reste) + '</td><td>' + statut(d) + '</td>' +
          '<td><div class="ligne">' + (d.reste > 0 ? '<button class="btn petit rouge" type="button" data-action="compta-regler" data-id="' + d.id + '">' + (creance ? 'Encaisser' : 'Payer') + '</button>' + bouton('compta-echeance', d, 'Échéance') : '') +
          (d.justificatif ? bouton('compta-justif-voir', d, 'Justificatif') : !d.annule ? bouton('compta-justif-joindre', d, 'Joindre') : '') +
          (!d.annule && !d.regle && !d.facture ? bouton('compta-annuler', d, 'Annuler') : '') + '</div></td></tr>'));
    };
  }
  P.actions['compta-dettes-tout'] = (el) => { P.etat['dettesTout' + el.getAttribute('data-sens')] = !!el.getAttribute('data-tout'); P.afficher(); };
  P.formulaires['compta-dette'] = async (f, form) => {
    const montant = montantDe(f);
    if (!(montant > 0)) return P.message('Indiquez un montant.');
    try {
      const justificatif = await C.deposerJustificatif(f.get('justificatif'));
      await P.bd(sb.from('compta_dettes').insert({ sens: form.getAttribute('data-sens'), tiers_id: t(f, 'tiers_id'), montant, categorie: t(f, 'categorie'),
        date_op: t(f, 'date_op'), echeance: t(f, 'echeance'), libelle: t(f, 'libelle'), justificatif }));
      await actualiser('Enregistré.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  const trouver = (id) => (P.etat.comptaListe || []).find((d) => d.id === id);
  // Règlement (en une ou plusieurs fois) : une recette ou une dépense liée, au compte choisi
  P.actions['compta-regler'] = async (el) => {
    const d = trouver(el.getAttribute('data-id'));
    if (!d) return;
    const cpts = await C.comptes(false);
    P.fenetre('<form data-form="compta-regler" data-id="' + d.id + '" class="grille" style="gap:12px"><h2>' + (d.sens === 'creance' ? 'Encaisser' : 'Payer') + '</h2>' +
      '<p class="doux">' + P.esc(d.libelle) + ' · reste ' + P.fcfa(d.reste) + '</p>' + champMontant('rg-montant', d.reste) +
      '<label class="fl" for="rg-compte">' + (d.sens === 'creance' ? 'Encaissé sur' : 'Payé depuis') + '<select id="rg-compte" name="compte_id" required>' + C.optionsComptes(cpts) + '</select></label>' +
      champDate('rg-date', 'date_op', 'Date', P.aujourdhui(), true) + champJustif('rg-justif') +
      '<div class="ligne"><button class="btn rouge" type="submit">Enregistrer</button><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div></form>');
  };
  P.formulaires['compta-regler'] = async (f, form) => {
    const d = trouver(form.getAttribute('data-id')), montant = montantDe(f);
    if (!d) return;
    if (!(montant > 0) || montant > d.reste) return P.message('Le montant doit être entre 1 et ' + P.fcfa(d.reste) + '.');
    try {
      const justificatif = await C.deposerJustificatif(f.get('justificatif'));
      await P.bd(sb.from('compta_ecritures').insert({ sens: d.sens === 'creance' ? 'recette' : 'depense', montant, date_op: t(f, 'date_op'), compte_id: t(f, 'compte_id'),
        categorie: d.categorie, libelle: 'Règlement : ' + d.libelle, dette_id: d.id, justificatif }));
      await actualiser(montant === d.reste ? 'Réglé en totalité.' : 'Règlement enregistré. Reste ' + P.fcfa(d.reste - montant) + '.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['compta-echeance'] = (el) => {
    const d = trouver(el.getAttribute('data-id'));
    if (!d) return;
    P.fenetre('<form data-form="compta-echeance" data-id="' + d.id + '" class="grille" style="gap:12px"><h2>Échéance</h2><p class="doux">' + P.esc(d.libelle) + '</p>' +
      champDate('ec-date', 'echeance', 'À payer avant le', d.echeance, false) +
      '<div class="ligne"><button class="btn rouge" type="submit">Enregistrer</button><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div></form>');
  };
  P.formulaires['compta-echeance'] = async (f, form) => {
    try {
      await P.bd(sb.from('compta_dettes').update({ echeance: t(f, 'echeance') }).eq('id', form.getAttribute('data-id')));
      await actualiser('Échéance enregistrée.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  // ---------- Personnel et prestataires (paiements et justificatifs, sans calcul de la paie) ----------
  async function personnel() {
    const m = C.moisChoisi();
    const [gens, depenses, cpts] = await Promise.all([tiers(['personnel', 'prestataire']), C.ecritures(m, 'depense'), C.comptes(true)]);
    const payes = depenses.filter((e) => e.categorie === 'personnel');
    const noms = {};
    cpts.forEach((c) => { noms[c.id] = c.nom; });
    P.etat.comptaListe = payes;
    const total = (id) => payes.filter((e) => e.tiers_id === id && !e.annule).reduce((s, e) => s + e.montant, 0);
    return P.entete('Personnel et prestataires · ' + P.mois(m), C.choixMois()) +
      '<div class="grille chiffres">' + P.chiffre('Payé ce mois', P.fcfa(C.totaux(payes, 'depense')), 'rouge') + P.chiffre('Personnes', gens.filter((x) => x.actif).length) + '</div>' +
      (gens.length ? '<form class="carte f" data-form="compta-payer-personne"><h2>Nouveau paiement</h2>' +
        '<label class="fl" for="pe-qui">Personne<select id="pe-qui" name="tiers_id" required>' + optionsTiers(gens) + '</select></label>' + champMontant('pe-montant') +
        '<label class="fl" for="pe-compte">Payé depuis<select id="pe-compte" name="compte_id" required>' + C.optionsComptes(cpts.filter((c) => c.actif)) + '</select></label>' +
        champDate('pe-date', 'date_op', 'Date', P.aujourdhui(), true) +
        '<label class="fl large" for="pe-libelle">Libellé<input id="pe-libelle" name="libelle" required maxlength="200" placeholder="Ex. : salaire d’octobre, prestation photo du 12/10"></label>' +
        champJustif('pe-justif') + '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer le paiement</button></div></form>'
        : '<div class="note">Ajoutez d’abord les personnes (personnel ou prestataire) dans le <a href="#/compta/carnet">carnet</a>.</div>') +
      '<div class="carte"><h2>Par personne</h2>' + P.tableau(['Personne', 'Type', '#Payé ce mois'], gens.map((x) =>
        '<tr><td>' + P.esc(x.nom) + (x.actif ? '' : ' ' + P.pastille('Ne travaille plus avec l’agence', 'neutre')) + '</td><td>' + TYPES[x.type] + '</td><td class="nombre">' + P.fcfa(total(x.id)) + '</td></tr>')) + '</div>' +
      P.tableau(['Date', 'Libellé', 'Catégorie', 'Compte', '#Montant', ''], C.lignes(payes, noms));
  }
  P.formulaires['compta-payer-personne'] = async (f) => {
    const montant = montantDe(f);
    if (!(montant > 0)) return P.message('Indiquez un montant.');
    try {
      const justificatif = await C.deposerJustificatif(f.get('justificatif'));
      await P.bd(sb.from('compta_ecritures').insert({ sens: 'depense', montant, date_op: t(f, 'date_op'), compte_id: t(f, 'compte_id'), categorie: 'personnel',
        libelle: t(f, 'libelle'), tiers_id: t(f, 'tiers_id'), justificatif }));
      await actualiser('Paiement enregistré.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  // ---------- Matériel durable ----------
  async function materiel() {
    const [liste, cpts] = await Promise.all([P.bd(sb.from('compta_materiel').select('*').order('date_achat', { ascending: false })), C.comptes(false)]);
    P.etat.comptaMateriel = liste;
    const enService = liste.filter((x) => x.etat !== 'sorti');
    return P.entete('Matériel durable') +
      '<div class="grille chiffres">' + P.chiffre('Matériel à l’inventaire', enService.length) + P.chiffre('Valeur d’achat', P.fcfa(enService.reduce((s, x) => s + x.montant, 0))) + '</div>' +
      '<div class="note info">Ordinateur, appareil photo, projecteurs, portants… L’achat est enregistré en même temps comme dépense « Matériel ».</div>' +
      '<form class="carte f" data-form="compta-materiel"><h2>Matériel acheté</h2>' +
      '<label class="fl" for="ma-nom">Désignation<input id="ma-nom" name="designation" required maxlength="120" placeholder="Ex. : appareil photo Canon"></label>' + champMontant('ma-montant') +
      champDate('ma-date', 'date_op', 'Date d’achat', P.aujourdhui(), true) +
      '<label class="fl" for="ma-compte">Payé depuis<select id="ma-compte" name="compte_id" required>' + C.optionsComptes(cpts) + '</select></label>' +
      '<label class="fl" for="ma-fournisseur">Fournisseur (facultatif)<input id="ma-fournisseur" name="fournisseur" maxlength="120"></label>' +
      '<label class="fl" for="ma-serie">Numéro de série (facultatif)<input id="ma-serie" name="numero_serie" maxlength="80"></label>' +
      '<label class="fl" for="ma-lieu">Où il se trouve (facultatif)<input id="ma-lieu" name="emplacement" maxlength="120" placeholder="Ex. : studio"></label>' +
      champJustif('ma-justif') + '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer l’achat</button></div></form>' +
      P.tableau(['Matériel', 'Achat', '#Prix', 'État', ''], liste.map((x) =>
        '<tr' + (x.etat === 'sorti' ? ' class="annulee"' : '') + '><td><b>' + P.esc(x.designation) + '</b><div class="petit-texte doux">' + P.esc([x.numero_serie, x.emplacement].filter(Boolean).join(' · ')) + '</div></td>' +
        '<td>' + P.date(x.date_achat) + '</td><td class="nombre">' + P.fcfa(x.montant) + '</td><td>' + P.pastille(ETATS[x.etat][0], ETATS[x.etat][1]) +
        (x.etat === 'sorti' ? '<div class="petit-texte doux">' + P.date(x.date_sortie) + ' · ' + P.esc(x.motif_sortie) + '</div>' : '') + '</td>' +
        '<td>' + (x.etat === 'sorti' ? '' : '<button class="btn petit" type="button" data-action="compta-materiel-modifier" data-id="' + x.id + '">Modifier</button>') + '</td></tr>'));
  }
  P.formulaires['compta-materiel'] = async (f) => {
    const montant = montantDe(f);
    if (!(montant > 0)) return P.message('Indiquez un montant.');
    try {
      const justificatif = await C.deposerJustificatif(f.get('justificatif'));
      await P.rpc('compta_materiel_acheter', { p_designation: t(f, 'designation'), p_date: t(f, 'date_op'), p_montant: montant, p_compte: t(f, 'compte_id'),
        p_fournisseur: t(f, 'fournisseur'), p_numero_serie: t(f, 'numero_serie'), p_emplacement: t(f, 'emplacement'), p_justificatif: justificatif });
      await actualiser('Matériel ajouté à l’inventaire, et la dépense est enregistrée.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['compta-materiel-modifier'] = (el) => {
    const x = (P.etat.comptaMateriel || []).find((m) => m.id === el.getAttribute('data-id'));
    if (!x) return;
    P.fenetre('<form data-form="compta-materiel-modifier" data-id="' + x.id + '" class="grille" style="gap:12px"><h2>' + P.esc(x.designation) + '</h2>' +
      '<label class="fl" for="mm-etat">État<select id="mm-etat" name="etat">' + Object.keys(ETATS).map((k) => '<option value="' + k + '"' + (x.etat === k ? ' selected' : '') + '>' + ETATS[k][0] + '</option>').join('') + '</select></label>' +
      '<label class="fl" for="mm-lieu">Où il se trouve<input id="mm-lieu" name="emplacement" maxlength="120" value="' + P.esc(x.emplacement || '') + '"></label>' +
      '<label class="fl" for="mm-motif">Si sorti : motif (vendu, volé, hors d’usage…)<input id="mm-motif" name="motif_sortie" maxlength="200"></label>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Enregistrer</button><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div></form>');
  };
  P.formulaires['compta-materiel-modifier'] = async (f, form) => {
    const etat = t(f, 'etat'), maj = { etat, emplacement: t(f, 'emplacement') };
    if (etat === 'sorti') {
      if (!t(f, 'motif_sortie')) return P.message('Indiquez le motif de la sortie.');
      if (!confirm('Sortir ce matériel de l’inventaire ? Ce sera définitif (il reste dans l’historique).')) return;
      Object.assign(maj, { motif_sortie: t(f, 'motif_sortie'), date_sortie: P.aujourdhui() });
    }
    try {
      const r = await P.bd(sb.from('compta_materiel').update(maj).eq('id', form.getAttribute('data-id')).select('id'));
      if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
      await actualiser('Matériel enregistré.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  // ---------- Carnet : clients, fournisseurs, personnel, prestataires ----------
  function champsTiers(x) {
    const v = (k) => P.esc((x && x[k]) || '');
    return '<label class="fl" for="ti-nom">Nom<input id="ti-nom" name="nom" required maxlength="120" value="' + v('nom') + '"></label>' +
      (x ? '' : '<label class="fl" for="ti-type">Type<select id="ti-type" name="type">' + Object.keys(TYPES).map((k) => '<option value="' + k + '">' + TYPES[k] + '</option>').join('') + '</select></label>') +
      '<label class="fl" for="ti-tel">Téléphone<input id="ti-tel" name="telephone" type="tel" maxlength="40" value="' + v('telephone') + '"></label>' +
      '<label class="fl" for="ti-mail">E-mail<input id="ti-mail" name="email" type="email" maxlength="120" value="' + v('email') + '"></label>' +
      '<label class="fl large" for="ti-notes">Notes<textarea id="ti-notes" name="notes" maxlength="1000">' + v('notes') + '</textarea></label>';
  }
  async function carnet() {
    const liste = await tiers();
    P.etat.comptaTiers = liste;
    return P.entete('Carnet') +
      '<div class="note info">Les clients, fournisseurs, membres du personnel et prestataires de l’agence. Les mannequins n’y figurent pas : ils sont dans le registre du Suivi des paiements.</div>' +
      '<form class="carte f" data-form="compta-tiers"><h2>Ajouter au carnet</h2>' + champsTiers(null) + '<div class="large ligne"><button class="btn rouge" type="submit">Ajouter</button></div></form>' +
      P.tableau(['Nom', 'Type', 'Téléphone', 'E-mail', ''], liste.map((x) => '<tr><td><b>' + P.esc(x.nom) + '</b>' + (x.actif ? '' : ' ' + P.pastille('Plus actif', 'neutre')) + '</td>' +
        '<td>' + TYPES[x.type] + '</td><td>' + P.esc(x.telephone || '—') + '</td><td>' + P.esc(x.email || '—') + '</td>' +
        '<td><button class="btn petit" type="button" data-action="compta-tiers-modifier" data-id="' + x.id + '">Modifier</button></td></tr>'));
  }
  const lireTiers = (f) => ({ nom: t(f, 'nom'), telephone: t(f, 'telephone'), email: t(f, 'email'), notes: t(f, 'notes') });
  P.formulaires['compta-tiers'] = async (f) => {
    try {
      await P.bd(sb.from('compta_tiers').insert(Object.assign(lireTiers(f), { type: t(f, 'type') })));
      await actualiser('Ajouté au carnet.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['compta-tiers-modifier'] = (el) => {
    const x = (P.etat.comptaTiers || []).find((y) => y.id === el.getAttribute('data-id'));
    if (!x) return;
    P.fenetre('<form data-form="compta-tiers-modifier" data-id="' + x.id + '" class="grille" style="gap:12px"><h2>' + P.esc(TYPES[x.type]) + '</h2>' + champsTiers(x) +
      '<label class="ligne" for="ti-actif"><input id="ti-actif" name="actif" type="checkbox"' + (x.actif ? ' checked' : '') + '> Toujours en relation avec l’agence</label>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Enregistrer</button><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div></form>');
  };
  P.formulaires['compta-tiers-modifier'] = async (f, form) => {
    try {
      const r = await P.bd(sb.from('compta_tiers').update(Object.assign(lireTiers(f), { actif: f.get('actif') === 'on' })).eq('id', form.getAttribute('data-id')).select('id'));
      if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
      await actualiser('Carnet mis à jour.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  const esp = P.espaces.compta;
  esp.nav.push([null, 'Suivi'], ['a-recevoir', 'Ce qu’on nous doit'], ['a-payer', 'Ce qu’on doit'], ['personnel', 'Personnel et prestataires'],
    ['materiel', 'Matériel durable'], ['carnet', 'Carnet']);
  Object.assign(esp.pages, { 'a-recevoir': ecranDettes('creance'), 'a-payer': ecranDettes('dette'), personnel, materiel, carnet });
})();
