// Accueil en magazine (index.html et en/index.html, « Magazine 3 » choisi par la propriétaire
// le 20/10/2026 ; mise en page : css/magazine-accueil.css).
// Ce script ne charge aucune donnée (c'est le rôle de js/accueil.js et js/agenda.js) : il
// numérote les pages visibles, tient le sommaire à jour et écrit le mois du numéro. Certaines
// pages n'apparaissent que si le tableau de bord les a remplies (mot du fondateur, agenda,
// partenaires, Instagram) : la numérotation est refaite dès qu'une page apparaît ou disparaît.
(function () {
  var magazine = document.getElementById('magazine');
  if (!magazine) return;
  var anglais = (document.documentElement.lang || '').indexOf('en') === 0;
  var pages = Array.prototype.slice.call(magazine.querySelectorAll('.mag-page'));

  // Mois du numéro (« Octobre 2026 » / « October 2026 »)
  var mois = new Date().toLocaleDateString(anglais ? 'en-GB' : 'fr-FR', { month: 'long', year: 'numeric' });
  mois = mois.charAt(0).toUpperCase() + mois.slice(1);
  magazine.querySelectorAll('[data-mois]').forEach(function (el) { el.textContent = mois; });

  function visible(page) { return !page.hidden && getComputedStyle(page).display !== 'none'; }

  function numeroter() {
    var numeros = {}, n = 0;
    pages.forEach(function (page) {
      if (!visible(page)) return;
      n += 1;
      numeros[page.id] = n;
      var folio = page.querySelector('[data-folio]');
      if (folio) folio.textContent = (n < 10 ? '0' : '') + n;
    });
    magazine.querySelectorAll('[data-sommaire]').forEach(function (li) {
      var num = numeros[li.dataset.sommaire];
      li.hidden = !num;
      if (num) li.querySelector('b').textContent = (num < 10 ? '0' : '') + num;
    });
  }

  // Mot de Maître Akesse trop long pour sa page : « Lire la suite » l'ouvre en entier
  var mot = document.getElementById('mot-responsable');
  var suite = mot && mot.querySelector('.mag-mot-suite');
  function verifierSuite() {
    if (!suite || mot.classList.contains('deplie') || !visible(mot)) return;
    var texte = mot.querySelector('.mag-texte');
    suite.hidden = texte.scrollHeight <= texte.clientHeight + 2;
  }
  if (suite) {
    suite.addEventListener('click', function () {
      mot.classList.add('deplie'); suite.hidden = true; suite.setAttribute('aria-expanded', 'true');
    });
    // le texte change de taille quand la page apparaît, quand le message arrive ou quand l'écran tourne
    if (window.ResizeObserver) new ResizeObserver(verifierSuite).observe(mot.querySelector('.mag-texte'));
    window.addEventListener('resize', verifierSuite);
  }

  numeroter();
  // une page remplie plus tard (style, classe ou attribut hidden changé) : on renumérote
  var attente = null;
  var observateur = new MutationObserver(function () {
    if (attente) return;
    attente = requestAnimationFrame(function () { attente = null; numeroter(); });
  });
  pages.forEach(function (page) { observateur.observe(page, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] }); });
})();
