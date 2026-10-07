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

const { SUPABASE_URL, estAdmin, extraireIp, nettoyerAppareil } = require('./_commun.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const cleSecrete = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cleSecrete) {
    res.status(500).json({ error: 'Configuration serveur incomplète.' });
    return;
  }

  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch (e) { corps = {}; } }
  const email = corps && corps.email;
  const password = corps && corps.password;
  const espace = corps && corps.espace;
  if (!email || !password || (espace !== 'admin' && espace !== 'mannequin')) {
    res.status(400).json({ error: 'Requête invalide.' });
    return;
  }

  const ip = extraireIp(req);
  const appareil = nettoyerAppareil(corps && corps.appareil);
  const identifiant = String(email).trim().toLowerCase();
  const entetes = { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete, 'Content-Type': 'application/json' };

  try {
    // 1. Déjà bloqué ? On refuse sans même regarder le mot de passe (S-6).
    const repBlocage = await fetch(SUPABASE_URL + '/rest/v1/rpc/connexion_verifier_blocage', {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ p_ip: ip, p_identifiant: identifiant, p_espace: espace, p_appareil: appareil })
    });
    const lignesBlocage = repBlocage.ok ? await repBlocage.json() : [];
    const etatBlocage = lignesBlocage[0];
    if (etatBlocage && etatBlocage.bloque) {
      res.setHeader('Retry-After', String(etatBlocage.minutes_restantes * 60));
      res.status(429).json({ error: 'bloque', dejaBloque: true, minutesRestantes: etatBlocage.minutes_restantes });
      return;
    }

    // 2. Vérification réelle du mot de passe auprès de Supabase Auth.
    const repAuth = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: cleSecrete, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const resultatAuth = await repAuth.json().catch(() => ({}));

    if (!repAuth.ok) {
      const repEchec = await fetch(SUPABASE_URL + '/rest/v1/rpc/connexion_enregistrer_echec', {
        method: 'POST', headers: entetes,
        body: JSON.stringify({ p_ip: ip, p_identifiant: identifiant, p_espace: espace, p_appareil: appareil })
      });
      const lignesEchec = repEchec.ok ? await repEchec.json() : [];
      const etat = lignesEchec[0] || { bloque: false, avertissement: false, essais_restants: null };
      if (etat.bloque) {
        res.setHeader('Retry-After', String(etat.minutes_blocage * 60));
        res.status(429).json({ error: 'bloque', dejaBloque: false, minutesRestantes: etat.minutes_blocage });
        return;
      }
      res.status(401).json({ error: 'refuse', essaisRestants: etat.essais_restants });
      return;
    }

    // 3. Pour l'espace admin, vérifier aussi l'appartenance à la table admins.
    if (espace === 'admin') {
      if (!(await estAdmin(resultatAuth.user.id))) {
        res.status(403).json({ error: "Ce compte n'a pas accès au tableau de bord." });
        return;
      }
    }

    await fetch(SUPABASE_URL + '/rest/v1/rpc/connexion_enregistrer_succes', {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ p_ip: ip, p_identifiant: identifiant, p_espace: espace, p_appareil: appareil })
    });

    res.status(200).json({
      access_token: resultatAuth.access_token,
      refresh_token: resultatAuth.refresh_token
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
