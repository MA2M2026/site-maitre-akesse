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

// Fiche du portail d'administration de ce compte ({ role, actif }), ou null s'il n'en a pas
// (ancien compte admin) ; erreur si la base n'a pas répondu (24/10/2026 : utilisée par
// _creer-admin.js mais jamais écrite — « Créer un compte admin » plantait).
async function ficheStaff(userId) {
  const reponse = await fetch(SUPABASE_URL + '/rest/v1/staff_profiles?user_id=eq.' + encodeURIComponent(userId) + '&select=role,actif', { headers: enTetesService() });
  if (!reponse.ok) throw new Error('Base injoignable (fiche du portail).');
  const lignes = await reponse.json();
  return Array.isArray(lignes) && lignes.length ? lignes[0] : null;
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

// Contenu d'un jeton de connexion Supabase (niveau « aal », méthodes « amr »…). Lecture seule,
// SANS vérifier la signature : toujours après verifierUtilisateur ou un appel à la base avec ce jeton.
function chargeJeton(jeton) {
  try { return JSON.parse(Buffer.from(String(jeton).split('.')[1], 'base64url').toString('utf8')); } catch (e) { return {}; }
}
// Administrateur connecté AVEC le code de l'application d'authentification (jeton « aal2 ») :
// un mot de passe volé seul ne suffit plus (24/10/2026). Pour toute action d'administration ;
// les étapes de connexion (avant le code) gardent estAdmin. Toujours après verifierUtilisateur.
async function adminVerifie(jeton, utilisateur) {
  return chargeJeton(jeton).aal === 'aal2' && (await estAdmin(utilisateur.id));
}
// Heure (en secondes) du dernier code de l'application d'authentification saisi pour ce jeton
function dernierCode(jeton) {
  const amr = chargeJeton(jeton).amr || [];
  return Math.max(0, ...amr.filter((m) => m && /totp/.test(m.method)).map((m) => Number(m.timestamp) || 0));
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
    // Erreur comptée sans répondre (la fonction répond elle-même, avec un message neutre).
    async compterEchec() { await appeler('connexion_enregistrer_echec'); },
    // Réussite : remet le compteur à zéro.
    async succes() { await appeler('connexion_enregistrer_succes'); }
  };
}

// ---- Clé d'accès au tableau de bord (13/10/2026, demande de la propriétaire) ----
// Après une connexion admin complète (mot de passe + code de validation), le serveur pose un
// cookie signé « ma2m_admin » (HttpOnly : invisible pour les scripts de la page). Le filtre
// middleware.js ne livre le vrai tableau de bord (et ses scripts) qu'avec ce cookie valide ;
// sinon, seulement l'écran de connexion. Format : v1.<id du compte>.<expiration en s>.<signature>
// — signature HMAC-SHA256 avec la clé serveur Supabase (jamais envoyée au navigateur).
// La vérification est réécrite dans middleware.js (moteur différent : Web Crypto).
// SameSite=Lax : la clé suit aussi un lien ouvert depuis un e-mail ou WhatsApp (lecture seule).
const DUREE_ACCES_TABLEAU_S = 12 * 3600;
function signatureAccesTableau(userId, expiration) {
  return require('crypto').createHmac('sha256', cleService()).update('tableau|' + userId + '|' + expiration).digest('base64url');
}
function cookieAccesTableau(userId) {
  const expiration = Math.floor(Date.now() / 1000) + DUREE_ACCES_TABLEAU_S;
  return 'ma2m_admin=v1.' + userId + '.' + expiration + '.' + signatureAccesTableau(userId, expiration) + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + DUREE_ACCES_TABLEAU_S;
}
const COOKIE_ACCES_TABLEAU_EFFACE = 'ma2m_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
// La requête porte-t-elle déjà une clé valide pour ce compte ? (prolongation sans redemander le code)
function cleAccesTableauValide(req, userId) {
  const m = String(req.headers.cookie || '').match(/(?:^|;\s*)ma2m_admin=v1\.([0-9a-f-]{36})\.(\d{9,12})\.([A-Za-z0-9_-]{20,})/);
  if (!m || m[1] !== userId || Number(m[2]) < Date.now() / 1000) return false;
  const attendue = Buffer.from(signatureAccesTableau(m[1], m[2])), recue = Buffer.from(m[3]);
  return attendue.length === recue.length && require('crypto').timingSafeEqual(attendue, recue);
}

// Adresse e-mail acceptée (une seule façon de lire l'adresse : étiquettes du domaine sans point,
// séparées par des points — SonarCloud S8786, 26/10/2026). Même règle que js/app.js.
const EMAIL_VALIDE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

module.exports = {
  EMAIL_VALIDE,
  SUPABASE_URL, cleService, enTetesService, jetonDe, corpsDe,
  verifierUtilisateur, lignesAdmin, estAdmin, adminVerifie, ficheStaff, creerClientR2, cheminSur, extraireIp, nettoyerAppareil,
  debutRequete, chargeJeton, dernierCode, compteurTentatives, cookieAccesTableau, cleAccesTableauValide, COOKIE_ACCES_TABLEAU_EFFACE
};
