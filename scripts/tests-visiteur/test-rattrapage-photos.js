// Chantier L-18 (17/11/2026, demande de la propriétaire) : RATTRAPAGE des anciennes photos Drive vers Cloudflare.
// Base, Google Drive et Cloudflare SIMULÉS (rien n'est écrit ni envoyé pour de vrai).
//  1. serveur (api/_rattrapage.js) : un dossier à la fois, tout ou rien ; copie nommée d'après la photo Drive (aucun
//     doublon) ; échec d'une photo → dépôts retirés, rien noté ; adresse non Drive ignorée ; cours de talons :
//     liens remplacés seulement si l'inscription n'a pas changé ; dossiers déjà sur Cloudflare et exclus sautés ;
//  2. serveur (api/r2-presigner.js) : réservé à l'administratrice principale ;
//  3. navigateur (Administration › Drive, téléphone et ordinateur) : bouton, compteur, fin, rien pour une autre personne.
const Module = require('module'); const chemin = require('path');
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const A = 'aaaaaaaa-1111-4111-8111-111111111111', B = 'bbbbbbbb-2222-4222-8222-222222222222', T = 'cccccccc-3333-4333-8333-333333333333';
const drive = (id) => 'https://drive.google.com/thumbnail?id=' + id + '&sz=w2000';
const JPEG = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// ---- Cloudflare R2 simulé ----
const r2 = { mis: [], effaces: [] };
const chargerAvant = Module._load;
Module._load = function (demande) {
  if (demande === '@aws-sdk/client-s3') {
    class S3Client { async send(c) { if (c.type === 'Put') { r2.mis.push(c.input.Key); return {}; } if (c.type === 'Deletes') { c.input.Delete.Objects.forEach((o) => r2.effaces.push(o.Key)); return {}; } return {}; } }
    const C = (type) => class { constructor(i) { this.input = i; this.type = type; } };
    return { S3Client, PutObjectCommand: C('Put'), GetObjectCommand: C('Get'), DeleteObjectCommand: C('Delete'), DeleteObjectsCommand: C('Deletes'), ListObjectsV2Command: C('List') };
  }
  if (demande === '@aws-sdk/s3-request-presigner') return { getSignedUrl: async () => 'https://r2.essai/x' };
  return chargerAvant.apply(this, arguments);
};

async function serveur() {
  Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: 'cle-essai', R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'b', R2_SECRET_ACCESS_KEY: 'c', R2_BUCKET_NAME: 'photos', R2_PUBLIC_URL: 'https://photos.test' });
  const base = { photos: [], talons: [], googleEnPanne: new Set(), demandesGoogle: [], role: 'principal' };
  const remplir = () => {
    base.photos = [
      { application_id: A, url: drive('photoA1xxxxx'), chemin: null }, { application_id: A, url: drive('photoA2xxxxx'), chemin: null },
      { application_id: B, url: drive('photoB1xxxxx'), chemin: null }, { application_id: B, url: 'https://exemple.com/autre.jpg', chemin: null }
    ];
    base.talons = [{ id: T, photos: [drive('photoT1xxxxx'), drive('photoT2xxxxx')] }];
    r2.mis.length = 0; r2.effaces.length = 0; base.googleEnPanne.clear(); base.demandesGoogle.length = 0;
  };
  global.fetch = async (url, o = {}) => {
    const u = String(url), d = decodeURIComponent(u), m = o.method || 'GET';
    const json = (x, s = 200) => ({ ok: s < 300, status: s, json: async () => x, text: async () => JSON.stringify(x), arrayBuffer: async () => new ArrayBuffer(0) });
    if (u.startsWith('https://drive.google.com/')) {
      base.demandesGoogle.push(u);
      const id = new URL(u).searchParams.get('id');
      if (base.googleEnPanne.has(id)) return json({}, 429);
      return { ok: true, status: 200, arrayBuffer: async () => Uint8Array.from(JPEG).buffer };
    }
    const q = new URL(u).searchParams;
    if (d.includes('/rest/v1/casting_photos?select=application_id,url&chemin=is.null')) {
      const debut = Number(q.get('offset') || 0), n = Number(q.get('limit'));
      return json(base.photos.filter((x) => !x.chemin && x.url.startsWith('https://drive.google.com/thumbnail')).slice(debut, debut + n));
    }
    if (d.includes('/rest/v1/casting_photos?select=application_id&chemin=like.r2:')) {
      const ids = q.get('application_id').replace(/^in\.\(|\)$/g, '').split(',');
      return json(base.photos.filter((x) => String(x.chemin || '').startsWith('r2:') && ids.includes(x.application_id)));
    }
    if (d.includes('/rest/v1/casting_photos?select=url&chemin=is.null&application_id=eq.')) return json(base.photos.filter((x) => !x.chemin && 'eq.' + x.application_id === q.get('application_id')));
    if (d.includes('/rest/v1/casting_photos?select=chemin&application_id=eq.')) return json(base.photos.filter((x) => String(x.chemin || '').startsWith('r2:') && 'eq.' + x.application_id === q.get('application_id')));
    if (d.includes('/rest/v1/cours_talons?select=photos&id=eq.')) return json(base.talons.filter((x) => 'eq.' + x.id === q.get('id')));
    if (d.includes('/rest/v1/casting_photos') && m === 'POST') {
      const l = JSON.parse(o.body);
      if (l.some((x) => !x.url)) return json({ code: '23502' }, 400);
      base.photos.push(...l); return json(null, 201);
    }
    if (d.includes('/rest/v1/cours_talons?select=id,photos')) return json(base.talons.slice(Number(q.get('offset') || 0)));
    if (d.includes('/rest/v1/cours_talons?id=eq.') && m === 'PATCH') {
      const ligne = base.talons.find((x) => 'eq.' + x.id === q.get('id'));
      if (!ligne || q.get('photos') !== 'eq.' + JSON.stringify(ligne.photos) || base.talonsModifiee) return json([]);
      ligne.photos = JSON.parse(o.body).photos; return json([ligne]);
    }
    if (d.includes('staff_profiles?user_id=eq.')) return json([{ role: base.role, actif: true }]);
    if (d.includes('portail_admin_ok')) return json(true);
    if (d.includes('/auth/v1/user')) return json({ id: 'admin-1', aal: 'aal2' });
    if (d.includes('journal_erreurs')) { base.journal = (base.journal || 0) + 1; return json(null, 201); }
    return json([{ user_id: 'admin-1' }]);
  };
  const { rattraperUnDossier } = require('../../api/_rattrapage.js');

  remplir();
  let r = await rattraperUnDossier('candidature', []);
  const copiesA = base.photos.filter((x) => x.application_id === A && String(x.chemin).startsWith('r2:'));
  ok(r.corps.fait === A && r.corps.photos === 2 && copiesA.length === 2 && copiesA.every((x) => x.url === x.chemin && /^r2:candidatures\/aaaaaaaa-1111-4111-8111-111111111111\/[0-9a-f]{32}\.jpg$/.test(x.chemin)),
    'serveur : le 1er dossier est copié en entier (2 photos, noms au bon format, url remplie)');
  ok(base.photos.filter((x) => x.application_id === A && !x.chemin).length === 2 && !r2.effaces.length, 'serveur : rien n’est supprimé (lignes Drive gardées, aucun fichier effacé)');
  r = await rattraperUnDossier('candidature', []);
  ok(r.corps.fait === B && r.corps.photos === 1 && !base.demandesGoogle.some((u) => u.includes('exemple.com')), 'serveur : dossier suivant ; une adresse qui n’est pas Drive n’est jamais suivie');
  r = await rattraperUnDossier('candidature', []);
  ok(r.corps.fini === true, 'serveur : plus rien à faire → « fini » (les dossiers déjà sur Cloudflare sont sautés)');

  remplir(); base.googleEnPanne.add('photoA2xxxxx');
  r = await rattraperUnDossier('candidature', []);
  ok(r.corps.echec === A && r2.effaces.length === 1 && !base.photos.some((x) => String(x.chemin).startsWith('r2:')), 'serveur : une photo refusée par Google → la copie déjà déposée est retirée, rien n’est noté (tout ou rien)');
  r = await rattraperUnDossier('candidature', [A]);
  ok(r.corps.fait === B, 'serveur : un dossier en échec est sauté quand la page le signale');
  const nom1 = r2.mis[r2.mis.length - 1];
  base.photos = base.photos.filter((x) => !String(x.chemin).startsWith('r2:'));
  r = await rattraperUnDossier('candidature', [A]);
  ok(r.corps.fait === B && r2.mis[r2.mis.length - 1] === nom1, 'serveur : relancer redonne le MÊME nom de fichier (jamais de doublon chez Cloudflare)');

  // (relecture) une copie déjà utilisée par un passage précédent n'est JAMAIS retirée par un passage qui échoue
  remplir(); await rattraperUnDossier('candidature', []);
  base.photos.forEach((x) => { if (x.application_id === A && !x.chemin) x.chemin = null; });
  const dejaA = base.photos.filter((x) => x.application_id === A && String(x.chemin).startsWith('r2:')).map((x) => x.chemin.slice(3));
  base.photos = base.photos.filter((x) => !(x.application_id === A && String(x.chemin).startsWith('r2:')));   // (le serveur croit A à faire…)
  base.photos.push({ application_id: A, url: 'r2:' + dejaA[0], chemin: 'r2:' + dejaA[0] });                 // (… mais une copie est citée)
  base.photos.push({ application_id: A, url: 'r2:x', chemin: null }); base.googleEnPanne.add('photoA2xxxxx'); r2.effaces.length = 0;
  base.photos = base.photos.filter((x) => x.url !== 'r2:x');
  const dejaR2 = base.photos.filter((x) => String(x.chemin).startsWith('r2:'));
  base.photos = base.photos.filter((x) => !String(x.chemin).startsWith('r2:'));
  const vraiFetch = global.fetch;
  global.fetch = async (url, o) => (decodeURIComponent(String(url)).includes('select=chemin&application_id=eq.') ? { ok: true, status: 200, json: async () => dejaR2 } : vraiFetch(url, o));
  r = await rattraperUnDossier('candidature', []);
  global.fetch = vraiFetch;
  ok(r.corps.echec === A && !r2.effaces.includes(dejaA[0]), 'serveur : en cas d’échec, une copie déjà citée par la base n’est jamais retirée');
  // (relecture) plus de 500 lignes Drive : la base est lue par pages, aucun dossier n'est oublié
  remplir();
  const anciens = 'dddddddd-4444-4444-8444-444444444444';
  base.photos = Array.from({ length: 520 }, (_, i) => ({ application_id: A, url: drive('photoA' + String(i).padStart(6, '0')), chemin: 'r2:candidatures/' + A + '/' + 'a'.repeat(32) + '.jpg' }))
    .concat([{ application_id: A, url: drive('photoA1xxxxx'), chemin: null }]).filter((x) => x.chemin === null);
  for (let i = 0; i < 520; i++) base.photos.push({ application_id: 'eeeeeeee-5555-4555-8555-' + String(i).padStart(12, '0'), url: drive('photoE' + String(i).padStart(6, '0')), chemin: null });
  base.photos.push({ application_id: anciens, url: drive('photoD1xxxxx'), chemin: null });
  base.photos.filter((x) => x.application_id.startsWith('eeeeeeee')).forEach((x) => base.photos.push({ application_id: x.application_id, url: 'r2:' + x.url, chemin: 'r2:' + x.url }));
  r = await rattraperUnDossier('candidature', ['aaaaaaaa-1111-4111-8111-111111111111']);
  ok(r.corps.fait === anciens, 'serveur : plus de 500 dossiers déjà faits → la page suivante est lue, l’ancien dossier est trouvé (' + JSON.stringify(r.corps).slice(0, 80) + ')');

  remplir();
  r = await rattraperUnDossier('cours_talons', []);
  ok(r.corps.fait === T && base.talons[0].photos.length === 2 && base.talons[0].photos.every((p) => /^r2:cours-talons\/cccccccc-3333-4333-8333-333333333333\/[0-9a-f]{32}\.jpg$/.test(p)),
    'serveur : cours de talons : les 2 liens Drive remplacés par leurs copies (même nombre, limite de 5 tenue)');
  r = await rattraperUnDossier('cours_talons', []);
  ok(r.corps.fini === true, 'serveur : cours de talons déjà rapatrié → sauté');
  remplir(); base.talonsModifiee = true;
  r = await rattraperUnDossier('cours_talons', []);
  ok(r.corps.echec === T && r2.effaces.length === 2 && base.talons[0].photos.every((p) => p.startsWith('https://drive')), 'serveur : inscription modifiée entre-temps → rien écrit, copies retirées');
  base.talonsModifiee = false;
  r = await rattraperUnDossier('autre', []);
  ok(r.statut === 400, 'serveur : source inconnue → refus');

  // 2. réservé à l'administratrice principale
  const presigner = require('../../api/r2-presigner.js');
  const appeler = async (corps) => {
    let statut = 0, rep = null;
    const res = { status(s) { statut = s; return this; }, json(c) { rep = c; return this; }, setHeader() {}, end() { return this; } };
    await presigner({ method: 'POST', headers: { authorization: 'Bearer x.' + Buffer.from(JSON.stringify({ sub: 'admin-1', aal: 'aal2' })).toString('base64url') + '.x', 'x-appareil': 'a' }, body: corps }, res);
    return { statut, rep };
  };
  remplir(); base.role = 'site';
  let a = await appeler({ action: 'rattrapage_drive', source: 'candidature', exclus: [] });
  ok(a.statut === 403 && !r2.mis.length, 'serveur : un administrateur du site (pas la principale) est refusé');
  base.role = 'principal';
  a = await appeler({ action: 'rattrapage_drive', source: 'candidature', exclus: [] });
  ok(a.statut === 200 && a.rep.fait === A, 'serveur : la principale lance le rattrapage (' + JSON.stringify(a.rep) + ')');
}

async function navigateur() {
  const PORT = String(9500 + Math.floor(Math.random() * 90)), URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran, role] of [['téléphone', { width: 390, height: 844 }, 'principal'], ['ordinateur', { width: 1366, height: 900 }, 'principal'], ['ordinateur (administrateur du site)', { width: 1366, height: 900 }, 'site']]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    await brancher(p, donnees(role), journal); await photosLocales(p);
    // le serveur simulé : 2 candidatures (une en échec), puis 1 cours de talons
    const reponses = { candidature: [{ fait: A, photos: 3, restants: 2 }, { echec: B, raison: 'Google répond 429', restants: 1 }, { fini: true }], cours_talons: [{ fait: T, photos: 2, restants: 1 }, { fini: true }] };
    const appels = [];
    await p.route('**/api/r2-presigner', async (route) => {
      const c = JSON.parse(route.request().postData() || '{}'); appels.push(c);
      if (c.action !== 'rattrapage_drive') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ adresses: {} }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reponses[c.source].shift() || { fini: true }) });
    });
    await seConnecter(p, URL_ADMIN); await p.waitForSelector(role === 'principal' ? '.accueil-tete' : '.coque:not(.sans-menu)');
    await p.goto(URL_ADMIN + '#/site/b3a-drive'); await p.waitForSelector('.cartes-pilotage'); await p.waitForTimeout(800);
    const bouton = await p.$('[data-action="rattrapage-lancer"]');
    if (role !== 'principal') {
      ok(!bouton, n + 'le bouton de rattrapage n’apparaît pas (réservé à la principale)');
    } else {
      ok(!!bouton && /Rien n’est supprimé/.test(await p.textContent('#rattrapage')), n + 'bouton « Rapatrier les anciennes photos » et explication (rien n’est supprimé)');
      await p.click('[data-action="rattrapage-lancer"]');
      await p.waitForFunction(() => /Terminé/.test((document.getElementById('rattrapage-msg') || {}).textContent || ''), null, { timeout: 20000 }).catch(() => {});
      const fin = await p.textContent('#rattrapage-msg');
      ok(/Terminé : 2 dossiers rapatriés \(5 photos\)/.test(fin) && /1 dossier est resté sur Drive/.test(fin), n + 'compte rendu juste : « ' + fin.trim() + ' »');
      const deuxieme = appels.filter((c) => c.action === 'rattrapage_drive' && c.source === 'candidature')[2];
      ok(deuxieme && JSON.stringify(deuxieme.exclus) === JSON.stringify([B]), n + 'le dossier en échec est signalé au serveur pour être sauté');
      ok(await p.isEnabled('[data-action="rattrapage-lancer"]') && await p.isHidden('[data-action="rattrapage-arreter"]'), n + 'à la fin : bouton de nouveau utilisable, « Arrêter » caché');
      ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), n + 'rien ne déborde sur le côté');
    }
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
}

(async () => {
  await serveur();
  await navigateur();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Rattrapage des anciennes photos Drive vers Cloudflare (L-18)');
  process.exit(ko ? 1 : 0);
})();
