// Fonction serverless Vercel — Grand 4, complément (Extension 110) : vérifie
// les codes saisis par le public avec le même blocage que les mots de passe
// (avertissements « il vous reste N tentatives », puis blocage 1 h / 2 h).
//
//   type 'inscription'           code d'inscription (inscription-mannequin.html)
//   type 'inscription-soumettre' envoi du dossier d'inscription (consomme le code)
//   type 'portail'               code d'invitation « Créer mon compte » (espace-mannequin.html)
//   type 'portail-creer-compte'  même code, puis création du compte mannequin ICI, côté
//                                serveur (test de sécurité du 04/10/2026 : le compte était
//                                créé par le navigateur avec sb.auth.signUp(), et le code
//                                d'invitation n'était vérifié qu'avant, dans la page — on
//                                pouvait donc créer un compte sans code en appelant Supabase
//                                directement). Avec ce chemin, les inscriptions publiques
//                                peuvent être fermées dans Supabase sans rien casser.
//
// Les fonctions SQL correspondantes ne sont plus appelables depuis le
// navigateur : tout passe par ici, avec la clé service_role.

const { SUPABASE_URL, extraireIp, nettoyerAppareil } = require('./_commun.js');

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Création du compte de connexion (confirmé d'emblée, comme les comptes admin) puis de
// sa fiche model_profiles. Si la fiche échoue, le compte tout juste créé est supprimé :
// jamais de compte orphelin sans fiche.
async function creerCompteMannequin(entetes, nom, email, motDePasse) {
  const repCompte = await fetch(SUPABASE_URL + '/auth/v1/admin/users', {
    method: 'POST', headers: entetes,
    body: JSON.stringify({ email: email, password: motDePasse, email_confirm: true, user_metadata: { full_name: nom } })
  });
  const compte = await repCompte.json().catch(() => ({}));
  if (!repCompte.ok) {
    const texte = String((compte && (compte.msg || compte.message || compte.error_description || compte.error_code)) || '');
    if (/already|registered|exists|email_exists/i.test(texte)) return { status: 409, corps: { error: 'existe' } };
    if (/password/i.test(texte)) return { status: 400, corps: { error: 'mot_de_passe' } };
    return { status: 502, corps: { error: 'creation' } };
  }
  const id = compte && compte.id;
  if (!id) return { status: 502, corps: { error: 'creation' } };
  const repFiche = await fetch(SUPABASE_URL + '/rest/v1/model_profiles?on_conflict=id', {
    method: 'POST',
    headers: { ...entetes, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: id, full_name: nom, published: false })
  });
  if (!repFiche.ok) {
    await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'DELETE', headers: entetes }).catch(() => {});
    return { status: 502, corps: { error: 'creation' } };
  }
  return { status: 200, corps: { ok: true } };
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
  if (!code || code.length > 100 || !['inscription', 'inscription-soumettre', 'portail', 'portail-creer-compte'].includes(type)) {
    res.status(400).json({ error: 'Requête invalide.' }); return;
  }
  // Création de compte : champs vérifiés AVANT le code (une faute de frappe dans l'e-mail
  // ne doit pas coûter une tentative).
  const nom = typeof corps.nom === 'string' ? corps.nom.trim() : '';
  const email = typeof corps.email === 'string' ? corps.email.trim().toLowerCase() : '';
  const motDePasse = typeof corps.password === 'string' ? corps.password : '';
  if (type === 'portail-creer-compte') {
    if (!nom || nom.length > 120 || !EMAIL_VALIDE.test(email) || email.length > 200) { res.status(400).json({ error: 'champs' }); return; }
    if (motDePasse.length < 8 || motDePasse.length > 72) { res.status(400).json({ error: 'mot_de_passe' }); return; }
  }

  const ip = extraireIp(req);
  const appareil = nettoyerAppareil(corps.appareil);
  const espace = (type === 'portail' || type === 'portail-creer-compte') ? 'portail-code' : 'inscription-code';
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
    } else if (type === 'portail' || type === 'portail-creer-compte') {
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
    if (type === 'portail-creer-compte') {
      const resultat = await creerCompteMannequin(entetes, nom, email, motDePasse);
      res.status(resultat.status).json(resultat.corps);
      return;
    }
    res.status(200).json(type === 'inscription-soumettre' ? { ok: true, id: idInscription } : { ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
