// Journal des erreurs et zooms du visiteur (20/10/2026, demande de la propriétaire : « je fais
// souvent des zooms, le site ne doit pas les compter comme des erreurs ») — js/surveillance.js :
//  - zoom choisi par le visiteur (doigts, clavier, menu) : ni « Zoom inattendu », ni « Page
//    dézoomée » si rien ne dépasse, ni « Page plus large que l'écran » mesurée pendant le zoom ;
//  - les vrais problèmes restent signalés : zoom automatique sur un champ au texte trop petit,
//    élément qui dépasse de l'écran (sans zoom).
// Le zoom est simulé (window.visualViewport remplacé) ; rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { tables, rpc } = require('./pages-publiques');
const PORT = String(9400 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
// un vrai téléphone (sinon le journal reconnaît un robot et ne signale rien)
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36';
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  // echelle : zoom de départ ; prep(p) : préparation de la page ; attente : délai avant lecture
  async function visite(echelle, prep, attente) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA });
    const p = await ctx.newPage(); const signalements = [];
    await p.addInitScript((s) => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      const vv = new EventTarget(); vv.scale = s; vv.width = innerWidth; vv.height = innerHeight;
      Object.defineProperty(window, 'visualViewport', { get: () => vv });
    }, echelle);
    await brancher(p, { tables, rpc }, []);
    await p.route('**/rest/v1/journal_erreurs**', (r) => { try { signalements.push(JSON.parse(r.request().postData()).message); } catch (e) {} r.fulfill({ status: 201, body: '' }); });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await p.waitForTimeout(500);
    if (prep) await prep(p);
    await p.waitForTimeout(attente);
    await ctx.close();
    return signalements;
  }
  const a = (liste, cat) => liste.filter((m) => m.startsWith('[' + cat + ']'));

  // 1. Page dézoomée par le visiteur, rien ne dépasse : rien à signaler
  let s = await visite(0.85, null, 9000);
  ok(!a(s, 'Page dézoomée').length && !a(s, "Page plus large que l'écran").length, 'dézoom du visiteur sans débordement : non signalé (' + s.join(' | ') + ')');

  // 2. Zoom avant sans champ actif (doigts, clavier, menu) : plus de « Zoom inattendu »
  s = await visite(1, async (p) => p.evaluate(() => { visualViewport.scale = 1.6; visualViewport.dispatchEvent(new Event('resize')); }), 1000);
  ok(!a(s, 'Zoom inattendu').length, 'zoom avant du visiteur : non signalé (' + s.join(' | ') + ')');

  // 3. Élément trop large, page zoomée par le visiteur : pas mesuré pendant le zoom
  const elementLarge = (p) => p.evaluate(() => { const d = document.createElement('div'); d.id = 'trop-large'; d.textContent = 'trop large'; d.style.cssText = 'width:600px;height:20px'; document.querySelector('main, body').prepend(d); });
  s = await visite(1.6, elementLarge, 5000);
  ok(!a(s, "Page plus large que l'écran").length, 'mesure de largeur suspendue pendant un zoom (' + s.join(' | ') + ')');

  // 4. Les vrais problèmes restent signalés : élément trop large sans zoom…
  s = await visite(1, elementLarge, 5000);
  ok(a(s, "Page plus large que l'écran").some((m) => m.includes('trop-large')), 'élément trop large sans zoom : signalé');
  // … et zoom automatique sur un champ au texte de moins de 16 px
  s = await visite(1, async (p) => p.evaluate(() => {
    const champ = document.createElement('input'); champ.id = 'champ-petit'; champ.style.setProperty('font-size', '14px', 'important'); document.body.prepend(champ); champ.focus();
    visualViewport.scale = 1.4; visualViewport.dispatchEvent(new Event('resize'));
  }), 1000);
  ok(a(s, 'Zoom automatique').some((m) => m.includes('champ-petit')), 'zoom automatique sur un champ trop petit : signalé (' + s.join(' | ') + ')');

  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
