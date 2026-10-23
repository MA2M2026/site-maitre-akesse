// Accueil servi « déjà rempli » (middleware.js, 23/10/2026, demande de la propriétaire : photos de
// l'accueil trop lentes à la première visite, même en Wi-Fi). Comme un visiteur, téléphone et
// ordinateur, français et anglais, base SIMULÉE (rien n'est écrit) :
//  - le serveur pose la liste des mannequins et la photo de couverture dans la page ;
//  - la photo de couverture part tout de suite (avant les programmes de la page), depuis
//    Cloudflare ; le navigateur ne redemande pas la liste à la base ;
//  - Cloudflare muet : la photo arrive par la roue de secours Vercel (/book-photos/) ;
//  - base en panne côté serveur : la page part comme avant (la page se remplit elle-même).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path'), fs = require('fs'), os = require('os'), { pathToFileURL } = require('url');
const RACINE = path.resolve(__dirname, '../..');
const PORT = String(9600 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const IMAGE = fs.readFileSync(path.join(__dirname, 'medias', 'photo0.jpg'));
const CF = 'https://photos.maitreakessemodelmanagement.com/';
const profils = [
  { id: 'a1', full_name: 'AWA UNE', city: 'Abidjan', category: 'femme', height_cm: 175, featured: true },
  { id: 'a2', full_name: 'MARIAM <i>DEUX</i>', city: 'Abidjan', category: 'femme' },
  { id: 'a3', full_name: 'GRÂCE TROIS', city: 'Abidjan', category: 'femme' },
  { id: 'a4', full_name: 'KOFFI QUATRE', city: 'Abidjan', category: 'homme' }];
const photo = (id) => CF + id + '/miniatures/179000000000' + id.slice(1) + '-abc-w.jpg';

// le middleware, avec une base simulée et la page lue sur le disque
let basePanne = false, appelsBase = 0;
async function middleware() {
  const copie = path.join(os.tmpdir(), 'mw-essai-' + process.pid + '.mjs');
  fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
  globalThis.fetch = async (u, o = {}) => {
    u = String(u);
    if (u.includes('supabase.co')) {
      appelsBase++;
      if (basePanne) throw new Error('base en panne');
      const corps = u.includes('model_profiles') ? profils : profils.map((p) => ({ model_id: p.id, url: photo(p.id) }));
      return new Response(JSON.stringify(corps), { headers: { 'content-type': 'application/json' } });
    }
    const chemin = new URL(u).pathname.startsWith('/en') ? 'en/index.html' : 'index.html';
    return new Response(fs.readFileSync(path.join(RACINE, chemin), 'utf8'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  return (await import(pathToFileURL(copie).href)).default;
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const mw = await middleware();
  const pageServeur = async (chemin) => { const r = await mw(new Request('https://www.maitreakessemodelmanagement.com/' + chemin)); return r ? r.text() : null; };

  // le serveur seul : page remplie, rien d'injectable, mémoire de 5 minutes, panne → page normale
  const html = await pageServeur('');
  const donnees = html && JSON.parse((html.match(/<script type="application\/json" id="accueil-donnees">(.*?)<\/script>/) || [])[1] || 'null');
  ok(donnees && donnees.profils.length === 4 && donnees.nombre === 4, 'serveur : la liste des mannequins publiées est dans la page');
  ok(/<link rel="preload" as="image" href="https:\/\/photos\.maitreakessemodelmanagement\.com\/[^"]+-w\.webp" fetchpriority="high">\s*<\/head>/.test(html), 'serveur : la photo de couverture est annoncée en tête de page (WebP, Cloudflare)');
  ok(/<img id="couv-img" class="visible" src="https:\/\/photos\.maitreakessemodelmanagement\.com\/[^"]+" alt="[^"]+" data-modele="a[234]"/.test(html), 'serveur : la photo de couverture est déjà en place (pas la mannequin « À la une »)');
  ok(!/<i>DEUX/.test(html) && /MARIAM \\u003ci\\u003eDEUX/.test(html), 'serveur : un nom avec des signes spéciaux ne peut rien injecter dans la page');
  const avant = appelsBase; await pageServeur('en/');
  ok(appelsBase === avant, 'serveur : 2e visite servie de mémoire (pas de nouvelle question à la base)');
  ok(await mw(new Request('https://www.maitreakessemodelmanagement.com/', { headers: { 'x-ma2m-accueil': '1' } })) === undefined, 'serveur : sa propre demande de la page passe sans boucle');
  ok(await mw(new Request('https://www.maitreakessemodelmanagement.com/', { method: 'HEAD' })) === undefined, 'serveur : seulement les visites (GET)');

  const b = await chromium.launch();
  for (const [langue, chemin] of [['FR', ''], ['EN', 'en/']]) {
    for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
      for (const cloudflare of [true, false]) {
        const n = langue + ' · ' + nom + (cloudflare ? '' : ' · Cloudflare muet') + ' : ';
        const page = await pageServeur(chemin);
        const ctx = await b.newContext({ viewport: ecran, isMobile: ecran.width < 700, hasTouch: ecran.width < 700, serviceWorkers: 'block' });
        const p = await ctx.newPage(); const errs = [], journal = [], ordre = [];
        p.on('pageerror', (e) => errs.push(e.message));
        p.on('request', (r) => ordre.push(r.url()));
        await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ } });
        await brancher(p, { tables: { model_profiles: profils, model_photos: [] }, rpc: { photos_couverture_mannequins: profils.map((x) => ({ model_id: x.id, url: photo(x.id) })) } }, journal);
        await p.route(/^https:\/\/photos\.maitreakessemodelmanagement\.com\//, (r) => cloudflare ? r.fulfill({ status: 200, contentType: 'image/webp', body: IMAGE }) : r.abort());
        await p.route(/\/book-photos\//, (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: IMAGE }));
        await p.route('http://127.0.0.1:' + PORT + '/' + chemin, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: page }));
        await p.goto('http://127.0.0.1:' + PORT + '/' + chemin);
        await p.waitForFunction(() => { const i = document.getElementById('couv-img'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
        await p.waitForTimeout(1500);
        const couv = await p.evaluate(() => { const i = document.getElementById('couv-img'); return { src: i.currentSrc || i.src, largeur: i.naturalWidth, modele: i.dataset.modele, credit: document.getElementById('couv-modele-nom').textContent }; });
        const premiere = ordre.findIndex((u) => u.includes('/miniatures/')), accueilJs = ordre.findIndex((u) => /\/js\/accueil\.js/.test(u));
        ok(couv.largeur > 0, n + 'la photo de couverture s’affiche' + (cloudflare ? '' : ' (par la roue de secours : ' + couv.src.replace(/^https?:\/\/[^/]+/, '').slice(0, 30) + '…)'));
        ok(premiere >= 0 && premiere < accueilJs, n + 'la photo est demandée avant même les programmes de la page');
        if (cloudflare) ok(couv.src.startsWith(CF), n + 'la photo vient de Cloudflare');
        else ok(/\/book-photos\//.test(couv.src), n + 'Cloudflare muet : la photo vient de la copie Vercel');
        const attendu = profils.find((x) => x.id === couv.modele) || {};
        ok(couv.credit === attendu.full_name, n + '« En couverture » : le nom de la mannequin en photo (' + couv.credit + ')');
        ok(!journal.some((j) => j[0] === 'rpc' && j[1] === 'photos_couverture_mannequins') && !(await p.evaluate(() => performance.getEntriesByType('resource').some((e) => /model_profiles/.test(e.name)))), n + 'le navigateur ne redemande pas la liste à la base');
        ok((await p.$$('#grille-femmes a')).length === 3 && (await p.$$('#grille-hommes a')).length === 1 && /AWA UNE/.test(await p.textContent('#une-nom')), n + 'visages des femmes, des hommes et « À la une » remplis');
        ok(/4 (mannequins à découvrir|models to discover)/.test(await p.textContent('#couv-nombre')), n + 'nombre de mannequins sur la couverture');
        ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
        await ctx.close();
      }
    }
  }
  // base en panne côté serveur : page normale, remplie par le navigateur comme avant
  basePanne = true;
  const mw2 = await (async () => { const copie = path.join(os.tmpdir(), 'mw-essai2-' + process.pid + '.mjs'); fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie); return (await import(pathToFileURL(copie).href)).default; })();
  const t0 = Date.now(), r = await mw2(new Request('https://www.maitreakessemodelmanagement.com/'));
  ok(r === undefined && Date.now() - t0 < 2000, 'base en panne côté serveur : la page part comme avant, sans attendre');
  const t1 = Date.now(); await mw2(new Request('https://www.maitreakessemodelmanagement.com/'));
  ok(Date.now() - t1 < 200, 'base en panne : la visite suivante n’attend pas la base');
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
