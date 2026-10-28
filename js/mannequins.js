// Page « Nos mannequins » / « Our models » : un seul script pour le français et l'anglais
// (11/10/2026 : avant, deux copies js/mannequins.js et js/mannequins-en.js).
let tousLesProfils = [];
let categorieActive = 'tous';
let niveauActif = 'tous'; // New Face / Professionnel (affiché « Main Board »), 06/10/2026

async function chargerMannequins() {
  const vide = document.getElementById('vide');
  const grille = document.getElementById('grille');
  try { await afficherMannequins(vide); } finally { libererPlaceListe(grille, listeComplete()); }
}
// Champs de recherche (14/10/2026, demande de la propriétaire) : chacun s'utilise SEUL ; un
// champ vide ne filtre rien. Un critère rempli écarte les fiches où cette mesure manque.
const FILTRES = {
  'f-taille-min': 'tailleMin', 'f-taille-max': 'tailleMax', 'f-poitrine': 'poitrine', 'f-tour-taille': 'tourTaille',
  'f-bassin': 'bassin', 'f-pointure': 'pointure', 'f-taille-haut': 'haut', 'f-taille-bas': 'bas',
  'f-taille-complete': 'complete', 'f-yeux': 'yeux', 'f-cheveux': 'cheveux', 'f-carnation': 'carnation',
  'f-ville': 'ville', 'f-langue': 'langue', 'f-disponibilite': 'disponibilite', 'f-recherche': 'recherche'
};
const CHAMPS_FILTRES = Object.keys(FILTRES);
function criteres() {
  const c = {};
  CHAMPS_FILTRES.forEach(id => { c[FILTRES[id]] = document.getElementById(id).value.trim(); });
  return c;
}
// Aucun filtre actif (le navigateur peut remettre la recherche tapée avant un retour en arrière)
function listeComplete() {
  const c = criteres();
  return categorieActive === 'tous' && niveauActif === 'tous' && Object.keys(c).every(k => !c[k]);
}

async function afficherMannequins(vide) {
  if (!sb) {
    // "sb" peut valoir null sur une connexion instable (échec de chargement de
    // la bibliothèque Supabase, servie depuis un CDN) — message clair plutôt
    // que de laisser croire qu'aucun profil ne correspond aux critères.
    vide.textContent = EN ? 'Failed to load the Book (unstable connection?). Please reload the page.' : 'Le chargement du Book a échoué (connexion instable ?). Rechargez la page.';
    vide.style.display = 'block';
    return;
  }

  const { data: profils, error } = await sb
    .from('model_profiles')
    .select('id, full_name, city, category, height_cm, chest_cm, waist_cm, hips_cm, shoe_size, eye_color, hair_color, languages, carnation, clothing_size, availability, niveau_mannequin, years_experience')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error || !profils || profils.length === 0) {
    vide.style.display = 'block';
    return;
  }

  // Une seule requête pour toutes les photos de couverture (au lieu d'une
  // requête par mannequin, l'une après l'autre) — c'est ce qui ralentissait
  // fortement le chargement de la page. On passe par une fonction dédiée qui
  // ne renvoie qu'UNE photo par mannequin : le volume ne grossit jamais avec
  // le nombre de photos de chacun, seulement avec le nombre de mannequins —
  // ça tient donc même à 100+ mannequins.
  const ids = profils.map(p => p.id);
  // (petite version de 480 px sur téléphone quand elle existe : js/photos.js)
  const photos = await lirePhotosCouverture(sb, ids);

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

  // Ordre alphabétique des prénoms (choix de la propriétaire, sept. 2026,
  // quand les cœurs sur les photos ont été retirés du site).
  profils.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'fr', { sensitivity: 'base' }));

  tousLesProfils = profils;
  remplirChoix();
  appliquerFiltres();
}

// Mesures repliées sur téléphone (20/10/2026, règle CSS) : le bouton les ouvre ou les referme.
function ouvrirMesures(ouvert) {
  const bloc = document.querySelector('.filtres-mesures');
  if (!bloc) return;
  bloc.classList.toggle('ouvert', ouvert);
  bloc.querySelector('.filtres-mesures-bouton').setAttribute('aria-expanded', String(ouvert));
}
document.querySelector('.filtres-mesures-bouton').addEventListener('click', () => {
  ouvrirMesures(!document.querySelector('.filtres-mesures').classList.contains('ouvert'));
});

// Listes « yeux, cheveux, ville, langue » : seulement les valeurs présentes dans les fiches.
// Une même couleur écrite de deux façons (« Noir » / « Noire », « Marron » / « Brun ») ne fait
// qu'un choix : la clé est le mot anglais (enAnglais, js/app.js).
const cleChoix = v => String(enAnglais(String(v || '').trim()) || '').trim().toLowerCase();
const VALEURS_CHOIX = { 'f-yeux': p => [p.eye_color], 'f-cheveux': p => [p.hair_color], 'f-ville': p => [p.city], 'f-langue': p => p.langues };
function remplirChoix() {
  Object.keys(VALEURS_CHOIX).forEach(id => {
    const select = document.getElementById(id);
    const gardee = select.value; // valeur remise par le navigateur après un retour en arrière
    const vues = new Map(); // clé → libellé affiché
    tousLesProfils.forEach(p => VALEURS_CHOIX[id](p).forEach(v => {
      v = String(v || '').trim();
      if (v && !vues.has(cleChoix(v))) vues.set(cleChoix(v), EN ? enAnglais(v) : v);
    }));
    [...vues.entries()].sort((a, b) => a[1].localeCompare(b[1], EN ? 'en' : 'fr', { sensitivity: 'base' })).forEach(([cle, libelle]) => {
      const o = document.createElement('option');
      o.value = cle; o.textContent = libelle;
      select.appendChild(o);
    });
    if (gardee) select.value = gardee;
  });
  // un critère d'un bloc repliable (mesures, « Plus de critères ») est rempli : le bloc s'ouvre
  // (pas de filtre invisible)
  const rempli = bloc => [...bloc.querySelectorAll('input, select')].some(e => e.value);
  document.querySelectorAll('.filtres-plus').forEach(bloc => { if (rempli(bloc)) bloc.open = true; });
  const mesures = document.querySelector('.filtres-mesures');
  if (mesures && rempli(mesures)) ouvrirMesures(true);
}

// Mesure tapée (« 97 ») comparée à celle de la fiche, exacte ou à « marge » cm près.
function mesureOk(valeurFiche, saisie, marge) {
  if (!saisie) return true;
  const v = window.ma2mNombre(valeurFiche);
  return v !== null && Math.abs(v - Number(saisie)) <= marge;
}

// Un profil répond-il à tous les critères remplis ? (marge : 0 = mesure exacte)
function correspond(p, c, marge) {
  if (categorieActive !== 'tous' && p.category !== categorieActive) return false;
  if (niveauActif !== 'tous' && niveauNormalise(p.niveau_mannequin, p.years_experience) !== niveauActif) return false;
  const h = window.ma2mNombre(p.height_cm);
  if ((c.tailleMin || c.tailleMax) && h === null) return false;
  if (c.tailleMin && h < Number(c.tailleMin)) return false;
  if (c.tailleMax && h > Number(c.tailleMax)) return false;
  if (p.mesuresCachees && (c.poitrine || c.tourTaille || c.bassin)) return false;
  if (!mesureOk(p.chest_cm, c.poitrine, marge) || !mesureOk(p.waist_cm, c.tourTaille, marge) || !mesureOk(p.hips_cm, c.bassin, marge)) return false;
  if (!mesureOk(p.shoe_size, c.pointure, marge ? 1 : 0)) return false;
  if (c.haut && p.tailles.haut !== c.haut) return false;
  if (c.bas && p.tailles.bas !== c.bas) return false;
  if (c.complete && p.tailles.complete.split('-').indexOf(c.complete) === -1) return false; // « S-M » répond à S et à M
  const egal = (v, choix) => !choix || cleChoix(v) === choix;
  if (!egal(p.eye_color, c.yeux) || !egal(p.hair_color, c.cheveux) || !egal(p.city, c.ville)) return false;
  if (c.langue && !p.langues.some(l => cleChoix(l) === c.langue)) return false;
  if (c.carnation && p.carnation !== c.carnation) return false;
  if (c.disponibilite && p.availability !== c.disponibilite) return false;
  if (c.recherche && !(p.full_name || '').toLowerCase().includes(c.recherche.toLowerCase())) return false;
  return true;
}

function appliquerFiltres() {
  const grille = document.getElementById('grille');
  const vide = document.getElementById('vide');
  grille.innerHTML = '';

  const c = criteres();
  let resultats = tousLesProfils.filter(p => correspond(p, c, 0));
  // Aucune mesure exacte : on propose les profils à 2 cm près (une mesure varie d'un jour à l'autre).
  const proches = document.getElementById('f-proches');
  const avecMesure = c.poitrine || c.tourTaille || c.bassin || c.pointure;
  const aPeuPres = !resultats.length && avecMesure ? tousLesProfils.filter(p => correspond(p, c, 2)) : [];
  if (aPeuPres.length) {
    resultats = aPeuPres;
    proches.textContent = EN ? 'No profile with these exact measurements: here are the profiles within 2 cm (1 shoe size).'
      : 'Aucun profil à ces mesures exactes : voici les profils à 2 cm près (1 pointure près).';
  }
  proches.classList.toggle('u-hidden', !aPeuPres.length);
  const n = resultats.length;
  document.getElementById('f-compte').textContent = EN ? n + (n > 1 ? ' profiles' : ' profile') : n + (n > 1 ? ' profils correspondent' : ' profil correspond');
  document.getElementById('f-effacer').hidden = listeComplete();

  if (resultats.length === 0) {
    vide.style.display = 'block';
    return;
  }
  vide.style.display = 'none';

  resultats.forEach((profil, rang) => {
    const carte = document.createElement('div');
    carte.className = 'medaillon-carte reveal';
    const dejaSelectionne = estDansSelection(profil.id);
    carte.innerHTML = `
      <button class="btn-selection${dejaSelectionne ? ' est-selectionne' : ''}" data-id="${profil.id}" title="${libelleSelection(dejaSelectionne)}" aria-label="${libelleSelection(dejaSelectionne)}">
        ${dejaSelectionne ? '✓' : '+'}
      </button>
      <a href="mannequin.html?id=${profil.id}" class="u-flex-col-centre">
        <div class="medaillon-photo">
          <img src="${echapperHtml(profil.photoUrl)}" alt="${echapperHtml(profil.full_name || (EN ? 'Model' : 'Mannequin'))}"${rang < 5 ? (rang === 0 ? ' fetchpriority="high"' : '') : ' loading="lazy"'}>
          <div class="book-carte-legende">
            <div class="medaillon-nom">${echapperHtml(profil.full_name || (EN ? 'Model' : 'Mannequin'))}</div>
            <div class="medaillon-info">${echapperHtml(profil.city || '')}${profil.height_cm ? ' · ' + profil.height_cm + ' cm' : ''}</div>
          </div>
        </div>
      </a>
    `;
    grille.appendChild(carte);

    carte.querySelector('.btn-selection').addEventListener('click', (e) => {
      e.preventDefault();
      if (estDansSelection(profil.id)) {
        retirerSelection(profil.id);
      } else {
        ajouterSelection({ id: profil.id, full_name: profil.full_name, height_cm: profil.height_cm, photoUrl: profil.photoUrl });
      }
      appliquerFiltres();
    });
  });
}

// Bouton « + » d'une photo : ce qu'il fait, dit à voix haute et au survol (20/10/2026 : « à quoi
// sert le + ? »)
function libelleSelection(dejaSelectionne) {
  return dejaSelectionne ? T('Retirer de ma sélection', 'Remove from my selection') : T('Ajouter à ma sélection', 'Add to my selection');
}

document.querySelectorAll('.filtre-btn:not(.filtre-niveau-btn)').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filtre-btn:not(.filtre-niveau-btn)').forEach(b => b.classList.remove('actif'));
    btn.classList.add('actif');
    categorieActive = btn.dataset.cat;
    appliquerFiltres();
  });
});

document.querySelectorAll('.filtre-niveau-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filtre-niveau-btn').forEach(b => b.classList.remove('actif'));
    btn.classList.add('actif');
    niveauActif = btn.dataset.niveau;
    appliquerFiltres();
  });
});

CHAMPS_FILTRES.forEach(id => {
  document.getElementById(id).addEventListener('input', appliquerFiltres);
});
document.getElementById('f-effacer').addEventListener('click', () => {
  CHAMPS_FILTRES.forEach(id => { document.getElementById(id).value = ''; });
  categorieActive = 'tous'; niveauActif = 'tous';
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* adresse inchangée */ } // retire ?categorie= / ?niveau=
  document.querySelectorAll('.filtre-btn').forEach(b => b.classList.toggle('actif', b.dataset.cat === 'tous' || b.dataset.niveau === 'tous'));
  appliquerFiltres();
});

// Catégorie demandée dans l'adresse (?categorie=femme|homme|new-faces) — liens
// « Femmes / Hommes / New Faces » de l'accueil et du menu (06/10/2026).
(function () {
  let cat = null, niv = null;
  try { cat = new URLSearchParams(location.search).get('categorie'); niv = new URLSearchParams(location.search).get('niveau'); } catch (e) {}
  if (cat === 'new-faces') { cat = null; niv = 'new-face'; }
  const boutonNiveau = { 'new-face': 'New Face', 'main-board': 'Professionnel' }[niv];
  if (boutonNiveau) {
    document.querySelectorAll('.filtre-niveau-btn').forEach(b => b.classList.toggle('actif', b.dataset.niveau === boutonNiveau));
    niveauActif = boutonNiveau;
  }
  const btn = cat && document.querySelector('.filtre-btn[data-cat="' + cat.replace(/[^a-z-]/g, '') + '"]');
  if (!btn) return;
  document.querySelectorAll('.filtre-btn:not(.filtre-niveau-btn)').forEach(b => b.classList.remove('actif'));
  btn.classList.add('actif');
  categorieActive = btn.dataset.cat;
})();

void chargerMannequins();
