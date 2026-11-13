// Moyens de paiement (12/11/2026, demande de la propriétaire) : UNE copie pour les pages de paiement des mannequins
// (js/mes-paiements.js : site et application) et l'Administration (js/portail/espace-paiements.js).
// Six moyens préparés — Wave, Orange Money, MTN Money, Moov Money, carte bancaire (Visa), virement — allumés un par
// un dans l'Administration (Paramètres > Moyens de paiement) avec leur numéro, lien ou RIB : le jour où l'agence a le
// compte, rien à changer dans le site. Base : supabase-moyens-paiement.sql (moyens_paiement, moyens_paiement_publics,
// mensualite_declarer_avec_numero et mensualites_payer_avance avec le moyen). Tant que ce fichier n'est pas collé : Wave seul, comme avant.
(function () {
  'use strict';
  const NOMS = { wave: 'Wave', orange_money: 'Orange Money', mtn_money: 'MTN Money', moov_money: 'Moov Money', carte: 'Carte bancaire (Visa)',
    virement: 'Virement bancaire', cheque: 'Chèque', especes: 'Espèces', avant_systeme: 'Avant le nouveau système' };
  const PREPARES = ['wave', 'orange_money', 'mtn_money', 'moov_money', 'carte', 'virement'];
  const MOBILE = ['orange_money', 'mtn_money', 'moov_money'];
  const esc = (s) => window.echapperHtml(s == null ? '' : s);  // (js/app.js)
  const fcfa = (n) => window.CachetsMa2m.fcfa(n);  // (js/cachets-communs.js, chargé avant)
  const nom = (code) => NOMS[code] || code || '';

  // moyens allumés (Wave seul si la base ne répond pas ou si le fichier n'est pas encore collé)
  async function charger(sb) {
    try {
      const { data, error } = await sb.rpc('moyens_paiement_publics');
      if (error || !Array.isArray(data) || !data.length) throw error || new Error('vide');
      return data.filter((m) => PREPARES.indexOf(m.code) >= 0);
    } catch (e) { return [{ code: 'wave', nom: 'Wave' }]; }
  }

  // boutons de choix (seulement s'il y a plus d'un moyen) ; cle : le paiement concerné ; puis les moyens « bientôt »
  // (Wave n'est jamais annoncé « bientôt » : s'il est éteint, c'est un choix de l'agence)
  function choix(moyens, choisi, cle) {
    const allumes = moyens.map((m) => m.code), bientot = PREPARES.filter((c) => c !== 'wave' && allumes.indexOf(c) < 0).map(nom);
    return (moyens.length > 1 ? '<div class="mp-moyens" role="group" aria-label="Moyen de paiement">' + moyens.map((m) =>
      '<button type="button" data-bouton-libre class="mp-moyen' + (m.code === choisi ? ' choisi' : '') + '" data-moyen="' + esc(m.code) + '" data-mois="' + esc(cle) + '" aria-pressed="' + (m.code === choisi) + '">' + (m.code === choisi ? '✓ ' : '') + esc(m.nom || nom(m.code)) + '</button>').join('') + '</div>'
      : '<p class="mp-petit">Moyen de paiement : <b>' + esc(nom(choisi)) + '</b></p>') +
      (bientot.length ? '<p class="mp-petit">Bientôt : ' + esc(bientot.join(', ')) + '.</p>' : '');
  }

  // où et comment payer (Wave : seulement la phrase de l'agence, son lien est dans js/mes-paiements.js) ; cle : le
  // paiement concerné (porté par le lien de la carte, pour ouvrir « J'ai payé » ensuite)
  function consigne(m, montant, cle) {
    if (!m) return '';
    const libre = m.consignes ? '<p class="mp-petit">' + esc(m.consignes) + '</p>' : '';
    if (MOBILE.indexOf(m.code) >= 0) {
      return '<div class="mp-consigne"><p>Envoyez <b>' + fcfa(montant) + '</b> par ' + esc(m.nom || nom(m.code)) + ' au <b class="mp-numero">' + esc(m.numero || '') + '</b>' +
        (m.titulaire ? ' (au nom de ' + esc(m.titulaire) + ')' : '') + '.</p>' + libre + '</div>';
    }
    if (m.code === 'carte') {
      return '<a class="btn btn--principal" data-mp="lien" data-mois="' + esc(cle) + '" href="' + esc(m.lien || '#') + '" target="_blank" rel="noopener">1 · Payer ' + fcfa(montant) + ' par carte</a>' + libre;
    }
    if (m.code === 'virement') {
      return '<div class="mp-consigne"><p>Virez <b>' + fcfa(montant) + '</b>' + (m.titulaire ? ' à ' + esc(m.titulaire) : '') + ' :</p><p class="mp-numero">' + esc(m.rib || '') + '</p>' + libre + '</div>';
    }
    return libre;
  }

  window.MoyensPaiement = { NOMS, PREPARES, MOBILE, nom, charger, choix, consigne };
})();
