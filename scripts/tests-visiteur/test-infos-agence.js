// « Informations agence » (js/admin/site-infos.js, 26/10/2026), essayé comme l'agence sur téléphone
// et ordinateur, base SIMULÉE (donnees-nouvelle-admin.js ; rien n'est écrit ni envoyé pour de vrai) :
// type d'information, message rédigé tout seul (et qui suit les changements), projet de l'agenda
// qui remplit tout, remerciement qui coche les mannequins convoquées, photo jointe, envoi dans
// l'application (3e voie), puis e-mails et WhatsApp un par un, avec leur suivi.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { donnees, photosLocales, seConnecter } = require('./donnees-nouvelle-admin');
const { lirePageEntiere } = require('./lisibilite');
const chemin = require('path');
const PORT = String(9500 + Math.floor(Math.random() * 90));
const URL_ADMIN = 'http://127.0.0.1:' + PORT + '/admin/';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const capture = (p, nom) => process.env.CAPTURES ? p.screenshot({ path: process.env.CAPTURES + '/' + nom + '.png', fullPage: true }) : null;

(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  for (const [nom, ecran] of [['téléphone', { width: 390, height: 844 }], ['ordinateur', { width: 1366, height: 900 }]]) {
    const tel = ecran.width < 700, n = nom + ' : ', suffixe = tel ? '-tel' : '-pc';
    const ctx = await b.newContext({ viewport: ecran, isMobile: tel, hasTouch: tel, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = [], journal = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console : ' + m.text().slice(0, 140)); });
    p.on('dialog', (dl) => dl.accept());
    const d = donnees('principal');
    d.tables.infos_agence = [];
    // le projet dure deux jours, dans deux lieux différents (agenda, « Horaires et lieux, jour par jour »)
    const p1 = d.tables.agenda_projets[0], lendemain = new Date(Date.parse(p1.date_debut + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
    Object.assign(p1, { date_fin: lendemain, seances: [{ jour: p1.date_debut, debut: '17:00', lieu: 'Parc des Expositions' }, { jour: lendemain, debut: '18:00', lieu: 'La Tribe' }] });
    d.rpc.app_messages_envoyer = (x) => (x.p_cles || []).filter((c) => /^m:m[0-2]$/.test(c)).length;  // (m0 à m2 ont l'application)
    d.rpc.places_contacts_registre = (x) => (x.p_ids || []).map((id) => ({ mannequin_id: id, full_name: 'REGISTRE ' + id, genre: 'femme', phone: '0700000099', contact_email: null, date_naissance: '2012-05-05', parent_nom: 'Madame Mère', parent_telephone: '0505050599', parent_email: 'mere@test.ci' }));
    await brancher(p, d, journal); await photosLocales(p);
    await p.addInitScript(() => { window.open = (u) => { (window.__ouverts = window.__ouverts || []).push(u); return null; }; });
    await seConnecter(p, URL_ADMIN); await p.waitForSelector('.accueil-tete');

    // 1. Le menu : « Informations agence » avec les convocations ; liste vide
    await p.goto(URL_ADMIN + '#/site/b2-infos'); await p.waitForSelector('#contenu .entete', { timeout: 8000 });
    ok(/Aucune information envoyée/.test(await p.textContent('#contenu')), n + 'Informations agence : liste vide au départ');
    // 2. Nouvelle information : un casting
    await p.click('a[href="#/site/b2-infos/nouvelle"]'); await p.waitForSelector('#if-message', { timeout: 8000 });
    await p.fill('#if-titre', 'Casting Kouroukan Mode'); await p.fill('#if-date', '2026-11-14'); await p.fill('#if-lieu', 'Riviera Faya'); await p.fill('#if-client', 'Kouroukan');
    let m = await p.inputValue('#if-message');
    ok(/L’agence organise le casting \*Casting Kouroukan Mode\* pour Kouroukan, le samedi 14 novembre 2026, à Riviera Faya\./.test(m) && /Préparez-vous avec soin/.test(m) && /^✨ \*MAÎTRE AKESSE/.test(m) && !/—/.test(m),
      n + 'casting : le message chaleureux s’écrit tout seul (titre, client, date, lieu, « préparez-vous »), sans tiret long');
    await p.check('input[name="sorte"][value="remerciement"]'); await p.waitForTimeout(200);
    m = await p.inputValue('#if-message');
    ok(/Merci pour votre participation à \*Casting Kouroukan Mode\*/.test(m) && !/Information casting/.test(m), n + 'remerciement : le message change avec le type');
    // projet de l'agenda : tout se remplit, et les mannequins convoquées (pas les absentes) sont cochées
    await p.selectOption('#if-projet', 'p1'); await p.waitForFunction(() => document.getElementById('if-titre') && document.getElementById('if-titre').value === 'ABIDJAN BORDER FORUM', null, { timeout: 8000 });
    const coches = await p.$$eval('.df-choix-carte input:checked', (l) => l.map((x) => x.value));
    ok((await p.inputValue('#if-lieu')) === 'Parc des Expositions, La Tribe' && (await p.inputValue('#if-date_fin')) === lendemain && coches.sort().join() === 'm:m0,m:m1,m:m2,m:m3' && /4 mannequins choisies/.test(await p.textContent('#if-compte')),
      n + 'projet de l’agenda sur deux jours : toutes les dates et tous les lieux, les 4 mannequins convoquées cochées');
    ok(/Merci pour votre participation à \*ABIDJAN BORDER FORUM\*, du \S+ \d+ (\S+ )?au \S+ \d+ \S+ \d{4}, au Parc des Expositions et à la Tribe\./.test(await p.inputValue('#if-message')),
      n + 'remerciement : « du … au …, au Parc des Expositions et à la Tribe » en une phrase');
    // retouche à la main : gardée même si on change un champ
    await p.fill('#if-message', (await p.inputValue('#if-message')) + '\nÀ très vite !'); await p.fill('#if-client', 'Border Forum'); await p.waitForTimeout(200);
    ok(/À très vite !/.test(await p.inputValue('#if-message')), n + 'message retouché à la main : gardé');
    // une mannequin du registre sans compte, mineure (WhatsApp au parent)
    await p.check('.df-choix-carte input[value="r:r3"]');
    // photo jointe (Cloudflare R2, dossier « infos »)
    await p.setInputFiles('#if-photo', chemin.resolve(__dirname, 'medias/photo1.jpg')); await p.waitForFunction(() => /Photo jointe/.test(document.getElementById('if-pieces').textContent), null, { timeout: 8000 });
    ok(journal.some((j) => j[0] === 'API' && j[1] === '/api/r2-site-images' && /"categorie":"infos"/.test(j[2] || '') && /site\/infos\//.test(j[2] || '')), n + 'photo envoyée dans le dossier des informations');
    await capture(p, 'infos-nouvelle' + suffixe);
    const pales = (await lirePageEntiere(p)).map((x) => x.texte.slice(0, 25)); ok(!pales.length, n + 'écran lisible ' + pales.join(' | '));
    // 3. Envoi : dans l'application tout de suite
    await p.click('form[data-form="infos-envoyer"] [type=submit]'); await p.waitForSelector('[data-action="infos-emails"]', { timeout: 8000 });
    const envoi = journal.find((j) => j[0] === 'rpc' && j[1] === 'app_messages_envoyer');
    const x = envoi ? JSON.parse(envoi[2]) : {};
    ok(x.p_cles && x.p_cles.length === 5 && x.p_sorte === 'remerciement' && x.p_titre === '🤍 ABIDJAN BORDER FORUM' && /Merci pour votre participation à ABIDJAN BORDER FORUM/.test(x.p_texte) && !/MAÎTRE AKESSE|Bonjour|\*/.test(x.p_texte) && /^https?:/.test(x.p_image || ''),
      n + 'application : le message (sans en-tête ni *gras*) et la photo pour les 5 mannequins choisies');
    const info = d.tables.infos_agence[0] || {};
    ok(info.dans_app === 3 && /Bonjour \{parent\}/.test(info.message_parent || '') && /votre enfant \*\{prénom\}\*/.test(info.message_parent || '') && /À très vite !/.test(info.message_parent || ''),
      n + 'information enregistrée : reçue par les 3 qui ont l’application ; version parent prête (même retouchée)');
    ok(/Reçue par 3 mannequins/.test(await p.textContent('#contenu')), n + 'fiche : « Reçue par 3 mannequins » dans l’application');
    await capture(p, 'infos-fiche' + suffixe);
    // 4. E-mails (automatiques, un par un) puis WhatsApp (au parent pour la mineure)
    await p.click('[data-action="infos-emails"]'); await p.waitForFunction(() => !document.querySelector('[data-action="infos-emails"]'), null, { timeout: 30000 }).catch(() => {});
    const emails = journal.filter((j) => j[0] === 'EMAIL').map((j) => JSON.parse(j[1]));
    ok(emails.length === 4 + 1 && emails.some((e) => e.template_params.to_email === 'mere@test.ci' && /votre enfant/.test(e.template_params.message)) && emails.every((e) => !/\*/.test(e.template_params.message)),
      n + 'e-mails : un par personne (au parent pour la mineure), sans *gras*');
    ok((d.tables.infos_agence[0].faits_email || []).length === 5, n + 'e-mails notés comme envoyés (on peut reprendre plus tard sans doublon)');
    await p.waitForSelector('[data-action="infos-wa"]', { timeout: 8000 });
    for (let i = 0; i < 6; i++) {
      // (l'écran se redessine après chaque envoi : le bouton est recherché à chaque fois)
      const clique = await p.locator('[data-action="infos-wa"]').click({ timeout: 4000 }).then(() => true, () => false);
      if (!clique) break;  // (tout est envoyé : le bouton a disparu)
      await p.waitForFunction((k) => (window.__ouverts || []).length > k, i, { timeout: 8000 });
      await p.waitForFunction(() => { const c = document.querySelector('#contenu'); return c && !/Chargement/.test(c.textContent) && /WhatsApp/.test(c.textContent); }, null, { timeout: 8000 });
    }
    const ouverts = await p.evaluate(() => window.__ouverts || []);
    ok(ouverts.length === 5 && ouverts.some((u) => /wa\.me\/2250505050599\?text=/.test(u) && /Bonjour%20Madame%20M%C3%A8re/.test(u)) && ouverts.every((u) => !/%7Bpr%C3%A9nom%7D/i.test(u)),
      n + 'WhatsApp : un message prêt par personne (au parent pour la mineure), tous les noms remplis (' + ouverts.length + ' ouverts)');
    ok(!(await p.$('[data-action="infos-wa"]')) && /5 \/ 5 envoyé/.test(await p.textContent('#contenu')), n + 'WhatsApp : tout est envoyé, suivi à jour ' + ((await p.textContent('#contenu')).match(/\d+ \/ \d+ envoyé/g) || []).join(' | '));
    // 5. La liste
    await p.goto(URL_ADMIN + '#/site/b2-infos'); await p.waitForSelector('.projet-carte', { timeout: 8000 }).catch(async () => console.log('LISTE : ' + (await p.textContent('#contenu')).slice(0, 300)));
    ok(/ABIDJAN BORDER FORUM/.test(await p.textContent('#contenu')) && /📱 3 dans l’application/.test(await p.textContent('#contenu')), n + 'liste : l’information avec son suivi');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(ko ? '\n❌ ' + ko + ' échec(s)' : '\nTout est bon.');
  process.exit(ko ? 1 : 0);
})();
