// Notifications sur le téléphone (nouvelle candidature, message recruteur ou visiteur, accès
// bloqué : api/notifications-webhook.js). Repris de l'ancien tableau de bord à sa démolition
// (23/10/2026), même fonctionnement :
//  - sur l'accueil, une invitation « Activer les notifications sur cet appareil ? », seulement si
//    ce navigateur n'a encore jamais répondu (demande de la propriétaire, 03/10/2026) ; « Plus
//    tard » la cache pour la session ;
//  - accord déjà donné : le téléphone est réinscrit sans rien demander à chaque ouverture (une
//    inscription perdue côté serveur est refaite) ;
//  - pour arrêter : réglages de notification du téléphone, rien à gérer sur le site.
// Le service de fond /service-worker.js (racine) reçoit et affiche les notifications ; un toucher
// ouvre la fiche concernée dans l'Administration. Table : push_abonnements (droits : comptes admins).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P) return;
  const CLE_VUE = 'ma2m_notif_banniere_vue';
  const possible = notificationsPossibles;  // (js/app.js)
  // les notifications parlent du site (candidatures, recruteurs…) : principal et gestion du site
  const concerne = () => P.moi && (P.moi.role === 'principal' || P.moi.espaces.site);

  async function inscrireCetAppareil() {
    const enregistrement = await navigator.serviceWorker.register('/service-worker.js');
    const j = await abonnementPush(enregistrement);  // (js/app.js)
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await P.bd(sb.from('push_abonnements').upsert({ user_id: user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, appareil: navigator.userAgent, actif: true }, { onConflict: 'endpoint' }));
  }

  function proposer() {
    const tete = document.querySelector('#contenu .accueil-tete');
    if (!tete || document.getElementById('notif-invitation')) return;
    let vue = false;
    try { vue = sessionStorage.getItem(CLE_VUE) === '1'; } catch (e) { /* stockage bloqué */ }
    if (vue) return;
    tete.insertAdjacentHTML('afterend', '<div class="note info ligne" id="notif-invitation" role="status"><span>Recevoir une notification sur cet appareil à chaque nouvelle candidature ou nouveau message ?</span>' +
      '<button class="btn petit rouge" type="button" data-action="notif-oui">Oui, activer</button><button class="btn petit" type="button" data-action="notif-non">Plus tard</button></div>');
  }
  const fermer = () => { const b = document.getElementById('notif-invitation'); if (b) b.remove(); };
  P.actions['notif-oui'] = async () => {
    fermer();
    try {
      if (await Notification.requestPermission() !== 'granted') return;
      await inscrireCetAppareil();
      P.message('Notifications activées sur cet appareil.');
    } catch (e) { P.message('Les notifications n’ont pas pu être activées : ' + P.erreurTexte(e)); }
  };
  P.actions['notif-non'] = () => {
    fermer();
    try { sessionStorage.setItem(CLE_VUE, '1'); } catch (e) { /* stockage bloqué */ }
  };

  // après l'affichage de l'accueil (P.apresPortail, js/admin/coque.js) ; réinscription une seule
  // fois par ouverture de l'Administration, pas à chaque retour sur l'accueil
  const avant = P.apresPortail;
  let inscrit = false;
  P.apresPortail = () => {
    if (avant) avant();
    if (!possible() || !concerne()) return;
    if (Notification.permission === 'granted' && !inscrit) { inscrit = true; inscrireCetAppareil().catch(() => { inscrit = false; }); }
    else if (Notification.permission === 'default') proposer();
  };
  // toucher une notification alors que l'Administration est déjà ouverte : le service de fond du
  // site (/service-worker.js) demande d'ouvrir la fiche concernée
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      const url = e.data && e.data.ma2mOuvrir;
      if (typeof url === 'string' && /^\/admin\/#\/[\w/-]+$/.test(url)) location.href = url;
    });
  }
})();
