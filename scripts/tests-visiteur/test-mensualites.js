// Mensualités de formation (cahier v2.4, 5.6 et 5.7 ; choix du 19/10/2026), comme une vraie
// personne, base SIMULÉE :
//  - « Mes paiements » du mannequin : 24 mois en couleurs, Wave puis « J'ai payé » ;
//  - serveur du site : relances automatiques par e-mail le 3 et le 5 seulement, jamais sans clé
//    EmailJS, messages au parent pour un mineur.
// (L'appel du 1er dans l'espace 2 est essayé dans test-administration.js.)
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const { verifierBoutons } = require('./boutons');
const PORT = String(9100 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JETON = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'u-awa', role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000 }) + '.c2ln';
const SESSION = { access_token: JETON, refresh_token: 'faux', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: 'u-awa', email: 'awa@test.ci', aud: 'authenticated', role: 'authenticated' } };
const ici = new Date(), m0 = new Date(ici.getFullYear(), ici.getMonth() - 2, 1);
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
const MOIS = Array.from({ length: 24 }, (_, i) => ({ mois: iso(new Date(m0.getFullYear(), m0.getMonth() + i, 1)), etat: i === 0 ? 'paye' : i === 1 ? 'attente' : i === 2 ? (ici.getDate() > 5 ? 'non_paye' : 'a_payer') : 'a_venir' }));

async function navigateur() {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore', stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const ctx = await b.newContext({ viewport: ecran }); const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript((s) => { localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify(s)); }, SESSION);
    await brancher(p, { tables: {}, rpc: { mes_mensualites: () => ({ inscrit: true, nom: 'KONÉ AWA', mensualite: 20000, statut: 'actif', mineur: false, mois: MOIS }), lien_paiement: () => 'https://pay.wave.com/m/PARAMETRES/c/ci/?amount=20000', mes_recus: () => [{ objet: 'mensualite', mois: MOIS[0].mois, montant: 20000, mode: 'wave', numero: 'REC-2026-00007' }, { objet: 'mensualite', mois: MOIS[3].mois, montant: null, mode: 'avant_systeme', numero: null }], mensualite_declarer_avec_numero: null } }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/mes-paiements.html'); await p.waitForSelector('.mp-calendrier', { timeout: 8000 });
    const t = () => p.evaluate(() => document.getElementById('mp-zone').innerText);
    ok((await p.$$('.mp-calendrier .mp-mois')).length === 24 && /1 mois réglé sur 24/.test(await t()), nomEcran + ' : tableau des 24 mois de formation');
    const couleurs = await p.$$eval('.mp-calendrier .mp-mois', (l) => l.slice(0, 3).map((x) => x.className.replace('mp-mois ', '')));
    ok(couleurs[0] === 'ok' && couleurs[1] === 'alerte' && ['erreur', 'info'].includes(couleurs[2]), nomEcran + ' : vert payé, orange en attente, rouge non payé ' + couleurs.join(','));
    ok(await p.isDisabled('[data-mp=paye]') && /PARAMETRES.*amount=20000$/.test(await p.getAttribute('[data-mp=wave]', 'href')), nomEcran + ' : lien Wave des Paramètres au montant du mannequin (20 000), « J’ai payé » attend le paiement');
    ok(/REC-2026-00007/.test(await t()) && /Avant le nouveau système/.test(await t()), nomEcran + ' : historique avec numéro de reçu');
    ok(/espèces/i.test(await t()) && /Orange Money/.test(await t()), nomEcran + ' : espèces à l’agence, autres opérateurs « bientôt »');
    const boutons = (await p.evaluate(verifierBoutons)).map((x) => x.texte); ok(!boutons.length, nomEcran + ' : boutons au modèle rouge ' + boutons.join(' | '));
    const pales = (await lirePageEntiere(p)).map((x) => x.texte.slice(0, 25)); ok(!pales.length, nomEcran + ' : textes lisibles ' + pales.join(' | '));
    await p.locator('[data-mp=wave]').evaluate((a) => { a.removeAttribute('target'); a.href = '#'; });
    await p.click('[data-mp=wave]'); await p.waitForTimeout(500);
    ok(await p.isDisabled('[data-mp=paye]'), nomEcran + ' : « J’ai payé » reste fermé sans le numéro du payeur');
    await p.fill('.mp-num', 'abc'); ok(await p.isDisabled('[data-mp=paye]'), nomEcran + ' : numéro invalide refusé');
    await p.fill('.mp-num', '+225 07 01 02 03 04'); ok(!(await p.isDisabled('[data-mp=paye]')), nomEcran + ' : numéro valide, « J’ai payé » s’ouvre');
    await p.click('[data-mp=paye]'); await p.waitForTimeout(800);
    const appel = journal.find((j) => j[0] === 'rpc' && j[1] === 'mensualite_declarer_avec_numero');
    ok(appel && JSON.parse(appel[2]).p_numero === '+225 07 01 02 03 04' && JSON.parse(appel[2]).p_mois === MOIS[2].mois && /L’agence vérifie/.test(await t()), nomEcran + ' : « J’ai payé » envoyé pour le bon mois, l’agence vérifie');
    ok(!errs.length, nomEcran + ' : aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
}

// Serveur : relances du 3 et du 5 (api/portail.js, appelé par la tâche planifiée de Vercel)
async function serveur() {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai';
  const envois = [];
  let relances = [];
  global.fetch = async (url, o) => {
    if (/rpc\/mensualites_relances/.test(url)) { const j = JSON.parse(o.body).p_jour; return { ok: true, json: async () => relances.map((x) => Object.assign({ jour: j }, x)) }; }
    if (/api\.emailjs\.com/.test(url)) { envois.push(JSON.parse(o.body)); return { ok: true }; }
    return { ok: true, json: async () => ({}), text: async () => '' };
  };
  const portail = require('../../api/portail.js');
  const appeler = async (jour, entetes) => {
    const vrai = Date.prototype.getUTCDate; Date.prototype.getUTCDate = function () { return jour; };
    let statut = 0, corps = null;
    const res = { status(s) { statut = s; return this; }, json(c) { corps = c; return this; }, setHeader() {} };
    try { await portail({ method: 'GET', headers: entetes || {}, query: {} }, res); } finally { Date.prototype.getUTCDate = vrai; }
    return { statut, corps };
  };
  relances = [{ nom: 'YAO KOUASSI', email: 'yao@test.ci', mensualite: 10000 }, { nom: 'AKESSE FRANCK', date_naissance: '2014-01-01', parent_nom: 'Monsieur Paul', parent_email: 'paul@test.ci', parent_telephone: '07', mensualite: 10000 }];
  process.env.CRON_SECRET = 'secret-essai';
  const VERCEL = { authorization: 'Bearer secret-essai' };
  let r = await appeler(4, VERCEL);
  ok(r.statut === 200 && r.corps.rien && !envois.length, 'serveur : le 4, aucune relance');
  delete process.env.EMAILJS_PRIVATE_KEY;
  r = await appeler(3, VERCEL);
  ok(r.corps.relances === 2 && !envois.length, 'serveur : sans clé EmailJS, rien ne part (noté au journal)');
  process.env.EMAILJS_PRIVATE_KEY = 'cle-privee-essai';
  r = await appeler(5, VERCEL);
  ok(r.corps.envoyes === 2 && envois.length === 2 && envois.every((e) => e.accessToken === 'cle-privee-essai'), 'serveur : le 5, dernière relance envoyée à chacun par e-mail');
  ok(envois[1].template_params.to_email === 'paul@test.ci' && /Bonjour Monsieur Paul/.test(envois[1].template_params.message) && /Dernier rappel/.test(envois[1].template_params.message), 'serveur : mineur → message au parent');
  r = await appeler(3, { authorization: 'Bearer faux' });
  ok(r.statut === 401, 'serveur : appel sans le secret de la tâche planifiée refusé');
  delete process.env.CRON_SECRET;
  r = await appeler(3, {});
  ok(r.statut === 401, 'serveur : secret non réglé sur Vercel → relances fermées (personne ne peut les déclencher)');
}

(async () => {
  await navigateur();
  await serveur();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
