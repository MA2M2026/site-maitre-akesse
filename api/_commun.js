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

module.exports = {
  SUPABASE_URL, cleService, enTetesService, jetonDe, corpsDe,
  verifierUtilisateur, lignesAdmin, estAdmin, creerClientR2, cheminSur, extraireIp, nettoyerAppareil
};
