// Fonction serverless Vercel — Grand 4 (S-1 à S-12) : vérifie le code de
// validation admin (2FA) avec le même blocage après trop d'erreurs que la
// connexion par mot de passe. Appelée APRÈS la connexion par mot de passe
// (l'appelant est déjà authentifié) — identifie le compte par son jeton
// Supabase, jamais par une valeur fournie par le navigateur.

const { SUPABASE_URL, verifierUtilisateur, estAdmin, extraireIp, nettoyerAppareil, debutRequete, compteurTentatives, cookieAccesTableau } = require('./_commun.js');

module.exports = async function handler(req, res) {
  const debut = debutRequete(req, res, true); // POST + clé serveur + jeton (api/_commun.js)
  if (!debut) return;
  const { jeton, corps } = debut;
  const code = corps && corps.code;
  if (!code) {
    res.status(400).json({ error: 'Code manquant.' });
    return;
  }

  try {
    const utilisateur = await verifierUtilisateur(jeton);
    if (!utilisateur) {
      res.status(401).json({ error: 'Session invalide ou expirée — reconnectez-vous.' });
      return;
    }
    const tentatives = compteurTentatives(extraireIp(req), utilisateur.id, 'admin-code', nettoyerAppareil(corps && corps.appareil));
    if (await tentatives.dejaBloque(res)) return;

    const repCode = await fetch(SUPABASE_URL + '/rest/v1/rpc/verifier_code_validation', {
      method: 'POST',
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code })
    });
    const estValide = repCode.ok ? await repCode.json() : false;

    if (!estValide) {
      await tentatives.echec(res);
      return;
    }

    await tentatives.succes();
    // code bon : clé d'accès au tableau de bord (cookie signé, voir api/_commun.js)
    if (await estAdmin(utilisateur.id)) res.setHeader('Set-Cookie', cookieAccesTableau(utilisateur.id));
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
