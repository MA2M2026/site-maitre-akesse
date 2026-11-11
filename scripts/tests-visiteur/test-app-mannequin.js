// Application MA2M Mannequin (/app/, 25/10/2026), comme une vraie mannequin, sur téléphone et
// ordinateur : l'application installable (manifeste « MA2M Mannequin », icône ; la bande
// « Télécharger l'application » : test-installation.js), la connexion (même serveur protégé que l'Espace mannequin), puis les 5 onglets du
// menu du bas : Accueil (prochain rendez-vous, « Je confirme »), Mes événements (passages du
// défilé, carte d'accès, événements passés, « Je ne pourrai pas venir »), Mon profil, Mes
// paiements, Messages (boîte de réception de l'agence, 3e voie, 26/10/2026 : nouveau message sur
// l'Accueil, marqué lu, photo, fiche, notifications) ; enfin la déconnexion. Base simulée : rien n'est écrit pour de vrai.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const path = require('path');
// règle de sécurité stricte, posée par le serveur comme en ligne (vercel.json : aucun programme écrit dans la page)
const { REGLE_ADMIN } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const { fondsInterdits } = require('./couleurs-autorisees');
require(path.join(__dirname, '../../js/presences-calcul.js')); const P = globalThis.Presences;
const PORT = String(9600 + Math.floor(Math.random() * 90));
const BASE = 'http://127.0.0.1:' + PORT;
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const jour = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const moisDe = (n) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7) + '-01'; };
let srv; process.on('exit', () => srv && srv.kill());
function donnees() {
  const photo = (i) => '/scripts/tests-visiteur/medias/photo' + i + '.jpg';
  // convocations de la mannequin ; « Je confirme » est gardé, comme dans la vraie base
  const evenements = [
    { jeton: 'j'.repeat(36), titre: 'ABIDJAN FASHION WEEK', type: 'defile', date_debut: jour(4), date_fin: jour(5), heure_evenement: null, heure_convocation: '15:00', lieu: 'Sofitel Hôtel Ivoire', ville: 'Abidjan', reponse: null, passe: false, defile: true },
    { jeton: 'k'.repeat(36), titre: 'SHOOTING CACAO', type: 'shooting', date_debut: jour(15), date_fin: null, heure_evenement: '09:00', heure_convocation: '08:30', lieu: 'Studio MA2M', ville: 'Abidjan', reponse: 'confirme', passe: false, defile: false },
    { jeton: 'l'.repeat(36), titre: 'BORDER FORUM', type: 'defile', date_debut: jour(-10), date_fin: null, heure_evenement: null, heure_convocation: null, lieu: 'Parc des Expositions', ville: 'Abidjan', reponse: 'confirme', passe: true, defile: false }];
  return {
    memoriser: true,
    tables: {
      model_profiles: [{ id: 'admin-1', full_name: 'AYA KOUASSI', category: 'femme', published: true, height_cm: 178, chest_cm: 84, waist_cm: 61, hips_cm: 90, city: 'Abidjan',
        niveau_mannequin: 'New Face', years_experience: 0, created_at: '2026-09-01T10:00:00Z' }],
      model_photos: [1, 2, 3].map((i) => ({ id: 'ph' + i, model_id: 'admin-1', url: photo(i), url_miniature: photo(i), principale: i === 1, created_at: '2026-09-0' + i + 'T10:00:00Z' })),
      model_projects: [{ id: 'pr1', model_id: 'admin-1' }],
      casting_projets: [{ nom: 'CASTING CACAO', actif: true, date_casting: jour(20), lieu: 'Studio MA2M', ordre_affichage: 0 }],
      // boîte de réception (supabase-app-messages.sql) : un message non lu de l'agence, un déjà lu
      app_messages: [
        { id: 'msg1', user_id: 'admin-1', sorte: 'casting', titre: '✨ Casting Kouroukan', texte: 'Information casting : Casting Kouroukan\n📅 Samedi\nVeuillez vous préparer.', image: '/scripts/tests-visiteur/medias/photo1.jpg', fiche: 'https://exemple.ci/fiche.pdf', lien: null, cree_le: new Date().toISOString(), lu_le: null },
        { id: 'msg2', user_id: 'admin-1', sorte: 'paiement', titre: '✅ Paiement confirmé : mensualité de septembre', texte: '10 000 FCFA reçus.', image: null, fiche: null, lien: '/app/#paiements', cree_le: '2026-10-01T10:00:00Z', lu_le: '2026-10-01T11:00:00Z' }]
    },
    rpc: {
      app_mes_evenements: () => evenements,
      convocation_repondre: (x) => { const e = evenements.find((y) => y.jeton === x.p_jeton); if (e) e.reponse = x.p_reponse; return !!e; },
      defile_programme: { passages: [{ jour: jour(4), debut: '17:00', salle: 'Salle A', theme: null, moi: true, mannequins: [] }, { jour: jour(4), debut: '17:30', salle: 'Salle B', theme: 'Pathé’O', moi: false, mannequins: [{ nom: 'Madame AWA KONÉ', photo: null, moi: false }] }] },
      mes_mensualites: { inscrit: true, nom: 'AYA KOUASSI', mensualite: 10000, statut: 'actif', mineur: false,
        mois: Array.from({ length: 24 }, (_, i) => ({ mois: moisDe(i - 8), etat: i < 8 ? 'paye' : i === 8 ? 'a_payer' : 'a_venir' })) },
      app_messages_lus: null, app_push_abonner: null,
      mannequin_du_mois_actuelle: { mois: '2026-11-01', nom: 'AYA KOUASSI', compte: 'admin-1', slug: 'aya-kouassi', mot: null },
      mes_bulletins: [{ trimestre: '2026-07-01', notes: { marche: 4, posture: 5, photo: 3 }, appreciation: 'Très bon trimestre' }],
      // cours du dimanche (chantier 14) : le mois dernier, présente à tous sauf le premier (rouge)
      mes_presences: { date_entree: '2025-09-01', annulees: [], presences: P.dimanchesDuMois(P.moisVoisin(P.jourIso(new Date()).slice(0, 7), -1)).slice(1).map((d) => ({ dimanche: d, etat: 'present' })) },
      mes_recus: [{ objet: 'mensualite', mois: moisDe(-1), montant: 10000, mode: 'wave', valide_le: jour(-30) + 'T09:00:00Z', numero: 'REC-2026-00012' }],
      mes_cachets: [{ numero: 'C-0001', montant: 25000, motif: null, prestation: 'Border Forum', paye_le: jour(-8) + 'T10:00:00Z', jeton: 'x' }]
    }
  };
}
// L'ancien espace mannequin du site est démoli (26/10/2026, décision de la propriétaire) : ses
// pages n'existent plus, l'application a les siennes (app/espace-mannequin.html, app/mes-paiements.html,
// app/inscription-mannequin.html) ; les renvois des anciennes adresses vers l'application restent
// jusqu'au 16/11/2026 (liens déjà envoyés aux mannequins), puis seront retirés.
const fs = require('fs');
const RACINE = path.resolve(__dirname, '../..');
const vercel = fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8');
for (const page of ['espace-mannequin.html', 'mes-paiements.html', 'inscription-mannequin.html', 'en/inscription-mannequin.html']) {
  ok(!fs.existsSync(path.join(RACINE, page)), 'ancienne page ' + page + ' : supprimée');
}
// renvois gardés jusqu'au 16/11/2026 pour les liens déjà envoyés aux mannequins : vers l'application seulement
ok((vercel.match(/"source": "\/(espace-mannequin|mes-paiements|inscription-mannequin)[^"]*", "destination": "([^"]*)"/g) || []).every((l) => l.includes('https://mannequin.maitreakessemodelmanagement.com/app/'))
  && !/espace-mannequin-ancien/.test(vercel), 'anciennes adresses : renvoyées vers l’application (temporaire), aucune autre');
for (const page of ['espace-mannequin.html', 'mes-paiements.html', 'inscription-mannequin.html']) ok(fs.existsSync(path.join(RACINE, 'app', page)), 'app/' + page + ' : présente');
(async () => {
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['tablette', { width: 800, height: 1200 }], ['ordinateur', { width: 1280, height: 860 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: ecran.width < 1000, hasTouch: ecran.width < 1000, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    // téléphone : il sait recevoir des notifications (simulées : un vrai abonnement demande les
    // serveurs de Google, absents ici) et ne les a pas encore acceptées
    if (tel) await p.addInitScript(() => {
      window.PushManager = window.PushManager || function () {};
      Object.defineProperty(Notification, 'permission', { get: () => 'default' });
      const reg = { pushManager: { getSubscription: async () => null, subscribe: async () => ({ toJSON: () => ({ endpoint: 'https://push.exemple/aya', keys: { p256dh: 'cle', auth: 'secret' } }) }) } };
      Object.defineProperty(navigator, 'serviceWorker', { value: { register: async () => reg, ready: Promise.resolve(reg), addEventListener: () => {} } });
    });
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED/.test(m.text()) || /Content Security Policy/.test(m.text())) errs.push('console : ' + m.text().slice(0, 160)); });
    p.on('dialog', (d) => d.accept());
    const d = donnees();
    await brancher(p, d, journal);
    await p.route(/127\.0\.0\.1:\d+\/app\/([a-z-]+\.html)?(\?.*)?$/, async (r) => { const rep = await r.fetch(); r.fulfill({ response: rep, headers: Object.assign({}, rep.headers(), { 'content-security-policy': REGLE_ADMIN }) }); });
    const rpc = (nomRpc) => journal.filter((j) => j[0] === 'rpc' && j[1] === nomRpc).map((j) => JSON.parse(j[2] || '{}'));
    // CAPTURES=dossier : images des écrans (téléphone) pour les regarder
    // chaque écran capturé : tous les textes lisibles sur le fond rouge mat (27/10/2026, lisibilite.js)
    const capture = async (nomCapture) => {
      const pales = await lirePageEntiere(p);
      ok(!pales.length, n + nomCapture + ' : textes lisibles' + (pales.length ? ' — trop pâles : ' + pales.slice(0, 6).map((x) => x.element + ' « ' + x.texte + ' » ' + x.contraste).join(' | ') : ''));
      const interdits = await p.evaluate(fondsInterdits);   // gardien des couleurs (28/10/2026)
      ok(!interdits.length, n + nomCapture + ' : seulement des fonds rouges ou blancs' + (interdits.length ? ' — interdits : ' + interdits.slice(0, 6).map((x) => x.element + ' ' + x.couleur).join(' | ') : ''));
      if (process.env.CAPTURES) await p.screenshot({ path: path.join(process.env.CAPTURES, nom + '-' + nomCapture + '.png') });
    };
    const deborde = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

    // 1. Le lien reçu : la connexion tout de suite (l'installation : la bande en bas, test-installation.js)
    await p.goto(BASE + '/app/'); await p.waitForSelector('#ap-form-connexion', { timeout: 15000 });
    const manifeste = await p.evaluate(async () => { const l = document.querySelector('link[rel="manifest"]'); const r = await fetch(l.href); return r.json(); });
    ok(manifeste.name === 'MA2M Mannequin' && manifeste.scope === '/app/' && manifeste.display === 'standalone' && manifeste.icons.some((i) => i.purpose === 'maskable') && manifeste.related_applications.some((x) => x.platform === 'webapp'),
      n + 'application « MA2M Mannequin » installable (sa propre icône, s’ouvre sans barre d’adresse, le téléphone sait si elle est déjà installée)');
    ok((await p.evaluate(async () => (await fetch('/icons/mannequin-512.png')).ok)) && (await p.evaluate(async () => (await fetch('/app/sw.js')).ok)), n + 'icône et service worker de l’application présents');
    ok(!(await p.$('#pastille-installer')) && !(await p.$('.whatsapp-flottant, #whatsapp-flottant, .bouton-whatsapp')), n + 'ni pastille « Installer l’app » du site ni bouton WhatsApp flottant dans l’application');
    // 2. Connexion
    await p.click('#ap-form-connexion button[type=submit]');
    ok(/e-mail et votre mot de passe/.test(await p.textContent('#ap-connexion-msg')), n + 'connexion : champs vides → message, rien n’est envoyé');
    await capture('0b-connexion');
    // « Créer mon compte » et « Mot de passe oublié » : le bon formulaire, dans l'application
    for (const [lien, panneau, quoi] of [['#inscription', '#auth-panneau-inscription', 'Créer mon compte'], ['#mot-de-passe-oublie', '#auth-panneau-mdp-oublie', 'Mot de passe oublié']]) {
      await p.click('a[href="/app/espace-mannequin.html' + lien + '"]'); await p.waitForSelector(panneau, { state: 'visible', timeout: 15000 });
      ok(/\/app\/espace-mannequin\.html/.test(p.url()) && (await p.$('.ap-nav')), n + '« ' + quoi + ' » : son formulaire s’ouvre dans l’application');
      await p.goBack(); await p.waitForSelector('#ap-form-connexion', { timeout: 15000 });
    }
    // « Retenue à un casting ? » : l'inscription avec le code de l'agence, dans l'application
    await p.click('a[href="/app/inscription-mannequin.html"]'); await p.waitForSelector('#inn-code', { state: 'visible', timeout: 15000 });
    ok(/\/app\/inscription-mannequin\.html$/.test(p.url()) && (await p.isVisible('#inn-naissance')) && !(await p.$('.site-header-v2')) && !(await deborde()) && (await p.$$('h1')).length === 1,
      n + '« Retenue à un casting ? » : l’inscription avec le code s’ouvre dans l’application (sans l’en-tête du site, un seul titre)');
    // pas encore de compte : pas de menu (Profil, Paiements… mèneraient à la connexion), un « Retour » vers l'application
    ok(!(await p.$('.ap-nav')) && (await p.getAttribute('.ap-retour', 'href')) === '/app/', n + 'inscription : pas de menu de l’application, « ‹ Retour » vers l’application');
    await capture('0c-inscription');
    await p.click('.ap-retour'); await p.waitForSelector('#ap-form-connexion', { timeout: 15000 });
    await p.fill('#ap-email', 'aya@test.ci'); await p.fill('#ap-mdp', 'motdepasse1');
    await p.click('#ap-form-connexion button[type=submit]'); await p.waitForSelector('.ap-nav', { timeout: 15000 });
    const appel = journal.find((j) => j[0] === 'API' && j[1] === '/api/connexion-protegee');
    ok(appel && JSON.parse(appel[2]).espace === 'mannequin' && JSON.parse(appel[2]).email === 'aya@test.ci', n + 'connexion par le serveur protégé de l’Espace mannequin');
    // l'application fermée puis rouverte : la connexion est gardée (plus besoin de se reconnecter)
    await p.reload(); await p.waitForSelector('.ap-nav', { timeout: 15000 });
    ok(!(await p.$('#ap-form-connexion')) && /Bonjour/.test(await p.textContent('#ap-ecran')), n + 'application rouverte : toujours connectée');
    // 3. Accueil
    const accueil = await p.textContent('#ap-ecran');
    ok(/Bonjour\s*Aya(?!A)/.test(accueil) && /ABIDJAN FASHION WEEK/.test(accueil) && /dans 4 jours/.test(accueil) && /À répondre/.test(accueil) && /Convocation à 15h00/.test(accueil), n + 'Accueil : « Bonjour Aya », prochain rendez-vous (dans 4 jours, convocation à 15h00, à répondre)');
    ok(/Nouveau message de l’agence : ✨ Casting Kouroukan/.test(accueil) && (await p.getAttribute('.ap-nouveau-message', 'href')) === '#alertes', n + 'Accueil : « Nouveau message de l’agence » mène à l’onglet Messages');
    ok((await p.$$('.ap-nav a')).length === 5 && /Accueil.*Événements.*Profil.*Paiements.*Messages/s.test(await p.textContent('.ap-nav')) && /1/.test(await p.textContent('.ap-nav a[href="#evenements"]')), n + 'menu du bas : 5 onglets, « 1 » sur Événements (à répondre)');
    ok(/Moi.*Ma carte.*Compcard.*Mon CV.*Messages/s.test(await p.textContent('.ap-stories')) && /Le fil de l’agence/.test(accueil) && /CASTING CACAO/.test(accueil) && /Mensualité de .*10 000 F/.test(accueil),
      n + 'Accueil en « fil » (11/11/2026) : ronds façon stories, fil de l’agence (casting ouvert), mensualité du mois à payer');
    ok((await p.$$('.ap-post')).length >= 2 && !!(await p.$('.ap-post-image')), n + 'Accueil : les messages de l’agence en publications, avec leur photo');
    const nav = await p.evaluate(() => { const r = document.querySelector('.ap-nav').getBoundingClientRect(); return Math.abs(r.bottom - innerHeight) < 2; });
    ok(nav && !(await deborde()), n + 'menu collé en bas de l’écran, rien ne dépasse');
    await capture('1-accueil');
    // 4. Je confirme
    await p.click('.ap-carte.sombre [data-repondre="confirme"]'); await p.waitForTimeout(700);
    const rep = rpc('convocation_repondre').pop() || {};
    ok(rep.p_jeton === 'j'.repeat(36) && rep.p_reponse === 'confirme' && /Confirmée/.test(await p.textContent('.ap-carte.sombre')) && /présence est confirmée/.test(await p.textContent('#ap-message')),
      n + '« Je confirme » : réponse envoyée avec son lien personnel, « ✓ Confirmée » affiché');
    // 5. Mes événements : passages du défilé, carte d'accès, passés
    await p.click('.ap-nav a[href="#evenements"]'); await p.waitForSelector('.ap-onglets');
    ok((await p.$$('#ap-ecran .ap-ev-une')).length === 1 && (await p.$$('#ap-ecran .ap-ev-mini')).length === 1 && /SHOOTING CACAO/.test(await p.textContent('.ap-ev-mini')) && /Mes événements/.test(await p.textContent('.ap-tete')), n + 'Mes événements : les 2 à venir');
    ok(/ABIDJAN FASHION WEEK/.test(await p.textContent('.ap-ev-une')) && /^\d\d[A-ZÉÛ.]+$/.test((await p.textContent('.ap-ev-une .ap-ev-date')).trim()) && /dans 4 jours/.test(await p.textContent('.ap-ev-compte')) && /Convocation à 15h00/.test(await p.textContent('.ap-ev-une')) && /Ensuite/.test(await p.textContent('#ap-ecran')),
      n + 'Événements façon billets (11/11/2026) : le prochain en grand (date en carré, « dans 4 jours », convocation), les suivants sous « Ensuite »');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), n + 'Événements : rien ne dépasse de l’écran');
    await p.click('[data-passages]'); await p.waitForSelector('.ap-passage');
    const passages = await p.$$eval('.ap-passage', (l) => l.map((x) => x.textContent));
    ok(rpc('defile_programme').length === 1 && passages.length === 1 && /Salle A/.test(passages[0]) && /17h00/.test(passages[0]) ,
      n + 'défilé : ses passages seulement (Salle A, 17h00)');
    await p.click('[data-programme]'); await p.waitForSelector('.ap-programme');
    ok((await p.$$('.ap-prog-passage')).length === 2 && (await p.$$('.ap-prog-passage.moi')).length === 1 && /AK/.test(await p.textContent('.ap-programme')) && /Pathé’O/.test(await p.textContent('.ap-programme')),
      n + '« Tout le programme » dans l’application : jour par jour, ses passages soulignés, les autres avec leur visage');
    await capture('2-evenements');
    ok(/AYA KOUASSI/.test(await p.textContent('.ap-acces')) && /ACCÈS MANNEQUIN/.test(await p.textContent('.ap-acces')), n + 'carte d’accès à montrer à l’entrée');
    await p.click('[data-periode="passes"]'); await p.waitForTimeout(200);
    ok(/BORDER FORUM/.test(await p.textContent('#ap-ecran')) && !/SHOOTING CACAO/.test(await p.textContent('#ap-ecran')), n + 'onglet « Passés »');
    await p.click('[data-periode="avenir"]');
    await p.click('.ap-ev-mini:has-text("SHOOTING CACAO") summary'); await p.click('.ap-ev-mini:has-text("SHOOTING CACAO") [data-repondre="absent"]'); await p.waitForTimeout(600);
    ok((rpc('convocation_repondre').pop() || {}).p_reponse === 'absent' && /Absent\(e\)/.test(await p.textContent('.ap-ev-mini:has-text("SHOOTING CACAO")')) && !!(await p.$('.ap-ev-mini details[open]')), n + '« Je ne pourrai pas venir » (ligne touchée puis ouverte, après confirmation) : l’agence est prévenue, la ligne reste ouverte');
    await p.click('.ap-nav a[href="#accueil"]'); await p.waitForTimeout(400);
    ok(/Vous êtes la mannequin du mois/.test(await p.textContent('#ap-ecran')), n + 'Accueil : « 🏆 Vous êtes la mannequin du mois ! »');
    // 6. Profil
    await p.click('.ap-nav a[href="#profil"]'); await p.waitForSelector('.ap-vitrine');
    const profil = await p.textContent('#ap-ecran');
    ok(/AYA KOUASSI/.test(profil) && /New Face/.test(profil) && /Profil en ligne sur le Book/.test(profil) && /Abidjan · 1,78 m · 84-61-90/.test(profil) && (await p.$$('.ap-vitrine-grille img')).length === 3,
      n + 'Mon profil (façon réseau social, 11/11/2026) : niveau, en ligne, mensurations, grille des photos du Book');
    ok(!!(await p.$('.ap-vitrine-avatar img')) && !!(await p.$('.ap-vitrine-couv input[type=file][data-photo-role="photo_couverture"]')) && !!(await p.$('.ap-vitrine-avatar input[type=file][data-photo-role="principale"]'))
      && /3\s*photos/.test(await p.textContent('.ap-vitrine-chiffres')) && (await p.$$('.ap-vitrine-raccourcis a')).length === 3,
      n + 'Mon profil : photo ronde et couverture qu’on touche pour choisir dans la galerie, chiffres, raccourcis Compcard / CV / Photos');
    // photo ronde touchée : la galerie, puis la photo part dans le Book et devient la photo de profil
    // stockage des photos simulé (comme test-envoi-photos.js) : rien ne part pour de vrai
    await p.route(/\/api\/r2-presigner/, (r) => { const c = JSON.parse(r.request().postData() || '{}');
      if (c.action === 'verifier') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ uploadUrl: BASE + '/__stockage', publicUrl: BASE + '/scripts/tests-visiteur/medias/photo4.jpg' }) }); });
    await p.route(/__stockage/, (r) => r.fulfill({ status: 200, body: '' }));
    await p.setInputFiles('.ap-vitrine-avatar input[type=file]', path.join(__dirname, 'medias/photo4.jpg'));
    await p.waitForFunction(() => /Nouvelle photo de profil|n’a pas pu être envoyée/.test((document.getElementById('ap-message') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
    ok(/Nouvelle photo de profil/.test(await p.textContent('#ap-message')) && (await p.$$('.ap-vitrine-grille img')).length === 4,
      n + 'Mon profil : photo ronde changée depuis la galerie (elle rejoint aussi le Book) [' + (await p.textContent('#ap-message')) + ' · ' + (await p.$$('.ap-vitrine-grille img')).length + ']');
    await p.click('[data-partager-book]'); await p.waitForTimeout(500);
    ok(/copié|\/book\/|mannequin\.html\?id=/.test(await p.textContent('#ap-message')), n + 'Mon profil : « Partager mon book » donne le lien du book');
    // cours du dimanche (chantier 14) : en lecture seule, cochés par l'agence
    const moisAvant = P.moisVoisin(P.jourIso(new Date()).slice(0, 7), -1), nbAvant = P.dimanchesDuMois(moisAvant).length;
    ok(/Mes cours du dimanche/.test(profil) && (await p.$$('.pr-app-jour')).length === P.dimanchesDuMois(P.jourIso(new Date()).slice(0, 7)).length,
      n + 'Mon profil : « Mes cours du dimanche », les dimanches du mois en cours');
    ok(new RegExp((nbAvant - 1) + ' / ' + nbAvant).test(await p.textContent('.pr-app-historique')) && /Bien|Passable/.test(await p.textContent('.pr-app-historique')),
      n + 'Mon profil : le mois dernier, ' + (nbAvant - 1) + ' cours sur ' + nbAvant + ', avec sa mention');
    ok(!(await p.$('.pr-app-jour button, .pr-app button')) && !rpc('presence_marquer').length, n + 'Mon profil : présences en lecture seule (aucun bouton pour se cocher)');
    ok(/Mes bulletins/.test(profil) && /3e trimestre 2026/.test(profil) && /4 \/ 5/.test(profil) && /Très bon trimestre/.test(profil) && (await p.$$('.pr-app-notes li')).length === 3,
      n + 'Mon profil : « Mes bulletins » (trimestre, moyenne 4 / 5, notes, appréciation)');
    await capture('3-profil');
    ok((await p.getAttribute('a.ap-btn.rouge', 'href')) === '/app/espace-mannequin.html', n + '« Modifier mon profil » reste dans l’application');
    // l'éditeur du profil DANS l'application : même éditeur que le site, menu de l'application en bas
    await p.click('a.ap-btn.rouge'); await p.waitForSelector('.ap-nav a.actif', { timeout: 15000 }); await p.waitForTimeout(2500);
    ok(/\/app\/espace-mannequin\.html$/.test(p.url()) && /Profil/.test(await p.textContent('.ap-nav a.actif')) && /AYA KOUASSI/.test(await p.textContent('#app')) && !(await p.$('.site-header-v2')),
      n + 'Mon profil à modifier : l’éditeur s’ouvre dans l’application (sans l’en-tête du site), menu « Profil » en bas');
    ok(!(await p.isVisible('.top-right a[href="index.html"]').catch(() => false)) && !(await p.isVisible('.top').catch(() => false)) && !(await deborde()), n + 'ni « Retour au site » ni barre du site, rien ne dépasse');
    await capture('3b-profil-editeur');
    // fenêtre « Choisir une photo pour la compcard » : créée par le programme (plus recopiée dans chaque page)
    ok(await p.evaluate(() => { const a = fenetreChoixBook(), b = fenetreChoixBook(); return a === b && !!a.querySelector('[data-cc-book-grid]') && document.querySelectorAll('#ccBookModal').length === 1; }),
      n + 'fenêtre de choix de photo pour la compcard disponible (une seule)');
    // un lien du site vers « Mes paiements » (écrit par l'Espace mannequin) reste dans l'application
    await p.evaluate(() => { const a = document.createElement('a'); a.href = 'mes-paiements.html'; a.id = 'lien-essai'; a.textContent = 'Mes paiements'; document.body.appendChild(a); });
    await p.click('#lien-essai'); await p.waitForSelector('#mp-zone .mp-carte', { timeout: 15000 }); await p.waitForTimeout(800);
    ok(/\/app\/mes-paiements\.html$/.test(p.url()) && /Paiements/.test(await p.textContent('.ap-nav a.actif')) && /Wave/.test(await p.textContent('#mp-zone')),
      n + 'un lien « Mes paiements » du site : la page de paiement s’ouvre dans l’application (Wave, « J’ai payé »)');
    await capture('4b-paiements-wave');
    await p.click('.ap-nav a[href="/app/#profil"]'); await p.waitForSelector('.ap-vitrine', { timeout: 15000 }); // (depuis une page du site)
    ok(/\/app\/#profil$/.test(p.url()), n + 'retour à l’application par le menu du bas');
    // 7. Paiements
    await p.click('.ap-nav a[href="#paiements"]'); await p.waitForSelector('.ap-chiffre');
    const paiements = await p.textContent('#ap-ecran');
    ok(/8\s*\/\s*24/.test(paiements) && /mois payés/.test(paiements) && /À payer avant le 5/.test(paiements) && /Border Forum/.test(paiements) && /25 000 F/.test(paiements) && !!(await p.$('.ap-prochain [data-payer="payer"]')),
      n + 'Mes paiements : 8 mois sur 24, cachet reçu, « Payer avec Wave »');
    ok(/AYA KOUASSI/.test(await p.textContent('.ap-cb')) && /10 000 F/.test(await p.textContent('.ap-cb')) && (await p.$$('.ap-mois')).length === 24 && (await p.$$('.ap-mois.paye')).length === 8 && !!(await p.$('.ap-mois.courant.a_payer')) &&
      /Cachet · Border Forum.*\+ 25 000 F/s.test(await p.textContent('.ap-releve')) && /Mensualité d.*Wave/s.test(await p.textContent('.ap-releve')) && /Payer avec Wave/.test(await p.textContent('.ap-prochain')),
      n + 'Paiements « style banque » (11/11/2026) : carte de membre, grille des 24 mois (8 payés, mois en cours entouré), relevé des opérations (cachet + mensualité Wave)');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), n + 'Paiements : rien ne dépasse de l’écran');
    await capture('4-paiements');
    // (11/11/2026, demande de la propriétaire) « Payer avec Wave » : un volet dans la nouvelle page, plus l'ancienne page
    await p.click('.ap-prochain [data-payer="payer"]'); await p.waitForSelector('#ap-volet [data-mp="wave"]', { timeout: 15000 });
    ok(/\/app\/#paiements$/.test(p.url()) && /Mensualité ·/.test(await p.textContent('#ap-volet')) && (await p.$$('#ap-volet .mp-calendrier')).length === 0 && await p.isDisabled('#ap-volet [data-mp="paye"]'),
      n + '« Payer avec Wave » : volet par-dessus la page Paiements (même adresse), mensualité du mois, sans l’ancien calendrier ; « J’ai payé » attend Wave');
    await p.evaluate(() => { const a = document.querySelector('#ap-volet [data-mp="wave"]'); a.removeAttribute('href'); a.removeAttribute('target'); });  // (sans ouvrir Wave pour de vrai)
    await p.click('#ap-volet [data-mp="wave"]'); await p.waitForTimeout(500);
    await p.fill('#ap-volet .mp-num', '+225 07 11 22 33 44');
    await capture('4a-volet-wave');
    await p.click('#ap-volet [data-mp="paye"]'); await p.waitForTimeout(800);
    ok(rpc('mensualite_declarer_avec_numero').some((x) => x.p_numero === '+225 07 11 22 33 44') && /L’agence vérifie votre paiement/.test(await p.textContent('#ap-volet')),
      n + '« J’ai payé » dans le volet : paiement déclaré avec le numéro, message « l’agence vérifie »');
    await p.click('#ap-volet [data-fermer-volet]'); await p.waitForTimeout(400);
    ok(!(await p.$('#ap-volet')) && /\/app\/#paiements$/.test(p.url()), n + 'volet fermé : on reste sur la page Paiements');
    // à jour (rien à payer) : pas de « Payer avec Wave » qui mènerait à une page sans Wave (relevé par la propriétaire, 26/10/2026)
    const avantMois = d.rpc.mes_mensualites.mois;
    d.rpc.mes_mensualites.mois = avantMois.map((x) => (x.etat === 'a_payer' ? Object.assign({}, x, { etat: 'paye' }) : x));
    await p.reload(); await p.waitForSelector('.ap-chiffre', { timeout: 15000 });
    const aJour = await p.textContent('#ap-ecran');
    ok(/9\s*\/\s*24/.test(aJour) && /À jour/.test(aJour) && /Rien à payer pour le moment/.test(aJour) && !/Payer avec Wave/.test(aJour) && !!(await p.$('.ap-rien-a-payer + .ap-btns [data-payer="payer"]')) && /Mes reçus/.test(aJour),
      n + 'Mes paiements à jour : « Rien à payer pour le moment », pas de bouton Wave, « Payer à l’avance » et « Mes reçus »');
    await p.click('.ap-rien-a-payer + .ap-btns [data-payer="payer"]'); await p.waitForSelector('#ap-volet #avance', { timeout: 15000 });
    ok(/\/app\/#paiements$/.test(p.url()) && /Payer à l’avance/.test(await p.textContent('#ap-volet #avance')) && (await p.$$('#ap-volet .mp-calendrier')).length === 0 && !/Ma formation/.test(await p.textContent('#ap-volet')),
      n + '« Payer à l’avance » (captures de la propriétaire, 11/11/2026) : s’ouvre dans un volet de la nouvelle page, plus l’ancienne page');
    await capture('4c-paiement-avance');
    await p.click('.ap-volet-fond', { position: { x: 10, y: 10 } }); await p.waitForTimeout(300);
    await p.click('.ap-rien-a-payer + .ap-btns [data-payer="recus"]'); await p.waitForSelector('#ap-volet .mp-histo', { timeout: 15000 });
    ok(/REC-2026-00012/.test(await p.textContent('#ap-volet')) && /\/app\/#paiements$/.test(p.url()), n + '« Mes reçus » : les reçus dans le volet, sans changer de page');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(!(await p.$('#ap-volet')), n + 'Échap ferme le volet');
    await p.click('.ap-rien-a-payer + .ap-btns [data-payer="recus"]'); await p.waitForSelector('#ap-volet', { timeout: 15000 });
    await p.evaluate(() => { location.hash = '#evenements'; }); await p.waitForTimeout(500);
    ok(!(await p.$('#ap-volet')) && !(await p.evaluate(() => document.body.classList.contains('ap-volet-ouvert'))), n + 'retour du téléphone / autre onglet : le volet se ferme (relecture du 11/11/2026)');
    await p.evaluate(() => { location.hash = '#paiements'; }); await p.waitForTimeout(400);
    // reprise du 1er mars (supabase-reprise-mars.sql) : où elle en est, agence fermée
    Object.assign(d.rpc.mes_mensualites, { mois: avantMois.map((x) => (x.etat === 'a_payer' ? Object.assign({}, x, { etat: 'rodage' }) : x)),
      niveaux: 2, niveau: 1, mois_niveau: 7, reste: 11, faits_avant: 7, termine: false, fermee_jusqu_au: '2027-03-01', prochaine: '2027-03-01' });
    await p.reload(); await p.waitForSelector('.ap-chiffre', { timeout: 15000 });
    const reprise = await p.textContent('#ap-ecran');
    ok(/Niveau 1 sur 2/.test(reprise) && /Mois 7 sur 9 · il reste 11 mois/.test(reprise) && /Agence fermée jusqu’au 1er mars 2027/.test(reprise) && /Prochaine mensualité : mars 2027/.test(reprise) && /Agence fermée/.test(await p.textContent('.ap-pastille')),
      n + 'Mes paiements, reprise : « Niveau 1 sur 2 · mois 7 sur 9 · il reste 11 mois », « Agence fermée jusqu’au 1er mars 2027 »');
    ['niveaux', 'niveau', 'mois_niveau', 'reste', 'faits_avant', 'termine', 'fermee_jusqu_au', 'prochaine'].forEach((k) => delete d.rpc.mes_mensualites[k]);
    d.rpc.mes_mensualites.mois = avantMois;
    await p.reload(); await p.waitForSelector('.ap-chiffre', { timeout: 15000 });
    // 8. Messages : ce qui est à faire, puis les messages de l'agence (3e voie)
    await p.click('.ap-nav a[href="#alertes"]'); await p.waitForSelector('.ap-alerte');
    const alertes = await p.textContent('#ap-ecran');
    // (photo du message chargée à la demande : hauteur nulle tant qu'elle n'est pas arrivée)
    await p.waitForSelector('.ap-message-agence.nouveau .ap-message-image', { state: 'visible', timeout: 5000 }).catch(() => {});
    ok(/Mensualité de/.test(alertes) && /Casting ouvert : CASTING CACAO/.test(alertes) && !/confirmez votre présence/.test(alertes), n + 'Messages › À faire : mensualité, casting ; plus de convocation à confirmer');
    ok(/Maître Akesse Model Management/.test(await p.textContent('.ap-fil-tete')) && (await p.$$('.ap-message-agence')).length === 2 && await p.isVisible('.ap-message-agence.nouveau .ap-message-image') &&
      (await p.getAttribute('.ap-message-agence.nouveau a[href="https://exemple.ci/fiche.pdf"]', 'target')) === '_blank' && /Veuillez vous préparer/.test(await p.textContent('.ap-message-agence.nouveau')),
      n + 'Messages façon messagerie (11/11/2026) : bulles de l’agence, le nouveau entouré (texte, photo, fiche jointe)');
    ok((await p.$$('.ap-fil-jour')).length >= 1 && (await p.$$eval('.ap-fil-corps .ap-message-agence', (l) => l.map((x) => x.classList.contains('nouveau')))).join() === 'false,true' && !!(await p.$('.ap-bulle.paye')) && !!(await p.$('.ap-afaire .ap-alerte')),
      n + 'Messages : séparateurs par jour, du plus ancien au plus récent (le nouveau en bas), paiement en vert, « À faire » en cartes');
    ok(/^https:\/\/wa\.me\//.test(await p.getAttribute('a.ap-wa', 'href')) && (await p.getAttribute('a.ap-wa', 'target')) === '_blank' && /Écrire à l’agence sur WhatsApp/.test(await p.textContent('a.ap-wa')),
      n + '« Écrire à l’agence sur WhatsApp » : ouvre WhatsApp sur le numéro de l’agence');
    const lus = rpc('app_messages_lus');
    ok(lus.length === 1 && JSON.stringify(lus[0].p_ids) === '["msg1"]', n + 'message vu : marqué comme lu (seulement le nouveau)');
    // (proposée seulement quand le téléphone sait recevoir des notifications et ne les a ni acceptées ni refusées)
    const proposable = await p.evaluate(() => notificationsPossibles() && Notification.permission === 'default');
    ok((await p.$('.ap-notif [data-notifications]') !== null) === proposable && proposable === tel, n + '« Activer les notifications » proposé seulement quand c’est possible (' + proposable + ')');
    if (tel) {
      await p.click('.ap-notif [data-notifications]'); await p.waitForTimeout(600);
      const abo = rpc('app_push_abonner');
      ok(abo.length === 1 && abo[0].p_endpoint === 'https://push.exemple/aya' && /C’est activé/.test(await p.textContent('#ap-message')), n + '« Activer les notifications » : ce téléphone est abonné, la mannequin est prévenue');
    }
    await capture('5-messages');
    ok((await p.getAttribute('.ap-message-agence:not(.nouveau) a.ap-btn.rouge', 'href')) === '/app/#paiements', n + 'un message automatique ouvre la bonne page (Paiements)');
    ok(!(await deborde()), n + 'rien ne dépasse de l’écran');
    // 9. Déconnexion
    await p.click('.ap-nav a[href="#profil"]'); await p.waitForSelector('.ap-vitrine'); await p.click('[data-deconnexion]'); await p.waitForSelector('#ap-form-connexion');
    ok(true, n + 'déconnexion : retour à la connexion');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
