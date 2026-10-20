// Page d'accueil « Magazine », français et anglais (index.html et en/index.html) — refonte du
// 20/10/2026 (choix de la propriétaire : « Magazine 3 », voir PLAN-REFONTE-MAGAZINE.md et
// css/magazine.css). Un seul script pour les deux langues ; EN, T, urlLegere, prechargerPhoto,
// melanger et echapperHtml viennent de js/app.js.
// Les pages se remplissent avec ce que l'agence gère dans l'Administration : mannequins publiés
// et leurs photos de couverture, mannequin à la une, mot de Maître Akesse, castings ouverts,
// partenaires, Instagram, bandeau « Infos du jour ». La vidéo et l'agenda ont leurs propres
// scripts (js/video-accueil.js, js/agenda.js). Une page sans contenu reste cachée : le sommaire
// et les numéros de page sont recalculés à chaque apparition.
// (Avant le 20/10/2026 : intro animée, porte d'entrée « Entrer », carrousel de photos et
// médaillons — retirés avec la refonte.)

(function () {
  const mag = document.getElementById('mag');
  if (!mag) return;

  // --- Mois de l'édition (« Octobre 2026 ») sur la couverture et en bas de chaque page ---
  const mois = new Date().toLocaleDateString(EN ? 'en-GB' : 'fr-FR', { month: 'long', year: 'numeric' });
  const edition = mois.charAt(0).toUpperCase() + mois.slice(1);
  mag.querySelectorAll('.mag-date').forEach(el => { el.textContent = edition; });
  mag.querySelectorAll('.mag-signature-folio').forEach(el => { el.textContent = 'MA2M · ' + edition; });

  // --- Pages en option (agenda, film, partenaires, Instagram) : leur place est réservée dès
  // l'ouverture si elles étaient affichées à la visite précédente (sinon, en revenant en arrière
  // en bas de l'accueil, leur arrivée ferait sauter la page). Une page réservée qui n'a plus de
  // contenu se retire dès qu'on le sait, et au plus tard 8 s après le chargement. ---
  const OPTIONS = ['agenda', 'video-accueil', 'ils-nous-font-confiance', 'flux-instagram'];
  const SOUVENIR = 'ma2m_magazine_pages';
  const pageOption = id => document.getElementById(id);
  function retenir() {
    const affichees = OPTIONS.filter(id => { const p = pageOption(id); return p && !p.hidden && !p.classList.contains('u-hidden') && !p.dataset.reservee; });
    try { localStorage.setItem(SOUVENIR, JSON.stringify(affichees)); } catch (e) { /* stockage bloqué */ }
  }
  function confirmer(id, aDuContenu) {
    const p = pageOption(id);
    if (!p) return;
    // (on ne touche à la page que si son état change : sinon la surveillance du film, qui suit la
    // classe de la page, se relancerait sans fin)
    const cachee = p.hidden || p.classList.contains('u-hidden');
    if (aDuContenu && cachee) { p.hidden = false; p.classList.remove('u-hidden'); } else if (!aDuContenu && p.dataset.reservee) { p.hidden = true; }
    if (!p.dataset.reservee && !(aDuContenu && cachee)) return;
    delete p.dataset.reservee;
    retenir();
  }
  try {
    JSON.parse(localStorage.getItem(SOUVENIR) || '[]').filter(id => OPTIONS.includes(id)).forEach(id => {
      const p = pageOption(id);
      if (p) { p.hidden = false; p.classList.remove('u-hidden'); p.dataset.reservee = '1'; }
    });
  } catch (e) { /* stockage bloqué ou illisible */ }
  // agenda (js/agenda.js) et film (js/video-accueil.js) ont leurs propres scripts : on regarde
  // s'ils ont mis du contenu
  new MutationObserver(() => { if (document.getElementById('agenda-accueil').children.length) confirmer('agenda', true); })
    .observe(document.getElementById('agenda-accueil'), { childList: true });
  new MutationObserver(() => { const v = pageOption('video-accueil'); if (v.dataset.confirme && (v.dataset.reservee || v.hidden)) confirmer('video-accueil', true); })
    .observe(pageOption('video-accueil'), { attributes: true, attributeFilter: ['data-confirme', 'class'] });
  window.addEventListener('load', () => setTimeout(() => {
    OPTIONS.forEach(id => { const p = pageOption(id); if (p && p.dataset.reservee) confirmer(id, false); });
    retenir();
  }, 8000));

  // --- Numéros de page et sommaire : suivent les pages réellement affichées ---
  const visible = p => !p.hidden && !p.classList.contains('u-hidden');
  function numeroter() {
    const pages = Array.from(mag.querySelectorAll('.mag-page')).filter(visible);
    const liste = document.getElementById('sommaire-liste');
    const lignes = [];
    pages.forEach((p, i) => {
      const num = String(i + 1).padStart(2, '0');
      const folio = p.querySelector('.mag-folio .num');
      if (folio) folio.textContent = num;
      const [titre, sousTitre] = (p.dataset.sommaire || '').split('|');
      if (titre) lignes.push(`<li><a href="#${p.id}"><b>${num}</b><div><strong>${echapperHtml(titre)}</strong><span>${echapperHtml(sousTitre || '')}</span></div></a></li>`);
    });
    const html = lignes.join('');
    if (liste.innerHTML !== html) liste.innerHTML = html;
  }
  let attente = false;
  new MutationObserver(() => {
    if (attente) return;
    attente = true;
    requestAnimationFrame(() => { attente = false; numeroter(); });
  }).observe(mag, { attributes: true, subtree: true, attributeFilter: ['hidden', 'class'] });
  numeroter();

  // Le sommaire mène à la page choisie, juste sous la barre du haut (qui reste collée en haut).
  document.getElementById('sommaire-liste').addEventListener('click', e => {
    const lien = e.target.closest('a[href^="#"]');
    if (!lien) return;
    const cible = document.getElementById(lien.getAttribute('href').slice(1));
    if (!cible) return;
    e.preventDefault();
    const entete = document.querySelector('.site-header-v2');
    const y = cible.getBoundingClientRect().top + window.scrollY - (entete ? entete.offsetHeight : 84);
    window.scrollTo({ top: y, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  // (la dernière photo demandée pour une image gagne : une miniature en retard ne remplace pas
  // la version moyenne arrivée avant elle)
  function photo(img, url, nom, prioritaire) {
    if (!img || !url) return;
    img.alt = nom || '';
    img.dataset.voulue = url;
    prechargerPhoto(urlLegere(url), ok => { if (img.dataset.voulue === url) img.src = ok; }, !!prioritaire);
  }
  const fiche = id => 'mannequin.html?id=' + encodeURIComponent(id);
  const categorie = c => c === 'homme' ? T('Homme', 'Male') : c === 'femme' ? T('Femme', 'Female') : 'New Face';

  function vignette(m) {
    const a = document.createElement('a');
    a.href = fiche(m.id);
    a.innerHTML = '<div class="mag-cadre"><img alt="" loading="lazy"></div><span></span>';
    a.querySelector('img').alt = m.full_name || '';
    a.querySelector('img').src = urlLegere(m.photo);
    a.querySelector('span').textContent = m.full_name || T('Mannequin', 'Model');
    return a;
  }

  // --- Mannequins publiés : couverture, Femmes, Hommes, À la une, et les photos des autres pages ---
  async function chargerMannequins() {
    if (typeof sb === 'undefined' || !sb) return;
    const { data: profils } = await sb.from('model_profiles')
      .select('id, full_name, city, category, height_cm, featured')
      .eq('published', true).order('created_at', { ascending: false }).limit(200);
    if (!profils || !profils.length) { ['femmes', 'hommes', 'a-la-une'].forEach(id => { document.getElementById(id).hidden = true; }); return; }
    const nombre = document.getElementById('couv-nombre');
    nombre.textContent = profils.length > 1
      ? T(profils.length + ' mannequins à découvrir', profils.length + ' models to discover')
      : T('Nos mannequins à découvrir', 'Our models to discover');

    // une seule demande pour toutes les photos de couverture (la même que le Book)
    const { data: couvertures } = await sb.rpc('photos_couverture_mannequins', { ids: profils.map(p => p.id) });
    const photoDe = {};
    (couvertures || []).forEach(c => { if (c.url) photoDe[c.model_id] = c.url; });
    const avecPhoto = profils.filter(p => photoDe[p.id]).map(p => Object.assign({ photo: photoDe[p.id] }, p));
    if (!avecPhoto.length) { ['femmes', 'hommes', 'a-la-une'].forEach(id => { document.getElementById(id).hidden = true; }); return; }

    // À la une : la mannequin choisie dans l'Administration, sinon la plus récente
    const une = avecPhoto.find(p => p.featured) || avecPhoto[0];
    const lienUne = document.getElementById('une-lien');
    lienUne.href = fiche(une.id);
    photo(document.getElementById('une-img'), une.photo, une.full_name);
    document.getElementById('une-nom').textContent = une.full_name || T('Mannequin', 'Model');
    document.getElementById('une-info').textContent = [categorie(une.category), une.city, une.height_cm ? une.height_cm + ' cm' : null].filter(Boolean).join(' · ');

    // Couverture : une autre mannequin à chaque visite
    const autres = melanger(avecPhoto.filter(p => p.id !== une.id));
    const couv = autres[0] || une;
    photo(document.getElementById('couv-img'), couv.photo, couv.full_name, true);

    const credit = document.getElementById('couv-modele');
    credit.href = fiche(couv.id);
    document.getElementById('couv-modele-nom').textContent = couv.full_name || '';
    credit.hidden = !couv.full_name;

    // Les visages : 6 femmes, 3 hommes (les plus récents)
    const remplir = (page, grille, liste, max) => {
      const g = document.getElementById(grille);
      g.textContent = '';
      liste.slice(0, max).forEach(m => g.appendChild(vignette(m)));
      document.getElementById(page).hidden = !g.children.length;
    };
    remplir('femmes', 'grille-femmes', avecPhoto.filter(p => p.category === 'femme'), 6);
    remplir('hommes', 'grille-hommes', avecPhoto.filter(p => p.category === 'homme'), 3);

    // Photos d'ambiance des autres pages : d'autres visages, sans répéter la couverture
    const reste = autres.slice(1).concat(autres.slice(0, 1));
    [['sommaire-img', 0], ['agence-img', 1], ['dos-img', 2]].forEach(([id, i]) => {
      const m = reste[i % reste.length] || une;
      photo(document.getElementById(id), m.photo, m.full_name);
    });
    const edito = document.getElementById('edito-img');
    if (!edito.dataset.mot) { const m = reste[3 % reste.length] || une; photo(edito, m.photo, m.full_name); }

    // Couverture et « À la une » sont en pleine page : la version moyenne de la même photo
    // (plus nette que la miniature de 800 px) remplace la miniature dès qu'elle est connue.
    const { data: moyennes } = await sb.from('model_photos').select('model_id, url_miniature, url_moyenne').in('model_id', [couv.id, une.id]);
    const moyenneDe = m => ((moyennes || []).find(x => x.model_id === m.id && x.url_miniature === m.photo && x.url_moyenne) || {}).url_moyenne;
    if (moyenneDe(couv)) photo(document.getElementById('couv-img'), moyenneDe(couv), couv.full_name, true);
    if (moyenneDe(une)) photo(document.getElementById('une-img'), moyenneDe(une), une.full_name);

    defilerCouverture([couv].concat(autres.filter(m => m !== couv), une));
  }

  // --- Couverture : les photos de tous les mannequins défilent en continu (demande de la
  // propriétaire, 20/10/2026), en fondu toutes les 5 s ; le nom « En couverture » suit. Deux
  // images se relaient (#couv-img et #couv-img-2). Arrêt quand la couverture n'est pas à l'écran
  // ou que l'onglet est caché (données mobiles), et pas de défilement si le visiteur a demandé
  // moins d'animations. La version moyenne de chaque photo est demandée en une seule fois. ---
  async function defilerCouverture(liste) {
    if (liste.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const { data: photos } = await sb.from('model_photos').select('model_id, url_miniature, url_moyenne').in('model_id', liste.map(m => m.id));
    const nette = m => ((photos || []).find(x => x.model_id === m.id && x.url_miniature === m.photo && x.url_moyenne) || {}).url_moyenne || m.photo;
    const images = [document.getElementById('couv-img'), document.getElementById('couv-img-2')];
    const couverture = document.getElementById('couverture');
    const credit = document.getElementById('couv-modele');
    let rang = 0, visible = true, jeton = 0;
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(couverture);
    setInterval(() => {
      if (!visible || document.hidden) return;
      // (une photo injoignable ne bloque rien : la suivante est demandée 5 s plus tard, et une
      // réponse arrivée en retard est ignorée)
      rang = (rang + 1) % liste.length;
      const m = liste[rang], mien = ++jeton;
      prechargerPhoto(urlLegere(nette(m)), ok => {
        if (mien !== jeton) return;
        const cachee = images.find(i => !i.classList.contains('visible'));
        cachee.src = ok; cachee.alt = m.full_name || '';
        images.forEach(i => i.classList.toggle('visible', i === cachee));
        credit.href = fiche(m.id);
        document.getElementById('couv-modele-nom').textContent = m.full_name || '';
        credit.hidden = !m.full_name;
      });
    }, 5000);
  }

  // --- Édito : le mot de Maître Akesse quand il est rempli dans l'Administration ---
  async function chargerMotResponsable() {
    if (typeof sb === 'undefined' || !sb) return;
    const { data } = await sb.from('mot_responsable').select('*').eq('id', 'principal').maybeSingle();
    if (!data || !data.message) return;
    document.getElementById('edito-rubrique').textContent = T('Le mot de Maître Akesse', 'A word from Maître Akesse');
    document.getElementById('edito-texte').textContent = data.message;
    document.getElementById('edito-nom').textContent = data.nom || 'Maître Akesse';
    document.getElementById('edito-fonction').textContent = data.titre || '';
    document.getElementById('edito-signature').classList.remove('u-hidden');
    document.getElementById('edito').dataset.sommaire = T('Édito|Le mot de Maître Akesse', 'Editorial|A word from Maître Akesse');
    if (data.photo_url) {
      const img = document.getElementById('edito-img');
      img.dataset.mot = '1';
      photo(img, data.photo_url, data.nom || 'Maître Akesse');
    }
    numeroter();
  }

  // --- Dos de couverture : « Casting ouvert » seulement s'il y en a un (castings actifs de
  // l'Administration, les mêmes que la page Postuler) ; sinon, intégrer l'agence ---
  async function chargerCastingsOuverts() {
    if (typeof sb === 'undefined' || !sb) return;
    const { count, error } = await sb.from('casting_projets').select('id', { count: 'exact', head: true }).eq('actif', true);
    if (error || !count) return;
    document.getElementById('dos-rubrique').textContent = T('Casting ouvert', 'Open casting');
    document.getElementById('dos-texte').textContent = T(
      'Un casting est ouvert en ce moment. Femmes et hommes, à Abidjan et partout en Côte d\'Ivoire : envoyez votre candidature, nous étudions chaque profil.',
      'A casting is open right now. Women and men, in Abidjan and all over Côte d\'Ivoire: send your application, we review every profile.');
    const bouton = document.getElementById('dos-bouton');
    bouton.textContent = T('Postuler à un casting', 'Apply for a casting');
    bouton.href = 'candidature.html';
  }

  // --- Bandeau « Infos du jour » ---
  async function chargerBandeauAnnonce() {
    if (typeof sb === 'undefined' || !sb) return;
    const { data } = await sb.from('bandeau_annonce').select('texte, actif').eq('id', 'principal').maybeSingle();
    if (!data || !data.actif || !data.texte || !data.texte.trim()) return;
    const texte = data.texte.trim() + ' · ';
    document.querySelectorAll('#marqueePiste span').forEach(span => { span.textContent = texte; });
    document.getElementById('marqueeLabel').classList.remove('u-hidden');
    document.getElementById('marqueeBande').classList.add('marquee-annonce-active');
  }

  // --- Ils nous font confiance : logos des partenaires ---
  async function chargerPartenaires() {
    if (typeof sb === 'undefined' || !sb) return;
    const { data } = await sb.from('partenaires').select('id, nom, logo_url').order('created_at', { ascending: false }).limit(14);
    const avecLogo = (data || []).filter(p => p.logo_url).slice(0, 9);
    if (!avecLogo.length) { confirmer('ils-nous-font-confiance', false); return; }
    document.getElementById('confiance-liste').innerHTML = avecLogo.map(p => `
      <a href="partenaires.html?partenaire=${encodeURIComponent(p.id)}" title="${echapperHtml(p.nom || '')}">
        <img src="${echapperHtml(urlLegere(p.logo_url))}" alt="${echapperHtml(p.nom || '')}" loading="lazy">
      </a>`).join('');
    confirmer('ils-nous-font-confiance', true);
  }

  // --- Instagram : publications mises en cache depuis le tableau de bord ---
  async function chargerInstagram() {
    if (typeof sb === 'undefined' || !sb) return;
    const { data } = await sb.from('instagram_posts_cache').select('posts').eq('id', 'principal').maybeSingle();
    const posts = data && Array.isArray(data.posts) ? data.posts.filter(p => p && p.image) : [];
    if (!posts.length) { confirmer('flux-instagram', false); return; }
    document.getElementById('instagram-grille').innerHTML = posts.slice(0, 9).map(p => `
      <a href="${echapperHtml(/^https:\/\//i.test(p.lien || '') ? p.lien : 'https://www.instagram.com/maitreakessemodelmanagement')}" target="_blank" rel="noopener" title="${echapperHtml(p.legende || '')}">
        <img src="${echapperHtml(p.image)}" alt="${echapperHtml(p.legende || T('Publication Instagram', 'Instagram post'))}" loading="lazy">
      </a>`).join('');
    confirmer('flux-instagram', true);
  }

  [chargerMannequins, chargerMotResponsable, chargerCastingsOuverts, chargerBandeauAnnonce, chargerPartenaires, chargerInstagram]
    .forEach(f => { void Promise.resolve().then(f).catch(e => console.warn('Accueil : ' + f.name, e)); });
})();
