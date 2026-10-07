window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}

// ================== Cookies de mesure d'audience (validé le 29/09/2026) ==================
// Google Analytics dépose des cookies : il ne le fait désormais qu'avec l'accord du
// visiteur (bandeau en bas de page). Tant qu'il n'a pas accepté, Google ne reçoit que
// des signaux anonymes, sans cookie (« mode consentement »). Le choix est gardé dans
// ce navigateur (ma2m_cookies = oui / non) ; il se modifie depuis la page
// Confidentialité (bouton « Modifier mon choix »).
(function () {
  const CLE = 'ma2m_cookies';
  let choix = null;
  try { choix = localStorage.getItem(CLE); } catch (e) {}
  gtag('consent', 'default', {
    analytics_storage: choix === 'oui' ? 'granted' : 'denied',
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
  });

  function enregistrer(valeur) {
    try { localStorage.setItem(CLE, valeur); } catch (e) {}
    gtag('consent', 'update', { analytics_storage: valeur === 'oui' ? 'granted' : 'denied' });
  }

  function afficherBandeau() {
    if (document.getElementById('bandeau-cookies')) return;
    const anglais = (document.documentElement.lang || '').indexOf('en') === 0;
    const bandeau = document.createElement('div');
    bandeau.id = 'bandeau-cookies';
    bandeau.className = 'bandeau-cookies';
    bandeau.setAttribute('role', 'dialog');
    bandeau.setAttribute('aria-label', 'Cookies');
    bandeau.innerHTML = anglais
      ? '<p>We use audience measurement cookies (Google Analytics) to improve the site. No advertising. <a href="/en/politique-confidentialite.html#cookies">Learn more</a></p>' +
        '<div class="bandeau-cookies-boutons"><button type="button" class="btn" data-cookies="non">Decline</button><button type="button" class="btn btn--principal" data-cookies="oui">Accept</button></div>'
      : '<p>Nous utilisons des cookies de mesure d’audience (Google Analytics) pour améliorer le site. Aucune publicité. <a href="/politique-confidentialite.html#cookies">En savoir plus</a></p>' +
        '<div class="bandeau-cookies-boutons"><button type="button" class="btn" data-cookies="non">Refuser</button><button type="button" class="btn btn--principal" data-cookies="oui">Accepter</button></div>';
    bandeau.addEventListener('click', function (e) {
      const bouton = e.target.closest('[data-cookies]');
      if (!bouton) return;
      enregistrer(bouton.dataset.cookies);
      bandeau.remove();
    });
    document.body.appendChild(bandeau);
  }

  function demarrer() {
    if (choix !== 'oui' && choix !== 'non') afficherBandeau();
    // Page Confidentialité : bouton pour revenir sur son choix.
    document.querySelectorAll('[data-cookies-modifier]').forEach(function (b) {
      b.addEventListener('click', function () {
        try { localStorage.removeItem(CLE); } catch (e) {}
        choix = null;
        afficherBandeau();
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();

gtag('js', new Date());

gtag('config', 'G-1BX5MPZ6WE');
