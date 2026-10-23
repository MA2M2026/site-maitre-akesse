// Tableau de bord — « Convoquer » un projet de l'agenda (Extension 141, 21/10/2026, demande de
// la propriétaire) : au lieu d'un message dans le groupe de l'agence, chaque participant reçoit
// SON message, avec toutes les informations (date, heure de convocation, lieu exact, programme,
// « À prévoir »).
//  - Participants : les mannequins cochés dans le projet (coordonnées lues par
//    convocation_contacts_mannequins ; parent pour un(e) mineur(e)) et des personnes non inscrites,
//    gardées dans le carnet (contacts_externes).
//  - Envoi : maintenant, dans 30 min / 1 h / 3 h, ou à une date précise ; rappel la veille si le
//    projet le demande. E-mail : automatique (tout de suite depuis ce navigateur, sinon par le
//    serveur du site à l'heure prévue, api/portail.js). WhatsApp : préparé, un appui par personne
//    (pas encore d'envoi automatique) ; l'agence est prévenue par e-mail à l'heure prévue. SMS : plus tard.
//  - Deux messages (23/10/2026) : « Annoncer la sélection » d'abord (court : projet, date, heure,
//    lieu, lien « Confirmez votre participation »), puis la convocation (tous les détails), puis
//    les relances. Même lien personnel : une réponse vaut pour les deux.
//  - Suivi : chaque envoi, son état, et les boutons « Ouvrir WhatsApp », « Annuler », « Réessayer ».
// Textes : js/messages-convocations.js (partagés avec le serveur).
// Deux maisons (22/10/2026) : démarré tout seul dans l'ancien tableau de bord ; la nouvelle
// Administration appelle window.demarrerConvocationsPanneau() à chaque affichage de l'écran.
window.ouvrirConvocations = function () {};
window.demarrerConvocationsPanneau = function () {
  var $ = function (id) { return document.getElementById(id); };
  var panneau = $('convoc-panneau');
  if (!panneau || typeof sb === 'undefined' || !sb) return;

  var projet = null, personnes = [], envois = [], carnet = [], enCours = false;
  var STATUTS = { programme: '🕒 programmé', en_cours: '⏳ en cours', envoye: '✅ envoyé', echec: '❌ non envoyé', a_faire: '👉 à envoyer', annule: '— annulé' };
  var CANAUX = { email: '📧 E-mail', whatsapp: '💬 WhatsApp', sms: '📱 SMS' };
  var SORTES = { selection: 'annonce de la sélection', convocation: 'convocation', rappel: 'rappel de la veille', rappel_avant: 'rappel avant l’événement' };
  // les deux premiers messages portent le lien de réponse : l'un ou l'autre compte comme « prévenu(e) »
  var PREVENU = ['selection', 'convocation'];
  // « Rappeler l'information » (menu, 23/10/2026) : le rappel (date, heure, lieu) envoyé à la main,
  // quand l'agence le décide ; il prend la place du rappel automatique « quelques jours avant »
  // de la même personne (jamais deux fois le même rappel)
  var sorteChoisie = function () { var v = $('convoc-sorte').value; return v === 'selection' || v === 'rappel_avant' ? v : 'convocation'; };

  // action lancée par un clic : une panne s'affiche au lieu de passer inaperçue
  function lancer(promesse) {
    promesse.catch(function (err) { message('Erreur : ' + ((err && err.message) || err), true); });
  }
  function message(t, erreur) {
    afficherMessageFormulaire($('convoc-msg'), t, erreur);
  }
  function quand(iso) {
    return new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function dejaConvoque(pers) {
    // (un rappel seulement programmé n'est pas encore parti : il peut être envoyé maintenant)
    var faits = sorteChoisie() === 'rappel_avant' ? ['envoye', 'a_faire', 'en_cours'] : ['envoye', 'programme', 'a_faire', 'en_cours'];
    return envois.some(function (e) { return e.participant_id === pers.participant_id && e.sorte === sorteChoisie() && faits.indexOf(e.statut) >= 0; });
  }
  // a déjà reçu l'annonce de la sélection ou la convocation
  function prevenue(pers) {
    return !!pers.participant_id && envois.some(function (e) { return e.participant_id === pers.participant_id && PREVENU.indexOf(e.sorte) >= 0 && e.statut !== 'annule'; });
  }
  function nomDe(pers) { return pers.parent ? pers.nom + ' (parent : ' + (pers.parent_nom || 'Madame, Monsieur') + ')' : pers.nom; }
  // nom d'une mannequin inscrite : lien vers sa fiche, sa photo vient se placer devant
  // (js/admin/coque.js, 23/10/2026) ; une personne non inscrite : son nom seul
  function nomCliquable(pers) {
    if (!pers.model_id || !window.Portail) { var s = document.createElement('span'); s.textContent = nomDe(pers); return s; }
    var a = document.createElement('a');
    a.href = '#/site/b2-mannequins-publies/' + encodeURIComponent(pers.model_id);
    a.textContent = nomDe(pers);
    return a;
  }

  // ---------- Participants ----------
  // Mannequin du projet, coordonnées à jour. Mineur(e) (demande du 21/10/2026) : SON message à
  // elle / lui (s'il a un téléphone ou un e-mail) ET le même programme à son parent (contactsEnvoi,
  // js/messages-candidats.js) : deux personnes dans la liste.
  function personnesMannequin(c, sauves) {
    var dossier = { full_name: c.full_name, category: c.category, date_naissance: c.date_naissance, email: c.contact_email, phone: c.phone,
      parent_nom: c.parent_nom, parent_telephone: c.parent_telephone, parent_email: c.parent_email };
    var dest = contactsEnvoi(dossier), nom = nomAvecCivilite(dossier), liste = [];
    if (!dest.parent || c.contact_email || c.phone) {
      liste.push(avecSauve({ cle: 'm' + c.model_id, groupe: c.model_id, model_id: c.model_id, nom: nom,
        email: c.contact_email || null, telephone: c.phone || null, parent: false, parent_nom: null }, sauves[c.model_id + ':false']));
    }
    if (dest.parent) {
      liste.push(avecSauve({ cle: 'm' + c.model_id + '-parent', groupe: c.model_id, model_id: c.model_id, nom: nom,
        email: dest.email || null, telephone: dest.phone || null, parent: true, parent_nom: dest.nom || null }, sauves[c.model_id + ':true']));
    }
    return liste;
  }
  // ce qui est déjà enregistré pour ce participant : lien personnel et réponse
  function avecSauve(pers, sauve) {
    if (sauve) { pers.participant_id = sauve.id; pers.jeton = sauve.jeton; pers.reponse = sauve.reponse; pers.repondu_le = sauve.repondu_le; }
    return pers;
  }
  // Personne du carnet (mannequin de l'agence sans compte, ou extérieure) : elle-même (si elle a
  // un WhatsApp ou un e-mail) et, si son parent est connu (23/10/2026), son parent aussi — même
  // programme, deux messages, une seule réponse pour les deux (groupe). parContact : ce qui est
  // déjà enregistré, par « contact:parent ».
  function personnesDuCarnet(c, parContact) {
    var nom = [c.civilite, c.nom].filter(Boolean).join(' '), liste = [], sauve = parContact || {};
    var avecParent = parentAPrevenir(c);  // (js/messages-candidats.js)
    if (c.telephone || c.email || !avecParent) {
      liste.push(avecSauve({ cle: 'c' + c.id, groupe: 'c' + c.id, contact_id: c.id, externe: true, nom: nom,
        email: c.email || null, telephone: c.telephone || null, parent: false, parent_nom: null }, sauve[c.id + ':false']));
    }
    if (avecParent) {
      liste.push(avecSauve({ cle: 'c' + c.id + '-parent', groupe: 'c' + c.id, contact_id: c.id, externe: true, nom: nom,
        email: null, telephone: c.parent_telephone, parent: true, parent_nom: c.parent_nom || null }, sauve[c.id + ':true']));
    }
    return liste;
  }

  function dessinerParticipants() {
    var boite = $('convoc-participants');
    boite.textContent = '';
    if (!personnes.length) { boite.textContent = 'Personne pour le moment : cochez des mannequins plus haut sur cette page, ou ajoutez une personne ci-dessous.'; }
    personnes.forEach(function (pers) {
      var l = document.createElement('label');
      l.className = 'convoc-personne';
      var c = document.createElement('input');
      c.type = 'checkbox'; c.checked = pers.coche; c.dataset.cle = pers.cle;
      c.setAttribute('aria-label', 'Convoquer ' + pers.nom);
      c.addEventListener('change', function () { pers.coche = c.checked; dessinerApercu(); });
      var t = document.createElement('span');
      var nom = document.createElement('strong'); nom.textContent = nomDe(pers);
      // la photo de la mannequin : la toucher coche ou décoche, comme le nom
      if (pers.model_id && window.Portail) { var v = document.createElement('span'); v.className = 'convoc-visage'; v.setAttribute('data-visage-profil', pers.model_id); v.dataset.nom = pers.nom; nom.prepend(v); }
      var details = document.createElement('small');
      details.textContent = [pers.email ? '📧 ' + pers.email : '', pers.telephone ? '💬 ' + pers.telephone : ''].filter(Boolean).join(' · ');
      t.appendChild(nom); t.appendChild(details);
      if (!pers.email || !pers.telephone) {
        var manque = document.createElement('small'); manque.className = 'convoc-manque';
        manque.textContent = !pers.email && !pers.telephone ? 'Aucune coordonnée : impossible de lui écrire.' : !pers.email ? 'Pas d’e-mail : WhatsApp seulement.' : 'Pas de WhatsApp : e-mail seulement.';
        t.appendChild(manque);
      }
      if (pers.reponse) { var rep = document.createElement('small'); rep.className = 'convoc-reponse-' + pers.reponse; rep.textContent = pers.reponse === 'confirme' ? '✅ A confirmé sa présence' : '❌ Ne pourra pas venir'; t.appendChild(rep); }
      if (dejaConvoque(pers)) { var deja = document.createElement('small'); deja.textContent = ({ selection: 'Sélection déjà annoncée', rappel_avant: 'Rappel déjà envoyé' }[sorteChoisie()] || 'Déjà convoqué(e)') + ' : cochez pour renvoyer.'; t.appendChild(deja); }
      l.appendChild(c); l.appendChild(t);
      if (pers.externe) {
        var x = document.createElement('button');
        x.type = 'button'; x.className = 'btn-mini-admin'; x.textContent = 'Retirer';
        x.setAttribute('aria-label', 'Retirer ' + pers.nom + ' de ce projet');
        x.addEventListener('click', function (e) { e.preventDefault(); lancer(retirer(pers)); });
        l.appendChild(x);
      } else l.appendChild(document.createElement('span'));
      boite.appendChild(l);
    });
    if ((projet.mannequins_libres || []).length) {
      var note = document.createElement('p');
      note.className = 'agenda-aide';
      note.textContent = 'Mannequins écrits à la main dans le projet (' + projet.mannequins_libres.join(', ') + ') : ajoutez-les ci-dessous comme personnes non inscrites, avec leur WhatsApp et leur e-mail, pour les convoquer.';
      boite.appendChild(note);
    }
    dessinerApercu();
  }

  async function retirer(pers) {
    if (pers.participant_id) {
      if (!confirm('Retirer ' + pers.nom + ' de ce projet ? Ses envois programmés sont annulés.')) return;
      var r = await sb.from('convocation_participants').delete().eq('id', pers.participant_id).select('id');
      if (r.error || !r.data || !r.data.length) { message(r.error ? 'Erreur : ' + r.error.message : 'Rien n’a été retiré : reconnectez-vous puis réessayez.', true); return; }
      envois = envois.filter(function (e) { return e.participant_id !== pers.participant_id; });
      dessinerSuivi();
    }
    personnes = personnes.filter(function (x) { return x !== pers; });
    dessinerParticipants();
  }

  function ajouterPersonne(pers) {
    if (personnes.some(function (x) { return x.cle === pers.cle; })) { message(pers.nom + ' est déjà dans la liste.'); return; }
    pers.coche = true;
    personnes.push(pers);
    dessinerParticipants();
  }

  function dessinerCarnet() {
    var s = $('convoc-carnet');
    while (s.options.length > 1) s.remove(1);
    carnet.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id; o.textContent = [c.civilite, c.nom].filter(Boolean).join(' ') + (c.mannequin_id ? ' (agence)' : ' (extérieure)') + (c.telephone ? ' — ' + c.telephone : '');
      s.appendChild(o);
    });
  }

  // ---------- Aperçu du message ----------
  function dessinerApercu() {
    var s = $('convoc-apercu-qui'), avant = s.value;
    s.textContent = '';
    var cochees = personnes.filter(function (x) { return x.coche; });
    var liste = cochees.length ? cochees : [{ cle: '', nom: 'Mademoiselle Prénom Nom' }];
    liste.forEach(function (pers) {
      var o = document.createElement('option'); o.value = pers.cle; o.textContent = 'Message pour ' + nomDe(pers);
      s.appendChild(o);
    });
    if (avant && liste.some(function (x) { return x.cle === avant; })) s.value = avant;
    var pers = liste.find(function (x) { return x.cle === s.value; }) || liste[0];
    $('convoc-apercu').textContent = messageConvocation(projet, Object.assign({ jeton: '(lien personnel)' }, pers), sorteChoisie()).texte;
  }

  // ---------- Réponses : qui a confirmé, qui ne viendra pas, qui n'a pas répondu ----------
  function dessinerReponses() { window.dessinerReponsesConvocation($('convoc-reponses'), projet, personnes, envois, false); }
  // Partagé avec « 📋 Voir les réponses » de la page Convocations (js/convocations-page.js) ;
  // toutOuvert : la liste des confirmés est ouverte elle aussi.
  window.dessinerReponsesConvocation = function (boite, projet, personnes, envois, toutOuvert, faitesIci) {
    boite.textContent = '';
    var touches = personnes.filter(function (x) { return x.participant_id && envois.some(function (e) { return e.participant_id === x.participant_id && PREVENU.indexOf(e.sorte) >= 0 && e.statut !== 'annule'; }); });
    // un(e) mineur(e) et son parent comptent pour une seule personne : la réponse de l'un vaut pour les deux
    var parGroupe = {}, convoques = [];
    touches.forEach(function (x) {
      var g = x.groupe || x.cle, deja = parGroupe[g];
      if (!deja) { parGroupe[g] = x; convoques.push(x); return; }
      if (!deja.reponse && x.reponse) { convoques[convoques.indexOf(deja)] = x; parGroupe[g] = x; }
    });
    if (!convoques.length) { boite.textContent = 'Personne n’a encore été convoqué pour ce projet.'; return false; }
    var groupes = [
      ['confirme', '✅ Confirmé', convoques.filter(function (x) { return x.reponse === 'confirme'; })],
      ['absent', '❌ Absent', convoques.filter(function (x) { return x.reponse === 'absent'; })],
      ['attente', '⏳ Sans réponse', convoques.filter(function (x) { return !x.reponse; })]
    ];
    var titre = document.createElement('p');
    titre.className = 'convoc-chiffres';
    titre.textContent = convoques.length + ' convoqué(s) · ' + groupes.map(function (g) { return g[2].length + ' ' + g[1].replace(/^\S+ /, '').toLowerCase(); }).join(' · ');
    boite.appendChild(titre);
    var barre = document.createElement('div');
    barre.className = 'convoc-barre';
    barre.setAttribute('role', 'img');
    barre.setAttribute('aria-label', titre.textContent);
    groupes.forEach(function (g) {
      if (!g[2].length) return;
      var part = document.createElement('span');
      part.className = 'convoc-barre-' + g[0];
      part.style.width = (100 * g[2].length / convoques.length) + '%';
      barre.appendChild(part);
    });
    boite.appendChild(barre);
    groupes.forEach(function (g) {
      if (!g[2].length) return;
      var d = document.createElement('details');
      d.className = 'convoc-groupe';
      // la liste des confirmés reste ouverte pendant la tournée de rappels
      if (toutOuvert || g[0] !== 'confirme' || (faitesIci && faitesIci.rappel)) d.open = true;
      var r = document.createElement('summary');
      r.textContent = g[1] + ' (' + g[2].length + ')';
      d.appendChild(r);
      var tournee = g[0] === 'attente' ? 'relance' : g[0] === 'confirme' ? 'rappel' : null;
      if (tournee) ajouterTournee(tournee, d, boite, projet, personnes, envois, toutOuvert, g[2], faitesIci);
      g[2].forEach(function (pers) {
        var l = document.createElement('div');
        l.className = 'convoc-reponse';
        l.appendChild(nomCliquable(pers));
        if (pers.repondu_le) { var quandRep = document.createElement('span'); quandRep.textContent = ' — ' + quand(pers.repondu_le); l.appendChild(quandRep); }
        if (tournee && faites(projet, tournee, faitesIci)[pers.participant_id]) {
          var fait = document.createElement('small'); fait.textContent = tournee === 'relance' ? '✓ relancé(e)' : '✓ rappel envoyé'; l.appendChild(fait);
        }
        d.appendChild(l);
      });
      boite.appendChild(d);
    });
    return true;
  };

  // ---------- Relance des personnes sans réponse (22/10/2026) et rappel aux confirmés (23/10/2026) ----------
  // Un seul bouton par liste, comme « Envoyer le WhatsApp suivant » : chaque appui ouvre WhatsApp
  // pour la personne suivante (relance : avec son lien personnel ; rappel : date, heure, lieu).
  // Seulement pour celles dont le message est vraiment parti (pas pour un envoi encore
  // programmé). Ce qui est fait est retenu dans ce navigateur le temps de la session
  // (« ma2m_relances_<projet> », « ma2m_rappels_<projet> ») ; faitesIci le garde aussi quand le
  // stockage est bloqué : { relance: {…}, rappel: {…} }.
  var TOURNEES = {
    relance: { cle: 'ma2m_relances_', classe: 'convoc-relance', bouton: '💬 Relancer la suivante : ', message: messageRelance,
      avant: 'La relance sera possible une fois la convocation envoyée.', sansNumero: 'Les personnes restantes n’ont pas de numéro WhatsApp : relancez-les par téléphone ou par e-mail.',
      fini: 'Toutes les personnes sans réponse ont été relancées.' },
    rappel: { cle: 'ma2m_rappels_', classe: 'convoc-rappel', bouton: '🔔 Rappel à la suivante : ', message: messageRappel,
      avant: 'Le rappel sera possible une fois la convocation envoyée.', sansNumero: 'Les personnes restantes n’ont pas de numéro WhatsApp : rappelez-les par téléphone ou par e-mail.',
      fini: 'Toutes les personnes qui ont confirmé ont reçu le rappel.' }
  };
  function faites(p, tournee, faitesIci) {
    if (faitesIci && faitesIci[tournee]) return faitesIci[tournee];
    try { return JSON.parse(sessionStorage.getItem(TOURNEES[tournee].cle + p.id) || '{}'); } catch (e) { return {}; }
  }
  function noterFaite(p, tournee, id, faitesIci) {
    var deja = Object.assign({}, faites(p, tournee, faitesIci));
    deja[id] = true;
    try { sessionStorage.setItem(TOURNEES[tournee].cle + p.id, JSON.stringify(deja)); } catch (e) { /* stockage bloqué : faitesIci le garde pour cet affichage */ }
    var maj = Object.assign({}, faitesIci || {});
    maj[tournee] = deja;
    return maj;
  }
  function lienTournee(tournee, p, pers) {
    var num = pers.jeton && numeroWhatsApp(pers.telephone);
    return num ? 'https://wa.me/' + num + '?text=' + encodeURIComponent(TOURNEES[tournee].message(p, pers)) : null;
  }
  function ajouterTournee(tournee, groupe, boite, p, personnes, envois, toutOuvert, liste, faitesIci) {
    var t = TOURNEES[tournee], deja = faites(p, tournee, faitesIci);
    // message vraiment parti : au moins un envoi fait, et plus aucun en attente (un WhatsApp
    // encore « à envoyer » passe d'abord par « Envoyer le WhatsApp suivant »)
    var partie = function (pers) {
      var siens = envois.filter(function (e) { return e.participant_id === pers.participant_id && PREVENU.indexOf(e.sorte) >= 0; });
      return siens.some(function (e) { return e.statut === 'envoye'; }) && !siens.some(function (e) { return ['programme', 'en_cours', 'a_faire'].indexOf(e.statut) >= 0; });
    };
    var restantes = liste.filter(function (pers) { return partie(pers) && !deja[pers.participant_id]; });
    var aFaire = restantes.filter(function (pers) { return lienTournee(tournee, p, pers); });
    if (!aFaire.length) {
      var note = document.createElement('p');
      note.className = 'agenda-aide';
      note.textContent = !liste.some(partie) ? t.avant : restantes.length ? t.sansNumero : t.fini;
      groupe.appendChild(note);
      return;
    }
    var suivante = aFaire[0];
    var a = document.createElement('a');
    a.className = 'btn btn--principal ' + t.classe; a.target = '_blank'; a.rel = 'noopener';
    a.href = lienTournee(tournee, p, suivante);
    a.textContent = t.bouton + nomDe(suivante) + ' (' + aFaire.length + ' restante' + (aFaire.length > 1 ? 's' : '') + ')';
    a.addEventListener('click', function () {
      var maj = noterFaite(p, tournee, suivante.participant_id, faitesIci);
      // après l'ouverture de WhatsApp : le bouton passe à la personne suivante
      setTimeout(function () { window.dessinerReponsesConvocation(boite, p, personnes, envois, toutOuvert, maj); }, 0);
    });
    groupe.appendChild(a);
  }

  // ---------- Suivi des envois ----------
  function dessinerSuivi() {
    dessinerReponses();
    var boite = $('convoc-suivi');
    boite.textContent = '';
    // (un rappel encore « à envoyer » à une personne qui a répondu « absent » n'est plus proposé)
    var absente = function (e) { var x = personnes.find(function (y) { return y.participant_id === e.participant_id; }); return x && x.reponse === 'absent' && /^rappel/.test(e.sorte) && e.statut === 'a_faire'; };
    var visibles = envois.filter(function (e) { return e.statut !== 'annule' && !absente(e); });
    if (!visibles.length) { boite.textContent = 'Aucun envoi pour ce projet pour le moment.'; return; }
    // Un seul bouton pour tous les WhatsApp arrivés à l'heure (comme « Messages groupés ») :
    // chaque appui ouvre WhatsApp pour la personne suivante, avec son message déjà écrit.
    var aFaire = visibles.filter(function (e) { return e.canal === 'whatsapp' && e.statut === 'a_faire' && lienWhatsApp(e); });
    if (aFaire.length) {
      var suivant = aFaire[0], persSuivante = personnes.find(function (x) { return x.participant_id === suivant.participant_id; });
      var a = document.createElement('a');
      a.className = 'btn btn--principal convoc-suivant'; a.target = '_blank'; a.rel = 'noopener';
      a.href = lienWhatsApp(suivant);
      a.textContent = '💬 Envoyer le WhatsApp suivant : ' + nomDe(persSuivante) + ' (' + aFaire.length + ' restant' + (aFaire.length > 1 ? 's' : '') + ')';
      a.addEventListener('click', function () { lancer(changerStatut(suivant, 'envoye')); });
      boite.appendChild(a);
    }
    visibles.sort(function (a, b) { return (a.statut === 'a_faire' ? -1 : 0) - (b.statut === 'a_faire' ? -1 : 0) || String(a.prevu_le).localeCompare(String(b.prevu_le)); });
    visibles.forEach(function (e) {
      var pers = personnes.find(function (x) { return x.participant_id === e.participant_id; }) || { nom: 'Participant retiré' };
      var l = document.createElement('div');
      l.className = 'convoc-envoi' + (e.statut === 'a_faire' ? ' a-faire' : '');
      var t = document.createElement('div');
      t.innerHTML = '<strong></strong> · ' + CANAUX[e.canal] + ' · ' + SORTES[e.sorte]
        + '<br>' + STATUTS[e.statut] + ' — ' + (e.statut === 'envoye' && e.envoye_le ? 'le ' + echapperHtml(quand(e.envoye_le)) : 'prévu ' + echapperHtml(quand(e.prevu_le)))
        + (e.erreur && e.statut !== 'envoye' ? '<br><small class="convoc-manque">' + echapperHtml(e.erreur) + '</small>' : '');
      t.querySelector('strong').appendChild(nomCliquable(pers));
      var actions = document.createElement('div');
      actions.className = 'convoc-actions';
      if (e.canal === 'whatsapp' && e.statut === 'a_faire' && lienWhatsApp(e)) {
        var a = document.createElement('a');
        a.className = 'btn-mini-admin'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Ouvrir WhatsApp';
        a.href = lienWhatsApp(e);
        a.dataset.envoi = e.id;
        a.addEventListener('click', function () { lancer(changerStatut(e, 'envoye')); });
        actions.appendChild(a);
      }
      if (e.canal === 'email' && e.statut === 'echec') actions.appendChild(bouton('Réessayer', function () { lancer(envoyerEmails([e])); }));
      if (e.statut === 'programme') actions.appendChild(bouton('Annuler', function () { lancer(changerStatut(e, 'annule')); }));
      l.appendChild(t); l.appendChild(actions);
      boite.appendChild(l);
    });
  }
  // lien wa.me avec le message de cette personne ('' sans numéro utilisable)
  function lienWhatsApp(e) {
    var pers = personnes.find(function (x) { return x.participant_id === e.participant_id; });
    var num = pers && numeroWhatsApp(pers.telephone);
    return num ? 'https://wa.me/' + num + '?text=' + encodeURIComponent(messageConvocation(projet, pers, e.sorte).texte) : '';
  }
  function bouton(texte, action) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn-mini-admin'; b.textContent = texte;
    b.addEventListener('click', action);
    return b;
  }
  async function changerStatut(e, statut) {
    var maj = { statut: statut };
    if (statut === 'envoye') maj.envoye_le = new Date().toISOString();
    var r = await sb.from('convocation_envois').update(maj).eq('id', e.id).select('id');
    if (r.error || !r.data || !r.data.length) { message(r.error ? 'Erreur : ' + r.error.message : 'Rien n’a été enregistré : reconnectez-vous puis réessayez.', true); return; }
    Object.assign(e, maj);
    dessinerSuivi(); dessinerParticipants();
  }

  // E-mails envoyés tout de suite depuis ce navigateur (EmailJS, comme « Messages groupés »),
  // un par un ; l'état de chaque envoi est enregistré.
  async function envoyerEmails(liste) {
    var ok = 0;
    for (var i = 0; i < liste.length; i++) {
      var e = liste[i];
      var pers = personnes.find(function (x) { return x.participant_id === e.participant_id; });
      var maj;
      try {
        await envoyerEmailCandidat({ to_email: pers.email, to_name: pers.parent ? pers.parent_nom || pers.nom : pers.nom, message: messageConvocation(projet, pers, e.sorte).email });
        maj = { statut: 'envoye', envoye_le: new Date().toISOString(), erreur: null };
        ok++;
      } catch (err) {
        maj = { statut: 'echec', erreur: String((err && (err.text || err.message)) || 'Envoi refusé').slice(0, 300) };
      }
      // le résultat DOIT être enregistré (sinon le serveur reprendrait l'envoi : e-mail en double)
      var enregistre = false;
      for (var essai = 0; essai < 3 && !enregistre; essai++) {
        var r = await sb.from('convocation_envois').update(maj).eq('id', e.id).select('id');
        enregistre = !r.error && r.data && r.data.length;
        if (!enregistre) await new Promise(function (ok) { setTimeout(ok, 1500); });
      }
      if (!enregistre) message('Attention : le résultat d’un envoi n’a pas pu être enregistré (connexion ?). Rechargez la page avant de renvoyer.', true);
      Object.assign(e, maj);
      if (i < liste.length - 1) await new Promise(function (r) { setTimeout(r, 1100); });
    }
    dessinerSuivi();
    return ok;
  }

  // ---------- Programmer l'envoi ----------
  function heureEnvoi() {
    var v = $('convoc-quand').value;
    // heure d'Abidjan (UTC), quel que soit le réglage de l'appareil
    if (v === 'date') { var d = $('convoc-date').value; return d ? new Date(d + ':00Z') : null; }
    return new Date(Date.now() + Number(v) * 60000);
  }

  async function programmer() {
    if (enCours) return;
    var sorte = sorteChoisie();
    var canaux = ['email', 'whatsapp'].filter(function (c) { return $('convoc-canal-' + c).checked; });
    var choisis = personnes.filter(function (x) { return x.coche; });
    var maintenant = $('convoc-quand').value === '0';
    var prevu = heureEnvoi();
    if (!choisis.length) { message('Cochez au moins une personne.', true); return; }
    if (!canaux.length) { message('Choisissez au moins un moyen d’envoi (e-mail ou WhatsApp).', true); return; }
    if (!prevu || isNaN(prevu)) { message('Choisissez la date et l’heure de l’envoi.', true); return; }
    if (!maintenant && prevu < new Date()) { message('Cette date est déjà passée : choisissez une heure à venir.', true); return; }
    var sansMoyen = choisis.filter(function (x) { return !canaux.some(function (c) { return c === 'email' ? x.email : x.telephone; }); });
    if (sansMoyen.length === choisis.length) { message('Aucune des personnes cochées n’a de coordonnée pour ce moyen d’envoi.', true); return; }
    enCours = true;
    $('convoc-programmer').disabled = true;
    message('Enregistrement…');
    try {
      // 1. Les participants (coordonnées recopiées à jour pour le serveur d'envoi)
      for (var i = 0; i < choisis.length; i++) {
        var pers = choisis[i];
        var ligne = { nom: pers.nom, email: pers.email, telephone: pers.telephone, parent: !!pers.parent, parent_nom: pers.parent_nom };
        var r = pers.participant_id
          ? await sb.from('convocation_participants').update(ligne).eq('id', pers.participant_id).select('id, jeton')
          : await sb.from('convocation_participants').insert(Object.assign({ projet_id: projet.id, model_id: pers.model_id || null, contact_id: pers.contact_id || null }, ligne)).select('id, jeton');
        if (r.error || !r.data || !r.data.length) throw new Error(r.error ? r.error.message : 'rien n’a été enregistré (reconnectez-vous)');
        pers.participant_id = r.data[0].id;
        pers.jeton = r.data[0].jeton;  // lien personnel « Je confirme ma présence »
      }
      // 2. Les envois : le message choisi (à l'heure choisie) et, avec la convocation, le rappel de
      // la veille (si demandé et à venir)
      var rappel = sorte === 'convocation' && projet.rappel_veille !== false ? heureRappel(projet.date_debut, projet.rappel_heure) : null;
      if (rappel && rappel <= prevu) rappel = null;
      // rappel automatique quelques jours avant (colonne rappel_avant, supabase-convocations.sql)
      var rappelAvant = sorte === 'convocation' && 'rappel_avant' in projet && projet.rappel_avant !== false ? heureRappelAvant(projet.date_debut, projet.rappel_avant_jours, projet.rappel_avant_heure) : null;
      if (rappelAvant && rappelAvant <= prevu) rappelAvant = null;
      var lignes = [];
      choisis.forEach(function (pers) {
        canaux.forEach(function (canal) {
          if (canal === 'email' ? !pers.email : !(pers.telephone && numeroWhatsApp(pers.telephone))) return;
          var base = { projet_id: projet.id, participant_id: pers.participant_id, canal: canal, tentatives: 0, envoye_le: null, erreur: null };
          lignes.push(Object.assign({}, base, { sorte: sorte, prevu_le: (maintenant ? new Date() : prevu).toISOString(),
            statut: maintenant ? (canal === 'email' ? 'en_cours' : 'a_faire') : 'programme',
            pris_le: maintenant ? new Date().toISOString() : null, tentatives: maintenant && canal === 'email' ? 1 : 0 }));
          if (rappel) lignes.push(Object.assign({}, base, { sorte: 'rappel', prevu_le: rappel.toISOString(), statut: 'programme' }));
          if (rappelAvant) lignes.push(Object.assign({}, base, { sorte: 'rappel_avant', prevu_le: rappelAvant.toISOString(), statut: 'programme' }));
        });
      });
      var rr = await sb.from('convocation_envois').upsert(lignes, { onConflict: 'participant_id,sorte,canal' }).select('*');
      if (rr.error) throw new Error(rr.error.message);
      var cles = {};
      (rr.data || []).forEach(function (e) { cles[e.id] = e; });
      envois = envois.filter(function (e) { return !cles[e.id]; }).concat(rr.data || []);
      dessinerSuivi();
      // 3. « Maintenant » : les e-mails partent tout de suite d'ici
      var nbEmails = lignes.filter(function (l) { return l.canal === 'email' && l.sorte === sorte; }).length;
      var nbWa = lignes.filter(function (l) { return l.canal === 'whatsapp' && l.sorte === sorte; }).length;
      var bilan;
      if (maintenant) {
        message('Envoi des e-mails…');
        var aEnvoyer = envois.filter(function (e) { return e.statut === 'en_cours' && e.canal === 'email' && e.sorte === sorte && cles[e.id]; });
        var partis = await envoyerEmails(aEnvoyer);
        bilan = partis + ' e-mail(s) envoyé(s) sur ' + aEnvoyer.length + '.' + (nbWa ? ' ' + nbWa + ' WhatsApp prêt(s) : appuyez sur le bouton rouge « 💬 Envoyer le WhatsApp suivant », dans le suivi ci-dessous.' : '');
      } else {
        bilan = 'Programmé pour ' + quand(prevu) + ' : ' + nbEmails + ' e-mail(s) automatique(s)' + (nbWa ? ', ' + nbWa + ' WhatsApp à envoyer (vous serez prévenue par e-mail à l’heure prévue)' : '') + '.';
      }
      if (rappelAvant) bilan += ' Rappel avant l’événement : ' + quand(rappelAvant) + '.';
      if (rappel) bilan += ' Rappel de la veille : ' + quand(rappel) + '.';
      if (sansMoyen.length) bilan += ' Sans coordonnée pour ce moyen d’envoi : ' + sansMoyen.map(function (x) { return x.nom; }).join(', ') + '.';
      if (sorte === 'selection') bilan += ' Ensuite, choisissez « 📨 Convocation » pour envoyer tous les détails.';
      if (sorte === 'rappel_avant') bilan += ' (Ce rappel remplace, pour ces personnes, le rappel automatique quelques jours avant ; le rappel de la veille reste prévu.)';
      choisis.forEach(function (x) { x.coche = false; });
      dessinerParticipants();
      message(bilan);
    } catch (e) {
      message('Rien n’a été programmé : ' + ((e && e.message) || e), true);
    } finally {
      enCours = false;
      $('convoc-programmer').disabled = false;
    }
  }

  // ---------- Ouverture du panneau ----------
  window.ouvrirConvocations = async function (p) {
    projet = p;
    personnes = []; envois = [];
    panneau.hidden = false;
    $('convoc-titre').textContent = '📨 Convoquer — « ' + p.titre + ' »';
    $('convoc-resume').textContent = [dateAgenda(p.date_debut, p.date_fin),
      p.heure_convocation ? 'convocation à ' + p.heure_convocation.replace(':', 'h') : 'heure de convocation non indiquée (à remplir plus haut sur cette page)',
      [p.lieu, p.ville].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
    var rappel = p.rappel_veille !== false ? heureRappel(p.date_debut, p.rappel_heure) : null;
    var rappelAvant = 'rappel_avant' in p && p.rappel_avant !== false ? heureRappelAvant(p.date_debut, p.rappel_avant_jours, p.rappel_avant_heure) : null;
    $('convoc-rappel-info').textContent = [
      rappelAvant && rappelAvant > new Date() ? '🔔 Rappel automatique avant l’événement : ' + quand(rappelAvant) + '.' : '',
      rappel && rappel > new Date() ? '⏰ Rappel automatique la veille : ' + quand(rappel) + '.' : 'Pas de rappel la veille pour ce projet.'
    ].filter(Boolean).join(' ') + ' (réglables plus haut sur cette page)';
    $('convoc-participants').textContent = 'Chargement…';
    $('convoc-suivi').textContent = '';
    message('');
    panneau.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var r = await Promise.all([
      sb.from('convocation_participants').select('*').eq('projet_id', p.id),
      sb.from('convocation_envois').select('*').eq('projet_id', p.id).order('prevu_le'),
      sb.from('contacts_externes').select('*').order('nom'),
      (p.mannequin_ids || []).length ? sb.rpc('convocation_contacts_mannequins', { p_ids: p.mannequin_ids }) : Promise.resolve({ data: [] })
    ]);
    var erreur = r.find(function (x) { return x.error; });
    if (erreur) { $('convoc-participants').textContent = 'Impossible de charger les participants : ' + erreur.error.message; return; }
    if (projet !== p) return;  // un autre projet a été ouvert entre-temps
    var sauves = r[0].data || [];
    envois = r[1].data || [];
    carnet = r[2].data || [];
    // fiche du carnet liée au registre : numéros, parent et date de naissance à jour (le carnet
    // en garde une copie faite une fois) ; avant supabase-places.sql : la copie du carnet
    var lies = carnet.filter(function (c) { return c.mannequin_id; });
    for (var i = 0; i < lies.length; i += 500) {
      var rr = await sb.rpc('places_contacts_registre', { p_ids: lies.slice(i, i + 500).map(function (c) { return c.mannequin_id; }) });
      (rr.data || []).forEach(function (m) {
        var c = carnet.find(function (x) { return x.mannequin_id === m.mannequin_id; });
        if (c) Object.assign(c, { telephone: m.phone || c.telephone, email: m.contact_email || c.email, parent_nom: m.parent_nom, parent_telephone: m.parent_telephone, date_naissance: m.date_naissance });
      });
    }
    if (projet !== p) return;
    var parModele = {}, parContact = {};
    sauves.forEach(function (s) {
      if (s.model_id) parModele[s.model_id + ':' + !!s.parent] = s;
      if (s.contact_id) parContact[s.contact_id + ':' + !!s.parent] = s;
    });
    (r[3].data || []).slice().sort(function (a, b) { return String(a.full_name).localeCompare(String(b.full_name), 'fr'); })
      .forEach(function (c) { personnes.push.apply(personnes, personnesMannequin(c, parModele)); });
    // les personnes du carnet déjà dans le projet (elle et, s'il est connu, son parent)
    sauves.filter(function (s) { return s.contact_id; }).forEach(function (s) {
      if (personnes.some(function (x) { return x.participant_id === s.id; })) return;
      var c = carnet.find(function (x) { return x.id === s.contact_id; });
      var siens = c ? personnesDuCarnet(c, parContact) : [];
      if (!siens.some(function (x) { return x.participant_id === s.id; })) {
        siens.push(avecSauve({ cle: 'p' + s.id, groupe: 'c' + s.contact_id, contact_id: s.contact_id, externe: true, nom: s.nom, email: s.email, telephone: s.telephone, parent: !!s.parent, parent_nom: s.parent_nom }, s));
      }
      siens.forEach(function (x) { if (!personnes.some(function (y) { return y.cle === x.cle; })) personnes.push(x); });
    });
    // une personne retirée du projet (mannequin décochée) mais déjà convoquée reste dans le suivi
    sauves.filter(function (s) { return s.model_id && !personnes.some(function (x) { return x.participant_id === s.id; }); }).forEach(function (s) {
      personnes.push(avecSauve({ cle: 'p' + s.id, model_id: s.model_id, externe: true, nom: s.nom, email: s.email, telephone: s.telephone, parent: s.parent, parent_nom: s.parent_nom }, s));
    });
    // quelqu'un n'a encore rien reçu (nouveau projet, ou mannequin ajoutée par les Places
    // limitées) : on propose d'annoncer la sélection ; sinon, la convocation
    // (écrans « Annoncer la sélection » et « Rappeler l'information » du menu : leur message à eux)
    $('convoc-sorte').value = window.convocationSorteImposee || (personnes.some(function (x) { return (x.email || x.telephone) && !prevenue(x); }) ? 'selection' : 'convocation');
    choisirSorte();
    dessinerCarnet();
    dessinerParticipants();
    dessinerSuivi();
  };

  // changer de message recoche les personnes qui ne l'ont pas encore reçu
  function choisirSorte() {
    var sorte = sorteChoisie(), selection = sorte === 'selection', rappel = sorte === 'rappel_avant';
    // rappel : seulement les personnes déjà prévenues, et jamais celles qui ont dit « absent »
    personnes.forEach(function (x) { x.coche = !dejaConvoque(x) && !!(x.email || x.telephone) && (!rappel || (prevenue(x) && x.reponse !== 'absent')); });
    $('convoc-sorte-aide').textContent = selection
      ? 'Message court : félicitations, le projet, la date, l’heure, le lieu, et le lien « Confirmez votre participation ». La convocation avec tous les détails suit plus tard.'
      : rappel ? 'Rappel de l’information : le projet, la date, l’heure de convocation et le lieu. Sont cochées les personnes déjà prévenues (sauf celles qui ne viennent pas) ; celles qui n’ont pas encore répondu reçoivent aussi leur lien pour confirmer.'
      : 'Tous les détails : heure de convocation, adresse, programme, « À prévoir », et le lien de confirmation.';
    $('convoc-rappel-info').hidden = selection || rappel;
    dessinerParticipants();
  }
  $('convoc-sorte').addEventListener('change', choisirSorte);
  $('convoc-apercu-qui').addEventListener('change', dessinerApercu);
  $('convoc-actualiser').addEventListener('click', function () { if (projet) lancer(window.ouvrirConvocations(projet)); });
  $('convoc-quand').addEventListener('change', function () {
    var date = this.value === 'date';
    $('convoc-date-champ').classList.toggle('u-hidden', !date);
    $('convoc-programmer').textContent = this.value === '0' ? 'Envoyer maintenant' : 'Programmer l’envoi';
    if (date && !$('convoc-date').value) {
      var d = new Date(Date.now() + 3600000), z = function (n) { return String(n).padStart(2, '0'); };
      $('convoc-date').value = d.getUTCFullYear() + '-' + z(d.getUTCMonth() + 1) + '-' + z(d.getUTCDate()) + 'T' + z(d.getUTCHours()) + ':' + z(d.getUTCMinutes());
    }
  });
  $('convoc-programmer').textContent = 'Envoyer maintenant';
  $('convoc-programmer').addEventListener('click', programmer);
  $('convoc-fermer').addEventListener('click', function () { panneau.hidden = true; projet = null; });
  $('convoc-carnet-ajouter').addEventListener('click', function () {
    var c = carnet.find(function (x) { return x.id === $('convoc-carnet').value; });
    if (!c) { $('convoc-carnet').focus(); return; }
    personnesDuCarnet(c, null).forEach(ajouterPersonne);
  });
  // Personne pas encore enregistrée : de l'agence (registre) ou extérieure (carnet), puis
  // ajoutée à la liste avec son parent s'il est indiqué (champsPersonne, js/agenda-outils.js)
  $('convoc-personne-ajouter').addEventListener('click', async function () {
    var bouton = this, c;
    bouton.disabled = true;
    try { c = await personneEnregistrer('convoc'); }
    catch (e) { message(window.Portail.erreurTexte(e), true); return; }
    finally { bouton.disabled = false; }
    carnet.push(c);
    dessinerCarnet();
    personnesDuCarnet(c, null).forEach(ajouterPersonne);
    message(c.nom + ' est ajouté(e) à la liste' + (c.mannequin_id ? ' et au registre de l’agence' : ' et aux mannequins extérieures') + (c.parent_telephone ? ', avec son parent' : '') + '.');
  });
};
window.demarrerConvocationsPanneau();
