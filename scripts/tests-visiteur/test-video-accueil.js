// Espace vidéo de l'accueil (12/10/2026, demande de la propriétaire) : une vidéo verticale doit
// s'afficher EN ENTIER (pas rognée) sur téléphone, tablette et ordinateur, ne jamais laisser un
// espace noir si la lecture automatique est refusée, et survivre à une erreur de chargement
// passagère. Base simulée, vidéo d'essai servie localement. Échec bloquant si un cas rate.
const { chromium, devices } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const fs = require('fs'); const path = require('path');
const PORT = String(8900 + Math.floor(Math.random() * 90));
const VIDEO = fs.readFileSync(path.join(__dirname, 'medias/verticale.webm'));
const tables = { reglages_site: [{ cle: 'video_accueil', valeur: { type: 'video', chemin: 'site/video-accueil/essai.mp4', largeur: 360, hauteur: 640 } }],
  model_profiles: [], model_photos: [], actualites: [], evenements: [], partenaires: [], bandeau_annonce: [], instagram_posts_cache: [], mot_responsable: [], admins: [] };
const APPAREILS = { 'téléphone': devices['iPhone 13'], 'tablette': devices['iPad (gen 7)'], 'ordinateur': { viewport: { width: 1440, height: 900 } } };
let echecs = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) echecs++; };

// direct : la vidéo servie par Cloudflare (photos.maitreakessemodelmanagement.com, 13/10/2026)
// répond ('ok'), coupe la connexion ('coupe') ou ne répond jamais ('muet') → relais /book-photos/.
async function ouvrir(b, appareil, { lectureRefusee = false, erreurs = 0, page = 'index.html', direct = 'ok', attente = 3500 } = {}) {
  const ctx = await b.newContext(APPAREILS[appareil]); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // journal du 14/10/2026 : la surveillance interrogeait (HEAD) l'adresse Cloudflare, interdite par la sécurité
  const heads = []; p.on('request', r => { if (r.method() === 'HEAD' && /photos\.maitreakessemodelmanagement\.com/.test(r.url())) heads.push(r.url()); });
  await brancher(p, { tables, rpc: {} }, []);
  let n = 0;
  const servir = r => (n++ < erreurs ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ status: 200, contentType: 'video/webm', body: VIDEO }));
  await p.route('**/book-photos/site/video-accueil/**', servir);
  await p.route(/^https:\/\/photos\.maitreakessemodelmanagement\.com\//, r => {
    if (direct === 'coupe') return r.abort('connectionclosed');
    if (direct === 'muet') return; // reste en attente
    if (/sonde-connexion/.test(r.request().url())) return r.fulfill({ status: 404, body: '' });
    return servir(r);
  });
  if (lectureRefusee) await p.addInitScript(() => { HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('refusé', 'NotAllowedError')); }; });
  await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
  const entrer = await p.$('text=/^\\s*(Entrer|Enter)\\s*$/i'); if (entrer) await entrer.click().catch(() => {});
  await p.waitForTimeout(800);
  await p.evaluate(() => document.getElementById('video-accueil').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(attente);
  return { p, ctx, errs, heads };
}
const etat = p => p.evaluate(() => {
  const s = document.getElementById('video-accueil'), v = s.querySelector('video'), r = s.getBoundingClientRect();
  // zone réellement occupée par l'image (object-fit) : rognée si elle dépasse l'espace
  const ratio = v.videoWidth / v.videoHeight, rs = r.width / r.height, fit = getComputedStyle(v).objectFit;
  const rognee = fit === 'cover' && Math.abs(ratio - rs) > 0.02;
  return { visible: !s.classList.contains('u-hidden') && r.height > 0, prete: s.classList.contains('video-prete'), opacite: getComputedStyle(v).opacity,
    lit: !v.paused, rognee, source: v.getAttribute('src') || '', relais: localStorage.getItem('ma2m_photos_relais'), hauteur: Math.round(r.height), ecran: innerHeight, bouton: s.querySelector('.video-accueil-son span').textContent,
    // bouton du son entièrement dans l'écran (20/10/2026 : « ctiver le son », coupé à gauche)
    boutonDedans: (b => b.left >= 0 && b.right <= innerWidth)(s.querySelector('.video-accueil-son').getBoundingClientRect()) };
});

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const appareil of Object.keys(APPAREILS)) {
    let { p, ctx, errs } = await ouvrir(b, appareil); let e = await etat(p);
    ok(e.visible && e.prete && e.lit && e.opacite === '1', appareil + ' : la vidéo s\'affiche et se lit');
    ok(!e.rognee && e.hauteur <= e.ecran, appareil + ' : vidéo entière, pas rognée (' + e.hauteur + ' px pour un écran de ' + e.ecran + ')');
    ok(/^https:\/\/photos\.maitreakessemodelmanagement\.com\/site\/video-accueil\//.test(e.source), appareil + ' : vidéo servie directement par Cloudflare (' + e.source + ')');
    ok(e.boutonDedans, appareil + ' : bouton du son entièrement visible');
    ok(!errs.length, appareil + ' : aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
    ({ p, ctx } = await ouvrir(b, appareil, { lectureRefusee: true })); e = await etat(p);
    ok(e.visible && e.prete && e.opacite === '1' && /Lire le film/.test(e.bouton), appareil + ' : lecture automatique refusée → première image visible + « Lire le film » (pas d\'espace noir)');
    await ctx.close();
  }
  let { p, ctx } = await ouvrir(b, 'téléphone', { erreurs: 1 }); let e = await etat(p);
  ok(e.visible && e.lit && e.bouton === 'Activer le son', 'erreur passagère de chargement → la vidéo est relancée et s\'affiche, bouton « Activer le son » (' + e.bouton + ')'); await ctx.close();
  ({ p, ctx } = await ouvrir(b, 'téléphone', { erreurs: 5 })); e = await etat(p);
  ok(!e.visible, 'fichier vraiment illisible → l\'espace est retiré (pas de trou noir)'); await ctx.close();
  for (const direct of ['coupe', 'muet']) {
    let heads; ({ p, ctx, heads } = await ouvrir(b, 'téléphone', { direct, attente: direct === 'muet' ? 17000 : 5000 })); e = await etat(p);
    ok(!heads.length, 'Cloudflare ' + direct + ' : la surveillance n\'interroge pas l\'adresse Cloudflare (' + heads.length + ' demande(s))');
    // coupé avant toute donnée : tout le site bascule (visiteur mémorisé) ; muet : la vidéo seule
    // passe par le relais après 12 s d'attente (les photos ont leur propre garde-fou)
    ok(e.visible && e.lit && /^\/book-photos\//.test(e.source) && (direct === 'muet' || !!e.relais), 'Cloudflare ' + (direct === 'coupe' ? 'coupé' : 'muet') + ' → la vidéo passe par le relais et se lit (' + e.source + ')'); await ctx.close();
  }
  ({ p, ctx } = await ouvrir(b, 'tablette', { lectureRefusee: true, page: 'en/index.html' })); e = await etat(p);
  ok(/Play the film/.test(e.bouton), 'anglais : « Play the film » quand la lecture automatique est refusée'); await ctx.close();
  await b.close();
  console.log(echecs ? '✗ ' + echecs + ' échec(s)' : 'Tout est bon.'); process.exit(echecs ? 1 : 0);
})();
