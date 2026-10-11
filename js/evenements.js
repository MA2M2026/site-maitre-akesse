// Événements (evenements.html et en/evenements.html) : un seul script pour le français et
// l'anglais (11/10/2026 : avant, la version anglaise était recopiée dans la page). EN, T : js/app.js.
const quillRedaction = creerEditeurRiche('red-editeur', T('Racontez cet événement ici… (facultatif)', 'Tell the story of this event here… (optional)'));

// "date" (sans heure) : new Date('2026-05-01') est interprété en UTC, ce qui peut
// afficher la veille selon le fuseau du visiteur — on force midi pour l'éviter.
function formatDateEvenement(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(EN ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatDatePublication(dateStr) {
  return new Date(dateStr).toLocaleDateString(EN ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function dateAffichageEvenement(e) {
  return e.date_evenement ? formatDateEvenement(e.date_evenement) : formatDatePublication(e.created_at);
}

async function chargerEvenements() {
  const grille = document.getElementById('evenements-grille');
  const uneZone = document.getElementById('evenements-une');
  const vide = document.getElementById('evenements-vide');
  if (!sb) {
    // "sb" peut valoir null sur une connexion instable (échec de chargement de
    // la bibliothèque Supabase, servie depuis un CDN) — on l'affiche clairement
    // plutôt que de laisser croire qu'il n'y a simplement aucun événement.
    vide.textContent = T('Le chargement des événements a échoué (connexion instable ?). Rechargez la page.', 'Failed to load events (unstable connection?). Reload the page.');
    vide.style.display = 'block';
    return;
  }
  const { data, error } = await sb.from('evenements').select('*').order('date_evenement', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  if (error || !data || !data.length) { vide.style.display = 'block'; return; }
  window.evenementsData = data;

  const { data: toutesLesPhotos } = await sb.from('evenement_photos').select('evenement_id');
  const compteurParEvenement = {};
  (toutesLesPhotos || []).forEach(p => { compteurParEvenement[p.evenement_id] = (compteurParEvenement[p.evenement_id] || 0) + 1; });

  // Le dernier événement publié est mis en avant séparément, dans un grand bloc "À la une".
  const une = data[0];
  uneZone.innerHTML = `
    <div class="news-une reveal" data-index="0">
      <img src="${echapperHtml(une.image_url || '')}" loading="lazy" alt="${echapperHtml(une.titre || '')}">
      <div class="news-une-scrim"></div>
      <div class="news-une-corps">
        <span class="news-une-badge">★ ${T('À la une', 'Featured')}</span>
        ${une.lieu ? `<span class="news-categorie">📍 ${echapperHtml(une.lieu)}</span>` : ''}
        <div class="news-date">${dateAffichageEvenement(une)}</div>
        ${une.titre ? `<h2>${echapperHtml(une.titre)}</h2>` : ''}
        ${une.description ? `<p>${echapperHtml(extraitTexte(texteBrutDepuis(une.description), 180))}</p>` : ''}
        <span class="news-lire">${T('Voir l\'événement →', 'View Event →')}</span>
      </div>
    </div>
  `;
  uneZone.querySelector('.news-une').addEventListener('click', () => ouvrirEvenementModal(0));

  const reste = data.slice(1);
  grille.innerHTML = reste.map((e, i) => {
    const indexReel = i + 1;
    const nbPhotos = compteurParEvenement[e.id] || (e.image_url ? 1 : 0);
    return `
    <div class="news-carte reveal" data-index="${indexReel}">
      <div class="news-img">
        <img src="${echapperHtml(e.image_url || '')}" loading="lazy" alt="${echapperHtml(e.titre || '')}">
        ${nbPhotos > 1 ? `<span class="news-compteur-photos">${nbPhotos}</span>` : ''}
      </div>
      <div class="news-corps">
        ${e.lieu ? `<span class="news-categorie">📍 ${echapperHtml(e.lieu)}</span>` : ''}
        <div class="news-date">${dateAffichageEvenement(e)}</div>
        ${e.titre ? `<h3>${echapperHtml(e.titre)}</h3>` : ''}
        ${e.description ? `<p class="news-extrait">${echapperHtml(extraitTexte(texteBrutDepuis(e.description), 110))}</p>` : ''}
        <span class="news-lire">${T('Voir l\'album →', 'View Album →')}</span>
      </div>
    </div>
  `; }).join('');

  grille.querySelectorAll('.news-carte').forEach(carte => {
    carte.addEventListener('click', () => ouvrirEvenementModal(parseInt(carte.dataset.index)));
  });

  // Ouvre directement un événement précis si on arrive via un lien ?evenement=ID (ex: depuis la page d'accueil)
  const idDepuisUrl = new URLSearchParams(window.location.search).get('evenement');
  if (idDepuisUrl) {
    const index = data.findIndex(e => e.id === idDepuisUrl);
    if (index > -1) void ouvrirEvenementModal(index);
  }
}
void chargerEvenements();

async function ouvrirEvenementModal(index) {
  const e = window.evenementsData[index];
  const zoneMedia = document.getElementById('news-modal-media');

  const { data: photos } = await sb.from('evenement_photos').select('url').eq('evenement_id', e.id).order('created_at', { ascending: true });
  const listePhotos = (photos && photos.length) ? photos : (e.image_url ? [{ url: e.image_url }] : []);

  let mediaHtml = '';
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

  document.getElementById('news-modal-date').textContent = dateAffichageEvenement(e);
  document.getElementById('news-modal-titre').textContent = e.titre || '';
  document.getElementById('news-modal-lieu').textContent = e.lieu ? ('📍 ' + e.lieu) : '';
  document.getElementById('news-modal-lieu').classList.toggle('u-hidden', !e.lieu);
  document.getElementById('news-modal-texte').innerHTML = rendreContenuRiche(e.description);

  ouvrirNewsModal();

  window.evenementModalCourant = e.id;
  if (window.ficheOuverte) window.ficheOuverte('evenement', e.id, e.titre);
  document.getElementById('news-modal-admin-actions').style.display = window.estAdminConnecte ? 'block' : 'none';
}
// Fiche ouverte / fermée (verrouillage du défilement) : js/publications.js.
document.getElementById('news-modal-fermer').addEventListener('click', fermerNewsModal);
document.getElementById('news-modal').addEventListener('click', (e) => { if (e.target.id === 'news-modal') fermerNewsModal(); });

void verifierAdmin();

// --- Modification / suppression directement depuis la fiche ouverte (admin) ---
document.getElementById('news-modal-modifier-btn').addEventListener('click', () => {
  const e = window.evenementsData.find(x => x.id === window.evenementModalCourant);
  if (!e) return;
  fermerNewsModal();
  ouvrirRedaction(e);
});

document.getElementById('news-modal-supprimer-btn').addEventListener('click', async () => {
  const id = window.evenementModalCourant;
  if (!confirm(T("Supprimer définitivement cet événement et toutes ses photos ?", 'Permanently delete this event and all its photos?'))) return;
  const { data: photos } = await sbAdmin.from('evenement_photos').select('chemin').eq('evenement_id', id);
  const chemins = (photos || []).map(p => p.chemin).filter(Boolean);
  // Base d'abord : si la suppression échoue, les images restent intactes.
  const { error: erreurSuppression } = await sbAdmin.from('evenements').delete().eq('id', id);
  if (erreurSuppression) { alert(T('La suppression a échoué. Réessayez.', 'Deletion failed. Please try again.')); return; }
  if (chemins.length) await supprimerCheminsImagesSite('evenements', 'evenements-images', chemins);
  fermerNewsModal();
  void chargerEvenements();
});

document.getElementById('admin-logout-btn').addEventListener('click', async () => {
  await sbAdmin.auth.signOut();
  document.getElementById('admin-bloc').style.display = 'none';
  window.estAdminConnecte = false;
});

// --- Page de rédaction plein écran : sert à la fois pour publier un nouvel événement
// (redactionIdEnCours === null) et pour modifier un événement existant (redactionIdEnCours
// = son id) — un seul éditeur, un seul jeu de champs, avec un aperçu du rendu public qui
// se met à jour en direct pendant la saisie.
let redactionIdEnCours = null;
let redactionNouvellesImages = [];

function ouvrirRedaction(evenementExistant) {
  redactionIdEnCours = evenementExistant ? evenementExistant.id : null;
  redactionNouvellesImages = [];
  document.getElementById('redaction-titre-mode').textContent = evenementExistant ? T('Modifier l’événement', 'Edit Event') : T('Publier un nouvel événement', 'Publish a New Event');
  document.getElementById('red-titre').value = evenementExistant ? (evenementExistant.titre || '') : '';
  document.getElementById('red-date').value = evenementExistant ? (evenementExistant.date_evenement || '') : '';
  document.getElementById('red-lieu').value = evenementExistant ? (evenementExistant.lieu || '') : '';
  chargerContenuDansEditeur(quillRedaction, evenementExistant ? evenementExistant.description : '');
  document.getElementById('red-images').value = '';
  document.getElementById('red-images-label').textContent = evenementExistant ? T('Ajouter des photos (s’ajoutent à celles déjà en ligne)', 'Add photos (added to those already online)') : T('Photos (tu peux en sélectionner plusieurs à la fois)', 'Photos (you can select several at once)');
  document.getElementById('red-enregistrer-btn').textContent = evenementExistant ? T('Enregistrer', 'Save') : T('Publier l’événement', 'Publish Event');
  document.getElementById('red-supprimer-btn').classList.toggle('u-hidden', !evenementExistant);
  document.getElementById('red-msg').style.display = 'none';
  document.getElementById('red-images-apercu').innerHTML = '';
  apercuImageCouverture(evenementExistant ? evenementExistant.image_url : null);
  mettreAJourApercuRedaction();
  document.getElementById('redaction-overlay').classList.add('active');
  window.verrouillerDefilement();
}

function mettreAJourApercuRedaction() {
  const titre = document.getElementById('red-titre').value.trim();
  const lieu = document.getElementById('red-lieu').value.trim();
  const dateEvenement = document.getElementById('red-date').value;
  document.getElementById('red-apercu-titre').textContent = titre || T('Titre de l’événement', 'Event title');
  const lieuEl = document.getElementById('red-apercu-lieu');
  lieuEl.textContent = lieu ? ('📍 ' + lieu) : '';
  lieuEl.classList.toggle('u-hidden', !lieu);
  document.getElementById('red-apercu-date').textContent = dateEvenement ? formatDateEvenement(dateEvenement) : '';
  document.getElementById('red-apercu-texte').innerHTML = rendreContenuRiche(lireContenuEditeur(quillRedaction));
}
document.getElementById('red-titre').addEventListener('input', mettreAJourApercuRedaction);
document.getElementById('red-date').addEventListener('input', mettreAJourApercuRedaction);
document.getElementById('red-lieu').addEventListener('input', mettreAJourApercuRedaction);
if (quillRedaction && typeof quillRedaction.on === 'function') quillRedaction.on('text-change', mettreAJourApercuRedaction);

document.getElementById('red-images').addEventListener('change', (e) => {
  redactionNouvellesImages = Array.from(e.target.files || []);
  const conteneur = document.getElementById('red-images-apercu');
  conteneur.innerHTML = '';
  redactionNouvellesImages.forEach(fichier => {
    conteneur.insertAdjacentHTML('beforeend', `<div class="ria-item"><img src="${URL.createObjectURL(fichier)}" alt=""></div>`);
  });
  if (redactionNouvellesImages.length) apercuImageCouverture(URL.createObjectURL(redactionNouvellesImages[0]));
});

document.getElementById('ouvrir-redaction-btn').addEventListener('click', () => ouvrirRedaction(null));
document.getElementById('red-annuler-btn').addEventListener('click', fermerRedaction);
document.getElementById('redaction-fermer').addEventListener('click', fermerRedaction);
document.getElementById('redaction-overlay').addEventListener('click', (e) => { if (e.target.id === 'redaction-overlay') fermerRedaction(); });

document.getElementById('red-enregistrer-btn').addEventListener('click', async () => {
  const msg = document.getElementById('red-msg');
  const titre = document.getElementById('red-titre').value.trim();
  const dateEvenement = document.getElementById('red-date').value || null;
  const lieu = document.getElementById('red-lieu').value.trim();
  const description = lireContenuEditeur(quillRedaction);
  const fichiers = redactionNouvellesImages;

  if (!titre) { msg.className = 'form-msg err'; msg.textContent = T('Le titre est obligatoire.', 'Title is required.'); msg.style.display = 'block'; return; }
  if (!redactionIdEnCours && !fichiers.length) {
    msg.className = 'form-msg err'; msg.textContent = T('Choisis au moins une photo.', 'Choose at least one photo.'); msg.style.display = 'block';
    return;
  }

  msg.className = 'form-msg ok'; msg.textContent = fichiers.length ? T(`Envoi de ${fichiers.length} photo(s) en cours…`, `Uploading ${fichiers.length} photo(s)…`) : T('Enregistrement…', 'Saving…'); msg.style.display = 'block';

  const id = redactionIdEnCours || crypto.randomUUID();
  const urls = [];
  for (const fichierOriginal of fichiers) {
    const fichier = await convertirSiHeic(fichierOriginal);
    const chemin = `site/evenements/${id}/${Date.now()}-${nomFichierSur(fichier.name)}`;
    try {
      const url = await envoyerImageSite('evenements', chemin, fichier);
      urls.push({ url, chemin });
    } catch (e) { continue; }
  }

  if (redactionIdEnCours) {
    const { error: erreurUpdate } = await sbAdmin.from('evenements').update({ titre, date_evenement: dateEvenement, lieu: lieu || null, description: description || null }).eq('id', id);
    if (erreurUpdate) { msg.className = 'form-msg err'; msg.textContent = T('Erreur lors de la modification.', 'Error while updating.'); return; }
    for (const photo of urls) {
      await sbAdmin.from('evenement_photos').insert({ evenement_id: id, url: photo.url, chemin: photo.chemin });
    }
    if (urls.length) {
      const { data: evenementActuel } = await sbAdmin.from('evenements').select('image_url').eq('id', id).single();
      if (!evenementActuel.image_url) await sbAdmin.from('evenements').update({ image_url: urls[0].url }).eq('id', id);
    }
    msg.className = 'form-msg ok'; msg.textContent = T('Modifications enregistrées !', 'Changes saved!');
  } else {
    const { error: erreurInsert } = await sbAdmin.from('evenements').insert({
      id, titre, date_evenement: dateEvenement, lieu: lieu || null, description: description || null,
      image_url: urls.length ? urls[0].url : null
    });
    if (erreurInsert) { msg.className = 'form-msg err'; msg.textContent = T("Erreur d'enregistrement.", 'Error saving.'); msg.style.display = 'block'; return; }
    for (const photo of urls) {
      await sbAdmin.from('evenement_photos').insert({ evenement_id: id, url: photo.url, chemin: photo.chemin });
    }
    msg.className = 'form-msg ok'; msg.textContent = T(`Événement publié avec ${urls.length} photo(s) !`, `Event published with ${urls.length} photo(s)!`);
  }

  await chargerEvenements();
  setTimeout(fermerRedaction, 900);
});

document.getElementById('red-supprimer-btn').addEventListener('click', async () => {
  if (!redactionIdEnCours) return;
  if (!confirm(T("Supprimer définitivement cet événement et toutes ses photos ?", 'Permanently delete this event and all its photos?'))) return;
  const id = redactionIdEnCours;
  const { data: photos } = await sbAdmin.from('evenement_photos').select('chemin').eq('evenement_id', id);
  const chemins = (photos || []).map(p => p.chemin).filter(Boolean);
  // Base d'abord : si la suppression échoue, les images restent intactes.
  const { error: erreurSuppression } = await sbAdmin.from('evenements').delete().eq('id', id);
  if (erreurSuppression) { alert(T('La suppression a échoué. Réessayez.', 'Deletion failed. Please try again.')); return; }
  if (chemins.length) await supprimerCheminsImagesSite('evenements', 'evenements-images', chemins);
  fermerRedaction();
  void chargerEvenements();
});
