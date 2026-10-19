// Espace 3 — Comptabilité (cahier v2.4, section 6), construit morceau par morceau après
// validation du maître d'ouvrage. Morceau A : recettes, dépenses (avec justificatif) et
// trésorerie (caisse, Wave, banque… et le solde de chacun). Les paiements validés dans
// l'espace 2 deviennent tout seuls des recettes, sans nom de mannequin. Morceau B (ce qu'on
// nous doit, ce qu'on doit, personnel, matériel, carnet) : js/portail/espace-compta-suivi.js,
// qui se sert des outils communs P.compta.
// Rien ne s'efface : une écriture erronée est annulée avec un motif (journal d'audit).
// Base : compta_comptes, compta_ecritures, compta_soldes() (supabase-administration.sql, section 10).
(function () {
  'use strict';
  const P = window.Portail;
  const RECETTES = { inscription: 'Inscriptions', formation: 'Mensualités de formation', casting: 'Castings', prestation: 'Prestations',
    masterclass: 'Masterclass', autre_recette: 'Autre recette' };
  const DEPENSES = { loyer: 'Loyer', materiel: 'Matériel', transport: 'Transport', communication: 'Communication', frais_wave: 'Frais Wave',
    honoraires: 'Honoraires', personnel: 'Personnel et prestataires', cachets: 'Cachets reversés aux mannequins', autre_depense: 'Autre dépense' };
  const TYPES_COMPTE = { caisse: 'Caisse', wave: 'Wave', banque: 'Banque', mobile_money: 'Autre mobile money', autre: 'Autre' };
  const JUSTIF_MAX = 10 * 1024 * 1024;
  const JUSTIF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
  const categorie = (e) => RECETTES[e.categorie] || DEPENSES[e.categorie] || (e.sens === 'virement' ? 'Virement' : e.categorie);

  // Mois affiché (AAAA-MM-01), gardé d'une page à l'autre
  const moisChoisi = () => P.etat.moisCompta || P.moisCourant();
  function bornes(mois) {
    const [a, m] = mois.split('-').map(Number);
    return [mois, new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10)];
  }
  const choixMois = () => '<form class="ligne" data-form="compta-mois"><label class="fl" for="cp-mois">Mois<input id="cp-mois" name="mois" type="month" value="' +
    moisChoisi().slice(0, 7) + '" max="' + P.aujourdhui().slice(0, 7) + '"></label><button class="btn" type="submit">Afficher</button></form>';
  P.formulaires['compta-mois'] = (f) => {
    const m = String(f.get('mois') || '');
    if (/^\d{4}-\d{2}$/.test(m)) P.etat.moisCompta = m + '-01';
    P.afficher();
  };

  async function comptes(tous) {
    const r = sb.from('compta_comptes').select('*').order('cree_le');
    return P.bd(tous ? r : r.eq('actif', true));
  }
  async function ecritures(mois, sens) {
    const [debut, fin] = bornes(mois);
    let r = sb.from('compta_ecritures').select('*').gte('date_op', debut).lt('date_op', fin);
    if (sens) r = r.eq('sens', sens);
    return P.bd(r.order('date_op', { ascending: false }).order('cree_le', { ascending: false }));
  }
  // Créances (ce qu'on nous doit) ou dettes (ce qu'on doit), avec ce qui est déjà réglé et le reste
  async function dettes(sens) {
    const [liste, reglements] = await Promise.all([
      P.bd(sb.from('compta_dettes').select('*').eq('sens', sens).order('date_op', { ascending: false })),
      P.bd(sb.from('compta_ecritures').select('id, dette_id, montant, annule, date_op').not('dette_id', 'is', null))
    ]);
    return liste.map((d) => {
      const regle = reglements.filter((r) => r.dette_id === d.id && !r.annule).reduce((t, r) => t + r.montant, 0);
      return Object.assign({}, d, { regle, reste: d.annule ? 0 : d.montant - regle, retard: !d.annule && d.montant > regle && !!d.echeance && d.echeance < P.aujourdhui() });
    });
  }
  const totaux = (liste, sens) => liste.filter((e) => e.sens === sens && !e.annule).reduce((s, e) => s + e.montant, 0);

  // ---------- Tableau du mois ----------
  async function mois() {
    const m = moisChoisi();
    const [liste, soldes, creances, dues] = await Promise.all([ecritures(m), P.rpc('compta_soldes'), dettes('creance'), dettes('dette')]);
    const reste = (l) => l.reduce((t, d) => t + d.reste, 0);
    const rec = totaux(liste, 'recette'), dep = totaux(liste, 'depense');
    const parCategorie = (sens) => {
      const t = {};
      liste.filter((e) => e.sens === sens && !e.annule).forEach((e) => { t[e.categorie] = (t[e.categorie] || 0) + e.montant; });
      return Object.keys(t).sort((a, b) => t[b] - t[a]).map((k) => [k, t[k]]);
    };
    const barres = (sens, total, rouge) => {
      const l = parCategorie(sens);
      return l.length ? l.map((c) => P.barre(RECETTES[c[0]] || DEPENSES[c[0]] || c[0], c[1], total, rouge)).join('') : '<p class="doux">Rien pour le moment.</p>';
    };
    const sansJustif = liste.filter((e) => e.sens === 'depense' && !e.annule && !e.justificatif).length;
    return P.entete('Comptabilité · ' + P.mois(m), choixMois()) +
      '<div class="grille chiffres">' + P.chiffre('Recettes du mois', P.fcfa(rec), 'vert') + P.chiffre('Dépenses du mois', P.fcfa(dep), 'rouge') +
      P.chiffre('Résultat du mois', P.fcfa(rec - dep), rec - dep < 0 ? 'rouge' : '') + P.chiffre('Dépenses sans justificatif', sansJustif, sansJustif ? 'orange' : '') +
      P.chiffre('On nous doit', P.fcfa(reste(creances)), creances.some((d) => d.retard) ? 'orange' : '') + P.chiffre('Nous devons', P.fcfa(reste(dues)), dues.some((d) => d.retard) ? 'rouge' : '') + '</div>' +
      '<div class="grille deux"><div class="carte"><h2>Recettes par catégorie</h2>' + barres('recette', rec, false) + '</div>' +
      '<div class="carte"><h2>Dépenses par catégorie</h2>' + barres('depense', dep, true) + '</div></div>' +
      '<div class="carte"><h2>Trésorerie aujourd’hui</h2>' + P.tableau(['Compte', '#Solde'], soldes.map((s) =>
        '<tr><td>' + P.esc(s.nom) + '</td><td class="nombre' + (s.solde < 0 ? ' rouge' : '') + '">' + P.fcfa(s.solde) + '</td></tr>')) + '</div>';
  }

  // ---------- Liste d'écritures (recettes, dépenses, virements) ----------
  function lignes(liste, nomsComptes) {
    return liste.map((e) => '<tr' + (e.annule ? ' class="annulee"' : '') + '><td>' + P.date(e.date_op) + '</td>' +
      '<td><b>' + P.esc(e.libelle) + '</b>' + (e.tiers ? '<div class="petit-texte doux">' + P.esc(e.tiers) + '</div>' : '') +
      (e.annule ? '<div class="petit-texte">' + P.pastille('Annulée', 'erreur') + ' ' + P.esc(e.motif_annulation) + '</div>' : '') + '</td>' +
      '<td>' + P.esc(categorie(e)) + (e.source === 'espace2' ? ' ' + P.pastille('Espace 2 · automatique', 'info') : '') + '</td>' +
      '<td>' + P.esc(nomsComptes[e.compte_id] || '—') + (e.compte_dest_id ? ' → ' + P.esc(nomsComptes[e.compte_dest_id] || '—') : '') + '</td>' +
      '<td class="nombre">' + P.fcfa(e.montant) + '</td>' +
      '<td><div class="ligne">' + (e.justificatif ? '<button class="btn petit" type="button" data-action="compta-justif-voir" data-id="' + e.id + '">Justificatif</button>' :
        (!e.annule && e.source === 'manuel' ? '<button class="btn petit" type="button" data-action="compta-justif-joindre" data-id="' + e.id + '">Joindre</button>' : '')) +
      (!e.annule && e.source === 'manuel' ? '<button class="btn petit" type="button" data-action="compta-annuler" data-id="' + e.id + '">Annuler</button>' : '') + '</div></td></tr>');
  }
  const optionsComptes = (liste) => liste.map((c) => '<option value="' + c.id + '">' + P.esc(c.nom) + '</option>').join('');
  const optionsCategories = (cats) => Object.keys(cats).map((k) => '<option value="' + k + '">' + P.esc(cats[k]) + '</option>').join('');

  // Recettes et dépenses : même écran, catégories différentes
  function ecranSens(sens) {
    const recette = sens === 'recette';
    return async () => {
      const m = moisChoisi();
      const [liste, cpts] = await Promise.all([ecritures(m, sens), comptes(true)]);
      const noms = {};
      cpts.forEach((c) => { noms[c.id] = c.nom; });
      P.etat.comptaListe = liste;
      const actifs = cpts.filter((c) => c.actif);
      return P.entete((recette ? 'Recettes · ' : 'Dépenses · ') + P.mois(m), choixMois()) +
        '<div class="grille chiffres">' + P.chiffre(recette ? 'Total des recettes' : 'Total des dépenses', P.fcfa(totaux(liste, sens)), recette ? 'vert' : 'rouge') + '</div>' +
        (recette ? '<div class="note info">Les inscriptions et mensualités validées dans l’espace 2 arrivent ici toutes seules. Saisissez ici les autres recettes : castings, prestations, masterclass…</div>' : '') +
        '<form class="carte f" data-form="compta-ecrire" data-sens="' + sens + '"><h2>' + (recette ? 'Nouvelle recette' : 'Nouvelle dépense') + '</h2>' +
        '<label class="fl" for="cp-date">Date<input id="cp-date" name="date_op" type="date" required max="' + P.aujourdhui() + '" value="' + P.aujourdhui() + '"></label>' +
        '<label class="fl" for="cp-montant">Montant (FCFA)<input id="cp-montant" name="montant" type="number" inputmode="numeric" min="1" step="1" required></label>' +
        '<label class="fl" for="cp-cat">Catégorie<select id="cp-cat" name="categorie" required>' + optionsCategories(recette ? RECETTES : DEPENSES) + '</select></label>' +
        '<label class="fl" for="cp-compte">' + (recette ? 'Encaissé sur' : 'Payé depuis') + '<select id="cp-compte" name="compte_id" required>' + optionsComptes(actifs) + '</select></label>' +
        '<label class="fl large" for="cp-libelle">Libellé<input id="cp-libelle" name="libelle" required maxlength="200" placeholder="' + (recette ? 'Ex. : casting défilé Sococé' : 'Ex. : loyer du bureau d’octobre') + '"></label>' +
        '<label class="fl" for="cp-tiers">' + (recette ? 'Client' : 'Fournisseur ou bénéficiaire') + ' (facultatif)<input id="cp-tiers" name="tiers" maxlength="120"></label>' +
        '<label class="fl" for="cp-justif">Justificatif (photo ou PDF, 10 Mo au plus)' + (recette ? '' : ' — recommandé') + '<input id="cp-justif" name="justificatif" type="file" accept="image/*,application/pdf"></label>' +
        '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer</button></div></form>' +
        P.tableau(['Date', 'Libellé', 'Catégorie', 'Compte', '#Montant', ''], lignes(liste, noms));
    };
  }

  // Dépose le justificatif dans le stockage privé et renvoie son chemin
  async function deposerJustificatif(fichier) {
    if (!fichier || !fichier.size) return null;
    if (fichier.size > JUSTIF_MAX) throw new Error('Justificatif trop lourd : 10 Mo au plus.');
    // (certains navigateurs ne donnent pas le type d'une photo HEIC d'iPhone)
    const type = fichier.type || (/\.hei[cf]$/i.test(fichier.name) ? 'image/heic' : '');
    if (JUSTIF_TYPES.indexOf(type) === -1) throw new Error('Justificatif : une photo (JPEG, PNG, HEIC) ou un PDF.');
    const ext = type === 'application/pdf' ? 'pdf' : type.split('/')[1].replace('jpeg', 'jpg');
    const chemin = P.aujourdhui().slice(0, 7) + '/' + crypto.getRandomValues(new Uint32Array(4)).join('-') + '.' + ext;
    await P.bd(sb.storage.from('compta-justificatifs').upload(chemin, fichier, { contentType: type, upsert: false }));
    return chemin;
  }
  P.formulaires['compta-ecrire'] = async (f, form) => {
    const sens = form.getAttribute('data-sens');
    const montant = Math.round(Number(f.get('montant')));
    if (!(montant > 0)) return P.message('Indiquez un montant.');
    try {
      const justificatif = await deposerJustificatif(f.get('justificatif'));
      const t = (k) => String(f.get(k) || '').trim() || null;
      await P.bd(sb.from('compta_ecritures').insert({ sens, montant, date_op: t('date_op'), categorie: t('categorie'), compte_id: t('compte_id'),
        libelle: t('libelle'), tiers: t('tiers'), justificatif }));
      const d = t('date_op');
      if (d && d.slice(0, 7) !== moisChoisi().slice(0, 7)) P.etat.moisCompta = d.slice(0, 7) + '-01';
      await P.afficher();
      P.message(sens === 'recette' ? 'Recette enregistrée.' : 'Dépense enregistrée.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  // Les boutons Justificatif / Joindre / Annuler servent aux écritures et, avec
  // data-table="compta_dettes", aux créances et dettes (même colonnes)
  const trouver = (id) => (P.etat.comptaListe || []).find((e) => e.id === id);
  const tableDe = (el) => (el.getAttribute('data-table') === 'compta_dettes' ? 'compta_dettes' : 'compta_ecritures');
  P.actions['compta-annuler'] = async (el) => {
    const e = trouver(el.getAttribute('data-id'));
    if (!e) return;
    const motif = (prompt('Annuler « ' + e.libelle + ' » (' + P.fcfa(e.montant) + ') ?\nLa ligne reste visible, barrée. Motif de l’annulation :') || '').trim();
    if (!motif) return;
    const r = await P.bd(sb.from(tableDe(el)).update({ annule: true, motif_annulation: motif }).eq('id', e.id).select('id'));
    if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
    await P.afficher();
    P.message('Ligne annulée.');
  };
  P.actions['compta-justif-voir'] = async (el) => {
    const e = trouver(el.getAttribute('data-id'));
    if (!e || !e.justificatif) return;
    const r = await P.bd(sb.storage.from('compta-justificatifs').createSignedUrl(e.justificatif, 300));
    P.fenetre('<h2>Justificatif</h2><p class="doux">' + P.esc(e.libelle) + ' · ' + P.fcfa(e.montant) + '</p>' +
      '<div class="ligne" style="margin-top:12px"><a class="btn rouge" target="_blank" rel="noopener" href="' + P.esc(r.signedUrl) + '">Ouvrir le justificatif</a>' +
      '<button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div>');
  };
  P.actions['compta-justif-joindre'] = (el) => {
    const e = trouver(el.getAttribute('data-id'));
    if (!e) return;
    P.fenetre('<form data-form="compta-justif" data-id="' + e.id + '" data-table="' + tableDe(el) + '" class="grille" style="gap:12px"><h2>Joindre un justificatif</h2><p class="doux">' + P.esc(e.libelle) + ' · ' + P.fcfa(e.montant) + '</p>' +
      '<label class="fl" for="cp-justif2">Photo ou PDF (10 Mo au plus)<input id="cp-justif2" name="justificatif" type="file" accept="image/*,application/pdf" required></label>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Joindre</button><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div></form>');
  };
  P.formulaires['compta-justif'] = async (f, form) => {
    try {
      const chemin = await deposerJustificatif(f.get('justificatif'));
      if (!chemin) return P.message('Choisissez un fichier.');
      await P.bd(sb.from(tableDe(form)).update({ justificatif: chemin }).eq('id', form.getAttribute('data-id')));
      P.fenetre('');
      await P.afficher();
      P.message('Justificatif joint.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  // ---------- Trésorerie ----------
  async function tresorerie() {
    const m = moisChoisi();
    const [soldes, cpts, virements] = await Promise.all([P.rpc('compta_soldes'), comptes(true), ecritures(m, 'virement')]);
    const noms = {};
    cpts.forEach((c) => { noms[c.id] = c.nom; });
    P.etat.comptaListe = virements;
    const actifs = cpts.filter((c) => c.actif);
    const total = soldes.filter((s) => (cpts.find((c) => c.id === s.compte_id) || {}).actif).reduce((s, x) => s + Number(x.solde), 0);
    return P.entete('Trésorerie') +
      '<div class="grille chiffres">' + P.chiffre('Total disponible', P.fcfa(total), total < 0 ? 'rouge' : 'vert') +
      soldes.map((s) => P.chiffre(s.nom, P.fcfa(s.solde), s.solde < 0 ? 'rouge' : '')).join('') + '</div>' +
      '<form class="carte f" data-form="compta-virement"><h2>Virement entre deux comptes</h2>' +
      '<div class="note info">Ex. : retrait Wave vers la caisse, dépôt de la caisse à la banque. Ce n’est ni une recette ni une dépense.</div>' +
      '<label class="fl" for="vi-date">Date<input id="vi-date" name="date_op" type="date" required max="' + P.aujourdhui() + '" value="' + P.aujourdhui() + '"></label>' +
      '<label class="fl" for="vi-montant">Montant (FCFA)<input id="vi-montant" name="montant" type="number" inputmode="numeric" min="1" step="1" required></label>' +
      '<label class="fl" for="vi-de">Depuis<select id="vi-de" name="compte_id" required>' + optionsComptes(actifs) + '</select></label>' +
      '<label class="fl" for="vi-vers">Vers<select id="vi-vers" name="compte_dest_id" required>' + optionsComptes(actifs.slice(1).concat(actifs.slice(0, 1))) + '</select></label>' +
      '<label class="fl large" for="vi-libelle">Libellé<input id="vi-libelle" name="libelle" required maxlength="200" placeholder="Ex. : retrait Wave pour la caisse"></label>' +
      '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer le virement</button></div></form>' +
      '<div class="carte"><h2>Virements · ' + P.esc(P.mois(m)) + '</h2>' + choixMois() + P.tableau(['Date', 'Libellé', 'Catégorie', 'Comptes', '#Montant', ''], lignes(virements, noms)) + '</div>' +
      '<form class="carte f" data-form="compta-compte"><h2>Ajouter un compte</h2>' +
      '<label class="fl" for="co-nom">Nom<input id="co-nom" name="nom" required maxlength="80" placeholder="Ex. : Banque SGCI, Orange Money"></label>' +
      '<label class="fl" for="co-type">Type<select id="co-type" name="type">' + Object.keys(TYPES_COMPTE).filter((k) => k !== 'caisse').map((k) => '<option value="' + k + '">' + TYPES_COMPTE[k] + '</option>').join('') + '</select></label>' +
      '<label class="fl" for="co-solde">Solde de départ (FCFA)<input id="co-solde" name="solde_initial" type="number" inputmode="numeric" step="1" value="0"></label>' +
      '<label class="fl" for="co-date">À la date du<input id="co-date" name="date_initiale" type="date" value="' + P.aujourdhui() + '"></label>' +
      '<div class="large ligne"><button class="btn" type="submit">Ajouter le compte</button></div></form>' +
      '<div class="carte"><h2>Soldes de départ</h2><p class="doux petit-texte">Le solde de chaque compte = solde de départ + recettes − dépenses ± virements depuis cette date.</p>' +
      P.tableau(['Compte', 'Type', '#Solde de départ', 'Date', ''], cpts.map((c) => '<tr><td>' + P.esc(c.nom) + (c.actif ? '' : ' ' + P.pastille('Fermé', 'neutre')) + '</td><td>' + P.esc(TYPES_COMPTE[c.type] || c.type) +
        '</td><td class="nombre">' + P.fcfa(c.solde_initial) + '</td><td>' + P.date(c.date_initiale) + '</td>' +
        '<td><button class="btn petit" type="button" data-action="compta-compte-modifier" data-id="' + c.id + '">Modifier</button></td></tr>')) + '</div>';
  }
  // Solde de départ (au premier jour d'utilisation : ce qu'il y a vraiment en caisse, sur Wave…)
  // et fermeture d'un compte qui ne sert plus (il reste dans l'historique)
  P.actions['compta-compte-modifier'] = async (el) => {
    const c = (await comptes(true)).find((x) => x.id === el.getAttribute('data-id'));
    if (!c) return;
    P.fenetre('<form data-form="compta-compte-modifier" data-id="' + c.id + '" class="grille" style="gap:12px"><h2>' + P.esc(c.nom) + '</h2>' +
      '<label class="fl" for="cm-solde">Solde de départ (FCFA)<input id="cm-solde" name="solde_initial" type="number" inputmode="numeric" step="1" required value="' + c.solde_initial + '"></label>' +
      '<label class="fl" for="cm-date">À la date du<input id="cm-date" name="date_initiale" type="date" required value="' + P.esc(c.date_initiale) + '"></label>' +
      '<label class="ligne" for="cm-actif"><input id="cm-actif" name="actif" type="checkbox"' + (c.actif ? ' checked' : '') + '> Compte utilisé (décocher pour le fermer)</label>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Enregistrer</button><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div></form>');
  };
  P.formulaires['compta-compte-modifier'] = async (f, form) => {
    try {
      const r = await P.bd(sb.from('compta_comptes').update({ solde_initial: Math.round(Number(f.get('solde_initial')) || 0),
        date_initiale: String(f.get('date_initiale') || '') || P.aujourdhui(), actif: f.get('actif') === 'on' }).eq('id', form.getAttribute('data-id')).select('id'));
      if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
      P.fenetre('');
      await P.afficher();
      P.message('Compte enregistré.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.formulaires['compta-virement'] = async (f) => {
    const t = (k) => String(f.get(k) || '').trim() || null;
    const montant = Math.round(Number(f.get('montant')));
    if (!(montant > 0)) return P.message('Indiquez un montant.');
    if (t('compte_id') === t('compte_dest_id')) return P.message('Choisissez deux comptes différents.');
    try {
      await P.bd(sb.from('compta_ecritures').insert({ sens: 'virement', montant, date_op: t('date_op'), compte_id: t('compte_id'), compte_dest_id: t('compte_dest_id'),
        categorie: 'virement', libelle: t('libelle') }));
      await P.afficher();
      P.message('Virement enregistré.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.formulaires['compta-compte'] = async (f) => {
    const nom = String(f.get('nom') || '').trim();
    if (!nom) return P.message('Indiquez le nom du compte.');
    try {
      await P.bd(sb.from('compta_comptes').insert({ nom, type: f.get('type'), solde_initial: Math.round(Number(f.get('solde_initial')) || 0),
        date_initiale: String(f.get('date_initiale') || '') || P.aujourdhui() }));
      await P.afficher();
      P.message('Compte ajouté.');
    } catch (e) { P.message(/duplicate|unique/i.test(String(e && e.message)) ? 'Un compte porte déjà ce nom.' : P.erreurTexte(e)); }
  };

  P.compta = { RECETTES, DEPENSES, comptes, ecritures, dettes, moisChoisi, choixMois, lignes, optionsComptes, optionsCategories, deposerJustificatif, totaux };
  // (les pages du morceau B sont ajoutées par js/portail/espace-compta-suivi.js)
  P.espaces.compta = {
    nav: [[null, 'Au quotidien'], ['mois', 'Tableau du mois'], ['recettes', 'Recettes'], ['depenses', 'Dépenses'], ['tresorerie', 'Trésorerie']],
    pages: { mois, recettes: ecranSens('recette'), depenses: ecranSens('depense'), tresorerie }
  };
})();
