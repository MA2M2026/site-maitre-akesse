// Serveurs du site (api/) : une action d'administration exige le code de l'application
// d'authentification (jeton « aal2 », adminVerifie dans api/_commun.js, 24/10/2026). Un mot de
// passe volé seul (jeton « aal1 ») est refusé, même pour un compte de la table admins.
// Base imitée : rien n'est lu ni écrit pour de vrai.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai';
['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'].forEach((v) => { process.env[v] = 'essai'; });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jeton = (aal) => b64({ alg: 'HS256' }) + '.' + b64({ sub: 'admin-1', aal }) + '.c2ln';
const appels = [];
global.fetch = async (url) => {
  appels.push(String(url));
  if (/\/auth\/v1\/user/.test(url)) return { ok: true, json: async () => ({ id: 'admin-1' }) };
  if (/\/rest\/v1\/admins\?user_id=eq\.admin-1/.test(url)) return { ok: true, json: async () => [{ user_id: 'admin-1' }] };
  if (/\/rest\/v1\/admins/.test(url)) return { ok: true, json: async () => [] };
  return { ok: false, status: 599, json: async () => ({}), text: async () => '' };
};
function appel(fichier, aal, corps) {
  const handler = require(path.join(RACINE, 'api', fichier));
  return new Promise((fin) => {
    const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { fin({ code: this.code, corps: x }); return this; }, end() { fin({ code: this.code }); } };
    Promise.resolve((handler.default || handler)({ method: 'POST', headers: { authorization: 'Bearer ' + jeton(aal) }, body: corps }, res)).then(() => setTimeout(() => fin({ code: res.code }), 50));
  });
}
(async () => {
  const { adminVerifie } = require(path.join(RACINE, 'api', '_commun.js'));
  ok(await adminVerifie(jeton('aal2'), { id: 'admin-1' }) === true, 'admin avec le code : reconnue');
  ok(await adminVerifie(jeton('aal1'), { id: 'admin-1' }) === false, 'admin sans le code (mot de passe seul) : refusée');
  ok(await adminVerifie(jeton('aal2'), { id: 'inconnu' }) === false, 'compte qui n’est pas admin, même avec un code : refusé');
  const id = '11111111-2222-3333-4444-555555555555';
  const sans = await appel('supprimer-mannequin.js', 'aal1', { modelId: id });
  ok(sans.code === 403, 'supprimer une mannequin sans le code : refusé (' + sans.code + ')');
  const r2 = await appel('r2-site-images.js', 'aal1', { action: 'envoi', categorie: 'actualites', chemin: 'site/actualites/a.jpg', contentType: 'image/jpeg', taille: 1000 });
  ok(r2.code === 403, 'envoyer une image du site sans le code : refusé (' + r2.code + ')');
  const cree = await appel('_creer-admin.js', 'aal1', { email: 'x@test.ci', password: 'Essai-1234567' });
  ok(cree.code === 403, 'créer un compte admin sans le code : refusé (' + cree.code + ')');
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
