// Espace 2 — « Messages et relances » (cahier V3, 7.2), essayé comme une vraie personne sur téléphone et
// ordinateur, base SIMULÉE : modèles à variables, destinataires cochés (le parent pour un mineur), filtres, aperçu,
// envoi par e-mail puis file WhatsApp, envois de la session.
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


  const now = new Date(); const an = now.getFullYear(), mc = now.getMonth() + 1;
  const mm = (n) => an + '-' + String(n).padStart(2, '0') + '-01';
  for (const [nomEcran, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const e = await ouvrir('caisse', ecran, (d) => {
      d.tables.agence_mannequins = [
        { id: 'r1', full_name: 'ROXANE OUATTARA', telephone: '0102030405', email: 'roxane@test.ci', mensualite: 10000, statut: 'actif', user_id: 'm-site', date_naissance: '1999-01-01' },
        { id: 'r2', full_name: 'KONÉ AWA', telephone: '0707070707', email: 'awa@test.ci', mensualite: 20000, statut: 'actif', user_id: null, date_naissance: '2000-01-01' },
        { id: 'r3', full_name: 'KOUAME JEAN', telephone: '0505050505', mensualite: 10000, statut: 'actif', user_id: null, date_naissance: '2012-05-05', parent_nom: 'MADAME KOUAME', parent_telephone: '0101010101', parent_email: 'parent@test.ci' }];
      d.tables.messages_envoyes = []; d.tables.modeles_messages = [];
      d.tables.paiements_mannequins = [{ id: 'p1', mannequin_id: 'r1', objet: 'mensualite', mois: mm(mc), montant: 10000, statut: 'valide' }];
    });
    const p = e.p; p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) e.errs.push('console : ' + m.text().slice(0, 140)); });
    await p.addInitScript(() => { window.__mails = []; window.envoyerEmailCandidat = (x) => { window.__mails.push(x); return Promise.resolve(); }; });
    await p.waitForSelector('#cx-code'); await p.fill('#cx-code', '123456'); await p.click('form[data-form="code"] [type=submit]');
    await p.waitForFunction(() => location.hash.startsWith('#/paiements/'), null, { timeout: 8000 }).catch(() => {});
    await p.evaluate(() => { window.__mails = []; window.envoyerEmailCandidat = (x) => { window.__mails.push(x); return Promise.resolve(); }; });
    await p.goto(p.url().split('#')[0] + '#/paiements/messages');
    await p.waitForSelector('#msg-texte', { timeout: 8000 }).catch(() => {});
    await p.evaluate(() => { window.__mails = []; window.envoyerEmailCandidat = (x) => { window.__mails.push(x); return Promise.resolve(); }; });
    const t = () => p.evaluate(() => document.querySelector('.contenu').innerText.replace(/\s+/g, ' '));
    ok(/Messages et relances/.test(await t()), nomEcran + ' : page « Messages et relances »');
    ok((await p.$$('[data-action="msg-modele"]')).length === 6, nomEcran + ' : 6 modèles (appel, relances, non reçu, confirmé, libre)');
    ok(/\{prenom\}/.test(await p.inputValue('#msg-texte')), nomEcran + ' : le modèle montre ses variables');
    // filtre par défaut : pas encore payé → KONÉ et KOUAME, pas ROXANE (qui a payé)
    const noms = await p.$$eval('input[name="msg-ids"]', (l) => l.map((x) => x.closest('tr').textContent));
    ok(noms.length === 2 && !noms.some((x) => /ROXANE/.test(x)), nomEcran + ' : « pas encore payé » exclut ceux qui ont payé');
    ok(noms.some((x) => /MADAME KOUAME \(parent\)/.test(x)), nomEcran + ' : le destinataire d’un mineur est son parent');
    await p.click('[data-action="msg-filtre"][data-filtre="inscrits"]'); await p.waitForTimeout(800);
    ok((await p.$$('input[name="msg-ids"]')).length === 1 && /ROXANE/.test(await t()), nomEcran + ' : filtre « inscrits sur le site »');
    await p.click('[data-action="msg-filtre"][data-filtre="non_payes"]'); await p.waitForTimeout(800);
    // aperçu : variables remplies, prénom du parent pour le mineur
    await p.click('[data-action="msg-modele"][data-modele="relance3"]'); await p.waitForTimeout(600);
    await p.uncheck('input[name="msg-ids"]'.concat('[value="r2"]'));
    await p.click('[data-action="msg-apercu"]'); await p.waitForSelector('pre.journal', { timeout: 5000 });
    const ap = await p.textContent('pre.journal');
    ok(/Bonjour Madame,/.test(ap) && /10 000 FCFA/.test(ap) && /5 /.test(ap) && !/\{\w+\}/.test(ap), nomEcran + ' : aperçu avec les variables remplies, au parent ' + ap.slice(0, 60).replace(/\n/g, ' '));
    await p.click('#fenetre [data-action="fermer-fenetre"], [data-action="fermer-fenetre"]'); await p.waitForTimeout(300);
    // envoi : un seul destinataire coché → un e-mail au parent, puis la file WhatsApp
    p.on('dialog', (dl) => dl.accept());
    await p.click('[data-action="msg-envoyer"]'); await p.waitForSelector('a[href^="https://wa.me/"]', { timeout: 8000 }).catch(() => {});
    const mails = await p.evaluate(() => window.__mails);
    ok(mails.length === 1 && mails[0].to_email === 'parent@test.ci' && /Petit rappel/.test(mails[0].message), nomEcran + ' : un e-mail parti, au parent, avec le texte du modèle ' + mails.length);
    const wa = decodeURIComponent((await p.getAttribute('a[href^="https://wa.me/"]', 'href')) || '');
    ok(/^https:\/\/wa\.me\/2250101010101/.test(wa), nomEcran + ' : lien WhatsApp vers le parent');
    await p.evaluate(() => { document.querySelectorAll('a[data-wa-id]').forEach((a) => { a.removeAttribute('target'); a.setAttribute('href', '#/paiements/messages'); }); });
    await p.click('a[data-wa-id]'); await p.waitForTimeout(600);
    const notes = e.journal.filter((j) => j[0] === 'POST' && j[1] === 'messages_envoyes').map((j) => [].concat(JSON.parse(j[3]))[0]);
    ok(notes.length === 2 && notes[0].canal === 'email' && notes[0].mannequin_id === 'r3' && notes[0].modele === 'relance3' && !('texte' in notes[0]), nomEcran + ' : l’e-mail laisse une ligne dans l’historique durable, sans le texte ' + JSON.stringify(notes[0]));
    ok(notes[1] && notes[1].canal === 'whatsapp' && notes[1].mannequin_id === 'r3', nomEcran + ' : le clic sur « Envoyer » WhatsApp laisse sa ligne ' + JSON.stringify(notes[1]));
    await p.click('[data-action="fermer-fenetre"]'); await p.waitForTimeout(300);
    ok(/Messages envoyés/.test(await t()), nomEcran + ' : section « Messages envoyés » ');
    ok(!(await p.$('[data-action="msg-enregistrer-modele"]')), nomEcran + ' : encaissements → pas d’enregistrement de modèle');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), nomEcran + ' : pas de défilement de côté de la page');
    await p.screenshot({ path: __dirname + '/medias/messages-' + (ecran.width > 860 ? 'pc' : 'tel') + '.png', fullPage: true });
    ok(!e.errs.length, nomEcran + ' : aucune erreur de page ' + e.errs.join(' | '));
    await e.ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' contrôle(s) en échec' : '\n✅ Tout est conforme');
  process.exit(ko ? 1 : 0);
})();
