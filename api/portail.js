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
const { SUPABASE_URL, enTetesService, verifierUtilisateur, extraireIp, debutRequete, chargeJeton, dernierCode, compteurTentatives, EMAIL_VALIDE } = require('./_commun.js');

// adresse séparée de l'Administration (v2.4) : le lien d'invitation y mène
const ADMINISTRATION = 'https://admin.maitreakessemodelmanagement.com';
// Retour des liens d'invitation : la base (Supabase, « Redirect URLs ») n'accepte que les adresses
// du site principal ; www…/admin/ renvoie aussitôt vers l'Administration en gardant la clé de
// session (le « # » du lien). Sans cela, l'invité arrivait sur l'accueil du site public (21/10/2026).
const RETOUR_ADMINISTRATION = 'https://www.maitreakessemodelmanagement.com/admin/';
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
// 19/10/2026) : appelées par la tâche planifiée de Vercel (vercel.json, « crons » ; réglage Vercel
// CRON_SECRET obligatoire). Seulement les personnes appelées le 1er et pas encore payées, une seule
// fois chacune (marquées après l'envoi réussi).
// E-mail envoyé par EmailJS depuis le serveur : clé privée EMAILJS_PRIVATE_KEY (réglage Vercel),
// et « API calls for non-browser applications » autorisé dans EmailJS. Sans clé : rien ne part,
// la panne est notée au journal, la liste WhatsApp reste dans l'espace 2.
const { messageMensualite } = require('../js/messages-mensualites.js');
const { messageConvocation, EMAIL_AGENCE } = require('../js/messages-convocations.js');
const { messageAnniversaire } = require('../js/messages-anniversaire.js');
const EMAILJS = { service_id: 'service_771y6u7', template_id: 'template_q3qpg4p', user_id: 'iRmm0sDj_w3MBx3SK' };  // = js/emailjs-config.js
// Un e-mail envoyé par EmailJS depuis le serveur (clé privée) ; vrai s'il est parti.
async function envoyerEmailServeur(cle, email, nom, message) {
  const rep = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({}, EMAILJS, { accessToken: cle, template_params: { to_email: email, to_name: nom, message } }))
  }).catch(() => null);
  return { ok: !!(rep && rep.ok), statut: rep ? rep.status : 0 };
}
async function noterAuJournal(message, origine) {
  await fetch(SUPABASE_URL + '/rest/v1/journal_erreurs', { method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ message, page: '/api/portail', user_agent: 'serveur (' + origine + ')' }) }).catch(() => {});
}
// Anniversaires du jour (Extension 143, chantier 14, 01/11/2026) : noté d'abord (une seule fois par an ;
// le message arrive dans l'application et sur le téléphone), puis l'e-mail (au parent pour une mineure) ;
// l'agence reçoit le récapitulatif avec les messages WhatsApp déjà écrits (pas d'envoi WhatsApp automatique).
async function anniversairesDuJour(cle) {
  const liste = await rpcService('anniversaires_du_jour', {});
  const faits = [];
  for (const m of Array.isArray(liste) ? liste : []) {
    const msg = messageAnniversaire(m);
    const noter = (ok) => rpcService('anniversaire_noter', { p_mannequin: m.id, p_titre: msg.titre, p_texte: msg.application, p_email_ok: ok });
    // (noté AVANT l'e-mail : jamais deux fois ; une panne ici est notée au journal, l'anniversaire n'est pas perdu sans trace)
    const nouveau = await noter(null).catch(async (e) => { await noterAuJournal('[Anniversaires] ' + msg.nom + ' : non noté (' + ((e && e.message) || e) + ')', 'anniversaires'); return false; });
    if (nouveau !== true) continue;
    const email = cle && msg.email.adresse ? (await envoyerEmailServeur(cle, msg.email.adresse, msg.email.nom, msg.email.texte)).ok : false;
    await noter(email).catch(() => {});  // (e-mail parti ou non, gardé dans la base)
    faits.push({ msg, email });
  }
  if (faits.length && cle) {
    const lignes = faits.map(({ msg, email }) => '• ' + msg.nom + (msg.age ? ' (' + msg.age + ' ans)' : '') + (msg.mineur ? ', message à son parent' : '') +
      ' : e-mail ' + (email ? 'envoyé ✓' : msg.email.adresse ? 'NON parti' : 'impossible (pas d’adresse)') +
      (msg.whatsapp.numero ? '\n  WhatsApp prêt : https://wa.me/' + msg.whatsapp.numero + '?text=' + encodeURIComponent(msg.whatsapp.texte) : '\n  (pas de numéro WhatsApp)'));
    await envoyerEmailServeur(cle, EMAIL_AGENCE, 'Maître Akesse Model Management',
      '🎂 Anniversaires du jour :\n\n' + lignes.join('\n\n') + '\n\nLe message est aussi arrivé dans leur application MA2M Mannequin.');
  }
  if (faits.some((f) => !f.email)) await noterAuJournal('[Anniversaires] ' + faits.filter((f) => !f.email).length + ' e-mail(s) non parti(s) sur ' + faits.length + (cle ? '' : ' (clé EmailJS absente)'), 'anniversaires');
  return faits.length;
}
// Documents des mannequins qui expirent (Extension 147, chantier 14, 01/11/2026) : la base choisit et note les
// alertes du jour (30 jours avant la fin, puis le jour de la fin ; une seule fois chacune) ; l'agence reçoit un
// seul e-mail récapitulatif. Si l'e-mail ne part pas, la panne est notée au journal (la liste « Documents des
// mannequins » de l'Administration montre toujours les urgences en rouge et orange).
const { nomSorte, dateFr } = require('../js/documents-communs.js');
function messageDocuments(liste) {
  const ligne = (d) => '• ' + d.nom + ' : ' + nomSorte(d.sorte) + (d.libelle ? ' (' + d.libelle + ')' : '') + ', fin le ' + dateFr(d.expire_le);
  const expires = liste.filter((d) => d.quoi === 'expire'), bientot = liste.filter((d) => d.quoi !== 'expire');
  return '📄 Documents des mannequins à renouveler :\n' +
    (expires.length ? '\nEXPIRÉS :\n' + expires.map(ligne).join('\n') + '\n' : '') +
    (bientot.length ? '\nExpirent dans moins de 30 jours :\n' + bientot.map(ligne).join('\n') + '\n' : '') +
    '\nOuvrez l’Administration (https://admin.maitreakessemodelmanagement.com/admin/), espace « Administration du site », rubrique « Documents des mannequins », pour noter la nouvelle date une fois le document renouvelé.';
}
async function documentsDuJour(cle) {
  const liste = await rpcService('documents_alertes_du_jour', {});
  if (!Array.isArray(liste) || !liste.length) return 0;
  const ok = cle ? (await envoyerEmailServeur(cle, EMAIL_AGENCE, 'Maître Akesse Model Management', messageDocuments(liste))).ok : false;
  if (!ok) await noterAuJournal('[Documents] alerte de ' + liste.length + ' document(s) non partie' + (cle ? '' : ' (clé EmailJS absente)'), 'documents');
  return liste.length;
}
// Tâche quotidienne (vercel.json, 8 h à Abidjan) : anniversaires et documents chaque jour, relances des mensualités le 3 et le 5
async function relancesDuJour(req, res) {
  // seule la tâche planifiée de Vercel (variable CRON_SECRET, envoyée par Vercel) peut les lancer
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ error: 'Non autorisé.' });
  const jour = new Date().getUTCDate();  // (Abidjan : heure UTC)
  // (une panne des anniversaires n'empêche jamais les relances)
  const anniversaires = await anniversairesDuJour(process.env.EMAILJS_PRIVATE_KEY).catch(async (e) => { await noterAuJournal('[Anniversaires] ' + ((e && e.message) || e), 'anniversaires'); return 0; });
  const documents = await documentsDuJour(process.env.EMAILJS_PRIVATE_KEY).catch(async (e) => { await noterAuJournal('[Documents] ' + ((e && e.message) || e), 'documents'); return 0; });
  if (jour !== 3 && jour !== 5) return res.status(200).json({ ok: true, anniversaires, documents, rien: 'pas un jour de relance' });
  try {
    const liste = await rpcService('mensualites_relances', { p_jour: jour });
    const cle = process.env.EMAILJS_PRIVATE_KEY;
    let envoyes = 0;
    for (const m of liste || []) {
      const msg = messageMensualite(m, jour === 3 ? 'relance3' : 'relance5', new Date());
      if (!cle || !msg.email) continue;
      // marquée « relancée » seulement si l'e-mail est parti (sinon la liste WhatsApp la montre encore)
      if ((await envoyerEmailServeur(cle, msg.email, msg.nom, msg.texte)).ok) { envoyes++; await rpcService('mensualites_relance_faite', { p_jour: jour, p_mannequin: m.id }).catch(() => {}); }
    }
    if ((liste || []).length && envoyes < liste.length) {
      await noterAuJournal('[Mensualités] relance du ' + jour + ' : ' + envoyes + ' e-mail(s) envoyé(s) sur ' + liste.length + (cle ? '' : ' (clé EmailJS absente)'), 'relances');
    }
    return res.status(200).json({ ok: true, anniversaires, documents, relances: (liste || []).length, envoyes });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

// Convocations programmées (Extension 141, 21/10/2026) : la base appelle cette adresse toutes les
// 5 minutes quand des envois sont arrivés à l'heure (pg_cron + pg_net, convocations_reveil), avec
// une clé tirée au hasard dans la base et vérifiée par la base. Les e-mails partent ici ; les
// WhatsApp (pas encore d'envoi automatique) passent « à faire » dans le tableau de bord et
// l'agence reçoit un e-mail pour les envoyer.
async function envoisConvocations(req, res) {
  const cleAppel = String(req.headers['x-cle-convocations'] || '');
  const valide = cleAppel.length >= 32 && await rpcService('convocations_cle_valide', { p_cle: cleAppel }).catch(() => false);
  if (valide !== true) return res.status(401).json({ error: 'Non autorisé.' });
  try {
    const dus = await rpcService('convocations_a_traiter', {});
    const cle = process.env.EMAILJS_PRIVATE_KEY;
    let envoyes = 0, echecs = 0;
    const aFaire = {};  // WhatsApp / SMS arrivés à l'heure, par projet
    for (const e of dus || []) {
      const p = e.participant || {}, projet = e.projet || {};
      if (e.canal !== 'email') {
        const t = aFaire[projet.id] = aFaire[projet.id] || { titre: projet.titre, date: projet.date_debut, n: 0 };
        t.n++;
        continue;
      }
      let resultat = { ok: false, statut: 0 }, erreur = null;
      if (!cle) erreur = 'Clé EmailJS absente du serveur (réglage Vercel EMAILJS_PRIVATE_KEY).';
      else if (!p.email) erreur = 'Pas d’adresse e-mail.';
      else {
        resultat = await envoyerEmailServeur(cle, p.email, p.parent ? p.parent_nom || p.nom : p.nom, messageConvocation(projet, p, e.sorte).email);
        if (!resultat.ok) erreur = 'EmailJS a refusé l’envoi (' + resultat.statut + ').';
      }
      await rpcService('convocations_resultat', { p_id: e.id, p_ok: resultat.ok, p_erreur: erreur }).catch(() => {});
      if (resultat.ok) envoyes++; else echecs++;
    }
    const projets = Object.values(aFaire);
    if (projets.length && cle) {
      const lignes = projets.map((t) => '• « ' + t.titre + ' » (' + t.date + ') : ' + t.n + ' message(s)');
      await envoyerEmailServeur(cle, EMAIL_AGENCE, 'Maître Akesse Model Management',
        'C’est l’heure d’envoyer les messages WhatsApp programmés :\n' + lignes.join('\n') +
        '\n\nOuvrez l’Administration (https://admin.maitreakessemodelmanagement.com/admin/), espace « Administration du site », « Contenu du site » → « Agenda du site », bouton « Convoquer » du projet : les messages sont prêts, un bouton par personne.');
    }
    if (echecs) await noterAuJournal('[Convocations] ' + echecs + ' e-mail(s) non envoyé(s) sur ' + (envoyes + echecs) + (cle ? '' : ' (clé EmailJS absente)'), 'convocations');
    return res.status(200).json({ ok: true, envoyes, echecs, whatsapp: projets.reduce((n, t) => n + t.n, 0) });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

async function demandeAcces(corps, res) {
  const nom = String(corps.nom || '').trim().slice(0, 80), email = String(corps.email || '').trim().toLowerCase();
  const telephone = String(corps.telephone || '').trim().slice(0, 20), motdepasse = String(corps.motdepasse || '');
  if (nom.length < 2 || !EMAIL_VALIDE.test(email)) return res.status(400).json({ error: 'Nom et e-mail obligatoires.' });
  if (telephone && !/^[0-9+ ]{6,20}$/.test(telephone)) return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
  if (motdepasse.length < 12) return res.status(400).json({ error: 'Mot de passe : 12 caractères au moins.' });
  const depuis = new Date(Date.now() - 3600e3).toISOString();
  const recentes = await fetch(SUPABASE_URL + '/rest/v1/staff_demandes?select=id&cree_le=gte.' + encodeURIComponent(depuis), { headers: enTetesService() });
  if (!recentes.ok) return res.status(503).json({ error: 'Création de compte pas encore activée : réessayez plus tard.' });
  if ((await recentes.json()).length >= 10) return res.status(429).json({ error: 'Trop de demandes en ce moment : réessayez dans une heure.' });
  if (await rpcService('portail_utilisateur_par_email', { p_email: email })) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse : connectez-vous, ou contactez l’agence.' });
  }
  const compte = await adminAuth('admin/users', 'POST', { email, password: motdepasse, email_confirm: true, user_metadata: { nom, portail_demande: true, portail_mdp_choisi: true } });
  const note = await fetch(SUPABASE_URL + '/rest/v1/staff_demandes', {
    method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: compte.id, nom, email, telephone: telephone || null })
  });
  if (!note.ok) {
    // (demande non notée : le compte créé est retiré, la personne peut réessayer)
    await adminAuth('admin/users/' + compte.id, 'DELETE').catch(() => {});
    return res.status(500).json({ error: 'Demande non enregistrée : réessayez dans un instant.' });
  }
  // l'administratrice principale est prévenue (e-mail du serveur, comme les autres alertes)
  const principale = await fetch(SUPABASE_URL + '/rest/v1/staff_profiles?select=email,nom&role=eq.principal', { headers: enTetesService() }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const cle = process.env.EMAILJS_PRIVATE_KEY, destinataire = (principale[0] && principale[0].email) || EMAIL_AGENCE;
  const envoi = cle ? await envoyerEmailServeur(cle, destinataire, (principale[0] && principale[0].nom) || 'Maître Akesse Model Management',
    '🔑 Nouvelle demande d’accès à l’Administration\n\nNom : ' + nom + '\nE-mail : ' + email + (telephone ? '\nTéléphone : ' + telephone : '') +
    '\n\nCette personne n’a encore AUCUN accès. Pour l’accepter (et choisir son rôle) ou la refuser : Administration (https://admin.maitreakessemodelmanagement.com/admin/), Sécurité › Comptes et rôles.') : { ok: false };
  if (!envoi.ok) await noterAuJournal('[Demande d’accès] alerte non partie pour ' + email + (cle ? '' : ' (clé EmailJS absente)'), 'demandes');
  return res.status(200).json({ ok: true });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET' && req.query && req.query.tache === 'convocations') return envoisConvocations(req, res);
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
    // ---------- « Créer mon compte » de l'équipe (Extension 150, 01/11/2026) : sans compte, sans e-mail à recevoir ----------
    // Le compte est créé tout de suite (mot de passe choisi par la personne, aucun lien à ouvrir), mais il
    // n'a AUCUN accès tant que l'administratrice principale n'a pas accepté (staff_demandes ; la base refuse
    // tout le reste). Elle est prévenue par e-mail. 10 demandes en attente au plus par heure (contre les robots).
    if (action === 'demande_acces') return await demandeAcces(corps, res);
    // ---------- administrateur principal ----------
    if (['inviter', 'reinitialiser_mfa', 'acces'].includes(action)) {
      const appareil = String(req.headers['x-appareil'] || '');
      const moi = jeton && /^[a-z0-9-]{16,64}$/.test(appareil) && await moiPortail(jeton, appareil);
      if (!moi || moi.role !== 'principal') return res.status(403).json({ error: 'Réservé à l’administrateur principal.' });
      if (!authRecente(jeton)) return res.status(403).json({ error: 'AUTH_RECENTE: confirmez votre code.' });
      const auteur = await verifierUtilisateur(jeton);

      if (action === 'inviter') {
        const email = String(corps.email || '').trim().toLowerCase(), nom = String(corps.nom || '').trim(), role = String(corps.role || '');
        if (!EMAIL_VALIDE.test(email) || !nom || !ROLES.includes(role)) return res.status(400).json({ error: 'Nom, e-mail et rôle obligatoires.' });
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
          const invite = await adminAuth('invite?redirect_to=' + encodeURIComponent(RETOUR_ADMINISTRATION), 'POST', { email, data: { portail_invite: true, nom } });
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
