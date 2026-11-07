// Photos sans informations cachées (07/11/2026, W6) : une photo de téléphone avec le lieu GPS, le modèle du téléphone
// et la date (bloc Exif) part SANS ces informations (sansDonneesCachees, js/app.js), pour le Book, les photos du site
// et les candidatures ; une photo sans Exif n'est pas touchée. Dans un vrai navigateur, sans rien envoyer.
const { chromium } = require('playwright'); const { spawn, execFileSync } = require('child_process');
const chemin = require('path');
const PORT = String(9650 + Math.floor(Math.random() * 40));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
// deux JPEG faits par Python : un avec Exif (GPS Abidjan, téléphone), un sans
const FAIRE = 'import sys,io,base64,json\nfrom PIL import Image\nim=Image.new("RGB",(64,48),(200,30,30))\ne=Image.Exif()\ne[0x010f]="Samsung"\ne[0x0110]="Galaxy A54"\ne[0x8825]={1:"N",2:(5.0,20.0,10.0),3:"W",4:(4.0,1.0,30.0)}\na=io.BytesIO(); im.save(a,"JPEG",exif=e)\nb=io.BytesIO(); im.save(b,"JPEG")\nprint(json.dumps([base64.b64encode(a.getvalue()).decode(),base64.b64encode(b.getvalue()).decode()]))';
const [AVEC, SANS] = JSON.parse(execFileSync('python3', ['-I', '-c', FAIRE]).toString());
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const p = await (await b.newContext({ viewport: ecran })).newPage();
    await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await p.goto('http://127.0.0.1:' + PORT + '/candidature.html'); await p.waitForFunction(() => typeof sansDonneesCachees === 'function', null, { timeout: 8000 });
    const r = await p.evaluate(async ([avec, sans]) => {
      const fichier = (b64, n) => new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], n, { type: 'image/jpeg' });
      const texte = async (f) => Array.from(new Uint8Array(await f.arrayBuffer())).map((x) => String.fromCharCode(x)).join('');
      const f1 = fichier(avec, 'IMG_2026.jpg'), f2 = fichier(sans, 'propre.jpg');
      const r1 = await sansDonneesCachees(f1), r2 = await sansDonneesCachees(f2), r3 = await redimensionnerImage(f1), r4 = await allegerPhotoSite(f1), r5 = await compresserPhotoOrigine(f1);
      return { avantExif: (await texte(f1)).includes('Exif') && (await texte(f1)).includes('Galaxy'), detecte: await aDesDonneesCachees(f1), propreDetecte: await aDesDonneesCachees(f2),
        apres: await Promise.all([r1, r3, r4, r5].map(async (f) => !(await texte(f)).includes('Exif') && !(await texte(f)).includes('Galaxy') && f.type === 'image/jpeg')),
        intact: r2 === f2, taille: await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.width + 'x' + i.height); i.src = URL.createObjectURL(r1); }) };
    }, [AVEC, SANS]);
    ok(r.avantExif && r.detecte && !r.propreDetecte, nom + ' : une photo de téléphone avec lieu GPS et modèle du téléphone est reconnue (et une photo propre non)');
    ok(r.apres.every(Boolean), nom + ' : Book, photos du site et candidatures : la photo part sans le lieu ni le téléphone');
    ok(r.intact && r.taille === '64x48', nom + ' : une photo sans informations cachées n’est pas touchée ; l’image elle-même est la même (64 × 48)');
    await p.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
