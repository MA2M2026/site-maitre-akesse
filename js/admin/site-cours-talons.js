// Nouvelle Administration — « Cours de talons » (Atelier Talons & Élégance, 08/11/2026, demande de la propriétaire).
// Les inscriptions de la page publique cours-talons.html (table cours_talons, supabase-cours-talons.sql) :
// liste par statut, photos et vidéo de la marche (Google Drive), lien de paiement Wave envoyé sur WhatsApp,
// validation du paiement (cours_talons_valider : statut « inscrite » + recette « Cours de talons » en Compta,
// une seule fois), date de séance et notes, « terminée » ou « annulée ». Rien n'est jamais effacé.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const PAGE = 'b2-cours-talons';
  // nom du moyen de paiement choisi par la personne (js/moyens-paiement.js) ; Wave quand rien n'est noté
  const nomMoyen = (k) => (window.MoyensPaiement ? window.MoyensPaiement.nom(k || 'wave') : 'Wave');
  const FORMULES = { groupe: 'En groupe (4 dimanches)', prive_salle: 'Privé, dans la salle', prive_exterieur: 'Privé, à l’extérieur' };
  const STATUTS = { nouvelle: ['Nouvelle', 'neutre'], plus_tard: ['Paiera plus tard', 'orange'], paiement_envoye: ['Paiement envoyé, à vérifier', 'orange'],
    inscrite: ['Inscrite (payé)', 'vert'], terminee: ['Terminée', 'neutre'], annulee: ['Annulée', 'rouge'] };
  const OBJECTIFS = { miss: 'Concours de Miss', beaute: 'Concours de beauté', elegance: 'Élégance, prestance', evenement: 'Événement', autre: 'Autre' };
  const NIVEAUX = { debutante: 'Débutante', un_peu: 'Marche un peu en talons', a_l_aise: 'Déjà à l’aise' };
  const FILTRES = [['a_traiter', 'À traiter'], ['inscrite', 'Inscrites'], ['terminee', 'Terminées'], ['annulee', 'Annulées'], ['toutes', 'Toutes']];
  const A_TRAITER = ['nouvelle', 'plus_tard', 'paiement_envoye'];
  let filtre = 'a_traiter';
  let lignes = [];
  // (seulement des adresses https : la base les contrôle aussi)
  const https = (u) => typeof u === 'string' && /^https:\/\/[^\s"<>]+$/.test(u);
  const photosDe = (d) => (d && Array.isArray(d.photos) ? d.photos : []).filter(https);
  const pasInstallee = P.pasActivee('cours_talons');
  // (14/11/2026) « Mon programme » : les séances de chaque élève (supabase-programme-talons.sql) et son lien personnel
  const programmePasInstalle = P.pasActivee('cours_talons_seances');
  const LIEN_PROGRAMME = 'https://www.maitreakessemodelmanagement.com/programme-talons?c=';
  const T = window.TalonsCommun;   // js/talons-commun.js (heures, mois, lieu de la salle, vouvoiement)
  const LIEU_SALLE = T.LIEU_SALLE;
  let seancesDe = {}, programmeAbsent = false;
  const quandSeance = (s) => { const a = new Date(s.debut), b = new Date(s.fin); const j = T.JOURS[a.getUTCDay()];
    return j.charAt(0).toUpperCase() + j.slice(1, 3) + '. ' + a.getUTCDate() + ' ' + T.MOIS_COURTS[a.getUTCMonth()] + ' · ' + T.heure(a) + ' – ' + T.heure(b); };
  const civilite = (d) => T.civilite(d.age) + ' ' + String(d.nom || '').trim();

  const seances = (d) => d.formule === 'groupe' ? '4 dimanches' : d.nb_seances + ' séance' + (d.nb_seances > 1 ? 's' : '');
  function messagePaiement(d) {
    const prenom = String(d.nom || '').trim().split(/\s+/)[0] || '';
    return 'Bonjour ' + prenom + ',\n\nMerci pour votre inscription à l’Atelier Talons & Élégance de Maître Akesse Model Management (' + FORMULES[d.formule] + ', ' + seances(d) + ').\n' +
      'Montant : ' + P.fcfa(d.montant) + '.\nVous pouvez régler par Wave avec ce lien :\n' + LIEN_WAVE_AGENCE + (d.montant || 0) + '\n\n' +
      (d.date_seance ? 'Votre première séance : le ' + P.date(d.date_seance) + '.\n\n' : '') + 'À très bientôt !\nMaître Akesse Model Management';
  }

  async function page() {
    try {
      lignes = await P.bd(sb.from('cours_talons').select('*').order('cree_le', { ascending: false }).limit(500));
    } catch (e) {
      if (!pasInstallee(e)) throw e;
      return P.entete('Cours de talons') + '<div class="carte"><h2>Pas encore activé</h2><p class="doux">Pour recevoir les inscriptions en ligne, collez le fichier <strong>supabase-cours-talons.sql</strong> dans Supabase (SQL Editor, puis Run). En attendant, la page publique propose aux personnes d’envoyer leur inscription sur WhatsApp.</p></div>';
    }
    // séances des élèves inscrites (« Son programme ») ; fichier pas encore collé : la fiche le dit, le reste marche
    // (toutes les séances d'un coup : une liste d'identifiants dans l'adresse dépasserait la limite avec des centaines d'élèves)
    seancesDe = {}; programmeAbsent = false;
    if (lignes.some((d) => d.statut === 'inscrite' || d.statut === 'terminee')) {
      try {
        const l = await P.bd(sb.from('cours_talons_seances').select('*').order('debut', { ascending: true }).limit(5000));
        (l || []).forEach((x) => { (seancesDe[x.inscription_id] = seancesDe[x.inscription_id] || []).push(x); });
      } catch (e) { if (!programmePasInstalle(e)) throw e; programmeAbsent = true; }
    }
    const compte = (f) => lignes.filter((d) => f === 'toutes' || (f === 'a_traiter' ? A_TRAITER.includes(d.statut) : d.statut === f)).length;
    const visibles = lignes.filter((d) => filtre === 'toutes' || (filtre === 'a_traiter' ? A_TRAITER.includes(d.statut) : d.statut === filtre));
    const encaisse = lignes.filter((d) => d.statut === 'inscrite' || d.statut === 'terminee').reduce((t, d) => t + (d.montant || 0), 0);
    const onglets = '<div class="ligne">' + FILTRES.map((f) => '<button type="button" class="btn petit' + (f[0] === filtre ? ' rouge' : '') + '" data-action="talons-filtre" data-valeur="' + f[0] + '">' +
      P.esc(f[1]) + ' (' + compte(f[0]) + ')</button>').join('') + '</div>';
    return P.entete('Cours de talons', '<a class="btn petit" href="/cours-talons" target="_blank" rel="noopener">Voir la page publique</a>') +
      '<p class="doux">Inscriptions à l’Atelier Talons &amp; Élégance (ouvert à toutes, sans intégrer l’agence). Groupe : 30 000 FCFA les 4 dimanches ; privé : 25 000 FCFA la séance en salle, 30 000 à 35 000 FCFA la séance à l’extérieur.</p>' +
      '<div class="chiffres">' + P.chiffre('À traiter', String(compte('a_traiter'))) + P.chiffre('Inscrites', String(compte('inscrite'))) + P.chiffre('Encaissé (inscrites et terminées)', P.fcfa(encaisse)) + '</div>' +
      '<div class="carte f">' + onglets + '</div>' +
      // (13/11/2026, demande de la propriétaire) regroupées par jour d'inscription, les plus récentes en haut, comme les castings
      (visibles.length ? P.parJour(visibles, (d) => d.cree_le).map((g) => '<section class="jour-groupe"><h2 class="jour-titre">' + P.esc(g.titre) +
        ' <span class="nb">' + g.elements.length + '</span></h2>' + g.elements.map(fiche).join('') + '</section>').join('') : '<div class="carte vide">Aucune inscription ici pour le moment.</div>');
  }

  function fiche(d) {
    const st = STATUTS[d.statut] || [d.statut, 'neutre'];
    const wa = numeroWhatsApp(d.telephone), waParent = numeroWhatsApp(d.parent_telephone);
    const photos = photosDe(d);
    const infos = [
      ['Formule', FORMULES[d.formule] + ' · ' + seances(d)], ['Montant', P.fcfa(d.montant)],
      // (13/11/2026) le moyen choisi par la personne (Orange Money, carte…), Wave sinon
      ['Paiement', d.decision === 'maintenant' ? 'Payé par ' + nomMoyen(d.moyen) + ' à l’inscription' + (d.reference_wave ? ' (réf. ' + d.reference_wave + ')' : '') + ', à vérifier' : 'Paiera plus tard'],
      ['Téléphone', d.telephone], ['Âge', d.age ? d.age + ' ans' : ''], ['Quartier', d.quartier],
      ['Objectif', [OBJECTIFS[d.objectif], d.concours, d.concours_date ? 'le ' + P.date(d.concours_date) : ''].filter(Boolean).join(' · ')],
      ['Niveau', NIVEAUX[d.niveau]], ['Lieu des cours', d.adresse], ['Disponibilités', d.disponibilites],
      ['Parent ou tuteur', d.parent_nom ? d.parent_nom + ' · ' + (d.parent_telephone || '') : ''], ['Inscrite le', P.dateHeure(d.cree_le)],
      ['Paiement validé', d.valide_le ? P.dateHeure(d.valide_le) : '']
    ].filter((x) => x[1]);
    // (13/11/2026, demande de la propriétaire) les photos AFFICHÉES dans la fiche, comme les candidatures casting
    // (P.visageDistant, js/admin/coque.js), qui s'agrandissent d'un appui ; la vidéo reste un bouton (Google Drive)
    const galerie = photos.length ? '<section class="galerie-dossier" aria-label="Photos">' + photos.map((u, i) =>
      '<figure class="photo-dossier"><button type="button" class="photo-ouvrir" data-action="talons-photo-voir" data-id="' + P.esc(d.id) + '" data-index="' + i + '" aria-label="Agrandir la photo ' + (i + 1) + '">' +
      P.visageDistant(u, d.nom) + '</button><figcaption><a class="doux petit-texte" href="' + P.esc(u) + '" target="_blank" rel="noopener noreferrer">Ouvrir dans Drive ↗</a></figcaption></figure>').join('') + '</section>' : '';
    const ouverte = !['terminee', 'annulee'].includes(d.statut);
    const payee = d.statut === 'inscrite' || d.statut === 'terminee';
    // (13/11/2026, « un peu trop désordonné ») les boutons regroupés en une rangée aérée, sous les photos :
    // la vidéo d'abord, puis les messages
    const boutons = [
      https(d.video) ? '<a class="btn petit" href="' + P.esc(d.video) + '" target="_blank" rel="noopener">🎬 Vidéo de la marche</a>' : '',
      wa ? '<a class="btn petit" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">💬 WhatsApp</a>' : '',
      waParent ? '<a class="btn petit" target="_blank" rel="noopener" href="https://wa.me/' + waParent + '">💬 Parent</a>' : '',
      wa && ouverte && !payee ? '<a class="btn petit" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(messagePaiement(d)) + '">💳 Envoyer le lien Wave</a>' : ''
    ];
    const id = P.esc(d.id);
    return '<article class="carte ct-fiche" data-id="' + id + '"><div class="ligne"><h2>' + P.esc(d.nom) + '</h2>' + P.pastille(st[0], st[1]) + (d.age && d.age < 18 ? P.pastille('Mineure', 'orange') : '') + '</div>' +
      '<dl class="ct-infos">' + infos.map((x) => '<dt>' + P.esc(x[0]) + '</dt><dd>' + P.esc(x[1]) + '</dd>').join('') + '</dl>' +
      (galerie || (https(d.video) ? '' : '<p class="doux">Photos et vidéo non reçues (demandez-les sur WhatsApp).</p>')) +
      '<div class="ct-actions">' + boutons.join('') + '</div>' +
      (payee ? programme(d, wa, waParent) : '') +
      (ouverte ? '<form class="f ct-suivi" data-form="talons-suivi" data-id="' + id + '">' +
        '<label class="fl" for="ct-date-' + id + '">Date de la (première) séance<input id="ct-date-' + id + '" name="date_seance" type="date" value="' + P.esc(d.date_seance || '') + '"></label>' +
        '<label class="fl" for="ct-montant-' + id + '">Montant (FCFA)<input id="ct-montant-' + id + '" name="montant" type="number" min="0" step="500" value="' + P.esc(d.montant || '') + '"' + (payee ? ' readonly title="Déjà payé : le montant est en Comptabilité"' : '') + '></label>' +
        '<label class="fl large" for="ct-notes-' + id + '">Notes<textarea id="ct-notes-' + id + '" name="notes" maxlength="2000">' + P.esc(d.notes || '') + '</textarea></label>' +
        '<div class="ligne large"><button class="btn" type="submit">Enregistrer</button>' +
          (!payee ? '<button class="btn rouge" type="button" data-action="talons-valider" data-id="' + id + '">✓ Paiement reçu (' + P.esc(nomMoyen(d.moyen)) + ')</button><button class="btn" type="button" data-action="talons-valider" data-id="' + id + '" data-valeur="especes">✓ Payé en espèces</button>' : '') +
          (payee ? '<button class="btn" type="button" data-action="talons-statut" data-id="' + id + '" data-valeur="terminee">Cours terminés</button>' : '') +
          '<button class="btn" type="button" data-action="talons-statut" data-id="' + id + '" data-valeur="annulee">Annuler l’inscription</button>' +
        '</div></form>'
        : (d.notes ? '<p class="doux">' + P.esc(d.notes) + '</p>' : '') + '<div class="ligne"><button class="btn petit" type="button" data-action="talons-statut" data-id="' + id + '" data-valeur="' + (d.valide_le ? 'inscrite' : d.decision === 'maintenant' ? 'paiement_envoye' : 'plus_tard') + '">Rouvrir</button></div>') +
      '</article>';
  }

  // « Son programme » (14/11/2026, maquette validée) : ses séances en relevé, une séance à ajouter, son lien sur WhatsApp
  function programme(d, wa, waParent) {
    const id = P.esc(d.id);
    if (programmeAbsent) return '<section class="ct-programme"><h3>Son programme</h3><p class="doux">Pour préparer la page « Mon programme » des élèves, collez le fichier <strong>supabase-programme-talons.sql</strong> dans Supabase (SQL Editor, puis Run).</p></section>';
    const l = seancesDe[d.id] || [];
    const maintenant = Date.now();
    const prochaine = l.find((s) => !s.faite && new Date(s.fin).getTime() > maintenant);
    const lignesSeances = l.map((s, i) => {
      const passee = s.faite || new Date(s.fin).getTime() <= maintenant;
      return '<div class="pp-op ct-seance"><em class="' + (s === prochaine ? 'ct-proche' : passee ? 'ct-faite' : '') + '">' + (passee ? '✓' : i + 1) + '</em>' +
        '<span>' + P.esc(s.theme || 'Séance ' + (i + 1)) + '<small>' + P.esc(quandSeance(s) + ' · ' + (s.lieu || LIEU_SALLE)) + '</small></span>' +
        '<button type="button" class="ct-mini' + (s.faite ? ' oui' : '') + '" data-action="talons-seance-faite" data-id="' + P.esc(s.id) + '" data-valeur="' + (s.faite ? '' : '1') + '" aria-pressed="' + (s.faite ? 'true' : 'false') + '">' + (s.faite ? 'Faite ✓' : 'Faite ?') + '</button>' +
        '<button type="button" class="ct-mini" data-action="talons-seance-retirer" data-id="' + P.esc(s.id) + '" aria-label="Retirer la séance du ' + P.esc(quandSeance(s)) + '">✕</button></div>';
    }).join('');
    const groupe = d.formule === 'groupe';
    // mineure : le programme part AUSSI à son parent (avec un message pour lui)
    const envoi = d.jeton ? [wa ? '<a class="btn rouge" target="_blank" rel="noopener" href="https://wa.me/' + wa + '?text=' + encodeURIComponent(messageProgramme(d)) + '">📅 Envoyer son programme (WhatsApp)</a>' : '',
      waParent ? '<a class="btn" target="_blank" rel="noopener" href="https://wa.me/' + waParent + '?text=' + encodeURIComponent(messageProgramme(d, true)) + '">📅 Au parent</a>' : '',
      '<a class="btn petit" target="_blank" rel="noopener" href="' + P.esc(LIEN_PROGRAMME + d.jeton) + '">Voir sa page ↗</a>'].join('') : '';
    return '<section class="ct-programme"><h3>Son programme <span class="nb">' + l.length + ' / ' + (groupe ? 4 : d.nb_seances) + '</span></h3>' +
      (l.length ? '<div class="pp-releve">' + lignesSeances + '</div>' : '<p class="doux">Aucune séance pour le moment. ' + (groupe ? 'Ajoutez les dimanches ci-dessous.' : 'Ajoutez ses séances privées ci-dessous.') + '</p>') +
      (envoi ? '<div class="ct-envoi">' + envoi + '</div>' : '') +
      '<details class="ct-ajout"' + (l.length ? '' : ' open') + '><summary>＋ Ajouter une séance</summary><form class="f ct-seance-ajout" data-form="talons-seance" data-id="' + id + '">' +
        '<label class="fl" for="ct-s-date-' + id + '">Date<input id="ct-s-date-' + id + '" name="date" type="date" required></label>' +
        '<label class="fl" for="ct-s-heure-' + id + '">Heure<input id="ct-s-heure-' + id + '" name="heure" type="time" value="' + (groupe ? '15:00' : '10:00') + '" required></label>' +
        '<label class="fl" for="ct-s-duree-' + id + '">Durée<select id="ct-s-duree-' + id + '" name="duree">' + [[60, '1 h'], [90, '1 h 30'], [120, '2 h'], [180, '3 h']].map((x) =>
          '<option value="' + x[0] + '"' + (x[0] === (groupe ? 180 : 120) ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></label>' +
        '<label class="fl" for="ct-s-lieu-' + id + '">Lieu<input id="ct-s-lieu-' + id + '" name="lieu" maxlength="200" value="' + P.esc(d.formule === 'prive_exterieur' ? (d.adresse || '') : LIEU_SALLE) + '"></label>' +
        '<label class="fl large" for="ct-s-theme-' + id + '">Thème (facultatif)<input id="ct-s-theme-' + id + '" name="theme" maxlength="120" placeholder="Ex. : Démarche et port de tête"></label>' +
        '<div class="ligne large"><button class="btn" type="submit">Ajouter la séance</button></div></form></details>' +
      '<p class="doux petit-texte">' + (groupe ? 'Les 4 dimanches sont remplis tout seuls à la validation du paiement. ' : '') + 'La page de l’élève se met à jour toute seule.</p></section>';
  }
  function messageProgramme(d, parent) {
    if (parent) return 'Bonjour' + (d.parent_nom ? ' ' + String(d.parent_nom).trim() : '') + ',\n\nL’inscription de ' + civilite(d) + ' à l’Atelier Talons & Élégance est confirmée, merci !\n' +
      'Voici son programme personnel : ses séances, le lieu, et un bouton pour les ajouter d’un coup à votre calendrier (avec un rappel la veille) :\n' +
      LIEN_PROGRAMME + d.jeton + '\n\nÀ très bientôt,\nMaître Akesse Model Management';
    return 'Bonjour ' + civilite(d) + ',\n\nVotre inscription à l’Atelier Talons & Élégance est confirmée, merci !\n' +
      'Voici votre programme personnel : vos séances, le lieu, et un bouton pour les ajouter d’un coup à votre calendrier (avec un rappel la veille) :\n' +
      LIEN_PROGRAMME + d.jeton + '\n\nÀ très bientôt,\nMaître Akesse Model Management';
  }
  P.formulaires['talons-seance'] = async (f, form) => {
    const id = form && form.dataset.id;
    const date = String(f.get('date') || ''), heure = String(f.get('heure') || '');
    const duree = parseInt(f.get('duree'), 10) || 120;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(heure)) { P.message('Choisissez la date et l’heure de la séance.'); return; }
    const debut = new Date(date + 'T' + heure + ':00Z');   // Abidjan = UTC
    if (isNaN(debut)) { P.message('Date ou heure incorrecte.'); return; }
    const ligne = { inscription_id: id, debut: debut.toISOString(), fin: new Date(debut.getTime() + duree * 60000).toISOString(),
      lieu: String(f.get('lieu') || '').trim() || LIEU_SALLE, theme: String(f.get('theme') || '').trim() || null };
    const r = await P.bd(sb.from('cours_talons_seances').insert(ligne).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été ajouté : reconnectez-vous puis réessayez.'); return; }
    P.message('Séance ajoutée : la page de l’élève est à jour.');
    return P.afficher();
  };
  P.actions['talons-seance-faite'] = async (el) => {
    const r = await P.bd(sb.from('cours_talons_seances').update({ faite: el.dataset.valeur === '1' }).eq('id', el.dataset.id).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été changé : reconnectez-vous puis réessayez.'); return; }
    return P.afficher();
  };
  P.actions['talons-seance-retirer'] = async (el) => {
    if (!confirm('Retirer cette séance de son programme ?')) return;
    const r = await P.bd(sb.from('cours_talons_seances').delete().eq('id', el.dataset.id).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été retiré : reconnectez-vous puis réessayez.'); return; }
    P.message('Séance retirée.');
    return P.afficher();
  };

  P.actions['talons-photo-voir'] = (el) => {
    const d = lignes.find((x) => x.id === el.dataset.id);
    const l = photosDe(d);
    if (!l.length) return;
    if (typeof ouvrirGalerieLightbox === 'function') ouvrirGalerieLightbox(l, Number(el.dataset.index));
    else window.open(l[Number(el.dataset.index)] || l[0], '_blank', 'noopener');
  };
  P.actions['talons-filtre'] = (el) => { filtre = el.dataset.valeur; return P.afficher(); };
  P.formulaires['talons-suivi'] = async (f, form) => {
    const id = (form && form.dataset.id) || f.get('id');
    const montant = parseInt(f.get('montant'), 10);
    const d = lignes.find((x) => x.id === id) || {};
    const maj = { date_seance: f.get('date_seance') || null, notes: String(f.get('notes') || '').trim() || null };
    if (!d.valide_le) maj.montant = isFinite(montant) && montant >= 0 ? montant : null;  // (payé : le montant reste celui de la Compta)
    const r = await P.bd(sb.from('cours_talons').update(maj).eq('id', id).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    P.message('Enregistré.');
    return P.afficher();
  };
  P.actions['talons-valider'] = async (el) => {
    const d = lignes.find((x) => x.id === el.dataset.id);
    if (!d) return;
    const especes = el.dataset.valeur === 'especes';
    const champ = document.getElementById('ct-montant-' + d.id);
    const montant = parseInt(champ && champ.value, 10) || d.montant;
    if (!confirm('Confirmer le paiement de ' + P.fcfa(montant) + ' par ' + (especes ? 'espèces' : nomMoyen(d.moyen)) + ' pour ' + d.nom + ' ? Une recette « Cours de talons » sera ajoutée en Comptabilité.')) return;
    await P.sensible(() => P.rpc('cours_talons_valider', { p_id: d.id, p_montant: montant, p_especes: especes }));
    P.message('Paiement validé : recette ajoutée en Comptabilité.');
    return P.afficher();
  };
  P.actions['talons-statut'] = async (el) => {
    const statut = el.dataset.valeur;
    const d = lignes.find((x) => x.id === el.dataset.id) || {};
    if (statut === 'annulee' && !confirm('Annuler cette inscription ? (Rien n’est effacé : vous pourrez la rouvrir.)' +
      (d.valide_le ? '\n\nAttention : le paiement de ' + P.fcfa(d.montant) + ' reste en Comptabilité. Si vous remboursez, annulez aussi la recette dans Comptabilité.' : ''))) return;
    const r = await P.bd(sb.from('cours_talons').update({ statut }).eq('id', el.dataset.id).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été changé : reconnectez-vous puis réessayez.'); return; }
    return P.afficher();
  };
  P.espaces.site.pages[PAGE] = page;
})();
