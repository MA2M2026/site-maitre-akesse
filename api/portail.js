// Fonction serveur du portail d'administration et des parcours sans compte (cahier v2.3).
// Une seule fonction pour plusieurs actions : l'offre gratuite de Vercel limite le nombre de
// fonctions à 12 (11 déjà utilisées). La clé secrète Supabase ne quitte jamais le serveur.
//
// Actions réservées à l'administrateur principal (code de double authentification récent) :
//   inviter, reinitialiser_mfa, acces
// Actions de la personne connectée : codes_secours_creer (après activation de la double
//   authentification), code_secours_utiliser (téléphone perdu)
// Actions publiques, limitées par adresse (blocage après trop d'erreurs) :
//   inscription_verifier, inscription_corriger, inscription_declarer (inscription par code
//   individuel, section 14) ; lien_lire, lien_declarer (page de paiement sans compte, 7.2)

const crypto = require('crypto');
const { SUPABASE_URL, enTetesService, verifierUtilisateur, extraireIp, debutRequete, chargeJeton, dernierCode, compteurTentatives } = require('./_commun.js');

const SITE = 'https://www.maitreakessemodelmanagement.com';
const hacher = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

async function rpcService(nom, params) {
  const rep = await fetch(SUPABASE_URL + '/rest/v1/rpc/' + nom, {
    method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json' }, body: JSON.stringify(params || {})
  });
  const corps = await rep.json().catch(() => null);
  if (!rep.ok) throw new Error((corps && (corps.message || corps.hint)) || 'Erreur de la base.');
  return corps;
}
// rôle dans le portail, lu avec le jeton de la personne (la base vérifie aussi la double authentification)
// (avec l'identifiant de l'appareil envoyé par le portail : la base refuse un appareil révoqué)
async function moiPortail(jeton, appareil) {
  const rep = await fetch(SUPABASE_URL + '/rest/v1/rpc/portail_moi', {
    method: 'POST', headers: { apikey: enTetesService().apikey, Authorization: 'Bearer ' + jeton, 'x-appareil': appareil, 'Content-Type': 'application/json' }, body: '{}'
  });
  return rep.ok ? rep.json() : null;
}
// date réelle AAAA-MM-JJ (pas seulement la forme : 2026-13-45 est refusé)
function dateValide(texte) {
  const d = new Date(texte + 'T00:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(texte) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texte;
}
// code de double authentification saisi il y a moins de 10 minutes
function authRecente(jeton) {
  return dernierCode(jeton) > Date.now() / 1000 - 600;
}
async function adminAuth(chemin, methode, corps) {
  const rep = await fetch(SUPABASE_URL + '/auth/v1/' + chemin, {
    method: methode, headers: { ...enTetesService(), 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined
  });
  const r = await rep.json().catch(() => ({}));
  if (!rep.ok) throw new Error(r.msg || r.error_description || r.message || 'Erreur du service de connexion.');
  return r;
}
async function supprimerFacteurs(userId) {
  const r = await adminAuth('admin/users/' + userId + '/factors', 'GET');
  for (const f of (Array.isArray(r) ? r : r.factors || [])) await adminAuth('admin/users/' + userId + '/factors/' + f.id, 'DELETE');
}
const ROLES = ['site', 'caisse', 'compta'];

module.exports = async function handler(req, res) {
  const debut = debutRequete(req, res, false);
  if (!debut) return;
  const { jeton, corps } = debut;
  const action = String(corps.action || '');
  try {
    // ---------- administrateur principal ----------
    if (['inviter', 'reinitialiser_mfa', 'acces'].includes(action)) {
      const appareil = String(req.headers['x-appareil'] || '');
      const moi = jeton && /^[a-z0-9-]{16,64}$/.test(appareil) && await moiPortail(jeton, appareil);
      if (!moi || moi.role !== 'principal') return res.status(403).json({ error: 'Réservé à l’administrateur principal.' });
      if (!authRecente(jeton)) return res.status(403).json({ error: 'AUTH_RECENTE: confirmez votre code.' });
      const auteur = await verifierUtilisateur(jeton);

      if (action === 'inviter') {
        const email = String(corps.email || '').trim().toLowerCase(), nom = String(corps.nom || '').trim(), role = String(corps.role || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !nom || !ROLES.includes(role)) return res.status(400).json({ error: 'Nom, e-mail et rôle obligatoires.' });
        let userId = await rpcService('portail_utilisateur_par_email', { p_email: email });
        // une personne déjà dans le portail (ou soi-même) : son rôle ne s'écrase pas par une
        // invitation, il se change dans la liste (relecture du 19/10/2026)
        if (userId === auteur.id) return res.status(400).json({ error: 'Vous ne pouvez pas vous inviter vous-même.' });
        if (userId) {
          const dejaLa = await fetch(SUPABASE_URL + '/rest/v1/staff_profiles?select=user_id&user_id=eq.' + encodeURIComponent(userId), { headers: enTetesService() });
          if (!dejaLa.ok) throw new Error('Vérification impossible pour le moment.');
          if ((await dejaLa.json()).length) return res.status(400).json({ error: 'Cette personne a déjà un compte du portail : changez son rôle dans la liste.' });
        }
        if (!userId) {
          const invite = await adminAuth('invite?redirect_to=' + encodeURIComponent(SITE + '/admin/'), 'POST', { email, data: { portail_invite: true, nom } });
          userId = invite.id;
        }
        const rep = await fetch(SUPABASE_URL + '/rest/v1/staff_profiles?on_conflict=user_id', {
          method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ user_id: userId, nom, email, role, actif: true, cree_par: auteur.id })
        });
        if (!rep.ok) throw new Error('Compte invité, mais rôle non enregistré.');
        // (rôle « site » : la base ajoute elle-même les droits de l'ancien tableau de bord, table
        // admins, et les retire au changement de rôle ou à la coupure — staff_suivre_admins)
        return res.status(200).json({ ok: true });
      }
      const cible = String(corps.user_id || '');
      if (!/^[0-9a-f-]{36}$/.test(cible) || cible === auteur.id) return res.status(400).json({ error: 'Compte invalide.' });
      if (action === 'reinitialiser_mfa') {
        await supprimerFacteurs(cible);
        await rpcService('portail_codes_secours_creer', { p_user: cible, p_haches: [] });
        return res.status(200).json({ ok: true });
      }
      // accès coupé : toutes les sessions de ce compte sont fermées (bannissement levé au rétablissement)
      await adminAuth('admin/users/' + cible, 'PUT', { ban_duration: corps.actif ? 'none' : '876000h' });
      return res.status(200).json({ ok: true });
    }

    // ---------- la personne connectée ----------
    if (action === 'codes_secours_creer' || action === 'code_secours_utiliser') {
      const u = jeton && await verifierUtilisateur(jeton);
      if (!u) return res.status(401).json({ error: 'Session expirée : reconnectez-vous.' });
      const tentatives = compteurTentatives(extraireIp(req), u.id, 'portail-secours', null);
      if (action === 'codes_secours_creer') {
        if (chargeJeton(jeton).aal !== 'aal2') return res.status(403).json({ error: 'Activez d’abord la double authentification.' });
        // code saisi il y a moins de 10 minutes : une session volée ne remplace pas les codes de
        // secours de la personne (relecture du 19/10/2026)
        if (!authRecente(jeton)) return res.status(403).json({ error: 'AUTH_RECENTE: confirmez votre code.' });
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const codes = Array.from({ length: 8 }, () => Array.from(crypto.randomBytes(10), (o) => alphabet[o % alphabet.length]).join('').replace(/(.{5})(.{5})/, '$1-$2'));
        await rpcService('portail_codes_secours_creer', { p_user: u.id, p_haches: codes.map(hacher) });
        return res.status(200).json({ codes });
      }
      if (await tentatives.dejaBloque(res)) return;
      const ok = await rpcService('portail_code_secours_utiliser', { p_user: u.id, p_hache: hacher(String(corps.code || '').trim().toUpperCase()) });
      if (!ok) { await tentatives.echec(res); return; }
      await tentatives.succes();
      await supprimerFacteurs(u.id);
      return res.status(200).json({ ok: true });
    }

    // ---------- inscription par code individuel (sans compte) ----------
    if (action.startsWith('inscription_')) {
      const code = String(corps.code || '').trim().toUpperCase(), naissance = String(corps.naissance || '');
      if (!/^MA2M-[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(code) || !dateValide(naissance)) return res.status(200).json({ ok: false, raison: 'inconnu' });
      // compteur par adresse (comme api/code-protege.js), jamais commun à tout le monde
      // (relecture du 19/10/2026 : 5 essais faux bloquaient tous les mannequins)
      const tentatives = compteurTentatives(extraireIp(req), 'ip:' + extraireIp(req), 'inscription', null);
      if (await tentatives.dejaBloque(res)) return;
      let r;
      if (action === 'inscription_verifier') {
        r = await rpcService('verifier_code_inscription', { p_code: code, p_naissance: naissance });
        // note d'information et procédure d'intégration (adresse secrète, donnée seulement avec un code valable)
        if (r && r.ok) r.note = await require('./_r2.js').cheminNoteIntegration();
      }
      else if (action === 'inscription_corriger') {
        const tel = String(corps.telephone || '').trim(), mail = String(corps.email || '').trim();
        if (tel.replace(/\D/g, '').length < 8 || (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))) return res.status(400).json({ error: 'Téléphone ou e-mail invalide.' });
        r = await rpcService('corriger_inscription', { p_code: code, p_naissance: naissance, p_telephone: tel, p_email: mail });
      } else if (action === 'inscription_declarer') {
        r = await rpcService('declarer_paiement_inscription', {
          p_code: code, p_naissance: naissance, p_numero: String(corps.numero || '').trim().slice(0, 30), p_operateur: 'wave',
          p_reglement_accepte: corps.reglement === true, p_accord_parent: corps.parent === true
        });
      } else return res.status(400).json({ error: 'Action inconnue.' });
      // tout refus compte ; une réussite ne remet pas le compteur à zéro (sinon, avec un seul
      // bon code, on pourrait essayer les autres sans fin) — il s'efface seul avec le temps
      if (r && r.ok === false) await tentatives.compterEchec();
      return res.status(200).json(r);
    }

    // ---------- page de paiement à lien personnel ----------
    if (action === 'lien_lire' || action === 'lien_declarer') {
      const t = String(corps.t || '');
      if (!/^[A-Za-z0-9_-]{20,64}$/.test(t)) return res.status(200).json({ ok: false });
      const tentatives = compteurTentatives(extraireIp(req), 'ip:' + extraireIp(req), 'paiement', null);
      if (await tentatives.dejaBloque(res)) return;
      const r = action === 'lien_lire' ? await rpcService('lien_paiement_lire', { p_jeton: t })
        : await rpcService('lien_paiement_declarer', { p_jeton: t, p_numero: String(corps.numero || '').trim().slice(0, 30) });
      if (!r.ok) await tentatives.compterEchec();
      return res.status(200).json(r);
    }

    return res.status(400).json({ error: 'Action inconnue.' });
  } catch (e) {
    // pages publiques (inscription, lien de paiement) : jamais le message brut de la base
    const publique = action.startsWith('inscription_') || action.startsWith('lien_');
    return res.status(500).json({ error: publique ? 'Erreur serveur, réessayez dans un instant.' : (e.message || 'Erreur serveur.') });
  }
};
