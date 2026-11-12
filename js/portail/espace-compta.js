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
    masterclass: 'Masterclass', cours_talons: 'Cours de talons', autre_recette: 'Autre recette' };
  const DEPENSES = { loyer: 'Loyer', materiel: 'Matériel', transport: 'Transport', communication: 'Communication', frais_wave: 'Frais Wave',
    honoraires: 'Honoraires', personnel: 'Personnel et prestataires', cachets: 'Cachets reversés aux mannequins', impots: 'Impôts et taxes',
    autre_depense: 'Autre dépense' };
  const TYPES_COMPTE = { caisse: 'Caisse', wave: 'Wave', banque: 'Banque', mobile_money: 'Autre mobile money', autre: 'Autre' };
  const JUSTIF_MAX = 10 * 1024 * 1024;
  const JUSTIF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
  // (catégories posées seulement par le site, jamais proposées à la saisie : écart de comptage, supabase-reprise-mars.sql)
  const AUTRES = { regularisation: 'Régularisation (écart de comptage)' };
  const categorie = (e) => RECETTES[e.categorie] || DEPENSES[e.categorie] || AUTRES[e.categorie] || (e.sens === 'virement' ? 'Virement' : e.categorie);

  // Mois affiché (AAAA-MM-01), gardé d'une page à l'autre
  const moisChoisi = () => P.etat.moisCompta || P.moisCourant();
  function bornes(mois) {
    const [a, m] = mois.split('-').map(Number);
    return [mois, new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10)];
  }
  // (12/11/2026, nouvelle présentation demandée par la propriétaire) « ‹ novembre 2026 › » au lieu du champ calendrier en
  // anglais et du bouton « Afficher » ; même barre que les Bulletins et la Liste de présence (.pr-barre) ; pas de mois futur
  const choixMois = () => {
    const m = moisChoisi().slice(0, 7), dernier = m >= P.aujourdhui().slice(0, 7);
    return '<div class="carte pr-barre choix-mois" role="group" aria-label="Mois"><button type="button" class="btn petit" data-action="compta-mois" data-pas="-1" aria-label="Mois précédent">‹</button>' +
      '<h2><span class="pr-mois">' + P.esc(P.mois(m)) + '</span></h2>' +
      '<button type="button" class="btn petit" data-action="compta-mois" data-pas="1" aria-label="Mois suivant"' + (dernier ? ' disabled' : '') + '>›</button></div>';
  };
  P.actions['compta-mois'] = (el) => {
    const [a, m] = moisChoisi().slice(0, 7).split('-').map(Number);
    const suivant = new Date(Date.UTC(a, m - 1 + Number(el.dataset.pas || 0), 1)).toISOString().slice(0, 10);
    if (suivant.slice(0, 7) > P.aujourdhui().slice(0, 7)) return;
    P.etat.moisCompta = suivant;
    P.afficher();
  };

  async function comptes(tous) {
    const r = sb.from('compta_comptes').select('*').order('cree_le');
    return P.bd(tous ? r : r.eq('actif', true));
  }
  // Toutes les lignes d'une requête, par paquets de 1 000 (limite d'une réponse de la base)
  async function toutes(fabrique) {
    const liste = [];
    for (let i = 0; ; i += 1000) {
      const r = await P.bd(fabrique().range(i, i + 999));
      liste.push.apply(liste, r);
      if (r.length < 1000) return liste;
    }
  }
  async function ecritures(mois, sens) {
    const [debut, fin] = bornes(mois);
    return toutes(() => {
      let r = sb.from('compta_ecritures').select('*').gte('date_op', debut).lt('date_op', fin);
      if (sens) r = r.eq('sens', sens);
      return r.order('date_op', { ascending: false }).order('cree_le', { ascending: false }).order('id');
    });
  }
  // valeur d'un champ de formulaire, sans espaces autour (null si vide)
  const champ = (f, k) => String(f.get(k) || '').trim() || null;
  // après une action : fenêtre fermée, page redessinée, message
  const actualiser = async (texte) => { P.fenetre(''); await P.afficher(); P.message(texte); };
  // Créances (ce qu'on nous doit) ou dettes (ce qu'on doit) : réglé, avoirs, reste, retard
  // (calculés par la base, compta_dettes_etat)
  const dettes = (sens) => P.rpc('compta_dettes_etat', { p_sens: sens });
  // Impôts : paiements (dépenses « impots ») et règle « payé » = dépense liée, non annulée
  const paiementsImpots = () => P.bd(sb.from('compta_ecritures').select('id, date_op, annule').eq('categorie', 'impots'));
  const paiementImpot = (i, paiements) => (i.ecriture_id && paiements.find((e) => e.id === i.ecriture_id && !e.annule)) || null;
  const totaux = (liste, sens) => liste.filter((e) => e.sens === sens && !e.annule).reduce((s, e) => s + e.montant, 0);

  // ---------- Tableau du mois ----------
  async function mois() {
    const m = moisChoisi();
    const [liste, soldes, creances, dues] = await Promise.all([ecritures(m), P.rpc('compta_soldes'), dettes('creance'), dettes('dette')]);
    const reste = (l) => l.reduce((t, d) => t + d.reste, 0);
    const rec = totaux(liste, 'recette'), dep = totaux(liste, 'depense');
    const parCategorie = (sens) => P.sommesParCategorie(liste, sens);
    const barres = (sens, total, rouge) => {
      const l = parCategorie(sens);
      return l.length ? l.map((c) => P.barre(RECETTES[c[0]] || DEPENSES[c[0]] || AUTRES[c[0]] || c[0], c[1], total, rouge)).join('') : '<p class="doux">Rien pour le moment.</p>';
    };
    const sansJustif = liste.filter((e) => e.sens === 'depense' && !e.annule && !e.justificatif).length;
    let legal = false;
    try { const r = await sb.from('compta_reglages').select('mode_legal').eq('id', 1).maybeSingle(); legal = !!(r && r.data && r.data.mode_legal); } catch (e) { /* réglages indisponibles : on affiche le mode non fiscal */ }
    const carteMode = '<div class="carte"><h2>Mode actuel : ' + (legal ? 'Légal (factures officielles)' : 'Factures internes, non déclarées') + '</h2><p class="doux">' +
      (legal ? 'Factures complètes, TVA et FNE actives.' : 'Les factures sont des documents internes « non fiscaux ». La FNE et la TVA sont prévues et s’activeront avec le mode légal.') +
      '</p><a class="btn petit rouge" href="#/compta/identite">' + (legal ? 'Voir l’identité de l’agence' : 'Identité de l’agence →') + '</a></div>';
    return P.entete('Tableau de bord · ' + P.mois(m), choixMois()) + carteMode +
      '<div class="grille chiffres">' + P.chiffre('Recettes du mois', P.fcfa(rec), 'vert') + P.chiffre('Dépenses du mois', P.fcfa(dep), 'rouge') +
      P.chiffre('Résultat du mois', P.fcfa(rec - dep), rec - dep < 0 ? 'rouge' : '') + P.chiffre('Dépenses sans justificatif', sansJustif, sansJustif ? 'orange' : '') +
      P.chiffre('On nous doit', P.fcfa(reste(creances)), creances.some((d) => d.retard) ? 'orange' : '') + P.chiffre('Nous devons', P.fcfa(reste(dues)), dues.some((d) => d.retard) ? 'rouge' : '') + '</div>' +
      '<div class="grille deux"><div class="carte"><h2>Recettes par catégorie</h2>' + barres('recette', rec, false) + '</div>' +
      '<div class="carte"><h2>Dépenses par catégorie</h2>' + barres('depense', dep, true) + '</div></div>' +
      // (12/11/2026) les soldes en liste claire, le montant en grand
      '<div class="carte"><h2>Trésorerie aujourd’hui</h2><ul class="soldes">' + soldes.map((s) =>
        '<li><span>' + P.esc(s.nom) + '</span><b class="' + (s.solde < 0 ? 'rouge' : '') + '">' + P.fcfa(s.solde) + '</b></li>').join('') + '</ul></div>';
  }

  // ---------- Liste d'écritures (recettes, dépenses, virements) ----------
  // (12/11/2026, « premium partout ») une carte par écriture : libellé (et tiers avec sa photo), date · catégorie ·
  // compte, montant, état ; annulée = barrée, avec son motif (P.cartesPersonnes, js/admin/coque.js)
  function lignes(liste, nomsComptes, vide) {
    return P.cartesPersonnes(liste.map((e) => ({
      tete: '<b class="pers-libelle">' + P.esc(e.libelle) + '</b>' + (e.tiers ? '<span class="petit-texte doux tiers"><span data-visage-nom="' + P.esc(e.tiers) + '"></span>' + P.esc(e.tiers) + '</span>' : ''),
      sous: [P.date(e.date_op), categorie(e), (nomsComptes[e.compte_id] || '—') + (e.compte_dest_id ? ' → ' + (nomsComptes[e.compte_dest_id] || '—') : ''), e.annule && e.motif_annulation ? 'Motif : ' + e.motif_annulation : ''],
      montant: P.fcfa(e.montant), classe: e.annule ? 'annulee' : '', ton: e.annule ? 'erreur' : 'neutre',
      etat: e.annule ? ['Annulée', 'erreur'] : e.source === 'espace2' ? ['Suivi des paiements · automatique', 'info'] : null,
      actions: (e.justificatif ? '<button class="btn petit" type="button" data-action="compta-justif-voir" data-id="' + e.id + '">Justificatif</button>' :
        (!e.annule && e.source === 'manuel' ? '<button class="btn petit" type="button" data-action="compta-justif-joindre" data-id="' + e.id + '">Joindre</button>' : '')) +
        (!e.annule && e.source === 'manuel' ? '<button class="btn petit" type="button" data-action="compta-annuler" data-id="' + e.id + '">Annuler</button>' : '')
    })), vide || 'Aucune écriture ce mois-ci.');
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
        (recette ? '<div class="note info">Les inscriptions et mensualités validées dans le Suivi des paiements arrivent ici toutes seules. Saisissez ici les autres recettes : castings, prestations, masterclass…</div>' : '') +
        '<form class="carte f" data-form="compta-ecrire" data-sens="' + sens + '"><h2>' + (recette ? 'Nouvelle recette' : 'Nouvelle dépense') + '</h2>' +
        '<label class="fl" for="cp-date">Date<input id="cp-date" name="date_op" type="date" required max="' + P.aujourdhui() + '" value="' + P.aujourdhui() + '"></label>' +
        '<label class="fl" for="cp-montant">Montant (FCFA)<input id="cp-montant" name="montant" type="number" inputmode="numeric" min="1" step="1" required></label>' +
        '<label class="fl" for="cp-cat">Catégorie<select id="cp-cat" name="categorie" required>' + optionsCategories(recette ? RECETTES : DEPENSES) + '</select></label>' +
        '<label class="fl" for="cp-compte">' + (recette ? 'Encaissé sur' : 'Payé depuis') + '<select id="cp-compte" name="compte_id" required>' + optionsComptes(actifs) + '</select></label>' +
        '<label class="fl large" for="cp-libelle">Libellé<input id="cp-libelle" name="libelle" required maxlength="200" placeholder="' + (recette ? 'Ex. : casting défilé Sococé' : 'Ex. : loyer du bureau d’octobre') + '"></label>' +
        '<label class="fl" for="cp-tiers">' + (recette ? 'Client' : 'Fournisseur ou bénéficiaire') + ' (facultatif)<input id="cp-tiers" name="tiers" maxlength="120"></label>' +
        '<label class="fl" for="cp-justif">Justificatif (photo ou PDF, 10 Mo au plus)' + (recette ? '' : ', recommandé') + '<input id="cp-justif" name="justificatif" type="file" accept="image/*,application/pdf"></label>' +
        '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer</button></div></form>' +
        lignes(liste, noms, recette ? 'Aucune recette ce mois-ci.' : 'Aucune dépense ce mois-ci.');
    };
  }

  // Dépose le justificatif dans le stockage privé et renvoie son chemin
  async function deposerJustificatif(fichier) {
    if (!fichier || !fichier.size) return null;
    // photo d'iPhone (HEIC) convertie en JPEG quand le navigateur le sait (js/conversion-heic.js),
    // sinon gardée telle quelle (certains navigateurs ne donnent pas son type)
    if (window.convertirSiHeic) fichier = await window.convertirSiHeic(fichier);
    if (fichier.size > JUSTIF_MAX) throw new Error('Justificatif trop lourd : 10 Mo au plus.');
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
      const r = await P.bd(sb.from(tableDe(form)).update({ justificatif: chemin }).eq('id', form.getAttribute('data-id')).select('id'));
      if (!r || !r.length) return P.message('Action refusée : votre rôle ne le permet pas.');
      await actualiser('Justificatif joint.');
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
      '<section class="pers-section"><h2>Virements · ' + P.esc(P.mois(m)) + '</h2>' + choixMois() + lignes(virements, noms, 'Aucun virement ce mois-ci.') + '</section>' +
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
      await actualiser('Compte enregistré.');
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

  // Écritures d'un sens (recette / dépense), hors annulées : [[catégorie, total]], la plus grosse d'abord
  // (tableau de bord de la Comptabilité et Dossier du mois)
  P.sommesParCategorie = (ecritures, sens) => {
    const t = {};
    ecritures.filter((e) => e.sens === sens && !e.annule).forEach((e) => { t[e.categorie] = (t[e.categorie] || 0) + e.montant; });
    return Object.keys(t).sort((a, b) => t[b] - t[a]).map((k) => [k, t[k]]);
  };
  // Cachets (Payer les mannequins, Rapport des cachets) : nom d'une mannequin du registre — lien
  // vers sa fiche des Paiements (sa photo devant, js/admin/coque.js) pour qui voit les Paiements ;
  // sinon sa photo cherchée par son nom ; et la table des cachets pas encore créée
  const nomMannequin = (id, nom) => (id && P.lienFiche && P.moi.espaces.paiements ? P.lienFiche(id, nom) : '<span data-visage-nom="' + P.esc(nom) + '"></span><b>' + P.esc(nom) + '</b>');
  const cachetsAbsents = (e) => /cachets_mannequins|PGRST205|42P01|does not exist/.test(String((e && (e.code + ' ' + e.message)) || e));
  P.compta = { nomMannequin, cachetsAbsents, RECETTES, DEPENSES, AUTRES, comptes, ecritures, toutes, dettes, moisChoisi, bornes, choixMois, lignes, optionsComptes, optionsCategories, deposerJustificatif, totaux, champ, actualiser, paiementsImpots, paiementImpot };
  // (les pages du morceau B sont ajoutées par js/portail/espace-compta-suivi.js)
  P.espaces.compta = {
    nav: [[null, 'Au quotidien'], ['mois', 'Tableau du mois'], ['recettes', 'Recettes'], ['depenses', 'Dépenses'], ['tresorerie', 'Trésorerie']],
    pages: { mois, recettes: ecranSens('recette'), depenses: ecranSens('depense'), tresorerie }
  };
})();
