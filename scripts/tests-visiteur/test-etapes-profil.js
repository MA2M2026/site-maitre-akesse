// Les 6 étapes du profil d'une mannequin pas encore en ligne (07/11/2026, plainte de la propriétaire : sur certains
// téléphones les cases s'alignaient sur une ligne et « Récapitulatif » sortait de l'écran ; impossible de mettre son
// profil en ligne). Comme une vraie personne, base SIMULÉE, sur un petit téléphone ancien (320 px), un téléphone et une
// tablette ; et un navigateur ANCIEN simulé (sans grille CSS ni « gap ») :
//  - les 6 étapes sont visibles en entier, sur UNE ligne (10/11/2026), collée en haut ; rien ne dépasse sur le côté ;
//  - « Enregistrer et voir le récapitulatif (mise en ligne) » sous chaque étape : enregistre l'étape, puis mène au
//    récapitulatif (« Soumettre ») ; une étape incomplète n'est pas perdue (on y reste).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path');
const PORT = String(9840 + Math.floor(Math.random() * 30));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran, ancien] of [['petit téléphone 320 px', { width: 320, height: 640 }, false], ['téléphone', { width: 390, height: 844 }, false], ['tablette', { width: 820, height: 1180 }, false], ['vieux navigateur (sans grille ni gap), 360 px', { width: 360, height: 740 }, true]]) {
    const q = await (await b.newContext({ viewport: ecran, isMobile: ecran.width < 700, hasTouch: true })).newPage(); const errs = [], journal = [];
    q.on('pageerror', (e) => errs.push(e.message));
    await q.addInitScript((vieux) => {
      const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const exp = Math.floor(Date.now() / 1000) + 36000;
      const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
      localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'awa@test.ci' } }));
      // (vieux navigateur : la grille CSS et « gap » n'existent pas — leurs règles sont ignorées)
      if (vieux) document.addEventListener('DOMContentLoaded', () => { for (const f of document.styleSheets) { try { for (const r of f.cssRules) { if (r.style) { if (r.style.display === 'grid') r.style.removeProperty('display'); r.style.removeProperty('gap'); r.style.removeProperty('grid-template-columns'); } } } catch (e) { /* feuille illisible */ } } });
    }, ancien);
    await brancher(q, { tables: { model_profiles: [{ id: 'admin-1', full_name: 'AWA KONÉ', published: false, desactive: false }], model_photos: [] }, rpc: {} }, journal);
    await q.goto('http://127.0.0.1:' + PORT + '/app/espace-mannequin.html'); await q.waitForSelector('.stepper .step-tab', { timeout: 10000 }).catch(() => {});
    const cases = await q.$$eval('.stepper .step-tab', (l) => l.map((x) => { const r = x.getBoundingClientRect(); return { g: r.left, d: r.right, h: Math.round(r.top) }; }));
    // (11/11/2026, modèle « les cartes ») la carte ouverte se soulève de 2 px : même ligne à quelques pixels près
    const lignes = cases.length ? (Math.max(...cases.map((c) => c.h)) - Math.min(...cases.map((c) => c.h)) <= 4 ? [cases[0].h] : [...new Set(cases.map((c) => c.h))]) : [];
    ok(cases.length === 6 && cases.every((c) => c.g >= 0 && c.d <= innerWidthOf(ecran)) && lignes.length === 1, nom + ' : les 6 étapes visibles en entier, sur UNE ligne (« Récapitulatif » compris, 10/11/2026)');
    // (10/11/2026) la ligne des étapes reste en haut de l'écran quand on fait défiler
    await q.evaluate(() => scrollTo(0, 900)); await q.waitForTimeout(200);
    const haut = await q.$eval('.stepper', (x) => Math.round(x.getBoundingClientRect().top));
    ok(ancien || (haut >= -1 && haut <= 2), nom + ' : la ligne des étapes reste visible en haut quand on descend (' + haut + ' px)');
    await q.screenshot({ path: path.join(__dirname, 'captures', 'etapes-' + ecran.width + (ancien ? '-ancien' : '') + '.png') });
    await q.evaluate(() => scrollTo(0, 0));
    ok(await q.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), nom + ' : rien ne dépasse sur le côté');
    ok(await q.isVisible('#allerRecap'), nom + ' : « Enregistrer et voir le récapitulatif (mise en ligne) » sous l’étape');
    // (08/11/2026) lisible : texte et fond différents (il était blanc sur blanc)
    ok(await q.$eval('#allerRecap', (x) => { const c = getComputedStyle(x); return c.color !== c.backgroundColor && c.backgroundColor !== 'rgb(255, 255, 255)'; }), nom + ' : le bouton est lisible (texte blanc sur fond rouge)');
    // étape 1 vide : on n'y perd rien — l'étape est d'abord enregistrée ; incomplète, on y reste, les manques encadrés
    await q.click('#allerRecap'); await q.waitForTimeout(800);
    ok(/Étape 1 sur 6/.test(await q.textContent('.panel')) && !(await q.$('#submitProfile')), nom + ' : étape incomplète : rien n’est perdu, on reste sur l’étape pour la compléter');
    // étape « Photos » : le bouton mène au récapitulatif
    await q.click('.step-tab[data-goto="5"]'); await q.waitForTimeout(500);
    // (11/11/2026, captures de la propriétaire) compcard, photo du CV et photo de profil ont leurs propres pages : plus ici
    const etapePhotos = await q.textContent('.panel');
    ok(/Photos du Book/.test(etapePhotos) && !/compcard/i.test(etapePhotos.replace(/votre compcard et votre CV/g, '')) && !/Choisir la photo/.test(etapePhotos) && !(await q.$('.compcard-builder, .photo-principals-grid, [data-book-cc-toggle]')),
      nom + ' : étape « Photos » : seulement les compétences et le Book (plus de compcard, photo du CV ni photo de profil à choisir)');
    await q.click('#allerRecap'); await q.waitForTimeout(600);
    ok(/Récapitulatif/.test(await q.textContent('.panel')) && await q.$('#submitProfile') && !(await q.$('#allerRecap')), nom + ' : le bouton mène au récapitulatif, avec « Soumettre mon profil »');
    ok(!errs.length, nom + ' : aucune erreur ' + errs.join(' | '));
    await q.close();
  }
  // (11/11/2026, capture de la propriétaire) mannequin DÉJÀ EN LIGNE : « Modifier mon profil » ouvre aussi les 6 étapes
  // (plus l'ancien tableau de bord à blocs), l'état « Profil en ligne » en haut, un récapitulatif sans « Soumettre »
  {
    const q = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage(); const errs = [], journal = [];
    q.on('pageerror', (e) => errs.push(e.message));
    await q.addInitScript(() => {
      const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const exp = Math.floor(Date.now() / 1000) + 36000;
      const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
      localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'diarra@example.com' } }));
    });
    await brancher(q, { tables: { model_profiles: [{ id: 'admin-1', full_name: 'DIARRA SY', category: 'femme', published: true, premiere_publication_faite: true, height_cm: 178, weight_kg: 58, city: 'Abidjan', desactive: false }], model_photos: [] }, rpc: {} }, journal);
    await q.goto('http://127.0.0.1:' + PORT + '/app/espace-mannequin.html'); await q.waitForSelector('.stepper .step-tab', { timeout: 10000 }).catch(() => {});
    const texte = await q.textContent('#app');
    ok((await q.$$('.stepper .step-tab')).length === 6 && /Profil en ligne, visible sur le site/.test(texte) && /Bonjour DIARRA/.test(texte) && !(await q.$('.blocks-grid, .block-card')) && !/Modifiez un bloc à la fois/.test(texte),
      'déjà en ligne : « Modifier mon profil » ouvre les 6 étapes avec « Profil en ligne » en haut (plus l’ancien tableau à blocs)');
    await q.click('.step-tab[data-goto="2"]'); await q.waitForTimeout(400);
    await q.click('#save2'); await q.waitForTimeout(900);
    ok(/Étape 3 sur 6/.test(await q.textContent('.panel')), 'déjà en ligne : « Continuer » enregistre l’étape et passe à la suivante');
    await q.click('.step-tab[data-goto="6"]'); await q.waitForTimeout(400);
    const recap = await q.textContent('.panel');
    ok(/Récapitulatif/.test(recap) && !(await q.$('#submitProfile')) && !(await q.$('#f-visible')) && (await q.getAttribute('.panel a.btn.primary', 'href')) === '/app/#profil',
      'déjà en ligne : récapitulatif sans « Soumettre » ni « Rendre visible », bouton « Terminé » vers l’application');
    await q.screenshot({ path: path.join(__dirname, 'captures', 'etapes-deja-en-ligne.png') });
    ok(!errs.length, 'déjà en ligne : aucune erreur ' + errs.join(' | '));
    await q.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
function innerWidthOf(e) { return e.width; }
