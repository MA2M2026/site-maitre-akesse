// Nouvelle Administration « vivante » (PLAN-NOUVELLE-ADMINISTRATION.md), essayée comme une vraie
// personne, sur téléphone et ordinateur, base SIMULÉE (donnees-nouvelle-admin.js) : connexion,
// accueil vivant (date, affiche du projet du jour, tâches, blocs, ruban des visages), barre du
// bas et tiroir des rubriques sur téléphone, menu à gauche sur ordinateur, blocs 2 et 3 dans la
// nouvelle décoration, rôles (un compte « site » ne voit aucun chiffre d'argent), lisibilité.
// CAPTURES=dossier : enregistre des captures d'écran.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9200 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/nouvelle/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const capture = (p, nom) => process.env.CAPTURES ? p.screenshot({ path: process.env.CAPTURES + '/' + nom + '.png', fullPage: false }) : null;

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 860 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    await brancher(p, donnees('principal'), journal); await photosLocales(p);

    // 1. Entrée
    await p.goto(URL_ADMIN); await p.waitForSelector('#cx-mail');
    await capture(p, 'connexion-' + (tel ? 'tel' : 'pc'));
    ok(await p.isVisible('form[data-form="connexion"]'), n + 'page de connexion affichée');
    await seConnecter(p, URL_ADMIN);
    await p.waitForSelector('.accueil-tete', { timeout: 10000 }); await p.waitForTimeout(2200);
    await capture(p, 'accueil-' + (tel ? 'tel' : 'pc'));

    // 2. Accueil vivant
    const acc = await p.evaluate(() => ({
      date: document.querySelector('.accueil-tete .date').innerText,
      affiche: (document.querySelector('.affiche') || {}).innerText || '',
      jauge: (document.querySelector('.affiche .jauge i') || {}).style ? document.querySelector('.affiche .jauge i').style.width : '',
      taches: [...document.querySelectorAll('.tache')].map((t) => t.innerText.replace(/\s+/g, ' ')),
      blocs: [...document.querySelectorAll('.bloc-accueil .nom')].map((x) => x.textContent),
      visages: document.querySelectorAll('.ruban .carte-vis:not([aria-hidden]) .vis img').length,
      chargees: document.querySelectorAll('.vis img.charge').length,
      deborde: document.documentElement.scrollWidth > innerWidth + 1
    }));
    ok(/[a-z]+\s*\d{1,2} [a-zéû]+/i.test(acc.date.replace(/\n/g, ' ')), n + 'la date du jour en grand (' + acc.date.replace(/\n/g, ' ') + ')');
    ok(/Aujourd’hui/i.test(acc.affiche) && /ABIDJAN BORDER FORUM/.test(acc.affiche) && /2 sur 4 confirmées/i.test(acc.affiche) && acc.jauge === '50%', n + 'affiche du projet du jour, réponses 2 sur 4 et jauge à 50 %');
    ok(acc.taches.some((t) => /Candidatures à étudier.* 3$/.test(t)) && acc.taches.some((t) => /sans réponse.* 2$/.test(t)) && acc.taches.some((t) => /J’ai payé.* 2$/.test(t)), n + 'tâches du jour avec leurs nombres (' + acc.taches.join(' | ') + ')');
    ok(acc.blocs.length === 3, n + 'les 3 blocs sur l’accueil (' + acc.blocs.join(', ') + ')');
    ok(acc.visages === 12 && acc.chargees >= 4, n + 'ruban des visages du Book (' + acc.visages + ' visages, ' + acc.chargees + ' photos affichées)');
    ok(!acc.deborde, n + 'rien ne dépasse de l’écran');
    if (tel) ok(await p.isVisible('.onglets-bas') && (await p.$$eval('.onglets-bas a', (a) => a.map((x) => x.textContent))).join() === 'Accueil,Le site,Paiements,Compta', n + 'barre du bas : Accueil, Le site, Paiements, Compta');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'accueil : tous les textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));

    // 3. Bloc 1 : une rubrique, le menu des rubriques
    if (tel) await p.click('.onglets-bas a[href^="#/site/"]'); else await p.click('.bloc-accueil[href^="#/site/"]');
    await p.waitForSelector('.coque:not(.sans-menu)'); await p.waitForTimeout(600);
    ok(/Administration du site/.test(await p.textContent('.haut .bloc-actuel')), n + 'bloc 1 ouvert, son nom dans l’en-tête');
    if (tel) {
      ok(!(await p.isVisible('#menu-lateral .nav')), n + 'menu des rubriques rangé');
      await p.click('.onglets-bas [data-action="menu-ouvrir"]'); await p.waitForTimeout(500);
      ok(await p.isVisible('#menu-lateral a.nav[href="#/site/b2-candidatures"]'), n + '« Rubriques » ouvre le tiroir des rubriques');
      await capture(p, 'tiroir-tel');
    } else ok(await p.isVisible('#menu-lateral a.nav[href="#/site/b2-candidatures"]') && await p.isVisible('#menu-lateral .bloc.actif'), n + 'menu à gauche : blocs et rubriques');
    await p.click('#menu-lateral a.nav[href="#/site/b2-candidatures"]'); await p.waitForTimeout(700);
    ok(p.url().endsWith('#/site/b2-candidatures') && !(await p.isVisible('#menu-lateral a.nav[href="#/site/b2-candidatures"]')) === tel, n + 'une rubrique choisie' + (tel ? ', le tiroir se referme' : ''));
    ok(!(await p.$('iframe')), n + 'aucun cadre vers l’ancien tableau de bord');

    // 4. Blocs 2 et 3 dans la nouvelle décoration
    await p.goto(URL_ADMIN + '#/paiements/registre'); await p.waitForTimeout(1500);
    ok(/paiements/i.test(await p.textContent('.haut .bloc-actuel')) && await p.isVisible('.contenu .tableau, .contenu .carte'), n + 'bloc 2 (paiements) affiché dans la nouvelle maison');
    await capture(p, 'paiements-' + (tel ? 'tel' : 'pc'));
    const palesP = await lirePageEntiere(p);
    ok(!palesP.length, n + 'paiements : textes lisibles ' + palesP.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    await p.goto(URL_ADMIN + '#/compta/tableau'); await p.waitForTimeout(1500);
    ok(/Comptabilité/.test(await p.textContent('.haut .bloc-actuel')), n + 'bloc 3 (comptabilité) affiché dans la nouvelle maison');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'comptabilité : rien ne dépasse');
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }

  // 5. Rôle « site » : un seul bloc, on y arrive directement ; aucun chiffre d'argent, aucun bloc Paiements ni Compta
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, donnees('site'), []); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.coque:not(.sans-menu)'); await p.waitForTimeout(1200);
    ok(/#\/site\//.test(p.url()), 'rôle « site » : arrive directement dans l’Administration du site');
    await p.click('.onglets-bas a[href="#/"]'); await p.waitForSelector('.accueil-tete'); await p.waitForTimeout(1500);
    const texte = await p.evaluate(() => document.body.innerText);
    ok(!/FCFA|\d F\b|J’ai payé|Paiements|Comptabilité/i.test(texte), 'rôle « site » : accueil sans chiffre d’argent ni bloc Paiements / Comptabilité');
    ok(!errs.length, 'rôle « site » : aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
