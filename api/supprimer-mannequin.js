// Fonction serverless Vercel — la SEULE action de ce site qui a besoin de la
// clé secrète Supabase (jamais exposée côté navigateur) : supprimer le
// compte de connexion d'un mannequin, pas seulement sa fiche.
//
// Supprimer uniquement la ligne model_profiles (sb.from('model_profiles').delete(),
// possible avec la clé publique) ne suffit pas : le mannequin garde son
// compte et peut se reconnecter — Store.ensureProfileRow() dans
// espace-mannequin.html recrée alors une fiche vide automatiquement. Pour
// une suppression définitive, il faut supprimer le compte auth.users
// lui-même, ce qui n'est possible qu'avec la clé secrète (API Admin Auth).
//
// Variable d'environnement requise sur Vercel : SUPABASE_SERVICE_ROLE_KEY
// (Project Settings > API sur Supabase — clé secrète / service_role,
// jamais la clé publique déjà utilisée dans js/supabase-config.js).

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const cleSecrete = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cleSecrete) {
    res.status(500).json({ error: "Configuration serveur incomplète (SUPABASE_SERVICE_ROLE_KEY absente sur Vercel)." });
    return;
  }

  const enTeteAuth = req.headers.authorization || '';
  const jeton = enTeteAuth.startsWith('Bearer ') ? enTeteAuth.slice(7) : '';
  if (!jeton) {
    res.status(401).json({ error: 'Non authentifié.' });
    return;
  }

  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch (e) { corps = {}; } }
  const modelId = corps && corps.modelId;
  if (!modelId || typeof modelId !== 'string') {
    res.status(400).json({ error: 'Identifiant de mannequin manquant.' });
    return;
  }

  try {
    // 1. Le jeton fourni correspond-il bien à un compte connecté ?
    const reponseUtilisateur = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: cleSecrete, Authorization: 'Bearer ' + jeton }
    });
    if (!reponseUtilisateur.ok) {
      res.status(401).json({ error: 'Session invalide ou expirée — reconnectez-vous.' });
      return;
    }
    const utilisateur = await reponseUtilisateur.json();

    // 2. Ce compte figure-t-il dans la table admins ? (même contrôle que
    // celui déjà appliqué par le déclencheur gerer_validation_publication()
    // côté base de données.)
    const reponseAdmin = await fetch(
      SUPABASE_URL + '/rest/v1/admins?user_id=eq.' + encodeURIComponent(utilisateur.id) + '&select=user_id',
      { headers: { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete } }
    );
    const lignesAdmin = reponseAdmin.ok ? await reponseAdmin.json() : [];
    if (!Array.isArray(lignesAdmin) || !lignesAdmin.length) {
      res.status(403).json({ error: "Ce compte n'est pas administrateur." });
      return;
    }

    // 3. Chemins de stockage à nettoyer, récupérés AVANT suppression : la
    // suppression en cascade côté base (auth.users -> model_profiles ->
    // model_photos, déjà "on delete cascade") ne touche pas aux fichiers du
    // Storage, qui doivent être retirés séparément.
    const reponsePhotos = await fetch(
      SUPABASE_URL + '/rest/v1/model_photos?model_id=eq.' + encodeURIComponent(modelId) + '&select=chemin,chemin_miniature,chemin_moyenne',
      { headers: { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete } }
    );
    const photos = reponsePhotos.ok ? await reponsePhotos.json() : [];
    const chemins = [];
    (photos || []).forEach(function (p) {
      ['chemin', 'chemin_miniature', 'chemin_moyenne'].forEach(function (c) { if (p[c]) chemins.push(p[c]); });
    });

    // 4. Suppression du compte de connexion — cascade automatique en base
    // vers model_profiles, model_photos, model_projects, page_views.
    const reponseSuppression = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + encodeURIComponent(modelId), {
      method: 'DELETE',
      headers: { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete }
    });
    if (!reponseSuppression.ok) {
      const detail = await reponseSuppression.text().catch(function () { return ''; });
      res.status(502).json({ error: 'Échec de la suppression du compte : ' + detail });
      return;
    }

    // 5. Nettoyage des fichiers Storage (best-effort : la base est déjà
    // propre à ce stade, un échec ici ne doit pas être présenté comme un
    // échec de la suppression elle-même).
    if (chemins.length) {
      await fetch(SUPABASE_URL + '/storage/v1/object/model-photos', {
        method: 'DELETE',
        headers: { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: chemins })
      }).catch(function () {});
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : 'Erreur inattendue.' });
  }
};
