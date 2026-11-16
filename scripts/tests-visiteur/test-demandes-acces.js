// « Créer mon compte » pour l'équipe (Extension 150, 01/11/2026, décision de la propriétaire : comme les vraies
// applications), base, serveur et EmailJS SIMULÉS (rien n'est créé ni envoyé pour de vrai) :
//  1. le serveur (api/portail.js, demande_acces) : compte créé sans e-mail à recevoir, demande notée, la
//     propriétaire prévenue ; mot de passe trop court, adresse déjà connue, trop de demandes : refusés ;
//  2. l'écran de connexion : « Créer mon compte » → « Demande envoyée » (téléphone et ordinateur) ;
//  3. Sécurité (propriétaire) : la demande apparaît, « Accepter » avec le rôle choisi, « Refuser ».
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PORT = String(9660 + Math.floor(Math.random() * 30)), URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';

async function serveur() {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai'; process.env.EMAILJS_PRIVATE_KEY = 'cle-privee-essai';
  const crees = [], demandes = [], envois = [], supprimes = [], journal = [];
  let existant = false, recentes = 0, noteKo = false, inscriptionKo = 0, sansConfirmation = false;
  global.fetch = async (url, o = {}) => {
    const u = String(url);
    const json = (x, s = 200) => ({ ok: s < 300, status: s, json: async () => x, text: async () => JSON.stringify(x) });
    if (/staff_demandes\?select=id&cree_le=gte/.test(u)) return json(Array.from({ length: recentes }, (_, i) => ({ id: i })));
    if (/rpc\/portail_utilisateur_par_email/.test(u)) return json(existant ? 'u-deja' : null);
    if (/auth\/v1\/admin\/users\/[^/]+$/.test(u) && o.method === 'DELETE') { supprimes.push(u); return json({}); }
    if (/auth\/v1\/admin\/generate_link/.test(u)) { const c = JSON.parse(o.body); crees.push({ secours: true, email: c.email }); return json({ id: 'u-secours', email: c.email, action_link: 'https://lien.test/confirmer?jeton=abc' }); }
    // (refait par A, 16/11) inscription standard de Supabase : c'est Supabase qui envoie l'e-mail de confirmation
    if (/auth\/v1\/signup\?redirect_to=/.test(u)) {
      const c = JSON.parse(o.body); crees.push(Object.assign({ url: u }, c));
      if (inscriptionKo === 429) return json({ error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }, 429);
      if (inscriptionKo) return json({ msg: 'erreur' }, inscriptionKo);
      return sansConfirmation ? json({ access_token: 't', user: { id: 'u-neuf', email: c.email, email_confirmed_at: '2026-11-16T06:00:00Z' } })
        : json({ id: 'u-neuf', email: c.email, confirmation_sent_at: '2026-11-16T06:00:00Z', email_confirmed_at: null });
    }
    if (/rest\/v1\/staff_demandes$/.test(u) && o.method === 'POST') { if (noteKo) return json({}, 500); demandes.push(JSON.parse(o.body)); return json(null, 201); }
    if (/staff_profiles\?select=email,nom&role=eq.principal/.test(u)) return json([{ email: 'proprietaire@test.ci', nom: 'Maître Akesse' }]);
    if (/api\.emailjs\.com/.test(u)) { envois.push(JSON.parse(o.body)); return json({}); }
    if (/rest\/v1\/journal_erreurs/.test(u)) { journal.push(JSON.parse(o.body)); return json(null, 201); }
    return json({});
  };
  const portail = require('../../api/portail.js');
  const appeler = async (corps) => {
    let statut = 0, rep = null;
    const res = { status(s) { statut = s; return this; }, json(c) { rep = c; return this; }, setHeader() {} };
    await portail({ method: 'POST', headers: {}, body: Object.assign({ action: 'demande_acces' }, corps) }, res);
    return { statut, rep };
  };
  const bon = { nom: 'Nouvelle Recrue', email: 'Recrue@Test.ci', telephone: '+225 07 07 07 07 07', motdepasse: 'un-mot-de-passe-solide' };
  let r = await appeler(bon);
  // (16/11/2026, audit L-6) compte créé NON confirmé ; le lien de confirmation part par l'e-mail de Supabase lui-même
  ok(r.statut === 200 && crees.length === 1 && /\/auth\/v1\/signup\?redirect_to=/.test(crees[0].url) && crees[0].email === 'recrue@test.ci' && crees[0].password === bon.motdepasse && !('email_confirm' in crees[0]) && !crees.some((c) => c.secours),
    'serveur : compte créé NON confirmé par l’inscription standard de Supabase (qui envoie elle-même le lien)');
  ok(decodeURIComponent(crees[0].url).includes('maitreakessemodelmanagement.com/admin/'), 'serveur : le lien ramène à l’Administration');
  ok(demandes.length === 1 && demandes[0].user_id === 'u-neuf' && demandes[0].nom === 'Nouvelle Recrue' && demandes[0].telephone === '+225 07 07 07 07 07', 'serveur : la demande est notée (en attente)');
  ok(!envois.some((e) => e.template_params.to_email === 'recrue@test.ci'), 'serveur : le lien ne passe plus par EmailJS');
  ok(envois.length === 1 && envois[0].template_params.to_email === 'proprietaire@test.ci' && /confirmer son adresse/.test(envois[0].template_params.message),
    'serveur : la propriétaire est prévenue (la demande apparaîtra après la confirmation)');
  // la clé EmailJS absente de Vercel (B-V5) ne bloque plus « Créer mon compte »
  const cle = process.env.EMAILJS_PRIVATE_KEY; delete process.env.EMAILJS_PRIVATE_KEY; const avant = crees.length, envoisAvant = envois.length;
  r = await appeler(bon); process.env.EMAILJS_PRIVATE_KEY = cle;
  ok(r.statut === 200 && crees.length === avant + 1 && envois.length === envoisAvant && journal.some((j) => /alerte non partie.*clé EmailJS absente/.test(j.message || JSON.stringify(j))),
    'serveur : clé EmailJS absente : la demande passe quand même (alerte notée au journal), plus de blocage');
  inscriptionKo = 429; r = await appeler(bon); inscriptionKo = 0;
  ok(r.statut === 429 && /réessayez dans une heure/.test(r.rep.error), 'serveur : trop d’e-mails Supabase en ce moment : message clair, rien de gardé');
  // Supabase refuse d'écrire à cette adresse (réglages par défaut : seulement l'équipe du projet) → secours EmailJS
  inscriptionKo = 400; let e0 = envois.length, d0 = demandes.length; r = await appeler(bon); inscriptionKo = 0;
  ok(r.statut === 200 && crees.some((c) => c.secours) && envois.slice(e0).some((e) => e.template_params.to_email === 'recrue@test.ci' && e.template_params.message.includes('https://lien.test/confirmer?jeton=abc')) && demandes.length === d0 + 1 && demandes[d0].user_id === 'u-secours',
    'serveur : e-mail de Supabase refusé → lien envoyé par l’e-mail du serveur (EmailJS), demande notée');
  delete process.env.EMAILJS_PRIVATE_KEY; inscriptionKo = 400; d0 = demandes.length; r = await appeler(bon); inscriptionKo = 0; process.env.EMAILJS_PRIVATE_KEY = cle;
  ok(r.statut === 503 && demandes.length === d0 && /pas encore disponible/.test(r.rep.error) && journal.some((j) => /régler l’e-mail \(SMTP\) de Supabase/.test(j.message)),
    'serveur : ni e-mail de Supabase ni clé EmailJS : rien de gardé, message clair, la marche à suivre notée au journal');
  sansConfirmation = true; const s0 = supprimes.length; r = await appeler(bon); sansConfirmation = false;
  ok(r.statut === 503 && supprimes.length === s0 + 1 && /pas encore activée/.test(r.rep.error), 'serveur : Supabase réglé sans « Confirm email » : compte retiré, jamais confirmé sans preuve');
  const n0 = crees.length;  // (aucun compte de plus dans les refus ci-dessous)
  r = await appeler(Object.assign({}, bon, { motdepasse: 'court' }));
  ok(r.statut === 400 && crees.length === n0, 'serveur : mot de passe de moins de 12 caractères : refusé');
  existant = true; r = await appeler(bon); existant = false;
  ok(r.statut === 409 && crees.length === n0 && /existe déjà/.test(r.rep.error), 'serveur : adresse déjà connue : refusée (aucun compte en double)');
  recentes = 10; r = await appeler(bon); recentes = 0;
  ok(r.statut === 429 && crees.length === n0, 'serveur : plus de 10 demandes dans l’heure : refusé (robots)');
  noteKo = true; const s1 = supprimes.length; r = await appeler(bon); noteKo = false;
  ok(r.statut === 500 && supprimes.length === s1 + 1, 'serveur : demande non notée : le compte créé est retiré (la personne peut réessayer)');
}

// (16/11/2026, audit L-6 = R-01) l'invitation de la propriétaire ne donne JAMAIS le rôle à un compte créé par
// « Créer mon compte » (quelqu'un qui n'a pas prouvé posséder l'adresse) ; une invitation normale passe toujours.
async function invitation() {
  const profils = []; let aDemande = true;
  const jwt = (o) => 'x.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.y';
  const jeton = jwt({ amr: [{ method: 'totp', timestamp: Math.floor(Date.now() / 1000) - 30 }] });
  global.fetch = async (url, o = {}) => {
    const u = String(url);
    const json = (x, s = 200) => ({ ok: s < 300, status: s, json: async () => x, text: async () => JSON.stringify(x) });
    if (/rpc\/portail_moi/.test(u)) return json({ role: 'principal' });
    if (/auth\/v1\/user$/.test(u)) return json({ id: 'u-principale' });
    if (/rpc\/portail_utilisateur_par_email/.test(u)) return json('u-deja');
    if (/staff_profiles\?select=user_id&user_id=eq\.u-deja/.test(u)) return json([]);
    if (/staff_demandes\?select=id&user_id=eq\.u-deja/.test(u)) return json(aDemande ? [{ id: 'd1' }] : []);
    if (/staff_profiles\?on_conflict=user_id/.test(u)) { profils.push(JSON.parse(o.body)); return json(null, 201); }
    return json({});
  };
  const portail = require('../../api/portail.js');
  const appeler = async () => {
    let statut = 0, rep = null;
    const res = { status(x) { statut = x; return this; }, json(c) { rep = c; return this; }, setHeader() {} };
    await portail({ method: 'POST', headers: { authorization: 'Bearer ' + jeton, 'x-appareil': 'appareil-essai-0001' },
      body: { action: 'inviter', email: 'collegue@test.ci', nom: 'Collègue', role: 'site' } }, res);
    return { statut, rep };
  };
  let r = await appeler();
  ok(r.statut === 400 && profils.length === 0 && /demande d’accès existe déjà/.test(r.rep.error),
    'invitation : adresse déjà prise par « Créer mon compte » → aucun rôle donné en silence, la propriétaire doit vérifier la personne');
  aDemande = false; r = await appeler();
  ok(r.statut === 200 && profils.length === 1 && profils[0].user_id === 'u-deja' && profils[0].role === 'site', 'invitation d’un compte existant sans demande : rôle donné (inchangé)');
}

// (16/11/2026, audit L-6) connexion d'une personne qui n'a pas encore cliqué le lien : message clair, pas « mot de passe
// incorrect », et aucun essai compté
async function connexionNonConfirmee() {
  const echecs = [];
  global.fetch = async (url, o = {}) => {
    const u = String(url);
    const json = (x, s = 200) => ({ ok: s < 300, status: s, json: async () => x, text: async () => JSON.stringify(x) });
    if (/auth\/v1\/token/.test(u)) return json({ error_code: 'email_not_confirmed', msg: 'Email not confirmed' }, 400);
    if (/rpc\/connexion_enregistrer_echec/.test(u)) { echecs.push(u); return json([{ bloque: false, essais_restants: 4 }]); }
    if (/rpc\//.test(u)) return json([]);
    return json([]);
  };
  const connexion = require('../../api/connexion-protegee.js');
  let statut = 0, rep = null;
  const res = { status(x) { statut = x; return this; }, json(c) { rep = c; return this; }, setHeader() {} };
  await connexion({ method: 'POST', headers: {}, body: { email: 'recrue@test.ci', password: 'un-mot-de-passe-solide', espace: 'portail', appareil: 'appareil-essai-0001' } }, res);
  ok(statut === 403 && /pas encore confirmée/.test((rep && rep.error) || '') && !echecs.length, 'connexion avant d’avoir cliqué le lien : « adresse pas encore confirmée » (pas « mot de passe incorrect »)');
}

async function navigateur() {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    // 1. une nouvelle personne crée son compte
    {
      const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
      const p = await ctx.newPage(); const errs = [], journal = [];
      p.on('pageerror', (e) => errs.push(e.message));
      const d = donnees('principal');
      let reponse = { ok: true };
      d.api = Object.assign({}, d.api, { '/api/portail': () => reponse });
      await brancher(p, d, journal); await photosLocales(p);
      await p.goto(URL_ADMIN); await p.waitForSelector('#cx-mail');
      await p.click('[data-action="demande-acces"]'); await p.waitForSelector('form[data-form="demande-acces"]');
      await p.fill('#da-nom', 'Nouvelle Recrue'); await p.fill('#da-mail', 'recrue@test.ci'); await p.fill('#da-tel', '0707070707');
      await p.fill('#da-m1', 'un-mot-de-passe-solide'); await p.fill('#da-m2', 'un-autre-mot-de-passe');
      await p.click('form[data-form="demande-acces"] [type=submit]'); await p.waitForTimeout(400);
      ok(/pas identiques/.test(await p.textContent('.connexion')), n + 'mots de passe différents : refusé avant l’envoi');
      await p.fill('#da-m1', 'un-mot-de-passe-solide'); await p.fill('#da-m2', 'un-mot-de-passe-solide');
      reponse = { statut: 409, error: 'Un compte existe déjà avec cette adresse : connectez-vous, ou contactez l’agence.' };
      await p.click('form[data-form="demande-acces"] [type=submit]'); await p.waitForTimeout(600);
      ok(/existe déjà/.test(await p.textContent('.connexion')), n + 'adresse déjà connue : le message du serveur s’affiche');
      await p.fill('#da-m1', 'un-mot-de-passe-solide'); await p.fill('#da-m2', 'un-mot-de-passe-solide');
      reponse = { ok: true };
      await p.click('form[data-form="demande-acces"] [type=submit]'); await p.waitForTimeout(600);
      const envoi = journal.filter((j) => j[0] === 'API' && j[1] === '/api/portail').map((j) => JSON.parse(j[2] || '{}')).pop() || {};
      ok(/Demande envoyée/.test(await p.textContent('.connexion')) && envoi.action === 'demande_acces' && envoi.email === 'recrue@test.ci' && envoi.motdepasse === 'un-mot-de-passe-solide',
        n + '« Créer mon compte » : demande envoyée, l’écran explique que l’agence doit accepter');
      ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) && !errs.length, n + 'rien ne déborde, aucune erreur ' + errs.join(' | '));
      await ctx.close();
    }
    // 2. la propriétaire accepte ou refuse
    {
      const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
      const p = await ctx.newPage(); const errs = [], journal = [];
      p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (dl) => dl.accept());
      const d = donnees('principal');
      d.rpc.portail_demandes_liste = () => [{ id: 'dm1', nom: 'Nouvelle Recrue', email: 'recrue@test.ci', telephone: '0707070707', statut: 'en_attente', cree_le: new Date().toISOString() },
        { id: 'dm2', nom: 'Inconnu', email: 'x@test.ci', telephone: null, statut: 'en_attente', cree_le: new Date().toISOString() }];
      d.rpc.portail_demande_accepter = () => null; d.rpc.portail_demande_refuser = () => null;
      await brancher(p, d, journal); await photosLocales(p);
      await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete', { timeout: 10000 }).catch(() => {});
      await p.goto(URL_ADMIN + '#/securite/comptes'); await p.waitForSelector('[data-action="demande-accepter"]', { timeout: 8000 }).catch(() => {});
      const t = await p.textContent('.contenu');
      ok(/Demandes d’accès/.test(t) && /Nouvelle Recrue/.test(t) && /recrue@test\.ci · 0707070707/.test(t) && !/Envoyer l’invitation/.test(t), n + 'Sécurité : les demandes en attente (nom, e-mail, téléphone), plus d’invitation par e-mail');
      await p.selectOption('#role-dm1', 'caisse');
      await p.click('[data-action="demande-accepter"][data-id="dm1"]'); await p.waitForTimeout(700);
      const appels = (quoi) => journal.filter((j) => j[0] === 'rpc' && j[1] === quoi).map((j) => JSON.parse(j[2] || '{}'));
      ok((appels('portail_demande_accepter').pop() || {}).p_role === 'caisse', n + '« Accepter » : avec le rôle choisi');
      await p.waitForSelector('[data-action="demande-refuser"][data-id="dm2"]');
      await p.click('[data-action="demande-refuser"][data-id="dm2"]'); await p.waitForTimeout(700);
      ok((appels('portail_demande_refuser').pop() || {}).p_id === 'dm2', n + '« Refuser » (après confirmation)');
      ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
      await ctx.close();
    }
  }
  await b.close();
}

(async () => {
  await serveur();
  await invitation();
  await connexionNonConfirmee();
  await navigateur();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
