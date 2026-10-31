// Fiche d'un mannequin plus rapide (28/10/2026, la propriétaire attendait la photo sur tablette) :
// photos, expériences, mesures et adresse sont demandées EN MÊME TEMPS que le profil, et une seule
// fois chacune. Le profil répond ici lentement (1,2 s) : les photos doivent être demandées avant. Base simulée.
// 31/10/2026 : l'âge et la GRANDE PHOTO elle-même partent aussi sans attendre le profil ; par l'adresse
// /book/… l'identité du mannequin n'est demandée qu'une fois (fiche et compteur de visites).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { tables, rpc } = require('./pages-publiques');
const PORT = String(9900 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [page, vp] of [['mannequin.html?id=a1', { width: 390, height: 844, mobile: true }], ['mannequin.html?id=a1', { width: 800, height: 1200, mobile: true }], ['en/mannequin.html?id=a1', { width: 1280, height: 860 }], ['book/awa-kone', { width: 390, height: 844, mobile: true }]]) {
    const p = await (await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile })).newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await brancher(p, { tables, rpc }, []);
    const quand = {}; const nombre = {}; let profilRepondu = 0;
    p.on('request', (r) => {
      const m = /\/rest\/v1\/(?:rpc\/)?([a-z_]+)/.exec(r.url()); if (m) { nombre[m[1]] = (nombre[m[1]] || 0) + 1; quand[m[1]] = quand[m[1]] || Date.now(); }
      if (/https:\/\/x\/1\.jpg/.test(r.url())) quand.photo = quand.photo || Date.now();
      if (/model_profiles\?.*slug=eq\./.test(r.url())) nombre.identite = (nombre.identite || 0) + 1;
    });
    // l'adresse /book/… (servie par middleware.js en ligne) : ici la même page
    await p.route(/\/book\/awa-kone$/, async (r) => { const rep = await r.fetch({ url: 'http://127.0.0.1:' + PORT + '/mannequin.html' }); await r.fulfill({ response: rep }); });
    // le profil complet de la fiche (celui qui demande « bio ») répond lentement
    await p.route(/\/rest\/v1\/model_profiles\?.*select=[^&]*bio/, async (r) => { await new Promise(x => setTimeout(x, 1200)); profilRepondu = Date.now(); await r.fallback(); });
    await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => /Awa Koné/.test(document.getElementById('contenu')?.textContent || ''), null, { timeout: 15000 });
    ok(quand.model_photos && profilRepondu && quand.model_photos < profilRepondu, page + ' ' + vp.width + 'px : photos demandées sans attendre le profil');
    ok(quand.model_projects && quand.model_projects < profilRepondu, page + ' ' + vp.width + 'px : expériences demandées sans attendre le profil');
    ok(quand.ages_mannequins && quand.ages_mannequins < profilRepondu, page + ' ' + vp.width + 'px : âge demandé sans attendre le profil');
    ok(quand.photo && quand.photo < profilRepondu, page + ' ' + vp.width + 'px : la grande photo part sans attendre le profil');
    if (/book/.test(page)) ok(nombre.identite === 1, page + ' : identité du mannequin demandée une seule fois (' + nombre.identite + ')');
    ok(nombre.model_photos === 1 && nombre.model_projects === 1, page + ' ' + vp.width + 'px : chaque demande ne part qu’une fois (photos ' + nombre.model_photos + ', expériences ' + nombre.model_projects + ')');
    ok(!errs.length, page + ' ' + vp.width + 'px : aucune erreur' + (errs.length ? ' — ' + errs[0] : ''));
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
