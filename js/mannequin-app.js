// Application MA2M Mannequin (/app/, 25/10/2026, maquette validée par la propriétaire) : l'espace
// de chaque mannequin, installable sur le téléphone par un simple lien (sans Play Store ni App
// Store). Cinq onglets en bas : Accueil, Mes événements, Mon profil, Mes paiements, Messages.
// Étape 1 : installation (bande « Télécharger l'application », partagée : js/app.js), connexion (la même que l'Espace mannequin : connexionMannequin, js/app.js),
// convocations envoyées par l'agence (app_mes_evenements, supabase-app-mannequin.sql) avec
// « Je confirme » / « Je suis absente » (convocation_repondre) et passages du défilé
// (defile_programme), résumé du profil (analyse partagée : js/analyse-profil.js) et des paiements
// (mes_mensualites, mes_cachets). Modifier son profil et payer : pages de l'application
// (app/espace-mannequin.html ; payer : volet de js/mes-paiements.js). jourLong : js/app.js.
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
  const jourCourt = (j) => new Date(j + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const heure = (h) => (h ? String(h).slice(0, 5).replace(':', 'h') : '');
  const fcfa = (n) => Number(n || 0).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' F';
  const aujourdhui = () => dateDuJour();  // (js/app.js)
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
        msg.textContent = 'Erreur de connexion, réessayez.';
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
    const [profil, photos, projets, evenements, mensualites, cachets, castings, messages, presences, mdm, bulletins, vitrine, recus] = await Promise.allSettled([
      lireProfil(uid).then((data) => ({ data })),
      sb.from('model_photos').select('id, url, url_miniature, url_petite, principale, photo_couverture, tri_statut, created_at').eq('model_id', uid),
      sb.from('model_projects').select('id').eq('model_id', uid),
      sb.rpc('app_mes_evenements'),
      sb.rpc('mes_mensualites'),
      sb.rpc('mes_cachets'),
      sb.from('casting_projets').select('nom, date_casting, lieu').eq('actif', true).order('ordre_affichage', { ascending: true, nullsFirst: false }).limit(3),
      lireMessages(uid),
      sb.rpc('mes_presences'),  // cours du dimanche (chantier 14, supabase-presences.sql) ; absente : rien ne s'affiche
      sb.rpc('mannequin_du_mois_actuelle'),  // (supabase-mannequin-du-mois.sql)
      sb.rpc('mes_bulletins'),  // bulletins trimestriels publiés (supabase-bulletins.sql)
      // (11/11/2026, « Mon profil » façon réseau social) adresse publique du book, phrase de la mannequin, demande en cours
      sb.from('model_profiles').select('slug, citation, en_attente_validation').eq('id', uid).maybeSingle(),
      sb.rpc('mes_recus')  // (11/11/2026) paiements validés, pour « Mes opérations » de l'écran Paiements (supabase-bloc2-complements.sql)
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
      messages: donnees(messages) || [], presences: donnees(presences) || null, mannequinDuMois: donnees(mdm) || null, bulletins: donnees(bulletins) || [],
      vitrine: donnees(vitrine) || {}, recus: donnees(recus) || []
    };
  }
  // boîte de réception (3e voie, 26/10/2026 : tout ce que l'agence envoie par WhatsApp et e-mail
  // arrive aussi ici ; supabase-app-messages.sql) : les 60 derniers messages
  // (seulement les siens : un compte qui est aussi de l'agence peut lire ceux des autres)
  const lireMessages = (uid) => sb.from('app_messages').select('id, sorte, titre, texte, image, fiche, lien, cree_le, lu_le').eq('user_id', uid).order('cree_le', { ascending: false }).limit(60);
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
  // carte d'accès façon billet de spectacle (11/11/2026, maquette validée) : à montrer à l'entrée
  function carteAcces(e) {
    const p = etat.profil || {};
    return '<div class="ap-acces" aria-label="Carte d’accès"><div class="ap-acces-texte">' +
      '<span class="ap-acces-sur">ACCÈS MANNEQUIN</span><b>' + esc(String(p.full_name || '').toUpperCase()) + '</b>' +
      '<span class="ap-acces-ev">' + esc(e.titre) + ' · ' + esc(datesEvenement(e)) + '</span>' +
      '<img class="ap-acces-logo" src="/assets/logo-header.png" alt="Maître Akesse Model Management"></div>' +
      '<div class="ap-acces-photo">' + visage(p.full_name) + '</div></div>';
  }
  function photoProfil() {
    const vues = photosAffichees(etat.photos);  // (js/app.js : même règle que la fiche publique)
    return vues.profil ? (vues.profil.url_petite || vues.profil.url_miniature || vues.profil.url) : '';
  }
  function visage(nom) {
    const url = photoProfil();
    return url ? '<img src="' + esc(urlPhotoMemeOrigine(url)) + '" alt="" loading="lazy">' : '<span>' + esc(initialesDe(nom)) + '</span>';
  }
  // « Mes passages » d'un défilé confirmé (Accueil et Événements) : chargés à la demande, puis tout le programme
  function blocPassages(e, sombre) {
    if (!(e.defile && e.reponse === 'confirme' && !e.passe)) return '';
    const prog = programmes[e.jeton], passages = prog && prog.filter((x) => x.moi);
    if (!passages) return '<button type="button" class="ap-btn' + (sombre ? ' clair' : '') + '" data-passages="' + esc(e.jeton) + '">👠 Voir mes passages</button>';
    return '<div class="ap-passages">' +
      (passages.length ? passages.map((x, i) => '<div class="ap-passage"><b>' + esc(heure(x.debut) || 'À préciser') + '</b><span>' + esc(x.salle || jourCourt(x.jour)) +
          '<small>' + esc([x.salle ? jourCourt(x.jour) : '', x.theme].filter(Boolean).join(' · ')) + '</small></span><i>Passage ' + (i + 1) + '</i></div>').join('')
        : '<p class="doux">Pas encore de passage pour vous : l’agence prépare le programme.</p>') +
      (prog.length ? '<button type="button" class="ap-btn' + (sombre ? ' clair' : '') + '" data-programme="' + esc(e.jeton) + '" aria-expanded="' + !!programmeOuvert[e.jeton] + '">📋 ' + (programmeOuvert[e.jeton] ? 'Masquer le programme' : 'Tout le programme') + '</button>' : '') +
      (programmeOuvert[e.jeton] ? toutLeProgramme(prog) : '') + '</div>';
  }
  function carteEvenement(e, mise) {
    const sombre = mise === 'sombre';
    return '<article class="ap-carte' + (sombre ? ' sombre' : '') + '"><div class="ap-ligne entre"><span class="ap-pastille or">' + esc(libelleTypeAgenda(e.type)) +
      (sombre && !e.passe ? ' · ' + esc(dansCombien(e)) : '') + '</span>' + pastilleReponse(e) + '</div>' +
      '<h3 class="ap-ev-titre">' + esc(e.titre) + '</h3>' + infosEvenement(e) + blocPassages(e, sombre) +
      boutonsReponse(e, sombre) + '</article>';
  }
  const dansCombien = (e) => { const j = dansJours(e.date_debut); return j <= 0 ? 'aujourd’hui' : j === 1 ? 'demain' : 'dans ' + j + ' jours'; };
  // Événements façon application de billets (11/11/2026, maquette validée par la propriétaire) : la date dans un
  // carré blanc, le prochain en grand, les suivants en lignes qu'on touche pour les ouvrir
  const pave = (e) => '<span class="ap-ev-date" aria-hidden="true"><b>' + esc(String(e.date_debut).slice(8, 10)) + '</b><small>' + esc(moisCourtDe(e.date_debut).toUpperCase()) + '</small></span>';
  function infosBillet(e) {
    const ligne = (ic, haut, bas) => '<dt>' + ic + '</dt><dd>' + haut + (bas ? '<small>' + bas + '</small>' : '') + '</dd>';
    return '<dl class="ap-ev-infos">' +
      (e.date_fin && e.date_fin !== e.date_debut ? ligne('📅', esc(datesEvenement(e))) : '') +
      (e.heure_convocation ? ligne('🕒', 'Convocation à <b>' + esc(heure(e.heure_convocation)) + '</b>', e.heure_evenement ? 'Début à ' + esc(heure(e.heure_evenement)) : '')
        : e.heure_evenement ? ligne('🕒', 'Début à <b>' + esc(heure(e.heure_evenement)) + '</b>') : '') +
      (e.lieu || e.ville ? ligne('📍', esc(e.lieu || e.ville), e.lieu && e.ville ? esc(e.ville) : '') : '') + '</dl>';
  }
  function billetUne(e) {
    return '<article class="ap-ev-une"><div class="ap-ev-haut">' + pave(e) + '<div><small class="ap-ev-type">' + esc(libelleTypeAgenda(e.type)) + '</small>' +
      '<h3 class="ap-ev-titre">' + esc(e.titre) + '</h3><span class="ap-ev-compte">⏳ ' + esc(dansCombien(e)) + '</span> ' + pastilleReponse(e) + '</div></div>' +
      '<div class="ap-ev-corps">' + infosBillet(e) + boutonsReponse(e, false) + '</div></article>' +
      (e.defile && e.reponse === 'confirme' ? '<h2 class="ap-titre-sec">Mes passages</h2><div class="ap-ev-passages">' + blocPassages(e, false) + '</div>' : '');
  }
  function billetMini(e) {
    const sous = [e.lieu || e.ville, e.heure_convocation ? heure(e.heure_convocation) : heure(e.heure_evenement)].filter(Boolean).join(' · ');
    return '<article class="ap-ev-mini' + (e.passe ? ' passe' : '') + '"><details' + (programmeOuvert['mini-' + e.jeton] ? ' open' : '') + ' data-mini="' + esc(e.jeton) + '"><summary>' + pave(e) +
      '<span class="ap-ev-mini-t"><b>' + esc(e.titre) + '</b><small>' + esc(sous) + '</small></span>' + pastilleReponse(e) + '</summary>' +
      '<div class="ap-ev-corps">' + infosBillet(e) + blocPassages(e, true) + boutonsReponse(e, true) + '</div></details></article>';
  }

  // tout le programme du défilé, jour par jour : ses passages soulignés, les autres avec leur visage
  function toutLeProgramme(prog) {
    let jourEnCours = '', html = '<div class="ap-programme">';
    prog.forEach((x) => {
      if (x.jour !== jourEnCours) { jourEnCours = x.jour; html += '<h4>' + esc(jourLong(x.jour)) + '</h4>'; }
      html += '<div class="ap-prog-passage' + (x.moi ? ' moi' : '') + '"><div class="ap-ligne entre"><b>' + esc(heure(x.debut) || 'À préciser') + '</b><span class="doux">' + esc([x.salle, x.theme].filter(Boolean).join(' · ')) + '</span></div>' +
        '<div class="ap-prog-visages">' + (x.mannequins || []).map((m) => '<span class="ap-prog-visage' + (m.moi ? ' moi' : '') + '" title="' + esc(m.nom) + '">' +
          (m.photo ? '<img src="' + esc(urlPhotoMemeOrigine(m.photo)) + '" alt="" loading="lazy">' : esc(initialesDe(m.nom))) + '</span>').join('') + '</div></div>';
    });
    return html + '</div>';
  }

  // ---------- cours du dimanche (chantier 14, 01/11/2026) : en lecture seule, cochés par l'agence ----------
  // calcul partagé avec l'Administration : js/presences-calcul.js
  function presencesCalculees() {
    const d = etat.presences, C = window.Presences;
    if (!d || !C) return null;
    const auj = C.jourIso(new Date()), mois = auj.slice(0, 7);
    const coches = {}; (d.presences || []).forEach((p) => { coches[p.dimanche] = p.etat; });
    const annulees = (d.annulees || []).map((a) => a.dimanche);
    const premiers = [d.date_entree, ((d.presences || [])[0] || {}).dimanche].filter(Boolean).sort((a, b) => a.localeCompare(b));
    const debut = premiers.length ? premiers[0].slice(0, 7) : mois;
    return { C, mois, ceMois: C.moisMannequin(mois, coches, annulees, d.date_entree, auj), tout: C.synthese(C.moisEntre(debut < mois ? debut : mois, mois), coches, annulees, d.date_entree, auj) };
  }
  const NOMS_JOURS = { present: 'présente', excuse: 'excusée', absent: 'absente', annulee: 'pas de cours', vacances: 'vacances', avant_entree: '—', a_venir: 'à venir' };
  const mentionHtml = (C, b) => (b.mention ? '<span class="ap-pastille pr-etat-' + C.MENTIONS[b.mention].ton + '">' + esc(C.MENTIONS[b.mention].mannequin) + '</span>' : '');
  function blocPresences() {
    const r = presencesCalculees();
    if (!r) return '';
    const { C, ceMois, tout } = r;
    const nomMois = (m) => MOIS[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4);
    const parfait = !ceMois.bilan.provisoire && ceMois.bilan.mention === 'assidu';
    const passes = tout.parMois.filter((m) => m.mois !== r.mois).reverse().slice(0, 12);
    return '<h2 class="ap-titre-sec" id="mes-presences">Mes cours du dimanche</h2>' +
      '<div class="ap-carte pr-app"><div class="ap-ligne entre"><b class="pr-app-mois">' + esc(nomMois(r.mois)) + '</b>' + mentionHtml(C, ceMois.bilan) + '</div>' +
      '<div class="pr-app-jours">' + ceMois.jours.map((j) => '<span class="pr-app-jour pr-etat-' + j.etat + '"><b>' + Number(j.dimanche.slice(8)) + '</b><small>' + NOMS_JOURS[j.etat] + '</small></span>').join('') + '</div>' +
      (parfait ? '<p class="pr-bravo">🎉 Bravo ! Vous avez suivi tous les cours du mois. Continuez comme ça !</p>' : '') +
      '<p class="doux ap-petit">C’est l’agence qui note votre présence chaque dimanche.</p></div>' +
      (tout.bilan.comptees ? '<div class="ap-carte"><div class="ap-ligne entre bas"><div><div class="pr-app-total">' + tout.bilan.presents + ' <small>/ ' + tout.bilan.comptees + '</small></div><div class="doux">cours suivis depuis votre arrivée</div></div>' + mentionHtml(C, tout.bilan) + '</div>' +
        (passes.length ? '<ul class="pr-app-historique">' + passes.map((m) => '<li><span>' + esc(nomMois(m.mois)) + '</span><span class="doux">' + m.bilan.presents + ' / ' + m.bilan.comptees + '</span>' + mentionHtml(C, m.bilan) + '</li>').join('') + '</ul>' : '') + '</div>' : '');
  }
  // bulletins trimestriels publiés par l'agence (lecture seule)
  function blocBulletins() {
    const C = window.Presences;
    if (!C || !etat.bulletins.length) return '';
    return '<h2 class="ap-titre-sec">Mes bulletins</h2>' + etat.bulletins.map((b) => {
      const t = C.trimestre(String(b.trimestre).slice(0, 10)), moy = C.moyenne(b.notes);
      return '<div class="ap-carte pr-app-bulletin"><div class="ap-ligne entre"><b>' + esc(t.nom) + '</b>' +
        (moy !== null ? '<span class="ap-pastille pr-etat-rouge">' + String(moy).replace('.', ',') + ' / 5</span>' : '') + '</div>' +
        '<ul class="pr-app-notes">' + C.COMPETENCES.filter(([k]) => typeof (b.notes || {})[k] === 'number').map(([k, nom]) =>
          '<li><span>' + esc(nom) + '</span><span class="pr-app-etoiles" aria-label="' + b.notes[k] + ' sur 5">' + '★'.repeat(b.notes[k]) + '☆'.repeat(5 - b.notes[k]) + '</span></li>').join('') + '</ul>' +
        (b.appreciation ? '<p class="pr-app-appreciation">« ' + esc(b.appreciation) + ' »</p>' : '') + '</div>';
    }).join('');
  }
  function cartePresencesAccueil() {
    const r = presencesCalculees();
    if (!r || !r.ceMois.bilan.comptees) return '';
    return '<a class="ap-carte ap-rappel" href="#profil">📋 <span>Cours du dimanche : <b>' + r.ceMois.bilan.presents + ' / ' + r.ceMois.bilan.comptees + '</b> ce mois-ci</span> ›</a>';
  }

  // ---------- les cinq onglets ----------
  // Accueil façon « fil » de réseau social (11/11/2026, maquette validée par la propriétaire) : des ronds façon
  // « stories » (Moi, Ma carte, Compcard, Mon CV, Messages), le prochain rendez-vous, puis le fil de l'agence
  // (castings ouverts et messages de l'agence en grandes publications, avec leur photo).
  function ecranAccueil() {
    const prochain = aVenir()[0];
    const m = etat.mensualites;
    const nouveaux = nonLus();
    const moi = photoProfil();
    const rond = (href, contenu, texte, extra) => '<a class="ap-story" href="' + href + '"' + (extra || '') + '><span class="ap-story-rond">' + contenu + '</span>' + texte + '</a>';
    const stories = '<nav class="ap-stories" aria-label="Raccourcis">' +
      rond('#profil', moi ? '<img src="' + esc(urlPhotoMemeOrigine(moi)) + '" alt="">' : '<b>' + esc(initialesDe(etat.profil.full_name)) + '</b>', 'Moi') +
      rond('#evenements', '<em>🎫</em>', 'Ma carte', ' data-ma-carte') +
      rond('/app/espace-mannequin.html#compcard', '<em>🗂️</em>', 'Compcard') +
      rond('/app/espace-mannequin.html#cv', '<em>📄</em>', 'Mon CV') +
      rond('#alertes', '<em>✉️</em>' + (nouveaux.length ? '<i>' + nouveaux.length + '</i>' : ''), 'Messages') + '</nav>';
    // le fil : castings ouverts, puis les derniers messages de l'agence (sauf paiements), avec leur photo
    const entete = (quand) => '<div class="ap-post-tete"><span class="ap-post-avatar" aria-hidden="true"><img src="/assets/logo-header.png" alt=""></span><div><b>Maître Akesse Model Management</b>' + (quand ? '<small>' + esc(quand) + '</small>' : '') + '</div></div>';
    const posts = etat.castings.map((c) => '<article class="ap-post">' + entete('Casting ouvert') +
        '<div class="ap-post-texte"><b>Casting ouvert : ' + esc(c.nom) + '</b><br>' + esc([c.date_casting ? jourLong(c.date_casting) : '', c.lieu].filter(Boolean).join(' · ') || 'Renseignez-vous auprès de l’agence.') + '</div></article>')
      .concat(etat.messages.filter((x) => !['paiement', 'mensualite', 'cachet'].includes(x.sorte)).slice(0, 4).map((x) => '<a class="ap-post" href="#alertes">' + entete(quandMessage(x.cree_le)) +
        (x.image ? '<img class="ap-post-image" src="' + esc(x.image) + '" alt="" loading="lazy">' : '') +
        '<div class="ap-post-texte"><b>' + esc(x.titre.replace(/^\p{Extended_Pictographic}️?\s*/u, '')) + '</b>' + (x.texte ? '<br>' + esc(x.texte.length > 140 ? x.texte.slice(0, 140) + '…' : x.texte) : '') + '</div></a>'));
    return stories +
      '<h1>Bonjour <em>' + esc(prenomAffiche(etat.profil.full_name)) + '</em></h1>' +
      (nouveaux.length ? '<a class="ap-carte ap-rappel ap-nouveau-message" href="#alertes">✉️ <span><b>' + (nouveaux.length > 1 ? nouveaux.length + ' nouveaux messages' : 'Nouveau message') + '</b> de l’agence : ' + esc(nouveaux[0].titre) + '</span> ›</a>' : '') +
      (etat.mannequinDuMois && etat.mannequinDuMois.compte === etat.uid ? '<div class="ap-carte pr-app-mdm">🏆 <span><b>Vous êtes la mannequin du mois !</b><br>Félicitations : le site et l’application vous mettent à l’honneur tout le mois.</span></div>' : '') +
      cartePresencesAccueil() +
      '<h2 class="ap-titre-sec">Prochain rendez-vous</h2>' +
      (prochain ? carteEvenement(prochain, 'sombre') : '<div class="ap-carte doux">Aucune convocation pour le moment. Dès que l’agence vous convoque, elle apparaît ici.</div>') +
      (m && m.inscrit && moisCourant() && (moisCourant().etat === 'a_payer' || moisCourant().etat === 'non_paye')
        ? '<a class="ap-carte ap-rappel" href="#paiements">💳 <span>Mensualité de ' + esc(MOIS[Number(String(moisCourant().mois).slice(5, 7)) - 1]) + ' : <b>' + fcfa(m.mensualite) + '</b></span> ›</a>' : '') +
      (posts.length ? '<h2 class="ap-titre-sec">Le fil de l’agence</h2>' + posts.join('') : '');
  }
  function ecranEvenements() {
    const avenir = aVenir(), passes = etat.evenements.filter((e) => e.passe).reverse();
    const confirmes = avenir.filter((e) => e.reponse === 'confirme');
    const onglets = '<div class="ap-onglets ap-seg" role="tablist"><button type="button" role="tab" data-periode="avenir" aria-selected="' + (periode === 'avenir') + '">À venir · ' + avenir.length + '</button>' +
      '<button type="button" role="tab" data-periode="passes" aria-selected="' + (periode === 'passes') + '">Passés · ' + passes.length + '</button></div>';
    if (!etat.evenementsActifs) return onglets + '<div class="ap-carte doux">Vos convocations apparaîtront ici très bientôt.</div>';
    if (periode === 'passes') return onglets + (passes.length ? passes.map(billetMini).join('') : '<div class="ap-carte doux">Aucun événement passé pour le moment.</div>');
    if (!avenir.length) return onglets + '<div class="ap-carte doux">Aucune convocation à venir. Dès que l’agence vous convoque, elle apparaît ici.</div>';
    return onglets + billetUne(avenir[0]) +
      (confirmes.length ? '<h2 class="ap-titre-sec">Ma carte d’accès</h2>' + carteAcces(confirmes[0]) +
        '<p class="ap-petit">À montrer à l’entrée de « ' + esc(confirmes[0].titre) + ' ». L’agence vous remet aussi votre carte imprimée.</p>' : '') +
      (avenir.length > 1 ? '<h2 class="ap-titre-sec">Ensuite</h2>' + avenir.slice(1).map(billetMini).join('') : '');
  }
  // « Mon profil » façon réseau social (11/11/2026, maquette validée par la propriétaire) : couverture et photo ronde
  // qu'on touche pour choisir une photo dans la galerie (elle rejoint aussi le Book), chiffres, phrase, boutons
  // Compcard / Mon CV / Partager mon book, grille de photos de 3 comme sur Instagram.
  function ecranProfil() {
    const p = etat.profil, a = etat.analyse || { score: 0 }, v = etat.vitrine || {};
    const mesures = [p.city || '', p.height_cm ? (Number(p.height_cm) / 100).toFixed(2).replace('.', ',') + ' m' : '', [p.chest_cm, p.waist_cm, p.hips_cm].every(Boolean) ? [p.chest_cm, p.waist_cm, p.hips_cm].join('-') : ''].filter(Boolean).join(' · ');
    const vues = photosAffichees(etat.photos);  // (js/app.js : même règle que la fiche publique)
    const url = (x) => (x ? esc(urlPhotoMemeOrigine(x.url_miniature || x.url_petite || x.url)) : '');
    const r = presencesCalculees();
    const cours = r && r.ceMois.bilan.comptees ? r.ceMois.bilan.presents + '/' + r.ceMois.bilan.comptees : '–';
    const etatProfil = p.published ? ['vert', 'Profil en ligne sur le Book'] : v.en_attente_validation ? ['orange', 'En cours de validation par l’agence'] : ['gris', 'Pas encore en ligne'];
    const champPhoto = (role, texte) => '<input class="ap-cache" type="file" accept="image/*" data-photo-role="' + role + '" aria-label="' + texte + '">';
    return '<section class="ap-vitrine">' +
      '<label class="ap-vitrine-couv' + (vues.couvertureChoisie ? '' : ' vide') + '">' + (vues.couverture ? '<img src="' + url(vues.couverture) + '" alt="">' : '') +
        '<span class="ap-vitrine-modif">📷 Couverture</span>' + champPhoto('photo_couverture', 'Changer ma photo de couverture') + '</label>' +
      '<div class="ap-vitrine-haut"><label class="ap-vitrine-avatar">' + (vues.profil ? '<img src="' + url(vues.profil) + '" alt="">' : '<span>' + esc(initialesDe(p.full_name)) + '</span>') +
        '<i aria-hidden="true">＋</i>' + champPhoto('principale', 'Changer ma photo de profil') + '</label>' +
        (p.niveau_mannequin ? '<span class="ap-vitrine-niveau">' + esc(niveauNormalise(p.niveau_mannequin, p.years_experience)) + '</span>' : '') +
        '<div class="ap-vitrine-chiffres"><div><b>' + etat.photos.length + '</b>photos</div><div><b>' + etat.nbProjets + '</b>' + (etat.nbProjets > 1 ? 'expériences' : 'expérience') + '</div><div><b>' + cours + '</b>cours</div></div></div>' +
      '<h1 class="ap-vitrine-nom">' + esc(p.full_name) + '</h1>' + (mesures ? '<p class="ap-vitrine-mesures">' + esc(mesures) + '</p>' : '') +
      (v.citation ? '<p class="ap-vitrine-phrase">« ' + esc(v.citation) + ' »</p>' : '') +
      '<span class="ap-vitrine-etat ' + etatProfil[0] + '"><i></i>' + etatProfil[1] + '</span>' +
      (a.score < 100 ? '<a class="ap-vitrine-score" href="/app/espace-mannequin.html">Profil complet à ' + a.score + ' % · compléter ›</a>' : '') +
      '<div class="ap-vitrine-btns"><a class="ap-btn rouge" href="/app/espace-mannequin.html">Modifier mon profil</a><button type="button" class="ap-btn" data-partager-book>Partager mon book</button></div>' +
      '<div class="ap-vitrine-raccourcis"><a href="/app/espace-mannequin.html#compcard"><span>🗂️</span>Compcard</a><a href="/app/espace-mannequin.html#cv"><span>📄</span>Mon CV</a><a href="/app/espace-mannequin.html#photos"><span>📸</span>Mes photos</a></div>' +
      '</section>' +
      '<div class="ap-vitrine-grille">' + etat.photos.slice().sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))).map((x) => '<img src="' + esc(urlPhotoMemeOrigine(x.url_petite || x.url_miniature || x.url)) + '" alt="" loading="lazy">').join('') +
        '<label class="ap-vitrine-ajout">＋<span>Ajouter</span>' + champPhoto('', 'Ajouter une photo au Book') + '</label></div>' +
      blocPresences() + blocBulletins() +
      '<button type="button" class="ap-lien" data-deconnexion>Se déconnecter</button>';
  }
  // Photo choisie dans la galerie depuis « Mon profil » : elle part dans le Book (js/app.js insererPhotoBook) et
  // reçoit son rôle (photo ronde = principale, couverture) ; vide = simple ajout au Book.
  const LIMITE_PHOTOS_APP = 60;  // (même limite que l'Espace mannequin)
  racine.addEventListener('change', async (e) => {
    const champ = e.target.closest('[data-photo-role]');
    if (!champ || !champ.files || !champ.files[0] || !etat) return;
    const fichier = champ.files[0], role = champ.dataset.photoRole;
    champ.value = '';
    if (etat.photos.length >= LIMITE_PHOTOS_APP) { message('Limite de ' + LIMITE_PHOTOS_APP + ' photos atteinte : retirez-en une dans « Modifier mon profil ».'); return; }
    message('Envoi de la photo…');
    try {
      const ligne = await insererPhotoBook(etat.uid, fichier);
      if (role) { const erreur = await definirRolePhoto(etat.uid, role, ligne.id); if (erreur) throw erreur; }
      const { data } = await sb.from('model_photos').select('id, url, url_miniature, url_petite, principale, photo_couverture, tri_statut, created_at').eq('model_id', etat.uid);
      if (data) etat.photos = data.filter((x) => x.tri_statut !== 'ecartee');
      if (!etat.photos.some((x) => x.id === ligne.id)) etat.photos.push(ligne);  // (relecture pas encore à jour : la photo s'affiche tout de suite)
      if (role) etat.photos.forEach((x) => { x[role] = x.id === ligne.id; });
      message(role === 'principale' ? 'Nouvelle photo de profil ✨' : role === 'photo_couverture' ? 'Nouvelle couverture ✨' : 'Photo ajoutée à votre Book ✨');
      afficher();
    } catch (err) {
      const brut = (err && err.message) || '';
      message(/failed to fetch|load failed|network/i.test(brut) ? 'Connexion interrompue pendant l’envoi : réessayez.' : 'La photo n’a pas pu être envoyée : réessayez.');
      if (window.signalerErreur) window.signalerErreur('Envoi de photo échoué (application)', brut || 'erreur inconnue', (fichier.name || 'photo') + ', ' + Math.round((fichier.size || 0) / 1024) + ' Ko');
    }
  });
  // « Partager mon book » : la feuille de partage du téléphone (WhatsApp, Instagram…), sinon le lien copié
  async function partagerBook() {
    const p = etat.profil, v = etat.vitrine || {};
    if (!p.published) { message('Votre book sera partageable dès que l’agence aura mis votre profil en ligne.'); return; }
    const lien = 'https://www.maitreakessemodelmanagement.com/' + lienFicheMannequin({ id: etat.uid, slug: v.slug });
    const texte = 'Mon book chez Maître Akesse Model Management ✨';
    if (navigator.share) { try { await navigator.share({ title: p.full_name, text: texte, url: lien }); } catch (e) { /* partage annulé */ } return; }
    try { await navigator.clipboard.writeText(lien); message('Lien de votre book copié : collez-le où vous voulez.'); } catch (e) { message(lien); }
  }
  // Paiements « style application bancaire » (11/11/2026, maquette validée par la propriétaire) : la carte de
  // membre façon carte bancaire, deux chiffres (mois payés, cachets reçus), le prochain paiement avec « Payer avec
  // Wave », la grille des mois, puis « Mes opérations » comme un relevé (cachets reçus et mensualités validées).
  const moisCourt = moisCourtDe;  // (js/app.js)
  const MODES_PAIEMENT = { wave: 'Wave', especes: 'Espèces', orange_money: 'Orange Money', mtn: 'MTN Money', moov: 'Moov Money', virement: 'Virement', avant_systeme: 'Avant l’application' };
  function carteMembre(m) {
    const p = etat.profil || {}, entree = etat.presences && etat.presences.date_entree;
    const champ = (titre, valeur) => (valeur ? '<div><b>' + titre + '</b>' + esc(valeur) + '</div>' : '');
    return '<div class="ap-cb" aria-label="Ma carte de membre"><div class="ap-cb-tete"><img src="/assets/logo-header.png" alt="Maître Akesse Model Management"><span>CARTE MEMBRE</span></div>' +
      '<i class="ap-cb-puce" aria-hidden="true"></i><div class="ap-cb-nom">' + esc(String(m.nom || p.full_name || '').toUpperCase()) + '</div>' +
      '<div class="ap-cb-bas">' + champ('FORMATION', niveauNormalise(p.niveau_mannequin, p.years_experience) || 'Mannequinat') +
        champ('DEPUIS', entree ? moisCourt(entree) + ' ' + String(entree).slice(0, 4) : '') + champ('MENSUALITÉ', fcfa(m.mensualite)) + '</div></div>';
  }
  function ecranPaiements() {
    const m = etat.mensualites;
    const totalCachets = etat.cachets.reduce((t, c) => t + (Number(c.montant) || 0), 0);
    const tuileCachets = '<div class="ap-tuile"><div class="ap-chiffre">' + fcfa(totalCachets) + '</div><div class="doux">cachets reçus</div>' +
      '<span class="ap-pastille vert">' + (etat.cachets.length ? etat.cachets.length + (etat.cachets.length > 1 ? ' cachets' : ' cachet') : 'Aucun pour l’instant') + '</span></div>';
    let haut;
    if (!m) haut = '<div class="ap-carte doux">Vos paiements ne sont pas disponibles pour le moment. Réessayez plus tard.</div><div class="ap-tuiles">' + tuileCachets + '</div>';
    else if (!m.inscrit) haut = '<div class="ap-carte doux">Votre espace n’est pas encore rattaché au registre de l’agence. Contactez l’agence.</div><div class="ap-tuiles">' + tuileCachets + '</div>';
    else {
      const mois = m.mois || [], { payes, total } = bilanFormation(m);  // (js/app.js)
      const courant = moisCourant(), enRetard = mois.some((x) => x.etat === 'non_paye');
      const aPayer = mois.find((x) => x.etat === 'non_paye') || mois.find((x) => x.etat === 'a_payer');
      const prochain = mois.find((x) => x.etat === 'a_payer' || x.etat === 'non_paye' || x.etat === 'a_venir');
      const avance = moisPayablesAvance(mois).length > 0;  // (js/app.js)
      const situation = situationFormation(m);  // (js/app.js)
      const pastille = enRetard ? '<span class="ap-pastille rose">Retard</span>' : courant && courant.etat === 'attente' ? '<span class="ap-pastille orange">En vérification</span>'
        : courant && courant.etat === 'a_payer' ? '<span class="ap-pastille orange">À payer avant le 5</span>'
        : courant && courant.etat === 'conge' ? '<span class="ap-pastille gris">Congés</span>'
        : situation && situation.ferme ? '<span class="ap-pastille gris">Agence fermée</span>'
        : situation && situation.termine ? '<span class="ap-pastille gris">Terminée</span>' : '<span class="ap-pastille vert">✓ À jour</span>';
      // le prochain paiement : le mois à payer (« Payer avec Wave »), sinon « Rien à payer » (et « Payer à l'avance »)
      const nomDe = (x) => MOIS[Number(String(x.mois).slice(5, 7)) - 1] + ' ' + String(x.mois).slice(0, 4);
      const carteProchain = aPayer
        ? '<div class="ap-prochain"><small>PROCHAIN PAIEMENT</small><div class="ap-prochain-ligne"><b>' + fcfa(m.mensualite) + '</b><span>' + esc(nomDe(aPayer)) + ' · ' + (aPayer.etat === 'non_paye' ? 'en retard' : 'avant le 5') + '</span></div>' +
          '<div class="ap-btns"><button type="button" class="ap-btn rouge ap-btn-wave" data-payer="payer"><i aria-hidden="true">~</i>Payer avec Wave</button></div></div>'
        : '<div class="ap-prochain"><small>PROCHAIN PAIEMENT</small>' +
          (prochain && !situation ? '<div class="ap-prochain-ligne"><b>' + fcfa(m.mensualite) + '</b><span>' + esc(nomDe(prochain)) + ' · avant le 5</span></div>' : '') +
          '<p class="ap-rien-a-payer">' + (courant && courant.etat === 'attente' ? 'Votre paiement est en cours de vérification par l’agence.'
            : 'Rien à payer pour le moment.' + (avance ? ' Vous pouvez payer jusqu’à ' + MA2M_AVANCE_MAX + ' mois à l’avance.' : '')) + '</p>' +
          // paiement à l'avance (moisPayablesAvance, js/app.js ; carte « Payer à l'avance » de js/mes-paiements.js, dans un volet)
          '<div class="ap-btns">' + (avance ? '<button type="button" class="ap-btn rouge" data-payer="payer">Payer à l’avance</button>' : '') +
          '<button type="button" class="ap-btn" data-payer="recus">Mes reçus</button></div></div>';
      // la grille des mois : ✓ payé, 🌴 congés, ⏳ en vérification, ! en retard ; le mois en cours est entouré
      const ICONE = { paye: '✓', conge: '🌴', attente: '⏳', non_paye: '!', a_payer: '•', rodage: '☆' };
      const grille = mois.map((x, i) => {
        const cle = x.conge && x.etat !== 'paye' ? 'conge' : x.etat;
        const annee = i === 0 || String(x.mois).slice(5, 7) === '01' ? '<small>' + String(x.mois).slice(0, 4) + '</small>' : '';
        return '<div class="ap-mois ' + esc(cle) + (courant && x.mois === courant.mois ? ' courant' : '') + '" title="' + esc(nomDe(x)) + '"><i aria-hidden="true">' + (ICONE[cle] || '·') + '</i>' + esc(moisCourt(x.mois)) + annee + '</div>';
      }).join('');
      haut = carteMembre(m) +
        '<div class="ap-tuiles"><div class="ap-tuile"><div class="ap-chiffre">' + payes + ' <small>/ ' + total + '</small></div><div class="doux">mois payés</div>' + pastille +
          '<div class="ap-jauge"><i style="width:' + Math.round(payes * 100 / total) + '%"></i></div></div>' + tuileCachets + '</div>' +
        // (Reprise de mars : niveau, mois X sur 9, mois restants, agence fermée — situationFormation, js/app.js)
        (situation ? '<p class="ap-formation-note"><b>' + esc(situation.titre) + '</b><br><span class="doux">' + situation.lignes.map(esc).join('<br>') + '</span></p>'
          : '<p class="doux ap-formation-note">' + total + ' mois de cours en 2 ans. Décembre, janvier et février : congés, pas de mensualité.</p>') +
        carteProchain +
        (mois.length ? '<h2 class="ap-titre-sec">Mes mois</h2><div class="ap-grille-mois">' + grille + '</div>' : '');
    }
    // « Mes opérations » : cachets reçus (+) et paiements validés, du plus récent au plus ancien
    const ops = etat.cachets.map((c) => ({ quand: String(c.paye_le || ''), ic: '💰', titre: 'Cachet · ' + (c.prestation || c.motif || 'prestation'), sous: c.paye_le ? jourLong(String(c.paye_le).slice(0, 10)) : '', montant: '+ ' + fcfa(c.montant), plus: true }))
      .concat((etat.recus || []).map((r) => ({ quand: String(r.valide_le || r.mois || ''), ic: '💳',
        titre: r.objet === 'inscription' ? 'Inscription' : r.mois ? 'Mensualité ' + (/^[aeiou]/.test(MOIS[Number(String(r.mois).slice(5, 7)) - 1]) ? 'd’' : 'de ') + MOIS[Number(String(r.mois).slice(5, 7)) - 1] : 'Mensualité',
        sous: [MODES_PAIEMENT[r.mode] || '', r.valide_le ? jourLong(String(r.valide_le).slice(0, 10)) : ''].filter(Boolean).join(' · '),
        montant: r.montant ? fcfa(r.montant) : '—', plus: false })))
      .sort((x, y) => (x.quand < y.quand ? 1 : x.quand > y.quand ? -1 : 0)).slice(0, 8);
    return haut +
      '<h2 class="ap-titre-sec">Mes opérations</h2>' + (ops.length ? '<div class="ap-releve">' + ops.map((o) =>
        '<div class="ap-op"><em aria-hidden="true">' + o.ic + '</em><span><b>' + esc(o.titre) + '</b><small>' + esc(o.sous) + '</small></span><strong' + (o.plus ? ' class="plus"' : '') + '>' + esc(o.montant) + '</strong></div>').join('') + '</div>' +
        '<button type="button" class="ap-lien-recus" data-payer="recus">Tous mes reçus ›</button>'
        : '<div class="ap-carte doux">Aucune opération pour le moment.</div>');
  }
  // un message de l'agence : titre, date, texte, photo, fiche jointe, page à ouvrir
  const ICONES_MESSAGE = { casting: '✨', defile: '👠', remerciement: '🤍', info: '💌', selection: '🎉', convocation: '💌', rappel: '⏰', places: '🎟️', mensualite: '💳', paiement: '✅', cachet: '💰' };
  const quandMessage = (d) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' });
  // Messages façon messagerie (11/11/2026, maquette validée par la propriétaire) : la conversation avec l'agence,
  // bulles par jour (des plus anciennes aux plus récentes), nouveaux messages entourés, paiements en vert ;
  // « Écrire à l'agence sur WhatsApp » (MA2M_WHATSAPP, js/app.js) pour répondre.
  const MESSAGES_AFFICHES = 30;
  // proposer les notifications sur ce téléphone (pas encore acceptées, et possibles ici)
  const proposerNotifications = () => notificationsPossibles() && Notification.permission === 'default';  // (js/app.js)
  const heureMessage = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' });
  const jourMessage = (d) => {
    const j = new Date(d).toISOString().slice(0, 10), auj = aujourdhui();
    if (j === auj) return 'Aujourd’hui';
    if (dansJours(j) === -1) return 'Hier';
    return jourLong(j);
  };
  function bulleMessage(x) {
    const titre = /^\p{Extended_Pictographic}/u.test(x.titre) ? x.titre : (ICONES_MESSAGE[x.sorte] || '✉️') + ' ' + x.titre;
    const vert = ['paiement', 'cachet'].includes(x.sorte);
    return '<article class="ap-bulle ap-message-agence' + (x.nouveau ? ' nouveau' : '') + (vert ? ' paye' : '') + '"' + (x.nouveau ? ' data-nouveau' : '') + '>' +
      (x.image ? '<img class="ap-message-image" src="' + esc(x.image) + '" alt="" loading="lazy">' : '') +
      (x.nouveau ? '<span class="ap-bulle-nv">NOUVEAU</span>' : '') + '<b>' + esc(titre) + '</b>' +
      (x.texte ? '<p class="ap-message-texte">' + esc(x.texte) + '</p>' : '') +
      (x.fiche || x.lien ? '<div class="ap-btns">' + (x.fiche ? '<a class="ap-btn" href="' + esc(x.fiche) + '" target="_blank" rel="noopener">📄 Voir la fiche</a>' : '') +
        (x.lien ? '<a class="ap-btn rouge" href="' + esc(x.lien) + '">Ouvrir</a>' : '') + '</div>' : '') +
      '<time>' + esc(heureMessage(x.cree_le)) + '</time></article>';
  }
  function ecranAlertes() {
    const l = alertes();
    let jourEnCours = '';
    const fil = etat.messages.slice(0, MESSAGES_AFFICHES).reverse().map((x) => {
      const jour = jourMessage(x.cree_le), sep = jour !== jourEnCours ? '<div class="ap-fil-jour"><span>' + esc(jour) + '</span></div>' : '';
      jourEnCours = jour;
      return sep + bulleMessage(x);
    }).join('');
    return (proposerNotifications() ? '<div class="ap-notif">🔔 <b>Être prévenue sur mon téléphone</b>' +
        '<button type="button" class="ap-btn" data-notifications>Activer</button></div>' : '') +
      (l.length ? '<h2 class="ap-titre-sec">À faire</h2><div class="ap-afaire">' + l.map((x) => '<' + (x.lien ? 'a href="' + x.lien + '"' : 'div') + ' class="ap-alerte"><span class="ap-alerte-ic ' + x.fond + '">' + x.ic + '</span><span><b>' + esc(x.titre) + '</b><small>' + esc(x.texte) + '</small></span></' + (x.lien ? 'a' : 'div') + '>').join('') + '</div>' : '') +
      '<section class="ap-fil" aria-label="Messages de l’agence"><div class="ap-fil-tete"><span class="ap-post-avatar" aria-hidden="true"><img src="/assets/logo-header.png" alt=""></span>' +
        '<div><b>Maître Akesse Model Management</b><small>● Messages de l’agence</small></div></div>' +
        '<div class="ap-fil-corps">' + (fil || '<p class="ap-fil-vide">Aucun message pour le moment. Les informations de l’agence arriveront ici.</p>') + '</div></section>' +
      '<a class="ap-wa" href="' + esc(MA2M_WHATSAPP) + '" target="_blank" rel="noopener">💬 Écrire à l’agence sur WhatsApp</a>';
  }
  // messages vus : marqués lus (ils gardent « nouveau » le temps de cette visite de l'onglet)
  function marquerLus() {
    const ids = nonLus().map((x) => x.id);
    if (!ids.length) return;
    nonLus().forEach((x) => { x.lu_le = new Date().toISOString(); x.nouveau = true; });
    sb.rpc('app_messages_lus', { p_ids: ids }).then(() => null, () => null);
  }
  // ce téléphone reçoit les notifications de CE compte (aussi relancé à chaque ouverture quand
  // c'est déjà autorisé : téléphone passé d'une mannequin à une autre, abonnement renouvelé)
  async function abonnerCeTelephone() {
    const j = await abonnementPush(await navigator.serviceWorker.ready);  // (js/app.js)
    const { error } = await sb.rpc('app_push_abonner', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
    if (error) throw error;
    return j.endpoint;
  }
  async function activerNotifications(bouton) {
    bouton.disabled = true;
    try {
      await abonnerCeTelephone();
      message('C’est activé : vous serez prévenue à chaque message de l’agence.');
    } catch (e) {
      message(Notification.permission === 'denied' ? 'Notifications refusées : autorisez-les dans les réglages du téléphone.' : 'L’activation n’a pas abouti : réessayez.');
    }
    afficher();
  }
  // « Se déconnecter » : ce téléphone ne reçoit plus les notifications de ce compte
  async function desabonnerCeTelephone() {
    if (!notificationsPossibles() || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.ready, abo = await reg.pushManager.getSubscription();
    if (abo) await sb.rpc('app_push_desabonner', { p_endpoint: abo.endpoint });
  }
  const ECRANS = { accueil: ecranAccueil, evenements: ecranEvenements, profil: ecranProfil, paiements: ecranPaiements, alertes: ecranAlertes };
  const TITRES = { evenements: 'Mes événements', profil: 'Mon profil', paiements: 'Mes paiements', alertes: 'Messages' };

  function afficher() {
    // (09/11/2026, journal des erreurs : « etat.profil is null ») compte sans fiche de mannequin : l'écran « Ce compte
    // n'est pas un compte mannequin » reste affiché, même si un autre événement (changement d'onglet…) redemande l'affichage
    if (!etat?.profil) return;
    const o = ongletCourant();
    if (o === 'alertes') marquerLus();
    else etat.messages.forEach((x) => { delete x.nouveau; });
    const nbAlertes = alertes().length + nonLus().length, nbRepondre = aRepondre().length;
    const tete = o === 'accueil' ? '<img class="ap-logo" src="/assets/logo-header-clair.png" alt="Maître Akesse Model Management" width="150" height="45">' : '<h1 class="ap-h-onglet">' + TITRES[o] + '</h1>';
    racine.innerHTML = '<header class="ap-tete">' + tete + (o === 'alertes' ? '' : '<a class="ap-cloche" href="#alertes" aria-label="Messages et alertes (' + nbAlertes + ')">🔔' + (nbAlertes ? '<b>' + nbAlertes + '</b>' : '') + '</a>') + '</header>' +
      '<main class="ap-ecran" id="ap-ecran">' + ECRANS[o]() + '</main>' + window.MA2M_APP.nav(o, { evenements: nbRepondre, alertes: nbAlertes }, true);
    document.title = (o === 'accueil' ? '' : TITRES[o] + ' · ') + 'MA2M Mannequin';
  }

  // ---------- volet de paiement (11/11/2026) ----------
  // « Payer avec Wave », « Payer à l'avance », « Mes reçus » : un volet par-dessus la page Paiements, sans changer de
  // page. Le paiement lui-même (Wave, numéro, « J'ai payé ») est celui de js/mes-paiements.js (window.PaiementMa2m).
  // Le volet est posé hors de l'écran : il reste ouvert au retour de Wave (l'écran, lui, est redessiné).
  function ouvrirVolet(mode) {
    if (!window.PaiementMa2m) { location.href = '/app/mes-paiements.html'; return; }
    fermerVolet();
    const fond = document.createElement('div');
    fond.className = 'ap-volet-fond'; fond.id = 'ap-volet';
    fond.dataset.couleurLibre = '';  // (voile sombre derrière le volet : seule exception au rouge et blanc)
    fond.innerHTML = '<div class="ap-volet" role="dialog" aria-modal="true" aria-labelledby="ap-volet-titre"><div class="ap-volet-tete">' +
      '<h2 id="ap-volet-titre">' + (mode === 'recus' ? 'Mes reçus' : 'Payer') + '</h2><button type="button" class="ap-volet-fermer" data-fermer-volet aria-label="Fermer">✕</button></div>' +
      '<div class="ap-volet-zone mp-colonne"></div></div>';
    fond.addEventListener('click', (e) => {
      if (e.target !== fond && !e.target.closest('[data-fermer-volet]')) return;
      fermerVolet();
      // le clavier revient au bouton qui avait ouvert le volet (redessiné : on le retrouve par son rôle)
      const retour = document.querySelector('[data-payer="' + mode + '"]'); if (retour) retour.focus();
    });
    document.body.appendChild(fond);
    document.body.classList.add('ap-volet-ouvert');
    // paiement déclaré : la page Paiements derrière se met tout de suite à jour (mois « en vérification »), même si
    // le volet est déjà fermé (le volet n'est pas touché : il est hors de l'écran redessiné)
    window.PaiementMa2m.monter(fond.querySelector('.ap-volet-zone'), { mode, surDeclare: () => {
      if (etat) sb.rpc('mes_mensualites').then(({ data }) => { if (data && etat) { etat.mensualites = data; afficher(); } }, () => null);
    } });
    fond.querySelector('[data-fermer-volet]').focus();
  }
  function fermerVolet() {
    const v = document.getElementById('ap-volet');
    if (v) v.remove();
    document.body.classList.remove('ap-volet-ouvert');
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.getElementById('ap-volet')) document.querySelector('#ap-volet [data-fermer-volet]').click(); });

  // ---------- actions ----------
  racine.addEventListener('toggle', (e) => { const m = e.target.closest && e.target.closest('[data-mini]'); if (m) programmeOuvert['mini-' + m.dataset.mini] = m.open; }, true);
  racine.addEventListener('click', async (e) => {
    const notif = e.target.closest('[data-notifications]');
    if (notif) { await activerNotifications(notif); return; }
    if (e.target.closest('[data-partager-book]')) { await partagerBook(); return; }
    const payer = e.target.closest('[data-payer]');
    if (payer) { ouvrirVolet(payer.dataset.payer); return; }
    const rep = e.target.closest('[data-repondre]'), per = e.target.closest('[data-periode]'), pas = e.target.closest('[data-passages]'), tout = e.target.closest('[data-programme]');
    if (tout) { programmeOuvert[tout.dataset.programme] = !programmeOuvert[tout.dataset.programme]; afficher(); return; }
    if (per) { periode = per.dataset.periode; afficher(); return; }
    if (e.target.closest('[data-ma-carte]')) periode = 'avenir';
    if (e.target.closest('[data-deconnexion]')) {
      fermerVolet();
      await Promise.race([desabonnerCeTelephone().catch(() => null), new Promise((r) => setTimeout(r, 3000))]);
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
  addEventListener('hashchange', () => { fermerVolet(); afficher(); scrollTo(0, 0); const nv = ongletCourant() === 'alertes' && document.querySelector('[data-nouveau]'); if (nv) nv.scrollIntoView({ block: 'center' }); });
  // de retour dans l'application (notification touchée, autre application) : les nouveaux messages
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !etat) return;
    lireMessages(etat.uid).then(({ data }) => {
      if (!data || !etat) return;
      const vus = new Set(etat.messages.filter((x) => x.nouveau).map((x) => x.id));
      etat.messages = data.map((x) => (vus.has(x.id) ? Object.assign(x, { nouveau: true }) : x));
      afficher();
    }, () => null);
  });


  // ---------- démarrage ----------
  // (session illisible, ex. stockage du navigateur bloqué : l'écran de connexion)
  // (mauvaise connexion : plus d'attente sans fin sur « Chargement… », captures réelles du 27/10/2026)
  function connexionLente() {
    racine.innerHTML = '<main class="ap-connexion"><div class="ap-carte">Connexion lente ou coupée : votre espace n’a pas pu être chargé. <button type="button" class="ap-btn rouge" id="ap-reessayer">Réessayer</button></div></main>';
    document.getElementById('ap-reessayer').addEventListener('click', () => demarrer());
  }
  function demarrer() { ouvrir().catch((e) => (e && e.code === 'delai' ? connexionLente() : ecranConnexion())); }
  async function ouvrir() {
    const { data } = await avecDelai(sb.auth.getSession(), 12000);
    if (!data || !data.session) { ecranConnexion(); return; }
    // (10/11/2026) mot de passe provisoire donné par l'agence : le choisir d'abord, dans l'Espace mannequin
    if (allerChoisirMdpSiProvisoire(data.session.user)) return;  // (js/supabase-config.js)
    racine.innerHTML = '<div class="ap-chargement"><img src="/icons/mannequin-192.png" alt="" width="96" height="96"><span>Chargement de votre espace…</span></div>';
    try {
      etat = await avecDelai(charger(data.session.user.id), 20000);
    } catch (e) {
      connexionLente();
      return;
    }
    if (!etat.profil) {
      racine.innerHTML = '<main class="ap-connexion"><div class="ap-carte">Ce compte n’est pas un compte mannequin. <button type="button" class="ap-lien" data-deconnexion>Se déconnecter</button></div></main>';
      return;
    }
    afficher();
    if (notificationsPossibles() && Notification.permission === 'granted') abonnerCeTelephone().catch(() => null);
  }
  demarrer();
})();
