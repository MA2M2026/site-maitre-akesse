// Phase 2, W4 (02/11/2026) : plus AUCUN code d'administration dans les pages publiques Actualités, Événements et
// Partenaires (FR et EN). Publier, modifier et supprimer se font dans l'Administration seulement (essai :
// test-nouvelle-admin-contenu.js). Ici, comme une visiteuse… qui aurait une session de l'agence ouverte dans son
// navigateur (le pire cas) : aucun bouton « Modifier », « Supprimer », « Publier », aucun panneau, aucun script
// d'écriture chargé, la lecture d'une fiche fonctionne, et la page ne modifie RIEN dans la base (seule la statistique
// de visite page_views, envoyée par tout visiteur, et le journal d'erreurs sont permis). Base simulée.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const fs = require('fs'), path = require('path');
const RACINE = path.resolve(__dirname, '../..');
const PORT = String(9100 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
// mots qui trahissent du code ou des boutons d'écriture (relevés dans l'ancien code des pages)
const INTERDITS_HTML = ['admin-bloc', 'redaction-overlay', 'Modifier', 'Supprimer', 'Publier un nouvel', 'Rédiger une actualité', 'Ajouter ce partenaire',
  'admin-logout-btn', 'btn-mini-admin', 'portail/inactivite.js', 'publications-ecriture', 'partenaires-communs', 'images-site-ecriture'];
const INTERDITS_JS = ['verifierAdmin', 'api/r2-site-images', 'sbAdmin.from', 'sbAdmin.storage', 'envoyerImageSite', 'supprimerCheminsImagesSite',
  'effacerPublication', 'effacerPartenaire', 'sauverPublication', '.insert(', '.update(', '.delete('];
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const session = () => {
    const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 36000;
    const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
    localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'admin-1' } }));
  };
  const tables = {
    admins: [{ user_id: 'admin-1' }],
    actualites: [{ id: 'n1', titre: 'Casting Orange', commentaire: '<p>Texte</p>', categorie: 'Casting', created_at: '2026-10-01T10:00:00Z', image_url: 'https://x/1.jpg' }],
    actualite_photos: [{ actualite_id: 'n1', url: 'https://x/1.jpg' }],
    evenements: [{ id: 'e1', titre: 'Défilé Abidjan', description: '<p>D</p>', date_evenement: '2026-09-20', created_at: '2026-09-21T10:00:00Z', image_url: 'https://x/2.jpg', lieu: 'Plateau' }],
    evenement_photos: [{ evenement_id: 'e1', url: 'https://x/2.jpg' }],
    partenaires: [{ id: 'p1', nom: 'Orange CI', role: 'Promoteur', description: '<p>Partenaire</p>', logo_url: 'https://x/l.png', created_at: '2026-10-01T10:00:00Z' }]
  };
  for (const page of ['actualites', 'evenements', 'partenaires', 'en/actualites', 'en/evenements', 'en/partenaires']) {
    const html = fs.readFileSync(path.join(RACINE, page + '.html'), 'utf8');
    const restes = INTERDITS_HTML.filter((m) => html.includes(m));
    ok(!restes.length, page + ' : aucun bouton, panneau ni script d’administration dans la page' + (restes.length ? ' (' + restes.join(', ') + ')' : ''));
    // scripts propres à la page (pas les outils communs de tout le site) : aucun code d'écriture
    const scripts = [...html.matchAll(/<script[^>]*src="([^"?]+)/g)].map((m) => path.normalize(path.join(path.dirname(page), m[1])))
      .filter((s) => /^js\/(publications-lecture|actualites|evenements|partenaires|rendu-publications)\.js$/.test(s));
    const fautifs = scripts.flatMap((s) => INTERDITS_JS.filter((m) => fs.readFileSync(path.join(RACINE, s), 'utf8').includes(m)).map((m) => s + ' : ' + m));
    ok(scripts.length >= 2 && !fautifs.length, page + ' : scripts de la page en lecture seule (' + scripts.join(', ') + ')' + (fautifs.length ? ' ' + fautifs.join(' ; ') : ''));
    for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 860 }]) {
      const p = await (await b.newContext({ viewport: vp })).newPage(); const errs = [], journal = [], ecritures = [];
      p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => { errs.push('fenêtre : ' + d.message()); d.dismiss(); });
      p.on('request', (r) => { if (/supabase\.co\/(rest|storage)\//.test(r.url()) && r.method() !== 'GET' && !/\/rpc\/|\/rest\/v1\/(page_views|journal_erreurs)/.test(r.url())) ecritures.push(r.method() + ' ' + r.url()); });
      await p.addInitScript(session);
      await brancher(p, { tables, rpc: {} }, journal);
      await p.goto('http://127.0.0.1:' + PORT + '/' + page + '.html');
      await p.waitForSelector('.news-carte, .news-une', { timeout: 15000 });
      await p.waitForTimeout(600);
      await p.click('.news-une, .news-carte');
      await p.waitForSelector('#news-modal.active, #part-modal.active', { timeout: 8000 });
      const boutons = await p.$$eval('button, a', (l) => l.filter((x) => x.offsetParent !== null).map((x) => x.textContent.trim()).filter((t) => /Modifier|Supprimer|Publier|Edit|Delete|Publish/.test(t)));
      ok(!boutons.length, page + ' ' + vp.width + 'px, session de l’agence ouverte : fiche lisible, aucun bouton d’écriture (' + boutons.join(' | ') + ')');
      ok(!ecritures.length && !errs.length, page + ' ' + vp.width + 'px : rien n’est écrit dans la base, aucune erreur ' + ecritures.concat(errs).join(' | ').slice(0, 200));
      await p.context().close();
    }
  }
  await b.close(); srv.kill();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ÉCHEC ' + e.message); process.exit(1); });
