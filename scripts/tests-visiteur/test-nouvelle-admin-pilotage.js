// Nouvelle Administration — groupe « Pilotage » et « Messages de contact » (js/admin/site-pilotage.js),
// essayé comme l'agence sur téléphone et ordinateur, base SIMULÉE (donnees-nouvelle-admin.js) : vue
// d'ensemble (8 cartes, alertes), À traiter (et pastilles du menu), Top 3 avec les visages, répartition
// des profils, évolution des candidatures, messages de contact avec WhatsApp. Rien n'est écrit ni
// envoyé pour de vrai. CAPTURES=dossier : captures d'écran.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9600 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/nouvelle/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const capture = (p, nom) => process.env.CAPTURES ? p.screenshot({ path: process.env.CAPTURES + '/' + nom + '.png', fullPage: true }) : null;
const texte = (p, sel) => p.evaluate((s) => document.querySelector(s).innerText.replace(/\s+/g, ' '), sel);

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
    await brancher(p, donnees('principal'), journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');

    // 1. Vue d'ensemble : les vrais chiffres de la base, chaque carte ouvre sa rubrique
    await p.goto(URL_ADMIN + '#/site/v2-ensemble'); await p.waitForSelector('.cartes-pilotage', { timeout: 10000 }); await p.waitForTimeout(2200);
    const cartes = await p.$$eval('.carte-pilotage', (l) => l.map((c) => c.innerText.replace(/\s+/g, ' ')));
    ok(cartes.length === 8, n + 'vue d’ensemble : 8 cartes');
    ok(/MANNEQUINS AU BOOK 12/i.test(cartes[0]) && /CANDIDATURES 4 3 nouvelles/i.test(cartes[1]) && /CASTINGS ACTIFS 1 prochain/i.test(cartes[2]), n + 'mannequins, candidatures, castings : chiffres justes (' + cartes.slice(0, 3).join(' | ') + ')');
    ok(/VISITES AUJOURD’HUI 37/i.test(cartes[3]) && /VISITES SUR 7 JOURS 412/i.test(cartes[4]), n + 'visites du jour et de la semaine');
    ok(/FICHES À VALIDER 1/i.test(cartes[7]), n + 'fiche à valider comptée');
    ok(/MESSAGES DE CONTACT 1 cette semaine/i.test(cartes[6]), n + 'messages de contact : seulement ceux de la semaine (' + cartes[6] + ')');
    const alertes = await texte(p, '.alertes');
    ok(/1 fiche mannequin à valider/.test(alertes) && /CASTING CACAO/.test(alertes) && /3 nouvelles candidatures/.test(alertes) && /1 demande recruteur non lue/.test(alertes), n + 'alertes : validation, prochain casting, candidatures, recruteur');
    ok(!/FCFA|F CFA/.test(await texte(p, '#contenu')), n + 'aucun chiffre d’argent dans le bloc 1');
    await capture(p, 'pilotage-ensemble' + suffixe);
    await p.click('.carte-pilotage[href$="b2-validations"]'); await p.waitForTimeout(1200);
    ok(/b2-validations$/.test(p.url()) && /NOUVELLE FACE/.test(await texte(p, '#contenu')), n + 'la carte « Fiches à valider » ouvre les validations');

    // 2. À traiter + pastilles du menu
    await p.goto(URL_ADMIN + '#/site/b1-a-traiter'); await p.waitForSelector('.taches'); await p.waitForTimeout(1500);
    const lignes = await p.$$eval('.taches .tache', (l) => l.map((c) => c.innerText.replace(/\s+/g, ' ')));
    ok(lignes.length === 3 && /5 actions en attente/.test(await texte(p, '.entete')), n + 'à traiter : 3 lignes, 5 actions (' + lignes.join(' | ') + ')');
    const pastilles = await p.$$eval('#menu-lateral a.nav .compteur', (l) => l.map((x) => x.closest('a').getAttribute('href').split('/')[2] + '=' + x.textContent));
    ok(pastilles.includes('b1-a-traiter=5') && pastilles.includes('b2-candidatures=3') && pastilles.includes('b2-validations=1'), n + 'pastilles du menu : ' + pastilles.join(', '));

    // 3. Top 3 et classement, avec les visages
    await p.goto(URL_ADMIN + '#/site/v2-top3'); await p.waitForSelector('.podium'); await p.waitForTimeout(2000);
    const podium = await p.$$eval('.podium-place', (l) => l.map((c) => c.innerText.replace(/\s+/g, ' ')));
    ok(podium.length === 3 && /1re place AYA KOUASSI 140 visites/i.test(podium[0]) && /2e place MARIAM TRAORÉ/i.test(podium[1]), n + 'podium : ' + podium.join(' | '));
    ok((await p.$$('.podium-place .vis img.charge')).length === 3 && (await p.$$('.classement-ligne')).length === 10, n + 'podium avec 3 visages, classement des 10');
    ok(/\+3 autres mannequins/.test(await texte(p, '#contenu')), n + 'mention des mannequins hors classement');
    await capture(p, 'pilotage-top' + suffixe);

    // 4. Répartition : 4 candidatures + 2 inscriptions (femmes 3, homme 1, enfants 2)
    await p.goto(URL_ADMIN + '#/site/b1-repartition'); await p.waitForSelector('.donut'); await p.waitForTimeout(800);
    const leg = await texte(p, '.legende-donut');
    ok(/Femmes 50 % \(3\)/.test(leg) && /Hommes 17 % \(1\)/.test(leg) && /Enfants \(moins de 18 ans\) 33 % \(2\)/.test(leg), n + 'répartition juste : ' + leg);
    await capture(p, 'pilotage-repartition' + suffixe);

    // 5. Évolution : courbe des 6 semaines
    await p.goto(URL_ADMIN + '#/site/b1-evolution'); await p.waitForSelector('#contenu .entete'); await p.waitForTimeout(1800);
    const courbe = await p.$('svg.courbe');
    ok(courbe && (await p.$$('svg.courbe circle')).length === 6 && /4 candidatures en 6 semaines/.test(await texte(p, '.entete')), n + 'évolution : courbe de 6 semaines, 4 candidatures');
    await capture(p, 'pilotage-evolution' + suffixe);

    // 6. Messages de contact : WhatsApp en un appui (numéro ivoirien complété), sinon rien d'inventé
    await p.goto(URL_ADMIN + '#/site/b2-contacts'); await p.waitForSelector('#contenu .entete'); await p.waitForTimeout(1200);
    const wa = await p.$$eval('#contenu a[href^="https://wa.me/"]', (l) => l.map((a) => a.getAttribute('href')));
    ok((await p.$$('#contenu .tache')).length === 2 && wa.length === 1 && /wa\.me\/2250707123456$/.test(wa[0]), n + 'messages de contact : 2 messages, WhatsApp ' + wa.join(','));
    await capture(p, 'pilotage-contacts' + suffixe);

    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    for (const page of ['v2-ensemble', 'v2-top3', 'b1-repartition']) {
      await p.goto(URL_ADMIN + '#/site/' + page); await p.waitForTimeout(1500);
      ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + page + ' : rien ne dépasse de l’écran');
      if (page !== 'b1-repartition') { const pl = await lirePageEntiere(p); ok(!pl.length, n + page + ' : textes lisibles ' + pl.slice(0, 3).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', ')); }
    }
    ok(!journal.some((j) => ['POST', 'PATCH', 'DELETE'].includes(j[0]) && j[1] !== 'audit_log'), n + 'rien n’est écrit dans la base en regardant les chiffres');
    ok(!(await p.$('.whatsapp-flottant')), n + 'pas de pastille publique « Nous contacter sur WhatsApp » dans l’Administration');
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
