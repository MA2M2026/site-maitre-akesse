const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(8800 + Math.floor(Math.random() * 100));
const choisir = async (p, sel, pref) => { const v = await p.$eval(sel, (s, pref) => { const o = [...s.options].find(o => o.value && (!pref || o.value.includes(pref) || o.textContent.includes(pref))) || [...s.options].find(o => o.value); return o ? o.value : ''; }, pref); await p.selectOption(sel, v); };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [page, vp] of [['integrer-agence.html', { width: 390, height: 844 }], ['en/integrer-agence.html', { width: 1280, height: 900 }], ['candidature.html', { width: 1280, height: 900 }], ['en/candidature.html', { width: 390, height: 844 }]]) {
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
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    if (await p.isVisible('#bandeau-cookies [data-cookies="oui"]')) await p.click('#bandeau-cookies [data-cookies="oui"]');
    // Remplissage comme une candidate de 15 ans
    // Intégrer l'agence : parcours débutant ; Postuler à un casting : choix du projet
    if (await p.$('#ca-experience')) await choisir(p, '#ca-experience', 'non');
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
    await p.fill('#ca-nom', 'Awa Koné'); await p.fill('#ca-email', 'awa@test.ci'); await p.fill('#ca-telephone-numero', '0700000001');
    await choisir(p, '#ca-ville', 'Abidjan'); await p.waitForTimeout(200);
    if (await p.isVisible('#ca-commune')) await choisir(p, '#ca-commune', 'Cocody');
    await p.fill('#ca-quartier', 'Angré');
    // moins de 14 ans : l'étape « Vous » refuse d'avancer, avec un message (décision du 20/10/2026)
    await p.fill('#ca-naissance', '2014-06-01'); await p.dispatchEvent('#ca-naissance', 'change'); await p.waitForTimeout(300);
    await choisir(p, '#ca-scolarite', ''); await p.waitForTimeout(200);
    if (await p.isVisible('#ca-etudes-cat')) { await choisir(p, '#ca-etudes-cat', ''); await p.waitForTimeout(200); }
    if (await p.isVisible('#ca-etudes-classe')) await choisir(p, '#ca-etudes-classe', '');
    await p.selectOption('#ca-parent-civilite', 'Madame'); await p.fill('#ca-parent-nom', 'Kouassi Marie');
    await p.fill('#ca-parent-telephone-numero', '0700000099'); await p.fill('#ca-parent-email', 'parent@test.ci');
    await choisir(p, '#ca-genre', 'femme'); await p.waitForTimeout(200); await p.selectOption('#ca-civilite', 'Madame');
    await suivant();
    const refus12ans = await etape() === 2 && /14 ans|age 14/.test(await p.textContent('.lx-etape:not([hidden]) .form-msg')) && !journal.some(j => j[0] === 'POST' && j[1] === 'casting_applications');
    await p.fill('#ca-naissance', '2011-04-02'); await p.dispatchEvent('#ca-naissance', 'change'); await p.waitForTimeout(300);
    const blocParent = await p.isVisible('#ca-bloc-parent');
    await choisir(p, '#ca-scolarite', ''); await p.waitForTimeout(200);
    if (await p.isVisible('#ca-etudes-cat')) { await choisir(p, '#ca-etudes-cat', ''); await p.waitForTimeout(200); }
    if (await p.isVisible('#ca-etudes-classe')) await choisir(p, '#ca-etudes-classe', '');
    await p.selectOption('#ca-parent-civilite', 'Madame'); await p.fill('#ca-parent-nom', 'Kouassi Marie');
    await p.fill('#ca-parent-telephone-numero', '0700000099'); await p.fill('#ca-parent-email', 'parent@test.ci');
    await choisir(p, '#ca-genre', 'femme'); await p.waitForTimeout(200);
    const caseCivilite = await p.isVisible('#ca-civilite'); await p.selectOption('#ca-civilite', 'Madame');
    await suivant(); etapesVues.push(await etape());
    await choisir(p, '#ca-taille', '160'); await choisir(p, '#ca-poids', ''); await choisir(p, '#ca-vetements', '');
    for (const sel of ['#ca-pointure', '#ca-poitrine', '#ca-tourtaille', '#ca-hanches']) if (await p.isVisible(sel)) await choisir(p, sel, '');
    await suivant(); etapesVues.push(await etape());
    // photos manquantes : l'étape 4 le dit
    await suivant();
    const sansPhotos = await etape() === 4 && /photo/i.test(await p.textContent('.lx-etape:not([hidden]) .form-msg'));
    await p.setInputFiles('#ca-photos', [0, 1, 2, 3].map(i => __dirname + '/medias/photo' + i + '.jpg')); await p.waitForTimeout(1500);
    await p.setInputFiles('#ca-video', __dirname + '/medias/video.mp4'); await p.waitForTimeout(4000);
    await p.check('#ca-consentement').catch(async () => { await p.evaluate(() => { const c = document.getElementById('ca-consentement'); c.disabled = false; c.checked = true; }); });
    await suivant(); etapesVues.push(await etape());
    // le résumé « Votre candidature » : chaque ligne, avec « Changer »
    const resume = await p.textContent('.lx-recap');
    const resumeOk = /Madame Awa Koné/.test(resume) && /Abidjan/.test(resume) && /1,60 m|1\.60 m/.test(resume) && /4 photos/.test(resume) && await p.locator('.lx-recap .lx-changer').count() === 4
      && (page.includes('candidature') ? /Défilé X/.test(resume) : true) && await p.locator('.lx-recap .lx-vignettes i').count() === 4;
    await p.click('.lx-recap .lx-recap-ligne:nth-child(2) .lx-changer'); await p.waitForTimeout(300);
    const changerOk = await etape() === 2;
    await suivant(); await suivant(); await suivant();
    const deborde = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    await p.screenshot({ path: __dirname + '/medias/capture-' + Date.now() + '.png' });
    if (JSON.stringify(etapesVues) !== '[1,2,3,4,5]' || !sansPhotos || !resumeOk || !changerOk || deborde) { console.log('❌ ÉCHEC étapes sur', page, etapesVues, sansPhotos, resumeOk, changerOk, deborde, resume); process.exitCode = 1; }
    await p.click('#btn-envoyer');
    await p.waitForTimeout(12000);
    // une jauge par photo (4) et une pour la vidéo, toutes vertes à l'arrivée (10/11/2026)
    const jaugesVertes = await p.locator('#ca-jauges-photos .jauge.terminee').count(), videoVerte = await p.locator('#ca-jauge-video.terminee').count();
    const aideVideo = await p.textContent('.ca-video-aide');
    const inserts = journal.filter(j => j[0] === 'POST' && j[1] === 'casting_applications').map(j => JSON.parse(j[3]));
    const c = inserts[0] || {};
    console.log(`\n===== ${page} (${vp.width}px) =====`);
    console.log('Étapes 1 → 5 (résumé) :', etapesVues.join(' → '), '| photos manquantes signalées :', sansPhotos);
    console.log('Candidate de 12 ans refusée (minimum 14 ans) :', refus12ans);
    console.log('Bloc parent visible pour 15 ans :', blocParent, '| case Civilité visible pour une femme :', caseCivilite);
    console.log('Candidature enregistrée :', inserts.length ? 'OUI' : 'NON', '| parent_nom :', c.parent_nom, '| parent_telephone :', c.parent_telephone, '| parent_email :', c.parent_email, '| email :', c.email, '| civilité :', c.civilite);
    console.log('Parcours :', c.type_candidature, '| projet :', c.projet_nom, '| expérience :', c.experience_mannequin, '| e-mail agence :', journal.filter(j => j[0] === 'EMAIL').map(j => String(JSON.parse(j[1]).template_params.message).split('\n').slice(0, 2).join(' / ')));
    console.log('Message affiché :', (await p.textContent('#ca-msg').catch(() => '')).trim().slice(0, 160));
    console.log('Erreurs :', errs);
    console.log('Jauges vertes : photos', jaugesVertes, '/ 4, vidéo', videoVerte, '| « 3 minutes maximum » annoncé :', /3 minutes/.test(aideVideo));
    // Échec bloquant (relecture du 11/10/2026) : la candidature doit être enregistrée avec le bon parcours.
    if (jaugesVertes !== 4 || videoVerte !== 1 || !/3 minutes/.test(aideVideo)) { console.log('❌ ÉCHEC jauges ou durée sur', page); process.exitCode = 1; }
    if (!refus12ans || !inserts.length || c.type_candidature !== (page.includes('candidature') ? 'projet' : 'agence') || errs.length) { console.log('❌ ÉCHEC sur', page); process.exitCode = 1; }
    await ctx.close();
  }
  await b.close(); srv.kill();
})();
