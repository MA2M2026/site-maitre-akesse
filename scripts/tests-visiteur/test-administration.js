// Administration (cahier v2.3, mise à jour v2.4) — étape 1 essayée comme une vraie personne, sur
// téléphone et ordinateur, avec une base SIMULÉE (rien n'est écrit pour de vrai) :
//  - connexion : mot de passe, puis code de double authentification (un mauvais code est refusé) ;
//  - première connexion : activation de la double authentification, 8 codes de secours ;
//  - administrateur principal : trois tuiles aux libellés exacts, chaque espace s'ouvre, sécurité ;
//  - une personne n'ayant droit qu'à un espace y arrive directement, sans tuile des autres ;
//  - menu « ☰ Menu » sur téléphone et tablette en vertical, toujours à gauche sur ordinateur ;
//  - code à 4 chiffres de l'appareil : choix, verrouillage après 15 minutes, déverrouillage ;
//  - lisibilité des écrans, boutons au modèle rouge, aucune erreur de page.
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
        { id: 'pi4', mannequin_id: 'r4', objet: 'inscription', mois: null, montant: 15000, mode: 'wave', statut: 'valide', declare_le: '2026-10-15T09:00:00Z', valide_le: '2026-10-15T10:00:00Z', mannequin: { full_name: 'SANOGO MARIAM' } }],
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
    // 1. Administrateur principal : mot de passe, mauvais code refusé, bon code → trois tuiles
    const { ctx, p, errs, journal, d } = await ouvrir('principal', ecran);
    await p.waitForSelector('#cx-code');
    ok(/étape 2 sur 2/i.test(await texte(p)), nomEcran + ' : après le mot de passe, la double authentification est demandée');
    await p.fill('#cx-code', '000000'); await p.click('form[data-form="code"] [type=submit]');
    await p.waitForSelector('.note.erreur');
    ok((await texte(p)).includes('Code incorrect'), nomEcran + ' : un mauvais code est refusé');
    await p.fill('#cx-code', '123456'); await p.click('form[data-form="code"] [type=submit]');
    await p.waitForSelector('.tuile');
    ok((await p.$$('.tuile')).length === 3, nomEcran + ' : administrateur principal → trois tuiles rouges');
    const libelles = await p.$$eval('.tuile .tt', (l) => l.map((x) => x.textContent));
    ok(libelles.join('|') === 'Administration du site|Suivi des paiements et des inscriptions|Comptabilité', nomEcran + ' : libellés exacts des trois tuiles');
    let mal = await pales(p); ok(!mal.length, nomEcran + ' : écran des tuiles lisible ' + mal.join(' | '));
    // menu : à gauche sur ordinateur ; sur téléphone et tablette en vertical, bouton « ☰ Menu » qui fait glisser le menu
    for (const largeur of nomEcran === 'téléphone' ? [390, 768] : [1280]) {
      await p.setViewportSize({ width: largeur, height: ecran.height });
      await p.goto(url + '#/compta/mois'); await p.waitForSelector('.lateral .nav', { state: 'attached' });
      const vu = () => p.evaluate(() => { const r = document.querySelector('.lateral').getBoundingClientRect(); return getComputedStyle(document.querySelector('.lateral')).visibility === 'visible' && r.right > 50; });
      if (largeur >= 1000) {
        ok(await vu() && !(await p.isVisible('[data-action="menu-ouvrir"]')), nomEcran + ' : menu toujours visible à gauche, sans bouton « Menu »');
      } else {
        ok(!(await vu()) && await p.isVisible('[data-action="menu-ouvrir"]'), largeur + ' px : menu caché, bouton « ☰ Menu » en haut');
        // (19/10/2026) la barre noire reste fine, même quand la page est courte
        await p.waitForFunction(() => !document.querySelector('#contenu .chargement'), null, { timeout: 6000 }).catch(() => {});
        const hBarre = await p.evaluate(() => document.querySelector('.barre-menu').getBoundingClientRect().height);
        ok(hBarre < 90, largeur + ' px : barre noire du haut fine (' + Math.round(hBarre) + ' px)');
        await p.click('[data-action="menu-ouvrir"]'); await p.waitForTimeout(400);
        const r = await p.evaluate(() => document.querySelector('.lateral').getBoundingClientRect().left);
        ok(await vu() && r === 0, largeur + ' px : « ☰ Menu » fait glisser le menu depuis la gauche');
        await p.click('.lateral .nav[href="#/compta/mois"]'); await p.waitForTimeout(500);
        ok(!(await vu()) && (await p.evaluate(() => location.hash)) === '#/compta/mois', largeur + ' px : choisir une rubrique l’ouvre et referme le menu');
        await p.click('[data-action="menu-ouvrir"]'); await p.waitForTimeout(400);
        await p.mouse.click(largeur - 10, 400); await p.waitForTimeout(400);
        ok(!(await vu()), largeur + ' px : toucher à côté du menu le referme');
      }
    }
    await p.setViewportSize(ecran);
    // chaque espace et chaque page de la sécurité s'ouvre
    const pages = { paiements: ['a-valider', 'mensualites', 'registre', 'ajouter'], compta: ['mois', 'recettes', 'depenses', 'tresorerie'], securite: ['comptes', 'delegations', 'appareils', 'journal', 'codes'] };
    for (const [esp, liste] of Object.entries(pages)) {
      for (const pg of liste) {
        await p.goto(url + '#/' + esp + '/' + pg); await p.waitForSelector('.contenu h1, .contenu .carte h2', { timeout: 6000 }).catch(() => {});
        await p.waitForFunction(() => !document.querySelector('.chargement'), null, { timeout: 6000 }).catch(() => {});
        const t = await texte(p);
        const boutons = (await p.evaluate(verifierBoutons)).map((x) => x.texte + ' (' + x.element + ', fond ' + x.fond + ', texte ' + x.couleur + ', coins ' + x.rayon + ')');
        ok(!boutons.length, nomEcran + ' : ' + esp + '/' + pg + ' boutons au modèle rouge ' + boutons.join(' | '));
        ok(!t.includes('Impossible d’afficher') && !t.includes('Accès refusé'), nomEcran + ' : ' + esp + '/' + pg + ' s’affiche');
        mal = await pales(p); ok(!mal.length, nomEcran + ' : ' + esp + '/' + pg + ' lisible ' + mal.join(' | '));
      }
    }
    // codes de secours refaits depuis la Sécurité (jamais reçus : double authentification activée
    // avant le portail) — le serveur exige d'abord un code récent
    let demandes = 0;
    d.api['/api/portail'] = (corps) => corps.action !== 'codes_secours_creer' ? { ok: true }
      : ++demandes === 1 ? { statut: 403, error: 'AUTH_RECENTE: confirmez votre code.' } : donnees('principal').api['/api/portail'](corps);
    await p.goto(url + '#/securite/codes'); await p.waitForSelector('[data-action="securite-codes"]');
    p.once('dialog', (dl) => dl.accept());
    await p.click('[data-action="securite-codes"]');
    await p.waitForSelector('#cf-code');
    ok((await texte(p)).includes('Action sensible'), nomEcran + ' : « Créer mes 8 codes de secours » redemande le code d’authentification');
    await p.fill('#cf-code', '123456'); await p.click('form[data-form="confirmer-code"] [type=submit]');
    await p.waitForSelector('.codes-secours');
    ok((await p.$$('.codes-secours span')).length === 8 && demandes === 2, nomEcran + ' : après le code, les 8 nouveaux codes de secours s’affichent');
    await p.click('[data-action="fermer-fenetre"]');
    ok(!(await p.isVisible('.codes-secours')) && (await p.evaluate(() => location.hash)) === '#/securite/codes', nomEcran + ' : « Je les ai notés » ferme la fenêtre, on reste sur la page');
    ok(!errs.length, nomEcran + ' : aucune erreur de page (principal) ' + errs.join(' | '));
    await ctx.close();

    // un seul espace : la personne y arrive directement, sans voir les autres
    for (const [role, esp] of [['site', 'site'], ['compta', 'compta']]) {
      const s = await ouvrir(role, ecran);
      await s.p.waitForSelector('#cx-code'); await s.p.fill('#cx-code', '123456'); await s.p.click('form[data-form="code"] [type=submit]');
      // (espace 1 : l'ancien tableau de bord, ouvert dans l'Administration — essayé plus bas)
      const attendu = esp === 'site' ? '/tableau-de-bord.html' : '#/' + esp + '/';
      await s.p.waitForFunction((a) => location.href.includes(a), attendu, { timeout: 6000 }).catch(() => {});
      ok(s.p.url().includes(attendu), nomEcran + ' : rôle « ' + role + ' » → arrive directement dans son espace');
      await s.p.goto(url + '#/paiements/accueil'); await s.p.waitForTimeout(500);
      ok((await texte(s.p)).includes('Accès refusé'), nomEcran + ' : rôle « ' + role + ' » → l’espace paiements est refusé');
      ok(!s.errs.length, nomEcran + ' : aucune erreur de page (' + role + ') ' + s.errs.join(' | '));
      await s.ctx.close();
    }

    // 4. Première connexion : activation de la double authentification + codes de secours
    const n = await ouvrir('caisse', ecran, (d) => { d.portail.facteurs = false; });
    await n.p.waitForSelector('#cx-nouveau');
    ok((await texte(n.p)).includes('Activer la double authentification'), nomEcran + ' : première connexion → activation obligatoire');
    await n.p.waitForSelector('#qr-zone img');
    await n.p.fill('#cx-nouveau', '654321'); await n.p.click('form[data-form="activer-code"] [type=submit]');
    await n.p.waitForSelector('.codes-secours');
    ok((await n.p.$$('.codes-secours span')).length === 8, nomEcran + ' : 8 codes de secours affichés une seule fois');
    await n.p.click('[data-action="fermer-fenetre-demarrer"]');
    await n.p.waitForFunction(() => location.hash.startsWith('#/paiements/'), null, { timeout: 6000 }).catch(() => {});
    ok(n.p.url().includes('#/paiements/'), nomEcran + ' : l’encaissement arrive dans son seul espace');
    ok(!n.errs.length, nomEcran + ' : aucune erreur de page (première connexion) ' + n.errs.join(' | '));
    await n.ctx.close();
  }
  // Code à 4 chiffres de l'appareil (cahier : verrouillage après 15 minutes d'inactivité)
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    // a) juste après la connexion complète, sur un appareil sans code : choisir le code
    const pin = { defini: false, verrouille: false, code: null, essais: 0 };
    const c = await ouvrir('principal', ecran, (d) => {
      d.rpc.portail_code_appareil_etat = () => ({ defini: pin.defini, verrouille: pin.verrouille });
      d.rpc.portail_code_appareil_definir = (x) => { pin.defini = true; pin.code = x.p_code; return null; };
      d.rpc.portail_code_appareil_verrouiller = () => { pin.verrouille = true; return null; };
      d.rpc.portail_code_appareil_verifier = (x) => { if (x.p_code === pin.code) { pin.verrouille = false; return { ok: true }; } pin.essais++; return { ok: false, restants: 5 - pin.essais }; };
    });
    await c.p.clock.install();
    await c.p.waitForSelector('#cx-code'); await c.p.fill('#cx-code', '123456'); await c.p.click('form[data-form="code"] [type=submit]');
    await c.p.waitForSelector('#cx-pin1', { timeout: 6000 }).catch(() => {});
    ok(await c.p.isVisible('#cx-pin1'), nomEcran + ' : après la connexion complète, choix d’un code à 4 chiffres pour l’appareil');
    await c.p.fill('#cx-pin1', '4826'); await c.p.fill('#cx-pin2', '4827'); await c.p.click('form[data-form="choisir-pin"] [type=submit]');
    ok((await texte(c.p)).includes('pas identiques'), nomEcran + ' : deux codes différents refusés');
    await c.p.fill('#cx-pin1', '4826'); await c.p.fill('#cx-pin2', '4826'); await c.p.click('form[data-form="choisir-pin"] [type=submit]');
    await c.p.waitForSelector('.tuile', { timeout: 6000 }).catch(() => {});
    ok(pin.code === '4826' && await c.p.isVisible('.tuile'), nomEcran + ' : code enregistré, entrée dans l’administration');
    // b) 15 minutes sans geste : écran verrouillé, le code à 4 chiffres suffit
    await c.p.clock.fastForward('15:30'); await c.p.waitForSelector('#cx-pin', { timeout: 6000 }).catch(() => {});
    ok(await c.p.isVisible('#cx-pin') && pin.verrouille, nomEcran + ' : 15 minutes sans activité → écran verrouillé (serveur prévenu)');
    ok(!(await c.p.isVisible('.tuile')), nomEcran + ' : écran verrouillé : plus rien de l’administration n’est visible');
    await c.p.fill('#cx-pin', '0000'); await c.p.click('form[data-form="deverrouiller"] [type=submit]');
    await c.p.waitForSelector('.note.erreur', { timeout: 4000 }).catch(() => {});
    ok((await texte(c.p)).includes('Essais restants : 4'), nomEcran + ' : mauvais code refusé, essais restants affichés');
    await c.p.fill('#cx-pin', '4826'); await c.p.click('form[data-form="deverrouiller"] [type=submit]');
    await c.p.waitForSelector('.tuile', { timeout: 6000 }).catch(() => {});
    ok(await c.p.isVisible('.tuile') && !pin.verrouille, nomEcran + ' : bon code → retour dans l’administration, sans l’application d’authentification');
    // c) rouvrir l'application alors que l'appareil est verrouillé : écran du code d'abord
    pin.verrouille = true; await c.p.reload(); await c.p.waitForSelector('#cx-pin', { timeout: 6000 }).catch(() => {});
    ok(await c.p.isVisible('#cx-pin'), nomEcran + ' : application rouverte sur un appareil verrouillé → code à 4 chiffres demandé');
    ok(!c.errs.length, nomEcran + ' : aucune erreur de page (code à 4 chiffres) ' + c.errs.join(' | '));
    await c.ctx.close();
  }
  // Espace 1 (cahier v2.4, 3.1) : l'ancien tableau de bord DANS l'Administration — même connexion,
  // sans argent ni anciens accès, partenaires gérés d'ici, verrouillage de l'Administration
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
      d.rpc.code_validation_statut = [{ defini: true }];  // l'ancien code de validation ne doit PAS être demandé
      // code individuel (cahier v2.4, 3.3) : la base crée le code d'une personne retenue
      d.tables.codes_inscription = [{ code: 'MA2M-ANCIEN', utilise: false, created_at: '2026-10-01T10:00:00Z', candidature: null },
        { code: 'MA2M-ENFANT', utilise: false, candidature_id: 'c4', created_at: '2026-10-02T10:00:00Z', candidature: { full_name: 'AKESSE FRANCK' } }];
      d.rpc.code_individuel_creer = (x) => { d.tables.codes_inscription.push({ code: 'MA2M-YAO234', utilise: false, candidature_id: x.p_candidature, created_at: new Date().toISOString(), candidature: { full_name: 'YAO KOUASSI' } }); return 'MA2M-YAO234'; };
      d.rpc.casting_direct_creer = (x) => ({ id: 'cd1', code: 'MA2M-DIRECT', recu: x });
      d.rpc.portail_code_appareil_etat = () => ({ defini: pin.defini, verrouille: pin.verrouille });
      d.rpc.portail_code_appareil_verrouiller = () => { pin.verrouille = true; return null; };
      d.rpc.portail_code_appareil_verifier = (x) => { if (x.p_code === '4826') { pin.verrouille = false; return { ok: true }; } return { ok: false, restants: 4 }; };
    });
    const pe = e.p;
    pe.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) e.errs.push('console : ' + m.text().slice(0, 140)); });
    await pe.clock.install();
    await pe.waitForSelector('#cx-code'); await pe.fill('#cx-code', '123456'); await pe.click('form[data-form="code"] [type=submit]');
    await pe.waitForSelector('.tuile');
    await pe.click('.tuile[href="#/site/accueil"]');
    await pe.waitForURL(/tableau-de-bord\.html/, { timeout: 8000 }).catch(() => {});
    // (19/10/2026) pendant l'ouverture, un message d'attente au lieu d'un écran noir
    const attente = await pe.waitForSelector('#adm-attente', { timeout: 3000 }).then(() => true, () => false);
    await pe.waitForSelector('#bloc-tableau', { state: 'visible', timeout: 10000 }).catch(() => {});
    ok(pe.url().includes('/tableau-de-bord.html') && await pe.isVisible('#bloc-tableau'), nomEcran + ' : tuile « Administration du site » → l’ancien tableau de bord s’ouvre');
    ok(attente && !(await pe.$('#adm-attente')), nomEcran + ' : message « Ouverture de l’Administration du site… » pendant l’attente, retiré ensuite');
    ok(!(await pe.isVisible('#bloc-login')) && !(await pe.isVisible('#bloc-code-validation')), nomEcran + ' : aucune deuxième connexion, aucun code de validation demandé');
    ok(!e.journal.some((j) => j[1] === '/api/connexion-protegee' && /"espace":"admin"/.test(j[2] || '')), nomEcran + ' : pas de nouvelle connexion au serveur');
    await pe.waitForSelector('.v2-carte', { timeout: 8000 }).catch(() => {});
    const tv = await texte(pe);
    ok(!/Inscriptions à vérifier|paiements à confirmer|Wave/.test(tv), nomEcran + ' : vue d’ensemble sans argent (inscriptions et paiements → espace 2)');
    const menu = async () => pe.$$eval('#v2-menu-liste .v2-lien-texte', (l) => l.map((x) => x.textContent));
    await pe.click('.v2-bloc[data-bloc="2"]'); await pe.waitForTimeout(400);
    const m2 = await menu();
    ok(!m2.includes('Inscriptions') && m2.includes('Candidatures') && m2.includes('Mannequins publiés'), nomEcran + ' : menu « Mannequins » sans les inscriptions payantes ' + m2.join(', '));
    await pe.click('.v2-bloc[data-bloc="3"]'); await pe.waitForTimeout(400);
    const m3 = await menu();
    ok(!m3.some((x) => /Code de validation|Créer un compte admin|Créer mon compte/.test(x)), nomEcran + ' : anciens accès retirés (code de validation, compte admin, code permanent)');
    ok(m3.includes('Gérer les partenaires') && m3.includes('Publier une actualité'), nomEcran + ' : actualités, événements et partenaires dans le menu');
    const bas = await pe.$$eval('.v2-cote-bas a', (l) => l.map((a) => a.getAttribute('href') + ' ' + a.textContent.trim()));
    ok(bas.some((x) => /^\/admin\/ Accueil de l’Administration/.test(x)) && !bas.some((x) => /site public/.test(x)), nomEcran + ' : « Accueil de l’Administration » remplace « Retour au site public »');
    ok(bas.some((x) => /^\/admin\/#\/paiements.* Suivi des paiements/.test(x)) && bas.some((x) => /^\/admin\/#\/compta.* Comptabilité/.test(x)),
      nomEcran + ' : depuis le tableau de bord, liens directs vers les espaces 2 et 3 ' + bas.join(' | '));
    // fiche d'une candidature : s'ouvre comme avant
    await pe.click('.v2-bloc[data-bloc="2"]'); await pe.waitForTimeout(300);
    await pe.evaluate(() => document.querySelector('.v2-lien[data-page="b2-candidatures"]').click()); await pe.waitForTimeout(1200);
    // statuts (cahier v2.4, 3.2) : « À revoir » remplace « En étude » ; « À revoir » et « En attente »
    // rangés à part, hors de « Toutes » ; classées de la plus récente à la plus ancienne
    const pastilles = await pe.$$eval('#filtres-candidatures > *', (l) => l.map((x) => x.textContent.replace(/\s+\d+$/, '').trim()));
    ok(pastilles.join('|') === 'Toutes|Nouvelle|Retenue|Refusée|À part :|À revoir|En attente', nomEcran + ' : statuts des candidatures, « À revoir » et « En attente » à part ' + pastilles.join('|'));
    await pe.click('#filtres-candidatures [data-filtre="toutes"]'); await pe.waitForTimeout(800);
    const toutes = await pe.$$eval('#liste-candidatures .dossier-carte', (l) => l.map((c) => c.dataset.id));
    ok(toutes.join(',') === 'c3,c1,c4', nomEcran + ' : « Toutes » sans les dossiers à part, la plus récente en premier ' + toutes.join(','));
    await pe.click('#filtres-candidatures [data-filtre="en étude"]'); await pe.waitForTimeout(800);
    const arevoir = await pe.$$eval('#liste-candidatures .dossier-carte', (l) => l.map((c) => c.dataset.id));
    ok(arevoir.join(',') === 'c2' && /À revoir/.test(await pe.textContent('#liste-candidatures')), nomEcran + ' : « À revoir » montre ses dossiers');
    // fiche d'une personne retenue : le code n'existe pas encore, il est créé quand elle veut s'inscrire
    await pe.click('#filtres-candidatures [data-filtre="retenue"]'); await pe.waitForTimeout(800);
    await pe.click('#liste-candidatures .dossier-carte[data-id="c3"] .dc-nom'); await pe.waitForSelector('#mf-code-creer', { timeout: 6000 }).catch(() => {});
    ok(await pe.isVisible('#mf-code-creer') && /Pas encore de code/.test(await pe.textContent('#mf-code')), nomEcran + ' : personne retenue → pas de code tant qu’elle n’a pas montré son intérêt');
    await pe.click('#mf-code-creer'); await pe.waitForSelector('#mf-code-texte', { timeout: 6000 }).catch(() => {});
    const codeFiche = await pe.textContent('#mf-code-texte').catch(() => '');
    const waCode = decodeURIComponent((await pe.getAttribute('#mf-code-whatsapp', 'href').catch(() => '')) || '');
    ok(codeFiche === 'MA2M-YAO234' && e.journal.some((j) => j[1] === 'code_individuel_creer' && /"p_candidature":"c3"/.test(j[2])), nomEcran + ' : « La personne veut s’inscrire » → son code est créé par la base');
    ok(/^https:\/\/wa\.me\/2250707070707\?text=/.test(waCode) && waCode.includes('MA2M-YAO234') && waCode.includes('Bonjour Monsieur YAO KOUASSI'), nomEcran + ' : code envoyé par WhatsApp à la personne, salutation habituelle');
    await pe.click('#modal-dossier-fermer'); await pe.waitForTimeout(300);
    // enfant mineur retenu : le code part au parent, sur son numéro
    await pe.click('#filtres-candidatures [data-filtre="retenue"]'); await pe.waitForTimeout(800);
    await pe.click('#liste-candidatures .dossier-carte[data-id="c4"] .dc-nom'); await pe.waitForSelector('#mf-code-whatsapp', { timeout: 6000 }).catch(() => {});
    const waEnfant = decodeURIComponent((await pe.getAttribute('#mf-code-whatsapp', 'href').catch(() => '')) || '');
    ok(/^https:\/\/wa\.me\/2250777071859\?text=/.test(waEnfant) && waEnfant.includes('Bonjour Monsieur Akesse Paul') && waEnfant.includes('MA2M-ENFANT'), nomEcran + ' : enfant mineur → code envoyé au parent, sur son numéro ' + waEnfant.slice(0, 120));
    await pe.click('#modal-dossier-fermer'); await pe.waitForTimeout(300);
    // fiche non retenue : aucune zone de code
    await pe.click('#filtres-candidatures [data-filtre="en étude"]'); await pe.waitForTimeout(800);
    await pe.click('#liste-candidatures .dossier-carte[data-id="c2"] .dc-nom'); await pe.waitForTimeout(1000);
    ok(!(await pe.isVisible('#mf-code')), nomEcran + ' : pas de code pour une candidature non retenue');
    await pe.click('#modal-dossier-fermer'); await pe.waitForTimeout(300);
    // rubrique des codes : plus de code « libre », casting direct
    await pe.click('.v2-bloc[data-bloc="3"]'); await pe.waitForTimeout(300);
    await pe.evaluate(() => document.querySelector('.v2-lien[data-page="b3b-codes-inscription"]').click()); await pe.waitForTimeout(1000);
    ok(!(await pe.$('#generer-code-btn')) && await pe.isVisible('#form-casting-direct'), nomEcran + ' : plus de code sans nom, formulaire « Casting direct » à la place');
    const listeCodes = await pe.textContent('#liste-codes');
    ok(/MA2M-YAO234\s*YAO KOUASSI/.test(listeCodes) && /Ancien code sans nom/.test(listeCodes), nomEcran + ' : chaque code porte le nom de sa personne');
    await pe.fill('#cd-nom', 'Fatou Bamba'); await pe.fill('#cd-telephone', '0101010101'); await pe.selectOption('#cd-genre', 'femme'); await pe.fill('#cd-naissance', '2001-02-03');
    await pe.click('#form-casting-direct [type=submit]'); await pe.waitForTimeout(1000);
    const appel = e.journal.find((j) => j[1] === 'casting_direct_creer');
    ok(appel && JSON.parse(appel[2]).p_genre === 'femme' && JSON.parse(appel[2]).p_naissance === '2001-02-03' && await pe.textContent('#nouveau-code-texte') === 'MA2M-DIRECT', nomEcran + ' : casting direct → fiche minimale et code tout de suite');
    ok(/wa\.me\/2250101010101/.test(await pe.getAttribute('#nouveau-code-whatsapp', 'href')), nomEcran + ' : casting direct → code envoyé par WhatsApp');
    await pe.click('.v2-bloc[data-bloc="2"]'); await pe.waitForTimeout(300);
    await pe.evaluate(() => document.querySelector('.v2-lien[data-page="b2-candidatures"]').click()); await pe.waitForTimeout(800);
    await pe.click('#filtres-candidatures [data-filtre="nouvelle"]'); await pe.waitForTimeout(800);
    await pe.click('#liste-candidatures .dossier-carte[data-id="c1"] .dc-nom').catch(() => {}); await pe.waitForTimeout(1000);
    ok(/AWA KONÉ/.test(await texte(pe)) && await pe.isVisible('#mf-statut-select'), nomEcran + ' : la fiche complète d’une candidature s’ouvre');
    await pe.click('#modal-dossier-fermer'); await pe.waitForTimeout(300);
    // 15 minutes sans geste : retour à l'Administration, code à 4 chiffres, puis retour ici
    await pe.clock.fastForward('15:30');
    await pe.waitForURL(/\/admin\//, { timeout: 8000 }).catch(() => {});
    await pe.waitForSelector('#cx-pin', { timeout: 8000 }).catch(() => {});
    ok(pin.verrouille && await pe.isVisible('#cx-pin'), nomEcran + ' : 15 minutes sans activité → écran verrouillé de l’Administration');
    await pe.fill('#cx-pin', '4826'); await pe.click('form[data-form="deverrouiller"] [type=submit]');
    await pe.waitForURL(/tableau-de-bord\.html/, { timeout: 8000 }).catch(() => {});
    await pe.waitForSelector('#bloc-tableau', { state: 'visible', timeout: 10000 }).catch(() => {});
    ok(pe.url().includes('/tableau-de-bord.html') && await pe.isVisible('#bloc-tableau'), nomEcran + ' : bon code → retour dans l’Administration du site, là où l’on était');
    // Partenaires : dans l'Administration (barre en haut), sans l'en-tête du site public
    await pe.goto(pe.url().split('/tableau-de-bord')[0] + '/partenaires.html');
    await pe.waitForSelector('.adm-barre', { timeout: 8000 }).catch(() => {});
    ok(await pe.isVisible('.adm-barre .adm-retour') && !(await pe.isVisible('.site-header-v2')), nomEcran + ' : partenaires ouverts dans l’Administration (barre, sans l’en-tête du site)');
    const largeur = await pe.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    ok(largeur, nomEcran + ' : barre de l’Administration sans défilement de côté');
    await pe.click('.adm-retour'); await pe.waitForSelector('#bloc-tableau', { state: 'visible', timeout: 10000 }).catch(() => {});
    ok(await pe.isVisible('#bloc-tableau'), nomEcran + ' : « Administration du site » ramène au tableau de bord');
    // Se déconnecter : retour à l'écran de connexion de l'Administration
    if (ecran.width < 1000) { await pe.click('.v2-burger'); await pe.waitForTimeout(300); }
    await pe.click('.v2-cote-bas [data-action="deconnexion"]');
    await pe.waitForURL(/\/admin\//, { timeout: 8000 }).catch(() => {});
    await pe.waitForSelector('#cx-mail', { timeout: 8000 }).catch(() => {});
    ok(await pe.isVisible('#cx-mail'), nomEcran + ' : « Se déconnecter » → écran de connexion de l’Administration');
    ok(e.journal.some((j) => j[1] === '/api/acces-tableau'), nomEcran + ' : la clé de l’ancien tableau de bord est effacée');
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page (espace 1) ' + e.errs.join(' | '));
    await e.ctx.close();
    // Un compte de l'Administration sans l'espace 1 (comptable) ne peut pas ouvrir l'ancien tableau de bord
    const k = await ouvrir('compta', ecran, (d) => { Object.assign(d.tables, ESPACE1); });
    await k.p.waitForSelector('#cx-code'); await k.p.fill('#cx-code', '123456'); await k.p.click('form[data-form="code"] [type=submit]');
    await k.p.waitForFunction(() => location.hash.startsWith('#/compta/'), null, { timeout: 6000 }).catch(() => {});
    await k.p.goto(k.p.url().split('#')[0] + '#/'); await k.p.waitForSelector('.bandeau-portail', { timeout: 6000 }).catch(() => {});
    await k.p.click('a[href="#/securite/codes"]'); await k.p.waitForSelector('[data-action="securite-codes"]', { timeout: 6000 }).catch(() => {});
    ok(await k.p.isVisible('[data-action="securite-codes"]') && !(await k.p.isVisible('.lateral .nav[href="#/securite/comptes"]')), nomEcran + ' : comptable → « Mes codes de secours » ouvert, le reste de la sécurité non');
    await k.p.goto(k.p.url().split('/admin/')[0] + '/tableau-de-bord.html');
    await k.p.waitForURL(/\/admin\//, { timeout: 8000 }).catch(() => {});
    ok(k.p.url().includes('/admin/') && !(await k.p.isVisible('#bloc-tableau')), nomEcran + ' : comptable → l’ancien tableau de bord lui est refusé');
    await k.ctx.close();
  }
  // Espace 2 — registre (cahier v2.4, 5.1 et 5.5)
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    for (const role of ['principal', 'caisse']) {
      const r = await ouvrir(role, ecran);
      const pr = r.p;
      await pr.waitForSelector('#cx-code'); await pr.fill('#cx-code', '123456'); await pr.click('form[data-form="code"] [type=submit]');
      await pr.waitForSelector('.tuile, .lateral', { timeout: 6000 }).catch(() => {});
      await pr.goto(url + '#/paiements/registre'); await pr.waitForSelector('.tableau tbody tr', { timeout: 6000 }).catch(() => {});
      const lignes = await pr.$$eval('.tableau tbody tr', (l) => l.map((x) => x.innerText.replace(/\s+/g, ' ')));
      ok(lignes.length === 4 && lignes.some((x) => /ROXANE OUATTARA.*Inscription déjà effectuée sur le site/.test(x)) && lignes.some((x) => /KONÉ AWA.*Inscription non payée/.test(x)) && lignes.some((x) => /YAO KOUASSI.*En attente de validation/.test(x)),
        nomEcran + ' (' + role + ') : registre = comptes du site + ajoutés à la main, couleurs d’inscription');
      if (role === 'principal') {
        await pr.click('[data-action="registre-filtre"][data-filtre="non_paye"]'); await pr.waitForTimeout(500);
        ok((await pr.$$('.tableau tbody tr')).length === 1, nomEcran + ' : filtre « Inscription non payée »');
        // retours du 19/10/2026 : recherche pendant la frappe, passage direct aux autres espaces,
        // annulation d'un paiement enregistré par erreur (administrateur principal)
        await pr.click('[data-action="registre-filtre"][data-filtre="tous"]'); await pr.waitForTimeout(500);
        await pr.fill('#rg-cherche', 'kon'); await pr.waitForTimeout(200);
        const visibles = await pr.$$eval('.tableau tbody tr', (l) => l.filter((x) => !x.hidden).map((x) => x.innerText));
        ok(visibles.length === 1 && /KONÉ AWA/.test(visibles[0]), nomEcran + ' : registre filtré pendant la frappe (« kon » → KONÉ AWA)');
        const aller = await pr.$$eval('.lateral .nav', (l) => l.map((a) => a.textContent.trim()));
        ok(aller.includes('Administration du site') && aller.includes('Comptabilité') && aller.includes('Sécurité et journal'), nomEcran + ' : menu « Aller à » vers les autres espaces ' + aller.join(' | '));
        await pr.goto(url + '#/paiements/fiche/r4'); await pr.waitForSelector('[data-action="paiement-annuler"]', { timeout: 6000 }).catch(() => {});
        pr.once('dialog', (dl) => dl.accept('Mauvais mannequin'));
        await pr.click('[data-action="paiement-annuler"]'); await pr.waitForTimeout(800);
        const annul = r.journal.filter((j) => j[0] === 'PATCH' && j[1] === 'paiements_mannequins').map((j) => JSON.parse(j[3])).pop() || {};
        ok(annul.statut === 'refuse' && /Mauvais mannequin/.test(annul.motif) && (await pr.textContent('#calque')).includes('Paiement annulé'), nomEcran + ' : paiement enregistré par erreur → annulé avec son motif');
        r.d.tables.paiements_mannequins.find((x) => x.id === 'pi4').statut = 'valide';
        // ajout à la main : un mineur sans parent est refusé
        await pr.goto(url + '#/paiements/ajouter'); await pr.waitForSelector('#mq-nom');
        await pr.fill('#mq-nom', 'Petit Franck'); await pr.fill('#mq-naissance', '2014-05-05'); await pr.click('form[data-form="registre-ajouter"] [type=submit]'); await pr.waitForTimeout(600);
        ok(/parent/.test(await texte(pr)) && !r.journal.some((j) => j[0] === 'POST' && j[1] === 'agence_mannequins'), nomEcran + ' : mineur sans parent refusé');
        await pr.fill('#mq-pnom', 'Madame Kouassi'); await pr.fill('#mq-ptel', '0505050505'); await pr.click('form[data-form="registre-ajouter"] [type=submit]');
        await pr.waitForFunction(() => location.hash.startsWith('#/paiements/fiche/'), null, { timeout: 6000 }).catch(() => {});
        const ajout = r.journal.find((j) => j[0] === 'POST' && j[1] === 'agence_mannequins');
        ok(ajout && JSON.parse(ajout[3]).full_name === 'PETIT FRANCK' && JSON.parse(ajout[3]).parent_telephone === '0505050505' && pr.url().includes('#/paiements/fiche/'), nomEcran + ' : mannequin ajouté au registre, sa fiche s’ouvre');
      }
      // fiche d'un mannequin sans compte : l'agence enregistre le paiement de l'inscription
      await pr.goto(url + '#/paiements/fiche/r2'); await pr.waitForSelector('[data-action="registre-inscription"]', { timeout: 6000 }).catch(() => {});
      ok(await pr.isVisible('[data-action="registre-inscription"][data-mode="avant_systeme"]') && await pr.isVisible('[data-action="registre-inscription"][data-mode="especes"]') && await pr.isVisible('[data-action="registre-inscription"][data-mode="wave"]'),
        nomEcran + ' (' + role + ') : « avant le nouveau système », « Wave reçu en dehors du site » et « espèces »');
      pr.once('dialog', (dl) => dl.accept());
      await pr.click('[data-action="registre-inscription"][data-mode="wave"]'); await pr.waitForTimeout(800);
      const waveHors = r.journal.find((j) => j[0] === 'POST' && j[1] === 'paiements_mannequins');
      ok(waveHors && [].concat(JSON.parse(waveHors[3])).every((l) => l.mode === 'wave' && l.statut === 'valide') && [].concat(JSON.parse(waveHors[3])).length === 2,
        nomEcran + ' (' + role + ') : Wave reçu en dehors du site → 15 000 + 10 000, mode Wave, validé par l’agence');
      r.journal.length = 0;
      ok(role === 'principal' ? !(await pr.isDisabled('#mq-mensualite')) : await pr.isDisabled('#mq-mensualite'), nomEcran + ' (' + role + ') : mensualité modifiable par le principal seul');
      if (role === 'caisse') ok(!(await pr.$('[data-action="paiement-annuler"]')), nomEcran + ' (caisse) : pas de bouton « Annuler (erreur) » sur les paiements');
      pr.once('dialog', (dl) => dl.accept());
      await pr.click('[data-action="registre-inscription"][data-mode="especes"]'); await pr.waitForTimeout(800);
      const paye = r.journal.find((j) => j[0] === 'POST' && j[1] === 'paiements_mannequins');
      const lignesPaye = paye ? [].concat(JSON.parse(paye[3])) : [];
      ok(lignesPaye.length === 2 && lignesPaye.every((l) => l.statut === 'valide' && l.mode === 'especes') && lignesPaye[0].objet === 'inscription' && lignesPaye[0].montant === 15000 &&
        lignesPaye[1].objet === 'mensualite' && lignesPaye[1].montant === 10000 && /^\d{4}-\d{2}-01$/.test(lignesPaye[1].mois), nomEcran + ' (' + role + ') : espèces validées par l’agence : 15 000 d’inscription + 10 000 du 1er mois');
      // paiements à valider (cahier v2.4, 5.2) : orange, l'agence valide ou refuse avec motif
      await pr.goto(url + '#/paiements/a-valider'); await pr.waitForSelector('[data-action="paiement-valider"]', { timeout: 6000 }).catch(() => {});
      const aValider = await pr.evaluate(() => Array.from(document.querySelector('#contenu .tableau').querySelectorAll('tbody tr')).map((x) => x.innerText.replace(/\s+/g, ' ')));
      const recents = await pr.evaluate(() => (document.querySelectorAll('#contenu .tableau')[1] || { innerText: '' }).innerText);
      ok(/SANOGO MARIAM/.test(recents), nomEcran + ' (' + role + ') : les paiements validés des 7 derniers jours sont listés sous ceux à valider');
      ok(aValider.length === 1 && /YAO KOUASSI.*Inscription.*En attente de validation.*25 000 FCFA/.test(aValider[0]), nomEcran + ' (' + role + ') : « J’ai payé » → une ligne orange de 25 000 FCFA à valider');
      ok((await pr.textContent('.lateral .nav[href="#/paiements/a-valider"]')).includes('1'), nomEcran + ' (' + role + ') : compteur des paiements à valider dans le menu');
      r.d.rpc.paiement_decider = (x) => ({ nom: 'YAO KOUASSI', telephone: '0505050505', email: 'yao@test.ci', objet: 'inscription', mois: null, montant: 25000, recu: x });
      pr.once('dialog', (dl) => dl.accept());
      await pr.click('[data-action="paiement-valider"]'); await pr.waitForSelector('#fenetre a[href^="https://wa.me/"]', { timeout: 6000 }).catch(() => {});
      const decide = r.journal.find((j) => j[0] === 'rpc' && j[1] === 'paiement_decider');
      const wa = decodeURIComponent((await pr.getAttribute('#fenetre a[href^="https://wa.me/"]', 'href').catch(() => '')) || '');
      ok(decide && JSON.parse(decide[2]).p_id === 'pi3' && JSON.parse(decide[2]).p_valider === true, nomEcran + ' (' + role + ') : « Valider » → paiement validé par la base');
      ok(/^https:\/\/wa\.me\/2250505050505\?text=/.test(wa) && wa.includes('25 000 FCFA') && /confirmons/.test(wa), nomEcran + ' (' + role + ') : confirmation prête à envoyer par WhatsApp');
      await pr.waitForTimeout(500);
      ok(r.journal.some((j) => j[0] === 'EMAIL' && /yao@test\.ci/.test(j[1]) && /confirmons/.test(j[1])), nomEcran + ' (' + role + ') : confirmation envoyée par e-mail');
      await pr.click('#fenetre [data-action="fermer-fenetre"]');
      pr.once('dialog', (dl) => dl.accept('Paiement introuvable dans Wave'));
      await pr.click('[data-action="paiement-refuser"]'); await pr.waitForTimeout(800);
      const refus = r.journal.filter((j) => j[0] === 'rpc' && j[1] === 'paiement_decider').pop();
      ok(refus && JSON.parse(refus[2]).p_valider === false && JSON.parse(refus[2]).p_motif === 'Paiement introuvable dans Wave', nomEcran + ' (' + role + ') : « Refuser » → motif obligatoire, transmis à la base');
      await pr.click('#fenetre [data-action="fermer-fenetre"]').catch(() => {});
      // code de l'espace mannequin (cahier v2.4, 5.4) : seulement après l'inscription validée
      await pr.goto(url + '#/paiements/fiche/r2'); await pr.waitForSelector('.carte h2', { timeout: 6000 }).catch(() => {});
      ok(/se génère après la validation/.test(await texte(pr)) && !(await pr.isVisible('[data-action="code-espace"]')), nomEcran + ' (' + role + ') : pas de code de l’espace avant la validation de l’inscription');
      await pr.goto(url + '#/paiements/fiche/r4'); await pr.waitForSelector('#code-espace-texte', { timeout: 6000 }).catch(() => {});
      const waEspace = decodeURIComponent((await pr.getAttribute('#code-espace-whatsapp', 'href').catch(() => '')) || '');
      ok((await pr.textContent('#code-espace-texte').catch(() => '')) === 'ESP-MARIAM' && /^https:\/\/wa\.me\/2250606060606\?text=/.test(waEspace) && waEspace.includes('ESP-MARIAM') && waEspace.includes('/espace-mannequin.html'),
        nomEcran + ' (' + role + ') : inscription validée → code de l’espace (7 jours) prêt à envoyer par WhatsApp');
      r.d.rpc.code_espace_creer = 'ESP-NOUVEAU';
      pr.once('dialog', (dl) => dl.accept());
      await pr.click('[data-action="code-espace"]'); await pr.waitForTimeout(800);
      ok(r.journal.some((j) => j[0] === 'rpc' && j[1] === 'code_espace_creer' && /"p_mannequin":"r4"/.test(j[2])), nomEcran + ' (' + role + ') : « Générer un nouveau code » → créé par la base');
      // mensualités du mois (cahier v2.4, 5.6) : actifs cochés, appel envoyé, WhatsApp prêt
      r.d.tables.mensualites_appels = [];
      r.d.rpc.mensualites_appeler = (x) => x.p_ids.map((id) => ({ id, nom: id === 'r2' ? 'KONÉ AWA' : 'X', telephone: '0707070707', email: 'awa@test.ci', mensualite: 10000 }));
      await pr.goto(url + '#/paiements/mensualites'); await pr.waitForSelector('form[data-form="mensualites-appel"]', { timeout: 6000 }).catch(() => {});
      const coches = await pr.$$eval('input[name="ids"]:checked', (l) => l.map((x) => x.value));
      ok(coches.includes('r2') && !coches.includes('r3'), nomEcran + ' (' + role + ') : appel du mois — actifs non payés cochés, ceux en attente de validation non');
      await pr.uncheck('input[name="ids"][value="r1"]').catch(() => {});
      pr.once('dialog', (dl) => dl.accept());
      await pr.click('form[data-form="mensualites-appel"] [type=submit]'); await pr.waitForSelector('#fenetre a[href^="https://wa.me/"]', { timeout: 6000 }).catch(() => {});
      const appelMois = r.journal.find((j) => j[0] === 'rpc' && j[1] === 'mensualites_appeler');
      ok(appelMois && JSON.parse(appelMois[2]).p_ids.includes('r2') && !JSON.parse(appelMois[2]).p_ids.includes('r1'), nomEcran + ' : seules les personnes cochées sont appelées');
      const waAppel = decodeURIComponent((await pr.getAttribute('#fenetre a[href^="https://wa.me/"]', 'href').catch(() => '')) || '');
      ok(/est à régler avant le 5/.test(waAppel) && r.journal.some((j) => j[0] === 'EMAIL' && /est à régler avant le 5/.test(j[1])), nomEcran + ' (' + role + ') : appel envoyé par e-mail, WhatsApp prêt');
      await pr.click('#fenetre [data-action="fermer-fenetre"]').catch(() => {});
      // fiche d'un compte du site : aucun bouton de paiement d'inscription, aucun code
      await pr.goto(url + '#/paiements/fiche/r1'); await pr.waitForSelector('.carte h2', { timeout: 6000 }).catch(() => {});
      ok(/Inscription déjà effectuée sur le site/.test(await texte(pr)) && !(await pr.isVisible('[data-action="registre-inscription"]')) && !(await pr.$$eval('.contenu h2', (l) => l.some((h) => /Code de l’espace/.test(h.textContent)))), nomEcran + ' (' + role + ') : compte du site → « Inscription déjà effectuée sur le site »');
      const boutons = (await pr.evaluate(verifierBoutons)).map((x) => JSON.stringify(x));
      ok(!boutons.length, nomEcran + ' (' + role + ') : boutons au modèle rouge ' + boutons.join(' | '));
      const mal = await pales(pr); ok(!mal.length, nomEcran + ' (' + role + ') : fiche lisible ' + mal.join(' | '));
      ok(await pr.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), nomEcran + ' (' + role + ') : pas de défilement de côté');
      await pr.goto(url + '#/paiements/fiche/r2'); await pr.waitForSelector('.carte h2', { timeout: 6000 }).catch(() => {});
      const depasse = await pr.$$eval('.contenu .btn', (l) => l.filter((b) => b.getBoundingClientRect().right > innerWidth + 1).map((b) => b.textContent.trim()));
      ok(!depasse.length, nomEcran + ' (' + role + ') : aucun bouton ne dépasse de l’écran ' + depasse.join(' | '));
      ok(!r.errs.length, nomEcran + ' (' + role + ') : aucune erreur de page (registre) ' + r.errs.join(' | '));
      await r.ctx.close();
    }
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
