#!/usr/bin/env node
// Vérificateur « 100 % écrit par le serveur » (phase 2, chantier W9 ; mission du 01/11/2026).
// Pour chaque page publique (FR + EN + fiches /book/nom) :
//  SSR   : le texte visible et les images visibles avec JavaScript doivent être déjà présents SANS
//          JavaScript (navigateur Playwright javaScriptEnabled:false), sauf exceptions justifiées
//          (tests/js-only-whitelist.json : seulement des éléments d'interaction).
//  UA    : la même page lue par 6 navigateurs/robots différents (sans JavaScript) a le même texte visible.
//  HEAD  : <title>, meta description, canonical (www, sans .html), og:title, og:image, JSON-LD.
//  CACHE : en-tête Cache-Control explicite des pages publiques (public, s-maxage) et x-ma2m-render: ssr.
// Une ligne par critère : « PASS|FAIL <ID> <mesure> ». Code de sortie 0 seulement si tout passe.
// Lecture seule : aucun formulaire envoyé, rien n'est écrit.
// Usage : node scripts/verify-dynamic.mjs --url https://www.maitreakessemodelmanagement.com [--seul /agenda]
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BASE = (arg('--url', 'https://www.maitreakessemodelmanagement.com')).replace(/\/$/, '');
const SEUL = arg('--seul', null);
const DETAIL = args.includes('--detail');  // toutes les lignes manquantes
const PARTAGE = arg('--partage', null);  // lien de partage Vercel (version d'essai protégée) : ses témoins servent à toutes les demandes
let TEMOINS = '';
const SEUIL_TEXTE = 0.98;   // part du texte visible (avec JS) déjà présente sans JS
const SEUIL_IMAGES = 0.95;  // part des images visibles (avec JS) déjà présentes sans JS

const PAGES = ['/', '/agenda', '/parcours', '/qui-sommes-nous', '/services', '/mannequins', '/actualites',
  '/evenements', '/partenaires', '/candidature', '/integrer-agence', '/contact', '/mentions-legales',
  '/politique-confidentialite'];
const AGENTS = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  safari_mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  curl: 'curl/8.5.0',
  vide: ''
};

let liste = [];
try { liste = JSON.parse(readFileSync(new URL('../tests/js-only-whitelist.json', import.meta.url), 'utf8')).textes || []; } catch { liste = []; }
const exceptions = new Set(liste.map((e) => e.texte));

const resultats = [];
const note = (ok, id, mesure) => { resultats.push(ok); console.log((ok ? 'PASS' : 'FAIL') + ' ' + id + ' ' + mesure); };

// texte visible (lignes) et images visibles de la page affichée
async function relever(page) {
  return page.evaluate(() => {
    // même photo, quelle que soit la copie (Cloudflare direct ou relais Vercel /book-photos/) ou la version (taille)
    const cle = (u) => decodeURIComponent(u.split('?')[0]).replace(/^https?:\/\/[^/]+/, '').replace(/^\/book-photos\//, '/').replace(/^\/_vercel\/image$/, '')
      .replace(/\/(miniatures|moyennes|petites)\//, '/').replace(/(-n\d+)?(-w)?\.(jpe?g|webp|png)$/i, '');
    const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const decouper = (t) => t.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length >= 3);
    // (textes tirés au hasard à chaque visite, data-hasard : nom en couverture, légende… comparés à part)
    const auHasardTexte = new Set([...document.querySelectorAll('[data-hasard]')].flatMap((e) => decouper(e.innerText || '')));
    const lignes = decouper(document.body ? document.body.innerText : '').filter((l) => !auHasardTexte.has(l));
    // (images tirées au hasard à chaque visite — mur de photos derrière le titre, couverture de l'accueil — :
    // comptées, pas comparées une à une)
    const auHasard = (i) => !!i.closest('.mur-titre, [data-hasard]') || i.id === 'couv-img';
    const hasard = [...document.images].filter((i) => auHasard(i) && visible(i)).length;
    const images = [...document.images].filter((i) => !auHasard(i) && visible(i) && (i.currentSrc || i.src) && !/^data:/.test(i.currentSrc || i.src))
      .map((i) => cle(i.currentSrc || i.src));
    // images de fond posées par le serveur (cartes, murs de photos) : comptées aussi
    const fonds = [...document.querySelectorAll('[style*="background-image"]')].filter(visible)
      .map((e) => (e.style.backgroundImage.match(/url\(["']?([^"')]+)/) || [])[1]).filter(Boolean).map(cle);
    return { lignes, images: [...new Set([...images, ...fonds])], hasard };
  });
}

// (3 essais : au tout premier appel, la base peut répondre trop lentement et la liste part sans ses cartes)
async function premiereFiche() {
  for (let essai = 0; essai < 3; essai++) {
    const r = await fetch(BASE + '/mannequins', { headers: TEMOINS ? { cookie: TEMOINS } : {} });
    const m = (await r.text()).match(/\/book\/([a-z0-9-]{1,80})/);
    if (m) return '/book/' + m[1];
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  return null;
}

const extraireTexte = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<(a|figcaption|span|p|strong)\b[^>]*\sdata-hasard[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
// (jetons qui changent à chaque réponse : empreintes, nonces, horodatages)
const stabiliser = (t) => t.replace(/\b[0-9a-f]{16,}\b/gi, 'X').replace(/\b\d{10,}\b/g, 'N');

async function main() {
  let routes = [...PAGES, ...PAGES.map((p) => '/en' + (p === '/' ? '/' : p))];

  const navigateur = await chromium.launch();
  const avecJs = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
  const sansJs = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
  if (PARTAGE) {
    const p0 = await avecJs.newPage(); await p0.goto(PARTAGE, { waitUntil: 'domcontentloaded' }); await p0.close();
    const temoins = await avecJs.cookies(); await sansJs.addCookies(temoins);
    TEMOINS = temoins.map((c) => c.name + '=' + c.value).join('; ');
  }
  const fiche = await premiereFiche();
  if (fiche) routes.push(fiche, '/en' + fiche); else note(false, 'W2-FICHE-TROUVEE', 'aucun lien /book/ dans /mannequins');
  if (SEUL) routes = routes.filter((r) => r === SEUL);
  // jamais d'écriture dans la base pendant la mesure (statistiques de visite, journal d'erreurs…)
  for (const c of [avecJs, sansJs]) {
    await c.route(/supabase\.co\/rest\/v1\//, (r) => (r.request().method() !== 'GET' && !/\/rest\/v1\/rpc\//.test(r.request().url()) ? r.abort() : r.continue()));
  }
  for (const route of routes) {
    const id = route.replace(/\//g, '_') || '_';
    try {
      // --- SSR : texte et images avec JS ⊆ sans JS
      // (UNE seule réponse du serveur, affichée avec puis sans JavaScript : deux demandes séparées pouvaient tomber sur
      // deux serveurs Vercel dont la mémoire de 3 minutes n'a pas le même âge, et différer sans défaut du site)
      const reponseUnique = await fetch(BASE + route, { headers: Object.assign({ 'user-agent': AGENTS.chrome, accept: 'text/html' }, TEMOINS ? { cookie: TEMOINS } : {}) });
      const corpsUnique = await reponseUnique.text();
      const entetesUniques = Object.fromEntries(reponseUnique.headers.entries());
      const servirUnique = (pg) => pg.route((u) => u.href.split('#')[0] === BASE + route || u.href === BASE + route + '/', (r) => r.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: corpsUnique }));
      const p1 = await avecJs.newPage();
      await servirUnique(p1);
      await p1.goto(BASE + route, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      await p1.waitForTimeout(2500);
      // (défilement : les images « au fil de l'écran » se chargent)
      await p1.evaluate(async () => { if (!document.body) return; for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); }).catch(() => {});
      await p1.waitForTimeout(1200).catch(() => {});
      const a = await relever(p1); await p1.close();
      const p2 = await sansJs.newPage();
      await servirUnique(p2);
      await p2.goto(BASE + route, { waitUntil: 'load', timeout: 60000 });
      const b = await relever(p2);
      const entetes = entetesUniques;
      const htmlSansJs = await p2.content(); await p2.close();
      const texteB = new Set(b.lignes);
      // (texte coupé à la largeur de l'écran par la page, terminé par « … » : présent en entier sans programme)
      const coupeTrouvee = (l) => /…$/.test(l) && b.lignes.some((x) => x.startsWith(l.replace(/[\s.,;:]*…$/, '')));
      const manquants = [...new Set(a.lignes)].filter((l) => !texteB.has(l) && !exceptions.has(l) && !coupeTrouvee(l));
      const totalA = new Set(a.lignes).size || 1;
      const partTexte = 1 - manquants.length / totalA;
      note(partTexte >= SEUIL_TEXTE, 'W2-SSR-TEXTE' + id, (partTexte * 100).toFixed(1) + '% (' + manquants.length + ' lignes JS seul' + (manquants.length ? ' ex: « ' + manquants.slice(0, 3).join(' | ').slice(0, 160) + ' »' : '') + ')');
      if (DETAIL) manquants.forEach((l) => console.log('   JS-SEUL ' + l.slice(0, 200)));
      const imgB = new Set(b.images);
      const imgManquantes = a.images.filter((u) => !imgB.has(u));
      const partImages = a.images.length ? 1 - imgManquantes.length / a.images.length : 1;
      note(partImages >= SEUIL_IMAGES && b.hasard >= a.hasard, 'W2-SSR-IMAGES' + id, (a.images.length - imgManquantes.length) + '/' + a.images.length + ' (' + imgManquantes.length + ' posées par JS' + (imgManquantes.length ? ' ex: ' + imgManquantes.slice(0, 2).join(' ').slice(0, 140) : '') + ') ; au hasard ' + b.hasard + '/' + a.hasard);
      // --- HEAD
      const tete = {
        title: /<title>[^<]{3,}<\/title>/i.test(htmlSansJs),
        description: /<meta[^>]+name="description"[^>]+content="[^"]{10,}/i.test(htmlSansJs),
        canonical: (htmlSansJs.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) || [])[1] || '',
        og_title: /property="og:title"/i.test(htmlSansJs),
        og_image: /property="og:image"/i.test(htmlSansJs),
        json_ld: /<script[^>]+application\/ld\+json/i.test(htmlSansJs)
      };
      const canonOk = tete.canonical.startsWith('https://www.') && !/\.html/.test(tete.canonical);
      const manqueTete = Object.entries(tete).filter(([k, v]) => k === 'canonical' ? !canonOk : !v).map(([k]) => k);
      note(!manqueTete.length, 'W2-HEAD' + id, manqueTete.length ? 'manque: ' + manqueTete.join(',') : 'complet');
      // --- CACHE
      const cc = entetes['cache-control'] || '';
      note(/public/.test(cc) && /s-maxage=\d+/.test(cc), 'W3-CACHE' + id, 'cache-control="' + cc + '"');
      note(entetes['x-ma2m-render'] === 'ssr', 'W3-RENDER' + id, 'x-ma2m-render=' + (entetes['x-ma2m-render'] || 'absent'));
      // --- UA : même texte visible pour tous
      const textes = {};
      for (const [nom, ua] of Object.entries(AGENTS)) {
        const r = await fetch(BASE + route, { headers: Object.assign({ 'user-agent': ua, accept: 'text/html' }, TEMOINS ? { cookie: TEMOINS } : {}), redirect: 'follow' });
        textes[nom] = stabiliser(extraireTexte(await r.text()));
      }
      const ref = textes.chrome;
      const differents = Object.entries(textes).filter(([, t]) => t !== ref).map(([n, t]) => n + '(' + t.length + ' vs ' + ref.length + ')');
      note(!differents.length, 'W2-UA' + id, differents.length ? 'différent: ' + differents.join(', ') : '6/6 identiques');
    } catch (e) {
      note(false, 'W2-ERREUR' + id, String(e && e.message || e).slice(0, 160));
    }
  }
  await navigateur.close();
  const ok = resultats.filter(Boolean).length;
  console.log('TOTAL ' + ok + '/' + resultats.length + ' PASS');
  process.exit(ok === resultats.length ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
