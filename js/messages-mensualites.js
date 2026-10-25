// Messages des mensualités de formation (cahier v2.4, 5.6) : appel du 1er, relance du 3, dernière
// relance du 5. Partagés par l'Administration (navigateur) et par le serveur du site (api/portail.js,
// relances automatiques par e-mail). Destinataire : le parent pour un mineur. Aussi partagés :
// l'âge (ageMannequin) et le numéro WhatsApp international (numeroWhatsAppMa2m).
(function (racine) {
  'use strict';
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  // Application MA2M Mannequin (25/10/2026) : tous les liens envoyés aux mannequins y mènent, plus à
  // l'Espace mannequin du site (fermé ; ses anciennes adresses y renvoient, vercel.json). Partagée
  // (MA2M_APPLI) avec js/messages-candidats.js, js/rapport-profils-admin.js, js/portail/espace-paiements.js.
  const MA2M_APPLI = 'https://mannequin.maitreakessemodelmanagement.com/app/';
  const LIEN = MA2M_APPLI + 'mes-paiements.html';
  const fcfa = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  function ageMannequin(d) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(d || '')) return null;
    const n = new Date(String(d).slice(0, 10) + 'T12:00:00'), a = new Date();
    return a.getFullYear() - n.getFullYear() - ((a.getMonth() < n.getMonth() || (a.getMonth() === n.getMonth() && a.getDate() < n.getDate())) ? 1 : 0);
  }
  // m : { nom, telephone, email, date_naissance, parent_nom, parent_telephone, parent_email, mensualite }
  // type : 'appel' | 'relance3' | 'relance5' ; mois : Date du mois concerné
  function messageMensualite(m, type, mois) {
    const a = ageMannequin(m.date_naissance), nom = m.nom || m.full_name;
    const mineur = a !== null && a < 18 && !!(m.parent_telephone || m.parent_email);
    // « de mars 2026 », « d’octobre 2026 »
    const nomMois = MOIS[mois.getMonth()], duMois = (/^[aeiou]/.test(nomMois) ? 'd’' : 'de ') + nomMois + ' ' + mois.getFullYear();
    const qui = mineur ? ' de ' + nom : '';
    const corps = {
      appel: 'La mensualité de formation' + qui + ' ' + duMois + ' (' + fcfa(m.mensualite) + ') est à régler avant le 5 ' + nomMois + '.',
      relance3: 'Petit rappel : nous n’avons pas encore reçu la mensualité de formation' + qui + ' ' + duMois + ' (' + fcfa(m.mensualite) + '). La date limite est le 5 ' + nomMois + '.',
      relance5: 'Dernier rappel : aujourd’hui, 5 ' + nomMois + ', est la date limite pour la mensualité de formation' + qui + ' ' + duMois + ' (' + fcfa(m.mensualite) + ').'
    }[type];
    return {
      nom: mineur ? m.parent_nom || 'Madame, Monsieur' : nom,
      email: mineur ? m.parent_email : m.email,
      telephone: mineur ? m.parent_telephone : m.telephone,
      texte: 'Bonjour ' + (mineur ? m.parent_nom || 'Madame, Monsieur' : nom) + ',\n\n' + corps +
        '\nPaiement par Wave dans l’application MA2M Mannequin, onglet « Paiements » : ' + LIEN + ' (puis « J’ai payé »).\n\nMerci !\nL’équipe Maître Akesse Model Management'
    };
  }
  // Numéro pour wa.me : sans « + » ni « 00 », indicatif ivoirien ajouté si absent ('' si trop court)
  function numeroWhatsAppMa2m(tel) {
    let n = String(tel || '').replace(/[^\d]/g, '');
    if (n.indexOf('00') === 0) n = n.slice(2);
    if ((n.length === 10 && n.charAt(0) === '0') || n.length === 8) n = '225' + n;
    return n.length >= 8 ? n : '';
  }
  const outils = { messageMensualite, ageMannequin, numeroWhatsAppMa2m, MA2M_APPLI };
  if (typeof module !== 'undefined' && module.exports) module.exports = outils;
  else Object.assign(racine, outils);
})(typeof window !== 'undefined' ? window : globalThis);
