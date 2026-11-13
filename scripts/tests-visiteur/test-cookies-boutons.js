// Bandeau des cookies sur téléphone (13/11/2026, revue de nuit) : tant qu'il est affiché, les boutons collés en bas
// (retour en haut, WhatsApp, « Réserver » / « Compcard » de la fiche) montent au-dessus de lui au lieu d'être cachés ;
// une fois le choix fait, ils reviennent à leur place. Aucun saut d'affichage. Base SIMULÉE.
const { chromium, devices } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path');
const PORT = String(9890 + Math.floor(Math.random() * 9));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  // fiche d'une mannequin (barre « Réserver » / « Compcard » collée en bas sur téléphone)
  const photos = Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i, model_id: 'a1', url: '/icons/apple-touch-icon.png', url_miniature: '/icons/apple-touch-icon.png', principale: i === 0, compcard_ordre: i > 0 && i < 6 ? i : null, created_at: '2026-01-1' + i + 'T10:00:00Z' }));
  const fiche = { model_profiles: [{ id: 'a1', full_name: 'Awa Koné', city: 'Abidjan', height_cm: 178, category: 'femme', published: true, slug: 'awa-kone', chest_cm: 80, waist_cm: 61, hips_cm: 90, shoe_size: '40' }], model_photos: photos, model_projects: [], bandeau_annonce: [], admins: [] };
  for (const page of ['index.html', 'en/index.html', 'contact.html', 'mannequin.html?id=a1', 'en/mannequin.html?id=a1']) {
    const ctx = await b.newContext(devices['iPhone 13']); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables: /mannequin\.html/.test(page) ? fiche : {}, rpc: { ages_mannequins: [{ id: 'a1', age: 21 }], mesures_supp_publiques: [] } }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForSelector('#bandeau-cookies', { timeout: 8000 }).catch(() => {});
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
    await p.waitForTimeout(800);
    const cache = () => p.evaluate(() => [...document.querySelectorAll('.retour-haut, .whatsapp-flottant, .fiche-barre a, .fiche-barre button')].filter((e) => { const cs = getComputedStyle(e); return (e.offsetParent || cs.position === 'fixed') && cs.opacity !== '0' && cs.pointerEvents !== 'none' && cs.visibility !== 'hidden'; }).map((e) => {
      const q = e.getBoundingClientRect(); if (!q.width || q.bottom < 0 || q.top > innerHeight) return null;
      const d = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
      return d && d !== e && !e.contains(d) && !d.contains(e) && d.closest('#bandeau-cookies') ? (e.className || e.tagName) : null;
    }).filter(Boolean));
    if (/mannequin\.html/.test(page)) ok(await p.isVisible('.fiche-barre'), page + ' : barre « Réserver / Compcard » visible en bas');
    const avant = await cache();
    ok(await p.isVisible('#bandeau-cookies') && !avant.length, page + ' : bandeau affiché, aucun bouton du bas caché dessous ' + avant.join(', '));
    await p.click('#bandeau-cookies [data-cookies="non"]'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--hauteur-cookies').trim()) === '0px', page + ' : choix fait → les boutons reviennent à leur place');
    ok(!errs.length, page + ' : aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  // ordinateur : le bandeau est une carte centrée, il ne cache pas les boutons des côtés, rien ne bouge
  { const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
    await brancher(p, { tables: {}, rpc: {} }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await p.waitForSelector('#bandeau-cookies', { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(500);
    ok(await p.$eval('.retour-haut', (e) => getComputedStyle(e).translate) === 'none', 'ordinateur : les boutons des côtés restent à leur place (bandeau centré)');
    await ctx.close(); }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ bandeau des cookies : tout est bon'); process.exit(ko ? 1 : 0);
})();
