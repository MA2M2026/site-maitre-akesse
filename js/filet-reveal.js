// Filet de sécurité (partagé par les pages publiques et le tableau de bord, 11/10/2026 : avant,
// recopié dans 33 pages ; chargé en « async » pour ne jamais retarder l'affichage).
// Sur une connexion instable, un script externe (Supabase, EmailJS, heic2any...) peut être
// très lent ou échouer à charger — dans ce cas js/app.js ne s'exécute jamais et les éléments
// ".reveal" (animation d'apparition au défilement) restent invisibles, alors que le reste de
// la page fonctionne. Ce filet les révèle de force après 2,5 s si l'animation normale n'a pas
// eu lieu, pour qu'aucun contenu ne reste caché à cause d'un simple souci réseau.
setTimeout(() => {
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => el.classList.add('visible'));
}, 2500);
