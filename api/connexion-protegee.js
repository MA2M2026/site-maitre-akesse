// Fonction serverless Vercel — Grand 4 (S-1 à S-12) : connexion par mot de
// passe protégée par un blocage après trop d'erreurs. Remplace l'appel
// direct à sb.auth.signInWithPassword() depuis le navigateur : tout le
// comptage et le blocage se passent ici, côté serveur, stockés en base
// (jamais dans le navigateur) — vider les cookies ou passer en navigation
// privée ne contourne rien (S-6).
//
// Protège trois espaces : 'admin' (tableau-de-bord.html), 'mannequin'
// (espace-mannequin.html) et 'portail' (Administration, comptes de l'équipe).
//
// Variable d'environnement requise : SUPABASE_SERVICE_ROLE_KEY (déjà en
// place sur Vercel pour les autres fonctions api/).

const { SUPABASE_URL, enTetesService, estAdmin, extraireIp, nettoyerAppareil, debutRequete, compteurTentatives } = require('./_commun.js');

module.exports = async function handler(req, res) {
  const debut = debutRequete(req, res, false); // POST + clé serveur (js : api/_commun.js)
  if (!debut) return;
  const corps = debut.corps;
  const email = corps && corps.email;
  const password = corps && corps.password;
  const espace = corps && corps.espace;
  if (!email || !password || !['admin', 'mannequin', 'portail'].includes(espace)) {
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

    // 3 bis. Administration : compte de l'équipe, actif.
    if (espace === 'portail') {
      const rep = await fetch(SUPABASE_URL + '/rest/v1/staff_profiles?user_id=eq.' + encodeURIComponent(resultatAuth.user.id) + '&select=actif', { headers: enTetesService() });
      const lignes = rep.ok ? await rep.json() : null;
      if (!lignes || !lignes.length || !lignes[0].actif) {
        // compte créé avec « Créer mon compte » (Extension 150) : demande en attente ou refusée
        let message = lignes && lignes.length ? 'Votre accès à l’Administration a été coupé.' : "Ce compte n'a pas accès à l'Administration.";
        if (lignes && !lignes.length) {
          const d = await fetch(SUPABASE_URL + '/rest/v1/staff_demandes?select=statut&user_id=eq.' + encodeURIComponent(resultatAuth.user.id), { headers: enTetesService() }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
          if (d[0] && d[0].statut === 'en_attente') message = 'Votre demande d’accès est bien arrivée : l’agence doit encore l’accepter. Réessayez plus tard.';
          else if (d[0] && d[0].statut === 'refusee') message = 'Votre demande d’accès n’a pas été acceptée. Contactez l’agence.';
        }
        res.status(403).json({ error: message });
        return;
      }
    }

    await tentatives.succes();

    // Verrou fort d'un appareil de confiance (Extension 149, 01/11/2026) : seul le mot de passe est vérifié
    // ici. La base le note pour CET appareil (portail_mot_de_passe_verifie) ; la session de l'appareil est
    // gardée, la nouvelle session ouverte pour la vérification est refermée aussitôt (jamais renvoyée).
    if (espace === 'portail' && corps.verrouFort === true) {
      const repNote = await fetch(SUPABASE_URL + '/rest/v1/rpc/portail_mot_de_passe_verifie', {
        method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_user: resultatAuth.user.id, p_appareil: nettoyerAppareil(corps.appareil) || '' })
      });
      const note = repNote.ok ? await repNote.json().catch(() => false) : false;
      await fetch(SUPABASE_URL + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + resultatAuth.access_token } }).catch(() => {});
      if (note !== true) { res.status(409).json({ error: 'Cet appareil n’est plus de confiance : reconnectez-vous complètement.', complet: true }); return; }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(200).json({
      access_token: resultatAuth.access_token,
      refresh_token: resultatAuth.refresh_token
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
