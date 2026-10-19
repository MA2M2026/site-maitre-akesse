// Espace 2 — Suivi des paiements et des inscriptions (cahier v2.4, section 5), construit morceau
// par morceau après validation du maître d'ouvrage. Morceau 1 : le registre de tous les
// mannequins de l'agence (comptes du site repris automatiquement + ajouts à la main) et le
// paiement de l'inscription enregistré par l'agence (« avant le nouveau système » ou espèces).
// Couleurs : vert = payé, orange = en attente de validation, rouge = non payé.
// Base : agence_mannequins et paiements_mannequins (supabase-administration.sql, section 6).
(function () {
  'use strict';
  const P = window.Portail;
  // 25 000 FCFA à l'inscription = 15 000 d'inscription + 10 000 pour le 1er mois de formation,
  // enregistrés sur deux lignes (cahier v2.4, 5.2)
  const DROIT_INSCRIPTION = 15000, PREMIER_MOIS = 10000, INSCRIPTION_FCFA = DROIT_INSCRIPTION + PREMIER_MOIS;
  const moisCourant = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };
  const STATUTS = { actif: 'Actif', suspendu: 'Suspendu', sorti: 'Sorti' };
  const MODES = { wave: 'Wave', especes: 'Espèces', avant_systeme: 'Avant le nouveau système' };

  // État de l'inscription d'un mannequin : [libellé, ton de la pastille]
  function etatInscription(m, paiement) {
    if (m.user_id) return ['Inscription déjà effectuée sur le site', 'ok'];
    if (!paiement) return ['Inscription non payée', 'erreur'];
    if (paiement.statut === 'valide') return ['Inscription payée' + (paiement.mode === 'avant_systeme' ? ' (avant le nouveau système)' : ''), 'ok'];
    return ['En attente de validation', 'alerte'];
  }
  async function charger() {
    const [registre, paiements] = await Promise.all([
      P.bd(sb.from('agence_mannequins').select('*').order('full_name')),
      P.bd(sb.from('paiements_mannequins').select('*').eq('objet', 'inscription').neq('statut', 'refuse'))
    ]);
    const parMannequin = {};
    paiements.forEach((p) => { parMannequin[p.mannequin_id] = p; });
    return registre.map((m) => Object.assign({}, m, { inscription: parMannequin[m.id] || null }));
  }

  // ---------- Registre ----------
  const FILTRES = [['tous', 'Tous'], ['site', 'Inscrits sur le site'], ['main', 'Ajoutés à la main'], ['non_paye', 'Inscription non payée']];
  async function registre() {
    const tous = await charger();
    const filtre = P.etat.filtreRegistre || 'tous', cherche = (P.etat.chercheRegistre || '').toLowerCase();
    const garde = (m) => (filtre === 'tous' || (filtre === 'site' && m.user_id) || (filtre === 'main' && !m.user_id) ||
      (filtre === 'non_paye' && etatInscription(m, m.inscription)[1] === 'erreur')) &&
      (!cherche || [m.full_name, m.telephone, m.email].join(' ').toLowerCase().includes(cherche));
    const liste = tous.filter(garde);
    const site = tous.filter((m) => m.user_id).length;
    return P.entete('Registre des mannequins', '<a class="btn rouge" href="#/paiements/ajouter">＋ Ajouter un mannequin</a>') +
      '<div class="grille chiffres">' + P.chiffre('Mannequins de l’agence', tous.length) + P.chiffre('Inscrits sur le site', site) +
      P.chiffre('Ajoutés à la main', tous.length - site) + P.chiffre('Inscription non payée', tous.filter((m) => etatInscription(m, m.inscription)[1] === 'erreur').length, 'rouge') + '</div>' +
      '<form class="ligne" data-form="registre-chercher"><label class="fl" for="rg-cherche" style="flex:1;min-width:200px">Rechercher (nom, téléphone, e-mail)' +
      '<input id="rg-cherche" name="cherche" value="' + P.esc(P.etat.chercheRegistre || '') + '"></label><button class="btn" type="submit">Rechercher</button></form>' +
      '<div class="segments">' + FILTRES.map((f) => '<button class="btn petit' + (f[0] === filtre ? ' actif' : '') + '" type="button" data-action="registre-filtre" data-filtre="' + f[0] + '">' + P.esc(f[1]) + '</button>').join('') + '</div>' +
      P.tableau(['Mannequin', 'Téléphone', 'Inscription', '#Mensualité', 'Statut', ''], liste.map((m) => {
        const e = etatInscription(m, m.inscription);
        return '<tr><td><b>' + P.esc(m.full_name) + '</b>' + (P.age(m.date_naissance) !== null && P.age(m.date_naissance) < 18 ? ' ' + P.pastille('Mineur', 'info') : '') +
          '<div class="petit-texte doux">' + (m.user_id ? 'Compte sur le site' : 'Ajouté à la main') + '</div></td>' +
          '<td>' + P.esc(m.telephone || '—') + '</td><td>' + P.pastille(e[0], e[1]) + '</td><td class="nombre">' + P.fcfa(m.mensualite) + '</td>' +
          '<td>' + P.pastille(STATUTS[m.statut], m.statut === 'actif' ? 'neutre' : 'alerte') + '</td>' +
          '<td><a class="btn petit" href="#/paiements/fiche/' + m.id + '">Ouvrir</a></td></tr>';
      }));
  }
  P.formulaires['registre-chercher'] = (f) => { P.etat.chercheRegistre = String(f.get('cherche')).trim(); P.afficher(); };
  P.actions['registre-filtre'] = (el) => { P.etat.filtreRegistre = el.getAttribute('data-filtre'); P.afficher(); };

  // ---------- Ajouter / modifier un mannequin ----------
  function champs(m) {
    const v = (k) => P.esc((m && m[k]) || '');
    const principal = P.moi.role === 'principal';
    return '<label class="fl" for="mq-nom">Nom et prénoms<input id="mq-nom" name="full_name" required value="' + v('full_name') + '"></label>' +
      '<label class="fl" for="mq-genre">Genre<select id="mq-genre" name="genre"><option value="">—</option><option value="femme"' + (m && m.genre === 'femme' ? ' selected' : '') + '>Femme</option><option value="homme"' + (m && m.genre === 'homme' ? ' selected' : '') + '>Homme</option></select></label>' +
      '<label class="fl" for="mq-naissance">Date de naissance<input id="mq-naissance" name="date_naissance" type="date" value="' + v('date_naissance') + '"></label>' +
      '<label class="fl" for="mq-tel">Téléphone (WhatsApp)<input id="mq-tel" name="telephone" type="tel" value="' + v('telephone') + '"></label>' +
      '<label class="fl" for="mq-mail">E-mail<input id="mq-mail" name="email" type="email" value="' + v('email') + '"></label>' +
      '<label class="fl" for="mq-entree">Date d’entrée à l’agence<input id="mq-entree" name="date_entree" type="date" value="' + P.esc((m && m.date_entree) || new Date().toISOString().slice(0, 10)) + '"></label>' +
      // (la mensualité ne change que par l'administrateur principal ; la base le vérifie aussi)
      '<label class="fl" for="mq-mensualite">Mensualité de formation<select id="mq-mensualite" name="mensualite"' + (principal || !m ? '' : ' disabled') + '>' +
      [10000, 20000].map((n) => '<option value="' + n + '"' + ((m ? m.mensualite : 10000) === n ? ' selected' : '') + '>' + P.fcfa(n) + '</option>').join('') + '</select></label>' +
      (m ? '<label class="fl" for="mq-statut">Statut<select id="mq-statut" name="statut">' + Object.keys(STATUTS).map((k) => '<option value="' + k + '"' + (m.statut === k ? ' selected' : '') + '>' + STATUTS[k] + '</option>').join('') + '</select></label>' : '') +
      '<h2>Parent ou responsable (obligatoire pour un mineur)</h2>' +
      '<label class="fl" for="mq-pnom">Nom du parent<input id="mq-pnom" name="parent_nom" value="' + v('parent_nom') + '"></label>' +
      '<label class="fl" for="mq-plien">Lien (mère, père, tuteur…)<input id="mq-plien" name="parent_lien" value="' + v('parent_lien') + '"></label>' +
      '<label class="fl" for="mq-ptel">Téléphone du parent<input id="mq-ptel" name="parent_telephone" type="tel" value="' + v('parent_telephone') + '"></label>' +
      '<label class="fl" for="mq-pmail">E-mail du parent<input id="mq-pmail" name="parent_email" type="email" value="' + v('parent_email') + '"></label>' +
      '<label class="fl large" for="mq-notes">Notes internes<textarea id="mq-notes" name="notes">' + v('notes') + '</textarea></label>';
  }
  // Données du formulaire → ligne du registre (contrôle du mineur sans parent)
  function lire(f, existant) {
    const t = (k) => String(f.get(k) || '').trim() || null;
    const ligne = { full_name: String(f.get('full_name') || '').trim().toUpperCase(), genre: t('genre'), date_naissance: t('date_naissance'),
      telephone: t('telephone'), email: t('email'), date_entree: t('date_entree') || undefined, parent_nom: t('parent_nom'), parent_lien: t('parent_lien'),
      parent_telephone: t('parent_telephone'), parent_email: t('parent_email'), notes: t('notes') };
    if (f.get('mensualite')) ligne.mensualite = Number(f.get('mensualite'));
    if (existant) ligne.statut = f.get('statut') || existant.statut;
    if (!ligne.full_name) throw new Error('Le nom est obligatoire.');
    const age = P.age(ligne.date_naissance);
    if (age !== null && age < 18 && !(ligne.parent_nom && (ligne.parent_telephone || ligne.parent_email))) {
      throw new Error('Mineur : le nom du parent et son téléphone (ou son e-mail) sont obligatoires.');
    }
    return ligne;
  }
  async function ajouter() {
    return P.entete('Ajouter un mannequin') + '<div class="note info">Pour un mannequin de l’agence qui n’a pas encore de compte sur le site. Ceux qui ont un compte sont déjà dans le registre.</div>' +
      '<form class="carte f" data-form="registre-ajouter">' + champs(null) + '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer</button></div></form>';
  }
  P.formulaires['registre-ajouter'] = async (f) => {
    try {
      const ligne = await P.bd(sb.from('agence_mannequins').insert(lire(f, null)).select().single());
      P.message('Mannequin ajouté au registre.');
      location.hash = '#/paiements/fiche/' + ligne.id;
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  // ---------- Fiche d'un mannequin ----------
  async function fiche(params) {
    const id = String((params && params[0]) || '');
    if (!/^[\w-]{1,64}$/.test(id)) { location.hash = '#/paiements/registre'; return ''; }
    const [m, paiements] = await Promise.all([
      P.bd(sb.from('agence_mannequins').select('*').eq('id', id).single()),
      P.bd(sb.from('paiements_mannequins').select('*').eq('mannequin_id', id).order('declare_le', { ascending: false }))
    ]);
    const inscription = paiements.find((p) => p.objet === 'inscription' && p.statut !== 'refuse') || null;
    const e = etatInscription(m, inscription);
    // Mannequin sans compte et sans paiement : l'agence enregistre le paiement de l'inscription
    // (cahier v2.4, 5.5) ; le bouton « Générer le code de l'espace » viendra ensuite (morceau 4).
    const actions = !m.user_id && !inscription
      ? '<div class="ligne"><button class="btn rouge" type="button" data-action="registre-inscription" data-mode="avant_systeme" data-id="' + m.id + '">Inscription déjà payée (avant le nouveau système)</button>' +
        '<button class="btn" type="button" data-action="registre-inscription" data-mode="especes" data-id="' + m.id + '">Paiement en espèces (' + P.fcfa(INSCRIPTION_FCFA) + ')</button></div>'
      : '';
    return P.entete(m.full_name, '<a class="btn" href="#/paiements/registre">Registre</a>') +
      '<div class="carte"><h2>Inscription</h2><p>' + P.pastille(e[0], e[1]) + '</p>' +
      (inscription ? '<p class="doux petit-texte">' + P.esc(MODES[inscription.mode]) + (inscription.montant ? ' · ' + P.fcfa(inscription.montant) : '') +
        (inscription.valide_le ? ' · validé le ' + P.dateHeure(inscription.valide_le) : '') + '</p>' : '') +
      (m.user_id ? '<p class="doux petit-texte">Ce mannequin a déjà son compte sur le site : aucun code à lui donner, on suit seulement ses mensualités.</p>' : '') +
      actions + '</div>' +
      '<form class="carte f" data-form="registre-modifier" data-id="' + m.id + '"><h2>Informations</h2>' + champs(m) +
      '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer les changements</button></div></form>' +
      '<div class="carte"><h2>Paiements</h2>' + P.tableau(['Objet', 'Mode', '#Montant', 'État', 'Date'], paiements.map((p) =>
        '<tr><td>' + (p.objet === 'inscription' ? 'Inscription' : 'Mensualité ' + P.esc(P.date(p.mois).slice(3))) + '</td><td>' + P.esc(MODES[p.mode]) + '</td>' +
        '<td class="nombre">' + (p.montant ? P.fcfa(p.montant) : '—') + '</td><td>' +
        P.pastille({ valide: 'Payé', declare: 'En attente de validation', refuse: 'Refusé' }[p.statut], { valide: 'ok', declare: 'alerte', refuse: 'erreur' }[p.statut]) +
        '</td><td>' + P.dateHeure(p.valide_le || p.declare_le) + '</td></tr>')) + '</div>';
  }
  P.formulaires['registre-modifier'] = async (f, form) => {
    try {
      const id = form.getAttribute('data-id');
      const avant = await P.bd(sb.from('agence_mannequins').select('*').eq('id', id).single());
      const ligne = lire(f, avant);
      if (ligne.mensualite === avant.mensualite || P.moi.role !== 'principal') delete ligne.mensualite;
      await P.bd(sb.from('agence_mannequins').update(ligne).eq('id', id));
      P.message('Changements enregistrés.');
      P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['registre-inscription'] = async (el) => {
    const especes = el.getAttribute('data-mode') === 'especes';
    if (!confirm(especes ? 'Enregistrer le paiement de l’inscription en espèces (' + P.fcfa(INSCRIPTION_FCFA) + '), reçu par l’agence ?'
      : 'Confirmer que ce mannequin a déjà payé son inscription avant le nouveau système ?')) return;
    try {
      const id = el.getAttribute('data-id');
      await P.bd(sb.from('paiements_mannequins').insert(especes
        ? [{ mannequin_id: id, objet: 'inscription', mode: 'especes', montant: DROIT_INSCRIPTION, statut: 'valide' },
          { mannequin_id: id, objet: 'mensualite', mois: moisCourant(), mode: 'especes', montant: PREMIER_MOIS, statut: 'valide' }]
        : { mannequin_id: id, objet: 'inscription', mode: 'avant_systeme', montant: null, statut: 'valide' }));
      P.message('Paiement de l’inscription enregistré.');
      P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  // ---------- Paiements à valider (cahier v2.4, 5.2) ----------
  // Après « J'ai payé » : orange. L'agence vérifie dans Wave Business puis valide (vert) ou refuse
  // avec un motif ; le mannequin (son parent s'il est mineur) en est prévenu par e-mail et WhatsApp.
  const libelleMois = (d) => { const p = String(d || '').split('-'); return p.length > 1 ? P.MOIS[Number(p[1]) - 1] + ' ' + p[0] : ''; };
  const objetPaiement = (p) => p.objet === 'inscription' ? 'Inscription' : 'Mensualité de ' + libelleMois(p.mois);
  async function aValider() {
    const liste = await P.bd(sb.from('paiements_mannequins').select('*, mannequin:agence_mannequins(full_name, telephone)')
      .eq('statut', 'declare').order('declare_le', { ascending: true }));
    // une inscription déclarée (15 000) et son 1er mois (10 000) : une seule ligne, 25 000
    const groupes = [];
    liste.forEach((p) => {
      const g = groupes.find((x) => x.mannequin_id === p.mannequin_id && x.declare_le === p.declare_le);
      if (g) { g.total += p.montant || 0; if (p.objet === 'inscription') g.principal = p; } else groupes.push({ mannequin_id: p.mannequin_id, declare_le: p.declare_le, principal: p, total: p.montant || 0 });
    });
    return P.entete('Paiements à valider', P.pastille(groupes.length + ' en attente', groupes.length ? 'alerte' : 'ok')) +
      '<div class="note info">Vérifiez chaque paiement dans Wave Business avant de valider. Le plus ancien est en haut.</div>' +
      P.tableau(['Mannequin', 'Objet', '#Montant', 'Déclaré le', ''], groupes.map((g) => {
        const p = g.principal;
        return '<tr><td><b>' + P.esc(p.mannequin ? p.mannequin.full_name : '—') + '</b><div class="petit-texte doux">' + P.esc((p.mannequin && p.mannequin.telephone) || '') + '</div></td>' +
          '<td>' + P.esc(objetPaiement(p)) + (p.objet === 'inscription' && g.total > (p.montant || 0) ? '<div class="petit-texte doux">dont 1er mois de formation</div>' : '') + '<div>' + P.pastille('En attente de validation', 'alerte') + '</div></td>' +
          '<td class="nombre">' + P.fcfa(g.total) + '</td><td>' + P.dateHeure(p.declare_le) + '</td>' +
          '<td class="ligne"><button class="btn rouge petit" type="button" data-action="paiement-valider" data-id="' + p.id + '">Valider</button>' +
          '<button class="btn petit" type="button" data-action="paiement-refuser" data-id="' + p.id + '">Refuser</button></td></tr>';
      }));
  }
  // Message au mannequin (au parent s'il est mineur) : e-mail envoyé tout de suite, WhatsApp en un geste
  function prevenir(r, valide, motif) {
    const mineur = P.age(r.date_naissance) !== null && P.age(r.date_naissance) < 18 && (r.parent_telephone || r.parent_email);
    const nom = mineur ? r.parent_nom || 'Madame, Monsieur' : r.nom;
    const quoi = (r.objet === 'inscription' ? 'l’inscription' : 'la mensualité de ' + libelleMois(r.mois)) + (mineur ? ' de ' + r.nom : '');
    const texte = 'Bonjour ' + nom + ',\n\n' + (valide
      ? 'Nous confirmons la réception de votre paiement de ' + P.fcfa(r.montant) + ' pour ' + quoi + '. Merci !'
      : 'Nous n’avons pas pu valider votre paiement pour ' + quoi + ' : ' + motif + '.\nMerci de nous contacter ou de refaire le paiement.') +
      '\n\nL’équipe Maître Akesse Model Management';
    const email = mineur ? r.parent_email : r.email, tel = mineur ? r.parent_telephone : r.telephone;
    let etatEmail = 'pas d’adresse e-mail';
    if (email && typeof envoyerEmailCandidat === 'function') {
      etatEmail = 'e-mail en cours d’envoi';
      Promise.resolve(envoyerEmailCandidat({ to_email: email, to_name: nom, message: texte }))
        .then(() => P.message('E-mail de ' + (valide ? 'confirmation' : 'refus') + ' envoyé à ' + email + '.'), () => P.message('L’e-mail n’a pas pu partir : envoyez le message par WhatsApp.'));
    }
    let chiffres = String(tel || '').replace(/\D/g, '');
    if ((chiffres.length === 10 && chiffres.charAt(0) === '0') || chiffres.length === 8) chiffres = '225' + chiffres;
    P.fenetre('<h2>' + (valide ? 'Paiement validé' : 'Paiement refusé') + '</h2><p class="doux">' + P.esc(r.nom) + ' · ' + P.fcfa(r.montant) + ' (' + P.esc(etatEmail) + ')</p>' +
      '<pre class="journal" style="white-space:pre-wrap">' + P.esc(texte) + '</pre><div class="ligne">' +
      (chiffres ? '<a class="btn rouge" target="_blank" rel="noopener" href="https://wa.me/' + chiffres + '?text=' + encodeURIComponent(texte) + '">Envoyer par WhatsApp</a>' : '<span class="doux">Pas de numéro WhatsApp dans le registre.</span>') +
      '<button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div>');
  }
  P.actions['paiement-valider'] = async (el) => {
    if (!confirm('Avez-vous retrouvé ce paiement dans Wave Business ? Il passera au vert chez vous et chez le mannequin.')) return;
    try {
      const r = await P.rpc('paiement_decider', { p_id: el.getAttribute('data-id'), p_valider: true });
      await P.afficher();
      prevenir(r, true);
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['paiement-refuser'] = async (el) => {
    const motif = (prompt('Motif du refus (obligatoire), par exemple « paiement introuvable dans Wave » :') || '').trim();
    if (!motif) return;
    try {
      const r = await P.rpc('paiement_decider', { p_id: el.getAttribute('data-id'), p_valider: false, p_motif: motif });
      await P.afficher();
      prevenir(r, false, motif);
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  P.espaces.paiements = {
    nav: [['a-valider', 'Paiements à valider'], ['registre', 'Registre des mannequins'], ['ajouter', 'Ajouter un mannequin']],
    pages: { 'a-valider': aValider, registre, ajouter, fiche },
    compteur: {},
    // nombre de paiements en attente, affiché dans le menu
    avant: async () => {
      // (une inscription et son 1er mois, déclarés ensemble, comptent pour un)
      const r = await sb.from('paiements_mannequins').select('mannequin_id, declare_le').eq('statut', 'declare');
      P.espaces.paiements.compteur['a-valider'] = r && !r.error ? new Set((r.data || []).map((x) => x.mannequin_id + x.declare_le)).size : 0;
    }
  };
})();
