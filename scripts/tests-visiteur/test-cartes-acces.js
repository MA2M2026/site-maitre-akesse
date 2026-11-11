// Cartes d'événement (25/10/2026, demande de la propriétaire), comme l'agence, sur téléphone et
// ordinateur : rubrique « Cartes d'événement » du menu → choisir l'événement → seules les
// mannequins qui ont CONFIRMÉ leur présence (pas « sans réponse », pas « absente ») → ajouter une
// photo à celle qui n'en a pas (gardée, stockage privé) → toucher une mannequin : sa carte (PDF A5)
// → « Tous les badges » : quatre par feuille A4 (modèle « Couverture », 11/11/2026). Raccourci depuis l'Agenda.
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
    ok(/Événements/.test(compartiment) && /ABIDJAN BORDER FORUM/.test(await p.textContent('#contenu')), n + 'rubrique « Cartes d’événement » (compartiment « ' + compartiment + ' ») : choisir l’événement');
    await p.click('.ca-evenement:has-text("ABIDJAN BORDER FORUM")'); await p.waitForSelector('.ca-liste', { timeout: 15000 });
    const noms = await p.$$eval('.ca-nom', (l) => l.map((x) => x.textContent));
    ok(noms.join('|') === 'AYA KOUASSI|JEAN EXTÉRIEUR|MARIAM TRAORÉ', n + 'seulement les 3 confirmées, sans « Madame / Monsieur », par ordre alphabétique (' + noms.join(', ') + ') — pas celles sans réponse ni l’absente');
    ok(/N° 002/.test(await p.textContent('.ca-carte:nth-child(2)')) && await p.isChecked('input[name="ca-logo"][value="aucun"]') && /^#[0-9a-f]{6}$/i.test(await p.inputValue('#ca-voile')) && await p.isHidden('#ca-logo-partenaire'),
      n + 'numéros N° 001, 002… ; badge : aucun logo par défaut, couleur du voile proposée');
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
    ok(/^%PDF/.test(une.texte) && (une.texte.match(/\/Type \/Page\b/g) || []).length === 1 && /\/MediaBox \[0 0 297\.6\d* 420\.9/.test(une.texte) && /^badge-jean-exterieur-abidjan-border-forum/.test(une.nom),
      n + 'toucher JEAN EXTÉRIEUR : son badge seul, un quart de A4 (' + une.nom + ')');
    ok(journal.some((j) => j[0] === 'TELECHARGE' && /c-x1\//.test(j[1])), n + 'sa carte prend la photo ajoutée');
    // 4. Tous les badges : quatre par feuille A4 ; logo du partenaire et couleur choisis
    await p.check('input[name="ca-logo"][value="partenaire"]'); await p.waitForTimeout(300);
    ok(await p.isVisible('#ca-logo-partenaire'), n + '« Logo du partenaire » : la zone pour téléverser son logo apparaît');
    await p.check('input[name="ca-logo"][value="agence"]');
    await p.fill('#ca-voile', '#1f4e8c');
    const avant = (await p.evaluate(() => window.__feuilles.length));
    const toutes = await pdfDe(p, () => p.click('[data-action="cartes-toutes"]'));
    ok((toutes.texte.match(/\/Type \/Page\b/g) || []).length === 1 && /\/MediaBox \[0 0 595\.2\d* 841\.8/.test(toutes.texte) && /^badges-/.test(toutes.nom), n + '« Tous les badges » : 3 badges → 1 feuille A4 (4 par feuille)');
    await p.waitForTimeout(400);
    ok(/3 badges prêts/.test(await p.textContent('body')), n + 'message « 3 badges prêts »');
    if (process.env.APERCU && !tel) (await p.evaluate(() => window.__feuilles)).forEach((f, i) => fs.writeFileSync(path.join(process.env.APERCU, 'feuille-' + i + '.jpg'), Buffer.from(f.split(',')[1], 'base64')));
    ok((await p.evaluate(() => window.__feuilles.length)) - avant === 1, n + '1 feuille dessinée');
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
