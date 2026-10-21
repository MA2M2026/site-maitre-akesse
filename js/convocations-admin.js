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
//  - Suivi : chaque envoi, son état, et les boutons « Ouvrir WhatsApp », « Annuler », « Réessayer ».
// Textes : js/messages-convocations.js (partagés avec le serveur).
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var panneau = $('convoc-panneau');
  window.ouvrirConvocations = function () {};
  if (!panneau || typeof sb === 'undefined' || !sb) return;

  var projet = null, personnes = [], envois = [], carnet = [], enCours = false;
  var STATUTS = { programme: '🕒 programmé', en_cours: '⏳ en cours', envoye: '✅ envoyé', echec: '❌ non envoyé', a_faire: '👉 à envoyer', annule: '— annulé' };
  var CANAUX = { email: '📧 E-mail', whatsapp: '💬 WhatsApp', sms: '📱 SMS' };
  var SORTES = { convocation: 'convocation', rappel: 'rappel de la veille' };

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
    return envois.some(function (e) { return e.participant_id === pers.participant_id && e.sorte === 'convocation' && ['envoye', 'programme', 'a_faire', 'en_cours'].indexOf(e.statut) >= 0; });
  }
  function nomDe(pers) { return pers.parent ? pers.nom + ' (parent : ' + (pers.parent_nom || 'Madame, Monsieur') + ')' : pers.nom; }

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
  function personneDuCarnet(c, sauve) {
    return avecSauve({ cle: 'c' + c.id, contact_id: c.id, externe: true,
      nom: [c.civilite, c.nom].filter(Boolean).join(' '), email: c.email || null, telephone: c.telephone || null, parent: false, parent_nom: null }, sauve);
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
      var details = document.createElement('small');
      details.textContent = [pers.email ? '📧 ' + pers.email : '', pers.telephone ? '💬 ' + pers.telephone : ''].filter(Boolean).join(' · ');
      t.appendChild(nom); t.appendChild(details);
      if (!pers.email || !pers.telephone) {
        var manque = document.createElement('small'); manque.className = 'convoc-manque';
        manque.textContent = !pers.email && !pers.telephone ? 'Aucune coordonnée : impossible de lui écrire.' : !pers.email ? 'Pas d’e-mail : WhatsApp seulement.' : 'Pas de WhatsApp : e-mail seulement.';
        t.appendChild(manque);
      }
      if (pers.reponse) { var rep = document.createElement('small'); rep.className = 'convoc-reponse-' + pers.reponse; rep.textContent = pers.reponse === 'confirme' ? '✅ A confirmé sa présence' : '❌ Ne pourra pas venir'; t.appendChild(rep); }
      if (dejaConvoque(pers)) { var deja = document.createElement('small'); deja.textContent = 'Déjà convoqué(e) : cochez pour renvoyer.'; t.appendChild(deja); }
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
      o.value = c.id; o.textContent = [c.civilite, c.nom].filter(Boolean).join(' ') + (c.telephone ? ' — ' + c.telephone : '');
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
    $('convoc-apercu').textContent = messageConvocation(projet, Object.assign({ jeton: '(lien personnel)' }, pers), 'convocation').texte;
  }

  // ---------- Réponses : qui a confirmé, qui ne viendra pas, qui n'a pas répondu ----------
  function dessinerReponses() {
    var boite = $('convoc-reponses');
    boite.textContent = '';
    var touches = personnes.filter(function (x) { return x.participant_id && envois.some(function (e) { return e.participant_id === x.participant_id && e.sorte === 'convocation' && e.statut !== 'annule'; }); });
    // un(e) mineur(e) et son parent comptent pour une seule personne : la réponse de l'un vaut pour les deux
    var parGroupe = {}, convoques = [];
    touches.forEach(function (x) {
      var g = x.groupe || x.cle, deja = parGroupe[g];
      if (!deja) { parGroupe[g] = x; convoques.push(x); return; }
      if (!deja.reponse && x.reponse) { convoques[convoques.indexOf(deja)] = x; parGroupe[g] = x; }
    });
    if (!convoques.length) return;
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
      if (g[0] !== 'confirme') d.open = true;
      var r = document.createElement('summary');
      r.textContent = g[1] + ' (' + g[2].length + ')';
      d.appendChild(r);
      g[2].forEach(function (pers) {
        var l = document.createElement('div');
        l.className = 'convoc-reponse';
        var n = document.createElement('span');
        n.textContent = nomDe(pers) + (pers.repondu_le ? ' — ' + quand(pers.repondu_le) : '');
        l.appendChild(n);
        // sans réponse : petit rappel WhatsApp avec son lien personnel
        var num = g[0] === 'attente' && pers.jeton && numeroWhatsApp(pers.telephone);
        if (num) {
          var a = document.createElement('a');
          a.className = 'btn-mini-admin'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Relancer sur WhatsApp';
          a.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent('Bonjour ' + (pers.parent ? pers.parent_nom || 'Madame, Monsieur' : pers.nom) + ',\n\nPouvez-vous nous confirmer ' + (pers.parent ? 'la présence de ' + pers.nom : 'votre présence') + ' pour « ' + projet.titre + ' » (' + dateLongue(projet.date_debut) + ') ? Un seul clic suffit : ' + LIEN_CONFIRMER + pers.jeton + '\n\nMerci !\nL’équipe Maître Akesse Model Management');
          l.appendChild(a);
        }
        d.appendChild(l);
      });
      boite.appendChild(d);
    });
  }

  // ---------- Suivi des envois ----------
  function dessinerSuivi() {
    dessinerReponses();
    var boite = $('convoc-suivi');
    boite.textContent = '';
    var visibles = envois.filter(function (e) { return e.statut !== 'annule'; });
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
      t.innerHTML = '<strong>' + echapperHtml(nomDe(pers)) + '</strong> · ' + CANAUX[e.canal] + ' · ' + SORTES[e.sorte]
        + '<br>' + STATUTS[e.statut] + ' — ' + (e.statut === 'envoye' && e.envoye_le ? 'le ' + echapperHtml(quand(e.envoye_le)) : 'prévu ' + echapperHtml(quand(e.prevu_le)))
        + (e.erreur && e.statut !== 'envoye' ? '<br><small class="convoc-manque">' + echapperHtml(e.erreur) + '</small>' : '');
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
      // 2. Les envois : convocation (à l'heure choisie) et rappel de la veille (si demandé et à venir)
      var rappel = projet.rappel_veille !== false ? heureRappel(projet.date_debut, projet.rappel_heure) : null;
      if (rappel && rappel <= prevu) rappel = null;
      var lignes = [];
      choisis.forEach(function (pers) {
        canaux.forEach(function (canal) {
          if (canal === 'email' ? !pers.email : !(pers.telephone && numeroWhatsApp(pers.telephone))) return;
          var base = { projet_id: projet.id, participant_id: pers.participant_id, canal: canal, tentatives: 0, envoye_le: null, erreur: null };
          lignes.push(Object.assign({}, base, { sorte: 'convocation', prevu_le: (maintenant ? new Date() : prevu).toISOString(),
            statut: maintenant ? (canal === 'email' ? 'en_cours' : 'a_faire') : 'programme',
            pris_le: maintenant ? new Date().toISOString() : null, tentatives: maintenant && canal === 'email' ? 1 : 0 }));
          if (rappel) lignes.push(Object.assign({}, base, { sorte: 'rappel', prevu_le: rappel.toISOString(), statut: 'programme' }));
        });
      });
      var rr = await sb.from('convocation_envois').upsert(lignes, { onConflict: 'participant_id,sorte,canal' }).select('*');
      if (rr.error) throw new Error(rr.error.message);
      var cles = {};
      (rr.data || []).forEach(function (e) { cles[e.id] = e; });
      envois = envois.filter(function (e) { return !cles[e.id]; }).concat(rr.data || []);
      dessinerSuivi();
      // 3. « Maintenant » : les e-mails partent tout de suite d'ici
      var nbEmails = lignes.filter(function (l) { return l.canal === 'email' && l.sorte === 'convocation'; }).length;
      var nbWa = lignes.filter(function (l) { return l.canal === 'whatsapp' && l.sorte === 'convocation'; }).length;
      var bilan;
      if (maintenant) {
        message('Envoi des e-mails…');
        var aEnvoyer = envois.filter(function (e) { return e.statut === 'en_cours' && e.canal === 'email' && e.sorte === 'convocation' && cles[e.id]; });
        var partis = await envoyerEmails(aEnvoyer);
        bilan = partis + ' e-mail(s) envoyé(s) sur ' + aEnvoyer.length + '.' + (nbWa ? ' ' + nbWa + ' WhatsApp prêt(s) : appuyez sur « Ouvrir WhatsApp » pour chacun, dans le suivi ci-dessous.' : '');
      } else {
        bilan = 'Programmé pour ' + quand(prevu) + ' : ' + nbEmails + ' e-mail(s) automatique(s)' + (nbWa ? ', ' + nbWa + ' WhatsApp à envoyer (vous serez prévenue par e-mail à l’heure prévue)' : '') + '.';
      }
      if (rappel) bilan += ' Rappel de la veille : ' + quand(rappel) + '.';
      if (sansMoyen.length) bilan += ' Sans coordonnée pour ce moyen d’envoi : ' + sansMoyen.map(function (x) { return x.nom; }).join(', ') + '.';
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
    $('convoc-rappel-info').textContent = rappel && rappel > new Date()
      ? '⏰ Rappel automatique la veille : ' + quand(rappel) + ' (réglable plus haut sur cette page).'
      : 'Pas de rappel la veille pour ce projet.';
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
    var parModele = {}, parContact = {};
    sauves.forEach(function (s) {
      if (s.model_id) parModele[s.model_id + ':' + !!s.parent] = s;
      if (s.contact_id) parContact[s.contact_id] = s;
    });
    (r[3].data || []).slice().sort(function (a, b) { return String(a.full_name).localeCompare(String(b.full_name), 'fr'); })
      .forEach(function (c) { personnes.push.apply(personnes, personnesMannequin(c, parModele)); });
    sauves.filter(function (s) { return s.contact_id; }).forEach(function (s) {
      var c = carnet.find(function (x) { return x.id === s.contact_id; });
      personnes.push(c ? personneDuCarnet(c, s) : avecSauve({ cle: 'p' + s.id, contact_id: s.contact_id, externe: true, nom: s.nom, email: s.email, telephone: s.telephone, parent: false }, s));
    });
    // une personne retirée du projet (mannequin décochée) mais déjà convoquée reste dans le suivi
    sauves.filter(function (s) { return s.model_id && !personnes.some(function (x) { return x.participant_id === s.id; }); }).forEach(function (s) {
      personnes.push(avecSauve({ cle: 'p' + s.id, model_id: s.model_id, externe: true, nom: s.nom, email: s.email, telephone: s.telephone, parent: s.parent, parent_nom: s.parent_nom }, s));
    });
    personnes.forEach(function (x) { x.coche = !dejaConvoque(x) && !!(x.email || x.telephone); });
    dessinerCarnet();
    dessinerParticipants();
    dessinerSuivi();
  };

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
    ajouterPersonne(personneDuCarnet(c, null));
  });
  // Personne non inscrite : enregistrée dans le carnet, puis ajoutée à la liste
  $('convoc-personne-ajouter').addEventListener('click', async function () {
    var nom = $('convoc-nom').value.trim(), tel = $('convoc-tel').value.trim(), email = $('convoc-email').value.trim();
    if (!nom) { message('Indiquez le nom de la personne.', true); $('convoc-nom').focus(); return; }
    if (!tel && !email) { message('Indiquez au moins son WhatsApp ou son e-mail.', true); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { message('Cette adresse e-mail ne semble pas correcte.', true); return; }
    this.disabled = true;
    var r = await sb.from('contacts_externes').insert({ civilite: $('convoc-civilite').value, nom: nom, telephone: tel || null, email: email || null }).select('*');
    this.disabled = false;
    if (r.error || !r.data || !r.data.length) { message('La personne n’a pas pu être enregistrée' + (r.error ? ' : ' + r.error.message : '.'), true); return; }
    carnet.push(r.data[0]);
    dessinerCarnet();
    ajouterPersonne(personneDuCarnet(r.data[0], null));
    ['convoc-nom', 'convoc-tel', 'convoc-email'].forEach(function (id) { $(id).value = ''; });
    message(nom + ' est ajouté(e) à la liste et au carnet.');
  });
})();
