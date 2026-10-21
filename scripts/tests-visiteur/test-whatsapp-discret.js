// Pastille WhatsApp flottante (20/10/2026, visites « comme un humain ») : elle cachait des titres,
// des noms et des champs. Elle s'efface quand on descend dans la page ou qu'on remplit un champ,
// et revient dès qu'on remonte (js/app.js, css/charte-ma2m.css). Téléphone, FR et EN, et l'Espace
// mannequin (feuilles de style à part). Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { tables, rpc } = require('./pages-publiques');
const PORT = String(9100 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [page, champ] of [['integrer-agence.html', '#ca-nom'], ['en/integrer-agence.html', '#ca-nom'], ['espace-mannequin.html', null]]) {
    const ctx = await b.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables, rpc }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(2000);
    const visible = () => p.evaluate(() => { const w = document.querySelector('.whatsapp-flottant'); return !!w && getComputedStyle(w).opacity === '1' && getComputedStyle(w).pointerEvents !== 'none'; });
    const aller = async (y) => { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(600); };
    if (!champ) {  // écran de connexion trop court pour défiler : on vérifie que le style s'applique
      await p.evaluate(() => document.querySelector('.whatsapp-flottant').classList.add('whatsapp-discret')); await p.waitForTimeout(600);
      ok(!(await visible()), page + ' : la pastille s\'efface aussi ici (feuilles de style de l\'Espace)');
      ok(!errs.length, page + ' : aucune erreur ' + errs.join(' | '));
      await ctx.close(); continue;
    }
    const auDepart = await visible();
    await aller(400); await aller(900);
    const enDescendant = await visible();
    await aller(600);
    const enRemontant = await visible();
    ok(auDepart && !enDescendant && enRemontant, page + ' : visible au départ, effacée en descendant, de retour en remontant (' + [auDepart, enDescendant, enRemontant] + ')');
    if (champ) {
      // sans faire défiler la page (le défilement vers le bas efface déjà la pastille : ici on teste la saisie seule)
      await p.evaluate((c) => document.querySelector(c).focus({ preventScroll: true }), champ); await p.waitForTimeout(600);
      const pendantSaisie = await visible();
      await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(600);
      ok(!pendantSaisie && await visible(), page + ' : effacée pendant la saisie d\'un champ, de retour ensuite');
    }
    ok(!errs.length, page + ' : aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
