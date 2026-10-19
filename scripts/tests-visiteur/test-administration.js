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
      audit_log: [{ id: 1, acteur_nom: 'Maître Akesse', acteur_role: 'principal', action: 'Compte créé', objet: 'staff_profiles', cree_le: new Date().toISOString() }]
    },
    rpc: {
      portail_moi: { role, mfa: true, nom: { principal: 'Maître Akesse', site: 'Gestion du site', caisse: 'Encaissements', compta: 'Comptable' }[role], actif: true, membre: true, espaces, contacts_prives: role !== 'site' && role !== 'compta', noms_payeurs: espaces.paiements },
      portail_enregistrer_appareil: { ok: true, nouveau: false },
      portail_code_appareil_etat: { defini: true, verrouille: false }
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
    const { ctx, p, errs, journal } = await ouvrir('principal', ecran);
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
      await p.goto(url + '#/site/accueil'); await p.waitForSelector('.lateral .nav', { state: 'attached' });
      const vu = () => p.evaluate(() => { const r = document.querySelector('.lateral').getBoundingClientRect(); return getComputedStyle(document.querySelector('.lateral')).visibility === 'visible' && r.right > 50; });
      if (largeur >= 1000) {
        ok(await vu() && !(await p.isVisible('[data-action="menu-ouvrir"]')), nomEcran + ' : menu toujours visible à gauche, sans bouton « Menu »');
      } else {
        ok(!(await vu()) && await p.isVisible('[data-action="menu-ouvrir"]'), largeur + ' px : menu caché, bouton « ☰ Menu » en haut');
        await p.click('[data-action="menu-ouvrir"]'); await p.waitForTimeout(400);
        const r = await p.evaluate(() => document.querySelector('.lateral').getBoundingClientRect().left);
        ok(await vu() && r === 0, largeur + ' px : « ☰ Menu » fait glisser le menu depuis la gauche');
        await p.click('.lateral .nav[href="#/site/accueil"]'); await p.waitForTimeout(500);
        ok(!(await vu()) && (await p.evaluate(() => location.hash)) === '#/site/accueil', largeur + ' px : choisir une rubrique l’ouvre et referme le menu');
        await p.click('[data-action="menu-ouvrir"]'); await p.waitForTimeout(400);
        await p.mouse.click(largeur - 10, 400); await p.waitForTimeout(400);
        ok(!(await vu()), largeur + ' px : toucher à côté du menu le referme');
      }
    }
    await p.setViewportSize(ecran);
    // chaque espace et chaque page de la sécurité s'ouvre
    const pages = { site: ['accueil'], paiements: ['accueil'], compta: ['accueil'], securite: ['comptes', 'delegations', 'appareils', 'journal'] };
    for (const [esp, liste] of Object.entries(pages)) {
      for (const pg of liste) {
        await p.goto(url + '#/' + esp + '/' + pg); await p.waitForSelector('.contenu h1, .contenu .carte h2', { timeout: 6000 }).catch(() => {});
        await p.waitForFunction(() => !document.querySelector('.chargement'), null, { timeout: 6000 }).catch(() => {});
        const t = await texte(p);
        const boutons = (await p.evaluate(verifierBoutons)).map((x) => x.texte + ' (' + x.element + ', fond ' + x.fond + ', texte ' + x.couleur + ', coins ' + x.rayon + ')');
        ok(!boutons.length, nomEcran + ' : ' + esp + '/' + pg + ' boutons au modèle rouge ' + boutons.join(' | '));
        ok(!t.includes('Impossible d’afficher') && !t.includes('Accès refusé'), nomEcran + ' : ' + esp + '/' + pg + ' s’affiche');
        if (esp !== 'securite') ok(t.includes('En construction'), nomEcran + ' : ' + esp + ' annonce ce qui y viendra (en construction)');
        mal = await pales(p); ok(!mal.length, nomEcran + ' : ' + esp + '/' + pg + ' lisible ' + mal.join(' | '));
      }
    }
    ok(!errs.length, nomEcran + ' : aucune erreur de page (principal) ' + errs.join(' | '));
    await ctx.close();

    // un seul espace : la personne y arrive directement, sans voir les autres
    for (const [role, esp] of [['site', 'site'], ['compta', 'compta']]) {
      const s = await ouvrir(role, ecran);
      await s.p.waitForSelector('#cx-code'); await s.p.fill('#cx-code', '123456'); await s.p.click('form[data-form="code"] [type=submit]');
      await s.p.waitForFunction((e) => location.hash.startsWith('#/' + e + '/'), esp, { timeout: 6000 }).catch(() => {});
      ok(s.p.url().includes('#/' + esp + '/'), nomEcran + ' : rôle « ' + role + ' » → arrive directement dans son espace');
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
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
