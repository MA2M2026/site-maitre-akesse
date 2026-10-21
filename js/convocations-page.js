// Tableau de bord — page « 📨 Convocations » (21/10/2026, demande de la propriétaire) : une page à
// part, vierge à l'ouverture. On choisit un projet À VENIR de l'agenda (les projets passés ne sont
// plus proposés) ou « Nouveau projet » ; on remplit les informations de la convocation (heures,
// déroulé, « À prévoir », message), on coche les mannequins, puis « Enregistrer et passer à
// l'envoi » : le projet est enregistré dans l'agenda (créé s'il est nouveau) et le panneau d'envoi
// s'ouvre (js/convocations-admin.js : participants, aperçu, quand, suivi, réponses).
// Outils partagés avec l'Agenda : js/agenda-outils.js.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var section = document.querySelector('[data-section="b2-convocations"]');
  var form = $('cv-form');
  window.convoquerProjet = function () {};
  if (!section || !form || typeof sb === 'undefined' || !sb) return;

  var projets = [], mannequins = [], charge = false, enCours = false, actif = false, projetChoisi = null;

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
    mannequins.forEach(function (p) {
      boite.appendChild(caseACocher(p.id, p.full_name + (p.published ? '' : ' (profil non publié)'), 'cv-mannequin', p.full_name));
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
    form.querySelectorAll('input, select, textarea, button').forEach(function (c) { c.disabled = !actif; });
    if (!actif) return;
    var r = await Promise.all([
      sb.from('agenda_projets').select('*').order('date_debut', { ascending: true }),
      lireToutesLignes(function () { return sb.from('model_profiles').select('id, full_name, published').order('id'); })
    ]);
    if (r[0].error || r[1].error) { charge = false; message('Impossible de charger les projets ou les mannequins : ' + (r[0].error || r[1].error).message, true); return; }
    projets = r[0].data || [];
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

  // « 📨 Convoquer » d'un projet de l'Agenda : ouvre cette page avec le projet déjà choisi
  window.convoquerProjet = function (id) {
    projetChoisi = { id: id };
    var bouton = document.querySelector('.tdb-menu-item[data-tdb-cible="b2-convocations"]');
    if (bouton) bouton.click();
    if (charge) charger().catch(function (e) { message('Erreur : ' + ((e && e.message) || e), true); });
  };

  // Chargement au premier affichage de la page (la session admin est alors ouverte)
  function siVisible() {
    if (!charge && section.classList.contains('tdb-actif')) charger().catch(function (e) {
      charge = false;
      message('Impossible de charger la page : ' + ((e && e.message) || e), true);
    });
  }
  new MutationObserver(siVisible).observe(section, { attributes: true, attributeFilter: ['class'] });
  siVisible();
})();
