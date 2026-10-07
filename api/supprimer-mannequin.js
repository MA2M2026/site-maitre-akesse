// Fonction serverless Vercel — supprime le compte de connexion d'un
// mannequin, pas seulement sa fiche.
//
// Supprimer uniquement la ligne model_profiles (sb.from('model_profiles').delete(),
// possible avec la clé publique) ne suffit pas : le mannequin garde son
// compte et peut se reconnecter — Store.ensureProfileRow() dans
// espace-mannequin.html recrée alors une fiche vide automatiquement. Pour
// une suppression définitive, il faut supprimer le compte auth.users
// lui-même, ce qui n'est possible qu'avec la clé secrète Supabase (API
// Admin Auth). Les photos, elles, vivent maintenant sur Cloudflare R2 (plus
// sur Supabase Storage) — leur suppression utilise donc les clés R2, via le
// même client S3 que api/r2-presigner.js.
//
// Variables d'environnement requises sur Vercel : SUPABASE_SERVICE_ROLE_KEY
// (Project Settings > API sur Supabase — clé secrète / service_role,
// jamais la clé publique déjà utilisée dans js/supabase-config.js) et
// R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME.

const { DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const { SUPABASE_URL, enTetesService, jetonDe, corpsDe, verifierUtilisateur, lignesAdmin, estAdmin, creerClientR2 } = require('./_commun.js');

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

  const jeton = jetonDe(req);
  if (!jeton) {
    res.status(401).json({ error: 'Non authentifié.' });
    return;
  }

  const corps = corpsDe(req);
  const modelId = corps && corps.modelId;
  if (!modelId || typeof modelId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(modelId)) {
    res.status(400).json({ error: 'Identifiant de mannequin manquant ou invalide.' });
    return;
  }

  try {
    // 1. Le jeton fourni correspond-il bien à un compte connecté ?
    const utilisateur = await verifierUtilisateur(jeton);
    if (!utilisateur) {
      res.status(401).json({ error: 'Session invalide ou expirée — reconnectez-vous.' });
      return;
    }

    // 2. Ce compte figure-t-il dans la table admins ? (même contrôle que
    // celui déjà appliqué par le déclencheur gerer_validation_publication()
    // côté base de données.)
    if (!(await estAdmin(utilisateur.id))) {
      res.status(403).json({ error: "Ce compte n'est pas administrateur." });
      return;
    }

    // 2 bis. Garde-fou (audit du 05/10/2026) : cette fonction ne supprime QUE des comptes de
    // mannequins — jamais un compte administrateur (y compris le sien), même si son
    // identifiant lui était envoyé par erreur ou volontairement.
    // (si la base ne répond pas, on refuse : null)
    const cibleAdmin = await lignesAdmin(modelId);
    if (!cibleAdmin || cibleAdmin.length) {
      res.status(403).json({ error: 'Ce compte est un compte administrateur : il ne peut pas être supprimé ici.' });
      return;
    }

    // 3. Chemins de stockage à nettoyer, récupérés AVANT suppression : la
    // suppression en cascade côté base (auth.users -> model_profiles ->
    // model_photos, déjà "on delete cascade") ne touche pas aux fichiers du
    // Storage, qui doivent être retirés séparément.
    const reponsePhotos = await fetch(
      SUPABASE_URL + '/rest/v1/model_photos?model_id=eq.' + encodeURIComponent(modelId) + '&select=chemin,chemin_miniature,chemin_moyenne',
      { headers: enTetesService() }
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
      headers: enTetesService()
    });
    if (!reponseSuppression.ok) {
      const detail = await reponseSuppression.text().catch(function () { return ''; });
      res.status(502).json({ error: 'Échec de la suppression du compte : ' + detail });
      return;
    }

    // 5. Nettoyage des fichiers R2 (best-effort : la base est déjà propre à
    // ce stade, un échec ici ne doit pas être présenté comme un échec de la
    // suppression elle-même).
    if (chemins.length && process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME) {
      try {
        const clientR2 = creerClientR2();
        await clientR2.send(new DeleteObjectsCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Delete: { Objects: chemins.map(function (c) { return { Key: c }; }) }
        }));
      } catch (e) { console.warn('Nettoyage R2 non confirmé :', e); }
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : 'Erreur inattendue.' });
  }
};
