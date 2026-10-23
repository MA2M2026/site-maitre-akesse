// Messages des convocations aux projets de l'agenda (Extension 141, 21/10/2026, demande de la
// propriétaire) : un beau message personnalisé pour chaque participant, avec la date, l'heure de
// l'événement, l'heure de convocation, le lieu exact, le programme de la journée et « À prévoir ».
// Partagé par le tableau de bord (navigateur : aperçu, envoi immédiat, WhatsApp) et par le serveur
// du site (api/portail.js : envois programmés et rappel de la veille). Changer un texte ici le
// change partout.
//
// Repères d'un message personnalisé (champ « Message » du projet) : {salutation}, {introduction},
// {projet}, {date}, {heure_evenement}, {lieu}, {adresse}, {convocation}, {programme}, {a_prevoir},
// {confirmer} (lien personnel « Je confirme ma présence »).
// Une ligne dont un repère est vide (pas d'adresse, pas de programme…) disparaît du message.
(function (racine) {
  'use strict';
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  // « au défilé », « à la formation »… (types de l'agenda : MA2M_TYPES_AGENDA, js/app.js)
  const AU_TYPE = { defile: 'au défilé', shooting: 'au shooting', casting: 'au casting', formation: 'à la formation', evenement: 'à l’événement', autre: 'au projet' };
  const CONTACT = 'WhatsApp +225 05 45 65 66 87';
  const LIEN_CONFIRMER = 'https://www.maitreakessemodelmanagement.com/confirmer?c=';
  const EMAIL_AGENCE = 'infos.ma2m@gmail.com';  // = MA2M_EMAIL (js/app.js) : alertes « WhatsApp à envoyer »

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
    'Merci d’arriver à l’heure.',
    '✅ *Confirmez votre présence en un clic :* {confirmer}',
    'Pour toute question : ' + CONTACT + '.',
    '',
    '_L’équipe Maître Akesse Model Management_'
  ].join('\n');

  // Premier message : « Annoncer la sélection » (demande de la propriétaire, 23/10/2026). Court :
  // le projet, la date, l'heure, le lieu, et le même lien personnel de confirmation ; la
  // convocation (tous les détails) suit plus tard. Toujours ce modèle (le message personnalisé
  // du projet ne vaut que pour la convocation).
  const MODELE_SELECTION = [
    '✨ *MAÎTRE AKESSE MODEL MANAGEMENT* ✨',
    '',
    'Bonjour {salutation},',
    '',
    '🎉 *Félicitations !* {introduction}',
    '',
    '📅 *{date}*',
    '🎬 Début : {heure_evenement}',
    '📍 {lieu}',
    '',
    'Vous recevrez un second message avec tous les détails (heure de convocation, programme, à prévoir).',
    '',
    '✅ *Confirmez votre participation en un clic :* {confirmer}',
    'Pour toute question : ' + CONTACT + '.',
    '',
    '_L’équipe Maître Akesse Model Management_'
  ].join('\n');

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
  // Accord selon la civilité : « convoquée » pour Madame / Mademoiselle
  const feminin = (nom) => /^(Madame|Mademoiselle)\b/.test(String(nom || ''));

  // Heure du rappel de la veille, comme la base (convocation_heure_rappel) : Abidjan = UTC.
  function heureRappel(dateDebut, heure) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateDebut || ''));
    if (!m) return null;
    const h = /^\d{2}:\d{2}$/.test(heure || '') ? heure : '18:00';
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] - 1, +h.slice(0, 2), +h.slice(3)));
  }

  // projet : ligne d'agenda_projets ; participant : { nom, parent, parent_nom } ;
  // sorte : 'selection' | 'convocation' | 'rappel'. Renvoie { texte (WhatsApp, *gras*), email (sans marques) }.
  function messageConvocation(projet, participant, sorte) {
    const p = projet || {}, q = participant || {};
    const titre = String(p.titre || '').trim();
    const au = (AU_TYPE[p.type] || AU_TYPE.autre) + (titre ? ' *« ' + titre + ' »*' : '');
    const parent = !!q.parent;
    const qui = String(q.nom || '').trim();
    const premiereSeance = (Array.isArray(p.seances) ? p.seances : []).find((s) => s && s.debut);
    const heureEvenement = heureFr(p.heure_evenement) || heureFr(premiereSeance && premiereSeance.debut);
    const convoque = feminin(qui) ? 'convoquée' : 'convoqué';
    const selectionne = feminin(qui) ? 'sélectionnée' : /^Monsieur\b/.test(qui) ? 'sélectionné' : 'sélectionné(e)';
    const valeurs = {
      salutation: parent ? (String(q.parent_nom || '').trim() || 'Madame, Monsieur') : (qui || 'Madame, Monsieur'),
      introduction: sorte === 'selection'
        ? (parent && qui ? qui + ' est ' + selectionne : 'Vous êtes ' + selectionne) + ' ' + au.replace(/^au /, 'pour le ').replace(/^à (la |l’)/, 'pour $1') + '.'
        : sorte === 'rappel'
        ? '⏰ *Petit rappel : c’est demain !* Voici toutes les informations pour ' + (parent && qui ? 'la participation de ' + qui : 'votre participation') + ' ' + au + '.'
        : 'Maître Akesse Model Management a le plaisir de vous confirmer ' + (parent && qui ? 'la participation de ' + qui : 'votre participation') + ' ' + au + '.',
      projet: titre,
      date: dateLongue(p.date_debut),
      heure_evenement: heureEvenement,
      lieu: [p.lieu, p.ville].filter(Boolean).join(', '),
      adresse: String(p.adresse || '').trim(),
      convocation: heureFr(p.heure_convocation)
        ? (parent && qui ? qui + ' est ' + convoque : 'Vous êtes ' + convoque) + ' à ' + heureFr(p.heure_convocation) + ' précises.'
        : '',
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

  // *gras* et _italique_ de WhatsApp retirés pour la version e-mail (partagé avec
  // messagePourEmail, js/messages-candidats.js)
  function sansMarquesWhatsApp(texte) {
    return String(texte || '')
      .replace(/\*([^*\n]+)\*/g, '$1')
      .replace(/(^|[\s(«])_([^_\n]+)_(?=$|[\s.,;:!?)»])/gm, '$1$2');
  }

  const outils = { messageConvocation, sansMarquesWhatsApp, heureRappel, dateLongue, MODELE_CONVOCATION, MODELE_SELECTION, EMAIL_AGENCE, LIEN_CONFIRMER };
  if (typeof module !== 'undefined' && module.exports) module.exports = outils;
  else Object.assign(racine, outils);
})(typeof window !== 'undefined' ? window : globalThis);
