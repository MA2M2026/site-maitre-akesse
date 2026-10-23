// Photos partout (demande de la propriétaire, 23/10/2026) : « partout où le nom d'un mannequin est
// cité dans l'Administration, sa photo à côté, et cliquable quand on doit la choisir ». Parcourt
// TOUS les écrans du menu (site, paiements, comptabilité, sécurité) et les écrans qui s'ouvrent
// ensuite (fiche d'une mannequin, d'une candidature, des Paiements ; panneau « Convoquer » ;
// formulaire de l'Agenda ; nouveau cachet), comme une vraie personne, et signale tout nom de
// mannequin sans photo à côté. Base simulée : rien n'est écrit.
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const { brancher } = require('./faux-serveur');
const admin = require('./donnees-nouvelle-admin');
const PORT = String(9600 + Math.floor(Math.random() * 90)); const BASE = 'http://127.0.0.1:' + PORT + '/';
const OUT = process.env.CAPTURES || '';
let ko = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '❌ ÉCHEC ') + m); if (!c) ko++; };
(async () => {
  const srv = spawn('python3', ['-m', 'http.server', PORT], { cwd: require('path').resolve(__dirname, '../..'), stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const d = admin.donnees('principal'); const journal = [];
  await p.addInitScript(() => { localStorage.setItem('ma2m_cookies', 'non'); window.confirm = () => false; });
  await brancher(p, d, journal); await admin.photosLocales(p);
  await admin.seConnecter(p, BASE + 'admin/'); await p.waitForSelector('.accueil-tete', { timeout: 15000 });
  const noms = [...new Set([...admin.NOMS, ...d.tables.casting_applications.map(c => c.full_name), ...(d.tables.agence_mannequins || []).map(m => m.full_name), 'KADI SORO', 'PETIT ZIE'])];
  const routes = await p.evaluate(() => { const r = ['#/']; for (const [e, v] of Object.entries(window.Portail.espaces)) (v.nav || []).forEach(n => { if (n[0]) r.push('#/' + e + '/' + n[0]); }); return r; });
  const rapport = [];
  const actions = {
    'convoc': async () => { await p.evaluate(() => { location.hash = '#/site/b2-convocations'; }); await p.waitForTimeout(1800); await p.selectOption('#cv-projet', 'p2').catch(() => {}); await p.waitForTimeout(600); await p.$eval('#cv-mannequins input', c => c.click()).catch(() => {}); await p.$eval('#cv-enregistrer', x => x.click()).catch(() => {}); await p.waitForTimeout(2500); },
    'agenda-form': async () => { await p.evaluate(() => { location.hash = '#/site/b3c-agenda'; }); await p.waitForTimeout(2000); await p.click('[data-modifier="p1"]').catch(() => {}); await p.waitForTimeout(1200); },
    'fiche-mannequin': async () => { await p.evaluate(() => { location.hash = '#/site/b2-mannequins-publies/m0'; }); await p.waitForTimeout(2200); },
    'fiche-candidature': async () => { await p.evaluate(() => { location.hash = '#/site/b2-candidatures/c1'; }); await p.waitForTimeout(2200); },
    'fiche-paiements': async () => { await p.evaluate(() => { location.hash = '#/paiements/fiche/r1'; }); await p.waitForTimeout(2200); },
    'cachet-nouveau': async () => { await p.evaluate(() => { location.hash = '#/compta/cachets'; }); await p.waitForTimeout(2000); await p.click('[data-action="cachet-nouveau"]').catch(() => {}); await p.waitForTimeout(1500); }
  };
  for (const h of routes.concat(Object.keys(actions))) {
    if (actions[h]) await actions[h]();
    else { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(2200); }
    // ouvrir les blocs repliés
    await p.$$eval('#contenu details', ds => ds.forEach(d => { d.open = true; })).catch(() => {});
    const res = await p.evaluate((noms) => {
      const out = [];
      const vu = new Set();
      const walker = document.createTreeWalker(document.querySelector('#fenetre .boite') || document.querySelector('#contenu') || document.body, NodeFilter.SHOW_TEXT);
      let t;
      while ((t = walker.nextNode())) {
        const txt = t.textContent; const nom = noms.find(n => txt.toUpperCase().includes(n));
        if (!nom) continue;
        const el = t.parentElement; if (!el || el.closest('option, select, pre, textarea, script')) continue;
        if (!el.getClientRects().length) continue;
        const ligne = el.closest('li, tr, label, article, .ligne, .carte-mannequin, .convoc-personne, .convoc-reponse, .convoc-envoi, a, .tuile, .fiche, div') || el;
        // la photo est dans la même ligne : on remonte de quelques niveaux, sans sortir de la ligne
        let zone = ligne; for (let i = 0; i < 4 && zone.parentElement && !zone.querySelector('img, .vis'); i++) { if (zone.parentElement.textContent.length > 300) break; zone = zone.parentElement; }
        const vis = zone.querySelector('img, .vis');
        const cliquable = vis && (vis.closest('a, button, label, [data-action]'));
        const cle = nom + '|' + (vis ? (cliquable ? 'photo-cliquable' : 'photo-NON-cliquable') : 'SANS-PHOTO') + '|' + (el.closest('[class]') || el).className.toString().slice(0, 40);
        if (vu.has(cle)) continue; vu.add(cle);
        out.push({ nom, etat: vis ? (cliquable ? 'ok' : 'photo non cliquable') : 'SANS PHOTO', balise: el.tagName.toLowerCase(), classe: (el.className || '').toString().slice(0, 40), lien: !!el.closest('a'), extrait: (ligne.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90) });
      }
      return out;
    }, noms);
    const pb = res.filter(r => r.etat === 'SANS PHOTO');
    rapport.push({ h, total: res.length, pb });
    if (OUT) await p.screenshot({ path: OUT + '/' + h.replace(/[#/]+/g, '_') + '.png', fullPage: true }).catch(() => {});
    await p.evaluate(() => { const f = document.getElementById('fenetre'); if (f) f.innerHTML = ''; });
  }
  for (const r of rapport) ok(!r.pb.length, r.h + ' : ' + r.total + ' nom(s) de mannequin, tous avec leur photo' + r.pb.map((x) => ' | sans photo : ' + x.nom + ' (« ' + x.extrait.slice(0, 50) + ' »)').join(''));
  ok(rapport.length > 70 && rapport.reduce((n, r) => n + r.total, 0) > 150, 'parcours complet : ' + rapport.length + ' écrans, ' + rapport.reduce((n, r) => n + r.total, 0) + ' noms vérifiés');
  await b.close(); srv.kill();
  console.log(ko ? '❌ ' + ko + ' échec(s)' : 'Tout est bon.'); process.exit(ko ? 1 : 0);
})();
