// Toutes les rubriques de l'administration (Site, Paiements, Comptabilité, Sécurité ; 12/11/2026 : « Bulletins » cassait
// sur une réponse sans présences), ouvertes comme l'administrateur principal (base SIMULÉE, données
// incomplètes exprès), sur téléphone et ordinateur (12/11/2026, grande revue : « Archives » cassait sur une date vide,
// « Dossiers de formation » écrivait « fermée jusqu'au NaN undefined ») : aucune page ne casse, aucun « NaN » /
// « undefined » / « Invalid » à l'écran, rien ne déborde, aucune erreur de programme.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const PORT = String(9600 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700;
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, donnees('principal'), []); await photosLocales(p);
    await seConnecter(p, 'http://127.0.0.1:' + PORT + '/admin/'); await p.waitForTimeout(1200);
    const liste = await p.evaluate(() => ['paiements', 'compta', 'site', 'securite'].flatMap((esp) => ((window.Portail.espaces[esp] || {}).nav || []).filter((n) => n[0]).map((n) => [esp, n[0], n[1]])));
    const soucis = [];
    for (const [esp, id, libelle] of liste) {
      const n0 = errs.length;
      await p.goto('http://127.0.0.1:' + PORT + '/admin/#/' + esp + '/' + id); await p.waitForTimeout(1300);
      const r = await p.evaluate(() => { const t = (document.getElementById('contenu') || document.body).innerText;
        return { casse: /Impossible d’afficher cette page/.test(t), mots: (t.match(/\bNaN\b|\bundefined\b|Invalid (time|date)/g) || []).slice(0, 2), deborde: document.documentElement.scrollWidth > innerWidth + 1 }; });
      if (r.casse || r.mots.length || r.deborde || errs.length > n0) soucis.push(libelle + (r.casse ? ' : page cassée' : '') + (r.mots.length ? ' : « ' + r.mots.join(', ') + ' »' : '') + (r.deborde ? ' : déborde' : '') + (errs.length > n0 ? ' : ' + errs.slice(n0).join(' | ').slice(0, 120) : ''));
    }
    ok(liste.length >= 75 && !soucis.length, nom + ' : les ' + liste.length + ' rubriques (Site, Paiements, Comptabilité, Sécurité) s’ouvrent sans casser, sans « NaN » ni « undefined », sans déborder' + (soucis.length ? ' — ' + soucis.join(' · ') : ''));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
