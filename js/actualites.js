// Tables et dossiers d'images de cette page (fonctions communes : js/publications.js)
const PUBLICATION = PUBLICATIONS.actualites;  // js/publications.js
// Actualités (actualites.html et en/actualites.html) : un seul script pour le français et
// l'anglais (11/10/2026 : avant, la version anglaise était recopiée dans la page). EN, T : js/app.js.

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
  await versAnglais(data, ['titre', 'commentaire'], true);  // (page anglaise, js/app.js)
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

  montrerFichePublication('actu', a); // js/publications.js
}
// Fenêtre de lecture, modification et suppression (admin) : js/publications.js.
const QUESTION_SUPPRESSION = T('Supprimer définitivement cette actualité et toutes ses photos ?', 'Permanently delete this news item and all its photos?');
brancherFicheLecture(PUBLICATION, () => window.actualitesData, ouvrirRedaction, QUESTION_SUPPRESSION, chargerActualites);

// --- Page de rédaction plein écran : sert à la fois pour publier une nouvelle actualité et
// pour modifier une actualité existante — un seul éditeur, un seul jeu de champs, avec un
// aperçu du rendu public qui se met à jour en direct pendant la saisie (js/publications.js).
function ouvrirRedaction(actualiteExistante) {
  ouvrirRedactionPublication(actualiteExistante, {
    nouvelle: T('Rédiger une actualité', 'Write a News Item'), modifier: T('Modifier l’actualité', 'Edit News Item'),
    images: T('Images (tu peux en sélectionner plusieurs à la fois)', 'Images (you can select several at once)'), publier: T('Publier', 'Publish')
  });
  document.getElementById('red-categorie').value = actualiteExistante ? (actualiteExistante.categorie || '') : '';
  chargerContenuDansEditeur(quillRedaction, actualiteExistante ? actualiteExistante.commentaire : '');
  document.getElementById('red-video').value = actualiteExistante ? (actualiteExistante.video_url || '') : '';
  mettreAJourApercuRedaction();
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

brancherRedaction(PUBLICATION, ouvrirRedaction, QUESTION_SUPPRESSION, chargerActualites);

document.getElementById('red-enregistrer-btn').addEventListener('click', () => {
  const titre = document.getElementById('red-titre').value.trim();
  const categorie = document.getElementById('red-categorie').value;
  const videoUrl = document.getElementById('red-video').value.trim();
  if (!redaction.id && !redaction.images.length && !videoUrl) {
    messageRedaction('err', T('Choisis au moins une image ou ajoute un lien vidéo.', 'Choose at least one image or add a video link.'));
    return;
  }
  void enregistrerPublication(PUBLICATION, { titre, categorie: categorie || null, commentaire: lireContenuEditeur(quillRedaction), video_url: videoUrl },
    (n) => T(`Actualité publiée avec ${n} photo(s) !`, `News item published with ${n} photo(s)!`), chargerActualites);
});
