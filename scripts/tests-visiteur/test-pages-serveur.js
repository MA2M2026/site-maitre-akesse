// Site dynamique, étape 2 (01/11/2026, PLAN-SERVEUR.md) : les autres pages publiques qui affichent des données
// partent DÉJÀ REMPLIES par le serveur (middleware.js, pageRemplie). Base SIMULÉE, rien n'est écrit.
// Pour chaque page : les données sont dans la page, rien d'injectable, base lente ou en panne → comme avant ;
// dans le navigateur (téléphone et ordinateur, français et anglais) : la page s'affiche sans redemander ces
// données à la base, et sans erreur.
// copies de middleware.js DANS le dépôt (01/11/2026 : il importe js/rendu-*.js par un chemin relatif)
const dossierCopies = () => require('path').resolve(__dirname, '../..');
// (mémoire de 3 minutes du serveur coupée : chaque essai lit la base simulée telle qu'il la règle)
globalThis.MA2M_SANS_MEMOIRE = true;
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path'), fs = require('fs'), os = require('os'), { pathToFileURL } = require('url');
const RACINE = path.resolve(__dirname, '../..');
const PORT = String(9000 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const { tables: t0, rpc } = require('./pages-publiques');
const tables = JSON.parse(JSON.stringify(t0));
tables.partenaires = [{ ...tables.partenaires[0], description: '<p>Partenaire fidèle.</p>', created_at: '2026-10-01T10:00:00Z' },
  { id: 'pb', nom: 'Maison <img src=x onerror=alert(1)>', logo_url: 'https://x/m.png', created_at: '2026-09-01T10:00:00Z' }];
// agenda : un projet à venir (titre piégé) et un événement de la page Événements
rpc.agenda_public = [{ id: 'g1', type: 'evenement', titre: 'Forum <img src=x onerror=alert(1)>', date_debut: '2030-10-21', date_fin: '2030-10-22', ville: 'Abidjan', lieu: 'Sofitel', description: '', intervenants: [], seances: [], partenaires: [], mannequins: [] }];
tables.evenements = [{ ...tables.evenements[0], date_evenement: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), lieu: 'Plateau' }];
// parcours : un projet réalisé ce mois-ci, avec une mannequin (nom piégé) ; un projet sans mannequin (à ne pas montrer)
const ceMois = new Date().toISOString().slice(0, 8) + '01';
rpc.parcours_public = [{ id: 'pp1', type: 'evenement', titre: 'Gala <img src=x onerror=alert(1)>', date_debut: ceMois, date_fin: null, lieu: 'Sofitel', ville: 'Abidjan', pays: "Côte d'Ivoire", mannequins: [{ id: 'a1', nom: 'Awa <img src=x onerror=alert(1)>', slug: 'awa-kone' }] },
  { id: 'pp2', type: 'casting', titre: 'Casting ouvert', date_debut: ceMois, date_fin: null, mannequins: [] }];
rpc.photos_couverture_petites = [{ model_id: 'a1', url: 'https://x/1.jpg', url_petite: null }];
// qui sommes-nous : portrait du fondateur, photos d'événements, photos des mannequins (2 pour a1, 1 pour a2)
tables.mot_responsable = [{ id: 'principal', nom: 'Maître <img src=x onerror=alert(1)>', photo_url: 'https://x/fondateur.jpg' }];
tables.evenement_photos = [{ id: 'ep1', evenement_id: tables.evenements[0].id, url: 'https://x/e1.jpg' }, { id: 'ep2', evenement_id: tables.evenements[0].id, url: 'https://x/e2.jpg' }];
tables.model_photos = ['a1', 'a1', 'a2', 'a3', 'a4'].map((m, i) => ({ id: 'mp' + i, url: 'https://x/m' + i + '.jpg', url_moyenne: null, model_id: m, model_profiles: { published: true } }));
let basePanne = false, baseLente = 0;
const json = (x) => new Response(JSON.stringify(x), { headers: { 'content-type': 'application/json' } });

// Les pages : [adresse, bloc, vérifier(données), sélecteur visible quand la page est remplie, lectures du navigateur à NE PAS voir]
const PAGES = [
  ['partenaires', 'partenaires-donnees', (d) => d.liste.length === 2, '#partenaires-grille .news-carte', /\/rest\/v1\/partenaires\?select=/],
  ['parcours', 'parcours-donnees', (d) => d.projets.length === 2 && d.photos.length === 1 && /^\d{4}-\d\d-01$/.test(d.debut), '.parcours-projet', /\/rest\/v1\/rpc\/parcours_public/],
  ['qui-sommes-nous', 'qsn-donnees', (d) => d.evenements.length === 1 && d.photos.length === 2 && d.portrait && d.visages.length === 4 && !('model_profiles' in d.visages[0]), '#qsn-visages-piste a', /\/rest\/v1\/(mot_responsable|evenement_photos|model_photos)\?/],
  ['agenda', 'agenda-donnees', (d) => d.agenda.length === 1 && d.evenements.length === 1, '#agenda-avenir .agenda-carte, #agenda-avenir article', /\/rest\/v1\/(rpc\/agenda_public|evenements\?select=id%2Ctitre|evenements\?select=id,titre)/]
];

async function middleware() {
  const copie = path.join(dossierCopies(), 'mw-pages-' + process.pid + '.mjs');
  fs.copyFileSync(path.join(RACINE, 'middleware.js'), copie);
  globalThis.fetch = async (u, o = {}) => {
    u = String(u);
    if (u.includes('supabase.co')) {
      if (basePanne) throw new Error('base en panne');
      if (baseLente) await new Promise((r, x) => { const m = setTimeout(r, baseLente); if (o.signal) o.signal.addEventListener('abort', () => { clearTimeout(m); x(new Error('abandon')); }); });
      const nom = new URL(u).pathname.split('/').pop();
      if (rpc[nom] !== undefined) return json(typeof rpc[nom] === 'function' ? rpc[nom](JSON.parse(o.body || '{}')) : rpc[nom]);
      return json(tables[nom] || []);
    }
    const p = new URL(u).pathname;
    return new Response(fs.readFileSync(path.join(RACINE, p.replace(/^\//, '') + '.html'), 'utf8'), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  return (await import(pathToFileURL(copie).href)).default;
}
const donneesDe = (html, bloc) => JSON.parse((html.match(new RegExp('<script type="application/json" id="' + bloc + '">(.*?)</script>')) || [])[1] || 'null');

// base lente ou en panne : la page habituelle, sans bloc de données (aucune page cassée)
const sansDonnees = async (r) => !r || (r.status === 200 && !/application\/json" id="[a-z-]+-donnees"/.test(await r.text()));

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const mw = await middleware();
  const demander = (chemin, init) => mw(new Request('https://www.maitreakessemodelmanagement.com/' + chemin, init));
  const b = await chromium.launch();

  for (const [page, bloc, verifier, selecteur, lectureInterdite] of PAGES) {
    // 1. Le serveur seul
    const pages = {};
    for (const chemin of [page, 'en/' + page]) {
      const r = await demander(chemin);
      const html = r ? await r.text() : '';
      pages[chemin] = html;
      const d = html && donneesDe(html, bloc);
      ok(!!d && verifier(d), chemin + ' : les données sont dans la page');
      ok(!/<img src=x onerror/.test(html), chemin + ' : rien d’injectable');
      ok(r && /no-cache/.test(r.headers.get('cache-control') || ''), chemin + ' : jamais gardée en cache');
    }
    ok(await demander(page, { headers: { 'x-ma2m-remplie': '1' } }) === undefined, page + ' : sa propre demande de la page passe sans boucle');
    ok(await demander(page, { headers: { 'user-agent': 'WhatsApp/2.23' } }) === undefined, page + ' : robot d’aperçu → la page habituelle');
    baseLente = 1500; const t = Date.now();
    ok(await sansDonnees(await demander(page)) && Date.now() - t < 2500, page + ' : base lente → comme avant (sans données), sans attendre (' + (Date.now() - t) + ' ms)');
    baseLente = 0; basePanne = true;
    ok(await sansDonnees(await demander(page)), page + ' : base en panne → comme avant');
    basePanne = false;

    // 2. Dans le navigateur
    for (const chemin of [page, 'en/' + page]) {
      for (const vp of [{ width: 390, height: 844, mobile: true }, { width: 1280, height: 860 }]) {
        const n = chemin + ' ' + vp.width + 'px : ';
        const p = await (await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile })).newPage(); const errs = [];
        p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (dl) => { errs.push('fenêtre : ' + dl.message()); dl.dismiss(); });
        await brancher(p, { tables, rpc }, []);
        let lectures = 0;
        p.on('request', (r) => { if (lectureInterdite.test(r.url())) lectures++; });
        await p.route(new RegExp('/' + chemin.replace(/\//g, '\\/') + '$'), (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pages[chemin] }));
        await p.goto('http://127.0.0.1:' + PORT + '/' + chemin, { waitUntil: 'domcontentloaded' });
        await p.waitForSelector(selecteur, { timeout: 15000 });
        await p.waitForTimeout(800);
        ok(!lectures, n + 's’affiche sans redemander ces données à la base (' + lectures + ')');
        ok(!(await p.$('img[src="x"]')), n + 'rien d’injecté');
        ok(!errs.length, n + 'aucune erreur' + (errs.length ? ' — ' + errs[0] : ''));
        await p.context().close();
      }
    }
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.'); process.exit(ko ? 1 : 0);
})();
