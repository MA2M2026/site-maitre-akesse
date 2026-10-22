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
    await p.click('.segments .btn[data-filtre="nouvelle"]'); await p.waitForTimeout(900);

    // 2. Fiche d'une mineure
    await p.click('.dossier-carte .dossier-lien[href$="/c4"]'); await p.waitForSelector('.fiche-tete'); await p.waitForTimeout(1200);
    const fiche = await p.evaluate(() => ({
      titre: document.querySelector('.fiche-tete').innerText.replace(/\s+/g, ' '),
      photos: document.querySelectorAll('.photo-dossier img').length,
      champs: document.querySelector('dl.champs').innerText.replace(/\s+/g, ' '),
      liens: [...document.querySelectorAll('dl.champs a')].map((a) => a.textContent + ' ' + a.href),
      message: (document.querySelector('.message-dossier') || {}).textContent
    }));
    ok(/PETITE AMA Mineure — 13 ans/.test(fiche.titre) && /Postule pour : CASTING CACAO/.test(fiche.titre), n + 'fiche : nom, âge de la mineure, casting visé');
    ok(fiche.photos === 2, n + 'fiche : les 2 photos de la candidate');
    ok(/mineur : écrire au parent/.test(fiche.champs) && fiche.liens.some((l) => /0707070707 ↗ WhatsApp https:\/\/wa\.me\/2250707070707/.test(l)) && fiche.liens.some((l) => /Voir la vidéo/.test(l)) && /rêve de défiler/.test(fiche.message),
      n + 'fiche : WhatsApp sur le numéro du parent, vidéo, message de la candidate');
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
    ok(/Retenue/.test(await p.textContent('.fiche-tete > .pastille')), n + 'pastille de la fiche mise à jour');
    await p.waitForSelector('.code-zone'); await p.click('[data-action="dossier-code-creer"]'); await p.waitForTimeout(1000);
    ok(journal.some((j) => j[0] === 'rpc' && j[1] === 'code_individuel_creer') && /MA2M-ESSAI1/.test(await p.textContent('.code-zone')) && /wa\.me\/2250707070707/.test(await p.getAttribute('.code-zone a.btn', 'href')),
      n + 'code d’inscription créé, envoyable au parent par WhatsApp');

    // 4. Photos : ajouter (vers Google Drive), supprimer
    await p.setInputFiles('.ajout-photo input[type=file]', require('path').join(__dirname, 'medias', 'photo1.jpg')); await p.waitForTimeout(1500);
    ok(journal.some((j) => j[0] === 'DRIVE') && ecrits(journal, 'POST', 'casting_photos').length === 1 && (await p.$$('.photo-dossier')).length === 3, n + 'photo ajoutée (Google Drive puis fiche) : 3 photos');
    await p.click('.photo-dossier [data-action="dossier-photo-supprimer"]'); await p.waitForTimeout(1200);
    ok(ecrits(journal, 'DELETE', 'casting_photos').length === 1 && (await p.$$('.photo-dossier')).length === 2, n + 'photo supprimée après confirmation');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'fiche : textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'fiche : rien ne dépasse de l’écran');

    // 5. Supprimer le dossier : retour à la liste
    await p.click('[data-action="dossier-supprimer"]'); await p.waitForTimeout(1200);
    ok(ecrits(journal, 'DELETE', 'casting_applications').length === 1 && /#\/site\/b2-candidatures$/.test(p.url()), n + 'dossier supprimé, retour à la liste');

    // 6. Demandes recruteurs
    await p.goto(URL_ADMIN + '#/site/b2-recruteurs'); await p.waitForSelector('.dossiers-grille'); await p.waitForTimeout(800);
    ok(/Koffi Marc.*Défilé.*Maison Ivoire/.test(await p.textContent('.dossier-carte')), n + 'demande recruteur listée (contact, projet, entreprise)');
    await p.click('.dossier-carte .dossier-lien'); await p.waitForSelector('.choisis'); await p.waitForTimeout(800);
    ok((await p.$$('.choisi')).length === 2 && (await p.$$('.choisi .vis img')).length === 2 && /AYA KOUASSI.*178 cm/.test(await p.textContent('.choisis')), n + 'mannequins choisis par le recruteur, avec leurs visages');
    ok(/wa\.me\/2250505050505/.test(await p.getAttribute('#dos-wa-ouvrir', 'href')), n + 'recruteur : WhatsApp prêt');
    await capture(p, 'recruteur' + suffixe);
    await p.click('.choisi [data-action="dossier-retirer-mannequin"]'); await p.waitForTimeout(800);
    ok(ecrits(journal, 'DELETE', 'recruiter_request_models').length === 1 && (await p.$$('.choisi')).length === 1, n + 'mannequin retiré de la sélection');
    // 7. Projets et castings : liste, ajout, modification, ordre
    await p.goto(URL_ADMIN + '#/site/b2-projets'); await p.waitForSelector('.projets-liste'); await p.waitForTimeout(800);
    const projets = await p.$$eval('.projet-carte', (cs) => cs.map((c) => c.innerText.replace(/\s+/g, ' ')));
    ok(projets.length === 2 && /CASTING CACAO.*Actif.*08\/11\/2026.*Studio MA2M.*7 candidatures/.test(projets[0]) && /SHOOTING LAGUNE.*Inactif/.test(projets[1]), n + 'castings listés, actif / inactif, candidatures reçues');
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
    if (/\[à compléter\]/.test(await p.textContent('#mg-apercu').catch(() => ''))) { await p.fill('#mg-lieu', 'Studio MA2M'); }
    await p.click('#mg-email'); await p.waitForTimeout(2500);
    ok(journal.filter((j) => j[0] === 'EMAIL').length === mailsAvant + 1, n + 'Messages groupés : e-mail envoyé');
    await capture(p, 'messages-groupes' + suffixe);
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
