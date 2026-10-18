// Code personnel de l'espace mannequin (ESP-XXXX-XX, 18/10/2026) : la fonction du serveur
// api/code-protege.js est appelée comme par la page « Créer mon compte », avec une base
// SIMULÉE (aucun compte créé pour de vrai). Vérifie : le code personnel est contrôlé par
// espace_code_verifier, le compte est créé côté serveur, puis espace_code_utiliser reçoit le
// bon identifiant (reprise des informations et photos du casting) ; un code refusé ne crée
// rien ; l'ancien code commun passe toujours par check_invite_code.
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai';
const handler = require('../../api/code-protege.js');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

function base(reponses) {
  const appels = [];
  global.fetch = async (url, opts) => {
    const corps = opts && opts.body ? JSON.parse(opts.body) : null;
    const chemin = String(url).replace(/^https:\/\/[^/]+/, '');
    appels.push([chemin, corps]);
    const r = reponses(chemin, corps);
    return { ok: r[0] < 400, status: r[0], json: async () => r[1], text: async () => JSON.stringify(r[1]) };
  };
  return appels;
}
const reponsesNormales = (valide) => (chemin) => {
  if (chemin.endsWith('/rpc/connexion_verifier_blocage')) return [200, [{ bloque: false }]];
  if (chemin.endsWith('/rpc/connexion_enregistrer_echec')) return [200, [{ bloque: false, essais_restants: 2 }]];
  if (chemin.endsWith('/rpc/connexion_enregistrer_succes')) return [200, null];
  if (chemin.endsWith('/rpc/espace_code_verifier')) return [200, valide];
  if (chemin.endsWith('/rpc/check_invite_code')) return [200, valide];
  if (chemin === '/auth/v1/admin/users') return [200, { id: 'u-nouvelle' }];
  if (chemin.startsWith('/rest/v1/model_profiles')) return [201, null];
  if (chemin.endsWith('/rpc/espace_code_utiliser')) return [200, { ok: true, photos: 3 }];
  return [200, null];
};
async function appeler(corps) {
  let statut = 0, rendu = null;
  const res = { status(s) { statut = s; return this; }, json(o) { rendu = o; return this; }, setHeader() {} };
  await handler({ method: 'POST', body: corps, headers: { 'x-forwarded-for': '1.2.3.4' } }, res);
  return { statut, rendu };
}
const demande = (code) => ({ type: 'portail-creer-compte', code, nom: 'Awa Koné', email: 'awa@test.ci', password: 'motdepasse-solide', appareil: 'appareil-essai-123456' });

(async () => {
  // 1. bon code personnel → compte créé puis casting repris
  let appels = base(reponsesNormales(true));
  let r = await appeler(demande('esp-k7p4-92'));
  ok(r.statut === 200 && r.rendu.ok && r.rendu.photos === 3, 'code personnel valable : compte créé, 3 photos du casting reprises');
  ok(appels.some(([c, b]) => c.endsWith('/rpc/espace_code_verifier') && b.p_code === 'esp-k7p4-92'), 'le code personnel est vérifié par espace_code_verifier');
  ok(!appels.some(([c]) => c.endsWith('/rpc/check_invite_code')), 'le code commun de l’agence n’est pas consulté');
  const iCompte = appels.findIndex(([c]) => c === '/auth/v1/admin/users'), iReprise = appels.findIndex(([c]) => c.endsWith('/rpc/espace_code_utiliser'));
  ok(iCompte >= 0 && iReprise > iCompte && appels[iReprise][1].p_user === 'u-nouvelle', 'la reprise du casting reçoit le compte tout juste créé');

  // 2. code personnel refusé → rien n'est créé, l'essai est compté
  appels = base(reponsesNormales(false));
  r = await appeler(demande('ESP-AAAA-AA'));
  ok(r.statut === 401 && r.rendu.essaisRestants === 2, 'code personnel refusé : message avec les essais restants');
  ok(!appels.some(([c]) => c === '/auth/v1/admin/users'), 'code refusé : aucun compte créé');

  // 3. ancien code commun : toujours accepté par check_invite_code, sans reprise de casting
  appels = base(reponsesNormales(true));
  r = await appeler(demande('MA2M2026'));
  ok(r.statut === 200 && appels.some(([c]) => c.endsWith('/rpc/check_invite_code')) && !appels.some(([c]) => c.endsWith('/rpc/espace_code_utiliser')),
     'ancien code commun : compte créé sans reprise de casting');

  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
