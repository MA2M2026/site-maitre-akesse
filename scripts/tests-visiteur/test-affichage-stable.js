// Affichage qui saute (journal du 14/10/2026, sur téléphone) : le visiteur descend dans The Book
// ou l'accueil, ouvre une autre page puis revient en arrière. Le navigateur le replace plus bas
// avant l'arrivée de la liste des mannequins : avant la correction, la liste arrivait ensuite et
// poussait tout le bas de page (score jusqu'à 1,8). Place réservée (js/gabarit.js) pour The Book,
// cartes d'attente pour l'accueil (stable dès la 1re visite : hauteur retenue effacée ici), et
// cartes à leur vraie hauteur (plus de content-visibility) : le score doit rester sous 0,25.
// Base simulée, réponses retardées de 1,2 s comme sur une connexion moyenne.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9600 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const profils = Array.from({ length: 30 }, (_, i) => ({ id: '00000000-0000-0000-0000-0000000000' + String(i).padStart(2, '0'), full_name: 'Mannequin ' + i, city: 'Abidjan', category: i % 2 ? 'homme' : 'femme', height_cm: 170 + i % 10, published: true }));
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [page, part] of [['mannequins.html', 1], ['en/mannequins.html', 0.5], ['index.html', 0.6], ['en/index.html', 1]]) {
    const ctx = await b.newContext({ viewport: { width: 360, height: 716 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => {
      window.__score = 0;
      new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__score += e.value; })).observe({ type: 'layout-shift', buffered: true });
    });
    // l'accueil demande 6 mannequins (le faux serveur ignore « limit »)
    await brancher(p, { tables: { model_profiles: page.includes('index') ? profils.slice(0, 6) : profils }, rpc: {} }, []);
    await p.route('**/rest/v1/model_profiles**', async r => { await new Promise(x => setTimeout(x, 1200)); r.fallback(); });
    await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
    const entrer = await p.$('#entrer-btn'); if (entrer && await entrer.isVisible()) await entrer.click();
    await p.waitForTimeout(3000);
    const garde = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ma2m_hauteur_')).length);
    const accueil = page.includes('index');
    await p.evaluate(f => window.scrollTo({ top: document.documentElement.scrollHeight * f, behavior: 'instant' }), part); await p.waitForTimeout(600);
    // contenu vu au milieu de l'écran (le navigateur peut ajuster la position pour le garder)
    const vu = () => p.evaluate(() => { const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2); const z = e && e.closest('.medaillon-carte, section, article, footer'); return z ? (z.innerText || '').replace(/\s+/g, ' ').slice(0, 50) : ''; });
    const avant = await vu();
    await p.evaluate(() => { location.href = location.pathname.replace(/[^/]*$/, '') + 'contact.html'; }); await p.waitForTimeout(1500);
    if (accueil) await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ma2m_hauteur_')).forEach(k => localStorage.removeItem(k)));
    await p.goBack({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3500);
    const apres = await vu();
    const r = await p.evaluate(() => ({ score: window.__score, reste: [...document.querySelectorAll('#grille')].map(e => e.style.minHeight).join('') }));
    if (!accueil) ok(garde >= 1, page + ' : hauteur de la liste retenue pour la prochaine visite');
    else ok(await p.evaluate(() => document.querySelectorAll('#medaillons-accueil .medaillon-attente').length === 0 && document.querySelectorAll('#medaillons-accueil a.medaillon-carte').length === 6), page + ' : cartes d’attente remplacées par les 6 mannequins');
    ok(avant && avant === apres, page + ' : au retour, le visiteur revoit le même endroit (« ' + avant + ' »)');
    ok(r.score < 0.25, page + ' : au retour en arrière, la page ne saute pas (score ' + r.score.toFixed(2) + ', gênant dès 0,25)');
    ok(r.reste === '', page + ' : place réservée libérée une fois la liste affichée');
    ok(!errs.length, page + ' : aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
