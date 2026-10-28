// Test visuel (chantier D du cahier « Architecture », 18/10/2026) : chaque page publique FR et EN
// est ouverte sur téléphone (390 px) et ordinateur (1280 px), puis parcourue de haut en bas.
//  1. Lisibilité (BLOQUANT) : tout texte visible doit avoir assez de contraste avec ce qui est
//     peint dessous (norme WCAG AA, scripts/tests-visiteur/lisibilite.js). Vérifié aussi menu
//     ouvert, bandeau cookies affiché et formulaires envoyés vides (messages d'erreur).
//  1b. Boutons (BLOQUANT) : chaque bouton suit le modèle rouge unique (boutons.js).
//  2. Contrôle du contrôle : un texte très pâle posé exprès sur le menu (clair) DOIT être signalé,
//     sinon le test lui-même est cassé.
//  3. Captures d'écran (NON bloquant) : rangées dans captures/actuelles ; si des captures de
//     référence existent (captures/reference, faites avec « node test-visuel.js --reference »),
//     les différences sont listées dans captures/rapport.html.
// Base simulée : rien n'est écrit pour de vrai. Dossier captures/ non publié (.gitignore).
const { chromium } = require('playwright'); const { spawn, execFileSync } = require('child_process'); const { brancher } = require('./faux-serveur');
const { verifierLisibilite, lirePageEntiere } = require('./lisibilite');
const { verifierBoutons } = require('./boutons');
const { fondsInterdits } = require('./couleurs-autorisees');
const fs = require('fs'); const path = require('path');
const PORT = String(8600 + Math.floor(Math.random() * 100));
const RACINE = path.resolve(__dirname, '../..');
const CAPTURES = path.join(__dirname, 'captures');
const REFERENCE = process.argv.includes('--reference');
const { tables, rpc, pages } = require('./pages-publiques');
const ecrans = [{ nom: 'telephone', width: 390, height: 844 }, { nom: 'ordinateur', width: 1280, height: 900 }];
const nomFichier = (page, ecran, etat) => page.replace(/\.html.*$/, '').replace(/\//g, '_') + '-' + ecran.nom + (etat ? '-' + etat : '') + '.png';

let srv; process.on('exit', () => srv && srv.kill());
const problemes = []; let captures = 0;

async function ouvrir(b, page, ecran, cookies) {
  const ctx = await b.newContext({ viewport: { width: ecran.width, height: ecran.height } });
  const p = await ctx.newPage();
  // un style écrit dans la page et bloqué par la règle de sécurité (CSP) ne s'affiche pas, en silence
  p.on('console', (m) => { if (/Refused to apply inline style/.test(m.text())) problemes.push(page + ' (' + ecran.nom + ') : style bloqué par la sécurité de la page'); });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.addInitScript((cookies) => {
    try {
      sessionStorage.setItem('ma2m_porte_ouverte', '1'); sessionStorage.setItem('ma2m_intro_vue', '1');
      if (!cookies) localStorage.setItem('ma2m_cookies', 'non');
    } catch (e) {}
  }, cookies);
  await brancher(p, { tables: JSON.parse(JSON.stringify(tables)), rpc }, []);
  await p.goto('http://127.0.0.1:' + PORT + '/' + page, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  return { ctx, p };
}
async function lireTout(p, etiquette) {
  for (const x of await lirePageEntiere(p)) problemes.push(etiquette + ' : « ' + x.texte + ' » (' + x.element + ') contraste ' + x.contraste + ' au lieu de ' + x.seuil + ' minimum');
}
// attend la fin des apparitions en fondu (menu : rubriques qui arrivent l'une après l'autre)
const finAnimations = (p) => p.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || (a.effect && a.effect.getComputedTiming().iterations === Infinity)), null, { timeout: 4000 }).catch(() => {});
async function capturer(p, nom, pleinePage) {
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(CAPTURES, 'actuelles', nom), fullPage: pleinePage, animations: 'disabled' }).catch(() => {});
  captures++;
}
async function unePage(b, page, ecran) {
  const etiquette = page + ' (' + ecran.nom + ')';
  const { ctx, p } = await ouvrir(b, page, ecran, false);
  try {
    await lireTout(p, etiquette);
    // appui sur un bouton : il doit se signaler (liseré blanc, ou bouton rond « marche » qui s'enfonce et passe au vert ; js/bouton-appui.js)
    const appui = await p.evaluate(() => { const b = document.getElementById('menuBtn'); if (!b) return true; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return b.classList.contains('touche-appuyee') || b.classList.contains('rond-appuye'); });
    if (!appui) problemes.push(etiquette + ' : appuyer sur un bouton ne se voit pas');
    if (await p.evaluate(() => { const f = document.querySelector('footer[data-gabarit="pied"]'); return f && !f.innerText.trim(); })) problemes.push(etiquette + ' : pied de page vide');
    for (const x of await p.evaluate(verifierBoutons)) problemes.push(etiquette + ' : bouton « ' + x.texte + ' » (' + x.element + ') pas au modèle rouge (fond ' + x.fond + ', texte ' + x.couleur + ', coins ' + x.rayon + ')');
    // gardien des couleurs (28/10/2026) : seulement des fonds rouges ou blancs
    for (const x of await p.evaluate(fondsInterdits)) problemes.push(etiquette + ' : fond ni rouge ni blanc ' + x.couleur + ' (' + x.element + ')');
    await capturer(p, nomFichier(page, ecran), true);
    // Menu plein écran ouvert
    const bouton = await p.$('#menuBtn');
    if (bouton && await bouton.isVisible()) {
      await bouton.click(); await p.waitForTimeout(300); await finAnimations(p);
      problemes.push(...(await p.evaluate(verifierLisibilite)).map(x => etiquette + ', menu ouvert : « ' + x.texte + ' » contraste ' + x.contraste + ' au lieu de ' + x.seuil));
      if (page === 'index.html' || page === 'en/index.html') await capturer(p, nomFichier(page, ecran, 'menu'), false);
    }
    // Formulaires envoyés vides : les messages d'erreur doivent rester lisibles
    if (/^(en\/)?(contact|integrer-agence|espace-mannequin)\.html/.test(page)) {
      await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1000);
      // sans la bulle du navigateur (invisible pour le test) : ce sont les messages du site qui
      // s'affichent ; l'envoi éventuel part vers la base simulée
      await p.evaluate(() => document.querySelectorAll('form').forEach(f => { f.noValidate = true; }));
      const envoi = await p.$('form:not(.u-hidden) [type="submit"]:visible');
      if (envoi) {
        await envoi.click().catch(() => {}); await p.waitForTimeout(600);
        await lireTout(p, etiquette + ', formulaire envoyé vide');
        await capturer(p, nomFichier(page, ecran, 'erreurs'), true);
      }
    }
  } finally { await ctx.close(); }
}

(async () => {
  const debut = Date.now();
  fs.rmSync(path.join(CAPTURES, 'actuelles'), { recursive: true, force: true });
  fs.mkdirSync(path.join(CAPTURES, 'actuelles'), { recursive: true });
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: RACINE, stdio: 'ignore', stdio: 'ignore' }); await new Promise(r => setTimeout(r, 1500));
  const b = await chromium.launch();

  // 1. Contrôle du contrôle : texte sombre posé exprès sur le menu ouvert (fond sombre)
  {
    const { ctx, p } = await ouvrir(b, 'en/index.html', ecrans[0], false);
    await p.click('#menuBtn'); await p.waitForTimeout(300); await finAnimations(p);
    const duMenu = (l) => l.filter(x => x.element.includes('menuOverlay'));
    const avant = duMenu(await p.evaluate(verifierLisibilite)).length;
    await p.evaluate(() => document.querySelectorAll('#menuOverlay .nav-links a').forEach(a => { /* rouge à peine plus clair que le menu rouge : illisible exprès */ a.style.setProperty('color', '#8a2a32', 'important'); }));
    await p.waitForTimeout(100); await finAnimations(p); // les liens changent de couleur en fondu
    const apres = duMenu(await p.evaluate(verifierLisibilite)).length;
    console.log(apres > 0 ? '✅ erreur faite exprès (texte presque de la couleur du menu rouge) bien détectée (' + apres + ' textes)' : '❌ erreur faite exprès NON détectée : le contrôle de lisibilité est cassé');
    if (!apres || avant) problemes.push('contrôle du contrôle : ' + (apres ? avant + ' problème(s) déjà présents sur le menu' : 'texte illisible sur le menu non détecté'));
    await ctx.close();
  }

  // 2. Bandeau cookies (identique sur toutes les pages) : accueil FR et EN
  for (const page of ['index.html', 'en/index.html']) for (const ecran of ecrans) {
    const { ctx, p } = await ouvrir(b, page, ecran, true);
    const bandeau = await p.$('#bandeau-cookies');
    if (!bandeau) problemes.push(page + ' (' + ecran.nom + ') : bandeau cookies absent');
    else {
      await bandeau.scrollIntoViewIfNeeded().catch(() => {});
      problemes.push(...(await p.evaluate(verifierLisibilite)).filter(x => x.element.includes('cookies')).map(x => page + ' (' + ecran.nom + '), bandeau cookies : « ' + x.texte + ' » contraste ' + x.contraste));
      await capturer(p, nomFichier(page, ecran, 'cookies'), false);
    }
    await ctx.close();
  }

  // 3. Toutes les pages, quatre à la fois
  const travail = pages.flatMap(page => ecrans.map(ecran => [page, ecran]));
  await Promise.all([0, 1, 2, 3].map(async () => {
    for (let t = travail.shift(); t; t = travail.shift()) {
      await unePage(b, t[0], t[1]).catch(e => problemes.push(t[0] + ' (' + t[1].nom + ') : erreur du test ' + e.message.split('\n')[0]));
    }
  }));

  // 3b. Espace mannequin CONNECTÉE (session simulée) : chaque étape du parcours guidé, puis le
  // tableau de la mannequin en ligne — lisibilité, boutons au modèle rouge, captures.
  for (const ecran of ecrans) for (const enLigne of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: ecran.width, height: ecran.height } }); const p = await ctx.newPage();
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.addInitScript(() => {
      const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
      const exp = Math.floor(Date.now() / 1000) + 36000;
      const jeton = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'm-1', role: 'authenticated', aud: 'authenticated', exp }) + '.c2ln';
      localStorage.setItem('sb-dfhghgmwmxiguhtxtsle-auth-token', JSON.stringify({ access_token: jeton, token_type: 'bearer', expires_in: 36000, expires_at: exp, refresh_token: 'x', user: { id: 'm-1', aud: 'authenticated', role: 'authenticated', email: 'awa@test.ci' } }));
      localStorage.setItem('ma2m_cookies', 'non');
    });
    await brancher(p, { tables: { model_profiles: [{ id: 'm-1', full_name: 'AWA KONÉ', published: enLigne, desactive: false, statut: enLigne ? 'publie' : 'brouillon' }] }, rpc: {} }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/app/espace-mannequin.html', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
    const etapes = enLigne ? [null] : [1, 2, 3, 4, 5, 6];
    for (const n of etapes) {
      const etiquette = 'espace-mannequin connectée ' + (enLigne ? 'en ligne' : 'étape ' + n) + ' (' + ecran.nom + ')';
      if (n) await p.evaluate((n) => { if (typeof goto === 'function') goto(n); }, n).catch(() => {});
      await p.waitForTimeout(500);
      await lireTout(p, etiquette);
      for (const x of await p.evaluate(verifierBoutons)) problemes.push(etiquette + ' : bouton « ' + x.texte + ' » (' + x.element + ') pas au modèle rouge (fond ' + x.fond + ', texte ' + x.couleur + ', coins ' + x.rayon + ')');
      await capturer(p, 'espace-connectee-' + (enLigne ? 'en-ligne' : 'etape' + n) + '-' + ecran.nom + '.png', true);
    }
    await ctx.close();
  }
  await b.close();

  // 4. Captures : nouvelle référence, ou comparaison avec la référence (rapport non bloquant)
  if (REFERENCE) {
    fs.rmSync(path.join(CAPTURES, 'reference'), { recursive: true, force: true });
    fs.cpSync(path.join(CAPTURES, 'actuelles'), path.join(CAPTURES, 'reference'), { recursive: true });
    console.log('ℹ️ ' + captures + ' captures enregistrées comme référence (captures/reference)');
  } else if (fs.existsSync(path.join(CAPTURES, 'reference'))) {
    try { console.log(execFileSync('python3', [path.join(__dirname, 'comparer-captures.py'), CAPTURES], { encoding: 'utf8' }).trim()); }
    catch (e) { console.log('⚠️ comparaison des captures impossible (non bloquant) : ' + String(e.stderr || e.message).trim().split('\n').pop()); }
  } else console.log('ℹ️ ' + captures + ' captures dans captures/actuelles (pas encore de référence : node test-visuel.js --reference)');

  const duree = Math.round((Date.now() - debut) / 1000);
  console.log((duree < 600 ? '✅' : '❌') + ' durée ' + duree + ' s (' + pages.length + ' pages × 2 écrans), maximum 600 s');
  if (duree >= 600) problemes.push('test trop long : ' + duree + ' s');
  if (problemes.length) { console.log('❌ ' + problemes.length + ' problème(s) de lisibilité :\n  ' + problemes.join('\n  ')); process.exit(1); }
  console.log('✅ tous les textes lisibles (contraste WCAG AA) sur ' + pages.length + ' pages, téléphone et ordinateur, menu, cookies et formulaires');
  process.exit(0);
})();
