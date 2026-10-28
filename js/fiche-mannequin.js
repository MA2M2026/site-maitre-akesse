// Fiche d'une mannequin (mannequin.html et en/mannequin.html) : un seul script pour le
// français et l'anglais (11/10/2026 : avant, deux copies de ~400 lignes dans les pages).
// Langue (EN, T) : js/app.js, d'après <html lang="en">. En anglais, les mesures ont aussi leur équivalent impérial.
const imperial = (txt) => (EN && txt ? ` <span class="fiche-imperial">${txt}</span>` : '');

// Petites icônes ligne (SVG, currentColor) affichées à côté de chaque mensuration
// sur la fiche — purement décoratif, aucune donnée, pas besoin d'échappement.
const ICONES_MENSURATIONS = {
  age: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="4" width="14" height="13" rx="1"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="7" y1="2.5" x2="7" y2="5.5"/><line x1="13" y1="2.5" x2="13" y2="5.5"/></svg>',
  taille: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><line x1="10" y1="2" x2="10" y2="18"/><polyline points="6,6 10,2 14,6"/><polyline points="6,14 10,18 14,14"/></svg>',
  poids: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></svg>',
  ruban: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2.5" y="7" width="15" height="6" rx="1"/><line x1="5.5" y1="7" x2="5.5" y2="9.5"/><line x1="8.5" y1="7" x2="8.5" y2="9.5"/><line x1="11.5" y1="7" x2="11.5" y2="9.5"/><line x1="14.5" y1="7" x2="14.5" y2="9.5"/></svg>',
  pointure: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2.5 14.5c0-3 1.5-5 3-6.5.8-.8 1.3-1.8 1.5-3 2 0 3.5 1.2 4.2 2.6.5 1 1.4 1.7 2.5 1.9 1.7.3 3.3 1.4 3.3 3v2H2.5z"/></svg>',
  carnation: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M10 2.5c3 4 5 6.8 5 9.5a5 5 0 01-10 0c0-2.7 2-5.5 5-9.5z"/></svg>',
  vetements: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M10.5 2.5H17v6.5L9 17l-6.5-6.5 8-8z"/><circle cx="13.2" cy="6" r="1.1" fill="currentColor" stroke="none"/></svg>',
  yeux: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5-8-5.5-8-5.5z"/><circle cx="10" cy="10" r="2.3"/></svg>',
  cheveux: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M4 5c2-2 4-2 6 0s4 2 6 0"/><path d="M4 10c2-2 4-2 6 0s4 2 6 0"/><path d="M4 15c2-2 4-2 6 0s4 2 6 0"/></svg>'
};
function iconeMensuration(cle) {
  return `<span class="icone-stat" aria-hidden="true">${ICONES_MENSURATIONS[cle] || ''}</span>`;
}

function libelleTypeModele(t) {
  const libelles = EN
    ? { catwalk: 'Runway / Catwalk', photo: 'Photo', publicite: 'Advertising', commercial: 'Commercial', autre: 'Other' }
    : { catwalk: 'Défilé', photo: 'Photo', publicite: 'Publicité', commercial: 'Commercial', autre: 'Autre' };
  return libelles[t] || t;
}

// Convertit un lien YouTube/Vimeo classique en URL de lecteur intégrable (iframe).
// Renvoie null si le lien n'est pas reconnu — dans ce cas on affiche un simple lien.
function urlEmbedVideo(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const idVideo = u.searchParams.get('v');
      return idVideo ? `https://www.youtube.com/embed/${idVideo}` : null;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const idVideo = u.pathname.split('/').filter(Boolean)[0];
      return idVideo ? `https://player.vimeo.com/video/${idVideo}` : null;
    }
  } catch (e) { return null; }
  return null;
}

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
  const demandePhotos = Promise.resolve(sb
    .from('model_photos')
    .select('id, url, url_miniature, url_moyenne, compcard_ordre, principale, photo_couverture, couverture_position, tri_statut, created_at')
    .eq('model_id', id)
    .order('principale', { ascending: false })
    .order('created_at', { ascending: true }));
  const demandeProjets = Promise.all([
    sb.from('model_projects').select('*').eq('model_id', id).order('created_at', { ascending: false }),
    ma2mExperiencesAgence(id)
  ]);
  const demandeMesures = window.ma2mMesuresSupp(id);
  // une demande abandonnée (profil non publié) ne doit pas laisser d'erreur non gérée
  [demandePhotos, demandeProjets, demandeMesures].forEach((d) => { d.catch(() => {}); });

  const { data: profil, error } = await sb
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
  const libellesDispo = EN
    ? { immediate: 'Available immediately', rdv: 'By appointment', mobile: 'Available to travel' }
    : { immediate: 'Disponible immédiatement', rdv: 'Sur rendez-vous', mobile: 'Mobile pour déplacements' };
  // Âge seulement, jamais la date de naissance (décision de la propriétaire, 06/10/2026) :
  // la base calcule l'âge (fonction ages_mannequins, extension 114) et la date n'est plus
  // lisible par les visiteurs (extension 114 installée le 06/10/2026).
  let age = '';
  try {
    const { data: ages } = await sb.rpc('ages_mannequins', { ids: [id] });
    if (Array.isArray(ages) && ages[0] && ages[0].age != null) age = ages[0].age;
  } catch (e) {}

  const NB_PROJETS_APERCU = 5;
  function ligneProjetHtml(p) {
    const lieu = [p.lieu, p.ville, p.pays].filter(Boolean).join(', '); // lieu : salle, hôtel… (Extension 139)
    const meta = [p.periode, lieu, p.agence ? '' : p.promoteur].filter(Boolean).map(echapperHtml).join(' · ');
    return `
      <li class="fiche-projet">
        <span class="fiche-projet-type">${echapperHtml(p.type_projet)}</span>
        ${p.titre ? `<span class="fiche-projet-titre">${echapperHtml(p.titre)}</span>` : ''}
        ${meta ? `<span class="fiche-projet-meta">${meta}</span>` : ''}
      </li>`;
  }

  const blocProjets = (projets && projets.length) ? `
    <section class="fiche-carte fiche-ancre" id="fiche-parcours">
      <h3 class="fiche-carte-titre">${T('Parcours', 'Career')} <span>${projets.length} ${T('projet', 'project')}${projets.length > 1 ? 's' : ''}</span></h3>
      <ol class="fiche-projets">
        ${projets.slice(0, NB_PROJETS_APERCU).map(ligneProjetHtml).join('')}
      </ol>
      ${projets.length > NB_PROJETS_APERCU ? `
        <ol id="tous-les-projets" class="fiche-projets fiche-projets-suite u-hidden">
          ${projets.slice(NB_PROJETS_APERCU).map(ligneProjetHtml).join('')}
        </ol>
        <button id="btn-voir-tous-projets" class="fiche-lien-plus" type="button">${T('Voir tous les projets', 'View All Projects')} (${projets.length})</button>` : ''}
    </section>` : '';

  // Conservé pour le générateur de fiche PDF (comp card), déclenché plus tard
  // par un clic — évite de refaire les mêmes requêtes à ce moment-là.
  ficheData = { profil, photos: photos || [], projets: projets || [], age };

  const urlVideo = urlEmbedVideo(profil.video_url);
  const urlVideoSure = urlHttpSure(profil.video_url);
  const blocVideo = (urlVideo || urlVideoSure) ? `
    <section class="fiche-carte">
      <h3 class="fiche-carte-titre">${T('Vidéo', 'Video')}</h3>
      ${urlVideo
        ? `<div class="video-embed-wrap fiche-video"><iframe src="${echapperHtml(urlVideo)}" title="${T('Vidéo de présentation', 'Introduction video')}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
        : `<a href="${echapperHtml(urlVideoSure)}" target="_blank" rel="noopener" class="${EN ? 'enmq-6' : 'mq-6'}">▶ ${T('Voir la vidéo de présentation', 'Watch Introduction Video')}</a>`}
    </section>` : '';

  const blocProfil = (profil.bio || (profil.model_types && profil.model_types.length) || profil.languages || profil.availability) ? `
    <section class="fiche-carte fiche-ancre" id="fiche-apropos">
      <h3 class="fiche-carte-titre">${T('À propos', 'About')}</h3>
      ${profil.bio ? `<p class="mannequin-bio fiche-bio">${echapperHtml(profil.bio)}</p>` : ''}
      <ul class="fiche-infos">
        ${profil.availability && libellesDispo[profil.availability] ? `<li><span class="fiche-ico"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></span>${libellesDispo[profil.availability]}</li>` : ''}
        ${profil.languages ? `<li><span class="fiche-ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></span>${T('Langues : ', 'Languages: ')}${echapperHtml(profil.languages)}</li>` : ''}
      </ul>
      ${(profil.model_types && profil.model_types.length) ? `
        <div class="fiche-types">
          ${profil.model_types.map(t => `<span class="fiche-type">${echapperHtml(libelleTypeModele(t))}</span>`).join('')}
        </div>` : ''}
    </section>` : '';

  // Mesures incohérentes (« à reprendre ») : mensurations cachées au public (js/tailles.js)
  const masquer = ma2mMesuresAReprendre(profil);
  contenu.innerHTML = `
    <div class="reveal">
      <div class="profil-hero-fullbleed profil-hero--avatar${(photos && photos.length) ? ' cliquable' : ''}" id="couverture-clic"${(photos && photos.length) ? ' role="button" tabindex="0" aria-label="' + T('Ouvrir la galerie photo', 'Open the photo gallery') + '"' : ''}>
        <img data-couv-img src="${echapperHtml(photoHero)}" alt="">
        <div class="profil-hero-scrim"></div>
        <div class="profil-hero-contenu">
          <div class="eyebrow eyebrow--clair">${profil.category === 'homme' ? T('Homme', 'Man') : profil.category === 'femme' ? T('Femme', 'Woman') : 'New Face'}</div>
          <h1>${echapperHtml(profil.full_name || T('Mannequin', 'Model'))}</h1>
          <p>${echapperHtml([libelleNiveauPublic(niveauNormalise(profil.niveau_mannequin, profil.years_experience)), profil.city].filter(Boolean).join(' · '))}</p>
        </div>
      </div>
      <div class="fiche-entete">
        <div class="profil-avatar fiche-avatar cliquable" id="compsheet-photo-clic" role="button" tabindex="0" aria-label="${T('Voir la photo en grand', 'View photo full size')}"><img src="${echapperHtml(photoAvatar)}" alt="${echapperHtml(profil.full_name || '')}"></div>
        <dl class="fiche-mesures" aria-label="${T('Mensurations', 'Measurements')}">
          ${age ? `<div class="fiche-mesure"><dt>${iconeMensuration('age')}${T('Âge', 'Age')}</dt><dd>${age} ${T('ans', 'years')}</dd></div>` : ''}
          ${profil.height_cm ? `<div class="fiche-mesure"><dt>${iconeMensuration('taille')}${T('Taille', 'Height')}</dt><dd>${profil.height_cm} cm${imperial(enPieds(profil.height_cm))}</dd></div>` : ''}
          ${profil.weight_kg ? `<div class="fiche-mesure"><dt>${iconeMensuration('poids')}${T('Poids', 'Weight')}</dt><dd>${profil.weight_kg} kg${imperial(enLivres(profil.weight_kg))}</dd></div>` : ''}
          ${!masquer && profil.chest_cm ? `<div class="fiche-mesure"><dt>${iconeMensuration('ruban')}${T('Poitrine', 'Chest')}</dt><dd>${profil.chest_cm} cm${imperial(enPouces(profil.chest_cm))}</dd></div>` : ''}
          ${!masquer && profil.waist_cm ? `<div class="fiche-mesure"><dt>${iconeMensuration('ruban')}${T('Tour de taille', 'Waist')}</dt><dd>${profil.waist_cm} cm${imperial(enPouces(profil.waist_cm))}</dd></div>` : ''}
          ${!masquer && profil.hips_cm ? `<div class="fiche-mesure"><dt>${iconeMensuration('ruban')}${T('Tour de bassin', 'Hips')}</dt><dd>${profil.hips_cm} cm${imperial(enPouces(profil.hips_cm))}</dd></div>` : ''}
          ${!masquer && profil.inseam_cm ? `<div class="fiche-mesure"><dt>${iconeMensuration('ruban')}${T('Entrejambe', 'Inseam')}</dt><dd>${profil.inseam_cm} cm${imperial(enPouces(profil.inseam_cm))}</dd></div>` : ''}
          ${!masquer && profil.shoulder_cm ? `<div class="fiche-mesure"><dt>${iconeMensuration('ruban')}${T('Épaules', 'Shoulders')}</dt><dd>${profil.shoulder_cm} cm${imperial(enPouces(profil.shoulder_cm))}</dd></div>` : ''}
          ${!masquer && profil.arm_cm ? `<div class="fiche-mesure"><dt>${iconeMensuration('ruban')}${T('Longueur de bras', 'Arm length')}</dt><dd>${profil.arm_cm} cm${imperial(enPouces(profil.arm_cm))}</dd></div>` : ''}
          ${!masquer && profil.neck_cm ? `<div class="fiche-mesure"><dt>${iconeMensuration('ruban')}${T('Tour de cou', 'Neck')}</dt><dd>${profil.neck_cm} cm${imperial(enPouces(profil.neck_cm))}</dd></div>` : ''}
          ${profil.shoe_size ? `<div class="fiche-mesure"><dt>${iconeMensuration('pointure')}${T('Pointure', 'Shoe Size')}</dt><dd>${EN ? 'EU ' : ''}${echapperHtml(profil.shoe_size)}${EN ? imperial(pointureUS(profil.shoe_size, profil.category)) : ''}</dd></div>` : ''}
          ${profil.carnation ? `<div class="fiche-mesure"><dt>${iconeMensuration('carnation')}${T('Carnation', 'Skin Tone')}</dt><dd>${echapperHtml(EN ? enAnglais(profil.carnation) : profil.carnation)}</dd></div>` : ''}
          ${profil.eye_color ? `<div class="fiche-mesure"><dt>${iconeMensuration('yeux')}${T('Yeux', 'Eyes')}</dt><dd>${echapperHtml(EN ? enAnglais(profil.eye_color) : profil.eye_color)}</dd></div>` : ''}
          ${profil.hair_color ? `<div class="fiche-mesure"><dt>${iconeMensuration('cheveux')}${T('Cheveux', 'Hair')}</dt><dd>${echapperHtml(EN ? enAnglais(profil.hair_color) : profil.hair_color)}</dd></div>` : ''}
        </dl>
      </div>
      ${ma2mBlocEquivalences(profil, EN)}

      <div class="fiche-actions no-print">
        <button id="btn-select-fiche" class="btn btn--principal"></button>
        <div class="fiche-telecharger">
          <button id="btn-compcard" class="btn" type="button" aria-haspopup="true" aria-expanded="false" aria-label="${T('Télécharger la compcard', 'Download the comp card')}"><span class="fiche-ico"><svg viewBox="0 0 24 24"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/></svg></span>${T('Compcard', 'Comp card')}</button>
          <div class="fiche-telecharger-menu u-hidden" id="menu-compcard">
            <button id="btn-telecharger-pdf" type="button">PDF</button>
            <button id="btn-telecharger-jpeg" type="button">JPEG</button>
          </div>
        </div>
      </div>

      <nav class="fiche-onglets no-print" aria-label="${T('Sections de la fiche', 'Profile sections')}">
        ${blocProfil ? `<a href="#fiche-apropos">${T('À propos', 'About')}</a>` : ''}
        ${blocProjets ? `<a href="#fiche-parcours">${T('Parcours', 'Career')}</a>` : ''}
        ${(photos && photos.length) ? `<a href="#fiche-book">Photos <span>${photos.length}</span></a>` : ''}
        <a href="#fiche-contact">Contact</a>
      </nav>

      <div class="fiche-grille${(blocProfil && (blocProjets || blocVideo)) ? '' : ' fiche-grille--une'}">
        <div class="fiche-col">
          ${blocProfil}
        </div>
        <div class="fiche-col">
          ${blocProjets}
          ${blocVideo}
        </div>
      </div>
    </div>
  `;


  // Contact officiel : tout en bas de la page, après le Book (demande de la
  // propriétaire, 28 sept. 2026) — on parcourt d'abord les photos, puis on contacte.
  const contactBas = document.getElementById('fiche-contact-bas');
  if (contactBas) {
    contactBas.innerHTML = `
      <section class="fiche-contact-bas fiche-ancre" id="fiche-contact">
        <div class="fiche-contact-entete">
          <span class="fiche-contact-rond"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></span>
          <div><h3>${T('Contact officiel MA2M', 'Official MA2M Contact')}</h3><p>${T('Pour réserver ce mannequin, contactez directement l\'agence.', 'To book this model, contact the agency directly.')}</p></div>
        </div>
        <div class="fiche-contact-grille">
          <a class="fiche-contact-tuile" href="tel:+2252722231176"><span class="fiche-contact-rond"><svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg></span><span class="fiche-contact-label">${T('Téléphone', 'Phone')}</span><span class="fiche-contact-valeur">+225 27 22 23 11 76</span></a>
          <a class="fiche-contact-tuile" href="tel:+2250545656687"><span class="fiche-contact-rond"><svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg></span><span class="fiche-contact-label">Mobile / WhatsApp</span><span class="fiche-contact-valeur">+225 05 45 65 66 87</span></a>
          <a class="fiche-contact-tuile" href="mailto:scoutmodel.ma2m@gmail.com"><span class="fiche-contact-rond"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg></span><span class="fiche-contact-label">${T('E-mail', 'Email')}</span><span class="fiche-contact-valeur">scoutmodel.ma2m@gmail.com</span></a>
          <a class="fiche-contact-tuile" href="https://www.instagram.com/maitreakessemodelmanagement" target="_blank" rel="noopener"><span class="fiche-contact-rond"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r=".6"/></svg></span><span class="fiche-contact-label">Instagram</span><span class="fiche-contact-valeur">@maitreakessemodelmanagement</span></a>
        </div>
      </section>`;
  }

  {
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
