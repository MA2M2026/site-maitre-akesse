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
  for (const [nom, ecran, absente, sansProgramme] of [['téléphone', { width: 390, height: 844 }, false], ['ordinateur', { width: 1366, height: 900 }, false], ['ordinateur', { width: 1366, height: 900 }, true], ['téléphone', { width: 390, height: 844 }, false, true]]) {
    const tel = ecran.width < 700, n = nom + (absente ? ' (SQL pas encore collé)' : sansProgramme ? ' (programme pas encore collé)' : '') + ' : ';
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
      { id: 't2', cree_le: '2026-11-07T10:00:00Z', formule: 'groupe', nb_seances: 4, nom: 'AWA DIALLO', telephone: '+2250700000002', age: 24, photos: [], video: 'https://drive.google.com/file/d/vid456/view', decision: 'maintenant',
        reference_wave: 'T_123', statut: 'paiement_envoye', montant: 30000, moyen: 'orange_money', jeton: 'f'.repeat(36) },
      { id: 't4', cree_le: '2026-10-05T10:00:00Z', formule: 'groupe', nb_seances: 4, nom: 'JEUNE AYA', telephone: '+2250700000004', age: 15, parent_nom: 'M. Yao', parent_telephone: '+2250500000004',
        photos: [], decision: 'maintenant', statut: 'inscrite', montant: 30000, valide_le: '2026-10-06T10:00:00Z', mois_payes: 1, jeton: 'e'.repeat(36) },
      { id: 't5', cree_le: '2026-10-04T10:00:00Z', formule: 'groupe', nb_seances: 4, nb_mois: 3, paiement: 'mensuel', mois_payes: 1, civilite: 'madame', nom: 'FATOU TROIS MOIS', telephone: '+2250700000005', age: 31,
        photos: [], decision: 'maintenant', statut: 'inscrite', montant: 30000, valide_le: '2026-10-04T12:00:00Z', jeton: 'd'.repeat(36) },
      // (15/11/2026) privé payé, « je choisirai après mon paiement » : ses 3 séances sont à placer
      { id: 't6', cree_le: '2026-10-03T10:00:00Z', formule: 'prive_salle', nb_seances: 3, choix_creneaux: 'apres', civilite: 'madame', nom: 'NADIA APRÈS', telephone: '+2250700000006', age: 29,
        photos: [], decision: 'maintenant', statut: 'inscrite', montant: 75000, valide_le: '2026-10-03T12:00:00Z', jeton: 'c'.repeat(36) },
      { id: 't3', cree_le: '2026-10-01T10:00:00Z', formule: 'groupe', nb_seances: 4, nom: 'ANCIENNE ÉLÈVE', telephone: '+2250700000003', age: 30, photos: [], decision: 'maintenant', statut: 'terminee', montant: 30000, valide_le: '2026-10-02T10:00:00Z' }];
    d.rpc = Object.assign({}, d.rpc, { cours_talons_valider: (c) => { const l = d.tables.cours_talons.find((x) => x.id === c.p_id); Object.assign(l, { statut: 'inscrite', montant: c.p_montant, valide_le: '2026-11-08T12:00:00Z', mois_payes: l.paiement === 'mensuel' ? 1 : (l.nb_mois || 1) });
      // (14/11/2026) la base remplit toute seule les 4 dimanches d'un groupe (déclencheur de supabase-programme-talons.sql)
      if (l.formule === 'groupe') d.tables.cours_talons_seances.push(...[0, 1, 2, 3].map((i) => ({ id: 's' + i, inscription_id: l.id, debut: '2030-01-' + String(6 + 7 * i).padStart(2, '0') + 'T15:00:00Z',
        fin: '2030-01-' + String(6 + 7 * i).padStart(2, '0') + 'T18:00:00Z', lieu: 'Salle MA2M, Riviera Faya', mois: 1, theme: ['Posture et équilibre', 'Démarche et port de tête', 'Fluidité et tours', 'Le défilé final'][i], faite: false })));
      return l; } });
    // (15/11/2026) planning : demain 15 h, le groupe (2 élèves inscrites) ; dans 3 jours 10 h, le cours privé réservé de
    // KOUASSI MARIE (pas encore payé : « à confirmer »)
    const plus = (j, h) => { const x = new Date(); x.setUTCHours(h, 0, 0, 0); x.setUTCDate(x.getUTCDate() + j); return x.toISOString(); };
    d.tables.cours_talons_seances = [
      { id: 'pg4', inscription_id: 't4', debut: plus(1, 15), fin: plus(1, 18), lieu: 'Salle MA2M, Riviera Faya', theme: 'Posture et équilibre', mois: 1, faite: false },
      { id: 'pg5', inscription_id: 't5', debut: plus(1, 15), fin: plus(1, 18), lieu: 'Salle MA2M, Riviera Faya', theme: 'Posture et équilibre', mois: 1, faite: false },
      { id: 'pp1', inscription_id: 't1', debut: plus(3, 10), fin: plus(3, 12), lieu: 'Salle MA2M, Riviera Faya', theme: 'Les bases', faite: false, reservee: true },
      // jamais au planning : un dimanche du mois 2 pas encore réglé (FATOU, 1 mois payé sur 3), un cours déjà fini (pas coché « fait »)
      { id: 'pm2', inscription_id: 't5', debut: plus(5, 15), fin: plus(5, 18), lieu: 'Salle MA2M, Riviera Faya', theme: 'Mois deux', mois: 2, faite: false },
      { id: 'pfini', inscription_id: 't1', debut: new Date(Date.now() - 3 * 3600000).toISOString(), fin: new Date(Date.now() - 3600000).toISOString(), lieu: 'Salle MA2M, Riviera Faya', theme: 'Déjà fini', faite: false, reservee: true }];
    d.rpc.cours_talons_mois_payer = (c) => { const l = d.tables.cours_talons.find((x) => x.id === c.p_id); l.mois_payes = (l.mois_payes || 0) + 1; l.nb_mois = Math.max(l.nb_mois || 1, l.mois_payes); return l; };
    await brancher(p, d, journal); await photosLocales(p);
    // (15/11/2026) indisponibilités de l'agence : le dimanche 6 janvier 2030 (une séance du groupe tombe dedans) ;
    // fichier pas encore collé (cas « programme pas collé ») : table absente, rien ne casse
    d.tables.cours_talons_indispo = [{ id: 'i1', debut: '2030-01-06T00:00:00Z', fin: '2030-01-07T00:00:00Z', raison: 'Voyage' }];
    if (sansProgramme) await p.route(/\/rest\/v1\/cours_talons_indispo/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: '42P01', message: 'relation "public.cours_talons_indispo" does not exist' }) }));
    if (sansProgramme) await p.route(/\/rest\/v1\/cours_talons_seances/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: '42P01', message: 'relation "public.cours_talons_seances" does not exist' }) }));
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
    // (13/11/2026) regroupées par jour d'inscription, comme les castings ; boutons en une rangée aérée
    if (process.env.CAPTURES) { await p.locator('.ct-fiche[data-id="t1"]').scrollIntoViewIfNeeded(); await p.screenshot({ path: process.env.CAPTURES + '/cours-talons-' + n.replace(/\W+/g, '') + '.png', fullPage: false }); }
    const jours = await p.$$eval('.jour-groupe .jour-titre', (l) => l.map((x) => x.textContent.trim()));
    ok(jours.length >= 1 && jours.every((j) => /\d/.test(j)), n + 'inscriptions regroupées par jour (' + jours.join(' | ') + ')');
    const rangee = await p.$$eval('.ct-fiche[data-id="t1"] .ct-actions > a', (l) => l.map((a) => { const r = a.getBoundingClientRect(); return [r.top, r.bottom, r.left, r.right]; }));
    const chevauche = rangee.some((a, i) => rangee.some((b, j) => i < j && a[0] < b[1] - 1 && b[0] < a[1] - 1 && a[2] < b[3] - 1 && b[2] < a[3] - 1));
    ok(rangee.length >= 3 && !chevauche, n + 'vidéo, WhatsApp et lien Wave dans une rangée, sans se chevaucher (' + rangee.length + ' boutons)');
    ok(/Mineure/.test(t) && t.includes('Mme Kouassi') && t.includes('10 séances') && t.includes('250 000 FCFA'), n + 'fiche : mineure avec son parent, 10 séances, 250 000 FCFA');
    // (13/11/2026) les photos sont AFFICHÉES dans la fiche (plus de simples boutons) et s'agrandissent d'un appui ;
    // la vidéo reste un bouton
    ok(await p.locator('.ct-fiche[data-id="t1"] .galerie-dossier img[src="https://drive.google.com/p2"]').count() === 1 && await p.locator('.ct-fiche[data-id="t1"] a[href="https://drive.google.com/v1"]').count() === 1, n + 'photos affichées dans la fiche et vidéo de la marche');
    // (17/11/2026, L-18) vidéo Drive lue DANS la fiche (lecteur intégré), plus de simple bouton ; le lien Drive reste
    ok(await p.locator('.ct-fiche[data-id="t2"] iframe.lecteur-video[src="https://drive.google.com/file/d/vid456/preview"]').count() === 1 &&
      await p.locator('.ct-fiche[data-id="t2"] a.btn', { hasText: 'Vidéo de la marche' }).count() === 0, n + 'vidéo de la marche lue dans la fiche (lecteur Google Drive)');
    await p.click('.ct-fiche[data-id="t1"] [data-action="talons-photo-voir"][data-index="1"]'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !!document.querySelector('.lightbox.active, .lightbox-global.active, [class*="lightbox"].active, [class*="lightbox"][class*="ouvert"]')), n + 'une photo s’agrandit d’un appui');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    // (14/11/2026) « Messages prêts à envoyer » : une tuile par message, à elle et (mineure) à son parent
    const m1 = '.ct-fiche[data-id="t1"] .ct-msg';
    const wave = await p.getAttribute(m1 + '[data-msg="paiement"] a[data-pour="eleve"]', 'href');
    ok(/^https:\/\/wa\.me\/2250701020304\?text=/.test(wave) && decodeURIComponent(wave).includes('?amount=250000') && /T_123/.test(t), n + 'lien Wave envoyé sur WhatsApp avec le bon montant ; référence Wave affichée');
    const waveParent = decodeURIComponent(await p.getAttribute(m1 + '[data-msg="paiement"] a[data-pour="parent"]', 'href'));
    ok(/^https:\/\/wa\.me\/2250501020304\?text=Bonjour Mme Kouassi,/.test(waveParent) && /l’inscription de Mademoiselle KOUASSI MARIE/.test(waveParent) && waveParent.includes('?amount=250000'), n + 'lien de paiement aussi au parent (« l’inscription de Mademoiselle … »)');
    const recue = decodeURIComponent(await p.getAttribute(m1 + '[data-msg="inscription"] a[data-pour="eleve"]', 'href'));
    ok(/Bonjour Mademoiselle KOUASSI MARIE,/.test(recue) && /bien reçu votre inscription/.test(recue) && /lien de paiement/.test(recue), n + '« Inscription reçue » : message prêt, vouvoiement');
    ok(await p.locator(m1 + '[data-msg="programme"], ' + m1 + '[data-msg="rappel"]').count() === 0 && await p.locator('.ct-fiche[data-id="t1"] .ct-actions a:has-text("Wave")').count() === 0, n + 'pas encore payée : ni programme ni rappel, plus de doublon du lien Wave');
    const tuiles = await p.$$eval(m1, (l) => l.map((x) => { const r = x.getBoundingClientRect(); return [r.left, r.right, innerWidth]; }));
    if (process.env.CAPTURES) await p.locator('.ct-fiche[data-id="t1"] .ct-messages').screenshot({ path: process.env.CAPTURES + '/messages-' + n.replace(/\W+/g, '') + '.png' });
    ok(tuiles.length === 2 && tuiles.every((r) => r[0] >= 0 && r[1] <= r[2] + 1), n + 'les tuiles tiennent dans l’écran');
    // date et notes
    await p.fill('#ct-date-t1', '2026-11-15'); await p.fill('#ct-notes-t1', 'Rappeler samedi');
    await p.click('.ct-fiche[data-id="t1"] button[type="submit"]'); await p.waitForTimeout(800);
    ok(d.tables.cours_talons[0].date_seance === '2026-11-15' && d.tables.cours_talons[0].notes === 'Rappeler samedi', n + 'date de séance et notes enregistrées');
    // paiement reçu (Wave)
    // (13/11/2026) payé par Orange Money : la fiche et le bouton le disent (plus « Wave » d'office)
    ok(/Payé par Orange Money à l’inscription \(réf\. T_123\)/.test(await p.textContent('.ct-fiche[data-id="t2"]')) && /Paiement reçu \(Orange Money\)/.test(await p.textContent('.ct-fiche[data-id="t2"] [data-action="talons-valider"]:not([data-valeur])')),
      n + 'fiche : « Payé par Orange Money », bouton « Paiement reçu (Orange Money) »');
    await p.click('.ct-fiche[data-id="t2"] [data-action="talons-valider"]:not([data-valeur])'); await p.waitForTimeout(900);
    const appel = journal.find((j) => j[0] === 'rpc' && j[1] === 'cours_talons_valider');
    ok(appel && JSON.parse(appel[2]).p_id === 't2' && JSON.parse(appel[2]).p_montant === 30000 && JSON.parse(appel[2]).p_especes === false, n + 'paiement Orange Money validé par la base (une recette « Cours de talons » en Compta, sur le compte du moyen)');
    t = await texte();
    ok(await p.locator('.ct-fiche[data-id="t2"]').count() === 0, n + 'l’inscription payée quitte « À traiter »');
    await p.click('[data-action="talons-filtre"][data-valeur="inscrite"]'); await p.waitForTimeout(500);
    ok((await texte()).includes('AWA DIALLO'), n + 'elle est dans « Inscrites »');
    // (14/11/2026) « Son programme » : les 4 dimanches remplis par la base, son lien personnel envoyé sur WhatsApp
    const fiche2 = '.ct-fiche[data-id="t2"] ';
    if (sansProgramme) ok(await p.locator('.ct-indispo').count() === 0, n + 'indisponibilités pas encore installées : rien n’apparaît');
    else if (!absente) {
      // (15/11/2026) « Mes indisponibilités » : la liste, la séance touchée et son message WhatsApp
      ok(/Dimanche 6 janvier · toute la journée/.test(await p.textContent('.ct-indispo')) && /Voyage/.test(await p.textContent('.ct-indispo')), n + 'indisponibilités : « Dimanche 6 janvier · toute la journée », sa raison');
      const touche = decodeURIComponent(await p.getAttribute('.ct-touchee a', 'href'));
      ok(/1 séance déjà prévue tombe/.test(await p.textContent('.ct-touchees')) && /^https:\/\/wa\.me\/2250700000002\?text=Bonjour Madame AWA DIALLO/.test(touche) && /ne pourra pas avoir lieu/.test(touche),
        n + 'séance déjà prévue pendant l’indisponibilité : signalée, message WhatsApp prêt');
      if (!(await p.getAttribute('.ct-indispo', 'open') !== null)) await p.click('.ct-indispo summary');
      await p.fill('#ct-i-du', '2030-02-02'); await p.fill('#ct-i-de', '10:00'); await p.fill('#ct-i-a', '14:00'); await p.fill('#ct-i-raison', 'Shooting');
      await p.click('form[data-form="talons-indispo"] button[type="submit"]'); await p.waitForTimeout(800);
      const ajoutI = d.tables.cours_talons_indispo.find((x) => x.raison === 'Shooting');
      ok(ajoutI && ajoutI.debut === '2030-02-02T10:00:00.000Z' && ajoutI.fin === '2030-02-02T14:00:00.000Z' && /Samedi 2 février · 10 h – 14 h/.test(await p.textContent('.ct-indispo')), n + 'indisponibilité ajoutée : samedi 2 février, 10 h – 14 h');
      // plusieurs jours, de 10 h à 12 h : ces heures-là chaque jour (3 lignes), pas un bloc continu
      if (!(await p.getAttribute('.ct-indispo', 'open') !== null)) await p.click('.ct-indispo summary');
      await p.fill('#ct-i-du', '2030-03-04'); await p.fill('#ct-i-au', '2030-03-06'); await p.fill('#ct-i-de', '10:00'); await p.fill('#ct-i-a', '12:00'); await p.fill('#ct-i-raison', 'Matinées');
      await p.click('form[data-form="talons-indispo"] button[type="submit"]'); await p.waitForTimeout(800);
      const matins = d.tables.cours_talons_indispo.filter((x) => x.raison === 'Matinées');
      ok(matins.length === 3 && matins.every((x) => /T10:00:00.000Z$/.test(x.debut) && /T12:00:00.000Z$/.test(x.fin)) && matins[2].debut.startsWith('2030-03-06'), n + 'du 4 au 6 mars, de 10 h à 12 h : ces heures chaque jour (3 indisponibilités)');
      await p.click('[data-action="talons-indispo-retirer"][data-id="i1"]'); await p.waitForTimeout(800);
      ok(!d.tables.cours_talons_indispo.some((x) => x.id === 'i1') && await p.locator('.ct-touchees').count() === 0, n + 'indisponibilité retirée : la séance n’est plus signalée');
      const f6 = '.ct-fiche[data-id="t6"] ';
      ok(/Créneaux\s*Elle les choisit après son paiement, sur son lien · 3 à placer/.test(await p.textContent(f6 + '.ct-infos')), n + 'privé « après mon paiement » : « 3 à placer »');
      const choisirMsg = decodeURIComponent(await p.getAttribute(f6 + '.ct-msg[data-msg="programme"] a[data-pour="eleve"]', 'href'));
      ok(/vous choisissez vos créneaux \(3 séances\)/.test(choisirMsg) && choisirMsg.includes('programme-talons?c=' + 'c'.repeat(36)), n + 'son message : « vous choisissez vos créneaux (3 séances) » avec son lien');
    }
    if (!sansProgramme && !absente) {
      // (15/11/2026) « Planning » : jour par jour, le groupe en un cours, le privé « à confirmer », rappels WhatsApp prêts
      await p.click('[data-action="talons-filtre"][data-valeur="planning"]'); await p.waitForTimeout(600);
      const pl = await p.textContent('.pl-planning');
      ok(!/Mois deux|Déjà fini/.test(pl) && /Planning \(2\)/.test(await p.textContent('[data-action="talons-filtre"][data-valeur="planning"]')), n + 'planning : ni le mois pas encore réglé, ni un cours déjà fini ; l’onglet compte les cours montrés (2)');
      ok(/Cours en groupe/.test(pl) && /2 élèves/.test(pl) && /Mademoiselle KOUASSI MARIE/.test(pl) && /à confirmer \(paiement\)/.test(pl) && await p.locator('.pl-planning .se-jour.auj').count() === 1, n + 'planning : demain le groupe (2 élèves, en rouge), puis le cours privé « à confirmer »');
      await p.click('.pl-eleves summary');
      const rap = decodeURIComponent(await p.getAttribute('.pl-eleve a.rouge', 'href'));
      const jourDemain = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][new Date(Date.now() + 86400000).getUTCDay()];
      ok(rap.includes('c’est demain, ' + jourDemain) && /Posture et équilibre/.test(rap), n + 'groupe : un rappel « c’est demain » prêt pour chaque élève');
      if (process.env.CAPTURES) await p.locator('.pl-planning').screenshot({ path: process.env.CAPTURES + '/planning-' + ecran.width + '.png' });
      ok(await p.locator('.pl-s:has-text("KOUASSI") a:has-text("Au parent")').count() === 1, n + 'mineure : rappel aussi au parent');
      await p.click('.pl-s:has-text("KOUASSI") [data-action="talons-voir-fiche"]'); await p.waitForTimeout(800);
      ok(await p.isVisible('.ct-fiche[data-id="t1"]') && await p.locator('.pl-planning').count() === 0, n + '« Sa fiche » : ouvre sa fiche');
      // la notification de la veille ouvre directement le planning
      await p.goto(URL_ADMIN + '#/site/b2-cours-talons/planning'); await p.waitForSelector('.pl-planning', { timeout: 10000 }).catch(() => {});
      ok(await p.locator('.pl-planning').count() === 1 && await p.evaluate(() => location.hash) === '#/site/b2-cours-talons', n + 'lien de la notification : le planning s’ouvre, l’adresse redevient normale');
      await p.click('[data-action="talons-filtre"][data-valeur="inscrite"]'); await p.waitForTimeout(600);
    }
    if (sansProgramme) {
      ok(/supabase-programme-talons\.sql/.test(await p.textContent(fiche2 + '.ct-programme')) && !errs.length, n + 'programme pas encore collé : message clair, la fiche marche');
    } else {
      ok(await p.locator(fiche2 + '.ct-seance').count() === 4 && /4 \/ 4/.test(await p.textContent(fiche2 + '.ct-programme h3')), n + 'Son programme : les 4 dimanches remplis tout seuls (4 / 4)');
      ok(/Démarche et port de tête/.test(await p.textContent(fiche2 + '.ct-programme')) && /Dim\. 13 janv\. · 15 h – 18 h · Salle MA2M, Riviera Faya/.test(await p.textContent(fiche2 + '.ct-programme')), n + 'chaque séance : thème, date, heures, lieu');
      const envoi = await p.getAttribute(fiche2 + '.ct-msg[data-msg="programme"] a[data-pour="eleve"]', 'href');
      const rappel = decodeURIComponent(await p.getAttribute(fiche2 + '.ct-msg[data-msg="rappel"] a[data-pour="eleve"]', 'href'));
      ok(/Bonjour Madame AWA DIALLO,/.test(rappel) && /le dimanche 6 janvier, de 15 h à 18 h/.test(rappel) && /Lieu : Salle MA2M, Riviera Faya/.test(rappel) && /Thème : Posture et équilibre/.test(rappel) && /À prévoir : talons de 7 à 10 cm/.test(rappel) && rappel.includes('programme-talons?c=' + 'f'.repeat(36)),
        n + '« Rappel de la prochaine séance » : date, heures, lieu, thème, à prévoir, son lien');
      if (process.env.CAPTURES) await p.locator(fiche2 + '.ct-messages').screenshot({ path: process.env.CAPTURES + '/messages-payee-' + n.replace(/\W+/g, '') + '.png' });
      ok(/^https:\/\/wa\.me\/2250700000002\?text=/.test(envoi) && /Bonjour Madame AWA DIALLO/.test(decodeURIComponent(envoi)) && decodeURIComponent(envoi).includes('https://www.maitreakessemodelmanagement.com/programme-talons?c=' + 'f'.repeat(36)),
        n + 'WhatsApp : « Bonjour Madame … » avec son lien personnel');
      // (14/11/2026) groupe payé en une fois, 1 mois : « un mois de plus » ; 3 mois payés mois par mois : « Mois 2 payé »
      ok(/Tous ses mois sont payés \(1\)/.test(await p.textContent(fiche2 + '.ct-mois')) && await p.locator(fiche2 + '[data-action="talons-mois"]').count() === 2, n + 'groupe d’un mois, tout payé : « Un mois de plus » proposé');
      const f5 = '.ct-fiche[data-id="t5"] ';
      ok(/Civilité\s*Madame/.test(await p.textContent(f5 + '.ct-infos')) && /3 mois, 12 dimanches, payés mois par mois/.test(await p.textContent(f5 + '.ct-infos')) && /Mois payés\s*1 \/ 3/.test(await p.textContent(f5 + '.ct-infos')), n + 'fiche 3 mois : civilité, durée, « payés mois par mois », 1 / 3 mois payés');
      const lienMois = decodeURIComponent(await p.getAttribute(f5 + 'a:has-text("Lien du mois 2")', 'href'));
      ok(/^https:\/\/wa\.me\/2250700000005\?text=Bonjour Madame FATOU TROIS MOIS/.test(lienMois) && /mois 2 sur 3/.test(lienMois) && /amount=30000/.test(lienMois) && lienMois.includes('programme-talons?c=' + 'd'.repeat(36)), n + '« Lien du mois 2 » : WhatsApp avec le lien Wave de 30 000 et sa page');
      await p.click(f5 + '[data-action="talons-mois"]:not([data-valeur])'); await p.waitForTimeout(800);
      const appelMois = journal.find((j) => j[0] === 'rpc' && j[1] === 'cours_talons_mois_payer');
      ok(appelMois && JSON.parse(appelMois[2]).p_id === 't5' && JSON.parse(appelMois[2]).p_especes === false && JSON.parse(appelMois[2]).p_mois === 2 && /Mois payés : 2 \/ 3/.test(await p.textContent(f5 + '.ct-mois')), n + '« Mois 2 payé » : encaissé par la base, la fiche passe à 2 / 3');
      ok(await p.locator(fiche2 + 'a:has-text("Au parent")').count() === 0, n + 'élève majeure : pas de bouton « Au parent »');
      const parent = await p.getAttribute('.ct-fiche[data-id="t4"] .ct-msg[data-msg="programme"] a[data-pour="parent"]', 'href');
      ok(/^https:\/\/wa\.me\/2250500000004\?text=/.test(parent) && /Bonjour M\. Yao/.test(decodeURIComponent(parent)) && /L’inscription de Mademoiselle JEUNE AYA/.test(decodeURIComponent(parent)) && decodeURIComponent(parent).includes('programme-talons?c=' + 'e'.repeat(36)),
        n + 'élève mineure : son programme part aussi au parent (« Mademoiselle », son lien)');
      ok((await p.getAttribute(fiche2 + 'a:has-text("Voir sa page")', 'href')).endsWith('programme-talons?c=' + 'f'.repeat(36)), n + '« Voir sa page » ouvre sa page Mon programme');
      await p.click(fiche2 + '[data-action="talons-seance-faite"][data-id="s0"]'); await p.waitForTimeout(700);
      ok(d.tables.cours_talons_seances.find((x) => x.id === 's0').faite === true && /Faite ✓/.test(await p.textContent(fiche2 + '.ct-programme')) && await p.getAttribute(fiche2 + '[data-id="s0"][data-action="talons-seance-faite"]', 'aria-pressed') === 'true', n + 'séance 1 marquée « faite »');
      await p.click(fiche2 + '.ct-ajout summary');
      await p.fill('#ct-s-date-t2', '2030-02-03'); await p.fill('#ct-s-heure-t2', '16:30'); await p.selectOption('#ct-s-duree-t2', '90'); await p.fill('#ct-s-theme-t2', 'Rattrapage');
      await p.click(fiche2 + 'form[data-form="talons-seance"] button[type="submit"]'); await p.waitForTimeout(800);
      const ajout = d.tables.cours_talons_seances.find((x) => x.theme === 'Rattrapage');
      ok(ajout && ajout.inscription_id === 't2' && ajout.debut === '2030-02-03T16:30:00.000Z' && ajout.fin === '2030-02-03T18:00:00.000Z' && ajout.lieu === 'Salle MA2M, Riviera Faya', n + 'séance ajoutée : 3 févr., 16 h 30 – 18 h, salle par défaut');
      ok(await p.locator(fiche2 + '.ct-seance').count() === 5, n + 'la nouvelle séance apparaît dans son programme');
      await p.click(fiche2 + '[data-action="talons-seance-retirer"][data-id="' + ajout.id + '"]'); await p.waitForTimeout(700);
      ok(!d.tables.cours_talons_seances.some((x) => x.theme === 'Rattrapage') && await p.locator(fiche2 + '.ct-seance').count() === 4, n + 'séance retirée (après confirmation)');
      if (process.env.CAPTURES) { await p.locator(fiche2 + '.ct-programme').scrollIntoViewIfNeeded(); await p.screenshot({ path: process.env.CAPTURES + '/programme-admin-' + ecran.width + '.png' }); }
    }
    await p.click('.ct-fiche[data-id="t2"] [data-action="talons-statut"][data-valeur="terminee"]'); await p.waitForTimeout(700);
    ok(d.tables.cours_talons[1].statut === 'terminee', n + '« Cours terminés » enregistré');
    await p.click('[data-action="talons-filtre"][data-valeur="a_traiter"]'); await p.waitForTimeout(500);
    await p.click('.ct-fiche[data-id="t1"] [data-action="talons-statut"][data-valeur="annulee"]'); await p.waitForTimeout(700);
    ok(d.tables.cours_talons[0].statut === 'annulee' && !journal.some((j) => j[0] === 'DELETE' && j[1] === 'cours_talons'), n + 'inscription annulée (rien n’est effacé)');
    const deborde = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(deborde <= 1, n + 'aucun débordement horizontal (' + deborde + ' px)');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  // (16/11/2026, audit L-1) : l'« Administrateur du site » suit les élèves mais ne voit aucun bouton d'encaissement
  for (const ecran of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
    const tel = ecran.width < 700, n = 'rôle « site » ' + (tel ? 'téléphone' : 'ordinateur') + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const d = donnees('site');
    d.tables.cours_talons = [
      { id: 's1', cree_le: '2026-11-08T10:00:00Z', formule: 'prive_salle', nb_seances: 2, nom: 'ÉLÈVE À PAYER', telephone: '+2250701020311', age: 22, photos: [], decision: 'maintenant', statut: 'paiement_envoye', montant: 50000 },
      { id: 's2', cree_le: '2026-11-07T10:00:00Z', formule: 'groupe', nb_seances: 4, nb_mois: 3, paiement: 'mensuel', mois_payes: 1, nom: 'ÉLÈVE DU GROUPE', telephone: '+2250700000312', age: 24, photos: [],
        decision: 'maintenant', statut: 'inscrite', montant: 30000, valide_le: '2026-11-07T12:00:00Z', jeton: 'g'.repeat(36) }];
    d.tables.cours_talons_seances = []; d.tables.cours_talons_indispo = [];
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.coque:not(.sans-menu)');
    await p.goto(URL_ADMIN + '#/site/b2-cours-talons'); await p.waitForFunction(() => /Cours de talons/.test((document.querySelector('#contenu h1') || {}).textContent || ''), null, { timeout: 15000 }); await p.waitForTimeout(800);
    await p.click('[data-action="talons-filtre"][data-valeur="toutes"]').catch(() => {}); await p.waitForTimeout(500);
    const t = await p.textContent('#contenu');
    ok(t.includes('ÉLÈVE À PAYER') && t.includes('ÉLÈVE DU GROUPE'), n + 'les élèves restent visibles (suivi)');
    ok(!(await p.$('[data-action="talons-valider"]')) && !(await p.$('[data-action="talons-mois"]')), n + 'aucun bouton « Paiement reçu », « Payé en espèces » ni « Mois payé »');
    ok(/validé par les encaissements ou l’administrateur principal/.test(t), n + 'une phrase dit qui valide le paiement');
    ok(await p.$('.ct-fiche[data-id="s1"] [data-action="talons-statut"][data-valeur="annulee"]') !== null, n + '« Annuler l’inscription » reste possible');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ cours de talons (Administration) : tout passe');
  process.exit(ko ? 1 : 0);
})();
