// --- Porte d'entrée : le défilement reste verrouillé tant qu'on n'a pas cliqué "Entrer".
// (Le masquage de la porte déjà ouverte, ET le verrouillage du défilement lui-même,
// se font plus tôt — tout en haut de <body>, voir le commentaire à ce sujet dans le
// HTML — pour éviter qu'elle n'apparaisse, ou reste défilable, un instant avant que ce
// script, chargé en fin de page, ne s'exécute.)
document.getElementById('entrer-btn').addEventListener('click', async () => {
  if (window.promesseVedette) {
    try { await Promise.race([window.promesseVedette, new Promise((r) => setTimeout(r, 4000))]); } catch (e) {}
  }
  document.body.classList.remove('porte-verrouillee');
  document.documentElement.classList.remove('porte-verrouillee');
  window.deverrouillerDefilement();
  document.getElementById('porte-entree').style.display = 'none';
  window.scrollTo(0, 0);
  try { sessionStorage.setItem('ma2m_porte_ouverte', '1'); } catch (e) {}
});

// --- Intro : logo statique, 3 secondes, sans animation complexe ---
(function () {
  let dejaVue = false;
  try { dejaVue = sessionStorage.getItem('ma2m_intro_vue'); } catch (e) {}
  const reduitMouvement = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (dejaVue || reduitMouvement) return;

  const logoSplash = document.getElementById('logo-splash');
  logoSplash.classList.remove('u-hidden');

  let introTerminee = false;
  function terminerIntro() {
    if (introTerminee) return;
    introTerminee = true;
    logoSplash.classList.add('intro-cachee');
    try { sessionStorage.setItem('ma2m_intro_vue', '1'); } catch (e) {}
  }

  // Un appui n'importe où sur le logo permet de passer directement au site.
  logoSplash.addEventListener('click', terminerIntro);
  setTimeout(terminerIntro, 3000);
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
    .select('url, model_id, model_profiles!inner(published)')
    .eq('model_profiles.published', true)
    .order('created_at', { ascending: false })
    .limit(120);


  const parMannequin = new Map();

  melanger(data || []).forEach(p => {

    if (!parMannequin.has(p.model_id)) {
      parMannequin.set(p.model_id, p.url);
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


    document
      .getElementById('carte-a-venir-texte')
      .textContent = data.texte.trim();

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
          href="${echapperHtml(p.lien)}"
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


  for (const profil of profils) {

    const { data: photos } =
      await sb
        .from('model_photos')
        .select('url')
        .eq('model_id', profil.id)
        .order(
          'created_at',
          { ascending: true }
        )
        .limit(1);


    const photoUrl =
      (photos && photos[0])
        ? photos[0].url
        : 'assets/logo-dark-bg.png';


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
      .select('url')
      .eq('model_id', profil.id)
      .order(
        'created_at',
        { ascending: true }
      )
      .limit(1);


  const photoUrl =
    (photos && photos[0])
      ? photos[0].url
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

chargerMotResponsable();


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


// --- Bande de statistiques ---

async function chargerStatsAccueil() {

  if (!sb) return;


  const [
    { count: nbMannequins },
    { count: nbProjets },
    { count: nbPartenaires },
    { count: nbActualites }
  ] =
    await Promise.all([

      sb
        .from('model_profiles')
        .select(
          'id',
          {
            count: 'exact',
            head: true
          }
        )
        .eq('published', true),

      sb
        .from('model_projects')
        .select(
          'id',
          {
            count: 'exact',
            head: true
          }
        ),

      sb
        .from('partenaires')
        .select(
          'id',
          {
            count: 'exact',
            head: true
          }
        ),

      sb
        .from('actualites')
        .select(
          'id',
          {
            count: 'exact',
            head: true
          }
        )

    ]);


  const stats = [

    {
      chiffre:
        (nbMannequins || 0) + '+',
      libelle:
        'Mannequins représentés'
    },

    {
      chiffre:
        (nbProjets || 0) + '+',
      libelle:
        'Projets réalisés'
    },

    {
      chiffre:
        (nbPartenaires || 0) + '+',
      libelle:
        'Partenaires & institutions'
    },

    {
      chiffre:
        'Abidjan',
      libelle:
        'Basée en Côte d\'Ivoire'
    }

  ];


  document.getElementById(
    'stats-grille-accueil'
  ).innerHTML =
    stats
      .map(s => `
        <div class="stat-item">

          <span class="chiffre">
            ${s.chiffre}
          </span>

          <span class="libelle">
            ${s.libelle}
          </span>

        </div>
      `)
      .join('');

}

chargerStatsAccueil();

