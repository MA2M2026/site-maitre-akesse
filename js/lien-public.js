// Pages publiques ouvertes par un lien personnel, sans compte : « Confirmer ma présence »
// (confirmer.html, js/confirmer.js) et « Places limitées » (places.html, js/places.js). Ce qui
// leur est commun, sans recopier le code (23/10/2026) : appel d'une fonction de la base avec la
// clé publique (le jeton du lien seul donne accès), date en toutes lettres, lien non valable.
window.LienPublic = (function () {
  'use strict';
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return {
    rpc: function (nom, params) {
      return fetch(SUPABASE_URL + '/rest/v1/rpc/' + nom, {
        method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    },
    // 'AAAA-MM-JJ' → « samedi 15 novembre 2026 »
    dateFr: function (iso) {
      var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return '';
      var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      return JOURS[d.getUTCDay()] + ' ' + (+m[3] === 1 ? '1er' : +m[3]) + ' ' + MOIS[+m[2] - 1] + ' ' + m[1];
    },
    // jeton bien formé (36 caractères) et configuration de la base présente
    jetonValable: function (jeton) { return /^[0-9a-f]{36}$/.test(jeton) && typeof SUPABASE_URL !== 'undefined'; },
    introuvable: function (el) { el.textContent = 'Ce lien n’est pas valable, ou le projet a été annulé. Contactez l’agence sur WhatsApp.'; }
  };
})();
