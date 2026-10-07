const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(8800 + Math.floor(Math.random() * 100));
const choisir = async (p, sel, pref) => { const v = await p.$eval(sel, (s, pref) => { const o = [...s.options].find(o => o.value && (!pref || o.value.includes(pref))) || [...s.options].find(o => o.value); return o ? o.value : ''; }, pref); await p.selectOption(sel, v); };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [page, vp] of [['inscription-mannequin.html', { width: 390, height: 844 }], ['en/inscription-mannequin.html', { width: 1280, height: 900 }]]) {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', e => errs.push(e.message));
    await brancher(p, { tables: {}, api: { '/api/code-protege': { ok: true, id: 'ins-1' } } }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    if (await p.isVisible('#bandeau-cookies [data-cookies="oui"]')) await p.click('#bandeau-cookies [data-cookies="oui"]');
    await p.fill('#code-inscription', 'CODE-TEST'); await p.click('#valider-code-btn'); await p.waitForTimeout(1500);
    const formVisible = await p.isVisible('#ins-nom');
    await p.fill('#ins-nom', 'Moussa Bamba'); await p.fill('#ins-naissance', '2012-02-02'); await p.dispatchEvent('#ins-naissance', 'change'); await p.waitForTimeout(300);
    await choisir(p, '#ins-genre', 'homme'); await p.waitForTimeout(200); await choisir(p, '#ins-taille', ''); await choisir(p, '#ins-tailleveternents', '');
    await p.fill('#ins-telephone-numero', '0700000006'); await p.fill('#ins-email', 'Moussa@Test.CI');
    const blocParent = await p.isVisible('#ins-bloc-parent');
    await p.selectOption('#ins-parent-civilite', 'Madame'); await p.fill('#ins-parent-nom', 'Bamba Aïcha'); await p.fill('#ins-parent-telephone-numero', '0700000066'); await p.fill('#ins-parent-email', 'aicha@test.ci');
    for (let i = 1; i <= 4; i++) await p.setInputFiles('#ins-photo' + i, __dirname + '/medias/photo' + i + '.jpg');
    await p.check('#ins-conditions'); await p.fill('#ins-reference-paiement', 'WAVE-123456');
    await p.check('#ins-consentement').catch(async () => { await p.evaluate(() => { const c = document.getElementById('ins-consentement'); c.disabled = false; c.checked = true; }); });
    await p.click('#form-inscription button[type="submit"]'); await p.waitForTimeout(8000);
    const envois = journal.filter(j => j[0] === 'API' && /inscription-soumettre/.test(j[2] || '')).map(j => JSON.parse(j[2]).dossier);
    const d = envois[0] || {};
    console.log(`\n===== ${page} (${vp.width}px) =====`);
    console.log('Formulaire ouvert après le code :', formVisible, '| bloc parent pour 14 ans :', blocParent);
    console.log('Dossier envoyé :', envois.length ? 'OUI' : 'NON', '| e-mail :', d.p_email, '| parent :', d.p_parent_nom, d.p_parent_telephone, d.p_parent_email, '| téléphone :', d.p_phone);
    console.log('Message :', (await p.textContent('#inscription-msg').catch(() => '')).trim().slice(0, 140));
    console.log('Erreurs :', errs);
    await ctx.close();
  }
  await b.close(); srv.kill();
})();
