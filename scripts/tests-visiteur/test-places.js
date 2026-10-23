// « Places limitées » (23/10/2026), comme une vraie personne, sur téléphone et ordinateur :
//  1. l'agence (Administration) : nouvel appel à places (2 femmes, 1 homme) sur un projet de
//     l'agenda → liens préparés → « Envoyer le lien suivant » un par un (la mineure ET son parent,
//     même lien ; sans numéro signalée) → places prises : grille avec les visages, cliquables →
//     désistement : « Annoncer une place libre » → « Convoquer les sélectionnées » → nombre de
//     places plus petit que les sélectionnées refusé → fermer l'appel → liste des appels ;
//  2. la mannequin (page publique places.html, sans compte) : il reste des places → « Je prends
//     ma place » → « Bravo » en vert ; le parent voit « Votre fille a déjà pris sa place » ;
//     « Oups… plus de place » ; désistement ; lien inconnu.
// Base simulée : rien n'est écrit ni envoyé pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const admin = require('./donnees-nouvelle-admin');
const PORT = String(9700 + Math.floor(Math.random() * 90));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const BASE = 'http://127.0.0.1:' + PORT + '/';
const J = (c) => c.repeat(36);
const ecrits = (journal, m, table) => journal.filter(j => j[0] === m && j[1] === table).map(j => JSON.parse(j[3] || 'null'));

function donneesAdmin() {
  const d = admin.donnees('principal');
  d.tables.places_appels = []; d.tables.places_invitations = [];
  // m0 majeure ; m1 mineure (son numéro + celui de sa maman) ; m2 sans numéro ; m10 homme
  const contacts = {
    m0: { phone: '0701020304', date_naissance: '1999-01-01' },
    m1: { phone: '0705050505', date_naissance: '2013-01-01', parent_nom: 'Madame Mariam Mère', parent_telephone: '0707070707' },
    m2: { phone: null, date_naissance: '2000-01-01' },
    m10: { phone: '0709090909', date_naissance: '1998-01-01' }
  };
  d.rpc.places_preparer = (x) => {
    Object.keys(contacts).forEach((id, i) => {
      if (!d.tables.places_invitations.some((l) => l.model_id === id)) {
        d.tables.places_invitations.push({ id: 'i' + i, projet_id: x.p_projet, model_id: id, sexe: id === 'm10' ? 'homme' : 'femme', jeton: J(String.fromCharCode(97 + i)), statut: 'invite', envoye_le: null, parent_envoye_le: null });
      }
    });
    return d.tables.places_invitations.length;
  };
  d.rpc.convocation_contacts_mannequins = (x) => x.p_ids.filter((id) => contacts[id]).map((id) => {
    const p = d.tables.model_profiles.find((m) => m.id === id);
    return Object.assign({ model_id: id, full_name: p.full_name, category: p.category, contact_email: null }, contacts[id]);
  });
  d.rpc.photos_couverture_mannequins = (x) => (x.ids || []).filter((id) => id !== 'm2').map((id) => ({ model_id: id, url: 'https://www.maitreakessemodelmanagement.com/book-photos/' + id + '/miniatures/1-n800-w.jpg' }));
  return d;
}

async function partieAdmin(b, nom, vp) {
  const n = nom + ' : agence : ';
  const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 700, hasTouch: vp.width < 700 });
  const p = await ctx.newPage(); const journal = [], errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.addInitScript(() => { localStorage.setItem('ma2m_cookies', 'non'); window.confirm = () => true; });
  const d = donneesAdmin();
  await brancher(p, d, journal); await admin.photosLocales(p);
  await admin.seConnecter(p, BASE + 'admin/'); await p.waitForSelector('.accueil-tete', { timeout: 15000 });
  await p.goto(BASE + 'admin/#/site/b2-places'); await p.waitForSelector('[data-action="places-nouveau"]', { timeout: 15000 });
  ok(/Aucun appel à places/.test(await p.textContent('#contenu')), n + 'liste vide au départ');

  // 1. Nouvel appel sur le projet de l'agenda « SHOOTING CACAO »
  await p.click('[data-action="places-nouveau"]'); await p.waitForSelector('form[data-form="places-creer"]');
  ok(await p.isVisible('#pl-titre'), n + '« Nouveau projet » proposé par défaut (champs visibles)');
  await p.selectOption('#pl-projet', 'p2'); await p.waitForTimeout(200);
  ok(await p.isHidden('#pl-titre'), n + 'projet de l’agenda choisi : les champs du nouveau projet se cachent');
  await p.fill('#pl-femmes', '2'); await p.fill('#pl-hommes', '1');
  await p.click('form[data-form="places-creer"] [type=submit]');
  await p.waitForSelector('.pl-grille', { timeout: 10000 }); await p.waitForTimeout(600);
  const appel = ecrits(journal, 'POST', 'places_appels').flat()[0] || {};
  ok(appel.projet_id === 'p2' && appel.places_femmes === 2 && appel.places_hommes === 1 && journal.some(j => j[0] === 'rpc' && j[1] === 'places_preparer'), n + 'appel enregistré (2 femmes, 1 homme) et liens préparés');
  ok(/#\/site\/b2-places\/p2$/.test(p.url()) && /Femmes : 0 \/ 2/.test(await p.textContent('#contenu')) && /Hommes : 0 \/ 1/.test(await p.textContent('#contenu')) && (await p.$$('.pl-case:not(.prise)')).length === 3, n + 'fiche : grille de 3 places libres');

  // 2. Envoi des liens, un par un
  let bouton = p.locator('a[data-places-wa]');
  let href = decodeURIComponent(await bouton.getAttribute('href'));
  ok(/0 message envoyé sur 4/.test(await p.textContent('#contenu')) && /Envoyer le lien suivant : Mademoiselle AYA KOUASSI \(4 restants\)/.test(await bouton.textContent()), n + '4 messages à envoyer (la mineure et son parent comptent deux fois)');
  ok(href.startsWith('https://wa.me/2250701020304?text=') && /Places limitées\* pour le shooting \*« SHOOTING CACAO »\*/.test(href) && /Seulement 2 places pour les femmes/.test(href) && href.includes('/places?c=' + J('a')) && !href.includes('&p=1'), n + 'message WhatsApp : places, lien personnel');
  ok(/Sans numéro WhatsApp \(1\)/.test(await p.textContent('#contenu')) && /GRÂCE YAO/.test(await p.textContent('.pl-sans')), n + 'mannequin sans numéro signalée');
  await p.evaluate(() => { window.open = () => null; });
  const appuyer = async (sel) => { await p.$eval(sel, a => { a.addEventListener('click', e => e.preventDefault(), { once: true }); a.click(); }); await p.waitForTimeout(900); };
  await appuyer('a[data-places-wa]');
  ok(ecrits(journal, 'PATCH', 'places_invitations').some(x => x.envoye_le) && /Mademoiselle MARIAM TRAORÉ \(3 restants\)/.test(await p.textContent('a[data-places-wa]')), n + 'un appui : envoi noté, la personne suivante s’affiche');
  await appuyer('a[data-places-wa]');
  href = decodeURIComponent(await p.getAttribute('a[data-places-wa]', 'href'));
  ok(/parent : Madame Mariam Mère/.test(await p.textContent('a[data-places-wa]')) && href.startsWith('https://wa.me/2250707070707') && href.includes('/places?c=' + J('b') + '&p=1') && /Bonjour Madame Mariam Mère/.test(href) && /Pour inscrire Mademoiselle MARIAM TRAORÉ/.test(href),
    n + 'la maman de la mineure : même lien (avec &p=1), message à son nom');
  await appuyer('a[data-places-wa]'); await appuyer('a[data-places-wa]');
  ok(!(await p.$('a[data-places-wa]')) && /Tous les liens ont été envoyés/.test(await p.textContent('#contenu')) && /4 messages envoyés sur 4/.test(await p.textContent('#contenu')), n + 'tous les liens envoyés');

  // 3. Des places sont prises, une mannequin se désiste
  const inv = (id) => d.tables.places_invitations.find(l => l.model_id === id);
  Object.assign(inv('m0'), { statut: 'pris', pris_par: 'mannequin', pris_le: new Date().toISOString() });
  Object.assign(inv('m10'), { statut: 'pris', pris_par: 'mannequin', pris_le: new Date().toISOString() });
  Object.assign(inv('m1'), { statut: 'desiste', pris_par: 'parent', pris_le: new Date().toISOString(), desiste_le: new Date().toISOString() });
  await p.click('[data-action="places-actualiser"]'); await p.waitForTimeout(1200);
  if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + '/places-admin-' + vp.width + '.png', fullPage: true });
  const visages = await p.$$eval('.pl-case.prise a', as => as.map(a => a.getAttribute('href') + '|' + !!a.querySelector('img')));
  ok(/Femmes : 1 \/ 2/.test(await p.textContent('#contenu')) && /Hommes : 1 \/ 1/.test(await p.textContent('#contenu')) && visages.join() === '#/site/b2-mannequins-publies/m0|true,#/site/b2-mannequins-publies/m10|true',
    n + 'grille : les visages des sélectionnés, cliquables vers leur fiche (' + visages.join() + ')');
  ok(/Sélectionnées \(2\)/.test(await p.textContent('#contenu')) && /Désistements \(1\)/.test(await p.textContent('#contenu')), n + 'listes des sélectionnées et des désistements');
  await p.click('[data-action="places-libre"]'); await p.waitForTimeout(1000);
  href = decodeURIComponent(await p.getAttribute('a[data-places-libre]', 'href'));
  ok(/Une place vient de se libérer/.test(href) && /Prévenir la suivante/.test(await p.textContent('a[data-places-libre]')) && !/AYA KOUASSI/.test(await p.textContent('a[data-places-libre]')), n + '« Annoncer une place libre » : seulement celles qui n’ont pas de place');
  const avant = await p.textContent('a[data-places-libre]');
  await appuyer('a[data-places-libre]');
  const apres = await p.$('a[data-places-libre]') ? await p.textContent('a[data-places-libre]') : 'fini';
  ok(apres !== avant, n + 'annonce : une personne par appui (' + apres.replace(/\s+/g, ' ') + ')');
  await p.click('[data-action="places-libre-fin"]'); await p.waitForTimeout(800);
  ok(!(await p.$('a[data-places-libre]')) && await p.isVisible('[data-action="places-libre"]'), n + '« Terminer l’annonce »');

  // 4. Nombre de places trop petit refusé ; fermer l'appel
  await p.click('[data-action="places-modifier"]'); await p.fill('#pl-hommes', '0'); await p.click('form[data-form="places-nombre"] [type=submit]'); await p.waitForTimeout(500);
  ok(/ne peut pas être plus petit/.test(await p.textContent('body')) && !ecrits(journal, 'PATCH', 'places_appels').length, n + 'moins de places que de sélectionnés : refusé');
  await p.click('[data-action="fermer-fenetre"]');
  await p.click('[data-action="places-ouvrir"]'); await p.waitForTimeout(900);
  ok(ecrits(journal, 'PATCH', 'places_appels').some(x => x.ouvert === false) && /Fermé/.test(await p.textContent('#contenu')) && !(await p.$('a[data-places-wa]')), n + 'appel fermé');
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), n + 'rien ne dépasse de l’écran');
  // 5. Convoquer les sélectionnées → page Convocations
  await p.click('[data-action="places-convoquer"]'); await p.waitForTimeout(1500);
  ok(/#\/site\/b2-convocations$/.test(p.url()), n + '« Convoquer les sélectionnées » ouvre les Convocations');
  // 6. Liste des appels
  await p.goto(BASE + 'admin/#/site/b2-places'); await p.waitForSelector('.projet-carte', { timeout: 10000 }); await p.waitForTimeout(600);
  ok(/SHOOTING CACAO/.test(await p.textContent('.projet-carte')) && (await p.$$('.projet-carte .pl-case.prise img')).length === 2, n + 'liste : l’appel avec ses visages');
  ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
  await ctx.close();
}

async function partiePublique(b, nom, vp) {
  const n = nom + ' : page publique : ';
  const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 700, hasTouch: vp.width < 700 });
  const p = await ctx.newPage(); const journal = [], errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  await p.addInitScript(() => { window.confirm = () => true; });
  const etat = { statut: 'invite', pris_par: null, pris: [{ sexe: 'femme', moi: false, initiales: 'FB', photo: null }], places_femmes: 2, reponse: 'pris' };
  const lire = () => ({ titre: 'AFRICA IN RHYTHM', type: 'defile', date_debut: '2030-11-15', heure_evenement: '19:00', lieu: 'Hôtel Ivoire', ville: 'Abidjan',
    nom: 'AWA KONÉ', civilite: 'Mademoiselle', sexe: 'femme', statut: etat.statut, pris_par: etat.pris_par, ouvert: true, passe: false,
    places_femmes: etat.places_femmes, places_hommes: 1, pris: etat.pris });
  await brancher(p, { tables: {}, rpc: {
    places_lire: (x) => x.p_jeton === J('a') ? lire() : null,
    places_prendre: (x) => {
      if (etat.reponse === 'pris') { etat.statut = 'pris'; etat.pris_par = x.p_parent ? 'parent' : 'mannequin'; etat.pris = etat.pris.concat({ sexe: 'femme', moi: true, initiales: 'AK', photo: null }); }
      else etat.pris = etat.pris.concat({ sexe: 'femme', moi: false, initiales: 'ZZ', photo: null });
      return etat.reponse;
    },
    places_rendre: () => { etat.statut = 'desiste'; etat.pris = etat.pris.filter(x => !x.moi); return 'desiste'; } } }, journal);
  await p.goto(BASE + 'places.html?c=' + J('a')); await p.waitForTimeout(1200);
  ok(/AFRICA IN RHYTHM/.test(await p.textContent('#pl-titre')) && /Mademoiselle AWA KONÉ/.test(await p.textContent('#pl-details')) && /19h00/.test(await p.textContent('#pl-details')), n + 'le projet et le nom');
  ok(/Il reste 1 place pour les femmes/.test(await p.textContent('#pl-etat')) && await p.isVisible('#pl-prendre') && await p.isHidden('#pl-rendre'), n + 'il reste 1 place : bouton « Je prends ma place »');
  ok((await p.$$('#pl-grilles .pl-case')).length === 3 && (await p.$$('#pl-grilles .pl-case.prise')).length === 1, n + 'grille : 2 places femmes + 1 homme, une déjà prise');
  await p.click('#pl-prendre'); await p.waitForTimeout(900);
  const prise = journal.find(j => j[0] === 'rpc' && j[1] === 'places_prendre');
  ok(prise && JSON.parse(prise[2]).p_parent === false && /Bravo, vous êtes sélectionnée/.test(await p.textContent('#pl-etat')) && await p.$eval('#pl-etat', e => e.classList.contains('bravo')), n + '« Bravo, vous êtes sélectionnée ! » en vert');
  ok(await p.isHidden('#pl-prendre') && await p.isVisible('#pl-rendre') && (await p.$$('#pl-grilles .pl-case.moi')).length === 1, n + 'sa place est marquée dans la grille, « Me désister » proposé');
  const couleurs = await p.$eval('#pl-etat', e => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]);
  ok(couleurs[1] === 'rgb(21, 122, 67)' && couleurs[0] === 'rgb(255, 255, 255)', n + 'vert foncé, texte blanc lisible');
  if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + '/places-bravo-' + vp.width + '.png', fullPage: true });
  // le parent ouvre le même lien
  await p.goto(BASE + 'places.html?c=' + J('a') + '&p=1'); await p.waitForTimeout(1000);
  ok(/Votre fille a déjà pris sa place/.test(await p.textContent('#pl-etat')) && /parent de AWA KONÉ/.test(await p.textContent('#pl-details')), n + 'le parent : « Votre fille a déjà pris sa place »');
  // désistement
  await p.click('#pl-rendre'); await p.waitForTimeout(900);
  ok(journal.some(j => j[0] === 'rpc' && j[1] === 'places_rendre') && /la place est libérée/.test(await p.textContent('#pl-etat')), n + 'désistement : la place est libérée');
  // quelqu'un a été plus rapide
  etat.reponse = 'complet';
  await p.goto(BASE + 'places.html?c=' + J('a')); await p.waitForTimeout(1000);
  await p.click('#pl-prendre'); await p.waitForTimeout(900);
  ok(/Oups… plus de place disponible/.test(await p.textContent('#pl-etat')) && /prochain projet/.test(await p.textContent('#pl-etat')) && await p.isHidden('#pl-prendre'), n + '« Oups… plus de place disponible. Rendez-vous au prochain projet ! »');
  if (process.env.CAPTURES) await p.screenshot({ path: process.env.CAPTURES + '/places-oups-' + vp.width + '.png', fullPage: true });
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), n + 'rien ne dépasse');
  await p.goto(BASE + 'places.html?c=' + J('z')); await p.waitForTimeout(900);
  ok(/pas valable/.test(await p.textContent('#pl-details')) && await p.isHidden('#pl-boutons'), n + 'lien inconnu : message clair, pas de bouton');
  ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
  await ctx.close();
}

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [nom, vp] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 900 }]]) {
    await partieAdmin(b, nom, vp);
    await partiePublique(b, nom, vp.width < 700 ? { width: 375, height: 667 } : vp);
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.');
  process.exit(ko ? 1 : 0);
})();
