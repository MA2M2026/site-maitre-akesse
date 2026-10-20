// Écrans de l'espace 1 « Administration du site » (cahier v2.4, 3.1) : l'ancien tableau de bord
// (tableau-de-bord.html) et les pages Actualités, Événements et Partenaires s'ouvrent DANS
// l'Administration, avec la même connexion — aucune deuxième connexion, aucun argent.
// Actif sur l'adresse de l'Administration (admin.…) et sur un appareil qui a ouvert
// l'Administration (copie d'essai : js/portail/noyau.js pose « ma2m_mode_administration »).
// À charger AVANT js/supabase-config.js : <html data-portail> → session gardée et identifiant
// de l'appareil envoyé à la base (un appareil révoqué est refusé).
// Le verrouillage (code à 4 chiffres après 15 minutes, 8 heures au plus) est celui de
// l'Administration : écran verrouillé ou session finie → retour à l'Administration, qui
// redemande le code puis ramène ici (sessionStorage « ma2m_retour_administration »).
(function () {
  'use strict';
  let actif = false;
  try { actif = /^admin\./.test(location.hostname) || localStorage.getItem('ma2m_mode_administration') === '1'; } catch (e) { /* stockage bloqué */ }
  if (!actif) return;
  document.documentElement.setAttribute('data-portail', '');
  document.documentElement.classList.add('mode-administration');
  // Ouvert DANS le cadre de l'Administration (js/portail/espace-site.js) : même menu, même bouton
  // « Retour au portail » que les autres espaces ; cette page n'affiche plus que son contenu.
  let dansCadre = false;
  try { dansCadre = window.top !== window && new URLSearchParams(location.search).get('cadre') === '1'; } catch (e) { /* page isolée */ }
  if (dansCadre) document.documentElement.classList.add('cadre-admin');

  // Rubriques de l'ancien tableau de bord qui ne sont pas dans l'espace 1 : l'argent (inscriptions
  // et paiements Wave → espace 2) et les anciens accès remplacés par l'Administration (code de
  // validation → double authentification ; « Créer un compte admin » → Sécurité › Comptes et
  // rôles ; code permanent « Créer mon compte » → code personnel de l'espace 2).
  const HORS_ESPACE_1 = ['b2-inscriptions', 'b3b-code-validation', 'b3b-creer-admin', 'b3b-code-permanent'];
  const tableau = /\/tableau-de-bord(\.html)?$/.test(location.pathname);
  let pinDefini = false;

  // Adresse de retour reconstruite morceau par morceau (20/10/2026, audit) : le nom de page vient
  // d'une liste fixe, la fiche ouverte (?actu=…, ?notif=…&id=… d'une notification) et la rubrique (#…) ne sont gardées que si elles
  // n'ont que des lettres, chiffres, « _ » et « - ». Rien de l'adresse n'est recopié tel quel
  // (js/portail/noyau.js refiltre encore avant d'y retourner).
  const PAGES_RETOUR = ['tableau-de-bord', 'actualites', 'evenements', 'partenaires'];
  function adresseRetour() {
    const page = PAGES_RETOUR.map((p) => ['/' + p, '/' + p + '.html']).flat().find((p) => location.pathname === p);
    if (!page) return null;
    let adresse = page;
    const params = new URLSearchParams(location.search);
    const gardes = ['actu', 'evenement', 'partenaire', 'notif', 'id'].filter((c) => /^[\w-]{1,64}$/.test(params.get(c) || ''));
    if (gardes.length) adresse += '?' + gardes.map((c) => c + '=' + encodeURIComponent(params.get(c))).join('&');
    if (/^#[\w-]{1,64}$/.test(location.hash)) adresse += '#' + encodeURIComponent(location.hash.slice(1));
    return adresse;
  }
  function retourAdministration() {
    // (dans le cadre : après le code, on revient aux tuiles du portail, pas à une page isolée)
    const adresse = dansCadre ? null : adresseRetour();
    if (adresse) { try { sessionStorage.setItem('ma2m_retour_administration', adresse); } catch (e) { /* stockage bloqué */ } }
    (dansCadre ? window.top : window).location.replace('/admin/');
  }
  async function deconnecter() {
    window.arreterInactivitePortail();
    try { localStorage.removeItem('ma2m_mode_administration'); } catch (e) { /* stockage bloqué */ }
    try { await sb.auth.signOut(); } catch (e) { /* déjà déconnecté */ }
    await fetch('/api/acces-tableau', { method: 'DELETE', credentials: 'same-origin' }).catch(() => { /* elle expire seule */ });
    (dansCadre ? window.top : window).location.replace('/admin/');
  }
  async function verrouiller() {
    if (pinDefini) await sb.rpc('portail_code_appareil_verrouiller', { p_appareil: identifiantAppareilPortail() }).then(() => { /* verrouillé */ }, () => { /* le serveur verrouille de lui-même */ });
    else {
      // pas de code à 4 chiffres sur cet appareil : connexion complète la prochaine fois
      try { await sb.auth.signOut(); } catch (e) { /* déjà déconnecté */ }
    }
    retourAdministration();
  }
  // Droit d'ouvrir l'espace 1, vérifié par la base (rôle, double authentification, appareil
  // non révoqué, écran non verrouillé, 8 heures au plus)
  async function accesValide() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return false;
    // (même règle que l'Administration, js/portail/noyau.js : sans heure de code, la base décide)
    const code = window.dernierCodeApplicationPortail(data.session);
    if (code && Date.now() - code > window.SESSION_MAX_PORTAIL_MS) return false;
    const r = await sb.rpc('portail_moi');
    return !r.error && !!r.data && !!r.data.role && !!(r.data.espaces && r.data.espaces.site);
  }

  // Barre de l'Administration en haut des pages Actualités, Événements, Partenaires (le tableau
  // de bord a déjà son menu, avec « Accueil de l'Administration » et « Se déconnecter »)
  function barre() {
    const b = document.createElement('div');
    b.className = 'adm-barre';
    b.innerHTML = '<a class="adm-retour" href="/tableau-de-bord.html">‹ Administration du site</a>' +
      '<span class="adm-titre">Administration MA2M</span>' +
      '<button type="button" class="adm-sortie">Se déconnecter</button>';
    b.querySelector('.adm-sortie').addEventListener('click', deconnecter);
    document.body.insertBefore(b, document.body.firstChild);
  }

  window.MA2M_ADMINISTRATION = {
    masquee: (cle) => HORS_ESPACE_1.indexOf(cle) !== -1,
    deconnecter,
    retour: retourAdministration,
    // ouverture impossible (compte sans les droits de l'ancien tableau de bord, serveur
    // injoignable…) : l'Administration affiche le motif (et ne renvoie pas ici, sinon
    // l'aller-retour ne finirait jamais)
    refuser: (motif) => {
      try { sessionStorage.setItem('ma2m_espace1_refuse', motif || 'droits'); } catch (e) { /* stockage bloqué */ }
      (dansCadre ? window.top : window).location.replace('/admin/');
    },
    // vrai une fois l'accès vérifié ; sinon la page repart vers l'Administration
    pret: new Promise((resolve) => {
      const lancer = async () => {
        let ok = false;
        try { ok = await accesValide(); } catch (e) { ok = false; }
        if (!ok) { resolve(false); retourAdministration(); return; }
        const etat = await sb.rpc('portail_code_appareil_etat', { p_appareil: identifiantAppareilPortail() });
        pinDefini = !!(etat.data && etat.data.defini);
        if (!tableau && !dansCadre) barre();
        if (dansCadre) {
          // un geste dans le cadre compte aussi pour le verrouillage de la coque (15 minutes)
          ['pointerdown', 'keydown', 'scroll'].forEach((t) => addEventListener(t, () => { try { window.parent.dispatchEvent(new Event(t)); } catch (e) { /* pas de coque */ } }, { passive: true, capture: true }));
        }
        window.surveillerInactivitePortail({ actif: () => true, pinDefini: () => pinDefini, verrouiller });
        // page laissée ouverte : la base est redemandée toutes les 5 minutes et au retour sur
        // l'écran (téléphone révoqué, accès coupé, 8 heures passées…)
        const controler = () => { accesValide().then((v) => { if (!v) retourAdministration(); }, () => { /* réseau : réessayé plus tard */ }); };
        setInterval(controler, 5 * 60 * 1000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') controler(); });
        resolve(true);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer, { once: true });
      else void lancer();
    })
  };
})();
