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


const { verifierUtilisateur, estAdmin, cheminSur } = require('./_commun.js');
const { debutR2, repondreR2, TYPES_IMAGES } = require('./_r2.js');
// 'boutique' : photos des produits de la Marketplace (29/09/2026).
// 'couverture' : vidéo de couverture en haut de toutes les pages (04/10/2026).
// 'video-accueil' : grand espace vidéo dans le corps de la page d'accueil (05/10/2026).
const CATEGORIES_AUTORISEES = ['actualites', 'evenements', 'partenaires', 'responsable', 'boutique', 'couverture', 'video-accueil'];
const CATEGORIES_VIDEO = ['couverture', 'video-accueil'];

// Formats d'image acceptés : TYPES_IMAGES (api/_r2.js).
// Vidéos (MP4 / WebM) : uniquement pour la couverture et la vidéo de l'accueil — jamais exécutées par un
// navigateur, servies avec leur propre type par le relais /book-photos.
const TYPES_VIDEO = /^video\/(mp4|webm)$/i;
// Taille maximale d'un envoi, inscrite dans la signature de l'adresse d'envoi (même
// principe que api/r2-presigner.js) : 15 Mo pour une image, 25 Mo pour une vidéo
// (limites déjà appliquées par le tableau de bord avant l'envoi). La vidéo de l'accueil peut
// être longue (défilés de 5 à 10 minutes, 06/10/2026) : jusqu'à 250 Mo.
const TAILLE_MAX_IMAGE = 15 * 1024 * 1024, TAILLE_MAX_VIDEO = 25 * 1024 * 1024, TAILLE_MAX_VIDEO_ACCUEIL = 250 * 1024 * 1024;

module.exports = async function handler(req, res) {
  const debut = debutR2(req, res); // POST + variables d'environnement (api/_r2.js)
  if (!debut) return;
  const jeton = debut.jeton;
  const { action, categorie, chemin, contentType, taille } = debut.corps;

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
  if (typeof typeFichier !== 'string' || (!TYPES_IMAGES.test(typeFichier) && !videoPermise)) {
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

    const tailleMax = videoPermise ? (categorie === 'video-accueil' ? TAILLE_MAX_VIDEO_ACCUEIL : TAILLE_MAX_VIDEO) : TAILLE_MAX_IMAGE;
    await repondreR2(res, action, chemin, typeFichier, taille, tailleMax); // api/_r2.js
  } catch (e) {
    console.error('r2-site-images :', e);
    res.status(500).json({ error: e && e.message ? e.message : 'Erreur inattendue.' });
  }
};
