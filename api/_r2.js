// Envoi / suppression de fichiers sur le stockage R2, partagé par r2-presigner.js (photos du
// Book) et r2-site-images.js (images du site). Fichier à part (et non dans _commun.js) pour
// que les fonctions de connexion n'embarquent pas les modules du stockage.
const { jetonDe, corpsDe, creerClientR2, noterAuJournal, SUPABASE_URL, enTetesService } = require('./_commun.js');

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

// Contenu RÉEL d'un fichier (lot 3, étape 4 de PLAN-SERVEUR.md, 01/11/2026) : le type annoncé ne suffit pas.
// On lit les premiers octets (la « signature » de chaque format). image : JPEG, PNG, GIF, WebP, HEIC/AVIF ;
// video : MP4 (ftyp), WebM ; pdf : %PDF. Renvoie la famille reconnue ('image', 'video', 'pdf') ou null.
function familleDuContenu(o) {
  if (!o || o.length < 12) return null;
  const debut = (octets) => octets.every((x, i) => o[i] === x);
  const texte = (de, a) => String.fromCharCode(...o.slice(de, a));
  if (debut([0xFF, 0xD8, 0xFF]) || debut([0x89, 0x50, 0x4E, 0x47]) || texte(0, 4) === 'GIF8' || (texte(0, 4) === 'RIFF' && texte(8, 12) === 'WEBP')) return 'image';
  if (texte(4, 8) === 'ftyp') return /^(heic|heix|heim|heis|hevc|hevx|mif1|msf1|avif|avis)$/.test(texte(8, 12)) ? 'image' : 'video';
  if (debut([0x1A, 0x45, 0xDF, 0xA3])) return 'video';
  if (texte(0, 5) === '%PDF-') return 'pdf';
  return null;
}
// Familles permises selon le type annoncé à l'envoi (octet-stream : seulement une vraie image)
function famillesPermises(typeFichier) {
  if (/^video\//i.test(typeFichier)) return ['video'];
  if (typeFichier === 'application/pdf') return ['pdf'];
  return ['image'];
}
// Après l'envoi : lit les 32 premiers octets du fichier déposé. Renvoie 'ok' (le format annoncé), 'illisible'
// (relecture impossible : jamais bloquant, noté au journal), 'absent' (aucun fichier à cette adresse) ou 'faux' (le
// fichier a été SUPPRIMÉ du stockage).
// (16/11/2026, L-17 : partagé par verifierContenuR2 et les photos des candidatures, api/r2-presigner.js)
async function contenuR2(chemin, typeFichier) {
  const { GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const client = creerClientR2();
  const bucket = process.env.R2_BUCKET_NAME;
  let octets = null;
  try {
    const objet = await client.send(new GetObjectCommand({ Bucket: bucket, Key: chemin, Range: 'bytes=0-31' }));
    octets = Array.from(await objet.Body.transformToByteArray());
  } catch (e) {
    // (16/11/2026, relecture de sécurité de D sur L-17) fichier jamais déposé : 'absent' (pas une panne)
    if (e && (e.name === 'NoSuchKey' || (e.$metadata && e.$metadata.httpStatusCode === 404))) return 'absent';
    // (01/11/2026, panne : les mannequins ne pouvaient plus ajouter de photos) relecture impossible (droit de
    // lecture du stockage, réseau…) : l'envoi n'est JAMAIS bloqué pour ça ; seul un fichier lu et faux est refusé
    console.error('verifierContenuR2 :', e);
    await noterAuJournal('[Vérification des fichiers] relecture impossible : ' + ((e && (e.name || e.message)) || e), 'r2', '/api/r2-presigner').catch(() => {});
    return 'illisible';
  }
  if (famillesPermises(typeFichier).includes(familleDuContenu(octets))) return 'ok';
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: chemin })).catch(() => {});
  return 'faux';
}
function messageFichierFaux(typeFichier) {
  return 'Ce fichier n’est pas une vraie ' + (typeFichier === 'application/pdf' ? 'document PDF' : /^video/i.test(typeFichier) ? 'vidéo' : 'photo') + ' : il a été refusé.';
}
// Appelé par le navigateur juste après l'envoi : 422 si le fichier n'est pas du format annoncé.
async function verifierContenuR2(res, chemin, typeFichier) {
  const etat = await contenuR2(chemin, typeFichier);
  if (etat === 'illisible' || etat === 'absent') { res.status(200).json({ ok: true, verifie: false }); return; }  // (inchangé pour le Book)
  if (etat === 'ok') { res.status(200).json({ ok: true }); return; }
  res.status(422).json({ error: messageFichierFaux(typeFichier), refuse: true });
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
  if (action === 'verifier') { await verifierContenuR2(res, chemin, typeFichier); return; }

  // Par défaut : demande d'envoi (upload).
  if (!Number.isInteger(taille) || taille <= 0 || taille > tailleMax) {
    res.status(400).json({ error: Number.isInteger(taille) && taille > tailleMax
      ? 'Fichier trop lourd (' + (taille / 1048576).toFixed(1).replace('.', ',') + ' Mo, maximum ' + (tailleMax / 1048576) + ' Mo).'
      : 'Taille du fichier manquante, rechargez la page puis réessayez.' });
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
// (16/11/2026, L-17, relecture de sécurité de D) PHOTOS DES CANDIDATURES ET DES COURS DE TALONS chez Cloudflare.
// Nombre de fichiers déjà déposés sous un dossier (compté AVANT de signer un nouvel envoi) ; null si illisible.
async function nbFichiersR2(prefixe) {
  const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const r = await creerClientR2().send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, Prefix: prefixe, MaxKeys: 50 })).catch(() => null);
  return r ? (r.Contents || []).length : null;
}
// Nettoyage quotidien (tâche du matin, api/portail.js) : efface les fichiers de candidatures/ et cours-talons/ que
// PLUS AUCUNE fiche ne cite (envois jamais vérifiés, inscriptions abandonnées). Règle n° 6 : jamais une photo de
// mannequin (seuls ces deux dossiers, noms au format exact) ; jamais un fichier cité ; base illisible = rien effacé.
// Délai : 2 h pour une candidature (sa fiche existe AVANT ses photos) ; 7 jours pour un cours de talons (l'inscription
// n'est enregistrée qu'après la vidéo, et un envoi coupé reprend quand la personne revient sur la page).
const NETTOYAGE = [
  { prefixe: 'candidatures/', delai: 2 * 3600e3, cites: (ids) => 'casting_photos?select=chemin&application_id=in.(' + ids.join(',') + ')', chemins: (l) => l.map((x) => x.chemin) },
  { prefixe: 'cours-talons/', delai: 7 * 24 * 3600e3, cites: (ids) => 'cours_talons?select=photos&id=in.(' + ids.join(',') + ')', chemins: (l) => l.flatMap((x) => (Array.isArray(x.photos) ? x.photos : [])) }
];
async function nettoyerPhotosNonCitees(maintenant = Date.now()) {
  const { ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const client = creerClientR2(), bucket = process.env.R2_BUCKET_NAME;
  let effaces = 0;
  for (const n of NETTOYAGE) {
    const motif = new RegExp('^' + n.prefixe + '([0-9a-f-]{36})/[0-9a-f]{32}\\.(jpg|png|webp)$');
    const vieux = [];
    let suite;
    for (let page = 0; page < 20; page++) {   // (1 000 fichiers par page, 20 pages au plus par matin)
      const r = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: n.prefixe, ContinuationToken: suite }));
      (r.Contents || []).forEach((o) => { if (motif.test(o.Key) && maintenant - new Date(o.LastModified).getTime() > n.delai) vieux.push(o.Key); });
      if (!r.IsTruncated) break;
      suite = r.NextContinuationToken;
    }
    const ids = [...new Set(vieux.map((k) => motif.exec(k)[1]))];
    const cites = new Set();
    for (let i = 0; i < ids.length; i += 50) {
      const rep = await fetch(SUPABASE_URL + '/rest/v1/' + n.cites(ids.slice(i, i + 50)), { headers: enTetesService() });
      if (!rep.ok) throw new Error('lecture de la base impossible (' + rep.status + ') : rien n’est effacé dans ' + n.prefixe);
      n.chemins(await rep.json()).forEach((c) => cites.add(c));
    }
    for (const k of vieux) {
      if (cites.has('r2:' + k)) continue;
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: k }));
      effaces++;
    }
  }
  return effaces;
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
  if (action === 'verifier') { await verifierContenuR2(res, chemin, 'application/pdf'); return; }
  if (action || contentType !== 'application/pdf') { res.status(400).json({ error: 'Format non accepté (document PDF uniquement).' }); return; }
  await repondreR2(res, undefined, chemin, 'application/pdf', taille, 15 * 1024 * 1024);
}

module.exports = { debutR2, repondreR2, contenuR2, messageFichierFaux, nbFichiersR2, nettoyerPhotosNonCitees, familleDuContenu, famillesPermises, TYPES_IMAGES, CHEMIN_NOTE_INTEGRATION, notesIntegration, nettoyerNotesIntegration, traiterNoteIntegration };
