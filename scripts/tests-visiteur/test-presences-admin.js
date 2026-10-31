// Liste de présence des cours du dimanche dans l'Administration (chantier 14, 01/11/2026), comme l'agence
// un dimanche, sur téléphone et ordinateur, base SIMULÉE (rien n'est écrit pour de vrai) :
//  - le mois et ses dimanches (4 ou 5, trouvés tout seuls), une ligne par mannequin, la mention du mois ;
//  - un toucher : vide/rouge → présente (vert) → excusée (orange) → vide, enregistré aussitôt, la mention suit ;
//  - un dimanche passé non coché est rouge ; un dimanche à venir ne se coche pas ;
//  - annuler une séance (motif), chercher un nom, la synthèse sur une période ;
//  - base pas encore activée : c'est dit clairement.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const chemin = require('path');
require(chemin.join(__dirname, '../../js/presences-calcul.js'));
const C = globalThis.Presences;
const PORT = String(9400 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };

// le mois précédent : tous ses dimanches sont passés
const ceMois = C.jourIso(new Date()).slice(0, 7), avant = C.moisVoisin(ceMois, -1), jours = C.dimanchesDuMois(avant);
const M = [
  { id: 'r1', nom: 'AWA KONÉ', date_entree: '2025-01-01', compte: 'm1', statut: 'actif' },
  { id: 'r2', nom: 'BINTOU TRAORÉ', date_entree: '2025-01-01', compte: null, statut: 'actif', mensualite: 'non_paye' },
  { id: 'r3', nom: 'CHLOÉ YAO', date_entree: '2025-01-01', compte: null, statut: 'actif' }];
function moisSimule(corps) {
  const mois = String(corps.p_mois || '').slice(0, 7);
  return { mannequins: M, annulees: [], presences: mois === avant ? jours.map((d) => ({ mannequin: 'r1', dimanche: d, etat: 'present' })).concat([{ mannequin: 'r3', dimanche: jours[0], etat: 'excuse' }]) : [] };
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept(dl.type() === 'prompt' ? 'Fête de l’agence' : undefined));
    const d = donnees('principal');
    d.rpc.presences_mois = moisSimule;
    d.rpc.presences_periode = () => ({ mannequins: M, annulees: [], presences: jours.map((x) => ({ mannequin: 'r1', dimanche: x, etat: 'present' })) });
    d.rpc.presence_marquer = () => null; d.rpc.presences_seance_annuler = () => null;
    d.rpc.mannequins_du_mois_historique = []; d.rpc.mannequin_du_mois_choisir = () => null;
    await brancher(p, d, journal); await photosLocales(p);
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    const appels = (nomRpc) => journal.filter((j) => j[0] === 'rpc' && j[1] === nomRpc).map((j) => JSON.parse(j[2] || '{}'));

    await p.goto(URL_ADMIN + '#/site/b2-presences'); await p.waitForSelector('.pr-grille'); await p.waitForTimeout(600);
    ok(/Liste de présence/.test(await p.textContent('.lateral, nav, body')), n + 'la rubrique est dans le menu « Mannequins »');
    ok((await p.$$('.pr-grille thead .pr-jour')).length === C.dimanchesDuMois(ceMois).length && (await p.$$('.pr-grille tbody tr')).length === 3, n + 'ce mois-ci : ses ' + C.dimanchesDuMois(ceMois).length + ' dimanches et les 3 mannequins');
    // mannequin du mois : proposée parmi les assidues du mois précédent (Awa), choisie avec un petit mot
    ok(/Mannequin du mois/.test(await p.textContent('.pr-mdm')) && (await p.$$('.pr-mdm-liste li')).length === 1 && /AWA KONÉ/.test(await p.textContent('.pr-mdm-liste')), n + 'mannequin du mois : seule l’assidue du mois précédent est proposée');
    await p.click('.pr-mdm-liste [data-action="mdm-choisir"]'); await p.waitForTimeout(800);
    ok(appels('mannequin_du_mois_choisir').some((a) => a.p_mannequin === 'r1' && a.p_mot), n + 'mannequin du mois : choisie, avec son petit mot');
    await p.waitForSelector('.pr-grille');
    await p.click('[data-action="presences-mois"][data-pas="-1"]'); await p.waitForSelector('.pr-grille'); await p.waitForTimeout(500);
    ok((await p.$$('.pr-grille thead .pr-jour')).length === jours.length, n + 'mois précédent : ' + jours.length + ' dimanches trouvés tout seuls');
    const ligne = (i) => '.pr-grille tbody tr:nth-child(' + i + ')';
    const etats = (i) => p.$$eval(ligne(i) + ' .pr-case', (l) => l.map((c) => c.dataset.etat).join());
    ok((await etats(1)) === jours.map(() => 'present').join() && /Apprenant assidu, bravo/.test(await p.textContent(ligne(1) + ' .pr-mention')), n + 'toutes les séances : vert partout, « Apprenant assidu, bravo ! »');
    ok((await etats(2)) === jours.map(() => 'absent').join() && /Absent tout le mois/.test(await p.textContent(ligne(2) + ' .pr-mention')), n + 'aucune croix sur des dimanches passés : rouge partout, « Absent tout le mois »');
    ok((await etats(3)).startsWith('excuse,'), n + 'absence excusée : orange');
    ok(/retard/.test(await p.textContent(ligne(2) + ' .pr-nom')) && !(await p.$(ligne(1) + ' .pr-a-payer')), n + 'mensualité du mois pas payée : petit signe « retard » à côté du nom (seulement elle)');
    // cocher Bintou au 1er dimanche : vert, enregistré, mention recalculée ; puis excusée ; puis décochée
    const caseB = ligne(2) + ' .pr-case[data-jour="' + jours[0] + '"]';
    await p.click(caseB); await p.waitForTimeout(500);
    ok((await p.getAttribute(caseB, 'data-etat')) === 'present' && appels('presence_marquer').some((a) => a.p_mannequin === 'r2' && a.p_dimanche === jours[0] && a.p_etat === 'present'), n + 'un toucher : présente (vert), enregistrée aussitôt');
    ok(/Insuffisant/.test(await p.textContent(ligne(2) + ' .pr-mention')), n + 'la mention suit tout de suite (1 sur ' + jours.length + ' : Insuffisant)');
    await p.click(caseB); await p.waitForTimeout(500);
    ok((await p.getAttribute(caseB, 'data-etat')) === 'excuse' && appels('presence_marquer').some((a) => a.p_etat === 'excuse'), n + 'deuxième toucher : absence excusée (orange)');
    await p.click(caseB); await p.waitForTimeout(500);
    ok((await p.getAttribute(caseB, 'data-etat')) === 'absent' && appels('presence_marquer').some((a) => a.p_etat === null), n + 'troisième toucher : décochée (redevient rouge, dimanche passé)');
    // annuler une séance (avec motif)
    await p.click('.pr-jour:nth-child(3) [data-action="presences-annuler"]'); await p.waitForTimeout(800);
    ok(appels('presences_seance_annuler').some((a) => a.p_annulee === true && a.p_dimanche === jours[1] && /Fête/.test(a.p_motif)), n + 'annuler une séance : enregistré avec son motif');
    // chercher un nom
    await p.fill('#pr-recherche', 'chloé'); await p.waitForTimeout(300);
    ok(await p.$$eval('.pr-grille tbody tr', (l) => l.filter((t) => !t.hidden).length) === 1, n + 'chercher un nom : une seule ligne');
    await p.fill('#pr-recherche', ''); await p.waitForTimeout(200);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), n + 'rien ne déborde de l’écran (le tableau défile dans son cadre)');
    const pales = await lirePageEntiere(p);
    ok(!pales.length, n + 'textes lisibles ' + pales.slice(0, 3).map((x) => x.texte.slice(0, 20) + ' (' + x.contraste + ')').join(', '));
    // mois suivant : dimanches à venir, rien à cocher
    await p.click('[data-action="presences-mois"][data-pas="1"]'); await p.waitForTimeout(300);
    await p.click('[data-action="presences-mois"][data-pas="1"]'); await p.waitForSelector('.pr-grille'); await p.waitForTimeout(500);
    ok(await p.$$eval('.pr-grille .pr-case', (l) => l.length > 0 && l.every((c) => c.disabled)), n + 'mois à venir : aucune case ne se coche');
    // synthèse
    await p.goto(URL_ADMIN + '#/site/b2-presences/synthese'); await p.waitForSelector('.pr-synthese'); await p.waitForTimeout(500);
    await p.click('.pr-synthese:first-of-type summary'); await p.waitForTimeout(300);
    ok((await p.$$('.pr-synthese')).length === 3 && /Apprenant assidu|Bien|Passable/.test(await p.textContent('.pr-synthese:first-of-type')) && (await p.$$('.pr-synthese:first-of-type .pr-detail li')).length >= 1, n + 'synthèse : chaque mannequin, son total et le détail mois par mois');
    ok(appels('presences_periode').length >= 1, n + 'synthèse : la période est lue en une fois');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  // base pas encore activée (fichier SQL pas encore collé)
  {
    const ctx = await b.newContext({ serviceWorkers: 'block' }); const p = await ctx.newPage();
    const d = donnees('principal'); d.rpc.presences_mois = { erreur: 'Could not find the function public.presences_mois' };
    await brancher(p, d, []); await photosLocales(p); await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');
    await p.goto(URL_ADMIN + '#/site/b2-presences'); await p.waitForTimeout(1500);
    ok(/pas encore activée/.test(await p.textContent('body')), 'base pas encore activée : c’est dit clairement');
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
