// Fonction serveur — même principe que api/r2-presigner.js (photos du
// Book), mais pour les images du site gérées par un admin : actualités,
// événements, logos de partenaires. Jusqu'ici, ces images restaient sur
// Supabase Storage (contrairement aux photos du Book, déjà déménagées) —
// chaque visite d'une page publique les rechargeait depuis Supabase,
// consommant son quota gratuit de bande passante ("Cached Egress"),
// exactement le même problème qu'on avait déjà réglé pour le Book (voir
// README-TECHNIQUE.md, diagnostic du 28 septembre 2026).
//
// Contrairement à r2-presigner.js (qui autorise le mannequin propriétaire
// OU un admin), ces images n'appartiennent à aucun mannequin : seul un
// admin peut les envoyer ou les supprimer.
//
// Variables d'environnement requises sur Vercel (déjà en place pour
// r2-presigner.js) : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET_NAME, R2_PUBLIC_URL, SUPABASE_SERVICE_ROLE_KEY.

const { S3Client, DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
// 'boutique' : photos des produits de la Marketplace (29/09/2026).
// 'entete' : photo de couverture de l'entête persistante du site (cahier V2, H-3).
const CATEGORIES_AUTORISEES = ['actualites', 'evenements', 'partenaires', 'responsable', 'boutique', 'entete'];

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

// Types de fichiers acceptés (audit du 28 septembre 2026). Les photos sont servies
// depuis le domaine du site lui-même (relais /book-photos) : un fichier HTML ou SVG
// « déguisé » en photo pourrait sinon exécuter du code sur www.maitreakessemodelmanagement.com
// et voler la session d'un visiteur connecté. On n'accepte donc que de vraies images
// (octet-stream toléré : jamais exécuté par un navigateur, et renvoyé par certains
// téléchargements lors des migrations).
const TYPES_AUTORISES = /^(image\/(jpeg|jpg|pjpeg|png|webp|gif|heic|heif|avif)|application\/octet-stream)$/i;
function cheminSur(chemin) {
  // Refuse les remontées de dossier (« .. » comme segment), les antislashs, les
  // doubles barres et les caractères de contrôle ; « photo..jpg » reste accepté.
  return !/(^|\/)\.\.(\/|$)|\\|\/\/|[\u0000-\u001f]/.test(chemin);
}

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

  const enTeteAuth = req.headers.authorization || '';
  const jeton = enTeteAuth.startsWith('Bearer ') ? enTeteAuth.slice(7) : '';

  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch (e) { corps = {}; } }
  const { action, categorie, chemin, contentType } = corps || {};

  if (!categorie || CATEGORIES_AUTORISEES.indexOf(categorie) === -1) {
    res.status(400).json({ error: 'Catégorie invalide.' });
    return;
  }
  if (!chemin || typeof chemin !== 'string' || !chemin.startsWith('site/' + categorie + '/')) {
    res.status(400).json({ error: "Chemin invalide (doit rester dans le dossier de la catégorie)." });
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

  try {
    const utilisateur = await verifierUtilisateur(jeton);
    if (!utilisateur) {
      res.status(401).json({ error: 'Session invalide ou expirée — reconnectez-vous.' });
      return;
    }
    if (!(await estAdmin(utilisateur.id))) {
      res.status(403).json({ error: "Réservé aux administrateurs." });
      return;
    }

    const client = creerClientR2();
    const bucket = process.env.R2_BUCKET_NAME;

    if (action === 'suppression') {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: chemin }));
      res.status(200).json({ ok: true });
      return;
    }

    const commande = new PutObjectCommand({
      Bucket: bucket,
      Key: chemin,
      ContentType: typeFichier
    });
    const uploadUrl = await getSignedUrl(client, commande, { expiresIn: 300 });
    const publicUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '') + '/' + chemin;
    res.status(200).json({ uploadUrl: uploadUrl, publicUrl: publicUrl });
  } catch (e) {
    console.error('r2-site-images :', e);
    res.status(500).json({ error: e && e.message ? e.message : 'Erreur inattendue.' });
  }
};
