// Lecture d'un article (20/10/2026, visite « comme une humaine ») : plus de grands trous (lignes
// vides tapées dans l'éditeur), police de lecture (pas le grand titre étroit du magazine), lien
// web et numéro de téléphone cliquables (rendreContenuRiche, js/app.js). Téléphone, FR et EN.
// Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { tables, rpc } = require('./pages-publiques');
const PORT = String(9000 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const TEXTE = '<p>Casting SILA à Abidjan.</p><p><br></p><p><br></p><p><br></p><p>Inscription sur https://wa.me/qr/ABC123 ou au 07 11 25 03 20.</p><p><br></p><p>Merci !</p>';
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  const donnees = { tables: Object.assign({}, tables, {
    actualites: [Object.assign({}, tables.actualites[0], { commentaire: TEXTE })],
    evenements: [Object.assign({}, tables.evenements[0], { description: TEXTE })]
  }), rpc };
  for (const [page, carte] of [['actualites.html', '#actus-une .news-une'], ['en/evenements.html', '#evenements-une .news-une']]) {
    const p = await b.newPage({ viewport: { width: 393, height: 851 } }); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, donnees, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(2000);
    await p.evaluate((s) => document.querySelector(s).click(), carte); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const t = document.getElementById('news-modal-texte');
      return { paragraphes: t.querySelectorAll('p').length, vides: [...t.querySelectorAll('p')].filter((x) => !x.textContent.trim()).length,
        liens: [...t.querySelectorAll('a')].map((a) => a.getAttribute('href')), police: getComputedStyle(t).fontFamily };
    });
    ok(r.paragraphes === 3 && r.vides === 0, page + ' : plus de lignes vides entre les paragraphes (' + r.paragraphes + ' paragraphes)');
    ok(r.liens.includes('https://wa.me/qr/ABC123') && r.liens.includes('tel:0711250320'), page + ' : lien et numéro cliquables ' + JSON.stringify(r.liens));
    ok(/Work Sans/.test(r.police), page + ' : police de lecture (' + r.police.slice(0, 40) + ')');
    ok(!errs.length, page + ' : aucune erreur ' + errs.join(' | '));
    await p.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
