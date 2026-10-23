// Messages des convocations aux projets de l'agenda (Extension 141, 21/10/2026, demande de la
// propriétaire) : un beau message personnalisé pour chaque participant, avec la date, l'heure de
// l'événement, l'heure de convocation, le lieu exact, le programme de la journée et « À prévoir ».
// Partagé par le tableau de bord (navigateur : aperçu, envoi immédiat, WhatsApp) et par le serveur
// du site (api/portail.js : envois programmés et rappel de la veille). Changer un texte ici le
// change partout.
//
// Repères d'un message personnalisé (champ « Message » du projet) : {salutation}, {introduction},
// {projet}, {date}, {heure_evenement}, {lieu}, {adresse}, {convocation}, {programme}, {a_prevoir},
// {confirmer} (lien personnel « Je confirme ma présence »), {ponctualite}.
// Textes validés par la propriétaire le 23/10/2026 (sélection, convocation, relance, rappel) :
// vouvoiement, accord au féminin ou au masculin selon la civilité (Madame / Mademoiselle /
// Monsieur), et version pour le parent d'un(e) mineur(e).
// Une ligne dont un repère est vide (pas d'adresse, pas de programme…) disparaît du message.
(function (racine) {
  'use strict';
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  // « le défilé », « la formation »… (types de l'agenda : MA2M_TYPES_AGENDA, js/app.js)
  const LE_TYPE = { defile: 'le défilé', shooting: 'le shooting', casting: 'le casting', formation: 'la formation', evenement: 'l’événement', autre: 'le projet' };
  const CONTACT = 'WhatsApp +225 05 45 65 66 87';
  const LIEN_CONFIRMER = 'https://www.maitreakessemodelmanagement.com/confirmer?c=';
  const EMAIL_AGENCE = 'infos.ma2m@gmail.com';  // = MA2M_EMAIL (js/app.js) : alertes « WhatsApp à envoyer »

  const SIGNATURE = ['_L’équipe Maître Akesse Model Management_', '📞 Une question ? ' + CONTACT];
  const MODELE_CONVOCATION = [
    '✨ *MAÎTRE AKESSE MODEL MANAGEMENT* ✨',
    '',
    'Bonjour {salutation},',
    '',
    '{introduction}',
    '',
    '📅 *{date}*',
    '🎬 Début : {heure_evenement}',
    '📍 {lieu}',
    '🗺️ Adresse : {adresse}',
    '',
    '⏰ *{convocation}*',
    '',
    '🗓️ *Programme de la journée*',
    '{programme}',
    '',
    '🎒 *À prévoir*',
    '{a_prevoir}',
    '',
    '{ponctualite}',
    '✅ *Confirmez votre présence en un clic :* {confirmer}',
    ''
  ].concat(SIGNATURE).join('\n');

  // Premier message : « Annoncer la sélection » (demande de la propriétaire, 23/10/2026). Court :
  // le projet, la date, l'heure, le lieu, et le même lien personnel de confirmation ; la
  // convocation (tous les détails) suit plus tard. Toujours ce modèle (le message personnalisé
  // du projet ne vaut que pour la convocation).
  const MODELE_SELECTION = [
    '✨ *MAÎTRE AKESSE MODEL MANAGEMENT* ✨',
    '',
    'Bonjour {salutation},',
    '',
    '🎉 *{introduction}*',
    '{annonce}',
    '',
    '📅 *{date}*',
    '🎬 Début : {heure_evenement}',
    '📍 {lieu}',
    '',
    '✅ *Confirmez votre participation en un clic :* {confirmer}',
    '',
    '{suite}',
    '',
    '{fierte}'
  ].concat(SIGNATURE).join('\n');

  // le projet et son titre : « le défilé *« Titre »* » ; forme 'pour' (pour le défilé…) ou
  // 'de' (du défilé, de la formation, de l'événement…)
  function leProjet(p, forme) {
    let le = LE_TYPE[p.type] || LE_TYPE.autre;
    if (forme === 'pour') le = 'pour ' + le;
    if (forme === 'de') le = le.replace(/^le /, 'du ').replace(/^la /, 'de la ').replace(/^l’/, 'de l’');
    const titre = String(p.titre || '').trim();
    return le + (titre ? ' *« ' + titre + ' »*' : '');
  }
  const pourLeProjet = (p) => leProjet(p, 'pour');

  // 'AAAA-MM-JJ' → « Samedi 15 novembre 2026 » (date seule, sans fuseau)
  function dateLongue(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    const jour = JOURS[d.getUTCDay()];
    return jour.charAt(0).toUpperCase() + jour.slice(1) + ' ' + (+m[3] === 1 ? '1er' : +m[3]) + ' ' + MOIS[+m[2] - 1] + ' ' + m[1];
  }
  // '15:00' → '15h00'
  const heureFr = (h) => /^\d{2}:\d{2}$/.test(h || '') ? h.replace(':', 'h') : '';
  // Accord selon la civilité : « attendue » pour Madame / Mademoiselle, « attendu » pour Monsieur,
  // « attendu(e) » quand la civilité manque
  const feminin = (nom) => /^(Madame|Mademoiselle)\b/.test(String(nom || ''));
  const accorde = (nom, f, m, neutre) => feminin(nom) ? f : /^Monsieur\b/.test(String(nom || '')) ? m : neutre;
  // « elle » / « il » ; sans civilité, le nom lui-même
  const pronom = (nom) => accorde(nom, 'elle', 'il', nom);
  // salutation : la personne, ou son parent pour un(e) mineur(e)
  const salutation = (q) => q.parent ? (String(q.parent_nom || '').trim() || 'Madame, Monsieur') : (String(q.nom || '').trim() || 'Madame, Monsieur');
  // « le dimanche 15 novembre 2026 »
  const leJour = (iso) => { const d = dateLongue(iso); return d ? 'le ' + d.charAt(0).toLowerCase() + d.slice(1) : ''; };

  // Heure du rappel quelques jours avant (23/10/2026), comme la base
  // (convocation_heure_rappel_avant) : 3 jours avant à 10h00 par défaut.
  function heureRappelAvant(dateDebut, jours, heure) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateDebut || ''));
    if (!m) return null;
    const h = /^\d{2}:\d{2}$/.test(heure || '') ? heure : '10:00';
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] - (Number(jours) || 3), +h.slice(0, 2), +h.slice(3)));
  }
  // Heure du rappel de la veille, comme la base (convocation_heure_rappel) : Abidjan = UTC.
  function heureRappel(dateDebut, heure) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateDebut || ''));
    if (!m) return null;
    const h = /^\d{2}:\d{2}$/.test(heure || '') ? heure : '18:00';
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] - 1, +h.slice(0, 2), +h.slice(3)));
  }

  // projet : ligne d'agenda_projets ; participant : { nom, parent, parent_nom } ;
  // sorte : 'selection' | 'convocation' | 'rappel' | 'rappel_avant'. Renvoie { texte (WhatsApp,
  // *gras*), email (sans marques) }.
  function messageConvocation(projet, participant, sorte) {
    const p = projet || {}, q = participant || {};
    // rappel automatique quelques jours avant : le message du bouton « 🔔 Rappel »
    if (sorte === 'rappel_avant') { const t = messageRappel(p, q); return { texte: t, email: sansMarquesWhatsApp(t) }; }
    const parent = !!q.parent;
    const qui = String(q.nom || '').trim();
    const pourParent = parent && qui;  // message au parent : on parle de l'enfant
    const premiereSeance = (Array.isArray(p.seances) ? p.seances : []).find((s) => s && s.debut);
    const heureEvenement = heureFr(p.heure_evenement) || heureFr(premiereSeance && premiereSeance.debut);
    const attendu = accorde(qui, 'attendue', 'attendu', 'attendu(e)');
    const selectionne = accorde(qui, 'sélectionnée', 'sélectionné', 'sélectionné(e)');
    const laConvocation = pourParent ? 'la convocation de ' + qui : 'votre convocation';
    const introductions = {
      selection: 'Félicitations, ' + (pourParent ? qui + ' est ' : 'vous êtes ') + selectionne + ' !',
      rappel: '⏰ *C’est demain !* Voici un dernier rappel de ' + laConvocation + ' ' + pourLeProjet(p) + '.',
      convocation: 'C’est officiel : voici ' + laConvocation + ' ' + pourLeProjet(p) + '.'
    };
    const valeurs = {
      salutation: salutation(q),
      introduction: introductions[sorte] || introductions.convocation,
      annonce: 'Nous avons le plaisir de vous annoncer ' + (pourParent ? 'qu' + (pronom(qui) === qui ? 'e ' + qui : '’' + pronom(qui)) + ' fera' : 'que vous ferez') + ' partie ' + leProjet(p, 'de') + '.',
      suite: (pourParent ? 'Sa convocation' : 'Votre convocation') + ', avec l’heure d’arrivée, le programme et tout ce qu’il faut prévoir, vous parviendra dans un second message.',
      fierte: 'Toute l’équipe est fière de ' + (pourParent ? 'compter ' + qui : 'vous compter') + ' parmi nous. ✨',
      projet: String(p.titre || '').trim(),
      date: dateLongue(p.date_debut),
      heure_evenement: heureEvenement,
      lieu: [p.lieu, p.ville].filter(Boolean).join(', '),
      adresse: String(p.adresse || '').trim(),
      convocation: heureFr(p.heure_convocation)
        ? (pourParent ? qui + ' est ' : 'Vous êtes ') + attendu + ' à ' + heureFr(p.heure_convocation) + ' précises.'
        : '',
      ponctualite: pourParent
        ? 'Nous comptons sur sa ponctualité et son professionnalisme : c’est l’image de l’agence qu' + (pronom(qui) === qui ? 'e ' + qui : '’' + pronom(qui)) + ' porte. 💫'
        : 'Nous comptons sur votre ponctualité et votre professionnalisme : c’est l’image de l’agence que vous portez. 💫',
      programme: (Array.isArray(p.deroule) ? p.deroule : [])
        .filter((e) => e && (e.heure || e.activite))
        .map((e) => '• ' + [heureFr(e.heure), String(e.activite || '').trim()].filter(Boolean).join(' — ')).join('\n'),
      // lien personnel de confirmation (jeton du participant, Extension 141)
      confirmer: q.jeton ? LIEN_CONFIRMER + q.jeton : '',
      a_prevoir: String(p.a_prevoir || '').split('\n').map((l) => l.trim().replace(/^[-•*]\s*/, '')).filter(Boolean).map((l) => '• ' + l).join('\n')
    };
    const modele = sorte === 'selection' ? MODELE_SELECTION : String(p.message_modele || '').trim() || MODELE_CONVOCATION;
    const lignes = [];
    modele.split('\n').forEach((ligne) => {
      let vide = false;
      const remplie = ligne.replace(/\{([a-z_]+)\}/g, (tout, cle) => {
        if (!(cle in valeurs)) return tout;
        if (!valeurs[cle]) vide = true;
        return valeurs[cle];
      });
      if (vide) {
        // le titre d'une rubrique vide (« Programme de la journée », « À prévoir ») part avec elle
        if (lignes.length && /^\S+ \*[^*]+\*$/.test(lignes[lignes.length - 1]) && /^\{(programme|a_prevoir)\}$/.test(ligne.trim())) lignes.pop();
        return;
      }
      lignes.push(remplie);
    });
    const texte = lignes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return { texte, email: sansMarquesWhatsApp(texte) };
  }

  // Relance d'une personne qui n'a pas encore répondu, et rappel (bouton « 🔔 Rappel ») à une
  // personne qui a confirmé (23/10/2026). pers : { nom, parent, parent_nom, jeton }.
  function messageRelance(projet, pers) {
    const p = projet || {}, q = pers || {}, qui = String(q.nom || '').trim(), pourParent = q.parent && qui;
    return ['Bonjour ' + salutation(q) + ',', '',
      'Nous n’avons pas encore reçu ' + (pourParent ? 'la confirmation de ' + qui : 'votre confirmation') + ' ' + pourLeProjet(p) + (leJour(p.date_debut) ? ', ' + leJour(p.date_debut) : '') + '.', '',
      '👉 *Un seul clic suffit :* ' + LIEN_CONFIRMER + (q.jeton || ''), '',
      'Merci beaucoup, et à très bientôt ! 🙏', '_L’équipe Maître Akesse Model Management_'].join('\n');
  }
  function messageRappel(projet, pers) {
    const p = projet || {}, q = pers || {}, qui = String(q.nom || '').trim(), pourParent = q.parent && qui;
    const heure = heureFr(p.heure_convocation), lieu = [p.lieu, p.ville].filter(Boolean).join(', ');
    const attendu = accorde(qui, 'attendue', 'attendu', 'attendu(e)');
    return ['Bonjour ' + salutation(q) + ',', '',
      '🔔 *Rappel :* nous vous confirmons ' + leProjet(p) + (leJour(p.date_debut) ? ', *' + leJour(p.date_debut) + '*' : '') + '.'
        + (heure ? ' ' + (pourParent ? qui + ' est ' : 'Vous êtes ') + attendu + ' à *' + heure + ' précises*.' : '')
        + (lieu ? '\n📍 ' + lieu : ''), '',
      'Nous comptons sur ' + (pourParent ? 'sa présence' : 'votre présence') + '. À très bientôt ! ✨']
      // (rappel automatique : une personne qui n'a pas encore répondu peut confirmer d'un clic)
      .concat(q.jeton && q.reponse !== 'confirme' && 'reponse' in q ? ['✅ *Pas encore de réponse ? Confirmez en un clic :* ' + LIEN_CONFIRMER + q.jeton] : [])
      .concat(['_L’équipe Maître Akesse Model Management_']).join('\n');
  }

  // « Places limitées » (23/10/2026) : le message WhatsApp envoyé à chaque mannequin (et au parent
  // d'une mineure : même lien, avec &p=1), ou l'annonce d'une place libérée.
  // projet : ligne d'agenda_projets ; appel : { places_femmes, places_hommes } ;
  // pers : { nom, sexe, parent, parent_nom, jeton } ; sorte : 'appel' | 'place_libre'.
  const LIEN_PLACES = 'https://www.maitreakessemodelmanagement.com/places?c=';
  function messagePlaces(projet, appel, pers, sorte) {
    const p = projet || {}, q = pers || {};
    const au = pourLeProjet(p);
    const homme = q.sexe === 'homme';
    const n = Number(homme ? (appel || {}).places_hommes : (appel || {}).places_femmes) || 0;
    const qui = String(q.nom || '').trim();
    const lignes = [
      '✨ *MAÎTRE AKESSE MODEL MANAGEMENT* ✨', '',
      'Bonjour ' + salutation(q) + ',', '',
      sorte === 'place_libre' ? '🔔 *Une place vient de se libérer* ' + au + ' !' : '🎬 *Places limitées* ' + au + ' !', '',
      '📅 *' + dateLongue(p.date_debut) + '*'
    ];
    const heure = heureFr(p.heure_evenement);
    if (heure) lignes.push('🎬 Début : ' + heure);
    const lieu = [p.lieu, p.ville].filter(Boolean).join(', ');
    if (lieu) lignes.push('📍 ' + lieu);
    lignes.push('');
    if (sorte !== 'place_libre' && n) lignes.push('Seulement ' + n + ' place' + (n > 1 ? 's' : '') + ' pour les ' + (homme ? 'hommes' : 'femmes') + '. *Premier arrivé, premier servi !*');
    else lignes.push('*Premier arrivé, premier servi !*');
    lignes.push('👉 ' + (q.parent && qui ? 'Pour inscrire ' + qui + ', appuyez ici' : 'Prenez votre place ici') + ' : ' + LIEN_PLACES + (q.jeton || '') + (q.parent ? '&p=1' : ''));
    lignes.push('', 'Pour toute question : ' + CONTACT + '.', '', '_L’équipe Maître Akesse Model Management_');
    return lignes.join('\n');
  }

  // *gras* et _italique_ de WhatsApp retirés pour la version e-mail (partagé avec
  // messagePourEmail, js/messages-candidats.js)
  function sansMarquesWhatsApp(texte) {
    return String(texte || '')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/(^|[\s(«])_([^_\n]+)_(?=$|[\s.,;:!?)»])/gm, '$1$2');
  }

  const outils = { heureRappelAvant, messageConvocation, messageRelance, messageRappel, messagePlaces, LIEN_PLACES, sansMarquesWhatsApp, heureRappel, dateLongue, MODELE_CONVOCATION, MODELE_SELECTION, EMAIL_AGENCE, LIEN_CONFIRMER };
  if (typeof module !== 'undefined' && module.exports) module.exports = outils;
  else Object.assign(racine, outils);
})(typeof window !== 'undefined' ? window : globalThis);
