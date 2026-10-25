// Tableau de bord — « Agenda du site » (06/10/2026, Extensions 124 et 125) : la
// propriétaire programme les projets de l'agence (défilé, show, shooting, casting,
// essayages, masterclass, rencontre…) avec leurs horaires jour par jour, le lieu, les
// intervenants (photographe, chorégraphe, styliste…), les partenaires (un nouveau
// partenaire s'enregistre sur place) et les mannequins. La page publique « Agenda » montre
// les jours, la ville, le lieu, les intervenants, les partenaires et les mannequins dont le
// profil est visible ; les horaires seulement si la case est cochée ; l'adresse exacte et
// les notes restent ici.
// Écran partagé (js/agenda-gabarit.js) : l'ancien tableau de bord le démarre tout seul et le
// charge à l'ouverture de la rubrique ; la nouvelle Administration appelle
// window.demarrerAgendaAdmin(racine) à chaque affichage de la page (chargement immédiat).
window.demarrerAgendaAdmin = function (racine) {
  var section = racine || document.querySelector('[data-section="b3c-agenda"]');
  var form = document.getElementById('agenda-form');
  if (!section || !form || typeof sb === 'undefined' || !sb) return;

  var $ = function (id) { return document.getElementById(id); };
  var charge = false, enCours = false, listesOk = false;
  var projets = [], mannequins = [], partenaires = [];
  var colonneAutres = false; // colonne « Autres mannequins » présente (Extension 137 collée)
  var colonnePartenairesLibres = false; // colonne « Autres partenaires » présente (Extension 138 collée)
  var convocationsActives = false; // tables des convocations présentes (Extension 141 collée)
  var projetEnCours = null; // projet ouvert avec « Modifier »

  function message(t, erreur) {
    afficherMessageFormulaire($('agenda-msg'), t, erreur);
  }
  function cochees(idConteneur) {
    return Array.prototype.map.call($(idConteneur).querySelectorAll('input[type=checkbox]:checked'), function (c) { return c.value; });
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
    if (jours.length === 60 && $('agenda-date-fin').value > jours[59]) {
      var note = document.createElement('p');
      note.className = 'agenda-aide';
      note.textContent = 'Activité très longue : les horaires se saisissent pour les 60 premiers jours ; précisez la suite dans les notes.';
      boite.appendChild(note);
    }
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
    return ligneDeuxChamps($('agenda-intervenants'), 'agenda-intervenant',
      { max: 60, liste: 'agenda-roles', placeholder: 'Rôle (ex : Photographe)', aria: 'Rôle de l’intervenant', valeur: role, cle: 'role' },
      { max: 120, placeholder: 'Nom', aria: 'Nom de l’intervenant', valeur: nom, cle: 'nom' });
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
    // nouvelle Administration : les mannequins se choisissent par leur photo (23/10/2026)
    var P = window.Portail, visages = P && P.photosCouverture ? await P.photosCouverture(mannequins.map(function (p) { return p.id; })).catch(function () { return {}; }) : null;
    var boiteM = $('agenda-mannequins'); boiteM.textContent = '';
    boiteM.classList.toggle('mur-visages', !!visages);
    mannequins.forEach(function (p) {
      var libelle = p.full_name + (p.published ? '' : ' (profil non publié)');
      boiteM.appendChild(visages ? caseVisage(p.id, libelle, 'agenda-mannequin', visages[p.id], p.full_name) : caseACocher(p.id, libelle, 'agenda-mannequin', p.full_name));
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

  // Même règle que la base (Extensions 137/138) : un nom n'apparaît qu'une fois, majuscules ignorées.
  function sansDoublon(noms) {
    var vus = {};
    return noms.filter(function (n) { var k = String(n).trim().toLowerCase(); if (vus[k]) return false; vus[k] = true; return true; });
  }

  // Ids d'un projet modifié absents des listes chargées (profil sans nom, partenaire retiré) :
  // gardés tels quels, pour qu'un enregistrement ne les efface jamais en silence.
  function idsGardes(coches, anciens, liste) {
    var connus = {};
    liste.forEach(function (x) { connus[x.id] = true; });
    return coches.concat((anciens || []).filter(function (id) { return !connus[id] && coches.indexOf(id) < 0; }));
  }

  // les mannequins inscrites : leur nom ouvre leur fiche (la photo vient se placer devant,
  // js/admin/coque.js) ; les noms écrits à la main restent du texte
  function nomsCliquables(p) {
    var vus = {};
    var liens = (p.mannequin_ids || []).map(function (id) {
      var m = mannequins.find(function (x) { return x.id === id; });
      if (!m || vus[m.full_name.toLowerCase()]) return null;
      vus[m.full_name.toLowerCase()] = true;
      return window.Portail ? '<a href="#/site/b2-mannequins-publies/' + echapperHtml(encodeURIComponent(id)) + '">' + echapperHtml(m.full_name) + '</a>' : echapperHtml(m.full_name);
    }).filter(Boolean);
    var libres = sansDoublon(p.mannequins_libres || []).filter(function (n) { return !vus[String(n).trim().toLowerCase()]; }).map(echapperHtml);
    return liens.concat(libres).join(', ');
  }

  function ligneProjet(p) {
    var div = document.createElement('div');
    div.className = 'agenda-ligne' + (p.visible && !p.annule ? '' : ' cache') + (projetEnCours && projetEnCours.id === p.id ? ' en-modif' : '');
    var noms = sansDoublon(nomsDe(p.mannequin_ids, mannequins, 'full_name').concat(p.mannequins_libres || []));
    var parts = sansDoublon(nomsDe(p.partenaire_ids, partenaires, 'nom').concat(p.partenaires_libres || []));
    var horaires = (p.seances || []).map(function (x) { return dateAgenda(x.jour) + ' ' + (x.debut || '?') + '–' + (x.fin || '?'); }).join(' ; ');
    var intervenants = (p.intervenants || []).map(function (x) { return (x.role ? x.role + ' : ' : '') + x.nom; });
    var prive = [horaires ? '' : p.heure, p.adresse, horaires && !p.horaires_publics ? horaires : '',
      p.heure_convocation ? 'convocation à ' + p.heure_convocation.replace(':', 'h') : ''].filter(Boolean).join(' · ');
    div.innerHTML =
      '<div class="agenda-date">' + echapperHtml(dateAgenda(p.date_debut, p.date_fin)) + '</div>'
      + '<div><span class="agenda-type">' + echapperHtml(libelleTypeAgenda(p.type)) + (p.visible ? '' : ' · caché du site') + (p.annule ? ' · ANNULÉ' : '') + '</span>'
      + '<h4>' + echapperHtml(p.titre) + '</h4>'
      + (p.ville || p.lieu ? '<p>' + echapperHtml([p.lieu, p.ville, p.pays].filter(Boolean).join(', ')) + '</p>' : '')
      + (horaires && p.horaires_publics ? '<p>Horaires : ' + echapperHtml(horaires) + '</p>' : '')
      + (intervenants.length ? '<p>' + echapperHtml(intervenants.join(' · ')) + '</p>' : '')
      + (parts.length ? '<p>Partenaires : ' + echapperHtml(parts.join(', ')) + '</p>' : '')
      + (noms.length ? '<p class="agenda-noms">Mannequins : ' + nomsCliquables(p) + '</p>' : '')
      + (prive ? '<p class="agenda-prive">🔒 ' + echapperHtml(prive) + '</p>' : '')
      + '</div>'
      + '<div class="agenda-boutons">'
      // « Convoquer » : projets à venir seulement (page Convocations, js/convocations-page.js)
      + (convocationsActives && !p.annule && (p.date_fin || p.date_debut) >= dateDuJour() ? '<button type="button" class="btn-mini-admin" data-convoquer="' + echapperHtml(p.id) + '" aria-label="Convoquer les participants de « ' + echapperHtml(p.titre) + ' »">📨 Convoquer</button>' : '')
      // « Cartes » : rubrique Cartes d'événement sur ce projet (js/cartes-acces.js)
      + (window.Portail && window.Portail.actions['cartes-acces'] && !p.annule && convocationsActives ? '<button type="button" class="btn-mini-admin" data-action="cartes-acces" data-id="' + echapperHtml(p.id) + '" aria-label="Cartes d’événement de « ' + echapperHtml(p.titre) + ' »">🎫 Cartes</button>' : '')
      + '<button type="button" class="btn-mini-admin" data-modifier="' + echapperHtml(p.id) + '" aria-label="Modifier « ' + echapperHtml(p.titre) + ' »">Modifier</button>'
      + '<button type="button" class="btn-mini-admin" data-supprimer="' + echapperHtml(p.id) + '" aria-label="Supprimer « ' + echapperHtml(p.titre) + ' »">Supprimer</button></div>';
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
    // convocations (Extension 141) : la table des envois répond-elle ?
    var essai = await sb.from('convocation_envois').select('id').limit(1);
    convocationsActives = !essai.error;
    colonneAutres = projets.some(function (p) { return 'mannequins_libres' in p; });
    colonnePartenairesLibres = projets.some(function (p) { return 'partenaires_libres' in p; });
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
    projetEnCours = null;
    $('agenda-visible').checked = true;
    $('agenda-pays').value = "Côte d'Ivoire";
    $('agenda-intervenants').textContent = '';
    dessinerSeances([]);
    $('agenda-enregistrer').textContent = 'Ajouter à l’agenda';
    $('agenda-annuler').hidden = true;
    $('agenda-en-cours').hidden = true;
    marquerLigne(null);
    filtrer('');
    majCompte();
  }

  // Projet en cours de modification : bandeau en haut du formulaire (titre + dates) et ligne
  // encadrée dans la liste, pour ne jamais modifier un projet à la place d'un autre
  // (11/10/2026 : « Modifier » d'Abidjan Border Forum pris pour celui de Cacao Fashion Show).
  function marquerLigne(id) {
    section.querySelectorAll('.agenda-ligne.en-modif').forEach(function (l) { l.classList.remove('en-modif'); });
    if (!id) return;
    var b = section.querySelector('[data-modifier="' + id + '"]');
    if (b) b.closest('.agenda-ligne').classList.add('en-modif');
  }

  function remplirFormulaire(p) {
    projetEnCours = p;
    $('agenda-id').value = p.id;
    $('agenda-type').value = p.type;
    $('agenda-titre').value = p.titre || '';
    $('agenda-date').value = p.date_debut || '';
    $('agenda-date-fin').value = p.date_fin || '';
    $('agenda-ville').value = p.ville || '';
    $('agenda-lieu').value = p.lieu || '';
    $('agenda-pays').value = p.pays || "Côte d'Ivoire";
    $('agenda-description').value = p.description || '';
    $('agenda-horaires-publics').checked = !!p.horaires_publics;
    dessinerSeances(p.seances || []);
    $('agenda-intervenants').textContent = '';
    (p.intervenants || []).forEach(function (x) { ajouterIntervenant(x.role, x.nom); });
    if (!(p.intervenants || []).length && p.photographe) ajouterIntervenant('Photographe', p.photographe);
    $('agenda-adresse').value = p.adresse || '';
    $('agenda-client').value = p.client || '';
    $('agenda-notes').value = p.notes_internes || '';
    $('agenda-visible').checked = !!p.visible;
    $('agenda-annule').checked = !!p.annule;
    $('agenda-autres').value = (p.mannequins_libres || []).join('\n');
    $('agenda-autres-partenaires').value = (p.partenaires_libres || []).join('\n');
    $('agenda-en-cours').textContent = '✏️ Vous modifiez : « ' + p.titre + ' » — ' + dateAgenda(p.date_debut, p.date_fin)
      + '. Vérifiez le titre et les dates avant d’enregistrer.';
    $('agenda-en-cours').hidden = false;
    marquerLigne(p.id);
    [['agenda-mannequins', p.mannequin_ids], ['agenda-partenaires', p.partenaire_ids]].forEach(function (z) {
      $(z[0]).querySelectorAll('input[type=checkbox]').forEach(function (c) { c.checked = (z[1] || []).includes(c.value); });
    });
    majCompte();
    $('agenda-enregistrer').textContent = 'Enregistrer les modifications';
    $('agenda-annuler').hidden = false;
    message('');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Noms écrits à la main (mannequins ou partenaires), un par ligne : espaces retirés, doublons
  // et lignes vides enlevés, 40 noms de 80 caractères au plus (limites de la base, Ext. 137/138).
  function lireAutres(idChamp) {
    var vus = {};
    return $(idChamp).value.split('\n').map(function (n) { return n.trim().slice(0, 80); })
      .filter(function (n) { var k = n.toLowerCase(); if (!n || vus[k]) return false; vus[k] = true; return true; })
      .slice(0, 40);
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
    var ligne = {
      type: $('agenda-type').value,
      titre: titre,
      date_debut: debut,
      date_fin: fin && fin !== debut ? fin : null,
      ville: $('agenda-ville').value.trim() || null,
      lieu: $('agenda-lieu').value.trim() || null,
      // Pays et « annulé » : Extension 136 (Parcours MA2M, bilan public calculé depuis l'agenda)
      pays: $('agenda-pays').value.trim() || "Côte d'Ivoire",
      annule: $('agenda-annule').checked,
      description: $('agenda-description').value.trim() || null,
      intervenants: lireIntervenants(),
      seances: lireSeances(),
      horaires_publics: $('agenda-horaires-publics').checked,
      // les horaires jour par jour remplacent l'ancien champ « Heure » (Extension 124)
      heure: lireSeances().length ? null : (projetEnCours && projetEnCours.heure) || null,
      adresse: $('agenda-adresse').value.trim() || null,
      client: $('agenda-client').value.trim() || null,  // (supabase-agenda-client.sql)
      notes_internes: $('agenda-notes').value.trim() || null,
      visible: $('agenda-visible').checked,
      mannequin_ids: idsGardes(cochees('agenda-mannequins'), projetEnCours && projetEnCours.mannequin_ids, mannequins),
      partenaire_ids: idsGardes(cochees('agenda-partenaires'), projetEnCours && projetEnCours.partenaire_ids, partenaires)
    };
    // « Autres mannequins » (Extension 137) : envoyé seulement si la colonne existe déjà
    // (vue dans les projets chargés) ou si des noms sont écrits — sinon un agenda dont
    // l'Extension 137 n'est pas encore collée resterait utilisable.
    var autres = lireAutres('agenda-autres');
    if (autres.length || colonneAutres) ligne.mannequins_libres = autres;
    // « Autres partenaires » (Extension 138) : partenaires indirects, jamais ajoutés à la page
    // Partenaires ; même précaution tant que la colonne n'existe pas.
    // Un nom écrit qui est déjà l'un de nos partenaires : on le coche (logo et lien gardés)
    // au lieu de l'afficher comme partenaire indirect.
    var dejaPartenaires = [];
    var autresPartenaires = lireAutres('agenda-autres-partenaires').filter(function (n) {
      var connu = partenaires.find(function (x) { return String(x.nom || '').trim().toLowerCase() === n.toLowerCase(); });
      if (!connu) return true;
      if (ligne.partenaire_ids.indexOf(connu.id) < 0) ligne.partenaire_ids.push(connu.id);
      dejaPartenaires.push(connu.nom);
      return false;
    });
    if (autresPartenaires.length || colonnePartenairesLibres) ligne.partenaires_libres = autresPartenaires;
    var id = $('agenda-id').value;
    enCours = true;
    $('agenda-enregistrer').disabled = true;
    message('Enregistrement…');
    try {
      var r = id
        ? await sb.from('agenda_projets').update({ updated_at: new Date().toISOString(), ...ligne }).eq('id', id).select('id')
        : await sb.from('agenda_projets').insert(ligne).select('id');
      if (r.error) {
        var colonneManquante = /column|schema cache/i.test(r.error.message || '');
        message(colonneManquante && /mannequins_libres/.test(r.error.message || '')
          ? 'La case « Autres mannequins » n’est pas encore activée : collez l’Extension 137 dans Supabase, puis réessayez.'
          : colonneManquante && /partenaires_libres/.test(r.error.message || '')
            ? 'La case « Autres partenaires » n’est pas encore activée : collez l’Extension 138 dans Supabase, puis réessayez.'
            : 'Erreur : ' + r.error.message, true);
        return;
      }
      // Aucune ligne touchée = session expirée ou compte non admin : rien n'a été enregistré.
      if (!r.data || !r.data.length) { message('Rien n’a été enregistré : reconnectez-vous au tableau de bord puis réessayez.', true); return; }
      viderFormulaire();
      var visibleSite = ligne.visible ? ' Il est visible sur la page Agenda du site.' : ' Il est caché du site.';
      message((id ? 'Projet modifié.' : 'Projet ajouté à l’agenda.') + visibleSite
        + (dejaPartenaires.length ? ' « ' + dejaPartenaires.join(', ') + ' » fait déjà partie de vos partenaires : il a été coché.' : ''));
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
    // Sans la liste des partenaires, on ne peut pas éviter un doublon sur la page Partenaires.
    if (!listesOk) { message('Patientez : la liste des partenaires n’est pas encore chargée (ou rechargez la page).', true); return; }
    var existant = partenaires.find(function (x) { return String(x.nom || '').toLowerCase() === nom.toLowerCase(); });
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
    var b = e.target.closest('[data-modifier], [data-supprimer], [data-convoquer]');
    if (!b) return;
    var p = projets.find(function (x) { return x.id === (b.dataset.modifier || b.dataset.supprimer || b.dataset.convoquer); });
    if (!p) return;
    if (b.dataset.modifier) { remplirFormulaire(p); return; }
    // « Convoquer » : panneau des convocations (js/convocations-admin.js)
    if (b.dataset.convoquer) { convoquerProjet(p.id); return; }
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
  if (racine) { charger().catch(function (e) { message('Impossible de charger l’agenda : ' + ((e && e.message) || String(e)), true); }); return; }
  function siVisible() {
    if (!charge && section.classList.contains('tdb-actif')) charger().catch(function (e) {
      charge = false; // nouvel essai à la prochaine ouverture de la rubrique
      message('Impossible de charger l’agenda : ' + ((e && e.message) || String(e)), true);
    });
  }
  new MutationObserver(siVisible).observe(section, { attributes: true, attributeFilter: ['class'] });
  siVisible();
};
if (document.querySelector('[data-section="b3c-agenda"]')) window.demarrerAgendaAdmin();
