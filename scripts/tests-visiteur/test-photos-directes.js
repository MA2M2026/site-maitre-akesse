// Photos servies directement par Cloudflare (13/10/2026) : les pages publiques affichent les
// photos depuis photos.maitreakessemodelmanagement.com au lieu du relais Vercel /book-photos/,
// avec une roue de secours : domaine injoignable (connexion coupée) ou bloqué sans réponse →
// les photos repassent par le relais, le visiteur est mémorisé 12 h, le journal le note une fois.
// Base et stockage simulés : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const fs = require('fs'); const path = require('path');
const PORT = String(9100 + Math.floor(Math.random() * 90));
const PHOTO = fs.readFileSync(path.join(__dirname, 'medias/photo0.jpg'));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

const SITE = 'https://www.maitreakessemodelmanagement.com/book-photos/';
const DIRECT = /^https:\/\/photos\.maitreakessemodelmanagement\.com\//;
const M = SITE + 'a1/moyennes/1-x-w.jpg', N = SITE + 'a1/miniatures/1-x-n800-w.jpg';
const tables = {
  model_profiles: [{ id: 'a1', full_name: 'Awa Koné', city: 'Abidjan', height_cm: 178, category: 'femme', genre: 'femme', published: true, featured: true, slug: 'awa-kone' }],
  model_photos: [{ id: 'p1', model_id: 'a1', url: SITE + 'a1/1-shooting.jpg', url_moyenne: M, url_miniature: N, principale: true, photo_couverture: true, categorie: 'book', created_at: '2026-10-01T10:00:00Z', 'model_profiles.published': true },
    ...['b2', 'c3', 'd4'].map(id => ({ id: 'p' + id, model_id: id, url: SITE + id + '/o.jpg', url_moyenne: M, url_miniature: N, principale: true, categorie: 'book', created_at: '2026-10-01T10:00:00Z', 'model_profiles.published': true }))],
  bandeau_annonce: [], instagram_posts_cache: [], mot_responsable: [], actualites: [], evenements: [], partenaires: [], admins: []
};

// mode : 'ok' (Cloudflare répond), 'coupe' (connexion fermée), 'muet' (ne répond jamais),
// 'sans-webp' (Cloudflare répond mais la copie WebP manque)
async function visite(b, page, mode, opts = {}) {
  const ctx = opts.ctx || await b.newContext({ viewport: opts.mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
  const p = await ctx.newPage(); const errs = [], journal = [], directes = [], relais = [];
  p.on('pageerror', e => errs.push(e.message));
  // le journal des erreurs ignore les navigateurs automatisés : on écoute signalerErreur
  await p.addInitScript(() => {
    window.__signaux = []; let f;
    Object.defineProperty(window, 'signalerErreur', { configurable: true, set(v) { f = v; },
      get() { return (...a) => { window.__signaux.push(a[0]); return f && f(...a); }; } });
  });
  await brancher(p, { tables, rpc: { photos_couverture_mannequins: [{ model_id: 'a1', url: N }] } }, journal);
  await p.route(DIRECT, r => {
    directes.push(r.request().url());
    if (mode === 'coupe') return r.abort('connectionclosed');
    if (mode === 'muet') return; // la requête reste en attente, comme le téléphone du 13/10/2026
    if (/sonde-connexion/.test(r.request().url())) return r.fulfill({ status: 404, body: '' });
    if (mode === 'lent') return setTimeout(() => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }).catch(() => {}), 11000);
    if (mode === 'absente') return r.fulfill({ status: 404, body: '' });
    if (mode === 'sans-webp' && /\.webp/.test(r.request().url())) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO });
  });
  await p.route(/^https:\/\/www\.maitreakessemodelmanagement\.com\/book-photos\/|127\.0\.0\.1:\d+\/book-photos\//, r => {
    relais.push(r.request().url());
    if (mode === 'sans-webp' && /\.webp/.test(r.request().url())) return r.fulfill({ status: 404, body: '' });
    if (mode === 'absente') return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO });
  });
  if (opts.avant) await opts.avant(p);
  await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  const entrer = await p.$('text=/^\\s*(Entrer|Enter)\\s*$/i'); if (entrer) await entrer.click().catch(() => {});
  await p.waitForTimeout(opts.attente || 3000);
  const etat = await p.evaluate(() => ({
    srcs: [...document.images].map(i => i.getAttribute('src') || '').filter(s => /book-photos|photos\.maitreakesse/.test(s)),
    vides: [...document.images].filter(i => /book-photos|photos\.maitreakesse/.test(i.getAttribute('src') || '') && i.complete && !i.naturalWidth).length,
    marque: localStorage.getItem('ma2m_photos_relais'),
    signalements: window.__signaux.filter(c => c === 'photos').length
  }));
  const signalements = etat.signalements;
  return { p, ctx, errs, directes, relais, etat, signalements };
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();

  // 1) Cloudflare répond : les photos viennent directement de Cloudflare, rien par Vercel
  for (const page of ['index.html', 'mannequins.html', 'mannequin.html?id=a1', 'qui-sommes-nous.html', 'en/index.html']) {
    for (const mobile of [false, true]) {
      const v = await visite(b, page, 'ok', { mobile });
      const nom = page + (mobile ? ' (téléphone)' : ' (ordinateur)');
      ok(v.etat.srcs.length > 0 && v.etat.srcs.every(s => DIRECT.test(s)), nom + ' : photos affichées depuis Cloudflare (' + v.etat.srcs.length + ')');
      ok(v.relais.length === 0 && !v.etat.marque && v.signalements === 0, nom + ' : aucune photo par le relais Vercel');
      ok(!v.etat.vides && !v.errs.length, nom + ' : aucune photo cassée, aucune erreur ' + v.errs.join(' | '));
      await v.ctx.close();
    }
  }

  // 2) Connexion coupée (ERR_CONNECTION_CLOSED du téléphone de la propriétaire) → relais
  for (const page of ['index.html', 'mannequins.html', 'mannequin.html?id=a1']) {
    const v = await visite(b, page, 'coupe', { mobile: true });
    ok(v.etat.srcs.length > 0 && v.etat.srcs.every(s => /\/book-photos\//.test(s)) && !v.etat.vides, page + ' coupé : toutes les photos repassent par le relais et s\'affichent (' + v.etat.srcs.length + ')');
    ok(Number(v.etat.marque) > Date.now() + 11 * 3600e3, page + ' coupé : visiteur mémorisé 12 h');
    ok(v.signalements === 1, page + ' coupé : basculement noté une seule fois dans le journal (' + v.signalements + ')');
    ok(!v.errs.length, page + ' coupé : aucune erreur ' + v.errs.join(' | '));
    // visite suivante du même visiteur : directement par le relais, sans repasser par Cloudflare
    const w = await visite(b, 'mannequins.html', 'coupe', { ctx: v.ctx });
    ok(w.directes.length === 0 && w.etat.srcs.length > 0 && w.etat.srcs.every(s => /\/book-photos\//.test(s)), page + ' coupé : page suivante directement par le relais');
    await v.ctx.close();
  }

  // 3) Cloudflare ne répond jamais (chargement sans fin) : garde-fou à 8 s, sonde sans
  //    réponse pendant 5 s → bascule
  for (const page of ['index.html', 'mannequin.html?id=a1']) {
    const v = await visite(b, page, 'muet', { mobile: true, attente: 15000 });
    ok(v.etat.srcs.length > 0 && v.etat.srcs.every(s => /\/book-photos\//.test(s)) && !v.etat.vides, page + ' muet : photos affichées par le relais après le délai (' + v.etat.srcs.length + ')');
    ok(!!v.etat.marque && v.signalements === 1, page + ' muet : visiteur mémorisé, noté une fois');
    ok(!v.errs.length, page + ' muet : aucune erreur ' + v.errs.join(' | '));
    await v.ctx.close();
  }

  // 3 bis) Connexion seulement LENTE (photos en 11 s, mais Cloudflare répond) : on patiente,
  //        pas de bascule ni de fausse alerte
  {
    const v = await visite(b, 'mannequin.html?id=a1', 'lent', { mobile: true, attente: 16000 });
    ok(v.etat.srcs.length > 0 && v.etat.srcs.every(s => DIRECT.test(s)) && !v.etat.marque && v.signalements === 0 && v.relais.length === 0, 'lent : photos arrivées depuis Cloudflare, sans bascule (' + v.etat.srcs.length + ')');
    ok(!v.errs.length, 'lent : aucune erreur ' + v.errs.join(' | '));
    await v.ctx.close();
  }
  // 3 ter) Photo supprimée (absente des deux côtés) : ce n'est pas une panne de Cloudflare
  {
    const v = await visite(b, 'mannequins.html', 'absente', { mobile: true });
    ok(!v.etat.marque && v.signalements === 0, 'photo absente : pas de bascule ni d\'alerte « Cloudflare injoignable »');
    ok(!v.errs.length, 'photo absente : aucune erreur ' + v.errs.join(' | '));
    await v.ctx.close();
  }
  // 3 quater) Visiteur déjà mémorisé « relais » : la page Sélection (photos gardées en mémoire
  //           avec l'adresse directe) passe par le relais
  {
    const v = await visite(b, 'selection.html', 'muet', { mobile: true, avant: p => p.addInitScript(() => {
      localStorage.setItem('ma2m_photos_relais', String(Date.now() + 3600e3));
      localStorage.setItem('ma2m_selection', JSON.stringify([{ id: 'a1', full_name: 'Awa Koné', height_cm: 178, photoUrl: 'https://photos.maitreakessemodelmanagement.com/a1/miniatures/1-x-n800-w.webp' }]));
    }) });
    ok(v.directes.length === 0 && v.etat.srcs.length > 0 && v.etat.srcs.every(s => /\/book-photos\//.test(s)) && !v.etat.vides, 'Sélection : photo gardée en mémoire affichée par le relais (' + v.etat.srcs.join(', ') + ')');
    ok(!v.errs.length, 'Sélection : aucune erreur ' + v.errs.join(' | '));
    await v.ctx.close();
  }
  // 4) Copie WebP absente (ancienne photo) : retour au JPEG, sans passer pour une panne
  {
    const v = await visite(b, 'mannequins.html', 'sans-webp', { mobile: true });
    ok(v.etat.srcs.length > 0 && v.etat.srcs.every(s => /\.jpg$/.test(s)) && !v.etat.vides, 'WebP absent : photo affichée en JPEG (' + v.etat.srcs.join(', ') + ')');
    ok(!v.errs.length, 'WebP absent : aucune erreur ' + v.errs.join(' | '));
    await v.ctx.close();
  }

  // 5) Les adresses gardées en base ne changent pas, et l'interrupteur coupe tout
  {
    const p = await (await b.newContext()).newPage();
    await brancher(p, { tables: {}, rpc: {} }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/mannequins.html'); await p.waitForTimeout(800);
    const r = await p.evaluate(([N]) => ({
      direct: urlLegere(N), dejaDirect: urlLegere(urlLegere(N)), autre: urlLegere('https://exemple.com/a.jpg'),
      relais: urlParRelais('https://photos.maitreakessemodelmanagement.com/a1/x.jpg'), pasDirect: urlParRelais('https://exemple.com/a.jpg')
    }), [N]);
    ok(r.direct === 'https://photos.maitreakessemodelmanagement.com/a1/miniatures/1-x-n800-w.webp' && r.dejaDirect === r.direct, 'conversion : relais → Cloudflare + WebP, sans effet si déjà converti');
    ok(r.autre === 'https://exemple.com/a.jpg' && r.relais === '/book-photos/a1/x.jpg' && r.pasDirect === null, 'conversion : autres adresses laissées telles quelles, retour au relais correct');
    await p.context().close();
  }

  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
