// Fonction serverless Vercel — Grand 4 (S-1 à S-12) : vérifie le code de
// validation admin (2FA) avec le même blocage après trop d'erreurs que la
// connexion par mot de passe. Appelée APRÈS la connexion par mot de passe
// (l'appelant est déjà authentifié) — identifie le compte par son jeton
// Supabase, jamais par une valeur fournie par le navigateur.

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';

function extraireIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || '0.0.0.0';
}

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

  const enTeteAuth = req.headers.authorization || '';
  const jeton = enTeteAuth.startsWith('Bearer ') ? enTeteAuth.slice(7) : '';
  if (!jeton) {
    res.status(401).json({ error: 'Non authentifié.' });
    return;
  }

  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch (e) { corps = {}; } }
  const code = corps && corps.code;
  if (!code) {
    res.status(400).json({ error: 'Code manquant.' });
    return;
  }

  const entetes = { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete, 'Content-Type': 'application/json' };
  const ip = extraireIp(req);
  const espace = 'admin-code';

  try {
    const repUser = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: cleSecrete, Authorization: 'Bearer ' + jeton }
    });
    if (!repUser.ok) {
      res.status(401).json({ error: 'Session invalide ou expirée — reconnectez-vous.' });
      return;
    }
    const utilisateur = await repUser.json();
    const identifiant = utilisateur.id;

    const repBlocage = await fetch(SUPABASE_URL + '/rest/v1/rpc/connexion_verifier_blocage', {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ p_ip: ip, p_identifiant: identifiant, p_espace: espace })
    });
    const lignesBlocage = repBlocage.ok ? await repBlocage.json() : [];
    const etatBlocage = lignesBlocage[0];
    if (etatBlocage && etatBlocage.bloque) {
      res.setHeader('Retry-After', String(etatBlocage.minutes_restantes * 60));
      res.status(429).json({ error: 'bloque', dejaBloque: true, minutesRestantes: etatBlocage.minutes_restantes });
      return;
    }

    const repCode = await fetch(SUPABASE_URL + '/rest/v1/rpc/verifier_code_validation', {
      method: 'POST',
      headers: { apikey: cleSecrete, Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code })
    });
    const estValide = repCode.ok ? await repCode.json() : false;

    if (!estValide) {
      const repEchec = await fetch(SUPABASE_URL + '/rest/v1/rpc/connexion_enregistrer_echec', {
        method: 'POST', headers: entetes,
        body: JSON.stringify({ p_ip: ip, p_identifiant: identifiant, p_espace: espace })
      });
      const lignesEchec = repEchec.ok ? await repEchec.json() : [];
      const etat = lignesEchec[0] || { bloque: false, essais_restants: null };
      if (etat.bloque) {
        res.setHeader('Retry-After', String(etat.minutes_blocage * 60));
        res.status(429).json({ error: 'bloque', dejaBloque: false, minutesRestantes: etat.minutes_blocage });
        return;
      }
      res.status(401).json({ error: 'refuse', essaisRestants: etat.essais_restants });
      return;
    }

    await fetch(SUPABASE_URL + '/rest/v1/rpc/connexion_enregistrer_succes', {
      method: 'POST', headers: entetes,
      body: JSON.stringify({ p_ip: ip, p_identifiant: identifiant, p_espace: espace })
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
