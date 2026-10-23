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
    if (!paiement) return ['Inscription à enregistrer', 'erreur'];  // (aucun paiement noté : à régulariser dans la fiche)
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

  // Nom d'une mannequin = lien vers sa fiche ; l'Administration y ajoute sa photo en médaillon,
  // cliquable elle aussi (visagesDesFiches, js/admin/coque.js ; demande de la propriétaire, 22/10/2026)
  // (compte : son compte du site s'il est connu — la photo se trouve alors sans recherche de plus)
  P.lienFiche = (id, nom, compte) => (id ? '<a href="#/paiements/fiche/' + P.esc(id) + '"' + (compte ? ' data-compte="' + P.esc(compte) + '"' : '') + '><b>' + P.esc(nom || '—') + '</b></a>' : '<b>' + P.esc(nom || '—') + '</b>');

  // ---------- Registre ----------
  const FILTRES = [['tous', 'Tous'], ['site', 'Inscrits sur le site'], ['main', 'Ajoutés à la main'], ['non_paye', 'Inscription à enregistrer'], ['sans_nom', 'Sans nom']];
  // compte créé sur le site sans nom rempli : le registre l'a repris sous « Sans nom »
  const sansNom = (m) => /^sans nom$/i.test(String(m.full_name || '').trim());
  async function registre() {
    const tous = await charger();
    const filtre = P.etat.filtreRegistre || 'tous', cherche = (P.etat.chercheRegistre || '').toLowerCase();
    const garde = (m) => (filtre === 'tous' || (filtre === 'site' && m.user_id) || (filtre === 'main' && !m.user_id) ||
      (filtre === 'non_paye' && etatInscription(m, m.inscription)[1] === 'erreur') || (filtre === 'sans_nom' && sansNom(m))) &&
      (!cherche || [m.full_name, m.telephone, m.email].join(' ').toLowerCase().includes(cherche));
    const liste = tous.filter(garde);
    const site = tous.filter((m) => m.user_id).length;
    return P.entete('Registre des mannequins', '<a class="btn rouge" href="#/paiements/ajouter">＋ Ajouter un mannequin</a>') +
      '<p class="doux petit-texte">Ici : tous les mannequins en formation à l’agence, pour les inscriptions et les mensualités, qu’ils soient publiés dans The Book du site ou non.</p>' +
      '<div class="grille chiffres">' + P.chiffre('Mannequins de l’agence', tous.length) + P.chiffre('Inscrits sur le site', site) +
      P.chiffre('Ajoutés à la main', tous.length - site) + P.chiffre('Inscription à enregistrer', tous.filter((m) => etatInscription(m, m.inscription)[1] === 'erreur').length, 'rouge') +
      (tous.some(sansNom) ? P.chiffre('Sans nom', tous.filter(sansNom).length, 'orange') : '') + '</div>' +
      (tous.some(sansNom) ? '<div class="note info">« Sans nom » : des comptes créés sur le site sans nom rempli. Ouvrez la fiche pour voir leur e-mail et téléphone, et compléter le nom. Rien ne se supprime : si ce n’est pas un vrai mannequin, proposez sa sortie dans « Sorties et suspensions ».</div>' : '') +
      '<form class="ligne" data-form="registre-chercher"><label class="fl" for="rg-cherche" style="flex:1;min-width:200px">Rechercher (nom, téléphone, e-mail)' +
      '<input id="rg-cherche" name="cherche" value="' + P.esc(P.etat.chercheRegistre || '') + '"></label><button class="btn" type="submit">Rechercher</button></form>' +
      '<div class="segments">' + FILTRES.map((f) => '<button class="btn petit' + (f[0] === filtre ? ' actif' : '') + '" type="button" data-action="registre-filtre" data-filtre="' + f[0] + '">' + P.esc(f[1]) + '</button>').join('') + '</div>' +
      P.tableau(['Mannequin', 'Téléphone', 'Inscription', '#Mensualité', 'Statut', ''], liste.map((m) => {
        const e = etatInscription(m, m.inscription);
        return '<tr><td>' + P.lienFiche(m.id, m.full_name, m.user_id) + (P.age(m.date_naissance) !== null && P.age(m.date_naissance) < 18 ? ' ' + P.pastille('Mineur', 'info') : '') +
          '<div class="petit-texte doux">' + (m.user_id ? 'Compte sur le site' : 'Ajouté à la main') + '</div></td>' +
          '<td>' + P.esc(m.telephone || '—') + (sansNom(m) && m.email ? '<div class="petit-texte doux">' + P.esc(m.email) + '</div>' : '') + '</td><td>' + P.pastille(e[0], e[1]) + '</td><td class="nombre">' + P.fcfa(m.mensualite) + '</td>' +
          '<td>' + P.pastille(STATUTS[m.statut], m.statut === 'actif' ? 'neutre' : 'alerte') + '</td>' +
          '<td><div class="ligne"><a class="btn petit" href="#/paiements/fiche/' + m.id + '">Ouvrir</a>' +
          (P.moi.role === 'principal' && !m.user_id && e[1] === 'erreur' ? '<button class="btn petit" type="button" data-action="mannequin-supprimer" data-id="' + m.id + '" aria-label="Supprimer ' + P.esc(m.full_name) + '">Supprimer</button>' : '') + '</div></td></tr>';
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
      (m ? '<label class="fl" for="mq-statut">Statut (pour suspendre ou faire sortir : page « Sorties et suspensions »)<select id="mq-statut" name="statut" disabled>' + Object.keys(STATUTS).map((k) => '<option value="' + k + '"' + (m.statut === k ? ' selected' : '') + '>' + STATUTS[k] + '</option>').join('') + '</select></label>' : '') +
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
      // il entre dans le suivi tout de suite (sans effet tant que le fichier SQL du suivi n'est pas exécuté)
      if (!P.etat.suiviAbsent) await sb.from('agence_mannequins').update({ suivi: true }).eq('id', ligne.id).then(() => null, () => null);
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
    const principal = P.moi.role === 'principal';
    const e = etatInscription(m, inscription);
    // Mannequin sans compte et sans paiement : l'agence enregistre le paiement de l'inscription
    // (cahier v2.4, 5.5) ; le bouton « Générer le code de l'espace » viendra ensuite (morceau 4).
    const actions = !m.user_id && !inscription
      ? '<div class="ligne"><button class="btn rouge" type="button" data-action="registre-inscription" data-mode="avant_systeme" data-id="' + m.id + '">Inscription déjà payée (avant le nouveau système)</button>' +
        '<button class="btn" type="button" data-action="registre-inscription" data-mode="wave" data-id="' + m.id + '">Paiement Wave reçu en dehors du site (' + P.fcfa(INSCRIPTION_FCFA) + ')</button>' +
        '<button class="btn" type="button" data-action="registre-inscription" data-mode="especes" data-id="' + m.id + '">Paiement en espèces (' + P.fcfa(INSCRIPTION_FCFA) + ')</button></div>'
      : '';
    return P.entete(m.full_name, '<a class="btn" href="#/paiements/registre">Registre</a>', '<span class="titre-visage" data-visage-registre="' + P.esc(m.id) + '" data-nom="' + P.esc(m.full_name) + '"></span>') +
      '<div class="carte"><h2>Inscription</h2><p>' + P.pastille(e[0], e[1]) + '</p>' +
      (inscription ? '<p class="doux petit-texte">' + P.esc(MODES[inscription.mode]) + (inscription.montant ? ' · ' + P.fcfa(inscription.montant) : '') +
        (inscription.valide_le ? ' · validé le ' + P.dateHeure(inscription.valide_le) : '') + '</p>' : '') +
      (m.user_id ? '<p class="doux petit-texte">Ce mannequin a déjà son compte sur le site : aucun code à lui donner, on suit seulement ses mensualités.</p>' : '') +
      actions + '</div>' + carteCodeEspace(m, inscription, codes[0]) +
      (principal && !m.user_id && !paiements.some((p) => p.statut === 'valide')
        ? '<div class="carte"><h2>Supprimer ce mannequin</h2><p class="doux">Pour un essai ou une erreur seulement. La fiche et ses paiements non validés disparaissent pour toujours. S’il a vraiment été mannequin de l’agence, proposez plutôt sa sortie.</p><button class="btn rouge" type="button" data-action="mannequin-supprimer" data-id="' + m.id + '">Supprimer définitivement</button></div>' : '') +
      '<form class="carte f" data-form="registre-modifier" data-id="' + m.id + '"><h2>Informations</h2>' + champs(m) +
      '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer les changements</button></div></form>' +
      '<div class="carte"><h2>Paiements</h2>' + P.tableau(['Objet', 'Mode', '#Montant', 'État', 'Date'].concat(principal ? [''] : []), paiements.map((p) =>
        '<tr' + (p.statut === 'refuse' ? ' class="annulee"' : '') + '><td>' + (p.objet === 'inscription' ? 'Inscription' : 'Mensualité ' + P.esc(P.date(p.mois).slice(3))) + '</td><td>' + P.esc(MODES[p.mode]) + '</td>' +
        '<td class="nombre">' + (p.montant ? P.fcfa(p.montant) : '—') + '</td><td>' +
        P.pastille(p.statut === 'refuse' && /^Annulé/.test(p.motif || '') ? 'Annulé' : { valide: 'Payé', declare: 'En attente de validation', refuse: 'Refusé' }[p.statut], { valide: 'ok', declare: 'alerte', refuse: 'erreur' }[p.statut]) +
        (p.motif && p.statut === 'refuse' ? '<div class="petit-texte doux">' + P.esc(p.motif) + '</div>' : '') +
        '</td><td>' + P.dateHeure(p.valide_le || p.declare_le) + '</td>' +
        (principal ? '<td>' + (p.statut !== 'refuse' ? '<div class="ligne"><button class="btn petit" type="button" data-action="paiement-corriger" data-id="' + p.id + '" data-montant="' + (p.montant || '') + '" data-mode="' + p.mode + '">Corriger</button>' +
          '<button class="btn petit" type="button" data-action="paiement-annuler" data-id="' + p.id + '">Annuler</button></div>' : '') + '</td>' : '') + '</tr>')) +
      (principal ? '<p class="doux petit-texte">Une erreur de mois : annulez le paiement du mauvais mois, puis enregistrez-le sur le bon mois ci-dessous. Chaque correction est notée dans le journal ; la comptabilité se met à jour toute seule.</p>'
        : '<p class="doux petit-texte">Pour corriger ou annuler un paiement déjà enregistré, demandez à l’administrateur principal.</p>') +
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
  // Message au mannequin (au parent s'il est mineur) avec son code personnel + lien WhatsApp prêt
  function messageCodeEspace(m, code) {
    const d = destinataire(m);
    const texte = 'Bonjour ' + d.nom + ',\n\nL’inscription' + (d.mineur ? ' de ' + m.full_name : '') + ' à Maître Akesse Model Management est validée. ' +
      'Pour créer ' + (d.mineur ? 'son' : 'votre') + ' espace mannequin, ouvrez ' + SITE + '/espace-mannequin.html, choisissez « Créer mon compte » et entrez ce code personnel : ' + code.code +
      '\n\nIl ne sert qu’une fois et reste valable jusqu’au ' + P.dateHeure(code.expire_le) + '.\n\nL’équipe Maître Akesse Model Management';
    return { texte, wa: lienWhatsApp(d.tel, texte), d };
  }
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
    const wa = messageCodeEspace(m, code).wa;
    return '<div class="carte">' + titre + '<p><b id="code-espace-texte" style="font-size:20px;letter-spacing:1px">' + P.esc(code.code) + '</b></p>' +
      '<p class="doux petit-texte">Valable jusqu’au ' + P.dateHeure(code.expire_le) + ', une seule fois. Il disparaîtra dès que le compte sera créé.</p>' +
      '<div class="ligne"><button class="btn" type="button" data-action="code-espace-copier" data-code="' + P.esc(code.code) + '">Copier</button>' +
      (wa ? '<a class="btn rouge" id="code-espace-whatsapp" target="_blank" rel="noopener" href="' + P.esc(wa) + '">Envoyer par WhatsApp</a>' : '') +
      '<button class="btn" type="button" data-action="code-espace" data-id="' + m.id + '">Générer un nouveau code</button></div></div>';
  }
  P.actions['code-espace'] = async (el) => {
    if (/nouveau/i.test(el.textContent) && !confirm('Générer un nouveau code ? L’ancien ne marchera plus.')) return;
    try {
      await P.rpc('code_espace_creer', { p_mannequin: el.getAttribute('data-id') });
      P.message('Code de l’espace créé : envoyez-le au mannequin.');
      P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['code-espace-copier'] = (el) => {
    const texte = el.getAttribute('data-code') || document.getElementById('code-espace-texte').textContent;
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
  P.actions['mannequin-supprimer'] = async (el) => {
    if (!confirm('Supprimer définitivement ce mannequin ? Cette action ne peut pas être annulée.')) return;
    try {
      await P.sensible(() => P.rpc('mannequin_supprimer', { p_mannequin: el.getAttribute('data-id') }));
      P.message('Mannequin supprimé.'); if (/^#\/paiements\/fiche/.test(location.hash)) location.hash = '#/paiements/registre'; else await P.afficher();
    } catch (e) {
      P.message(e && (e.code === 'PGRST202' || e.status === 404) ? 'La suppression n’est pas encore activée (étape d’installation : fichier de suppression à exécuter dans la base).' : P.erreurTexte(e));
    }
  };
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

  // Corriger ou annuler un paiement déjà enregistré (administrateur principal, code récent : la base
  // le vérifie). Rien ne s'efface : un paiement annulé reste dans la liste avec son motif ; la recette
  // de la comptabilité est annulée et remplacée par la base (compta_depuis_espace2).
  P.actions['paiement-corriger'] = (el) => {
    const montant = el.getAttribute('data-montant'), mode = el.getAttribute('data-mode');
    P.fenetre('<h2>Corriger le paiement</h2><form class="f" data-form="paiement-corriger" data-id="' + P.esc(el.getAttribute('data-id')) + '">' +
      '<label class="fl" for="pc-montant">Montant reçu (FCFA)<input id="pc-montant" name="montant" type="number" min="1" step="1" required value="' + P.esc(montant) + '"></label>' +
      '<label class="fl" for="pc-mode">Moyen<select id="pc-mode" name="mode"><option value="wave"' + (mode === 'wave' ? ' selected' : '') + '>Wave</option><option value="especes"' + (mode === 'especes' ? ' selected' : '') + '>Espèces</option></select></label>' +
      '<label class="fl large" for="pc-motif">Pourquoi cette correction ? (obligatoire)<textarea id="pc-motif" name="motif" required rows="3"></textarea></label>' +
      '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer la correction</button><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div></form>');
  };
  P.formulaires['paiement-corriger'] = async (f, form) => {
    const montant = Math.round(Number(f.get('montant'))), motif = String(f.get('motif') || '').trim();
    if (!(montant > 0) || !motif) return P.message('Indiquez le montant et le motif de la correction.');
    try {
      await P.sensible(() => P.bd(sb.from('paiements_mannequins').update({ montant, mode: f.get('mode'), motif: 'Corrigé : ' + motif }).eq('id', form.getAttribute('data-id')).select('id')));
      P.fenetre(''); P.message('Paiement corrigé.'); await P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['paiement-annuler'] = async (el) => {
    const motif = (prompt('Motif de l’annulation (obligatoire), par exemple « saisi sur le mauvais mois » :') || '').trim();
    if (!motif) return;
    if (!confirm('Annuler ce paiement ? Il restera dans la liste, marqué « Annulé », et la recette correspondante sera annulée en comptabilité.')) return;
    try {
      const id = el.getAttribute('data-id');
      const p = await P.bd(sb.from('paiements_mannequins').select('*').eq('id', id).single());
      // une inscription payée en une fois = deux lignes (droit d'inscription + 1er mois) : on annule les deux
      const lies = p.objet === 'inscription'
        ? await P.bd(sb.from('paiements_mannequins').select('id').eq('mannequin_id', p.mannequin_id).eq('declare_le', p.declare_le).neq('statut', 'refuse'))
        : [{ id }];
      for (const x of lies) await P.sensible(() => P.bd(sb.from('paiements_mannequins').update({ statut: 'refuse', motif: 'Annulé : ' + motif }).eq('id', x.id).select('id')));
      P.message(lies.length > 1 ? 'Paiement annulé (inscription et 1er mois).' : 'Paiement annulé.'); await P.afficher();
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
        return '<tr><td>' + P.lienFiche(p.mannequin_id, p.mannequin && p.mannequin.full_name) + '<div class="petit-texte doux">' + P.esc((p.mannequin && p.mannequin.telephone) || '') + '</div></td>' +
          '<td>' + P.esc(objetPaiement(p)) + (p.objet === 'inscription' && g.total > (p.montant || 0) ? '<div class="petit-texte doux">dont 1er mois de formation</div>' : '') + '<div>' + P.pastille('En attente de validation', 'alerte') + '</div></td>' +
          '<td class="nombre">' + P.fcfa(g.total) + '</td><td>' + P.dateHeure(p.declare_le) + '</td>' +
          '<td class="ligne"><button class="btn rouge petit" type="button" data-action="paiement-valider" data-id="' + p.id + '">Valider</button>' +
          '<button class="btn petit" type="button" data-action="paiement-refuser" data-id="' + p.id + '">Refuser</button></td></tr>';
      }));
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
      mannequinsSuivis(false),
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
          '<td>' + P.lienFiche(m.id, m.full_name, m.user_id) + '</td><td class="nombre">' + P.fcfa(m.mensualite) + '</td>' +
          '<td>' + P.pastille(ETATS[e][0], ETATS[e][1]) + '</td><td class="petit-texte">' + (a ? 'envoyé le ' + P.dateHeure(a.appel_le) + (a.relance3_le ? ' · relancé le 3' : '') + (a.relance5_le ? ' · relancé le 5' : '') : '—') + '</td></tr>';
      })) + '<div class="ligne" style="margin-top:12px"><button class="btn rouge" type="submit">Envoyer l’appel aux personnes cochées</button>' +
      (relance ? '<button class="btn" type="button" data-action="mensualites-whatsapp" data-type="' + relance + '">Relances WhatsApp (' + (relance === 'relance5' ? 'dernière relance' : 'relance du 3') + ')</button>' : '') + '</div></form>';
  }
  // File d'envoi WhatsApp : un lien par personne, envoyé en un geste chacun
  function fileWhatsApp(titre, personnes, type) {
    const lignes = personnes.map((m) => {
      const msg = window.messageMensualite(m, type, new Date());
      const wa = lienWhatsApp(msg.telephone, msg.texte);
      return '<tr><td>' + P.lienFiche(m.id, m.full_name || m.nom) + '</td><td>' + (wa ? '<a class="btn rouge petit" target="_blank" rel="noopener" href="' + P.esc(wa) + '">Envoyer</a>' : '<span class="doux">pas de numéro</span>') + '</td></tr>';
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

  // ---------- Codes de l'espace mannequin (cahier V3, 7.2) ----------
  // Tous les mannequins sans compte sur le site, au même endroit : qui a payé son inscription, qui a un code,
  // lequel expire. Générer, copier, envoyer par WhatsApp (au parent si mineur), sans ouvrir chaque fiche.
  // Origine : « Casting en ligne » (candidature du site) ou « Ajouté par l'agence » (casting direct, registre).
  async function codesEspace() {
    const [mannequins, paiements, codes] = await Promise.all([
      P.bd(sb.from('agence_mannequins').select('*').eq('statut', 'actif').order('full_name')),
      P.bd(sb.from('paiements_mannequins').select('mannequin_id').eq('objet', 'inscription').eq('statut', 'valide')),
      P.bd(sb.from('codes_espace').select('*').eq('annule', false).is('utilise_le', null).order('cree_le', { ascending: false })).catch(() => [])
    ]);
    const payes = new Set(paiements.map((x) => x.mannequin_id));
    const sansCompte = mannequins.filter((m) => !m.user_id);
    const lignes = sansCompte.map((m) => {
      const code = codes.find((c) => c.mannequin_id === m.id && !c.annule && !c.utilise_le) || null, valable = !!(code && new Date(code.expire_le) > new Date());
      const etat = !payes.has(m.id) ? 'non_paye' : valable ? 'actif' : code ? 'expire' : 'a_generer';
      return { m, code, etat, origine: m.candidature_id ? 'Casting en ligne' : 'Ajouté par l’agence' };
    });
    const ordre = { a_generer: 0, expire: 1, actif: 2, non_paye: 3 };
    lignes.sort((a, b) => ordre[a.etat] - ordre[b.etat]);
    const ETAT = { a_generer: ['Code à générer', 'alerte'], expire: ['Code expiré', 'erreur'], actif: ['Code actif', 'ok'], non_paye: ['Inscription à enregistrer', 'neutre'] };
    return P.entete('Codes de l’espace mannequin') +
      '<div class="note info">Le code (ESP-…) permet au mannequin de créer son espace avec son e-mail et son mot de passe ; ses informations du casting sont alors reprises. Il ne sert qu’une fois et reste valable 7 jours. Il ne se génère qu’après une inscription payée et validée.</div>' +
      '<div class="grille chiffres">' + P.chiffre('À générer', lignes.filter((x) => x.etat === 'a_generer').length, 'orange') + P.chiffre('Actifs', lignes.filter((x) => x.etat === 'actif').length, 'vert') +
      P.chiffre('Expirés', lignes.filter((x) => x.etat === 'expire').length, 'rouge') + '</div>' +
      '<div class="carte">' + (lignes.length ? P.tableau(['Mannequin', 'Origine', 'Destinataire', 'État', 'Code', ''], lignes.map((x) => {
        const d = destinataire(x.m), actif = x.etat === 'actif', wa = actif ? messageCodeEspace(x.m, x.code).wa : null;
        return '<tr><td>' + P.lienFiche(x.m.id, x.m.full_name, x.m.user_id) + '</td><td>' + P.esc(x.origine) + '</td><td>' + P.esc(d.mineur ? d.nom + ' (parent)' : d.nom) + '</td>' +
          '<td>' + P.pastille(ETAT[x.etat][0], ETAT[x.etat][1]) + (actif ? '<div class="petit-texte doux">jusqu’au ' + P.esc(P.dateHeure(x.code.expire_le)) + '</div>' : '') + '</td>' +
          '<td>' + (actif ? '<b style="letter-spacing:1px">' + P.esc(x.code.code) + '</b>' : '—') + '</td>' +
          '<td><div class="ligne">' + (x.etat === 'non_paye' ? '<a class="btn petit" href="#/paiements/fiche/' + x.m.id + '">Enregistrer son paiement</a>'
            : actif ? '<button class="btn petit" type="button" data-action="code-espace-copier" data-code="' + P.esc(x.code.code) + '">Copier</button>' + (wa ? '<a class="btn petit rouge" target="_blank" rel="noopener" href="' + P.esc(wa) + '">WhatsApp</a>' : '<span class="doux petit-texte">pas de numéro</span>') + '<button class="btn petit" type="button" data-action="code-espace" data-id="' + x.m.id + '">Nouveau code</button>'
            : '<button class="btn petit rouge" type="button" data-action="code-espace" data-id="' + x.m.id + '">Générer le code</button>') +
          (P.moi.role === 'principal' && x.etat === 'non_paye' ? '<button class="btn petit" type="button" data-action="mannequin-supprimer" data-id="' + x.m.id + '" aria-label="Supprimer ' + P.esc(x.m.full_name) + '">Supprimer</button>' : '') + '</div></td></tr>';
      })) : '<p class="doux">Tous les mannequins actifs ont déjà leur espace.</p>') + '</div>';
  }

  // ---------- Mannequins suivis (une seule liste pour tout l'espace 2) ----------
  // Colonne agence_mannequins.suivi (supabase-suivi-mannequins.sql) : le tableau du mois, la matrice, les
  // mensualités, le récapitulatif et les messages ne montrent et ne comptent que ces mannequins. Un
  // mannequin qui paie (ou dont l'agence enregistre un paiement) y entre tout seul. Tant que le fichier
  // SQL n'est pas exécuté, tous les mannequins actifs sont montrés, comme avant.
  const colonneSuiviAbsente = (e) => !!e && (e.code === '42703' || /suivi/i.test(String(e.message || '')) && /column|colonne/i.test(String(e.message || '')));
  async function mannequinsSuivis(horsSortis) {
    const requete = (suivi) => {
      let q = sb.from('agence_mannequins').select('*').order('full_name');
      q = horsSortis ? q.neq('statut', 'sorti') : q.eq('statut', 'actif');
      return suivi ? q.eq('suivi', true) : q;
    };
    try {
      const liste = await P.bd(requete(true));
      P.etat.suiviAbsent = false; P.etat.suiviCompte = liste.length;
      return liste;
    } catch (e) {
      if (!colonneSuiviAbsente(e)) throw e;
      P.etat.suiviAbsent = true; P.etat.suiviCompte = null;
      return P.bd(requete(false));
    }
  }
  const noteSuiviVide = (n) => n ? '' : '<div class="note info">Aucun mannequin suivi pour l’instant. Ajoutez-les depuis le <a href="#/paiements/tableau">Tableau du mois</a> (liste « Mannequins suivis »). Un mannequin qui paie y entre tout seul.</div>';

  // ---------- Tableau du mois (cahier V3, 7.2) ----------
  // Page d'accueil de l'espace : attendu, validé, en attente, non payé, taux de recouvrement,
  // puis une ligne par mannequin actif (lignes non payées en rouge pâle). Même règle de statut que
  // « Mensualités du mois » : non payé seulement après le 5.
  async function tableauDuMois() {
    const mois = moisCourant();
    const [tousActifs, paiements] = await Promise.all([
      P.bd(sb.from('agence_mannequins').select('*').eq('statut', 'actif').order('full_name')),
      P.bd(sb.from('paiements_mannequins').select('id, mannequin_id, statut, montant').eq('objet', 'mensualite').eq('mois', mois).neq('statut', 'refuse'))
    ]);
    // Suivi choisi par l'agence : seuls les mannequins ajoutés avec la liste déroulante apparaissent ici
    const suiviPret = tousActifs.length === 0 || tousActifs.some((m) => 'suivi' in m);
    P.etat.suiviAbsent = !suiviPret;
    const actifs = suiviPret ? tousActifs.filter((m) => m.suivi) : tousActifs;
    const suivis = actifs.map((m) => m.id);
    const proposes = suiviPret ? tousActifs.filter((m) => !m.suivi) : [];
    const jour = new Date().getDate();
    const filtre = P.etat.filtreTableau || 'tous';
    const lignes = actifs.map((m) => {
      const p = paiements.find((x) => x.mannequin_id === m.id);
      const e = p ? (p.statut === 'valide' ? 'paye' : 'attente') : jour > 5 ? 'non_paye' : 'a_payer';
      const mineur = P.age(m.date_naissance) !== null && P.age(m.date_naissance) < 18;
      return { m, e, montant: m.mensualite || 0, inscrit: !!m.user_id, destinataire: mineur && m.parent_nom ? m.parent_nom + ' (parent)' : m.full_name };
    });
    const somme = (l) => l.reduce((t, x) => t + x.montant, 0);
    const attendu = somme(lignes), valide = somme(lignes.filter((x) => x.e === 'paye')), attente = somme(lignes.filter((x) => x.e === 'attente'));
    const nonPaye = somme(lignes.filter((x) => x.e === 'non_paye')), aPayer = somme(lignes.filter((x) => x.e === 'a_payer'));
    const taux = attendu ? Math.round(valide * 100 / attendu) : 0;
    const nb = (e) => lignes.filter((x) => x.e === e).length;
    const montrees = lignes.filter((x) => filtre === 'tous' || (filtre === 'inscrits' ? x.inscrit : !x.inscrit));
    const FILTRES_GROUPE = [['tous', 'Tous'], ['inscrits', 'Inscrits sur le site'], ['non_inscrits', 'Non inscrits']];
    return P.entete('Tableau du mois · ' + libelleMois(mois)) +
      '<div class="grille chiffres">' + P.chiffre('Attendu', P.fcfa(attendu)) + P.chiffre('Validé', P.fcfa(valide), 'vert') +
      P.chiffre('En attente de validation', P.fcfa(attente), 'orange') + P.chiffre(jour > 5 ? 'Non payé' : 'À payer avant le 5', P.fcfa(nonPaye + aPayer), 'rouge') +
      P.chiffre('Taux de recouvrement', taux + ' %') + '</div>' +
      '<div class="ligne">' + P.pastille('À jour : ' + nb('paye'), 'ok') + P.pastille('Preuve reçue : ' + nb('attente'), 'alerte') +
      P.pastille('Non payé : ' + (nb('non_paye') + nb('a_payer')), 'erreur') + '</div>' +
      (P.etat.suiviAbsent ? '<div class="note alerte">Le suivi par liste n’est pas encore activé <span class="petit-texte">(étape d’installation : « supabase-suivi-mannequins.sql »)</span>. En attendant, tous les mannequins actifs sont montrés.</div>' : '') +
      '<form class="carte f" data-form="suivi-ajouter"><h2>Mannequins suivis</h2><p class="doux">Choisissez dans la liste les mannequins à suivre ce mois-ci. Retirer un mannequin du tableau ne supprime rien.</p>' +
        // choix par la photo (P.choixVisages, js/admin/coque.js, 23/10/2026)
        P.choixVisages({ id: 'suivi-choix', nom: 'mannequin', libelle: 'Mannequin', sorte: 'registre',
          autres: proposes.length > 1 ? [['__tous__', 'Tous les mannequins actifs', '★']] : [],
          items: proposes.map((m) => ({ id: m.id, nom: m.full_name, note: m.user_id ? '' : 'non inscrit sur le site' })) }) +
        '<div class="ligne"><button class="btn rouge" type="submit">Ajouter au tableau</button>' +
        '<a class="btn" href="#/paiements/ajouter">＋ Nouveau mannequin</a></div></form>' +
      '<div class="segments" role="group" aria-label="Groupe">' + FILTRES_GROUPE.map((f) => '<button class="btn petit' + (f[0] === filtre ? ' actif' : '') + '" type="button" data-action="tableau-filtre" data-filtre="' + f[0] + '">' + P.esc(f[1]) + '</button>').join('') + '</div>' +
      '<div class="carte">' + (montrees.length ? P.tableau(['Mannequin', 'Groupe', '#Montant', 'Statut', 'Action'], montrees.map((x) =>
        // (le destinataire n'est montré que s'il diffère : le parent d'une mineure)
        '<tr' + (x.e === 'non_paye' ? ' class="ligne-retard"' : '') + '><td>' + P.lienFiche(x.m.id, x.m.full_name, x.m.user_id) +
        (x.destinataire && x.destinataire !== x.m.full_name ? '<div class="petit-texte doux">Message à : ' + P.esc(x.destinataire) + '</div>' : '') + '</td>' +
        '<td>' + (x.inscrit ? 'Inscrit sur le site' : 'Non inscrit') + '</td><td class="nombre">' + P.fcfa(x.montant) + '</td>' +
        '<td>' + P.pastille(ETATS[x.e][0], ETATS[x.e][1]) + '</td>' +
        '<td>' + (x.e === 'attente' ? '<a class="btn petit" href="#/paiements/a-valider">Valider</a>' : x.e === 'paye' ? '<span class="doux">Reçu émis</span>' : '<a class="btn petit" href="#/paiements/mensualites">Relancer</a>') +
        ' <button class="btn petit" type="button" data-action="suivi-retirer" data-id="' + x.m.id + '" aria-label="Retirer ' + P.esc(x.m.full_name) + ' du tableau">Retirer</button></td></tr>'))
        : '<p class="doux">' + (suivis.length ? 'Aucun mannequin dans ce groupe.' : 'Le tableau est vide : choisissez un mannequin dans la liste ci-dessus.') + '</p>') + '</div>';
  }
  // Liste des mannequins suivis : colonne agence_mannequins.suivi (partagée entre tous les appareils et toutes les pages)
  async function changerSuivi(ids, suivi) {
    if (!ids.length) return;
    try {
      await P.bd(sb.from('agence_mannequins').update({ suivi }).in('id', ids));
    } catch (e) {
      P.message(colonneSuiviAbsente(e) ? 'Le suivi par liste n’est pas encore activé (étape d’installation : « supabase-suivi-mannequins.sql »).' : P.erreurTexte(e));
      return;
    }
    await P.afficher();
  }
  P.formulaires['suivi-ajouter'] = async (f) => {
    const choix = String(f.get('mannequin') || '');
    if (!choix) return P.message('Choisissez d’abord un mannequin dans la liste.');
    if (choix === '__tous__') {
      const tous = await P.bd(sb.from('agence_mannequins').select('id').eq('statut', 'actif').eq('suivi', false)).catch(() => []);
      return changerSuivi(tous.map((m) => m.id), true);
    }
    return changerSuivi([choix], true);
  };
  P.actions['suivi-retirer'] = (el) => {
    if (!confirm('Retirer ce mannequin du suivi ? Il n’apparaîtra plus dans les tableaux, les récapitulatifs ni les messages (rien n’est supprimé).')) return;
    return changerSuivi([el.getAttribute('data-id')], false);
  };
  P.actions['tableau-filtre'] = (el) => { P.etat.filtreTableau = el.getAttribute('data-filtre'); P.afficher(); };

  // ---------- Matrice mannequins × mois (cahier V3, 7.2) ----------
  // 12 colonnes (janvier à décembre), une pastille par case : ✓ payé (vert), … en attente (orange),
  // ✕ non payé (rouge), · à venir ou avant l'entrée du mannequin (gris). Le sens ne repose jamais
  // sur la seule couleur : chaque pastille porte un signe et un texte pour les lecteurs d'écran.
  async function matrice() {
    const annee = P.etat.anneeMatrice || new Date().getFullYear();
    const [registreComplet, paiements] = await Promise.all([
      mannequinsSuivis(true),
      P.bd(sb.from('paiements_mannequins').select('mannequin_id, mois, statut').eq('objet', 'mensualite').neq('statut', 'refuse').gte('mois', annee + '-01-01').lte('mois', annee + '-12-01'))
    ]);
    const mannequins = registreComplet.filter((m) => m.statut !== 'sorti');
    const maintenant = new Date(), moisActuel = maintenant.getFullYear() * 12 + maintenant.getMonth(), jour = maintenant.getDate();
    const paye = {};
    paiements.forEach((x) => { paye[x.mannequin_id + '|' + Number(String(x.mois).slice(5, 7))] = x.statut; });
    const case_ = (m, n) => {
      const rang = annee * 12 + (n - 1), entree = m.date_entree ? new Date(m.date_entree) : null;
      const avantEntree = entree && rang < entree.getFullYear() * 12 + entree.getMonth();
      const st = paye[m.id + '|' + n];
      // (avant l'entrée du mannequin : « — », non concerné ; jamais confondu avec « à venir »)
      let e = st ? (st === 'valide' ? 'paye' : 'attente') : avantEntree ? 'hors' : rang > moisActuel ? 'neutre' : rang === moisActuel && jour <= 5 ? 'neutre' : 'non_paye';
      const sign = { paye: ['✓', 'ok', 'payé'], attente: ['…', 'alerte', 'en attente de validation'], non_paye: ['✕', 'erreur', 'non payé'], hors: ['—', 'neutre', 'avant l’entrée (non concerné)'], neutre: ['·', 'neutre', rang > moisActuel ? 'à venir' : 'à payer avant le 5'] }[e];
      return '<td class="case-mois' + (rang === moisActuel ? ' mois-actuel' : '') + '"><span class="pastille ' + sign[1] + '" title="' + P.MOIS[n - 1] + ' : ' + sign[2] + '"><span aria-hidden="true">' + sign[0] + '</span><span class="sr-only">' + P.esc(P.MOIS[n - 1] + ' : ' + sign[2]) + '</span></span></td>';
    };
    const colonnes = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    return P.entete('Paiements mois par mois · ' + annee, '<button class="btn petit" type="button" data-action="matrice-annee" data-sens="-1">‹ ' + (annee - 1) + '</button><button class="btn petit" type="button" data-action="matrice-annee" data-sens="1">' + (annee + 1) + ' ›</button>') +
      '<div class="ligne">' + P.pastille('✓ payé', 'ok') + P.pastille('… en attente', 'alerte') + P.pastille('✕ non payé', 'erreur') + P.pastille('· à venir', 'neutre') + P.pastille('— avant l’entrée', 'neutre') + '</div>' +
      '<div class="carte">' + (mannequins.length ? P.tableau(['Mannequin'].concat(colonnes), mannequins.map((m) =>
        '<tr><td>' + P.lienFiche(m.id, m.full_name, m.user_id) + '</td>' + colonnes.map((c, i) => case_(m, i + 1)).join('') + '</tr>'), 'matrice')
        : '<p class="doux">Aucun mannequin dans le registre.</p>') + '</div>';
  }
  // téléphone : la matrice s'ouvre sur le mois en cours (visite du 22/10/2026)
  const versMoisActuel = () => {
    const c = document.querySelector('td.mois-actuel'), boite = c && c.closest('.tableau');
    if (boite && boite.scrollWidth > boite.clientWidth) boite.scrollLeft = c.offsetLeft - boite.clientWidth / 2;
  };
  P.actions['matrice-annee'] = (el) => { P.etat.anneeMatrice = (P.etat.anneeMatrice || new Date().getFullYear()) + Number(el.getAttribute('data-sens')); P.afficher(); };

  // ---------- Récapitulatif de fin de mois (cahier V3, 7.2) ----------
  // Trois listes (payé / preuve reçue, à valider / non payé — 22/10/2026), jours de retard, mois impayés d'affilée, montant dû, export
  // PDF et Excel, relance WhatsApp par personne. Calculé en direct à partir des paiements ; l'archivage
  // figé du dernier jour et la décision de sortie viendront avec la table d'archive (étape suivante).
  // Un mois est « échu » une fois le 5 passé ; un mannequin n'est dû qu'à partir de son mois d'entrée.
  const indexMois = (iso) => Number(String(iso).slice(0, 4)) * 12 + Number(String(iso).slice(5, 7)) - 1;
  const isoMois = (i) => Math.floor(i / 12) + '-' + String(i % 12 + 1).padStart(2, '0') + '-01';
  async function donneesRecap() {
    const cible = P.etat.moisRecap || moisCourant();
    const [actifs, paiements] = await Promise.all([
      mannequinsSuivis(false),
      P.bd(sb.from('paiements_mannequins').select('mannequin_id, mois, statut').eq('objet', 'mensualite').neq('statut', 'refuse'))
    ]);
    const ici = new Date(), courant = ici.getFullYear() * 12 + ici.getMonth(), t = indexMois(cible);
    // dernier mois dont le délai (le 5) est passé, vu depuis le mois affiché
    const dernierEchu = t < courant || (t === courant && ici.getDate() > 5) ? t : t - 1;
    const statutDe = (id, i) => { const p = paiements.find((x) => x.mannequin_id === id && indexMois(x.mois) === i); return p ? p.statut : null; };
    const lignes = actifs.map((m) => {
      // (sans date d'entrée : on compte à partir du dernier mois échu, jamais « depuis toujours »)
      const entree = m.date_entree ? indexMois(m.date_entree) : dernierEchu;
      const st = statutDe(m.id, t);
      // (preuve du mois affiché en attente : on compte les mois impayés d'avant, sans s'arrêter sur elle)
      const depart = dernierEchu === t && st === 'declare' ? t - 1 : dernierEchu;
      let affilee = 0, i = depart;
      while (i >= entree && affilee < 240 && !statutDe(m.id, i)) { affilee++; i--; }
      const premierImpaye = depart - affilee + 1;
      const retard = affilee ? Math.max(0, Math.floor((ici - new Date(Math.floor(premierImpaye / 12), premierImpaye % 12, 5)) / 864e5)) : 0;
      const mineur = P.age(m.date_naissance) !== null && P.age(m.date_naissance) < 18;
      // montant dû coupé en deux (décision de la propriétaire, 22/10/2026) : le mois affiché, et les mois d'avant
      const duMois = affilee && depart === t ? (m.mensualite || 0) : 0;
      return { m, ok: st === 'valide', attente: st === 'declare', affilee, retard, du: affilee * (m.mensualite || 0), duMois, duAvant: affilee * (m.mensualite || 0) - duMois,
        destinataire: mineur && m.parent_nom ? m.parent_nom + ' (parent)' : m.full_name, entreeApres: entree > t };
    }).filter((x) => !x.entreeApres);
    // trois groupes : payé / preuve reçue, à valider / non payé (une preuve en attente n'est pas un
    // impayé ; mais une dette des mois précédents reste dans « Non payé » et dans le montant dû)
    return { cible, lignes, ont: lignes.filter((x) => x.ok), attente: lignes.filter((x) => x.attente), pas: lignes.filter((x) => x.affilee || (!x.ok && !x.attente)) };
  }
  async function recapitulatif() {
    const d = await donneesRecap();
    P.etat.recap = d;
    const total = d.pas.reduce((t, x) => t + x.du, 0), duMois = d.pas.reduce((t, x) => t + x.duMois, 0);
    const wa = (x) => { const msg = window.messageMensualite(x.m, 'relance5', new Date()); const l = lienWhatsApp(msg.telephone, msg.texte); return l ? '<a class="btn petit rouge" target="_blank" rel="noopener" href="' + P.esc(l) + '">Relancer</a>' : '<span class="doux">pas de numéro</span>'; };
    return P.entete('Récapitulatif · ' + libelleMois(d.cible),
      '<button class="btn petit" type="button" data-action="recap-mois" data-sens="-1">‹ Mois précédent</button><button class="btn petit" type="button" data-action="recap-mois" data-sens="1">Mois suivant ›</button>') +
      '<div class="grille chiffres">' + P.chiffre('Payé', d.ont.length, 'vert') + P.chiffre('Preuve reçue, à valider', d.attente.length, 'orange') + P.chiffre('Non payé', d.pas.length, 'rouge') + P.chiffre('Montant dû', P.fcfa(total), 'rouge') + '</div>' +
      (total ? '<p class="doux">dont ' + libelleMois(d.cible) + ' : <b>' + P.fcfa(duMois) + '</b> · dont mois précédents : <b>' + P.fcfa(total - duMois) + '</b></p>' : '') +
      '<div class="ligne"><button class="btn rouge" type="button" data-action="recap-export" data-format="pdf">Télécharger en PDF</button><button class="btn" type="button" data-action="recap-export" data-format="xlsx">Télécharger en Excel</button></div>' +
      (d.attente.length ? '<div class="carte"><h2>Preuve reçue, à valider</h2>' + P.tableau(['Mannequin', 'Destinataire', '#Montant', 'Action'], d.attente.map((x) =>
        '<tr><td>' + P.lienFiche(x.m.id, x.m.full_name, x.m.user_id) + '</td><td>' + P.esc(x.destinataire) + '</td><td class="nombre">' + P.fcfa(x.m.mensualite || 0) + '</td>' +
        '<td><a class="btn petit" href="#/paiements/a-valider">Valider</a></td></tr>')) + '</div>' : '') +
      '<div class="carte"><h2>Non payé</h2>' + (d.pas.length ? P.tableau(['Mannequin', 'Destinataire', '#Retard (j)', '#Mois d’affilée', '#Montant dû', 'Statut', 'Action'], d.pas.map((x) =>
        '<tr' + (x.affilee ? ' class="ligne-retard"' : '') + '><td>' + P.lienFiche(x.m.id, x.m.full_name, x.m.user_id) + '</td><td>' + P.esc(x.destinataire) + '</td>' +
        '<td class="nombre">' + x.retard + '</td><td class="nombre">' + x.affilee + '</td><td class="nombre">' + P.fcfa(x.du) + '</td>' +
        '<td>' + (x.affilee ? P.pastille('Non payé', 'erreur') : P.pastille('À payer avant le 5', 'info')) + '</td><td>' + wa(x) + '</td></tr>'))
        : '<p class="doux">Personne n’est en retard.</p>') + '</div>' +
      '<div class="carte"><h2>Payé</h2>' + (d.ont.length ? P.tableau(['Mannequin', 'Destinataire', '#Montant'], d.ont.map((x) =>
        '<tr><td>' + P.lienFiche(x.m.id, x.m.full_name, x.m.user_id) + '</td><td>' + P.esc(x.destinataire) + '</td><td class="nombre">' + P.fcfa(x.m.mensualite || 0) + '</td></tr>'))
        : '<p class="doux">Personne n’a encore payé ce mois-ci.</p>') + '</div>' +
      '<div class="note info">Ce récapitulatif est calculé en direct. Une fois le mois terminé, figez-le dans « Mois figés » pour le garder tel quel.</div>';
  }
  P.actions['recap-mois'] = (el) => { P.etat.moisRecap = isoMois(indexMois(P.etat.moisRecap || moisCourant()) + Number(el.getAttribute('data-sens'))); P.afficher(); };
  P.actions['recap-export'] = async (el) => {
    const d = P.etat.recap; if (!d) return;
    const nom = 'Recapitulatif-' + d.cible.slice(0, 7) + '-MA2M', F = P.fcfa;
    try {
      if (el.getAttribute('data-format') === 'xlsx') {
        P.telecharger(P.xlsx([
          { nom: 'Non payé', largeurs: [28, 28, 14, 18, 14, 16, 18, 22], lignes: [['Mannequin', 'Destinataire', 'Retard (jours)', 'Mois impayés d’affilée', 'Montant dû (FCFA)', 'dont ce mois-ci', 'dont mois précédents', 'Statut']].concat(d.pas.map((x) => [x.m.full_name, x.destinataire, x.retard, x.affilee, x.du, x.duMois, x.duAvant, x.affilee ? 'Non payé' : 'À payer avant le 5'])) },
          { nom: 'Preuve reçue', largeurs: [28, 28, 14], lignes: [['Mannequin', 'Destinataire', 'Montant (FCFA)']].concat(d.attente.map((x) => [x.m.full_name, x.destinataire, x.m.mensualite || 0])) },
          { nom: 'Payé', largeurs: [28, 28, 14], lignes: [['Mannequin', 'Destinataire', 'Montant (FCFA)']].concat(d.ont.map((x) => [x.m.full_name, x.destinataire, x.m.mensualite || 0])) }]),
        nom + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        const m = await P.comptaPdf.mise();
        m.nouvellePage();
        m.ecrire('Maître Akesse Model Management', { taille: 15, gras: true });
        m.espace(6); m.trait();
        m.ecrire('Récapitulatif des mensualités — ' + libelleMois(d.cible), { taille: 16, gras: true, couleur: m.rouge });
        m.ecrire('Préparé le ' + P.dateHeure(new Date().toISOString()), { taille: 9, couleur: m.gris });
        m.espace(8);
        const duTotal = d.pas.reduce((t, x) => t + x.du, 0), duMois = d.pas.reduce((t, x) => t + x.duMois, 0);
        m.ecrire('Non payé (' + d.pas.length + ') — montant dû : ' + F(duTotal), { taille: 12, gras: true });
        m.ecrire('dont ' + libelleMois(d.cible) + ' : ' + F(duMois) + ' · dont mois précédents : ' + F(duTotal - duMois), { taille: 9, couleur: m.gris });
        m.tableau([{ titre: 'Mannequin', part: 3 }, { titre: 'Retard (j)', part: 1.2, droite: true }, { titre: 'Mois d’affilée', part: 1.4, droite: true }, { titre: 'Montant dû', part: 1.8, droite: true }],
          d.pas.map((x) => [x.m.full_name, String(x.retard), String(x.affilee), F(x.du)]));
        m.espace(10);
        if (d.attente.length) {
          m.ecrire('Preuve reçue, à valider (' + d.attente.length + ')', { taille: 12, gras: true });
          m.tableau([{ titre: 'Mannequin', part: 4 }, { titre: 'Montant', part: 1.8, droite: true }], d.attente.map((x) => [x.m.full_name, F(x.m.mensualite || 0)]));
          m.espace(10);
        }
        m.ecrire('Payé (' + d.ont.length + ')', { taille: 12, gras: true });
        m.tableau([{ titre: 'Mannequin', part: 4 }, { titre: 'Montant', part: 1.8, droite: true }], d.ont.map((x) => [x.m.full_name, F(x.m.mensualite || 0)]));
        P.telecharger(await m.finir('Récapitulatif ' + d.cible.slice(0, 7)), nom + '.pdf', 'application/pdf');
      }
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  // ---------- Messages et relances (cahier V3, 7.2) ----------
  // Modèles à variables, destinataires cochés (le parent pour un mineur), aperçu, envoi par e-mail puis
  // file WhatsApp. Les relances automatiques du 3 et du 5 restent celles du serveur (e-mail).
  // Les modèles modifiés par l'administrateur principal (table modeles_messages) et l'historique des
  // envois (table messages_envoyes) sont gardés durablement ; tant que le SQL « compléments » n'est pas
  // exécuté, les modèles restent ceux d'origine et le journal ne vaut que pour la session.
  const MODELES = {
    appel: ['Appel du 1er', 'Bonjour {prenom},\n\nLa mensualité de formation du mois de {mois} ({montant}) est à régler avant le {date_limite}.\nPaiement par Wave : {lien_wave}\nPuis appuyez sur « J’ai payé » dans {lien_espace}.\n\nMerci !\nL’équipe Maître Akesse Model Management'],
    relance3: ['Relance du 3', 'Bonjour {prenom},\n\nPetit rappel : nous n’avons pas encore reçu la mensualité de {mois} ({montant}). La date limite est le {date_limite}.\nPaiement par Wave : {lien_wave}\n\nMerci !\nL’équipe Maître Akesse Model Management'],
    relance5: ['Dernière relance du 5', 'Bonjour {prenom},\n\nDernier rappel : la date limite pour la mensualité de {mois} ({montant}) est le {date_limite}.\nPaiement par Wave : {lien_wave}\n\nMerci !\nL’équipe Maître Akesse Model Management'],
    non_recu: ['Paiement non reçu', 'Bonjour {prenom},\n\nNous n’avons pas reçu la mensualité de {mois} ({montant}), dont la date limite était le {date_limite}. Merci de régulariser dès que possible : {lien_wave}\nSi vous avez déjà payé, répondez-nous à ce message.\n\nL’équipe Maître Akesse Model Management'],
    confirme: ['Paiement confirmé', 'Bonjour {prenom},\n\nNous confirmons la réception de votre paiement de {montant} pour {mois}. Merci !\n\nL’équipe Maître Akesse Model Management'],
    libre: ['Message libre', 'Bonjour {prenom},\n\n\n\nL’équipe Maître Akesse Model Management']
  };
  const CANAUX = { email: 'E-mail', whatsapp: 'WhatsApp', sms: 'SMS' };
  const FILTRES_MSG = [['tous', 'Tous les actifs'], ['inscrits', 'Inscrits sur le site'], ['non_inscrits', 'Non inscrits'], ['non_payes', 'Pas encore payé ce mois-ci']];
  const LIEN_ESPACE = 'https://www.maitreakessemodelmanagement.com/mes-paiements';
  // Lien Wave Business actif du montant de ce mannequin (page Paramètres) ; à défaut, son espace « Mes paiements »
  const lienWaveDe = (m) => { const l = (P.etat.liensWave || []).find((x) => x.actif && x.type === 'mensualite' && x.montant === m.mensualite); return l ? l.adresse : LIEN_ESPACE; };
  function remplir(modele, m) {
    const d = destinataire(m), ici = new Date(), nomMois = P.MOIS[ici.getMonth()];
    const prenom = String(d.nom || '').trim().split(/\s+/)[0] || 'Madame, Monsieur';
    const v = { prenom: prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase(), mois: nomMois + ' ' + ici.getFullYear(), montant: P.fcfa(m.mensualite),
      date_limite: '5 ' + nomMois + ' ' + ici.getFullYear(), lien_wave: lienWaveDe(m), lien_espace: 'votre espace mannequin (' + LIEN_ESPACE + ')' };
    return { texte: String(modele).replace(/\{(\w+)\}/g, (t, k) => (k in v ? v[k] : t)), d };
  }
  async function messages() {
    const e = P.etat.msg = Object.assign({ modele: 'appel', filtre: 'non_payes', journal: [] }, P.etat.msg || {});
    const mois = moisCourant();
    const [actifs, paiements, liens, modeles, historique] = await Promise.all([
      mannequinsSuivis(false),
      P.bd(sb.from('paiements_mannequins').select('mannequin_id, statut').eq('objet', 'mensualite').eq('mois', mois).neq('statut', 'refuse')),
      P.bd(sb.from('liens_wave').select('*').eq('actif', true)).catch(() => []),  // (table pas encore créée : lien de l'espace mannequin)
      P.bd(sb.from('modeles_messages').select('*')).catch(() => null),
      P.bd(sb.from('messages_envoyes').select('*, mannequin:agence_mannequins(full_name)').order('envoye_le', { ascending: false }).limit(40)).catch(() => null)
    ]);
    P.etat.liensWave = liens;
    (modeles || []).forEach((x) => { if (MODELES[x.cle]) MODELES[x.cle][1] = x.texte; });
    if (e.texte === undefined) e.texte = MODELES[e.modele][1];
    // « Pas encore payé » : ni paiement validé, ni preuve envoyée en attente de validation (décision de la
    // propriétaire, 22/10/2026 : on ne relance pas une personne qui a déjà payé), comme les relances automatiques
    const aPaye = (m) => paiements.some((x) => x.mannequin_id === m.id && (x.statut === 'valide' || x.statut === 'declare'));
    const choisis = actifs.filter((m) => e.filtre === 'tous' || (e.filtre === 'inscrits' && m.user_id) || (e.filtre === 'non_inscrits' && !m.user_id) || (e.filtre === 'non_payes' && !aPaye(m)));
    e.liste = choisis;
    return P.entete('Messages et relances') +
      '<div class="note info">Appels et relances automatiques : le 1er, appel ; le 3 et le 5, relance par e-mail aux personnes appelées qui n’ont pas payé (le serveur s’en charge). Ici : messages à la demande.</div>' +
      '<div class="carte"><h2>1. Modèle</h2><div class="segments">' + Object.keys(MODELES).map((k) => '<button class="btn petit' + (k === e.modele ? ' actif' : '') + '" type="button" data-action="msg-modele" data-modele="' + k + '">' + P.esc(MODELES[k][0]) + '</button>').join('') + '</div>' +
      '<label class="fl" for="msg-texte" style="margin-top:12px">Texte (les mots entre accolades se remplacent tout seuls : {prenom} = le prénom, {mois}, {montant}, {date_limite}, {lien_wave} = le lien de paiement, {lien_espace} = l’espace de la mannequin)<textarea id="msg-texte" rows="9">' + P.esc(e.texte) + '</textarea></label></div>' +
      '<div class="carte"><h2>2. Destinataires</h2><div class="segments">' + FILTRES_MSG.map((f) => '<button class="btn petit' + (f[0] === e.filtre ? ' actif' : '') + '" type="button" data-action="msg-filtre" data-filtre="' + f[0] + '">' + P.esc(f[1]) + '</button>').join('') + '</div>' +
      (choisis.length ? P.tableau(['', 'Mannequin', 'Destinataire', 'Contact'], choisis.map((m) => { const d = destinataire(m); return '<tr><td><input type="checkbox" name="msg-ids" value="' + m.id + '" checked aria-label="Écrire à ' + P.esc(m.full_name) + '"></td><td>' + P.lienFiche(m.id, m.full_name, m.user_id) + '</td><td>' + P.esc(d.mineur ? d.nom + ' (parent)' : d.nom) + '</td><td class="petit-texte">' + P.esc([d.tel, d.email].filter(Boolean).join(' · ') || 'aucun contact') + '</td></tr>'; })) : '<p class="doux">Personne dans ce groupe.</p>') + '</div>' +
      '<div class="ligne"><button class="btn" type="button" data-action="msg-apercu">Aperçu</button>' + (P.moi && P.moi.role === 'principal' ? '<button class="btn" type="button" data-action="msg-enregistrer-modele">Enregistrer ce modèle</button>' : '') + '<button class="btn rouge" type="button" data-action="msg-envoyer">Envoyer aux personnes cochées</button></div>' +
      (historique ? '<div class="carte"><h2>Messages envoyés</h2>' + (historique.length ? P.tableau(['Date', 'Mannequin', 'Message', 'Canal'], historique.map((j) => '<tr><td>' + P.dateHeure(j.envoye_le) + '</td><td>' + P.lienFiche(j.mannequin_id, j.mannequin && j.mannequin.full_name) + '</td><td>' + P.esc((MODELES[j.modele] || [j.modele])[0]) + '</td><td>' + P.esc(CANAUX[j.canal] || j.canal) + '</td></tr>')) : '<p class="doux">Aucun message envoyé pour l’instant.</p>') + '</div>'
      : e.journal.length ? '<div class="carte"><h2>Envois de cette session</h2>' + P.tableau(['Heure', 'Mannequin', 'E-mail'], e.journal.map((j) => '<tr><td>' + P.esc(j[0]) + '</td><td>' + P.esc(j[1]) + '</td><td>' + P.esc(j[2]) + '</td></tr>')) + '</div>' : '');
  }
  const cochees = () => { const ids = Array.from(document.querySelectorAll('input[name="msg-ids"]:checked')).map((x) => x.value); return (P.etat.msg.liste || []).filter((m) => ids.includes(m.id)); };
  const garderTexte = () => { const t = document.getElementById('msg-texte'); if (t) P.etat.msg.texte = t.value; };
  P.actions['msg-modele'] = (el) => { const e = P.etat.msg; e.modele = el.getAttribute('data-modele'); e.texte = MODELES[e.modele][1]; P.afficher(); };
  P.actions['msg-filtre'] = (el) => { garderTexte(); P.etat.msg.filtre = el.getAttribute('data-filtre'); P.afficher(); };
  P.actions['msg-enregistrer-modele'] = async () => {
    garderTexte();
    const e = P.etat.msg, texte = String(e.texte || '').trim();
    if (!texte) return P.message('Le modèle est vide.');
    if (!confirm('Enregistrer ce texte comme modèle « ' + MODELES[e.modele][0] + ' » ? Il servira à tous les prochains messages.')) return;
    try {
      const ex = await P.bd(sb.from('modeles_messages').select('cle').eq('cle', e.modele));
      if (ex.length) await P.bd(sb.from('modeles_messages').update({ texte }).eq('cle', e.modele).select('cle'));
      else await P.bd(sb.from('modeles_messages').insert({ cle: e.modele, texte }).select('cle'));
      MODELES[e.modele][1] = texte;
      P.message('Modèle enregistré.');
    } catch (err) { P.message(P.erreurTexte(err)); }
  };
  // Historique durable : un message envoyé laisse une ligne (jamais le texte, jamais d'effacement)
  const noterEnvois = (lignes) => (lignes.length ? P.bd(sb.from('messages_envoyes').insert(lignes)).catch(() => null) : null);
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest && ev.target.closest('a[data-wa-id]');
    if (a) noterEnvois([{ mannequin_id: a.getAttribute('data-wa-id'), mois: moisCourant(), modele: a.getAttribute('data-wa-modele'), canal: 'whatsapp' }]);
  });
  P.actions['msg-apercu'] = () => {
    garderTexte();
    const l = cochees();
    if (!l.length) return P.message('Cochez au moins une personne.');
    const r = remplir(P.etat.msg.texte, l[0]);
    P.fenetre('<h2>Aperçu — ' + P.esc(l[0].full_name) + '</h2><p class="doux">Envoyé à : ' + P.esc(r.d.mineur ? r.d.nom + ' (parent)' : r.d.nom) + '</p><pre class="journal" style="white-space:pre-wrap">' + P.esc(r.texte) +
      '</pre><div class="ligne"><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div>');
  };
  P.actions['msg-envoyer'] = async () => {
    garderTexte();
    const l = cochees(), e = P.etat.msg;
    if (!l.length) return P.message('Cochez au moins une personne.');
    if (!/\S{3}/.test(e.texte.replace(/\{\w+\}/g, '')) ) return P.message('Le message est vide.');
    if (!confirm('Envoyer ce message à ' + l.length + ' personne(s) ?')) return;
    let envoyes = 0;
    const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' });
    const lignes = [];
    await Promise.all(l.map(async (m) => {
      const r = remplir(e.texte, m);
      let etat = 'pas d’adresse e-mail';
      if (r.d.email && typeof envoyerEmailCandidat === 'function') {
        etat = await Promise.resolve(envoyerEmailCandidat({ to_email: r.d.email, to_name: r.d.nom, message: r.texte })).then(() => { envoyes++; return 'envoyé'; }, () => 'échec');
      }
      e.journal.unshift([heure, m.full_name, etat]);
      lignes.push({ m, r, etat });
    }));
    await noterEnvois(lignes.filter((x) => x.etat === 'envoyé').map((x) => ({ mannequin_id: x.m.id, mois: moisCourant(), modele: e.modele, canal: 'email' })));
    await P.afficher();
    P.message(envoyes + ' e-mail(s) envoyé(s) sur ' + l.length + '. Envoyez maintenant les messages WhatsApp.');
    P.fenetre('<h2>Messages WhatsApp</h2>' + P.tableau(['Mannequin', 'WhatsApp'], lignes.map((x) => {
      const wa = lienWhatsApp(x.r.d.tel, x.r.texte);
      return '<tr><td>' + P.lienFiche(x.m.id, x.m.full_name, x.m.user_id) + '</td><td>' + (wa ? '<a class="btn rouge petit" target="_blank" rel="noopener" data-wa-id="' + P.esc(x.m.id) + '" data-wa-modele="' + P.esc(e.modele) + '" href="' + P.esc(wa) + '">Envoyer</a>' : '<span class="doux">pas de numéro</span>') + '</td></tr>';
    })) + '<div class="ligne" style="margin-top:12px"><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div>');
  };

  // ---------- Paramètres (cahier V3, 7.2) ----------
  // Liens Wave Business (écriture : administrateur principal, avec un code récent ; lecture : encaissements),
  // montants et calendrier en lecture. Table : liens_wave (supabase-parametres.sql, à exécuter par la propriétaire).
  const TYPES_LIEN = { inscription: 'Inscription + 1er mois', mensualite: 'Mensualité', autre: 'Autre' };
  async function parametres() {
    let liens = null, absente = false;
    try { liens = await P.bd(sb.from('liens_wave').select('*').order('actif', { ascending: false }).order('montant')); } catch (e) { absente = true; }
    const principal = P.moi.role === 'principal';
    const montants = P.tableau(['Paiement', '#Montant', 'Détail'], [
      ['<tr><td>Inscription</td><td class="nombre">' + P.fcfa(INSCRIPTION_FCFA) + '</td><td class="petit-texte">' + P.fcfa(DROIT_INSCRIPTION) + ' de droit d’inscription + ' + P.fcfa(PREMIER_MOIS) + ' pour le 1er mois de formation</td></tr>'],
      ['<tr><td>Mensualité standard</td><td class="nombre">' + P.fcfa(10000) + '</td><td class="petit-texte">Par mois ; le montant de chaque mannequin se choisit dans le registre</td></tr>'],
      ['<tr><td>Mensualité majorée</td><td class="nombre">' + P.fcfa(20000) + '</td><td class="petit-texte">Par mois ; réservé aux mannequins concernés (registre)</td></tr>']
    ].map((x) => x[0]));
    const calendrier = P.tableau(['Jour', 'Action automatique'], [
      '<tr><td>Le 1er, 06:00 (Abidjan)</td><td>Création des échéances du mois et appel aux mannequins cochés</td></tr>',
      '<tr><td>Le 3</td><td>Relance par e-mail à ceux qui n’ont pas payé</td></tr>',
      '<tr><td>Le 5</td><td>Dernière relance ; date limite de paiement</td></tr>',
      '<tr><td>Le 6</td><td>Les mensualités non payées passent en rouge (« Non payé »)</td></tr>']);
    const liste = absente ? '<div class="note erreur">Les liens de paiement ne sont pas encore activés <span class="petit-texte">(étape d’installation : « supabase-parametres.sql »)</span>.</div>'
      : (liens.length ? P.tableau(['Libellé', 'Type', '#Montant', 'Lien', 'État', ''], liens.map((l) =>
        '<tr' + (l.actif ? '' : ' class="annulee"') + '><td><b>' + P.esc(l.libelle) + '</b></td><td>' + P.esc(TYPES_LIEN[l.type] || l.type) + '</td><td class="nombre">' + P.fcfa(l.montant) + '</td>' +
        '<td class="petit-texte"><a href="' + P.esc(l.adresse) + '" target="_blank" rel="noopener noreferrer">' + P.esc(l.adresse.replace(/^https:\/\//, '').slice(0, 38)) + '</a></td>' +
        '<td>' + P.pastille(l.actif ? 'Actif' : 'Désactivé', l.actif ? 'ok' : 'neutre') + '</td>' +
        '<td>' + (principal ? '<button class="btn petit" type="button" data-action="lien-etat" data-id="' + l.id + '" data-actif="' + (l.actif ? '0' : '1') + '">' + (l.actif ? 'Désactiver' : 'Réactiver') + '</button>' : '') + '</td></tr>'))
        : '<p class="doux">Aucun lien enregistré pour l’instant.</p>');
    const ajout = absente || !principal ? (principal ? '' : '<div class="note info">Seul l’administrateur principal peut ajouter ou désactiver un lien.</div>') :
      '<form class="carte f" data-form="lien-ajouter"><h2>Ajouter un lien Wave Business</h2>' +
      '<label class="fl" for="lw-type">Type<select id="lw-type" name="type"><option value="inscription">Inscription + 1er mois</option><option value="mensualite" selected>Mensualité</option><option value="autre">Autre</option></select></label>' +
      '<label class="fl" for="lw-libelle">Libellé<input id="lw-libelle" name="libelle" required maxlength="120" placeholder="Mensualité 10 000"></label>' +
      '<label class="fl" for="lw-montant">Montant (FCFA)<input id="lw-montant" name="montant" type="number" min="1" step="1" required></label>' +
      '<label class="fl large" for="lw-adresse">Adresse du lien (https://…)<input id="lw-adresse" name="adresse" type="url" required placeholder="https://pay.wave.com/…"></label>' +
      '<div class="large ligne"><button class="btn rouge" type="submit">Ajouter le lien</button></div></form>';
    return P.entete('Paramètres') +
      '<div class="carte"><h2>Liens de paiement Wave Business</h2><p class="doux">Dans « Messages et relances », la variable {lien_wave} utilise le lien actif du montant du mannequin.</p>' + liste + '</div>' + ajout +
      '<div class="carte"><h2>Montants en vigueur</h2>' + montants + '<p class="doux">Ces montants sont fixes pour l’instant. La mensualité de chaque mannequin se choisit dans le registre ; un changement ne touche que les échéances à venir.</p></div>' +
      '<div class="carte"><h2>Calendrier du mois</h2>' + calendrier + '</div>';
  }
  P.formulaires['lien-ajouter'] = async (f) => {
    const adresse = String(f.get('adresse') || '').trim(), montant = Math.round(Number(f.get('montant')));
    if (!/^https:\/\/[^\s]+$/i.test(adresse)) return P.message('L’adresse doit commencer par https://');
    if (!(montant > 0)) return P.message('Indiquez un montant.');
    try {
      await P.sensible(() => P.bd(sb.from('liens_wave').insert({ type: f.get('type'), libelle: String(f.get('libelle') || '').trim(), montant, adresse }).select('id')));
      P.message('Lien ajouté.');
      await P.afficher();
    } catch (e) { P.message(/liens_wave_un_actif|duplicate/i.test(String(e && e.message)) ? 'Il y a déjà un lien actif pour ce type et ce montant : désactivez-le d’abord.' : P.erreurTexte(e)); }
  };
  P.actions['lien-etat'] = async (el) => {
    const actif = el.getAttribute('data-actif') === '1';
    try {
      await P.sensible(() => P.bd(sb.from('liens_wave').update({ actif }).eq('id', el.getAttribute('data-id')).select('id')));
      await P.afficher();
    } catch (e) { P.message(/liens_wave_un_actif|duplicate/i.test(String(e && e.message)) ? 'Il y a déjà un lien actif pour ce type et ce montant : désactivez-le d’abord.' : P.erreurTexte(e)); }
  };

  P.espaces.paiements = {
    nav: [['tableau', 'Tableau du mois'], ['matrice', 'Paiements mois par mois'], ['recapitulatif', 'Récapitulatif de fin de mois'], ['messages', 'Messages et relances'], ['codes', 'Codes de l’espace mannequin'], ['parametres', 'Paramètres'], ['a-valider', 'Paiements à valider'], ['mensualites', 'Mensualités du mois'], ['registre', 'Registre des mannequins'], ['ajouter', 'Ajouter un mannequin']],
    // (pages qui comptent les mannequins suivis : une note explique la liste vide)
    pages: Object.assign({ tableau: tableauDuMois, codes: codesEspace, parametres, 'a-valider': aValider, registre, ajouter, fiche },
      ...['matrice', 'recapitulatif', 'messages', 'mensualites'].map((cle) => ({ [cle]: async (params) => {
        const page = { matrice, recapitulatif, messages, mensualites }[cle];
        const html = await page(params);
        if (P.etat.suiviCompte !== 0) return html;
        const debut = html.indexOf('</h1></div><div class="ligne">'), fin = debut < 0 ? -1 : html.indexOf('</div></div>', debut);
        return fin < 0 ? html : html.slice(0, fin + 12) + noteSuiviVide(0) + html.slice(fin + 12);
      } }))),
    compteur: {},
    apres: { matrice: versMoisActuel },
    // nombre de paiements en attente, affiché dans le menu
    avant: async () => {
      // (une inscription et son 1er mois, déclarés ensemble, comptent pour un)
      const r = await sb.from('paiements_mannequins').select('mannequin_id, declare_le').eq('statut', 'declare');
      P.espaces.paiements.compteur['a-valider'] = r && !r.error ? new Set((r.data || []).map((x) => x.mannequin_id + x.declare_le)).size : 0;
    }
  };
})();
