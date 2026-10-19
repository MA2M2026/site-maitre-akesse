// Espace 2 — « Paramètres » (cahier V3, 7.2), essayé comme une vraie personne sur téléphone et
// ordinateur, base SIMULÉE : liens Wave Business (ajout et désactivation par l'administrateur principal seul, lecture pour
// les encaissements, message clair si la table n'existe pas encore), montants et calendrier.
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


  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const connecter = async (role, reglage, avant) => {
      const e = await ouvrir(role, ecran, reglage);
      if (avant) await avant(e);
      e.p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) e.errs.push('console : ' + m.text().slice(0, 140)); });
      await e.p.waitForSelector('#cx-code'); await e.p.fill('#cx-code', '123456'); await e.p.click('form[data-form="code"] [type=submit]');
      await e.p.waitForFunction(() => location.hash.startsWith('#/paiements/') || location.hash === '' || location.hash === '#/', null, { timeout: 8000 }).catch(() => {});
      await e.p.waitForSelector('.tuile, .lateral', { timeout: 8000 }).catch(() => {});
      await e.p.goto(e.p.url().split('#')[0] + '#/paiements/parametres');
      await e.p.waitForSelector('.contenu h1', { timeout: 8000 }).catch(() => {});
      await e.p.waitForTimeout(800);
      return e;
    };
    const t = (p) => p.evaluate(() => document.querySelector('.contenu').innerText.replace(/\s+/g, ' '));
    // 1. administrateur principal, table présente
    const e = await connecter('principal', (d) => { d.tables.liens_wave = [
      { id: 'l1', type: 'inscription', libelle: 'Inscription 25 000', montant: 25000, adresse: 'https://pay.wave.com/m/M_ci_a/c/ci/', actif: true },
      { id: 'l2', type: 'mensualite', libelle: 'Ancien 10 000', montant: 10000, adresse: 'https://pay.wave.com/m/M_ci_old/c/ci/', actif: false }]; });
    const p = e.p, tx = await t(p);
    ok(/Paramètres/.test(tx) && /Liens de paiement Wave Business/.test(tx), nomEcran + ' : page « Paramètres »');
    ok(/25 000 FCFA/.test(tx) && /15 000 FCFA de droit d’inscription/.test(tx) && /10 000 FCFA/.test(tx) && /20 000 FCFA/.test(tx), nomEcran + ' : montants en vigueur affichés');
    ok(/Le 1er/.test(tx) && /Le 3/.test(tx) && /Le 5/.test(tx) && /Le 6/.test(tx), nomEcran + ' : calendrier du mois affiché');
    ok(/Inscription 25 000/.test(tx) && /Actif/.test(tx) && /Désactivé/.test(tx), nomEcran + ' : liens listés avec leur état');
    ok(await p.isVisible('form[data-form="lien-ajouter"]'), nomEcran + ' : l’administrateur principal peut ajouter un lien');
    const lienHref = await p.$eval('table a[target="_blank"]', (a) => a.getAttribute('rel'));
    ok(/noopener/.test(lienHref), nomEcran + ' : les liens s’ouvrent sans donner accès à la page d’origine');
    await p.fill('#lw-libelle', 'Mensualité 20 000'); await p.fill('#lw-montant', '20000'); await p.fill('#lw-adresse', 'http://pas-securise.example');
    await p.click('form[data-form="lien-ajouter"] [type=submit]'); await p.waitForTimeout(600);
    ok(!e.journal.some((j) => /liens_wave/.test(j[1]) && /POST/i.test(j[0] || '')), nomEcran + ' : un lien non sécurisé (http) n’est pas envoyé à la base');
    await p.fill('#lw-adresse', 'https://pay.wave.com/m/M_ci_new/c/ci/');
    await p.click('form[data-form="lien-ajouter"] [type=submit]'); await p.waitForTimeout(1200);
    ok(e.journal.some((j) => /liens_wave/.test(JSON.stringify(j)) && /20000/.test(JSON.stringify(j))), nomEcran + ' : le lien sécurisé est envoyé à la base');
    await p.click('[data-action="lien-etat"][data-actif="0"]'); await p.waitForTimeout(1000);
    ok(e.journal.some((j) => j[0] === 'PATCH' && j[1] === 'liens_wave' && /"actif":false/.test(j[3] || '')), nomEcran + ' : « Désactiver » envoie le changement (rien n’est supprimé)');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nomEcran + ' : pas de défilement de côté de la page');
    await p.screenshot({ path: __dirname + '/medias/parametres-' + (ecran.width > 860 ? 'pc' : 'tel') + '.png', fullPage: true });
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page (principal) ' + e.errs.join(' | '));
    await e.ctx.close();
    // 2. encaissements : lecture seule
    const c = await connecter('caisse', (d) => { d.tables.liens_wave = [{ id: 'l1', type: 'inscription', libelle: 'Inscription 25 000', montant: 25000, adresse: 'https://pay.wave.com/m/M_ci_a/c/ci/', actif: true }]; });
    const tc = await t(c.p);
    ok(/Inscription 25 000/.test(tc) && !(await c.p.isVisible('form[data-form="lien-ajouter"]')) && !(await c.p.$('[data-action="lien-etat"]')), nomEcran + ' : encaissements → liens en lecture seule, ni ajout ni désactivation');
    ok(/Seul l’administrateur principal/.test(tc), nomEcran + ' : message expliquant pourquoi');
    await c.ctx.close();
    // 3. table pas encore créée
    const a = await connecter('principal', null, (x) => x.p.route(/\/rest\/v1\/liens_wave/, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: '42P01', message: 'relation "public.liens_wave" does not exist' }) })));
    const ta = await t(a.p);
    ok(/ne sont pas encore activés|supabase-parametres\.sql/.test(ta) && !(await a.p.isVisible('form[data-form="lien-ajouter"]')), nomEcran + ' : table absente → message clair, pas d’erreur de page');
    ok(!a.errs.length, nomEcran + ' : aucune erreur de page (table absente) ' + a.errs.join(' | '));
    await a.ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
