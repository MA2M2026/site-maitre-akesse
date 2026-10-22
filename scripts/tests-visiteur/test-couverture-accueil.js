// Couverture de l'accueil « Magazine » (20/10/2026, demande de la propriétaire) : les photos de tous
// les mannequins défilent en continu (fondu toutes les 5 s), le nom « En couverture » suit, la
// version moyenne de chaque photo est utilisée ; immobile si le visiteur a demandé moins
// d'animations. Français et anglais. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path');
const PORT = String(9500 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const IMAGE = Buffer.from('R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=', 'base64');
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  const profils = Array.from({ length: 5 }, (_, i) => ({ id: 'm' + i, full_name: 'Mannequin ' + i, city: 'Abidjan', category: 'femme', published: true, featured: i === 0 }));
  const donnees = { tables: { model_profiles: profils, model_photos: profils.map((m) => ({ model_id: m.id, url_miniature: 'https://x/' + m.id + '.jpg', url_moyenne: 'https://x/' + m.id + '-moy.jpg' })) },
    rpc: { photos_couverture_mannequins: profils.map((m) => ({ model_id: m.id, url: 'https://x/' + m.id + '.jpg' })) } };
  for (const [page, reduit] of [['index.html', false], ['en/index.html', false], ['index.html', true]]) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: reduit ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, donnees, []);
    await p.route(/^https:\/\/x\//, (r) => r.fulfill({ status: 200, contentType: 'image/gif', body: IMAGE }));
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(2000);
    const releves = [];
    for (let k = 0; k < 3; k++) {
      releves.push(await p.evaluate(() => { const v = document.querySelector('.p-couv .mag-cadre img.visible'); return { image: v ? v.src.replace(/.*\//, '') : '', nom: document.getElementById('couv-modele-nom').textContent }; }));
      await p.waitForTimeout(5500);
    }
    const images = new Set(releves.map((r) => r.image)), libelle = page + (reduit ? ' (moins d’animations)' : '');
    if (reduit) ok(images.size === 1, libelle + ' : la couverture reste immobile');
    else {
      ok(images.size === 3, libelle + ' : les photos des mannequins défilent (' + releves.map((r) => r.image).join(', ') + ')');
      ok(releves.every((r) => /-moy\.jpg$/.test(r.image) && r.image.replace('-moy.jpg', '') === 'm' + r.nom.replace('Mannequin ', '')), libelle + ' : version moyenne de la photo, nom « En couverture » qui suit');
    }
    const cadrages = await p.evaluate(() => ['agence-img', 'dos-img'].map((id) => getComputedStyle(document.getElementById(id)).objectPosition));
    ok(cadrages.every((c) => c === '50% 12%'), libelle + ' : photos des bandeaux « agence » et « dos » calées sur le visage (' + cadrages.join(', ') + ')');
    // Sommaire en hauteur (tablette) : photo en « tirage » avec le nom du mannequin, lignes qui ne la touchent pas
    await p.setViewportSize({ width: 800, height: 1120 }); await p.waitForTimeout(400);
    const tirage = await p.evaluate(() => {
      const v = document.querySelector('.p-sommaire .vignette').getBoundingClientRect(), t = document.getElementById('sommaire-titre').getBoundingClientRect();
      const lignes = [...document.querySelectorAll('#sommaire-liste li')].map((li) => li.getBoundingClientRect()).filter((r) => r.top < v.bottom && r.bottom > v.top);
      return { nom: document.getElementById('sommaire-legende').textContent, aCote: lignes.length > 0 && lignes.every((r) => r.right <= v.left), titre: t.right <= v.left && t.top < v.bottom };
    });
    ok(/^Mannequin \d$/.test(tirage.nom), libelle + ' : nom du mannequin sous la photo du sommaire (' + tirage.nom + ')');
    ok(tirage.aCote && tirage.titre, libelle + ' : titre et lignes du sommaire à côté de la photo, sans la toucher');
    ok(!errs.length, libelle + ' : aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
