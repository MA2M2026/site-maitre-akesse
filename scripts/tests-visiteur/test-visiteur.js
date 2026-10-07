const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(8800 + Math.floor(Math.random() * 100));
const choisir = async (p, sel, pref) => { const v = await p.$eval(sel, (s, pref) => { const o = [...s.options].find(o => o.value && (!pref || o.value.includes(pref) || o.textContent.includes(pref))) || [...s.options].find(o => o.value); return o ? o.value : ''; }, pref); await p.selectOption(sel, v); };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [page, vp] of [['integrer-agence.html', { width: 390, height: 844 }], ['en/integrer-agence.html', { width: 1280, height: 900 }]]) {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', e => errs.push(e.message));
    await brancher(p, { tables: { casting_projets: [{ nom: 'Défilé X', actif: true }] }, rpc: { casting_ouvert: true } }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    if (await p.isVisible('#bandeau-cookies [data-cookies="oui"]')) await p.click('#bandeau-cookies [data-cookies="oui"]');
    // Remplissage comme une candidate de 15 ans
    await choisir(p, '#ca-experience', 'non');
    await p.fill('#ca-nom', 'Awa Koné'); await p.fill('#ca-email', 'awa@test.ci'); await p.fill('#ca-telephone-numero', '0700000001');
    await choisir(p, '#ca-ville', 'Abidjan'); await p.waitForTimeout(200);
    if (await p.isVisible('#ca-commune')) await choisir(p, '#ca-commune', 'Cocody');
    await p.fill('#ca-quartier', 'Angré');
    await p.fill('#ca-naissance', '2011-04-02'); await p.dispatchEvent('#ca-naissance', 'change'); await p.waitForTimeout(300);
    const blocParent = await p.isVisible('#ca-bloc-parent');
    await choisir(p, '#ca-scolarite', ''); await p.waitForTimeout(200);
    if (await p.isVisible('#ca-etudes-cat')) { await choisir(p, '#ca-etudes-cat', ''); await p.waitForTimeout(200); }
    if (await p.isVisible('#ca-etudes-classe')) await choisir(p, '#ca-etudes-classe', '');
    await p.selectOption('#ca-parent-civilite', 'Madame'); await p.fill('#ca-parent-nom', 'Kouassi Marie');
    await p.fill('#ca-parent-telephone-numero', '0700000099'); await p.fill('#ca-parent-email', 'parent@test.ci');
    await choisir(p, '#ca-genre', 'femme'); await p.waitForTimeout(200);
    await choisir(p, '#ca-taille', '160'); await choisir(p, '#ca-poids', ''); await choisir(p, '#ca-vetements', '');
    await p.setInputFiles('#ca-photos', [0, 1, 2, 3].map(i => __dirname + '/medias/photo' + i + '.jpg')); await p.waitForTimeout(1500);
    await p.setInputFiles('#ca-video', __dirname + '/medias/video.mp4'); await p.waitForTimeout(4000);
    await p.check('#ca-consentement').catch(async () => { await p.evaluate(() => { const c = document.getElementById('ca-consentement'); c.disabled = false; c.checked = true; }); });
    await p.screenshot({ path: __dirname + '/medias/capture-' + Date.now() + '.png' });
    await p.click('#btn-envoyer');
    await p.waitForTimeout(12000);
    const inserts = journal.filter(j => j[0] === 'POST' && j[1] === 'casting_applications').map(j => JSON.parse(j[3]));
    const c = inserts[0] || {};
    console.log(`\n===== ${page} (${vp.width}px) =====`);
    console.log('Bloc parent visible pour 15 ans :', blocParent);
    console.log('Candidature enregistrée :', inserts.length ? 'OUI' : 'NON', '| parent_nom :', c.parent_nom, '| parent_telephone :', c.parent_telephone, '| parent_email :', c.parent_email, '| email :', c.email);
    console.log('Message affiché :', (await p.textContent('#ca-msg').catch(() => '')).trim().slice(0, 160));
    console.log('Erreurs :', errs);
    await ctx.close();
  }
  await b.close(); srv.kill();
})();
