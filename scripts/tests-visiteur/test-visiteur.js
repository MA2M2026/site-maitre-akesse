const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(8800 + Math.floor(Math.random() * 100));
const choisir = async (p, sel, pref) => { const v = await p.$eval(sel, (s, pref) => { const o = [...s.options].find(o => o.value && (!pref || o.value.includes(pref) || o.textContent.includes(pref))) || [...s.options].find(o => o.value); return o ? o.value : ''; }, pref); await p.selectOption(sel, v); };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const pages = [
    ['academie.html', { width: 390, height: 844 }],
    ['en/academie.html', { width: 1280, height: 900 }],
    ['candidature.html', { width: 1280, height: 900 }],
    ['en/candidature.html', { width: 390, height: 844 }],
    ['representation.html', { width: 768, height: 1024 }],
    ['en/representation.html', { width: 390, height: 844 }],
  ];
  for (const [page, vp] of pages) {
    const representation = page.endsWith('representation.html');
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', e => errs.push(e.message));
    await brancher(p, { tables: { casting_projets: [{ nom: 'Défilé X', actif: true, description: 'Grand défilé', date_casting: '2030-12-05', lieu: 'Hôtel Ivoire' }] }, rpc: { casting_ouvert: true } }, journal);
    // (14/11/2026) formulaire en 4 étapes puis résumé (js/candidature-etapes.js) : « Suivant » comme une vraie candidate
    const etape = () => p.evaluate(() => window.CandidatureEtapes && window.CandidatureEtapes.etape());
    const suivant = async () => { await p.click('.lx-etape:not([hidden]) .lx-suivant'); await p.waitForTimeout(400); };
    // Google Drive simulé (photos, puis vidéo en morceaux) : rien n'est envoyé pour de vrai
    await p.route(/script\.google\.com/, (route) => {
      const c = JSON.parse(route.request().postData() || '{}');
      const rep = c.action === 'video_debut' ? { ok: true, session: 's1', dossier: 'd1' } : c.action === 'video_morceau' ? { ok: true, video: 'https://drive.google.com/video' }
        : { ok: true, liens: (c.photos || []).map((x, i) => 'https://drive.google.com/photo-' + i), dossier: 'd1' };
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rep) });
    });
    const racine = 'http://127.0.0.1:' + PORT;
    const prefixe = page.startsWith('en/') ? '/en/' : '/';
    await p.goto(racine + prefixe + 'candidature-ma2m.html');
    await p.click('.ma2m-action');
    await p.locator('.ma2m-choix a[href^="/' + page + '?"]').click();
    await p.locator('.ma2m-entete-formulaire').waitFor();
    if (await p.isVisible('.site-header-v2')) throw new Error('Le formulaire affiche encore le menu du site.');
    await p.waitForTimeout(1000);
    if (await p.isVisible('#bandeau-cookies [data-cookies="oui"]')) await p.click('#bandeau-cookies [data-cookies="oui"]');
    // Remplissage comme une candidate de 15 ans
    // Intégrer l'agence : parcours débutant ; Postuler à un casting : choix du projet
    if (!representation && await p.$('#ca-porte')) await choisir(p, '#ca-porte', 'equipe');   // (3 portes, 25/11/2026 : l'expérience n'est demandée que pour l'équipe)
    if (!representation && await p.$('#ca-experience')) await p.click('.ma2m-experience[data-valeur=non]');
    const etapesVues = [await etape()];
    if (await p.$('.lx-casting')) {
      await suivant();
      const sansCasting = await etape() === 1 && /casting/i.test(await p.textContent('.lx-etape:not([hidden]) .form-msg'));
      const carte = await p.textContent('.lx-casting');
      await p.click('.lx-casting'); await p.waitForTimeout(200);
      const carteOk = /Défilé X/.test(carte) && /Grand défilé/.test(carte) && /Hôtel Ivoire/.test(carte) && /5 (déc|Dec)/.test(carte) && await p.inputValue('#ca-projet') === 'Défilé X' && await p.getAttribute('.lx-casting', 'aria-checked') === 'true';
      if (!sansCasting || !carteOk) { console.log('❌ ÉCHEC cartes des castings sur', page, sansCasting, carteOk, carte); process.exitCode = 1; }
    }
    await suivant(); etapesVues.push(await etape());
    await p.fill('#ca-nom', 'Awa Koné');
    await p.fill('#ca-email', 'awa@test.ci');
    await p.fill('#ca-telephone-numero', '0700000001'); await suivant();
    await choisir(p, '#ca-ville', 'Abidjan'); await p.waitForTimeout(200);
    if (await p.isVisible('#ca-commune')) await choisir(p, '#ca-commune', 'Cocody');
    // (22/11/2026, minimisation ARTCI) plus de scolarité, de niveau d'études, de quartier ni de date de naissance :
    // « 18 ans ou plus » ou « moins de 18 ans » ; poids facultatif
    const minimise = !(await p.$('#ca-scolarite')) && !(await p.$('#ca-etudes-cat')) && !(await p.$('#ca-quartier')) && !(await p.$('#ca-naissance'))
      && !(await p.$eval('#ca-poids', (e) => e.required)) && await p.$eval('#ca-majorite', (e) => e.required && e.options.length === 3)
      && /parent/.test(await p.textContent('#ca-majorite-pourquoi')) && /sensibles|sensitive/.test(await p.textContent('#ca-message-conseil'));
    if (!minimise) { console.log('❌ ÉCHEC minimisation des données sur', page); process.exitCode = 1; } else console.log('✓ ' + page + ' : ni date de naissance, ni quartier, ni scolarité, ni niveau d’études ; poids facultatif ; raisons affichées');
    // sans choisir son âge : l'étape « Vous » refuse d'avancer
    await suivant();
    const refus12ans = await etape() === 2 && await p.isVisible('#ca-majorite') && !journal.some(j => j[0] === 'POST' && j[1] === 'casting_applications');
    await p.selectOption('#ca-majorite', 'mineur');
    await choisir(p, '#ca-genre', 'femme');
    const caseCivilite = await p.isVisible('#ca-civilite');
    await p.selectOption('#ca-civilite', 'Madame');
    await suivant(); const refusMessage = await etape() === 2 && /Message/.test(await p.textContent('.lx-etape:not([hidden]) .form-msg'));
    await p.fill('#ca-message', 'Je veux devenir mannequin.');
    await suivant();
    const blocParent = await p.isVisible('#ca-bloc-parent')
      && /4 (sur|of) 9/.test(await p.textContent('.lx-progression .actif small'));
    // (24/11/2026) une ado recopie SES coordonnées à la place de celles du parent : refusé, champ par champ ; message obligatoire
    await p.selectOption('#ca-parent-civilite', 'Madame'); await p.fill('#ca-parent-nom', 'Koné Awa');
    await p.fill('#ca-parent-telephone-numero', '0700000099'); await p.fill('#ca-parent-email', 'parent@test.ci');
    const msgEtape = () => p.textContent('.lx-etape:not([hidden]) .form-msg');
    await suivant(); const refusNom = await etape() === 2 && /(nom de votre parent|parent’s or guardian’s name)/.test(await msgEtape());
    await p.fill('#ca-parent-nom', 'Kouassi Marie'); await p.fill('#ca-parent-telephone-numero', '07 00 00 00 01');
    await suivant(); const refusTel = await etape() === 2 && /WhatsApp/.test(await msgEtape());
    await p.fill('#ca-parent-telephone-numero', '0700000099'); await p.fill('#ca-parent-email', 'AWA@test.ci');
    await suivant(); const refusMail = await etape() === 2 && /(e-mail|email)/i.test(await msgEtape());
    await p.fill('#ca-parent-email', 'parent@test.ci');
    const etoilesParent = await p.evaluate(() => ['ca-parent-civilite', 'ca-parent-nom', 'ca-parent-indicatif', 'ca-parent-email'].every((id) => /\*\s*$/.test(document.querySelector('label[for="' + id + '"]').textContent)));
    if (!refusMessage || !refusNom || !refusTel || !refusMail || !etoilesParent) { console.log('❌ ÉCHEC parent / message obligatoires sur', page, refusMessage, refusNom, refusTel, refusMail, etoilesParent); process.exitCode = 1; }
    else console.log('✓ ' + page + ' : message obligatoire ; nom, WhatsApp et e-mail de la candidate refusés comme parent ; champs du parent avec *');
    await suivant(); etapesVues.push(await etape());
    await choisir(p, '#ca-taille', '160'); await choisir(p, '#ca-vetements', '');
    for (const sel of ['#ca-pointure', '#ca-poitrine', '#ca-tourtaille', '#ca-hanches']) if (await p.isVisible(sel)) await choisir(p, sel, '');
    await suivant(); etapesVues.push(await etape());
    if (await p.locator('.lx-etape:not([hidden]) .ma2m-guide-medias img').count() !== 2) {
      console.log('❌ ÉCHEC exemples de cadrage sur', page); process.exitCode = 1;
    }
    // photos manquantes : l'étape 4 le dit
    await suivant();
    const sansPhotos = await etape() === 4 && /photo/i.test(await p.textContent('.lx-etape:not([hidden]) .form-msg'));
    await p.setInputFiles('#ca-photos', [0, 1, 2, 3].map(i => __dirname + '/medias/photo' + i + '.jpg')); await p.waitForTimeout(1500);
    await suivant(); etapesVues.push(await etape());
    await suivant();
    const sansVideo = await etape() === 5 && /vid[eé]o/i.test(await p.textContent('.lx-etape:not([hidden]) .form-msg'));
    await p.setInputFiles('#ca-video', __dirname + '/medias/video.mp4'); await p.waitForTimeout(4000);
    // (24/11/2026) consignes de la vidéo + engagement obligatoire
    await suivant(); const refusConsignes = await etape() === 5 && /(consignes|instructions)/i.test(await p.textContent('.lx-etape:not([hidden]) .form-msg'));
    const consignes = await p.textContent('.ca-video-aide');
    if (!refusConsignes || !/TikTok/.test(consignes) || !/(quelques pas|few steps)/.test(consignes)) { console.log('❌ ÉCHEC consignes vidéo sur', page, refusConsignes, consignes.slice(0, 120)); process.exitCode = 1; }
    else console.log('✓ ' + page + ' : consignes de la vidéo (pas de TikTok, quelques pas) et case « Ma vidéo respecte ces consignes » obligatoire');
    await p.check('#ca-video-consignes');
    await suivant(); etapesVues.push(await etape());
    // le résumé « Votre candidature » : chaque ligne, avec « Changer »
    const resume = await p.textContent('.lx-recap');
    const resumeOk = /(Madame|Mrs) Awa Koné/.test(resume) && /Abidjan/.test(resume) && /1,60 m|1\.60 m/.test(resume) && /4 photos/.test(resume) && await p.locator('.lx-recap .lx-changer').count() === 5
      && (page.includes('candidature') ? /Défilé X/.test(resume) : true) && await p.locator('.lx-recap .lx-vignettes i').count() === 4;
    await p.locator('.lx-recap .lx-recap-ligne .lx-changer').nth(1).click(); await p.waitForTimeout(300);
    const changerOk = await etape() === 2
      && await p.getAttribute('.lx-progression li:nth-child(2)', 'aria-current') === 'step'
      && await p.evaluate(() => document.activeElement.matches('.lx-etape h3'));
    for (let i = 0; i < 12 && await etape() !== 6; i++) await suivant();
    const deborde = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth + ' > ' + innerWidth + ' : ' + Array.from(document.querySelectorAll('#form-casting *')).filter((e) => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 3).map((e) => e.tagName + '.' + e.className).join(', ') : false);
    await p.screenshot({ path: __dirname + '/medias/capture-' + Date.now() + '.png' });
    if (JSON.stringify(etapesVues) !== '[1,2,3,4,5,6]' || !sansPhotos || !sansVideo || !resumeOk || !changerOk || deborde) { console.log('❌ ÉCHEC étapes sur', page, etapesVues, sansPhotos, resumeOk, changerOk, deborde, resume); process.exitCode = 1; }
    await p.check('#ca-consentement');
    await p.click('#btn-envoyer');
    await p.locator('.lx-reception #ca-msg').waitFor();
    // une jauge par photo (4) et une pour la vidéo, toutes vertes à l'arrivée (10/11/2026)
    const jaugesVertes = await p.locator('#ca-jauges-photos .jauge.terminee').count(), videoVerte = await p.locator('#ca-jauge-video.terminee').count();
    const recu = await etape() === 7
      && /Félicitations|Congratulations/.test(await p.textContent('.lx-reception h3'))
      && await p.isHidden('.lx-resume') && await p.isVisible('.lx-reception #ca-msg')
      && await p.isVisible('.lx-reception .ma2m-retour-accueil');
    if (!recu) { console.log('❌ ÉCHEC écran de confirmation sur', page); process.exitCode = 1; }
    const aideVideo = await p.textContent('.ca-video-aide');
    const inserts = journal.filter(j => j[0] === 'POST' && j[1] === 'casting_applications').map(j => JSON.parse(j[3]));
    const c = inserts[0] || {};
    console.log(`\n===== ${page} (${vp.width}px) =====`);
    console.log('Étapes 1 → 6 (récapitulatif) :', etapesVues.join(' → '), '| photos manquantes signalées :', sansPhotos);
    console.log('Sans choisir son âge : étape bloquée :', refus12ans);
    console.log('Bloc parent visible pour « moins de 18 ans » :', blocParent, '| case Civilité visible pour une femme :', caseCivilite);
    console.log('Candidature enregistrée :', inserts.length ? 'OUI' : 'NON', '| parent_nom :', c.parent_nom, '| parent_telephone :', c.parent_telephone, '| parent_email :', c.parent_email, '| email :', c.email, '| civilité :', c.civilite);
    console.log('Parcours :', c.type_candidature, '| projet :', c.projet_nom, '| expérience :', c.experience_mannequin, '| e-mail agence :', journal.filter(j => j[0] === 'EMAIL').map(j => String(JSON.parse(j[1]).template_params.message).split('\n').slice(0, 2).join(' / ')));
    console.log('Message affiché :', (await p.textContent('#ca-msg').catch(() => '')).trim().slice(0, 160));
    console.log('Erreurs :', errs);
    console.log('Jauges vertes : photos', jaugesVertes, '/ 4, vidéo', videoVerte, '| « 3 minutes maximum » annoncé :', /3 minutes/.test(aideVideo));
    // Échec bloquant (relecture du 11/10/2026) : la candidature doit être enregistrée avec le bon parcours.
    if (jaugesVertes !== 4 || videoVerte !== 1 || !/3 minutes/.test(aideVideo)) { console.log('❌ ÉCHEC jauges ou durée sur', page); process.exitCode = 1; }
    if (!inserts.length || 'situation_scolaire' in c || 'niveau_etudes' in c || 'quartier' in c || 'date_naissance' in c || c.weight_kg !== null || c.mineur !== true) { console.log('❌ ÉCHEC données envoyées sur', page, JSON.stringify(c).slice(0, 300)); process.exitCode = 1; }
    else console.log('✓ ' + page + ' : candidature envoyée avec « mineur », sans date de naissance, quartier, scolarité, niveau d’études ni poids');
    if (representation && (c.experience_mannequin !== 'oui' || !c.message?.startsWith('Parcours choisi : Talent Network'))) {
      console.log('❌ ÉCHEC orientation représentation sur', page);
      process.exitCode = 1;
    }
    if (!refus12ans || !blocParent || !inserts.length || c.type_candidature !== (page.includes('candidature') ? 'projet' : 'agence') || errs.length) { console.log('❌ ÉCHEC sur', page); process.exitCode = 1; }
    await ctx.close();
  }
  await b.close(); srv.kill();
})();
