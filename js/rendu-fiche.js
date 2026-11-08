// Dessin de la fiche d'une mannequin (phase 2, 02/11/2026) : UNE seule façon de dessiner la fiche, utilisée par la page
// (js/fiche-mannequin.js) ET par le serveur (middleware.js : la fiche arrive complète, sans programme). Avant, dans
// js/fiche-mannequin.js seulement. Script classique ET importable : il pose window.RenduFiche / globalThis.RenduFiche.
// Outils : js/partage.js (Partage) et js/tailles.js (ma2mBlocEquivalences, ma2mMesuresAReprendre).
(function (racine) {
  // d : { profil (avec épaules, bras, cou), photos, projets (déjà fusionnés et traduits), age }
  // o : { en, urlLegere, photoHero, photoAvatar, selectionne }
  function fiche(d, o) {
    const EN = !!o.en;
    const T = (fr, en) => (EN ? en : fr);
    const P = racine.Partage;
    const { niveauNormalise, libelleNiveauPublic, enPieds, enPouces, enLivres, pointureUS, enAnglais, urlHttpSure } = P;
    const ma2mMesuresAReprendre = racine.ma2mMesuresAReprendre, ma2mBlocEquivalences = racine.ma2mBlocEquivalences;
    const echapperHtml = (t) => (t === null || t === undefined ? '' : String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
    const urlLegere = o.urlLegere || ((u) => u);
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
    const profil = d.profil, photos = d.photos || [], projets = d.projets || [], age = d.age || '';
    const photoHero = o.photoHero, photoAvatar = o.photoAvatar;
    const libellesDispo = EN
      ? { immediate: 'Available immediately', rdv: 'By appointment', mobile: 'Available to travel' }
      : { immediate: 'Disponible immédiatement', rdv: 'Sur rendez-vous', mobile: 'Mobile pour déplacements' };
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
  // (01/11/2026, plainte de la propriétaire : « l'image n'apparaît pas automatiquement ») la grande photo posée
  // par le serveur ne doit JAMAIS disparaître : avant, la fiche redessinée repartait d'un bloc invisible
  // (« reveal ») qui revenait en fondu ≈ 1 s après. Le bloc est visible d'emblée, et l'image déjà affichée
  // (même adresse) est gardée telle quelle au lieu d'être rechargée.
  const contenuHtml = `
    <div class="reveal visible">
      <div class="profil-hero-fullbleed profil-hero--avatar${(photos && photos.length) ? ' cliquable' : ''}" id="couverture-clic"${(photos && photos.length) ? ' role="button" tabindex="0" aria-label="' + T('Ouvrir la galerie photo', 'Open the photo gallery') + '"' : ''}>
        <img data-couv-img src="${echapperHtml(photoHero)}" alt="" fetchpriority="high">
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
  const contactHtml = `
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

    // (08/11/2026, vitesse) sur téléphone, la petite version (480 px) quand elle existe : la galerie est juste sous la
    // grande photo et lui prenait la connexion ; sur grand écran, la miniature (800 px) comme avant
    const galerieHtml = photos.map((p) => `<div class="book-photo-carte cliquable"><img src="${echapperHtml(urlLegere(p.url_miniature || p.url))}"` +
      (p.url_petite && p.url_miniature ? ` srcset="${echapperHtml(urlLegere(p.url_petite))} 480w, ${echapperHtml(urlLegere(p.url_miniature))} 800w" sizes="(max-width: 700px) 50vw, 25vw"` : '') +
      ` loading="lazy" decoding="async" alt="${T('Photo du book', 'Book photo')}"></div>`).join('');
    return { contenu: contenuHtml.replace('<button id="btn-select-fiche" class="btn btn--principal"></button>', '<button id="btn-select-fiche" class="btn btn--principal">' + (o.selectionne ? T('✓ Dans ma sélection', '✓ In My Selection') : T('+ Sélectionner ce mannequin', '+ Select This Model')) + '</button>'),
      contact: contactHtml, galerie: galerieHtml };
  }
  racine.RenduFiche = { fiche };
})(typeof window !== 'undefined' ? window : globalThis);
