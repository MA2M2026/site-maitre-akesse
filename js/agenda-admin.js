// Tableau de bord — « Agenda du site » (06/10/2026, Extensions 124 et 125) : la
// propriétaire programme les projets de l'agence (défilé, show, shooting, casting,
// essayages, masterclass, rencontre…) avec leurs horaires jour par jour, le lieu, les
// intervenants (photographe, chorégraphe, styliste…), les partenaires (un nouveau
// partenaire s'enregistre sur place) et les mannequins. La page publique « Agenda » montre
// les jours, la ville, le lieu, les intervenants, les partenaires et les mannequins dont le
// profil est visible ; les horaires seulement si la case est cochée ; l'adresse exacte et
// les notes restent ici.
(function () {
  var section = document.querySelector('[data-section="b3c-agenda"]');
  var form = document.getElementById('agenda-form');
  if (!section || !form || typeof sb === 'undefined' || !sb) return;

  var $ = function (id) { return document.getElementById(id); };
  var charge = false, enCours = false, listesOk = false;
  var projets = [], mannequins = [], partenaires = [];

  function message(t, erreur) {
    var m = $('agenda-msg');
    m.textContent = t || '';
    m.classList.toggle('erreur', !!erreur);
  }
  function cochees(idConteneur) {
    return Array.prototype.map.call($(idConteneur).querySelectorAll('input[type=checkbox]:checked'), function (c) { return c.value; });
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
  // ---------- Horaires jour par jour ----------
  function joursEntre(debut, fin) {
    var jours = [];
    if (!debut) return jours;
    var d = new Date(debut + 'T12:00:00'), dernier = fin && fin > debut ? fin : debut;
    for (var n = 0; n < 60; n++) {
      var j = dateDuJour(d);
      if (j > dernier) break;
      jours.push(j);
      d.setDate(d.getDate() + 1);
    }
    return jours;
  }
  function lireSeances() {
    return Array.prototype.map.call($('agenda-seances').querySelectorAll('.agenda-seance'), function (l) {
      return { jour: l.dataset.jour, debut: l.querySelector('[data-debut]').value, fin: l.querySelector('[data-fin]').value };
    }).filter(function (x) { return x.debut || x.fin; });
  }
  // Une ligne par jour de l'activité ; les heures déjà tapées sont gardées si les dates changent.
  function dessinerSeances(existantes) {
    var connues = {};
    (existantes || lireSeances()).forEach(function (x) { connues[x.jour] = x; });
    var boite = $('agenda-seances');
    boite.textContent = '';
    var jours = joursEntre($('agenda-date').value, $('agenda-date-fin').value);
    if (!jours.length) { boite.textContent = 'Choisissez d’abord la date (et la date de fin si l’activité dure plusieurs jours).'; return; }
    jours.forEach(function (j) {
      var l = document.createElement('div');
      l.className = 'agenda-seance';
      l.dataset.jour = j;
      var nom = document.createElement('span');
      nom.className = 'agenda-seance-jour';
      nom.textContent = dateAgenda(j);
      var debut = document.createElement('input'); debut.type = 'time'; debut.dataset.debut = '1';
      debut.setAttribute('aria-label', 'Début le ' + dateAgenda(j));
      var fin = document.createElement('input'); fin.type = 'time'; fin.dataset.fin = '1';
      fin.setAttribute('aria-label', 'Fin le ' + dateAgenda(j));
      if (connues[j]) { debut.value = connues[j].debut || ''; fin.value = connues[j].fin || ''; }
      var a = document.createElement('span'); a.textContent = 'à';
      l.appendChild(nom); l.appendChild(debut); l.appendChild(a); l.appendChild(fin);
      boite.appendChild(l);
    });
  }

  // ---------- Intervenants (rôle + nom, liste libre) ----------
  function ajouterIntervenant(role, nom) {
    var l = document.createElement('div');
    l.className = 'agenda-intervenant';
    var r = document.createElement('input');
    r.type = 'text'; r.maxLength = 60; r.setAttribute('list', 'agenda-roles'); r.placeholder = 'Rôle (ex : Photographe)';
    r.setAttribute('aria-label', 'Rôle de l’intervenant'); r.value = role || ''; r.dataset.role = '1';
    var n = document.createElement('input');
    n.type = 'text'; n.maxLength = 120; n.placeholder = 'Nom'; n.setAttribute('aria-label', 'Nom de l’intervenant');
    n.value = nom || ''; n.dataset.nom = '1';
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'btn-mini-admin'; x.textContent = 'Retirer';
    x.addEventListener('click', function () { l.remove(); });
    l.appendChild(r); l.appendChild(n); l.appendChild(x);
    $('agenda-intervenants').appendChild(l);
    return n;
  }
  function lireIntervenants() {
    return Array.prototype.map.call($('agenda-intervenants').querySelectorAll('.agenda-intervenant'), function (l) {
      return { role: l.querySelector('[data-role]').value.trim(), nom: l.querySelector('[data-nom]').value.trim() };
    }).filter(function (x) { return x.nom; });
  }

  function majCompte() {
    var n = cochees('agenda-mannequins').length;
    var libelle = n > 1 ? ' mannequins choisis' : ' mannequin choisi';
    $('agenda-compte').textContent = n ? n + libelle : '';
  }

  async function chargerChoix() {
    var r = await Promise.all([
      lireToutesLignes(function () { return sb.from('model_profiles').select('id, full_name, published').order('id'); }),
      sb.from('partenaires').select('id, nom').order('nom')
    ]);
    // Sans les listes complètes, enregistrer effacerait les mannequins et partenaires
    // d'un projet modifié : on bloque l'enregistrement tant qu'elles manquent.
    if (r[0].error || r[1].error) throw (r[0].error || r[1].error);
    mannequins = (r[0].data || []).filter(function (p) { return p.full_name; })
      .sort(function (a, b) { return a.full_name.localeCompare(b.full_name, 'fr'); });
    partenaires = r[1].data || [];
    var boiteM = $('agenda-mannequins'); boiteM.textContent = '';
    mannequins.forEach(function (p) {
      boiteM.appendChild(caseACocher(p.id, p.full_name + (p.published ? '' : ' (profil non publié)'), 'agenda-mannequin', p.full_name));
    });
    if (!mannequins.length) boiteM.textContent = 'Aucun mannequin trouvé.';
    var boiteP = $('agenda-partenaires'); boiteP.textContent = '';
    partenaires.forEach(function (p) { boiteP.appendChild(caseACocher(p.id, p.nom, 'agenda-partenaire')); });
    if (!partenaires.length) boiteP.textContent = 'Aucun partenaire enregistré (page Partenaires).';
    listesOk = true;
  }

  function nomsDe(ids, liste, cle) {
    return (ids || []).map(function (id) {
      var t = liste.find(function (x) { return x.id === id; });
      return t ? t[cle] : null;
    }).filter(Boolean);
  }

  function ligneProjet(p) {
    var div = document.createElement('div');
    div.className = 'agenda-ligne' + (p.visible ? '' : ' cache');
    var noms = nomsDe(p.mannequin_ids, mannequins, 'full_name');
    var parts = nomsDe(p.partenaire_ids, partenaires, 'nom');
    var horaires = (p.seances || []).map(function (x) { return dateAgenda(x.jour) + ' ' + (x.debut || '?') + '–' + (x.fin || '?'); }).join(' ; ');
    var intervenants = (p.intervenants || []).map(function (x) { return (x.role ? x.role + ' : ' : '') + x.nom; });
    var prive = [p.heure, p.adresse, horaires && !p.horaires_publics ? horaires : ''].filter(Boolean).join(' · ');
    div.innerHTML =
      '<div class="agenda-date">' + echapperHtml(dateAgenda(p.date_debut, p.date_fin)) + '</div>'
      + '<div><span class="agenda-type">' + echapperHtml(libelleTypeAgenda(p.type)) + (p.visible ? '' : ' · caché du site') + '</span>'
      + '<h4>' + echapperHtml(p.titre) + '</h4>'
      + (p.ville || p.lieu ? '<p>' + echapperHtml([p.lieu, p.ville].filter(Boolean).join(', ')) + '</p>' : '')
      + (horaires && p.horaires_publics ? '<p>Horaires : ' + echapperHtml(horaires) + '</p>' : '')
      + (intervenants.length ? '<p>' + echapperHtml(intervenants.join(' · ')) + '</p>' : '')
      + (parts.length ? '<p>Partenaires : ' + echapperHtml(parts.join(', ')) + '</p>' : '')
      + (noms.length ? '<p>Mannequins : ' + echapperHtml(noms.join(', ')) + '</p>' : '')
      + (prive ? '<p class="agenda-prive">🔒 ' + echapperHtml(prive) + '</p>' : '')
      + '</div>'
      + '<div class="agenda-boutons"><button type="button" class="btn-mini-admin" data-modifier="' + echapperHtml(p.id) + '">Modifier</button>'
      + '<button type="button" class="btn-mini-admin" data-supprimer="' + echapperHtml(p.id) + '">Supprimer</button></div>';
    return div;
  }

  function afficherListe() {
    var parts = separerAgenda(projets);
    [['agenda-liste-avenir', parts.avenir, 'Aucun projet à venir. Ajoutez le premier avec le formulaire ci-dessus.'],
     ['agenda-liste-passes', parts.passes, 'Aucun projet réalisé pour le moment.']].forEach(function (z) {
      var boite = $(z[0]); boite.textContent = '';
      if (!z[1].length) { boite.textContent = z[2]; return; }
      z[1].forEach(function (p) { boite.appendChild(ligneProjet(p)); });
    });
  }

  async function chargerProjets() {
    var r = await sb.from('agenda_projets').select('*').order('date_debut', { ascending: true });
    if (r.error) {
      var manque = /agenda_projets/.test(r.error.message || '') && /exist|schema cache/i.test(r.error.message || '');
      $('agenda-liste-avenir').textContent = manque
        ? 'L’agenda n’est pas encore activé : exécutez l’Extension 124 dans Supabase.'
        : 'Impossible de charger l’agenda : ' + r.error.message;
      return;
    }
    projets = r.data || [];
    afficherListe();
  }

  async function charger() {
    charge = true;
    try { await chargerChoix(); } catch (e) {
      console.warn('Agenda : listes non chargées', e);
      message('Les listes des mannequins et des partenaires n’ont pas pu être chargées. Rechargez la page avant d’enregistrer.', true);
    }
    await chargerProjets();
  }

  function viderFormulaire() {
    form.reset();
    $('agenda-id').value = '';
    $('agenda-visible').checked = true;
    $('agenda-intervenants').textContent = '';
    dessinerSeances([]);
    $('agenda-enregistrer').textContent = 'Ajouter à l’agenda';
    $('agenda-annuler').hidden = true;
    filtrer('');
    majCompte();
  }

  function remplirFormulaire(p) {
    $('agenda-id').value = p.id;
    $('agenda-type').value = p.type;
    $('agenda-titre').value = p.titre || '';
    $('agenda-date').value = p.date_debut || '';
    $('agenda-date-fin').value = p.date_fin || '';
    $('agenda-ville').value = p.ville || '';
    $('agenda-lieu').value = p.lieu || '';
    $('agenda-description').value = p.description || '';
    $('agenda-horaires-publics').checked = !!p.horaires_publics;
    dessinerSeances(p.seances || []);
    $('agenda-intervenants').textContent = '';
    (p.intervenants || []).forEach(function (x) { ajouterIntervenant(x.role, x.nom); });
    if (!(p.intervenants || []).length && p.photographe) ajouterIntervenant('Photographe', p.photographe);
    $('agenda-adresse').value = p.adresse || '';
    $('agenda-notes').value = p.notes_internes || '';
    $('agenda-visible').checked = !!p.visible;
    [['agenda-mannequins', p.mannequin_ids], ['agenda-partenaires', p.partenaire_ids]].forEach(function (z) {
      $(z[0]).querySelectorAll('input[type=checkbox]').forEach(function (c) { c.checked = (z[1] || []).includes(c.value); });
    });
    majCompte();
    $('agenda-enregistrer').textContent = 'Enregistrer les modifications';
    $('agenda-annuler').hidden = false;
    message('');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function filtrer(t) {
    var q = String(t || '').trim().toLowerCase();
    $('agenda-mannequins').querySelectorAll('label').forEach(function (l) {
      l.hidden = !!q && !l.dataset.nom.includes(q);
    });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (enCours) return;
    if (!listesOk) { message('Rechargez la page : les listes des mannequins et des partenaires ne sont pas chargées.', true); return; }
    var titre = $('agenda-titre').value.trim(), debut = $('agenda-date').value, fin = $('agenda-date-fin').value || null;
    if (!titre || !debut) { message('Indiquez au moins un titre et une date.', true); return; }
    if (fin && fin < debut) { message('La date de fin doit être après la date de début.', true); return; }
    var heuresInversees = lireSeances().some(function (x) { return x.debut && x.fin && x.fin < x.debut; });
    if (heuresInversees) { message('Une heure de fin est avant l’heure de début : vérifiez les horaires.', true); return; }
    var ligne = {
      type: $('agenda-type').value,
      titre: titre,
      date_debut: debut,
      date_fin: fin && fin !== debut ? fin : null,
      ville: $('agenda-ville').value.trim() || null,
      lieu: $('agenda-lieu').value.trim() || null,
      description: $('agenda-description').value.trim() || null,
      intervenants: lireIntervenants(),
      seances: lireSeances(),
      horaires_publics: $('agenda-horaires-publics').checked,
      adresse: $('agenda-adresse').value.trim() || null,
      notes_internes: $('agenda-notes').value.trim() || null,
      visible: $('agenda-visible').checked,
      mannequin_ids: cochees('agenda-mannequins'),
      partenaire_ids: cochees('agenda-partenaires')
    };
    var id = $('agenda-id').value;
    enCours = true;
    $('agenda-enregistrer').disabled = true;
    message('Enregistrement…');
    try {
      var r = id
        ? await sb.from('agenda_projets').update({ updated_at: new Date().toISOString(), ...ligne }).eq('id', id).select('id')
        : await sb.from('agenda_projets').insert(ligne).select('id');
      if (r.error) { message('Erreur : ' + r.error.message, true); return; }
      // Aucune ligne touchée = session expirée ou compte non admin : rien n'a été enregistré.
      if (!r.data || !r.data.length) { message('Rien n’a été enregistré : reconnectez-vous au tableau de bord puis réessayez.', true); return; }
      viderFormulaire();
      var visibleSite = ligne.visible ? ' Il est visible sur la page Agenda du site.' : ' Il est caché du site.';
      message((id ? 'Projet modifié.' : 'Projet ajouté à l’agenda.') + visibleSite);
      await chargerProjets();
    } finally {
      enCours = false;
      $('agenda-enregistrer').disabled = false;
    }
  });

  $('agenda-annuler').addEventListener('click', function () { viderFormulaire(); message(''); });
  $('agenda-date').addEventListener('change', function () { dessinerSeances(); });
  $('agenda-date-fin').addEventListener('change', function () { dessinerSeances(); });
  $('agenda-ajouter-intervenant').addEventListener('click', function () { ajouterIntervenant('', '').focus(); });

  // Nouveau partenaire enregistré sur place, puis coché pour ce projet.
  $('agenda-ajouter-partenaire').addEventListener('click', async function () {
    var champ = $('agenda-nouveau-partenaire'), nom = champ.value.trim();
    if (!nom) { champ.focus(); return; }
    var existant = partenaires.find(function (x) { return x.nom.toLowerCase() === nom.toLowerCase(); });
    if (existant) {
      var c = $('agenda-partenaires').querySelector('input[value="' + existant.id + '"]');
      if (c) c.checked = true;
      champ.value = '';
      message('« ' + existant.nom + ' » était déjà enregistré : il est coché.');
      return;
    }
    this.disabled = true;
    var r = await sb.from('partenaires').insert({ nom: nom }).select('id, nom');
    this.disabled = false;
    if (r.error || !r.data || !r.data.length) { message('Le partenaire n’a pas pu être enregistré' + (r.error ? ' : ' + r.error.message : '.'), true); return; }
    var nouveau = r.data[0];
    partenaires.push(nouveau);
    var boite = $('agenda-partenaires');
    if (!boite.querySelector('input')) boite.textContent = '';
    var l = caseACocher(nouveau.id, nouveau.nom, 'agenda-partenaire');
    l.querySelector('input').checked = true;
    boite.appendChild(l);
    champ.value = '';
    message('Partenaire « ' + nouveau.nom + ' » enregistré et coché.');
  });

  // Listes fixes : types de projet et rôles proposés (partagés dans js/app.js).
  Object.keys(MA2M_TYPES_AGENDA).forEach(function (cle) {
    var o = document.createElement('option');
    o.value = cle; o.textContent = libelleTypeAgenda(cle);
    $('agenda-type').appendChild(o);
  });
  MA2M_ROLES_INTERVENANTS.forEach(function (r) {
    var o = document.createElement('option'); o.value = r;
    $('agenda-roles').appendChild(o);
  });
  dessinerSeances([]);
  $('agenda-recherche').addEventListener('input', function () { filtrer(this.value); });
  $('agenda-mannequins').addEventListener('change', majCompte);

  section.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-modifier], [data-supprimer]');
    if (!b) return;
    var p = projets.find(function (x) { return x.id === (b.dataset.modifier || b.dataset.supprimer); });
    if (!p) return;
    if (b.dataset.modifier) { remplirFormulaire(p); return; }
    if (!confirm('Supprimer « ' + p.titre + ' » de l’agenda ?')) return;
    b.disabled = true;
    var r = await sb.from('agenda_projets').delete().eq('id', p.id).select('id');
    if (r.error || !r.data || !r.data.length) {
      b.disabled = false;
      message(r.error ? 'Erreur : ' + r.error.message : 'Rien n’a été supprimé : reconnectez-vous au tableau de bord puis réessayez.', true);
      return;
    }
    if ($('agenda-id').value === p.id) viderFormulaire();
    message('Projet supprimé.');
    await chargerProjets();
  });

  // Chargement au premier affichage de la rubrique (la session admin est alors ouverte).
  function siVisible() {
    if (!charge && section.classList.contains('tdb-actif')) charger().catch(function (e) {
      charge = false; // nouvel essai à la prochaine ouverture de la rubrique
      message('Impossible de charger l’agenda : ' + ((e && e.message) || String(e)), true);
    });
  }
  new MutationObserver(siVisible).observe(section, { attributes: true, attributeFilter: ['class'] });
  siVisible();
})();
