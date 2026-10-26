// Serveur des notifications (api/notifications-webhook.js), 26/10/2026 : un message de
// l'application des mannequins (app_messages) part aux SEULS téléphones de cette mannequin, avec
// l'icône et la page de l'application ; les notifications de l'Administration restent inchangées.
// Base, Google et Apple SIMULÉS : rien n'est envoyé pour de vrai.
const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
// faux « web-push » : note chaque envoi ; un appareil « perime » répond 410 (abonnement expiré)
const envois = [];
require.cache[require.resolve('web-push')] = { exports: {
  setVapidDetails() {},
  async sendNotification(sub, payload) { if (/perime/.test(sub.endpoint)) { const e = new Error('Gone'); e.statusCode = 410; throw e; } envois.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) }); }
} };
process.env.NOTIF_WEBHOOK_SECRET = 'secret-essai'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai';
process.env.VAPID_PUBLIC_KEY = 'pub'; process.env.VAPID_PRIVATE_KEY = 'priv';
const appels = [];
global.fetch = async (url, o) => {
  appels.push({ url, methode: (o && o.method) || 'GET', corps: o && o.body });
  if (/app_push_abonnements\?actif=eq\.true/.test(url)) return { ok: true, json: async () => [{ id: 'a1', endpoint: 'https://push.exemple/aya', p256dh: 'x', auth: 'y' }, { id: 'a2', endpoint: 'https://push.exemple/perime', p256dh: 'x', auth: 'y' }] };
  if (/push_abonnements\?actif=eq\.true/.test(url)) return { ok: true, json: async () => [{ id: 'b1', endpoint: 'https://push.exemple/admin', p256dh: 'x', auth: 'y' }] };
  if (/notifications_reglages/.test(url)) return { ok: true, json: async () => [] };
  return { ok: true, json: async () => ({}) };
};
const webhook = require(chemin.resolve(__dirname, '../../api/notifications-webhook.js'));
const appeler = async (corps, secret) => {
  let statut = 0, reponse = null;
  const res = { status(s) { statut = s; return this; }, json(c) { reponse = c; return this; } };
  await webhook({ method: 'POST', headers: { 'x-webhook-secret': secret === undefined ? 'secret-essai' : secret }, body: corps }, res);
  return { statut, reponse };
};
(async () => {
  const U = '00000000-0000-0000-0000-0000000000b1';
  let r = await appeler({ table: 'app_messages', record: { id: 'm1', user_id: U } }, 'mauvais');
  ok(r.statut === 401 && !envois.length, 'sans le bon secret : refusé, rien n’est envoyé');
  r = await appeler({ table: 'app_messages', record: { id: 'm1', user_id: U, titre: '📣 Casting Kouroukan', texte: 'Information casting\n'.repeat(20), lien: null } });
  const lecture = appels.find((a) => /app_push_abonnements\?actif=eq\.true/.test(a.url));
  ok(r.statut === 200 && lecture && lecture.url.includes('&user_id=eq.' + U), 'message de l’application : seulement les téléphones de CETTE mannequin');
  ok(envois.length === 1 && envois[0].endpoint === 'https://push.exemple/aya' && envois[0].payload.titre === '📣 Casting Kouroukan' && envois[0].payload.url === '/app/#alertes' &&
    envois[0].payload.icone === '/icons/mannequin-192.png' && envois[0].payload.texte.length <= 140, 'notification : titre, début du texte, icône et onglet Messages de l’application');
  ok(appels.some((a) => a.methode === 'PATCH' && /app_push_abonnements\?id=eq\.a2/.test(a.url)), 'téléphone dont l’abonnement a expiré : désactivé (dans la table des mannequins)');
  ok(!appels.some((a) => /notifications_reglages/.test(a.url)), 'les réglages des notifications de l’Administration ne s’appliquent pas aux mannequins');
  envois.length = 0;
  await appeler({ table: 'app_messages', record: { id: 'm2', user_id: U, titre: '✅ Paiement confirmé', texte: 'Merci', lien: '/app/#paiements' } });
  ok(envois[0] && envois[0].payload.url === '/app/#paiements', 'message automatique : la notification ouvre la bonne page (Paiements)');
  envois.length = 0;
  await appeler({ table: 'app_messages', record: { id: 'm3', user_id: U, titre: 'x', lien: 'https://pirate.ci/' } });
  ok(envois[0] && envois[0].payload.url === '/app/#alertes', 'lien étranger : jamais suivi (onglet Messages à la place)');
  envois.length = 0;
  r = await appeler({ table: 'app_messages', record: { id: 'm4', user_id: 'tous', titre: 'x' } });
  ok(r.statut === 400 && !envois.length, 'mannequin inconnue : refusé, personne d’autre ne reçoit rien');
  envois.length = 0; appels.length = 0;
  await appeler({ table: 'messages_contact', record: { id: 'c1', nom: 'Marie', message: 'Bonjour' } });
  ok(envois.length === 1 && envois[0].endpoint === 'https://push.exemple/admin' && appels.some((a) => /notifications_reglages/.test(a.url)) && !appels.some((a) => /app_push_abonnements/.test(a.url)),
    'Administration : ses notifications restent les mêmes (ses téléphones, ses réglages)');
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
