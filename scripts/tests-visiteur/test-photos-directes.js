// Photos servies directement par Cloudflare (13/10/2026) : les pages publiques affichent les
// photos depuis photos.maitreakessemodelmanagement.com au lieu du relais Vercel /book-photos/,
// avec une roue de secours : domaine injoignable (connexion coupée) ou bloqué sans réponse →
// les photos repassent par le relais, le visiteur est mémorisé 1 h (12 h avant le 21/10/2026), le
// journal le note une fois. Cloudflare ET relais muets = connexion du visiteur : pas de bascule.
// Base et stockage simulés : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const fs = require('fs'); const path = require('path');
let PORT = String(9100 + Math.floor(Math.random() * 90));
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
// 'sans-webp' (Cloudflare répond mais la copie WebP manque), 'tout-muet' (connexion du visiteur
// très faible : ni Cloudflare ni le relais ne répondent à la sonde)
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
    if (mode === 'muet' || mode === 'tout-muet') return; // la requête reste en attente, comme le téléphone du 13/10/2026
    if (/sonde-connexion/.test(r.request().url())) return r.fulfill({ status: 404, body: '' });
    if (mode === 'lent') return setTimeout(() => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }).catch(() => {}), 11000);
    if (mode === 'absente') return r.fulfill({ status: 404, body: '' });
    if (mode === 'sans-webp' && /\.webp/.test(r.request().url())) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO });
  });
  await p.route(/^https:\/\/www\.maitreakessemodelmanagement\.com\/book-photos\/|127\.0\.0\.1:\d+\/book-photos\//, r => {
    relais.push(r.request().url());
    // le relais non plus ne répond pas à temps (réponse bien après le délai de la sonde : une
    // requête laissée en attente pour toujours bloquait la visite suivante)
    if (mode === 'tout-muet') return setTimeout(() => r.fulfill({ status: 404, body: '' }).catch(() => {}), 15000);
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
  let b = await chromium.launch();

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

  // 1 bis) Actualités, événements, partenaires (13/10/2026) : mêmes photos directes
  {
    const img = n => SITE + 'site/' + n + '.jpg';
    const autres = { ...tables,
      actualites: [{ id: 'n1', titre: 'Défilé', categorie: 'mode', commentaire: 'Texte', image_url: img('actu'), created_at: '2026-10-01T10:00:00Z' }],
      evenements: [{ id: 'e1', titre: 'Casting', date_evenement: '2026-11-01', lieu: 'Abidjan', description: 'x', image_url: img('evt'), created_at: '2026-10-01T10:00:00Z' }],
      partenaires: [{ id: 'pa1', nom: 'Maison', logo_url: img('logo'), created_at: '2026-10-01T10:00:00Z' }] };
    for (const page of ['actualites.html', 'evenements.html', 'partenaires.html', 'en/partenaires.html']) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const e4 = [], relais = [];
      p.on('pageerror', e => e4.push(e.message));
      await brancher(p, { tables: autres, rpc: {} }, []);
      await p.route(DIRECT, r => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
      await p.route(/book-photos\//, r => { relais.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }); });
      await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
      const srcs = await p.evaluate(() => [...document.images].map(i => i.getAttribute('src') || '').filter(s => /book-photos|photos\.maitreakesse/.test(s)));
      ok(srcs.length > 0 && srcs.every(x => DIRECT.test(x)) && !relais.length, page + ' : images servies par Cloudflare (' + srcs.length + ')');
      ok(!e4.length, page + ' : aucune erreur ' + e4.join(' | '));
      await ctx.close();
    }
  }

  // 1 ter) Accueil (mot du responsable, logos partenaires), Qui sommes-nous (mot), boutique
  //        (vitrine, fiche produit, galerie agrandie) et galerie agrandie partagée
  {
    const img = n => SITE + 'site/' + n + '.jpg';
    const photosProduit = [{ url: img('robe1'), url_miniature: img('robe1-min'), ordre: 0 }, { url: img('robe2'), url_miniature: img('robe2-min'), ordre: 1 }];
    const autres = { ...tables,
      mot_responsable: [{ id: 'principal', nom: 'Maître Akesse', titre: 'Fondatrice', message: 'Bienvenue', photo_url: img('mot') }],
      partenaires: [{ id: 'pa1', nom: 'Maison', logo_url: img('logo'), created_at: '2026-10-01T10:00:00Z' }],
      boutique_reglages: [{ id: 'principal', ouverte: true }],
      boutique_categories: [{ id: 'c1', nom: 'Robes', slug: 'robes', actif: true, ordre: 0 }],
      boutique_produits: [{ id: 'b1', nom: 'Robe MA2M', slug: 'robe-ma2m', statut: 'en_vente', type: 'article', mis_en_avant: true, ordre: 0, created_at: '2026-10-01T10:00:00Z', description: 'Robe',
        photos: photosProduit, variantes: [{ id: 'v1', taille: 'M', couleur: 'Noir', prix_fcfa: 25000, stock: 3, actif: true, ordre: 0 }], categorie: { nom: 'Robes', slug: 'robes' } }] };
    const cas = [['index.html', /site\/(mot|logo)\.jpg/], ['qui-sommes-nous.html', /site\/mot\.jpg/], ['marketplace/index.html', /site\/robe/], ['marketplace/produit.html?p=robe-ma2m', /site\/robe/]];
    for (const [page, attendu] of cas) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const e5 = [], relais = [];
      p.on('pageerror', e => e5.push(e.message));
      await brancher(p, { tables: autres, rpc: { photos_couverture_mannequins: [] } }, []);
      await p.route(DIRECT, r => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
      await p.route(/book-photos\//, r => { relais.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }); });
      await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
      const entrer = await p.$('text=/^\\s*(Entrer|Enter)\\s*$/i'); if (entrer) await entrer.click().catch(() => {});
      await p.waitForTimeout(2500);
      const srcs = await p.evaluate(() => [...document.images].map(i => i.getAttribute('src') || '').filter(s => /book-photos|photos\.maitreakesse/.test(s)));
      ok(srcs.some(x => attendu.test(x)) && srcs.every(x => DIRECT.test(x)) && !relais.length, page + ' : images servies par Cloudflare (' + srcs.length + ')');
      if (/produit/.test(page)) {
        // galerie agrandie de la fiche produit : la photo agrandie vient aussi de Cloudflare
        await p.evaluate(() => { const v = document.querySelector('[data-index]'); if (v) v.click(); });
        await p.waitForTimeout(800);
        const grande = await p.evaluate(() => { const i = document.getElementById('lbg-img'); return i ? i.getAttribute('src') : ''; });
        ok(DIRECT.test(grande || ''), 'boutique : photo agrandie servie par Cloudflare (' + grande + ')');
      }
      if (page === 'index.html') {
        // galerie agrandie partagée (actualités, événements) avec des adresses de la base
        await p.evaluate(u => ouvrirGalerieLightbox([u], 0), img('actu'));
        await p.waitForTimeout(500);
        const grande = await p.evaluate(() => document.getElementById('lbg-img').getAttribute('src'));
        ok(DIRECT.test(grande || ''), 'galerie agrandie : photo servie par Cloudflare (' + grande + ')');
      }
      ok(!e5.length, page + ' : aucune erreur ' + e5.join(' | '));
      await ctx.close();
    }
  }

  // 2) Connexion coupée (ERR_CONNECTION_CLOSED du téléphone de la propriétaire) → relais
  for (const page of ['index.html', 'mannequins.html', 'mannequin.html?id=a1']) {
    const v = await visite(b, page, 'coupe', { mobile: true });
    ok(v.etat.srcs.length > 0 && v.etat.srcs.every(s => /\/book-photos\//.test(s)) && !v.etat.vides, page + ' coupé : toutes les photos repassent par le relais et s\'affichent (' + v.etat.srcs.length + ')');
    ok(Number(v.etat.marque) > Date.now() + 0.9 * 3600e3 && Number(v.etat.marque) < Date.now() + 1.1 * 3600e3, page + ' coupé : visiteur mémorisé 1 h');
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
    const v = await visite(b, page, 'muet', { mobile: true, attente: 20000 });
    ok(v.etat.srcs.length > 0 && v.etat.srcs.every(s => /\/book-photos\//.test(s)) && !v.etat.vides, page + ' muet : photos affichées par le relais après le délai (' + v.etat.srcs.length + ')');
    ok(!!v.etat.marque && v.signalements === 1, page + ' muet : visiteur mémorisé, noté une fois');
    ok(!v.errs.length, page + ' muet : aucune erreur ' + v.errs.join(' | '));
    await v.ctx.close();
  }

  // 3 bis-0) Connexion du visiteur très faible : Cloudflare ET relais muets → on reste sur
  //          Cloudflare (Vercel n'aiderait pas), pas de bascule ni d'alerte (21/10/2026)
  {
    const v = await visite(b, 'mannequin.html?id=a1', 'tout-muet', { mobile: true, attente: 20000 });
    ok(!v.etat.marque && v.signalements === 0, 'tout muet : pas de bascule vers Vercel ni d\'alerte');
    ok(v.etat.srcs.length > 0 && v.etat.srcs.every(s => DIRECT.test(s)), 'tout muet : les photos restent demandées à Cloudflare (' + v.etat.srcs.length + ')');
    ok(v.relais.every(u => /sonde-connexion/.test(u)), 'tout muet : seule la petite sonde est passée par Vercel (' + v.relais.length + ')');
    ok(!v.errs.length, 'tout muet : aucune erreur ' + v.errs.join(' | '));
    await v.ctx.close();
  }
  // navigateur neuf : les requêtes laissées sans réponse par les cas « muets » ci-dessus gardaient
  // le navigateur et le petit serveur de test occupés et bloquaient l'ouverture de la page
  // suivante (21/10/2026) : navigateur et serveur neufs
  await b.close(); b = await chromium.launch();
  srv.kill(); PORT = String(Number(PORT) + 100);
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  // 3 bis) Connexion seulement LENTE (photos en 11 s, mais Cloudflare répond) : on patiente,
  //        pas de bascule ni de fausse alerte
  {
    const v = await visite(b, 'mannequin.html?id=a1', 'lent', { mobile: true, attente: 16000 });
    ok(v.etat.srcs.length > 0 && v.etat.srcs.every(s => DIRECT.test(s)) && !v.etat.marque && v.signalements === 0 && v.relais.every(u => /sonde-connexion/.test(u)), 'lent : photos arrivées depuis Cloudflare, sans bascule, rien d\'autre que la sonde par Vercel ('  + v.etat.srcs.length + ')');
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
