// Surveillance du serveur (lot 3, étape 5 de PLAN-SERVEUR.md, 01/11/2026) : une panne d'une fonction du serveur
// est notée au journal des erreurs ; chaque matin, l'agence reçoit UN e-mail récapitulatif des pannes des
// dernières 24 heures, et rien un jour sans panne. Base, stockage et EmailJS simulés : rien n'est écrit ni envoyé.
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const { EMAIL_AGENCE } = require('../../js/messages-convocations.js');
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai';
process.env.CRON_SECRET = 'secret-essai';
process.env.EMAILJS_PRIVATE_KEY = 'cle-privee-essai';
['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'].forEach((n) => { process.env[n] = 'essai'; });
const envois = [], ecrits = [];
let journal = [], lectures = [];
global.fetch = async (url, o = {}) => {
  if (/journal_erreurs/.test(url)) {
    if (o.method === 'POST') { const l = JSON.parse(o.body); ecrits.push(l); return { ok: true }; }
    lectures.push(url); return { ok: true, status: 200, json: async () => journal };
  }
  if (/auth\/v1\/user/.test(url)) return { ok: true, status: 200, json: async () => ({ id: 'm1' }) };
  if (/rpc\/(anniversaires_du_jour|documents_alertes_du_jour|mensualites_relances)/.test(url)) return { ok: true, json: async () => [] };
  if (/api\.emailjs\.com/.test(url)) { envois.push(JSON.parse(o.body)); return { ok: true }; }
  return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
};
const commun = require('../../api/_commun.js');
commun.creerClientR2 = () => { throw new Error('stockage injoignable'); };
const repondre = () => { const r = { statut: 0, corps: null, status(s) { r.statut = s; return r; }, json(c) { r.corps = c; return r; }, setHeader() {} }; return r; };

(async () => {
  // 1. une panne d'envoi de photo est notée au journal
  const presigner = require('../../api/r2-presigner.js');
  const r1 = repondre();
  const vraiErreur = console.error; console.error = () => {};
  await presigner({ method: 'POST', headers: { authorization: 'Bearer jeton' }, body: { modelId: 'm1', chemin: 'm1/p.jpg', contentType: 'image/jpeg', taille: 1000 } }, r1);
  console.error = vraiErreur;
  ok(r1.statut === 500 && ecrits.some((l) => l.user_agent === 'serveur (r2-presigner)' && /stockage injoignable/.test(l.message) && l.page === '/api/r2-presigner'), 'panne d’un envoi de photo : notée au journal des erreurs (« serveur (r2-presigner) »)');
  // 2. le matin : un e-mail récapitulatif à l'agence
  const portail = require('../../api/portail.js');
  const matin = async (jour) => {
    const vrai = Date.prototype.getUTCDate; Date.prototype.getUTCDate = function () { return jour; };
    const r = repondre();
    try { await portail({ method: 'GET', headers: { authorization: 'Bearer secret-essai' }, query: {} }, r); } finally { Date.prototype.getUTCDate = vrai; }
    return r;
  };
  journal = [{ message: '[Photos du Book] stockage injoignable', user_agent: 'serveur (r2-presigner)', created_at: new Date().toISOString() },
    { message: '[Photos du Book] délai dépassé', user_agent: 'serveur (r2-presigner)', created_at: new Date().toISOString() },
    { message: '[Convocations] 1 e-mail(s) non envoyé(s) sur 3', user_agent: 'serveur (convocations)', created_at: new Date().toISOString() }];
  let r = await matin(14);
  const mail = envois.filter((e) => e.template_params.to_email === EMAIL_AGENCE && /Surveillance du site/.test(e.template_params.message));
  ok(r.statut === 200 && r.corps.pannes === 3 && mail.length === 1, 'matin : UN e-mail de surveillance à l’agence (3 pannes)');
  ok(mail.length && /r2-presigner : 2 pannes/.test(mail[0].template_params.message) && /convocations : 1 panne /.test(mail[0].template_params.message), 'pannes regroupées par fonction, avec la dernière');
  ok(lectures.some((u) => /user_agent=like\.serveur\*/.test(u) && /created_at=gte\./.test(u)), 'seules les pannes du serveur des dernières 24 heures sont lues');
  // 3. un jour sans panne : rien
  journal = []; const avant = envois.length;
  r = await matin(15);
  ok(r.corps.pannes === 0 && envois.length === avant, 'un jour sans panne : aucun e-mail');
  // 4. journal illisible : la tâche du matin continue (relances du 3)
  global.fetch = ((f) => async (url, o = {}) => (/journal_erreurs/.test(url) && o.method !== 'POST' ? { ok: false, status: 500, json: async () => ({}) } : f(url, o)))(global.fetch);
  console.error = () => {};
  r = await matin(3);
  console.error = vraiErreur;
  ok(r.statut === 200 && r.corps.relances === 0 && r.corps.pannes === 0, 'journal illisible : la tâche du matin continue (relances du 3)');
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
