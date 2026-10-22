// Page « Reçu de paiement » d'un cachet (recu.html, 22/10/2026), comme la mannequin qui ouvre le lien
// reçu sur WhatsApp, sur téléphone et ordinateur, base SIMULÉE : le reçu s'affiche (numéro, motif,
// date, montant, référence Wave), se lit bien, ne dépasse pas, propose « Enregistrer en PDF » ;
// un lien faux ou un cachet non payé ne montre rien.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const PORT = String(9400 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const J = '11111111-2222-3333-4444-555555555555';

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, vp] of [['téléphone', { width: 375, height: 667 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 700, hasTouch: vp.width < 700 });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables: {}, rpc: {
      cachet_recu_lire: (x) => (x.p_jeton === J ? [{ numero: 'MA2M-CA-2026-0001', beneficiaire: 'GRÂCE YAO', montant: 40000, motif: 'defile', prestation: 'Défilé · ABIDJAN BORDER FORUM', paye_le: '2026-10-20T10:00:00Z', reference_wave: 'T_AB12' }] : []) } }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/recu.html?r=' + J); await p.waitForTimeout(1500);
    const t = (await p.textContent('main')).replace(/ | /g, ' ');
    ok(/MA2M-CA-2026-0001/.test(t) && /GRÂCE YAO/.test(t) && /Défilé · ABIDJAN BORDER FORUM/.test(t) && /20 octobre 2026/.test(t) && /40 000 FCFA/.test(t) && /T_AB12/.test(t) && /Paiement effectué/.test(t),
      nom + ' : le reçu montre le numéro, la personne, le motif, la date, le montant et la référence Wave');
    ok(await p.isVisible('#rc-imprimer'), nom + ' : « Enregistrer en PDF / imprimer » proposé');
    const pales = await lirePageEntiere(p); ok(!pales.length, nom + ' : textes lisibles ' + pales.slice(0, 3).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nom + ' : rien ne dépasse de l’écran');
    if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + '/recu-' + vp.width + '.png', fullPage: true });
    await p.goto('http://127.0.0.1:' + PORT + '/recu.html?r=99999999-2222-3333-4444-555555555555'); await p.waitForTimeout(1200);
    ok(/introuvable/.test(await p.textContent('#rc-etat')) && !(await p.isVisible('#rc-montant-bloc')), nom + ' : lien faux ou cachet non payé → « reçu introuvable », rien d’autre');
    ok(!errs.length, nom + ' : aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
