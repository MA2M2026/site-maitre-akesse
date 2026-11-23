// Bloc « Votre défilé, nos visages » de l'accueil (audit L-15, maquette validée par la propriétaire le 16/11/2026),
// FR et EN, téléphone et ordinateur, base simulée : présent avant le pied de page, au sommaire, couleurs de la charte
// seulement (gardien des couleurs), textes lisibles, aucun débordement, boutons vers The Book et le contact, photo
// avec ses dimensions (pas de saut de mise en page), aucune erreur. CAPTURES=dossier : captures d'écran.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { fondsInterdits } = require('./couleurs-autorisees');
const { verifierLisibilite } = require('./lisibilite');
const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PORT = String(9700 + Math.floor(Math.random() * 60));

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [page, titre, bouton, lien] of [['index.html', /Votre défilé,\s*nos visages\./, 'Composer ma sélection', 'Demander un devis'], ['en/index.html', /Your show,\s*our faces\./, 'Build my selection', 'Request a quote']]) {
    for (const ecran of [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 1366, height: 900 }]) {
      const tel = ecran.width < 700, n = page + ' ' + ecran.width + 'px : ';
      const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ } });
      await brancher(p, { tables: {}, rpc: {} }, []);
      await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1200);
      const bloc = await p.$('#marques');
      ok(!!bloc, n + 'le bloc est sur l’accueil');
      if (!bloc) { await ctx.close(); continue; }
      await bloc.scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
      const info = await p.evaluate(() => {
        const m = document.getElementById('marques'), main = m.parentElement, pied = document.querySelector('.site-footer');
        const img = m.querySelector('img'), carte = m.querySelector('.marques-carte').getBoundingClientRect();
        const liens = [...m.querySelectorAll('a')].map((a) => [a.textContent.trim(), a.getAttribute('href')]);
        const sommaire = [...document.querySelectorAll('#sommaire-liste a')].map((a) => a.getAttribute('href'));
        const sortent = [...m.querySelectorAll('*')].filter((e) => { const q = e.getBoundingClientRect(); return q.width && (q.right > innerWidth + 1 || q.left < -1); }).length;
        return { titre: m.querySelector('h2').textContent, liens, sommaire, sortent, deborde: document.documentElement.scrollWidth - innerWidth,
          dernier: [...main.querySelectorAll('.mag-page')].pop() === m && !!pied && !!(m.compareDocumentPosition(pied) & Node.DOCUMENT_POSITION_FOLLOWING), imgDims: img.getAttribute('width') && img.getAttribute('height'),
          carteVisible: carte.width > 250 && carte.height > 300, police: getComputedStyle(m.querySelector('h2')).fontFamily };
      });
      ok(titre.test(info.titre.replace(/\s+/g, ' ')), n + 'titre « ' + info.titre.replace(/\s+/g, ' ').trim() + ' »');
      ok(info.dernier, n + 'placé juste avant le pied de page');
      ok(info.sommaire.includes('#marques'), n + 'présent dans le sommaire');
      ok(info.liens.some(([t, h]) => t.includes(bouton) && h === 'mannequins.html') && info.liens.some(([t, h]) => t.includes(lien) && h === 'contact.html'), n + 'boutons vers The Book et le contact');
      ok(!!info.imgDims, n + 'photo avec ses dimensions (pas de saut au chargement)');
      ok(info.carteVisible, n + 'la carte blanche est bien visible');
      ok(/Big Shoulders/.test(info.police), n + 'titre dans la police des titres du site (Big Shoulders Display, 23/11/2026)');
      ok(info.deborde <= 1 && !info.sortent, n + 'aucun débordement (' + info.deborde + ' px, ' + info.sortent + ' élément(s))');
      const fonds = await p.evaluate(`(${fondsInterdits.toString()})()`);
      const dansBloc = (fonds || []).filter((f) => /marques/.test(JSON.stringify(f)));
      ok(!dansBloc.length, n + 'couleurs de la charte seulement ' + JSON.stringify(dansBloc).slice(0, 200));
      const lisib = await p.evaluate(verifierLisibilite).catch(() => []);
      const fautes = (lisib || []).filter((x) => /marques|défilé|show|Booking|nos visages|our faces/i.test(JSON.stringify(x)));
      ok(!fautes.length, n + 'textes lisibles (contraste) ' + JSON.stringify(fautes).slice(0, 200));
      if (process.env.CAPTURES) await bloc.screenshot({ path: process.env.CAPTURES + '/marques-' + page.replace(/\W+/g, '-') + ecran.width + '.png' });
      ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
      await ctx.close();
    }
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Bloc « Votre défilé, nos visages » : tout passe');
  process.exit(ko ? 1 : 0);
})();
