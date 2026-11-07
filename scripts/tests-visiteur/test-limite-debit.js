// Limite d'envois par compte sur les accès réservés (07/11/2026, W6 ; limiteDebit, api/_commun.js), sans rien
// envoyer pour de vrai (base simulée) : compteur dépassé → 429 avec Retry-After ; sous la limite → on passe ;
// compteur en panne → on passe (jamais bloquer l'agence) ; la clé compte l'accès ET le compte.
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'cle-essai';
const { limiteDebit } = require('../../api/_commun.js');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const reponse = () => { const r = { code: 200, entetes: {}, corps: null }; r.setHeader = (k, v) => { r.entetes[k] = v; }; r.status = (c) => { r.code = c; return { json: (o) => { r.corps = o; } }; }; return r; };
(async () => {
  let recu = null;
  global.fetch = async (u, o) => { recu = { u, corps: JSON.parse(o.body) }; return { ok: true, json: async () => false }; };
  let res = reponse();
  ok(await limiteDebit(res, 'r2-presigner', 'compte-1', 600) === true && res.code === 429 && res.entetes['Retry-After'] === '60' && /patientez/.test(res.corps.error), 'trop de demandes : refusé (429), « patientez un instant »');
  ok(/rpc\/limiter_soumissions_publiques$/.test(recu.u) && recu.corps.p_formulaire === 'api:r2-presigner:compte-1' && recu.corps.p_max_par_minute === 600, 'compteur par accès et par compte (api:r2-presigner:compte-1, 600 par minute)');
  global.fetch = async () => ({ ok: true, json: async () => true });
  res = reponse();
  ok(await limiteDebit(res, 'r2-presigner', 'compte-1', 600) === false && res.code === 200, 'sous la limite : on passe');
  global.fetch = async () => { throw new Error('base injoignable'); };
  ok(await limiteDebit(reponse(), 'supprimer-mannequin', 'x', 20) === false, 'compteur en panne : on passe (l’agence n’est jamais bloquée)');
  global.fetch = async () => ({ ok: false, json: async () => ({}) });
  ok(await limiteDebit(reponse(), 'r2-site-images', 'x', 300) === false, 'réponse d’erreur du compteur : on passe');
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
