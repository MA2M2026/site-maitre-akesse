// Source de données SIMULÉE du parcours d'inscription simplifié (démonstration, 18/10/2026).
// Rien n'est lu ni écrit en base : tout vit dans la mémoire de la page et disparaît au rechargement.
// Quand la propriétaire aura donné son accord écrit pour la vraie base, ce fichier sera remplacé
// par un « adaptateur » qui offre les MÊMES trois fonctions (verifierCode, corriger,
// declarerPaiement) mais les confie au serveur : les essais ratés et le blocage du code y seront
// comptés côté serveur, jamais dans le navigateur. js/inscription-nouveau.js ne change pas.
(function () {
  'use strict';
  var CANDIDATS = {
    'MA2M-DEMO-01': { nom: 'Awa Koné', naissance: '2001-03-12', telephone: '07 00 00 00 01', email: 'awa@exemple.com', origine: 'Casting en ligne', parent: null, etat: 'retenu', essais: 0 },
    'MA2M-DEMO-02': { nom: 'Yao Brou', naissance: '2010-05-03', telephone: '07 00 00 00 02', email: '', origine: 'Casting en ligne', parent: { nom: 'Parent de Yao' }, etat: 'retenu', essais: 0 }
  };
  var MAX_ESSAIS = 3;
  function pause(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 350); }); }
  function normaliser(c) { return String(c || '').trim().toUpperCase(); }

  window.MA2M_INSCRIPTION_SOURCE = {
    simule: true,
    verifierCode: function (code, naissance) {
      var c = CANDIDATS[normaliser(code)];
      if (c && c.essais >= MAX_ESSAIS) return pause({ ok: false, raison: 'bloque' });
      if (!c) return pause({ ok: false, raison: 'inconnu' });
      if (c.etat !== 'retenu') return pause({ ok: false, raison: 'deja_utilise' });
      if (c.naissance !== naissance) {
        c.essais++;
        return pause({ ok: false, raison: c.essais >= MAX_ESSAIS ? 'bloque' : 'inconnu', essais: c.essais });
      }
      c.essais = 0;
      return pause({ ok: true, candidat: { nom: c.nom, naissance: c.naissance, telephone: c.telephone, email: c.email, origine: c.origine, parent: c.parent } });
    },
    corriger: function (code, champs) {
      var c = CANDIDATS[normaliser(code)];
      if (!c) return pause({ ok: false });
      if (champs.telephone) c.telephone = champs.telephone;
      c.email = champs.email || '';
      return pause({ ok: true });
    },
    declarerPaiement: function (code) {
      var c = CANDIDATS[normaliser(code)];
      if (!c) return pause({ ok: false });
      c.etat = 'paiement_declare';
      return pause({ ok: true });
    }
  };
})();
