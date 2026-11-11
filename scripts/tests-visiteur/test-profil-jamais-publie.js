// Profil jamais publié mais marqué « déjà formé » (cas signalé le 11/11/2026, Extension 161) :
// 1) premiere_publication_faite = true, published = false : le bandeau ne doit PLUS dire « en ligne » ;
// 2) après l'Extension 161 (premiere_publication_faite = false) : les 6 étapes reviennent, avec le Récapitulatif
//    et le bouton « Soumettre » qui envoie le profil à l'agence. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
async function ouvrir(b, PORT, premiere) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [], journal = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => {
    const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 36000;
    const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'm-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
    localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'm-1', aud: 'authenticated', role: 'authenticated', email: 'diarra@test.ci' } }));
  });
  await brancher(p, { tables: { model_profiles: [{ id: 'm-1', full_name: 'DIARRA TEST', published: false, desactive: false, premiere_publication_faite: premiere, en_attente_validation: false }] }, rpc: {} }, journal);
  await p.goto('http://127.0.0.1:' + PORT + '/app/espace-mannequin.html'); await p.waitForTimeout(3500);
  return { p, errs };
}
(async () => {
  const PORT = String(8900 + Math.floor(Math.random() * 90));
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const r = {};
  const avant = await ouvrir(b, PORT, true);
  await avant.p.evaluate(() => { state.meta.premierePublicationFaite = true; render(); }); r.bandeau = await avant.p.evaluate(() => (document.querySelector('.online-banner') || {}).textContent || '');
  r.pasEnLigneDit = /pas encore en ligne/i.test(r.bandeau) && !/visible sur le site/i.test(r.bandeau);
  const apres = await ouvrir(b, PORT, false);
  r.modeGuide = await apres.p.evaluate(() => !state.meta.premierePublicationFaite && !document.querySelector('.blocks-grid'));
  await apres.p.evaluate(() => { state.meta.currentStep = 6; render(); });
  r.recapEtSoumettre = await apres.p.evaluate(() => !!document.getElementById('submitProfile'));
  const errs = avant.errs.concat(apres.errs);
  const ok = r.pasEnLigneDit && r.modeGuide && r.recapEtSoumettre && !errs.length;
  console.log((ok ? '✓' : '❌ ÉCHEC') + ' Profil jamais publié : bandeau honnête, puis 6 étapes avec Récapitulatif et « Soumettre » : ' + JSON.stringify(r) + ' | erreurs : ' + JSON.stringify(errs.slice(0, 3)));
  if (!ok) process.exitCode = 1; await b.close(); srv.kill();
})();
