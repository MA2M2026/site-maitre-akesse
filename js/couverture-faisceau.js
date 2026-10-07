// Couverture animée en haut de l'accueil (essai demandé par la propriétaire, 04/10/2026) :
// la même animation « faisceau de lumière » que l'intro (js/faisceau.js), au format des
// couvertures de réseaux sociaux (Facebook sur ordinateur, 16:9 sur téléphone — voir
// css/splash.css). Elle se joue quand la couverture apparaît à l'écran, puis le logo reste
// en place et un reflet repasse de temps en temps. Elle ne tourne que lorsqu'elle est
// visible. Moins d'animations demandé ou image introuvable : logo fixe (image de secours).
// Si l'agence a choisi une vidéo dans le tableau de bord (table reglages_site, cle
// 'couverture'), la vidéo remplace l'animation en fondu, en boucle et sans le son.
(function () {
  var sec = document.getElementById('couverture-faisceau');
  if (!sec) return;

  // --- Sur ordinateur : couverture qui se replie ---
  // En haut de la page, la couverture est grande (format 16:9, jusqu'à 55 % de l'écran) ;
  // en faisant défiler, elle se réduit jusqu'à disparaître (06/10/2026 ; avant : bandeau
  // fixe de 28 % de l'écran), seule la barre du menu reste en haut. Sur téléphone : 16:9, au plus 26 % de
  // l'écran (05/10/2026 : elle prenait trop de place — 85 % / 40 % / 33 % avant).
  var racine = document.documentElement, attente = false;
  function majRepli() {
    attente = false;
    if (window.innerWidth <= 700) { racine.style.removeProperty('--couv-h-anim'); return; }
    var max = Math.min(window.innerWidth * 9 / 16, window.innerHeight * .55);
    // 06/10/2026 : repli complet (0) — la couverture laisse toute la place à la page et
    // seule la barre du menu reste fixée en haut (avant : bandeau de 28 % de l'écran).
    var min = 0;
    racine.style.setProperty('--couv-h-anim', Math.max(min, max - (window.scrollY || 0)) + 'px');
  }
  function demanderRepli() { if (!attente) { attente = true; requestAnimationFrame(majRepli); } }
  majRepli();
  window.addEventListener('scroll', demanderRepli, { passive: true });
  window.addEventListener('resize', demanderRepli);

  if (!window.ma2mFaisceau) return;
  try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  var cv = sec.querySelector('canvas');
  if (!cv || !cv.getContext || !cv.getContext('2d')) return;

  var anim = window.ma2mFaisceau(cv, { mode: 'couverture', mesurer: function () { return { W: cv.clientWidth || sec.clientWidth, H: cv.clientHeight || sec.clientHeight }; } });
  var t = 0, precedent = null, visible = false, enCours = false, videoActive = false;

  function image(ms) {
    if (!visible || videoActive) { enCours = false; precedent = null; return; }
    // le temps n'avance que pendant que la couverture est visible
    if (precedent !== null) t += Math.min(.1, (ms - precedent) / 1000);
    precedent = ms;
    anim.dessiner(t);
    requestAnimationFrame(image);
  }
  function relancer() { if (visible && !enCours) { enCours = true; requestAnimationFrame(image); } }

  anim.pret.then(function () {
    sec.classList.add('anime');
    anim.dimensionner(); anim.dessiner(0);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entrees) {
        visible = entrees[0].isIntersecting; relancer();
      }, { threshold: .25 }).observe(sec);
    } else { visible = true; relancer(); }
    window.addEventListener('resize', function () { anim.dimensionner(); anim.dessiner(t); });
    // L'animation doit aussi se remettre à la bonne taille quand la couverture apparaît
    // (accueil : elle est cachée derrière la porte d'entrée jusqu'au clic sur « Entrer »,
    // et elle restait alors vide — visite du 05/10/2026) ou change de taille sans que la
    // fenêtre change (couverture qui se replie sur ordinateur).
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () { anim.dimensionner(); anim.dessiner(t); relancer(); }).observe(cv);
    }
  }, function () { /* image introuvable : le logo fixe reste affiché */ });

  // --- vidéo choisie dans le tableau de bord ---
  function afficherVideo(valeur) {
    if (!valeur || valeur.type !== 'video' || typeof valeur.chemin !== 'string') return;
    // uniquement un fichier du dossier de la couverture, servi par le site lui-même
    if (!/^site\/couverture\/[A-Za-z0-9._-]+\.(mp4|webm)$/.test(valeur.chemin)) return;
    var v = document.createElement('video');
    v.className = 'couverture-video';
    v.muted = true; v.defaultMuted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.preload = 'auto';
    v.src = '/book-photos/' + valeur.chemin;
    v.addEventListener('playing', function () { videoActive = true; sec.classList.add('video-prete'); }, { once: true });
    v.addEventListener('error', function () { v.remove(); });
    sec.appendChild(v);
    Promise.resolve(v.play()).catch(function () {});
  }
  function lireReglage() {
    var CLE = 'ma2m_couverture';
    try {
      var c = JSON.parse(sessionStorage.getItem(CLE) || 'null');
      if (c && Date.now() - c.t < 5 * 60 * 1000) { afficherVideo(c.v); return; }
    } catch (e) {}
    if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') return;
    fetch(SUPABASE_URL + '/rest/v1/reglages_site?cle=eq.couverture&select=valeur', { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (lignes) {
        var v = lignes && lignes[0] ? lignes[0].valeur : null;
        try { sessionStorage.setItem(CLE, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {}
        afficherVideo(v);
      })
      .catch(function () {});
  }
  // supabase-config.js est chargé plus bas dans la page : on attend qu'elle soit prête.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lireReglage); else lireReglage();
})();
