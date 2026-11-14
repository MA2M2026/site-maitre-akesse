// « Mon programme » de l'Atelier talons (programme-talons.html, 14/11/2026) comme une élève qui ouvre le lien reçu sur
// WhatsApp, sur téléphone et ordinateur, base SIMULÉE : nom avec « Madame » (vouvoiement), carte d'élève, prochaine
// séance, calendrier (flèches d'un mois à l'autre), séances, lieu, « Ajouter à mon calendrier » (vrai fichier .ics :
// les séances à venir et un rappel la veille), WhatsApp prérempli ; mauvais lien et paiement pas validé : message clair.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const fs = require('fs');
const PORT = String(9500 + Math.floor(Math.random() * 90));
const BASE = 'http://127.0.0.1:' + PORT + '/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const J = 'a1'.repeat(18), J_PRIVE = 'b2'.repeat(18), J_ATTENTE = 'c3'.repeat(18);
// 4 dimanches… ici : demain puis chaque semaine, 15 h – 18 h (Abidjan = UTC) ; une séance de la veille déjà faite
const jour = (n, h) => { const d = new Date(); d.setUTCHours(h, 0, 0, 0); d.setUTCDate(d.getUTCDate() + n); return d.toISOString(); };
const THEMES = ['Posture et équilibre', 'Démarche et port de tête', 'Fluidité et tours', 'Le défilé final'];
const groupe = { nom: 'Awa Koné', civilite: 'Madame', formule: 'groupe', nb_seances: 4, statut: 'inscrite', numero: 'TAL-AB12CD',
  seances: [-6, 1, 8, 15].map((n, i) => ({ id: 'seance-' + i, debut: jour(n, 15), fin: jour(n, 18), lieu: 'Salle MA2M, Riviera Faya', theme: THEMES[i], faite: i === 0 })) };
// (14/11/2026) groupe sur 3 mois, payé mois par mois : 1 mois réglé sur 3, « Mademoiselle » choisie
const J_MOIS = 'd4'.repeat(18);
const mois3 = { nom: 'Fatou Bamba', civilite: 'Mademoiselle', formule: 'groupe', nb_seances: 4, nb_mois: 3, mois_payes: 1, paiement: 'mensuel', prix_mois: 30000, titres_mois: { 1: 'Les bases', 2: 'L’assurance', 3: 'La prestance', 7: 'Perfectionnement' }, statut: 'inscrite', numero: 'TAL-MO1S3X',
  seances: Array.from({ length: 12 }, (_, i) => ({ id: 'm' + i, debut: jour(1 + 7 * i, 15), fin: jour(1 + 7 * i, 18), lieu: 'Salle MA2M, Riviera Faya', mois: Math.floor(i / 4) + 1, theme: THEMES[i % 4], faite: false }))
    // un rattrapage ajouté à la main par l'agence (sans mois) : jamais « à régler »
    .concat([{ id: 'rattrapage', debut: jour(2, 15), fin: jour(2, 17), lieu: 'Salle MA2M, Riviera Faya', theme: 'Rattrapage', faite: false }])
    .sort((a, b) => (a.debut < b.debut ? -1 : 1)) };
// (14/11/2026) privé, « j'ai déjà la base » : ses séances suivent SES thèmes (Les tenues), titre du thème au-dessus
const J_BASE = 'e5'.repeat(18);
const priveBase = { nom: 'Aminata Base', civilite: 'Madame', formule: 'prive_salle', nb_seances: 4, statut: 'inscrite', numero: 'TAL-BASE01', parcours: 'base', modules: [5],
  titres_mois: { 5: 'Les tenues', 7: 'Perfectionnement' }, seances: [['Robe longue et traîne', 2], ['Tailleur et tenue courte', 4]].map((x, i) => ({ id: 'b' + i, module: 5, debut: jour(x[1], 10), fin: jour(x[1], 12), lieu: 'Salle MA2M, Riviera Faya', theme: x[0], faite: false })) };
const prive = { nom: 'Petite Aya', civilite: 'Mademoiselle', formule: 'prive_salle', nb_seances: 2, statut: 'inscrite', numero: 'TAL-EF34GH', seances: [] };

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, vp] of [['téléphone', { width: 375, height: 667 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 700, hasTouch: vp.width < 700, acceptDownloads: true });
    const p = await ctx.newPage(); const journal = [], errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    await brancher(p, { tables: {}, rpc: { programme_talons_lire: (x) => x.p_jeton === J ? groupe : x.p_jeton === J_PRIVE ? prive : x.p_jeton === J_MOIS ? mois3 : x.p_jeton === J_BASE ? priveBase : null } }, journal);
    const n = nom + ' : ';
    await p.goto(BASE + 'programme-talons.html?c=' + J); await p.waitForSelector('#pt-contenu:not([hidden])', { timeout: 8000 });
    ok(/Bienvenue,\s*Madame Awa Koné/.test(await p.textContent('#pt-titre')), n + 'vouvoiement : « Bienvenue, Madame Awa Koné »');
    ok(/TAL-AB12CD/.test(await p.textContent('#pt-numero')) && /Formule en groupe · 4 séances/.test(await p.textContent('#pt-formule')), n + 'carte d’élève : numéro, formule, 4 séances');
    ok((await p.textContent('#pt-faites')) === '1 / 4' && (await p.textContent('#pt-horaire')) === '15 h – 18 h', n + 'carte d’élève : 1 séance faite sur 4, 15 h – 18 h');
    ok(/Votre prochaine séance, c’est demain/.test(await p.textContent('#pt-proch-titre')) && /15 h · Salle MA2M/.test(await p.textContent('#pt-proch-detail')), n + 'prochaine séance : demain, 15 h, salle');
    ok(await p.$$eval('.pt-seance', (l) => l.length) === 4 && await p.$$eval('.pt-seance.proche', (l) => l.length) === 1 && /faite ✓/.test(await p.textContent('.pt-seance.faite')), n + 'les 4 séances, la prochaine en avant, la première cochée « faite »');
    ok(/Démarche et port de tête/.test(await p.textContent('.pt-seance.proche')) && /Séance 2 · demain/.test(await p.textContent('.pt-seance.proche')), n + 'la prochaine : séance 2, « Démarche et port de tête », demain');
    ok(await p.$$eval('#pt-cal .d.cours:not(.hors)', (l) => l.length) >= 1 && await p.$$eval('#pt-cal .d.auj', (l) => l.length) <= 1, n + 'calendrier : jours de cours en rouge');
    // flèches : on peut aller jusqu'au mois de la première et de la dernière séance, pas au-delà
    let pas = 0; while (!(await p.$eval('#pt-avant', (e) => e.disabled)) && pas < 3) { await p.click('#pt-avant'); pas++; }
    ok(await p.$eval('#pt-avant', (e) => e.disabled), n + 'flèche « mois précédent » arrêtée au mois de la première séance');
    pas = 0; while (!(await p.$eval('#pt-apres', (e) => e.disabled)) && pas < 3) { await p.click('#pt-apres'); pas++; }
    ok(await p.$eval('#pt-apres', (e) => e.disabled), n + 'flèche « mois suivant » arrêtée au mois de la dernière séance');
    ok((await p.textContent('#pt-lieu')) === 'Salle MA2M, Riviera Faya' && /Riviera%20Faya/.test(await p.getAttribute('#pt-itineraire', 'href')) && /Arrivée à 14 h 45/.test(await p.textContent('#pt-arrivee')), n + 'le jour J : lieu, itinéraire, arrivée à 14 h 45');
    const wa = await p.getAttribute('#pt-wa', 'href');
    ok(wa.startsWith('https://wa.me/2250545656687?text=') && /Madame Awa Kon/.test(decodeURIComponent(wa)) && /TAL-AB12CD/.test(decodeURIComponent(wa)), n + 'WhatsApp : message prêt avec son nom et son numéro');
    ok(/Les 3 séances s’ajoutent/.test(await p.textContent('#pt-ics-note')), n + '« Ajouter à mon calendrier » : les 3 séances à venir');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pt-ics')]);
    const ics = fs.readFileSync(await dl.path(), 'utf8');
    ok(dl.suggestedFilename() === 'atelier-talons-ma2m.ics' && /^BEGIN:VCALENDAR\r\n/.test(ics) && /END:VCALENDAR\r\n$/.test(ics), n + 'fichier .ics bien formé');
    ok((ics.match(/BEGIN:VEVENT/g) || []).length === 3 && (ics.match(/TRIGGER:-P1D/g) || []).length === 3 && /DTSTART:\d{8}T150000Z/.test(ics) && /DTEND:\d{8}T180000Z/.test(ics), n + '.ics : 3 séances à venir, 15 h – 18 h, rappel la veille');
    ok(/LOCATION:Salle MA2M\\, Riviera Faya\\, Abidjan/.test(ics) && /SUMMARY:Atelier talons MA2M · Séance 2 · Démarche et port de tête/.test(ics), n + '.ics : lieu et titre de chaque séance (virgules échappées)');
    ok(/UID:talons-seance-1@/.test(ics) && /UID:talons-seance-3@/.test(ics), n + '.ics : chaque séance garde son identifiant (un 2e téléchargement remplace au lieu de doubler)');
    ok(ics.split('\r\n').every((l) => Buffer.byteLength(l, 'utf8') <= 75) && /\r\n /.test(ics), n + '.ics : lignes de 75 octets au plus, repliées comme le veut la norme');
    const deplie = ics.replace(/\r\n /g, '');
    ok(/DESCRIPTION:Madame Awa Koné : arrivée 15 minutes avant/.test(deplie), n + '.ics : description intacte une fois dépliée (accents compris)');
    ok(/Ouvrez le fichier/.test(await p.textContent('#pt-ics-note')), n + 'après le clic : comment ajouter les séances');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), n + 'rien ne dépasse de l’écran');
    if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + '/programme-talons-' + vp.width + '.png', fullPage: true });
    // groupe sur 3 mois, payé mois par mois
    await p.goto(BASE + 'programme-talons.html?c=' + J_MOIS); await p.waitForSelector('#pt-contenu:not([hidden])', { timeout: 8000 });
    ok(/Mademoiselle Fatou Bamba/.test(await p.textContent('#pt-titre')) && /3 mois pour marcher/.test(await p.textContent('#pt-accroche')), n + '3 mois : « Mademoiselle » (son choix), « 3 mois pour marcher avec assurance »');
    ok(/Formule en groupe · 3 mois · 13 séances/.test(await p.textContent('#pt-formule')) && (await p.textContent('#pt-paiement')) === '1 / 3 mois', n + 'carte d’élève : 3 mois, 13 séances (un rattrapage), 1 / 3 mois payés');
    const tetes = await p.$$eval('.pt-mois-tete', (l) => l.map((x) => x.textContent));
    ok(tetes.length === 3 && tetes[0] === 'Mois 1 · Les bases' && /Mois 2 · L’assurance · à régler \(30\s000\sFCFA\)/.test(tetes[1]) && await p.$$eval('.pt-seance.a-regler', (l) => l.length) === 8, n + 'séances rangées par mois ; mois 2 et 3 « à régler » (' + tetes.join(' | ') + ')');
    ok(!(await p.getAttribute('.pt-seance:has-text("Rattrapage")', 'class')).includes('a-regler'), n + 'rattrapage ajouté à la main : jamais « à régler »');
    ok(/Les 5 séances s’ajoutent.*Les mois suivants s’ajouteront une fois réglés/.test(await p.textContent('#pt-ics-note')), n + 'calendrier du téléphone : seulement le mois réglé');
    const [dl3] = await Promise.all([p.waitForEvent('download'), p.click('#pt-ics')]);
    ok((fs.readFileSync(await dl3.path(), 'utf8').match(/BEGIN:VEVENT/g) || []).length === 5, n + '.ics : les 4 séances du mois réglé et le rattrapage');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), n + '3 mois : rien ne dépasse de l’écran');
    if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + '/programme-talons-mois-' + vp.width + '.png', fullPage: true });
    await p.goto(BASE + 'programme-talons.html?c=' + J_BASE); await p.waitForSelector('#pt-contenu:not([hidden])', { timeout: 8000 });
    ok((await p.$$eval('.pt-mois-tete', (l) => l.map((x) => x.textContent))).join('|') === 'Les tenues' && /Robe longue et traîne/.test(await p.textContent('.pt-seance.proche')) && await p.$$eval('.pt-seance.a-regler', (l) => l.length) === 0,
      n + 'privé, j’ai la base : ses séances sous « Les tenues », rien « à régler »');
    // privé, mineure, séances pas encore fixées
    await p.goto(BASE + 'programme-talons.html?c=' + J_PRIVE); await p.waitForSelector('#pt-contenu:not([hidden])', { timeout: 8000 });
    ok(/Mademoiselle Petite Aya/.test(await p.textContent('#pt-titre')) && /bientôt programmées/.test(await p.textContent('#pt-proch-titre')) && await p.isHidden('#pt-ics') && await p.isHidden('#pt-bloc-cal'), n + 'privé sans dates : « Mademoiselle », « bientôt programmées », pas de bouton calendrier');
    // paiement pas validé (la base ne répond rien) et lien abîmé
    await p.goto(BASE + 'programme-talons.html?c=' + J_ATTENTE); await p.waitForTimeout(1200);
    ok(/pas encore validé/.test(await p.textContent('#pt-accroche')) && await p.isHidden('#pt-contenu') && await p.isVisible('#pt-wa'), n + 'paiement pas validé : message clair, WhatsApp toujours là');
    await p.goto(BASE + 'programme-talons.html?c=abc'); await p.waitForTimeout(600);
    ok(/pas valable/.test(await p.textContent('#pt-accroche')) && !journal.some((j) => j[1] === 'programme_talons_lire' && /abc/.test(j[2])), n + 'lien abîmé : message clair, la base n’est même pas interrogée');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
