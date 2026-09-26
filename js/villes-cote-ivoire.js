// Villes de Côte d'Ivoire (chefs-lieux de région/département les plus connus) —
// Abidjan en tête car c'est de loin la ville la plus fréquente pour nos mannequins.
// Reprise à l'identique de la liste utilisée jusqu'ici séparément dans
// candidature.html et espace-mannequin-ancien.html (une seule copie désormais,
// réutilisée aussi par espace-mannequin.html).
const VILLES_CI = [
  'Abidjan', 'Abengourou', 'Aboisso', 'Adiaké', 'Adzopé', 'Affery', 'Agboville', 'Agnibilékrou',
  'Akoupé', 'Alépé', 'Anyama', 'Arrah', 'Attiégouakro', 'Bangolo', 'Bettié', 'Biankouma',
  'Bingerville', 'Bloléquin', 'Bocanda', 'Bondoukou', 'Bongouanou', 'Bouaflé', 'Bouaké', 'Bouna',
  'Boundiali', 'Dabakala', 'Dabou', 'Daloa', 'Danané', 'Daoukro', 'Dimbokro', 'Divo', 'Duékoué',
  'Facobly', 'Ferkessédougou', 'Fresco', 'Gagnoa', 'Grand-Bassam', 'Grand-Lahou', 'Guiglo',
  'Guitry', 'Issia', 'Jacqueville', 'Kani', 'Katiola', 'Kong', 'Korhogo', 'Kouibly', 'Lakota',
  'Man', 'Mankono', "M'Bahiakro", 'Minignan', 'Nassian', 'Odienné', 'Oumé', 'Ouangolodougou',
  'Ouragahio', 'Prikro', 'Sakassou', 'San-Pédro', 'Sassandra', 'Séguéla', 'Sikensi', 'Sinfra',
  'Soubré', 'Tabou', 'Tanda', 'Tengréla', 'Tiassalé', 'Tiébissou', 'Toulepleu', 'Toumodi',
  'Touba', 'Vavoua', 'Yamoussoukro', 'Zouan-Hounien', 'Zuénoula'
];

// Communes du Grand Abidjan — affichées dans une seconde liste déroulante qui
// n'apparaît que si "Abidjan" est choisi ci-dessus : les 10 communes historiques
// d'Abidjan-ville + les 3 communes rattachées les plus connues (Anyama et
// Bingerville existent déjà comme villes autonomes dans VILLES_CI ; ici on les
// retrouve aussi comme communes du Grand Abidjan, pour ceux qui partent d'"Abidjan"
// plutôt que de chercher directement leur commune dans la longue liste des villes).
const COMMUNES_ABIDJAN = [
  'Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Cocody', 'Koumassi', 'Marcory',
  'Plateau', 'Port-Bouët', 'Songon', 'Treichville', 'Yopougon'
];

// Branche la cascade "ville → commune (→ quartier)" sur les champs déjà présents
// dans la page : quand "Abidjan" est choisi dans le select ville, un second select
// commune apparaît (rempli avec COMMUNES_ABIDJAN + "Abidjan (sans précision)" +
// "Autre"), suivi d'un champ libre "Quartier" (aucune liste fixe de quartiers
// n'existe — texte libre, facultatif) ; sinon les deux restent masqués. La valeur
// finalement enregistrée comme "ville" est celle de la commune si elle est
// renseignée, sinon "Abidjan" seul, sinon la ville choisie normalement
// (comportement inchangé pour toutes les autres villes) ; le quartier est
// renvoyé séparément par valeurQuartier().
//
// idSelectVille : le <select> ville existant (déjà rempli par ailleurs avec VILLES_CI).
// idWrapperCommune : l'élément (div) à afficher/masquer contenant le select commune.
// idSelectCommune : le <select> commune à remplir.
// idAutreCommune : le champ texte "Précisez la commune" (affiché seulement si Autre).
// idWrapperQuartier (optionnel) : l'élément (div) du champ libre "Quartier",
// affiché/masqué en même temps que la commune (n'a de sens que pour Abidjan).
function brancherCascadeAbidjan(idSelectVille, idWrapperCommune, idSelectCommune, idAutreCommune, idWrapperQuartier) {
  const selectVille = document.getElementById(idSelectVille);
  const wrapper = document.getElementById(idWrapperCommune);
  const selectCommune = document.getElementById(idSelectCommune);
  const autreCommune = document.getElementById(idAutreCommune);
  const wrapperQuartier = idWrapperQuartier ? document.getElementById(idWrapperQuartier) : null;
  if (!selectVille || !wrapper || !selectCommune) return;

  if (!selectCommune.options.length) {
    selectCommune.appendChild(new Option('Abidjan (sans précision de commune)', 'Abidjan'));
    COMMUNES_ABIDJAN.forEach(c => selectCommune.appendChild(new Option(c, c)));
    selectCommune.appendChild(new Option('Autre', 'Autre'));
  }

  function actualiser() {
    const estAbidjan = selectVille.value === 'Abidjan';
    wrapper.style.display = estAbidjan ? 'block' : 'none';
    if (wrapperQuartier) wrapperQuartier.style.display = estAbidjan ? 'block' : 'none';
    if (!estAbidjan) {
      selectCommune.value = 'Abidjan';
      if (autreCommune) { autreCommune.style.display = 'none'; autreCommune.value = ''; }
    }
  }
  selectVille.addEventListener('change', actualiser);
  actualiser();

  if (autreCommune) {
    selectCommune.addEventListener('change', () => {
      autreCommune.style.display = selectCommune.value === 'Autre' ? 'block' : 'none';
      if (selectCommune.value !== 'Autre') autreCommune.value = '';
    });
  }
}

// Valeur finale de "ville" à enregistrer, une fois la cascade prise en compte :
// - une ville différente d'Abidjan : renvoyée telle quelle (comportement inchangé) ;
// - Abidjan + commune choisie : la commune (ex. "Cocody") ;
// - Abidjan + "Autre" + précision : la précision saisie ;
// - Abidjan sans commune précisée : "Abidjan".
function villeAvecCommune(valeurVille, idSelectCommune, idAutreCommune) {
  if (valeurVille !== 'Abidjan') return valeurVille;
  const selectCommune = document.getElementById(idSelectCommune);
  if (!selectCommune) return 'Abidjan';
  if (selectCommune.value === 'Autre') {
    const autre = document.getElementById(idAutreCommune);
    return (autre && autre.value.trim()) || 'Abidjan';
  }
  return selectCommune.value || 'Abidjan';
}

// Repositionne les champs ville/commune à partir d'une valeur déjà enregistrée en
// base (ex. "Cocody" doit rouvrir le select ville sur "Abidjan" ET le select
// commune sur "Cocody" — sinon la commune enregistrée serait invisible à la
// réouverture du formulaire). Pour toute autre ville, délègue à
// definirSelectOuAutre() (déjà présente sur chaque page consommatrice), qui gère
// la bascule vers "Autre" pour une ville hors liste.
function definirVilleAvecCommune(valeurEnregistree, idSelectVille, idAutreVille, idSelectCommune, idAutreCommune) {
  const selectVille = document.getElementById(idSelectVille);
  const selectCommune = document.getElementById(idSelectCommune);
  if (!selectVille) return;
  const valeur = valeurEnregistree || '';
  const estCommuneAbidjan = COMMUNES_ABIDJAN.includes(valeur);
  if (valeur === 'Abidjan' || estCommuneAbidjan) {
    selectVille.value = 'Abidjan';
    selectVille.dispatchEvent(new Event('change'));
    if (selectCommune) selectCommune.value = estCommuneAbidjan ? valeur : 'Abidjan';
    return;
  }
  definirSelectOuAutre(idSelectVille, idAutreVille, valeur);
}
