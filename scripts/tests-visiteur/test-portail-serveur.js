// Fonction serveur du portail (api/portail.js) appelée comme par les pages, avec une base
// SIMULÉE (rien n'est écrit pour de vrai). Points de la relecture du 19/10/2026 :
//  - compteur d'essais par adresse, jamais commun à tout le monde ; tout refus compte, une
//    réussite ne remet pas le compteur à zéro ; date impossible refusée sans appeler la base ;
//  - pages publiques : jamais le message brut de la base ;
//  - invitation : l'identifiant de l'appareil suit jusqu'à la base, une personne déjà dans le
//    portail (ou soi-même) ne voit pas son rôle écrasé.
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai';
const handler = require('../../api/portail.js');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JETON = b64({ alg: 'HS256' }) + '.' + b64({ sub: 'u-principal', aal: 'aal2', amr: [{ method: 'totp', timestamp: Math.floor(Date.now() / 1000) - 30 }] }) + '.signature';
const APPAREIL = 'appareil-essai-123456';

let appels = [];
function base(reponses) {
  appels = [];
  global.fetch = async (url, opts) => {
    const corps = opts && opts.body ? JSON.parse(opts.body) : null;
    const chemin = String(url).replace(/^https:\/\/[^/]+/, '');
    appels.push({ chemin, corps, entetes: (opts && opts.headers) || {} });
    const r = reponses(chemin, corps);
    if (r instanceof Error) throw r;
    return { ok: r[0] < 400, status: r[0], json: async () => r[1], text: async () => JSON.stringify(r[1]) };
  };
}
async function appeler(corps, entetes) {
  let statut = 0, rendu = null;
  const res = { status(s) { statut = s; return this; }, json(o) { rendu = o; return this; }, setHeader() {} };
  await handler({ method: 'POST', body: corps, headers: Object.assign({ 'x-forwarded-for': '1.2.3.4' }, entetes || {}) }, res);
  return { statut, rendu };
}
const compteur = (rpc) => appels.filter((a) => a.chemin.endsWith('/rpc/' + rpc));
const blocage = (chemin) => {
  if (chemin.endsWith('/rpc/connexion_verifier_blocage')) return [200, [{ bloque: false }]];
  if (/connexion_enregistrer_(echec|succes)$/.test(chemin)) return [200, [{ bloque: false }]];
  return null;
};

(async () => {
  // 1. date impossible : refus neutre, la base n'est même pas consultée
  base((c) => blocage(c) || [200, { ok: true }]);
  let r = await appeler({ action: 'inscription_verifier', code: 'MA2M-ABCD-EF', naissance: '2026-13-45' });
  ok(r.rendu && r.rendu.ok === false && !compteur('verifier_code_inscription').length, 'date impossible (2026-13-45) : refus neutre, sans appel à la base');

  // 2. refus « déjà utilisé » : compté, et le compteur est celui de CETTE adresse
  base((c) => blocage(c) || (c.endsWith('/rpc/verifier_code_inscription') ? [200, { ok: false, raison: 'deja_utilise' }] : [200, null]));
  r = await appeler({ action: 'inscription_verifier', code: 'MA2M-ABCD-EF', naissance: '2001-03-12' });
  const echec = compteur('connexion_enregistrer_echec')[0];
  ok(echec && echec.corps.p_identifiant === 'ip:1.2.3.4', 'compteur d\'essais par adresse (jamais commun à tous les mannequins)');
  ok(!!echec, 'un code déjà utilisé compte comme un essai raté');

  // 3. réussite : le compteur n'est pas remis à zéro
  base((c) => blocage(c) || (c.endsWith('/rpc/verifier_code_inscription') ? [200, { ok: true, montant: 35000 }] : c.includes('note') ? [200, null] : [200, null]));
  r = await appeler({ action: 'inscription_corriger', code: 'MA2M-ABCD-EF', naissance: '2001-03-12', telephone: '0700000001', email: '' });
  ok(!compteur('connexion_enregistrer_succes').length, 'une réussite ne remet pas le compteur à zéro');

  // 4. panne de la base sur une page publique : message neutre
  base((c) => blocage(c) || (c.endsWith('/rpc/lien_paiement_lire') ? [400, { message: 'invalid input syntax for type date: "secret interne"' }] : [200, null]));
  r = await appeler({ action: 'lien_lire', t: 'jeton-essai-de-vingt-caracteres' });
  ok(r.statut === 500 && !/secret interne|syntax/.test(r.rendu.error), 'page publique : jamais le message brut de la base');
  ok(compteur('connexion_verifier_blocage')[0].corps.p_identifiant === 'ip:1.2.3.4', 'lien de paiement : compteur par adresse');

  // 5. invitation : l'appareil suit jusqu'à la base ; personne déjà présente → refus
  const moiPrincipal = (c, entetes) => c.endsWith('/rpc/portail_moi') ? [200, { role: entetes['x-appareil'] === APPAREIL ? 'principal' : null }] : null;
  base((c) => moiPrincipal(c, appels[appels.length - 1].entetes) || (c === '/auth/v1/user' ? [200, { id: 'u-principal' }]
    : c.endsWith('/rpc/portail_utilisateur_par_email') ? [200, 'u-existant'] : c.startsWith('/rest/v1/staff_profiles?select') ? [200, [{ user_id: 'u-existant' }]] : [200, null]));
  r = await appeler({ action: 'inviter', email: 'deja@test.ci', nom: 'Déjà là', role: 'site' }, { authorization: 'Bearer ' + JETON, 'x-appareil': APPAREIL });
  ok(compteur('portail_moi')[0] && compteur('portail_moi')[0].entetes['x-appareil'] === APPAREIL, 'invitation : l\'identifiant de l\'appareil est transmis à la base');
  ok(r.statut === 400 && /déjà un compte du portail/.test(r.rendu.error), 'invitation d\'une personne déjà dans le portail : refusée (son rôle n\'est pas écrasé)');
  ok(!appels.some((a) => a.chemin.startsWith('/rest/v1/staff_profiles?on_conflict') || a.chemin.startsWith('/rest/v1/admins')), 'rien n\'est écrit dans staff_profiles ni admins');

  // 6. s'inviter soi-même : refusé
  base((c) => moiPrincipal(c, appels[appels.length - 1].entetes) || (c === '/auth/v1/user' ? [200, { id: 'u-principal' }]
    : c.endsWith('/rpc/portail_utilisateur_par_email') ? [200, 'u-principal'] : [200, null]));
  r = await appeler({ action: 'inviter', email: 'moi@test.ci', nom: 'Moi', role: 'site' }, { authorization: 'Bearer ' + JETON, 'x-appareil': APPAREIL });
  ok(r.statut === 400, 'l\'administrateur principal ne peut pas s\'inviter lui-même (perte du rôle principal)');

  // 7. sans identifiant d'appareil : refusé
  base((c) => moiPrincipal(c, appels[appels.length - 1].entetes) || [200, null]);
  r = await appeler({ action: 'inviter', email: 'x@test.ci', nom: 'X', role: 'site' }, { authorization: 'Bearer ' + JETON });
  ok(r.statut === 403, 'sans identifiant d\'appareil : action du principal refusée');

  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ÉCHEC', e.stack); process.exit(1); });
