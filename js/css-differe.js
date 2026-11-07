// Feuilles de style complètes chargées APRÈS la grande photo (chantier W7, 07/11/2026 ; scripts/css-critique.mjs) :
// la page arrive avec les styles du haut de l'écran écrits dedans (<style data-critique>). Les feuilles complètes
// (et les polices qu'elles déclarent) sont listées dans <noscript id="css-complet"> : sans JavaScript, le navigateur
// les lit normalement ; avec JavaScript, ce script les ajoute dès que la grande photo est arrivée (ou au plus tard
// 1,5 s après la lecture de la page), pour qu'elles ne lui prennent pas la bande passante sur un téléphone.
(function () {
  'use strict';
  var fait = false;
  function ajouter() {
    if (fait) return;
    var bloc = document.getElementById('css-complet');
    if (!bloc) return;
    fait = true;
    var hrefs = (bloc.textContent || '').match(/href="[^"]+"/g) || [];
    hrefs.forEach(function (h) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = h.slice(6, -1).replace(/&amp;/g, '&');
      document.head.appendChild(l);
    });
  }
  function grandePhoto() {
    var a = document.querySelector('link[rel="preload"][as="image"]');
    if (!a) return null;
    var cible = a.href;
    return Array.prototype.find.call(document.images, function (i) { return i.currentSrc === cible || i.src === cible; }) || null;
  }
  function attendre() {
    var img = grandePhoto();
    if (!img || img.complete) { ajouter(); return; }
    img.addEventListener('load', ajouter, { once: true });
    img.addEventListener('error', ajouter, { once: true });
    setTimeout(ajouter, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attendre);
  else attendre();
  // (filet : jamais une page sans ses styles)
  window.addEventListener('load', ajouter);
})();
