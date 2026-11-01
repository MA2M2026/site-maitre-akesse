// Pages publiques ouvertes par un lien personnel, sans compte : « Confirmer ma présence »
// (confirmer.html, js/confirmer.js) et « Places limitées » (places.html, js/places.js). Ce qui
// leur est commun, sans recopier le code (23/10/2026) : appel d'une fonction de la base avec la
// clé publique (le jeton du lien seul donne accès), date en toutes lettres, lien non valable.
// (01/11/2026 : aussi importé par middleware.js, qui écrit la page « places » : window, ou globalThis côté serveur)
(typeof window !== 'undefined' ? window : globalThis).LienPublic = (function () {
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
    // Page « Places limitées » (js/places.js et middleware.js) : places encore libres, phrase d'accueil, et
    // message d'état [classe, titre, texte] (e : places_lire ; parent : lien du parent d'une mineure)
    placesRestantes: function (e) {
      var total = e.sexe === 'homme' ? e.places_hommes : e.places_femmes;
      return Math.max(0, total - (e.pris || []).filter(function (x) { return x.sexe === e.sexe; }).length);
    },
    placesDetails: function (e, parent) {
      var lieu = [e.lieu, e.ville].filter(Boolean);
      return (parent ? 'Bonjour ! Message pour le parent de ' + e.nom : 'Bonjour ' + [e.civilite, e.nom].filter(Boolean).join(' ')) + ' · ' + this.dateFr(e.date_debut) +
        (e.heure_evenement ? ', ' + e.heure_evenement.replace(':', 'h') : '') + (lieu.length ? ', ' + lieu.join(', ') : '') + '.';
    },
    placesEtat: function (e, parent) {
      var accord = function (f, h) { return e.sexe === 'homme' ? h : f; };
      var pris = e.statut === 'pris', libres = this.placesRestantes(e);
      if (e.passe) return ['oups', 'Ce projet est terminé.', ''];
      if (pris && parent && e.pris_par === 'mannequin') return ['bravo', '🎉 ' + accord('Votre fille', 'Votre fils') + ' a déjà pris sa place !', accord('Elle est sélectionnée', 'Il est sélectionné') + '. Vous recevrez la convocation avec tous les détails.'];
      if (pris && !parent && e.pris_par === 'parent') return ['bravo', '🎉 Bravo, vous êtes ' + accord('sélectionnée', 'sélectionné') + ' !', 'Votre parent a déjà pris votre place. Vous recevrez la convocation avec tous les détails.'];
      if (pris) return ['bravo', '🎉 Bravo, ' + (parent ? accord('votre fille est sélectionnée', 'votre fils est sélectionné') : 'vous êtes ' + accord('sélectionnée', 'sélectionné')) + ' !', 'Vous recevrez la convocation avec tous les détails.'];
      if (!e.ouvert) return ['oups', 'Les inscriptions sont fermées.', 'Rendez-vous au prochain projet !'];
      if (!libres) return ['oups', 'Oups… plus de place disponible.', 'Rendez-vous au prochain projet !'];
      return ['', (libres > 1 ? 'Il reste ' + libres + ' places' : 'Il reste 1 place') + ' pour les ' + accord('femmes', 'hommes') + '.', ' Premier arrivé, premier servi !' + (e.statut === 'desiste' ? ' (Vous vous étiez ' + accord('désistée', 'désisté') + ' : vous pouvez reprendre une place.)' : '')];
    },
    introuvable: function (el) { el.textContent = 'Ce lien n’est pas valable, ou le projet a été annulé. Contactez l’agence sur WhatsApp.'; }
  };
})();
