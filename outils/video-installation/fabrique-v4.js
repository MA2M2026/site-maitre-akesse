// Fabrication de la vidéo v4 (28/10/2026). Entrée : les phrases enregistrées (voix-v4.json, une
// phrase = un fichier VOIX/<clé>.wav, voix française Piper « fr_FR-siwis-medium », vitesse 1.1).
//   VOIX=<dossier des .wav> IMAGES=<dossier vide> node fabrique-v4.js [--sans-images]
// 1. minutage : chaque scène dure « 0,35 s + la phrase + une marge » → timing-v4.js (lu par film4.html) ;
// 2. images 1080 × 1920 à 30 i/s de film4.html ; 3. piste son : les phrases à leur place + la musique
// en fond (plus douce sous la voix) ; 4. vidéo 720 × 1280 légère pour WhatsApp : Installer-application-MA2M-v4.mp4.
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const ICI = __dirname, VOIX = process.env.VOIX, IMAGES = process.env.IMAGES;
if (!VOIX || !IMAGES) { console.error('VOIX=<dossier des .wav> IMAGES=<dossier vide> node fabrique-v4.js'); process.exit(1); }
const phrases = JSON.parse(fs.readFileSync(path.join(ICI, 'voix-v4.json'), 'utf8'));
const duree = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
const AVANT = 0.35, MARGE = { intro: 0.5, ios: 0.4, and: 0.4, ios4: 1.2, ios6: 1.1, iosfin: 0.6, andfin: 0.6, fin: 1.6 };
let t = 0; const SEG = {};
for (const [cle] of phrases) {
  const d = duree(path.join(VOIX, cle + '.wav'));
  const fin = t + AVANT + d + (MARGE[cle] !== undefined ? MARGE[cle] : 0.9);
  SEG[cle] = [+t.toFixed(3), +fin.toFixed(3), +(t + AVANT).toFixed(3), +(t + AVANT + d).toFixed(3)];
  t = fin;
}
const DUREE = +t.toFixed(2);
fs.writeFileSync(path.join(ICI, 'timing-v4.js'), '// fabriqué par fabrique-v4.js : [début scène, fin scène, début voix, fin voix] (secondes)\nwindow.SEG = ' + JSON.stringify(SEG) + ';\nwindow.DUREE = ' + DUREE + ';\n');
console.log('durée', DUREE, 's');
if (process.argv.includes('--minutage')) process.exit(0);

(async () => {
  if (!process.argv.includes('--sans-images')) {
    const { chromium } = require('playwright');
    const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
    const erreurs = []; p.on('pageerror', (e) => erreurs.push(e.message));
    await p.goto('file://' + ICI + '/film4.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
    if (erreurs.length) { console.error('ERREURS', erreurs); process.exit(1); }
    const IPS = 30, N = Math.ceil(DUREE * IPS);
    for (let i = 0; i < N; i++) {
      await p.evaluate((x) => window.rendre(x), i / IPS);
      await p.screenshot({ path: path.join(IMAGES, 'f' + String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 92 });
      if (i % 300 === 0) console.log('image', i, '/', N);
    }
    await b.close();
  }
  // piste son : chaque phrase à sa place (adelay), la musique en boucle, plus douce, en fond
  const entrees = [], filtres = [];
  phrases.forEach(([cle], i) => { entrees.push('-i', path.join(VOIX, cle + '.wav')); const ms = Math.round(SEG[cle][2] * 1000); filtres.push('[' + i + ':a]aresample=44100,adelay=' + ms + '|' + ms + ',volume=1.6[v' + i + ']'); });
  const nv = phrases.length;
  entrees.push('-stream_loop', '-1', '-i', path.join(ICI, 'musique-32.wav'));
  filtres.push(phrases.map((_, i) => '[v' + i + ']').join('') + 'amix=inputs=' + nv + ':normalize=0,apad=whole_dur=' + DUREE + '[voix]');
  filtres.push('[' + nv + ':a]aresample=44100,atrim=0:' + DUREE + ',volume=0.13,afade=t=in:d=1,afade=t=out:st=' + (DUREE - 2.5) + ':d=2.5[mus]');
  filtres.push('[voix][mus]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]');
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...entrees, '-filter_complex', filtres.join(';'), '-map', '[a]', '-t', String(DUREE), '-ac', '2', path.join(IMAGES, 'son.wav')], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', path.join(IMAGES, 'f%05d.jpg'), '-i', path.join(IMAGES, 'son.wav'),
    '-vf', 'scale=720:1280', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '112k', '-shortest',
    path.join(ICI, 'Installer-application-MA2M-v4.mp4')], { stdio: 'inherit' });
  console.log('vidéo : Installer-application-MA2M-v4.mp4');
})();
