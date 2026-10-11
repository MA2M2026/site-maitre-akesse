// Fonctions communes aux pages Actualités et Événements (FR et EN), partagées le 11/10/2026
// (avant, recopiées dans js/actualites.js et js/evenements.js).
let newsModalEstOuverte = false;

function extraitTexte(texte, longueur) {
  if (!texte) return '';
  if (texte.length <= longueur) return texte;
  // Coupe entre deux mots (et non au milieu d'un mot : « Cette nouvel… »).
  let coupe = texte.slice(0, longueur);
  const espace = coupe.lastIndexOf(' ');
  if (espace > longueur * 0.6) coupe = coupe.slice(0, espace);
  return coupe.replace(/[\s,;:.\-–—(]+$/, '') + '…';
}

function ouvrirNewsModal() {
  document.getElementById('news-modal').classList.add('active');
  if (!newsModalEstOuverte) { newsModalEstOuverte = true; window.verrouillerDefilement(); }
}

function fermerNewsModal() {
  document.getElementById('news-modal').classList.remove('active');
  if (window.ficheFermee) window.ficheFermee();
  if (newsModalEstOuverte) { newsModalEstOuverte = false; window.deverrouillerDefilement(); }
}

function fermerRedaction() {
  document.getElementById('redaction-overlay').classList.remove('active');
  window.deverrouillerDefilement();
}

function apercuImageCouverture(url) {
  const img = document.getElementById('red-apercu-img');
  img.src = url || '';
  img.classList.toggle('u-hidden', !url);
}
