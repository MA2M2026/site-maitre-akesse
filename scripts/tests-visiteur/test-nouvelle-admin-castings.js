// Nouvelle Administration — Candidatures casting et Demandes recruteurs (js/admin/site-dossiers.js),
// essayées comme l'agence, sur téléphone et ordinateur, base SIMULÉE (donnees-nouvelle-admin.js) :
// pièces réservées chargées après la clé d'accès, galerie des visages et pastilles, fiche d'une
// mineure (tout part vers son parent), statut « Retenue » (e-mail automatique, WhatsApp, code
// d'inscription), « Écrire sur WhatsApp » avec rendez-vous, photos (ajout vers Drive, suppression),
// suppression du dossier ; recruteur : mannequins choisis avec leurs visages, retrait.
// Rien n'est écrit ni envoyé pour de vrai. CAPTURES=dossier : captures d'écran.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9400 + Math.floor(Math.random() * 90));
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
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [], d = donnees('principal');
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept());
    await brancher(p, d, journal); await photosLocales(p);
    // envoi d'une photo vers Google Drive (script Google simulé)
    await p.route(/script\.google\.com/, (r) => { journal.push(['DRIVE', r.request().postData() ? 'photo' : '']); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, liens: ['https://drive.google.com/uc?id=photo-nouvelle'] }) }); });
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');

    // 1. Liste des candidatures
    await p.goto(URL_ADMIN + '#/site/b2-candidatures'); await p.waitForSelector('.dossiers-grille', { timeout: 10000 }); await p.waitForTimeout(1200);
    ok(journal.some((j) => j[0] === 'API' && j[1] === '/api/acces-tableau'), n + 'clé d’accès demandée avant de charger les pièces réservées');
    const liste = await p.evaluate(() => ({
      pastilles: [...document.querySelectorAll('.segments .btn')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
      cartes: [...document.querySelectorAll('.dossier-carte')].map((c) => c.innerText.replace(/\s+/g, ' ')),
      visages: document.querySelectorAll('.dossier-carte .vis img').length,
      waParent: [...document.querySelectorAll('.dossier-wa')].map((a) => a.textContent + ' ' + a.href)
    }));
    ok(liste.pastilles.join('|') === 'Toutes 4|Nouvelle 3|Retenue 1|Refusée 0|À revoir 0|En attente 0', n + 'pastilles et nombres, « À revoir » et « En attente » à part (' + liste.pastilles.join(', ') + ')');
    ok(liste.cartes.length === 3 && /PETITE AMA.*Mineur.*CASTING CACAO.*Débutant·e.*Cocody/.test(liste.cartes[0]), n + 'les 3 nouvelles, la plus récente d’abord, mineure signalée (' + liste.cartes[0].slice(0, 70) + ')');
    ok(liste.visages === 2 && liste.waParent.some((t) => /WhatsApp parent.*wa\.me\/2250707070707/.test(t)), n + 'visages des candidates, WhatsApp du parent pour la mineure');
    await capture(p, 'candidatures' + suffixe);
    await p.click('.segments .btn[data-filtre="toutes"]'); await p.waitForTimeout(900);
    ok((await p.$$('.dossier-carte')).length === 4, n + 'filtre « Toutes » : les 4 dossiers (aucun mis à part)');
    // (12/11/2026, demande de la propriétaire) regroupées par jour d'arrivée, les plus récentes en haut
    { const jours = await p.$$eval('.jour-groupe', (l) => l.map((g) => ({ titre: g.querySelector('.jour-titre').childNodes[0].textContent.trim(), nb: Number(g.querySelector('.jour-titre .nb').textContent),
        cartes: g.querySelectorAll('.dossier-carte').length, dates: [...g.querySelectorAll('.dossier-meta')].map((m) => (m.textContent.match(/(\d{2})\/(\d{2})\/(\d{4})/) || []).slice(1).reverse().join('-')) })));
      const ordre = jours.map((j) => j.dates[0]);
      ok(jours.length >= 2 && jours.every((j) => j.nb === j.cartes && new Set(j.dates).size === 1) && ordre.every((x, i) => !i || x < ordre[i - 1]),
        n + 'candidatures regroupées par jour, le plus récent en haut : ' + jours.map((j) => j.titre + ' (' + j.nb + ')').join(' · ')); }
    // (12/11/2026, demande de la propriétaire) chaque candidature montre la date ET l'heure de réception
    ok((await p.$$eval('.dossier-carte .dossier-meta', (l) => l.map((x) => x.textContent))).every((t) => /\d{2}\/\d{2}\/\d{4} à \d{1,2} h \d{2}/.test(t)), n + 'chaque candidature : date et heure de réception (« 12/11/2026 à 14 h 49 »)');
    // (12/11/2026, demande de la propriétaire) messages déjà envoyés : visibles sur la carte, notés quand ils partent
    { const suivi = await p.$$eval('.dossier-carte', (l) => Object.fromEntries(l.map((c) => [c.querySelector('.dossier-nom').textContent.trim().split(' ').slice(0, 2).join(' '), (c.querySelector('.dossier-suivi') || {}).textContent || ''])));
      ok(/Prévenue le 10\/11/.test(suivi['AWA KONÉ']) && /Convoquée le 11\/11/.test(suivi['AWA KONÉ']) && /Aucun message envoyé/.test(suivi['BINTOU TRAORÉ']),
        n + 'cartes : « ✓ Prévenue le 10/11 · 📨 Convoquée le 11/11 » pour AWA, « Aucun message envoyé » pour les autres');
      const avant = ecrits(journal, 'POST', 'messages_candidats').length;
      const lien = await p.$('.dossier-carte a.dossier-wa[data-candidature="c2"]');
      if (lien) { await lien.evaluate((x) => x.addEventListener('click', (e) => e.preventDefault(), { once: true })); await lien.click(); await p.waitForTimeout(600); }
      const note = ecrits(journal, 'POST', 'messages_candidats').slice(avant)[0];
      ok(!!lien && note && /"candidature_id":"c2"/.test(note[3]) && /"sorte":"contact"/.test(note[3]) && /"canal":"whatsapp"/.test(note[3]), n + 'appui sur « WhatsApp » d’une carte : noté dans le registre (contact WhatsApp)'); }
    await p.click('.dossier-carte .dossier-lien[href$="/c1"]'); await p.waitForSelector('.messages-envoyes', { timeout: 10000 }).catch(() => {});
    ok(/Retenue : 1er message[\s\S]*E-mail · 10\/11\/2026 à/.test(await p.textContent('.messages-envoyes').catch(() => '')) && /convocation/i.test(await p.textContent('.messages-envoyes').catch(() => '')),
      n + 'fiche : « Messages envoyés » (convocation, information retenue), avec canal, date et heure');
    await p.goto(URL_ADMIN + '#/site/b2-candidatures'); await p.waitForSelector('.dossier-carte'); await p.waitForTimeout(800);
    await p.click('.segments .btn[data-filtre="nouvelle"]'); await p.waitForTimeout(900);

    // 2. Fiche d'une mineure
    await p.click('.dossier-carte .dossier-lien[href$="/c4"]'); await p.waitForSelector('.fiche-luxe'); await p.waitForTimeout(1200);
    const fiche = await p.evaluate(() => ({
      titre: document.querySelector('.fiche-luxe-portrait').innerText.replace(/\s+/g, ' '),   // (17/11) fiche façon « Étudier »
      photos: document.querySelectorAll('.photo-dossier img').length,
      champs: [...document.querySelectorAll('dl.champs')].map((x) => x.innerText).join(' ').replace(/\s+/g, ' '),
      liens: [...document.querySelectorAll('dl.champs a')].map((a) => a.textContent + ' ' + a.href),
      message: (document.querySelector('.fiche-luxe-mot') || {}).textContent,
      lecteur: (document.querySelector('.fiche-video iframe.lecteur-video') || {}).src || '',   // (17/11) vidéo en grand, bloc à part
      videoLarge: (() => { const f = document.querySelector('.fiche-video iframe.lecteur-video'); return f ? Math.round(f.getBoundingClientRect().width) : 0; })(),
      lienDrive: [...document.querySelectorAll('.fiche-video a[href*="drive.google.com"]')].filter((a) => !a.classList.contains('lecteur-secours')).length > 0 || !document.querySelector('.fiche-video a.lecteur-secours'),
      videoDansChamps: !!document.querySelector('dl.champs iframe')
    }));
    ok(/PETITE AMA/.test(fiche.titre) && /13 ans/.test(fiche.titre) && /CASTING CACAO/.test(fiche.titre) && /Mineure : message au parent/.test(fiche.titre), n + 'fiche (en grand, comme « Étudier ») : nom, âge de la mineure, casting visé');
    ok(!!(await p.$('.fiche-luxe-portrait .etude-photos')) && !(await p.$('.fiche-tete')), n + 'fiche : grande photo en tête, comme le mode « Étudier »');
    ok(fiche.photos === 2, n + 'fiche : les 2 photos de la candidate');
    ok(/mineur : écrire au parent/.test(fiche.champs) && fiche.liens.some((l) => /0707070707 ↗ WhatsApp https:\/\/wa\.me\/2250707070707/.test(l)) && !fiche.videoDansChamps && !fiche.lienDrive && fiche.lecteur === 'https://drive.google.com/file/d/abc123/preview' && /rêve de défiler/.test(fiche.message),
      n + 'fiche : WhatsApp sur le numéro du parent, vidéo lue dans son propre bloc (seulement un petit lien de secours), message de la candidate');
    ok(fiche.videoLarge >= Math.min(320, ecran.width - 80), n + 'fiche : vidéo en grand (' + fiche.videoLarge + ' px de large)');
    // (24/11/2026) vidéo sur toute la largeur de sa carte, sur fond noir (plus de bandes blanches) ; ville « Abidjan · Cocody »
    const videoPleine = await p.evaluate(() => { const f = document.querySelector('.fiche-video iframe.lecteur-video'), c = document.querySelector('.fiche-video'); const cs = getComputedStyle(c);
      return f.getBoundingClientRect().width >= c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2 && getComputedStyle(f).backgroundColor === 'rgb(90, 20, 27)'; });
    ok(videoPleine && /Abidjan · Cocody/.test(fiche.champs), n + 'fiche : vidéo sur toute la largeur de sa carte, fond rouge profond ; ville « Abidjan · Cocody »');
    // (24/11/2026) bloc « Parent ou tuteur » : état, coordonnées du parent, lien de confirmation prêt à partir sur WhatsApp
    const parent = await p.evaluate(() => { const b = document.querySelector('.bloc-parent'); if (!b) return null;
      const wa = b.querySelector('a.btn[href^="https://wa.me/"]');
      return { texte: b.innerText.replace(/\s+/g, ' '), wa: wa ? decodeURIComponent(wa.href) : '', email: !!b.querySelector('[data-action="dossier-parent-email"]'), alerte: !!b.querySelector('.alerte-parent'),
        infos: document.querySelector('.fiche-luxe-infos').innerText,
        copies: [coordonneesParentCopiees({ nom: 'Awa Koné', telephone: '+225 0700000001', email: 'a@b.ci', parentNom: 'Madame Koné Awa', parentTelephone: '0102030405' }),
          coordonneesParentCopiees({ nom: 'Awa Koné', telephone: '+225 07 00 00 00 01', parentTelephone: '0700000001' }),
          coordonneesParentCopiees({ nom: 'Awa Koné', email: 'Awa@B.ci', parentEmail: 'awa@b.ci', parentNom: 'Marie Koné' }),
          coordonneesParentCopiees({ nom: 'Awa Koné', telephone: '0700000001', email: 'a@b.ci', parentNom: 'Madame Marie Koné', parentTelephone: '0700000099', parentEmail: 'm@b.ci' })] }; });
    ok(parent && /Parent non confirmé/.test(parent.texte) && /Madame Ama Mère/.test(parent.texte) && /mere@test\.ci/.test(parent.texte) && !parent.alerte && parent.email
      && /^https:\/\/wa\.me\/2250707070707\?text=Bonjour Madame Ama Mère/.test(parent.wa) && /Votre fille PETITE AMA vient de déposer une candidature/.test(parent.wa) && /moins de 18 ans/.test(parent.wa) && /« Je confirme » ou « Je refuse »/.test(parent.wa) && /ne pas le transmettre/.test(parent.wa) && /\/confirmation-parent\?j=7d3f1c2a-5b6e-4c8d-9a0b-1c2d3e4f5a6b/.test(parent.wa)
      && !/Nom du parent/.test(parent.infos), n + 'fiche d’une mineure : bloc « Parent ou tuteur » (non confirmé), message explicatif avec le lien prêt à partir sur le WhatsApp du parent, par e-mail aussi');
    // numéro du parent recopié de la candidate : WhatsApp s'ouvre sans destinataire, pour choisir le vrai parent ; « Copier le message »
    const sansNumero = await p.evaluate(() => { const b = document.querySelector('.bloc-parent .btn[href^="https://wa.me/"]'); return b && b.textContent; });
    ok(/Envoyer au parent par WhatsApp/.test(sansNumero || '') && await p.locator('.bloc-parent [data-action="dossier-parent-copier"]').textContent() === 'Copier le message', n + 'boutons : « Envoyer au parent par WhatsApp » et « Copier le message » (message complet)');
    ok(parent && JSON.stringify(parent.copies) === JSON.stringify(['nom', 'telephone', 'email', null]), n + 'coordonnées du parent recopiées de la candidate repérées (nom dans le désordre, numéro avec ou sans indicatif, e-mail) ; vrai parent au même nom de famille accepté');
    // « ⛶ Plein écran » : la vidéo couvre tout l'écran DANS l'Administration ; « Échap » / « ✕ Fermer » la remet en place.
    // Deux fois : avec le plein écran du navigateur, puis SANS (comme Safari sur iPhone : le calque seul doit couvrir l'écran)
    for (const sansNatif of [false, true]) {
      const m = n + (sansNatif ? '(sans plein écran du navigateur, comme iPhone) ' : '');
      if (sansNatif) await p.evaluate(() => { Element.prototype.requestFullscreen = undefined; });
      await p.click('.fiche-video [data-action="video-plein-ecran"]'); await p.waitForTimeout(500);
      const plein = await p.evaluate(() => { const f = document.querySelector('#video-plein-calque .lecteur-video'); if (!f) return null; const r = f.getBoundingClientRect(); return { l: r.width / innerWidth, h: r.height / innerHeight, url: location.href }; });
      ok(plein && plein.l > 0.9 && plein.h > 0.75 && /admin/.test(plein.url), m + 'plein écran : la vidéo couvre l’écran, on reste dans l’Administration');
      if (sansNatif) await p.click('#video-plein-calque [data-action="video-fermer"]'); else await p.keyboard.press('Escape');
      await p.waitForTimeout(400);
      ok(!(await p.$('#video-plein-calque')) && !(await p.evaluate(() => document.body.classList.contains('video-pleine') || !!document.fullscreenElement)), m + 'plein écran : « ' + (sansNatif ? 'Fermer' : 'Échap') + ' » remet la vidéo à sa place');
    }
    // retour arrière pendant le plein écran : le calque part et la page défile de nouveau
    await p.click('.fiche-video [data-action="video-plein-ecran"]'); await p.waitForTimeout(400);
    await p.evaluate(() => { location.hash = location.hash + '?x'; }); await p.waitForTimeout(300);
    ok(!(await p.$('#video-plein-calque')) && !(await p.evaluate(() => document.body.classList.contains('video-pleine'))), n + 'changement de page pendant le plein écran : la page défile de nouveau');
    await p.evaluate(() => { location.hash = location.hash.replace('?x', ''); }); await p.waitForTimeout(1500);
    await capture(p, 'fiche' + suffixe);
    // « Écrire sur WhatsApp » : message proposé, adressé au parent
    const wa1 = await p.getAttribute('#dos-wa-ouvrir', 'href');
    ok(/^https:\/\/wa\.me\/2250707070707\?text=/.test(wa1) && /Madame%20Ama%20M%C3%A8re/.test(wa1), n + '« Écrire sur WhatsApp » : message prêt, adressé au parent');
    const avecRdv = await p.$$eval('#dos-wa-modele option', (os) => os.map((o) => o.value));
    ok(avecRdv.length > 2 && avecRdv.includes('libre'), n + 'catalogue des messages proposé (' + avecRdv.length + ' modèles)');
    await p.fill('#dos-wa-texte', 'Bonjour Madame, petit essai.'); await p.waitForTimeout(200);
    ok(/petit%20essai/.test(await p.getAttribute('#dos-wa-ouvrir', 'href')), n + 'texte modifié : le lien WhatsApp suit');

    // 3. Statut « Retenue » : enregistré, e-mail automatique au parent, code d'inscription
    await p.click('.statuts .btn[data-statut="retenue"]'); await p.waitForTimeout(1500);
    const maj = ecrits(journal, 'PATCH', 'casting_applications').pop();
    const emails = journal.filter((j) => j[0] === 'EMAIL').map((j) => JSON.parse(j[1]).template_params);
    ok(maj && /"status":"retenue"/.test(maj[3]), n + 'statut « Retenue » enregistré');
    ok(emails.some((e) => e.to_email === 'mere@test.ci' && /Madame Ama Mère/.test(e.to_name) && !/\*/.test(e.message)), n + 'e-mail parti tout seul au parent, sans marques WhatsApp');
    ok(await p.isVisible('#dos-notif-texte') && /wa\.me\/2250707070707/.test(await p.getAttribute('#dos-notif-wa', 'href')) && /envoyé automatiquement/.test(await p.textContent('#dos-notif-statut')), n + 'message du nouveau statut modifiable, WhatsApp prêt, envoi confirmé');
    ok(/Retenue/.test(await p.textContent('.fiche-luxe-etiquettes > .pastille')), n + 'pastille de la fiche mise à jour');
    await p.waitForSelector('.code-zone'); await p.click('[data-action="dossier-code-creer"]'); await p.waitForTimeout(1000);
    ok(journal.some((j) => j[0] === 'rpc' && j[1] === 'code_individuel_creer') && /MA2M-ESSAI1/.test(await p.textContent('.code-zone')) && /wa\.me\/2250707070707/.test(await p.getAttribute('.code-zone a.btn', 'href')),
      n + 'code d’inscription créé, envoyable au parent par WhatsApp');

    // 4. Photos (chantier 11, 31/10/2026) : seule la candidate envoie ses photos ; l'agence les voit,
    //    les agrandit, peut en supprimer, mais ne peut plus en ajouter ni en remplacer
    ok((await p.$$('.photo-dossier')).length === 2 && !(await p.$('.galerie-dossier input[type=file]')) && !(await p.$('[data-action="dossier-photo-remplacer"]')) && !/Ajouter une photo|Remplacer/.test(await p.textContent('.galerie-dossier')),
      n + 'photos de la candidate visibles, plus d’ajout ni de remplacement par l’agence');
    await p.click('.photo-dossier [data-action="dossier-photo-voir"]'); await p.waitForTimeout(600);
    ok(await p.isVisible('#lightbox-global'), n + 'une photo s’agrandit toujours');
    await p.click('#lbg-fermer'); await p.waitForTimeout(400);
    ok(!journal.some((j) => j[0] === 'DRIVE') && !ecrits(journal, 'POST', 'casting_photos').length && !ecrits(journal, 'PATCH', 'casting_photos').length, n + 'aucune photo envoyée par l’agence');
    await p.click('.photo-dossier [data-action="dossier-photo-supprimer"]'); await p.waitForTimeout(1200);
    ok(ecrits(journal, 'DELETE', 'casting_photos').length === 1 && (await p.$$('.photo-dossier')).length === 1, n + 'photo supprimée après confirmation');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'fiche : textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'fiche : rien ne dépasse de l’écran');

    // 5. Supprimer le dossier : retour à la liste
    await p.click('[data-action="dossier-supprimer"]'); await p.waitForTimeout(1200);
    ok(ecrits(journal, 'DELETE', 'casting_applications').length === 1 && /#\/site\/b2-candidatures$/.test(p.url()), n + 'dossier supprimé, retour à la liste');

    // 5bis. Étudier les nouvelles une à une (11/11/2026, maquette validée par la propriétaire)
    // (17/11/2026, demande de la propriétaire) plus de bouton « Étudier » sur les candidatures (la fiche a le même affichage) ;
    // l'écran reste joignable par son adresse
    await p.goto(URL_ADMIN + '#/site/b2-candidatures'); await p.waitForSelector('.dossiers-grille, .carte.vide', { timeout: 15000 }); await p.waitForTimeout(600);
    ok(!(await p.$('.etude-lancer')), n + 'candidatures : plus de bouton « Étudier »');
    const nbNouvelles = Number(((await p.textContent('[data-filtre="nouvelle"] .nb')) || '1').trim());
    await p.goto(URL_ADMIN + '#/site/b2-candidatures/etude'); await p.waitForSelector('.etude-decision', { timeout: 15000 }); await p.waitForTimeout(800);
    const etude = await p.evaluate(() => ({ rang: document.querySelector('.etude-haut').innerText, nom: document.querySelector('.etude-voile b').textContent, choix: document.querySelectorAll('.etude-choix').length }));
    ok(new RegExp('1 / ' + nbNouvelles).test(etude.rang) && etude.nom && etude.choix === 3 && /#\/site\/b2-candidatures\/etude$/.test(p.url()),
      n + 'étudier : 1 / ' + nbNouvelles + ', ' + etude.nom + ' en grand, trois décisions');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'étudier : rien ne dépasse de l’écran');
    await capture(p, 'etude' + suffixe);
    const patchsAvant = ecrits(journal, 'PATCH', 'casting_applications').length;
    await p.click('.etude-choix.revoir');  // (« À revoir » : la suite de l'essai compte les « Retenue »)
    await p.waitForSelector('.etude-resultat', { timeout: 15000 }); await p.waitForTimeout(1500);
    const patch = ecrits(journal, 'PATCH', 'casting_applications').slice(patchsAvant).pop();
    ok(patch && /"status":"en étude"/.test(patch[3]) && /à revoir/.test(await p.textContent('.etude-resultat h2')) && await p.isVisible('#dos-notif-texte'),
      n + '« À revoir » : enregistré, « … à revoir plus tard », le message est prêt');
    ok(ecrits(journal, 'POST', 'messages_candidats').some((j) => /"sorte":"information"/.test(j[3]) && /"canal":"email"/.test(j[3]) && /"modele":"etude"/.test(j[3])), n + 'l’e-mail parti tout seul après la décision est noté dans le registre (information)');
    ok(!!(await p.$('#dos-notif-wa')) || /e-mail/i.test(await p.textContent('#dos-notif-statut')), n + 'après la décision : WhatsApp prêt ou e-mail envoyé');
    await capture(p, 'etude-decision' + suffixe);
    await p.click('.etude-suivant'); await p.waitForTimeout(1500);
    ok(nbNouvelles > 1 ? new RegExp('2 / ' + nbNouvelles).test(await p.textContent('.etude-haut')) : /étudiées/.test(await p.textContent('#contenu')), n + '« Candidature suivante » : la suivante s’affiche');
    await p.click('.etude-quitter'); await p.waitForSelector('.dossiers-grille, .carte.vide');
    ok(!(await p.$('.etude-lancer')), n + 'retour à la liste : toujours pas de bouton « Étudier » sur les candidatures');
    // (12/11/2026, « Les 2 » de la propriétaire) étudier une à une avec CHAQUE filtre : ici les « Retenue » ; le choix déjà
    // pris s'appelle « Garder » : rien n'est écrit, aucun message ne part
    await p.click('[data-action="dossiers-filtre"][data-filtre="retenue"]'); await p.waitForSelector('[data-filtre="retenue"][aria-pressed="true"]'); await p.waitForTimeout(800);
    { const nbRet = Number(((await p.textContent('[data-filtre="retenue"] .nb')) || '0').trim());
      ok(nbRet > 0, n + 'filtre « Retenue » (' + nbRet + ')');
      await p.goto(URL_ADMIN + '#/site/b2-candidatures/etude'); await p.waitForSelector('.etude-decision', { timeout: 15000 }); await p.waitForTimeout(800);
      const r = await p.evaluate(() => ({ haut: document.querySelector('.etude-haut').innerText, actuel: [...document.querySelectorAll('.etude-choix.actuel')].map((b) => b.dataset.statut + ':' + b.innerText.replace(/\s+/g, ' ').trim()), ligne: (document.querySelector('.etude-actuel') || {}).innerText || '' }));
      ok(new RegExp('Retenues · 1 / ' + nbRet).test(r.haut) && r.actuel.length === 1 && /^retenue:.*Garder/.test(r.actuel[0]) && /Retenue/.test(r.ligne), n + 'étude des retenues : « Retenues · 1 / ' + nbRet + ' », « Aujourd’hui : Retenue », choix « Garder »');
      await capture(p, 'etude-retenues' + suffixe);
      const avantGarder = ecrits(journal, 'PATCH', 'casting_applications').length + ecrits(journal, 'POST', 'functions').length;
      await p.click('.etude-choix.actuel'); await p.waitForSelector('.etude-resultat', { timeout: 15000 }); await p.waitForTimeout(1200);
      ok(ecrits(journal, 'PATCH', 'casting_applications').length + ecrits(journal, 'POST', 'functions').length === avantGarder && /rien ne change/.test(await p.textContent('.etude-resultat h2')) && !(await p.$('#dos-notif-texte')),
        n + '« Garder » : rien n’est écrit, aucun message, « rien ne change »');
      await p.click('.etude-quitter'); await p.waitForSelector('.dossiers-grille, .carte.vide');
      ok(await p.isVisible('[data-filtre="retenue"][aria-pressed="true"]'), n + '« Quitter » : retour sur le filtre « Retenue »'); }

    // 6. Demandes recruteurs
    await p.goto(URL_ADMIN + '#/site/b2-recruteurs'); await p.waitForSelector('.dossiers-grille'); await p.waitForTimeout(800);
    // (12/11/2026, « Les 2 » de la propriétaire) étudier les demandes une à une, en grand : mannequins choisis qui défilent,
    // réponse WhatsApp prête, deux décisions ; « Plus tard » enregistre « Vue » ; rien d'autre n'est écrit
    { ok(/Étudier (les \d+ nouvelles demandes|la nouvelle demande)/.test(await p.textContent('.etude-lancer')), n + 'recruteurs : bouton « ▶ Étudier la nouvelle demande »');
      await p.click('.etude-lancer'); await p.waitForSelector('.etude-decision', { timeout: 15000 }); await p.waitForTimeout(900);
      const r = await p.evaluate(() => ({ url: location.hash, haut: document.querySelector('.etude-haut').innerText, nom: document.querySelector('.etude-voile b').textContent,
        choisis: [...document.querySelectorAll('.etude-choisi-nom')].map((x) => x.textContent), choix: [...document.querySelectorAll('.etude-choix')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()),
        wa: (document.getElementById('etude-wa') || {}).href || '', infos: document.querySelector('.etude-infos').innerText, deborde: document.documentElement.scrollWidth > innerWidth + 1 }));
      ok(/b2-recruteurs\/etude$/.test(r.url) && /Nouvelles demandes · 1 \/ \d/.test(r.haut) && /Koffi Marc/.test(r.nom) && r.choisis.length === 2 && /AYA KOUASSI · 178 cm/.test(r.choisis.join('|')),
        n + 'étude recruteur : Koffi Marc en grand, ses 2 mannequins choisis défilent (' + r.choisis.join(', ') + ')');
      ok(r.choix.length === 2 && /Plus tard/.test(r.choix[0]) && /Traitée/.test(r.choix[1]) && /wa\.me\/2250505050505\?text=/.test(r.wa) && /Défilé/.test(r.infos) && !r.deborde,
        n + 'étude recruteur : « Plus tard » / « Traitée », réponse WhatsApp prête, projet affiché, rien ne dépasse');
      await capture(p, 'etude-recruteur' + suffixe);
      const avant = ecrits(journal, 'PATCH', 'recruiter_requests').length;
      await p.click('.etude-choix.revoir'); await p.waitForSelector('.etude-resultat', { timeout: 15000 }); await p.waitForTimeout(900);
      const pt = ecrits(journal, 'PATCH', 'recruiter_requests').slice(avant);
      ok(pt.length === 1 && /"status":"vue"/.test(pt[0][3]) && /à reprendre plus tard/.test(await p.textContent('.etude-resultat h2')) && !(await p.$('#dos-notif-texte')),
        n + 'étude recruteur : « Plus tard » enregistre « Vue », sans message automatique');
      await p.click('.etude-suivant'); await p.waitForTimeout(1200);
      ok(/étudi/i.test(await p.textContent('#contenu')) && await p.isVisible('.etude-fin'), n + 'étude recruteur : fin de la file');
      await p.click('.etude-quitter'); await p.waitForSelector('.dossiers-grille, .carte.vide'); await p.waitForTimeout(600);
      ok(/Aucune nouvelle demande à étudier/.test(await p.textContent('.etude-lancer')), n + 'recruteurs : « Aucune nouvelle demande à étudier » à la même place');
      await p.click('[data-action="dossiers-filtre"][data-filtre="toutes"]'); await p.waitForSelector('[data-filtre="toutes"][aria-pressed="true"]'); await p.waitForTimeout(800); }
    ok(/Koffi Marc.*Défilé.*Maison Ivoire/.test(await p.textContent('.dossier-carte')), n + 'demande recruteur listée (contact, projet, entreprise)');
    await p.click('.dossier-carte .dossier-lien'); await p.waitForSelector('.choisis'); await p.waitForTimeout(800);
    ok((await p.$$('.choisi')).length === 2 && (await p.$$('.choisi .vis img')).length === 2 && /AYA KOUASSI.*178 cm/.test(await p.textContent('.choisis')), n + 'mannequins choisis par le recruteur, avec leurs visages');
    ok(/wa\.me\/2250505050505/.test(await p.getAttribute('#dos-wa-ouvrir', 'href')), n + 'recruteur : WhatsApp prêt');
    await capture(p, 'recruteur' + suffixe);
    // annoncer la sélection du client et convoquer (24/10/2026) : projet créé avec ses mannequins
    await p.click('[data-action="dossier-recruteur-convoquer"]'); await p.waitForSelector('.voile #sel-titre');
    const proposes = await p.evaluate(() => ['sel-titre', 'sel-type', 'sel-date', 'sel-client'].map((id) => document.getElementById(id).value).join('|'));
    ok(proposes === 'Défilé · Maison Ivoire|defile|2026-12-05|Maison Ivoire', n + 'recruteur : « Annoncer la sélection et convoquer » propose le projet du client (' + proposes + ')');
    await p.click('form[data-form="selection-convoquer"] [type=submit]'); await p.waitForTimeout(1500);
    const projetClient = ecrits(journal, 'POST', 'agenda_projets').map((j) => JSON.parse(j[3] || 'null')).flat().pop() || {};
    ok(projetClient.client === 'Maison Ivoire' && projetClient.citer_client === true && projetClient.visible === false && JSON.stringify(projetClient.mannequin_ids) === '["m0","m1"]' && /#\/site\/b2-convocations$/.test(p.url()),
      n + 'recruteur : projet créé (client cité, caché du site, 2 mannequins), les Convocations s’ouvrent');
    await p.goBack(); await p.waitForSelector('.choisis'); await p.waitForTimeout(800);
    await p.click('.choisi [data-action="dossier-retirer-mannequin"]'); await p.waitForTimeout(800);
    ok(ecrits(journal, 'DELETE', 'recruiter_request_models').length === 1 && (await p.$$('.choisi')).length === 1, n + 'mannequin retiré de la sélection');
    // 7. Projets et castings : liste, ajout, modification, ordre
    await p.goto(URL_ADMIN + '#/site/b2-projets'); await p.waitForSelector('.projets-liste'); await p.waitForTimeout(800);
    const projets = await p.$$eval('.projet-carte', (cs) => cs.map((c) => c.innerText.replace(/\s+/g, ' ')));
    ok(projets.length === 2 && /CASTING CACAO.*Actif.*\d\d\/\d\d\/20\d\d.*Studio MA2M.*7 candidatures/.test(projets[0]) && /SHOOTING LAGUNE.*Inactif/.test(projets[1]), n + 'castings listés, actif / inactif, candidatures reçues');
    await p.click('[data-action="projet-nouveau"]'); await p.waitForSelector('.voile #pj-nom');
    await p.fill('#pj-nom', 'CASTING NOËL'); await p.fill('#pj-lieu', 'Hôtel Ivoire');
    await p.click('form[data-form="projet-ajouter"] [type=submit]'); await p.waitForTimeout(900);
    ok(ecrits(journal, 'POST', 'casting_projets').some((j) => /CASTING NOËL/.test(j[3]) && /Hôtel Ivoire/.test(j[3])), n + 'nouveau casting ajouté');
    await p.click('.projet-carte [data-action="projet-modifier"]'); await p.waitForSelector('.voile form');
    await p.fill('.voile #pj-description', 'Description modifiée.'); await p.click('.voile [type=submit]'); await p.waitForTimeout(900);
    ok(ecrits(journal, 'PATCH', 'casting_projets').some((j) => /Description modifiée/.test(j[3])) && !(await p.$('.voile')), n + 'casting modifié dans une fenêtre, sans petites questions successives');
    const avant = ecrits(journal, 'PATCH', 'casting_projets').length;
    await p.click('.projet-carte:nth-child(2) [data-action="projet-monter"]'); await p.waitForTimeout(900);
    ok(ecrits(journal, 'PATCH', 'casting_projets').length > avant, n + 'ordre d’affichage changé (▲)');
    await capture(p, 'projets' + suffixe);

    // 8. Messages groupés : même écran que l'ancien, dans la nouvelle maison
    await p.goto(URL_ADMIN + '#/site/b2-messages-groupes'); await p.waitForSelector('#mg-source'); await p.waitForTimeout(800);
    await p.selectOption('#mg-statut', 'retenue'); await p.click('#mg-charger'); await p.waitForTimeout(1200);
    ok((await p.$$('.mg-personne')).length === 1 && /YAO KOUASSI/.test(await p.textContent('#mg-liste')), n + 'Messages groupés : destinataires chargés (retenues de l’agence)');
    await p.evaluate(() => { window.open = () => null; });
    const mailsAvant = journal.filter((j) => j[0] === 'EMAIL').length;
    // (11/11/2026) trois étapes : À qui ? → Le message → Envoyer
    await p.click('.mg-etape[data-mg="1"] [data-mg-etape="2"]'); await p.waitForTimeout(300);
    ok(await p.isVisible('#mg-message') && !(await p.isVisible('#mg-charger')), n + 'Messages groupés : étape 2 « Le message » seule à l’écran');
    if (/\[à compléter\]/.test(await p.textContent('#mg-apercu').catch(() => ''))) { await p.fill('#mg-lieu', 'Studio MA2M'); }
    // (11/11/2026) « Ajouter une image » : l'image choisie, un lien « Voir l'affiche » dans l'e-mail, l'image dans l'application
    await p.setInputFiles('#mg-image input[type=file]', require('path').join(__dirname, 'medias/photo4.jpg'));
    await p.waitForSelector('#mg-image .ij-choisie img', { timeout: 15000 }).catch(() => {});
    ok(/Image jointe/.test(await p.textContent('#mg-image')), n + 'Messages groupés : image jointe depuis la galerie');
    await p.waitForTimeout(1500);  // (le bandeau « Envoi de la photo… » disparaît)
    await p.$eval('.mg-etape[data-mg="2"] [data-mg-etape="3"]', (b) => b.click()); await p.waitForTimeout(300);
    ok(/1 personne/.test(await p.textContent('#mg-resume-envoi')) && /avec l’image/.test(await p.textContent('#mg-resume-envoi')), n + 'Messages groupés : étape 3, le résumé (1 personne, avec l’image)');
    await p.click('#mg-email'); await p.waitForTimeout(2500);
    ok(journal.filter((j) => j[0] === 'EMAIL').length === mailsAvant + 1, n + 'Messages groupés : e-mail envoyé');
    await p.waitForTimeout(400);
    ok(ecrits(journal, 'POST', 'messages_candidats').some((j) => /"canal":"email"/.test(j[3]) && /"sorte":"(convocation|information|relance|libre)"/.test(j[3])), n + 'Messages groupés : l’e-mail est noté dans le registre de la candidate');
    const dernier = journal.filter((j) => j[0] === 'EMAIL').pop() || [];
    const appMg = journal.filter((j) => j[0] === 'rpc' && j[1] === 'app_messages_envoyer').map((j) => JSON.parse(j[2] || '{}')).pop() || {};
    ok(/Voir l’affiche/.test(String(dernier[1])) && /^https:\/\/.+\/site\/infos\/.+\.jpg$/.test(appMg.p_image || '') && !/Voir l’affiche/.test(appMg.p_texte || ''),
      n + 'Messages groupés : lien « Voir l’affiche » dans l’e-mail, image en grand dans l’application');
    await capture(p, 'messages-groupes' + suffixe);
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
