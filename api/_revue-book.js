// Fonction serveur — revue stricte du book complet d'un mannequin par l'IA
// (demande de la propriétaire, 06/10/2026 : « se mettre dans la peau d'un
// recruteur professionnel »). Contrairement à api/trier-photo.js, qui juge une
// photo seule au moment de l'envoi, l'IA voit ici TOUTES les photos du mannequin
// ensemble : elle peut donc repérer les séries de photos trop semblables.
//
// Cette fonction NE SUPPRIME RIEN. Elle classe les photos gardées (« book » ou
// « digital ») et marque les autres « à vérifier » avec la raison
// (« Proposée à la suppression : … »). C'est l'agence qui valide la suppression,
// mannequin par mannequin, depuis le tableau de bord (js/tri-photos-admin.js).
//
// Fichier préfixé « _ » : ce n'est pas une fonction Vercel à part (l'offre gratuite
// en limite le nombre) ; il est appelé par api/trier-photo.js quand la demande
// contient action: 'revue'.
//
// Appel (admin uniquement) : POST /api/trier-photo { action: 'revue', modelId, images: [{ id, data }] } où data est
// une petite version JPEG (640 px) en base64 préparée par le tableau de bord —
// c'est ce qui rend la revue peu coûteuse (~0,10 $ par mannequin).

const Anthropic = require('@anthropic-ai/sdk');

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
const MAX_IMAGES = 90;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONSIGNES = [
  "Tu es directrice du booking d'une agence de mannequins internationale (MA2M, Abidjan). Tu prépares le book en ligne d'un mannequin avant de le présenter à des recruteurs professionnels (Paris, Milan, Londres, New York, Asie). Sois STRICTE, comme les grandes agences : un book court et fort vaut mieux qu'un book long et inégal.",
  "",
  "Tu reçois toutes les photos du mannequin, numérotées. Pour CHAQUE photo, décide :",
  "- book : photo professionnelle ou artistique forte (séance photo, éditorial, campagne, défilé, portrait travaillé), nette, où le mannequin est seul sujet ou clairement le sujet principal. Une photo artistique assumée (visage partiellement caché par choix créatif, noir et blanc, contre-jour maîtrisé) peut être gardée si elle est de qualité.",
  "- digital : photo naturelle et simple qui montre le mannequin tel qu'il est (visage et/ou silhouette bien visibles, net, peu ou pas de maquillage, tenue simple, fond simple), utile aux recruteurs. Garde au maximum 6 digitals, les meilleurs.",
  "- supprimer : tout le reste (l\'agence validera), en particulier :",
  "  * photo floue, bougée, pixelisée, de faible résolution, agrandie, trop sombre ou mal exposée ;",
  "  * photo où le mannequin n'est pas seul ou n'est pas le sujet principal (groupe, duo à égalité, coulisses avec d'autres personnes, visage caché par un casque…) ;",
  "  * photo trop semblable à une autre : dans chaque série (même tenue, même lieu, même séance), garde seulement 1 à 3 photos, les plus fortes et les plus variées ; supprime les autres ;",
  "  * photo amateur sans intérêt pour un recruteur, filtre d'application, capture d'écran, texte ou logo envahissant, recadrage raté ;",
  "  * photo choquante ou dénudée de façon inappropriée.",
  "",
  "Règles :",
  "- Vise un book final d'environ 12 à 20 photos (book + digitals), selon la qualité disponible. Garde toujours au moins 8 photos au total : si le book est faible, garde les 8 moins mauvaises.",
  "- Ne juge jamais le physique, la couleur de peau, la morphologie, l'âge ou la beauté de la personne : seulement les photos.",
  "- raison : une phrase courte en français, simple, destinée à l'agence.",
  "- conseils : 2 à 4 phrases courtes en français pour l'agence : ce qui manque à ce book (par exemple des digitals de face et en pied, une meilleure photo de profil) et ce qu'il faut demander au mannequin."
].join('\n');

const SCHEMA = {
  type: 'object',
  properties: {
    photos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          numero: { type: 'integer' },
          decision: { type: 'string', enum: ['book', 'digital', 'supprimer'] },
          raison: { type: 'string' }
        },
        required: ['numero', 'decision', 'raison'],
        additionalProperties: false
      }
    },
    conseils: { type: 'string' }
  },
  required: ['photos', 'conseils'],
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

function aUnRole(p) {
  return !!(p.principale || p.photo_couverture || p.photo_cv || p.photo_pleinpied || p.compcard_ordre != null);
}

async function majPhoto(id, champs) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/model_photos?id=eq.' + id, {
    method: 'PATCH',
    headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, enTetesService()),
    body: JSON.stringify(champs)
  });
  return r.ok;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Méthode non autorisée.' }); return; }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { res.status(500).json({ error: 'Configuration serveur incomplète.' }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(503).json({ error: 'Tri automatique non configuré.' }); return; }

  const enTeteAuth = req.headers.authorization || '';
  const jeton = enTeteAuth.startsWith('Bearer ') ? enTeteAuth.slice(7) : '';
  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch (e) { corps = {}; } }
  const modelId = corps && corps.modelId;
  const images = corps && Array.isArray(corps.images) ? corps.images : null;
  if (typeof modelId !== 'string' || !UUID.test(modelId) || !images) {
    res.status(400).json({ error: 'Demande invalide.' }); return;
  }

  try {
    const utilisateur = await verifierUtilisateur(jeton);
    if (!utilisateur) { res.status(401).json({ error: 'Session invalide ou expirée — reconnectez-vous.' }); return; }
    if (!(await estAdmin(utilisateur.id))) { res.status(403).json({ error: 'Réservé aux administrateurs.' }); return; }

    const lecture = await fetch(
      SUPABASE_URL + '/rest/v1/model_photos?model_id=eq.' + modelId +
      '&select=id,model_id,chemin,chemin_miniature,chemin_moyenne,principale,photo_couverture,photo_cv,photo_pleinpied,compcard_ordre,tri_statut,tri_manuel',
      { headers: enTetesService() }
    );
    if (!lecture.ok) throw new Error('Lecture des photos impossible (' + lecture.status + ').');
    const photos = await lecture.json();
    const parId = {};
    photos.forEach(function (p) { parId[p.id] = p; });

    // 2) Images envoyées par le tableau de bord : uniquement des photos de ce mannequin.
    const aRevoir = images
      .filter(function (im) { return im && typeof im.id === 'string' && parId[im.id] && typeof im.data === 'string' && im.data.length < 1500000; })
      .slice(0, MAX_IMAGES);
    if (!aRevoir.length) { res.status(200).json({ ok: true, gardees: 0, proposees: 0, conseils: '' }); return; }

    const contenu = [];
    aRevoir.forEach(function (im, i) {
      contenu.push({ type: 'text', text: 'Photo ' + (i + 1) + ' :' });
      contenu.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: im.data } });
    });
    contenu.push({ type: 'text', text: 'Voici les ' + aRevoir.length + ' photos du book. Donne ta décision pour chacune (numéros 1 à ' + aRevoir.length + ').' });

    const client = new Anthropic.Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const flux = client.beta.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: CONSIGNES,
      messages: [{ role: 'user', content: contenu }]
    });
    const reponse = await flux.finalMessage();
    if (reponse.stop_reason === 'refusal') { res.status(200).json({ ok: false, erreur: "L'IA n'a pas pu analyser ce book." }); return; }
    const bloc = (reponse.content || []).find(function (b) { return b.type === 'text'; });
    const avis = JSON.parse(bloc ? bloc.text : '{}');
    const decisions = {};
    (avis.photos || []).forEach(function (d) {
      const im = aRevoir[d.numero - 1];
      if (im && ['book', 'digital', 'supprimer'].indexOf(d.decision) !== -1) decisions[im.id] = d;
    });

    // 3) Enregistrement : photos gardées classées, autres proposées à la suppression.
    const date = new Date().toISOString();
    let gardees = 0, proposees = 0;
    for (const im of aRevoir) {
      const d = decisions[im.id], p = parId[im.id];
      if (!d || p.tri_manuel) continue; // remise à la main par l'agence : on n'y touche pas
      if (d.decision === 'supprimer') {
        const prefixe = aUnRole(p) ? 'À remplacer (photo de profil, couverture ou compcard) : ' : 'Proposée à la suppression : ';
        if (await majPhoto(p.id, { tri_statut: 'a_verifier', tri_raison: (prefixe + String(d.raison)).slice(0, 300), tri_date: date })) proposees++;
      } else if (await majPhoto(p.id, { tri_statut: d.decision, tri_raison: String(d.raison).slice(0, 300), tri_date: date })) gardees++;
    }
    res.status(200).json({ ok: true, gardees: gardees, proposees: proposees, conseils: String(avis.conseils || '').slice(0, 1200) });
  } catch (e) {
    console.error('revue-book :', e);
    if (e && /credit balance/i.test(e.message || '')) { res.status(402).json({ error: 'Crédit de l’IA épuisé.' }); return; }
    res.status(500).json({ error: 'La revue du book a échoué.' });
  }
};

