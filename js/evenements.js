// Tables et dossiers d'images de cette page (fonctions communes : js/publications.js)
const PUBLICATION = PUBLICATIONS.evenements;  // js/publications.js
// Événements (evenements.html et en/evenements.html) : un seul script pour le français et
// l'anglais (11/10/2026 : avant, la version anglaise était recopiée dans la page). EN, T : js/app.js.
const quillRedaction = editeurRicheDiffere('red-editeur', T('Racontez cet événement ici… (facultatif)', 'Tell the story of this event here… (optional)'));

// "date" (sans heure) : new Date('2026-05-01') est interprété en UTC, ce qui peut
// afficher la veille selon le fuseau du visiteur — on force midi pour l'éviter.
// (règles partagées avec le serveur : js/rendu-publications.js, chargé avant)
function formatDateEvenement(dateStr) {
  return dateStr ? window.RenduPublications.dateEvenement({ date_evenement: dateStr }, EN) : '';
}
function formatDatePublication(dateStr) {
  return window.RenduPublications.dateLongue(dateStr, EN);
}
function dateAffichageEvenement(e) {
  return window.RenduPublications.dateEvenement(e, EN);
}

async function chargerEvenements() {
  const grille = document.getElementById('evenements-grille');
  const uneZone = document.getElementById('evenements-une');
  const vide = document.getElementById('evenements-vide');
  const serveur = publicationsServeur();  // (js/publications.js)
  if (!serveur && !sb) {
    // "sb" peut valoir null sur une connexion instable (échec de chargement de
    // la bibliothèque Supabase, servie depuis un CDN) — on l'affiche clairement
    // plutôt que de laisser croire qu'il n'y a simplement aucun événement.
    vide.textContent = T('Le chargement des événements a échoué (connexion instable ?). Rechargez la page.', 'Failed to load events (unstable connection?). Reload the page.');
    vide.style.display = 'block';
    return;
  }
  const { data, error } = serveur ? { data: serveur.liste, error: null } : await sb.from('evenements').select('*').order('date_evenement', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  if (error || !data || !data.length) { vide.style.display = 'block'; return; }
  await versAnglais(data, ['titre', 'lieu', 'description'], true);  // (page anglaise, js/app.js)
  window.evenementsData = data;

  const { data: toutesLesPhotos } = serveur ? { data: serveur.photos } : await sb.from('evenement_photos').select('evenement_id');
  const compteurParEvenement = {};
  (toutesLesPhotos || []).forEach(p => { compteurParEvenement[p.evenement_id] = (compteurParEvenement[p.evenement_id] || 0) + 1; });

  // Le dernier événement publié est mis en avant séparément, dans un grand bloc "À la une".
  const une = data[0];
  // cartes dessinées comme par le serveur (js/rendu-publications.js), après la traduction anglaise
  const R = window.RenduPublications;
  uneZone.innerHTML = R.une(une, { en: EN, sorte: 'evenement', photo: urlLegere(une.image_url || ''), extrait: une.description ? extraitTexte(texteBrutDepuis(une.description), 180) : '' });
  uneZone.querySelector('.news-une').addEventListener('click', () => ouvrirEvenementModal(0));

  const reste = data.slice(1);
  grille.innerHTML = reste.map((e, i) => R.carte(e, i + 1, { en: EN, sorte: 'evenement', photo: urlLegere(e.image_url || ''), nbPhotos: compteurParEvenement[e.id] || (e.image_url ? 1 : 0),
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

  montrerFichePublication('evenement', e); // js/publications.js
}
// Fenêtre de lecture, modification et suppression (admin) : js/publications.js.
const QUESTION_SUPPRESSION = T("Supprimer définitivement cet événement et toutes ses photos ?", 'Permanently delete this event and all its photos?');
brancherFicheLecture(PUBLICATION, () => window.evenementsData, ouvrirRedaction, QUESTION_SUPPRESSION, chargerEvenements);

// --- Page de rédaction plein écran : sert à la fois pour publier un nouvel événement et pour
// modifier un événement existant — un seul éditeur, un seul jeu de champs, avec un aperçu du
// rendu public qui se met à jour en direct pendant la saisie (js/publications.js).
function ouvrirRedaction(evenementExistant) {
  const editeurPret = quillRedaction.preparer();  // éditeur chargé à la demande (js/app.js)
  ouvrirRedactionPublication(evenementExistant, {
    nouvelle: T('Publier un nouvel événement', 'Publish a New Event'), modifier: T('Modifier l’événement', 'Edit Event'),
    images: T('Photos (tu peux en sélectionner plusieurs à la fois)', 'Photos (you can select several at once)'), publier: T('Publier l’événement', 'Publish Event')
  });
  document.getElementById('red-date').value = evenementExistant ? (evenementExistant.date_evenement || '') : '';
  document.getElementById('red-lieu').value = evenementExistant ? (evenementExistant.lieu || '') : '';
  mettreAJourApercuRedaction();
  void editeurPret.then(() => {
    chargerContenuDansEditeur(quillRedaction, evenementExistant ? evenementExistant.description : '');
    mettreAJourApercuRedaction();
  });
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
quillRedaction.on('text-change', mettreAJourApercuRedaction);

brancherRedaction(PUBLICATION, ouvrirRedaction, QUESTION_SUPPRESSION, chargerEvenements);

document.getElementById('red-enregistrer-btn').addEventListener('click', async () => {
  const titre = document.getElementById('red-titre').value.trim();
  if (!titre) { messageRedaction('err', T('Le titre est obligatoire.', 'Title is required.')); return; }
  if (!redaction.id && !redaction.images.length) { messageRedaction('err', T('Choisis au moins une photo.', 'Choose at least one photo.')); return; }
  await quillRedaction.preparer();
  const description = lireContenuEditeur(quillRedaction);
  void enregistrerPublication(PUBLICATION, {
    titre, date_evenement: document.getElementById('red-date').value || null,
    lieu: document.getElementById('red-lieu').value.trim() || null, description: description || null
  }, (n) => T(`Événement publié avec ${n} photo(s) !`, `Event published with ${n} photo(s)!`), chargerEvenements);
});
