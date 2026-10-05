// Tableau de bord — « Couverture du site (vidéo) » (demande de la propriétaire, 04/10/2026).
// Remplace l'animation du logo en haut de toutes les pages par une vidéo de l'agence, ou
// revient à l'animation. La vidéo est envoyée chez Cloudflare R2 (comme les images du site,
// api/r2-site-images.js, catégorie « couverture ») et le choix est enregistré dans la table
// reglages_site (cle 'couverture', extension 113 de supabase-extension.sql).
// Chaque vidéo est compressée dans le navigateur avant l'envoi (redessinée en plus petit puis réenregistrée),
// sans le son, et limitée à 30 secondes (la couverture tourne en boucle).
(function () {
  if (!document.getElementById('couv-fichier') || typeof sb === 'undefined') return;

  // Toutes les vidéos sont compressées automatiquement (demande de la propriétaire,
  // 05/10/2026 : site léger, sans case à cocher) : 1280 pixels de large au plus et
  // 2,5 Mbit/s — environ 9 Mo pour 30 secondes, image nette à 30 images/s (05/10 : 1,2 Mbit/s
  // abîmait trop l'image). Une vidéo déjà légère et lisible partout (MP4 H.264, 30 s,
  // 1920 pixels au plus, 12 Mo au plus) est envoyée TELLE QUELLE, sans perte de qualité.
  var DEBIT = 2500000, LARGEUR_MAX = 1280;
  var ORIGINAL_MAX = 12 * 1024 * 1024, ORIGINAL_LARGEUR_MAX = 1920;
  var LARGEUR_MIN = 854; // en dessous (vidéo réseaux sociaux / WhatsApp), floue en couverture
  var LIMITE_SANS_COMPRESSION = 8 * 1024 * 1024; // seulement si le navigateur ne sait pas compresser
  var LIMITE_FINALE = 15 * 1024 * 1024;   // au-delà, refus (même après compression)
  var DUREE_MAX = 30;
  var $ = function (id) { return document.getElementById(id); };
  var fichierChoisi = null, infosChoisies = null, reglage = null;

  function message(texte, erreur) { var m = $('couv-msg'); m.textContent = texte || ''; m.style.color = erreur ? '#e57373' : ''; }
  function mo(octets) { return (octets / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo'; }
  function barre(part) {
    var b = $('couv-barre');
    if (part === null) { b.classList.add('u-hidden'); return; }
    b.classList.remove('u-hidden'); $('couv-barre-rempli').style.width = Math.round(part * 100) + '%';
  }

  function apercu(chemin) {
    var zone = $('couv-apercu'); zone.textContent = '';
    if (!chemin) return;
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', '');
    v.src = '/book-photos/' + chemin;
    zone.appendChild(v);
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  }

  async function chargerReglage() {
    var r = await sb.from('reglages_site').select('valeur').eq('cle', 'couverture').maybeSingle();
    if (r.error) {
      $('couv-etat').textContent = /reglages_site|relation|schema cache/i.test(r.error.message || '')
        ? '⚠ Il manque un réglage dans la base de données : exécutez l’extension 113 dans Supabase (SQL Editor), puis rechargez cette page.'
        : 'Impossible de lire le réglage actuel : ' + r.error.message;
      return;
    }
    reglage = r.data ? r.data.valeur : null;
    if (reglage && reglage.type === 'video' && reglage.chemin) {
      $('couv-etat').textContent = 'Actuellement : votre vidéo (' + (reglage.taille ? mo(reglage.taille) + ', ' : '') + 'mise en ligne le ' + new Date(reglage.maj).toLocaleDateString('fr-FR') + ').';
      apercu(reglage.chemin);
    } else {
      $('couv-etat').textContent = 'Actuellement : l’animation du logo (faisceau de lumière).';
      apercu(null);
    }
  }

  // Lit la durée et la taille d'image d'une vidéo choisie sur l'appareil.
  function lireInfos(fichier) {
    return new Promise(function (ok, ko) {
      var v = document.createElement('video'), url = URL.createObjectURL(fichier);
      v.preload = 'metadata'; v.muted = true;
      v.onloadedmetadata = function () { ok({ duree: v.duration, largeur: v.videoWidth, hauteur: v.videoHeight }); URL.revokeObjectURL(url); };
      v.onerror = function () { URL.revokeObjectURL(url); ko(new Error('Cette vidéo ne peut pas être lue par ce navigateur. Essayez une vidéo MP4.')); };
      v.src = url;
    });
  }

  // L'original peut-il être envoyé tel quel (s'il est déjà plus léger que la version
  // compressée, ou si le navigateur ne sait pas compresser) ?
  function originalUtilisable(f, inf) {
    return /^video\/(mp4|webm)$/.test(f.type) && inf.duree <= DUREE_MAX + 0.5 && inf.largeur <= LARGEUR_MAX;
  }

  function afficherInfos() {
    if (!fichierChoisi || !infosChoisies) return;
    var inf = infosChoisies, txt = '« ' + fichierChoisi.name + ' » — ' + mo(fichierChoisi.size) + ', ' + Math.round(inf.duree) + ' s, ' + inf.largeur + ' × ' + inf.hauteur + '. ';
    txt += 'Elle sera compressée automatiquement avant l’envoi' + (inf.duree > DUREE_MAX + 0.5 ? ' et limitée aux ' + DUREE_MAX + ' premières secondes' : '') + ' (cela prend à peu près la durée de la vidéo — gardez cette page ouverte).';
    $('couv-infos').textContent = txt;
  }

  // Compression (05/10/2026) : d'abord avec l'outil Mediabunny (js/vendor/, déjà utilisé
  // pour les vidéos de candidature). Il produit un vrai MP4 « classique » (H.264, 30 images
  // par seconde, sommaire en tête de fichier) que tous les navigateurs savent lire, iPhone
  // compris. L'ancienne méthode (enregistrement d'un canvas) donnait un MP4 « en morceaux »
  // à 15 images/s que certains téléphones n'affichaient pas en couverture : elle ne sert
  // plus que de secours si le navigateur ne connaît pas Mediabunny/WebCodecs.
  function chargerMediabunny() {
    if (window.Mediabunny) return Promise.resolve(window.Mediabunny);
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = 'js/vendor/mediabunny-1.61.0.min.js';
      s.onload = function () { window.Mediabunny ? ok(window.Mediabunny) : ko(new Error('outil vidéo absent')); };
      s.onerror = function () { ko(new Error('outil vidéo non chargé')); };
      document.head.appendChild(s);
    });
  }
  async function compresserMediabunny(fichier, progression) {
    if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return null;
    var MB = await chargerMediabunny();
    var entree = new MB.Input({ source: new MB.BlobSource(fichier), formats: MB.ALL_FORMATS });
    var piste = await entree.getPrimaryVideoTrack();
    if (!piste || !(await piste.canDecode())) return null;
    var l = piste.displayWidth, h = piste.displayHeight;
    if (l / h < 1.25) throw new Error('Cette vidéo est verticale (' + l + ' × ' + h + ') : la couverture n’accepte que les vidéos horizontales, filmées téléphone couché.');
    var echelle = Math.min(1, LARGEUR_MAX / l);
    l = Math.max(2, Math.round(l * echelle / 2) * 2); h = Math.max(2, Math.round(h * echelle / 2) * 2);
    var codec = null, liste = ['avc', 'vp9'];
    for (var i = 0; i < liste.length && !codec; i++) {
      try { if (await MB.canEncodeVideo(liste[i], { width: l, height: h, bitrate: DEBIT })) codec = liste[i]; } catch (e) {}
    }
    if (!codec) return null;
    var enMp4 = codec === 'avc';
    var sortie = new MB.Output({
      format: enMp4 ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(),
      target: new MB.BufferTarget()
    });
    var duree = await entree.computeDuration();
    var conversion = await MB.Conversion.init({
      input: entree, output: sortie, tracks: 'primary',
      video: { width: l, height: h, fit: 'contain', codec: codec, bitrate: DEBIT, frameRate: 30, forceTranscode: true },
      audio: { discard: true },
      trim: { start: 0, end: Math.min(isFinite(duree) ? duree : DUREE_MAX, DUREE_MAX) }
    });
    if (!conversion.isValid) return null;
    conversion.onProgress = function (p) { progression(Math.min(1, p)); };
    await conversion.execute();
    var octets = sortie.target.buffer;
    if (!octets || !octets.byteLength) return null;
    var type = enMp4 ? 'video/mp4' : 'video/webm';
    return new File([octets], 'couverture.' + (enMp4 ? 'mp4' : 'webm'), { type: type });
  }

  async function compresser(fichier, progression) {
    try {
      var propre = await compresserMediabunny(fichier, progression);
      if (propre) return propre;
    } catch (e) {
      if (/verticale/.test((e && e.message) || '')) throw e;
      if (window.signalerErreur) window.signalerErreur('Couverture : compression Mediabunny impossible', (e && e.message) || String(e), mo(fichier.size) + ', ' + (fichier.type || '?'));
    }
    return compresserCanvas(fichier, progression);
  }

  // Secours : la vidéo est lue, redessinée en plus petit dans un canvas, et réenregistrée.
  async function compresserCanvas(fichier, progression) {
    var types = ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    var mime = window.MediaRecorder ? types.find(function (t) { return MediaRecorder.isTypeSupported(t); }) : null;
    if (!mime) return null;
    var url = URL.createObjectURL(fichier), v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.src = url;
    await new Promise(function (ok, ko) { v.onloadedmetadata = ok; v.onerror = function () { ko(new Error('Cette vidéo ne peut pas être lue par ce navigateur.')); }; });
    var w = Math.min(LARGEUR_MAX, v.videoWidth); w -= w % 2;
    var h = Math.round(w * v.videoHeight / v.videoWidth); h -= h % 2;
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    var flux = c.captureStream(30);
    var rec = new MediaRecorder(flux, { mimeType: mime, videoBitsPerSecond: DEBIT });
    var morceaux = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) morceaux.push(e.data); };
    var fini = new Promise(function (ok) { rec.onstop = ok; });
    var duree = Math.min(isFinite(v.duration) ? v.duration : DUREE_MAX, DUREE_MAX), arrete = false;
    function arreter() { if (arrete) return; arrete = true; v.pause(); if (rec.state !== 'inactive') rec.stop(); }
    function dessiner() {
      if (arrete) return;
      x.drawImage(v, 0, 0, w, h);
      progression(Math.min(1, v.currentTime / duree));
      if (v.currentTime >= duree || v.ended) { arreter(); return; }
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(dessiner); else requestAnimationFrame(dessiner);
    }
    v.addEventListener('ended', arreter);
    rec.start(500);
    await v.play();
    dessiner();
    await fini;
    URL.revokeObjectURL(url);
    var type = mime.split(';')[0];
    return new File([new Blob(morceaux, { type: type })], 'couverture.' + (type === 'video/mp4' ? 'mp4' : 'webm'), { type: type });
  }

  async function enregistrer(valeur) {
    var r = await sb.from('reglages_site').upsert({ cle: 'couverture', valeur: valeur, maj: new Date().toISOString() });
    if (r.error) throw new Error(/reglages_site|relation|schema cache/i.test(r.error.message || '') ? 'Il manque un réglage dans la base : exécutez l’extension 113 dans Supabase.' : r.error.message);
    try { sessionStorage.removeItem('ma2m_couverture'); } catch (e) {}
  }

  $('couv-fichier').addEventListener('change', async function () {
    fichierChoisi = this.files && this.files[0]; infosChoisies = null;
    $('couv-publier-btn').disabled = true; $('couv-infos').textContent = ''; message('');
    if (!fichierChoisi) return;
    try {
      infosChoisies = await lireInfos(fichierChoisi);
      // Vidéos horizontales seulement (décision du 05/10/2026) : la couverture est une bande
      // large qui va d'un bord à l'autre de l'écran ; une vidéo verticale ou carrée y serait
      // coupée en haut et en bas au point de ne plus rien montrer d'utile.
      if (infosChoisies.largeur && infosChoisies.largeur < LARGEUR_MIN && infosChoisies.largeur / infosChoisies.hauteur >= 1.25) {
        message('Cette vidéo est trop petite (' + infosChoisies.largeur + ' × ' + infosChoisies.hauteur + ') : en couverture, elle serait floue. Choisissez la vidéo d’origine filmée en HD (1280 × 720 ou plus), pas une copie reçue par WhatsApp ou téléchargée d’un réseau social.', true);
        $('couv-fichier').value = ''; fichierChoisi = null; infosChoisies = null;
        return;
      }
      if (infosChoisies.largeur && infosChoisies.hauteur && infosChoisies.largeur / infosChoisies.hauteur < 1.25) {
        message('Cette vidéo est ' + (infosChoisies.hauteur > infosChoisies.largeur ? 'verticale' : 'presque carrée') + ' (' + infosChoisies.largeur + ' × ' + infosChoisies.hauteur + '). La couverture n’accepte que les vidéos horizontales : filmez en tenant le téléphone couché (en paysage), puis choisissez cette nouvelle vidéo.', true);
        $('couv-fichier').value = ''; fichierChoisi = null; infosChoisies = null;
        return;
      }
      afficherInfos(); $('couv-publier-btn').disabled = false;
    }
    catch (e) { message(e.message, true); }
  });

  $('couv-publier-btn').addEventListener('click', async function () {
    if (!fichierChoisi || !infosChoisies) return;
    var bouton = this; bouton.disabled = true; $('couv-animation-btn').disabled = true;
    try {
      var envoi = fichierChoisi;
      // Déjà légère et lisible partout : envoyée sans recompression (aucune perte).
      if (await originalSansPerte(fichierChoisi, infosChoisies)) {
        await envoyerFichier(fichierChoisi);
        return;
      }
      message('Compression en cours… gardez cette page ouverte.');
      var compressee = await compresser(fichierChoisi, function (p) { barre(p); message('Compression en cours… ' + Math.round(p * 100) + ' % — gardez cette page ouverte.'); });
      var originalOk = originalUtilisable(fichierChoisi, infosChoisies);
      if (!compressee) {
        if (!originalOk || fichierChoisi.size > LIMITE_SANS_COMPRESSION) throw new Error('La compression n’est pas possible sur ce navigateur. Essayez avec Chrome (ordinateur ou téléphone Android).');
      } else if (!(originalOk && fichierChoisi.size <= compressee.size)) envoi = compressee;
      if (envoi.size > LIMITE_FINALE) throw new Error('Même compressée, la vidéo fait ' + mo(envoi.size) + ' (maximum ' + mo(LIMITE_FINALE) + '). Choisissez une vidéo plus courte.');
      await envoyerFichier(envoi);
    } catch (e) {
      message(e.message || 'L’envoi a échoué — réessayez.', true);
      bouton.disabled = false;
    } finally {
      barre(null); $('couv-animation-btn').disabled = false;
    }
  });

  async function envoyerFichier(envoi) {
      barre(1); message('Envoi de la vidéo (' + mo(envoi.size) + ')…');
      var ext = envoi.type === 'video/webm' ? 'webm' : 'mp4';
      var chemin = 'site/couverture/' + Date.now() + '.' + ext;
      await envoyerImageSite('couverture', chemin, envoi);
      var ancien = reglage && reglage.type === 'video' ? reglage.chemin : null;
      await enregistrer({ type: 'video', chemin: chemin, taille: envoi.size, maj: new Date().toISOString() });
      if (ancien && ancien !== chemin) supprimerImageSite('couverture', ancien);
      message('✓ Votre vidéo est maintenant la couverture du site (toutes les pages, en français et en anglais).');
      $('couv-fichier').value = ''; fichierChoisi = null; $('couv-infos').textContent = '';
      await chargerReglage();
  }

  // Original envoyable sans recompression : MP4 en H.264 (lisible sur tous les téléphones),
  // 30 s au plus, horizontal, 1920 pixels de large au plus et 12 Mo au plus.
  async function originalSansPerte(f, inf) {
    if (f.type !== 'video/mp4' || f.size > ORIGINAL_MAX || inf.duree > DUREE_MAX + 0.5 || inf.largeur > ORIGINAL_LARGEUR_MAX) return false;
    try {
      var MB = await chargerMediabunny();
      var entree = new MB.Input({ source: new MB.BlobSource(f), formats: MB.ALL_FORMATS });
      var piste = await entree.getPrimaryVideoTrack();
      return !!piste && piste.codec === 'avc';
    } catch (e) { return false; }
  }

  $('couv-animation-btn').addEventListener('click', async function () {
    if (!reglage || reglage.type !== 'video') { message('La couverture affiche déjà l’animation du logo.'); return; }
    if (!confirm('Revenir à l’animation du logo en couverture ? Votre vidéo actuelle sera supprimée.')) return;
    var bouton = this; bouton.disabled = true;
    try {
      var ancien = reglage.chemin;
      await enregistrer({ type: 'animation', maj: new Date().toISOString() });
      if (ancien) supprimerImageSite('couverture', ancien);
      message('✓ La couverture affiche de nouveau l’animation du logo.');
      await chargerReglage();
    } catch (e) { message(e.message, true); }
    finally { bouton.disabled = false; }
  });

  chargerReglage();
})();
