// Tables et dossiers d'images de cette page (fonctions communes : js/publications.js)
const PUBLICATION = { table: 'actualites', tablePhotos: 'actualite_photos', colonne: 'actualite_id', dossier: 'actualites', seau: 'actualites-images' };
// Actualités (actualites.html et en/actualites.html) : un seul script pour le français et
// l'anglais (11/10/2026 : avant, la version anglaise était recopiée dans la page). EN, T : js/app.js.
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

const CATEGORIES_ACTUALITES = ['Casting', 'Mannequinat', 'Conseils', 'Événements'];

const quillRedaction = creerEditeurRiche('red-editeur', T('Racontez votre actualité ici… (vous pouvez coller un texte déjà mis en forme)', 'Write here… (you can paste text already formatted from Word)'));
const LIBELLES_CATEGORIES_EN = { Casting: 'Casting', Mannequinat: 'Modeling', Conseils: 'Tips', Événements: 'Events' };
function libelleCategorieActu(cat) {
  return EN ? (LIBELLES_CATEGORIES_EN[cat] || cat) : cat;
}

function formatDateActu(dateStr) {
  return new Date(dateStr).toLocaleDateString(EN ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function afficherFiltresCategories(data) {
  const conteneur = document.getElementById('actus-filtres');
  const categoriesPresentes = CATEGORIES_ACTUALITES.filter(cat => data.some(a => a.categorie === cat));
  if (categoriesPresentes.length < 2) { conteneur.style.display = 'none'; return; }

  conteneur.style.display = 'flex';
  conteneur.innerHTML = ['Toutes', ...categoriesPresentes].map(cat => `
    <button class="filtre-categorie${cat === 'Toutes' ? ' actif' : ''}" data-categorie="${echapperHtml(cat)}">${echapperHtml(cat === 'Toutes' ? T('Toutes', 'All') : libelleCategorieActu(cat))}</button>
  `).join('');

  conteneur.querySelectorAll('.filtre-categorie').forEach(bouton => {
    bouton.addEventListener('click', () => {
      conteneur.querySelectorAll('.filtre-categorie').forEach(b => b.classList.remove('actif'));
      bouton.classList.add('actif');
      const categorie = bouton.dataset.categorie;
      document.querySelectorAll('#actus-grille .news-carte').forEach(carte => {
        carte.style.display = (categorie === 'Toutes' || carte.dataset.categorie === categorie) ? '' : 'none';
      });
    });
  });
}

async function chargerActualites() {
  const grille = document.getElementById('actus-grille');
  const uneZone = document.getElementById('actus-une');
  const vide = document.getElementById('actus-vide');
  if (!sb) {
    // "sb" peut valoir null sur une connexion instable (échec de chargement de
    // la bibliothèque Supabase, servie depuis un CDN) — on l'affiche clairement
    // plutôt que de laisser croire qu'il n'y a simplement aucune actualité.
    vide.textContent = T('Le chargement des actualités a échoué (connexion instable ?). Rechargez la page.', 'Failed to load news (unstable connection?). Reload the page.');
    vide.style.display = 'block';
    return;
  }
  const { data, error } = await sb.from('actualites').select('*').order('created_at', { ascending: false });
  if (error || !data || !data.length) { vide.style.display = 'block'; return; }
  window.actualitesData = data;

  const { data: toutesLesPhotos } = await sb.from('actualite_photos').select('actualite_id');
  const compteurParActu = {};
  (toutesLesPhotos || []).forEach(p => { compteurParActu[p.actualite_id] = (compteurParActu[p.actualite_id] || 0) + 1; });

  // Le dernier article publié est mis en avant séparément, dans un grand bloc "À la une".
  const une = data[0];
  uneZone.innerHTML = `
    <div class="news-une reveal" data-index="0">
      <img src="${echapperHtml(urlLegere(une.image_url))}" loading="lazy" alt="${echapperHtml(une.titre || '')}">
      <div class="news-une-scrim"></div>
      <div class="news-une-corps">
        <span class="news-une-badge">★ ${T('À la une', 'Featured')}</span>
        ${une.categorie ? `<span class="news-categorie">${echapperHtml(une.categorie)}</span>` : ''}
        <div class="news-date">${formatDateActu(une.created_at)}</div>
        ${une.titre ? `<h2>${echapperHtml(une.titre)}</h2>` : ''}
        ${une.commentaire ? `<p>${echapperHtml(extraitTexte(texteBrutDepuis(une.commentaire), 180))}</p>` : ''}
        <span class="news-lire">${T('Lire l\'article →', 'Read Article →')}</span>
      </div>
    </div>
  `;
  uneZone.querySelector('.news-une').addEventListener('click', () => ouvrirActuModal(0));

  const reste = data.slice(1);
  grille.innerHTML = reste.map((a, i) => {
    const indexReel = i + 1;
    const nbPhotos = compteurParActu[a.id] || (a.image_url ? 1 : 0);
    return `
    <div class="news-carte reveal" data-index="${indexReel}" data-categorie="${echapperHtml(a.categorie || '')}">
      <div class="news-img">
        <img src="${echapperHtml(urlLegere(a.image_url))}" loading="lazy" alt="${echapperHtml(a.titre || '')}">
        ${a.video_url ? '<span class="news-play">▶</span>' : ''}
        ${nbPhotos > 1 ? `<span class="news-compteur-photos">${nbPhotos}</span>` : ''}
      </div>
      <div class="news-corps">
        ${a.categorie ? `<span class="news-categorie">${echapperHtml(a.categorie)}</span>` : ''}
        <div class="news-date">${formatDateActu(a.created_at)}</div>
        ${a.titre ? `<h3>${echapperHtml(a.titre)}</h3>` : ''}
        ${a.commentaire ? `<p class="news-extrait">${echapperHtml(extraitTexte(texteBrutDepuis(a.commentaire), 110))}</p>` : ''}
        <span class="news-lire">${T('Lire la suite →', 'Read More →')}</span>
      </div>
    </div>
  `; }).join('');

  grille.querySelectorAll('.news-carte').forEach(carte => {
    carte.addEventListener('click', () => ouvrirActuModal(parseInt(carte.dataset.index)));
  });

  afficherFiltresCategories(data);

  // Ouvre directement une actualité précise si on arrive via un lien ?actu=ID (ex: depuis la page d'accueil)
  const idDepuisUrl = new URLSearchParams(window.location.search).get('actu');
  if (idDepuisUrl) {
    const index = data.findIndex(a => a.id === idDepuisUrl);
    if (index > -1) void ouvrirActuModal(index);
  }
}
void chargerActualites();

async function ouvrirActuModal(index) {
  const a = window.actualitesData[index];
  const videoEmbed = urlVideoIntegree(a.video_url);
  const zoneMedia = document.getElementById('news-modal-media');

  const { data: photos } = await sb.from('actualite_photos').select('url').eq('actualite_id', a.id).order('created_at', { ascending: true });
  const listePhotos = (photos && photos.length) ? photos : (a.image_url ? [{ url: a.image_url }] : []);

  let mediaHtml = '';
  if (videoEmbed) {
    mediaHtml += `<div class="video-runway ${EN ? 'enac-6' : 'news-modal-video-embed'}"><iframe src="${echapperHtml(videoEmbed)}" allowfullscreen loading="lazy"></iframe></div>`;
  }
  afficherMediasPublication(zoneMedia, listePhotos, mediaHtml);

  document.getElementById('news-modal-date').textContent = new Date(a.created_at).toLocaleDateString(EN ? 'en-US' : 'fr-FR', { day:'numeric', month:'long', year:'numeric' });
  document.getElementById('news-modal-titre').textContent = a.titre || '';
  document.getElementById('news-modal-texte').innerHTML = rendreContenuRiche(a.commentaire);

  const lienVideo = document.getElementById('news-modal-video-lien');
  const urlVideoSure = urlHttpSure(a.video_url);
  if (urlVideoSure) {
    lienVideo.href = urlVideoSure;
    lienVideo.style.display = 'inline-block';
  } else {
    lienVideo.style.display = 'none';
  }

  ouvrirNewsModal();

  window.actualiteModalCourante = a.id;
  if (window.ficheOuverte) window.ficheOuverte('actu', a.id, a.titre);
  document.getElementById('news-modal-admin-actions').style.display = window.estAdminConnecte ? 'block' : 'none';
}
// Fiche ouverte / fermée (verrouillage du défilement) : js/publications.js.
document.getElementById('news-modal-fermer').addEventListener('click', fermerNewsModal);
document.getElementById('news-modal').addEventListener('click', (e) => { if (e.target.id === 'news-modal') fermerNewsModal(); });

void verifierAdmin();

// --- Modification / suppression directement depuis la fiche ouverte (admin) ---
document.getElementById('news-modal-modifier-btn').addEventListener('click', () => {
  const a = window.actualitesData.find(x => x.id === window.actualiteModalCourante);
  if (!a) return;
  fermerNewsModal();
  ouvrirRedaction(a);
});

document.getElementById('news-modal-supprimer-btn').addEventListener('click', () => {
  void supprimerPublication(PUBLICATION, window.actualiteModalCourante, T('Supprimer définitivement cette actualité et toutes ses photos ?', 'Permanently delete this news item and all its photos?'), chargerActualites, fermerNewsModal); // js/publications.js
});

document.getElementById('admin-logout-btn').addEventListener('click', async () => {
  await sbAdmin.auth.signOut();
  document.getElementById('admin-bloc').style.display = 'none';
  window.estAdminConnecte = false;
});

// --- Page de rédaction plein écran : sert à la fois pour publier une nouvelle
// actualité (redactionIdEnCours === null) et pour modifier une actualité existante
// (redactionIdEnCours = son id) — un seul éditeur, un seul jeu de champs, avec un
// aperçu du rendu public qui se met à jour en direct pendant la saisie.
let redactionIdEnCours = null;
let redactionNouvellesImages = [];

function ouvrirRedaction(actualiteExistante) {
  redactionIdEnCours = actualiteExistante ? actualiteExistante.id : null;
  redactionNouvellesImages = [];
  document.getElementById('redaction-titre-mode').textContent = actualiteExistante ? T('Modifier l’actualité', 'Edit News Item') : T('Rédiger une actualité', 'Write a News Item');
  document.getElementById('red-titre').value = actualiteExistante ? (actualiteExistante.titre || '') : '';
  document.getElementById('red-categorie').value = actualiteExistante ? (actualiteExistante.categorie || '') : '';
  chargerContenuDansEditeur(quillRedaction, actualiteExistante ? actualiteExistante.commentaire : '');
  document.getElementById('red-video').value = actualiteExistante ? (actualiteExistante.video_url || '') : '';
  document.getElementById('red-images').value = '';
  document.getElementById('red-images-label').textContent = actualiteExistante ? T('Ajouter des photos (s’ajoutent à celles déjà en ligne)', 'Add photos (added to those already online)') : T('Images (tu peux en sélectionner plusieurs à la fois)', 'Images (you can select several at once)');
  document.getElementById('red-enregistrer-btn').textContent = actualiteExistante ? T('Enregistrer', 'Save') : T('Publier', 'Publish');
  document.getElementById('red-supprimer-btn').classList.toggle('u-hidden', !actualiteExistante);
  document.getElementById('red-msg').style.display = 'none';
  document.getElementById('red-images-apercu').innerHTML = '';
  apercuImageCouverture(actualiteExistante ? actualiteExistante.image_url : null);
  mettreAJourApercuRedaction();
  document.getElementById('redaction-overlay').classList.add('active');
  window.verrouillerDefilement();
}

function mettreAJourApercuRedaction() {
  const titre = document.getElementById('red-titre').value.trim();
  const categorie = document.getElementById('red-categorie').value;
  document.getElementById('red-apercu-titre').textContent = titre || T('Titre de l’actualité', 'News item title');
  const catEl = document.getElementById('red-apercu-categorie');
  catEl.textContent = categorie ? libelleCategorieActu(categorie) : '';
  catEl.classList.toggle('u-hidden', !categorie);
  document.getElementById('red-apercu-date').textContent = formatDateActu(new Date().toISOString());
  document.getElementById('red-apercu-texte').innerHTML = rendreContenuRiche(lireContenuEditeur(quillRedaction));
}
document.getElementById('red-titre').addEventListener('input', mettreAJourApercuRedaction);
document.getElementById('red-categorie').addEventListener('change', mettreAJourApercuRedaction);
if (quillRedaction && typeof quillRedaction.on === 'function') quillRedaction.on('text-change', mettreAJourApercuRedaction);

brancherRedaction(ouvrirRedaction, (fichiers) => { redactionNouvellesImages = fichiers; }); // js/publications.js

document.getElementById('red-enregistrer-btn').addEventListener('click', async () => {
  const msg = document.getElementById('red-msg');
  const titre = document.getElementById('red-titre').value.trim();
  const categorie = document.getElementById('red-categorie').value;
  const commentaire = lireContenuEditeur(quillRedaction);
  const videoUrl = document.getElementById('red-video').value.trim();
  const fichiers = redactionNouvellesImages;

  if (!redactionIdEnCours && !fichiers.length && !videoUrl) {
    msg.className = 'form-msg err'; msg.textContent = T('Choisis au moins une image ou ajoute un lien vidéo.', 'Choose at least one image or add a video link.'); msg.style.display = 'block';
    return;
  }

  msg.className = 'form-msg ok'; msg.textContent = fichiers.length ? T(`Envoi de ${fichiers.length} photo(s) en cours…`, `Uploading ${fichiers.length} photo(s)…`) : T('Enregistrement…', 'Saving…'); msg.style.display = 'block';

  const id = redactionIdEnCours || crypto.randomUUID();
  const urls = await envoyerPhotosPublication(PUBLICATION, id, fichiers);

  if (redactionIdEnCours) {
    const { error: erreurUpdate } = await sbAdmin.from('actualites').update({ titre, categorie: categorie || null, commentaire, video_url: videoUrl }).eq('id', id);
    if (erreurUpdate) { msg.className = 'form-msg err'; msg.textContent = T('Erreur lors de la modification.', 'Error while updating.'); return; }
    await enregistrerPhotosPublication(PUBLICATION, id, urls, true);
    msg.className = 'form-msg ok'; msg.textContent = T('Modifications enregistrées !', 'Changes saved!');
  } else {
    const { error: erreurInsert } = await sbAdmin.from('actualites').insert({
      id, titre, categorie: categorie || null, commentaire, video_url: videoUrl,
      image_url: urls.length ? urls[0].url : null
    });
    if (erreurInsert) { msg.className = 'form-msg err'; msg.textContent = T("Erreur d'enregistrement.", 'Error saving.'); msg.style.display = 'block'; return; }
    await enregistrerPhotosPublication(PUBLICATION, id, urls, false);
    msg.className = 'form-msg ok'; msg.textContent = T(`Actualité publiée avec ${urls.length} photo(s) !`, `News item published with ${urls.length} photo(s)!`);
  }

  await chargerActualites();
  setTimeout(fermerRedaction, 900);
});

document.getElementById('red-supprimer-btn').addEventListener('click', () => {
  void supprimerPublication(PUBLICATION, redactionIdEnCours, T('Supprimer définitivement cette actualité et toutes ses photos ?', 'Permanently delete this news item and all its photos?'), chargerActualites);
});
