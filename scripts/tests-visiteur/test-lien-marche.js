// Liens entre les deux formulaires (21/10/2026, demande de la propriétaire) : en haut de « Intégrer
// l'agence » et de « Postuler à un casting » (FR et EN), un petit bouton rond « marche » suivi du
// libellé montre où cliquer. Visité comme une personne, sur téléphone et ordinateur : le bouton est
// rond et visible, rien ne dépasse de l'écran, à l'appui son symbole passe au vert, et il ouvre
// l'autre formulaire. Base simulée : rien n'est écrit pour de vrai (aucun formulaire envoyé).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9700 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const BASE = 'http://127.0.0.1:' + PORT + '/';
const tables = { model_profiles: [], model_photos: [], castings: [], actualites: [], evenements: [], partenaires: [], admins: [] };

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const pages = [
    ['integrer-agence.html', 'Postuler à un casting', 'candidature.html'],
    ['candidature.html', 'Intégrer l\'agence', 'integrer-agence.html'],
    ['en/integrer-agence.html', 'Apply for a casting', 'en/candidature.html'],
    ['en/candidature.html', 'Join the agency', 'en/integrer-agence.html'],
  ];
  for (const [nom, vp] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1440, height: 900 }]]) {
    for (const [page, libelle, cible] of pages) {
      const n = nom + ' ' + page + ' : ';
      const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 700, hasTouch: vp.width < 700 });
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      p.on('console', m => { if (m.type() === 'error' && /Content Security Policy|Refused/.test(m.text())) errs.push(m.text()); });
      await p.addInitScript(() => { localStorage.setItem('ma2m_cookies', 'non'); });
      await brancher(p, { tables }, []);
      await p.goto(BASE + page, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1200);
      const etat = await p.evaluate(() => {
        const l = document.querySelector('.lien-marche'); if (!l) return null;
        const r = l.querySelector('.lien-marche-rond'); const box = r.getBoundingClientRect();
        return { texte: l.textContent.trim(), rond: getComputedStyle(r).borderRadius === '50%' && Math.round(box.width) === 46, deborde: document.documentElement.scrollWidth > innerWidth };
      });
      ok(etat && etat.texte === libelle, n + 'bouton « ' + (etat && etat.texte) + ' »');
      ok(etat && etat.rond && !etat.deborde, n + 'petit bouton rond visible, rien ne dépasse');
      const rond = await (await p.$('.lien-marche-rond')).boundingBox();
      await p.mouse.move(rond.x + 23, rond.y + 23); await p.mouse.down(); await p.waitForTimeout(200);
      ok(await p.evaluate(() => /31, 163, 91/.test(getComputedStyle(document.querySelector('.lien-marche-rond svg')).stroke)), n + 'à l’appui, le symbole passe au vert');
      await Promise.all([p.waitForURL(u => u.pathname.endsWith('/' + cible) || u.pathname.endsWith('/' + cible.replace('.html', '')), { timeout: 5000 }).catch(() => null), p.mouse.up()]);
      ok(new RegExp(cible.replace('.', '\\.') + '$').test(p.url()), n + 'ouvre ' + cible);
      ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
      await ctx.close();
    }
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.');
  process.exit(ko ? 1 : 0);
})();
