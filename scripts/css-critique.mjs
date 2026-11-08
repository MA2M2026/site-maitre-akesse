#!/usr/bin/env node
// Styles du haut de l'écran écrits dans chaque page publique (chantier W7 « vitesse », 07/11/2026, choix B de la
// propriétaire). Avant : 8 à 11 feuilles de style (style.css : 185 Ko) bloquaient l'affichage de la grande photo
// (4,4 à 5,2 s sur téléphone 4G lente simulé). Maintenant : les règles qui servent au haut de l'écran (téléphone
// 390 × 844 ET ordinateur 1366 × 900) sont écrites dans la page, entre <style data-critique> … </style>, et les
// feuilles complètes arrivent ensuite sans bloquer (js/css-differe.js).
//
// Usage (après toute modification d'un fichier css/ ou de la structure d'une page publique) :
//   NODE_USE_ENV_PROXY=1 node scripts/serveur-local.mjs 8787 &   puis   node scripts/css-critique.mjs [--url http://127.0.0.1:8787]
// Le programme met à jour le bloc <style data-critique> et son empreinte dans le CSP de la page (style-src) ;
// relancer ensuite python3 scripts/versionner.py et python3 scripts/verifier-csp.py.
// Une règle est gardée si l'un de ses sélecteurs (sans :hover, ::before…) touche un élément visible dans le haut de
// l'écran (1,3 écran) ; @font-face, :root, html, body et les @keyframes utilisés sont toujours gardés.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// (Playwright est installé pour toute la machine : chargé comme dans les essais, par require)
const { chromium } = createRequire(import.meta.url)('playwright');
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iUrl = process.argv.indexOf('--url');
const BASE = iUrl > 0 ? process.argv[iUrl + 1] : 'http://127.0.0.1:8787';
// page publique → adresse à ouvrir (les fiches et le Book sont mesurés sur une vraie fiche)
export const PAGES = {
  // (actualités, événements, qui sommes-nous et parcours laissés de côté aussi : aucun gain mesuré ou page qui « saute »
  // un peu — comparaison du 07/11/2026, 5 mesures par page)
  // (accueil laissé de côté le 07/11/2026 : écran d'entrée animé et couverture au hasard, aucun gain mesuré — 4,6 s
  // avant, 5,1 s après ; à reprendre à part)
  'mannequins.html': '/mannequins', 'en/mannequins.html': '/en/mannequins',
  'mannequin.html': '/book/' + '__FICHE__', 'en/mannequin.html': '/en/book/' + '__FICHE__',
  'agenda.html': '/agenda', 'en/agenda.html': '/en/agenda',
  'partenaires.html': '/partenaires', 'en/partenaires.html': '/en/partenaires',
  'services.html': '/services', 'en/services.html': '/en/services', 'contact.html': '/contact', 'en/contact.html': '/en/contact',
  'candidature.html': '/candidature', 'en/candidature.html': '/en/candidature', 'integrer-agence.html': '/integrer-agence', 'en/integrer-agence.html': '/en/integrer-agence',
  'selection.html': '/selection', 'en/selection.html': '/en/selection',
  'mentions-legales.html': '/mentions-legales', 'en/mentions-legales.html': '/en/mentions-legales',
  'politique-confidentialite.html': '/politique-confidentialite', 'en/politique-confidentialite.html': '/en/politique-confidentialite'
};
const ECRANS = [{ width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 1366, height: 900 }];

// dans la page : règles utiles au haut de l'écran, dans l'ordre des feuilles (la cascade reste la même)
function extraire() {
  const limite = innerHeight * 1.3;
  // (un élément caché — menu fermé, fenêtre fermée — ne compte pas)
  const voit = (el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  // (un élément caché par les styles — menu fermé, fenêtre fermée — garde la règle qui le cache : sinon il s'affiche
  // en plein milieu de la page tant que la feuille complète n'est pas là, et la page « saute » à son arrivée)
  const racineCachee = (el) => !voit(el) && (!el.parentElement || voit(el.parentElement));
  const visible = (el) => { if (racineCachee(el)) return true; const r = el.getBoundingClientRect(); return r.top < limite && r.bottom > -1 && (r.width > 0 || r.height > 0) && voit(el); };
  // (lien « Aller au contenu », ajouté par js/confort.js et caché hors de l'écran : sans sa règle, il poussait toute la
  // page vers le bas le temps que la feuille complète arrive — 08/11/2026, saut mesuré sur presque toutes les pages)
  const toujours = /^(:root|html|body|\*|::selection|\*,\s*\*::before,\s*\*::after|\.lien-evitement|\.profil-hero-fullbleed\.cadrage-\d+ img)$/i;  // (+ cadrage automatique des grandes photos : toutes les fiches, pas seulement celle mesurée)
  const nettoyer = (s) => s.replace(/::?(before|after|placeholder|selection|marker|first-letter|first-line|-webkit-[\w-]+|-moz-[\w-]+)\b(\([^)]*\))?/gi, '')
    .replace(/:(hover|focus|focus-visible|focus-within|active|visited|link|target|checked|disabled|enabled|empty|invalid|valid|placeholder-shown|autofill|-webkit-autofill)\b/gi, '').trim() || '*';
  // (sélecteurs séparés par les virgules du premier niveau seulement : « :where(.a, .b) » reste entier)
  const morceaux = (sel) => { const l = []; let n = 0, cur = ''; for (const c of sel) { if (c === '(') n++; if (c === ')') n--; if (c === ',' && !n) { l.push(cur.trim()); cur = ''; } else cur += c; } if (cur.trim()) l.push(cur.trim()); return l; };
  // les seuls sélecteurs de la règle qui servent au haut de l'écran (les autres — ex. un bouton de l'Administration
  // dans une règle partagée — ne sont jamais recopiés dans la page publique)
  const touche = (sel) => morceaux(sel).filter((s) => {
    if (toujours.test(s)) return true;
    try { return [...document.querySelectorAll(nettoyer(s))].some(visible); } catch (e) { return false; }
  });
  const gardees = new Map();
  const parcourir = (regles) => {
    for (const r of regles) {
      if (r instanceof CSSStyleRule) { const t = touche(r.selectorText); if (t.length) gardees.set(r, t); }
      // (polices : l'alphabet latin seulement ; les accents rares « latin-ext » arrivent avec la feuille complète)
      // (polices : sur une page à grande photo, AUCUNE dans le haut de page — elles arrivent avec la feuille complète,
      // après la photo, pour ne pas lui prendre la bande passante ; sur une page de texte (pas de grande photo
      // annoncée), l'alphabet latin tout de suite : le texte est ce qu'on attend)
      else if (r instanceof CSSFontFaceRule) { if (window.__lcpTexte && !/latin-ext/.test(r.cssText)) gardees.set(r, []); }
      else if (r.cssRules) parcourir(r.cssRules);
    }
  };
  for (const f of document.styleSheets) { try { if (f.href && new URL(f.href).origin === location.origin) parcourir(f.cssRules); } catch (e) { /* feuille illisible */ } }
  return [...gardees].map(([r, sels]) => [r.cssText, sels]);
}

// texte final dans l'ordre des feuilles, avec leurs @media / @supports
function reconstruire(gardees) {
  const garde = new Map(gardees);
  const sortie = [];
  const animations = new Set();
  // (08/11/2026) un raccourci écrit avec une variable (« background: linear-gradient(… var(--x) …) ») n'est pas recopié
  // par le navigateur dans le texte de la règle (ses morceaux restent vides) : il est remis tel qu'écrit, en tête, et les
  // morceaux vides (« background-image: ; ») sont retirés — avant, le reflet du logo et d'autres fonds manquaient
  // jusqu'à l'arrivée de la feuille complète, et le validateur W3C comptait des erreurs
  const RACCOURCIS = ['background', 'mask', '-webkit-mask', 'font', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'outline',
    'animation', 'transition', 'margin', 'padding', 'inset', 'gap', 'grid-template', 'grid-area', 'flex', 'list-style', 'text-decoration', 'border-radius',
    'columns', 'place-items', 'place-content', 'overflow', 'border-color', 'border-width', 'border-style'];
  // (texte d'origine des feuilles, pour retrouver un raccourci que le navigateur ne rend pas du tout)
  const sources = window.__sourcesCss || {};
  const depuisSource = (r, sh) => {
    const src = sources[r.parentStyleSheet && r.parentStyleSheet.href] || '';
    const sel = r.selectorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
    const bloc = (src.match(new RegExp('(?:^|[}\\s])' + sel + '\\s*\\{([^}]*)\\}')) || [])[1] || '';
    const v = (bloc.match(new RegExp('(?:^|[;\\s])' + sh.replace(/-/g, '\\-') + '\\s*:\\s*([^;]+)')) || [])[1];
    return v ? v.trim().replace(/url\((['"]?)\.\.\//g, 'url($1/') : '';
  };
  const complet = (st, r) => {
    const vides = (st.cssText.match(/(?<=^|;)\s*([\w-]+):\s*;/g) || []).map((x) => x.replace(/[:;\s]/g, ''));
    let t = st.cssText.replace(/(?<=^|;)\s*[\w-]+:\s*;/g, '').trim();
    // (« animation: none » réécrit par le navigateur en « auto ease 0s 1 normal none running none », refusé par le
    // validateur W3C : remis sous sa forme courte, identique)
    t = t.replace(/animation:\s*auto ease 0s 1 normal none running none(\s*!important)?;/g, 'animation: none$1;');
    // raccourci que le navigateur ne rend pas (ni dans le texte, ni par getPropertyValue) : pris dans la feuille d'origine
    const perdus = RACCOURCIS.filter((sh) => vides.some((v) => v.indexOf(sh + '-') === 0) && !st.getPropertyValue(sh));
    const repris = perdus.map((sh) => [sh, depuisSource(r, sh)]).filter((x) => x[1]).map(([sh, v]) => sh + ': ' + v + ';');
    const ajouts = RACCOURCIS.filter((sh) => { const v = st.getPropertyValue(sh); return v && /var\(/.test(v) && !new RegExp('(^|[;\\s])' + sh.replace(/-/g, '\\-') + '\\s*:').test(t); })
      .map((sh) => sh + ': ' + st.getPropertyValue(sh) + (st.getPropertyPriority(sh) ? ' !important' : '') + ';');
    return (repris.concat(ajouts).join(' ') + (repris.length || ajouts.length ? ' ' : '') + t).trim();
  };
  const parcourir = (regles) => regles.map((r) => {
    if (r instanceof CSSStyleRule || r instanceof CSSFontFaceRule) {
      if (!garde.has(r.cssText)) return '';
      (r.style && (r.style.animationName || r.style.animation) ? (r.style.animationName || r.style.animation).split(/[\s,]+/) : []).forEach((n) => animations.add(n));
      const sels = garde.get(r.cssText);
      return r instanceof CSSStyleRule && sels.length ? sels.join(', ') + ' { ' + complet(r.style, r) + ' }' : r.cssText;
    }
    if (r instanceof CSSMediaRule) { const d = parcourir([...r.cssRules]).join(''); return d ? '@media ' + r.conditionText + '{' + d + '}' : ''; }
    if (r instanceof CSSSupportsRule) { const d = parcourir([...r.cssRules]).join(''); return d ? '@supports ' + r.conditionText + '{' + d + '}' : ''; }
    return '';
  });
  const images = [];
  // (une feuille ajoutée deux fois — par ce programme et par js/css-differe.js — n'est lue qu'une fois)
  const vues = new Set();
  const feuilles = [...document.styleSheets].filter((f) => { try { if (!f.href || new URL(f.href).origin !== location.origin || vues.has(f.href)) return false; vues.add(f.href); return true; } catch (e) { return false; } });
  for (const f of feuilles) {
    try { sortie.push(parcourir([...f.cssRules]).join('')); } catch (e) { /* feuille illisible */ }
  }
  for (const f of feuilles) {
    try { for (const r of f.cssRules) if (r instanceof CSSKeyframesRule && animations.has(r.name)) images.push(r.cssText); } catch (e) { /* idem */ }
  }
  let texte = sortie.join('') + images.join('');
  // variables (--nom) : seulement celles dont le texte gardé se sert (de proche en proche)
  const declarees = {};
  // (08/11/2026 : « .btn--principal:hover { … » était lu comme la variable « --principal » et effacé, cassant la règle)
  const DECL = /(?<=[{;]\s*)(--[\w-]+)\s*:\s*([^;}]*)/g;
  texte.replace(DECL, (m, n, v) => { declarees[n] = (declarees[n] || '') + v; return m; });
  const utiles = new Set();
  const suivre = (t) => t.replace(/var\((--[\w-]+)/g, (m, n) => { if (!utiles.has(n)) { utiles.add(n); suivre(declarees[n] || ''); } return m; });
  suivre(texte.replace(DECL, ''));
  texte = texte.replace(/(?<=[{;]\s*)(--[\w-]+)\s*:\s*[^;}]*;?\s*/g, (m, n) => (utiles.has(n) ? m : '')).replace(/[^{}]+\{\s*\}/g, '');
  // (adresses relatives des feuilles css/… : rendues absolues depuis la racine, la page peut être /en/ ou /book/…)
  return texte.replace(/url\((['"]?)(?!data:|https?:|\/)([^'")]+)\1\)/g, (m, q, u) => 'url(' + q + '/css/' + u.replace(/^\.\//, '') + q + ')')
    .replace(/url\((['"]?)\/css\/\.\.\//g, 'url($1/');
}

const empreinte = (t) => "'sha256-" + crypto.createHash('sha256').update(t, 'utf8').digest('base64') + "'";

async function main() {
  const navigateur = await chromium.launch();
  // une vraie fiche, prise dans la liste du Book
  const html = await (await fetch(BASE + '/mannequins')).text();
  const fiche = (html.match(/href="\/book\/([^"]+)"/) || [])[1];
  if (!fiche) throw new Error('aucune fiche trouvée dans /mannequins');
  // (08/11/2026, phase 3 V1) « Ma sélection » mesurée VIDE et REMPLIE (2 profils) : préparée seulement vide, la page
  // d'un recruteur avec des profils choisis arrivait sans la mise en forme du formulaire et sautait (CLS 1,3 mesuré)
  const choisis = [...html.matchAll(/class="btn-selection[^"]*" data-id="([0-9a-f-]{36})"/g)].slice(0, 2).map((m) => m[1]);
  const seules = process.argv.slice(2).filter((a) => /\.html$/.test(a));
  let total = 0;
  for (const [fichier, adresse] of Object.entries(PAGES)) {
    if (seules.length && !seules.includes(fichier)) continue;
    const gardees = new Map();  // texte de la règle → sélecteurs utiles (réunis sur téléphone et ordinateur)
    let texte = '', lcpTexte = false;
    const etats = /selection\.html$/.test(fichier) ? [[], choisis] : [null];
    for (const ecran of ECRANS) for (const etat of etats) {
      const ctx = await navigateur.newContext({ viewport: { width: ecran.width, height: ecran.height }, isMobile: !!ecran.isMobile, hasTouch: !!ecran.hasTouch, serviceWorkers: 'block' });
      if (etat) await ctx.addInitScript((ids) => { try { localStorage.setItem('ma2m_selection', JSON.stringify(ids)); } catch (e) { /* */ } }, etat);
      const p = await ctx.newPage();
      // (page ouverte SANS le bloc déjà écrit : on repart des seules feuilles)
      await p.goto(BASE + adresse.replace('__FICHE__', fiche), { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      await p.evaluate(() => { document.querySelectorAll('style[data-critique]').forEach((s) => s.remove()); const n = document.getElementById('css-complet'); if (n) n.insertAdjacentHTML('afterend', n.textContent); });
      await p.waitForTimeout(800);
      // (plus grand élément du haut de page : un texte → polices gardées ; une image → polices après)
      if (ecran === ECRANS[0]) lcpTexte = await p.evaluate(() => new Promise((ok) => new PerformanceObserver((l) => { const e = l.getEntries().pop(); ok(!!(e && e.element && !e.url)); }).observe({ type: 'largest-contentful-paint', buffered: true })));
      await p.evaluate((t) => { window.__lcpTexte = t; }, lcpTexte);
      (await p.evaluate(extraire)).forEach(([r, sels]) => { const deja = gardees.get(r) || []; gardees.set(r, deja.concat(sels.filter((x) => !deja.includes(x)))); });
      if (ecran === ECRANS[ECRANS.length - 1] && etat === etats[etats.length - 1]) {
        await p.evaluate(async () => { window.__sourcesCss = {}; for (const f of document.styleSheets) { if (f.href && new URL(f.href).origin === location.origin && !window.__sourcesCss[f.href]) window.__sourcesCss[f.href] = await (await fetch(f.href)).text(); } });
        texte = await p.evaluate(reconstruire, [...gardees]);
      }
      await ctx.close();
    }
    const f = path.join(RACINE, fichier);
    let page = fs.readFileSync(f, 'utf8');
    const ancien = (page.match(/<style data-critique>([\s\S]*?)<\/style>/) || [])[1];
    const bloc = '<style data-critique>' + texte + '</style>';
    if (ancien !== undefined) page = page.replace(/<style data-critique>[\s\S]*?<\/style>/, () => bloc);
    else page = page.replace(/(<link rel="stylesheet" href="(?:\.\.\/|\/)?css\/polices\.css[^>]*>)/, (m) => bloc + '\n' + m);
    // feuilles complètes : listées dans <noscript id="css-complet"> (lues telles quelles sans JavaScript), ajoutées par
    // js/css-differe.js après la grande photo (une seule fois par page)
    if (!/id="css-complet"/.test(page)) {
      const liens = [];
      let prefixe = '', place = -1;
      page = page.replace(/<link rel="stylesheet" href="((?:\.\.\/|\/)?)(css\/[^"]+)">\n?/g, (m, pre, h, i) => { liens.push(m.trim()); prefixe = pre; if (place < 0) place = i; return ''; });
      page = page.slice(0, place) + '<noscript id="css-complet">' + liens.join('') + '</noscript>\n<script src="' + prefixe + 'js/css-differe.js" async></script>\n' + page.slice(place);
    }
    if (!page.includes(bloc)) throw new Error(fichier + ' : emplacement du bloc introuvable');
    // empreinte dans le CSP de la page (l'ancienne retirée)
    page = page.replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*style-src )([^;"]*)/, (m, debut, liste) => {
      const sans = ancien !== undefined ? liste.replace(' ' + empreinte(ancien), '') : liste;
      return debut + sans + ' ' + empreinte(texte);
    });
    fs.writeFileSync(f, page);
    total += texte.length;
    console.log(fichier.padEnd(36) + (texte.length / 1024).toFixed(1) + ' Ko' + (lcpTexte ? ' (texte : polices gardées)' : ''));
  }
  await navigateur.close();
  console.log('total ' + (total / 1024).toFixed(0) + ' Ko');
}
main().catch((e) => { console.error(e); process.exit(1); });
