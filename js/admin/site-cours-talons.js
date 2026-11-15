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
  // (15/11/2026, maquette validée : maquettes/planning-talons.html) « Planning » : les cours des 4 prochaines semaines, jour par jour
  const FILTRES = [['planning', 'Planning'], ['a_traiter', 'À traiter'], ['inscrite', 'Inscrites'], ['terminee', 'Terminées'], ['annulee', 'Annulées'], ['toutes', 'Toutes']];
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
  // (15/11/2026, maquette validée : maquettes/creneaux-prives-v2.html) indisponibilités de l'agence (supabase-creneaux-prives.sql)
  let indispos = [], indispoAbsent = false;
  const indispoPasInstallee = P.pasActivee('cours_talons_indispo');
  const quandSeance = (s) => { const a = new Date(s.debut), b = new Date(s.fin); const j = T.JOURS[a.getUTCDay()];
    return j.charAt(0).toUpperCase() + j.slice(1, 3) + '. ' + a.getUTCDate() + ' ' + T.MOIS_COURTS[a.getUTCMonth()] + ' · ' + T.heure(a) + ' – ' + T.heure(b); };
  const civilite = (d) => T.civilite(d.civilite, d.age) + ' ' + String(d.nom || '').trim();
  // (15/11/2026) un seul endroit pour les liens WhatsApp de cette page (message écrit facultatif) et pour minuit (UTC = Abidjan)
  const lienWhatsApp = (num, texte, msg, classes, attrs) => '<a class="btn ' + (classes || 'petit') + '"' + (attrs || '') + ' target="_blank" rel="noopener" href="https://wa.me/' + num +
    (msg ? '?text=' + encodeURIComponent(msg) : '') + '">' + texte + '</a>';
  const JOUR_MS = 86400000;
  const debutJourUTC = (d) => { const x = d || new Date(); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); };
  // (14/11/2026) groupe sur plusieurs mois : durée, façon de payer, mois payés
  const nbMois = (d) => d.nb_mois || 1;
  // titres des thèmes (cours_talons_programme, lu une fois par page) ; {3,3,4} → « La prestance (2 mois), Le podium (1 mois) »
  let titresProgramme = {};
  const resumeModules = (l) => T.grouperModules(l).map((x) => (titresProgramme[x.m] || 'Thème ' + x.m) + ' (' + x.n + ' mois)').join(', ');
  const dureeGroupe = (d) => seances(d) + (nbMois(d) > 1 ? ', payés ' + (d.paiement === 'mensuel' ? 'mois par mois' : 'en une fois') : '');

  const seances = (d) => d.formule === 'groupe' ? (nbMois(d) > 1 ? nbMois(d) + ' mois, ' + 4 * nbMois(d) + ' dimanches' : '4 dimanches') : d.nb_seances + ' séance' + (d.nb_seances > 1 ? 's' : '');
  // « Bonjour M. Yao, » (parent d'une élève mineure) ou « Bonjour Madame AWA, »
  const bonjour = (d, parent) => 'Bonjour' + (parent ? (d.parent_nom ? ' ' + String(d.parent_nom).trim() : '') : ' ' + civilite(d)) + ',\n\n';
  const SIGNATURE = 'Maître Akesse Model Management';
  // (14/11/2026, « messages prêts à envoyer ») l'inscription bien reçue : l'agence revient vers elle
  function messageInscription(d, parent) {
    const paye = d.decision === 'maintenant';
    return bonjour(d, parent) + (parent ? 'Nous avons bien reçu l’inscription de ' + civilite(d) : 'Nous avons bien reçu votre inscription') +
      ' à l’Atelier Talons & Élégance (' + FORMULES[d.formule] + ', ' + seances(d) + '), merci !\n' +
      (paye ? 'Nous vérifions le paiement et revenons vers vous très vite avec ' + (parent ? 'son' : 'votre') + ' programme.'
        : 'Nous revenons vers vous très vite avec le lien de paiement et la date de ' + (parent ? 'sa' : 'votre') + ' première séance.') +
      '\n\nÀ très bientôt,\n' + SIGNATURE;
  }
  // la prochaine séance confirmée (pas faite, pas passée ; en groupe, d'un mois déjà payé)
  const prochaineSeance = (d) => (seancesDe[d.id] || []).find((s) => !s.faite && new Date(s.fin).getTime() > Date.now() && !(s.mois > (d.mois_payes || 0) && d.formule === 'groupe'));
  // le rappel de la prochaine séance : « demain » quand c'est demain, sinon le jour et la date
  function messageRappel(d, s, parent) {
    const a = new Date(s.debut), b = new Date(s.fin);
    const estDemain = debutJourUTC(a) === debutJourUTC() + JOUR_MS;
    const quand = (estDemain ? 'demain, ' : 'le ') + T.JOURS[a.getUTCDay()] + ' ' + a.getUTCDate() + ' ' + T.MOIS[a.getUTCMonth()] + ', de ' + T.heure(a) + ' à ' + T.heure(b);
    return bonjour(d, parent) + 'Petit rappel : ' + (parent ? 'la séance de ' + civilite(d) : 'votre séance') + ' de l’Atelier Talons & Élégance, c’est ' + quand + '.\n' +
      'Lieu : ' + (s.lieu || LIEU_SALLE) + '.\n' + (s.theme ? 'Thème : ' + s.theme + '.\n' : '') +
      'À prévoir : ' + T.A_PREVOIR + '. Merci d’arriver 15 minutes avant.\n' +
      (d.jeton ? '\n' + (parent ? 'Son' : 'Votre') + ' programme : ' + LIEN_PROGRAMME + d.jeton + '\n' : '') + '\n' + (estDemain ? 'À demain !' : 'À bientôt !') + '\n' + SIGNATURE;
  }
  // « Messages prêts à envoyer » : une tuile par message utile maintenant, à elle et (mineure) à son parent
  function messagesPrets(d, wa, waParent) {
    if (!wa && !waParent) return '';
    const ouverte = !['terminee', 'annulee'].includes(d.statut), payee = d.statut === 'inscrite';
    const s = payee ? prochaineSeance(d) : null;
    const tuiles = [
      ouverte && !payee ? ['inscription', '📩', 'Inscription reçue', 'Pour la remercier et dire que l’agence revient vers elle.', (p) => messageInscription(d, p)] : null,
      ouverte && !payee ? ['paiement', '💳', 'Lien de paiement', P.fcfa(d.montant) + ' par Wave' + (d.formule === 'groupe' && d.paiement === 'mensuel' && nbMois(d) > 1 ? ' (le premier mois)' : '') + '.', (p) => messagePaiement(d, p)] : null,
      payee && d.jeton && !programmeAbsent ? ['programme', '📅', 'Son programme', 'Son lien personnel : séances, lieu, calendrier.', (p) => messageProgramme(d, p)] : null,
      s ? ['rappel', '⏰', 'Rappel de la prochaine séance', quandSeance(s) + (s.theme ? ' · « ' + s.theme + ' »' : '') + '. À envoyer la veille.', (p) => messageRappel(d, s, p)] : null
    ].filter(Boolean);
    if (!tuiles.length) return '';
    const lien = (num, texte, pour, msg) => lienWhatsApp(num, texte, msg, 'petit' + (pour === 'eleve' ? ' rouge' : ''), ' data-pour="' + pour + '"');
    return '<section class="ct-messages"><h3>Messages prêts à envoyer</h3><p class="doux petit-texte">Un appui ouvre WhatsApp avec le message écrit ; vous le relisez puis l’envoyez.</p><div class="ct-msgs">' +
      tuiles.map((t) => '<div class="ct-msg" data-msg="' + t[0] + '"><i aria-hidden="true">' + t[1] + '</i><div class="ct-msg-txt"><b>' + P.esc(t[2]) + '</b><small>' + P.esc(t[3]) + '</small></div>' +
        '<div class="ct-msg-btn">' + (wa ? lien(wa, 'À elle', 'eleve', t[4](false)) : '') + (waParent ? lien(waParent, 'Au parent', 'parent', t[4](true)) : '') + '</div></div>').join('') + '</div></section>';
  }
  function messagePaiement(d, parent) {
    // (14/11/2026) vouvoiement : « Bonjour Madame … » / « Mademoiselle … » (civilité choisie à l'inscription)
    if (parent) return bonjour(d, true) + 'Merci pour l’inscription de ' + civilite(d) + ' à l’Atelier Talons & Élégance de ' + SIGNATURE + ' (' + FORMULES[d.formule] + ', ' + seances(d) + ').\n' +
      'Montant : ' + P.fcfa(d.montant) + (d.formule === 'groupe' && d.paiement === 'mensuel' && nbMois(d) > 1 ? ' (le premier mois ; puis ' + P.fcfa(T.PRIX_MOIS) + ' chaque mois)' : '') + '.\nVous pouvez régler par Wave avec ce lien :\n' + LIEN_WAVE_AGENCE + (d.montant || 0) + '\n\n' +
      (d.date_seance ? 'Sa première séance : le ' + P.date(d.date_seance) + '.\n\n' : '') + 'À très bientôt !\n' + SIGNATURE;
    return 'Bonjour ' + civilite(d) + ',\n\nMerci pour votre inscription à l’Atelier Talons & Élégance de Maître Akesse Model Management (' + FORMULES[d.formule] + ', ' + seances(d) + ').\n' +
      'Montant : ' + P.fcfa(d.montant) + (d.formule === 'groupe' && d.paiement === 'mensuel' && nbMois(d) > 1 ? ' (le premier mois ; puis ' + P.fcfa(T.PRIX_MOIS) + ' chaque mois)' : '') + '.\nVous pouvez régler par Wave avec ce lien :\n' + LIEN_WAVE_AGENCE + (d.montant || 0) + '\n\n' +
      (d.date_seance ? 'Votre première séance : le ' + P.date(d.date_seance) + '.\n\n' : '') + 'À très bientôt !\nMaître Akesse Model Management';
  }

  let dossiersDrive = {};
  async function page(args) {
    // la notification de la veille ouvre …/b2-cours-talons/planning : le planning, une fois (l'adresse redevient normale)
    if (args && args[0] === 'planning') { filtre = 'planning'; history.replaceState(null, '', '#/site/b2-cours-talons'); }
    try {
      lignes = await P.bd(sb.from('cours_talons').select('*').order('cree_le', { ascending: false }).limit(500));
      // (15/11/2026) inscriptions sans photo : leur dossier Drive, s'il est connu (P.drive, js/admin/coque.js)
      dossiersDrive = await P.drive.dossiers(lignes.filter((d) => !photosDe(d).length).map((d) => d.id)).catch(() => ({}));
    } catch (e) {
      if (!pasInstallee(e)) throw e;
      return P.entete('Cours de talons') + '<div class="carte"><h2>Pas encore activé</h2><p class="doux">Pour recevoir les inscriptions en ligne, collez le fichier <strong>supabase-cours-talons.sql</strong> dans Supabase (SQL Editor, puis Run). En attendant, la page publique propose aux personnes d’envoyer leur inscription sur WhatsApp.</p></div>';
    }
    // séances des élèves inscrites (« Son programme ») ; fichier pas encore collé : la fiche le dit, le reste marche
    // (toutes les séances d'un coup : une liste d'identifiants dans l'adresse dépasserait la limite avec des centaines d'élèves)
    seancesDe = {}; programmeAbsent = false;
    // titres des thèmes : lus une seule fois (programme pas encore collé : numéros seulement)
    const titres = Object.keys(titresProgramme).length ? null : P.bd(sb.from('cours_talons_programme').select('mois,titre'))
      .then((l) => { (l || []).forEach((x) => { titresProgramme[x.mois] = x.titre; }); }).catch(() => {});
    // (15/11/2026) toutes les séances : aussi celles réservées à l'inscription (cours privés pas encore payés)
    const indispoLu = P.bd(sb.from('cours_talons_indispo').select('*').gte('fin', new Date().toISOString()).order('debut').limit(200))
      .then((l) => { indispos = l || []; indispoAbsent = false; }, (e) => { indispos = []; indispoAbsent = true; if (!indispoPasInstallee(e)) console.warn(e); });
    if (lignes.length) {
      try {
        // « occupe » (calculé par la base, supabase-creneaux-prives.sql : une réservation pas payée expire après 48 h) ;
        // relu sans lui tant que ce fichier n'est pas collé
        const lire = (champs) => P.bd(sb.from('cours_talons_seances').select(champs).order('debut', { ascending: true }).limit(5000));
        let l; try { l = await lire('*, occupe'); } catch (e) { if (programmePasInstalle(e)) throw e; l = await lire('*'); }
        (l || []).forEach((x) => { (seancesDe[x.inscription_id] = seancesDe[x.inscription_id] || []).push(x); });
      } catch (e) { if (!programmePasInstalle(e)) throw e; programmeAbsent = true; }
    }
    await titres; await indispoLu;
    calculerPlanning();
    const compte = (f) => f === 'planning' ? plan.nb : lignes.filter((d) => f === 'toutes' || (f === 'a_traiter' ? A_TRAITER.includes(d.statut) : d.statut === f)).length;
    const visibles = lignes.filter((d) => filtre === 'toutes' || (filtre === 'a_traiter' ? A_TRAITER.includes(d.statut) : d.statut === filtre));
    const encaisse = lignes.filter((d) => d.statut === 'inscrite' || d.statut === 'terminee').reduce((t, d) => t + (d.montant || 0), 0);
    const onglets = '<div class="ligne">' + FILTRES.map((f) => '<button type="button" class="btn petit' + (f[0] === filtre ? ' rouge' : '') + '" data-action="talons-filtre" data-valeur="' + f[0] + '">' +
      P.esc(f[1]) + ' (' + compte(f[0]) + ')</button>').join('') + '</div>';
    return P.entete('Cours de talons', '<a class="btn petit" href="/cours-talons" target="_blank" rel="noopener">Voir la page publique</a>') +
      '<p class="doux">Inscriptions à l’Atelier Talons &amp; Élégance (ouvert à toutes, sans intégrer l’agence). Groupe : 30 000 FCFA les 4 dimanches ; privé : 25 000 FCFA la séance en salle, 30 000 à 35 000 FCFA la séance à l’extérieur.</p>' +
      '<div class="chiffres">' + P.chiffre('À traiter', String(compte('a_traiter'))) + P.chiffre('Inscrites', String(compte('inscrite'))) + P.chiffre('Encaissé (inscrites et terminées)', P.fcfa(encaisse)) + '</div>' +
      indisponibilites() +
      '<div class="carte f">' + onglets + '</div>' +
      // (13/11/2026, demande de la propriétaire) regroupées par jour d'inscription, les plus récentes en haut, comme les castings
      (filtre === 'planning' ? planning() : visibles.length ? P.parJour(visibles, (d) => d.cree_le).map((g) => '<section class="jour-groupe"><h2 class="jour-titre">' + P.esc(g.titre) +
        ' <span class="nb">' + g.elements.length + '</span></h2>' + g.elements.map(fiche).join('') + '</section>').join('') : '<div class="carte vide">Aucune inscription ici pour le moment.</div>');
  }

  // Planning : les séances qui comptent (pas faites, pas finies, pas annulées, pas une réservation expirée, pas un mois du
  // groupe encore à régler), d'aujourd'hui aux 4 semaines suivantes ; le groupe d'une même heure en UN cours ; avec les
  // indisponibilités. Calculé une fois par affichage (page) : le nombre de l'onglet est celui des cours montrés.
  const SEMAINES_PLANNING = 4;
  let plan = { jours: {}, nb: 0 };
  function calculerPlanning() {
    const j0 = debutJourUTC(), j1 = j0 + SEMAINES_PLANNING * 7 * JOUR_MS, maintenant = Date.now();
    const l = [];
    lignes.filter((d) => !['annulee', 'terminee'].includes(d.statut)).forEach((d) => (seancesDe[d.id] || []).forEach((s) => {
      const t = Date.parse(s.debut);
      if (s.faite || s.occupe === false || Date.parse(s.fin) <= maintenant || t >= j1 || (d.formule === 'groupe' && s.mois > (d.mois_payes || 0))) return;
      l.push({ d, s, t });
    }));
    const jours = {};
    const jourDe = (k) => (jours[k] = jours[k] || { cours: [], indispo: [] });
    let nb = 0;
    l.sort((x, y) => x.t - y.t).forEach((x) => {
      const j = jourDe(x.s.debut.slice(0, 10));
      const g = x.d.formule === 'groupe' && j.cours.find((c) => c.groupe && c.debut === x.s.debut);
      if (g) { g.eleves.push(x); return; }
      j.cours.push(x.d.formule === 'groupe' ? { groupe: true, debut: x.s.debut, s: x.s, eleves: [x] } : { s: x.s, d: x.d });
      nb++;
    });
    for (let k = 0; k < SEMAINES_PLANNING * 7; k++) {
      const d0 = j0 + k * JOUR_MS;
      indispos.filter((i) => Date.parse(i.debut) < d0 + JOUR_MS && Date.parse(i.fin) > d0).forEach((i) => jourDe(new Date(d0).toISOString().slice(0, 10)).indispo.push(i));
    }
    plan = { jours, nb };
  }
  function planning() {
    const jours = plan.jours, j0 = debutJourUTC();
    const cles = Object.keys(jours).sort();
    if (!cles.length) return '<div class="carte vide">Aucun cours prévu dans les 4 prochaines semaines.</div>';
    const rappels = (d, s) => { const w = numeroWhatsApp(d.telephone), wp = numeroWhatsApp(d.parent_telephone);
      return (w ? lienWhatsApp(w, '💬 Rappel', messageRappel(d, s, false), 'petit rouge') : '') + (wp ? lienWhatsApp(wp, '💬 Au parent', messageRappel(d, s, true)) : ''); };
    const heures = (s) => T.heure(new Date(s.debut)) + ' – ' + T.heure(new Date(s.fin));
    const carte = (c) => {
      if (c.groupe) return '<div class="pl-s"><b>' + P.esc(heures(c.s) + ' · Cours en groupe') + '</b><small>' + P.esc([c.s.theme ? '« ' + c.s.theme + ' »' : '', c.s.lieu || LIEU_SALLE, c.eleves.length + (c.eleves.length > 1 ? ' élèves' : ' élève')].filter(Boolean).join(' · ')) + '</small>' +
        '<details class="pl-eleves"><summary>Voir les élèves (' + c.eleves.length + ')</summary>' + c.eleves.map((x) => '<div class="pl-eleve"><span>' + P.esc(civilite(x.d)) + '</span>' + rappels(x.d, x.s) + '</div>').join('') + '</details></div>';
      return '<div class="pl-s"><b>' + P.esc(heures(c.s) + ' · ' + civilite(c.d)) + '</b><small>' + P.esc([c.s.theme ? '« ' + c.s.theme + ' »' : '', c.s.lieu || LIEU_SALLE, c.d.valide_le ? 'privé' : 'à confirmer (paiement)'].filter(Boolean).join(' · ')) + '</small>' +
        '<div class="pl-boutons">' + rappels(c.d, c.s) + '<button type="button" class="btn petit" data-action="talons-voir-fiche" data-id="' + P.esc(c.d.id) + '">Sa fiche</button></div></div>';
    };
    const COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'], demain = new Date(j0 + JOUR_MS).toISOString().slice(0, 10);
    return '<div class="se-semaine pl-planning">' + cles.map((k) => { const d = new Date(k + 'T00:00:00Z'), j = jours[k];
      return '<div class="se-jour' + (k === demain ? ' auj' : '') + '"><div class="se-date"><small>' + COURTS[d.getUTCDay()] + '</small><b>' + d.getUTCDate() + '</b><small>' + T.MOIS_COURTS[d.getUTCMonth()] + '</small></div><div class="pl-jour">' +
        j.indispo.map((i) => '<div class="pl-indispo">🚫 Indisponible · ' + P.esc(quandIndispo(i)) + (i.raison ? ' · ' + P.esc(i.raison) : '') + '</div>').join('') + j.cours.map(carte).join('') + '</div></div>'; }).join('') + '</div>' +
      '<p class="doux petit-texte">Demain est en rouge. La veille de chaque cours, une notification arrive sur votre téléphone. Les élèves ont aussi le rappel de la veille dans leur calendrier.</p>';
  }
  P.actions['talons-voir-fiche'] = async (el) => {
    const d = lignes.find((x) => x.id === el.dataset.id);
    if (!d) return;
    filtre = A_TRAITER.includes(d.statut) ? 'a_traiter' : d.statut;
    await P.afficher();
    const f = document.querySelector('.ct-fiche[data-id="' + CSS.escape(d.id) + '"]');
    if (f && typeof f.scrollIntoView === 'function') f.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  function fiche(d) {
    const st = STATUTS[d.statut] || [d.statut, 'neutre'];
    const wa = numeroWhatsApp(d.telephone), waParent = numeroWhatsApp(d.parent_telephone);
    const photos = photosDe(d);
    const infos = [
      ['Civilité', d.civilite ? T.civilite(d.civilite) : ''],
      // (14/11/2026) son parcours : elle débute (tout le programme) ou elle a la base (ses thèmes choisis)
      ['Parcours', d.parcours === 'base' ? 'A déjà la base · ' + resumeModules(d.modules) : d.parcours === 'debut' ? 'Débute : tout le programme, dans l’ordre' : ''],
      ['Formule', FORMULES[d.formule] + ' · ' + (d.formule === 'groupe' ? dureeGroupe(d) : seances(d))], ['Montant', P.fcfa(d.montant)],
      // (15/11/2026) cours privés : la façon de choisir ses créneaux, et ce qui reste à placer une fois payée
      ['Créneaux', d.formule === 'groupe' ? '' : ({ maintenant: 'Choisis à l’inscription', apres: 'Elle les choisit après son paiement, sur son lien', convenir: 'À convenir ensemble' }[d.choix_creneaux] || '') +
        (d.valide_le && resteAChoisir(d) ? (d.choix_creneaux ? ' · ' : '') + resteAChoisir(d) + ' à placer' : '')],
      ['Mois payés', d.formule === 'groupe' && d.valide_le ? (d.mois_payes || 0) + ' / ' + nbMois(d) : ''],
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
      wa ? lienWhatsApp(wa, '💬 WhatsApp') : '',
      waParent ? lienWhatsApp(waParent, '💬 Parent') : ''
    ];   // (14/11/2026) le lien Wave est dans « Messages prêts à envoyer », sous ces boutons
    const id = P.esc(d.id);
    return '<article class="carte ct-fiche" data-id="' + id + '"><div class="ligne"><h2>' + P.esc(d.nom) + '</h2>' + P.pastille(st[0], st[1]) + (d.age && d.age < 18 ? P.pastille('Mineure', 'orange') : '') + '</div>' +
      '<dl class="ct-infos">' + infos.map((x) => '<dt>' + P.esc(x[0]) + '</dt><dd>' + P.esc(x[1]) + '</dd>').join('') + '</dl>' +
      (galerie || P.drive.encart('cours_talons', d.id, dossiersDrive[d.id])) +
      '<div class="ct-actions">' + boutons.join('') + '</div>' + messagesPrets(d, wa, waParent) +
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
    const prochaine = prochaineSeance(d);
    const lignesSeances = l.map((s, i) => {
      const passee = s.faite || (new Date(s.fin).getTime() <= maintenant && !(s.mois > (d.mois_payes || 0)));   // (un dimanche non payé n'est jamais « fait »)
      return '<div class="pp-op ct-seance"><em class="' + (s === prochaine ? 'ct-proche' : passee ? 'ct-faite' : '') + '">' + (passee ? '✓' : i + 1) + '</em>' +
        '<span>' + P.esc((s.mois && nbMois(d) > 1 ? 'Mois ' + s.mois + ' · ' : '') + (s.theme || 'Séance ' + (i + 1)) + (s.module && titresProgramme[s.module] && d.formule !== 'groupe' ? ' — ' + titresProgramme[s.module] : '')) + '<small>' + P.esc(quandSeance(s) + ' · ' + (s.lieu || LIEU_SALLE)) + '</small></span>' +
        '<button type="button" class="ct-mini' + (s.faite ? ' oui' : '') + '" data-action="talons-seance-faite" data-id="' + P.esc(s.id) + '" data-valeur="' + (s.faite ? '' : '1') + '" aria-pressed="' + (s.faite ? 'true' : 'false') + '">' + (s.faite ? 'Faite ✓' : 'Faite ?') + '</button>' +
        '<button type="button" class="ct-mini" data-action="talons-seance-retirer" data-id="' + P.esc(s.id) + '" aria-label="Retirer la séance du ' + P.esc(quandSeance(s)) + '">✕</button></div>';
    }).join('');
    const groupe = d.formule === 'groupe';
    // (14/11/2026) son programme part sur WhatsApp depuis « Messages prêts à envoyer » (à elle et, mineure, à son parent)
    const envoi = d.jeton ? '<a class="btn petit" target="_blank" rel="noopener" href="' + P.esc(LIEN_PROGRAMME + d.jeton) + '">Voir sa page ↗</a>' : '';
    // groupe : le mois suivant payé (ou un mois de plus quand tout est payé) → cours_talons_mois_payer
    const moisSuivant = groupe && d.statut === 'inscrite' ? '<div class="ct-mois">' + ((d.mois_payes || 0) < nbMois(d)
      ? '<p><b>Mois payés : ' + (d.mois_payes || 0) + ' / ' + nbMois(d) + '</b> · prochain mois à régler : ' + P.fcfa(T.PRIX_MOIS) + '</p>' +
        (wa ? lienWhatsApp(wa, '💳 Lien du mois ' + ((d.mois_payes || 0) + 1) + ' (WhatsApp)', messageMois(d), ' ') : '') +
        (waParent ? lienWhatsApp(waParent, '💳 Au parent', messageMois(d, true), ' ') : '') +
        '<button type="button" class="btn rouge" data-action="talons-mois" data-id="' + id + '">✓ Mois ' + ((d.mois_payes || 0) + 1) + ' payé (' + P.esc(nomMoyen(d.moyen)) + ')</button>' +
        '<button type="button" class="btn" data-action="talons-mois" data-id="' + id + '" data-valeur="especes">✓ Payé en espèces</button>'
      : '<p><b>Tous ses mois sont payés (' + nbMois(d) + ').</b> Elle continue ? Un mois de plus ajoute 4 dimanches à la suite.</p>' +
        '<button type="button" class="btn" data-action="talons-mois" data-id="' + id + '">＋ Un mois de plus payé (' + P.fcfa(T.PRIX_MOIS) + ')</button>' +
        '<button type="button" class="btn" data-action="talons-mois" data-id="' + id + '" data-valeur="especes">＋ Un mois de plus, en espèces</button>') + '</div>' : '';
    return '<section class="ct-programme"><h3>Son programme <span class="nb">' + l.length + ' / ' + (groupe ? 4 * nbMois(d) : d.nb_seances) + '</span></h3>' + moisSuivant +
      (l.length ? '<div class="pp-releve">' + lignesSeances + '</div>' : '<p class="doux">Aucune séance pour le moment. ' + (groupe ? 'Ajoutez les dimanches ci-dessous.' : 'Ajoutez ses séances privées ci-dessous.') + '</p>') +
      (envoi ? '<div class="ct-envoi">' + envoi + '</div>' : '') +
      '<details class="ct-ajout"' + (l.length ? '' : ' open') + '><summary>＋ Ajouter une séance</summary><form class="f ct-seance-ajout" data-form="talons-seance" data-id="' + id + '">' +
        '<label class="fl" for="ct-s-date-' + id + '">Date<input id="ct-s-date-' + id + '" name="date" type="date" required></label>' +
        '<label class="fl" for="ct-s-heure-' + id + '">Heure<input id="ct-s-heure-' + id + '" name="heure" type="time" value="' + (groupe ? '15:00' : '10:00') + '" required></label>' +
        '<label class="fl" for="ct-s-duree-' + id + '">Durée<select id="ct-s-duree-' + id + '" name="duree">' + [[60, '1 h'], [90, '1 h 30'], [120, '2 h'], [180, '3 h']].map((x) =>
          '<option value="' + x[0] + '"' + (x[0] === (groupe ? 180 : 120) ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select></label>' +
        '<label class="fl" for="ct-s-lieu-' + id + '">Lieu<input id="ct-s-lieu-' + id + '" name="lieu" maxlength="200" value="' + P.esc(d.formule === 'prive_exterieur' ? (d.adresse || '') : LIEU_SALLE) + '"></label>' +
        '<label class="fl large" for="ct-s-theme-' + id + '">Thème (facultatif)<input id="ct-s-theme-' + id + '" name="theme" maxlength="120" placeholder="' + (groupe ? 'Ex. : Rattrapage' : 'Vide : le thème suivant de son programme') + '"></label>' +
        '<div class="ligne large"><button class="btn" type="submit">Ajouter la séance</button></div></form></details>' +
      '<p class="doux petit-texte">' + (groupe ? 'Les 4 dimanches sont remplis tout seuls à la validation du paiement. ' : '') + 'La page de l’élève se met à jour toute seule.</p></section>';
  }
  // mois suivant à régler (groupe payé mois par mois) : le lien Wave du mois, sur WhatsApp
  function messageMois(d, parent) {
    const n = (d.mois_payes || 0) + 1;
    return 'Bonjour' + (parent ? (d.parent_nom ? ' ' + String(d.parent_nom).trim() : '') + ',\n\nVoici le lien pour régler le mois ' + n + ' sur ' + nbMois(d) + ' de l’Atelier Talons & Élégance de ' + civilite(d)
      : ' ' + civilite(d) + ',\n\nVoici le lien pour régler le mois ' + n + ' sur ' + nbMois(d) + ' de votre Atelier Talons & Élégance') + ' (' + P.fcfa(T.PRIX_MOIS) + ') :\n' +
      LIEN_WAVE_AGENCE + T.PRIX_MOIS + '\n\nLes dimanches de ce mois sont déjà dans ' + (parent ? 'son' : 'votre') + ' programme ; ils seront confirmés dès le paiement' + (d.jeton ? ' :\n' + LIEN_PROGRAMME + d.jeton : '.') +
      '\n\nMerci, à dimanche !\nMaître Akesse Model Management';
  }
  // séances payées pas encore placées (cours privés : elle les choisit sur son lien)
  const resteAChoisir = (d) => (d.formule === 'groupe' ? 0 : Math.max(0, (d.nb_seances || 0) - (seancesDe[d.id] || []).length));
  function messageProgramme(d, parent) {
    const reste = d.choix_creneaux === 'convenir' ? 0 : resteAChoisir(d);
    if (reste) return bonjour(d, parent) + (parent ? 'L’inscription de ' + civilite(d) + ' à l’Atelier Talons & Élégance est confirmée, merci !\n' : 'Votre inscription à l’Atelier Talons & Élégance est confirmée, merci !\n') +
      'Sur ' + (parent ? 'sa' : 'votre') + ' page personnelle, ' + (parent ? 'elle choisit ses' : 'vous choisissez vos') + ' créneaux (' + reste + ' séance' + (reste > 1 ? 's' : '') + ') parmi les heures libres, quand ' + (parent ? 'elle sera décidée' : 'vous serez décidée') + ' :\n' +
      LIEN_PROGRAMME + d.jeton + '\n\nÀ très bientôt,\n' + SIGNATURE;
    if (parent) return bonjour(d, true) + 'L’inscription de ' + civilite(d) + ' à l’Atelier Talons & Élégance est confirmée, merci !\n' +
      'Voici son programme personnel : ses séances, le lieu, et un bouton pour les ajouter d’un coup à votre calendrier (avec un rappel la veille) :\n' +
      LIEN_PROGRAMME + d.jeton + '\n\nÀ très bientôt,\nMaître Akesse Model Management';
    return 'Bonjour ' + civilite(d) + ',\n\nVotre inscription à l’Atelier Talons & Élégance est confirmée, merci !\n' +
      'Voici votre programme personnel : vos séances, le lieu, et un bouton pour les ajouter d’un coup à votre calendrier (avec un rappel la veille) :\n' +
      LIEN_PROGRAMME + d.jeton + '\n\nÀ très bientôt,\nMaître Akesse Model Management';
  }
  // « Mes indisponibilités » : ces heures ne sont plus proposées aux élèves ; une séance déjà prévue pendant l'une d'elles
  // est signalée, avec un message WhatsApp pour lui faire choisir un autre créneau (sur son lien, « Déplacer »)
  const quandIndispo = (i) => { const a = new Date(i.debut), b = new Date(i.fin); const jour = (d) => { const j = T.JOURS[d.getUTCDay()]; return j.charAt(0).toUpperCase() + j.slice(1) + ' ' + d.getUTCDate() + ' ' + T.MOIS[d.getUTCMonth()]; };
    const journees = !a.getUTCHours() && !a.getUTCMinutes() && !b.getUTCHours() && !b.getUTCMinutes();
    const veille = new Date(b.getTime() - 86400000);
    if (journees) return veille.getTime() === a.getTime() ? jour(a) + ' · toute la journée' : 'Du ' + jour(a) + ' au ' + jour(veille) + ' · journées entières';
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10) ? jour(a) + ' · ' + T.heure(a) + ' – ' + T.heure(b) : 'Du ' + jour(a) + ', ' + T.heure(a) + ' au ' + jour(b) + ', ' + T.heure(b); };
  function seancesTouchees() {
    const l = [];
    lignes.filter((d) => !['annulee', 'terminee'].includes(d.statut)).forEach((d) => (seancesDe[d.id] || []).forEach((s) => {
      if (s.faite || s.occupe === false || new Date(s.fin) < new Date()) return;
      const i = indispos.find((x) => new Date(x.debut) < new Date(s.fin) && new Date(x.fin) > new Date(s.debut));
      if (i) l.push({ d, s });
    }));
    return l;
  }
  function messageIndispo(d, s, parent) {
    // (son bouton « Déplacer » n'existe que plus de 24 h avant la séance)
    const deplacer = d.statut === 'inscrite' && d.formule !== 'groupe' && d.jeton && new Date(s.debut).getTime() - Date.now() > 86400000;
    return bonjour(d, parent) + 'Nous sommes désolés : ' + (parent ? 'la séance de ' + civilite(d) : 'votre séance') + ' du ' + quandSeance(s) + ' ne pourra pas avoir lieu, l’agence n’est pas disponible ce jour-là.\n' +
      (deplacer ? 'Vous pouvez choisir un autre créneau libre sur ' + (parent ? 'sa' : 'votre') + ' page (bouton « Déplacer ») :\n' + LIEN_PROGRAMME + d.jeton + '\n'
        : 'Nous vous proposons une autre date très vite.\n') + '\nMerci de votre compréhension,\n' + SIGNATURE;
  }
  function indisponibilites() {
    if (indispoAbsent) return '';
    const touchees = seancesTouchees();
    const lien = (num, texte, msg) => lienWhatsApp(num, texte, msg);
    return '<details class="carte ct-indispo"' + (touchees.length ? ' open' : '') + '><summary><h2>Mes indisponibilités</h2><span class="nb">' + indispos.length + '</span></summary>' +
      '<p class="doux">Ces heures ne sont plus proposées aux élèves des cours privés.</p>' +
      (indispos.length ? '<div class="pp-releve">' + indispos.map((i) => '<div class="pp-op ct-indispo-l"><em>🚫</em><span>' + P.esc(quandIndispo(i)) + (i.raison ? '<small>' + P.esc(i.raison) + '</small>' : '') + '</span>' +
        '<button type="button" class="ct-mini" data-action="talons-indispo-retirer" data-id="' + P.esc(i.id) + '">✕ Retirer</button></div>').join('') + '</div>' : '<p class="doux">Aucune pour le moment.</p>') +
      (touchees.length ? '<div class="ct-touchees"><p><b>⚠️ ' + touchees.length + (touchees.length > 1 ? ' séances déjà prévues tombent' : ' séance déjà prévue tombe') + ' pendant une indisponibilité :</b></p>' +
        touchees.map((x) => { const wa = numeroWhatsApp(x.d.telephone), waP = numeroWhatsApp(x.d.parent_telephone);
          return '<div class="ct-touchee"><span>' + P.esc(civilite(x.d) + ' · ' + quandSeance(x.s)) + '</span>' + (wa ? lien(wa, '💬 Lui demander un autre créneau', messageIndispo(x.d, x.s, false)) : '') + (waP ? lien(waP, '💬 Au parent', messageIndispo(x.d, x.s, true)) : '') + '</div>'; }).join('') + '</div>' : '') +
      '<form class="f ct-indispo-ajout" data-form="talons-indispo">' +
        '<label class="fl" for="ct-i-du">Du<input id="ct-i-du" name="du" type="date" required></label>' +
        '<label class="fl" for="ct-i-au">Au (facultatif)<input id="ct-i-au" name="au" type="date"></label>' +
        '<label class="fl" for="ct-i-de">De (vide : toute la journée ; sinon ces heures chaque jour)<input id="ct-i-de" name="de" type="time"></label>' +
        '<label class="fl" for="ct-i-a">À<input id="ct-i-a" name="a" type="time"></label>' +
        '<label class="fl large" for="ct-i-raison">Raison (pour vous)<input id="ct-i-raison" name="raison" maxlength="120" placeholder="Ex. : voyage, shooting"></label>' +
        '<div class="ligne large"><button class="btn rouge" type="submit">Ajouter l’indisponibilité</button></div></form></details>';
  }
  P.formulaires['talons-indispo'] = async (f) => {
    const du = String(f.get('du') || ''), au = String(f.get('au') || '') || du, de = String(f.get('de') || ''), a = String(f.get('a') || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(du) || !/^\d{4}-\d{2}-\d{2}$/.test(au)) { P.message('Choisissez la date.'); return; }
    if (!de !== !a) { P.message('Indiquez les deux heures (de … à …), ou aucune pour la journée entière.'); return; }
    // Abidjan = UTC ; journée entière : de 0 h au lendemain 0 h
    // (plusieurs jours avec des heures : ces heures-là CHAQUE jour, une ligne par jour)
    const j0 = Date.parse(du + 'T00:00:00Z'), j1 = Date.parse(au + 'T00:00:00Z'), raison = String(f.get('raison') || '').trim() || null;
    if (isNaN(j0) || isNaN(j1) || j1 < j0) { P.message('Le dernier jour doit être après le premier.'); return; }
    if (j1 - j0 >= 120 * 86400000) { P.message('120 jours au plus d’un coup.'); return; }
    let lignesI;
    if (!de) lignesI = [{ debut: new Date(j0).toISOString(), fin: new Date(j1 + 86400000).toISOString(), raison }];
    else {
      if (a <= de) { P.message('L’heure de fin doit être après l’heure de début.'); return; }
      lignesI = [];
      for (let t = j0; t <= j1; t += 86400000) { const jour = new Date(t).toISOString().slice(0, 10); lignesI.push({ debut: jour + 'T' + de + ':00.000Z', fin: jour + 'T' + a + ':00.000Z', raison }); }
    }
    const r = await P.bd(sb.from('cours_talons_indispo').insert(lignesI).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été ajouté : reconnectez-vous puis réessayez.'); return; }
    P.message('Indisponibilité ajoutée : ces heures ne sont plus proposées.');
    return P.afficher();
  };
  P.actions['talons-indispo-retirer'] = async (el) => {
    if (!confirm('Retirer cette indisponibilité ? Ces heures seront de nouveau proposées aux élèves.')) return;
    const r = await P.bd(sb.from('cours_talons_indispo').delete().eq('id', el.dataset.id).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été retiré : reconnectez-vous puis réessayez.'); return; }
    P.message('Indisponibilité retirée.');
    return P.afficher();
  };
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
  P.actions['talons-mois'] = async (el) => {
    const d = lignes.find((x) => x.id === el.dataset.id);
    if (!d) return;
    const especes = el.dataset.valeur === 'especes', renouveler = (d.mois_payes || 0) >= nbMois(d);
    if (!confirm((renouveler ? 'Un mois de plus pour ' + civilite(d) + ' : 4 dimanches ajoutés à son programme, ' : 'Confirmer le paiement du mois ' + ((d.mois_payes || 0) + 1) + ' de ' + civilite(d) + ' : ') +
      P.fcfa(T.PRIX_MOIS) + ' par ' + (especes ? 'espèces' : nomMoyen(d.moyen)) + ' ? Une recette « Cours de talons » sera ajoutée en Comptabilité.')) return;
    // (jamais deux fois : le bouton est bloqué, et la base refuse un mois déjà enregistré)
    document.querySelectorAll('[data-action="talons-mois"][data-id="' + CSS.escape(d.id) + '"]').forEach((b) => { b.disabled = true; });
    await P.sensible(() => P.rpc('cours_talons_mois_payer', { p_id: d.id, p_mois: (d.mois_payes || 0) + 1, p_especes: especes }));
    P.message(renouveler ? 'Un mois de plus : ses 4 nouveaux dimanches sont dans son programme.' : 'Mois payé : recette ajoutée en Comptabilité.');
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
