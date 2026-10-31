// Photos choisies avant l'envoi : UN SEUL mécanisme pour toute l'Administration (chantier 10, 31/10/2026 ;
// demande de la propriétaire : la même logique partout). On choisit en plusieurs fois (les choix
// s'ajoutent, un même fichier n'entre qu'une fois), on voit chaque photo, « ✕ » pour en retirer une, au
// plus `max` ; rien n'est envoyé avant le bouton de la page. Utilisé par : actualités et événements
// (js/admin/site-contenu.js), photos du Book d'une mannequin (js/admin/site-mannequins.js).
//   const panier = P.photosChoisies('cle', { max: 30, quandChange: () => {…} });
//   panier.champ('📷 Choisir les photos') → bouton de choix ; panier.montrer('id-zone') → vignettes + « ✕ » ;
//   panier.fichiers, panier.apercus (adresses locales des vignettes), panier.remplacer(liste), panier.vider().
(function () {
  'use strict';
  const P = window.Portail;
  if (!P) return;
  const paniers = {};
  const empreinte = (f) => f.name + '|' + f.size + '|' + f.lastModified;
  P.photosChoisies = function (cle, options) {
    const o = { max: 30, quandChange: () => {}, ...options };
    if (paniers[cle]) paniers[cle].apercus.forEach((u) => URL.revokeObjectURL(u));  // l'ancien panier (page quittée) libère la mémoire
    const panier = paniers[cle] = {
      fichiers: [], apercus: [], zone: null, max: o.max,
      champ(libelle, classe) {
        return '<label class="' + (classe || 'btn') + '"><input type="file" accept="image/*,.heic,.heif" multiple data-change="photos-choisies-ajouter" data-panier="' + P.esc(cle) + '" hidden>' +
          '<span class="photos-choisies-libelle">' + libelle + '</span></label>';
      },
      ajouter(liste) {
        const deja = new Set(this.fichiers.map(empreinte));
        const nouveaux = Array.from(liste || []).filter((f) => !deja.has(empreinte(f)) && deja.add(empreinte(f)));
        const place = Math.max(this.max - this.fichiers.length, 0);
        if (nouveaux.length > place) P.message('Au plus ' + this.max + ' photos à la fois : ' + P.pluriel(place, 'photo ajoutée', 'photos ajoutées') + '.');
        this.fichiers = this.fichiers.concat(nouveaux.slice(0, place));
      },
      remplacer(liste) { this.fichiers = (Array.isArray(liste) ? liste : []).slice(0, this.max); },
      vider() { this.fichiers = []; this.montrer(); },
      // vignettes (chacune avec « ✕ ») et le compte, dans la zone d'identifiant donné
      montrer(idZone) {
        if (idZone) this.zone = idZone;
        this.apercus.forEach((u) => URL.revokeObjectURL(u));  // les aperçus précédents libèrent la mémoire
        this.apercus = this.fichiers.map((f) => URL.createObjectURL(f));
        const z = this.zone && document.getElementById(this.zone);
        if (!z) return;
        z.innerHTML = this.apercus.map((u, i) => '<span class="pub-photo-choisie"><img src="' + u + '" alt="">' +
          '<button type="button" class="btn-mini-admin" data-action="photos-choisies-retirer" data-panier="' + P.esc(cle) + '" data-i="' + i + '" aria-label="Retirer cette photo">✕</button></span>').join('') +
          (this.apercus.length ? '<p class="doux petit-texte">' + P.pluriel(this.apercus.length, 'photo choisie', 'photos choisies') + ' (au plus ' + this.max + ') : vous pouvez en ajouter d’autres.</p>' : '');
      }
    };
    panier.quandChange = o.quandChange;
    return panier;
  };
  P.changements['photos-choisies-ajouter'] = (el) => {
    const panier = paniers[el.dataset.panier];
    if (!panier) return;
    panier.ajouter(el.files);
    el.value = '';  // le même choix peut être refait
    panier.montrer();
    panier.quandChange();
  };
  P.actions['photos-choisies-retirer'] = (el) => {
    const panier = paniers[el.dataset.panier];
    if (!panier) return;
    panier.fichiers.splice(Number(el.dataset.i), 1);
    panier.montrer();
    panier.quandChange();
  };
})();
