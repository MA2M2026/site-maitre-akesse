// Espace 2 — Rapprochement Wave, Sorties et suspensions, Mois figés (cahier V3, 7.2), essayés comme une vraie personne
// sur téléphone et ordinateur, base SIMULÉE : alertes, rapprochement, proposition puis décision de sortie, réactivation, mois figé.
// Rôles : administrateur principal (décide) et encaissements (propose seulement).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const { verifierBoutons } = require('./boutons');
const PORT = String(9400 + Math.floor(Math.random() * 90));
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



  const now = new Date();
  const moisIso = (dec) => { const d = new Date(now.getFullYear(), now.getMonth() - dec, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'; };
  const il = (j) => new Date(Date.now() - j * 864e5).toISOString();
  const base = (d) => {
    d.tables.agence_mannequins = [
      { id: 'r1', full_name: 'KONÉ AWA', telephone: '0707070707', mensualite: 10000, statut: 'actif', user_id: null, date_entree: '2026-01-05' },
      { id: 'r2', full_name: 'YAO KOUASSI', telephone: '0505050505', mensualite: 10000, statut: 'actif', user_id: null, date_entree: '2026-02-01' },
      { id: 'r3', full_name: 'SANOGO MARIAM', telephone: '0606060606', mensualite: 10000, statut: 'sorti', user_id: null, date_entree: '2026-03-01' },
      { id: 'r4', full_name: 'DIALLO FATOU', telephone: '0101010101', mensualite: 10000, statut: 'actif', user_id: null, date_entree: '2026-04-01' }];
    const m = (id, mq, nom, jours, mois) => ({ id, mannequin_id: mq, objet: 'mensualite', mois, montant: 10000, mode: 'wave', statut: 'declare', declare_le: il(jours), mannequin: { full_name: nom, telephone: '0700000000' } });
    d.tables.paiements_mannequins = [m('pa', 'r1', 'KONÉ AWA', 5, moisIso(0)), m('pb', 'r2', 'YAO KOUASSI', 1, moisIso(0)), m('pc', 'r4', 'DIALLO FATOU', 1, moisIso(0))];
    d.tables.rapprochements = [
      { paiement_id: 'pa', numero_payeur: '+225 07 00 00 00 01', reference_paiement: 'T999', montant_recu: 10000, etat: 'a_verifier', note: null },
      { paiement_id: 'pb', numero_payeur: '+225 05 05 05 05 05', reference_paiement: 'T999', montant_recu: 9000, etat: 'precision', note: 'Montant à confirmer' }];
    d.tables.sorties_mannequins = [
      { id: 's1', mannequin_id: 'r2', type: 'sorti', motif: 'Départ de la ville', decision: 'en_attente', propose_le: il(1), mannequin: { full_name: 'YAO KOUASSI' } },
      { id: 's2', mannequin_id: 'r3', type: 'suspendu', motif: 'Absences', decision: 'accepte', propose_le: il(20), decide_le: il(19), motif_decision: 'Vu avec elle', mannequin: { full_name: 'SANOGO MARIAM' } }];
    d.tables.recaps_mensuels = [{ mois: moisIso(2), fige_le: il(10), donnees: { lignes: [{ nom: 'KONÉ AWA', statut: 'actif', etat: 'paye', valide: 10000 }, { nom: 'YAO KOUASSI', statut: 'actif', etat: 'non_paye', valide: 0 }] } }];
    d.tables.codes_espace = [];
    d.rpc.sortie_proposer = {}; d.rpc.sortie_decider = {}; d.rpc.mannequin_reactiver = {}; d.rpc.recap_figer = {};
  };
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const connecter = async (role, page) => {
      const e = await ouvrir(role, ecran, base);
      e.p.on('console', (mm) => { if (mm.type() === 'error' && !/Failed to load resource/.test(mm.text())) e.errs.push('console : ' + mm.text().slice(0, 140)); });
      e.p.on('dialog', (dl) => (dl.type() === 'prompt' ? dl.accept('Motif de test') : dl.accept()));
      await e.p.waitForSelector('#cx-code'); await e.p.fill('#cx-code', '123456'); await e.p.click('form[data-form="code"] [type=submit]');
      await e.p.waitForSelector('.tuile, .lateral', { timeout: 8000 }).catch(() => {});
      await e.p.goto(e.p.url().split('#')[0] + '#/paiements/' + page); await e.p.waitForTimeout(1200);
      return e;
    };
    const t = (p) => p.evaluate(() => document.querySelector('.contenu').innerText.replace(/\s+/g, ' '));
    const patchs = (e, table) => e.journal.filter((j) => j[0] === 'PATCH' && j[1] === table);
    const rpcs = (e, nom) => e.journal.filter((j) => j[0] === 'rpc' && j[1] === nom).map((j) => JSON.parse(j[2] || '{}'));

    // ----- 1. Rapprochement Wave (administrateur principal)
    let e = await connecter('principal', 'rapprochement'), p = e.p;
    let x = await t(p);
    ok(/Montant différent : 9 000 FCFA vu dans Wave, 10 000 FCFA déclaré/.test(x), nomEcran + ' : alerte « montant différent »');
    ok((x.match(/déjà utilisée par un autre paiement/g) || []).length === 2, nomEcran + ' : alerte « référence en double » sur les deux paiements');
    ok(/Déclaré sans suite depuis 5 jours/.test(x) && !/sans suite depuis 1 jours/.test(x), nomEcran + ' : alerte « sans suite » seulement pour la déclaration de 5 jours');
    ok(/\+225 05 05 05 05 05/.test(x) && /Précision demandée/.test(x) && /Montant à confirmer/.test(x), nomEcran + ' : numéro du payeur, état et note affichés');
    ok(/Non communiqué/.test(x), nomEcran + ' : « Non communiqué » quand le payeur n’a pas donné de numéro');
    ok(!(await p.evaluate(verifierBoutons)).length && !(await lirePageEntiere(p)).length, nomEcran + ' : boutons au modèle rouge et textes lisibles');
    // note obligatoire pour « Introuvable »
    await p.click('[data-action="rapprochement-ouvrir"][data-id="pb"]'); await p.waitForSelector('form[data-form="rapprochement-enregistrer"]');
    await p.selectOption('#rp-etat', 'introuvable'); await p.fill('#rp-note', '  ');
    await p.click('form[data-form="rapprochement-enregistrer"] [type=submit]'); await p.waitForTimeout(500);
    ok(!patchs(e, 'rapprochements').length, nomEcran + ' : « Introuvable » sans note n’est pas envoyé');
    await p.fill('#rp-note', 'Rien dans Wave pour ce numéro'); await p.click('form[data-form="rapprochement-enregistrer"] [type=submit]'); await p.waitForTimeout(1200);
    const maj = patchs(e, 'rapprochements')[0], corps = maj ? JSON.parse(maj[3]) : {};
    ok(maj && /pb/.test(maj[2]) && corps.etat === 'introuvable' && corps.note === 'Rien dans Wave pour ce numéro', nomEcran + ' : « Introuvable » avec sa note enregistré ' + (maj ? maj[3] : ''));
    ok(/Introuvable dans Wave/.test(await t(p)), nomEcran + ' : le nouvel état s’affiche');
    // premier rapprochement d'un paiement sans ligne : création
    await p.click('[data-action="rapprochement-ouvrir"][data-id="pc"]'); await p.waitForSelector('form[data-form="rapprochement-enregistrer"]');
    await p.fill('#rp-ref', 'W123456'); await p.fill('#rp-montant', '10000'); await p.selectOption('#rp-etat', 'rapproche');
    await p.click('form[data-form="rapprochement-enregistrer"] [type=submit]'); await p.waitForTimeout(1200);
    const cree = e.journal.find((j) => j[0] === 'POST' && j[1] === 'rapprochements');
    const cc = cree ? JSON.parse(cree[3]) : {};
    ok(cree && cc.paiement_id === 'pc' && cc.reference_paiement === 'W123456' && cc.montant_recu === 10000 && cc.etat === 'rapproche', nomEcran + ' : premier rapprochement créé ' + (cree ? cree[3] : ''));
    ok(!e.journal.some((j) => j[0] === 'DELETE'), nomEcran + ' : aucune suppression');
    await p.screenshot({ path: __dirname + '/medias/rapprochement-wave-' + (ecran.width > 860 ? 'pc' : 'tel') + '.png', fullPage: true });
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nomEcran + ' : pas de défilement de côté');
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page (rapprochement) ' + e.errs.join(' | '));
    await e.ctx.close();

    // ----- 2. Sorties et suspensions (principal)
    e = await connecter('principal', 'sorties'); p = e.p; x = await t(p);
    ok(/YAO KOUASSI/.test(x) && /Départ de la ville/.test(x) && /Vu avec elle/.test(x) && /SANOGO MARIAM/.test(x), nomEcran + ' : proposition en attente, historique et mannequin sorti affichés');
    ok(!(await p.evaluate(verifierBoutons)).length && !(await lirePageEntiere(p)).length, nomEcran + ' : boutons au modèle rouge et textes lisibles (sorties)');
    ok(!(await p.$$eval('#so-mannequin option', (o) => o.map((y) => y.textContent))).some((n) => /YAO/.test(n)), nomEcran + ' : on ne repropose pas un mannequin déjà en attente');
    await p.selectOption('#so-mannequin', 'r1'); await p.selectOption('#so-type', 'suspendu'); await p.fill('#so-motif', 'Mensualités impayées');
    await p.click('form[data-form="sortie-proposer"] [type=submit]'); await p.waitForTimeout(1000);
    const prop = rpcs(e, 'sortie_proposer')[0];
    ok(prop && prop.p_mannequin === 'r1' && prop.p_type === 'suspendu' && prop.p_motif === 'Mensualités impayées', nomEcran + ' : proposition envoyée ' + JSON.stringify(prop));
    await p.click('[data-action="sortie-decider"][data-id="s1"][data-accepter="1"]'); await p.waitForTimeout(1000);
    let dec = rpcs(e, 'sortie_decider')[0];
    ok(dec && dec.p_id === 's1' && dec.p_accepter === true, nomEcran + ' : décision « accepter » envoyée ' + JSON.stringify(dec));
    await p.click('[data-action="sortie-decider"][data-id="s1"][data-accepter="0"]'); await p.waitForTimeout(1000);
    dec = rpcs(e, 'sortie_decider')[1];
    ok(dec && dec.p_accepter === false && dec.p_motif === 'Motif de test', nomEcran + ' : refus avec motif envoyé ' + JSON.stringify(dec));
    await p.click('[data-action="mannequin-reactiver"][data-id="r3"]'); await p.waitForTimeout(1000);
    const re = rpcs(e, 'mannequin_reactiver')[0];
    ok(re && re.p_mannequin === 'r3' && re.p_motif === 'Motif de test', nomEcran + ' : réactivation avec motif envoyée ' + JSON.stringify(re));
    ok(!e.journal.some((j) => j[0] === 'DELETE') && !patchs(e, 'agence_mannequins').length, nomEcran + ' : aucun changement direct de statut, aucune suppression');
    await p.screenshot({ path: __dirname + '/medias/sorties-' + (ecran.width > 860 ? 'pc' : 'tel') + '.png', fullPage: true });
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nomEcran + ' : pas de défilement de côté (sorties)');
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page (sorties) ' + e.errs.join(' | '));
    await e.ctx.close();

    // ----- 2 bis. Encaissements : propose seulement
    e = await connecter('caisse', 'sorties'); p = e.p; x = await t(p);
    ok(!(await p.$('[data-action="sortie-decider"]')) && !(await p.$('[data-action="mannequin-reactiver"]')) && /Décision de l’administrateur principal/.test(x), nomEcran + ' : encaissements → ni décision ni réactivation');
    ok(!!(await p.$('form[data-form="sortie-proposer"]')), nomEcran + ' : encaissements → peut proposer');
    await e.ctx.close();

    // ----- 4. Modèles de messages (principal : enregistre ; la caisse ne le peut pas : voir test-messages.js)
    e = await connecter('principal', 'messages'); p = e.p;
    await p.waitForSelector('#msg-texte', { timeout: 8000 });
    await p.fill('#msg-texte', 'Bonjour {prenom}, votre mensualité de {mois} est à régler. Merci !');
    await p.click('[data-action="msg-enregistrer-modele"]'); await p.waitForTimeout(1000);
    const mod = e.journal.find((j) => j[0] === 'POST' && j[1] === 'modeles_messages');
    const mc = mod ? JSON.parse(mod[3]) : {};
    ok(mod && mc.cle === 'appel' && /votre mensualité de \{mois\}/.test(mc.texte), nomEcran + ' : le modèle modifié est enregistré ' + (mod ? mod[3].slice(0, 80) : ''));
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page (modèles) ' + e.errs.join(' | '));
    await e.ctx.close();

    // ----- 3. Mois figés
    e = await connecter('caisse', 'figes'); p = e.p; x = await t(p);
    ok(new RegExp(moisIso(2).slice(0, 4)).test(x) && /1 figé/.test(x), nomEcran + ' : le mois déjà figé est listé');
    const options = await p.$$eval('#fg-mois option', (o) => o.map((y) => y.value));
    ok(options.includes(moisIso(1)) && !options.includes(moisIso(2)) && !options.includes(moisIso(0)), nomEcran + ' : on ne propose que les mois terminés pas encore figés');
    await p.click('[data-action="mois-fige-voir"]'); await p.waitForSelector('#fenetre table', { timeout: 4000 });
    ok(/KONÉ AWA/.test(await p.evaluate(() => document.getElementById('fenetre').innerText)), nomEcran + ' : la photo du mois s’ouvre');
    await p.click('#fenetre [data-action="fermer-fenetre"]'); await p.waitForTimeout(300);
    await p.selectOption('#fg-mois', moisIso(1)); await p.click('form[data-form="mois-figer"] [type=submit]'); await p.waitForTimeout(1000);
    const fg = rpcs(e, 'recap_figer')[0];
    ok(fg && fg.p_mois === moisIso(1), nomEcran + ' : « Figer ce mois » envoyé ' + JSON.stringify(fg));
    ok(!(await p.evaluate(verifierBoutons)).length && !(await lirePageEntiere(p)).length, nomEcran + ' : boutons au modèle rouge et textes lisibles (mois figés)');
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page (mois figés) ' + e.errs.join(' | '));
    await e.ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
