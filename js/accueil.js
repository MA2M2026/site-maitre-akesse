// --- Porte d'entrée : le défilement reste verrouillé tant qu'on n'a pas cliqué "Entrer".
// (Le masquage de la porte déjà ouverte, ET le verrouillage du défilement lui-même,
// se font plus tôt — tout en haut de <body>, voir le commentaire à ce sujet dans le
// HTML — pour éviter qu'elle n'apparaisse, ou reste défilable, un instant avant que ce
// script, chargé en fin de page, ne s'exécute.)
document.getElementById('entrer-btn').addEventListener('click', async () => {
  // Réaction immédiate à l'appui, puis 1,5 s d'attente au plus pour le mannequin à la une
  // (05/10/2026 : jusqu'à 4 s sans aucun signe sur une connexion lente).
  const bouton = document.getElementById('entrer-btn');
  if (bouton.dataset.ouverture) return;
  bouton.dataset.ouverture = '1';
  bouton.classList.add('entrer-en-cours');
  if (window.jouerSon) window.jouerSon('entree');
  if (window.promesseVedette) {
    try { await Promise.race([window.promesseVedette, new Promise((r) => setTimeout(r, 1500))]); } catch (e) {}
  }
  document.body.classList.remove('porte-verrouillee');
  document.documentElement.classList.remove('porte-verrouillee');
  window.deverrouillerDefilement();
  document.getElementById('porte-entree').style.display = 'none';
  window.scrollTo(0, 0);
  try { sessionStorage.setItem('ma2m_porte_ouverte', '1'); } catch (e) {}
});

// --- Intro : logo animé (5,8s ou "Passer l'intro"), avant la porte d'entrée ---
// (L'affichage lui-même se fait plus tôt — tout en haut de <body>, voir le
// commentaire à ce sujet dans le HTML — pour éviter qu'un instant de la porte
// d'entrée (le texte "MA2M") n'apparaisse avant que ce script, chargé en fin de
// page, ne s'exécute. Ce bloc ne gère donc plus que la fermeture.)
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

// --- Photo de fond de la porte d'entrée ---

async function chargerPhotosHero() {

  const imagesHero =
    Array.from(document.querySelectorAll('.hero-slide .hero-v2-bg'));

  const CLE_CACHE = 'ma2m_hero_photos';


  const melanger = (liste) => {

    const copie = liste.slice();

    for (let i = copie.length - 1; i > 0; i--) {

      const j = Math.floor(Math.random() * (i + 1));

      [copie[i], copie[j]] =
        [copie[j], copie[i]];

    }

    return copie;

  };


  const afficher = (img, url) => {

    if (!url) return;

    const preload = new Image();

    preload.onload = () => {
      img.src = url;
    };

    preload.src = url;

  };


  let cache = [];

  try {
    cache =
      JSON.parse(
        localStorage.getItem(CLE_CACHE) || '[]'
      );
  } catch (e) {}


  if (cache.length) {

    melanger(cache)
      .slice(0, imagesHero.length)
      .forEach((url, i) => {
        afficher(imagesHero[i], url);
      });

  }


  if (!sb) return;


  const { data } = await sb
    .from('model_photos')
    .select('url, url_moyenne, model_id, model_profiles!inner(published)')
    .eq('model_profiles.published', true)
    .order('created_at', { ascending: false })
    .limit(120);


  const parMannequin = new Map();

  melanger(data || []).forEach(p => {

    if (!parMannequin.has(p.model_id)) {
      parMannequin.set(p.model_id, p.url_moyenne || p.url);
    }

  });


  const urls =
    melanger(Array.from(parMannequin.values()));


  if (urls.length) {

    try {
      localStorage.setItem(
        CLE_CACHE,
        JSON.stringify(urls)
      );
    } catch (e) {}


    if (!cache.length) {

      melanger(urls)
        .slice(0, imagesHero.length)
        .forEach((url, i) => {
          afficher(imagesHero[i], url);
        });

    }

  }

}

chargerPhotosHero();


// --- Bande d'annonce défilante ---

async function chargerBandeauAnnonce() {

  if (!sb) return;

  const { data } = await sb
    .from('bandeau_annonce')
    .select('texte, actif')
    .eq('id', 'principal')
    .maybeSingle();


  if (
    data &&
    data.actif &&
    data.texte &&
    data.texte.trim()
  ) {

    const texte =
      data.texte.trim() + ' · ';


    document
      .querySelectorAll('#marqueePiste span')
      .forEach(span => {
        span.textContent = texte;
      });


    document
      .getElementById('marqueeLabel')
      .style.display = 'flex';


    document
      .getElementById('marqueeBande')
      .classList.add('marquee-annonce-active');

    // (30/09 → 05/10) La case « Prochains castings » garde son propre texte : le
    // bandeau « Infos du jour » sert aussi à d'autres annonces (ex. un anniversaire).

  }

}

chargerBandeauAnnonce();


// --- Flux Instagram ---

async function chargerFluxInstagram() {

  if (!sb) return;

  const { data } = await sb
    .from('instagram_posts_cache')
    .select('posts')
    .eq('id', 'principal')
    .maybeSingle();


  const posts =
    data && Array.isArray(data.posts)
      ? data.posts
      : [];


  if (!posts.length) return;


  const grille =
    document.getElementById('instagram-grille');


  grille.innerHTML =
    posts
      .slice(0, 8)
      .map(p => `
        <a
          href="${echapperHtml(/^https:\/\//i.test(p.lien || '') ? p.lien : 'https://www.instagram.com/maitreakessemodelmanagement')}"
          target="_blank"
          rel="noopener"
          class="instagram-vignette"
          title="${echapperHtml(p.legende || '')}"
        >
          <img
            src="${echapperHtml(p.image)}"
            alt="${echapperHtml(p.legende || 'Publication Instagram')}"
            loading="lazy"
          >
        </a>
      `)
      .join('');


  document
    .getElementById('flux-instagram')
    .style.display = 'block';

}

chargerFluxInstagram();


// --- Carrousel du hero ---

(function initCarrouselHero() {

  const slides =
    Array.from(
      document.querySelectorAll('.hero-slide')
    );


  const dotsConteneur =
    document.getElementById('heroDots');


  if (!slides.length || !dotsConteneur) return;


  let indexActif = 0;

  let minuteur = null;


  const reduitMouvement =
    window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;


  slides.forEach((_, i) => {

    const point =
      document.createElement('span');


    if (i === 0) {
      point.classList.add('actif');
    }


    point.addEventListener(
      'click',
      () => allerAuSlide(i)
    );


    dotsConteneur.appendChild(point);

  });


  const points =
    Array.from(dotsConteneur.children);


  function allerAuSlide(i) {

    slides[indexActif]
      .classList
      .remove('active');


    points[indexActif]
      .classList
      .remove('actif');


    indexActif = i;


    slides[indexActif]
      .classList
      .add('active');


    points[indexActif]
      .classList
      .add('actif');

  }


  function suivant() {

    allerAuSlide(
      (indexActif + 1) % slides.length
    );

  }


  if (!reduitMouvement && slides.length > 1) {

    minuteur =
      setInterval(suivant, 6000);

  }

})();


// --- Médaillons d'accueil ---

async function chargerMedaillonsAccueil() {

  if (!sb) return;


  const conteneur =
    document.getElementById(
      'medaillons-accueil'
    );


  const { data: profils } =
    await sb
      .from('model_profiles')
      .select(
        'id, full_name, city, height_cm'
      )
      .eq('published', true)
      .order(
        'created_at',
        { ascending: false }
      )
      .limit(6);


  if (!profils || !profils.length) {

    conteneur.innerHTML =
      '<p class="u-texte-gris">Profils bientôt disponibles.</p>';

    return;

  }


  // Une seule demande groupée pour toutes les photos (la même photo que dans le Book),
  // au lieu d'une demande par mannequin, faites l'une après l'autre (audit du 30/09 :
  // environ 2 s d'attente en moins, et une base moins sollicitée en cas d'affluence).
  const { data: couvertures } =
    await sb.rpc('photos_couverture_mannequins', { ids: profils.map(p => p.id) });
  const photoPar = {};
  (couvertures || []).forEach(c => { photoPar[c.model_id] = c.url; });

  for (const profil of profils) {

    const photoUrl = photoPar[profil.id] || 'assets/logo-dark-bg.png';


    const carte =
      document.createElement('a');


    carte.href =
      'mannequin.html?id=' + profil.id;


    carte.className =
      'medaillon-carte reveal';


    carte.innerHTML = `
      <div class="medaillon-photo">
        <img
          src="${echapperHtml(photoUrl)}"
          alt="${echapperHtml(profil.full_name || '')}"
          loading="lazy"
        >
      </div>

      <div class="medaillon-nom">
        ${echapperHtml(profil.full_name || 'Mannequin')}
      </div>

      <div class="medaillon-info">
        ${echapperHtml(profil.city || '')}
        ${profil.height_cm ? ' · ' + profil.height_cm + ' cm' : ''}
      </div>
    `;


    conteneur.appendChild(carte);

  }

}

chargerMedaillonsAccueil();


// --- Mannequin à la une ---

async function chargerMannequinVedette() {

  if (!sb) return;


  let { data: profil } =
    await sb
      .from('model_profiles')
      .select(
        'id, full_name, city, category, height_cm'
      )
      .eq('published', true)
      .eq('featured', true)
      .limit(1)
      .maybeSingle();


  if (!profil) {

    const { data: recent } =
      await sb
        .from('model_profiles')
        .select(
          'id, full_name, city, category, height_cm'
        )
        .eq('published', true)
        .order(
          'created_at',
          { ascending: false }
        )
        .limit(1)
        .maybeSingle();


    profil = recent;

  }


  if (!profil) return;


  const { data: photos } =
    await sb
      .from('model_photos')
      .select('url, url_moyenne')
      .eq('model_id', profil.id)
      .order(
        'created_at',
        { ascending: true }
      )
      .limit(1);


  const photoUrl =
    (photos && photos[0])
      ? (photos[0].url_moyenne || photos[0].url)
      : 'assets/logo-dark-bg.png';


  const libelleCategorie =
    profil.category === 'homme'
      ? 'Homme'
      : profil.category === 'femme'
        ? 'Femme'
        : 'New Face';


  document.getElementById(
    'vedette-img'
  ).src = photoUrl;


  document.getElementById(
    'vedette-img'
  ).alt =
    echapperHtml(
      profil.full_name || ''
    );


  document.getElementById(
    'vedette-nom'
  ).textContent =
    profil.full_name || 'Mannequin';
  const longueurNom = (profil.full_name || '').length;
  document.getElementById('vedette-nom').classList.toggle('nom-long', longueurNom > 18 && longueurNom <= 28);
  document.getElementById('vedette-nom').classList.toggle('nom-tres-long', longueurNom > 28);


  document.getElementById(
    'vedette-info'
  ).textContent =
    [
      libelleCategorie,
      profil.city,
      profil.height_cm
        ? profil.height_cm + ' cm'
        : null
    ]
      .filter(Boolean)
      .join(' · ');


  document.getElementById(
    'vedette-lien'
  ).href =
    'mannequin.html?id=' + profil.id;


  document.getElementById(
    'mannequin-vedette'
  ).style.display = 'block';

}


window.promesseVedette =
  chargerMannequinVedette();

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
  try { localStorage.setItem('ma2m_bloc_vide_' + id, section.style.display === 'block' ? '0' : '1'); } catch (e) {}
}
Promise.resolve(window.promesseVedette).catch(() => {}).then(() => libererSectionReservee('mannequin-vedette', true));
setTimeout(() => libererSectionReservee('mannequin-vedette'), 15000);


// --- Mot du fondateur ---

async function chargerMotResponsable() {

  if (!sb) return;


  const { data } =
    await sb
      .from('mot_responsable')
      .select('*')
      .eq('id', 'principal')
      .maybeSingle();


  if (!data || !data.message) return;


  document.getElementById(
    'mot-resp-nom'
  ).textContent =
    data.nom || 'Maître Akesse';


  document.getElementById(
    'mot-resp-titre'
  ).textContent =
    data.titre || '';


  document.getElementById(
    'mot-resp-message'
  ).textContent =
    data.message;


  if (data.photo_url) {

    const photo =
      document.getElementById(
        'mot-resp-photo'
      );


    photo.onerror = () => {
      photo.style.display = 'none';
    };


    photo.src =
      data.photo_url;


    photo.alt =
      data.nom || 'Maître Akesse';


    photo.style.display =
      'block';

  }


  document.getElementById(
    'mot-responsable'
  ).style.display =
    'block';

}

Promise.resolve(chargerMotResponsable()).catch(() => {}).then(() => libererSectionReservee('mot-responsable', true));
setTimeout(() => libererSectionReservee('mot-responsable'), 15000);


// --- Bandeau "Ils nous ont fait confiance" ---

async function chargerBandeauConfiance() {

  if (!sb) return;


  const { data } =
    await sb
      .from('partenaires')
      .select(
        'id, nom, logo_url'
      )
      .order(
        'created_at',
        { ascending: false }
      )
      .limit(14);


  if (!data || !data.length) return;


  const avecLogo =
    data.filter(p => p.logo_url);


  if (!avecLogo.length) return;


  document.getElementById(
    'confiance-liste'
  ).innerHTML =
    avecLogo
      .map(p => `
        <a
          href="partenaires.html?partenaire=${p.id}"
          class="confiance-carte"
          title="${echapperHtml(p.nom || '')}"
        >
          <img
            src="${echapperHtml(p.logo_url)}"
            alt="${echapperHtml(p.nom || '')}"
            loading="lazy"
          >
        </a>
      `)
      .join('');


  document.getElementById(
    'ils-nous-font-confiance'
  ).style.display =
    'block';

}

chargerBandeauConfiance();


// Bande de chiffres retirée le 06/10/2026 (remplacée par l'entrée « Femmes · Hommes ·
// New Faces » écrite directement dans la page, section #stat-strip).

