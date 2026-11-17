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
const { debutR2, repondreR2, contenuR2, messageFichierFaux, nbFichiersR2, lirePhotoDossier, nouvellePhotoDossier, effacerFichiersR2, TYPES_IMAGES } = require('./_r2.js');

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
//  - (16/11 15 h 25) avec « dossier: 'cours-talons' » : mêmes actions pour les COURS DE TALONS (cours-talons/<id>/,
//    numéro pas encore inscrit, 5 photos au plus, la page met la photo dans l'inscription ; la base la contrôle).
//  - « candidature_lire » / « candidature_supprimer » (équipe connectée, double authentification) : adresses de
//    lecture signées d'1 heure (les photos des candidates ne sont jamais servies en accès libre), suppression au clic.
//    (L-18 c) suppression aussi pour cours-talons/, seulement si l'inscription n'existe plus.
// =====================================================================================================
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES_CANDIDATURE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const PHOTOS_MAX_CANDIDATURE = 12;
// (L-17, élargi le 16/11 15 h 25) les COURS DE TALONS suivent la même route, dossier « cours-talons/<id>/ »
const DOSSIERS_PHOTOS = { candidatures: 'candidatures', 'cours-talons': 'cours-talons' };
const PHOTOS_MAX_TALONS = 5;
// (format unique : lirePhotoDossier, api/_r2.js)
const cheminCandidature = (id, chemin, dossier) => { const p = lirePhotoDossier(chemin); return !!p && p.dossier === dossier && p.id === id; };

// Inscription au cours de talons : elle n'est enregistrée dans la base qu'APRÈS ses photos. Des photos seulement
// pour un numéro pas encore inscrit, 5 au plus (comptées chez Cloudflare). Renvoie un message d'erreur, ou null.
// (relecture du superviseur, 22 h 30) dejaDepose = 1 à la VÉRIFICATION : le fichier vérifié est déjà déposé, donc déjà
// compté ; avant, la dernière photo permise (la 5ᵉ des talons, la 12ᵉ d'une candidature) était toujours refusée. On
// garde quand même la limite (strictement plus de fichiers que permis : refusé), sinon des adresses d'envoi demandées
// d'avance permettraient de noter plus de photos que permis.
async function talonsOuverte(id, dejaDepose = 0) {
  const [inscrites, objets] = await Promise.all([
    fetch(SUPABASE_URL + '/rest/v1/cours_talons?select=id&id=eq.' + id, { headers: enTetesService() }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    nbFichiersR2('cours-talons/' + id + '/')
  ]);
  if (!Array.isArray(inscrites) || objets === null) return 'Vérification impossible pour le moment : réessayez dans un instant.';
  if (inscrites.length) return 'Cette inscription ne reçoit plus de photos.';
  if (objets - dejaDepose >= PHOTOS_MAX_TALONS) return 'Nombre maximum de photos atteint (' + PHOTOS_MAX_TALONS + ').';
  return null;
}

// La candidature peut-elle encore recevoir des photos ? Renvoie un message d'erreur, ou null.
async function candidatureOuverte(id, dejaDepose = 0) {
  const lire = (url) => fetch(SUPABASE_URL + '/rest/v1/' + url, { headers: enTetesService() }).then((r) => (r.ok ? r.json() : null));
  // (relecture de D) on compte les fichiers DÉJÀ DÉPOSÉS sous candidatures/<id>/, vérifiés ou non : un envoi sans
  // vérification ne permet donc pas de remplir le stockage (le nettoyage du matin efface ensuite les non cités)
  const [dossiers, deposes] = await Promise.all([
    lire('casting_applications?select=id,status,created_at&id=eq.' + id),
    nbFichiersR2('candidatures/' + id + '/')
  ]);
  if (!Array.isArray(dossiers) || deposes === null) return 'Vérification impossible pour le moment : réessayez dans un instant.';
  const d = dossiers[0];
  if (!d || d.status !== 'nouvelle' || Date.now() - new Date(d.created_at).getTime() > 2 * 3600 * 1000) return 'Cette candidature ne reçoit plus de photos.';
  if (deposes - dejaDepose >= PHOTOS_MAX_CANDIDATURE) return 'Nombre maximum de photos atteint (' + PHOTOS_MAX_CANDIDATURE + ').';
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
      const liste = (Array.isArray(chemins) ? chemins : [chemin]).filter((c) => { const p = lirePhotoDossier(c);
        return !!p; });
      if (!liste.length || liste.length > 200) { res.status(400).json({ error: 'Photos invalides.' }); return; }
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      const client = creerClientR2(), bucket = process.env.R2_BUCKET_NAME;
      if (action === 'candidature_supprimer') {
        // (sécurité) on n'efface QUE des fichiers que plus aucune fiche ne cite : la fiche a d'abord été supprimée
        // dans la base par un clic de l'agence (droits de la base) ; un appel direct ne peut rien effacer d'autre.
        // (17/11/2026, L-18 c) cours de talons aussi : effacé seulement si l'inscription n'existe plus (supprimée d'abord
        // par le clic de l'administrateur principal, règle de la base supabase-l18-supprimer-talons.sql)
        const candid = liste.filter((c) => lirePhotoDossier(c).dossier === 'candidatures');
        const talons = [...new Set(liste.filter((c) => lirePhotoDossier(c).dossier === 'cours-talons').map((c) => lirePhotoDossier(c).id))];
        const lire = (url) => fetch(SUPABASE_URL + '/rest/v1/' + url, { headers: enTetesService() }).then((r) => (r.ok ? r.json() : null), () => null);
        const [lignes, inscrites] = await Promise.all([
          candid.length ? lire('casting_photos?select=chemin&chemin=in.(' + candid.map((c) => '"r2:' + c + '"').join(',') + ')') : [],
          talons.length ? lire('cours_talons?select=id&id=in.(' + talons.join(',') + ')') : []
        ]);
        if (!Array.isArray(lignes) || !Array.isArray(inscrites)) { res.status(503).json({ error: 'Vérification impossible pour le moment.' }); return; }
        if (lignes.length || inscrites.length) { res.status(409).json({ error: 'Photo encore présente dans un dossier : rien n’a été effacé.' }); return; }
        const refuses = await effacerFichiersR2(liste);
        if (refuses.length) { res.status(502).json({ error: 'Le stockage n’a pas effacé ' + refuses.length + ' photo(s) : réessayez.' }); return; }
        res.status(200).json({ ok: true }); return;
      }
      const adresses = {};
      for (const c of liste) adresses[c] = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: c }), { expiresIn: 3600 });
      res.status(200).json({ adresses }); return;
    }
    // ---- visiteur sans compte ----
    if (typeof candidature !== 'string' || !UUID.test(candidature)) { res.status(400).json({ error: 'Candidature inconnue.' }); return; }
    // (relecture du superviseur, 22 h 30) numéro en minuscules DÈS L'ENTRÉE : un numéro « en majuscules » ouvrait un
    // second dossier, invisible du plafond et du nettoyage du matin (format unique : api/_r2.js)
    const id = candidature.toLowerCase();
    const nomDossier = debut.corps.dossier || 'candidatures';
    const dossier = typeof nomDossier === 'string' && Object.prototype.hasOwnProperty.call(DOSSIERS_PHOTOS, nomDossier) ? DOSSIERS_PHOTOS[nomDossier] : null;
    if (!dossier) { res.status(400).json({ error: 'Dossier inconnu.' }); return; }
    if (action !== 'candidature_signer' && action !== 'candidature_verifier') { res.status(400).json({ error: 'Action inconnue.' }); return; }
    if (await limiteDebit(res, 'r2-candidature', extraireIp(req) || 'inconnue', 60)) return;
    const dejaDepose = action === 'candidature_signer' ? 0 : 1;  // (vérification : le fichier est déjà déposé et compté)
    const fermee = dossier === 'cours-talons' ? await talonsOuverte(id, dejaDepose) : await candidatureOuverte(id, dejaDepose);
    if (fermee) { res.status(fermee.startsWith('Vérification') ? 503 : 403).json({ error: fermee }); return; }
    if (action === 'candidature_signer') {
      const extension = TYPES_CANDIDATURE[contentType];
      if (!extension) { res.status(400).json({ error: 'Format de photo non accepté (JPEG, PNG ou WebP).' }); return; }
      if (!Number.isInteger(taille) || taille <= 0 || taille > TAILLE_MAX) { res.status(400).json({ error: 'Photo trop lourde ou taille inconnue.' }); return; }
      const cle = nouvellePhotoDossier(dossier, id, extension);
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      const uploadUrl = await getSignedUrl(creerClientR2(), new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: cle, ContentType: contentType, ContentLength: taille }), { expiresIn: 300 });
      res.status(200).json({ uploadUrl, chemin: cle }); return;
    }
    if (action === 'candidature_verifier') {
      if (!cheminCandidature(id, chemin, dossier)) { res.status(400).json({ error: 'Photo invalide.' }); return; }
      const type = Object.keys(TYPES_CANDIDATURE).find((t) => chemin.endsWith('.' + TYPES_CANDIDATURE[t]));
      const etat = await contenuR2(chemin, type);
      if (etat === 'faux') { res.status(422).json({ error: messageFichierFaux(type), refuse: true }); return; }
      if (etat === 'absent') { res.status(404).json({ error: 'Photo introuvable : renvoyez-la.' }); return; }  // (relecture de D : rien de noté)
      // cours de talons : la page met la photo dans l'inscription (« r2:cours-talons/… », contrôlé par la base)
      if (dossier === 'cours-talons') { res.status(200).json({ ok: true, verifie: etat === 'ok' }); return; }
      // même photo vérifiée deux fois (reprise après une coupure) : déjà notée, rien à refaire
      const deja = await fetch(SUPABASE_URL + '/rest/v1/casting_photos?select=id&application_id=eq.' + id + '&chemin=eq.' + encodeURIComponent('r2:' + chemin), { headers: enTetesService() });
      const lignesDeja = deja.ok ? await deja.json() : null;
      if (!Array.isArray(lignesDeja)) { res.status(503).json({ error: 'Vérification impossible pour le moment : réessayez dans un instant.' }); return; }
      if (!lignesDeja.length) {
        const note = await fetch(SUPABASE_URL + '/rest/v1/casting_photos', {
          method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          // (relecture du superviseur, 22 h 30) « url » est obligatoire dans casting_photos (text not null) : sans elle,
          // CHAQUE photo était refusée. On y met le nom de rangement « r2:… » (unique par dossier) ; l'Administration
          // reconnaît ces photos par leur CHEMIN.
          body: JSON.stringify({ application_id: id, url: 'r2:' + chemin, chemin: 'r2:' + chemin })
        });
        const erreur = note.ok ? null : await note.json().catch(() => ({}));
        if (erreur && erreur.code !== '23505') { res.status(500).json({ error: 'Photo envoyée mais non enregistrée : la copie de sauvegarde suit.' }); return; }
      }
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
