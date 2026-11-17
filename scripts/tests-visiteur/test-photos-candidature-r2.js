// Chantier L-17 (16/11/2026, demande de la propriétaire) : photos des candidatures d'abord chez Cloudflare R2, copie
// Drive ensuite. Base, Cloudflare et Google SIMULÉS (rien n'est écrit ni envoyé pour de vrai).
//  1. serveur (api/r2-presigner.js, actions « candidature_… ») : nom choisi par le serveur, refus (candidature inconnue,
//     ancienne, déjà traitée, 12 photos, mauvais format, trop lourde), faux fichier effacé, photo notée par le serveur,
//     lecture et suppression réservées à l'équipe ;
//  2. navigateur, candidature FR et EN (téléphone, ordinateur) : R2 d'abord puis Drive ; R2 en panne → Drive seul ;
//  3. Administration : photo R2 affichée par adresse signée ; copies Drive cachées seulement si le dossier a au moins
//     autant de photos Cloudflare (règle du superviseur, 17/11) ; rien n'est jamais supprimé ; ancienne candidature inchangée.
const Module = require('module'); const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const ID = '9b2f6c1e-1111-4a11-8a11-123456789abc';
const JETON_EQUIPE = 'x.' + Buffer.from(JSON.stringify({ sub: 'admin-1', aal: 'aal2' })).toString('base64url') + '.x';

// ---- Cloudflare R2 simulé (le vrai module n'est jamais appelé) ----
const r2 = { mis: [], effaces: [], liste: [], octets: [0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
const chargerAvant = Module._load;
Module._load = function (demande, parent, estPrincipal) {
  if (demande === '@aws-sdk/client-s3') {
    class S3Client { async send(c) { if (c.type === 'Get') { if (r2.absent) { const e = new Error('absent'); e.name = 'NoSuchKey'; throw e; } return { Body: { transformToByteArray: async () => Uint8Array.from(r2.octets) } }; } if (c.type === 'Delete') r2.effaces.push(c.input.Key); if (c.type === 'Deletes') { r2.lots = (r2.lots || 0) + 1; c.input.Delete.Objects.forEach((o) => r2.effaces.push(o.Key)); } if (c.type === 'List') return { Contents: r2.liste.map((o) => (typeof o === 'string' ? { Key: c.input.Prefix + o, LastModified: new Date() } : o)).filter((o) => o.Key.startsWith(c.input.Prefix)) }; return {}; } }
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
    if (base.nettoyagePanne && /application_id=in|cours_talons\?select=photos/.test(u)) return json({}, 500);
    if (u.includes('casting_photos?select=chemin&application_id=in')) return json((base.citesNettoyage || {}).candidatures || []);
    if (u.includes('cours_talons?select=photos&id=in')) return json((base.citesNettoyage || {}).talons || []);
    if (u.includes('/rest/v1/casting_photos?select=chemin')) return json(base.cites || []);
    if (u.includes('/rest/v1/cours_talons?')) return json(base.talonsInscrite ? [{ id: ID }] : []);
    // casting_photos simulée sur base.notes : lecture, effacement, modification selon les filtres eq. / is.null
    if (/\/rest\/v1\/casting_photos\?/.test(u) && m !== 'POST') {
      const q = new URL(String(url)).searchParams, vrai = (l) => [...q].every(([k, v]) => k === 'select' || (v === 'is.null' ? l[k] == null : v.startsWith('eq.') ? String(l[k]) === v.slice(3) : true));
      if (m === 'GET') return json(base.notes.filter(vrai).map((l, i) => ({ id: i, ...l })));
      if (m === 'DELETE') { base.effacees = (base.effacees || []).concat(base.notes.filter(vrai)); base.notes = base.notes.filter((l) => !vrai(l)); return json(null, 204); }
      if (m === 'PATCH') { const maj = JSON.parse(o.body); base.notes.filter(vrai).forEach((l) => Object.assign(l, maj)); return json(null, 204); }
    }
    if (u.includes('/rest/v1/medias_drive?')) return json(base.mediasDrive || []);
    if (u.includes('rpc/medias_drive_appliquer')) { base.appliquer = (base.appliquer || 0) + 1; return json(0); }
    // (comme la vraie base : « url » obligatoire, et une même photo une seule fois : index casting_photos_une_fois)
    if (u.includes('/rest/v1/casting_photos') && m === 'POST') {
      const l = JSON.parse(o.body);
      if (!l.url) return json({ code: '23502', message: 'null value in column "url" violates not-null constraint' }, 400);
      if (base.notes.some((x) => x.application_id === l.application_id && x.url === l.url)) return json({ code: '23505' }, 409);
      base.notes.push(l); return json(null, 201);
    }
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
  r2.liste = Array.from({ length: 12 }, (_, i) => 'f' + i + '.jpg'); r = await appeler({ action: 'candidature_signer', candidature: ID, contentType: 'image/jpeg', taille: 1 }); r2.liste = [];
  ok(r.statut === 403 && /12/.test(r.rep.error), 'serveur : 12 fichiers DÉJÀ DÉPOSÉS (vérifiés ou non) : refusé (relecture de D)');
  r = await appeler({ action: 'candidature_signer', candidature: ID, contentType: 'image/svg+xml', taille: 100 });
  ok(r.statut === 400, 'serveur : format non image (SVG) refusé');
  r = await appeler({ action: 'candidature_signer', candidature: ID, contentType: 'image/jpeg', taille: 16 * 1024 * 1024 });
  ok(r.statut === 400, 'serveur : photo de plus de 15 Mo refusée');
  r = await appeler({ action: 'candidature_verifier', candidature: ID, chemin: cle });
  ok(r.statut === 200 && base.notes.length === 1 && base.notes[0].application_id === ID && base.notes[0].chemin === 'r2:' + cle, 'serveur : vraie photo relue, puis notée dans la base PAR LE SERVEUR (r2:…)');
  r = await appeler({ action: 'candidature_verifier', candidature: ID, chemin: 'candidatures/' + ID + '/../autre.jpg' });
  ok(r.statut === 400 && base.notes.length === 1, 'serveur : vérifier un chemin fabriqué : refusé, rien de noté');
  r2.absent = true; r = await appeler({ action: 'candidature_verifier', candidature: ID, chemin: 'candidatures/' + ID + '/' + 'd'.repeat(32) + '.jpg' }); r2.absent = false;
  ok(r.statut === 404 && base.notes.length === 1, 'serveur : fichier jamais déposé : refusé (404), rien de noté (relecture de D)');
  r2.octets = Array.from(Buffer.from('<html><script>alert(1)</script>'));
  r = await appeler({ action: 'candidature_verifier', candidature: ID, chemin: cle });
  ok(r.statut === 422 && r2.effaces.includes(cle) && base.notes.length === 1, 'serveur : faux fichier (page web déguisée) : effacé du stockage, rien de noté');
  r2.octets = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0];
  r = await appeler({ action: 'candidature_lire', chemins: [cle] });
  ok(r.statut === 403, 'serveur : lire les photos sans compte de l’équipe : refusé');
  r = await appeler({ action: 'candidature_supprimer', chemin: cle });
  ok(r.statut === 403, 'serveur : supprimer sans compte de l’équipe : refusé');
  // ---- cours de talons (dossier « cours-talons ») : inscription pas encore enregistrée, 5 photos au plus
  const nbNotes = base.notes.length;
  r = await appeler({ action: 'candidature_signer', dossier: 'cours-talons', candidature: ID, contentType: 'image/webp', taille: 200000 });
  const cleT = r.rep && r.rep.chemin;
  ok(r.statut === 200 && /^cours-talons\/9b2f6c1e-1111-4a11-8a11-123456789abc\/[0-9a-f]{32}\.webp$/.test(cleT || ''), 'serveur, cours de talons : nom choisi par le serveur dans cours-talons/<numéro>/');
  r = await appeler({ action: 'candidature_verifier', dossier: 'cours-talons', candidature: ID, chemin: cleT });
  ok(r.statut === 200 && base.notes.length === nbNotes, 'serveur, cours de talons : photo relue, rien noté par le serveur (la page la met dans l’inscription)');
  r = await appeler({ action: 'candidature_verifier', dossier: 'cours-talons', candidature: ID, chemin: cle });
  ok(r.statut === 400, 'serveur, cours de talons : une photo de candidature présentée comme photo de talons : refusée');
  r2.liste = ['a', 'b', 'c', 'd', 'e']; r = await appeler({ action: 'candidature_signer', dossier: 'cours-talons', candidature: ID, contentType: 'image/jpeg', taille: 1 }); r2.liste = [];
  ok(r.statut === 403 && /5/.test(r.rep.error), 'serveur, cours de talons : 5 photos déjà reçues : refusé');
  base.talonsInscrite = true; r = await appeler({ action: 'candidature_signer', dossier: 'cours-talons', candidature: ID, contentType: 'image/jpeg', taille: 1 }); base.talonsInscrite = false;
  ok(r.statut === 403, 'serveur, cours de talons : inscription déjà enregistrée : plus de photo');
  r = await appeler({ action: 'candidature_signer', dossier: '__proto__', candidature: ID, contentType: 'image/jpeg', taille: 1 });
  const r2b = await appeler({ action: 'candidature_signer', dossier: 'model', candidature: ID, contentType: 'image/jpeg', taille: 1 });
  ok(r.statut === 400 && r2b.statut === 400, 'serveur : dossier inconnu (« __proto__ », « model ») : refusé');
  base.admin = true; base.cites = [{ chemin: 'r2:' + cle }]; r2.effaces.length = 0;
  r = await appeler({ action: 'candidature_lire', chemins: [cle, '../model/x.jpg'] }, JETON_EQUIPE);
  ok(r.statut === 200 && Object.keys(r.rep.adresses || {}).length === 1 && /Get\/candidatures\//.test(r.rep.adresses[cle]), 'serveur : équipe : adresse de lecture signée, chemin fabriqué ignoré');
  r = await appeler({ action: 'candidature_supprimer', chemin: cle }, JETON_EQUIPE);
  ok(r.statut === 409 && !r2.effaces.length, 'serveur : équipe : photo encore dans un dossier : rien n’est effacé');
  r = await appeler({ action: 'candidature_lire', chemins: [cleT] }, JETON_EQUIPE);
  ok(r.statut === 200 && r.rep.adresses && r.rep.adresses[cleT], 'serveur : équipe : photo d’un cours de talons lisible (adresse signée)');
  base.cites = [];
  // (L-18 c) photo d'un cours de talons : effacée seulement quand l'inscription n'existe plus
  base.talonsInscrite = true; r = await appeler({ action: 'candidature_supprimer', chemin: cleT }, JETON_EQUIPE); base.talonsInscrite = false;
  ok(r.statut === 409 && !r2.effaces.includes(cleT), 'serveur : photo d’un cours de talons dont l’inscription existe encore : rien n’est effacé');
  r = await appeler({ action: 'candidature_supprimer', chemin: cleT }, JETON_EQUIPE);
  ok(r.statut === 200 && r2.effaces.includes(cleT), 'serveur : inscription au cours de talons supprimée : sa photo est effacée');
  r = await appeler({ action: 'candidature_supprimer', chemin: cle }, JETON_EQUIPE);
  ok(r.statut === 200 && r2.effaces.includes(cle), 'serveur : équipe : fiche déjà supprimée : le fichier est effacé');
  // ---- (relecture du superviseur, 16/11 22 h 30) ----
  base.admin = false;
  // 1. la ligne notée a une « url » (obligatoire dans la base) : la même « r2:… » que le chemin
  ok(base.notes.length >= 1 && base.notes.every((x) => x.url && x.url === x.chemin && /^r2:candidatures\//.test(x.url)), 'superviseur 1 : la photo notée a une url (obligatoire dans la base), « r2:… » comme son chemin');
  // même photo vérifiée deux fois (reprise après coupure) : déjà notée, pas d'erreur
  r = await appeler({ action: 'candidature_verifier', candidature: ID, chemin: base.notes[0].chemin.slice(3) });
  ok(r.statut === 200 && base.notes.length === 1, 'superviseur 1 : même photo vérifiée deux fois : acceptée, notée une seule fois');
  // 2. la DERNIÈRE photo permise (12ᵉ candidature, 5ᵉ talons) : déjà déposée, la vérification l'accepte
  const cle12 = 'candidatures/' + ID + '/' + 'e'.repeat(32) + '.jpg';
  r2.liste = Array.from({ length: 12 }, (_, i) => 'f' + i + '.jpg');
  r = await appeler({ action: 'candidature_verifier', candidature: ID, chemin: cle12 });
  ok(r.statut === 200 && base.notes.some((x) => x.chemin === 'r2:' + cle12), 'superviseur 2 : 12ᵉ photo d’une candidature (12 fichiers déposés) : vérifiée et notée');
  r2.liste = ['a', 'b', 'c', 'd', 'e'];
  r = await appeler({ action: 'candidature_verifier', dossier: 'cours-talons', candidature: ID, chemin: 'cours-talons/' + ID + '/' + 'e'.repeat(32) + '.jpg' });
  ok(r.statut === 200, 'superviseur 2 : 5ᵉ photo d’un cours de talons (5 fichiers déposés) : vérifiée');
  r = await appeler({ action: 'candidature_signer', dossier: 'cours-talons', candidature: ID, contentType: 'image/jpeg', taille: 1 });
  ok(r.statut === 403, 'superviseur 2 : une 6ᵉ photo de talons ne peut toujours pas être déposée'); r2.liste = [];
  // 5. numéro EN MAJUSCULES : même dossier (minuscules), jamais un second dossier hors plafond et hors nettoyage
  const MAJ = ID.toUpperCase();
  r = await appeler({ action: 'candidature_signer', dossier: 'cours-talons', candidature: MAJ, contentType: 'image/jpeg', taille: 1 });
  ok(r.statut === 200 && r.rep.chemin.startsWith('cours-talons/' + ID + '/'), 'superviseur 5 : numéro en majuscules : rangé sous le numéro en minuscules (' + (r.rep && r.rep.chemin) + ')');
  r2.liste = ['a', 'b', 'c', 'd', 'e'];
  r = await appeler({ action: 'candidature_signer', dossier: 'cours-talons', candidature: MAJ, contentType: 'image/jpeg', taille: 1 }); r2.liste = [];
  ok(r.statut === 403, 'superviseur 5 : numéro en majuscules : le plafond de 5 photos compte bien le même dossier');
  const nbAvant = base.notes.length, cleMaj = 'candidatures/' + ID + '/' + 'a'.repeat(32) + '.jpg';
  r = await appeler({ action: 'candidature_verifier', candidature: MAJ, chemin: cleMaj });
  ok(r.statut === 200 && base.notes.length === nbAvant + 1 && base.notes[nbAvant].application_id === ID, 'superviseur 5 : vérification avec le numéro en majuscules : notée sous le numéro en minuscules');
  r = await appeler({ action: 'candidature_verifier', candidature: ID, chemin: 'candidatures/' + MAJ + '/' + 'a'.repeat(32) + '.jpg' });
  ok(r.statut === 400, 'superviseur 5 : un chemin « en majuscules » est refusé');
  // (superviseur, 17/11) l'action qui reliait les copies par rang est retirée : refusée comme inconnue
  r = await appeler({ action: 'candidature_copies', candidature: ID, copies: [] });
  ok(r.statut === 400, 'superviseur : plus aucune liaison par rang (action retirée)');
  // ---- nettoyage du matin (api/_r2.js) : seulement candidatures/ et cours-talons/, jamais un fichier cité
  const { nettoyerPhotosNonCitees } = require('../../api/_r2.js');
  const ilYa = (h) => new Date(Date.now() - h * 3600e3), A2 = 'aaaaaaaa-1111-4a11-8a11-123456789abc', T2 = 'bbbbbbbb-1111-4a11-8a11-123456789abc';
  const k = (d, id, c) => d + '/' + id + '/' + c.repeat(32) + '.jpg';
  r2.liste = [
    { Key: k('candidatures', A2, '1'), LastModified: ilYa(3) },    // vieux, non cité → effacé
    { Key: k('candidatures', A2, '2'), LastModified: ilYa(3) },    // vieux, cité → gardé
    { Key: k('candidatures', A2, '3'), LastModified: ilYa(1) },    // récent → gardé
    { Key: k('cours-talons', T2, '4'), LastModified: ilYa(24 * 8) }, // talons de plus de 7 jours, non cité → effacé
    { Key: k('cours-talons', T2, '5'), LastModified: ilYa(24 * 8) }, // cité par l'inscription → gardé
    { Key: k('cours-talons', T2, '6'), LastModified: ilYa(24 * 3) }, // 3 jours (reprise possible) → gardé
    { Key: 'candidatures/' + A2 + '/photo-mannequin.jpg', LastModified: ilYa(30) }];  // nom hors format → jamais touché
  base.citesNettoyage = { candidatures: [{ chemin: 'r2:' + k('candidatures', A2, '2') }], talons: [{ photos: ['r2:' + k('cours-talons', T2, '5'), 'https://drive.test/x'] }] };
  r2.effaces.length = 0; r2.lots = 0;
  const nbEffaces = await nettoyerPhotosNonCitees();
  ok(nbEffaces === 2 && r2.effaces.length === 2 && r2.effaces.includes(k('candidatures', A2, '1')) && r2.effaces.includes(k('cours-talons', T2, '4')),
    'nettoyage du matin : seuls les fichiers non cités et anciens sont effacés (candidature > 2 h, talons > 7 jours) (' + r2.effaces.join(', ') + ')');
  ok(r2.lots === 2, 'superviseur 7 : nettoyage par lots (une demande d’effacement par dossier, pas une par fichier : ' + r2.lots + ')');
  base.nettoyagePanne = true; r2.effaces.length = 0;
  const panne = await nettoyerPhotosNonCitees().then(() => 'effectué', () => 'refusé');
  ok(panne === 'refusé' && !r2.effaces.length, 'nettoyage du matin : base illisible → rien n’est effacé');
  base.nettoyagePanne = false; r2.liste = [];
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
    { nom: 'Casting, téléphone, Cloudflare en panne', page: '/candidature.html', parcours: 'projet', ecran: { width: 390, height: 844 }, panne: true },
    // (superviseur 4) envoi coupé après la 1re photo arrivée chez Cloudflare : la reprise ne la renvoie pas
    // (2ᵉ relecture) réponse de la 1re vérification perdue : la même photo est revérifiée, jamais déposée deux fois
    { nom: 'Vérification sans réponse, téléphone', page: '/integrer-agence.html', parcours: 'agence', ecran: { width: 390, height: 844 }, panne: false, verifPerdue: true },
    { nom: 'Reprise après coupure, téléphone', page: '/integrer-agence.html', parcours: 'agence', ecran: { width: 390, height: 844 }, panne: false, reprise: true },
    // (superviseur 6) ancien programme Google (la page note elle-même les liens Drive) : 2 photos sur 3 chez Cloudflare →
    // la page note TOUS les liens Drive (l'Administration décide de l'affichage) ; si TOUTES sont chez Cloudflare, aucun
    { nom: 'Ancien programme Google, tout chez Cloudflare, téléphone', page: '/candidature.html', parcours: 'projet', ecran: { width: 390, height: 844 }, panne: false, ancien: true },
    { nom: 'Ancien programme Google, ordinateur', page: '/candidature.html', parcours: 'projet', ecran: { width: 1280, height: 900 }, panne: false, ancien: true, r2Max: 2 }]) {
    const tel = cas.ecran.width < 700, n = cas.nom + ' : ';
    const ctx = await b.newContext({ viewport: cas.ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [], r2Appels = [], ordre = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables: { casting_projets: [{ nom: 'Défilé X', actif: true }] }, rpc: { casting_ouvert: true, ajouter_video_candidature: true } }, journal);
    await p.route('**/api/r2-presigner', async (route) => {
      const c = JSON.parse(route.request().postData() || '{}'); r2Appels.push(c); ordre.push('r2');
      if (cas.panne) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"panne"}' });
      if (cas.r2Max != null && c.action === 'candidature_signer' && r2Appels.filter((x) => x.action === 'candidature_signer').length > cas.r2Max) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"plein"}' });
      if (cas.verifPerdue && c.action === 'candidature_verifier' && r2Appels.filter((x) => x.action === 'candidature_verifier').length === 1) return route.abort('connectionreset');
      if (c.action === 'candidature_signer') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uploadUrl: 'https://r2.essai/envoi/' + r2Appels.length, chemin: 'candidatures/' + c.candidature + '/' + String(r2Appels.length).padStart(32, '0') + '.jpg' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"verifie":true}' });
    });
    const puts = [];
    await p.route('https://r2.essai/**', (route) => { puts.push(route.request().method()); return route.fulfill({ status: 200, body: '' }); });
    const drive = [];
    await p.route(/script\.google\.com/, async (route) => {
      const c = JSON.parse(route.request().postData() || '{}');
      if (c.photos) { drive.push(c.photos.length); ordre.push('drive'); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, liens: c.photos.map((x, i) => 'https://drive.google.com/thumbnail?id=p' + i), dossier: 'd', enregistre: !cas.ancien }) }); }
      const rep = c.action === 'video_debut' ? { ok: true, session: 's1', dossier: 'd' } : c.action === 'video_morceau' ? { ok: true, video: 'https://drive.google.com/file/d/v1/view', enregistre: true } : { ok: true, recu: 0 };
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rep) });
    });
    await p.goto(base + '/index.html'); await p.waitForTimeout(600);
    await p.evaluate(async ({ photo, id, page, parcours, reprise }) => {
      const octets = Uint8Array.from(atob(photo), (c) => c.charCodeAt(0));
      const f = new File([octets], 'photo.jpg', { type: 'image/jpeg' }), v = new File([new Uint8Array(200000)], 'video.mp4', { type: 'video/mp4' });
      await EnvoiFiable.garder('candidature', Object.assign({ candidature: { id, full_name: 'Awa Koné', email: 'awa@test.ci', phone: '+2250700000001', experience_mannequin: 'non' },
        projetNom: parcours === 'projet' ? 'Défilé X' : '', mineur: false, parcours, photos: [f, f, f], video: v, page, photosFaites: false },
        reprise ? { arriveesR2: [0], cheminsR2: ['r2:candidatures/' + id + '/' + 'f'.repeat(32) + '.jpg'] } : {}));
    }, { photo: PHOTO, id: ID, page: cas.page, parcours: cas.parcours, reprise: !!cas.reprise });
    await p.goto(base + cas.page);
    await p.waitForFunction(() => /Merci|Thank you|mais|but|repartira|resume/.test((document.getElementById('ca-msg') || {}).textContent || '') && document.querySelectorAll('#ca-jauges-photos .jauge').length === 3
      && ![...document.querySelectorAll('#ca-jauges-photos .jauge')].some((j) => /envoi|sending/.test(j.textContent)), null, { timeout: 40000 }).catch(() => {});
    await p.waitForTimeout(800);
    const signes = r2Appels.filter((c) => c.action === 'candidature_signer'), verifies = r2Appels.filter((c) => c.action === 'candidature_verifier');
    const vertes = await p.locator('#ca-jauges-photos .jauge.terminee').count();
    const msg = await p.evaluate(() => (document.getElementById('ca-msg') || {}).textContent || '');
    const notees = journal.filter((j) => j[0] === 'POST' && j[1] === 'casting_photos');
    if (cas.verifPerdue) {
      ok(signes.length === 3 && puts.length === 3 && verifies.length === 4 && verifies[0].chemin === verifies[1].chemin, n + '2ᵉ relecture : la photo est revérifiée (même nom), jamais déposée deux fois (3 dépôts, 4 vérifications)');
      ok(vertes === 3 && !/manqu|missing|non envoy|not sent/i.test(msg), n + 'jauges vertes, aucune photo annoncée comme manquante');
    } else if (cas.reprise) {
      ok(signes.length === 2 && verifies.length === 2 && puts.length === 2, n + 'superviseur 4 : la photo déjà arrivée n’est pas renvoyée (2 envois sur 3)');
      ok(vertes === 3 && !/manqu|missing|non envoy|not sent/i.test(msg), n + 'jauges vertes, aucune photo annoncée comme manquante');
    } else if (cas.ancien) {
      if (cas.r2Max) ok(verifies.length === 2 && notees.length === 3, n + 'superviseur 6 : 2 photos sur 3 chez Cloudflare : la page note les 3 liens Drive (' + notees.length + ')');
      else ok(verifies.length === 3 && notees.length === 0, n + 'superviseur 6 : toutes chez Cloudflare : la page ne note aucun lien Drive (' + notees.length + ')');
      ok(vertes === 3 && !/manqu|missing|non envoy|not sent/i.test(msg) && !journal.some((j) => j[1] === 'journal_erreurs' && /casting_photos/.test(j[3] || '')), n + 'aucune fausse « photo manquante », journal propre');
    } else if (!cas.panne) {
      ok(signes.length === 3 && verifies.length === 3 && puts.filter((x) => x === 'PUT').length === 3 && signes.every((c) => c.candidature === ID && !c.chemin),
        n + '3 photos envoyées chez Cloudflare (adresse signée, envoi, vérification), nom choisi par le serveur');
      ok(ordre.indexOf('r2') === 0 && ordre.indexOf('drive') > ordre.lastIndexOf('r2') && drive.length >= 1, n + 'Cloudflare d’abord, PUIS la copie Drive (archive)');
      ok(vertes === 3 && !/manqu|missing|non envoy|not sent/i.test(msg), n + 'jauges vertes, aucune photo annoncée comme manquante');
      ok(!r2Appels.some((c) => c.action === 'candidature_copies'), n + 'superviseur : aucune liaison par rang demandée');
    } else {
      ok(signes.length >= 1 && !verifies.length && !puts.length, n + 'Cloudflare refuse : rien n’est envoyé chez Cloudflare');
      ok(drive.length >= 1 && vertes === 3, n + 'les photos partent quand même dans Drive, comme avant, jauges vertes');
    }
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  // 2 bis. cours de talons : Cloudflare d'abord, Drive ensuite ; l'inscription porte les photos Cloudflare ;
  //        base pas encore prête (fichier SQL L-17 pas collé) → l'inscription repart avec les liens Drive
  for (const cas of [{ nom: 'Cours de talons, téléphone', baseRefuse: false }, { nom: 'Cours de talons, ordinateur, base pas encore prête', baseRefuse: true, ecran: { width: 1280, height: 900 } },
    // (superviseur 3) une seule des 2 photos arrive chez Cloudflare : l'inscription prend les liens Drive (roue de secours)
    { nom: 'Cours de talons, téléphone, 1 photo sur 2 chez Cloudflare', r2Max: 1 }]) {
    const ecran = cas.ecran || { width: 390, height: 844 }, tel = ecran.width < 700, n = cas.nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [], r2Appels = [], ordre = [], essais = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const ID_T = '66666666-7777-8888-9999-000000000017';
    await brancher(p, { tables: {}, rpc: {}, formulaire: (c) => {
      if (c.table !== 'cours_talons') return null;
      essais.push(c.ligne.photos);
      return cas.baseRefuse && c.ligne.photos.some((x) => String(x).startsWith('r2:')) ? { statut: 400, error: 'Formulaire invalide.' } : null;
    } }, journal);
    await p.route('**/api/r2-presigner', async (route) => {
      const c = JSON.parse(route.request().postData() || '{}'); r2Appels.push(c); ordre.push('r2');
      if (cas.r2Max != null && c.action === 'candidature_signer' && r2Appels.filter((x) => x.action === 'candidature_signer').length > cas.r2Max) return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"plein"}' });
      if (c.action === 'candidature_signer') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uploadUrl: 'https://r2.essai/envoi/' + r2Appels.length, chemin: 'cours-talons/' + c.candidature + '/' + String(r2Appels.length).padStart(32, '0') + '.jpg' }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"verifie":true}' });
    });
    await p.route('https://r2.essai/**', (route) => route.fulfill({ status: 200, body: '' }));
    await p.route(/script\.google\.com/, async (route) => {
      const c = JSON.parse(route.request().postData() || '{}');
      if (c.photos) { ordre.push('drive'); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, liens: c.photos.map((x, i) => 'https://drive.google.com/thumbnail?id=t' + i), dossier: 'd2' }) }); }
      const rep = c.action === 'video_debut' ? { ok: true, session: 's1', dossier: 'd2' } : c.action === 'video_morceau' ? { ok: true, video: 'https://drive.google.com/file/d/v2/view' } : { ok: true, recu: 0 };
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rep) });
    });
    await p.goto(base + '/index.html'); await p.waitForTimeout(600);
    await p.evaluate(async ({ photo, id }) => {
      const octets = Uint8Array.from(atob(photo), (c) => c.charCodeAt(0));
      const f = new File([octets], 'photo.jpg', { type: 'image/jpeg' }), v = new File([new Uint8Array(200000)], 'marche.mp4', { type: 'video/mp4' });
      await EnvoiFiable.garder('cours-talons', { ligne: { id, formule: 'groupe', nb_seances: 4, nom: 'Aya Test', telephone: '+2250700000002', age: 22, decision: 'plus_tard' },
        montant: '30 000 FCFA', photos: [f, f], video: v, d: { liens: [], rangs: [], dossier: null, video: null }, page: '/cours-talons.html' });
    }, { photo: PHOTO, id: ID_T });
    await p.goto(base + '/cours-talons.html');
    await p.waitForFunction(() => !document.getElementById('ct-merci').classList.contains('u-hidden'), null, { timeout: 40000 }).catch(() => {});
    const signes = r2Appels.filter((c) => c.action === 'candidature_signer');
    const inscrites = journal.filter((j) => j[0] === 'POST' && j[1] === 'cours_talons').map((j) => JSON.parse(j[3] || '{}'));
    if (cas.r2Max) ok(inscrites.length === 1 && inscrites[0].photos.length === 2 && inscrites[0].photos.every((x) => /^https:\/\/drive/.test(x)), n + 'superviseur 3 : 1 photo sur 2 chez Cloudflare : l’inscription porte les 2 liens Drive (roue de secours) (' + JSON.stringify(inscrites.map((x) => x.photos)) + ')');
    else ok(signes.length === 2 && signes.every((c) => c.dossier === 'cours-talons' && c.candidature === ID_T), n + '2 photos envoyées chez Cloudflare, dossier cours-talons, numéro de l’inscription');
    ok(ordre[0] === 'r2' && ordre.includes('drive') && ordre.indexOf('drive') > ordre.lastIndexOf('r2'), n + 'Cloudflare d’abord, PUIS la copie Drive');
    if (cas.r2Max) { /* (vérifié plus haut) */ } else if (!cas.baseRefuse) ok(inscrites.length === 1 && inscrites[0].photos.length === 2 && inscrites[0].photos.every((x) => /^r2:cours-talons\//.test(x)), n + 'l’inscription porte les 2 photos Cloudflare (' + JSON.stringify(inscrites.map((x) => x.photos)) + ')');
    else ok(essais.length === 2 && inscrites.length === 1 && inscrites[0].photos.every((x) => /^https:\/\/drive/.test(x)), n + 'base refuse les photos Cloudflare : l’inscription repart avec les liens Drive, comme avant (' + JSON.stringify(essais) + ')');
    ok(await p.evaluate(() => !document.getElementById('ct-merci').classList.contains('u-hidden')), n + '« Merci » affiché');
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
    d.tables.casting_photos.push({ id: 'ph-r2', application_id: 'c4', chemin: 'r2:' + CR2, url: 'r2:' + CR2 });
    d.memoriser = true;
    let serveurPhotosEnPanne = false;
    p.on('dialog', (dl) => dl.accept());
    const CT = 'cours-talons/' + ID + '/' + 'c'.repeat(32) + '.jpg';
    const dr = (k) => 'https://drive.google.com/thumbnail?id=talon' + k, CT2 = 'cours-talons/' + ID + '/' + 'e'.repeat(32) + '.jpg';
    d.tables.cours_talons = [
      // (déclencheur cours_talons_z_medias_drive simulé : la base a ajouté les copies Drive)
      { id: 't-cache', nom: 'AYA DEUX', telephone: '+2250700000006', formule: 'groupe', nb_seances: 4, statut: 'plus_tard', photos: ['r2:' + CT, 'r2:' + CT2, dr(1), dr(2)], video: null, cree_le: '2026-11-16T11:00:00Z', age: 20, decision: 'plus_tard', montant: 30000 },
      { id: 't-tout', nom: 'AYA TROIS', telephone: '+2250700000007', formule: 'groupe', nb_seances: 4, statut: 'plus_tard', photos: ['r2:' + CT, dr(1), dr(2)], video: null, cree_le: '2026-11-16T12:00:00Z', age: 20, decision: 'plus_tard', montant: 30000 },
      { id: 't-r2', nom: 'AYA CLOUDFLARE', telephone: '+2250700000005', formule: 'groupe', nb_seances: 4, statut: 'plus_tard', photos: ['r2:' + CT], video: null, cree_le: '2026-11-16T10:00:00Z', age: 20, decision: 'plus_tard', montant: 30000 }];
    await brancher(p, d, journal); await photosLocales(p);
    await p.route('**/api/r2-presigner', async (route) => {
      const c = JSON.parse(route.request().postData() || '{}');
      if (c.action === 'candidature_lire' && serveurPhotosEnPanne) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"panne"}' });
      if (c.action === 'candidature_lire') { lus.push(...c.chemins); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ adresses: Object.fromEntries(c.chemins.map((x) => [x, 'https://photos.maitreakessemodelmanagement.com/m0/' + x + '?signature=x'])) }) }); }
      if (c.action === 'candidature_supprimer') { supprimes.push(c.chemin || c.chemins); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
      return route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
    });
    await seConnecter(p, base + '/admin/'); await p.waitForSelector('.accueil-tete');
    await p.goto(base + '/admin/#/site/b2-candidatures/c4'); await p.waitForSelector('.galerie-dossier .photo-dossier', { timeout: 15000 }).catch(() => {});
    const images = () => p.evaluate(() => [...document.querySelectorAll('.galerie-dossier .photo-dossier img')].map((i) => i.getAttribute('src') || ''));
    const vu = await images();
    // (superviseur 3) 1 photo chez Cloudflare, 2 copies Drive : des photos ne sont arrivées que dans Drive → tout reste visible
    ok(lus.includes(CR2) && vu.length === 3 && vu.filter((x) => /signature=x/.test(x)).length === 1 && vu.filter((x) => /drive\.google/.test(x)).length === 2,
      n + 'superviseur 3 : 1 photo Cloudflare et 2 copies Drive : les photos arrivées seulement dans Drive restent visibles (' + vu.length + ' photos)');
    // (superviseur 3) 2 photos Cloudflare et 2 copies Drive (M ≤ N) : les copies Drive sont cachées
    const CR2b = 'candidatures/' + ID + '/' + 'd'.repeat(32) + '.jpg';
    d.tables.casting_photos.push({ id: 'ph-r2b', application_id: 'c4', chemin: 'r2:' + CR2b, url: 'r2:' + CR2b });
    await p.goto(base + '/admin/#/site/b2-candidatures/c1'); await p.waitForTimeout(300);
    await p.goto(base + '/admin/#/site/b2-candidatures/c4'); await p.waitForTimeout(300); await p.waitForSelector('.galerie-dossier .photo-dossier', { timeout: 15000 }).catch(() => {});
    const vu2 = await images();
    ok(vu2.length === 2 && vu2.every((x) => /signature=x/.test(x)), n + 'superviseur 3 : 2 photos Cloudflare et 2 copies Drive : les copies Drive sont cachées (' + vu2.length + ')');
    // (dernière passe du superviseur) serveur de photos injoignable : les copies Drive s'affichent, la galerie n'est pas vide
    serveurPhotosEnPanne = true;
    await p.goto(base + '/admin/#/site/b2-candidatures/c1'); await p.waitForTimeout(300);
    await p.goto(base + '/admin/#/site/b2-candidatures/c4'); await p.waitForTimeout(300); await p.waitForSelector('.galerie-dossier .photo-dossier', { timeout: 15000 }).catch(() => {});
    const enPanne = await images();
    ok(enPanne.length === 2 && enPanne.every((x) => /drive\.google/.test(x)), n + 'serveur de photos injoignable : les 2 copies Drive s’affichent (' + enPanne.length + ')');
    serveurPhotosEnPanne = false;
    await p.goto(base + '/admin/#/site/b2-candidatures/c1'); await p.waitForTimeout(300);
    await p.goto(base + '/admin/#/site/b2-candidatures/c4'); await p.waitForTimeout(300); await p.waitForSelector('.galerie-dossier .photo-dossier', { timeout: 15000 }).catch(() => {});
    // (superviseur 8, accepté tel quel) une photo Cloudflare supprimée : rien d'autre n'est supprimé ; 1 Cloudflare et
    // 2 copies (M > N) : tout est montré
    await p.locator('[data-action="dossier-photo-supprimer"][data-photo="ph-r2b"]').click();
    await p.waitForFunction(() => /supprimée/.test((document.getElementById('dos-photo-msg') || {}).textContent || ''), null, { timeout: 10000 }).catch(() => {});
    const vu3 = await images(), restent = d.tables.casting_photos.filter((x) => x.application_id === 'c4');
    ok(vu3.length === 3 && restent.length === 3 && ['ph1', 'ph2', 'ph-r2'].every((id) => restent.some((x) => x.id === id)) && supprimes.flat().includes(CR2b),
      n + 'superviseur 8 : photo Cloudflare supprimée : aucune autre ligne supprimée, tout est montré (' + vu3.length + ' images)');
    d.memoriser = false;
    await p.goto(base + '/admin/#/site/b2-candidatures/c1'); await p.waitForTimeout(300); await p.waitForSelector('.galerie-dossier .photo-dossier', { timeout: 15000 }).catch(() => {});
    const ancien = await p.evaluate(() => [...document.querySelectorAll('.galerie-dossier .photo-dossier img')].map((i) => i.getAttribute('src') || ''));
    ok(ancien.length === 1 && /drive\.google\.com/.test(ancien[0]), n + 'ancienne candidature (Drive seul) : affichage inchangé');
    await p.goto(base + '/admin/#/site/b2-cours-talons'); await p.waitForSelector('.ct-fiche', { timeout: 10000 }).catch(() => {});
    await p.evaluate(() => document.querySelectorAll('.ct-fiche').forEach((f) => { if (f.closest('details')) f.closest('details').open = true; }));
    const talons = await p.evaluate(() => { const f = document.querySelector('.ct-fiche[data-id="t-r2"]'); return f ? [...f.querySelectorAll('img')].map((i) => i.getAttribute('src') || '') : null; });
    const imgs = (id) => p.evaluate((x) => { const f = document.querySelector('.ct-fiche[data-id="' + x + '"]'); return f ? [...f.querySelectorAll('img')].map((i) => i.getAttribute('src') || '') : null; }, id);
    const cache = await imgs('t-cache'), tout = await imgs('t-tout');
    ok(Array.isArray(cache) && cache.length === 2 && cache.every((x) => /signature=x/.test(x)), n + 'talons : 2 photos Cloudflare, 2 copies Drive ajoutées par la base : copies cachées (' + (cache && cache.length) + ')');
    ok(Array.isArray(tout) && tout.length === 3, n + 'talons : 1 photo Cloudflare, 2 copies Drive : tout est montré (' + (tout && tout.length) + ')');
    ok(Array.isArray(talons) && talons.length === 1 && /cours-talons\/.*signature=x/.test(talons[0]), n + 'cours de talons : photo Cloudflare affichée par adresse signée, copie Drive masquée (' + JSON.stringify(talons) + ')');
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
