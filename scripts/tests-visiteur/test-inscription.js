// Inscription simplifiée (cahier v2.4, section 4) essayée comme une vraie personne, en français
// (téléphone) et en anglais (ordinateur), avec un serveur SIMULÉ (rien n'est écrit pour de vrai) :
// code + date de naissance (mauvais essai compté), « Bonjour …, félicitations », correction des
// informations, règlement (accord du parent pour un mineur), Wave puis « J'ai payé ».
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const { lirePageEntiere } = require('./lisibilite');
const { verifierBoutons } = require('./boutons');
const PORT = String(8800 + Math.floor(Math.random() * 100));
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
const CASTINGS = {
  'MA2M-ADULTE': { naissance: '2001-03-04', casting: { salutation: 'Mademoiselle TRAORÉ BINTOU', full_name: 'TRAORÉ BINTOU', telephone: '0909090909', email: 'bintou@test.ci', ville: 'Abidjan', genre: 'femme', date_naissance: '2001-03-04', casting: 'Intégrer l\'agence', mineur: false } },
  'MA2M-ENFANT': { naissance: '2014-05-05', casting: { salutation: 'Monsieur AKESSE FRANCK', full_name: 'AKESSE FRANCK', telephone: '0198138600', email: null, ville: 'Bingerville', genre: 'homme', date_naissance: '2014-05-05', casting: 'Casting à l\'agence', mineur: true, parent_nom: null, parent_telephone: null } }
};
(async () => {
  let srv; process.on('exit', () => srv && srv.kill());
  srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore', stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  for (const [page, vp, nom] of [['inscription-mannequin.html', { width: 390, height: 844 }, 'FR téléphone'], ['en/inscription-mannequin.html', { width: 1280, height: 900 }, 'EN ordinateur']]) {
    for (const code of ['MA2M-ADULTE', 'MA2M-ENFANT']) {
      const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const errs = [], journal = [];
      p.on('pageerror', e => errs.push(e.message));
      // refus de la sécurité du navigateur (CSP), ex. style="…" écrit par le script (journal du 20/10/2026)
      p.on('console', m => { if (/Content Security Policy/.test(m.text())) errs.push('CSP : ' + m.text().slice(0, 160)); });
      let essais = 3;
      await brancher(p, { tables: {}, rpc: { lien_paiement: () => 'https://pay.wave.com/m/PARAMETRES/c/ci/?amount=25000' }, api: { '/api/code-protege': (c) => {
        const k = CASTINGS[c.code];
        if (!k || c.naissance !== k.naissance) return { statut: 401, error: 'refuse', essaisRestants: --essais };
        if (c.type === 'inscription-code') return { ok: true, casting: k.casting, note: 'prive/note-integration/note-1.pdf' };
        return { ok: true };
      } } }, journal);
      await p.goto('http://127.0.0.1:' + PORT + '/' + page); await p.waitForSelector('#inn-code');
      if (await p.isVisible('#bandeau-cookies [data-cookies="oui"]')) await p.click('#bandeau-cookies [data-cookies="oui"]');
      const t = () => p.evaluate(() => document.getElementById('inn-ecran').innerText);
      // 1. mauvaise date : refusé, essais restants affichés
      await p.fill('#inn-code', code.toLowerCase()); await p.fill('#inn-naissance', '2000-01-01'); await p.click('[data-a="entrer"]'); await p.waitForSelector('.inn-bandeau.erreur');
      ok(/2 (tentatives|attempts)/.test(await t()), nom + ' ' + code + ' : mauvaise date de naissance refusée, essais restants indiqués');
      await p.fill('#inn-naissance', CASTINGS[code].naissance); await p.click('[data-a="entrer"]'); await p.waitForSelector('[data-a="corriger"]', { timeout: 6000 }).catch(() => {});
      const recap = await t();
      ok(recap.includes(CASTINGS[code].casting.salutation) && /(félicitations|congratulations)/.test(recap), nom + ' ' + code + ' : « Bonjour " + salutation + ", félicitations », informations du casting');
      const appelCode = journal.find((j) => j[1] === '/api/code-protege' && /inscription-code/.test(j[2]) && JSON.parse(j[2]).naissance === CASTINGS[code].naissance);
      ok(appelCode && JSON.parse(appelCode[2]).code === code, nom + ' ' + code + ' : code (en majuscules) et date de naissance envoyés au serveur');
      if (code === 'MA2M-ENFANT') {
        ok(await p.isDisabled('[data-a="oui"]'), nom + ' : mineur sans parent → impossible de continuer sans corriger');
        await p.click('[data-a="corriger"]'); await p.fill('#inn-pnom', 'Monsieur Akesse Paul'); await p.fill('#inn-ptel', '0777071859');
      } else {
        await p.click('[data-a="corriger"]'); await p.fill('#inn-tel', '0101010101');
      }
      await p.click('[data-a="enregistrer"]'); await p.waitForSelector('#inn-regl');
      ok(await p.isVisible('a[href$="prive/note-integration/note-1.pdf"]'), nom + ' ' + code + ' : règlement (PDF) à lire');
      await p.check('#inn-regl');
      if (code === 'MA2M-ENFANT') {
        ok(await p.isDisabled('#inn-vers-paiement') && /Akesse Paul/.test(await t()), nom + ' : mineur → l’accord du parent est obligatoire');
        await p.check('#inn-parent');
      }
      await p.click('#inn-vers-paiement'); await p.waitForSelector('[data-a="paye"]');
      const pay = await t();
      ok(/25 000 FCFA/.test(pay) && /15 000 FCFA/.test(pay) && /10 000 FCFA/.test(pay) && await p.isDisabled('[data-a="paye"]'), nom + ' ' + code + ' : 25 000 = 15 000 + 10 000, « J’ai payé » attend le paiement Wave');
      await p.waitForFunction(() => /PARAMETRES/.test(document.querySelector('[data-a="wave"]').href), null, { timeout: 4000 }).catch(() => {});
      ok(/PARAMETRES.*amount=25000$/.test(await p.getAttribute('[data-a="wave"]', 'href')), nom + ' ' + code + ' : lien Wave de 25 000 FCFA (celui des Paramètres)');
      ok((await p.inputValue('#inn-num')).replace(/\D/g, '').length >= 8, nom + ' ' + code + ' : numéro du payeur prérempli');
      const boutons = (await p.evaluate(verifierBoutons)).map((x) => x.texte);
      ok(!boutons.length, nom + ' ' + code + ' : boutons au modèle rouge ' + boutons.join(' | '));
      const pales = (await lirePageEntiere(p)).map((x) => x.texte.slice(0, 25)); ok(!pales.length, nom + ' ' + code + ' : écran lisible ' + pales.join(' | '));
      await p.evaluate(() => { window.open = () => null; });
      await p.locator('[data-a="wave"]').evaluate((a) => { a.removeAttribute('target'); a.href = '#'; });
      await p.click('[data-a="wave"]'); await p.waitForTimeout(500);
      await p.fill('#inn-num', 'abc'); ok(await p.isDisabled('[data-a="paye"]'), nom + ' ' + code + ' : numéro invalide, « J’ai payé » fermé');
      await p.fill('#inn-num', '+225 05 05 05 05 05'); ok(!(await p.isDisabled('[data-a="paye"]')), nom + ' ' + code + ' : numéro valide, « J’ai payé » ouvert');
      await p.click('[data-a="paye"]'); await p.waitForSelector('.inn-bandeau.info', { timeout: 6000 }).catch(() => {});
      const envoi = journal.find((j) => j[1] === '/api/code-protege' && /inscription-payer/.test(j[2]));
      const infos = envoi ? JSON.parse(envoi[2]).infos : {};
      ok(/(Merci|Thank you)/.test(await t()), nom + ' ' + code + ' : « J’ai payé » → merci, l’agence vérifie');
      ok(infos.numero_payeur === '+225 05 05 05 05 05' && infos.moyen === 'wave', nom + ' ' + code + ' : numéro du payeur et moyen envoyés');
      ok(code === 'MA2M-ENFANT' ? infos.parent_nom === 'Monsieur Akesse Paul' && infos.accord_parent === 'Monsieur Akesse Paul' && infos.reglement === 'accepte'
        : infos.telephone === '0101010101' && infos.reglement === 'accepte' && !infos.capture, nom + ' ' + code + ' : informations corrigées et règlement envoyés, sans capture ni référence');
      ok(!errs.length, nom + ' ' + code + ' : aucune erreur de page ' + errs.join(' | '));
      await ctx.close();
    }
  }
  await b.close();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
