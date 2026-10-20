// Page Contact (contact.html et en/contact.html) : un seul script pour le français et
// l'anglais (11/10/2026 : avant, deux copies dans les pages, avec leur propre liste de villes).
// VILLES_CI : js/app.js ; listes déroulantes « Autre » : js/app.js.
remplirSelectListe('ville', VILLES_CI);
configurerSelectAvecAutre('ville', 'ville-autre');

remplirIndicatifs(document.getElementById('indicatif'));

document.getElementById('form-contact').addEventListener('submit', async function(e){
  e.preventDefault();
  // Civilité devant le nom (décision de la propriétaire, 07/10/2026 : la civilité partout).
  const nom = [document.getElementById('civilite').value, document.getElementById('nom').value.trim()].filter(Boolean).join(' ');
  const telephone = composerTelephone(document.getElementById('indicatif'), document.getElementById('telephone-numero'));
  const email = document.getElementById('email').value.trim();
  const typeContact = document.getElementById('type-contact').value;
  const structure = document.getElementById('structure').value.trim();
  const ville = valeurSelectOuAutre('ville', 'ville-autre');
  const message = document.getElementById('message').value.trim();
  const msg = document.getElementById('msg');
  const boutonEnvoyer = e.target.querySelector('button[type="submit"]');

  boutonEnvoyer.disabled = true;
  msg.className = 'form-msg ok';
  msg.textContent = T('Envoi en cours…', 'Sending…');
  msg.style.display = 'block';

  const { error } = await insererAvecPatience('messages_contact', {
    nom, telephone, email, type_contact: typeContact, structure, ville, message
  }, (reste) => { msg.textContent = texteAttenteEnvoi(reste); });

  boutonEnvoyer.disabled = false;

  if (error) {
    msg.className = 'form-msg err';
    msg.textContent = T('Une erreur est survenue. Réessayez, ou contactez-nous directement par téléphone.', 'An error occurred. Please try again, or contact us directly by phone.');
    return;
  }

  envoyerNotificationEmail({
    name: nom + (typeContact ? ` (${typeContact})` : '') + (structure ? ' — ' + structure : ''),
    telephone: telephone,
    email: email,
    message: (ville ? `${T('Ville : ', 'City: ')}${ville}\n\n` : '') + message
  });

  if (window.jouerSon) window.jouerSon('envoi');
  msg.className = 'form-msg ok';
  msg.textContent = T('Message envoyé ! Nous vous répondrons rapidement.', 'Message sent! We will get back to you shortly.');
  e.target.reset();
});
