// Actualités (actualites.html et en/actualites.html) : un seul script pour le français et
// l'anglais (11/10/2026 : avant, la version anglaise était recopiée dans la page). EN, T : js/app.js.

function afficherFiltresCategories(data) {
  const conteneur = document.getElementById('actus-filtres');
  const boutons = window.RenduPublications.filtresActualites(data, EN);  // (même dessin que le serveur)
  if (!boutons) { conteneur.style.display = 'none'; return; }

  conteneur.style.display = 'flex';
  conteneur.innerHTML = boutons;

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
  const serveur = publicationsServeur();  // (js/publications-lecture.js)
  if (!serveur && !sb) {
    // "sb" peut valoir null sur une connexion instable (échec de chargement de
    // la bibliothèque Supabase, servie depuis un CDN) — on l'affiche clairement
    // plutôt que de laisser croire qu'il n'y a simplement aucune actualité.
    vide.textContent = T('Le chargement des actualités a échoué (connexion instable ?). Rechargez la page.', 'Failed to load news (unstable connection?). Reload the page.');
    vide.style.display = 'block';
    return;
  }
  const { data, error } = serveur ? { data: serveur.liste, error: null } : await sb.from('actualites').select('id, titre, image_url, commentaire, created_at, video_url, featured, categorie').order('created_at', { ascending: false });
  if (error || !data || !data.length) { vide.style.display = 'block'; return; }
  await versAnglais(data, ['titre', 'commentaire']);  // (page anglaise, js/app.js)
  window.actualitesData = data;

  const { data: toutesLesPhotos } = serveur ? { data: serveur.photos } : await sb.from('actualite_photos').select('actualite_id');
  const compteurParActu = {};
  (toutesLesPhotos || []).forEach(p => { compteurParActu[p.actualite_id] = (compteurParActu[p.actualite_id] || 0) + 1; });

  // Le dernier article publié est mis en avant séparément, dans un grand bloc "À la une".
  const une = data[0];
  // cartes dessinées comme par le serveur (js/rendu-publications.js), après la traduction anglaise
  const R = window.RenduPublications;
  uneZone.innerHTML = R.une(une, { en: EN, sorte: 'actualite', photo: urlLegere(une.image_url), extrait: une.commentaire ? extraitTexte(texteBrutDepuis(une.commentaire), 180) : '' });
  uneZone.querySelector('.news-une').addEventListener('click', () => ouvrirActuModal(0));

  const reste = data.slice(1);
  grille.innerHTML = reste.map((a, i) => R.carte(a, i + 1, { en: EN, sorte: 'actualite', photo: urlLegere(a.image_url), nbPhotos: compteurParActu[a.id] || (a.image_url ? 1 : 0),
    extrait: a.commentaire ? extraitTexte(texteBrutDepuis(a.commentaire), 110) : '' })).join('');

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

  montrerFichePublication('actu', a); // js/publications-lecture.js
}
// Fenêtre de lecture (js/publications-lecture.js) ; publier, modifier et supprimer : dans l'Administration seulement
// (phase 2, W4, 02/11/2026 : plus aucun code d'écriture dans la page publique).
brancherFicheLecture();
