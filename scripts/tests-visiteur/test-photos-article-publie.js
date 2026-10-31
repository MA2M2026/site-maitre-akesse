// Chantier 9 (31/10/2026, demande de la propriétaire) : modifier les photos d'un article DÉJÀ publié,
// comme l'agence, sur téléphone et ordinateur, base SIMULÉE (rien n'est écrit ni effacé pour de vrai) :
//  - sous chaque photo en ligne : ◀ ▶ (ordre), ★ (couverture), ✕ (retirer), « Remplacer », « Annuler » ;
//  - rien n'est écrit avant « Enregistrer » ; quitter la page puis revenir garde ces choix (brouillon) ;
//  - garder au moins une photo (ou un lien vidéo) ;
//  - à l'enregistrement : la base d'abord (ligne retirée, ordre, couverture), PUIS le fichier retiré est
//    effacé du stockage ; une photo ajoutée en même temps part aussi.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const chemin = require('path');
const PORT = String(9600 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const photo = (n) => chemin.join(__dirname, 'medias', 'photo' + n + '.jpg');
const ecritures = (journal, table) => journal.filter((j) => j[1] === table && ['POST', 'PATCH', 'DELETE'].includes(j[0]));
// ordre affiché : m4 = photo ap1 (couverture au départ), m5 = photo ap2
const ordre = (p) => p.$$eval('#pub-en-ligne .pub-photo-en-ligne img', (l) => l.map((i) => (/\/(m\d+)\//.exec(i.src) || [])[1]).join(','));
const couverture = (p) => p.$$eval('#pub-en-ligne .pub-photo-en-ligne', (l) => l.findIndex((x) => x.querySelector('.pub-badge-couverture')));
const bouton = (p, i, action) => p.click('#pub-en-ligne .pub-photo-en-ligne:nth-child(' + i + ') [data-action="publication-photo-' + action + '"]');  // (avant, apres, couverture, enlever, remplacer)

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
    const ouvrir = async () => { await p.goto(URL_ADMIN + '#/site/actualites/a1'); await p.waitForSelector('#pub-en-ligne .pub-photo-en-ligne'); await p.waitForSelector('#pub-editeur .ql-editor', { timeout: 8000 }); await p.waitForTimeout(800); };

    await ouvrir();
    ok(await ordre(p) === 'm4,m5' && await couverture(p) === 0, n + 'les 2 photos en ligne, dans l’ordre du site, la couverture marquée');
    const larg = await p.$eval('#pub-en-ligne .pub-photo-boutons', (e) => [...e.querySelectorAll('button')].map((x) => x.getBoundingClientRect()).every((r) => r.width >= 30 && r.height >= 30));
    ok(larg, n + 'les 4 boutons sont assez grands pour le doigt');
    // (le nettoyage des émojis en tête des boutons effaçait ◀ ▶ ★ : boutons vides — vu sur la capture)
    ok(await p.$$eval('#pub-en-ligne .pub-photo-boutons button', (l) => l.every((x) => { const s = x.querySelector('svg'); return s && s.getBoundingClientRect().width >= 14; })), n + 'chaque bouton montre bien son dessin (flèche, étoile, croix)');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne déborde de l’écran');

    // ordre, couverture, retirer, annuler
    await bouton(p, 1, 'apres'); await p.waitForTimeout(200);
    ok(await ordre(p) === 'm5,m4', n + '▶ : la 1re photo passe après');
    await bouton(p, 1, 'couverture'); await p.waitForTimeout(200);
    ok(await couverture(p) === 0 && /m5/.test(await p.$eval('#apercu-image img', (i) => i.src)), n + '★ : nouvelle couverture, l’aperçu suit');
    await bouton(p, 2, 'enlever'); await p.waitForTimeout(200);
    ok(await ordre(p) === 'm5' && /1 photo retirée/.test(await p.textContent('#pub-en-ligne')), n + '✕ : photo retirée, et c’est dit');
    await p.click('[data-action="publication-photos-annuler"]'); await p.waitForTimeout(200);
    ok(await ordre(p) === 'm5,m4', n + '« Annuler » : la photo revient');
    await bouton(p, 2, 'enlever'); await p.waitForTimeout(200);
    ok(!ecritures(journal, 'actualite_photos').length && !ecritures(journal, 'actualites').length && !journal.some((j) => j[0] === 'API' && /suppression/.test(j[2] || '')), n + 'rien n’est écrit ni effacé avant « Enregistrer »');

    // garder au moins une photo
    await bouton(p, 1, 'enlever'); await p.waitForTimeout(200);
    await p.click('form[data-form="publication-enregistrer"] [type=submit]'); await p.waitForTimeout(800);
    ok(/Gardez au moins une photo/.test(await p.textContent('#pub-msg')) && !ecritures(journal, 'actualites').length, n + 'toutes retirées sans vidéo : refusé, rien d’écrit');
    await p.click('[data-action="publication-photos-annuler"]'); await p.waitForTimeout(200);
    await bouton(p, 2, 'enlever'); await p.waitForTimeout(1000);  // le brouillon s'écrit juste après

    // quitter puis revenir : les choix sont gardés
    await p.goto(URL_ADMIN + '#/site/b2-candidatures'); await p.waitForTimeout(1200);
    await ouvrir(); await p.waitForTimeout(600);
    ok(await ordre(p) === 'm5' && /1 photo retirée/.test(await p.textContent('#pub-en-ligne')) && await couverture(p) === 0, n + 'retour sur la page : ordre, couverture et photo retirée retrouvés');

    // + une photo ajoutée, puis Enregistrer
    await p.setInputFiles('input[data-change="photos-choisies-ajouter"]', [photo(1)]); await p.waitForTimeout(300);
    const avant = journal.length;
    await p.click('form[data-form="publication-enregistrer"] [type=submit]'); await p.waitForTimeout(3500);
    const apres = journal.slice(avant);
    const iSuppr = apres.findIndex((j) => j[0] === 'DELETE' && j[1] === 'actualite_photos');
    const iFichier = apres.findIndex((j) => j[0] === 'API' && /"action":"suppression"/.test(j[2] || '') && /site\/actualites\/a1\/1\.jpg/.test(j[2] || ''));
    ok(iSuppr >= 0 && /ap1/.test(apres[iSuppr][2]) && !/ap2/.test(apres[iSuppr][2]), n + 'la photo retirée (et elle seule) est retirée de la base');
    ok(iFichier > iSuppr, n + 'son fichier est effacé du stockage APRÈS la base');
    ok(!apres.some((j) => j[0] === 'API' && /"action":"suppression"/.test(j[2] || '') && /a1\/2\.jpg/.test(j[2] || '')), n + 'la photo gardée n’est pas effacée');
    ok(apres.some((j) => j[0] === 'PATCH' && j[1] === 'actualite_photos' && /ap2/.test(j[2]) && /created_at/.test(j[3] || '')), n + 'l’ordre est enregistré');
    ok(apres.some((j) => j[0] === 'PATCH' && j[1] === 'actualites' && /"image_url":"[^"]*\/m5\//.test(j[3] || '')), n + 'la nouvelle couverture est enregistrée');
    ok(apres.filter((j) => j[0] === 'POST' && j[1] === 'actualite_photos').length === 1, n + 'la photo ajoutée est envoyée aussi');
    await p.waitForTimeout(300);
    ok(/#\/site\/actualites$/.test(p.url()), n + 'retour à la liste après l’enregistrement');
    await ouvrir();
    ok(!/photo retirée/.test(await p.textContent('#pub-en-ligne')) && !/Brouillon retrouvé/.test(await p.textContent('#pub-msg')), n + 'après enregistrement : plus de brouillon');

    // texte seul modifié : les photos ne sont pas touchées
    const avant2 = journal.length;
    await p.fill('#pub-titre', 'Casting national 2026 — inscriptions');
    await p.click('form[data-form="publication-enregistrer"] [type=submit]'); await p.waitForTimeout(2500);
    ok(!ecritures(journal.slice(avant2), 'actualite_photos').length && journal.slice(avant2).some((j) => j[0] === 'PATCH' && j[1] === 'actualites'), n + 'titre seul modifié : les photos ne sont pas touchées');

    // « Remplacer » : une autre photo à la même place ; la couverture la suit ; l'ancien fichier est effacé après la base
    await ouvrir();
    await p.waitForTimeout(400);
    // la 1re photo (son numéro et son fichier : ap1 → a1/1.jpg, ap2 → a1/2.jpg)
    const idR = await p.getAttribute('#pub-en-ligne .pub-photo-en-ligne:nth-child(1) [data-action="publication-photo-remplacer"]', 'data-id'), fichierR = 'a1/' + idR.slice(2) + '.jpg';
    const [choix] = await Promise.all([p.waitForEvent('filechooser'), bouton(p, 1, 'remplacer')]);
    await choix.setFiles(photo(2)); await p.waitForTimeout(400);
    ok(/Nouvelle photo/.test(await p.textContent('#pub-en-ligne .pub-photo-en-ligne:nth-child(1)')) && await couverture(p) === 0 && /^blob:/.test(await p.$eval('#pub-en-ligne .pub-photo-en-ligne:nth-child(1) img', (i) => i.src)) && /1 photo remplacée/.test(await p.textContent('#pub-en-ligne')),
      n + '« Remplacer » : la nouvelle photo prend la place (et reste la couverture)');
    ok(/^blob:/.test(await p.$eval('#apercu-image img', (i) => i.src)), n + 'l’aperçu montre la nouvelle couverture');
    const avant3 = journal.length;
    ok(!journal.slice(avant3).length && !ecritures(journal.slice(avant2), 'actualite_photos').length, n + 'remplacement : rien d’envoyé avant « Enregistrer »');
    await p.waitForTimeout(900);
    await p.goto(URL_ADMIN + '#/site/b2-candidatures'); await p.waitForTimeout(1200);
    await ouvrir(); await p.waitForTimeout(600);
    ok(/Nouvelle photo/.test(await p.textContent('#pub-en-ligne .pub-photo-en-ligne:nth-child(1)')), n + 'retour sur la page : le remplacement est gardé dans le brouillon');
    const avant4 = journal.length;
    await p.click('form[data-form="publication-enregistrer"] [type=submit]'); await p.waitForTimeout(3500);
    const j4 = journal.slice(avant4);
    const iMaj = j4.findIndex((j) => j[0] === 'PATCH' && j[1] === 'actualite_photos' && j[2].includes('id=eq.' + idR) && /"url":"[^"]*site\/actualites\/a1\//.test(j[3] || ''));
    const iEnvoi = j4.findIndex((j) => j[0] === 'API' && /site\/actualites\/a1\//.test(j[2] || '') && !/suppression/.test(j[2] || ''));
    const iEfface = j4.findIndex((j) => j[0] === 'API' && /"action":"suppression"/.test(j[2] || '') && (j[2] || '').includes(fichierR));
    ok(iEnvoi >= 0 && iMaj > iEnvoi, n + 'la nouvelle photo est envoyée, puis la même ligne pointe vers elle (même place)');
    ok(iEfface > iMaj, n + 'l’ancien fichier est effacé du stockage APRÈS la base');
    ok(j4.some((j) => j[0] === 'PATCH' && j[1] === 'actualites' && /"image_url":"[^"]*site\/actualites\/a1\//.test(j[3] || '')), n + 'la couverture suit la nouvelle photo');
    ok(!j4.some((j) => (j[0] === 'DELETE' || j[0] === 'POST') && j[1] === 'actualite_photos'), n + 'aucune ligne supprimée ni ajoutée (remplacement sur place)');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
