// Administration — candidature « Agence de représentation : simple représentation » retenue (25/11/2026, accord de la
// propriétaire) : pas de code d'inscription (payant, MA2M Academy) ; « Créer sa fiche » puis « Générer le code d'espace »
// et envoi par WhatsApp. Téléphone et ordinateur, base SIMULÉE : rien n'est écrit ni envoyé pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const PORT = String(9500 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [], d = donnees('principal');
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('dialog', (dl) => dl.accept());
    d.tables.casting_applications.push({ id: 'c9', full_name: 'KOFFI RÉSEAU', email: 'koffi@test.ci', phone: '+225 0708091011', genre: 'homme', civilite: 'Monsieur', type_candidature: 'agence', porte: 'reseau',
      message: 'Parcours choisi : Talent Network\n\nBonjour', status: 'retenue', created_at: '2026-11-25T10:00:00Z', experience_mannequin: 'oui', city: 'Cocody' });
    d.tables.codes_espace = d.tables.codes_espace || [];
    d.rpc.representation_creer_fiche = (x) => { const id = 'reg-rep'; if (!d.tables.agence_mannequins.some((m) => m.id === id)) d.tables.agence_mannequins.push({ id, full_name: 'KOFFI RÉSEAU', candidature_id: x.p_candidature, user_id: null, statut: 'actif' }); return id; };
    d.rpc.code_espace_creer = (x) => { d.tables.codes_espace.push({ code: 'ESP-REP123', mannequin_id: x.p_mannequin, annule: false, utilise_le: null, expire_le: new Date(Date.now() + 7 * 864e5).toISOString() }); return 'ESP-REP123'; };
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    await p.goto(URL_ADMIN + '#/site/b2-candidatures/c9'); await p.waitForSelector('.fiche-luxe', { timeout: 15000 }); await p.waitForSelector('.code-zone', { timeout: 10000 }); await p.waitForTimeout(600);
    const avant = await p.textContent('.code-zone');
    ok(/Agence de représentation/.test(avant) && /gratuit/.test(avant) && await p.isVisible('[data-action="dossier-representation-fiche"]') && !(await p.$('[data-action="dossier-code-creer"]')),
      n + 'candidature retenue de représentation : pas de code d’inscription, bouton « Créer sa fiche »');
    ok(/Agence de représentation : simple représentation/.test(await p.textContent('.fiche-luxe')), n + 'le département est écrit en clair sur la fiche');
    await p.click('[data-action="dossier-representation-fiche"]'); await p.waitForSelector('[data-action="dossier-representation-code"]', { timeout: 8000 });
    ok(journal.some((j) => j[0] === 'rpc' && j[1] === 'representation_creer_fiche') && /Sa fiche est créée/.test(await p.textContent('.code-zone')), n + '« Créer sa fiche » : fiche créée, bouton « Générer le code d’espace »');
    await p.click('[data-action="dossier-representation-code"]'); await p.waitForSelector('.code-zone #dos-code', { timeout: 8000 });
    const wa = decodeURIComponent(await p.getAttribute('.code-zone a.btn', 'href'));
    ok(journal.some((j) => j[0] === 'rpc' && j[1] === 'code_espace_creer') && /ESP-REP123/.test(await p.textContent('.code-zone')), n + 'code d’espace créé et affiché');
    ok(/^https:\/\/wa\.me\/2250708091011\?text=/.test(wa) && /Agence de représentation/.test(wa) && /ESP-REP123/.test(wa) && /rien à payer/.test(wa) && /Créer mon compte/.test(wa),
      n + 'WhatsApp prêt : accueil de l’agence, code, création du compte, « rien à payer »');
    ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1 && !errs.length, n + 'aucun débordement, aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ Administration, représentation simple : tout passe');
  process.exit(ko ? 1 : 0);
})();
