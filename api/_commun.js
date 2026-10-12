// Outils partagés par les fonctions serveur api/ (07/10/2026, nettoyage des doublons) :
// ils étaient recopiés dans plusieurs fichiers. Le nom commence par « _ » : Vercel ne
// le compte pas comme une fonction (limite de 12 sur l'offre gratuite), il est seulement
// chargé par les autres fichiers avec require('./_commun.js').
//
// La clé secrète Supabase (SUPABASE_SERVICE_ROLE_KEY) ne sert ici qu'à valider un jeton
// de connexion et à lire la table `admins` ; elle ne quitte jamais le serveur.

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';

function cleService() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function enTetesService() {
  const cle = cleService();
  return { apikey: cle, Authorization: 'Bearer ' + cle };
}

// Jeton « Bearer » envoyé par le navigateur (chaîne vide s'il manque).
function jetonDe(req) {
  const enTete = req.headers.authorization || '';
  return enTete.startsWith('Bearer ') ? enTete.slice(7) : '';
}

// Corps JSON de la requête (objet vide s'il est illisible).
function corpsDe(req) {
  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch (e) { corps = {}; } }
  return corps || {};
}

// Compte connecté correspondant au jeton, ou null (jeton absent, invalide ou expiré).
async function verifierUtilisateur(jeton) {
  const cle = cleService();
  if (!cle || !jeton) return null;
  const reponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: cle, Authorization: 'Bearer ' + jeton }
  });
  if (!reponse.ok) return null;
  return reponse.json();
}

// Lignes de la table `admins` pour ce compte : tableau (vide si ce n'est pas un admin),
// ou null si la base n'a pas répondu — à chacun de décider de refuser dans ce cas.
async function lignesAdmin(userId) {
  const reponse = await fetch(
    SUPABASE_URL + '/rest/v1/admins?user_id=eq.' + encodeURIComponent(userId) + '&select=user_id',
    { headers: enTetesService() }
  );
  if (!reponse.ok) return null;
  const lignes = await reponse.json();
  return Array.isArray(lignes) ? lignes : null;
}

// Le compte est-il administrateur ? (non, si la base n'a pas répondu)
async function estAdmin(userId) {
  const lignes = await lignesAdmin(userId);
  return !!lignes && lignes.length > 0;
}

// Client du stockage des photos (Cloudflare R2), chargé seulement par les fonctions qui en ont besoin.
function creerClientR2() {
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client({
    region: 'auto',
    endpoint: 'https://' + process.env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
}

// Chemin de fichier sans danger : refuse les remontées de dossier (« .. » comme segment),
// les antislashs, les doubles barres et les caractères de contrôle ; « photo..jpg » reste accepté.
function cheminSur(chemin) {
  return !/(^|\/)\.\.(\/|$)|\\|\/\/|[\u0000-\u001f]/.test(chemin);
}

// Adresse IP du visiteur (pour le blocage après trop d'erreurs de connexion).
function extraireIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || '0.0.0.0';
}

// Identifiant d'appareil envoyé par le navigateur, accepté seulement s'il a la forme attendue.
function nettoyerAppareil(v) {
  return typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null;
}

// Types de fichiers acceptés (audit du 28 septembre 2026). Les photos sont servies
// depuis le domaine du site lui-même (relais /book-photos) : un fichier HTML ou SVG
// « déguisé » en photo pourrait sinon exécuter du code sur www.maitreakessemodelmanagement.com
// et voler la session d'un visiteur connecté. On n'accepte donc que de vraies images
// (octet-stream toléré : jamais exécuté par un navigateur, et renvoyé par certains
// téléchargements lors des migrations).
const TYPES_IMAGES = /^(image\/(jpeg|jpg|pjpeg|png|webp|gif|heic|heif|avif)|application\/octet-stream)$/i;

// ---- Envoi / suppression de fichiers sur le stockage R2 (r2-presigner.js pour les photos du
// Book, r2-site-images.js pour les images du site) — partagé le 12/10/2026 (avant, recopié).

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

// Début commun des fonctions serveur (12/10/2026 : avant, recopié dans chacune) : refuse
// tout sauf POST, vérifie que la clé secrète est bien configurée et, si authentifie, qu'un
// jeton de connexion est fourni. Renvoie { jeton, corps }, ou null après avoir déjà répondu.
function debutRequete(req, res, authentifie) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return null;
  }
  if (!cleService()) {
    res.status(500).json({ error: 'Configuration serveur incomplète.' });
    return null;
  }
  const jeton = jetonDe(req);
  if (authentifie && !jeton) {
    res.status(401).json({ error: 'Non authentifié.' });
    return null;
  }
  return { jeton, corps: corpsDe(req) };
}

// Compteur de tentatives d'un accès protégé (connexion par mot de passe, code de validation) :
// blocage après trop d'erreurs, stocké en base (jamais dans le navigateur). Partagé le
// 12/10/2026 (avant, recopié dans connexion-protegee.js et code-validation-protege.js).
function compteurTentatives(ip, identifiant, espace, appareil) {
  const entetes = { ...enTetesService(), 'Content-Type': 'application/json' };
  const appeler = (rpc) => fetch(SUPABASE_URL + '/rest/v1/rpc/' + rpc, {
    method: 'POST', headers: entetes,
    body: JSON.stringify({ p_ip: ip, p_identifiant: identifiant, p_espace: espace, p_appareil: appareil })
  });
  return {
    // Déjà bloqué ? Répond 429 et renvoie true (on refuse sans rien vérifier d'autre).
    async dejaBloque(res) {
      const rep = await appeler('connexion_verifier_blocage');
      const etat = (rep.ok ? await rep.json() : [])[0];
      if (!(etat && etat.bloque)) return false;
      res.setHeader('Retry-After', String(etat.minutes_restantes * 60));
      res.status(429).json({ error: 'bloque', dejaBloque: true, minutesRestantes: etat.minutes_restantes });
      return true;
    },
    // Erreur : la compte et répond 429 (blocage déclenché) ou 401 (essais restants).
    async echec(res) {
      const rep = await appeler('connexion_enregistrer_echec');
      const etat = (rep.ok ? await rep.json() : [])[0] || { bloque: false, essais_restants: null };
      if (etat.bloque) {
        res.setHeader('Retry-After', String(etat.minutes_blocage * 60));
        res.status(429).json({ error: 'bloque', dejaBloque: false, minutesRestantes: etat.minutes_blocage });
        return;
      }
      res.status(401).json({ error: 'refuse', essaisRestants: etat.essais_restants });
    },
    // Réussite : remet le compteur à zéro.
    async succes() { await appeler('connexion_enregistrer_succes'); }
  };
}

module.exports = {
  SUPABASE_URL, cleService, enTetesService, jetonDe, corpsDe,
  verifierUtilisateur, lignesAdmin, estAdmin, creerClientR2, cheminSur, extraireIp, nettoyerAppareil,
  debutRequete, compteurTentatives, debutR2, repondreR2, TYPES_IMAGES
};
