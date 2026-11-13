// Photos qui défilent (13/11/2026, demande de la propriétaire) sur Intégrer l'agence et Atelier talons (FR et EN),
// téléphone et ordinateur : la grande photo du haut et les photos de la galerie changent toutes seules, en fondu,
// sans laisser de trou ni déborder ; rien ne bouge si le visiteur demande moins d'animations (js/diaporama-luxe.js).
// Et l'accueil : en attendant la photo de couverture (rechargement), le fond est NOIR, plus rouge. Base SIMULÉE.
const { chromium, devices } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { tables, rpc } = require('./pages-publiques');
const path = require('path');
const PORT = String(9930 + Math.floor(Math.random() * 40));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
// la photo réellement visible d'une zone (la plus haute des images opaques) : son adresse
const vue = (p, zone) => p.evaluate((z) => { const i = [...document.querySelectorAll(z)].filter((x) => getComputedStyle(x).opacity === '1').pop();
  return i ? i.getAttribute('src').replace(/\?.*$/, '').replace(/^.*\//, '') : null; }, zone);
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [appareil, opts] of [['téléphone', devices['iPhone 13']], ['ordinateur', { viewport: { width: 1440, height: 900 } }]]) {
    for (const page of ['integrer-agence.html', 'en/integrer-agence.html', 'cours-talons.html', 'en/cours-talons.html']) {
      const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = [], absentes = [];
      p.on('pageerror', (e) => errs.push(e.message));
      p.on('response', (r) => { if (/\.jpg/.test(r.url()) && r.status() >= 400) absentes.push(r.url()); });
      await ctx.addInitScript(() => { try { localStorage.setItem('ma2m-cookies-choix', 'refuse'); } catch (e) {} });
      await brancher(p, { tables, rpc }, []);
      await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(800);
      const n = appareil + ' ' + page + ' : ';
      const haut1 = await vue(p, '.lx-hero-photo');
      await p.waitForTimeout(7600);
      const haut2 = await vue(p, '.lx-hero-photo');
      ok(haut1 && haut2 && haut1 !== haut2, n + 'la grande photo du haut change toute seule (' + haut1 + ' → ' + haut2 + ')');
      // pendant le fondu, jamais de trou : au moins une photo opaque à tout instant
      const trous = await p.evaluate(async () => { let t = 0; const z = document.querySelector('.lx-hero-photo').parentElement;
        for (let i = 0; i < 40; i++) { if (![...z.querySelectorAll('.lx-hero-photo')].some((x) => +getComputedStyle(x).opacity > 0.98)) t++; await new Promise((r) => setTimeout(r, 160)); } return t; });
      ok(trous === 0, n + 'pas de trou pendant les fondus (' + trous + ')');
      // la galerie : on la fait venir à l'écran, ses photos changent aussi
      await p.evaluate(() => document.querySelector('.lx-galerie').scrollIntoView());
      const avant = await p.evaluate(() => [...document.querySelectorAll('.lx-galerie-photo')].map((f) => [...f.querySelectorAll('img')].filter((i) => getComputedStyle(i).opacity === '1').pop()?.getAttribute('src')));
      await p.waitForTimeout(10500);
      const apres = await p.evaluate(() => [...document.querySelectorAll('.lx-galerie-photo')].map((f) => [...f.querySelectorAll('img')].filter((i) => getComputedStyle(i).opacity === '1').pop()?.getAttribute('src')));
      ok(avant.length === 3 && apres.every((s, i) => s && s !== avant[i]), n + 'les 3 photos de la galerie changent');
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), n + 'rien ne déborde sur le côté');
      ok(!absentes.length, n + 'toutes les photos existent ' + absentes.join(' '));
      ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
      await ctx.close();
    }
  }
  // moins d'animations demandé : rien ne bouge
  { const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage();
    await brancher(p, { tables, rpc }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/integrer-agence.html'); await p.waitForTimeout(8000);
    ok(await p.evaluate(() => document.querySelectorAll('.lx-hero-photo').length === 1), 'moins d’animations demandé : la photo reste fixe');
    await ctx.close(); }
  // l'accueil : fond d'attente noir sous la photo de couverture
  for (const page of ['index.html', 'en/index.html']) {
    const ctx = await b.newContext(devices['iPhone 13']); const p = await ctx.newPage();
    await brancher(p, { tables, rpc }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(600);
    const fonds = await p.evaluate(() => [getComputedStyle(document.querySelector('.p-couv')).backgroundColor, getComputedStyle(document.querySelector('.p-couv .mag-cadre')).backgroundColor]);
    ok(fonds.every((f) => f === 'rgb(0, 0, 0)'), page + ' : en attendant la photo de couverture, le fond est noir (' + fonds.join(', ') + ')');
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ photos qui défilent et fond noir de l’accueil : tout est bon'); process.exit(ko ? 1 : 0);
})();
