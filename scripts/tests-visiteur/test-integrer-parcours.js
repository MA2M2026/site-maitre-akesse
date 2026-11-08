// Page « Intégrer l'agence » réorganisée (08/11/2026), comme une visiteuse, téléphone et ordinateur, FR et EN.
// Rien n'est envoyé (aucun formulaire validé) : vidéo présente, critères, deux parcours à toucher qui règlent la liste
// « Avez-vous déjà été mannequin ? » du formulaire, lien facultatif vers son travail seulement pour « déjà mannequin »
// et repris en tête du message, aucun prix affiché, aucun débordement, aucune erreur.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PORT = String(9930 + Math.floor(Math.random() * 30));
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [page, ecran] of [['integrer-agence.html', { width: 390, height: 844 }], ['en/integrer-agence.html', { width: 1366, height: 900 }]]) {
    const en = page.startsWith('en/'), n = page + ' ' + ecran.width + 'px : ';
    const p = await (await b.newContext({ viewport: ecran })).newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ } });
    await brancher(p, { tables: {}, rpc: {} }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    ok(await p.locator('.video-pleine video source[src*="assets/integrer-agence/integrer-agence.mp4"]').count() === 1, n + 'vidéo de présentation en haut de la page');
    const crit = await p.textContent('.ia-criteres');
    ok(crit.includes('1,75 m') && crit.includes('1,85 m') && crit.includes('14+') && crit.includes('14 – 17'), n + 'critères : 1,75 m, 1,85 m, 14 ans et plus, accord parental');
    ok(!/FCFA|25 000/.test(await p.textContent('main')), n + 'aucun prix sur la page (décision de la propriétaire)');
    // carte « Je débute »
    await p.click('.ia-parcours-carte[data-parcours="non"] h3');
    ok(await p.inputValue('#ca-experience') === 'non' && await p.isHidden('#ca-lien-bloc') && await p.getAttribute('.ia-parcours-carte[data-parcours="non"]', 'class').then((c) => c.includes('choisie')),
      n + '« Je débute » touché : formulaire réglé sur débutant·e, carte cochée, pas de lien demandé');
    // carte « Déjà mannequin » via son bouton : amène au formulaire
    await p.click('.ia-parcours-carte[data-parcours="oui"] button'); await p.waitForTimeout(900);
    ok(await p.inputValue('#ca-experience') === 'oui' && await p.isVisible('#ca-lien-bloc'), n + '« Déjà mannequin » choisi : formulaire réglé, champ « lien vers votre travail » proposé');
    ok(await p.evaluate(() => { const r = document.getElementById('form-casting').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), n + 'le bouton amène au formulaire');
    await p.fill('#ca-lien-travail', 'https://www.instagram.com/awa'); await p.fill('#ca-message', 'Bonjour');
    const msg = await p.evaluate(() => messageAvecLien());
    ok(msg === (en ? 'Link to my work: ' : 'Lien vers mon travail : ') + 'https://www.instagram.com/awa\n\nBonjour', n + 'le lien passe en tête du message lu par l’agence');
    // choisir dans la liste du formulaire garde les cartes à jour
    await p.selectOption('#ca-experience', 'non');
    ok(await p.getAttribute('.ia-parcours-carte[data-parcours="non"]', 'class').then((c) => c.includes('choisie')) && await p.isHidden('#ca-lien-bloc') && await p.evaluate(() => messageAvecLien()) === 'Bonjour',
      n + 'retour à « débutant·e » dans le formulaire : carte mise à jour, lien ignoré');
    const deb = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(deb <= 1, n + 'aucun débordement horizontal (' + deb + ' px)');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await p.context().close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ Intégrer l’agence (parcours) : tout passe');
  process.exit(ko ? 1 : 0);
})();
