// Compte de connexion d'une mannequin (10/11/2026, demande de la propriétaire) : api/portail.js, actions
// mannequin_compte, mannequin_email, mannequin_mdp_provisoire. Base et service de connexion IMITÉS : rien n'est lu ni
// écrit pour de vrai. Vérifie :
//  - seule l'administratrice PRINCIPALE peut agir (un membre « site » est refusé) ;
//  - changer quelque chose exige un code d'authentification récent (AUTH_RECENTE sinon) ;
//  - jamais sur un compte de l'équipe (table staff_profiles ou admins), ni sur soi-même ;
//  - nouvel e-mail : validé, déjà utilisé par un autre compte → refusé ; enregistré confirmé (email_confirm) ;
//  - mot de passe provisoire : forme MA2M-0000-XXX, marqué mdp_provisoire ; noté au journal.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const maintenant = Math.floor(Date.now() / 1000);
const jeton = (recent) => b64({ alg: 'HS256' }) + '.' + b64({ sub: 'principale-1', aal: 'aal2', amr: [{ method: 'totp', timestamp: recent ? maintenant - 30 : maintenant - 3600 }] }) + '.c2ln';
const MANNEQUIN = '11111111-2222-3333-4444-555555555555', EQUIPE = '99999999-2222-3333-4444-555555555555';
let role = 'principal', emailPris = null;
const ecrits = [], journal = [];
global.fetch = async (url, o = {}) => {
  url = String(url);
  const json = (x, ok = true, status = 200) => ({ ok, status, json: async () => x, text: async () => JSON.stringify(x) });
  if (/\/rpc\/portail_moi/.test(url)) return json({ role });
  if (/\/auth\/v1\/user$/.test(url)) return json({ id: 'principale-1' });
  if (/model_profiles\?select=id&id=eq\./.test(url)) return json(url.includes(MANNEQUIN) || url.includes(EQUIPE) ? [{ id: 'x' }] : []);
  if (/staff_profiles\?select=user_id&user_id=eq\./.test(url)) return json(url.includes(EQUIPE) ? [{ user_id: EQUIPE }] : []);
  if (/admins\?select=user_id&user_id=eq\./.test(url)) return json([]);
  if (/\/rpc\/portail_utilisateur_par_email/.test(url)) return json(emailPris);
  if (/\/auth\/v1\/admin\/users\//.test(url)) {
    if ((o.method || 'GET') === 'GET') return json({ id: MANNEQUIN, email: 'ancienne@test.ci', user_metadata: {} });
    ecrits.push(JSON.parse(o.body)); return json({ id: MANNEQUIN });
  }
  if (/journal_erreurs/.test(url)) { journal.push(JSON.parse(o.body).message); return json({}); }
  return json({}, false, 599);
};
const portail = require(path.join(RACINE, 'api', 'portail.js'));
function appel(corps, recent = true) {
  return new Promise((fin) => {
    const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(x) { fin({ code: this.code, corps: x }); return this; } };
    portail({ method: 'POST', headers: { authorization: 'Bearer ' + jeton(recent), 'x-appareil': 'appareil-essai-123456' }, body: corps }, res);
  });
}
(async () => {
  let r = await appel({ action: 'mannequin_compte', model_id: MANNEQUIN }, false);
  ok(r.code === 200 && r.corps.email === 'ancienne@test.ci', 'principale : lit l’e-mail de connexion de la mannequin (sans code récent)');
  role = 'site';
  r = await appel({ action: 'mannequin_email', model_id: MANNEQUIN, email: 'nouvelle@test.ci' });
  ok(r.code === 403 && !ecrits.length, 'membre de l’équipe « site » : refusé, rien n’est changé');
  role = 'principal';
  r = await appel({ action: 'mannequin_email', model_id: MANNEQUIN, email: 'nouvelle@test.ci' }, false);
  ok(r.code === 403 && /AUTH_RECENTE/.test(r.corps.error) && !ecrits.length, 'principale sans code récent : le code est demandé, rien n’est changé');
  r = await appel({ action: 'mannequin_email', model_id: EQUIPE, email: 'nouvelle@test.ci' });
  ok(r.code === 400 && !ecrits.length, 'compte d’un membre de l’équipe : refusé');
  r = await appel({ action: 'mannequin_email', model_id: 'principale-1', email: 'nouvelle@test.ci' });
  ok(r.code === 400 && !ecrits.length, 'identifiant invalide ou soi-même : refusé');
  r = await appel({ action: 'mannequin_email', model_id: MANNEQUIN, email: 'pas-une-adresse' });
  ok(r.code === 400 && !ecrits.length, 'adresse e-mail invalide : refusée');
  emailPris = '77777777-2222-3333-4444-555555555555';
  r = await appel({ action: 'mannequin_email', model_id: MANNEQUIN, email: 'prise@test.ci' });
  ok(r.code === 400 && /déjà utilisée/.test(r.corps.error) && !ecrits.length, 'adresse déjà utilisée par un autre compte : refusée');
  emailPris = null;
  r = await appel({ action: 'mannequin_email', model_id: MANNEQUIN, email: ' Nouvelle@Test.ci ' });
  ok(r.code === 200 && ecrits.length === 1 && ecrits[0].email === 'nouvelle@test.ci' && ecrits[0].email_confirm === true, 'nouvel e-mail enregistré, en minuscules, confirmé d’office');
  ok(journal.some((m) => /e-mail de connexion changé/.test(m)), 'changement d’e-mail noté au journal');
  r = await appel({ action: 'mannequin_mdp_provisoire', model_id: MANNEQUIN });
  const pose = ecrits[1] || {};
  ok(r.code === 200 && /^MA2M-[2-9]{4}-[A-HJ-NP-Z]{3}$/.test(r.corps.motdepasse) && pose.password === r.corps.motdepasse && pose.user_metadata && pose.user_metadata.mdp_provisoire === true,
    'mot de passe provisoire : forme MA2M-0000-XXX, posé et marqué « provisoire » (' + r.corps.motdepasse + ')');
  ok(journal.some((m) => /mot de passe provisoire/.test(m)) && !journal.some((m) => m.includes(r.corps.motdepasse)), 'noté au journal, sans jamais y écrire le mot de passe');
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.');
  process.exit(ko ? 1 : 0);
})();
