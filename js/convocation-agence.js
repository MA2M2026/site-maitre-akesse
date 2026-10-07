// ================== Convocations (textes uniques) ==================
// Un seul texte pour la convocation des candidat(e)s retenu(e)s (intégrer l'agence, et
// casting précis depuis le 07/10/2026 : même présentation, avec le dress code),
// utilisé à la fois par « Messages groupés » (js/messages-groupes.js) et par la fiche
// d'une personne (« Écrire sur WhatsApp », tableau-de-bord.html). Demande de la
// propriétaire (07/10/2026) : le même message, qu'on écrive à une personne ou à un groupe.
// Le changer ici le change partout.
//
// {prénom}, {casting}, {date}, {heure}, {lieu} sont remplis au moment de l'envoi. Le texte est mis en
// forme pour WhatsApp (*gras*, _italique_) ; messagePourEmail() en fait la version e-mail.

const DRESS_CODE = `👗 *Dress code*
👠 _Filles :_ talons, legging long noir et top noir
👞 _Hommes :_ pantalon noir et chaussures noires`;

const CONVOCATION_AGENCE = `✨ *MAÎTRE AKESSE MODEL MANAGEMENT* ✨

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

_L'équipe Maître Akesse Model Management_`;

const CONVOCATION_CASTING = `✨ *MAÎTRE AKESSE MODEL MANAGEMENT* ✨

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

_L'équipe Maître Akesse Model Management_`;

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

// Sans adresse e-mail, la phrase « Un e-mail de confirmation… » serait fausse : on la retire.
function sansPhraseEmail(texte) {
  return texte.split('\n').filter(l => !/Un e-mail de confirmation vous a également été envoyé/i.test(l)).join('\n');
}
// Version e-mail d'un message WhatsApp : sans la phrase qui annonce l'e-mail,
// sans *gras* ni _italique_ (signes qui s'afficheraient tels quels dans un e-mail).
function messagePourEmail(texte) {
  return sansPhraseEmail(texte)
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[\s(«])_([^_\n]+)_(?=$|[\s.,;:!?)»])/gm, '$1$2');
}
