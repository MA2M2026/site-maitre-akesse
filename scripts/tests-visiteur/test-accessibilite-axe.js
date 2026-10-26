// Accessibilité des pages publiques avec axe (la référence des contrôles d'accessibilité, 26/10/2026) :
// aucune faute WCAG 2.2 AA ni conseil « bonnes pratiques » (zones repères, titres…), sur téléphone,
// en français et en anglais. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const fs = require('fs');
const PORT = String(9100 + Math.floor(Math.random() * 90));
const PAGES = ['index.html', 'agenda.html', 'parcours.html', 'qui-sommes-nous.html', 'services.html', 'mannequins.html', 'actualites.html',
  'evenements.html', 'partenaires.html', 'candidature.html', 'integrer-agence.html', 'contact.html', 'mentions-legales.html', 'politique-confidentialite.html'];
let srv = null, b = null;
(async () => {
  // axe-core : celui du projet s'il est installé, sinon celui livré avec Lighthouse
  const AXE = fs.readFileSync((() => {
    try { return require.resolve('axe-core/axe.min.js'); } catch (e) { return require.resolve('lighthouse/node_modules/axe-core/axe.min.js'); }
  })(), 'utf8');
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  b = await chromium.launch();
  for (const page of PAGES.concat(PAGES.map(p => 'en/' + p))) {
    // bypassCSP : seulement pour glisser axe dans la page d'essai
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true })).newPage();
    await brancher(p, { tables: {}, rpc: {} }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1800);
    await p.addScriptTag({ content: AXE });
    const fautes = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] }))
      .violations.map(v => v.id + ' (' + v.nodes.length + ' : ' + v.nodes[0].target.join(' ').slice(0, 60) + ')'));
    console.log((fautes.length ? '❌ ÉCHEC' : '✓') + ' accessibilité ' + page + (fautes.length ? ' : ' + fautes.join(' ; ') : ''));
    if (fautes.length) process.exitCode = 1;
    await p.context().close();
  }
})().catch(e => { console.log('❌ ÉCHEC accessibilité', e.message); process.exitCode = 1; })
  .finally(async () => { if (b) await b.close().catch(() => {}); if (srv) srv.kill(); });
