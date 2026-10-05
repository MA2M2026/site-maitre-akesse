// Adresses lisibles des fiches mannequins (06/10/2026) : …/book/roxane-ouattara
// (et …/en/book/roxane-ouattara) au lieu de …/mannequin?id=077ac8a8-….
// middleware.js sert mannequin.html à l'adresse /book/… sans la changer ; la page a
// donc un <base href="/"> (ou "/en/") pour que ses fichiers (css/, js/, assets/) se
// chargent depuis n'importe quelle adresse. Fichier partagé par mannequin.html et
// en/mannequin.html. Les anciennes adresses ?id=… restent valables : la barre
// d'adresse affiche ensuite la jolie adresse, prête à être copiée et partagée.
(function () {
  var CHEMIN_JOLI = /^\/(?:en\/)?book\/([a-z0-9-]{1,80})\/?$/;

  // Avec <base href="/">, un lien « #fiche-book » viserait la page d'accueil :
  // on garde le défilement vers la section de CETTE page.
  document.addEventListener('click', function (e) {
    var lien = e.target.closest && e.target.closest('a[href^="#"]');
    if (!lien) return;
    var cible = lien.getAttribute('href').slice(1);
    var element = cible ? document.getElementById(cible) : null;
    if (!element) return;
    e.preventDefault();
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { history.replaceState(history.state, '', location.pathname + location.search + '#' + cible); } catch (err) {}
  });

  // Identifiant du mannequin à afficher : ?id=… ou nom d'adresse /book/….
  window.ma2mIdFiche = async function () {
    var id = new URLSearchParams(location.search).get('id');
    if (id) return id;
    var m = location.pathname.match(CHEMIN_JOLI);
    if (!m || typeof sb === 'undefined' || !sb) return null;
    try {
      var r = await sb.from('model_profiles').select('id').eq('slug', m[1]).eq('published', true).maybeSingle();
      return r && r.data ? r.data.id : null;
    } catch (err) { return null; }
  };

  // Nom d'adresse du mannequin (null si la base ne le connaît pas encore) ; met la
  // jolie adresse dans la barre du navigateur.
  window.ma2mAdresseFiche = async function (id, anglais) {
    try {
      var r = await sb.from('model_profiles').select('slug').eq('id', id).maybeSingle();
      var slug = r && r.data ? r.data.slug : null;
      if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
      var chemin = (anglais ? '/en' : '') + '/book/' + slug;
      if (location.pathname !== chemin) history.replaceState(history.state, '', chemin + location.hash);
      return slug;
    } catch (err) { return null; }
  };
})();
