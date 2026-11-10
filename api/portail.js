// Fonction serveur de l'Administration (cahier v2.3, mise à jour v2.4 du 19/10/2026).
// Une seule fonction pour plusieurs actions : l'offre gratuite de Vercel limite le nombre de
// fonctions à 12 (11 déjà utilisées). La clé secrète Supabase ne quitte jamais le serveur.
//
// Actions réservées à l'administrateur principal (code de double authentification récent) :
//   inviter, reinitialiser_mfa, acces ; compte d'une mannequin (10/11/2026) : mannequin_email,
//   mannequin_mdp_provisoire (et mannequin_compte, lecture de l'e-mail de connexion, sans code récent) ;
//   la mannequin elle-même : mdp_provisoire_changer (remplace le mot de passe provisoire)
// Actions de la personne connectée : codes_secours_creer (après activation de la double
//   authentification), code_secours_utiliser (téléphone perdu)
// (Les actions de l'inscription par code et des paiements viendront avec l'espace 2.)

const crypto = require('crypto');
const { SUPABASE_URL, enTetesService, verifierUtilisateur, extraireIp, debutRequete, chargeJeton, dernierCode, compteurTentatives, EMAIL_VALIDE, noterAuJournal, limiteDebit } = require('./_commun.js');

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

// Administratrice PRINCIPALE connectée, sur un appareil en règle (et, si codeExige, code de double authentification
// saisi il y a moins de 10 minutes). Répond elle-même le refus et renvoie null ; sinon { moi, auteur }.
// (10/11/2026 : partagée par les actions de l'équipe et celles des comptes des mannequins, au lieu d'être recopiée)
async function principaleVerifiee(req, jeton, res, codeExige) {
  const appareil = String(req.headers['x-appareil'] || '');
  const moi = jeton && /^[a-z0-9-]{16,64}$/.test(appareil) && await moiPortail(jeton, appareil);
  if (!moi || moi.role !== 'principal') { res.status(403).json({ error: 'Réservé à l’administrateur principal.' }); return null; }
  if (codeExige && !authRecente(jeton)) { res.status(403).json({ error: 'AUTH_RECENTE: confirmez votre code.' }); return null; }
  const auteur = await verifierUtilisateur(jeton);
  if (!auteur) { res.status(401).json({ error: 'Session expirée : reconnectez-vous.' }); return null; }
  return { moi, auteur };
}
// Journal des actions de l'Administration (audit_log, supabase-administration.sql) : qui, quoi, sur quel compte.
// Jamais de mot de passe dedans. Une panne du journal ne bloque pas l'action (elle a déjà eu lieu).
async function noterAction(acteurId, role, action, objetId, apres) {
  const nom = await fetch(SUPABASE_URL + '/rest/v1/staff_profiles?select=nom&user_id=eq.' + encodeURIComponent(acteurId), { headers: enTetesService() })
    .then((r) => (r.ok ? r.json() : [])).then((l) => (l[0] && l[0].nom) || null).catch(() => null);
  await fetch(SUPABASE_URL + '/rest/v1/audit_log', {
    method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ acteur: acteurId, acteur_nom: nom, acteur_role: role, action, objet: 'compte_mannequin', objet_id: objetId, apres: apres || null })
  }).catch(() => {});
}
// Mot de passe provisoire d'une mannequin : « MA2M-XXXX-XXXX », 8 signes tirés au hasard parmi 31 (chiffres et
// lettres sans 0/O ni 1/I/L), sans biais (tirage rejeté au-delà du dernier multiple de 31) : ~40 bits.
const SIGNES_PROVISOIRE = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function tirerSignes(n) {
  const sortie = [];
  while (sortie.length < n) {
    for (const o of crypto.randomBytes(n * 2)) {
      if (o < 256 - (256 % SIGNES_PROVISOIRE.length)) sortie.push(SIGNES_PROVISOIRE[o % SIGNES_PROVISOIRE.length]);
      if (sortie.length === n) break;
    }
  }
  return sortie.join('');
}
const MDP_PROVISOIRE = /^MA2M-[2-9A-Z]{4}-[2-9A-Z]{4}$/;
// Ferme TOUTES les sessions d'un compte (tous ses appareils) : connexion du serveur avec le mot de passe qu'il vient
// de poser, puis « déconnexion partout ». Renvoie true si c'est fait.
async function deconnecterPartout(email, motdepasse) {
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: { apikey: enTetesService().apikey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: motdepasse })
    });
    const s = await r.json().catch(() => ({}));
    if (!r.ok || !s.access_token) return false;
    const fin = await fetch(SUPABASE_URL + '/auth/v1/logout?scope=global', { method: 'POST', headers: { apikey: enTetesService().apikey, Authorization: 'Bearer ' + s.access_token } });
    return fin.ok;
  } catch (e) { return false; }
}

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
// Surveillance (lot 3, étape 5 de PLAN-SERVEUR.md, 01/11/2026) : chaque matin, les pannes du serveur des
// dernières 24 heures (lignes « serveur (…) » du journal des erreurs) sont regroupées et envoyées à l'agence
// en UN e-mail, seulement s'il y en a. Rien n'est envoyé un jour sans panne.
async function surveillanceDuJour(cle) {
  const depuis = new Date(Date.now() - 24 * 3600e3).toISOString();
  const rep = await fetch(SUPABASE_URL + '/rest/v1/journal_erreurs?user_agent=like.serveur*&created_at=gte.' + encodeURIComponent(depuis) +
    '&select=message,user_agent,created_at&order=created_at.desc&limit=200', { headers: enTetesService() });
  if (!rep.ok) throw new Error('journal illisible (' + rep.status + ')');
  const lignes = await rep.json();
  if (!Array.isArray(lignes) || !lignes.length) return 0;
  const parOrigine = new Map();
  for (const l of lignes) {
    const origine = String(l.user_agent || '').replace(/^serveur \(|\)$/g, '') || 'serveur';
    const g = parOrigine.get(origine) || { n: 0, dernier: l.message };
    g.n++; parOrigine.set(origine, g);
  }
  const resume = [...parOrigine].map(([o, g]) => '• ' + o + ' : ' + g.n + ' panne' + (g.n > 1 ? 's' : '') + ' (dernière : « ' + String(g.dernier).slice(0, 160) + ' »)');
  if (cle) {
    await envoyerEmailServeur(cle, EMAIL_AGENCE, 'Maître Akesse Model Management',
      '🛠️ Surveillance du site : ' + lignes.length + ' panne' + (lignes.length > 1 ? 's' : '') + ' du serveur ces dernières 24 heures.\n\n' + resume.join('\n') +
      '\n\nLe détail est dans l’Administration, rubrique « Journal des erreurs ». Si une panne se répète, transmettez cet e-mail à la personne qui s’occupe du site.');
  }
  return lignes.length;
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
  // (surveillance : jamais bloquante ; ses propres pannes partent seulement dans les journaux de Vercel)
  const pannes = await surveillanceDuJour(process.env.EMAILJS_PRIVATE_KEY).catch((e) => { console.error('surveillance :', e); return 0; });
  if (jour !== 3 && jour !== 5) return res.status(200).json({ ok: true, anniversaires, documents, pannes, rien: 'pas un jour de relance' });
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
    return res.status(200).json({ ok: true, anniversaires, documents, pannes, relances: (liste || []).length, envoyes });
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

// ---------- Formulaires publics (Extension 152, anti-robots, 01/11/2026) ----------
// Candidature, Contact, Demande d'un recruteur : le navigateur envoie la ligne et le jeton Cloudflare Turnstile ;
// le serveur vérifie le jeton (clé secrète TURNSTILE_SECRET_KEY, jamais dans le navigateur), puis enregistre par
// formulaire_public_enregistrer (mêmes limites qu'avant : par minute, par adresse, casting ouvert).
const TABLES_FORMULAIRES = ['casting_applications', 'messages_contact', 'recruiter_requests', 'cours_talons'];
// Renvoie { ok, raison } (raison : codes d'erreur de Cloudflare, ou ce que le navigateur a signalé)
async function jetonAntiRobotValide(jeton, ip, raisonNavigateur) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, raison: 'clé secrète TURNSTILE_SECRET_KEY absente du serveur' };
  if (typeof jeton !== 'string' || !jeton || jeton.length > 2048) return { ok: false, raison: 'pas de jeton (navigateur : ' + String(raisonNavigateur || 'inconnu').slice(0, 80) + ')' };
  const corps = new URLSearchParams({ secret: secret.trim(), response: jeton });
  if (ip) corps.set('remoteip', ip);
  const rep = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: corps });
  const r = await rep.json().catch(() => ({}));
  return r.success === true ? { ok: true } : { ok: false, raison: 'Cloudflare : ' + ((r['error-codes'] || []).join(', ') || 'réponse ' + rep.status) + (r.hostname ? ' (site ' + r.hostname + ')' : '') };
}
// (01/11/2026, 22 h : le premier vrai essai de la propriétaire a été refusé ; tant que la cause n'est pas connue,
// une vérification qui n'aboutit pas n'empêche PAS l'envoi : la raison exacte est notée au journal ; les limites
// d'envois par minute et par adresse de la base restent la protection. Repasser à true une fois la cause corrigée.)
const ANTI_ROBOTS_STRICT = false;
async function formulairePublic(req, corps, res) {
  const table = String(corps.table || ''), ligne = corps.ligne;
  if (!TABLES_FORMULAIRES.includes(table) || !ligne || typeof ligne !== 'object' || Array.isArray(ligne) || JSON.stringify(ligne).length > 30000) {
    return res.status(400).json({ error: 'Formulaire invalide.' });
  }
  const ip = extraireIp(req) || '';
  const verif = await jetonAntiRobotValide(corps.jeton, ip, corps.raisonJeton);
  if (!verif.ok) {
    await noterAuJournal('[Anti-robots] vérification non aboutie : ' + verif.raison + ' — ' + table + (ANTI_ROBOTS_STRICT ? ' (refusé)' : ' (accepté quand même)'), 'portail', '/api/portail').catch(() => {});
    if (ANTI_ROBOTS_STRICT) return res.status(403).json({ error: 'La vérification anti-robot n’a pas abouti : rechargez la page puis réessayez.', robot: true });
  }
  try {
    const id = await rpcService('formulaire_public_enregistrer', { p_table: table, p_ligne: ligne, p_ip: ip });
    return res.status(200).json({ ok: true, id });
  } catch (e) {
    const m = String((e && e.message) || e);
    if (/LIMITE_ATTEINTE/.test(m)) return res.status(429).json({ error: 'Beaucoup d’envois en ce moment.', limite: true });
    if (/duplicate key|23505/.test(m) && ligne.id) return res.status(200).json({ ok: true, id: ligne.id });  // (déjà enregistré : réponse perdue)
    if (/Aucun casting ouvert/.test(m)) return res.status(403).json({ error: 'Aucun casting n’est ouvert en ce moment.' });
    // (cours de talons : SQL de l'Extension 160 pas encore collé ; la page propose alors d'envoyer l'inscription par WhatsApp)
    if (table === 'cours_talons' && /Formulaire inconnu|PGRST202|Could not find the function|relation "(public\.)?cours_talons" does not exist/.test(m)) {
      await noterAuJournal('[Cours de talons] inscription reçue avant l’installation de supabase-cours-talons.sql (envoyée par WhatsApp)', 'portail', '/api/portail').catch(() => {});
      return res.status(503).json({ error: 'Inscriptions en ligne bientôt ouvertes.', pasPret: true });
    }
    // (SQL de l'Extension 152 pas encore collé : la fonction n'existe pas ; l'envoi passe quand même, comme avant,
    // pour que la mise en ligne du code avant le SQL ne bloque jamais les candidats)
    if (/Could not find the function|PGRST202|does not exist/.test(m)) {
      const propre = Object.assign({}, ligne); delete propre.status;
      const rep = await fetch(SUPABASE_URL + '/rest/v1/' + table, { method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(propre) });
      if (rep.ok || (rep.status === 409 && ligne.id)) return res.status(200).json({ ok: true, id: ligne.id || null });
      await noterAuJournal('[Formulaire ' + table + '] envoi de secours refusé (' + rep.status + ')', 'portail', '/api/portail').catch(() => {});
      return res.status(500).json({ error: 'Envoi impossible pour le moment, réessayez.' });
    }
    await noterAuJournal('[Formulaire ' + table + '] ' + m, 'portail', '/api/portail').catch(() => {});
    return res.status(500).json({ error: 'Envoi impossible pour le moment, réessayez.' });
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
    if (action === 'formulaire') return await formulairePublic(req, corps, res);
    // ---------- administrateur principal ----------
    if (['inviter', 'reinitialiser_mfa', 'acces'].includes(action)) {
      const garde = await principaleVerifiee(req, jeton, res, true);
      if (!garde) return;
      const { auteur } = garde;

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

    // ---------- compte de connexion d'une mannequin (10/11/2026, demande de la propriétaire) ----------
    // Mannequin qui a perdu l'accès à son e-mail, ou oublié son mot de passe : l'administratrice PRINCIPALE seule (code
    // de double authentification récent pour changer quoi que ce soit) lit l'e-mail de connexion, le remplace, ou pose
    // un mot de passe provisoire. Le provisoire est marqué (mdp_provisoire) : à sa connexion, l'Espace mannequin oblige
    // à choisir un nouveau mot de passe (js/espace-mannequin.js). Jamais sur un compte de l'équipe. Noté au journal.
    if (['mannequin_compte', 'mannequin_email', 'mannequin_mdp_provisoire'].includes(action)) {
      const garde = await principaleVerifiee(req, jeton, res, action !== 'mannequin_compte');
      if (!garde) return;
      const { auteur } = garde;
      const cible = String(corps.model_id || '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cible) || cible === auteur.id) return res.status(400).json({ error: 'Compte invalide.' });
      const lire = async (chemin) => {
        const r = await fetch(SUPABASE_URL + '/rest/v1/' + chemin, { headers: enTetesService() });
        if (!r.ok) throw new Error('Vérification impossible pour le moment.');
        return r.json();
      };
      const [mannequin, equipe, admin] = await Promise.all([lire('model_profiles?select=id&id=eq.' + cible), lire('staff_profiles?select=user_id&user_id=eq.' + cible), lire('admins?select=user_id&user_id=eq.' + cible)]);
      if (!mannequin.length || equipe.length || admin.length) return res.status(400).json({ error: 'Ce compte n’est pas celui d’une mannequin.' });
      const compte = await adminAuth('admin/users/' + cible, 'GET');
      if (action === 'mannequin_compte') return res.status(200).json({ email: compte.email || '', provisoire: !!(compte.app_metadata && compte.app_metadata.mdp_provisoire) });
      if (action === 'mannequin_email') {
        const email = String(corps.email || '').trim().toLowerCase();
        if (!EMAIL_VALIDE.test(email) || email.length > 200) return res.status(400).json({ error: 'Adresse e-mail invalide.' });
        if (email === String(compte.email || '').toLowerCase()) return res.status(400).json({ error: 'C’est déjà son adresse de connexion.' });
        const deja = await rpcService('portail_utilisateur_par_email', { p_email: email });
        if (deja && deja !== cible) return res.status(400).json({ error: 'Cette adresse est déjà utilisée par un autre compte.' });
        await adminAuth('admin/users/' + cible, 'PUT', { email, email_confirm: true });
        await noterAction(auteur.id, 'principal', 'E-mail de connexion d’une mannequin changé', cible, { avant: compte.email || null, apres: email });
        return res.status(200).json({ ok: true, email });
      }
      // mot de passe provisoire : marqué dans app_metadata (que seul le serveur peut écrire) ; toutes les sessions du
      // compte sont fermées (un appareil volé ou resté connecté ne garde pas l'accès)
      const motdepasse = 'MA2M-' + tirerSignes(4) + '-' + tirerSignes(4);
      await adminAuth('admin/users/' + cible, 'PUT', { password: motdepasse, app_metadata: { mdp_provisoire: true } });
      const deconnecte = compte.email ? await deconnecterPartout(compte.email, motdepasse) : false;
      await noterAction(auteur.id, 'principal', 'Mot de passe provisoire d’une mannequin créé', cible, { deconnectee_partout: deconnecte });
      return res.status(200).json({ ok: true, motdepasse, deconnecte });
    }
    // ---------- la mannequin remplace son mot de passe provisoire (10/11/2026) ----------
    // Par le serveur seulement : la marque « provisoire » (app_metadata) ne s'efface qu'ici, avec le nouveau mot de passe.
    if (action === 'mdp_provisoire_changer') {
      const u = jeton && await verifierUtilisateur(jeton);
      if (!u) return res.status(401).json({ error: 'Session expirée : reconnectez-vous.' });
      if (await limiteDebit(res, 'mdp-provisoire', u.id, 10)) return;
      if (!(u.app_metadata && u.app_metadata.mdp_provisoire)) return res.status(400).json({ error: 'Aucun mot de passe provisoire à remplacer.' });
      const motdepasse = String(corps.motdepasse || '');
      if (motdepasse.length < 8 || motdepasse.length > 72) return res.status(400).json({ error: 'Le mot de passe doit contenir entre 8 et 72 caractères.' });
      if (MDP_PROVISOIRE.test(motdepasse.trim().toUpperCase())) return res.status(400).json({ error: 'Choisissez un mot de passe à vous, différent du mot de passe provisoire.' });
      await adminAuth('admin/users/' + u.id, 'PUT', { password: motdepasse, app_metadata: { mdp_provisoire: false } });
      await noterAction(u.id, 'mannequin', 'Mot de passe provisoire remplacé par la mannequin', u.id, null);
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
