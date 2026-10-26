// Textes de l'Administration en anglais sur les pages anglaises (26/10/2026, demande de la
// propriétaire), comme un visiteur puis comme l'agence, base SIMULÉE (rien n'est écrit pour de vrai) :
//  - page anglaise des actualités : la traduction s'affiche ; sans traduction, le français reste ;
//    la page française ne change pas ;
//  - Administration › Traductions anglaises : les textes à traduire d'abord, écrire l'anglais,
//    l'enregistrement passe par traduction_enregistrer (supabase-traductions.sql).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const crypto = require('crypto'), chemin = require('path');
const PORT = String(9600 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const cle = (t) => crypto.createHash('sha256').update(String(t).replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, ''), 'utf8').digest('hex');
const ACTUS = [
  { id: 'a1', titre: 'CASTING NEWFACE', commentaire: 'Participez à nos castings de chaque dimanche', categorie: 'Casting', created_at: '2026-10-20T10:00:00Z', image_url: null },
  { id: 'a2', titre: 'DÉFILÉ SANS TRADUCTION', commentaire: 'Ce texte reste en français', categorie: 'Événements', created_at: '2026-10-19T10:00:00Z', image_url: null }
];
const TRADUCTIONS = [{ cle: cle('CASTING NEWFACE'), en: 'NEW FACE CASTING' }, { cle: cle('Participez à nos castings de chaque dimanche'), en: 'Join our castings every Sunday' }];

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  // 1) visiteur : pages anglaise et française des actualités
  for (const [page, vp, nom] of [['en/actualites.html', { width: 390, height: 844 }, 'EN téléphone'], ['en/actualites.html', { width: 1280, height: 900 }, 'EN ordinateur'], ['actualites.html', { width: 390, height: 844 }, 'FR téléphone']]) {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await brancher(p, { tables: { actualites: ACTUS.map((x) => ({ ...x })), actualite_photos: [], traductions_en: TRADUCTIONS }, rpc: {} }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
    const t = await p.evaluate(() => document.body.innerText);
    if (/^en\//.test(page)) {
      ok(/NEW FACE CASTING/.test(t) && !/CASTING NEWFACE/.test(t), nom + ' : le titre traduit s’affiche en anglais');
      ok(/DÉFILÉ SANS TRADUCTION/.test(t), nom + ' : sans traduction, le texte français reste');
    } else ok(/CASTING NEWFACE/.test(t) && !/NEW FACE CASTING/.test(t), nom + ' : la page française garde le français');
    ok(!errs.length, nom + ' : aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  // 2) l'agence : Administration › Traductions anglaises
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept());
    const d = donnees('principal');
    d.tables.actualites = ACTUS.map((x) => ({ ...x }));
    d.tables.mot_responsable = [{ id: 'principal', nom: 'Franck Akesse', titre: 'Fondateur', message: 'Bienvenue chez MA2M.', photo_url: null }];
    d.tables.traductions_en = TRADUCTIONS;
    d.rpc.traduction_enregistrer = null;
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, 'http://127.0.0.1:' + PORT + '/admin/'); await p.waitForSelector('.accueil-tete');
    await p.goto('http://127.0.0.1:' + PORT + '/admin/#/site/b3c-traductions'); await p.waitForSelector('#contenu .entete', { timeout: 8000 });
    const t = await p.textContent('#contenu');
    ok(/Traductions anglaises/.test(t) && /à traduire/.test(t) && /Traduit/.test(t), n + 'la liste : textes traduits et à traduire');
    const etats = await p.$$eval('#contenu tbody tr td:nth-child(3)', (l) => l.map((x) => x.textContent.trim()));
    ok(etats[0] === 'À traduire' && etats[etats.length - 1] === 'Traduit', n + 'les textes à traduire d’abord');
    // traduire le mot du fondateur (texte simple)
    const ligne = p.locator('#contenu tbody tr', { hasText: 'Bienvenue chez MA2M.' });
    await ligne.locator('a.btn').click(); await p.waitForSelector('#tr-en', { timeout: 8000 });
    ok(/Bienvenue chez MA2M\./.test(await p.textContent('#contenu')), n + 'l’écran montre le texte français');
    await p.fill('#tr-en', 'Welcome to MA2M.'); await p.click('form[data-form="traduction-enregistrer"] button[type="submit"]'); await p.waitForTimeout(1000);
    const envoi = journal.filter((j) => j[0] === 'rpc' && j[1] === 'traduction_enregistrer').map((j) => JSON.parse(j[2]));
    ok(envoi.length === 1 && envoi[0].p_fr === 'Bienvenue chez MA2M.' && envoi[0].p_en === 'Welcome to MA2M.', n + 'enregistrer : la traduction part par traduction_enregistrer (français et anglais)');
    ok(/#\/site\/b3c-traductions$/.test(p.url()), n + 'retour à la liste après l’enregistrement');
    ok(!journal.some((j) => /traductions_en/.test(j[1] || '') && j[0] !== 'GET'), n + 'jamais d’écriture directe dans la table');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
