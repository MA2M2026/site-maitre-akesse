// Nouvelle Administration — groupe « Contenu du site » (js/admin/site-contenu.js), essayé comme
// l'agence sur téléphone et ordinateur, base SIMULÉE (donnees-nouvelle-admin.js) : Actualités et
// Événements (galerie avec couvertures, rédaction avec photos, texte mis en forme et aperçu en
// direct, modification, suppression). Rien n'est écrit ni envoyé pour de vrai.
// CAPTURES=dossier : captures d'écran.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const chemin = require('path');
const PORT = String(9500 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/nouvelle/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const capture = (p, nom) => process.env.CAPTURES ? p.screenshot({ path: process.env.CAPTURES + '/' + nom + '.png', fullPage: true }) : null;
const ecrits = (journal, m, table) => journal.filter((j) => j[0] === m && j[1] === table);
const photo = (n) => chemin.join(__dirname, 'medias', 'photo' + n + '.jpg');

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ', suffixe = tel ? '-tel' : '-pc';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept());
    await brancher(p, donnees('principal'), journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');

    // 1. Galerie des actualités
    await p.goto(URL_ADMIN + '#/site/actualites'); await p.waitForSelector('.publications-grille', { timeout: 10000 }); await p.waitForTimeout(1000);
    const cartes = await p.$$eval('.publication-carte', (l) => l.map((c) => c.innerText.replace(/\s+/g, ' ')));
    ok(cartes.length === 2 && /CASTING.*Casting national 2026.*2 photos/i.test(cartes[0]) && /vidéo/.test(cartes[1]), n + 'actualités : 2 publications, catégorie, photos, vidéo (' + cartes.join(' | ') + ')');
    ok((await p.$$('.publication-image img')).length === 2 && /i\.ytimg\.com\/vi\/abcdefghijk\//.test(await p.getAttribute('.publication-carte:nth-child(2) img', 'src')), n + 'la couverture s’affiche, et l’image de la vidéo YouTube quand il n’y a pas de photo');
    await capture(p, 'actualites' + suffixe);

    // 2. Nouvelle actualité : refus sans photo ni vidéo, lien vidéo vérifié, puis publication
    await p.click('a[href$="/actualites/nouvelle"]'); await p.waitForSelector('#pub-titre'); await p.waitForSelector('#pub-editeur .ql-editor', { timeout: 8000 }).catch(() => {});
    ok(!!(await p.$('#pub-editeur .ql-editor')), n + 'éditeur de texte mis en forme chargé à la demande');
    await p.fill('#pub-titre', 'Nouvelle saison'); await p.selectOption('#pub-categorie', 'Mannequinat');
    await p.click('#pub-editeur .ql-editor'); await p.keyboard.type('Les inscriptions sont ouvertes.');
    await p.waitForTimeout(300);
    ok(/Nouvelle saison/.test(await p.textContent('#apercu-titre')) && /inscriptions sont ouvertes/.test(await p.textContent('#apercu-texte')) && /Mannequinat/.test(await p.textContent('#apercu-categorie')), n + 'aperçu en direct : titre, catégorie, texte');
    await p.click('form[data-form="publication-enregistrer"] [type=submit]'); await p.waitForTimeout(500);
    ok(/au moins une photo ou ajoutez un lien vidéo/.test(await p.textContent('#pub-msg')) && !ecrits(journal, 'POST', 'actualites').length, n + 'refus sans photo ni vidéo');
    await p.fill('#pub-video', 'https://exemple.com/film'); await p.click('form[data-form="publication-enregistrer"] [type=submit]'); await p.waitForTimeout(500);
    ok(/n’est pas reconnu/.test(await p.textContent('#pub-msg')), n + 'lien vidéo non reconnu signalé');
    await p.fill('#pub-video', '');
    await p.setInputFiles('input[data-change="publication-photos"]', [photo(1), photo(2)]); await p.waitForTimeout(400);
    ok((await p.$$('#pub-nouvelles img')).length === 2 && !!(await p.$('#apercu-image img')), n + 'photos choisies montrées, couverture dans l’aperçu');
    await capture(p, 'actualite-redaction' + suffixe);
    await p.click('form[data-form="publication-enregistrer"] [type=submit]'); await p.waitForTimeout(3500);
    const cree = ecrits(journal, 'POST', 'actualites');
    ok(cree.length === 1 && /"titre":"Nouvelle saison"/.test(cree[0][3]) && /"categorie":"Mannequinat"/.test(cree[0][3]) && /inscriptions sont ouvertes/.test(cree[0][3]) && /"image_url":"https:\/\/photos\./.test(cree[0][3]), n + 'actualité publiée avec texte et couverture');
    ok(ecrits(journal, 'POST', 'actualite_photos').length === 2 && journal.filter((j) => j[0] === 'API' && j[1] === '/api/r2-site-images').length >= 2, n + '2 photos envoyées puis rattachées');
    ok(/#\/site\/actualites$/.test(p.url()), n + 'retour à la galerie après publication');

    // 3. Modifier puis supprimer une actualité existante
    await p.goto(URL_ADMIN + '#/site/actualites/a1'); await p.waitForSelector('#pub-titre'); await p.waitForTimeout(1200);
    ok(await p.inputValue('#pub-titre') === 'Casting national 2026' && /grand/.test(await p.textContent('#pub-editeur')) && (await p.$$('.pub-photos img')).length === 2, n + 'modification : titre, texte et photos en ligne repris');
    ok(/actualites\?actu=a1/.test(await p.getAttribute('a[target=_blank]', 'href')), n + 'lien « Voir sur le site »');
    await p.fill('#pub-titre', 'Casting national 2026 — dates'); await p.click('form[data-form="publication-enregistrer"] [type=submit]'); await p.waitForTimeout(1500);
    ok(ecrits(journal, 'PATCH', 'actualites').some((j) => /id=eq\.a1/.test(j[2]) && /dates/.test(j[3])), n + 'modification enregistrée');
    await p.goto(URL_ADMIN + '#/site/actualites/a2'); await p.waitForSelector('[data-action="publication-supprimer"]'); await p.waitForTimeout(600);
    await p.click('[data-action="publication-supprimer"]'); await p.waitForTimeout(1500);
    ok(ecrits(journal, 'DELETE', 'actualites').some((j) => /id=eq\.a2/.test(j[2])) && /#\/site\/actualites$/.test(p.url()), n + 'suppression (après confirmation), retour à la galerie');

    // 4. Événements : titre et photo obligatoires, date et lieu
    await p.goto(URL_ADMIN + '#/site/evenements'); await p.waitForSelector('.publications-grille'); await p.waitForTimeout(800);
    ok(/Abidjan Fashion Night.*12 septembre 2026.*Sofitel Ivoire/.test(await p.textContent('.publications-grille')), n + 'événements : date lue sans décalage, lieu');
    await p.click('a[href$="/evenements/nouvelle"]'); await p.waitForSelector('#pub-date'); await p.waitForTimeout(800);
    await p.fill('#pub-titre', 'Gala MA2M'); await p.fill('#pub-date', '2026-12-05'); await p.fill('#pub-lieu', 'Plateau');
    await p.click('form[data-form="publication-enregistrer"] [type=submit]'); await p.waitForTimeout(400);
    ok(/au moins une photo/.test(await p.textContent('#pub-msg')), n + 'événement : photo obligatoire');
    ok(/5 décembre 2026.*Plateau/.test(await p.textContent('#apercu-quand')), n + 'aperçu : date et lieu');
    await p.setInputFiles('input[data-change="publication-photos"]', [photo(3)]);
    await p.click('form[data-form="publication-enregistrer"] [type=submit]'); await p.waitForTimeout(3000);
    ok(ecrits(journal, 'POST', 'evenements').some((j) => /"date_evenement":"2026-12-05"/.test(j[3]) && /"lieu":"Plateau"/.test(j[3])), n + 'événement publié');
    await capture(p, 'evenements' + suffixe);

    // 5. Partenaires : logos (ou initiale), ajout, changement de logo (l'ancien fichier est effacé), suppression
    await p.goto(URL_ADMIN + '#/site/partenaires'); await p.waitForSelector('.partenaires-grille'); await p.waitForTimeout(800);
    ok((await p.$$('.partenaire-carte')).length === 2 && (await p.$$('.partenaire-logo img')).length === 1 && /K/.test(await p.textContent('.partenaire-carte:nth-child(2) .ini')), n + 'partenaires : logo, ou initiale sans logo');
    await capture(p, 'partenaires' + suffixe);
    await p.click('a[href$="/partenaires/nouveau"]'); await p.waitForSelector('#pa-nom'); await p.waitForTimeout(800);
    await p.fill('#pa-nom', 'Studio Lagune'); await p.selectOption('#pa-role', 'Styliste'); await p.fill('#pa-structure', 'Lagune & Co');
    await p.click('#pa-editeur .ql-editor'); await p.keyboard.type('Styliste des défilés.');
    await p.setInputFiles('input[data-change="partenaire-logo"]', photo(2)); await p.waitForTimeout(300);
    ok(!!(await p.$('#pa-apercu img')), n + 'aperçu du logo choisi');
    await p.click('form[data-form="partenaire-enregistrer"] [type=submit]'); await p.waitForTimeout(2500);
    ok(ecrits(journal, 'POST', 'partenaires').some((j) => /"nom":"Studio Lagune"/.test(j[3]) && /"role":"Styliste"/.test(j[3]) && /défilés/.test(j[3]) && /"logo_chemin":"site\/partenaires\//.test(j[3])) && /#\/site\/partenaires$/.test(p.url()), n + 'partenaire ajouté avec son logo et sa présentation');
    await p.goto(URL_ADMIN + '#/site/partenaires/pa1'); await p.waitForSelector('#pa-nom'); await p.waitForTimeout(1000);
    ok(await p.inputValue('#pa-nom') === 'Maison Ivoire' && await p.inputValue('#pa-role') === 'Promoteur' && /Fidèle/.test(await p.textContent('#pa-editeur')), n + 'fiche partenaire reprise');
    await capture(p, 'partenaire-fiche' + suffixe);
    const supprAvant = journal.filter((j) => j[0] === 'API' && /"action":"suppression"/.test(j[2] || '')).length;
    await p.setInputFiles('input[data-change="partenaire-logo"]', photo(3));
    await p.click('form[data-form="partenaire-enregistrer"] [type=submit]'); await p.waitForTimeout(2500);
    const supprs = journal.filter((j) => j[0] === 'API' && /"action":"suppression"/.test(j[2] || ''));
    ok(ecrits(journal, 'PATCH', 'partenaires').some((j) => /id=eq\.pa1/.test(j[2]) && /logo_chemin/.test(j[3])) && supprs.length === supprAvant + 1 && /pa1\/logo\.jpg/.test(supprs[supprs.length - 1][2]), n + 'nouveau logo enregistré, ancien fichier effacé ensuite');
    await p.goto(URL_ADMIN + '#/site/partenaires/pa2'); await p.waitForSelector('[data-action="partenaire-supprimer"]'); await p.waitForTimeout(600);
    await p.click('[data-action="partenaire-supprimer"]'); await p.waitForTimeout(1500);
    ok(ecrits(journal, 'DELETE', 'partenaires').some((j) => /id=eq\.pa2/.test(j[2])), n + 'partenaire supprimé après confirmation');

    // 6. Mot du fondateur : texte et photo
    await p.goto(URL_ADMIN + '#/site/b3c-mot-fondateur'); await p.waitForSelector('#mr-nom'); await p.waitForTimeout(900);
    ok(await p.inputValue('#mr-nom') === 'Franck Akesse' && !!(await p.$('#mr-apercu img')) && await p.isDisabled('#mr-photo-btn'), n + 'mot du fondateur : nom, photo actuelle, bouton photo inactif sans fichier');
    await p.fill('#mr-message', 'Bienvenue chez Maître Akesse Model Management.'); await p.click('form[data-form="mot-texte"] [type=submit]'); await p.waitForTimeout(1000);
    ok(ecrits(journal, 'PATCH', 'mot_responsable').some((j) => /id=eq\.principal/.test(j[2]) && /Model Management/.test(j[3])) && /en ligne/.test(await p.textContent('#mr-msg')), n + 'message enregistré');
    await p.setInputFiles('input[data-change="mot-photo-choisie"]', photo(1)); await p.click('#mr-photo-btn'); await p.waitForTimeout(2500);
    ok(ecrits(journal, 'PATCH', 'mot_responsable').some((j) => /"photo_url":"https:\/\/photos\.[^"]*site\/responsable\//.test(j[3])), n + 'nouvelle photo envoyée et enregistrée');
    await capture(p, 'mot-fondateur' + suffixe);
    // 7. Instagram : état du jeton, publications, jeton jamais réaffiché
    await p.goto(URL_ADMIN + '#/site/b3c-instagram'); await p.waitForSelector('.insta-grille'); await p.waitForTimeout(800);
    ok(/expire dans 5 jour/.test(await p.textContent('.etat-jeton')) && (await p.$$('.insta-vignette img')).length === 1 && await p.inputValue('#ig-jeton') === '' && !/jeton-secret-essai/.test(await p.content()), n + 'instagram : alerte d’expiration, publications, jeton jamais affiché');
    await p.fill('#ig-jeton', 'nouveau-jeton'); await p.click('form[data-form="instagram-jeton"] [type=submit]'); await p.waitForTimeout(1000);
    ok(ecrits(journal, 'POST', 'instagram_config').some((j) => /nouveau-jeton/.test(j[3]) && /"ig_user_id":"1784"/.test(j[3])), n + 'nouveau jeton enregistré (60 jours)');
    await p.route(/graph\.facebook\.com/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'x1', media_type: 'IMAGE', media_url: 'https://www.maitreakessemodelmanagement.com/book-photos/m1/1.jpg', permalink: 'https://www.instagram.com/p/x1/', caption: 'Nouvelle collection' }, { id: 'x2', media_type: 'VIDEO', thumbnail_url: 'https://www.maitreakessemodelmanagement.com/book-photos/m2/2.jpg', permalink: 'https://www.instagram.com/p/x2/' }] }) }));
    await p.click('[data-action="instagram-rafraichir"]'); await p.waitForTimeout(1500);
    ok(ecrits(journal, 'POST', 'instagram_posts_cache').some((j) => /Nouvelle collection/.test(j[3]) && /2\.jpg/.test(j[3])), n + 'publications récupérées et mises sur le site');
    await capture(p, 'instagram' + suffixe);

    // 8. Agenda du site (écran partagé avec l'ancien tableau de bord) : liste, ajout, modifier, Convoquer
    await p.goto(URL_ADMIN + '#/site/b3c-agenda'); await p.waitForSelector('#agenda-form', { state: 'attached' }); await p.waitForTimeout(1800);
    const listeAgenda = await p.textContent('#agenda-liste-avenir');
    ok(/ABIDJAN BORDER FORUM/.test(listeAgenda) && /SHOOTING CACAO/.test(listeAgenda) && (await p.$$('#agenda-mannequins input[type=checkbox]')).length >= 12, n + 'agenda : projets à venir et liste des mannequins chargés d’office');
    ok(!(await p.isVisible('#agenda-form')), n + 'agenda : formulaire replié, la liste d’abord');
    await p.click('.agenda-ouvrir'); await p.waitForTimeout(400);
    await p.fill('#agenda-titre', 'Défilé de Noël'); await p.fill('#agenda-date', '2026-12-20'); await p.fill('#agenda-ville', 'Abidjan');
    await p.$eval('#agenda-mannequins input[type=checkbox]', (x) => x.click());
    await p.click('#agenda-enregistrer'); await p.waitForTimeout(1500);
    ok(ecrits(journal, 'POST', 'agenda_projets').some((j) => /Défilé de Noël/.test(j[3]) && /"date_debut":"2026-12-20"/.test(j[3])) && await p.isVisible('#agenda-msg'), n + 'agenda : projet ajouté, message visible');
    await p.click('#agenda-liste-avenir [data-modifier="p2"]'); await p.waitForTimeout(500);
    ok(!(await p.isHidden('#agenda-en-cours')) && /SHOOTING CACAO/.test(await p.textContent('#agenda-en-cours')), n + 'agenda : « Modifier » ouvre le bon projet');
    await capture(p, 'agenda' + suffixe);
    await p.click('#agenda-liste-avenir [data-convoquer="p1"]').catch(() => {}); await p.waitForTimeout(1500);
    ok(/b2-convocations/.test(p.url()), n + 'agenda : « Convoquer » ouvre les convocations');

    // 9. Vidéo de l'accueil (écran partagé) : vidéo actuelle, nouvelle vidéo envoyée (rien de réel)
    await p.route('**/book-photos/site/video-accueil/**', (r) => r.fulfill({ status: 200, contentType: 'video/mp4', body: require('fs').readFileSync(chemin.join(__dirname, 'medias', 'video.mp4')) }));
    await p.goto(URL_ADMIN + '#/site/b3d-video-accueil'); await p.waitForSelector('#va-fichier'); await p.waitForTimeout(1500);
    ok(!/Chargement/.test(await p.textContent('#va-etat')) && !!(await p.$('#va-apercu video')), n + 'vidéo de l’accueil : état et aperçu de la vidéo actuelle (' + (await p.textContent('#va-etat')).slice(0, 60) + ')');
    await p.setInputFiles('#va-fichier', chemin.join(__dirname, 'medias', 'video.mp4')); await p.waitForTimeout(2500);
    await p.waitForSelector('#va-publier-btn:not([disabled])', { timeout: 15000 }).catch(() => {});
    await p.click('#va-publier-btn'); await p.waitForTimeout(500);
    await p.waitForFunction(() => /✓/.test(document.getElementById('va-msg').textContent), null, { timeout: 60000 }).catch(() => {});
    ok(journal.some((j) => j[0] === 'POST' && j[1] === 'reglages_site' && /video-accueil/.test(j[3])) && /✓/.test(await p.textContent('#va-msg')), n + 'nouvelle vidéo envoyée et mise sur l’accueil (' + (await p.textContent('#va-msg')).slice(0, 80) + ')');
    await capture(p, 'video-accueil' + suffixe);

    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    await p.goto(URL_ADMIN + '#/site/actualites/a1'); await p.waitForSelector('#pub-titre'); await p.waitForTimeout(1200);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rédaction : rien ne dépasse de l’écran');
    const pales2 = await lirePageEntiere(p);
    ok(!pales2.length, n + 'rédaction : textes lisibles ' + pales2.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
