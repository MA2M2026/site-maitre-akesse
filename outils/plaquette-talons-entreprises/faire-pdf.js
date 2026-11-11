// Plaquette « L'élégance au travail » : plaquette.html → PDF A4 (et aperçus JPEG des pages si un dossier est donné).
//   node faire-pdf.js <sortie.pdf> [dossier d'aperçus]
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const [sortie, apercus] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, 'plaquette.html'), { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: sortie, format: 'A4', printBackground: true, preferCSSPageSize: true });
  if (apercus) {
    await p.setViewportSize({ width: 794, height: 1123 });
    const pages = await p.$$('.page');
    for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: path.join(apercus, 'page-' + (i + 1) + '.jpg'), type: 'jpeg', quality: 85 });
  }
  await b.close();
})();
