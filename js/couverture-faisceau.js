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
  // En haut de la page, la couverture est grande (format 16:9, jusqu'à 85 % de l'écran) ;
  // en faisant défiler, elle se réduit jusqu'au bandeau fixe (format Facebook, 40 % de
  // l'écran au plus), puis la page passe dessous. Sur téléphone, elle reste en 16:9.
  var racine = document.documentElement, attente = false;
  function majRepli() {
    attente = false;
    if (window.innerWidth <= 700) { racine.style.removeProperty('--couv-h-anim'); return; }
    var max = Math.min(window.innerWidth * 9 / 16, window.innerHeight * .85);
    var min = Math.min(window.innerWidth * 312 / 820, window.innerHeight * .4);
    racine.style.setProperty('--couv-h-anim', Math.max(min, max - (window.scrollY || 0)) + 'px');
  }
  function demanderRepli() { if (!attente) { attente = true; requestAnimationFrame(majRepli); } }
  majRepli();
  window.addEventListener('scroll', demanderRepli, { passive: true });
  window.addEventListener('resize', demanderRepli);

  // --- Que montrer : la vidéo choisie dans le tableau de bord, ou l'animation du logo ? ---
  // Le choix est gardé sur l'appareil (localStorage) : à la visite suivante, la vidéo part
  // tout de suite, sans passer par l'animation. Il est vérifié aussitôt auprès de la base
  // (requête lancée dès maintenant, sans attendre la fin de la page). Première visite : on
  // attend la réponse (1,5 s au plus) avant de lancer quoi que ce soit — écran sombre.
  var SUPA = 'https://dfhghgmwmxiguhtxtsle.supabase.co';
  // clé publique « anon » (la même que js/supabase-config.js, publique par nature)
  var CLE_PUBLIQUE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmaGdoZ213bXhpZ3VodHh0c2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NzI1ODQsImV4cCI6MjEwNDI0ODU4NH0.S-JftGJNtPMLZdK6Jy9AUwwOl56JzyllkEJ0GN0eZ-M';
  var MEMO = 'ma2m_couverture_v2';
  try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  sec.classList.add('attente');      // le logo fixe de secours reste caché pendant la décision

  function videoValide(v) {
    return !!(v && v.type === 'video' && typeof v.chemin === 'string' && /^site\/couverture\/[A-Za-z0-9._-]+\.(mp4|webm)$/.test(v.chemin));
  }
  function memoLire() { try { return JSON.parse(localStorage.getItem(MEMO) || 'null'); } catch (e) { return null; } }
  function memoEcrire(v) { try { localStorage.setItem(MEMO, JSON.stringify({ t: Date.now(), v: v || null })); } catch (e) {} }

  // ---------- animation du logo ----------
  var cv = sec.querySelector('canvas'), anim = null, animLancee = false;
  var t = 0, precedent = null, visible = false, enCours = false, videoActive = false;
  function image(ms) {
    if (!visible || videoActive) { enCours = false; precedent = null; return; }
    // le temps n'avance que pendant que la couverture est visible
    if (precedent !== null) t += Math.min(.1, (ms - precedent) / 1000);
    precedent = ms;
    anim.dessiner(t);
    requestAnimationFrame(image);
  }
  function relancer() { if (anim && visible && !enCours && !videoActive) { enCours = true; requestAnimationFrame(image); } }
  function lancerAnimation() {
    if (animLancee) return; animLancee = true;
    if (!window.ma2mFaisceau || !cv || !cv.getContext || !cv.getContext('2d')) { sec.classList.remove('attente'); return; }
    anim = window.ma2mFaisceau(cv, { mode: 'couverture', mesurer: function () { return { W: cv.clientWidth || sec.clientWidth, H: cv.clientHeight || sec.clientHeight }; } });
    anim.pret.then(function () {
      sec.classList.add('anime'); sec.classList.remove('attente');
      anim.dimensionner(); anim.dessiner(0);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entrees) { visible = entrees[0].isIntersecting; relancer(); }, { threshold: .25 }).observe(sec);
      } else { visible = true; relancer(); }
      window.addEventListener('resize', function () { anim.dimensionner(); anim.dessiner(t); });
    }, function () { sec.classList.remove('attente'); /* image introuvable : logo fixe */ });
  }

  // ---------- vidéo ----------
  var videoCourante = null;
  function retirerVideo() {
    sec.querySelectorAll('.couverture-video, .couverture-video-fond').forEach(function (e) { e.remove(); });
    sec.classList.remove('video-prete'); videoActive = false; videoCourante = null;
  }
  function afficherVideo(valeur) {
    // La vidéo s'affiche toujours EN ENTIER (aucun recadrage), quelle que soit sa forme ;
    // si elle n'a pas la forme de la couverture, une copie floutée et assombrie de la même
    // vidéo remplit les côtés (comme Instagram / YouTube). L'image d'attente (première
    // image de la vidéo, créée par le tableau de bord) s'affiche pendant le chargement.
    videoCourante = valeur.chemin;
    var affiche = typeof valeur.affiche === 'string' && /^site\/couverture\/[A-Za-z0-9._-]+\.jpg$/.test(valeur.affiche) ? '/book-photos/' + valeur.affiche : '';
    function creer(classe) {
      var v = document.createElement('video');
      v.className = classe;
      v.muted = true; v.defaultMuted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
      v.preload = 'auto';
      if (affiche) v.poster = affiche;
      v.src = '/book-photos/' + valeur.chemin;
      return v;
    }
    var v = creer('couverture-video'), fond = null;
    v.addEventListener('loadedmetadata', function () {
      var formeVideo = v.videoWidth / v.videoHeight, formeCadre = (v.clientWidth || sec.clientWidth) / (v.clientHeight || sec.clientHeight);
      if (!isFinite(formeVideo)) return;
      // forme proche de celle du cadre (ex. 16:9 dans la grande couverture) : la vidéo le
      // remplit entièrement (très léger recadrage), sans fond flou
      if (Math.abs(formeVideo / formeCadre - 1) < .2) { v.classList.add('remplir'); return; }
      fond = creer('couverture-video-fond');
      sec.insertBefore(fond, v);
      var p2 = fond.play(); if (p2 && p2.catch) p2.catch(function () {});
    }, { once: true });
    function prete() { videoActive = true; sec.classList.add('video-prete'); sec.classList.remove('attente'); }
    if (affiche) prete();                         // l'image d'attente s'affiche tout de suite
    v.addEventListener('playing', prete, { once: true });
    v.addEventListener('error', function () { retirerVideo(); lancerAnimation(); });
    sec.appendChild(v);
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  }

  // ---------- décision ----------
  var memo = memoLire(), decide = false;
  if (memo && videoValide(memo.v)) { decide = true; afficherVideo(memo.v); }
  else if (memo) { decide = true; lancerAnimation(); }
  var delai = setTimeout(function () { if (!decide) { decide = true; lancerAnimation(); } }, 1500);
  fetch(SUPA + '/rest/v1/reglages_site?cle=eq.couverture&select=valeur', { headers: { apikey: CLE_PUBLIQUE, Authorization: 'Bearer ' + CLE_PUBLIQUE } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (lignes) {
      if (!lignes) throw new Error('réglage illisible');
      var v = lignes[0] ? lignes[0].valeur : null;
      memoEcrire(v);
      clearTimeout(delai);
      if (videoValide(v)) {
        if (videoCourante !== v.chemin) { retirerVideo(); afficherVideo(v); }
        decide = true;
      } else {
        if (videoCourante) retirerVideo();
        decide = true; lancerAnimation();
      }
    })
    .catch(function () { clearTimeout(delai); if (!decide) { decide = true; lancerAnimation(); } });
})();
