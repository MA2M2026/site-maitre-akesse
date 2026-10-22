// Code permanent « Créer mon compte » (14/10/2026, demande de la propriétaire) : après
// « Définir ce code », le code reste affiché avec « Copier le code », pour le transmettre sans
// l'avoir recopié avant. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9400 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const ctx = await b.newContext({ viewport: vp, permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept());
    await p.addInitScript(() => { sessionStorage.setItem('ma2m_code_valide', '1'); });
    await brancher(p, { tables: { admins: [{ user_id: 'admin-1' }] }, rpc: { code_validation_statut: [{ defini: true }], definir_code_portail: null } }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/tableau-de-bord.html'); await p.waitForTimeout(1200);
    await p.fill('#tb-email', 'admin@test.ci'); await p.fill('#tb-password', 'motdepasse'); await p.click('#tb-login-btn');
    await p.waitForSelector('#bloc-tableau', { state: 'visible', timeout: 15000 }); await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector('[data-tdb-cible="b3b-code-permanent"]').click()); await p.waitForTimeout(800);
    const n = vp.width + 'px : ';
    ok(!(await p.isVisible('#portail-code-affiche')), n + 'aucun code affiché avant validation');
    await p.click('#portail-generer-btn');
    const code = await p.inputValue('#portail-nouveau-code');
    await p.click('#portail-definir-btn'); await p.waitForTimeout(1200);
    const envoye = journal.find(j => j[0] === 'rpc' && j[1] === 'definir_code_portail');
    ok(envoye && JSON.parse(envoye[2]).nouveau_code === code, n + 'code généré envoyé à la base (' + code + ')');
    ok(await p.isVisible('#portail-code-affiche') && (await p.textContent('#portail-code-texte')) === code, n + 'après validation, le code reste affiché');
    ok((await p.inputValue('#portail-nouveau-code')) === '', n + 'le champ de saisie est vidé');
    await p.click('#portail-copier-btn'); await p.waitForTimeout(300);
    ok((await p.evaluate(() => navigator.clipboard.readText())) === code && (await p.textContent('#portail-copier-btn')) === 'Copié !', n + '« Copier le code » met le code dans le presse-papiers');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
