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
// 'couverture' : vidéo de couverture en haut de toutes les pages (04/10/2026).
// 'video-accueil' : grand espace vidéo dans le corps de la page d'accueil (05/10/2026).
const CATEGORIES_AUTORISEES = ['actualites', 'evenements', 'partenaires', 'responsable', 'boutique', 'couverture', 'video-accueil'];
const CATEGORIES_VIDEO = ['video-accueil']; // vidéo de couverture retirée le 06/10/2026

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
// Vidéos (MP4 / WebM) : uniquement pour la couverture et la vidéo de l'accueil — jamais exécutées par un
// navigateur, servies avec leur propre type par le relais /book-photos.
const TYPES_VIDEO = /^video\/(mp4|webm)$/i;
// Taille maximale d'un envoi, inscrite dans la signature de l'adresse d'envoi (même
// principe que api/r2-presigner.js) : 15 Mo pour une image, 25 Mo pour une vidéo
// (limites déjà appliquées par le tableau de bord avant l'envoi). La vidéo de l'accueil peut
// être longue (défilés de 5 à 10 minutes, 06/10/2026) : jusqu'à 250 Mo.
const TAILLE_MAX_IMAGE = 15 * 1024 * 1024, TAILLE_MAX_VIDEO = 25 * 1024 * 1024, TAILLE_MAX_VIDEO_ACCUEIL = 250 * 1024 * 1024;
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
  const { action, categorie, chemin, contentType, taille } = corps || {};

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
  const videoPermise = CATEGORIES_VIDEO.indexOf(categorie) !== -1 && typeof typeFichier === 'string' && TYPES_VIDEO.test(typeFichier);
  if (typeof typeFichier !== 'string' || (!TYPES_AUTORISES.test(typeFichier) && !videoPermise)) {
    res.status(400).json({ error: CATEGORIES_VIDEO.indexOf(categorie) !== -1 ? 'Format non accepté (vidéo MP4 ou WebM, ou photo).' : 'Format de fichier non accepté (photos JPEG, PNG, WebP, GIF, HEIC uniquement).' });
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

    const tailleMax = videoPermise ? (categorie === 'video-accueil' ? TAILLE_MAX_VIDEO_ACCUEIL : TAILLE_MAX_VIDEO) : TAILLE_MAX_IMAGE;
    if (!Number.isInteger(taille) || taille <= 0 || taille > tailleMax) {
      res.status(400).json({ error: Number.isInteger(taille) && taille > tailleMax
        ? 'Fichier trop lourd (' + (taille / 1048576).toFixed(1).replace('.', ',') + ' Mo, maximum ' + (tailleMax / 1048576) + ' Mo).'
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
    console.error('r2-site-images :', e);
    res.status(500).json({ error: e && e.message ? e.message : 'Erreur inattendue.' });
  }
};
