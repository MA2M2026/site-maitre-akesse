// Tableau de bord sur tablette (journal du 20/10/2026) : le bloc « Inscriptions mannequins »
// dépassait de l'écran de 75 à 114 px sur une tablette de 800 px, élargi par le texte d'une
// inscription (adresse e-mail…). Tablette en hauteur (768, 800) et ordinateur (1024) : aucun
// élément du bloc ne doit sortir de l'écran. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9300 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const inscription = { id: 'i1', full_name: 'DIARRA VIVIANE', email: 'diarraabraham205@gmail.com', phone: '+225 0102030405', genre: 'femme', date_naissance: '2012-01-01',
    statut: 'en attente de paiement', created_at: '2026-10-15T10:00:00Z', parent_nom: 'Monsieur Diarra Abraham', parent_email: 'diarraabraham205@gmail.com' };
  for (const largeur of [768, 800, 1024]) {
    const p = await b.newPage({ viewport: { width: largeur, height: 1078 } }); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { sessionStorage.setItem('ma2m_code_valide', '1'); });
    await brancher(p, { tables: { admins: [{ user_id: 'admin-1' }], inscriptions_mannequins: [inscription] }, rpc: {} }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/tableau-de-bord.html'); await p.waitForTimeout(1200);
    if (await p.isVisible('#bandeau-cookies [data-cookies="oui"]')) await p.click('#bandeau-cookies [data-cookies="oui"]');
    await p.fill('#tb-email', 'admin@test.ci'); await p.fill('#tb-password', 'motdepasse'); await p.click('#tb-login-btn');
    await p.waitForSelector('#bloc-tableau', { state: 'visible', timeout: 15000 });
    await p.evaluate(() => document.querySelector('.tdb-menu-item[data-tdb-cible="b2-inscriptions"]').click()); await p.waitForTimeout(2000);
    const r = await p.evaluate(() => {
      const L = document.documentElement.clientWidth;
      const dehors = [...document.querySelectorAll('.ref-registrations, .ref-registrations *')].filter((el) => { const x = el.getBoundingClientRect(); return x.width && x.right > L + 2; });
      return { cartes: document.querySelectorAll('#liste-inscriptions .dossier-carte').length, dehors: dehors.slice(0, 3).map((el) => el.tagName + '.' + el.className + ' ' + Math.round(el.getBoundingClientRect().right)) };
    });
    ok(r.cartes === 1 && !r.dehors.length, largeur + ' px : « Inscriptions mannequins » tient dans l\'écran ' + JSON.stringify(r));
    ok(!errs.length, largeur + ' px : aucune erreur ' + errs.join(' | '));
    await p.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
