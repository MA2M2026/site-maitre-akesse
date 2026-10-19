// Fonction serveur de l'Administration (cahier v2.3, mise à jour v2.4 du 19/10/2026).
// Une seule fonction pour plusieurs actions : l'offre gratuite de Vercel limite le nombre de
// fonctions à 12 (11 déjà utilisées). La clé secrète Supabase ne quitte jamais le serveur.
//
// Actions réservées à l'administrateur principal (code de double authentification récent) :
//   inviter, reinitialiser_mfa, acces
// Actions de la personne connectée : codes_secours_creer (après activation de la double
//   authentification), code_secours_utiliser (téléphone perdu)
// (Les actions de l'inscription par code et des paiements viendront avec l'espace 2.)

const crypto = require('crypto');
const { SUPABASE_URL, enTetesService, verifierUtilisateur, extraireIp, debutRequete, chargeJeton, dernierCode, compteurTentatives } = require('./_commun.js');

// adresse séparée de l'Administration (v2.4) : le lien d'invitation y mène
const ADMINISTRATION = 'https://admin.maitreakessemodelmanagement.com';
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

// Relances automatiques des mensualités, le 3 et le 5 du mois (cahier v2.4, 5.6 ; choix du
// 19/10/2026) : appelées par la tâche planifiée de Vercel (vercel.json, « crons »). Seulement les
// personnes appelées le 1er et pas encore payées, une seule fois chacune (la base le garantit).
// E-mail envoyé par EmailJS depuis le serveur : clé privée EMAILJS_PRIVATE_KEY (réglage Vercel),
// et « API calls for non-browser applications » autorisé dans EmailJS. Sans clé : rien ne part,
// la panne est notée au journal, la liste WhatsApp reste dans l'espace 2.
const { messageMensualite } = require('../js/messages-mensualites.js');
const EMAILJS = { service_id: 'service_771y6u7', template_id: 'template_q3qpg4p', user_id: 'iRmm0sDj_w3MBx3SK' };  // = js/emailjs-config.js
async function relancesDuJour(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ error: 'Non autorisé.' });
  const jour = new Date().getUTCDate();  // (Abidjan : heure UTC)
  if (jour !== 3 && jour !== 5) return res.status(200).json({ ok: true, rien: 'pas un jour de relance' });
  try {
    const liste = await rpcService('mensualites_relances', { p_jour: jour });
    const cle = process.env.EMAILJS_PRIVATE_KEY;
    let envoyes = 0;
    for (const m of liste || []) {
      const msg = messageMensualite(m, jour === 3 ? 'relance3' : 'relance5', new Date());
      if (!cle || !msg.email) continue;
      const rep = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, EMAILJS, { accessToken: cle, template_params: { to_email: msg.email, to_name: msg.nom, message: msg.texte } }))
      }).catch(() => null);
      if (rep && rep.ok) envoyes++;
    }
    if ((liste || []).length && envoyes < liste.length) {
      await fetch(SUPABASE_URL + '/rest/v1/journal_erreurs', { method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ message: '[Mensualités] relance du ' + jour + ' : ' + envoyes + ' e-mail(s) envoyé(s) sur ' + liste.length + (cle ? '' : ' (clé EmailJS absente)'), page: '/api/portail', user_agent: 'serveur (relances)' }) }).catch(() => {});
    }
    return res.status(200).json({ ok: true, relances: (liste || []).length, envoyes });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return relancesDuJour(req, res);
  const debut = debutRequete(req, res, false);
  if (!debut) return;
  const { jeton, corps } = debut;
  const action = String(corps.action || '');
  // « Créer un compte admin » de l'ancien tableau de bord : code dans api/_creer-admin.js (le « _ »
  // le sort du compte des fonctions Vercel — l'offre gratuite en refuse une 12e en plus du
  // middleware, mises en ligne bloquées le 05/10 puis le 19/10/2026)
  if (action === 'creer_admin') return require('./_creer-admin.js')(req, res);
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
          const invite = await adminAuth('invite?redirect_to=' + encodeURIComponent(ADMINISTRATION + '/admin/'), 'POST', { email, data: { portail_invite: true, nom } });
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

    return res.status(400).json({ error: 'Action inconnue.' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
};
