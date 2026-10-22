// Espace 2 — Corriger ou annuler un paiement (cahier V3, 7.2), essayé comme une vraie personne sur téléphone et
// ordinateur, base SIMULÉE : fiche d'un mannequin : « Corriger » (montant, moyen, motif) et « Annuler » (motif, rien n'est effacé,
// l'inscription payée en une fois est annulée en entier), réservés à l'administrateur principal.
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
  const t0 = new Date(Date.now() - 864e5).toISOString();
  const base = (d) => {
    d.tables.agence_mannequins = [{ id: 'r1', full_name: 'KONÉ AWA', telephone: '0707070707', mensualite: 10000, statut: 'actif', user_id: null, date_entree: mm(1), date_naissance: '2000-01-01' }];
    d.tables.paiements_mannequins = [
      { id: 'pi', mannequin_id: 'r1', objet: 'inscription', mois: null, montant: 15000, mode: 'wave', statut: 'valide', declare_le: t0, valide_le: t0 },
      { id: 'pm0', mannequin_id: 'r1', objet: 'mensualite', mois: mm(mc), montant: 10000, mode: 'wave', statut: 'valide', declare_le: t0, valide_le: t0 },
      { id: 'pm1', mannequin_id: 'r1', objet: 'mensualite', mois: mm(mc > 1 ? mc - 1 : 1), montant: 10000, mode: 'especes', statut: 'valide', declare_le: new Date(Date.now() - 5 * 864e5).toISOString(), valide_le: new Date(Date.now() - 5 * 864e5).toISOString() }];
    d.tables.codes_espace = [];
  };
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const connecter = async (role) => {
      const e = await ouvrir(role, ecran, base);
      e.p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) e.errs.push('console : ' + m.text().slice(0, 140)); });
      e.p.on('dialog', (dl) => (dl.type() === 'prompt' ? dl.accept('saisi sur le mauvais mois') : dl.accept()));
      await e.p.waitForSelector('#cx-code'); await e.p.fill('#cx-code', '123456'); await e.p.click('form[data-form="code"] [type=submit]');
      await e.p.waitForSelector('.tuile, .lateral', { timeout: 8000 }).catch(() => {});
      await e.p.goto(e.p.url().split('#')[0] + '#/paiements/fiche/r1');
      await e.p.waitForSelector('[data-form="registre-modifier"]', { timeout: 8000 }).catch(() => {});
      await e.p.waitForTimeout(600);
      return e;
    };
    const t = (p) => p.evaluate(() => document.querySelector('.contenu').innerText.replace(/\s+/g, ' '));
    const e = await connecter('principal'), p = e.p;
    ok((await p.$$('[data-action="paiement-corriger"]')).length === 3 && (await p.$$('[data-action="paiement-annuler"]')).length === 3, nomEcran + ' : l’administrateur principal voit « Corriger » et « Annuler » sur chaque paiement');
    // corriger le montant et le moyen d'une mensualité
    await p.click('[data-action="paiement-corriger"][data-id="pm1"]'); await p.waitForSelector('form[data-form="paiement-corriger"]', { timeout: 4000 });
    await p.fill('#pc-montant', '20000'); await p.selectOption('#pc-mode', 'wave');
    await p.fill('#pc-motif', 'Mensualité majorée oubliée');
    await p.click('form[data-form="paiement-corriger"] [type=submit]'); await p.waitForTimeout(1200);
    const maj = e.journal.find((j) => j[0] === 'PATCH' && j[1] === 'paiements_mannequins' && /pm1/.test(j[2]));
    ok(maj && JSON.parse(maj[3]).montant === 20000 && JSON.parse(maj[3]).mode === 'wave' && /^Corrigé : Mensualité majorée oubliée/.test(JSON.parse(maj[3]).motif), nomEcran + ' : la correction (montant, moyen, motif) est envoyée ' + (maj ? maj[3] : 'rien'));
    ok(/20 000 FCFA/.test(await t(p)), nomEcran + ' : le nouveau montant s’affiche');
    // sans motif : refusé côté écran
    await p.click('[data-action="paiement-corriger"][data-id="pm1"]'); await p.waitForSelector('form[data-form="paiement-corriger"]');
    const avantN = e.journal.filter((j) => j[0] === 'PATCH').length;
    await p.fill('#pc-motif', '   '); await p.click('form[data-form="paiement-corriger"] [type=submit]'); await p.waitForTimeout(500);
    ok(e.journal.filter((j) => j[0] === 'PATCH').length === avantN, nomEcran + ' : une correction sans motif n’est pas envoyée');
    await p.click('#fenetre [data-action="fermer-fenetre"]'); await p.waitForTimeout(300);
    // annuler une mensualité (mauvais mois)
    await p.click('[data-action="paiement-annuler"][data-id="pm0"]'); await p.waitForTimeout(1500);
    const an1 = e.journal.filter((j) => j[0] === 'PATCH' && /pm0/.test(j[2]));
    ok(an1.length === 1 && JSON.parse(an1[0][3]).statut === 'refuse' && /^Annulé : saisi sur le mauvais mois/.test(JSON.parse(an1[0][3]).motif), nomEcran + ' : l’annulation passe le paiement à « refusé » avec son motif, rien n’est supprimé');
    ok(!e.journal.some((j) => j[0] === 'DELETE'), nomEcran + ' : aucune suppression');
    ok(/Annulé/.test(await t(p)) && /saisi sur le mauvais mois/.test(await t(p)), nomEcran + ' : le paiement reste dans la liste, marqué « Annulé » avec son motif');
    ok(!(await p.$('[data-action="paiement-annuler"][data-id="pm0"]')), nomEcran + ' : plus de bouton sur un paiement déjà annulé');
    // annuler l'inscription : les deux lignes liées (droit d'inscription + 1er mois) partent ensemble
    // (pi et pm0 ont le même instant ; pm0 déjà annulé → seule pi reste ici)
    await p.click('[data-action="paiement-annuler"][data-id="pi"]'); await p.waitForTimeout(1500);
    ok(e.journal.some((j) => j[0] === 'PATCH' && /pi\b/.test(j[2]) && /refuse/.test(j[3] || '')), nomEcran + ' : l’inscription peut être annulée');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nomEcran + ' : pas de défilement de côté de la page');
    await p.screenshot({ path: __dirname + '/medias/correction-paiement-' + (ecran.width > 860 ? 'pc' : 'tel') + '.png', fullPage: true });
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page (principal) ' + e.errs.join(' | '));
    await e.ctx.close();
    // encaissements : ni correction ni annulation
    const c = await connecter('caisse');
    ok(!(await c.p.$('[data-action="paiement-corriger"]')) && !(await c.p.$('[data-action="paiement-annuler"]')) && /demandez à l’administrateur principal/.test(await t(c.p)), nomEcran + ' : encaissements → aucun bouton, message qui renvoie à l’administrateur principal');
    await c.ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
