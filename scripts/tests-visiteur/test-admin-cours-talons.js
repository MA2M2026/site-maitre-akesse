// « Cours de talons » dans l'Administration (js/admin/site-cours-talons.js, 08/11/2026), comme l'agence, sur
// téléphone et ordinateur, base SIMULÉE (rien n'est écrit pour de vrai) : rubrique au menu, liste « À traiter »,
// photos et vidéo, lien Wave envoyé sur WhatsApp avec le bon montant, paiement validé (fonction de la base, une
// recette en Compta), date / notes enregistrées, « terminée », « annulée » ; SQL pas encore collé : message clair.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, seConnecter, photosLocales } = require('./donnees-nouvelle-admin');
const PORT = String(9400 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

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
      { id: 't1', cree_le: '2026-11-08T10:00:00Z', formule: 'prive_salle', nb_seances: 10, nom: 'KOUASSI MARIE', telephone: '+2250701020304', age: 16, quartier: 'Angré',
        objectif: 'miss', concours: 'Miss Côte d’Ivoire', niveau: 'un_peu', parent_nom: 'Mme Kouassi', parent_telephone: '+2250501020304',
        photos: ['https://drive.google.com/p1', 'https://drive.google.com/p2'], video: 'https://drive.google.com/v1', decision: 'plus_tard', statut: 'plus_tard', montant: 250000 },
      { id: 't2', cree_le: '2026-11-07T10:00:00Z', formule: 'groupe', nb_seances: 4, nom: 'AWA DIALLO', telephone: '+2250700000002', age: 24, photos: [], decision: 'maintenant',
        reference_wave: 'T_123', statut: 'paiement_envoye', montant: 30000 },
      { id: 't3', cree_le: '2026-10-01T10:00:00Z', formule: 'groupe', nb_seances: 4, nom: 'ANCIENNE ÉLÈVE', telephone: '+2250700000003', age: 30, photos: [], decision: 'maintenant', statut: 'terminee', montant: 30000, valide_le: '2026-10-02T10:00:00Z' }];
    d.rpc = Object.assign({}, d.rpc, { cours_talons_valider: (c) => { const l = d.tables.cours_talons.find((x) => x.id === c.p_id); Object.assign(l, { statut: 'inscrite', montant: c.p_montant, valide_le: '2026-11-08T12:00:00Z' }); return l; } });
    await brancher(p, d, journal); await photosLocales(p);
    if (absente) await p.route(/\/rest\/v1\/cours_talons/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: '42P01', message: 'relation "public.cours_talons" does not exist' }) }));
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    await p.goto(URL_ADMIN + '#/site/b2-cours-talons'); await p.waitForFunction(() => /Cours de talons/.test((document.querySelector('#contenu h1') || {}).textContent || ''), null, { timeout: 15000 }); await p.waitForTimeout(600);
    ok(await p.$('#menu-lateral a.nav[href="#/site/b2-cours-talons"]') !== null, n + '« Cours de talons » dans le menu de l’Administration');
    const texte = () => p.textContent('#contenu');
    if (absente) {
      ok(/supabase-cours-talons\.sql/.test(await texte()), n + 'message clair : coller supabase-cours-talons.sql');
      ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
      await ctx.close(); continue;
    }
    let t = await texte();
    ok(t.includes('KOUASSI MARIE') && t.includes('AWA DIALLO') && !t.includes('ANCIENNE ÉLÈVE'), n + '« À traiter » : les 2 inscriptions en cours, pas la terminée');
    ok(/Mineure/.test(t) && t.includes('Mme Kouassi') && t.includes('10 séances') && t.includes('250 000 FCFA'), n + 'fiche : mineure avec son parent, 10 séances, 250 000 FCFA');
    ok(await p.locator('.ct-fiche[data-id="t1"] a[href="https://drive.google.com/p2"]').count() === 1 && await p.locator('.ct-fiche[data-id="t1"] a[href="https://drive.google.com/v1"]').count() === 1, n + 'photos et vidéo de la marche à ouvrir');
    const wave = await p.getAttribute('.ct-fiche[data-id="t1"] a:has-text("Envoyer le lien Wave")', 'href');
    ok(/^https:\/\/wa\.me\/2250701020304\?text=/.test(wave) && decodeURIComponent(wave).includes('?amount=250000') && /T_123/.test(t), n + 'lien Wave envoyé sur WhatsApp avec le bon montant ; référence Wave affichée');
    // date et notes
    await p.fill('#ct-date-t1', '2026-11-15'); await p.fill('#ct-notes-t1', 'Rappeler samedi');
    await p.click('.ct-fiche[data-id="t1"] button[type="submit"]'); await p.waitForTimeout(800);
    ok(d.tables.cours_talons[0].date_seance === '2026-11-15' && d.tables.cours_talons[0].notes === 'Rappeler samedi', n + 'date de séance et notes enregistrées');
    // paiement reçu (Wave)
    await p.click('.ct-fiche[data-id="t2"] [data-action="talons-valider"]:not([data-valeur])'); await p.waitForTimeout(900);
    const appel = journal.find((j) => j[0] === 'rpc' && j[1] === 'cours_talons_valider');
    ok(appel && JSON.parse(appel[2]).p_id === 't2' && JSON.parse(appel[2]).p_montant === 30000 && JSON.parse(appel[2]).p_especes === false, n + 'paiement Wave validé par la base (une recette « Cours de talons » en Compta)');
    t = await texte();
    ok(!t.includes('AWA DIALLO'), n + 'l’inscription payée quitte « À traiter »');
    await p.click('[data-action="talons-filtre"][data-valeur="inscrite"]'); await p.waitForTimeout(500);
    ok((await texte()).includes('AWA DIALLO'), n + 'elle est dans « Inscrites »');
    await p.click('.ct-fiche[data-id="t2"] [data-action="talons-statut"][data-valeur="terminee"]'); await p.waitForTimeout(700);
    ok(d.tables.cours_talons[1].statut === 'terminee', n + '« Cours terminés » enregistré');
    await p.click('[data-action="talons-filtre"][data-valeur="a_traiter"]'); await p.waitForTimeout(500);
    await p.click('.ct-fiche[data-id="t1"] [data-action="talons-statut"][data-valeur="annulee"]'); await p.waitForTimeout(700);
    ok(d.tables.cours_talons[0].statut === 'annulee' && !journal.some((j) => j[0] === 'DELETE'), n + 'inscription annulée (rien n’est effacé)');
    const deborde = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(deborde <= 1, n + 'aucun débordement horizontal (' + deborde + ' px)');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ cours de talons (Administration) : tout passe');
  process.exit(ko ? 1 : 0);
})();
