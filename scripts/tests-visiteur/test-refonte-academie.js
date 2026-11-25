// Refonte Agence + MA2M Academy (25/11/2026, textes validés par la propriétaire), comme une visiteuse, téléphone et
// ordinateur, FR et EN : la page MA2M Academy (programmes, recyclage, frais, Atelier) ; son bouton « Postuler » amène
// au formulaire d'« Intégrer l'agence » réglé sur MA2M Academy ; les pages de l'agence n'affichent aucun montant ;
// dans l'Administration, la porte choisie change le texte {candidature} et l'en-tête des messages (rien n'est envoyé).
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const chemin = require('path');
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const PORT = String(9960 + Math.floor(Math.random() * 30));
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: chemin.resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 900));
  const b = await chromium.launch();
  const ouvrir = async (page, ecran) => {
    const p = await (await b.newContext({ viewport: ecran })).newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { try { localStorage.setItem('ma2m_cookies', 'non'); sessionStorage.setItem('ma2m_entree_vue', '1'); } catch (e) { /* */ } });
    await brancher(p, { tables: {}, rpc: {} }, []);
    await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForTimeout(1500);
    return { p, errs };
  };
  for (const [page, ecran] of [['academie.html', { width: 390, height: 844 }], ['en/academie.html', { width: 1366, height: 900 }]]) {
    const en = page.startsWith('en/'), n = page + ' ' + ecran.width + 'px : ';
    const { p, errs } = await ouvrir(page, ecran);
    const texte = await p.evaluate(() => document.querySelector('main').textContent);
    ok(/MA2M Academy/.test(texte) && (en ? /18 months/.test(texte) && /9 months/.test(texte) : /18 mois/.test(texte) && /9 mois/.test(texte)), n + 'formation initiale de 18 mois et recyclage de 9 mois présentés');
    ok(await p.locator('main .lx-prog-mois').count() === 27 && await p.locator('#recyclage .lx-prog-mois').count() === 9, n + 'programme : 2 niveaux de 9 mois, recyclage de 9 mois');
    ok(en ? /15,000 FCFA/.test(texte) && /10,000 FCFA/.test(texte) : /15 000 FCFA/.test(texte) && /10 000 FCFA/.test(texte), n + 'frais affichés : 15 000 FCFA d’inscription, 10 000 FCFA par mois');
    ok(en ? /Joining the agency and the representation contract are free/.test(texte) : /L'entrée à l'agence et le contrat de représentation sont gratuits/.test(texte), n + 'rappel : l’entrée à l’agence est gratuite');
    ok(await p.locator('a[href="cours-talons.html"]').count() >= 1, n + 'lien vers l’Atelier Talons & Élégance');
    ok(await p.locator('#form-casting').count() === 1 && await p.locator('.video-pleine video').count() >= 1, n + 'la vidéo et le formulaire de candidature sont sur la page');
    ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, n + 'aucun débordement horizontal');
    ok(!errs.length, n + 'aucune erreur ' + errs.join(' | '));
    await p.context().close();
  }
  // les pages de l'agence ne montrent aucun montant ; la page Academy est dans le menu
  for (const page of ['index.html', 'qui-sommes-nous.html', 'services.html', 'integrer-agence.html', 'en/index.html', 'en/qui-sommes-nous.html', 'en/services.html', 'en/integrer-agence.html']) {
    const { p, errs } = await ouvrir(page, { width: 390, height: 844 });
    const t = await p.evaluate(() => document.querySelector('main').textContent);
    ok(!/FCFA/.test(t), page + ' : aucun montant');
    ok(await p.locator('a[href$="academie.html"]').count() >= 1, page + ' : lien vers MA2M Academy');
    ok(!errs.length, page + ' : aucune erreur ' + errs.join(' | '));
    await p.context().close();
  }
  // messages de l'Administration : porte et en-tête (fonctions partagées, sans envoi)
  {
    const { p } = await ouvrir('academie.html', { width: 1000, height: 800 });
    await p.addScriptTag({ url: '/js/messages-convocations.js' }); await p.addScriptTag({ url: '/js/messages-candidats.js' });
    const r = await p.evaluate(() => {
      const t = messageCandidatParCle('retenue').modele('agence');
      const d = (porte) => ({ full_name: 'AWA KONE', civilite: 'Mademoiselle', type_candidature: 'agence', email: 'a@exemple.ci', message: porte ? 'Parcours choisi : ' + porte + '\n\nBonjour' : 'Bonjour' });
      const insc = { full_name: 'AWA KONE', civilite: 'Mademoiselle', statut: 'payée', email: 'a@exemple.ci' };
      const vI = messageCandidatParCle('ins_validee').modele('agence');
      return {
        academie: personnaliserMessage(t, d('MA2M Academy'), {}, () => ''),
        reseau: personnaliserMessage(t, d('Talent Network'), {}, () => ''),
        ancienne: personnaliserMessage(t, d(null), {}, () => ''),
        inscription: personnaliserMessage(vI, insc, {}, () => '')
      };
    });
    ok(/MA2M ACADEMY/.test(r.academie) && /pour MA2M Academy/.test(r.academie) && /L'équipe MA2M Academy/.test(r.academie), 'message « retenue », porte Academy : en-tête, signature et texte MA2M Academy');
    ok(/MAÎTRE AKESSE MODEL MANAGEMENT\* ✨\n/.test(r.reseau) && /pour rejoindre le Talent Network/.test(r.reseau), 'message « retenue », porte Talent Network : en-tête de l’agence, « pour rejoindre le Talent Network »');
    ok(/pour intégrer l'agence/.test(r.ancienne), 'ancienne candidature (sans porte) : texte inchangé');
    ok(/MA2M ACADEMY/.test(r.inscription) && /inscription à MA2M Academy est validée/.test(r.inscription), 'inscription validée : message de MA2M Academy');
    await p.context().close();
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : '✅ Refonte Agence + MA2M Academy : tout passe');
  process.exit(ko ? 1 : 0);
})();
