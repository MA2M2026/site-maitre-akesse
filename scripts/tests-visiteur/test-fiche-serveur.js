// Site dynamique, étape 1 (01/11/2026, PLAN-SERVEUR.md, décision de la propriétaire) : la fiche d'un
// mannequin (/book/nom) part DÉJÀ REMPLIE par le serveur (middleware.js). Base SIMULÉE, rien n'est écrit :
//  - le serveur pose dans la page le profil, les photos et l'âge (jamais la date de naissance ni les
//    coordonnées), le vrai titre, la description, l'adresse canonique et la grande photo annoncée en tête ;
//  - un nom avec des signes spéciaux ne peut rien injecter ; sa propre demande de la page passe sans boucle ;
//  - base lente (> 1,2 s) ou en panne, profil non publié : la fiche part comme avant (elle se remplit seule) ;
//  - dans le navigateur (téléphone et ordinateur, français et anglais) : la fiche s'affiche sans redemander
//    à la base le profil, les photos, l'âge ni l'identité, et la grande photo part tout de suite.
// copies de middleware.js DANS le dépôt (01/11/2026 : il importe js/rendu-*.js par un chemin relatif)
const dossierCopies = () => require('path').resolve(__dirname, '../..');
// (mémoire de 3 minutes du serveur coupée : chaque essai lit la base simulée telle qu'il la règle)
globalThis.MA2M_SANS_MEMOIRE = true;
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path'), fs = require('fs'), os = require('os'), { pathToFileURL } = require('url');
const RACINE = path.resolve(__dirname, '../..');
const PORT = String(9300 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const ID = '4f6c1d2e-8a3b-4c5d-9e0f-1a2b3c4d5e6f';
// les données des pages publiques, avec un vrai identifiant (le serveur n'accepte que ceux-là)
const { tables: t0, rpc } = require('./pages-publiques');
const tables = JSON.parse(JSON.stringify(t0).replace(/"a1"/g, '"' + ID + '"'));
const profil = tables.model_profiles.find((p) => p.id === ID);
let basePanne = false, baseLente = 0, nomPiege = false, nonPublie = false, nomDollar = false;
const json = (x) => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });

async function middleware() {
  const copie = path.join(dossierCopies(), 'mw-fiche-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.mjs');
  fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
  globalThis.fetch = async (u, o = {}) => {
    u = String(u);
    if (u.includes('supabase.co')) {
      if (basePanne) throw new Error('base en panne');
      if (baseLente) await new Promise((r, x) => { const m = setTimeout(r, baseLente); if (o.signal) o.signal.addEventListener('abort', () => { clearTimeout(m); x(new Error('abandon')); }); });
      if (u.includes('slug=eq.')) return json([{ id: ID }]);
      if (u.includes('model_profiles')) return json(nonPublie ? [] : [{ ...profil, full_name: nomDollar ? "Awa $' $& $` Koné" : nomPiege ? 'Awa <script>alert(1)</script> "Koné"' : profil.full_name, date_naissance: undefined, slug: undefined, published: undefined, featured: undefined, genre: undefined }]);
      if (u.includes('model_photos')) return json(tables.model_photos.filter((p) => p.model_id === ID));
      if (u.includes('ages_mannequins')) return json([{ id: ID, age: 19 }]);
      return json([]);
    }
    const chemin = new URL(u).pathname.startsWith('/en') ? 'en/mannequin.html' : 'mannequin.html';
    return new Response(fs.readFileSync(path.join(RACINE, chemin), 'utf8'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  return (await import(pathToFileURL(copie).href)).default;
}
const donneesDe = (html) => JSON.parse((html.match(/<script type="application\/json" id="fiche-donnees">(.*?)<\/script>/) || [])[1] || 'null');

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const mw = await middleware();
  const demander = (chemin, init) => mw(new Request('https://www.maitreakessemodelmanagement.com/' + chemin, init));
  const reecrite = (r) => !!(r && r.headers.get('x-middleware-rewrite'));

  // 1. Le serveur seul
  const pages = {};
  for (const [chemin, en] of [['book/awa-kone', false], ['en/book/awa-kone', true]]) {
    const r = await demander(chemin);
    const html = r && !reecrite(r) ? await r.text() : '';
    pages[chemin] = html;
    const d = html && donneesDe(html);
    ok(d && d.id === ID && d.slug === 'awa-kone' && d.profil.full_name === 'Awa Koné' && d.photos.length === 1 && d.age === 19, chemin + ' : profil, photos et âge sont dans la page');
    ok(d && !('date_naissance' in d.profil) && !/phone|email|telephone|parent/i.test(JSON.stringify(d.profil)), chemin + ' : ni date de naissance ni coordonnées dans la page');
    ok(/<title>Awa Koné · Maître Akesse Model Management<\/title>/.test(html), chemin + ' : le vrai titre de la mannequin (lu par Google sans programme)');
    ok(new RegExp('<meta name="description" content="Awa Koné · Abidjan · 178 cm · ' + (en ? 'Full book' : 'Book complet')).test(html), chemin + ' : la vraie description');
    ok(html.includes('<link rel="canonical" href="https://www.maitreakessemodelmanagement.com' + (en ? '/en' : '') + '/book/awa-kone">'), chemin + ' : adresse canonique /book/…');
    ok(/<link rel="preload" as="image" fetchpriority="high" href="https:\/\/x\/1\.jpg">\n<\/head>/.test(html), chemin + ' : la grande photo est annoncée dans l’en-tête');
    ok(r && /no-cache/.test(r.headers.get('cache-control') || ''), chemin + ' : jamais gardée en cache (une fiche modifiée se voit tout de suite)');
  }
  nomPiege = true;
  const piege = await (await demander('book/awa-kone')).text();
  ok(!/<script>alert/.test(piege) && /\\u003cscript\\u003ealert/.test(piege) && /<title>Awa &lt;script&gt;/.test(piege), 'un nom avec des signes spéciaux ne peut rien injecter (bloc de données, titre)');
  nomPiege = false;
  // relecture du 01/11/2026 : « $' », « $& » dans un texte de la base ne sont jamais lus comme motifs de remplacement
  nomDollar = true;
  const dollar = await (await demander('book/awa-kone')).text();
  ok((dollar.match(/<body>/g) || []).length === 1 && donneesDe(dollar).profil.full_name === "Awa $' $& $` Koné" && dollar.includes("<title>Awa $&#39; $&amp; $` Koné"), 'un nom avec « $\' » ou « $& » : page intacte, titre et données justes');
  nomDollar = false;
  ok(await demander('mannequin.html?id=' + ID) === undefined, 'adresse en .html : pas préparée, le renvoi vers l’adresse propre reste');
  ok(await demander('mannequin', { headers: { 'x-ma2m-remplie': '1' } }) === undefined, 'sa propre demande de la page passe sans boucle');
  ok(reecrite(await demander('book/awa-kone', { method: 'HEAD' })), 'seulement les visites (GET) : sinon comme avant');
  baseLente = 1500; let t = Date.now();
  const lente = await demander('book/awa-kone');
  ok((reecrite(lente) || (lente && !(await lente.text()).includes('fiche-donnees'))) && Date.now() - t < 3000, 'base lente : la fiche part comme avant (sans données), en moins de 3 s (' + (Date.now() - t) + ' ms)');
  baseLente = 0; nonPublie = true;
  { const r = await demander('book/awa-kone'); ok(reecrite(r) || (r && !(await r.text()).includes('fiche-donnees')), 'profil non publié entre-temps : comme avant (la page le dit elle-même)'); }
  nonPublie = false; basePanne = true;
  const panne = await demander('book/awa-kone');
  ok(!panne || reecrite(panne) || panne.status === 302, 'base en panne : comme avant, jamais de page cassée');
  basePanne = false;

  // 2. Dans le navigateur : la fiche servie par le serveur
  const b = await chromium.launch();
  for (const [chemin, vp] of [['book/awa-kone', { width: 390, height: 844, mobile: true }], ['en/book/awa-kone', { width: 1280, height: 860 }]]) {
    const n = chemin + ' ' + vp.width + 'px : ';
    const p = await (await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile })).newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables, rpc }, []);
    const nombre = {}; let photo = 0; const t0 = Date.now();
    p.on('request', (r) => {
      const u = r.url();
      if (/model_profiles\?.*slug=eq\./.test(u)) nombre.identite = (nombre.identite || 0) + 1;
      else if (/model_profiles\?.*select=[^&]*bio/.test(u)) nombre.profil = (nombre.profil || 0) + 1;
      if (/\/rest\/v1\/model_photos\?.*model_id=eq\./.test(u)) nombre.photos = (nombre.photos || 0) + 1;
      if (/ages_mannequins/.test(u)) nombre.age = (nombre.age || 0) + 1;
      if (/https:\/\/x\/1\.jpg/.test(u)) photo = photo || Date.now() - t0;
    });
    await p.route(new RegExp('/' + chemin.replace(/\//g, '\\/') + '$'), (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pages[chemin] }));
    await p.goto('http://127.0.0.1:' + PORT + '/' + chemin, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => /Awa Koné/.test(document.getElementById('contenu')?.textContent || ''), null, { timeout: 15000 });
    await p.waitForTimeout(800);
    ok(!nombre.profil && !nombre.photos && !nombre.age && !nombre.identite, n + 'la fiche s’affiche sans redemander profil, photos, âge ni identité à la base (' + JSON.stringify(nombre) + ')');
    ok(photo > 0, n + 'la grande photo est demandée (' + photo + ' ms)');
    ok((await p.title()) === 'Awa Koné · Maître Akesse Model Management' && (await p.$$('link[rel="canonical"]')).length === 1, n + 'titre juste et une seule adresse canonique');
    ok(/19/.test(await p.textContent('#contenu')), n + 'l’âge est affiché');
    ok(!errs.length, n + 'aucune erreur' + (errs.length ? ' — ' + errs[0] : ''));
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
})();
