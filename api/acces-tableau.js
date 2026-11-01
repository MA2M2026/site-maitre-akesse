// Clé d'accès au tableau de bord (13/10/2026) — voir cookieAccesTableau dans api/_commun.js.
//  POST (jeton du compte) : pose (ou prolonge de 12 h) la clé d'un compte administrateur
//    - s'il n'a pas de code de validation, s'il a déjà une clé valide (prolongation), ou s'il
//      vient de l'Administration avec sa double authentification (jeton « aal2 ») ;
//    - sinon 403 { code: 'requis' } : c'est api/code-validation-protege.js qui la pose, une fois
//      le code bon.
//  DELETE : efface la clé (déconnexion).
const { SUPABASE_URL, cleService, debutRequete, verifierUtilisateur, estAdmin, cookieAccesTableau, cleAccesTableauValide, COOKIE_ACCES_TABLEAU_EFFACE, chargeJeton, dernierCode, nettoyerAppareil } = require('./_commun.js');

// Session de l'Administration encore valable pour cet appareil (appareil de confiance), lue par la base
// avec le jeton de la personne et l'identifiant de l'appareil (portail_session_ok, Extension 149)
async function sessionAppareilOk(jeton, appareil) {
  if (!appareil) return false;
  const rep = await fetch(SUPABASE_URL + '/rest/v1/rpc/portail_session_ok', {
    method: 'POST', headers: { apikey: cleService(), Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json', 'x-appareil': appareil }, body: '{}'
  }).catch(() => null);
  return !!(rep && rep.ok && (await rep.json().catch(() => false)) === true);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', COOKIE_ACCES_TABLEAU_EFFACE);
    res.status(200).json({ ok: true });
    return;
  }
  const debut = debutRequete(req, res, true);  // POST + clé serveur + jeton
  if (!debut) return;
  try {
    const utilisateur = await verifierUtilisateur(debut.jeton);
    if (!utilisateur) { res.status(401).json({ error: 'Session invalide ou expirée, reconnectez-vous.' }); return; }
    if (!(await estAdmin(utilisateur.id))) { res.status(403).json({ error: "Ce compte n'est pas administrateur." }); return; }
    // Double authentification de l'Administration (code de l'application, jeton « aal2 ») : elle
    // vaut le code de validation — l'ancien tableau de bord s'ouvre dans l'Administration (espace
    // 1, cahier v2.4) sans deuxième connexion.
    // (code saisi il y a moins de 8 heures ; au-delà, sur un appareil de confiance — Extension 149, 01/11/2026 —
    // c'est la base qui dit si la session de l'Administration est encore valable pour cet appareil)
    const aal2 = chargeJeton(debut.jeton).aal === 'aal2';
    const doubleAuth = aal2 && (dernierCode(debut.jeton) > Date.now() / 1000 - 8 * 3600 || await sessionAppareilOk(debut.jeton, nettoyerAppareil(req.headers['x-appareil'])));
    if (!cleAccesTableauValide(req, utilisateur.id) && !doubleAuth) {
      // statut du code de validation, lu avec la session du compte lui-même
      const rep = await fetch(SUPABASE_URL + '/rest/v1/rpc/code_validation_statut', {
        method: 'POST',
        headers: { apikey: cleService(), Authorization: 'Bearer ' + debut.jeton, 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (!rep.ok) { res.status(503).json({ error: 'Vérification impossible pour le moment.' }); return; }
      const donnees = await rep.json();
      const ligne = Array.isArray(donnees) ? donnees[0] : donnees;
      if (ligne && ligne.defini) { res.status(403).json({ code: 'requis', error: 'Code de validation requis.' }); return; }
    }
    res.setHeader('Set-Cookie', cookieAccesTableau(utilisateur.id));
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
