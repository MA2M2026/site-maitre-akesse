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
    // vouvoiement (demande de la propriétaire du 14/11/2026) : « Madame », « Mademoiselle » pour une mineure
    civilite: function (age) { return age && age < 18 ? 'Mademoiselle' : 'Madame'; }
  };
})();
