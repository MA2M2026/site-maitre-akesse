// Moyens de paiement (12/11/2026, demande de la propriétaire) : UNE copie pour les pages de paiement des mannequins
// (js/mes-paiements.js : site et application) et l'Administration (js/portail/espace-paiements.js).
// Six moyens préparés — Wave, Orange Money, MTN Money, Moov Money, carte bancaire (Visa), virement — allumés un par
// un dans l'Administration (Paramètres > Moyens de paiement) avec leur numéro, lien ou RIB : le jour où l'agence a le
// compte, rien à changer dans le site. Base : supabase-moyens-paiement.sql (moyens_paiement, moyens_paiement_publics,
// paiements_preciser_moyen). Tant que ce fichier n'est pas collé : Wave seul, comme avant.
(function () {
  'use strict';
  const NOMS = { wave: 'Wave', orange_money: 'Orange Money', mtn_money: 'MTN Money', moov_money: 'Moov Money', carte: 'Carte bancaire (Visa)',
    virement: 'Virement bancaire', especes: 'Espèces', avant_systeme: 'Avant le nouveau système' };
  const PREPARES = ['wave', 'orange_money', 'mtn_money', 'moov_money', 'carte', 'virement'];
  const MOBILE = ['orange_money', 'mtn_money', 'moov_money'];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fcfa = (n) => Number(n || 0).toLocaleString('fr-FR').replace(/ /g, ' ') + ' FCFA';
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
  function choix(moyens, choisi, cle) {
    const allumes = moyens.map((m) => m.code), bientot = PREPARES.filter((c) => allumes.indexOf(c) < 0).map(nom);
    return (moyens.length > 1 ? '<div class="mp-moyens" role="group" aria-label="Moyen de paiement">' + moyens.map((m) =>
      '<button type="button" class="mp-moyen' + (m.code === choisi ? ' choisi' : '') + '" data-moyen="' + esc(m.code) + '" data-mois="' + esc(cle) + '" aria-pressed="' + (m.code === choisi) + '">' + esc(m.nom || nom(m.code)) + '</button>').join('') + '</div>'
      : '<p class="mp-petit">Moyen de paiement : <b>' + esc(nom(choisi)) + '</b></p>') +
      (bientot.length ? '<p class="mp-petit">Bientôt : ' + esc(bientot.join(', ')) + '.</p>' : '');
  }

  // où et comment payer avec un moyen autre que Wave (Wave garde son lien, js/mes-paiements.js)
  function consigne(m, montant) {
    if (!m) return '';
    const libre = m.consignes ? '<p class="mp-petit">' + esc(m.consignes) + '</p>' : '';
    if (MOBILE.indexOf(m.code) >= 0) {
      return '<div class="mp-consigne"><p>Envoyez <b>' + fcfa(montant) + '</b> par ' + esc(m.nom || nom(m.code)) + ' au <b class="mp-numero">' + esc(m.numero || '') + '</b>' +
        (m.titulaire ? ' (au nom de ' + esc(m.titulaire) + ')' : '') + '.</p>' + libre + '</div>';
    }
    if (m.code === 'carte') {
      return '<a class="btn btn--principal" data-mp="lien" data-ouvre="1" href="' + esc(m.lien || '#') + '" target="_blank" rel="noopener">1 · Payer ' + fcfa(montant) + ' par carte</a>' + libre;
    }
    if (m.code === 'virement') {
      return '<div class="mp-consigne"><p>Virez <b>' + fcfa(montant) + '</b>' + (m.titulaire ? ' à ' + esc(m.titulaire) : '') + ' :</p><p class="mp-numero">' + esc(m.rib || '') + '</p>' + libre + '</div>';
    }
    return libre;
  }

  window.MoyensPaiement = { NOMS, PREPARES, MOBILE, nom, charger, choix, consigne };
})();
