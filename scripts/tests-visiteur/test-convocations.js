// Convocations des projets de l'agenda (Extension 141, 21/10/2026), dans le tableau de bord,
// comme l'agence : connexion → page « 📨 Convocations » (projet à venir ou nouveau projet ; heure de convocation, déroulé,
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
      agenda_projets: [projet, { id: 'pa1', type: 'defile', titre: 'DEFILE PASSE', date_debut: '2026-01-10', visible: true, annule: false, mannequin_ids: [], partenaire_ids: [], seances: [], intervenants: [], mannequins_libres: [], partenaires_libres: [] }], convocation_participants: [], convocation_envois: [], contacts_externes: [] },
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
  // Un même identifiant deux fois dans le tableau de bord : le message de la page Convocations
  // partait dans un autre écran, caché (« cv-msg », relevé par SonarQube Cloud le 21/10/2026)
  const ids = (require('fs').readFileSync(require('path').resolve(__dirname, '../../tableau-de-bord.html'), 'utf8').match(/ id="[^"]+"/g) || []);
  const doubles = ids.filter((x, i) => ids.indexOf(x) !== i);
  ok(!doubles.length, 'tableau de bord : aucun identifiant en double' + (doubles.length ? ' (' + doubles.join(', ') + ')' : ''));
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [nom, vp] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const n = nom + ' : ';
    const { ctx, p, errs, journal } = await connecter(b, vp, true);

    // 1. Agenda : « Convoquer » seulement sur les projets à venir → page Convocations, projet déjà choisi
    ok(!!(await p.$('[data-convoquer="pa2"]')) && !(await p.$('[data-convoquer="pa1"]')), n + 'Agenda : « Convoquer » sur le projet à venir, pas sur le projet passé');
    await p.click('[data-convoquer="pa2"]'); await p.waitForTimeout(1500);
    const choix = await p.$$eval('#cv-projet option', os => os.map(o => o.value + '|' + o.textContent));
    ok(await p.isVisible('#cv-form') && (await p.inputValue('#cv-projet')) === 'pa2' && (await p.inputValue('#cv-titre')) === 'AFRICA IN RHYTHM', n + 'page Convocations ouverte avec le projet choisi');
    ok(choix.length === 2 && choix[0].startsWith('|') && /AFRICA IN RHYTHM/.test(choix[1]) && !choix.some(c => /DEFILE PASSE/.test(c)), n + 'liste : « Nouveau projet » et les projets à venir seulement');
    ok((await p.$$eval('#cv-mannequins input:checked', cs => cs.map(c => c.value))).join() === 'm1,m2', n + 'mannequins du projet déjà cochés');
    await p.fill('#cv-heure-evenement', '20:00'); await p.fill('#cv-heure-convocation', '15:00');
    for (const [h, a] of [['15:00', 'Accueil'], ['15:30', 'Essayage'], ['18:00', 'Répétition']]) {
      await p.click('#cv-ajouter-etape');
      const l = p.locator('#cv-deroule .agenda-etape').last();
      await l.locator('[data-heure]').fill(h); await l.locator('[data-activite]').fill(a);
    }
    await p.fill('#cv-a-prevoir', 'Escarpins noirs\nPièce d’identité');
    await p.fill('#cv-rappel-heure', '19:00');
    if (process.env.CAPTURES) { await p.$eval('#cv-form', e => e.scrollIntoView()); await p.waitForTimeout(800); await p.screenshot({ path: process.env.CAPTURES + '/form-' + vp.width + '.png' }); }
    await p.$eval('#cv-enregistrer', x => x.click()); await p.waitForTimeout(1800);
    const maj = ecrits(journal, 'PATCH', 'agenda_projets').pop() || {};
    ok(maj.heure_convocation === '15:00' && maj.heure_evenement === '20:00' && maj.deroule.length === 3 && maj.deroule[1].activite === 'Essayage' && /Escarpins/.test(maj.a_prevoir) && maj.rappel_veille === true && maj.rappel_heure === '19:00' && maj.mannequin_ids.join() === 'm1,m2',
      n + 'projet enregistré avec convocation, déroulé, « À prévoir », rappel et mannequins');

    // 2. Panneau d'envoi
    ok(await p.isVisible('#convoc-panneau'), n + 'panneau « Convoquer » ouvert');
    const liste = await p.$$eval('#convoc-participants .convoc-personne', ls => ls.map(l => l.textContent));
    ok(liste.length === 3 && /Mademoiselle AWA KONÉ/.test(liste[0]) && /awa@test\.ci/.test(liste[0]) && /ama@test\.ci/.test(liste[1]) && !/parent/.test(liste[1]) && /parent : Madame Ama Mère/.test(liste[2]) && /mere@test\.ci/.test(liste[2]),
      n + 'mannequins du projet : la mineure reçoit son message ET son parent le sien');
    ok(/Fatou Bamba/.test(await p.textContent('#convoc-participants')), n + 'les mannequins écrits à la main sont signalés');
    // personne non inscrite
    await p.selectOption('#convoc-civilite', 'Monsieur'); await p.fill('#convoc-nom', 'Jean Styliste'); await p.fill('#convoc-tel', '0709090909'); await p.fill('#convoc-email', 'jean@test.ci');
    const blocParticipants = '#convoc-panneau fieldset.agenda-choix';
    if (process.env.CAPTURES) await p.locator(blocParticipants).first().screenshot({ path: process.env.CAPTURES + '/exterieur-avant-' + vp.width + '.png' });
    await p.click('#convoc-personne-ajouter'); await p.waitForTimeout(600);
    if (process.env.CAPTURES) await p.locator(blocParticipants).first().screenshot({ path: process.env.CAPTURES + '/exterieur-apres-' + vp.width + '.png' });
    const carnet = ecrits(journal, 'POST', 'contacts_externes').pop() || {};
    ok(carnet.nom === 'Jean Styliste' && carnet.civilite === 'Monsieur' && (await p.$$('#convoc-participants .convoc-personne')).length === 4, n + 'personne non inscrite ajoutée au carnet et à la liste');
    // aperçu
    const apercu = await p.textContent('#convoc-apercu');
    ok(/Bonjour Mademoiselle AWA KONÉ/.test(apercu) && /Vous êtes convoquée à 15h00 précises/.test(apercu) && /15h30 — Essayage/.test(apercu) && /Escarpins noirs/.test(apercu) && /Boulevard Hassan II/.test(apercu) && /Début : 20h00/.test(apercu),
      n + 'aperçu du message : convocation, programme, à prévoir, adresse');
    await p.selectOption('#convoc-apercu-qui', { index: 2 });
    ok(/Bonjour Madame Ama Mère/.test(await p.textContent('#convoc-apercu')) && /participation de Mademoiselle PETITE AMA/.test(await p.textContent('#convoc-apercu')), n + 'aperçu pour la mineure : adressé au parent');

    if (process.env.CAPTURES) { await p.$eval('#convoc-panneau', e => e.scrollIntoView()); await p.screenshot({ path: process.env.CAPTURES + '/panneau-' + vp.width + '.png', fullPage: false }); }
    // 3. Envoyer maintenant
    await p.click('#convoc-programmer'); await p.waitForTimeout(5500);
    const participants = ecrits(journal, 'POST', 'convocation_participants').flat();
    const lignesEnvois = ecrits(journal, 'POST', 'convocation_envois').flat();
    const emails = journal.filter(j => j[0] === 'EMAIL').map(j => JSON.parse(j[1]).template_params);
    ok(participants.length === 4 && participants.some(x => x.parent && x.email === 'mere@test.ci') && participants.some(x => !x.parent && x.email === 'ama@test.ci'), n + '4 participants enregistrés (la mineure et son parent)');
    ok(lignesEnvois.filter(l => l.sorte === 'convocation').length === 8 && lignesEnvois.filter(l => l.sorte === 'rappel').length === 8 && lignesEnvois.some(l => l.sorte === 'rappel' && l.prevu_le === '2030-11-14T19:00:00.000Z'),
      n + '8 convocations (e-mail + WhatsApp) et 8 rappels la veille à 19h00');
    ok(emails.length === 4 && emails.some(e => e.to_email === 'ama@test.ci') && emails.some(e => e.to_email === 'mere@test.ci' && e.to_name === 'Madame Ama Mère') && emails.every(e => !/\*/.test(e.message)), n + '4 e-mails envoyés tout de suite (la mineure et son parent), sans marques WhatsApp');
    ok(ecrits(journal, 'PATCH', 'convocation_envois').filter(x => x.statut === 'envoye').length === 4, n + 'e-mails marqués « envoyé »');
    ok(/4 e-mail\(s\) envoyé\(s\) sur 4/.test(await p.textContent('#convoc-msg')) && /Rappel de la veille/.test(await p.textContent('#convoc-msg')), n + 'bilan affiché');
    const wa = await p.$$eval('#convoc-suivi .convoc-envoi a[href^="https://wa.me/"]', as => as.map(a => a.href));
    ok(wa.length === 4 && wa.some(h => h.startsWith('https://wa.me/2250707070707?text=') && /Madame%20Ama%20M%C3%A8re/.test(h)), n + 'suivi : 4 « Ouvrir WhatsApp » prêts (la mineure et son parent)');
    await p.evaluate(() => { window.open = () => null; });
    await p.$eval('#convoc-suivi .convoc-envoi a[href^="https://wa.me/"]', a => { a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click(); }); await p.waitForTimeout(600);
    ok(ecrits(journal, 'PATCH', 'convocation_envois').filter(x => x.statut === 'envoye').length === 5, n + '« Ouvrir WhatsApp » : marqué envoyé');
    // bouton unique « WhatsApp suivant » : chaque appui passe à la personne suivante
    const suivant1 = await p.textContent('.convoc-suivant');
    await p.$eval('.convoc-suivant', a => { a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click(); }); await p.waitForTimeout(600);
    const suivant2 = await p.textContent('.convoc-suivant');
    ok(/3 restants/.test(suivant1) && /2 restants/.test(suivant2) && suivant1 !== suivant2 && ecrits(journal, 'PATCH', 'convocation_envois').filter(x => x.statut === 'envoye').length === 6,
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
    ok(await p.isVisible('#convoc-msg') && /Programmé pour/.test(await p.textContent('#convoc-msg')), n + 'message « Programmé pour … » affiché');
    // 5. Nouveau projet depuis la page : ajouté à l'agenda (visible, sans adresse publique) ; date passée refusée
    await p.selectOption('#cv-projet', '');
    ok((await p.inputValue('#cv-titre')) === '' && (await p.$$eval('#cv-mannequins input:checked', cs => cs.length)) === 0 && await p.isHidden('#convoc-panneau'), n + '« Nouveau projet » : page vierge');
    await p.fill('#cv-titre', 'SHOOTING TEST'); await p.fill('#cv-date', '2020-05-05'); await p.$eval('#cv-enregistrer', x => x.click()); await p.waitForTimeout(500);
    ok(await p.isVisible('#cv-etat') && /déjà passée/.test(await p.textContent('#cv-etat')), n + 'nouveau projet à une date passée : refusé');
    await p.fill('#cv-date', '2030-12-01'); await p.fill('#cv-lieu', 'Studio MA2M'); await p.$eval('#cv-mannequins input[value="m1"]', c => c.click());
    await p.$eval('#cv-enregistrer', x => x.click()); await p.waitForTimeout(1800);
    const cree = ecrits(journal, 'POST', 'agenda_projets').flat().pop() || {};
    ok(cree.titre === 'SHOOTING TEST' && cree.date_debut === '2030-12-01' && cree.visible === true && cree.mannequin_ids.join() === 'm1' && await p.isVisible('#convoc-panneau') && /ajouté à l’agenda/.test(await p.textContent('#cv-etat')), n + 'nouveau projet ajouté à l’agenda, panneau d’envoi ouvert');
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
    // convocation encore programmée (pas partie) : sans réponse, mais pas de relance possible
    d.tables.convocation_participants.push({ id: 'cp4', projet_id: 'pa2', contact_id: 'x2', nom: 'Madame Programmée Plustard', email: 'pp@test.ci', telephone: '0708080808', parent: false, jeton: J('d'), reponse: null });
    d.tables.convocation_envois.push({ id: 'e4', projet_id: 'pa2', participant_id: 'cp4', sorte: 'convocation', canal: 'whatsapp', statut: 'programme', prevu_le: '2030-11-12T10:00:00Z' });
    // projet passé dont la seule convocation a été annulée : pas dans « Voir les réponses »
    d.tables.convocation_envois.push({ id: 'e9', projet_id: 'pa1', participant_id: 'cpx', sorte: 'convocation', canal: 'email', statut: 'annule', prevu_le: '2026-01-09T10:00:00Z' });
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
    await p.$eval('#cv-enregistrer', x => x.click()); await p.waitForTimeout(1800);
    const chiffres = await p.textContent('.convoc-chiffres');
    const barre = await p.$$eval('.convoc-barre span', ss => ss.map(s => s.className + ' ' + Math.round(parseFloat(s.style.width))));
    const relance = await p.$$eval('#convoc-reponses .convoc-relance', as => as.map(a => decodeURIComponent(a.href) + '|' + a.textContent));
    ok(/4 convoqué\(s\) · 1 confirmé · 1 absent · 2 sans réponse/.test(chiffres) && barre.length === 3 && barre.map(x => x.split(' ')[1]).join() === '25,25,50', 'réponses : chiffres et barre de couleur (' + chiffres + ')');
    ok(relance.length === 1 && relance[0].startsWith('https://wa.me/2250707070707') && relance[0].includes('/confirmer?c=' + J('b')) && /Madame Ama Mère/.test(relance[0]) && /Relancer la suivante : Mademoiselle PETITE AMA.*\(1 restante\)/.test(relance[0]),
      'sans réponse : un seul bouton « Relancer la suivante », avec le lien personnel (au parent)');
    // un appui : WhatsApp s'ouvre pour elle, puis le bouton laisse place à « toutes relancées »
    await p.evaluate(() => { window.open = () => null; });
    await p.$eval('#convoc-reponses .convoc-relance', a => { a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click(); }); await p.waitForTimeout(500);
    ok(!(await p.$('#convoc-reponses .convoc-relance')) && /Toutes les personnes sans réponse ont été relancées/.test(await p.textContent('#convoc-reponses')) && /relancé\(e\)/.test(await p.textContent('#convoc-reponses')),
      'relance : après l’appui, la personne est marquée « relancé(e) », plus personne à relancer');
    ok(/A confirmé sa présence/.test(await p.textContent('#convoc-participants')) && /Ne pourra pas venir/.test(await p.textContent('#convoc-participants')), 'réponses visibles dans la liste des participants');
    // « 📋 Voir les réponses » en haut de la page Convocations : choisir un projet déjà convoqué
    await p.evaluate(() => document.querySelector('.tdb-menu-item[data-tdb-cible="b2-convocations"]').click()); await p.waitForTimeout(800);
    ok(await p.isHidden('#cv-reponses-bloc'), '« Voir les réponses » : fermé à l’ouverture de la page');
    await p.click('#cv-voir-reponses'); await p.waitForTimeout(1200);
    const choix = await p.$$eval('#cv-reponses-projet option', os => os.map(o => o.value));
    ok(await p.isVisible('#cv-reponses-projet') && choix.join() === ',pa2', '« Voir les réponses » : seuls les projets convoqués sont proposés (' + choix.join() + ')');
    await p.selectOption('#cv-reponses-projet', 'pa2'); await p.waitForTimeout(1200);
    const vue = await p.textContent('#cv-reponses');
    ok(/4 convoqué\(s\) · 1 confirmé · 1 absent · 2 sans réponse/.test(vue) && await p.isVisible('#cv-reponses >> text=Mademoiselle AWA KONÉ') && await p.isVisible('#cv-reponses >> text=Monsieur Jean Styliste')
      && await p.isVisible('#cv-reponses-actualiser'),
      '« Voir les réponses » : confirmés, absents et sans réponse visibles (' + vue.slice(0, 80) + ')');
    if (process.env.CAPTURES) await p.locator('.convoc-voir').screenshot({ path: process.env.CAPTURES + '/voir-reponses-390.png' });
    ok(!ecrits(journal, 'POST', 'convocation_envois').length && !ecrits(journal, 'PATCH', 'convocation_envois').length, '« Voir les réponses » : rien n’est envoyé');
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
    ok(!(await p.$('[data-convoquer]')), 'sans l’Extension 141 : pas de « Convoquer » dans l’Agenda');
    await p.click('[data-modifier="pa2"]'); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('.tdb-menu-item[data-tdb-cible="b2-convocations"]').click()); await p.waitForTimeout(1200);
    ok(await p.isVisible('#cv-inactif') && await p.isDisabled('#cv-titre'), 'sans l’Extension 141 : page Convocations avec le message pour l’activer, champs grisés');
    ok(!errs.filter(e => !/convocation_envois/.test(e)).length, 'sans l’Extension 141 : aucune erreur de page');
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.');
  process.exit(ko ? 1 : 0);
})();
