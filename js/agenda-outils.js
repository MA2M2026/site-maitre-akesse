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
// Case à cocher avec la photo de la mannequin (« mur de visages ») : on touche la photo pour la
// choisir, le nom est dessous (la case reste lue par les lecteurs d'écran). Partagée par l'Agenda
// et les Convocations (23/10/2026) ; demande la nouvelle Administration (window.Portail).
function caseVisage(valeur, libelle, nom, photo, recherche) {
  var P = window.Portail;
  var l = document.createElement('label');
  l.className = 'choix-visage';
  l.dataset.nom = String(recherche || libelle).toLowerCase();
  l.innerHTML = '<input type="checkbox" name="' + P.esc(nom) + '" value="' + P.esc(valeur) + '">' + P.visage(photo, recherche || libelle) +
    '<span class="choix-nom">' + P.esc(libelle) + '</span><span class="choix-coche" aria-hidden="true">✓</span>';
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

// « Ajouter une personne » (23/10/2026, demande de la propriétaire), partagé par les Places
// limitées (js/admin/site-places.js) et les Convocations (js/convocations-gabarit.js) : on choisit
// d'abord « mannequin de l'agence » (elle entre dans le registre, sans compte sur le site ; parent
// facultatif) ou « mannequin extérieure » (partenaire, majeure, gardée à part dans le carnet).
// px : préfixe des identifiants des champs. Enregistrement : personneEnregistrer(px), fonction
// personne_ajouter de supabase-personnes.sql.
var AIDE_PERSONNE = {
  agence: 'Elle entre dans le registre de l’agence (sans compte sur le site : son code d’accès se donne ensuite, comme d’habitude).',
  exterieure: 'Partenaire extérieure, majeure : gardée à part dans « Mannequins extérieures », jamais comptée avec nos mannequins.'
};
function champsPersonne(px, avecEmail) {
  var champ = function (id, libelle, attributs) {
    return '<label class="personne-champ" for="' + px + '-' + id + '">' + libelle + '<input id="' + px + '-' + id + '" ' + attributs + '></label>';
  };
  return '<div class="personne-champs" data-personne="' + px + '">' +
    '<fieldset class="personne-type"><legend>Cette personne est :</legend>' +
    '<label><input type="radio" name="' + px + '-type" value="agence" data-personne-type> Mannequin de l’agence</label>' +
    '<label><input type="radio" name="' + px + '-type" value="exterieure" data-personne-type> Mannequin extérieure (partenaire)</label></fieldset>' +
    '<p class="personne-aide" id="' + px + '-aide" aria-live="polite"></p>' +
    '<label class="personne-champ" for="' + px + '-civ">Civilité<select id="' + px + '-civ"><option>Mademoiselle</option><option>Madame</option><option>Monsieur</option></select></label>' +
    champ('nom', 'Nom complet', 'maxlength="120" autocomplete="off"') +
    champ('tel', 'WhatsApp', 'type="tel" maxlength="40" inputmode="tel" autocomplete="off"') +
    (avecEmail ? champ('email', 'E-mail', 'type="email" maxlength="160" autocomplete="off"') : '') +
    '<div class="personne-parent" id="' + px + '-parent" hidden><p class="personne-aide">Parent <small>(facultatif, pour une mineure)</small> : rempli, le message part à la mannequin ET à son parent.</p>' +
    champ('pnom', 'Nom du parent', 'maxlength="160" autocomplete="off"') +
    champ('ptel', 'WhatsApp du parent', 'type="tel" maxlength="40" inputmode="tel" autocomplete="off"') + '</div></div>';
}
// le choix agence / extérieure : l'explication, et les champs du parent pour l'agence seulement
document.addEventListener('change', function (e) {
  if (!e.target.matches || !e.target.matches('[data-personne-type]')) return;
  var px = e.target.closest('[data-personne]').dataset.personne, agence = e.target.value === 'agence';
  document.getElementById(px + '-aide').textContent = AIDE_PERSONNE[e.target.value] || '';
  document.getElementById(px + '-parent').hidden = !agence;
});
// vérifie et enregistre ; renvoie la fiche du carnet créée (contacts_externes), ou lance une
// erreur au texte simple
async function personneEnregistrer(px) {
  var $ = function (id) { return document.getElementById(px + '-' + id); };
  var val = function (id) { return $(id) ? String($(id).value || '').trim() : ''; };
  var type = document.querySelector('input[name="' + px + '-type"]:checked');
  if (!type) throw new Error('Choisissez d’abord : mannequin de l’agence ou mannequin extérieure.');
  var agence = type.value === 'agence', nom = val('nom'), tel = val('tel'), email = val('email');
  var pnom = agence ? val('pnom') : '', ptel = agence ? val('ptel') : '';
  if (nom.length < 2) throw new Error('Indiquez le nom complet de la personne.');
  if (!tel && !email && !ptel) throw new Error($('email') ? 'Indiquez au moins son WhatsApp ou son e-mail (ou, pour une mineure de l’agence, celui de son parent).' : 'Indiquez son numéro WhatsApp (ex. 07 01 02 03 04), ou, pour une mineure de l’agence, celui de son parent.');
  if (tel && !numeroWhatsApp(tel)) throw new Error('Ce numéro WhatsApp ne semble pas correct (ex. 07 01 02 03 04).');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Cette adresse e-mail ne semble pas correcte.');
  if (!!pnom !== !!ptel) throw new Error('Pour le parent, indiquez son nom ET son WhatsApp (ou laissez les deux vides).');
  if (ptel && !numeroWhatsApp(ptel)) throw new Error('Le numéro WhatsApp du parent ne semble pas correct.');
  var civilite = $('civ').value;
  var r = await window.Portail.rpc('personne_ajouter', { p_agence: agence, p_civilite: civilite, p_nom: nom, p_telephone: tel ? numeroWhatsApp(tel) : null,
    p_parent_nom: pnom || null, p_parent_telephone: ptel ? numeroWhatsApp(ptel) : null, p_email: email || null });
  if (!r || !r.contact_id) throw new Error('La personne n’a pas pu être enregistrée : reconnectez-vous puis réessayez.');
  ['nom', 'tel', 'email', 'pnom', 'ptel'].forEach(function (id) { if ($(id)) $(id).value = ''; });
  return { id: r.contact_id, mannequin_id: r.mannequin_id || null, civilite: civilite, nom: nom, telephone: tel ? numeroWhatsApp(tel) : null,
    email: email ? email.toLowerCase() : null, parent_nom: pnom || null, parent_telephone: ptel ? numeroWhatsApp(ptel) : null };
}
