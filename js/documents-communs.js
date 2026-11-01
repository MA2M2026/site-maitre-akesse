// Documents des mannequins (chantier 14, 01/11/2026) : noms des sortes de documents et date en français,
// partagés par l'Administration (js/admin/site-documents.js, window.DocumentsMa2m) et l'e-mail du matin du
// serveur (api/portail.js, require). Ajouter une sorte ici (et dans supabase-documents.sql).
(function (racine) {
  'use strict';
  const SORTES = [['autorisation_parentale', 'Autorisation parentale'], ['piece_identite', 'Pièce d’identité'], ['contrat', 'Contrat'], ['autre', 'Autre document']];
  const nomSorte = (s) => (SORTES.find((x) => x[0] === s) || [s, 'Document'])[1];
  // « 2026-11-20 » → « 20/11/2026 »
  const dateFr = (iso) => { const [a, m, j] = String(iso || '').slice(0, 10).split('-'); return j && m && a ? j + '/' + m + '/' + a : String(iso || ''); };
  const exportes = { SORTES, nomSorte, dateFr };
  if (typeof module !== 'undefined' && module.exports) module.exports = exportes;
  else racine.DocumentsMa2m = exportes;
})(typeof window !== 'undefined' ? window : globalThis);
