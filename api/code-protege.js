// Fonction serverless Vercel — Grand 4, complément (Extension 110) : vérifie
// les codes saisis par le public avec le même blocage que les mots de passe
// (avertissements « il vous reste N tentatives », puis blocage 1 h / 2 h).
//
//   type 'inscription'           code d'inscription (inscription-mannequin.html)
//   type 'inscription-soumettre' envoi du dossier d'inscription (consomme le code)
//   type 'portail'               code d'invitation « Créer mon compte » (espace-mannequin.html)
//
// Les fonctions SQL correspondantes ne sont plus appelables depuis le
// navigateur : tout passe par ici, avec la clé service_role.

const SUPABASE_URL = 'https://dfhghgmwmxiguhtxtsle.supabase.co';

function extraireIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || '0.0.0.0';
}
function nettoyerAppareil(v) {
  return typeof v === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null;
}

const CHAMPS_INSCRIPTION = ['p_full_name', 'p_date_naissance', 'p_genre', 'p_height_cm', 'p_clothing_size', 'p_phone', 'p_reference_paiement', 'p_parent_nom', 'p_parent_telephone'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Méthode non autorisée.' }); return; }
  const cleSecrete = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cleSecrete) { res.status(500).json({ error: 'Configuration serveur incomplète.' }); return; }

  let corps = req.body;
  if (typeof corps === 'string') { try { corps = JSON.parse(corps); } catch (e) { corps = {}; } }
  corps = corps || {};
  const type = corps.type;
  const code = typeof corps.code === 'string' ? corps.code.trim() : '';
  if (!code || code.length > 100 || !['inscription', 'inscription-soumettre', 'portail'].includes(type)) {
    res.status(400).json({ error: 'Requête invalide.' }); return;
  }

  const ip = extraireIp(req);
  const appareil = nettoyerAppareil(corps.appareil);
  const espace = type === 'portail' ? 'portail-code' : 'inscription-code';
  const identifiant = appareil ? 'appareil:' + appareil : 'ip:' + ip;
  const entetes = { apikey: cleSecrete, Authorization: 'Bearer ' + cleSecrete, 'Content-Type': 'application/json' };
  const rpc = (nom, args) => fetch(SUPABASE_URL + '/rest/v1/rpc/' + nom, { method: 'POST', headers: entetes, body: JSON.stringify(args) });
  const cle = { p_ip: ip, p_identifiant: identifiant, p_espace: espace, p_appareil: appareil };

  try {
    const repBlocage = await rpc('connexion_verifier_blocage', cle);
    const etatBlocage = (repBlocage.ok ? await repBlocage.json() : [])[0];
    if (etatBlocage && etatBlocage.bloque) {
      res.setHeader('Retry-After', String(etatBlocage.minutes_restantes * 60));
      res.status(429).json({ error: 'bloque', dejaBloque: true, minutesRestantes: etatBlocage.minutes_restantes });
      return;
    }

    let valide = false, idInscription = null;
    if (type === 'inscription') {
      const r = await rpc('verifier_code_inscription', { code_input: code });
      valide = r.ok && (await r.json()) === true;
    } else if (type === 'portail') {
      const r = await rpc('check_invite_code', { code_input: code });
      valide = r.ok && (await r.json()) === true;
    } else {
      const args = { p_code: code };
      const d = corps.dossier || {};
      CHAMPS_INSCRIPTION.forEach(k => { args[k] = d[k] === undefined ? null : d[k]; });
      const r = await rpc('soumettre_inscription_mannequin', args);
      const resultat = await r.json().catch(() => null);
      if (r.ok) { valide = true; idInscription = resultat; }
      else if (!(resultat && String(resultat.message || '').includes('code_invalide_ou_deja_utilise'))) {
        // Erreur sans rapport avec le code (référence de paiement en double…) : pas comptée comme tentative.
        res.status(400).json({ error: 'dossier', code: resultat && resultat.code, message: resultat && resultat.message });
        return;
      }
    }

    if (!valide) {
      const repEchec = await rpc('connexion_enregistrer_echec', cle);
      const etat = (repEchec.ok ? await repEchec.json() : [])[0] || { bloque: false, essais_restants: null };
      if (etat.bloque) {
        res.setHeader('Retry-After', String(etat.minutes_blocage * 60));
        res.status(429).json({ error: 'bloque', dejaBloque: false, minutesRestantes: etat.minutes_blocage });
        return;
      }
      res.status(401).json({ error: 'refuse', essaisRestants: etat.essais_restants });
      return;
    }

    await rpc('connexion_enregistrer_succes', cle);
    res.status(200).json(type === 'inscription-soumettre' ? { ok: true, id: idInscription } : { ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
