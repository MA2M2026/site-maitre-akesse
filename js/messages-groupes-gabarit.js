// Écran des Messages groupés, en un seul endroit (22/10/2026) : utilisé par l'ancien tableau de
// bord (placé tout de suite dans #messages-groupes-racine) et par la nouvelle Administration
// (js/admin/site-messages-groupes.js), sans recopier le code. Logique : js/messages-groupes.js.
window.GABARIT_MESSAGES_GROUPES = `<h2 class="tdb-10">📣 Messages groupés</h2>
<p class="tdb-9">Un seul message, envoyé à chaque personne <strong>séparément</strong> : personne ne voit les autres et aucun groupe n'est créé. Écrivez <strong>{prénom}</strong> ou <strong>{casting}</strong> dans le message : ils seront remplacés pour chaque personne.</p>
<div class="mg-grille">
<div class="form-champ"><label for="mg-source">Qui ?</label><select id="mg-source"><option value="agence">Candidatures : intégrer l'agence</option><option value="casting">Candidatures : un casting précis</option><option value="inscription">Inscriptions mannequins</option></select></div>
<div class="form-champ"><label for="mg-statut">Statut</label><select id="mg-statut"></select></div>
<div class="form-champ" id="mg-champ-casting"><label for="mg-casting">Quel casting ?</label><select id="mg-casting"><option value="">Chargement des castings…</option></select></div>
<div class="form-champ" id="mg-champ-type"><label for="mg-type">Quel message ?</label><select id="mg-type"></select></div>
</div>
<button class="btn" id="mg-charger" type="button">Afficher les destinataires</button>
<p id="mg-resume" class="mg-resume"></p>
<button class="btn-mini-admin" id="mg-tout" type="button">Tout cocher / tout décocher</button>
<div id="mg-liste" class="mg-liste"></div>
<div id="mg-infos-rdv" class="mg-grille">
<div class="form-champ"><label for="mg-date">Date du casting</label><input type="date" id="mg-date"></div>
<div class="form-champ"><label for="mg-heure">Heure</label><input type="text" id="mg-heure" placeholder="15 h 00"></div>
<div class="form-champ"><label for="mg-lieu">Lieu</label><input type="text" id="mg-lieu" placeholder="Riviera Faya, Cité ATCI"></div>
</div>
<div class="form-champ" id="mg-champ-message-parent"><label for="mg-message-parent">Version pour les parents (mineurs)</label><textarea id="mg-message-parent" rows="6"></textarea></div>
<div class="form-champ"><label for="mg-message">Message</label><textarea id="mg-message" rows="8" placeholder="Écrivez ici votre message (cette case est vide pour l’instant)."></textarea></div>
<p id="mg-consigne" class="mg-consigne"></p>
<div id="mg-apercu" class="mg-apercu"></div>
<div class="mg-actions">
<button class="btn btn--principal" id="mg-email" type="button">📧 Envoyer par e-mail</button>
</div>
<div id="mg-email-etat" class="form-msg"></div>
<h3 class="mg-sous-titre">💬 WhatsApp, une personne après l'autre</h3>
<p class="tdb-9">Chaque appui ouvre WhatsApp avec le message déjà écrit pour la personne suivante : appuyez sur « Envoyer » dans WhatsApp, revenez ici, et recommencez. (L'envoi WhatsApp entièrement automatique n'existe qu'avec l'offre payante de WhatsApp.)</p>
<div class="mg-actions">
<button class="btn btn--principal" id="mg-wa-suivant" type="button">💬 Ouvrir WhatsApp pour la personne suivante</button>
<button class="btn" id="mg-wa-copier" type="button">📋 Copier tous les numéros</button>
</div>
<p id="mg-wa-etat" class="mg-resume"></p>`;
(function () {
  var racine = document.getElementById('messages-groupes-racine');
  if (racine) racine.innerHTML = window.GABARIT_MESSAGES_GROUPES;
})();
