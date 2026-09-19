// Configuration EmailJS — notifications automatiques MA2M
const EMAILJS_PUBLIC_KEY = 'iRmm0sDj_w3MBx3SK';
const EMAILJS_SERVICE_ID = 'service_771y6u7';
const EMAILJS_TEMPLATE_ID = 'template_ywa7bwn';

if (typeof emailjs !== 'undefined') {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

// Envoie une notification par e-mail à l'agence. N'interrompt jamais le parcours
// utilisateur si ça échoue : la donnée est de toute façon déjà enregistrée dans Supabase.
function envoyerNotificationEmail({ name, telephone, email, message }) {
  if (typeof emailjs === 'undefined') return;
  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { name, telephone, email, message })
    .catch(err => console.error('Notification e-mail non envoyée :', err));
}

// Template distinct de celui ci-dessus : celui-ci envoie AU candidat/mannequin
// (destinataire différent à chaque envoi), donc il doit être configuré dans EmailJS
// avec un champ "To Email" dynamique ({{to_email}}), contrairement au template
// EMAILJS_TEMPLATE_ID ci-dessus qui envoie toujours à l'agence.
const EMAILJS_TEMPLATE_ID_CANDIDAT = 'template_q3qpg4p';

function envoyerEmailCandidat({ to_email, to_name, message }) {
  if (typeof emailjs === 'undefined') return Promise.reject(new Error('EmailJS non chargé'));
  if (!to_email) return Promise.reject(new Error('Aucune adresse e-mail pour ce dossier'));
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID_CANDIDAT, { to_email, to_name, message });
}
