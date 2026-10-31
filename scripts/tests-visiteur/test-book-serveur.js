// Site dynamique, étape 2 (01/11/2026, PLAN-SERVEUR.md) : The Book (/mannequins) part DÉJÀ REMPLI par le
// serveur (middleware.js, bookRempli). Base SIMULÉE, rien n'est écrit :
//  - le serveur pose dans la page la liste des mannequins publiées et leurs photos de couverture ;
//  - un nom avec des signes spéciaux ne peut rien injecter ; sa propre demande de la page passe sans boucle ;
//  - base lente ou en panne, robot d'aperçu, requête autre que GET : la page part comme avant ;
//  - dans le navigateur (téléphone et ordinateur, français et anglais) : le Book s'affiche sans redemander
//    la liste ni les photos à la base, et la recherche marche.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path'), fs = require('fs'), os = require('os'), { pathToFileURL } = require('url');
const RACINE = path.resolve(__dirname, '../..');
const PORT = String(9200 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const { tables: t0, rpc } = require('./pages-publiques');
const tables = JSON.parse(JSON.stringify(t0));
// trois mannequins publiées (dont une au nom piégé), une seule photo chacune
const base = tables.model_profiles[0];
const profils = [base, { ...base, id: 'a2', full_name: 'Grâce <img src=x onerror=alert(1)>', slug: 'grace' }, { ...base, id: 'a3', full_name: 'Mariam Bamba', city: 'Bouaké', slug: 'mariam' }];
tables.model_profiles = profils;
const couvertures = profils.map((p, i) => ({ model_id: p.id, url: 'https://x/' + (i + 1) + '.jpg', url_petite: null }));
const rpcs = { ...rpc, photos_couverture_mannequins: couvertures, photos_couverture_petites: couvertures };
let basePanne = false, baseLente = 0;
const json = (x) => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });

async function middleware() {
  const copie = path.join(os.tmpdir(), 'mw-book-' + process.pid + '.mjs');
  fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
  globalThis.fetch = async (u, o = {}) => {
    u = String(u);
    if (u.includes('supabase.co')) {
      if (basePanne) throw new Error('base en panne');
      if (baseLente) await new Promise((r, x) => { const m = setTimeout(r, baseLente); if (o.signal) o.signal.addEventListener('abort', () => { clearTimeout(m); x(new Error('abandon')); }); });
      if (u.includes('model_profiles')) return json(profils.map(({ slug: _s, published: _p, featured: _f, genre: _g, ...x }) => x));
      if (u.includes('photos_couverture')) return json(couvertures);
      return json([]);
    }
    const chemin = new URL(u).pathname.startsWith('/en') ? 'en/mannequins.html' : 'mannequins.html';
    return new Response(fs.readFileSync(path.join(RACINE, chemin), 'utf8'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  return (await import(pathToFileURL(copie).href)).default;
}
const donneesDe = (html) => JSON.parse((html.match(/<script type="application\/json" id="book-donnees">(.*?)<\/script>/) || [])[1] || 'null');

// base lente ou en panne : la page habituelle, sans bloc de données (aucune page cassée)
const sansDonnees = async (r) => !r || (r.status === 200 && !/application\/json" id="[a-z-]+-donnees"/.test(await r.text()));

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const mw = await middleware();
  const demander = (chemin, init) => mw(new Request('https://www.maitreakessemodelmanagement.com/' + chemin, init));

  // 1. Le serveur seul
  const pages = {};
  for (const chemin of ['mannequins', 'en/mannequins']) {
    const r = await demander(chemin);
    const html = r ? await r.text() : '';
    pages[chemin] = html;
    const d = html && donneesDe(html);
    ok(d && d.profils.length === 3 && d.photos.length === 3, chemin + ' : la liste des mannequins et leurs photos sont dans la page');
    ok(d && !/slug|published|phone|email|naissance/.test(JSON.stringify(d.profils)), chemin + ' : rien de plus que ce que le Book montre');
    ok(!/<img src=x onerror/.test(html) && /\\u003cimg src=x onerror/.test(html), chemin + ' : un nom avec des signes spéciaux ne peut rien injecter');
    ok(r && /no-cache/.test(r.headers.get('cache-control') || ''), chemin + ' : jamais gardé en cache (une mannequin publiée ou retirée se voit tout de suite)');
  }
  ok(await demander('mannequins', { headers: { 'x-ma2m-remplie': '1' } }) === undefined, 'sa propre demande de la page passe sans boucle');
  ok(await demander('mannequins', { method: 'HEAD' }) === undefined, 'seulement les visites (GET)');
  ok(await demander('mannequins.html') === undefined && await demander('en/mannequins.html') === undefined, 'adresse en .html : pas préparée, le renvoi vers l’adresse propre reste');
  ok(await demander('mannequins', { headers: { 'user-agent': 'WhatsApp/2.23' } }) === undefined, 'robot d’aperçu (WhatsApp…) : la page habituelle');
  baseLente = 1500; const t = Date.now();
  ok(await sansDonnees(await demander('mannequins')) && Date.now() - t < 2500, 'base lente : la page part comme avant (sans données, demandée une seule fois), sans attendre (' + (Date.now() - t) + ' ms)');
  baseLente = 0; basePanne = true;
  ok(await sansDonnees(await demander('mannequins')), 'base en panne : la page part comme avant');
  basePanne = false;

  // 2. Dans le navigateur
  const b = await chromium.launch();
  for (const [chemin, vp] of [['mannequins', { width: 390, height: 844, mobile: true }], ['en/mannequins', { width: 1280, height: 860 }]]) {
    const n = chemin + ' ' + vp.width + 'px : ';
    const p = await (await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile })).newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (dl) => { errs.push('fenêtre : ' + dl.message()); dl.dismiss(); });
    await brancher(p, { tables, rpc: rpcs }, []);
    const nombre = { liste: 0, photos: 0 };
    p.on('request', (r) => { const u = r.url(); if (/model_profiles\?.*published=eq\.true/.test(u) && /chest_cm/.test(u)) nombre.liste++; if (/photos_couverture/.test(u)) nombre.photos++; });
    await p.route(new RegExp('/' + chemin.replace(/\//g, '\\/') + '$'), (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pages[chemin] }));
    await p.goto('http://127.0.0.1:' + PORT + '/' + chemin, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelectorAll('#grille .medaillon-carte').length === 3, null, { timeout: 15000 });
    await p.waitForTimeout(800);
    ok(!nombre.liste && !nombre.photos, n + 'le Book s’affiche sans redemander la liste ni les photos à la base (' + JSON.stringify(nombre) + ')');
    ok(/Mariam Bamba/.test(await p.textContent('#grille')) && !(await p.$('#grille img[src="x"]')), n + 'les 3 mannequins sont là, rien d’injecté');
    await p.evaluate(() => { const c = document.getElementById('f-recherche'); c.value = 'Mariam'; c.dispatchEvent(new Event('input', { bubbles: true })); });  // (replié sur téléphone) await p.waitForTimeout(600);
    ok(await p.$$eval('#grille .medaillon-carte', (l) => l.filter((c) => c.offsetParent !== null).length) === 1, n + 'la recherche marche toujours');
    ok(!errs.length, n + 'aucune erreur' + (errs.length ? ' — ' + errs[0] : ''));
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
})();
