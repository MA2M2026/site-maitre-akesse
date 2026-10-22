// Espace 1 DANS le cadre du portail (cahier V3, 3.1), essayé comme une vraie personne sur téléphone
// et ordinateur, base SIMULÉE : la tuile ouvre l'espace sans quitter le portail, le menu de la coque
// reste, chaque rubrique s'ouvre dans la zone centrale, « Retour au portail » ramène aux tuiles,
// l'ancien menu du tableau de bord n'est plus affiché, aucune deuxième connexion.
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


    const ESPACE1 = { admins: [{ user_id: 'admin-1' }],
    casting_applications: [{ id: 'c1', full_name: 'AWA KONÉ', email: 'awa@test.ci', phone: '+225 0102030405', genre: 'femme', date_naissance: '2000-01-01', type_candidature: 'agence', status: 'nouvelle', created_at: '2026-10-07T10:00:00Z' },
      { id: 'c2', full_name: 'BINTOU TRAORÉ', email: 'bintou@test.ci', phone: '+225 0505050505', genre: 'femme', date_naissance: '1998-01-01', type_candidature: 'agence', status: 'en étude', created_at: '2026-10-08T10:00:00Z' },
      { id: 'c3', full_name: 'YAO KOUASSI', email: 'yao@test.ci', phone: '+225 0707070707', genre: 'homme', date_naissance: '1999-01-01', type_candidature: 'agence', status: 'retenue', created_at: '2026-10-09T10:00:00Z' },
      { id: 'c4', full_name: 'AKESSE FRANCK', email: 'enfant@test.ci', phone: '+225 0198138600', genre: 'homme', date_naissance: '2014-10-05', type_candidature: 'agence', status: 'retenue', created_at: '2026-09-01T10:00:00Z',
        parent_nom: 'Monsieur Akesse Paul', parent_telephone: '+225 0777071859' }],
    codes_inscription: [],
    inscriptions_mannequins: [{ id: 'i1', nom: 'YAO', prenoms: 'Kouassi', statut: 'en attente de paiement', created_at: '2026-10-06T10:00:00Z' }],
    model_profiles: [{ id: 'm1', full_name: 'MARIAM SANOGO', city: 'Abidjan', published: true, desactive: false }],
    partenaires: [{ id: 'p1', nom: 'Maison XYZ', ordre: 1 }] };
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const pin = { defini: true, verrouille: false };
    const e = await ouvrir('principal', ecran, (d) => {
      Object.assign(d.tables, ESPACE1);
      d.rpc.code_validation_statut = [{ defini: true }];
      d.rpc.portail_code_appareil_etat = () => ({ defini: pin.defini, verrouille: pin.verrouille });
    });
    const pe = e.p;
    pe.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) e.errs.push('console : ' + m.text().slice(0, 140)); });
    await pe.waitForSelector('#cx-code'); await pe.fill('#cx-code', '123456'); await pe.click('form[data-form="code"] [type=submit]');
    await pe.waitForSelector('.tuile');
    await pe.click('.tuile[href^="#/site/"]');
    await pe.waitForSelector('#cadre-ancien', { timeout: 8000 });
    const cadre = await (await pe.$('#cadre-ancien')).contentFrame();
    await cadre.waitForSelector('#bloc-tableau', { state: 'visible', timeout: 12000 }).catch(() => {});
    await pe.waitForTimeout(1500);
    ok(pe.url().includes('/admin/') && !pe.url().includes('tableau-de-bord'), nomEcran + ' : on reste dans le portail (adresse /admin/)');
    ok(await cadre.isVisible('#bloc-tableau'), nomEcran + ' : l’ancien tableau de bord s’affiche dans la zone centrale');
    ok(await pe.isVisible('.contenu #cadre-ancien'), nomEcran + ' : le cadre est dans le contenu de la coque');
    ok(!/Ouverture du tableau de bord/.test(await cadre.evaluate(() => document.body.innerText)) && !(await cadre.isVisible('#tdb-verif-msg')), nomEcran + ' : plus d’écran noir « Ouverture du tableau de bord… »');
    ok(!(await pe.$eval('#cadre-ancien', (f) => f.classList.contains('cadre-cache'))) && !(await pe.isVisible('.cadre-chargement')), nomEcran + ' : « Chargement… » du portail disparu, la page est visible');
    ok((await pe.$$('img.logo-portail')).length >= 1 && !(await pe.evaluate(() => /M A 2 M/.test(document.body.innerText))), nomEcran + ' : le logo remplace « M A 2 M »');
    if (ecran.width > 860) ok(await pe.isVisible('#menu-lateral'), nomEcran + ' : le menu sombre du portail reste affiché');
    else { await pe.click('[data-action=menu-ouvrir]'); await pe.waitForTimeout(400); ok(await pe.isVisible('#menu-lateral'), nomEcran + ' : « ☰ Menu » ouvre le menu du portail'); }
    const items = await pe.$$eval('#menu-lateral a.nav', (l) => l.map((x) => x.textContent.trim()));
    ok(['Vue d’ensemble', 'Candidatures casting', 'Demandes recruteurs', 'Actualités', 'Codes d’accès'].every((x) => items.includes(x)), nomEcran + ' : menu de l’espace 1 complet ' + items.length + ' rubriques');
    ok(await pe.isVisible('#menu-lateral >> text=Retour au portail'), nomEcran + ' : bouton « Retour au portail » présent');
    ok(!(await cadre.isVisible('#v2-cote')) && !(await cadre.isVisible('#v2-blocs')) && !(await cadre.isVisible('.tdb-menu-toggle')) && !(await cadre.isVisible('.adm-barre')), nomEcran + ' : l’ancien menu et l’ancienne barre sont masqués dans le cadre');
    ok(!(await cadre.isVisible('#bloc-login')) && !e.journal.some((j) => j[1] === '/api/connexion-protegee' && /"espace":"admin"/.test(j[2] || '')), nomEcran + ' : aucune deuxième connexion');
    await pe.screenshot({ path: __dirname + '/medias/espace1-cadre-vue-' + (ecran.width > 860 ? 'pc' : 'tel') + '.png' });
    // changer de rubrique : le cadre n'est pas rechargé, l'adresse du portail change
    const avant = await pe.evaluate(() => { window.__marque = 1; document.getElementById('cadre-ancien').contentWindow.__m = 7; return true; });
    if (ecran.width <= 860) { /* menu déjà ouvert */ } 
    await pe.click('#menu-lateral a.nav[href="#/site/b2-candidatures"]'); await pe.waitForTimeout(1500);
    ok(pe.url().endsWith('#/site/b2-candidatures'), nomEcran + ' : l’adresse du portail suit la rubrique');
    ok(await pe.evaluate(() => document.getElementById('cadre-ancien').contentWindow.__m === 7), nomEcran + ' : le cadre n’a pas été rechargé');
    ok(await cadre.isVisible('#liste-candidatures'), nomEcran + ' : la liste des candidatures s’ouvre dans la zone centrale');
    ok(await pe.evaluate(() => document.querySelector('#menu-lateral a.nav.actif').getAttribute('href') === '#/site/b2-candidatures'), nomEcran + ' : la rubrique active est signalée dans le menu');
    // Page rafraîchie sur un réseau lent (22/10/2026, « on voit un fond noir ») : tant que le nouvel
    // habillage clair (css/tableau-v2.css) n'est pas arrivé, le fond du cadre doit déjà être clair.
    await pe.route(/tableau-v2\.css/, (r) => r.abort());
    await cadre.evaluate(() => location.reload()).catch(() => {}); await pe.waitForTimeout(2500);
    const cadreLent = await (await pe.$('#cadre-ancien')).contentFrame();
    const fond = await cadreLent.evaluate(() => getComputedStyle(document.body).backgroundColor).catch(() => '?');
    const sombre = /rgb\((\d+), (\d+), (\d+)/.exec(fond);
    ok(sombre && Number(sombre[1]) + Number(sombre[2]) + Number(sombre[3]) > 600, nomEcran + ' : page rafraîchie, habillage pas encore arrivé : fond clair, pas noir (' + fond + ')');
    await pe.unroute(/tableau-v2\.css/);
    // une rubrique qui est une page entière (partenaires)
    if (ecran.width <= 860) { await pe.click('[data-action=menu-ouvrir]'); await pe.waitForTimeout(400); }
    await pe.click('#menu-lateral a.nav[href="#/site/partenaires"]'); await pe.waitForTimeout(2500);
    const cadre2 = await (await pe.$('#cadre-ancien')).contentFrame();
    ok(/partenaires/.test(cadre2.url()) && !(await cadre2.isVisible('.adm-barre')), nomEcran + ' : « Partenaires » s’ouvre dans le cadre, sans barre en double');
    // retour au portail
    if (ecran.width <= 860) { await pe.click('[data-action=menu-ouvrir]'); await pe.waitForTimeout(400); }
    await pe.click('#menu-lateral >> text=Retour au portail'); await pe.waitForSelector('.tuile', { timeout: 6000 });
    ok(!(await pe.$('#cadre-ancien')), nomEcran + ' : « Retour au portail » ramène aux tuiles');
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page ' + e.errs.join(' | '));
    await e.ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
