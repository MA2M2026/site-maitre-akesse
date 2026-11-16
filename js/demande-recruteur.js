// Demande des recruteurs, page Sélection (selection.html et en/selection.html) : un seul script pour le français et
// l'anglais (11/10/2026 : avant, deux copies dans les pages, avec leur propre liste de villes).
// VILLES_CI : js/app.js ; listes déroulantes « Autre » : js/app.js.
remplirSelectListe('re-ville', VILLES_CI);
configurerSelectAvecAutre('re-ville', 're-ville-autre');

remplirIndicatifs(document.getElementById('re-indicatif'));
remplirIndicatifs(document.getElementById('re-indicatif-whatsapp'));

function afficher() {
  const liste = obtenirSelection();
  const blocVide = document.getElementById('liste-vide');
  const blocSelection = document.getElementById('bloc-selection');
  const conteneur = document.getElementById('selection-liste');

  if (liste.length === 0) {
    blocVide.style.display = 'block';
    blocSelection.style.display = 'none';
    return;
  }
  blocVide.style.display = 'none';
  blocSelection.style.display = 'block';

  conteneur.innerHTML = '';
  liste.forEach(m => {
    const item = document.createElement('div');
    item.className = 'selection-item';
    item.innerHTML = `
      <img src="${echapperHtml(urlLegere(m.photoUrl))}" alt="${echapperHtml(m.full_name)}" class="${EN ? 'ense-7' : 'se-7'}">
      <div class="selection-item-info">
        <div class="nom">${echapperHtml(m.full_name || T('Mannequin', 'Model'))}</div>
        <div class="info">${m.height_cm ? m.height_cm + ' cm' : ''}</div>
      </div>
      <button data-id="${m.id}">${T('Retirer', 'Remove')}</button>
    `;
    conteneur.appendChild(item);
    item.querySelector('img').addEventListener('click', () => ouvrirGalerieLightbox([m.photoUrl], 0));
    item.querySelector('button').addEventListener('click', () => {
      retirerSelection(m.id);
      afficher();
    });
  });
}

document.getElementById('form-recruteur').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('re-msg');
  const btn = document.getElementById('btn-envoyer-recruteur');
  const liste = obtenirSelection();

  if (liste.length === 0) {
    msg.className = 'form-msg err';
    msg.textContent = T('Votre sélection est vide.', 'Your selection is empty.');
    return;
  }

  btn.disabled = true;
  msg.className = 'form-msg ok';
  msg.style.display = 'block';
  msg.textContent = T('Envoi en cours…', 'Sending…');

  const idDemande = crypto.randomUUID();
  const demande = {
    id: idDemande,
    company: document.getElementById('re-entreprise').value.trim(),
    // Civilité devant le nom (décision de la propriétaire, 07/10/2026 : la civilité partout).
    contact_name: [document.getElementById('re-civilite').value, document.getElementById('re-nom').value.trim()].filter(Boolean).join(' '),
    email: document.getElementById('re-email').value.trim(),
    phone: composerTelephone(document.getElementById('re-indicatif'), document.getElementById('re-telephone-numero')),
    whatsapp: composerTelephone(document.getElementById('re-indicatif-whatsapp'), document.getElementById('re-whatsapp-numero')),
    city: valeurSelectOuAutre('re-ville', 're-ville-autre'),
    project_type: document.getElementById('re-type').value.trim(),
    event_date: document.getElementById('re-date').value || null,
    message: document.getElementById('re-message').value.trim(),
    // (16/11/2026, audit R-09) : la liste des mannequins part AVEC la demande ; le serveur enregistre les deux ou
    // rien (api/portail.js) : plus jamais de demande sans sa liste, ni de « Merci » si la liste n'est pas arrivée.
    _modeles: liste.map(m => ({ model_id: m.id, model_name_snapshot: m.full_name, model_height_snapshot: m.height_cm || null }))
  };

  const { error } = await insererAvecPatience('recruiter_requests', demande, (reste) => { msg.className = 'form-msg ok'; msg.textContent = texteAttenteEnvoi(reste); });

  if (error) {
    msg.className = 'form-msg err';
    msg.textContent = T("Votre demande n'a pas été envoyée. Votre sélection est gardée : réessayez dans un instant, ou contactez-nous directement.", 'Your request was not sent. Your selection is kept: please try again in a moment, or contact us directly.');
    btn.disabled = false;
    return;
  }

  const nomsMannequins = liste.map(m => m.full_name).join(', ');
  envoyerNotificationEmail({
    name: demande.contact_name,
    telephone: demande.phone,
    email: demande.email,
    message: EN
      ? `New recruiter casting request.\nCompany: ${demande.company || '-'}\nProject type: ${demande.project_type || '-'}\nCity: ${demande.city || '-'}\nDesired date: ${demande.event_date || '-'}\nSelected models: ${nomsMannequins || '-'}\nMessage: ${demande.message || '-'}`
      : `Nouvelle demande de casting recruteur.\nEntreprise : ${demande.company || '-'}\nType de projet : ${demande.project_type || '-'}\nVille : ${demande.city || '-'}\nDate souhaitée : ${demande.event_date || '-'}\nMannequins sélectionnés : ${nomsMannequins || '-'}\nMessage : ${demande.message || '-'}`
  });

  if (window.jouerSon) window.jouerSon('envoi');
  try { localStorage.removeItem('ma2m_selection'); } catch (e) {}
  document.getElementById('bloc-selection').innerHTML = `
    <div class="${EN ? 'ense-8' : 'se-8'}">${EN ? `
      <h2>Thank You!</h2>
      <p class="u-m-1-auto">Your request has been sent with ${liste.length > 1 ? liste.length + ' models' : '1 model'} selected. The agency will get back to you shortly.</p>
      <a href="mannequins.html" class="btn">Back to Models</a>` : `
      <h2>Merci !</h2>
      <p class="u-m-1-auto">Votre demande a bien été envoyée avec ${liste.length > 1 ? liste.length + ' mannequins sélectionnés' : '1 mannequin sélectionné'}. L'agence vous recontacte rapidement.</p>
      <a href="mannequins.html" class="btn">Retour aux mannequins</a>`}
    </div>
  `;
});

afficher();
