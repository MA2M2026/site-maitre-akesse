// Programme des élèves de l'Atelier talons dans l'Administration (js/admin/site-talons-programme.js, 13/11/2026,
// maquette validée), comme l'agence, sur téléphone et ordinateur, base SIMULÉE (rien n'est écrit pour de vrai) :
//  - fiche d'une élève inscrite : son dossier (4 séances, thèmes, lieu), « Son programme » sur WhatsApp avec le lien de
//    sa page, « Rappel » de la prochaine séance ; élève qui paiera plus tard : « Inscription reçue » ;
//  - « Ajouter une séance » avec un créneau libre choisi d'un toucher ; une séance marquée faite ;
//  - page « Planning des cours de talons » : la séance de demain en tête, séances par jour avec la photo, ajout d'une
//    disponibilité, réglages de l'atelier enregistrés ;
//  - SQL pas encore collé : un message clair.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, seConnecter, photosLocales } = require('./donnees-nouvelle-admin');
const PORT = String(9500 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const jour = (n, h) => { const d = new Date(Date.now() + n * 864e5); return d.toISOString().slice(0, 10) + 'T' + h + ':00+00:00'; };
const JETON = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran, absente] of [['téléphone', { width: 390, height: 844 }, false], ['ordinateur', { width: 1366, height: 900 }, false], ['ordinateur', { width: 1366, height: 900 }, true]]) {
    const tel = ecran.width < 700, n = nom + (absente ? ' (SQL pas encore collé)' : '') + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (d) => d.accept());
    const d = donnees('principal');
    d.memoriser = true;
    d.tables.cours_talons = [
      { id: 't4', cree_le: '2026-11-10T10:00:00Z', formule: 'groupe', nb_seances: 4, nom: 'MARIAM TRAORÉ', telephone: '+2250700000004', age: 25, photos: ['https://drive.google.com/m1'],
        decision: 'plus_tard', statut: 'inscrite', montant: 30000, valide_le: '2026-11-11T10:00:00Z', programme_jeton: JETON },
      { id: 't5', cree_le: '2026-11-12T10:00:00Z', formule: 'prive_salle', nb_seances: 2, nom: 'BINTOU KONÉ', telephone: '+2250700000005', age: 21, photos: [], decision: 'plus_tard', statut: 'plus_tard', montant: 50000, programme_jeton: 'x' }];
    d.tables.talons_seances = [
      { id: 's1', inscription_id: 't4', debut: jour(1, '15:00'), fin: jour(1, '18:00'), lieu: 'Salle MA2M, Riviera Faya, Abidjan', theme: 'Posture et équilibre', statut: 'prevue' },
      { id: 's2', inscription_id: 't4', debut: jour(8, '15:00'), fin: jour(8, '18:00'), lieu: 'Salle MA2M, Riviera Faya, Abidjan', theme: 'Démarche et port de tête', statut: 'prevue' },
      { id: 's3', inscription_id: 't4', debut: jour(15, '15:00'), fin: jour(15, '18:00'), lieu: 'Salle MA2M, Riviera Faya, Abidjan', theme: 'Fluidité et tours', statut: 'prevue' },
      { id: 's4', inscription_id: 't4', debut: jour(22, '15:00'), fin: jour(22, '18:00'), lieu: 'Salle MA2M, Riviera Faya, Abidjan', theme: 'Défilé final', statut: 'prevue' }];
    d.tables.talons_reglages = [{ id: 1, salle_nom: 'Salle MA2M', salle_adresse: 'Riviera Faya, Abidjan', salle_maps: null, groupe_debut: '15:00:00', groupe_fin: '18:00:00', duree_prive: 120, ecart_minutes: 90,
      a_prevoir: ['Talons de 7 à 10 cm'], themes_groupe: ['Posture et équilibre', 'Démarche et port de tête', 'Fluidité et tours', 'Défilé final'] }];
    d.tables.talons_disponibilites = [{ id: 'd1', jour: 3, debut: '16:00:00', fin: '19:00:00' }];
    d.tables.talons_indisponibles = [];
    d.rpc = Object.assign({}, d.rpc, { talons_creneaux_libres: () => [{ debut: jour(3, '10:00'), fin: jour(3, '12:00') }, { debut: jour(3, '13:30'), fin: jour(3, '15:30') }] });
    await brancher(p, d, journal); await photosLocales(p);
    if (absente) await p.route(/\/rest\/v1\/talons_/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: '42P01', message: 'relation "public.talons_seances" does not exist' }) }));
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    await p.goto(URL_ADMIN + '#/site/b2-cours-talons'); await p.waitForFunction(() => /Cours de talons/.test((document.querySelector('#contenu h1') || {}).textContent || ''), null, { timeout: 15000 });
    if (absente) {
      ok(/supabase-talons-programme\.sql/.test(await p.textContent('#contenu')) || !(await p.$('.tp-dossier')), n + 'les inscriptions restent visibles ; le programme demande de coller supabase-talons-programme.sql');
      await p.goto(URL_ADMIN + '#/site/b2-talons-planning'); await p.waitForTimeout(1200);
      ok(/supabase-talons-programme\.sql/.test(await p.textContent('#contenu')), n + 'planning : message clair pour activer le programme');
      ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
      await ctx.close(); continue;
    }
    // l'élève qui paiera plus tard : « Inscription reçue »
    const recue = await p.$('.ct-fiche[data-id="t5"] .ct-actions a:has-text("Inscription reçue")');
    ok(recue && /^https:\/\/wa\.me\/2250700000005\?text=/.test(await recue.getAttribute('href')) && /bien reçu votre demande/.test(decodeURIComponent(await recue.getAttribute('href'))), n + '« Inscription reçue » : message WhatsApp tout prêt pour celle qui paiera plus tard');
    // l'élève inscrite : son dossier
    await p.click('[data-action="talons-filtre"][data-valeur="inscrite"]'); await p.waitForSelector('.ct-fiche[data-id="t4"] .tp-dossier');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), n + 'le dossier ne déborde pas sur le côté');
    const lignes = await p.$$eval('.ct-fiche[data-id="t4"] .tp-table tbody tr', (l) => l.map((x) => x.textContent));
    ok(lignes.length === 4 && /Posture et équilibre/.test(lignes[0]) && /15 h – 18 h/.test(lignes[0]) && /Riviera Faya/.test(lignes[0]), n + 'dossier : ses 4 séances (date, 15 h – 18 h, thème, lieu)');
    const prog = await p.$('.ct-fiche[data-id="t4"] .ct-actions a:has-text("Son programme")');
    const texteProg = prog ? decodeURIComponent(await prog.getAttribute('href')) : '';
    ok(/paiement est bien validé/.test(texteProg) && texteProg.includes('/programme?j=' + JETON) && /Séance 4/.test(texteProg), n + '« Son programme » : message avec ses séances et le lien de sa page « Mon programme »');
    const rappel = await p.$('.ct-fiche[data-id="t4"] .ct-actions a:has-text("Rappel")');
    ok(rappel && /cours de talons a lieu demain/.test(decodeURIComponent(await rappel.getAttribute('href'))), n + '« Rappel de la prochaine séance » tout prêt');
    // ajouter une séance d'un créneau libre
    if (process.env.CAPTURES) { await p.evaluate(() => { const e = document.querySelector('.ct-fiche[data-id="t4"] .tp-dossier'); const x = e.closest('#contenu, main') || document.scrollingElement; window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 120); }); await p.waitForTimeout(600); await p.screenshot({ path: process.env.CAPTURES + '/dossier-' + nom + '.png' }); }
    await p.$eval('.ct-fiche[data-id="t4"] .tp-ajout summary', (e) => e.click());
    await p.$eval('.ct-fiche[data-id="t4"] [data-action="talons-creneaux"]', (e) => e.click()); await p.waitForSelector('[data-action="talons-creneau-choisir"]');
    await p.$$eval('[data-action="talons-creneau-choisir"]', (l) => l[1].click());
    ok(await p.inputValue('#tp-debut-t4') === '13:30' && await p.inputValue('#tp-fin-t4') === '15:30', n + 'un créneau libre choisi d’un toucher remplit la séance (13 h 30 – 15 h 30)');
    await p.$eval('.ct-fiche[data-id="t4"] form[data-form="talons-seance"] button[type="submit"]', (e) => e.click()); await p.waitForTimeout(700);
    const ajout = journal.find((x) => x[0] === 'POST' && x[1] === 'talons_seances');
    ok(ajout && JSON.parse(ajout[3]).inscription_id === 't4' && /T13:30:00/.test(JSON.parse(ajout[3]).debut), n + 'séance ajoutée dans la base');
    await p.$$eval('.ct-fiche[data-id="t4"] [data-action="talons-seance-faite"]', (l) => l[l.length - 1].click()); await p.waitForTimeout(500);
    ok(journal.some((x) => x[0] === 'PATCH' && x[1] === 'talons_seances' && /"statut":"faite"/.test(x[3] || '')), n + 'séance marquée « faite »');
    // planning
    await p.goto(URL_ADMIN + '#/site/b2-talons-planning'); await p.waitForFunction(() => /Planning des cours de talons/.test((document.querySelector('#contenu h1') || {}).textContent || ''), null, { timeout: 15000 });
    ok(await p.$('#menu-lateral a.nav[href="#/site/b2-talons-planning"]') !== null, n + '« Planning des cours de talons » dans le menu');
    ok(/Demain : 1 séance/.test(await p.textContent('.tp-alerte')) && /MARIAM TRAORÉ/.test(await p.textContent('.tp-alerte')), n + 'la séance de demain en tête');
    ok((await p.$$('.tp-seance')).length >= 4 && (await p.$$('.jour-groupe .jour-titre')).length >= 4, n + 'séances à venir jour par jour, avec la photo');
    await p.selectOption('#tp-jour', '6'); await p.fill('#tp-dd', '09:00'); await p.fill('#tp-df', '12:00');
    await p.click('form[data-form="talons-dispo"] button[type="submit"]'); await p.waitForTimeout(600);
    const dispo = journal.find((x) => x[0] === 'POST' && x[1] === 'talons_disponibilites');
    ok(dispo && JSON.parse(dispo[3]).jour === 6, n + 'disponibilité du samedi matin ajoutée');
    await p.fill('#tr-adr', 'Riviera Faya, près du rond-point'); await p.click('form[data-form="talons-reglages"] button[type="submit"]'); await p.waitForTimeout(600);
    ok(journal.some((x) => x[0] === 'PATCH' && x[1] === 'talons_reglages' && /rond-point/.test(x[3] || '')), n + 'réglages de l’atelier enregistrés');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), n + 'rien ne déborde sur le côté');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    if (process.env.CAPTURES) { await p.screenshot({ path: process.env.CAPTURES + '/planning-' + nom + '.png', fullPage: true }); }
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ programme des cours de talons (Administration) : tout passe'); process.exit(ko ? 1 : 0);
})();
