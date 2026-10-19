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
  const FILTRES = [['tous', 'Tous'], ['site', 'Inscrits sur le site'], ['main', 'Ajoutés à la main'], ['non_paye', 'Inscription non payée'], ['sans_nom', 'Comptes sans nom']];
  // compte du site dont le nom n'a jamais été rempli (il se complète tout seul quand la mannequin le remplit)
  const sansNom = (m) => !m.full_name || m.full_name === 'Sans nom';
  async function registre() {
    const tous = await charger();
    const filtre = P.etat.filtreRegistre || 'tous', cherche = (P.etat.chercheRegistre || '').toLowerCase();
    const garde = (m) => (filtre === 'tous' || (filtre === 'site' && m.user_id) || (filtre === 'main' && !m.user_id) ||
      (filtre === 'non_paye' && etatInscription(m, m.inscription)[1] === 'erreur') || (filtre === 'sans_nom' && sansNom(m))) &&
      (!cherche || [m.full_name, m.telephone, m.email].join(' ').toLowerCase().includes(cherche));
    // ordre alphabétique, les comptes sans nom à la fin
    const liste = tous.filter(garde).sort((a, b) => (sansNom(a) - sansNom(b)) || String(a.full_name).localeCompare(String(b.full_name), 'fr', { sensitivity: 'base' }));
    const site = tous.filter((m) => m.user_id).length;
    return P.entete('Registre des mannequins', '<a class="btn rouge" href="#/paiements/ajouter">＋ Ajouter un mannequin</a>') +
      '<form class="ligne recherche-registre" data-form="registre-chercher"><label class="fl" for="rg-cherche" style="flex:1;min-width:200px">Retrouver un mannequin (nom, téléphone ou e-mail)' +
      '<input id="rg-cherche" name="cherche" type="search" autocomplete="off" placeholder="Ex. : Diarra" value="' + P.esc(P.etat.chercheRegistre || '') + '"></label><button class="btn rouge" type="submit">Rechercher</button>' +
      (cherche ? '<button class="btn" type="button" data-action="registre-tout">Tout afficher</button>' : '') + '</form>' +
      (cherche || filtre !== 'tous' ? '<p class="doux">' + liste.length + ' résultat(s)</p>' : '') +
      '<div class="grille chiffres">' + P.chiffre('Mannequins de l’agence', tous.length) + P.chiffre('Inscrits sur le site', site) +
      P.chiffre('Ajoutés à la main', tous.length - site) + P.chiffre('Inscription non payée', tous.filter((m) => etatInscription(m, m.inscription)[1] === 'erreur').length, 'rouge') + '</div>' +
      '<div class="segments">' + FILTRES.map((f) => '<button class="btn petit' + (f[0] === filtre ? ' actif' : '') + '" type="button" data-action="registre-filtre" data-filtre="' + f[0] + '">' + P.esc(f[1]) + '</button>').join('') + '</div>' +
      P.tableau(['Mannequin', 'Téléphone', 'Inscription', '#Mensualité', 'Statut', ''], liste.map((m) => {
        const e = etatInscription(m, m.inscription);
        return '<tr><td><b>' + P.esc(m.full_name) + '</b>' + (P.age(m.date_naissance) !== null && P.age(m.date_naissance) < 18 ? ' ' + P.pastille('Mineur', 'info') : '') +
          '<div class="petit-texte doux">' + (sansNom(m) ? 'Compte du site sans nom (il se complétera quand la mannequin remplira son espace) · ' + P.esc(m.email || '') : m.user_id ? 'Compte sur le site' : 'Ajouté à la main') + '</div></td>' +
          '<td>' + P.esc(m.telephone || '—') + '</td><td>' + P.pastille(e[0], e[1]) + '</td><td class="nombre">' + P.fcfa(m.mensualite) + '</td>' +
          '<td>' + P.pastille(STATUTS[m.statut], m.statut === 'actif' ? 'neutre' : 'alerte') + '</td>' +
          '<td><a class="btn petit" href="#/paiements/fiche/' + m.id + '">Ouvrir</a></td></tr>';
      }));
  }
  P.formulaires['registre-chercher'] = (f) => { P.etat.chercheRegistre = String(f.get('cherche')).trim(); P.afficher(); };
  // la liste se filtre pendant la frappe (« Rechercher » garde la recherche d'une page à l'autre)
  document.addEventListener('input', (e) => {
    if (e.target.id !== 'rg-cherche') return;
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#contenu .tableau tbody tr').forEach((tr) => { tr.hidden = !!q && !tr.textContent.toLowerCase().includes(q); });
  });
  P.actions['registre-tout'] = () => { P.etat.chercheRegistre = ''; P.etat.filtreRegistre = 'tous'; P.afficher(); };
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
    const [m, paiements, codes] = await Promise.all([
      P.bd(sb.from('agence_mannequins').select('*').eq('id', id).single()),
      P.bd(sb.from('paiements_mannequins').select('*').eq('mannequin_id', id).order('declare_le', { ascending: false })),
      P.bd(sb.from('codes_espace').select('*').eq('mannequin_id', id).eq('annule', false).is('utilise_le', null).order('cree_le', { ascending: false }))
    ]);
    const inscription = paiements.find((p) => p.objet === 'inscription' && p.statut !== 'refuse') || null;
    const e = etatInscription(m, inscription);
    // Mannequin sans compte et sans paiement : l'agence enregistre le paiement de l'inscription
    // (cahier v2.4, 5.5) ; le bouton « Générer le code de l'espace » viendra ensuite (morceau 4).
    const actions = !m.user_id && !inscription
      ? '<div class="ligne"><button class="btn rouge" type="button" data-action="registre-inscription" data-mode="avant_systeme" data-id="' + m.id + '">Inscription déjà payée (avant le nouveau système)</button>' +
        '<button class="btn" type="button" data-action="registre-inscription" data-mode="wave" data-id="' + m.id + '">Paiement Wave reçu en dehors du site (' + P.fcfa(INSCRIPTION_FCFA) + ')</button>' +
        '<button class="btn" type="button" data-action="registre-inscription" data-mode="especes" data-id="' + m.id + '">Paiement en espèces (' + P.fcfa(INSCRIPTION_FCFA) + ')</button></div>'
      : '';
    return P.entete(m.full_name, '<a class="btn" href="#/paiements/registre">Registre</a>') +
      '<div class="carte"><h2>Inscription</h2><p>' + P.pastille(e[0], e[1]) + '</p>' +
      (inscription ? '<p class="doux petit-texte">' + P.esc(MODES[inscription.mode]) + (inscription.montant ? ' · ' + P.fcfa(inscription.montant) : '') +
        (inscription.valide_le ? ' · validé le ' + P.dateHeure(inscription.valide_le) : '') + '</p>' : '') +
      (m.user_id ? '<p class="doux petit-texte">Ce mannequin a déjà son compte sur le site : aucun code à lui donner, on suit seulement ses mensualités.</p>' : '') +
      actions + '</div>' + carteCodeEspace(m, inscription, codes[0]) +
      '<form class="carte f" data-form="registre-modifier" data-id="' + m.id + '"><h2>Informations</h2>' + champs(m) +
      '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer les changements</button></div></form>' +
      '<div class="carte"><h2>Paiements</h2>' + P.tableau(['Objet', 'Mode', '#Montant', 'État', 'Date', ''], paiements.map((p) =>
        '<tr><td>' + (p.objet === 'inscription' ? 'Inscription' : 'Mensualité ' + P.esc(P.date(p.mois).slice(3))) + '</td><td>' + P.esc(MODES[p.mode]) + '</td>' +
        '<td class="nombre">' + (p.montant ? P.fcfa(p.montant) : '—') + '</td><td>' +
        P.pastille({ valide: 'Payé', declare: 'En attente de validation', refuse: 'Refusé ou annulé' }[p.statut], { valide: 'ok', declare: 'alerte', refuse: 'erreur' }[p.statut]) +
        (p.statut === 'refuse' && p.motif ? '<div class="petit-texte doux">' + P.esc(p.motif) + '</div>' : '') +
        '</td><td>' + P.dateHeure(p.valide_le || p.declare_le) + '</td><td>' +
        (P.moi.role === 'principal' && p.statut === 'valide' ? '<button class="btn petit" type="button" data-action="paiement-annuler" data-id="' + p.id + '">Annuler (erreur)</button>' : '') + '</td></tr>')) +
      // mensualité reçue par l'agence (Wave en dehors du site ou espèces) : validée tout de suite
      (m.statut === 'actif' ? '<form class="f" data-form="mensualite-enregistrer" data-id="' + m.id + '" style="margin-top:14px"><h2>Enregistrer une mensualité reçue par l’agence</h2>' +
        '<label class="fl" for="mz-mois">Mois<select id="mz-mois" name="mois">' + listeMois().map((x) => '<option value="' + x + '"' + (x === moisCourant() ? ' selected' : '') + '>' + P.esc(libelleMois(x)) + '</option>').join('') + '</select></label>' +
        '<label class="fl" for="mz-mode">Moyen<select id="mz-mode" name="mode"><option value="wave">Wave reçu en dehors du site</option><option value="especes">Espèces</option></select></label>' +
        '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer ' + P.fcfa(m.mensualite) + '</button></div></form>' : '') + '</div>';
  }
  // 6 mois passés, le mois en cours et 3 mois d'avance
  function listeMois() {
    const d = new Date(), l = [];
    for (let i = -6; i <= 3; i++) { const x = new Date(d.getFullYear(), d.getMonth() + i, 1); l.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-01'); }
    return l;
  }
  P.formulaires['mensualite-enregistrer'] = async (f, form) => {
    const id = form.getAttribute('data-id');
    try {
      const m = await P.bd(sb.from('agence_mannequins').select('mensualite').eq('id', id).single());
      if (!confirm('Enregistrer la mensualité de ' + libelleMois(f.get('mois')) + ' (' + P.fcfa(m.mensualite) + '), reçue par l’agence ?')) return;
      await P.bd(sb.from('paiements_mannequins').insert({ mannequin_id: id, objet: 'mensualite', mois: f.get('mois'), mode: f.get('mode'), montant: m.mensualite, statut: 'valide' }));
      P.message('Mensualité enregistrée.');
      P.afficher();
    } catch (e) { P.message(/duplicate|unique/i.test(String(e && e.message)) ? 'Ce mois est déjà payé ou en attente de validation.' : P.erreurTexte(e)); }
  };
  // Code de l'espace mannequin (cahier v2.4, 5.4) : seulement après une inscription payée et
  // validée, pour un mannequin sans compte ; une fois, 7 jours ; remplace le code général
  const SITE = 'https://www.maitreakessemodelmanagement.com';
  function carteCodeEspace(m, inscription, code) {
    if (m.user_id) return '';
    const titre = '<h2>Code de l’espace mannequin</h2>';
    if (!inscription || inscription.statut !== 'valide') {
      return '<div class="carte">' + titre + '<p class="doux">Le code se génère après la validation du paiement de l’inscription.</p></div>';
    }
    const valable = code && new Date(code.expire_le) > new Date();
    if (!valable) {
      return '<div class="carte">' + titre + (code ? '<p class="doux">Le code ' + P.esc(code.code) + ' a expiré le ' + P.dateHeure(code.expire_le) + '.</p>' : '') +
        '<p class="doux">Le mannequin s’en servira pour créer son espace (e-mail, mot de passe et ce code). Il ne sert qu’une fois et reste valable 7 jours.</p>' +
        '<div class="ligne"><button class="btn rouge" type="button" data-action="code-espace" data-id="' + m.id + '">Générer le code de l’espace</button></div></div>';
    }
    const d = destinataire(m);
    const texte = 'Bonjour ' + d.nom + ',\n\nL’inscription' + (d.mineur ? ' de ' + m.full_name : '') + ' à Maître Akesse Model Management est validée. ' +
      'Pour créer ' + (d.mineur ? 'son' : 'votre') + ' espace mannequin, ouvrez ' + SITE + '/espace-mannequin.html, choisissez « Créer mon compte » et entrez ce code personnel : ' + code.code +
      '\n\nIl ne sert qu’une fois et reste valable jusqu’au ' + P.dateHeure(code.expire_le) + '.\n\nL’équipe Maître Akesse Model Management';
    const wa = lienWhatsApp(d.tel, texte);
    return '<div class="carte">' + titre + '<p><b id="code-espace-texte" style="font-size:20px;letter-spacing:1px">' + P.esc(code.code) + '</b></p>' +
      '<p class="doux petit-texte">Valable jusqu’au ' + P.dateHeure(code.expire_le) + ', une seule fois. Il disparaîtra dès que le compte sera créé.</p>' +
      '<div class="ligne"><button class="btn" type="button" data-action="code-espace-copier">Copier</button>' +
      (wa ? '<a class="btn rouge" id="code-espace-whatsapp" target="_blank" rel="noopener" href="' + P.esc(wa) + '">Envoyer par WhatsApp</a>' : '') +
      '<button class="btn" type="button" data-action="code-espace" data-id="' + m.id + '">Générer un nouveau code</button></div></div>';
  }
  P.actions['code-espace'] = async (el) => {
    if (el.textContent.indexOf('nouveau') !== -1 && !confirm('Générer un nouveau code ? L’ancien ne marchera plus.')) return;
    try {
      await P.rpc('code_espace_creer', { p_mannequin: el.getAttribute('data-id') });
      P.message('Code de l’espace créé : envoyez-le au mannequin.');
      P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['code-espace-copier'] = (el) => {
    const texte = document.getElementById('code-espace-texte').textContent;
    navigator.clipboard.writeText(texte).then(() => { el.textContent = 'Copié !'; }, () => { el.textContent = 'Sélectionnez le code pour le copier'; });
  };

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
  // Inscription payée sans passer par le site : avant le nouveau système, en espèces, ou par Wave
  // directement à l'agence (paiement reçu par l'agence, donc validé tout de suite)
  P.actions['registre-inscription'] = async (el) => {
    const mode = el.getAttribute('data-mode');
    if (!confirm({ especes: 'Enregistrer le paiement de l’inscription en espèces (' + P.fcfa(INSCRIPTION_FCFA) + '), reçu par l’agence ?',
      wave: 'Enregistrer le paiement Wave de l’inscription (' + P.fcfa(INSCRIPTION_FCFA) + '), reçu par l’agence en dehors du site ?',
      avant_systeme: 'Confirmer que ce mannequin a déjà payé son inscription avant le nouveau système ?' }[mode])) return;
    try {
      const id = el.getAttribute('data-id');
      await P.bd(sb.from('paiements_mannequins').insert(mode === 'avant_systeme'
        ? { mannequin_id: id, objet: 'inscription', mode, montant: null, statut: 'valide' }
        : [{ mannequin_id: id, objet: 'inscription', mode, montant: DROIT_INSCRIPTION, statut: 'valide' },
          { mannequin_id: id, objet: 'mensualite', mois: moisCourant(), mode, montant: PREMIER_MOIS, statut: 'valide' }]));
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
    const [liste, recents] = await Promise.all([
      P.bd(sb.from('paiements_mannequins').select('*, mannequin:agence_mannequins(full_name, telephone)')
        .eq('statut', 'declare').order('declare_le', { ascending: true })),
      // (19/10/2026) un paiement enregistré par l'agence est validé tout de suite : on le montre ici aussi
      P.bd(sb.from('paiements_mannequins').select('*, mannequin:agence_mannequins(full_name)').eq('statut', 'valide')
        .gte('valide_le', new Date(Date.now() - 7 * 864e5).toISOString()).order('valide_le', { ascending: false }).limit(50))
    ]);
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
      })) +
      '<div class="carte" style="margin-top:18px"><h2>Paiements validés ces 7 derniers jours</h2>' +
      '<p class="doux petit-texte">Ceux que vous enregistrez vous-même (Wave reçu en dehors du site, espèces, avant le nouveau système) sont validés tout de suite : ils apparaissent ici et en vert sur la fiche.</p>' +
      P.tableau(['Mannequin', 'Objet', 'Mode', '#Montant', 'Validé le'], recents.map((p) =>
        '<tr><td><a href="#/paiements/fiche/' + p.mannequin_id + '"><b>' + P.esc(p.mannequin ? p.mannequin.full_name : '—') + '</b></a></td><td>' + P.esc(objetPaiement(p)) + '</td>' +
        '<td>' + P.esc(MODES[p.mode] || p.mode) + '</td><td class="nombre">' + (p.montant ? P.fcfa(p.montant) : '—') + '</td><td>' + P.dateHeure(p.valide_le) + '</td></tr>')) + '</div>';
  }
  // Destinataire des messages : le parent pour un mineur, la personne elle-même sinon
  // (r : ligne du registre, ou réponse de paiement_decider avec « nom »)
  function destinataire(r) {
    const mineur = !!(P.age(r.date_naissance) !== null && P.age(r.date_naissance) < 18 && (r.parent_telephone || r.parent_email));
    return { mineur, nom: mineur ? r.parent_nom || 'Madame, Monsieur' : (r.nom || r.full_name), email: mineur ? r.parent_email : r.email, tel: mineur ? r.parent_telephone : r.telephone };
  }
  function lienWhatsApp(tel, texte) {
    const n = window.numeroWhatsAppMa2m(tel);  // js/messages-mensualites.js
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(texte) : null;
  }
  // Message au mannequin (au parent s'il est mineur) : e-mail envoyé tout de suite, WhatsApp en un geste
  function prevenir(r, valide, motif) {
    const d = destinataire(r), mineur = d.mineur, nom = d.nom;
    const quoi = (r.objet === 'inscription' ? 'l’inscription' : 'la mensualité de ' + libelleMois(r.mois)) + (mineur ? ' de ' + r.nom : '');
    const texte = 'Bonjour ' + nom + ',\n\n' + (valide
      ? 'Nous confirmons la réception de votre paiement de ' + P.fcfa(r.montant) + ' pour ' + quoi + '. Merci !'
      : 'Nous n’avons pas pu valider votre paiement pour ' + quoi + ' : ' + motif + '.\nMerci de nous contacter ou de refaire le paiement.') +
      '\n\nL’équipe Maître Akesse Model Management';
    const email = d.email, wa = lienWhatsApp(d.tel, texte);
    let etatEmail = 'pas d’adresse e-mail';
    if (email && typeof envoyerEmailCandidat === 'function') {
      etatEmail = 'e-mail en cours d’envoi';
      Promise.resolve(envoyerEmailCandidat({ to_email: email, to_name: nom, message: texte }))
        .then(() => P.message('E-mail de ' + (valide ? 'confirmation' : 'refus') + ' envoyé à ' + email + '.'), () => P.message('L’e-mail n’a pas pu partir : envoyez le message par WhatsApp.'));
    }
    P.fenetre('<h2>' + (valide ? 'Paiement validé' : 'Paiement refusé') + '</h2><p class="doux">' + P.esc(r.nom) + ' · ' + P.fcfa(r.montant) + ' (' + P.esc(etatEmail) + ')</p>' +
      '<pre class="journal" style="white-space:pre-wrap">' + P.esc(texte) + '</pre><div class="ligne">' +
      (wa ? '<a class="btn rouge" target="_blank" rel="noopener" href="' + P.esc(wa) + '">Envoyer par WhatsApp</a>' : '<span class="doux">Pas de numéro WhatsApp dans le registre.</span>') +
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
  // Paiement enregistré par erreur (mauvais mois, mauvais mannequin…) : annulé avec un motif par
  // l'administrateur principal (code récent demandé) ; il reste visible, et sa recette en
  // comptabilité est annulée toute seule. On peut ensuite enregistrer le bon.
  P.actions['paiement-annuler'] = async (el) => {
    const motif = (prompt('Annuler ce paiement enregistré par erreur ? Il restera visible, barré.\nMotif (obligatoire) :') || '').trim();
    if (!motif) return;
    try {
      await P.sensible(() => P.bd(sb.from('paiements_mannequins').update({ statut: 'refuse', motif: 'Annulé : ' + motif }).eq('id', el.getAttribute('data-id')).select('id')));
      await P.afficher();
      P.message('Paiement annulé. Vous pouvez enregistrer le bon.');
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

  // ---------- Mensualités (cahier v2.4, 5.6 ; choix du 19/10/2026) ----------
  // Le 1er : appel aux mannequins actifs cochés (on décoche ceux qui ne paient plus). Le 3 et le 5 :
  // relances e-mail automatiques (serveur) et ici la liste WhatsApp prête. Messages communs :
  // js/messages-mensualites.js. Couleurs : vert payé, orange en attente, rouge non payé (après le 5).
  const ETATS = { paye: ['Payé', 'ok'], attente: ['En attente de validation', 'alerte'], non_paye: ['Non payé', 'erreur'], a_payer: ['À payer avant le 5', 'info'], a_venir: ['À venir', 'neutre'] };
  async function mensualites() {
    const mois = moisCourant();
    const [actifs, paiements, appels] = await Promise.all([
      P.bd(sb.from('agence_mannequins').select('*').eq('statut', 'actif').order('full_name')),
      P.bd(sb.from('paiements_mannequins').select('mannequin_id, statut').eq('objet', 'mensualite').eq('mois', mois).neq('statut', 'refuse')),
      P.bd(sb.from('mensualites_appels').select('*').eq('mois', mois))
    ]);
    const jour = new Date().getDate();
    const etat = (m) => {
      const p = paiements.find((x) => x.mannequin_id === m.id);
      return p ? (p.statut === 'valide' ? 'paye' : 'attente') : jour > 5 ? 'non_paye' : 'a_payer';
    };
    const appele = (m) => appels.find((a) => a.mannequin_id === m.id);
    const compte = (e) => actifs.filter((m) => etat(m) === e).length;
    P.etat.mensualites = { actifs, etat, appele };
    const relance = jour >= 5 ? 'relance5' : jour >= 3 ? 'relance3' : null;
    return P.entete('Mensualités · ' + libelleMois(mois)) +
      '<div class="grille chiffres">' + P.chiffre('Payé', compte('paye'), 'vert') + P.chiffre('En attente de validation', compte('attente'), 'orange') +
      P.chiffre(jour > 5 ? 'Non payé' : 'À payer avant le 5', compte('non_paye') + compte('a_payer'), 'rouge') + '</div>' +
      '<div class="note info">Le 1er : cochez les mannequins à appeler (décochez ceux qui ne paient plus), puis envoyez l’appel. Le 3 et le 5, les relances partent toutes seules par e-mail aux personnes appelées qui n’ont pas payé ; pour WhatsApp, utilisez « Relances WhatsApp ». Un mannequin qui ne paie plus : passez sa fiche en « Suspendu » ou « Sorti ».</div>' +
      '<form data-form="mensualites-appel" class="carte"><h2>Appel du mois</h2>' +
      P.tableau(['', 'Mannequin', '#Mensualité', 'Ce mois', 'Appel'], actifs.map((m) => {
        const e = etat(m), a = appele(m), coche = !a && (e === 'a_payer' || e === 'non_paye');
        return '<tr><td><input type="checkbox" name="ids" value="' + m.id + '" aria-label="Appeler ' + P.esc(m.full_name) + '"' + (coche ? ' checked' : '') + (a || e === 'paye' || e === 'attente' ? ' disabled' : '') + '></td>' +
          '<td><a href="#/paiements/fiche/' + m.id + '"><b>' + P.esc(m.full_name) + '</b></a></td><td class="nombre">' + P.fcfa(m.mensualite) + '</td>' +
          '<td>' + P.pastille(ETATS[e][0], ETATS[e][1]) + '</td><td class="petit-texte">' + (a ? 'envoyé le ' + P.dateHeure(a.appel_le) + (a.relance3_le ? ' · relancé le 3' : '') + (a.relance5_le ? ' · relancé le 5' : '') : '—') + '</td></tr>';
      })) + '<div class="ligne" style="margin-top:12px"><button class="btn rouge" type="submit">Envoyer l’appel aux personnes cochées</button>' +
      (relance ? '<button class="btn" type="button" data-action="mensualites-whatsapp" data-type="' + relance + '">Relances WhatsApp (' + (relance === 'relance5' ? 'dernière relance' : 'relance du 3') + ')</button>' : '') + '</div></form>';
  }
  // File d'envoi WhatsApp : un lien par personne, envoyé en un geste chacun
  function fileWhatsApp(titre, personnes, type) {
    const lignes = personnes.map((m) => {
      const msg = window.messageMensualite(m, type, new Date());
      const wa = lienWhatsApp(msg.telephone, msg.texte);
      return '<tr><td><b>' + P.esc(m.full_name || m.nom) + '</b></td><td>' + (wa ? '<a class="btn rouge petit" target="_blank" rel="noopener" href="' + P.esc(wa) + '">Envoyer</a>' : '<span class="doux">pas de numéro</span>') + '</td></tr>';
    });
    P.fenetre('<h2>' + P.esc(titre) + '</h2>' + P.tableau(['Mannequin', 'WhatsApp'], lignes) +
      '<div class="ligne" style="margin-top:12px"><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div>');
  }
  P.formulaires['mensualites-appel'] = async (f) => {
    const ids = f.getAll('ids');
    if (!ids.length) return P.message('Cochez au moins une personne.');
    if (!confirm('Envoyer l’appel du mois à ' + ids.length + ' personne(s) ?')) return;
    try {
      const liste = await P.rpc('mensualites_appeler', { p_mois: moisCourant(), p_ids: ids });
      let envoyes = 0;
      await Promise.all(liste.map((m) => {
        const msg = window.messageMensualite(m, 'appel', new Date());
        if (!msg.email || typeof envoyerEmailCandidat !== 'function') return null;
        return Promise.resolve(envoyerEmailCandidat({ to_email: msg.email, to_name: msg.nom, message: msg.texte })).then(() => { envoyes++; }, () => { /* compté comme non envoyé */ });
      }));
      await P.afficher();
      P.message(envoyes + ' e-mail(s) envoyé(s) sur ' + liste.length + '. Envoyez maintenant les messages WhatsApp.');
      fileWhatsApp('Appel du mois — WhatsApp', liste, 'appel');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['mensualites-whatsapp'] = (el) => {
    const e = P.etat.mensualites;
    if (!e) return;
    const type = el.getAttribute('data-type');
    fileWhatsApp(type === 'relance5' ? 'Dernière relance — WhatsApp' : 'Relance du 3 — WhatsApp',
      e.actifs.filter((m) => e.appele(m) && ['a_payer', 'non_paye'].includes(e.etat(m))), type);
  };

  P.espaces.paiements = {
    nav: [['a-valider', 'Paiements à valider'], ['mensualites', 'Mensualités du mois'], ['registre', 'Registre des mannequins'], ['ajouter', 'Ajouter un mannequin']],
    pages: { 'a-valider': aValider, mensualites, registre, ajouter, fiche },
    compteur: {},
    // nombre de paiements en attente, affiché dans le menu
    avant: async () => {
      // (une inscription et son 1er mois, déclarés ensemble, comptent pour un)
      const r = await sb.from('paiements_mannequins').select('mannequin_id, declare_le').eq('statut', 'declare');
      P.espaces.paiements.compteur['a-valider'] = r && !r.error ? new Set((r.data || []).map((x) => x.mannequin_id + x.declare_le)).size : 0;
    }
  };
})();
