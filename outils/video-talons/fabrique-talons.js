// Fabrication de la vidéo « Atelier Talons & Élégance », version luxe (10/11/2026, demande de la propriétaire ; texte
// fourni par elle, voix-talons.json). Voix française Piper (une phrase = VOIX/<clé>.wav), musique originale
// (musique-talons.py → MUSIQUE), images de film-talons.html rendues par Chromium à 30 i/s.
//   VOIX=<dossier des .wav> MUSIQUE=<fichier .wav> IMAGES=<dossier vide> node fabrique-talons.js [vertical|large] [--apercus]
// 1. minutage : chaque phrase après la précédente, avec un temps de respiration → timing-talons.js ;
// 2. --apercus : seulement quelques images fixes (apercu-*.jpg dans IMAGES) pour valider le style ;
// 3. sinon : toutes les images, piste son (voix à leur place + musique plus douce sous la voix), vidéo MP4 légère
//    (H.264, +faststart) : atelier-talons-elegance(-large).mp4 dans IMAGES.
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const ICI = __dirname, VOIX = process.env.VOIX, IMAGES = process.env.IMAGES, MUSIQUE = process.env.MUSIQUE;
if (!VOIX || !IMAGES) { console.error('VOIX=<dossier des .wav> MUSIQUE=<.wav> IMAGES=<dossier> node fabrique-talons.js [vertical|large] [--apercus]'); process.exit(1); }
const FORMAT = process.argv.includes('large') ? 'large' : 'vertical';
const [L, H] = FORMAT === 'large' ? [1920, 1080] : [1080, 1920];
const phrases = JSON.parse(fs.readFileSync(path.join(ICI, 'voix-talons.json'), 'utf8'));
const duree = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// respiration après chaque phrase (secondes) ; les énumérations (p1-p4, e1-e4) s'enchaînent plus vite
const APRES = { intro: 1.0, questions: 0.8, endroit: 0.5, demarche: 0.9, p1: 0.35, p2: 0.35, p3: 0.35, p4: 0.9, confiance: 1.0, niveau: 0.9,
  groupe: 1.0, prive: 1.0, domicile: 0.6, nombre: 1.0, inscrire: 0.5, e1: 0.3, e2: 0.3, e3: 0.3, e4: 1.0, toutes: 0.5, but: 1.0, agence: 1.2, fin1: 0.4, fin2: 2.6 };
let t = 1.2; const SEG = {};
for (const [cle] of phrases) {
  const d = duree(path.join(VOIX, cle + '.wav'));
  SEG[cle] = [+(t - 0.3).toFixed(3), +(t + d + (APRES[cle] || 0.8)).toFixed(3), +t.toFixed(3), +(t + d).toFixed(3)];
  t += d + (APRES[cle] || 0.8);
}
const DUREE = +t.toFixed(2);
fs.writeFileSync(path.join(ICI, 'timing-talons.js'), '// fabriqué par fabrique-talons.js : [début, fin, début de la voix, fin de la voix] (secondes)\nwindow.SEG = ' + JSON.stringify(SEG) + ';\nwindow.DUREE = ' + DUREE + ';\n');
console.log('durée', DUREE, 's,', FORMAT);
if (process.argv.includes('--minutage')) process.exit(0);

(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: L, height: H } });
  const erreurs = []; p.on('pageerror', (e) => erreurs.push(e.message));
  await p.goto('file://' + ICI + '/film-talons.html' + (FORMAT === 'large' ? '?format=large' : '')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200);
  if (erreurs.length) { console.error('ERREURS', erreurs); process.exit(1); }
  if (process.argv.includes('--apercus')) {
    // un instant par scène, quand ses textes sont affichés
    const instants = [['intro', 4.2], ['questions', 7.4], ['demarche', 1.6], ['p4', 1.2], ['confiance', 2.6], ['groupe', 6.0], ['prive', 7.0], ['e4', 2.2], ['agence', 8.0], ['fin2', 2.0]];
    for (const [cle, d] of instants) { await p.evaluate((x) => window.rendre(x), SEG[cle][2] + d); await p.screenshot({ path: path.join(IMAGES, 'apercu-' + FORMAT + '-' + cle + '.jpg'), type: 'jpeg', quality: 88 }); }
    await b.close(); return;
  }
  const IPS = 30, N = Math.ceil(DUREE * IPS);
  for (let i = 0; i < N; i++) {
    await p.evaluate((x) => window.rendre(x), i / IPS);
    await p.screenshot({ path: path.join(IMAGES, 'f' + String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 90 });
    if (i % 300 === 0) console.log('image', i, '/', N);
  }
  await b.close();
  // piste son : chaque phrase à sa place, la musique en fond (plus douce pendant la voix : « ducking »)
  const entrees = [], filtres = [];
  phrases.forEach(([cle], k) => { entrees.push('-i', path.join(VOIX, cle + '.wav')); filtres.push('[' + k + ':a]aresample=48000,adelay=' + Math.round(SEG[cle][2] * 1000) + '|' + Math.round(SEG[cle][2] * 1000) + ',apad[v' + k + ']'); });
  const nv = phrases.length;
  filtres.push(phrases.map((_, k) => '[v' + k + ']').join('') + 'amix=inputs=' + nv + ':normalize=0,atrim=0:' + DUREE + ',asplit=2[voix][cle]');
  if (MUSIQUE) {
    entrees.push('-i', MUSIQUE);
    filtres.push('[' + nv + ':a]aresample=48000,aloop=loop=-1:size=2e9,atrim=0:' + DUREE + ',volume=0.55,afade=t=in:d=1.5,afade=t=out:st=' + (DUREE - 3) + ':d=3[mus]');
    filtres.push('[mus][cle]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[musd]');
    filtres.push('[voix][musd]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]');
  } else filtres.push('[voix]anull[a]');
  const son = path.join(IMAGES, 'son.m4a');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...entrees, '-filter_complex', filtres.join(';'), '-map', '[a]', '-c:a', 'aac', '-b:a', '128k', son]);
  // vidéo légère (WhatsApp et site) : 720 × 1280 ou 1280 × 720
  const sortie = path.join(IMAGES, 'atelier-talons-elegance' + (FORMAT === 'large' ? '-large' : '') + '.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(IPS), '-i', path.join(IMAGES, 'f%05d.jpg'), '-i', son,
    '-vf', 'scale=' + (FORMAT === 'large' ? '1280:720' : '720:1280') + ':flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
    '-c:a', 'copy', '-shortest', '-movflags', '+faststart', sortie]);
  console.log('✓', sortie, (fs.statSync(sortie).size / 1048576).toFixed(1), 'Mo');
})();
