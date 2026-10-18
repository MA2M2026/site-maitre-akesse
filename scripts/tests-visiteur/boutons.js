// Contrôle « un seul bouton pour tout le site » (décision de la propriétaire, 18/10/2026) : chaque
// bouton visible de la page doit être rouge MA2M, texte blanc, coins arrondis (css/bouton-ma2m.css).
// Compte aussi comme bouton un lien habillé en bouton (fond ou cadre, marge intérieure) : il doit
// être rouge lui aussi. Ne sont pas concernés : les liens dans le texte, les photos cliquables
// (.cliquable), le bouton WhatsApp flottant et les logos de réseaux (couleurs de marque).
// Utilisé par test-visuel.js (pages publiques) et test-portail.js (portail /admin).

// Exécutée DANS la page : renvoie la liste des boutons qui ne suivent pas le modèle.
function verifierBoutons() {
  const ROUGES = ['rgb(200, 16, 46)', 'rgb(165, 13, 38)'];
  const exclu = (e) => e.closest('.cliquable, .mpg-produit, .mpg-commande, .whatsapp-flottant, [data-bouton-libre], .reseaux, .footer-social, .site-footer-reseaux');
  const visible = (e) => {
    const q = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return q.width > 4 && q.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const transparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  const habille = (e) => {
    const s = getComputedStyle(e);
    const cadre = Number.parseFloat(s.borderTopWidth) > 0 && Number.parseFloat(s.borderBottomWidth) > 0 && Number.parseFloat(s.borderLeftWidth) > 0 && !transparent(s.borderTopColor);
    return (!transparent(s.backgroundColor) || cadre) && Number.parseFloat(s.paddingLeft) >= 6 && Number.parseFloat(s.paddingTop) >= 3;
  };
  const SEL = 'button, input[type=submit], input[type=button], input[type=reset], [role=button], .btn';
  const candidats = new Set([...document.querySelectorAll(SEL)]);
  // lien habillé en bouton (sauf une carte qui contient déjà son propre bouton, ou une image)
  for (const a of document.querySelectorAll('a[href]')) {
    const contientBouton = [...a.querySelectorAll('*')].some((x) => ROUGES.includes(getComputedStyle(x).backgroundColor));
    if (habille(a) && !contientBouton && !a.querySelector('img, video, svg:only-child')) candidats.add(a);
  }
  const mauvais = [];
  for (const e of candidats) {
    if (!visible(e) || exclu(e)) continue;
    const s = getComputedStyle(e);
    const rayon = Number.parseFloat(s.borderTopLeftRadius);
    const ok = ROUGES.includes(s.backgroundColor) && s.color === 'rgb(255, 255, 255)' && rayon >= 8;
    if (!ok) {
      const nom = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].map((c) => '.' + c).join('');
      mauvais.push({ element: nom, texte: (e.innerText || e.value || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30), fond: s.backgroundColor, couleur: s.color, rayon: s.borderTopLeftRadius });
    }
  }
  return mauvais;
}

module.exports = { verifierBoutons };
