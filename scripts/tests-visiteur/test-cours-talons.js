// Cours de talons (Atelier Talons & Élégance, 08/11/2026) — comme une visiteuse, téléphone et ordinateur, FR et EN.
// Base, serveur, Cloudflare, Google Drive et EmailJS SIMULÉS : rien n'est écrit pour de vrai.
//  1. serveur (api/portail.js) : la table cours_talons passe par l'anti-robots ; SQL pas encore collé → réponse
//     « pas prêt » (la page propose alors WhatsApp) ;
//  2. page : menu « Cours de talons · Ouvert à toutes », avertissement « pas pour intégrer l'agence », vidéo,
//     4 étapes (formule et total par séance, mineure → parent obligatoire, 2 à 5 photos + vidéo de
//     3 minutes au plus, envoi au clic avec une jauge par photo, Wave ou plus tard),
//     inscription envoyée par le serveur avec les liens Drive ; sans débordement sur téléphone.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PORT = String(9880 + Math.floor(Math.random() * 30));
const MEDIAS = chemin.resolve(__dirname, 'medias');

async function serveur() {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-essai'; process.env.TURNSTILE_SECRET_KEY = 'secret-essai';
  const rpcs = []; let pasInstalle = false;
  global.fetch = async (url, o = {}) => {
    const u = String(url);
    const json = (x, s = 200) => ({ ok: s < 300, status: s, json: async () => x, text: async () => JSON.stringify(x) });
    if (u.includes('siteverify')) return json({ success: true });
    if (u.includes('/rpc/formulaire_public_enregistrer')) { rpcs.push(JSON.parse(o.body)); return pasInstalle ? json({ message: 'Formulaire inconnu.' }, 400) : json('id-1'); }
    return json({});
  };
  const portail = require('../../api/portail.js');
  const appeler = async (corps) => {
    let statut = 0, rep = null;
    const res = { status(s) { statut = s; return this; }, json(c) { rep = c; return this; }, setHeader() {} };
    await portail({ method: 'POST', headers: { 'x-forwarded-for': '41.2.3.4' }, body: Object.assign({ action: 'formulaire' }, corps) }, res);
    return { statut, rep };
  };
  const ligne = { formule: 'groupe', nom: 'Awa', telephone: '+2250700000000', decision: 'plus_tard' };
  let r = await appeler({ table: 'cours_talons', ligne, jeton: 'j' });
  ok(r.statut === 200 && rpcs.length === 1 && rpcs[0].p_table === 'cours_talons', 'serveur : une inscription aux cours de talons passe par l’anti-robots puis la base');
  pasInstalle = true; r = await appeler({ table: 'cours_talons', ligne, jeton: 'j' });
  ok(r.statut === 503 && r.rep.pasPret === true, 'serveur : SQL des cours de talons pas encore collé → « pas prêt » (la page propose WhatsApp)');
}

async function navigateur() {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const cas = [['cours-talons.html', { width: 390, height: 844 }, false], ['en/cours-talons.html', { width: 1280, height: 900 }, false], ['cours-talons.html', { width: 1280, height: 900 }, true], ['cours-talons.html', { width: 390, height: 844 }, 'coupure'], ['cours-talons.html', { width: 820, height: 1180 }, false]];  // (tablette : bug du 08/11/2026)
  for (const [page, ecran, pasPret] of cas) {
    const en = page.startsWith('en/');
    const n = page + ' ' + ecran.width + 'px' + (pasPret === 'coupure' ? ' (connexion coupée au 1er envoi)' : pasPret ? ' (SQL pas encore collé)' : '') + ' : ';
    let essais = 0;
    const p = await (await b.newContext({ viewport: ecran })).newPage(); const errs = [], journal = [], drive = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ } });
    // (14/11/2026) créneaux libres des cours privés : du lundi au samedi, 10 h à 18 h, sauf le 1er mardi de 10 h à 16 h
    // (déjà pris) ; page « SQL pas encore collé » : la fonction n'existe pas → « dates à convenir »
    let creneauRetire = null;   // (le créneau « pris entre-temps » n'est plus libre à la relecture)
    const libresSimules = (c) => { const l = []; let mardis = 0; const d0 = Date.parse(c.p_du + 'T00:00:00Z');
      for (let k = 0; k < c.p_jours; k++) { const d = new Date(d0 + k * 86400000); if (d.getUTCDay() === 0) continue; if (d.getUTCDay() === 2) mardis++;
        for (let h = 10; h <= 18; h++) if (!(d.getUTCDay() === 2 && mardis === 1 && h <= 16) && d.getTime() + h * 3600000 !== creneauRetire) l.push(new Date(d.getTime() + h * 3600000).toISOString().replace('.000Z', '+00:00')); }
      return l; };
    let premierEnvoiCreneau = pasPret === false && ecran.width === 820;   // (tablette : le 1er envoi trouve un créneau pris entre-temps)
    await brancher(p, { tables: {}, rpc: { moyens_paiement_publics: [{ code: 'wave', nom: 'Wave' }, { code: 'orange_money', nom: 'Orange Money', numero: '07 11 22 33 44' }],
      cours_talons_creneaux_libres: pasPret === true ? { erreur: 'Could not find the function public.cours_talons_creneaux_libres' } : libresSimules },
      formulaire: premierEnvoiCreneau ? (corps) => (premierEnvoiCreneau ? (premierEnvoiCreneau = false, creneauRetire = Date.parse(corps.ligne.creneaux[0]), { statut: 409, error: 'Un de vos créneaux n’est plus disponible.', creneauPris: true }) : null) : pasPret === 'coupure' ? () => (++essais === 1 ? { statut: 500, error: 'Envoi impossible pour le moment, réessayez.' } : null)
      : pasPret ? () => ({ statut: 503, error: 'Inscriptions en ligne bientôt ouvertes.', pasPret: true }) : null }, journal);
    // Google Drive simulé (photos, puis vidéo en morceaux)
    await p.route(/script\.google\.com/, (route) => {
      const c = JSON.parse(route.request().postData() || '{}'); drive.push(c.action || 'photos');
      const rep = c.action === 'video_debut' ? { ok: true, session: 's1', dossier: 'd1' } : c.action === 'video_morceau' ? { ok: true, video: 'https://drive.google.com/video-marche' }
        : { ok: true, liens: (c.photos || []).map((x, i) => 'https://drive.google.com/photo-' + i), dossier: 'd1' };
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rep) });
    });
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1300);

    // menu et haut de page
    const menu = await p.textContent('#menuOverlay');
    ok(menu.includes(en ? 'Heel Classes' : 'Cours de talons') && menu.includes(en ? 'Open to all' : 'Ouvert à toutes'), n + 'menu : « ' + (en ? 'Heel Classes · Open to all' : 'Cours de talons · Ouvert à toutes') + ' »');
    const avert = await p.textContent('.ct-avertissement');
    ok(/intégrer l'agence|member of the agency/i.test(avert) && await p.locator('.ct-avertissement a[href="integrer-agence.html"]').count() === 1, n + 'avertissement « pas pour intégrer l’agence », avec le lien vers « Intégrer l’agence »');
    ok(await p.locator('.video-pleine video source[src*="assets/cours-talons/atelier-talons-elegance.mp4"]').count() === 1, n + 'vidéo de présentation sur la page');
    // (22/11/2026) page en écrans : les formules sont sur deux écrans (deux sections .ct-formules)
    const prix = (await p.$$eval('.ct-formules', (l) => l.map((x) => x.textContent))).join(' ');
    ok(prix.includes('30 000') && prix.includes('25 000') && /le mois : 4 dimanches|a month: 4 Sundays/.test(prix) && /1 à 12 mois|1 to 12 months/.test(prix) && /la séance|per session/.test(prix), n + 'prix : groupe 30 000 le mois (4 dimanches, 1 à 12 mois), privé à la séance');
    // (14/11/2026) le programme du groupe, mois après mois (validé par la propriétaire)
    const prog = await p.$$eval('.lx-prog-section .lx-prog-mois h3', (l) => l.map((x) => x.textContent));
    ok(prog.length === 7 && prog[0] === (en ? 'The basics' : 'Les bases') && prog[5] === (en ? 'Pageants' : 'Miss et concours') && prog[6] === (en ? 'Fine-tuning' : 'Perfectionnement'), n + 'programme : 6 mois puis le perfectionnement (' + prog.join(', ') + ')');
    ok(await p.locator('.ct-carte a[href="#programme"]').count() === 1, n + 'la carte du groupe mène au programme');

    // (22/11/2026) page en écrans (js/pages-ecrans.js) : on avance avec la flèche jusqu'au formulaire, comme une élève
    const refus = p.locator('#bandeau-cookies button', { hasText: /Refuser|Decline|Refuse/ }); if (await refus.count() && await refus.first().isVisible()) await refus.first().click();
    for (let i = 0; i < 15 && await p.locator('.ecrans-suivant').count() && !(await p.isVisible('#form-talons')); i++) { await p.click('.ecrans-suivant'); await p.waitForTimeout(300); }
    // étape 1
    await p.click('#ct-suivant');
    ok(/formule|option/i.test(await p.textContent('#ct-msg')), n + 'étape 1 : sans formule, un message demande de choisir');
    // (14/11/2026) groupe sur plusieurs mois : durée, puis paiement d'un coup ou mois par mois
    await p.click('label.ct-choix:has(input[value="groupe"])');
    // (14/11/2026) parcours, en groupe comme en privé : d'abord « Je débute » / « J'ai déjà la base »
    ok(await p.isVisible('#ct-bloc-parcours') && await p.isHidden('#ct-bloc-groupe'), n + 'groupe : on demande d’abord « Je débute » ou « J’ai déjà la base »');
    await p.click('#ct-suivant');
    ok(/débutez|beginner/.test(await p.textContent('#ct-msg')), n + 'sans parcours : un message demande de choisir');
    await p.click('label.ct-parcours-choix:has(input[value="debut"])');
    ok(await p.isVisible('#ct-mois') && await p.isHidden('#ct-bloc-paiement-mois') && (await p.textContent('#ct-total')).includes('30 000'), n + 'groupe : choix de la durée (1 mois par défaut, 30 000)');
    await p.selectOption('#ct-mois', '3');
    ok(/(Mois|Month) 1\s*(Les bases|The basics)\s*(Mois|Month) 2\s*(L’assurance|Confidence)\s*(Mois|Month) 3\s*(La prestance|Poise)/.test(await p.textContent('#ct-programme-choisi')), n + 'je débute, 3 mois : « Votre programme » = mois 1, 2, 3 dans l’ordre');
    ok(await p.isVisible('#ct-bloc-paiement-mois') && /90 000/.test((await p.textContent('#ct-total')).replace(/[\u202f\u00a0]/g, ' ')) && /12 (dimanches|Sundays)/.test(await p.textContent('#ct-total')), n + 'groupe 3 mois, tout en une fois : 90 000 pour 12 dimanches');
    await p.click('label.ct-pastille:has(input[name="paiement"][value="mensuel"])');
    ok(/(À payer maintenant|To pay now) : ?30 000|To pay now: 30 000/.test((await p.textContent('#ct-total')).replace(/[\u202f\u00a0]/g, ' ')), n + 'groupe 3 mois, mois par mois : 30 000 maintenant, puis chaque mois');
    // j'ai déjà la base : elle coche ses thèmes, 1 ou 2 mois chacun
    await p.click('label.ct-parcours-choix:has(input[value="base"])');
    ok(await p.isHidden('#ct-champ-mois') && await p.locator('#ct-themes .ct-theme').count() === 6 && !(await p.textContent('#ct-themes')).match(/asseoir|escalier|parole|sitting|stairs|speaking/i), n + 'j’ai la base : 6 thèmes à cocher (ni s’asseoir, ni escaliers, ni prise de parole)');
    await p.click('#ct-suivant');
    ok(/thème|theme/.test(await p.textContent('#ct-msg')), n + 'rien de coché : un message demande au moins un thème');
    await p.check('#ct-theme-3'); await p.selectOption('#ct-duree-3', '2'); await p.check('#ct-theme-4');
    ok(/3 (mois|months) en tout|3 months in all/.test(await p.textContent('#ct-total')) && /(La prestance|Poise) \((approfondissement|going further)\)/.test(await p.textContent('#ct-programme-choisi')), n + 'La prestance 2 mois + Le podium : 3 mois (payés mois par mois), approfondissement au 2e mois');
    await p.click('label.ct-choix:has(input[value="prive_salle"])');
    ok(await p.isHidden('#ct-bloc-groupe') && await p.isHidden('#ct-champ-nb') && /300 000/.test((await p.textContent('#ct-total')).replace(/[\u202f\u00a0]/g, ' ')) && /(Séances|Sessions) 1–4/.test(await p.textContent('#ct-programme-choisi')), n + 'privé + j’ai la base : 3 mois de thèmes = 12 séances (300 000), séances 1–4…');
    await p.click('label.ct-parcours-choix:has(input[value="debut"])');
    ok(await p.isVisible('#ct-champ-nb'), n + 'privé + je débute : le nombre de séances revient');
    ok(/Touchez|Tap/.test(await p.textContent('.ct-etape[data-etape="1"] .ct-consigne')) && await p.evaluate(() => getComputedStyle(document.querySelector('input[value="prive_salle"] + span'), '::after').content.includes('✓')), n + 'consigne « Touchez la formule », le bloc choisi porte une coche');
    await p.selectOption('#ct-nb', '10');
    ok((await p.textContent('#ct-total')).includes('250 000'), n + 'privé en salle, 10 séances : total 250 000 FCFA');
    // (14/11/2026) cours privés : créneaux libres seulement, ou « dates à convenir ensemble »
    if (pasPret === true) {
      await p.waitForTimeout(500);
      if (process.env.DEBUG_CT) console.log(await p.evaluate(() => ['ct-bloc-facons', 'ct-facon-maintenant', 'ct-facon-apres', 'ct-bloc-creneaux', 'ct-dispo'].map((i) => i + ':' + !!document.getElementById(i).offsetParent).join(' ') + ' conv:' + document.querySelector('input[name="choix_creneaux"][value="convenir"]').checked));
      ok(await p.isVisible('#ct-bloc-facons') && await p.isHidden('#ct-facon-maintenant') && await p.isHidden('#ct-facon-apres') && await p.isHidden('#ct-bloc-creneaux') && await p.isChecked('input[name="choix_creneaux"][value="convenir"]') && await p.isVisible('#ct-dispo'), n + 'créneaux pas encore installés : « dates à convenir », le champ des disponibilités');
      await p.fill('#ct-dispo', 'samedi matin');
    } else {
      // (15/11/2026, maquette v2) trois façons : maintenant, après le paiement, à convenir
      await p.waitForTimeout(500);
      ok(await p.isVisible('#ct-facon-maintenant') && await p.isVisible('#ct-facon-apres') && await p.isVisible('#ct-facon-convenir') && await p.isHidden('#ct-bloc-creneaux') && await p.isHidden('#ct-dispo'), n + 'cours privés : trois façons de choisir ses créneaux');
      await p.click('#ct-suivant');
      ok(/quand vous choisirez|when you will choose/.test(await p.textContent('#ct-msg')), n + 'sans façon choisie : on reste à l’étape 1 avec un message');
    }
    if (pasPret !== true && en) {
      await p.click('#ct-facon-apres');
      ok(await p.isHidden('#ct-bloc-creneaux') && await p.isHidden('#ct-dispo'), n + '« je choisirai après mon paiement » : rien à choisir maintenant');
    } else if (pasPret !== true) {
      await p.click('#ct-facon-maintenant');
      await p.waitForSelector('#ct-jours button', { timeout: 5000 }).catch(() => {});
      ok(await p.isVisible('#ct-bloc-creneaux') && await p.isHidden('#ct-dispo') && await p.locator('#ct-jours button').count() === 36, n + 'créneaux : 6 semaines du lundi au samedi (36 jours), pas de champ libre');
      ok(!(await p.$$eval('#ct-jours small', (l) => l.map((x) => x.textContent.toLowerCase()))).some((j) => /^(dim|sun)/.test(j)), n + 'jamais le dimanche (réservé au groupe)');
      await p.click('#ct-suivant');
      ok(/créneaux|time slots/.test(await p.textContent('#ct-msg')) && await p.isVisible('#ct-heures'), n + 'sans créneau choisi : on reste à l’étape 1 avec un message');
      // le 1er mardi : 10 h à 16 h barrés, 17 h et 18 h libres
      const mardi = await p.$eval('#ct-jours button', () => { const b = Array.from(document.querySelectorAll('#ct-jours button')).find((x) => /^(mar|tue)/i.test(x.querySelector('small').textContent)); return b.dataset.jour; });
      await p.click('#ct-jours [data-jour="' + mardi + '"]');
      const etats = await p.$$eval('#ct-heures button', (l) => l.map((b) => (b.disabled ? 'x' : 'o')).join(''));
      ok(etats === 'xxxxxxxoo', n + 'heures déjà prises barrées et inactives (' + etats + ')');
      // un jeudi à 14 h, « même jour, même heure chaque semaine » : les 10 séances d'un coup
      const jeudi = await p.$eval('#ct-jours', () => Array.from(document.querySelectorAll('#ct-jours button')).find((x) => /^(jeu|thu)/i.test(x.querySelector('small').textContent)).dataset.jour);
      await p.click('#ct-jours [data-jour="' + jeudi + '"]');
      await p.click('#ct-heures [data-heure="' + jeudi + 'T14:00:00.000Z"]');
      const lignes = await p.$$eval('#ct-choisis li', (l) => l.map((x) => x.textContent));
      ok(lignes.length === 10 && lignes.every((x) => /(Jeudi|Thursday)/.test(x) && /14 h – 16 h|2 pm – 4 pm/.test(x)), n + '« chaque semaine » : 10 jeudis de 14 h à 16 h');
      ok(/(Vos 10 séances|Your 10 sessions)$/.test((await p.textContent('#ct-choisis-titre')).trim()) && /48/.test(await p.textContent('.ct-garde')), n + '« Vos 10 séances », gardées 48 h');
      await p.selectOption('#ct-nb', '12');
      ok(await p.locator('#ct-choisis li').count() === 12 && (await p.textContent('#ct-total')).includes('300 000'), n + '12 séances au lieu de 10 : les 2 jeudis suivants sont ajoutés tout seuls');
      await p.selectOption('#ct-nb', '10');
      ok(await p.locator('#ct-choisis li').count() === 10, n + 'retour à 10 séances : les 2 dernières sont retirées');
      if (process.env.CAPTURES) await p.locator('#ct-bloc-prive').screenshot({ path: process.env.CAPTURES + '/creneaux-' + ecran.width + (en ? '-en' : '') + '.png' });
      // 1 h 30 de pause : le même jeudi, 11 h à 17 h deviennent impossibles, 10 h et 18 h restent
      const etatsJeudi = await p.$$eval('#ct-heures button', (l) => l.map((b) => (b.classList.contains('on') ? 'v' : b.disabled ? 'x' : 'o')).join(''));
      ok(etatsJeudi === 'oxxxvxxxo', n + 'autour de sa séance de 14 h : 1 h 30 de pause respectée (' + etatsJeudi + ')');
      // retirer une séance, puis la remplacer à la main (sans « chaque semaine »)
      await p.click('#ct-choisis li:last-child [data-retirer]');
      ok(await p.locator('#ct-choisis li').count() === 9 && /1 (à choisir|still to choose)/.test(await p.textContent('#ct-choisis-titre')), n + 'une séance retirée : « encore 1 à choisir »');
      await p.uncheck('#ct-repeter');
      const samedi = await p.$eval('#ct-jours', () => Array.from(document.querySelectorAll('#ct-jours button')).find((x) => /^(sam|sat)/i.test(x.querySelector('small').textContent)).dataset.jour);
      await p.click('#ct-jours [data-jour="' + samedi + '"]'); await p.click('#ct-heures [data-heure="' + samedi + 'T10:00:00.000Z"]');
      ok(await p.locator('#ct-choisis li').count() === 10, n + 'une séance ajoutée à la main : 10 de nouveau');
      await p.click('#ct-heures [data-heure="' + samedi + 'T18:00:00.000Z"]');
      ok(/déjà choisi|already chosen/.test(await p.textContent('#ct-msg')) && await p.locator('#ct-choisis li').count() === 10, n + 'pas plus de créneaux que de séances');
      // « dates à convenir » puis retour aux créneaux
      await p.click('#ct-facon-convenir');
      ok(await p.isHidden('#ct-bloc-creneaux') && await p.isVisible('#ct-dispo'), n + '« dates à convenir ensemble » : les créneaux disparaissent, le champ des disponibilités apparaît');
      await p.click('#ct-facon-maintenant');
      ok(await p.locator('#ct-choisis li').count() === 10, n + 'retour aux créneaux : les choix sont gardés');
    }
    await p.click('#ct-suivant');
    const debEtape2 = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(debEtape2 <= 1, n + 'passage à l’étape 2 : la page ne devient pas plus large que l’écran (' + debEtape2 + ' px)');
    // étape 2 : civilité obligatoire (14/11/2026), puis mineure → parent obligatoire
    await p.click('#ct-suivant');
    ok(/Madame ou Mademoiselle|Mrs or Miss/.test(await p.textContent('#ct-msg')), n + 'sans civilité : on demande « Madame ou Mademoiselle »');
    await p.click('label.ct-pastille:has(input[name="civilite"][value="mademoiselle"])');
    await p.fill('#ct-nom', 'Kouassi Marie'); await p.fill('#ct-telephone', '07 01 02 03 04'); await p.selectOption('#ct-majorite', 'mineure'); await p.dispatchEvent('#ct-majorite', 'change');
    ok(await p.isVisible('#ct-bloc-parent'), n + 'moins de 18 ans : le bloc du parent apparaît');
    await p.click('#ct-suivant');
    ok(await p.isVisible('#ct-nom') && /parent/i.test(await p.textContent('#ct-msg')), n + 'mineure sans parent : on reste à l’étape 2 avec un message');
    await p.fill('#ct-parent-nom', 'Mme Kouassi'); await p.fill('#ct-parent-telephone', '05 01 02 03 04');
    await p.selectOption('#ct-objectif', 'miss'); await p.fill('#ct-concours', 'Miss Côte d’Ivoire');
    await p.click('label.ct-pastille:has(input[value="un_peu"])');
    await p.click('#ct-suivant');
    // étape 3 : photos et vidéo
    await p.click('#ct-suivant');
    ok(/photo/i.test(await p.textContent('#ct-msg')), n + 'étape 3 : sans photos, un message les demande');
    await p.setInputFiles('#ct-photos', [1, 2, 3, 4, 0, 1].map((i) => chemin.join(MEDIAS, 'photo' + i + '.jpg')));
    // (12/11/2026) les photos sont lues et allégées dès le choix : on attend la fin de la préparation
    await p.waitForFunction(() => !/Préparation|Preparing/.test(document.getElementById('ct-photos-info').textContent) && document.querySelectorAll('#ct-photos-apercu img').length, null, { timeout: 15000 }).catch(() => {});
    ok(await p.locator('#ct-photos-apercu img').count() === 5 && /sur 5|out of 5/.test(await p.textContent('#ct-photos-info')), n + '6 photos choisies : 5 gardées au maximum');
    for (const k of [5, 4, 3]) await p.click('#ct-photos-apercu figure:nth-child(' + k + ') button');
    ok(/3 minutes/.test(await p.textContent('.ct-etape[data-etape="3"]')), n + 'vidéo : « 3 minutes maximum » annoncé');
    await p.setInputFiles('#ct-video', chemin.join(MEDIAS, 'video.mp4'));
    await p.waitForFunction(() => /✓/.test(document.getElementById('ct-video-info').textContent), null, { timeout: 30000 }).catch(() => {});
    ok(await p.locator('#ct-photos-apercu img').count() === 2 && /✓/.test(await p.textContent('#ct-video-info')), n + '2 photos en aperçu, vidéo prête');
    await p.click('#ct-suivant');
    await p.waitForTimeout(800);
    ok(!drive.length && !(await p.isVisible('#ct-jauge-video')), n + 'étape 4 : rien n’est envoyé avant le clic sur « Envoyer »');
    // étape 4 : Wave maintenant
    await p.click('label.ct-choix:has(input[value="maintenant"])');
    ok((await p.getAttribute('#ct-lien-wave', 'href')).endsWith('?amount=250000'), n + 'lien Wave avec le bon montant (250 000)');
    // (13/11/2026) moyens en tuiles : Orange Money montre le numéro de l'agence et le montant, puis retour à Wave
    await p.click('#ct-moyens [data-moyen="orange_money"]'); await p.waitForTimeout(200);
    ok(/250 000 FCFA (par Orange Money au numéro de l’agence|by Orange Money to the agency number)/.test((await p.textContent('#ct-consigne')).replace(/[\u202f\u00a0]/g, ' ')) && !(await p.isVisible('#ct-lien-wave')), n + 'Orange Money en tuile : numéro de l’agence et montant (250 000), lien Wave caché');
    await p.click('#ct-moyens [data-moyen="wave"]'); await p.waitForTimeout(200);
    ok(await p.isVisible('#ct-lien-wave'), n + 'retour à Wave : le lien Wave revient');
    // (page anglaise) inscription envoyée avec Orange Money : le moyen part avec la ligne, noms en anglais
    const parOrange = page.startsWith('en/');
    if (parOrange) { await p.click('#ct-moyens [data-moyen="orange_money"]'); await p.waitForTimeout(200); ok(/Copy/.test(await p.textContent('#ct-consigne')), n + 'page anglaise : consigne en anglais (« Copy »)'); }
    await p.fill('#ct-ref-wave', 'T_ESSAI1');
    await p.click('#ct-envoyer');
    ok(/case|tick/i.test(await p.textContent('#ct-msg')), n + 'sans la case de confidentialité : envoi refusé avec un message');
    await p.check('#ct-consentement');
    await p.click('#ct-envoyer');
    if (ecran.width === 820 && !pasPret) {
      // un créneau pris entre-temps par une autre élève : retour à l'étape 1, photos et vidéo gardées
      await p.waitForFunction(() => /plus disponible|no longer available/.test(document.getElementById('ct-msg').textContent), null, { timeout: 30000 }).catch(() => {});
      ok(/plus disponible/.test(await p.textContent('#ct-msg')) && await p.isVisible('#ct-heures') && await p.locator('#ct-choisis li').count() === 9 && /1 (à choisir|still to choose)/.test(await p.textContent('#ct-choisis-titre')),
        n + 'créneau pris entre-temps : retour au choix des créneaux, il est retiré de sa liste (« encore 1 à choisir »)');
      const pris = new Date(creneauRetire).toISOString(), jourPris = pris.slice(0, 10);
      await p.click('#ct-jours [data-jour="' + jourPris + '"]');
      ok(await p.isDisabled('#ct-heures [data-heure="' + pris + '"]'), n + 'le créneau pris est barré');
      const vendredi = await p.$eval('#ct-jours', () => Array.from(document.querySelectorAll('#ct-jours button')).find((x) => /^(ven|fri)/i.test(x.querySelector('small').textContent)).dataset.jour);
      await p.click('#ct-jours [data-jour="' + vendredi + '"]'); await p.click('#ct-heures [data-heure="' + vendredi + 'T10:00:00.000Z"]');
      ok(await p.locator('#ct-choisis li').count() === 10, n + 'un autre créneau choisi : 10 de nouveau');
      for (let k = 0; k < 3; k++) await p.click('#ct-suivant');
      await p.click('#ct-envoyer');
    }
    if (pasPret === 'coupure') {
      await p.waitForFunction(() => /erreur|error/i.test(document.getElementById('ct-msg').textContent), null, { timeout: 30000 }).catch(() => {});
      ok(/WhatsApp/.test(await p.textContent('#ct-msg')) && await p.isEnabled('#ct-envoyer'), n + '1er envoi refusé : message d’erreur, lien WhatsApp, on peut réessayer');
      await p.click('#ct-envoyer');
    }
    await p.waitForSelector('#ct-merci:not(.u-hidden)', { timeout: 30000 }).catch(() => {});
    if (pasPret === 'coupure') {
      const ids = journal.filter((j) => j[0] === 'ANTI-ROBOT').length;
      const l = JSON.parse((journal.find((j) => j[0] === 'POST' && j[1] === 'cours_talons') || [])[3] || '{}');
      ok(ids === 2 && /^[0-9a-f-]{36}$/.test(l.id || '') && drive.filter((x) => x === 'photos').length === 1 && drive.filter((x) => x === 'video_debut').length === 1,
        n + 'nouvel essai : même identifiant (pas de doublon), photos et vidéo envoyées une seule fois vers Drive');
    }
    const envoi = journal.filter((j) => j[0] === 'POST' && j[1] === 'cours_talons');
    const merci = await p.textContent('#ct-merci');
    if (!pasPret || pasPret === 'coupure') ok(drive.filter((x) => x === 'photos').length === 1 && drive.filter((x) => x === 'video_debut').length === 1, n + 'photos et vidéo envoyées une seule fois vers Drive (pas de second envoi au clic)');
    if (pasPret === 'coupure') { /* déjà vérifié */ } else if (!pasPret) {
      const l = envoi.length ? JSON.parse(envoi[0][3]) : {};
      ok(envoi.length === 1 && journal.some((j) => j[0] === 'ANTI-ROBOT' && j[1] === 'cours_talons'), n + 'inscription envoyée une fois, par le serveur (anti-robots)');
      ok(l.parcours === 'debut' && l.modules === null, n + 'parcours « je débute » envoyé (sans thèmes)');
      ok(l.civilite === 'mademoiselle' && l.nb_mois === 1 && l.paiement === 'tout', n + 'civilité choisie (Mademoiselle) envoyée ; privé : 1 « mois », payé en une fois');
      if (en) ok(l.choix_creneaux === 'apres' && !l.creneaux && /lien personnel|personal link/.test(merci), n + '« après mon paiement » envoyé, sans créneau ; merci : « vous recevrez votre lien personnel »');
      else ok(l.choix_creneaux === 'maintenant' && Array.isArray(l.creneaux) && l.creneaux.length === 10 && l.creneaux.every((c, i) => !i || c > l.creneaux[i - 1]) && /^Créneaux choisis : (jeu|ven)\. /.test(l.disponibilites || ''), n + 'ses 10 créneaux envoyés (dans l’ordre), écrits aussi pour l’agence');
      if (!en) ok(/confirme vos créneaux|confirms your slots/.test(merci), n + 'merci : « elle vous confirme vos créneaux »');
      ok(l.formule === 'prive_salle' && l.nb_seances === 10 && l.decision === 'maintenant' && l.reference_wave === 'T_ESSAI1' && (parOrange ? l.moyen === 'orange_money' : !('moyen' in l)) && l.mineure === true && !('age' in l) && !('quartier' in l) && /^\+225/.test(l.parent_telephone || '') && l.objectif === 'miss' && l.niveau === 'un_peu',
        n + 'contenu : formule, 10 séances, ' + (parOrange ? 'Orange Money' : 'Wave') + ' maintenant (référence), mineure avec le téléphone du parent, objectif, niveau');
      ok(Array.isArray(l.photos) && l.photos.length === 2 && l.video === 'https://drive.google.com/video-marche' && !('statut' in l) && !('montant' in l), n + 'liens Drive des 2 photos et de la vidéo ; ni statut ni montant envoyés (la base décide)');
      ok(/Merci|Thank you/.test(merci) && journal.some((j) => j[0] === 'EMAIL'), n + 'message de remerciement, e-mail de notification à l’agence');
      ok(/bien arrivées|reached the agency/.test(merci) && await p.isVisible('#ct-jauge-video') && /✓/.test(await p.textContent('#ct-jauge-video')), n + 'confirmation : « photos et vidéo bien arrivées », jauges à 100 % visibles');
      const vertes = await p.locator('#ct-jauges-photos .jauge.terminee').count(), videoVerte = await p.locator('#ct-jauge-video.terminee').count();
      ok(vertes === 2 && videoVerte === 1, n + 'une jauge par photo (2) et une pour la vidéo, toutes vertes une fois arrivées');
    } else {
      ok(/WhatsApp/.test(merci) && (await p.getAttribute('#ct-merci a', 'href') || '').startsWith('https://wa.me/2250545656687?text='), n + 'SQL pas encore collé : bouton pour envoyer l’inscription sur WhatsApp');
    }
    const deborde = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(deborde <= 1, n + 'aucun débordement horizontal (' + deborde + ' px)');
    ok(!errs.length, n + 'aucune erreur dans la page ' + errs.join(' | '));
    await p.context().close();
  }
  await b.close();
}

(async () => {
  await serveur();
  await navigateur();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ cours de talons : tout passe');
  process.exit(ko ? 1 : 0);
})();
