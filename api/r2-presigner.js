// Fonction serveur partagée : génère des URL signées temporaires pour parler
// directement à Cloudflare R2 (envoi ET suppression de photos), sans jamais
// exposer les clés R2 au navigateur. R2 est compatible S3, d'où l'usage du
// SDK AWS officiel plutôt qu'une signature SigV4 codée à la main.
//
// Remplace, pour les photos du Book (model-photos), l'ancien envoi direct à
// Supabase Storage — Supabase reste utilisé pour tout le reste (connexion,
// base de données, candidatures/inscriptions → Google Drive).
//
// Variables d'environnement requises sur Vercel : R2_ACCOUNT_ID,
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL.

const { S3Client, DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';

function creerClientR2() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
}

// Vérifie le jeton fourni et renvoie l'utilisateur — même principe que
// api/supprimer-mannequin.js. Utilise la clé secrète Supabase uniquement
// pour valider le jeton et consulter la table admins, jamais pour agir sur
// des données de mannequin arbitraires.
async function verifierUtilisateur(jeton) {
  const cleSecrete = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cleSecrete || !jeton) return null;
  const reponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: cleSecrete, Authorization: 'Bearer ' + jeton }
  });
  if (!reponse.ok) return null;
  return reponse.json();
}

async function estAdmin(userId) {
  const cleSecrete = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const reponse = await fetch(
    SUPABASE_URL + '/rest/v1/admins?user_id=eq.' + encodeURIComponent(userId) + '&select=user_id',
    { headers: { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete } }
  );
  if (!reponse.ok) return false;
  const lignes = await reponse.json();
  return Array.isArray(lignes) && lignes.length > 0;
}

// Autorisation : le propriétaire de la photo (mannequin agissant sur son
// propre model_id) OU un admin — même règle que le déclencheur SQL
// proteger_proprietaire_photo() qu'on remplace ici pour les photos R2.
async function autoriser(jeton, modelId) {
  const utilisateur = await verifierUtilisateur(jeton);
  if (!utilisateur) return { ok: false, code: 401, message: 'Session invalide ou expirée — reconnectez-vous.' };
  if (utilisateur.id === modelId) return { ok: true };
  if (await estAdmin(utilisateur.id)) return { ok: true };
  return { ok: false, code: 403, message: "Vous n'avez pas le droit d'agir sur ces photos." };
}

// Diagnostic temporaire : vérifie que chaque variable d'environnement est
// bien composée uniquement de caractères ASCII/Latin-1 (0-255), sans jamais
// révéler sa vraie valeur — juste sa longueur et la position d'un éventuel
// caractère invalide (ex. un "•" introduit par un copier-coller). À retirer
// une fois le diagnostic terminé.
function diagnostiquerVariables(res) {
  const noms = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const rapport = {};
  noms.forEach(function (nom) {
    const valeur = process.env[nom];
    if (!valeur) { rapport[nom] = { presente: false }; return; }
    let indexInvalide = -1, codeInvalide = null;
    for (let i = 0; i < valeur.length; i++) {
      const code = valeur.charCodeAt(i);
      if (code > 255) { indexInvalide = i; codeInvalide = code; break; }
    }
    rapport[nom] = { presente: true, longueur: valeur.length, indexCaractereInvalide: indexInvalide, codeCaractereInvalide: codeInvalide };
  });
  res.status(200).json(rapport);
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET' && req.query && req.query.diag === 'r2env') {
    diagnostiquerVariables(res);
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const variablesManquantes = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    .filter(function (nom) { return !process.env[nom]; });
  if (variablesManquantes.length) {
    res.status(500).json({ error: 'Configuration serveur incomplète (variables manquantes : ' + variablesManquantes.join(', ') + ').' });
    return;
  }

  const enTeteAuth = req.headers.authorization || '';
  const jeton = enTeteAuth.startsWith('Bearer ') ? enTeteAuth.slice(7) : '';

  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch (e) { corps = {}; } }
  const { action, modelId, chemin, contentType } = corps || {};

  if (!modelId || typeof modelId !== 'string' || !chemin || typeof chemin !== 'string') {
    res.status(400).json({ error: 'Paramètres manquants (modelId, chemin).' });
    return;
  }
  // Le chemin doit toujours commencer par le modelId — évite qu'un mannequin
  // signe une clé en dehors de son propre dossier.
  if (chemin !== modelId && !chemin.startsWith(modelId + '/')) {
    res.status(400).json({ error: "Chemin invalide (doit rester dans le dossier du mannequin)." });
    return;
  }

  // Tout ce qui suit (vérification Supabase, appels R2) peut échouer de façon
  // inattendue (réseau, identifiants invalides...) — tout est regroupé dans
  // ce seul bloc try/catch pour ne jamais laisser Vercel renvoyer sa propre
  // page d'erreur générique (non-JSON), que le navigateur ne peut pas lire.
  try {
    const autorisation = await autoriser(jeton, modelId);
    if (!autorisation.ok) {
      res.status(autorisation.code).json({ error: autorisation.message });
      return;
    }

    const client = creerClientR2();
    const bucket = process.env.R2_BUCKET_NAME;

    if (action === 'suppression') {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: chemin }));
      res.status(200).json({ ok: true });
      return;
    }

    // Par défaut : demande d'envoi (upload).
    const commande = new PutObjectCommand({
      Bucket: bucket,
      Key: chemin,
      ContentType: contentType || 'image/jpeg'
    });
    const uploadUrl = await getSignedUrl(client, commande, { expiresIn: 300 });
    const publicUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '') + '/' + chemin;
    res.status(200).json({ uploadUrl: uploadUrl, publicUrl: publicUrl });
  } catch (e) {
    console.error('r2-presigner :', e);
    res.status(500).json({ error: e && e.message ? e.message : 'Erreur inattendue.' });
  }
};
