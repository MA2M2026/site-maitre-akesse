// Note d'intégration (PDF) — 14/10/2026, demande de la propriétaire : document remis aux
// mannequins seulement après la validation de leur code d'inscription. Rangé dans R2 sous
// un nom secret (prive/note-integration/<32 caractères hexadécimaux>.pdf, api/_r2.js) ; le
// nouveau dépôt remplace l'ancien (action 'nettoyer' après un envoi réussi).
// Partagé le 22/10/2026 : l'ancien tableau de bord le démarre tout seul ; la nouvelle
// Administration appelle window.demarrerNoteIntegration() à chaque affichage de « Codes d'accès ».
window.demarrerNoteIntegration = function () {
  const champ = document.getElementById('ni-fichier');
  if (!champ) return;
  const bouton = document.getElementById('ni-envoyer-btn'), etat = document.getElementById('ni-etat'), msg = document.getElementById('ni-msg');
  const dire = (texte, ok) => { msg.className = 'form-msg ' + (ok ? 'ok' : 'err'); msg.textContent = texte; };
  let demande = 0;  // seule la réponse la plus récente s'affiche
  async function afficherEtat() {
    const numero = ++demande;
    try {
      const n = await actionImageSite({ action: 'lire', categorie: 'note-integration' });
      if (numero !== demande) return;
      etat.textContent = '';
      if (!n.chemin) { etat.textContent = 'Aucun document déposé : les mannequins ne voient pas encore de note d’intégration.'; return; }
      etat.append('Document en place, déposé le ' + new Date(n.date).toLocaleDateString('fr-FR') + '. ');
      const lien = document.createElement('a');
      lien.href = PHOTOS_DIRECTES + n.chemin; lien.target = '_blank'; lien.rel = 'noopener'; lien.textContent = 'Voir le document';
      etat.append(lien);
    } catch (e) { if (numero === demande) etat.textContent = 'État du document indisponible : ' + e.message; }
  }
  champ.addEventListener('change', () => {
    const f = champ.files[0];
    bouton.disabled = !f;
    if (f && f.type !== 'application/pdf') { bouton.disabled = true; dire('Choisissez un fichier PDF.', false); }
    else if (f && f.size > 15 * 1024 * 1024) { bouton.disabled = true; dire('Document trop lourd (15 Mo au maximum).', false); }
    else msg.textContent = '';
  });
  bouton.addEventListener('click', async () => {
    const f = champ.files[0];
    if (!f) return;
    bouton.disabled = true; dire('Envoi en cours…', true);
    const octets = crypto.getRandomValues(new Uint8Array(16));
    const chemin = 'prive/note-integration/' + Array.from(octets, o => o.toString(16).padStart(2, '0')).join('') + '.pdf';
    try {
      await envoyerImageSite('note-integration', chemin, f);
    } catch (e) {
      dire('Le dépôt a échoué : ' + e.message, false);
      bouton.disabled = false;
      return;
    }
    // Le nouveau document est en place ; retirer les anciens est un plus (refait au prochain dépôt).
    let nettoye = true;
    try { await actionImageSite({ action: 'nettoyer', categorie: 'note-integration', chemin }); } catch (e) { nettoye = false; }
    dire('Document déposé : les mannequins le verront après avoir validé leur code.' + (nettoye ? '' : ' (L’ancien document n’a pas pu être retiré ; il le sera au prochain dépôt.)'), true);
    champ.value = '';
    void afficherEtat();
  });
  // État relu à chaque ouverture de « Codes d'inscription » (la session n'est pas toujours
  // prête au chargement de la page).
  document.querySelectorAll('[data-tdb-cible="b3b-codes-inscription"]').forEach(el => el.addEventListener('click', () => { void afficherEtat(); }));
  void afficherEtat();
};
window.demarrerNoteIntegration();
