// Compcard (31/10/2026, demande de la propriétaire) : la grande photo est montrée EN ENTIER quand la
// remplir la couperait trop (photo en pied : la tête et les pieds étaient coupés), avec la même photo
// floutée sur les côtés ; une photo presque au bon format remplit toujours la case.
// Photos fabriquées dans le navigateur (rien n'est envoyé ni écrit).
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const chemin = require('path');
const PORT = String(9700 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.route(/supabase\.co|googletagmanager|emailjs/, (r) => r.fulfill({ status: 200, body: '' }));
  await p.goto('http://127.0.0.1:' + PORT + '/mannequin.html?id=essai'); await p.waitForFunction(() => typeof construireCanvasCompcard === 'function');
  const r = await p.evaluate(async () => {
    // une silhouette : tête (orange) tout en haut, pieds (verts) tout en bas
    const photo = (l, h) => new Promise((ok) => { const c = document.createElement('canvas'); c.width = l; c.height = h; const x = c.getContext('2d');
      x.fillStyle = '#b4bec8'; x.fillRect(0, 0, l, h); x.fillStyle = '#ff8000'; x.fillRect(l / 2 - 60, 10, 120, 120); x.fillStyle = '#00c000'; x.fillRect(l / 2 - 100, h - 130, 200, 120);
      c.toBlob((bl) => ok(URL.createObjectURL(bl)), 'image/jpeg', 0.95); });
    const mesure = async (l, h) => {
      const photos = [{ url: await photo(l, h), compcard_ordre: 1 }];
      const c = await construireCanvasCompcard({ profil: { full_name: 'Essai' }, photos, projets: [] }, 'fr');
      const e = c.width / 210, x = c.getContext('2d');
      // case de la grande photo : x 15 → 107 mm, y 34 → 164 mm ; on cherche la tête et les pieds dedans
      const zone = x.getImageData(Math.round(15 * e), Math.round(34 * e), Math.round(92 * e), Math.round(130 * e));
      let tete = 0, pieds = 0, gris = 0;
      for (let i = 0; i < zone.data.length; i += 4 * 97) { const [rr, g, bb] = [zone.data[i], zone.data[i + 1], zone.data[i + 2]];
        if (rr > 200 && g > 90 && g < 170 && bb < 80) tete++; if (g > 150 && rr < 90 && bb < 90) pieds++; }
      // coin haut gauche de la case : fond de photo (case remplie) ou bande assombrie (photo entière)
      const coin = x.getImageData(Math.round(16 * e), Math.round(35 * e), 1, 1).data;
      gris = coin[0] > 150 && coin[1] > 150 ? 'photo' : 'bande';
      return { tete, pieds, coin: gris };
    };
    return { pied: await mesure(700, 1600), presque: await mesure(920, 1300) };
  });
  ok(r.pied.tete > 0 && r.pied.pieds > 0, 'photo en pied : la tête ET les pieds sont sur la compcard');
  ok(r.pied.coin === 'bande', 'photo en pied : posée en entier, bandes floutées sur les côtés');
  ok(r.presque.coin === 'photo' && r.presque.tete > 0, 'photo presque au format de la case : elle remplit la case comme avant');
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
