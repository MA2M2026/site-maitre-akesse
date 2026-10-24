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
// photos par Vercel (décision du 23/10/2026) ou par Cloudflare : lu dans js/photos.js
const ACTIVES = /const PHOTOS_DIRECTES_ACTIVES = true;/.test(fs.readFileSync(path.join(RACINE, 'js/photos.js'), 'utf8'));
const MOT = { nom: 'Maître <b>Essai</b>', titre: 'Fondateur', message: 'Bienvenue <script>x</script> & merci', photo_url: null };
const photo = (id) => CF + id + '/miniatures/179000000000' + id.slice(1) + '-abc-w.jpg';
const petite = (id) => CF + id + '/petites/179000000000' + id.slice(1) + '-abc-n480-w.jpg';  // (24/10/2026)

// le middleware, avec une base simulée et la page lue sur le disque
let basePanne = false, baseLente = 0, appelsBase = 0;
async function middleware() {
  const copie = path.join(os.tmpdir(), 'mw-essai-' + process.pid + '.mjs');
  fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
  globalThis.fetch = async (u, o = {}) => {
    u = String(u);
    if (u.includes('supabase.co')) {
      appelsBase++;
      if (basePanne) throw new Error('base en panne');
      if (baseLente) await new Promise((r) => setTimeout(r, baseLente));
      // mot de Maître Akesse et casting ouvert (24/10/2026), écrits dans la page par le serveur
      if (u.includes('mot_responsable')) return new Response(JSON.stringify([MOT]), { headers: { 'content-type': 'application/json' } });
      if (u.includes('casting_projets')) return new Response(JSON.stringify([{ id: 'c1' }]), { headers: { 'content-type': 'application/json' } });
      const corps = u.includes('model_profiles') ? profils.map(({ photo: _p, ...x }) => x) : profils.map((p) => ({ model_id: p.id, url: p.photo || photo(p.id), url_petite: p.photo ? null : petite(p.id) }));
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
  ok(new RegExp('<img id="couv-img" class="visible" src="' + (ACTIVES ? 'https://photos\\.maitreakessemodelmanagement\\.com/' : '/book-photos/') + '[^"]+-w\\.webp" alt="[^"]+" data-modele="a[234]"').test(html), 'serveur : la photo de couverture est déjà en place (WebP, ' + (ACTIVES ? 'Cloudflare' : 'Vercel') + ' ; pas la mannequin « À la une »)');
  ok(!/<i>DEUX/.test(html) && /MARIAM \\u003ci\\u003eDEUX/.test(html), 'serveur : un nom avec des signes spéciaux ne peut rien injecter dans la page');
  const avant = appelsBase; await pageServeur('en/');
  ok(appelsBase === avant, 'serveur : 2e visite servie de mémoire (pas de nouvelle question à la base)');
  ok(await mw(new Request('https://www.maitreakessemodelmanagement.com/', { headers: { 'x-ma2m-accueil': '1' } })) === undefined, 'serveur : sa propre demande de la page passe sans boucle');
  ok(await mw(new Request('https://www.maitreakessemodelmanagement.com/', { method: 'HEAD' })) === undefined, 'serveur : seulement les visites (GET)');

  const b = await chromium.launch();
  // même règle d'adresse des photos que le navigateur (js/photos.js : urlLegere, PHOTOS_DIRECTES_ACTIVES)
  {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:' + PORT + '/404-essai'); await p.addScriptTag({ path: path.join(RACINE, 'js/photos.js') });
    const exemples = ['/book-photos/a1/miniatures/1-x-w.jpg', 'https://www.maitreakessemodelmanagement.com/book-photos/a1/moyennes/2-y-w.jpg', CF + 'a2/miniatures/3-z.jpg', '/book-photos/site/autre.png'];
    const navigateur = await p.evaluate((l) => ({ actives: PHOTOS_DIRECTES_ACTIVES, adresses: l.map((u) => urlLegere(u)) }), exemples);
    const src = fs.readFileSync(path.join(RACINE, 'middleware.js'), 'utf8');
    ok(new RegExp('const PHOTOS_DIRECTES_ACTIVES = ' + navigateur.actives + ';').test(src), 'serveur et navigateur : même réglage PHOTOS_DIRECTES_ACTIVES (' + navigateur.actives + ')');
    const serveur = [];
    for (const u of exemples) {
      profils.forEach((x) => { x.photo = u; });
      const copie = path.join(os.tmpdir(), 'mw-regle-' + process.pid + '-' + serveur.length + '.mjs'); fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
      const m = (await import(pathToFileURL(copie).href)).default;
      const h = await (await m(new Request('https://www.maitreakessemodelmanagement.com/'))).text();
      serveur.push((h.match(/<img id="couv-img" class="visible" src="([^"]+)"/) || [])[1]);
    }
    ok(JSON.stringify(serveur) === JSON.stringify(navigateur.adresses.map((x) => x.replace(/&/g, '&amp;'))), 'serveur et navigateur : même adresse de photo (' + serveur.join(' | ') + ')');
    await ctx.close();
  }
  for (const [langue, chemin] of [['FR', ''], ['EN', 'en/']]) {
    for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
      for (const etatCf of ['ok', 'coupé', 'muet']) {
        const cloudflare = etatCf === 'ok';
        const n = langue + ' · ' + nom + (cloudflare ? '' : ' · Cloudflare ' + etatCf) + ' : ';
        const page = await pageServeur(chemin);
        const ctx = await b.newContext({ viewport: ecran, isMobile: ecran.width < 700, hasTouch: ecran.width < 700, serviceWorkers: 'block' });
        const p = await ctx.newPage(); const errs = [], journal = [], ordre = [];
        p.on('pageerror', (e) => errs.push(e.message));
        p.on('request', (r) => ordre.push(r.url()));
        await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ } });
        await brancher(p, { tables: { model_profiles: profils.map((x) => Object.assign({ published: true }, x)), model_photos: [] }, rpc: { photos_couverture_mannequins: profils.map((x) => ({ model_id: x.id, url: photo(x.id) })) } }, journal);
        await p.route(/^https:\/\/photos\.maitreakessemodelmanagement\.com\//, (r) => cloudflare ? r.fulfill({ status: 200, contentType: 'image/webp', body: IMAGE }) : etatCf === 'coupé' ? r.abort('connectionclosed') : undefined);  // muet : jamais de réponse
        await p.route(/\/book-photos\//, (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: IMAGE }));
        await p.route('http://127.0.0.1:' + PORT + '/' + chemin, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: page }));
        const t0 = Date.now();
        await p.goto('http://127.0.0.1:' + PORT + '/' + chemin, { waitUntil: 'domcontentloaded' });
        const textes = () => p.evaluate(() => ['edito-rubrique', 'edito-texte', 'edito-nom', 'dos-rubrique', 'dos-texte', 'dos-bouton'].map((id) => document.getElementById(id).textContent).join(' | ') + ' | ' + document.getElementById('edito-signature').className);
        const textesArrivee = await textes();
        await p.waitForFunction(() => { const i = document.getElementById('couv-img'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 15000, polling: 100 }).catch(() => {});
        const delai = Date.now() - t0;
        await p.waitForTimeout(1500);
        const couv = await p.evaluate(() => { const i = document.getElementById('couv-img'); return { src: i.currentSrc || i.src, largeur: i.naturalWidth, modele: i.dataset.modele, credit: document.getElementById('couv-modele-nom').textContent, enVue: (document.querySelector('.p-couv .mag-cadre img.visible').getAttribute('src').match(/\/(a\d)\//) || [])[1] }; });
        const premiere = ordre.findIndex((u) => u.includes('/miniatures/')), accueilJs = ordre.findIndex((u) => /\/js\/accueil\.js/.test(u));
        ok(couv.largeur > 0 && delai < (etatCf === 'muet' && ACTIVES ? 6000 : 3000), n + 'la photo de couverture s’affiche en ' + (delai / 1000).toFixed(1) + ' s' + (cloudflare ? '' : ' (par la roue de secours : ' + couv.src.replace(/^https?:\/\/[^/]+/, '').slice(0, 30) + '…)'));
        ok(premiere >= 0 && premiere < accueilJs, n + 'la photo est demandée avant même les programmes de la page');
        if (!ACTIVES) ok(/\/book-photos\//.test(couv.src) && !ordre.some((u) => u.startsWith(CF)), n + 'la photo vient de Vercel, rien n’est demandé à Cloudflare');
        else if (cloudflare) ok(couv.src.startsWith(CF), n + 'la photo vient de Cloudflare');
        else ok(/\/book-photos\//.test(couv.src), n + 'Cloudflare muet : la photo vient de la copie Vercel');
        const attendu = profils.find((x) => x.id === couv.enVue) || {};  // (la couverture défile toutes les 5 s)
        ok(couv.credit === attendu.full_name, n + '« En couverture » : le nom de la mannequin en photo (' + couv.credit + ')');
        const questions = ordre.filter((u) => /model_profiles/.test(u));
        ok(!journal.some((j) => j[0] === 'rpc' && j[1] === 'photos_couverture_mannequins') && questions.length === 1 && /select=id&/.test(questions[0]) && ordre.indexOf(questions[0]) > premiere,
          n + 'le navigateur ne redemande pas la liste : une seule petite vérification, après la photo');
        ok(textesArrivee === await textes() && textesArrivee.includes(MOT.message) && textesArrivee.includes(MOT.nom) && /Casting ouvert|Open casting/.test(textesArrivee) && !/u-hidden/.test(textesArrivee)
          && !ordre.some((u) => /mot_responsable|casting_projets/.test(u)), n + 'mot de Maître Akesse et casting ouvert déjà écrits par le serveur : rien ne change ensuite, la page ne saute pas');
        const vignettes = await p.$$eval('#grille-femmes img, #grille-hommes img', (l) => l.map((i) => i.getAttribute('src')));
        ok(vignettes.length === 4 && vignettes.every((u) => (ecran.width < 700) === /\/petites\/[^/]*-n480-w\.(webp|jpg)$/.test(u)), n + (ecran.width < 700 ? 'téléphone : visages en petite version (480 px)' : 'ordinateur : visages en miniature (800 px)') + ' — ' + vignettes[0].replace(/^.*\//, ''));
        ok((await p.$$('#grille-femmes a')).length === 3 && (await p.$$('#grille-hommes a')).length === 1 && /AWA UNE/.test(await p.textContent('#une-nom')), n + 'visages des femmes, des hommes et « À la une » remplis');
        ok(/4 (mannequins à découvrir|models to discover)/.test(await p.textContent('#couv-nombre')), n + 'nombre de mannequins sur la couverture');
        ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
        await p.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close();
      }
    }
  }
  profils.forEach((x) => { delete x.photo; });
  // mannequin retirée après la préparation de la liste : le navigateur revérifie et la retire
  {
    const page = await pageServeur('');
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ } });
    const restantes = profils.filter((x) => x.id !== 'a3');
    await brancher(p, { tables: { model_profiles: restantes.map((x) => Object.assign({ published: true }, x)), model_photos: [] }, rpc: { photos_couverture_mannequins: restantes.map((x) => ({ model_id: x.id, url: photo(x.id) })) } }, []);
    await p.route(/^https:\/\/photos\.maitreakessemodelmanagement\.com\//, (r) => r.fulfill({ status: 200, contentType: 'image/webp', body: IMAGE }));
    await p.route('http://127.0.0.1:' + PORT + '/', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: page }));
    await p.goto('http://127.0.0.1:' + PORT + '/'); await p.waitForTimeout(3000);
    const t = await p.evaluate(() => [...document.querySelectorAll('#mag a, #couv-modele-nom')].map((a) => a.textContent).join(' | '));
    ok(!/GRÂCE TROIS/.test(t) && (await p.$$('#grille-femmes a')).length === 2, 'mannequin retirée de la publication : elle disparaît aussitôt de l’accueil (couverture et visages)');
    ok(!errs.length, 'mannequin retirée : aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  // base lente côté serveur : la page n'attend pas plus de 0,8 s, la liste sert aux visiteurs suivants
  {
    baseLente = 1500;
    const copie = path.join(os.tmpdir(), 'mw-lente-' + process.pid + '.mjs'); fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
    const m = (await import(pathToFileURL(copie).href)).default;
    const t0 = Date.now(), r1 = await m(new Request('https://www.maitreakessemodelmanagement.com/'));
    ok(r1 === undefined && Date.now() - t0 < 1200, 'base lente : la page part comme avant au bout de 0,8 s au plus (' + (Date.now() - t0) + ' ms)');
    await new Promise((r) => setTimeout(r, 3500));
    const t1 = Date.now(), r2 = await m(new Request('https://www.maitreakessemodelmanagement.com/'));
    ok(r2 && Date.now() - t1 < 300, 'base lente : les visiteurs suivants reçoivent la page déjà remplie, sans attendre');
    baseLente = 0;
  }
  // base en panne côté serveur : page normale, remplie par le navigateur comme avant
  basePanne = true;
  const mw2 = await (async () => { const copie = path.join(os.tmpdir(), 'mw-essai2-' + process.pid + '.mjs'); fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie); return (await import(pathToFileURL(copie).href)).default; })();
  const t0 = Date.now(), r = await mw2(new Request('https://www.maitreakessemodelmanagement.com/'));
  ok(r === undefined && Date.now() - t0 < 1000, 'base en panne côté serveur : la page part comme avant, sans attendre');
  const t1 = Date.now(); await mw2(new Request('https://www.maitreakessemodelmanagement.com/'));
  ok(Date.now() - t1 < 200, 'base en panne : la visite suivante n’attend pas la base');
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
