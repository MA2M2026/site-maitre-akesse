// ================== Messages aux candidat(e)s (textes uniques) ==================
// TOUS les messages des candidatures (intégrer l'agence, casting précis) sont écrits ICI,
// une seule fois, et servent aux deux façons d'envoyer (demande de la propriétaire,
// 07/10/2026) :
//   - à une seule personne : depuis sa fiche (« Écrire sur WhatsApp », tableau-de-bord.html),
//     et le premier message proposé quand on change son statut ;
//   - à un groupe : « Messages groupés » (js/messages-groupes.js), où l'on coche une
//     personne, quelques-unes ou tout le monde.
// Changer un texte ici le change partout.
//
// Repères remplis au moment de l'envoi : {prénom}, {candidature} (« pour intégrer
// l'agence » / « au casting « X » »), {casting}, {date}, {heure}, {lieu}. Textes mis en
// forme pour WhatsApp (*gras*, _italique_) ; messagePourEmail() en fait la version e-mail.

const ENTETE_MESSAGE = '✨ *MAÎTRE AKESSE MODEL MANAGEMENT* ✨';
const SIGNATURE_MESSAGE = "_L'équipe Maître Akesse Model Management_";
function messageCandidat(corps) { return `${ENTETE_MESSAGE}\n\nBonjour {prénom},\n\n${corps}\n\n${SIGNATURE_MESSAGE}`; }

const DRESS_CODE = `👗 *Dress code*
👠 _Filles :_ talons, legging long noir et top noir
👞 _Hommes :_ pantalon noir et chaussures noires`;

const CONVOCATION_AGENCE = `${ENTETE_MESSAGE}

Bonjour {prénom},

Félicitations ! 🎉 Suite à votre candidature sur notre site, nous avons le plaisir de vous annoncer que _votre candidature a été retenue_ pour la prochaine étape de notre sélection.

Nous vous invitons à notre _casting en présentiel_ :

📅 _{date}_
🕒 _{heure}_
📍 _{lieu}_

${DRESS_CODE}

💡 _Bon à savoir :_ ce casting prend la forme d'une _séance de formation et de mise en situation_. Débutant(e) ou expérimenté(e), et même si vous ne maîtrisez pas encore la marche en talons, ce n'est pas un obstacle : nous vous accompagnerons pas à pas.

✅ Merci de _confirmer votre présence_ en répondant à ce message.
📧 Un e-mail de confirmation vous a également été envoyé.

Au plaisir de vous rencontrer !

${SIGNATURE_MESSAGE}`;

const CONVOCATION_CASTING = `${ENTETE_MESSAGE}

Bonjour {prénom},

Félicitations ! 🎉 Suite à votre candidature sur notre site au casting « {casting} », nous avons le plaisir de vous annoncer que _vous êtes sélectionné(e)_ pour la prochaine étape.

Nous vous invitons à vous présenter :

📅 _{date}_
🕒 _{heure}_
📍 _{lieu}_

${DRESS_CODE}

✅ Merci de _confirmer votre présence_ en répondant à ce message.
📧 Un e-mail de confirmation vous a également été envoyé.

Au plaisir de vous rencontrer !

${SIGNATURE_MESSAGE}`;

// Rappel avant le casting (demande de la propriétaire, 07/10/2026 : « relancer les mannequins »).
function rappelCasting(type) {
  const ou = type === 'projet' ? 'notre casting « {casting} »' : 'notre _casting en présentiel_';
  return messageCandidat(`⏰ *Petit rappel* : nous vous attendons à ${ou} :

📅 _{date}_
🕒 _{heure}_
📍 _{lieu}_

${DRESS_CODE}

🕐 Merci d'arriver _15 minutes en avance_.
✅ Si ce n'est pas encore fait, merci de _confirmer votre présence_ en répondant à ce message.
📧 Un e-mail de rappel vous a également été envoyé.

À très vite !`);
}

// Catalogue : chaque message, le statut auquel il correspond et son nom dans les listes.
// « premier » : message envoyé automatiquement quand on change le statut sur la fiche ;
//   il n'apparaît PAS dans les listes « Message tout prêt » ni « Quel message ? »
//   (décision de la propriétaire, 07/10/2026 : on n'a pas à le revoir ensuite).
// « groupe » : message proposé d'office dans « Messages groupés » pour ce statut.
// type = 'agence' ou 'projet' (casting précis).
const MESSAGES_CANDIDATS = [
  { cle: 'etude', statut: 'en étude', premier: true, libelle: '🔎 En étude : 1er message',
    modele: () => messageCandidat(`Suite à votre candidature sur notre site {candidature}, nous vous informons que _votre dossier est en cours d'étude_ par notre équipe.\n\nNous examinons chaque profil avec attention (photos, mensurations, motivations). Vous recevrez notre réponse très prochainement.\n\nMerci pour votre patience et votre confiance. 🙏`) },
  { cle: 'relance_etude', statut: 'en étude', groupe: true, libelle: '🔎 En étude : relance',
    modele: () => messageCandidat(`Nous revenons vers vous au sujet de votre candidature {candidature}. _Votre dossier est toujours en cours d'étude_ : nous recevons de nombreuses candidatures et prenons le temps d'examiner chacune avec attention.\n\nNous vous donnerons notre réponse très prochainement. Merci pour votre patience ! 🙏`) },
  { cle: 'attente', statut: 'en attente', premier: true, libelle: '⏳ En attente : 1er message',
    modele: () => messageCandidat(`Suite à votre candidature sur notre site {candidature}, nous vous informons que _votre dossier a retenu notre attention_ et se trouve actuellement _en liste d'attente_.\n\nNotre équipe finalise sa sélection. Nous reviendrons vers vous dès qu'une décision sera prise : gardez votre téléphone à portée de main ! 📱`) },
  { cle: 'relance_attente', statut: 'en attente', groupe: true, libelle: '⏳ En attente : relance',
    modele: () => messageCandidat(`Nous revenons vers vous au sujet de votre candidature {candidature}. _Votre dossier est toujours en liste d'attente_ : notre sélection n'est pas terminée et une place peut se libérer à tout moment.\n\nNous vous contacterons dès que possible. Restez disponible ! 📱`) },
  { cle: 'retenue', statut: 'retenue', premier: true, libelle: '✅ Retenue : 1er message',
    modele: () => messageCandidat(`Félicitations ! 🎉 Suite à votre candidature sur notre site {candidature}, nous avons le plaisir de vous annoncer que _votre profil a été retenu_.\n\n📩 Vous recevrez très prochainement un second message avec toutes les informations pratiques : _date, heure et lieu_.\n\nMerci pour votre confiance !`) },
  { cle: 'convocation', statut: 'retenue', groupe: true, rdv: true, libelle: '📅 Retenue : convocation (date, heure, lieu)',
    modele: (type) => type === 'projet' ? CONVOCATION_CASTING : CONVOCATION_AGENCE },
  { cle: 'rappel', statut: 'retenue', rdv: true, libelle: '⏰ Retenue : rappel du casting',
    modele: (type) => rappelCasting(type) },
  { cle: 'refusee', statut: 'refusée', premier: true, groupe: true, libelle: '✉️ Non retenue : 1er message',
    modele: () => messageCandidat(`Nous vous remercions sincèrement pour votre candidature sur notre site {candidature} et pour le temps que vous nous avez consacré.\n\nAprès étude attentive, _votre profil n'a pas été retenu_ pour cette sélection.\n\n🌟 Cette décision ne remet pas en cause votre potentiel : nos besoins changent d'un casting à l'autre. Nous vous souhaitons beaucoup de réussite.`) }
];
function messageCandidatParCle(cle) { return MESSAGES_CANDIDATS.find(m => m.cle === cle) || null; }
function typeCandidature(d) { return d && d.type_candidature === 'projet' ? 'projet' : 'agence'; }

// {date}, {heure}, {lieu} : rdv = { date: 'AAAA-MM-JJ', heure, lieu } ; une valeur vide
// est remplacée par manquant('date' | 'heure' | 'lieu').
function remplirRdv(texte, rdv, manquant) {
  const v = { date: dateLongueFr(rdv && rdv.date), heure: String((rdv && rdv.heure) || '').trim(), lieu: String((rdv && rdv.lieu) || '').trim() };
  return texte.replace(/\{(date|heure|lieu)\}/gi, (m, k) => v[k.toLowerCase()] || manquant(k.toLowerCase()));
}
// Message prêt pour UNE personne (d = sa candidature ou son inscription).
function personnaliserMessage(texte, d, rdv, manquant) {
  const candidature = d.type_candidature === 'agence' ? "pour intégrer l'agence"
    : d.type_candidature === 'projet' && d.projet_nom ? `au casting « ${d.projet_nom} »` : 'à notre casting';
  return remplirRdv(d.email ? texte : sansPhraseEmail(texte), rdv, manquant)
    .replace(/\{pr[ée]nom\}/gi, prenomDe(d.full_name) || 'Madame, Monsieur')
    .replace(/\{candidature\}/gi, candidature)
    .replace(/\{casting\}/gi, d.projet_nom || 'notre casting');
}

// Dimanche qui suit (jamais aujourd'hui), au format d'une case date : 'AAAA-MM-JJ'.
function dimancheSuivantISO() {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// 'AAAA-MM-JJ' -> « Dimanche 12 octobre 2026 » ('' si la date est vide ou invalide).
function dateLongueFr(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return '';
  const t = new Date(v + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Heure et lieu retenus sur cet appareil (mêmes valeurs pour la fiche et les messages groupés).
const INFOS_RDV_DEFAUT = { heure: '15 h 00', lieu: 'Riviera Faya, Cité ATCI' };
function infosRdvMemorisees() {
  const lire = (cle, defaut) => { try { return localStorage.getItem(cle) || defaut; } catch (e) { return defaut; } };
  return { heure: lire('ma2m_mg_heure', INFOS_RDV_DEFAUT.heure), lieu: lire('ma2m_mg_lieu', INFOS_RDV_DEFAUT.lieu) };
}
function memoriserInfosRdv(heure, lieu) {
  try { localStorage.setItem('ma2m_mg_heure', String(heure || '').trim()); localStorage.setItem('ma2m_mg_lieu', String(lieu || '').trim()); } catch (e) {}
}

// Sans adresse e-mail, la phrase « Un e-mail de confirmation (ou de rappel)… » serait
// fausse : on la retire.
function sansPhraseEmail(texte) {
  return texte.split('\n').filter(l => !/Un e-mail de (confirmation|rappel) vous a également été envoyé/i.test(l)).join('\n');
}
// Version e-mail d'un message WhatsApp : sans la phrase qui annonce l'e-mail,
// sans *gras* ni _italique_ (signes qui s'afficheraient tels quels dans un e-mail).
function messagePourEmail(texte) {
  return sansPhraseEmail(texte)
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[\s(«])_([^_\n]+)_(?=$|[\s.,;:!?)»])/gm, '$1$2');
}
