// Espace vidéo de la page d'accueil (audit du 05/10/2026, demande de la propriétaire) :
// un grand film d'un bord à l'autre de l'écran, choisi dans le tableau de bord (« Vidéo de
// la page d'accueil », js/couverture-admin.js, réglage reglages_site cle 'video_accueil').
// - Tant qu'aucune vidéo n'est choisie, la section reste cachée (aucune place perdue).
// - La vidéo ne se télécharge que lorsque le visiteur approche de la section (économie de
//   données mobiles), démarre sans le son (règle des navigateurs) et se met en pause hors
//   de l'écran. Le bouton « Activer le son » la relance avec le son, d'un appui.
(function () {
  var sec = document.getElementById('video-accueil');
  if (!sec) return;
  var anglais = (document.documentElement.lang || '').indexOf('en') === 0;
  var CLE_CACHE = 'ma2m_video_accueil';

  function afficher(valeur) {
    if (!valeur || valeur.type !== 'video' || typeof valeur.chemin !== 'string') return;
    // uniquement un fichier du dossier prévu, servi par le site lui-même
    if (!/^site\/video-accueil\/[A-Za-z0-9._-]+\.(mp4|webm)$/.test(valeur.chemin)) return;
    var v = sec.querySelector('video');
    var bouton = sec.querySelector('.video-accueil-son');
    // Verticale ou horizontale (06/10/2026) : la forme de l'espace suit celle de la vidéo,
    // connue dès le réglage (ou, pour une vidéo envoyée avant, dès sa première image).
    function forme(l, h) { if (l && h) sec.classList.toggle('video-verticale', h > l); }
    forme(valeur.largeur, valeur.hauteur);
    sec.classList.remove('u-hidden');

    function charger() {
      if (v.src) return;
      v.src = '/book-photos/' + valeur.chemin;
      Promise.resolve(v.play()).catch(function () {});
    }
    v.addEventListener('loadedmetadata', function () { forme(v.videoWidth, v.videoHeight); }, { once: true });
    v.addEventListener('playing', function () { sec.classList.add('video-prete'); }, { once: true });
    // Fond flouté pour une vidéo verticale sur écran large (06/10/2026) : une toute petite
    // copie de l'image (48 × 27 points) redessinée à chaque image, agrandie et floutée par
    // le navigateur — les côtés sont remplis par la vidéo elle-même, sans second
    // téléchargement et pour un calcul négligeable.
    var flou = document.createElement('canvas');
    flou.className = 'video-accueil-flou'; flou.width = 48; flou.height = 27; flou.setAttribute('aria-hidden', 'true');
    sec.insertBefore(flou, v);
    var ctx = flou.getContext && flou.getContext('2d');
    function peindre() {
      if (ctx && !v.paused && sec.classList.contains('video-verticale') && flou.offsetParent !== null) {
        try { ctx.drawImage(v, 0, 0, 48, 27); } catch (e) {}
      }
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(peindre); else setTimeout(peindre, 100);
    }
    if (ctx) v.addEventListener('playing', peindre, { once: true });
    v.addEventListener('error', function () { sec.classList.add('u-hidden'); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entrees) {
        var visible = entrees[0].isIntersecting;
        if (visible) { charger(); if (v.src && v.paused) { Promise.resolve(v.play()).catch(function () {}); } }
        else if (v.src && !v.paused) v.pause();
      }, { rootMargin: '300px 0px' }).observe(sec);
    } else { charger(); }

    bouton.addEventListener('click', function () {
      charger();
      v.muted = !v.muted;
      if (!v.muted) { v.volume = 1; Promise.resolve(v.play()).catch(function () {}); }
      bouton.setAttribute('aria-pressed', v.muted ? 'false' : 'true');
      bouton.querySelector('span').textContent = v.muted
        ? (anglais ? 'Turn sound on' : 'Activer le son')
        : (anglais ? 'Mute' : 'Couper le son');
    });
  }

  function lire() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CLE_CACHE) || 'null');
      if (c && Date.now() - c.t < 5 * 60 * 1000) { afficher(c.v); return; }
    } catch (e) {}
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') return;
    fetch(SUPABASE_URL + '/rest/v1/reglages_site?cle=eq.video_accueil&select=valeur', { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (lignes) {
        var v = lignes && lignes[0] ? lignes[0].valeur : null;
        try { sessionStorage.setItem(CLE_CACHE, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {}
        afficher(v);
      })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lire); else lire();
})();
