// Fabrication de la vidéo « Atelier Talons & Élégance », version luxe en motion design (10/11/2026, demande de la
// propriétaire ; texte fourni par elle, voix-talons.json). Voix naturelle ElevenLabs (voix-eleven.py → VOIX/voix.wav et
// VOIX/mots.json : instant de chaque phrase et de chaque mot), musique originale (musique-talons.py → MUSIQUE), images
// de film-talons.html rendues par Chromium à 30 i/s.
//   VOIX=<dossier de voix-eleven.py ou aligner-voix.py> MUSIQUE=<fichier .wav> IMAGES=<dossier vide> [FILM=film-agence.html NOM=integrer-agence]
//   node fabrique-talons.js [vertical|large] [--apercus]
// (FILM : film-talons.html par défaut ; NOM : nom de la vidéo, atelier-talons-elegance par défaut)
// 1. minutage : timing-talons.js (window.T, lu par le film) ;
// 2. --apercus : seulement quelques images fixes (apercu-*.jpg dans IMAGES) pour valider le style ;
// 3. sinon : toutes les images, piste son (voix + musique plus douce sous la voix), vidéo MP4 légère (H.264,
//    +faststart) : atelier-talons-elegance(-large).mp4 dans IMAGES.
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const ICI = __dirname, VOIX = process.env.VOIX, IMAGES = process.env.IMAGES, MUSIQUE = process.env.MUSIQUE;
const FILM = process.env.FILM || 'film-talons.html', NOM = process.env.NOM || 'atelier-talons-elegance';
if (!VOIX || !IMAGES) { console.error('VOIX=<dossier> MUSIQUE=<.wav> IMAGES=<dossier> node fabrique-talons.js [vertical|large] [--apercus]'); process.exit(1); }
const FORMAT = process.argv.includes('large') ? 'large' : 'vertical';
const [L, H] = FORMAT === 'large' ? [1920, 1080] : [1080, 1920];
const mots = JSON.parse(fs.readFileSync(path.join(VOIX, 'mots.json'), 'utf8'));
const DUREE = +(mots.duree + 3.2).toFixed(2);  // la dernière image reste 3 s après la voix
fs.writeFileSync(path.join(ICI, FILM.replace('film-', 'timing-').replace('.html', '.js')), '// fabriqué par fabrique-talons.js (d\'après voix-eleven.py) : instants de chaque phrase et de chaque mot (secondes)\nwindow.T = ' +
  JSON.stringify({ phrases: mots.phrases, mots: mots.mots, duree: DUREE }) + ';\n');
console.log('durée', DUREE, 's,', FORMAT);
if (process.argv.includes('--minutage')) process.exit(0);

(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: L, height: H } });
  const erreurs = []; p.on('pageerror', (e) => erreurs.push(e.message));
  await p.goto('file://' + ICI + '/' + FILM + (FORMAT === 'large' ? '?format=large' : '')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200);
  const manques = await p.evaluate(() => window.MANQUES);
  if (erreurs.length || manques.length) { console.error('ERREURS', erreurs, 'MOTS INTROUVABLES', manques); process.exit(1); }
  const P = mots.phrases;
  if (process.argv.includes('--apercus')) {
    // une image à la fin de chaque phrase (et 1 s après la dernière)
    const cles = Object.keys(P), derniere = cles[cles.length - 1];
    const instants = cles.map((c) => [c, c === derniere ? 1 : 0]);
    for (const [cle, d] of instants) { await p.evaluate((x) => window.rendre(x), P[cle][1] - 0.35 + d); await p.screenshot({ path: path.join(IMAGES, 'apercu-' + FORMAT + '-' + cle + '.jpg'), type: 'jpeg', quality: 88 }); }
    // et quelques instants « en mouvement » (pendant les apparitions et les transitions)
    for (const [cle, d] of [['groupe', 4.0], ['p2', 0.3], ['niveau', 1.2], ['prive', -0.2]].filter(([c]) => P[c])) { await p.evaluate((x) => window.rendre(x), P[cle][0] + d); await p.screenshot({ path: path.join(IMAGES, 'mouvement-' + FORMAT + '-' + cle + '.jpg'), type: 'jpeg', quality: 88 }); }
    await b.close(); return;
  }
  const IPS = 30, N = Math.ceil(DUREE * IPS);
  for (let i = 0; i < N; i++) {
    await p.evaluate((x) => window.rendre(x), i / IPS);
    await p.screenshot({ path: path.join(IMAGES, 'f' + String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 90 });
    if (i % 300 === 0) console.log('image', i, '/', N);
  }
  await b.close();
  // piste son : la voix, et la musique en fond, plus douce pendant que la voix parle (« ducking »)
  const son = path.join(IMAGES, 'son.m4a');
  const filtre = MUSIQUE
    ? '[0:a]aresample=48000,apad,atrim=0:' + DUREE + ',asplit=2[voix][cle];[1:a]aresample=48000,aloop=loop=-1:size=2e9,atrim=0:' + DUREE + ',volume=0.5,afade=t=in:d=2,afade=t=out:st=' + (DUREE - 3.5) + ':d=3.5[mus];' +
      '[mus][cle]sidechaincompress=threshold=0.025:ratio=5:attack=30:release=600[musd];[voix][musd]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]'
    : '[0:a]aresample=48000,apad,atrim=0:' + DUREE + '[a]';
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(VOIX, 'voix.wav'), ...(MUSIQUE ? ['-i', MUSIQUE] : []), '-filter_complex', filtre, '-map', '[a]', '-c:a', 'aac', '-b:a', '160k', son]);
  const sortie = path.join(IMAGES, NOM + (FORMAT === 'large' ? '-large' : '') + '.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(IPS), '-i', path.join(IMAGES, 'f%05d.jpg'), '-i', son,
    '-vf', 'scale=' + (FORMAT === 'large' ? '1280:720' : '720:1280') + ':flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22',
    '-c:a', 'copy', '-shortest', '-movflags', '+faststart', sortie]);
  console.log('✓', sortie, (fs.statSync(sortie).size / 1048576).toFixed(1), 'Mo');
})();
