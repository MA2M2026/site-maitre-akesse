// Vidéo de candidature ALLÉGÉE par l'appareil du candidat, avant l'envoi (demande de
// la propriétaire, 30/09/2026) : une vidéo filmée en 4K / 60 images par seconde est
// ramenée en qualité normale (720p, 30 images/s), environ 10 fois plus légère, pour
// que l'envoi soit rapide même avec une connexion mobile faible.
//
// Tout se fait dans le navigateur du candidat (outil « Mediabunny », copié dans
// js/vendor/ et chargé seulement quand une vidéo est choisie). Aucun envoi vers un
// autre service. Si l'appareil ne sait pas faire (vieux téléphone), on renvoie null
// et le site envoie la vidéo d'origine, comme avant.
(function () {
  const OUTIL = 'js/vendor/mediabunny-1.61.0.min.js';
  const COTE_LONG = 1280;          // 720p
  const DEBIT_VIDEO = 1800000;     // ~1,8 Mbit/s → environ 14 Mo pour 1 minute
  const IMAGES_SECONDE = 30;
  const DEJA_LEGERE = 12 * 1024 * 1024; // en dessous : inutile d'alléger

  let chargement = null;
  function chargerOutil() {
    if (window.Mediabunny) return Promise.resolve(window.Mediabunny);
    if (chargement) return chargement;
    const racine = /\/en\//.test(location.pathname) ? '../' : '';
    chargement = new Promise((ok, echec) => {
      const s = document.createElement('script');
      s.src = racine + OUTIL;
      s.onload = () => window.Mediabunny ? ok(window.Mediabunny) : echec(new Error('outil vidéo absent'));
      s.onerror = () => { chargement = null; echec(new Error('outil vidéo non chargé')); };
      document.head.appendChild(s);
    });
    return chargement;
  }

  function pair(n) { return Math.max(2, Math.round(n / 2) * 2); }

  // Petite image de la vidéo (vers la 1re seconde) pour l'aperçu, en adresse « blob: »
  // d'image (autorisée par la sécurité du site, contrairement aux vidéos « blob: »).
  async function imageApercu(MB, piste, duree) {
    try {
      const sink = new MB.CanvasSink(piste, { width: 360, fit: 'contain' });
      const t = Math.min(1, Math.max(0, (duree || 0) / 2));
      const c = await sink.getCanvas(t);
      if (!c) return null;
      const canvas = c.canvas;
      const blob = canvas.convertToBlob
        ? await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
        : await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.8));
      return blob ? URL.createObjectURL(blob) : null;
    } catch (e) { return null; }
  }

  // Lit la vidéo : durée + image d'aperçu. { duree, apercu } (valeurs null si illisible).
  async function examinerVideo(fichier) {
    try {
      if (typeof VideoDecoder === 'undefined') return { duree: null, apercu: null };
      const MB = await chargerOutil();
      const entree = new MB.Input({ source: new MB.BlobSource(fichier), formats: MB.ALL_FORMATS });
      const duree = await entree.computeDuration();
      const piste = await entree.getPrimaryVideoTrack();
      const apercu = piste && await piste.canDecode() ? await imageApercu(MB, piste, duree) : null;
      return { duree: isFinite(duree) ? duree : null, apercu };
    } catch (e) { return { duree: null, apercu: null }; }
  }

  // Renvoie un nouveau fichier allégé, ou null si l'allègement est inutile ou
  // impossible sur cet appareil. surProgres(0..100) pendant la préparation.
  async function allegerVideo(fichier, surProgres) {
    if (!fichier || fichier.size <= DEJA_LEGERE) return null;
    if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return null;
    const MB = await chargerOutil();
    const entree = new MB.Input({ source: new MB.BlobSource(fichier), formats: MB.ALL_FORMATS });
    const piste = await entree.getPrimaryVideoTrack();
    if (!piste || !(await piste.canDecode())) return null;

    let l = piste.displayWidth, h = piste.displayHeight;
    const echelle = Math.min(1, COTE_LONG / Math.max(l, h));
    l = pair(l * echelle); h = pair(h * echelle);

    // H.264 dans un MP4 (lisible partout, y compris dans Google Drive) ; sinon VP9.
    let codec = null;
    for (const c of ['avc', 'vp9', 'vp8']) {
      try { if (await MB.canEncodeVideo(c, { width: l, height: h, bitrate: DEBIT_VIDEO })) { codec = c; break; } } catch (e) {}
    }
    if (!codec) return null;
    const enMp4 = codec !== 'vp8';
    const sortie = new MB.Output({
      format: enMp4 ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(),
      target: new MB.BufferTarget()
    });
    const conversion = await MB.Conversion.init({
      input: entree, output: sortie, tracks: 'primary',
      video: { width: l, height: h, fit: 'contain', codec, bitrate: DEBIT_VIDEO, frameRate: IMAGES_SECONDE },
      audio: { numberOfChannels: 2 }
    });
    // Le son ne doit jamais disparaître : si la piste son est écartée, on n'allège pas.
    if (!conversion.isValid || conversion.discardedTracks.length) return null;
    if (surProgres) conversion.onProgress = (p) => surProgres(Math.min(99, Math.floor(p * 100)));
    await conversion.execute();
    const octets = sortie.target.buffer;
    if (!octets || octets.byteLength >= fichier.size) return null;
    const nom = (fichier.name || 'video').replace(/\.[^.]*$/, '') + (enMp4 ? '.mp4' : '.webm');
    if (surProgres) surProgres(100);
    return new File([octets], nom, { type: enMp4 ? 'video/mp4' : 'video/webm' });
  }

  window.examinerVideo = examinerVideo;
  window.allegerVideo = allegerVideo;
})();
