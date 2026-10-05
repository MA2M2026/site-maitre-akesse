// Tableau de bord — vidéos du site gérées par l'agence (un seul outil pour deux zones) :
//  - « Couverture du site » (04/10/2026) : remplace l'animation du logo en haut de toutes
//    les pages ; sans le son, 30 s au plus (elle tourne en boucle) ;
//  - « Vidéo de l'accueil » (05/10/2026, audit) : grand film dans le corps de la page
//    d'accueil (js/video-accueil.js) ; le son est gardé (le visiteur l'active d'un appui),
//    60 s au plus.
// Les vidéos sont envoyées chez Cloudflare R2 (api/r2-site-images.js) et le choix est
// enregistré dans la table reglages_site (cle 'couverture' ou 'video_accueil').
(function () {
  if (typeof sb === 'undefined') return;
  [
    { prefixe: 'couv', cle: 'couverture', categorie: 'couverture', cache: 'ma2m_couverture', son: false, dureeMax: 30,
      nomZone: 'la couverture', etatSans: 'Actuellement : l’animation du logo (faisceau de lumière).',
      succes: '✓ Votre vidéo est maintenant la couverture du site (accueil, Services, Intégrer l’agence, Postuler à un casting, Contact… en français et en anglais).',
      retirerQuestion: 'Revenir à l’animation du logo en couverture ? Votre vidéo actuelle sera supprimée.',
      retirerFait: '✓ La couverture affiche de nouveau l’animation du logo.', dejaSans: 'La couverture affiche déjà l’animation du logo.' },
    { prefixe: 'va', cle: 'video_accueil', categorie: 'video-accueil', cache: 'ma2m_video_accueil', son: true, dureeMax: 600,
      nomZone: 'la vidéo de l’accueil', etatSans: 'Actuellement : aucune vidéo (l’espace vidéo reste caché sur l’accueil).',
      succes: '✓ Votre vidéo est maintenant affichée sur la page d’accueil (en français et en anglais).',
      retirerQuestion: 'Retirer la vidéo de la page d’accueil ? Elle sera supprimée.',
      retirerFait: '✓ La vidéo est retirée : l’espace vidéo est de nouveau caché sur l’accueil.', dejaSans: 'Il n’y a pas de vidéo sur l’accueil.',
      // Verticale ou horizontale (demande de la propriétaire, 06/10/2026) : l'espace vidéo
      // prend la forme de la vidéo (js/video-accueil.js).
      tousFormats: true }
  ].forEach(function (zone) { if (document.getElementById(zone.prefixe + '-fichier')) brancherZone(zone); });

  function brancherZone(Z) {

  // Toutes les vidéos sont compressées automatiquement (demande de la propriétaire,
  // 05/10/2026 : site léger, sans case à cocher) : 1280 pixels de large au plus et
  // 2,5 Mbit/s — environ 9 Mo pour 30 secondes, image nette à 30 images/s (05/10 : 1,2 Mbit/s
  // abîmait trop l'image). Une vidéo déjà légère et lisible partout (MP4 H.264, 30 s,
  // 1920 pixels au plus, 12 Mo au plus) est envoyée TELLE QUELLE, sans perte de qualité.
  var DEBIT = 2500000, LARGEUR_MAX = 1280;
  var ORIGINAL_MAX = 12 * 1024 * 1024, ORIGINAL_LARGEUR_MAX = 1920;
  // Vidéo de l'accueil : longues vidéos acceptées (défilés de 5 à 10 minutes, demande de la
  // propriétaire, 06/10/2026). Au-delà de 90 s, débit un peu plus bas (1,5 Mbit/s, toujours
  // en 720p) : 8 minutes ≈ 95 Mo au lieu de 150. Le visiteur ne télécharge jamais tout
  // d'un coup : la vidéo se lit au fur et à mesure.
  if (Z.son) ORIGINAL_MAX = 250 * 1024 * 1024;
  function debitPour(duree) { return Z.son && duree > 90 ? 1500000 : DEBIT; }
  var LARGEUR_MIN = 854; // en dessous (vidéo réseaux sociaux / WhatsApp), floue en couverture
  var LIMITE_SANS_COMPRESSION = 8 * 1024 * 1024; // seulement si le navigateur ne sait pas compresser
  var LIMITE_FINALE = 25 * 1024 * 1024;   // au-delà, refus (même après compression) — 15 → 25 Mo le 06/10/2026
  var DUREE_MAX = Z.dureeMax;
  var LIMITE_FINALE_ZONE = Z.son ? 250 * 1024 * 1024 : LIMITE_FINALE;
  var $ = function (id) { return document.getElementById(Z.prefixe + '-' + id); };
  // Mesure de taille : la largeur pour la couverture (toujours horizontale) ; le plus grand
  // côté pour la vidéo de l'accueil, qui peut aussi être verticale (1080 × 1920 → 720 × 1280).
  function cote(l, h) { return Z.tousFormats ? Math.max(l, h) : l; }
  var fichierChoisi = null, infosChoisies = null, reglage = null;

  function message(texte, erreur) { var m = $('msg'); m.textContent = texte || ''; m.style.color = erreur ? '#e57373' : ''; }
  function mo(octets) { return (octets / 1024 / 1024).toFixed(1).replace('.', ',') + ' Mo'; }
  function barre(part) {
    var b = $('barre');
    if (part === null) { b.classList.add('u-hidden'); return; }
    b.classList.remove('u-hidden'); $('barre-rempli').style.width = Math.round(part * 100) + '%';
  }

  function apercu(chemin) {
    var zone = $('apercu'); zone.textContent = '';
    if (!chemin) return;
    var v = document.createElement('video');
    v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', '');
    v.src = '/book-photos/' + chemin;
    zone.appendChild(v);
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  }

  async function chargerReglage() {
    var r = await sb.from('reglages_site').select('valeur').eq('cle', Z.cle).maybeSingle();
    if (r.error) {
      $('etat').textContent = /reglages_site|relation|schema cache/i.test(r.error.message || '')
        ? '⚠ Il manque un réglage dans la base de données : exécutez l’extension 113 dans Supabase (SQL Editor), puis rechargez cette page.'
        : 'Impossible de lire le réglage actuel : ' + r.error.message;
      return;
    }
    reglage = r.data ? r.data.valeur : null;
    if (reglage && reglage.type === 'video' && reglage.chemin) {
      $('etat').textContent = 'Actuellement : votre vidéo (' + (reglage.taille ? mo(reglage.taille) + ', ' : '') + 'mise en ligne le ' + new Date(reglage.maj).toLocaleDateString('fr-FR') + ').';
      apercu(reglage.chemin);
    } else {
      $('etat').textContent = Z.etatSans;
      apercu(null);
    }
  }

  // Lit la durée et la taille d'image d'une vidéo choisie sur l'appareil. 06/10/2026 : si le
  // lecteur du navigateur ne sait pas l'ouvrir (HEVC/H.265 d'iPhone, de DJI ou de caméra,
  // fichiers .mov, .mkv…), l'outil Mediabunny lit directement le fichier au lieu de refuser.
  function lireInfosLecteur(fichier) {
    return new Promise(function (ok) {
      var v = document.createElement('video'), url = URL.createObjectURL(fichier), fini = false;
      function fin(r) { if (fini) return; fini = true; URL.revokeObjectURL(url); ok(r); }
      v.preload = 'metadata'; v.muted = true;
      v.onloadedmetadata = function () { fin(v.videoWidth && v.videoHeight && isFinite(v.duration) ? { duree: v.duration, largeur: v.videoWidth, hauteur: v.videoHeight } : null); };
      v.onerror = function () { fin(null); };
      setTimeout(function () { fin(null); }, 10000);
      v.src = url;
    });
  }
  async function lireInfos(fichier) {
    var inf = await lireInfosLecteur(fichier);
    if (inf) return inf;
    try {
      var MB = await chargerMediabunny();
      var entree = new MB.Input({ source: new MB.BlobSource(fichier), formats: MB.ALL_FORMATS });
      var piste = await entree.getPrimaryVideoTrack();
      if (piste) return { duree: await entree.computeDuration(), largeur: piste.displayWidth, hauteur: piste.displayHeight, codec: piste.codec };
    } catch (e) {}
    signaler('format illisible', '');
    throw new Error('Le format de cette vidéo n’est pas reconnu (« ' + fichierChoisi.name + ' »). Essayez avec Chrome sur un ordinateur ; si le problème continue, envoyez-moi le nom de l’appareil qui l’a filmée.');
  }
  // Journal du tableau de bord (« Erreurs réelles du site ») : détails utiles pour comprendre
  // pourquoi une vidéo ne passe pas (format, taille, appareil).
  function signaler(quoi, detail) {
    if (!window.signalerErreur || !fichierChoisi) return;
    window.signalerErreur('Vidéo du site (' + Z.nomZone + ') : ' + quoi, (detail || '') + ' — « ' + fichierChoisi.name + ' », ' + mo(fichierChoisi.size) + ', ' + (fichierChoisi.type || 'type inconnu') + (infosChoisies ? ', ' + infosChoisies.largeur + '×' + infosChoisies.hauteur + ', ' + Math.round(infosChoisies.duree) + ' s' + (infosChoisies.codec ? ', ' + infosChoisies.codec : '') : ''), navigator.userAgent);
  }

  // L'original peut-il être envoyé tel quel (s'il est déjà plus léger que la version
  // compressée, ou si le navigateur ne sait pas compresser) ?
  function originalUtilisable(f, inf) {
    return /^video\/(mp4|webm)$/.test(f.type) && inf.duree <= DUREE_MAX + 0.5 && cote(inf.largeur, inf.hauteur) <= LARGEUR_MAX;
  }

  function afficherInfos() {
    if (!fichierChoisi || !infosChoisies) return;
    var inf = infosChoisies, txt = '« ' + fichierChoisi.name + ' » — ' + mo(fichierChoisi.size) + ', ' + Math.round(inf.duree) + ' s, ' + inf.largeur + ' × ' + inf.hauteur + '. ';
    txt += 'Elle sera compressée automatiquement avant l’envoi' + (inf.duree > DUREE_MAX + 0.5 ? ' et limitée aux ' + (DUREE_MAX >= 120 ? (DUREE_MAX / 60) + ' premières minutes' : DUREE_MAX + ' premières secondes') : '') + ' (cela prend à peu près la durée de la vidéo — gardez cette page ouverte).';
    if (Z.son && inf.duree > 120) txt += ' Pour une longue vidéo, utilisez de préférence un ordinateur.';
    $('infos').textContent = txt;
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
  // Résultat : un File, avec .sansSon = true si le son n'a pas pu être gardé, .tel = true si
  // l'image a été recopiée sans recompression (format que ce navigateur ne sait pas décoder).
  async function compresserMediabunny(fichier, progression) {
    if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return null;
    var MB = await chargerMediabunny();
    var entree = new MB.Input({ source: new MB.BlobSource(fichier), formats: MB.ALL_FORMATS });
    var piste = await entree.getPrimaryVideoTrack();
    if (!piste) throw new Error('aucune image dans ce fichier');
    var l = piste.displayWidth, h = piste.displayHeight;
    if (!Z.tousFormats && l / h < 1.25) throw new Error('Cette vidéo est verticale (' + l + ' × ' + h + ') : ' + Z.nomZone + ' n’accepte que les vidéos horizontales, filmées téléphone couché.');
    var dureeSource = await entree.computeDuration();
    var fin = Math.min(isFinite(dureeSource) ? dureeSource : DUREE_MAX, DUREE_MAX);
    if (!(await piste.canDecode())) return recopier(MB, entree, piste, fin, progression);
    var echelle = Math.min(1, LARGEUR_MAX / cote(l, h));
    var debit = debitPour(fin);
    l = Math.max(2, Math.round(l * echelle / 2) * 2); h = Math.max(2, Math.round(h * echelle / 2) * 2);
    var codec = null, liste = ['avc', 'vp9', 'av1'];
    for (var i = 0; i < liste.length && !codec; i++) {
      try { if (await MB.canEncodeVideo(liste[i], { width: l, height: h, bitrate: debit })) codec = liste[i]; } catch (e) {}
    }
    if (!codec) return recopier(MB, entree, piste, fin, progression);
    var enMp4 = codec === 'avc';
    // Son : AAC si possible, sinon Opus ; si ce navigateur ne sait rien en faire, la vidéo
    // part sans le son plutôt que d'être refusée (06/10/2026).
    var audio = { discard: true }, sansSon = false;
    var pisteSon = Z.son ? await entree.getPrimaryAudioTrack() : null;
    if (pisteSon) {
      var codecSon = null, sons = enMp4 ? ['aac', 'opus'] : ['opus'];
      if (await pisteSon.canDecode()) {
        for (var k = 0; k < sons.length && !codecSon; k++) {
          try { if (await MB.canEncodeAudio(sons[k], { numberOfChannels: 2, sampleRate: 48000, bitrate: 128000 })) codecSon = sons[k]; } catch (e) {}
        }
      }
      if (codecSon) audio = { codec: codecSon, numberOfChannels: 2, sampleRate: 48000, bitrate: 128000 };
      else sansSon = true;
    }
    async function essayer(optAudio) {
      var sortie = new MB.Output({
        format: enMp4 ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(),
        target: new MB.BufferTarget()
      });
      var conversion = await MB.Conversion.init({
        input: entree, output: sortie, tracks: 'primary',
        video: { width: l, height: h, fit: 'contain', codec: codec, bitrate: debit, frameRate: 30, forceTranscode: true },
        audio: optAudio,
        trim: { start: 0, end: fin }
      });
      return { sortie: sortie, conversion: conversion };
    }
    var essai = await essayer(audio);
    if (!essai.conversion.isValid && !audio.discard) { essai = await essayer({ discard: true }); sansSon = true; }
    if (!essai.conversion.isValid) return recopier(MB, entree, piste, fin, progression);
    if (pisteSon && essai.conversion.discardedTracks.some(function (d) { return d.track && d.track.type === 'audio'; })) sansSon = true;
    essai.conversion.onProgress = function (p) { progression(Math.min(1, p)); };
    await essai.conversion.execute();
    var octets = essai.sortie.target.buffer;
    if (!octets || !octets.byteLength) return null;
    var resultat = new File([octets], Z.cle + '.' + (enMp4 ? 'mp4' : 'webm'), { type: enMp4 ? 'video/mp4' : 'video/webm' });
    resultat.sansSon = sansSon;
    return resultat;
  }

  // Secours : ce navigateur ne sait pas décoder l'image (ex. HEVC sur certains ordinateurs) —
  // les images sont recopiées telles quelles dans un MP4 (aucune perte, aucun calcul), le son
  // aussi s'il est en AAC/Opus. Le fichier reste lourd : il doit tenir dans la limite d'envoi.
  async function recopier(MB, entree, piste, fin, progression) {
    if (['avc', 'hevc', 'vp9', 'av1'].indexOf(piste.codec) === -1) throw new Error('format d’image « ' + piste.codec + ' » non pris en charge');
    var sortie = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
    var pisteSon = Z.son ? await entree.getPrimaryAudioTrack() : null;
    var gardeSon = !!(pisteSon && ['aac', 'opus'].indexOf(pisteSon.codec) !== -1);
    var conversion = await MB.Conversion.init({
      input: entree, output: sortie, tracks: 'primary',
      video: {}, audio: gardeSon ? {} : { discard: true },
      trim: (await entree.computeDuration()) > fin + 0.5 ? { start: 0, end: fin } : undefined
    });
    if (!conversion.isValid) throw new Error('recopie impossible : ' + conversion.discardedTracks.map(function (d) { return d.reason; }).join(', '));
    conversion.onProgress = function (p) { progression(Math.min(1, p)); };
    await conversion.execute();
    var octets = sortie.target.buffer;
    if (!octets || !octets.byteLength) return null;
    var resultat = new File([octets], Z.cle + '.mp4', { type: 'video/mp4' });
    resultat.sansSon = !!pisteSon && !gardeSon;
    resultat.tel = true;
    return resultat;
  }

  async function compresser(fichier, progression) {
    try {
      var propre = await compresserMediabunny(fichier, progression);
      if (propre) return propre;
    } catch (e) {
      if (/verticale/.test((e && e.message) || '')) throw e;
      signaler('compression impossible', (e && e.message) || String(e));
      if (Z.son) throw new Error('Ce navigateur n’arrive pas à préparer cette vidéo (' + ((e && e.message) || 'erreur inconnue') + '). Essayez avec Chrome sur un ordinateur.');
    }
    // Secours sans son : inutilisable pour la vidéo de l'accueil (l'original sera envoyé
    // s'il est assez léger).
    return Z.son ? null : compresserCanvas(fichier, progression);
  }

  // Secours : la vidéo est lue, redessinée en plus petit dans un canvas, et réenregistrée.
  async function compresserCanvas(fichier, progression) {
    var types = ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    var mime = window.MediaRecorder ? types.find(function (t) { return MediaRecorder.isTypeSupported(t); }) : null;
    if (!mime) return null;
    var url = URL.createObjectURL(fichier), v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.src = url;
    await new Promise(function (ok, ko) { v.onloadedmetadata = ok; v.onerror = function () { ko(new Error('Cette vidéo ne peut pas être lue par ce navigateur.')); }; });
    var w = Math.round(v.videoWidth * Math.min(1, LARGEUR_MAX / cote(v.videoWidth, v.videoHeight))); w -= w % 2;
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
    return new File([new Blob(morceaux, { type: type })], Z.cle + '.' + (type === 'video/mp4' ? 'mp4' : 'webm'), { type: type });
  }

  async function enregistrer(valeur) {
    var r = await sb.from('reglages_site').upsert({ cle: Z.cle, valeur: valeur, maj: new Date().toISOString() });
    if (r.error) throw new Error(/reglages_site|relation|schema cache/i.test(r.error.message || '') ? 'Il manque un réglage dans la base : exécutez l’extension 113 dans Supabase.' : r.error.message);
    try { sessionStorage.removeItem(Z.cache); } catch (e) {}
  }

  $('fichier').addEventListener('change', async function () {
    fichierChoisi = this.files && this.files[0]; infosChoisies = null;
    $('publier-btn').disabled = true; $('infos').textContent = ''; message('');
    if (!fichierChoisi) return;
    try {
      infosChoisies = await lireInfos(fichierChoisi);
      // Vidéos horizontales seulement (décision du 05/10/2026) : la couverture est une bande
      // large qui va d'un bord à l'autre de l'écran ; une vidéo verticale ou carrée y serait
      // coupée en haut et en bas au point de ne plus rien montrer d'utile.
      // (vidéo de l'accueil : verticale acceptée, la taille se mesure alors sur le plus grand côté)
      if (!Z.tousFormats && infosChoisies.largeur && infosChoisies.hauteur && infosChoisies.largeur / infosChoisies.hauteur < 1.25) {
        message('Cette vidéo est ' + (infosChoisies.hauteur > infosChoisies.largeur ? 'verticale' : 'presque carrée') + ' (' + infosChoisies.largeur + ' × ' + infosChoisies.hauteur + '). ' + Z.nomZone.charAt(0).toUpperCase() + Z.nomZone.slice(1) + ' n’accepte que les vidéos horizontales : filmez en tenant le téléphone couché (en paysage), puis choisissez cette nouvelle vidéo. (Les vidéos verticales vont dans « Vidéo de la page d’accueil ».)', true);
        $('fichier').value = ''; fichierChoisi = null; infosChoisies = null;
        return;
      }
      // Petites vidéos : acceptées partout, avec un simple conseil (06/10/2026 — demande de la
      // propriétaire : toutes les vidéos doivent passer).
      afficherInfos(); $('publier-btn').disabled = false;
      if (infosChoisies.largeur && cote(infosChoisies.largeur, infosChoisies.hauteur) < LARGEUR_MIN) {
        message('Attention : cette vidéo est petite (' + infosChoisies.largeur + ' × ' + infosChoisies.hauteur + '), elle risque d’être un peu floue en grand. Si vous avez la version d’origine filmée en HD, préférez-la.');
      }
    }
    catch (e) { message(e.message, true); }
  });

  $('publier-btn').addEventListener('click', async function () {
    if (!fichierChoisi || !infosChoisies) return;
    var bouton = this; bouton.disabled = true; $('animation-btn').disabled = true;
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
        if (!originalOk || fichierChoisi.size > (Z.son ? LIMITE_FINALE_ZONE : LIMITE_SANS_COMPRESSION)) { signaler('aucune compression possible', ''); throw new Error('La compression n’est pas possible sur ce navigateur. Essayez avec Chrome sur un ordinateur.'); }
      } else if (!(originalOk && fichierChoisi.size <= compressee.size)) envoi = compressee;
      if (envoi.size > LIMITE_FINALE_ZONE) {
        signaler('trop lourde après préparation', mo(envoi.size) + (compressee && compressee.tel ? ' (recopiée sans compression)' : ''));
        throw new Error(compressee && compressee.tel
          ? 'Ce navigateur ne sait pas compresser ce format de vidéo, et elle est trop lourde pour partir telle quelle (' + mo(envoi.size) + '). Ouvrez le tableau de bord dans Chrome sur un ordinateur récent et réessayez : la compression y fonctionne.'
          : 'Même compressée, la vidéo fait ' + mo(envoi.size) + ' (maximum ' + mo(LIMITE_FINALE_ZONE) + ').');
      }
      await envoyerFichier(envoi);
      if (envoi.sansSon) message(Z.succes + ' Remarque : ce navigateur n’a pas pu garder le son de cette vidéo. Pour l’avoir avec le son, renvoyez-la depuis Chrome sur un ordinateur.');
    } catch (e) {
      message(e.message || 'L’envoi a échoué — réessayez.', true);
      bouton.disabled = false;
    } finally {
      barre(null); $('animation-btn').disabled = false;
    }
  });

  async function envoyerFichier(envoi) {
      barre(0); message('Envoi de la vidéo (' + mo(envoi.size) + ')… gardez cette page ouverte.');
      var ext = envoi.type === 'video/webm' ? 'webm' : 'mp4';
      var chemin = 'site/' + Z.categorie + '/' + Date.now() + '.' + ext;
      await envoyerImageSite(Z.categorie, chemin, envoi, function (p) {
        barre(p); message('Envoi de la vidéo (' + mo(envoi.size) + ')… ' + Math.round(p * 100) + ' % — gardez cette page ouverte.');
      });
      var ancien = reglage && reglage.type === 'video' ? reglage.chemin : null;
      // Format de l'image gardé avec le réglage : le site prépare la bonne forme (verticale ou
      // horizontale) avant même que la vidéo ne se charge.
      var dims = null; try { dims = await lireInfos(envoi); } catch (e) {}
      var valeur = { type: 'video', chemin: chemin, taille: envoi.size, maj: new Date().toISOString() };
      if (dims && dims.largeur && dims.hauteur) { valeur.largeur = dims.largeur; valeur.hauteur = dims.hauteur; }
      await enregistrer(valeur);
      if (ancien && ancien !== chemin) supprimerImageSite(Z.categorie, ancien);
      message(Z.succes);
      $('fichier').value = ''; fichierChoisi = null; $('infos').textContent = '';
      await chargerReglage();
  }

  // Original envoyable sans recompression : MP4 en H.264 (lisible sur tous les téléphones),
  // 30 s au plus, horizontal, 1920 pixels de large au plus et 12 Mo au plus.
  async function originalSansPerte(f, inf) {
    if (f.type !== 'video/mp4' || f.size > ORIGINAL_MAX || inf.duree > DUREE_MAX + 0.5 || cote(inf.largeur, inf.hauteur) > ORIGINAL_LARGEUR_MAX) return false;
    // longue vidéo : envoyée telle quelle seulement si elle est déjà légère (4 Mbit/s au plus)
    if (Z.son && isFinite(inf.duree) && inf.duree > 0 && f.size * 8 / inf.duree > 4000000) return false;
    try {
      var MB = await chargerMediabunny();
      var entree = new MB.Input({ source: new MB.BlobSource(f), formats: MB.ALL_FORMATS });
      var piste = await entree.getPrimaryVideoTrack();
      return !!piste && piste.codec === 'avc';
    } catch (e) { return false; }
  }

  $('animation-btn').addEventListener('click', async function () {
    if (!reglage || reglage.type !== 'video') { message(Z.dejaSans); return; }
    if (!confirm(Z.retirerQuestion)) return;
    var bouton = this; bouton.disabled = true;
    try {
      var ancien = reglage.chemin;
      await enregistrer({ type: Z.son ? 'aucune' : 'animation', maj: new Date().toISOString() });
      if (ancien) supprimerImageSite(Z.categorie, ancien);
      message(Z.retirerFait);
      await chargerReglage();
    } catch (e) { message(e.message, true); }
    finally { bouton.disabled = false; }
  });

  chargerReglage();
  }
})();
