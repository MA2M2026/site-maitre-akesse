// Envoi / suppression de fichiers sur le stockage R2, partagé par r2-presigner.js (photos du
// Book) et r2-site-images.js (images du site). Fichier à part (et non dans _commun.js) pour
// que les fonctions de connexion n'embarquent pas les modules du stockage.
const { jetonDe, corpsDe, creerClientR2 } = require('./_commun.js');

// Types de fichiers acceptés (audit du 28 septembre 2026). Les photos sont servies
// depuis le domaine du site lui-même (relais /book-photos) : un fichier HTML ou SVG
// « déguisé » en photo pourrait sinon exécuter du code sur www.maitreakessemodelmanagement.com
// et voler la session d'un visiteur connecté. On n'accepte donc que de vraies images
// (octet-stream toléré : jamais exécuté par un navigateur, et renvoyé par certains
// téléchargements lors des migrations).
const TYPES_IMAGES = /^(image\/(jpeg|jpg|pjpeg|png|webp|gif|heic|heif|avif)|application\/octet-stream)$/i;

// Début commun : POST seulement, et toutes les variables d'environnement nécessaires
// présentes. Renvoie { jeton, corps }, ou null après avoir déjà répondu.
function debutR2(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return null;
  }
  const variablesManquantes = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    .filter(function (nom) { return !process.env[nom]; });
  if (variablesManquantes.length) {
    res.status(500).json({ error: 'Configuration serveur incomplète (variables manquantes : ' + variablesManquantes.join(', ') + ').' });
    return null;
  }
  return { jeton: jetonDe(req), corps: corpsDe(req) };
}

// Une fois l'autorisation vérifiée : supprime le fichier (action « suppression ») ou renvoie
// une adresse d'envoi signée valable 5 minutes. La taille annoncée est inscrite dans la
// signature : le stockage refuse tout fichier d'une autre taille (personne ne peut remplir
// le stockage en contournant le site).
async function repondreR2(res, action, chemin, typeFichier, taille, tailleMax) {
  const { DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  const client = creerClientR2();
  const bucket = process.env.R2_BUCKET_NAME;

  if (action === 'suppression') {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: chemin }));
    res.status(200).json({ ok: true });
    return;
  }

  // Par défaut : demande d'envoi (upload).
  if (!Number.isInteger(taille) || taille <= 0 || taille > tailleMax) {
    res.status(400).json({ error: Number.isInteger(taille) && taille > tailleMax
      ? 'Fichier trop lourd (' + (taille / 1048576).toFixed(1).replace('.', ',') + ' Mo, maximum ' + (tailleMax / 1048576) + ' Mo).'
      : 'Taille du fichier manquante — rechargez la page puis réessayez.' });
    return;
  }
  const commande = new PutObjectCommand({ Bucket: bucket, Key: chemin, ContentType: typeFichier, ContentLength: taille });
  const uploadUrl = await getSignedUrl(client, commande, { expiresIn: 300 });
  const publicUrl = process.env.R2_PUBLIC_URL.replace(/\/$/, '') + '/' + chemin;
  res.status(200).json({ uploadUrl: uploadUrl, publicUrl: publicUrl });
}


module.exports = { debutR2, repondreR2, TYPES_IMAGES };
