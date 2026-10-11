// Inscription des mannequins (inscription-mannequin.html et en/inscription-mannequin.html) :
// un seul script pour le français et l'anglais (11/10/2026 : avant, deux copies dans les
// pages). Langue : <html lang="en">. Les photos supplémentaires facultatives n'existent que
// sur la page française (le script ne les branche que si leurs champs sont présents).

// Sans bornes min/max, le calendrier natif du champ "date de naissance" laisse
// défiler des années totalement absurdes (ex. 2090) et impose souvent de faire
// défiler très loin pour atteindre un âge plausible — d'où l'impression que la
// sélection "ne marche pas" alors qu'il faut juste taper la date à la main.
(function limiterDateNaissance() {
  const champ = document.getElementById('ins-naissance');
  if (!champ) return;
  const aujourdhui = new Date();
  champ.max = aujourdhui.toISOString().slice(0, 10);
  champ.min = new Date(aujourdhui.getFullYear() - 100, aujourdhui.getMonth(), aujourdhui.getDate()).toISOString().slice(0, 10);
})();

// --- La liste "Taille" elle-même commence à la taille minimale requise selon le
// genre (175 cm femmes, 185 cm hommes) — impossible de choisir en dessous, donc
// plus besoin de bloquer/refuser une inscription après coup. Mineurs exemptés :
// liste complète (140 cm et plus) tant que la date de naissance l'indique. ---
function remplirTailleSelonGenreInscription() {
  const genre = document.getElementById('ins-genre').value;
  const indication = document.getElementById('ins-taille-indication');
  const mineur = estMineurInscription();
  const champ = document.getElementById('ins-taille');
  const valeurActuelle = champ.value;
  const min = mineur ? 140 : (genre === 'homme' ? 185 : (genre === 'femme' ? 175 : 140));

  champ.innerHTML = '';
  champ.appendChild(new Option('—', ''));
  for (let v = min; v <= 210; v++) champ.appendChild(new Option(v + ' cm', v));
  if ([...champ.options].some(o => o.value === valeurActuelle)) champ.value = valeurActuelle;

  if (mineur) { indication.textContent = T('Pas de taille minimale pour les inscriptions de mineurs.', 'No minimum height for minor registrations.'); }
  else if (genre === 'homme') { indication.textContent = T('Taille minimale requise : 185 cm', 'Minimum height required: 185 cm'); }
  else if (genre === 'femme') { indication.textContent = T('Taille minimale requise : 175 cm', 'Minimum height required: 175 cm'); }
  else { indication.textContent = ''; }
}
document.getElementById('ins-genre').addEventListener('change', remplirTailleSelonGenreInscription);
// Civilité choisie par la candidate (décision de la propriétaire, 07/10/2026) : Madame ou
// Mademoiselle pour une femme ; « Monsieur » d'office pour un homme. Sert aux messages.
function majCivilite() {
  const femme = document.getElementById('ins-genre').value === 'femme';
  document.getElementById('ins-civilite-wrap').style.display = femme ? 'block' : 'none';
  document.getElementById('ins-civilite').required = femme;
}
document.getElementById('ins-genre').addEventListener('change', majCivilite);
majCivilite();
document.getElementById('ins-naissance').addEventListener('change', remplirTailleSelonGenreInscription);
remplirTailleSelonGenreInscription();

// --- Liste déroulante avec option "Autre" : garde la souplesse d'un champ libre
// pour les cas non prévus dans la liste, sans forcer une saisie 100% manuelle. ---
document.getElementById('ins-tailleveternents').addEventListener('change', () => {
  const select = document.getElementById('ins-tailleveternents');
  const autre = document.getElementById('ins-tailleveternents-autre');
  autre.style.display = select.value === 'Autre' ? 'block' : 'none';
  if (select.value !== 'Autre') autre.value = '';
});
function valeurTailleVetements() {
  const select = document.getElementById('ins-tailleveternents');
  const autre = document.getElementById('ins-tailleveternents-autre');
  if (select.value === 'Autre') return (autre.value || '').trim();
  return select.value;
}

// Les photos d'inscription ne sont vues que par l'agence pendant la vérification du paiement
// (pas affichées sur Le Book) : elles partent vers Google Drive (envoyerPhotosVersDrive,
// URL_SCRIPT_PHOTOS_CASTING, redimensionnerImage, fichierEnBase64 : js/app.js).

// Photos supplémentaires facultatives, en plus des 4 photos obligatoires
// (portrait/plein pied/profil/sans maquillage — déjà individuellement
// remplaçables en re-sélectionnant leur propre champ). Gestion individuelle
// (ajouter/supprimer/remplacer) sans reprendre toute la sélection —
// cahier des charges, étape 5.
let photosSupplementaires = [];
let indexPhotoSuppARemplacer = null;

function rafraichirApercuPhotosSupp() {
  const apercu = document.getElementById('ins-photos-supp-apercu');
  apercu.innerHTML = photosSupplementaires.map((f, i) => `
    <div class="im-30">
      <img src="${URL.createObjectURL(f)}" class="im-31" alt="Photo ${i + 1}">
      <button type="button" class="ins-photo-supp-remplacer im-32" data-index="${i}" title="${T('Remplacer cette photo', 'Replace this photo')}">⇄</button>
      <button type="button" class="ins-photo-supp-suppr im-33" data-index="${i}" title="${T('Supprimer cette photo', 'Remove this photo')}">✕</button>
    </div>
  `).join('');

  apercu.querySelectorAll('.ins-photo-supp-suppr').forEach(btn => {
    btn.addEventListener('click', () => {
      photosSupplementaires.splice(Number(btn.dataset.index), 1);
      rafraichirApercuPhotosSupp();
    });
  });
  apercu.querySelectorAll('.ins-photo-supp-remplacer').forEach(btn => {
    btn.addEventListener('click', () => {
      indexPhotoSuppARemplacer = Number(btn.dataset.index);
      document.getElementById('ins-photo-supp-remplacement').click();
    });
  });
}

if (document.getElementById('ins-photos-supp')) document.getElementById('ins-photos-supp').addEventListener('change', (e) => {
  photosSupplementaires.push(...Array.from(e.target.files || []));
  e.target.value = '';
  rafraichirApercuPhotosSupp();
});

if (document.getElementById('ins-photo-supp-remplacement')) document.getElementById('ins-photo-supp-remplacement').addEventListener('change', (e) => {
  const fichier = e.target.files[0];
  e.target.value = '';
  if (!fichier || indexPhotoSuppARemplacer === null) return;
  photosSupplementaires[indexPhotoSuppARemplacer] = fichier;
  indexPhotoSuppARemplacer = null;
  rafraichirApercuPhotosSupp();
});

let codeValide = '';

// --- Gestion mineur / parent-tuteur ---
function calculerAgeInscription() {
  const valeur = document.getElementById('ins-naissance').value;
  if (!valeur) return null;
  const naissance = new Date(valeur);
  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - naissance.getFullYear();
  if (aujourdhui < new Date(aujourdhui.getFullYear(), naissance.getMonth(), naissance.getDate())) age -= 1;
  return age;
}
function estMineurInscription() {
  const age = calculerAgeInscription();
  return age !== null && age < 18;
}
document.getElementById('ins-naissance').addEventListener('change', () => {
  const mineur = estMineurInscription();
  document.getElementById('ins-bloc-parent').style.display = mineur ? 'block' : 'none';
  document.getElementById('ins-parent-nom').required = mineur;
  document.getElementById('ins-parent-civilite').required = mineur;
  document.getElementById('ins-parent-telephone-numero').required = mineur;
  document.getElementById('ins-parent-email').required = mineur;
});

remplirIndicatifs(document.getElementById('ins-indicatif'));
remplirIndicatifs(document.getElementById('ins-parent-indicatif'));

// idAppareilMa2m() : partagée dans js/app.js.
function messageTentativeCode(rep, r) {
  if (rep.status === 429) {
    const h = Math.ceil(r.minutesRestantes / 60);
    if (EN) return r.dejaBloque ? `Too many attempts. Access temporarily blocked. Please come back in ${r.minutesRestantes} min.` : `Too many attempts. Access blocked. Please come back in ${h >= 1 ? h + ' hour' + (h > 1 ? 's' : '') : r.minutesRestantes + ' min'}.`;
    return r.dejaBloque ? `Trop de tentatives. Accès temporairement bloqué. Revenez dans ${r.minutesRestantes} min.` : `Trop de tentatives. Accès bloqué. Revenez dans ${h >= 1 ? h + ' heure' + (h > 1 ? 's' : '') : r.minutesRestantes + ' min'}.`;
  }
  return T("Ce code n'est pas reconnu. Vérifiez-le auprès de l'agence.", 'This code is not recognized. Please check it with the agency.') + (r.essaisRestants === 2 ? T(' Attention : il vous reste 2 tentatives.', ' Warning: you have 2 attempts left.') : r.essaisRestants === 1 ? T(' Il vous reste 1 tentative.', ' You have 1 attempt left.') : '');
}

document.getElementById('valider-code-btn').addEventListener('click', async () => {
  const code = document.getElementById('code-inscription').value.trim();
  const msg = document.getElementById('code-msg');
  if (!code) return;
  let rep, r;
  try {
    rep = await fetch('/api/code-protege', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'inscription', code, appareil: idAppareilMa2m() })
    });
    r = await rep.json().catch(() => ({}));
  } catch (e) {
    msg.className = 'form-msg err'; msg.textContent = T('Erreur de connexion — réessayez.', 'Connection error — please try again.'); msg.style.display = 'block';
    return;
  }
  if (!rep.ok) {
    msg.className = 'form-msg err';
    msg.textContent = messageTentativeCode(rep, r);
    msg.style.display = 'block';
    return;
  }
  msg.style.display = 'none';
  codeValide = code;
  document.getElementById('bloc-code').style.display = 'none';
  document.getElementById('form-inscription').style.display = 'block';
});

document.getElementById('ins-conditions').addEventListener('change', (e) => {
  document.getElementById('bloc-paiement').style.display = e.target.checked ? 'block' : 'none';
});

document.getElementById('form-inscription').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('inscription-msg');
  const boutonEnvoyer = e.target.querySelector('button[type="submit"]');
  boutonEnvoyer.disabled = true;

  const mineur = estMineurInscription();
  const genre = document.getElementById('ins-genre').value;
  const taille = parseInt(document.getElementById('ins-taille').value) || 0;

  const dossier = {
    full_name: document.getElementById('ins-nom').value.trim(),
    date_naissance: document.getElementById('ins-naissance').value || null,
    genre: genre,
    civilite: genre === 'homme' ? 'Monsieur' : (document.getElementById('ins-civilite').value || null),
    height_cm: taille || null,
    clothing_size: valeurTailleVetements(),
    phone: composerTelephone(document.getElementById('ins-indicatif'), document.getElementById('ins-telephone-numero')),
    code_utilise: codeValide,
    reference_paiement: document.getElementById('ins-reference-paiement').value.trim(),
    parent_nom: mineur ? [document.getElementById('ins-parent-civilite').value, document.getElementById('ins-parent-nom').value.trim()].filter(Boolean).join(' ') : null,
    parent_telephone: mineur ? composerTelephone(document.getElementById('ins-parent-indicatif'), document.getElementById('ins-parent-telephone-numero')) : null,
    email: document.getElementById('ins-email').value.trim().toLowerCase(),
    parent_email: mineur ? (document.getElementById('ins-parent-email').value.trim().toLowerCase() || null) : null
  };

  // Consommation du code ET création du dossier en une seule opération atomique
  // côté base de données : si l'une des deux étapes échoue (code déjà pris,
  // référence de paiement en double...), tout est annulé automatiquement —
  // le code reste donc intact et réessayable, sans exposer de fonction séparée
  // pour le "libérer" (une telle fonction serait exploitable pour réutiliser
  // n'importe quel code déjà utilisé).
  let idInscription = null, error = null, repEnvoi = null, resEnvoi = {};
  try {
    repEnvoi = await fetch('/api/code-protege', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'inscription-soumettre', code: dossier.code_utilise, appareil: idAppareilMa2m(),
        dossier: {
          p_full_name: dossier.full_name,
          p_date_naissance: dossier.date_naissance,
          p_genre: dossier.genre,
          p_civilite: dossier.civilite,
          p_height_cm: dossier.height_cm,
          p_clothing_size: dossier.clothing_size,
          p_phone: dossier.phone,
          p_reference_paiement: dossier.reference_paiement,
          p_parent_nom: dossier.parent_nom,
          p_parent_telephone: dossier.parent_telephone,
          p_email: dossier.email,
          p_parent_email: dossier.parent_email
        }
      })
    });
    resEnvoi = await repEnvoi.json().catch(() => ({}));
    if (repEnvoi.ok) idInscription = resEnvoi.id;
    else if (repEnvoi.status === 401 || repEnvoi.status === 429) error = { tentative: true };
    else error = { code: resEnvoi.code, message: resEnvoi.message || '' };
  } catch (e) {
    error = { message: '' };
  }

  if (error) {
    boutonEnvoyer.disabled = false;
    msg.className = 'form-msg err';
    if (error.tentative && repEnvoi.status === 429) {
      msg.textContent = messageTentativeCode(repEnvoi, resEnvoi);
    } else if (error.tentative || (error.message && error.message.includes('code_invalide_ou_deja_utilise'))) {
      msg.textContent = T("Ce code n'est plus valable (peut-être déjà utilisé par une autre personne). Contactez l'agence pour obtenir un nouveau code.", 'This code is no longer valid (it may already have been used by someone else). Contact the agency for a new code.');
    } else if (error.code === '23505') {
      msg.textContent = T('Cette référence de paiement Wave a déjà été utilisée pour une autre inscription. Vérifiez que vous avez bien copié VOTRE propre référence, puis réessayez.', 'This Wave payment reference has already been used for another registration. Make sure you copied YOUR OWN reference, then try again.');
    } else {
      msg.textContent = T("Erreur lors de l'envoi. Réessayez, ou contactez directement l'agence.", 'An error occurred while sending. Please try again, or contact the agency directly.');
    }
    msg.style.display = 'block';
    return;
  }

  envoyerNotificationEmail({
    name: dossier.full_name,
    telephone: dossier.phone,
    email: dossier.email,
    message: EN
      ? `New model registration (status: pending payment).\nDate of birth: ${dossier.date_naissance || '-'}\nHeight: ${dossier.height_cm || '-'} cm\nClothing size: ${dossier.clothing_size || '-'}\nCode used: ${dossier.code_utilise}\nWave payment reference: ${dossier.reference_paiement || '-'}${mineur ? `\n⚠️ MINOR — Parent/guardian: ${dossier.parent_nom || '-'} — ${dossier.parent_telephone || '-'}` : ''}`
      : `Nouvelle inscription mannequin (statut : en attente de paiement).\nDate de naissance : ${dossier.date_naissance || '-'}\nTaille : ${dossier.height_cm || '-'} cm\nTaille vêtements : ${dossier.clothing_size || '-'}\nCode utilisé : ${dossier.code_utilise}\nRéférence de paiement Wave : ${dossier.reference_paiement || '-'}${mineur ? `\n⚠️ MINEUR — Parent/tuteur : ${dossier.parent_nom || '-'} — ${dossier.parent_telephone || '-'}` : ''}`
  });

  const fichiers = [
    document.getElementById('ins-photo1').files[0],
    document.getElementById('ins-photo2').files[0],
    document.getElementById('ins-photo3').files[0],
    document.getElementById('ins-photo4').files[0],
    ...photosSupplementaires
  ].filter(Boolean);

  // Le dossier est déjà enregistré côté base de données à ce stade (l'appel RPC
  // ci-dessus a réussi) — un souci sur une ou plusieurs photos (coupure réseau,
  // erreur ponctuelle) ne doit donc jamais laisser la personne bloquée sans
  // retour : chaque photo est isolée dans son propre try/catch, et l'écran de
  // succès s'affiche dans tous les cas, avec un message adapté si besoin.
  let nbPhotosEchouees = 0;
  try {
    const photosBase64 = [];
    for (const fichierOriginal of fichiers) {
      try {
        const fichierConverti = await convertirSiHeic(fichierOriginal);
        const fichier = await redimensionnerImage(fichierConverti);
        photosBase64.push(await fichierEnBase64(fichier));
      } catch (e) {
        nbPhotosEchouees++;
      }
    }

    const { liens, echec } = await envoyerPhotosVersDrive(URL_SCRIPT_PHOTOS_CASTING, {
      nom: dossier.full_name,
      email: '',
      phone: dossier.phone,
      type: 'inscription',
      projet: '',
      photos: photosBase64
    });

    if (!echec) {
      for (const lien of liens) {
        await sb.from('inscriptions_photos').insert({ inscription_id: idInscription, url: lien, chemin: null });
      }
      nbPhotosEchouees += photosBase64.length - liens.length;
    } else {
      nbPhotosEchouees = fichiers.length;
    }
  } catch (e) {
    nbPhotosEchouees = fichiers.length;
  }
  Promise.resolve(journaliserPhotosEchouees('inscription', idInscription, nbPhotosEchouees)).catch(() => {});

  if (window.jouerSon) window.jouerSon('envoi');
  msg.className = 'form-msg ok';
  msg.textContent = nbPhotosEchouees
    ? T(`Dossier envoyé avec succès ! (${nbPhotosEchouees} photo${nbPhotosEchouees > 1 ? 's n\'ont' : ' n\'a'} pas pu être envoyée${nbPhotosEchouees > 1 ? 's' : ''} — contactez l'agence pour les transmettre autrement.)`, `Application sent successfully! (${nbPhotosEchouees} photo${nbPhotosEchouees > 1 ? 's could' : ' could'} not be sent — contact the agency to send ${nbPhotosEchouees > 1 ? 'them' : 'it'} another way.)`)
    : T('Dossier envoyé avec succès !', 'Application sent successfully!');
  msg.style.display = 'block';

  document.getElementById('recu-nom').textContent = dossier.full_name || '-';
  document.getElementById('recu-date').textContent = new Date().toLocaleDateString(EN ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('recu-reference').textContent = dossier.reference_paiement || '-';

  document.getElementById('form-inscription').style.display = 'none';
  document.getElementById('bloc-succes').style.display = 'block';
});

document.getElementById('btn-imprimer-recu').addEventListener('click', () => window.print());
