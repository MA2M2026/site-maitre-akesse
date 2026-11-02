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

// Fenêtre de lecture d'une publication (type : 'actu' ou 'evenement', pour le suivi des fiches)
function montrerFichePublication(type, p) {
  ouvrirNewsModal();
  if (window.ficheOuverte) window.ficheOuverte(type, p.id, p.titre);
}
function brancherFicheLecture() {
  document.getElementById('news-modal-fermer').addEventListener('click', fermerNewsModal);
  document.getElementById('news-modal').addEventListener('click', (e) => { if (e.target.id === 'news-modal') fermerNewsModal(); });
}
