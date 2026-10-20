// Accueil en magazine (« Magazine 3 », choisi par la propriétaire le 20/10/2026) : le visiteur
// feuillette la page d'accueil, en français et en anglais, sur téléphone et ordinateur.
//  - la couverture montre le mannequin à la une et mène à sa fiche ;
//  - en descendant, chaque page vient se poser sur la précédente (page collée au centre de
//    l'écran pendant que la suivante monte) ;
//  - le sommaire suit les pages visibles : numéros identiques aux folios, pages vides absentes,
//    et il se met à jour quand une page du tableau de bord arrive (mot du fondateur) ;
//  - « Les visages » montre les 6 derniers mannequins, avec un lien vers chaque fiche ;
//  - un lien du sommaire amène bien à sa page ; rien ne dépasse sur le côté ; aucune erreur.
// Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9700 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const profils = Array.from({ length: 6 }, (_, i) => ({ id: 'm' + i, full_name: 'Mannequin ' + i, city: 'Abidjan', category: i % 2 ? 'homme' : 'femme', height_cm: 170 + i, published: true, featured: i === 2 }));
const tables = (avecMot) => ({
  model_profiles: profils, model_photos: [], partenaires: [], instagram_posts_cache: [], bandeau_annonce: [],
  mot_responsable: avecMot ? [{ id: 'principal', nom: 'Maître Akesse', titre: 'Fondateur', message: 'Bienvenue dans notre agence.' }] : []
});
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const page of ['index.html', 'en/index.html']) {
    for (const ecran of [{ nom: 'téléphone', width: 390, height: 844, isMobile: true, hasTouch: true }, { nom: 'ordinateur', width: 1280, height: 900 }]) {
      const quoi = page + ' (' + ecran.nom + ')';
      const ctx = await b.newContext({ viewport: { width: ecran.width, height: ecran.height }, isMobile: !!ecran.isMobile, hasTouch: !!ecran.hasTouch });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.addInitScript(() => { try { sessionStorage.setItem('ma2m_intro_vue', '1'); localStorage.setItem('ma2m_cookies', 'non'); } catch (e) {} });
      // le mot du fondateur arrive en retard : le sommaire doit se mettre à jour
      await brancher(p, { tables: tables(true), rpc: {} }, []);
      await p.route('**/rest/v1/mot_responsable**', async r => { await new Promise(x => setTimeout(x, 1500)); r.fallback(); });
      await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(800);
      const avant = await p.evaluate(() => [...document.querySelectorAll('[data-sommaire]')].filter(li => !li.hidden).map(li => li.dataset.sommaire));
      await p.waitForTimeout(2500);

      // Couverture
      const couv = await p.evaluate(() => ({ nom: document.getElementById('vedette-nom').textContent, lien: document.getElementById('vedette-lien').getAttribute('href') }));
      ok(couv.nom === 'Mannequin 2' && couv.lien === 'mannequin.html?id=m2', quoi + ' : la couverture montre le mannequin à la une et mène à sa fiche');

      // Sommaire = pages visibles, numéros = folios
      const s = await p.evaluate(() => {
        const vis = (e) => !e.hidden && getComputedStyle(e).display !== 'none';
        const etages = [...document.querySelectorAll('#magazine .mag-page')].filter(vis);
        const lignes = [...document.querySelectorAll('[data-sommaire]')].filter(vis);
        return {
          etages: etages.map(e => e.id),
          lignes: lignes.map(li => li.dataset.sommaire),
          accord: lignes.every(li => { const e = document.getElementById(li.dataset.sommaire); const f = e && e.querySelector('[data-folio]'); return e && vis(e) && f && f.textContent === li.querySelector('b').textContent; }),
          mois: document.querySelector('[data-mois]').textContent
        };
      });
      ok(s.accord && s.lignes.length >= 4, quoi + ' : chaque ligne du sommaire porte le numéro de sa page (' + s.lignes.join(', ') + ')');
      ok(!avant.includes('mot-responsable') && s.lignes.includes('mot-responsable') && s.etages.includes('mot-responsable'), quoi + ' : le mot du fondateur, arrivé plus tard, prend sa page et sa ligne au sommaire');
      ok(!s.etages.includes('page-agenda') && !s.lignes.includes('page-agenda') && !s.etages.includes('flux-instagram'), quoi + ' : les pages vides (agenda, Instagram) restent cachées et hors du sommaire');
      ok(/20\d\d/.test(s.mois), quoi + ' : le mois du numéro est écrit (« ' + s.mois + ' »)');

      // Les visages
      const v = await p.evaluate(() => [...document.querySelectorAll('#medaillons-accueil a.medaillon-carte')].map(a => a.getAttribute('href')));
      ok(v.length === 6 && v.every(h => /^mannequin\.html\?id=m\d$/.test(h)), quoi + ' : « Les visages » montre les 6 mannequins, chacun vers sa fiche');

      // Feuilleter : la page reste posée pendant que la suivante monte, puis est recouverte
      const pile = await p.evaluate(async () => {
        const pause = () => new Promise(r => setTimeout(r, 120));
        const edito = document.getElementById('page-edito'), suivante = document.getElementById('mot-responsable');
        const T = parseFloat(getComputedStyle(edito).top);
        // on descend jusqu'à ce que l'édito arrive à sa place (il ne monte plus)
        window.scrollTo({ top: 0, behavior: 'instant' }); await pause();
        while (edito.getBoundingClientRect().top > T + 1 && window.scrollY + innerHeight < document.documentElement.scrollHeight) { window.scrollBy({ top: 40, behavior: 'instant' }); await pause(); }
        const haut1 = edito.getBoundingClientRect().top;
        window.scrollBy({ top: Math.round(innerHeight * 0.8), behavior: 'instant' }); await pause();
        const haut2 = edito.getBoundingClientRect().top, montee = suivante.getBoundingClientRect().top;
        return { immobile: Math.abs(haut1 - T) < 2 && Math.abs(haut2 - T) < 2, recouvre: montee > haut2 && montee < edito.getBoundingClientRect().bottom };
      });
      ok(pile.immobile, quoi + ' : en descendant, la page reste posée au centre de l’écran');
      ok(pile.recouvre, quoi + ' : la page suivante monte par-dessus');

      // Un lien du sommaire mène à sa page (et c'est bien elle qu'on voit, posée sur la pile)
      await p.evaluate(async () => {
        const pause = () => new Promise(r => setTimeout(r, 120));
        const som = document.getElementById('page-sommaire'), T = parseFloat(getComputedStyle(som).top);
        window.scrollTo({ top: 0, behavior: 'instant' }); await pause();
        while (som.getBoundingClientRect().top > T + 1) { window.scrollBy({ top: 40, behavior: 'instant' }); await pause(); }
      });
      // clic à l'endroit où le visiteur voit la ligne (sans défilement automatique de l'outil de test)
      const ligne = await p.evaluate(() => {
        const r = document.querySelector('[data-sommaire="page-agence"] a').getBoundingClientRect();
        const x = r.left + 20, y = r.top + r.height / 2, e = document.elementFromPoint(x, y);
        return { x, y, vue: !!(e && e.closest('[data-sommaire="page-agence"]')) };
      });
      ok(ligne.vue, quoi + ' : le sommaire est sur le dessus de la pile, la ligne « L’agence » est visible');
      await p.mouse.click(ligne.x, ligne.y); await p.waitForTimeout(800);
      ok(await p.evaluate(() => {
        const r = document.getElementById('page-agence').getBoundingClientRect();
        const dessus = document.elementFromPoint(r.left + r.width / 2, Math.min(innerHeight - 5, r.top + r.height / 2));
        return location.hash === '#page-agence' && r.top >= 0 && r.top < innerHeight / 2 && dessus && dessus.closest('.mag-page') && dessus.closest('.mag-page').id === 'page-agence';
      }), quoi + ' : la ligne « L’agence » du sommaire amène à sa page, visible sur le dessus de la pile');

      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), quoi + ' : rien ne dépasse sur le côté');
      ok(!errs.length, quoi + ' : aucune erreur ' + errs.join(' | '));
      await ctx.close();
    }
  }
  // Mot de Maître Akesse : message court sans « Lire la suite » (vérifié ci-dessus par l'absence de
  // débordement) ; message long coupé en bas de sa page, « Lire la suite » l'ouvre en entier
  for (const [page, lien] of [['index.html', 'Lire la suite'], ['en/index.html', 'Read more']]) {
    for (const long of [false, true]) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
      await p.addInitScript(() => { try { sessionStorage.setItem('ma2m_intro_vue', '1'); localStorage.setItem('ma2m_cookies', 'non'); } catch (e) {} });
      const t = tables(true); if (long) t.mot_responsable[0].message = 'Chaque grand parcours commence par un rêve. '.repeat(40);
      await brancher(p, { tables: t, rpc: {} }, []);
      await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
      const bouton = p.locator('#mot-responsable .mag-mot-suite');
      if (!long) { ok(!(await bouton.isVisible()), page + ' : message court, pas de « ' + lien + ' »'); await ctx.close(); continue; }
      const avant = await p.evaluate(() => { const m = document.getElementById('mot-responsable'); return { page: m.getBoundingClientRect().height, h: parseFloat(getComputedStyle(m).height) }; });
      ok(await bouton.isVisible() && (await bouton.textContent()).trim() === lien, page + ' : message long coupé en bas de sa page, avec « ' + lien + ' »');
      await p.evaluate(async () => { const m = document.getElementById('mot-responsable'), T = parseFloat(getComputedStyle(m).top); window.scrollTo({ top: 0, behavior: 'instant' }); for (let i = 0; i < 400 && m.getBoundingClientRect().top > T + 1; i++) window.scrollBy({ top: 30, behavior: 'instant' }); });
      await bouton.click(); await p.waitForTimeout(300);
      const apres = await p.evaluate(() => { const m = document.getElementById('mot-responsable'), t = m.querySelector('.mag-texte'); return { page: m.getBoundingClientRect().height, entier: t.scrollHeight <= t.clientHeight + 2 }; });
      ok(apres.entier && apres.page > avant.page, page + ' : « ' + lien + ' » ouvre le message en entier');
      await ctx.close();
    }
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
