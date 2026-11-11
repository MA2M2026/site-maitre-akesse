// « Ajouter une image » à un message (11/11/2026, maquette validée par la propriétaire) : une affiche ou une
// photo choisie dans la galerie, envoyée tout de suite sur Cloudflare R2 (dossier « infos », comme les photos
// des Informations agence : envoyerImageSite, js/images-site-ecriture.js). Partagé par les Convocations
// (js/convocations-page.js) et les Messages groupés (js/messages-groupes.js).
//   ImageJointe.brancher(zone, { valeur, surChange }) : dessine la case dans « zone » et renvoie
//   { valeur() } ; surChange(url | null) est appelée à chaque choix ou retrait.
// Dans l'application des mannequins, l'image s'affiche en grand dans le message ; dans les e-mails et les
// WhatsApp, un lien « Voir l'affiche » est ajouté (avecAffiche, js/messages-convocations.js).
(function () {
  'use strict';
  const esc = (t) => echapperHtml(t);  // (js/app.js)
  function brancher(zone, options) {
    const o = options || {};
    let url = o.valeur || null, enCours = false, generation = 0;  // (generation : une image remplacée pendant un envoi l'emporte)
    const fichier = document.createElement('input');
    fichier.type = 'file'; fichier.accept = 'image/*,.heic,.heif'; fichier.hidden = true;
    fichier.setAttribute('aria-label', 'Choisir une image dans la galerie');
    const dessiner = (texte) => {
      zone.classList.add('ij');
      zone.innerHTML = (url
        ? '<div class="ij-choisie"><img src="' + esc(url) + '" alt="Image jointe"><div><b>Image jointe ✓</b><span class="ij-boutons">' +
          '<button type="button" class="btn petit" data-ij="changer">Changer</button><button type="button" class="btn petit" data-ij="retirer">Retirer</button></span></div></div>'
        : '<button type="button" class="ij-ajouter" data-ij="changer"' + (enCours ? ' disabled' : '') + '>' + (enCours ? 'Envoi de l’image…' : '＋ Ajouter une image depuis la galerie') + '</button>') +
        '<p class="ij-canaux">' + (texte ? esc(texte) : 'Elle part avec le message : en grand dans l’application ; un lien « Voir l’affiche » dans l’e-mail et le WhatsApp.') + '</p>';
      zone.appendChild(fichier);
    };
    zone.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ij]');
      if (!b || enCours) return;
      if (b.dataset.ij === 'retirer') { url = null; dessiner(); if (o.surChange) o.surChange(null); return; }
      fichier.click();
    });
    fichier.addEventListener('change', async () => {
      const f = fichier.files && fichier.files[0];
      fichier.value = '';
      if (!f) return;
      if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) { dessiner('Choisissez une image (photo ou affiche).'); return; }
      enCours = true; dessiner();
      const g = generation;
      try {
        const image = typeof convertirSiHeic === 'function' ? await convertirSiHeic(f) : f;  // (js/app.js)
        const ext = ((image.name || f.name).match(/\.([a-z0-9]{2,5})$/i) || ['', 'jpg'])[1].toLowerCase();
        const envoyee = await envoyerImageSite('infos', 'site/infos/' + crypto.randomUUID() + '.' + ext, image);  // (js/images-site-ecriture.js)
        enCours = false;
        if (g !== generation) { dessiner(); return; }  // (un autre projet a été ouvert pendant l'envoi : rien n'est changé)
        url = envoyee; dessiner();
        if (o.surChange) o.surChange(url);
      } catch (err) {
        enCours = false;
        dessiner('L’image n’a pas pu être envoyée : ' + ((err && err.message) || err) + '. Réessayez.');
      }
    });
    dessiner();
    return { valeur: () => url, remplacer: (v) => { generation += 1; url = v || null; dessiner(); } };
  }
  window.ImageJointe = { brancher };
})();
