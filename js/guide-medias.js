// Présentation commune des sélecteurs de médias. Les champs et leurs écouteurs sont conservés.
(function () {
  const formulaire = document.querySelector('#form-casting, #form-talons');
  if (!formulaire) return;
  const talons = formulaire.id === 'form-talons';
  const prefixe = talons ? 'ct' : 'ca';
  const anglais = document.documentElement.lang === 'en';
  const T = (fr, en) => anglais ? en : fr;
  const dossier = '/assets/cours-talons/';

  function creerGuide(exemples) {
    const liste = document.createElement('ul');
    liste.className = 'ma2m-guide-medias';
    liste.setAttribute('aria-label', T('Exemples de cadrage', 'Framing examples'));
    exemples.forEach(({ photo, texte, cadrage }) => {
      const element = document.createElement('li');
      const image = document.createElement('img');
      image.src = dossier + photo;
      image.alt = '';
      image.width = 160;
      image.height = 130;
      image.loading = 'lazy';
      image.className = cadrage;
      const cadre = document.createElement('span');
      cadre.className = 'ma2m-guide-cadre';
      cadre.appendChild(image);
      const legende = document.createElement('span');
      legende.className = 'ma2m-guide-legende';
      legende.textContent = texte;
      element.append(cadre, legende);
      liste.appendChild(element);
    });
    return liste;
  }

  function preparer(id, libelle, exemples) {
    const champ = document.getElementById(prefixe + '-' + id);
    if (!champ) return;
    const panneau = document.createElement('div');
    panneau.className = 'ma2m-panneau-medias';
    const zone = document.createElement('div');
    zone.className = 'ma2m-choisir-fichier';
    const texte = document.createElement('span');
    texte.textContent = libelle;
    texte.setAttribute('aria-hidden', 'true');
    champ.before(panneau);
    panneau.append(creerGuide(exemples), zone);
    zone.append(texte, champ);
    if (id === 'photos') ajouterCases(champ, panneau);
  }

  function ajouterCases(champ, panneau) {
    const apercu = document.getElementById(champ.id + '-apercu');
    if (!apercu) return;
    const grille = document.createElement('div');
    grille.className = 'ma2m-cases-photos';
    const noms = [T('Portrait', 'Portrait'), T('Plein pied', 'Full length'), T('Profil', 'Profile'),
      T('Autre photo', 'Another photo'), T('Dernière photo', 'Last photo')];
    const cases = noms.map((nom, index) => {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'ma2m-case-photo';
      bouton.dataset.boutonLibre = '';
      bouton.textContent = '+  ' + nom;
      bouton.addEventListener('click', () => {
        const photo = apercu.querySelectorAll('img')[index];
        if (photo) { apercu.scrollIntoView({ block: 'center' }); return; }
        champ.click();
      });
      grille.appendChild(bouton);
      return bouton;
    });
    panneau.after(grille);
    function actualiser() {
      const photos = apercu.querySelectorAll('img');
      cases.forEach((bouton, index) => {
        const photo = photos[index];
        bouton.replaceChildren();
        if (photo) {
          const miniature = photo.cloneNode();
          miniature.removeAttribute('class');
          miniature.alt = '';
          bouton.appendChild(miniature);
        }
        const libelle = document.createElement('span');
        libelle.textContent = (photo ? '✓  ' : '+  ') + noms[index];
        bouton.appendChild(libelle);
      });
    }
    new MutationObserver(actualiser).observe(apercu, { childList: true });
  }

  preparer('photos', T('Ajouter mes photos', 'Add my photos'), [
    { photo: 'galerie-tailleur.jpg', texte: T('Visage', 'Face'), cadrage: 'ma2m-guide-visage' },
    { photo: 'galerie-blanc.jpg', texte: T('De la tête aux pieds', 'Head to toe'), cadrage: 'ma2m-guide-silhouette' }
  ]);
  preparer('video', T('Ajouter ma vidéo', 'Add my video'), [
    { photo: talons ? 'mannequin-defile.jpg' : 'galerie-tailleur.jpg', texte: talons ? T('Montrez votre marche', 'Show your walk') : T('Parlez face à la caméra', 'Speak to the camera'), cadrage: 'ma2m-guide-silhouette' }
  ]);
})();
