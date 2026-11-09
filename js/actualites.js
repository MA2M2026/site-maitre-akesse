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

// Chargement : déroulement commun avec les Événements (chargerPublicationsPage, js/publications-lecture.js)
void chargerPublicationsPage({
  zone: 'actus', table: 'actualites', tablePhotos: 'actualite_photos', clePhotos: 'actualite_id',
  colonnes: 'id, titre, image_url, commentaire, created_at, video_url, featured, categorie',
  trier: (q) => q.order('created_at', { ascending: false }),
  champsEn: ['titre', 'commentaire'], champTexte: 'commentaire', sorte: 'actualite', parametre: 'actu', global: 'actualitesData',
  photo: (a) => urlLegere(a.image_url), ouvrir: ouvrirActuModal, apres: afficherFiltresCategories,
  echec: ['Le chargement des actualités a échoué (connexion instable ?). Rechargez la page.', 'Failed to load news (unstable connection?). Reload the page.']
});

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
