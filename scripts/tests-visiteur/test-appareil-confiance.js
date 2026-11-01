// Appareil de confiance (chantier 6, Extension 149, 01/11/2026), comme une vraie personne de l'équipe, sur
// téléphone et ordinateur, base et serveur SIMULÉS (rien n'est écrit pour de vrai) :
//  - « Déconnexion » sur un appareil de confiance : écran « Bon retour » (mot de passe + code à 4 chiffres),
//    sans le code de l'application ; sur un appareil sans confiance : connexion complète, comme avant ;
//  - retour : mauvais mot de passe (essais restants), puis bon mot de passe et code → Administration ;
//  - 24 heures sans activité (la base le dit) : l'écran « Bon retour » s'ouvre directement ;
//  - « Oublier cet appareil » ; page Sécurité : date de fin de confiance de chaque appareil.
// (Les règles elles-mêmes — 8 h, 30 jours, révocation, contournement — sont essayées dans la base :
// scripts/base-essai/essais-appareil-confiance.sql.)
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const chemin = require('path');
const PORT = String(9590 + Math.floor(Math.random() * 30));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (dl) => dl.accept());
    const d = donnees('principal');
    const etat = { defini: true, verrouille: false, confiance: true, session: true, confiance_jusqua: '2026-12-01T10:00:00Z' };
    d.rpc.portail_code_appareil_etat = () => etat;
    let confiance = true, pinBon = '2580';
    d.rpc.portail_appareil_deconnecter = () => { if (confiance) { Object.assign(etat, { verrouille: true, mot_de_passe: true }); } return confiance; };
    d.rpc.portail_appareil_oublier = () => { confiance = false; return null; };
    d.rpc.portail_code_appareil_verifier = (x) => (x.p_code === pinBon ? (Object.assign(etat, { verrouille: false, mot_de_passe: false }), { ok: true }) : { ok: false, restants: 3 });
    d.api = Object.assign({}, d.api, { '/api/connexion-protegee': (corps) => {
      if (!corps.verrouFort) return undefined;  // (connexion habituelle simulée)
      return corps.password === 'bon-mot-de-passe-long' ? { ok: true } : { statut: 401, error: 'Identifiants invalides.', essaisRestants: 4 };
    } });
    d.tables.staff_devices = [{ id: 'sd1', user_id: 'admin-1', appareil: 'appareil-de-cet-essai', libelle: 'Android, Chrome', installe_le: '2026-10-19T10:00:00Z', derniere_activite: new Date().toISOString(), revoque: false, confiance_jusqua: '2026-12-01T10:00:00Z', personne: { nom: 'Maître Akesse' } },
      { id: 'sd2', user_id: 'admin-1', appareil: 'autre-appareil-0001', libelle: 'Windows, Edge', installe_le: '2026-10-01T10:00:00Z', derniere_activite: '2026-10-20T10:00:00Z', revoque: false, confiance_jusqua: null, personne: { nom: 'Maître Akesse' } }];
    await brancher(p, d, journal); await photosLocales(p);
    await p.addInitScript(() => { try { localStorage.setItem('ma2m_portail_appareil', 'appareil-de-cet-essai'); } catch (e) { /* bloqué */ } });
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete', { timeout: 10000 });
    const appels = (quoi) => journal.filter((j) => j[0] === 'rpc' && j[1] === quoi).map((j) => JSON.parse(j[2] || '{}'));
    const api = () => journal.filter((j) => j[0] === 'API' && j[1] === '/api/connexion-protegee').map((j) => JSON.parse(j[2] || '{}'));
    // 1. Déconnexion sur l'appareil de confiance
    await p.click('[data-action="se-deconnecter"]:visible').catch(async () => { await p.evaluate(() => document.querySelector('[data-action="se-deconnecter"]').click()); });
    await p.waitForSelector('form[data-form="verrou-fort"]', { timeout: 5000 }).catch(() => {});
    ok(appels('portail_appareil_deconnecter').length === 1 && await p.isVisible('form[data-form="verrou-fort"]'), n + '« Déconnexion » sur un appareil de confiance : écran « Bon retour »');
    ok(await p.inputValue('#cx-mail') === 'admin@test.ci' && await p.isVisible('#cx-mdp') && await p.isVisible('#cx-pin') && !(await p.$('#cx-code')), n + 'e-mail déjà rempli, mot de passe + code à 4 chiffres, PAS le code de l’application');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'écran « Bon retour » lisible ' + pales.slice(0, 2).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    // 2. mauvais mot de passe, puis bon mot de passe et code
    await p.fill('#cx-mdp', 'faux'); await p.fill('#cx-pin', '2580'); await p.click('form[data-form="verrou-fort"] [type=submit]'); await p.waitForTimeout(700);
    ok(/Mot de passe incorrect\. Essais restants : 4/.test(await p.textContent('.connexion')) && api().pop().verrouFort === true, n + 'mauvais mot de passe : refusé, essais restants affichés');
    await p.fill('#cx-mdp', 'bon-mot-de-passe-long'); await p.fill('#cx-pin', '2580'); await p.click('form[data-form="verrou-fort"] [type=submit]');
    await p.waitForSelector('.accueil-tete', { timeout: 8000 }).catch(() => {});
    const dernier = api().pop() || {};
    ok(await p.isVisible('.accueil-tete') && dernier.appareil === 'appareil-de-cet-essai' && dernier.email === 'admin@test.ci' && appels('portail_code_appareil_verifier').some((x) => x.p_code === '2580'), n + 'bon mot de passe + code à 4 chiffres : de retour dans l’Administration');
    // 3. 24 heures sans activité (la base le dit) : l'écran « Bon retour » s'ouvre au démarrage
    Object.assign(etat, { verrouille: true, mot_de_passe: true });
    await p.reload(); await p.waitForSelector('form[data-form="verrou-fort"]', { timeout: 8000 }).catch(() => {});
    ok(await p.isVisible('form[data-form="verrou-fort"]'), n + 'après 24 heures sans activité : « Bon retour » directement');
    // 4. « Oublier cet appareil »
    await p.click('[data-action="oublier-appareil"]'); await p.waitForSelector('form[data-form="connexion"]', { timeout: 5000 }).catch(() => {});
    ok(appels('portail_appareil_oublier').length === 1 && await p.isVisible('form[data-form="connexion"]'), n + '« Oublier cet appareil » : confiance retirée, connexion complète');
    // 5. appareil sans confiance : « Déconnexion » ferme tout, comme avant
    Object.assign(etat, { verrouille: false, mot_de_passe: false, confiance: false });
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete', { timeout: 10000 });
    await p.evaluate(() => document.querySelector('[data-action="se-deconnecter"]').click());
    await p.waitForSelector('form[data-form="connexion"]', { timeout: 5000 }).catch(() => {});
    ok(await p.isVisible('form[data-form="connexion"]') && !(await p.$('form[data-form="verrou-fort"]')), n + 'appareil sans confiance : « Déconnexion » ferme tout (connexion complète)');
    // 6. Sécurité : date de fin de confiance, « Oublier cet appareil » pour celui-ci
    confiance = true; Object.assign(etat, { confiance: true });
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete', { timeout: 10000 });
    await p.goto(URL_ADMIN + '#/securite/appareils'); await p.waitForTimeout(1500);
    const t = await p.textContent('body');
    ok(/Confiance/.test(t) && /jusqu’au 01\/12\/2026/.test(t) && /\(cet appareil\)/.test(t) && (await p.$$('.contenu [data-action="oublier-appareil"]')).length === 1, n + 'Sécurité : fin de confiance de chaque appareil, « Oublier cet appareil » pour celui-ci');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne déborde');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
