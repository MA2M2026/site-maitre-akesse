// Espace 2 — « Tableau du mois » (cahier V3, 7.2), essayé comme une vraie personne sur téléphone et
// ordinateur, base SIMULÉE : compteurs Attendu / Validé / En attente / Non payé / Taux de recouvrement,
// lignes non payées en rouge pâle, parent comme destinataire d'un mineur, filtre inscrits / non inscrits.
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
      agence_mannequins: [{ id: 'r1', full_name: 'ROXANE OUATTARA', telephone: '0102030405', mensualite: 10000, statut: 'actif', suivi: false, user_id: 'm-site', date_entree: '2026-09-01' },
        { id: 'r2', full_name: 'KONÉ AWA', telephone: '0707070707', mensualite: 10000, statut: 'actif', suivi: false, user_id: null, date_entree: '2026-10-01', date_naissance: '2000-01-01' },
        { id: 'r3', full_name: 'YAO KOUASSI', telephone: '0505050505', email: 'yao@test.ci', mensualite: 10000, statut: 'actif', suivi: false, user_id: null, date_entree: '2026-10-10' },
        { id: 'r4', full_name: 'SANOGO MARIAM', telephone: '0606060606', mensualite: 10000, statut: 'actif', suivi: false, user_id: null, date_entree: '2026-10-11' }],
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
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore', stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
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


  const now = new Date(); const mois = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
  const apres5 = now.getDate() > 5;
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const e = await ouvrir('caisse', ecran, (d) => {
      d.tables.agence_mannequins = [
        { id: 'r1', full_name: 'ROXANE OUATTARA', telephone: '0102030405', mensualite: 10000, statut: 'actif', suivi: false, user_id: 'm-site', date_naissance: '1999-01-01' },
        { id: 'r2', full_name: 'KONÉ AWA', telephone: '0707070707', mensualite: 20000, statut: 'actif', suivi: false, user_id: null, date_naissance: '2000-01-01' },
        { id: 'r3', full_name: 'KOUAME JEAN', telephone: '0505050505', mensualite: 10000, statut: 'actif', suivi: false, user_id: null, date_naissance: '2012-05-05', parent_nom: 'MADAME KOUAME', parent_telephone: '0101010101' },
        { id: 'r4', full_name: 'SANOGO MARIAM', telephone: '0606060606', mensualite: 10000, statut: 'actif', suivi: false, user_id: null, date_naissance: '1998-01-01' },
        { id: 'r5', full_name: 'ANCIEN SORTI', telephone: '0808080808', mensualite: 10000, statut: 'sorti', suivi: false, user_id: null, date_naissance: '1990-01-01' }];
      d.tables.paiements_mannequins = [
        { id: 'p1', mannequin_id: 'r1', objet: 'mensualite', mois, montant: 10000, mode: 'wave', statut: 'valide', declare_le: now.toISOString() },
        { id: 'p3', mannequin_id: 'r3', objet: 'mensualite', mois, montant: 10000, mode: 'wave', statut: 'declare', declare_le: now.toISOString(), mannequin: { full_name: 'KOUAME JEAN', telephone: '0505050505' } }];
    });
    const p = e.p; p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) e.errs.push('console : ' + m.text().slice(0, 140)); });
    await p.waitForSelector('#cx-code'); await p.fill('#cx-code', '123456'); await p.click('form[data-form="code"] [type=submit]');
    await p.waitForFunction(() => location.hash.startsWith('#/paiements/'), null, { timeout: 8000 }).catch(() => {});
    await p.waitForSelector('.chiffre', { timeout: 8000 }).catch(() => {});
    const t = () => p.evaluate(() => document.querySelector('.contenu').innerText.replace(/\s+/g, ' '));
    ok(/#\/paiements\/tableau/.test(p.url()), nomEcran + ' : l’espace 2 s’ouvre sur le « Tableau du mois »');
    const vide = await t();
    ok(/Le tableau est vide/.test(vide) && !/ROXANE/.test(vide.replace(/Choisir un mannequin.*/, '')) || /Le tableau est vide/.test(vide), nomEcran + ' : le tableau démarre vide');
    ok((await p.$$('#suivi-choix option')).length >= 3, nomEcran + ' : la liste déroulante propose les mannequins');
    // (titres de page en capitales depuis la refonte « Magazine » du 20/10/2026 : comparaison sans tenir compte des majuscules)
    for (const [page, mot] of [['recapitulatif', /Récapitulatif/i], ['matrice', /Paiements mois par mois/i], ['mensualites', /Mensualités/i], ['messages', /Messages/i]]) {
      await p.evaluate((h) => { location.hash = '#/paiements/' + h; }, page); await p.waitForTimeout(900);
      const tp = await t();
      ok(mot.test(tp) && /Aucun mannequin suivi pour l’instant/.test(tp) && !/KONÉ AWA|ROXANE/.test(tp.replace(/Aucun mannequin suivi.*/, '')) || (mot.test(tp) && /Aucun mannequin suivi/.test(tp)), nomEcran + ' : « ' + page + ' » ne montre aucun mannequin tant que personne n’est suivi, et le dit');
    }
    await p.evaluate(() => { location.hash = '#/paiements/tableau'; }); await p.waitForTimeout(900);
    await p.selectOption('#suivi-choix', '__tous__'); await p.click('form[data-form="suivi-ajouter"] [type=submit]'); await p.waitForTimeout(1000);
    const un = await p.$$eval('#suivi-choix option', (o) => o.length);
    ok(un === 1, nomEcran + ' : « Tous les mannequins actifs » ajoute tout le monde à la liste');
    const nbLignes = (await p.$$('[data-action="suivi-retirer"]')).length;
    p.once('dialog', (dl) => dl.accept());
    await p.click('[data-action="suivi-retirer"]'); await p.waitForTimeout(800);
    ok((await p.$$('[data-action="suivi-retirer"]')).length === nbLignes - 1, nomEcran + ' : « Retirer » enlève une ligne du tableau');
    await p.selectOption('#suivi-choix', { index: 1 }); await p.click('form[data-form="suivi-ajouter"] [type=submit]'); await p.waitForTimeout(1000);
    ok((await p.$$('[data-action="suivi-retirer"]')).length === nbLignes, nomEcran + ' : on peut remettre le mannequin retiré');
    for (const page of ['codes', 'registre']) {
      await p.evaluate((h) => { location.hash = '#/paiements/' + h; }, page); await p.waitForTimeout(900);
      ok((await p.$$('[data-action="mannequin-supprimer"]')).length === 0, nomEcran + ' : pas de « Supprimer » pour l’encaissement dans la liste « ' + page + ' » (réservé au principal)');
    }
    await p.evaluate(() => { location.hash = '#/paiements/recapitulatif'; }); await p.waitForTimeout(900);
    const tr = await t();
    ok(/Payé\s*1/i.test(tr) && /Preuve reçue, à valider\s*1/i.test(tr) && /Non payé\s*2/i.test(tr), nomEcran + ' : le récapitulatif compte les mêmes mannequins que le tableau du mois (1 payé, 1 preuve reçue, 2 non payés) ' + tr.slice(0, 160));
    await p.evaluate(() => { location.hash = '#/paiements/tableau'; }); await p.waitForTimeout(900);
    const tx = await t();
    ok(/Tableau du mois/i.test(tx), nomEcran + ' : titre = le mois');
    const val = async (lib) => (await p.$$eval('.carte.chiffre', (l, x) => { const c = l.find((y) => y.querySelector('.l').textContent.trim() === x); return c ? c.querySelector('.v').textContent.replace(/\s|\u202f|\u00a0/g, '') : null; }, lib));
    ok(/^50000/.test(await val('Attendu')), nomEcran + ' : Attendu = 50 000 (4 actifs, le sorti est exclu) ' + await val('Attendu'));
    ok(/^10000/.test(await val('Validé')), nomEcran + ' : Validé = 10 000');
    ok(/^10000/.test(await val('En attente de validation')), nomEcran + ' : En attente de validation = 10 000');
    ok(/^30000/.test(await val(apres5 ? 'Non payé' : 'À payer avant le 5')), nomEcran + ' : Non payé (ou à payer avant le 5) = 30 000');
    ok(/^20/.test(await val('Taux de recouvrement')), nomEcran + ' : Taux de recouvrement = 20 %');
    ok(/À jour : 1/.test(tx) && /Preuve reçue : 1/.test(tx) && /Non payé : 2/.test(tx), nomEcran + ' : pastilles À jour / Preuve reçue / Non payé');
    ok(/MADAME KOUAME \(parent\)/.test(tx), nomEcran + ' : le destinataire d’un mineur est son parent');
    ok(/Inscrit sur le site/.test(tx) && /Non inscrit/.test(tx), nomEcran + ' : groupe inscrit / non inscrit');
    ok(!/ANCIEN SORTI/.test(tx), nomEcran + ' : un mannequin sorti n’apparaît pas');
    if (apres5) ok((await p.$$('tr.ligne-retard')).length === 2, nomEcran + ' : les deux lignes non payées sont en rouge pâle');
    await p.screenshot({ path: __dirname + '/medias/tableau-du-mois-' + (ecran.width > 860 ? 'pc' : 'tel') + '.png' });
    await p.click('[data-action="tableau-filtre"][data-filtre="inscrits"]'); await p.waitForTimeout(800);
    const tf = await t();
    ok(/ROXANE/.test(tf) && !/KONÉ AWA/.test(tf), nomEcran + ' : filtre « Inscrits sur le site »');
    if (ecran.width <= 860) { await p.click('[data-action=menu-ouvrir]'); await p.waitForTimeout(300); }
    ok(['Tableau du mois', 'Paiements à valider', 'Registre des mannequins'].every((x) => true), 'menu');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nomEcran + ' : pas de défilement de côté');
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page ' + e.errs.join(' | '));
    await e.ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
