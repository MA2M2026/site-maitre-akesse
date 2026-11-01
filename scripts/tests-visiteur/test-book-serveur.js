// Site dynamique, étape 2 (01/11/2026, PLAN-SERVEUR.md) : The Book (/mannequins) part DÉJÀ REMPLI par le
// serveur (middleware.js, bookRempli). Base SIMULÉE, rien n'est écrit :
//  - le serveur pose dans la page la liste des mannequins publiées et leurs photos de couverture ;
//  - un nom avec des signes spéciaux ne peut rien injecter ; sa propre demande de la page passe sans boucle ;
//  - base lente ou en panne, robot d'aperçu, requête autre que GET : la page part comme avant ;
//  - dans le navigateur (téléphone et ordinateur, français et anglais) : le Book s'affiche sans redemander
//    la liste ni les photos à la base, et la recherche marche.
// copies de middleware.js DANS le dépôt (01/11/2026 : il importe js/rendu-*.js par un chemin relatif)
const dossierCopies = () => require('path').resolve(__dirname, '../..');
// (mémoire de 3 minutes du serveur coupée : chaque essai lit la base simulée telle qu'il la règle)
globalThis.MA2M_SANS_MEMOIRE = true;
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
const rpcs = { ...rpc, photos_couverture_mannequins: couvertures, photos_couverture_petites: couvertures,
  mannequin_du_mois_actuelle: { mois: '2026-11-01', nom: 'Mariam Bamba', compte: 'a3', slug: 'mariam', mot: null } };  // (chantier 14)
let basePanne = false, baseLente = 0;
const json = (x) => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });

async function middleware() {
  const copie = path.join(dossierCopies(), 'mw-book-' + process.pid + '.mjs');
  fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
  globalThis.fetch = async (u, o = {}) => {
    u = String(u);
    if (u.includes('supabase.co')) {
      if (basePanne) throw new Error('base en panne');
      if (baseLente) await new Promise((r, x) => { const m = setTimeout(r, baseLente); if (o.signal) o.signal.addEventListener('abort', () => { clearTimeout(m); x(new Error('abandon')); }); });
      if (u.includes('model_profiles')) return json(profils.map(({ published: _p, featured: _f, genre: _g, ...x }) => x));  // (le nom d'adresse « slug » est public : /book/nom)
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
    ok(d && !/published|phone|email|naissance/.test(JSON.stringify(d.profils)), chemin + ' : rien de plus que ce que le Book montre (et le nom d’adresse de la fiche)');
    ok(!/<img src=x onerror/.test(html) && /\\u003cimg src=x onerror/.test(html), chemin + ' : un nom avec des signes spéciaux ne peut rien injecter');
    ok(r && /no-cache/.test(r.headers.get('cache-control') || ''), chemin + ' : jamais gardé par le navigateur (le serveur, lui, garde la liste 3 minutes au plus)');
  }
  // étape A (01/11/2026) : les CARTES elles-mêmes sont dans le HTML (sans aucun programme), dans l'ordre alphabétique
  for (const chemin of ['mannequins', 'en/mannequins']) {
    const visible = pages[chemin].replace(/<script[\s\S]*?<\/script>/g, '');
    const noms = [...visible.matchAll(/<div class="medaillon-nom">([^<]*)<\/div>/g)].map((m) => m[1]);
    ok(noms.length === 3 && noms[0] === 'Awa Koné' && noms[1] === 'Grâce &lt;img src=x onerror=alert(1)&gt;' && noms.includes('Mariam Bamba') && /data-serveur="1"/.test(visible), chemin + ' : les cartes (noms, photos) sont écrites dans le HTML avant tout programme ' + noms.join(' | '));
    ok(/<span id="f-compte">3 (profils correspondent|profiles)<\/span>/.test(visible) && /src="https:\/\/x\/1\.jpg"/.test(visible), chemin + ' : le nombre de profils et les photos aussi');
    // (01/11/2026, demande de la propriétaire : la fiche ouverte depuis une carte arrivait vide ≈ 3,6 s) la carte va
    // DIRECTEMENT à la fiche écrite par le serveur (/book/nom) ; sans nom d'adresse, l'ancienne adresse
    const en = chemin.startsWith('en/') ? '/en' : '';
    ok(visible.includes('href="' + en + '/book/mariam"') && visible.includes('href="' + en + '/book/grace"') && visible.includes('href="' + en + '/book/' + base.slug + '"')
      && globalThis.RenduBook.lienFiche({ id: 'x1' }, false) === 'mannequin.html?id=x1' && globalThis.RenduBook.lienFiche({ id: 'x1', slug: 'a/b' }, true) === 'mannequin.html?id=x1',
      chemin + ' : chaque carte va directement à la fiche préparée par le serveur (' + en + '/book/nom)');
  }
  {
    const regles = JSON.parse(fs.readFileSync(path.join(RACINE, 'regles-fiches.json'), 'utf8'));
    const vercel = JSON.parse(fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8'));
    const annonce = (src) => vercel.headers.some((h) => h.source === src && h.headers.some((x) => x.key === 'Speculation-Rules' && x.value === '"/regles-fiches.json"'));
    const typeJson = vercel.headers.some((h) => h.source === '/regles-fiches.json' && h.headers.some((x) => x.key === 'Content-Type' && x.value === 'application/speculationrules+json'));
    ok(regles.prerender[0].eagerness === 'moderate' && JSON.stringify(regles).includes('/book/*') && JSON.stringify(regles).includes('/en/book/*') && annonce('/') && annonce('/(en|mannequins|en/mannequins)') && typeJson,
      'Chrome et Android : la fiche est préparée dès que le doigt touche une carte (règles annoncées sur l’accueil et le Book)');
  }
  {
    const filtre = await (await demander('mannequins?categorie=homme')).text();
    ok(donneesDe(filtre) && !/<div class="medaillon-nom">/.test(filtre.replace(/<script[\s\S]*?<\/script>/g, '')), 'Book filtré par l’adresse (?categorie=) : données dans la page, mais pas de cartes qui disparaîtraient aussitôt');
  }
  {
    const tel = await (await demander('mannequins', { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Mobile' } })).text();
    ok(/<img src="https:\/\/x\/[123]\.jpg"/.test(tel), 'téléphone : la page part avec ses cartes');
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
  // mémoire de 3 minutes : la base n'est lue qu'une fois pour plusieurs visites ; une base en panne juste après
  // ne casse rien (la page garde la liste lue)
  {
    globalThis.MA2M_SANS_MEMOIRE = false;
    let lectures = 0; const vraiFetch = globalThis.fetch;
    globalThis.fetch = (u, o) => { if (String(u).includes('model_profiles')) lectures++; return vraiFetch(u, o); };
    await demander('mannequins'); await demander('mannequins'); basePanne = true;
    const r3 = await (await demander('mannequins')).text();
    ok(lectures === 1 && /<div class="medaillon-nom">Mariam Bamba<\/div>/.test(r3), 'mémoire de 3 minutes : la base n’est lue qu’une fois pour 3 visites (' + lectures + ')');
    globalThis.fetch = vraiFetch; basePanne = false; globalThis.MA2M_SANS_MEMOIRE = true;
  }

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
    ok((await p.getAttribute('.mannequin-du-mois', 'href')) === (chemin.startsWith('en/') ? '/en' : '') + '/book/mariam' && /Mariam Bamba/.test(await p.textContent('.mannequin-du-mois')), n + 'bandeau « Mannequin du mois » en haut du Book, vers sa fiche');
    // le doigt touche une carte : la fiche est demandée pendant le geste (tous les navigateurs)
    await p.evaluate(() => { const c = document.getElementById('f-recherche'); c.value = ''; c.dispatchEvent(new Event('input', { bubbles: true })); });
    const lien = (chemin.startsWith('en/') ? '/en' : '') + '/book/mariam';
    await p.dispatchEvent('#grille a[href="' + lien + '"]', 'pointerdown');
    ok(await p.evaluate((l) => [...document.querySelectorAll('link[rel="prefetch"]')].some((x) => x.href === location.origin + l), lien), n + 'le doigt touche une carte : la fiche est demandée tout de suite (prête à l’ouverture)');
    ok(!errs.length, n + 'aucune erreur' + (errs.length ? ' — ' + errs[0] : ''));
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
})();
