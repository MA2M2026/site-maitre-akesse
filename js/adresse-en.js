// Accueil anglais : l'hébergeur transforme « /en/index.html » en « /en » (sans barre
// finale). Depuis cette adresse, les liens de la page (« mannequins.html »…) menaient aux
// pages FRANÇAISES (constaté le 30/09). On remet la barre finale dans l'adresse, sans
// recharger la page : les liens retrouvent alors leurs pages anglaises.
(function () {
  if (location.pathname === '/en') {
    try { history.replaceState(history.state, '', '/en/' + location.search + location.hash); } catch (e) {}
  }
})();
