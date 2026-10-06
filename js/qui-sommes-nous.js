// Page « Qui sommes-nous » (06/10/2026) : remplit la présentation animée avec les vraies
// photos de l'agence, lues dans la base (lecture publique seulement) :
//  - ouverture : photos de nos événements et défilés, en fondu enchaîné ;
//  - portrait du fondateur (mot du responsable) ;
//  - bandeau de visages : une photo par mannequin publié, chacune mène à sa fiche ;
//  - « Nous l'avons déjà fait » : photos de chaque événement ;
//  - ligne des étapes qui se remplit au défilement, léger décalage de la photo des marques.
// Sans réseau ou sans photos, la page reste entièrement lisible (textes fixes dans le HTML).
(function () {
  const moinsDeMouvement = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enAnglais = document.documentElement.lang === 'en';
  const prefixe = enAnglais ? '../' : '';

  function melange(liste) {
    const t = liste.slice();
    for (let i = t.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [t[i], t[j]] = [t[j], t[i]];
    }
    return t;
  }

  function image(url, alt) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = alt || '';
    img.decoding = 'async';
    return img;
  }

  // Fondu enchaîné entre plusieurs photos dans un même cadre.
  function diaporama(cadre, urls, alt, delai) {
    if (!cadre || !urls.length) return;
    const imgs = urls.map((u, i) => {
      const img = image(u, alt);
      if (i > 0) img.loading = 'lazy';
      img.addEventListener('error', () => img.remove());
      cadre.appendChild(img);
      return img;
    });
    let n = 0;
    const montrer = () => {
      const presentes = imgs.filter(img => img.isConnected);
      if (!presentes.length) return;
      presentes.forEach(img => img.classList.remove('actif'));
      const img = presentes[n % presentes.length];
      // relance l'effet de zoom à chaque passage
      void img.offsetWidth;
      img.classList.add('actif');
      n++;
    };
    const premiere = imgs[0];
    if (premiere.complete) montrer(); else premiere.addEventListener('load', montrer, { once: true });
    if (!moinsDeMouvement && imgs.length > 1) setInterval(() => { if (!document.hidden) montrer(); }, delai);
  }

  async function lirePhotosEvenements() {
    const [ev, ph] = await Promise.all([
      sb.from('evenements').select('id, titre, image_url').order('date_evenement', { ascending: false }),
      sb.from('evenement_photos').select('evenement_id, url').order('created_at', { ascending: true }).limit(400)
    ]);
    const evenements = ev.data || [];
    const photos = ph.data || [];
    return evenements.map(e => {
      const urls = photos.filter(p => p.evenement_id === e.id).map(p => p.url);
      // la photo de couverture (souvent une affiche) ne sert que s'il n'y a rien d'autre
      if (!urls.length && e.image_url) urls.push(e.image_url);
      return { titre: String(e.titre || ''), urls: urls.filter(Boolean) };
    });
  }

  async function chargerEvenements() {
    const evenements = await lirePhotosEvenements();
    const toutes = [];
    evenements.forEach(e => e.urls.forEach(u => toutes.push(u)));
    diaporama(document.getElementById('qsn-diaporama'), melange(toutes).slice(0, 8), '', 6000);

    // Photo du bloc « marques » : une photo de défilé, en léger décalage au défilement.
    const fond = document.getElementById('qsn-marques-fond');
    if (fond && toutes.length) {
      const img = image(melange(toutes)[0], '');
      img.loading = 'lazy';
      fond.appendChild(img);
    }

    // Cartes « Nous l'avons déjà fait » : toutes les photos des événements du même nom.
    document.querySelectorAll('.qsn-evenement[data-evenement]').forEach(carte => {
      const cle = carte.dataset.evenement;
      const urls = [];
      evenements.filter(e => e.titre.toLowerCase().indexOf(cle) !== -1).forEach(e => e.urls.forEach(u => urls.push(u)));
      const titre = carte.querySelector('h3');
      diaporama(carte.querySelector('.qsn-evenement-photo'), melange(urls).slice(0, 6), titre ? titre.textContent : '', 4500);
    });
  }

  async function chargerPortrait() {
    const { data } = await sb.from('mot_responsable').select('nom, photo_url').eq('id', 'principal').maybeSingle();
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
    const { data } = await sb
      .from('model_photos')
      .select('url, url_moyenne, model_id, model_profiles!inner(published)')
      .eq('model_profiles.published', true)
      .order('created_at', { ascending: false })
      .limit(300);
    const parMannequin = new Map();
    melange(data || []).forEach(p => {
      if (!parMannequin.has(p.model_id)) parMannequin.set(p.model_id, p.url_moyenne || p.url);
    });
    const visages = melange(Array.from(parMannequin.entries())).slice(0, 16);
    if (visages.length < 4) return;
    // La liste est posée deux fois de suite : le défilement boucle sans à-coup.
    [0, 1].forEach(tour => {
      visages.forEach(([id, url]) => {
        const a = document.createElement('a');
        a.href = prefixe + 'mannequin.html?id=' + encodeURIComponent(id);
        const img = image(url, enAnglais ? 'Model of the agency' : 'Mannequin de l\'agence');
        img.loading = 'lazy';
        a.appendChild(img);
        if (tour === 1) { a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1; }
        piste.appendChild(a);
      });
    });
    bloc.hidden = false;
  }

  // Ligne des étapes qui se remplit + décalage de la photo des marques, au défilement.
  function suivreDefilement() {
    if (moinsDeMouvement) return;
    const etapes = document.getElementById('qsn-etapes');
    const fond = document.getElementById('qsn-marques-fond');
    let attente = false;
    const maj = () => {
      attente = false;
      const h = window.innerHeight;
      if (etapes) {
        const r = etapes.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (h * 0.7 - r.top) / r.height));
        etapes.style.setProperty('--qsn-progres', p.toFixed(3));
      }
      if (fond) {
        const r = fond.parentNode.getBoundingClientRect();
        if (r.bottom > 0 && r.top < h) fond.style.setProperty('--qsn-decalage', Math.round((r.top + r.height / 2 - h / 2) * -0.12) + 'px');
      }
    };
    window.addEventListener('scroll', () => { if (!attente) { attente = true; requestAnimationFrame(maj); } }, { passive: true });
    window.addEventListener('resize', maj);
    maj();
  }

  document.addEventListener('DOMContentLoaded', () => {
    suivreDefilement();
    if (typeof sb === 'undefined' || !sb) return;
    [chargerEvenements, chargerPortrait, chargerVisages].forEach(f => {
      f().catch(e => console.warn('Qui sommes-nous : photos non chargées', e));
    });
  });
})();
