// Espace mannequin — programme de la page (sorti de espace-mannequin.html le 05/10/2026,
// audit : écrit dans la page, il faisait demander au navigateur 5 fausses adresses
// d'images à chaque visite ; dans un fichier séparé, comme le reste du site).
/* =========================================================================
   ESPACE MANNEQUIN — MA2M — PREMIUM 20
   Interface Premium 20 (wizard en 6 étapes + tableau de bord post-validation),
   connectée aux vraies tables/colonnes/fonctions Supabase de l'agence — pas
   de table ni de colonne inventée, pas de mode démo, pas de donnée simulée.
   Le "vrai" schéma est celui de supabase-setup.sql / supabase-extension.sql,
   déjà utilisé par espace-mannequin-ancien.html (conservé en parallèle comme filet
   de sécurité pendant la mise au point de ce fichier).
   ========================================================================= */

/* ---------------------------------------------------------------- ÉTAT --- */
let currentUser = null;

function emptyState(){
  return {
    meta:{
      currentStep:1, activeCompcardSlot:1,
      // Dérivés à l'affichage à partir des vraies colonnes (published /
      // en_attente_validation / raison_refus / premiere_publication_faite) —
      // jamais écrits tels quels en base, voir deriverStatutAffichage().
      statutAffichage:'brouillon', premierePublicationFaite:false, commentaireAdmin:''
    },
    identite:{ nomComplet:'', dateNaissance:'', villeNaissance:'', lieuNaissance:'', nationalite:'', ville:'', quartier:'', telephone:'', email:'', sexe:'' },
    // Mannequin mineure : contacts de son parent / tuteur (table contacts_parents, Extension 129).
    parent:{ civilite:'', nom:'', telephone:'', email:'' },
    // Civilité de la mannequin (Madame / Mademoiselle / Monsieur, Extension 132).
    civilite:'',
    physique:{
      taille:'', poids:'', poitrine:'', tourTaille:'', hanches:'', entrejambe:'', pointure:'',
      tailleVet:'', yeux:'', cheveux:'', carnation:'',
      // Extension 121 (06/10/2026) : épaules, bras, cou (hommes), tête
      epaules:'', bras:'', cou:''
    },
    formation:{ niveau:'', etablissement:'', particuliere:'', mannequin:'' },
    // Niveau (New Face / Professionnel, 06/10/2026) : coché par la mannequin
    // (niveauMannequin), puis contrôlé en coulisses par niveauControle() (js/app.js) :
    // « Professionnel » n'est gardé qu'avec plus de 2 ans d'expériences.
    // anneesExperience n'est plus demandé (ancienne donnée gardée telle quelle).
    profilPro:{ anneesExperience:'', disponibilite:'', modelTypes:[], langues:[], niveauMannequin:'' },
    experiences:[],
    experiencesAgence:[], // projets réalisés avec l'agence (agenda), en lecture seule
    photos:{ principale:null, photoCv:null, pleinPied:null, couverture:null, book:[] },
    competences:{},
    citation:'',
    bio:'',
    instagram:'', sansInstagram:false,
    // Fiche événement (06/10/2026, table fiche_evenement) : jamais publique, seule
    // l'agence télécharge la fiche complète depuis le tableau de bord.
    ficheEvenement:{ tailleHaut:'', tailleBas:'', regime:'', tiktok:'', facebook:'', droitImage:null }
  };
}
let state = emptyState();

function toNum(v){ const n = parseInt(v, 10); return (v===''||v===null||v===undefined||isNaN(n)) ? null : n; }
function val(id){ const el = document.getElementById(id); return el ? el.value : ''; }

// deriverNiveauMannequin() est partagée dans js/app.js (utilisée aussi par
// mannequin.html et espace-mannequin-ancien.html).

/* --- Mode guidé (première inscription) vs mode autonome (blocs indépendants)
   identique à la logique déjà en production : une fois premiere_publication_faite
   passé à true par le trigger serveur, c'est définitif — le mannequin garde
   toujours accès au tableau de bord (jamais reverrouillé derrière un écran
   "en attente"/"refusé"), seuls les bandeaux d'état changent. --- */
function deriverStatutAffichage(profil){
  if (profil.published) return 'valide';
  if (profil.en_attente_validation) return 'en_attente';
  if (!profil.published && !profil.en_attente_validation && profil.raison_refus) return 'refuse';
  return 'brouillon';
}

/* ------------------------------------------------------------- TOASTS --- */
function toast(msg, isErr){
  const wrap = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' err' : '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 2600);
}

/* --------------------------------------------------------- AUTH RÉELLE ---
   Même flux que espace-mannequin-ancien.html : inscription avec code d'invitation
   (check_invite_code / consume_invite_code), connexion, récupération de
   mot de passe. Aucune redirection vers une page de connexion séparée —
   tout se passe sur cette page, comme sur l'ancien espace mannequin. */
// Détecté directement depuis l'URL (synchrone, avant tout appel réseau) —
// évite une course avec init() plus bas : si sb.auth.getSession() répond
// avant que l'évènement PASSWORD_RECOVERY (qui attend une validation
// réseau du jeton) n'ait eu le temps de poser recuperationMdpEnCours à
// true, demarrerApresConnexion() fonçait tout droit vers le tableau de
// bord, sans jamais proposer de changer le mot de passe.
let recuperationMdpEnCours = urlIndiqueRecuperationMdp();

const WORDMARK_HTML = '<a class="wordmark" href="index.html"><img src="assets/logo-header-clair.png" alt="Maître Akesse Model Management"></a>';

function viewAuthGate(){
  return '<div class="top">'+WORDMARK_HTML+'</div>' +
  '<div class="panel" id="authPanel">' +
    // 30/09 : des personnes venues postuler à un casting arrivaient ici et tentaient de se
    // connecter avec un faux code — on leur montre tout de suite le bon chemin.
    '<a class="em-vers-candidature" href="candidature.html">Vous souhaitez <strong>postuler à un casting</strong> ou <strong>rejoindre l’agence</strong> ? <span>Postuler ici →</span></a>' +
    '<div id="auth-onglets" class="p20-8">' +
      '<button type="button" class="btn small" id="auth-tab-connexion" data-auth-tab="connexion">Se connecter</button>' +
      '<button type="button" class="btn ghost small" id="auth-tab-inscription" data-auth-tab="inscription">Créer mon compte</button>' +
    '</div>' +
    '<div id="auth-panneau-connexion">' +
      '<h2>Connexion</h2><p class="sub">Accédez à votre espace mannequin.</p>' +
      '<div class="grid">' + field('E-mail','au-co-email','',{type:'email',req:true}) + field('Mot de passe','au-co-mdp','',{type:'password',req:true}) + '</div>' +
      '<div class="actions-row end"><button class="btn primary" id="au-co-valider">Se connecter</button></div>' +
      '<div id="au-co-msg" class="err-msg p20-14"></div>' +
      '<p class="p20-15"><a href="#" id="au-mdp-oublie-lien" class="p20-7">Mot de passe oublié ?</a></p>' +
    '</div>' +
    '<div id="auth-panneau-inscription" class="p20-9">' +
      // code personnel créé par l'agence après l'inscription payée (une fois, 7 jours — cahier v2.4, 5.4)
      '<h2>Créer mon compte</h2><p class="sub">Entrez le code personnel donné par l’agence après votre inscription. Il ne sert qu’une fois et reste valable 7 jours.</p>' +
      '<div class="grid">' +
        field('Code donné par l’agence','au-in-code','',{req:true}) + field('Nom complet','au-in-nom','',{req:true}) +
        field('E-mail','au-in-email','',{type:'email',req:true}) + field('Mot de passe (8 caractères minimum)','au-in-mdp','',{type:'password',req:true}) +
      '</div>' +
      '<div class="actions-row end"><button class="btn primary" id="au-in-valider">Créer mon compte</button></div>' +
      '<div id="au-in-msg" class="err-msg p20-14"></div>' +
    '</div>' +
    '<div id="auth-panneau-mdp-oublie" class="p20-9">' +
      '<h2>Mot de passe oublié</h2><p class="sub">Indiquez votre e-mail, si un compte y est associé, un lien de réinitialisation vous sera envoyé.</p>' +
      field('E-mail','au-mo-email','',{type:'email'}) +
      '<div class="actions-row end"><button class="btn primary" id="au-mo-envoyer">Envoyer le lien</button></div>' +
      '<div id="au-mo-msg" class="err-msg p20-14"></div>' +
      '<p class="p20-15"><a href="#" id="au-mo-retour" class="p20-7">← Retour à la connexion</a></p>' +
    '</div>' +
    '<div id="auth-panneau-nouveau-mdp" class="p20-9">' +
      '<h2>Nouveau mot de passe</h2><p class="sub">Choisissez votre nouveau mot de passe (8 caractères minimum).</p>' +
      field('Nouveau mot de passe','au-nm-mdp','',{type:'password'}) +
      '<div class="actions-row end"><button class="btn primary" id="au-nm-valider">Valider</button></div>' +
      '<div id="au-nm-msg" class="err-msg p20-14"></div>' +
    '</div>' +
  '</div>';
}

// Écran « Choisissez votre mot de passe » après un mot de passe provisoire (10/11/2026) : seulement ce panneau,
// sans onglets de connexion ni d'inscription (la personne est déjà connectée), avec « Se déconnecter » (téléphone prêté).
function afficherMdpObligatoire(){
  renderAuthGate();
  afficherPanneauAuth('auth-panneau-nouveau-mdp');
  const onglets = document.getElementById('auth-onglets'); if (onglets) onglets.style.display = 'none';
  document.querySelector('#authPanel .em-vers-candidature')?.remove();
  const p = document.getElementById('auth-panneau-nouveau-mdp');
  if (p && !document.getElementById('au-nm-deconnexion')) {
    p.insertAdjacentHTML('beforeend', '<p class="p20-15"><a href="#" id="au-nm-deconnexion" class="p20-7">Se déconnecter</a></p>');
    document.getElementById('au-nm-deconnexion').addEventListener('click', async function(e){ e.preventDefault(); await sb.auth.signOut().catch(function(){}); renderAuthGate(); });
  }
  const titre = p && p.querySelector('h2'), sous = p && p.querySelector('.sub');
  if (titre) titre.textContent = 'Choisissez votre mot de passe';
  if (sous) sous.textContent = 'Vous vous êtes connecté(e) avec un mot de passe provisoire donné par l’agence. Choisissez maintenant votre propre mot de passe (8 caractères minimum), que vous seul(e) connaîtrez.';
}

function afficherPanneauAuth(id){
  // 'block' explicite (jamais '') : plusieurs de ces panneaux portent une
  // classe utilitaire display:none (ex. p20-9) — un style inline vide ne
  // l'emporte pas dessus, le panneau resterait invisible même actif.
  ['auth-panneau-connexion','auth-panneau-inscription','auth-panneau-mdp-oublie','auth-panneau-nouveau-mdp'].forEach(function(p){
    const el = document.getElementById(p); if (el) el.style.display = (p===id) ? 'block' : 'none';
  });
  // L'onglet ouvert s'allume (30/09 : les onglets ne changeaient jamais d'aspect —
  // une personne a touché 4 fois « Se connecter » sans voir que c'était déjà ouvert).
  const tabCo = document.getElementById('auth-tab-connexion');
  const tabIn = document.getElementById('auth-tab-inscription');
  if (tabCo && tabIn && (id === 'auth-panneau-connexion' || id === 'auth-panneau-inscription')) {
    tabCo.classList.toggle('ghost', id !== 'auth-panneau-connexion');
    tabIn.classList.toggle('ghost', id !== 'auth-panneau-inscription');
    tabCo.setAttribute('aria-pressed', String(id === 'auth-panneau-connexion'));
    tabIn.setAttribute('aria-pressed', String(id === 'auth-panneau-inscription'));
  }
}

// idAppareilMa2m() : partagée dans js/app.js.
// Message affiché quand le code d'invitation est refusé (ou bloqué après trop d'essais).
function messageRefusCode(statut, r){
  if (statut === 429) {
    const h = Math.ceil(r.minutesRestantes / 60);
    return r.dejaBloque
      ? `Trop de tentatives. Accès temporairement bloqué. Revenez dans ${r.minutesRestantes} min.`
      : `Trop de tentatives. Accès bloqué. Revenez dans ${h >= 1 ? h + ' heure' + (h > 1 ? 's' : '') : r.minutesRestantes + ' min'}.`;
  }
  const reste = r.essaisRestants;
  return "Ce code d'invitation est invalide." + (reste === 2 ? ' Attention : il vous reste 2 tentatives.' : reste === 1 ? ' Il vous reste 1 tentative.' : '');
}

function bindAuthGate(){
  document.getElementById('auth-tab-connexion')?.addEventListener('click', function(){ afficherPanneauAuth('auth-panneau-connexion'); });
  document.getElementById('auth-tab-inscription')?.addEventListener('click', function(){ afficherPanneauAuth('auth-panneau-inscription'); });

  document.getElementById('au-co-valider')?.addEventListener('click', async function(){
    const msg = document.getElementById('au-co-msg');
    const email = val('au-co-email').trim(), mdp = val('au-co-mdp');
    // Champs vides : on le dit tout de suite, sans interroger le serveur
    // (Journal 30/09 18:17 : « missing email or phone »).
    if (!email || !mdp) { msg.textContent = !email && !mdp ? 'Merci d\'indiquer votre e-mail et votre mot de passe.' : (!email ? 'Merci d\'indiquer votre e-mail.' : 'Merci d\'indiquer votre mot de passe.'); return; }
    msg.textContent = 'Connexion…';
    try {
      const refus = await connexionMannequin(email, mdp); // js/app.js
      if (refus) { msg.textContent = refus; return; }
      msg.textContent = '';
      await demarrerApresConnexion();
    } catch (e) {
      msg.textContent = 'Erreur de connexion, réessayez.';
    }
  });

  document.getElementById('au-in-valider')?.addEventListener('click', async function(){
    const msg = document.getElementById('au-in-msg');
    const code = val('au-in-code').trim(), nom = val('au-in-nom').trim(), email = val('au-in-email').trim(), mdp = val('au-in-mdp');
    if (!code || !nom || !email) { msg.textContent = 'Merci de remplir tous les champs.'; return; }
    if (mdp.length < 8) { msg.textContent = 'Le mot de passe doit contenir au moins 8 caractères.'; return; }
    msg.textContent = 'Création du compte…';

    // Le code est vérifié ET le compte créé côté serveur, en une seule étape (test de
    // sécurité du 04/10/2026) : la page ne crée plus jamais de compte elle-même.
    try {
      const rep = await fetch('/api/code-protege', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'portail-creer-compte', code, nom, email, password: mdp, appareil: idAppareilMa2m() })
      });
      const r = await rep.json().catch(() => ({}));
      if (!rep.ok) {
        if (rep.status === 409) msg.textContent = 'Un compte existe déjà avec cet e-mail. Utilisez « Se connecter » (ou « Mot de passe oublié ? »).';
        else if (r.error === 'champs') msg.textContent = 'Merci de vérifier votre nom et votre adresse e-mail.';
        else if (r.error === 'mot_de_passe') msg.textContent = 'Ce mot de passe n’est pas accepté : choisissez-en un d’au moins 8 caractères, plus difficile à deviner.';
        else if (rep.status === 429 || rep.status === 401) msg.textContent = messageRefusCode(rep.status, r);
        else msg.textContent = 'La création du compte a échoué, réessayez dans quelques instants.';
        return;
      }
    } catch (e) {
      msg.textContent = 'Erreur de connexion, réessayez.';
      return;
    }

    // Compte créé : connexion immédiate, par le même chemin que « Se connecter ».
    try {
      if (await connexionMannequin(email, mdp)) throw new Error('connexion'); // js/app.js
    } catch (e) {
      afficherPanneauAuth('auth-panneau-connexion');
      document.getElementById('au-co-email').value = email;
      document.getElementById('au-co-msg').textContent = 'Votre compte est créé. Connectez-vous avec votre e-mail et votre mot de passe.';
      return;
    }

    msg.textContent = '';
    toast('Compte créé avec succès !');
    await demarrerApresConnexion();
  });

  document.getElementById('au-mdp-oublie-lien')?.addEventListener('click', function(e){
    e.preventDefault();
    document.getElementById('au-mo-email').value = val('au-co-email');
    afficherPanneauAuth('auth-panneau-mdp-oublie');
  });
  document.getElementById('au-mo-retour')?.addEventListener('click', function(e){ e.preventDefault(); afficherPanneauAuth('auth-panneau-connexion'); });
  document.getElementById('au-mo-envoyer')?.addEventListener('click', async function(){
    const email = val('au-mo-email').trim(); const msg = document.getElementById('au-mo-msg');
    if (!email) return;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reinitialiser-mot-de-passe.html' });
    if (error) console.warn('resetPasswordForEmail (mannequin) :', error.message);
    msg.textContent = "Si cet e-mail est associé à un compte, un lien de réinitialisation vient d'être envoyé.";
  });

  document.getElementById('au-nm-valider')?.addEventListener('click', async function(){
    const nouveauMdp = val('au-nm-mdp'); const msg = document.getElementById('au-nm-msg');
    if (nouveauMdp.length < 8) { msg.textContent = 'Le mot de passe doit contenir au moins 8 caractères.'; return; }
    // (10/11/2026) après un mot de passe provisoire donné par l'agence : il ne peut pas être gardé tel quel, et le
    // nouveau passe par le serveur (qui seul retire la marque « provisoire » ; js/supabase-config.js)
    if (estFormeMdpProvisoire(nouveauMdp)) { msg.textContent = 'Choisissez un mot de passe à vous, différent du mot de passe provisoire.'; return; }
    const bouton = this; bouton.disabled = true;
    let error = null;
    try {
      // (compte relu au serveur : connexion instable → on ne choisit pas le mauvais chemin, on redemande)
      const { data: { user: actuel }, error: erreurLecture } = await sb.auth.getUser();
      if (erreurLecture || !actuel) error = new Error('connexion instable, réessayez dans un instant.');
      else if (mdpProvisoireEnCours(actuel)) await remplacerMdpProvisoire(nouveauMdp);
      else ({ error } = await sb.auth.updateUser({ password: nouveauMdp }));
    } catch (e) { error = e; }
    finally { bouton.disabled = false; }
    if (error) { msg.textContent = /different|same/i.test(error.message) ? 'Choisissez un mot de passe différent de l’ancien.' : 'Erreur : ' + error.message; return; }
    recuperationMdpEnCours = false;
    await demarrerApresConnexion();
  });
}

// Adresse #inscription ou #mot-de-passe-oublie (liens de l'application MA2M Mannequin) : le bon
// formulaire s'ouvre tout de suite
const PANNEAUX_PAR_ADRESSE = { '#inscription': 'auth-panneau-inscription', '#mot-de-passe-oublie': 'auth-panneau-mdp-oublie' };
function renderAuthGate(){
  const app = document.getElementById('app');
  app.innerHTML = viewAuthGate();
  bindAuthGate();
  if (PANNEAUX_PAR_ADRESSE[location.hash]) afficherPanneauAuth(PANNEAUX_PAR_ADRESSE[location.hash]);
}

sb && sb.auth.onAuthStateChange(function(event){
  if (event !== 'PASSWORD_RECOVERY') return;
  recuperationMdpEnCours = true;
  renderAuthGate();
  afficherPanneauAuth('auth-panneau-nouveau-mdp');
});

/* --------------------------------------------------------------- ÉTAT <-> DB
   Mappage explicite entre l'état local (pratique pour les formulaires) et
   les vraies colonnes de model_profiles. Rien n'est jamais écrit avec un nom
   de colonne inventé. */
function identiteToDb(d){
  // le barème (femmes / hommes) dépend du sexe : taille vêtements recalculée, et gardée
  // dans l'état pour que l'étape physique, la compcard et le CV restent d'accord
  state.physique.tailleVet = tailleGeneraleCalculee(state.physique, d.sexe);
  return {
    full_name: d.nomComplet || null,
    date_naissance: d.dateNaissance || null,
    ville_naissance: d.villeNaissance || null,
    lieu_naissance: d.lieuNaissance || null,
    nationalite: d.nationalite || null,
    city: d.ville || null,
    quartier: d.quartier || null,
    phone: d.telephone || null,
    contact_email: d.email || null,
    category: d.sexe || null,
    clothing_size: state.physique.tailleVet || null
  };
}
function physiqueToDb(p){
  return {
    height_cm: toNum(p.taille), weight_kg: toNum(p.poids), chest_cm: toNum(p.poitrine),
    waist_cm: toNum(p.tourTaille), hips_cm: toNum(p.hanches), inseam_cm: toNum(p.entrejambe),
    // Taille vêtements : calculée d'après les mensurations (js/tailles.js), jamais saisie
    shoe_size: p.pointure || null, clothing_size: p.tailleVet || null,
    eye_color: p.yeux || null, hair_color: p.cheveux || null, carnation: p.carnation || null
  };
}
function tailleGeneraleCalculee(p, sexe){
  if (typeof ma2mTailleVetements !== 'function') return p.tailleVet || '';
  return ma2mTailleVetements({ category: sexe, chest_cm: p.poitrine, waist_cm: p.tourTaille, hips_cm: p.hanches, clothing_size: p.tailleVet });
}
// Mensurations ajoutées le 06/10/2026 (Extension 121) : enregistrées à part, pour que
// l'étape ne soit jamais bloquée si la base n'a pas encore ces colonnes.
async function enregistrerMesuresSupp(p){
  const { error } = await sb.from('model_profiles').update({
    shoulder_cm: toNum(p.epaules), arm_cm: toNum(p.bras), neck_cm: toNum(p.cou)
  }).eq('id', currentUser.id);
  // On ne bloque pas le reste de l'étape, mais la mannequin est prévenue.
  if (error) { console.warn('Mensurations complémentaires non enregistrées :', error.message); toast('Épaules, bras et cou : pas encore enregistrés, réessayez un peu plus tard', true); }
}
// Instagram obligatoire (décision de la propriétaire, 07/10/2026) : un compte, ou la case
// « Je n'ai pas Instagram » cochée. Renvoie false (et prévient la mannequin) si rien n'est indiqué.
// Mannequin mineure (décision de la propriétaire, 07/10/2026) : elle garde ses propres
// contacts, et on demande en plus le nom, le WhatsApp et l'e-mail de son parent / tuteur.
function estMineureLe(dateNaissance){
  if (!dateNaissance) return false;
  const n = new Date(dateNaissance + 'T12:00:00'), a = new Date();
  let age = a.getFullYear() - n.getFullYear();
  if (a.getMonth() < n.getMonth() || (a.getMonth() === n.getMonth() && a.getDate() < n.getDate())) age--;
  return age < 18;
}
function majBlocParent(){
  const bloc = document.getElementById('f-bloc-parent');
  if (bloc) bloc.style.display = estMineureLe(val('f-dob')) ? '' : 'none';
}
// Renvoie false (et prévient la mannequin) s'il manque un contact du parent pour une mineure.
function lireCiviliteFormulaire(){
  if (!document.getElementById('f-civilite') || val('f-civilite')) return true;
  toast('Choisissez votre civilité : Madame, Mademoiselle ou Monsieur.', true);
  document.getElementById('f-civilite').focus();
  return false;
}
function lireParentFormulaire(){
  if (!document.getElementById('f-bloc-parent') || !estMineureLe(val('f-dob'))) return true;
  const p = {
    civilite: val('f-parent-civilite'),
    nom: val('f-parent-nom').trim(),
    telephone: composerTelephone(document.getElementById('f-parent-indicatif'), document.getElementById('f-parent-numero')),
    email: val('f-parent-email').trim().toLowerCase()
  };
  if (!p.civilite || !p.nom || !val('f-parent-numero').trim() || !EMAIL_VALIDE.test(p.email)) {
    toast('Vous avez moins de 18 ans : indiquez la civilité, le nom, le WhatsApp et l’e-mail de votre parent ou tuteur.', true);
    document.getElementById('f-parent-nom')?.focus();
    return false;
  }
  state.parent = p;
  return true;
}
// Enregistré à part (table contacts_parents) pour ne jamais bloquer le reste de l'étape
// si la base ne l'a pas encore (Extension 129).
async function enregistrerParent(){
  if (!estMineureLe(state.identite.dateNaissance)) return;
  const { error } = await sb.from('contacts_parents').upsert({
    model_id: currentUser.id, parent_nom: [state.parent.civilite, state.parent.nom].filter(Boolean).join(' ') || null, parent_telephone: state.parent.telephone || null,
    parent_email: state.parent.email || null, mis_a_jour: new Date().toISOString()
  });
  if (error) { console.warn('Contacts du parent non enregistrés :', error.message); toast('Les contacts de votre parent n’ont pas pu être enregistrés : réessayez un peu plus tard', true); }
}
function lireInstagramFormulaire(){
  const sans = !!(document.getElementById('f-sans-instagram') || {}).checked;
  const compte = sans ? '' : val('f-instagram').trim();
  if (!compte && !sans) {
    toast('Indiquez votre compte Instagram, ou cochez « Je n’ai pas Instagram ».', true);
    document.getElementById('f-instagram')?.focus();
    return false;
  }
  state.instagram = compte; state.sansInstagram = sans;
  return true;
}
// Civilité (Extension 132), enregistrée à part pour ne jamais bloquer le reste de l'étape.
async function enregistrerCivilite(){
  state.civilite = val('f-civilite') || state.civilite;
  const { error } = await sb.from('model_profiles').update({ civilite: state.civilite || null }).eq('id', currentUser.id);
  if (error) console.warn('Civilité non enregistrée :', error.message);
}
// Compléments de l'étape « identité », enregistrés à part : ils ne bloquent jamais l'étape
// (en cas d'échec, la mannequin est prévenue par un message).
async function enregistrerComplementsIdentite(){
  await enregistrerSansInstagram();
  await enregistrerParent();
  await enregistrerCivilite();
}
// Case « Je n'ai pas Instagram » : colonne sans_instagram (Extension 126), enregistrée à part
// pour ne jamais bloquer le reste de l'étape si la base ne l'a pas encore.
async function enregistrerSansInstagram(){
  const { error } = await sb.from('model_profiles').update({ sans_instagram: !!state.sansInstagram }).eq('id', currentUser.id);
  // On ne bloque pas le reste de l'étape, mais la mannequin est prévenue.
  if (error) { console.warn('Case « pas d’Instagram » non enregistrée :', error.message); toast('La case « Je n’ai pas Instagram » n’a pas pu être enregistrée : réessayez un peu plus tard', true); }
}
function formationToDb(f){
  return { niveau_etude: f.niveau || null, etablissement: f.etablissement || null, formation_particuliere: f.particuliere || null, formation_mannequin: f.mannequin || null };
}
function profilProToDb(pp){
  return {
    availability: pp.disponibilite || null,
    model_types: pp.modelTypes, languages: pp.langues.join(', '),
    niveau_mannequin: pp.niveauMannequin ? niveauControle(pp.niveauMannequin, toutesExperiences(), pp.anneesExperience) : null
  };
}

/* Champ "sexe" (femme/homme) déjà utilisé par tout le reste du site pour
   déterminer Hanches vs Entrejambe — on garde son vocabulaire (category),
   distinct de "niveau_mannequin" (New Face / Professionnel), choisi
   par la mannequin elle-même dans le bloc Expérience. */
function mapProfileFromDb(row, contactPrive){
  const s = emptyState();
  if (!row) return s;
  s.meta.statutAffichage = deriverStatutAffichage(row);
  s.meta.premierePublicationFaite = !!row.premiere_publication_faite;
  s.meta.commentaireAdmin = row.raison_refus || '';
  Object.assign(s.identite, {
    nomComplet: row.full_name || '', dateNaissance: row.date_naissance || '', villeNaissance: row.ville_naissance || '', lieuNaissance: row.lieu_naissance || '',
    nationalite: row.nationalite || '', ville: row.city || '', quartier: row.quartier || '',
    telephone: (contactPrive && contactPrive.phone) || '', email: (contactPrive && contactPrive.contact_email) || '',
    sexe: row.category || ''
  });
  Object.assign(s.physique, {
    taille: (row.height_cm == null ? '' : row.height_cm), poids: (row.weight_kg == null ? '' : row.weight_kg), poitrine: (row.chest_cm == null ? '' : row.chest_cm), tourTaille: (row.waist_cm == null ? '' : row.waist_cm),
    hanches: (row.hips_cm == null ? '' : row.hips_cm), entrejambe: (row.inseam_cm == null ? '' : row.inseam_cm), pointure: row.shoe_size || '', tailleVet: row.clothing_size || '',
    yeux: row.eye_color || '', cheveux: row.hair_color || '', carnation: row.carnation || ''
  });
  Object.assign(s.formation, {
    niveau: row.niveau_etude || '', etablissement: row.etablissement || '', particuliere: row.formation_particuliere || '', mannequin: row.formation_mannequin || ''
  });
  Object.assign(s.profilPro, {
    anneesExperience: (row.years_experience == null ? '' : row.years_experience), disponibilite: row.availability || '',
    modelTypes: row.model_types || [], langues: (row.languages || '').split(',').map(function(l){return l.trim();}).filter(Boolean),
    niveauMannequin: niveauNormalise(row.niveau_mannequin, row.years_experience)
  });
  s.competences = row.competences || {};
  s.citation = row.citation || '';
  s.bio = row.bio || '';
  s.instagram = row.instagram || '';
  return s;
}

/* ------------------------------------------------------------- COUCHE DONNÉES
   Appels Supabase réels uniquement — aucun repli localStorage/démo. */
// Doit rester identique à la limite imposée côté serveur (trigger
// limiter_nombre_photos(), Extension 57 de supabase-extension.sql) — cette
// valeur ici ne sert qu'à bloquer l'envoi côté client AVANT de gaspiller de
// la bande passante (conversion HEIC, compression, 3 envois vers R2) sur un
// envoi que le serveur refusera de toute façon.
const LIMITE_PHOTOS_BOOK = 60;
// Photo du Book telle que l'Espace l'affiche, d'après sa ligne model_photos (fichiers : ceux à
// retirer de R2 si elle est supprimée, versions comprises)
function photoDuBook(p) {
  return { id:p.id, numero:p.numero||null, path:p.chemin, url:p.url_miniature||p.url, urlPleine:p.url, compcardOrdre:p.compcard_ordre||null,
    couverturePosition:p.couverture_position||'center', ecartee:p.tri_statut==='ecartee', fichiers:p };
}
const Store = {
  async load(){
    const { data: profile, error: e1 } = await sb.from('model_profiles')
      .select(sansChampsPrives('id, full_name, bio, height_cm, weight_kg, city, quartier, instagram, published, created_at, category, chest_cm, waist_cm, hips_cm, shoe_size, carnation, clothing_size, date_naissance, eye_color, hair_color, years_experience, niveau_mannequin, model_types, languages, availability, inseam_cm, featured, premiere_publication_faite, en_attente_validation, raison_refus, niveau_etude, etablissement, formation_particuliere, formation_mannequin, competences, citation, ville_naissance, lieu_naissance, nationalite'))
      .eq('id', currentUser.id).maybeSingle();
    if (e1) { console.error(e1); toast('Erreur de chargement du profil', true); return emptyState(); }
    await completerProfilsPrives(profile); // date de naissance, quartier… (Extension 131)

    const { data: contactPriveRows } = await sb.rpc('mon_contact_prive');
    const contactPrive = contactPriveRows && contactPriveRows[0] ? contactPriveRows[0] : null;

    const s = mapProfileFromDb(profile, contactPrive);

    // Contacts du parent (vide tant que l'Extension 129 n'est pas exécutée).
    const { data: parent } = await sb.from('contacts_parents').select('parent_nom, parent_telephone, parent_email').eq('model_id', currentUser.id).maybeSingle();
    if (parent) {
      // « Madame Kouassi Marie » : la civilité est rangée devant le nom (comme dans les formulaires).
      const nomComplet = parent.parent_nom || '';
      const civ = ['Madame', 'Monsieur', 'Mademoiselle'].find(c => nomComplet.indexOf(c + ' ') === 0) || '';
      s.parent = { civilite: civ, nom: civ ? nomComplet.slice(civ.length + 1) : nomComplet, telephone: parent.parent_telephone || '', email: parent.parent_email || '' };
    }

    // Civilité lue à part : vide tant que l'Extension 132 n'est pas exécutée, sans rien bloquer.
    const { data: rowCiv, error: eCiv } = await sb.from('model_profiles').select('civilite').eq('id', currentUser.id).maybeSingle();
    s.civilite = (!eCiv && rowCiv && rowCiv.civilite) || '';
    const { data: rowSansInsta, error: eSansInsta } = await sb.from('model_profiles').select('sans_instagram').eq('id', currentUser.id).maybeSingle();
    s.sansInstagram = !eSansInsta && !!(rowSansInsta && rowSansInsta.sans_instagram); // faux tant que l'Extension 126 n'est pas exécutée

    // Mise en sourdine par l'agence (Extension 135) : lue à part, pour qu'une base sans
    // la colonne ne bloque jamais l'Espace.
    const { data: rowSourdine, error: eSourdine } = await sb.from('model_profiles').select('desactive').eq('id', currentUser.id).maybeSingle();
    s.meta.desactive = !eSourdine && !!(rowSourdine && rowSourdine.desactive);

    const supp = await ma2mMesuresSupp(currentUser.id); // vide si l'Extension 121 n'est pas encore exécutée
    Object.assign(s.physique, { epaules: supp.shoulder_cm ?? '', bras: supp.arm_cm ?? '', cou: supp.neck_cm ?? '' });
    s.physique.tailleVet = tailleGeneraleCalculee(s.physique, s.identite.sexe);

    const { data: exps } = await sb.from('model_projects').select('*').eq('model_id', currentUser.id).order('created_at', { ascending:true });
    s.experiences = (exps||[]).map(experienceDepuisBase);
    // Projets réalisés avec l'agence : ajoutés automatiquement à ses expériences (js/app.js)
    s.experiencesAgence = (await ma2mExperiencesAgence(currentUser.id).catch(function(){ return []; })).map(experiencePourCv);

    const { data: photos } = await sb.from('model_photos').select('*').eq('model_id', currentUser.id).order('created_at', { ascending:true });
    (photos||[]).forEach(function(p){
      const item = photoDuBook(p);
      s.photos.book.push(item);
      if (p.principale) s.photos.principale = item;
      if (p.photo_cv) s.photos.photoCv = item;
      if (p.photo_pleinpied) s.photos.pleinPied = item;
      if (p.photo_couverture) s.photos.couverture = item;
    });

    try {
      const { data: fe } = await sb.from('fiche_evenement').select('*').eq('model_id', currentUser.id).maybeSingle();
      if (fe) s.ficheEvenement = { tailleHaut: fe.taille_haut||'', tailleBas: fe.taille_bas||'', regime: fe.regime_allergies||'', tiktok: fe.tiktok||'', facebook: fe.facebook||'', droitImage: fe.droit_image };
    } catch(e) { /* table pas encore créée : champs vides */ }

    return s;
  },

  async saveFicheEvenement(fe){
    const { error } = await sb.from('fiche_evenement').upsert({
      model_id: currentUser.id, taille_haut: fe.tailleHaut||null, taille_bas: fe.tailleBas||null,
      regime_allergies: fe.regime||null, tiktok: fe.tiktok||null, facebook: fe.facebook||null,
      droit_image: fe.droitImage, mis_a_jour: new Date().toISOString()
    }, { onConflict: 'model_id' });
    if (error) { console.error(error); toast('Informations « événements » non enregistrées, réessayez', true); return false; }
    return true;
  },

  async ensureProfileRow(){
    const { error } = await sb.from('model_profiles').upsert({ id: currentUser.id }, { onConflict:'id', ignoreDuplicates:true });
    if (error) console.warn('ensureProfileRow', error);
  },

  async saveBlock(fields){
    const { error } = await sb.from('model_profiles').update(fields).eq('id', currentUser.id);
    if (error) { console.error(error); toast("Échec de l'enregistrement", true); return false; }
    return true;
  },

  /* La publication passe toujours par les 3 vraies colonnes + le trigger
     serveur gerer_validation_publication() — jamais de contournement côté
     client de premiere_publication_faite. */
  async submit(fields, publier){
    const { data: resultat, error } = await sb.from('model_profiles')
      .update(Object.assign({}, fields, { published: !!publier }))
      // Colonnes nommées : le téléphone et l'e-mail ne sont plus lisibles directement
      // (Extension 130), un select() « toutes colonnes » serait refusé.
      .eq('id', currentUser.id).select('id, published, en_attente_validation, premiere_publication_faite').single();
    if (error) { console.error(error); toast('Échec de la soumission', true); return null; }
    await completerProfilsPrives(resultat); // raison_refus (Extension 131)
    return resultat;
  },

  async addExperience(exp){
    const { data, error } = await sb.from('model_projects')
      .insert(Object.assign({ model_id: currentUser.id }, experienceVersBase(exp)))
      .select().single();
    if (error) { console.error(error); toast("Échec de l'ajout de l'expérience", true); return null; }
    return experienceDepuisBase(data);
  },
  async updateExperience(id, exp){
    const { error } = await sb.from('model_projects').update(experienceVersBase(exp)).eq('id', id).eq('model_id', currentUser.id);
    if (error) { console.error(error); toast('Échec de la mise à jour', true); return false; }
    return true;
  },
  async removeExperience(id){
    const { error } = await sb.from('model_projects').delete().eq('id', id).eq('model_id', currentUser.id);
    if (error) { console.error(error); toast('Échec de la suppression', true); return false; }
    return true;
  },

  /* Pipeline identique à l'ancien système : conversion HEIC, compression
     modérée de l'original, upload, puis génération miniature (800px depuis le
     06/10/2026, nette sur les écrans de téléphone très fins) et
     version moyenne (1600px) à côté — jamais de nouvelle bibliothèque de
     photos, tout reste dans model_photos / bucket model-photos. */
  async uploadPhoto(file){
    // Signalement dans le journal du tableau de bord (demande de la propriétaire,
    // 29/09/2026) : si l'envoi d'une photo échoue ou traîne, elle doit le voir, avec le
    // nom du mannequin, pour pouvoir le prévenir (souvent un problème de réseau).
    const qui = (currentUser && ((currentUser.user_metadata && currentUser.user_metadata.full_name) || currentUser.email)) || 'mannequin inconnu';
    const infosFichier = file ? ('« ' + (file.name || 'photo') + ' », ' + Math.round((file.size || 0) / 1024) + ' Ko, ' + (file.type || 'type inconnu')) : '';
    const alerteLenteur = setTimeout(() => {
      if (window.signalerErreur) window.signalerErreur('Envoi de photo très lent', qui + ' : une photo met plus de 90 secondes à partir', infosFichier);
    }, 90000);
    try{
      // Préparation et envoi partagés avec le tableau de bord (js/app.js).
      return photoDuBook(await insererPhotoBook(currentUser.id, file));  // (js/app.js)
    }catch(e){
      // e.message porte le vrai motif quand il vient d'un refus explicite du
      // serveur (ex. limite de photos atteinte) — l'afficher plutôt qu'un
      // message générique qui cacherait la cause réelle et la solution.
      console.warn(e);
      // Coupure réseau : le navigateur renvoie un message technique en anglais
      // (« Failed to fetch » sur Android, « Load failed » sur iPhone) — le remplacer
      // par une phrase compréhensible pour la mannequin.
      const brut = (e && e.message) || '';
      const reseau = /failed to fetch|load failed|networkerror|network request failed|réseau/i.test(brut);
      if (window.signalerErreur) window.signalerErreur('Envoi de photo échoué', qui + ' : ' + (reseau ? 'connexion coupée pendant l’envoi' : (brut || 'erreur inconnue')), infosFichier);
      toast(reseau
        ? 'Connexion interrompue pendant l’envoi de « ' + ((file && file.name) || 'la photo') + ' ». Vérifiez votre connexion et réessayez.'
        : (brut || "Échec de l'envoi de la photo"), true);
      return null;
    }finally{
      clearTimeout(alerteLenteur);
    }
  },

  async removePhoto(id, fichiers){
    try{
      // D'abord la fiche en base : si elle échoue, on ne touche surtout pas aux
      // fichiers (sinon la photo resterait listée mais cassée).
      const { error } = await sb.from('model_photos').delete().eq('id', id).eq('model_id', currentUser.id);
      if (error) throw error;
      void supprimerFichiersPhoto(currentUser.id, fichiers);  // (js/app.js)
      return true;
    }catch(e){ console.error(e); toast('Échec de la suppression', true); return false; }
  },

  /* Un seul rôle à la fois par mannequin pour chaque colonne — même principe
     que "principale" déjà en production : on désactive l'ancienne avant
     d'activer la nouvelle. */
  async setRolePhoto(colonne, photoId){
    const erreur = await definirRolePhoto(currentUser.id, colonne, photoId);  // (js/app.js)
    if (erreur) { console.error(erreur); toast('Échec de la mise à jour', true); return false; }
    return true;
  },

  /* Cadrage de la photo de couverture (haut/centre/bas) : pour ajuster une
     photo trop grande (plein pied, etc.) dans le bandeau de couverture, sans
     recadrer l'image elle-même — appliqué en object-position à l'affichage. */
  async setCouverturePosition(photoId, position){
    const { error } = await sb.from('model_photos').update({ couverture_position: position }).eq('id', photoId).eq('model_id', currentUser.id);
    if (error) { console.error(error); toast('Échec de l’enregistrement du cadrage', true); return false; }
    return true;
  },

  /* compcard_ordre réel (1-5), avec renumérotation des emplacements suivants
     au retrait — identique à la logique déjà en production. */
  async setCompcardOrdre(photoId, ordre){
    if (ordre === null) {
      const { data: restantes } = await sb.from('model_photos').select('id, compcard_ordre').eq('model_id', currentUser.id).not('compcard_ordre','is',null).order('compcard_ordre',{ascending:true});
      await sb.from('model_photos').update({ compcard_ordre: null }).eq('id', photoId).eq('model_id', currentUser.id);
      const suite = (restantes||[]).filter(function(r){ return String(r.id)!==String(photoId); });
      for (let i=0;i<suite.length;i++){
        if (suite[i].compcard_ordre !== i+1) await sb.from('model_photos').update({ compcard_ordre:i+1 }).eq('id', suite[i].id);
      }
      return true;
    }
    // L'ancienne photo de la case la quitte (js/app.js — sinon deux photos sur la même
    // case et la compcard téléchargée gardait l'ancienne, signalé le 06/10/2026).
    const error = await affecterCaseCompcard(currentUser.id, photoId, ordre);
    if (error) { console.error(error); toast('Échec de la sélection compcard, réessayez', true); return false; }
    return true;
  },
};

/* ------------------------------------------------------- ENVOI VERS R2 ---
   Les photos du Book ne passent plus par Supabase Storage (bande passante
   trop coûteuse) mais par Cloudflare R2, via une URL signée temporaire que
   seule api/r2-presigner.js peut délivrer (clés R2 jamais côté navigateur). */
// jetonSessionCourante(), uploaderVersR2(), supprimerDeR2() : partagés dans js/app.js.
// Tri automatique de la photo par IA (06/10/2026) : lancé en arrière-plan,
// sans attendre ni rien afficher — la mannequin n'est pas informée du résultat.
// Une photo jugée inutilisable est seulement cachée (jamais supprimée) ; si cet
// appel échoue, le tableau de bord rattrape la photo plus tard.
/* ------------------------------------------------------------- UTILS UI --- */
const STEP_LABELS = ['Identité','Physique','Formation','Expérience','Photos','Récapitulatif'];
const STEP_COURTS = ['Identité','Physique','Formation','Expér.','Photos','Récap.'];
// (11/11/2026, modèle « les cartes » choisi par la propriétaire) dessin de chaque étape (affiché dans l'application)
const STEP_ICONES = ['👤','📏','🎓','👠','📸','✨'];
const EXP_TYPES = ['Défilé','Campagne','Éditorial','Shooting','Lookbook','Publicité','Fitting','Showroom','Vidéo','Autre'];
// MOIS_FR / formaterPeriode : partagés dans js/app.js (aussi utilisés par le CV).

function header(rightLabel){
  return '<div class="top">'+WORDMARK_HTML+
    '<div class="top-right">' +
      '<div class="espace-tag">' + (rightLabel||'Mon espace mannequin') + '<b>' + echapperHtml(state.identite.nomComplet||'').trim() + '</b></div>' +
      // mensualités de formation : 24 mois, Wave puis « J'ai payé » (cahier v2.4, 5.7)
      '<a href="mes-paiements.html" class="btn-pill">Mes paiements</a>' +
      '<a href="index.html" class="btn-pill">Retour au site</a>' +
      '<button type="button" class="btn-pill" data-deconnexion="1">Se déconnecter</button>' +
    '</div></div>';
}
// Délégué une seule fois (pas à chaque render, header() étant réinjecté par
// innerHTML à chaque écran) : indispensable pour qu'une mannequin puisse
// quitter son espace sur un appareil partagé, sans devoir fermer l'onglet.
document.addEventListener('click', function(e){
  if (!e.target.closest('[data-deconnexion="1"]')) return;
  sb.auth.signOut().then(function(){ window.location.reload(); });
});

/* =========================================================== RENDU MAIN */
function render(){
  const app = document.getElementById('app');
  // Profil mis en sourdine par l'agence : plus aucun formulaire, seulement le message
  // (la base refuse de toute façon toute modification, Extension 135).
  if (state.meta.desactive) { app.innerHTML = viewSourdine(); return; }
  if (state.meta.studio === 'compcard') { app.innerHTML = viewStudioCompcard(); bindStudioCompcard(); return; }
  if (state.meta.studio === 'cv') { app.innerHTML = viewStudioCv(); bindStudioCv(); return; }
  const enModeGuide = !state.meta.premierePublicationFaite;
  if (enModeGuide) {
    if (state.meta.statutAffichage === 'en_attente') { app.innerHTML = viewConfirmation(); return; }
    if (state.meta.statutAffichage === 'refuse') { app.innerHTML = viewRefuse(); bindRefuse(); return; }
  }
  // (11/11/2026, capture de la propriétaire) profil déjà en ligne : les mêmes 6 étapes que la première fois (avant :
  // l'ancien tableau de bord à blocs), avec l'état du profil en haut et un récapitulatif sans « Soumettre » ; même
  // enregistrement (Store.saveBlock), même revalidation par l'agence que l'ancien tableau de bord.
  app.innerHTML = viewWizard();
  bindWizard();
  marquerChampsARemplir(BLOCS_ETAPES[state.meta.currentStep - 1]);
}

/* --------------------------------------------------------------- WIZARD */
function stepComplete(n){
  if (n===1) return !!(state.identite.nomComplet && state.identite.dateNaissance && state.identite.sexe && (state.instagram || state.sansInstagram));
  if (n===2) return !!(state.physique.taille && state.physique.poids);
  if (n===3) return !!state.formation.niveau;
  if (n===4) return toutesExperiences().length>0;
  if (n===5) return !!(state.photos.principale && state.photos.book.length);
  return false;
}

function viewWizard(){
  const pct = Math.round(((state.meta.currentStep-1)/6)*100 + (stepComplete(state.meta.currentStep)?100/6:0));
  const clamped = Math.min(100, Math.max(0,pct));
  const pts = pointsARemplir();
  const enLigne = state.meta.premierePublicationFaite;
  return header() +
  '<div class="greet">' + (enLigne ? bandeauStatut() : '') + '<h1>Bonjour ' + echapperHtml((state.identite.nomComplet||'').split(' ')[0]||'') + '</h1>' +
  (enLigne ? '<p>Modifiez votre profil étape par étape : chaque étape s’enregistre dès que vous appuyez sur « Continuer ». Votre compcard et votre CV ont leurs propres pages dans l’application.</p>' : '') +
  (enLigne ? '' : '<p>Complétez votre profil professionnel pour permettre à l’agence de créer votre dossier mannequin. Chaque étape s’enregistre au fur et à mesure, vous pouvez y revenir à tout moment avant l’envoi final.</p>') +
  '<div class="progress-row"><div class="progress-track"><div class="progress-fill" data-largeur="'+clamped+'"></div></div>' +
  '<div class="progress-pct">'+clamped+'%</div></div></div>' +
  '<div class="stepper">' + STEP_LABELS.map(function(l,i){
    const n=i+1; const cls = n===state.meta.currentStep?'active':(stepComplete(n)?'done':'');
    // (10/11/2026) nom court pour les petits écrans (application : les 6 étapes sur UNE ligne, css/mannequin-app.css)
    const manque = pts && BLOCS_ETAPES[i] ? pts.nb[BLOCS_ETAPES[i]] : 0;
    return '<button type="button" class="step-tab '+cls+'" data-goto="'+n+'" data-bouton-libre aria-label="Étape '+n+' : '+l+(manque > 0 ? ', '+manque+' élément'+(manque>1?'s':'')+' à remplir ou à corriger' : '')+'"><span class="n">'+n+'</span><span class="ic" aria-hidden="true">'+STEP_ICONES[i]+'</span><span class="l-long">'+l+'</span><span class="l-court" aria-hidden="true">'+STEP_COURTS[i]+'</span>'+pastilleRouge(manque)+'</button>';
  }).join('') + '</div>' +
  '<div class="panel">' + stepContent(state.meta.currentStep) + '</div>' +
  // (07/11/2026) accès toujours visible au récapitulatif, même si les cases du haut s'affichent mal sur un vieux téléphone
  (state.meta.currentStep !== 6 ? '<div class="actions-row aller-recap"><button type="button" class="btn primary" id="allerRecap" data-bouton-libre>'+(enLigne ? 'Enregistrer et voir le récapitulatif' : 'Enregistrer et voir le récapitulatif (mise en ligne)')+' →</button></div>' : '');
}

function stepContent(n){
  if (n===1) return stepIdentite();
  if (n===2) return stepPhysique();
  if (n===3) return stepFormation();
  if (n===4) return stepExperience();
  if (n===5) return stepPhotos();
  return stepRecap();
}

function field(label, id, value, opts){
  opts = opts || {};
  if (opts.tag==='select') {
    return '<div class="field '+(opts.full?'full':'')+'"><label for="'+id+'">'+label+(opts.req?'<span class="req">*</span>':'')+'</label>' +
      '<select id="'+id+'">' + (opts.options||[]).map(function(o){ return '<option value="'+echapperHtml(o.value)+'" '+(String(o.value)===String(value==null?'':value)?'selected':'')+'>'+echapperHtml(o.label)+'</option>'; }).join('') + '</select></div>';
  }
  // Select à liste fixe + repli "Autre" (texte libre) — le champ "Autre" n'a
  // jamais de style="" calculé dans le HTML (bloqué en silence par le CSP
  // strict de cette page) : sa visibilité initiale est posée juste après le
  // rendu via initSelectsAvecAutre() (element.style.display=…, une simple
  // affectation de propriété CSSOM, jamais concernée par le CSP).
  if (opts.tag==='select-autre') {
    const valeurs = opts.options || [];
    const estAutre = !!value && valeurs.indexOf(value) === -1;
    return '<div class="field '+(opts.full?'full':'')+'"><label for="'+id+'">'+label+(opts.req?'<span class="req">*</span>':'')+'</label>' +
      '<select id="'+id+'" data-avec-autre="1"><option value="">Choisir</option>' +
        valeurs.map(function(o){ return '<option value="'+echapperHtml(o)+'" '+(o===value?'selected':'')+'>'+echapperHtml(o)+'</option>'; }).join('') +
        '<option value="Autre" '+(estAutre?'selected':'')+'>Autre</option>' +
      '</select>' +
      '<input type="text" class="field-autre" id="'+id+'-autre" placeholder="Précisez" value="'+(estAutre?echapperHtml(value):'')+'"></div>';
  }
  if (opts.tag==='textarea') {
    return '<div class="field '+(opts.full?'full':'')+'"><label for="'+id+'">'+label+(opts.req?'<span class="req">*</span>':'')+'</label>' +
      '<textarea id="'+id+'" placeholder="'+(opts.placeholder||'')+'"'+(opts.maxlength?' maxlength="'+opts.maxlength+'"':'')+'>'+echapperHtml(value||'')+'</textarea></div>';
  }
  return '<div class="field '+(opts.full?'full':'')+'"><label for="'+id+'">'+label+(opts.req?'<span class="req">*</span>':'')+'</label>' +
  '<input type="'+(opts.type||'text')+'" id="'+id+'" value="'+echapperHtml(value||'')+'" placeholder="'+(opts.placeholder||'')+'"'+(opts.maxlength?' maxlength="'+opts.maxlength+'"':'')+'></div>';
}

// Plage de nombres prête pour field({tag:'select'}) — mêmes plages que celles
// déjà en production sur espace-mannequin-ancien.html (remplirSelectNombres), pour
// éviter les fautes de frappe et les valeurs invraisemblables dans une liste
// déroulante plutôt qu'un champ numérique libre.
function plageNombres(min, max, pas, suffixe){
  const options = [{value:'',label:'—'}];
  for (let v = min; v <= max; v += pas) options.push({value:String(v), label:v+(suffixe||'')});
  return options;
}

// Après chaque rendu, bascule les champs "Autre" (texte libre) associés à un
// select selon sa valeur courante, et branche leur écoute de changement —
// element.style.display=… reste une affectation de propriété CSSOM, jamais
// concernée par le CSP strict de cette page (contrairement à style="" dans le HTML).
function initSelectsAvecAutre(){
  document.querySelectorAll('select[data-avec-autre]').forEach(function(sel){
    const autre = document.getElementById(sel.id + '-autre');
    if (!autre) return;
    autre.style.display = sel.value === 'Autre' ? 'block' : 'none';
    configurerSelectAvecAutre(sel.id, autre.id);
  });
}

function stepIdentite(){
  const d = state.identite;
  const villeSelect = (d.ville === 'Abidjan' || COMMUNES_ABIDJAN.includes(d.ville)) ? 'Abidjan' : d.ville;
  return '<h2>Identité</h2><p class="sub">Étape 1 sur 6</p><div class="grid">' +
    field('Civilité','f-civilite',state.civilite,{tag:'select',req:true,options:[{value:'',label:'Sélectionner'},{value:'Madame',label:'Madame'},{value:'Mademoiselle',label:'Mademoiselle'},{value:'Monsieur',label:'Monsieur'}]}) +
    field('Nom complet','f-nom',d.nomComplet,{req:true,full:true}) +
    field('Date de naissance','f-dob',d.dateNaissance,{type:'date',req:true}) +
    field('Ville de naissance','f-ville-naissance',d.villeNaissance,{placeholder:'ex : Abidjan'}) +
    field('Pays de naissance','f-pays-naissance',d.lieuNaissance,{tag:'select-autre',options:PAYS_NAISSANCE.map(function(p){return p[0];})}) +
    field('Nationalité','f-nat',d.nationalite||'Ivoirienne') +
    field('Ville de résidence','f-ville',villeSelect,{tag:'select-autre',options:VILLES_CI}) +
    '<div class="field" id="f-commune-wrap"><label>Commune (Abidjan)</label><select id="f-commune"></select>' +
      '<input type="text" class="field-autre" id="f-commune-autre" placeholder="Précisez la commune"></div>' +
    '<div class="field" id="f-quartier-wrap"><label>Quartier (facultatif)</label>' +
      '<input type="text" id="f-quartier" value="'+echapperHtml(d.quartier||'')+'" placeholder="ex : Angré, Riviera, II Plateaux…"></div>' +
    '<div class="field"><label>Téléphone (usage interne agence)</label><div class="tel-row">' +
      '<select id="f-tel-indicatif"></select><input type="tel" id="f-tel-numero" placeholder="07 00 00 00 00" pattern="[0-9 ]{6,14}"></div></div>' +
    field('E-mail (usage interne agence)','f-email',d.email,{type:'email'}) + '</div>' +
    '<p class="sub p20-21">🔒 Téléphone et e-mail ne sont jamais affichés publiquement, seul le contact officiel de l’agence apparaît sur votre fiche.</p>' +
    '<div id="f-bloc-parent"><h3 class="p20-17">Parent ou tuteur légal</h3>' +
      '<p class="sub">Vous avez moins de 18 ans : merci d’indiquer les contacts de votre parent ou tuteur. L’agence le contactera avant toute suite donnée.</p><div class="grid">' +
      field('Civilité du parent / tuteur','f-parent-civilite',state.parent.civilite,{tag:'select',req:true,options:[{value:'',label:'Sélectionner'},{value:'Madame',label:'Madame'},{value:'Monsieur',label:'Monsieur'},{value:'Mademoiselle',label:'Mademoiselle'}]}) +
      field('Nom du parent / tuteur','f-parent-nom',state.parent.nom,{req:true}) +
      '<div class="field"><label>WhatsApp du parent / tuteur<span class="req">*</span></label><div class="tel-row">' +
        '<select id="f-parent-indicatif"></select><input type="tel" id="f-parent-numero" placeholder="07 00 00 00 00" pattern="[0-9 ]{6,14}"></div></div>' +
      field('E-mail du parent / tuteur','f-parent-email',state.parent.email,{type:'email',req:true}) +
    '</div></div>' +
    '<div class="field full p20-17"><label>Sexe<span class="req">*</span></label><div class="radio-row">' +
    [['femme','Femme'],['homme','Homme']].map(function(c){ return '<label class="radio-opt '+(d.sexe===c[0]?'selected':'')+'"><input type="radio" name="sexe" value="'+c[0]+'" '+(d.sexe===c[0]?'checked':'')+'> '+c[1]+'</label>'; }).join('') +
    '</div></div>' +
    '<div class="grid p20-17">' +
    field('Présentation / profil','f-bio',state.bio,{tag:'textarea',full:true,req:true,placeholder:'Quelques phrases sur vous : votre parcours, votre style, ce qui vous distingue…'}) +
    '<div class="field"><label for="f-instagram">Instagram<span class="req">*</span></label>' +
      '<input type="text" id="f-instagram" placeholder="@votre_compte" value="'+echapperHtml(state.sansInstagram ? '' : (state.instagram||''))+'"'+(state.sansInstagram?' disabled':'')+'>' +
      '<label class="check-opt p20-17'+(state.sansInstagram?' selected':'')+'"><input type="checkbox" id="f-sans-instagram"'+(state.sansInstagram?' checked':'')+'> Je n’ai pas Instagram</label></div>' +
    field('Citation personnelle (facultatif)','f-citation',state.citation,{placeholder:'Une phrase courte qui vous représente',maxlength:120}) +
    '</div>' +
    '<div class="actions-row end"><button class="btn primary" id="save1">Enregistrer</button></div>';
}

// Branche les champs spécifiques à l'étape Identité qui ne sont pas de simples
// champs texte : cascade ville→commune, indicatif téléphonique, et suggestion
// automatique de la nationalité à partir du pays de naissance choisi (reste
// modifiable librement ensuite : née au Mali mais ivoirienne, par exemple).
function bindStepIdentite(){
  const caseSansInsta = document.getElementById('f-sans-instagram');
  if (caseSansInsta) caseSansInsta.addEventListener('change', function(){
    const champ = document.getElementById('f-instagram');
    if (champ) { champ.disabled = caseSansInsta.checked; if (caseSansInsta.checked) champ.value = ''; }
    caseSansInsta.parentNode.classList.toggle('selected', caseSansInsta.checked);
  });
  // Appelée à chaque rendu du wizard quelle que soit l'étape affichée (voir
  // bindWizard()) — ces champs n'existent que sur l'étape 1 (ou l'éditeur de
  // bloc « identité »), on sort donc immédiatement s'ils sont absents du DOM.
  const selectTel = document.getElementById('f-tel-indicatif');
  if (!selectTel) return;

  brancherCascadeAbidjan('f-ville', 'f-commune-wrap', 'f-commune', 'f-commune-autre', 'f-quartier-wrap');
  if (COMMUNES_ABIDJAN.includes(state.identite.ville)) document.getElementById('f-commune').value = state.identite.ville;
  configurerSelectAvecAutre('f-commune', 'f-commune-autre');

  remplirIndicatifs(selectTel);
  preRemplirTelephone(state.identite.telephone, selectTel, document.getElementById('f-tel-numero'));

  const selectTelParent = document.getElementById('f-parent-indicatif');
  if (selectTelParent) {
    remplirIndicatifs(selectTelParent);
    preRemplirTelephone(state.parent.telephone, selectTelParent, document.getElementById('f-parent-numero'));
    document.getElementById('f-dob').addEventListener('input', majBlocParent);
    majBlocParent();
  }

  const selectPays = document.getElementById('f-pays-naissance');
  if (selectPays) selectPays.addEventListener('change', function(){
    if (selectPays.value === 'Autre' || !selectPays.value) return;
    const sexe = (document.querySelector('input[name=sexe]:checked')||{}).value || state.identite.sexe;
    const suggestion = nationaliteSuggeree(selectPays.value, sexe);
    if (suggestion) document.getElementById('f-nat').value = suggestion;
  });
}

function stepPhysique(){
  const d = state.physique;
  const homme = state.identite.sexe === 'homme';
  return '<h2>Informations physiques</h2><p class="sub">Étape 2 sur 6</p><div class="grid g3">' +
    field('Taille (cm)','f-taille',d.taille,{tag:'select',req:true,options:plageNombres(140,210,1,' cm')}) +
    field('Poids (kg)','f-poids',d.poids,{tag:'select',req:true,options:plageNombres(35,130,1,' kg')}) +
    field('Carnation','f-carnation',d.carnation,{tag:'select',options:[
      {value:'',label:'—'},{value:'Claire',label:'Claire'},{value:'Métisse claire',label:'Métisse claire'},
      {value:'Métisse foncée',label:'Métisse foncée'},{value:'Foncée',label:'Foncée'},{value:'Très foncée',label:'Très foncée'}
    ]}) +
    field('Tour de poitrine (cm)','f-poitrine',d.poitrine,{tag:'select',options:plageNombres(70,135,1,' cm')}) +
    field('Tour de taille (cm)','f-tourTaille',d.tourTaille,{tag:'select',options:plageNombres(55,115,1,' cm')}) +
    field('Tour de bassin (cm)','f-hanches',d.hanches,{tag:'select',options:plageNombres(70,135,1,' cm')}) +
    (homme ? field('Tour de cou (cm)','f-cou',d.cou,{tag:'select',options:plageNombres(32,50,1,' cm')}) : '') +
    field('Largeur d’épaules (cm)','f-epaules',d.epaules,{tag:'select',options:plageNombres(30,60,1,' cm')}) +
    field('Longueur de bras (cm)','f-bras',d.bras,{tag:'select',options:plageNombres(50,75,1,' cm')}) +
    field('Entrejambe / longueur de pantalon (cm)','f-entrejambe',d.entrejambe,{tag:'select',options:plageNombres(60,100,1,' cm')}) +
    field('Pointure (EU)','f-pointure',d.pointure,{tag:'select',options:plageNombres(34,48,1,'')}) +
    field('Couleur des yeux','f-yeux',d.yeux,{tag:'select-autre',options:['Marron','Noir','Vert','Bleu','Gris','Noisette']}) +
    field('Couleur des cheveux','f-cheveux',d.cheveux,{tag:'select-autre',options:['Noir','Brun','Châtain','Blond','Roux','Gris / Blanc']}) +
    '<div></div>' +
    '</div>' +
    '<div class="tailles-calculees" id="tailles-calculees"></div>' +
    '<p class="sub p20-14">📏 Mesurez-vous sans serrer le mètre ruban, en sous-vêtements ou vêtements fins. Vos tailles (haut, bas, générale) sont calculées automatiquement d’après vos mensurations, selon la grille des mensurations MA2M : pour les changer, corrigez vos mesures.</p>' +
    blocFicheEvenement() +
    '<div class="actions-row"><button class="btn ghost" data-goto="1">← Retour</button><button class="btn primary" id="save2">Enregistrer</button></div>';
}

function stepFormation(){
  const d = state.formation;
  return '<h2>Formation</h2><p class="sub">Étape 3 sur 6</p>' +
    field('Niveau d’étude','f-niveau',d.niveau,{tag:'select',full:true,req:true,options:['','Collège','Bac','Licence','Master','Autre'].map(function(o){return {value:o,label:o||'— Sélectionner —'};})}) +
    '<div class="grid p20-16">' +
    field('Établissement','f-etab',d.etablissement,{placeholder:'Lycée / Université / Établissement'}) +
    field('Formation particulière','f-formPart',d.particuliere) + '</div>' +
    '<div class="field full p20-15"><label>Formation mannequin (facultatif)</label>' +
    '<input type="text" id="f-formMannequin" value="'+echapperHtml(d.mannequin||'')+'" placeholder="ex : MA2M · Coaching &amp; Masterclass"></div>' +
    '<div class="actions-row"><button class="btn ghost" data-goto="2">← Retour</button><button class="btn primary" id="save3">Enregistrer</button></div>';
}

const MODEL_TYPES = [['catwalk','Défilé'],['photo','Photo'],['publicite','Publicité'],['commercial','Commercial'],['autre','Autre']];
const LANGUES_DISPONIBLES = ['Français','Anglais','Espagnol','Autre'];
const NIVEAUX_MANNEQUIN = ['New Face','Professionnel']; // « Amateur » retiré le 06/10/2026

// Une expérience : type, nom, date (ou année), pays, ville, lieu (salle, hôtel, studio…),
// promoteur / styliste / marque / institution. Tout est facultatif (12/10/2026 : une
// mannequin peut avoir oublié des détails). « lieu » côté CV = la ville (ancien nom gardé).
let colonneLieuExperience = false; // colonne model_projects.lieu présente (Extension 139)
function experienceDepuisBase(e){
  if ('lieu' in e) colonneLieuExperience = true;
  return { id:e.id, type:e.type_projet, nom:e.titre, lieu:e.ville, annee:e.periode, pays:e.pays||'', salle:e.lieu||'', promoteur:e.promoteur||'' };
}
function experienceVersBase(exp){
  const ligne = { type_projet:exp.type, titre:exp.nom, ville:exp.lieu, periode:exp.annee, pays:exp.pays||null, promoteur:exp.promoteur||null };
  // colonne « lieu » : Extension 139 ; tant qu'elle n'est pas vue dans les expériences lues,
  // envoyée seulement si remplie, pour ne rien bloquer avant que l'agence l'ait activée
  if (exp.salle || colonneLieuExperience) ligne.lieu = exp.salle || null;
  return ligne;
}

// Toutes ses expériences : projets de l'agence + les siennes qui ne les répètent pas (js/app.js).
// Sert au CV, au niveau, au récapitulatif et à l'analyse du profil.
function toutesExperiences(){ return fusionnerExperiences(state.experiencesAgence, state.experiences); }
function estDoublonAgence(e){ return estDoublonDe(e, state.experiencesAgence); }
function doublonsExperiences(){ return state.experiences.filter(estDoublonAgence); }

// Projets réalisés avec l'agence (agenda) : affichés ici sans pouvoir être modifiés — c'est
// l'agence qui les tient à jour ; ils apparaissent d'office sur la fiche et le CV.
function blocExperiencesAgence(){
  if (!state.experiencesAgence.length) return '';
  return '<div class="exp-agence"><p class="exp-agence-titre">Ajoutés automatiquement par l’agence, projets réalisés avec MA2M ('+state.experiencesAgence.length+')</p><ul>' +
    state.experiencesAgence.map(function(e){
      return '<li><strong>'+echapperHtml(e.type)+'</strong> · '+echapperHtml(e.nom)+(e.lieu ? ' · '+echapperHtml(e.lieu) : '')+(e.annee ? ' · '+echapperHtml(e.annee) : '')+'</li>';
    }).join('') + '</ul></div>';
}

function stepExperience(){
  const pp = state.profilPro;
  // Lignes qui répètent un projet de l'agence : masquées ici aussi (12/10/2026), avec un
  // bouton pour les supprimer d'un coup — elles ne s'affichent déjà plus nulle part ailleurs.
  const nbDoublons = doublonsExperiences().length;
  const listHtml = state.experiences.length===nbDoublons
    ? (state.experiencesAgence.length ? '' : '<p class="exp-empty">Aucune expérience ajoutée pour le moment. Cliquez sur « + Ajouter une expérience ».</p>')
    : state.experiences.map(function(e,i){
        if (estDoublonAgence(e)) return '';
        return '<div class="exp-card" data-exp="'+i+'">' +
        '<div class="exp-fields">' +
        '<select data-expf="type" data-i="'+i+'">' + EXP_TYPES.map(function(t){ return '<option value="'+t+'" '+(e.type===t?'selected':'')+'>'+t+'</option>'; }).join('') + '</select>' +
        '<input type="text" data-expf="nom" data-i="'+i+'" placeholder="Nom du défilé / de la marque / de la campagne" aria-label="Nom" value="'+echapperHtml(e.nom)+'">' +
        '<input type="text" data-expf="annee" data-i="'+i+'" placeholder="Date (ex : 03/09/2026) ou année" aria-label="Date ou année" value="'+echapperHtml(e.annee)+'">' +
        '<input type="text" data-expf="pays" data-i="'+i+'" maxlength="80" placeholder="Pays" aria-label="Pays" value="'+echapperHtml(e.pays)+'">' +
        '<input type="text" data-expf="lieu" data-i="'+i+'" placeholder="Ville" aria-label="Ville" value="'+echapperHtml(e.lieu)+'">' +
        '<input type="text" data-expf="salle" data-i="'+i+'" maxlength="160" placeholder="Lieu (salle, hôtel, studio…)" aria-label="Lieu" value="'+echapperHtml(e.salle)+'">' +
        '<input type="text" data-expf="promoteur" data-i="'+i+'" maxlength="120" placeholder="Promoteur, styliste, marque ou institution" aria-label="Promoteur, styliste, marque ou institution" value="'+echapperHtml(e.promoteur)+'">' +
        '</div><button class="exp-remove" data-rm="'+i+'">Supprimer</button></div>';
      }).join('');
  return '<h2>Expérience professionnelle</h2><p class="sub">Étape 4 sur 6</p>' +
    '<div class="field full p20-15"><label>Catégorie</label><div class="check-row">' +
    NIVEAUX_MANNEQUIN.map(function(n){ return '<label class="radio-opt '+(pp.niveauMannequin===n?'selected':'')+'"><input type="radio" name="niveauMannequin" value="'+n+'" '+(pp.niveauMannequin===n?'checked':'')+'> '+n+'</label>'; }).join('') +
    '</div></div>' +
    '<div class="grid">' +
    field('Disponibilité','f-dispo',pp.disponibilite,{tag:'select',options:[{value:'',label:'—'},{value:'immediate',label:'Disponible immédiatement'},{value:'rdv',label:'Sur rendez-vous'},{value:'mobile',label:'Mobile pour déplacements'}]}) +
    '</div>' +
    '<div class="field full p20-15"><label>Type de modèle (cochez tout ce qui s’applique)</label><div class="check-row">' +
    MODEL_TYPES.map(function(t){ return '<label class="check-opt '+(pp.modelTypes.indexOf(t[0])!==-1?'selected':'')+'"><input type="checkbox" data-modeltype="'+t[0]+'" '+(pp.modelTypes.indexOf(t[0])!==-1?'checked':'')+'> '+t[1]+'</label>'; }).join('') +
    '</div></div>' +
    '<div class="field full p20-15"><label>Langues parlées</label><div class="check-row">' +
    LANGUES_DISPONIBLES.map(function(l){ return '<label class="check-opt '+(pp.langues.indexOf(l)!==-1?'selected':'')+'"><input type="checkbox" data-langue="'+l+'" '+(pp.langues.indexOf(l)!==-1?'checked':'')+'> '+l+'</label>'; }).join('') +
    '</div></div>' +
    '<div class="actions-row p20-17"><button class="btn ghost small" id="saveProfilPro">Enregistrer</button></div>' +
    '<p class="sub p20-20">Défilés, shootings, publicités, castings… Un seul projet suffit pour publier votre profil, vous pourrez toujours en ajouter d’autres plus tard. Remplissez seulement ce dont vous vous souvenez : aucune case n’est obligatoire.</p>' +
    '<button class="btn ghost small p20-12" id="addExp">+ Ajouter une expérience</button>' +
    blocExperiencesAgence() +
    (nbDoublons ? '<div class="exp-doublon">'+nbDoublons+(nbDoublons>1 ? ' lignes que vous aviez écrites répètent' : ' ligne que vous aviez écrite répète')+' un projet ajouté par l’agence : '+(nbDoublons>1 ? 'elles sont masquées et n’apparaissent nulle part' : 'elle est masquée et n’apparaît nulle part')+' :<ul>' +
      doublonsExperiences().map(function(e){ return '<li>'+echapperHtml([e.type, e.nom, e.annee].filter(Boolean).join(' · '))+'</li>'; }).join('') +
      '</ul><button type="button" class="exp-remove" id="supprDoublons">Supprimer '+(nbDoublons>1 ? 'ces doublons' : 'ce doublon')+'</button></div>' : '') +
    '<div id="expList">'+listHtml+'</div>' +
    '<div class="actions-row"><button class="btn ghost" data-goto="3">← Retour</button><button class="btn primary" id="save4">Continuer</button></div>';
}

function photoThumb(item, label){ return (item && item.url) ? ('<img src="'+item.url+'" alt="'+label+'">') : ''; }

function stepPhotos(){
  const p = state.photos;
  const competencesHtml = ORDRE_COMPETENCES.map(function(cle){
    const v = state.competences[cle] || 3;
    return '<div class="field"><label>'+LIBELLES_COMPETENCES[cle]+'</label><input type="range" min="1" max="5" value="'+v+'" data-competence="'+cle+'"></div>';
  }).join('');
  // (11/11/2026, demande de la propriétaire) photos principales et compcard retirées de cette étape : elles ont
  // leurs propres pages (« Mon profil », « Ma compcard », « Mon CV ») ; ici seulement les compétences et le Book.
  return '<h2>Photos &amp; compétences</h2><p class="sub">Ajoutez ici les photos de votre Book. Votre photo de profil, votre compcard et votre CV se choisissent dans leurs propres pages de l’application.</p>' +
  '<section class="documents-section"><div class="section-title-row"><div><span class="editor-kicker">CV</span><h3>Compétences mannequin</h3><p>Évaluez-vous honnêtement sur chaque compétence (1 à 5).</p></div></div>' +
    '<div class="grid g3">'+competencesHtml+'</div></section>' +
  '<section class="documents-section" id="photosAilleurs"><div class="section-title-row"><div><span class="editor-kicker">PHOTO DE PROFIL</span><h3>Photo de profil et couverture</h3>' +
    '<p>Elles se choisissent dans « Mon profil » de l’application : touchez votre photo ronde ou la couverture.</p></div>' +
    '<a class="btn ghost small" href="/app/#profil">Ouvrir Mon profil ›</a></div></section>' +
  '<section class="book-section"><div class="section-title-row"><div><span class="editor-kicker">GALERIE</span><h3>Photos du Book</h3><p>Ajoutez ici les photos de votre Book : l’agence et les clients les voient sur votre fiche.</p></div>' +
    '<label class="book-multi-upload" for="fBook">＋ Ajouter des photos<input class="hidden-input" type="file" accept="image/*" id="fBook" multiple></label></div>' +
    '<div class="book-grid">'+p.book.map(function(ph){
      // Numéro fixe de la photo (Extension 117) : l'agence s'y réfère dans ses messages.
      return '<div class="book-thumb" data-book-id="'+ph.id+'">'+photoThumb(ph,'Book')+
        (ph.numero?('<div class="book-num">N° '+Number(ph.numero)+'</div>'):'') +
        '<button class="book-thumb-remove" data-rmbook="'+ph.id+'" title="Supprimer">✕</button>' +
      '</div>';
    }).join('')+'</div></section>' +
  '<div class="actions-row"><button class="btn ghost" data-goto="4">← Retour</button><button class="btn primary" id="save5">Continuer</button></div>';
}

function stepRecap(){
  const d = state.identite, ph = state.physique, f = state.formation;
  const rows = [
    ['Identité', (d.nomComplet||'—')+' · '+niveauNormalise(state.profilPro.niveauMannequin, state.profilPro.anneesExperience)+' · '+(d.sexe==='femme'?'Femme':d.sexe==='homme'?'Homme':'—'), 1],
    ['Informations physiques', (ph.taille||'—')+' cm · '+(ph.poids||'—')+' kg', 2],
    ['Formation', f.niveau||'—', 3],
    ['Expérience professionnelle', toutesExperiences().length+' expérience(s) enregistrée(s)', 4],
    ['Photos', state.photos.book.length+' photo(s) dans le Book', 5],
  ];
  return '<h2>Récapitulatif</h2><p class="sub">Vérifiez vos informations avant l’envoi</p>' +
    rows.map(function(r){ return '<div class="recap-block"><div><div class="lbl">'+r[0]+'</div><div class="val">'+r[1]+'</div></div><button class="recap-link" data-goto="'+r[2]+'">Modifier</button></div>'; }).join('') +
    (state.meta.premierePublicationFaite
      ? '<p class="sub">Tout est enregistré. Chaque modification est revue par l’agence avant d’apparaître sur votre fiche.</p>' +
        '<div class="actions-row"><button class="btn ghost" data-goto="5">← Retour</button><a class="btn primary" href="/app/#profil">Terminé</a></div>'
      : '<div class="visible-toggle"><input type="checkbox" id="f-visible"><p>Rendre mon profil visible publiquement sur le site.</p></div>' +
        '<div class="actions-row"><button class="btn ghost" data-goto="5">← Retour</button><button class="btn primary" id="submitProfile">Soumettre mon profil</button></div>');
}

// (07/11/2026) « Enregistrer et voir le récapitulatif » : l'étape est d'abord enregistrée par son propre bouton ;
// s'il réussit, il mène au récapitulatif au lieu de l'étape suivante ; s'il échoue, on reste sur l'étape
let allerAuRecap = false;
function suite(n){ if (allerAuRecap) { allerAuRecap = false; return 6; } return n; }
function goto(n){ state.meta.currentStep = n; render(); window.scrollTo({top:0,behavior:'smooth'}); }

// Lecture des champs Identité/Physique des 6 étapes (bindWizard ; depuis le 11/11/2026 aussi pour les profils
// déjà en ligne, l'ancien éditeur de blocs est retiré).
function lireIdentiteFormulaire(){
  return {
    nomComplet: val('f-nom'), dateNaissance: val('f-dob'),
    villeNaissance: val('f-ville-naissance'),
    lieuNaissance: valeurSelectOuAutre('f-pays-naissance', 'f-pays-naissance-autre'),
    nationalite: val('f-nat'),
    ville: villeAvecCommune(valeurSelectOuAutre('f-ville', 'f-ville-autre'), 'f-commune', 'f-commune-autre'),
    quartier: val('f-quartier'),
    telephone: composerTelephone(document.getElementById('f-tel-indicatif'), document.getElementById('f-tel-numero')),
    email: val('f-email'),
    sexe: (document.querySelector('input[name=sexe]:checked')||{}).value || ''
  };
}
// Informations demandées par les organisateurs de défilés (06/10/2026) : réservées
// à l'agence, jamais affichées sur la fiche publique.
function blocFicheEvenement(){
  const f = state.ficheEvenement;
  return '<h3 class="p20-17">Informations pour les événements</h3>' +
    '<p class="sub">🔒 Réservées à l’agence MA2M (défilés, castings), jamais affichées sur votre fiche publique. Votre Instagram se renseigne à l’étape « Identité ».</p>' +
    '<div class="grid">' +
    field('Régime / allergies','f-regime',f.regime,{full:true,placeholder:'Ex. végétarien, allergie aux arachides… ou « aucune »'}) +
    field('TikTok (lien ou nom)','f-tiktok',f.tiktok,{placeholder:'@votre_compte ou lien'}) +
    field('Facebook (lien ou nom)','f-facebook',f.facebook,{placeholder:'Nom du profil ou lien'}) +
    '</div>' +
    '<div class="field full p20-17"><label>Droit à l’image (photos et vidéos des événements)</label><div class="radio-row">' +
    [['oui','Oui, j’accepte',true],['non','Non',false]].map(function(c){ return '<label class="radio-opt '+(f.droitImage===c[2]?'selected':'')+'"><input type="radio" name="droit-image" value="'+c[0]+'" '+(f.droitImage===c[2]?'checked':'')+'> '+c[1]+'</label>'; }).join('') +
    '</div></div>';
}
// Encadré « Vos tailles » de l'étape physique : recalculé à chaque changement de mesure.
function afficherTaillesCalculees(){
  const zone = document.getElementById('tailles-calculees');
  if (!zone || typeof ma2mTailles !== 'function') return;
  const t = ma2mTailles({ category: state.identite.sexe, chest_cm: val('f-poitrine'), waist_cm: val('f-tourTaille'), hips_cm: val('f-hanches'), neck_cm: document.getElementById('f-cou') ? val('f-cou') : '', shoe_size: val('f-pointure') });
  // Mesures incohérentes : cases en rouge + message, et pas de taille (js/tailles.js)
  const champs = { chest_cm: 'f-poitrine', waist_cm: 'f-tourTaille', hips_cm: 'f-hanches' };
  Object.keys(champs).forEach(function(cle){
    const el = document.getElementById(champs[cle]); if (!el) return;
    const bloc = el.closest('.field'), aReprendre = t.aReprendre.indexOf(cle) !== -1, aVerifier = t.aVerifier.indexOf(cle) !== -1;
    bloc.classList.toggle('mesure-a-reprendre', aReprendre || aVerifier);
    let msg = bloc.querySelector('.mesure-msg');
    if ((aReprendre || aVerifier) && !msg) { msg = document.createElement('div'); msg.className = 'mesure-msg'; bloc.appendChild(msg); }
    if (msg) msg.textContent = aReprendre ? 'Mensuration pas exacte, à reprendre' : 'Mesure trop grande par rapport aux autres : vérifiez-la';
    if (!aReprendre && !aVerifier && msg) msg.remove();
  });
  zone.innerHTML = htmlSyntheseTailles(t, false);
}
// Synthèse « Vos tailles » : haut, bas, générale, pointure (+ chemise pour les hommes),
// avec les alertes « à reprendre » et « mensurations excessives ». Étape physique et
// page d'accueil de l'Espace (js/tailles.js).
// surAccueil : sur la page d'accueil, il n'y a pas de cases en rouge : on nomme les mesures.
function htmlSyntheseTailles(t, surAccueil){
  const titre = '<div class="tc-titre">Vos tailles (calculées)</div>';
  const noms = { chest_cm: 'tour de poitrine', waist_cm: 'tour de taille', hips_cm: 'tour de bassin' };
  if (t.aReprendre.length) {
    return titre + '<p class="tc-alerte">⚠️ ' + (surAccueil
      ? 'Votre ' + t.aReprendre.map(function(c){ return noms[c]; }).join(' et votre ') + ' ne vont pas ensemble (votre haut et votre bas s’écartent trop). Ouvrez le bloc « Physique » pour les reprendre avec un mètre ruban, sans serrer.'
      : 'Vos mesures en rouge ne vont pas ensemble (votre haut et votre bas s’écartent de plus d’une taille). Reprenez-les avec un mètre ruban, sans serrer, pour obtenir vos tailles.') + '</p><p class="tc-alerte">Tant qu’elles ne sont pas corrigées, vos mensurations sont cachées sur votre fiche publique. Sans correction sous 7 jours, votre fiche est retirée du site ; elle revient automatiquement dès que vous corrigez.</p>';
  }
  const c = function(x){ return x ? echapperHtml(ma2mTailleCourte(x)) : '—'; };
  return titre + '<div class="tc-grille">' +
    '<div><span>Haut</span><b>'+c(t.haut)+'</b></div><div><span>Bas</span><b>'+c(t.bas)+'</b></div><div><span>Générale</span><b>'+echapperHtml(t.generale||'—')+'</b></div>' +
    '<div><span>Pointure</span><b>'+(t.pointure ? 'EU '+t.pointure.eu : '—')+'</b></div>' +
    (t.homme ? '<div><span>Chemise (col)</span><b>'+(t.chemise ? t.chemise.eu+' / '+t.chemise.us+'″' : '—')+'</b></div>' : '') +
    '</div>' +
    (t.aVerifier.length ? '<p class="tc-alerte">⚠️ Votre ' + t.aVerifier.map(function(c){ return noms[c]; }).join(' et votre ') + ' semble trop grand par rapport à vos autres mesures : il n’est pas pris en compte. Vérifiez-le' + (surAccueil ? ' dans le bloc « Physique ».' : '.') + '</p>' : '') +
    (t.exces ? '<p class="tc-alerte tc-exces">❌ ' + ma2mTexteExces(t).map(echapperHtml).join('<br>') + '</p>' : '');
}
function taillesDepuisEtat(){
  const p = state.physique;
  return ma2mTailles({ category: state.identite.sexe, chest_cm: p.poitrine, waist_cm: p.tourTaille, hips_cm: p.hanches, neck_cm: p.cou, shoe_size: p.pointure });
}
function brancherTaillesCalculees(){
  if (!document.getElementById('tailles-calculees')) return;
  ['f-poitrine','f-tourTaille','f-hanches','f-cou','f-pointure'].forEach(function(id){ const el = document.getElementById(id); if (el) el.addEventListener('change', afficherTaillesCalculees); });
  afficherTaillesCalculees();
}
function lireFicheEvenementFormulaire(){
  const choix = document.querySelector('input[name="droit-image"]:checked');
  return {
    tailleHaut: '', tailleBas: '', // tailles désormais calculées (js/tailles.js)
    regime: val('f-regime'), tiktok: val('f-tiktok'), facebook: val('f-facebook'),
    droitImage: choix ? choix.value === 'oui' : null
  };
}
// Enregistre aussi les informations « événements » saisies à l'étape physique. Ne bloque
// jamais l'étape : en cas d'échec, un message le signale et la suite reste possible.
async function enregistrerFicheEvenementDepuisFormulaire(){
  if (!document.getElementById('f-tiktok')) return;
  const fe = lireFicheEvenementFormulaire();
  const vide = !fe.tailleHaut && !fe.tailleBas && !fe.regime && !fe.tiktok && !fe.facebook && fe.droitImage == null;
  const avant = state.ficheEvenement;
  const dejaVide = !avant.tailleHaut && !avant.tailleBas && !avant.regime && !avant.tiktok && !avant.facebook && avant.droitImage == null;
  state.ficheEvenement = fe;
  if (vide && dejaVide) return; // rien de saisi : pas de ligne vide en base
  await Store.saveFicheEvenement(fe);
}
// Compléments de l'étape « physique », même principe : jamais bloquants.
async function enregistrerComplementsPhysique(physique){
  await enregistrerMesuresSupp(physique);
  await enregistrerFicheEvenementDepuisFormulaire();
}

function lirePhysiqueFormulaire(){
  const p = {
    taille: val('f-taille'), poids: val('f-poids'), poitrine: val('f-poitrine'), tourTaille: val('f-tourTaille'),
    hanches: val('f-hanches'), entrejambe: val('f-entrejambe'), pointure: val('f-pointure'),
    tailleVet: state.physique.tailleVet,
    epaules: val('f-epaules'), bras: val('f-bras'), cou: document.getElementById('f-cou') ? val('f-cou') : '',
    yeux: valeurSelectOuAutre('f-yeux', 'f-yeux-autre'),
    cheveux: valeurSelectOuAutre('f-cheveux', 'f-cheveux-autre'),
    carnation: val('f-carnation')
  };
  // Taille vêtements : jamais saisie, calculée d'après les mensurations (js/tailles.js)
  p.tailleVet = tailleGeneraleCalculee(p, state.identite.sexe);
  return p;
}

function bindWizard(){
  // Largeur de la barre de progression posée après coup via l'API DOM (pas
  // en style="" inline dans le HTML) : le CSP strict de cette page bloque
  // silencieusement les valeurs de style calculées insérées comme texte.
  document.querySelectorAll('.progress-fill[data-largeur]').forEach(function(el){ el.style.width = el.dataset.largeur + '%'; });
  document.querySelectorAll('[data-goto]').forEach(function(b){ b.addEventListener('click', function(){ allerAuRecap = false; goto(parseInt(b.dataset.goto,10)); }); });
  initSelectsAvecAutre();
  brancherTaillesCalculees();
  bindStepIdentite();
  const s = state;

  document.getElementById('allerRecap')?.addEventListener('click', function(){
    const enregistrer = document.getElementById('save' + state.meta.currentStep);
    if (enregistrer) { allerAuRecap = true; enregistrer.click(); } else goto(6);
  });
  document.getElementById('save1')?.addEventListener('click', async function(){
    const btn = this;
    if (!lireCiviliteFormulaire() || !lireInstagramFormulaire() || !lireParentFormulaire()) return;
    const identiteFormulaire = lireIdentiteFormulaire();
    identiteFormulaire.sexe = identiteFormulaire.sexe || s.identite.sexe;
    Object.assign(s.identite, identiteFormulaire);
    s.bio = val('f-bio'); s.citation = val('f-citation');
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    const ok = await Store.saveBlock(Object.assign(identiteToDb(s.identite), { bio: s.bio||null, instagram: s.instagram||null, citation: s.citation||null }));
    if (ok) await enregistrerComplementsIdentite();
    if (ok) { toast('Enregistré'); goto(suite(2)); } else { allerAuRecap=false; btn.disabled=false; btn.textContent='Enregistrer'; }
  });

  document.getElementById('save2')?.addEventListener('click', async function(){
    const btn = this;
    Object.assign(s.physique, lirePhysiqueFormulaire());
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    const ok = await Store.saveBlock(physiqueToDb(s.physique));
    if (ok) await enregistrerComplementsPhysique(s.physique);
    if (ok) { toast('Enregistré'); goto(suite(3)); } else { allerAuRecap=false; btn.disabled=false; btn.textContent='Enregistrer'; }
  });

  document.getElementById('save3')?.addEventListener('click', async function(){
    const btn = this;
    s.formation.niveau = val('f-niveau'); s.formation.etablissement = val('f-etab');
    s.formation.particuliere = val('f-formPart'); s.formation.mannequin = val('f-formMannequin');
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    const ok = await Store.saveBlock(formationToDb(s.formation));
    if (ok) { toast('Enregistré'); goto(suite(4)); } else { allerAuRecap=false; btn.disabled=false; btn.textContent='Enregistrer'; }
  });

  document.getElementById('save4')?.addEventListener('click', function(){ goto(5); });
  document.getElementById('save5')?.addEventListener('click', function(){ goto(6); });

  bindExperienceHandlers();
  bindProfilProHandlers();
  bindPhotoHandlers();
  bindCompetencesHandlers();

  document.getElementById('submitProfile')?.addEventListener('click', async function(){
    if (!stepComplete(1)||!stepComplete(2)||!stepComplete(3)) { toast('Merci de compléter les étapes obligatoires', true); return; }
    const visible = document.getElementById('f-visible').checked;
    const payload = Object.assign({}, identiteToDb(s.identite), physiqueToDb(s.physique), formationToDb(s.formation), { bio: s.bio||null, instagram: s.instagram||null, citation: s.citation||null });
    const resultat = await Store.submit(payload, visible);
    if (resultat) {
      s.meta.statutAffichage = deriverStatutAffichage(resultat);
      s.meta.premierePublicationFaite = !!resultat.premiere_publication_faite;
      render();
      toast(resultat.published ? 'Profil publié avec succès.' : 'Profil soumis à MA2M pour validation.');
    }
  });
}

/* -------------------------------------------------- EXPÉRIENCE : handlers */
function bindExperienceHandlers(){
  const s = state;
  document.getElementById('addExp')?.addEventListener('click', async function(){
    const draft = { type:'Défilé', nom:'', lieu:'', annee:new Date().getFullYear().toString(), pays:'', salle:'', promoteur:'' };
    const saved = await Store.addExperience(draft);
    if (saved) { s.experiences.push(saved); render(); }
  });
  document.getElementById('supprDoublons')?.addEventListener('click', async function(){
    const doublons = doublonsExperiences();
    if (!doublons.length || !confirm('Supprimer '+doublons.length+(doublons.length>1 ? ' lignes en double' : ' ligne en double')+' ? Les projets ajoutés par l’agence restent.')) return;
    this.disabled = true;
    try {
      for (const exp of doublons) {
        if (await Store.removeExperience(exp.id)) s.experiences.splice(s.experiences.indexOf(exp), 1);
      }
    } catch (e) {
      toast('Suppression interrompue : vérifiez votre connexion et réessayez.', true);
    } finally {
      render(); // l'écran reflète toujours ce qui a vraiment été supprimé
    }
  });
  document.querySelectorAll('[data-rm]').forEach(function(b){ b.addEventListener('click', async function(){
    const i = parseInt(b.dataset.rm,10); const exp = s.experiences[i];
    const ok = await Store.removeExperience(exp.id);
    if (ok) { s.experiences.splice(i,1); render(); }
  }); });
  document.querySelectorAll('[data-expf]').forEach(function(el){
    const eventName = el.tagName==='SELECT' ? 'change' : 'input';
    let debounceTimer;
    el.addEventListener(eventName, function(){
      const i = parseInt(el.dataset.i,10);
      s.experiences[i][el.dataset.expf] = el.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function(){ void Store.updateExperience(s.experiences[i].id, s.experiences[i]); }, 500);
    });
  });
}

/* --- Profil professionnel (niveau, type de modèle, langues, disponibilité — les
   années d'expérience ne sont plus demandées depuis le 06/10/2026). Le niveau est
   choisie directement par la mannequin via 3 cases exclusives (radio,
   name="niveauMannequin"), sans indication d'années (pour éviter toute
   contradiction visible avec le champ "Années d'expérience", qui reste
   indépendant) ; pré-remplie par deriverNiveauMannequin() à partir des
   années d'expérience la première fois, mais reste modifiable. --- */
function bindProfilProHandlers(){
  const s = state;
  document.getElementById('saveProfilPro')?.addEventListener('click', async function(){
    const btn = this;
    Object.assign(s.profilPro, {
      niveauMannequin: (document.querySelector('input[name=niveauMannequin]:checked')||{}).value || '',
      disponibilite: val('f-dispo'),
      modelTypes: Array.from(document.querySelectorAll('[data-modeltype]:checked')).map(function(c){ return c.dataset.modeltype; }),
      langues: Array.from(document.querySelectorAll('[data-langue]:checked')).map(function(c){ return c.dataset.langue; })
    });
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    if (s.profilPro.niveauMannequin) s.profilPro.niveauMannequin = niveauControle(s.profilPro.niveauMannequin, s.experiences, s.profilPro.anneesExperience);
    const ok = await Store.saveBlock(profilProToDb(s.profilPro));
    if (ok) { toast('Enregistré'); render(); } else { allerAuRecap=false; btn.disabled=false; btn.textContent='Enregistrer'; }
  });
}

/* ------------------------------------------------------- PHOTOS : handlers */
// Une photo du Book reçoit une case de la compcard (1 à 5) ; écran « Ma compcard »
async function assignerCompcardSlot(photo, slot){
  if (photo.compcardOrdre) { toast('Cette photo occupe déjà l’emplacement '+photo.compcardOrdre, true); return false; }
  const ok = await Store.setCompcardOrdre(photo.id, slot);
  if (ok) {
    // même chose à l'écran : l'ancienne photo de cette case la quitte
    state.photos.book.forEach(function(ph){ if (ph !== photo && ph.compcardOrdre === slot) ph.compcardOrdre = null; });
    photo.compcardOrdre = slot; toast('Photo affectée à l’emplacement '+slot);
  }
  return ok;
}

/* ------------------------------------------------ ÉCRAN « MA COMPCARD » ---
   (11/11/2026, maquette validée par la propriétaire) ouvert depuis l'application (Mon profil › Compcard,
   adresse …#compcard) : les 5 cases en grand, on touche une case → la galerie du téléphone s'ouvre → la photo
   rejoint le Book et prend la case. Puis la vraie compcard : aperçu, PDF, image, envoi par WhatsApp. */
const CASES_COMPCARD = ['Principale', 'Plein pied', 'Profil', 'Mouvement', 'Libre'];
function viewStudioCompcard(){
  const parCase = {};
  state.photos.book.forEach(function(ph){ if (ph.compcardOrdre) parCase[ph.compcardOrdre] = ph; });
  const nb = Object.keys(parCase).length;
  const caseHtml = function(n){
    const ph = parCase[n];
    return '<label class="sc-case sc-case-'+n+(ph?' pleine':'')+'"><span class="sc-num">'+n+(n===1?' · PRINCIPALE':'')+'</span>' +
      (ph ? '<img src="'+echapperHtml(ph.url)+'" alt="Photo '+n+' de la compcard"><span class="sc-changer">Changer</span>'
          : '<span class="sc-vide"><b>＋</b>'+CASES_COMPCARD[n-1]+'<small>depuis la galerie</small></span>') +
      '<input class="hidden-input" type="file" accept="image/*" data-sc-case="'+n+'" aria-label="Choisir la photo '+n+' de la compcard dans la galerie"></label>';
  };
  return '<div class="sc-studio">' +
    '<div class="sc-tete"><a class="sc-retour" href="/app/#profil" aria-label="Retour à mon profil">‹</a><h1>Ma compcard</h1></div>' +
    '<p class="sc-sous">Vos 5 plus belles photos, celles que l’agence envoie aux clients. Touchez une case pour choisir une photo dans votre galerie.</p>' +
    '<div class="sc-prog"><div><i data-largeur="'+(nb*20)+'"></i></div>'+nb+' / 5</div>' +
    '<div class="sc-grille">'+caseHtml(1)+'<div class="sc-droite">'+[2,3,4,5].map(caseHtml).join('')+'</div></div>' +
    '<div class="sc-conseil">💡 <b>Conseil de l’agence :</b> un portrait souriant en 1, puis une photo en pied, un profil, une photo en mouvement.</div>' +
    '<div class="sc-actions"><button type="button" class="btn primary" id="scVoir">Voir ma compcard</button>' +
    '<div class="sc-deux"><button type="button" class="btn ghost" id="scPdf">📄 PDF</button><button type="button" class="btn ghost" id="scJpeg">🖼️ Image</button></div>' +
    '<button type="button" class="btn ghost" id="scWhatsapp">↗ Envoyer par WhatsApp</button></div>' +
  '</div>';
}
function bindStudioCompcard(){
  document.querySelectorAll('.sc-prog i[data-largeur]').forEach(function(i){ i.style.width = i.dataset.largeur + '%'; });
  document.querySelectorAll('[data-sc-case]').forEach(function(input){
    input.addEventListener('change', async function(){
      const file = input.files && input.files[0];
      const n = parseInt(input.dataset.scCase, 10);
      input.value = '';
      if (!file) return;
      if (state.photos.book.length >= LIMITE_PHOTOS_BOOK) { toast('Limite de '+LIMITE_PHOTOS_BOOK+' photos atteinte pour ce book. Supprimez une photo avant d’en ajouter une nouvelle.', true); return; }
      const lab = input.closest('.sc-case'); if (lab) lab.classList.add('envoi');
      // (11/11/2026) plus de message en haut : la barre d'envoi du bas suit déjà la photo (js/app.js)
      const item = await Store.uploadPhoto(file);
      if (item) { state.photos.book.push(item); await assignerCompcardSlot(item, n); }
      render();
    });
  });
  const pret = function(){
    if (!state.photos.book.some(function(ph){ return ph.compcardOrdre; })) { toast('Choisissez d’abord au moins une photo de compcard.', true); return false; }
    return true;
  };
  document.getElementById('scVoir').addEventListener('click', function(){ if (pret()) openCompcard(); });
  document.getElementById('scPdf').addEventListener('click', function(){ if (pret()) void genererFiche('pdf', ficheDataDepuisEtat(), 'scPdf', 'scJpeg', undefined, true); });
  document.getElementById('scJpeg').addEventListener('click', function(){ if (pret()) void genererFiche('jpeg', ficheDataDepuisEtat(), 'scPdf', 'scJpeg', undefined, true); });
  document.getElementById('scWhatsapp').addEventListener('click', function(){ if (pret()) void partagerToile(this, construireCanvasCompcard, ficheDataDepuisEtat(), 'compcard', 'Ma compcard'); });
}

// Envoyer la compcard ou le CV par WhatsApp (11/11/2026, partagé par les écrans « Ma compcard » et « Mon CV ») :
// la feuille de partage du téléphone avec l'image, sinon l'image enregistrée à joindre dans WhatsApp.
async function partagerToile(btn, construire, donnees, prefixe, titre){
  const texte = btn.textContent; btn.disabled = true; btn.textContent = 'Préparation…';
  try {
    const canvas = await construire(donnees);  // (js/app.js, même dessin que le PDF)
    const blob = await new Promise(function(ok){ canvas.toBlob(ok, 'image/jpeg', 0.92); });
    const fichier = new File([blob], prefixe + '-' + ((state.identite.nomComplet||'mannequin').split(' ')[0]||'mannequin').toLowerCase() + '.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
      try { await navigator.share({ files: [fichier], title: titre, text: titre + ' · Maître Akesse Model Management' }); } catch (e) { /* partage annulé */ }
    } else {
      telechargerFichier(blob, fichier.name);  // (js/app.js)
      toast(titre + ' : image enregistrée, joignez-la dans WhatsApp.');
    }
  } catch (e) {
    signalerProbleme(titre + ' : envoi WhatsApp échoué', (e && e.message) || String(e), e && e.stack);
    toast('L’image n’a pas pu être préparée. Réessayez.', true);
  } finally { btn.disabled = false; btn.textContent = texte; }
}

/* ------------------------------------------------------ ÉCRAN « MON CV » ---
   (11/11/2026, maquette validée par la propriétaire) ouvert depuis l'application (Mon profil › Mon CV, adresse
   …#cv) : la photo du CV (touchée → galerie → elle rejoint le Book et devient la photo du CV), la liste de ce que
   contient le CV avec « Complet » / « À compléter » (touchée → la partie à remplir), l'aperçu du vrai CV, PDF,
   image, envoi par WhatsApp. */
function viewStudioCv(){
  const pts = pointsARemplir();
  const ph = state.photos.photoCv;
  const lignes = [['identite','👤','Identité et contact'], ['physique','📏','Mensurations'], ['experiences','👠','Expériences'], ['formation','🎓','Formation'], ['photos','📸','Photos et portfolio']];
  return '<div class="sc-studio">' +
    '<div class="sc-tete"><a class="sc-retour" href="/app/#profil" aria-label="Retour à mon profil">‹</a><h1>Mon CV</h1></div>' +
    '<p class="sc-sous">Votre CV de mannequin, prêt à envoyer. Il se remplit tout seul avec votre profil.</p>' +
    '<label class="scv-photo"><span class="scv-vignette">' + (ph ? '<img src="'+echapperHtml(ph.url)+'" alt="Photo du CV">' : '<b>＋</b>') + '<i aria-hidden="true">＋</i></span>' +
      '<span><b>Photo du CV</b>Un portrait net et souriant. Touchez la photo pour en choisir une dans votre galerie.</span>' +
      '<input class="hidden-input" type="file" accept="image/*" data-scv-photo aria-label="Choisir la photo du CV dans la galerie"></label>' +
    '<div class="scv-liste">' + lignes.map(function(l){
      const manque = pts ? (pts.nb[l[0]] || 0) : 0;
      const etat = l[0] === 'experiences' ? '<small class="ok">' + toutesExperiences().length + '</small>'
        : manque ? '<small class="manque">À compléter</small>' : '<small class="ok">✓ Complet</small>';
      return '<button type="button" data-scv-aller="'+l[0]+'"><em aria-hidden="true">'+l[1]+'</em><span>'+l[2]+'</span>'+etat+'</button>';
    }).join('') + '</div>' +
    '<div class="scv-apercu" id="scvApercu"><p>Préparation de l’aperçu…</p></div>' +
    '<div class="sc-actions"><div class="sc-deux"><button type="button" class="btn primary" id="scvPdf">📄 PDF</button><button type="button" class="btn primary" id="scvJpeg">🖼️ Image</button></div>' +
    '<button type="button" class="btn ghost" id="scvWhatsapp">↗ Envoyer par WhatsApp</button></div>' +
  '</div>';
}
function bindStudioCv(){
  const input = document.querySelector('[data-scv-photo]');
  input.addEventListener('change', async function(){
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (state.photos.book.length >= LIMITE_PHOTOS_BOOK) { toast('Limite de '+LIMITE_PHOTOS_BOOK+' photos atteinte pour ce book. Supprimez une photo avant d’en ajouter une nouvelle.', true); return; }
    // (11/11/2026) plus de message en haut : la barre d'envoi du bas suit déjà la photo (js/app.js)
    const item = await Store.uploadPhoto(file);
    if (item) {
      state.photos.book.push(item);
      if (await Store.setRolePhoto('photo_cv', item.id)) { state.photos.photoCv = item; toast('Photo du CV définie'); }
    }
    render();
  });
  document.querySelectorAll('[data-scv-aller]').forEach(function(b){
    b.addEventListener('click', function(){
      const k = b.dataset.scvAller;
      state.meta.studio = null;
      history.replaceState(null, '', location.pathname);
      state.meta.currentStep = BLOCS_ETAPES.indexOf(k) + 1;
      render(); window.scrollTo(0, 0);
    });
  });
  document.getElementById('scvPdf').addEventListener('click', function(){ void genererCvFichier('pdf', donneesCvDepuisEtat(), 'scvPdf', 'scvJpeg'); });
  document.getElementById('scvJpeg').addEventListener('click', function(){ void genererCvFichier('jpeg', donneesCvDepuisEtat(), 'scvPdf', 'scvJpeg'); });
  document.getElementById('scvWhatsapp').addEventListener('click', function(){ void partagerToile(this, construireCanvasCv, donneesCvDepuisEtat(), 'cv', 'Mon CV'); });
  // aperçu : l'image même du CV (construireCanvasCv), en arrière-plan
  construireCanvasCv(donneesCvDepuisEtat()).then(function(canvas){
    const zone = document.getElementById('scvApercu');
    if (zone) zone.innerHTML = '<img src="' + apercuLeger(canvas) + '" alt="Aperçu de mon CV">';
  }).catch(function(e){
    signalerProbleme('Aperçu du CV échoué', (e && e.message) || String(e), e && e.stack);
    const zone = document.getElementById('scvApercu'); if (zone) zone.innerHTML = '<p>L’aperçu n’a pas pu être préparé.</p>';
  });
}

function bindPhotoHandlers(){
  const s = state;
  const fBook = document.getElementById('fBook');
  if (fBook) fBook.addEventListener('change', async function(){
    const files = Array.from(fBook.files||[]);
    if (!files.length) return;
    const place = LIMITE_PHOTOS_BOOK - s.photos.book.length;
    if (place <= 0) {
      fBook.value='';
      toast('Limite de '+LIMITE_PHOTOS_BOOK+' photos atteinte pour ce book. Supprimez une photo avant d’en ajouter une nouvelle.', true);
      return;
    }
    const aEnvoyer = files.slice(0, place);
    if (files.length > place) toast('Limite de '+LIMITE_PHOTOS_BOOK+' photos : seules '+place+' photo(s) sur '+files.length+' seront envoyées.', true);
    // Progression visible photo par photo : sans elle, un envoi de plusieurs photos sur
    // une connexion lente donnait l'impression que rien ne se passait.
    // (01/11/2026, demande de la propriétaire) jauge en bas de l'écran « Photos envoyées : 3 / 10 » (suiviPhotos,
    // js/app.js) et 2 photos envoyées à la fois (plus rapide, sans saturer une connexion 3G)
    let nbOk = 0, suivante = 0;
    const resultats = new Array(aEnvoyer.length).fill(null);
    if (typeof suiviPhotos !== 'undefined') suiviPhotos.debut(aEnvoyer.length);
    const ouvrier = async function(){
      while (suivante < aEnvoyer.length) {
        const k = suivante++;
        resultats[k] = await Store.uploadPhoto(aEnvoyer[k]);
        if (typeof suiviPhotos !== 'undefined') suiviPhotos.photoFinie();
      }
    };
    try { await Promise.all([ouvrier(), ouvrier()]); }
    finally { if (typeof suiviPhotos !== 'undefined') suiviPhotos.fin(); }
    resultats.forEach(function(item){ if (item) { s.photos.book.push(item); nbOk++; } });  // (dans l'ordre choisi)
    if (aEnvoyer.length > 1) toast(nbOk === aEnvoyer.length ? 'Les '+nbOk+' photos ont bien été ajoutées.' : nbOk+' photo(s) ajoutée(s) sur '+aEnvoyer.length+'.', nbOk !== aEnvoyer.length);
    else if (nbOk === 1) toast('Photo ajoutée.');
    fBook.value=''; render();
  });
  document.querySelectorAll('[data-rmbook]').forEach(function(b){ b.addEventListener('click', async function(e){
    e.stopPropagation();
    const id = b.dataset.rmbook; const photo = s.photos.book.find(function(ph){ return String(ph.id)===String(id); });
    if (!photo) return;
    const ok = await Store.removePhoto(id, photo.fichiers);
    if (ok) {
      s.photos.book = s.photos.book.filter(function(ph){ return String(ph.id)!==String(id); });
      if (s.photos.principale && String(s.photos.principale.id)===String(id)) s.photos.principale=null;
      if (s.photos.photoCv && String(s.photos.photoCv.id)===String(id)) s.photos.photoCv=null;
      if (s.photos.pleinPied && String(s.photos.pleinPied.id)===String(id)) s.photos.pleinPied=null;
      if (s.photos.couverture && String(s.photos.couverture.id)===String(id)) s.photos.couverture=null;
      render();
    }
  }); });
}

/* --------------------------------------------------- COMPÉTENCES : handlers
   Auto-enregistrées au relâchement du curseur (pas à chaque pixel glissé) —
   même colonne jsonb "competences" que l'ancien système, déjà en production. */
function bindCompetencesHandlers(){
  document.querySelectorAll('input[data-competence]').forEach(function(el){
    el.addEventListener('change', function(){
      state.competences[el.dataset.competence] = parseInt(el.value, 10);
      void Store.saveBlock({ competences: state.competences });
    });
  });
}

/* ------------------------------------------------------------ REFUSÉ --- */
function viewRefuse(){
  return header() + '<div class="panel confirm refuse"><div class="check">!</div>' +
    '<h2>Dossier à corriger</h2>' +
    '<p>L’administrateur a demandé des corrections avant de pouvoir valider votre profil.'+
    (state.meta.commentaireAdmin ? '<br><br><em>« '+echapperHtml(state.meta.commentaireAdmin)+' »</em>' : '')+'</p>' +
    '<div class="status-pill refuse"><span class="dot"></span> À corriger</div>' +
    '<div class="p20-18"><button class="btn primary" id="reprendreDossier">Reprendre mon dossier</button></div></div>';
}
function bindRefuse(){
  document.getElementById('reprendreDossier')?.addEventListener('click', function(){
    state.meta.currentStep = 1; state.meta.statutAffichage = 'brouillon'; render();
  });
}

function viewSourdine(){
  return header() + '<div class="panel confirm refuse"><div class="check">!</div>' +
    '<h2>Profil désactivé</h2>' +
    '<p>L’administrateur a désactivé votre profil. Il n’est plus visible sur le site et vous ne pouvez plus le modifier pour le moment.</p>' +
    '<p>Pour toute question, contactez l’agence sur WhatsApp.</p>' +
    '<div class="p20-18"><a class="btn primary" href="'+MA2M_WHATSAPP+'" target="_blank" rel="noopener">Écrire à l’agence sur WhatsApp</a></div></div>';
}

/* -------------------------------------------------------- CONFIRMATION */
function viewConfirmation(){
  return header() + '<div class="panel confirm"><div class="check">✓</div>' +
    '<h2>Profil bien enregistré</h2>' +
    '<p>Votre profil a bien été enregistré et transmis à Maître Akessé Model Management. Votre dossier est actuellement en attente de validation par l’administrateur.</p>' +
    '<div class="status-pill"><span class="dot"></span> En attente de validation</div></div>';
}

/* ------------------------------------------------------------ TABLEAU DE BORD */
/* Pastilles rouges (décision de la propriétaire, 07/10/2026) : sur chaque onglet et chaque
   bloc, le nombre d'éléments à remplir ou à corriger (mensurations incohérentes comprises),
   et ces cases encadrées en rouge quand la mannequin ouvre l'onglet. Même règle que le
   Rapport des profils envoyé par WhatsApp (js/analyse-profil.js). */
const CHAMPS_ANALYSE = {
  naissance:'f-dob', nationalite:'f-nat', ville:'f-ville', presentation:'f-bio', presentationCourte:'f-bio', instagram:'f-instagram',
  height_cm:'f-taille', weight_kg:'f-poids', chest_cm:'f-poitrine', waist_cm:'f-tourTaille', hips_cm:'f-hanches', neck_cm:'f-cou',
  shoulder_cm:'f-epaules', arm_cm:'f-bras', inseam_cm:'f-entrejambe', shoe_size:'f-pointure', eye_color:'f-yeux', hair_color:'f-cheveux'
};
const BLOCS_ETAPES = MA2M_BLOCS; // js/analyse-profil.js
function pointsARemplir(){
  if (typeof ma2mAnalyserProfil !== 'function') return null;
  const d = state.identite, f = state.formation, pp = state.profilPro, ph = state.photos, p = state.physique;
  const ligne = Object.assign(physiqueToDb(p), {
    category: d.sexe, date_naissance: d.dateNaissance, nationalite: d.nationalite, city: d.ville,
    bio: state.bio, instagram: state.instagram, sans_instagram: state.sansInstagram,
    niveau_mannequin: pp.niveauMannequin, years_experience: pp.anneesExperience, languages: pp.langues.join(', '),
    niveau_etude: f.niveau, formation_mannequin: f.mannequin, shoulder_cm: p.epaules, arm_cm: p.bras, neck_cm: p.cou
  });
  const meme = function(x, y){ return !!x && !!y && String(x.id) === String(y.id); };
  const photos = ph.book.filter(function(x){ return !x.ecartee; }).map(function(x, i){
    return { id: x.id, principale: meme(x, ph.principale), photo_couverture: meme(x, ph.couverture), created_at: new Date(Date.UTC(2000, 0, 1) + i * 1000).toISOString() };
  });
  const pts = ma2mPointsParBloc(ma2mAnalyserProfil(ligne, photos, toutesExperiences().length, true));
  const ids = { etudes: 'f-niveau', langues: 'langues', experiences: 'addExp', profil: 'photosAilleurs', couverture: 'photosAilleurs', identiques: 'photosAilleurs', book: 'book' };
  const champs = {};
  MA2M_BLOCS.forEach(function(k){
    champs[k] = [];
    pts.elements[k].forEach(function(e){ const id = CHAMPS_ANALYSE[e] || ids[e]; if (id && champs[k].indexOf(id) === -1) champs[k].push(id); });
  });
  return { champs: champs, nb: pts.nb };
}
function pastilleRouge(n){
  return n > 0 ? '<span class="pastille-rouge" title="'+n+' élément'+(n>1?'s':'')+' à remplir ou à corriger">'+n+'</span>' : '';
}
// Encadre en rouge les cases à remplir du bloc affiché ; le rouge d'une case s'en va dès
// qu'elle est remplie (le chiffre de la pastille se met à jour à l'enregistrement).
function marquerChampsARemplir(bloc){
  const pts = pointsARemplir(); if (!pts || !bloc) return;
  const cibles = pts.champs[bloc] || [];
  cibles.forEach(function(id){
    let el;
    if (id === 'langues') el = document.querySelector('[data-langue]') && document.querySelector('[data-langue]').closest('.field');
    else if (id === 'book') el = document.querySelector('.book-multi-upload');
    else { const c = document.getElementById(id); el = c && (c.closest('.field') || c); }
    if (!el) return;
    el.classList.add('champ-a-remplir');
    el.addEventListener('change', function(){ el.classList.remove('champ-a-remplir'); });
    el.addEventListener('input', function(){ el.classList.remove('champ-a-remplir'); });
  });
  const n = pts.nb[bloc] || 0, panneau = document.querySelector('.panel');
  if (n && panneau && !panneau.querySelector('.notice-a-remplir')) {
    const p = document.createElement('p');
    p.className = 'notice-a-remplir';
    p.textContent = n + ' élément' + (n>1?'s':'') + ' à remplir ou à corriger dans ce bloc : '+(n>1?'ils sont encadrés':'il est encadré')+' en rouge.';
    const titre = panneau.querySelector('h2');
    if (titre) titre.insertAdjacentElement('afterend', p); else panneau.prepend(p);
  }
}



// état du profil déjà publié, en haut des 6 étapes (avant : en haut de l'ancien tableau de bord)
function bandeauStatut(){
  let bandeau = '';
  if (state.meta.statutAffichage === 'en_attente') bandeau = '<div class="online-banner p20-7"><span class="dot p20-4"></span> Modifications en cours de revalidation par l’agence</div>';
  else if (state.meta.statutAffichage === 'refuse') bandeau = '<div class="online-banner p20-5"><span class="dot p20-2"></span> Correction demandée'+(state.meta.commentaireAdmin?' · « '+echapperHtml(state.meta.commentaireAdmin)+' »':'')+'</div>';
  else if (state.meta.statutAffichage === 'valide') bandeau = '<div class="online-banner"><span class="dot p20-3"></span> Profil en ligne, visible sur le site</div>';
  // (11/11/2026, signalé par la propriétaire) profil jamais publié mais marqué « déjà formé » par le rattrapage de
  // l'Extension 43 : le bandeau disait à tort « en ligne » ; l'Extension 161 les renvoie vers les 6 étapes.
  else bandeau = '<div class="online-banner p20-5"><span class="dot p20-2"></span> Profil pas encore en ligne : il doit d’abord être validé par l’agence</div>';
  return bandeau;
}



/* ------------------------------------------------------------- CV / PDF ---
   Icônes, libellés de compétences et regroupement des expériences : partagés
   dans js/app.js (const MCV_ICONS, LIBELLES_COMPETENCES, ORDRE_COMPETENCES,
   ORDRE_CATEGORIES_PROJETS, fonctions mcvIcon/categoriserProjet/groupExperiences/
   construireHtmlCv) — repris tel quel par l'outil admin du tableau de bord,
   pour n'avoir qu'un seul gabarit de CV à maintenir. */

function donneesCvDepuisEtat(){
  const d = state.identite, p = state.physique, f = state.formation;
  return {
    nomComplet: d.nomComplet, dateNaissance: d.dateNaissance, villeNaissance: d.villeNaissance,
    lieuNaissance: d.lieuNaissance, nationalite: d.nationalite, ville: d.ville, quartier: d.quartier,
    citation: state.citation, bio: state.bio, instagram: state.instagram,
    niveauMannequin: niveauControle(state.profilPro.niveauMannequin, toutesExperiences(), state.profilPro.anneesExperience),
    mannequinId: currentUser.id,
    photoCvUrl: state.photos.photoCv && state.photos.photoCv.urlPleine || '',
    compcardPhotos: [1,2,3,4,5].map(function(n){
      const ph = state.photos.book.find(function(x){ return x.compcardOrdre===n; });
      return ph ? (ph.urlPleine||ph.url) : null;
    }),
    photosBook: (state.photos.principale ? [state.photos.principale] : []).concat(state.photos.book).map(function(ph){ return ph.urlPleine||ph.url; }),
    physique: p, formation: f, competences: state.competences, experiences: toutesExperiences(), sexe: d.sexe,
    langues: (state.profilPro && state.profilPro.langues) || []
  };
}


// Reconstruit, à partir de l'état réel du profil, l'objet { profil, photos, projets }
// attendu par construireCanvasCompcard()/genererFiche() (js/app.js) — le même
// générateur canvas que celui de la fiche publique (mannequin.html), pour ne jamais
// avoir deux rendus différents de la même compcard officielle.
function ficheDataDepuisEtat(){
  const d = state.identite, p = state.physique;
  return {
    profil: {
      full_name: d.nomComplet, city: d.ville || 'Abidjan', category: d.sexe,
      years_experience: state.profilPro.anneesExperience,
      niveau_mannequin: niveauControle(state.profilPro.niveauMannequin, toutesExperiences(), state.profilPro.anneesExperience),
      height_cm: p.taille, weight_kg: p.poids, chest_cm: p.poitrine, waist_cm: p.tourTaille,
      hips_cm: p.hanches, inseam_cm: p.entrejambe, shoe_size: p.pointure,
      carnation: p.carnation, clothing_size: p.tailleVet, eye_color: p.yeux, hair_color: p.cheveux
    },
    photos: state.photos.book.map(function(ph){ return { url: ph.urlPleine||ph.url, compcard_ordre: ph.compcardOrdre }; }),
    projets: toutesExperiences()
  };
}

// Aperçu de la compcard (11/11/2026, compcard « premium ») : l'image affichée est LA compcard elle-même, dessinée par
// construireCanvasCompcard (js/app.js) — l'aperçu et les fichiers PDF / image sont donc toujours identiques.
async function openCompcard(){
  document.getElementById('overlayContent').innerHTML =
    '<div class="overlay-close"><button id="closeOv">✕</button></div>' +
    '<div class="compcard-model compcard-apercu"><p class="sub">Préparation de votre compcard…</p></div>' +
    '<div class="cv-actions"><button class="btn ghost small" id="closeOv2">Fermer</button><button class="btn ghost small" id="p20BtnJpeg">Télécharger en image</button><button class="btn primary small" id="p20BtnPdf">Télécharger en PDF</button></div>';
  showOverlay();
  document.getElementById('p20BtnPdf').addEventListener('click', function(){ void genererFiche('pdf', ficheDataDepuisEtat(), 'p20BtnPdf', 'p20BtnJpeg', undefined, true); });
  document.getElementById('p20BtnJpeg').addEventListener('click', function(){ void genererFiche('jpeg', ficheDataDepuisEtat(), 'p20BtnPdf', 'p20BtnJpeg', undefined, true); });
  const zone = document.querySelector('.compcard-apercu');
  try {
    const canvas = await construireCanvasCompcard(ficheDataDepuisEtat());
    if (zone) zone.innerHTML = '<img src="' + apercuLeger(canvas) + '" alt="Ma compcard">';
  } catch (e) {
    signalerProbleme('Aperçu de la compcard échoué', (e && e.message) || String(e), e && e.stack);
    if (zone) zone.innerHTML = '<p class="sub">L’aperçu n’a pas pu être préparé. Vous pouvez quand même télécharger la compcard.</p>';
  }
}

function showOverlay(){
  const ov = document.getElementById('overlay');
  ov.classList.remove('hidden');
  // Largeurs des barres de compétences posées après coup via l'API DOM (pas
  // en style="" inline) : le CSP strict de cette page bloque silencieusement
  // les valeurs de style calculées insérées comme texte dans le HTML.
  document.querySelectorAll('#overlayContent [data-largeur]').forEach(function(el){ el.style.width = el.dataset.largeur + '%'; });
  document.getElementById('closeOv')?.addEventListener('click', function(){ ov.classList.add('hidden'); });
  document.getElementById('closeOv2')?.addEventListener('click', function(){ ov.classList.add('hidden'); });
}

/* --------------------------------------------------------------- INIT --- */
async function demarrerApresConnexion(){
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { renderAuthGate(); return; }
  // (10/11/2026) mot de passe provisoire donné par l'agence (Administration › fiche de la mannequin) : choisir le sien
  // d'abord, avant tout le reste (api/portail.js, mannequin_mdp_provisoire)
  if (mdpProvisoireEnCours(user)) { afficherMdpObligatoire(); return; }  // (js/supabase-config.js)
  currentUser = user;
  await Store.ensureProfileRow();
  state = await Store.load();
  if (!state.meta.currentStep) state.meta.currentStep = 1;
  // (11/11/2026) raccourcis « Compcard », « Mon CV », « Mes photos » de l'application (onglet Mon profil) : la page
  // s'ouvre directement sur les photos (étape 5 des 6 étapes, ou bloc Photos une fois le profil validé)
  if (location.hash === '#compcard') state.meta.studio = 'compcard';
  else if (location.hash === '#cv') state.meta.studio = 'cv';
  else if (location.hash === '#photos') {
    state.meta.currentStep = 5;
  }
  render();
}

void (async function init(){
  if (!sb) {
    document.getElementById('app').innerHTML = '<div class="auth-loading"><span>Connexion au service indisponible pour le moment, réessayez dans quelques instants.</span></div>';
    return;
  }
  if (recuperationMdpEnCours) return; // le gestionnaire PASSWORD_RECOVERY prend déjà le relais
  try{
    // Filet de sécurité : sur une connexion lente/instable, la requête de
    // session peut ne jamais répondre (ni succès ni erreur), laissant la
    // page bloquée sur "Chargement…" indéfiniment (journal du site,
    // 03/10/2026). Au-delà de 10 s, on propose de réessayer plutôt que
    // de laisser l'écran vide.
    const delaiDepasse = Symbol('timeout');
    const resultat = await Promise.race([
      sb.auth.getSession(),
      new Promise(resolve => setTimeout(() => resolve(delaiDepasse), 10000))
    ]);
    if (resultat === delaiDepasse) {
      // Pas de onclick="" en ligne : le CSP strict de cette page le bloquerait en silence.
      document.getElementById('app').innerHTML = '<div class="auth-loading"><span>La connexion prend plus de temps que prévu. </span><button class="btn ghost small" id="btn-reessayer">Réessayer</button></div>';
      document.getElementById('btn-reessayer').addEventListener('click', function(){ location.reload(); });
      return;
    }
    const { data: { session } } = resultat;
    if (!session) { renderAuthGate(); return; }
    await demarrerApresConnexion();
  }catch(e){
    console.error(e);
    renderAuthGate();
  }
})();

