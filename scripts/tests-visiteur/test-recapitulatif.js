// Espace 2 — « Récapitulatif de fin de mois » (cahier V3, 7.2), essayé comme une vraie personne sur téléphone et
// ordinateur, base SIMULÉE : deux listes, jours de retard, mois impayés d'affilée, montant dû, exports PDF et Excel,
// relance WhatsApp par personne, changement de mois.
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


  const now = new Date(); const an = now.getFullYear(), mc = now.getMonth() + 1;
  const mm = (n) => an + '-' + String(n).padStart(2, '0') + '-01';
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const e = await ouvrir('caisse', ecran, (d) => {
      d.tables.agence_mannequins = [
        { id: 'r1', full_name: 'ROXANE OUATTARA', telephone: '0102030405', mensualite: 10000, statut: 'actif', date_entree: mm(1), date_naissance: '1999-01-01' },
        { id: 'r2', full_name: 'KONÉ AWA', telephone: '0707070707', mensualite: 20000, statut: 'actif', date_entree: mm(mc - 2), date_naissance: '2000-01-01' },
        { id: 'r3', full_name: 'KOUAME JEAN', telephone: '0505050505', mensualite: 10000, statut: 'actif', date_entree: mm(mc - 2), date_naissance: '2012-05-05', parent_nom: 'MADAME KOUAME', parent_telephone: '0101010101' },
        { id: 'r4', full_name: 'ENTRÉE PLUS TARD', telephone: '0606060606', mensualite: 10000, statut: 'actif', date_entree: mm(Math.min(mc + 1, 12)), date_naissance: '1998-01-01' }];
      const ligne = (id, n, st) => ({ id: id + n, mannequin_id: id, objet: 'mensualite', mois: mm(n), montant: 10000, statut: st });
      d.tables.paiements_mannequins = [ligne('r1', mc, 'valide'), ligne('r1', mc - 1, 'valide'), ligne('r3', mc, 'declare'), ligne('r3', mc - 2, 'valide'), ligne('r3', mc - 1, 'valide')];
    });
    const p = e.p; p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) e.errs.push('console : ' + m.text().slice(0, 140)); });
    await p.waitForSelector('#cx-code'); await p.fill('#cx-code', '123456'); await p.click('form[data-form="code"] [type=submit]');
    await p.waitForFunction(() => location.hash.startsWith('#/paiements/'), null, { timeout: 8000 }).catch(() => {});
    await p.goto(p.url().split('#')[0] + '#/paiements/recapitulatif');
    await p.waitForSelector('[data-action="recap-export"]', { timeout: 8000 }).catch(() => {});
    const t = () => p.evaluate(() => document.querySelector('.contenu').innerText.replace(/\s+/g, ' '));
    const tx = await t();
    ok(/Récapitulatif/.test(tx), nomEcran + ' : page « Récapitulatif de fin de mois »');
    const val = (lib) => p.$$eval('.carte.chiffre', (l, x) => { const c = l.find((y) => y.querySelector('.l').textContent.trim() === x); return c ? c.querySelector('.v').textContent.replace(/\s|\u202f|\u00a0/g, '') : null; }, lib);
    ok(/^1/.test(await val('Payé')), nomEcran + ' : Payé = 1 (ROXANE) ' + await val('Payé'));
    // trois groupes (22/10/2026) : la preuve reçue de KOUAME n'est plus un impayé
    ok(/^1/.test(await val('Preuve reçue, à valider')) && /^1/.test(await val('Non payé')), nomEcran + ' : Preuve reçue, à valider = 1 (KOUAME) ; Non payé = 1 (KONÉ)');
    const impayes = await p.$$eval('.carte', (l) => { const c = l.find((x) => (x.querySelector('h2') || {}).textContent === 'Non payé'); return c ? c.innerText : ''; });
    ok(/KONÉ AWA/.test(impayes) && !/KOUAME/.test(impayes), nomEcran + ' : la liste « Non payé » ne contient pas la preuve en attente');
    const apres5 = now.getDate() > 5;
    // KONÉ (jamais payé depuis son entrée), KOUAME (preuve reçue), pas « entrée plus tard » (pas encore dû)
    ok(/KONÉ AWA/.test(tx) && /KOUAME JEAN/.test(tx) && !/ENTRÉE PLUS TARD/.test(tx), nomEcran + ' : la liste des impayés exclut celui qui n’est pas encore entré');
    ok(/MADAME KOUAME \(parent\)/.test(tx), nomEcran + ' : le destinataire d’un mineur est son parent');
    if (apres5) {
      ok(/^[0-9]+FCFA/.test(await val('Montant dû')) && parseInt(await val('Montant dû'), 10) >= 60000, nomEcran + ' : montant dû affiché ' + await val('Montant dû'));
      const kone = await p.$$eval('tr', (rows) => { const r = rows.find((y) => y.textContent.includes('KONÉ AWA')); return Array.from(r.querySelectorAll('td')).map((c) => c.textContent.trim()); });
      ok(kone[3] === '3' && /^60/.test(kone[4].replace(/\s|\u202f|\u00a0/g, '')), nomEcran + ' : KONÉ = 3 mois d’affilée × 20 000 = 60 000 ' + kone.join('|'));
      ok(Number(kone[2]) >= 1, nomEcran + ' : jours de retard comptés ' + kone[2]);
      ok(/dont .* : 20 000 FCFA · dont mois précédents : 40 000 FCFA/.test(tx.replace(/\u202f|\u00a0/g, ' ')), nomEcran + ' : montant dû coupé en deux (ce mois-ci / mois précédents)');
    }
    ok(await p.isVisible('a.btn:has-text("Relancer")'), nomEcran + ' : bouton « Relancer » (WhatsApp)');
    const href = decodeURIComponent((await p.getAttribute('a.btn:has-text("Relancer")', 'href')) || '');
    ok(/^https:\/\/wa\.me\/225/.test(href), nomEcran + ' : le lien WhatsApp part sur le numéro du mannequin');
    // exports
    for (const [fmt, ext] of [['pdf', '.pdf'], ['xlsx', '.xlsx']]) {
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), p.click('[data-action="recap-export"][data-format="' + fmt + '"]')]);
      const chemin = dl ? await dl.path() : null; const debut = chemin ? require('fs').readFileSync(chemin).slice(0, 4).toString('latin1') : '';
      ok(dl && dl.suggestedFilename().endsWith(ext) && (fmt === 'pdf' ? debut === '%PDF' : debut.startsWith('PK')), nomEcran + ' : export ' + fmt.toUpperCase() + ' téléchargé, fichier valide ' + (dl ? dl.suggestedFilename() : 'aucun'));
    }
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nomEcran + ' : pas de défilement de côté de la page');
    await p.screenshot({ path: __dirname + '/medias/recapitulatif-' + (ecran.width > 860 ? 'pc' : 'tel') + '.png' });
    await p.click('[data-action="recap-mois"][data-sens="-1"]'); await p.waitForTimeout(800);
    ok(/Récapitulatif · /.test(await t()), nomEcran + ' : mois précédent');
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page ' + e.errs.join(' | '));
    await e.ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
