// Fonction serverless Vercel — reçoit l'appel du déclencheur Supabase (voir
// Extension 107, supabase-extension.sql) juste après l'enregistrement d'une
// candidature casting, d'une demande d'intégration, d'une demande recruteur
// ou d'un message visiteur, et envoie une vraie notification push aux
// téléphones de l'administration abonnés (Grand 3, N-5 à N-14).
// Depuis le 26/10/2026, aussi chaque nouveau message de l'application des mannequins
// (app_messages, supabase-app-messages.sql) : notification aux SEULS téléphones de la
// mannequin concernée (app_push_abonnements).
//
// Appelée par la BASE DE DONNÉES elle-même (pas par le navigateur du
// visiteur, N-9) : la ligne est déjà enregistrée avant cet appel, donc un
// échec d'envoi ne fait jamais perdre une candidature ou un message (N-10).
// Elle ne répond qu'une fois les envois terminés (voir plus bas).
//
// Variables d'environnement requises sur Vercel :
//   SUPABASE_SERVICE_ROLE_KEY (déjà utilisée par les autres fonctions api/)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (générées une fois, voir message
//     donné à la propriétaire — jamais dans ce fichier)
//   NOTIF_WEBHOOK_SECRET (même valeur que "<WEBHOOK_SECRET>" posée dans les
//     3 déclencheurs SQL de l'Extension 107)

const webpush = require('web-push');
const crypto = require('crypto');

// Comparaison à durée constante (audit du 05/10/2026) : une comparaison ordinaire répond
// un peu plus vite quand le début du secret est faux, ce qui peut aider à le deviner.
function memeSecret(recu, attendu) {
  const a = Buffer.from(String(recu || '')), b = Buffer.from(String(attendu));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
const VAPID_CONTACT = 'mailto:infos.ma2m@gmail.com';

function construireNotification(table, record) {
  if (table === 'casting_applications') {
    if (record.type_candidature === 'projet') {
      return {
        cle: 'evenement_candidature_casting',
        titre: '📸 Nouvelle candidature casting',
        texte: (record.full_name || 'Candidat') + (record.projet_nom ? ' · ' + record.projet_nom : ''),
        url: '/admin/#/site/b2-candidatures/' + record.id
      };
    }
    return {
      cle: 'evenement_integration_agence',
      titre: "⭐ Nouvelle demande d'intégration",
      texte: record.full_name || 'Candidat',
      url: '/admin/#/site/b2-candidatures/' + record.id
    };
  }
  if (table === 'recruiter_requests') {
    const qui = record.contact_name || record.company || 'Un recruteur';
    return {
      cle: 'evenement_message_recruteur',
      titre: '💼 Nouveau message recruteur',
      texte: qui + (record.message ? ' · ' + String(record.message).slice(0, 70) : ''),
      url: '/admin/#/site/b2-recruteurs/' + record.id
    };
  }
  if (table === 'messages_contact') {
    return {
      cle: 'evenement_message_visiteur',
      titre: '💬 Nouveau message visiteur',
      texte: (record.nom || 'Visiteur') + (record.message ? ' · ' + String(record.message).slice(0, 70) : ''),
      url: '/admin/#/site/b2-contacts'
    };
  }
  if (table === 'app_messages') {
    const texte = String(record.texte || '').replace(/\s+/g, ' ').trim();
    return {
      cle: 'evenement_app_message',
      titre: record.titre || 'Message de l’agence',
      texte: texte.length > 140 ? texte.slice(0, 139) + '…' : texte,
      url: /^\/app\/[^/]/.test(record.lien || '') || /^\/app\/$/.test(record.lien || '') ? record.lien : '/app/#alertes',
      icone: '/icons/mannequin-192.png',
      mannequin: record.user_id
    };
  }
  if (table === 'blocages_connexion') {
    const lieu = ({ admin: 'connexion admin', 'admin-code': 'code de validation admin', mannequin: 'connexion espace mannequin', 'inscription-code': "code d'inscription", 'portail-code': "code d'invitation mannequin" })[record.espace] || 'connexion';
    return {
      cle: 'evenement_blocage_connexion',
      titre: '🔒 Accès bloqué',
      texte: 'Trop de tentatives · ' + lieu + (record.recidive ? ' (récidive)' : ''),
      url: '/admin/#/site/b3b-acces-bloques'
    };
  }
  return null;
}

// Envoi à une liste d'appareils (3 essais chacun) ; un abonnement expiré (404/410) est désactivé
// dans sa table (push_abonnements : Administration ; app_push_abonnements : mannequins).
async function envoyerAuxAppareils(abonnements, payload, tableAbonnements, enTetes) {
  let reussites = 0, echecs = 0, derniereErreur = null;
  for (const abo of abonnements) {
    const sub = { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } };
    let envoye = false;
    for (let essai = 0; essai < 3 && !envoye; essai++) {
      try {
        if (essai > 0) await new Promise((r) => setTimeout(r, 300 * essai));
        // Priorité haute : Android délivre tout de suite, même téléphone en
        // veille (sinon il peut retarder la notification de plusieurs minutes).
        await webpush.sendNotification(sub, payload, { urgency: 'high', TTL: 3600 });
        envoye = true;
      } catch (err) {
        derniereErreur = (err && (err.statusCode ? 'HTTP ' + err.statusCode + ' ' : '') + (err.body || err.message || '')) || 'inconnue';
        // 404/410 : abonnement expiré ou révoqué côté navigateur — on le
        // désactive pour ne plus perdre de temps dessus (pratique standard
        // web-push, pas une tentative supplémentaire à faire).
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await fetch(SUPABASE_URL + '/rest/v1/' + tableAbonnements + '?id=eq.' + abo.id, {
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
  return { reussites, echecs, derniereErreur };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const secretAttendu = process.env.NOTIF_WEBHOOK_SECRET;
  if (!secretAttendu || !memeSecret(req.headers['x-webhook-secret'], secretAttendu)) {
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

  // La réponse n'est envoyée qu'APRÈS l'envoi des notifications : sur Vercel,
  // le programme peut être arrêté dès que la réponse est partie, et tout ce
  // qui suivait n'était alors jamais exécuté. L'enregistrement en base a
  // déjà réussi avant cet appel, donc attendre ici ne ralentit personne (N-10).
  let bilan = { ok: true };
  try {
    const notif = construireNotification(table, record);
    if (!notif) { res.status(200).json({ ok: true, ignore: true }); return; }

    webpush.setVapidDetails(VAPID_CONTACT, vapidPublique, vapidPrivee);

    const enTetes = { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete };

    // Message de l'application des mannequins : seulement les téléphones de CETTE mannequin
    // (pas les réglages de l'Administration, qui concernent ses propres notifications)
    const pourMannequin = table === 'app_messages';
    if (pourMannequin && !/^[0-9a-f-]{36}$/i.test(String(notif.mannequin || ''))) { res.status(400).json({ error: 'Payload invalide.' }); return; }

    // Réglages : l'événement et le canal push doivent être actifs (N-13).
    if (!pourMannequin) {
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
        res.status(200).json({ ok: true, desactivee: true });
        return;
      }
    }

    // Appareils abonnés et actifs.
    const tableAbonnements = pourMannequin ? 'app_push_abonnements' : 'push_abonnements';
    const reponseAbonnements = await fetch(
      SUPABASE_URL + '/rest/v1/' + tableAbonnements + '?actif=eq.true' + (pourMannequin ? '&user_id=eq.' + notif.mannequin : '') + '&select=id,endpoint,p256dh,auth',
      { headers: enTetes }
    );
    const abonnements = reponseAbonnements.ok ? await reponseAbonnements.json() : [];

    // Étiquette propre à chaque événement : avec une étiquette commune, une
    // nouvelle notification remplaçait en silence la précédente non lue.
    const payload = JSON.stringify({ titre: notif.titre, texte: notif.texte, url: notif.url, icone: notif.icone, tag: notif.cle + '-' + (record.id || Date.now()) });
    const { reussites, echecs, derniereErreur } = await envoyerAuxAppareils(abonnements, payload, tableAbonnements, enTetes);

    await fetch(SUPABASE_URL + '/rest/v1/notifications_journal', {
      method: 'POST',
      headers: { ...enTetes, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        evenement: notif.cle,
        canal: 'push',
        statut: reussites > 0 ? 'envoyee' : (abonnements.length ? 'echouee' : 'aucun_appareil'),
        cible_table: table,
        cible_id: record.id,
        // (message d'une mannequin : son titre seulement, pas son contenu privé)
        resume: pourMannequin ? notif.titre : notif.texte,
        erreur: echecs ? echecs + ' appareil(s) en échec sur ' + abonnements.length + ' · ' + String(derniereErreur).slice(0, 200) : null
      })
    });
    bilan = { ok: true, appareils: abonnements.length, reussites, echecs };
  } catch (err) {
    console.error('notifications-webhook:', err);
    bilan = { ok: false, erreur: String(err && err.message || err) };
  }
  res.status(200).json(bilan);
};
