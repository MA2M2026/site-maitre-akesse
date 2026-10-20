// Espace 2 — suite du suivi des paiements (cahier V3, 7.2) : trois pages ajoutées au menu.
//   • Rapprochement Wave : numéro du payeur, référence et montant vus dans Wave, « Introuvable » /
//     « Précision demandée », alertes (montant différent, référence en double, déclaration sans suite) ;
//   • Sorties et suspensions : l'encaissement propose, l'administrateur principal décide (code récent) ;
//   • Mois figés : photo inchangeable d'un mois terminé.
// Base : supabase-bloc2-complements.sql (rapprochements, sorties_mannequins, recaps_mensuels).
// Chargé APRÈS espace-paiements.js, dont il complète le menu et les pages.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces || !P.espaces.paiements) return;
  const E = P.espaces.paiements;
  const estPrincipal = () => !!(P.moi && P.moi.role === 'principal');
  const jours = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  const ABSENT = '<div class="note info">Cette page sera disponible dès que le fichier SQL « compléments » aura été exécuté dans Supabase.</div>';
  const vide = (v) => { const t = String(v == null ? '' : v).trim(); return t === '' ? null : t; };

  // ---------- Rapprochement Wave ----------
  const ETATS_RAPP = { a_verifier: ['À vérifier', 'neutre'], introuvable: ['Introuvable dans Wave', 'erreur'], precision: ['Précision demandée', 'alerte'], rapproche: ['Rapproché', 'ok'] };
  async function rapprochement() {
    const liste = await P.bd(sb.from('paiements_mannequins').select('*, mannequin:agence_mannequins(full_name, telephone)')
      .eq('statut', 'declare').order('declare_le', { ascending: true }));
    let rapps;
    try { rapps = await P.bd(sb.from('rapprochements').select('*')); } catch (e) { return P.entete('Rapprochement Wave') + ABSENT; }
    const parPaiement = {};
    rapps.forEach((r) => { parPaiement[r.paiement_id] = r; });
    const references = {};
    rapps.filter((r) => r.reference_paiement).forEach((r) => { const k = r.reference_paiement.trim().toLowerCase(); references[k] = (references[k] || 0) + 1; });
    // une inscription (15 000) et son 1er mois (10 000) déclarés ensemble : une seule ligne de 25 000
    const groupes = [];
    liste.forEach((p) => {
      const g = groupes.find((x) => x.mannequin_id === p.mannequin_id && x.declare_le === p.declare_le);
      if (g) { g.total += p.montant || 0; if (p.objet === 'inscription') g.principal = p; } else groupes.push({ mannequin_id: p.mannequin_id, declare_le: p.declare_le, principal: p, total: p.montant || 0 });
    });
    const lignes = groupes.map((g) => {
      const p = g.principal, r = parPaiement[p.id] || null, alertes = [];
      if (r && r.montant_recu && r.montant_recu !== g.total) alertes.push('Montant différent : ' + P.fcfa(r.montant_recu) + ' vu dans Wave, ' + P.fcfa(g.total) + ' déclaré');
      if (r && r.reference_paiement && references[r.reference_paiement.trim().toLowerCase()] > 1) alertes.push('Cette référence est déjà utilisée par un autre paiement');
      if (jours(g.declare_le) >= 3 && (!r || r.etat !== 'rapproche')) alertes.push('Déclaré sans suite depuis ' + jours(g.declare_le) + ' jours');
      return { g, p, r, alertes };
    });
    const nbAlertes = lignes.filter((l) => l.alertes.length).length;
    return P.entete('Rapprochement Wave', P.pastille(nbAlertes ? nbAlertes + ' à regarder' : 'Aucune alerte', nbAlertes ? 'alerte' : 'ok')) +
      '<div class="note info">Comparez chaque déclaration avec Wave Business : numéro du payeur, référence et montant. Quand tout correspond, « Valider ». Sinon, notez « Introuvable » ou « Précision demandée », avec une note.</div>' +
      P.tableau(['Mannequin', 'Déclaré', 'Numéro du payeur', 'Vu dans Wave', 'État', ''], lignes.map((l) => {
        const e = ETATS_RAPP[(l.r && l.r.etat) || 'a_verifier'];
        return '<tr' + (l.alertes.length ? ' class="ligne-retard"' : '') + '><td><b>' + P.esc(l.p.mannequin ? l.p.mannequin.full_name : '—') + '</b><div class="petit-texte doux">' + P.esc((l.p.mannequin && l.p.mannequin.telephone) || '') + '</div></td>' +
          '<td class="nombre">' + P.fcfa(l.g.total) + '<div class="petit-texte doux">' + P.esc(l.p.objet === 'inscription' ? 'Inscription' : 'Mensualité') + ' · ' + P.dateHeure(l.g.declare_le) + '</div></td>' +
          '<td>' + P.esc((l.r && l.r.numero_payeur) || 'Non communiqué') + '</td>' +
          '<td>' + (l.r && (l.r.reference_paiement || l.r.montant_recu) ? P.esc(l.r.reference_paiement || '—') + (l.r.montant_recu ? '<div class="petit-texte">' + P.fcfa(l.r.montant_recu) + '</div>' : '') : '<span class="doux">à saisir</span>') + '</td>' +
          '<td>' + P.pastille(e[0], e[1]) + (l.r && l.r.note ? '<div class="petit-texte doux">' + P.esc(l.r.note) + '</div>' : '') +
          l.alertes.map((a) => '<div class="petit-texte" style="color:var(--erreur-texte,#a00)" role="alert">⚠ ' + P.esc(a) + '</div>').join('') + '</td>' +
          '<td class="ligne"><button class="btn petit" type="button" data-action="rapprochement-ouvrir" data-id="' + l.p.id + '">Rapprocher</button>' +
          '<button class="btn rouge petit" type="button" data-action="paiement-valider" data-id="' + l.p.id + '">Valider</button>' +
          '<button class="btn petit" type="button" data-action="paiement-refuser" data-id="' + l.p.id + '">Refuser</button></td></tr>';
      }));
  }
  P.actions['rapprochement-ouvrir'] = async (el) => {
    const id = el.getAttribute('data-id');
    const ex = await P.bd(sb.from('rapprochements').select('*').eq('paiement_id', id));
    const r = ex[0] || {};
    P.fenetre('<h2>Rapprocher avec Wave</h2><form class="f" data-form="rapprochement-enregistrer" data-id="' + P.esc(id) + '">' +
      '<label class="fl" for="rp-ref">Référence de la transaction dans Wave<input id="rp-ref" name="reference" maxlength="60" value="' + P.esc(r.reference_paiement || '') + '"></label>' +
      '<label class="fl" for="rp-montant">Montant vu dans Wave (FCFA)<input id="rp-montant" name="montant" type="number" min="1" step="1" value="' + P.esc(r.montant_recu || '') + '"></label>' +
      '<label class="fl" for="rp-etat">État<select id="rp-etat" name="etat">' + Object.keys(ETATS_RAPP).map((k) => '<option value="' + k + '"' + ((r.etat || 'a_verifier') === k ? ' selected' : '') + '>' + P.esc(ETATS_RAPP[k][0]) + '</option>').join('') + '</select></label>' +
      '<label class="fl large" for="rp-note">Note (obligatoire pour « Introuvable » et « Précision demandée »)<textarea id="rp-note" name="note" rows="3">' + P.esc(r.note || '') + '</textarea></label>' +
      '<div class="large ligne"><button class="btn rouge" type="submit">Enregistrer</button><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div></form>');
  };
  P.formulaires['rapprochement-enregistrer'] = async (f, form) => {
    const id = form.getAttribute('data-id'), etat = f.get('etat'), note = vide(f.get('note'));
    const montant = vide(f.get('montant')) ? Math.round(Number(f.get('montant'))) : null;
    if (['introuvable', 'precision'].includes(etat) && !note) return P.message('Ajoutez une note pour « Introuvable » ou « Précision demandée ».');
    if (montant !== null && !(montant > 0)) return P.message('Le montant doit être un nombre positif.');
    const ligne = { reference_paiement: vide(f.get('reference')), montant_recu: montant, etat, note };
    try {
      const ex = await P.bd(sb.from('rapprochements').select('paiement_id').eq('paiement_id', id));
      if (ex.length) await P.bd(sb.from('rapprochements').update(ligne).eq('paiement_id', id).select('paiement_id'));
      else await P.bd(sb.from('rapprochements').insert(Object.assign({ paiement_id: id }, ligne)).select('paiement_id'));
      P.fenetre(''); P.message('Rapprochement enregistré.'); await P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  // ---------- Sorties et suspensions ----------
  const TYPES_SORTIE = { suspendu: 'Suspension', sorti: 'Sortie définitive' };
  const DECISIONS = { en_attente: ['En attente de décision', 'alerte'], accepte: ['Acceptée', 'ok'], refuse: ['Refusée', 'neutre'] };
  async function sorties() {
    let props, registre;
    try {
      [props, registre] = await Promise.all([
        P.bd(sb.from('sorties_mannequins').select('*, mannequin:agence_mannequins(full_name)').order('propose_le', { ascending: false })),
        P.bd(sb.from('agence_mannequins').select('id, full_name, statut, date_entree').order('full_name'))
      ]);
    } catch (e) { return P.entete('Sorties et suspensions') + ABSENT; }
    const principal = estPrincipal();
    const attente = props.filter((x) => x.decision === 'en_attente'), enAttenteIds = new Set(attente.map((x) => x.mannequin_id));
    const proposables = registre.filter((m) => m.statut === 'actif' && !enAttenteIds.has(m.id));
    const inactifs = registre.filter((m) => m.statut !== 'actif');
    // formation de 24 mois écoulée : plus de mensualité à attendre, donc plus d'appel ni de relance une fois sortie
    const limite = new Date(); limite.setMonth(limite.getMonth() - 24);
    const terminees = proposables.filter((m) => m.date_entree && new Date(m.date_entree) <= limite);
    return P.entete('Sorties et suspensions', P.pastille(attente.length + ' en attente', attente.length ? 'alerte' : 'ok')) +
      '<div class="note info">L’équipe d’encaissement propose une suspension ou une sortie avec un motif ; seul l’administrateur principal décide, avec son code. Rien n’est supprimé : un mannequin sorti peut être réactivé.</div>' +
      '<div class="carte"><h2>Proposer</h2>' + (proposables.length
        ? '<form class="f" data-form="sortie-proposer"><label class="fl" for="so-mannequin">Mannequin<select id="so-mannequin" name="mannequin">' + proposables.map((m) => '<option value="' + P.esc(m.id) + '">' + P.esc(m.full_name) + '</option>').join('') + '</select></label>' +
          '<label class="fl" for="so-type">Type<select id="so-type" name="type"><option value="suspendu">Suspension</option><option value="sorti">Sortie définitive</option></select></label>' +
          '<label class="fl large" for="so-motif">Motif (obligatoire)<textarea id="so-motif" name="motif" rows="3" required></textarea></label>' +
          '<div class="large ligne"><button class="btn rouge" type="submit">Envoyer la proposition</button></div></form>'
        : '<p class="doux">Aucun mannequin actif à proposer.</p>') + '</div>' +
      (terminees.length ? '<div class="carte"><h2>Formation terminée (24 mois écoulés)</h2><p class="doux">Ces mannequins ne paient plus de mensualité. Proposez leur sortie : ils ne recevront plus aucun appel ni relance.</p>' +
        P.tableau(['Mannequin', 'Entrée à l’agence', ''], terminees.map((m) => '<tr><td><b>' + P.esc(m.full_name) + '</b></td><td>' + P.esc(P.date(m.date_entree)) + '</td><td><button class="btn rouge petit" type="button" data-action="sortie-formation-terminee" data-id="' + m.id + '">Proposer la sortie</button></td></tr>')) + '</div>' : '') +
      '<div class="carte"><h2>En attente de décision</h2>' + (attente.length ? P.tableau(['Mannequin', 'Proposition', 'Motif', 'Proposée le', ''], attente.map((x) =>
        '<tr><td><b>' + P.esc(x.mannequin ? x.mannequin.full_name : '—') + '</b></td><td>' + P.esc(TYPES_SORTIE[x.type] || x.type) + '</td><td>' + P.esc(x.motif) + '</td><td>' + P.dateHeure(x.propose_le) + '</td>' +
        '<td class="ligne">' + (principal ? '<button class="btn rouge petit" type="button" data-action="sortie-decider" data-id="' + x.id + '" data-accepter="1">Accepter</button><button class="btn petit" type="button" data-action="sortie-decider" data-id="' + x.id + '" data-accepter="0">Refuser</button>' : '<span class="doux">Décision de l’administrateur principal</span>') + '</td></tr>')) : '<p class="doux">Aucune proposition en attente.</p>') + '</div>' +
      '<div class="carte"><h2>Suspendus et sortis</h2>' + (inactifs.length ? P.tableau(['Mannequin', 'Statut', ''], inactifs.map((m) =>
        '<tr><td><b>' + P.esc(m.full_name) + '</b></td><td>' + P.pastille(m.statut === 'sorti' ? 'Sorti' : 'Suspendu', 'neutre') + '</td><td>' +
        (principal ? '<button class="btn petit" type="button" data-action="mannequin-reactiver" data-id="' + m.id + '">Réactiver</button>' : '') + '</td></tr>')) : '<p class="doux">Personne n’est suspendu ni sorti.</p>') + '</div>' +
      '<div class="carte"><h2>Historique des décisions</h2>' + (props.filter((x) => x.decision !== 'en_attente').length ? P.tableau(['Mannequin', 'Proposition', 'Décision', 'Le', 'Motif de la décision'], props.filter((x) => x.decision !== 'en_attente').map((x) =>
        '<tr><td>' + P.esc(x.mannequin ? x.mannequin.full_name : '—') + '</td><td>' + P.esc(TYPES_SORTIE[x.type] || x.type) + '</td><td>' + P.pastille(DECISIONS[x.decision][0], DECISIONS[x.decision][1]) + '</td><td>' + P.dateHeure(x.decide_le) + '</td><td>' + P.esc(x.motif_decision || '—') + '</td></tr>')) : '<p class="doux">Aucune décision pour l’instant.</p>') + '</div>';
  }
  P.formulaires['sortie-proposer'] = async (f) => {
    const motif = String(f.get('motif') || '').trim();
    if (!motif) return P.message('Le motif est obligatoire.');
    try {
      await P.rpc('sortie_proposer', { p_mannequin: f.get('mannequin'), p_type: f.get('type'), p_motif: motif });
      P.message('Proposition envoyée à l’administrateur principal.'); await P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['sortie-formation-terminee'] = async (el) => {
    if (!confirm('Proposer la sortie de ce mannequin (formation terminée) ? L’administrateur principal devra la confirmer.')) return;
    try {
      await P.rpc('sortie_proposer', { p_mannequin: el.getAttribute('data-id'), p_type: 'sorti', p_motif: 'Formation terminée (24 mois)' });
      P.message('Proposition envoyée.'); await P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['sortie-decider'] = async (el) => {
    const accepter = el.getAttribute('data-accepter') === '1';
    let motif = null;
    if (!accepter) { motif = (prompt('Motif du refus (obligatoire) :') || '').trim(); if (!motif) return; }
    else if (!confirm('Accepter cette proposition ? Le statut du mannequin changera aussitôt.')) return;
    try {
      await P.sensible(() => P.rpc('sortie_decider', { p_id: el.getAttribute('data-id'), p_accepter: accepter, p_motif: motif }));
      P.message(accepter ? 'Proposition acceptée.' : 'Proposition refusée.'); await P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['mannequin-reactiver'] = async (el) => {
    const motif = (prompt('Motif de la réactivation (obligatoire) :') || '').trim();
    if (!motif) return;
    try {
      await P.sensible(() => P.rpc('mannequin_reactiver', { p_mannequin: el.getAttribute('data-id'), p_motif: motif }));
      P.message('Mannequin réactivé.'); await P.afficher();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  // ---------- Mois figés ----------
  const ETATS_FIGES = { paye: 'Payé', attente: 'En attente', non_paye: 'Non payé', a_payer: 'À payer', a_venir: 'À venir' };
  const moisIso = (decalage) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - decalage); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };
  async function figes() {
    let liste;
    try { liste = await P.bd(sb.from('recaps_mensuels').select('*').order('mois', { ascending: false })); } catch (e) { return P.entete('Mois figés') + ABSENT; }
    const deja = new Set(liste.map((x) => x.mois));
    const possibles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(moisIso).filter((m) => !deja.has(m));
    return P.entete('Mois figés', P.pastille(liste.length + ' figé' + (liste.length > 1 ? 's' : ''), 'ok')) +
      '<div class="note info">Figer un mois terminé en garde une photo qui ne change plus, même si on corrige un paiement ensuite. C’est la référence à remettre au comptable ou à conserver.</div>' +
      '<div class="carte"><h2>Figer un mois</h2>' + (possibles.length
        ? '<form class="f" data-form="mois-figer"><label class="fl" for="fg-mois">Mois terminé<select id="fg-mois" name="mois">' + possibles.map((m) => '<option value="' + m + '">' + P.esc(P.mois(m)) + '</option>').join('') + '</select></label>' +
          '<div class="large ligne"><button class="btn rouge" type="submit">Figer ce mois</button></div></form>'
        : '<p class="doux">Tous les mois terminés des douze derniers mois sont figés.</p>') + '</div>' +
      (liste.length ? P.tableau(['Mois', 'Figé le', 'Mannequins', 'Payé', 'Encaissé', ''], liste.map((x) => {
        const l = (x.donnees && x.donnees.lignes) || [];
        return '<tr><td><b>' + P.esc(P.mois(x.mois)) + '</b></td><td>' + P.dateHeure(x.fige_le) + '</td><td class="nombre">' + l.length + '</td><td class="nombre">' + l.filter((y) => y.etat === 'paye').length + '</td>' +
          '<td class="nombre">' + P.fcfa(l.reduce((s, y) => s + (y.valide || 0), 0)) + '</td><td><button class="btn petit" type="button" data-action="mois-fige-voir" data-mois="' + x.mois + '">Voir</button></td></tr>';
      })) : '<div class="carte"><p class="doux">Aucun mois figé pour l’instant.</p></div>');
  }
  P.formulaires['mois-figer'] = async (f) => {
    const mois = f.get('mois');
    if (!confirm('Figer ' + P.mois(mois) + ' ? La photo ne pourra plus être modifiée ni effacée.')) return;
    try { await P.rpc('recap_figer', { p_mois: mois }); P.message('Mois figé.'); await P.afficher(); } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions['mois-fige-voir'] = async (el) => {
    const r = await P.bd(sb.from('recaps_mensuels').select('*').eq('mois', el.getAttribute('data-mois')));
    const l = (r[0] && r[0].donnees && r[0].donnees.lignes) || [];
    P.fenetre('<h2>' + P.esc(P.mois(el.getAttribute('data-mois'))) + ' — figé</h2>' + P.tableau(['Mannequin', 'Statut', 'État du mois', 'Encaissé'], l.map((y) =>
      '<tr><td>' + P.esc(y.nom) + '</td><td>' + P.esc(y.statut) + '</td><td>' + P.esc(ETATS_FIGES[y.etat] || y.etat || '—') + '</td><td class="nombre">' + P.fcfa(y.valide || 0) + '</td></tr>')) +
      '<div class="ligne" style="margin-top:12px"><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div>');
  };

  // ---------- Menu et pages ----------
  const apres = (cle, entree) => { const i = E.nav.findIndex((n) => n[0] === cle); E.nav.splice(i < 0 ? E.nav.length : i + 1, 0, entree); };
  apres('recapitulatif', ['figes', 'Mois figés']);
  apres('a-valider', ['rapprochement', 'Rapprochement Wave']);
  apres('registre', ['sorties', 'Sorties et suspensions']);
  Object.assign(E.pages, { rapprochement, sorties, figes });
})();
