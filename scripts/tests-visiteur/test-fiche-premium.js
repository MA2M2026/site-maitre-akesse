// Fiche publique « premium » d'une mannequin (11/11/2026, maquette validée par la propriétaire), comme un visiteur,
// base SIMULÉE, téléphone 390 px et ordinateur 1440 px, français et anglais :
//  - arrivée : grande photo, nom, « Disponible immédiatement » ; 6 mensurations essentielles ; le détail complet
//    dans « Toutes les mensurations » ;
//  - chapitres Sélection · À propos · Parcours · Book ; « Sélection » = les photos de la compcard (choisies par la
//    mannequin et l'agence), dans l'ordre, qui s'ouvrent en grand ;
//  - parcours en frise : 3 projets, l'année en grand, puis « Voir tous les projets » ;
//  - Book : 12 photos puis « Voir les N photos » ;
//  - téléphone : « Réserver / Compcard » collés en BAS de l'écran (même en descendant) ; ordinateur : pas de barre,
//    le nom et les mensurations à droite de la photo.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path');
const { fondsInterdits } = require('./couleurs-autorisees');
const PORT = String(8900 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const photos = Array.from({ length: 16 }, (_, i) => ({ id: 'p' + i, model_id: 'a1', url: 'https://x/' + i + '.jpg', url_moyenne: 'https://x/' + i + '-m.jpg', url_miniature: 'https://x/' + i + '-s.jpg',
  principale: i === 0, photo_couverture: i === 1, compcard_ordre: [null, null, 3, null, 1, null, 2, null, 5, 4][i] || null, created_at: '2026-01-' + String(10 + i).padStart(2, '0') + 'T10:00:00Z' }));
const tables = {
  model_profiles: [{ id: 'a1', full_name: 'Awa Koné', city: 'Abidjan', height_cm: 178, weight_kg: 55, chest_cm: 80, waist_cm: 61, hips_cm: 90, inseam_cm: 82, shoe_size: '40', eye_color: 'Marron',
    hair_color: 'Noirs', category: 'femme', published: true, slug: 'awa-kone', availability: 'immediate', bio: 'Mannequin passionnée de défilés.', languages: 'Français, anglais', model_types: ['catwalk', 'photo'] }],
  model_photos: photos,
  model_projects: [2026, 2025, 2024, 2023, 2022].map((a, i) => ({ id: 'x' + i, model_id: 'a1', type_projet: 'Défilé', titre: 'Défilé ' + a, periode: 'Mars ' + a, ville: 'Abidjan', created_at: (a === 2026 ? '2019' : a) + '-03-01T10:00:00Z' })),  // (2026 saisi en premier : la fiche doit quand même le montrer en tête)
  bandeau_annonce: [], admins: []
};
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, vp, en] of [['téléphone', { width: 390, height: 844 }, false], ['ordinateur', { width: 1440, height: 900 }, false], ['téléphone EN', { width: 390, height: 844 }, true]]) {
    const n = nom + ' : ';
    const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 700, hasTouch: vp.width < 700 }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables, rpc: { ages_mannequins: [{ id: 'a1', age: 21 }], mesures_supp_publiques: [] } }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + (en ? 'en/' : '') + 'mannequin.html?id=a1'); await p.waitForSelector('.fiche-v2', { timeout: 15000 });
    await p.waitForTimeout(1500);
    const refus = await p.$('#bandeau-cookies button'); if (refus) await refus.click().catch(() => {});
    // 1. arrivée et mensurations
    const mens = await p.$$eval('.fiche-mens > div', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    ok(!/\d+\s*(ans|years)\b|Âge|\bAge\b/.test(await p.textContent('.fiche-v2')), n + 'l’âge n’est plus affiché sur la fiche (13/11/2026)');
    ok(mens.length === 6 && /178/.test(mens[0]) && /Marron|Brown/.test(mens[5]), n + '6 mensurations essentielles (' + mens.join(' | ') + ')');
    ok(/Awa Koné/.test(await p.textContent('h1')) && /(Disponible immédiatement|Available immediately)/.test(await p.textContent('.fiche-v2')), n + 'nom en grand et « Disponible immédiatement »');
    // (12/11/2026, demande de la propriétaire) la photo de profil toujours visible, en rond, sans cacher « Disponible »
    const rond = await p.evaluate(() => { const a = document.querySelector('.fiche-avatar img'); if (!a) return null; const r = a.getBoundingClientRect(), d = [...document.querySelectorAll('.fiche-dispo')].find((x) => x.offsetParent);
      const q = d && d.getBoundingClientRect(); return { src: a.getAttribute('src'), vu: r.width > 60, chevauche: !!q && !(r.right <= q.left || r.left >= q.right || r.bottom <= q.top || r.top >= q.bottom) }; });
    ok(rond && /0-s\.jpg$/.test(rond.src) && rond.vu && !rond.chevauche, n + 'photo de profil en rond, visible, sans cacher « Disponible » (' + JSON.stringify(rond) + ')');
    ok(!(await p.isVisible('.fiche-mesures')), n + 'le détail des mensurations est replié');
    await p.click('.fiche-mens-tout > summary');
    ok(await p.isVisible('.fiche-mesures') && /82 cm/.test(await p.textContent('.fiche-mesures')), n + '« Toutes les mensurations » : le détail complet (entrejambe 82 cm)');
    // (12/11/2026, capture de la propriétaire) « Compcard » du panneau : PDF et JPEG visibles, lisibles, rien par-dessus
    await p.$eval('#btn-compcard', (x) => x.scrollIntoView({ block: 'center', behavior: 'instant' })); await p.waitForTimeout(200);
    await p.click('#btn-compcard'); await p.waitForTimeout(300);
    const menu = await p.$$eval('#menu-compcard button', (l) => l.map((x) => { const r = x.getBoundingClientRect(), c = getComputedStyle(x);
      const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { texte: x.textContent.trim(), vu: r.height > 20, lisible: c.color !== c.backgroundColor && c.webkitTextFillColor !== c.backgroundColor, libre: dessus === x || x.contains(dessus) }; }));
    ok(menu.length === 2 && menu.every((m) => m.vu && m.lisible && m.libre), n + '« Compcard » : PDF et JPEG visibles, lisibles, rien par-dessus (' + JSON.stringify(menu) + ')');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    // 2. chapitres et Sélection (compcard dans l'ordre)
    const chapitres = await p.$$eval('.fiche-onglets a', (l) => l.map((a) => a.textContent.replace(/\s+\d+$/, '').trim()));
    ok(chapitres.join('|') === (en ? 'Selection|About|Career|Book|Contact' : 'Sélection|À propos|Parcours|Book|Contact'), n + 'chapitres ' + chapitres.join(' · '));
    const sel = await p.$$eval('.fiche-edito-photo img', (l) => l.map((i) => i.getAttribute('src')));
    ok(sel.length === 5 && /4-m\.jpg$/.test(sel[0]) && /6-s\.jpg$/.test(sel[1]) && /8-s\.jpg$/.test(sel[4]), n + 'Sélection = les 5 photos de la compcard, dans l’ordre 1 → 5');
    await p.click('.fiche-edito-photo.grande'); await p.waitForTimeout(600);
    ok(await p.evaluate(() => !!document.querySelector('.lightbox.active, .lightbox.open, .galerie-lightbox.active, [class*="lightbox"][class*="ouvert"], [class*="lightbox"].active')), n + 'une photo de la Sélection s’ouvre en grand');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    // 3. parcours en frise
    const annees = await p.$$eval('#fiche-parcours .fiche-projets:not(.fiche-projets-suite) .fiche-projet-annee', (l) => l.map((x) => x.textContent));
    ok(annees.join(',') === '2026,2025,2024', n + 'parcours en frise : 3 projets, l’année en grand (' + annees.join(', ') + ')');
    // 4. Book : 12 puis tout
    const visibles = () => p.$$eval('#galerie .book-photo-carte', (l) => l.filter((x) => getComputedStyle(x).display !== 'none').length);
    ok((await visibles()) === 12 && /16/.test(await p.textContent('#btn-voir-book')), n + 'Book : 12 photos, puis « Voir les 16 photos »');
    await p.$eval('#btn-voir-book', (x) => x.scrollIntoView({ block: 'center', behavior: 'instant' })); await p.waitForTimeout(300);
    await p.click('#btn-voir-book'); await p.waitForTimeout(300);
    ok((await visibles()) === 16 && !(await p.$('#btn-voir-book')), n + '« Voir les 16 photos » : tout le Book');
    // 5. barre du bas (téléphone) / panneau à droite (ordinateur)
    if (vp.width < 700) {
      await p.evaluate(() => scrollTo(0, 1800)); await p.waitForTimeout(300);
      const barre = await p.$eval('.fiche-barre', (x) => { const r = x.getBoundingClientRect(); return { bas: Math.round(r.bottom), vu: getComputedStyle(x).display !== 'none' }; });
      ok(barre.vu && Math.abs(barre.bas - innerHeightOf(vp)) <= 1, n + '« Réserver / Compcard » collés en bas de l’écran en descendant (bas à ' + barre.bas + ' px)');
      ok(await p.getAttribute('.fiche-barre-reserver', 'href') === '#fiche-contact', n + '« Réserver » mène au contact de l’agence');
    } else {
      ok(!(await p.isVisible('.fiche-barre')) && await p.isVisible('.fiche-panneau-nom'), n + 'ordinateur : pas de barre en bas, le nom à droite de la photo');
      const cotes = await p.evaluate(() => { const a = document.querySelector('.profil-hero-fullbleed').getBoundingClientRect(), c = document.querySelector('.fiche-panneau').getBoundingClientRect(); return a.right <= c.left + 1 && Math.abs(a.top - c.top) < 2; });
      ok(cotes, n + 'la photo à gauche, le panneau rouge à droite');
    }
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), n + 'rien ne dépasse de l’écran');
    const interdits = await p.evaluate(fondsInterdits);
    ok(!interdits.length, n + 'seulement des fonds rouges ou blancs' + (interdits.length ? ' — ' + interdits.slice(0, 4).map((x) => x.element + ' ' + x.couleur).join(' | ') : ''));
    if (process.env.CAPTURES) await p.screenshot({ path: path.join(process.env.CAPTURES, 'fiche-premium-' + vp.width + (en ? '-en' : '') + '.png'), fullPage: true });
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
function innerHeightOf(vp) { return vp.height; }
