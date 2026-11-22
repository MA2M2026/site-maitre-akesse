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
const PAGES = [['integrer-agence.html', 390, 844], ['integrer-agence.html', 1366, 768], ['en/integrer-agence.html', 390, 844], ['en/integrer-agence.html', 1366, 768]];
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ouvrir = async (page, w, h, opts) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, serviceWorkers: 'block' }, opts || {}));
    const p = await ctx.newPage(); p.errs = [];
    p.on('pageerror', (e) => p.errs.push(e.message));
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
    barre: !document.querySelector('.ecrans-barre').hidden,
    hash: location.hash, pied: getComputedStyle(document.querySelector('.site-footer') || document.body).display,
    // ce que l'écran affiché fait dépasser sous la barre du bas (0 = il tient sans faire défiler ; le bas de page, montré
    // sous le formulaire, n'est pas compté)
    depasse: (() => { const c = document.querySelector('.ecran-courant'), bar = document.querySelector('.ecrans-barre');
      return c ? Math.round(c.getBoundingClientRect().bottom + scrollY - innerHeight + (bar && !bar.hidden ? bar.offsetHeight : 0)) : 0; })(),
    debord: document.documentElement.scrollWidth - innerWidth
  }));
  for (const [page, w, h] of PAGES) {
    const en = page.startsWith('en/'), n = page + ' (' + w + 'px) : ', tel = w < 700;
    const p = await ouvrir(page, w, h);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    let e = await etat(p);
    ok(e.total >= 8 && e.visibles.length === 1 && e.visibles[0] === '1', n + 'un seul écran à la fois (' + e.total + ' écrans), le premier au départ');
    ok(e.compteur === '1 / ' + e.total && !e.retour && e.suivant && e.progression > 0, n + 'en bas : « ' + (en ? 'Start' : 'Commencer') + ' » et « 1 / ' + e.total + ' », pas de Retour au premier écran');
    // (22/11/2026, maquette validée par la propriétaire) de simples flèches rondes, mais un nom lu par les lecteurs d'écran
    const noms = await p.evaluate(() => ({ s: document.querySelector('.ecrans-suivant').getAttribute('aria-label'), r: document.querySelector('.ecrans-retour').getAttribute('aria-label'),
      fleches: [...document.querySelectorAll('.ecrans-barre .btn')].every((x) => x.querySelector('svg') && !x.textContent.trim()), rond: getComputedStyle(document.querySelector('.ecrans-suivant')).borderRadius }));
    ok(noms.fleches && parseFloat(noms.rond) >= 28, n + 'boutons en flèches rondes (sans texte)');
    ok(noms.s === (en ? 'Start' : 'Commencer') && noms.r === (en ? 'Back' : 'Retour'), n + 'les flèches ont un nom pour la lecture vocale (« ' + noms.s + ' », « ' + noms.r + ' »)');
    ok(e.pied === 'none', n + 'le bas de page long est rangé (un écran = une idée)');
    // tout le parcours avec « Suivant », comme une visiteuse
    const tropHauts = [];
    let avant = e.progression, monte = true, videoArretee = null;
    for (let i = 1; i < e.total; i++) {
      if (tel) { const x = await etat(p); if (x.depasse > 40) tropHauts.push(x.visibles[0] + ' (+' + x.depasse + ' px)'); }
      // la vidéo : on la lance, puis on passe à l'écran suivant → elle doit s'arrêter
      if (await p.locator('.ecran-courant video').count()) {
        await p.evaluate(() => { const v = [...document.querySelectorAll('.ecran-courant video')].find((x) => x.offsetParent); if (v) { v.muted = true; v.play().catch(() => {}); } });
        await p.waitForTimeout(300);
        await p.click('.ecrans-suivant'); await p.waitForTimeout(400);
        videoArretee = await p.evaluate(() => [...document.querySelectorAll('main video')].every((v) => v.paused));
      } else { await p.click('.ecrans-suivant'); await p.waitForTimeout(400); }
      const x = await etat(p);
      if (!(x.progression > avant)) monte = false; avant = x.progression;
    }
    if (tel) { const x = await etat(p); if (x.depasse > 40) tropHauts.push(x.visibles[0] + ' (+' + x.depasse + ' px)'); }
    ok(monte, n + 'la barre de progression avance à chaque écran');
    ok(videoArretee === true, n + 'la vidéo s’arrête quand on passe à l’écran suivant');
    if (tel) ok(!tropHauts.length, n + 'chaque écran tient sur le téléphone sans faire défiler ' + tropHauts.join(', '));
    e = await etat(p);
    ok(e.visibles[0] === String(e.total) && e.hash === '#ecran-' + e.total && !e.suivant && e.retour && await p.isVisible('#form-casting'),
      n + 'dernier écran : le formulaire, flèche ← seul en bas');
    ok(e.pied !== 'none', n + 'écran du formulaire : le bas de page (mentions légales, confidentialité) est là');
    // le formulaire passe à son étape 2 : la barre des écrans s'efface (les boutons du formulaire prennent le relais)
    await p.selectOption('#ca-experience', 'non'); await p.click('.lx-etape:not([hidden]) .lx-suivant'); await p.waitForTimeout(400);
    e = await etat(p);
    ok(!e.barre && await p.isVisible('.lx-etape:not([hidden]) .lx-retour'), n + 'formulaire à l’étape 2 : la barre du bas s’efface, le Retour du formulaire reste');
    await p.click('.lx-etape:not([hidden]) .lx-retour'); await p.waitForTimeout(400);
    e = await etat(p);
    ok(e.barre && e.retour, n + 'retour à l’étape 1 : flèche ← revient en bas');
    // le bouton Retour du téléphone (historique) ramène à l'écran d'avant
    await p.goBack(); await p.waitForTimeout(500);
    e = await etat(p);
    ok(e.visibles[0] === String(e.total - 1), n + 'le bouton Retour du téléphone ramène à l’écran d’avant (' + e.visibles[0] + ')');
    await p.click('.ecrans-retour'); await p.waitForTimeout(400);
    e = await etat(p);
    ok(e.visibles[0] === String(e.total - 2), n + 'flèche ← en bas ramène aussi en arrière');
    ok(e.debord <= 1 && !p.errs.length, n + 'rien ne dépasse sur le côté, aucune erreur ' + p.errs.join(' | '));
    await p.context().close();

    // un bouton du haut (« Je débute ») mène à l'écran des parcours, carte cochée
    const q = await ouvrir(page, w, h);
    await q.goto('http://127.0.0.1:' + PORT + '/' + page); await q.waitForTimeout(1500);
    await q.click('.ecran-courant .lx-hero-boutons a[data-parcours-choix="non"]'); await q.waitForTimeout(600);
    ok(await q.isVisible('#parcours') && await q.isVisible('.ia-parcours-carte[data-parcours="non"]'), n + '« ' + (en ? 'I\'m a beginner' : 'Je débute') + ' » en haut mène à l’écran des parcours');
    // « Je choisis ce parcours » mène au formulaire
    await q.click('.ia-parcours-carte[data-parcours="oui"] button'); await q.waitForTimeout(700);
    ok(await q.isVisible('#form-casting') && await q.inputValue('#ca-experience') === 'oui', n + 'le bouton de la carte (« ' + (en ? 'Choose' : 'Je choisis') + ' … ») ouvre l’écran du formulaire, réglé');
    await q.context().close();

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
    await r.goto('http://127.0.0.1:' + PORT + '/' + page + '#candidature'); await r.waitForTimeout(1500);
    ok(await r.isVisible('#form-casting') && !(await r.isVisible('.lx-hero')), n + 'lien direct #candidature : le formulaire s’ouvre tout de suite');
    await r.context().close();
  }
  // bandeau des cookies affiché (1re visite, téléphone) : la barre du bas monte au-dessus, « Commencer » reste touchable
  const k = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const kp = await k.newPage(); await brancher(kp, { tables: {}, rpc: {} }, []);
  await kp.goto('http://127.0.0.1:' + PORT + '/integrer-agence.html'); await kp.waitForTimeout(2500);
  const libre = await kp.evaluate(() => { const bt = document.querySelector('.ecrans-suivant'), r = bt.getBoundingClientRect();
    const bandeau = document.getElementById('bandeau-cookies'); const vu = bandeau && getComputedStyle(bandeau).display !== 'none' && bandeau.getBoundingClientRect().height > 0;
    return { vu, ok: bt.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }; });
  ok(libre.vu && libre.ok, 'bandeau des cookies affiché : « Commencer » reste visible et touchable au-dessus (' + JSON.stringify(libre) + ')');
  await k.close();
  // sans JavaScript : la page entière, comme avant (rien n'est caché dans la page)
  const s = await ouvrir('integrer-agence.html', 390, 844, { javaScriptEnabled: false });
  await s.goto('http://127.0.0.1:' + PORT + '/integrer-agence.html'); await s.waitForTimeout(800);
  ok(await s.isVisible('.lx-hero') && await s.isVisible('#parcours') && await s.isVisible('#candidature') && !(await s.locator('.ecrans-barre').count()), 'sans JavaScript : la page reste entière (accueil, parcours, formulaire)');
  await s.context().close();
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Pages en écrans : tout passe');
  process.exit(ko ? 1 : 0);
})();
