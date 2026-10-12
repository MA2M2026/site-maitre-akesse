// La Maison MA2M (boutique) : les 6 pages reçoivent bien leur haut de page, menu, barre de la
// boutique, panier et bas de page communs (js/gabarit-boutique.js, 12/10/2026). Rien n'est
// écrit : toutes les requêtes vers la base sont bloquées.
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const PORT = String(9000 + Math.floor(Math.random() * 90));
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const attendu = { index: ['Collection', true], produit: ['Collection', true], cgv: ['', false], commande: ['', false], suivi: ['Suivi', false], gestion: ['Gestion', false] };
  for (const [pg, [actif, panier]] of Object.entries(attendu)) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 } }); await c.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    const p = await c.newPage(); const e = []; p.on('pageerror', x => e.push(x.message));
    await p.goto('http://127.0.0.1:' + PORT + '/marketplace/' + pg + '.html'); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => ({ entete: !!document.querySelector('header.site-header-v2 #menuBtn'), menu: document.querySelectorAll('#menuOverlay .nav-links a').length,
      actif: (document.querySelector('.mp-nav-liens a.actif') || {}).textContent || '', panier: !!document.getElementById('mp-panier'),
      annee: (document.getElementById('an') || {}).textContent, reste: document.querySelectorAll('[data-gabarit-boutique]').length }));
    await p.click('#menuBtn'); await p.waitForTimeout(900);
    r.menuOuvert = await p.evaluate(() => document.getElementById('menuOverlay').classList.contains('active'));
    const ok = r.entete && r.menu >= 7 && r.actif === actif && r.panier === panier && r.annee === String(new Date().getFullYear()) && !r.reste && r.menuOuvert && !e.length;
    console.log((ok ? '✓' : '❌ ÉCHEC') + ' boutique ' + pg + ' ' + JSON.stringify(r) + ' | erreurs : ' + JSON.stringify(e));
    if (!ok) process.exitCode = 1;
    await c.close();
  }
  await b.close(); srv.kill();
})().catch(e => { console.log('❌ ÉCHEC boutique', e.message); process.exitCode = 1; });
