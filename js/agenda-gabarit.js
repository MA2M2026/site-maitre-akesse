// Écran « Agenda du site » (js/agenda-admin.js) : formulaire du projet et listes À venir / Réalisés.
// Écran en un seul endroit (22/10/2026) : utilisé par l'ancien tableau de bord (placé tout de
// suite dans #agenda-racine) et par la nouvelle Administration, sans recopier le code.
window.GABARIT_AGENDA = `<h2 class="tdb-4">📅 Agenda du site</h2>
<p class="tdb-5">Le programme de l'agence, montré aux clients sur la page « Agenda » : défilés, shows, shootings, castings, essayages, masterclass, rencontres, événements… Sur le site, on voit les jours, la ville, le lieu, les intervenants et les partenaires ; les noms des mannequins n'y sont plus (ils restent dans le Parcours MA2M). Les horaires n'apparaissent que si vous cochez la case prévue. L'adresse exacte et les notes restent ici, jamais sur le site.</p>
<form id="agenda-form" class="agenda-form" novalidate>
<input type="hidden" id="agenda-id">
<p class="agenda-en-cours" id="agenda-en-cours" role="status" hidden></p>
<div class="agenda-grille">
<div class="form-champ"><label for="agenda-type">Type de projet</label>
<select id="agenda-type"></select></div>
<div class="form-champ"><label for="agenda-titre">Titre (visible)</label><input id="agenda-titre" type="text" maxlength="160" placeholder="ex : Shooting campagne Cha Kane" required></div>
<div class="form-champ"><label for="agenda-date">Date (visible)</label><input id="agenda-date" type="date" required></div>
<div class="form-champ"><label for="agenda-date-fin">Date de fin, si plusieurs jours</label><input id="agenda-date-fin" type="date"></div>
<div class="form-champ"><label for="agenda-ville">Ville (visible)</label><input id="agenda-ville" type="text" maxlength="80" placeholder="ex : Abidjan"></div>
<div class="form-champ"><label for="agenda-lieu">Lieu (visible)</label><input id="agenda-lieu" type="text" maxlength="160" placeholder="ex : Noom Hôtel, Parc des Expositions"></div>
<div class="form-champ"><label for="agenda-pays">Pays (visible dans le Parcours MA2M)</label><input id="agenda-pays" type="text" maxlength="80" value="Côte d'Ivoire" placeholder="ex : Côte d'Ivoire"></div>
</div>
<div class="form-champ"><label for="agenda-description">Quelques mots pour les clients (visible)</label><textarea id="agenda-description" rows="3" maxlength="1200" placeholder="ex : Nos mannequins portent la nouvelle collection de la marque."></textarea></div>
<fieldset class="agenda-choix"><legend>Horaires et lieux, jour par jour</legend>
<p class="agenda-aide">Une ligne par jour de l'activité. Les heures et le lieu peuvent changer d'un jour à l'autre, et un même jour peut avoir plusieurs lieux ou salles (séparez-les par une virgule). Laissez vide ce que vous ne connaissez pas encore.</p>
<div id="agenda-seances" class="agenda-seances"></div>
<label class="agenda-visible"><input id="agenda-horaires-publics" type="checkbox"> Montrer les horaires sur le site (sinon, ils restent ici seulement)</label>
</fieldset>
<fieldset class="agenda-choix"><legend>Intervenants (visibles)</legend>
<p class="agenda-aide">Photographe, chorégraphe, styliste, créateur, organisateur… autant que nécessaire.</p>
<div id="agenda-intervenants" class="agenda-intervenants"></div>
<datalist id="agenda-roles"></datalist>
<button type="button" class="btn-mini-admin" id="agenda-ajouter-intervenant">＋ Ajouter un intervenant</button>
</fieldset>
<fieldset class="agenda-choix"><legend>Partenaires (visibles)</legend><div id="agenda-partenaires" class="agenda-cases">Chargement…</div>
<div class="agenda-nouveau-partenaire">
<input id="agenda-nouveau-partenaire" type="text" maxlength="120" placeholder="Nouveau partenaire : son nom" aria-label="Nom du nouveau partenaire">
<button type="button" class="btn-mini-admin" id="agenda-ajouter-partenaire">＋ Enregistrer ce partenaire</button>
</div>
<p class="agenda-aide">Le nouveau partenaire est ajouté à vos partenaires (il apparaît aussi sur la page Partenaires du site ; vous pourrez y ajouter son logo).</p>
<div class="form-champ"><label for="agenda-autres-partenaires">Autres partenaires de ce projet, qui ne sont pas nos partenaires directs (un nom par ligne)</label><textarea id="agenda-autres-partenaires" rows="2" maxlength="3000" placeholder="ex : Maison XYZ (via un intermédiaire)"></textarea></div>
<p class="agenda-aide">Ces noms apparaissent seulement sur ce projet de l'agenda, jamais sur la page Partenaires du site.</p>
</fieldset>
<fieldset class="agenda-choix"><legend>Mannequins (jamais sur l'agenda du site ; Parcours MA2M si leur profil est publié)</legend>
<input id="agenda-recherche" type="search" aria-label="Rechercher une mannequin" placeholder="Rechercher un nom…" class="agenda-recherche">
<div id="agenda-mannequins" class="agenda-cases agenda-cases-mannequins">Chargement…</div>
<p class="agenda-compte" id="agenda-compte"></p>
<div class="form-champ"><label for="agenda-autres">Autres mannequins de l'agence, pas encore sur le site (un nom par ligne)</label><textarea id="agenda-autres" rows="3" maxlength="3000" placeholder="ex : Fatou Bamba"></textarea></div>
<p class="agenda-aide">Ces noms apparaissent dans le Parcours MA2M, sans photo ni lien (jamais sur l'agenda du site). Quand la mannequin aura son profil, cochez-la plutôt dans la liste ci-dessus et effacez son nom ici.</p></fieldset>
<fieldset class="agenda-choix agenda-interne"><legend>🔒 Interne, jamais affiché sur le site</legend>
<div class="agenda-grille">
<div class="form-champ"><label for="agenda-adresse">Adresse exacte</label><input id="agenda-adresse" type="text" maxlength="300"></div>
<div class="form-champ"><label for="agenda-client">Client (peut être cité dans les messages aux mannequins)</label><input id="agenda-client" type="text" maxlength="160" placeholder="ex : Marque Cha Kane"></div>
</div>
<div class="form-champ"><label for="agenda-notes">Notes internes</label><textarea id="agenda-notes" rows="2" maxlength="2000"></textarea></div>
</fieldset>
<label class="agenda-visible"><input id="agenda-visible" type="checkbox" checked> Montrer ce projet sur le site</label>
<label class="agenda-visible"><input id="agenda-annule" type="checkbox"> Projet annulé (il ne compte pas dans le Parcours MA2M et disparaît de l'agenda du site)</label>
<div class="tdb-28">
<button class="btn btn--principal" id="agenda-enregistrer" type="submit">Ajouter à l'agenda</button>
<button class="btn" id="agenda-annuler" type="button" hidden>Annuler la modification</button>
</div>
<div class="form-msg" id="agenda-msg" role="status"></div>
</form>
<h3 class="tri-titre">À venir</h3>
<div id="agenda-liste-avenir" class="agenda-liste">Chargement…</div>
<h3 class="tri-titre">Réalisés</h3>
<div id="agenda-liste-passes" class="agenda-liste"></div>`;
(function () {
  var racine = document.getElementById('agenda-racine');
  if (racine) racine.innerHTML = window.GABARIT_AGENDA;
})();
