// Pages publiques Actualités et Événements (FR et EN) : LECTURE seulement (phase 2, W4, 02/11/2026). Avant, ce
// fichier (js/publications.js) contenait aussi la publication, la modification et la suppression depuis la page
// publique : désormais tout cela se fait dans l'Administration (/admin/), avec js/publications-ecriture.js, servi
// seulement à l'agence connectée (middleware.js, SCRIPTS_ADMIN). Aucun bouton ni code d'écriture dans les pages publiques.
let newsModalEstOuverte = false;


// Lien YouTube / Vimeo collé par l'agence → adresse du lecteur intégré (null si non reconnu).
function urlVideoIntegree(url) {
  if (!url) return null;
  try {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let id = '';
      if (url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split(/[?&]/)[0];
      else if (url.includes('/shorts/')) id = url.split('/shorts/')[1].split(/[?&]/)[0];
      else if (url.includes('/live/')) id = url.split('/live/')[1].split(/[?&]/)[0];
      else if (url.includes('/embed/')) id = url.split('/embed/')[1].split(/[?&]/)[0];
      else if (url.includes('v=')) id = url.split('v=')[1].split('&')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.includes('vimeo.com')) {
      const id = url.split('vimeo.com/')[1].split(/[?&]/)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch (e) { return null; }
  return null;
}

// (règle partagée avec le serveur : js/rendu-publications.js, chargé avant)
function extraitTexte(texte, longueur) {
  return window.RenduPublications.extrait(texte, longueur);
}

function ouvrirNewsModal() {
  document.getElementById('news-modal').classList.add('active');
  if (!newsModalEstOuverte) { newsModalEstOuverte = true; window.verrouillerDefilement(); window.fenetreOuverte(fermerNewsModal); }
}

function fermerNewsModal() {
  document.getElementById('news-modal').classList.remove('active');
  if (window.ficheFermee) window.ficheFermee();
  if (newsModalEstOuverte) { newsModalEstOuverte = false; window.deverrouillerDefilement(); window.fenetreFermee(fermerNewsModal); }
}

// Photos d'une publication dans la fenêtre de lecture : galerie (2 photos ou plus) ou photo
// seule, chacune ouvre la visionneuse plein écran. avant : HTML placé avant (ex. vidéo).
function afficherMediasPublication(zoneMedia, listePhotos, avant) {
  let mediaHtml = avant || '';
  if (listePhotos.length > 1) {
    // Composition adaptée au nombre de photos (voir .news-modal-galerie[data-count] dans
    // css/style.css) ; au-delà de 4, on garde une grille régulière classique.
    const compteGalerie = Math.min(listePhotos.length, 4);
    mediaHtml += `<div class="news-modal-galerie" data-count="${compteGalerie}">${listePhotos.map(p => `<div class="gal-item"><img src="${echapperHtml(urlLegere(p.url))}" loading="lazy" alt=""></div>`).join('')}</div>`;
  } else if (listePhotos.length === 1) {
    mediaHtml += `<img class="news-modal-img" src="${echapperHtml(urlLegere(listePhotos[0].url))}" alt="">`;
  }
  zoneMedia.innerHTML = mediaHtml;
  window.lightboxPhotos = listePhotos.map(p => p.url);
  zoneMedia.querySelectorAll('img').forEach((img, i) => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => ouvrirGalerieLightbox(window.lightboxPhotos, i));
  });
}

// Actualités / événements préparés par le serveur (middleware.js, 01/11/2026, site dynamique) : la liste
// et les photos (pour le compte) déjà dans la page ; null sinon (la page lit la base comme avant).
function publicationsServeur() {
  const d = donneesServeur('publications-donnees');  // (js/app.js)
  return d && Array.isArray(d.liste) && Array.isArray(d.photos) ? d : null;
}

// Chargement d'une page de publications (Actualités, Événements) : le même déroulement pour les deux pages
// (09/11/2026, grand balayage : il était recopié dans js/actualites.js et js/evenements.js). Seuls changent la
// table, les champs et la fenêtre de lecture, donnés par c :
//  c.zone ('actus' | 'evenements' : ids <zone>-grille, <zone>-une, <zone>-vide), c.table, c.tablePhotos, c.clePhotos,
//  c.colonnes, c.trier(requête), c.champsEn, c.champTexte, c.sorte, c.photo(ligne), c.ouvrir(index),
//  c.parametre (lien ?<parametre>=ID), c.global (window[c.global] : la liste, lue par la fenêtre de lecture),
//  c.echec [français, anglais], c.apres(data) (facultatif).
async function chargerPublicationsPage(c) {
  const grille = document.getElementById(c.zone + '-grille');
  const uneZone = document.getElementById(c.zone + '-une');
  const vide = document.getElementById(c.zone + '-vide');
  const serveur = publicationsServeur();
  if (!serveur && !sb) {
    // "sb" peut valoir null sur une connexion instable (échec de chargement de la bibliothèque Supabase) : on
    // l'affiche clairement plutôt que de laisser croire qu'il n'y a simplement aucune publication.
    vide.textContent = T(c.echec[0], c.echec[1]);
    vide.style.display = 'block';
    return;
  }
  const { data, error } = serveur ? { data: serveur.liste, error: null } : await c.trier(sb.from(c.table).select(c.colonnes));
  if (error || !data?.length) { vide.style.display = 'block'; return; }
  await versAnglais(data, c.champsEn);  // (page anglaise, js/app.js)
  window[c.global] = data;

  const { data: toutesLesPhotos } = serveur ? { data: serveur.photos } : await sb.from(c.tablePhotos).select(c.clePhotos);
  const compteur = {};
  (toutesLesPhotos || []).forEach((p) => { compteur[p[c.clePhotos]] = (compteur[p[c.clePhotos]] || 0) + 1; });
  const extrait = (x, n) => (x[c.champTexte] ? extraitTexte(texteBrutDepuis(x[c.champTexte]), n) : '');

  // La dernière publication est mise en avant séparément, dans un grand bloc « À la une ». Cartes dessinées comme par
  // le serveur (js/rendu-publications.js), après la traduction anglaise.
  const une = data[0], R = window.RenduPublications;
  // (08/11/2026, phase 3 V1) grande carte déjà écrite par le serveur avec les mêmes données : gardée telle quelle (la
  // redessiner faisait réafficher sa photo quand les programmes arrivaient — 7 s sur un téléphone en 4G lente)
  if (!(serveur && uneZone.querySelector('.news-une'))) uneZone.innerHTML = R.une(une, { en: EN, sorte: c.sorte, photo: c.photo(une), extrait: extrait(une, 180) });
  uneZone.querySelector('.news-une').addEventListener('click', () => c.ouvrir(0));

  const reste = data.slice(1);
  // (08/11/2026) cartes déjà écrites par le serveur : gardées (sinon leur apparition et leurs photos recommençaient)
  if (!(serveur && grille.children.length === reste.length)) grille.innerHTML = reste.map((x, i) => R.carte(x, i + 1, { en: EN, sorte: c.sorte, photo: c.photo(x), nbPhotos: compteur[x.id] || (x.image_url ? 1 : 0),
    extrait: extrait(x, 110) })).join('');
  grille.querySelectorAll('.news-carte').forEach((carte) => {
    carte.addEventListener('click', () => c.ouvrir(Number.parseInt(carte.dataset.index, 10)));
  });
  if (c.apres) c.apres(data);

  // Ouvre directement une publication précise si on arrive par un lien ?<parametre>=ID (ex. : depuis l'accueil)
  const idDepuisUrl = new URLSearchParams(window.location.search).get(c.parametre);
  if (idDepuisUrl) {
    const index = data.findIndex((x) => x.id === idDepuisUrl);
    if (index > -1) void c.ouvrir(index);
  }
}

// Fenêtre de lecture d'une publication (type : 'actu' ou 'evenement', pour le suivi des fiches)
function montrerFichePublication(type, p) {
  ouvrirNewsModal();
  if (window.ficheOuverte) window.ficheOuverte(type, p.id, p.titre);
}
function brancherFicheLecture() {
  document.getElementById('news-modal-fermer').addEventListener('click', fermerNewsModal);
  document.getElementById('news-modal').addEventListener('click', (e) => { if (e.target.id === 'news-modal') fermerNewsModal(); });
}
