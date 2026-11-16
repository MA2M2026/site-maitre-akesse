// Audit L-9 (16/11/2026) : les photos des actualités et des événements sont allégées AVANT l'envoi (1600 px, JPEG 0,85,
// dès 400 Ko), comme les autres photos du site. On fabrique de vraies photos dans le navigateur (grande, moyenne, petite)
// et on passe chacune dans allegerPhotoSite(fichier, 1600, 0.85, 400 Ko) — exactement l'appel de js/publications-ecriture.js.
// Mesure avant/après. Rien n'est envoyé.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const chemin = require('path'); const fs = require('fs');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PORT = String(9400 + Math.floor(Math.random() * 60));
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch(); const p = await b.newPage();
  await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); } catch (e) { /* */ } });
  await brancher(p, { tables: {}, rpc: {} }, []);
  await p.goto('http://127.0.0.1:' + PORT + '/contact.html'); await p.waitForTimeout(1200);
  const r = await p.evaluate(async () => {
    const fabriquer = (l, h, q) => new Promise((ok) => {
      const c = document.createElement('canvas'); c.width = l; c.height = h; const x = c.getContext('2d');
      for (let i = 0; i < 4000; i++) { x.fillStyle = 'hsl(' + (i * 37 % 360) + ',60%,' + (30 + i % 50) + '%)'; x.fillRect(Math.random() * l, Math.random() * h, 5 + Math.random() * 120, 5 + Math.random() * 120); }
      c.toBlob((bl) => ok(new File([bl], 'photo-' + l + '.jpg', { type: 'image/jpeg' })), 'image/jpeg', q);
    });
    const taille = (f) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.src = URL.createObjectURL(f); });
    const res = [];
    for (const [l, h, q] of [[4000, 3000, 0.95], [2400, 3000, 0.92], [900, 700, 0.8]]) {
      const f = await fabriquer(l, h, q); const a = await allegerPhotoSite(f, 1600, 0.85, 400 * 1024);
      res.push({ avant: [l, h, Math.round(f.size / 1024)], apres: (await taille(a)).concat(Math.round(a.size / 1024)), meme: a === f });
    }
    return { res, appel: typeof allegerPhotoSite };
  });
  r.res.forEach((x) => console.log('  ' + x.avant[0] + '×' + x.avant[1] + ' ' + x.avant[2] + ' Ko → ' + x.apres[0] + '×' + x.apres[1] + ' ' + x.apres[2] + ' Ko'));
  const [grande, haute, petite] = r.res;
  ok(Math.max(grande.apres[0], grande.apres[1]) <= 1600 && grande.apres[2] < grande.avant[2] / 2, 'grande photo (4000 px) : ramenée à 1600 px, plus de 2 fois plus légère');
  ok(Math.max(haute.apres[0], haute.apres[1]) <= 1600 && haute.apres[2] < haute.avant[2], 'photo portrait (3000 px de haut) : ramenée à 1600 px');
  ok(petite.meme || petite.avant[2] < 400, 'petite photo (moins de 400 Ko) : gardée telle quelle');
  const src = fs.readFileSync(chemin.resolve(__dirname, '../../js/publications-ecriture.js'), 'utf8');
  ok(/allegerPhotoSite\(fichier, 1600, 0\.85, 400 \* 1024\)/.test(src), 'actualités et événements : l’allègement est bien appelé avant l’envoi');
  await b.close(); srv.kill();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\n✅ Photos des actualités et événements allégées');
  process.exit(ko ? 1 : 0);
})();
