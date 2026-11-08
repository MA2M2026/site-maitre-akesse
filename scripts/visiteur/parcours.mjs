// Phase 3 V1 — le site vu par de vrais visiteurs (08/11/2026). Six parcours (styliste, jeune mannequin, recruteur,
// promoteur, marque partenaire, directeur artistique), chacun sur iPhone, Android, iPad et ordinateur, en 4G lente
// (et 3G rapide pour le téléphone), FR ou EN. Pour chaque étape : critère de réussite, capture d'écran, erreurs de la
// page, requêtes en échec, LCP / CLS / TTFB, poids des images.
// LECTURE SEULE : aucun formulaire n'est envoyé ; toute écriture vers la base, les fonctions du serveur, l'envoi
// d'e-mails, la mesure d'audience et le suivi d'erreurs est BLOQUÉE (rien n'est écrit sur le vrai site) ; les seules
// fonctions de la base laissées passer sont des lectures publiques (liste LECTURES ci-dessous).
// iPhone et iPad : moteur Chrome en mode iPhone / iPad (WebKit ne peut pas être téléchargé dans cet environnement).
//   NODE_USE_ENV_PROXY=1 node scripts/visiteur/parcours.mjs [--url …] [--captures dossier] [--json sortie.json] [--seul styliste]
import fs from 'fs';
import { createRequire } from 'module';
// (Playwright installé hors du dépôt : chargé comme les essais visiteur, par require)
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'https://www.maitreakessemodelmanagement.com').replace(/\/$/, '');
const CAPTURES = arg('--captures', null), SORTIE = arg('--json', null), SEUL = arg('--seul', null);
if (CAPTURES) fs.mkdirSync(CAPTURES, { recursive: true });
// lectures publiques permises (fonctions de la base appelées par les pages publiques pour LIRE)
const LECTURES = /^(photos_couverture_mannequins|photos_couverture_petites|vitrine_eligibles|agenda_public|mannequin_du_mois|profil_public|projets_publics|traductions_lire|textes_pages_lire|stats_publiques|evenements_publics|actualites_publiques|accord_parent_lire|places_lire|casting_projets_publics|parcours_public)/;
const RESEAUX = {
  '4G lente': { latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 },
  '3G rapide': { latency: 563, downloadThroughput: 1.44 * 1024 * 1024 / 8, uploadThroughput: 675 * 1024 / 8 }
};
const APPAREILS = [
  ['iPhone', devices['iPhone 14'], ['4G lente', '3G rapide']],
  ['Android', devices['Pixel 7'], ['4G lente']],
  ['iPad', devices['iPad (gen 7)'], ['4G lente']],
  ['ordinateur', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' }, ['4G lente']]
];

// ---- parcours : étapes [nom, adresse, vérification(page) → true/texte d'échec] ----
const premiereFiche = async (p) => p.$eval('#grille .medaillon-carte a[href]', (a) => a.getAttribute('href'));
const PARCOURS = {
  styliste: (en) => [
    ['accueil', en ? '/en/' : '/', async (p) => (await p.$('a[href*="mannequins"]')) ? true : 'pas de lien vers le Book'],
    ['The Book', en ? '/en/mannequins' : '/mannequins', async (p) => (await p.$$('#grille .medaillon-carte')).length >= 10 || 'moins de 10 profils'],
    ['fiche', async (p) => premiereFiche(p), async (p) => (await p.$$('#fiche-contact a.fiche-contact-tuile[href^="tel:"], #fiche-contact a.fiche-contact-tuile[href^="mailto:"]')).length >= 2 || 'contacts absents de la fiche']
  ],
  'jeune mannequin': (en) => [
    ['accueil', en ? '/en/' : '/', async (p) => (await p.$('a[href*="integrer-agence"], a[href*="candidature"]')) ? true : 'pas de lien pour postuler'],
    ['qui sommes-nous', en ? '/en/qui-sommes-nous' : '/qui-sommes-nous', async (p) => (await p.textContent('main')).length > 500 || 'page vide'],
    ['intégrer l’agence', en ? '/en/integrer-agence' : '/integrer-agence', async (p) => (await p.$$('#form-casting input, #form-casting select')).length >= 4 || 'formulaire absent']
  ],
  recruteur: (en) => [
    ['The Book', en ? '/en/mannequins' : '/mannequins', async (p) => (await p.$$('#grille .medaillon-carte')).length >= 10 || 'moins de 10 profils'],
    ['filtre hommes', null, async (p) => { const avant = (await p.$$('#grille .medaillon-carte')).length; await p.click('.filtre-btn[data-cat="homme"]'); await p.waitForTimeout(800); const apres = (await p.$$('#grille .medaillon-carte')).length; return (apres > 0 && apres < avant) || 'le filtre ne change rien (' + avant + ' → ' + apres + ')'; }],
    ['sélection de 2 profils', null, async (p) => { // (la grille se redessine après chaque « + » : bouton relu à chaque fois)
      if ((await p.$$('#grille .btn-selection')).length < 2) return 'pas de bouton +';
      await p.click('#grille .medaillon-carte:nth-child(1) .btn-selection'); await p.waitForTimeout(600);
      await p.click('#grille .medaillon-carte:nth-child(2) .btn-selection'); await p.waitForTimeout(600); return (await p.$$('#grille .btn-selection.est-selectionne')).length === 2 || 'sélection pas prise en compte'; }],
    ['page sélection', en ? '/en/selection' : '/selection', async (p) => { await p.waitForTimeout(1500); const n = await p.$$eval('button', (l) => l.filter((x) => /^(Retirer|Remove)$/.test(x.textContent.trim())).length); return n === 2 || 'sélection : ' + n + ' profil(s) au lieu de 2'; }]
  ],
  promoteur: (en) => [
    ['agenda', en ? '/en/agenda' : '/agenda', async (p) => (await p.textContent('main')).length > 300 || 'agenda vide'],
    ['événements', en ? '/en/evenements' : '/evenements', async (p) => (await p.textContent('main')).length > 200 || 'page vide'],
    ['contact', en ? '/en/contact' : '/contact', async (p) => (await p.$('#form-contact #message')) ? true : 'formulaire de contact absent']
  ],
  'marque partenaire': (en) => [
    ['services', en ? '/en/services' : '/services', async (p) => (await p.textContent('main')).length > 300 || 'page vide'],
    ['partenaires', en ? '/en/partenaires' : '/partenaires', async (p) => (await p.textContent('main')).length > 100 || 'page vide'],
    ['message (sans l’envoyer)', en ? '/en/contact' : '/contact', async (p) => { await p.fill('#nom', 'Essai Lecture Seule'); await p.fill('#email', 'essai@exemple.invalid'); await p.fill('#message', 'Essai automatique, jamais envoyé.'); return (await p.$('#form-contact [type=submit], #form-contact button')) ? true : 'bouton d’envoi absent'; }]
  ],
  'directeur artistique': (en) => [
    ['The Book (photos)', en ? '/en/mannequins' : '/mannequins', async (p) => { await p.waitForTimeout(1500); const n = await p.$$eval('#grille .medaillon-carte img', (l) => l.slice(0, 6).filter((i) => i.complete && i.naturalWidth > 0).length); return n >= 6 || 'photos du haut pas affichées (' + n + '/6)'; }],
    ['fiche (photos)', async (p) => premiereFiche(p), async (p) => { await p.waitForTimeout(1500); const n = await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth > 0 && i.getBoundingClientRect().width > 200).length); return n >= 1 || 'aucune grande photo affichée'; }]
  ]
};

const resultats = [];
const b = await chromium.launch();
for (const [nomParcours, fabrique] of Object.entries(PARCOURS)) {
  if (SEUL && SEUL !== nomParcours) continue;
  for (const [nomApp, profil, reseaux] of APPAREILS) {
    for (const reseau of reseaux) {
      const en = nomApp === 'iPad' || (nomApp === 'ordinateur' && nomParcours === 'recruteur');  // (une partie des parcours en anglais)
      const ctx = await b.newContext({ ...profil, locale: en ? 'en-US' : 'fr-CI', serviceWorkers: 'block' });
      await ctx.addInitScript(() => {
        window.__v = { lcp: 0, cls: 0 };
        try { new PerformanceObserver((l) => { const e = l.getEntries().pop(); if (e) window.__v.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) { /* */ }
        try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__v.cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* */ }
        try { localStorage.setItem('ma2m_cookies', 'non'); } catch (e) { /* */ }
      });
      const bloquees = [];
      await ctx.route('**/*', (route) => {
        const r = route.request(), u = r.url(), m = r.method();
        if (/googletagmanager|google-analytics|analytics\.google|sentry|emailjs|challenges\.cloudflare/.test(u)) return route.abort();
        if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
          const rpc = (u.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/) || [])[1];
          if (rpc && LECTURES.test(rpc)) return route.continue();
          bloquees.push(m + ' ' + u.replace(/\?.*$/, '').replace(/^https:\/\/[^/]+/, ''));
          return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        return route.continue();
      });
      const p = await ctx.newPage();
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, ...RESEAUX[reseau] });
      const erreurs = [], echecs = []; let octetsImages = 0;
      p.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
      p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED|ERR_ABORTED/.test(m.text())) erreurs.push('console : ' + m.text().slice(0, 160)); });
      p.on('response', async (r) => {
        const u = r.url();
        if (r.status() >= 400 && !/\/rest\/v1\/rpc\//.test(u)) echecs.push(r.status() + ' ' + u.replace(/^https:\/\/[^/]+/, '').slice(0, 120));
        if (r.request().resourceType() === 'image') { const l = Number(r.headers()['content-length'] || 0); octetsImages += l; }
      });
      const etapes = [];
      for (const [nomEtape, adresse, verifier] of fabrique(en)) {
        const t0 = Date.now(); let ok = false, raison = '', mesures = {};
        try {
          let a = typeof adresse === 'function' ? await adresse(p) : adresse;
          if (a) {
            const rep = await p.goto(new URL(a, BASE + '/').href, { waitUntil: 'load', timeout: 60000 });
            if (!rep || rep.status() >= 400) throw new Error('réponse ' + (rep && rep.status()));
            await p.waitForTimeout(1200);
            mesures = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { lcp: Math.round(window.__v.lcp), cls: +window.__v.cls.toFixed(3), ttfb: n ? Math.round(n.responseStart) : null }; });
          }
          const v = await verifier(p);
          ok = v === true; raison = ok ? '' : String(v);
        } catch (e) { raison = 'erreur : ' + String(e.message || e).split('\n')[0].slice(0, 140); }
        const capture = CAPTURES ? (CAPTURES + '/' + [nomParcours, nomApp, reseau, en ? 'en' : 'fr', nomEtape].join('_').replace(/[^a-z0-9_é’-]+/gi, '-') + '.png') : null;
        if (capture) await p.screenshot({ path: capture }).catch(() => {});
        etapes.push({ etape: nomEtape, ok, raison, duree: Date.now() - t0, ...mesures, capture });
      }
      const r = { parcours: nomParcours, appareil: nomApp, reseau, langue: en ? 'en' : 'fr', ok: etapes.every((e) => e.ok) && !erreurs.length, etapes, erreurs: [...new Set(erreurs)], echecs: [...new Set(echecs)], bloquees: [...new Set(bloquees)], octetsImages };
      resultats.push(r);
      console.log((r.ok ? 'PASS ' : 'FAIL ') + [nomParcours, nomApp, reseau, r.langue].join(' | ') + ' — ' + etapes.map((e) => (e.ok ? '✓' : '✗') + ' ' + e.etape + (e.lcp ? ' (LCP ' + (e.lcp / 1000).toFixed(1) + ' s, CLS ' + e.cls + ')' : '') + (e.ok ? '' : ' : ' + e.raison)).join(' · ') + (erreurs.length ? ' · erreurs : ' + r.erreurs.join(' / ') : '') + (r.echecs.length ? ' · échecs : ' + r.echecs.join(' / ') : ''));
      await ctx.close();
    }
  }
}
await b.close();
if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify({ base: BASE, date: new Date().toISOString(), resultats }, null, 1));
const ko = resultats.filter((r) => !r.ok).length;
console.log('TOTAL ' + (resultats.length - ko) + '/' + resultats.length + ' parcours réussis');
process.exit(ko ? 1 : 0);
