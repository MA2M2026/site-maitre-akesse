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
const { SUPABASE_URL, enTetesService, verifierUtilisateur, extraireIp, debutRequete, compteurTentatives } = require('./_commun.js');

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
async function moiPortail(jeton) {
  const rep = await fetch(SUPABASE_URL + '/rest/v1/rpc/portail_moi', {
    method: 'POST', headers: { apikey: enTetesService().apikey, Authorization: 'Bearer ' + jeton, 'Content-Type': 'application/json' }, body: '{}'
  });
  return rep.ok ? rep.json() : null;
}
function chargeJeton(jeton) {
  try { return JSON.parse(Buffer.from(jeton.split('.')[1], 'base64url').toString('utf8')); } catch (e) { return {}; }
}
// code de double authentification saisi il y a moins de 10 minutes
function authRecente(jeton) {
  const amr = chargeJeton(jeton).amr || [];
  const t = Math.max(0, ...amr.filter((m) => m && /totp/.test(m.method)).map((m) => Number(m.timestamp) || 0));
  return t > Date.now() / 1000 - 600;
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
const RAISONS_ECHEC = ['inconnu', 'bloque'];

module.exports = async function handler(req, res) {
  const debut = debutRequete(req, res, false);
  if (!debut) return;
  const { jeton, corps } = debut;
  const action = String(corps.action || '');
  try {
    // ---------- administrateur principal ----------
    if (['inviter', 'reinitialiser_mfa', 'acces'].includes(action)) {
      const moi = jeton && await moiPortail(jeton);
      if (!moi || moi.role !== 'principal') return res.status(403).json({ error: 'Réservé à l’administrateur principal.' });
      if (!authRecente(jeton)) return res.status(403).json({ error: 'AUTH_RECENTE: confirmez votre code.' });
      const auteur = await verifierUtilisateur(jeton);

      if (action === 'inviter') {
        const email = String(corps.email || '').trim().toLowerCase(), nom = String(corps.nom || '').trim(), role = String(corps.role || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !nom || !ROLES.includes(role)) return res.status(400).json({ error: 'Nom, e-mail et rôle obligatoires.' });
        let userId = await rpcService('portail_utilisateur_par_email', { p_email: email });
        if (!userId) {
          const invite = await adminAuth('invite?redirect_to=' + encodeURIComponent(SITE + '/admin/'), 'POST', { email, data: { portail_invite: true, nom } });
          userId = invite.id;
        }
        const rep = await fetch(SUPABASE_URL + '/rest/v1/staff_profiles?on_conflict=user_id', {
          method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ user_id: userId, nom, email, role, actif: true, cree_par: auteur.id })
        });
        if (!rep.ok) throw new Error('Compte invité, mais rôle non enregistré.');
        // l'administrateur du site gère aussi le contenu du site (anciennes règles fondées sur « admins »)
        if (role === 'site') {
          await fetch(SUPABASE_URL + '/rest/v1/admins?on_conflict=user_id', {
            method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' },
            body: JSON.stringify({ user_id: userId })
          });
        }
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
      if (!/^MA2M-[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(code) || !/^\d{4}-\d{2}-\d{2}$/.test(naissance)) return res.status(200).json({ ok: false, raison: 'inconnu' });
      const tentatives = compteurTentatives(extraireIp(req), 'code-inscription', 'inscription', null);
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
      if (r && r.ok === false && RAISONS_ECHEC.includes(r.raison)) await tentatives.compterEchec();
      else if (r && r.ok) await tentatives.succes();
      return res.status(200).json(r);
    }

    // ---------- page de paiement à lien personnel ----------
    if (action === 'lien_lire' || action === 'lien_declarer') {
      const t = String(corps.t || '');
      if (!/^[A-Za-z0-9_-]{20,64}$/.test(t)) return res.status(200).json({ ok: false });
      const tentatives = compteurTentatives(extraireIp(req), 'lien-paiement', 'paiement', null);
      if (await tentatives.dejaBloque(res)) return;
      const r = action === 'lien_lire' ? await rpcService('lien_paiement_lire', { p_jeton: t })
        : await rpcService('lien_paiement_declarer', { p_jeton: t, p_numero: String(corps.numero || '').trim().slice(0, 30) });
      if (!r.ok) await tentatives.compterEchec();
      return res.status(200).json(r);
    }

    return res.status(400).json({ error: 'Action inconnue.' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
};
