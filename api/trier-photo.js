// Fonction serveur — tri automatique des photos par IA (demande de la
// propriétaire, 06/10/2026). Appelée en arrière-plan juste après l'envoi d'une
// photo (Espace mannequin ou tableau de bord) : l'IA regarde la photo et la
// range en « book » (photo professionnelle), « digital » (photo naturelle au
// téléphone, valable pour les recruteurs) ou « ecartee » (inutilisable).
// Une photo écartée n'est jamais supprimée : elle est cachée par la base
// (Extension 116) et reste visible dans le tableau de bord, où un admin peut
// la remettre. Quand l'IA hésite, la photo reste visible (« a_verifier »).
//
// Appel : POST { photoId } avec le jeton de connexion de la mannequin
// propriétaire de la photo ou d'un admin. Une photo déjà triée (ou remise à la
// main par un admin) n'est jamais retriée — pas de double facturation.
//
// Variables d'environnement sur Vercel : ANTHROPIC_API_KEY (clé de l'IA,
// enregistrée en « Sensitive »), SUPABASE_SERVICE_ROLE_KEY et les variables R2
// déjà en place pour api/r2-presigner.js.

const Anthropic = require('@anthropic-ai/sdk');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
// En dessous de ce degré de certitude, une photo jugée inutilisable n'est pas
// cachée : elle reste visible et part dans « À vérifier » du tableau de bord.
const CONFIANCE_MIN_ECARTEE = 0.8;
const TAILLE_MAX_IMAGE = 4.5 * 1024 * 1024; // limite de l'IA : 5 Mo par image

const CONSIGNES = [
  "Tu es directrice du booking d'une agence de mannequins professionnelle (MA2M, Abidjan), qui présente ses mannequins à des recruteurs internationaux (Paris, Milan, Londres, New York, Asie).",
  "Une mannequin vient d'ajouter cette photo à son book en ligne. Range-la dans UNE catégorie :",
  "",
  "- book : photo de qualité professionnelle ou quasi professionnelle — séance avec un photographe, éditorial, campagne, défilé, portrait soigné (lumière, cadrage, stylisme). La mannequin y est le sujet principal.",
  "- digital : photo naturelle, prise au téléphone ou sans mise en scène, que les recruteurs utilisent pour voir la mannequin telle qu'elle est (« digitals » / polaroïds) : visage ou silhouette bien visibles, net, éclairage correct, peu ou pas de maquillage, tenue simple, fond simple. Un selfie net et bien éclairé où le visage est clairement visible compte aussi. Les photos naturelles au téléphone sont VALABLES : ne les écarte pas parce qu'elles sont simples.",
  "- ecartee : photo inutilisable pour une agence, par exemple : aucune personne (objet, paysage, document, capture d'écran, mème, image de texte) ; photo de groupe où l'on ne peut pas savoir qui est la mannequin ; photo très floue, très pixelisée ou très sombre ; visage déformé par un filtre d'application (oreilles d'animal, lissage extrême, autocollants) ; mannequin presque invisible (trop loin, coupée, cachée) ; nudité ou contenu sexuel ; contenu choquant.",
  "",
  "Règles :",
  "- En cas de doute entre book et digital, choisis celle qui correspond le mieux ; les deux restent visibles.",
  "- N'écarte une photo que si elle est clairement inutilisable. Si tu hésites, baisse ta confiance : une personne de l'agence vérifiera.",
  "- Ne juge jamais le physique, la couleur de peau, la morphologie, l'âge ou la beauté de la personne : seulement la photo elle-même.",
  "- raison : une phrase courte en français, simple et polie, destinée à l'agence (par exemple « Photo floue, visage peu visible »).",
  "- confiance : nombre entre 0 et 1 (ta certitude sur la catégorie choisie)."
].join('\n');

const SCHEMA = {
  type: 'object',
  properties: {
    categorie: { type: 'string', enum: ['book', 'digital', 'ecartee'] },
    raison: { type: 'string' },
    confiance: { type: 'number' }
  },
  required: ['categorie', 'raison', 'confiance'],
  additionalProperties: false
};

function enTetesService() {
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { apikey: cle, Authorization: 'Bearer ' + cle };
}

async function verifierUtilisateur(jeton) {
  if (!jeton) return null;
  const reponse = await fetch(SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + jeton }
  });
  if (!reponse.ok) return null;
  return reponse.json();
}

async function estAdmin(userId) {
  const reponse = await fetch(
    SUPABASE_URL + '/rest/v1/admins?user_id=eq.' + encodeURIComponent(userId) + '&select=user_id',
    { headers: enTetesService() }
  );
  if (!reponse.ok) return false;
  const lignes = await reponse.json();
  return Array.isArray(lignes) && lignes.length > 0;
}

function typeImage(octets) {
  if (octets.length < 12) return null;
  if (octets[0] === 0xff && octets[1] === 0xd8) return 'image/jpeg';
  if (octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47) return 'image/png';
  if (octets.toString('ascii', 0, 4) === 'RIFF' && octets.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (octets.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  return null;
}

// Récupère la photo : d'abord directement dans R2 (version moyenne 1400 px,
// puis miniature, puis originale), sinon par son adresse publique — seulement
// sur les adresses de stockage du site (jamais une adresse quelconque).
async function lireImage(photo) {
  const dossier = photo.model_id + '/';
  const chemins = [photo.chemin_moyenne, photo.chemin_miniature, photo.chemin]
    .filter(function (c) { return typeof c === 'string' && c.startsWith(dossier) && !/(^|\/)\.\.(\/|$)/.test(c); });
  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME) {
    const client = new S3Client({
      region: 'auto',
      endpoint: 'https://' + process.env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY }
    });
    for (const chemin of chemins) {
      try {
        const objet = await client.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: chemin }));
        if (objet.ContentLength && objet.ContentLength > TAILLE_MAX_IMAGE) continue;
        const octets = Buffer.from(await objet.Body.transformToByteArray());
        if (octets.length <= TAILLE_MAX_IMAGE && typeImage(octets)) return octets;
      } catch (e) { /* fichier absent de R2 : essai suivant */ }
    }
  }
  const prefixes = [SUPABASE_URL + '/storage/v1/object/public/'];
  if (process.env.R2_PUBLIC_URL) prefixes.push(process.env.R2_PUBLIC_URL.replace(/\/$/, '') + '/');
  const adresses = [photo.url_moyenne, photo.url_miniature, photo.url]
    .filter(function (u) { return typeof u === 'string' && prefixes.some(function (p) { return u.startsWith(p); }); });
  for (const adresse of adresses) {
    try {
      const reponse = await fetch(adresse);
      if (!reponse.ok) continue;
      const octets = Buffer.from(await reponse.arrayBuffer());
      if (octets.length <= TAILLE_MAX_IMAGE && typeImage(octets)) return octets;
    } catch (e) { /* essai suivant */ }
  }
  return null;
}

async function demanderAvisIA(octets) {
  const client = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const reponse = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    // En cas de refus par erreur des filtres de sécurité de l'IA, la demande est
    // automatiquement reprise par le modèle de secours recommandé par Anthropic.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: CONSIGNES,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: typeImage(octets), data: octets.toString('base64') } },
        { type: 'text', text: 'Range cette photo.' }
      ]
    }]
  });
  if (reponse.stop_reason === 'refusal') return null;
  const bloc = (reponse.content || []).find(function (b) { return b.type === 'text'; });
  if (!bloc) return null;
  try {
    const avis = JSON.parse(bloc.text);
    if (['book', 'digital', 'ecartee'].indexOf(avis.categorie) === -1) return null;
    return avis;
  } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Configuration serveur incomplète.' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'Tri automatique non configuré.' });
    return;
  }

  const enTeteAuth = req.headers.authorization || '';
  const jeton = enTeteAuth.startsWith('Bearer ') ? enTeteAuth.slice(7) : '';
  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch (e) { corps = {}; } }
  const photoId = corps && corps.photoId;
  if (typeof photoId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(photoId)) {
    res.status(400).json({ error: 'Photo invalide.' });
    return;
  }

  try {
    const utilisateur = await verifierUtilisateur(jeton);
    if (!utilisateur) {
      res.status(401).json({ error: 'Session invalide ou expirée — reconnectez-vous.' });
      return;
    }
    const lecture = await fetch(
      SUPABASE_URL + '/rest/v1/model_photos?id=eq.' + photoId +
      '&select=id,model_id,url,chemin,url_moyenne,chemin_moyenne,url_miniature,chemin_miniature,tri_statut,tri_manuel',
      { headers: enTetesService() }
    );
    if (!lecture.ok) throw new Error('Lecture de la photo impossible (' + lecture.status + ').');
    const photo = (await lecture.json())[0];
    if (!photo) {
      res.status(404).json({ error: 'Photo introuvable.' });
      return;
    }
    const admin = await estAdmin(utilisateur.id);
    if (photo.model_id !== utilisateur.id && !admin) {
      res.status(403).json({ error: 'Cette photo ne vous appartient pas.' });
      return;
    }
    if (photo.tri_statut || photo.tri_manuel) {
      res.status(200).json(admin ? { ok: true, deja: true, statut: photo.tri_statut } : { ok: true });
      return;
    }

    const octets = await lireImage(photo);
    let statut, raison, confiance = null;
    if (!octets) {
      statut = 'a_verifier'; raison = "Photo illisible pour le tri automatique (fichier introuvable ou format non reconnu).";
    } else {
      const avis = await demanderAvisIA(octets);
      if (!avis) {
        statut = 'a_verifier'; raison = "Le tri automatique n'a pas pu analyser cette photo.";
      } else {
        confiance = Math.max(0, Math.min(1, Number(avis.confiance) || 0));
        raison = String(avis.raison || '').slice(0, 300);
        statut = avis.categorie === 'ecartee' && confiance < CONFIANCE_MIN_ECARTEE ? 'a_verifier' : avis.categorie;
      }
    }

    // Mise à jour seulement si personne n'a trié la photo entre-temps (admin).
    const maj = await fetch(
      SUPABASE_URL + '/rest/v1/model_photos?id=eq.' + photoId + '&tri_statut=is.null&tri_manuel=is.false',
      {
        method: 'PATCH',
        headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, enTetesService()),
        body: JSON.stringify({ tri_statut: statut, tri_raison: raison, tri_confiance: confiance, tri_date: new Date().toISOString() })
      }
    );
    if (!maj.ok) throw new Error('Enregistrement du tri impossible (' + maj.status + ').');
    // La mannequin n'est pas informée du résultat (choix de la propriétaire).
    res.status(200).json(admin ? { ok: true, statut: statut, raison: raison, confiance: confiance } : { ok: true });
  } catch (e) {
    console.error('trier-photo :', e);
    // Crédit de l'IA épuisé : le tableau de bord s'arrête et le dit clairement.
    if (e && /credit balance/i.test(e.message || '')) {
      res.status(402).json({ error: 'Crédit de l’IA épuisé.' });
      return;
    }
    res.status(500).json({ error: 'Le tri automatique a échoué.' });
  }
};

module.exports.config = { maxDuration: 60 };
