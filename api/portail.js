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
async function noterAction(req, acteurId, role, action, objetId, avant, apres) {
  const nom = await fetch(SUPABASE_URL + '/rest/v1/staff_profiles?select=nom&user_id=eq.' + encodeURIComponent(acteurId), { headers: enTetesService() })
    .then((r) => (r.ok ? r.json() : [])).then((l) => (l[0] && l[0].nom) || null).catch(() => null);
  await fetch(SUPABASE_URL + '/rest/v1/audit_log', {
    method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ acteur: acteurId, acteur_nom: nom, acteur_role: role, action, objet: 'compte_mannequin', objet_id: objetId, avant: avant || null, apres: apres || null, ip: extraireIp(req) || null })
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
// (même forme que estFormeMdpProvisoire, js/supabase-config.js, côté navigateur)
const MDP_PROVISOIRE = /^MA2M-[2-9A-Z]{4}-[2-9A-Z]{4}$/;
// Ferme TOUTES les sessions d'un compte (tous ses appareils) : connexion du serveur avec le mot de passe qu'il vient
// de poser, puis « déconnexion partout » (plus aucun appareil ne peut renouveler sa session ; un jeton déjà délivré
// reste valable jusqu'à son expiration, une heure au plus). Renvoie true si c'est fait.
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
  // (16/11/2026, L-17) photos des candidatures et des cours de talons que plus aucune fiche ne cite (api/_r2.js).
  // (relecture du superviseur, 22 h 30) lancé APRÈS les relances des mensualités : un long nettoyage ne doit jamais
  // leur prendre le temps permis à la tâche.
  // (jamais en échec : une panne du nettoyage, ou de sa note au journal, ne fait jamais tomber la tâche)
  let nettoye = null;
  const nettoyer = () => nettoye || (nettoye = require('./_r2.js').nettoyerPhotosNonCitees()
    .catch(async (e) => { await noterAuJournal('[Photos des candidatures] nettoyage : ' + ((e && e.message) || e), 'r2').catch(() => {}); return 0; }));
  if (jour !== 3 && jour !== 5) return res.status(200).json({ ok: true, anniversaires, documents, pannes, photosNettoyees: await nettoyer(), rien: 'pas un jour de relance' });
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
    return res.status(200).json({ ok: true, anniversaires, documents, pannes, photosNettoyees: await nettoyer(), relances: (liste || []).length, envoyes });
  } catch (e) {
    await nettoyer();
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
// Renvoie { ok, raison, panne } (raison : codes d'erreur de Cloudflare, ou ce que le navigateur a signalé).
// panne = true quand le défaut vient de NOTRE côté ou de Cloudflare (clé absente du serveur, Cloudflare injoignable
// ou en erreur) : ce n'est pas la faute du visiteur, l'envoi passe quand même (et c'est noté au journal).
async function jetonAntiRobotValide(jeton, ip, raisonNavigateur) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, panne: true, raison: 'clé secrète TURNSTILE_SECRET_KEY absente du serveur' };
  // (17/11/2026, décision de la propriétaire) pas de jeton = le téléphone n'a pas pu charger la vérification de
  // Cloudflare (une vraie candidate bloquée le 17/11 à 8 h 19) : traité comme une panne, l'envoi passe (noté au
  // journal). Un jeton REFUSÉ par Cloudflare reste refusé ; les limites d'envoi par adresse restent.
  if (typeof jeton !== 'string' || !jeton) return { ok: false, panne: true, raison: 'pas de jeton (navigateur : ' + String(raisonNavigateur || 'inconnu').slice(0, 80) + ')' };
  if (jeton.length > 2048) return { ok: false, raison: 'jeton trop long' };
  const corps = new URLSearchParams({ secret: secret.trim(), response: jeton });
  if (ip) corps.set('remoteip', ip);
  let rep;
  try { rep = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: corps }); }
  catch (e) { return { ok: false, panne: true, raison: 'Cloudflare injoignable (' + ((e && e.message) || e) + ')' }; }
  if (!rep.ok) return { ok: false, panne: true, raison: 'Cloudflare : réponse ' + rep.status };
  const r = await rep.json().catch(() => ({}));
  if (r.success === true) return { ok: true };
  const codes = r['error-codes'] || [];
  // (« internal-error » : panne de Cloudflare ; « invalid-input-secret » : notre clé, pas le visiteur)
  const panne = codes.some((c) => c === 'internal-error' || c === 'invalid-input-secret' || c === 'missing-input-secret');
  return { ok: false, panne, raison: 'Cloudflare : ' + (codes.join(', ') || 'réponse ' + rep.status) + (r.hostname ? ' (site ' + r.hostname + ')' : '') };
}
// (01/11/2026, 22 h : le premier vrai essai de la propriétaire avait été refusé ; on avait alors tout laissé passer.)
// (16/11/2026, audit L-7 = B-P5 / A-07) : mode strict. Un envoi avec un jeton refusé par Cloudflare est refusé (sans
// jeton : accepté depuis le 17/11, voir jetonAntiRobotValide) ; la page redemande alors un jeton une fois, toute seule (js/app.js, envoyerFormulairePublic). Une panne de
// notre côté ou de Cloudflare (voir « panne » ci-dessus) ne bloque jamais un candidat. Remettre false si le journal
// montre de vrais visiteurs refusés (« [Anti-robots] … (refusé) »).
const ANTI_ROBOTS_STRICT = true;
// (16/11/2026, audit L-7 = A-08) : liste blanche des colonnes que chaque formulaire public peut remplir. Tout le reste
// (statut, dates, notes de l'agence, montant…) est retiré AVANT la base : un envoi fabriqué ne peut plus remplir une
// colonne interne, même ajoutée plus tard. À compléter quand une page envoie un nouveau champ (sinon il est ignoré).
const COLONNES_FORMULAIRES = {
  // (22/11/2026, minimisation ARTCI, décision de la propriétaire) plus de quartier, de date de naissance, de situation
  // scolaire ni de niveau d'études depuis les formulaires publics : « mineur » (18 ans ou plus / moins de 18 ans) à la place
  casting_applications: ['id', 'full_name', 'email', 'phone', 'city', 'mineur', 'genre', 'civilite',
    'height_cm', 'shoe_size', 'weight_kg', 'chest_cm', 'waist_cm', 'hips_cm', 'message', 'parent_nom', 'parent_telephone',
    'parent_email', 'type_candidature', 'projet_nom', 'experience_mannequin', 'clothing_size'],
  messages_contact: ['id', 'nom', 'telephone', 'email', 'type_contact', 'structure', 'ville', 'message'],
  recruiter_requests: ['id', 'company', 'contact_name', 'email', 'phone', 'whatsapp', 'city', 'project_type', 'event_date', 'message'],
  // (ARTCI) « mineure » au lieu de l'âge ; « age » reste accepté pour une ancienne page gardée par un téléphone
  cours_talons: ['id', 'formule', 'nb_seances', 'nb_mois', 'paiement', 'civilite', 'parcours', 'modules', 'nom', 'telephone', 'age', 'mineure',
    'objectif', 'concours', 'concours_date', 'niveau', 'creneaux', 'choix_creneaux', 'disponibilites', 'adresse',
    'parent_nom', 'parent_telephone', 'photos', 'video', 'decision', 'reference_wave', 'moyen']
};
// (23/11/2026, conformité ARTCI, accord de la propriétaire) preuve du consentement : chaque formulaire public exige la case
// « J'ai pris connaissance de la politique de confidentialité » ; le serveur enregistre la VERSION de la politique en vigueur
// (jamais celle envoyée par la page), et la base ajoute la date (déclencheur, supabase-conformite-consentement-traces.sql).
// À changer en même temps que la date affichée en bas de politique-confidentialite.html (FR et EN).
const POLITIQUE_VERSION = '2026-11-25';  // (25/11/2026 : refonte MA2M Academy / Agence de représentation)
function garderColonnesAutorisees(table, ligne) {
  const propre = {};
  for (const c of COLONNES_FORMULAIRES[table] || []) if (Object.prototype.hasOwnProperty.call(ligne, c)) propre[c] = ligne[c];
  // (22/11/2026, minimisation ARTCI) page ouverte avant la mise en ligne : elle envoie encore une date de naissance et pas
  // « mineur ». On en déduit « mineur », puis la date n'est pas enregistrée (elle n'est plus dans la liste ci-dessus).
  if (table === 'casting_applications' && !('mineur' in propre) && typeof ligne.date_naissance === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ligne.date_naissance)) {
    const n = new Date(ligne.date_naissance + 'T12:00:00Z'), a = new Date();
    let age = a.getUTCFullYear() - n.getUTCFullYear();
    if (a.getUTCMonth() < n.getUTCMonth() || (a.getUTCMonth() === n.getUTCMonth() && a.getUTCDate() < n.getUTCDate())) age--;
    propre.mineur = age < 18;
  }
  // (16/11/2026, B-V4) : « direct » est réservé aux dossiers créés par l'agence elle-même (casting à l'agence, sans
  // photo) ; un visiteur n'envoie que « agence » (intégrer l'agence) ou « projet » (un casting).
  if (table === 'casting_applications' && 'type_candidature' in propre && !['agence', 'projet', null].includes(propre.type_candidature)) return null;
  return propre;
}
// (16/11/2026, audit R-09) : une demande de booking n'arrive JAMAIS sans sa liste de mannequins. La page envoie la liste
// avec la demande (ligne._modeles) ; le serveur enregistre la demande PUIS la liste ; si la liste ne passe pas, la
// demande est retirée et le recruteur voit une erreur (au lieu d'un « Merci » trompeur).
const UUID_MANNEQUIN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function modelesDeLaDemande(recu) {
  const l = recu && recu._modeles;
  if (!Array.isArray(l) || !l.length || l.length > 60) return null;
  const propres = [];
  for (const m of l) {
    if (!m || typeof m !== 'object' || !UUID_MANNEQUIN.test(String(m.model_id || ''))) return null;
    const h = Number(m.model_height_snapshot);
    propres.push({ model_id: String(m.model_id).toLowerCase(),model_name_snapshot: String(m.model_name_snapshot || '').slice(0, 120) || null,
      model_height_snapshot: Number.isInteger(h) && h > 0 && h < 260 ? h : null });
  }
  return propres;
}
async function enregistrerModelesDemande(idDemande, modeles) {
  const base = SUPABASE_URL + '/rest/v1/recruiter_request_models';
  const rep = await fetch(base, { method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(modeles.map((m) => Object.assign({ request_id: idDemande }, m))) });
  return rep.ok;
}
// Ensemble des identifiants (déjà vérifiés : UUID_MANNEQUIN) qui existent encore dans model_profiles ; null si la base ne répond pas.
async function mannequinsExistants(ids) {
  const rep = await fetch(SUPABASE_URL + '/rest/v1/model_profiles?select=id&id=in.(' + ids.join(',') + ')', { headers: enTetesService() });
  if (!rep.ok) return null;
  return new Set((await rep.json()).map((x) => x.id));
}
async function retirerDemande(idDemande) {
  await fetch(SUPABASE_URL + '/rest/v1/recruiter_requests?id=eq.' + encodeURIComponent(idDemande), { method: 'DELETE', headers: { ...enTetesService(), Prefer: 'return=minimal' } }).catch(() => {});
}
// La liste des mannequins d'une demande enregistrée ; échec → la demande est retirée (sauf si elle existait déjà avant
// cet envoi : on ne retire jamais une demande complète reçue plus tôt), et le recruteur est prévenu.
async function finirDemande(res, idDemande, modeles, dejaLa) {
  if (dejaLa) {   // (envoi recommencé : si la liste est déjà là, on n'y touche pas)
    const deja = await fetch(SUPABASE_URL + '/rest/v1/recruiter_request_models?select=request_id&limit=1&request_id=eq.' + encodeURIComponent(idDemande), { headers: enTetesService() })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (Array.isArray(deja) && deja.length) return res.status(200).json({ ok: true, id: idDemande });
  }
  if (await enregistrerModelesDemande(idDemande, modeles).catch(() => false)) return res.status(200).json({ ok: true, id: idDemande });
  if (!dejaLa) await retirerDemande(idDemande);
  // (16/11/2026, relecture du superviseur) la sélection vient du téléphone du recruteur : une mannequin supprimée depuis
  // y reste et fait refuser toute la liste (clé étrangère), à chaque essai. Le serveur dit alors LESQUELLES n'existent
  // plus ; la page les retire de la sélection et le recruteur renvoie une demande juste (e-mail compris).
  const encore = await mannequinsExistants(modeles.map((m) => m.model_id)).catch(() => null);
  const retires = encore ? modeles.filter((m) => !encore.has(m.model_id)).map((m) => m.model_id) : [];
  if (retires.length) {
    await noterAuJournal('[Demande recruteur] demande ' + idDemande + ' : ' + retires.length + ' mannequin(s) de la sélection n’existent plus (' + retires.join(', ') + ')' + (dejaLa ? '' : ' : demande retirée, le recruteur les retire et renvoie'), 'portail', '/api/portail').catch(() => {});
    return res.status(409).json({ error: 'Certains mannequins de votre sélection ne sont plus disponibles.', selection: true, retires });
  }
  await noterAuJournal('[Demande recruteur] liste des ' + modeles.length + ' mannequin(s) non enregistrée' + (dejaLa ? '' : ' : demande retirée, le recruteur a vu une erreur'), 'portail', '/api/portail').catch(() => {});
  return res.status(500).json({ error: 'Envoi impossible pour le moment, réessayez.', selection: true });
}
// (17/11/2026, décision de la propriétaire) envoi accepté SANS vérification anti-robots : noté dans envois_a_verifier
// (supabase-a-verifier.sql) ; l'Administration affiche « À vérifier » sur le dossier. Jamais bloquant : si la note
// échoue (fichier SQL pas encore collé…), l'envoi reste enregistré.
const TABLES_A_VERIFIER = ['casting_applications', 'recruiter_requests'];   // (celles que l'Administration étiquette)
async function noterAVerifier(table, id, raison) {
  if (!id || !TABLES_A_VERIFIER.includes(table)) return;
  // (relecture de B, 17/11) une étiquette non écrite est notée au journal : jamais un manque silencieux
  const rep = await fetch(SUPABASE_URL + '/rest/v1/envois_a_verifier', {
    method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify({ ref: id, table_nom: table, raison: String(raison || '').slice(0, 300) })
  }).catch(() => null);
  if (!rep || !rep.ok) await noterAuJournal('[Anti-robots] étiquette « À vérifier » non enregistrée pour ' + table + ' ' + id + ' (' + (rep ? rep.status : 'base injoignable') + ')', 'portail', '/api/portail').catch(() => {});
}
async function formulairePublic(req, corps, res) {
  const table = String(corps.table || ''), recu = corps.ligne;
  if (!TABLES_FORMULAIRES.includes(table) || !recu || typeof recu !== 'object' || Array.isArray(recu) || JSON.stringify(recu).length > 30000) {
    return res.status(400).json({ error: 'Formulaire invalide.' });
  }
  const ligne = garderColonnesAutorisees(table, recu);
  if (!ligne || !Object.keys(ligne).length) return res.status(400).json({ error: 'Formulaire invalide.' });
  ligne.politique_version = POLITIQUE_VERSION;   // (preuve du consentement : la base y ajoute la date)
  const modeles = table === 'recruiter_requests' ? modelesDeLaDemande(recu) : null;
  if (table === 'recruiter_requests' && (!modeles || !ligne.id)) return res.status(400).json({ error: 'Votre sélection est vide ou invalide : rechargez la page.', selection: true });
  const ip = extraireIp(req) || '';
  const verif = await jetonAntiRobotValide(corps.jeton, ip, corps.raisonJeton);
  if (!verif.ok) {
    const refuse = ANTI_ROBOTS_STRICT && !verif.panne;
    await noterAuJournal('[Anti-robots] vérification non aboutie : ' + verif.raison + ' — ' + table + (refuse ? ' (refusé)' : ' (accepté quand même)'), 'portail', '/api/portail').catch(() => {});
    if (refuse) return res.status(403).json({ error: 'La vérification anti-robot n’a pas abouti : rechargez la page puis réessayez.', robot: true });
  }
  try {
    const id = await rpcService('formulaire_public_enregistrer', { p_table: table, p_ligne: ligne, p_ip: ip });
    if (!verif.ok) await noterAVerifier(table, id || ligne.id, verif.raison);
    if (modeles) return await finirDemande(res, ligne.id, modeles, false);
    return res.status(200).json({ ok: true, id });
  } catch (e) {
    const m = String((e && e.message) || e);
    if (/LIMITE_ATTEINTE/.test(m)) return res.status(429).json({ error: 'Beaucoup d’envois en ce moment.', limite: true });
    if (/duplicate key|23505/.test(m) && ligne.id) {  // (déjà enregistré : réponse perdue)
      if (!verif.ok) await noterAVerifier(table, ligne.id, verif.raison);
      if (modeles) return await finirDemande(res, ligne.id, modeles, true);
      return res.status(200).json({ ok: true, id: ligne.id });
    }
    // (14/11/2026) cours privés : un créneau choisi vient d'être pris par une autre élève (supabase-creneaux-prives.sql)
    if (table === 'cours_talons' && /CRENEAU_PRIS|CRENEAUX_INVALIDES/.test(m)) return res.status(409).json({ error: 'Un de vos créneaux n’est plus disponible.', creneauPris: true });
    if (/Aucun casting ouvert/.test(m)) return res.status(403).json({ error: 'Aucun casting n’est ouvert en ce moment.' });
    // (24/11/2026, décision de la propriétaire) mineur : la base refuse le WhatsApp, l'e-mail ou le nom de la candidate
    // recopiés à la place de ceux du parent (supabase-parent-candidature.sql)
    if (table === 'casting_applications' && /PARENT_IDENTIQUE/.test(m)) return res.status(400).json({ error: 'Indiquez les coordonnées de votre parent, pas les vôtres.', parentIdentique: true });
    // (cours de talons : SQL de l'Extension 160 pas encore collé ; la page propose alors d'envoyer l'inscription par WhatsApp)
    if (table === 'cours_talons' && /Formulaire inconnu|PGRST202|Could not find the function|relation "(public\.)?cours_talons" does not exist/.test(m)) {
      await noterAuJournal('[Cours de talons] inscription reçue avant l’installation de supabase-cours-talons.sql (envoyée par WhatsApp)', 'portail', '/api/portail').catch(() => {});
      return res.status(503).json({ error: 'Inscriptions en ligne bientôt ouvertes.', pasPret: true });
    }
    // (SQL de l'Extension 152 pas encore collé : la fonction n'existe pas ; l'envoi passe quand même, comme avant,
    // pour que la mise en ligne du code avant le SQL ne bloque jamais les candidats)
    if (/Could not find the function|PGRST202|does not exist/.test(m)) {
      const propre = Object.assign({}, ligne); delete propre.status; delete propre.politique_version;  // (colonne peut-être absente)
      const rep = await fetch(SUPABASE_URL + '/rest/v1/' + table, { method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(propre) });
      if (rep.ok || (rep.status === 409 && ligne.id)) {
        if (modeles) return await finirDemande(res, ligne.id, modeles, rep.status === 409);
        return res.status(200).json({ ok: true, id: ligne.id || null });
      }
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
  // (16/11/2026, audit L-6 = R-01, décision de la propriétaire) le compte est créé NON CONFIRMÉ et la personne reçoit
  // un lien par e-mail : tant qu'elle ne l'a pas cliqué, elle ne peut pas se connecter, la demande n'apparaît pas
  // et ne peut pas être acceptée (supabase-demandes-confirmees.sql). Avant : compte déjà confirmé pour n'importe
  // quelle adresse, sans preuve de la posséder.
  // (16/11/2026, refait par A sur ordre du superviseur) l'e-mail de confirmation est celui de SUPABASE lui-même
  // (inscription standard « signup ») : il ne dépend plus de EMAILJS_PRIVATE_KEY, absente de Vercel (B-V5), qui aurait
  // bloqué « Créer mon compte » pour tout le monde (comme l'incident du 04 au 11/10/2026).
  // (Supabase n'écrit, avec ses réglages par défaut, qu'aux membres de l'équipe du projet : s'il refuse l'adresse,
  // on passe par l'e-mail du serveur du site, EmailJS, si sa clé est posée ; sinon rien n'est gardé et on le dit.)
  const repInscription = await fetch(SUPABASE_URL + '/auth/v1/signup?redirect_to=' + encodeURIComponent(RETOUR_ADMINISTRATION), {
    method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: motdepasse, data: { nom, portail_demande: true, portail_mdp_choisi: true } })
  }).catch(() => null);
  let inscription = repInscription ? await repInscription.json().catch(() => ({})) : {};
  if (!repInscription || !repInscription.ok) {
    const raison = String(inscription.error_code || inscription.code || inscription.msg || inscription.error_description || (repInscription && repInscription.status) || 'injoignable');
    await noterAuJournal('[Demande d’accès] e-mail de Supabase refusé pour ' + email + ' (' + raison + ')', 'demandes');
    if ((repInscription && repInscription.status === 429) || /rate_limit|rate limit/i.test(raison)) {
      return res.status(429).json({ error: 'Trop d’e-mails envoyés en ce moment : réessayez dans une heure, ou contactez l’agence.' });
    }
    // un compte resté à moitié créé (e-mail non parti) est retiré avant le second essai
    const reste = await rpcService('portail_utilisateur_par_email', { p_email: email }).catch(() => null);
    if (reste) await adminAuth('admin/users/' + reste, 'DELETE').catch(() => {});
    const cleSecours = process.env.EMAILJS_PRIVATE_KEY;
    if (!cleSecours) {
      await noterAuJournal('[Demande d’accès] aucune façon d’envoyer le lien de confirmation : régler l’e-mail (SMTP) de Supabase, ou poser EMAILJS_PRIVATE_KEY sur Vercel', 'demandes');
      return res.status(503).json({ error: 'La confirmation par e-mail n’est pas encore disponible : contactez l’agence.' });
    }
    const lien = await adminAuth('admin/generate_link', 'POST', { type: 'signup', email, password: motdepasse,
      data: { nom, portail_demande: true, portail_mdp_choisi: true }, redirect_to: RETOUR_ADMINISTRATION }).catch(() => null);
    const idSecours = lien && (lien.id || (lien.user && lien.user.id));
    const adresseLien = lien && (lien.action_link || (lien.properties && lien.properties.action_link));
    const envoiLien = idSecours && adresseLien ? await envoyerEmailServeur(cleSecours, email, nom,
      'Bonjour ' + nom + ',\n\nVous avez demandé un accès à l’Administration de Maître Akesse Model Management. Pour confirmer que cette adresse e-mail est bien la vôtre, ouvrez ce lien :\n\n' +
      adresseLien + '\n\nEnsuite, l’agence acceptera (ou non) votre demande. Si vous n’avez rien demandé, ignorez ce message : aucun compte ne sera actif.') : { ok: false };
    if (!envoiLien.ok) {
      if (idSecours) await adminAuth('admin/users/' + idSecours, 'DELETE').catch(() => {});
      return res.status(503).json({ error: 'L’e-mail de confirmation n’a pas pu partir : réessayez dans un instant, ou contactez l’agence.' });
    }
    inscription = { id: idSecours, email_confirmed_at: null };
  }
  const utilisateur = inscription.user || inscription;
  const compte = { id: utilisateur && utilisateur.id };
  const retirer = () => (compte.id ? adminAuth('admin/users/' + compte.id, 'DELETE').catch(() => {}) : Promise.resolve());
  if (!compte.id) return res.status(500).json({ error: 'Demande non enregistrée : réessayez dans un instant.' });
  // Supabase réglé sans confirmation des adresses (« Confirm email » désactivé) : le compte serait confirmé sans
  // preuve. On ne garde rien et on le dit (la propriétaire doit activer « Confirm email » dans Supabase).
  if (utilisateur.email_confirmed_at || utilisateur.confirmed_at || inscription.access_token) {
    await retirer();
    await noterAuJournal('[Demande d’accès] Supabase confirme les adresses sans e-mail (« Confirm email » désactivé) : demande de ' + email + ' refusée', 'demandes');
    return res.status(503).json({ error: 'La confirmation par e-mail n’est pas encore activée : contactez l’agence.' });
  }
  const note = await fetch(SUPABASE_URL + '/rest/v1/staff_demandes', {
    method: 'POST', headers: { ...enTetesService(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: compte.id, nom, email, telephone: telephone || null })
  });
  if (!note.ok) {
    // (demande non notée : le compte créé est retiré, la personne peut réessayer ; son lien ne mène plus à rien)
    await retirer();
    return res.status(500).json({ error: 'Demande non enregistrée : réessayez dans un instant.' });
  }
  // l'administratrice principale est prévenue (e-mail du serveur, comme les autres alertes) ; sans la clé EmailJS,
  // l'alerte est notée au journal et la demande apparaît quand même dans Sécurité › Comptes et rôles
  const cle = process.env.EMAILJS_PRIVATE_KEY;
  const principale = await fetch(SUPABASE_URL + '/rest/v1/staff_profiles?select=email,nom&role=eq.principal', { headers: enTetesService() }).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const destinataire = (principale[0] && principale[0].email) || EMAIL_AGENCE;
  const envoi = cle ? await envoyerEmailServeur(cle, destinataire, (principale[0] && principale[0].nom) || 'Maître Akesse Model Management',
    '🔑 Nouvelle demande d’accès à l’Administration\n\nNom : ' + nom + '\nE-mail : ' + email + (telephone ? '\nTéléphone : ' + telephone : '') +
    '\n\nCette personne n’a encore AUCUN accès. Elle doit d’abord confirmer son adresse (lien envoyé par e-mail) : la demande apparaîtra ensuite dans Administration (https://admin.maitreakessemodelmanagement.com/admin/), Sécurité › Comptes et rôles, pour l’accepter (et choisir son rôle) ou la refuser.') : { ok: false };
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
          // (16/11/2026, audit L-6 = R-01) adresse déjà prise par « Créer mon compte » : ce compte a été créé par
          // quelqu'un qui n'a jamais prouvé posséder l'adresse. L'invitation ne lui donne JAMAIS le rôle en silence :
          // la demande se traite dans Sécurité › Comptes et rôles, après avoir vérifié la personne (appel).
          const demande = await fetch(SUPABASE_URL + '/rest/v1/staff_demandes?select=id&user_id=eq.' + encodeURIComponent(userId), { headers: enTetesService() });
          if (!demande.ok) throw new Error('Vérification impossible pour le moment.');
          if ((await demande.json()).length) {
            return res.status(400).json({ error: 'Une demande d’accès existe déjà pour cette adresse (« Créer mon compte ») : ouvrez-la dans Sécurité › Comptes et rôles, et appelez la personne pour vérifier que c’est bien elle avant de l’accepter.' });
          }
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
        await noterAction(req, auteur.id, 'principal', 'E-mail de connexion d’une mannequin changé', cible, { email: compte.email || null }, { email });
        return res.status(200).json({ ok: true, email });
      }
      // mot de passe provisoire : marqué dans app_metadata (que seul le serveur peut écrire) ; toutes les sessions du
      // compte sont fermées (un appareil volé ou resté connecté perd l'accès, au plus tard dans l'heure)
      const motdepasse = 'MA2M-' + tirerSignes(4) + '-' + tirerSignes(4);
      await adminAuth('admin/users/' + cible, 'PUT', { password: motdepasse, app_metadata: { mdp_provisoire: true } });
      const deconnecte = compte.email ? await deconnecterPartout(compte.email, motdepasse) : false;
      await noterAction(req, auteur.id, 'principal', 'Mot de passe provisoire d’une mannequin créé', cible, null, { deconnectee_partout: deconnecte });
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
      await noterAction(req, u.id, 'mannequin', 'Mot de passe provisoire remplacé par la mannequin', u.id, null, null);
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
// (pour les essais : comparer les champs vraiment envoyés par les pages à la liste blanche)
module.exports.COLONNES_FORMULAIRES = COLONNES_FORMULAIRES;
