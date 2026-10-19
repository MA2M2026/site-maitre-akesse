// Messages des mensualités de formation (cahier v2.4, 5.6) : appel du 1er, relance du 3, dernière
// relance du 5. Partagés par l'espace 2 de l'Administration (navigateur) et par le serveur du site
// (api/portail.js, relances automatiques par e-mail). Destinataire : le parent pour un mineur.
(function (racine) {
  'use strict';
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const LIEN = 'https://www.maitreakessemodelmanagement.com/mes-paiements';
  const fcfa = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  function age(d) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(d || '')) return null;
    const n = new Date(String(d).slice(0, 10) + 'T12:00:00'), a = new Date();
    return a.getFullYear() - n.getFullYear() - ((a.getMonth() < n.getMonth() || (a.getMonth() === n.getMonth() && a.getDate() < n.getDate())) ? 1 : 0);
  }
  // m : { nom, telephone, email, date_naissance, parent_nom, parent_telephone, parent_email, mensualite }
  // type : 'appel' | 'relance3' | 'relance5' ; mois : Date du mois concerné
  function messageMensualite(m, type, mois) {
    const mineur = age(m.date_naissance) !== null && age(m.date_naissance) < 18 && !!(m.parent_telephone || m.parent_email);
    // « de mars 2026 », « d’octobre 2026 »
    const nomMois = MOIS[mois.getMonth()], duMois = (/^[aeiou]/.test(nomMois) ? 'd’' : 'de ') + nomMois + ' ' + mois.getFullYear();
    const qui = mineur ? ' de ' + m.nom : '';
    const corps = {
      appel: 'La mensualité de formation' + qui + ' ' + duMois + ' (' + fcfa(m.mensualite) + ') est à régler avant le 5 ' + nomMois + '.',
      relance3: 'Petit rappel : nous n’avons pas encore reçu la mensualité de formation' + qui + ' ' + duMois + ' (' + fcfa(m.mensualite) + '). La date limite est le 5 ' + nomMois + '.',
      relance5: 'Dernier rappel : aujourd’hui, 5 ' + nomMois + ', est la date limite pour la mensualité de formation' + qui + ' ' + duMois + ' (' + fcfa(m.mensualite) + ').'
    }[type];
    return {
      nom: mineur ? m.parent_nom || 'Madame, Monsieur' : m.nom,
      email: mineur ? m.parent_email : m.email,
      telephone: mineur ? m.parent_telephone : m.telephone,
      texte: 'Bonjour ' + (mineur ? m.parent_nom || 'Madame, Monsieur' : m.nom) + ',\n\n' + corps +
        '\nPaiement par Wave dans l’espace mannequin, rubrique « Mes paiements » : ' + LIEN + ' (puis « J’ai payé »).\n\nMerci !\nL’équipe Maître Akesse Model Management'
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { messageMensualite };
  else racine.messageMensualite = messageMensualite;
})(typeof window !== 'undefined' ? window : globalThis);
