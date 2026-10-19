// Note d'information et procédure d'intégration (14/10/2026) : PDF au nom secret dans R2,
// remis aux mannequins seulement après un code d'inscription valable, et déposé par l'admin
// depuis le tableau de bord. Rien n'est écrit pour de vrai : base, stockage et serveur simulés.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path');
const RACINE = path.resolve(__dirname, '../..');
const PORT = String(9300 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const NOTE = 'prive/note-integration/' + 'a1b2c3d4'.repeat(4) + '.pdf';

// Réponse simulée d'une fonction serveur
function fauxRes() {
  const r = { statut: 0, corps: null, entetes: {} };
  r.status = s => { r.statut = s; return r; }; r.json = c => { r.corps = c; return r; }; r.setHeader = (k, v) => { r.entetes[k] = v; };
  return r;
}

async function serveur() {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-test'; process.env.R2_ACCOUNT_ID = 'x'; process.env.R2_ACCESS_KEY_ID = 'x';
  process.env.R2_SECRET_ACCESS_KEY = 'x'; process.env.R2_BUCKET_NAME = 'seau'; process.env.R2_PUBLIC_URL = 'https://www.maitreakessemodelmanagement.com/book-photos';
  // Faux stockage R2 (remplace le module AWS) : la vraie logique de api/_r2.js tourne dessus.
  let objets = [], panne = false, lent = false; const supprimes = [];
  const commande = nom => class { constructor(entree) { this.nom = nom; this.entree = entree; } };
  const faux = { ListObjectsV2Command: commande('liste'), DeleteObjectCommand: commande('suppression'), PutObjectCommand: commande('envoi'),
    S3Client: class { async send(c) {
      if (panne) throw new Error('stockage injoignable');
      if (lent) await new Promise(r => setTimeout(r, 5000));
      if (c.nom === 'liste') return { Contents: objets.filter(o => o.Key.startsWith(c.entree.Prefix)).map(o => ({ ...o })) };
      if (c.nom === 'suppression') { supprimes.push(c.entree.Key); objets = objets.filter(o => o.Key !== c.entree.Key); return {}; }
      return {};
    } } };
  require.cache[require.resolve('@aws-sdk/client-s3', { paths: [RACINE] })] = { exports: faux, loaded: true };
  require.cache[require.resolve('@aws-sdk/s3-request-presigner', { paths: [RACINE] })] = { exports: { getSignedUrl: async () => 'https://envoi.test/signe' }, loaded: true };
  const nom = n => 'prive/note-integration/' + String(n).repeat(32).slice(0, 32) + '.pdf';
  const ANCIENNE = nom('1'), RECENTE = nom('2'), AUTRE = nom('3');
  objets = [{ Key: ANCIENNE, LastModified: new Date('2026-10-01') }, { Key: RECENTE, LastModified: new Date('2026-10-10') }, { Key: 'prive/note-integration/devinable.pdf', LastModified: new Date('2026-10-12') }];
  // base simulée : code « BON » valable, compte « admin » administrateur
  let admin = true;
  global.fetch = async (url, opts) => {
    const u = String(url), corps = opts && opts.body ? JSON.parse(opts.body) : {};
    const json = (v, st = 200) => ({ ok: st < 300, status: st, json: async () => v, text: async () => JSON.stringify(v) });
    if (/rpc\/connexion_verifier_blocage/.test(u)) return json([{ bloque: false }]);
    if (/rpc\/connexion_enregistrer_echec/.test(u)) return json([{ bloque: false, essais_restants: 2 }]);
    if (/rpc\/connexion_enregistrer_succes/.test(u)) return json(null);
    if (/rpc\/verifier_code_inscription/.test(u)) return json(corps.code_input === 'BON');
    if (/auth\/v1\/user/.test(u)) return json({ id: 'u1' });
    if (/rest\/v1\/admins/.test(u)) return json(admin ? [{ user_id: 'u1' }] : []);
    return json({});
  };
  const codeProtege = require(path.join(RACINE, 'api/code-protege.js'));
  const sitesImages = require(path.join(RACINE, 'api/r2-site-images.js'));
  const appeler = async (f, corps, jeton) => { const res = fauxRes(); await f({ method: 'POST', body: corps, headers: { authorization: jeton ? 'Bearer ' + jeton : '' } }, res); return res; };

  let r = await appeler(codeProtege, { type: 'inscription', code: 'BON' });
  ok(r.statut === 200 && r.corps.note === RECENTE, 'serveur : code valable → la note LA PLUS RÉCENTE est remise (les noms devinables sont ignorés)');
  r = await appeler(codeProtege, { type: 'inscription', code: 'FAUX' });
  ok(r.statut === 401 && !('note' in (r.corps || {})), 'serveur : code faux → refus, aucune note');
  panne = true; r = await appeler(codeProtege, { type: 'inscription', code: 'BON' }); panne = false;
  ok(r.statut === 200 && r.corps.note === null, 'serveur : stockage en panne → l\'inscription continue sans note');
  lent = true; const t0 = Date.now(); r = await appeler(codeProtege, { type: 'inscription', code: 'BON' }); lent = false;
  ok(r.statut === 200 && r.corps.note === null && Date.now() - t0 < 4500, 'serveur : stockage trop lent → réponse sans note en 3 s au plus (' + (Date.now() - t0) + ' ms)');

  r = await appeler(sitesImages, { action: 'lire', categorie: 'note-integration' }, 'jeton');
  ok(r.statut === 200 && r.corps.chemin === RECENTE, 'serveur : l\'admin voit le document en place');
  admin = false; r = await appeler(sitesImages, { action: 'lire', categorie: 'note-integration' }, 'jeton'); admin = true;
  ok(r.statut === 403, 'serveur : un compte non admin ne voit pas le document');
  r = await appeler(sitesImages, { action: 'lire', categorie: 'note-integration' });
  ok(r.statut === 401, 'serveur : sans connexion, refus');
  r = await appeler(sitesImages, { categorie: 'note-integration', chemin: 'prive/note-integration/note.pdf', contentType: 'application/pdf', taille: 1000 }, 'jeton');
  ok(r.statut === 400, 'serveur : nom devinable refusé (32 caractères secrets obligatoires)');
  r = await appeler(sitesImages, { categorie: 'note-integration', chemin: AUTRE, contentType: 'text/html', taille: 1000 }, 'jeton');
  ok(r.statut === 400, 'serveur : seul un PDF est accepté');
  r = await appeler(sitesImages, { categorie: 'note-integration', chemin: AUTRE, contentType: 'application/pdf', taille: 20 * 1024 * 1024 }, 'jeton');
  ok(r.statut === 400, 'serveur : document de plus de 15 Mo refusé');
  r = await appeler(sitesImages, { categorie: 'note-integration', chemin: AUTRE, contentType: 'application/pdf', taille: 1000 }, 'jeton');
  ok(r.statut === 200 && r.corps.uploadUrl, 'serveur : envoi d\'un PDF au nom secret accepté');
  r = await appeler(sitesImages, { categorie: 'actualites', chemin: 'site/actualites/x.pdf', contentType: 'application/pdf', taille: 1000 }, 'jeton');
  ok(r.statut === 400, 'serveur : les images refusent toujours les PDF');
  r = await appeler(sitesImages, { action: 'nettoyer', categorie: 'note-integration', chemin: AUTRE }, 'jeton');
  ok(r.statut === 404 && supprimes.length === 0, 'serveur : nettoyage avec un document inexistant → rien n\'est supprimé');
  r = await appeler(sitesImages, { action: 'nettoyer', categorie: 'note-integration', chemin: RECENTE }, 'jeton');
  ok(r.statut === 200 && supprimes.join() === ANCIENNE && objets.some(o => o.Key === RECENTE), 'serveur : seuls les documents plus anciens sont retirés');
  // deux dépôts presque simultanés : le nettoyage du premier n'efface pas le second
  objets.push({ Key: AUTRE, LastModified: new Date('2026-10-14') });
  r = await appeler(sitesImages, { action: 'nettoyer', categorie: 'note-integration', chemin: RECENTE }, 'jeton');
  ok(r.statut === 200 && objets.some(o => o.Key === AUTRE), 'serveur : un dépôt plus récent n\'est jamais effacé par un nettoyage plus ancien');
}

async function navigateur() {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  // 1) Page d'inscription : la note apparaît seulement après un code valable
  for (const [page, avecNote] of [['inscription-mannequin.html', true], ['en/inscription-mannequin.html', true], ['inscription-mannequin.html', false]]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await brancher(p, { tables: {}, api: { '/api/code-protege': { ok: true, note: avecNote ? NOTE : null } } }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1200);
    const avant = await p.isVisible('#bloc-note-integration');
    await p.fill('#code-inscription', 'BON'); await p.click('#valider-code-btn'); await p.waitForTimeout(1200);
    const etat = await p.evaluate(() => ({ visible: !!document.getElementById('bloc-note-integration').offsetParent,
      lire: document.getElementById('note-integration-lire').getAttribute('href') }));
    if (avecNote) {
      ok(!avant && etat.visible, page + ' : la note apparaît seulement après le code');
      ok(etat.lire === 'https://photos.maitreakessemodelmanagement.com/' + NOTE, page + ' : lien du document servi par Cloudflare (jamais par le relais mis en cache)');
    } else ok(!etat.visible, page + ' : aucun document déposé → pas d\'encadré');
    ok(!errs.length, page + ' : aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  // 2) Code faux : rien n'apparaît
  {
    const ctx = await b.newContext(); const p = await ctx.newPage();
    await brancher(p, { tables: {}, api: {} }, []);
    await p.route(/\/api\/code-protege/, r => r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'refuse', essaisRestants: 2 }) }));
    await p.goto('http://127.0.0.1:' + PORT + '/inscription-mannequin.html'); await p.waitForTimeout(1000);
    await p.fill('#code-inscription', 'FAUX'); await p.click('#valider-code-btn'); await p.waitForTimeout(1000);
    ok(!(await p.isVisible('#bloc-note-integration')) && !(await p.isVisible('#ins-nom')), 'code faux : ni formulaire ni note');
    await ctx.close();
  }
  // 3) Tableau de bord : dépôt du document, sur téléphone et ordinateur
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const errs = [], appels = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { sessionStorage.setItem('ma2m_code_valide', '1'); });
    await brancher(p, { tables: { admins: [{ user_id: 'admin-1' }] }, rpc: { code_validation_statut: [{ defini: true }] } }, []);
    let depose = null;
    await p.route(/\/api\/r2-site-images/, async r => {
      const c = JSON.parse(r.request().postData() || '{}'); appels.push(c);
      if (c.action === 'lire') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(depose ? { chemin: depose, date: '2026-10-14T04:00:00Z' } : {}) });
      if (c.action === 'nettoyer') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      depose = c.chemin;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uploadUrl: 'http://127.0.0.1:' + PORT + '/__stockage', publicUrl: 'x' }) });
    });
    await p.route(/__stockage/, r => r.fulfill({ status: 200, body: '' }));
    await p.goto('http://127.0.0.1:' + PORT + '/tableau-de-bord.html'); await p.waitForTimeout(1200);
    await p.fill('#tb-email', 'admin@test.ci'); await p.fill('#tb-password', 'motdepasse'); await p.click('#tb-login-btn');
    await p.waitForSelector('#bloc-tableau', { state: 'visible', timeout: 15000 });
    // comme l'administratrice : menu → Sécurité & accès → Codes d'inscription
    await p.evaluate(() => document.querySelector('[data-tdb-cible="b3b-codes-inscription"]').click()); await p.waitForTimeout(1500);
    ok(await p.isVisible('#ni-fichier'), 'tableau de bord ' + vp.width + 'px : le dépôt du document est dans « Codes d\'inscription »');
    const etatVide = await p.textContent('#ni-etat');
    await p.setInputFiles('#ni-fichier', { name: 'Note.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 essai') });
    await p.click('#ni-envoyer-btn'); await p.waitForTimeout(2000);
    const envoi = appels.find(c => !c.action), nettoyage = appels.find(c => c.action === 'nettoyer');
    ok(/Aucun document/.test(etatVide), 'tableau de bord ' + vp.width + 'px : « aucun document » au départ (' + etatVide + ')');
    ok(envoi && /^prive\/note-integration\/[0-9a-f]{32}\.pdf$/.test(envoi.chemin) && envoi.contentType === 'application/pdf', 'tableau de bord ' + vp.width + 'px : envoi sous un nom secret (' + (envoi || {}).chemin + ')');
    ok(nettoyage && nettoyage.chemin === envoi.chemin, 'tableau de bord ' + vp.width + 'px : les anciens documents sont retirés après l\'envoi');
    ok(/Document en place/.test(await p.textContent('#ni-etat')) && /déposé/.test(await p.textContent('#ni-msg')), 'tableau de bord ' + vp.width + 'px : document en place annoncé');
    await p.setInputFiles('#ni-fichier', { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('xx') });
    ok(await p.isDisabled('#ni-envoyer-btn'), 'tableau de bord ' + vp.width + 'px : un fichier qui n\'est pas un PDF est refusé');
    ok(!errs.length, 'tableau de bord ' + vp.width + 'px : aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
}

(async () => {
  await serveur();
  await navigateur();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
