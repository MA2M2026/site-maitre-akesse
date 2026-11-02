// Fiche d'une mannequin (mannequin.html et en/mannequin.html) : un seul script pour le
// français et l'anglais (11/10/2026 : avant, deux copies de ~400 lignes dans les pages).
// Langue (EN, T) : js/app.js, d'après <html lang="en">. En anglais, les mesures ont aussi leur équivalent impérial.
// (icônes, types, vidéo et dessin de la fiche : js/rendu-fiche.js, partagé avec le serveur ; phase 2, 02/11/2026)

let ficheData = null;

// chargerImageHauteRes/chargerImageLocale/dessinerIconeReseau/construireCanvasCompcard/
// chargerJsPdf/genererFiche() sont partagées dans js/app.js (utilisées aussi par
// l'espace mannequin, pour un seul générateur de fiche sur tout le site).

// Enveloppe de sécurité : si quoi que ce soit échoue ou traîne trop longtemps
// pendant le chargement (mauvaise connexion mobile, bibliothèque Supabase qui n'a
// pas pu se charger, requête qui reste bloquée...), on l'affiche clairement au lieu
// de laisser la page bloquée indéfiniment sur "Chargement…" sans aucune explication.
async function chargerProfil(essai = 1) {
  const contenu = document.getElementById('contenu');
  const delaiDepasse = new Promise((_, reject) => setTimeout(() => reject(new Error(T('délai dépassé', 'timeout'))), 20000));
  try {
    await Promise.race([chargerProfilInterne(), delaiDepasse]);
  } catch (e) {
    // Journal du 07/10/2026 : second essai automatique (js/app.js) avant le bouton.
    if (essai === 1) { relancerChargementFiche(contenu, T('Chargement…', 'Loading…'), () => { void chargerProfil(2); }); return; }
    console.error(T('Échec du chargement du profil :', 'Failed to load profile:'), e);
    contenu.innerHTML = `
      <p>${T('Le chargement de ce profil prend trop de temps ou a échoué (connexion instable ?).', 'Loading this profile is taking too long or has failed (unstable connection?).')}</p>
      <button class="btn btn--principal" id="btn-reessayer-profil">${T('Réessayer', 'Try Again')}</button>
    `;
    document.getElementById('btn-reessayer-profil').addEventListener('click', () => window.location.reload());
  }
}

async function chargerProfilInterne() {
  const id = await window.ma2mIdFiche();
  const contenu = document.getElementById('contenu');
  const galerie = document.getElementById('galerie');

  const lienLangue = document.querySelector('.lang-switch');
  if (lienLangue && id) lienLangue.href = `${EN ? '../' : 'en/'}mannequin.html?id=${encodeURIComponent(id)}`;

  if (!id) { contenu.textContent = T('Profil introuvable.', 'Profile not found.'); return; }

  // Tout est demandé EN MÊME TEMPS (28/10/2026 : la fiche attendait cinq réponses l'une après
  // l'autre avant d'afficher la photo, long sur téléphone) ; on n'attend ensuite que le profil.
  // (Promise.resolve : une demande Supabase part à chaque « then » ; ainsi elle ne part qu'une fois)
  // fiche préparée par le serveur (middleware.js, 01/11/2026) : profil, photos et âge déjà dans la page
  const serveur = window.ma2mFicheServeur && window.ma2mFicheServeur.id === id ? window.ma2mFicheServeur : null;
  const demandePhotos = serveur ? Promise.resolve({ data: serveur.photos }) : Promise.resolve(sb
    .from('model_photos')
    .select('id, url, url_miniature, url_moyenne, compcard_ordre, principale, photo_couverture, couverture_position, tri_statut, created_at')
    .eq('model_id', id)
    .order('principale', { ascending: false })
    .order('created_at', { ascending: true }));
  // (100 % dynamique, 01/11/2026 : expériences, parcours avec l'agence et mesures posés par le serveur)
  const demandeProjets = Promise.all([
    serveur && Array.isArray(serveur.projets) ? { data: serveur.projets, error: null } : sb.from('model_projects').select('*').eq('model_id', id).order('created_at', { ascending: false }),
    ma2mExperiencesAgence(id, serveur && Array.isArray(serveur.parcours) ? serveur.parcours : null)
  ]);
  const demandeMesures = serveur && serveur.mesures ? Promise.resolve(serveur.mesures) : window.ma2mMesuresSupp(id);
  // l'âge aussi, en même temps (31/10/2026 : il était demandé après tout le reste)
  const demandeAge = serveur ? Promise.resolve({ data: [{ age: serveur.age }] }) : Promise.resolve(sb.rpc('ages_mannequins', { ids: [id] }));
  // une demande abandonnée (profil non publié) ne doit pas laisser d'erreur non gérée
  [demandePhotos, demandeProjets, demandeMesures, demandeAge].forEach((d) => { d.catch(() => {}); });
  // La grande photo part dès que la liste des photos arrive, sans attendre le reste (31/10/2026 :
  // elle ne commençait qu'au bout de ≈ 5 s sur téléphone) ; le navigateur la garde pour l'affichage.
  if (!serveur) demandePhotos.then(({ data }) => {  // (préparée par le serveur : déjà annoncée dans la page)
    const v = photosAffichees(data);
    if (!v.couverture) return;
    const img = new Image();
    img.fetchPriority = 'high';
    img.src = urlLegere(v.couverture.url_moyenne || v.couverture.url);
  }).catch(() => {});

  const { data: profil, error } = serveur ? { data: { ...serveur.profil }, error: null } : await sb
    .from('model_profiles')
    .select('id, full_name, city, category, niveau_mannequin, height_cm, weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, shoe_size, carnation, clothing_size, eye_color, hair_color, bio, years_experience, model_types, languages, availability, video_url')
    .eq('id', id)
    .eq('published', true)
    .single();

  if (error || !profil) { contenu.textContent = T('Ce profil n\'est pas disponible.', 'This profile is not available.'); return; }
  // épaules, bras, cou, tête (js/tailles.js) lus en même temps que le nom d'adresse
  // l'adresse /book/… (qui change la barre d'adresse) seulement pour un profil publié
  const [mesuresSupp, slug] = await Promise.all([demandeMesures, window.ma2mAdresseFiche(id, EN)]);
  Object.assign(profil, mesuresSupp);
  if (lienLangue && slug) lienLangue.href = (EN ? '../book/' : 'en/book/') + slug;

  // Référencement : personnalise le titre, la description et l'URL canonique de la
  // page une fois le profil connu — utile pour Google (qui exécute le JavaScript)
  // et pour l'onglet du navigateur ; les aperçus de partage (WhatsApp/Facebook, qui
  // n'exécutent pas le JavaScript) restent sur les balises génériques ci-dessous.
  const urlActuelle = 'https://www.maitreakessemodelmanagement.com' + (EN ? '/en' : '') + (slug ? '/book/' + slug : '/mannequin?id=' + id);
  const titrePage = (profil.full_name || T('Mannequin', 'Model')) + ' · Maître Akesse Model Management';
  const descriptionPage = [profil.full_name, profil.city, profil.height_cm ? profil.height_cm + ' cm' : null].filter(Boolean).join(' · ') + T(' · Book complet sur le site de l\'agence Maître Akesse Model Management.', ' · Full book on the Maître Akesse Model Management agency website.');
  document.title = titrePage;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
  canonical.href = urlActuelle;
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) { metaDesc = document.createElement('meta'); metaDesc.name = 'description'; document.head.appendChild(metaDesc); }
  metaDesc.content = descriptionPage;

  const { data: photos } = await demandePhotos;
  const [{ data: projetsSaisis }, projetsAgence] = await demandeProjets;
  // projets réalisés avec l'agence (agenda) inclus automatiquement (js/app.js)
  const projets = fusionnerExperiences(projetsAgence, projetsSaisis);
  // page anglaise : présentation et types d'expérience en anglais (js/app.js)
  await versAnglais([profil, ...projets], ['bio', 'type_projet']);

  const vues = photosAffichees(photos); // photo de profil et couverture affichées (js/app.js)
  const premierePhoto = vues.profil ? vues.profil.url : '/assets/logo-dark-bg.png';
  // Fiche d'identité pour Google (26/10/2026) : seulement ce que la page montre déjà
  // (nom, photo, adresse), rattaché à l'agence décrite sur l'accueil (index.html)
  let identite = document.getElementById('identite-mannequin');  // une seule, même si la fiche se recharge
  if (!identite) {
    identite = document.createElement('script');
    identite.type = 'application/ld+json'; identite.id = 'identite-mannequin';
    document.head.appendChild(identite);
  }
  identite.textContent = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Person', name: profil.full_name || T('Mannequin', 'Model'),
    jobTitle: T('Mannequin', 'Model'), url: urlActuelle, image: new URL(premierePhoto, location.origin).href,
    worksFor: { '@type': 'Organization', '@id': 'https://www.maitreakessemodelmanagement.com/#agence', name: 'Maître Akesse Model Management' }
  });
  const photoCouverture = vues.couvertureChoisie;
  // Versions allégées pour l'affichage (la fiche était lourde à ouvrir, surtout depuis
  // le navigateur intégré de Facebook) : couverture en taille « moyenne » (~1400px),
  // médaillon en miniature (~500px). L'originale reste utilisée pour la galerie plein
  // écran et la compcard.
  const photoHero = vues.couverture ? urlLegere(vues.couverture.url_moyenne || vues.couverture.url) : premierePhoto;
  const photoAvatar = vues.profil ? urlLegere(vues.profil.url_miniature || vues.profil.url) : '/assets/logo-dark-bg.png';
  // Âge seulement, jamais la date de naissance (décision de la propriétaire, 06/10/2026) :
  // la base calcule l'âge (fonction ages_mannequins, extension 114) et la date n'est plus
  // lisible par les visiteurs (extension 114 installée le 06/10/2026).
  let age = '';
  try {
    const { data: ages } = await demandeAge;
    if (Array.isArray(ages) && ages[0] && ages[0].age != null) age = ages[0].age;
  } catch (e) {}

  // Conservé pour le générateur de fiche PDF (comp card), déclenché plus tard
  // par un clic — évite de refaire les mêmes requêtes à ce moment-là.
  ficheData = { profil, photos: photos || [], projets: projets || [], age };

  const imageDejaLa = contenu.querySelector('[data-couv-img]');
  const apercuDejaLa = contenu.querySelector('.hero-apercu');  // (photo de la carte du Book, posée par le serveur)
  const dessin = window.RenduFiche.fiche({ profil, photos, projets, age }, { en: EN, urlLegere, photoHero, photoAvatar, selectionne: estDansSelection(id) });
  contenu.innerHTML = dessin.contenu;
  const contactBas = document.getElementById('fiche-contact-bas');
  if (contactBas) contactBas.innerHTML = dessin.contact;

  {
    const neuve = contenu.querySelector('[data-couv-img]');
    if (imageDejaLa && neuve && imageDejaLa.getAttribute('src') === neuve.getAttribute('src')) neuve.replaceWith(imageDejaLa);
    const imgFinale = contenu.querySelector('[data-couv-img]');
    if (apercuDejaLa && imgFinale && !(imgFinale.complete && imgFinale.naturalWidth)) imgFinale.before(apercuDejaLa);
    const imgCouverture = contenu.querySelector('[data-couv-img]');
    if (imgCouverture) {
      const pos = photoCouverture ? photoCouverture.couverture_position : '';
      const positionChoisie = pos === 'top' ? '50% 0%' : pos === 'bottom' ? '50% 100%' : '50% 50%';
      // Photo plus étroite que le cadre (photo verticale sur tablette/ordinateur) :
      // elle remplit toute la largeur et on garde son HAUT, pour que la tête ne soit
      // jamais coupée (seul le bas peut l'être). Essai « photo entière sur fond flou »
      // retiré à la demande de la propriétaire (29/09/2026) : elle veut sur tablette le
      // même rendu plein cadre que sur téléphone.
      const cadreCouverture = imgCouverture.parentElement;
      const ajusterCouverture = () => {
        const ratioPhoto = imgCouverture.naturalWidth / imgCouverture.naturalHeight;
        const ratioCadre = cadreCouverture.clientWidth / cadreCouverture.clientHeight;
        const pleinPied = ratioPhoto > 0 && ratioPhoto < ratioCadre;
        cadreCouverture.classList.toggle('plein-pied', pleinPied);
        imgCouverture.style.objectPosition = pleinPied ? '50% 0%' : positionChoisie;
      };
      imgCouverture.style.objectPosition = positionChoisie;
      if (imgCouverture.complete && imgCouverture.naturalWidth) ajusterCouverture();
      else imgCouverture.addEventListener('load', ajusterCouverture);
      window.addEventListener('resize', ajusterCouverture);
    }
  }

  const btnPdf = document.getElementById('btn-telecharger-pdf');
  if (btnPdf) btnPdf.addEventListener('click', () => genererFiche('pdf', ficheData, 'btn-telecharger-pdf', 'btn-telecharger-jpeg', EN ? 'en' : undefined));
  const btnJpeg = document.getElementById('btn-telecharger-jpeg');
  if (btnJpeg) btnJpeg.addEventListener('click', () => genererFiche('jpeg', ficheData, 'btn-telecharger-pdf', 'btn-telecharger-jpeg', EN ? 'en' : undefined));

  const btnVoirTous = document.getElementById('btn-voir-tous-projets');
  if (btnVoirTous) {
    btnVoirTous.dataset.labelFerme = btnVoirTous.textContent;
    btnVoirTous.addEventListener('click', () => {
      const bloc = document.getElementById('tous-les-projets');
      const ouvert = !bloc.classList.toggle('u-hidden');
      btnVoirTous.textContent = ouvert ? T('Réduire', 'Collapse') : btnVoirTous.dataset.labelFerme;
    });
  }

  // Menu « Compcard » : un seul bouton, qui propose PDF ou JPEG.
  const btnCompcard = document.getElementById('btn-compcard');
  const menuCompcard = document.getElementById('menu-compcard');
  if (btnCompcard && menuCompcard) {
    const fermerMenu = () => { menuCompcard.classList.add('u-hidden'); btnCompcard.setAttribute('aria-expanded', 'false'); };
    btnCompcard.addEventListener('click', (e) => {
      e.stopPropagation();
      const ouvert = menuCompcard.classList.toggle('u-hidden') === false;
      btnCompcard.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    });
    menuCompcard.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', fermerMenu);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fermerMenu(); });
  }

  const btnSelect = document.getElementById('btn-select-fiche');
  function majBoutonSelect() {
    const selectionne = estDansSelection(id);
    btnSelect.textContent = selectionne ? T('✓ Dans ma sélection', '✓ In My Selection') : T('+ Sélectionner ce mannequin', '+ Select This Model');
  }
  majBoutonSelect();
  btnSelect.addEventListener('click', () => {
    if (estDansSelection(id)) {
      retirerSelection(id);
    } else {
      ajouterSelection({ id, full_name: profil.full_name, height_cm: profil.height_cm, photoUrl: premierePhoto });
    }
    majBoutonSelect();
  });

  galerie.innerHTML = '';
  // Toutes les photos dans le Book (24/10/2026 : plus de section Lifestyle, le tri automatique
  // se trompait).
  const ordreGalerie = photos || [];
  // photo agrandie : la version moyenne (1400 px), l'originale (jusqu'à 4000 px depuis le
  // 24/10/2026) étant réservée aux CV et compcards
  const urlsPhotos = ordreGalerie.map(p => p.url_moyenne || p.url);
  window.photosLightbox = urlsPhotos;

  const photoPrincipale = document.getElementById('compsheet-photo-clic');
  const indexPrincipale = vues.profil ? Math.max(0, ordreGalerie.indexOf(vues.profil)) : 0;
  if (photoPrincipale) photoPrincipale.addEventListener('click', () => ouvrirLightbox(indexPrincipale));
  if (photoPrincipale) photoPrincipale.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrirLightbox(indexPrincipale); }
  });

  // Photo de couverture cliquable (demande de la propriétaire, 28 sept. 2026) :
  // ouvre la galerie plein écran directement sur la photo de couverture, puis
  // on balaie le reste du Book comme depuis la grille.
  const couverture = document.getElementById('couverture-clic');
  if (couverture && urlsPhotos.length) {
    const indexCouv = Math.max(0, ordreGalerie.indexOf(vues.couverture));
    couverture.addEventListener('click', () => ouvrirLightbox(indexCouv));
    couverture.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrirLightbox(indexCouv); }
    });
  }

  ordreGalerie.forEach((p, index) => {
    const div = document.createElement('div');
    div.className = 'book-photo-carte cliquable';
    div.innerHTML = `<img src="${echapperHtml(urlLegere(p.url_miniature || p.url))}" loading="lazy" alt="${T('Photo du book', 'Book photo')}">`;
    div.querySelector('img').addEventListener('click', () => ouvrirLightbox(index));
    galerie.appendChild(div);
  });
}

// --- Lightbox plein écran (système partagé, voir js/app.js) ---
function ouvrirLightbox(index) {
  if (!window.photosLightbox || !window.photosLightbox.length) return;
  ouvrirGalerieLightbox(window.photosLightbox, index);
}
document.addEventListener('DOMContentLoaded', () => { void chargerProfil(1); });
