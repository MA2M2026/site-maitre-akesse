// Actualités et événements de l'Administration (31/10/2026, demande de la propriétaire), comme l'agence,
// sur téléphone et ordinateur, base SIMULÉE (rien n'est écrit ni envoyé pour de vrai) :
//  - photos ajoutées en plusieurs fois (elles s'ajoutent, un même fichier une seule fois, « ✕ » pour en
//    retirer une, au plus 30) ;
//  - brouillon : on quitte la page (ou on la recharge) puis on revient → titre, texte et photos choisies
//    sont retrouvés ; publié → le brouillon disparaît (js/admin/brouillons.js).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const chemin = require('path'), fs = require('fs');
const PORT = String(9500 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const photo = (n) => chemin.join(__dirname, 'medias', 'photo' + n + '.jpg');
const ecrits = (journal, m, table) => journal.filter((j) => j[0] === m && j[1] === table);
const vignettes = (p) => p.$$eval('#pub-nouvelles .pub-photo-choisie', (l) => l.length);

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept());
    await brancher(p, donnees('principal'), journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    const ouvrir = async (adresse) => { await p.goto(URL_ADMIN + adresse); await p.waitForSelector('#pub-titre'); await p.waitForSelector('#pub-editeur .ql-editor', { timeout: 8000 }); await p.waitForTimeout(800); };

    // 1. Photos en plusieurs fois
    await ouvrir('#/site/evenements/nouvelle');
    await p.fill('#pub-titre', 'Défilé de la Saint-Sylvestre'); await p.fill('#pub-lieu', 'Sofitel Ivoire');
    await p.click('#pub-editeur .ql-editor'); await p.keyboard.type('Grand défilé de fin d’année.');
    await p.setInputFiles('input[data-change="photos-choisies-ajouter"]', [photo(1), photo(2)]); await p.waitForTimeout(300);
    ok(await vignettes(p) === 2, n + '2 photos choisies');
    await p.setInputFiles('input[data-change="photos-choisies-ajouter"]', [photo(3), photo(1)]); await p.waitForTimeout(300);
    ok(await vignettes(p) === 3, n + 'un 2e choix s’AJOUTE au premier (la photo déjà choisie n’entre pas deux fois)');
    await p.click('#pub-nouvelles .pub-photo-choisie:nth-child(2) [data-action="photos-choisies-retirer"]'); await p.waitForTimeout(300);
    ok(await vignettes(p) === 2 && /2 photos choisies/.test(await p.textContent('#pub-nouvelles')), n + '« ✕ » retire une photo');
    await p.waitForTimeout(900);  // le brouillon s'écrit juste après

    // 2. On quitte la page (autre rubrique), on revient : tout est là
    await p.goto(URL_ADMIN + '#/site/b2-candidatures'); await p.waitForTimeout(1200);
    await ouvrir('#/site/evenements/nouvelle'); await p.waitForTimeout(600);
    ok((await p.inputValue('#pub-titre')) === 'Défilé de la Saint-Sylvestre' && (await p.inputValue('#pub-lieu')) === 'Sofitel Ivoire', n + 'retour sur la page : titre et lieu retrouvés');
    ok(/Grand défilé de fin d’année/.test(await p.textContent('#pub-editeur .ql-editor')), n + 'retour sur la page : texte retrouvé');
    ok(await vignettes(p) === 2 && /Brouillon retrouvé/.test(await p.textContent('#pub-msg')), n + 'retour sur la page : les 2 photos choisies sont revenues, et c’est dit');
    // 3. Même après avoir rechargé (ou fermé) la page
    await p.reload(); await p.waitForSelector('.accueil-tete, #pub-titre', { timeout: 15000 }).catch(() => {});
    await ouvrir('#/site/evenements/nouvelle'); await p.waitForTimeout(600);
    ok(await vignettes(p) === 2 && (await p.inputValue('#pub-titre')) === 'Défilé de la Saint-Sylvestre', n + 'page rechargée : le brouillon est toujours là');
    // 4. Publier : les 2 photos partent, le brouillon disparaît
    await p.fill('#pub-date', '2026-12-31');
    await p.click('form[data-form="publication-enregistrer"] [type=submit]'); await p.waitForTimeout(3500);
    ok(ecrits(journal, 'POST', 'evenements').length === 1 && ecrits(journal, 'POST', 'evenement_photos').length === 2, n + 'publié avec les 2 photos');
    await ouvrir('#/site/evenements/nouvelle');
    ok((await p.inputValue('#pub-titre')) === '' && await vignettes(p) === 0 && !/Brouillon retrouvé/.test(await p.textContent('#pub-msg')), n + 'après publication : page neuve, plus de brouillon');

    // 5. Au plus 30 photos à la fois
    const image = fs.readFileSync(photo(1));
    await ouvrir('#/site/actualites/nouvelle');
    await p.setInputFiles('input[data-change="photos-choisies-ajouter"]', Array.from({ length: 32 }, (_, i) => ({ name: 'photo-' + i + '.jpg', mimeType: 'image/jpeg', buffer: image })));
    await p.waitForTimeout(800);
    ok(await vignettes(p) === 30, n + 'au plus 30 photos à la fois (' + await vignettes(p) + ')');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
