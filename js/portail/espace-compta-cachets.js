// Espace 3 — « Payer les mannequins » (22/10/2026, choix de la propriétaire) : cachets après une
// prestation, pour les mannequins du registre (inscrites ou non) comme pour des personnes
// extérieures. Base : cachets_mannequins, cachet_payer(), cachet_annuler() (supabase-cachets.sql).
// Tant que l'agence n'a pas sa clé Wave Business (pas encore constituée), l'envoi se fait depuis
// le téléphone Wave, puis « Marquer payé » : la dépense « Cachets reversés aux mannequins » entre
// toute seule dans la comptabilité. Seul l'administrateur principal marque payé (code récent).
// Commission de l'agence (22/10/2026, choix de la propriétaire) : on saisit le montant TOTAL de la
// prestation ; la base garde la commission (pourcentage unique de compta_reglages, 20 % par défaut,
// réglé ici par l'administrateur principal) et calcule le montant à verser ; « Marquer payé » y
// enregistre la recette de la prestation ET la dépense du cachet
// (supabase-cachets-commission.sql). Tant que ce SQL n'est pas exécuté : saisie du montant versé.
// Outils communs : P.compta (js/portail/espace-compta.js, à charger avant).
(function () {
  'use strict';
  const P = window.Portail, C = P.compta;
  if (!P || !C) return;
  const t = C.champ;
  const NOUVEAU = '__nouvel_evenement';  // « ➕ Nouvel événement » dans la liste des projets
  const EXT = 'ext:';  // « Qui ? » : une mannequin extérieure du carnet (pas dans le registre)
  const ABSENTE = '<div class="note info">Cette rubrique n’est pas encore activée. <span class="petit-texte doux">(Étape d’installation : « supabase-cachets.sql » à exécuter dans la base.)</span></div>';
  const principal = () => P.moi && P.moi.role === 'principal';
  // numéro saisi → chiffres seuls avec l'indicatif ivoirien (numeroWhatsApp, js/app.js)
  const numero = (x) => (typeof numeroWhatsApp === 'function' ? numeroWhatsApp(x) : String(x || '').replace(/\D/g, ''));
  const joli = (n) => '+' + String(n).replace(/^(\d{3})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5 $6');
  let cachets = [], commission = null;  // pourcentage de la commission (null : pas encore activée)
  // Motif choisi dans une liste et reçu après paiement (supabase-cachets-recus.sql ; outils communs :
  // window.CachetsMa2m, js/cachets-communs.js) — false tant que ce SQL n'est pas exécuté
  let recus = false;
  // Mineure payée sur le Wave de son parent (supabase-cachets-parent.sql) — false tant que ce SQL
  // n'est pas exécuté
  let parents = false;
  const mineure = (m) => !!m && P.age(m.date_naissance) !== null && P.age(m.date_naissance) < 18;
  const K = window.CachetsMa2m;
  const pourcent = (x) => String(Number(x)).replace('.', ',') + ' %';
  // nom : photo et lien vers la fiche (C.nomMannequin, js/portail/espace-compta.js)
  const nom = (c) => C.nomMannequin(c.agence_mannequin_id, c.beneficiaire);

  // Reçu sur WhatsApp : à la mannequin, ou à son parent si elle est mineure (règle de toute
  // l'Administration : les messages d'un mineur vont au parent)
  function lienRecuWhatsApp(c, registre) {
    // cachet versé au parent : le reçu part au numéro payé, au nom du parent
    if (c.parent_nom) return 'https://wa.me/' + c.telephone + '?text=' + encodeURIComponent(K.texteRecu(c, c.parent_nom));
    const m = registre.find((x) => x.id === c.agence_mannequin_id);
    const parent = m && m.parent_telephone && mineure(m) ? m : null;
    const n = parent ? numero(parent.parent_telephone) : c.telephone;
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(K.texteRecu(c, parent ? parent.parent_nom || 'Madame, Monsieur' : ''));
  }
  async function page() {
    // (toutes les questions à la base partent en même temps : écran prêt plus vite)
    const [lecture, registre, projets, reglage, colonneMotif, colonneParent, externes] = await Promise.all([
      P.bd(sb.from('cachets_mannequins').select('*').order('cree_le', { ascending: false }).limit(300)).then((data) => ({ data }), (error) => ({ error })),
      P.bd(sb.from('agence_mannequins').select('id, full_name, telephone, statut, user_id, date_naissance, parent_nom, parent_telephone').eq('statut', 'actif').order('full_name')).catch(() => []),
      P.bd(sb.from('agenda_projets').select('id, titre, date_debut').eq('annule', false).gte('date_debut', new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10)).order('date_debut', { ascending: false }).limit(40)).catch(() => []),
      P.bd(sb.from('compta_reglages').select('*').eq('id', 1).maybeSingle()).catch(() => null),
      sb.from('cachets_mannequins').select('motif, numero_recu, jeton').limit(1),
      sb.from('cachets_mannequins').select('parent_nom').limit(1),
      // mannequins extérieures (partenaires du carnet, 23/10/2026), pour les retrouver d'un geste
      P.bd(sb.from('contacts_externes').select('id, nom, telephone').is('mannequin_id', null).order('nom')).catch(() => [])
    ]);
    if (lecture.error) { if (C.cachetsAbsents(lecture.error)) return P.entete('Payer les mannequins') + ABSENTE; throw lecture.error; }
    const liste = cachets = lecture.data || [];
    recus = !!K && !colonneMotif.error;
    parents = !colonneParent.error;
    commission = reglage && reglage.commission_taux != null ? Number(reglage.commission_taux) : null;
    P.etat.cachetsRegistre = registre;
    P.etat.cachetsExternes = externes;
    const aPayer = liste.filter((c) => c.statut === 'a_payer'), payes = liste.filter((c) => c.statut === 'paye').slice(0, 60);
    const total = aPayer.reduce((s, c) => s + c.montant, 0);
    const carte = (c) => '<div class="cachet' + (c.statut === 'a_payer' ? '' : ' fait') + '"><div class="t">' + nom(c) +
      '<small>' + P.esc(c.prestation) + ' · ' + joli(c.telephone) + (c.parent_nom ? ' · versé au parent : ' + P.esc(c.parent_nom) : '') + '</small>' +
      (c.montant_prestation ? '<small>Prestation ' + P.fcfa(c.montant_prestation) + ' · commission de l’agence ' + pourcent(c.commission_taux) + ' : ' + P.fcfa(c.commission) + '</small>' : '') +
      '</div><span class="cachet-montant">' + P.fcfa(c.montant) + '</span>' +
      (c.statut === 'a_payer' ? '<div class="ligne"><button class="btn petit" type="button" data-action="cachet-copier" data-numero="' + P.esc(c.telephone) + '">Copier le numéro</button>' +
        (principal() ? '<button class="btn petit rouge" type="button" data-action="cachet-payer" data-id="' + c.id + '">Marquer payé</button>' +
          '<button class="btn petit" type="button" data-action="cachet-annuler" data-id="' + c.id + '">Annuler</button>' : '') + '</div>'
        : '<small class="doux">Payé le ' + P.date(c.paye_le) + (c.reference_wave ? ' · réf. ' + P.esc(c.reference_wave) : '') + (c.numero_recu ? ' · reçu ' + P.esc(c.numero_recu) : '') + '</small>' +
          (recus && c.numero_recu ? '<div class="ligne"><a class="btn petit rouge" target="_blank" rel="noopener" href="' + P.esc(lienRecuWhatsApp(c, registre)) + '">Envoyer le reçu sur WhatsApp</a>' +
            '<a class="btn petit" target="_blank" rel="noopener" href="' + P.esc(K.lienRecu(c.jeton)) + '">Voir le reçu</a></div>' : '')) + '</div>';
    return P.entete('Payer les mannequins', '<button class="btn rouge" type="button" data-action="cachet-nouveau">＋ Nouveau cachet</button>') +
      '<div class="note info">Envoi direct par Wave : disponible quand l’agence aura sa clé Wave Business. En attendant, payez depuis votre téléphone Wave, puis touchez « Marquer payé » : la dépense entre toute seule dans la comptabilité.</div>' +
      (commission === null ? '' : '<form class="carte f" data-form="cachet-commission"><h2 class="large">Commission de l’agence</h2>' +
        '<p class="large doux">Sur chaque cachet, l’agence garde ' + pourcent(commission) + ' du montant de la prestation ; la mannequin reçoit le reste. Changer le pourcentage ne modifie pas les cachets déjà saisis.</p>' +
        (principal() ? '<label class="fl" for="cc-taux">Pourcentage (%)<input id="cc-taux" name="taux" type="number" inputmode="decimal" min="0" max="99" step="0.5" required value="' + commission + '"></label>' +
          '<div class="ligne large"><button class="btn" type="submit">Enregistrer</button></div>' : '') + '</form>') +
      '<section class="carte"><h2>À payer <span class="doux">(' + aPayer.length + (aPayer.length ? ' · ' + P.fcfa(total) : '') + ')</span></h2>' +
      (aPayer.length ? aPayer.map(carte).join('') : '<p class="doux">Rien à payer pour le moment.</p>') + '</section>' +
      '<section class="carte"><h2>Déjà payés</h2>' + (payes.length ? payes.map(carte).join('') : '<p class="doux">Aucun cachet payé pour le moment.</p>') + '</section>' +
      // (projets de l'agenda pour la fenêtre « Nouveau cachet »)
      '<template id="cachet-projets">' + projets.map((p) => '<option value="' + p.id + '">' + P.esc(p.titre + ' · ' + P.date(p.date_debut)) + '</option>').join('') + '</template>';
  }

  P.actions['cachet-nouveau'] = () => {
    const registre = P.etat.cachetsRegistre || [], tpl = document.getElementById('cachet-projets');
    P.fenetre('<form class="f" data-form="cachet-ajouter"><h2 class="large">Nouveau cachet à payer</h2>' +
      // qui : par sa photo (P.choixVisages, js/admin/coque.js, 23/10/2026)
      P.choixVisages({ id: 'ca-qui', nom: 'qui', libelle: 'Qui ?', sorte: 'registre', change: 'cachet-qui', valeur: '',
        autres: [['', 'Personne extérieure (nom et numéro)', '＋']].concat((P.etat.cachetsExternes || []).map((c) => [EXT + c.id, c.nom + ' (extérieure)', '🤝'])), items: registre.map((m) => ({ id: m.id, nom: m.full_name })) }) +
      '<label class="fl" for="ca-nom">Nom et prénoms<input id="ca-nom" name="nom" maxlength="160" required></label>' +
      // mineure : payée sur le Wave de son parent, dont le nom et le numéro sont gardés
      '<p class="large note info" id="ca-mineure" hidden>Mannequin mineure : le cachet est versé sur le compte Wave de son parent. S’il manque, son nom et son numéro sont enregistrés dans le registre et sur sa fiche.</p>' +
      '<label class="fl" for="ca-parent-nom" id="ca-parent-ligne" hidden>Nom du parent<input id="ca-parent-nom" name="parent_nom" maxlength="160" placeholder="ex. : Madame Koné"></label>' +
      '<label class="fl" for="ca-tel"><span id="ca-tel-libelle">Numéro Wave</span><input id="ca-tel" name="telephone" type="tel" inputmode="tel" required placeholder="07 07 07 07 07"></label>' +
      '<label class="fl" for="ca-projet">Projet de l’agenda (facultatif)<select id="ca-projet" name="projet" data-change="cachet-projet"><option value="">Choisir</option><option value="' + NOUVEAU + '">➕ Nouvel événement (ajouté à l’agenda)</option>' + (tpl ? tpl.innerHTML : '') + '</select></label>' +
      // événement pas encore dans l'agenda (23/10/2026) : il y est ajouté en même temps que le cachet
      '<div id="ca-nouveau" class="large f-sous" hidden>' +
        '<label class="fl" for="ca-ev-titre">Titre de l’événement<input id="ca-ev-titre" name="ev_titre" maxlength="160" placeholder="ex. : Défilé Africa in Rhythm"></label>' +
        '<label class="fl" for="ca-ev-date">Date<input id="ca-ev-date" name="ev_date" type="date" value="' + new Date().toISOString().slice(0, 10) + '"></label>' +
        '<label class="fl" for="ca-ev-type">Type<select id="ca-ev-type" name="ev_type">' + Object.keys(typeof MA2M_TYPES_AGENDA === 'object' ? MA2M_TYPES_AGENDA : { evenement: 1 }).map((k) => '<option value="' + k + '"' + (k === 'defile' ? ' selected' : '') + '>' + P.esc(typeof libelleTypeAgenda === 'function' ? libelleTypeAgenda(k) : k) + '</option>').join('') + '</select></label>' +
        '<label class="fl" for="ca-ev-lieu">Lieu (facultatif)<input id="ca-ev-lieu" name="ev_lieu" maxlength="160"></label>' +
        '<p class="doux large">Il est ajouté à l’agenda (pas montré sur le site public : l’agence décide ensuite).</p></div>' +
      (recus ? '<label class="fl" for="ca-motif">Motif du cachet<select id="ca-motif" name="motif" required><option value="">Choisir</option>' +
          K.MOTIFS.map((m) => '<option value="' + m[0] + '">' + P.esc(m[1]) + '</option>').join('') + '</select></label>' +
        '<label class="fl" for="ca-prestation">Précision (facultatif)<input id="ca-prestation" name="prestation" maxlength="150" placeholder="ex. : défilé du 5 décembre"></label>'
        : '<label class="fl" for="ca-prestation">Prestation (sinon : le projet choisi)<input id="ca-prestation" name="prestation" maxlength="200" placeholder="ex. : défilé du 5 décembre"></label>') +
      '<label class="fl" for="ca-montant">' + (commission === null ? 'Montant à verser (FCFA)' : 'Montant total de la prestation (FCFA)') +
        '<input id="ca-montant" name="montant" type="number" inputmode="numeric" min="1" max="5000000" step="1" required data-change="cachet-montant" data-direct></label>' +
      (commission === null ? '' : '<p class="large doux" id="ca-calcul" role="status">Commission de l’agence ' + pourcent(commission) + ' · à verser à la mannequin : —</p>') +
      '<div class="ligne large"><button class="btn rouge" type="submit">Ajouter à payer</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
    document.getElementById('ca-nom').focus();
  };
  // une mannequin du registre : nom et numéro remplis d'office (modifiables)
  // (mineure : le numéro Wave de son parent, et son nom)
  P.changements['cachet-qui'] = (el) => {
    const m = (P.etat.cachetsRegistre || []).find((x) => x.id === el.value), parent = parents && mineure(m);
    const $ = (id) => document.getElementById(id);
    const ext = (P.etat.cachetsExternes || []).find((x) => EXT + x.id === el.value);
    if (ext) { $('ca-nom').value = ext.nom; $('ca-tel').value = ext.telephone || ''; }
    else {
      $('ca-nom').value = m ? m.full_name : '';
      $('ca-tel').value = m ? ((parent ? m.parent_telephone : m.telephone) || '') : '';
    }
    $('ca-mineure').hidden = $('ca-parent-ligne').hidden = !parent;
    $('ca-parent-nom').required = parent;
    $('ca-parent-nom').value = parent ? m.parent_nom || '' : '';
    $('ca-tel-libelle').textContent = parent ? 'Numéro Wave du parent' : 'Numéro Wave';
  };
  P.changements['cachet-projet'] = (el) => { const b = document.getElementById('ca-nouveau'); if (b) b.hidden = el.value !== NOUVEAU; };
  P.formulaires['cachet-ajouter'] = async (f) => {
    const tel = numero(t(f, 'telephone')), montant = Math.round(Number(f.get('montant')));
    if (!/^\d{8,15}$/.test(tel)) { P.message('Ce numéro Wave n’est pas valable.'); return; }
    if (!(montant > 0)) { P.message('Indiquez le montant.'); return; }
    const sel = document.getElementById('ca-projet');
    let projet = t(f, 'projet');
    if (projet === NOUVEAU) {
      const titre = t(f, 'ev_titre'), date = t(f, 'ev_date');
      if (!titre || !date) { P.message('Indiquez le titre et la date du nouvel événement.'); return; }
      if (recus && !t(f, 'motif')) { P.message('Choisissez le motif du cachet.'); return; }
      projet = await P.rpc('cachet_nouvel_evenement', { p_titre: titre, p_date: date, p_type: t(f, 'ev_type') || 'evenement', p_lieu: t(f, 'ev_lieu') || null, p_ville: 'Abidjan' });
      if (!projet) { P.message('L’événement n’a pas pu être ajouté : reconnectez-vous puis réessayez.'); return; }
      // il est maintenant dans la liste : un nouvel essai ne le recréera pas
      const option = new Option(titre + ' · ' + P.date(date), projet);
      sel.add(option, 2); sel.value = projet;
      document.getElementById('ca-nouveau').hidden = true;
      const tpl = document.getElementById('cachet-projets');
      if (tpl) tpl.innerHTML = option.outerHTML + tpl.innerHTML;
    }
    const titreProjet = projet && sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '', motif = recus ? t(f, 'motif') : '';
    if (recus && !motif) { P.message('Choisissez le motif du cachet.'); return; }
    // texte de la prestation : motif · projet · précision (sans motif : précision, sinon le projet)
    // (200 caractères au plus, comme le veut la base)
    const prestation = (recus ? [K.libelle(motif), titreProjet, t(f, 'prestation')].filter(Boolean).join(' · ') : (t(f, 'prestation') || titreProjet)).slice(0, 200);
    if (!prestation) { P.message('Indiquez la prestation, ou choisissez le projet de l’agenda.'); return; }
    // avec la commission : la base recalcule la commission et le montant à verser (montant ci-dessous provisoire)
    const ligne = { beneficiaire: t(f, 'nom'), telephone: tel, montant, prestation, projet_id: projet, agence_mannequin_id: String(t(f, 'qui') || '').startsWith(EXT) ? null : t(f, 'qui'), statut: 'a_payer', cree_le: new Date().toISOString() };
    // mineure : versée au parent ; son nom et son numéro, s'ils manquaient ou ont changé, vont dans
    // le registre et sur sa fiche (cachet_enregistrer_parent)
    const m = (P.etat.cachetsRegistre || []).find((x) => x.id === ligne.agence_mannequin_id);
    const pourParent = parents && mineure(m), parentNom = pourParent ? t(f, 'parent_nom') : '';
    if (pourParent && !parentNom) { P.message('Indiquez le nom du parent.'); return; }
    if (pourParent) ligne.parent_nom = parentNom;
    if (commission !== null) ligne.montant_prestation = montant;
    if (recus) ligne.motif = motif;
    const r = await P.bd(sb.from('cachets_mannequins').insert(ligne).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    // (après le cachet seulement : un cachet refusé ne change jamais le parent)
    let note = '';
    if (pourParent && (parentNom !== (m.parent_nom || '') || tel !== numero(m.parent_telephone))) {
      try { await P.rpc('cachet_enregistrer_parent', { p_mannequin: m.id, p_nom: parentNom, p_telephone: tel }); Object.assign(m, { parent_nom: parentNom, parent_telephone: tel }); note = ' Parent enregistré dans le registre et sur sa fiche.'; }
      catch (e) { note = ' Le parent n’a pas été enregistré dans le registre : ' + P.erreurTexte(e); }
    }
    await C.actualiser('Cachet ajouté à la liste « À payer ».' + note);
  };
  // calcul affiché pendant la saisie (le vrai calcul est fait par la base, au franc près)
  P.changements['cachet-montant'] = (el) => {
    const z = document.getElementById('ca-calcul'), total = Math.round(Number(el.value));
    if (!z || commission === null) return;
    const part = Math.round(total * commission / 100);
    z.textContent = 'Commission de l’agence ' + pourcent(commission) + (total > 0 ? ' : ' + P.fcfa(part) + ' · à verser à la mannequin : ' + P.fcfa(total - part) : ' · à verser à la mannequin : —');
  };
  P.formulaires['cachet-commission'] = async (f) => {
    const taux = Number(String(f.get('taux')).replace(',', '.'));
    if (!(taux >= 0 && taux < 100)) { P.message('Indiquez un pourcentage entre 0 et 99.'); return; }
    const r = await P.bd(sb.from('compta_reglages').update({ commission_taux: taux }).eq('id', 1).select('id'));
    if (!r || !r.length) { P.message('Action refusée : votre rôle ne le permet pas.'); return; }
    await C.actualiser('Commission de l’agence : ' + pourcent(taux) + '.');
  };
  P.actions['cachet-copier'] = (el) => {
    const texte = el.textContent;
    navigator.clipboard.writeText(el.dataset.numero.replace(/^225/, '')).then(() => { el.textContent = 'Copié !'; }, () => { el.textContent = el.dataset.numero; });
    setTimeout(() => { if (el.isConnected) el.textContent = texte; }, 1600);
  };
  P.actions['cachet-payer'] = async (el) => {
    const c = cachets.find((x) => x.id === el.dataset.id);
    if (!c) return;
    const comptes = (await C.comptes()).sort((a, b) => (b.type === 'wave') - (a.type === 'wave'));
    P.fenetre('<form class="f" data-form="cachet-confirmer" data-id="' + c.id + '"><h2 class="large">Confirmer le paiement</h2>' +
      '<p class="large recap-cachet"><b>' + P.fcfa(c.montant) + '</b> à <b>' + P.esc(c.beneficiaire) + '</b> (' + joli(c.telephone) + ')<br><span class="doux">' + P.esc(c.prestation) + '</span></p>' +
      '<label class="fl" for="cp-compte">Payé depuis<select id="cp-compte" name="compte" required>' + C.optionsComptes(comptes) + '</select></label>' +
      '<label class="fl" for="cp-ref">Référence de la transaction Wave (facultatif)<input id="cp-ref" name="reference" maxlength="80" autocomplete="off"></label>' +
      '<p class="doux petit-texte large">Ne touchez « J’ai payé » qu’après l’envoi réussi dans Wave. ' + (c.montant_prestation
        ? 'Deux lignes entrent dans la comptabilité : la recette de la prestation (' + P.fcfa(c.montant_prestation) + ') et la dépense du cachet (' + P.fcfa(c.montant) + ') ; la différence est la commission de l’agence. Ne saisissez pas cette recette à la main.'
        : 'La dépense entre dans la comptabilité.') + '</p>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">J’ai payé</button><button class="btn" type="button" data-action="fermer-fenetre">Retour</button></div></form>');
  };
  P.formulaires['cachet-confirmer'] = async (f, form) => {
    await P.sensible(() => P.rpc('cachet_payer', { p_id: form.dataset.id, p_compte: t(f, 'compte'), p_reference: t(f, 'reference') }));
    const c = cachets.find((x) => x.id === form.dataset.id);
    await C.actualiser(c && c.montant_prestation ? 'Paiement enregistré : la recette de la prestation et la dépense du cachet sont dans la comptabilité.' : 'Paiement enregistré : la dépense est dans la comptabilité.');
  };
  P.actions['cachet-annuler'] = (el) => {
    P.fenetre('<form class="f" data-form="cachet-annuler" data-id="' + el.dataset.id + '"><h2 class="large">Annuler ce cachet</h2>' +
      '<label class="fl large" for="cn-motif">Motif<input id="cn-motif" name="motif" maxlength="300" required placeholder="ex. : prestation annulée"></label>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">Annuler le cachet</button><button class="btn" type="button" data-action="fermer-fenetre">Retour</button></div></form>');
  };
  P.formulaires['cachet-annuler'] = async (f, form) => {
    await P.sensible(() => P.rpc('cachet_annuler', { p_id: form.dataset.id, p_motif: t(f, 'motif') }));
    await C.actualiser('Cachet annulé (gardé dans l’historique).');
  };

  P.espaces.compta.pages.cachets = page;
  P.espaces.compta.nav.push(['cachets', 'Payer les mannequins']);  // (rangé par js/portail/espace-compta-dossier.js)
})();
