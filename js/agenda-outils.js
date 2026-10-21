// Outils des formulaires de projets (Agenda du site, js/agenda-admin.js, et Convocations,
// js/convocations-page.js) : une case à cocher avec son libellé, une ligne à deux champs avec
// « Retirer » (intervenants, étapes du déroulé), le déroulé de la journée (heure + activité) et
// le message sous le formulaire.
// Message d'un formulaire (.form-msg, caché tant qu'il n'a ni « ok » ni « err », css/style.css) :
// avant le 21/10/2026, l'Agenda et les Convocations ne posaient que « erreur » et rien ne s'affichait.
function afficherMessageFormulaire(m, t, erreur) {
  m.textContent = t || '';
  m.classList.toggle('ok', !!t && !erreur);
  m.classList.toggle('err', !!t && !!erreur);
}
function caseACocher(valeur, libelle, nom, recherche) {
  var l = document.createElement('label');
  var c = document.createElement('input');
  c.type = 'checkbox'; c.value = valeur; c.name = nom;
  l.appendChild(c);
  l.appendChild(document.createTextNode(libelle));
  l.dataset.nom = String(recherche || libelle).toLowerCase();
  return l;
}
function ligneDeuxChamps(boite, classe, champ1, champ2) {
  var l = document.createElement('div');
  l.className = classe;
  [champ1, champ2].forEach(function (c) {
    var i = document.createElement('input');
    i.type = c.type || 'text';
    if (c.max) i.maxLength = c.max;
    if (c.liste) i.setAttribute('list', c.liste);
    if (c.placeholder) i.placeholder = c.placeholder;
    i.setAttribute('aria-label', c.aria); i.value = c.valeur || ''; i.dataset[c.cle] = '1';
    l.appendChild(i);
  });
  var x = document.createElement('button');
  x.type = 'button'; x.className = 'btn-mini-admin'; x.textContent = 'Retirer';
  x.addEventListener('click', function () { l.remove(); });
  l.appendChild(x);
  boite.appendChild(l);
  return l.querySelectorAll('input')[1];
}
function ajouterEtapeDeroule(boite, heure, activite) {
  return ligneDeuxChamps(boite, 'agenda-intervenant agenda-etape',
    { type: 'time', aria: 'Heure de l’étape', valeur: heure, cle: 'heure' },
    { max: 120, placeholder: 'ex : Essayage', aria: 'Activité de l’étape', valeur: activite, cle: 'activite' });
}
function lireDeroule(boite) {
  return Array.prototype.map.call(boite.querySelectorAll('.agenda-etape'), function (l) {
    return { heure: l.querySelector('[data-heure]').value, activite: l.querySelector('[data-activite]').value.trim() };
  }).filter(function (x) { return x.heure || x.activite; }).slice(0, 30);
}
