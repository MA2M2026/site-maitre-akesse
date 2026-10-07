// Formulaire de contact et demande des recruteurs, remplis comme un visiteur (FR téléphone, EN ordinateur).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(8800 + Math.floor(Math.random() * 100));
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const cas = [
    ['contact.html', { width: 390, height: 844 }, async p => { await p.selectOption('#civilite', 'Madame'); await p.fill('#nom', 'Kouassi Marie'); await p.fill('#email', 'marie@test.ci'); await p.fill('#message', 'Bonjour, je voudrais des informations.'); await p.check('#ct-consentement'); await p.click('#form-contact button[type="submit"]'); }, 'messages_contact', 'nom'],
    ['en/contact.html', { width: 1280, height: 900 }, async p => { await p.selectOption('#civilite', 'Monsieur'); await p.fill('#nom', 'John Smith'); await p.fill('#email', 'john@test.ci'); await p.fill('#message', 'Hello.'); await p.check('#ct-consentement'); await p.click('#form-contact button[type="submit"]'); }, 'messages_contact', 'nom'],
    ['selection.html', { width: 390, height: 844 }, async p => { await p.selectOption('#re-civilite', 'Mademoiselle'); await p.fill('#re-nom', 'Awa Diallo'); await p.fill('#re-email', 'awa@marque.ci'); await p.check('#re-consentement'); await p.click('#btn-envoyer-recruteur'); }, 'recruiter_requests', 'contact_name'],
    ['en/selection.html', { width: 1280, height: 900 }, async p => { await p.selectOption('#re-civilite', 'Monsieur'); await p.fill('#re-nom', 'Paul Martin'); await p.fill('#re-email', 'paul@brand.com'); await p.check('#re-consentement'); await p.click('#btn-envoyer-recruteur'); }, 'recruiter_requests', 'contact_name']
  ];
  for (const [page, vp, remplir, table, champ] of cas) {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', e => errs.push(e.message));
    // Recruteur : il a d'abord choisi des mannequins dans le Book (sinon le formulaire n'apparaît pas).
    if (table === 'recruiter_requests') await p.addInitScript(() => { try { localStorage.setItem('ma2m_selection', JSON.stringify([{ id: 'm1', nom: 'Awa Koné', ville: 'Abidjan', photo: '' }])); } catch (e) {} });
    await brancher(p, { tables: { model_profiles: [{ id: 'm1', full_name: 'Awa Koné', city: 'Abidjan', published: true }] } }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    if (await p.isVisible('#bandeau-cookies [data-cookies="oui"]')) await p.click('#bandeau-cookies [data-cookies="oui"]');
    await remplir(p); await p.waitForTimeout(3000);
    const envoi = journal.filter(j => j[0] === 'POST' && j[1] === table).map(j => JSON.parse(j[3]))[0];
    console.log(`===== ${page} (${vp.width}px) : enregistré ${envoi ? 'OUI' : 'NON'} | ${champ} : ${envoi && envoi[champ]} | erreurs : ${JSON.stringify(errs)}`);
    await ctx.close();
  }
  await b.close(); srv.kill();
})();
