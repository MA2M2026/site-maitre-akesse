// Nouvelle Administration — Convocations (même écran et même logique que l'ancien tableau de bord :
// js/convocations-gabarit.js, js/convocations-page.js, js/convocations-admin.js), essayées comme
// l'agence sur téléphone et ordinateur, base SIMULÉE : projet du jour, mur de visages (toucher un
// visage le choisit), enregistrement, panneau d'envoi, e-mails partis, bouton « WhatsApp suivant »,
// « Voir les réponses ». Rien n'est envoyé pour de vrai. CAPTURES=dossier : captures d'écran.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9500 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const capture = (p, nom) => process.env.CAPTURES ? p.screenshot({ path: process.env.CAPTURES + '/' + nom + '.png' }) : null;
const ecrits = (journal, m, table) => journal.filter((j) => j[0] === m && j[1] === table).map((j) => JSON.parse(j[3] || 'null'));

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore', stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
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
    // l'affiche du projet du jour ouvre SON projet dans les Convocations (11/11/2026 : parcours en étapes)
    await p.click('.affiche'); await p.waitForSelector('#ecran-convocations[data-vue="parcours"]', { timeout: 10000 }); await p.waitForTimeout(1500);
    ok(/#\/site\/b2-convocations$/.test(p.url()) && /ABIDJAN BORDER FORUM/.test(await p.textContent('#cv-titre-projet')) && await p.isVisible('#cv-titre'),
      n + 'l’affiche du jour ouvre son projet, à l’étape 1 « Projet »');
    // retour aux billets des projets à venir, puis le projet touché
    await p.click('#cv-retour'); await p.waitForSelector('.cv-billet'); await p.waitForTimeout(800);
    const billets = await p.$$eval('.cv-billet', (l) => l.map((b) => b.innerText.replace(/\s+/g, ' ')));
    ok(billets.length === 2 && billets.some((t) => /ABIDJAN BORDER FORUM/.test(t)) && billets.some((t) => /SHOOTING CACAO/.test(t)) && (await p.$$('.cv-billet .cv-billet-vis .vis img')).length >= 2,
      n + 'les projets à venir en billets, avec les visages (' + billets.length + ')');
    if (!tel) await capture(p, 'convocations-billets' + suffixe);
    await p.click('.cv-billet[data-cv-projet="p1"]'); await p.waitForSelector('#ecran-convocations[data-vue="parcours"]'); await p.waitForTimeout(800);
    ok(!(await p.isVisible('#cv-mannequins')) && !(await p.isVisible('#convoc-programmer')) && !(await p.isVisible('#cv-ajouter-etape')),
      n + 'étape 1 : seulement l’essentiel (les mannequins, l’envoi et les détails sont rangés)');
    await p.fill('#cv-heure-convocation', '15:00');
    // (11/11/2026) « Ajouter une image » : l'affiche choisie dans la galerie, envoyée (stockage simulé), puis gardée avec le projet
    await p.click('#cv-affiche-titre');
    ok(/Ajouter une image depuis la galerie/.test(await p.textContent('#cv-affiche')), n + 'case « Affiche ou photo » : « ＋ Ajouter une image depuis la galerie »');
    await p.setInputFiles('#cv-affiche input[type=file]', require('path').join(__dirname, 'medias/photo4.jpg'));
    await p.waitForSelector('#cv-affiche .ij-choisie img', { timeout: 15000 }).catch(() => {});
    ok(/Image jointe/.test(await p.textContent('#cv-affiche')) && !!(await p.$('#cv-affiche [data-ij="retirer"]')) && /jointe ✓/.test(await p.textContent('#cv-affiche-titre')),
      n + 'affiche choisie : aperçu, « Changer » et « Retirer », « jointe ✓ » dans le titre');
    await capture(p, 'convocations-etape1' + suffixe);
    // étape 2 : le mur de visages
    await p.click('.cv-suite [data-aller-etape="2"]'); await p.waitForTimeout(400);
    const mur = await p.evaluate(() => ({ visages: document.querySelectorAll('#cv-mannequins.mur-visages .choix-visage .vis img').length, coches: document.querySelectorAll('#cv-mannequins input:checked').length }));
    ok(await p.isVisible('#cv-mannequins') && !(await p.isVisible('#cv-titre')) && mur.visages === 12 && mur.coches === 4, n + 'étape 2 : mur de visages, 12 mannequins, les 4 du projet déjà choisies');
    await p.locator('.choix-visage', { hasText: 'SARAH KONAN' }).click(); await p.waitForTimeout(300);
    ok((await p.$$('#cv-mannequins input:checked')).length === 5 && /5 mannequins choisis/.test(await p.textContent('#cv-compte')), n + 'toucher un visage le choisit (5 choisies)');
    await p.fill('#cv-recherche', 'grâce'); await p.waitForTimeout(200);
    ok((await p.$$eval('.choix-visage', (ls) => ls.filter((l) => !l.hidden).length)) === 1, n + 'recherche par nom dans le mur');
    await p.fill('#cv-recherche', '');
    await capture(p, 'convocations-mur' + suffixe);
    await p.click('#cv-enregistrer'); await p.waitForTimeout(2200);
    const maj = ecrits(journal, 'PATCH', 'agenda_projets').find((x) => x.heure_convocation) || {};
    const urlAffiche = (ecrits(journal, 'PATCH', 'agenda_projets').find((x) => 'affiche' in x) || {}).affiche || '';
    ok(/^https:\/\/photos\.maitreakessemodelmanagement\.com\/site\/infos\/.+\.jpg$/.test(urlAffiche), n + 'affiche gardée avec le projet (' + urlAffiche.slice(-30) + ')');
    ok(maj.heure_convocation === '15:00' && (maj.mannequin_ids || []).length === 5, n + 'projet enregistré avec l’heure et les 5 mannequins');
    ok(await p.isVisible('#convoc-participants') && !(await p.isVisible('#convoc-programmer')) && (await p.$$('#convoc-participants .convoc-personne')).length === 5 && await p.isVisible('#convoc-apercu'),
      n + 'enregistré : étape 3 « Message », 5 participants et l’aperçu du message');
    await capture(p, 'convocations-message' + suffixe);
    await p.click('.cv-etape[data-etape="3"] [data-aller-etape="4"]'); await p.waitForTimeout(400);
    ok(/à 5 personnes/.test(await p.textContent('#cv-resume-envoi')) && /E-mail ✓/.test(await p.textContent('#cv-resume-envoi')) && /Avec l’affiche/.test(await p.textContent('#cv-resume-envoi')) && await p.isVisible('#convoc-programmer'),
      n + 'étape 4 « Envoi » : le résumé (à 5 personnes, e-mail, avec l’affiche) et le bouton d’envoi');
    await p.click('#convoc-programmer');
    for (let i = 0; i < 40 && !/envoyé\(s\) sur/.test(await p.textContent('#convoc-msg')); i++) await p.waitForTimeout(400);
    const mails = journal.filter((j) => j[0] === 'EMAIL').length;
    ok(mails === 5 && /5 e-mail\(s\) envoyé\(s\) sur 5/.test(await p.textContent('#convoc-msg')), n + '5 e-mails partis, bilan affiché');
    ok(journal.filter((j) => j[0] === 'EMAIL').every((j) => String(j[1]).includes('Voir l’affiche') && String(j[1]).includes(urlAffiche)), n + 'chaque e-mail porte le lien « Voir l’affiche »');
    const app = journal.filter((j) => j[0] === 'rpc' && j[1] === 'app_messages_envoyer').map((j) => JSON.parse(j[2] || '{}')).pop() || {};
    ok(app.p_image === urlAffiche && (app.p_cles || []).length === 5 && /(Sélection|Convocation) : ABIDJAN BORDER FORUM/.test(app.p_titre) && !/Voir l’affiche/.test(app.p_texte || ''),
      n + 'la convocation part aussi dans l’application des 5 mannequins, l’affiche en grand (' + (app.p_cles || []).length + ')');
    ok(/Envoyer le WhatsApp suivant.*5 restants/.test(await p.textContent('.convoc-suivant')), n + 'bouton « WhatsApp suivant » (5 restants)');
    await p.locator('.convoc-suivant').scrollIntoViewIfNeeded(); await capture(p, 'convocations-suivi' + suffixe);
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran');
    // l'onglet Réponses : les trois chiffres
    await p.click('[data-cv-onglet="reponses"]'); await p.waitForTimeout(500);
    ok(await p.isVisible('#convoc-reponses') && !(await p.isVisible('#convoc-programmer')) && (await p.$$('#convoc-reponses .convoc-tuiles span')).length === 3 && /Réponses · \d+\/5/.test(await p.textContent('#cv-onglet-reponses')),
      n + 'onglet « Réponses » : les trois chiffres, « Réponses · x/5 »');
    await capture(p, 'convocations-reponses' + suffixe);
    // les réponses d'un projet passé, depuis la liste
    await p.click('#cv-retour'); await p.waitForSelector('.cv-billet');
    await p.click('#cv-voir-reponses'); await p.waitForTimeout(1000);
    ok(await p.isVisible('#cv-reponses-projet'), n + '« Réponses d’un projet passé » s’ouvre');
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
