// Tableau de bord protégé (13/10/2026) : sans clé d'accès, le serveur (middleware.js) ne livre
// que l'écran de connexion — ni le tableau de bord, ni ses scripts réservés. Une clé signée
// valide (posée après mot de passe + code) laisse tout passer ; une fausse ou périmée, non.
// Puis, comme une visiteuse : connexion sur la page réduite → code → la page se recharge et le
// tableau de bord s'ouvre. Base simulée : rien n'est écrit pour de vrai.
const fs = require('fs'); const path = require('path'); const os = require('os');
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const RACINE = path.resolve(__dirname, '../..');
const PORT = String(9200 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PAGE = fs.readFileSync(path.join(RACINE, 'tableau-de-bord.html'), 'utf8');
const ADMIN = '11111111-2222-3333-4444-555555555555';

(async () => {
  // --- 1) Le filtre serveur seul ---
  const tmp = path.join(os.tmpdir(), 'mw-' + process.pid + '.mjs');
  fs.writeFileSync(tmp, fs.readFileSync(path.join(RACINE, 'middleware.js')));
  const mw = (await import(tmp)).default;
  const interne = [];
  global.fetch = async (u, opts) => { interne.push(opts && opts.headers && opts.headers['x-ma2m-interne']); return new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html', 'strict-transport-security': 'max-age=63072000' } }); };
  const req = (chemin, cookie) => new Request('https://www.maitreakessemodelmanagement.com' + chemin, { headers: cookie ? { cookie } : {} });
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  ok((await mw(req('/tableau-de-bord.html'))) === undefined, 'sans clé serveur configurée : page livrée comme avant (jamais enfermée dehors)');
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-test-tres-secrete';
  const { cookieAccesTableau } = require(path.join(RACINE, 'api/_commun.js'));
  const bonneCle = cookieAccesTableau(ADMIN).split(';')[0];
  let r = await mw(req('/tableau-de-bord'));
  const html = r ? await r.text() : '';
  ok(r && r.status === 200 && /id="bloc-login"/.test(html) && /js\/connexion-tableau\.js/.test(html), 'sans clé : écran de connexion livré');
  ok(!/id="bloc-tableau"/.test(html) && !/js\/tableau-de-bord\.js/.test(html) && !/js\/tableau-v2\.js/.test(html) && !/ZONE-ADMIN/.test(html), 'sans clé : ni tableau de bord, ni scripts réservés dans la page');
  ok(r && r.headers.get('cache-control') === 'no-store' && r.headers.get('strict-transport-security'), 'sans clé : pas de mise en cache, en-têtes de sécurité gardés');
  r = await mw(req('/js/tableau-de-bord.js')); ok(r && r.status === 404, 'sans clé : script du tableau de bord introuvable');
  r = await mw(req('/js/agenda-admin.js', 'ma2m_admin=v1.' + ADMIN + '.9999999999.faussesignaturefaussesignature')); ok(r && r.status === 404, 'fausse clé : refusée');
  const perimee = 'ma2m_admin=v1.' + ADMIN + '.1000000000.' + bonneCle.split('.').pop();
  r = await mw(req('/js/agenda-admin.js', perimee)); ok(r && r.status === 404, 'clé périmée : refusée');
  ok((await mw(req('/tableau-de-bord.html', 'autre=1; ' + bonneCle))) === undefined && (await mw(req('/js/tableau-de-bord.js', bonneCle))) === undefined, 'bonne clé : page et scripts livrés');
  ok((await mw(req('/js/app.js'))) === undefined, 'scripts publics : toujours livrés');
  ok(interne.length && interne.every(x => /^\d{10}\.[\w-]+$/.test(x)), 'lecture interne de la page signée et datée');
  // le jeton interne n'ouvre jamais les scripts réservés, et ne sert plus une fois périmé
  r = await mw(new Request('https://www.maitreakessemodelmanagement.com/js/tableau-de-bord.js', { headers: { 'x-ma2m-interne': interne[0] } }));
  ok(r && r.status === 404, 'jeton interne : n\'ouvre pas les scripts réservés');
  const vieux = '1000000000.' + interne[0].split('.')[1];
  r = await mw(new Request('https://www.maitreakessemodelmanagement.com/tableau-de-bord.html', { headers: { 'x-ma2m-interne': vieux } }));
  ok(r && r.status === 200 && !/id="bloc-tableau"/.test(await r.text()), 'jeton interne périmé : page réduite');
  // la liste des scripts protégés est la même partout
  const src = fs.readFileSync(path.join(RACINE, 'middleware.js'), 'utf8');
  const duMatcher = [...src.matchAll(/'\/js\/([\w-]+)\.js'/g)].map(m => m[1]).sort();
  const duRegex = src.match(/const SCRIPTS_ADMIN = \/\^\\\/js\\\/\(([^)]+)\)/)[1].split('|').sort();
  const deLaZone = [...PAGE.matchAll(/<!-- ZONE-ADMIN[^>]*-->([\s\S]*?)<!-- \/ZONE-ADMIN -->/g)].flatMap(m => [...m[1].matchAll(/src="js\/([\w-]+)\.js"/g)].map(x => x[1]));
  const publics = ['tailles', 'analyse-profil'];  // aussi utilisés par d'autres pages
  ok(JSON.stringify(duMatcher) === JSON.stringify(duRegex) && deLaZone.every(n => duRegex.includes(n) || publics.includes(n)), 'scripts protégés : même liste dans le filtre et dans la page (' + duRegex.length + ')');
  // côté serveur (api/acces-tableau.js) : une clé valide permet de la prolonger sans redemander le code
  const { cleAccesTableauValide } = require(path.join(RACINE, 'api/_commun.js'));
  ok(cleAccesTableauValide({ headers: { cookie: bonneCle } }, ADMIN) && !cleAccesTableauValide({ headers: { cookie: perimee } }, ADMIN) && !cleAccesTableauValide({ headers: { cookie: bonneCle } }, 'aaaaaaaa-2222-3333-4444-555555555555'), 'serveur : clé valide reconnue, périmée ou d\'un autre compte refusée');
  fs.unlinkSync(tmp);

  // --- 2) Comme une visiteuse : page réduite → connexion → code → rechargement → tableau de bord ---
  const reduite = PAGE.replace(/<!-- ZONE-ADMIN[^>]*-->[\s\S]*?<!-- \/ZONE-ADMIN -->/g, '');
  let cle = false, sansCode = false; const journal = []; const appels = [];
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE }); await new Promise(r2 => setTimeout(r2, 800));
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await brancher(p, { tables: { admins: [{ user_id: 'admin-1' }], model_photos: [] }, rpc: { code_validation_statut: [{ defini: true, email_recuperation: 'a@b.ci' }] } }, journal);
  await p.route(/\/api\/(code-validation-protege|acces-tableau)/, r2 => { appels.push(r2.request().method() + ' ' + new URL(r2.request().url()).pathname); if (/code-validation/.test(r2.request().url()) || (sansCode && r2.request().method() === 'POST')) cle = true; if (r2.request().method() === 'DELETE') cle = false; r2.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await p.route(/\/tableau-de-bord\.html/, r2 => r2.fulfill({ status: 200, contentType: 'text/html', body: cle ? PAGE : reduite }));
  await p.route(/\/js\/(tableau-de-bord|tableau-v2|agenda-admin)\.js/, r2 => cle ? r2.continue() : r2.fulfill({ status: 404, body: 'Introuvable' }));
  await p.goto('http://127.0.0.1:' + PORT + '/tableau-de-bord.html'); await p.waitForTimeout(2000);
  ok(await p.isVisible('#tb-email') && !(await p.$('#bloc-tableau')), 'visiteuse : écran de connexion, pas de tableau de bord');
  await p.fill('#tb-email', 'admin@test.ci'); await p.fill('#tb-password', 'motdepasse'); await p.click('#tb-login-btn');
  await p.waitForSelector('#tb-code-validation', { state: 'visible', timeout: 8000 }).catch(() => {});
  ok(await p.isVisible('#tb-code-validation'), 'après le mot de passe : le code de validation est demandé');
  await p.fill('#tb-code-validation', '1234'); await p.click('#tb-code-validation-valider');
  await p.waitForSelector('#bloc-tableau', { state: 'attached', timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(3000);
  ok(await p.evaluate(() => { const t = document.getElementById('bloc-tableau'); return !!t && getComputedStyle(t).display !== 'none'; }), 'après le code : la page se recharge et le tableau de bord s\'ouvre');
  // déconnexion : la clé est effacée
  await p.evaluate(() => deconnecterTableauDeBord()); await p.waitForTimeout(800);
  ok(appels.includes('DELETE /api/acces-tableau') && !cle, 'déconnexion : clé d\'accès effacée');
  // compte admin SANS code de validation : la clé est demandée juste après le mot de passe
  sansCode = true; cle = false;
  const p2 = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p2.on('pageerror', e => errs.push(e.message));
  await brancher(p2, { tables: { admins: [{ user_id: 'admin-1' }], model_photos: [] }, rpc: { code_validation_statut: [{ defini: false }] } }, []);
  await p2.route(/\/api\/(code-validation-protege|acces-tableau)/, r2 => { if (r2.request().method() === 'POST') cle = true; r2.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await p2.route(/\/tableau-de-bord\.html/, r2 => r2.fulfill({ status: 200, contentType: 'text/html', body: cle ? PAGE : reduite }));
  await p2.goto('http://127.0.0.1:' + PORT + '/tableau-de-bord.html'); await p2.waitForTimeout(1500);
  await p2.fill('#tb-email', 'admin@test.ci'); await p2.fill('#tb-password', 'motdepasse'); await p2.click('#tb-login-btn');
  await p2.waitForSelector('#bloc-tableau', { state: 'attached', timeout: 10000 }).catch(() => {}); await p2.waitForTimeout(2500);
  ok(await p2.evaluate(() => { const t = document.getElementById('bloc-tableau'); return !!t && getComputedStyle(t).display !== 'none'; }), 'compte sans code : tableau de bord ouvert après le mot de passe');
  ok(!errs.length, 'aucune erreur de page ' + errs.slice(0, 3).join(' | '));
  await b.close(); srv.kill();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})().catch(e => { console.log('❌ ÉCHEC', e.stack); process.exit(1); });
