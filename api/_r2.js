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

// Note d'information et procédure d'intégration (14/10/2026, demande de la propriétaire) :
// PDF réservé aux mannequins qui ont un code d'inscription valable. Jamais dans le dépôt
// (public sur GitHub) : il est rangé dans R2 sous un nom secret de 32 caractères
// hexadécimaux. Le stockage public ne permet pas de lister les fichiers ; seul le serveur,
// avec ses clés, retrouve le document (api/code-protege.js, après vérification du code).
const CHEMIN_NOTE_INTEGRATION = /^prive\/note-integration\/[0-9a-f]{32}\.pdf$/;
// Documents déposés, du plus récent au plus ancien : [{ chemin, date }].
async function notesIntegration() {
  const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const rep = await creerClientR2().send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, Prefix: 'prive/note-integration/' }));
  return (rep.Contents || [])
    .filter(o => CHEMIN_NOTE_INTEGRATION.test(o.Key))
    .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
    .map(o => ({ chemin: o.Key, date: o.LastModified }));
}
// Retire les documents PLUS ANCIENS que celui à garder (le nouveau, tout juste déposé).
// Renvoie false si ce document n'existe pas : rien n'est alors supprimé. Deux dépôts
// presque simultanés ne s'effacent donc jamais l'un l'autre : le plus récent reste.
// Code d'inscription valable : on remet aussi le chemin secret de la note d'intégration
// (14/10/2026), ou null s'il n'y en a pas (ou si le stockage ne répond pas : l'inscription doit
// continuer de marcher sans elle). Au plus 3 s : la note ne doit jamais retarder l'inscription.
// Utilisé par api/code-protege.js et par l'inscription par code individuel (api/portail.js).
async function cheminNoteIntegration() {
  let minuteur;
  try {
    const delai = new Promise(ok => { minuteur = setTimeout(() => ok([]), 3000); });
    const n = await Promise.race([notesIntegration(), delai]);
    return n[0] ? n[0].chemin : null;
  } catch (e) { return null; } finally { clearTimeout(minuteur); }
}

async function nettoyerNotesIntegration(garder) {
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const notes = await notesIntegration();
  const gardee = notes.find(n => n.chemin === garder);
  if (!gardee) return false;
  const client = creerClientR2();
  for (const n of notes) {
    if (new Date(n.date) < new Date(gardee.date)) await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: n.chemin }));
  }
  return true;
}
// Catégorie 'note-integration' de api/r2-site-images.js, traitée à part pour ne rien
// assouplir des contrôles des images : admin déjà vérifié par l'appelant. Actions :
// 'lire' (document en place), 'nettoyer' (retirer les plus anciens), envoi d'un PDF.
async function traiterNoteIntegration(res, corps) {
  const { action, chemin, contentType, taille } = corps;
  if (action === 'lire') { const n = await notesIntegration(); res.status(200).json(n[0] || {}); return; }
  if (typeof chemin !== 'string' || !CHEMIN_NOTE_INTEGRATION.test(chemin)) {
    res.status(400).json({ error: 'Nom de document invalide.' }); return;
  }
  if (action === 'nettoyer') {
    if (await nettoyerNotesIntegration(chemin)) res.status(200).json({ ok: true });
    else res.status(404).json({ error: 'Document introuvable.' });
    return;
  }
  if (action || contentType !== 'application/pdf') { res.status(400).json({ error: 'Format non accepté (document PDF uniquement).' }); return; }
  await repondreR2(res, undefined, chemin, 'application/pdf', taille, 15 * 1024 * 1024);
}

module.exports = { debutR2, repondreR2, TYPES_IMAGES, CHEMIN_NOTE_INTEGRATION, notesIntegration, cheminNoteIntegration, nettoyerNotesIntegration, traiterNoteIntegration };
