const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(8800 + Math.floor(Math.random() * 100));
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const vp of [{ nom: 'téléphone', width: 390, height: 844 }, { nom: 'ordinateur', width: 1280, height: 900 }]) {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const errs = [], journal = [], ouverts = [];
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 150)); });
    p.on('pageerror', e => errs.push(e.message));
    ctx.on('page', np => ouverts.push(np.url()));
    await p.addInitScript(() => { sessionStorage.setItem('ma2m_code_valide', '1'); window.open = (u) => { (window.__ouverts = window.__ouverts || []).push(u); return null; }; });
    const franck = { id: 'c1', full_name: 'AKESSE FRANCK', email: 'enfant@gmail.com', phone: '+225 01981386', genre: 'femme', city: 'Bingerville', quartier: 'Adjame',
      date_naissance: '2011-10-05', type_candidature: 'agence', status: 'nouvelle', created_at: '2026-10-07T10:00:00Z', experience_mannequin: 'non',
      parent_nom: 'Monsieur Akesse Franck', parent_telephone: '+225 0777071859', parent_email: 'parent@gmail.com' };
    const yao = { id: 'c2', full_name: 'YAO KOUASSI', email: 'yao@gmail.com', phone: '+225 0102030405', genre: 'homme', date_naissance: '1999-01-01', type_candidature: 'agence', status: 'retenue', created_at: '2026-10-06T10:00:00Z' };
    const bintou = { id: 'c3', full_name: 'BINTOU TRAORÉ', email: 'bintou@gmail.com', phone: '+225 0505050505', genre: 'femme', civilite: 'Madame', date_naissance: '1995-05-05', type_candidature: 'agence', status: 'retenue', created_at: '2026-10-05T10:00:00Z' };
    await brancher(p, { tables: { admins: [{ user_id: 'admin-1' }], casting_applications: [franck, yao, bintou] }, rpc: { code_validation_statut: [{ defini: true }] } }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/tableau-de-bord.html'); await p.waitForTimeout(1200);
    if (await p.isVisible('#bandeau-cookies [data-cookies="oui"]')) await p.click('#bandeau-cookies [data-cookies="oui"]');
    // 1. Connexion comme l'administratrice
    await p.fill('#tb-email', 'admin@test.ci'); await p.fill('#tb-password', 'motdepasse'); await p.click('#tb-login-btn');
    try { await p.waitForSelector('#bloc-tableau', { state: 'visible', timeout: 15000 }); }
    catch (e) { console.log('ÉCHEC CONNEXION. message :', await p.textContent('#tb-msg').catch(() => ''), '\njournal :', JSON.stringify(journal).slice(0, 1500), '\nerreurs :', errs, '\nblocs visibles :', await p.evaluate(() => [...document.querySelectorAll('section,div[id^=bloc]')].filter(e => e.id && e.offsetParent).map(e => e.id).slice(0, 10))); throw e; }
    // 2. Menu → Candidatures
    await p.click('.v2-bloc[data-bloc="2"]'); await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelector('.v2-lien[data-page="b2-candidatures"]').click());
    await p.waitForTimeout(1500);
    const cartes = await p.$$eval('#liste-candidatures .dossier-carte', cs => cs.map(c => c.querySelector('.dc-nom').textContent.trim().slice(0, 13) + ' | ' + ((c.querySelector('.dc-whatsapp') || {}).textContent || '') + ' ' + ((c.querySelector('.dc-whatsapp') || {}).getAttribute ? c.querySelector('.dc-whatsapp').getAttribute('href') : '')));
    // 3. Clic sur la fiche du mineur
    await p.click('#liste-candidatures .dossier-carte[data-id="c1"] .dc-nom'); await p.waitForTimeout(1200);
    const liensFiche = await p.$$eval('#mf-champs a', as => as.map(a => a.textContent.trim() + ' ' + a.getAttribute('href')));
    const boutonWa = await p.getAttribute('#mf-wa-ouvrir', 'href');
    // 4. Changement de statut → Retenue (1er message automatique)
    await p.selectOption('#mf-statut-select', 'retenue'); await p.waitForTimeout(1500);
    const titre1 = await p.textContent('#mf-notification-titre');
    const waPremier = await p.getAttribute('#mf-notification-whatsapp', 'href');
    const statutEnvoi = await p.textContent('#mf-notification-statut');
    // 5. Convocation depuis la fiche
    await p.selectOption('#mf-wa-modele', 'c:convocation'); await p.waitForTimeout(300);
    const convoc = (await p.inputValue('#mf-wa-texte')).split('\n').slice(0, 5).join(' / ');
    await p.click('#mf-wa-email'); await p.waitForTimeout(800);
    const emails = journal.filter(j => j[0] === 'EMAIL').map(j => { const x = JSON.parse(j[1]).template_params; return x.to_email + ' / ' + x.to_name + ' / ' + String(x.message).split('\n')[2]; });
    const majStatut = journal.filter(j => j[0] === 'PATCH').map(j => j[1] + ' ' + j[3]);
    console.log(`\n===== ${vp.nom} =====`);
    console.log('Liste :', cartes);
    console.log('Fiche, liens :', liensFiche);
    console.log('Bouton « Ouvrir WhatsApp » :', boutonWa.split('?')[0], '| texte :', decodeURIComponent(boutonWa.split('?text=')[1] || '').split('\n')[2]);
    console.log('Statut enregistré :', majStatut);
    console.log('1er message :', titre1, '| WhatsApp :', (waPremier || '').split('?')[0], '|', statutEnvoi);
    console.log('Convocation :', convoc);
    console.log('E-mails envoyés :', emails);
    await p.screenshot({ path: __dirname + '/medias/capture-' + Date.now() + '.png' });
    // 6. Messages groupés
    await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('.modal-overlay.ouvert').forEach(m => m.classList.remove('ouvert')));
    await p.evaluate(() => document.querySelector('.v2-lien[data-page="b2-messages-groupes"]').click());
    await p.waitForTimeout(800);
    await p.selectOption('#mg-statut', 'retenue'); await p.waitForTimeout(200);
    await p.click('#mg-charger'); await p.waitForTimeout(800);
    const liste = await p.$$eval('.mg-infos', e => e.map(x => x.childNodes[0].textContent.trim()));
    console.log('Messages groupés, liste :', liste, '| case parents visible :', await p.isVisible('#mg-message-parent'));
    const boite = await p.evaluate(() => { const b = document.getElementById('mg-wa-suivant').getBoundingClientRect(); return { x: Math.round(b.x), largeur: Math.round(b.width), ecran: innerWidth, defilementHorizontal: document.documentElement.scrollWidth > innerWidth }; });
    console.log('Bouton WhatsApp groupé :', JSON.stringify(boite));
    await p.locator('#mg-wa-suivant').scrollIntoViewIfNeeded(); await p.screenshot({ path: __dirname + '/medias/capture-' + Date.now() + '.png' });
    await p.evaluate(() => { for (let i = 0; i < 3; i++) document.getElementById('mg-wa-suivant').click(); });
    const wa = await p.evaluate(() => (window.__ouverts || []).map(u => u.split('?')[0] + ' | ' + decodeURIComponent(u.split('?text=')[1] || '').split('\n')[2]));
    console.log('Messages groupés, WhatsApp :', wa);
    console.log('Erreurs :', errs.filter(e => !/Failed to fetch|NetworkError|ERR_/.test(e)));
    await ctx.close();
  }
  await b.close(); srv.kill();
})();
