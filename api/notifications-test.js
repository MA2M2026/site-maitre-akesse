// Fonction serverless Vercel — bouton « Envoyer une notification de test »
// de l'espace admin (N-13). Envoie une vraie notification push, tout de
// suite, aux appareils de l'admin connecté — pour vérifier que le vibreur
// et la notification arrivent réellement sur son téléphone (N-5).
//
// Variables d'environnement requises : les mêmes que api/notifications-webhook.js.

const webpush = require('web-push');

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
const VAPID_CONTACT = 'mailto:infos.ma2m@gmail.com';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const cleSecrete = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublique = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivee = process.env.VAPID_PRIVATE_KEY;
  if (!cleSecrete || !vapidPublique || !vapidPrivee) {
    res.status(500).json({ error: 'Configuration serveur incomplète (clés manquantes sur Vercel).' });
    return;
  }

  const enTeteAuth = req.headers.authorization || '';
  const jeton = enTeteAuth.startsWith('Bearer ') ? enTeteAuth.slice(7) : '';
  if (!jeton) {
    res.status(401).json({ error: 'Non authentifié.' });
    return;
  }

  try {
    const reponseUtilisateur = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: cleSecrete, Authorization: 'Bearer ' + jeton }
    });
    if (!reponseUtilisateur.ok) {
      res.status(401).json({ error: 'Session invalide ou expirée — reconnectez-vous.' });
      return;
    }
    const utilisateur = await reponseUtilisateur.json();

    const enTetes = { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete };
    const reponseAdmin = await fetch(
      SUPABASE_URL + '/rest/v1/admins?user_id=eq.' + encodeURIComponent(utilisateur.id) + '&select=user_id',
      { headers: enTetes }
    );
    const lignesAdmin = reponseAdmin.ok ? await reponseAdmin.json() : [];
    if (!Array.isArray(lignesAdmin) || !lignesAdmin.length) {
      res.status(403).json({ error: "Ce compte n'est pas administrateur." });
      return;
    }

    const reponseAbonnements = await fetch(
      SUPABASE_URL + '/rest/v1/push_abonnements?user_id=eq.' + encodeURIComponent(utilisateur.id) + '&actif=eq.true&select=id,endpoint,p256dh,auth',
      { headers: enTetes }
    );
    const abonnements = reponseAbonnements.ok ? await reponseAbonnements.json() : [];
    if (!abonnements.length) {
      res.status(400).json({ error: 'Aucun appareil activé pour ce compte sur ce téléphone.' });
      return;
    }

    webpush.setVapidDetails(VAPID_CONTACT, vapidPublique, vapidPrivee);
    const payload = JSON.stringify({
      titre: 'Notification de test',
      texte: 'Si vous voyez ceci avec le son et le vibreur, tout fonctionne.',
      url: '/tableau-de-bord.html',
      tag: 'test'
    });

    let reussites = 0;
    for (const abo of abonnements) {
      try {
        await webpush.sendNotification({ endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } }, payload);
        reussites++;
      } catch (err) {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await fetch(SUPABASE_URL + '/rest/v1/push_abonnements?id=eq.' + abo.id, {
            method: 'PATCH',
            headers: { ...enTetes, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ actif: false })
          });
        }
      }
    }

    res.status(200).json({ ok: true, envoyees: reussites, total: abonnements.length });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur lors de l'envoi du test." });
  }
};
