// Connexion au tableau de bord (13/10/2026 : sortie de js/tableau-de-bord.js). Ce fichier est
// livré à tout le monde avec l'écran de connexion ; le reste du tableau de bord (page et scripts)
// n'est livré par le serveur (middleware.js) qu'après une connexion admin complète — mot de
// passe puis code de validation — grâce à une clé signée (cookie, voir api/acces-tableau.js).
// Sans cette clé, la page arrive sans le tableau de bord : après la connexion, on recharge.
// La sidebar du centre de contrôle (Étape 12) a son propre logo et sa propre
// navigation : une fois connecté, le header public et le titre "Administration"
// deviennent redondants. On les masque (jamais supprimés du DOM) pour que les
// écrans de connexion, eux, gardent le même habillage qu'avant.
function afficherChromePublic(afficher) {
  document.querySelectorAll('.db-chrome-public').forEach(el => {
    el.style.display = afficher ? '' : 'none';
  });
}

async function verifierAdminTableau() {
  if (!sb) return false;
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data } = await sb.from('admins').select('user_id').eq('user_id', user.id).single();
  return !!data;
}

// Jeton de réinitialisation du code de validation, reçu par e-mail sous forme
// de lien ?reset_code=... — retiré de l'URL immédiatement pour ne pas rester
// visible dans l'historique du navigateur.
let tokenReinitCodeEnAttente = null;
(function () {
  const p = new URLSearchParams(window.location.search).get('reset_code');
  if (p) {
    tokenReinitCodeEnAttente = p;
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

// Le code de validation n'est redemandé qu'une fois par session de navigateur
// (sessionStorage, effacé à la fermeture de l'onglet) — pas à chaque simple
// rechargement de page, pour ne pas être redondant avec le mot de passe.
function codeValideEnSession() {
  try { return sessionStorage.getItem('ma2m_code_valide') === '1'; } catch (e) { return false; }
}
function marquerCodeValide() {
  try { sessionStorage.setItem('ma2m_code_valide', '1'); } catch (e) {}
}
function effacerCodeValide() {
  try { sessionStorage.removeItem('ma2m_code_valide'); } catch (e) {}
}

function masquerBlocsConnexion() {
  ['bloc-login', 'bloc-mdp-oublie', 'bloc-nouveau-mdp', 'bloc-code-validation', 'bloc-code-oublie', 'bloc-code-nouveau', 'bloc-tableau']
    .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}

// Clé d'accès au tableau de bord (13/10/2026, voir api/acces-tableau.js et middleware.js) :
// le serveur ne livre le vrai tableau de bord qu'avec cette clé. Renvoie 'ok', 'code' (le
// code de validation doit d'abord être saisi) ou 'erreur'.
async function ouvrirAccesServeur() {
  try {
    const jeton = await jetonSessionCourante();  // js/app.js
    if (!jeton) return 'erreur';
    const reponse = await fetch('/api/acces-tableau', { method: 'POST', headers: { Authorization: 'Bearer ' + jeton }, credentials: 'same-origin' });
    if (reponse.ok) return 'ok';
    const resultat = await reponse.json().catch(() => ({}));
    return resultat.code === 'requis' ? 'code' : 'erreur';
  } catch (e) { return 'erreur'; }
}
function fermerAccesServeur() {
  fetch('/api/acces-tableau', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
}
function demanderCode() {
  effacerCodeValide();
  masquerBlocsConnexion();
  document.getElementById('bloc-code-validation').style.display = 'block';
  afficherChromePublic(true);
}

// Garde-fou : au plus 2 rechargements pour la clé en 2 minutes (cookies bloqués par le
// navigateur, panne passagère…) — sinon un message, jamais une page qui tourne en boucle.
function rechargerPourAcces() {
  let n = 0;
  try {
    const t = JSON.parse(sessionStorage.getItem('ma2m_recharge_acces') || '{}');
    n = t.at && Date.now() - t.at < 120000 ? t.n : 0;
    sessionStorage.setItem('ma2m_recharge_acces', JSON.stringify({ n: n + 1, at: Date.now() }));
  } catch (e) {}
  if (n >= 2) return false;
  window.location.reload();
  return true;
}

// cleDejaPosee : la clé vient d'être posée par la validation du code (api/code-validation-protege.js).
async function reveleTableauDeBord(cleDejaPosee) {
  // Page servie sans le tableau de bord (visiteur pas encore reconnu par le serveur)
  if (!document.getElementById('bloc-tableau')) {
    const acces = cleDejaPosee ? 'ok' : await ouvrirAccesServeur();
    if (acces === 'ok' && rechargerPourAcces()) return;
    // ouvert dans l'Administration : pas de déconnexion ni d'ancien code, on y retourne avec le motif
    if (window.MA2M_ADMINISTRATION) { window.MA2M_ADMINISTRATION.refuser('ouverture'); return; }
    if (acces === 'code') { demanderCode(); return; }
    await deconnecterTableauDeBord(acces === 'ok'
      ? "Le tableau de bord ne s'ouvre pas : vérifiez que les cookies sont autorisés pour ce site dans votre navigateur, puis reconnectez-vous."
      : 'Ouverture impossible pour le moment — reconnectez-vous.');
    return;
  }
  try { sessionStorage.removeItem('ma2m_recharge_acces'); } catch (e) {}
  if (!cleDejaPosee) void ouvrirAccesServeur();  // prolonge la clé de 12 h (voir api/acces-tableau.js)
  masquerBlocsConnexion();
  document.getElementById('bloc-tableau').style.display = 'block';
  afficherChromePublic(false);
  void chargerStatistiques();
  void chargerStatutCodeValidation();
  if (window.tdbRestaurerOuAccueil) window.tdbRestaurerOuAccueil();
  else if (window.tdbRetourAccueil) window.tdbRetourAccueil();
  demarrerMinuteurInactivite();
  if (window.ma2mNotificationsApresConnexion) window.ma2mNotificationsApresConnexion();
  setTimeout(() => { rattraperPhotosEnArrierePlan().catch(e => console.warn('Rattrapage des photos :', e)); }, 8000);
}

// Sur mobile, un simple aller-retour réseau peut échouer une fois sans
// raison (coupure d'une fraction de seconde) — sans nouvelle tentative,
// cette vérification (pourtant nécessaire, voir plus bas) forçait une
// reconnexion complète à chaque petit accroc réseau, y compris juste
// après avoir saisi le bon mot de passe (signalé le 28 septembre 2026 :
// "je mets le mot de passe, mais ça passe pas... le système réinitialise
// chaque fois"). On retente donc 3 fois avant de conclure à un vrai échec.
async function obtenirStatutCodeValidationAvecRetry() {
  let derniereErreur = null;
  for (let essai = 1; essai <= 3; essai++) {
    const { data, error } = await sb.rpc('code_validation_statut');
    if (!error) return { data, error: null };
    derniereErreur = error;
    if (essai < 3) await new Promise((r) => setTimeout(r, 600 * essai));
  }
  return { data: null, error: derniereErreur };
}

// Appelée après toute connexion réussie (mot de passe ou reset mdp) déjà
// confirmée admin : décide s'il faut encore demander le code de validation.
async function apresConnexionReussie() {
  if (tokenReinitCodeEnAttente) {
    masquerBlocsConnexion();
    document.getElementById('bloc-code-nouveau').style.display = 'block';
    return;
  }
  if (codeValideEnSession()) { await reveleTableauDeBord(); return; }

  const { data, error } = await obtenirStatutCodeValidationAvecRetry();
  // Sécurité : en cas d'échec de cette vérification (réseau, erreur
  // serveur) qui persiste après plusieurs tentatives, on ne doit JAMAIS
  // ouvrir le tableau de bord par défaut — avant, une erreur ici laissait
  // passer directement, sans jamais redemander le code (faille détectée
  // le 28 septembre 2026). On déconnecte proprement et on redemande une
  // connexion complète.
  if (error) {
    await deconnecterTableauDeBord('Vérification impossible pour le moment — reconnectez-vous.');
    return;
  }
  const ligne = Array.isArray(data) ? data[0] : data;
  if (ligne && ligne.defini) {
    masquerBlocsConnexion();
    document.getElementById('bloc-code-validation').style.display = 'block';
    return;
  }
  await reveleTableauDeBord();
}

// idAppareilMa2m() : partagée dans js/app.js.
document.getElementById('tb-login-btn').addEventListener('click', async () => {
  const email = document.getElementById('tb-email').value.trim();
  const password = document.getElementById('tb-password').value;
  const msg = document.getElementById('tb-msg');
  msg.className = 'form-msg err'; msg.textContent = ''; msg.style.display = 'block';
  try {
    const reponse = await fetch('/api/connexion-protegee', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, espace: 'admin', appareil: idAppareilMa2m() })
    });
    const resultat = await reponse.json().catch(() => ({}));
    if (reponse.status === 403) { msg.textContent = "Ce compte n'a pas accès au tableau de bord."; return; }
    const refus = messageAccesRefuse(reponse, resultat, 'Connexion refusée'); // js/app.js
    if (refus) { msg.textContent = refus; return; }
    const { error } = await sb.auth.setSession({ access_token: resultat.access_token, refresh_token: resultat.refresh_token });
    if (error) { msg.textContent = 'Erreur de connexion — réessayez.'; return; }
    msg.style.display = 'none';
    await apresConnexionReussie();
  } catch (e) {
    msg.textContent = 'Erreur de connexion — réessayez.';
  }
});

async function deconnecterTableauDeBord(motif) {
  // ouvert dans l'Administration (js/mode-administration.js) : on se déconnecte de l'Administration
  if (window.MA2M_ADMINISTRATION) { await window.MA2M_ADMINISTRATION.deconnecter(); return; }
  arreterMinuteurInactivite();
  await sb.auth.signOut();
  effacerCodeValide();
  fermerAccesServeur();
  const tableau = document.getElementById('bloc-tableau');
  if (tableau) tableau.style.display = 'none';
  document.getElementById('bloc-login').style.display = 'block';
  afficherChromePublic(true);
  if (motif) {
    const msg = document.getElementById('tb-msg');
    if (msg) { msg.className = 'form-msg err'; msg.textContent = motif; msg.style.display = 'block'; }
  }
}


// ===== Verrouillage automatique après 15 minutes d'inactivité (demande de
// la propriétaire, 28 septembre 2026) : redemande uniquement le code de
// validation (pas e-mail + mot de passe) si un code est déjà activé —
// la session Supabase reste valide en arrière-plan, seul l'écran se
// reverrouille, comme un cadenas rapide. Si aucun code n'a encore été
// activé, il n'y a rien à redemander de cette façon : on repasse alors
// par la déconnexion complète habituelle. =====
async function verrouillerParInactivite() {
  arreterMinuteurInactivite();
  effacerCodeValide();
  const { data, error } = await obtenirStatutCodeValidationAvecRetry();
  const ligne = Array.isArray(data) ? data[0] : data;
  if (error || !ligne || !ligne.defini) {
    await deconnecterTableauDeBord("Session verrouillée après 15 minutes d'inactivité — reconnectez-vous.");
    return;
  }
  masquerBlocsConnexion();
  document.getElementById('bloc-code-validation').style.display = 'block';
  afficherChromePublic(true);
  const msg = document.getElementById('tb-code-validation-msg');
  if (msg) { msg.className = 'form-msg ok'; msg.textContent = "Session verrouillée après 15 minutes d'inactivité — ressaisissez votre code."; msg.style.display = 'block'; }
}

const DELAI_INACTIVITE_MS = 15 * 60 * 1000;
let minuteurInactivite = null;
function demarrerMinuteurInactivite() {
  if (window.MA2M_ADMINISTRATION) return;  // verrouillage de l'Administration (code à 4 chiffres)
  if (minuteurInactivite) clearTimeout(minuteurInactivite);
  minuteurInactivite = setTimeout(verrouillerParInactivite, DELAI_INACTIVITE_MS);
}
function arreterMinuteurInactivite() {
  if (minuteurInactivite) { clearTimeout(minuteurInactivite); minuteurInactivite = null; }
}
['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(function (evt) {
  document.addEventListener(evt, function () { if (minuteurInactivite) demarrerMinuteurInactivite(); }, { passive: true });
});

document.getElementById('tb-code-validation-valider').addEventListener('click', async () => {
  const code = document.getElementById('tb-code-validation').value;
  const msg = document.getElementById('tb-code-validation-msg');
  if (!code) return;
  msg.className = 'form-msg err'; msg.textContent = ''; msg.style.display = 'block';
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { msg.textContent = 'Session expirée — reconnectez-vous.'; return; }
  try {
    const reponse = await fetch('/api/code-validation-protege', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ code, appareil: idAppareilMa2m() })
    });
    const resultat = await reponse.json().catch(() => ({}));
    const refus = messageAccesRefuse(reponse, resultat, 'Code de validation incorrect'); // js/app.js
    if (refus) { msg.textContent = refus; return; }
    marquerCodeValide();
    document.getElementById('tb-code-validation').value = '';
    msg.style.display = 'none';
    await reveleTableauDeBord(true);
  } catch (e) {
    msg.textContent = 'Erreur serveur — réessayez.';
  }
});

document.getElementById('tb-code-oublie-lien').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('bloc-code-validation').style.display = 'none';
  document.getElementById('bloc-code-oublie').style.display = 'block';
});
document.getElementById('tb-code-oublie-retour').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('bloc-code-oublie').style.display = 'none';
  document.getElementById('bloc-code-validation').style.display = 'block';
});
document.getElementById('tb-code-oublie-envoyer').addEventListener('click', async () => {
  const msg = document.getElementById('tb-code-oublie-msg');
  msg.className = 'form-msg ok'; msg.textContent = 'Envoi en cours…'; msg.style.display = 'block';
  const { data, error } = await sb.rpc('demander_reinitialisation_code_validation');
  const ligne = Array.isArray(data) ? data[0] : data;
  if (error || !ligne || !ligne.token) {
    msg.className = 'form-msg err';
    msg.textContent = "Impossible d'envoyer le lien (aucun e-mail de récupération enregistré ?).";
    msg.style.display = 'block';
    return;
  }
  const lien = window.location.origin + window.location.pathname + '?reset_code=' + encodeURIComponent(ligne.token);
  try {
    await envoyerEmailCandidat({
      to_email: ligne.email_destination,
      to_name: 'Maître Akesse',
      message: "Vous avez demandé la réinitialisation de votre code de validation du tableau de bord. Cliquez sur ce lien pour définir un nouveau code (valable 30 minutes) : " + lien + "\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail."
    });
    msg.className = 'form-msg ok';
    msg.textContent = 'Un lien de réinitialisation vient d\'être envoyé à ' + ligne.email_destination + '. Vérifiez votre boîte mail (et vos spams).';
  } catch (e) {
    msg.className = 'form-msg err';
    msg.textContent = "Le lien a été généré mais l'e-mail n'a pas pu être envoyé.";
  }
  msg.style.display = 'block';
});

document.getElementById('tb-code-nouveau-valider').addEventListener('click', async () => {
  const nouveauCode = document.getElementById('tb-code-nouveau').value.trim();
  const msg = document.getElementById('tb-code-nouveau-msg');
  if (nouveauCode.length < 4) {
    msg.className = 'form-msg err'; msg.textContent = 'Le code doit contenir au moins 4 caractères.'; msg.style.display = 'block';
    return;
  }
  const { error } = await sb.rpc('reinitialiser_code_validation', { p_token: tokenReinitCodeEnAttente, p_nouveau_code: nouveauCode });
  if (error) {
    msg.className = 'form-msg err'; msg.textContent = "Lien invalide ou expiré. Refaites une demande depuis l'écran de connexion."; msg.style.display = 'block';
    return;
  }
  tokenReinitCodeEnAttente = null;
  document.getElementById('tb-code-nouveau').value = '';
  marquerCodeValide();
  msg.className = 'form-msg ok'; msg.textContent = 'Nouveau code enregistré ! Ouverture du tableau de bord…'; msg.style.display = 'block';
  setTimeout(() => { void reveleTableauDeBord(); }, 900);
});

// Détecté directement depuis l'URL (synchrone, avant tout appel réseau) —
// évite une course avec la vérification admin du bas de script : si
// sb.auth.getUser() répond avant que l'évènement PASSWORD_RECOVERY (qui,
// lui, attend une validation réseau du jeton) n'ait eu le temps de poser
// recuperationMdpEnCours à true, apresConnexionReussie() fonçait tout droit
// vers le tableau de bord, sans jamais proposer de changer le mot de passe.
let recuperationMdpEnCours = urlIndiqueRecuperationMdp();
document.getElementById('tb-mdp-oublie-lien').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('tb-mdp-oublie-email').value = document.getElementById('tb-email').value.trim();
  document.getElementById('bloc-login').style.display = 'none';
  document.getElementById('bloc-mdp-oublie').style.display = 'block';
});
document.getElementById('tb-mdp-oublie-retour').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('bloc-mdp-oublie').style.display = 'none';
  document.getElementById('bloc-login').style.display = 'block';
});
document.getElementById('tb-mdp-oublie-envoyer').addEventListener('click', async () => {
  if (!sb) return;
  const email = document.getElementById('tb-mdp-oublie-email').value.trim();
  const msg = document.getElementById('tb-mdp-oublie-msg');
  if (!email) return;
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reinitialiser-mot-de-passe.html'
  });
  if (error) console.warn('resetPasswordForEmail (admin) :', error.message);
  msg.className = 'form-msg ok';
  msg.textContent = "Si cet e-mail est associé à un compte admin, un lien de réinitialisation vient d'être envoyé. Vérifiez votre boîte mail (et vos spams).";
  msg.style.display = 'block';
});

sb && sb.auth.onAuthStateChange((event) => {
  if (event !== 'PASSWORD_RECOVERY') return;
  recuperationMdpEnCours = true;
  document.getElementById('bloc-login').style.display = 'none';
  document.getElementById('bloc-mdp-oublie').style.display = 'none';
  const tableau = document.getElementById('bloc-tableau');
  if (tableau) tableau.style.display = 'none';
  document.getElementById('bloc-nouveau-mdp').style.display = 'block';
});

document.getElementById('tb-nouveau-mdp-valider').addEventListener('click', async () => {
  const nouveauMdp = document.getElementById('tb-nouveau-mdp').value;
  const msg = document.getElementById('tb-nouveau-mdp-msg');
  if (nouveauMdp.length < 8) {
    msg.className = 'form-msg err';
    msg.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
    msg.style.display = 'block';
    return;
  }
  if (!sb) return;
  const { error } = await sb.auth.updateUser({ password: nouveauMdp });
  if (error) {
    msg.className = 'form-msg err';
    msg.textContent = "Erreur : " + error.message;
    msg.style.display = 'block';
    return;
  }
  recuperationMdpEnCours = false;
  const estAdmin = await verifierAdminTableau();
  document.getElementById('bloc-nouveau-mdp').style.display = 'none';
  if (estAdmin) {
    await apresConnexionReussie();
  } else {
    await sb.auth.signOut();
    document.getElementById('bloc-login').style.display = 'block';
    afficherChromePublic(true);
  }
});

// Si le lien de réinitialisation du code est ouvert sans session active,
// tokenReinitCodeEnAttente reste simplement en mémoire : l'écran de connexion
// normal s'affiche, et apresConnexionReussie() le consommera juste après la
// saisie du mot de passe (voir tb-login-btn ci-dessus).
void (async () => {
  // Tout le code de la page (dont js/tableau-de-bord.js, chargé après ce fichier) doit être
  // prêt avant d'ouvrir le tableau de bord : sur un téléphone lent, la vérification de la
  // session pouvait répondre avant la fin de son téléchargement.
  if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  // Ouvert dans l'Administration (espace 1, cahier v2.4) : la connexion et la double
  // authentification de l'Administration suffisent — aucune deuxième connexion, pas de code de
  // validation (le serveur accepte la double authentification, api/acces-tableau.js).
  if (window.MA2M_ADMINISTRATION) {
    try {
      if (!(await window.MA2M_ADMINISTRATION.pret)) return;
      if (await verifierAdminTableau()) await reveleTableauDeBord();
      else window.MA2M_ADMINISTRATION.refuser();
    } catch (e) { window.MA2M_ADMINISTRATION.retour(); }
    if (window.tdbFinVerifSession) window.tdbFinVerifSession();
    return;
  }
  try {
    const estAdmin = await verifierAdminTableau();
    if (estAdmin && !recuperationMdpEnCours) {
      await apresConnexionReussie();
    }
  } catch (e) {}
  if (window.tdbFinVerifSession) window.tdbFinVerifSession();
})();
