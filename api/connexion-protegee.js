// Fonction serverless Vercel — Grand 4 (S-1 à S-12) : connexion par mot de
// passe protégée par un blocage après trop d'erreurs. Remplace l'appel
// direct à sb.auth.signInWithPassword() depuis le navigateur : tout le
// comptage et le blocage se passent ici, côté serveur, stockés en base
// (jamais dans le navigateur) — vider les cookies ou passer en navigation
// privée ne contourne rien (S-6).
//
// Protège deux espaces : 'admin' (tableau-de-bord.html) et 'mannequin'
// (espace-mannequin.html).
//
// Variable d'environnement requise : SUPABASE_SERVICE_ROLE_KEY (déjà en
// place sur Vercel pour les autres fonctions api/).

const { SUPABASE_URL, estAdmin, extraireIp, nettoyerAppareil, debutRequete, compteurTentatives } = require('./_commun.js');

module.exports = async function handler(req, res) {
  const debut = debutRequete(req, res, false); // POST + clé serveur (js : api/_commun.js)
  if (!debut) return;
  const corps = debut.corps;
  const email = corps && corps.email;
  const password = corps && corps.password;
  const espace = corps && corps.espace;
  if (!email || !password || (espace !== 'admin' && espace !== 'mannequin')) {
    res.status(400).json({ error: 'Requête invalide.' });
    return;
  }

  const identifiant = String(email).trim().toLowerCase();
  const tentatives = compteurTentatives(extraireIp(req), identifiant, espace, nettoyerAppareil(corps && corps.appareil));

  try {
    // 1. Déjà bloqué ? On refuse sans même regarder le mot de passe (S-6).
    if (await tentatives.dejaBloque(res)) return;

    // 2. Vérification réelle du mot de passe auprès de Supabase Auth.
    const repAuth = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const resultatAuth = await repAuth.json().catch(() => ({}));

    if (!repAuth.ok) {
      await tentatives.echec(res);
      return;
    }

    // 3. Pour l'espace admin, vérifier aussi l'appartenance à la table admins.
    if (espace === 'admin') {
      if (!(await estAdmin(resultatAuth.user.id))) {
        res.status(403).json({ error: "Ce compte n'a pas accès au tableau de bord." });
        return;
      }
    }

    await tentatives.succes();

    res.status(200).json({
      access_token: resultatAuth.access_token,
      refresh_token: resultatAuth.refresh_token
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
