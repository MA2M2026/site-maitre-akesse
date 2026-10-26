// Actualités et Événements, côté administratrice (12/10/2026 : fonctions de rédaction et de
// suppression regroupées dans js/publications.js) : publier, modifier, supprimer depuis la
// rédaction et depuis la fenêtre de lecture, se déconnecter. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const PORT = String(9100 + Math.floor(Math.random() * 90));
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const session = () => {
    const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 36000;
    const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
    localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'admin@test.ci' } }));
  };
  const cas = [
    ['actualites.html', 'actualites', { actualites: [{ id: 'n1', titre: 'Casting Orange', commentaire: '<p>Texte</p>', categorie: 'Casting', created_at: '2026-10-01T10:00:00Z', image_url: 'https://x/1.jpg' }],
      actualite_photos: [{ actualite_id: 'n1', url: 'https://x/1.jpg', chemin: 'site/actualites/n1/1.jpg' }] }, 'video'],
    ['en/evenements.html', 'evenements', { evenements: [{ id: 'e1', titre: 'Défilé Abidjan', description: '<p>D</p>', date_evenement: '2026-09-20', created_at: '2026-09-21T10:00:00Z', image_url: 'https://x/2.jpg' }],
      evenement_photos: [{ evenement_id: 'e1', url: 'https://x/2.jpg', chemin: 'site/evenements/e1/2.jpg' }] }, 'photo']
  ];
  for (const [page, table, tables, creer] of cas) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [], journal = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.addInitScript(session);
    await brancher(p, { tables: Object.assign({ admins: [{ user_id: 'admin-1' }] }, tables), rpc: {} }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(2500);
    const r = {};
    // publier : une actualité avec une vidéo seule ; un événement avec une photo (20/10/2026 :
    // rédaction regroupée dans js/publications.js — sans titre, l'événement est refusé)
    await p.$eval('#ouvrir-redaction-btn', x => x.click()); await p.waitForTimeout(400);
    // éditeur de texte riche chargé à la demande pour l'agence (26/10/2026, js/app.js)
    await p.waitForSelector('#red-editeur .ql-editor', { timeout: 8000 }).catch(() => {});
    r.editeurRiche = !!(await p.$('#red-editeur .ql-editor'));
    if (creer === 'video') await p.fill('#red-video', 'https://youtu.be/abc');
    else {
      await p.setInputFiles('#red-images', require('path').resolve(__dirname, 'medias/photo0.jpg'));
      await p.$eval('#red-enregistrer-btn', x => x.click()); await p.waitForTimeout(400);
      r.titreExige = !journal.some(j => j[0] === 'POST' && j[1] === table) && /titre est obligatoire|Title is required/.test(await p.textContent('#red-msg'));
    }
    await p.fill('#red-titre', 'Essai publication');
    await p.$eval('#red-enregistrer-btn', x => x.click()); await p.waitForTimeout(2500);
    r.publie = journal.some(j => j[0] === 'POST' && j[1] === table && /Essai publication/.test(j[3] || ''));
    r.messagePublie = /publiée|publié|published/i.test(await p.textContent('#red-msg'));
    // modifier depuis la fenêtre de lecture puis enregistrer
    await p.evaluate(() => (document.querySelector('.news-card, .event-card, [data-index]') || {}).click && document.querySelector('.news-card, .event-card, [data-index]').click()); await p.waitForTimeout(1200);
    await p.$eval('#news-modal-modifier-btn', x => x.click()); await p.waitForTimeout(500);
    await p.fill('#red-titre', 'Titre modifié'); await p.$eval('#red-enregistrer-btn', x => x.click()); await p.waitForTimeout(1200);
    r.modifie = journal.some(j => j[0] === 'PATCH' && j[1] === table && /Titre modifi/.test(j[3] || ''));
    // le texte déjà publié est repris dans l'éditeur, puis gardé à l'enregistrement
    r.texteGarde = journal.some(j => j[0] === 'PATCH' && j[1] === table && /Titre modifi/.test(j[3] || '') && (table === 'actualites' ? /Texte/ : /<p>D<\/p>/).test(j[3] || ''));
    const suppressions = () => journal.filter(j => j[0] === 'DELETE' && j[1] === table).length;
    const ouvrirCarte = () => p.evaluate(() => (document.querySelector('.news-card, .event-card, [data-index]') || {}).click && document.querySelector('.news-card, .event-card, [data-index]').click());
    // supprimer depuis la rédaction (bouton « 🗑 Supprimer » de la fenêtre de rédaction)
    await ouvrirCarte(); await p.waitForTimeout(1000);
    await p.$eval('#news-modal-modifier-btn', x => x.click()); await p.waitForTimeout(500);
    let avant = suppressions();
    await p.$eval('#red-supprimer-btn', x => x.click()); await p.waitForTimeout(1200);
    r.supprimeRedaction = suppressions() > avant;
    // supprimer depuis la fenêtre de lecture
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(2500);
    await ouvrirCarte(); await p.waitForTimeout(1000);
    avant = suppressions();
    await p.$eval('#news-modal-supprimer-btn', x => x.click()); await p.waitForTimeout(1200);
    r.supprimeLecture = suppressions() > avant;
    // se déconnecter : le bloc d'administration disparaît
    await p.$eval('#admin-logout-btn', x => x.click()); await p.waitForTimeout(800);
    r.deconnecte = await p.$eval('#admin-bloc', x => getComputedStyle(x).display === 'none');
    const ok = r.editeurRiche && r.texteGarde && r.publie && r.messagePublie && (creer === 'video' || r.titreExige) && r.modifie && r.supprimeRedaction && r.supprimeLecture && r.deconnecte && !errs.length;
    console.log((ok ? '✓' : '❌ ÉCHEC') + ' rédaction ' + page + ' ' + JSON.stringify(r) + ' | erreurs : ' + JSON.stringify(errs));
    if (!ok) process.exitCode = 1;
    await p.context().close();
  }
  // Partenaires côté agence : ajouter (texte écrit dans l'éditeur) et modifier (texte repris)
  {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [], journal = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.addInitScript(session);
    await brancher(p, { tables: { admins: [{ user_id: 'admin-1' }], partenaires: [{ id: 'pa1', nom: 'Gilles Touré', structure: 'Maison', description: '<p>Notes anciennes</p>', created_at: '2026-10-01T10:00:00Z' }] }, rpc: {} }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/partenaires.html');
    await p.waitForSelector('#p-description-editeur .ql-editor', { timeout: 8000 }).catch(() => {});
    const r = { editeurRiche: !!(await p.$('#p-description-editeur .ql-editor')) };
    await p.fill('#p-nom', 'Nouvelle marque');
    await p.click('#p-description-editeur .ql-editor').catch(() => {}); await p.keyboard.type('Texte du partenaire');
    await p.$eval('#p-publier-btn', x => x.click()); await p.waitForTimeout(1500);
    r.ajoute = journal.some(j => j[0] === 'POST' && j[1] === 'partenaires' && /Nouvelle marque/.test(j[3] || '') && /Texte du partenaire/.test(j[3] || ''));
    await p.$eval('.news-carte[data-index="0"]', x => x.click()).catch(() => {}); await p.waitForTimeout(800);
    await p.$eval('#part-modal-modifier-btn', x => x.click()); await p.waitForTimeout(1000);
    await p.fill('#edit-p-nom', 'Gilles Touré modifié');
    await p.$eval('#edit-p-enregistrer-btn', x => x.click()); await p.waitForTimeout(1500);
    r.texteGarde = journal.some(j => j[0] === 'PATCH' && j[1] === 'partenaires' && /modifi/.test(j[3] || '') && /Notes anciennes/.test(j[3] || ''));
    const ok = r.editeurRiche && r.ajoute && r.texteGarde && !errs.length;
    console.log((ok ? '✓' : '❌ ÉCHEC') + ' partenaires (agence) ' + JSON.stringify(r) + ' | erreurs : ' + JSON.stringify(errs));
    if (!ok) process.exitCode = 1;
    await p.context().close();
  }
  // un simple visiteur ne télécharge plus l'éditeur de texte (≈ 200 Ko, 26/10/2026)
  for (const page of ['actualites.html', 'en/evenements.html', 'partenaires.html']) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const quill = [];
    p.on('request', q => { if (/quill/i.test(q.url())) quill.push(q.url()); });
    await brancher(p, { tables: { actualites: [], evenements: [], partenaires: [] }, rpc: {} }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(2000);
    console.log((quill.length ? '❌ ÉCHEC' : '✓') + ' visiteur ' + page + ' : éditeur de texte non téléchargé ' + JSON.stringify(quill));
    if (quill.length) process.exitCode = 1;
    await p.context().close();
  }
  await b.close(); srv.kill();
})().catch(e => { console.log('❌ ÉCHEC rédaction', e.message); process.exitCode = 1; });
