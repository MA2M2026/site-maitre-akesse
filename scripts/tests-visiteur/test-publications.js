// Actualités et Événements, côté administratrice (12/10/2026 : fonctions de rédaction et de
// suppression regroupées dans js/publications.js) : publier, modifier, supprimer depuis la
// rédaction et depuis la fenêtre de lecture. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9100 + Math.floor(Math.random() * 90));
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const session = () => {
    const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 36000;
    const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
    localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'admin@test.ci' } }));
  };
  const cas = [
    ['actualites.html', 'actualites', { actualites: [{ id: 'n1', titre: 'Casting Orange', commentaire: '<p>Texte</p>', categorie: 'Casting', created_at: '2026-10-01T10:00:00Z', image_url: 'https://x/1.jpg' }],
      actualite_photos: [{ actualite_id: 'n1', url: 'https://x/1.jpg', chemin: 'site/actualites/n1/1.jpg' }] }, true],
    ['en/evenements.html', 'evenements', { evenements: [{ id: 'e1', titre: 'Défilé Abidjan', description: '<p>D</p>', date_evenement: '2026-09-20', created_at: '2026-09-21T10:00:00Z', image_url: 'https://x/2.jpg' }],
      evenement_photos: [{ evenement_id: 'e1', url: 'https://x/2.jpg', chemin: 'site/evenements/e1/2.jpg' }] }, false]
  ];
  for (const [page, table, tables, creer] of cas) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [], journal = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.addInitScript(session);
    await brancher(p, { tables: Object.assign({ admins: [{ user_id: 'admin-1' }] }, tables), rpc: {} }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(2500);
    const r = {};
    if (creer) { // publier une actualité (vidéo seule, sans photo)
      await p.$eval('#ouvrir-redaction-btn', x => x.click()); await p.waitForTimeout(400);
      await p.fill('#red-titre', 'Essai publication'); await p.fill('#red-video', 'https://youtu.be/abc');
      await p.$eval('#red-enregistrer-btn', x => x.click()); await p.waitForTimeout(1200);
      r.publie = journal.some(j => j[0] === 'POST' && j[1] === table);
    }
    // modifier depuis la fenêtre de lecture puis enregistrer
    await p.evaluate(() => (document.querySelector('.news-card, .event-card, [data-index]') || {}).click && document.querySelector('.news-card, .event-card, [data-index]').click()); await p.waitForTimeout(1200);
    await p.$eval('#news-modal-modifier-btn', x => x.click()); await p.waitForTimeout(500);
    await p.fill('#red-titre', 'Titre modifié'); await p.$eval('#red-enregistrer-btn', x => x.click()); await p.waitForTimeout(1200);
    r.modifie = journal.some(j => j[0] === 'PATCH' && j[1] === table && /Titre modifi/.test(j[3] || ''));
    // supprimer depuis la rédaction
    await p.evaluate(() => (document.querySelector('.news-card, .event-card, [data-index]') || {}).click && document.querySelector('.news-card, .event-card, [data-index]').click()); await p.waitForTimeout(1000);
    await p.$eval('#news-modal-supprimer-btn', x => x.click()); await p.waitForTimeout(1200);
    r.supprime = journal.some(j => j[0] === 'DELETE' && j[1] === table);
    const ok = (creer ? r.publie : true) && r.modifie && r.supprime && !errs.length;
    console.log((ok ? '✓' : '❌ ÉCHEC') + ' rédaction ' + page + ' ' + JSON.stringify(r) + ' | erreurs : ' + JSON.stringify(errs));
    if (!ok) process.exitCode = 1;
    await p.context().close();
  }
  await b.close(); srv.kill();
})().catch(e => { console.log('❌ ÉCHEC rédaction', e.message); process.exitCode = 1; });
