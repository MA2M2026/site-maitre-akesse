// Recherche du Book (14/10/2026 ; barre intelligente du 12/11/2026, maquette validée par la propriétaire) : UNE barre
// qui comprend ce qu'on tape — nom, taille (« 1m75 », « 1,75 », « 175 », « ms75 », « plus de 1m80 »), ville, teint,
// yeux, cheveux, langue, niveau, mensurations (« bassin 97 »), pointure, taille de vêtement ; suggestions au toucher.
// Sans mesure exacte, profils à 2 cm près. Deux chapitres Main Board / New Faces. Base simulée.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9700 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
// [nom, catégorie, taille, poitrine, tour de taille, bassin, pointure, yeux, cheveux, ville, langues]
const P = [['Awa Koné', 'femme', 176, 84, 62, 97, '39', 'Marron', 'Noir', 'Abidjan', 'Français, Anglais'],
  ['Fatou Bamba', 'femme', 172, 88, 66, 95, '40', 'Noir', 'Noir', 'Bouaké', 'Français', null, null, 'Foncée'],
  ['Mariam Diallo', 'femme', 178, 85, 63, 97, '40', 'Marron', 'Brun', 'Abidjan', 'Français'],
  ['Koffi Yao', 'homme', 186, 98, 80, 96, '44', 'Marron', 'Noir', 'Abidjan', 'Français, Baoulé', null, 'Professionnel'],
  ['Sans Mesures', 'femme', null, null, null, null, null, null, null, 'Abidjan', ''],
  // mesures incohérentes (« à reprendre ») : cachées sur sa fiche, donc introuvables par mesure
  ['Mesures Cachees', 'femme', 175, 84, 62, 112, null, null, null, 'Abidjan', ''],
  // ancienne fiche : seulement la taille de vêtement déclarée
  ['Ancienne Fiche', 'femme', null, null, null, null, null, null, 'Marron', 'Abidjan', '', 'M'],
  ['Ville Man', 'femme', null, null, null, null, null, null, null, 'Man', '', null, null, 'Très foncée']]
  .map((x, i) => ({ id: '00000000-0000-0000-0000-00000000000' + i, full_name: x[0], category: x[1], height_cm: x[2], chest_cm: x[3], waist_cm: x[4], hips_cm: x[5], shoe_size: x[6], eye_color: x[7], hair_color: x[8], city: x[9], languages: x[10], clothing_size: x[11] || null, published: true, niveau_mannequin: x[12] || 'New Face', carnation: x[13] || null }));
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
    const chercher = async (v) => { await p.fill('#f-recherche', String(v)); await p.waitForTimeout(150); };
    const effacer = async () => { await p.click('#f-effacer'); await p.waitForTimeout(150); };
    const trie = (t) => t.split(', ').sort().join(', ');
    ok((await noms()).split(', ').length === 8, n + 'les 8 profils au départ');
    // deux chapitres : Main Board (niveau « Professionnel ») puis New Faces
    ok(await p.$$eval('.book-chapitre', l => l.map(c => c.dataset.chapitre + ':' + c.querySelectorAll('.medaillon-carte').length).join()) === 'main:1,new:7', n + 'deux chapitres, Main Board puis New Faces');
    // une seule barre : catégorie + recherche (plus de panneau de mesures ni de bouton « Filtres »)
    ok(await p.isVisible('#f-recherche') && !(await p.$('#f-bassin')) && !(await p.$('.filtres-mesures-bouton')) && !(await p.$('.filtre-niveau-btn')), n + 'une seule barre de recherche, sans panneau de mesures');
    const lignes = await p.$$eval('.book-segments .filtre-btn', l => new Set(l.map(e => Math.round(e.getBoundingClientRect().top))).size);
    ok(lignes === 1, n + 'Tous / Femmes / Hommes sur une seule ligne');
    ok(!(await p.$$eval('.filtre-btn', l => l.some(e => { const r = document.createRange(); r.selectNodeContents(e); const cs = getComputedStyle(e);
      return r.getBoundingClientRect().width > e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1; }))), n + 'aucun bouton coupé');
    // suggestions au toucher de la barre vide ; refermées dès qu'on tape
    await p.click('#f-recherche'); await p.waitForTimeout(200);
    ok(await p.isVisible('#book-suggestions') && await p.$$eval('#book-suggestions .book-sug', l => l.length) >= 4, n + 'suggestions affichées au toucher');
    await p.click('#book-suggestions .book-sug[data-q="Bouaké"], #book-suggestions .book-sug[data-q="Bouake"]'); await p.waitForTimeout(200);
    ok(await noms() === 'Fatou Bamba' && !(await p.isVisible('#book-suggestions')), n + 'un toucher sur « Bouaké » cherche la ville et referme les suggestions (' + await noms() + ')');
    await effacer();
    await p.click('#f-recherche'); await p.keyboard.type('ba'); await p.waitForTimeout(200);
    ok(!(await p.isVisible('#book-suggestions')), n + 'suggestions refermées dès qu’on tape'); await effacer();
    await chercher('bassin 97');
    ok(await noms() === 'Awa Koné, Mariam Diallo', n + '« bassin 97 » → les deux à 97 (' + await noms() + ')');
    ok(/2 profils correspondent|2 profiles/.test(await p.textContent('#f-compte')) && await p.isVisible('#f-effacer'), n + 'compteur et « Effacer les filtres »');
    await chercher('bassin 98');
    ok(await noms() === trie('Awa Koné, Mariam Diallo, Koffi Yao') && await p.isVisible('#f-proches'), n + '« bassin 98 » (personne) → profils à 2 cm près, avec message (' + await noms() + ')');
    await effacer();
    ok((await noms()).split(', ').length === 8 && await p.inputValue('#f-recherche') === '', n + '« Effacer les filtres » remet tout');
    await chercher('poitrine 88'); ok(await noms() === 'Fatou Bamba', n + '« poitrine 88 »'); await effacer();
    await chercher('tour de taille 80'); ok(await noms() === 'Koffi Yao', n + '« tour de taille 80 »'); await effacer();
    await chercher('pointure 40'); ok(await noms() === 'Fatou Bamba, Mariam Diallo', n + '« pointure 40 »'); await effacer();
    // la taille, écrite de toutes les façons : à 2 cm près
    for (const q of ['1m76', '1,76', '1.76', '176', 'ms76']) { await chercher(q); ok(await noms() === 'Awa Koné, Mariam Diallo, Mesures Cachees', n + '« ' + q + ' » → de 1,74 m à 1,78 m (' + await noms() + ')'); }
    await chercher('plus de 1m75'); ok(await noms() === 'Awa Koné, Koffi Yao, Mariam Diallo, Mesures Cachees', n + '« plus de 1m75 » (fiches sans taille écartées)');
    await chercher('femmes plus de 1m77'); ok(await noms() === 'Mariam Diallo', n + '« femmes plus de 1m77 »'); await effacer();
    await chercher('bassin 112'); ok(await noms() === '', n + 'mesure cachée sur la fiche (« à reprendre ») : introuvable par la recherche'); await effacer();
    await chercher('taille S'); ok((await noms()).includes('Fatou Bamba') && (await noms()).includes('Mariam Diallo') && !(await noms()).includes('Sans Mesures'), n + '« taille S » (grille de l’agence) (' + await noms() + ')'); await effacer();
    await chercher('M'); ok((await noms()).includes('Ancienne Fiche') && !(await noms()).includes('Sans Mesures'), n + '« M » : taille de vêtement, ancienne taille déclarée comprise (' + await noms() + ')'); await effacer();
    await chercher('yeux noirs'); ok(await noms() === 'Fatou Bamba', n + '« yeux noirs »'); await effacer();
    await chercher('cheveux bruns'); ok(await noms() === 'Ancienne Fiche, Mariam Diallo', n + '« cheveux bruns » : « Brun » et « Marron » = la même chose (' + await noms() + ')'); await effacer();
    await chercher('Bouake'); ok(await noms() === 'Fatou Bamba', n + 'ville, même sans accent'); await effacer();
    await chercher('anglais'); ok(await noms() === 'Awa Koné', n + 'langue « anglais »'); await effacer();
    await chercher('main board'); ok(await noms() === 'Koffi Yao', n + '« main board » (niveau)'); await effacer();
    await p.click('.filtre-btn[data-cat="homme"]'); await chercher('bassin 96'); ok(await noms() === 'Koffi Yao', n + 'Hommes + « bassin 96 »'); await effacer();
    await chercher('koff'); ok(await noms() === 'Koffi Yao', n + 'recherche par nom'); await effacer();
    // formes de la vie réelle (relecture du 12/11/2026)
    await chercher('1,76 m'); ok(await noms() === 'Awa Koné, Mariam Diallo, Mesures Cachees', n + '« 1,76 m » : le « m » n’est pas pris pour la taille M (' + await noms() + ')');
    await chercher('+1m77'); ok(await noms() === 'Koffi Yao, Mariam Diallo', n + '« +1m77 » = au moins 1,77 m (' + await noms() + ')');
    await chercher('brown eyes'); ok(await noms() === 'Awa Koné, Koffi Yao, Mariam Diallo', n + '« brown eyes » (ordre anglais) (' + await noms() + ')'); await effacer();
    await chercher('Man'); ok(await noms() === 'Ville Man', n + '« Man » : la ville, pas « homme » (' + await noms() + ')'); await effacer();
    await chercher('foncée'); ok(await noms() === 'Fatou Bamba', n + 'teint exact : « Foncée » ne donne pas « Très foncée » (' + await noms() + ')'); await effacer();
    await chercher('nul'); ok(await noms() === '', n + 'une case vide de la fiche ne répond pas à « nul »'); await effacer();
    // un mot de catégorie tapé ne bloque pas les boutons
    await chercher('femmes 1m76'); await p.click('.filtre-btn[data-cat="homme"]'); await p.waitForTimeout(150);
    ok(await p.inputValue('#f-recherche') === '1m76' && await noms() === '', n + 'bouton « Hommes » après « femmes 1m76 » : le mot « femmes » est retiré de la barre'); await effacer();
    // sélection : barre blanche lisible en bas
    await p.click('#grille .medaillon-carte .btn-selection'); await p.waitForTimeout(300);
    const barre = await p.evaluate(() => { const t = document.querySelector('.panier-barre .panier-texte'), g = document.querySelector('.panier-barre .panier-go');
      return t && g ? { texte: t.textContent.trim(), l: t.getBoundingClientRect().width, h: t.getBoundingClientRect().height, fond: getComputedStyle(t).backgroundColor, go: g.getBoundingClientRect().width } : null; });
    ok(barre && /^1 (profil sélectionné|profile selected)$/.test(barre.texte) && barre.l > 90 && barre.h < 40 && barre.fond === 'rgba(0, 0, 0, 0)' && barre.go > 100, n + 'barre de sélection lisible (' + JSON.stringify(barre) + ')');
    await p.click('#grille .medaillon-carte .btn-selection'); await p.waitForTimeout(200);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page + '?categorie=homme', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2000);
    ok(await noms() === 'Koffi Yao', n + 'lien « Hommes » (?categorie=homme)');
    await effacer();
    ok((await noms()).split(', ').length === 8 && !p.url().includes('?'), n + '« Effacer les filtres » nettoie aussi l’adresse (' + p.url().replace(/^.*\//, '') + ')');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
