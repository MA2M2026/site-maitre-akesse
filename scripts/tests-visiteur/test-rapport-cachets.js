// Comptabilité — « Rapport des cachets » (js/portail/espace-compta-cachets-rapport.js, 23/10/2026),
// comme l'agence, sur téléphone et ordinateur, base SIMULÉE : cachets payés du mois (totaux :
// prestations, commission, versé), par mannequin avec sa photo, détail ; période « toute l'année » ;
// PDF et Excel téléchargés et relus. Lecture seule : rien n'est écrit.
const { chromium } = require('playwright'); const { spawn, execFileSync } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, seConnecter, photosLocales } = require('./donnees-nouvelle-admin');
const PORT = String(9300 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const python = (code, chemin) => JSON.parse(execFileSync('python3', ['-I', '-c', code, chemin]).toString());
const LIRE_XLSX = 'import sys, json, openpyxl\nw = openpyxl.load_workbook(sys.argv[1])\nprint(json.dumps({n: [[c for c in r] for r in w[n].iter_rows(values_only=True)] for n in w.sheetnames}, default=str))';
const LIRE_PDF = 'import sys, json, pypdf\nr = pypdf.PdfReader(sys.argv[1])\nprint(json.dumps({"pages": len(r.pages), "texte": "\\n".join(p.extract_text() or "" for p in r.pages)}))';
const espaces = (t) => String(t).replace(/[  ]/g, ' ');

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  // ce mois-ci (Abidjan) et le mois d'avant, pour des essais qui marchent quel que soit le jour
  const ceMois = new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Abidjan' }).slice(0, 7);
  const avant = new Date(Date.UTC(+ceMois.slice(0, 4), +ceMois.slice(5) - 2, 15)).toISOString().slice(0, 7);
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block', acceptDownloads: true });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    const d = donnees('principal');
    const cachet = (id, qui, beneficiaire, prestation, commission, mois, extra) => Object.assign({ id, beneficiaire, agence_mannequin_id: qui, telephone: '2250700000010', montant_prestation: prestation, commission, commission_taux: 20,
      montant: prestation - commission, prestation: 'Défilé · ABIDJAN BORDER FORUM', motif: 'defile', statut: 'paye', mode: 'wave_manuel', compte_id: 'k2', paye_le: mois + '-10T10:00:00Z', cree_le: mois + '-09T10:00:00Z',
      numero_recu: 'MA2M-CA-' + mois.slice(0, 4) + '-00' + id.slice(-2), jeton: id.padEnd(36, '0') }, extra || {});
    d.tables.cachets_mannequins = [
      cachet('ca01', 'r0', 'AYA KOUASSI', 50000, 10000, ceMois),
      cachet('ca02', 'r0', 'AYA KOUASSI', 25000, 5000, ceMois, { motif: 'shooting', prestation: 'Shooting photo · Lagune' }),
      cachet('ca03', 'r2', 'GRÂCE YAO', 20000, 4000, ceMois, { parent_nom: 'Madame Yao Mère' }),
      cachet('ca04', null, 'Koné Styliste', 10000, 0, ceMois, { montant_prestation: null, commission: null, montant: 10000, motif: 'autre', prestation: 'Autre · Maquillage' }),
      cachet('ca05', 'r1', 'MARIAM TRAORÉ', 30000, 6000, avant),
      Object.assign(cachet('ca06', 'r1', 'MARIAM TRAORÉ', 99000, 9000, ceMois), { statut: 'a_payer', paye_le: null })];
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    await p.goto(URL_ADMIN + '#/compta/cachets-rapport'); await p.waitForSelector('#rc-periode', { timeout: 10000 }); await p.waitForTimeout(1200);
    ok(await p.$('#menu-lateral a.nav[href="#/compta/cachets-rapport"]') !== null, n + '« Rapport des cachets » dans le menu de la Comptabilité');
    const chiffres = espaces(await p.textContent('.chiffres'));
    ok(/Cachets payés\s*4/.test(chiffres) && /Montant des prestations\s*105 000 FCFA/.test(chiffres) && /Commission de l’agence\s*19 000 FCFA/.test(chiffres) && /Versé aux mannequins\s*86 000 FCFA/.test(chiffres),
      n + 'ce mois : 4 cachets payés, 105 000 de prestations, 19 000 de commission, 86 000 versés (le cachet à payer et celui du mois d’avant ne comptent pas) — ' + chiffres.replace(/\s+/g, ' '));
    const lignes = await p.$$eval('.carte:nth-of-type(1) table tbody tr, section.carte table tbody tr', (tr) => tr.map((x) => x.textContent.replace(/\s+/g, ' ')));
    ok(lignes.some((l) => /AYA KOUASSI\s*2\s*75 000 FCFA\s*15 000 FCFA\s*60 000 FCFA/.test(espaces(l))), n + 'par mannequin : AYA KOUASSI, 2 cachets, 75 000 / 15 000 / 60 000');
    ok((await p.$$('section.carte table .visage-lien .vis')).length >= 3, n + 'les mannequins ont leur photo, qui ouvre leur fiche');
    ok(/versé au parent : Madame Yao Mère/.test(await p.textContent('#contenu')), n + 'détail : cachet de la mineure « versé au parent »');
    if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + '/rapport-cachets-' + ecran.width + '.png', fullPage: true });
    // Excel : deux feuilles, totaux justes
    const [dlx] = await Promise.all([p.waitForEvent('download'), p.click('[data-action="rapport-cachets-excel"]')]);
    const cx = require('path').join(require('os').tmpdir(), 'essai-' + Date.now() + '-' + dlx.suggestedFilename()); await dlx.saveAs(cx);
    const x = python(LIRE_XLSX, cx);
    const tot = (x['Par mannequin'] || []).find((l) => /^TOTAL/.test(l[0])) || [];
    ok(dlx.suggestedFilename() === 'rapport-cachets-' + ceMois + '.xlsx' && tot[1] === 4 && tot[2] === 105000 && tot[3] === 19000 && tot[4] === 86000 && (x['Détail'] || []).length === 5, n + 'Excel : « Par mannequin » avec le total, et le détail des 4 cachets');
    // PDF
    const [dlp] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('[data-action="rapport-cachets-pdf"]')]);
    const cp = require('path').join(require('os').tmpdir(), 'essai-' + Date.now() + '-' + dlp.suggestedFilename()); await dlp.saveAs(cp);
    const pdf = python(LIRE_PDF, cp), t = espaces(pdf.texte);
    ok(/Rapport des cachets/.test(t) && /105 000 FCFA/.test(t) && /19 000 FCFA/.test(t) && /86 000 FCFA/.test(t) && /AYA KOUASSI/.test(t) && /non fiscal/.test(t), n + 'PDF : totaux, mannequins, mention « non fiscal »');
    // toute l'année : le mois d'avant compte aussi (s'il est dans la même année)
    const an = ceMois.slice(0, 4);
    await p.selectOption('#rc-periode', an); await p.waitForTimeout(1200);
    ok(new RegExp('Cachets payés\\s*' + (avant.slice(0, 4) === an ? 5 : 4)).test(espaces(await p.textContent('.chiffres'))), n + 'toute l’année ' + an + ' : les cachets de l’année entière');
    ok(!journal.some((j) => ['POST', 'PATCH', 'DELETE'].includes(j[0]) && j[1] === 'cachets_mannequins'), n + 'lecture seule : rien n’est écrit');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran');
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
