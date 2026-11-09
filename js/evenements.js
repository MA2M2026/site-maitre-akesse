// Événements (evenements.html et en/evenements.html) : un seul script pour le français et
// l'anglais (11/10/2026 : avant, la version anglaise était recopiée dans la page). EN, T : js/app.js.

// (dates : règles partagées avec le serveur, js/rendu-publications.js, chargé avant)
function dateAffichageEvenement(e) {
  return window.RenduPublications.dateEvenement(e, EN);
}

// Chargement : déroulement commun avec les Actualités (chargerPublicationsPage, js/publications-lecture.js)
void chargerPublicationsPage({
  zone: 'evenements', table: 'evenements', tablePhotos: 'evenement_photos', clePhotos: 'evenement_id',
  colonnes: 'id, titre, date_evenement, lieu, description, image_url, created_at',
  trier: (q) => q.order('date_evenement', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
  champsEn: ['titre', 'lieu', 'description'], champTexte: 'description', sorte: 'evenement', parametre: 'evenement', global: 'evenementsData',
  photo: (e) => urlLegere(e.image_url || ''), ouvrir: ouvrirEvenementModal,
  echec: ['Le chargement des événements a échoué (connexion instable ?). Rechargez la page.', 'Failed to load events (unstable connection?). Reload the page.']
});

async function ouvrirEvenementModal(index) {
  const e = window.evenementsData[index];
  const zoneMedia = document.getElementById('news-modal-media');

  const { data: photos } = await sb.from('evenement_photos').select('url').eq('evenement_id', e.id).order('created_at', { ascending: true });
  const listePhotos = (photos && photos.length) ? photos : (e.image_url ? [{ url: e.image_url }] : []);

  let mediaHtml = '';
  afficherMediasPublication(zoneMedia, listePhotos, mediaHtml);

  document.getElementById('news-modal-date').textContent = dateAffichageEvenement(e);
  document.getElementById('news-modal-titre').textContent = e.titre || '';
  document.getElementById('news-modal-lieu').textContent = e.lieu ? ('📍 ' + e.lieu) : '';
  document.getElementById('news-modal-lieu').classList.toggle('u-hidden', !e.lieu);
  document.getElementById('news-modal-texte').innerHTML = rendreContenuRiche(e.description);

  montrerFichePublication('evenement', e); // js/publications-lecture.js
}
// Fenêtre de lecture (js/publications-lecture.js) ; publier, modifier et supprimer : dans l'Administration seulement
// (phase 2, W4, 02/11/2026 : plus aucun code d'écriture dans la page publique).
brancherFicheLecture();
