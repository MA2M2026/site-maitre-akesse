// Programme principal du tableau de bord (11/10/2026 : sorti de tableau-de-bord.html, où il était
// écrit directement dans la page ; le navigateur lisait parfois ses modèles d'images comme de
// vraies images et demandait une adresse « ${...} » introuvable). Chargé au même endroit.
// « void appel() » : chargement lancé sans attendre la fin (volontaire) ; une panne éventuelle
// est quand même relevée par js/surveillance.js (« unhandledrejection ») et écrite au journal.
// La connexion (mot de passe, code de validation, déconnexion…) est dans
// js/connexion-tableau.js, chargé juste avant (13/10/2026).
document.getElementById('tb-logout-btn').addEventListener('click', () => deconnecterTableauDeBord());

async function chargerStatutCodeValidation() {
  const badge = document.getElementById('code-validation-statut-badge');
  const emailInput = document.getElementById('cv-email-recuperation');
  if (!sb) return;
  const { data, error } = await obtenirStatutCodeValidationAvecRetry();
  if (error) return;
  const ligne = Array.isArray(data) ? data[0] : data;
  if (badge) badge.textContent = ligne && ligne.defini ? 'Actif' : 'Non défini';
  if (emailInput && ligne && ligne.email_recuperation && !emailInput.value) emailInput.value = ligne.email_recuperation;
}

document.getElementById('cv-definir-btn').addEventListener('click', async () => {
  const code = document.getElementById('cv-nouveau-code').value.trim();
  const email = document.getElementById('cv-email-recuperation').value.trim();
  const msg = document.getElementById('cv-msg');
  if (code.length < 4) {
    msg.className = 'form-msg err'; msg.textContent = 'Le code doit contenir au moins 4 caractères.'; msg.style.display = 'block';
    return;
  }
  if (!email) {
    msg.className = 'form-msg err'; msg.textContent = "L'e-mail de récupération est obligatoire (il sert en cas d'oubli du code)."; msg.style.display = 'block';
    return;
  }
  const { error } = await sb.rpc('definir_code_validation', { p_code: code, p_email_recuperation: email });
  if (error) {
    msg.className = 'form-msg err'; msg.textContent = 'Erreur : ' + error.message; msg.style.display = 'block';
    return;
  }
  document.getElementById('cv-nouveau-code').value = '';
  marquerCodeValide();
  msg.className = 'form-msg ok';
  msg.textContent = 'Code de validation enregistré ! Notez-le immédiatement en lieu sûr — il vous sera demandé à chaque prochaine connexion et ne sera plus jamais affiché ici.';
  msg.style.display = 'block';
  void chargerStatutCodeValidation();
});

// ---------------------------------------------------------------------------
// Journal des erreurs, réorganisé le 29/09/2026 à la demande de la propriétaire :
// chaque problème dit clairement OÙ (page, élément, appareil), QUOI (en clair),
// sa GRAVITÉ et QUE FAIRE, rangé par famille (Affichage, Connexion, Photos, Code,
// Sécurité). Le bouton « Copier pour Claude » copie la fiche technique complète,
// à coller telle quelle dans la conversation pour un diagnostic rapide.
// Les messages d'origine (souvent en anglais) restent visibles dans « Détail ».
// ---------------------------------------------------------------------------
const FAMILLES_ERREURS = {
  affichage: '🖥️ Affichage',
  connexion: '📶 Connexion & lenteur',
  photos: '📸 Photos',
  code: '⚙️ Code du site',
  securite: '🔒 Sécurité'
};
const GRAVITES_ERREURS = {
  corriger: { libelle: '🔴 À corriger', ordre: 0 },
  surveiller: { libelle: '🟠 À surveiller', ordre: 1 },
  info: { libelle: '🟢 Pas d’action (connexion du visiteur)', ordre: 2 }
};

// [motif, famille, gravité, en clair, que faire]
const REGLES_ERREURS = [
  [/^\[Page plus large/, 'affichage', 'corriger', "une partie de la page dépasse de l'écran sur le côté : sur téléphone, la page peut se dézoomer ou glisser. L'élément en cause est indiqué.", 'Envoyez la fiche à Claude : l’élément indiqué est à corriger.'],
  [/^\[Page dézoomée/, 'affichage', 'corriger', "la page s'est affichée en petit (dézoomée) chez ce visiteur, car un élément est plus large que l'écran.", 'Envoyez la fiche à Claude.'],
  [/^\[Zoom automatique/, 'affichage', 'corriger', "l'écran a zoomé tout seul quand le visiteur a touché un champ de formulaire (texte trop petit pour l'iPhone). Le champ est indiqué.", 'Envoyez la fiche à Claude : le champ indiqué est à agrandir.'],
  [/^\[Zoom inattendu/, 'affichage', 'surveiller', "le zoom de l'écran a changé sans que le visiteur touche l'écran.", 'Si ça se répète, envoyez la fiche à Claude.'],
  [/^\[Affichage qui saute/, 'affichage', 'surveiller', "des blocs de la page ont bougé pendant que le visiteur la regardait (souvent une image ou un texte qui arrive en retard et pousse le reste).", 'Si ça se répète sur la même page, envoyez la fiche à Claude.'],
  [/^\[Page vide/, 'affichage', 'surveiller', "la page est restée presque vide chez ce visiteur : les informations ne sont pas arrivées (connexion coupée, ou panne).", 'Si plusieurs visiteurs sont touchés, envoyez la fiche à Claude.'],
  [/^\[Clics répétés/, 'code', 'surveiller', "un visiteur a cliqué plusieurs fois de suite sur le même bouton : il ne réagissait pas, ou trop lentement. Le bouton est indiqué.", 'Essayez ce bouton vous-même ; s’il ne réagit pas, envoyez la fiche à Claude.'],
  [/^\[Page figée/, 'connexion', 'surveiller', "la page n'a plus répondu pendant plusieurs secondes (téléphone ancien ou très chargé, ou calcul trop lourd).", 'Si ça se répète sur la même page, envoyez la fiche à Claude.'],
  [/^\[Page très lente/, 'connexion', 'info', "la page a mis très longtemps à s'afficher, le plus souvent à cause d'une connexion faible (4G, Instagram, Facebook…). Les fichiers les plus longs sont indiqués.", 'Rien à faire si ce sont des services extérieurs (Google, Sentry). Si c’est un fichier du site, envoyez la fiche à Claude.'],
  [/^\[Image non chargée/, 'photos', 'info', "une image n'a pas pu s'afficher chez ce visiteur, même après un second essai : connexion coupée, ou image supprimée depuis.", 'Ouvrez la page : si l’image s’affiche chez vous, rien à faire.'],
  [/^\[Envoi de photo échoué/, 'photos', 'surveiller', "un mannequin n'a pas réussi à envoyer une photo dans son espace. Son nom est indiqué : si c'est « connexion coupée », c'est son réseau.", 'Conseillez-lui de réessayer en Wi-Fi ou avec une meilleure connexion. Sinon, envoyez la fiche à Claude.'],
  [/^\[Envoi de photo très lent/, 'photos', 'info', "l'envoi d'une photo par ce mannequin a pris plus d'1 min 30 : connexion très lente, ou photo très lourde.", 'Conseillez-lui une meilleure connexion.'],
  [/^\[(Script|Style|Média) non chargé/, 'connexion', 'info', "un élément du site n'a pas pu être téléchargé (connexion faible ou coupée) : une partie de la page a pu mal fonctionner pour ce visiteur.", 'Rien à faire si c’est isolé.'],
  [/^\[Bibliothèque non chargée/, 'connexion', 'info', "un outil indispensable n'a pas pu se charger : la page n'a affiché aucune donnée (connexion probablement coupée).", 'Rien à faire si c’est isolé ; si plusieurs visiteurs sont touchés, envoyez la fiche à Claude.'],
  [/^\[Réseau injoignable/, 'connexion', 'info', "la connexion du visiteur a coupé pendant un échange avec le serveur.", 'Rien à faire.'],
  // journal du 12/10 : « status 0 » = la demande n'a jamais atteint le serveur (connexion coupée)
  [/"status": ?0\b/, 'connexion', 'info', "la connexion du visiteur a coupé pendant un envoi.", 'Rien à faire si c’est isolé.'],
  [/délai dépassé/i, 'connexion', 'surveiller', "le serveur a mis trop longtemps à répondre (connexion très lente du visiteur, ou serveur surchargé).", 'Si plusieurs visiteurs sont touchés le même jour, envoyez la fiche à Claude.'],
  [/Failed to fetch|NetworkError|Load failed|network error/i, 'connexion', 'info', "la connexion du visiteur a coupé pendant un échange avec le serveur.", 'Rien à faire.'],
  [/^\[Requête en échec\].*→ 400/, 'code', 'corriger', "la base de données a refusé une demande (information manquante ou mal formée).", 'Envoyez la fiche à Claude.'],
  [/^\[Requête en échec\].*→ 429/, 'connexion', 'surveiller', "trop de demandes en peu de temps : le serveur a demandé de patienter.", 'Si ça se répète, envoyez la fiche à Claude.'],
  [/^\[Requête en échec\].*→ 5\d\d/, 'connexion', 'surveiller', "le serveur a eu une panne passagère.", 'Si ça se répète, envoyez la fiche à Claude.'],
  [/^\[Requête en échec/, 'code', 'surveiller', "une demande au serveur a échoué.", 'Si ça se répète, envoyez la fiche à Claude.'],
  [/^\[Bloqué par la sécurité/, 'securite', 'corriger', "la protection du site a bloqué un élément (mise en forme ou script) non autorisé. Souvent sans effet visible, mais à corriger dans le code.", 'Envoyez la fiche à Claude.'],
  [/^\[Génération de fichier/, 'code', 'corriger', "le téléchargement d'un fichier (CV, compcard…) a échoué pour ce visiteur.", 'Envoyez la fiche à Claude.'],
  [/^\[(Erreur JavaScript|Erreur signalée par le code)/, 'code', 'corriger', "une erreur s'est produite dans le code de cette page.", 'Envoyez la fiche à Claude.']
];

function analyserErreur(message) {
  const m = String(message || '');
  const r = REGLES_ERREURS.find(regle => regle[0].test(m));
  if (!r) return { famille: 'code', gravite: 'surveiller', clair: '', action: 'Envoyez la fiche à Claude.' };
  return { famille: r[1], gravite: r[2], clair: r[3], action: r[4] };
}

// Gardée pour compatibilité (autres appels éventuels) : la ligne « en clair » seule.
function erreurEnClair(message) {
  return analyserErreur(message).clair;
}

// Nom lisible d'une page à partir de son adresse (« /mannequin.html?id=… » →
// « Fiche d'un mannequin »).
function nomPageLisible(page) {
  const chemin = String(page || '').split('?')[0].split('#')[0];
  const anglais = /^\/en\//.test(chemin);
  const nom = chemin.replace(/^\/en\//, '/').replace(/\.html$/, '').replace(/\/$/, '').replace(/^\//, '') || 'index';
  const noms = {
    'index': 'Accueil', 'mannequins': 'Liste des mannequins', 'mannequin': "Fiche d'un mannequin",
    'actualites': 'Actualités', 'evenements': 'Événements', 'partenaires': 'Partenaires', 'services': 'Services',
    'contact': 'Contact', 'candidature': 'Candidature casting', 'inscription-mannequin': 'Inscription mannequin',
    'espace-mannequin': "Espace mannequin de l'agence", 'selection': 'Sélection (recruteur)', 'tableau-de-bord': 'Tableau de bord (admin)',
    'reinitialiser-mot-de-passe': 'Mot de passe oublié', 'mentions-legales': 'Mentions légales',
    'politique-confidentialite': 'Politique de confidentialité'
  };
  return (noms[nom] || chemin || '?') + (anglais ? ' (version anglaise)' : '');
}

function cheminSansSuivi(page) {
  // Retire les paramètres de suivi (Instagram, Facebook…) pour regrouper les mêmes pages.
  const [chemin, requete] = String(page || '').split('?');
  if (!requete) return chemin;
  const gardes = requete.split('&').filter(p => /^id=/.test(p));
  return chemin + (gardes.length ? '?' + gardes.join('&') : '');
}

// Appareil lu dans l'identité du navigateur (pour les anciens signalements qui
// n'ont pas encore la ligne « Contexte »).
function appareilDepuisUA(ua) {
  ua = ua || '';
  const appareil = /iPad|Tablet|SM-T\d/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'tablette'
    : /Mobi|iPhone|Android/i.test(ua) ? 'téléphone' : 'ordinateur';
  const systeme = /iPhone|iPad|iPod/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : '';
  const nav = /FBAN|FBAV|FB_IAB/.test(ua) ? 'appli Facebook' : /Instagram/.test(ua) ? 'appli Instagram' : /TikTok|musical_ly/i.test(ua) ? 'appli TikTok'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /EdgA?\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /CriOS|Chrome\//.test(ua) ? 'Chrome'
    : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return [appareil, systeme, nav].filter(Boolean).join(' · ');
}

// Ligne « Appareil » : celle enregistrée par le site si elle existe, sinon (anciens
// signalements) l'appareil déduit du navigateur + l'ancienne ligne de connexion.
function appareilAffiche(g) {
  const c = g.lu.contexte;
  if (c && /^(téléphone|tablette|ordinateur)/.test(c)) return c;
  return [appareilDepuisUA(g.user_agent), c].filter(Boolean).join(' · ');
}

// Découpe la « pile » d'un signalement : ligne de contexte, dernier clic, détail.
function lirePileErreur(pile) {
  const res = { contexte: '', clic: '', detail: [] };
  String(pile || '').split('\n').forEach((ligne, i) => {
    if (/^Contexte : /.test(ligne)) res.contexte = ligne.replace(/^Contexte : /, '');
    else if (i === 0 && /^(depuis |· réseau|· connexion)/.test(ligne)) res.contexte = ligne.replace(/^· /, '');
    else if (/^Dernier clic : /.test(ligne)) res.clic = ligne.replace(/^Dernier clic : /, '');
    else if (ligne.trim()) res.detail.push(ligne);
  });
  res.detail = res.detail.join('\n');
  return res;
}

let groupesErreursAffiches = [];
let filtreFamilleErreurs = 'toutes';
let filtreGraviteErreurs = 'toutes';

function erreursVisibles() {
  return groupesErreursAffiches.filter(g =>
    (filtreFamilleErreurs === 'toutes' || g.analyse.famille === filtreFamilleErreurs) &&
    (filtreGraviteErreurs === 'toutes' || g.analyse.gravite === filtreGraviteErreurs));
}

// Nettoyage automatique des erreurs corrigées (liste dans js/erreurs-corrigees.js) :
// toute occurrence antérieure à la date de correction est effacée du journal.
// Une ligne du journal est-elle une erreur déjà corrigée ? (motif trouvé, survenue avant la
// correction, et — si la règle le précise — venant de ce navigateur seulement : « navigateur »)
function estErreurCorrigee(e, corrigees) {
  const texte = (e.message || '') + '\n' + (e.pile || '') + '\n' + (e.user_agent || '');
  return corrigees.some(c => c.motif && texte.indexOf(c.motif) !== -1 && new Date(e.created_at) < new Date(c.corrige_le)
    && (!c.navigateur || (e.user_agent || '').indexOf(c.navigateur) !== -1));
}
async function nettoyerErreursCorrigees(erreurs) {
  const corrigees = window.MA2M_ERREURS_CORRIGEES || [];
  if (!corrigees.length) return { restantes: erreurs, nb: 0 };
  const aEffacer = [];
  const restantes = erreurs.filter(e => {
    if (estErreurCorrigee(e, corrigees)) { aEffacer.push(e.id); return false; }
    return true;
  });
  for (let i = 0; i < aEffacer.length; i += 100) {
    await sb.from('journal_erreurs').delete().in('id', aEffacer.slice(i, i + 100));
  }
  return { restantes, nb: aEffacer.length };
}

function dateCourte(iso) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ficheTechniqueErreur(g, sansEntete) {
  const a = analyserErreur(g.message);
  return [
    sansEntete ? '' : '— Journal MA2M —',
    'Erreur : ' + g.message,
    'Famille / gravité : ' + FAMILLES_ERREURS[a.famille] + ' / ' + GRAVITES_ERREURS[a.gravite].libelle,
    'Page : ' + nomPageLisible(g.page) + (g.nomMannequin ? ' — ' + g.nomMannequin : '') + ' (' + Array.from(g.pages).slice(0, 3).join(' , ') + ')',
    'Nombre : ' + g.occurrences + ' fois, du ' + dateCourte(g.premiere) + ' au ' + dateCourte(g.created_at),
    'Contexte : ' + appareilAffiche(g),
    g.lu.clic ? 'Dernier clic : ' + g.lu.clic : '',
    'Navigateur : ' + (g.user_agent || '?'),
    g.lu.detail ? 'Détail :\n' + g.lu.detail : ''
  ].filter(Boolean).join('\n');
}

async function copierTexte(texte, bouton) {
  let ok = false;
  try { await navigator.clipboard.writeText(texte); ok = true; } catch (e) {
    try {
      const zone = document.createElement('textarea');
      zone.value = texte; zone.setAttribute('readonly', ''); zone.style.position = 'fixed'; zone.style.opacity = '0';
      document.body.appendChild(zone); zone.select(); ok = document.execCommand('copy'); zone.remove();
    } catch (x) {}
  }
  if (bouton) messageTemporaire(bouton, ok ? '✓ Copié — collez-le dans la conversation' : 'Copie impossible', 2500);
}
// Texte provisoire sur un bouton, puis retour à son libellé. Le libellé d'origine est gardé
// sur le bouton : deux appuis rapides ne laissent pas le message provisoire pour de bon.
function messageTemporaire(bouton, texte, duree) {
  if (!bouton.dataset.libelle) bouton.dataset.libelle = bouton.textContent;
  clearTimeout(bouton._minuteur);
  bouton.textContent = texte;
  bouton._minuteur = setTimeout(() => { bouton.textContent = bouton.dataset.libelle; delete bouton.dataset.libelle; }, duree);
}

function afficherErreurs() {
  const liste = document.getElementById('liste-erreurs');
  const visibles = erreursVisibles();
  const nbOcc = visibles.reduce((s, g) => s + g.occurrences, 0);
  // Deux boutons identiques (au-dessus et en dessous de la liste) : ils copient
  // d'un coup TOUTES les erreurs affichées, pour les envoyer à Claude.
  ['erreurs-copier-tout-btn', 'erreurs-copier-tout-bas-btn'].forEach(id => {
    const btn = document.getElementById(id);
    btn.hidden = !visibles.length;
    btn.textContent = visibles.length === 1
      ? '📋 Copier cette erreur pour Claude'
      : `📋 Copier les ${visibles.length} erreurs d’un coup pour Claude`;
    btn.title = nbOcc + ' signalement(s) au total';
    clearTimeout(btn._minuteur); delete btn.dataset.libelle; // nouveau libellé : pas de retour à l'ancien
  });
  const btnFichier = document.getElementById('erreurs-telecharger-btn');
  clearTimeout(btnFichier._minuteur); delete btnFichier.dataset.libelle;
  btnFichier.hidden = !visibles.length;
  btnFichier.textContent = `⬇️ Télécharger le fichier pour Claude (${visibles.length} erreur${visibles.length > 1 ? 's' : ''}, rien n’est coupé)`;
  document.querySelectorAll('#erreurs-resume [data-journal-gravite]').forEach(b => b.classList.toggle('actif', b.dataset.journalGravite === filtreGraviteErreurs));
  document.querySelectorAll('#erreurs-resume [data-journal-famille]').forEach(b => b.classList.toggle('actif', b.dataset.journalFamille === filtreFamilleErreurs));
  liste.innerHTML = visibles.map(g => {
    const a = g.analyse;
    const i = groupesErreursAffiches.indexOf(g);
    const titre = String(g.message || '').replace(/^\[[^\]]*\]\s*/, '');
    const type = (String(g.message || '').match(/^\[([^\]]*)\]/) || [])[1] || 'Erreur';
    const contexte = appareilAffiche(g);
    const autresPages = g.pages.size > 1 ? ` (+${g.pages.size - 1} autre${g.pages.size > 2 ? 's' : ''} adresse${g.pages.size > 2 ? 's' : ''})` : '';
    return `
    <div class="journal-carte journal-${a.gravite}">
      <div class="journal-tete">
        <span class="journal-badge">${GRAVITES_ERREURS[a.gravite].libelle}</span>
        <span class="journal-famille">${FAMILLES_ERREURS[a.famille]}</span>
        <span class="journal-nombre">${g.occurrences} fois</span>
      </div>
      <div class="journal-titre">${echapperHtml(type)}</div>
      <dl class="journal-infos">
        <dt>Où</dt><dd>${echapperHtml(nomPageLisible(g.page))}${g.nomMannequin ? ' — ' + echapperHtml(g.nomMannequin) : ''}${autresPages}<br><small>${echapperHtml(titre.slice(0, 200))}</small></dd>
        <dt>Appareil</dt><dd>${echapperHtml(contexte || '?')}</dd>
        ${g.lu.clic ? `<dt>Dernier clic</dt><dd>${echapperHtml(g.lu.clic)}</dd>` : ''}
        <dt>Quand</dt><dd>dernière fois le ${dateCourte(g.created_at)}${g.occurrences > 1 ? ` · première le ${dateCourte(g.premiere)}` : ''}</dd>
      </dl>
      ${a.clair ? `<p class="journal-clair"><strong>En clair :</strong> ${echapperHtml(a.clair)}</p>` : ''}
      <p class="journal-action"><strong>Que faire :</strong> ${echapperHtml(a.action)}</p>
      ${g.lu.detail ? `<details class="journal-detail"><summary>Détail technique</summary><pre>${echapperHtml(g.lu.detail.slice(0, 1200))}</pre></details>` : ''}
      <div class="journal-boutons">
        <button type="button" class="btn journal-btn" data-journal-copier="${i}">📋 Copier pour Claude</button>
        <button type="button" class="btn journal-btn" data-journal-effacer="${i}">✓ Réglé — effacer</button>
      </div>
    </div>`;
  }).join('') || '<div class="dossiers-vide">✅ Aucune erreur dans cette sélection.</div>';
}

async function chargerErreurs() {
  const liste = document.getElementById('liste-erreurs');
  const resume = document.getElementById('erreurs-resume');
  const compteurEl = document.getElementById('erreurs-compteur');
  const btnEffacer = document.getElementById('erreurs-tout-effacer-btn');
  const btnCopierTout = document.getElementById('erreurs-copier-tout-btn');
  const depuis7j = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let { data: erreurs } = await sb.from('journal_erreurs')
    .select('id, message, page, pile, user_agent, created_at')
    .gte('created_at', depuis7j)
    .order('created_at', { ascending: false })
    .limit(500);

  const nettoyage = document.getElementById('erreurs-nettoyage');
  const { restantes, nb: nbNettoyees } = await nettoyerErreursCorrigees(erreurs || []);
  nettoyage.hidden = !nbNettoyees;
  nettoyage.textContent = nbNettoyees ? `✅ ${nbNettoyees} signalement${nbNettoyees > 1 ? 's' : ''} d’erreurs déjà corrigées ${nbNettoyees > 1 ? 'ont été retirés' : 'a été retiré'} automatiquement.` : '';
  erreurs = restantes;

  if (!erreurs || !erreurs.length) {
    groupesErreursAffiches = [];
    compteurEl.textContent = '0 erreur';
    resume.innerHTML = '';
    liste.innerHTML = '<div class="dossiers-vide">✅ Aucune erreur détectée cette semaine.</div>';
    btnEffacer.style.display = 'none';
    btnCopierTout.hidden = true;
    document.getElementById('erreurs-copier-tout-bas-btn').hidden = true;
    document.getElementById('erreurs-telecharger-btn').hidden = true;
    return;
  }

  const groupes = {};
  erreurs.forEach(e => {
    const cle = (e.message || '') + '|' + cheminSansSuivi(e.page).split('?')[0];
    if (!groupes[cle]) groupes[cle] = { ...e, occurrences: 0, ids: [], pages: new Set(), premiere: e.created_at, lu: lirePileErreur(e.pile), analyse: analyserErreur(e.message) };
    const g = groupes[cle];
    g.occurrences++;
    g.ids.push(e.id);
    g.pages.add(cheminSansSuivi(e.page));
    g.premiere = e.created_at; // liste triée du plus récent au plus ancien
  });
  const groupesTries = Object.values(groupes).sort((a, b) =>
    GRAVITES_ERREURS[a.analyse.gravite].ordre - GRAVITES_ERREURS[b.analyse.gravite].ordre || b.occurrences - a.occurrences);

  // Nom du mannequin pour les fiches (« Fiche d'un mannequin — Awa Konaté »).
  const idsMannequins = [...new Set(groupesTries.map(g => (String(g.page || '').match(/[?&]id=([0-9a-f-]{36})/i) || [])[1]).filter(Boolean))];
  if (idsMannequins.length) {
    const { data: profils } = await sb.from('model_profiles').select('id, full_name').in('id', idsMannequins);
    const noms = {};
    (profils || []).forEach(p => { noms[p.id] = p.full_name; });
    groupesTries.forEach(g => {
      const id = (String(g.page || '').match(/[?&]id=([0-9a-f-]{36})/i) || [])[1];
      if (id && noms[id]) g.nomMannequin = noms[id];
    });
  }

  groupesErreursAffiches = groupesTries;
  compteurEl.textContent = `${erreurs.length} erreur${erreurs.length > 1 ? 's' : ''} (${groupesTries.length} distincte${groupesTries.length > 1 ? 's' : ''})`;
  btnEffacer.style.display = 'block';
  btnCopierTout.hidden = false;

  // Résumé : gravités + boutons de filtre par famille.
  const parGravite = { corriger: 0, surveiller: 0, info: 0 };
  const parFamille = {};
  groupesTries.forEach(g => {
    parGravite[g.analyse.gravite]++;
    parFamille[g.analyse.famille] = (parFamille[g.analyse.famille] || 0) + 1;
  });
  if (filtreFamilleErreurs !== 'toutes' && !parFamille[filtreFamilleErreurs]) filtreFamilleErreurs = 'toutes';
  if (filtreGraviteErreurs !== 'toutes' && !parGravite[filtreGraviteErreurs]) filtreGraviteErreurs = 'toutes';
  resume.innerHTML = `
    <div class="journal-resume-gravites">
      ${Object.keys(parGravite).map(k => `<button type="button" class="journal-resume-case journal-${k}" data-journal-gravite="${k}"${parGravite[k] ? '' : ' disabled'}><b>${parGravite[k]}</b> ${GRAVITES_ERREURS[k].libelle.replace(/^\S+\s/, '')}<small>${parGravite[k] ? 'Touchez pour voir la liste' : 'Rien ici'}</small></button>`).join('')}
    </div>
    <div class="journal-filtres">
      <button type="button" class="journal-filtre" data-journal-famille="toutes">Toutes les familles</button>
      ${Object.keys(FAMILLES_ERREURS).filter(f => parFamille[f]).map(f => `<button type="button" class="journal-filtre" data-journal-famille="${f}">${FAMILLES_ERREURS[f]} (${parFamille[f]})</button>`).join('')}
    </div>`;
  afficherErreurs();
}

document.getElementById('erreurs-resume').addEventListener('click', (e) => {
  const gravite = e.target.closest('[data-journal-gravite]');
  if (gravite) {
    // Toucher la case déjà choisie réaffiche toutes les erreurs.
    filtreGraviteErreurs = filtreGraviteErreurs === gravite.dataset.journalGravite ? 'toutes' : gravite.dataset.journalGravite;
    afficherErreurs();
    document.getElementById('erreurs-copier-tout-btn').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const bouton = e.target.closest('[data-journal-famille]');
  if (!bouton) return;
  filtreFamilleErreurs = bouton.dataset.journalFamille;
  afficherErreurs();
});

document.getElementById('liste-erreurs').addEventListener('click', async (e) => {
  const copier = e.target.closest('[data-journal-copier]');
  if (copier) {
    const g = groupesErreursAffiches[+copier.dataset.journalCopier];
    if (g) void copierTexte(ficheTechniqueErreur(g), copier);
    return;
  }
  const effacer = e.target.closest('[data-journal-effacer]');
  if (effacer) {
    const g = groupesErreursAffiches[+effacer.dataset.journalEffacer];
    if (!g || !confirm('Effacer cette erreur du journal ? (Elle réapparaîtra si le problème se reproduit.)')) return;
    effacer.disabled = true;
    await sb.from('journal_erreurs').delete().in('id', g.ids);
    void chargerErreurs();
  }
});

// Toutes les erreurs affichées, rangées par gravité (🔴, 🟠, 🟢), au format Markdown.
// Même texte pour « Copier pour Claude » et pour le fichier téléchargé : le fichier ne se
// coupe jamais, même avec 100 erreurs (journal du 14/10/2026 : la copie de 38 erreurs
// arrivait tronquée dans la conversation).
function journalPourClaude() {
  const visibles = erreursVisibles();
  const titre = filtreGraviteErreurs === 'toutes' ? 'toutes gravités' : GRAVITES_ERREURS[filtreGraviteErreurs].libelle;
  let n = 0;
  const parties = Object.keys(GRAVITES_ERREURS).map(k => {
    const groupe = visibles.filter(g => g.analyse.gravite === k);
    if (!groupe.length) return '';
    return `## ${GRAVITES_ERREURS[k].libelle} — ${groupe.length}\n\n` + groupe.map(g => {
      const fiche = ficheTechniqueErreur(g, true);
      // barrière plus longue que tout « ``` » présent dans l'erreur : son texte reste intact
      const barriere = '`'.repeat(Math.max(3, ...(fiche.match(/`+/g) || []).map(x => x.length + 1)));
      return `### #${++n}\n\n${barriere}\n${fiche}\n${barriere}`;
    }).join('\n\n');
  }).filter(Boolean);
  return { nb: visibles.length, texte: `# Journal MA2M — ${visibles.length} erreur(s) (${titre}${filtreFamilleErreurs === 'toutes' ? '' : ', ' + FAMILLES_ERREURS[filtreFamilleErreurs]}) — ${new Date().toLocaleString('fr-FR')}\n\n`
    + parties.join('\n\n') + '\n' };
}
function copierToutesLesErreurs(e) {
  void copierTexte(journalPourClaude().texte, e.currentTarget);
}
document.getElementById('erreurs-copier-tout-btn').addEventListener('click', copierToutesLesErreurs);
document.getElementById('erreurs-copier-tout-bas-btn').addEventListener('click', copierToutesLesErreurs);
document.getElementById('erreurs-telecharger-btn').addEventListener('click', (e) => {
  const { nb, texte } = journalPourClaude();
  telechargerFichier(new Blob([texte], { type: 'text/markdown;charset=utf-8' }), 'journal-ma2m' + horodatageFichier() + '.md');
  messageTemporaire(e.currentTarget, `✓ Fichier créé (${nb} erreur${nb > 1 ? 's' : ''}) : retrouvez-le dans vos Téléchargements, puis joignez-le à la conversation`, 5000);
});

document.getElementById('erreurs-tout-effacer-btn').addEventListener('click', async () => {
  if (!confirm("Marquer toutes les erreurs actuelles comme vues ? Elles seront supprimées du journal (de nouvelles erreurs réapparaîtront normalement si elles se reproduisent).")) return;
  const depuis7j = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from('journal_erreurs').delete().gte('created_at', depuis7j);
  void chargerErreurs();
});

async function chargerClassementMannequins() {
  const conteneur = document.getElementById('classement-mannequins');
  const depuis7j = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: classement, error } = await sb.rpc('stats_classement_mannequins', { depuis: depuis7j });

  if (error || !classement || !classement.length) {
    conteneur.innerHTML = '<p class="u-texte-doux">Pas encore assez de visites enregistrées sur les 7 derniers jours.</p>';
    return;
  }

  const top10 = classement.slice(0, 10);
  const ids = top10.map(c => c.model_id);
  const { data: profils } = await sb.from('model_profiles').select('id, full_name').in('id', ids);
  const nomParId = {};
  (profils || []).forEach(p => { nomParId[p.id] = p.full_name; });

  const maxVisites = top10[0].nb_visites || 1;

  conteneur.innerHTML = top10.map((c, i) => `
    <div class="tdb-cm-ligne">
      <span class="tdb-cm-rang">${i + 1}</span>
      <span class="tdb-cm-nom">${echapperHtml(nomParId[c.model_id] || 'Mannequin')}</span>
      <div class="tdb-cm-piste">
        <div class="tdb-barre-remplie" data-pct="${Math.max(4, (c.nb_visites / maxVisites) * 100)}"></div>
      </div>
      <span class="tdb-cm-visites">${c.nb_visites}</span>
    </div>
  `).join('');
  conteneur.querySelectorAll('.tdb-barre-remplie').forEach(el => { el.style.width = el.dataset.pct + '%'; });

  if (classement.length > 10) {
    conteneur.insertAdjacentHTML('beforeend', `<p class="tdb-46">+ ${classement.length - 10 > 1 ? (classement.length - 10) + ' autres mannequins' : '1 autre mannequin'} avec des visites enregistrées.</p>`);
  }
}

async function compter(table) {
  const { count } = await sb.from(table).select('id', { count: 'exact', head: true });
  return count || 0;
}

document.getElementById('nettoyer-photos-btn').addEventListener('click', async () => {
  const btn = document.getElementById('nettoyer-photos-btn');
  const msg = document.getElementById('nettoyer-photos-msg');
  btn.disabled = true;
  msg.className = 'form-msg ok';
  msg.textContent = 'Nettoyage en cours…';
  msg.style.display = 'block';

  const { data: nbSupprimees, error } = await sb.rpc('nettoyer_photos_traitees_anciennes');
  btn.disabled = false;

  if (error) {
    msg.className = 'form-msg err';
    msg.textContent = "Erreur : " + error.message;
    return;
  }
  msg.className = 'form-msg ok';
  msg.textContent = nbSupprimees > 0
    ? `${nbSupprimees} photo(s) retirée(s) du tableau de bord (dossiers traités depuis plus de 5 jours). Les fichiers restent dans Google Drive.`
    : "Rien à nettoyer pour le moment — aucun dossier traité depuis plus de 5 jours.";
});


// Rattrapage automatique des anciennes photos du Book (demande de la propriétaire,
// 06/10/2026 : plus de boutons à appuyer). Les nouvelles photos ont déjà, dès leur envoi,
// leur miniature nette (800 px) et leur version moyenne. Pour les photos plus anciennes,
// le tableau de bord fait le travail tout seul, en arrière-plan, quelques secondes après
// l'ouverture : il fabrique la miniature ou la version moyenne qui manque, à partir de
// la photo d'origine (jamais modifiée), puis met à jour la fiche de la photo. Une fois
// par ouverture ; si la page est fermée avant la fin, il reprend à la suivante. Après 5
// échecs (réseau faible), il s'arrête et réessaiera la prochaine fois.
// Une version (miniature ou moyenne) refaite à partir de l'original ; false si la copie
// WebP attendue n'a pas pu être envoyée.
async function refaireVersion(photo, original, maj, cle, dossier, fin, cote, qualite) {
  const v = await envoyerVersionPhoto(photo.model_id, original, dossier, fin, cote, qualite);
  if (!v) throw new Error('Image illisible');
  maj['url_' + cle] = v.url; maj['chemin_' + cle] = v.chemin;
  return !!cheminWebp(v.chemin);
}
async function rattraperPhotosEnArrierePlan() {
  try { if (sessionStorage.getItem('ma2m_rattrapage_photos')) return; sessionStorage.setItem('ma2m_rattrapage_photos', '1'); } catch (e) {}
  const { data: photos, error } = await sb.from('model_photos')
    .select('id, model_id, url, url_miniature, url_moyenne, chemin_miniature, chemin_moyenne');
  if (error || !photos) return;
  // Versions à (re)faire : absente, ancienne miniature (< 800 px), ou sans copie WebP légère
  // quand ce navigateur sait l'écrire (12/10/2026 ; voir envoyerVersionPhoto dans js/app.js).
  // Copies WebP : sur un ordinateur ou une tablette (écran de 700 px et plus ; 14/10/2026 : la
  // propriétaire travaille surtout sur tablette, les copies ne se faisaient donc jamais) hors
  // connexion mobile signalée — environ 370 photos d'origine à télécharger — et 40 photos au
  // plus par ouverture.
  // Une photo à la fois (pas en parallèle) pour ménager la connexion.
  const c = navigator.connection || {};
  const donneesMobiles = c.saveData || c.type === 'cellular' || /(^|-)(2g|3g)$/.test(c.effectiveType || '');
  let webp = navigateurEcritWebp() && !donneesMobiles && window.matchMedia('(min-width: 700px) and (min-height: 600px)').matches; // pas un téléphone tenu en largeur
  const miniatureAFaire = p => !p.url_miniature || !/-n800(-w)?\.jpg$/.test(p.chemin_miniature || '') || (webp && !cheminWebp(p.chemin_miniature));
  const moyenneAFaire = p => !p.url_moyenne || (webp && !cheminWebp(p.chemin_moyenne));
  const aFaire = photos.filter(p => p.url && (miniatureAFaire(p) || moyenneAFaire(p))).slice(0, 40);
  let echecs = 0, faites = 0;
  for (const photo of aFaire) {
    if (echecs >= 5) break;
    const mini = miniatureAFaire(photo), moyenne = moyenneAFaire(photo);
    if (!mini && !moyenne) continue;  // plus rien à faire sans WebP
    try {
      const reponse = await fetch(photo.url);
      if (!reponse.ok) throw new Error('Téléchargement échoué (HTTP ' + reponse.status + ')');
      const original = await reponse.blob();
      const maj = {};
      let webpOk = true;
      if (mini) webpOk = await refaireVersion(photo, original, maj, 'miniature', 'miniatures', '-n800', 800, 0.75);
      if (moyenne) webpOk = (await refaireVersion(photo, original, maj, 'moyenne', 'moyennes', '', 1400, 0.78)) && webpOk;
      if (!webpOk) webp = false;  // copie WebP refusée : on n'insiste pas pour les suivantes
      // seulement si la photo n'a pas été remplacée entre-temps (bouton « Remplacer »)
      const { error: erreurMaj } = await sb.from('model_photos').update(maj).eq('id', photo.id).eq('url', photo.url);
      if (erreurMaj) throw erreurMaj;
      faites++;
    } catch (e) {
      echecs++;
      console.warn('Rattrapage photo', photo.id, e);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  if (aFaire.length) console.info('Rattrapage des photos :', faites, 'faite(s) sur', aFaire.length, '—', echecs, 'échec(s).');
}


/* ===================== AJOUT Étape 14 : agrégation "À traiter" =====================
   Ne fait AUCUNE nouvelle requête : réutilise les compteurs déjà chargés par
   ailleurs (validations, candidatures, inscriptions, recruteurs, messages),
   donc n'alourdit pas le chargement du tableau de bord. */
async function chargerATraiter() {
  const liste = document.getElementById('a-traiter-liste');
  const totalEl = document.getElementById('a-traiter-total');

  const [
    { count: validations },
    { count: candidaturesNouvelles },
    { count: inscriptionsAttente },
    { count: recruteursNouveaux },
  ] = await Promise.all([
    sb.from('model_profiles').select('id', { count: 'exact', head: true }).eq('en_attente_validation', true),
    sb.from('casting_applications').select('id', { count: 'exact', head: true }).eq('status', 'nouvelle'),
    sb.from('inscriptions_mannequins').select('id', { count: 'exact', head: true }).eq('statut', 'en attente de paiement'),
    sb.from('recruiter_requests').select('id', { count: 'exact', head: true }).eq('status', 'nouvelle'),
  ]);

  // Chaque ligne ouvre sa rubrique dans le menu (avant : défilement vers une liste
  // cachée depuis l'arrivée du menu par blocs — le clic ne faisait rien, signalé le 04/10).
  const ouvrirRubrique = (cle) => () => {
    const entree = document.querySelector('.tdb-menu-item[data-tdb-cible="' + cle + '"]');
    if (entree) entree.click();
  };
  const items = [
    { label: 'Validations THE BOOK en attente', compte: validations || 0, action: ouvrirRubrique('b2-validations') },
    { label: 'Nouvelles candidatures', compte: candidaturesNouvelles || 0, action: ouvrirRubrique('b2-candidatures') },
    { label: 'Inscriptions à vérifier (paiement)', compte: inscriptionsAttente || 0, action: ouvrirRubrique('b2-inscriptions') },
    { label: 'Nouvelles demandes recruteurs', compte: recruteursNouveaux || 0, action: ouvrirRubrique('b2-recruteurs') },
  ].filter(i => i.compte > 0);

  const total = items.reduce((s, i) => s + i.compte, 0);
  totalEl.textContent = total ? `${total} action${total > 1 ? 's' : ''} en attente` : '';

  // Reflète le même total sur le badge de la sidebar et la cloche du haut (pas de nouvelle requête).
  const navBadge = document.getElementById('nav-badge-a-traiter');
  const clocheBadge = document.getElementById('db-cloche-badge');
  if (navBadge) { navBadge.textContent = total || ''; navBadge.style.display = total ? 'inline-block' : 'none'; }
  if (clocheBadge) { clocheBadge.textContent = total || ''; clocheBadge.style.display = total ? 'inline-block' : 'none'; }

  if (!items.length) {
    liste.innerHTML = '<div class="a-traiter-vide">✅ Votre espace est à jour.</div>';
    return;
  }

  liste.innerHTML = items.map((i, idx) => `
    <button type="button" class="a-traiter-item" data-at-index="${idx}">
      <span class="at-label">${echapperHtml(i.label)}</span>
      <span class="at-compte">${i.compte}</span>
    </button>
  `).join('');

  liste.querySelectorAll('[data-at-index]').forEach(btn => {
    btn.addEventListener('click', () => items[Number(btn.dataset.atIndex)].action());
  });
}

/* ===================== AJOUT Étape 16 : graphique d'activité 7 jours (courbe SVG) =====================
   Regroupe page_views par jour, côté client (pas de nouvelle fonction serveur
   nécessaire). Reste raisonnable en volume car limité aux 7 derniers jours. Aucune
   dépendance externe : un simple <svg><polyline> suffit, cohérent avec le reste
   du site qui n'utilise aucune librairie de graphiques. */
async function chargerActiviteGraphique() {
  const conteneur = document.getElementById('activite-barres');
  const sousCartes = document.getElementById('activite-souscartes');
  const depuis7j = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  depuis7j.setHours(0, 0, 0, 0);

  const { data: vues, error } = await sb.from('page_views')
    .select('created_at')
    .gte('created_at', depuis7j.toISOString())
    .limit(20000);

  if (error) {
    conteneur.innerHTML = '<p class="tdb-47">Statistiques indisponibles pour le moment.</p>';
    return;
  }

  const joursLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const jours = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    jours.push({ date: d, compte: 0 });
  }

  (vues || []).forEach(v => {
    const d = new Date(v.created_at);
    d.setHours(0, 0, 0, 0);
    const jourTrouve = jours.find(j => j.date.getTime() === d.getTime());
    if (jourTrouve) jourTrouve.compte++;
  });

  const max = Math.max(...jours.map(j => j.compte), 1);
  const largeur = 560, hauteur = 130, marge = 12;
  const pas = (largeur - marge * 2) / (jours.length - 1);
  const points = jours.map((j, i) => {
    const x = marge + i * pas;
    const y = hauteur - marge - ((j.compte / max) * (hauteur - marge * 2));
    return { x, y, compte: j.compte, label: joursLabels[j.date.getDay()] };
  });
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const aire = `${marge},${hauteur - marge} ${polyline} ${largeur - marge},${hauteur - marge}`;

  conteneur.innerHTML = `
    <svg viewBox="0 0 ${largeur} ${hauteur + 18}" preserveAspectRatio="none">
      <polygon points="${aire}" fill="rgba(207,59,82,0.14)"></polygon>
      <polyline points="${polyline}" fill="none" stroke="var(--bordeaux-clair)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>
      ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--bordeaux-clair)"><title>${p.compte} visite(s)</title></circle>`).join('')}
      ${points.map(p => `<text x="${p.x}" y="${hauteur + 14}" text-anchor="middle" font-size="9" fill="var(--gris)">${p.label}</text>`).join('')}
    </svg>
  `;

  if (sousCartes) {
    const total7j = jours.reduce((s, j) => s + j.compte, 0);
    const aujourdhui = jours[jours.length - 1].compte;
    const { count: photosTotal } = await sb.from('model_photos').select('id', { count: 'exact', head: true });
    sousCartes.innerHTML = `
      <div class="activite-souscarte"><div class="chiffre">${total7j}</div><div class="label">Visites 7 jours</div></div>
      <div class="activite-souscarte"><div class="chiffre">${aujourdhui}</div><div class="label">Visites aujourd'hui</div></div>
      <div class="activite-souscarte"><div class="chiffre">${photosTotal || 0}</div><div class="label">Photos envoyées</div></div>
    `;
  }
}

/* ===================== AJOUT Étape 20 : bloc Drive/photos (données réelles disponibles uniquement) ===================== */
async function chargerDriveBloc() {
  const conteneur = document.getElementById('drive-grille');
  const [{ count: photosBook }, { count: mannequinsPublies }] = await Promise.all([
    sb.from('model_photos').select('id', { count: 'exact', head: true }),
    sb.from('model_profiles').select('id', { count: 'exact', head: true }).eq('published', true),
  ]);

  // "Vérifiées / En attente / Erreurs" ne peuvent pas être calculés sans le fichier
  // d'intégration Drive (aucune table de statut par photo n'existe pour l'instant) —
  // affichés en "—" plutôt que d'inventer un chiffre, voir l'avertissement ci-dessous.
  conteneur.innerHTML = `
    <div class="drive-panneau">
      <div class="drive-ligne"><span class="drive-ligne-label">Photos (Supabase — THE BOOK)</span><span class="drive-ligne-chiffre">${photosBook || 0}</span></div>
      <div class="drive-ligne"><span class="drive-ligne-label">Mannequins publiés</span><span class="drive-ligne-chiffre">${mannequinsPublies || 0}</span></div>
      <div class="drive-ligne attente"><span class="drive-ligne-label">Photos sur Drive — en attente</span><span class="drive-ligne-chiffre">—</span></div>
      <div class="drive-ligne erreurs"><span class="drive-ligne-label">Photos sur Drive — erreurs</span><span class="drive-ligne-chiffre">—</span></div>
    </div>
  `;
}

/* ===================== AJOUT : graphique "Évolution des candidatures" (6 dernières semaines, données réelles) ===================== */
async function chargerEvolutionCandidatures() {
  const conteneur = document.getElementById('evolution-candidatures');
  if (!conteneur) return;
  const depuis6sem = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);
  depuis6sem.setHours(0, 0, 0, 0);

  const { data: candidatures, error } = await sb.from('casting_applications')
    .select('created_at')
    .gte('created_at', depuis6sem.toISOString())
    .limit(20000);

  if (error) {
    conteneur.innerHTML = '<p class="tdb-47">Statistiques indisponibles pour le moment.</p>';
    return;
  }

  const semaines = [];
  for (let i = 5; i >= 0; i--) {
    const debut = new Date();
    debut.setHours(0, 0, 0, 0);
    debut.setDate(debut.getDate() - (i * 7 + 6));
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + 7);
    semaines.push({ debut, fin, compte: 0 });
  }

  (candidatures || []).forEach(c => {
    const d = new Date(c.created_at);
    const semaine = semaines.find(s => d >= s.debut && d < s.fin);
    if (semaine) semaine.compte++;
  });

  if (!semaines.some(s => s.compte > 0)) {
    conteneur.innerHTML = '<p class="tdb-47">Pas encore de candidature enregistrée sur les 6 dernières semaines.</p>';
    return;
  }

  const max = Math.max(...semaines.map(s => s.compte), 1);
  const largeur = 560, hauteur = 130, marge = 12;
  const pas = (largeur - marge * 2) / (semaines.length - 1);
  const points = semaines.map((s, i) => {
    const x = marge + i * pas;
    const y = hauteur - marge - ((s.compte / max) * (hauteur - marge * 2));
    return { x, y, compte: s.compte, label: `Sem. ${i + 1}` };
  });
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const aire = `${marge},${hauteur - marge} ${polyline} ${largeur - marge},${hauteur - marge}`;

  conteneur.innerHTML = `
    <svg viewBox="0 0 ${largeur} ${hauteur + 18}" preserveAspectRatio="none">
      <polygon points="${aire}" fill="rgba(207,59,82,0.14)"></polygon>
      <polyline points="${polyline}" fill="none" stroke="var(--bordeaux-clair)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>
      ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--bordeaux-clair)"><title>${p.compte} candidature(s)</title></circle>`).join('')}
      ${points.map(p => `<text x="${p.x}" y="${hauteur + 14}" text-anchor="middle" font-size="9" fill="var(--gris)">${p.label}</text>`).join('')}
    </svg>
  `;
}

/* ===================== AJOUT : aperçu compact des derniers dossiers (inscriptions / candidatures / recruteurs) ===================== */
function apercuPhotoErreur(img) {
  const div = document.createElement('div');
  div.className = 'apercu-photo-vide';
  div.textContent = img.dataset.initiales || '?';
  img.replaceWith(div);
}

async function chargerApercuDossiers() {
  const conteneur = document.getElementById('apercu-dossiers-liste');
  if (!conteneur) return;

  const [{ data: candidatures }, { data: inscriptions }, { data: recruteurs }] = await Promise.all([
    sb.from('casting_applications').select('id, full_name, status, created_at').order('created_at', { ascending: false }).limit(4),
    sb.from('inscriptions_mannequins').select('id, full_name, statut, created_at').order('created_at', { ascending: false }).limit(4),
    sb.from('recruiter_requests').select('id, contact_name, company, status, created_at').order('created_at', { ascending: false }).limit(4),
  ]);

  const items = [
    ...(candidatures || []).map(d => ({ source: 'casting', id: d.id, nom: d.full_name || 'Sans nom', statut: d.status, created_at: d.created_at })),
    ...(inscriptions || []).map(d => ({ source: 'inscription', id: d.id, nom: d.full_name || 'Sans nom', statut: d.statut, created_at: d.created_at })),
    ...(recruteurs || []).map(d => ({ source: 'recruteur', id: d.id, nom: d.contact_name || d.company || 'Sans nom', statut: d.status, created_at: d.created_at })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);

  if (!items.length) {
    conteneur.innerHTML = '<div class="apercu-dossiers-vide">Aucun dossier pour le moment.</div>';
    return;
  }

  // Photo du premier fichier joint (candidatures/inscriptions uniquement — les demandes recruteurs n'ont pas de photo jointe)
  const idsCasting = items.filter(i => i.source === 'casting').map(i => i.id);
  const idsInscription = items.filter(i => i.source === 'inscription').map(i => i.id);
  const [{ data: photosCasting }, { data: photosInscription }] = await Promise.all([
    idsCasting.length ? sb.from('casting_photos').select('application_id, chemin, url').in('application_id', idsCasting) : Promise.resolve({ data: [] }),
    idsInscription.length ? sb.from('inscriptions_photos').select('inscription_id, chemin, url').in('inscription_id', idsInscription) : Promise.resolve({ data: [] }),
  ]);

  const cheminsCasting = (photosCasting || []).map(p => p.chemin).filter(Boolean);
  const cheminsInscription = (photosInscription || []).map(p => p.chemin).filter(Boolean);
  const [{ data: signeesCasting }, { data: signeesInscription }] = await Promise.all([
    cheminsCasting.length ? sb.storage.from('casting-applications').createSignedUrls(cheminsCasting, 300) : Promise.resolve({ data: [] }),
    cheminsInscription.length ? sb.storage.from('inscriptions-photos').createSignedUrls(cheminsInscription, 300) : Promise.resolve({ data: [] }),
  ]);
  const urlParCheminCasting = {};
  (signeesCasting || []).forEach(s => { if (s.path && s.signedUrl) urlParCheminCasting[s.path] = s.signedUrl; });
  const urlParCheminInscription = {};
  (signeesInscription || []).forEach(s => { if (s.path && s.signedUrl) urlParCheminInscription[s.path] = s.signedUrl; });

  const photoParId = {};
  (photosCasting || []).forEach(p => { if (!photoParId['casting-' + p.application_id]) photoParId['casting-' + p.application_id] = p.chemin ? (urlParCheminCasting[p.chemin] || '') : (p.url || ''); });
  (photosInscription || []).forEach(p => { if (!photoParId['inscription-' + p.inscription_id]) photoParId['inscription-' + p.inscription_id] = p.chemin ? (urlParCheminInscription[p.chemin] || '') : (p.url || ''); });

  const LIBELLES_SOURCE = { casting: 'Candidature', inscription: 'Inscription', recruteur: 'Recruteur' };
  const LIBELLES_STATUT = {
    casting: { nouvelle: 'Nouvelle', vue: 'Vue', retenue: 'Retenue', 'refusée': 'Refusée' },
    inscription: { 'en attente de paiement': 'En attente', 'payée': 'Payée', 'annulée': 'Annulée' },
    recruteur: { nouvelle: 'Nouvelle', vue: 'Vue', 'traitée': 'Traitée' },
  };

  conteneur.innerHTML = items.map(it => {
    const photo = photoParId[it.source + '-' + it.id] || '';
    const initiales = echapperHtml((it.nom || '?').trim().charAt(0).toUpperCase() || '?');
    const photoHtml = photo
      ? `<img class="apercu-photo" src="${echapperHtml(photo)}" data-initiales="${initiales}" alt="" loading="lazy">`
      : `<div class="apercu-photo-vide">${initiales}</div>`;
    const statutLabel = (LIBELLES_STATUT[it.source] && LIBELLES_STATUT[it.source][it.statut]) || it.statut || '';
    return `
      <div class="apercu-carte" data-source="${it.source}" data-id="${it.id}">
        ${photoHtml}
        <div class="apercu-nom">${echapperHtml(it.nom)}</div>
        <div class="apercu-type">${LIBELLES_SOURCE[it.source]}</div>
        <span class="statut-pill ${classeStatut(String(it.statut || 'inconnu'))}">${echapperHtml(statutLabel)}</span>
      </div>`;
  }).join('');

  conteneur.querySelectorAll('.apercu-carte').forEach(carte => {
    carte.addEventListener('click', () => ouvrirFicheDossier(carte.dataset.source, carte.dataset.id));
  });
  conteneur.querySelectorAll('.apercu-photo').forEach(img => {
    img.onerror = () => apercuPhotoErreur(img);
  });
}

/* ===================== AJOUT : sidebar — navigation par défilement + surlignage ===================== */
function initSidebarNav() {
  document.querySelectorAll('.db-nav-item[data-scroll], .db-action-btn[data-scroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Ouvre d'abord la rubrique qui contient la cible (sinon elle reste cachée).
      if (window.ma2mAllerVers) { window.ma2mAllerVers(btn.dataset.scroll); return; }
      const cible = document.getElementById(btn.dataset.scroll);
      if (!cible) return;
      cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (btn.classList.contains('db-nav-item')) {
        document.querySelectorAll('.db-nav-item').forEach(b => b.classList.remove('actif'));
        btn.classList.add('actif');
      }
    });
  });
  const clocheBtn = document.getElementById('db-cloche-btn');
  // La cloche ouvre la page « À traiter » (avant : elle faisait défiler vers une
  // page cachée depuis l'arrivée du menu par blocs — le clic ne faisait plus rien).
  if (clocheBtn) clocheBtn.addEventListener('click', () => {
    const entree = document.querySelector('.tdb-menu-item[data-tdb-cible="b1-a-traiter"]');
    if (entree) entree.click();
    else document.getElementById('a-traiter-liste').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const logoutSidebar = document.getElementById('tb-logout-btn-sidebar');
  if (logoutSidebar) logoutSidebar.addEventListener('click', () => document.getElementById('tb-logout-btn').click());
}

/* ===================== AJOUT : bannière "mannequin à la une" (réutilise le mannequin vedette réel) ===================== */
async function chargerHeroVedette() {
  const conteneur = document.getElementById('db-hero');
  const { data: vedette } = await sb.from('model_profiles').select('id, full_name, city').eq('published', true).eq('featured', true).maybeSingle();

  if (!vedette) {
    conteneur.innerHTML = `
      <div class="db-hero-contenu db-hero-contenu--vide">
        <div class="db-hero-eyebrow">MANNEQUIN À LA UNE <span></span></div>
        <div class="db-hero-vide-marque">MA</div>
        <div class="db-hero-nom">Aucun mannequin sélectionné</div>
        <div class="db-hero-note">Le visiteur qui arrive sur l'accueil voit une photo au hasard tant qu'aucun choix n'est fait ici.</div>
        <button class="db-hero-link" id="db-hero-choisir-vedette-btn" type="button">Choisir un mannequin à la une <span>→</span></button>
      </div>`;
    const btn = document.getElementById('db-hero-choisir-vedette-btn');
    if (btn) btn.addEventListener('click', () => {
      if (window.ma2mAllerVers) { window.ma2mAllerVers('tb-select-vedette'); return; }
      const select = document.getElementById('tb-select-vedette');
      if (select) { select.scrollIntoView({ behavior: 'smooth', block: 'center' }); select.focus(); }
    });
    return;
  }

  const { data: photo } = await sb.from('model_photos').select('url_miniature, url').eq('model_id', vedette.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  const urlPhoto = photo ? (photo.url_miniature || photo.url) : '';

  conteneur.innerHTML = `
    ${urlPhoto ? `<img src="${echapperHtml(urlPhoto)}" alt="${echapperHtml(vedette.full_name || '')}" loading="eager">` : ''}
    <div class="db-hero-contenu">
      <div class="db-hero-eyebrow">MANNEQUIN À LA UNE <span></span></div>
      <div class="db-hero-nom">${echapperHtml(vedette.full_name || 'Mannequin')}</div>
      <div class="db-hero-note">${echapperHtml(vedette.city || '')}</div>
      <div class="db-hero-signature">Une présence. Une image. Une identité.</div>
      <div class="db-hero-footer"><span>ACTUELLEMENT MIS EN AVANT SUR L'ACCUEIL</span><i></i></div>
      <a class="db-hero-link" href="mannequin.html?id=${encodeURIComponent(vedette.id)}" target="_blank" rel="noopener">Voir la fiche <span>→</span></a>
    </div>
  `;
}

/* ===================== AJOUT : "Dernières activités" — flux réel à partir des dates
   existantes de plusieurs tables (aucune table de journal d'activité n'existe :
   ce flux est reconstruit, pas inventé, à partir de vrais évènements horodatés). ===================== */
async function chargerDernieresActivites() {
  const conteneur = document.getElementById('dernieres-activites');
  const [{ data: messages }, { data: photosRecentes }, { data: candidaturesRecentes }, { data: inscriptionsRecentes }, { data: actusRecentes }] = await Promise.all([
    sb.from('messages_contact').select('nom, created_at').order('created_at', { ascending: false }).limit(3),
    sb.from('model_photos').select('created_at').order('created_at', { ascending: false }).limit(3),
    sb.from('casting_applications').select('full_name, created_at').order('created_at', { ascending: false }).limit(3),
    sb.from('inscriptions_mannequins').select('full_name, created_at').order('created_at', { ascending: false }).limit(3),
    sb.from('actualites').select('titre, created_at').order('created_at', { ascending: false }).limit(2),
  ]);

  const evenements = [
    ...(messages || []).map(m => ({ texte: `Nouveau message de ${m.nom || 'un visiteur'}`, date: m.created_at })),
    ...(photosRecentes || []).map(() => ({ texte: 'Photo ajoutée au book', date: null })).map((e, i) => ({ ...e, date: (photosRecentes[i] || {}).created_at })),
    ...(candidaturesRecentes || []).map(c => ({ texte: `Candidature reçue — ${c.full_name || 'candidat'}`, date: c.created_at })),
    ...(inscriptionsRecentes || []).map(m => ({ texte: `Inscription reçue — ${m.full_name || 'mannequin'}`, date: m.created_at })),
    ...(actusRecentes || []).map(a => ({ texte: `Actualité publiée — ${a.titre || ''}`, date: a.created_at })),
  ].filter(e => e.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  if (!evenements.length) {
    conteneur.innerHTML = '<div class="dossiers-vide">Aucune activité récente.</div>';
    return;
  }

  conteneur.innerHTML = evenements.map(e => `
    <div class="timeline-item">
      <span class="timeline-point"></span>
      <div>
        <div class="timeline-texte">${echapperHtml(e.texte)}</div>
        <div class="timeline-date">${new Date(e.date).toLocaleDateString('fr-FR')}</div>
      </div>
    </div>
  `).join('');
}

async function chargerStatistiques() {
  const debutAujourdhui = new Date(); debutAujourdhui.setHours(0, 0, 0, 0);
  const depuis7j = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [mannequins, candidatures, inscriptions, recruteurs, actus, photos, visites, contacts, visitesAujourdhui, visites7j, visitesTotal] = await Promise.all([
    (async () => { const { count } = await sb.from('model_profiles').select('id', { count: 'exact', head: true }).eq('published', true); return count || 0; })(),
    compter('casting_applications'),
    compter('inscriptions_mannequins'),
    compter('recruiter_requests'),
    compter('actualites'),
    compter('model_photos'),
    compter('page_views'),
    compter('messages_contact'),
    (async () => { const { data } = await sb.rpc('stats_visites_reelles_site', { depuis: debutAujourdhui.toISOString() }); return data || 0; })(),
    (async () => { const { data } = await sb.rpc('stats_visites_reelles_site', { depuis: depuis7j }); return data || 0; })(),
    (async () => { const { data } = await sb.rpc('stats_visites_reelles_site'); return data || 0; })()
  ]);

  document.getElementById('stats-grille').innerHTML = `
    <div class="stat-carte stat-primaire accent">
      <div class="stat-head"><span class="stat-icone">♙</span><span class="stat-live">BOOK</span></div>
      <div class="chiffre">${mannequins}</div><div class="label">Mannequins</div><div class="micro">profils publiés</div><div class="stat-line"><i></i></div>
    </div>
    <div class="stat-carte stat-primaire">
      <div class="stat-head"><span class="stat-icone">♙</span><span class="stat-live">DOSSIERS</span></div>
      <div class="chiffre">${inscriptions}</div><div class="label">Inscriptions</div><div class="micro">reçues dans le système</div><div class="stat-line"><i></i></div>
    </div>
    <div class="stat-carte stat-primaire">
      <div class="stat-head"><span class="stat-icone">◈</span><span class="stat-live">CASTINGS</span></div>
      <div class="chiffre">${candidatures}</div><div class="label">Candidatures</div><div class="micro">candidatures enregistrées</div><div class="stat-line"><i></i></div>
    </div>
    <div class="stat-carte stat-primaire">
      <div class="stat-head"><span class="stat-icone">✉</span><span class="stat-live">CONTACT</span></div>
      <div class="chiffre">${contacts}</div><div class="label">Messages</div><div class="micro">messages reçus</div><div class="stat-line"><i></i></div>
    </div>
    <div class="stat-carte stat-primaire">
      <div class="stat-head"><span class="stat-icone">⌂</span><span class="stat-live">RECRUTEURS</span></div>
      <div class="chiffre">${recruteurs}</div><div class="label">Demandes recruteurs</div><div class="micro">demandes enregistrées</div><div class="stat-line"><i></i></div>
    </div>
    <div class="stats-secondaires">
      <span><em>01</em><b>${actus}</b> actualités publiées</span>
      <span><em>02</em><b>${photos}</b> photos du Book</span>
      <span><em>03</em><b>${visitesAujourdhui}</b> visites aujourd'hui</span>
      <span><em>04</em><b>${visites7j}</b> visites sur 7 jours</span>
      <span><em>05</em><b>${visitesTotal}</b> visites au total</span>
    </div>
  `;

  void chargerErreurs();
  void chargerClassementMannequins();
  void chargerCodes();
  void chargerProjets();
  void chargerResumeCandidatures();
  void chargerCandidatures();
  void chargerInscriptions();
  void chargerRecruteurs();
  void chargerRepartitionCategories();
  void chargerATraiter();
  void chargerActiviteGraphique();
  void chargerEvolutionCandidatures();
  void chargerApercuDossiers();
  void chargerDriveBloc();
  void chargerHeroVedette();
  void chargerDernieresActivites();

  const { data: derniersContacts } = await sb.from('messages_contact').select('nom, type_contact, telephone, created_at').order('created_at', { ascending: false }).limit(10);
  document.querySelector('#table-contacts tbody').innerHTML = (derniersContacts || []).map(c => {
    const lienWa = lienWhatsApp(c.telephone);
    return `
    <tr><td>${echapperHtml(c.nom || '-')}</td><td>${echapperHtml(c.type_contact || '-')}</td><td>${echapperHtml(c.telephone || '-')}</td><td>${new Date(c.created_at).toLocaleDateString('fr-FR')}</td><td>${lienWa ? `<a href="${lienWa}" target="_blank" rel="noopener" class="btn tdb-48">WhatsApp ↗</a>` : ''}</td></tr>
  `;
  }).join('') || '<tr><td colspan="5">Aucun message.</td></tr>';

  void chargerVedette();
  void chargerBandeau();
  void chargerMotResponsableTableau();
  void chargerCompteurValidations();
  void chargerConfigInstagram();
}


async function chargerConfigInstagram() {
  const { data: config } = await sb.from('instagram_config').select('access_token, ig_user_id, token_expire_le').eq('id', 'principal').maybeSingle();
  const statutDiv = document.getElementById('instagram-statut');

  if (config && config.ig_user_id) document.getElementById('instagram-ig-user-id').value = config.ig_user_id;

  if (!config || !config.access_token) {
    statutDiv.innerHTML = '<span class="u-texte-gris">Aucun jeton configuré — le flux ne s\'affiche pas encore sur le site.</span>';
    return;
  }

  let messageExpiration = '';
  if (config.token_expire_le) {
    const expireLe = new Date(config.token_expire_le);
    const joursRestants = Math.round((expireLe - new Date()) / (1000 * 60 * 60 * 24));
    if (joursRestants < 0) {
      messageExpiration = ` — <strong class="tdb-49">jeton expiré, générez-en un nouveau et enregistrez-le</strong>`;
    } else if (joursRestants <= 10) {
      messageExpiration = ` — <strong class="tdb-50">expire dans ${joursRestants} jour(s), pensez à le renouveler</strong>`;
    } else {
      messageExpiration = ` — expire dans ${joursRestants} jours`;
    }
  }
  statutDiv.innerHTML = `<span class="tdb-49">Jeton configuré</span>${messageExpiration}`;
}

document.getElementById('instagram-enregistrer-btn').addEventListener('click', async () => {
  const token = document.getElementById('instagram-token').value.trim();
  const igUserId = document.getElementById('instagram-ig-user-id').value.trim();
  const msg = document.getElementById('instagram-msg');
  if (!token || !igUserId) {
    msg.className = 'form-msg err'; msg.textContent = "L'identifiant du compte et le jeton sont tous les deux nécessaires."; msg.style.display = 'block';
    return;
  }
  const expireLe = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from('instagram_config').upsert({ id: 'principal', access_token: token, ig_user_id: igUserId, token_expire_le: expireLe, updated_at: new Date().toISOString() });
  msg.className = 'form-msg ' + (error ? 'err' : 'ok');
  msg.textContent = error ? "Erreur lors de l'enregistrement : " + error.message : 'Jeton enregistré. Cliquez sur "Rafraîchir les publications" pour les récupérer.';
  msg.style.display = 'block';
  document.getElementById('instagram-token').value = '';
  if (!error) void chargerConfigInstagram();
});

document.getElementById('instagram-rafraichir-btn').addEventListener('click', async () => {
  const msg = document.getElementById('instagram-msg');
  const bouton = document.getElementById('instagram-rafraichir-btn');
  bouton.disabled = true;
  msg.className = 'form-msg'; msg.textContent = 'Récupération des publications…'; msg.style.display = 'block';

  const { data: config } = await sb.from('instagram_config').select('access_token, ig_user_id').eq('id', 'principal').maybeSingle();
  if (!config || !config.access_token || !config.ig_user_id) {
    msg.className = 'form-msg err'; msg.textContent = "Enregistrez d'abord un identifiant de compte et un jeton.";
    bouton.disabled = false;
    return;
  }

  try {
    const champs = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
    const reponse = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(config.ig_user_id)}/media?fields=${champs}&access_token=${encodeURIComponent(config.access_token)}&limit=8`);
    const resultat = await reponse.json();
    if (resultat.error) throw new Error(resultat.error.message || 'Erreur inconnue de l\'API Instagram.');

    const posts = (resultat.data || [])
      .filter(p => p.media_type !== 'VIDEO' || p.thumbnail_url)
      .map(p => ({
        id: p.id,
        image: p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url,
        lien: p.permalink,
        legende: (p.caption || '').slice(0, 140),
      }));

    const { error: erreurCache } = await sb.from('instagram_posts_cache').upsert({ id: 'principal', posts, updated_at: new Date().toISOString() });
    if (erreurCache) throw new Error(erreurCache.message);

    msg.className = 'form-msg ok';
    msg.textContent = `${posts.length} publication(s) récupérée(s) et mise(s) à jour sur le site.`;
  } catch (e) {
    msg.className = 'form-msg err';
    msg.textContent = 'Erreur : ' + e.message + ' — vérifiez que le jeton est valide et que le compte est bien un compte professionnel relié à une Page Facebook.';
  }
  bouton.disabled = false;
});

let validationsChargees = false;

async function chargerCompteurValidations() {
  const { count } = await sb.from('model_profiles').select('id', { count: 'exact', head: true }).eq('en_attente_validation', true);
  const badge = document.getElementById('validation-compteur');
  badge.textContent = count ? `${count} en attente` : 'Aucune';
  badge.classList.toggle('a-traiter', !!count);
}

document.getElementById('validation-details').addEventListener('toggle', (e) => {
  if (e.target.open && !validationsChargees) void chargerListeValidations();
});

async function chargerListeValidations() {
  validationsChargees = true;
  const conteneur = document.getElementById('liste-validations');
  conteneur.textContent = 'Chargement…';

  const { data: profils } = await sb.from('model_profiles')
    .select('id, full_name, city, category')
    .eq('en_attente_validation', true)
    .order('created_at', { ascending: true });
  await completerProfilsPrives(profils); // date de naissance (Extension 131)

  if (!profils || !profils.length) {
    conteneur.innerHTML = '<div class="dossiers-vide">Aucune fiche en attente de validation pour le moment.</div>';
    return;
  }

  const { data: photos } = await sb.from('model_photos').select('model_id, url_miniature, url, created_at').in('model_id', profils.map(p => p.id)).order('created_at', { ascending: true });
  const photosParMannequin = {};
  (photos || []).forEach(p => {
    (photosParMannequin[p.model_id] = photosParMannequin[p.model_id] || []).push(p.url_miniature || p.url);
  });

  conteneur.innerHTML = profils.map(p => {
    const age = calculerAge(p.date_naissance);
    const estMineur = age !== null && age < 18;
    const mesPhotos = (photosParMannequin[p.id] || []).slice(0, 4);
    return `
    <div class="validation-carte" data-id="${p.id}">
      <div class="validation-photos">
        ${mesPhotos.length ? mesPhotos.map(url => `<img src="${echapperHtml(url)}" data-fallback="" alt="" loading="lazy">`).join('') : '<span class="tdb-51">Aucune photo</span>'}
      </div>
      <div class="validation-infos">
        <div class="dc-nom">${echapperHtml(p.full_name || 'Sans nom')} ${estMineur ? '<span class="badge-mineur">Mineur' + (age !== null ? ' — ' + age + ' ans' : '') + '</span>' : ''}</div>
        <div class="dc-meta">${echapperHtml(p.city || '')}${p.category ? ' · ' + echapperHtml(p.category) : ''}</div>
      </div>
      <div class="validation-actions">
        <button class="btn btn--principal btn-valider" data-id="${p.id}">Valider et publier</button>
        <button class="btn btn-refuser" data-id="${p.id}">Refuser</button>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('liste-validations').addEventListener('click', async (e) => {
  const idValider = e.target.closest('.btn-valider')?.dataset.id;
  const idRefuser = e.target.closest('.btn-refuser')?.dataset.id;

  if (idValider) {
    e.target.disabled = true;
    const { error } = await sb.from('model_profiles').update({ published: true }).eq('id', idValider);
    if (error) { alert("Erreur lors de la validation : " + error.message); e.target.disabled = false; return; }
    validationsChargees = false;
    void chargerListeValidations();
    void chargerCompteurValidations();
    void chargerATraiter();
  }

  if (idRefuser) {
    const raison = prompt("Raison du refus (visible par le mannequin, pour qu'il puisse corriger) :");
    if (raison === null) return;
    const { error } = await sb.from('model_profiles').update({ en_attente_validation: false, raison_refus: raison.trim() || null }).eq('id', idRefuser);
    if (error) { alert("Erreur : " + error.message); return; }
    validationsChargees = false;
    void chargerListeValidations();
    void chargerCompteurValidations();
    void chargerATraiter();
  }
});

// ===================================================================
// Gestion des photos des mannequins DÉJÀ PUBLIÉS dans Le Book, depuis le
// tableau de bord (jusqu'ici possible uniquement par le mannequin lui-même
// depuis son espace personnel). Reprend exactement le même pipeline d'envoi
// que espace-mannequin.html (conversion HEIC, compression, miniature) pour
// rester cohérent avec ce qui existe déjà — les photos partent sur
// Cloudflare R2 (bucket ma2m-photos), pas sur Drive : Le Book est public et
// a besoin d'un stockage optimisé pour l'affichage (bande passante gratuite
// sur R2), pas d'un archivage comme les dossiers de candidature/inscription.

// Même mécanisme que dans espace-mannequin.html : une URL R2 signée
// temporaire, délivrée par api/r2-presigner.js, jamais les clés R2
// elles-mêmes. Le contrôle d'accès y autorise le propriétaire ET tout
// admin (table admins) — exactement ce cas d'usage.
// jetonSessionCourante(), uploaderVersR2(), supprimerDeR2(), compresserPhotoOrigine(),
// envoyerVersionPhoto(), envoyerPhotoBook() : partagés avec l'Espace mannequin dans js/app.js.

let mannequinsPubliesCharges = false;
document.getElementById('mannequins-publies-details').addEventListener('toggle', (e) => {
  if (e.target.open && !mannequinsPubliesCharges) void chargerListeMannequinsPublies();
});

async function chargerListeMannequinsPublies() {
  mannequinsPubliesCharges = true;
  const conteneur = document.getElementById('liste-mannequins-publies');
  conteneur.textContent = 'Chargement…';

  // Les profils en sourdine restent listés même s'ils ne sont plus publiés, pour pouvoir
  // toujours les réactiver ; sans la colonne (Extension 135 absente), liste d'avant.
  let { data: profils, error: eListe } = await sb.from('model_profiles')
    .select('id, full_name, city, desactive')
    .or('published.eq.true,desactive.eq.true')
    .order('full_name', { ascending: true });
  if (eListe) {
    ({ data: profils } = await sb.from('model_profiles')
      .select('id, full_name, city')
      .eq('published', true)
      .order('full_name', { ascending: true }));
  }

  document.getElementById('mannequins-publies-compteur').textContent = profils ? `${profils.length} publié(s)` : '';

  if (!profils || !profils.length) {
    conteneur.innerHTML = '<div class="dossiers-vide">Aucun mannequin publié pour le moment.</div>';
    return;
  }

  const { data: photos } = await sb.from('model_photos').select('model_id, url_miniature, url, principale').in('model_id', profils.map(p => p.id));
  const photoParMannequin = {};
  (photos || []).forEach(p => {
    if (p.principale || !photoParMannequin[p.model_id]) photoParMannequin[p.model_id] = p.url_miniature || p.url;
  });

  conteneur.innerHTML = profils.map(p => `
    <div class="validation-carte" data-id="${p.id}">
      <div class="validation-photos">
        ${photoParMannequin[p.id] ? `<img src="${echapperHtml(photoParMannequin[p.id])}" alt="" loading="lazy">` : '<span class="tdb-51">Aucune photo</span>'}
      </div>
      <div class="validation-infos">
        <div class="dc-nom">${echapperHtml(p.full_name || 'Sans nom')}</div>
        <div class="dc-meta">${echapperHtml(p.city || '')}${p.desactive ? ' · <strong class="tdb-sourdine">🔇 En sourdine : invisible sur le site, Espace bloqué</strong>' : ''}</div>
      </div>
      <div class="validation-actions">
        <button class="btn btn-sourdine" data-id="${p.id}" data-nom="${echapperHtml(p.full_name || 'Sans nom')}" data-desactive="${p.desactive ? '1' : ''}">${p.desactive ? '🔊 Réactiver' : '🔇 Mettre en sourdine'}</button>
        <button class="btn btn--principal btn-gerer-photos" data-id="${p.id}" data-nom="${echapperHtml(p.full_name || 'Sans nom')}">📸 Gérer les photos</button>
        <button class="btn btn-voir-cv" data-id="${p.id}" data-nom="${echapperHtml(p.full_name || 'Sans nom')}">📄 Voir le CV</button>
        <button class="btn tdb-42 btn-supprimer-mannequin" data-id="${p.id}" data-nom="${echapperHtml(p.full_name || 'Sans nom')}">🗑 Supprimer</button>
      </div>
    </div>`
  ).join('');

  conteneur.querySelectorAll('.btn-gerer-photos').forEach(btn => {
    btn.addEventListener('click', () => ouvrirPhotosMannequin(btn.dataset.id, btn.dataset.nom));
  });
  conteneur.querySelectorAll('.btn-voir-cv').forEach(btn => {
    btn.addEventListener('click', () => afficherCvAdmin(btn.dataset.id));
  });
  conteneur.querySelectorAll('.btn-supprimer-mannequin').forEach(btn => {
    btn.addEventListener('click', () => supprimerMannequin(btn.dataset.id, btn.dataset.nom));
  });
  conteneur.querySelectorAll('.btn-sourdine').forEach(btn => {
    btn.addEventListener('click', () => changerSourdine(btn));
  });
}

// Mise en sourdine (Extension 135, demande de la propriétaire du 07/10/2026) : profil
// invisible sur le site et Espace mannequin bloqué, sans rien supprimer ; « Réactiver »
// remet tout comme avant. Seuls les admins peuvent le faire (definir_sourdine).
async function changerSourdine(btn) {
  const desactiver = !btn.dataset.desactive;
  const question = desactiver
    ? `Mettre « ${btn.dataset.nom} » en sourdine ?\n\nSon profil disparaîtra du site et elle ne pourra plus utiliser son Espace mannequin (message : « L'administrateur a désactivé votre profil »). Rien n'est supprimé : vous pourrez la réactiver à tout moment.`
    : `Réactiver « ${btn.dataset.nom} » ?\n\nSon profil redevient visible sur le site et elle retrouve son Espace mannequin.`;
  if (!confirm(question)) return;
  btn.disabled = true;
  const { error } = await sb.rpc('definir_sourdine', { p_model: btn.dataset.id, p_desactive: desactiver });
  if (error) { btn.disabled = false; alert('Erreur : ' + error.message); return; }
  await chargerListeMannequinsPublies();
}

// Récupère les données d'un mannequin publié et affiche son CV (même gabarit
// que l'aperçu personnel du mannequin, construireHtmlCv() dans js/app.js) —
// l'admin peut ainsi consulter/télécharger le CV de n'importe quel mannequin
// publié sans avoir à se connecter à sa place.
let donneesCvAdminCourantes = null;
async function afficherCvAdmin(modelId) {
  const contenu = document.getElementById('cv-admin-contenu');
  contenu.innerHTML = 'Chargement…';
  document.getElementById('modal-cv-mannequin').classList.add('ouvert');

  const [{ data: profil, error: erreurProfil }, { data: projets }, { data: photos }, projetsAgence] = await Promise.all([
    sb.from('model_profiles').select(sansChampsPrives('id, full_name, category, bio, height_cm, weight_kg, city, quartier, instagram, chest_cm, waist_cm, hips_cm, shoe_size, carnation, clothing_size, date_naissance, eye_color, hair_color, years_experience, niveau_mannequin, inseam_cm, niveau_etude, etablissement, formation_particuliere, formation_mannequin, competences, citation, ville_naissance, lieu_naissance, nationalite')).eq('id', modelId).maybeSingle(),
    sb.from('model_projects').select('*').eq('model_id', modelId).order('created_at', { ascending: true }),
    sb.from('model_photos').select('*').eq('model_id', modelId).order('created_at', { ascending: true }),
    ma2mExperiencesAgence(modelId) // projets réalisés avec l'agence (agenda), js/app.js
  ]);

  if (erreurProfil || !profil) { contenu.innerHTML = 'Impossible de charger le CV de ce mannequin.'; return; }
  await completerProfilsPrives(profil); // date et lieu de naissance, nationalité… (Extension 131)

  let photoCvUrl = '';
  const compcardPhotos = [null, null, null, null, null];
  (photos || []).forEach(function (p) {
    if (p.photo_cv) photoCvUrl = p.url || '';
    if (p.compcard_ordre >= 1 && p.compcard_ordre <= 5) compcardPhotos[p.compcard_ordre - 1] = p.url || p.url_miniature;
  });
  const experiences = fusionnerExperiences(projetsAgence, projets).map(experiencePourCv);

  const donnees = {
    nomComplet: profil.full_name, dateNaissance: profil.date_naissance, villeNaissance: profil.ville_naissance,
    lieuNaissance: profil.lieu_naissance, nationalite: profil.nationalite, ville: profil.city, quartier: profil.quartier,
    citation: profil.citation, bio: profil.bio, instagram: profil.instagram,
    niveauMannequin: niveauNormalise(profil.niveau_mannequin, profil.years_experience),
    mannequinId: profil.id, photoCvUrl: photoCvUrl, compcardPhotos: compcardPhotos,
    photosBook: (photos || []).slice().sort(function (a, b) { return (b.principale ? 1 : 0) - (a.principale ? 1 : 0); }).map(function (p) { return p.url; }),
    physique: {
      taille: profil.height_cm, poids: profil.weight_kg, poitrine: profil.chest_cm, tourTaille: profil.waist_cm,
      hanches: profil.hips_cm, entrejambe: profil.inseam_cm, pointure: profil.shoe_size, tailleVet: ma2mTailleVetements(profil),
      yeux: profil.eye_color, cheveux: profil.hair_color, carnation: profil.carnation
    },
    formation: {
      niveau: profil.niveau_etude, etablissement: profil.etablissement,
      particuliere: profil.formation_particuliere, mannequin: profil.formation_mannequin
    },
    competences: profil.competences || {}, experiences: experiences, sexe: profil.category
  };

  contenu.innerHTML = construireHtmlCv(donnees);
  document.querySelectorAll('#cv-admin-contenu [data-largeur]').forEach(function (el) { el.style.width = el.dataset.largeur + '%'; });
  donneesCvAdminCourantes = donnees;
}
function fermerCvAdmin() { document.getElementById('modal-cv-mannequin').classList.remove('ouvert'); }
document.getElementById('modal-cv-mannequin-fermer').addEventListener('click', fermerCvAdmin);
document.getElementById('cvAdminFermer2').addEventListener('click', fermerCvAdmin);
document.getElementById('cvAdminBtnPdf').addEventListener('click', function () { void genererCvFichier('pdf', donneesCvAdminCourantes, 'cvAdminBtnPdf', 'cvAdminBtnJpeg'); });
document.getElementById('cvAdminBtnJpeg').addEventListener('click', function () { void genererCvFichier('jpeg', donneesCvAdminCourantes, 'cvAdminBtnPdf', 'cvAdminBtnJpeg'); });
document.getElementById('modal-cv-mannequin').addEventListener('click', function (e) {
  if (e.target.id === 'modal-cv-mannequin') fermerCvAdmin();
});

// Suppression définitive (profil + compte de connexion) : passe par la
// fonction serveur api/supprimer-mannequin.js, seule à détenir la clé
// secrète Supabase nécessaire pour supprimer un compte auth.users — une
// simple suppression de model_profiles laisserait le mannequin se
// reconnecter et recréer une fiche vide (Store.ensureProfileRow()).
async function supprimerMannequin(modelId, nom) {
  const saisie = prompt(`Suppression DÉFINITIVE et IRRÉVERSIBLE du profil et du compte de connexion de "${nom}".\n\nPour confirmer, tapez SUPPRIMER en majuscules :`);
  if (saisie === null) return;
  if (saisie !== 'SUPPRIMER') { alert('Suppression annulée : le texte tapé ne correspondait pas exactement à "SUPPRIMER" (majuscules, sans espace).'); return; }

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { alert('Session expirée — reconnectez-vous puis réessayez.'); return; }

  try {
    const reponse = await fetch('/api/supprimer-mannequin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ modelId })
    });
    const resultat = await reponse.json().catch(() => ({}));
    if (!reponse.ok) { alert('Échec de la suppression : ' + (resultat.error || 'erreur inconnue.')); return; }
    alert(`Le profil et le compte de "${nom}" ont été supprimés définitivement.`);
    void chargerListeMannequinsPublies();
  } catch (e) {
    alert('Échec de la suppression : ' + e.message);
  }
}

let mannequinPhotosOuvert = null;
let indexPhotoMannequinARemplacer = null;
let modalPhotosEstOuverte = false;

async function ouvrirPhotosMannequin(modelId, nom) {
  mannequinPhotosOuvert = modelId;
  document.getElementById('mpm-titre').textContent = nom;
  document.getElementById('mpm-photo-ajout-msg').style.display = 'none';
  document.getElementById('modal-photos-mannequin').classList.add('ouvert');
  if (!modalPhotosEstOuverte) { modalPhotosEstOuverte = true; window.verrouillerDefilement(); }
  await rafraichirPhotosMannequin();
}
function fermerPhotosMannequin() {
  document.getElementById('modal-photos-mannequin').classList.remove('ouvert');
  if (modalPhotosEstOuverte) { modalPhotosEstOuverte = false; window.deverrouillerDefilement(); }
}

async function rafraichirPhotosMannequin() {
  if (!mannequinPhotosOuvert) return;
  const conteneur = document.getElementById('mpm-photos');
  conteneur.innerHTML = '<span class="mf-photos-msg">Chargement des photos…</span>';

  const { data: photos } = await sb.from('model_photos').select('id, url, url_miniature, chemin, chemin_miniature, chemin_moyenne, principale, compcard_ordre, categorie').eq('model_id', mannequinPhotosOuvert).order('created_at', { ascending: true });
  if (!photos || !photos.length) { conteneur.innerHTML = '<span class="mf-photos-msg">Aucune photo pour ce mannequin.</span>'; return; }

  const urls = photos.map(p => p.url_miniature || p.url);
  // Compcard choisie par l'agence (06/10/2026) : une liste sous chaque photo pour la
  // placer sur une case 1 à 5 (case 1 = grande photo). Cases vides complétées
  // automatiquement avec les autres photos du Book, comme dans l'Espace mannequin.
  const optionsCc = (n) => ['<option value="">Compcard —</option>'].concat([1, 2, 3, 4, 5].map(c => `<option value="${c}"${n === c ? ' selected' : ''}>Compcard ${c}${c === 1 ? ' (grande)' : ''}</option>`)).join('');
  conteneur.innerHTML = '<p class="mf-cc-aide">Compcard : choisissez sous chaque photo sa case (1 à 5). La case 1 est la grande photo. Le second choix range la photo dans le Book ou dans Lifestyle.</p>' + photos.map((p, i) => `
    <div class="mf-photo-bloc"><div class="mf-photo-vignette">
      <img src="${echapperHtml(urls[i])}" data-index="${i}" alt="Photo" title="${p.principale ? 'Photo de profil' : ''}">
      <button class="mf-photo-remplacer" data-photo-id="${p.id}" data-chemin="${echapperHtml(p.chemin || '')}" data-chemin-miniature="${echapperHtml(p.chemin_miniature || '')}" data-chemin-moyenne="${echapperHtml(p.chemin_moyenne || '')}" title="Remplacer cette photo">⇄</button>
      <button class="mf-photo-suppr" data-photo-id="${p.id}" data-chemin="${echapperHtml(p.chemin || '')}" data-chemin-miniature="${echapperHtml(p.chemin_miniature || '')}" data-chemin-moyenne="${echapperHtml(p.chemin_moyenne || '')}" title="Supprimer cette photo">✕</button>
    </div><select class="mf-cc-select" data-photo-id="${p.id}" aria-label="Case de la compcard">${optionsCc(p.compcard_ordre)}</select>
    <select class="mf-cc-select mf-cat-select" data-photo-id="${p.id}" aria-label="Catégorie de la photo"><option value="book"${p.categorie === 'lifestyle' ? '' : ' selected'}>📒 Book</option><option value="lifestyle"${p.categorie === 'lifestyle' ? ' selected' : ''}>🌿 Lifestyle</option></select></div>
  `).join('');
  // Catégorie Book / Lifestyle (classement du site, corrigeable par l'agence)
  conteneur.querySelectorAll('.mf-cat-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      sel.disabled = true;
      if (!await enregistrerCategoriePhoto(sel.dataset.photoId, sel.value)) alert('La catégorie n’a pas pu être enregistrée. Réessayez plus tard.');
      await rafraichirPhotosMannequin();
    });
  });
  conteneur.querySelectorAll('.mf-cc-select:not(.mf-cat-select)').forEach(sel => {
    sel.addEventListener('change', async () => {
      sel.disabled = true;
      const erreur = await affecterCaseCompcard(mannequinPhotosOuvert, sel.dataset.photoId, sel.value ? Number(sel.value) : null);
      if (erreur) alert('Erreur lors de l’enregistrement de la compcard : ' + erreur.message);
      await rafraichirPhotosMannequin();
    });
  });

  conteneur.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', () => ouvrirGalerieLightbox(urls, Number(img.dataset.index)));
  });
  conteneur.querySelectorAll('.mf-photo-suppr').forEach(btn => {
    btn.addEventListener('click', () => supprimerPhotoMannequin(btn));
  });
  conteneur.querySelectorAll('.mf-photo-remplacer').forEach(btn => {
    btn.addEventListener('click', () => {
      indexPhotoMannequinARemplacer = { id: btn.dataset.photoId, chemin: btn.dataset.chemin || null, cheminMiniature: btn.dataset.cheminMiniature || null, cheminMoyenne: btn.dataset.cheminMoyenne || null };
      document.getElementById('mpm-photo-remplacement-input').click();
    });
  });
}

async function supprimerPhotoMannequin(bouton) {
  if (!confirm('Supprimer définitivement cette photo ? Cette action est irréversible.')) return;
  const chemin = bouton.dataset.chemin;
  const cheminMiniature = bouton.dataset.cheminMiniature;
  const cheminMoyenne = bouton.dataset.cheminMoyenne;
  bouton.disabled = true;
  // D'abord la fiche en base, puis seulement les fichiers : dans l'autre ordre,
  // un échec de la base laissait une photo listée mais dont le fichier n'existait plus.
  const { error } = await sb.from('model_photos').delete().eq('id', bouton.dataset.photoId);
  if (error) { alert('Erreur lors de la suppression : ' + error.message); bouton.disabled = false; return; }
  if (chemin) await supprimerDeR2(mannequinPhotosOuvert, chemin);
  if (cheminMiniature) await supprimerDeR2(mannequinPhotosOuvert, cheminMiniature);
  if (cheminMoyenne) await supprimerDeR2(mannequinPhotosOuvert, cheminMoyenne);
  await rafraichirPhotosMannequin();
  void chargerListeMannequinsPublies(); mannequinsPubliesCharges = false;
}


document.getElementById('mpm-photo-input').addEventListener('change', async (e) => {
  const fichiers = Array.from(e.target.files || []);
  e.target.value = '';
  const modelId = mannequinPhotosOuvert; // gardé : la fenêtre peut être fermée pendant l'envoi
  if (!fichiers.length || !modelId) return;
  const msg = document.getElementById('mpm-photo-ajout-msg');
  msg.style.display = 'block'; msg.className = 'form-msg';

  let reussies = 0;
  for (let i = 0; i < fichiers.length; i++) {
    msg.textContent = `Envoi ${i + 1}/${fichiers.length}…`;
    try {
      const { chemin, url, cheminMiniature, urlMiniature, cheminMoyenne, urlMoyenne, categorie } = await envoyerPhotoBook(modelId, fichiers[i]);
      const { data: ligne, error } = await sb.from('model_photos').insert({ model_id: modelId, url, chemin, url_miniature: urlMiniature, chemin_miniature: cheminMiniature, url_moyenne: urlMoyenne, chemin_moyenne: cheminMoyenne, originale_optimisee: true, categorie }).select('id').single();
      if (error) throw error;
      reussies++;
    } catch (err) {
      console.error('Envoi photo échoué :', err);
    }
  }
  msg.className = reussies === fichiers.length ? 'form-msg ok' : 'form-msg err';
  msg.textContent = `${reussies}/${fichiers.length} photo(s) envoyée(s).`;
  await rafraichirPhotosMannequin();
  mannequinsPubliesCharges = false;
});

document.getElementById('mpm-photo-remplacement-input').addEventListener('change', async (e) => {
  const fichier = e.target.files[0];
  e.target.value = '';
  const modelId = mannequinPhotosOuvert; // gardé : la fenêtre peut être fermée pendant l'envoi
  if (!fichier || !indexPhotoMannequinARemplacer || !modelId) return;
  const { id, chemin, cheminMiniature, cheminMoyenne } = indexPhotoMannequinARemplacer;
  const msg = document.getElementById('mpm-photo-ajout-msg');
  msg.style.display = 'block'; msg.className = 'form-msg'; msg.textContent = 'Envoi de la photo de remplacement…';

  try {
    const nouvelle = await envoyerPhotoBook(modelId, fichier);
    // D'abord la fiche en base, puis seulement les anciens fichiers : si la base refuse,
    // l'ancienne photo reste intacte (avant le 07/10/2026, elle était déjà effacée).
    const { error } = await sb.from('model_photos').update({ url: nouvelle.url, chemin: nouvelle.chemin, url_miniature: nouvelle.urlMiniature, chemin_miniature: nouvelle.cheminMiniature, url_moyenne: nouvelle.urlMoyenne, chemin_moyenne: nouvelle.cheminMoyenne, categorie: nouvelle.categorie }).eq('id', id);
    if (error) {
      // Refus de la base : on retire les fichiers qu'on vient d'envoyer (aucune fiche ne les
      // utilise) ; l'ancienne photo, elle, n'a pas bougé.
      for (const c of [nouvelle.chemin, nouvelle.cheminMiniature, nouvelle.cheminMoyenne]) if (c) await supprimerDeR2(modelId, c);
      throw error;
    }
    for (const c of [chemin, cheminMiniature, cheminMoyenne]) if (c) await supprimerDeR2(modelId, c);
    msg.className = 'form-msg ok'; msg.textContent = 'Photo remplacée.';
    await rafraichirPhotosMannequin();
    mannequinsPubliesCharges = false;
  } catch (err) {
    msg.className = 'form-msg err'; msg.textContent = "Échec du remplacement : " + err.message;
  }
  indexPhotoMannequinARemplacer = null;
});

document.getElementById('modal-photos-mannequin-fermer').addEventListener('click', () => {
  fermerPhotosMannequin();
  mannequinPhotosOuvert = null;
});
document.getElementById('modal-photos-mannequin').addEventListener('click', (e) => {
  if (e.target.id === 'modal-photos-mannequin') { fermerPhotosMannequin(); mannequinPhotosOuvert = null; }
});

// URL_SCRIPT_PHOTOS_CASTING et fichierEnBase64 (js/app.js) : même script Google Apps Script
// que les formulaires publics, pour ajouter/remplacer une photo depuis la fiche d'un dossier.
const DOSSIERS = {
  casting: {
    table: 'casting_applications', photosTable: 'casting_photos', photosColonne: 'application_id', bucket: 'casting-applications',
    // « Vue » retiré le 30/09 (faisait double emploi avec « En étude » ; Extension 103).
    statutChamp: 'status', statuts: ['nouvelle', 'en étude', 'en attente', 'retenue', 'refusée'],
    libellesStatut: { nouvelle: 'Nouvelle', vue: 'Vue', 'en étude': 'En étude', 'en attente': 'En attente', retenue: 'Retenue', 'refusée': 'Refusée' },
    filtreParDefaut: 'nouvelle',
    listeId: 'liste-candidatures', filtresId: 'filtres-candidatures', compteurId: 'candidatures-compteur', plusBtnId: 'candidatures-plus-btn',
    titrePluriel: 'candidature(s)'
  },
  inscription: {
    table: 'inscriptions_mannequins', photosTable: 'inscriptions_photos', photosColonne: 'inscription_id', bucket: 'inscriptions-photos',
    statutChamp: 'statut', statuts: ['en attente de paiement', 'dossier en vérification', 'payée', 'annulée'],
    // Libellés alignés sur le cahier des charges (PAIEMENT À VÉRIFIER / DOSSIER EN VÉRIFICATION /
    // INSCRIPTION VALIDÉE / REFUSÉE) — les valeurs stockées en base restent inchangées pour ne pas
    // toucher à la policy RLS de sécurité qui vérifie explicitement 'en attente de paiement'
    // (voir Extension 58 dans supabase-extension.sql).
    libellesStatut: { 'en attente de paiement': 'Paiement à vérifier', 'dossier en vérification': 'Dossier en vérification', 'payée': 'Inscription validée', 'annulée': 'Refusée' },
    filtreParDefaut: 'en attente de paiement',
    listeId: 'liste-inscriptions', filtresId: 'filtres-inscriptions', compteurId: 'inscriptions-compteur', plusBtnId: 'inscriptions-plus-btn',
    titrePluriel: 'inscription(s)'
  },
  recruteur: {
    table: 'recruiter_requests', photosTable: null, photosColonne: null, bucket: null,
    statutChamp: 'status', statuts: ['nouvelle', 'vue', 'traitée'],
    libellesStatut: { nouvelle: 'Nouvelle', vue: 'Vue', 'traitée': 'Traitée' },
    filtreParDefaut: 'nouvelle',
    listeId: 'liste-recruteurs', filtresId: 'filtres-recruteurs', compteurId: 'recruteurs-compteur', plusBtnId: 'recruteurs-plus-btn',
    titrePluriel: 'demande(s)'
  }
};
const ETAT_DOSSIERS = {
  casting: { filtre: DOSSIERS.casting.filtreParDefaut, page: 0 },
  inscription: { filtre: DOSSIERS.inscription.filtreParDefaut, page: 0 },
  recruteur: { filtre: DOSSIERS.recruteur.filtreParDefaut, page: 0 }
};
const PAR_PAGE = 12;

function classeStatut(valeur) {
  return 'statut-' + valeur.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function chargerCompteurs(source) {
  const conf = DOSSIERS[source];
  const total = await new Promise(r => sb.from(conf.table).select('id', { count: 'exact', head: true }).then(({ count }) => r(count || 0)));
  const parStatut = {};
  await Promise.all(conf.statuts.map(async (s) => {
    const { count } = await sb.from(conf.table).select('id', { count: 'exact', head: true }).eq(conf.statutChamp, s);
    parStatut[s] = count || 0;
  }));
  return { total, parStatut };
}

async function chargerCandidatures() { await afficherDossiers('casting'); }
async function chargerInscriptions() { await afficherDossiers('inscription'); }
async function chargerRecruteurs() { await afficherDossiers('recruteur'); }

function nomAffiche(source, d) {
  if (source === 'recruteur') return d.contact_name || d.company || 'Sans nom';
  return d.full_name || 'Sans nom';
}
function sousLigneAffichee(source, d) {
  if (source === 'recruteur') return d.company || d.email || '';
  return d.email || d.phone || '';
}
function libelleTypeCandidature(d) {
  if (d.type_candidature === 'projet') return d.projet_nom || 'Projet';
  if (d.type_candidature === 'agence') return "Intégrer l'agence";
  return null;
}
function metaAffichee(source, d) {
  if (source === 'recruteur') return [d.project_type, new Date(d.created_at).toLocaleDateString('fr-FR')].filter(Boolean).join(' · ');
  if (source === 'casting') return [libelleTypeCandidature(d), d.experience_mannequin === 'non' ? 'Débutant·e' : null, d.city, new Date(d.created_at).toLocaleDateString('fr-FR')].filter(Boolean).join(' · ');
  return [d.city, new Date(d.created_at).toLocaleDateString('fr-FR')].filter(Boolean).join(' · ');
}

function calculerAge(dateNaissance) {
  if (!dateNaissance) return null;
  const naissance = new Date(dateNaissance);
  if (isNaN(naissance)) return null;
  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - naissance.getFullYear();
  const pasEncoreAnniversaire = aujourdhui < new Date(aujourdhui.getFullYear(), naissance.getMonth(), naissance.getDate());
  if (pasEncoreAnniversaire) age -= 1;
  return age;
}

function lienWhatsApp(numero) {
  let chiffres = String(numero || '').replace(/[^\d]/g, '');
  if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
  // Numéro ivoirien saisi sans l'indicatif (« 07 07 … » ou ancien format à 8 chiffres).
  if ((chiffres.length === 10 && chiffres.startsWith('0')) || chiffres.length === 8) chiffres = '225' + chiffres;
  return chiffres ? `https://wa.me/${chiffres}` : null;
}

let CATEGORIES_DONNEES = { hommes: [], femmes: [], enfants: [] };
async function chargerRepartitionCategories() {
  const [{ data: candidatures }, { data: inscriptions }] = await Promise.all([
    sb.from('casting_applications').select('id, full_name, genre, date_naissance, phone').limit(5000),
    sb.from('inscriptions_mannequins').select('id, full_name, genre, date_naissance, phone').limit(5000)
  ]);

  CATEGORIES_DONNEES = { hommes: [], femmes: [], enfants: [] };
  const tous = [
    ...(candidatures || []).map(d => ({ ...d, source: 'casting' })),
    ...(inscriptions || []).map(d => ({ ...d, source: 'inscription' }))
  ];
  tous.forEach(d => {
    const age = calculerAge(d.date_naissance);
    const entree = { ...d, age };
    if (age !== null && age < 18) CATEGORIES_DONNEES.enfants.push(entree);
    else if (d.genre === 'homme') CATEGORIES_DONNEES.hommes.push(entree);
    else if (d.genre === 'femme') CATEGORIES_DONNEES.femmes.push(entree);
  });

  // Widget donut "Répartition des profils" : remplace les pourcentages fixes posés par
  // défaut (68 % / 22 % / 10 %) par les vrais chiffres calculés ci-dessus — aucune
  // statistique affichée ne doit être inventée.
  const totalCategories = CATEGORIES_DONNEES.hommes.length + CATEGORIES_DONNEES.femmes.length + CATEGORIES_DONNEES.enfants.length;
  const pourcentage = (n) => totalCategories ? Math.round((n / totalCategories) * 100) : 0;
  const pFemmes = pourcentage(CATEGORIES_DONNEES.femmes.length);
  const pHommes = pourcentage(CATEGORIES_DONNEES.hommes.length);
  const pEnfants = 100 - pFemmes - pHommes;
  const legende = document.querySelector('.ref-distribution .ref-legend');
  if (legende) {
    const femmesB = legende.querySelector('.f b');
    const hommesB = legende.querySelector('.h b');
    const enfantsB = legende.querySelector('.e b');
    if (femmesB) femmesB.textContent = pFemmes + '%';
    if (hommesB) hommesB.textContent = pHommes + '%';
    if (enfantsB) enfantsB.textContent = pEnfants + '%';
  }
  const donutEl = document.querySelector('.ref-distribution .ref-donut');
  if (donutEl && totalCategories) {
    donutEl.style.background = `conic-gradient(#d9234e 0 ${pFemmes}%, #8d7c7f ${pFemmes}% ${pFemmes + pHommes}%, #e8a83d ${pFemmes + pHommes}% 100%)`;
  }
  const totalProfilsEl = document.getElementById('rf-total-profils');
  if (totalProfilsEl) totalProfilsEl.textContent = totalCategories;
}

async function afficherDossiers(source, ajouter) {
  const conf = DOSSIERS[source];
  const etat = ETAT_DOSSIERS[source];
  const conteneur = document.getElementById(conf.listeId);
  const plusBtn = document.getElementById(conf.plusBtnId);

  const { total, parStatut } = await chargerCompteurs(source);
  document.getElementById(conf.compteurId).textContent = `${total} au total`;

  const filtresHtml = ['toutes', ...conf.statuts].map(s => {
    const label = s === 'toutes' ? 'Toutes' : conf.libellesStatut[s];
    const compte = s === 'toutes' ? total : (parStatut[s] || 0);
    return `<button class="filtre-pill ${etat.filtre === s ? 'actif' : ''}" data-source="${source}" data-filtre="${s}">${label} <span class="compte">${compte}</span></button>`;
  }).join('');
  document.getElementById(conf.filtresId).innerHTML = filtresHtml;

  let requete = sb.from(conf.table).select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (etat.filtre !== 'toutes') requete = requete.eq(conf.statutChamp, etat.filtre);
  requete = requete.range(etat.page * PAR_PAGE, etat.page * PAR_PAGE + PAR_PAGE - 1);

  const { data: dossiers, count } = await requete;

  const html = (dossiers || []).map(d => {
    const age = (source === 'inscription' || source === 'casting') ? calculerAge(d.date_naissance) : null;
    const estMineur = age !== null && age < 18;
    // Mineur : le bouton WhatsApp ouvre la conversation avec son parent (07/10/2026).
    const contacts = contactsFiche(source, d);
    const lienWa = lienWhatsApp(contacts.phone);
    return `
    <div class="dossier-carte" data-source="${source}" data-id="${d.id}">
      <div class="dc-nom">${echapperHtml(nomAffiche(source, d))} ${estMineur ? '<span class="badge-mineur">Mineur</span>' : ''}<span>${echapperHtml(sousLigneAffichee(source, d))}</span></div>
      <div class="dc-meta">${echapperHtml(metaAffichee(source, d))}</div>
      <span class="statut-pill ${classeStatut(d[conf.statutChamp])}">${echapperHtml(conf.libellesStatut[d[conf.statutChamp]] || d[conf.statutChamp] || '')}</span>
      ${lienWa ? `<a href="${lienWa}" target="_blank" rel="noopener" class="btn dc-whatsapp tdb-48">${contacts.parent ? 'WhatsApp parent ↗' : 'WhatsApp ↗'}</a>` : ''}
      <span class="dc-fleche">→</span>
    </div>
  `;
  }).join('');

  if (ajouter) conteneur.insertAdjacentHTML('beforeend', html);
  else conteneur.innerHTML = html || `<div class="dossiers-vide">Aucun dossier dans "${etat.filtre === 'toutes' ? 'toutes' : conf.libellesStatut[etat.filtre]}" pour le moment.</div>`;

  const dejaAffiches = (etat.page + 1) * PAR_PAGE;
  plusBtn.style.display = (count && count > dejaAffiches) ? 'block' : 'none';
}

document.addEventListener('click', (e) => {
  const pill = e.target.closest('.filtre-pill');
  if (pill) {
    const source = pill.dataset.source;
    ETAT_DOSSIERS[source].filtre = pill.dataset.filtre;
    ETAT_DOSSIERS[source].page = 0;
    void afficherDossiers(source);
    return;
  }
  const plusBtn = e.target.closest('.dossiers-plus');
  if (plusBtn) {
    const source = plusBtn.id.startsWith('candidatures') ? 'casting' : (plusBtn.id.startsWith('inscriptions') ? 'inscription' : 'recruteur');
    ETAT_DOSSIERS[source].page += 1;
    void afficherDossiers(source, true);
    return;
  }
  if (e.target.closest('.dc-whatsapp')) return;
  const carte = e.target.closest('.dossier-carte');
  if (carte && carte.dataset.source) {
    void ouvrirFicheDossier(carte.dataset.source, carte.dataset.id);
  }
});

const CHAMPS_CASTING = [
  ['experience_mannequin', 'Parcours'], ['video_url', 'Vidéo de présentation'],
  ['email', 'E-mail'], ['phone', 'Téléphone'], ['genre', 'Genre'], ['civilite', 'Civilité'], ['city', 'Ville'], ['quartier', 'Quartier'], ['date_naissance', 'Date de naissance'],
  ['situation_scolaire', 'Situation scolaire'], ['niveau_etudes', "Niveau d'études"],
  ['height_cm', 'Taille', 'cm'], ['weight_kg', 'Poids', 'kg'], ['clothing_size', 'Taille vêtements'], ['chest_cm', 'Poitrine', 'cm'], ['waist_cm', 'Taille (tour)', 'cm'],
  ['hips_cm', 'Tour de bassin', 'cm'], ['shoe_size', 'Pointure'],
  ['parent_nom', 'Nom du parent/tuteur'], ['parent_telephone', 'WhatsApp du parent/tuteur'], ['parent_email', 'E-mail du parent/tuteur']
];
const CHAMPS_INSCRIPTION = [
  ['phone', 'Téléphone'], ['email', 'E-mail'], ['instagram', 'Instagram'], ['date_naissance', 'Date de naissance'],
  ['genre', 'Genre'], ['civilite', 'Civilité'], ['height_cm', 'Taille', 'cm'], ['clothing_size', 'Taille vêtements'], ['code_utilise', "Code d'accès utilisé"],
  ['reference_paiement', 'Référence de paiement Wave'],
  ['parent_nom', 'Nom du parent/tuteur'], ['parent_telephone', 'WhatsApp du parent/tuteur'], ['parent_email', 'E-mail du parent/tuteur']
];
const CHAMPS_RECRUTEUR = [
  ['company', 'Entreprise / marque'], ['email', 'E-mail'], ['phone', 'Téléphone'], ['whatsapp', 'WhatsApp'],
  ['city', 'Ville'], ['project_type', 'Type de projet'], ['event_date', 'Date souhaitée']
];
const TITRE_SOURCE = { casting: 'Candidature', inscription: 'Inscription', recruteur: 'Demande recruteur' };

let ficheOuverte = null;
let modalDossierEstOuverte = false;

async function ouvrirFicheDossier(source, id) {
  const conf = DOSSIERS[source];
  const { data: d } = await sb.from(conf.table).select('*').eq('id', id).single();
  if (!d) return;

  ficheOuverte = { source, id, d };
  preparerMessageWhatsApp(source, d);
  document.getElementById('mf-notification').style.display = 'none';
  document.getElementById('mf-notification-statut').textContent = '';
  const champs = source === 'casting' ? CHAMPS_CASTING : (source === 'inscription' ? CHAMPS_INSCRIPTION : CHAMPS_RECRUTEUR);

  const age = (source === 'inscription' || source === 'casting') ? calculerAge(d.date_naissance) : null;
  const estMineur = age !== null && age < 18;
  document.getElementById('mf-titre').innerHTML = `${echapperHtml(nomAffiche(source, d))} ${estMineur ? '<span class="badge-mineur">Mineur' + (age !== null ? ' — ' + age + ' ans' : '') + '</span>' : ''}`;
  const typeCandidatureTxt = source === 'casting' ? libelleTypeCandidature(d) : null;
  document.getElementById('mf-sous-titre').textContent = `${TITRE_SOURCE[source]} reçue le ${new Date(d.created_at).toLocaleDateString('fr-FR')}` + (typeCandidatureTxt ? ` · Postule pour : ${typeCandidatureTxt}` : '');

  document.getElementById('mf-champs').innerHTML = champs.map(([cle, label, unite]) => {
    const valeur = d[cle];
    if (!valeur) return '';
    // Mineur (07/10/2026) : on écrit au parent. Le lien WhatsApp est sur le numéro du
    // parent ; celui de l'enfant est affiché sans lien, avec un rappel.
    const parentJoignable = estMineur && (source === 'casting' || source === 'inscription') && d.parent_telephone;
    const lienWa = (parentJoignable ? cle === 'parent_telephone' : (cle === 'phone' || cle === 'whatsapp')) ? lienWhatsApp(valeur) : null;
    const rappelMineur = parentJoignable && cle === 'phone' ? ' <small>(mineur : écrire au parent)</small>' : '';
    // Candidatures depuis le 30/09 : parcours, études et vidéo (lien Google Drive).
    const TEXTES_SPECIAUX = {
      experience_mannequin: { non: 'Débutant·e (jamais été mannequin)', oui: 'Déjà mannequin' },
      situation_scolaire: { 'en cours': 'Encore élève / étudiant(e)', "plus à l'école": "N'est plus à l'école", 'jamais scolarisé(e)': 'Jamais scolarisé(e)' }
    };
    const estVideo = cle === 'video_url' && /^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view$/.test(String(valeur));
    const affichage = lienWa
      ? `<a href="${lienWa}" target="_blank" rel="noopener" class="tdb-49">${echapperHtml(String(valeur))} ↗ WhatsApp</a>`
      : estVideo
        ? `<a href="${echapperHtml(String(valeur))}" target="_blank" rel="noopener" class="tdb-49">▶ Voir la vidéo</a>`
        : `${echapperHtml(String((TEXTES_SPECIAUX[cle] && TEXTES_SPECIAUX[cle][valeur]) || valeur))}${unite ? ' ' + unite : ''}${rappelMineur}`;
    return `<div class="mf-champ"><div class="mf-label">${label}</div><div class="mf-valeur">${affichage}</div></div>`;
  }).join('');

  const messageEl = document.getElementById('mf-message');
  if (d.message) { messageEl.style.display = 'block'; messageEl.textContent = d.message; }
  else { messageEl.style.display = 'none'; }

  const statutSelect = document.getElementById('mf-statut-select');
  statutSelect.innerHTML = conf.statuts.map(s => `<option value="${s}" ${d[conf.statutChamp] === s ? 'selected' : ''}>${conf.libellesStatut[s]}</option>`).join('');

  const photosEl = document.getElementById('mf-photos');
  const mannequinsEl = document.getElementById('mf-mannequins');
  const ajoutPhotoEl = document.getElementById('mf-ajout-photo');
  document.getElementById('modal-dossier').classList.add('ouvert');
  if (!modalDossierEstOuverte) { modalDossierEstOuverte = true; window.verrouillerDefilement(); }

  if (source === 'recruteur') {
    photosEl.style.display = 'none';
    ajoutPhotoEl.style.display = 'none';
    mannequinsEl.style.display = 'block';
    await chargerMannequinsSelection(id);
    return;
  }

  mannequinsEl.innerHTML = '';
  mannequinsEl.style.display = 'none';
  photosEl.style.display = 'flex';
  ajoutPhotoEl.style.display = 'block';
  document.getElementById('mf-photo-ajout-msg').style.display = 'none';
  photosEl.innerHTML = '<span class="mf-photos-msg">Chargement des photos…</span>';

  await rafraichirPhotosDossier();
}

async function rafraichirPhotosDossier() {
  if (!ficheOuverte || ficheOuverte.source === 'recruteur') return;
  const conf = DOSSIERS[ficheOuverte.source];
  const photosEl = document.getElementById('mf-photos');

  const { data: photos } = await sb.from(conf.photosTable).select('id, chemin, url').eq(conf.photosColonne, ficheOuverte.id);
  if (!photos || !photos.length) { photosEl.innerHTML = '<span class="mf-photos-msg">Aucune photo jointe.</span>'; return; }

  const chemins = photos.map(p => p.chemin).filter(Boolean);
  const { data: signees } = chemins.length ? await sb.storage.from(conf.bucket).createSignedUrls(chemins, 300) : { data: [] };
  const urlParChemin = {};
  (signees || []).forEach(s => { if (s.path && s.signedUrl) urlParChemin[s.path] = s.signedUrl; });
  const urls = photos.map(p => p.chemin ? (urlParChemin[p.chemin] || '') : (p.url || ''));

  photosEl.innerHTML = photos.map((p, i) => `
    <div class="mf-photo-vignette">
      <img src="${echapperHtml(urls[i])}" data-index="${i}" alt="Photo">
      <button class="mf-photo-remplacer" data-photo-id="${p.id}" data-chemin="${echapperHtml(p.chemin || '')}" title="Remplacer cette photo">⇄</button>
      <button class="mf-photo-suppr" data-photo-id="${p.id}" data-chemin="${echapperHtml(p.chemin || '')}" title="Supprimer cette photo">✕</button>
    </div>
  `).join('');
  photosEl.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', () => ouvrirGalerieLightbox(urls, Number(img.dataset.index)));
  });
  photosEl.querySelectorAll('.mf-photo-suppr').forEach(btn => {
    btn.addEventListener('click', () => supprimerPhotoDossier(btn));
  });
  photosEl.querySelectorAll('.mf-photo-remplacer').forEach(btn => {
    btn.addEventListener('click', () => remplacerPhotoDossier(btn));
  });
}

async function chargerMannequinsSelection(requestId) {
  const mannequinsEl = document.getElementById('mf-mannequins');
  mannequinsEl.innerHTML = 'Chargement des mannequins sélectionnés…';
  const { data: choisis } = await sb.from('recruiter_request_models').select('id, model_id, model_name_snapshot, model_height_snapshot').eq('request_id', requestId);
  mannequinsEl.innerHTML = (choisis && choisis.length)
    ? choisis.map(m => `
        <div class="mf-mannequin-item">
          <span>${echapperHtml(m.model_name_snapshot || 'Mannequin')}${m.model_height_snapshot ? ' — ' + m.model_height_snapshot + ' cm' : ''}</span>
          <span class="tdb-52">
            ${m.model_id ? `<a href="mannequin.html?id=${m.model_id}" target="_blank">Voir la fiche →</a>` : ''}
            <button class="mf-retirer-mannequin" data-selection-id="${m.id}" title="Retirer ce mannequin de la sélection">✕</button>
          </span>
        </div>`).join('')
    : '<div class="mf-mannequin-item">Aucun mannequin dans cette sélection.</div>';

  mannequinsEl.querySelectorAll('.mf-retirer-mannequin').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Retirer ce mannequin de la sélection de ce recruteur ?')) return;
      await sb.from('recruiter_request_models').delete().eq('id', btn.dataset.selectionId);
      void chargerMannequinsSelection(requestId);
    });
  });
}

async function supprimerPhotoDossier(bouton) {
  if (!ficheOuverte) return;
  if (!confirm('Supprimer définitivement cette photo ? Cette action est irréversible.')) return;

  const conf = DOSSIERS[ficheOuverte.source];
  const photoId = bouton.dataset.photoId;
  const chemin = bouton.dataset.chemin;

  bouton.disabled = true;
  // Base d'abord, fichier ensuite (voir supprimerPhotoMannequin).
  const { error } = await sb.from(conf.photosTable).delete().eq('id', photoId);

  if (error) { alert('Erreur lors de la suppression.'); bouton.disabled = false; return; }
  if (chemin) await sb.storage.from(conf.bucket).remove([chemin]);
  bouton.closest('.mf-photo-vignette').remove();
  if (!document.getElementById('mf-photos').children.length) {
    document.getElementById('mf-photos').innerHTML = '<span class="mf-photos-msg">Aucune photo jointe.</span>';
  }
}

// ===================================================================
// Ajout/remplacement d'une seule photo sur un dossier déjà existant, sans
// obliger à renvoyer tout le dossier (cahier des charges, étape 5). Réutilise
// le même script Google Apps Script que les formulaires publics — chaque
// nouvelle photo part dans le même sous-dossier Drive que les photos déjà
// envoyées pour ce dossier (organisation par catégorie déjà en place).
//
// Limite honnête : en cas de remplacement, l'ancien fichier reste dans
// Google Drive (ce pipeline ne sait qu'ajouter des fichiers, pas en
// supprimer côté Drive) — seule la référence affichée dans le tableau de
// bord est remplacée. Le doublon Drive n'est donc pas évité à 100 %.

function typeEtProjetPourFiche() {
  const d = ficheOuverte.d;
  if (ficheOuverte.source === 'inscription') return { type: 'inscription', projet: '' };
  return { type: d.type_candidature || 'agence', projet: d.projet_nom || '' };
}

async function envoyerPhotoVersDrive(fichier) {
  const { type, projet } = typeEtProjetPourFiche();
  const base64 = await fichierEnBase64(fichier);
  const reponse = await fetch(URL_SCRIPT_PHOTOS_CASTING, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ nom: ficheOuverte.d.full_name, email: ficheOuverte.d.email || '', phone: ficheOuverte.d.phone || '', type, projet, photos: [base64] })
  });
  const resultat = await reponse.json();
  if (!resultat.ok || !Array.isArray(resultat.liens) || !resultat.liens.length) {
    throw new Error(resultat.erreur || "Le script Google n'a renvoyé aucun lien.");
  }
  return resultat.liens[0];
}

document.getElementById('mf-photo-input').addEventListener('change', async (e) => {
  const fichier = e.target.files[0];
  e.target.value = '';
  if (!fichier || !ficheOuverte) return;
  const conf = DOSSIERS[ficheOuverte.source];
  const msg = document.getElementById('mf-photo-ajout-msg');
  msg.style.display = 'inline'; msg.className = 'form-msg'; msg.textContent = 'Envoi vers Google Drive…';

  try {
    const lien = await envoyerPhotoVersDrive(fichier);
    const { error } = await sb.from(conf.photosTable).insert({ [conf.photosColonne]: ficheOuverte.id, url: lien, chemin: null });
    if (error) throw error;
    msg.className = 'form-msg ok'; msg.textContent = 'Photo ajoutée.';
    await rafraichirPhotosDossier();
  } catch (err) {
    msg.className = 'form-msg err'; msg.textContent = "Échec de l'envoi : " + err.message;
  }
});

let photoARemplacerId = null, photoARemplacerChemin = null;
document.getElementById('mf-photo-remplacement-input').addEventListener('change', async (e) => {
  const fichier = e.target.files[0];
  e.target.value = '';
  if (!fichier || !ficheOuverte || !photoARemplacerId) return;
  const conf = DOSSIERS[ficheOuverte.source];
  const msg = document.getElementById('mf-photo-ajout-msg');
  msg.style.display = 'inline'; msg.className = 'form-msg'; msg.textContent = 'Envoi de la photo de remplacement…';

  try {
    const lien = await envoyerPhotoVersDrive(fichier);
    if (photoARemplacerChemin) await sb.storage.from(conf.bucket).remove([photoARemplacerChemin]);
    const { error } = await sb.from(conf.photosTable).update({ url: lien, chemin: null }).eq('id', photoARemplacerId);
    if (error) throw error;
    msg.className = 'form-msg ok'; msg.textContent = 'Photo remplacée.';
    await rafraichirPhotosDossier();
  } catch (err) {
    msg.className = 'form-msg err'; msg.textContent = "Échec du remplacement : " + err.message;
  }
  photoARemplacerId = null; photoARemplacerChemin = null;
});

function remplacerPhotoDossier(bouton) {
  photoARemplacerId = bouton.dataset.photoId;
  photoARemplacerChemin = bouton.dataset.chemin || null;
  document.getElementById('mf-photo-remplacement-input').click();
}

function fermerFicheDossier() {
  document.getElementById('modal-dossier').classList.remove('ouvert');
  if (modalDossierEstOuverte) { modalDossierEstOuverte = false; window.deverrouillerDefilement(); }
}
document.getElementById('modal-dossier-fermer').addEventListener('click', fermerFicheDossier);
document.getElementById('modal-dossier').addEventListener('click', (e) => {
  if (e.target.id === 'modal-dossier') fermerFicheDossier();
});

// ===================================================================
// Notifications aux candidats/mannequins au changement de statut (cahier
// des charges, étapes 7-8 et 10). Modèles de messages repris mot pour mot
// du cahier — un seul canal automatique existe réellement (e-mail, via
// EmailJS) : aucune API WhatsApp officielle n'est branchée sur ce site,
// donc WhatsApp reste un lien pré-rempli à envoyer soi-même en un clic
// plutôt qu'un envoi inventé et non officiel.
// Premiers messages, proposés dès qu'on change le statut d'une candidature : textes du
// catalogue commun (js/messages-candidats.js), les mêmes que dans « Messages groupés ».
// L'e-mail reçoit la même chose sans *gras* ni _italique_ (messagePourEmail).
function premierMessageCandidat(cle) {
  return (d) => personnaliserMessage(texteMessageCandidat(messageCandidatParCle(cle), d, typeCandidature(d)), d, {}, () => '');
}
const MODELES_NOTIFICATION = {
  casting: {
    'en étude': premierMessageCandidat('etude'),
    'en attente': premierMessageCandidat('attente'),
    'retenue': premierMessageCandidat('retenue'),
    'refusée': premierMessageCandidat('refusee')
  },
  inscription: {
    'dossier en vérification': premierMessageCandidat('ins_verification'),
    'payée': premierMessageCandidat('ins_validee'),
    'annulée': premierMessageCandidat('ins_refus')
  }
};

// Message WhatsApp tout prêt depuis la fiche, sans changer le statut du dossier.
const MODELES_WHATSAPP = {
  recruteur_merci: { libelle: '🤝 Remerciement de la demande', sources: ['recruteur'],
    texte: (d) => `Bonjour ${String(d.contact_name || '').trim() || 'Madame, Monsieur'},\n\nMerci pour votre demande auprès de Maître Akesse Model Management. Notre équipe l'étudie et revient vers vous très rapidement avec une proposition de profils.\n\nBien cordialement.` },
  libre: { libelle: '✏️ Message libre', sources: ['casting', 'inscription', 'recruteur'],
    texte: (d) => d.contact_name ? `Bonjour ${String(d.contact_name).trim()},\n\n`
      : `Bonjour ${contactsEnvoi(d).parent ? salutationParent(d.parent_nom) : nomAvecCivilite(d)},\n\n` }
};
// À qui écrire depuis la fiche : candidature d'un mineur = son parent (js/messages-candidats.js).
function contactsFiche(source, d) {
  if (source === 'casting' || source === 'inscription') return contactsEnvoi(d);
  return { parent: false, email: d.email || '', phone: source === 'recruteur' ? (d.whatsapp || d.phone) : d.phone };
}
function noteParent(source, d) {
  const c = contactsFiche(source, d);
  return c.parent ? ` Personne mineure : le message part vers son parent (${salutationParent(d.parent_nom)}).` : '';
}
// Candidatures : TOUS les messages du catalogue commun (js/messages-candidats.js), les
// mêmes que dans « Messages groupés » (valeur « c:<clé> » dans la liste).
function modeleFiche(cle) {
  if (cle.indexOf('c:') !== 0) return MODELES_WHATSAPP[cle] || null;
  const m = messageCandidatParCle(cle.slice(2));
  if (!m) return null;
  return { rdv: m.rdv, texte: (d) => personnaliserMessage(texteMessageCandidat(m, d, typeCandidature(d)), d, {
    date: document.getElementById('mf-wa-date').value,
    heure: document.getElementById('mf-wa-heure').value,
    lieu: document.getElementById('mf-wa-lieu').value
  }, (k) => `[${k} à préciser]`) };
}
function majMessageWhatsApp(regenerer) {
  if (!ficheOuverte) return;
  const { source, d } = ficheOuverte;
  const modele = modeleFiche(document.getElementById('mf-wa-modele').value);
  if (!modele) return;
  document.getElementById('mf-wa-rdv').style.display = modele.rdv ? 'grid' : 'none';
  if (regenerer) document.getElementById('mf-wa-texte').value = modele.texte(d);
  const lien = lienWhatsApp(contactsFiche(source, d).phone);
  document.getElementById('mf-wa-ouvrir').href = `${lien}?text=${encodeURIComponent(document.getElementById('mf-wa-texte').value)}`;
  document.getElementById('mf-wa-email').style.display = source !== 'recruteur' && contactsFiche(source, d).email ? '' : 'none';
}
function preparerMessageWhatsApp(source, d) {
  const bloc = document.getElementById('mf-wa');
  const lien = lienWhatsApp(contactsFiche(source, d).phone);
  if (!lien) { bloc.style.display = 'none'; return; }
  const select = document.getElementById('mf-wa-modele');
  // Le 1er message part tout seul au changement de statut : il n'est pas reproposé ici.
  const catalogue = MESSAGES_CANDIDATS.filter(m => m.source === source && !m.premier).map(m => `<option value="c:${m.cle}">${m.libelle}</option>`).join('');
  select.innerHTML = catalogue + Object.entries(MODELES_WHATSAPP)
    .filter(([, m]) => m.sources.includes(source))
    .map(([cle, m]) => `<option value="${cle}">${m.libelle}</option>`).join('');
  // Proposé d'office : la convocation pour un(e) retenu(e), sinon la relance de son
  // statut ; pour une personne non retenue, le message libre.
  if (source === 'casting' || source === 'inscription') {
    const statutActuel = source === 'casting' ? d.status : d.statut;
    const m = MESSAGES_CANDIDATS.find(x => x.source === source && x.statut === statutActuel && x.groupe && !x.premier)
      || MESSAGES_CANDIDATS.find(x => x.source === source && x.statut === statutActuel && !x.premier);
    select.value = m ? 'c:' + m.cle : 'libre';
  }
  // Rendez-vous proposé : dimanche suivant, heure et lieu retenus (mêmes que « Messages groupés »).
  const rdv = infosRdvMemorisees();
  document.getElementById('mf-wa-date').value = dimancheSuivantISO();
  document.getElementById('mf-wa-heure').value = rdv.heure;
  document.getElementById('mf-wa-lieu').value = rdv.lieu;
  document.getElementById('mf-wa-statut').textContent = "WhatsApp s'ouvre avec le message déjà écrit : il ne reste qu'à appuyer sur « Envoyer »." + noteParent(source, d);
  bloc.style.display = 'block';
  majMessageWhatsApp(true);
}
document.getElementById('mf-wa-modele').addEventListener('change', () => majMessageWhatsApp(true));
['mf-wa-date', 'mf-wa-heure', 'mf-wa-lieu'].forEach(id => document.getElementById(id).addEventListener('input', () => {
  memoriserInfosRdv(document.getElementById('mf-wa-heure').value, document.getElementById('mf-wa-lieu').value);
  majMessageWhatsApp(true);
}));
// Même message par e-mail (sans les signes WhatsApp *gras* / _italique_).
document.getElementById('mf-wa-email').addEventListener('click', async () => {
  if (!ficheOuverte) return;
  const d = ficheOuverte.d, c = contactsFiche(ficheOuverte.source, d);
  if (!c.email) return;
  const statut = document.getElementById('mf-wa-statut');
  const texte = document.getElementById('mf-wa-texte').value;
  if (/\[(date|heure|lieu) à préciser\]/.test(texte)) { statut.textContent = 'Remplissez la date, l\'heure et le lieu avant d\'envoyer.'; return; }
  statut.textContent = 'Envoi en cours…';
  try {
    await envoyerEmailCandidat({ to_email: c.email, to_name: c.parent ? salutationParent(d.parent_nom) : nomAvecCivilite(d), message: messagePourEmail(texte) });
    statut.textContent = `E-mail envoyé à ${c.email}.`;
  } catch (e) {
    statut.textContent = "L'e-mail n'est pas parti" + (e && e.text ? ' (' + e.text + ')' : '') + '. Réessayez.';
  }
});
document.getElementById('mf-wa-texte').addEventListener('input', () => majMessageWhatsApp(false));
document.getElementById('mf-wa-ouvrir').addEventListener('click', () => majMessageWhatsApp(false));

function afficherPanneauNotification(source, statut, d) {
  const genere = MODELES_NOTIFICATION[source] && MODELES_NOTIFICATION[source][statut];
  const panneau = document.getElementById('mf-notification');
  if (!genere) { panneau.style.display = 'none'; return; }

  const texte = genere(d);
  document.getElementById('mf-notification-titre').textContent = `Message pour ce nouveau statut (modifiable avant envoi) :` + noteParent(source, d);
  document.getElementById('mf-notification-texte').value = texte;
  document.getElementById('mf-notification-statut').textContent = '';

  const lienWa = lienWhatsApp(contactsFiche(source, d).phone);
  const btnWa = document.getElementById('mf-notification-whatsapp');
  if (lienWa) {
    btnWa.href = `${lienWa}?text=${encodeURIComponent(document.getElementById('mf-notification-texte').value)}`;
    btnWa.style.display = 'inline-flex';
  } else {
    btnWa.style.display = 'none';
  }
  btnWa.onclick = () => { btnWa.href = `${lienWa}?text=${encodeURIComponent(document.getElementById('mf-notification-texte').value)}`; };

  panneau.style.display = 'block';
}

document.getElementById('mf-notification-envoyer-email').addEventListener('click', async () => {
  if (!ficheOuverte) return;
  const d = ficheOuverte.d, c = contactsFiche(ficheOuverte.source, d);
  const statutEl = document.getElementById('mf-notification-statut');
  const message = document.getElementById('mf-notification-texte').value;
  if (!c.email) { statutEl.textContent = "Aucune adresse e-mail sur ce dossier : envoyez plutôt par WhatsApp."; return; }
  statutEl.textContent = 'Envoi en cours…';
  try {
    await envoyerEmailCandidat({ to_email: c.email, to_name: c.parent ? salutationParent(d.parent_nom) : nomAvecCivilite(d), message: messagePourEmail(message) });
    statutEl.textContent = `E-mail envoyé à ${c.email}.`;
  } catch (err) {
    statutEl.textContent = "Échec de l'envoi — vérifiez que le modèle EmailJS candidat est bien configuré.";
    console.error('Notification candidat non envoyée :', err);
  }
});

document.getElementById('mf-statut-select').addEventListener('change', async (e) => {
  if (!ficheOuverte) return;
  const conf = DOSSIERS[ficheOuverte.source];
  const nouveauStatut = e.target.value;
  const { error } = await sb.from(conf.table).update({ [conf.statutChamp]: nouveauStatut }).eq('id', ficheOuverte.id);
  if (error) { alert("Erreur lors du changement de statut : " + error.message); return; }
  ficheOuverte.d[conf.statutChamp] = nouveauStatut;
  void afficherDossiers(ficheOuverte.source);
  void chargerATraiter();

  afficherPanneauNotification(ficheOuverte.source, nouveauStatut, ficheOuverte.d);
  const genere = MODELES_NOTIFICATION[ficheOuverte.source] && MODELES_NOTIFICATION[ficheOuverte.source][nouveauStatut];
  const contactsAuto = contactsFiche(ficheOuverte.source, ficheOuverte.d);
  if (genere && contactsAuto.email) {
    const statutEl = document.getElementById('mf-notification-statut');
    statutEl.textContent = 'Envoi automatique de l\'e-mail en cours…';
    try {
      await envoyerEmailCandidat({ to_email: contactsAuto.email, to_name: contactsAuto.parent ? salutationParent(ficheOuverte.d.parent_nom) : nomAvecCivilite(ficheOuverte.d), message: messagePourEmail(document.getElementById('mf-notification-texte').value) });
      statutEl.textContent = `E-mail envoyé automatiquement à ${contactsAuto.email}. Vous pouvez le modifier et le renvoyer ci-dessus, ou l'envoyer aussi par WhatsApp.`;
    } catch (err) {
      statutEl.textContent = "L'envoi automatique de l'e-mail a échoué — vous pouvez réessayer avec le bouton ci-dessus.";
      console.error('Notification candidat non envoyée automatiquement :', err);
    }
  }
});

document.getElementById('mf-supprimer-dossier-btn').addEventListener('click', async () => {
  if (!ficheOuverte) return;
  const conf = DOSSIERS[ficheOuverte.source];
  if (!confirm('Supprimer définitivement ce dossier et toutes ses photos ? Cette action est irréversible.')) return;

  const btn = document.getElementById('mf-supprimer-dossier-btn');
  btn.disabled = true;

  if (conf.photosTable) {
    const { data: photos } = await sb.from(conf.photosTable).select('chemin').eq(conf.photosColonne, ficheOuverte.id);
    const chemins = (photos || []).map(p => p.chemin).filter(Boolean);
    if (chemins.length) await sb.storage.from(conf.bucket).remove(chemins);
  }

  const { error } = await sb.from(conf.table).delete().eq('id', ficheOuverte.id);
  btn.disabled = false;

  if (error) { alert('Erreur lors de la suppression du dossier.'); return; }

  fermerFicheDossier();
  void afficherDossiers(ficheOuverte.source);
  void chargerATraiter();
});

function genererCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const octets = new Uint32Array(6);
  crypto.getRandomValues(octets);
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[octets[i] % alphabet.length];
  return 'MA2M-' + code;
}

document.getElementById('generer-code-btn').addEventListener('click', async () => {
  const btn = document.getElementById('generer-code-btn');
  const msg = document.getElementById('codes-msg');
  btn.disabled = true;

  let code = genererCode();
  let { data: existant } = await sb.from('codes_inscription').select('code').eq('code', code).maybeSingle();
  while (existant) {
    code = genererCode();
    ({ data: existant } = await sb.from('codes_inscription').select('code').eq('code', code).maybeSingle());
  }

  const { error } = await sb.from('codes_inscription').insert({ code });
  btn.disabled = false;

  if (error) {
    msg.className = 'form-msg err'; msg.textContent = 'Erreur lors de la génération du code.'; msg.style.display = 'block';
    return;
  }

  document.getElementById('nouveau-code-texte').textContent = code;
  document.getElementById('nouveau-code-affiche').style.display = 'flex';
  msg.style.display = 'none';
  void chargerCodes();
});

// Bouton « Copier » d'un code affiché (codes d'inscription, code permanent) : « Copié ! »
// pendant 1,5 s, ou un message si le téléphone refuse l'accès au presse-papiers.
function brancherCopieCode(idBouton, idTexte) {
  const btn = document.getElementById(idBouton);
  btn.addEventListener('click', () => {
    const texteOriginal = btn.textContent;
    navigator.clipboard.writeText(document.getElementById(idTexte).textContent).then(() => {
      btn.textContent = 'Copié !';
      setTimeout(() => { btn.textContent = texteOriginal; }, 1500);
    }, () => { btn.textContent = 'Copie impossible : sélectionnez le code'; setTimeout(() => { btn.textContent = texteOriginal; }, 2500); });
  });
}
brancherCopieCode('copier-code-btn', 'nouveau-code-texte');
// Code permanent (14/10/2026, demande de la propriétaire) : une fois validé, il reste affiché
// avec « Copier le code », pour le transmettre aux mannequins sans l'avoir recopié avant.
brancherCopieCode('portail-copier-btn', 'portail-code-texte');

document.getElementById('portail-generer-btn').addEventListener('click', () => {
  document.getElementById('portail-nouveau-code').value = genererCode();
});
document.getElementById('portail-definir-btn').addEventListener('click', async () => {
  const champ = document.getElementById('portail-nouveau-code');
  const msg = document.getElementById('portail-code-msg');
  const btn = document.getElementById('portail-definir-btn');
  const nouveauCode = champ.value.trim();

  if (nouveauCode.length < 6) {
    msg.className = 'form-msg err'; msg.textContent = 'Le code doit faire au moins 6 caractères.'; msg.style.display = 'block';
    return;
  }
  if (!confirm(`Remplacer le code permanent actuel par "${nouveauCode}" ? L'ancien code ne fonctionnera plus immédiatement après.`)) return;

  btn.disabled = true;
  const { error } = await sb.rpc('definir_code_portail', { nouveau_code: nouveauCode });
  btn.disabled = false;

  if (error) {
    msg.className = 'form-msg err'; msg.textContent = "Erreur : " + error.message; msg.style.display = 'block';
    return;
  }
  msg.className = 'form-msg ok'; msg.textContent = 'Code permanent mis à jour avec succès. Copiez-le pour le transmettre aux mannequins.'; msg.style.display = 'block';
  champ.value = '';
  document.getElementById('portail-code-texte').textContent = nouveauCode;
  document.getElementById('portail-code-affiche').style.display = 'flex';
});

document.getElementById('ca-creer-btn').addEventListener('click', async () => {
  const champEmail = document.getElementById('ca-email');
  const champMdp = document.getElementById('ca-mdp');
  const msg = document.getElementById('ca-msg');
  const btn = document.getElementById('ca-creer-btn');
  const email = champEmail.value.trim();
  const motDePasse = champMdp.value;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    msg.className = 'form-msg err'; msg.textContent = 'Adresse e-mail invalide.'; msg.style.display = 'block';
    return;
  }
  if (motDePasse.length < 8) {
    msg.className = 'form-msg err'; msg.textContent = 'Le mot de passe doit contenir au moins 8 caractères.'; msg.style.display = 'block';
    return;
  }
  if (!confirm(`Créer un compte admin pour "${email}" ? Cette personne aura les mêmes droits que vous sur ce tableau de bord.`)) return;

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { msg.className = 'form-msg err'; msg.textContent = 'Session expirée — reconnectez-vous puis réessayez.'; msg.style.display = 'block'; return; }

  btn.disabled = true;
  msg.className = 'form-msg'; msg.textContent = 'Création…'; msg.style.display = 'block';
  try {
    const reponse = await fetch('/api/creer-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ email, password: motDePasse })
    });
    const resultat = await reponse.json().catch(() => ({}));
    if (!reponse.ok) { msg.className = 'form-msg err'; msg.textContent = 'Échec : ' + (resultat.error || 'erreur inconnue.'); return; }
    msg.className = 'form-msg ok'; msg.textContent = `Compte admin créé pour ${resultat.email}.`;
    champEmail.value = ''; champMdp.value = '';
  } catch (e) {
    msg.className = 'form-msg err'; msg.textContent = 'Échec : ' + e.message;
  } finally {
    btn.disabled = false;
  }
});

function carteCode(c) {
  return `
    <div class="dossier-carte tdb-53">
      <div class="dc-nom tdb-54">${echapperHtml(c.code)}</div>
      <div class="dc-meta">Créé le ${new Date(c.created_at).toLocaleDateString('fr-FR')}${c.utilise_le ? ' · Utilisé le ' + new Date(c.utilise_le).toLocaleDateString('fr-FR') : ''}</div>
      <span class="statut-pill ${c.utilise ? 'statut-refusee' : 'statut-retenue'}">${c.utilise ? 'Utilisé' : 'Disponible'}</span>
    </div>`;
}
async function chargerCodes() {
  const { data: codes } = await sb.from('codes_inscription').select('code, utilise, utilise_le, created_at').order('created_at', { ascending: false }).limit(200);
  const disponibles = (codes || []).filter(c => !c.utilise);
  const utilises = (codes || []).filter(c => c.utilise);

  document.getElementById('liste-codes').innerHTML = disponibles.map(carteCode).join('') || '<div class="dossiers-vide">Aucun code disponible pour le moment.</div>';
  document.getElementById('liste-anciens-codes').innerHTML = utilises.map(carteCode).join('') || '<div class="dossiers-vide">Aucun code déjà utilisé.</div>';
  document.getElementById('anciens-codes-compteur').textContent = utilises.length;
}

document.getElementById('form-nouveau-projet').addEventListener('submit', async (e) => {
  e.preventDefault();
  const champ = document.getElementById('nouveau-projet-nom');
  const champDescription = document.getElementById('nouveau-projet-description');
  const champDate = document.getElementById('nouveau-projet-date');
  const champLieu = document.getElementById('nouveau-projet-lieu');
  const msg = document.getElementById('projets-msg');
  const nom = champ.value.trim();
  if (!nom) return;
  msg.style.display = 'none';
  const { error } = await sb.from('casting_projets').insert({
    nom,
    description: champDescription.value.trim() || null,
    date_casting: champDate.value || null,
    lieu: champLieu.value.trim() || null
  });
  if (!error) {
    champ.value = '';
    champDescription.value = '';
    champDate.value = '';
    champLieu.value = '';
    void chargerProjets();
  } else {
    msg.className = 'form-msg err';
    msg.style.display = 'block';
    msg.textContent = "Erreur lors de l'ajout (" + error.message + "). Vérifiez que le SQL \"Extension 38\" a bien été exécuté (table casting_projets).";
    console.error('Erreur insertion casting_projets :', error);
  }
});

async function chargerProjets() {
  const { data: projets, error } = await sb.from('casting_projets').select('id, nom, description, actif, created_at, date_casting, lieu, ordre_affichage').order('ordre_affichage', { ascending: true }).order('created_at', { ascending: false });
  const conteneur = document.getElementById('liste-projets');
  if (error) {
    conteneur.innerHTML = `<div class="dossiers-vide">Impossible de charger les projets (${echapperHtml(error.message)}). Vérifiez que le SQL "Extension 38" a bien été exécuté.</div>`;
    console.error('Erreur chargement casting_projets :', error);
    return;
  }
  const liste = projets || [];
  conteneur.innerHTML = liste.map((p, i) => `
    <div class="dossier-carte tdb-53">
      <div class="dc-nom">${echapperHtml(p.nom)}</div>
      ${p.description ? `<div class="dc-meta">${echapperHtml(p.description)}</div>` : ''}
      ${(p.date_casting || p.lieu) ? `<div class="dc-meta">${[p.date_casting ? new Date(p.date_casting + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null, p.lieu].filter(Boolean).join(' · ')}</div>` : ''}
      <div class="dc-meta">Ajouté le ${new Date(p.created_at).toLocaleDateString('fr-FR')}</div>
      <span class="statut-pill ${p.actif ? 'statut-retenue' : 'statut-refusee'}">${p.actif ? 'Actif' : 'Désactivé'}</span>
      <button class="btn tdb-48" data-projet-toggle="${p.id}" data-actif="${p.actif}">${p.actif ? 'Désactiver' : 'Réactiver'}</button>
      <button class="btn tdb-48" data-projet-description="${p.id}" data-description-actuelle="${echapperHtml(p.description || '')}">✏️ Description</button>
      <button class="btn tdb-48" data-projet-date-lieu="${p.id}" data-date-actuelle="${p.date_casting || ''}" data-lieu-actuel="${echapperHtml(p.lieu || '')}">📅 Date / lieu</button>
      <button class="btn tdb-48" data-projet-monter="${p.id}" ${i === 0 ? 'disabled' : ''}>▲ Monter</button>
      <button class="btn tdb-48" data-projet-descendre="${p.id}" ${i === liste.length - 1 ? 'disabled' : ''}>▼ Descendre</button>
      <button class="btn tdb-55" data-projet-supprimer="${p.id}">Supprimer</button>
    </div>
  `).join('') || '<div class="dossiers-vide">Aucun projet/casting ajouté pour le moment — le formulaire affichera "Aucun casting n\'est ouvert pour le moment".</div>';
  window.MA2M_PROJETS_ORDRE = liste;
}

// Échange par POSITION dans la liste affichée, jamais par la valeur stockée en
// base : de nouveaux projets partent tous à ordre_affichage = 0, un échange basé
// sur ces valeurs identiques ne produirait aucun changement visible. On renumérote
// donc toute la liste (0, 1, 2…) après chaque Monter/Descendre.
async function echangerOrdreProjets(id, sens) {
  const liste = (window.MA2M_PROJETS_ORDRE || []).slice();
  const i = liste.findIndex(p => p.id === id);
  const j = i + sens;
  if (i === -1 || j < 0 || j >= liste.length) return;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  await Promise.all(liste.map((p, idx) => sb.from('casting_projets').update({ ordre_affichage: idx }).eq('id', p.id)));
  void chargerProjets();
}

document.getElementById('liste-projets').addEventListener('click', async (e) => {
  const btnToggle = e.target.closest('[data-projet-toggle]');
  if (btnToggle) {
    const actifActuel = btnToggle.dataset.actif === 'true';
    await sb.from('casting_projets').update({ actif: !actifActuel }).eq('id', btnToggle.dataset.projetToggle);
    void chargerProjets();
    return;
  }
  const btnSupprimer = e.target.closest('[data-projet-supprimer]');
  if (btnSupprimer) {
    if (!confirm('Supprimer définitivement ce projet ? Les candidatures déjà reçues pour lui resteront intactes (le nom du projet a été enregistré directement sur chaque candidature).')) return;
    await sb.from('casting_projets').delete().eq('id', btnSupprimer.dataset.projetSupprimer);
    void chargerProjets();
    return;
  }
  const btnDescription = e.target.closest('[data-projet-description]');
  if (btnDescription) {
    const nouvelleDescription = prompt('Description du projet (courte, visible par les candidats) :', btnDescription.dataset.descriptionActuelle || '');
    if (nouvelleDescription === null) return;
    await sb.from('casting_projets').update({ description: nouvelleDescription.trim() || null }).eq('id', btnDescription.dataset.projetDescription);
    void chargerProjets();
    return;
  }
  const btnDateLieu = e.target.closest('[data-projet-date-lieu]');
  if (btnDateLieu) {
    const nouvelleDate = prompt('Date du casting (AAAA-MM-JJ, laisser vide si inconnue) :', btnDateLieu.dataset.dateActuelle || '');
    if (nouvelleDate === null) return;
    const nouveauLieu = prompt('Lieu du casting (laisser vide si inconnu) :', btnDateLieu.dataset.lieuActuel || '');
    if (nouveauLieu === null) return;
    await sb.from('casting_projets').update({ date_casting: nouvelleDate.trim() || null, lieu: nouveauLieu.trim() || null }).eq('id', btnDateLieu.dataset.projetDateLieu);
    void chargerProjets();
    return;
  }
  const btnMonter = e.target.closest('[data-projet-monter]');
  if (btnMonter) { void echangerOrdreProjets(btnMonter.dataset.projetMonter, -1); return; }
  const btnDescendre = e.target.closest('[data-projet-descendre]');
  if (btnDescendre) { void echangerOrdreProjets(btnDescendre.dataset.projetDescendre, 1); }
});

async function chargerResumeCandidatures() {
  const { data: resume } = await sb.rpc('resume_candidatures_par_projet');
  const conteneur = document.getElementById('resume-candidatures');
  if (!resume || !resume.length) { conteneur.textContent = ''; return; }
  conteneur.innerHTML = resume.map(r => {
    const libelle = r.type_candidature === 'projet' ? (r.projet_nom || 'Projet sans nom') : "Intégrer l'agence";
    return `<span class="tdb-56"><strong class="tdb-57">${r.total}</strong> — ${echapperHtml(libelle)}</span>`;
  }).join('');
}

async function chargerVedette() {
  const { data: profils } = await sb.from('model_profiles').select('id, full_name, featured').eq('published', true).order('full_name', { ascending: true });
  const select = document.getElementById('tb-select-vedette');
  const actuel = document.getElementById('tb-vedette-actuelle');

  if (!profils || !profils.length) {
    select.innerHTML = '<option value="">Aucun mannequin publié pour le moment</option>';
    return;
  }

  select.innerHTML = profils.map(p => `<option value="${p.id}">${echapperHtml(p.full_name || 'Sans nom')}</option>`).join('');

  const vedette = profils.find(p => p.featured);
  if (vedette) {
    select.value = vedette.id;
    actuel.textContent = `Actuellement en avant : ${vedette.full_name}`;
  } else {
    actuel.textContent = 'Aucun mannequin mis en avant actuellement (une photo aléatoire s\'affiche sur la page d\'accueil).';
  }
}

document.getElementById('tb-definir-vedette-btn').addEventListener('click', async () => {
  const id = document.getElementById('tb-select-vedette').value;
  const msg = document.getElementById('tb-vedette-msg');
  if (!id) return;
  msg.className = 'form-msg ok'; msg.textContent = 'Enregistrement…'; msg.style.display = 'block';

  await sb.from('model_profiles').update({ featured: false }).eq('featured', true);
  const { error } = await sb.from('model_profiles').update({ featured: true }).eq('id', id);

  if (error) { msg.className = 'form-msg err'; msg.textContent = "Erreur lors de l'enregistrement."; return; }
  msg.className = 'form-msg ok'; msg.textContent = 'Mannequin à la une mis à jour !';
  void chargerVedette();
  void chargerHeroVedette();
});

document.getElementById('tb-retirer-vedette-btn').addEventListener('click', async () => {
  const msg = document.getElementById('tb-vedette-msg');
  await sb.from('model_profiles').update({ featured: false }).eq('featured', true);
  msg.className = 'form-msg ok'; msg.textContent = 'Mise en avant retirée.'; msg.style.display = 'block';
  void chargerVedette();
  void chargerHeroVedette();
});

async function chargerBandeau() {
  const { data } = await sb.from('bandeau_annonce').select('*').eq('id', 'principal').maybeSingle();
  const actif = !!(data && data.actif);
  document.getElementById('bandeau-texte').value = (data && data.texte) || '';
  const btnActif = document.getElementById('bandeau-actif-btn');
  btnActif.textContent = actif ? 'Désactiver' : 'Activer';
  btnActif.dataset.actif = actif ? '1' : '0';
  document.getElementById('bandeau-etat').textContent = actif
    ? 'Actuellement affiché sur le site, à la place du texte par défaut.'
    : 'Actuellement masqué — le texte par défaut de la bande s\'affiche sur le site.';
}

document.getElementById('bandeau-enregistrer-btn').addEventListener('click', async () => {
  const msg = document.getElementById('bandeau-msg');
  const texte = document.getElementById('bandeau-texte').value.trim();
  msg.className = 'form-msg ok'; msg.textContent = 'Enregistrement…'; msg.style.display = 'block';
  const { error } = await sb.from('bandeau_annonce').update({ texte, updated_at: new Date().toISOString() }).eq('id', 'principal');
  if (error) { msg.className = 'form-msg err'; msg.textContent = "Erreur lors de l'enregistrement."; return; }
  msg.className = 'form-msg ok'; msg.textContent = 'Message enregistré !';
  void chargerBandeau();
});

document.getElementById('bandeau-actif-btn').addEventListener('click', async () => {
  const actif = document.getElementById('bandeau-actif-btn').dataset.actif === '1';
  await sb.from('bandeau_annonce').update({ actif: !actif }).eq('id', 'principal');
  void chargerBandeau();
});

let mrPhotoUrlActuelle = null;

async function chargerMotResponsableTableau() {
  const { data } = await sb.from('mot_responsable').select('*').eq('id', 'principal').maybeSingle();
  document.getElementById('mr-nom').value = (data && data.nom) || '';
  document.getElementById('mr-titre').value = (data && data.titre) || '';
  document.getElementById('mr-message').value = (data && data.message) || '';
  mrPhotoUrlActuelle = (data && data.photo_url) || null;
  const apercu = document.getElementById('mr-photo-apercu');
  if (mrPhotoUrlActuelle) {
    apercu.src = mrPhotoUrlActuelle;
    apercu.style.display = 'block';
  } else {
    apercu.style.display = 'none';
  }

  // Réutilise la même photo comme avatar du profil admin dans la topbar — aucune donnée inventée.
  const avatar = document.getElementById('db-profil-avatar');
  if (avatar && mrPhotoUrlActuelle) {
    const img = document.createElement('img');
    img.id = 'db-profil-avatar';
    img.alt = '';
    img.src = mrPhotoUrlActuelle;
    avatar.replaceWith(img);
  }
}

function redimensionnerPhotoResponsable(fichier, coteMax = 2400, qualite = 0.88) {
  if (!/^image\/(jpeg|png|webp)$/.test(fichier.type) || fichier.size < 1.5 * 1024 * 1024) return Promise.resolve(fichier);
  return reduireEnJpeg(fichier, coteMax, qualite); // js/app.js
}

document.getElementById('mr-photo-btn').addEventListener('click', async () => {
  const input = document.getElementById('mr-photo-input');
  const msg = document.getElementById('mr-msg');
  let fichier = input.files && input.files[0];
  if (!fichier) { msg.className = 'form-msg err'; msg.textContent = 'Choisissez une photo d\'abord.'; msg.style.display = 'block'; return; }

  msg.className = 'form-msg ok'; msg.textContent = 'Envoi de la photo…'; msg.style.display = 'block';
  const estHeic = /image\/hei(c|f)/i.test(fichier.type) || /\.(heic|heif)$/i.test(fichier.name);
  if (estHeic && typeof heic2any !== 'undefined') {
    try {
      const resultat = await heic2any({ blob: fichier, toType: 'image/jpeg', quality: 0.9 });
      const blobFinal = Array.isArray(resultat) ? resultat[0] : resultat;
      fichier = new File([blobFinal], fichier.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
    } catch (e) {
      msg.className = 'form-msg err'; msg.textContent = 'Erreur : conversion de la photo (format HEIC) impossible.';
      return;
    }
  }
  fichier = await redimensionnerPhotoResponsable(fichier);
  if (fichier.size > 10 * 1024 * 1024) {
    msg.className = 'form-msg err';
    msg.textContent = 'Cette photo est trop lourde (plus de 10 Mo) même après compression — essayez une autre photo.';
    return;
  }
  const chemin = `site/responsable/${Date.now()}-${suffixeAleatoire()}-${nomFichierSur(fichier.name)}`;
  let urlPublique;
  try {
    urlPublique = await envoyerImageSite('responsable', chemin, fichier);
  } catch (e) {
    msg.className = 'form-msg err'; msg.textContent = 'Erreur : ' + e.message; return;
  }
  const { error: erreurMaj } = await sb.from('mot_responsable')
    .update({ photo_url: urlPublique, updated_at: new Date().toISOString() }).eq('id', 'principal');
  if (erreurMaj) { msg.className = 'form-msg err'; msg.textContent = 'Erreur : ' + erreurMaj.message; return; }

  msg.className = 'form-msg ok'; msg.textContent = 'Photo mise à jour !';
  input.value = '';
  void chargerMotResponsableTableau();
});

document.getElementById('mr-enregistrer-btn').addEventListener('click', async () => {
  const msg = document.getElementById('mr-msg');
  const nom = document.getElementById('mr-nom').value.trim();
  const titre = document.getElementById('mr-titre').value.trim();
  const message = document.getElementById('mr-message').value.trim();
  msg.className = 'form-msg ok'; msg.textContent = 'Enregistrement…'; msg.style.display = 'block';
  const { error } = await sb.from('mot_responsable')
    .update({ nom, titre, message, updated_at: new Date().toISOString() }).eq('id', 'principal');
  if (error) { msg.className = 'form-msg err'; msg.textContent = "Erreur lors de l'enregistrement."; return; }
  msg.className = 'form-msg ok'; msg.textContent = 'Mot du fondateur enregistré !';
  void chargerMotResponsableTableau();
});

// ===================================================================
// Note d'intégration (PDF) — 14/10/2026, demande de la propriétaire : document remis aux
// mannequins seulement après la validation de leur code d'inscription. Rangé dans R2 sous
// un nom secret (prive/note-integration/<32 caractères hexadécimaux>.pdf, api/_r2.js) ; le
// nouveau dépôt remplace l'ancien (action 'nettoyer' après un envoi réussi).
// ===================================================================
(function noteIntegration() {
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
})();

initSidebarNav();
