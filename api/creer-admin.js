// Fonction serverless Vercel — crée un nouveau compte administrateur
// (compte de connexion + entrée dans la table `admins`), réservée aux
// admins déjà connectés. Remplace la manipulation manuelle dans Supabase
// (Authentication > Add user, puis Table Editor > admins > Insert row)
// par un seul formulaire dans le tableau de bord.
//
// Sécurité : seul un compte déjà présent dans la table `admins` peut
// appeler cette fonction (même contrôle que api/supprimer-mannequin.js et
// api/r2-presigner.js) — un visiteur non connecté, ou un mannequin
// connecté, ne peut jamais créer de compte admin par ce biais.
//
// Variable d'environnement requise sur Vercel : SUPABASE_SERVICE_ROLE_KEY.

const { SUPABASE_URL, jetonDe, corpsDe, verifierUtilisateur, estAdmin } = require('./_commun.js');

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
  const email = corps && typeof corps.email === 'string' ? corps.email.trim() : '';
  const motDePasse = corps && typeof corps.password === 'string' ? corps.password : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Adresse e-mail invalide.' });
    return;
  }
  if (motDePasse.length < 8) {
    res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    return;
  }

  try {
    // 1. Le jeton fourni correspond-il bien à un compte connecté ?
    const utilisateur = await verifierUtilisateur(jeton);
    if (!utilisateur) {
      res.status(401).json({ error: 'Session invalide ou expirée — reconnectez-vous.' });
      return;
    }

    // 2. Ce compte figure-t-il dans la table admins ?
    if (!(await estAdmin(utilisateur.id))) {
      res.status(403).json({ error: "Ce compte n'est pas administrateur." });
      return;
    }

    // 3. Création du compte de connexion (confirmé d'emblée : pas besoin de
    // vérifier l'e-mail, l'admin qui crée le compte connaît déjà la
    // personne concernée).
    const reponseCreation = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
      method: 'POST',
      headers: { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: motDePasse, email_confirm: true })
    });
    const resultatCreation = await reponseCreation.json().catch(function () { return {}; });
    if (!reponseCreation.ok) {
      res.status(502).json({ error: resultatCreation && (resultatCreation.msg || resultatCreation.error_description || resultatCreation.message) || 'Échec de la création du compte.' });
      return;
    }
    const nouvelId = resultatCreation && resultatCreation.id;
    if (!nouvelId) {
      res.status(502).json({ error: 'Compte créé, mais identifiant introuvable dans la réponse.' });
      return;
    }

    // 4. Ajout dans la table admins — sans cette ligne, le compte existe
    // mais n'a aucun droit admin. En cas d'échec, on supprime le compte
    // tout juste créé plutôt que de laisser un compte orphelin sans rôle.
    const reponseInsertion = await fetch(SUPABASE_URL + '/rest/v1/admins', {
      method: 'POST',
      headers: { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: nouvelId })
    });
    if (!reponseInsertion.ok) {
      await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + encodeURIComponent(nouvelId), {
        method: 'DELETE',
        headers: { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete }
      }).catch(function () {});
      const detail = await reponseInsertion.text().catch(function () { return ''; });
      res.status(502).json({ error: "Échec de l'ajout du rôle admin, compte annulé : " + detail });
      return;
    }

    res.status(200).json({ ok: true, email: email });
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : 'Erreur inattendue.' });
  }
};
