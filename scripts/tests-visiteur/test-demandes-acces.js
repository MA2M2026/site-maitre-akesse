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
  const crees = [], demandes = [], envois = [], supprimes = [];
  let existant = false, recentes = 0, noteKo = false;
  global.fetch = async (url, o = {}) => {
    const u = String(url);
    const json = (x, s = 200) => ({ ok: s < 300, status: s, json: async () => x, text: async () => JSON.stringify(x) });
    if (/staff_demandes\?select=id&cree_le=gte/.test(u)) return json(Array.from({ length: recentes }, (_, i) => ({ id: i })));
    if (/rpc\/portail_utilisateur_par_email/.test(u)) return json(existant ? 'u-deja' : null);
    if (/auth\/v1\/admin\/users\/[^/]+$/.test(u) && o.method === 'DELETE') { supprimes.push(u); return json({}); }
    if (/auth\/v1\/admin\/users$/.test(u)) { const c = JSON.parse(o.body); crees.push(c); return json({ id: 'u-neuf', email: c.email }); }
    if (/rest\/v1\/staff_demandes$/.test(u) && o.method === 'POST') { if (noteKo) return json({}, 500); demandes.push(JSON.parse(o.body)); return json(null, 201); }
    if (/staff_profiles\?select=email,nom&role=eq.principal/.test(u)) return json([{ email: 'proprietaire@test.ci', nom: 'Maître Akesse' }]);
    if (/api\.emailjs\.com/.test(u)) { envois.push(JSON.parse(o.body)); return json({}); }
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
  ok(r.statut === 200 && crees.length === 1 && crees[0].email === 'recrue@test.ci' && crees[0].email_confirm === true && crees[0].password === bon.motdepasse, 'serveur : compte créé tout de suite (confirmé, sans e-mail à recevoir), mot de passe choisi par la personne');
  ok(demandes.length === 1 && demandes[0].user_id === 'u-neuf' && demandes[0].nom === 'Nouvelle Recrue' && demandes[0].telephone === '+225 07 07 07 07 07', 'serveur : la demande est notée (en attente)');
  ok(envois.length === 1 && envois[0].template_params.to_email === 'proprietaire@test.ci' && /Nouvelle demande d’accès/.test(envois[0].template_params.message) && /Recrue/.test(envois[0].template_params.message) && /AUCUN accès/.test(envois[0].template_params.message),
    'serveur : la propriétaire est prévenue par e-mail (nom, e-mail, téléphone, où accepter)');
  r = await appeler(Object.assign({}, bon, { motdepasse: 'court' }));
  ok(r.statut === 400 && crees.length === 1, 'serveur : mot de passe de moins de 12 caractères : refusé');
  existant = true; r = await appeler(bon); existant = false;
  ok(r.statut === 409 && crees.length === 1 && /existe déjà/.test(r.rep.error), 'serveur : adresse déjà connue : refusée (aucun compte en double)');
  recentes = 10; r = await appeler(bon); recentes = 0;
  ok(r.statut === 429 && crees.length === 1, 'serveur : plus de 10 demandes dans l’heure : refusé (robots)');
  noteKo = true; r = await appeler(bon); noteKo = false;
  ok(r.statut === 500 && supprimes.length === 1, 'serveur : demande non notée : le compte créé est retiré (la personne peut réessayer)');
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
  await navigateur();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
