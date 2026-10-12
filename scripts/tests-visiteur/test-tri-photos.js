// Tri automatique Book / Lifestyle à l'envoi d'une photo (categoriePhoto, js/app.js), règles
// minutieuses du 12/10/2026 (choix « A » de la propriétaire). Photos d'essai fabriquées ici,
// jamais envoyées : on appelle seulement la fonction de tri dans un vrai navigateur.
const { chromium } = require('playwright'); const { spawn, execFileSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const DOSSIER = path.join(__dirname, 'medias', 'tri');
fs.mkdirSync(DOSSIER, { recursive: true });
execFileSync('python3', ['-c', `
import random
from PIL import Image
random.seed(7)
def photo(l, h):  # image « réelle » : du bruit coloré, jamais uniforme
    im = Image.new('RGB', (l, h)); im.putdata([(random.randint(20, 230), random.randint(20, 230), random.randint(20, 230)) for _ in range(l * h)]); return im
def exif(marque, logiciel=None):
    e = Image.Exif(); e[271] = marque; e[272] = 'Modele'
    if logiciel: e[305] = logiciel
    return e
d = '${DOSSIER}/'
photo(400, 600).save(d + 'apple-32.jpg', exif=exif('Apple'))                       # téléphone, forme pro
photo(400, 600).save(d + 'apple-lightroom.jpg', exif=exif('Apple', 'Adobe Lightroom'))  # téléphone retouché
photo(450, 600).save(d + 'canon-43.jpg', exif=exif('Canon'))                       # appareil pro, forme téléphone
photo(400, 600).save(d + 'tecno.jpg', exif=exif('TECNO MOBILE LIMITED'))
photo(400, 600).save(d + 'sans-info-32.jpg'); photo(450, 600).save(d + 'sans-info-43.jpg')
photo(338, 600).save(d + 'sans-info-916.jpg'); photo(480, 600).save(d + 'sans-info-45.jpg')
pola = Image.new('RGB', (380, 460), (246, 244, 238)); pola.paste(photo(340, 340), (20, 20)); pola.save(d + 'polaroid.jpg', exif=exif('Canon'))
studio = Image.new('RGB', (400, 600), (248, 248, 248)); studio.paste(photo(120, 560), (140, 40)); studio.save(d + 'studio-blanc.jpg')
# fond de studio blanc pur, mannequin décalée : ressemble à un cadre, mais photo d'un Canon
brule = Image.new('RGB', (400, 600), (255, 255, 255)); brule.paste(photo(200, 490), (20, 20)); brule.save(d + 'studio-brule.jpg', exif=exif('Canon'), quality=100)
`]);
// [fichier sur le disque, nom donné à la photo, type, catégorie attendue]
const cas = [
  ['apple-32.jpg', 'IMG_0001.jpg', 'image/jpeg', 'lifestyle'],
  ['apple-lightroom.jpg', 'IMG_0002.jpg', 'image/jpeg', 'lifestyle'],
  ['canon-43.jpg', 'IMG_0003.jpg', 'image/jpeg', 'book'],
  ['tecno.jpg', 'photo.jpg', 'image/jpeg', 'lifestyle'],
  ['sans-info-32.jpg', '0040d658-be24-4e66-86e7-ab1dc0ebab5d.jpeg', 'image/jpeg', 'book'],
  ['sans-info-43.jpg', '0040d658-be24-4e66-86e7-ab1dc0ebab5d.jpeg', 'image/jpeg', 'lifestyle'],
  ['sans-info-916.jpg', '89B2D9C3-DCF1-4E9D-BFB2-71A5DB0C433F.jpg', 'image/jpeg', 'lifestyle'],
  ['sans-info-45.jpg', 'photo.jpg', 'image/jpeg', 'book'],
  ['sans-info-32.jpg', 'IMG-20261010-WA0012.jpg', 'image/jpeg', 'lifestyle'],
  ['sans-info-32.jpg', 'FullSizeRender.jpg', 'image/jpeg', 'lifestyle'],
  ['sans-info-43.jpg', '3O2A9798.jpg', 'image/jpeg', 'book'],
  ['sans-info-43.jpg', 'Capture One Catalog 01891.jpeg', 'image/jpeg', 'book'],
  ['sans-info-43.jpg', '_MG_1234.jpg', 'image/jpeg', 'book'],
  ['sans-info-32.jpg', 'IMG_4430.HEIC', 'image/heic', 'lifestyle'],
  ['polaroid.jpg', 'scan.jpg', 'image/jpeg', 'lifestyle'],
  ['studio-blanc.jpg', 'DSC_0042.jpg', 'image/jpeg', 'book'],
  ['studio-brule.jpg', 'IMG_0004.jpg', 'image/jpeg', 'book'],
  ['sans-info-43.jpg', 'snap2024.jpg', 'image/jpeg', 'lifestyle'],
  ['sans-info-43.jpg', 'IMG_0001.HIF', 'image/heif', 'book']
];
const PORT = String(9200 + Math.floor(Math.random() * 90));
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..') }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p.goto('http://127.0.0.1:' + PORT + '/mentions-legales.html'); await p.waitForTimeout(800);
  let ko = 0;
  for (const [fichier, nom, type, attendu] of cas) {
    const octets = fs.readFileSync(path.join(DOSSIER, fichier)).toString('base64');
    const obtenu = await p.evaluate(async ([o, nom, type]) => {
      const bin = Uint8Array.from(atob(o), c => c.charCodeAt(0));
      return categoriePhoto(new File([bin], nom, { type }));
    }, [octets, nom, type]);
    if (obtenu !== attendu) { ko++; console.log('❌ ÉCHEC tri : ' + fichier + ' (« ' + nom + ' ») → ' + obtenu + ' au lieu de ' + attendu); }
  }
  // Comme une mannequin : « ＋ Ajouter des photos » dans son Espace (base et stockage simulés) ;
  // la catégorie part bien avec la photo enregistrée.
  const { brancher } = require('./faux-serveur'); const journal = [];
  const q = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  q.on('pageerror', e => errs.push(e.message));
  await q.addInitScript(() => {
    const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 36000;
    const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'admin-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
    localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'admin-1', aud: 'authenticated', role: 'authenticated', email: 'awa@test.ci' } }));
  });
  await brancher(q, { tables: { model_profiles: [{ id: 'admin-1', full_name: 'AWA KONÉ', published: true, desactive: false, slug: 'awa-kone' }] }, rpc: {},
    api: { '/api/r2-presigner': { uploadUrl: 'http://127.0.0.1:' + PORT + '/__stockage', publicUrl: 'https://photos.test/p.jpg' } } }, journal);
  await q.route(/__stockage/, r => r.fulfill({ status: 200, body: '' }));
  await q.goto('http://127.0.0.1:' + PORT + '/espace-mannequin.html'); await q.waitForTimeout(4000);
  // ouvrir l'étape où se trouve « ＋ Ajouter des photos » (touche l'onglet de chaque étape)
  for (let n = 1; n <= 6 && !(await q.$('#fBook')); n++) { await q.click('.step-tab[data-goto="' + n + '"]').catch(() => {}); await q.waitForTimeout(400); }
  const lire = f => fs.readFileSync(path.join(DOSSIER, f));
  await q.setInputFiles('#fBook', [
    { name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: lire('apple-32.jpg') },
    { name: '3O2A9798.jpg', mimeType: 'image/jpeg', buffer: lire('sans-info-43.jpg') },
    { name: 'IMG-20261010-WA0012.jpg', mimeType: 'image/jpeg', buffer: lire('sans-info-32.jpg') }
  ]).catch(e => errs.push('envoi : ' + e.message));
  await q.waitForTimeout(6000);
  const envoyees = journal.filter(j => j[0] === 'POST' && j[1] === 'model_photos').map(j => JSON.parse(j[3]).categorie);
  const etiquettes = await q.evaluate(() => state.photos.book.map(p => p.categorie));
  if (JSON.stringify(envoyees) !== '["lifestyle","book","lifestyle"]' || JSON.stringify(etiquettes) !== JSON.stringify(envoyees)) {
    ko++; console.log('❌ ÉCHEC tri (Espace) : enregistrées ' + JSON.stringify(envoyees) + ', affichées ' + JSON.stringify(etiquettes));
  }
  console.log((ko || errs.length ? '❌ ÉCHEC' : '✓') + ' tri Book / Lifestyle (+ envoi depuis l’Espace) : ' + (cas.length - ko) + '/' + cas.length + ' photos bien rangées | erreurs : ' + JSON.stringify(errs));
  if (ko || errs.length) process.exitCode = 1;
  await b.close(); srv.kill();
})().catch(e => { console.log('❌ ÉCHEC tri', e.message); process.exitCode = 1; });
