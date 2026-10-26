// Bande « Télécharger l'application » (25/10/2026, demande de la propriétaire : les mannequins
// étaient perdues), comme une vraie personne qui ouvre le lien, sur le site (FR et EN),
// l'Administration et l'application MA2M Mannequin :
// - Android : la bande s'affiche tout de suite ; sans proposition du navigateur (lien ouvert dans
//   WhatsApp…), un appui rouvre la page dans Chrome ; rouverte dans Chrome, un appui montre le
//   menu ⋮ › « Installer l'application » ; avec la proposition, un appui ouvre « Installer » ;
// - iPhone : un appui montre le guide en images (Partager › « Sur l'écran d'accueil ») ; déjà
//   installée (ouverte depuis l'icône) : pas de bande ;
// - ordinateur : seulement si le navigateur sait installer ; ✕ : fermée pour la visite ;
// au-dessus des menus du bas, à côté du bouton WhatsApp, lisible, sans erreur ni refus de sécurité.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { tables, rpc } = require('./pages-publiques');
const { REGLE_ADMIN } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9300 + Math.floor(Math.random() * 90));
const BASE = 'http://127.0.0.1:' + PORT;
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
};
// proposition d'installation du navigateur, simulée (celle de Chrome ne vient pas dans un essai)
const proposer = (p) => p.evaluate(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => { window.__installationDemandee = true; };
  e.userChoice = Promise.resolve({ outcome: 'accepted' });
  dispatchEvent(e);
});
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  async function ouvrir(chemin, appareil, avant) {
    const tel = appareil !== 'ordinateur';
    const ctx = await b.newContext(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA[appareil], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], demandes = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (/Content Security Policy/.test(m.text())) errs.push('CSP : ' + m.text().slice(0, 160)); });
    p.on('request', (r) => { if (r.url().startsWith('intent:')) demandes.push(r.url()); });
    await brancher(p, { tables, rpc }, []);
    await p.route(/127\.0\.0\.1:\d+\/(app|admin)\/([a-z-]+\.html)?(\?.*)?$/, async (r) => { const rep = await r.fetch(); r.fulfill({ response: rep, headers: Object.assign({}, rep.headers(), { 'content-security-policy': REGLE_ADMIN }) }); });
    if (avant) await p.addInitScript(avant);
    await p.goto(BASE + chemin); await p.waitForTimeout(2200);
    // site, première visite : le choix des cookies d'abord, la bande juste après
    if (await p.isVisible('#bandeau-cookies [data-cookies="oui"]')) {
      ok(!(await p.$('#ma2m-installer')), chemin + ' : la bande attend le choix des cookies (même place)');
      await p.click('#bandeau-cookies [data-cookies="oui"]'); await p.waitForTimeout(700);  // (arrivée en glissant)
    }
    return { ctx, p, errs, demandes };
  }
  const bande = (p) => p.$('#ma2m-installer');

  for (const [chemin, nom, icone, texte, menuBas] of [
    ['/qui-sommes-nous.html', 'site', '/icons/icon-192.png', /Télécharger l’application/, null],
    ['/en/services.html', 'site anglais', '/icons/icon-192.png', /Download the app/, null],
    ['/admin/', 'Administration', '/icons/admin-192.png', /Télécharger l’application[\s\S]*Administration MA2M/, null],
    ['/app/', 'application des mannequins', '/icons/mannequin-192.png', /Télécharger l’application[\s\S]*MA2M Mannequin/, null]]) {
    // 1. Android : la bande tout de suite
    let { ctx, p, errs, demandes } = await ouvrir(chemin, 'android');
    ok(await bande(p) && texte.test(await p.textContent('#ma2m-installer')) && (await p.getAttribute('#ma2m-installer img', 'src')) === icone,
      nom + ', Android : « Télécharger l’application » s’affiche dès l’ouverture, avec la bonne icône');
    const boite = await p.$eval('#ma2m-installer', (x) => { const r = x.getBoundingClientRect(); return { haut: r.top, bas: r.bottom, gauche: r.left, droite: r.right }; });
    ok(boite.bas <= 844 && boite.gauche >= 0 && boite.droite <= 390 && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nom + ', Android : la bande tient dans l’écran ' + JSON.stringify(boite) + ' ' + (await p.evaluate(() => document.documentElement.scrollWidth)));
    const wa = await p.$('.whatsapp-flottant');
    if (wa) { const r = await wa.boundingBox(); ok(boite.bas <= r.y || boite.gauche >= r.x + r.width, nom + ' : la bande ne cache pas le bouton WhatsApp'); }
    ok(await p.$eval('.ma2m-installer-texte b', (x) => x.scrollWidth <= x.clientWidth + 1), nom + ' : « Télécharger l’application » écrit en entier');
    if (process.env.CAPTURES) await p.screenshot({ path: require('path').join(process.env.CAPTURES, 'bande-' + chemin.replace(/\W+/g, '_') + '.png') });
    const pales = (await lirePageEntiere(p)).filter((x) => /ma2m-installer/.test(x.element)).map((x) => x.texte);
    ok(!pales.length, nom + ' : bande lisible ' + pales.join(' | '));
    if (chemin === '/qui-sommes-nous.html') {
      // lien ouvert dans WhatsApp : la page est rouverte dans Chrome, d'un appui
      await p.click('.ma2m-installer-ouvrir'); await p.waitForTimeout(600);
      ok(demandes.some((u) => /^intent:\/\/127\.0\.0\.1:\d+\/qui-sommes-nous\.html\?installer=1$/.test(u)),
        nom + ', Android sans proposition : un appui rouvre la page dans Chrome ' + demandes.join(' '));
    }
    // proposition du navigateur : un appui ouvre la fenêtre « Installer »
    await proposer(p); await p.click('.ma2m-installer-ouvrir'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => window.__installationDemandee === true) && !(await bande(p)), nom + ', Android : un appui ouvre « Installer » ; installée, la bande disparaît');
    ok(!errs.length, nom + ', Android : aucune erreur ' + errs.join(' | '));
    await ctx.close();

    // 2. iPhone : guide en images
    ({ ctx, p, errs } = await ouvrir(chemin, 'iphone'));
    await p.click('.ma2m-installer-ouvrir'); await p.waitForSelector('#ma2m-guide', { timeout: 3000 }).catch(() => {});
    const guide = await p.$('#ma2m-guide') ? await p.textContent('#ma2m-guide') : '';
    ok(chemin.startsWith('/en/') ? /Share[\s\S]*Add to Home Screen[\s\S]*Add/.test(guide) : /Partager[\s\S]*Sur l’écran d’accueil[\s\S]*Ajouter/.test(guide),
      nom + ', iPhone : un appui montre le guide (Partager › « Sur l’écran d’accueil » › « Ajouter »)');
    ok(await p.$('#ma2m-guide.ma2m-guide--bas .ma2m-guide-fleche') && await p.$('#ma2m-guide svg'), nom + ', iPhone : flèche animée vers le bas de l’écran et pictogramme du bouton Partager');
    if (chemin === '/app/' && process.env.CAPTURES) await p.waitForTimeout(600), await p.screenshot({ path: require('path').join(process.env.CAPTURES, 'guide-iphone.png') });
    await p.click('.ma2m-guide-fermer');
    ok(!(await p.$('#ma2m-guide')) && await bande(p), nom + ', iPhone : le guide se ferme, la bande reste');
    // ✕ : fermée pour cette visite
    await p.click('.ma2m-installer-fermer'); await p.reload(); await p.waitForTimeout(1500);
    ok(!(await bande(p)), nom + ', iPhone : ✕ ferme la bande pour la visite');
    ok(!errs.length, nom + ', iPhone : aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }

  // Rouverte dans Chrome (« ?installer=1 ») sans proposition : flèche vers le menu ⋮
  let { ctx, p } = await ouvrir('/app/?installer=1', 'android');
  if (process.env.CAPTURES) await p.screenshot({ path: require('path').join(process.env.CAPTURES, 'bande-android.png') });
  await p.click('.ma2m-installer-ouvrir'); await p.waitForSelector('#ma2m-guide', { timeout: 3000 }).catch(() => {});
  if (process.env.CAPTURES) await p.waitForTimeout(600);
  ok(await p.$('#ma2m-guide.ma2m-guide--haut') && /⋮[\s\S]*Installer l’application/.test(await p.textContent('#ma2m-guide')), 'Android, dans Chrome sans proposition : guide « ⋮ › Installer l’application », flèche vers le menu');
  ok(!/installer=1/.test(p.url()), 'Android, rouverte dans Chrome : le repère « ?installer=1 » est retiré de l’adresse (recopiée, elle ne le garde pas)');
  if (process.env.CAPTURES) await p.screenshot({ path: require('path').join(process.env.CAPTURES, 'guide-android.png') });
  await ctx.close();

  // Android, fenêtre « Installer » refusée : on est déjà dans Chrome, le prochain appui montre le guide (pas de rechargement)
  ({ ctx, p } = await ouvrir('/qui-sommes-nous.html', 'android'));
  await p.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); dispatchEvent(e);
  });
  let demandesIntent = 0; p.on('request', (r) => { if (r.url().startsWith('intent:')) demandesIntent++; });
  await p.click('.ma2m-installer-ouvrir'); await p.waitForTimeout(300);
  await p.click('.ma2m-installer-ouvrir'); await p.waitForSelector('#ma2m-guide', { timeout: 3000 }).catch(() => {});
  ok(!demandesIntent && await p.$('#ma2m-guide.ma2m-guide--haut'), 'Android, « Installer » refusé : l’appui suivant montre le guide ⋮, sans recharger la page');
  await ctx.close();

  // iPhone avec Chrome : le bouton Partager est en haut
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: UA.iphone.replace('Version/18.0', 'CriOS/130.0.0.0') });
    const q = await c.newPage(); await brancher(q, { tables, rpc }, []);
    await q.goto(BASE + '/app/'); await q.waitForSelector('#ma2m-installer', { timeout: 6000 }).catch(() => {});
    await q.click('.ma2m-installer-ouvrir'); await q.waitForSelector('#ma2m-guide', { timeout: 3000 }).catch(() => {});
    ok(await q.$('#ma2m-guide.ma2m-guide--haut') && /en haut, dans la barre d’adresse[\s\S]*Safari/.test(await q.textContent('#ma2m-guide')), 'iPhone avec Chrome : « Partager » en haut, dans la barre d’adresse (sinon : ouvrir dans Safari)');
    await c.close();
  }

  // Ordinateur, bouton « Installer l'application » de l'Administration sans proposition : l'aide pour ordinateur
  ({ ctx, p } = await ouvrir('/admin/', 'ordinateur'));
  await p.click('[data-action=installer]'); await p.waitForSelector('#ma2m-guide', { timeout: 3000 }).catch(() => {});
  ok(/barre d’adresse/.test(await p.textContent('#ma2m-guide').catch(() => '')), 'Administration sur ordinateur : « Installer l’application » explique l’icône de la barre d’adresse');
  await ctx.close();

  // Déjà installée (ouverte depuis l'icône de l'iPhone) : pas de bande
  ({ ctx, p } = await ouvrir('/app/', 'iphone', () => Object.defineProperty(navigator, 'standalone', { get: () => true })));
  ok(!(await bande(p)), 'application déjà installée (ouverte depuis l’icône) : pas de bande');
  await ctx.close();

  // Ordinateur : rien tant que le navigateur ne sait pas installer, puis la bande
  ({ ctx, p } = await ouvrir('/admin/', 'ordinateur'));
  const avant = !!(await bande(p));
  await proposer(p);
  ok(!avant && await bande(p), 'ordinateur : la bande n’apparaît que si le navigateur sait installer');
  await ctx.close();

  // Application des mannequins connectée : au-dessus du menu du bas
  ({ ctx, p } = await ouvrir('/app/espace-mannequin.html', 'android'));
  const nav = await p.$('.ap-nav');
  if (nav) {
    const n = await nav.boundingBox(), r = await (await bande(p)).boundingBox();
    ok(r.y + r.height <= n.y + 1, 'application : la bande est au-dessus du menu du bas');
  } else ok(false, 'application : menu du bas absent de app/espace-mannequin.html');
  await ctx.close();

  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
