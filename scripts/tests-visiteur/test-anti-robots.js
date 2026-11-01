// Anti-robots des formulaires publics (Extension 152, 01/11/2026, clé Cloudflare Turnstile de la propriétaire).
// Base, Cloudflare et serveur SIMULÉS : rien n'est écrit pour de vrai.
//  1. le serveur (api/portail.js, action « formulaire ») : jeton vérifié auprès de Cloudflare avec la clé secrète,
//     robot refusé, limite d'envois gardée, adresse du visiteur transmise à la base ;
//  2. dans le navigateur (Contact, téléphone et ordinateur) : l'envoi passe par le serveur avec le jeton, jamais
//     directement dans la base ; un refus anti-robot affiche un message.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PORT = String(9840 + Math.floor(Math.random() * 30));

async function serveur() {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai'; process.env.TURNSTILE_SECRET_KEY = 'secret-essai';
  const verifs = [], rpcs = []; let limite = false;
  global.fetch = async (url, o = {}) => {
    const u = String(url);
    const json = (x, s = 200) => ({ ok: s < 300, status: s, json: async () => x, text: async () => JSON.stringify(x) });
    if (u.includes('challenges.cloudflare.com/turnstile/v0/siteverify')) { const p = new URLSearchParams(String(o.body)); verifs.push(Object.fromEntries(p)); return json({ success: p.get('response') === 'bon-jeton' }); }
    if (u.includes('/rpc/formulaire_public_enregistrer')) { const c = JSON.parse(o.body); rpcs.push(c); return limite ? json({ message: 'LIMITE_ATTEINTE' }, 400) : json('id-1'); }
    return json({});
  };
  const portail = require('../../api/portail.js');
  const appeler = async (corps, ip = '41.2.3.4, 10.0.0.1') => {
    let statut = 0, rep = null;
    const res = { status(s) { statut = s; return this; }, json(c) { rep = c; return this; }, setHeader() {} };
    await portail({ method: 'POST', headers: { 'x-forwarded-for': ip }, body: Object.assign({ action: 'formulaire' }, corps) }, res);
    return { statut, rep };
  };
  const ligne = { id: 'c1', nom: 'Awa', email: 'awa@test.ci', message: 'Bonjour' };
  let r = await appeler({ table: 'messages_contact', ligne, jeton: 'bon-jeton' });
  ok(r.statut === 200 && verifs.pop()?.secret === 'secret-essai' && rpcs.length === 1 && rpcs[0].p_table === 'messages_contact' && rpcs[0].p_ip === '41.2.3.4' && rpcs[0].p_ligne.nom === 'Awa',
    'serveur : jeton vérifié chez Cloudflare avec la clé secrète, puis enregistré (adresse du visiteur transmise)');
  // (mode souple du 01/11/2026 au soir, ANTI_ROBOTS_STRICT = false : l'envoi passe, la raison exacte est notée au journal)
  const journal = []; const fetchAvant = global.fetch;
  global.fetch = async (url, o = {}) => { if (/journal_erreurs/.test(String(url))) { journal.push(JSON.parse(o.body)); return { ok: true, status: 201, json: async () => ({}), text: async () => '' }; } return fetchAvant(url, o); };
  r = await appeler({ table: 'messages_contact', ligne, jeton: 'jeton-de-robot' });
  ok(r.statut === 200 && rpcs.length === 2 && JSON.stringify(journal).includes('[Anti-robots] vérification non aboutie : Cloudflare'), 'serveur : jeton refusé par Cloudflare : envoi accepté (mode souple), raison notée au journal');
  r = await appeler({ table: 'messages_contact', ligne, raisonJeton: 'erreur Turnstile 110200' });
  ok(r.statut === 200 && JSON.stringify(journal).includes('erreur Turnstile 110200'), 'serveur : pas de jeton : la raison donnée par le navigateur est notée au journal');
  global.fetch = fetchAvant; rpcs.length = 1;
  r = await appeler({ table: 'model_profiles', ligne, jeton: 'bon-jeton' });
  ok(r.statut === 400 && rpcs.length === 1, 'serveur : une autre table que les 3 formulaires : refusée');
  limite = true; r = await appeler({ table: 'recruiter_requests', ligne: { id: 'r1', contact_name: 'x', email: 'x@x.ci' }, jeton: 'bon-jeton' }); limite = false;
  ok(r.statut === 429 && r.rep.limite, 'serveur : trop d’envois de la même adresse : « beaucoup d’envois » (le navigateur patiente et réessaie)');
  // code en ligne avant que le SQL soit collé : l'envoi passe comme avant (jamais de candidats bloqués)
  const directs = []; const ancien = global.fetch;
  global.fetch = async (url, o = {}) => { const u = String(url);
    if (u.includes('siteverify')) return { ok: true, status: 200, json: async () => ({ success: true }) };
    if (u.includes('/rpc/formulaire_public_enregistrer')) return { ok: false, status: 404, json: async () => ({ code: 'PGRST202', message: 'Could not find the function public.formulaire_public_enregistrer' }) };
    if (/\/rest\/v1\/messages_contact$/.test(u)) { directs.push(JSON.parse(o.body)); return { ok: true, status: 201, json: async () => ({}) }; }
    return ancien(url, o); };
  r = await appeler({ table: 'messages_contact', ligne: Object.assign({ status: 'traitee' }, ligne), jeton: 'bon-jeton' });
  ok(r.statut === 200 && directs.length === 1 && !('status' in directs[0]), 'serveur : SQL pas encore collé : le message passe quand même (sans statut imposé), rien n’est bloqué');
  global.fetch = ancien;
}

async function navigateur() {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [page, ecran, robot] of [['contact.html', { width: 390, height: 844 }, false], ['en/contact.html', { width: 1280, height: 900 }, false], ['contact.html', { width: 390, height: 844 }, true]]) {
    const p = await (await b.newContext({ viewport: ecran })).newPage(); const errs = [], journal = [], directs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('request', (r) => { if (/supabase\.co\/rest\/v1\/messages_contact/.test(r.url()) && r.method() === 'POST') directs.push(r.url()); });
    await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ } });
    await brancher(p, { tables: {}, rpc: {}, formulaire: robot ? () => ({ statut: 403, error: 'La vérification anti-robot n’a pas abouti : rechargez la page puis réessayez.', robot: true }) : null }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1200);
    await p.selectOption('#civilite', page.startsWith('en') ? 'Monsieur' : 'Madame'); await p.fill('#nom', 'Kouassi Marie'); await p.fill('#email', 'marie@test.ci');
    await p.fill('#message', 'Bonjour.'); await p.check('#ct-consentement'); await p.click('#form-contact button[type="submit"]');
    await p.waitForTimeout(2500);
    const n = page + ' ' + ecran.width + 'px' + (robot ? ' (robot)' : '') + ' : ';
    const anti = journal.filter((j) => j[0] === 'ANTI-ROBOT');
    if (!robot) ok(anti.length === 1 && anti[0][2] === 'jeton-essai' && journal.some((j) => j[0] === 'POST' && j[1] === 'messages_contact') && !directs.length && !errs.length,
      n + 'message envoyé par le serveur avec le jeton anti-robot, jamais directement dans la base ' + errs.join(' | '));
    else ok(!journal.some((j) => j[0] === 'POST' && j[1] === 'messages_contact') && /erreur|error|réessayez|try again/i.test(await p.textContent('body')), n + 'refus anti-robot : rien d’enregistré, un message s’affiche');
    await p.context().close();
  }
  await b.close();
}

(async () => {
  await serveur();
  await navigateur();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
