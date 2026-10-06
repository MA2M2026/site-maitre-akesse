// Page « Qui sommes-nous » (06/10/2026) : remplit la présentation animée avec les vraies
// photos de l'agence, lues dans la base (lecture publique seulement) :
//  - ouverture : photos de nos événements et défilés, en fondu enchaîné ;
//  - portrait du fondateur (mot du responsable) ;
//  - bandeau de visages : une photo par mannequin publié, chacune mène à sa fiche ;
//  - « Nous l'avons déjà fait » : photos de chaque événement ;
//  - mise en mouvement : titres lettre par lettre et mot par mot, photos qui entrent en
//    volet, grands mots et valeurs qui glissent au défilement, cartes qui s'inclinent.
// Sans réseau ou sans photos, la page reste entièrement lisible (textes fixes dans le HTML).
(function () {
  const moinsDeMouvement = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enAnglais = document.documentElement.lang === 'en';

  function image(url, alt) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt || '';
    img.decoding = 'async';
    return img;
  }

  // Enchaînement de photos dans un même cadre : la nouvelle entre en volet par-dessus
  // la précédente, puis zoome lentement.
  function diaporama(cadre, urls, alt, delai) {
    if (!cadre || !urls.length) return;
    const imgs = urls.map((u, i) => {
      const img = image(u, alt);
      if (i > 0) img.loading = 'lazy';
      img.addEventListener('error', () => img.remove());
      cadre.appendChild(img);
      return img;
    });
    let n = 0, demarre = false, aLEcran = true;
    const montrer = () => {
      const presentes = imgs.filter(img => img.isConnected);
      if (!presentes.length) return;
      const img = presentes[n % presentes.length];
      presentes.forEach(x => {
        x.classList.toggle('precedent', x.classList.contains('actif') && x !== img);
        x.classList.remove('actif');
      });
      // image suivante : l'effet de volet et de zoom repart de zéro
      requestAnimationFrame(() => img.classList.add('actif'));
      n++;
    };
    // On démarre avec la première photo qui arrive (une photo en erreur ne bloque rien).
    const demarrer = () => { if (!demarre) { demarre = true; montrer(); } };
    imgs.forEach(img => { if (img.complete && img.naturalWidth) demarrer(); else img.addEventListener('load', demarrer, { once: true }); });
    if (moinsDeMouvement || imgs.length < 2) return;
    // Pas de changement de photo quand le cadre n'est pas à l'écran (batterie des téléphones).
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { aLEcran = e[0].isIntersecting; }).observe(cadre);
    setInterval(() => { if (demarre && aLEcran && !document.hidden) montrer(); }, delai);
  }


  const cleTitre = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();

  async function lirePhotosEvenements() {
    const [ev, ph] = await Promise.all([
      sb.from('evenements').select('id, titre, lieu, image_url').order('date_evenement', { ascending: false }),
      lireToutesLignes(() => sb.from('evenement_photos').select('id, evenement_id, url').order('id', { ascending: true }))
    ]);
    if (ev.error) throw ev.error;
    if (ph.error) console.warn('Qui sommes-nous : photos d\'événements incomplètes', ph.error);
    const evenements = ev.data || [];
    const photos = ph.data || [];
    return evenements.map(e => {
      const urls = photos.filter(p => p.evenement_id === e.id).map(p => p.url);
      // la photo de couverture (souvent une affiche) ne sert que s'il n'y a rien d'autre
      if (!urls.length && e.image_url) urls.push(e.image_url);
      return { titre: String(e.titre || ''), lieu: String(e.lieu || ''), urls: urls.filter(Boolean) };
    });
  }

  async function chargerEvenements() {
    const evenements = await lirePhotosEvenements();
    const toutes = [];
    evenements.forEach(e => e.urls.forEach(u => toutes.push(u)));
    diaporama(document.getElementById('qsn-diaporama'), melanger(toutes).slice(0, 8), '', 6000);

    // Photo du bloc « marques » : une photo de défilé, en léger décalage au défilement.
    const fond = document.getElementById('qsn-marques-fond');
    if (fond && toutes.length) {
      const img = image(melanger(toutes)[0], '');
      img.loading = 'lazy';
      fond.appendChild(img);
    }

    // Les autres événements enregistrés dans le tableau de bord ont aussi leur carte
    // (un même titre sur plusieurs dates ne donne qu'une carte).
    const grille = document.getElementById('qsn-evenements');
    if (grille) {
      const vus = new Set([...grille.querySelectorAll('[data-evenement]')].map(c => c.dataset.evenement));
      evenements.forEach(e => {
        const t = cleTitre(e.titre);
        // pas de carte vide : un événement sans aucune photo n'est pas affiché
        if (!t || vus.has(t) || !e.urls.length) return;
        vus.add(t);
        const carte = document.createElement('article');
        carte.className = 'qsn-evenement reveal';
        carte.dataset.evenement = t;
        const photo = document.createElement('div');
        photo.className = 'qsn-evenement-photo qsn-rideau';
        const h3 = document.createElement('h3');
        h3.textContent = titreLisible(e.titre);
        carte.appendChild(photo); carte.appendChild(h3);
        if (e.lieu) { const p = document.createElement('p'); p.textContent = titreLisible(e.lieu); carte.appendChild(p); }
        grille.appendChild(carte);
      });
    }

    // Cartes « Nous l'avons déjà fait » : toutes les photos des événements du même nom.
    document.querySelectorAll('.qsn-evenement[data-evenement]').forEach(carte => {
      const cle = carte.dataset.evenement;
      const urls = [];
      evenements.filter(e => cleTitre(e.titre) === cle).forEach(e => e.urls.forEach(u => urls.push(u)));
      const titre = carte.querySelector('h3');
      if (!urls.length) { carte.querySelector('.qsn-evenement-photo').hidden = true; return; }
      diaporama(carte.querySelector('.qsn-evenement-photo'), melanger(urls).slice(0, 6), titre ? titre.textContent : '', 4500);
    });
  }

  async function chargerPortrait() {
    const { data, error } = await sb.from('mot_responsable').select('nom, photo_url').eq('id', 'principal').maybeSingle();
    if (error) throw error;
    if (!data || !data.photo_url) return;
    const img = document.getElementById('qsn-portrait-img');
    const fig = img && img.closest('.qsn-portrait');
    if (!img || !fig) return;
    img.addEventListener('load', () => { img.hidden = false; fig.classList.add('avec-photo'); }, { once: true });
    img.src = data.photo_url;
    if (data.nom) document.getElementById('qsn-portrait-nom').textContent = data.nom;
  }

  async function chargerVisages() {
    const piste = document.getElementById('qsn-visages-piste');
    const bloc = piste && piste.closest('.qsn-visages');
    if (!piste || !bloc) return;
    // Toutes les photos (par paquets) pour que chaque mannequin publié ait sa chance.
    const { data, error } = await lireToutesLignes(() => sb
      .from('model_photos')
      .select('id, url, url_moyenne, model_id, model_profiles!inner(published)')
      .eq('model_profiles.published', true)
      .order('id', { ascending: true }));
    if (error && !(data && data.length)) throw error;
    const parMannequin = new Map();
    melanger(data || []).forEach(p => {
      if (!parMannequin.has(p.model_id)) parMannequin.set(p.model_id, p.url_moyenne || p.url);
    });
    const visages = melanger(Array.from(parMannequin.entries())).slice(0, 16);
    if (visages.length < 4) return;
    // La liste est posée deux fois de suite : le défilement boucle sans à-coup.
    [0, 1].forEach(tour => {
      visages.forEach(([id, url]) => {
        const a = document.createElement('a');
        a.href = 'mannequin.html?id=' + encodeURIComponent(id);
        const img = image(url, enAnglais ? 'Model of the agency' : 'Mannequin de l\'agence');
        img.loading = 'lazy';
        a.appendChild(img);
        if (tour === 1) { a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1; }
        piste.appendChild(a);
      });
    });
    // Deuxième rangée, dans l'ordre inverse, qui défile dans l'autre sens.
    const inverse = piste.cloneNode(true);
    inverse.removeAttribute('id');
    inverse.classList.add('qsn-visages-inverse');
    [...inverse.children].reverse().forEach(a => { a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1; inverse.appendChild(a); });
    piste.after(inverse);
    bloc.hidden = false;
  }

  // Tout ce qui bouge avec le défilement : barre de lecture en haut, titre d'ouverture qui
  // s'efface, ligne des étapes qui se remplit, photo des marques en décalage, grands mots
  // qui glissent, valeurs qui avancent chacune à leur vitesse.
  function suivreDefilement() {
    if (moinsDeMouvement) return;
    const barre = document.getElementById('qsn-progression');
    const ouverture = document.querySelector('.qsn-ouverture');
    const etapes = document.getElementById('qsn-etapes');
    const fond = document.getElementById('qsn-marques-fond');
    const bandeaux = [...document.querySelectorAll('.qsn-bandeau-texte')];
    const valeurs = [...document.querySelectorAll('.qsn-valeurs-liste li')];
    let attente = false;
    // Toutes les mesures d'abord, toutes les écritures ensuite : le navigateur ne recalcule
    // la mise en page qu'une fois par image, même sur un petit téléphone.
    const maj = () => {
      attente = false;
      const h = window.innerHeight;
      const total = document.documentElement.scrollHeight - h;
      const rOuv = ouverture && ouverture.getBoundingClientRect();
      const rEtapes = etapes && etapes.getBoundingClientRect();
      const rFond = fond && fond.parentNode.getBoundingClientRect();
      const rBandeaux = bandeaux.map(el => el.getBoundingClientRect());
      const rValeurs = valeurs.map(li => li.getBoundingClientRect());

      if (barre) barre.style.setProperty('--qsn-lu', total > 0 ? Math.min(1, window.scrollY / total).toFixed(4) : '0');
      if (rOuv) ouverture.style.setProperty('--qsn-sortie', Math.min(1, Math.max(0, -rOuv.top / rOuv.height)).toFixed(3));
      if (rEtapes) etapes.style.setProperty('--qsn-progres', Math.min(1, Math.max(0, (h * 0.7 - rEtapes.top) / rEtapes.height)).toFixed(3));
      if (rFond && rFond.bottom > 0 && rFond.top < h) fond.style.setProperty('--qsn-decalage', Math.round((rFond.top + rFond.height / 2 - h / 2) * -0.25) + 'px');
      bandeaux.forEach((el, i) => {
        const r = rBandeaux[i];
        if (r.bottom < -200 || r.top > h + 200) return;
        el.style.setProperty('--qsn-glisse', Math.round((r.top - h) * 0.45 * (Number(el.dataset.sens) || 1)) + 'px');
      });
      valeurs.forEach((li, i) => {
        const r = rValeurs[i];
        const ecart = (r.top + r.height / 2 - h / 2) / h; // -0,5 à 0,5 autour du milieu de l'écran
        li.style.setProperty('--qsn-avance', Math.round(ecart * (i % 2 ? -70 : 70)) + 'px');
      });
    };
    const demander = () => { if (!attente) { attente = true; requestAnimationFrame(maj); } };
    window.addEventListener('scroll', demander, { passive: true });
    window.addEventListener('resize', demander);
    maj();
  }

  // Un mot découpé en lettres animées, numérotées à partir de « depart ».
  function motEnLettres(mot, depart) {
    const m = document.createElement('span');
    m.className = 'qsn-mot-entier';
    [...mot].forEach((c, k) => {
      const l = document.createElement('span');
      l.className = 'qsn-lettre';
      l.textContent = c;
      l.style.setProperty('--i', depart + k);
      m.appendChild(l);
    });
    return m;
  }

  // Titre d'ouverture lettre par lettre (chaque mot reste insécable).
  function decouperLettres(el) {
    let i = 0;
    const parcourir = noeud => {
      [...noeud.childNodes].forEach(n => {
        if (n.nodeType === 1) { parcourir(n); return; }
        if (n.nodeType !== 3 || !n.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(mot => {
          if (!mot) return;
          if (/^\s+$/.test(mot)) { frag.appendChild(document.createTextNode(' ')); return; }
          frag.appendChild(motEnLettres(mot, i));
          i += [...mot].length;
        });
        n.replaceWith(frag);
      });
    };
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    parcourir(el);
    [...el.querySelectorAll('.qsn-mot-entier')].forEach(m => m.setAttribute('aria-hidden', 'true'));
  }

  // Titres de section : les mots montent un à un derrière un cache.
  function decouperMots(el) {
    let i = 0;
    [...el.childNodes].forEach(n => {
      if (n.nodeType !== 3 || !n.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(mot => {
        if (!mot) return;
        if (/^\s+$/.test(mot)) { frag.appendChild(document.createTextNode(' ')); return; }
        const cache = document.createElement('span');
        cache.className = 'qsn-cache';
        const s = document.createElement('span');
        s.textContent = mot;
        s.style.setProperty('--i', i++);
        cache.appendChild(s);
        frag.appendChild(cache);
      });
      n.replaceWith(frag);
    });
    el.classList.add('qsn-mots');
  }

  // Mise en mouvement de la page : découpe des titres, apparitions au défilement,
  // inclinaison des cartes des pôles et parallaxe de l'ouverture au mouvement de la souris.
  function mettreEnMouvement() {
    if (moinsDeMouvement || !('IntersectionObserver' in window)) return;
    const page = document.querySelector('main.qsn');
    if (!page) return;
    const titre = document.querySelector('.qsn-lettres');
    if (titre) decouperLettres(titre);
    page.querySelectorAll('h2').forEach(decouperMots);
    page.classList.add('qsn-mouvement');

    // Un élément caché par son propre rideau (clip-path) n'est jamais « vu » par le
    // navigateur : on observe donc son parent, puis on lève le rideau de l'enfant.
    const cibles = new Map();
    const vus = new IntersectionObserver(entrees => entrees.forEach(e => {
      if (!e.isIntersecting) return;
      (cibles.get(e.target) || []).forEach(el => el.classList.add('qsn-vu'));
      cibles.delete(e.target);
      vus.unobserve(e.target);
    }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    const observer = el => {
      const t = el.classList.contains('qsn-rideau') ? el.parentElement : el;
      if (!cibles.has(t)) { cibles.set(t, []); vus.observe(t); }
      cibles.get(t).push(el);
    };
    page.querySelectorAll('.qsn-mots, .qsn-rideau').forEach(observer);
    // cartes d'événements ajoutées après coup
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType === 1 && n.querySelectorAll) n.querySelectorAll('.qsn-rideau').forEach(observer);
    }))).observe(page, { childList: true, subtree: true });
    // filet de sécurité : rien ne doit rester caché si l'observation échoue
    setTimeout(() => page.querySelectorAll('.qsn-mots:not(.qsn-vu), .qsn-rideau:not(.qsn-vu)').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) el.classList.add('qsn-vu');
    }), 3000);

    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    page.querySelectorAll('.qsn-pole').forEach(carte => {
      carte.addEventListener('pointermove', e => {
        const r = carte.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        carte.classList.add('qsn-incline');
        carte.style.setProperty('--qsn-ry', (x * 14).toFixed(2) + 'deg');
        carte.style.setProperty('--qsn-rx', (y * -14).toFixed(2) + 'deg');
      });
      carte.addEventListener('pointerleave', () => {
        carte.style.setProperty('--qsn-ry', '0deg');
        carte.style.setProperty('--qsn-rx', '0deg');
      });
    });
    const ouverture = document.querySelector('.qsn-ouverture');
    if (ouverture) ouverture.addEventListener('pointermove', e => {
      ouverture.style.setProperty('--qsn-mx', (e.clientX / window.innerWidth - 0.5).toFixed(3));
      ouverture.style.setProperty('--qsn-my', (e.clientY / window.innerHeight - 0.5).toFixed(3));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    mettreEnMouvement();
    suivreDefilement();
    if (typeof sb === 'undefined' || !sb) return;
    [chargerEvenements, chargerPortrait, chargerVisages].forEach(f => {
      f().catch(e => console.warn('Qui sommes-nous : photos non chargées', e));
    });
  });
})();
