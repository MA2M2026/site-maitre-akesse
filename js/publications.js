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

// ---- Partagé le 20/10/2026 (code recopié signalé par jscpd) ----

// Rédaction en cours : id de la publication modifiée (null = nouvelle) et photos choisies.
const redaction = { id: null, images: [] };

// Fenêtre de rédaction (administratrice) : aperçu des photos choisies, boutons ouvrir /
// annuler / fermer / supprimer. question : confirmation avant suppression ; recharger : la
// liste de la page.
function brancherRedaction(t, ouvrirRedaction, question, recharger) {
  document.getElementById('red-images').addEventListener('change', (e) => {
    const fichiers = Array.from(e.target.files || []);
    redaction.images = fichiers;
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
  document.getElementById('red-supprimer-btn').addEventListener('click', () => {
    void supprimerPublication(t, redaction.id, question, recharger);
  });
}

// Ouvre la fenêtre de rédaction, vide ou remplie avec la publication existante ; les champs
// propres à la page (catégorie, date, lieu…) sont remplis ensuite par la page.
// textes : { nouvelle, modifier, images, publier } (titre de la fenêtre, champ photos, bouton).
function ouvrirRedactionPublication(existante, textes) {
  redaction.id = existante ? existante.id : null;
  redaction.images = [];
  document.getElementById('redaction-titre-mode').textContent = existante ? textes.modifier : textes.nouvelle;
  document.getElementById('red-titre').value = existante ? (existante.titre || '') : '';
  document.getElementById('red-images').value = '';
  document.getElementById('red-images-label').textContent = existante ? T('Ajouter des photos (s’ajoutent à celles déjà en ligne)', 'Add photos (added to those already online)') : textes.images;
  document.getElementById('red-enregistrer-btn').textContent = existante ? T('Enregistrer', 'Save') : textes.publier;
  document.getElementById('red-supprimer-btn').classList.toggle('u-hidden', !existante);
  document.getElementById('red-msg').style.display = 'none';
  document.getElementById('red-images-apercu').innerHTML = '';
  apercuImageCouverture(existante ? existante.image_url : null);
  document.getElementById('redaction-overlay').classList.add('active');
  window.verrouillerDefilement();
}

// Message sous le formulaire de rédaction (classe : 'ok' ou 'err').
function messageRedaction(classe, texte) {
  const msg = document.getElementById('red-msg');
  msg.className = 'form-msg ' + classe; msg.textContent = texte; msg.style.display = 'block';
}

// Publie la rédaction en cours (ou enregistre la modification) : photos d'abord, puis la
// publication. champs : colonnes propres à la page ; publiee(n) : message après publication.
async function enregistrerPublication(t, champs, publiee, recharger) {
  const fichiers = redaction.images;
  messageRedaction('ok', fichiers.length ? T(`Envoi de ${fichiers.length} photo(s) en cours…`, `Uploading ${fichiers.length} photo(s)…`) : T('Enregistrement…', 'Saving…'));
  const id = redaction.id || crypto.randomUUID();
  const urls = await envoyerPhotosPublication(t, id, fichiers);
  if (redaction.id) {
    const { error } = await sbAdmin.from(t.table).update(champs).eq('id', id);
    if (error) { messageRedaction('err', T('Erreur lors de la modification.', 'Error while updating.')); return; }
    await enregistrerPhotosPublication(t, id, urls, true);
    messageRedaction('ok', T('Modifications enregistrées !', 'Changes saved!'));
  } else {
    const { error } = await sbAdmin.from(t.table).insert({ id, ...champs, image_url: urls.length ? urls[0].url : null });
    if (error) { messageRedaction('err', T("Erreur d'enregistrement.", 'Error saving.')); return; }
    await enregistrerPhotosPublication(t, id, urls, false);
    messageRedaction('ok', publiee(urls.length));
  }
  await recharger();
  setTimeout(fermerRedaction, 900);
}

// Fenêtre de lecture : ouverture (type : 'actu' ou 'evenement', pour le suivi des fiches) et,
// pour l'administratrice, modifier / supprimer la publication ouverte, se déconnecter.
// liste() : les publications chargées par la page.
let publicationOuverte = null;
function montrerFichePublication(type, p) {
  ouvrirNewsModal();
  publicationOuverte = p.id;
  if (window.ficheOuverte) window.ficheOuverte(type, p.id, p.titre);
  document.getElementById('news-modal-admin-actions').style.display = window.estAdminConnecte ? 'block' : 'none';
}
function brancherFicheLecture(t, liste, ouvrirRedaction, question, recharger) {
  document.getElementById('news-modal-fermer').addEventListener('click', fermerNewsModal);
  document.getElementById('news-modal').addEventListener('click', (e) => { if (e.target.id === 'news-modal') fermerNewsModal(); });
  void verifierAdmin();
  document.getElementById('news-modal-modifier-btn').addEventListener('click', () => {
    const p = (liste() || []).find(x => x.id === publicationOuverte);
    if (!p) return;
    fermerNewsModal();
    ouvrirRedaction(p);
  });
  document.getElementById('news-modal-supprimer-btn').addEventListener('click', () => {
    void supprimerPublication(t, publicationOuverte, question, recharger, fermerNewsModal);
  });
  document.getElementById('admin-logout-btn').addEventListener('click', async () => {
    await sbAdmin.auth.signOut();
    document.getElementById('admin-bloc').style.display = 'none';
    window.estAdminConnecte = false;
  });
}

// Envoie les photos choisies (HEIC converties) dans site/<t.dossier>/<id>/ ; une photo qui
// échoue est sautée. Renvoie [{ url, chemin }].
async function envoyerPhotosPublication(t, id, fichiers) {
  const dossier = t.dossier;
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
    const { data: actuelle } = await sbAdmin.from(t.table).select('image_url').eq('id', id).maybeSingle();
    if (actuelle && !actuelle.image_url) await sbAdmin.from(t.table).update({ image_url: urls[0].url }).eq('id', id);
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
