// Tableau de bord — page « 📨 Convocations » (21/10/2026, demande de la propriétaire) : une page à
// part, vierge à l'ouverture. On choisit un projet À VENIR de l'agenda (les projets passés ne sont
// plus proposés) ou « Nouveau projet » ; on remplit les informations de la convocation (heures,
// déroulé, « À prévoir », message), on coche les mannequins, puis « Enregistrer et passer à
// l'envoi » : le projet est enregistré dans l'agenda (créé s'il est nouveau) et le panneau d'envoi
// s'ouvre (js/convocations-admin.js : participants, aperçu, quand, suivi, réponses).
// En haut, « 📋 Voir les réponses » : choisir un projet déjà convoqué (même passé, le plus récent
// en premier) et voir qui a confirmé, qui ne viendra pas, qui n'a pas répondu, sans rien envoyer.
// Outils partagés avec l'Agenda : js/agenda-outils.js. Écran : js/convocations-gabarit.js.
// Deux maisons (22/10/2026) : l'ancien tableau de bord le démarre tout seul (écran présent dès le
// chargement) ; la nouvelle Administration (js/admin/site-convocations.js) appelle
// window.demarrerConvocationsPage(racine) chaque fois qu'elle affiche l'écran.
// avant le premier affichage de l'écran (nouvelle Administration) : ouvrir la rubrique avec ce projet
window.convoquerProjet = function (id) { window.convocationDemandee = id; location.hash = '#/site/b2-convocations'; };
window.demarrerConvocationsPage = function (racine) {
  var $ = function (id) { return document.getElementById(id); };
  var section = racine || document.querySelector('[data-section="b2-convocations"]');
  var form = $('cv-form');
  if (!section || !form || typeof sb === 'undefined' || !sb) return;

  var visages = null;  // nouvelle Administration : { id: photo } pour choisir sur un mur de visages
  var projets = [], mannequins = [], charge = false, enCours = false, actif = false, projetChoisi = null, chargement = null;

  function message(t, erreur) {
    afficherMessageFormulaire($('cv-etat'), t, erreur);
  }
  function aVenir(p) { return !p.annule && (p.date_fin || p.date_debut) >= dateDuJour(); }

  function dessinerProjets(choisi) {
    var s = $('cv-projet');
    while (s.options.length > 1) s.remove(1);
    projets.filter(aVenir).forEach(function (p) {
      var o = document.createElement('option');
      o.value = p.id; o.textContent = dateAgenda(p.date_debut, p.date_fin) + ' — ' + p.titre;
      s.appendChild(o);
    });
    s.value = choisi || '';
  }

  function dessinerMannequins() {
    var boite = $('cv-mannequins');
    boite.textContent = '';
    boite.classList.toggle('mur-visages', !!visages);
    mannequins.forEach(function (p) {
      var libelle = p.full_name + (p.published ? '' : ' (profil non publié)');
      if (!visages) { boite.appendChild(caseACocher(p.id, libelle, 'cv-mannequin', p.full_name)); return; }
      // un visage par mannequin : on le touche pour le choisir (caseVisage, js/agenda-outils.js)
      boite.appendChild(caseVisage(p.id, libelle, 'cv-mannequin', visages[p.id], p.full_name));
    });
    if (!mannequins.length) boite.textContent = 'Aucun mannequin trouvé.';
    majCompte();
  }
  function cochees() {
    return Array.prototype.map.call($('cv-mannequins').querySelectorAll('input:checked'), function (c) { return c.value; });
  }
  function majCompte() {
    var n = cochees().length;
    $('cv-compte').textContent = n ? n + (n > 1 ? ' mannequins choisis' : ' mannequin choisi') : '';
  }

  // la base connaît-elle le rappel quelques jours avant ? (colonne présente sur les projets lus)
  function rappelAvantConnu() { return projets.some(function (x) { return 'rappel_avant' in x; }); }
  // Projet choisi dans la liste (ou vierge pour « Nouveau projet »)
  function remplir(p) {
    projetChoisi = p || null;
    var v = function (id, val) { $(id).value = val || ''; };
    $('cv-type').value = (p && p.type) || 'defile';
    v('cv-titre', p && p.titre); v('cv-date', p && p.date_debut); v('cv-date-fin', p && p.date_fin);
    v('cv-lieu', p && p.lieu); v('cv-ville', p && p.ville); v('cv-adresse', p && p.adresse);
    v('cv-heure-evenement', p && p.heure_evenement); v('cv-heure-convocation', p && p.heure_convocation);
    v('cv-a-prevoir', p && p.a_prevoir); v('cv-message', p && p.message_modele);
    $('cv-rappel').checked = !p || p.rappel_veille !== false;
    $('cv-rappel-heure').value = (p && p.rappel_heure) || '18:00';
    $('cv-rappel-avant').checked = !p || p.rappel_avant !== false;
    $('cv-rappel-avant-jours').value = String((p && p.rappel_avant_jours) || 3);
    if (!$('cv-rappel-avant-jours').value) $('cv-rappel-avant-jours').value = '3';
    $('cv-rappel-avant-heure').value = (p && p.rappel_avant_heure) || '10:00';
    // (rappel quelques jours avant : seulement quand la base le connaît, supabase-convocations.sql)
    $('cv-rappel-avant-ligne').hidden = !rappelAvantConnu();
    $('cv-visible').checked = !p || !!p.visible;
    $('cv-deroule').textContent = '';
    ((p && p.deroule) || []).forEach(function (x) { ajouterEtapeDeroule($('cv-deroule'), x.heure, x.activite); });
    var ids = (p && p.mannequin_ids) || [];
    $('cv-mannequins').querySelectorAll('input[type=checkbox]').forEach(function (c) { c.checked = ids.indexOf(c.value) >= 0; });
    majCompte();
    $('convoc-panneau').hidden = true;
    message('');
  }

  async function charger() {
    charge = true;
    var essai = await sb.from('convocation_envois').select('id').limit(1);
    actif = !essai.error;
    $('cv-inactif').hidden = actif;
    $('cv-voir-reponses').disabled = !actif;
    form.querySelectorAll('input, select, textarea, button').forEach(function (c) { c.disabled = !actif; });
    if (!actif) return;
    var r = await Promise.all([
      sb.from('agenda_projets').select('*').order('date_debut', { ascending: true }),
      lireToutesLignes(function () { return sb.from('model_profiles').select('id, full_name, published').order('id'); })
    ]);
    if (r[0].error || r[1].error) { charge = false; message('Impossible de charger les projets ou les mannequins : ' + (r[0].error || r[1].error).message, true); return; }
    projets = r[0].data || [];
    if (racine && window.Portail && window.Portail.photosCouverture) {
      visages = await window.Portail.photosCouverture((r[1].data || []).filter(function (p) { return p.published; }).map(function (p) { return p.id; })).catch(function () { return {}; });
    }
    mannequins = (r[1].data || []).filter(function (p) { return p.full_name; })
      .sort(function (a, b) { return a.full_name.localeCompare(b.full_name, 'fr'); });
    dessinerProjets(projetChoisi && projetChoisi.id);
    dessinerMannequins();
    remplir(projetChoisi && projets.find(function (p) { return p.id === projetChoisi.id; }));
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (enCours || !actif) return;
    var titre = $('cv-titre').value.trim(), debut = $('cv-date').value, fin = $('cv-date-fin').value || null;
    if (!titre || !debut) { message('Indiquez au moins un titre et une date.', true); return; }
    if (fin && fin < debut) { message('La date de fin doit être après la date de début.', true); return; }
    if ((fin || debut) < dateDuJour()) { message('Cette date est déjà passée : une convocation se prépare pour un projet à venir.', true); return; }
    // les mannequins du projet qui ne sont pas dans la liste (profil sans nom) sont gardés
    var connus = {};
    mannequins.forEach(function (m) { connus[m.id] = true; });
    var ids = cochees().concat(((projetChoisi && projetChoisi.mannequin_ids) || []).filter(function (id) { return !connus[id]; }));
    var ligne = {
      type: $('cv-type').value, titre: titre, date_debut: debut, date_fin: fin && fin !== debut ? fin : null,
      lieu: $('cv-lieu').value.trim() || null, ville: $('cv-ville').value.trim() || null, adresse: $('cv-adresse').value.trim() || null,
      heure_evenement: $('cv-heure-evenement').value || null, heure_convocation: $('cv-heure-convocation').value || null,
      deroule: lireDeroule($('cv-deroule')), a_prevoir: $('cv-a-prevoir').value.trim() || null,
      rappel_veille: $('cv-rappel').checked, rappel_heure: $('cv-rappel-heure').value || '18:00',
      message_modele: $('cv-message').value.trim() || null, visible: $('cv-visible').checked, mannequin_ids: ids
    };
    if (rappelAvantConnu()) Object.assign(ligne, { rappel_avant: $('cv-rappel-avant').checked, rappel_avant_jours: Number($('cv-rappel-avant-jours').value) || 3, rappel_avant_heure: $('cv-rappel-avant-heure').value || '10:00' });
    enCours = true;
    $('cv-enregistrer').disabled = true;
    message('Enregistrement…');
    try {
      var r = projetChoisi
        ? await sb.from('agenda_projets').update(Object.assign({ updated_at: new Date().toISOString() }, ligne)).eq('id', projetChoisi.id).select('*')
        : await sb.from('agenda_projets').insert(ligne).select('*');
      if (r.error) { message('Erreur : ' + r.error.message, true); return; }
      if (!r.data || !r.data.length) { message('Rien n’a été enregistré : reconnectez-vous puis réessayez.', true); return; }
      var p = r.data[0];
      var nouveau = !projetChoisi;
      projets = projets.filter(function (x) { return x.id !== p.id; }).concat([p]).sort(function (a, b) { return String(a.date_debut).localeCompare(String(b.date_debut)); });
      dessinerProjets(p.id);
      projetChoisi = p;
      message(nouveau ? 'Projet ajouté à l’agenda' + (p.visible ? ' (visible sur le site, sans les noms des mannequins).' : ' (caché du site).') + ' Choisissez maintenant les participants et l’envoi ci-dessous.'
        : 'Projet enregistré. Choisissez maintenant les participants et l’envoi ci-dessous.');
      Promise.resolve(window.ouvrirConvocations(p)).catch(function (err) { message('Erreur : ' + ((err && err.message) || err), true); });
    } finally {
      enCours = false;
      $('cv-enregistrer').disabled = false;
    }
  });

  $('cv-projet').addEventListener('change', function () {
    remplir(projets.find(function (p) { return p.id === $('cv-projet').value; }));
  });
  $('cv-ajouter-etape').addEventListener('click', function () { ajouterEtapeDeroule($('cv-deroule'), '', '').focus(); });
  $('cv-message-type').addEventListener('click', function () {
    var t = $('cv-message');
    if (t.value.trim() && !confirm('Remplacer votre message par le message type ?')) return;
    t.value = MODELE_CONVOCATION;
  });
  $('cv-recherche').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    $('cv-mannequins').querySelectorAll('label').forEach(function (l) { l.hidden = !!q && !l.dataset.nom.includes(q); });
  });
  $('cv-mannequins').addEventListener('change', majCompte);
  Object.keys(MA2M_TYPES_AGENDA).forEach(function (cle) {
    var o = document.createElement('option');
    o.value = cle; o.textContent = libelleTypeAgenda(cle);
    $('cv-type').appendChild(o);
  });
  $('cv-type').value = 'defile';

  // ---------- « 📋 Voir les réponses » ----------
  async function projetsConvoques() {
    var r = await lireToutesLignes(function () { return sb.from('convocation_envois').select('projet_id').in('sorte', ['selection', 'convocation']).neq('statut', 'annule').order('id'); });
    if (r.error) { $('cv-reponses').textContent = 'Impossible de charger les projets : ' + r.error.message; return; }
    var ids = {};
    r.data.forEach(function (e) { ids[e.projet_id] = true; });
    var s = $('cv-reponses-projet'), avant = s.value;
    while (s.options.length > 1) s.remove(1);
    projets.filter(function (p) { return ids[p.id]; })
      .sort(function (a, b) { return String(b.date_debut).localeCompare(String(a.date_debut)); })
      .forEach(function (p) {
        var o = document.createElement('option');
        o.value = p.id; o.textContent = dateAgenda(p.date_debut, p.date_fin) + ' — ' + p.titre;
        s.appendChild(o);
      });
    s.value = avant;
    if (s.options.length < 2) $('cv-reponses').textContent = 'Aucun projet n’a encore reçu de convocation.';
  }
  async function afficherReponses() {
    var boite = $('cv-reponses'), id = $('cv-reponses-projet').value;
    var p = projets.find(function (x) { return x.id === id; });
    $('cv-reponses-actualiser').hidden = !p;
    if (!p) { boite.textContent = ''; return; }
    boite.textContent = 'Chargement…';
    var r = await Promise.all([
      sb.from('convocation_participants').select('*').eq('projet_id', id),
      sb.from('convocation_envois').select('participant_id, sorte, statut').eq('projet_id', id)
    ]);
    if ($('cv-reponses-projet').value !== id) return;  // un autre projet a été choisi entre-temps
    var erreur = r.find(function (x) { return x.error; });
    if (erreur) { boite.textContent = 'Impossible de charger les réponses : ' + erreur.error.message; return; }
    // un(e) mineur(e) et son parent ont le même model_id : une seule personne dans les réponses
    var personnes = (r[0].data || []).map(function (x) {
      return { cle: 'p' + x.id, groupe: x.model_id || 'p' + x.id, model_id: x.model_id, participant_id: x.id, nom: x.nom, telephone: x.telephone,
        parent: x.parent, parent_nom: x.parent_nom, jeton: x.jeton, reponse: x.reponse, repondu_le: x.repondu_le };
    }).sort(function (a, b) { return String(a.nom).localeCompare(String(b.nom), 'fr'); });
    window.dessinerReponsesConvocation(boite, p, personnes, r[1].data || [], true);
  }
  function erreurReponses(e) { $('cv-reponses').textContent = 'Erreur : ' + ((e && e.message) || e); }
  $('cv-voir-reponses').addEventListener('click', function () {
    var bloc = $('cv-reponses-bloc'), ouvrir = bloc.hidden;
    bloc.hidden = !ouvrir;
    this.setAttribute('aria-expanded', String(ouvrir));
    if (ouvrir) Promise.resolve(chargement).then(projetsConvoques).catch(erreurReponses);
  });
  $('cv-reponses-projet').addEventListener('change', function () { afficherReponses().catch(erreurReponses); });
  $('cv-reponses-actualiser').addEventListener('click', function () { afficherReponses().catch(erreurReponses); });

  // « 📨 Convoquer » d'un projet de l'Agenda : ouvre cette page avec le projet déjà choisi
  // (nouvelle Administration : l'adresse de la rubrique ; le projet attend dans convocationDemandee)
  window.convoquerProjet = function (id) {
    projetChoisi = { id: id };
    var bouton = document.querySelector('.tdb-menu-item[data-tdb-cible="b2-convocations"]');
    if (bouton) bouton.click();
    else { window.convocationDemandee = id; location.hash = '#/site/b2-convocations'; return; }
    if (charge) chargement = charger().catch(function (e) { message('Erreur : ' + ((e && e.message) || e), true); });
  };

  // Chargement au premier affichage de la page (la session admin est alors ouverte) ; dans la
  // nouvelle Administration, l'écran n'est affiché que quand on l'ouvre : chargement immédiat
  function siVisible() {
    if (!charge && (racine || section.classList.contains('tdb-actif'))) chargement = charger().catch(function (e) {
      charge = false;
      message('Impossible de charger la page : ' + ((e && e.message) || e), true);
    });
  }
  if (racine && window.convocationDemandee) { projetChoisi = { id: window.convocationDemandee }; window.convocationDemandee = null; }
  if (!racine) new MutationObserver(siVisible).observe(section, { attributes: true, attributeFilter: ['class'] });
  siVisible();
};
window.demarrerConvocationsPage();
