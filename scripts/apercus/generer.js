// Images d'aperçu des liens partagés (WhatsApp, Facebook, Instagram…), une par page et par langue
// (demande de la propriétaire, 14/10/2026 : « l'aperçu doit montrer où l'on est »). 1200 × 630.
// Rendu par Chromium avec les polices du site (Cormorant Garamond, Jost), puis enregistré dans
// assets/apercus/. Les fiches des mannequins (/book/…) gardent leur propre aperçu avec leur
// photo (middleware.js).
//   1) polices : cd <dossier> && npm pack @fontsource/jost @fontsource/cormorant-garamond, puis
//      extraire les deux archives (tar xzf) ;
//   2) POLICES=<dossier> NODE_PATH=$(npm root -g) node scripts/apercus/generer.js
// Après un changement : modifier le numéro ?v= des og:image dans les pages (sinon WhatsApp et
// Facebook gardent l'ancienne image en mémoire).
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const RACINE = path.resolve(__dirname, '../..');
const POLICES = process.env.POLICES;
// [page, [surtitre, titre, sous-titre] FR, [idem] EN]
const PAGES = [
  ['index', ['Agence de mannequins · Abidjan', 'Maître Akesse<br>Model Management', 'Chaque grand parcours commence par un rêve.'], ['Model agency · Abidjan', 'Maître Akesse<br>Model Management', 'Every great journey begins with a dream.']],
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
function css() {
  const dossiers = fs.readdirSync(POLICES).filter(d => fs.statSync(path.join(POLICES, d)).isDirectory());
  const trouver = n => {
    const d = dossiers.find(x => x.includes(n));
    if (!d) throw new Error('Police « ' + n + ' » introuvable dans ' + POLICES + ' (voir le mode d’emploi en tête du fichier)');
    return path.join(POLICES, d, 'package/files');
  };
  return [['Jost', 'jost', [400, 500]], ['Cormorant Garamond', 'cormorant-garamond', [500, 600]]].map(([nom, cle, poids]) =>
    poids.map(p => `@font-face { font-family: '${nom}'; font-weight: ${p}; src: url('file://${trouver(cle)}/${cle}-latin-${p}-normal.woff2'); }`).join('\n')).join('\n');
}
const gabarit = (surtitre, titre, sousTitre, adresse) => `<!doctype html><html><head><meta charset="utf-8"><style>
${css()}
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; background: #0b0909; color: #f3eee8; font-family: 'Jost'; position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 70px; }
body::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 70% 60% at 50% 115%, rgba(207,59,82,0.28), transparent 70%), radial-gradient(ellipse 50% 45% at 50% -10%, rgba(255,255,255,0.06), transparent 70%); }
body::after { content: ''; position: absolute; inset: 22px; border: 1px solid rgba(243,238,232,0.12); }
.logo { position: absolute; top: 52px; width: 250px; }
.sur { font-size: 25px; letter-spacing: 0.32em; text-transform: uppercase; color: #e04a5f; font-weight: 500; margin-top: 64px; }
h1 { font-family: 'Cormorant Garamond'; font-weight: 500; font-size: ${titre.includes('<br>') ? 92 : 112}px; line-height: 0.98; margin: 18px 0 20px; letter-spacing: 0.01em; }
.trait { width: 90px; height: 4px; background: #d81f2f; margin-bottom: 20px; }
.sous { font-size: 30px; color: rgba(243,238,232,0.78); font-weight: 400; }
.adresse { position: absolute; bottom: 46px; font-size: 21px; letter-spacing: 0.08em; color: rgba(243,238,232,0.55); }
</style></head><body>
<img class="logo" src="file://${RACINE}/assets/logo-intro.png" alt="">
<div class="sur">${surtitre}</div><h1>${titre}</h1><div class="trait"></div><div class="sous">${sousTitre}</div>
<div class="adresse">${adresse}</div></body></html>`;
async function capturer(p, fichierHtml, sortie, { page, langue, t }) {
  const chemin = [langue === 'en' ? 'en' : '', page === 'index' ? '' : page].filter(Boolean).join('/');
  fs.writeFileSync(fichierHtml, gabarit(t[0], t[1], t[2], 'maitreakessemodelmanagement.com' + (chemin ? '/' + chemin : '')));
  await p.goto('file://' + fichierHtml);
  await p.evaluate(() => document.fonts.ready);
  // police introuvable : on s'arrête plutôt que de produire des images dans une autre police
  const polices = await p.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replaceAll('"', '')));
  if (!polices.includes('Jost') || !polices.includes('Cormorant Garamond')) throw new Error('Polices non chargées : ' + polices.join(', '));
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
    const travaux = PAGES.flatMap(([page, fr, en]) => [['fr', fr], ['en', en]].filter(([, t]) => t).map(([langue, t]) => ({ page, langue, t })));
    for (const travail of travaux) await capturer(p, fichierHtml, sortie, travail); // NOSONAR : ordre voulu
  } finally {
    await b.close(); fs.rmSync(path.dirname(fichierHtml), { recursive: true, force: true });
  }
}
module.exports = { PAGES }; // liste partagée avec scripts/tests-visiteur/test-apercus.js
if (require.main === module) generer().catch(e => { console.error(e.message); process.exit(1); });
