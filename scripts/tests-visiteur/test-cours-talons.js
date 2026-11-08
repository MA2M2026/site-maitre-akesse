// Cours de talons (Atelier Talons & Élégance, 08/11/2026) — comme une visiteuse, téléphone et ordinateur, FR et EN.
// Base, serveur, Cloudflare, Google Drive et EmailJS SIMULÉS : rien n'est écrit pour de vrai.
//  1. serveur (api/portail.js) : la table cours_talons passe par l'anti-robots ; SQL pas encore collé → réponse
//     « pas prêt » (la page propose alors WhatsApp) ;
//  2. page : menu « Cours de talons · Ouvert à toutes », avertissement « pas pour intégrer l'agence », vidéo,
//     4 étapes (formule et total par séance, mineure → parent obligatoire, 2-3 photos + vidéo, Wave ou plus tard),
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
  const cas = [['cours-talons.html', { width: 390, height: 844 }, false], ['en/cours-talons.html', { width: 1280, height: 900 }, false], ['cours-talons.html', { width: 1280, height: 900 }, true], ['cours-talons.html', { width: 390, height: 844 }, 'coupure']];
  for (const [page, ecran, pasPret] of cas) {
    const en = page.startsWith('en/');
    const n = page + ' ' + ecran.width + 'px' + (pasPret === 'coupure' ? ' (connexion coupée au 1er envoi)' : pasPret ? ' (SQL pas encore collé)' : '') + ' : ';
    let essais = 0;
    const p = await (await b.newContext({ viewport: ecran })).newPage(); const errs = [], journal = [], drive = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ } });
    await brancher(p, { tables: {}, rpc: {}, formulaire: pasPret === 'coupure' ? () => (++essais === 1 ? { statut: 500, error: 'Envoi impossible pour le moment, réessayez.' } : null)
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
    ok(await p.locator('.ct-video video source[src$="assets/cours-talons/atelier-talons-elegance.mp4"]').count() === 1, n + 'vidéo de présentation sur la page');
    const prix = await p.textContent('.ct-formules');
    ok(prix.includes('30 000') && prix.includes('25 000') && /4 séances|4 sessions/.test(prix) && /la séance|per session/.test(prix), n + 'prix : groupe 30 000 les 4 séances, privé à la séance');

    // étape 1
    await p.click('#ct-suivant');
    ok(/formule|option/i.test(await p.textContent('#ct-msg')), n + 'étape 1 : sans formule, un message demande de choisir');
    await p.click('label.ct-choix:has(input[value="prive_salle"])');
    await p.selectOption('#ct-nb', '10');
    ok((await p.textContent('#ct-total')).includes('250 000'), n + 'privé en salle, 10 séances : total 250 000 FCFA');
    await p.click('#ct-suivant');
    // étape 2 : mineure → parent obligatoire
    await p.fill('#ct-nom', 'Kouassi Marie'); await p.fill('#ct-telephone', '07 01 02 03 04'); await p.fill('#ct-age', '16');
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
    await p.setInputFiles('#ct-photos', [chemin.join(MEDIAS, 'photo1.jpg'), chemin.join(MEDIAS, 'photo2.jpg')]);
    await p.setInputFiles('#ct-video', chemin.join(MEDIAS, 'video.mp4'));
    await p.waitForFunction(() => /✓/.test(document.getElementById('ct-video-info').textContent), null, { timeout: 30000 }).catch(() => {});
    ok(await p.locator('#ct-photos-apercu img').count() === 2 && /✓/.test(await p.textContent('#ct-video-info')), n + '2 photos en aperçu, vidéo prête');
    await p.click('#ct-suivant');
    // étape 4 : Wave maintenant
    await p.click('label.ct-choix:has(input[value="maintenant"])');
    ok((await p.getAttribute('#ct-lien-wave', 'href')).endsWith('?amount=250000'), n + 'lien Wave avec le bon montant (250 000)');
    await p.fill('#ct-ref-wave', 'T_ESSAI1');
    await p.click('#ct-envoyer');
    ok(/case|tick/i.test(await p.textContent('#ct-msg')), n + 'sans la case de confidentialité : envoi refusé avec un message');
    await p.check('#ct-consentement');
    await p.click('#ct-envoyer');
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
    if (pasPret === 'coupure') { /* déjà vérifié */ } else if (!pasPret) {
      const l = envoi.length ? JSON.parse(envoi[0][3]) : {};
      ok(envoi.length === 1 && journal.some((j) => j[0] === 'ANTI-ROBOT' && j[1] === 'cours_talons'), n + 'inscription envoyée une fois, par le serveur (anti-robots)');
      ok(l.formule === 'prive_salle' && l.nb_seances === 10 && l.decision === 'maintenant' && l.reference_wave === 'T_ESSAI1' && l.age === 16 && /^\+225/.test(l.parent_telephone || '') && l.objectif === 'miss' && l.niveau === 'un_peu',
        n + 'contenu : formule, 10 séances, Wave maintenant (référence), mineure avec le téléphone du parent, objectif, niveau');
      ok(Array.isArray(l.photos) && l.photos.length === 2 && l.video === 'https://drive.google.com/video-marche' && !('statut' in l) && !('montant' in l), n + 'liens Drive des 2 photos et de la vidéo ; ni statut ni montant envoyés (la base décide)');
      ok(/Merci|Thank you/.test(merci) && journal.some((j) => j[0] === 'EMAIL'), n + 'message de remerciement, e-mail de notification à l’agence');
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
