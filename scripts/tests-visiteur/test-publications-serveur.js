// Site dynamique, étape 2 (01/11/2026, PLAN-SERVEUR.md) : actualités et événements partent DÉJÀ REMPLIS par le
// serveur (middleware.js, publicationsRemplies). Base SIMULÉE, rien n'est écrit :
//  - la liste et les photos (pour leur nombre) sont dans la page, la photo « À la une » annoncée en tête ;
//  - un titre avec des signes spéciaux ne peut rien injecter ; sa propre demande de la page passe sans boucle ;
//  - base lente ou en panne, robot d'aperçu, requête autre que GET : la page part comme avant ;
//  - dans le navigateur (téléphone et ordinateur, français et anglais) : la page s'affiche sans redemander la
//    liste ni les photos à la base, et un article s'ouvre toujours.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path'), fs = require('fs'), os = require('os'), { pathToFileURL } = require('url');
const RACINE = path.resolve(__dirname, '../..');
const PORT = String(9100 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const { tables: t0, rpc } = require('./pages-publiques');
const tables = JSON.parse(JSON.stringify(t0));
tables.actualites = [{ ...tables.actualites[0], commentaire: '<p>Grand casting.</p>' }, { id: 'n2', titre: 'Atelier <img src=x onerror=alert(1)>', categorie: 'Atelier', commentaire: '<p>Deux</p>', created_at: '2026-09-01T10:00:00Z', image_url: 'https://x/actu2.jpg' }];
tables.actualite_photos = [{ id: 'ap1', actualite_id: 'n1', url: 'https://x/a1.jpg' }, { id: 'ap2', actualite_id: 'n1', url: 'https://x/a2.jpg' }];
tables.evenements = [{ ...tables.evenements[0], description: '<p>Défilé.</p>', lieu: 'Sofitel' }, { id: 'e2', titre: 'Gala', date_evenement: '2026-08-01', created_at: '2026-08-02T10:00:00Z', image_url: 'https://x/even2.jpg' }];
tables.evenement_photos = [{ id: 'ep1', evenement_id: 'e1', url: 'https://x/e1.jpg' }];
let basePanne = false, baseLente = 0;
const json = (x) => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });

async function middleware() {
  const copie = path.join(os.tmpdir(), 'mw-publi-' + process.pid + '.mjs');
  fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
  globalThis.fetch = async (u, o = {}) => {
    u = String(u);
    if (u.includes('supabase.co')) {
      if (basePanne) throw new Error('base en panne');
      if (baseLente) await new Promise((r, x) => { const m = setTimeout(r, baseLente); if (o.signal) o.signal.addEventListener('abort', () => { clearTimeout(m); x(new Error('abandon')); }); });
      const table = new URL(u).pathname.split('/').pop();
      return json(tables[table] || []);
    }
    const p = new URL(u).pathname;
    return new Response(fs.readFileSync(path.join(RACINE, p.replace(/^\//, '') + '.html'), 'utf8'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  return (await import(pathToFileURL(copie).href)).default;
}
const donneesDe = (html) => JSON.parse((html.match(/<script type="application\/json" id="publications-donnees">(.*?)<\/script>/) || [])[1] || 'null');

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const mw = await middleware();
  const demander = (chemin, init) => mw(new Request('https://www.maitreakessemodelmanagement.com/' + chemin, init));
  const PAGES = [['actualites', 'actus', 'https://x/actu.jpg', 3], ['en/actualites', 'actus', 'https://x/actu.jpg', 3], ['evenements', 'evenements', 'https://x/even.jpg', 2], ['en/evenements', 'evenements', 'https://x/even.jpg', 2]];

  // 1. Le serveur seul
  const pages = {};
  for (const [chemin, , une, nbPhotos] of PAGES) {
    const r = await demander(chemin);
    const html = r ? await r.text() : '';
    pages[chemin] = html;
    const d = html && donneesDe(html);
    ok(d && d.liste.length === 2 && d.photos.length === nbPhotos - 1, chemin + ' : la liste et les photos sont dans la page');
    ok(html.includes('<link rel="preload" as="image" fetchpriority="high" href="' + une + '">'), chemin + ' : la photo « À la une » est annoncée dans l’en-tête');
    ok(!/<img src=x onerror/.test(html), chemin + ' : un titre avec des signes spéciaux ne peut rien injecter');
    ok(r && /no-cache/.test(r.headers.get('cache-control') || ''), chemin + ' : jamais gardée en cache (un article publié se voit tout de suite)');
  }
  ok(await demander('actualites', { headers: { 'x-ma2m-remplie': '1' } }) === undefined, 'sa propre demande de la page passe sans boucle');
  ok(await demander('actualites', { method: 'HEAD' }) === undefined, 'seulement les visites (GET)');
  ok(await demander('actualites', { headers: { 'user-agent': 'WhatsApp/2.23' } }) === undefined, 'robot d’aperçu sur la liste : la page habituelle');
  baseLente = 1500; const t = Date.now();
  ok(await demander('evenements') === undefined && Date.now() - t < 2500, 'base lente : la page part comme avant, sans attendre (' + (Date.now() - t) + ' ms)');
  baseLente = 0; basePanne = true;
  ok(await demander('evenements') === undefined, 'base en panne : la page part comme avant');
  basePanne = false;

  // 2. Dans le navigateur
  const b = await chromium.launch();
  for (const [chemin, prefixe] of PAGES) {
    for (const vp of [{ width: 390, height: 844, mobile: true }, { width: 1280, height: 860 }]) {
      const n = chemin + ' ' + vp.width + 'px : ';
      const p = await (await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile })).newPage(); const errs = [];
      p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (dl) => { errs.push('fenêtre : ' + dl.message()); dl.dismiss(); });
      await brancher(p, { tables, rpc }, []);
      let lectures = 0;
      p.on('request', (r) => { const u = r.url(); if (/\/rest\/v1\/(actualites|evenements)\?.*order=/.test(u) || /\/rest\/v1\/(actualite|evenement)_photos\?select=(actualite|evenement)_id$/.test(u)) lectures++; });
      await p.route(new RegExp('/' + chemin.replace(/\//g, '\\/') + '$'), (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pages[chemin] }));
      await p.goto('http://127.0.0.1:' + PORT + '/' + chemin, { waitUntil: 'domcontentloaded' });
      await p.waitForFunction((g) => document.querySelectorAll('#' + g + '-grille .news-carte, #' + g + '-une .news-une').length >= 2, prefixe, { timeout: 15000 });
      await p.waitForTimeout(800);
      ok(!lectures, n + 's’affiche sans redemander la liste ni les photos à la base (' + lectures + ')');
      ok(!(await p.$('img[src="x"]')), n + 'rien d’injecté');
      await p.click('#' + prefixe + '-une .news-une'); await p.waitForTimeout(800);
      ok(await p.isVisible('#news-modal'), n + 'un article s’ouvre toujours');
      ok(!errs.length, n + 'aucune erreur' + (errs.length ? ' — ' + errs[0] : ''));
      await p.context().close();
    }
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
})();
