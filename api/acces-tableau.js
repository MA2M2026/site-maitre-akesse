// Clé d'accès au tableau de bord (13/10/2026) — voir cookieAccesTableau dans api/_commun.js.
//  POST (jeton du compte) : pose (ou prolonge de 12 h) la clé d'un compte administrateur
//    - s'il n'a pas de code de validation, ou s'il a déjà une clé valide (prolongation) ;
//    - sinon 403 { code: 'requis' } : c'est api/code-validation-protege.js qui la pose, une fois
//      le code bon.
//  DELETE : efface la clé (déconnexion).
const { SUPABASE_URL, cleService, debutRequete, verifierUtilisateur, estAdmin, cookieAccesTableau, cleAccesTableauValide, COOKIE_ACCES_TABLEAU_EFFACE } = require('./_commun.js');

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
    if (!utilisateur) { res.status(401).json({ error: 'Session invalide ou expirée — reconnectez-vous.' }); return; }
    if (!(await estAdmin(utilisateur.id))) { res.status(403).json({ error: "Ce compte n'est pas administrateur." }); return; }
    if (!cleAccesTableauValide(req, utilisateur.id)) {
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
