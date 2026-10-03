// Fonction serverless Vercel — reçoit l'appel du déclencheur Supabase (voir
// Extension 107, supabase-extension.sql) juste après l'enregistrement d'une
// candidature casting, d'une demande d'intégration, d'une demande recruteur
// ou d'un message visiteur, et envoie une vraie notification push aux
// téléphones de l'administration abonnés (Grand 3, N-5 à N-14).
//
// Appelée par la BASE DE DONNÉES elle-même (pas par le navigateur du
// visiteur, N-9) : la ligne est déjà enregistrée avant cet appel, donc un
// échec d'envoi ne fait jamais perdre une candidature ou un message (N-10).
//
// Variables d'environnement requises sur Vercel :
//   SUPABASE_SERVICE_ROLE_KEY (déjà utilisée par les autres fonctions api/)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (générées une fois, voir message
//     donné à la propriétaire — jamais dans ce fichier)
//   NOTIF_WEBHOOK_SECRET (même valeur que "<WEBHOOK_SECRET>" posée dans les
//     3 déclencheurs SQL de l'Extension 107)

const webpush = require('web-push');

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
const VAPID_CONTACT = 'mailto:infos.ma2m@gmail.com';

function construireNotification(table, record) {
  if (table === 'casting_applications') {
    if (record.type_candidature === 'projet') {
      return {
        cle: 'evenement_candidature_casting',
        titre: '📸 Nouvelle candidature casting',
        texte: (record.full_name || 'Candidat') + (record.projet_nom ? ' — ' + record.projet_nom : ''),
        url: '/tableau-de-bord.html?notif=candidature&id=' + record.id
      };
    }
    return {
      cle: 'evenement_integration_agence',
      titre: "⭐ Nouvelle demande d'intégration",
      texte: record.full_name || 'Candidat',
      url: '/tableau-de-bord.html?notif=candidature&id=' + record.id
    };
  }
  if (table === 'recruiter_requests') {
    const qui = record.contact_name || record.company || 'Un recruteur';
    return {
      cle: 'evenement_message_recruteur',
      titre: '💼 Nouveau message recruteur',
      texte: qui + (record.message ? ' — ' + String(record.message).slice(0, 70) : ''),
      url: '/tableau-de-bord.html?notif=recruteur&id=' + record.id
    };
  }
  if (table === 'messages_contact') {
    return {
      cle: 'evenement_message_visiteur',
      titre: '💬 Nouveau message visiteur',
      texte: (record.nom || 'Visiteur') + (record.message ? ' — ' + String(record.message).slice(0, 70) : ''),
      url: '/tableau-de-bord.html?notif=contact&id=' + record.id
    };
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const secretAttendu = process.env.NOTIF_WEBHOOK_SECRET;
  if (!secretAttendu || req.headers['x-webhook-secret'] !== secretAttendu) {
    res.status(401).json({ error: 'Non autorisé.' });
    return;
  }

  const cleSecrete = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublique = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivee = process.env.VAPID_PRIVATE_KEY;
  if (!cleSecrete || !vapidPublique || !vapidPrivee) {
    res.status(500).json({ error: 'Configuration serveur incomplète (clés manquantes sur Vercel).' });
    return;
  }

  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch (e) { corps = {}; } }
  const table = corps && corps.table;
  const record = corps && corps.record;
  if (!table || !record) {
    res.status(400).json({ error: 'Payload invalide.' });
    return;
  }

  // Toujours répondre vite et sans erreur au déclencheur — l'enregistrement
  // en base a déjà réussi, ce qui suit est un "bonus" best-effort (N-10).
  res.status(200).json({ ok: true });

  try {
    const notif = construireNotification(table, record);
    if (!notif) return;

    webpush.setVapidDetails(VAPID_CONTACT, vapidPublique, vapidPrivee);

    const enTetes = { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete };

    // Réglages : l'événement et le canal push doivent être actifs (N-13).
    const reponseReglages = await fetch(
      SUPABASE_URL + '/rest/v1/notifications_reglages?cle=in.(' + notif.cle + ',canal_push)&select=cle,actif',
      { headers: enTetes }
    );
    const reglages = reponseReglages.ok ? await reponseReglages.json() : [];
    const actif = (cle) => {
      const ligne = reglages.find((r) => r.cle === cle);
      return !ligne || ligne.actif !== false; // actif par défaut si réglage absent
    };
    if (!actif(notif.cle) || !actif('canal_push')) {
      await fetch(SUPABASE_URL + '/rest/v1/notifications_journal', {
        method: 'POST',
        headers: { ...enTetes, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ evenement: notif.cle, canal: 'push', statut: 'desactivee', cible_table: table, cible_id: record.id, resume: notif.texte })
      });
      return;
    }

    // Appareils abonnés et actifs.
    const reponseAbonnements = await fetch(
      SUPABASE_URL + '/rest/v1/push_abonnements?actif=eq.true&select=id,endpoint,p256dh,auth',
      { headers: enTetes }
    );
    const abonnements = reponseAbonnements.ok ? await reponseAbonnements.json() : [];

    let reussites = 0;
    let echecs = 0;

    for (const abo of abonnements) {
      const sub = { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } };
      const payload = JSON.stringify({ titre: notif.titre, texte: notif.texte, url: notif.url, tag: notif.cle });

      let envoye = false;
      for (let essai = 0; essai < 3 && !envoye; essai++) {
        try {
          if (essai > 0) await new Promise((r) => setTimeout(r, 300 * essai));
          await webpush.sendNotification(sub, payload);
          envoye = true;
        } catch (err) {
          // 404/410 : abonnement expiré ou révoqué côté navigateur — on le
          // désactive pour ne plus perdre de temps dessus (pratique standard
          // web-push, pas une tentative supplémentaire à faire).
          if (err && (err.statusCode === 404 || err.statusCode === 410)) {
            await fetch(SUPABASE_URL + '/rest/v1/push_abonnements?id=eq.' + abo.id, {
              method: 'PATCH',
              headers: { ...enTetes, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
              body: JSON.stringify({ actif: false })
            });
            break;
          }
        }
      }
      if (envoye) reussites++; else echecs++;
    }

    await fetch(SUPABASE_URL + '/rest/v1/notifications_journal', {
      method: 'POST',
      headers: { ...enTetes, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        evenement: notif.cle,
        canal: 'push',
        statut: reussites > 0 ? 'envoyee' : (abonnements.length ? 'echouee' : 'aucun_appareil'),
        cible_table: table,
        cible_id: record.id,
        resume: notif.texte,
        erreur: echecs ? echecs + ' appareil(s) en échec sur ' + abonnements.length : null
      })
    });
  } catch (err) {
    // Jamais remonté au visiteur (déjà répondu plus haut) — juste journalisé
    // côté serveur Vercel pour debug.
    console.error('notifications-webhook:', err);
  }
};
