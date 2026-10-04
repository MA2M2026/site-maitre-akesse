// Fonction serverless Vercel — reçoit les informations envoyées par WhatsApp
// (Meta) : état de chaque message envoyé par l'agence (envoyé, reçu, lu,
// échec + raison de l'échec) et messages reçus en réponse. Tout est rangé
// dans la table whatsapp_evenements (Extension 111), lisible par l'admin.
//
// Variables d'environnement Vercel :
//   WHATSAPP_VERIFY_TOKEN  mot de passe convenu avec Meta lors du branchement
//   WHATSAPP_APP_SECRET    « Clé secrète » de l'application Meta MA2M
//                          (Paramètres de l'app → Général) — sert à vérifier
//                          que chaque envoi vient bien de Meta
//   SUPABASE_SERVICE_ROLE_KEY (déjà en place)

const crypto = require('crypto');

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
// Compte WhatsApp Business de l'agence (identifiant public, non secret).
const WABA_AGENCE = '1448590597158419';

function lireCorpsBrut(req) {
  return new Promise((resolve) => {
    if (req.readableEnded) { resolve(Buffer.alloc(0)); return; }
    const morceaux = [];
    const fin = () => resolve(Buffer.concat(morceaux));
    const minuteur = setTimeout(fin, 3000);
    req.on('data', (m) => morceaux.push(Buffer.isBuffer(m) ? m : Buffer.from(m)));
    req.on('end', () => { clearTimeout(minuteur); fin(); });
    req.on('error', () => { clearTimeout(minuteur); fin(); });
  });
}

function signatureValide(brut, entete, secret) {
  if (!entete || !entete.startsWith('sha256=')) return false;
  const attendu = Buffer.from('sha256=' + crypto.createHmac('sha256', secret).update(brut).digest('hex'));
  const recu = Buffer.from(entete);
  return attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu);
}

function extraireEvenements(corps, signatureVerifiee) {
  const lignes = [];
  for (const entree of (corps.entry || [])) {
    for (const changement of (entree.changes || [])) {
      const v = changement.value || {};
      for (const s of (v.statuses || [])) {
        const err = (s.errors || [])[0] || {};
        lignes.push({
          type: 'statut', message_id: s.id || null, statut: s.status || null,
          numero: s.recipient_id || null,
          erreur_code: err.code != null ? String(err.code) : null,
          erreur_titre: err.title || err.message || null,
          erreur_detail: (err.error_data && err.error_data.details) || null,
          brut: s, signature_verifiee: signatureVerifiee
        });
      }
      for (const m of (v.messages || [])) {
        lignes.push({
          type: 'message_recu', message_id: m.id || null, statut: m.type || null,
          numero: m.from || null,
          texte: (m.text && m.text.body) || (m.button && m.button.text) || null,
          brut: m, signature_verifiee: signatureVerifiee
        });
      }
      if (!(v.statuses || []).length && !(v.messages || []).length) {
        lignes.push({ type: changement.field || 'autre', brut: v, signature_verifiee: signatureVerifiee });
      }
    }
  }
  // PostgREST exige les mêmes colonnes pour toutes les lignes d'un envoi groupé.
  const COLONNES = ['type', 'message_id', 'statut', 'numero', 'texte', 'erreur_code', 'erreur_titre', 'erreur_detail', 'brut', 'signature_verifiee'];
  return lignes.map((l) => Object.fromEntries(COLONNES.map((c) => [c, l[c] === undefined ? null : l[c]])));
}

module.exports = async function handler(req, res) {
  // Branchement : Meta vérifie qu'on connaît le mot de passe convenu.
  if (req.method === 'GET') {
    const q = req.query || {};
    const attendu = process.env.WHATSAPP_VERIFY_TOKEN;
    if (attendu && q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === attendu) {
      res.status(200).send(String(q['hub.challenge'] || ''));
    } else {
      res.status(403).send('Refusé');
    }
    return;
  }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const cleSecrete = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secretApp = process.env.WHATSAPP_APP_SECRET;
  if (!cleSecrete) { res.status(500).json({ error: 'Configuration serveur incomplète.' }); return; }

  // Corps brut nécessaire pour vérifier la signature de Meta ; si l'hébergeur
  // l'a déjà lu, on retombe sur la version déjà décodée.
  const brut = await lireCorpsBrut(req);
  let corps = null, signatureVerifiee = false;
  if (brut.length) {
    if (secretApp) {
      if (!signatureValide(brut, req.headers['x-hub-signature-256'], secretApp)) { res.status(401).json({ error: 'Signature invalide.' }); return; }
      signatureVerifiee = true;
    }
    try { corps = JSON.parse(brut.toString('utf8')); } catch (e) { corps = null; }
  } else {
    corps = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return null; } })() : req.body;
  }
  if (!corps || corps.object !== 'whatsapp_business_account') { res.status(400).json({ error: 'Contenu inattendu.' }); return; }
  // Sans signature vérifiable, on n'accepte que ce qui concerne le compte de l'agence.
  if (!signatureVerifiee && !(corps.entry || []).every((e) => String(e.id) === WABA_AGENCE)) {
    res.status(403).json({ error: 'Compte inconnu.' }); return;
  }

  const lignes = extraireEvenements(corps, signatureVerifiee);
  try {
    if (lignes.length) {
      await fetch(SUPABASE_URL + '/rest/v1/whatsapp_evenements', {
        method: 'POST',
        headers: { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(lignes)
      });
    }
  } catch (e) {
    console.error('whatsapp-webhook:', e);
  }
  // Meta renvoie l'information en boucle tant qu'il n'a pas reçu 200.
  res.status(200).json({ ok: true, enregistres: lignes.length });
};
