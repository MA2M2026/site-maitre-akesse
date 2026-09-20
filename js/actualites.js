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

const quillActuCommentaire = creerEditeurRiche('actu-commentaire-editeur');
const quillEditActuCommentaire = creerEditeurRiche('edit-actu-commentaire-editeur');

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
      <div class="news-une-photo">
        <img src="${echapperHtml(une.image_url)}" loading="lazy" alt="${echapperHtml(une.titre || '')}">
        <span class="news-une-badge">★ À la une</span>
      </div>
      <div class="news-une-corps">
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
    mediaHtml += `<div class="news-modal-galerie">${listePhotos.map(p => `<img src="${echapperHtml(p.url)}" loading="lazy" alt="">`).join('')}</div>`;
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
  document.getElementById('news-modal-edition').style.display = 'none';
  document.getElementById('news-modal-titre').style.display = 'block';
  document.getElementById('news-modal-texte').style.display = 'block';
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
    if (!sb) return;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data } = await sb.from('admins').select('user_id').eq('user_id', user.id).single();
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
  document.getElementById('edit-actu-titre').value = a.titre || '';
  document.getElementById('edit-actu-categorie').value = a.categorie || '';
  chargerContenuDansEditeur(quillEditActuCommentaire, a.commentaire);
  document.getElementById('edit-actu-video').value = a.video_url || '';
  document.getElementById('edit-actu-images').value = '';
  document.getElementById('edit-actu-msg').style.display = 'none';

  document.getElementById('news-modal-titre').style.display = 'none';
  document.getElementById('news-modal-texte').style.display = 'none';
  document.getElementById('news-modal-video-lien').style.display = 'none';
  document.getElementById('news-modal-admin-actions').style.display = 'none';
  document.getElementById('news-modal-edition').style.display = 'block';
});

document.getElementById('edit-actu-annuler-btn').addEventListener('click', () => {
  document.getElementById('news-modal-edition').style.display = 'none';
  document.getElementById('news-modal-titre').style.display = 'block';
  document.getElementById('news-modal-texte').style.display = 'block';
  if (document.getElementById('news-modal-video-lien').href && document.getElementById('news-modal-video-lien').href !== '#' && !document.getElementById('news-modal-video-lien').href.endsWith('/#')) {
    document.getElementById('news-modal-video-lien').style.display = 'inline-block';
  }
  document.getElementById('news-modal-admin-actions').style.display = 'block';
});

document.getElementById('edit-actu-enregistrer-btn').addEventListener('click', async () => {
  const id = window.actualiteModalCourante;
  const msg = document.getElementById('edit-actu-msg');
  const titre = document.getElementById('edit-actu-titre').value.trim();
  const categorie = document.getElementById('edit-actu-categorie').value;
  const commentaire = lireContenuEditeur(quillEditActuCommentaire);
  const videoUrl = document.getElementById('edit-actu-video').value.trim();
  const fichiers = Array.from(document.getElementById('edit-actu-images').files || []);

  msg.className = 'form-msg ok'; msg.textContent = 'Enregistrement…'; msg.style.display = 'block';

  const { error: erreurUpdate } = await sb.from('actualites').update({ titre, categorie: categorie || null, commentaire, video_url: videoUrl }).eq('id', id);
  if (erreurUpdate) { msg.className = 'form-msg err'; msg.textContent = "Erreur lors de la modification."; return; }

  if (fichiers.length) {
    msg.textContent = `Ajout de ${fichiers.length} nouvelle(s) photo(s)…`;
    let premiereNouvellePhoto = null;
    for (const fichierOriginal of fichiers) {
      const fichier = await convertirSiHeic(fichierOriginal);
      const chemin = `${id}/${Date.now()}-${nomFichierSur(fichier.name)}`;
      const { error: erreurUpload } = await sb.storage.from('actualites-images').upload(chemin, fichier);
      if (erreurUpload) continue;
      const { data: urlPublique } = sb.storage.from('actualites-images').getPublicUrl(chemin);
      await sb.from('actualite_photos').insert({ actualite_id: id, url: urlPublique.publicUrl, chemin: chemin });
      if (!premiereNouvellePhoto) premiereNouvellePhoto = urlPublique.publicUrl;
    }
    const { data: actuActuelle } = await sb.from('actualites').select('image_url').eq('id', id).single();
    if (!actuActuelle.image_url && premiereNouvellePhoto) {
      await sb.from('actualites').update({ image_url: premiereNouvellePhoto }).eq('id', id);
    }
  }

  msg.className = 'form-msg ok'; msg.textContent = 'Modifications enregistrées !';
  await chargerActualites();
  const index = window.actualitesData.findIndex(x => x.id === id);
  if (index > -1) ouvrirActuModal(index);
});

document.getElementById('news-modal-supprimer-btn').addEventListener('click', async () => {
  const id = window.actualiteModalCourante;
  if (!confirm('Supprimer définitivement cette actualité et toutes ses photos ?')) return;
  const { data: photos } = await sb.from('actualite_photos').select('chemin').eq('actualite_id', id);
  const chemins = (photos || []).map(p => p.chemin).filter(Boolean);
  if (chemins.length) await sb.storage.from('actualites-images').remove(chemins);
  await sb.from('actualites').delete().eq('id', id);
  fermerNewsModal();
  chargerActualites();
});

document.getElementById('admin-logout-btn').addEventListener('click', async () => {
  await sb.auth.signOut();
  document.getElementById('admin-bloc').style.display = 'none';
  window.estAdminConnecte = false;
});

document.getElementById('actu-publier-btn').addEventListener('click', async () => {
  const msg = document.getElementById('actu-msg');
  const titre = document.getElementById('actu-titre').value.trim();
  const categorie = document.getElementById('actu-categorie').value;
  const commentaire = lireContenuEditeur(quillActuCommentaire);
  const videoUrl = document.getElementById('actu-video').value.trim();
  const fichierInput = document.getElementById('actu-image');
  const fichiers = Array.from(fichierInput.files || []);

  if (!fichiers.length && !videoUrl) {
    msg.className = 'form-msg err'; msg.textContent = 'Choisis au moins une image ou ajoute un lien vidéo.'; msg.style.display = 'block';
    return;
  }

  msg.className = 'form-msg ok'; msg.textContent = `Envoi de ${fichiers.length} photo(s) en cours…`; msg.style.display = 'block';

  const idActualite = crypto.randomUUID();
  const urls = [];

  for (const fichierOriginal of fichiers) {
    const fichier = await convertirSiHeic(fichierOriginal);
    const chemin = `${idActualite}/${Date.now()}-${nomFichierSur(fichier.name)}`;
    const { error: erreurUpload } = await sb.storage.from('actualites-images').upload(chemin, fichier);
    if (erreurUpload) continue;
    const { data: urlPublique } = sb.storage.from('actualites-images').getPublicUrl(chemin);
    urls.push({ url: urlPublique.publicUrl, chemin });
  }

  const { error: erreurInsert } = await sb.from('actualites').insert({
    id: idActualite, titre, categorie: categorie || null, commentaire, video_url: videoUrl,
    image_url: urls.length ? urls[0].url : null
  });
  if (erreurInsert) { msg.className = 'form-msg err'; msg.textContent = "Erreur d'enregistrement."; msg.style.display = 'block'; return; }

  for (const photo of urls) {
    await sb.from('actualite_photos').insert({ actualite_id: idActualite, url: photo.url, chemin: photo.chemin });
  }

  msg.className = 'form-msg ok'; msg.textContent = `Actualité publiée avec ${urls.length} photo(s) !`; msg.style.display = 'block';
  document.getElementById('actu-titre').value = '';
  document.getElementById('actu-categorie').value = '';
  if (quillActuCommentaire) quillActuCommentaire.setText('');
  document.getElementById('actu-video').value = '';
  fichierInput.value = '';
  chargerActualites();
});
