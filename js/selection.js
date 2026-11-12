// Panier de sélection recruteur — persistant via localStorage
const MA2M_SELECTION_CLE = 'ma2m_selection';

function obtenirSelection() {
  try { return JSON.parse(localStorage.getItem(MA2M_SELECTION_CLE)) || []; }
  catch (e) { return []; }
}

function sauvegarderSelection(liste) {
  // Stockage parfois indisponible (navigation privée, certains navigateurs intégrés) :
  // ne jamais faire planter le bouton « Sélectionner » pour autant.
  try { localStorage.setItem(MA2M_SELECTION_CLE, JSON.stringify(liste)); } catch (e) {}
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
  if (window.jouerSon) window.jouerSon('coeur');
}

function retirerSelection(id) {
  sauvegarderSelection(obtenirSelection().filter(m => m.id !== id));
}

function majWidgetSelection() {
  const compteur = document.getElementById('ma2m-panier-compte');
  if (!compteur) return;
  const n = obtenirSelection().length;
  compteur.textContent = n;
  const mot = document.getElementById('ma2m-panier-mot');
  if (mot) mot.textContent = document.documentElement.lang === 'en' ? (n > 1 ? 'profiles selected' : 'profile selected') : (n > 1 ? 'profils sélectionnés' : 'profil sélectionné');
  document.getElementById('ma2m-panier-widget').style.display = n > 0 ? 'flex' : 'none';
}

function injecterWidgetPanier() {
  if (document.getElementById('ma2m-panier-widget')) return;
  // Ce script est partagé entre les pages françaises et anglaises (dossier en/) :
  // le lien et le texte s'adaptent selon la langue de la page.
  const estAnglais = document.documentElement.lang === 'en';
  const widget = document.createElement('a');
  widget.id = 'ma2m-panier-widget';
  widget.href = 'selection.html';
  widget.className = 'panier-widget';
  // (12/11/2026, The Book premium) barre blanche en bas : « 2 profils sélectionnés · Demander un casting › »
  widget.className = 'panier-widget panier-barre';
  widget.setAttribute('data-bouton-libre', '');
  widget.innerHTML = '<span class="panier-texte"><span id="ma2m-panier-compte">0</span> <span id="ma2m-panier-mot">' + (estAnglais ? 'profiles selected' : 'profils sélectionnés') + '</span></span>' +
    '<span class="panier-go">' + (estAnglais ? 'Request a casting ›' : 'Demander un casting ›') + '</span>';
  document.body.appendChild(widget);
  majWidgetSelection();
}

document.addEventListener('DOMContentLoaded', injecterWidgetPanier);
