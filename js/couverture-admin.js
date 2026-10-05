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
  // 1 Mbit/s — environ 3,7 Mo pour 30 secondes, image encore nette.
  var DEBIT = 1000000, LARGEUR_MAX = 1280;
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
    if (inf.hauteur > inf.largeur) txt += ' Attention : vidéo verticale — le haut et le bas seront coupés dans la couverture, une vidéo en paysage rendra mieux.';
    $('couv-infos').textContent = txt;
  }

  // Compression : la vidéo est lue, redessinée en plus petit dans un canvas, et réenregistrée.
  async function compresser(fichier, progression) {
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
    try { infosChoisies = await lireInfos(fichierChoisi); afficherInfos(); $('couv-publier-btn').disabled = false; }
    catch (e) { message(e.message, true); }
  });

  $('couv-publier-btn').addEventListener('click', async function () {
    if (!fichierChoisi || !infosChoisies) return;
    var bouton = this; bouton.disabled = true; $('couv-animation-btn').disabled = true;
    try {
      var envoi = fichierChoisi;
      message('Compression en cours… gardez cette page ouverte.');
      var compressee = await compresser(fichierChoisi, function (p) { barre(p); message('Compression en cours… ' + Math.round(p * 100) + ' % — gardez cette page ouverte.'); });
      var originalOk = originalUtilisable(fichierChoisi, infosChoisies);
      if (!compressee) {
        if (!originalOk || fichierChoisi.size > LIMITE_SANS_COMPRESSION) throw new Error('La compression n’est pas possible sur ce navigateur. Essayez avec Chrome (ordinateur ou téléphone Android).');
      } else if (!(originalOk && fichierChoisi.size <= compressee.size)) envoi = compressee;
      if (envoi.size > LIMITE_FINALE) throw new Error('Même compressée, la vidéo fait ' + mo(envoi.size) + ' (maximum ' + mo(LIMITE_FINALE) + '). Choisissez une vidéo plus courte.');
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
    } catch (e) {
      message(e.message || 'L’envoi a échoué — réessayez.', true);
      bouton.disabled = false;
    } finally {
      barre(null); $('couv-animation-btn').disabled = false;
    }
  });

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
