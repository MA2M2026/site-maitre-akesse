// « Mon programme » d'une élève de l'Atelier Talons & Élégance (programme.html, 13/11/2026, maquette validée) : comme
// l'élève qui ouvre son lien WhatsApp, sur téléphone et ordinateur. Sa photo ou ses initiales, « Bienvenue, Prénom », un
// calendrier avec ses jours de cours, ses 4 séances (date, heure, thème, lieu), l'itinéraire, ce qu'il faut prévoir,
// « Ajouter à mon calendrier » (fichier .ics avec les séances et un rappel la veille). Lien faux ou inscription non
// payée : un message clair, rien d'autre. Rien de la base n'est lu comme du HTML. Base SIMULÉE.
const { chromium, devices } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path'); const fs = require('fs');
const PORT = String(9960 + Math.floor(Math.random() * 30));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const J = '11111111-2222-3333-4444-555555555555';
const S = (j, th) => ({ debut: '2026-' + j + 'T15:00:00+00:00', fin: '2026-' + j + 'T18:00:00+00:00', lieu: 'Salle MA2M, Riviera Faya, Abidjan', theme: th, statut: 'prevue' });
const PROG = { prenom: 'Mariam', nom: 'Mariam <b>Traoré</b>', formule: 'groupe', nb_seances: 4, statut: 'inscrite', photo: null,
  seances: [S('11-15', 'Posture et équilibre'), S('11-22', 'Démarche et port de tête'), S('11-29', 'Fluidité et tours'), S('12-06', 'Défilé final')],
  salle_nom: 'Salle MA2M', salle_adresse: 'Riviera Faya, Abidjan', salle_maps: 'https://maps.app.goo.gl/essai', a_prevoir: ['Talons de 7 à 10 cm', 'Tenue près du corps'] };
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [appareil, opts] of [['téléphone', devices['iPhone 13']], ['ordinateur', { viewport: { width: 1280, height: 900 } }]]) {
    const ctx = await b.newContext(Object.assign({ acceptDownloads: true }, opts)); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const appels = [];
    await brancher(p, { tables: {}, rpc: { talons_programme_lire: (c) => { appels.push(c); return c.p_jeton === J ? PROG : null; } } }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/programme.html?j=' + J);
    await p.waitForSelector('#pg-contenu:not([hidden])', { timeout: 10000 }).catch(() => {});
    const n = appareil + ' : ';
    ok(appels.length === 1 && appels[0].p_jeton === J, n + 'le programme est lu par le seul lien personnel');
    ok((await p.textContent('#pg-titre')) === 'Bienvenue, Mariam', n + '« Bienvenue, Mariam »');
    ok(/^MT|^M</.test(await p.textContent('#pg-ini')) && !(await p.$('#pg-contenu b b')), n + 'initiales à la place de la photo, et le nom n’est jamais lu comme du HTML');
    const cours = await p.$$eval('.pg-cal .d.cours', (l) => l.map((x) => x.textContent));
    ok(cours.join(',') === '15,22,29,6', n + 'calendrier : ses 4 jours de cours en couleur (' + cours.join(', ') + ')');
    ok((await p.$$('.pg-mois')).length === 2, n + 'deux mois affichés (novembre et décembre)');
    const seances = await p.$$eval('.pg-seance .t b', (l) => l.map((x) => x.textContent));
    ok(seances.length === 4 && seances[0] === 'Séance 1 · Posture et équilibre' && seances[3] === 'Séance 4 · Défilé final', n + 'ses 4 séances avec leur thème');
    ok(/15 h – 18 h/.test(await p.textContent('#pg-seances')), n + 'les heures : 15 h – 18 h');
    ok(await p.getAttribute('#pg-lieux a', 'href') === 'https://maps.app.goo.gl/essai', n + 'le lieu, avec l’itinéraire Google Maps de la salle');
    ok((await p.$$eval('#pg-prevoir span', (l) => l.length)) === 2, n + 'ce qu’il faut prévoir');
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.click('#pg-ajouter')]);
    let texte = '';
    if (dl) { const f = await dl.path(); texte = f ? fs.readFileSync(f, 'utf8') : ''; }
    ok(dl && /\.ics$/.test(dl.suggestedFilename()) && (texte.match(/BEGIN:VEVENT/g) || []).length === 4 && /DTSTART:20261115T150000Z/.test(texte) && /TRIGGER:-P1D/.test(texte),
      n + '« Ajouter à mon calendrier » : un fichier .ics avec ses 4 séances et un rappel la veille');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), n + 'rien ne déborde sur le côté');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    // lien faux : un message clair
    await p.goto('http://127.0.0.1:' + PORT + '/programme.html?j=00000000-0000-0000-0000-000000000000'); await p.waitForTimeout(800);
    ok(/introuvable/.test(await p.textContent('#pg-etat')) && await p.isHidden('#pg-contenu'), n + 'lien faux : « programme introuvable », rien d’autre');
    await p.goto('http://127.0.0.1:' + PORT + '/programme.html?j=<script>'); await p.waitForTimeout(400);
    ok(/introuvable/.test(await p.textContent('#pg-etat')), n + 'lien abîmé : refusé sans rien demander');
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ Mon programme (Atelier talons) : tout est bon'); process.exit(ko ? 1 : 0);
})();
