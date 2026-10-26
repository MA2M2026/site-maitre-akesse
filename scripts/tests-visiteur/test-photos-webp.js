// Photos légères en WebP (12/10/2026) : une photo envoyée depuis l'Espace mannequin part en
// JPEG + WebP pour la miniature et la version moyenne (noms en « -w.jpg » / « -w.webp ») ;
// sans WebP (Safari), seulement le JPEG, nom habituel. Les pages affichent la copie WebP, et
// reviennent au JPEG si elle manque. La suppression emporte aussi la copie WebP.
// Base et stockage simulés : rien n'est écrit pour de vrai.
const admin = require('./donnees-nouvelle-admin');
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const fs = require('fs'); const path = require('path');
const PORT = String(9100 + Math.floor(Math.random() * 90));
const PHOTO = fs.readFileSync(path.join(__dirname, 'medias/photo0.jpg'));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

async function espace(b, sansWebp) {
  const q = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = [], journal = [], envois = [];
  q.on('pageerror', e => errs.push(e.message));
  await q.addInitScript((sansWebp) => {
    const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 36000;
    const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
    localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'awa@test.ci' } }));
    if (sansWebp) { // comme Safari : le canvas ne sait pas écrire le WebP (il rend du PNG)
      const toBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { return toBlob.call(this, cb, type === 'image/webp' ? 'image/png' : type, q); };
    }
  }, sansWebp);
  await brancher(q, { tables: { model_profiles: [{ id: 'admin-1', full_name: 'AWA KONÉ', published: true, desactive: false, slug: 'awa-kone' }] }, rpc: {} }, journal);
  await q.route(/\/api\/r2-presigner/, async r => {
    const corps = JSON.parse(r.request().postData() || '{}'); envois.push(corps);
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uploadUrl: 'http://127.0.0.1:' + PORT + '/__stockage', publicUrl: 'https://photos.test/' + corps.chemin }) });
  });
  await q.route(/__stockage/, r => r.fulfill({ status: 200, body: '' }));
  await q.goto('http://127.0.0.1:' + PORT + '/app/espace-mannequin.html'); await q.waitForTimeout(4000);
  for (let n = 1; n <= 6 && !(await q.$('#fBook')); n++) { await q.click('.step-tab[data-goto="' + n + '"]').catch(() => {}); await q.waitForTimeout(400); }
  await q.setInputFiles('#fBook', [{ name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: PHOTO }]).catch(e => errs.push('envoi : ' + e.message));
  await q.waitForTimeout(5000);
  const ligne = journal.filter(j => j[0] === 'POST' && j[1] === 'model_photos').map(j => JSON.parse(j[3])).pop() || {};
  return { q, errs, envois, ligne };
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();

  // 1) Envoi depuis un navigateur qui écrit le WebP (Chrome, Android)
  let { q, errs, envois, ligne } = await espace(b, false);
  const chemins = envois.filter(e => e.action !== 'suppression').map(e => e.chemin + ' ' + e.contentType);
  ok(chemins.some(c => /\/miniatures\/.*-n800-w\.webp image\/webp$/.test(c)) && chemins.some(c => /\/moyennes\/.*-w\.webp image\/webp$/.test(c)), 'envoi : copies WebP de la miniature et de la version moyenne');
  ok(/-n800-w\.jpg$/.test(ligne.chemin_miniature || '') && /-w\.jpg$/.test(ligne.chemin_moyenne || '') && /-w\.jpg$/.test(ligne.url_moyenne || ''), 'envoi : la fiche de la photo garde les JPEG marqués « -w.jpg » (' + ligne.chemin_moyenne + ')');
  // la suppression emporte la copie WebP
  envois.length = 0;
  await q.evaluate(() => supprimerDeR2('admin-1', 'admin-1/moyennes/123-abc-w.jpg'));
  ok(JSON.stringify(envois.map(e => e.chemin).sort()) === JSON.stringify(['admin-1/moyennes/123-abc-w.jpg', 'admin-1/moyennes/123-abc-w.webp']), 'suppression : le JPEG et sa copie WebP');
  ok(!errs.length, 'envoi WebP : aucune erreur ' + errs.join(' | '));
  await q.context().close();

  // 2) Envoi depuis Safari (pas d'écriture WebP) : JPEG seul, nom habituel
  ({ q, errs, envois, ligne } = await espace(b, true));
  ok(!envois.some(e => /\.webp$/.test(e.chemin)) && /-n800\.jpg$/.test(ligne.chemin_miniature || '') && !/-w\.jpg$/.test(ligne.chemin_moyenne || ''), 'Safari : JPEG seul, sans copie WebP (' + ligne.chemin_miniature + ')');
  ok(!errs.length, 'Safari : aucune erreur ' + errs.join(' | '));
  await q.context().close();

  // 3) Affichage : la grille de The Book montre la copie WebP ; copie absente → JPEG
  for (const webpAbsent of [false, true]) {
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const e2 = [];
    p.on('pageerror', e => e2.push(e.message));
    await brancher(p, { tables: { model_profiles: [{ id: 'a1', full_name: 'Awa Koné', city: 'Abidjan', height_cm: 178, category: 'femme', genre: 'femme', published: true, slug: 'awa-kone' }], model_photos: [] },
      rpc: { photos_couverture_mannequins: [{ model_id: 'a1', url: 'https://photos.test/a1/miniatures/1-x-n800-w.jpg' }] } }, []);
    await p.route(/photos\.test\/.*\.webp/, r => webpAbsent ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
    await p.route(/photos\.test\/.*\.jpg/, r => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
    await p.goto('http://127.0.0.1:' + PORT + '/mannequins.html'); await p.waitForTimeout(3000);
    const src = await p.evaluate(() => { const i = document.querySelector('#grille img'); return i ? i.getAttribute('src') : ''; });
    if (webpAbsent) ok(/-n800-w\.jpg$/.test(src), 'affichage : copie WebP absente → retour au JPEG (' + src + ')');
    else ok(/-n800-w\.webp$/.test(src), 'affichage : The Book montre la copie WebP (' + src + ')');
    ok(!e2.length, 'affichage : aucune erreur ' + e2.join(' | '));
    await p.context().close();
  }
  // 3 bis) Accueil (grandes photos), fiche d'une mannequin, Qui sommes-nous : copies WebP
  //        affichées ; une photo d'ORIGINE dont le nom finit par « -w.jpg » n'est pas touchée
  {
    const M = 'https://photos.test/a1/moyennes/1-x-w.jpg', N = 'https://photos.test/a1/miniatures/1-x-n800-w.jpg';
    const tables = { model_profiles: [{ id: 'a1', full_name: 'Awa Koné', city: 'Abidjan', height_cm: 178, category: 'femme', genre: 'femme', published: true, featured: true, slug: 'awa-kone' }],
      model_photos: [{ id: 'p1', model_id: 'a1', url: 'https://photos.test/a1/1-shooting-w.jpg', url_moyenne: M, url_miniature: N, principale: true, photo_couverture: true, categorie: 'book', created_at: '2026-10-01T10:00:00Z', 'model_profiles.published': true },
        // trois autres mannequins (« Nos visages » de Qui sommes-nous en demande au moins 4), tous en WebP
        ...['b2', 'c3', 'd4'].map(id => ({ id: 'p' + id, model_id: id, url: 'https://photos.test/' + id + '/o.jpg', url_moyenne: M, url_miniature: N, principale: true, categorie: 'book', created_at: '2026-10-01T10:00:00Z', 'model_profiles.published': true }))],
      bandeau_annonce: [], instagram_posts_cache: [], mot_responsable: [], actualites: [], evenements: [], partenaires: [], admins: [] };
    for (const [page, attendu] of [['index.html', /a1\/moyennes\/1-x-w\.webp/], ['mannequin.html?id=a1', /a1\/(moyennes|miniatures)\/1-x-(n800-)?w\.webp/], ['qui-sommes-nous.html', /a1\/moyennes\/1-x-w\.webp/]]) {
      const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const e3 = [];
      p.on('pageerror', e => e3.push(e.message));
      await brancher(p, { tables, rpc: { photos_couverture_mannequins: [{ model_id: 'a1', url: N }] } }, []);
      await p.route(/photos\.test\//, r => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
      await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
      const entrer = await p.$('text=/^\\s*(Entrer|Enter)\\s*$/i'); if (entrer) await entrer.click().catch(() => {});
      await p.waitForTimeout(2500);
      const srcs = await p.evaluate(() => [...document.images].map(i => i.getAttribute('src') || ''));
      ok(srcs.some(x => attendu.test(x)), page + ' : photo affichée en WebP');
      ok(!srcs.some(x => /1-shooting-w\.webp/.test(x)), page + ' : photo d\'origine en « -w.jpg » laissée en JPEG');
      ok(!e3.length, page + ' : aucune erreur ' + e3.join(' | '));
      await p.context().close();
    }
  }

  // 4) Administration (/admin/) : le rattrapage automatique refait les anciennes versions avec copie WebP
  //    (déplacé de l'ancien tableau de bord dans js/photos.js à sa démolition, 23/10/2026)
  {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); const journal = [], envois = [];
    const d = admin.donnees('principal'); d.tables.model_photos = [
      { id: 'v1', model_id: 'm1', url: 'https://www.maitreakessemodelmanagement.com/book-photos/m1/orig.jpg', url_miniature: 'https://photos.test/m1/miniatures/1-a-n800.jpg', chemin_miniature: 'm1/miniatures/1-a-n800.jpg', url_moyenne: 'https://photos.test/m1/moyennes/1-b.jpg', chemin_moyenne: 'm1/moyennes/1-b.jpg' },
      { id: 'v2', model_id: 'm1', url: 'https://www.maitreakessemodelmanagement.com/book-photos/m1/orig2.jpg', url_miniature: 'x', chemin_miniature: 'm1/miniatures/2-a-n800-w.jpg', url_moyenne: 'y', chemin_moyenne: 'm1/moyennes/2-b-w.jpg' }];
    await brancher(p, d, journal);
    await p.route(/\/api\/r2-presigner/, async r => { const c = JSON.parse(r.request().postData() || '{}'); envois.push(c.chemin);
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uploadUrl: 'http://127.0.0.1:' + PORT + '/__stockage', publicUrl: 'https://photos.test/' + c.chemin }) }); });
    await p.route(/__stockage/, r => r.fulfill({ status: 200, body: '' }));
    await p.route(/photos\.test\//, r => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
    // (photos d'origine lues par l'adresse du site, comme en ligne : la règle de sécurité de
    // l'Administration n'autorise pas d'autre adresse)
    await p.route(/\/book-photos\/m1\//, r => r.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO }));
    await admin.seConnecter(p, 'http://127.0.0.1:' + PORT + '/admin/'); await p.waitForSelector('.accueil-tete', { timeout: 15000 });
    // (sans attendre les 8 secondes du lancement automatique)
    await p.evaluate(async () => { try { sessionStorage.removeItem('ma2m_rattrapage_photos'); } catch (e) {} await rattraperPhotosEnArrierePlan(); });
    const maj = journal.filter(j => j[0] === 'PATCH' && j[1] === 'model_photos');
    const m = maj.length ? JSON.parse(maj[0][3]) : {};
    ok(maj.length === 1 && /id=eq\.v1/.test(maj[0][2]) && /-n800-w\.jpg$/.test(m.chemin_miniature || '') && /-w\.jpg$/.test(m.chemin_moyenne || '') && envois.filter(c => /\.webp$/.test(c)).length === 2,
      'rattrapage : ancienne photo refaite avec copies WebP, photo déjà légère laissée (' + maj.length + ' mise(s) à jour)');
    await p.context().close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
