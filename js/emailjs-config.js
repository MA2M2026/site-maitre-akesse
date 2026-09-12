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
