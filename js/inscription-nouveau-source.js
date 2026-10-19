// Source de données RÉELLE du parcours d'inscription simplifié (cahier v2.3, section 14) :
// mêmes fonctions que la démonstration (js/inscription-nouveau-simule.js), mais tout passe par
// le serveur du site (api/portail.js) : le code est vérifié dans la base (empreinte seulement),
// les essais ratés et le blocage sont comptés côté serveur, jamais dans le navigateur.
(function () {
  'use strict';
  var naissance = '', lien = '', note = null;
  function appeler(action, donnees) {
    return fetch('/api/portail', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action }, donnees))
    }).then(function (rep) {
      if (rep.status === 429) return { ok: false, raison: 'bloque' };
      return rep.json().then(function (corps) {
        if (!rep.ok) throw new Error(corps.error || 'Erreur serveur');
        return corps;
      });
    });
  }
  window.MA2M_INSCRIPTION_SOURCE = {
    simule: false,
    verifierCode: function (code, date) {
      return appeler('inscription_verifier', { code: code, naissance: date }).then(function (r) {
        if (r && r.ok) { naissance = date; lien = r.lien_wave || ''; note = r.note || null; }
        return r;
      });
    },
    corriger: function (code, champs) {
      return appeler('inscription_corriger', { code: code, naissance: naissance, telephone: champs.telephone, email: champs.email });
    },
    declarerPaiement: function (code, champs) {
      return appeler('inscription_declarer', { code: code, naissance: naissance, numero: champs.numero, reglement: !!champs.reglement, parent: !!champs.parent });
    },
    lienWave: function () { return lien; },
    note: function () { return note; }
  };
})();
