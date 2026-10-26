// Recherche du Book (14/10/2026, demande de la propriétaire) : un recruteur ne connaît pas les
// noms ; il cherche par mesures. Chaque critère s'utilise SEUL (ex. tour de bassin 97 → toutes
// celles qui font 97), sans qu'un autre le bloque ; sans mesure exacte, profils à 2 cm près.
// Catégorie et niveau sur une seule ligne (tablette, ordinateur). Base simulée.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9700 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
// [nom, catégorie, taille, poitrine, tour de taille, bassin, pointure, yeux, cheveux, ville, langues]
const P = [['Awa Koné', 'femme', 176, 84, 62, 97, '39', 'Marron', 'Noir', 'Abidjan', 'Français, Anglais'],
  ['Fatou Bamba', 'femme', 172, 88, 66, 95, '40', 'Noir', 'Noir', 'Bouaké', 'Français'],
  ['Mariam Diallo', 'femme', 178, 85, 63, 97, '40', 'Marron', 'Brun', 'Abidjan', 'Français'],
  ['Koffi Yao', 'homme', 186, 98, 80, 96, '44', 'Marron', 'Noir', 'Abidjan', 'Français, Baoulé'],
  ['Sans Mesures', 'femme', null, null, null, null, null, null, null, 'Abidjan', ''],
  // mesures incohérentes (« à reprendre ») : cachées sur sa fiche, donc introuvables par mesure
  ['Mesures Cachees', 'femme', 175, 84, 62, 112, null, null, null, 'Abidjan', ''],
  // ancienne fiche : seulement la taille de vêtement déclarée
  ['Ancienne Fiche', 'femme', null, null, null, null, null, null, 'Marron', 'Abidjan', '', 'M']]
  .map((x, i) => ({ id: '00000000-0000-0000-0000-00000000000' + i, full_name: x[0], category: x[1], height_cm: x[2], chest_cm: x[3], waist_cm: x[4], hips_cm: x[5], shoe_size: x[6], eye_color: x[7], hair_color: x[8], city: x[9], languages: x[10], clothing_size: x[11] || null, published: true, niveau_mannequin: 'New Face' }));
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [page, vp] of [['mannequins.html', { width: 390, height: 844 }], ['mannequins.html', { width: 800, height: 1078 }], ['en/mannequins.html', { width: 1280, height: 900 }]]) {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await brancher(p, { tables: { model_profiles: P }, rpc: {} }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
    const n = page + ' ' + vp.width + 'px : ';
    const noms = () => p.$$eval('#grille .medaillon-nom', l => l.map(e => e.textContent.trim()).sort().join(', '));
    const saisir = async (id, v) => { await p.fill('#' + id, String(v)); await p.waitForTimeout(150); };
    // valeur d'un choix = mot anglais en minuscules (cleChoix, js/mannequins.js)
    const choisir = async (id, v) => { await p.selectOption('#' + id, await p.evaluate(x => /^f-(yeux|cheveux|ville|langue)$/.test(x[0]) ? cleChoix(x[1]) : x[1], [id, v])); await p.waitForTimeout(150); };
    const effacer = async () => { await p.click('#f-effacer'); await p.waitForTimeout(150); };
    ok((await noms()).split(', ').length === 7, n + 'les 7 profils au départ');
    const lignes = await p.$$eval('.filtres-ligne .filtre-btn', l => new Set(l.map(e => Math.round(e.getBoundingClientRect().top))).size);
    ok(vp.width >= 800 ? lignes === 1 : lignes === 2, n + 'catégorie et niveau ' + (vp.width >= 800 ? 'sur une seule ligne' : 'en deux rangées rangées') + ' (' + lignes + ')');
    // texte plus large que l'intérieur du bouton (la coche du filtre choisi, posée dans le coin, ne compte pas)
    ok(!(await p.$$eval('.filtre-btn', l => l.some(e => { const r = document.createRange(); r.selectNodeContents(e); const cs = getComputedStyle(e);
      return r.getBoundingClientRect().width > e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1; }))), n + 'aucun bouton coupé');
    // téléphone : mesures repliées au départ (profils juste sous les boutons), ouvertes d'un toucher (20/10/2026)
    if (vp.width < 720) {
      ok(!(await p.isVisible('#f-bassin')) && await p.isVisible('.filtres-mesures-bouton'), n + 'mesures repliées au départ');
      await p.click('.filtres-mesures-bouton'); await p.waitForTimeout(200);
      ok(await p.isVisible('#f-bassin') && await p.getAttribute('.filtres-mesures-bouton', 'aria-expanded') === 'true', n + 'mesures ouvertes d\'un toucher');
    } else ok(await p.isVisible('#f-bassin') && !(await p.isVisible('.filtres-mesures-bouton')), n + 'mesures toujours visibles');
    await saisir('f-bassin', 97);
    ok(await noms() === 'Awa Koné, Mariam Diallo', n + 'tour de bassin 97 seul → les deux à 97 (' + await noms() + ')');
    ok(/2 profils correspondent|2 profiles/.test(await p.textContent('#f-compte')) && await p.isVisible('#f-effacer'), n + 'compteur et « Effacer les filtres »');
    await saisir('f-bassin', 98);
    ok(await noms() === 'Awa Koné, Mariam Diallo, Koffi Yao'.split(', ').sort().join(', ') && await p.isVisible('#f-proches'), n + 'bassin 98 (personne) → profils à 2 cm près, avec message (' + await noms() + ')');
    await effacer();
    ok((await noms()).split(', ').length === 7 && await p.inputValue('#f-bassin') === '', n + '« Effacer les filtres » remet tout');
    await saisir('f-poitrine', 88); ok(await noms() === 'Fatou Bamba', n + 'poitrine 88 seule'); await effacer();
    await saisir('f-tour-taille', 80); ok(await noms() === 'Koffi Yao', n + 'tour de taille 80 seul'); await effacer();
    await saisir('f-pointure', 40); ok(await noms() === 'Fatou Bamba, Mariam Diallo', n + 'pointure 40 seule'); await effacer();
    await saisir('f-taille-min', 175); ok(await noms() === 'Awa Koné, Koffi Yao, Mariam Diallo, Mesures Cachees', n + 'taille min 175 (fiches sans taille écartées)'); await effacer();
    await saisir('f-bassin', 112); ok(await noms() === '', n + 'mesure cachée sur la fiche (« à reprendre ») : introuvable par la recherche'); await effacer();
    await choisir('f-taille-haut', 'S'); ok(await noms() === 'Fatou Bamba, Mariam Diallo', n + 'taille haut S (poitrine 85-89, grille de l’agence)'); await effacer();
    await choisir('f-taille-bas', 'M'); ok((await noms()).includes('Awa Koné') && !(await noms()).includes('Sans Mesures'), n + 'taille bas M'); await effacer();
    await choisir('f-taille-complete', 'M'); ok((await noms()).includes('Mariam Diallo') && !(await noms()).includes('Fatou Bamba') && (await noms()).includes('Ancienne Fiche'), n + 'taille complète M, ancienne taille déclarée comprise (' + await noms() + ')'); await effacer();
    await p.click('.filtres-plus summary');
    await choisir('f-yeux', 'Noir'); ok(await noms() === 'Fatou Bamba', n + 'yeux noirs seuls'); await effacer();
    const cheveux = await p.$$eval('#f-cheveux option', l => l.map(o => o.textContent));
    ok(new Set(cheveux).size === cheveux.length, n + 'pas de doublon dans la liste des cheveux (' + cheveux.join(', ') + ')');
    await choisir('f-cheveux', 'Brun'); ok(await noms() === 'Ancienne Fiche, Mariam Diallo', n + 'cheveux « Brun » et « Marron » = un seul choix (' + await noms() + ')'); await effacer();
    await choisir('f-ville', 'Bouaké'); ok(await noms() === 'Fatou Bamba', n + 'ville seule'); await effacer();
    await choisir('f-langue', 'Anglais'); ok(await noms() === 'Awa Koné', n + 'langue anglais seule'); await effacer();
    await p.click('.filtre-btn[data-cat="homme"]'); await saisir('f-bassin', 96); ok(await noms() === 'Koffi Yao', n + 'Hommes + bassin 96'); await effacer();
    await saisir('f-recherche', 'koff'); ok(await noms() === 'Koffi Yao', n + 'recherche par nom (en dernier recours)'); await effacer();
    await p.goto('http://127.0.0.1:' + PORT + '/' + page + '?categorie=homme', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
    ok(await noms() === 'Koffi Yao', n + 'lien « Hommes » (?categorie=homme)');
    await effacer();
    ok((await noms()).split(', ').length === 7 && !p.url().includes('?'), n + '« Effacer les filtres » nettoie aussi l’adresse (' + p.url().replace(/^.*\//, '') + ')');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
