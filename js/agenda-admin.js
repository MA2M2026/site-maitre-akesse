// Tableau de bord — « Agenda du site » (06/10/2026, Extension 124) : la propriétaire
// programme les projets de l'agence (shooting, défilé, casting, formation, événement)
// avec le photographe, les partenaires et les mannequins. La page publique « Agenda »
// en montre seulement le jour, la ville, le photographe, les partenaires et les
// mannequins dont le profil est visible ; l'heure, l'adresse et les notes restent ici.
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
    var prive = [p.heure, p.adresse].filter(Boolean).join(' · ');
    div.innerHTML =
      '<div class="agenda-date">' + echapperHtml(dateAgenda(p.date_debut, p.date_fin)) + '</div>'
      + '<div><span class="agenda-type">' + echapperHtml(libelleTypeAgenda(p.type)) + (p.visible ? '' : ' · caché du site') + '</span>'
      + '<h4>' + echapperHtml(p.titre) + '</h4>'
      + (p.ville ? '<p>' + echapperHtml(p.ville) + '</p>' : '')
      + (p.photographe ? '<p>Photographe : ' + echapperHtml(p.photographe) + '</p>' : '')
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
    $('agenda-photographe').value = p.photographe || '';
    $('agenda-description').value = p.description || '';
    $('agenda-heure').value = p.heure || '';
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
    var ligne = {
      type: $('agenda-type').value,
      titre: titre,
      date_debut: debut,
      date_fin: fin && fin !== debut ? fin : null,
      ville: $('agenda-ville').value.trim() || null,
      photographe: $('agenda-photographe').value.trim() || null,
      description: $('agenda-description').value.trim() || null,
      heure: $('agenda-heure').value.trim() || null,
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
      var visibleSite = ligne.visible ? ' Il est visible sur la page Agenda du site.' : '';
      message(id ? 'Projet modifié.' : 'Projet ajouté à l’agenda.' + visibleSite);
      await chargerProjets();
    } finally {
      enCours = false;
      $('agenda-enregistrer').disabled = false;
    }
  });

  $('agenda-annuler').addEventListener('click', function () { viderFormulaire(); message(''); });
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
    if (!charge && section.classList.contains('tdb-actif')) charger().catch(function (e) { message('Impossible de charger l’agenda : ' + (e && e.message), true); });
  }
  new MutationObserver(siVisible).observe(section, { attributes: true, attributeFilter: ['class'] });
  siVisible();
})();
