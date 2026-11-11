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
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const capture = (p, nom) => process.env.CAPTURES ? p.screenshot({ path: process.env.CAPTURES + '/' + nom + '.png', fullPage: false }) : null;

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore', stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 860 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    await brancher(p, donnees('principal'), journal); await photosLocales(p);
    // services de fond demandés par la page (l'Administration n'enregistre que le sien : /admin/sw.js)
    // notifications du téléphone simulées : l'appareil n'a encore jamais répondu ; « Oui » les autorise
    await p.addInitScript(() => {
      window.__sw = [];
      const abonnement = { toJSON: () => ({ endpoint: 'https://push.essai/appareil-1', keys: { p256dh: 'cle-essai', auth: 'auth-essai' } }) };
      if (navigator.serviceWorker) navigator.serviceWorker.register = (u) => { window.__sw.push(String(u)); return Promise.resolve({ pushManager: { getSubscription: async () => null, subscribe: async () => abonnement } }); };
      window.PushManager = window.PushManager || function () {};
      window.Notification = { permission: 'default', requestPermission: async () => { window.Notification.permission = 'granted'; return 'granted'; } };
    });

    // 1. Entrée
    await p.goto(URL_ADMIN); await p.waitForSelector('#cx-mail');
    await capture(p, 'connexion-' + (tel ? 'tel' : 'pc'));
    ok(await p.isVisible('form[data-form="connexion"]'), n + 'page de connexion affichée');
    await seConnecter(p, URL_ADMIN);
    await p.waitForSelector('.accueil-tete', { timeout: 10000 }); await p.waitForTimeout(2200);
    await capture(p, 'accueil-' + (tel ? 'tel' : 'pc'));
    const sw = await p.evaluate(() => window.__sw);
    ok(!sw.includes('/service-worker.js') && !(await p.$('#pastille-installer')), n + 'pas de service de fond ni de pastille « Installer l’app » du site public dans l’Administration (' + sw.join(', ') + ')');
    // notifications (reprises de l'ancien tableau de bord, 23/10/2026) : invitation sur l'accueil, puis « Oui, activer »
    ok(await p.isVisible('#notif-invitation [data-action="notif-oui"]'), n + 'accueil : invitation « Activer les notifications » sur cet appareil');
    await p.click('#notif-invitation [data-action="notif-oui"]'); await p.waitForTimeout(800);
    const abo = journal.filter((j) => j[0] === 'POST' && j[1] === 'push_abonnements').map((j) => JSON.parse(j[3]))[0] || {};
    ok(!(await p.$('#notif-invitation')) && (await p.evaluate(() => window.__sw)).includes('/service-worker.js') && abo.endpoint === 'https://push.essai/appareil-1' && abo.actif === true,
      n + 'notifications activées : appareil inscrit (' + JSON.stringify(abo).slice(0, 90) + ')');
    // toucher une notification, Administration déjà ouverte : le service de fond demande d'ouvrir la fiche
    await p.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { ma2mOuvrir: '/admin/#/site/b2-contacts' } })));
    await p.waitForTimeout(800);
    ok(/#\/site\/b2-contacts$/.test(await p.evaluate(() => location.hash)), n + 'notification touchée : la rubrique concernée s’ouvre dans l’Administration déjà ouverte');
    await p.goto(URL_ADMIN); await p.waitForSelector('.accueil-tete', { timeout: 10000 }); await p.waitForTimeout(1500);

    // 2. Accueil apaisé (11/11/2026, maquette validée par la propriétaire) : bonjour, recherche, à faire, prochain
    // événement en une ligne, 8 tuiles au lieu des 45 rubriques
    const acc = await p.evaluate(() => ({
      tete: document.querySelector('.accueil-tete').innerText,
      affiche: (document.querySelector('.affiche') || {}).innerText || '',
      jauge: (document.querySelector('.affiche .jauge i') || {}).style ? document.querySelector('.affiche .jauge i').style.width : '',
      taches: [...document.querySelectorAll('.tache')].map((t) => t.innerText.replace(/\s+/g, ' ')),
      tuiles: [...document.querySelectorAll('.tuiles-accueil .tu .nom')].map((x) => x.textContent),
      rubriques: document.querySelectorAll('#contenu a.nav').length,
      // chaque rubrique du bloc 1 est rangée dans UNE tuile (aucune n'est perdue)
      rangement: (() => { const P = window.Portail, T = P.TUILES_SITE; return P.espaces.site.nav.filter((x) => x[0]).map((x) => x[0]).filter((k) => T.filter((t) => t.pages.includes(k) || t.plus.includes(k)).length !== 1); })(),
      deborde: document.documentElement.scrollWidth > innerWidth + 1
    }));
    ok(/Bonjour/.test(acc.tete) && /[a-z]+ \d{1,2} [a-zéû]+/i.test(acc.tete), n + 'bonjour et la date du jour (' + acc.tete.replace(/\n/g, ' ') + ')');
    ok(/Aujourd’hui/i.test(acc.affiche) && /ABIDJAN BORDER FORUM/.test(acc.affiche) && /2 sur 4 confirmées/i.test(acc.affiche) && acc.jauge === '50%', n + 'le projet du jour en une ligne, réponses 2 sur 4 et jauge à 50 %');
    ok(acc.taches.some((t) => /Candidatures à étudier.* 3$/.test(t)) && acc.taches.some((t) => /sans réponse.* 2$/.test(t)) && acc.taches.some((t) => /J’ai payé.* 2$/.test(t)), n + 'à faire aujourd’hui, avec les nombres (' + acc.taches.join(' | ') + ')');
    ok(acc.tuiles.join() === 'Castings,Mannequins,Événements,Messages,Paiements,Comptabilité,Le site,Réglages' && !acc.rubriques, n + '8 tuiles, plus de longue liste de rubriques (' + acc.tuiles.join(', ') + ')');
    ok(!acc.rangement.length, n + 'chaque rubrique est rangée dans une seule tuile ' + acc.rangement.join(','));
    ok(!acc.deborde, n + 'rien ne dépasse de l’écran');
    if (tel) ok(await p.isVisible('.onglets-bas') && (await p.$$eval('.onglets-bas a', (a) => a.map((x) => x.textContent))).join() === 'Accueil,Le site,Paiements,Compta', n + 'barre du bas : Accueil, Le site, Paiements, Compta');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'accueil : tous les textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    // la recherche : une rubrique, puis une mannequin par son nom
    await p.fill('#av-recherche', 'convoc'); await p.waitForTimeout(500);
    ok(/Convocations/.test(await p.textContent('#av-resultats')), n + 'recherche « convoc » : la rubrique Convocations');
    const nomCherche = await p.evaluate(async () => { const r = await sb.from('model_profiles').select('full_name').eq('published', true).limit(1); return ((r.data || [])[0] || {}).full_name || ''; });
    await p.fill('#av-recherche', nomCherche.split(' ').slice(-1)[0]); await p.waitForTimeout(900);
    ok(!!nomCherche && (await p.textContent('#av-resultats')).includes(nomCherche) && !!(await p.$('#av-resultats a[href^="#/site/b2-mannequins-publies/"]')), n + 'recherche d’une mannequin par son nom (' + nomCherche + ')');
    await p.fill('#av-recherche', '');

    // 2bis. (11/11/2026) « Envoyer un message » : une seule question, « Que voulez-vous envoyer ? »
    await p.click('.av-envoyer'); await p.waitForSelector('.tu-envois'); await p.waitForTimeout(600);
    const envois = await p.$$eval('.tu-envoi', (l) => l.map((a) => a.getAttribute('href')));
    ok(/Que voulez-vous envoyer/.test(await p.textContent('#contenu')) && envois.join() === '#/site/b2-convocations,#/site/b2-selection,#/site/b2-rappel,#/site/b2-infos,#/site/b2-messages-groupes',
      n + '« Envoyer un message » : une question, cinq réponses (convoquer, sélection, rappel, information, candidates)');
    if (tel) await capture(p, 'envoyer-tel');
    await p.click('.tu-envoi[href="#/site/b2-rappel"]'); await p.waitForSelector('#ecran-convocations', { timeout: 15000 }); await p.waitForTimeout(800);
    ok(/Rappeler l’information/.test(await p.textContent('#ecran-convocations h2')), n + '« Rappeler un événement » ouvre le bon écran, le rappel déjà choisi');
    await p.goto(URL_ADMIN); await p.waitForSelector('.accueil-tete'); await p.waitForTimeout(800);

    // 3. Une tuile : ses rubriques utiles, « Plus d'outils », puis une rubrique et le menu de SA tuile
    await p.click('.tu[href="#/site/tuile-mannequins"]'); await p.waitForSelector('.tu-page'); await p.waitForTimeout(1500);
    ok(/Mannequins/.test(await p.textContent('.tu-tete')) && (await p.$$('.tu-page > .tu-liste .tu-ligne')).length === 5 && (await p.$$('.tu-visage img')).length >= 4 && !(await p.isVisible('.tu-plus .tu-ligne')),
      n + 'tuile Mannequins : les visages, 5 rubriques utiles, les outils rares repliés');
    await p.click('.tu-plus summary');
    ok(await p.isVisible('.tu-plus .tu-ligne[href="#/site/b2-tri-photos"]'), n + '« Plus d’outils » s’ouvre');
    if (tel) await capture(p, 'tuile-tel');
    await p.click('.tu-retour'); await p.waitForSelector('.accueil-tete');
    await p.click('.tu[href="#/site/tuile-castings"]'); await p.waitForSelector('.tu-page');
    await p.click('.tu-ligne[href="#/site/b2-candidatures"]'); await p.waitForTimeout(800);
    ok(p.url().endsWith('#/site/b2-candidatures') && /Administration du site/.test(await p.textContent('.haut .bloc-actuel')), n + 'tuile Castings › Candidatures : la rubrique s’ouvre');
    if (tel) {
      ok(!(await p.isVisible('#menu-lateral .nav')), n + 'menu des rubriques rangé');
      await p.click('.onglets-bas [data-action="menu-ouvrir"]'); await p.waitForTimeout(500);
      await capture(p, 'tiroir-tel');
    }
    const menu = await p.$$eval('#menu-lateral a.nav', (l) => l.map((a) => a.getAttribute('href')));
    ok(menu.includes('#/site/b2-projets') && menu.includes('#/site/tuile-castings') && !menu.includes('#/site/b2-presences') && menu.length <= 12,
      n + 'menu de la rubrique : seulement les rubriques de la tuile Castings (' + menu.length + ')');
    await p.click('#menu-lateral a.nav[href="#/site/b2-projets"]'); await p.waitForTimeout(700);
    ok(p.url().endsWith('#/site/b2-projets') && !(await p.isVisible('#menu-lateral a.nav[href="#/site/b2-projets"]')) === tel, n + 'une rubrique choisie dans le menu' + (tel ? ', le tiroir se referme' : ''));
    ok(!(await p.$('iframe')), n + 'aucun cadre vers l’ancien tableau de bord');

    // 4. Blocs 2 et 3 dans la nouvelle décoration
    // photos en médaillon partout où le nom mène à la fiche, cliquables (demande du 22/10/2026)
    const visages = (sel) => p.$$eval(sel + ' .visage-lien .vis', (l) => l.map((v) => !!(v.querySelector('img'))));
    // (11/11/2026) Paiements et Comptabilité : une page d'entrée, rubriques groupées ; chacune rangée dans UN groupe
    for (const bloc of ['paiements', 'compta']) {
      await p.goto(URL_ADMIN + '#/' + bloc + '/accueil'); await p.waitForSelector('.tu-page', { timeout: 15000 }); await p.waitForTimeout(800);
      const r = await p.evaluate((b) => { const P = window.Portail, G = P.GROUPES_BLOCS[b]; const cles = P.espaces[b].nav.filter((x) => x[0] && x[0] !== 'accueil').map((x) => x[0]);
        return { lignes: document.querySelectorAll('.tu-page .tu-ligne').length, titres: [...document.querySelectorAll('.tu-question')].map((h) => h.textContent), seules: cles.filter((k) => G.filter((g) => g.pages.includes(k) || g.plus.includes(k)).length !== 1) }; }, bloc);
      ok(r.lignes >= 10 && r.titres.length >= 3 && !r.seules.length && !r.titres.some((x) => /Autres/.test(x)), n + bloc + ' : page d’entrée, rubriques groupées (' + r.titres.join(', ') + ') ' + r.seules.join(','));
    }
    if (!tel) await capture(p, 'compta-entree-pc');
    await p.goto(URL_ADMIN + '#/paiements/registre'); await p.waitForTimeout(2000);
    const vr = await visages('#contenu');
    ok(vr.length === 6 && vr.filter(Boolean).length === 3, n + 'registre : photos en médaillon pour les 3 inscrites, initiales pour les autres (' + vr + ')');
    ok(/paiements/i.test(await p.textContent('.haut .bloc-actuel')) && await p.isVisible('.contenu .tableau, .contenu .carte'), n + 'bloc 2 (paiements) affiché dans la nouvelle maison');
    await capture(p, 'paiements-' + (tel ? 'tel' : 'pc'));
    const palesP = await lirePageEntiere(p);
    ok(!palesP.length, n + 'paiements : textes lisibles ' + palesP.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    // Tableau du mois : la photo du Book en médaillon devant le nom (initiales pour les non-inscrits)
    await p.goto(URL_ADMIN + '#/paiements/tableau'); await p.waitForSelector('.visage-lien', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(1500);
    const medaillons = await p.$$eval('#contenu .visage-lien .vis', (l) => l.map((v) => !!(v.querySelector('img.charge') && v.querySelector('img').naturalWidth)));
    ok(medaillons.length === 6 && medaillons.filter(Boolean).length === 3, n + 'tableau du mois : photos en médaillon pour les 3 inscrites, initiales pour les autres (' + medaillons + ')');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'tableau du mois : rien ne dépasse');
    await capture(p, 'tableau-mois-' + (tel ? 'tel' : 'pc'));
    // la photo s'ouvre comme le nom : la fiche de la mannequin
    await p.click('#contenu .visage-lien'); await p.waitForTimeout(800);
    ok(/#\/paiements\/fiche\//.test(await p.evaluate(() => location.hash)), n + 'toucher la photo ouvre la fiche de la mannequin');
    for (const [page, nom] of [['matrice', 'paiements mois par mois'], ['mensualites', 'appel du mois'], ['messages', 'destinataires des messages'], ['a-valider', 'paiements à valider']]) {
      await p.goto(URL_ADMIN + '#/paiements/' + page); await p.waitForTimeout(1800);
      const v = await visages('#contenu');
      ok(v.length >= 2 && v.some(Boolean), n + nom + ' : photos en médaillon (' + v.length + ')');
    }
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'avec les photos, rien ne dépasse');
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
