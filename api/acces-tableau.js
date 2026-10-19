// Clé d'accès au tableau de bord (13/10/2026) — voir cookieAccesTableau dans api/_commun.js.
//  POST (jeton du compte) : pose (ou prolonge de 12 h) la clé d'un compte administrateur
//    - s'il n'a pas de code de validation, ou s'il a déjà une clé valide (prolongation) ;
//    - sinon 403 { code: 'requis' } : c'est api/code-validation-protege.js qui la pose, une fois
//      le code bon.
//  DELETE : efface la clé (déconnexion).
const { SUPABASE_URL, cleService, debutRequete, chargeJeton, ficheStaff, dernierCode, verifierUtilisateur, estAdmin, cookieAccesTableau, cleAccesTableauValide, COOKIE_ACCES_TABLEAU_EFFACE } = require('./_commun.js');

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
    // session ouverte par le portail avec la double authentification (code de l'application
    // d'authentification, niveau « aal2 ») : elle vaut le code de validation
    // personne du portail : accès coupé ou téléphone révoqué depuis le portail → l'ancien tableau
    // de bord est fermé aussi (relecture du 19/10/2026 : une session volée y restait valable)
    const fiche = await ficheStaff(utilisateur.id);
    if (fiche && (!fiche.actif || (fiche.sessions_valides_apres && dernierCode(debut.jeton) < Date.parse(fiche.sessions_valides_apres) / 1000))) {
      res.setHeader('Set-Cookie', COOKIE_ACCES_TABLEAU_EFFACE);
      res.status(403).json({ error: 'Accès coupé : reconnectez-vous depuis le portail.' });
      return;
    }
    const doubleAuthentification = chargeJeton(debut.jeton).aal === 'aal2';
    // compte du portail : la double authentification du portail est obligatoire (l'ancien code
    // de validation ne suffit plus, l'ancien tableau de bord ne s'ouvre que dans l'administration)
    if (fiche && !doubleAuthentification) {
      res.status(403).json({ error: 'Ouvrez cette rubrique depuis l’administration (/admin), après votre code à 6 chiffres.' });
      return;
    }
    if (!doubleAuthentification && !cleAccesTableauValide(req, utilisateur.id)) {
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
