// Espace 2 — « Matrice mannequins × mois » (cahier V3, 7.2), essayé comme une vraie personne sur téléphone et
// ordinateur, base SIMULÉE : 12 colonnes, une pastille par case (payé, en attente, non payé, à venir),
// signe et texte sur chaque pastille, changement d'année.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const { verifierBoutons } = require('./boutons');
const PORT = String(9300 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

function donnees(role) {
  const espaces = { site: role === 'principal' || role === 'site', paiements: role === 'principal' || role === 'caisse', compta: role === 'principal' || role === 'compta' };
  return {
    portail: { aal: 'aal1', facteurs: true },
    tables: {
      staff_profiles: [{ user_id: 'admin-1', nom: 'Maître Akesse', email: 'admin@test.ci', role: 'principal', actif: true, cree_le: '2026-10-19', appareils: [] },
        { user_id: 'u-k', nom: 'Comptable', email: 'k@test.ci', role: 'compta', actif: true, cree_le: '2026-10-19', appareils: [] }],
      staff_module_grants: [], staff_devices: [{ id: 'sd1', appareil: 'abc', libelle: 'Android, Chrome', installe_le: '2026-10-19', derniere_activite: new Date().toISOString(), revoque: false, personne: { nom: 'Maître Akesse' } }],
      // Espace 2 — registre : un compte du site et un mannequin ajouté à la main
      agence_mannequins: [{ id: 'r1', full_name: 'ROXANE OUATTARA', telephone: '0102030405', mensualite: 10000, statut: 'actif', user_id: 'm-site', date_entree: '2026-09-01' },
        { id: 'r2', full_name: 'KONÉ AWA', telephone: '0707070707', mensualite: 10000, statut: 'actif', user_id: null, date_entree: '2026-10-01', date_naissance: '2000-01-01' },
        { id: 'r3', full_name: 'YAO KOUASSI', telephone: '0505050505', email: 'yao@test.ci', mensualite: 10000, statut: 'actif', user_id: null, date_entree: '2026-10-10' },
        { id: 'r4', full_name: 'SANOGO MARIAM', telephone: '0606060606', mensualite: 10000, statut: 'actif', user_id: null, date_entree: '2026-10-11' }],
      // code de l'espace de SANOGO MARIAM (inscription validée), valable encore 7 jours
      codes_espace: [{ code: 'ESP-MARIAM', mannequin_id: 'r4', annule: false, utilise_le: null, cree_le: new Date().toISOString(), expire_le: new Date(Date.now() + 7 * 864e5).toISOString() }],
      // « J'ai payé » de YAO : inscription 15 000 + 1er mois 10 000, déclarés ensemble (orange)
      paiements_mannequins: [
        { id: 'pi3', mannequin_id: 'r3', objet: 'inscription', mois: null, montant: 15000, mode: 'wave', statut: 'declare', declare_le: '2026-10-19T09:00:00Z', mannequin: { full_name: 'YAO KOUASSI', telephone: '0505050505' } },
        { id: 'pm3', mannequin_id: 'r3', objet: 'mensualite', mois: '2026-10-01', montant: 10000, mode: 'wave', statut: 'declare', declare_le: '2026-10-19T09:00:00Z', mannequin: { full_name: 'YAO KOUASSI', telephone: '0505050505' } },
        { id: 'pi4', mannequin_id: 'r4', objet: 'inscription', mois: null, montant: 15000, mode: 'wave', statut: 'valide', declare_le: '2026-10-15T09:00:00Z', valide_le: '2026-10-15T10:00:00Z' }],
      // Espace 3 (le parcours complet est dans test-comptabilite.js)
      compta_comptes: [{ id: 'c1', nom: 'Caisse (espèces)', type: 'caisse', solde_initial: 0, date_initiale: '2026-10-01', actif: true }],
      compta_ecritures: [],
      audit_log: [{ id: 1, acteur_nom: 'Maître Akesse', acteur_role: 'principal', action: 'Compte créé', objet: 'staff_profiles', cree_le: new Date().toISOString() }]
    },
    rpc: {
      portail_moi: { role, mfa: true, nom: { principal: 'Maître Akesse', site: 'Gestion du site', caisse: 'Encaissements', compta: 'Comptable' }[role], actif: true, membre: true, espaces, contacts_prives: role !== 'site' && role !== 'compta', noms_payeurs: espaces.paiements },
      portail_enregistrer_appareil: { ok: true, nouveau: false },
      portail_code_appareil_etat: { defini: true, verrouille: false },
      compta_soldes: [{ compte_id: 'c1', nom: 'Caisse (espèces)', type: 'caisse', solde: 0 }]
    },
    api: { '/api/portail': (corps) => corps.action === 'codes_secours_creer' ? { codes: ['AAAAA-BBBBB', 'CCCCC-DDDDD', 'EEEEE-FFFFF', 'GGGGG-HHHHH', 'JJJJJ-KKKKK', 'LLLLL-MMMMM', 'NNNNN-PPPPP', 'QQQQQ-RRRRR'] } : { ok: true } }
  };
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const url = 'http://127.0.0.1:' + PORT + '/admin/';
  const ouvrir = async (role, ecran, reglage) => {
    const ctx = await b.newContext({ viewport: ecran, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const d = donnees(role); if (reglage) reglage(d);
    await brancher(p, d, journal);
    await p.goto(url); await p.waitForSelector('#cx-mail', { timeout: 6000 });
    ok(await p.isVisible('[data-action=installer]'), 'écran de connexion : bouton « Installer l’application » proposé');
    await p.fill('#cx-mail', 'admin@test.ci'); await p.fill('#cx-mdp', 'motdepasse-tres-long'); await p.click('form[data-form="connexion"] [type=submit]');
    return { ctx, p, errs, journal, d };
  };
  const texte = (p) => p.evaluate(() => document.body.innerText);
  const pales = async (p) => (await lirePageEntiere(p)).map((x) => x.texte.slice(0, 25) + ' (' + x.contraste + ')');


  const now = new Date(); const an = now.getFullYear(), mc = now.getMonth() + 1;
  const mm = (n) => an + '-' + String(n).padStart(2, '0') + '-01';
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const e = await ouvrir('caisse', ecran, (d) => {
      d.tables.agence_mannequins = [
        { id: 'r1', full_name: 'ROXANE OUATTARA', mensualite: 10000, statut: 'actif', date_entree: an + '-01-01' },
        { id: 'r2', full_name: 'KONÉ AWA', mensualite: 10000, statut: 'actif', date_entree: an + '-01-01' },
        { id: 'r3', full_name: 'NOUVELLE ARRIVÉE', mensualite: 10000, statut: 'actif', date_entree: mm(mc) },
        { id: 'r5', full_name: 'ANCIEN SORTI', mensualite: 10000, statut: 'sorti', date_entree: an + '-01-01' }];
      d.tables.paiements_mannequins = [
        { id: 'p1', mannequin_id: 'r1', objet: 'mensualite', mois: mm(1), montant: 10000, statut: 'valide' },
        { id: 'p2', mannequin_id: 'r1', objet: 'mensualite', mois: mm(2), montant: 10000, statut: 'declare' }];
    });
    const p = e.p; p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) e.errs.push('console : ' + m.text().slice(0, 140)); });
    await p.waitForSelector('#cx-code'); await p.fill('#cx-code', '123456'); await p.click('form[data-form="code"] [type=submit]');
    await p.waitForFunction(() => location.hash.startsWith('#/paiements/'), null, { timeout: 8000 }).catch(() => {});
    if (ecran.width <= 860) { await p.click('[data-action=menu-ouvrir]'); await p.waitForTimeout(300); }
    ok(await p.isVisible('#menu-lateral a.nav[href="#/paiements/matrice"]'), nomEcran + ' : « Matrice mannequins × mois » dans le menu');
    await p.click('#menu-lateral a.nav[href="#/paiements/matrice"]');
    await p.waitForSelector('table.matrice', { timeout: 8000 }).catch(() => {});
    const t = () => p.evaluate(() => document.querySelector('.contenu').innerText.replace(/\s+/g, ' '));
    ok((await p.$$('table.matrice thead th')).length === 13, nomEcran + ' : 12 colonnes de mois + la colonne des noms');
    ok((await p.$$('table.matrice tbody tr')).length === 3, nomEcran + ' : 3 mannequins (le sorti n’est pas listé)');
    const cases = (nom) => p.$$eval('table.matrice tbody tr', (rows, x) => { const r = rows.find((y) => y.textContent.includes(x)); return Array.from(r.querySelectorAll('.case-mois .pastille')).map((c) => c.className.replace('pastille ', '')); }, nom);
    const l1 = await cases('ROXANE'), l2 = await cases('KONÉ'), l3 = await cases('NOUVELLE');
    ok(l1[0] === 'ok' && l1[1] === 'alerte', nomEcran + ' : janvier payé (vert), février en attente (orange) ' + l1.slice(0, 3));
    if (mc > 3) ok(l1[2] === 'erreur' && l2[0] === 'erreur', nomEcran + ' : mois passés sans paiement = non payé (rouge)');
    ok(l1[11] === 'neutre' || mc === 12, nomEcran + ' : décembre à venir (gris)');
    if (mc > 1) ok(l3[0] === 'neutre', nomEcran + ' : mois avant l’entrée = gris, pas rouge');
    ok(/✓/.test(await t()) && (await p.$$eval('table.matrice .sr-only', (l) => l.map((x) => x.textContent))).includes('janvier : payé'), nomEcran + ' : chaque pastille a un signe et un texte (pas seulement la couleur)');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nomEcran + ' : pas de défilement de côté de la page');
    await p.screenshot({ path: __dirname + '/medias/matrice-' + (ecran.width > 860 ? 'pc' : 'tel') + '.png' });
    await p.click('[data-action="matrice-annee"][data-sens="-1"]'); await p.waitForTimeout(800);
    ok(new RegExp('× mois · ' + (an - 1)).test(await t()), nomEcran + ' : année précédente');
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page ' + e.errs.join(' | '));
    await e.ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
