// (22/11/2026, demande de la propriétaire : « trop long à faire défiler ») les pages en écrans (js/pages-ecrans.js),
// comme une visiteuse, sur téléphone et ordinateur, en français et en anglais : un seul écran à la fois, « Suivant » et
// « ← Retour » en bas, compteur et barre de progression, le bouton Retour du téléphone revient à l'écran d'avant, chaque
// écran tient sur un téléphone sans faire défiler, la vidéo s'arrête quand on quitte son écran, les boutons du haut mènent
// au bon écran, un lien direct vers le formulaire l'ouvre, et sans JavaScript la page reste entière.
// Base SIMULÉE : rien n'est envoyé.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PORT = String(9700 + Math.floor(Math.random() * 60));
const PAGES = [['academie.html', 390, 844], ['academie.html', 1366, 768], ['en/academie.html', 390, 844], ['en/academie.html', 1366, 768],
  // (22/11/2026, « continue pour tout ») Postuler à un casting et Cours de talons, mêmes écrans
  ['candidature.html', 390, 844], ['en/candidature.html', 1366, 768], ['cours-talons.html', 390, 844], ['en/cours-talons.html', 390, 844], ['cours-talons.html', 1366, 768],
  // (23/11/2026, retour de la propriétaire) tablette debout : chaque écran remplit la tablette
  ['academie.html', 820, 1180], ['cours-talons.html', 820, 1180]];
// écran du formulaire de chaque page (lien direct partagé, ce qui doit être visible au dernier écran)
const innerHeightDe = (h) => h;
const FORMULAIRE = { academie: ['#candidature', '#form-casting'], candidature: ['#candidature', '#candidature'], 'cours-talons': ['#inscription', '#form-talons'] };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ouvrir = async (page, w, h, opts) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, serviceWorkers: 'block' }, opts || {}));
    const p = await ctx.newPage(); p.errs = [];
    p.on('pageerror', (e) => p.errs.push(e.message));
    // (relecture du 22/11/2026) aucune règle refusée par la protection CSP de la page
    p.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) p.errs.push('CSP : ' + m.text().slice(0, 120)); });
    await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ } });
    await brancher(p, { tables: {}, rpc: {} }, []);
    return p;
  };
  const etat = (p) => p.evaluate(() => ({
    visibles: [...document.querySelectorAll('main > section.ecran')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.dataset.ecran),
    total: document.querySelectorAll('main > section.ecran').length,
    compteur: (document.querySelector('.ecrans-compteur') || {}).textContent || '',
    progression: parseFloat((document.querySelector('.ecrans-progression span') || { style: {} }).style.width) || 0,
    retour: !document.querySelector('.ecrans-retour').hidden, suivant: !document.querySelector('.ecrans-suivant').hidden,
    // (23/11/2026) « barre » = les flèches ; la petite ligne légale, elle, reste sur chaque écran
    barre: !document.querySelector('.ecrans-barre').classList.contains('ecrans-barre--legal'),
    legal: [...document.querySelectorAll('.ecrans-legal a')].filter((a) => a.getBoundingClientRect().height > 0 && a.getBoundingClientRect().bottom <= innerHeight).map((a) => a.getAttribute('href')).join(','),
    hash: location.hash, pied: getComputedStyle(document.querySelector('.site-footer') || document.body).display,
    // ce que l'écran affiché fait dépasser sous la barre du bas (0 = il tient sans faire défiler ; le bas de page, montré
    // sous le formulaire, n'est pas compté)
    depasse: (() => { const c = document.querySelector('.ecran-courant'), bar = document.querySelector('.ecrans-barre');
      return c ? Math.round(c.getBoundingClientRect().bottom + scrollY - innerHeight + (bar && !bar.hidden ? bar.offsetHeight : 0)) : 0; })(),
    debord: document.documentElement.scrollWidth - innerWidth
  }));
  for (const [page, w, h] of PAGES) {
    const en = page.startsWith('en/'), n = page + ' (' + w + 'px) : ', tel = w < 700 || (w < 1200 && h > w);   // (téléphone ou tablette debout)
    const nom = page.replace(/^en\//, '').replace('.html', ''), ia = nom === 'academie', talons = nom === 'cours-talons';
    const [ancre, form] = FORMULAIRE[nom];
    const p = await ouvrir(page, w, h);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    let e = await etat(p);
    ok(e.total >= 4 && e.visibles.length === 1 && e.visibles[0] === '1', n + 'un seul écran à la fois (' + e.total + ' écrans), le premier au départ');
    ok(e.compteur === '1 / ' + e.total && !e.retour && e.suivant && e.progression > 0, n + 'en bas : « ' + (en ? 'Start' : 'Commencer') + ' » et « 1 / ' + e.total + ' », pas de Retour au premier écran');
    // (22/11/2026, maquette validée par la propriétaire) de simples flèches rondes, mais un nom lu par les lecteurs d'écran
    const noms = await p.evaluate(() => ({ s: document.querySelector('.ecrans-suivant').getAttribute('aria-label'), r: document.querySelector('.ecrans-retour').getAttribute('aria-label'),
      fleches: [...document.querySelectorAll('.ecrans-barre .btn')].every((x) => x.querySelector('svg') && !x.textContent.trim()), rond: getComputedStyle(document.querySelector('.ecrans-suivant')).borderRadius }));
    ok(noms.fleches && parseFloat(noms.rond) >= 28, n + 'boutons en flèches rondes (sans texte)');
    ok(noms.s === (en ? 'Start' : 'Commencer') && noms.r === (en ? 'Back' : 'Retour'), n + 'les flèches ont un nom pour la lecture vocale (« ' + noms.s + ' », « ' + noms.r + ' »)');
    ok(e.pied === 'none', n + 'le bas de page long est rangé (un écran = une idée)');
    ok(e.legal === 'mentions-legales.html,politique-confidentialite.html', n + 'petite ligne « ' + (en ? 'Legal notice · Privacy' : 'Mentions légales · Confidentialité') + ' » en bas de l’écran (' + e.legal + ')');
    // (23/11/2026, décision de la propriétaire) plus de raccourcis sur le premier écran : on parcourt tous les écrans
    const raccourcis = await p.evaluate(() => document.querySelectorAll('.lx-hero a[href^="#"], .lx-hero .btn, .lx-hero .lien-marche, .lx-hero a[href*="candidature"], .lx-hero a[href*="integrer-agence"]:not(.ct-avertissement a)').length);
    ok(raccourcis === 0, n + 'premier écran sans raccourci (pas de « Je débute », « Je postule », « Je m’inscris »…) (' + raccourcis + ')');
    if (w >= 900 && w > h) {
      // ordinateur : le texte de l'accueil reste en entier dans l'écran (pas repoussé en bas comme sur téléphone)
      const acc = await p.evaluate(() => { const t = document.querySelector('.lx-hero h1').getBoundingClientRect(), b = document.querySelector('.ecrans-barre').getBoundingClientRect(); return { haut: Math.round(t.top), bas: Math.round(document.querySelector('.lx-hero .container').getBoundingClientRect().bottom), barre: Math.round(b.top) }; });
      ok(acc.haut < innerHeightDe(h) * 0.5 && acc.bas <= acc.barre, n + 'ordinateur : le texte de l’accueil tient en entier au-dessus de la barre ' + JSON.stringify(acc));
    }
    if (w >= 700 && h > w) {
      const t = await p.evaluate(() => ({ police: parseFloat(getComputedStyle(document.documentElement).fontSize), photo: Math.round(document.querySelector('.lx-hero-photo').getBoundingClientRect().height), dispo: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ecran-dispo')) }));
      ok(t.police >= 20 && t.photo >= t.dispo * 0.95, n + 'tablette : textes agrandis (' + t.police + ' px) et photo d’accueil sur tout l’écran (' + t.photo + ' / ' + t.dispo + ' px)');
    }
    // tout le parcours avec « Suivant », comme une visiteuse
    const tropHauts = [];
    let avant = e.progression, monte = true, videoArretee = null;
    for (let i = 1; i < e.total; i++) {
      if (tel) { const x = await etat(p); if (x.depasse > 40) tropHauts.push(x.visibles[0] + ' (+' + x.depasse + ' px)'); }
      // la vidéo : on la lance, puis on passe à l'écran suivant → elle doit s'arrêter
      // (23/11/2026) photos qui défilent : grandes, sur presque toute la hauteur de l'écran
      if (await p.locator('.ecran-courant .lx-tapis').count()) {
        const g = await p.evaluate(() => ({ h: document.querySelector('.ecran-courant .lx-galerie-photo').getBoundingClientRect().height, d: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ecran-dispo')) }));
        if (g.h < g.d * 0.6) tropHauts.push('photos qui défilent trop petites (' + Math.round(g.h) + ' / ' + g.d + ' px)');
      }
      if (await p.locator('.ecran-courant video').count()) {
        // écran debout : la vidéo verticale ; couché : l'horizontale
        const v = await p.evaluate(() => [...document.querySelectorAll('.ecran-courant video')].filter((x) => x.offsetParent).map((x) => x.className).join());
        if (v !== (h > w ? 'vp-verticale' : 'vp-horizontale')) tropHauts.push('vidéo ' + v + ' sur un écran ' + (h > w ? 'debout' : 'couché'));
        await p.evaluate(() => { const v = [...document.querySelectorAll('.ecran-courant video')].find((x) => x.offsetParent); if (v) { v.muted = true; v.play().catch(() => {}); } });
        await p.waitForTimeout(300);
        await p.click('.ecrans-suivant'); await p.waitForTimeout(400);
        videoArretee = await p.evaluate(() => [...document.querySelectorAll('main video')].every((v) => v.paused));
      } else { await p.click('.ecrans-suivant'); await p.waitForTimeout(400); }
      const x = await etat(p);
      if (!(x.progression > avant)) monte = false; avant = x.progression;
    }
    // (le formulaire des cours de talons, avec ses choix qui s'ajoutent, se fait défiler : il garde ses propres étapes)
    if (tel && !talons) { const x = await etat(p); if (x.depasse > 40) tropHauts.push(x.visibles[0] + ' (+' + x.depasse + ' px)'); }
    ok(monte, n + 'la barre de progression avance à chaque écran');
    if (nom !== 'candidature') ok(videoArretee === true, n + 'la vidéo s’arrête quand on passe à l’écran suivant');
    if (tel) ok(!tropHauts.length, n + 'chaque écran tient sur le téléphone sans faire défiler ' + tropHauts.join(', '));
    e = await etat(p);
    ok(e.visibles[0] === String(e.total) && e.hash === '#ecran-' + e.total && !e.suivant && e.retour && await p.isVisible(form),
      n + 'dernier écran : le formulaire, flèche ← seul en bas');
    ok(e.pied === 'none' && e.legal === 'mentions-legales.html,politique-confidentialite.html', n + 'écran du formulaire : pas de grand bas de page (même allure que les autres écrans), la petite ligne légale est là');
    if (talons) {
      // (demande de la propriétaire) les questions fréquentes sont un écran, juste avant le formulaire
      await p.click('.ecrans-retour'); await p.waitForTimeout(400);
      const faq = await p.evaluate(() => { const c = document.querySelector('.ecran-courant'); return { ok: !!(c && c.classList.contains('ct-faq')), nb: c ? c.querySelectorAll('details').length : 0 }; });
      await p.click('.ecran-courant details summary'); await p.waitForTimeout(300);
      ok(faq.ok && faq.nb >= 5 && await p.isVisible('.ecran-courant details[open] p'), n + 'questions fréquentes : un écran avant le formulaire, les réponses s’ouvrent (' + faq.nb + ')');
      await p.click('.ecrans-suivant'); await p.waitForTimeout(400);
      // le formulaire passe à son étape 2 : la barre s'efface ; retour à l'étape 1 : elle revient
      await p.click('label.ct-choix:has(input[value="groupe"])');
      await p.click('label.ct-parcours-choix:has(input[value="debut"])');
      await p.click('#ct-suivant'); await p.waitForTimeout(400);
      const etape2 = await etat(p);
      await p.click('#ct-retour'); await p.waitForTimeout(400);
      const etape1 = await etat(p);
      ok(!etape2.barre && etape1.barre && etape1.retour, n + 'formulaire à l’étape 2 : la barre du bas s’efface ; retour à l’étape 1 : la flèche ← revient');
      // découpage : une formule par écran (pleine largeur, centrée) ; la phrase de fin du programme suit le DERNIER mois
      const dec = await p.evaluate(() => {
        const formules = [...document.querySelectorAll('section.ct-formules')].map((x) => x.querySelectorAll('.ct-carte').length);
        const prog = [...document.querySelectorAll('section.lx-prog-section')];
        const dernier = prog[prog.length - 1];
        return { formules, pied: !!(dernier && dernier.querySelector('.lx-prog-pied') && dernier.querySelector('.lx-prog-mois--suite')), nbProg: prog.length,
          conteneur: [...document.querySelectorAll('section.ecran-suite')].every((x) => x.querySelector(':scope > .container')) };
      });
      ok(dec.formules.join() === '1,1' && dec.nbProg === 2 && dec.pied && dec.conteneur, n + 'une formule par écran, programme en 2 écrans, phrase de fin après le dernier mois, marges gardées ' + JSON.stringify(dec));
      if (!tel) {
        const f = await ouvrir(page, w, h);   // (page à part : l'historique de la visite en cours reste intact)
        await f.goto('http://127.0.0.1:' + PORT + '/' + page + '#formules'); await f.waitForTimeout(1500);
        const larg = await f.evaluate(() => { const c = document.querySelector('.ecran-courant .ct-carte'), b = document.querySelector('.ecran-courant .ct-cartes'); return c && b ? Math.round(c.getBoundingClientRect().width / b.getBoundingClientRect().width * 100) : 0; });
        await f.context().close();
        ok(larg >= 95, n + 'ordinateur : la formule occupe tout son écran, pas une demi-colonne vide (' + larg + ' %)');
      }
    }
    // le formulaire passe à son étape 2 : la barre des écrans s'efface (les boutons du formulaire prennent le relais)
    if (ia) {
      await p.selectOption('#ca-porte', 'academie');
      ok(await p.inputValue('#ca-experience') === 'non', n + 'le parcours Académie présélectionne le niveau débutant');
      await p.fill('#ca-nom', 'Awa Test');
      await p.fill('#ca-email', 'awa@example.org');
      await p.fill('#ca-telephone-numero', '0701020304');
      await p.selectOption('#ca-ville', 'Bouaké');
      await p.selectOption('#ca-majorite', 'majeur');
      await p.selectOption('#ca-genre', 'homme');
      await p.click('.lx-etape:not([hidden]) .lx-suivant'); await p.waitForTimeout(400);
      e = await etat(p);
      ok(!e.barre && await p.isVisible('.lx-etape:not([hidden]) .lx-retour'), n + 'formulaire à l’étape 2 : la barre du bas s’efface, le Retour du formulaire reste');
      await p.click('.lx-etape:not([hidden]) .lx-retour'); await p.waitForTimeout(400);
      e = await etat(p);
      ok(e.barre && e.retour, n + 'retour à l’étape 1 : flèche ← revient en bas');
      ok(await p.inputValue('#ca-nom') === 'Awa Test', n + 'les coordonnées sont conservées au retour');
    }
    // (relecture du 23/11/2026) la place calculée pour un écran ne dépend pas du défilement : on descend dans le formulaire,
    // puis on revient à l'écran d'avant, la hauteur disponible est la même
    {
      const dispo = () => p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ecran-dispo')));
      const avantDef = await dispo();
      await p.evaluate(() => window.scrollTo(0, 600)); await p.waitForTimeout(300);
      await p.evaluate(() => window.dispatchEvent(new Event('resize'))); await p.waitForTimeout(200);
      ok(Math.abs((await dispo()) - avantDef) <= 2, n + 'hauteur des écrans stable même après avoir fait défiler le formulaire (' + avantDef + ' px)');
      await p.evaluate(() => window.scrollTo(0, 0));
    }
    // le bouton Retour du téléphone (historique) ramène à l'écran d'avant
    await p.goBack(); await p.waitForTimeout(500);
    e = await etat(p);
    ok(e.visibles[0] === String(e.total - 1), n + 'le bouton Retour du téléphone ramène à l’écran d’avant (' + e.visibles[0] + ')');
    await p.click('.ecrans-retour'); await p.waitForTimeout(400);
    e = await etat(p);
    ok(e.visibles[0] === String(e.total - 2), n + 'flèche ← en bas ramène aussi en arrière');
    ok(e.debord <= 1 && !p.errs.length, n + 'rien ne dépasse sur le côté, aucune erreur ' + p.errs.join(' | '));
    await p.context().close();

    // (25/11/2026) le bouton « Rejoindre l'Académie » de la page Agence de représentation (#porte-equipe) ouvre
    // l'écran du formulaire, réglé sur « Me former et intégrer l'agence »
    if (ia) {
    const q = await ouvrir(page, w, h);
    await q.goto('http://127.0.0.1:' + PORT + '/' + page + '#porte-equipe'); await q.waitForTimeout(1800);
    ok(await q.isVisible('#form-casting') && await q.inputValue('#ca-porte') === 'equipe', n + 'lien #porte-equipe : l’écran du formulaire s’ouvre, réglé sur « intégrer l’agence »');
    await q.context().close();
    }

    // « Suivant, Suivant, ← Retour » puis le bouton Retour du téléphone : on revient au 1er écran (pas au 3e)
    const h2 = await ouvrir(page, w, h);
    await h2.goto('http://127.0.0.1:' + PORT + '/' + page); await h2.waitForTimeout(1500);
    await h2.click('.ecrans-suivant'); await h2.waitForTimeout(300); await h2.click('.ecrans-suivant'); await h2.waitForTimeout(300);
    await h2.click('.ecrans-retour'); await h2.waitForTimeout(500);
    const apresRetour = (await etat(h2)).visibles[0];
    await h2.goBack(); await h2.waitForTimeout(500);
    ok(apresRetour === '2' && (await etat(h2)).visibles[0] === '1', n + '« Suivant, Suivant, ← ' + (en ? 'Back' : 'Retour') + ' » puis Retour du téléphone : 1er écran (pas de retour en avant)');
    await h2.context().close();

    // une adresse abîmée (#%zz, lien mal recopié) : la page s'affiche quand même, au 1er écran
    const m = await ouvrir(page, w, h);
    await m.goto('http://127.0.0.1:' + PORT + '/' + page + '#%zz'); await m.waitForTimeout(1500);
    ok((await etat(m)).visibles[0] === '1' && !m.errs.length, n + 'adresse abîmée (#%zz) : la page s’affiche au 1er écran, sans erreur ' + m.errs.join(' | '));
    await m.context().close();

    // un lien direct vers le formulaire (#candidature, partagé sur WhatsApp) ouvre son écran
    const r = await ouvrir(page, w, h);
    await r.goto('http://127.0.0.1:' + PORT + '/' + page + ancre); await r.waitForTimeout(1500);
    ok(await r.isVisible(form) && !(await r.isVisible('.lx-hero')), n + 'lien direct ' + ancre + ' : le formulaire s’ouvre tout de suite');
    await r.context().close();
  }
  // bandeau des cookies affiché (1re visite, téléphone) : la barre du bas monte au-dessus, « Commencer » reste touchable
  const k = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const kp = await k.newPage(); await brancher(kp, { tables: {}, rpc: {} }, []);
  await kp.goto('http://127.0.0.1:' + PORT + '/academie.html'); await kp.waitForTimeout(2500);
  const libre = await kp.evaluate(() => { const bt = document.querySelector('.ecrans-suivant'), r = bt.getBoundingClientRect();
    const bandeau = document.getElementById('bandeau-cookies'); const vu = bandeau && getComputedStyle(bandeau).display !== 'none' && bandeau.getBoundingClientRect().height > 0;
    return { vu, ok: bt.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }; });
  ok(libre.vu && libre.ok, 'bandeau des cookies affiché : « Commencer » reste visible et touchable au-dessus (' + JSON.stringify(libre) + ')');
  await k.close();
  // sans JavaScript : la page entière, comme avant (rien n'est caché dans la page)
  const s = await ouvrir('academie.html', 390, 844, { javaScriptEnabled: false });
  await s.goto('http://127.0.0.1:' + PORT + '/academie.html'); await s.waitForTimeout(800);
  ok(await s.isVisible('.lx-hero') && await s.isVisible('#tarifs') && await s.isVisible('#candidature') && !(await s.locator('.ecrans-barre').count()), 'sans JavaScript : la page reste entière (accueil, parcours, formulaire)');
  await s.context().close();
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Pages en écrans : tout passe');
  process.exit(ko ? 1 : 0);
})();
