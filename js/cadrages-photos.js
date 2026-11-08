// Cadrage automatique des grandes photos des fiches : FICHIER ÉCRIT PAR scripts/cadrage-visages.py (ne pas modifier
// à la main). Pour chaque photo (repère de son nom), la hauteur du cadrage (0 à 100 %) qui place le visage au-dessus
// du nom ; photo absente de la liste : cadrage d'avant (le haut). Lu par js/rendu-fiche.js (page et serveur).
(function (racine) {
  'use strict';
  const CADRAGES = {
    '1791848559055-edg727': 20,
    '1791848640186-uci2h8': 10,
    '1791848671139-7p3d0s': 20,
    '1791851976886-r0oyvc': 5,
    '1791905504005-bczlss': 25,
    '1792154944600-prc3h5': 15,
    '1792155223146-4bdm29': 45,
    '1792509878565-f8jwly': 45,
    '1792521158768-pm93df': 30,
    '1792521917954-56kklj': 20,
    '1792582245686-kzxdir': 50,
    '1792582321267-gg92fz': 30,
    '1792630617894-mz76od': 45,
    '1792630692722-5y5711': 50,
    '1792633269358-b6xo6a': 35,
    '1792633276214-yovcp6': 5,
    '1792633467314-9u4jbl': 5,
    '1792634535691-lg6ebo': 40,
    '1792634706238-dmpyh1': 35,
    '1792635855659-o5eczq': 70,
    '1792718904033-u71t3n': 50,
    '1793575557025-qu7l9t': 20,
    '1793608359137-vnxv7f': 90,
    '1794135798973-tytxe7': 40
  };
  // hauteur de cadrage d'une adresse de photo (null si inconnue)
  function cadragePhoto(url) {
    const m = /\/([0-9]{10,}-[a-z0-9]+)-w\.(?:webp|jpg)/.exec(String(url || ''));
    return m && CADRAGES[m[1]] ? CADRAGES[m[1]] : null;
  }
  racine.CadragesPhotos = { cadragePhoto };
})(typeof window !== 'undefined' ? window : globalThis);
