// Fonctions communes aux pages Actualités et Événements (FR et EN), partagées le 11/10/2026
// (avant, recopiées dans js/actualites.js et js/evenements.js).
let newsModalEstOuverte = false;

function extraitTexte(texte, longueur) {
  if (!texte) return '';
  if (texte.length <= longueur) return texte;
  // Coupe entre deux mots (et non au milieu d'un mot : « Cette nouvel… »).
  let coupe = texte.slice(0, longueur);
  const espace = coupe.lastIndexOf(' ');
  if (espace > longueur * 0.6) coupe = coupe.slice(0, espace);
  return coupe.replace(/[\s,;:.\-–—(]+$/, '') + '…';
}

function ouvrirNewsModal() {
  document.getElementById('news-modal').classList.add('active');
  if (!newsModalEstOuverte) { newsModalEstOuverte = true; window.verrouillerDefilement(); }
}

function fermerNewsModal() {
  document.getElementById('news-modal').classList.remove('active');
  if (window.ficheFermee) window.ficheFermee();
  if (newsModalEstOuverte) { newsModalEstOuverte = false; window.deverrouillerDefilement(); }
}

function fermerRedaction() {
  document.getElementById('redaction-overlay').classList.remove('active');
  window.deverrouillerDefilement();
}

function apercuImageCouverture(url) {
  const img = document.getElementById('red-apercu-img');
  img.src = url || '';
  img.classList.toggle('u-hidden', !url);
}

// ---- Partagé le 12/10/2026 (code recopié signalé par SonarQube) ----

// Photos d'une publication dans la fenêtre de lecture : galerie (2 photos ou plus) ou photo
// seule, chacune ouvre la visionneuse plein écran. avant : HTML placé avant (ex. vidéo).
function afficherMediasPublication(zoneMedia, listePhotos, avant) {
  let mediaHtml = avant || '';
  if (listePhotos.length > 1) {
    // Composition adaptée au nombre de photos (voir .news-modal-galerie[data-count] dans
    // css/style.css) ; au-delà de 4, on garde une grille régulière classique.
    const compteGalerie = Math.min(listePhotos.length, 4);
    mediaHtml += `<div class="news-modal-galerie" data-count="${compteGalerie}">${listePhotos.map(p => `<div class="gal-item"><img src="${echapperHtml(p.url)}" loading="lazy" alt=""></div>`).join('')}</div>`;
  } else if (listePhotos.length === 1) {
    mediaHtml += `<img class="news-modal-img" src="${echapperHtml(listePhotos[0].url)}" alt="">`;
  }
  zoneMedia.innerHTML = mediaHtml;
  window.lightboxPhotos = listePhotos.map(p => p.url);
  zoneMedia.querySelectorAll('img').forEach((img, i) => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => ouvrirGalerieLightbox(window.lightboxPhotos, i));
  });
}

// Fenêtre de rédaction (administratrice) : aperçu des photos choisies et boutons
// ouvrir / annuler / fermer. choisir(fichiers) garde la liste dans la page appelante.
function brancherRedaction(ouvrirRedaction, choisir) {
  document.getElementById('red-images').addEventListener('change', (e) => {
    const fichiers = Array.from(e.target.files || []);
    choisir(fichiers);
    const conteneur = document.getElementById('red-images-apercu');
    conteneur.innerHTML = '';
    fichiers.forEach(fichier => {
      conteneur.insertAdjacentHTML('beforeend', `<div class="ria-item"><img src="${URL.createObjectURL(fichier)}" alt=""></div>`);
    });
    if (fichiers.length) apercuImageCouverture(URL.createObjectURL(fichiers[0]));
  });
  document.getElementById('ouvrir-redaction-btn').addEventListener('click', () => ouvrirRedaction(null));
  document.getElementById('red-annuler-btn').addEventListener('click', fermerRedaction);
  document.getElementById('redaction-fermer').addEventListener('click', fermerRedaction);
  document.getElementById('redaction-overlay').addEventListener('click', (e) => { if (e.target.id === 'redaction-overlay') fermerRedaction(); });
}

// Envoie les photos choisies (HEIC converties) dans site/<dossier>/<id>/ ; une photo qui
// échoue est sautée. Renvoie [{ url, chemin }].
async function envoyerPhotosPublication(dossier, id, fichiers) {
  const urls = [];
  for (const fichierOriginal of fichiers) {
    const fichier = await convertirSiHeic(fichierOriginal);
    const chemin = `site/${dossier}/${id}/${Date.now()}-${nomFichierSur(fichier.name)}`;
    try {
      const url = await envoyerImageSite(dossier, chemin, fichier);
      urls.push({ url, chemin });
    } catch (e) { continue; }
  }
  return urls;
}

// Enregistre les photos envoyées pour une publication ; en modification, la première
// devient la couverture si la publication n'en avait pas encore.
// t : { table: 'actualites', tablePhotos: 'actualite_photos', colonne: 'actualite_id' }
async function enregistrerPhotosPublication(t, id, urls, modification) {
  for (const photo of urls) {
    await sbAdmin.from(t.tablePhotos).insert({ [t.colonne]: id, url: photo.url, chemin: photo.chemin });
  }
  if (modification && urls.length) {
    const { data: actuelle } = await sbAdmin.from(t.table).select('image_url').eq('id', id).single();
    if (!actuelle.image_url) await sbAdmin.from(t.table).update({ image_url: urls[0].url }).eq('id', id);
  }
}

// Supprime une publication puis ses images. Base d'abord : si la suppression échoue, les
// images restent intactes. t : comme ci-dessus + dossier et seau des images. fermer : la
// fenêtre à refermer ensuite (rédaction par défaut, ou fenêtre de lecture).
async function supprimerPublication(t, id, question, recharger, fermer) {
  if (!id || !confirm(question)) return;
  const { data: photos } = await sbAdmin.from(t.tablePhotos).select('chemin').eq(t.colonne, id);
  const chemins = (photos || []).map(p => p.chemin).filter(Boolean);
  const { error: erreurSuppression } = await sbAdmin.from(t.table).delete().eq('id', id);
  if (erreurSuppression) { alert(T('La suppression a échoué. Réessayez.', 'Deletion failed. Please try again.')); return; }
  if (chemins.length) await supprimerCheminsImagesSite(t.dossier, t.seau, chemins);
  (fermer || fermerRedaction)();
  void recharger();
}
