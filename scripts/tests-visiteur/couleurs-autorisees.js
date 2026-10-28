// Gardien des couleurs (promis à la propriétaire le 27/10/2026, écrit le 28/10/2026) : le site et les deux
// applications n'ont que des fonds ROUGES (rouge mat #7C2128, rouge profond #5A141B et leurs nuances et
// transparences) ou BLANCS (blanc, gris très clair). Plus de beige, plus de noir, plus de rouge vif.
// Exécutée DANS la page : renvoie la liste des fonds interdits visibles.
// Ne comptent pas : photos et vidéos (et ce qui est posé dessus pour attendre leur chargement), couleurs
// d'état (vert, orange, bleu des pastilles « payé », « en attente »…), bouton WhatsApp et logos des
// réseaux (couleurs de marque), parts des graphiques.
function fondsInterdits() {
  const rvba = (c) => { const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
  const toutes = (txt) => (txt.match(/rgba?\([^)]+\)/g) || []).map(rvba);
  // autorisé : blanc ou gris très clair neutre ; rouge (rouge nettement dominant, de sombre à moyen) ;
  // presque transparent (moins de 15 % d'opacité : simple ombre ou survol)
  const permis = ([r, g, b, a]) => {
    if (a < 0.15) return true;
    if (r >= 220 && g >= 220 && b >= 220 && Math.max(r, g, b) - Math.min(r, g, b) <= 6) return true;   // blanc / gris très clair (filets)
    if (r >= 40 && r <= 140 && g <= 45 && b <= 55 && r - g >= 30) return true;                            // rouges mats et profonds
    if (r >= 160 && r - g >= 40 && r - b >= 30 && r < 200) return true;                                     // roses et rouges clairs des graphiques
    if (r >= 230 && g >= 200 && b >= 205 && r - g >= 10 && r - g <= 40 && Math.abs(g - b) <= 12) return true; // rose pâle (pastilles, sélection)
    return false;
  };
  const exclu = (e) => e.closest('img, video, picture, canvas, svg, iframe, .whatsapp-flottant, .reseaux, .footer-reseaux, .site-footer-reseaux, [class*="pastille"], [class*="statut"], [class*="etat"], .donut, .legende-donut, .ql-editor, [data-couleur-libre]');
  const etat = ([r, g, b]) => (g > r + 15 && g > b) || (r > 200 && g > 150 && r - b > 30) || (b > r + 12 && b > g);   // vert, orange/jaune d'état, bleu d'information
  const visible = (e) => { const q = e.getBoundingClientRect(); const s = getComputedStyle(e); return q.width > 6 && q.height > 6 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const mauvais = [];
  for (const e of document.querySelectorAll('body, body *')) {
    if (!visible(e) || exclu(e)) continue;
    const s = getComputedStyle(e);
    const couleurs = [rvba(s.backgroundColor), ...(s.backgroundImage.includes('url(') ? [] : toutes(s.backgroundImage))].filter(Boolean);
    const faute = couleurs.find((c) => !permis(c) && !etat(c));
    if (faute) {
      const nom = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 3).map((c) => '.' + c).join('');
      mauvais.push({ element: nom, couleur: 'rgba(' + faute.join(', ') + ')' });
    }
  }
  return mauvais;
}
module.exports = { fondsInterdits };
