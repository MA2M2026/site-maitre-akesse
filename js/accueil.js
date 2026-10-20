// Page d'accueil, français et anglais (index.html et en/index.html) : un seul script
// (11/10/2026 : avant, js/accueil.js et js/accueil-en.js, deux copies). EN, T : js/app.js.

// La porte d'entrée (3 photos et bouton « Entrer ») a été remplacée le 20/10/2026 par la
// couverture du magazine (accueil « Magazine 3 », css/magazine-accueil.css) : la couverture
// montre le mannequin à la une (chargerMannequinVedette, plus bas).

// --- Intro : logo animé (5,8 s ou « Passer l'intro »), avant le magazine ---
// (L'affichage se fait plus tôt, tout en haut de <body> : ce bloc ne gère que la fermeture.)
(function () {
  if (!document.documentElement.classList.contains('intro-a-venir')) return;

  function terminerIntro() {
    document.documentElement.classList.remove('intro-a-venir');
    document.body.classList.remove('splash-active');
    try { sessionStorage.setItem('ma2m_intro_vue', '1'); } catch (e) {}
  }

  document.getElementById('splash-passer').addEventListener('click', terminerIntro);
  // Durée donnée par js/intro-faisceau.js quand l'intro animée tourne (sinon logo fixe : 5,8 s).
  setTimeout(terminerIntro, window.MA2M_INTRO_DUREE || 5800);
})();

// --- Photos d'illustration du magazine (édito, agence, dos) : photos de mannequins publiés,
// tirées au hasard (avant le 20/10/2026 : les 3 photos de la porte d'entrée) ---
async function chargerPhotosMagazine() {
  const images = Array.from(document.querySelectorAll('img[data-photo-aleatoire]'));
  if (!images.length) return;
  const CLE_CACHE = 'ma2m_photos_magazine';
  // roue de secours (relais, JPEG) gérée par prechargerPhoto (app.js)
  const afficher = (urls) => melanger(urls).slice(0, images.length).forEach((url, i) => {
    prechargerPhoto(urlLegere(url), ok => { images[i].src = ok; });
  });

  let cache = [];
  try { cache = JSON.parse(localStorage.getItem(CLE_CACHE) || '[]'); } catch (e) {}
  if (cache.length) afficher(cache);

  if (!sb) return;
  const { data } = await sb
    .from('model_photos')
    .select('url, url_moyenne, model_id, model_profiles!inner(published)')
    .eq('model_profiles.published', true)
    .order('created_at', { ascending: false })
    .limit(120);

  const parMannequin = new Map();
  melanger(data || []).forEach(p => {
    if (!parMannequin.has(p.model_id)) parMannequin.set(p.model_id, urlLegere(p.url_moyenne || p.url));
  });
  const urls = Array.from(parMannequin.values());
  if (urls.length) {
    try { localStorage.setItem(CLE_CACHE, JSON.stringify(urls)); } catch (e) {}
    if (!cache.length) afficher(urls);
  }
}
void chargerPhotosMagazine();

// --- Bande d'annonce défilante ---
async function chargerBandeauAnnonce() {
  if (!sb) return;
  const { data } = await sb.from('bandeau_annonce').select('texte, actif').eq('id', 'principal').maybeSingle();
  if (data && data.actif && data.texte && data.texte.trim()) {
    const texte = data.texte.trim() + ' · ';
    document.querySelectorAll('#marqueePiste span').forEach(span => { span.textContent = texte; });
    document.getElementById('marqueeLabel').style.display = 'flex';
    document.getElementById('marqueeBande').classList.add('marquee-annonce-active');
    // La case « Prochains castings » garde son propre texte (le bandeau sert aussi à d'autres annonces).
  }
}
void chargerBandeauAnnonce();

// --- Flux Instagram : publications mises en cache depuis le tableau de bord ---
// (Les pages du magazine se montrent en retirant u-hidden : un display forcé casserait leur mise
// en page, css/magazine-accueil.css.)
async function chargerFluxInstagram() {
  if (!sb) return;
  const { data } = await sb.from('instagram_posts_cache').select('posts').eq('id', 'principal').maybeSingle();
  const posts = data && Array.isArray(data.posts) ? data.posts : [];
  if (!posts.length) return;

  const grille = document.getElementById('instagram-grille');
  grille.innerHTML = posts.slice(0, 8).map(p => `
    <a href="${echapperHtml(/^https:\/\//i.test(p.lien || '') ? p.lien : 'https://www.instagram.com/maitreakessemodelmanagement')}" target="_blank" rel="noopener" class="instagram-vignette" title="${echapperHtml(p.legende || '')}">
      <img src="${echapperHtml(p.image)}" alt="${echapperHtml(p.legende || T('Publication Instagram', 'Instagram post'))}" loading="lazy">
    </a>
  `).join('');
  document.getElementById('flux-instagram').classList.remove('u-hidden');
}
void chargerFluxInstagram();

// --- Médaillons d'accueil : quelques mannequins publiés en aperçu ---
async function chargerMedaillonsAccueil() {
  const conteneur = document.getElementById('medaillons-accueil');
  if (!sb) { conteneur.textContent = ''; return; } // pas de cartes d'attente qui resteraient vides
  const { data: profils } = await sb.from('model_profiles').select('id, full_name, city, height_cm').eq('published', true).order('created_at', { ascending: false }).limit(6);
  if (!profils || !profils.length) { conteneur.innerHTML = `<p class="u-texte-gris">${T('Profils bientôt disponibles.', 'Profiles coming soon.')}</p>`; return; }

  // Une seule demande groupée pour toutes les photos (la même que dans le Book), au lieu d'une par mannequin.
  const { data: couvertures } = await sb.rpc('photos_couverture_mannequins', { ids: profils.map(p => p.id) });
  const photoPar = {}; (couvertures || []).forEach(c => { photoPar[c.model_id] = urlLegere(c.url); });
  conteneur.textContent = ''; // retire les cartes d'attente (même taille : rien ne bouge)
  for (const profil of profils) {
    const photoUrl = photoPar[profil.id] || (EN ? '../' : '') + 'assets/logo-dark-bg.png';
    const carte = document.createElement('a');
    carte.href = 'mannequin.html?id=' + profil.id;
    carte.className = 'medaillon-carte reveal';
    carte.innerHTML = `
      <div class="medaillon-photo"><img src="${echapperHtml(photoUrl)}" alt="${echapperHtml(profil.full_name || '')}" loading="lazy"></div>
      <div class="medaillon-nom">${echapperHtml(profil.full_name || T('Mannequin', 'Model'))}</div>
      <div class="medaillon-info">${echapperHtml(profil.city || '')}${profil.height_cm ? ' · ' + profil.height_cm + ' cm' : ''}</div>
    `;
    conteneur.appendChild(carte);
  }
}
void chargerMedaillonsAccueil();

// --- Mannequin à la une ---
async function chargerMannequinVedette() {
  if (!sb) return;
  let { data: profil } = await sb.from('model_profiles')
    .select('id, full_name, city, category, height_cm')
    .eq('published', true).eq('featured', true).limit(1).maybeSingle();

  if (!profil) {
    const { data: recent } = await sb.from('model_profiles')
      .select('id, full_name, city, category, height_cm')
      .eq('published', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    profil = recent;
  }
  if (!profil) return;

  const { data: photos } = await sb.from('model_photos').select('url, url_moyenne').eq('model_id', profil.id).order('created_at', { ascending: true }).limit(1);
  const premiere = photos?.[0];
  const photoUrl = premiere ? urlLegere(premiere.url_moyenne || premiere.url) : (EN ? '../' : '') + 'assets/logo-dark-bg.png';
  const libelleCategorie = profil.category === 'homme' ? T('Homme', 'Male') : profil.category === 'femme' ? T('Femme', 'Female') : 'New Face';

  document.getElementById('vedette-img').src = photoUrl;
  document.getElementById('vedette-img').alt = profil.full_name || '';
  document.getElementById('vedette-nom').textContent = profil.full_name || T('Mannequin', 'Model');
  const longueurNom = (profil.full_name || '').length;
  document.getElementById('vedette-nom').classList.toggle('nom-long', longueurNom > 18 && longueurNom <= 28);
  document.getElementById('vedette-nom').classList.toggle('nom-tres-long', longueurNom > 28);
  document.getElementById('vedette-info').textContent = [libelleCategorie, profil.city, profil.height_cm ? profil.height_cm + ' cm' : null].filter(Boolean).join(' · ');
  document.getElementById('vedette-lien').href = 'mannequin.html?id=' + profil.id;
  document.getElementById('mannequin-vedette').classList.remove('u-hidden');
}
window.promesseVedette = chargerMannequinVedette();

// Place réservée (classe .section-reservee, css/style.css) : libérée dès que le
// chargement est terminé — bloc affiché, ou masqué s'il n'y a rien à montrer —
// et au plus tard après 15 s (connexion coupée).
// Le site mémorise si le bloc était vide : à la visite suivante, pas de place réservée
// (lu tout en haut de index.html, classe html.vide-…).
function libererSectionReservee(id, chargementTermine) {
  const section = document.getElementById(id);
  if (!section) return;
  section.classList.remove('section-reservee');
  if (!chargementTermine) return;
  try { localStorage.setItem('ma2m_bloc_vide_' + id, section.classList.contains('u-hidden') ? '1' : '0'); } catch (e) {}
}
void Promise.resolve(window.promesseVedette).catch(() => {}).then(() => libererSectionReservee('mannequin-vedette', true));
setTimeout(() => libererSectionReservee('mannequin-vedette'), 15000);

// --- Mot du fondateur : photo et message modifiables depuis le tableau de bord ---
async function chargerMotResponsable() {
  if (!sb) return;
  const { data } = await sb.from('mot_responsable').select('*').eq('id', 'principal').maybeSingle();
  if (!data || !data.message) return;

  document.getElementById('mot-resp-nom').textContent = data.nom || 'Maître Akesse';
  document.getElementById('mot-resp-titre').textContent = data.titre || '';
  document.getElementById('mot-resp-message').textContent = data.message;

  if (data.photo_url) {
    const photo = document.getElementById('mot-resp-photo');
    // le secours des photos peut remplacer l'adresse après une erreur : on réaffiche si elle finit par arriver
    photo.onerror = () => { photo.style.display = 'none'; };
    photo.onload = () => { photo.style.display = 'block'; };
    photo.src = urlLegere(data.photo_url);
    photo.alt = data.nom || 'Maître Akesse';
    photo.style.display = 'block';
  }
  document.getElementById('mot-responsable').classList.remove('u-hidden');
}
void Promise.resolve(chargerMotResponsable()).catch(() => {}).then(() => libererSectionReservee('mot-responsable', true));
setTimeout(() => libererSectionReservee('mot-responsable'), 15000);

// --- Bandeau « Ils nous ont fait confiance » ---
async function chargerBandeauConfiance() {
  if (!sb) return;
  const { data } = await sb.from('partenaires').select('id, nom, logo_url').order('created_at', { ascending: false }).limit(14);
  if (!data || !data.length) return;

  const avecLogo = data.filter(p => p.logo_url);
  if (!avecLogo.length) return;

  document.getElementById('confiance-liste').innerHTML = avecLogo.map(p => `
    <a href="partenaires.html?partenaire=${p.id}" class="confiance-carte" title="${echapperHtml(p.nom || '')}">
      <img src="${echapperHtml(urlLegere(p.logo_url))}" alt="${echapperHtml(p.nom || '')}" loading="lazy">
    </a>
  `).join('');
  document.getElementById('ils-nous-font-confiance').classList.remove('u-hidden');
}
void chargerBandeauConfiance();

// Bande de chiffres retirée le 06/10/2026 (remplacée par l'entrée « Femmes · Hommes ·
// New Faces » écrite directement dans la page, section #stat-strip).
