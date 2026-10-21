// Convocations des projets de l'agenda (Extension 141, 21/10/2026), dans le tableau de bord,
// comme l'agence : connexion → Agenda → « Modifier » un défilé (heure de convocation, déroulé,
// « À prévoir », rappel) → « 📨 Convoquer » → participants (adulte, mineure → parent, personne
// non inscrite ajoutée au carnet) → aperçu du message → « Envoyer maintenant » (e-mails partis,
// WhatsApp prêts, « Ouvrir WhatsApp ») → programmation « dans 1 heure » et date passée refusée.
// Puis l'agenda sans l'Extension 141 : pas de bouton « Convoquer », message pour l'activer.
// Téléphone et ordinateur. Base et EmailJS simulés : rien n'est écrit ni envoyé pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9800 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const BASE = 'http://127.0.0.1:' + PORT + '/';

function donnees(actif) {
  const projet = { id: 'pa2', type: 'defile', titre: 'AFRICA IN RHYTHM', date_debut: '2030-11-15', ville: 'Abidjan', lieu: 'Hôtel Ivoire', pays: "Côte d'Ivoire",
    adresse: 'Boulevard Hassan II, Cocody', visible: true, annule: false, mannequin_ids: ['m1', 'm2'], partenaire_ids: [], seances: [], intervenants: [],
    mannequins_libres: ['Fatou Bamba'], partenaires_libres: [] };
  if (actif) Object.assign(projet, { heure_evenement: null, heure_convocation: null, deroule: [], a_prevoir: null, rappel_veille: true, rappel_heure: '18:00', message_modele: null });
  return {
    memoriser: true,
    tables: { admins: [{ user_id: 'admin-1' }], casting_applications: [],
      model_profiles: [{ id: 'm1', full_name: 'AWA KONÉ', published: true }, { id: 'm2', full_name: 'PETITE AMA', published: true }],
      agenda_projets: [projet], convocation_participants: [], convocation_envois: [], contacts_externes: [] },
    rpc: { code_validation_statut: [{ defini: true }],
      convocation_contacts_mannequins: [
        { model_id: 'm1', full_name: 'AWA KONÉ', category: 'femme', phone: '0701020304', contact_email: 'awa@test.ci', date_naissance: '1999-01-01' },
        { model_id: 'm2', full_name: 'PETITE AMA', category: 'femme', phone: '0705050505', contact_email: 'ama@test.ci', date_naissance: '2015-01-01',
          parent_nom: 'Madame Ama Mère', parent_telephone: '0707070707', parent_email: 'mere@test.ci' }] }
  };
}

async function connecter(b, vp, actif) {
  const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 700, hasTouch: vp.width < 700 });
  const p = await ctx.newPage(); const errs = [], journal = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.addInitScript(() => { sessionStorage.setItem('ma2m_code_valide', '1'); localStorage.setItem('ma2m_cookies', 'non'); window.confirm = () => true; });
  await brancher(p, donnees(actif), journal);
  // sans l'Extension 141 : la table des envois n'existe pas encore
  if (!actif) await p.route(/\/rest\/v1\/convocation_envois/, r => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: '42P01', message: 'relation "convocation_envois" does not exist' }) }));
  await p.goto(BASE + 'tableau-de-bord.html'); await p.waitForTimeout(1000);
  await p.fill('#tb-email', 'admin@test.ci'); await p.fill('#tb-password', 'motdepasse'); await p.click('#tb-login-btn');
  await p.waitForSelector('#bloc-tableau', { state: 'visible', timeout: 15000 });
  await p.evaluate(() => document.querySelector('.tdb-menu-item[data-tdb-cible="b3c-agenda"]').click()); await p.waitForTimeout(1500);
  return { ctx, p, errs, journal };
}
const ecrits = (journal, m, table) => journal.filter(j => j[0] === m && j[1] === table).map(j => JSON.parse(j[3] || 'null'));

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [nom, vp] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const n = nom + ' : ';
    const { ctx, p, errs, journal } = await connecter(b, vp, true);

    // 1. Le projet : heure, déroulé, « À prévoir », rappel
    ok(await p.isVisible('#agenda-heure-convocation') && !(await p.isVisible('#agenda-convocation-inactive')), n + 'champs de convocation dans le formulaire du projet');
    await p.click('[data-modifier="pa2"]'); await p.waitForTimeout(400);
    await p.fill('#agenda-heure-evenement', '20:00'); await p.fill('#agenda-heure-convocation', '15:00');
    for (const [h, a] of [['15:00', 'Accueil'], ['15:30', 'Essayage'], ['18:00', 'Répétition']]) {
      await p.click('#agenda-ajouter-etape');
      const l = p.locator('#agenda-deroule .agenda-etape').last();
      await l.locator('[data-heure]').fill(h); await l.locator('[data-activite]').fill(a);
    }
    await p.fill('#agenda-a-prevoir', 'Escarpins noirs\nPièce d’identité');
    await p.fill('#agenda-rappel-heure', '19:00');
    if (process.env.CAPTURES) { await p.$eval('#agenda-convocation-champs', e => e.scrollIntoView()); await p.waitForTimeout(800); await p.screenshot({ path: process.env.CAPTURES + '/form-' + vp.width + '.png' }); }
    await p.$eval('#agenda-enregistrer', x => x.click()); await p.waitForTimeout(1200);
    const maj = ecrits(journal, 'PATCH', 'agenda_projets').pop() || {};
    ok(maj.heure_convocation === '15:00' && maj.heure_evenement === '20:00' && maj.deroule.length === 3 && maj.deroule[1].activite === 'Essayage' && /Escarpins/.test(maj.a_prevoir) && maj.rappel_veille === true && maj.rappel_heure === '19:00',
      n + 'projet enregistré avec convocation, déroulé, « À prévoir » et rappel');

    // 2. « Convoquer »
    await p.click('[data-convoquer="pa2"]'); await p.waitForTimeout(1200);
    ok(await p.isVisible('#convoc-panneau'), n + 'panneau « Convoquer » ouvert');
    const liste = await p.$$eval('#convoc-participants .convoc-personne', ls => ls.map(l => l.textContent));
    ok(liste.length === 2 && /Mademoiselle AWA KONÉ/.test(liste[0]) && /awa@test\.ci/.test(liste[0]) && /parent : Madame Ama Mère/.test(liste[1]) && /mere@test\.ci/.test(liste[1]),
      n + 'mannequins du projet, la mineure avec son parent');
    ok(/Fatou Bamba/.test(await p.textContent('#convoc-participants')), n + 'les mannequins écrits à la main sont signalés');
    // personne non inscrite
    await p.selectOption('#convoc-civilite', 'Monsieur'); await p.fill('#convoc-nom', 'Jean Styliste'); await p.fill('#convoc-tel', '0709090909'); await p.fill('#convoc-email', 'jean@test.ci');
    await p.click('#convoc-personne-ajouter'); await p.waitForTimeout(600);
    const carnet = ecrits(journal, 'POST', 'contacts_externes').pop() || {};
    ok(carnet.nom === 'Jean Styliste' && carnet.civilite === 'Monsieur' && (await p.$$('#convoc-participants .convoc-personne')).length === 3, n + 'personne non inscrite ajoutée au carnet et à la liste');
    // aperçu
    const apercu = await p.textContent('#convoc-apercu');
    ok(/Bonjour Mademoiselle AWA KONÉ/.test(apercu) && /Vous êtes convoquée à 15h00 précises/.test(apercu) && /15h30 — Essayage/.test(apercu) && /Escarpins noirs/.test(apercu) && /Boulevard Hassan II/.test(apercu) && /Début : 20h00/.test(apercu),
      n + 'aperçu du message : convocation, programme, à prévoir, adresse');
    await p.selectOption('#convoc-apercu-qui', { index: 1 });
    ok(/Bonjour Madame Ama Mère/.test(await p.textContent('#convoc-apercu')) && /participation de Mademoiselle PETITE AMA/.test(await p.textContent('#convoc-apercu')), n + 'aperçu pour la mineure : adressé au parent');

    if (process.env.CAPTURES) { await p.$eval('#convoc-panneau', e => e.scrollIntoView()); await p.screenshot({ path: process.env.CAPTURES + '/panneau-' + vp.width + '.png', fullPage: false }); }
    // 3. Envoyer maintenant
    await p.click('#convoc-programmer'); await p.waitForTimeout(5500);
    const participants = ecrits(journal, 'POST', 'convocation_participants').flat();
    const lignesEnvois = ecrits(journal, 'POST', 'convocation_envois').flat();
    const emails = journal.filter(j => j[0] === 'EMAIL').map(j => JSON.parse(j[1]).template_params);
    ok(participants.length === 3 && participants.some(x => x.parent && x.email === 'mere@test.ci'), n + '3 participants enregistrés (parent pour la mineure)');
    ok(lignesEnvois.filter(l => l.sorte === 'convocation').length === 6 && lignesEnvois.filter(l => l.sorte === 'rappel').length === 6 && lignesEnvois.some(l => l.sorte === 'rappel' && l.prevu_le === '2030-11-14T19:00:00.000Z'),
      n + '6 convocations (e-mail + WhatsApp) et 6 rappels la veille à 19h00');
    ok(emails.length === 3 && emails.some(e => e.to_email === 'mere@test.ci' && e.to_name === 'Madame Ama Mère') && emails.every(e => !/\*/.test(e.message)), n + '3 e-mails envoyés tout de suite (le parent pour la mineure), sans marques WhatsApp');
    ok(ecrits(journal, 'PATCH', 'convocation_envois').filter(x => x.statut === 'envoye').length === 3, n + 'e-mails marqués « envoyé »');
    ok(/3 e-mail\(s\) envoyé\(s\) sur 3/.test(await p.textContent('#convoc-msg')) && /Rappel de la veille/.test(await p.textContent('#convoc-msg')), n + 'bilan affiché');
    const wa = await p.$$eval('#convoc-suivi .convoc-envoi a[href^="https://wa.me/"]', as => as.map(a => a.href));
    ok(wa.length === 3 && wa.some(h => h.startsWith('https://wa.me/2250707070707?text=') && /Madame%20Ama%20M%C3%A8re/.test(h)), n + 'suivi : 3 « Ouvrir WhatsApp » prêts (le parent pour la mineure)');
    await p.evaluate(() => { window.open = () => null; });
    await p.$eval('#convoc-suivi .convoc-envoi a[href^="https://wa.me/"]', a => { a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click(); }); await p.waitForTimeout(600);
    ok(ecrits(journal, 'PATCH', 'convocation_envois').filter(x => x.statut === 'envoye').length === 4, n + '« Ouvrir WhatsApp » : marqué envoyé');
    // bouton unique « WhatsApp suivant » : chaque appui passe à la personne suivante
    const suivant1 = await p.textContent('.convoc-suivant');
    await p.$eval('.convoc-suivant', a => { a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click(); }); await p.waitForTimeout(600);
    const suivant2 = await p.textContent('.convoc-suivant');
    ok(/2 restants/.test(suivant1) && /1 restant\)/.test(suivant2) && suivant1 !== suivant2 && ecrits(journal, 'PATCH', 'convocation_envois').filter(x => x.statut === 'envoye').length === 5,
      n + '« Envoyer le WhatsApp suivant » : une personne par appui (' + suivant1.replace(/\s+/g, ' ') + ')');
    ok((await p.$$eval('#convoc-participants input:checked', cs => cs.length)) === 0 && /Déjà convoqué/.test(await p.textContent('#convoc-participants')), n + 'après l’envoi : personne n’est recochée, « Déjà convoqué(e) »');

    if (process.env.CAPTURES) { await p.$eval('#convoc-suivi', e => e.scrollIntoView()); await p.screenshot({ path: process.env.CAPTURES + '/suivi-' + vp.width + '.png' }); }
    // 4. Programmer dans 1 heure ; date passée refusée
    await p.$eval('#convoc-participants input[type=checkbox]', c => c.click());
    await p.selectOption('#convoc-quand', 'date'); await p.fill('#convoc-date', '2020-01-01T10:00'); await p.click('#convoc-programmer'); await p.waitForTimeout(400);
    ok(/déjà passée/.test(await p.textContent('#convoc-msg')), n + 'date passée refusée');
    const avant = journal.filter(j => j[0] === 'EMAIL').length;
    await p.selectOption('#convoc-quand', '60'); await p.click('#convoc-programmer'); await p.waitForTimeout(1200);
    const prog = ecrits(journal, 'POST', 'convocation_envois').pop();
    const dansUneHeure = prog.filter(l => l.sorte === 'convocation');
    ok(dansUneHeure.length === 2 && dansUneHeure.every(l => l.statut === 'programme' && Math.abs(new Date(l.prevu_le) - Date.now() - 3600000) < 120000) && journal.filter(j => j[0] === 'EMAIL').length === avant,
      n + '« Dans 1 heure » : envois programmés, rien ne part tout de suite');
    ok(/Programmé pour/.test(await p.textContent('#convoc-msg')), n + 'message « Programmé pour … »');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), n + 'rien ne dépasse de l’écran');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }

  // 5bis. Réponses des participants (lien « Confirmez votre présence »)
  {
    const J = (c) => c.repeat(36);
    const d = donnees(true);
    Object.assign(d.tables.agenda_projets[0], { heure_convocation: '15:00' });
    d.tables.convocation_participants = [
      { id: 'cp1', projet_id: 'pa2', model_id: 'm1', nom: 'Mademoiselle AWA KONÉ', email: 'awa@test.ci', telephone: '0701020304', parent: false, jeton: J('a'), reponse: 'confirme', repondu_le: '2030-11-10T09:00:00Z' },
      { id: 'cp2', projet_id: 'pa2', model_id: 'm2', nom: 'Mademoiselle PETITE AMA', email: 'mere@test.ci', telephone: '0707070707', parent: true, parent_nom: 'Madame Ama Mère', jeton: J('b'), reponse: null },
      { id: 'cp3', projet_id: 'pa2', contact_id: 'x1', nom: 'Monsieur Jean Styliste', email: 'jean@test.ci', telephone: '0709090909', parent: false, jeton: J('c'), reponse: 'absent', repondu_le: '2030-11-11T09:00:00Z' }];
    d.tables.contacts_externes = [{ id: 'x1', civilite: 'Monsieur', nom: 'Jean Styliste', telephone: '0709090909', email: 'jean@test.ci' }];
    d.tables.convocation_envois = ['cp1', 'cp2', 'cp3'].map((id, i) => ({ id: 'e' + i, projet_id: 'pa2', participant_id: id, sorte: 'convocation', canal: 'email', statut: 'envoye', prevu_le: '2030-11-09T10:00:00Z', envoye_le: '2030-11-09T10:00:00Z' }));
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage(); const journal = [], errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { sessionStorage.setItem('ma2m_code_valide', '1'); localStorage.setItem('ma2m_cookies', 'non'); });
    await brancher(p, d, journal);
    await p.goto(BASE + 'tableau-de-bord.html'); await p.waitForTimeout(1000);
    await p.fill('#tb-email', 'admin@test.ci'); await p.fill('#tb-password', 'motdepasse'); await p.click('#tb-login-btn');
    await p.waitForSelector('#bloc-tableau', { state: 'visible', timeout: 15000 });
    await p.evaluate(() => document.querySelector('.tdb-menu-item[data-tdb-cible="b3c-agenda"]').click()); await p.waitForTimeout(1500);
    await p.click('[data-convoquer="pa2"]'); await p.waitForTimeout(1500);
    const chiffres = await p.textContent('.convoc-chiffres');
    const barre = await p.$$eval('.convoc-barre span', ss => ss.map(s => s.className + ' ' + Math.round(parseFloat(s.style.width))));
    const relance = await p.$$eval('.convoc-reponse a', as => as.map(a => decodeURIComponent(a.href)));
    ok(/3 convoqué\(s\) · 1 confirmé · 1 absent · 1 sans réponse/.test(chiffres) && barre.length === 3 && barre.every(x => / 33$/.test(x)), 'réponses : chiffres et barre de couleur (' + chiffres + ')');
    ok(relance.length === 1 && relance[0].startsWith('https://wa.me/2250707070707') && relance[0].includes('/confirmer?c=' + J('b')) && /Madame Ama Mère/.test(relance[0]), 'sans réponse : « Relancer sur WhatsApp » avec le lien personnel (au parent)');
    ok(/A confirmé sa présence/.test(await p.textContent('#convoc-participants')) && /Ne pourra pas venir/.test(await p.textContent('#convoc-participants')), 'réponses visibles dans la liste des participants');
    ok(!errs.length, 'réponses : aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  // 5ter. La page publique « Confirmer ma présence » (sans compte)
  for (const [nom, vp] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const J = 'd'.repeat(36);
    const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 700, hasTouch: vp.width < 700 });
    const p = await ctx.newPage(); const journal = [], errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await brancher(p, { tables: {}, rpc: {
      convocation_lire: (x) => x.p_jeton === J ? [{ titre: 'AFRICA IN RHYTHM', type: 'defile', date_debut: '2030-11-15', heure_convocation: '15:00', lieu: 'Hôtel Ivoire', ville: 'Abidjan', nom: 'Mademoiselle AWA KONÉ', parent: false, reponse: null, passe: false }] : [],
      convocation_repondre: () => true } }, journal);
    await p.goto(BASE + 'confirmer.html?c=' + J); await p.waitForTimeout(1500);
    const details = await p.textContent('#cf-details');
    ok(/AFRICA IN RHYTHM/.test(await p.textContent('#cf-titre')) && /Mademoiselle AWA KONÉ/.test(details) && /Vendredi 15 novembre 2030|vendredi 15 novembre 2030/.test(details) && /15h00/.test(details), nom + ' : la page montre le projet (' + details + ')');
    await p.click('#cf-oui'); await p.waitForTimeout(800);
    const envoi = journal.find(j => j[0] === 'rpc' && j[1] === 'convocation_repondre');
    ok(envoi && JSON.parse(envoi[2]).p_reponse === 'confirme' && /présence est confirmée/.test(await p.textContent('#cf-resultat')), nom + ' : « Je confirme ma présence » enregistré');
    await p.click('#cf-non'); await p.waitForTimeout(800);
    ok(/ne pourrez pas venir/.test(await p.textContent('#cf-resultat')), nom + ' : on peut changer d’avis (« Je ne pourrai pas venir »)');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), nom + ' : rien ne dépasse');
    if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + '/confirmer-' + vp.width + '.png' });
    await p.goto(BASE + 'confirmer.html?c=' + 'e'.repeat(36)); await p.waitForTimeout(1200);
    ok(/pas valable/.test(await p.textContent('#cf-details')) && await p.isHidden('#cf-boutons'), nom + ' : lien inconnu → message clair, pas de boutons');
    ok(!errs.length, nom + ' : page de confirmation sans erreur ' + errs.join(' | '));
    await ctx.close();
  }
  // 5. Extension 141 pas encore exécutée
  {
    const { ctx, p, errs } = await connecter(b, { width: 1280, height: 900 }, false);
    ok(await p.isVisible('#agenda-convocation-inactive') && await p.isDisabled('#agenda-heure-convocation') && !(await p.$('[data-convoquer]')), 'sans l’Extension 141 : message pour l’activer, champs grisés, pas de « Convoquer »');
    await p.click('[data-modifier="pa2"]'); await p.waitForTimeout(300);
    ok(!errs.filter(e => !/convocation_envois/.test(e)).length, 'sans l’Extension 141 : aucune erreur de page');
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.');
  process.exit(ko ? 1 : 0);
})();
