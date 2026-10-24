// Nouvelle Administration — groupe « Mannequins » (js/admin/site-mannequins.js), essayé comme
// l'agence sur téléphone et ordinateur, base SIMULÉE (donnees-nouvelle-admin.js) : galerie des
// visages (publiées + en sourdine), recherche, fiche (photos, compcard, ajout,
// suppression — la base d'abord, les fichiers ensuite), sourdine, CV, suppression définitive
// (taper SUPPRIMER) ; validations (publier, refuser avec la raison) ; mannequin à la une.
// Rien n'est écrit ni envoyé pour de vrai. CAPTURES=dossier : captures d'écran.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9700 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const capture = (p, nom) => process.env.CAPTURES ? p.screenshot({ path: process.env.CAPTURES + '/' + nom + '.png' }) : null;
const ecrits = (journal, m, table) => journal.filter((j) => j[0] === m && j[1] === table);

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore', stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ', suffixe = tel ? '-tel' : '-pc';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block', acceptDownloads: true });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept());
    await brancher(p, donnees('principal'), journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');

    // 1. Galerie
    await p.goto(URL_ADMIN + '#/site/b2-mannequins-publies'); await p.waitForSelector('.mannequins-grille', { timeout: 10000 }); await p.waitForTimeout(1200);
    const g = await p.evaluate(() => ({ cartes: [...document.querySelectorAll('.mannequin-carte')].map((c) => c.innerText.replace(/\s+/g, ' ')), photos: document.querySelectorAll('.mannequin-carte .vis img.charge').length, entete: document.querySelector('.entete').innerText }));
    ok(g.cartes.length === 13 && g.cartes.some((c) => /KORA BAMBA.*En sourdine/.test(c)) && /12 publiées · 1 en sourdine/.test(g.entete), n + 'galerie : 12 publiées et 1 en sourdine (pour pouvoir la réactiver)');
    ok(g.photos >= 10, n + 'galerie : les visages s’affichent (' + g.photos + ')');
    await capture(p, 'mannequins' + suffixe);
    await p.fill('#mq-cherche', 'aya'); await p.click('form[data-form="mannequins-chercher"] [type=submit]'); await p.waitForTimeout(800);
    ok((await p.$$('.mannequin-carte')).length === 1, n + 'recherche par nom');
    await p.fill('#mq-cherche', ''); await p.click('form[data-form="mannequins-chercher"] [type=submit]'); await p.waitForTimeout(800);

    // 2. Fiche : photos, compcard, catégorie, ajout, suppression
    await p.click('.mannequin-carte[href$="/m0"]'); await p.waitForSelector('.mannequin-tete'); await p.waitForTimeout(1000);
    ok(/AYA KOUASSI/.test(await p.textContent('.mannequin-tete')) && (await p.$$('.photo-mannequin')).length === 2 && /Compcard 1/.test(await p.textContent('.photos-mannequin')), n + 'fiche : nom, 2 photos, compcard 1 signalée');
    await capture(p, 'fiche-mannequin' + suffixe);
    await p.selectOption('.photo-mannequin:nth-child(2) select[data-change="mannequin-compcard"]', '2'); await p.waitForTimeout(900);
    ok(ecrits(journal, 'PATCH', 'model_photos').some((j) => /"compcard_ordre":2/.test(j[3])), n + 'compcard : photo placée en case 2');
    // plus de classement Book / Lifestyle (24/10/2026) : toutes les photos sont dans le Book
    ok(!(await p.$('select[data-change="mannequin-categorie"]')) && !/Lifestyle/.test(await p.textContent('#mq-photos')), n + 'plus de classement Book / Lifestyle : toutes les photos dans le Book');
    await p.setInputFiles('input[data-change="mannequin-photos-ajouter"]', [require('path').join(__dirname, 'medias', 'photo1.jpg'), require('path').join(__dirname, 'medias', 'photo2.jpg')]); await p.waitForTimeout(6000);
    ok(ecrits(journal, 'POST', 'model_photos').length === 2 && /2\/2 photos envoyées/.test(await p.textContent('#mq-photo-msg')), n + 'deux photos ajoutées d’un coup');
    const r2Avant = journal.filter((j) => j[0] === 'API' && j[1] === '/api/r2-supprimer').length;
    await p.click('.photo-mannequin [data-action="mannequin-photo-supprimer"]'); await p.waitForTimeout(1500);
    ok(ecrits(journal, 'DELETE', 'model_photos').length === 1, n + 'photo supprimée (la base d’abord)');
    // 3. Sourdine
    await p.click('[data-action="mannequin-sourdine"]'); await p.waitForTimeout(1000);
    ok(journal.some((j) => j[0] === 'rpc' && j[1] === 'definir_sourdine' && /"p_desactive":true/.test(j[2])) && /En sourdine/.test(await p.textContent('.mannequin-tete')), n + 'mise en sourdine après confirmation');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'fiche en sourdine : rien ne dépasse de l’écran');
    // 4. CV
    // photos du CV téléchargées par l'adresse de l'Administration elle-même : depuis admin.…, l'adresse
    // www est refusée par la sécurité du navigateur (CV sans photos, signalé le 22/10/2026)
    const photosCv = []; const surRequete = (r) => { if (/book-photos/.test(r.url()) && r.resourceType() === 'fetch') photosCv.push(r.url()); };
    p.on('request', surRequete);
    await p.click('a[href$="/cv"]'); await p.waitForSelector('#cv-apercu'); await p.waitForTimeout(4000);
    p.off('request', surRequete);
    ok(photosCv.length > 0 && photosCv.every((u) => u.startsWith('http://127.0.0.1:')), n + 'CV : photos chargées par l’adresse de l’Administration (' + photosCv.length + ' ; ' + (photosCv.find((u) => !u.startsWith('http://127.0.0.1:')) || 'toutes locales') + ')');
    ok(await p.isVisible('#cv-pdf') && await p.isVisible('#cv-jpeg') && (await p.$('#cv-apercu img') || /indisponible/.test(await p.textContent('#cv-apercu'))), n + 'CV : aperçu et téléchargements PDF / JPEG');
    // photos d'essai de 1200 px (moins de 1600 px) : l'aperçu prévient qu'elles sont trop petites (24/10/2026)
    ok(!(await p.$('#cv-apercu img')) || /faible qualité.*photos originales/.test(await p.textContent('#cv-apercu')), n + 'CV : avertissement « photos de faible qualité, envoyez les originales »');
    await p.goBack(); await p.waitForSelector('.mannequin-tete'); await p.waitForTimeout(600);
    // 5. Suppression définitive : il faut taper SUPPRIMER
    await p.click('[data-action="mannequin-supprimer"]'); await p.fill('#mq-confirmer', 'supprimer'); await p.click('form[data-form="mannequin-supprimer"] [type=submit]'); await p.waitForTimeout(500);
    ok(!journal.some((j) => j[0] === 'API' && j[1] === '/api/supprimer-mannequin'), n + 'suppression refusée si le mot n’est pas exactement SUPPRIMER');
    await p.click('[data-action="mannequin-supprimer"]').catch(() => {}); await p.fill('#mq-confirmer', 'SUPPRIMER'); await p.click('form[data-form="mannequin-supprimer"] [type=submit]'); await p.waitForTimeout(1200);
    ok(journal.some((j) => j[0] === 'API' && j[1] === '/api/supprimer-mannequin' && /"modelId":"m0"/.test(j[2])) && /b2-mannequins-publies$/.test(p.url()), n + 'suppression définitive envoyée au serveur, retour à la galerie');

    // 6. Validations
    await p.goto(URL_ADMIN + '#/site/b2-validations'); await p.waitForSelector('.entete'); await p.waitForTimeout(1200);
    ok(/NOUVELLE FACE/.test(await p.textContent('.contenu')) && /Mineure — 15 ans/.test(await p.textContent('.contenu')) && (await p.$$('.validation-photos .vis img')).length === 2, n + 'validation : fiche en attente, mineure signalée, ses photos');
    await capture(p, 'validations' + suffixe);
    await p.click('[data-action="validation-refuser"]'); await p.fill('#vr-raison', 'Ajoutez une photo de face.'); await p.click('form[data-form="validation-refuser"] [type=submit]'); await p.waitForTimeout(900);
    ok(ecrits(journal, 'PATCH', 'model_profiles').some((j) => /Ajoutez une photo de face/.test(j[3]) && /"en_attente_validation":false/.test(j[3])), n + 'refus avec la raison, visible par la mannequin');

    // 7. Mannequin à la une
    await p.goto(URL_ADMIN + '#/site/b3c-vedette-admin'); await p.waitForSelector('.mannequins-grille'); await p.waitForTimeout(1000);
    ok(/GRÂCE YAO/.test(await p.textContent('.une-actuelle')), n + 'à la une : la mannequin actuelle est montrée');
    await p.click('.mannequin-carte[data-id="m5"]'); await p.waitForTimeout(1000);
    ok(ecrits(journal, 'PATCH', 'model_profiles').some((j) => /"featured":true/.test(j[3]) && /id=eq\.m5/.test(j[2])), n + 'nouvelle mannequin à la une en touchant son visage');
    await capture(p, 'vedette' + suffixe);
    // 8. Photos mises de côté, Rapport des profils, Fiches événement (écrans partagés)
    await p.goto(URL_ADMIN + '#/site/b2-tri-photos'); await p.waitForSelector('#tri-photos-details'); await p.waitForTimeout(1500);
    ok((await p.$$('#tri-ecartees .tri-vignette')).length === 1 && /FATIM DIALLO/.test(await p.textContent('#tri-ecartees')), n + 'photos mises de côté : chargées d’office, avec le nom');
    await p.click('#tri-ecartees .tri-vignette .btn'); await p.waitForTimeout(900);
    ok(ecrits(journal, 'PATCH', 'model_photos').some((j) => /"tri_statut":"book"/.test(j[3])), n + 'photo remise dans le Book');
    await p.goto(URL_ADMIN + '#/site/b2-rapport-profils'); await p.waitForSelector('#rapport-profils-details'); await p.waitForTimeout(2500);
    ok((await p.$$('#rapport-profils-liste .rp-profil')).length >= 10, n + 'rapport des profils : analyse lancée d’office (' + (await p.$$('#rapport-profils-liste .rp-profil')).length + ' profils)');
    ok((await p.$$('#rapport-profils-liste .rp-profil .vis.medaillon img')).length >= 3, n + 'rapport des profils : visages en médaillon');
    // les volets à l'intérieur s'ouvrent au toucher (« Profils à jour », « Voir / modifier le message »)
    const volet = await p.$('#rapport-profils-liste details.rp-message, #rapport-profils-liste details.rp-groupe:not([hidden])');
    if (volet) { await volet.$eval('summary', (x) => x.scrollIntoView({ block: 'center' })); await (await volet.$('summary')).click(); await p.waitForTimeout(300); }
    ok(volet && await volet.evaluate((x) => x.open), n + 'rapport des profils : un volet replié s’ouvre au toucher');
    await capture(p, 'rapport-profils' + suffixe);
    await p.goto(URL_ADMIN + '#/site/b2-fiches-evenement'); await p.waitForSelector('#fiches-evenement-details'); await p.waitForTimeout(1500);
    ok((await p.$$('#fiches-evenement-liste .fe-ligne')).length >= 10 && /AYA KOUASSI/.test(await p.textContent('#fiches-evenement-liste')), n + 'fiches événement : liste des mannequins');
    ok((await p.$$('#fiches-evenement-liste .fe-ligne .vis.medaillon img')).length >= 3, n + 'fiches événement : visages en médaillon');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran');
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
