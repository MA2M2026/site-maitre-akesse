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


const { verifierUtilisateur, adminVerifie, cheminSur } = require('./_commun.js');
const { debutR2, repondreR2, TYPES_IMAGES } = require('./_r2.js');

// Autorisation : le propriétaire de la photo (mannequin agissant sur son
// propre model_id) OU un admin — même règle que le déclencheur SQL
// proteger_proprietaire_photo() qu'on remplace ici pour les photos R2.
async function autoriser(jeton, modelId) {
  const utilisateur = await verifierUtilisateur(jeton);
  if (!utilisateur) return { ok: false, code: 401, message: 'Session invalide ou expirée — reconnectez-vous.' };
  if (utilisateur.id === modelId) return { ok: true };
  if (await adminVerifie(jeton, utilisateur)) return { ok: true };
  return { ok: false, code: 403, message: "Vous n'avez pas le droit d'agir sur ces photos." };
}

// Formats d'image acceptés : TYPES_IMAGES (api/_r2.js).
// Taille maximale d'un envoi (audit du 05/10/2026, accord de la propriétaire le 06/10) :
// les photos sont réduites par l'appareil avant l'envoi (1 à 2 Mo), cette limite ne gêne
// donc jamais un envoi normal. La taille annoncée est inscrite dans la signature de
// l'adresse d'envoi : le stockage refuse tout fichier d'une autre taille. Personne ne peut
// donc remplir le stockage en contournant le site.
const TAILLE_MAX = 15 * 1024 * 1024;

module.exports = async function handler(req, res) {
  const debut = debutR2(req, res); // POST + variables d'environnement (api/_r2.js)
  if (!debut) return;
  const jeton = debut.jeton;
  const { action, modelId, chemin, contentType, taille } = debut.corps;

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
  if (typeof typeFichier !== 'string' || !TYPES_IMAGES.test(typeFichier)) {
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

    await repondreR2(res, action, chemin, typeFichier, taille, TAILLE_MAX); // api/_r2.js
  } catch (e) {
    console.error('r2-presigner :', e);
    res.status(500).json({ error: e && e.message ? e.message : 'Erreur inattendue.' });
  }
};
