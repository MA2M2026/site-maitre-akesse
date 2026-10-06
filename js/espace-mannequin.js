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
      currentStep:1, editBlock:null, activeCompcardSlot:1,
      // Dérivés à l'affichage à partir des vraies colonnes (published /
      // en_attente_validation / raison_refus / premiere_publication_faite) —
      // jamais écrits tels quels en base, voir deriverStatutAffichage().
      statutAffichage:'brouillon', premierePublicationFaite:false, commentaireAdmin:''
    },
    identite:{ nomComplet:'', dateNaissance:'', villeNaissance:'', lieuNaissance:'', nationalite:'', ville:'', quartier:'', telephone:'', email:'', sexe:'' },
    physique:{
      taille:'', poids:'', poitrine:'', tourTaille:'', hanches:'', entrejambe:'', pointure:'',
      tailleVet:'', yeux:'', cheveux:'', carnation:'',
      // Extension 121 (06/10/2026) : épaules, bras, cou (hommes), tête
      epaules:'', bras:'', cou:'', tete:''
    },
    formation:{ niveau:'', etablissement:'', particuliere:'', mannequin:'' },
    // Niveau (New Face / Professionnel, 06/10/2026) : coché par la mannequin
    // (niveauMannequin), puis contrôlé en coulisses par niveauControle() (js/app.js) :
    // « Professionnel » n'est gardé qu'avec plus de 2 ans d'expériences.
    // anneesExperience n'est plus demandé (ancienne donnée gardée telle quelle).
    profilPro:{ anneesExperience:'', disponibilite:'', modelTypes:[], langues:[], niveauMannequin:'' },
    experiences:[],
    photos:{ principale:null, photoCv:null, pleinPied:null, couverture:null, book:[] },
    competences:{},
    citation:'',
    bio:'',
    instagram:'',
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
function urlIndiqueRecuperationMdp(){
  return /type=recovery/.test(window.location.hash + window.location.search);
}
let recuperationMdpEnCours = urlIndiqueRecuperationMdp();

const WORDMARK_HTML = '<a class="wordmark" href="index.html"><img src="assets/logo-header.png" alt="Maître Akesse Model Management"></a>';

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
      '<h2>Créer mon compte</h2><p class="sub">Un code d’invitation vous a été fourni par l’agence.</p>' +
      '<div class="grid">' +
        field('Code d’invitation','au-in-code','',{req:true}) + field('Nom complet','au-in-nom','',{req:true}) +
        field('E-mail','au-in-email','',{type:'email',req:true}) + field('Mot de passe (8 caractères minimum)','au-in-mdp','',{type:'password',req:true}) +
      '</div>' +
      '<div class="actions-row end"><button class="btn primary" id="au-in-valider">Créer mon compte</button></div>' +
      '<div id="au-in-msg" class="err-msg p20-14"></div>' +
    '</div>' +
    '<div id="auth-panneau-mdp-oublie" class="p20-9">' +
      '<h2>Mot de passe oublié</h2><p class="sub">Indiquez votre e-mail — si un compte y est associé, un lien de réinitialisation vous sera envoyé.</p>' +
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

function idAppareilMa2m() {
  try {
    let v = localStorage.getItem('ma2m_appareil');
    if (!v || !/^[A-Za-z0-9-]{8,64}$/.test(v)) {
      v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(16) + Math.random().toString(16).slice(2));
      localStorage.setItem('ma2m_appareil', v);
    }
    return v;
  } catch (e) { return null; }
}
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
      const reponse = await fetch('/api/connexion-protegee', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: mdp, espace: 'mannequin', appareil: idAppareilMa2m() })
      });
      const resultat = await reponse.json().catch(() => ({}));
      if (reponse.status === 429) {
        const h = Math.ceil(resultat.minutesRestantes / 60);
        msg.textContent = resultat.dejaBloque
          ? `Accès temporairement bloqué. Revenez dans ${resultat.minutesRestantes} min.`
          : `Trop de tentatives. Accès bloqué. Revenez dans ${h >= 1 ? h + ' heure' + (h > 1 ? 's' : '') : resultat.minutesRestantes + ' min'}.`;
        return;
      }
      if (!reponse.ok) {
        const reste = resultat.essaisRestants;
        msg.textContent = reste === 2 ? 'E-mail ou mot de passe incorrect. Attention : il vous reste 2 tentatives.'
          : reste === 1 ? 'E-mail ou mot de passe incorrect. Il vous reste 1 tentative.'
          : 'E-mail ou mot de passe incorrect.';
        return;
      }
      const { error } = await sb.auth.setSession({ access_token: resultat.access_token, refresh_token: resultat.refresh_token });
      if (error) { msg.textContent = 'Erreur de connexion — réessayez.'; return; }
      msg.textContent = '';
      await demarrerApresConnexion();
    } catch (e) {
      msg.textContent = 'Erreur de connexion — réessayez.';
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
        else msg.textContent = 'La création du compte a échoué — réessayez dans quelques instants.';
        return;
      }
    } catch (e) {
      msg.textContent = 'Erreur de connexion — réessayez.';
      return;
    }

    // Compte créé : connexion immédiate, par le même chemin que « Se connecter ».
    try {
      const reponse = await fetch('/api/connexion-protegee', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: mdp, espace: 'mannequin', appareil: idAppareilMa2m() })
      });
      const resultat = await reponse.json().catch(() => ({}));
      if (!reponse.ok) throw new Error('connexion');
      const { error } = await sb.auth.setSession({ access_token: resultat.access_token, refresh_token: resultat.refresh_token });
      if (error) throw error;
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
    const { error } = await sb.auth.updateUser({ password: nouveauMdp });
    if (error) { msg.textContent = 'Erreur : ' + error.message; return; }
    recuperationMdpEnCours = false;
    await demarrerApresConnexion();
  });
}

function renderAuthGate(){
  const app = document.getElementById('app');
  app.innerHTML = viewAuthGate();
  bindAuthGate();
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
    shoulder_cm: toNum(p.epaules), arm_cm: toNum(p.bras), neck_cm: toNum(p.cou), head_cm: toNum(p.tete)
  }).eq('id', currentUser.id);
  // On ne bloque pas le reste de l'étape, mais la mannequin est prévenue.
  if (error) { console.warn('Mensurations complémentaires non enregistrées :', error.message); toast('Épaules, bras, cou et tête : pas encore enregistrés, réessayez un peu plus tard', true); }
  return true;
}
function formationToDb(f){
  return { niveau_etude: f.niveau || null, etablissement: f.etablissement || null, formation_particuliere: f.particuliere || null, formation_mannequin: f.mannequin || null };
}
function profilProToDb(pp){
  return {
    availability: pp.disponibilite || null,
    model_types: pp.modelTypes, languages: pp.langues.join(', '),
    niveau_mannequin: pp.niveauMannequin ? niveauControle(pp.niveauMannequin, state.experiences, pp.anneesExperience) : null
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
const Store = {
  async load(){
    const { data: profile, error: e1 } = await sb.from('model_profiles')
      .select('id, full_name, bio, height_cm, weight_kg, city, quartier, instagram, published, created_at, category, chest_cm, waist_cm, hips_cm, shoe_size, carnation, clothing_size, date_naissance, eye_color, hair_color, years_experience, niveau_mannequin, model_types, languages, availability, inseam_cm, featured, premiere_publication_faite, en_attente_validation, raison_refus, niveau_etude, etablissement, formation_particuliere, formation_mannequin, competences, citation, ville_naissance, lieu_naissance, nationalite')
      .eq('id', currentUser.id).maybeSingle();
    if (e1) { console.error(e1); toast('Erreur de chargement du profil', true); return emptyState(); }

    const { data: contactPriveRows } = await sb.rpc('mon_contact_prive');
    const contactPrive = contactPriveRows && contactPriveRows[0] ? contactPriveRows[0] : null;

    const s = mapProfileFromDb(profile, contactPrive);

    const supp = await ma2mMesuresSupp(currentUser.id); // vide si l'Extension 121 n'est pas encore exécutée
    Object.assign(s.physique, { epaules: supp.shoulder_cm ?? '', bras: supp.arm_cm ?? '', cou: supp.neck_cm ?? '', tete: supp.head_cm ?? '' });
    s.physique.tailleVet = tailleGeneraleCalculee(s.physique, s.identite.sexe);

    const { data: exps } = await sb.from('model_projects').select('*').eq('model_id', currentUser.id).order('created_at', { ascending:true });
    s.experiences = (exps||[]).map(function(e){ return { id:e.id, type:e.type_projet, nom:e.titre, lieu:e.ville, annee:e.periode }; });

    const { data: photos } = await sb.from('model_photos').select('*').eq('model_id', currentUser.id).order('created_at', { ascending:true });
    (photos||[]).forEach(function(p){
      const item = { id:p.id, numero:p.numero||null, path:p.chemin, url:p.url_miniature||p.url, urlPleine:p.url, compcardOrdre:p.compcard_ordre, couverturePosition:p.couverture_position||'center' };
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
    if (error) { console.error(error); toast('Informations « événements » non enregistrées — réessayez', true); return false; }
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
      .eq('id', currentUser.id).select().single();
    if (error) { console.error(error); toast('Échec de la soumission', true); return null; }
    return resultat;
  },

  async addExperience(exp){
    const { data, error } = await sb.from('model_projects')
      .insert({ model_id: currentUser.id, type_projet: exp.type, titre: exp.nom, ville: exp.lieu, periode: exp.annee })
      .select().single();
    if (error) { console.error(error); toast("Échec de l'ajout de l'expérience", true); return null; }
    return { id:data.id, type:data.type_projet, nom:data.titre, lieu:data.ville, annee:data.periode };
  },
  async updateExperience(id, exp){
    const { error } = await sb.from('model_projects').update({ type_projet:exp.type, titre:exp.nom, ville:exp.lieu, periode:exp.annee }).eq('id', id).eq('model_id', currentUser.id);
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
      const fichierConverti = await convertirSiHeic(file);
      const fichier = await compresserPhotoOrigine(fichierConverti);
      const chemin = currentUser.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '-' + nomFichierSur(fichier.name);
      const url = await uploaderVersR2(currentUser.id, chemin, fichier, fichier.type || 'image/jpeg');

      let cheminMiniature=null, urlMiniature=null;
      const blobMiniature = await genererMiniature(fichier);
      if (blobMiniature) {
        cheminMiniature = currentUser.id + '/miniatures/' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '-n800.jpg';
        try { urlMiniature = await uploaderVersR2(currentUser.id, cheminMiniature, blobMiniature, 'image/jpeg'); }
        catch(e) { console.warn('Miniature non envoyée :', e); cheminMiniature=null; }
      }
      let cheminMoyenne=null, urlMoyenne=null;
      const blobMoyenne = await genererMiniature(fichier, 1400, 0.78);
      if (blobMoyenne) {
        cheminMoyenne = currentUser.id + '/moyennes/' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.jpg';
        try { urlMoyenne = await uploaderVersR2(currentUser.id, cheminMoyenne, blobMoyenne, 'image/jpeg'); }
        catch(e) { console.warn('Version moyenne non envoyée :', e); cheminMoyenne=null; }
      }

      const { data: row, error: dbErr } = await sb.from('model_photos').insert({
        model_id: currentUser.id, url, chemin, url_miniature:urlMiniature, chemin_miniature:cheminMiniature,
        url_moyenne:urlMoyenne, chemin_moyenne:cheminMoyenne, originale_optimisee:true
      }).select().single();
      if (dbErr) throw dbErr;
      trierPhotoEnArrierePlan(row.id);
      return { id: row.id, numero: row.numero||null, path: chemin, url: urlMiniature||url, urlPleine:url, compcardOrdre:null };
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

  async removePhoto(id, path, cheminMiniature, cheminMoyenne){
    try{
      // D'abord la fiche en base : si elle échoue, on ne touche surtout pas aux
      // fichiers (sinon la photo resterait listée mais cassée).
      const { error } = await sb.from('model_photos').delete().eq('id', id).eq('model_id', currentUser.id);
      if (error) throw error;
      if (path) supprimerDeR2(currentUser.id, path);
      if (cheminMiniature) supprimerDeR2(currentUser.id, cheminMiniature);
      if (cheminMoyenne) supprimerDeR2(currentUser.id, cheminMoyenne);
      return true;
    }catch(e){ console.error(e); toast('Échec de la suppression', true); return false; }
  },

  /* Un seul rôle à la fois par mannequin pour chaque colonne — même principe
     que "principale" déjà en production : on désactive l'ancienne avant
     d'activer la nouvelle. */
  async setRolePhoto(colonne, photoId){
    const { error: eOff } = await sb.from('model_photos').update({ [colonne]: false }).eq('model_id', currentUser.id).eq(colonne, true);
    if (eOff) { console.error(eOff); toast('Échec de la mise à jour', true); return false; }
    if (photoId) {
      const { error: eOn } = await sb.from('model_photos').update({ [colonne]: true }).eq('id', photoId).eq('model_id', currentUser.id);
      if (eOn) { console.error(eOn); toast('Échec de la mise à jour', true); return false; }
    }
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
    if (error) { console.error(error); toast('Échec de la sélection compcard — réessayez', true); return false; }
    return true;
  },
};

/* ------------------------------------------------------- ENVOI VERS R2 ---
   Les photos du Book ne passent plus par Supabase Storage (bande passante
   trop coûteuse) mais par Cloudflare R2, via une URL signée temporaire que
   seule api/r2-presigner.js peut délivrer (clés R2 jamais côté navigateur). */
async function jetonSessionCourante(){
  const { data: { session } } = await sb.auth.getSession();
  return session ? session.access_token : null;
}
// Tri automatique de la photo par IA (06/10/2026) : lancé en arrière-plan,
// sans attendre ni rien afficher — la mannequin n'est pas informée du résultat.
// Une photo jugée inutilisable est seulement cachée (jamais supprimée) ; si cet
// appel échoue, le tableau de bord rattrape la photo plus tard.
function trierPhotoEnArrierePlan(photoId){
  jetonSessionCourante().then(function(jeton){
    if (!jeton || !photoId) return;
    return fetch('/api/trier-photo', {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jeton },
      body: JSON.stringify({ photoId: String(photoId) })
    });
  }).catch(function(){});
}

async function uploaderVersR2(modelId, chemin, blob, contentType){
  const jeton = await jetonSessionCourante();
  if (!jeton) throw new Error('Session expirée — reconnectez-vous.');
  // L'envoi part directement vers Cloudflare R2 (pas via notre propre serveur) :
  // sur une connexion mobile instable, ce trajet plus long échoue parfois une
  // fois puis réussit au second essai — on retente automatiquement avant de
  // faire remonter l'échec, plutôt que de faire porter cette fragilité réseau
  // à la mannequin dès le premier raté.
  let derniereErreur;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const reponse = await fetch('/api/r2-presigner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jeton },
        body: JSON.stringify({ modelId: modelId, chemin: chemin, contentType: contentType || 'image/jpeg', taille: blob.size })
      });
      const resultat = await reponse.json().catch(function(){ return {}; });
      if (!reponse.ok) throw new Error(resultat.error || "Échec de l'obtention de l'URL d'envoi.");
      const envoi = await fetch(resultat.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType || 'image/jpeg' }, body: blob });
      if (!envoi.ok) throw new Error("Échec de l'envoi vers le stockage.");
      return resultat.publicUrl;
    } catch (e) {
      derniereErreur = e;
      if (essai < 3) await new Promise(function(r){ setTimeout(r, 700 * essai); });
    }
  }
  throw derniereErreur;
}
async function supprimerDeR2(modelId, chemin){
  if (!chemin) return;
  try{
    const jeton = await jetonSessionCourante();
    if (!jeton) return;
    await fetch('/api/r2-presigner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jeton },
      body: JSON.stringify({ action: 'suppression', modelId: modelId, chemin: chemin })
    });
  }catch(e){ console.warn('Suppression R2 non confirmée :', e); }
}

/* ---------------------------------------------------------- UTILS PHOTOS ---
   Repris à l'identique de espace-mannequin-ancien.html (même comportement, même
   pipeline HEIC/compression/miniatures) — voir README-TECHNIQUE.md. */
function compresserPhotoOrigine(fichier, coteMax, qualite){
  coteMax = coteMax || 2200; qualite = qualite || 0.85;
  return new Promise(function(resolve){
    // Compresse toute photo lourde (> 900 Ko), pas seulement les JPEG : les captures
    // d'écran PNG ou les WebP de plusieurs Mo partaient telles quelles, très lentes à
    // envoyer sur une connexion mobile (audit du 28 septembre 2026). Les GIF sont
    // laissés intacts (animation). Sortie toujours en JPEG, sur fond blanc.
    const compressible = /^image\/(jpeg|jpg|pjpeg|png|webp)$/i.test(fichier.type || '');
    if (!compressible || fichier.size < 900*1024) { resolve(fichier); return; }
    const img = new Image();
    img.onload = function(){
      try{
        const coteActuel = Math.max(img.width, img.height);
        const ratio = coteActuel > coteMax ? coteMax/coteActuel : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width*ratio); canvas.height = Math.round(img.height*ratio);
        const ctxC = canvas.getContext('2d');
        ctxC.fillStyle = '#fff'; ctxC.fillRect(0,0,canvas.width,canvas.height); // transparence PNG → blanc
        ctxC.drawImage(img,0,0,canvas.width,canvas.height);
        canvas.toBlob(function(blob){
          if (!blob || blob.size >= fichier.size) { resolve(fichier); return; }
          resolve(new File([blob], fichier.name.replace(/\.\w+$/, '.jpg'), { type:'image/jpeg' }));
        }, 'image/jpeg', qualite);
      }catch(e){ resolve(fichier); }
    };
    img.onerror = function(){ resolve(fichier); };
    img.src = URL.createObjectURL(fichier);
  });
}
// Miniature (grille du Book) : 800 px de côté depuis le 06/10/2026 (500 px avant — un peu
// floue sur les téléphones à écran très fin) ; le nom finit par « -n800.jpg » pour que
// l'outil du tableau de bord sache qu'elle est déjà au nouveau format.
function genererMiniature(fichier, coteMax, qualite){
  coteMax = coteMax || 800; qualite = qualite || 0.75;
  return new Promise(function(resolve){
    const img = new Image();
    img.onload = function(){
      try{
        const coteActuel = Math.max(img.width, img.height);
        const ratio = coteActuel > coteMax ? coteMax/coteActuel : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width*ratio); canvas.height = Math.round(img.height*ratio);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        canvas.toBlob(function(blob){ resolve(blob||null); }, 'image/jpeg', qualite);
      }catch(e){ resolve(null); }
    };
    img.onerror = function(){ resolve(null); };
    img.src = URL.createObjectURL(fichier);
  });
}

/* ------------------------------------------------------------- UTILS UI --- */
const STEP_LABELS = ['Identité','Physique','Formation','Expérience','Photos','Récapitulatif'];
const EXP_TYPES = ['Défilé','Campagne','Éditorial','Shooting','Lookbook','Publicité','Fitting','Showroom','Vidéo','Autre'];
// MOIS_FR / formaterPeriode : partagés dans js/app.js (aussi utilisés par le CV).

function header(rightLabel){
  return '<div class="top">'+WORDMARK_HTML+
    '<div class="top-right">' +
      '<div class="espace-tag">' + (rightLabel||'Mon espace mannequin') + '<b>' + echapperHtml(state.identite.nomComplet||'').trim() + '</b></div>' +
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
  const enModeGuide = !state.meta.premierePublicationFaite;
  if (enModeGuide) {
    if (state.meta.statutAffichage === 'en_attente') { app.innerHTML = viewConfirmation(); return; }
    if (state.meta.statutAffichage === 'refuse') { app.innerHTML = viewRefuse(); bindRefuse(); return; }
    app.innerHTML = viewWizard();
    bindWizard();
    return;
  }
  // Mode autonome : le tableau de bord reste toujours accessible une fois la
  // première publication faite, même si le profil repasse en attente/refusé
  // par la suite — seuls les bandeaux d'état changent (identique à l'ancien
  // système, voir appliquerModeGuide()/gerer_validation_publication()).
  if (state.meta.editBlock) { app.innerHTML = viewBlockEditor(state.meta.editBlock); bindBlockPage(state.meta.editBlock); return; }
  app.innerHTML = viewDashboard();
  bindDashboard();
}

/* --------------------------------------------------------------- WIZARD */
function stepComplete(n){
  if (n===1) return !!(state.identite.nomComplet && state.identite.dateNaissance && state.identite.sexe);
  if (n===2) return !!(state.physique.taille && state.physique.poids);
  if (n===3) return !!state.formation.niveau;
  if (n===4) return state.experiences.length>0;
  if (n===5) return !!(state.photos.principale && state.photos.book.length);
  return false;
}

function viewWizard(){
  const pct = Math.round(((state.meta.currentStep-1)/6)*100 + (stepComplete(state.meta.currentStep)?100/6:0));
  const clamped = Math.min(100, Math.max(0,pct));
  return header() +
  '<div class="greet"><h1>Bonjour ' + echapperHtml((state.identite.nomComplet||'').split(' ')[0]||'') + '</h1>' +
  '<p>Complétez votre profil professionnel pour permettre à l’agence de créer votre dossier mannequin. Chaque étape s’enregistre au fur et à mesure — vous pouvez y revenir à tout moment avant l’envoi final.</p>' +
  '<div class="progress-row"><div class="progress-track"><div class="progress-fill" data-largeur="'+clamped+'"></div></div>' +
  '<div class="progress-pct">'+clamped+'%</div></div></div>' +
  '<div class="stepper">' + STEP_LABELS.map(function(l,i){
    const n=i+1; const cls = n===state.meta.currentStep?'active':(stepComplete(n)?'done':'');
    return '<button type="button" class="step-tab '+cls+'" data-goto="'+n+'"><span class="n">'+['①','②','③','④','⑤','⑥'][i]+'</span>'+l+'</button>';
  }).join('') + '</div>' +
  '<div class="panel">' + stepContent(state.meta.currentStep) + '</div>';
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
      '<select id="'+id+'" data-avec-autre="1"><option value="">—</option>' +
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
    '<p class="sub p20-21">🔒 Téléphone et e-mail ne sont jamais affichés publiquement — seul le contact officiel de l’agence apparaît sur votre fiche.</p>' +
    '<div class="field full p20-17"><label>Sexe<span class="req">*</span></label><div class="radio-row">' +
    [['femme','Femme'],['homme','Homme']].map(function(c){ return '<label class="radio-opt '+(d.sexe===c[0]?'selected':'')+'"><input type="radio" name="sexe" value="'+c[0]+'" '+(d.sexe===c[0]?'checked':'')+'> '+c[1]+'</label>'; }).join('') +
    '</div></div>' +
    '<div class="grid p20-17">' +
    field('Présentation / profil','f-bio',state.bio,{tag:'textarea',full:true,req:true,placeholder:'Quelques phrases sur vous : votre parcours, votre style, ce qui vous distingue…'}) +
    field('Instagram (facultatif)','f-instagram',state.instagram,{placeholder:'@votre_compte'}) +
    field('Citation personnelle (facultatif)','f-citation',state.citation,{placeholder:'Une phrase courte qui vous représente',maxlength:120}) +
    '</div>' +
    '<div class="actions-row end"><button class="btn primary" id="save1">Enregistrer</button></div>';
}

// Branche les champs spécifiques à l'étape Identité qui ne sont pas de simples
// champs texte : cascade ville→commune, indicatif téléphonique, et suggestion
// automatique de la nationalité à partir du pays de naissance choisi (reste
// modifiable librement ensuite : née au Mali mais ivoirienne, par exemple).
function bindStepIdentite(){
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
    field('Tour de tête (cm)','f-tete',d.tete,{tag:'select',options:plageNombres(50,64,1,' cm')}) +
    field('Pointure (EU)','f-pointure',d.pointure,{tag:'select',options:plageNombres(34,48,1,'')}) +
    field('Couleur des yeux','f-yeux',d.yeux,{tag:'select-autre',options:['Marron','Noir','Vert','Bleu','Gris','Noisette']}) +
    field('Couleur des cheveux','f-cheveux',d.cheveux,{tag:'select-autre',options:['Noir','Brun','Châtain','Blond','Roux','Gris / Blanc']}) +
    '<div></div>' +
    '</div>' +
    '<div class="tailles-calculees" id="tailles-calculees"></div>' +
    '<p class="sub p20-14">📏 Mesurez-vous sans serrer le mètre ruban, en sous-vêtements ou vêtements fins. Vos tailles (haut, bas, générale) sont calculées automatiquement d’après vos mensurations, selon les barèmes internationaux : pour les changer, corrigez vos mesures.</p>' +
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
    '<input type="text" id="f-formMannequin" value="'+echapperHtml(d.mannequin||'')+'" placeholder="ex : MA2M — Coaching &amp; Masterclass"></div>' +
    '<div class="actions-row"><button class="btn ghost" data-goto="2">← Retour</button><button class="btn primary" id="save3">Enregistrer</button></div>';
}

const MODEL_TYPES = [['catwalk','Défilé'],['photo','Photo'],['publicite','Publicité'],['commercial','Commercial'],['autre','Autre']];
const LANGUES_DISPONIBLES = ['Français','Anglais','Espagnol','Autre'];
const NIVEAUX_MANNEQUIN = ['New Face','Professionnel']; // « Amateur » retiré le 06/10/2026

function stepExperience(){
  const pp = state.profilPro;
  var listHtml = state.experiences.length===0
    ? '<p class="exp-empty">Aucune expérience ajoutée pour le moment. Cliquez sur « + Ajouter une expérience ».</p>'
    : state.experiences.map(function(e,i){
        return '<div class="exp-card" data-exp="'+i+'"><div class="exp-fields">' +
        '<select data-expf="type" data-i="'+i+'">' + EXP_TYPES.map(function(t){ return '<option value="'+t+'" '+(e.type===t?'selected':'')+'>'+t+'</option>'; }).join('') + '</select>' +
        '<input type="text" data-expf="nom" data-i="'+i+'" placeholder="Nom du défilé / de la marque / de la campagne" value="'+echapperHtml(e.nom)+'">' +
        '<input type="text" data-expf="lieu" data-i="'+i+'" placeholder="Ville" value="'+echapperHtml(e.lieu)+'">' +
        '<input type="text" data-expf="annee" data-i="'+i+'" placeholder="Année" value="'+echapperHtml(e.annee)+'">' +
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
    '<p class="sub p20-20">Défilés, shootings, publicités, castings… Un seul projet suffit pour publier votre profil — vous pourrez toujours en ajouter d’autres plus tard.</p>' +
    '<button class="btn ghost small p20-12" id="addExp">+ Ajouter une expérience</button>' +
    '<div id="expList">'+listHtml+'</div>' +
    '<div class="actions-row"><button class="btn ghost" data-goto="3">← Retour</button><button class="btn primary" id="save4">Continuer</button></div>';
}

function photoThumb(item, label){ return (item && item.url) ? ('<img src="'+item.url+'" alt="'+label+'">') : ''; }

function stepPhotos(){
  const p = state.photos;
  const compcardPhotos = p.book.filter(function(ph){ return ph.compcardOrdre; }).sort(function(a,b){ return a.compcardOrdre-b.compcardOrdre; });
  const slots = [1,2,3,4,5].map(function(n){
    const ph = compcardPhotos.find(function(x){ return x.compcardOrdre===n; });
    const rule = n===1?'PLEIN PIED':n===2?'PORTRAIT':'PHOTO LIBRE';
    return '<div class="compcard-slot '+(ph?'filled ':'')+'cc-editable-slot" data-cc-slot="'+n+'">' +
      '<div class="cc-slot-num">'+n+'</div><div class="cc-slot-content">' +
      (ph?'<img src="'+ph.url+'" alt="Photo compcard '+n+'">':'<span class="cc-slot-plus">＋</span>') +
      '<div class="cc-slot-label '+(ph?'cc-slot-assigned':'')+'">'+(ph?'Photo sélectionnée':'Aucune photo sélectionnée')+'</div>' +
      '<small>'+rule+' — indication éditoriale, pas une contrainte</small>' +
      '<div class="cc-source-actions">' +
        '<button type="button" class="cc-source-btn gold" data-cc-book="'+n+'">Choisir dans mon Book</button>' +
        '<label class="cc-upload-btn" data-cc-upload-label="'+n+'"><input class="hidden-input" type="file" accept="image/*" id="fCcSlot'+n+'">Téléverser une nouvelle photo</label>' +
      '</div>' +
      (ph?'<button type="button" class="cc-remove-assignment" data-clear-cc-slot="'+n+'">Retirer de la compcard</button>':'') +
      '</div></div>';
  }).join('');
  const competencesHtml = ORDRE_COMPETENCES.map(function(cle){
    const v = state.competences[cle] || 3;
    return '<div class="field"><label>'+LIBELLES_COMPETENCES[cle]+'</label><input type="range" min="1" max="5" value="'+v+'" data-competence="'+cle+'"></div>';
  }).join('');
  return '<h2>Photos &amp; compétences</h2><p class="sub">Vos 3 photos principales (CV, profil, plein pied) sont indépendantes de la compcard — une photo du Book choisie pour la compcard n’est jamais dupliquée, elle reçoit simplement son numéro d’emplacement.</p>' +
  '<section class="documents-section"><div class="section-title-row"><div><span class="editor-kicker">CV</span><h3>Compétences mannequin</h3><p>Évaluez-vous honnêtement sur chaque compétence (1 à 5).</p></div></div>' +
    '<div class="grid g3">'+competencesHtml+'</div></section>' +
  '<div class="photo-principals-grid">' +
    '<div class="principal-photo-card '+(p.photoCv?'filled':'')+'" id="uPhotoCv">'+photoThumb(p.photoCv,'Photo CV')+'<div class="principal-photo-badge">PHOTO PRINCIPALE CV</div><div class="principal-photo-title">'+(p.photoCv?'Photo CV définie':'Choisir la photo du CV')+'</div><div class="principal-photo-hint">Portrait, buste ou 3/4 — la photo qui vous représente le mieux</div>' +
      '<label class="cc-upload-btn" data-cc-upload-label="photoCv"><input class="hidden-input" type="file" accept="image/*" id="fPhotoCv">Téléverser une nouvelle photo</label></div>' +
    '<div class="principal-photo-card '+(p.principale?'filled':'')+'" id="uPrincipale">'+photoThumb(p.principale,'Photo de profil')+'<div class="principal-photo-badge profile">PHOTO PRINCIPALE PROFIL</div><div class="principal-photo-title">'+(p.principale?'Photo profil définie':'Choisir la photo de profil')+'</div><div class="principal-photo-hint">Portrait, buste ou 3/4 — affichée sur votre fiche publique et dans THE BOOK</div>' +
      '<label class="cc-upload-btn" data-cc-upload-label="principale"><input class="hidden-input" type="file" accept="image/*" id="fPrincipale">Téléverser une nouvelle photo</label></div>' +
    '<div class="principal-photo-card '+(p.pleinPied?'filled':'')+'" id="uPleinPied">'+photoThumb(p.pleinPied,'Photo plein pied')+'<div class="principal-photo-badge fullbody">PHOTO PLEIN PIED</div><div class="principal-photo-title">'+(p.pleinPied?'Photo plein pied définie':'Choisir la photo plein pied')+'</div><div class="principal-photo-hint">Photo de référence plein pied</div>' +
      '<label class="cc-upload-btn" data-cc-upload-label="pleinPied"><input class="hidden-input" type="file" accept="image/*" id="fPleinPied">Téléverser une nouvelle photo</label></div>' +
    '<div class="principal-photo-card '+(p.couverture?'filled':'')+'" id="uCouverture">'+(p.couverture?'<img data-couv-preview src="'+p.couverture.url+'" alt="Photo de couverture">':'')+'<div class="principal-photo-badge cover">PHOTO DE COUVERTURE</div><div class="principal-photo-title">'+(p.couverture?'Photo de couverture définie':'Choisir la photo de couverture')+'</div><div class="principal-photo-hint">Bandeau en haut de votre fiche publique — plutôt une photo large</div>' +
    (p.couverture ? ('<div class="cc-couv-position"><button type="button" class="cc-couv-pos-btn '+(p.couverture.couverturePosition==='top'?'active':'')+'" data-couv-pos="top">Haut</button><button type="button" class="cc-couv-pos-btn '+((!p.couverture.couverturePosition||p.couverture.couverturePosition==='center')?'active':'')+'" data-couv-pos="center">Centre</button><button type="button" class="cc-couv-pos-btn '+(p.couverture.couverturePosition==='bottom'?'active':'')+'" data-couv-pos="bottom">Bas</button></div>') : '') +
      '<label class="cc-upload-btn" data-cc-upload-label="couverture"><input class="hidden-input" type="file" accept="image/*" id="fCouverture">Téléverser une nouvelle photo</label></div>' +
  '</div>' +
  '<section class="book-section"><div class="section-title-row"><div><span class="editor-kicker">GALERIE</span><h3>Photos du Book</h3><p>Ajoutez vos photos ici — c’est parmi elles que vous choisirez ensuite vos photos principales et votre compcard.</p></div>' +
    '<label class="book-multi-upload" for="fBook">＋ Ajouter des photos<input class="hidden-input" type="file" accept="image/*" id="fBook" multiple></label></div>' +
    '<div class="book-grid">'+p.book.map(function(ph){
      // Numéro fixe de la photo (Extension 117) : l'agence s'y réfère dans ses messages.
      return '<div class="book-thumb '+(ph.compcardOrdre?'cc-selected':'')+'" data-book-id="'+ph.id+'">'+photoThumb(ph,'Book')+
        (ph.numero?('<div class="book-num">N° '+Number(ph.numero)+'</div>'):'') +
        (ph.compcardOrdre?('<div class="book-slot-tag">COMPCARD '+ph.compcardOrdre+'</div>'):'') +
        '<button class="book-thumb-remove" data-rmbook="'+ph.id+'" title="Supprimer">✕</button>' +
        '<button class="book-select-btn" data-book-cc-toggle="'+ph.id+'">'+(ph.compcardOrdre?'Retirer de la compcard':'+ Compcard')+'</button>' +
      '</div>';
    }).join('')+'</div></section>' +
  '<section class="compcard-builder"><div class="section-title-row"><div><span class="editor-kicker">COMPCARD</span><h3>Les 5 photos de votre compcard</h3><p>Choisissez, parmi vos photos du Book, celles qui composent votre compcard.</p></div><span class="cc-rule">'+compcardPhotos.length+' / 5 sélectionnées</span></div>' +
    '<div class="compcard-slots editable-slots">'+slots+'</div></section>' +
  '<div class="actions-row"><button class="btn ghost" data-goto="4">← Retour</button><button class="btn primary" id="save5">Continuer</button></div>';
}

function stepRecap(){
  const d = state.identite, ph = state.physique, f = state.formation;
  const rows = [
    ['Identité', (d.nomComplet||'—')+' · '+niveauNormalise(state.profilPro.niveauMannequin, state.profilPro.anneesExperience)+' · '+(d.sexe==='femme'?'Femme':d.sexe==='homme'?'Homme':'—'), 1],
    ['Informations physiques', (ph.taille||'—')+' cm · '+(ph.poids||'—')+' kg', 2],
    ['Formation', f.niveau||'—', 3],
    ['Expérience professionnelle', state.experiences.length+' expérience(s) enregistrée(s)', 4],
    ['Photos', state.photos.book.length+' photo(s) dans le Book', 5],
  ];
  return '<h2>Récapitulatif</h2><p class="sub">Vérifiez vos informations avant l’envoi</p>' +
    rows.map(function(r){ return '<div class="recap-block"><div><div class="lbl">'+r[0]+'</div><div class="val">'+r[1]+'</div></div><button class="recap-link" data-goto="'+r[2]+'">Modifier</button></div>'; }).join('') +
    '<div class="visible-toggle"><input type="checkbox" id="f-visible"><p>Rendre mon profil visible publiquement sur le site.</p></div>' +
    '<div class="actions-row"><button class="btn ghost" data-goto="5">← Retour</button><button class="btn primary" id="submitProfile">Soumettre mon profil</button></div>';
}

function goto(n){ state.meta.currentStep = n; render(); window.scrollTo({top:0,behavior:'smooth'}); }

// Lecture des champs Identité/Physique — mutualisée entre le formulaire du
// premier parcours (bindWizard) et l'éditeur de bloc post-publication
// (bindBlockPage), qui réutilisent tous les deux stepIdentite()/stepPhysique().
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
    '<p class="sub">🔒 Réservées à l’agence MA2M (défilés, castings) — jamais affichées sur votre fiche publique. Votre Instagram se renseigne à l’étape « Identité ».</p>' +
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
  const t = ma2mTailles({ category: state.identite.sexe, chest_cm: val('f-poitrine'), waist_cm: val('f-tourTaille'), hips_cm: val('f-hanches'), neck_cm: document.getElementById('f-cou') ? val('f-cou') : '' });
  // Mesures incohérentes : cases en rouge + message, et pas de taille (js/tailles.js)
  const champs = { chest_cm: 'f-poitrine', waist_cm: 'f-tourTaille', hips_cm: 'f-hanches' };
  Object.keys(champs).forEach(function(cle){
    const el = document.getElementById(champs[cle]); if (!el) return;
    const bloc = el.closest('.field'), aReprendre = t.aReprendre.indexOf(cle) !== -1;
    bloc.classList.toggle('mesure-a-reprendre', aReprendre);
    let msg = bloc.querySelector('.mesure-msg');
    if (aReprendre && !msg) { msg = document.createElement('div'); msg.className = 'mesure-msg'; msg.textContent = 'Mensuration pas exacte, à reprendre'; bloc.appendChild(msg); }
    if (!aReprendre && msg) msg.remove();
  });
  if (t.aReprendre.length) {
    zone.innerHTML = '<div class="tc-titre">Vos tailles (calculées)</div><p class="tc-alerte">⚠️ Vos mesures en rouge ne vont pas ensemble (votre haut et votre bas s’écartent de plus d’une taille). Reprenez-les avec un mètre ruban, sans serrer, pour obtenir vos tailles.</p><p class="tc-alerte">Tant qu’elles ne sont pas corrigées, vos mensurations sont cachées sur votre fiche publique. Sans correction sous 7 jours, votre fiche est retirée du site ; elle revient automatiquement dès que vous corrigez.</p>';
    return;
  }
  const c = function(x){ return x ? echapperHtml(ma2mTailleCourte(x)) : '—'; };
  zone.innerHTML = '<div class="tc-titre">Vos tailles (calculées)</div><div class="tc-grille">' +
    '<div><span>Haut</span><b>'+c(t.haut)+'</b></div><div><span>Bas</span><b>'+c(t.bas)+'</b></div><div><span>Générale</span><b>'+echapperHtml(t.generale||'—')+'</b></div>' +
    (t.homme ? '<div><span>Chemise (col)</span><b>'+(t.chemise ? t.chemise.eu+' / '+t.chemise.us+'″' : '—')+'</b></div>' : '') +
    '</div>';
}
function brancherTaillesCalculees(){
  if (!document.getElementById('tailles-calculees')) return;
  ['f-poitrine','f-tourTaille','f-hanches','f-cou'].forEach(function(id){ const el = document.getElementById(id); if (el) el.addEventListener('change', afficherTaillesCalculees); });
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
  if (!document.getElementById('f-tiktok')) return true;
  const fe = lireFicheEvenementFormulaire();
  const vide = !fe.tailleHaut && !fe.tailleBas && !fe.regime && !fe.tiktok && !fe.facebook && fe.droitImage == null;
  const avant = state.ficheEvenement;
  const dejaVide = !avant.tailleHaut && !avant.tailleBas && !avant.regime && !avant.tiktok && !avant.facebook && avant.droitImage == null;
  state.ficheEvenement = fe;
  if (vide && dejaVide) return true; // rien de saisi : pas de ligne vide en base
  await Store.saveFicheEvenement(fe);
  return true;
}

function lirePhysiqueFormulaire(){
  const p = {
    taille: val('f-taille'), poids: val('f-poids'), poitrine: val('f-poitrine'), tourTaille: val('f-tourTaille'),
    hanches: val('f-hanches'), entrejambe: val('f-entrejambe'), pointure: val('f-pointure'),
    tailleVet: state.physique.tailleVet,
    epaules: val('f-epaules'), bras: val('f-bras'), cou: document.getElementById('f-cou') ? val('f-cou') : '', tete: val('f-tete'),
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
  document.querySelectorAll('[data-goto]').forEach(function(b){ b.addEventListener('click', function(){ goto(parseInt(b.dataset.goto,10)); }); });
  initSelectsAvecAutre();
  brancherTaillesCalculees();
  bindStepIdentite();
  const s = state;

  document.getElementById('save1')?.addEventListener('click', async function(){
    const btn = this;
    const identiteFormulaire = lireIdentiteFormulaire();
    identiteFormulaire.sexe = identiteFormulaire.sexe || s.identite.sexe;
    Object.assign(s.identite, identiteFormulaire);
    s.bio = val('f-bio'); s.instagram = val('f-instagram'); s.citation = val('f-citation');
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    const ok = await Store.saveBlock(Object.assign(identiteToDb(s.identite), { bio: s.bio||null, instagram: s.instagram||null, citation: s.citation||null }));
    if (ok) { toast('Enregistré'); goto(2); } else { btn.disabled=false; btn.textContent='Enregistrer'; }
  });

  document.getElementById('save2')?.addEventListener('click', async function(){
    const btn = this;
    Object.assign(s.physique, lirePhysiqueFormulaire());
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    const ok = await Store.saveBlock(physiqueToDb(s.physique)) && await enregistrerMesuresSupp(s.physique) && await enregistrerFicheEvenementDepuisFormulaire();
    if (ok) { toast('Enregistré'); goto(3); } else { btn.disabled=false; btn.textContent='Enregistrer'; }
  });

  document.getElementById('save3')?.addEventListener('click', async function(){
    const btn = this;
    s.formation.niveau = val('f-niveau'); s.formation.etablissement = val('f-etab');
    s.formation.particuliere = val('f-formPart'); s.formation.mannequin = val('f-formMannequin');
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    const ok = await Store.saveBlock(formationToDb(s.formation));
    if (ok) { toast('Enregistré'); goto(4); } else { btn.disabled=false; btn.textContent='Enregistrer'; }
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
    const draft = { type:'Défilé', nom:'', lieu:'', annee:new Date().getFullYear().toString() };
    const saved = await Store.addExperience(draft);
    if (saved) { s.experiences.push(saved); render(); }
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
      debounceTimer = setTimeout(function(){ Store.updateExperience(s.experiences[i].id, s.experiences[i]); }, 500);
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
    if (ok) { toast('Enregistré'); render(); } else { btn.disabled=false; btn.textContent='Enregistrer'; }
  });
}

/* ------------------------------------------------------- PHOTOS : handlers */
// Après un retrait de la compcard, Store.setCompcardOrdre(null) renumérote en base les
// photos suivantes (2→1, 3→2…) : on fait exactement la même chose à l'écran, sinon
// l'écran garde l'ancienne numérotation et la photo ajoutée ensuite prend un numéro
// déjà occupé en base (deux photos sur la même case).
function retirerDeCompcardLocal(photo){
  photo.compcardOrdre = null;
  state.photos.book.filter(function(ph){ return ph.compcardOrdre; })
    .sort(function(a,b){ return a.compcardOrdre-b.compcardOrdre; })
    .forEach(function(ph, i){ ph.compcardOrdre = i+1; });
}

// Le clic sur une photo de la fenêtre « Choisir dans mon Book » est écouté une seule
// fois pour toute la page : bindPhotoHandlers() est rappelée à chaque affichage, et
// l'écouteur était auparavant ajouté à chaque fois (un clic = plusieurs enregistrements).
let ecouteChoixBookPose = false;

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
    let nbOk = 0;
    for (let i = 0; i < aEnvoyer.length; i++) {
      if (aEnvoyer.length > 1) toast('Envoi de la photo '+(i+1)+' sur '+aEnvoyer.length+'…');
      const item = await Store.uploadPhoto(aEnvoyer[i]);
      if (item) { s.photos.book.push(item); nbOk++; }
    }
    if (aEnvoyer.length > 1) toast(nbOk === aEnvoyer.length ? 'Les '+nbOk+' photos ont bien été ajoutées.' : nbOk+' photo(s) ajoutée(s) sur '+aEnvoyer.length+'.', nbOk !== aEnvoyer.length);
    else if (nbOk === 1) toast('Photo ajoutée.');
    fBook.value=''; render(); reopenDashboardBlock('photos');
  });
  document.querySelectorAll('[data-rmbook]').forEach(function(b){ b.addEventListener('click', async function(e){
    e.stopPropagation();
    const id = b.dataset.rmbook; const photo = s.photos.book.find(function(ph){ return String(ph.id)===String(id); });
    if (!photo) return;
    const ok = await Store.removePhoto(id, photo.path);
    if (ok) {
      s.photos.book = s.photos.book.filter(function(ph){ return String(ph.id)!==String(id); });
      if (s.photos.principale && String(s.photos.principale.id)===String(id)) s.photos.principale=null;
      if (s.photos.photoCv && String(s.photos.photoCv.id)===String(id)) s.photos.photoCv=null;
      if (s.photos.pleinPied && String(s.photos.pleinPied.id)===String(id)) s.photos.pleinPied=null;
      if (s.photos.couverture && String(s.photos.couverture.id)===String(id)) s.photos.couverture=null;
      render(); reopenDashboardBlock('photos');
    }
  }); });

  // Sélection directe depuis le Book : chaque photo affiche son propre
  // bouton "+ Compcard" — pas besoin de passer par le sélecteur de chaque
  // case une par une. Se place automatiquement dans le premier emplacement
  // libre (1 à 5) ; un second clic la retire (le badge "COMPCARD n" indique
  // sa place actuelle).
  document.querySelectorAll('[data-book-cc-toggle]').forEach(function(btn){ btn.addEventListener('click', async function(e){
    e.stopPropagation();
    const id = btn.dataset.bookCcToggle;
    const photo = s.photos.book.find(function(ph){ return String(ph.id)===String(id); });
    if (!photo) return;
    if (photo.compcardOrdre) {
      const ok = await Store.setCompcardOrdre(photo.id, null);
      if (ok) { retirerDeCompcardLocal(photo); render(); reopenDashboardBlock('photos'); toast('Retirée de la compcard'); }
      return;
    }
    const occupes = s.photos.book.map(function(ph){ return ph.compcardOrdre; }).filter(Boolean);
    let slotLibre = null;
    for (let n=1; n<=5; n++){ if (occupes.indexOf(n)===-1) { slotLibre = n; break; } }
    if (!slotLibre) { toast('Compcard déjà complète (5/5) — retirez-en une avant d’en ajouter une autre', true); return; }
    if (await assignerCompcardSlot(photo, slotLibre)) { render(); reopenDashboardBlock('photos'); }
  }); });

  function ouvrirChoixBook(onChoisir){
    const modal = document.getElementById('ccBookModal'); if (!modal) return;
    const grid = modal.querySelector('[data-cc-book-grid]');
    grid.innerHTML = s.photos.book.length ? s.photos.book.map(function(ph){
      return '<button type="button" class="cc-book-choice" data-choix-id="'+ph.id+'"><img src="'+ph.url+'" alt="Photo du Book"><span>Choisir</span></button>';
    }).join('') : '<div class="cc-book-empty">Ajoutez d’abord des photos à votre Book.</div>';
    modal.classList.add('open');
    modal.dataset.onChoisir = '';
    modal._onChoisir = onChoisir;
  }
  function fermerChoixBook(){ const m=document.getElementById('ccBookModal'); if (m) m.classList.remove('open'); }

  // Un seul point de vérité par rôle/emplacement, appelé aussi bien quand la
  // photo vient d'être choisie dans le Book que quand elle vient d'être
  // téléversée directement (cahier des charges, règle 13-A : les deux chemins
  // doivent aboutir au même résultat, sans jamais dupliquer la photo).
  async function assignerPhotoCv(photo){ const ok = await Store.setRolePhoto('photo_cv', photo.id); if (ok) { s.photos.photoCv=photo; toast('Photo CV définie'); } return ok; }
  async function assignerPrincipale(photo){ const ok = await Store.setRolePhoto('principale', photo.id); if (ok) { s.photos.principale=photo; toast('Photo de profil définie'); } return ok; }
  async function assignerPleinPied(photo){ const ok = await Store.setRolePhoto('photo_pleinpied', photo.id); if (ok) { s.photos.pleinPied=photo; toast('Photo plein pied définie'); } return ok; }
  async function assignerCouverture(photo){ const ok = await Store.setRolePhoto('photo_couverture', photo.id); if (ok) { s.photos.couverture=photo; toast('Photo de couverture définie'); } return ok; }
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

  document.getElementById('uPhotoCv')?.addEventListener('click', function(){
    ouvrirChoixBook(async function(photo){ if (await assignerPhotoCv(photo)) { render(); reopenDashboardBlock('photos'); } });
  });
  document.getElementById('uPrincipale')?.addEventListener('click', function(){
    ouvrirChoixBook(async function(photo){ if (await assignerPrincipale(photo)) { render(); reopenDashboardBlock('photos'); } });
  });
  document.getElementById('uPleinPied')?.addEventListener('click', function(){
    ouvrirChoixBook(async function(photo){ if (await assignerPleinPied(photo)) { render(); reopenDashboardBlock('photos'); } });
  });
  document.getElementById('uCouverture')?.addEventListener('click', function(){
    ouvrirChoixBook(async function(photo){ if (await assignerCouverture(photo)) { render(); reopenDashboardBlock('photos'); } });
  });
  document.querySelectorAll('[data-couv-pos]').forEach(function(btn){ btn.addEventListener('click', async function(e){
    e.stopPropagation();
    if (!s.photos.couverture) return;
    const pos = btn.dataset.couvPos;
    const ok = await Store.setCouverturePosition(s.photos.couverture.id, pos);
    if (ok) { s.photos.couverture.couverturePosition = pos; render(); reopenDashboardBlock('photos'); }
  }); });
  (function appliquerCadrageCouverturePreview(){
    const img = document.querySelector('[data-couv-preview]');
    if (!img || !s.photos.couverture) return;
    const pos = s.photos.couverture.couverturePosition || 'center';
    img.style.objectPosition = pos==='top' ? '50% 0%' : pos==='bottom' ? '50% 100%' : '50% 50%';
  })();
  document.querySelectorAll('[data-cc-book]').forEach(function(btn){ btn.addEventListener('click', function(e){
    e.stopPropagation();
    const slot = parseInt(btn.dataset.ccBook,10);
    ouvrirChoixBook(async function(photo){ if (await assignerCompcardSlot(photo, slot)) { render(); reopenDashboardBlock('photos'); } });
  }); });
  document.querySelectorAll('[data-clear-cc-slot]').forEach(function(btn){ btn.addEventListener('click', async function(e){
    e.stopPropagation();
    const slot = parseInt(btn.dataset.clearCcSlot,10);
    const photo = s.photos.book.find(function(ph){ return ph.compcardOrdre===slot; });
    if (!photo) return;
    const ok = await Store.setCompcardOrdre(photo.id, null);
    if (ok) { retirerDeCompcardLocal(photo); render(); reopenDashboardBlock('photos'); toast('Emplacement '+slot+' libéré — la photo reste dans le Book'); }
  }); });

  // Téléversement direct par rôle : la photo est ajoutée au Book (comme toute
  // autre photo, jamais de bibliothèque parallèle) ET reçoit son rôle en un
  // seul geste, sans avoir à repasser ensuite par "Choisir dans mon Book".
  document.querySelectorAll('[data-cc-upload-label]').forEach(function(label){
    label.addEventListener('click', function(e){ e.stopPropagation(); });
    const input = label.querySelector('input[type=file]');
    if (!input) return;
    const cle = label.dataset.ccUploadLabel;
    input.addEventListener('change', async function(){
      const file = input.files && input.files[0];
      if (!file) return;
      if (s.photos.book.length >= LIMITE_PHOTOS_BOOK) {
        input.value = '';
        toast('Limite de '+LIMITE_PHOTOS_BOOK+' photos atteinte pour ce book. Supprimez une photo avant d’en ajouter une nouvelle.', true);
        return;
      }
      toast('Envoi de la photo…');
      const item = await Store.uploadPhoto(file);
      input.value = '';
      if (!item) return;
      s.photos.book.push(item);
      if (cle==='photoCv') await assignerPhotoCv(item);
      else if (cle==='principale') await assignerPrincipale(item);
      else if (cle==='pleinPied') await assignerPleinPied(item);
      else if (cle==='couverture') await assignerCouverture(item);
      else await assignerCompcardSlot(item, parseInt(cle,10));
      render(); reopenDashboardBlock('photos');
    });
  });

  if (ecouteChoixBookPose) return;
  ecouteChoixBookPose = true;
  document.addEventListener('click', function(e){
    if (e.target.closest('[data-cc-book-close]') || e.target.id==='ccBookModal') fermerChoixBook();
    const choix = e.target.closest('[data-choix-id]');
    if (choix) {
      const modal = document.getElementById('ccBookModal');
      const photo = state.photos.book.find(function(ph){ return String(ph.id)===String(choix.dataset.choixId); });
      const surChoix = modal && modal._onChoisir;
      if (modal) modal._onChoisir = null;
      if (photo && surChoix) { surChoix(photo); }
      fermerChoixBook();
    }
  });
}

/* --------------------------------------------------- COMPÉTENCES : handlers
   Auto-enregistrées au relâchement du curseur (pas à chaque pixel glissé) —
   même colonne jsonb "competences" que l'ancien système, déjà en production. */
function bindCompetencesHandlers(){
  document.querySelectorAll('input[data-competence]').forEach(function(el){
    el.addEventListener('change', function(){
      state.competences[el.dataset.competence] = parseInt(el.value, 10);
      Store.saveBlock({ competences: state.competences });
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

/* -------------------------------------------------------- CONFIRMATION */
function viewConfirmation(){
  return header() + '<div class="panel confirm"><div class="check">✓</div>' +
    '<h2>Profil bien enregistré</h2>' +
    '<p>Votre profil a bien été enregistré et transmis à Maître Akessé Model Management. Votre dossier est actuellement en attente de validation par l’administrateur.</p>' +
    '<div class="status-pill"><span class="dot"></span> En attente de validation</div></div>';
}

/* ------------------------------------------------------------ TABLEAU DE BORD */
const BLOCKS = [
  {k:'identite', ic:'👤', title:'Identité', desc:'Nom, contact, sexe, naissance'},
  {k:'physique', ic:'📏', title:'Physique', desc:'Mensurations'},
  {k:'formation', ic:'🎓', title:'Formation', desc:'Études et formation mannequin'},
  {k:'experiences', ic:'👠', title:'Expérience', desc:'Défilés, campagnes, shootings…'},
  {k:'photos', ic:'📸', title:'Photos', desc:'Principales, book, compcard'},
];

// Bouton "Enregistrer" (rouge → vert une fois enregistré) + bouton "Retour au
// tableau de bord" sous chaque bloc, sans exception — y compris Photos et
// Expérience, où chaque action se sauvegarde déjà individuellement : le clic
// y confirme simplement visuellement (même code couleur) plutôt que de forcer
// à remonter en haut de page pour retrouver le bouton retour.
function editorAction(label){
  return '<div class="editor-page-actions"><button type="button" class="btn ghost ret" data-editor-retour="1">← Retour au tableau de bord</button><button class="btn editor-save" data-editor-save="1">'+label+'</button></div>';
}

function editorPageBody(k){
  if (k==='identite') return stepIdentite().replace('<p class="sub">Étape 1 sur 6</p>','<p class="sub">Modifiez ici tous les éléments de votre identité.</p>').replace('<div class="actions-row end"><button class="btn primary" id="save1">Enregistrer</button></div>', editorAction('Enregistrer'));
  if (k==='physique') return stepPhysique().replace('<p class="sub">Étape 2 sur 6</p>','<p class="sub">Modifiez ici toutes vos mensurations.</p>').replace('<div class="actions-row"><button class="btn ghost" data-goto="1">← Retour</button><button class="btn primary" id="save2">Enregistrer</button></div>', editorAction('Enregistrer'));
  if (k==='formation') return stepFormation().replace('<p class="sub">Étape 3 sur 6</p>','<p class="sub">Modifiez ici votre formation et votre parcours mannequin.</p>').replace('<div class="actions-row"><button class="btn ghost" data-goto="2">← Retour</button><button class="btn primary" id="save3">Enregistrer</button></div>', editorAction('Enregistrer'));
  if (k==='experiences') return stepExperience().replace('<p class="sub">Étape 4 sur 6</p>','<p class="sub">Modifiez ici votre profil professionnel et vos expériences — chaque ligne est enregistrée séparément.</p>').replace('<div class="actions-row"><button class="btn ghost" data-goto="3">← Retour</button><button class="btn primary" id="save4">Continuer</button></div>', editorAction('Enregistrer'));
  if (k==='photos') return stepPhotos().replace('<div class="actions-row"><button class="btn ghost" data-goto="4">← Retour</button><button class="btn primary" id="save5">Continuer</button></div>', editorAction('Enregistrer'));
  return '';
}

/* Messages personnalisés des blocs : la mannequin doit se sentir chez elle
   dans son propre espace, pas devant un formulaire générique — chaque
   message emploie directement son prénom (déduit de state.identite.nomComplet,
   avec repli sur le titre générique tant qu'elle ne l'a pas encore renseigné). */
function messageBlocPersonnalise(k, prenom){
  const messages = {
    identite: prenom+', vérifiez que vos informations d’identité sont exactes — c’est ce que les recruteurs verront en premier.',
    physique: prenom+', gardez vos mensurations à jour pour recevoir des propositions qui vous correspondent vraiment.',
    formation: prenom+', votre formation valorise votre profil — complétez-la avec soin.',
    experiences: prenom+', chaque expérience ajoutée renforce votre parcours professionnel.',
    photos: prenom+', vos photos sont votre vitrine — choisissez celles qui vous représentent le mieux.'
  };
  return messages[k] || (prenom+', ce bloc s’enregistre indépendamment des autres.');
}
function viewBlockEditor(k){
  const titles = {identite:'Identité', physique:'Physique', formation:'Formation', experiences:'Expérience professionnelle', photos:'Photos & compcard'};
  const prenom = prenomDe(state.identite.nomComplet);
  const sousTitre = prenom ? messageBlocPersonnalise(k, prenom) : 'Ce bloc s’enregistre indépendamment des autres.';
  return header('Modification du profil') +
    '<div class="block-editor-page"><div class="block-editor-top"><div><span class="editor-kicker">VOTRE ESPACE</span><h1>'+echapperHtml(prenom ? (prenom+' · '+(titles[k]||'')) : (titles[k]||'Modification'))+'</h1><p>'+echapperHtml(sousTitre)+'</p></div>' +
    '<button type="button" class="btn ghost small p20-19" id="fermerEditeurBloc">← Retour au tableau de bord</button></div>' +
    '<div class="panel block-editor-panel">'+editorPageBody(k)+'</div></div>';
}

function bindBlockPage(k){
  const s = state;
  document.getElementById('fermerEditeurBloc')?.addEventListener('click', function(){ state.meta.editBlock=null; render(); });
  document.querySelector('[data-editor-retour="1"]')?.addEventListener('click', function(){ state.meta.editBlock=null; render(); });
  bindExperienceHandlers();
  bindProfilProHandlers();
  bindPhotoHandlers();
  bindCompetencesHandlers();
  initSelectsAvecAutre();
  brancherTaillesCalculees();
  bindStepIdentite();

  const btn = document.querySelector('[data-editor-save="1"]');
  if (!btn) return;

  // Photos et Expérience s'enregistrent déjà individuellement à chaque action
  // (upload, sélection, ligne ajoutée…) : le bouton confirme simplement en
  // vert, sans nouvel appel réseau ni notion de "payload" en attente.
  if (k==='photos' || k==='experiences') {
    btn.addEventListener('click', function(){
      btn.textContent='✓ Enregistré'; btn.classList.add('saved');
      setTimeout(function(){ btn.textContent='Enregistrer'; btn.classList.remove('saved'); }, 1800);
    });
    return;
  }

  btn.addEventListener('click', async function(){
    btn.disabled = true; btn.textContent = 'Enregistrement…';
    let ok = false, payload = {};
    if (k==='identite') {
      const identiteFormulaire = lireIdentiteFormulaire();
      identiteFormulaire.sexe = identiteFormulaire.sexe || s.identite.sexe;
      Object.assign(s.identite, identiteFormulaire);
      s.bio = val('f-bio'); s.instagram = val('f-instagram'); s.citation = val('f-citation');
      payload = Object.assign(identiteToDb(s.identite), { bio: s.bio||null, instagram: s.instagram||null, citation: s.citation||null });
    } else if (k==='physique') {
      Object.assign(s.physique, lirePhysiqueFormulaire());
      payload = physiqueToDb(s.physique);
    } else if (k==='formation') {
      s.formation.niveau=val('f-niveau'); s.formation.etablissement=val('f-etab'); s.formation.particuliere=val('f-formPart'); s.formation.mannequin=val('f-formMannequin');
      payload = formationToDb(s.formation);
    }
    ok = await Store.saveBlock(payload);
    if (ok && k==='physique') ok = await enregistrerMesuresSupp(s.physique) && await enregistrerFicheEvenementDepuisFormulaire();
    if (ok) { btn.textContent='✓ Enregistré'; btn.classList.add('saved'); setTimeout(function(){ toast('Bloc « '+k+' » enregistré'); }, 400); }
    else { btn.disabled=false; btn.textContent='Enregistrer'; }
  });
}

function reopenDashboardBlock(k){ setTimeout(function(){ const btn=document.querySelector('[data-edit="'+k+'"]'); if (btn) btn.click(); }, 0); }

function viewDashboard(){
  const d = state.identite;
  let bandeau = '';
  if (state.meta.statutAffichage === 'en_attente') bandeau = '<div class="online-banner p20-7"><span class="dot p20-4"></span> Modifications en cours de revalidation par l’agence</div>';
  else if (state.meta.statutAffichage === 'refuse') bandeau = '<div class="online-banner p20-5"><span class="dot p20-2"></span> Correction demandée'+(state.meta.commentaireAdmin?' — « '+echapperHtml(state.meta.commentaireAdmin)+' »':'')+'</div>';
  else bandeau = '<div class="online-banner"><span class="dot p20-3"></span> Profil en ligne — visible sur le site</div>';

  // Rappel (non bloquant) des blocs encore incomplets — le profil reste en
  // ligne tel quel, mais un book/fiche plus complet est plus attrayant pour
  // les recruteurs. Demande explicite de la propriétaire, 28 septembre 2026.
  const blocsIncomplets = BLOCKS.filter(function(b, i){ return !stepComplete(i + 1); });
  let alerteIncomplet = '';
  if (blocsIncomplets.length) {
    alerteIncomplet = '<div class="alerte-incomplet">⚠ <strong>Votre profil n’est pas complet.</strong> Un profil complet est bien plus attrayant pour les recruteurs — complétez : ' +
      blocsIncomplets.map(function(b){ return '<button type="button" class="alerte-lien" data-alerte-goto="'+b.k+'">'+b.title+'</button>'; }).join(', ') +
      '.</div>';
  }

  return header('Espace validé') + '<div class="panel">' + bandeau + alerteIncomplet +
    '<h1 class="p20-10">Bonjour '+echapperHtml((d.nomComplet||'').split(' ')[0]||'')+'</h1>' +
    '<p class="sub p20-13">Modifiez un bloc à la fois — chaque bloc s’enregistre indépendamment des autres.</p>' +
    '<div class="blocks-grid">' + BLOCKS.map(function(b){
      return '<div class="block-card" data-block="'+b.k+'"><span class="ic">'+b.ic+'</span><h3>'+b.title+'</h3><p>'+b.desc+'</p><button class="btn ghost small block-btn" data-edit="'+b.k+'">Modifier</button></div>';
    }).join('') + '</div>' +
    '<div class="cv-cta"><div class="txt"><h3>CV mannequin — privé</h3><p>Généré à partir de votre profil. Visible uniquement par vous et l’administrateur MA2M.</p></div>' +
    '<button class="btn primary" id="openCv">Voir mon CV</button></div>' +
    '<div class="cv-cta p20-15"><div class="txt"><h3>Compcard</h3><p>Fiche publique à partir des 5 photos sélectionnées.</p></div>' +
    '<button class="btn ghost" id="openCc">Voir la compcard</button></div>' +
    '<p class="lock-note">La case « rendre visible » et le bouton « soumettre » n’existent plus après la première publication.<br>Vous ne pouvez ni dépublier votre profil vous-même, ni accéder au dossier d’un autre mannequin.</p></div>';
}

function bindDashboard(){
  document.querySelectorAll('[data-edit]').forEach(function(btn){
    btn.addEventListener('click', function(){ state.meta.editBlock = btn.dataset.edit; render(); window.scrollTo({top:0,behavior:'smooth'}); });
  });
  document.querySelectorAll('[data-alerte-goto]').forEach(function(btn){
    btn.addEventListener('click', function(){ state.meta.editBlock = btn.dataset.alerteGoto; render(); window.scrollTo({top:0,behavior:'smooth'}); });
  });
  document.getElementById('openCv')?.addEventListener('click', openCv);
  document.getElementById('openCc')?.addEventListener('click', openCompcard);
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
    niveauMannequin: niveauControle(state.profilPro.niveauMannequin, state.experiences, state.profilPro.anneesExperience),
    mannequinId: currentUser.id,
    photoCvUrl: state.photos.photoCv && state.photos.photoCv.urlPleine || '',
    compcardPhotos: [1,2,3,4,5].map(function(n){
      const ph = state.photos.book.find(function(x){ return x.compcardOrdre===n; });
      return ph ? (ph.urlPleine||ph.url) : null;
    }),
    photosBook: (state.photos.principale ? [state.photos.principale] : []).concat(state.photos.book).map(function(ph){ return ph.urlPleine||ph.url; }),
    physique: p, formation: f, competences: state.competences, experiences: state.experiences, sexe: d.sexe
  };
}

function openCv(){
  const donneesCv = donneesCvDepuisEtat();
  document.getElementById('overlayContent').innerHTML =
    '<div class="overlay-close"><button id="closeOv">✕</button></div>' +
    '<div class="cv-sheet">' +
    '<div id="cv-mannequin-contenu">' + construireHtmlCv(donneesCv) + '</div>' +
    '<div class="cv-actions"><button class="btn ghost small" id="closeOv2">Fermer</button><button class="btn ghost small" id="btnCvJpeg">🖼️ Télécharger en JPEG</button><button class="btn primary small" id="btnCvPdf">🖨️ Télécharger en PDF</button></div>' +
    '</div>';
  showOverlay();
  document.getElementById('btnCvPdf').addEventListener('click', function(){ genererCvFichier('pdf', donneesCv, 'btnCvPdf', 'btnCvJpeg'); });
  document.getElementById('btnCvJpeg').addEventListener('click', function(){ genererCvFichier('jpeg', donneesCv, 'btnCvPdf', 'btnCvJpeg'); });
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
      niveau_mannequin: niveauControle(state.profilPro.niveauMannequin, state.experiences, state.profilPro.anneesExperience),
      height_cm: p.taille, weight_kg: p.poids, chest_cm: p.poitrine, waist_cm: p.tourTaille,
      hips_cm: p.hanches, inseam_cm: p.entrejambe, shoe_size: p.pointure,
      carnation: p.carnation, clothing_size: p.tailleVet, eye_color: p.yeux, hair_color: p.cheveux
    },
    photos: state.photos.book.map(function(ph){ return { url: ph.urlPleine||ph.url, compcard_ordre: ph.compcardOrdre }; }),
    projets: state.experiences || []
  };
}

function openCompcard(){
  const compcardPhotos = state.photos.book.filter(function(ph){ return ph.compcardOrdre; }).sort(function(a,b){ return a.compcardOrdre-b.compcardOrdre; });
  const slotsChoisis = [1,2,3,4,5].map(function(n){ return compcardPhotos.find(function(ph){ return ph.compcardOrdre===n; }) || null; });
  // Cases vides complétées automatiquement avec les autres photos du Book (même règle
  // que le fichier PDF/JPEG, voir completerEmplacementsPhotos dans js/app.js).
  const urlsSlots = completerEmplacementsPhotos(slotsChoisis.map(function(ph){ return ph ? (ph.urlPleine||ph.url) : null; }), state.photos.book.map(function(ph){ return ph.urlPleine||ph.url; }), 5);
  const slots = urlsSlots.map(function(u){ return u ? { urlPleine: u } : null; });
  const cover = slots[0];
  const sidePhotos = slots.slice(1).map(function(ph){ return ph ? '<img src="'+(ph.urlPleine||ph.url)+'" alt="Photo compcard">' : '<div class="cc-empty-photo"></div>'; }).join('');
  const d = state.identite, p = state.physique;
  // mesures incohérentes : non affichées, comme sur la compcard téléchargée (js/tailles.js)
  const masquer = typeof ma2mMesuresAReprendre === 'function' && ma2mMesuresAReprendre({ category: d.sexe, chest_cm: p.poitrine, waist_cm: p.tourTaille, hips_cm: p.hanches });
  document.getElementById('overlayContent').innerHTML =
    '<div class="overlay-close"><button id="closeOv">✕</button></div>' +
    '<div class="compcard-model">' +
      '<div class="ccm-header"><img class="ccm-logo" src="assets/logo-header.png" alt="Maître Akesse Model Management"><div class="ccm-title">COMPCARD</div></div>' +
      '<div class="ccm-photo-grid"><div class="ccm-cover">'+(cover?'<img src="'+(cover.urlPleine||cover.url)+'" alt="Photo plein pied compcard">':'<div class="cc-empty-photo">PHOTO PLEIN PIED</div>')+'</div><div class="ccm-side-grid">'+sidePhotos+'</div></div>' +
      '<div class="ccm-body"><h1>'+echapperHtml(d.nomComplet||'')+'</h1><div class="ccm-meta">'+echapperHtml(libelleNiveauPublic(niveauControle(state.profilPro.niveauMannequin, state.experiences, state.profilPro.anneesExperience)))+'  ·  '+echapperHtml(d.ville||'Abidjan')+'</div>' +
      '<div class="ccm-measures">' +
        '<div><span>TAILLE</span><b>'+(p.taille||'—')+' cm</b></div><div><span>POIDS</span><b>'+(p.poids||'—')+' kg</b></div><div><span>POITRINE</span><b>'+(masquer?'—':(p.poitrine||'—')+' cm')+'</b></div>' +
        '<div><span>TOUR DE TAILLE</span><b>'+(masquer?'—':(p.tourTaille||'—')+' cm')+'</b></div><div><span>BASSIN</span><b>'+(masquer?'—':(p.hanches||p.entrejambe||'—')+' cm')+'</b></div><div><span>POINTURE</span><b>'+(p.pointure||'—')+'</b></div>' +
        '<div><span>CARNATION</span><b>'+echapperHtml(p.carnation||'—')+'</b></div><div><span>TAILLE VÊTEMENTS</span><b>'+echapperHtml(p.tailleVet||'—')+'</b></div><div><span>YEUX</span><b>'+echapperHtml(p.yeux||'—')+'</b></div><div><span>CHEVEUX</span><b>'+echapperHtml(p.cheveux||'—')+'</b></div>' +
      '</div></div>' +
      '<div class="ccm-footer"><b>CONTACT OFFICIEL MA2M</b><div>'+MA2M_TELEPHONES.join(' · ')+'</div><div>'+MA2M_EMAIL+'</div><div>Instagram · Facebook · TikTok · YouTube  @maitreakessemodelmanagement</div><small>Document officiel généré depuis maitreakessemodelmanagement.com — toute demande de booking passe exclusivement par l’agence.</small></div>' +
    '</div>' +
    '<div class="cv-actions"><button class="btn ghost small" id="closeOv2">Fermer</button><button class="btn ghost small" id="p20BtnJpeg">Télécharger en JPEG</button><button class="btn primary small" id="p20BtnPdf">Télécharger en PDF</button></div>';
  showOverlay();
  document.getElementById('p20BtnPdf').addEventListener('click', function(){ genererFiche('pdf', ficheDataDepuisEtat(), 'p20BtnPdf', 'p20BtnJpeg'); });
  document.getElementById('p20BtnJpeg').addEventListener('click', function(){ genererFiche('jpeg', ficheDataDepuisEtat(), 'p20BtnPdf', 'p20BtnJpeg'); });
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
  currentUser = user;
  await Store.ensureProfileRow();
  state = await Store.load();
  if (!state.meta.currentStep) state.meta.currentStep = 1;
  render();
}

(async function init(){
  if (!sb) {
    document.getElementById('app').innerHTML = '<div class="auth-loading"><span>Connexion au service indisponible pour le moment — réessayez dans quelques instants.</span></div>';
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

