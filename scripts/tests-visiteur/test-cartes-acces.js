// Cartes d'événement (25/10/2026, demande de la propriétaire), comme l'agence, sur téléphone et
// ordinateur : rubrique « Cartes d'événement » du menu → choisir l'événement → seules les
// mannequins qui ont CONFIRMÉ leur présence (pas « sans réponse », pas « absente ») → ajouter une
// photo à celle qui n'en a pas (gardée, stockage privé) → toucher une mannequin : sa carte (PDF A5)
// → « Toutes les cartes » : deux par feuille A4 couchée. Raccourci depuis l'Agenda.
// Base simulée : rien n'est écrit pour de vrai. APERCU=dossier : garde l'image des feuilles.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const fs = require('fs'), path = require('path');
const PORT = String(9600 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
let srv; process.on('exit', () => srv && srv.kill());
const pdfDe = async (p, clic) => {
  const [t] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), clic()]);
  return { nom: t.suggestedFilename(), texte: fs.readFileSync(await t.path()).toString('latin1') };
};
(async () => {
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block', acceptDownloads: true });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    // les feuilles dessinées (images JPEG) sont gardées pour les vérifier
    await p.addInitScript(() => {
      window.__feuilles = [];
      const avant = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (...a) { const r = avant.apply(this, a); if (this.width > 1000) window.__feuilles.push(r); return r; };
    });
    const d = donnees('principal');
    d.tables.contacts_externes = [{ id: 'x1', civilite: 'Monsieur', nom: 'JEAN EXTÉRIEUR', mannequin_id: null }, { id: 'x2', civilite: 'Madame', nom: 'AMY ABSENTE', mannequin_id: null }];
    d.tables.convocation_participants.push({ id: 'cp9', projet_id: 'p1', model_id: null, contact_id: 'x1', nom: 'Monsieur JEAN EXTÉRIEUR', parent: false, reponse: 'confirme' },
      { id: 'cp10', projet_id: 'p1', model_id: null, contact_id: 'x2', nom: 'Madame AMY ABSENTE', parent: false, reponse: 'absent' });
    d.tables.cartes_photos = [];
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');

    // 1. Le menu : « Cartes d'événement », choisir l'événement
    await p.goto(URL_ADMIN + '#/site/b2-cartes'); await p.waitForSelector('.ca-evenement', { timeout: 15000 });
    const compartiment = await p.evaluate(() => { const a = document.querySelector('.lateral .nav.actif'), c = a && a.closest('.compartiment'); return c ? c.getAttribute('aria-label') : ''; });
    ok(compartiment === 'Projets et convocations' && /ABIDJAN BORDER FORUM/.test(await p.textContent('#contenu')), n + 'rubrique « Cartes d’événement » (compartiment « ' + compartiment + ' ») : choisir l’événement');
    await p.click('.ca-evenement:has-text("ABIDJAN BORDER FORUM")'); await p.waitForSelector('.ca-liste', { timeout: 15000 });
    const noms = await p.$$eval('.ca-nom', (l) => l.map((x) => x.textContent));
    ok(noms.join('|') === 'AYA KOUASSI|JEAN EXTÉRIEUR|MARIAM TRAORÉ', n + 'seulement les 3 confirmées, sans « Madame / Monsieur », par ordre alphabétique (' + noms.join(', ') + ') — pas celles sans réponse ni l’absente');
    ok(/N° 002/.test(await p.textContent('.ca-carte:nth-child(2)')) && await p.inputValue('#ca-organisateur') === 'Maître Akesse Model Management', n + 'numéros N° 001, 002… ; « Organisé par » : l’agence par défaut');
    ok((await p.$$('.ca-photo')).length === 1 && /Ajouter une photo/.test(await p.textContent('.ca-carte:nth-child(2)')), n + '« Ajouter une photo » seulement pour celle qui n’en a pas (JEAN EXTÉRIEUR)');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran');
    // 2. Ajouter sa photo : gardée dans le stockage privé
    await p.setInputFiles('.ca-carte:nth-child(2) input[type=file]', path.join(__dirname, 'medias/photo1.jpg')); await p.waitForTimeout(2500);
    const depot = journal.find((j) => j[0] === 'STOCKAGE' && /^cartes-photos\/c-x1\/[0-9-]+\.jpg$/.test(j[1]));
    ok(depot && d.tables.cartes_photos.some((x) => x.cle === 'c:x1'), n + 'photo ajoutée : JPEG dans le stockage privé des cartes, retrouvée la prochaine fois');
    ok(/Changer la photo/.test(await p.textContent('.ca-carte:nth-child(2)')), n + 'ensuite : « Changer la photo »');
    // 3. Toucher une mannequin : sa carte seule (A5)
    d.fichiers = { [depot[1]]: { type: 'image/jpeg', octets: fs.readFileSync(path.join(__dirname, 'medias/photo1.jpg')) } };
    const une = await pdfDe(p, () => p.click('.ca-carte:nth-child(2) [data-action="carte-une"]'));
    ok(/^%PDF/.test(une.texte) && (une.texte.match(/\/Type \/Page\b/g) || []).length === 1 && /\/MediaBox \[0 0 420\.94\d* 595\.2/.test(une.texte) && /^carte-jean-exterieur-abidjan-border-forum/.test(une.nom),
      n + 'toucher JEAN EXTÉRIEUR : sa carte seule, une page A5 (' + une.nom + ')');
    ok(journal.some((j) => j[0] === 'TELECHARGE' && /c-x1\//.test(j[1])), n + 'sa carte prend la photo ajoutée');
    // 4. Toutes les cartes : deux par feuille A4 couchée
    await p.fill('#ca-organisateur', 'Maison Ivoire');
    const avant = (await p.evaluate(() => window.__feuilles.length));
    const toutes = await pdfDe(p, () => p.click('[data-action="cartes-toutes"]'));
    ok((toutes.texte.match(/\/Type \/Page\b/g) || []).length === 2 && /\/MediaBox \[0 0 841\.8\d* 595\.2/.test(toutes.texte), n + '« Toutes les cartes » : 3 cartes → 2 feuilles A4 couchées');
    ok((toutes.texte.match(/mannequin\.html\?id=/g) || []).length === 2, n + 'QR code cliquable vers la fiche, pour les 2 profils publiés seulement');
    await p.waitForTimeout(400);
    ok(/3 cartes prêtes/.test(await p.textContent('body')), n + 'message « 3 cartes prêtes »');
    if (process.env.APERCU && !tel) (await p.evaluate(() => window.__feuilles)).forEach((f, i) => fs.writeFileSync(path.join(process.env.APERCU, 'feuille-' + i + '.jpg'), Buffer.from(f.split(',')[1], 'base64')));
    ok((await p.evaluate(() => window.__feuilles.length)) - avant === 2, n + '2 feuilles dessinées');
    // 5. Raccourci depuis l'Agenda
    await p.goto(URL_ADMIN + '#/site/b3c-agenda'); await p.waitForSelector('[data-action="cartes-acces"][data-id="p1"]', { timeout: 15000 });
    await p.click('[data-action="cartes-acces"][data-id="p1"]'); await p.waitForSelector('.ca-liste', { timeout: 15000 });
    ok(/#\/site\/b2-cartes\/p1$/.test(p.url()), n + 'Agenda : « 🎫 Cartes » ouvre les cartes de cet événement');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
