// « Intégrer l'agence » en deux départements (25/11/2026, demande de la propriétaire), comme une visiteuse, téléphone
// et ordinateur, FR et EN. Rien n'est envoyé.
// - integrer-agence.html : page d'aiguillage, deux cartes (MA2M Academy, Agence de représentation), aucun prix ;
// - representation.html : deux boutons ; « Simple représentation » ouvre son parcours et le formulaire déjà réglé
//   (Talent Network, déjà mannequin, lien vers son travail) ; « Intégrer l'agence » mène à l'Académie ;
// - academie.html : le formulaire, avec « Votre projet » (me former / me former et intégrer l'agence).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PORT = String(9930 + Math.floor(Math.random() * 30));
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ouvrir = async (page, ecran) => {
    const p = await (await b.newContext({ viewport: ecran })).newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ } });
    await brancher(p, { tables: {}, rpc: {} }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    return { p, errs };
  };
  const deborde = (p) => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  for (const [pre, ecran] of [['', { width: 390, height: 844 }], ['en/', { width: 1366, height: 900 }]]) {
    const en = !!pre, n = (page) => pre + page + ' ' + ecran.width + 'px : ';
    // ---- page d'aiguillage
    let { p, errs } = await ouvrir(pre + 'integrer-agence.html', ecran);
    const texte = await p.evaluate(() => document.querySelector('main').textContent);
    ok(!/FCFA/.test(texte) && !(await p.locator('#form-casting').count()), n('integrer-agence.html') + 'aucun prix, pas de formulaire');
    ok(await p.locator('#parcours a[href="academie.html"]').count() === 1 && await p.locator('#parcours a[href="representation.html"]').count() === 1, n('integrer-agence.html') + 'deux cartes : MA2M Academy et Agence de représentation');
    ok(texte.includes(en ? 'Joining the agency is free' : "L'entrée à l'agence est gratuite"), n('integrer-agence.html') + 'la gratuité de l’entrée est annoncée');
    const crit = await p.textContent('.ia-criteres');
    ok(crit.includes('1,75 m') && crit.includes('1,85 m') && crit.includes('14+') && crit.includes('14 – 17'), n('integrer-agence.html') + 'critères : 1,75 m, 1,85 m, 14 ans et plus, accord parental');
    ok(await deborde(p) <= 1 && !errs.length, n('integrer-agence.html') + 'aucun débordement, aucune erreur ' + errs.join(' | '));
    await p.context().close();
    // ---- Agence de représentation
    ({ p, errs } = await ouvrir(pre + 'representation.html', ecran));
    ok(!/FCFA/.test(await p.evaluate(() => document.querySelector('main').textContent)), n('representation.html') + 'aucun prix');
    ok(await p.isHidden('#simple') && await p.isHidden('#integrer') && await p.isHidden('#form-casting'), n('representation.html') + 'au départ : seulement les deux boutons');
    await p.click('.rp-bouton[data-choix="integrer"]'); await p.waitForTimeout(500);
    ok(await p.isVisible('#integrer') && await p.isHidden('#form-casting') && await p.locator('#integrer a[href="academie.html#porte-equipe"]').isVisible(),
      n('representation.html') + '« Intégrer l’agence » : passage par l’Académie expliqué, bouton « Rejoindre l’Académie », pas de formulaire');
    await p.click('.rp-bouton[data-choix="simple"]'); await p.waitForTimeout(700);
    ok(await p.isVisible('#simple') && await p.isHidden('#integrer') && await p.isVisible('#form-casting'), n('representation.html') + '« Simple représentation » : son parcours et le formulaire');
    ok(await p.inputValue('#ca-porte') === 'reseau' && await p.inputValue('#ca-experience') === 'oui' && await p.isHidden('#ca-porte') && await p.isVisible('#ca-lien-bloc'),
      n('representation.html') + 'formulaire réglé d’avance : Talent Network, déjà mannequin, lien vers son travail proposé');
    await p.fill('#ca-lien-travail', 'https://www.instagram.com/awa'); await p.click('.lx-etape:not([hidden]) .lx-suivant'); await p.waitForTimeout(400); await p.fill('#ca-message', 'Bonjour');
    ok(await p.evaluate(() => messageAvecLien()) === 'Parcours choisi : Talent Network\n\n' + (en ? 'Link to my work: ' : 'Lien vers mon travail : ') + 'https://www.instagram.com/awa\n\nBonjour',
      n('representation.html') + 'la porte puis le lien passent en tête du message lu par l’agence');
    ok(await deborde(p) <= 1 && !errs.length, n('representation.html') + 'aucun débordement, aucune erreur ' + errs.join(' | '));
    await p.context().close();
    // ---- MA2M Academy : le formulaire
    ({ p, errs } = await ouvrir(pre + 'academie.html#porte-equipe', ecran));
    await p.waitForTimeout(800);
    ok(await p.isVisible('#form-casting') && await p.inputValue('#ca-porte') === 'equipe' && await p.isVisible('#ca-experience'),
      n('academie.html#porte-equipe') + 'formulaire réglé sur « Me former et intégrer l’agence », expérience demandée');
    await p.selectOption('#ca-experience', 'oui');
    ok(await p.isVisible('#ca-lien-bloc'), n('academie.html') + 'déjà mannequin : lien vers son travail proposé');
    await p.selectOption('#ca-porte', 'academie');
    ok(await p.inputValue('#ca-experience') === 'non' && await p.isHidden('#ca-experience') && await p.isHidden('#ca-lien-bloc'),
      n('academie.html') + '« Me former » : débutant·e, sans lien');
    await p.click('.lx-etape:not([hidden]) .lx-suivant'); await p.waitForTimeout(400); await p.fill('#ca-message', 'Bonjour');
    ok(await p.evaluate(() => messageAvecLien()) === 'Parcours choisi : MA2M Academy\n\nBonjour', n('academie.html') + 'la porte passe en tête du message');
    ok(await deborde(p) <= 1 && !errs.length, n('academie.html') + 'aucun débordement, aucune erreur ' + errs.join(' | '));
    await p.context().close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ Intégrer l’agence (deux départements) : tout passe');
  process.exit(ko ? 1 : 0);
})();
