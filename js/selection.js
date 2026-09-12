// Panier de sélection recruteur — persistant via localStorage
const MA2M_SELECTION_CLE = 'ma2m_selection';

function obtenirSelection() {
  try { return JSON.parse(localStorage.getItem(MA2M_SELECTION_CLE)) || []; }
  catch (e) { return []; }
}

function sauvegarderSelection(liste) {
  localStorage.setItem(MA2M_SELECTION_CLE, JSON.stringify(liste));
  majWidgetSelection();
}

function estDansSelection(id) {
  return obtenirSelection().some(m => m.id === id);
}

function ajouterSelection(mannequin) {
  const liste = obtenirSelection();
  if (liste.some(m => m.id === mannequin.id)) return;
  liste.push(mannequin);
  sauvegarderSelection(liste);
}

function retirerSelection(id) {
  sauvegarderSelection(obtenirSelection().filter(m => m.id !== id));
}

function majWidgetSelection() {
  const compteur = document.getElementById('ma2m-panier-compte');
  if (!compteur) return;
  const n = obtenirSelection().length;
  compteur.textContent = n;
  document.getElementById('ma2m-panier-widget').style.display = n > 0 ? 'flex' : 'none';
}

function injecterWidgetPanier() {
  if (document.getElementById('ma2m-panier-widget')) return;
  const widget = document.createElement('a');
  widget.id = 'ma2m-panier-widget';
  widget.href = 'selection.html';
  widget.className = 'panier-widget';
  widget.innerHTML = `Ma sélection <span id="ma2m-panier-compte">0</span>`;
  document.body.appendChild(widget);
  majWidgetSelection();
}

document.addEventListener('DOMContentLoaded', injecterWidgetPanier);
