// Programmation défilé (24/10/2026, demande de la propriétaire), comme l'agence, sur téléphone et
// ordinateur : programmer un défilé sur 2 jours (nouveau projet de l'Agenda), ajouter des passages
// (« tous les jours » et un passage dans une autre salle 30 minutes après), choisir les mannequins
// retenues (agence et extérieures), « ⚡ Répartir », retirer un visage, remplir une place à la
// main, répartir de nouveau (la place choisie à la main reste), « Convoquer ».
// Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const PORT = String(9600 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
let srv; process.on('exit', () => srv && srv.kill());
(async () => {
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept());
    const d = donnees('principal');
    d.tables.agenda_projets = d.tables.agenda_projets || [];
    d.tables.defile_passages = []; d.tables.defile_vivier = []; d.tables.defile_affectations = [];
    d.tables.contacts_externes = [{ id: 'x1', civilite: 'Madame', nom: 'AWA EXTÉRIEURE', mannequin_id: null }, { id: 'x2', civilite: 'Monsieur', nom: 'JEAN EXTÉRIEUR', mannequin_id: null }];
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    const ecrits = (table, m) => journal.filter((j) => j[0] === m && j[1] === table).map((j) => JSON.parse(j[3] || 'null'));

    // 1. Liste, puis nouveau défilé sur 2 jours
    await p.goto(URL_ADMIN + '#/site/b2-defiles'); await p.waitForSelector('[data-action="defile-nouveau"]', { timeout: 15000 });
    const compartiment = await p.evaluate(() => { const a = document.querySelector('.lateral .nav.actif'), c = a && a.closest('.compartiment'); return c ? c.getAttribute('aria-label') : ''; });
    ok(/Aucun défilé programmé/.test(await p.textContent('#contenu')) && compartiment === 'Projets et convocations', n + 'liste vide ; la rubrique est dans le compartiment « ' + compartiment + ' »');
    await p.click('[data-action="defile-nouveau"]'); await p.waitForSelector('.voile #df-titre');
    await p.fill('#df-titre', 'FASHION WEEK'); await p.fill('#df-debut', '2030-12-01'); await p.fill('#df-fin', '2030-12-02'); await p.fill('#df-lieu', 'Sofitel');
    await p.click('form[data-form="defile-nouveau"] [type=submit]'); await p.waitForSelector('form[data-form="defile-passage"]', { timeout: 10000 }); await p.waitForTimeout(500);
    const projet = ecrits('agenda_projets', 'POST').flat().pop() || {};
    ok(projet.type === 'defile' && projet.date_fin === '2030-12-02' && projet.visible === false && /#\/site\/b2-defiles\/.+/.test(p.url()), n + 'nouveau défilé : projet de l’Agenda sur 2 jours (caché du site), sa fiche s’ouvre');
    // 2. Passages : 17h00 salle A tous les jours, puis 17h30 salle B le premier jour
    await p.selectOption('#dp-jour', 'tous'); await p.fill('#dp-heure', '17:00'); await p.fill('#dp-salle', 'Salle A'); await p.fill('#dp-femmes', '3'); await p.fill('#dp-hommes', '1');
    await p.click('form[data-form="defile-passage"] [type=submit]'); await p.waitForTimeout(1200);
    await p.selectOption('#dp-jour', '2030-12-01'); await p.fill('#dp-heure', '17:30'); await p.fill('#dp-salle', 'Salle B'); await p.fill('#dp-theme', 'Créateur Pathé’O'); await p.fill('#dp-femmes', '3'); await p.fill('#dp-hommes', '1');
    await p.click('form[data-form="defile-passage"] [type=submit]'); await p.waitForTimeout(1200);
    ok(d.tables.defile_passages.length === 3 && (await p.$$('.df-passages li')).length === 3 && /Pathé’O/.test(await p.textContent('.df-jour')), n + 'passages : « tous les jours » (2) + un autre passage le premier jour, listés jour par jour');
    // 3. Vivier : tout le monde (10 femmes et 2 hommes de l'agence, 1 femme et 1 homme extérieurs)
    await p.click('[data-action="defile-vivier"]'); await p.waitForSelector('.voile .df-choix');
    ok(/Femmes extérieures/.test(await p.textContent('.voile')) && /Hommes de l’agence/.test(await p.textContent('.voile')), n + 'choix du vivier : femmes et hommes, agence et extérieures, avec leurs visages');
    for (const c of await p.$$('.voile input[name="cle"]')) await c.check();
    await p.click('form[data-form="defile-vivier"] [type=submit]'); await p.waitForTimeout(1500);
    ok(d.tables.defile_vivier.length === 17 && /14 femmes \(13 de l’agence, 1 extérieures\) · 3 hommes \(2 de l’agence, 1 extérieurs\)/.test(await p.textContent('#contenu')), n + 'vivier : 17 mannequins (site, registre sans compte, extérieures), comptées par sexe et origine');
    // 4. Répartition automatique
    await p.click('[data-action="defile-repartir"]'); await p.waitForTimeout(2000);
    ok((await p.$$('.df-place.prise')).length === 12 && !(await p.$('.df-place:not(.prise)')) && !(await p.$('.df-carte .conflit, section .note.attention')), n + '« Répartir » : les 3 passages remplis (3 femmes, 1 homme chacun), aucun conflit (17h00 et 17h30 : personnes différentes)');
    ok((await p.$$('.df-synthese li')).length === 17, n + 'synthèse : le nombre de passages de chaque mannequin');
    // 5. Retirer un visage, puis remplir la place à la main
    await p.click('.df-place.prise'); await p.waitForTimeout(1200);
    ok((await p.$$('.df-place.prise')).length === 11 && (await p.$$('.df-place:not(.prise)')).length === 1, n + 'toucher un visage le retire : la place redevient libre');
    await p.click('.df-place:not(.prise)'); await p.waitForSelector('.voile [data-action="defile-placer"]');
    await p.click('.voile [data-action="defile-placer"]'); await p.waitForTimeout(1200);
    ok((await p.$$('.df-place.prise.main')).length === 1 && ecrits('defile_affectations', 'POST').some((x) => x && x.a_la_main === true), n + 'place remplie à la main (bord rouge)');
    await p.click('[data-action="defile-repartir"]'); await p.waitForTimeout(2000);
    ok((await p.$$('.df-place.prise.main')).length === 1 && (await p.$$('.df-place.prise')).length === 12, n + '« Répartir » de nouveau : la mannequin placée à la main reste à sa place');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne dépasse de l’écran');
    // 6. Remplacer une mannequin (absente) : ses places sont reprises par d'autres
    const avantRemplacer = d.tables.defile_affectations.length;
    await p.click('.df-synthese [data-action="defile-remplacer"]'); await p.waitForTimeout(2000);
    ok(/remplaçante/.test(await p.textContent('body')) && (await p.$$('.df-place.prise')).length === 12 && d.tables.defile_affectations.length === avantRemplacer, n + '« Remplacer » : elle quitte ses passages, d’autres prennent ses places');
    // 7. Imprimer le programme (fenêtre d'impression, rien d'envoyé)
    await p.evaluate(() => { window.__imprime = ''; window.open = () => ({ document: { write: (h) => { window.__imprime += h; }, close() {} }, focus() {}, print() {} }); });
    await p.click('[data-action="defile-imprimer"]'); await p.waitForTimeout(300);
    const imprime = await p.evaluate(() => window.__imprime);
    ok(/FASHION WEEK/.test(imprime) && /Salle A/.test(imprime) && /Pathé’O/.test(imprime) && (imprime.match(/class="n"/g) || []).length === 12, n + '« Imprimer le programme » : jour par jour, chaque passage avec ses 4 noms');
    // 8. Convoquer
    await p.click('[data-action="defile-convoquer"]'); await p.waitForTimeout(1500);
    ok(journal.some((j) => j[0] === 'rpc' && j[1] === 'defile_participants') && /#\/site\/b2-convocations$/.test(p.url()), n + '« Convoquer » : toutes les mannequins placées deviennent participantes (site, registre, extérieures), les Convocations s’ouvrent');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  // 9. La fiche programme sur « Confirmer ma présence » (lien personnel)
  for (const [nom, ecran] of [['téléphone', { width: 375, height: 760 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    const n = nom + ' : fiche programme : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: ecran.width < 700 }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    const J = 'a'.repeat(36);
    await brancher(p, { tables: {}, rpc: {
      convocation_lire: [{ titre: 'FASHION WEEK', type: 'defile', date_debut: '2030-12-01', date_fin: '2030-12-02', heure_convocation: '15:00', lieu: 'Sofitel', ville: 'Abidjan', nom: 'Mademoiselle AYA KOUASSI', parent: false, reponse: 'confirme', passe: false }],
      defile_programme: { passages: [
        { jour: '2030-12-01', debut: '17:00', salle: 'Salle A', theme: null, moi: true, mannequins: [{ nom: 'AYA KOUASSI', photo: null, moi: true }, { nom: 'Madame AWA EXTÉRIEURE', photo: null, moi: false }] },
        { jour: '2030-12-01', debut: '17:30', salle: 'Salle B', theme: 'Pathé’O', moi: false, mannequins: [{ nom: 'GRÂCE YAO', photo: null, moi: false }] },
        { jour: '2030-12-02', debut: '17:00', salle: 'Salle A', theme: null, moi: true, mannequins: [{ nom: 'AYA KOUASSI', photo: null, moi: true }] }] } } }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/confirmer.html?c=' + J); await p.waitForSelector('#cf-programme:not([hidden])', { timeout: 10000 });
    const mes = await p.$$eval('.cf-mes-passages li', (l) => l.map((x) => x.textContent));
    ok(mes.length === 2 && /1 décembre.*17h00 · Salle A/i.test(mes[0]), n + 'ses 2 passages en tête (' + mes.join(' | ') + ')');
    ok((await p.$$('.cf-passage')).length === 3 && (await p.$$('.cf-passage.moi')).length === 2 && (await p.$$('.cf-jour')).length === 2 && /AE/.test(await p.textContent('.cf-ronds')), n + 'le programme complet jour par jour, ses passages soulignés, les autres avec leurs initiales');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) && !errs.length, n + 'rien ne dépasse, aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
