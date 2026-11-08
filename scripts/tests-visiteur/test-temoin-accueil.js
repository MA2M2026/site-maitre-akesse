// Témoin « ma2m_v » de l'accueil vivant (08/11/2026, phase 3 V4), comme un vrai visiteur, téléphone et ordinateur, FR et
// EN, base SIMULÉE : créé par la page à la première visite (aucune donnée personnelle, 30 jours) ; JAMAIS créé si le
// visiteur a refusé les cookies ; retiré dès qu'il appuie sur « Refuser » dans le bandeau ; « Accepter » le garde.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9600 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const profils = Array.from({ length: 8 }, (_, i) => ({ id: '00000000-0000-0000-0000-0000000000' + String(i).padStart(2, '0'), full_name: 'Mannequin ' + i, city: 'Abidjan', category: i % 2 ? 'homme' : 'femme', published: true }));
const donnees = () => ({ tables: { model_profiles: profils }, rpc: { photos_couverture_mannequins: profils.map((m) => ({ model_id: m.id, url: '/icons/apple-touch-icon.png' })) } });

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [page, tel] of [['index.html', true], ['en/index.html', false]]) {
    const n = (tel ? 'téléphone' : 'ordinateur') + (page.startsWith('en/') ? ' EN' : '') + ' : ';
    const nouveau = async (refus) => {
      const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1366, height: 900 }, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
      if (refus) await ctx.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); } catch (e) { /* */ } });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', (e) => errs.push(e.message));
      await brancher(p, donnees(), []);
      await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'load' }); await p.waitForTimeout(2500);
      const temoin = async () => (await ctx.cookies()).find((c) => c.name === 'ma2m_v');
      return { ctx, p, errs, temoin };
    };
    // 1. première visite, pas encore de choix : créé
    let v = await nouveau(false); let t = await v.temoin();
    ok(t && /^[0-5]\.1$/.test(t.value) && t.sameSite === 'Lax' && t.expires - Date.now() / 1000 > 29 * 86400 && t.expires - Date.now() / 1000 < 31 * 86400, n + 'première visite : témoin créé (' + (t ? t.value : 'aucun') + ', 30 jours, SameSite=Lax)');
    // 2. « Refuser » dans le bandeau : retiré
    await v.p.click('#bandeau-cookies [data-cookies="non"]'); await v.p.waitForTimeout(300);
    ok(!(await v.temoin()), n + '« Refuser » dans le bandeau : le témoin est retiré');
    // revient sur l'accueil après le refus : pas recréé
    await v.p.reload({ waitUntil: 'load' }); await v.p.waitForTimeout(2000);
    ok(!(await v.temoin()), n + 'retour sur l’accueil après le refus : pas recréé');
    ok(!v.errs.length, n + 'aucune erreur de page ' + v.errs.join(' | '));
    await v.ctx.close();
    // 3. refus déjà enregistré avant la visite : jamais créé
    v = await nouveau(true);
    ok(!(await v.temoin()), n + 'cookies refusés auparavant : témoin jamais créé');
    await v.ctx.close();
    // 4. « Accepter » : gardé
    v = await nouveau(false);
    await v.p.click('#bandeau-cookies [data-cookies="oui"]'); await v.p.waitForTimeout(300);
    ok(!!(await v.temoin()), n + '« Accepter » : le témoin reste');
    await v.ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
