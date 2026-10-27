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
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  // nouveau Safari (iOS 26 : la version du système reste figée à 18_6 dans l'agent)
  iphone26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  instagramIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0 (iPhone14,5; iOS 17_5; fr_FR)',
  // navigateurs Android autres que Chrome : ils doivent renvoyer vers Chrome
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  opera: 'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 OPR/84.0.0.0',
  xiaomi: 'Mozilla/5.0 (Linux; U; Android 13; fr-fr; 2201117TG Build/TKQ1.221114.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.5615.136 Mobile Safari/537.36 XiaoMi/MiuiBrowser/18.4.30',
  firefox: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
  whatsapp: 'Mozilla/5.0 (Linux; Android 13; SM-A135F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36',
  facebook: 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]'
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
    ok(!(await p.$('.ma2m-guide-fleche')) && await p.$('#ma2m-guide svg'), nom + ', iPhone : plus de flèche qui pointe dans le vide, pictogramme du bouton Partager');
    ok(!(await p.isVisible('#ma2m-installer')), nom + ', iPhone : la barre rouge est cachée pendant l’aide (elle ne gêne plus la lecture)');
    ok(chemin.startsWith('/en/') ? /⋯[\s\S]*More/.test(guide) : /⋯[\s\S]*« Plus »/.test(guide), nom + ', iPhone : nouveau Safari expliqué (⋯ puis Partager, « Plus » si besoin)');
    if (chemin === '/app/' && process.env.CAPTURES) await p.waitForTimeout(600), await p.screenshot({ path: require('path').join(process.env.CAPTURES, 'guide-iphone.png') });
    await p.click('.ma2m-guide-fermer');
    ok(!(await p.$('#ma2m-guide')) && await p.isVisible('#ma2m-installer'), nom + ', iPhone : le guide se ferme, la barre rouge réapparaît');
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

  // iPhone : Chrome, Instagram… ne savent pas installer → « Ouvrir dans Safari » d'abord ;
  // nouveau Safari (iOS 26) → le guide Safari (⋯ › Partager › « Sur l'écran d'accueil »)
  for (const [ua, nom, attendu] of [
    [UA.iphone.replace('Version/18.0', 'CriOS/130.0.0.0'), 'iPhone avec Chrome', /Ouvrez d’abord Safari[\s\S]*Ouvrir dans Safari/],
    [UA.instagramIOS, 'iPhone, lien ouvert dans Instagram', /Ouvrez d’abord Safari[\s\S]*Ouvrir dans Safari/],
    [UA.iphone26, 'iPhone récent (nouveau Safari, iOS 26)', /⋯[\s\S]*Partager[\s\S]*Sur l’écran d’accueil[\s\S]*« Plus »[\s\S]*Ajouter/]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: ua });
    const q = await c.newPage(); await brancher(q, { tables, rpc }, []);
    await q.goto(BASE + '/app/'); await q.waitForSelector('#ma2m-installer', { timeout: 6000 }).catch(() => {});
    await q.click('.ma2m-installer-ouvrir'); await q.waitForSelector('#ma2m-guide', { timeout: 3000 }).catch(() => {});
    ok(attendu.test(await q.textContent('#ma2m-guide').catch(() => '')), nom + ' : la bonne marche à suivre s’affiche');
    await c.close();
  }

  // Petit iPhone (SE, 320 × 568) : l'aide tient dans l'écran, le ✕ reste visible et touchable
  {
    const c = await b.newContext({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: UA.iphone.replace('18_0', '15_8').replace('Version/18.0', 'Version/15.6') });
    const q = await c.newPage(); await brancher(q, { tables, rpc }, []);
    await q.goto(BASE + '/app/'); await q.waitForSelector('#ma2m-installer', { timeout: 6000 }).catch(() => {});
    await q.click('.ma2m-installer-ouvrir'); await q.waitForSelector('#ma2m-guide', { timeout: 3000 }).catch(() => {});
    await q.waitForTimeout(600);  // (fin de l'animation d'arrivée : la carte glisse de quelques pixels)
    const carte = await q.$eval('.ma2m-guide-carte', (x) => { const r = x.getBoundingClientRect(); return { haut: r.top, bas: r.bottom }; }).catch(() => null);
    const croix = await q.$eval('.ma2m-guide-fermer', (x) => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }).catch(() => false);
    ok(carte && carte.haut >= 0 && carte.bas <= 568 && croix, 'petit iPhone (SE) : l’aide tient dans l’écran, le ✕ reste visible ' + JSON.stringify(carte));
    await q.click('.ma2m-guide-fermer').catch(() => {});
    ok(!(await q.$('#ma2m-guide')), 'petit iPhone (SE) : le ✕ ferme l’aide');
    await c.close();
  }

  // Android, autres navigateurs que Chrome (Samsung Internet, Opera, Xiaomi, Firefox, WhatsApp,
  // Facebook) : même si le navigateur propose d'installer (Samsung), on ne s'en sert PAS (Play
  // Protect bloque l'appli qu'il fabrique) : un appui rouvre la page dans Chrome.
  for (const nom of ['samsung', 'opera', 'xiaomi', 'firefox', 'whatsapp', 'facebook']) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: UA[nom] });
    const q = await c.newPage(); const intents = [];
    q.on('request', (r) => { if (r.url().startsWith('intent:')) intents.push(r.url()); });
    await brancher(q, { tables, rpc }, []);
    await q.goto(BASE + '/app/'); await q.waitForSelector('#ma2m-installer', { timeout: 6000 }).catch(() => {});
    await proposer(q);
    await q.click('.ma2m-installer-ouvrir'); await q.waitForTimeout(600);
    // (la demande enregistrée s'arrête avant « #Intent;…package=com.android.chrome », comme plus haut)
    ok(!(await q.evaluate(() => window.__installationDemandee === true)) && intents.some((u) => /^intent:\/\/127\.0\.0\.1:\d+\/app\/\?installer=1$/.test(u)),
      'Android, ' + nom + ' : pas d’installation par ce navigateur, un appui rouvre la page dans Chrome');
    await c.close();
  }

  // Samsung Internet rouvert sans Chrome (le lien revient avec le repère) : aide « Ouvrez avec Google Chrome »
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: UA.samsung });
    const q = await c.newPage(); await brancher(q, { tables, rpc }, []);
    await q.goto(BASE + '/app/?installer=1'); await q.waitForSelector('#ma2m-installer', { timeout: 6000 }).catch(() => {});
    await q.click('.ma2m-installer-ouvrir'); await q.waitForSelector('#ma2m-guide', { timeout: 3000 }).catch(() => {});
    const t = await q.textContent('#ma2m-guide').catch(() => '');
    ok(/Google Chrome/.test(t) && await q.$('#ma2m-guide a[href*="com.android.chrome"]'), 'Android sans Chrome : l’aide propose d’ouvrir avec Google Chrome (lien pour l’installer)');
    await c.close();
  }

  // Connexion coupée : plus de « Chargement… » sans fin. Scripts bloqués → au bout de 25 s,
  // « Connexion lente ou coupée » et « Réessayer » s'affichent (par le seul CSS).
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: UA.iphone26 });
    const q = await c.newPage();
    await q.route(/\/js\//, (r) => r.abort());
    await q.goto(BASE + '/app/');
    const avant = await q.isVisible('.ap-lent');
    await q.waitForTimeout(25800);
    ok(!avant && await q.isVisible('.ap-lent') && /connexion est lente[\s\S]*Réessayer/.test(await q.textContent('.ap-lent')), 'connexion coupée : après 25 s, « La connexion est lente » + « Réessayer » au lieu de « Chargement… » sans fin');
    await c.close();
  }
  // délai maximum partagé (js/app.js) : une attente qui ne répond jamais échoue avec le code « delai »
  {
    const c = await b.newContext(); const q = await c.newPage(); await brancher(q, { tables, rpc }, []);
    await q.goto(BASE + '/qui-sommes-nous.html'); await q.waitForTimeout(800);
    ok(await q.evaluate(() => avecDelai(new Promise(() => {}), 50).then(() => 'non', (e) => e.code)) === 'delai', 'délai maximum : une attente sans réponse s’arrête (code « delai »)');
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
