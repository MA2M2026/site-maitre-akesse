// Atelier Talons & Élégance : ce qui est commun à la page publique d'inscription (js/cours-talons.js), à la page
// « Mon programme » de l'élève (js/programme-talons.js) et à sa fiche dans l'Administration
// (js/admin/site-cours-talons.js) — écrit UNE fois (règle 5 du site, 14/11/2026). Le lieu par défaut est aussi celui
// du remplissage automatique des dimanches dans la base (supabase-programme-talons.sql).
// Abidjan est à l'heure UTC toute l'année : les heures sont lues en UTC.
window.TalonsCommun = (function () {
  'use strict';
  return {
    NUMERO_AGENCE: '2250545656687',
    LIEU_SALLE: 'Salle MA2M, Riviera Faya',
    JOURS: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    MOIS: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    MOIS_COURTS: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    // 15 h, 16 h 30
    heure: function (d) { return d.getUTCHours() + ' h' + (d.getUTCMinutes() ? ' ' + String(d.getUTCMinutes()).padStart(2, '0') : ''); },
    PRIX_MOIS: 30000,   // groupe : 30 000 FCFA le mois (4 dimanches), comme cours_talons_prix_mois() dans la base
    // vouvoiement (demandes de la propriétaire du 14/11/2026) : la civilité choisie à l'inscription (« madame » ou
    // « mademoiselle ») ; pour une inscription plus ancienne, « Mademoiselle » si elle est mineure, sinon « Madame »
    civilite: function (choix, age) { return (choix || (age && age < 18 ? 'mademoiselle' : 'madame')) === 'mademoiselle' ? 'Mademoiselle' : 'Madame'; },
    // 30000 → « 30 000 FCFA »
    fcfa: function (n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0FCFA'; }
  };
})();
