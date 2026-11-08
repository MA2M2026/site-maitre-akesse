// Actions d'administration du serveur (api/ : envoi et suppression de photos, images du site, suppression d'une
// mannequin, accès bloqués, création d'un compte) : deux facteurs ET appareil en règle (adminVerifie, api/_commun.js ;
// Extension 158, 08/11/2026), base SIMULÉE : appareil refusé par la base → refusé ; identifiant d'appareil transmis
// à la base ; fichier SQL pas encore collé (404) → comme avant ; base injoignable → refusé.
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'cle-essai';
const { adminVerifie } = require('../../api/_commun.js');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const jeton = (aal) => 'x.' + Buffer.from(JSON.stringify({ aal, amr: [{ method: 'totp', timestamp: Math.floor(Date.now() / 1000) }] })).toString('base64url') + '.y';
const moi = { id: '00000000-0000-0000-0000-0000000000a1' };
// base simulée : « admins » répond une ligne ; portail_admin_ok répond selon le cas
function base(reponseAppareil) {
  const appels = [];
  global.fetch = async (u, o) => {
    appels.push({ u, entetes: (o && o.headers) || {} });
    if (/\/rest\/v1\/admins\?/.test(u)) return { ok: true, status: 200, json: async () => [{ user_id: moi.id }] };
    if (/rpc\/portail_admin_ok$/.test(u)) {
      if (reponseAppareil === 'panne') throw new Error('base injoignable');
      if (reponseAppareil === 404) return { ok: false, status: 404, json: async () => ({ code: 'PGRST202' }) };
      return { ok: true, status: 200, json: async () => reponseAppareil };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };
  return appels;
}
(async () => {
  let appels = base(true);
  ok(await adminVerifie(jeton('aal2'), moi, 'appareil-essai-0158') === true, 'deux facteurs + appareil en règle : autorisé');
  const rpc = appels.find((a) => /portail_admin_ok/.test(a.u));
  ok(rpc && rpc.entetes['x-appareil'] === 'appareil-essai-0158' && /^Bearer x\./.test(rpc.entetes.Authorization), 'la base est interrogée avec le jeton de la personne et l’identifiant de son appareil');
  base(false);
  ok(await adminVerifie(jeton('aal2'), moi, 'appareil-essai-0158') === false, 'appareil verrouillé ou révoqué (la base dit non) : refusé');
  appels = base(false);
  ok(await adminVerifie(jeton('aal2'), moi, undefined) === false && !appels.find((a) => /portail_admin_ok/.test(a.u)).entetes['x-appareil'], 'sans identifiant d’appareil : rien n’est inventé, la base refuse');
  appels = base(true);
  await adminVerifie(jeton('aal2'), moi, 'mal formé !');
  ok(!appels.find((a) => /portail_admin_ok/.test(a.u)).entetes['x-appareil'], 'identifiant mal formé : jamais envoyé à la base');
  base(true);
  ok(await adminVerifie(jeton('aal1'), moi, 'appareil-essai-0158') === false, 'sans double authentification : refusé (comme avant)');
  base(404);
  ok(await adminVerifie(jeton('aal2'), moi, 'appareil-essai-0158') === true, 'fichier SQL pas encore collé : comme avant (deux facteurs)');
  base('panne');
  ok(await adminVerifie(jeton('aal2'), moi, 'appareil-essai-0158') === false, 'base injoignable : refusé (prudence)');
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
