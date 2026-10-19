// Texte posé sur une photo (19/10/2026, signalé par la propriétaire sur tablette : la ligne sous le
// nom du mannequin à la une et le bloc « Mot de Maître Akesse » étaient illisibles). Le contrôle
// de test-visuel.js compare le texte à la couleur du fond, pas à l'image : ici on regarde comme un
// visiteur. Pour chaque texte posé sur une photo, on le rend invisible, on photographie ce qu'il y
// a dessous (photo + voile), puis on mesure le contraste entre la couleur du texte et ces pixels.
// Deux photos d'essai : très sombre, et rayures noir/blanc (comme une tenue rayée). Téléphone,
// tablette et ordinateur, FR et EN. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const fs = require('fs'); const path = require('path');
const RACINE = path.resolve(__dirname, '../..');
const PORT = String(8700 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const TEXTES = ['#vedette-nom', '#vedette-info', '.vedette-cta', '#mot-responsable .eyebrow', '#mot-resp-nom', '#mot-resp-titre'];
const ecrans = [{ nom: 'téléphone', width: 390, height: 844 }, { nom: 'tablette', width: 1000, height: 1400 }, { nom: 'ordinateur', width: 1280, height: 900 }];

function donnees() {
  return {
    tables: {
      model_profiles: [{ id: 'a1', full_name: 'Bolli', city: 'Yopougon', height_cm: 180, category: 'femme', genre: 'femme', published: true, featured: true, slug: 'bolli' }],
      model_photos: [{ id: 'p1', model_id: 'a1', url: 'https://x/photo.jpg', principale: true, categorie: 'book' }],
      mot_responsable: [{ id: 'principal', nom: 'Maître Akesse', titre: 'DA', message: 'Chaque grand parcours commence par un rêve.', photo_url: 'https://x/photo.jpg' }],
      actualites: [], evenements: [], partenaires: [], bandeau_annonce: [], instagram_posts_cache: [], admins: []
    },
    rpc: { photos_couverture_mannequins: [{ model_id: 'a1', url: 'https://x/photo.jpg' }] }
  };
}

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE }); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const photo of ['photo-sombre.jpg', 'photo-rayures.jpg']) {
    const image = fs.readFileSync(path.join(__dirname, 'medias', photo));
    for (const page of ['index.html', 'en/index.html']) {
      for (const ecran of ecrans) {
        const ctx = await b.newContext({ viewport: { width: ecran.width, height: ecran.height } });
        const p = await ctx.newPage();
        await p.emulateMedia({ reducedMotion: 'reduce' });
        await p.addInitScript(() => { try { sessionStorage.setItem('ma2m_porte_ouverte', '1'); sessionStorage.setItem('ma2m_intro_vue', '1'); localStorage.setItem('ma2m_cookies', 'non'); } catch (e) { /* stockage bloqué */ } });
        await brancher(p, donnees(), []);
        await p.route(/^https:\/\/x\//, (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: image }));
        await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' });
        await p.waitForTimeout(2500);
        const libelle = page + ' · ' + ecran.nom + ' · ' + photo.replace(/photo-|\.jpg/g, '');
        let vus = 0;
        for (const sel of TEXTES) {
          const el = await p.$(sel);
          if (!el || !(await el.isVisible()) || !((await el.textContent()) || '').trim()) continue;
          await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
          const info = await el.evaluate((e) => {
            const s = getComputedStyle(e), r = e.getBoundingClientRect();
            const m = s.color.match(/[\d.]+/g).map(Number);
            const fs = parseFloat(s.fontSize), gras = Number(s.fontWeight) >= 700;
            e.dataset.couleurAvant = e.style.color; e.style.setProperty('color', 'transparent', 'important'); e.style.setProperty('text-shadow', 'none', 'important');
            return { rgb: m.slice(0, 3), grand: fs >= 24 || (fs >= 18.66 && gras), x: r.left, y: r.top, w: r.width, h: r.height };
          });
          const clip = { x: Math.max(0, info.x), y: Math.max(0, info.y), width: Math.max(1, Math.min(info.w, ecran.width - info.x)), height: Math.max(1, info.h) };
          const capture = await p.screenshot({ clip });
          await el.evaluate((e) => { e.style.color = e.dataset.couleurAvant || ''; e.style.removeProperty('text-shadow'); });
          // contraste de la couleur du texte avec chaque pixel dessous ; on retient le 10e pire centile
          const pire = await p.evaluate(async ({ b64, rgb }) => {
            const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            const g = c.getContext('2d'); g.drawImage(img, 0, 0);
            const d = g.getImageData(0, 0, c.width, c.height).data;
            const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
            const lum = (r, gg, bb) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(bb);
            const lt = lum(rgb[0], rgb[1], rgb[2]);
            const rapports = [];
            for (let i = 0; i < d.length; i += 16) { const lb = lum(d[i], d[i + 1], d[i + 2]); rapports.push((Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05)); }
            rapports.sort((a, bb) => a - bb);
            return rapports[Math.floor(rapports.length * 0.1)];
          }, { b64: capture.toString('base64'), rgb: info.rgb });
          const seuil = info.grand ? 3 : 4.5;
          ok(pire >= seuil, libelle + ' : « ' + sel + ' » lisible sur la photo (contraste ' + pire.toFixed(2) + ', minimum ' + seuil + ')');
          vus++;
        }
        ok(vus >= 4, libelle + ' : les textes posés sur les photos ont bien été contrôlés (' + vus + ')');
        await ctx.close();
      }
    }
  }
  await b.close(); srv.kill();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ÉCHEC', e.stack); process.exit(1); });
