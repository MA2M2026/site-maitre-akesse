// Conversion des photos HEIC (iPhone) en JPEG — partagée par tout le site (chargée juste avant
// js/app.js) et par l'Administration (justificatifs de la comptabilité). Sortie de js/app.js le
// 19/10/2026 pour ne pas la recopier.
// ================== Conversion des photos HEIC (iPhone) en JPEG ==================
// Remplace la bibliothèque heic2any (retirée le 28 septembre 2026) : elle utilise
// « new Function » (évaluation de code), interdit par nos règles de sécurité (CSP,
// pas de 'unsafe-eval') — d'où une erreur « EvalError » à CHAQUE chargement des pages
// d'envoi de photos (l'essentiel du journal d'erreurs ce jour-là), sans jamais
// réussir à convertir quoi que ce soit, en plus de peser 1,3 Mo par page.
// Même signature que heic2any({ blob, toType, quality }) pour ne rien changer aux
// pages qui l'appellent. La conversion est faite par le navigateur lui-même : ça
// marche là où il sait lire le HEIC (Safari sur iPhone/Mac, d'où viennent ces
// photos — et l'iPhone convertit d'ailleurs souvent tout seul en JPEG à l'envoi).
// Ailleurs la promesse échoue : les pages gardent alors leur comportement habituel
// (envoi du fichier d'origine), et la surveillance le signale.
if (typeof window.heic2any === 'undefined') {
  window.heic2any = async function (options) {
    const url = URL.createObjectURL(options.blob);
    try {
      const img = await new Promise(function (ok, ko) {
        const i = new Image();
        i.onload = function () { ok(i); };
        i.onerror = function () { ko(new Error('Photo HEIC illisible par ce navigateur')); };
        i.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      return await new Promise(function (ok, ko) {
        canvas.toBlob(function (b) { b ? ok(b) : ko(new Error('Conversion JPEG impossible')); }, options.toType || 'image/jpeg', options.quality || 0.85);
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  };
}

// Conversion d'une photo HEIC (iPhone) en JPEG avant envoi — fonction unique pour
// tout le site (06/10/2026 : elle était recopiée dans 14 pages et scripts, ce qui
// obligeait à corriger 14 fois le moindre problème). En cas d'échec, le fichier
// d'origine est renvoyé tel quel (comportement inchangé).
async function convertirSiHeic(fichier, qualite) {
  const estHeic = /image\/hei(c|f)/i.test(fichier.type) || /\.(heic|heif)$/i.test(fichier.name);
  if (!estHeic || typeof heic2any === 'undefined') return fichier;
  try {
    const resultat = await heic2any({ blob: fichier, toType: 'image/jpeg', quality: qualite || 0.85 });
    const blobFinal = Array.isArray(resultat) ? resultat[0] : resultat;
    return new File([blobFinal], fichier.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
  } catch (e) {
    console.error('Conversion HEIC échouée, envoi du fichier original :', e);
    return fichier;
  }
}
