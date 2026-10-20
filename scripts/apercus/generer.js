// Images d'aperçu des liens partagés (WhatsApp, Facebook, Instagram…), une par page et par langue
// (demande de la propriétaire, 14/10/2026 : « l'aperçu doit montrer où l'on est »). 1200 × 630.
// Style « Magazine » depuis le 20/10/2026 (demande de la propriétaire : aperçus conformes au
// nouveau design) : papier beige, grand titre Big Shoulders Display, rubrique rouge, texte Work
// Sans, bandeau rouge « MA2M ». Rendu par Chromium avec les polices du site, puis enregistré dans
// assets/apercus/. Les fiches des mannequins (/book/…), articles et événements gardent leur propre
// aperçu avec leur photo (middleware.js).
//   1) polices : cd <dossier> && npm pack @fontsource/big-shoulders-display @fontsource/work-sans,
//      puis extraire chaque archive dans un dossier du même nom (mkdir x && tar xzf x.tgz -C x) ;
//   2) POLICES=<dossier> NODE_PATH=$(npm root -g) node scripts/apercus/generer.js
// Après un changement : modifier le numéro ?v= des og:image dans les pages et dans middleware.js
// (sinon WhatsApp et Facebook gardent l'ancienne image en mémoire).
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const RACINE = path.resolve(__dirname, '../..');
const POLICES = process.env.POLICES;
// [page, [surtitre, titre, sous-titre] FR, [idem] EN]
const PAGES = [
  ['index', ['Maître Akesse Model Management', 'Agence de<br>mannequins', 'Chaque grand parcours commence par un rêve.'], ['Maître Akesse Model Management', 'Model<br>agency', 'Every great journey begins with a dream.']],
  ['mannequins', ['Nos mannequins', 'The Book', 'Femmes, hommes, New Faces : books et mensurations'], ['Our models', 'The Book', 'Women, men, New Faces: books and measurements']],
  ['inscription-mannequin', ['Espace candidats retenus', 'Inscription<br>mannequin', 'Finalisez votre inscription officielle à l’agence'], ['Selected candidates', 'Model<br>registration', 'Complete your official registration with the agency']],
  ['integrer-agence', ['Devenir mannequin', 'Intégrer l’agence', 'Envoyez vos photos et vos mensurations'], ['Become a model', 'Join the agency', 'Send your photos and measurements']],
  ['candidature', ['Castings', 'Postuler<br>à un casting', 'Un projet précis lancé par l’agence'], ['Castings', 'Apply for<br>a casting', 'A specific project launched by the agency']],
  ['parcours', ['Nos réalisations', 'Parcours MA2M', 'Défilés, shootings, castings, mois par mois'], ['Our work', 'MA2M Track Record', 'Shows, shoots and castings, month by month']],
  ['agenda', ['À venir', 'Agenda', 'Prochains shootings, défilés et castings'], ['Coming up', 'Agenda', 'Upcoming shoots, shows and castings']],
  ['qui-sommes-nous', ['L’agence', 'Qui sommes-nous', 'Former, révéler, valoriser'], ['The agency', 'About us', 'Train, reveal, promote']],
  ['services', ['Ce que nous faisons', 'Services', 'Management, formation, casting, booking, défilés'], ['What we do', 'Services', 'Management, training, casting, booking, shows']],
  ['actualites', ['Mode d’ici et d’ailleurs', 'Actualités', 'Castings, affiches, coulisses et temps forts'], ['Fashion here and beyond', 'News', 'Castings, posters, behind the scenes']],
  ['evenements', ['En images', 'Nos événements', 'Les événements de l’agence et de nos mannequins'], ['In pictures', 'Our events', 'Events by the agency and our models']],
  ['partenaires', ['Ils nous font confiance', 'Nos partenaires', 'Promoteurs, marques et collaborateurs'], ['They trust us', 'Our partners', 'Promoters, brands and collaborators']],
  ['contact', ['Abidjan, Côte d’Ivoire', 'Contact', 'Partenariats, collaborations, recrutement'], ['Abidjan, Côte d’Ivoire', 'Contact', 'Partnerships, collaborations, scouting']],
  ['mannequin', ['The Book', 'Profil mannequin', 'Le book complet du mannequin'], ['The Book', 'Model profile', 'The model’s full book']],
  ['selection', ['Casting groupé', 'Ma sélection', 'Les profils choisis pour votre demande'], ['Group casting', 'My selection', 'The profiles chosen for your request']],
  ['espace-mannequin', ['Réservé aux mannequins', 'Espace mannequin', 'Mon book, mes photos, mon parcours'], null]
];
// Images sans page du même nom à la racine (20/10/2026) : la boutique « La Maison MA2M »
// (marketplace/index.html et produit.html, en français seulement)
const AUTRES = [
  ['boutique', ['La boutique de l’agence', 'La Maison<br>MA2M', 'Articles, billets d’événements et services de l’agence'], null]
];
function css() {
  const dossiers = fs.readdirSync(POLICES).filter(d => fs.statSync(path.join(POLICES, d)).isDirectory());
  const trouver = n => {
    const d = dossiers.find(x => x.includes(n));
    if (!d) throw new Error('Police « ' + n + ' » introuvable dans ' + POLICES + ' (voir le mode d’emploi en tête du fichier)');
    return path.join(POLICES, d, 'package/files');
  };
  return [['Big Shoulders Display', 'big-shoulders-display', [800, 900]], ['Work Sans', 'work-sans', [500, 600]]].map(([nom, cle, poids]) =>
    poids.map(p => `@font-face { font-family: '${nom}'; font-weight: ${p}; src: url('file://${trouver(cle)}/${cle}-latin-${p}-normal.woff2'); }`).join('\n')).join('\n');
}
// Couleurs du design « Magazine » (css/jetons.css : --mag-papier, --mag-encre, --rouge-ma2m)
const gabarit = (surtitre, titre, sousTitre, adresse, anglais) => `<!doctype html><html><head><meta charset="utf-8"><style>
${css()}
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #F1ECE5; color: #1B1817; font-family: 'Work Sans';
  display: grid; grid-template-columns: 1fr 360px; }
.texte { padding: 56px 56px 52px 64px; display: flex; flex-direction: column; min-width: 0; }
.logo { width: 300px; }
.filet { height: 3px; background: #1B1817; margin-top: 18px; }
.sur { margin-top: 60px; font-weight: 600; font-size: 22px; letter-spacing: 0.24em; text-transform: uppercase; color: #C8102E; }
h1 { font-family: 'Big Shoulders Display'; font-weight: 900; text-transform: uppercase; font-size: 150px; line-height: 0.88; margin-top: 14px; white-space: nowrap; }
.sous { margin-top: auto; font-size: 27px; font-weight: 500; color: #4A433E; line-height: 1.3; }
.adresse { margin-top: 12px; font-size: 18px; letter-spacing: 0.06em; color: #6E655E; }
.rouge { background: #C8102E; color: #fff; display: flex; flex-direction: column; justify-content: space-between; padding: 52px 44px 48px; }
.monogramme { font-family: 'Big Shoulders Display'; font-weight: 900; font-size: 150px; line-height: 0.82; letter-spacing: 0.01em; }
.signature { font-family: 'Big Shoulders Display'; font-weight: 800; font-size: 40px; line-height: 0.95; text-transform: uppercase; }
.lieu { font-size: 16px; letter-spacing: 0.14em; white-space: nowrap; text-transform: uppercase; margin-top: 12px; opacity: 0.9; }
</style></head><body>
<div class="texte"><img class="logo" src="file://${RACINE}/assets/logo-intro-clair.png" alt=""><div class="filet"></div>
<div class="sur">${surtitre}</div><h1>${titre}</h1><div class="sous">${sousTitre}</div><div class="adresse">${adresse}</div></div>
<div class="rouge"><div class="monogramme">MA<br>2M</div><div><div class="signature">${anglais ? 'The agency’s<br>magazine' : 'Le magazine<br>de l’agence'}</div><div class="lieu">Abidjan · Côte d’Ivoire</div></div></div>
</body></html>`;
// Titre sur une ligne (deux s'il contient <br>), réduit jusqu'à tenir dans sa colonne en laissant
// de l'air au-dessus du sous-titre
function ajusterTitre() {
  const h1 = document.querySelector('h1'), sous = document.querySelector('.sous');
  let taille = 150;
  const tropGrand = () => h1.scrollWidth > h1.clientWidth + 1 || sous.getBoundingClientRect().top - h1.getBoundingClientRect().bottom < 28;
  while (taille > 60 && tropGrand()) { taille -= 4; h1.style.fontSize = taille + 'px'; }
}
async function capturer(p, fichierHtml, sortie, { page, langue, t }) {
  const chemin = [langue === 'en' ? 'en' : '', page === 'index' ? '' : page === 'boutique' ? 'marketplace' : page].filter(Boolean).join('/');
  fs.writeFileSync(fichierHtml, gabarit(t[0], t[1], t[2], 'maitreakessemodelmanagement.com' + (chemin ? '/' + chemin : ''), langue === 'en'));
  await p.goto('file://' + fichierHtml);
  await p.evaluate(() => document.fonts.ready);
  // police introuvable : on s'arrête plutôt que de produire des images dans une autre police
  const polices = await p.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replaceAll('"', '')));
  if (!polices.includes('Big Shoulders Display') || !polices.includes('Work Sans')) throw new Error('Polices non chargées : ' + polices.join(', '));
  await p.evaluate(ajusterTitre);
  await p.screenshot({ path: path.join(sortie, langue + '-' + page + '.jpg'), type: 'jpeg', quality: 86 });
  console.log('✓ ' + langue + '-' + page + '.jpg');
}
async function generer() {
  if (!POLICES) { console.error('Indiquez le dossier des polices : POLICES=…'); process.exit(1); }
  const { chromium } = require('playwright');
  const sortie = path.join(RACINE, 'assets/apercus'); fs.mkdirSync(sortie, { recursive: true });
  const fichierHtml = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'apercus-')), 'page.html'); // hors du site publié
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
    // une image après l'autre : un seul onglet sert pour toutes
    const travaux = PAGES.concat(AUTRES).flatMap(([page, fr, en]) => [['fr', fr], ['en', en]].filter(([, t]) => t).map(([langue, t]) => ({ page, langue, t })));
    for (const travail of travaux) await capturer(p, fichierHtml, sortie, travail); // NOSONAR : ordre voulu
  } finally {
    await b.close(); fs.rmSync(path.dirname(fichierHtml), { recursive: true, force: true });
  }
}
module.exports = { PAGES, AUTRES }; // liste partagée avec scripts/tests-visiteur/test-apercus.js
if (require.main === module) generer().catch(e => { console.error(e.message); process.exit(1); });
