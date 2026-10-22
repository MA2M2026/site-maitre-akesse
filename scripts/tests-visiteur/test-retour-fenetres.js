// Bouton « retour » du téléphone (20/10/2026, visite « comme une humaine » sur Android) : il
// referme la fenêtre ouverte (article, album, photo en grand, fiche d'un partenaire) au lieu de
// faire quitter la page ; fermée par sa croix, la fenêtre ne laisse pas d'étape en trop dans
// l'historique (js/verrou-defilement.js : fenetreOuverte / fenetreFermee). Téléphone Android,
// français et anglais. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { tables, rpc } = require('./pages-publiques');
const PORT = String(9200 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const IMAGE = Buffer.from('R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=', 'base64');
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  // page, carte à toucher, fenêtre qui s'ouvre, croix qui la ferme
  const cas = [
    ['actualites.html', '#actus-une .news-une', '#news-modal', '#news-modal-fermer', 'article'],
    ['en/evenements.html', '#evenements-une .news-une', '#news-modal', '#news-modal-fermer', 'album'],
    ['partenaires.html', '[data-index="0"]', '#part-modal', '#part-modal-fermer', 'fiche partenaire'],
    ['mannequin.html?id=a1', null, '#lightbox-global', null, 'photo en grand']
  ];
  for (const [page, carte, fenetre, croix, nom] of cas) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables, rpc }, []);
    await p.route(/^https:\/\/x\//, (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: IMAGE }));
    // une page visitée avant : « retour » ne doit pas y ramener tant qu'une fenêtre est ouverte
    await p.goto('http://127.0.0.1:' + PORT + '/contact.html'); await p.waitForTimeout(500);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(2500);
    const ouvrir = async () => {
      if (carte) await p.evaluate((s) => document.querySelector(s).click(), carte);
      else await p.evaluate(() => window.ouvrirGalerieLightbox(['https://x/1.jpg', 'https://x/2.jpg'], 0));
      await p.waitForTimeout(1200);
    };
    const ouverte = () => p.evaluate((s) => document.querySelector(s).classList.contains('active'), fenetre);
    const ici = () => p.evaluate(() => location.pathname);
    await ouvrir();
    const avant = await ouverte(), adresse = await ici();  // (la fiche d'un mannequin prend l'adresse /book/nom)
    await p.evaluate(() => history.back()); await p.waitForTimeout(1200);
    ok(avant && !(await ouverte()) && (await ici()) === adresse, page + ' : « retour » ferme le ' + nom + ' et reste sur la page');
    // fermée par la croix (ou Échap pour la photo) : aucune étape en trop, « retour » quitte la page
    await ouvrir();
    if (croix) await p.evaluate((s) => document.querySelector(s).click(), croix);
    else await p.keyboard.press('Escape');
    await p.waitForTimeout(1000);
    ok(!(await ouverte()), page + ' : la croix ferme le ' + nom);
    await p.evaluate(() => history.back()); await p.waitForTimeout(2000);
    ok((await ici()).includes('contact'), page + ' : après la croix, « retour » ramène à la page précédente (pas d\'étape en trop)');
    ok(!errs.length, page + ' : aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
