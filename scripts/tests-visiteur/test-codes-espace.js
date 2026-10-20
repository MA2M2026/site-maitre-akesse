// Espace 2 — « Codes de l'espace mannequin » (cahier V3, 7.2), essayé comme une vraie personne sur téléphone et
// ordinateur, base SIMULÉE : liste de tous les mannequins sans compte : origine (casting en ligne / ajouté par l'agence), état du code,
// génération, copie, WhatsApp au parent d'un mineur, pas de code sans inscription payée.
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


  const now = Date.now(), iso = (j) => new Date(now + j * 864e5).toISOString();
  const base = (d) => {
    d.tables.agence_mannequins = [
      { id: 'r1', full_name: 'KONÉ AWA', telephone: '0707070707', mensualite: 10000, statut: 'actif', user_id: null, candidature_id: 'c1', date_naissance: '2000-01-01' },
      { id: 'r2', full_name: 'KOUAME JEAN', telephone: '0505050505', mensualite: 10000, statut: 'actif', user_id: null, candidature_id: null, date_naissance: '2012-05-05', parent_nom: 'MADAME KOUAME', parent_telephone: '0101010101' },
      { id: 'r3', full_name: 'TRAORÉ BINTOU', telephone: '0606060606', mensualite: 10000, statut: 'actif', user_id: null, candidature_id: null, date_naissance: '1999-01-01' },
      { id: 'r4', full_name: 'DÉJÀ INSCRITE', telephone: '0808080808', mensualite: 10000, statut: 'actif', user_id: 'u-site', candidature_id: null, date_naissance: '1998-01-01' },
      { id: 'r5', full_name: 'CODE EXPIRÉ', telephone: '0909090909', mensualite: 10000, statut: 'actif', user_id: null, candidature_id: 'c5', date_naissance: '1997-01-01' }];
    const ins = (id) => ({ id: 'pi' + id, mannequin_id: id, objet: 'inscription', mois: null, montant: 15000, mode: 'wave', statut: 'valide', declare_le: iso(-3), valide_le: iso(-3) });
    d.tables.paiements_mannequins = [ins('r1'), ins('r2'), ins('r5')];   // r3 n'a pas payé
    d.tables.codes_espace = [
      { code: 'ESP-AAAAAA', mannequin_id: 'r2', annule: false, utilise_le: null, cree_le: iso(-1), expire_le: iso(6) },
      { code: 'ESP-OLDOLD', mannequin_id: 'r5', annule: false, utilise_le: null, cree_le: iso(-9), expire_le: iso(-2) }];
    d.rpc.code_espace_creer = (x) => { d.tables.codes_espace.push({ code: 'ESP-NEW234', mannequin_id: x.p_mannequin, annule: false, utilise_le: null, cree_le: iso(0), expire_le: iso(7) }); return 'ESP-NEW234'; };
  };
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const e = await ouvrir('caisse', ecran, base), p = e.p;
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) e.errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept());
    await p.waitForSelector('#cx-code'); await p.fill('#cx-code', '123456'); await p.click('form[data-form="code"] [type=submit]');
    await p.waitForSelector('.tuile, .lateral', { timeout: 8000 }).catch(() => {});
    await p.goto(p.url().split('#')[0] + '#/paiements/codes');
    await p.waitForSelector('.chiffre', { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(600);
    const t = () => p.evaluate(() => document.querySelector('.contenu').innerText.replace(/\s+/g, ' '));
    const tx = await t();
    ok(/Codes de l’espace mannequin/.test(tx), nomEcran + ' : page « Codes de l’espace mannequin » (encaissements)');
    ok(!/DÉJÀ INSCRITE/.test(tx), nomEcran + ' : un mannequin qui a déjà son espace n’est pas listé');
    ok(/Casting en ligne/.test(tx) && /Ajouté par l’agence/.test(tx), nomEcran + ' : origine affichée (casting en ligne / ajouté par l’agence)');
    ok(/MADAME KOUAME \(parent\)/.test(tx), nomEcran + ' : le destinataire d’un mineur est son parent');
    const val = (lib) => p.$$eval('.carte.chiffre', (l, x) => { const c = l.find((y) => y.querySelector('.l').textContent.trim() === x); return c ? c.querySelector('.v').textContent.trim() : null; }, lib);
    ok(await val('À générer') === '1' && await val('Actifs') === '1' && await val('Expirés') === '1', nomEcran + ' : compteurs À générer 1 / Actifs 1 / Expirés 1');
    const ligne = (nom) => p.$$eval('tbody tr', (rows, x) => { const r = rows.find((y) => y.textContent.includes(x)); return r ? r.innerText.replace(/\s+/g, ' ') : ''; }, nom);
    ok(/Code à générer/.test(await ligne('KONÉ AWA')) && /Générer le code/.test(await ligne('KONÉ AWA')), nomEcran + ' : inscription payée sans code → « Générer le code »');
    ok(/Code actif/.test(await ligne('KOUAME')) && /ESP-AAAAAA/.test(await ligne('KOUAME')), nomEcran + ' : code actif affiché avec sa date de fin');
    ok(/Inscription non payée/.test(await ligne('TRAORÉ')) && !/Générer le code/.test(await ligne('TRAORÉ')), nomEcran + ' : pas de code sans inscription payée');
    ok(!/Supprimer/.test(await ligne('TRAORÉ')), nomEcran + ' : pas de bouton « Supprimer » pour le responsable des encaissements (réservé au principal)');
    ok(/Code expiré/.test(await ligne('CODE EXPIRÉ')), nomEcran + ' : code expiré signalé');
    const wa = decodeURIComponent((await p.getAttribute('a.btn:has-text("WhatsApp")', 'href')) || '');
    ok(/^https:\/\/wa\.me\/2250101010101/.test(wa) && wa.includes('ESP-AAAAAA') && /Bonjour MADAME KOUAME/.test(wa) && /de KOUAME JEAN/.test(wa), nomEcran + ' : WhatsApp au parent, avec le code et le nom de l’enfant');
    // générer pour KONÉ AWA
    await p.evaluate(() => { const r = Array.from(document.querySelectorAll('tbody tr')).find((y) => y.textContent.includes('KONÉ AWA')); r.querySelector('[data-action="code-espace"]').click(); });
    await p.waitForTimeout(1500);
    ok(e.journal.some((j) => /code_espace_creer/.test(j[1] || '') && /"p_mannequin":"r1"/.test(j[2] || '')), nomEcran + ' : « Générer » appelle la base pour ce mannequin');
    ok(/ESP-NEW234/.test(await t()), nomEcran + ' : le nouveau code s’affiche dans la liste');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nomEcran + ' : pas de défilement de côté de la page');
    await p.screenshot({ path: __dirname + '/medias/codes-espace-' + (ecran.width > 860 ? 'pc' : 'tel') + '.png', fullPage: true });
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page ' + e.errs.join(' | '));
    await e.ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
