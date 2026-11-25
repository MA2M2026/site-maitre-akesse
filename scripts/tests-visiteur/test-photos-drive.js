// Photos envoyées vers Google Drive : solution définitive (15/11/2026, maquettes/URGENT-photos-candidatures.md).
// Base et Google Drive SIMULÉS : rien n'est envoyé pour de vrai. Comme une vraie candidate, puis comme l'agence :
//  1. Intégrer l'agence (téléphone) : Google LENT puis réponse COUPÉE (deux fois) → chaque envoi porte le numéro de la
//     candidature (source + ref), le même aux deux essais (Google réutilise le même dossier : pas de double), et la page
//     ne prétend pas avoir enregistré de photo ;
//  2. Postuler à un casting (ordinateur, anglais) : Google répond « enregistré par le programme » → la page n'écrit
//     plus les photos elle-même (pas de double), jauges vertes ;
//  3. ancien programme Google (sans enregistrement de son côté) → la page enregistre les photos elle-même, comme avant ;
//  4. cours de talons : réponse de Google perdue → l'inscription part avec le MÊME numéro que l'envoi vers Drive
//     (la base y rattache les photos enregistrées par Google) ;
//  5. Administration (téléphone et ordinateur) : candidature sans photo → « Photos dans Drive », lien du dossier,
//     « Récupérer les photos depuis Drive » → photos rattachées et affichées ; cours de talons sans photo : même encart.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path'); const fs = require('fs');
const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const PORT = String(9700 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PHOTO = fs.readFileSync(path.join(__dirname, 'medias', 'photo0.jpg')).toString('base64');
const ID_CAND = '11111111-2222-3333-4444-555555555555', ID_TALONS = '66666666-7777-8888-9999-000000000000';

// Dossier « gardé dans le téléphone » (EnvoiFiable, js/app.js) : l'envoi des médias repart tout seul à l'ouverture
// de la page du formulaire, exactement comme après « Envoyer ».
async function garderCandidature(p, page, parcours) {
  await p.evaluate(async ({ photo, id, page, parcours }) => {
    const octets = Uint8Array.from(atob(photo), (c) => c.charCodeAt(0));
    const f = new File([octets], 'photo.jpg', { type: 'image/jpeg' }), v = new File([new Uint8Array(200000)], 'video.mp4', { type: 'video/mp4' });
    await EnvoiFiable.garder('candidature', { candidature: { id, full_name: 'Awa Koné', email: 'awa@test.ci', phone: '+2250700000001', experience_mannequin: 'non' },
      projetNom: parcours === 'projet' ? 'Défilé X' : '', mineur: false, parcours, photos: [f, f, f], video: v, page, photosFaites: false });
  }, { photo: PHOTO, id: ID_CAND, page, parcours });
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const base = 'http://127.0.0.1:' + PORT;

  // ---------- 1 à 3 : candidatures
  for (const cas of [
    { nom: 'Intégrer l’agence, téléphone, Google lent puis coupé', page: '/academie.html', parcours: 'agence', ecran: { width: 390, height: 844 }, google: 'coupe' },
    { nom: 'Casting, ordinateur, anglais, enregistré par Google', page: '/en/candidature.html', parcours: 'projet', ecran: { width: 1280, height: 900 }, google: 'enregistre' },
    { nom: 'Intégrer l’agence, ancien programme Google', page: '/academie.html', parcours: 'agence', ecran: { width: 1280, height: 900 }, google: 'ancien' }]) {
    const tel = cas.ecran.width < 700;
    const ctx = await b.newContext({ viewport: cas.ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [], envoisPhotos = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables: { casting_projets: [{ nom: 'Défilé X', actif: true }] }, rpc: { casting_ouvert: true, ajouter_video_candidature: true } }, journal);
    await p.route(/script\.google\.com/, async (route) => {
      const c = JSON.parse(route.request().postData() || '{}');
      if (c.photos) {
        envoisPhotos.push({ source: c.source, ref: c.ref, nb: c.photos.length });
        if (cas.google === 'coupe') { await new Promise((r) => setTimeout(r, 2500)); return route.abort('connectionreset'); }
        const liens = c.photos.map((x, i) => 'https://drive.google.com/thumbnail?id=photo' + i + '&sz=w2000');
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cas.google === 'enregistre' ? { ok: true, liens, dossier: 'dossier-awa', enregistre: true } : { ok: true, liens, dossier: 'dossier-awa' }) });
      }
      const rep = c.action === 'video_debut' ? { ok: true, session: 's1', dossier: 'dossier-awa' } : c.action === 'video_morceau' ? { ok: true, video: 'https://drive.google.com/file/d/v1/view', enregistre: true } : { ok: true, recu: 0 };
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rep) });
    });
    await p.goto(base + '/index.html'); await p.waitForTimeout(600);
    await garderCandidature(p, cas.page, cas.parcours);
    await p.goto(base + cas.page);
    await p.waitForFunction(() => /Merci|Thank you|mais|but|repartira|resume/.test((document.getElementById('ca-msg') || {}).textContent || '') && document.querySelectorAll('#ca-jauges-photos .jauge').length === 3
      && ![...document.querySelectorAll('#ca-jauges-photos .jauge')].some((j) => /envoi|sending/.test(j.textContent)), null, { timeout: 40000 }).catch(() => {});
    await p.waitForTimeout(800);
    const photosPage = journal.filter((j) => j[0] === 'POST' && j[1] === 'casting_photos');
    const vertes = await p.locator('#ca-jauges-photos .jauge.terminee').count();
    const n = cas.nom + ' : ';
    ok(envoisPhotos.length >= 1 && envoisPhotos.every((e) => e.source === 'candidature' && e.ref === ID_CAND && e.nb === 3),
      n + 'chaque envoi vers Google porte le numéro de la candidature (' + JSON.stringify(envoisPhotos) + ')');
    if (cas.google === 'coupe') {
      ok(envoisPhotos.length === 2, n + 'un seul nouvel essai, avec le MÊME numéro (Google réutilise le même dossier)');
      ok(!photosPage.length && vertes === 0, n + 'réponse perdue : la page n’invente aucune photo (Google et la base s’en chargent)');
    } else if (cas.google === 'enregistre') {
      ok(!photosPage.length && vertes === 3, n + 'Google a déjà tout enregistré : la page n’écrit pas les photos une 2e fois, jauges vertes (' + photosPage.length + ', ' + vertes + ')');
    } else {
      ok(photosPage.length === 3 && vertes === 3, n + 'la page enregistre elle-même les 3 photos, comme avant (' + photosPage.length + ')');
    }
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }

  // ---------- 4 : cours de talons, réponse de Google perdue
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [], envoisPhotos = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables: {}, rpc: {} }, journal);
    await p.route(/script\.google\.com/, async (route) => {
      const c = JSON.parse(route.request().postData() || '{}');
      if (c.photos) { envoisPhotos.push({ source: c.source, ref: c.ref }); return route.abort('connectionreset'); }
      const rep = c.action === 'video_debut' ? { ok: true, session: 's1', dossier: 'd2' } : c.action === 'video_morceau' ? { ok: true, video: 'https://drive.google.com/file/d/v2/view' } : { ok: true, recu: 0 };
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rep) });
    });
    await p.goto(base + '/index.html'); await p.waitForTimeout(600);
    await p.evaluate(async ({ photo, id }) => {
      const octets = Uint8Array.from(atob(photo), (c) => c.charCodeAt(0));
      const f = new File([octets], 'photo.jpg', { type: 'image/jpeg' }), v = new File([new Uint8Array(200000)], 'marche.mp4', { type: 'video/mp4' });
      await EnvoiFiable.garder('cours-talons', { ligne: { id, formule: 'groupe', nb_seances: 4, nom: 'Aya Test', telephone: '+2250700000002', age: 22, decision: 'plus_tard' },
        montant: '30 000 FCFA', photos: [f, f], video: v, d: { liens: [], rangs: [], dossier: null, video: null }, page: '/cours-talons.html' });
    }, { photo: PHOTO, id: ID_TALONS });
    await p.goto(base + '/cours-talons.html');
    await p.waitForFunction(() => !document.getElementById('ct-merci').classList.contains('u-hidden'), null, { timeout: 40000 }).catch(() => {});
    const inscrits = journal.filter((j) => j[0] === 'POST' && j[1] === 'cours_talons').map((j) => JSON.parse(j[3] || '{}'));
    const ligne = inscrits[0] && (inscrits[0].ligne || inscrits[0]);
    ok(envoisPhotos.length >= 1 && envoisPhotos.every((e) => e.source === 'cours_talons' && e.ref === ID_TALONS), 'cours de talons : l’envoi vers Google porte le numéro de l’inscription (' + JSON.stringify(envoisPhotos) + ')');
    ok(inscrits.length === 1 && ligne && ligne.id === ID_TALONS, 'cours de talons : réponse perdue, l’inscription part quand même, avec ce MÊME numéro (la base y rattache les photos de Google)');
    ok(!errs.length, 'cours de talons : aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }

  // ---------- 5 : Administration
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = 'Administration (' + nom + ') : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [], d = donnees('principal');
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    d.tables.medias_drive = [{ ref: 'c2', genre: 'dossier', lien: '1AbCdEfGhIjKlMnOp' }];
    d.tables.cours_talons = [{ id: 't-sans', nom: 'AYA SANS PHOTO', telephone: '+2250700000003', formule: 'groupe', nb_seances: 4, statut: 'plus_tard', photos: [], video: null, cree_le: '2026-11-14T10:00:00Z', age: 20, decision: 'plus_tard', montant: 30000 }];
    // la base demande au programme Google de retrouver les photos : elles apparaissent (simulé) dans casting_photos
    d.rpc.medias_drive_relancer = (x) => {
      journal.push(['RELANCE', x.p_source, x.p_ref]);
      if (x.p_ref === 'c2') d.tables.casting_photos.push({ id: 'ph-drive', application_id: 'c2', chemin: null, url: 'https://drive.google.com/uc?id=photo-bintou-1' });
      return true;
    };
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, base + '/admin/'); await p.waitForSelector('.accueil-tete');
    await p.goto(base + '/admin/#/site/b2-candidatures/c2'); await p.waitForSelector('.drive-secours', { timeout: 10000 }).catch(() => {});
    const encart = await p.evaluate(() => { const e = document.querySelector('.drive-secours'); return e ? { texte: e.innerText, lien: (e.querySelector('a') || {}).href || '' } : null; });
    ok(encart && /Photos dans Drive/.test(encart.texte) && /Récupérer les photos depuis Drive/.test(encart.texte) && encart.lien === 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp',
      n + 'candidature sans photo : « Photos dans Drive », lien du dossier, bouton de récupération (' + JSON.stringify(encart) + ')');
    await p.click('[data-action="drive-recuperer"]');
    await p.waitForSelector('.galerie-dossier .photo-dossier', { timeout: 15000 }).catch(() => {});
    const apres = await p.evaluate(() => ({ photos: document.querySelectorAll('.galerie-dossier .photo-dossier').length, encart: !!document.querySelector('.drive-secours') }));
    ok(journal.some((j) => j[0] === 'RELANCE' && j[1] === 'candidature' && j[2] === 'c2') && apres.photos === 1 && !apres.encart, n + '« Récupérer » : la photo trouvée dans Drive est rattachée et affichée (' + JSON.stringify(apres) + ')');
    const deborde = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    await p.goto(base + '/admin/#/site/b2-cours-talons'); await p.waitForSelector('.ct-fiche', { timeout: 10000 }).catch(() => {});
    await p.evaluate(() => { const f = document.querySelector('.ct-fiche[data-id="t-sans"]'); if (f && f.closest('details')) f.closest('details').open = true; });
    const talons = await p.evaluate(() => { const f = document.querySelector('.ct-fiche[data-id="t-sans"]'); const e = f && f.querySelector('.drive-secours'); return e ? e.innerText : (f ? 'fiche sans encart' : 'fiche absente'); });
    ok(/Photos dans Drive/.test(talons) && /Récupérer les photos depuis Drive/.test(talons), n + 'cours de talons sans photo : même encart « Photos dans Drive » (' + talons.slice(0, 80) + ')');
    ok(!deborde, n + 'rien ne dépasse de l’écran');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }

  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Photos vers Drive : tout passe');
  process.exit(ko ? 1 : 0);
})();
