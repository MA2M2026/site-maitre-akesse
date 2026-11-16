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


const { SUPABASE_URL, enTetesService, extraireIp, creerClientR2, verifierUtilisateur, adminVerifie, cheminSur, noterAuJournal, limiteDebit } = require('./_commun.js');
const { debutR2, repondreR2, contenuR2, messageFichierFaux, TYPES_IMAGES } = require('./_r2.js');
const crypto = require('crypto');

// Autorisation : le propriétaire de la photo (mannequin agissant sur son
// propre model_id) OU un admin — même règle que le déclencheur SQL
// proteger_proprietaire_photo() qu'on remplace ici pour les photos R2.
async function autoriser(jeton, modelId, appareil) {
  const utilisateur = await verifierUtilisateur(jeton);
  if (!utilisateur) return { ok: false, code: 401, message: 'Session invalide ou expirée, reconnectez-vous.' };
  if (utilisateur.id === modelId) return { ok: true, utilisateur };
  if (await adminVerifie(jeton, utilisateur, appareil)) return { ok: true, utilisateur };
  return { ok: false, code: 403, message: "Vous n'avez pas le droit d'agir sur ces photos." };
}

// Formats d'image acceptés : TYPES_IMAGES (api/_r2.js).
// Taille maximale d'un envoi (audit du 05/10/2026, accord de la propriétaire le 06/10) :
// les photos sont réduites par l'appareil avant l'envoi (1 à 2 Mo), cette limite ne gêne
// donc jamais un envoi normal. La taille annoncée est inscrite dans la signature de
// l'adresse d'envoi : le stockage refuse tout fichier d'une autre taille. Personne ne peut
// donc remplir le stockage en contournant le site.
const TAILLE_MAX = 15 * 1024 * 1024;


// =====================================================================================================
// (16/11/2026, chantier L-17, demande de la propriétaire) PHOTOS DES CANDIDATURES (« Postuler à un casting »,
// « Intégrer l'agence ») : d'abord chez Cloudflare R2, l'Administration les affiche depuis R2 ; la copie Google
// Drive (archive) part ensuite comme avant. Avant : Drive seulement, et Google ne servait pas les photos de façon
// fiable à l'Administration (elles apparaissaient puis disparaissaient).
//  - « candidature_signer » (visiteur, SANS compte) : adresse d'envoi d'UNE image vers candidatures/<id>/<nom
//    aléatoire> — nom choisi par le serveur, jamais par la page ; seulement pour une candidature « nouvelle » de
//    moins de 2 h, moins de 12 photos, et un nombre de demandes limité par adresse.
//  - « candidature_verifier » (visiteur) : relit le fichier (vraie image, sinon effacé) et c'est LE SERVEUR qui note
//    la photo dans casting_photos (chemin « r2:candidatures/… »).
//  - « candidature_lire » / « candidature_supprimer » (équipe connectée, double authentification) : adresses de
//    lecture signées d'1 heure (les photos des candidates ne sont jamais servies en accès libre), suppression au clic.
// =====================================================================================================
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES_CANDIDATURE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const PHOTOS_MAX_CANDIDATURE = 12;
const cheminCandidature = (id, chemin) => typeof chemin === 'string'
  && new RegExp('^candidatures/' + id + '/[0-9a-f]{32}\\.(jpg|png|webp)$').test(chemin);

// La candidature peut-elle encore recevoir des photos ? Renvoie un message d'erreur, ou null.
async function candidatureOuverte(id) {
  const lire = (url) => fetch(SUPABASE_URL + '/rest/v1/' + url, { headers: enTetesService() }).then((r) => (r.ok ? r.json() : null));
  const [dossiers, photos] = await Promise.all([
    lire('casting_applications?select=id,status,created_at&id=eq.' + id),
    lire('casting_photos?select=id&application_id=eq.' + id + '&chemin=like.r2%3A*')
  ]);
  if (!Array.isArray(dossiers) || !Array.isArray(photos)) return 'Vérification impossible pour le moment : réessayez dans un instant.';
  const d = dossiers[0];
  if (!d || d.status !== 'nouvelle' || Date.now() - new Date(d.created_at).getTime() > 2 * 3600 * 1000) return 'Cette candidature ne reçoit plus de photos.';
  if (photos.length >= PHOTOS_MAX_CANDIDATURE) return 'Nombre maximum de photos atteint (' + PHOTOS_MAX_CANDIDATURE + ').';
  return null;
}

async function photoCandidature(req, res, debut) {
  const { action, candidature, chemin, chemins, contentType, taille } = debut.corps;
  try {
    if (action === 'candidature_lire' || action === 'candidature_supprimer') {
      const utilisateur = await verifierUtilisateur(debut.jeton);
      if (!utilisateur || !(await adminVerifie(debut.jeton, utilisateur, req.headers['x-appareil']))) {
        res.status(403).json({ error: 'Réservé à l’équipe de l’agence.' }); return;
      }
      const liste = (Array.isArray(chemins) ? chemins : [chemin]).filter((c) => typeof c === 'string' && /^candidatures\/[0-9a-f-]{36}\/[0-9a-f]{32}\.(jpg|png|webp)$/.test(c));
      if (!liste.length || liste.length > 200) { res.status(400).json({ error: 'Photos invalides.' }); return; }
      const { GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      const client = creerClientR2(), bucket = process.env.R2_BUCKET_NAME;
      if (action === 'candidature_supprimer') {
        // (sécurité) on n'efface QUE des fichiers que plus aucune fiche ne cite : la fiche a d'abord été supprimée
        // dans la base par un clic de l'agence (droits de la base) ; un appel direct ne peut rien effacer d'autre.
        const cites = await fetch(SUPABASE_URL + '/rest/v1/casting_photos?select=chemin&chemin=in.(' + liste.map((c) => '"r2:' + c + '"').join(',') + ')', { headers: enTetesService() });
        const lignes = cites.ok ? await cites.json() : null;
        if (!Array.isArray(lignes)) { res.status(503).json({ error: 'Vérification impossible pour le moment.' }); return; }
        if (lignes.length) { res.status(409).json({ error: 'Photo encore présente dans un dossier : rien n’a été effacé.' }); return; }
        for (const c of liste) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: c }));
        res.status(200).json({ ok: true }); return;
      }
      const adresses = {};
      for (const c of liste) adresses[c] = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: c }), { expiresIn: 3600 });
      res.status(200).json({ adresses }); return;
    }
    // ---- visiteur sans compte ----
    if (typeof candidature !== 'string' || !UUID.test(candidature)) { res.status(400).json({ error: 'Candidature inconnue.' }); return; }
    if (await limiteDebit(res, 'r2-candidature', extraireIp(req) || 'inconnue', 60)) return;
    const fermee = await candidatureOuverte(candidature);
    if (fermee) { res.status(fermee.startsWith('Vérification') ? 503 : 403).json({ error: fermee }); return; }
    if (action === 'candidature_signer') {
      const extension = TYPES_CANDIDATURE[contentType];
      if (!extension) { res.status(400).json({ error: 'Format de photo non accepté (JPEG, PNG ou WebP).' }); return; }
      if (!Number.isInteger(taille) || taille <= 0 || taille > TAILLE_MAX) { res.status(400).json({ error: 'Photo trop lourde ou taille inconnue.' }); return; }
      const cle = 'candidatures/' + candidature + '/' + crypto.randomBytes(16).toString('hex') + '.' + extension;
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      const uploadUrl = await getSignedUrl(creerClientR2(), new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: cle, ContentType: contentType, ContentLength: taille }), { expiresIn: 300 });
      res.status(200).json({ uploadUrl, chemin: cle }); return;
    }
    if (action === 'candidature_verifier') {
      if (!cheminCandidature(candidature, chemin)) { res.status(400).json({ error: 'Photo invalide.' }); return; }
      const type = Object.keys(TYPES_CANDIDATURE).find((t) => chemin.endsWith('.' + TYPES_CANDIDATURE[t]));
      const etat = await contenuR2(chemin, type);
      if (etat === 'faux') { res.status(422).json({ error: messageFichierFaux(type), refuse: true }); return; }
      const note = await fetch(SUPABASE_URL + '/rest/v1/casting_photos', {
        method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ application_id: candidature, chemin: 'r2:' + chemin })
      });
      if (!note.ok) { res.status(500).json({ error: 'Photo envoyée mais non enregistrée : la copie de sauvegarde suit.' }); return; }
      res.status(200).json({ ok: true, verifie: etat === 'ok' }); return;
    }
    res.status(400).json({ error: 'Action inconnue.' });
  } catch (e) {
    console.error('r2-presigner (candidature) :', e);
    await noterAuJournal('[Photos des candidatures] ' + ((e && e.message) || e), 'r2-presigner', '/api/r2-presigner').catch(() => {});
    res.status(500).json({ error: 'Envoi impossible pour le moment.' });
  }
}

module.exports = async function handler(req, res) {
  const debut = debutR2(req, res); // POST + variables d'environnement (api/_r2.js)
  if (!debut) return;
  if (typeof debut.corps.action === 'string' && debut.corps.action.startsWith('candidature_')) return photoCandidature(req, res, debut);  // (L-17)
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
    const autorisation = await autoriser(jeton, modelId, req.headers['x-appareil']);
    if (!autorisation.ok) {
      res.status(autorisation.code).json({ error: autorisation.message });
      return;
    }
    // (W6 : 600 demandes par minute et par compte au plus — une photo du Book en fait une douzaine)
    if (await limiteDebit(res, 'r2-presigner', autorisation.utilisateur.id, 600)) return;

    await repondreR2(res, action, chemin, typeFichier, taille, TAILLE_MAX); // api/_r2.js
  } catch (e) {
    console.error('r2-presigner :', e);
    await noterAuJournal('[Photos du Book] ' + ((e && e.message) || e), 'r2-presigner', '/api/r2-presigner');
    res.status(500).json({ error: e && e.message ? e.message : 'Erreur inattendue.' });
  }
};
