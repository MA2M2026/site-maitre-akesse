// « Mannequins extérieures » (js/admin/site-exterieures.js, 23/10/2026), comme l'agence, sur
// téléphone et ordinateur, base SIMULÉE : seules les partenaires extérieures (pas les mannequins de
// l'agence du carnet), leurs projets (convoquées, ou place prise), filtre par période, lien
// WhatsApp. Lecture seule : rien n'est écrit.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, seConnecter, photosLocales } = require('./donnees-nouvelle-admin');
const PORT = String(9300 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ceMois = new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Abidjan' }).slice(0, 7);
  const ilYaUnAn = (Number(ceMois.slice(0, 4)) - 2) + '-03-10';
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    const d = donnees('principal');
    d.tables.contacts_externes = [
      { id: 'x1', civilite: 'Madame', nom: 'AWA PARTENAIRE', telephone: '2250701010101', email: 'awa@partenaire.ci', mannequin_id: null },
      { id: 'x2', civilite: 'Monsieur', nom: 'JEAN STYLISTE', telephone: null, email: 'jean@test.ci', mannequin_id: null },
      { id: 'x3', civilite: 'Mademoiselle', nom: 'FATOU AGENCE', telephone: '2250702020202', mannequin_id: 'r9' }];
    d.tables.agenda_projets = (d.tables.agenda_projets || []).concat([
      { id: 'pe1', titre: 'DÉFILÉ DU MOIS', type: 'defile', date_debut: ceMois + '-05', annule: false },
      { id: 'pe2', titre: 'SHOOTING ANCIEN', type: 'shooting', date_debut: ilYaUnAn, annule: false },
      { id: 'pe3', titre: 'PROJET ANNULÉ', type: 'defile', date_debut: ceMois + '-06', annule: true }]);
    d.tables.convocation_participants = [
      { id: 'c1', contact_id: 'x1', projet_id: 'pe1' }, { id: 'c2', contact_id: 'x1', projet_id: 'pe2' },
      { id: 'c3', contact_id: 'x3', projet_id: 'pe1' }, { id: 'c4', contact_id: 'x2', projet_id: 'pe3' }];
    d.tables.places_invitations = [{ id: 'i1', contact_id: 'x2', projet_id: 'pe2', statut: 'pris' }, { id: 'i2', contact_id: 'x2', projet_id: 'pe1', statut: 'invite' }];
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    await p.goto(URL_ADMIN + '#/site/b2-exterieures'); await p.waitForSelector('#ext-periode', { timeout: 10000 }); await p.waitForTimeout(800);
    ok(await p.$('#menu-lateral a.nav[href="#/site/b2-exterieures"]') !== null, n + '« Mannequins extérieures » dans le menu');
    const texte = () => p.textContent('#contenu');
    let t = await texte();
    ok(/Madame AWA PARTENAIRE/.test(t) && /Monsieur JEAN STYLISTE/.test(t) && !/FATOU AGENCE/.test(t), n + 'seulement les extérieures (pas la mannequin de l’agence du carnet)');
    ok(/DÉFILÉ DU MOIS/.test(t) && /SHOOTING ANCIEN/.test(t) && !/PROJET ANNULÉ/.test(t), n + 'leurs projets (convoquée, ou place prise), sans les projets annulés');
    ok((await p.$$('.ext-fiche .vis')).length === 2, n + 'un visage (initiales) devant chaque nom');
    const wa = await p.$$eval('.ext-fiche a[href^="https://wa.me/"]', (l) => l.map((a) => a.href));
    ok(wa.length === 1 && wa[0] === 'https://wa.me/2250701010101', n + 'bouton WhatsApp (seulement pour qui a un numéro)');
    await p.selectOption('#ext-periode', ceMois); await p.waitForTimeout(800);
    t = await texte();
    ok(/AWA PARTENAIRE/.test(t) && /DÉFILÉ DU MOIS/.test(t) && !/SHOOTING ANCIEN/.test(t) && !/JEAN STYLISTE/.test(t), n + 'ce mois : celles avec qui on a travaillé ce mois-ci, et ces projets-là');
    ok(/Avec qui on a travaillé\s*1/.test(await p.textContent('.chiffres')) && /Projets\s*1/.test(await p.textContent('.chiffres')), n + 'chiffres de la période');
    ok(!journal.some((j) => ['POST', 'PATCH', 'DELETE'].includes(j[0])), n + 'lecture seule : rien n’est écrit');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran');
    if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + '/exterieures-' + ecran.width + '.png', fullPage: true });
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
