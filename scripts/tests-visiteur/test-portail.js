// Portail d'administration /admin (cahier v2.3) essayé comme une vraie personne, sur
// téléphone et ordinateur, avec une base SIMULÉE (rien n'est écrit pour de vrai) :
//  - connexion : mot de passe, puis code de double authentification (un mauvais code est refusé) ;
//  - première connexion : activation de la double authentification, 8 codes de secours ;
//  - administrateur principal : trois tuiles, chaque page des trois espaces et de la sécurité ;
//  - administrateur du site : arrive directement dans son espace, aucun montant affiché ;
//  - comptable : aucun nom de mannequin ; encaissement : pas de tuile comptabilité ;
//  - rapprochement d'un « J'ai payé » : la validation appelle la bonne fonction de la base ;
//  - lisibilité (contraste) des écrans, aucune erreur de page.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const { verifierBoutons } = require('./boutons');
// captures (non bloquantes) pour comparer avec la maquette du cahier : captures/actuelles/portail-*.png
const DOSSIER_CAPTURES = require('path').join(__dirname, 'captures', 'actuelles'); require('fs').mkdirSync(DOSSIER_CAPTURES, { recursive: true });
const capture = (p, nom) => p.screenshot({ path: require('path').join(DOSSIER_CAPTURES, 'portail-' + nom + '.png'), fullPage: true }).catch(() => {});
const PORT = String(9300 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

const MOIS = new Date().toLocaleDateString('fr-CA').slice(0, 8) + '01';
const awa = { id: 'm1', nom: 'Awa Koné', prenoms: null, date_naissance: '2001-03-12', telephone: '0700000001', whatsapp: '0700000001', email: 'awa@test.ci', user_id: 'u-awa', statut: 'actif', montant_mensuel: 10000, date_entree: '2026-01-10', exoneration_motif: null, notes: '', parents: [] };
const yao = { id: 'm2', nom: 'Yao Bamba', prenoms: null, date_naissance: '2012-05-03', telephone: '0700000002', whatsapp: null, email: null, user_id: null, statut: 'actif', montant_mensuel: 20000, date_entree: '2026-02-01', exoneration_motif: null, notes: '', parents: [{ nom: 'Parent de Yao', telephone: '0700000012' }] };
function donnees(role) {
  const espaces = { site: role === 'principal' || role === 'site', paiements: role === 'principal' || role === 'caisse', compta: role === 'principal' || role === 'compta' };
  return {
    portail: { aal: 'aal1', facteurs: true },
    tables: {
      portail_reglages: [{ id: true, droit_inscription: 15000, premier_mois: 10000, mensualite_standard: 10000, mensualite_haute: 20000, jour_limite: 5, jour_relance: 3, jour_derniere_relance: 5,
        age_majorite: 18, mois_impayes_alerte: 2, seuil_double_validation: 100000, validite_code_jours: 30, essais_code: 3, heures_alerte_rapprochement: 48 }],
      v_site_mannequins: [{ id: 'p1', full_name: 'Awa Koné', category: 'femme', city: 'Abidjan', height_cm: 178, published: true, desactive: false, date_naissance: '2001-03-12', slug: 'awa-kone', photos: 6, created_at: '2026-09-01' }],
      v_site_candidatures: [{ id: 'c1', full_name: 'Fatou Bamba', genre: 'femme', city: 'Abidjan', height_cm: 176, date_naissance: '2005-04-02', status: 'nouvelle', source: 'en_ligne', created_at: '2026-10-10', code_statut: null },
        { id: 'c2', full_name: 'Kevin Diallo', genre: 'homme', city: 'Bouaké', height_cm: 186, date_naissance: '2000-08-02', status: 'retenue', source: 'direct', lieu_casting: 'Sofitel', created_at: '2026-10-11', code_statut: 'genere', code_indice: 'K7' },
        { id: 'c3', full_name: 'Paul Refusé', genre: 'homme', city: 'Abidjan', height_cm: 170, date_naissance: '2001-01-01', status: 'refusée', source: 'en_ligne', created_at: '2026-10-09', code_statut: null }],
      v_site_dossiers: [{ id: 'm1', nom: 'Awa Koné', categorie: 'Femme', date_entree: '2026-01-10', statut: 'validé' }],
      recruiter_requests: [{ id: 'r1', company: 'Maison XYZ', contact_name: 'M. Yao', email: 'contact@xyz.ci', phone: '0701010101', project_type: 'Défilé', status: 'nouvelle', created_at: '2026-10-12' }],
      page_views: [{ page: '/index.html', created_at: new Date().toISOString() }, { page: '/mannequins.html', created_at: new Date().toISOString() }],
      inscriptions_mannequins: [], actualites: [], model_photos: [], code_portail_mannequin: [], invite_codes: [],
      agence_mannequins: [awa, yao],
      model_profiles: [{ id: 'u-awa', full_name: 'Awa Koné', category: 'femme' }, { id: 'u-bolli', full_name: 'Bolli', category: 'femme' }],
      fee_dues: [
        { id: 'd1', mannequin_id: 'm1', type: 'mensualite', mois: MOIS, montant_du: 10000, montant_paye: 0, date_limite: MOIS.slice(0, 8) + '05', statut: 'declare', mannequin: awa, paiements: [], declarations: [] },
        { id: 'd2', mannequin_id: 'm2', type: 'mensualite', mois: MOIS, montant_du: 20000, montant_paye: 0, date_limite: MOIS.slice(0, 8) + '05', statut: 'non_paye', mannequin: yao, paiements: [], declarations: [] }],
      payment_declarations: [{ id: 'pd1', echeance_id: 'd1', numero_payeur: '0700000001', operateur: 'wave', montant: 10000, declare_le: new Date(Date.now() - 3600e3).toISOString(), statut: 'declare',
        echeance: { id: 'd1', type: 'mensualite', mois: MOIS, montant_du: 10000, montant_paye: 0, mannequin: awa } }],
      message_templates: [{ code: 'relance', libelle: 'Relance', texte: 'Bonjour {prenom}, rappel…' }, { code: 'appel', libelle: 'Le 1er : appel de paiement', texte: 'Bonjour {prenom}…' }],
      message_log: [{ id: 'ml1', canal: 'whatsapp', statut: 'a_envoyer', destinataire: 'Parent · Parent de Yao', adresse: '0700000012', texte: 'Bonjour, rappel', planifie_le: new Date().toISOString(), tentatives: 0 }],
      wave_links: [{ id: 'w1', type_droit: 'formation', montant: 10000, url: 'https://pay.wave.com/m/essai', actif: true }],
      month_snapshots: [], payments: [],
      activities: [{ code: 'formation', libelle: 'Formation' }, { code: 'inscription', libelle: 'Inscription' }, { code: 'casting', libelle: 'Casting' }],
      treasury_accounts: [{ code: 'wave', libelle: 'Wave Business' }, { code: 'caisse', libelle: 'Caisse' }],
      company_settings: [{ id: true, mode_legal: false, taux_tva: 18 }],
      ledger_entries: [{ id: 'l1', date_ecriture: MOIS, sens: 'recette', montant: 15000, activite: 'inscription', compte: 'wave', source: 'mannequin', reference: 'REC-2026-00001', libelle: 'Droit d’inscription' },
        { id: 'l2', date_ecriture: MOIS, sens: 'depense', montant: 5000, activite: 'Transport', compte: 'caisse', source: 'depense', reference: 'DEP-2026-0001', libelle: 'Taxi' }],
      v_compta_encaissements_agreges: [{ mois: MOIS, nature: 'inscription', nombre_payants: 1, total: 25000 }],
      invoices: [{ id: 'i1', type: 'facture', numero: 'FAC-2026-0001', statut: 'emis', total_ht: 150000, total_tva: 0, total_ttc: 150000, paye: 0, client: { nom: 'Marque Exemple' }, lignes: [{ designation: 'Casting', quantite: 1, prix_unitaire: 150000, ordre: 0 }], activite: 'casting', date_emission: MOIS }],
      clients: [{ id: 'cl1', nom: 'Marque Exemple' }], expenses: [], tax_obligations: [], fiscal_periods: [], accountant_requests: [],
      staff_profiles: [{ user_id: 'admin-1', nom: 'Maître Akesse', email: 'admin@test.ci', role: 'principal', actif: true, cree_le: '2026-10-18', appareils: [] },
        { user_id: 'u-k', nom: 'Comptable', email: 'k@test.ci', role: 'compta', actif: true, cree_le: '2026-10-18', appareils: [] }],
      staff_module_grants: [], staff_devices: [{ id: 'sd1', appareil: 'abc', libelle: 'Android, Chrome', installe_le: '2026-10-18', derniere_activite: new Date().toISOString(), revoque: false, personne: { nom: 'Maître Akesse' } }],
      audit_log: [{ id: 1, acteur_nom: 'Maître Akesse', acteur_role: 'principal', action: 'Paiement validé', objet: 'fee_dues', cree_le: new Date().toISOString() }]
    },
    rpc: {
      portail_moi: { role, mfa: true, nom: { principal: 'Maître Akesse', site: 'Gestion du site', caisse: 'Encaissements', compta: 'Comptable' }[role], actif: true, membre: true, espaces, contacts_prives: role !== 'site' && role !== 'compta', noms_payeurs: espaces.paiements },
      portail_enregistrer_appareil: { ok: true, nouveau: false },
      portail_valider_paiement: { recu: 'REC-2026-00002', paiement: 'p1', code_espace: 'ESP-K7P4-92' },
      portail_code_espace: 'ESP-QW3R-77',
      portail_inscription_agence: { recu: 'REC-2026-00003', paiement: 'p2', code_espace: 'ESP-ZX8C-44' },
      contacts_mannequins_admin: [{ model_id: 'u-awa', phone: '0700000001' }, { model_id: 'u-bolli', phone: '0700000009' }],
      profils_prives: [{ id: 'u-awa', date_naissance: '2001-03-12' }, { id: 'u-bolli', date_naissance: '2002-02-02' }],
      portail_message_selection: (c) => ({ personnes: c.p_mannequins.length, messages: c.p_mannequins.length * 3, sans_echeance: 0 })
    },
    api: { '/api/acces-tableau': () => ({ ok: true }), '/api/portail': (corps) => corps.action === 'codes_secours_creer' ? { codes: ['AAAAA-BBBBB', 'CCCCC-DDDDD', 'EEEEE-FFFFF', 'GGGGG-HHHHH', 'JJJJJ-KKKKK', 'LLLLL-MMMMM', 'NNNNN-PPPPP', 'QQQQQ-RRRRR'] } : { ok: true } }
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
    await capture(p, 'tuiles-' + ecran.width);
    // menu : à gauche sur ordinateur ; sur téléphone et tablette en vertical, bouton « ☰ Menu » qui fait glisser le menu
    for (const largeur of nomEcran === 'téléphone' ? [390, 768] : [1280]) {
      await p.setViewportSize({ width: largeur, height: ecran.height });
      await p.goto(url + '#/site/vue'); await p.waitForSelector('.lateral .nav', { state: 'attached' });
      const vu = () => p.evaluate(() => { const r = document.querySelector('.lateral').getBoundingClientRect(); return getComputedStyle(document.querySelector('.lateral')).visibility === 'visible' && r.right > 50; });
      if (largeur >= 1000) {
        ok(await vu() && !(await p.isVisible('[data-action="menu-ouvrir"]')), nomEcran + ' : menu toujours visible à gauche, sans bouton « Menu »');
      } else {
        ok(!(await vu()) && await p.isVisible('[data-action="menu-ouvrir"]'), largeur + ' px : menu caché, bouton « ☰ Menu » en haut');
        await p.click('[data-action="menu-ouvrir"]'); await p.waitForTimeout(400);
        const r = await p.evaluate(() => document.querySelector('.lateral').getBoundingClientRect().left);
        ok(await vu() && r === 0, largeur + ' px : « ☰ Menu » fait glisser le menu depuis la gauche');
        await p.click('.lateral .nav[href="#/site/candidatures"]'); await p.waitForTimeout(500);
        ok(!(await vu()) && (await p.evaluate(() => location.hash)) === '#/site/candidatures', largeur + ' px : choisir une rubrique l’ouvre et referme le menu');
        await p.click('[data-action="menu-ouvrir"]'); await p.waitForTimeout(400);
        await p.mouse.click(largeur - 10, 400); await p.waitForTimeout(400);
        ok(!(await vu()), largeur + ' px : toucher à côté du menu le referme');
      }
    }
    await p.setViewportSize(ecran);
    // chaque page de chaque espace
    const pages = { site: ['vue', 'mannequins', 'candidatures', 'recruteurs', 'dossiers', 'codes', 'outils'],
      paiements: ['mois', 'rapprocher', 'registre', 'fiche/m1', 'messages', 'matrice', 'recap', 'parametres'],
      compta: ['tableau', 'recettes', 'factures', 'depenses', 'impots', 'tresorerie', 'cloture', 'demandes', 'acces', 'entite'],
      securite: ['comptes', 'delegations', 'appareils', 'journal'] };
    for (const [esp, liste] of Object.entries(pages)) {
      for (const pg of liste) {
        await p.goto(url + '#/' + esp + '/' + pg); await p.waitForSelector('.contenu h1, .contenu .carte h2', { timeout: 6000 }).catch(() => {});
        await p.waitForFunction(() => !document.querySelector('.chargement'), null, { timeout: 6000 }).catch(() => {});
        const t = await texte(p);
        await capture(p, esp + '-' + pg.replace('/', '-') + '-' + ecran.width);
        const boutons = (await p.evaluate(verifierBoutons)).map((x) => x.texte + ' (' + x.element + ', fond ' + x.fond + ', texte ' + x.couleur + ', coins ' + x.rayon + ')');
        ok(!boutons.length, nomEcran + ' : ' + esp + '/' + pg + ' boutons au modèle rouge ' + boutons.join(' | '));
        ok(!t.includes('Impossible d’afficher') && !t.includes('Accès refusé'), nomEcran + ' : ' + esp + '/' + pg + ' s’affiche');
        if (nomEcran === 'ordinateur' && ['site/vue', 'paiements/mois', 'paiements/rapprocher', 'compta/tableau', 'securite/comptes'].includes(esp + '/' + pg)) {
          mal = await pales(p); ok(!mal.length, nomEcran + ' : ' + esp + '/' + pg + ' lisible ' + mal.join(' | '));
        }
      }
    }
    // candidatures (19/10/2026) : les refusées sont rangées à part, « Générer le code » seulement pour une retenue
    await p.goto(url + '#/site/candidatures'); await p.waitForFunction(() => !document.querySelector('.chargement'), null, { timeout: 6000 }).catch(() => {});
    let tc = await texte(p);
    ok(tc.includes('Kevin Diallo') && !tc.includes('Paul Refusé') && !tc.includes('Fatou Bamba'), nomEcran + ' : candidatures → seules les retenues s’affichent d’abord (refusées absentes)');
    ok(await p.$('[data-action="site-code"][data-id="c2"]') !== null, nomEcran + ' : « Générer le code » pour la candidature retenue');
    await p.click('[data-action="site-groupe-candidatures"][data-g="a_traiter"]'); await p.waitForTimeout(400);
    tc = await texte(p);
    ok(tc.includes('Fatou Bamba') && !tc.includes('Paul Refusé') && await p.$('[data-action="site-code"]') === null, nomEcran + ' : « À traiter » : pas de code tant que la candidature n’est pas retenue');
    await p.click('[data-action="site-groupe-candidatures"][data-g="refusees"]'); await p.waitForTimeout(400);
    tc = await texte(p);
    ok(tc.includes('Paul Refusé') && !tc.includes('Kevin Diallo'), nomEcran + ' : les refusées restent consultables à part (« Refusées (archivées) »)');
    // rapprochement : « Trouvé, valider » → fonction portail_valider_paiement avec la déclaration
    await p.goto(url + '#/paiements/rapprocher'); await p.waitForSelector('[data-action="paiements-trouve"]');
    ok((await texte(p)).includes('Vérifier le paiement de Awa Koné'), nomEcran + ' : la déclaration la plus ancienne est ouverte');
    await p.click('[data-action="paiements-trouve"]'); await p.waitForSelector('#pv-montant');
    ok((await p.inputValue('#pv-montant')) === '10000', nomEcran + ' : montant reçu prérempli (10 000)');
    await p.click('form[data-form="paiements-valider"] [type=submit]'); await p.waitForTimeout(800);
    const appel = journal.find((j) => j[0] === 'rpc' && j[1] === 'portail_valider_paiement');
    ok(appel && /"p_declaration":"pd1"/.test(appel[2]) && /"p_montant":10000/.test(appel[2]), nomEcran + ' : validation envoyée à la base (déclaration pd1, 10 000)');
    ok((await texte(p)).includes('ESP-K7P4-92'), nomEcran + ' : inscription validée → code personnel de l’espace affiché à l’agent');
    await p.click('[data-action="fermer-fenetre"]').catch(() => {});
    // fiche d'un mannequin sans espace : « Donner le code de l'espace »
    await p.goto(url + '#/paiements/fiche/m2'); await p.waitForSelector('[data-action="paiements-code-espace"]', { timeout: 6000 }).catch(() => {});
    await p.click('[data-action="paiements-code-espace"]').catch(() => {}); await p.waitForTimeout(600);
    ok((await texte(p)).includes('ESP-QW3R-77') && journal.some((j) => j[0] === 'rpc' && j[1] === 'portail_code_espace' && /"p_mannequin":"m2"/.test(j[2])), nomEcran + ' : fiche sans espace → nouveau code donné');
    // cahier 6 : les rubriques de l'ancien tableau de bord s'ouvrent DANS l'administration
    await p.goto(url + '#/site/fiches'); await p.waitForSelector('iframe.cadre-rubrique', { timeout: 8000 }).catch(() => {});
    const cadre = await p.$('iframe.cadre-rubrique');
    ok(cadre && /integre=1#b2-mannequins-publies$/.test(await cadre.getAttribute('src')) && journal.some((j) => j[0] === 'API' && j[1] === '/api/acces-tableau'),
       nomEcran + ' : « Fiches, photos, compcard et CV » s’ouvre dans l’administration (clé d’accès demandée)');
    const f = cadre && await cadre.contentFrame();
    if (f) { await f.waitForLoadState('domcontentloaded').catch(() => {}); await p.waitForTimeout(1500); }
    ok(f && await f.evaluate(() => document.documentElement.classList.contains('tdb-integre') && getComputedStyle(document.getElementById('db-chrome-header')).display === 'none'),
       nomEcran + ' : dans l’administration, l’en-tête et le menu de l’ancien tableau de bord sont retirés');
    await capture(p, 'site-fiches-integre-' + ecran.width);
    ok(!(await texte(p)).includes('Gestion détaillée'), nomEcran + ' : plus de bouton « gestion détaillée » vers une autre page');
    // cahier 7.5 : messages aux personnes cochées (groupé ou individuel)
    await p.click('[data-action="fermer-fenetre"]').catch(() => {});
    await p.goto(url + '#/paiements/messages'); await p.waitForSelector('input[data-change="paiements-coche"]', { timeout: 6000 }).catch(() => {});
    let tm = await texte(p);
    ok(tm.includes('Yao Bamba') && !tm.includes('Awa Koné') && (await p.$$('input[data-change="paiements-coche"]')).length === 1, nomEcran + ' : messages → « Non payés ce mois » coche d’office la personne non payée');
    await p.click('[data-action="paiements-filtre-message"][data-f="tous"]'); await p.waitForSelector('input[data-change="paiements-coche"][data-id="m1"]', { timeout: 6000 }).catch(() => {});
    ok((await p.$$('input[data-change="paiements-coche"]:checked')).length === 2, nomEcran + ' : « Tout le monde » : les deux mannequins cochés');
    await p.uncheck('input[data-change="paiements-coche"][data-id="m1"]'); await p.waitForTimeout(200);
    ok((await p.textContent('#msg-envoyer')).includes('1 personne'), nomEcran + ' : décocher met à jour le bouton (1 personne)');
    await p.click('#msg-envoyer'); await p.waitForTimeout(700);
    let sel = journal.filter((j) => j[0] === 'rpc' && j[1] === 'portail_message_selection').pop();
    ok(sel && /"p_mannequins":\["m2"\]/.test(sel[2]), nomEcran + ' : envoi groupé → seulement les cochés (m2)');
    await p.click('[data-action="paiements-envoyer-un"][data-id="m1"]').catch(() => {}); await p.waitForTimeout(700);
    sel = journal.filter((j) => j[0] === 'rpc' && j[1] === 'portail_message_selection').pop();
    ok(sel && /"p_mannequins":\["m1"\]/.test(sel[2]), nomEcran + ' : « Envoyer à lui seul » → une seule personne (m1)');
    // cahier 7.1 : import du registre (CSV) — une personne déjà présente est écartée et signalée
    await p.goto(url + '#/paiements/registre'); await p.waitForSelector('#rg-import', { state: 'attached', timeout: 6000 }).catch(() => {});
    await p.setInputFiles('#rg-import', { name: 'registre.csv', mimeType: 'text/csv', buffer: Buffer.from('Nom;Prénoms;Date de naissance;Téléphone\nKoné;Awa;12/03/2001;0700000001\n') });
    await p.waitForTimeout(900);
    tm = await texte(p);
    ok(tm.includes('Import du registre') && tm.includes('déjà dans le registre'), nomEcran + ' : import CSV du registre : doublon écarté et signalé');
    await p.click('[data-action="fermer-fenetre-afficher"]').catch(() => {});
    // cahier 7.1 : vos mannequins déjà sur le site entrent au registre (mensualité, pas d'inscription)
    await p.goto(url + '#/paiements/registre'); await p.waitForSelector('form[data-form="paiements-reprendre-fiches"]', { state: 'attached', timeout: 6000 }).catch(() => {});
    await p.evaluate(() => { const d = document.querySelector('form[data-form="paiements-reprendre-fiches"]').closest('details'); d.open = true; });
    tm = await texte(p);
    ok(tm.includes('1 à mettre dans le registre') && tm.includes('Bolli'), nomEcran + ' : registre → les mannequins du site absents du registre sont proposés (Awa, déjà reliée, ne l’est pas)');
    await p.click('form[data-form="paiements-reprendre-fiches"] [type=submit]'); await p.waitForTimeout(900);
    const reprise = journal.filter((j) => j[0] === 'POST' && j[1] === 'agence_mannequins').pop();
    const echeance = journal.filter((j) => j[0] === 'POST' && j[1] === 'fee_dues').pop();
    ok(reprise && /"user_id":"u-bolli"/.test(reprise[3]) && echeance && /"type":"mensualite"/.test(echeance[3]) && /"montant_du":10000/.test(echeance[3]),
       nomEcran + ' : Bolli entre au registre, relié à son espace, avec la mensualité du mois (pas 25 000)');
    await p.click('[data-action="fermer-fenetre-afficher"]').catch(() => {});
    // inscription payée en espèces à l'agence, sans passer par le site
    await p.click('[data-action="fermer-fenetre"]').catch(() => {});
    await p.goto(url + '#/paiements/registre'); await p.waitForSelector('#ia-cand', { state: 'attached', timeout: 6000 }).catch(() => {});
    await p.evaluate(() => { const d = document.getElementById('ia-cand').closest('details'); d.open = true; });
    await p.check('form[data-form="paiements-inscription-agence"] input[name=reglement]').catch(() => {});
    await p.click('form[data-form="paiements-inscription-agence"] [type=submit]').catch(() => {}); await p.waitForTimeout(800);
    const ia = journal.find((j) => j[0] === 'rpc' && j[1] === 'portail_inscription_agence');
    ok(ia && /"p_candidature":"c2"/.test(ia[2]) && /"p_mode":"especes"/.test(ia[2]) && /"p_reglement_accepte":true/.test(ia[2]) && (await texte(p)).includes('ESP-ZX8C-44'),
       nomEcran + ' : inscription payée en espèces à l’agence → registre, reçu et code de l’espace');
    ok((await texte(p)).includes('REC-2026-00003'), nomEcran + ' : le numéro de reçu est annoncé');
    ok(!errs.length, nomEcran + ' : aucune erreur de page (principal) ' + errs.join(' | '));
    await ctx.close();

    // 2. Administrateur du site : directement dans son espace, aucun montant
    const s = await ouvrir('site', ecran);
    await s.p.waitForSelector('#cx-code'); await s.p.fill('#cx-code', '123456'); await s.p.click('form[data-form="code"] [type=submit]');
    await s.p.waitForFunction(() => location.hash.startsWith('#/site/'), null, { timeout: 6000 }).catch(() => {});
    await s.p.waitForFunction(() => !document.querySelector('.chargement'), null, { timeout: 6000 }).catch(() => {});
    ok(s.p.url().includes('#/site/vue'), nomEcran + ' : l’administrateur du site arrive directement dans son espace');
    let tous = '';
    for (const pg of ['vue', 'mannequins', 'candidatures', 'dossiers']) {
      await s.p.goto(url + '#/site/' + pg); await s.p.waitForFunction(() => !document.querySelector('.chargement'), null, { timeout: 6000 }).catch(() => {});
      tous += await texte(s.p);
    }
    ok(!/FCFA|wave\.com/i.test(tous), nomEcran + ' : aucun montant ni lien de paiement dans l’espace du site');
    ok(tous.includes('masqués pour votre rôle') && !tous.includes('0700000001'), nomEcran + ' : contacts privés masqués pour l’administrateur du site');
    await s.p.goto(url + '#/paiements/mois'); await s.p.waitForTimeout(500);
    ok((await texte(s.p)).includes('Accès refusé'), nomEcran + ' : l’administrateur du site ne peut pas ouvrir l’espace paiements');
    ok(!s.errs.length, nomEcran + ' : aucune erreur de page (site) ' + s.errs.join(' | '));
    await s.ctx.close();

    // 3. Comptable : aucun nom de mannequin
    const k = await ouvrir('compta', ecran);
    await k.p.waitForSelector('#cx-code'); await k.p.fill('#cx-code', '123456'); await k.p.click('form[data-form="code"] [type=submit]');
    await k.p.waitForFunction(() => location.hash.startsWith('#/compta/'), null, { timeout: 6000 }).catch(() => {});
    let ttk = '';
    for (const pg of ['tableau', 'recettes', 'cloture']) {
      await k.p.goto(url + '#/compta/' + pg); await k.p.waitForFunction(() => !document.querySelector('.chargement'), null, { timeout: 6000 }).catch(() => {});
      ttk += await texte(k.p);
    }
    ok(!/Awa|Yao/.test(ttk), nomEcran + ' : le comptable ne voit aucun nom de mannequin');
    ok(/1 payant\(s\)/.test(ttk), nomEcran + ' : le comptable voit le total des encaissements, sans nom');
    ok(!k.errs.length, nomEcran + ' : aucune erreur de page (comptable) ' + k.errs.join(' | '));
    await k.ctx.close();

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
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
