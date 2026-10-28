// Mur de photos derrière le titre des pages (28/10/2026, js/app.js murDeTitre) : huit visages des mannequins
// publiés, atténués sous un voile rouge mat, en haut des pages publiques ; pas sur l'accueil, « Qui sommes-nous »
// et la fiche d'un mannequin ; tous les textes restent lisibles ; une seule lecture des photos par visite.
// Base simulée (dix mannequins publiés) : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const chemin = require('path');
const PORT = String(9500 + Math.floor(Math.random() * 90)), BASE = 'http://127.0.0.1:' + PORT;
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const ids = [...Array(10).keys()].map((i) => 'm' + i);
const tables = { model_profiles: ids.map((id, i) => ({ id, full_name: 'Mannequin ' + i, published: true, created_at: '2026-10-0' + (i % 9 + 1) })) };
const photos = ids.map((id, i) => ({ model_id: id, url: BASE + '/scripts/tests-visiteur/medias/photo' + (i % 5) + '.jpg', url_petite: null }));
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 860 }]]) {
    // un seul onglet, de page en page, comme un visiteur (la mémoire de la visite est propre à l'onglet)
    const ctx = await b.newContext({ viewport: ecran }); const journal = [];
    const p = await ctx.newPage(); let errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables: JSON.parse(JSON.stringify(tables)), rpc: { photos_couverture_petites: photos, photos_couverture_mannequins: photos } }, journal);
    await ctx.addInitScript(() => { sessionStorage.setItem('ma2m_porte_ouverte', '1'); localStorage.setItem('ma2m_cookies', 'non'); });
    for (const [page, attendu] of [['services.html', 8], ['contact.html', 8], ['en/agenda.html', 8], ['index.html', 0], ['qui-sommes-nous.html', 0]]) {
      errs = []; const avant = journal.length;
      await p.goto(BASE + '/' + page); await p.waitForTimeout(2000);
      const n = await p.evaluate(() => document.querySelectorAll('.mur-titre img').length);
      ok(n === attendu, nom + ' : ' + page + ' : ' + (attendu ? 'huit visages derrière le titre' : 'pas de mur (la page a sa propre grande photo)') + ' (' + n + ')');
      if (attendu) {
        const pales = await lirePageEntiere(p);
        ok(!pales.length, nom + ' : ' + page + ' : textes lisibles sur le mur' + (pales.length ? ' — ' + pales.slice(0, 3).map((x) => x.texte.slice(0, 20) + ' ' + x.contraste).join(', ') : ''));
        ok(await p.evaluate(() => document.querySelector('.mur-titre').getAttribute('aria-hidden') === 'true'), nom + ' : ' + page + ' : mur décoratif, caché aux lecteurs d’écran');
      }
      if (page !== 'services.html' && attendu) {   // déjà lues sur la page précédente : la visite ne les redemande pas pour le mur
        const lues = journal.slice(avant).filter((j) => j[0] === 'rpc' && /photos_couverture/.test(j[1])).length;
        ok(lues === 0, nom + ' : ' + page + ' : photos du mur reprises de la visite, pas relues (' + lues + ')');
      }
      ok(!errs.length, nom + ' : ' + page + ' : aucune erreur ' + errs.join(' | '));
    }
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
