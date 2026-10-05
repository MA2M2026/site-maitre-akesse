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
  "Tu es directrice du booking d'une agence de mannequins internationale (MA2M, Abidjan). Tu prépares le book en ligne d'un mannequin avant de le présenter à des recruteurs professionnels (Paris, Milan, Londres, New York, Asie). Sois exigeante sur la QUALITÉ (photos floues ou amateurs), mais respecte le travail professionnel : les photos de shooting et de défilé sont la richesse du book.",
  "",
  "Tu reçois toutes les photos du mannequin, chacune avec son numéro (« Photo n° X ») ; le mannequin voit ces mêmes numéros sur ses photos. Utilise toujours ces numéros quand tu parles d'une photo. Pour CHAQUE photo, décide :",
  "- book : le travail professionnel du mannequin : shootings, défilés, campagnes publicitaires et éditoriaux avec des marques, photos d'action, portraits travaillés, photos artistiques assumées. Une photo de campagne ou d'éditorial où le visage n'est pas visible (de dos, de profil, partiellement caché) reste dans le book : le mannequin y a participé.",
  "- digital (rubrique « Digitals & Lifestyle » sur le site) : les autres photos BIEN PRISES : polaroïds et digitals naturels (visage et silhouette bien visibles, peu de maquillage, tenue simple), mais aussi photos de vie soignées comme sur Instagram : événement, soirée, cocktail, dîner, casting, activité. Elles doivent rester nettes, bien cadrées et valoriser le mannequin : cette rubrique ne doit pas devenir un fourre-tout.",
  "- supprimer : SEULEMENT les photos vraiment mauvaises (l'agence validera) :",
  "  * photo nettement floue, bougée ou pixelisée (attention : les images que tu reçois sont réduites ; ne parle de flou que s'il est évident même à cette taille) ;",
  "  * photo prise à la légère, sans soin, qui ne valorise pas le mannequin (selfie mal cadré, photo de soirée ou de dîner ratée, arrière-plan en désordre, très mauvaise lumière, posture négligée) — une photo de soirée ou d'événement BIEN PRISE va dans digital, pas à la suppression ;",
  "  * photo où l'on ne peut pas savoir qui est le mannequin (groupe, plusieurs personnes au même plan) ;",
  "  * filtre d'application qui déforme le visage, capture d'écran, mème ;",
  "  * photo choquante ou dénudée de façon inappropriée.",
  "",
  "À NE JAMAIS proposer à la suppression (décision de l'agence) :",
  "- les photos de DÉFILÉ bien cadrées, de près comme de loin, même avec le logo de l'événement ou des partenaires, même avec d'autres mannequins à l'arrière-plan, même avec des lunettes de soleil (souvent imposées par le créateur) ;",
  "- les photos de CAMPAGNE publicitaire ou d'ÉDITORIAL avec une marque, même si le visage n'est pas visible ;",
  "- les photos d'un SHOOTING PROFESSIONNEL, même si plusieurs photos ont la même tenue et le même décor : un shooting se fait sous plusieurs angles, c'est normal ; ne supprime pas une photo parce qu'elle « ressemble » à une autre de la même séance ;",
  "- les lunettes, accessoires, logos ou signatures de photographe ne sont jamais à eux seuls une raison de suppression ;",
  "- une photo nette et soignée ne doit jamais être supprimée parce qu'elle paraît floue une fois agrandie en couverture du site : juge la photo elle-même ;",
  "- en cas de doute, GARDE la photo (book ou digital).",
  "",
  "Règles :",
  "- Ne juge jamais le physique, la couleur de peau, la morphologie, l'âge ou la beauté de la personne : seulement les photos.",
  "- raison : une phrase courte en français, simple, destinée à l'agence.",
  "- conseils : 2 à 4 phrases courtes en français pour l'agence : ce qui manque à ce book (par exemple des digitals de face et en pied, une meilleure photo de profil) et ce qu'il faut demander au mannequin.",
  "",
  "Rapport détaillé (en français simple, sans jargon) :",
  "- points_forts : 2 à 4 points forts du book.",
  "- a_ameliorer : 2 à 5 points concrets à améliorer (par exemple pas de digitals, pas de gros plan du visage) — sans critiquer les photos de défilé ou de shooting professionnel.",
  "- fiche_technique : la liste des photos que le mannequin doit faire ou refaire pour compléter son book (3 à 8 photos). Pour chacune : titre (ex. « Digital de face, en pied »), cadrage, pose, tenue, lieu_lumiere. Consignes concrètes et faciles à suivre avec un téléphone.",
  "- regles : 4 à 7 règles générales pour ces photos (ex. pas de lunettes, pas de filtre, téléphone à hauteur de poitrine, photo nette).",
  "- message_mannequin : le message que l'agence enverra au mannequin par WhatsApp, au nom de « L'équipe MA2M ». Vouvoiement, ton chaleureux et professionnel, encourageant. Commence par « Bonjour » suivi du prénom. Explique en 2 ou 3 phrases ce que l'agence a revu, puis donne les numéros des photos qui vont être retirées avec la raison en quelques mots (ex. « n° 12 : photo floue ; n° 15 : photo prise trop à la légère »), puis donne la fiche technique sous forme de liste courte et numérotée, puis les règles. Termine en demandant d'envoyer les nouvelles photos depuis l'Espace mannequin du site. Pas de mot « IA ». 1 800 caractères au maximum. Accorde au féminin ou au masculin selon le mannequin indiqué."
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
    conseils: { type: 'string' },
    points_forts: { type: 'array', items: { type: 'string' } },
    a_ameliorer: { type: 'array', items: { type: 'string' } },
    fiche_technique: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titre: { type: 'string' }, cadrage: { type: 'string' }, pose: { type: 'string' },
          tenue: { type: 'string' }, lieu_lumiere: { type: 'string' }
        },
        required: ['titre', 'cadrage', 'pose', 'tenue', 'lieu_lumiere'],
        additionalProperties: false
      }
    },
    regles: { type: 'array', items: { type: 'string' } },
    message_mannequin: { type: 'string' }
  },
  required: ['photos', 'conseils', 'points_forts', 'a_ameliorer', 'fiche_technique', 'regles', 'message_mannequin'],
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
      '&select=id,model_id,numero,chemin,chemin_miniature,chemin_moyenne,principale,photo_couverture,photo_cv,photo_pleinpied,compcard_ordre,tri_statut,tri_manuel',
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

    const prof = await fetch(SUPABASE_URL + '/rest/v1/model_profiles?id=eq.' + modelId + '&select=full_name,category', { headers: enTetesService() });
    const profil = (prof.ok ? (await prof.json())[0] : null) || {};
    const genre = profil.category === 'homme' ? 'un homme' : profil.category === 'femme' ? 'une femme' : 'non précisé';
    const contenu = [{ type: 'text', text: 'Mannequin : ' + String(profil.full_name || 'Mannequin').slice(0, 80) + ' (' + genre + ').' }];
    // Chaque photo porte son numéro fixe (celui que le mannequin voit dans son Espace).
    const numeros = aRevoir.map(function (im, i) { return parId[im.id].numero || (i + 1); });
    aRevoir.forEach(function (im, i) {
      contenu.push({ type: 'text', text: 'Photo n° ' + numeros[i] + ' :' });
      contenu.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: im.data } });
    });
    contenu.push({ type: 'text', text: 'Voici les ' + aRevoir.length + ' photos du book. Donne ta décision pour chacune, avec son numéro.' });

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
      const im = aRevoir[numeros.indexOf(d.numero)];
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
    // 4) Rapport détaillé + message WhatsApp, gardés pour l'agence (Extension 117).
    const liste = function (t, n) { return (Array.isArray(t) ? t : []).slice(0, n).map(function (x) { return String(x).slice(0, 300); }); };
    const rapport = {
      gardees: gardees, proposees: proposees,
      conseils: String(avis.conseils || '').slice(0, 1200),
      points_forts: liste(avis.points_forts, 6),
      a_ameliorer: liste(avis.a_ameliorer, 8),
      fiche_technique: (Array.isArray(avis.fiche_technique) ? avis.fiche_technique : []).slice(0, 10).map(function (f) {
        return { titre: String(f.titre || '').slice(0, 120), cadrage: String(f.cadrage || '').slice(0, 300), pose: String(f.pose || '').slice(0, 300), tenue: String(f.tenue || '').slice(0, 300), lieu_lumiere: String(f.lieu_lumiere || '').slice(0, 300) };
      }),
      regles: liste(avis.regles, 10),
      message_mannequin: String(avis.message_mannequin || '').slice(0, 3000)
    };
    await fetch(SUPABASE_URL + '/rest/v1/revues_book?on_conflict=model_id', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, enTetesService()),
      body: JSON.stringify({ model_id: modelId, rapport: rapport, revu_le: date, envoye_le: null })
    }).catch(function () {});
    res.status(200).json(Object.assign({ ok: true }, rapport));
  } catch (e) {
    console.error('revue-book :', e);
    if (e && /credit balance/i.test(e.message || '')) { res.status(402).json({ error: 'Crédit de l’IA épuisé.' }); return; }
    res.status(500).json({ error: 'La revue du book a échoué.' });
  }
};

