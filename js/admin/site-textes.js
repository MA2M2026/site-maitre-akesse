// Nouvelle Administration — « Textes des pages » (01/11/2026, étape C du site dynamique, décision de la
// propriétaire) : les textes de Services, Qui sommes-nous, Intégrer l'agence, Mentions légales et Politique
// de confidentialité se modifient ici, en français et en anglais, sans passer par le code.
//  - les textes modifiables sont ceux qui portent un repère data-texte dans la page (scripts/textes-pages.py) ;
//    le texte d'origine est lu dans la page elle-même (demandée sans retouche du serveur : en-tête
//    « x-ma2m-remplie », middleware.js) ;
//  - un texte remis comme à l'origine (ou vidé) = le texte d'origine de la page ;
//  - enregistrement : textes_pages_enregistrer (supabase-textes-pages.sql) ; le site l'affiche au plus
//    3 minutes après (mémoire du serveur).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const PAGE = 'b3c-textes-pages';
  const PAGES = [['services', 'Services'], ['qui-sommes-nous', 'Qui sommes-nous'], ['integrer-agence', 'Intégrer l’agence'],
    ['mentions-legales', 'Mentions légales'], ['politique-confidentialite', 'Politique de confidentialité']];
  const PAS_ACTIVE = '<div class="carte vide">Les textes des pages ne sont pas encore activés : collez une fois le fichier supabase-textes-pages.sql dans Supabase (SQL Editor › Run).</div>';
  const nonActive = P.pasActivee('textes_pages');
  const SORTES = { h1: 'Grand titre', h2: 'Titre', h3: 'Petit titre', h4: 'Petit titre', p: 'Paragraphe', li: 'Élément de liste', span: 'Titre', dt: 'Intitulé', dd: 'Texte', blockquote: 'Citation', figcaption: 'Légende' };
  let ouverte = null;  // { page, zones: [{ cle, sorte, fr, en }], enregistre: Map(cle → { fr, en }) }

  // texte d'un repère, tel que la page l'affiche (retours à la ligne gardés)
  const texteDe = (el) => {
    const copie = el.cloneNode(true);
    copie.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    return copie.textContent.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  };
  async function lirePage(chemin) {
    const r = await fetch(chemin, { headers: { 'x-ma2m-remplie': '1' }, cache: 'no-store' });
    if (!r.ok) throw new Error('Page introuvable (' + chemin + ').');
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const zones = new Map();
    doc.querySelectorAll('[data-texte]').forEach((el) => zones.set(el.getAttribute('data-texte'), { sorte: el.tagName.toLowerCase(), texte: texteDe(el) }));
    return zones;
  }
  async function charger(page) {
    const [fr, en, lignes] = await Promise.all([lirePage('/' + page), lirePage('/en/' + page),
      P.bd(sb.from('textes_pages').select('cle, fr, en').eq('page', page))]);
    const enregistre = new Map((lignes || []).map((l) => [l.cle, l]));
    const zones = [...fr.entries()].map(([cle, z]) => ({ cle, sorte: z.sorte, fr: z.texte, en: en.has(cle) ? en.get(cle).texte : '' }));
    ouverte = { page, zones, enregistre };
  }

  function choix() {
    return P.entete('Textes des pages') +
      '<p class="doux">Choisissez la page dont vous voulez changer les textes. Les photos, les boutons et les formulaires ne changent pas ; les textes avec un lien (adresse e-mail, téléphone…) restent écrits dans le code : demandez-les.</p>' +
      '<div class="tuiles-textes">' + PAGES.map(([p, nom]) => '<a class="carte tuile-texte" href="#/site/' + PAGE + '/' + p + '"><b>' + P.esc(nom) + '</b><span class="doux petit-texte">Modifier les textes →</span></a>').join('') + '</div>';
  }
  const lignes = (t) => Math.min(12, Math.max(2, Math.ceil(t.length / 70) + (t.match(/\n/g) || []).length));
  async function edition(page) {
    const nom = (PAGES.find(([p]) => p === page) || [])[1];
    if (!nom) return P.entete('Textes des pages') + '<div class="carte vide">Page inconnue. <a href="#/site/' + PAGE + '">Retour</a></div>';
    await charger(page);
    const z = ouverte.zones;
    if (!z.length) return P.entete(nom) + '<div class="carte vide">Aucun texte modifiable trouvé sur cette page.</div>';
    const modifies = z.filter((x) => ouverte.enregistre.has(x.cle)).length;
    return P.entete('Textes · ' + nom, '<a class="btn" href="#/site/' + PAGE + '">← Toutes les pages</a><a class="btn" href="/' + page + '" target="_blank" rel="noopener">Voir la page ↗</a>') +
      '<p class="doux">' + P.pluriel(z.length, 'texte modifiable', 'textes modifiables') + (modifies ? ' · ' + P.pluriel(modifies, 'déjà changé', 'déjà changés') : '') +
      '. Changez ce que vous voulez, puis « Enregistrer » en bas. Un texte remis comme avant (ou vidé) reprend le texte d’origine. Le site affiche les changements au plus 3 minutes après.</p>' +
      '<form class="f textes-page" data-form="textes-enregistrer">' + z.map((x) => {
        const e = ouverte.enregistre.get(x.cle) || {};
        const fr = e.fr || x.fr, en = e.en || x.en;
        return '<section class="carte texte-zone' + (/^h|span/.test(x.sorte) ? ' est-titre' : '') + '"><p class="sur-titre">' + P.esc(SORTES[x.sorte] || 'Texte') +
          (ouverte.enregistre.has(x.cle) ? ' ' + P.pastille('changé', 'ok') : '') + '</p>' +
          '<label class="fl" for="tx-' + x.cle + '-fr">Français<textarea id="tx-' + x.cle + '-fr" name="' + x.cle + '|fr" rows="' + lignes(fr) + '" maxlength="4000" placeholder="' + P.esc(x.fr) + '">' + P.esc(fr) + '</textarea></label>' +
          '<label class="fl" for="tx-' + x.cle + '-en">Anglais<textarea id="tx-' + x.cle + '-en" name="' + x.cle + '|en" rows="' + lignes(en) + '" maxlength="4000" placeholder="' + P.esc(x.en) + '">' + P.esc(en) + '</textarea></label></section>';
      }).join('') +
      '<div class="carte ligne textes-enregistrer"><button class="btn rouge" type="submit">Enregistrer les textes</button><p class="form-msg" id="tx-msg" role="status"></p></div></form>';
  }

  P.formulaires['textes-enregistrer'] = async (f) => {
    if (!ouverte) return;
    const nettoyer = (t) => String(t || '').replace(/\r/g, '').trim();
    // pour chaque texte : ce qui doit être enregistré (vide = texte d'origine), envoyé seulement s'il change
    const changes = [];
    ouverte.zones.forEach((x) => {
      const fr = nettoyer(f.get(x.cle + '|fr')), en = nettoyer(f.get(x.cle + '|en'));
      const voulu = { cle: x.cle, fr: fr === x.fr ? '' : fr, en: en === x.en ? '' : en };
      const avant = ouverte.enregistre.get(x.cle) || {};
      if (voulu.fr !== (avant.fr || '') || voulu.en !== (avant.en || '')) changes.push(voulu);
    });
    const m = document.getElementById('tx-msg');
    if (!changes.length) { m.className = 'form-msg'; m.textContent = 'Rien n’a changé.'; return; }
    m.className = 'form-msg ok'; m.textContent = 'Enregistrement…';
    try {
      await P.rpc('textes_pages_enregistrer', { p_page: ouverte.page, p_textes: changes });
    } catch (e) {
      m.className = 'form-msg err'; m.textContent = nonActive(e) ? 'Les textes des pages ne sont pas encore activés (fichier supabase-textes-pages.sql).' : 'Non enregistré : ' + P.erreurTexte(e);
      return;
    }
    P.message(P.pluriel(changes.length, 'texte enregistré', 'textes enregistrés') + ' : visible sur le site dans 3 minutes au plus.');
    return P.afficher();
  };

  P.espaces.site.pages[PAGE] = (m) => ((m && m[0]) ? edition(decodeURIComponent(m[0])) : Promise.resolve(choix())).catch((e) => {
    if (nonActive(e)) return P.entete('Textes des pages') + PAS_ACTIVE;
    throw e;
  });
})();
