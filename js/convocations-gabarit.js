// Écran des Convocations (formulaire du projet + panneau d'envoi), en un seul endroit (22/10/2026) ;
// rangé en « billets » des projets puis 4 étapes (Projet, Mannequins, Message, Envoi) et l'onglet Réponses
// le 11/11/2026 (maquette validée par la propriétaire ; le parcours : js/admin/site-convocations.js) :
// utilisé par l'ancien tableau de bord (placé tout de suite dans #convocations-racine) et par la
// nouvelle Administration (js/admin/site-convocations.js), sans recopier le code. Les identifiants
// sont ceux que lisent js/convocations-page.js et js/convocations-admin.js.
window.GABARIT_CONVOCATIONS = `<div id="cv-liste" class="cv-liste">
<h2 class="tdb-4">📨 Convocations</h2>
<p class="tdb-5">Touchez un projet pour convoquer les mannequins et suivre leurs réponses, ou créez-en un nouveau (il s'ajoute tout seul à l'agenda).</p>
<p class="agenda-aide agenda-alerte" id="cv-inactif" hidden>Les convocations ne sont pas encore activées : exécutez une fois le fichier supabase-convocations.sql (Extension 141) dans Supabase.</p>
<button type="button" class="cv-nouveau" id="cv-nouveau">＋ Nouveau projet</button>
<h3 class="cv-sec">À venir</h3>
<div id="cv-billets" class="cv-billets" aria-live="polite"><p class="agenda-aide">Chargement…</p></div>
<details class="convoc-voir">
<summary id="cv-voir-reponses" aria-controls="cv-reponses-bloc">📋 Réponses d’un projet passé</summary>
<div id="cv-reponses-bloc" class="convoc-voir-bloc" hidden>
<div class="form-champ"><label for="cv-reponses-projet">Projet</label><select id="cv-reponses-projet"><option value="">Choisissez un projet…</option></select></div>
<button type="button" class="btn-mini-admin" id="cv-reponses-actualiser" hidden>🔄 Actualiser</button>
<div id="cv-reponses" class="convoc-reponses" aria-live="polite"></div>
</div>
</details>
</div>
<div id="cv-parcours" class="cv-parcours">
<div class="cv-tete"><button type="button" class="cv-retour" id="cv-retour" aria-label="Retour aux projets">‹</button><h2 id="cv-titre-projet">Nouveau projet</h2></div>
<div class="cv-onglets" role="tablist"><button type="button" role="tab" data-cv-onglet="convoquer" aria-selected="true">Convoquer</button><button type="button" role="tab" data-cv-onglet="reponses" aria-selected="false" id="cv-onglet-reponses">Réponses</button></div>
<ol class="cv-etapes" aria-label="Étapes">
<li><button type="button" data-aller-etape="1">1 · Projet</button></li>
<li><button type="button" data-aller-etape="2">2 · Mannequins</button></li>
<li><button type="button" data-aller-etape="3">3 · Message</button></li>
<li><button type="button" data-aller-etape="4">4 · Envoi</button></li>
</ol>
<form id="cv-form" class="agenda-form" novalidate>
<section data-etape="1" class="cv-etape">
<div class="form-champ cv-cache"><label for="cv-projet">Le projet</label><select id="cv-projet"><option value="">➕ Nouveau projet</option></select></div>
<div class="agenda-grille cv-essentiel">
<div class="form-champ"><label for="cv-titre">Titre</label><input id="cv-titre" type="text" maxlength="160" placeholder="ex : Défilé Africa in Rhythm"></div>
<div class="form-champ"><label for="cv-type">Type</label><select id="cv-type"></select></div>
<div class="form-champ"><label for="cv-date">Date</label><input id="cv-date" type="date"></div>
<div class="form-champ"><label for="cv-heure-convocation">Convocation des mannequins à</label><input id="cv-heure-convocation" type="time"></div>
<div class="form-champ"><label for="cv-lieu">Lieu</label><input id="cv-lieu" type="text" maxlength="160" placeholder="ex : Hôtel Ivoire, salle Atlantique"></div>
<div class="form-champ"><label for="cv-ville">Ville</label><input id="cv-ville" type="text" maxlength="80" placeholder="ex : Abidjan"></div>
</div>
<details class="cv-replie" id="cv-details"><summary>Plus de détails : programme, à prévoir, rappels…</summary>
<div class="agenda-grille">
<div class="form-champ"><label for="cv-date-fin">Date de fin, si plusieurs jours</label><input id="cv-date-fin" type="date"></div>
<div class="form-champ"><label for="cv-heure-evenement">Heure de l'événement</label><input id="cv-heure-evenement" type="time"></div>
<div class="form-champ"><label for="cv-adresse">Adresse exacte (jamais sur le site)</label><input id="cv-adresse" type="text" maxlength="300"></div>
</div>
<fieldset class="agenda-choix"><legend>Déroulé de la journée</legend>
<p class="agenda-aide">Étape par étape : accueil, essayage, maquillage, répétition…</p>
<div id="cv-deroule" class="agenda-intervenants"></div>
<button type="button" class="btn-mini-admin" id="cv-ajouter-etape">＋ Ajouter une étape</button>
</fieldset>
<div class="form-champ"><label for="cv-a-prevoir">À prévoir (une chose par ligne)</label><textarea id="cv-a-prevoir" rows="3" maxlength="1500" placeholder="ex : Escarpins noirs&#10;Pièce d'identité&#10;Venir démaquillée"></textarea></div>
<div class="agenda-rappel"><label class="agenda-visible"><input id="cv-rappel" type="checkbox" checked> Rappel automatique la veille, à</label> <input id="cv-rappel-heure" type="time" value="18:00" aria-label="Heure du rappel de la veille"></div>
<div class="agenda-rappel" id="cv-rappel-avant-ligne"><label class="agenda-visible"><input id="cv-rappel-avant" type="checkbox" checked> Rappel automatique</label> <select id="cv-rappel-avant-jours" aria-label="Combien de jours avant l'événement"><option value="2">2 jours</option><option value="3" selected>3 jours</option><option value="4">4 jours</option><option value="5">5 jours</option><option value="7">1 semaine</option></select> avant, à <input id="cv-rappel-avant-heure" type="time" value="10:00" aria-label="Heure du rappel avant l'événement"></div>
<details class="agenda-message"><summary>Personnaliser le message (facultatif)</summary>
<p class="agenda-aide">Laissez vide pour le message type. Repères remplis pour chaque personne : {salutation}, {introduction}, {date}, {heure_evenement}, {lieu}, {adresse}, {convocation}, {programme}, {a_prevoir}, {ponctualite}, {confirmer} (lien de confirmation). Une ligne dont le repère est vide disparaît.</p>
<textarea id="cv-message" rows="12" maxlength="4000" aria-label="Message personnalisé"></textarea>
<button type="button" class="btn-mini-admin" id="cv-message-type">Partir du message type</button>
</details>
<label class="agenda-visible"><input id="cv-visible" type="checkbox" checked> Montrer ce projet sur l'agenda du site (sans les noms des mannequins, sans l'adresse ni le programme)</label>
</details>
<details class="cv-replie" id="cv-affiche-bloc"><summary id="cv-affiche-titre">🖼️ Affiche ou photo (facultatif)</summary><div id="cv-affiche"></div></details>
<div class="cv-suite"><button type="button" class="btn btn--principal" data-aller-etape="2">Suivant : les mannequins ›</button></div>
</section>
<section data-etape="2" class="cv-etape">
<fieldset class="agenda-choix"><legend>Les mannequins concernés</legend>
<input id="cv-recherche" type="search" aria-label="Rechercher une mannequin" placeholder="Rechercher un nom…" class="agenda-recherche">
<div id="cv-mannequins" class="agenda-cases agenda-cases-mannequins">Chargement…</div>
<p class="agenda-compte" id="cv-compte"></p>
<p class="agenda-aide">Personnes non inscrites sur le site : vous les ajouterez à l'étape suivante.</p>
</fieldset>
<div class="cv-suite"><button type="button" class="btn" data-aller-etape="1">‹ Le projet</button><button class="btn btn--principal" id="cv-enregistrer" type="submit">Enregistrer · suivant : le message ›</button></div>
</section>
<div class="form-msg" id="cv-etat" role="status"></div>
</form>
<section id="convoc-panneau" class="convoc-panneau" hidden aria-labelledby="convoc-titre">
<h3 class="tri-titre cv-cache" id="convoc-titre">📨 Convoquer</h3>
<p class="agenda-aide cv-cache" id="convoc-resume"></p>
<div data-etape="3" class="cv-etape">
<fieldset class="agenda-choix"><legend>Participants</legend>
<p class="agenda-aide">Les mannequins choisies sont déjà dans la liste. Pour un(e) mineur(e), le message part au parent. Décochez une personne pour ne pas lui écrire.</p>
<div id="convoc-participants" class="convoc-participants">Chargement…</div>
<div class="agenda-nouveau-partenaire">
<select id="convoc-carnet" aria-label="Choisir une personne déjà enregistrée dans le carnet"><option value="">Carnet : personne déjà enregistrée…</option></select>
<button type="button" class="btn-mini-admin" id="convoc-carnet-ajouter">＋ Ajouter</button>
</div>
<details class="convoc-ajout"><summary>＋ Ajouter une personne pas encore enregistrée</summary>
${champsPersonne('convoc', true)}
<button type="button" class="btn-mini-admin" id="convoc-personne-ajouter">＋ Ajouter cette personne</button>
<p class="agenda-aide">Elle reste enregistrée (registre de l'agence, ou mannequins extérieures), pour la retrouver au prochain projet.</p>
</details>
</fieldset>
<fieldset class="agenda-choix"><legend>Le message</legend>
<div class="form-champ"><label for="convoc-sorte">Quel message envoyer ?</label><select id="convoc-sorte"><option value="selection">🎉 Annoncer la sélection (court, en premier)</option><option value="convocation">📨 Convocation (tous les détails)</option><option value="rappel_avant">🔔 Rappel de l'information (date, heure, lieu)</option></select></div>
<p class="agenda-aide" id="convoc-sorte-aide"></p>
<label class="agenda-visible" id="convoc-client-bloc" hidden><input type="checkbox" id="convoc-citer-client" checked> Citer le client dans les messages : « <span id="convoc-client-nom"></span> »</label>
<select id="convoc-apercu-qui" aria-label="Voir le message envoyé à"></select>
<pre id="convoc-apercu" class="convoc-apercu"></pre>
</fieldset>
<div class="cv-suite"><button type="button" class="btn" data-aller-etape="2">‹ Les mannequins</button><button type="button" class="btn btn--principal" data-aller-etape="4">Suivant : l’envoi ›</button></div>
</div>
<div data-etape="4" class="cv-etape">
<div class="cv-resume" id="cv-resume-envoi" aria-live="polite"></div>
<fieldset class="agenda-choix"><legend>Envoi</legend>
<label class="agenda-visible"><input type="checkbox" id="convoc-canal-email" checked> E-mail (automatique)</label>
<label class="agenda-visible"><input type="checkbox" id="convoc-canal-whatsapp" checked> WhatsApp (préparé : un appui par personne, tant que l'envoi automatique n'est pas activé)</label>
<label class="agenda-visible convoc-inactif"><input type="checkbox" id="convoc-canal-sms" disabled> SMS (bientôt)</label>
<div class="agenda-grille">
<div class="form-champ"><label for="convoc-quand">Quand ?</label><select id="convoc-quand"><option value="0">Maintenant</option><option value="30">Dans 30 minutes</option><option value="40">Dans 40 minutes</option><option value="60">Dans 1 heure</option><option value="120">Dans 2 heures</option><option value="180">Dans 3 heures</option><option value="date">À une date et une heure précises</option></select></div>
<div class="form-champ u-hidden" id="convoc-date-champ"><label for="convoc-date">Date et heure de l'envoi (heure d'Abidjan)</label><input id="convoc-date" type="datetime-local"></div>
</div>
<p class="agenda-aide" id="convoc-rappel-info"></p>
<div class="tdb-28 cv-suite"><button type="button" class="btn" data-aller-etape="3">‹ Le message</button><button type="button" class="btn btn--principal" id="convoc-programmer">Programmer l'envoi</button><button type="button" class="btn cv-cache" id="convoc-fermer">Fermer</button></div>
<div class="form-msg" id="convoc-msg" role="status"></div>
</fieldset>
<h4 class="convoc-suivi-titre">Suivi des envois</h4>
<div id="convoc-suivi" class="convoc-suivi"></div>
</div>
<div class="cv-reponses-onglet">
<h4 class="convoc-suivi-titre">Réponses des participants <button type="button" class="btn-mini-admin" id="convoc-actualiser">🔄 Actualiser</button></h4>
<div id="convoc-reponses" class="convoc-reponses"><p class="agenda-aide">Les réponses arrivent quand les participants appuient sur leur lien « Confirmez votre présence ».</p></div>
</div>
</section>
</div>`;
(function () {
  var racine = document.getElementById('convocations-racine');
  if (racine) racine.innerHTML = window.GABARIT_CONVOCATIONS;
})();
