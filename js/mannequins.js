// Page « Nos mannequins » / « Our models » : un seul script pour le français et l'anglais
// (11/10/2026 : avant, deux copies js/mannequins.js et js/mannequins-en.js).
let tousLesProfils = [];
let categorieActive = 'tous';

async function chargerMannequins() {
  const vide = document.getElementById('vide');
  const grille = document.getElementById('grille');
  mannequinDuMois(grille).catch(() => { /* pas encore activée ou base injoignable : pas de bandeau */ });
  try { await afficherMannequins(vide); } finally { libererPlaceListe(grille, listeComplete()); }
}
// Bandeau « Mannequin du mois » (chantier 14, 01/11/2026 ; supabase-mannequin-du-mois.sql) : seulement si
// sa fiche est publiée au Book (la base ne renvoie rien sinon)
async function mannequinDuMois(grille) {
  if (typeof sb === 'undefined' || !sb || !grille || document.querySelector('.mannequin-du-mois')) return;  // (déjà posé par le serveur)
  const serveur = typeof donneesServeur === 'function' ? donneesServeur('book-donnees') : null;
  const data = serveur && 'mdm' in serveur ? serveur.mdm : (await sb.rpc('mannequin_du_mois_actuelle')).data;
  const html = window.RenduBook.bandeauMdm(data, EN);  // (même dessin que le serveur : js/rendu-book.js)
  if (html) grille.insertAdjacentHTML('beforebegin', html);
}
// Recherche intelligente (12/11/2026, demande de la propriétaire : « dans la barre on peut chercher par nom, par
// taille, par teint… au lieu d'appuyer sur des filtres qui prennent trop de place ») : UNE barre qui comprend
//  - la taille : « 1m75 », « 1,75 », « 175 », « ms75 » (à 2 cm près), « plus de 1m80 », « moins de 1m70 » ;
//  - les mensurations : « 86-62-90 », « poitrine 88 », « tour de taille 62 », « bassin 97 », « pointure 40 » ;
//  - la taille de vêtements « S », « M », « taille L » ; le niveau « new face », « main board » ; « femme », « homme » ;
//  - « yeux noirs », « cheveux bruns », « disponible » ;
//  - et tout autre mot dans le nom, la ville, le teint, les langues, les yeux ou les cheveux (« Cocody », « ébène »…).
// Chaque critère s'utilise seul ; un critère tapé écarte les fiches où cette mesure manque.
const sansAccents = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Teints présents dans le Book (français et anglais, sans accents, les plus longs d'abord) : remplis au chargement
let teintsConnus = [];
const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'a', 'au', 'en', 'cm', 'm', 'the', 'and', 'with', 'of', 'avec', 'qui', 'fait', 'font', 'taille']);
function comprendreRecherche(texte) {
  const c = { mots: [] };
  // (« 1,75 » / « 1.75 » d'abord réunis en « 1.75 », puis les virgules restantes séparent les mots)
  let t = ' ' + sansAccents(texte).replace(/(\d)\s*[.,]\s*(\d)/g, '$1.$2').replace(/[,;]/g, ' ') + ' ';
  const prendre = (re, faire) => { t = t.replace(re, (...m) => { faire(m); return ' '; }); };
  prendre(/\b(\d{2,3})\s*[-\/]\s*(\d{2,3})\s*[-\/]\s*(\d{2,3})\b/g, (m) => { c.poitrine = m[1]; c.tourTaille = m[2]; c.bassin = m[3]; });
  prendre(/\b(?:tour de )?poitrine\s*:?\s*(\d{2,3})\b|\bchest\s*:?\s*(\d{2,3})\b/g, (m) => { c.poitrine = m[1] || m[2]; });
  prendre(/\btour de taille\s*:?\s*(\d{2,3})\b|\bwaist\s*:?\s*(\d{2,3})\b/g, (m) => { c.tourTaille = m[1] || m[2]; });
  prendre(/\b(?:tour de )?(?:bassin|hanches?|hips?)\s*:?\s*(\d{2,3})\b/g, (m) => { c.bassin = m[1]; });
  prendre(/\b(?:pointure|shoes?|p)\s*:?\s*(\d{2})\b/g, (m) => { c.pointure = m[1]; });
  // (« 1,75 m », « 1.75m », « +1m85 » compris aussi ; le « m » de l'unité n'est pas pris pour la taille de vêtement M)
  prendre(/(?<=\s)(plus de|au moins|minimum|min|over|at least|\+)?\s*(moins de|maximum|max|under)?\s*(?:1\s*m\s*(\d{2})|1\.(\d{2})|ms\s?(\d{2})|(1[4-9]\d|20\d))\s*(?:cm|m)?(?=\s)/g, (m) => {
    const cm = m[3] ? 100 + Number(m[3]) : m[4] ? 100 + Number(m[4]) : m[5] ? 100 + Number(m[5]) : Number(m[6]);
    if (m[1]) c.tailleMin = cm; else if (m[2]) c.tailleMax = cm; else { c.tailleMin = cm - 2; c.tailleMax = cm + 2; }
  });
  prendre(/\bnew\s?faces?\b/g, () => { c.niveau = 'New Face'; });
  prendre(/\bmain\s?board\b/g, () => { c.niveau = 'Professionnel'; });
  prendre(/\b(femmes?|filles?|women|woman|female|girls?)\b/g, () => { c.categorie = 'femme'; });
  // (pas « man » : Man est aussi une ville de Côte d'Ivoire)
  prendre(/\b(hommes?|garcons?|men|male|boys?)\b/g, () => { c.categorie = 'homme'; });
  prendre(/\bdisponibles?\b|\bavailable\b/g, () => { c.disponibilite = 'immediate'; });
  prendre(/\b(?:yeux|eyes)\s+([a-z]+)/g, (m) => { c.yeux = m[1].replace(/s$/, ''); });
  prendre(/\b(?:cheveux|hair)\s+([a-z]+)/g, (m) => { c.cheveux = m[1].replace(/s$/, ''); });
  // ordre anglais : « brown eyes », « black hair »
  prendre(/\b([a-z]+)[\s-]+(?:eyes|eyed)\b/g, (m) => { c.yeux = m[1]; });
  prendre(/\b([a-z]+)[\s-]+hair(?:ed)?\b/g, (m) => { c.cheveux = m[1]; });
  // teint : la valeur exacte de la fiche (« Foncée » ne donne pas « Très foncée »), les plus longues d'abord
  teintsConnus.forEach((v) => prendre(new RegExp('(?<=\\s)' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=\\s)', 'g'), () => { c.teint = v; }));
  prendre(/\b(?:taille\s+|size\s+)?(xxs|xs|s|m|l|xl|xxl)\b(?=\s)/g, (m) => { c.vetement = m[1].toUpperCase(); });
  c.mots = t.split(/\s+/).filter((w) => w.length > 1 && !MOTS_VIDES.has(w));
  return c;
}
const rechercheTapee = () => document.getElementById('f-recherche').value.trim();
// Aucun filtre actif (le navigateur peut remettre la recherche tapée avant un retour en arrière)
function listeComplete() { return categorieActive === 'tous' && !rechercheTapee(); }

// The Book préparé par le serveur (middleware.js, 01/11/2026) : liste et photos déjà dans la page
function bookServeur() {
  const d = donneesServeur('book-donnees');  // (js/app.js)
  return d && Array.isArray(d.profils) && Array.isArray(d.photos) ? d : null;
}
async function lireBook(vide) {
  const serveur = bookServeur();
  if (serveur) return serveur;
  if (!sb) {
    // "sb" peut valoir null sur une connexion instable (échec de chargement de
    // la bibliothèque Supabase, servie depuis un CDN) — message clair plutôt
    // que de laisser croire qu'aucun profil ne correspond aux critères.
    vide.textContent = EN ? 'Failed to load the Book (unstable connection?). Please reload the page.' : 'Le chargement du Book a échoué (connexion instable ?). Rechargez la page.';
    vide.style.display = 'block';
    return null;
  }
  const { data: profils, error } = await sb
    .from('model_profiles')
    .select('id, slug, full_name, city, category, height_cm, chest_cm, waist_cm, hips_cm, shoe_size, eye_color, hair_color, languages, carnation, clothing_size, availability, niveau_mannequin, years_experience')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error || !profils || profils.length === 0) return { profils: [], photos: [] };
  // Une seule requête pour toutes les photos de couverture (au lieu d'une
  // requête par mannequin, l'une après l'autre) — c'est ce qui ralentissait
  // fortement le chargement de la page. On passe par une fonction dédiée qui
  // ne renvoie qu'UNE photo par mannequin : le volume ne grossit jamais avec
  // le nombre de photos de chacun, seulement avec le nombre de mannequins —
  // ça tient donc même à 100+ mannequins.
  // (petite version de 480 px sur téléphone quand elle existe : js/photos.js)
  return { profils, photos: await lirePhotosCouverture(sb, profils.map(p => p.id)) };
}

async function afficherMannequins(vide) {
  const lu = await lireBook(vide);
  if (!lu) return;
  const { profils, photos } = lu;
  if (!profils.length) {
    vide.style.display = 'block';
    return;
  }

  const photoParMannequin = {};
  photos.forEach(p => {
    photoParMannequin[p.model_id] = urlLegere(urlGrille(p));
  });

  profils.forEach(profil => {
    profil.photoUrl = photoParMannequin[profil.id] || '/assets/logo-dark-bg.png';
    // tailles haut / bas / complète calculées d'après les mensurations (js/tailles.js)
    // Mesures incohérentes (« à reprendre ») : cachées sur la fiche publique, donc introuvables
    // ici aussi (sinon la recherche les révélerait).
    const t = window.ma2mTailles(profil);
    profil.mesuresCachees = t.aReprendre.length > 0;
    profil.tailles = { haut: t.haut && t.haut.lettre, bas: t.bas && t.bas.lettre, complete: window.ma2mTailleVetements(profil) };
    profil.langues = (profil.languages || '').split(',').map(l => l.trim()).filter(Boolean);
  });

  // Ordre alphabétique des prénoms (choix de la propriétaire, sept. 2026, js/rendu-book.js)
  window.RenduBook.ordonner(profils);

  tousLesProfils = profils;
  construireSuggestions();
  appliquerFiltres();
}

// Suggestions au toucher de la barre (12/11/2026) : pour un visiteur qui ne connaît aucun nom, un appui suffit
// (tailles, villes, niveau, teints présents dans le Book). Un appui ajoute le mot à la recherche.
const cleChoix = v => String(enAnglais(String(v || '').trim()) || '').trim().toLowerCase();
function construireSuggestions() {
  teintsConnus = [...new Set(tousLesProfils.flatMap((p) => (p.carnation ? [p.carnation, enAnglais(p.carnation)] : [])).map(sansAccents))].sort((a, b) => b.length - a.length);
  const boite = document.getElementById('book-suggestions');
  if (!boite) return;
  const presents = (f) => { const vus = new Map(); tousLesProfils.forEach((p) => f(p).forEach((v) => { v = String(v || '').trim(); if (v && !vus.has(cleChoix(v))) vus.set(cleChoix(v), EN ? enAnglais(v) : v); })); return [...vus.values()]; };
  const parFrequence = (f) => { const n = new Map(); tousLesProfils.forEach((p) => { const v = String(f(p) || '').trim(); if (v) n.set(v, (n.get(v) || 0) + 1); }); return [...n.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]); };
  const groupes = [
    [T('Taille', 'Height'), [['1m70', '1,70 m'], ['1m75', '1,75 m'], ['1m80', '1,80 m'], [T('plus de 1m85', 'over 1m85'), '+ 1,85 m']]],
    [T('Ville', 'City'), parFrequence((p) => p.city).slice(0, 6).map((v) => [v, v])],
    [T('Niveau', 'Level'), [['main board', 'Main Board'], ['new face', 'New Face']]],
    [T('Teint', 'Skin tone'), presents((p) => [p.carnation]).map((v) => [v, v])],
    [T('Vêtements', 'Clothing'), [['taille S', 'S'], ['taille M', 'M'], ['taille L', 'L']]]
  ].filter((g) => g[1].length);
  boite.innerHTML = groupes.map(([titre, choix]) => '<div class="book-sug-groupe"><span class="book-sug-titre">' + window.RenduBook.echapper(titre) + '</span>' +
    choix.map(([q, libelle]) => '<button type="button" class="book-sug" data-q="' + window.RenduBook.echapper(q) + '">' + window.RenduBook.echapper(libelle) + '</button>').join('') + '</div>').join('');
}
(function brancherSuggestions() {
  const champ = document.getElementById('f-recherche'), boite = document.getElementById('book-suggestions');
  if (!champ || !boite) return;
  const ouvrir = (oui) => { boite.hidden = !oui || !boite.children.length; champ.setAttribute('aria-expanded', String(!boite.hidden)); };
  // (12/11/2026) ouvertes au toucher quand la barre est vide ; refermées dès qu'on tape ou qu'on choisit, pour
  // laisser voir les résultats (sur téléphone, elles cachaient les cartes trouvées)
  champ.addEventListener('focus', () => ouvrir(!champ.value.trim()));
  champ.addEventListener('input', () => ouvrir(!champ.value.trim()));
  boite.addEventListener('click', (e) => {
    const b = e.target.closest('.book-sug');
    if (!b) return;
    const q = b.dataset.q, actuel = champ.value.trim();
    champ.value = sansAccents(actuel).includes(sansAccents(q)) ? actuel : (actuel ? actuel + ' ' : '') + q;
    appliquerFiltres();
    ouvrir(false);
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.book-barre')) ouvrir(false); });
  champ.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter') { ouvrir(false); if (e.key === 'Enter') champ.blur(); } });
})();

// Mesure tapée (« 97 ») comparée à celle de la fiche, exacte ou à « marge » cm près.
function mesureOk(valeurFiche, saisie, marge) {
  if (!saisie) return true;
  const v = window.ma2mNombre(valeurFiche);
  return v !== null && Math.abs(v - Number(saisie)) <= marge;
}

// Un profil répond-il à tous les critères compris dans la barre ? (marge : 0 = mesure exacte)
function correspond(p, c, marge) {
  const categorie = c.categorie || categorieActive, niveau = c.niveau || 'tous';
  if (categorie !== 'tous' && p.category !== categorie) return false;
  if (niveau !== 'tous' && niveauNormalise(p.niveau_mannequin, p.years_experience) !== niveau) return false;
  const h = window.ma2mNombre(p.height_cm);
  if ((c.tailleMin || c.tailleMax) && h === null) return false;
  if (c.tailleMin && h < Number(c.tailleMin)) return false;
  if (c.tailleMax && h > Number(c.tailleMax)) return false;
  if (p.mesuresCachees && (c.poitrine || c.tourTaille || c.bassin)) return false;
  if (!mesureOk(p.chest_cm, c.poitrine, marge) || !mesureOk(p.waist_cm, c.tourTaille, marge) || !mesureOk(p.hips_cm, c.bassin, marge)) return false;
  if (!mesureOk(p.shoe_size, c.pointure, marge ? 1 : 0)) return false;
  if (c.vetement && ![p.tailles.haut, p.tailles.bas].concat(String(p.tailles.complete || '').split('-')).includes(c.vetement)) return false;  // (« S-M » répond à S et à M)
  // couleur : en français ou en anglais (« noir », « black ») ; « Brun » et « Marron » = la même chose (enAnglais, js/app.js)
  const couleur = (v, mot) => !mot || [v, enAnglais(v)].some((x) => sansAccents(x).startsWith(mot)) || sansAccents(enAnglais(v)) === sansAccents(enAnglais(mot.charAt(0).toUpperCase() + mot.slice(1)));
  if (!couleur(p.eye_color, c.yeux) || !couleur(p.hair_color, c.cheveux)) return false;
  // (teint exact ; « Claire » peut aussi être un prénom : le nom compte aussi)
  if (c.teint && ![p.carnation, enAnglais(p.carnation || '')].some((x) => x && sansAccents(x) === c.teint) && !sansAccents(p.full_name).includes(c.teint)) return false;
  if (c.disponibilite && p.availability !== c.disponibilite) return false;
  // les autres mots : dans le nom, la ville, le teint, les langues, les yeux ou les cheveux (français ou anglais)
  if (c.mots.length) {
    const texte = sansAccents([p.full_name, p.city, p.carnation, p.eye_color, p.hair_color].concat(p.langues).filter(Boolean).map((v) => v + ' ' + enAnglais(v || '')).join(' '));
    if (!c.mots.every((w) => texte.includes(w))) return false;
  }
  return true;
}

function appliquerFiltres() {
  const grille = document.getElementById('grille');
  const vide = document.getElementById('vide');
  // cartes déjà écrites par le serveur (middleware.js, 01/11/2026) : gardées telles quelles la première fois
  const cartesServeur = grille.dataset.serveur === '1';
  delete grille.dataset.serveur;

  const c = comprendreRecherche(rechercheTapee());
  let resultats = window.RenduBook.dansLOrdre(tousLesProfils.filter(p => correspond(p, c, 0)));
  // Aucune mesure exacte : on propose les profils à 2 cm près (une mesure varie d'un jour à l'autre).
  const proches = document.getElementById('f-proches');
  const avecMesure = c.poitrine || c.tourTaille || c.bassin || c.pointure;
  const aPeuPres = !resultats.length && avecMesure ? window.RenduBook.dansLOrdre(tousLesProfils.filter(p => correspond(p, c, 2))) : [];
  if (aPeuPres.length) {
    resultats = aPeuPres;
    proches.textContent = EN ? 'No profile with these exact measurements: here are the profiles within 2 cm (1 shoe size).'
      : 'Aucun profil à ces mesures exactes : voici les profils à 2 cm près (1 pointure près).';
  }
  proches.classList.toggle('u-hidden', !aPeuPres.length);
  const n = resultats.length;
  document.getElementById('f-compte').textContent = window.RenduBook.compte(n, EN);
  document.getElementById('f-effacer').hidden = listeComplete();

  if (resultats.length === 0) {
    grille.innerHTML = '';
    vide.style.display = 'block';
    return;
  }
  vide.style.display = 'none';

  // liste complète déjà dessinée par le serveur (mêmes cartes, js/rendu-book.js) : seul l'état « dans ma
  // sélection » (gardé sur ce téléphone) est mis à jour ; sinon, les cartes sont redessinées
  const idsServeur = [...grille.querySelectorAll('.medaillon-carte .btn-selection')].map((b) => b.dataset.id);
  if (cartesServeur && !aPeuPres.length && idsServeur.length === n && idsServeur.every((id, i) => id === resultats[i].id)) {
    grille.querySelectorAll('.btn-selection').forEach((b) => {
      const oui = estDansSelection(b.dataset.id);
      b.classList.toggle('est-selectionne', oui); b.textContent = oui ? '✓' : '+';
      b.title = libelleSelection(oui); b.setAttribute('aria-label', libelleSelection(oui));
    });
    return;
  }
  // (12/11/2026) deux chapitres, Main Board puis New Faces (js/rendu-book.js, les mêmes que le serveur)
  grille.innerHTML = window.RenduBook.chapitres(resultats, EN, (profil, rang) => {
    const oui = estDansSelection(profil.id);
    return window.RenduBook.carte(profil, rang, { en: EN, photo: profil.photoUrl, selectionne: oui, libelle: libelleSelection(oui) });
  });
}
// bouton « + » de chaque carte (un seul écouteur pour toute la grille, cartes du serveur comprises)
document.getElementById('grille').addEventListener('click', (e) => {
  const bouton = e.target.closest('.btn-selection');
  if (!bouton) return;
  e.preventDefault();
  const profil = tousLesProfils.find((p) => p.id === bouton.dataset.id);
  if (!profil) return;
  if (estDansSelection(profil.id)) retirerSelection(profil.id);
  else ajouterSelection({ id: profil.id, full_name: profil.full_name, height_cm: profil.height_cm, photoUrl: profil.photoUrl });
  appliquerFiltres();
});

// Bouton « + » d'une photo : ce qu'il fait, dit à voix haute et au survol (20/10/2026 : « à quoi
// sert le + ? »)
function libelleSelection(dejaSelectionne) {
  return dejaSelectionne ? T('Retirer de ma sélection', 'Remove from my selection') : T('Ajouter à ma sélection', 'Add to my selection');
}

document.querySelectorAll('.book-segments .filtre-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.book-segments .filtre-btn').forEach(b => b.classList.remove('actif'));
    btn.classList.add('actif');
    categorieActive = btn.dataset.cat;
    // un mot de catégorie tapé dans la barre (« femmes 1m75 ») passerait avant le bouton : retiré
    const champ = document.getElementById('f-recherche');
    champ.value = champ.value.replace(/(^|\s)(femmes?|filles?|women|woman|female|girls?|hommes?|garçons?|garcons?|men|male|boys?)(?=\s|$)/gi, ' ').replace(/\s+/g, ' ').trim();
    appliquerFiltres();
  });
});

document.getElementById('f-recherche').addEventListener('input', appliquerFiltres);
document.getElementById('f-effacer').addEventListener('click', () => {
  document.getElementById('f-recherche').value = '';
  categorieActive = 'tous';
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* adresse inchangée */ } // retire ?categorie= / ?niveau=
  document.querySelectorAll('.book-segments .filtre-btn').forEach(b => b.classList.toggle('actif', b.dataset.cat === 'tous'));
  appliquerFiltres();
});

// Catégorie demandée dans l'adresse (?categorie=femme|homme|new-faces) — liens
// « Femmes / Hommes / New Faces » de l'accueil et du menu (06/10/2026).
(function () {
  let cat = null, niv = null;
  try { cat = new URLSearchParams(location.search).get('categorie'); niv = new URLSearchParams(location.search).get('niveau'); } catch (e) {}
  if (cat === 'new-faces') { cat = null; niv = 'new-face'; }
  // (12/11/2026) plus de boutons de niveau : le niveau demandé est écrit dans la barre, visible et effaçable
  const motNiveau = { 'new-face': 'new face', 'main-board': 'main board' }[niv];
  if (motNiveau) document.getElementById('f-recherche').value = motNiveau;
  const btn = cat && document.querySelector('.book-segments .filtre-btn[data-cat="' + cat.replace(/[^a-z-]/g, '') + '"]');
  if (!btn) return;
  document.querySelectorAll('.book-segments .filtre-btn').forEach(b => b.classList.remove('actif'));
  btn.classList.add('actif');
  categorieActive = btn.dataset.cat;
})();

void chargerMannequins();
