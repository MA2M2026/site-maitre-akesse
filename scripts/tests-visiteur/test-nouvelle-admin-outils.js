// Nouvelle Administration — groupe « Accès et outils » (js/admin/site-acces.js), essayé comme
// l'agence sur téléphone et ordinateur, base SIMULÉE (donnees-nouvelle-admin.js) : codes d'accès
// (casting direct, codes disponibles / utilisés, note d'intégration), accès bloqués (débloquer,
// liste blanche), Drive, nettoyage des photos. Rien n'est écrit ni envoyé pour de vrai.
// CAPTURES=dossier : captures d'écran.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const chemin = require('path');
const PORT = String(9400 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/nouvelle/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const capture = (p, nom) => process.env.CAPTURES ? p.screenshot({ path: process.env.CAPTURES + '/' + nom + '.png', fullPage: true }) : null;
const api = (journal, chemin, motif) => journal.filter((j) => j[0] === 'API' && j[1] === chemin && (!motif || motif.test(j[2] || '')));

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore', stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ', suffixe = tel ? '-tel' : '-pc';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept());
    await brancher(p, donnees('principal'), journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');

    // 1. Codes d'accès
    await p.goto(URL_ADMIN + '#/site/b3b-codes-inscription'); await p.waitForSelector('[data-form="casting-direct"]'); await p.waitForTimeout(1500);
    const codes = await p.textContent('#contenu');
    ok(/MA2M-LIBRE1/.test(codes) && /YAO KOUASSI/.test(codes) && /Ancien code sans nom/.test(codes) && /Anciens codes déjà utilisés \(1\)/.test(codes), n + 'codes : disponibles avec le nom, ancien code sans nom, utilisés à part');
    ok(/14\/10\/2026/.test(await p.textContent('#ni-etat')) && await p.isDisabled('#ni-envoyer-btn'), n + 'note d’intégration : document en place, bouton inactif sans fichier');
    await p.fill('#cd-nom', 'Kady Traoré'); await p.fill('#cd-telephone', '0102030405'); await p.selectOption('#cd-genre', 'femme'); await p.fill('#cd-naissance', '2012-04-04');
    await p.click('form[data-form="casting-direct"] [type=submit]'); await p.waitForSelector('.nouveau-code', { timeout: 8000 }).catch(() => {});
    const wa = await p.getAttribute('.nouveau-code a[href^="https://wa.me/"]', 'href').catch(() => '');
    ok(journal.some((j) => j[0] === 'rpc' && j[1] === 'casting_direct_creer' && /Kady/.test(j[2])) && /MA2M-DIRECT/.test(await p.textContent('.nouveau-code')), n + 'casting direct : fiche et code créés, code montré en grand');
    ok(/wa\.me\/2250102030405\?text=/.test(wa) && /MA2M-DIRECT/.test(decodeURIComponent(wa)) && /Inscription : https/.test(decodeURIComponent(wa)), n + 'message WhatsApp prêt avec le code et le lien d’inscription');
    await p.waitForTimeout(1200); await capture(p, 'codes' + suffixe);
    await p.setInputFiles('#ni-fichier', { name: 'note.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 essai') });
    await p.click('#ni-envoyer-btn'); await p.waitForTimeout(1500);
    ok(api(journal, '/api/r2-site-images', /prive\/note-integration\//).length >= 1 && /Document déposé/.test(await p.textContent('#ni-msg')), n + 'note d’intégration déposée (ancienne retirée ensuite)');

    // 2. Accès bloqués
    await p.goto(URL_ADMIN + '#/site/b3b-acces-bloques'); await p.waitForSelector('[data-form="liste-blanche"]'); await p.waitForTimeout(1000);
    const bl = await p.textContent('#contenu');
    ok(/102\.67\.1\.9/.test(bl) && /Connexion mannequin/.test(bl) && /Code d’inscription/.test(bl) && /41\.66\.2\.3/.test(bl) && /Bureau/.test(bl), n + 'accès bloqués : adresses et comptes, liste de confiance');
    await capture(p, 'blocages' + suffixe);
    await p.click('[data-action="debloquer"][data-type="ip"]'); await p.waitForTimeout(900);
    ok(api(journal, '/api/connexion-admin', /"action":"debloquer_ip","ip":"102\.67\.1\.9","espace":"mannequin"/).length === 1, n + 'adresse débloquée');
    await p.fill('#lb-ip', '90.12.34.56'); await p.click('form[data-form="liste-blanche"] [type=submit]'); await p.waitForTimeout(900);
    ok(api(journal, '/api/connexion-admin', /liste_blanche_ajouter.*90\.12\.34\.56/).length === 1, n + 'adresse de confiance ajoutée');

    // 3. Drive
    await p.goto(URL_ADMIN + '#/site/b3a-drive'); await p.waitForSelector('.cartes-pilotage'); await p.waitForTimeout(1600);
    ok(/PHOTOS DU BOOK\s*\d+/i.test(await p.innerText('.cartes-pilotage')) && /seuls les chiffres sûrs/.test(await p.textContent('#contenu')), n + 'drive : chiffres réels, rien d’inventé');

    // 4. Nettoyage
    await p.goto(URL_ADMIN + '#/site/b3a-nettoyage'); await p.waitForSelector('[data-action="nettoyer-traitees"]'); await p.waitForTimeout(600);
    await p.click('[data-action="nettoyer-traitees"]'); await p.waitForTimeout(900);
    ok(/3 photos retirées/.test(await p.textContent('#nt-msg')), n + 'nettoyage des dossiers traités lancé');
    ok(!!(await p.$('#nettoyage-supabase-btn')), n + 'outil de nettoyage Supabase présent');
    await capture(p, 'nettoyage' + suffixe);

    // 5. Erreurs du site (écran partagé) : classées par gravité, copie pour Claude, « Réglé — effacer »
    await p.goto(URL_ADMIN + '#/site/b3a-erreurs'); await p.waitForSelector('#liste-erreurs'); await p.waitForSelector('.journal-carte', { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(800);
    const resume = await p.innerText('#erreurs-resume');
    ok(/1\s*À corriger/i.test(resume.replace(/\n/g, ' ')) && /1\s*À surveiller/i.test(resume.replace(/\n/g, ' ')) && (await p.$$('.journal-carte')).length >= 2 && !(await p.isHidden('#erreurs-connexion')), n + 'erreurs : une à corriger, une à surveiller, la lenteur regroupée en une ligne');
    await capture(p, 'erreurs' + suffixe);
    await p.click('[data-journal-copier="0"]'); await p.waitForTimeout(500);
    ok(/Copié|copié/.test(await p.textContent('[data-journal-copier="0"]')), n + 'fiche copiée pour Claude');
    await p.click('[data-journal-effacer="0"]'); await p.waitForTimeout(1200);
    ok(journal.some((j) => j[0] === 'DELETE' && j[1] === 'journal_erreurs'), n + '« Réglé — effacer » efface ce signalement après confirmation');

    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 4).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    for (const page of ['b3b-codes-inscription', 'b3b-acces-bloques']) {
      await p.goto(URL_ADMIN + '#/site/' + page); await p.waitForTimeout(1500);
      ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + page + ' : rien ne dépasse de l’écran');
      const pl = await lirePageEntiere(p); ok(!pl.length, n + page + ' : textes lisibles ' + pl.slice(0, 3).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    }
    ok(!errs.length, n + 'aucune erreur de page ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
