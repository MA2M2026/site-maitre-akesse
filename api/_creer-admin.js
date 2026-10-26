// Appelé par api/portail.js (action « creer_admin ») depuis le 19/10/2026 : ce n'est plus une
// fonction Vercel à part (limite de l'offre gratuite). Crée un nouveau compte administrateur
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

const { SUPABASE_URL, enTetesService, verifierUtilisateur, adminVerifie, ficheStaff, debutRequete } = require('./_commun.js');

module.exports = async function handler(req, res) {
  const debut = debutRequete(req, res, true); // POST + clé serveur + jeton (api/_commun.js)
  if (!debut) return;
  const { jeton, corps } = debut;
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
      res.status(401).json({ error: 'Session invalide ou expirée, reconnectez-vous.' });
      return;
    }

    // 2. Ce compte figure-t-il dans la table admins ?
    if (!(await adminVerifie(jeton, utilisateur))) {
      res.status(403).json({ error: "Ce compte n'est pas administrateur." });
      return;
    }
    // 2 bis. Une personne invitée par le portail (rôle « site »…) ne crée pas d'autres comptes
    // admin : ce serait un compte hors du portail, que la coupure d'accès ne toucherait pas.
    // Seul l'administrateur principal (ou l'ancien compte admin, sans fiche) le peut.
    const fiche = await ficheStaff(utilisateur.id);
    if (fiche && fiche.role !== 'principal') {
      res.status(403).json({ error: "Réservé à l'administrateur principal : les comptes se créent par invitation dans le portail." });
      return;
    }

    // 3. Création du compte de connexion (confirmé d'emblée : pas besoin de
    // vérifier l'e-mail, l'admin qui crée le compte connaît déjà la
    // personne concernée).
    const reponseCreation = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
      method: 'POST',
      headers: { ...enTetesService(), 'Content-Type': 'application/json' },
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
      headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: nouvelId })
    });
    if (!reponseInsertion.ok) {
      await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + encodeURIComponent(nouvelId), {
        method: 'DELETE',
        headers: enTetesService()
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
