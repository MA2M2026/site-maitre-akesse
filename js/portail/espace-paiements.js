// Portail — Espace 2 : Suivi des paiements et des inscriptions (cahier v2.3, sections 7 et 15).
// Le seul endroit où l'argent des mannequins est visible avec les noms. Les opérations qui
// touchent plusieurs choses à la fois (valider un paiement : échéance, reçu, recette,
// notification, registre) passent par UNE fonction de la base, en tout ou rien.
(function () {
  'use strict';
  const P = window.Portail;
  const NAV = [
    ['mois', 'Tableau du mois'], ['rapprocher', 'Paiements à rapprocher'], ['registre', 'Registre des mannequins'],
    ['messages', 'Messages et relances'], ['matrice', 'Matrice mannequins × mois'], ['recap', 'Récapitulatif de fin de mois'],
    ['parametres', 'Paramètres']
  ];
  const STATUT = {
    a_payer: ['À payer', 'info'], declare: ['Paiement déclaré', 'alerte'], payee: ['Payée', 'ok'], refusee: ['Refusée', 'alerte'],
    non_paye: ['Non payé', 'erreur'], exoneree: ['Exonérée', 'neutre'], annulee: ['Annulée', 'neutre']
  };
  const TYPE = { inscription: 'Inscription + 1er mois', mensualite: 'Mensualité', autre: 'Autre' };
  const STATUT_REGISTRE = { actif: ['Actif', 'ok'], suspendu: ['Suspendu', 'alerte'], sortie_proposee: ['Sortie proposée', 'alerte'], sorti: ['Sorti', 'erreur'] };
  const estPrincipal = () => P.moi.role === 'principal';
  const pastilleEcheance = (e) => P.pastille(STATUT[e.statut][0], STATUT[e.statut][1]);
  const groupe = (m) => m.user_id ? P.pastille('Inscrit sur le site', 'info') : P.pastille('Non inscrit', 'neutre');
  const mineur = (m, majorite) => (P.age(m.date_naissance) || 99) < (majorite || 18);
  let reglages = null;

  async function chargerReglages() {
    if (!reglages) reglages = (await P.bd(sb.from('portail_reglages').select('*').limit(1)))[0];
    return reglages;
  }
  // nombre de déclarations à rapprocher, affiché dans le menu
  async function avant() {
    const { count } = await sb.from('payment_declarations').select('*', { count: 'exact', head: true }).eq('statut', 'declare');
    P.espaces.paiements.compteur = { rapprocher: count || 0 };
    await chargerReglages();
  }
  function moisChoisi() { return P.etat.moisPaiements || P.moisCourant(); }
  function selecteurMois() {
    const options = [];
    const d = new Date(P.moisCourant());
    for (let i = -12; i <= 1; i++) {
      const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
      const v = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-01';
      options.push('<option value="' + v + '"' + (v === moisChoisi() ? ' selected' : '') + '>' + P.mois(v) + '</option>');
    }
    return '<label class="fl" for="choix-mois" style="flex-direction:row;align-items:center;gap:8px">Mois<select id="choix-mois" data-change="paiements-mois" style="width:auto">' + options.reverse().join('') + '</select></label>';
  }
  P.changements['paiements-mois'] = (el) => { P.etat.moisPaiements = el.value; P.afficher(); };

  async function echeancesDuMois(mois) {
    return P.bd(sb.from('fee_dues').select('*, mannequin:agence_mannequins(id, nom, prenoms, date_naissance, telephone, user_id, statut, montant_mensuel)')
      .eq('mois', mois).neq('statut', 'annulee').order('cree_le'));
  }

  // ---------- Tableau du mois ----------
  async function mois() {
    const m = moisChoisi(), r = await chargerReglages();
    const ds = await echeancesDuMois(m);
    const somme = (f) => ds.filter(f).reduce((s, e) => s + e.montant_du, 0);
    const attendu = somme(() => true), valide = ds.reduce((s, e) => s + e.montant_paye, 0);
    const attente = somme((e) => e.statut === 'declare'), impaye = somme((e) => e.statut === 'non_paye');
    const filtre = P.etat.filtreGroupe || 'tous';
    const visibles = ds.filter((e) => filtre === 'tous' || (filtre === 'inscrits') === !!e.mannequin.user_id);
    return P.entete(P.mois(m).replace(/^./, (c) => c.toUpperCase()), selecteurMois() + (estPrincipal() || P.moi.espaces.paiements ? '<button class="btn petit" data-action="paiements-creer-echeances">Créer les échéances du mois</button>' : '')) +
      '<div class="grille chiffres">' + P.chiffre('Attendu', P.fcfa(attendu)) + P.chiffre('Validé', P.fcfa(valide), 'vert') +
      P.chiffre('En attente de rapprochement', P.fcfa(attente), 'orange') + P.chiffre('Non payé', P.fcfa(impaye), 'rouge') +
      P.chiffre('Taux de recouvrement', (attendu ? Math.round(valide / attendu * 100) : 0) + ' %') + '</div>' +
      '<div class="ligne ecartee"><div class="ligne">' + P.pastille('À jour : ' + ds.filter((e) => e.statut === 'payee').length, 'ok') +
      P.pastille('Paiement déclaré : ' + ds.filter((e) => e.statut === 'declare').length, 'alerte') +
      P.pastille('Non payé : ' + ds.filter((e) => e.statut === 'non_paye').length, 'erreur') + '</div>' +
      '<div class="segments">' + [['tous', 'Tous'], ['inscrits', 'Inscrits sur le site'], ['non', 'Non inscrits']].map((g) =>
        '<button class="btn petit' + (filtre === g[0] ? ' actif' : '') + '" data-action="paiements-groupe" data-g="' + g[0] + '">' + g[1] + '</button>').join('') + '</div></div>' +
      P.tableau(['Mannequin', 'Groupe', 'Destinataire', '#Montant', 'Statut', 'Action'], visibles.map((e) => {
        const mn = e.mannequin, enRetard = e.statut === 'non_paye';
        return '<tr class="' + (enRetard ? 'en-retard' : '') + '"><td><a href="#/paiements/fiche/' + mn.id + '"><b>' + P.esc(mn.nom) + '</b></a>' + (mineur(mn, r.age_majorite) ? ' ' + P.pastille('mineur', 'neutre') : '') + '</td>' +
          '<td>' + groupe(mn) + '</td><td>' + (mineur(mn, r.age_majorite) ? 'Parent' : 'Lui-même') + '</td>' +
          '<td class="nombre">' + P.fcfa(e.montant_du) + (e.type === 'inscription' ? '<div class="petit-texte doux">inscription + 1er mois</div>' : '') +
          (e.montant_paye && e.montant_paye < e.montant_du ? '<div class="petit-texte doux">payé ' + P.fcfa(e.montant_paye) + '</div>' : '') + '</td>' +
          '<td>' + pastilleEcheance(e) + '</td><td class="ligne">' +
          (e.statut === 'payee' ? '<button class="btn petit" data-action="paiements-recu" data-echeance="' + e.id + '">Reçu</button>'
            : '<button class="btn petit" data-action="paiements-hors-ligne" data-echeance="' + e.id + '" data-montant="' + (e.montant_du - e.montant_paye) + '" data-nom="' + P.esc(mn.nom) + '">Paiement hors ligne</button>' +
              (!mn.user_id ? '<button class="btn petit" data-action="paiements-lien" data-echeance="' + e.id + '" data-nom="' + P.esc(mn.nom) + '">Lien personnel</button>' : '')) +
          '</td></tr>';
      })) + '<p class="petit-texte doux">Lignes rouges : paiements non faits après le ' + r.jour_limite + '. Mineur : messages au parent. Inscrits et non inscrits sont dans le même tableau.</p>';
  }
  P.actions['paiements-groupe'] = (el) => { P.etat.filtreGroupe = el.getAttribute('data-g'); P.afficher(); };
  P.actions['paiements-creer-echeances'] = async () => {
    const n = await P.rpc('portail_creer_echeances', { p_mois: moisChoisi() });
    P.message(n + ' échéance(s) créée(s) pour ' + P.mois(moisChoisi()) + '. Messages du 1er préparés.');
    P.afficher();
  };

  // Paiement reçu hors ligne (espèces, virement, autre) ou validation après rapprochement
  function formulaireValidation(titre, echeance, montant, declaration, horsLigne) {
    P.fenetre('<form data-form="paiements-valider" class="f"><h2>' + P.esc(titre) + '</h2>' +
      '<input type="hidden" name="echeance" value="' + P.esc(echeance) + '"><input type="hidden" name="declaration" value="' + P.esc(declaration || '') + '">' +
      '<label class="fl" for="pv-montant">Montant reçu (FCFA)<input id="pv-montant" name="montant" type="number" min="1" step="1" value="' + P.esc(montant) + '" required></label>' +
      '<label class="fl" for="pv-mode">Mode<select id="pv-mode" name="mode">' + (horsLigne ? '<option value="especes">Espèces</option><option value="virement">Virement</option><option value="autre">Autre</option><option value="wave">Wave</option>'
        : '<option value="wave">Wave</option><option value="orange">Orange Money</option><option value="mtn">MTN Money</option><option value="moov">Moov Money</option>') + '</select></label>' +
      '<label class="fl" for="pv-par">Payé par (si ce n’est pas le mannequin)<input id="pv-par" name="paye_par" placeholder="Parent, proche…"></label>' +
      '<label class="fl" for="pv-tx">Identifiant de transaction (facultatif, évite une double validation)<input id="pv-tx" name="transaction"></label>' +
      '<div class="note large">À la validation : reçu numéroté, recette pour la comptabilité (sans nom), message de confirmation au mannequin (au parent si mineur).</div>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">Valider le paiement</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
  }
  P.actions['paiements-hors-ligne'] = (el) => formulaireValidation('Paiement hors ligne : ' + el.getAttribute('data-nom'), el.getAttribute('data-echeance'), el.getAttribute('data-montant'), null, true);
  P.formulaires['paiements-valider'] = async (f) => {
    const r = await P.sensible(() => P.rpc('portail_valider_paiement', {
      p_echeance: f.get('echeance'), p_montant: Number(f.get('montant')), p_mode: f.get('mode'),
      p_declaration: f.get('declaration') || null, p_paye_par: String(f.get('paye_par') || '').trim() || null,
      p_id_transaction: String(f.get('transaction') || '').trim() || null, p_automatique: false
    }));
    P.fenetre('');
    P.message('Paiement validé. Reçu ' + r.recu + '. Confirmation préparée pour le mannequin.');
    envoyerFile().catch(() => { /* la file sera reprise plus tard */ });
    P.afficher();
    if (r.code_espace) fenetreCodeEspace(r.code_espace, 'Inscription validée');
  };
  // Code personnel de l'espace mannequin (18/10/2026) : créé à la validation de l'inscription,
  // ou redonné depuis la fiche. Envoyé aussi par message ; il ne s'affiche qu'une fois.
  function fenetreCodeEspace(code, titre) {
    P.fenetre('<h2>' + P.esc(titre) + '</h2><p>Code personnel pour créer son espace mannequin :</p><div class="note ok" style="font-size:22px;font-weight:800;letter-spacing:2px">' + P.esc(code) + '</div>' +
      '<p class="doux">Il est aussi parti par message (e-mail, WhatsApp). Il ne sert qu’une fois et ne s’affichera plus. En créant son compte avec ce code, le mannequin retrouve ses informations et ses photos du casting.</p>' +
      '<div class="ligne"><button class="btn rouge" data-action="copier" data-texte="' + P.esc(code) + '">Copier le code</button><button class="btn" data-action="fermer-fenetre">Fermer</button></div>');
  }
  P.actions['paiements-code-espace'] = async (el) => {
    const code = await P.rpc('portail_code_espace', { p_mannequin: el.getAttribute('data-id') });
    fenetreCodeEspace(code, 'Nouveau code de l’espace mannequin');
  };

  // Lien personnel (mannequin sans compte) : envoyé par WhatsApp ou SMS
  P.actions['paiements-lien'] = async (el) => {
    const jeton = await P.rpc('portail_creer_lien_paiement', { p_echeance: el.getAttribute('data-echeance'), p_jours: 10 });
    const url = location.origin + '/paiement/?t=' + encodeURIComponent(jeton);
    P.fenetre('<h2>Lien personnel de ' + P.esc(el.getAttribute('data-nom')) + '</h2><p class="doux">Valable 10 jours, pour cette échéance seulement. Il remplace l’ancien lien. Il ne s’affichera plus : envoyez-le maintenant.</p>' +
      '<div class="note ok" style="word-break:break-all">' + P.esc(url) + '</div><div class="ligne"><button class="btn rouge" data-action="copier" data-texte="' + P.esc(url) + '">Copier le lien</button>' +
      '<button class="btn" data-action="fermer-fenetre">Fermer</button></div>');
  };

  // Reçu PDF (REC-AAAA-NNNNN)
  P.actions['paiements-recu'] = async (el) => {
    const pays = await P.bd(sb.from('payments').select('*, recu:receipts(numero, emis_le), echeance:fee_dues(type, mois, montant_du, mannequin:agence_mannequins(nom))')
      .eq('echeance_id', el.getAttribute('data-echeance')).order('valide_le'));
    if (!pays.length) { P.message('Aucun reçu pour cette échéance.'); return; }
    pays.forEach((p) => window.MA2M_RECU(p));
  };

  // ---------- Paiements à rapprocher ----------
  async function rapprocher() {
    const r = await chargerReglages();
    const file = await P.bd(sb.from('payment_declarations')
      .select('*, echeance:fee_dues(id, type, mois, montant_du, montant_paye, mannequin:agence_mannequins(id, nom, telephone, whatsapp, user_id, date_naissance))')
      .eq('statut', 'declare').order('declare_le'));
    if (!P.etat.selection || !file.some((d) => d.id === P.etat.selection)) P.etat.selection = file.length ? file[0].id : null;
    const d = file.find((x) => x.id === P.etat.selection);
    let detail = '<p class="doux">Sélectionnez une déclaration dans la file d’attente.</p>';
    if (d) {
      const e = d.echeance, mn = e.mannequin, attendu = e.montant_du - e.montant_paye;
      const numeroRegistre = String(mn.telephone || '').replace(/\D/g, ''), numeroPayeur = String(d.numero_payeur || '').replace(/\D/g, '');
      const heures = Math.round((Date.now() - new Date(d.declare_le)) / 36e5);
      const alertes = [];
      if (d.montant !== attendu) alertes.push('Montant déclaré (' + P.fcfa(d.montant) + ') différent de l’attendu (' + P.fcfa(attendu) + ').');
      if (numeroPayeur && numeroRegistre && numeroPayeur.slice(-8) !== numeroRegistre.slice(-8)) alertes.push('Le numéro payeur n’est pas celui du registre : vérifiez le nom dans Wave Business.');
      if (heures >= r.heures_alerte_rapprochement) alertes.push('Déclaration en attente depuis ' + heures + ' heures.');
      detail = '<div class="grille" style="gap:16px"><h2>Vérifier le paiement de ' + P.esc(mn.nom) + '</h2>' +
        alertes.map((a) => '<div class="note erreur">' + P.esc(a) + '</div>').join('') +
        '<div class="grille deux"><div class="carte" style="background:var(--surface-douce)"><div class="petit-texte doux" style="font-weight:700;text-transform:uppercase;letter-spacing:1px">Déclaré le ' + P.dateHeure(d.declare_le) + '</div>' +
        '<div style="font-size:24px;font-weight:800;margin-top:10px">' + P.fcfa(d.montant) + '</div><div>Numéro payeur : <b>' + P.esc(d.numero_payeur || '—') + '</b></div>' +
        '<div class="petit-texte doux">' + P.esc(TYPE[e.type]) + ' · ' + P.esc(P.mois(e.mois)) + ' · ' + P.esc(d.operateur) + '</div></div>' +
        '<div class="carte"><div class="petit-texte doux">Enregistré dans le registre</div><b>' + P.esc(mn.nom) + '</b><div>' + P.esc(mn.telephone || '—') + '</div>' +
        '<div class="petit-texte">' + (mn.user_id ? 'Inscrit sur le site' : 'Non inscrit') + ' · destinataire : ' + (mineur(mn, r.age_majorite) ? 'Parent' : 'Lui-même') + '</div></div></div>' +
        '<div class="note">Comparez le nom, le numéro, le montant et l’heure avec la transaction réelle dans Wave Business avant de valider.</div>' +
        '<label class="fl" for="rp-motif">Motif (obligatoire pour « Introuvable » ou une précision)<input id="rp-motif" placeholder="Ex. aucune transaction de ce numéro"></label>' +
        '<div class="ligne"><button class="btn rouge" data-action="paiements-trouve" data-id="' + d.id + '" data-echeance="' + e.id + '" data-montant="' + d.montant + '" data-nom="' + P.esc(mn.nom) + '">Trouvé, valider</button>' +
        '<button class="btn" data-action="paiements-introuvable" data-id="' + d.id + '">Introuvable</button>' +
        '<button class="btn" data-action="paiements-precision" data-id="' + d.id + '">Demander une précision</button></div></div>';
    }
    return P.entete('Paiements à rapprocher', P.pastille(file.length + ' en attente', file.length ? 'alerte' : 'ok')) +
      '<div class="grille" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));align-items:start">' +
      '<div class="carte file"><div class="tete">File d’attente · ' + file.length + '</div>' +
      (file.length ? file.map((x) => '<button class="nav' + (x.id === P.etat.selection ? ' actif' : '') + '" data-action="paiements-choisir" data-id="' + x.id + '"><span><b>' + P.esc(x.echeance.mannequin.nom) + '</b><br><span class="petit-texte doux">' +
        P.fcfa(x.montant) + ' · ' + P.dateHeure(x.declare_le) + '</span></span></button>').join('') : '<div class="vide">Aucun paiement à rapprocher. Tout est à jour.</div>') + '</div>' +
      '<div class="carte" style="grid-column:span 2;min-width:0">' + detail + '</div></div>';
  }
  P.actions['paiements-choisir'] = (el) => { P.etat.selection = el.getAttribute('data-id'); P.afficher(); };
  P.actions['paiements-trouve'] = (el) => formulaireValidation('Valider le paiement de ' + el.getAttribute('data-nom'), el.getAttribute('data-echeance'), el.getAttribute('data-montant'), el.getAttribute('data-id'), false);
  async function refuser(el, precision) {
    const motif = (document.getElementById('rp-motif') || {}).value || '';
    if (!motif.trim()) { P.message('Indiquez un motif.'); return; }
    await P.rpc('portail_refuser_declaration', { p_declaration: el.getAttribute('data-id'), p_motif: motif.trim(), p_precision: precision });
    P.message(precision ? 'Précision demandée.' : 'Paiement marqué introuvable : le mannequin est prévenu.');
    envoyerFile().catch(() => { /* reprise plus tard */ });
    P.afficher();
  }
  P.actions['paiements-introuvable'] = (el) => refuser(el, false);
  P.actions['paiements-precision'] = (el) => refuser(el, true);

  // ---------- Registre ----------
  async function registre() {
    const r = await chargerReglages();
    const liste = await P.bd(sb.from('agence_mannequins').select('*, parents:mannequin_guardians(nom, telephone)').order('nom'));
    const opt = (v) => '<option value="' + v + '">' + P.fcfa(v) + '</option>';
    return P.entete('Registre des mannequins', '<button class="btn petit" data-action="paiements-export-registre">Exporter (CSV)</button>') +
      '<details class="carte"><summary>Ajouter un mannequin au registre</summary><form class="f" data-form="paiements-ajouter" style="margin-top:12px">' +
      '<label class="fl" for="rg-nom">Nom<input id="rg-nom" name="nom" required></label><label class="fl" for="rg-pre">Prénoms<input id="rg-pre" name="prenoms"></label>' +
      '<label class="fl" for="rg-nais">Date de naissance<input id="rg-nais" name="naissance" type="date" required></label>' +
      '<label class="fl" for="rg-tel">Téléphone<input id="rg-tel" name="telephone" type="tel" required></label><label class="fl" for="rg-wa">WhatsApp<input id="rg-wa" name="whatsapp" type="tel"></label>' +
      '<label class="fl" for="rg-mail">E-mail<input id="rg-mail" name="email" type="email"></label>' +
      '<label class="fl" for="rg-cat">Catégorie<input id="rg-cat" name="categorie" placeholder="Femme, Homme, New Face…"></label>' +
      '<label class="fl" for="rg-mens">Mensualité<select id="rg-mens" name="mensualite">' + opt(r.mensualite_standard) + opt(r.mensualite_haute) + '</select></label>' +
      '<label class="fl" for="rg-pn">Parent (obligatoire si mineur)<input id="rg-pn" name="parent_nom"></label><label class="fl" for="rg-pt">Téléphone du parent<input id="rg-pt" name="parent_tel" type="tel"></label>' +
      '<label class="fl" for="rg-pm">E-mail du parent<input id="rg-pm" name="parent_email" type="email"></label>' +
      '<label class="fl" for="rg-ins">Nouvelle inscription<select id="rg-ins" name="inscription"><option value="0">Non, déjà membre (mensualité du mois)</option><option value="1">Oui : ' + P.fcfa(r.droit_inscription + r.premier_mois) + ' (inscription + 1er mois)</option></select></label>' +
      '<button class="btn rouge" type="submit">Ajouter</button></form></details>' +
      P.tableau(['Mannequin', 'Âge', 'Groupe', 'Destinataire', '#Mensualité', 'Statut', 'Action'], liste.map((m) => {
        const age = P.age(m.date_naissance), estMineur = age < r.age_majorite, parent = (m.parents || [])[0];
        return '<tr><td><a href="#/paiements/fiche/' + m.id + '"><b>' + P.esc(m.nom + (m.prenoms ? ' ' + m.prenoms : '')) + '</b></a><div class="petit-texte doux">' + P.esc(m.telephone || '') + '</div></td>' +
          '<td>' + age + ' ans' + (estMineur ? ' ' + P.pastille('mineur', 'neutre') : '') + '</td><td>' + groupe(m) + '</td>' +
          '<td>' + (estMineur ? 'Parent<div class="petit-texte doux">' + P.esc(parent ? parent.nom : 'à renseigner') + '</div>' : 'Lui-même') + '</td>' +
          '<td class="nombre"><select data-change="paiements-mensualite" data-id="' + m.id + '" aria-label="Mensualité de ' + P.esc(m.nom) + '"' + (estPrincipal() ? '' : ' disabled') + ' style="min-width:130px">' +
          [r.mensualite_standard, r.mensualite_haute].concat([m.montant_mensuel]).filter((v, i, a) => a.indexOf(v) === i).map((v) => '<option value="' + v + '"' + (v === m.montant_mensuel ? ' selected' : '') + '>' + P.fcfa(v) + '</option>').join('') + '</select>' +
          (m.exoneration_motif ? '<div class="petit-texte doux">exonéré : ' + P.esc(m.exoneration_motif) + '</div>' : '') + '</td>' +
          '<td>' + P.pastille(STATUT_REGISTRE[m.statut][0], STATUT_REGISTRE[m.statut][1]) + '</td><td>' +
          (m.statut === 'sorti' ? '—' : estPrincipal()
            ? '<button class="btn petit" data-action="paiements-sortie" data-id="' + m.id + '" data-nom="' + P.esc(m.nom) + '">' + (m.statut === 'sortie_proposee' ? 'Confirmer la sortie' : 'Sortir') + '</button>'
            : '<button class="btn petit" data-action="paiements-proposer-sortie" data-id="' + m.id + '"' + (m.statut === 'sortie_proposee' ? ' disabled' : '') + '>Proposer la sortie</button>') + '</td></tr>';
      })) + '<p class="petit-texte doux">' + (estPrincipal() ? 'Le changement de mensualité s’applique aux échéances futures seulement (historique conservé).' : 'Seul l’administrateur principal modifie une mensualité ou décide une sortie.') + '</p>';
  }
  P.formulaires['paiements-ajouter'] = async (f) => {
    const r = await chargerReglages();
    const age = P.age(f.get('naissance'));
    const parentNom = String(f.get('parent_nom')).trim(), parentTel = String(f.get('parent_tel')).trim();
    if (age < r.age_majorite && (!parentNom || !parentTel)) { P.message('Mannequin mineur : le nom et le téléphone du parent sont obligatoires.'); return; }
    const tel = String(f.get('telephone')).trim();
    const doublons = await P.bd(sb.from('agence_mannequins').select('id, nom').or('telephone.eq.' + tel.replace(/[,()]/g, '') + ',and(nom.ilike.' + String(f.get('nom')).trim().replace(/[,()%*]/g, '') + ',date_naissance.eq.' + f.get('naissance') + ')'));
    if (doublons.length && !confirm('Un mannequin semble déjà enregistré (' + doublons.map((d) => d.nom).join(', ') + '). Ajouter quand même ?')) return;
    const m = (await P.bd(sb.from('agence_mannequins').insert({
      nom: String(f.get('nom')).trim(), prenoms: String(f.get('prenoms')).trim() || null, date_naissance: f.get('naissance'),
      telephone: tel, whatsapp: String(f.get('whatsapp')).trim() || tel, email: String(f.get('email')).trim() || null,
      categorie: String(f.get('categorie')).trim() || null, montant_mensuel: Number(f.get('mensualite'))
    }).select('id')))[0];
    if (parentNom) await P.bd(sb.from('mannequin_guardians').insert({ mannequin_id: m.id, nom: parentNom, lien: 'Parent', telephone: parentTel, email: String(f.get('parent_email')).trim() || null }));
    const mois = P.moisCourant(), limite = mois.slice(0, 8) + String(r.jour_limite).padStart(2, '0');
    const inscription = f.get('inscription') === '1';
    await P.bd(sb.from('fee_dues').insert({
      mannequin_id: m.id, type: inscription ? 'inscription' : 'mensualite', mois,
      montant_du: inscription ? r.droit_inscription + r.premier_mois : Number(f.get('mensualite')),
      date_limite: inscription ? P.aujourdhui() : limite
    }));
    P.message(String(f.get('nom')) + ' ajouté au registre.');
    P.afficher();
  };
  P.changements['paiements-mensualite'] = async (el) => {
    try {
      await P.sensible(() => P.bd(sb.from('agence_mannequins').update({ montant_mensuel: Number(el.value) }).eq('id', el.getAttribute('data-id'))));
      P.message('Mensualité modifiée : effet sur les échéances futures.');
    } catch (e) { P.message(P.erreurTexte(e)); }
    P.afficher();
  };
  P.actions['paiements-proposer-sortie'] = async (el) => {
    await P.bd(sb.from('agence_mannequins').update({ statut: 'sortie_proposee' }).eq('id', el.getAttribute('data-id')));
    P.message('Sortie proposée à l’administrateur principal.');
    P.afficher();
  };
  P.actions['paiements-sortie'] = async (el) => {
    const motif = prompt('Motif de la sortie de ' + el.getAttribute('data-nom') + ' (obligatoire) :');
    if (!motif || !motif.trim()) return;
    await P.sensible(() => P.bd(sb.from('agence_mannequins').update({ statut: 'sorti', motif_sortie: motif.trim() }).eq('id', el.getAttribute('data-id'))));
    P.message(el.getAttribute('data-nom') + ' est sorti de l’agence. Les échéances futures sont arrêtées.');
    P.afficher();
  };
  P.actions['paiements-export-registre'] = async () => {
    const liste = await P.sensible(async () => P.bd(sb.from('agence_mannequins').select('nom, prenoms, date_naissance, telephone, email, categorie, statut, montant_mensuel, date_entree').order('nom')));
    P.telecharger(P.csv(['Nom', 'Prénoms', 'Naissance', 'Téléphone', 'E-mail', 'Catégorie', 'Statut', 'Mensualité', 'Entrée'],
      liste.map((m) => [m.nom, m.prenoms, P.date(m.date_naissance), m.telephone, m.email, m.categorie, m.statut, m.montant_mensuel, P.date(m.date_entree)])), 'registre-mannequins.csv');
  };

  // ---------- Fiche d'un mannequin ----------
  async function fiche(params) {
    const id = params[0];
    const [m, echeances, messages] = await Promise.all([
      P.bd(sb.from('agence_mannequins').select('*, parents:mannequin_guardians(*)').eq('id', id).single()),
      P.bd(sb.from('fee_dues').select('*, paiements:payments(montant, mode, valide_le, recu:receipts(numero)), declarations:payment_declarations(declare_le, statut, motif, numero_payeur)').eq('mannequin_id', id).order('mois', { ascending: false })),
      P.bd(sb.from('message_log').select('*').eq('mannequin_id', id).order('planifie_le', { ascending: false }).limit(30))
    ]);
    return P.entete(m.nom + (m.prenoms ? ' ' + m.prenoms : ''), groupe(m) + P.pastille(STATUT_REGISTRE[m.statut][0], STATUT_REGISTRE[m.statut][1])) +
      '<div class="grille deux"><div class="carte"><h2>Identité et contacts</h2><p>' + P.esc(P.date(m.date_naissance)) + ' (' + P.age(m.date_naissance) + ' ans) · ' + P.esc(m.telephone || '—') + ' · ' + P.esc(m.email || '—') + '</p>' +
      (m.parents || []).map((g) => '<p class="petit-texte">Parent : <b>' + P.esc(g.nom) + '</b> · ' + P.esc(g.telephone) + (g.email ? ' · ' + P.esc(g.email) : '') + '</p>').join('') +
      '<p class="petit-texte doux">Entrée le ' + P.date(m.date_entree) + ' · mensualité ' + P.fcfa(m.montant_mensuel) + '</p>' +
      (m.user_id ? '<p class="petit-texte">' + P.pastille('Espace mannequin créé', 'ok') + '</p>'
        : '<p class="petit-texte">' + P.pastille('Pas encore d’espace sur le site', 'neutre') + ' <button class="btn petit" data-action="paiements-code-espace" data-id="' + m.id + '">Donner le code de l’espace</button></p>') +
      '<form data-form="paiements-notes" style="margin-top:12px"><input type="hidden" name="id" value="' + m.id + '"><label class="fl" for="fn-notes">Notes internes<textarea id="fn-notes" name="notes">' + P.esc(m.notes || '') + '</textarea></label><button class="btn petit" type="submit" style="margin-top:8px">Enregistrer les notes</button></form></div>' +
      '<div class="carte"><h2>Messages envoyés</h2>' + (messages.length ? messages.map((g) => '<div style="padding:8px 0;border-top:1px solid var(--lignes)"><div class="petit-texte doux">' + P.dateHeure(g.planifie_le) + ' · ' + P.esc(g.canal) + ' · ' + P.esc(g.statut) + '</div>' + P.esc(g.texte) + '</div>').join('') : '<p class="doux">Aucun message.</p>') + '</div></div>' +
      '<h2>Historique des échéances</h2>' + P.tableau(['Mois', 'Type', '#Dû', '#Payé', 'Statut', 'Reçus', 'Déclarations'], echeances.map((e) =>
        '<tr><td>' + P.esc(P.mois(e.mois)) + '</td><td>' + TYPE[e.type] + '</td><td class="nombre">' + P.fcfa(e.montant_du) + '</td><td class="nombre">' + P.fcfa(e.montant_paye) + '</td><td>' + pastilleEcheance(e) + (e.motif ? '<div class="petit-texte doux">' + P.esc(e.motif) + '</div>' : '') + '</td>' +
        '<td>' + (e.paiements || []).map((p) => (p.recu ? P.esc(p.recu.numero) : '') + ' <span class="petit-texte doux">(' + P.esc(p.mode) + ')</span>').join('<br>') + (e.statut === 'payee' ? ' <button class="btn petit" data-action="paiements-recu" data-echeance="' + e.id + '">PDF</button>' : '') + '</td>' +
        '<td class="petit-texte">' + (e.declarations || []).map((d) => P.dateHeure(d.declare_le) + ' · ' + P.esc(d.statut) + (d.motif ? ' · ' + P.esc(d.motif) : '')).join('<br>') + '</td></tr>'));
  }
  P.formulaires['paiements-notes'] = async (f) => {
    await P.bd(sb.from('agence_mannequins').update({ notes: String(f.get('notes')) }).eq('id', f.get('id')));
    P.message('Notes enregistrées.');
  };

  // ---------- Messages et relances ----------
  async function messages() {
    const r = await chargerReglages(), m = moisChoisi();
    const [modeles, file, journal, ds] = await Promise.all([
      P.bd(sb.from('message_templates').select('*').order('code')),
      P.bd(sb.from('message_log').select('*').eq('statut', 'a_envoyer').in('canal', ['email', 'whatsapp']).order('planifie_le').limit(200)),
      P.bd(sb.from('message_log').select('*').neq('statut', 'a_envoyer').order('planifie_le', { ascending: false }).limit(25)),
      echeancesDuMois(m)
    ]);
    const ouverts = ds.filter((e) => ['a_payer', 'refusee', 'non_paye'].includes(e.statut));
    const choix = P.etat.modele || 'relance';
    const calendrier = [['1er', 'appel', 1], [r.jour_relance, 'relance', r.jour_relance], [r.jour_derniere_relance, 'dernière relance', r.jour_derniere_relance], [r.jour_limite + 1, 'paiement non reçu', r.jour_limite + 1]];
    const jour = Number(P.aujourdhui().slice(8, 10));
    const emails = file.filter((x) => x.canal === 'email'), whatsapp = file.filter((x) => x.canal === 'whatsapp');
    return P.entete('Messages et relances', selecteurMois()) +
      '<div class="carte"><h2>Calendrier automatique</h2><div class="ligne" style="margin-top:10px">' + calendrier.map((c) => P.pastille('Le ' + c[0] + ' : ' + c[1] + (jour >= c[2] && m === P.moisCourant() ? ' · fait' : ' · à venir'), jour >= c[2] && m === P.moisCourant() ? 'ok' : 'neutre')).join('') + '</div>' +
      '<p class="petit-texte doux">Chaque matin à 6 h, la base crée les échéances le 1er, prépare les relances aux personnes sans paiement déclaré et passe les échéances ouvertes à « Non payé » le ' + (r.jour_limite + 1) + '. Mineur : le message va au parent.</p></div>' +
      '<div class="grille deux"><div class="carte"><h2>E-mails à envoyer (' + emails.length + ')</h2><p class="doux">Ils partent de cet appareil, par le service d’e-mail du site.</p>' +
      '<button class="btn rouge" data-action="paiements-envoyer-emails"' + (emails.length ? '' : ' disabled') + ' style="margin-top:10px">Envoyer les ' + emails.length + ' e-mail(s)</button></div>' +
      '<div class="carte"><h2>WhatsApp à envoyer (' + whatsapp.length + ')</h2><p class="doux">Un geste par message : le lien ouvre WhatsApp avec le texte déjà écrit.</p>' +
      whatsapp.slice(0, 15).map((x) => '<div class="ligne ecartee" style="padding:6px 0;border-top:1px solid var(--lignes)"><span class="petit-texte">' + P.esc(x.destinataire) + '</span>' +
        '<a class="btn petit" target="_blank" rel="noopener" data-action="paiements-whatsapp" data-id="' + x.id + '" href="https://wa.me/' + P.esc(numeroWhatsapp(x.adresse)) + '?text=' + encodeURIComponent(x.texte) + '">Envoyer</a></div>').join('') + '</div></div>' +
      '<div class="carte"><h2>Envoyer un message maintenant</h2><div class="segments" style="margin:12px 0">' + modeles.filter((x) => ['appel', 'relance', 'derniere_relance', 'non_recu'].includes(x.code)).map((x) =>
        '<button class="btn petit' + (choix === x.code ? ' actif' : '') + '" data-action="paiements-modele" data-code="' + x.code + '">' + P.esc(x.libelle) + '</button>').join('') + '</div>' +
      '<div class="note ok">' + P.esc((modeles.find((x) => x.code === choix) || {}).texte || '') + '</div>' +
      '<p class="petit-texte doux">Destinataires : ' + ouverts.length + ' mannequin(s) sans paiement validé ni déclaré pour ' + P.esc(P.mois(m)) + '. Canaux : espace, e-mail, WhatsApp (SMS dès qu’un fournisseur sera choisi).</p>' +
      '<button class="btn rouge" data-action="paiements-envoyer" ' + (ouverts.length ? '' : 'disabled') + '>Préparer pour ' + ouverts.length + ' personne(s)</button></div>' +
      '<h2>Journal des envois</h2>' + P.tableau(['Date', 'Destinataire', 'Canal', 'Statut', 'Message'], journal.map((g) =>
        '<tr><td>' + P.dateHeure(g.envoye_le || g.planifie_le) + '</td><td>' + P.esc(g.destinataire || '') + '</td><td>' + P.esc(g.canal) + '</td><td>' +
        P.pastille({ envoye: 'Envoyé', echec: 'Échec', sans_fournisseur: 'Sans fournisseur' }[g.statut] || g.statut, g.statut === 'envoye' ? 'ok' : g.statut === 'echec' ? 'erreur' : 'neutre') +
        (g.statut === 'echec' ? ' <button class="btn petit" data-action="paiements-reessayer" data-id="' + g.id + '">Réessayer</button>' : '') + '</td><td style="min-width:260px">' + P.esc(g.texte) + '</td></tr>'));
  }
  // numéro ivoirien local (10 chiffres) → format international pour wa.me
  function numeroWhatsapp(n) {
    const c = String(n || '').replace(/\D/g, '');
    return c.length === 10 ? '225' + c : c;
  }
  P.actions['paiements-modele'] = (el) => { P.etat.modele = el.getAttribute('data-code'); P.afficher(); };
  P.actions['paiements-envoyer'] = async () => {
    const ds = (await echeancesDuMois(moisChoisi())).filter((e) => ['a_payer', 'refusee', 'non_paye'].includes(e.statut));
    let n = 0;
    for (const e of ds) n += await P.rpc('portail_message_echeance', { p_echeance: e.id, p_modele: P.etat.modele || 'relance' });
    P.message(n + ' message(s) préparé(s). Envoyez maintenant les e-mails et les WhatsApp ci-dessous.');
    P.afficher();
  };
  P.actions['paiements-whatsapp'] = (el) => {
    sb.from('message_log').update({ statut: 'envoye', envoye_le: new Date().toISOString(), tentatives: 1 }).eq('id', el.getAttribute('data-id'))
      .then(() => setTimeout(P.afficher, 800));
    window.open(el.href, '_blank', 'noopener');
  };
  P.actions['paiements-reessayer'] = async (el) => {
    await P.bd(sb.from('message_log').update({ statut: 'a_envoyer', erreur: null }).eq('id', el.getAttribute('data-id')));
    await envoyerFile();
    P.afficher();
  };
  // File des e-mails : envoyés depuis le navigateur de l'agent (service EmailJS du site)
  async function envoyerFile() {
    if (typeof envoyerEmailCandidat !== 'function') return 0;
    const file = await P.bd(sb.from('message_log').select('*').eq('statut', 'a_envoyer').eq('canal', 'email').order('planifie_le').limit(50));
    let ok = 0;
    for (const x of file) {
      try {
        await envoyerEmailCandidat({ to_email: x.adresse, to_name: String(x.destinataire || '').split('·').pop().trim(), message: x.texte });
        await sb.from('message_log').update({ statut: 'envoye', envoye_le: new Date().toISOString(), tentatives: x.tentatives + 1 }).eq('id', x.id);
        ok++;
      } catch (e) {
        await sb.from('message_log').update({ statut: 'echec', tentatives: x.tentatives + 1, erreur: String((e && e.text) || e).slice(0, 200) }).eq('id', x.id);
      }
    }
    return ok;
  }
  P.actions['paiements-envoyer-emails'] = async () => {
    const n = await envoyerFile();
    P.message(n + ' e-mail(s) envoyé(s).');
    P.afficher();
  };

  // ---------- Matrice ----------
  async function matrice() {
    const debut = new Date(P.moisCourant()); debut.setMonth(debut.getMonth() - 11);
    const mois = [];
    for (let i = 0; i < 12; i++) { const x = new Date(debut.getFullYear(), debut.getMonth() + i, 1); mois.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-01'); }
    const [liste, ds] = await Promise.all([
      P.bd(sb.from('agence_mannequins').select('id, nom').neq('statut', 'sorti').order('nom')),
      P.bd(sb.from('fee_dues').select('mannequin_id, mois, statut').gte('mois', mois[0]).neq('statut', 'annulee'))
    ]);
    const ton = { payee: 'ok', exoneree: 'ok', declare: 'alerte', refusee: 'alerte', non_paye: 'erreur', a_payer: 'info' };
    return P.entete('Matrice mannequins × mois') +
      '<div class="ligne petit-texte"><span><i class="rond ok"></i> payé</span><span><i class="rond alerte"></i> déclaré</span><span><i class="rond erreur"></i> non payé</span><span><i class="rond info"></i> à payer</span></div>' +
      '<div class="tableau"><table class="matrice" style="min-width:720px"><thead><tr><th>Mannequin</th>' + mois.map((x) => '<th>' + P.MOIS[Number(x.slice(5, 7)) - 1].slice(0, 4) + '.</th>').join('') + '</tr></thead><tbody>' +
      liste.map((m) => '<tr><td><a href="#/paiements/fiche/' + m.id + '"><b>' + P.esc(m.nom) + '</b></a></td>' + mois.map((x) => {
        const d = ds.find((z) => z.mannequin_id === m.id && z.mois === x);
        return '<td>' + (d ? '<span class="rond ' + ton[d.statut] + '" title="' + P.esc(STATUT[d.statut][0]) + '"></span><span class="sr" hidden>' + P.esc(STATUT[d.statut][0]) + '</span>' : '<span class="doux">·</span>') + '</td>';
      }).join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  // ---------- Récapitulatif ----------
  async function recap() {
    const m = moisChoisi();
    const [ds, fige] = await Promise.all([echeancesDuMois(m), sb.from('month_snapshots').select('*').eq('mois', m).maybeSingle()]);
    const payes = ds.filter((e) => e.statut === 'payee' || e.statut === 'exoneree'), nonPayes = ds.filter((e) => !(e.statut === 'payee' || e.statut === 'exoneree'));
    const enRetard = (e) => e.statut === 'non_paye' ? Math.max(0, Math.round((Date.now() - new Date(e.date_limite)) / 864e5)) : 0;
    P.etat.recap = { m, payes, nonPayes };
    return P.entete('Récapitulatif de ' + P.mois(m), selecteurMois() + '<button class="btn petit" data-action="paiements-export-recap">Excel (CSV)</button><button class="btn petit" data-action="imprimer">PDF</button>') +
      '<div class="grille deux"><div class="carte"><h2>Ont payé (' + payes.length + ')</h2>' + payes.map((e) => '<div class="ligne ecartee" style="padding:8px 0;border-top:1px solid var(--lignes)"><span>' + P.esc(e.mannequin.nom) + '</span>' + P.pastille(P.fcfa(e.montant_paye || e.montant_du), 'ok') + '</div>').join('') + '</div>' +
      '<div class="carte"><h2>N’ont pas payé (' + nonPayes.length + ')</h2>' + (nonPayes.map((e) => '<div class="ligne ecartee" style="padding:8px 0;border-top:1px solid var(--lignes)"><span><b>' + P.esc(e.mannequin.nom) + '</b> ' + pastilleEcheance(e) +
        (enRetard(e) ? ' <span class="petit-texte doux">' + enRetard(e) + ' j de retard</span>' : '') + '</span>' +
        (estPrincipal() ? '<button class="btn petit" data-action="paiements-sortie" data-id="' + e.mannequin.id + '" data-nom="' + P.esc(e.mannequin.nom) + '">Sortir</button>'
          : '<button class="btn petit" data-action="paiements-proposer-sortie" data-id="' + e.mannequin.id + '">Proposer la sortie</button>') + '</div>').join('') || '<p class="doux">Tout le monde est à jour.</p>') + '</div></div>' +
      '<div class="ligne"><button class="btn rouge" data-action="paiements-figer">Figer le récapitulatif du mois</button>' +
      (fige.data ? P.pastille('Figé le ' + P.dateHeure(fige.data.fige_le) + ' : ' + (fige.data.contenu.payes || []).length + ' payés, ' + (fige.data.contenu.non_payes || []).length + ' non payés', 'ok') : '') + '</div>' +
      '<p class="petit-texte doux">Le récapitulatif est figé et archivé automatiquement le dernier jour du mois. La sortie d’un mannequin est décidée par l’administrateur principal.</p>';
  }
  P.actions['paiements-figer'] = async () => {
    await P.rpc('portail_figer_recap', { p_mois: moisChoisi() });
    P.message('Récapitulatif figé et archivé.');
    P.afficher();
  };
  P.actions['paiements-export-recap'] = () => {
    const r = P.etat.recap;
    P.telecharger(P.csv(['Mannequin', 'Statut', 'Montant dû', 'Payé'], r.payes.concat(r.nonPayes).map((e) => [e.mannequin.nom, STATUT[e.statut][0], e.montant_du, e.montant_paye])), 'recapitulatif-' + r.m.slice(0, 7) + '.csv');
  };
  P.actions.imprimer = () => window.print();

  // ---------- Paramètres ----------
  async function parametres() {
    const r = await chargerReglages();
    const [liens, modeles] = await Promise.all([P.bd(sb.from('wave_links').select('*').order('montant')), P.bd(sb.from('message_templates').select('*').order('code'))]);
    const lecture = estPrincipal() ? '' : ' disabled';
    const champ = (nom, libelle, type) => '<label class="fl" for="pp-' + nom + '">' + libelle + '<input id="pp-' + nom + '" name="' + nom + '" type="' + (type || 'number') + '" min="0" step="1" value="' + P.esc(r[nom]) + '"' + lecture + '></label>';
    return P.entete('Paramètres des paiements') + (estPrincipal() ? '' : '<div class="note">Lecture seule : seul l’administrateur principal modifie ces paramètres.</div>') +
      '<form class="carte f" data-form="paiements-parametres"><h2>Montants (FCFA)</h2>' + champ('droit_inscription', 'Droit d’inscription') + champ('premier_mois', '1er mois (inclus dans l’inscription)') +
      champ('mensualite_standard', 'Mensualité standard') + champ('mensualite_haute', 'Mensualité haute') +
      '<div class="note large">Paiement à l’inscription : ' + P.fcfa(r.droit_inscription + r.premier_mois) + ' en un seul lien, enregistré en deux lignes en comptabilité.</div>' +
      '<h2>Calendrier et règles</h2>' + champ('jour_limite', 'Date limite (jour du mois)') + champ('jour_relance', 'Jour de la relance') + champ('jour_derniere_relance', 'Jour de la dernière relance') +
      champ('age_majorite', 'Âge de majorité') + champ('mois_impayes_alerte', 'Alerte après combien de mois impayés') + champ('seuil_double_validation', 'Seuil de double validation (FCFA)') +
      champ('validite_code_jours', 'Validité d’un code d’inscription (jours)') + champ('essais_code', 'Essais avant blocage d’un code') + champ('heures_alerte_rapprochement', 'Alerte si non rapproché après (heures)') +
      (estPrincipal() ? '<button class="btn rouge" type="submit">Enregistrer</button>' : '') + '</form>' +
      '<div class="carte"><h2>Liens de paiement Wave Business</h2><p class="doux">Un lien par montant. Le bouton Payer du mannequin ouvre le lien qui correspond à son montant.</p>' +
      P.tableau(['Type', '#Montant', 'Lien', 'Actif', ''], liens.map((l) => '<tr><td>' + P.esc(l.type_droit) + '</td><td class="nombre">' + P.fcfa(l.montant) + '</td><td style="word-break:break-all">' + P.esc(l.url) + '</td><td>' + P.pastille(l.actif ? 'Actif' : 'Inactif', l.actif ? 'ok' : 'neutre') + '</td><td>' +
        (estPrincipal() ? '<button class="btn petit" data-action="paiements-lien-actif" data-id="' + l.id + '" data-actif="' + (l.actif ? '1' : '0') + '">' + (l.actif ? 'Désactiver' : 'Activer') + '</button>' : '') + '</td></tr>')) +
      (estPrincipal() ? '<form class="f" data-form="paiements-lien-ajouter" style="margin-top:12px"><label class="fl" for="wl-type">Type<select id="wl-type" name="type"><option value="inscription">Inscription</option><option value="formation">Formation</option><option value="autre">Autre</option></select></label>' +
        '<label class="fl" for="wl-montant">Montant<input id="wl-montant" name="montant" type="number" min="1" required></label><label class="fl" for="wl-url">Adresse du lien (https://…)<input id="wl-url" name="url" type="url" required pattern="https://.*"></label><button class="btn rouge" type="submit">Ajouter le lien</button></form>' : '') + '</div>' +
      '<div class="carte"><h2>Modèles de messages</h2><p class="petit-texte doux">Variables : {prenom}, {mois}, {montant}, {date_limite}, {lien_wave}, {lien_espace}.</p>' +
      modeles.map((x) => '<form data-form="paiements-modele" style="margin-top:12px"><input type="hidden" name="code" value="' + P.esc(x.code) + '"><label class="fl" for="mm-' + x.code + '">' + P.esc(x.libelle) +
        '<textarea id="mm-' + x.code + '" name="texte"' + lecture + '>' + P.esc(x.texte) + '</textarea></label>' + (estPrincipal() ? '<button class="btn petit" type="submit" style="margin-top:6px">Enregistrer ce modèle</button>' : '') + '</form>').join('') + '</div>';
  }
  P.formulaires['paiements-parametres'] = async (f) => {
    const champs = ['droit_inscription', 'premier_mois', 'mensualite_standard', 'mensualite_haute', 'jour_limite', 'jour_relance', 'jour_derniere_relance', 'age_majorite',
      'mois_impayes_alerte', 'seuil_double_validation', 'validite_code_jours', 'essais_code', 'heures_alerte_rapprochement'];
    const maj = {};
    champs.forEach((c) => { maj[c] = Math.round(Number(f.get(c))); });
    await P.sensible(() => P.rpc('portail_modifier_reglages', { p_reglages: maj }));
    reglages = null;
    P.message('Paramètres enregistrés. Effet sur les échéances futures.');
    P.afficher();
  };
  P.formulaires['paiements-lien-ajouter'] = async (f) => {
    await P.sensible(() => P.bd(sb.from('wave_links').insert({ type_droit: f.get('type'), montant: Number(f.get('montant')), url: String(f.get('url')).trim() })));
    P.message('Lien ajouté.');
    P.afficher();
  };
  P.actions['paiements-lien-actif'] = async (el) => {
    await P.sensible(() => P.bd(sb.from('wave_links').update({ actif: el.getAttribute('data-actif') !== '1' }).eq('id', el.getAttribute('data-id'))));
    P.afficher();
  };
  P.formulaires['paiements-modele'] = async (f) => {
    await P.bd(sb.from('message_templates').update({ texte: String(f.get('texte')), modifie_le: new Date().toISOString() }).eq('code', f.get('code')));
    P.message('Modèle enregistré.');
  };

  // « fiche » n'est pas dans le menu : on y arrive depuis le registre ou le tableau du mois
  P.espaces.paiements = { nav: NAV, avant, pages: { mois, rapprocher, registre, fiche, messages, matrice, recap, parametres } };
})();
