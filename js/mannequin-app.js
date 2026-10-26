// Application MA2M Mannequin (/app/, 25/10/2026, maquette validée par la propriétaire) : l'espace
// de chaque mannequin, installable sur le téléphone par un simple lien (sans Play Store ni App
// Store). Cinq onglets en bas : Accueil, Mes événements, Mon profil, Mes paiements, Messages.
// Étape 1 : installation (bande « Télécharger l'application », partagée : js/app.js), connexion (la même que l'Espace mannequin : connexionMannequin, js/app.js),
// convocations envoyées par l'agence (app_mes_evenements, supabase-app-mannequin.sql) avec
// « Je confirme » / « Je suis absente » (convocation_repondre) et passages du défilé
// (defile_programme), résumé du profil (analyse partagée : js/analyse-profil.js) et des paiements
// (mes_mensualites, mes_cachets). Les modifications du profil et le paiement se font encore sur
// les pages du site (Espace mannequin, Mes paiements).
(function () {
  'use strict';
  const racine = document.getElementById('app');
  if (!racine || typeof sb === 'undefined' || !sb) return;
  const esc = echapperHtml;  // (js/app.js)
  const ONGLETS = window.MA2M_APP.ONGLETS;  // (menu du bas : js/app-coque.js)
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  let etat = null;        // { uid, profil, analyse, photos, nbProjets, evenements, mensualites, cachets, castings }
  let periode = 'avenir'; // onglet de « Mes événements »
  const programmes = {};  // jeton → programme du défilé (defile_programme, chargé à la demande)
  const programmeOuvert = {};  // jeton → « Tout le programme » déplié

  // ---------- petits outils ----------
  const jourLong = (j) => new Date(j + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const jourCourt = (j) => new Date(j + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const heure = (h) => (h ? String(h).slice(0, 5).replace(':', 'h') : '');
  const fcfa = (n) => Number(n || 0).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' F';
  const aujourdhui = () => new Date().toISOString().slice(0, 10);
  const dansJours = (j) => Math.round((Date.parse(j + 'T12:00:00Z') - Date.parse(aujourdhui() + 'T12:00:00Z')) / 86400000);
  const datesEvenement = (e) => (e.date_fin && e.date_fin !== e.date_debut ? jourCourt(e.date_debut) + ' → ' + jourCourt(e.date_fin) : jourLong(e.date_debut));
  const itineraire = (e) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([e.lieu, e.ville].filter(Boolean).join(', '));
  function message(texte) {
    const zone = document.getElementById('ap-message');
    zone.textContent = texte;
    zone.classList.add('visible');
    clearTimeout(message.minuteur);
    message.minuteur = setTimeout(() => zone.classList.remove('visible'), 4200);
  }
  const initialesDe = (nom) => initialesNom(nom) || '?';  // (js/app.js)
  const ongletCourant = () => { const o = location.hash.replace('#', ''); return ONGLETS.some((x) => x[0] === o) ? o : 'accueil'; };

  // ---------- connexion ----------
  function ecranConnexion() {
    racine.innerHTML = '<main class="ap-connexion"><div class="ap-presentation"><img class="ap-icone" src="/icons/mannequin-192.png" alt="" width="72" height="72">' +
      '<h1>Bonjour</h1><p class="doux">Connectez-vous avec l’e-mail et le mot de passe de votre espace mannequin.</p></div>' +
      '<form class="ap-carte ap-form" id="ap-form-connexion" novalidate>' +
      '<label for="ap-email">E-mail<input id="ap-email" type="email" autocomplete="username" inputmode="email" required></label>' +
      '<label for="ap-mdp">Mot de passe<input id="ap-mdp" type="password" autocomplete="current-password" required></label>' +
      '<p class="ap-erreur" id="ap-connexion-msg" role="alert"></p>' +
      '<button type="submit" class="ap-btn rouge">Se connecter</button></form>' +
      '<p class="ap-petit"><a href="/app/espace-mannequin.html#mot-de-passe-oublie">Mot de passe oublié ?</a> · <a href="/app/espace-mannequin.html#inscription">Créer mon compte (code reçu après l’inscription)</a></p>' +
      '<p class="ap-petit"><a href="/app/inscription-mannequin.html">Retenue à un casting ? Commencez par l’inscription</a></p></main>';
    document.getElementById('ap-form-connexion').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('ap-connexion-msg'), bouton = e.target.querySelector('button');
      const email = document.getElementById('ap-email').value.trim(), mdp = document.getElementById('ap-mdp').value;
      if (!email || !mdp) { msg.textContent = 'Merci d’indiquer votre e-mail et votre mot de passe.'; return; }
      msg.textContent = 'Connexion…'; bouton.disabled = true;
      try {
        const refus = await connexionMannequin(email, mdp);  // (js/app.js)
        if (refus) { msg.textContent = refus; return; }
        demarrer();
      } catch (err) {
        msg.textContent = 'Erreur de connexion — réessayez.';
      } finally { bouton.disabled = false; }
    });
  }

  // ---------- données ----------
  // son profil, lu comme le Rapport des profils (js/analyse-profil.js) ; null : pas un compte
  // mannequin ; erreur (connexion coupée…) : on la laisse remonter
  async function lireProfil(uid) {
    const r = await ma2mLireProfilsAnalyse((champs) => sb.from('model_profiles').select(champs).eq('id', uid));
    if (r.error) throw r.error;
    const p = r.data[0] || null;
    if (p) p.avecSupp = r.avecSupp;
    return p;
  }
  const donnees = (x) => (x.status === 'fulfilled' && x.value && !x.value.error ? x.value.data : null);
  async function charger(uid) {
    const [profil, photos, projets, evenements, mensualites, cachets, castings, messages] = await Promise.allSettled([
      lireProfil(uid).then((data) => ({ data })),
      sb.from('model_photos').select('id, url, url_miniature, url_petite, principale, photo_couverture, tri_statut, created_at').eq('model_id', uid),
      sb.from('model_projects').select('id').eq('model_id', uid),
      sb.rpc('app_mes_evenements'),
      sb.rpc('mes_mensualites'),
      sb.rpc('mes_cachets'),
      sb.from('casting_projets').select('nom, date_casting, lieu').eq('actif', true).order('ordre_affichage', { ascending: true, nullsFirst: false }).limit(3),
      lireMessages()
    ]);
    if (profil.status === 'rejected') throw profil.reason;  // (connexion coupée : « Réessayer »)
    const p = donnees(profil);
    const lesPhotos = (donnees(photos) || []).filter((x) => x.tri_statut !== 'ecartee');
    const nbProjets = (donnees(projets) || []).length;
    return {
      uid, profil: p, photos: lesPhotos, nbProjets,
      analyse: p ? ma2mAnalyserProfil(p, lesPhotos, nbProjets, p.avecSupp) : null,  // (js/analyse-profil.js)
      evenements: donnees(evenements) || [], evenementsActifs: !!donnees(evenements),
      mensualites: donnees(mensualites), cachets: donnees(cachets) || [], castings: donnees(castings) || [],
      messages: donnees(messages) || []
    };
  }
  // boîte de réception (3e voie, 26/10/2026 : tout ce que l'agence envoie par WhatsApp et e-mail
  // arrive aussi ici ; supabase-app-messages.sql) : les 60 derniers messages
  const lireMessages = () => sb.from('app_messages').select('id, sorte, titre, texte, image, fiche, lien, cree_le, lu_le').order('cree_le', { ascending: false }).limit(60);
  const nonLus = () => etat.messages.filter((x) => !x.lu_le);
  const aVenir = () => etat.evenements.filter((e) => !e.passe);
  const aRepondre = () => aVenir().filter((e) => !e.reponse);
  const moisCourant = () => {
    const m = etat.mensualites;
    return m && m.inscrit ? (m.mois || []).find((x) => String(x.mois).slice(0, 7) === aujourdhui().slice(0, 7)) : null;
  };
  // alertes : ce qui attend la mannequin (calculé ; les notifications du téléphone viendront ensuite)
  function alertes() {
    const l = [];
    aRepondre().forEach((e) => l.push({ ic: '📨', fond: 'rose', titre: 'Convocation : confirmez votre présence', texte: e.titre + ' · ' + datesEvenement(e), lien: '#evenements' }));
    // rappel du jour J à J-2, et chaque jour d'un événement de plusieurs jours déjà commencé
    aVenir().filter((e) => e.reponse === 'confirme' && dansJours(e.date_debut) <= 2).forEach((e) => {
      const j = dansJours(e.date_debut);
      l.push({ ic: '⏰', fond: 'orange', titre: j <= 0 ? 'C’est aujourd’hui' : j === 1 ? 'C’est demain' : 'Dans 2 jours', texte: e.titre + (e.heure_convocation ? ' · convocation à ' + heure(e.heure_convocation) : ''), lien: '#evenements' });
    });
    const m = moisCourant();
    if (m && (m.etat === 'a_payer' || m.etat === 'non_paye')) l.push({ ic: '💳', fond: 'orange', titre: 'Mensualité de ' + MOIS[Number(String(m.mois).slice(5, 7)) - 1], texte: (m.etat === 'non_paye' ? 'Pas encore payée : ' : 'À payer avant le 5 : ') + fcfa(etat.mensualites.mensualite), lien: '#paiements' });
    if (etat.analyse && etat.analyse.score < 100) l.push({ ic: '✨', fond: 'bleu', titre: 'Profil complet à ' + etat.analyse.score + ' %', texte: 'Un profil complet attire davantage les recruteurs.', lien: '#profil' });
    etat.castings.forEach((c) => l.push({ ic: '📣', fond: 'vert', titre: 'Casting ouvert : ' + c.nom, texte: [c.date_casting ? jourLong(c.date_casting) : '', c.lieu].filter(Boolean).join(' · ') || 'Renseignez-vous auprès de l’agence.', lien: '' }));
    return l;
  }

  // ---------- morceaux d'écran ----------
  const pastilleReponse = (e) => (e.reponse === 'confirme' ? '<span class="ap-pastille vert">✓ Confirmée</span>'
    : e.reponse === 'absent' ? '<span class="ap-pastille gris">Absent(e)</span>'
    : e.passe ? '' : '<span class="ap-pastille orange">À répondre</span>');
  function boutonsReponse(e, sombre) {
    if (e.passe) return '';
    if (!e.reponse) return '<div class="ap-btns"><button type="button" class="ap-btn rouge" data-repondre="confirme" data-jeton="' + esc(e.jeton) + '">✓ Je confirme</button>' +
      '<button type="button" class="ap-btn' + (sombre ? ' clair' : '') + '" data-repondre="absent" data-jeton="' + esc(e.jeton) + '">Je ne pourrai pas venir</button></div>';
    return '<div class="ap-btns">' + (e.lieu || e.ville ? '<a class="ap-btn' + (sombre ? ' clair' : '') + '" href="' + esc(itineraire(e)) + '" target="_blank" rel="noopener">📍 Itinéraire</a>' : '') +
      '<button type="button" class="ap-btn' + (sombre ? ' clair' : '') + '" data-repondre="' + (e.reponse === 'confirme' ? 'absent' : 'confirme') + '" data-jeton="' + esc(e.jeton) + '">' +
      (e.reponse === 'confirme' ? 'Je ne pourrai pas venir' : 'Finalement je viens') + '</button></div>';
  }
  function infosEvenement(e) {
    return '<dl class="ap-infos"><dt>📅</dt><dd>' + esc(datesEvenement(e)) + (e.heure_evenement ? ' · ' + esc(heure(e.heure_evenement)) : '') + '</dd>' +
      (e.heure_convocation ? '<dt>⏰</dt><dd>Convocation à ' + esc(heure(e.heure_convocation)) + '</dd>' : '') +
      (e.lieu || e.ville ? '<dt>📍</dt><dd>' + esc([e.lieu, e.ville].filter(Boolean).join(', ')) + '</dd>' : '') + '</dl>';
  }
  function carteAcces(e) {
    const p = etat.profil || {};
    return '<div class="ap-acces" aria-label="Carte d’accès"><div class="ap-acces-photo">' + visage(p.full_name) + '</div><div class="ap-acces-texte">' +
      '<span class="ap-acces-sur">Mannequin · Accès événement</span><b>' + esc(String(p.full_name || '').toUpperCase()) + '</b>' +
      '<span class="ap-acces-ev">' + esc(e.titre) + ' · ' + esc(datesEvenement(e)) + '</span></div><div class="ap-acces-bande">ACCÈS MANNEQUIN · MA2M</div></div>';
  }
  function photoProfil() {
    const vues = photosAffichees(etat.photos);  // (js/app.js : même règle que la fiche publique)
    return vues.profil ? (vues.profil.url_petite || vues.profil.url_miniature || vues.profil.url) : '';
  }
  function visage(nom) {
    const url = photoProfil();
    return url ? '<img src="' + esc(urlPhotoMemeOrigine(url)) + '" alt="" loading="lazy">' : '<span>' + esc(initialesDe(nom)) + '</span>';
  }
  function carteEvenement(e, mise) {
    const sombre = mise === 'sombre';
    const prog = programmes[e.jeton], passages = prog && prog.filter((x) => x.moi);
    return '<article class="ap-carte' + (sombre ? ' sombre' : '') + '"><div class="ap-ligne entre"><span class="ap-pastille or">' + esc(libelleTypeAgenda(e.type)) +
      (sombre && !e.passe ? ' · ' + esc(dansJours(e.date_debut) <= 0 ? 'aujourd’hui' : dansJours(e.date_debut) === 1 ? 'demain' : 'dans ' + dansJours(e.date_debut) + ' jours') : '') + '</span>' + pastilleReponse(e) + '</div>' +
      '<h3 class="ap-ev-titre">' + esc(e.titre) + '</h3>' + infosEvenement(e) +
      (e.defile && e.reponse === 'confirme' && !e.passe ? (passages ? '<div class="ap-passages"><span class="doux">Mes passages</span>' +
        (passages.length ? passages.map((x) => '<div class="ap-passage"><span>' + esc(jourCourt(x.jour) + (x.salle ? ' · ' + x.salle : '') + (x.theme ? ' · ' + x.theme : '')) + '</span><b>' + esc(heure(x.debut) || '—') + '</b></div>').join('')
          : '<p class="doux">Pas encore de passage pour vous : l’agence prépare le programme.</p>') +
        (prog.length ? '<button type="button" class="ap-btn' + (sombre ? ' clair' : '') + '" data-programme="' + esc(e.jeton) + '" aria-expanded="' + !!programmeOuvert[e.jeton] + '">📋 ' + (programmeOuvert[e.jeton] ? 'Masquer le programme' : 'Tout le programme') + '</button>' : '') +
        (programmeOuvert[e.jeton] ? toutLeProgramme(prog) : '') + '</div>'
        : '<button type="button" class="ap-btn' + (sombre ? ' clair' : '') + '" data-passages="' + esc(e.jeton) + '">👠 Voir mes passages</button>') : '') +
      boutonsReponse(e, sombre) + '</article>';
  }

  // tout le programme du défilé, jour par jour : ses passages soulignés, les autres avec leur visage
  function toutLeProgramme(prog) {
    let jourEnCours = '', html = '<div class="ap-programme">';
    prog.forEach((x) => {
      if (x.jour !== jourEnCours) { jourEnCours = x.jour; html += '<h4>' + esc(jourLong(x.jour)) + '</h4>'; }
      html += '<div class="ap-prog-passage' + (x.moi ? ' moi' : '') + '"><div class="ap-ligne entre"><b>' + esc(heure(x.debut) || '—') + '</b><span class="doux">' + esc([x.salle, x.theme].filter(Boolean).join(' · ')) + '</span></div>' +
        '<div class="ap-prog-visages">' + (x.mannequins || []).map((m) => '<span class="ap-prog-visage' + (m.moi ? ' moi' : '') + '" title="' + esc(m.nom) + '">' +
          (m.photo ? '<img src="' + esc(urlPhotoMemeOrigine(m.photo)) + '" alt="" loading="lazy">' : esc(initialesDe(m.nom))) + '</span>').join('') + '</div></div>';
    });
    return html + '</div>';
  }

  // ---------- les cinq onglets ----------
  function ecranAccueil() {
    const prochain = aVenir()[0];
    const m = etat.mensualites;
    const nouveaux = nonLus();
    return '<h1>Bonjour <em>' + esc(prenomAffiche(etat.profil.full_name)) + '</em></h1>' +
      (nouveaux.length ? '<a class="ap-carte ap-rappel ap-nouveau-message" href="#alertes">✉️ <span><b>' + (nouveaux.length > 1 ? nouveaux.length + ' nouveaux messages' : 'Nouveau message') + '</b> de l’agence : ' + esc(nouveaux[0].titre) + '</span> ›</a>' : '') +
      '<h2 class="ap-titre-sec">Prochain rendez-vous</h2>' +
      (prochain ? carteEvenement(prochain, 'sombre') : '<div class="ap-carte doux">Aucune convocation pour le moment. Dès que l’agence vous convoque, elle apparaît ici.</div>') +
      '<nav class="ap-raccourcis" aria-label="Raccourcis"><a href="#evenements" data-ma-carte><span>🎫</span>Ma carte</a><a href="/app/espace-mannequin.html"><span>🗂️</span>Ma compcard</a><a href="/app/espace-mannequin.html"><span>📄</span>Mon CV</a></nav>' +
      (m && m.inscrit && moisCourant() && moisCourant().etat !== 'paye' && moisCourant().etat !== 'attente'
        ? '<a class="ap-carte ap-rappel" href="#paiements">💳 <span>Mensualité de ' + esc(MOIS[Number(String(moisCourant().mois).slice(5, 7)) - 1]) + ' : <b>' + fcfa(m.mensualite) + '</b></span> ›</a>' : '') +
      (etat.castings.length ? '<h2 class="ap-titre-sec">Messages de l’agence</h2><div class="ap-carte ap-messages">' + etat.castings.map((c) =>
        '<div class="ap-msg"><i></i><div><b>Casting ouvert : ' + esc(c.nom) + '</b><br><span class="doux">' + esc([c.date_casting ? jourLong(c.date_casting) : '', c.lieu].filter(Boolean).join(' · ') || 'Renseignez-vous auprès de l’agence.') + '</span></div></div>').join('') + '</div>' : '');
  }
  function ecranEvenements() {
    const avenir = aVenir(), passes = etat.evenements.filter((e) => e.passe).reverse();
    const liste = periode === 'avenir' ? avenir : passes;
    const confirmes = avenir.filter((e) => e.reponse === 'confirme');
    return '<div class="ap-onglets" role="tablist"><button type="button" role="tab" data-periode="avenir" aria-selected="' + (periode === 'avenir') + '">À venir (' + avenir.length + ')</button>' +
      '<button type="button" role="tab" data-periode="passes" aria-selected="' + (periode === 'passes') + '">Passés (' + passes.length + ')</button></div>' +
      (!etat.evenementsActifs ? '<div class="ap-carte doux">Vos convocations apparaîtront ici très bientôt.</div>'
        : liste.length ? liste.map((e, i) => carteEvenement(e, periode === 'avenir' && i === 0 ? 'sombre' : '')).join('')
        : '<div class="ap-carte doux">' + (periode === 'avenir' ? 'Aucune convocation à venir.' : 'Aucun événement passé pour le moment.') + '</div>') +
      (periode === 'avenir' && confirmes.length ? '<h2 class="ap-titre-sec">Ma carte d’accès</h2>' + carteAcces(confirmes[0]) +
        '<p class="ap-petit">À montrer à l’entrée de « ' + esc(confirmes[0].titre) + ' ». L’agence vous remet aussi votre carte imprimée.</p>' : '');
  }
  function ecranProfil() {
    const p = etat.profil, a = etat.analyse || { score: 0 };
    const mesures = [p.height_cm ? (Number(p.height_cm) / 100).toFixed(2).replace('.', ',') + ' m' : '', [p.chest_cm, p.waist_cm, p.hips_cm].every(Boolean) ? [p.chest_cm, p.waist_cm, p.hips_cm].join('-') : ''].filter(Boolean).join(' · ');
    const vignettes = etat.photos.slice(0, 3);
    return '<div class="ap-carte ap-ligne haut"><div class="ap-portrait">' + visage(p.full_name) + '</div><div class="ap-plein"><h3 class="ap-ev-titre">' + esc(p.full_name) + '</h3>' +
      (p.niveau_mannequin ? '<span class="ap-pastille rose">' + esc(niveauNormalise(p.niveau_mannequin, p.years_experience)) + '</span> ' : '') +
      (p.published ? '<span class="ap-pastille vert">Publié</span>' : '<span class="ap-pastille gris">Pas encore en ligne</span>') +
      '<p class="doux ap-score">Profil complet à ' + a.score + ' %</p><div class="ap-jauge"><i style="width:' + a.score + '%"></i></div></div></div>' +
      '<h2 class="ap-titre-sec">Photos du Book <span class="doux">(' + etat.photos.length + ')</span></h2>' +
      '<div class="ap-galerie">' + vignettes.map((x) => '<img src="' + esc(urlPhotoMemeOrigine(x.url_petite || x.url_miniature || x.url)) + '" alt="" loading="lazy">').join('') +
      '<a href="/app/espace-mannequin.html" aria-label="Ajouter des photos">＋</a></div>' +
      '<div class="ap-carte ap-liste"><a href="/app/espace-mannequin.html">Identité <span>' + esc(p.city || '') + ' ›</span></a>' +
      '<a href="/app/espace-mannequin.html">Mensurations <span>' + esc(mesures) + ' ›</span></a>' +
      '<a href="/app/espace-mannequin.html">Expérience <span>' + etat.nbProjets + ' ' + (etat.nbProjets > 1 ? 'événements' : 'événement') + ' ›</span></a>' +
      '<a href="/app/espace-mannequin.html">Formation et compétences <span>›</span></a></div>' +
      '<div class="ap-btns"><a class="ap-btn rouge" href="/app/espace-mannequin.html">✏️ Modifier mon profil</a><a class="ap-btn" href="/app/espace-mannequin.html">🗂️ Compcard et CV</a></div>' +
      '<button type="button" class="ap-lien" data-deconnexion>Se déconnecter</button>';
  }
  function ecranPaiements() {
    const m = etat.mensualites;
    let haut;
    if (!m) haut = '<div class="ap-carte doux">Vos paiements ne sont pas disponibles pour le moment. Réessayez plus tard.</div>';
    else if (!m.inscrit) haut = '<div class="ap-carte doux">Votre espace n’est pas encore rattaché au registre de l’agence. Contactez l’agence.</div>';
    else {
      const mois = m.mois || [], payes = mois.filter((x) => x.etat === 'paye').length, total = Math.max(24, mois.length);
      const courant = moisCourant(), enRetard = mois.some((x) => x.etat === 'non_paye');
      const prochain = mois.find((x) => x.etat === 'a_payer' || x.etat === 'non_paye' || x.etat === 'a_venir');
      const avance = moisPayablesAvance(mois).length > 0;  // (js/app.js)
      haut = '<div class="ap-carte"><div class="ap-ligne entre bas"><div><div class="ap-chiffre">' + payes + ' <small>/ ' + total + '</small></div><div class="doux">mois payés</div></div>' +
        (enRetard ? '<span class="ap-pastille rose">Retard</span>' : courant && courant.etat === 'attente' ? '<span class="ap-pastille orange">En vérification</span>'
          : courant && courant.etat === 'a_payer' ? '<span class="ap-pastille orange">À payer avant le 5</span>' : '<span class="ap-pastille vert">À jour</span>') + '</div>' +
        '<div class="ap-jauge"><i style="width:' + Math.round(payes * 100 / total) + '%"></i></div>' +
        (prochain ? '<p class="ap-echeance"><b>Prochaine échéance</b><br><span class="doux">' + esc(MOIS[Number(String(prochain.mois).slice(5, 7)) - 1]) + ' · ' + fcfa(m.mensualite) + '</span></p>' : '') +
        // « Payer avec Wave » s'il y a un mois à payer ; à jour, « Payer à l'avance » (avant, le bouton
        // menait à la grille des mois sans rien à payer, relevé par la propriétaire le 26/10/2026)
        (mois.some((x) => x.etat === 'a_payer' || x.etat === 'non_paye')
          ? '<div class="ap-btns"><a class="ap-btn rouge" href="/app/mes-paiements.html">Payer avec Wave</a><a class="ap-btn" href="/app/mes-paiements.html">Mes reçus</a></div></div>'
          : '<p class="doux ap-rien-a-payer">' + (courant && courant.etat === 'attente' ? 'Votre paiement est en cours de vérification par l’agence.'
            : 'Rien à payer pour le moment.' + (avance ? ' Vous pouvez payer jusqu’à ' + MA2M_AVANCE_MAX + ' mois à l’avance.' : '')) + '</p>' +
            // paiement à l'avance (moisPayablesAvance, js/app.js ; carte « Payer à l'avance » de js/mes-paiements.js)
            '<div class="ap-btns">' + (avance ? '<a class="ap-btn rouge" href="/app/mes-paiements.html#avance">Payer à l’avance</a>' : '') +
            '<a class="ap-btn" href="/app/mes-paiements.html">Mes mois et mes reçus</a></div></div>');
    }
    return '<h2 class="ap-titre-sec">Formation · mensualités</h2>' + haut +
      '<h2 class="ap-titre-sec">Mes cachets</h2>' + (etat.cachets.length ? '<div class="ap-carte ap-cachets">' + etat.cachets.map((c) =>
        '<div class="ap-cachet"><div><b>' + esc(c.prestation || c.motif || 'Cachet') + '</b><br><span class="doux">' + esc(c.paye_le ? jourLong(String(c.paye_le).slice(0, 10)) : '') + '</span></div>' +
        '<div class="ap-droite"><b>' + fcfa(c.montant) + '</b><br><span class="ap-pastille vert">Payé</span></div></div>').join('') + '</div>'
        : '<div class="ap-carte doux">Aucun cachet payé pour le moment.</div>');
  }
  // un message de l'agence : titre, date, texte, photo, fiche jointe, page à ouvrir
  const ICONES_MESSAGE = { casting: '📣', defile: '👠', remerciement: '🙏', selection: '🎉', convocation: '📅', rappel: '⏰', places: '🎟️', mensualite: '💳', paiement: '✅', cachet: '💰' };
  const quandMessage = (d) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' });
  function carteMessage(x) {
    const ic = ICONES_MESSAGE[x.sorte] || '✉️';
    return '<details class="ap-message-agence' + (x.nouveau ? ' nouveau' : '') + '"' + (x.nouveau ? ' open' : '') + '><summary><span class="ap-alerte-ic bleu" aria-hidden="true">' + ic + '</span>' +
      '<span><b>' + esc(x.titre.replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '')) + '</b><br><span class="doux">' + esc(quandMessage(x.cree_le)) + (x.nouveau ? ' · <em>nouveau</em>' : '') + '</span></span></summary>' +
      (x.texte ? '<p class="ap-message-texte">' + esc(x.texte) + '</p>' : '') +
      (x.image ? '<img class="ap-message-image" src="' + esc(x.image) + '" alt="" loading="lazy">' : '') +
      (x.fiche || x.lien ? '<div class="ap-btns">' + (x.fiche ? '<a class="ap-btn" href="' + esc(x.fiche) + '" target="_blank" rel="noopener">📄 Voir la fiche</a>' : '') +
        (x.lien ? '<a class="ap-btn rouge" href="' + esc(x.lien) + '">Ouvrir</a>' : '') + '</div>' : '') + '</details>';
  }
  // proposer les notifications sur ce téléphone (pas encore acceptées, et possibles ici)
  const proposerNotifications = () => notificationsPossibles() && Notification.permission === 'default';  // (js/app.js)
  function ecranAlertes() {
    const l = alertes();
    return (proposerNotifications() ? '<div class="ap-carte ap-notif"><b>🔔 Être prévenue sur mon téléphone</b><span class="doux">Recevez une notification à chaque message de l’agence, même application fermée.</span>' +
        '<button type="button" class="ap-btn rouge" data-notifications>Activer les notifications</button></div>' : '') +
      (l.length ? '<h2 class="ap-titre-sec">À faire</h2>' + l.map((x) => '<' + (x.lien ? 'a href="' + x.lien + '"' : 'div') + ' class="ap-alerte"><span class="ap-alerte-ic ' + x.fond + '">' + x.ic + '</span><span><b>' + esc(x.titre) + '</b><br>' + esc(x.texte) + '</span></' + (x.lien ? 'a' : 'div') + '>').join('') : '') +
      '<h2 class="ap-titre-sec">Messages de l’agence</h2>' +
      (etat.messages.length ? etat.messages.map(carteMessage).join('') : '<div class="ap-carte doux">Aucun message pour le moment. Les informations de l’agence arriveront ici.</div>');
  }
  // messages vus : marqués lus (ils gardent « nouveau » le temps de cette visite de l'onglet)
  function marquerLus() {
    const ids = nonLus().map((x) => x.id);
    if (!ids.length) return;
    nonLus().forEach((x) => { x.lu_le = new Date().toISOString(); x.nouveau = true; });
    sb.rpc('app_messages_lus', { p_ids: ids }).then(() => null, () => null);
  }
  async function activerNotifications(bouton) {
    bouton.disabled = true;
    try {
      const j = await abonnementPush(await navigator.serviceWorker.ready);  // (js/app.js)
      const { error } = await sb.rpc('app_push_abonner', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
      if (error) throw error;
      message('C’est activé : vous serez prévenue à chaque message de l’agence.');
    } catch (e) {
      message(Notification.permission === 'denied' ? 'Notifications refusées : autorisez-les dans les réglages du téléphone.' : 'L’activation n’a pas abouti : réessayez.');
    }
    afficher();
  }
  const ECRANS = { accueil: ecranAccueil, evenements: ecranEvenements, profil: ecranProfil, paiements: ecranPaiements, alertes: ecranAlertes };
  const TITRES = { evenements: 'Mes événements', profil: 'Mon profil', paiements: 'Mes paiements', alertes: 'Messages' };

  function afficher() {
    if (!etat) return;
    const o = ongletCourant();
    if (o === 'alertes') marquerLus();
    else etat.messages.forEach((x) => { delete x.nouveau; });
    const nbAlertes = alertes().length + nonLus().length, nbRepondre = aRepondre().length;
    const tete = o === 'accueil' ? '<img class="ap-logo" src="/assets/logo-header-clair.png" alt="Maître Akesse Model Management" width="150" height="45">' : '<h1 class="ap-h-onglet">' + TITRES[o] + '</h1>';
    racine.innerHTML = '<header class="ap-tete">' + tete + (o === 'alertes' ? '' : '<a class="ap-cloche" href="#alertes" aria-label="Messages et alertes (' + nbAlertes + ')">🔔' + (nbAlertes ? '<b>' + nbAlertes + '</b>' : '') + '</a>') + '</header>' +
      '<main class="ap-ecran" id="ap-ecran">' + ECRANS[o]() + '</main>' + window.MA2M_APP.nav(o, { evenements: nbRepondre, alertes: nbAlertes }, true);
    document.title = (o === 'accueil' ? '' : TITRES[o] + ' · ') + 'MA2M Mannequin';
  }

  // ---------- actions ----------
  racine.addEventListener('click', async (e) => {
    const notif = e.target.closest('[data-notifications]');
    if (notif) { activerNotifications(notif); return; }
    const rep = e.target.closest('[data-repondre]'), per = e.target.closest('[data-periode]'), pas = e.target.closest('[data-passages]'), tout = e.target.closest('[data-programme]');
    if (tout) { programmeOuvert[tout.dataset.programme] = !programmeOuvert[tout.dataset.programme]; afficher(); return; }
    if (per) { periode = per.dataset.periode; afficher(); return; }
    if (e.target.closest('[data-ma-carte]')) periode = 'avenir';
    if (e.target.closest('[data-deconnexion]')) {
      await sb.auth.signOut({ scope: 'local' }).catch(() => null);  // cet appareil seulement
      etat = null; periode = 'avenir';
      [programmes, programmeOuvert].forEach((o) => Object.keys(o).forEach((k) => { delete o[k]; }));
      ecranConnexion();
      return;
    }
    if (pas) {
      pas.disabled = true;
      const { data, error } = await sb.rpc('defile_programme', { p_jeton: pas.dataset.passages });
      if (error) { pas.disabled = false; message('Le programme n’a pas pu être chargé : réessayez.'); return; }
      // (rien : pas encore retenue dans le programme du défilé)
      programmes[pas.dataset.passages] = (data && data.passages) || [];
      afficher();
      return;
    }
    if (!rep) return;
    const ev = etat.evenements.find((x) => x.jeton === rep.dataset.jeton);
    if (!ev) return;
    if (rep.dataset.repondre === 'absent' && !confirm('Vous ne pourrez pas venir à « ' + ev.titre + ' » ? L’agence sera prévenue.')) return;
    rep.disabled = true;
    const { data, error } = await sb.rpc('convocation_repondre', { p_jeton: ev.jeton, p_reponse: rep.dataset.repondre });
    if (error || !data) { rep.disabled = false; message('Votre réponse n’a pas pu être envoyée : vérifiez votre connexion et réessayez.'); return; }
    ev.reponse = rep.dataset.repondre;
    message(ev.reponse === 'confirme' ? 'Merci ! Votre présence est confirmée.' : 'C’est noté : l’agence est prévenue.');
    afficher();
  });
  addEventListener('hashchange', () => { afficher(); scrollTo(0, 0); });
  // de retour dans l'application (notification touchée, autre application) : les nouveaux messages
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !etat) return;
    lireMessages().then(({ data }) => {
      if (!data || !etat) return;
      const vus = new Set(etat.messages.filter((x) => x.nouveau).map((x) => x.id));
      etat.messages = data.map((x) => (vus.has(x.id) ? Object.assign(x, { nouveau: true }) : x));
      afficher();
    }, () => null);
  });
  // notification touchée alors que l'application est déjà ouverte (service-worker.js) : sa page
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => {
    const url = e.data && e.data.ma2mOuvrir;
    if (typeof url === 'string' && url.indexOf('/app/') === 0) location.href = url;
  });

  // ---------- démarrage ----------
  // (session illisible, ex. stockage du navigateur bloqué : l'écran de connexion)
  function demarrer() { ouvrir().catch(() => ecranConnexion()); }
  async function ouvrir() {
    const { data } = await sb.auth.getSession();
    if (!data || !data.session) { ecranConnexion(); return; }
    racine.innerHTML = '<div class="ap-chargement"><img src="/icons/mannequin-192.png" alt="" width="96" height="96"><span>Chargement de votre espace…</span></div>';
    try {
      etat = await charger(data.session.user.id);
    } catch (e) {
      racine.innerHTML = '<main class="ap-connexion"><div class="ap-carte">Votre espace n’a pas pu être chargé : vérifiez votre connexion. <button type="button" class="ap-btn rouge" id="ap-reessayer">Réessayer</button></div></main>';
      document.getElementById('ap-reessayer').addEventListener('click', () => demarrer());
      return;
    }
    if (!etat.profil) {
      racine.innerHTML = '<main class="ap-connexion"><div class="ap-carte">Ce compte n’est pas un compte mannequin. <button type="button" class="ap-lien" data-deconnexion>Se déconnecter</button></div></main>';
      return;
    }
    afficher();
  }
  demarrer();
})();
