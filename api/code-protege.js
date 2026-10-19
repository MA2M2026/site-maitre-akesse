// Fonction serverless Vercel — Grand 4, complément (Extension 110) : vérifie
// les codes saisis par le public avec le même blocage que les mots de passe
// (avertissements « il vous reste N tentatives », puis blocage 1 h / 2 h).
//
//   type 'inscription'           code d'inscription (inscription-mannequin.html)
//   type 'inscription-soumettre' envoi du dossier d'inscription (consomme le code)
//   type 'inscription-code'      inscription simplifiée (cahier v2.4, section 4) : code individuel +
//                                date de naissance → informations du casting à confirmer
//   type 'inscription-payer'     « J'ai payé » : code consommé, mannequin au registre, paiement
//                                en attente de validation (espace 2)
//   type 'portail'               code de l'espace mannequin « Créer mon compte » (espace-mannequin.html) ;
//                                depuis le 19/10/2026 (cahier v2.4, 5.4) : code PERSONNEL créé dans
//                                l'Administration (espace 2), une fois, 7 jours — plus de code permanent
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

const { SUPABASE_URL, enTetesService, corpsDe, extraireIp, nettoyerAppareil } = require('./_commun.js');

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Code d'inscription valable : on remet aussi le chemin secret de la note d'intégration
// (14/10/2026, api/_r2.js), ou null s'il n'y en a pas (ou si le stockage ne répond pas :
// l'inscription doit continuer de marcher sans elle).
// Au plus 3 s : la note ne doit jamais retarder l'ouverture du formulaire.
async function cheminNoteIntegration() {
  let minuteur;
  try {
    const delai = new Promise(ok => { minuteur = setTimeout(() => ok([]), 3000); });
    const n = await Promise.race([require('./_r2.js').notesIntegration(), delai]);
    return n[0] ? n[0].chemin : null;
  } catch (e) { return null; } finally { clearTimeout(minuteur); }
}

// Incident du 04 au 11/10/2026 : la création échouait en silence (« La création du compte
// a échoué » pour la mannequin, rien pour l'agence). Toute panne de création est désormais
// écrite dans le journal des erreurs du tableau de bord, avec la raison donnée par la base.
async function signalerPanne(entetes, etape, detail) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/journal_erreurs', {
      method: 'POST', headers: { ...entetes, Prefer: 'return=minimal' },
      body: JSON.stringify({ message: '[Création de compte mannequin] échec : ' + etape, page: '/espace-mannequin', pile: String(detail || '').slice(0, 900), user_agent: 'serveur (api/code-protege)' })
    });
  } catch (e) { /* le journal ne doit jamais bloquer la réponse */ }
}

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
    await signalerPanne(entetes, 'compte de connexion', texte || repCompte.status);
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
    const raison = await repFiche.text().catch(() => repFiche.status);
    // Nettoyage d'abord : un journal lent ne doit jamais laisser un compte sans fiche.
    await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'DELETE', headers: entetes }).catch(() => {});
    await signalerPanne(entetes, 'fiche model_profiles', raison);
    return { status: 502, corps: { error: 'creation' } };
  }
  return { status: 200, corps: { ok: true }, id };
}

// p_email et p_parent_email : Extension 129 ; p_civilite : Extension 132 (07/10/2026).
const CHAMPS_INSCRIPTION = ['p_full_name', 'p_date_naissance', 'p_genre', 'p_height_cm', 'p_clothing_size', 'p_phone', 'p_reference_paiement', 'p_parent_nom', 'p_parent_telephone', 'p_email', 'p_parent_email', 'p_civilite'];
// Une adresse e-mail fournie doit avoir une forme valable (vide = non fournie).
function emailAccepte(v) { return v == null || v === '' || (typeof v === 'string' && v.length <= 200 && EMAIL_VALIDE.test(v.trim())); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Méthode non autorisée.' }); return; }
  const cleSecrete = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cleSecrete) { res.status(500).json({ error: 'Configuration serveur incomplète.' }); return; }

  const corps = corpsDe(req);
  const type = corps.type;
  const code = typeof corps.code === 'string' ? corps.code.trim() : '';
  if (!code || code.length > 100 || !['inscription', 'inscription-soumettre', 'inscription-code', 'inscription-payer', 'portail', 'portail-creer-compte'].includes(type)) {
    res.status(400).json({ error: 'Requête invalide.' }); return;
  }
  const simplifiee = type === 'inscription-code' || type === 'inscription-payer';
  const naissance = typeof corps.naissance === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(corps.naissance) ? corps.naissance : '';
  if (simplifiee && !naissance) { res.status(400).json({ error: 'naissance' }); return; }
  // Informations confirmées ou corrigées par le mannequin : champs connus seulement, courts
  let infos = null;
  if (type === 'inscription-payer') {
    const d = corps.infos || {};
    infos = {};
    ['full_name', 'telephone', 'email', 'ville', 'parent_nom', 'parent_telephone', 'parent_email', 'accord_parent', 'reglement'].forEach((k) => {
      if (typeof d[k] === 'string' && d[k].trim()) infos[k] = d[k].trim().slice(0, 200);
    });
    if (!emailAccepte(infos.email) || !emailAccepte(infos.parent_email)) { res.status(400).json({ error: 'dossier', code: 'email', message: 'Adresse e-mail invalide.' }); return; }
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
  const entetes = { ...enTetesService(), 'Content-Type': 'application/json' };
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

    let valide = false, idInscription = null, casting = null;
    if (type === 'inscription-code') {
      const r = await rpc('inscription_code_lire', { p_code: code, p_naissance: naissance });
      casting = r.ok ? await r.json() : null;
      valide = !!casting;
    } else if (type === 'inscription-payer') {
      const r = await rpc('inscription_simplifiee_payer', { p_code: code, p_naissance: naissance, p_infos: infos });
      const resultat = await r.json().catch(() => null);
      if (r.ok) { valide = true; idInscription = resultat; }
      else if (!(resultat && String(resultat.message || '').includes('code_invalide_ou_deja_utilise'))) {
        // informations manquantes (règlement, parent…) : pas comptées comme tentative
        res.status(400).json({ error: 'dossier', message: resultat && resultat.message });
        return;
      }
    } else if (type === 'inscription') {
      const r = await rpc('verifier_code_inscription', { code_input: code });
      valide = r.ok && (await r.json()) === true;
    } else if (type === 'portail' || type === 'portail-creer-compte') {
      const r = await rpc('code_espace_valable', { p_code: code });
      valide = r.ok && (await r.json()) === true;
    } else {
      const args = { p_code: code };
      const d = corps.dossier || {};
      CHAMPS_INSCRIPTION.forEach(k => { args[k] = d[k] === undefined ? null : d[k]; });
      if (args.p_civilite != null && ['Madame', 'Mademoiselle', 'Monsieur'].indexOf(args.p_civilite) === -1) args.p_civilite = null;
      if (!emailAccepte(args.p_email) || !emailAccepte(args.p_parent_email)) {
        res.status(400).json({ error: 'dossier', code: 'email', message: 'Adresse e-mail invalide.' });
        return;
      }
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
      // compte créé : rattaché à sa fiche du registre, informations du casting recopiées, code consommé
      if (resultat.id) {
        const r = await rpc('code_espace_utiliser', { p_code: code, p_user: resultat.id });
        if (!r.ok) await signalerPanne(entetes, 'rattachement au registre (code de l\'espace)', await r.text().catch(() => r.status));
      }
      res.status(resultat.status).json(resultat.corps);
      return;
    }
    if (type === 'inscription') { res.status(200).json({ ok: true, note: await cheminNoteIntegration() }); return; }
    if (type === 'inscription-code') { res.status(200).json({ ok: true, casting, note: await cheminNoteIntegration() }); return; }
    if (type === 'inscription-payer') { res.status(200).json({ ok: true }); return; }
    res.status(200).json(type === 'inscription-soumettre' ? { ok: true, id: idInscription } : { ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur.' });
  }
};
