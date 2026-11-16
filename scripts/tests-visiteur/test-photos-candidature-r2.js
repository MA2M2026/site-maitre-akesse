// Chantier L-17 (16/11/2026, demande de la propriétaire) : photos des candidatures d'abord chez Cloudflare R2, copie
// Drive ensuite. Base, Cloudflare et Google SIMULÉS (rien n'est écrit ni envoyé pour de vrai).
//  1. serveur (api/r2-presigner.js, actions « candidature_… ») : nom choisi par le serveur, refus (candidature inconnue,
//     ancienne, déjà traitée, 12 photos, mauvais format, trop lourde), faux fichier effacé, photo notée par le serveur,
//     lecture et suppression réservées à l'équipe ;
//  2. navigateur, candidature FR et EN (téléphone, ordinateur) : R2 d'abord puis Drive ; R2 en panne → Drive seul ;
//  3. Administration : photo R2 affichée par adresse signée, copies Drive masquées, ancienne candidature inchangée.
const Module = require('module'); const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const ID = '9b2f6c1e-1111-4a11-8a11-123456789abc';
const JETON_EQUIPE = 'x.' + Buffer.from(JSON.stringify({ sub: 'admin-1', aal: 'aal2' })).toString('base64url') + '.x';

// ---- Cloudflare R2 simulé (le vrai module n'est jamais appelé) ----
const r2 = { mis: [], effaces: [], octets: [0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
const chargerAvant = Module._load;
Module._load = function (demande, parent, estPrincipal) {
  if (demande === '@aws-sdk/client-s3') {
    class S3Client { async send(c) { if (c.type === 'Get') return { Body: { transformToByteArray: async () => Uint8Array.from(r2.octets) } }; if (c.type === 'Delete') r2.effaces.push(c.input.Key); return {}; } }
    const C = (type) => class { constructor(i) { this.input = i; this.type = type; } };
    return { S3Client, PutObjectCommand: C('Put'), GetObjectCommand: C('Get'), DeleteObjectCommand: C('Delete'), DeleteObjectsCommand: C('Deletes'), ListObjectsV2Command: C('List') };
  }
  if (demande === '@aws-sdk/s3-request-presigner') return { getSignedUrl: async (client, c) => { r2.mis.push(c.input); return 'https://r2.essai/' + c.type + '/' + c.input.Key + '?signature=x'; } };
  return chargerAvant.apply(this, arguments);
};

async function serveur() {
  Object.assign(process.env, { SUPABASE_SERVICE_ROLE_KEY: 'cle-essai', R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'b', R2_SECRET_ACCESS_KEY: 'c', R2_BUCKET_NAME: 'photos', R2_PUBLIC_URL: 'https://photos.test' });
  const base = { dossier: { id: ID, status: 'nouvelle', created_at: new Date().toISOString() }, photos: [], notes: [], admin: false };
  global.fetch = async (url, o = {}) => {
    const u = decodeURIComponent(String(url)), m = o.method || 'GET';
    const json = (x, s = 200) => ({ ok: s < 300, status: s, json: async () => x, text: async () => JSON.stringify(x) });
    if (u.includes('limiter_soumissions_publiques_ip')) return json(true);
    if (u.includes('/rest/v1/casting_applications?')) return json(base.dossier && u.includes(base.dossier.id) ? [base.dossier] : []);
    if (u.includes('/rest/v1/casting_photos?select=chemin')) return json(base.cites || []);
    if (u.includes('/rest/v1/casting_photos?select=id')) return json(base.photos);
    if (u.includes('/rest/v1/casting_photos') && m === 'POST') { base.notes.push(JSON.parse(o.body)); return json(null, 201); }
    if (u.includes('portail_admin_ok')) return json(base.admin === true);
    if (u.includes('/auth/v1/user')) return base.admin ? json({ id: 'admin-1', aal: 'aal2' }) : json({}, 401);
    if (u.includes('journal_erreurs')) return json(null, 201);
    return json(base.admin ? [{ user_id: 'admin-1' }] : []);
  };
  const r2presigner = require('../../api/r2-presigner.js');
  const appeler = async (corps, jeton) => {
    let statut = 0, rep = null;
    const res = { status(s) { statut = s; return this; }, json(c) { rep = c; return this; }, setHeader() {} };
    await r2presigner({ method: 'POST', headers: Object.assign({ 'x-forwarded-for': '41.2.3.4' }, jeton ? { authorization: 'Bearer ' + jeton } : {}), body: corps }, res);
    return { statut, rep };
  };
  let r = await appeler({ action: 'candidature_signer', candidature: ID, contentType: 'image/jpeg', taille: 300000 });
  const cle = r.rep && r.rep.chemin;
  ok(r.statut === 200 && /^candidatures\/9b2f6c1e-1111-4a11-8a11-123456789abc\/[0-9a-f]{32}\.jpg$/.test(cle || '') && /Put\/candidatures\//.test(r.rep.uploadUrl) && !('publicUrl' in r.rep),
    'serveur : adresse d’envoi signée ; nom choisi par le serveur dans candidatures/<id>/ ; aucune adresse publique');
  r = await appeler({ action: 'candidature_signer', candidature: ID, contentType: 'image/jpeg', taille: 300000, chemin: 'ABC/../../model/x.jpg' });
  ok(r.statut === 200 && r.rep.chemin.startsWith('candidatures/' + ID + '/'), 'serveur : un chemin envoyé par la page est ignoré');
  r = await appeler({ action: 'candidature_signer', candidature: 'pas-un-id', contentType: 'image/jpeg', taille: 1 });
  ok(r.statut === 400, 'serveur : identifiant invalide refusé');
  r = await appeler({ action: 'candidature_signer', candidature: '9b2f6c1e-2222-4a11-8a11-123456789abc', contentType: 'image/jpeg', taille: 1 });
  ok(r.statut === 403, 'serveur : candidature inconnue refusée');
  base.dossier.created_at = new Date(Date.now() - 3 * 3600e3).toISOString();
  r = await appeler({ action: 'candidature_signer', candidature: ID, contentType: 'image/jpeg', taille: 1 });
  ok(r.statut === 403, 'serveur : candidature de plus de 2 h refusée'); base.dossier.created_at = new Date().toISOString();
  base.dossier.status = 'vue'; r = await appeler({ action: 'candidature_signer', candidature: ID, contentType: 'image/jpeg', taille: 1 }); base.dossier.status = 'nouvelle';
  ok(r.statut === 403, 'serveur : candidature déjà traitée par l’agence refusée');
  base.photos = Array.from({ length: 12 }, (_, i) => ({ id: i })); r = await appeler({ action: 'candidature_signer', candidature: ID, contentType: 'image/jpeg', taille: 1 }); base.photos = [];
  ok(r.statut === 403 && /12/.test(r.rep.error), 'serveur : 12 photos déjà reçues : refusé');
  r = await appeler({ action: 'candidature_signer', candidature: ID, contentType: 'image/svg+xml', taille: 100 });
  ok(r.statut === 400, 'serveur : format non image (SVG) refusé');
  r = await appeler({ action: 'candidature_signer', candidature: ID, contentType: 'image/jpeg', taille: 16 * 1024 * 1024 });
  ok(r.statut === 400, 'serveur : photo de plus de 15 Mo refusée');
  r = await appeler({ action: 'candidature_verifier', candidature: ID, chemin: cle });
  ok(r.statut === 200 && base.notes.length === 1 && base.notes[0].application_id === ID && base.notes[0].chemin === 'r2:' + cle, 'serveur : vraie photo relue, puis notée dans la base PAR LE SERVEUR (r2:…)');
  r = await appeler({ action: 'candidature_verifier', candidature: ID, chemin: 'candidatures/' + ID + '/../autre.jpg' });
  ok(r.statut === 400 && base.notes.length === 1, 'serveur : vérifier un chemin fabriqué : refusé, rien de noté');
  r2.octets = Array.from(Buffer.from('<html><script>alert(1)</script>'));
  r = await appeler({ action: 'candidature_verifier', candidature: ID, chemin: cle });
  ok(r.statut === 422 && r2.effaces.includes(cle) && base.notes.length === 1, 'serveur : faux fichier (page web déguisée) : effacé du stockage, rien de noté');
  r2.octets = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0];
  r = await appeler({ action: 'candidature_lire', chemins: [cle] });
  ok(r.statut === 403, 'serveur : lire les photos sans compte de l’équipe : refusé');
  r = await appeler({ action: 'candidature_supprimer', chemin: cle });
  ok(r.statut === 403, 'serveur : supprimer sans compte de l’équipe : refusé');
  base.admin = true; base.cites = [{ chemin: 'r2:' + cle }]; r2.effaces.length = 0;
  r = await appeler({ action: 'candidature_lire', chemins: [cle, '../model/x.jpg'] }, JETON_EQUIPE);
  ok(r.statut === 200 && Object.keys(r.rep.adresses || {}).length === 1 && /Get\/candidatures\//.test(r.rep.adresses[cle]), 'serveur : équipe : adresse de lecture signée, chemin fabriqué ignoré');
  r = await appeler({ action: 'candidature_supprimer', chemin: cle }, JETON_EQUIPE);
  ok(r.statut === 409 && !r2.effaces.length, 'serveur : équipe : photo encore dans un dossier : rien n’est effacé');
  base.cites = [];
  r = await appeler({ action: 'candidature_supprimer', chemin: cle }, JETON_EQUIPE);
  ok(r.statut === 200 && r2.effaces.includes(cle), 'serveur : équipe : fiche déjà supprimée : le fichier est effacé');
}

async function navigateur() {
  const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
  const { brancher } = require('./faux-serveur'); const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
  const PORT = String(9200 + Math.floor(Math.random() * 60)), base = 'http://127.0.0.1:' + PORT;
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  process.on('exit', () => srv.kill());
  const PHOTO = fs.readFileSync(chemin.join(__dirname, 'medias', 'photo0.jpg')).toString('base64');
  const b = await chromium.launch();
  // 2. candidature : dossier gardé dans le téléphone (EnvoiFiable), l'envoi des photos repart à l'ouverture de la page
  for (const cas of [
    { nom: 'Intégrer l’agence, téléphone', page: '/integrer-agence.html', parcours: 'agence', ecran: { width: 390, height: 844 }, panne: false },
    { nom: 'Casting, ordinateur, anglais', page: '/en/candidature.html', parcours: 'projet', ecran: { width: 1280, height: 900 }, panne: false },
    { nom: 'Casting, téléphone, Cloudflare en panne', page: '/candidature.html', parcours: 'projet', ecran: { width: 390, height: 844 }, panne: true }]) {
    const tel = cas.ecran.width < 700, n = cas.nom + ' : ';
    const ctx = await b.newContext({ viewport: cas.ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [], r2Appels = [], ordre = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables: { casting_projets: [{ nom: 'Défilé X', actif: true }] }, rpc: { casting_ouvert: true, ajouter_video_candidature: true } }, journal);
    await p.route('**/api/r2-presigner', async (route) => {
      const c = JSON.parse(route.request().postData() || '{}'); r2Appels.push(c); ordre.push('r2');
      if (cas.panne) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"panne"}' });
      if (c.action === 'candidature_signer') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uploadUrl: 'https://r2.essai/envoi/' + r2Appels.length, chemin: 'candidatures/' + c.candidature + '/' + String(r2Appels.length).padStart(32, '0') + '.jpg' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"verifie":true}' });
    });
    const puts = [];
    await p.route('https://r2.essai/**', (route) => { puts.push(route.request().method()); return route.fulfill({ status: 200, body: '' }); });
    const drive = [];
    await p.route(/script\.google\.com/, async (route) => {
      const c = JSON.parse(route.request().postData() || '{}');
      if (c.photos) { drive.push(c.photos.length); ordre.push('drive'); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, liens: c.photos.map((x, i) => 'https://drive.google.com/thumbnail?id=p' + i), dossier: 'd', enregistre: true }) }); }
      const rep = c.action === 'video_debut' ? { ok: true, session: 's1', dossier: 'd' } : c.action === 'video_morceau' ? { ok: true, video: 'https://drive.google.com/file/d/v1/view', enregistre: true } : { ok: true, recu: 0 };
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rep) });
    });
    await p.goto(base + '/index.html'); await p.waitForTimeout(600);
    await p.evaluate(async ({ photo, id, page, parcours }) => {
      const octets = Uint8Array.from(atob(photo), (c) => c.charCodeAt(0));
      const f = new File([octets], 'photo.jpg', { type: 'image/jpeg' }), v = new File([new Uint8Array(200000)], 'video.mp4', { type: 'video/mp4' });
      await EnvoiFiable.garder('candidature', { candidature: { id, full_name: 'Awa Koné', email: 'awa@test.ci', phone: '+2250700000001', experience_mannequin: 'non' },
        projetNom: parcours === 'projet' ? 'Défilé X' : '', mineur: false, parcours, photos: [f, f, f], video: v, page, photosFaites: false });
    }, { photo: PHOTO, id: ID, page: cas.page, parcours: cas.parcours });
    await p.goto(base + cas.page);
    await p.waitForFunction(() => /Merci|Thank you|mais|but|repartira|resume/.test((document.getElementById('ca-msg') || {}).textContent || '') && document.querySelectorAll('#ca-jauges-photos .jauge').length === 3
      && ![...document.querySelectorAll('#ca-jauges-photos .jauge')].some((j) => /envoi|sending/.test(j.textContent)), null, { timeout: 40000 }).catch(() => {});
    await p.waitForTimeout(800);
    const signes = r2Appels.filter((c) => c.action === 'candidature_signer'), verifies = r2Appels.filter((c) => c.action === 'candidature_verifier');
    const vertes = await p.locator('#ca-jauges-photos .jauge.terminee').count();
    const msg = await p.evaluate(() => (document.getElementById('ca-msg') || {}).textContent || '');
    if (!cas.panne) {
      ok(signes.length === 3 && verifies.length === 3 && puts.filter((x) => x === 'PUT').length === 3 && signes.every((c) => c.candidature === ID && !c.chemin),
        n + '3 photos envoyées chez Cloudflare (adresse signée, envoi, vérification), nom choisi par le serveur');
      ok(ordre.indexOf('r2') === 0 && ordre.indexOf('drive') > ordre.lastIndexOf('r2') && drive.length >= 1, n + 'Cloudflare d’abord, PUIS la copie Drive (archive)');
      ok(vertes === 3 && !/manqu|missing|non envoy|not sent/i.test(msg), n + 'jauges vertes, aucune photo annoncée comme manquante');
    } else {
      ok(signes.length >= 1 && !verifies.length && !puts.length, n + 'Cloudflare refuse : rien n’est envoyé chez Cloudflare');
      ok(drive.length >= 1 && vertes === 3, n + 'les photos partent quand même dans Drive, comme avant, jauges vertes');
    }
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  // 3. Administration : photo R2 affichée (adresse signée), copie Drive masquée ; ancienne candidature (Drive seul) inchangée
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = 'Administration (' + nom + ') : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [], d = donnees('principal'), lus = [], supprimes = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const CR2 = 'candidatures/' + ID + '/' + 'b'.repeat(32) + '.jpg';
    d.tables.casting_photos.push({ id: 'ph-r2', application_id: 'c4', chemin: 'r2:' + CR2, url: null });
    await brancher(p, d, journal); await photosLocales(p);
    await p.route('**/api/r2-presigner', async (route) => {
      const c = JSON.parse(route.request().postData() || '{}');
      if (c.action === 'candidature_lire') { lus.push(...c.chemins); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ adresses: Object.fromEntries(c.chemins.map((x) => [x, 'https://photos.maitreakessemodelmanagement.com/m0/' + x + '?signature=x'])) }) }); }
      if (c.action === 'candidature_supprimer') { supprimes.push(c.chemin || c.chemins); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
      return route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
    });
    await seConnecter(p, base + '/admin/'); await p.waitForSelector('.accueil-tete');
    await p.goto(base + '/admin/#/site/b2-candidatures/c4'); await p.waitForSelector('.galerie-dossier .photo-dossier', { timeout: 15000 }).catch(() => {});
    const vu = await p.evaluate(() => [...document.querySelectorAll('.galerie-dossier .photo-dossier img')].map((i) => i.getAttribute('src') || ''));
    ok(lus.includes(CR2) && vu.length === 1 && /signature=x/.test(vu[0]), n + 'candidature avec photo Cloudflare : affichée par adresse signée, copies Drive masquées (' + JSON.stringify(vu) + ')');
    await p.goto(base + '/admin/#/site/b2-candidatures/c1'); await p.waitForTimeout(300); await p.waitForSelector('.galerie-dossier .photo-dossier', { timeout: 15000 }).catch(() => {});
    const ancien = await p.evaluate(() => [...document.querySelectorAll('.galerie-dossier .photo-dossier img')].map((i) => i.getAttribute('src') || ''));
    ok(ancien.length === 1 && /drive\.google\.com/.test(ancien[0]), n + 'ancienne candidature (Drive seul) : affichage inchangé');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
}

(async () => {
  await serveur();
  Module._load = chargerAvant;
  if (!process.env.SERVEUR_SEUL) await navigateur();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Photos des candidatures par Cloudflare (L-17)');
  process.exit(ko ? 1 : 0);
})();
