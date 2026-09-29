async function convertirSiHeic(fichier) {
  const estHeic = /image\/hei(c|f)/i.test(fichier.type) || /\.(heic|heif)$/i.test(fichier.name);
  if (!estHeic || typeof heic2any === 'undefined') return fichier;
  try {
    const resultat = await heic2any({ blob: fichier, toType: 'image/jpeg', quality: 0.85 });
    const blobFinal = Array.isArray(resultat) ? resultat[0] : resultat;
    return new File([blobFinal], fichier.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  } catch (e) { return fichier; }
}

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

// Sécurité : n'autorise un lien cliquable que s'il s'agit bien d'une vraie adresse web
// (http/https) — bloque les liens piégés du type "javascript:..." ou "data:...".
function urlHttpSure(url) {
  if (!url) return null;
  try {
    const u = new URL(url, window.location.href);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null;
  } catch (e) { return null; }
}

const CATEGORIES_ACTUALITES = ['Casting', 'Mannequinat', 'Conseils', 'Événements'];

const quillRedaction = creerEditeurRiche('red-editeur', 'Racontez votre actualité ici… (vous pouvez coller un texte déjà mis en forme)');

function formatDateActu(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function extraitTexte(texte, longueur) {
  if (!texte) return '';
  return texte.length > longueur ? texte.slice(0, longueur).trim() + '…' : texte;
}

function afficherFiltresCategories(data) {
  const conteneur = document.getElementById('actus-filtres');
  const categoriesPresentes = CATEGORIES_ACTUALITES.filter(cat => data.some(a => a.categorie === cat));
  if (categoriesPresentes.length < 2) { conteneur.style.display = 'none'; return; }

  conteneur.style.display = 'flex';
  conteneur.innerHTML = ['Toutes', ...categoriesPresentes].map(cat => `
    <button class="filtre-categorie${cat === 'Toutes' ? ' actif' : ''}" data-categorie="${echapperHtml(cat)}">${echapperHtml(cat)}</button>
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
    vide.textContent = 'Le chargement des actualités a échoué (connexion instable ?). Rechargez la page.';
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
      <img src="${echapperHtml(une.image_url)}" loading="lazy" alt="${echapperHtml(une.titre || '')}">
      <div class="news-une-scrim"></div>
      <div class="news-une-corps">
        <span class="news-une-badge">★ À la une</span>
        ${une.categorie ? `<span class="news-categorie">${echapperHtml(une.categorie)}</span>` : ''}
        <div class="news-date">${formatDateActu(une.created_at)}</div>
        ${une.titre ? `<h2>${echapperHtml(une.titre)}</h2>` : ''}
        ${une.commentaire ? `<p>${echapperHtml(extraitTexte(texteBrutDepuis(une.commentaire), 180))}</p>` : ''}
        <span class="news-lire">Lire l'article →</span>
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
        <img src="${echapperHtml(a.image_url)}" loading="lazy" alt="${echapperHtml(a.titre || '')}">
        ${a.video_url ? '<span class="news-play">▶</span>' : ''}
        ${nbPhotos > 1 ? `<span class="news-compteur-photos">${nbPhotos}</span>` : ''}
      </div>
      <div class="news-corps">
        ${a.categorie ? `<span class="news-categorie">${echapperHtml(a.categorie)}</span>` : ''}
        <div class="news-date">${formatDateActu(a.created_at)}</div>
        ${a.titre ? `<h3>${echapperHtml(a.titre)}</h3>` : ''}
        ${a.commentaire ? `<p class="news-extrait">${echapperHtml(extraitTexte(texteBrutDepuis(a.commentaire), 110))}</p>` : ''}
        <span class="news-lire">Lire la suite →</span>
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
    if (index > -1) ouvrirActuModal(index);
  }
}
chargerActualites();

async function ouvrirActuModal(index) {
  const a = window.actualitesData[index];
  const videoEmbed = urlVideoIntegree(a.video_url);
  const zoneMedia = document.getElementById('news-modal-media');

  const { data: photos } = await sb.from('actualite_photos').select('url').eq('actualite_id', a.id).order('created_at', { ascending: true });
  const listePhotos = (photos && photos.length) ? photos : (a.image_url ? [{ url: a.image_url }] : []);

  let mediaHtml = '';
  if (videoEmbed) {
    mediaHtml += `<div class="video-runway news-modal-video-embed"><iframe src="${echapperHtml(videoEmbed)}" allowfullscreen loading="lazy"></iframe></div>`;
  }
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

  document.getElementById('news-modal-date').textContent = new Date(a.created_at).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' });
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
// Verrouille le défilement de la page tant que la fiche est ouverte (même mécanisme,
// compatible iPhone, que celui du menu — voir js/app.js).
let newsModalEstOuverte = false;
function ouvrirNewsModal() {
  document.getElementById('news-modal').classList.add('active');
  if (!newsModalEstOuverte) { newsModalEstOuverte = true; window.verrouillerDefilement(); }
}
function fermerNewsModal() {
  document.getElementById('news-modal').classList.remove('active');
  if (window.ficheFermee) window.ficheFermee();
  if (newsModalEstOuverte) { newsModalEstOuverte = false; window.deverrouillerDefilement(); }
}
document.getElementById('news-modal-fermer').addEventListener('click', fermerNewsModal);
document.getElementById('news-modal').addEventListener('click', (e) => { if (e.target.id === 'news-modal') fermerNewsModal(); });

// Aucune interface de connexion sur cette page publique : un admin se connecte
// depuis tableau-de-bord.html, puis sa session est simplement détectée ici pour
// révéler le panneau de publication — sans aucune trace visible pour un visiteur.
async function verifierAdmin() {
  // Sur une connexion instable, la bibliothèque Supabase (chargée depuis un
  // CDN) peut échouer à se charger — sans ce filet, "sb" vaut alors null et
  // cette vérification silencieuse plante toute la page au chargement pour
  // un simple visiteur, pour une fonctionnalité qui ne concerne que l'admin.
  try {
    if (!sbAdmin) return;
    const { data: { user } } = await sbAdmin.auth.getUser();
    if (!user) return;
    const { data } = await sbAdmin.from('admins').select('user_id').eq('user_id', user.id).single();
    if (data) {
      window.estAdminConnecte = true;
      document.getElementById('admin-bloc').style.display = 'block';
    }
  } catch (e) {}
}
verifierAdmin();

// --- Modification / suppression directement depuis la fiche ouverte (admin) ---
document.getElementById('news-modal-modifier-btn').addEventListener('click', () => {
  const a = window.actualitesData.find(x => x.id === window.actualiteModalCourante);
  if (!a) return;
  fermerNewsModal();
  ouvrirRedaction(a);
});

document.getElementById('news-modal-supprimer-btn').addEventListener('click', async () => {
  const id = window.actualiteModalCourante;
  if (!confirm('Supprimer définitivement cette actualité et toutes ses photos ?')) return;
  const { data: photos } = await sbAdmin.from('actualite_photos').select('chemin').eq('actualite_id', id);
  const chemins = (photos || []).map(p => p.chemin).filter(Boolean);
  // Base d'abord : si la suppression échoue, les images restent intactes.
  const { error: erreurSuppression } = await sbAdmin.from('actualites').delete().eq('id', id);
  if (erreurSuppression) { alert('La suppression a échoué. Réessayez.'); return; }
  if (chemins.length) await supprimerCheminsImagesSite('actualites', 'actualites-images', chemins);
  fermerNewsModal();
  chargerActualites();
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
  document.getElementById('redaction-titre-mode').textContent = actualiteExistante ? 'Modifier l’actualité' : 'Rédiger une actualité';
  document.getElementById('red-titre').value = actualiteExistante ? (actualiteExistante.titre || '') : '';
  document.getElementById('red-categorie').value = actualiteExistante ? (actualiteExistante.categorie || '') : '';
  chargerContenuDansEditeur(quillRedaction, actualiteExistante ? actualiteExistante.commentaire : '');
  document.getElementById('red-video').value = actualiteExistante ? (actualiteExistante.video_url || '') : '';
  document.getElementById('red-images').value = '';
  document.getElementById('red-images-label').textContent = actualiteExistante ? 'Ajouter des photos (s’ajoutent à celles déjà en ligne)' : 'Images (tu peux en sélectionner plusieurs à la fois)';
  document.getElementById('red-enregistrer-btn').textContent = actualiteExistante ? 'Enregistrer' : 'Publier';
  document.getElementById('red-supprimer-btn').classList.toggle('u-hidden', !actualiteExistante);
  document.getElementById('red-msg').style.display = 'none';
  document.getElementById('red-images-apercu').innerHTML = '';
  apercuImageCouverture(actualiteExistante ? actualiteExistante.image_url : null);
  mettreAJourApercuRedaction();
  document.getElementById('redaction-overlay').classList.add('active');
  window.verrouillerDefilement();
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

function mettreAJourApercuRedaction() {
  const titre = document.getElementById('red-titre').value.trim();
  const categorie = document.getElementById('red-categorie').value;
  document.getElementById('red-apercu-titre').textContent = titre || 'Titre de l’actualité';
  const catEl = document.getElementById('red-apercu-categorie');
  catEl.textContent = categorie || '';
  catEl.classList.toggle('u-hidden', !categorie);
  document.getElementById('red-apercu-date').textContent = formatDateActu(new Date().toISOString());
  document.getElementById('red-apercu-texte').innerHTML = rendreContenuRiche(lireContenuEditeur(quillRedaction));
}
document.getElementById('red-titre').addEventListener('input', mettreAJourApercuRedaction);
document.getElementById('red-categorie').addEventListener('change', mettreAJourApercuRedaction);
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
  const categorie = document.getElementById('red-categorie').value;
  const commentaire = lireContenuEditeur(quillRedaction);
  const videoUrl = document.getElementById('red-video').value.trim();
  const fichiers = redactionNouvellesImages;

  if (!redactionIdEnCours && !fichiers.length && !videoUrl) {
    msg.className = 'form-msg err'; msg.textContent = 'Choisis au moins une image ou ajoute un lien vidéo.'; msg.style.display = 'block';
    return;
  }

  msg.className = 'form-msg ok'; msg.textContent = fichiers.length ? `Envoi de ${fichiers.length} photo(s) en cours…` : 'Enregistrement…'; msg.style.display = 'block';

  const id = redactionIdEnCours || crypto.randomUUID();
  const urls = [];
  for (const fichierOriginal of fichiers) {
    const fichier = await convertirSiHeic(fichierOriginal);
    const chemin = `site/actualites/${id}/${Date.now()}-${nomFichierSur(fichier.name)}`;
    try {
      const url = await envoyerImageSite('actualites', chemin, fichier);
      urls.push({ url, chemin });
    } catch (e) { continue; }
  }

  if (redactionIdEnCours) {
    const { error: erreurUpdate } = await sbAdmin.from('actualites').update({ titre, categorie: categorie || null, commentaire, video_url: videoUrl }).eq('id', id);
    if (erreurUpdate) { msg.className = 'form-msg err'; msg.textContent = "Erreur lors de la modification."; return; }
    for (const photo of urls) {
      await sbAdmin.from('actualite_photos').insert({ actualite_id: id, url: photo.url, chemin: photo.chemin });
    }
    if (urls.length) {
      const { data: actuActuelle } = await sbAdmin.from('actualites').select('image_url').eq('id', id).single();
      if (!actuActuelle.image_url) await sbAdmin.from('actualites').update({ image_url: urls[0].url }).eq('id', id);
    }
    msg.className = 'form-msg ok'; msg.textContent = 'Modifications enregistrées !';
  } else {
    const { error: erreurInsert } = await sbAdmin.from('actualites').insert({
      id, titre, categorie: categorie || null, commentaire, video_url: videoUrl,
      image_url: urls.length ? urls[0].url : null
    });
    if (erreurInsert) { msg.className = 'form-msg err'; msg.textContent = "Erreur d'enregistrement."; msg.style.display = 'block'; return; }
    for (const photo of urls) {
      await sbAdmin.from('actualite_photos').insert({ actualite_id: id, url: photo.url, chemin: photo.chemin });
    }
    msg.className = 'form-msg ok'; msg.textContent = `Actualité publiée avec ${urls.length} photo(s) !`;
  }

  await chargerActualites();
  setTimeout(fermerRedaction, 900);
});

document.getElementById('red-supprimer-btn').addEventListener('click', async () => {
  if (!redactionIdEnCours) return;
  if (!confirm('Supprimer définitivement cette actualité et toutes ses photos ?')) return;
  const id = redactionIdEnCours;
  const { data: photos } = await sbAdmin.from('actualite_photos').select('chemin').eq('actualite_id', id);
  const chemins = (photos || []).map(p => p.chemin).filter(Boolean);
  // Base d'abord : si la suppression échoue, les images restent intactes.
  const { error: erreurSuppression } = await sbAdmin.from('actualites').delete().eq('id', id);
  if (erreurSuppression) { alert('La suppression a échoué. Réessayez.'); return; }
  if (chemins.length) await supprimerCheminsImagesSite('actualites', 'actualites-images', chemins);
  fermerRedaction();
  chargerActualites();
});
