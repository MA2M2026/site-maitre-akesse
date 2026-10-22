// Journal des erreurs du site (rubrique « Erreurs du site ») : sorti de js/tableau-de-bord.js le
// 22/10/2026 pour servir aux deux maisons (ancien tableau de bord et nouvelle Administration)
// sans recopie. Écran : js/erreurs-gabarit.js. Corrections connues : js/erreurs-corrigees.js.
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
  // 21/10/2026 : la roue de secours des photos a fait son travail (photos passées par Vercel), rien à corriger
  [/Photos directes Cloudflare injoignables/, 'connexion', 'info', "les photos ont tardé chez ce visiteur : le site a pris un autre chemin tout seul, les photos se sont affichées.", 'Rien à faire.'],
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
function regleCorrespond(e, c) {
  const texte = (e.message || '') + '\n' + (e.pile || '') + '\n' + (e.user_agent || '');
  return !!c.motif && texte.indexOf(c.motif) !== -1 && (!c.navigateur || (e.user_agent || '').indexOf(c.navigateur) !== -1);
}
function estErreurCorrigee(e, corrigees) {
  return corrigees.some(c => regleCorrespond(e, c) && new Date(e.created_at) < new Date(c.corrige_le));
}
// Une erreur qui RESSEMBLE à une erreur déjà corrigée (même motif) et survient après la
// correction : la règle trouvée, sinon null. Le motif peut être large (ex. « footer.site-footer ») :
// la fiche le dit « à vérifier », sans affirmer que c'est la même erreur.
function correctionDepassee(e, corrigees) {
  return corrigees.find(c => regleCorrespond(e, c) && new Date(e.created_at) >= new Date(c.corrige_le)) || null;
}
// Efface des lignes du journal par paquets de 100 ; renvoie la première erreur rencontrée.
async function effacerSignalements(ids) {
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await sb.from('journal_erreurs').delete().in('id', ids.slice(i, i + 100));
    if (error) return error;
  }
  return null;
}
async function nettoyerErreursCorrigees(erreurs) {
  const corrigees = window.MA2M_ERREURS_CORRIGEES || [];
  if (!corrigees.length) return { restantes: erreurs, nb: 0 };
  const aEffacer = [];
  const restantes = erreurs.filter(e => {
    if (estErreurCorrigee(e, corrigees)) { aEffacer.push(e.id); return false; }
    return true;
  });
  await effacerSignalements(aEffacer);
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
    g.revenue ? 'À vérifier : ressemble à une erreur corrigée le ' + dateCourte(g.revenue.corrige_le) + ' (' + g.revenue.note + ')' : '',
    g.nombreux ? 'Touche ' + g.visiteurs + ' visiteurs différents : peut-être pas leur connexion' : '',
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

const SEUIL_VISITEURS_TOUCHES = 5;
// Ligne unique « connexion faible » : nombre de visiteurs (identité de navigateur distincte)
// et de signalements de la semaine, avec un bouton pour les effacer.
let idsConnexion = [];
function afficherLigneConnexion(groupes) {
  const el = document.getElementById('erreurs-connexion');
  idsConnexion = groupes.flatMap(g => g.ids);
  el.hidden = !idsConnexion.length;
  if (!idsConnexion.length) { el.textContent = ''; return; }
  const visiteurs = new Set(groupes.flatMap(g => [...g.navigateurs])).size;
  el.innerHTML = `📶 Pas d’erreur du site : cette semaine, <b>${visiteurs} visiteur${visiteurs > 1 ? 's' : ''}</b> avai${visiteurs > 1 ? 'ent' : 't'} une connexion faible (${idsConnexion.length} signalement${idsConnexion.length > 1 ? 's' : ''} : pages lentes, connexion coupée…). Rien à faire. <button type="button" class="btn-mini-admin" id="erreurs-connexion-effacer">Effacer</button>`;
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
      ${g.revenue ? `<p class="journal-revenue">⚠️ Ressemble à une erreur corrigée le ${dateCourte(g.revenue.corrige_le)} (${echapperHtml(g.revenue.note)}) : à vérifier, la correction n’a peut-être pas suffi.</p>` : ''}
      ${g.nombreux ? `<p class="journal-revenue">⚠️ Touche ${g.visiteurs} visiteurs différents cette semaine : ce n’est peut-être pas leur connexion.</p>` : ''}
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
    afficherLigneConnexion([]);
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
    if (!groupes[cle]) groupes[cle] = { ...e, occurrences: 0, ids: [], pages: new Set(), premiere: e.created_at, lu: lirePileErreur(e.pile), analyse: analyserErreur(e.message), revenue: correctionDepassee(e, window.MA2M_ERREURS_CORRIGEES || []) };
    const g = groupes[cle];
    g.occurrences++;
    g.ids.push(e.id);
    (g.navigateurs || (g.navigateurs = new Set())).add(e.user_agent || e.id);
    g.pages.add(cheminSansSuivi(e.page));
    g.premiere = e.created_at; // liste triée du plus récent au plus ancien
  });
  // Décision de la propriétaire (21/10/2026) : les 🟢 (connexion faible du visiteur) reviennent
  // tous les jours et ne demandent rien ; ils ne sont plus listés comme des erreurs, seulement
  // comptés sur une ligne. Le journal ne montre que les vraies erreurs (🔴, 🟠).
  // Garde-fou : un problème « de connexion » qui touche beaucoup de visiteurs différents la même
  // semaine (e-mails qui ne partent plus, photos Cloudflare injoignables pour tout un opérateur…)
  // n'est sans doute pas leur connexion : il redevient une erreur 🟠 à surveiller.
  Object.values(groupes).forEach(g => {
    g.visiteurs = g.navigateurs.size;
    if (g.analyse.gravite === 'info' && g.visiteurs >= SEUIL_VISITEURS_TOUCHES) { g.nombreux = true; g.analyse = { ...g.analyse, gravite: 'surveiller', action: 'Envoyez la fiche à Claude.' }; }
  });
  const connexion = Object.values(groupes).filter(g => g.analyse.gravite === 'info');
  const groupesTries = Object.values(groupes).filter(g => g.analyse.gravite !== 'info').sort((a, b) =>
    GRAVITES_ERREURS[a.analyse.gravite].ordre - GRAVITES_ERREURS[b.analyse.gravite].ordre || b.occurrences - a.occurrences);
  afficherLigneConnexion(connexion);

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
  const nbVraies = groupesTries.reduce((s, g) => s + g.occurrences, 0);
  compteurEl.textContent = `${nbVraies} erreur${nbVraies > 1 ? 's' : ''} (${groupesTries.length} distincte${groupesTries.length > 1 ? 's' : ''})`;
  btnEffacer.style.display = 'block';
  btnCopierTout.hidden = false;

  // Résumé : gravités + boutons de filtre par famille.
  const parGravite = { corriger: 0, surveiller: 0 };
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

// Boutons de l'écran (js/erreurs-gabarit.js) : branchés à chaque affichage. L'ancien tableau de
// bord le fait une fois au chargement ; la nouvelle Administration à chaque ouverture de la page,
// puis charge le journal.
window.demarrerErreursSite = function (charger) {
  if (!document.getElementById('liste-erreurs')) return;
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
  document.getElementById('erreurs-connexion').addEventListener('click', async (e) => {
    const bouton = e.target.closest('#erreurs-connexion-effacer');
    if (!bouton || !idsConnexion.length) return;
    if (!confirm('Effacer ces ' + idsConnexion.length + ' signalements de connexion faible ?')) return;
    bouton.disabled = true;
    const erreur = await effacerSignalements(idsConnexion);
    if (erreur) { bouton.disabled = false; alert('Effacement impossible : ' + (erreur.message || 'reconnectez-vous puis réessayez.')); return; }
    void chargerErreurs();
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
  if (charger) void chargerErreurs();
};
window.demarrerErreursSite();
