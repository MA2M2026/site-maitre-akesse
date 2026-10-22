// Journal des erreurs : « Télécharger le fichier pour Claude » (14/10/2026, demande de la
// propriétaire : la copie de 38 erreurs arrivait coupée dans la conversation). Avec 100 erreurs
// simulées, le fichier .md doit toutes les contenir, rangées par gravité, et « Copier pour
// Claude » doit donner le même texte. Depuis le 21/10/2026 (décision de la propriétaire), les 🟢
// (connexion faible du visiteur) ne sont plus listés : une seule ligne les compte ; et une erreur
// déjà corrigée qui revient est signalée « revenue après la correction ». Base simulée : rien n'est écrit.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs'); const { brancher } = require('./faux-serveur');
const PORT = String(9500 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Version/26.6.1 Mobile/15E148 Safari/604.1';
const maintenant = Date.now();
// une erreur de chaque gravité : 🔴 code, 🟠 affichage qui saute, 🟢 e-mail non parti (connexion du visiteur)
const types = ['[Erreur JavaScript] essaiFonction%d is not defined', '[Affichage qui saute] /mannequins : bloc %d', '[Erreur signalée par le code] Notification e-mail non envoyée : {"status":0,"text":"essai %d"}'];
const erreurs = Array.from({ length: 100 }, (_, i) => ({ id: 'e' + i, message: types[i % 3].replace('%d', i), page: '/index.html', pile: 'ligne ' + i,
  user_agent: IPHONE, created_at: new Date(maintenant - i * 60000).toISOString() }));
// une erreur déclarée corrigée le 29/09 (js/erreurs-corrigees.js) qui se reproduit aujourd'hui
erreurs.push({ id: 'r1', message: '[Affichage qui saute] /actualites : footer.site-footer', page: '/actualites.html', pile: 'retour', user_agent: IPHONE, created_at: new Date(maintenant).toISOString() });
// une « coupure réseau » chez 6 visiteurs différents la même semaine : ce n'est sans doute pas leur
// connexion → de nouveau listée, en 🟠
for (let k = 0; k < 6; k++) erreurs.push({ id: 'm' + k, message: '[Réseau injoignable] POST api.emailjs.com/api/v1.0/email/send → Failed to fetch', page: '/candidature.html', pile: '', user_agent: IPHONE.replace('18_7', '18_' + k), created_at: new Date(maintenant - k * 1000).toISOString() });
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const ctx = await b.newContext({ viewport: vp, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept());
    await p.addInitScript(() => { sessionStorage.setItem('ma2m_code_valide', '1'); });
    await brancher(p, { tables: { admins: [{ user_id: 'admin-1' }], journal_erreurs: erreurs } }, journal);
    await p.goto('http://127.0.0.1:' + PORT + '/tableau-de-bord.html'); await p.waitForTimeout(1200);
    await p.fill('#tb-email', 'admin@test.ci'); await p.fill('#tb-password', 'motdepasse'); await p.click('#tb-login-btn');
    await p.waitForSelector('#bloc-tableau', { state: 'visible', timeout: 15000 }); await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector('[data-tdb-cible="b3a-erreurs"]').click());
    await p.waitForSelector('#erreurs-telecharger-btn:not([hidden])', { timeout: 10000 }).catch(() => {});
    const n = vp.width + 'px : ';
    ok(/69 erreurs/.test(await p.textContent('#erreurs-telecharger-btn')), n + 'bouton « Télécharger le fichier pour Claude (69 erreurs) » : les 33 🟢 ne sont plus listés');
    const ligne = await p.textContent('#erreurs-connexion');
    ok(await p.isVisible('#erreurs-connexion') && /1 visiteur/.test(ligne) && /33 signalements/.test(ligne), n + 'une seule ligne « connexion faible » : ' + ligne.trim().slice(0, 90));
    ok(!(await p.$('#erreurs-resume [data-journal-gravite="info"]')), n + 'plus de case 🟢 dans le résumé');
    const revenue = await p.$$eval('.journal-revenue', els => els.map(e => e.textContent));
    ok(revenue.some(t => /Ressemble à une erreur corrigée le 29\/09/.test(t)), n + 'erreur qui ressemble à une erreur corrigée signalée : ' + (revenue.find(t => /Ressemble/.test(t)) || 'rien'));
    ok(revenue.some(t => /Touche 6 visiteurs différents/.test(t)), n + 'problème « de connexion » chez 6 visiteurs différents : de nouveau listé en 🟠');
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.click('#erreurs-telecharger-btn')]);
    const texte = fs.readFileSync(await dl.path(), 'utf8'); if (process.env.GARDER) fs.writeFileSync(process.env.GARDER, texte);
    ok(/^journal-ma2m-\d{4}-\d\d-\d\d-.*\.md$/.test(dl.suggestedFilename()), n + 'fichier ' + dl.suggestedFilename());
    ok(/^# Journal MA2M — 69 erreur\(s\)/.test(texte), n + 'en-tête : 69 erreurs');
    ok((texte.match(/^### #\d+$/gm) || []).length === 69 && texte.includes('### #69'), n + 'les 69 vraies erreurs sont dans le fichier, rien n’est coupé');
    const pos = ['## 🔴', '## 🟠'].map(t => texte.indexOf(t));
    ok(pos.every(x => x >= 0) && pos[0] < pos[1] && !texte.includes('## 🟢'), n + 'rangées en 2 groupes : 🔴 puis 🟠 (plus de 🟢)');
    ok(texte.includes('essaiFonction99 is not defined') && texte.includes('À vérifier : ressemble à une erreur corrigée'), n + 'messages complets présents, erreur revenue signalée dans le fichier');
    await p.click('#erreurs-copier-tout-btn'); await p.waitForTimeout(300);
    const copie = await p.evaluate(() => navigator.clipboard.readText());
    ok(copie.replace(/—[^—\n]*\n/, '') === texte.replace(/—[^—\n]*\n/, '') || copie.split('\n').slice(1).join('\n') === texte.split('\n').slice(1).join('\n'), n + '« Copier pour Claude » donne le même texte');
    // deux appuis rapides : le bouton retrouve ensuite son libellé
    await p.click('#erreurs-telecharger-btn'); await p.click('#erreurs-telecharger-btn'); await p.waitForTimeout(5600);
    ok(/^⬇️ Télécharger le fichier pour Claude \(69 erreurs/.test(await p.textContent('#erreurs-telecharger-btn')), n + 'après deux appuis rapides, le bouton retrouve son libellé');
    // filtre « À corriger » : le fichier ne contient que ces erreurs
    await p.click('#erreurs-resume [data-journal-gravite="corriger"]'); await p.waitForTimeout(300);
    const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.click('#erreurs-telecharger-btn')]);
    const filtre = fs.readFileSync(await dl2.path(), 'utf8');
    ok(/^# Journal MA2M — 34 erreur\(s\) \(🔴 À corriger\)/.test(filtre) && (filtre.match(/^### #\d+$/gm) || []).length === 34 && !filtre.includes('## 🟠') && !filtre.includes('## 🟢'), n + 'filtre « À corriger » : seules ses 34 erreurs dans le fichier');
    ok(!journal.some(j => /journal_erreurs/.test(j[1] || '') && /delete/i.test(j[0])), n + 'rien n’est effacé du journal');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
