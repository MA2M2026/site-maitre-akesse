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
        { id: 'msg1', user_id: 'admin-1', sorte: 'casting', titre: '📣 Casting Kouroukan', texte: 'Information casting : Casting Kouroukan\n📅 Samedi\nVeuillez vous préparer.', image: '/scripts/tests-visiteur/medias/photo1.jpg', fiche: 'https://exemple.ci/fiche.pdf', lien: null, cree_le: new Date().toISOString(), lu_le: null },
        { id: 'msg2', user_id: 'admin-1', sorte: 'paiement', titre: '✅ Paiement confirmé : mensualité de septembre', texte: '10 000 FCFA reçus.', image: null, fiche: null, lien: '/app/#paiements', cree_le: '2026-10-01T10:00:00Z', lu_le: '2026-10-01T11:00:00Z' }]
    },
    rpc: {
      app_mes_evenements: () => evenements,
      convocation_repondre: (x) => { const e = evenements.find((y) => y.jeton === x.p_jeton); if (e) e.reponse = x.p_reponse; return !!e; },
      defile_programme: { passages: [{ jour: jour(4), debut: '17:00', salle: 'Salle A', theme: null, moi: true, mannequins: [] }, { jour: jour(4), debut: '17:30', salle: 'Salle B', theme: 'Pathé’O', moi: false, mannequins: [{ nom: 'Madame AWA KONÉ', photo: null, moi: false }] }] },
      mes_mensualites: { inscrit: true, nom: 'AYA KOUASSI', mensualite: 10000, statut: 'actif', mineur: false,
        mois: Array.from({ length: 24 }, (_, i) => ({ mois: moisDe(i - 8), etat: i < 8 ? 'paye' : i === 8 ? 'a_payer' : 'a_venir' })) },
      app_messages_lus: null, app_push_abonner: null,
      mes_cachets: [{ numero: 'C-0001', montant: 25000, motif: null, prestation: 'Border Forum', paye_le: jour(-8) + 'T10:00:00Z', jeton: 'x' }]
    }
  };
}
// Les pages du site ouvertes dans l'application (app/espace-mannequin.html, app/mes-paiements.html,
// app/inscription-mannequin.html)
// doivent charger les mêmes programmes et styles que leur page du site (hors en-tête, menu et
// mesures d'audience du site) : un fichier ajouté d'un côté seulement est signalé ici.
const fs = require('fs');
const RACINE = path.resolve(__dirname, '../..');
const fichiersDe = (page) => (fs.readFileSync(path.join(RACINE, page), 'utf8').match(/(?:src|href)="\/?((?:js|css)\/[^"?]+)/g) || []).map((x) => x.replace(/^(src|href)="\/?/, ''));
const SITE_SEULEMENT = /^(js\/(gabarit|menu|analytics-config|filet-reveal)\.js|css\/(menu|entete-site)\.css)$/;
for (const page of ['espace-mannequin.html', 'mes-paiements.html', 'inscription-mannequin.html']) {
  const manquants = fichiersDe(page).filter((f) => !SITE_SEULEMENT.test(f) && !fichiersDe('app/' + page).includes(f));
  ok(!manquants.length, 'app/' + page + ' charge les mêmes programmes et styles que ' + page + (manquants.length ? ' — manquent : ' + manquants.join(', ') : ''));
}
(async () => {
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1280, height: 860 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
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
    const capture = (nomCapture) => (process.env.CAPTURES && tel ? p.screenshot({ path: path.join(process.env.CAPTURES, nomCapture + '.png') }) : null);
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
    ok(/Nouveau message de l’agence : 📣 Casting Kouroukan/.test(accueil) && (await p.getAttribute('.ap-nouveau-message', 'href')) === '#alertes', n + 'Accueil : « Nouveau message de l’agence » mène à l’onglet Messages');
    ok((await p.$$('.ap-nav a')).length === 5 && /Accueil.*Événements.*Profil.*Paiements.*Messages/s.test(await p.textContent('.ap-nav')) && /1/.test(await p.textContent('.ap-nav a[href="#evenements"]')), n + 'menu du bas : 5 onglets, « 1 » sur Événements (à répondre)');
    ok(/Ma carte.*Ma compcard.*Mon CV/s.test(await p.textContent('.ap-raccourcis')) && /CASTING CACAO/.test(accueil) && /Mensualité de .*10 000 F/.test(accueil), n + 'Accueil : raccourcis, casting ouvert, mensualité du mois à payer');
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
    ok((await p.$$('#ap-ecran article.ap-carte')).length === 2 && /SHOOTING CACAO/.test(await p.textContent('#ap-ecran')) && /Mes événements/.test(await p.textContent('.ap-tete')), n + 'Mes événements : les 2 à venir');
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
    await p.click('article.ap-carte:has-text("SHOOTING CACAO") [data-repondre="absent"]'); await p.waitForTimeout(600);
    ok((rpc('convocation_repondre').pop() || {}).p_reponse === 'absent' && /Absent\(e\)/.test(await p.textContent('article.ap-carte:has-text("SHOOTING CACAO")')), n + '« Je ne pourrai pas venir » (après confirmation) : l’agence est prévenue');
    // 6. Profil
    await p.click('.ap-nav a[href="#profil"]'); await p.waitForSelector('.ap-portrait');
    const profil = await p.textContent('#ap-ecran');
    ok(/AYA KOUASSI/.test(profil) && /New Face/.test(profil) && /Publié/.test(profil) && /Profil complet à \d+ %/.test(profil) && /1,78 m · 84-61-90/.test(profil) && (await p.$$('.ap-galerie img')).length === 3,
      n + 'Mon profil : niveau, en ligne, profil complet en %, mensurations, photos du Book');
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
    await p.click('.ap-nav a[href="/app/#profil"]'); await p.waitForSelector('.ap-portrait', { timeout: 15000 }); // (depuis une page du site)
    ok(/\/app\/#profil$/.test(p.url()), n + 'retour à l’application par le menu du bas');
    // 7. Paiements
    await p.click('.ap-nav a[href="#paiements"]'); await p.waitForSelector('.ap-chiffre');
    const paiements = await p.textContent('#ap-ecran');
    ok(/8\s*\/\s*24/.test(paiements) && /mois payés/.test(paiements) && /À payer avant le 5/.test(paiements) && /Border Forum/.test(paiements) && /25 000 F/.test(paiements) && (await p.getAttribute('a.ap-btn.rouge', 'href')) === '/app/mes-paiements.html',
      n + 'Mes paiements : 8 mois sur 24, cachet reçu, « Payer avec Wave »');
    await capture('4-paiements');
    // à jour (rien à payer) : pas de « Payer avec Wave » qui mènerait à une page sans Wave (relevé par la propriétaire, 26/10/2026)
    const avantMois = d.rpc.mes_mensualites.mois;
    d.rpc.mes_mensualites.mois = avantMois.map((x) => (x.etat === 'a_payer' ? Object.assign({}, x, { etat: 'paye' }) : x));
    await p.reload(); await p.waitForSelector('.ap-chiffre', { timeout: 15000 });
    const aJour = await p.textContent('#ap-ecran');
    ok(/9\s*\/\s*24/.test(aJour) && /À jour/.test(aJour) && /Rien à payer pour le moment/.test(aJour) && !/Payer avec Wave/.test(aJour) && (await p.getAttribute('.ap-rien-a-payer + .ap-btns a.rouge', 'href')) === '/app/mes-paiements.html#avance' && /Mes mois et mes reçus/.test(aJour),
      n + 'Mes paiements à jour : « Rien à payer pour le moment », pas de bouton Wave, « Payer à l’avance » et « Mes mois et mes reçus »');
    await p.click('.ap-rien-a-payer + .ap-btns a.rouge'); await p.waitForSelector('#avance', { timeout: 15000 });
    ok(/\/app\/mes-paiements\.html#avance$/.test(p.url()) && /Payer à l’avance/.test(await p.textContent('#avance')), n + '« Payer à l’avance » ouvre la carte du paiement à l’avance, dans l’application');
    await capture('4c-paiement-avance');
    await p.goto(BASE + '/app/#paiements'); await p.waitForSelector('.ap-chiffre', { timeout: 15000 });
    d.rpc.mes_mensualites.mois = avantMois;
    await p.reload(); await p.waitForSelector('.ap-chiffre', { timeout: 15000 });
    // 8. Messages : ce qui est à faire, puis les messages de l'agence (3e voie)
    await p.click('.ap-nav a[href="#alertes"]'); await p.waitForSelector('.ap-alerte');
    const alertes = await p.textContent('#ap-ecran');
    ok(/Mensualité de/.test(alertes) && /Casting ouvert : CASTING CACAO/.test(alertes) && !/confirmez votre présence/.test(alertes), n + 'Messages › À faire : mensualité, casting ; plus de convocation à confirmer');
    ok(/Messages de l’agence/.test(alertes) && (await p.$$('.ap-message-agence')).length === 2 && await p.isVisible('.ap-message-agence.nouveau .ap-message-image') &&
      (await p.getAttribute('.ap-message-agence.nouveau a[href="https://exemple.ci/fiche.pdf"]', 'target')) === '_blank' && /Veuillez vous préparer/.test(await p.textContent('.ap-message-agence.nouveau')),
      n + 'Messages de l’agence : le nouveau message ouvert (texte, photo, fiche jointe), l’ancien replié');
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
    await p.click('.ap-message-agence:not(.nouveau) summary');
    ok((await p.getAttribute('.ap-message-agence:not(.nouveau) a.ap-btn.rouge', 'href')) === '/app/#paiements', n + 'un message automatique ouvre la bonne page (Paiements)');
    ok(!(await deborde()), n + 'rien ne dépasse de l’écran');
    // 9. Déconnexion
    await p.click('.ap-nav a[href="#profil"]'); await p.waitForSelector('.ap-portrait'); await p.click('[data-deconnexion]'); await p.waitForSelector('#ap-form-connexion');
    ok(true, n + 'déconnexion : retour à la connexion');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
