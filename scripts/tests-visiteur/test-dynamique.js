// 100 % dynamique, étape 1 (01/11/2026, décision de la propriétaire) : le mur de photos derrière le titre, la liste
// des castings (candidature) sont posés dans la page par le serveur ; le téléphone ne demande plus rien à la base
// pour les afficher. Base SIMULÉE, rien n'est écrit.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const RACINE = path.resolve(__dirname, '../..');
const PORT = String(9760 + Math.floor(Math.random() * 30));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
globalThis.MA2M_SANS_MEMOIRE = true;
const json = (x) => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });
const profils = Array.from({ length: 10 }, (_, i) => ({ id: 'm' + i }));
const couvertures = profils.map((p, i) => ({ model_id: p.id, url: 'https://x/' + i + '.jpg', url_petite: 'https://x/' + i + '-p.jpg' }));
const projets = [{ id: 'c1', nom: 'Défilé Cacao <b>', description: 'Grand défilé' }];
const donneeDe = (html, id) => JSON.parse((html.match(new RegExp('<script type="application/json" id="' + id + '">(.*?)</script>')) || [])[1] || 'null');

(async () => {
  const copie = path.join(RACINE, 'mw-dyn-' + process.pid + '.mjs');
  fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
  process.on('exit', () => fs.rmSync(copie, { force: true }));
  globalThis.fetch = async (u) => {
    u = String(u);
    if (u.includes('supabase.co')) {
      if (u.includes('model_profiles?published=eq.true&select=id&')) return json(profils);
      if (u.includes('photos_couverture')) return json(couvertures);
      if (u.includes('casting_projets')) return json(projets);
      return json([]);
    }
    const page = new URL(u).pathname.replace(/^\//, '') + '.html';
    return new Response(fs.readFileSync(path.join(RACINE, page), 'utf8'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  const mw = (await import(pathToFileURL(copie).href)).default;
  const demander = async (chemin) => { const r = await mw(new Request('https://www.maitreakessemodelmanagement.com/' + chemin)); return r ? r.text() : null; };
  const pages = {};
  for (const chemin of ['contact', 'en/contact', 'candidature', 'en/candidature']) {
    pages[chemin] = await demander(chemin);
    const mur = donneeDe(pages[chemin] || '', 'mur-donnees');
    ok(Array.isArray(mur) && mur.length === 10 && mur[0] === 'https://x/0-p.jpg', chemin + ' : les visages du mur de photos sont dans la page (petites versions)');
  }
  ok((donneeDe(pages.candidature, 'page-donnees') || {}).projets?.[0]?.nom === 'Défilé Cacao <b>' && !pages.candidature.includes('Défilé Cacao <b>'), 'candidature : la liste des castings ouverts est dans la page (texte protégé)');

  // dans le navigateur : rien n'est demandé à la base pour le mur ni pour les castings
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const image = fs.readFileSync(path.join(__dirname, 'medias', 'photo1.jpg'));
  for (const [chemin, ecran] of [['contact', { width: 390, height: 844 }], ['candidature', { width: 1280, height: 900 }]]) {
    const p = await (await b.newContext({ viewport: ecran })).newPage(); const errs = [], demandes = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('request', (r) => { if (/supabase\.co\/rest\/v1\/(model_profiles|casting_projets|rpc\/photos_couverture)/.test(r.url())) demandes.push(r.url().split('/v1/')[1].split('?')[0]); });
    await brancher(p, { tables: { casting_projets: projets, model_profiles: [] }, rpc: {} }, []);
    await p.route(/https:\/\/x\//, (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: image }));
    await p.route(new RegExp('/' + chemin + '$'), (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pages[chemin] }));
    await p.goto('http://127.0.0.1:' + PORT + '/' + chemin, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
    ok((await p.$$('.mur-titre img')).length === 8 && !demandes.length && !errs.length, chemin + ' : le mur de photos s’affiche sans rien demander à la base (' + demandes.join(', ') + ') ' + errs.join(' | '));
    if (chemin === 'candidature') ok(/Défilé Cacao <b>/.test(await p.textContent('#ca-projet')), 'candidature : le casting ouvert est proposé dans la liste');
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
