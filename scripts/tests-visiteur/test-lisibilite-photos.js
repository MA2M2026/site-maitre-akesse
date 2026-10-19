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
  for (const photo of process.env.PAGES ? [] : ['photo-sombre.jpg', 'photo-rayures.jpg']) {
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
  // 2. Tout le site : chaque texte posé sur une photo ou une vidéo (repéré sous le texte), sur la
  // pire photo (rayures), téléphone et tablette, de haut en bas de chaque page publique
  const { tables, rpc, pages } = require('./pages-publiques');
  const rayures = fs.readFileSync(path.join(__dirname, 'medias', 'photo-rayures.jpg'));
  // PAGES=index.html,en/index.html : seulement ces pages (pour corriger vite)
  for (const page of pages.filter((x) => !process.env.PAGES || process.env.PAGES.split(',').includes(x))) {
    for (const ecran of ecrans.slice(0, 2)) {
      const ctx = await b.newContext({ viewport: { width: ecran.width, height: ecran.height } });
      const p = await ctx.newPage();
      await p.emulateMedia({ reducedMotion: 'reduce' });
      await p.addInitScript(() => { try { sessionStorage.setItem('ma2m_porte_ouverte', '1'); sessionStorage.setItem('ma2m_intro_vue', '1'); localStorage.setItem('ma2m_cookies', 'non'); } catch (e) { /* stockage bloqué */ } });
      await brancher(p, { tables: JSON.parse(JSON.stringify(Object.assign({}, tables, donnees().tables, { model_profiles: tables.model_profiles }))), rpc }, []);
      await p.route(/^https:\/\/x\//, (r) => r.fulfill({ status: 200, contentType: 'image/jpeg', body: rayures }));
      await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await p.waitForTimeout(1800);
      const h = await p.evaluate(() => document.documentElement.scrollHeight);
      const mauvais = new Map();
      for (let y = 0; y < h; y += Math.round(ecran.height * 0.8)) {
        await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await p.waitForTimeout(350);
        // textes visibles posés sur une image, une vidéo ou un fond photo
        const cibles = await p.evaluate(() => {
          const res = [];
          // (un texte recouvert, par exemple par la barre du haut fixe, n'est pas mesuré à cet endroit)
          const surImage = (el, x, y) => { const pile = document.elementsFromPoint(x, y); const i = pile.indexOf(el);
            if (i < 0 || (pile[0] !== el && !el.contains(pile[0]))) return false;
            return pile.slice(i + 1).some((d) => /^(IMG|VIDEO|CANVAS)$/.test(d.tagName) || /url\(/.test(getComputedStyle(d).backgroundImage)); };
          document.querySelectorAll('body *').forEach((el) => {
            if (res.length > 40 || el.closest('button, .btn, [role=button], .whatsapp-flottant, .lang-switch')) return;
            const propre = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
            if (!propre) return;
            const r = el.getBoundingClientRect(), s = getComputedStyle(el);
            if (r.width < 4 || r.height < 4 || r.top < 0 || r.bottom > innerHeight || s.visibility === 'hidden' || Number(s.opacity) < 0.1) return;
            if (!surImage(el, r.left + Math.min(r.width / 2, 40), r.top + r.height / 2)) return;
            const fs = parseFloat(s.fontSize), gras = Number(s.fontWeight) >= 700;
            el.dataset.essaiLisible = String(res.length);
            res.push({ i: res.length, texte: el.textContent.trim().slice(0, 30) + (el.className && typeof el.className === 'string' ? ' (' + el.className.split(' ')[0] + ')' : ''), rgb: s.color.match(/[\d.]+/g).map(Number).slice(0, 3), grand: fs >= 24 || (fs >= 18.66 && gras),
              x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(r.right, innerWidth) - Math.max(0, r.left), h: Math.min(r.bottom, innerHeight) - Math.max(0, r.top) });
          });
          document.querySelectorAll('[data-essai-lisible]').forEach((el) => { el.style.setProperty('color', 'transparent', 'important'); el.style.setProperty('text-shadow', 'none', 'important'); });
          return res;
        });
        if (!cibles.length) continue;
        const capture = (await p.screenshot()).toString('base64');
        const resultats = await p.evaluate(async ({ b64, cibles }) => {
          document.querySelectorAll('[data-essai-lisible]').forEach((el) => { el.style.removeProperty('color'); el.style.removeProperty('text-shadow'); delete el.dataset.essaiLisible; });
          const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
          const k = img.width / innerWidth;
          const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          const lum = (r, gg, bb) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(bb);
          return cibles.map((t) => {
            if (t.w < 2 || t.h < 2) return null;
            const d = g.getImageData(Math.round(t.x * k), Math.round(t.y * k), Math.max(1, Math.round(t.w * k)), Math.max(1, Math.round(t.h * k))).data;
            const lt = lum(t.rgb[0], t.rgb[1], t.rgb[2]); const rap = [];
            for (let i = 0; i < d.length; i += 16) { const lb = lum(d[i], d[i + 1], d[i + 2]); rap.push((Math.max(lt, lb) + 0.05) / (Math.min(lt, lb) + 0.05)); }
            rap.sort((a, bb) => a - bb);
            const contraste = rap[Math.floor(rap.length * 0.1)], seuil = t.grand ? 3 : 4.5;
            // capture de la zone fautive (dossier captures/), pour voir le défaut comme un visiteur
            let image = null;
            if (contraste < seuil) { const z = document.createElement('canvas'); z.width = Math.round(t.w * k); z.height = Math.round(t.h * k); z.getContext('2d').drawImage(c, Math.round(t.x * k), Math.round(t.y * k), z.width, z.height, 0, 0, z.width, z.height); image = z.toDataURL('image/png').split(',')[1]; }
            return { texte: t.texte, contraste, seuil, image };
          }).filter(Boolean);
        }, { b64: capture, cibles });
        resultats.filter((r) => r.contraste < r.seuil).forEach((r) => {
          mauvais.set(r.texte, r);
          try { fs.mkdirSync(path.join(__dirname, 'captures'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'captures', 'illisible-' + page.replace(/[^a-z0-9]+/gi, '_') + '-' + ecran.width + '-' + mauvais.size + '.png'), Buffer.from(r.image, 'base64')); } catch (e) { /* capture facultative */ }
        });
      }
      ok(!mauvais.size, page + ' · ' + ecran.nom + ' : textes sur photo lisibles' + [...mauvais.values()].map((r) => ' | « ' + r.texte + ' » ' + r.contraste.toFixed(2)).join(''));
      await ctx.close();
    }
  }

  await b.close(); srv.kill();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ÉCHEC', e.stack); process.exit(1); });
