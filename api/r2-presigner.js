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

const { DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const { jetonDe, corpsDe, verifierUtilisateur, estAdmin, creerClientR2, cheminSur } = require('./_commun.js');

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

// Types de fichiers acceptés (audit du 28 septembre 2026). Les photos sont servies
// depuis le domaine du site lui-même (relais /book-photos) : un fichier HTML ou SVG
// « déguisé » en photo pourrait sinon exécuter du code sur www.maitreakessemodelmanagement.com
// et voler la session d'un visiteur connecté. On n'accepte donc que de vraies images
// (octet-stream toléré : jamais exécuté par un navigateur, et renvoyé par certains
// téléchargements lors des migrations).
const TYPES_AUTORISES = /^(image\/(jpeg|jpg|pjpeg|png|webp|gif|heic|heif|avif)|application\/octet-stream)$/i;
// Taille maximale d'un envoi (audit du 05/10/2026, accord de la propriétaire le 06/10) :
// les photos sont réduites par l'appareil avant l'envoi (1 à 2 Mo), cette limite ne gêne
// donc jamais un envoi normal. La taille annoncée est inscrite dans la signature de
// l'adresse d'envoi : le stockage refuse tout fichier d'une autre taille. Personne ne peut
// donc remplir le stockage en contournant le site.
const TAILLE_MAX = 15 * 1024 * 1024;
function tailleValide(taille) { return Number.isInteger(taille) && taille > 0 && taille <= TAILLE_MAX; }

module.exports = async function handler(req, res) {
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

  const jeton = jetonDe(req);
  const { action, modelId, chemin, contentType, taille } = corpsDe(req);

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

  if (!cheminSur(chemin)) {
    res.status(400).json({ error: 'Chemin invalide.' });
    return;
  }
  const typeFichier = contentType || 'image/jpeg';
  if (typeof typeFichier !== 'string' || !TYPES_AUTORISES.test(typeFichier)) {
    res.status(400).json({ error: 'Format de fichier non accepté (photos JPEG, PNG, WebP, GIF, HEIC uniquement).' });
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
    if (!tailleValide(taille)) {
      res.status(400).json({ error: Number.isInteger(taille) && taille > TAILLE_MAX
        ? 'Fichier trop lourd (' + (taille / 1048576).toFixed(1).replace('.', ',') + ' Mo, maximum 15 Mo).'
        : 'Taille du fichier manquante — rechargez la page puis réessayez.' });
      return;
    }
    const commande = new PutObjectCommand({
      Bucket: bucket,
      Key: chemin,
      ContentType: typeFichier,
      ContentLength: taille
    });
    const uploadUrl = await getSignedUrl(client, commande, { expiresIn: 300 });
    const publicUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '') + '/' + chemin;
    res.status(200).json({ uploadUrl: uploadUrl, publicUrl: publicUrl });
  } catch (e) {
    console.error('r2-presigner :', e);
    res.status(500).json({ error: e && e.message ? e.message : 'Erreur inattendue.' });
  }
};
