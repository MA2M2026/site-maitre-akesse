// Événements (evenements.html et en/evenements.html) : un seul script pour le français et
// l'anglais (11/10/2026 : avant, la version anglaise était recopiée dans la page). EN, T : js/app.js.

// (dates : règles partagées avec le serveur, js/rendu-publications.js, chargé avant)
function dateAffichageEvenement(e) {
  return window.RenduPublications.dateEvenement(e, EN);
}

async function chargerEvenements() {
  const grille = document.getElementById('evenements-grille');
  const uneZone = document.getElementById('evenements-une');
  const vide = document.getElementById('evenements-vide');
  const serveur = publicationsServeur();  // (js/publications-lecture.js)
  if (!serveur && !sb) {
    // "sb" peut valoir null sur une connexion instable (échec de chargement de
    // la bibliothèque Supabase, servie depuis un CDN) — on l'affiche clairement
    // plutôt que de laisser croire qu'il n'y a simplement aucun événement.
    vide.textContent = T('Le chargement des événements a échoué (connexion instable ?). Rechargez la page.', 'Failed to load events (unstable connection?). Reload the page.');
    vide.style.display = 'block';
    return;
  }
  const { data, error } = serveur ? { data: serveur.liste, error: null } : await sb.from('evenements').select('id, titre, date_evenement, lieu, description, image_url, created_at').order('date_evenement', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  if (error || !data || !data.length) { vide.style.display = 'block'; return; }
  await versAnglais(data, ['titre', 'lieu', 'description']);  // (page anglaise, js/app.js)
  window.evenementsData = data;

  const { data: toutesLesPhotos } = serveur ? { data: serveur.photos } : await sb.from('evenement_photos').select('evenement_id');
  const compteurParEvenement = {};
  (toutesLesPhotos || []).forEach(p => { compteurParEvenement[p.evenement_id] = (compteurParEvenement[p.evenement_id] || 0) + 1; });

  // Le dernier événement publié est mis en avant séparément, dans un grand bloc "À la une".
  const une = data[0];
  // cartes dessinées comme par le serveur (js/rendu-publications.js), après la traduction anglaise
  const R = window.RenduPublications;
  // (08/11/2026, phase 3 V1) grande carte déjà écrite par le serveur avec les mêmes données : gardée telle quelle (la
  // redessiner faisait réafficher sa photo quand les programmes arrivaient — 7 s sur un téléphone en 4G lente)
  if (!(serveur && uneZone.querySelector('.news-une'))) uneZone.innerHTML = R.une(une, { en: EN, sorte: 'evenement', photo: urlLegere(une.image_url || ''), extrait: une.description ? extraitTexte(texteBrutDepuis(une.description), 180) : '' });
  uneZone.querySelector('.news-une').addEventListener('click', () => ouvrirEvenementModal(0));

  const reste = data.slice(1);
  // (08/11/2026) cartes déjà écrites par le serveur : gardées (sinon leur apparition et leurs photos recommençaient)
  if (!(serveur && grille.children.length === reste.length)) grille.innerHTML = reste.map((e, i) => R.carte(e, i + 1, { en: EN, sorte: 'evenement', photo: urlLegere(e.image_url || ''), nbPhotos: compteurParEvenement[e.id] || (e.image_url ? 1 : 0),
    extrait: e.description ? extraitTexte(texteBrutDepuis(e.description), 110) : '' })).join('');

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
