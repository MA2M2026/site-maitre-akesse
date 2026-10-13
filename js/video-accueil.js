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

    // Lecture automatique refusée (mode économie de données ou de batterie, réglage du
    // navigateur…) : avant le 12/10/2026, l'espace restait noir — « un creux au milieu ».
    // On montre alors la première image et le bouton devient « Lire le film ».
    function etiquette() {
      bouton.setAttribute('aria-pressed', v.muted ? 'false' : 'true');
      bouton.querySelector('span').textContent = v.muted
        ? (anglais ? 'Turn sound on' : 'Activer le son')
        : (anglais ? 'Mute' : 'Couper le son');
    }
    function lecture() {
      Promise.resolve(v.play()).catch(function () {
        if (!v.paused) return;
        sec.classList.add('video-bloquee');
        bouton.querySelector('span').textContent = anglais ? 'Play the film' : 'Lire le film';
      });
    }
    // Servie directement par Cloudflare quand c'est permis (13/10/2026, comme les photos :
    // urlLegere et la roue de secours de js/app.js), sinon par le relais /book-photos/.
    // Tout ennui sur la vidéo directe la fait passer par le relais, au même moment de la
    // lecture ; mais seul un échec AVANT toute donnée reçue, confirmé par le relais, fait
    // basculer tout le site (une coupure passagère en pleine lecture n'accuse pas Cloudflare).
    var relais = '/book-photos/' + valeur.chemin;
    var parSecoursRelais = false, donneesDirectes = false, attente = null;
    function directe() { return estPhotoDirecte(v.getAttribute('src')); }
    function vers(src) {
      var t = v.currentTime || 0;
      clearTimeout(attente);
      v.src = src;
      v.addEventListener('loadedmetadata', function () { try { if (t) v.currentTime = t; } catch (e) {} }, { once: true });
      lecture();
    }
    function charger() {
      if (v.src) return;
      v.preload = 'auto';  // la section est proche : la première image s'affiche même sans lecture
      v.src = urlLegere(relais);
      lecture();
      // Chargement sans fin (domaine injoignable sans erreur) : rien après 10 s et la sonde
      // ne répond pas → bascule de tout le site (passerAuRelais prévient aussi la vidéo).
      if (!directe()) return;
      setTimeout(function () {
        if (v.readyState >= 1 || !directe()) return;
        sonderPhotosDirectes(function (repondu) {
          if (repondu || v.readyState >= 1 || !directe()) return;
          passerAuRelais('vidéo de l\'accueil : Cloudflare sans réponse');
        });
      }, 10000);
    }
    // Bascule décidée ailleurs (photos de la page) : la vidéo directe suit.
    document.addEventListener('ma2m:photos-relais', function () { if (directe()) vers(relais); });
    // Lecture bloquée en attente de données depuis plus de 12 s (réseau muet en cours de
    // lecture) : la vidéo seule passe par le relais.
    v.addEventListener('waiting', function () {
      if (!directe()) return;
      clearTimeout(attente);
      attente = setTimeout(function () { if (directe() && v.readyState < 3) vers(relais); }, 12000);
    });
    v.addEventListener('playing', function () { clearTimeout(attente); });
    v.addEventListener('loadeddata', function () {
      if (directe()) donneesDirectes = true;
      // échec direct avant toute donnée, et la vidéo s'affiche par le relais : Cloudflare en cause
      if (parSecoursRelais) { parSecoursRelais = false; passerAuRelais('échec de la vidéo directe ' + valeur.chemin); }
    });
    v.addEventListener('loadedmetadata', function () { forme(v.videoWidth, v.videoHeight); }, { once: true });
    v.addEventListener('loadeddata', function () { sec.classList.add('video-prete'); }, { once: true });
    v.addEventListener('playing', function () {
      sec.classList.add('video-prete');
      if (sec.classList.contains('video-bloquee')) { sec.classList.remove('video-bloquee'); etiquette(); }
    });
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
    // première image aussi sur le fond flouté, même si la lecture automatique est refusée
    if (ctx) v.addEventListener('loadeddata', function () { try { ctx.drawImage(v, 0, 0, 48, 27); } catch (e) {} }, { once: true });
    // Erreur de lecture (12/10/2026 : sur une tablette Android de la propriétaire, la vidéo
    // apparaissait puis disparaissait au bout d'une ou deux secondes, laissant un espace
    // noir). On relance une fois le fichier ; si l'erreur revient, l'espace est retiré et le
    // code d'erreur du navigateur part dans le journal des erreurs du tableau de bord, pour
    // connaître la cause exacte sur cet appareil.
    // Vidéo directe en échec : d'abord la même vidéo par le relais (sans compter comme relance).
    var relance = false;
    v.addEventListener('error', function () {
      var code = v.error ? v.error.code : 0;
      if (directe()) { parSecoursRelais = !donneesDirectes; vers(relais); return; }
      parSecoursRelais = false;  // le relais échoue aussi : le fichier est en cause, pas Cloudflare
      if (!relance) {
        relance = true;
        vers(relais + '?relance=1');
        return;
      }
      sec.classList.add('u-hidden');
      if (window.signalerErreur) window.signalerErreur('video', 'Vidéo de l\'accueil illisible (code ' + code + ')', v.error?.message || valeur.chemin);
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entrees) {
        var visible = entrees[0].isIntersecting;
        if (visible) { charger(); if (v.src && v.paused && !sec.classList.contains('video-bloquee')) lecture(); }
        else if (v.src && !v.paused) v.pause();
      }, { rootMargin: '300px 0px' }).observe(sec);
    } else { charger(); }

    bouton.addEventListener('click', function () {
      charger();
      v.muted = !v.muted;
      if (!v.muted) { v.volume = 1; Promise.resolve(v.play()).catch(function () {}); }
      etiquette();
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
