// Écran d'entrée de l'accueil (21/10/2026, validé par la propriétaire) : animation du logo,
// « Bienvenue sur notre site » écrit à la main, trois boutons en verre, bouton rond « Entrer sur le
// site » (la jauge de 5 s a été remplacée le 21/10/2026 : plus de compte à rebours).
// Visité comme une personne, sur téléphone, tablette et ordinateur, en français et en anglais :
// l'écran apparaît une seule fois par visite, rien ne dépasse de l'écran, les boutons mènent
// aux bonnes pages (le rond passe au vert à l'appui), le bouton « Entrer » et la touche Échap
// ferment l'écran, sans rien toucher il reste affiché, et les mouvements réduits l'affichent sans animation.
// Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9600 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const BASE = 'http://127.0.0.1:' + PORT + '/';
const tables = { model_profiles: [], model_photos: [], bandeau_annonce: [], instagram_posts_cache: [], mot_responsable: [], actualites: [], evenements: [], partenaires: [], admins: [] };

async function ouvrir(b, page, vp, opts = {}) {
  const ctx = opts.ctx || await b.newContext({ viewport: vp, isMobile: vp.width < 700, hasTouch: vp.width < 1000, reducedMotion: opts.calme ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && /Content Security Policy|Refused/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(() => { localStorage.setItem('ma2m_test_ecran_entree', '1'); });
  await brancher(p, { tables }, []);
  await p.goto(BASE + page, { waitUntil: 'domcontentloaded' });
  return { ctx, p, errs };
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const ecrans = [['téléphone', { width: 390, height: 844 }], ['tablette', { width: 820, height: 1180 }], ['ordinateur', { width: 1440, height: 900 }]];
  for (const [page, langue] of [['index.html', 'fr'], ['en/index.html', 'en']]) {
    const libelles = langue === 'fr' ? ['Intégrer l’agence', 'Visiter le Book', 'Participer à un casting'] : ['Join the agency', 'Visit the Book', 'Take part in a casting'];
    const liens = langue === 'fr' ? ['/integrer-agence', '/mannequins', '/candidature'] : ['/en/integrer-agence', '/en/mannequins', '/en/candidature'];
    for (const [nom, vp] of ecrans) {
      const n = page + ' ' + nom + ' : ';
      const { ctx, p, errs } = await ouvrir(b, page, vp);
      // l'écran est là dès l'arrivée, l'animation du logo d'abord
      await p.waitForSelector('.ee', { timeout: 5000 });
      await p.waitForTimeout(400);
      ok(await p.isVisible('.ee-intro'), n + 'animation du logo affichée à l’arrivée');
      ok(await p.evaluate(() => document.querySelectorAll('.ee-morceau').length) === 9, n + 'logo découpé en 9 morceaux');
      // après l'animation du logo : Bienvenue, trois boutons, bouton « Entrer »
      await p.waitForTimeout(4000);
      ok(!(await p.$('.ee-intro')), n + 'animation du logo terminée et retirée');
      const etat = await p.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        const boutons = [...document.querySelectorAll('.ee-bouton')];
        return {
          texte: document.querySelector('.ee-accueil .u-lecteur-ecran').textContent,
          police: getComputedStyle(document.querySelector('.ee-accueil')).fontFamily,
          policePrete: document.fonts.check('80px "Allison"'),
          boutons: boutons.map(a => [a.textContent.trim(), a.getAttribute('href')]),
          dehors: [...document.querySelectorAll('.ee-accueil, .ee-bouton, .ee-entree')].filter(e => { const x = e.getBoundingClientRect(); return x.left < -1 || x.right > innerWidth + 1 || x.top < -1 || x.bottom > innerHeight + 1; }).map(e => e.className),
          ligne: new Set(boutons.map(a => Math.round(a.getBoundingClientRect().top))).size,
          entree: r('.ee-marche').width > 0 && /Entrer sur le site|Enter the website/.test(document.querySelector('.ee-entree').textContent),
          defilementBloque: getComputedStyle(document.body).position === 'fixed'
        };
      });
      ok(etat.texte === (langue === 'fr' ? 'Bienvenue sur notre site' : 'Welcome to our website') && /Allison/.test(etat.police) && etat.policePrete, n + '« ' + etat.texte + ' » en écriture manuscrite (Allison)');
      ok(JSON.stringify(etat.boutons.map(x => x[0])) === JSON.stringify(libelles) && JSON.stringify(etat.boutons.map(x => x[1])) === JSON.stringify(liens), n + 'trois boutons et leurs pages : ' + etat.boutons.map(x => x.join(' → ')).join(' | '));
      ok(!etat.dehors.length, n + 'rien ne dépasse de l’écran ' + etat.dehors.join(', '));
      ok(nom === 'téléphone' ? etat.ligne === 3 : etat.ligne === 1, n + (nom === 'téléphone' ? 'boutons en colonne' : 'boutons côte à côte sur une ligne'));
      ok(etat.entree && etat.defilementBloque, n + 'bouton « Entrer sur le site » visible, la page dessous ne défile pas');
      if (nom === 'ordinateur') await p.screenshot({ path: __dirname + '/captures/ecran-entree-' + langue + '.png' });
      // appui sur un bouton : il s'enfonce, le rond passe au vert, la page s'ouvre
      const bouton = (await p.$$('.ee-bouton'))[1];
      const zone = await bouton.boundingBox();
      await p.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2); await p.mouse.down(); await p.waitForTimeout(200);
      const vert = await p.evaluate(() => { const a = document.querySelectorAll('.ee-bouton')[1]; return a.classList.contains('ee-appui') && /31, 163, 91/.test(getComputedStyle(a.querySelector('.ee-point'), '::before').backgroundColor); });
      ok(vert, n + 'à l’appui, le bouton s’enfonce et son rond devient vert');
      const [requete] = await Promise.all([p.waitForRequest(r => r.isNavigationRequest() && r.url().endsWith(liens[1]), { timeout: 3000 }).catch(() => null), p.mouse.up()]);
      ok(!!requete, n + '« ' + libelles[1] + ' » ouvre ' + liens[1]);
      ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
      await ctx.close();
    }

    // bouton « Entrer » appuyé : il s'enfonce et son symbole passe au vert, l'écran se ferme, puis
    // ne revient plus de la visite
    {
      const { ctx, p, errs } = await ouvrir(b, page, { width: 390, height: 844 });
      await p.waitForSelector('.ee'); await p.waitForTimeout(4200);
      const zone = await (await p.$('.ee-marche')).boundingBox();
      await p.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2); await p.mouse.down(); await p.waitForTimeout(200);
      ok(await p.evaluate(() => /31, 163, 91/.test(getComputedStyle(document.querySelector('.ee-marche svg')).stroke)), page + ' : à l’appui, le bouton « Entrer » s’enfonce et son symbole devient vert');
      await p.mouse.up(); await p.waitForTimeout(900);
      ok(!(await p.$('.ee')) && await p.evaluate(() => !document.documentElement.classList.contains('ee-actif') && getComputedStyle(document.body).position !== 'fixed'), page + ' : « Entrer sur le site » ferme l’écran et rend la page');
      await p.goto(BASE + page, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
      ok(!(await p.$('.ee')), page + ' : de retour sur l’accueil pendant la même visite, l’écran ne revient pas');
      ok(!errs.length, page + ' entrée : aucune erreur ' + errs.join(' | '));
      await ctx.close();
    }
    // sans rien toucher : l'écran reste (plus de compte à rebours), le visiteur a le temps de choisir
    {
      const { ctx, p } = await ouvrir(b, page, { width: 1440, height: 900 });
      await p.waitForSelector('.ee'); await p.waitForTimeout(3700 + 5000 + 3000);
      ok(!!(await p.$('.ee')) && await p.isVisible('.ee-bouton'), page + ' : sans rien toucher, l’écran reste affiché (pas de compte à rebours)');
      await ctx.close();
    }
    // clavier : Tab reste dans l'écran (3 boutons + « Entrer », puis retour au premier)
    {
      const { ctx, p } = await ouvrir(b, page, { width: 1440, height: 900 });
      await p.waitForSelector('.ee'); await p.waitForTimeout(400);
      const parcours = [];
      for (let k = 0; k < 5; k++) { await p.keyboard.press('Tab'); parcours.push(await p.evaluate(() => document.activeElement.closest('.ee') ? document.activeElement.className : 'DEHORS')); }
      ok(parcours.every(c => c !== 'DEHORS') && parcours[0] === parcours[4], page + ' : au clavier, Tab passe d’un bouton à l’autre sans sortir de l’écran (' + parcours.join(' → ') + ')');
      await ctx.close();
    }
    // touche Échap
    {
      const { ctx, p } = await ouvrir(b, page, { width: 1440, height: 900 });
      await p.waitForSelector('.ee'); await p.waitForTimeout(500);
      await p.keyboard.press('Escape'); await p.waitForTimeout(700);
      ok(!(await p.$('.ee')), page + ' : la touche Échap ferme l’écran');
      await ctx.close();
    }
    // mouvements réduits : pas d'animation, l'écran tout de suite
    {
      const { ctx, p, errs } = await ouvrir(b, page, { width: 390, height: 844 }, { calme: true });
      await p.waitForSelector('.ee'); await p.waitForTimeout(500);
      ok(!(await p.$('.ee-intro')) && (await p.$$('.ee-bouton')).length === 3 && await p.isVisible('.ee-bouton'), page + ' : mouvements réduits → pas d’animation, boutons tout de suite');
      ok(!errs.length, page + ' calme : aucune erreur ' + errs.join(' | '));
      await ctx.close();
    }
  }
  // téléphone lent : les scripts du bas de page mettent 3 s à arriver. L'animation du logo ne doit
  // pas être « sautée » pendant ce temps (vu sur le site en ligne le 21/10/2026)
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
    await p.addInitScript(() => { localStorage.setItem('ma2m_test_ecran_entree', '1'); });
    await brancher(p, { tables }, []);
    await p.route(/supabase-js-.*\.js/, r => setTimeout(() => r.continue().catch(() => {}), 3000));
    await p.goto(BASE + 'index.html', { waitUntil: 'commit', timeout: 20000 });
    await p.waitForSelector('.ee', { timeout: 10000 });   // l'écran apparaît avant la fin du chargement
    await p.waitForTimeout(900);
    const intro = await p.evaluate(() => { const i = document.querySelector('.ee-intro'); return !!i && getComputedStyle(i).opacity > 0.9; });
    ok(intro, 'téléphone lent : l’animation du logo est bien visible au début, pas sautée');
    await ctx.close();
  }
  // les navigateurs automatisés (robots) ne voient pas l'écran, sauf demande d'un test
  {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    await brancher(p, { tables }, []);
    await p.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
    ok(!(await p.$('.ee')) && !(await p.evaluate(() => document.documentElement.classList.contains('ee-actif'))), 'robot : pas d’écran d’entrée, l’accueil directement');
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
