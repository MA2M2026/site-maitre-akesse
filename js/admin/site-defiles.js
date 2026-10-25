// Nouvelle Administration — « Programmation défilé » (24/10/2026, demande de la propriétaire).
// Un défilé de l'Agenda, sur un ou plusieurs jours, se découpe en passages (jour, heure, salle,
// thème ou créateur, nombre de femmes et d'hommes). L'agence choisit le vivier (mannequins du site,
// du registre de l'agence sans compte, extérieures du carnet), puis « ⚡ Répartir » remplit tous
// les passages (js/defile-repartition.js : partage équitable, jamais deux passages trop rapprochés,
// choix faits à la main gardés). Chaque case se corrige à la main. Synthèse par mannequin, puis
// « Convoquer » (page Convocations sur le projet).
// Base : supabase-defiles.sql.
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const PAGE = 'b2-defiles';
  const nonActive = (e) => /defile_|42P01|PGRST20[25]/.test(String((e && (e.message || e.code)) || e));
  const PAS_ACTIVE = '<div class="carte vide">La Programmation défilé n’est pas encore activée : exécutez une fois le fichier supabase-defiles.sql dans Supabase.</div>';
  const aujourdhui = () => new Date().toISOString().slice(0, 10);
  const heure = (h) => h ? String(h).replace(':', 'h') : 'heure à préciser';
  // jours du projet (du premier au dernier), au plus 31
  function joursDu(p) {
    const jours = [], d = new Date(p.date_debut + 'T12:00:00Z'), fin = new Date((p.date_fin || p.date_debut) + 'T12:00:00Z');
    while (d <= fin && jours.length < 31) { jours.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
    return jours;
  }
  const jourLong = (j) => new Date(j + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  // sexe d'un profil du site (même règle que places_sexe, supabase-places.sql)
  const sexeProfil = (m) => m.category === 'homme' || (m.category !== 'femme' && m.civilite === 'Monsieur') ? 'homme' : 'femme';
  // personne du vivier : sa clé (profil du site, registre, carnet)
  const cleDe = (v) => v.model_id ? 'm:' + v.model_id : v.mannequin_id ? 'r:' + v.mannequin_id : 'c:' + v.contact_id;
  let ecran = null;  // { projet, passages, vivier, affectations, personnes: { cle: { nom, photo, sexe, origine } } }

  // ---------- Toutes les personnes qu'on peut choisir ----------
  async function personnesPossibles() {
    const [profils, registre, carnet] = await Promise.all([
      P.bd(sb.from('model_profiles').select('id, full_name, category, civilite').eq('published', true).order('full_name')),
      P.bd(sb.from('agence_mannequins').select('id, full_name, genre, user_id').eq('statut', 'actif').order('full_name')).catch(() => []),
      P.bd(sb.from('contacts_externes').select('id, civilite, nom, mannequin_id').order('nom')).catch(() => [])
    ]);
    const photos = await P.photosCouverture(profils.map((m) => m.id)).catch(() => ({}));
    const liste = {};
    profils.forEach((m) => { liste['m:' + m.id] = { cle: 'm:' + m.id, model_id: m.id, nom: m.full_name || '?', photo: photos[m.id] || '', sexe: sexeProfil(m), origine: 'agence' }; });
    registre.filter((r) => !r.user_id).forEach((r) => { liste['r:' + r.id] = { cle: 'r:' + r.id, mannequin_id: r.id, nom: r.full_name || '?', photo: '', sexe: r.genre === 'homme' ? 'homme' : 'femme', origine: 'agence' }; });
    liste.carnetRegistre = {};  // contact du carnet → mannequin du registre (réponses aux convocations)
    carnet.filter((c) => c.mannequin_id).forEach((c) => { liste.carnetRegistre[c.id] = c.mannequin_id; });
    carnet.filter((c) => !c.mannequin_id).forEach((c) => { liste['c:' + c.id] = { cle: 'c:' + c.id, contact_id: c.id, nom: [c.civilite, c.nom].filter(Boolean).join(' ') || '?', photo: '', sexe: c.civilite === 'Monsieur' ? 'homme' : 'femme', origine: 'exterieure' }; });
    return liste;
  }

  // ---------- Liste des défilés ----------
  async function liste() {
    let passages;
    try { passages = await P.bd(sb.from('defile_passages').select('projet_id, femmes, hommes')); } catch (e) { if (nonActive(e)) return P.entete('Programmation défilé') + PAS_ACTIVE; throw e; }
    const ids = [...new Set(passages.map((x) => x.projet_id))];
    const projets = ids.length ? await P.bd(sb.from('agenda_projets').select('id, titre, type, date_debut, date_fin, lieu, ville, annule').in('id', ids)) : [];
    const cartes = projets.sort((a, b) => String(b.date_debut).localeCompare(String(a.date_debut))).map((p, i) => {
      const siens = passages.filter((x) => x.projet_id === p.id);
      const f = siens.reduce((s, x) => s + x.femmes, 0), h = siens.reduce((s, x) => s + x.hommes, 0);
      return '<article class="projet-carte apparait" style="--i:' + Math.min(i, 10) + '"><div class="projet-tete"><h2>' + P.esc(p.titre) + '</h2>' +
        ((p.date_fin || p.date_debut) < aujourdhui() ? P.pastille('Terminé', 'neutre') : P.pastille('À venir', 'ok')) + '</div>' +
        '<p class="doux">' + P.esc(resumeProjet(p)) + '</p>' +
        '<p>' + P.pluriel(siens.length, 'passage', 'passages') + ' · ' + f + ' femmes, ' + h + ' hommes à placer</p>' +
        '<div class="ligne"><a class="btn rouge" href="#/site/' + PAGE + '/' + P.esc(p.id) + '">Ouvrir</a></div></article>';
    }).join('');
    return P.entete('Programmation défilé', '<button type="button" class="btn rouge" data-action="defile-nouveau">＋ Programmer un défilé</button>') +
      '<p class="doux">Un défilé de l’Agenda, jour par jour : les passages (heure, salle, thème), le nombre de femmes et d’hommes, puis la répartition automatique des mannequins, avec leurs visages.</p>' +
      (cartes ? '<div class="projets-liste">' + cartes + '</div>' : '<div class="carte vide">Aucun défilé programmé pour le moment.</div>');
  }
  P.actions['defile-nouveau'] = async () => {
    const projets = await P.bd(sb.from('agenda_projets').select('id, titre, date_debut, date_fin, annule').gte('date_debut', aujourdhui()).eq('annule', false).order('date_debut'));
    P.fenetre('<form class="grille" data-form="defile-nouveau"><h2>Programmer un défilé</h2>' +
      '<label class="fl" for="df-projet">Projet de l’Agenda<select id="df-projet" name="projet"><option value="">＋ Nouveau projet</option>' +
      projets.map((p) => '<option value="' + P.esc(p.id) + '">' + P.esc(P.date(p.date_debut) + ' — ' + p.titre) + '</option>').join('') + '</select></label>' +
      '<div id="df-nouveau" class="grille"><label class="fl" for="df-titre">Titre<input id="df-titre" name="titre" maxlength="160"></label>' +
      '<label class="fl" for="df-debut">Premier jour<input id="df-debut" name="debut" type="date"></label>' +
      '<label class="fl" for="df-fin">Dernier jour<input id="df-fin" name="fin" type="date"></label>' +
      '<label class="fl" for="df-lieu">Lieu<input id="df-lieu" name="lieu" maxlength="160"></label>' +
      '<label class="fl" for="df-client">Client<input id="df-client" name="client" maxlength="160"></label></div>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Continuer</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
  };
  P.formulaires['defile-nouveau'] = async (f) => {
    let id = String(f.get('projet') || '');
    if (!id) {
      const titre = String(f.get('titre') || '').trim(), debut = String(f.get('debut') || ''), fin = String(f.get('fin') || '') || null;
      if (!titre || !debut) { P.message('Choisissez un projet de l’Agenda, ou indiquez au moins le titre et le premier jour.'); return; }
      if (fin && fin < debut) { P.message('Le dernier jour doit être après le premier.'); return; }
      const r = await P.bd(sb.from('agenda_projets').insert({ type: 'defile', titre, date_debut: debut, date_fin: fin && fin !== debut ? fin : null,
        lieu: String(f.get('lieu') || '').trim() || null, client: String(f.get('client') || '').trim() || null, visible: false }).select('id'));
      if (!r || !r.length) { P.message('Le projet n’a pas pu être créé : reconnectez-vous puis réessayez.'); return; }
      id = r[0].id;
    }
    P.fenetre('');
    location.hash = '#/site/' + PAGE + '/' + id;
  };

  // ---------- Fiche d'un défilé ----------
  async function charger(id) {
    const [projets, passages, vivier] = await Promise.all([
      P.bd(sb.from('agenda_projets').select('*').eq('id', id)),
      P.bd(sb.from('defile_passages').select('*').eq('projet_id', id).order('jour').order('debut')),
      P.bd(sb.from('defile_vivier').select('*').eq('projet_id', id))
    ]);
    const affectations = passages.length ? await P.parPaquets(passages.map((x) => x.id), 100, (l) => P.bd(sb.from('defile_affectations').select('*').in('passage_id', l))) : [];
    const [personnes, reponses] = await Promise.all([personnesPossibles(),
      P.bd(sb.from('convocation_participants').select('model_id, contact_id, reponse').eq('projet_id', id)).catch(() => [])]);
    // qui a répondu « absente » à la convocation (à remplacer)
    const absentes = {};
    reponses.filter((x) => x.reponse === 'absent').forEach((x) => {
      if (x.model_id) absentes['m:' + x.model_id] = true;
      else if (x.contact_id) absentes[personnes.carnetRegistre[x.contact_id] ? 'r:' + personnes.carnetRegistre[x.contact_id] : 'c:' + x.contact_id] = true;
    });
    delete personnes.carnetRegistre;
    ecran = { projet: projets[0], passages, vivier, affectations, personnes, absentes };
    // une personne du vivier qui n'est plus proposée (profil retiré du site…) garde son nom
    vivier.forEach((v) => { if (!personnes[cleDe(v)]) personnes[cleDe(v)] = { cle: cleDe(v), nom: 'Mannequin retirée', photo: '', sexe: v.sexe, origine: '' }; });
  }
  const vivierDe = (cle) => ecran.vivier.find((v) => cleDe(v) === cle);
  const visage = (cle, petite) => { const x = ecran.personnes[cle] || { nom: '?' }; return P.visage(x.photo, x.nom, petite ? 'rond-vis' : 'df-vis'); };
  // dates et lieu d'un projet, sur une ligne
  const resumeProjet = (p, avecClient) => [P.date(p.date_debut) + (p.date_fin && p.date_fin !== p.date_debut ? ' → ' + P.date(p.date_fin) : ''),
    [p.lieu, p.ville].filter(Boolean).join(', '), avecClient && p.client ? 'client : ' + p.client : ''].filter(Boolean).join(' · ');
  // personnes placées, passage par passage ({ id du passage: [clés] }) ; seulementMain : celles placées à la main
  function parPassage(seulementMain) {
    const r = {};
    ecran.affectations.forEach((a) => {
      if (seulementMain && !a.a_la_main) return;
      const v = ecran.vivier.find((x) => x.id === a.vivier_id);
      if (v) (r[a.passage_id] = r[a.passage_id] || []).push(cleDe(v));
    });
    return r;
  }
  // temps minimum entre deux passages d'une même mannequin, gardé pour chaque défilé sur cet appareil
  const ECARTS = [30, 60, 90, 120, 180];
  const cleEcart = () => 'ma2m_ecart_defile_' + ecran.projet.id;
  function ecartChoisi() {
    let m = 90;
    try { m = Number(localStorage.getItem(cleEcart())); } catch (e) { /* appareil sans stockage */ }
    return ECARTS.includes(m) ? m : 90;
  }
  P.changements['defile-ecart'] = (el) => {
    try { localStorage.setItem(cleEcart(), String(Number(el.value) || 90)); } catch (e) { /* appareil sans stockage : 1 h 30 par défaut */ }
    return P.afficher();
  };
  // vivier pour la répartition, sans la personne remplacée ; les absentes gardent leurs places
  // choisies à la main mais ne sont jamais placées ailleurs (horsChoix)
  const vivierDisponible = (sauf) => ecran.vivier.filter((v) => v.id !== sauf).map((v) => ({ cle: cleDe(v), sexe: v.sexe, horsChoix: !!ecran.absentes[cleDe(v)] }));
  // enregistre une répartition : d'abord les nouvelles places, ensuite on retire les anciennes
  // qui n’y sont plus — une coupure en route ne vide jamais le programme
  async function enregistrerRepartition(r, fixes) {
    const idDe = {}, avant = {};
    ecran.vivier.forEach((v) => { idDe[cleDe(v)] = v.id; });
    ecran.affectations.forEach((a) => { avant[a.passage_id + '|' + a.vivier_id] = true; });
    const garder = {}, nouvelles = [];
    Object.keys(r.affectations).forEach((id) => r.affectations[id].forEach((c) => {
      const cle = id + '|' + idDe[c];
      garder[cle] = true;
      if (!avant[cle] && !(fixes[id] || []).includes(c)) nouvelles.push({ passage_id: id, vivier_id: idDe[c], a_la_main: false });
    }));
    // déjà placée depuis un autre appareil : la ligne existante est gardée telle quelle
    await P.parPaquets(nouvelles, 500, (l) => P.bd(sb.from('defile_affectations').upsert(l, { onConflict: 'passage_id,vivier_id', ignoreDuplicates: true }).select('passage_id')));
    // anciennes places à retirer : une demande par mannequin (tous ses passages d'un coup)
    const parMannequin = {};
    ecran.affectations.filter((a) => !garder[a.passage_id + '|' + a.vivier_id]).forEach((a) => { (parMannequin[a.vivier_id] = parMannequin[a.vivier_id] || []).push(a.passage_id); });
    for (const v of Object.keys(parMannequin)) {
      await P.parPaquets(parMannequin[v], 100, (l) => P.bd(sb.from('defile_affectations').delete().eq('vivier_id', v).in('passage_id', l).select('passage_id')));
    }
    return nouvelles.length;
  }
  const placesVides = (r) => Object.values(r.manques).reduce((s, m) => s + (m.femme || 0) + (m.homme || 0), 0);

  function blocPassages() {
    const jours = joursDu(ecran.projet);
    const horsDates = [...new Set(ecran.passages.map((x) => x.jour))].filter((j) => !jours.includes(j));
    const options = jours.map((j) => '<option value="' + j + '">' + P.esc(jourLong(j)) + '</option>').join('');
    const parJour = jours.concat(horsDates).sort().map((j) => {
      const siens = ecran.passages.filter((x) => x.jour === j);
      return '<div class="df-jour"><h3>' + P.esc(jourLong(j)) + '</h3>' + (siens.length ? '<ul class="df-passages">' + siens.map((x) =>
        '<li><b>' + P.esc(heure(x.debut)) + '</b> · ' + P.esc(x.salle || 'salle à préciser') + (x.theme ? ' · ' + P.esc(x.theme) : '') +
        ' <span class="doux">(' + x.femmes + ' F, ' + x.hommes + ' H)</span> <button type="button" class="btn petit" data-action="defile-passage-supprimer" data-id="' + P.esc(x.id) + '" aria-label="Supprimer ce passage">✕</button></li>').join('') + '</ul>' : '<p class="doux">Aucun passage ce jour-là.</p>') + '</div>';
    }).join('');
    return '<section class="carte"><h2>1. Les passages</h2>' + parJour +
      '<form class="grille df-ajout" data-form="defile-passage"><h3 class="large">＋ Ajouter un passage</h3>' +
      '<label class="fl" for="dp-jour">Jour<select id="dp-jour" name="jour">' + options + '<option value="tous">Tous les jours</option></select></label>' +
      '<label class="fl" for="dp-heure">Heure<input id="dp-heure" name="debut" type="time"></label>' +
      '<label class="fl" for="dp-salle">Salle ou lieu<input id="dp-salle" name="salle" maxlength="120" placeholder="ex : Salle A"></label>' +
      '<label class="fl" for="dp-theme">Thème ou créateur<input id="dp-theme" name="theme" maxlength="160"></label>' +
      '<label class="fl" for="dp-femmes">Femmes<input id="dp-femmes" name="femmes" type="number" min="0" max="200" value="0"></label>' +
      '<label class="fl" for="dp-hommes">Hommes<input id="dp-hommes" name="hommes" type="number" min="0" max="200" value="0"></label>' +
      '<div class="large"><button class="btn rouge" type="submit">Ajouter</button></div></form></section>';
  }
  function blocVivier() {
    const n = (sexe, origine) => ecran.vivier.filter((v) => v.sexe === sexe && (!origine || (ecran.personnes[cleDe(v)] || {}).origine === origine)).length;
    return '<section class="carte"><h2>2. Les mannequins retenues <span class="doux">(' + ecran.vivier.length + ')</span></h2>' +
      '<p>' + n('femme') + ' femmes (' + n('femme', 'agence') + ' de l’agence, ' + n('femme', 'exterieure') + ' extérieures) · ' + n('homme') + ' hommes (' + n('homme', 'agence') + ' de l’agence, ' + n('homme', 'exterieure') + ' extérieurs)</p>' +
      '<div class="df-vivier">' + ecran.vivier.map((v) => '<span class="df-mini" title="' + P.esc((ecran.personnes[cleDe(v)] || {}).nom || '') + '">' + visage(cleDe(v), true) + '</span>').join('') + '</div>' +
      '<div class="ligne"><button type="button" class="btn" data-action="defile-vivier">☑️ Choisir les mannequins</button></div></section>';
  }
  function blocRepartition() {
    const places = parPassage(), main = parPassage(true), manuel = {};
    Object.keys(main).forEach((id) => main[id].forEach((c) => { manuel[id + c] = true; }));
    const ecart = ecartChoisi();
    const conflits = conflitsDefile(ecran.passages, places, { ecartMinutes: ecart });
    const enConflit = {}; conflits.forEach((c) => { enConflit[c.a + c.cle] = enConflit[c.b + c.cle] = true; });
    const cartes = ecran.passages.map((x) => {
      const siens = places[x.id] || [];
      const ronds = (sexe, total) => {
        const l = siens.filter((c) => (ecran.personnes[c] || {}).sexe === sexe);
        let html = l.map((c) => '<button type="button" class="df-place prise' + (manuel[x.id + c] ? ' main' : '') + (enConflit[x.id + c] ? ' conflit' : '') + '" data-action="defile-retirer" data-passage="' + P.esc(x.id) + '" data-cle="' + P.esc(c) + '" title="' + P.esc((ecran.personnes[c] || {}).nom || '') + ' — toucher pour retirer">' + visage(c) + '</button>').join('');
        for (let i = l.length; i < total; i++) html += '<button type="button" class="df-place" data-action="defile-choisir" data-passage="' + P.esc(x.id) + '" data-sexe="' + sexe + '" aria-label="Place libre : choisir"></button>';
        return total || l.length ? '<div class="df-ronds" aria-label="' + (sexe === 'femme' ? 'Femmes' : 'Hommes') + '">' + html + '</div>' : '';
      };
      return '<article class="df-carte"><h3>' + P.esc(jourLong(x.jour)) + ' · ' + P.esc(heure(x.debut)) + '</h3><p class="doux">' + P.esc([x.salle, x.theme].filter(Boolean).join(' · ')) + '</p>' +
        ronds('femme', x.femmes) + ronds('homme', x.hommes) + '</article>';
    }).join('');
    // synthèse : nombre de passages de chacune
    const compte = {};
    Object.keys(places).forEach((id) => places[id].forEach((c) => { compte[c] = (compte[c] || 0) + 1; }));
    const synthese = ecran.vivier.map(cleDe).sort((a, b) => (compte[b] || 0) - (compte[a] || 0) || String((ecran.personnes[a] || {}).nom).localeCompare(String((ecran.personnes[b] || {}).nom)))
      .map((c) => '<li' + (ecran.absentes[c] ? ' class="absente"' : '') + '>' + visage(c, true) + ' <span>' + P.esc((ecran.personnes[c] || {}).nom || '?') + (ecran.absentes[c] ? ' <small>❌ absente</small>' : '') + '</span> <b>' + (compte[c] || 0) + '</b>' +
        (compte[c] ? ' <button type="button" class="btn petit" data-action="defile-remplacer" data-cle="' + P.esc(c) + '">Remplacer</button>' : '') + '</li>').join('');
    return '<section class="carte"><h2>3. La répartition</h2>' +
      '<div class="ligne"><button type="button" class="btn rouge" data-action="defile-repartir"' + (ecran.passages.length && ecran.vivier.length ? '' : ' disabled') + '>⚡ Répartir automatiquement</button>' +
      '<label class="ligne petit-texte" for="df-ecart">Temps minimum entre deux passages d’une même mannequin <select id="df-ecart" data-change="defile-ecart">' + ECARTS.map((m) => '<option value="' + m + '"' + (m === ecart ? ' selected' : '') + '>' + (m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' 30' : '') : m + ' min') + '</option>').join('') + '</select></label></div>' +
      '<p class="doux petit-texte">Les mannequins placées à la main (bord rouge) restent à leur place ; touchez un visage pour le retirer, une place vide pour la remplir. Un visage barré : deux passages trop rapprochés.</p>' +
      (conflits.length ? '<p class="note attention">⚠️ ' + P.pluriel(conflits.length, 'passage trop rapproché', 'passages trop rapprochés') + ' pour une même mannequin.</p>' : '') +
      '<div class="df-grille">' + (cartes || '<p class="doux">Ajoutez d’abord des passages.</p>') + '</div>' +
      (synthese ? '<h3>Passages par mannequin</h3><ul class="df-synthese">' + synthese + '</ul>' : '') +
      '<div class="ligne"><button type="button" class="btn rouge" data-action="defile-convoquer"' + (ecran.affectations.length ? '' : ' disabled') + '>📨 Convoquer les mannequins du défilé</button>' +
      '<button type="button" class="btn" data-action="defile-imprimer"' + (ecran.affectations.length ? '' : ' disabled') + '>🖨️ Imprimer le programme</button>' +
      '<button type="button" class="btn" data-action="cartes-acces" data-id="' + P.esc(ecran.projet.id) + '"' + (ecran.affectations.length ? '' : ' disabled') + '>🎫 Cartes d’événement</button></div>' +
      '<p class="doux petit-texte">Chaque mannequin convoquée reçoit son lien personnel : après avoir confirmé, elle voit sa fiche programme (ses passages, et tout le programme avec les visages).</p></section>';
  }
  async function fiche(id) {
    try { await charger(id); } catch (e) { if (nonActive(e)) return P.entete('Programmation défilé') + PAS_ACTIVE; throw e; }
    const p = ecran.projet;
    if (!p) return P.entete('Programmation défilé') + '<div class="carte vide">Ce projet n’existe plus.</div>';
    return P.entete('Défilé · ' + p.titre, '<a class="btn" href="#/site/' + PAGE + '">← Tous les défilés</a>') +
      '<p class="doux">' + P.esc(resumeProjet(p, true)) + '</p>' +
      blocPassages() + blocVivier() + blocRepartition();
  }

  // ---------- Actions ----------
  P.formulaires['defile-passage'] = async (f) => {
    const jour = String(f.get('jour') || ''), debut = String(f.get('debut') || '') || null;
    const ligne = { projet_id: ecran.projet.id, debut, salle: String(f.get('salle') || '').trim() || null, theme: String(f.get('theme') || '').trim() || null,
      femmes: Math.max(0, Number(f.get('femmes')) || 0), hommes: Math.max(0, Number(f.get('hommes')) || 0) };
    if (!ligne.femmes && !ligne.hommes) { P.message('Indiquez combien de femmes et/ou d’hommes défilent dans ce passage.'); return; }
    const jours = jour === 'tous' ? joursDu(ecran.projet) : [jour];
    const r = await P.bd(sb.from('defile_passages').insert(jours.map((j) => Object.assign({ jour: j }, ligne))).select('id'));
    if (!r || !r.length) { P.message('Le passage n’a pas pu être enregistré : reconnectez-vous puis réessayez.'); return; }
    P.message(P.pluriel(r.length, 'passage ajouté', 'passages ajoutés') + '.');
    return P.afficher();
  };
  P.actions['defile-passage-supprimer'] = async (el) => {
    if (!confirm('Supprimer ce passage et les mannequins qui y sont placées ?')) return;
    const r = await P.bd(sb.from('defile_passages').delete().eq('id', el.dataset.id).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été supprimé : reconnectez-vous puis réessayez.'); return; }
    return P.afficher();
  };
  // choisir le vivier : une case par visage, femmes puis hommes, agence puis extérieures
  P.actions['defile-vivier'] = () => {
    const dans = {}; ecran.vivier.forEach((v) => { dans[cleDe(v)] = true; });
    const groupe = (titre, filtre) => {
      const l = Object.values(ecran.personnes).filter(filtre).sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
      return l.length ? '<h3>' + P.esc(titre) + ' <span class="doux">(' + l.length + ')</span></h3><div class="df-choix">' + l.map((x) =>
        '<label class="df-choix-carte"><input type="checkbox" name="cle" value="' + P.esc(x.cle) + '"' + (dans[x.cle] ? ' checked' : '') + '>' + P.visage(x.photo, x.nom, 'df-vis') + '<span>' + P.esc(x.nom) + '</span></label>').join('') + '</div>' : '';
    };
    P.fenetre('<form class="grille df-fenetre" data-form="defile-vivier"><h2>Mannequins retenues pour le défilé</h2>' +
      groupe('Femmes de l’agence', (x) => x.sexe === 'femme' && x.origine === 'agence') + groupe('Femmes extérieures', (x) => x.sexe === 'femme' && x.origine === 'exterieure') +
      groupe('Hommes de l’agence', (x) => x.sexe === 'homme' && x.origine === 'agence') + groupe('Hommes extérieurs', (x) => x.sexe === 'homme' && x.origine === 'exterieure') +
      groupe('Retirées du site (gardées tant qu’elles sont cochées)', (x) => !x.origine && dans[x.cle]) +
      '<div class="ligne"><button class="btn rouge" type="submit">Enregistrer</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
  };
  P.formulaires['defile-vivier'] = async (f) => {
    const voulues = new Set(f.getAll('cle'));
    const enlever = ecran.vivier.filter((v) => !voulues.has(cleDe(v)));
    const ajouter = [...voulues].filter((c) => !vivierDe(c)).map((c) => {
      const x = ecran.personnes[c];
      return { projet_id: ecran.projet.id, model_id: x.model_id || null, mannequin_id: x.mannequin_id || null, contact_id: x.contact_id || null, sexe: x.sexe };
    });
    if (enlever.length && !confirm(P.pluriel(enlever.length, 'mannequin retirée', 'mannequins retirées') + ' du défilé : elles quittent aussi leurs passages. Continuer ?')) return;
    if (enlever.length) await P.bd(sb.from('defile_vivier').delete().in('id', enlever.map((v) => v.id)).select('id'));
    if (ajouter.length) await P.bd(sb.from('defile_vivier').insert(ajouter).select('id'));
    P.fenetre('');
    P.message('Mannequins retenues : ' + voulues.size + '.');
    return P.afficher();
  };
  // répartition automatique : on garde ce qui a été placé à la main, on refait le reste
  P.actions['defile-repartir'] = async () => {
    const ecart = ecartChoisi();
    const fixes = parPassage(true);
    const r = repartirDefile(ecran.passages, vivierDisponible(), fixes, { ecartMinutes: ecart });
    await enregistrerRepartition(r, fixes);
    const manque = placesVides(r);
    P.message('Répartition faite.' + (manque ? ' ⚠️ ' + P.pluriel(manque, 'place reste vide', 'places restent vides') + ' : ajoutez des mannequins au vivier, ou laissez plus de temps entre deux passages.' : ''));
    return P.afficher();
  };
  P.actions['defile-retirer'] = async (el) => {
    const v = vivierDe(el.dataset.cle);
    if (!v) return;
    const r = await P.bd(sb.from('defile_affectations').delete().eq('passage_id', el.dataset.passage).eq('vivier_id', v.id).select('passage_id'));
    if (!r || !r.length) { P.message('Rien n’a été retiré : reconnectez-vous puis réessayez.'); return; }
    return P.afficher();
  };
  // place vide : choisir parmi celles du vivier (du bon sexe) qui ne sont pas déjà dans ce passage
  P.actions['defile-choisir'] = (el) => {
    const passage = el.dataset.passage, deja = {};
    ecran.affectations.filter((a) => a.passage_id === passage).forEach((a) => { deja[a.vivier_id] = true; });
    const compte = {}; ecran.affectations.forEach((a) => { compte[a.vivier_id] = (compte[a.vivier_id] || 0) + 1; });
    const libres = ecran.vivier.filter((v) => v.sexe === el.dataset.sexe && !deja[v.id] && !ecran.absentes[cleDe(v)]).sort((a, b) => (compte[a.id] || 0) - (compte[b.id] || 0));
    if (!libres.length) { P.message('Plus personne de disponible dans le vivier pour cette place : ajoutez des mannequins (« Choisir les mannequins »).'); return; }
    P.fenetre('<div class="grille"><h2>Choisir pour cette place</h2><div class="df-choix">' + libres.map((v) =>
      '<button type="button" class="df-choix-carte" data-action="defile-placer" data-passage="' + P.esc(passage) + '" data-vivier="' + P.esc(v.id) + '">' + visage(cleDe(v)) +
      '<span>' + P.esc((ecran.personnes[cleDe(v)] || {}).nom || '?') + ' <small class="doux">' + P.pluriel(compte[v.id] || 0, 'passage', 'passages') + '</small></span></button>').join('') + '</div>' +
      '<button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div>');
  };
  P.actions['defile-placer'] = async (el) => {
    const r = await P.bd(sb.from('defile_affectations').insert({ passage_id: el.dataset.passage, vivier_id: el.dataset.vivier, a_la_main: true }).select('passage_id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    P.fenetre('');
    return P.afficher();
  };
  // convoquer : chaque mannequin placée devient participante (profil du site, registre, carnet :
  // defile_participants), puis page Convocations sur le projet
  P.actions['defile-convoquer'] = async () => {
    await P.rpc('defile_participants', { p_projet: ecran.projet.id });
    if (typeof window.convoquerProjet === 'function') window.convoquerProjet(ecran.projet.id);
    else { window.convocationDemandee = ecran.projet.id; location.hash = '#/site/b2-convocations'; }
  };

  // remplacer une mannequin (absente, malade…) : elle quitte ses passages, les places se remplissent
  // avec les autres du vivier (mêmes règles que « Répartir » ; tout le reste ne bouge pas)
  P.actions['defile-remplacer'] = async (el) => {
    const v = vivierDe(el.dataset.cle), nom = (ecran.personnes[el.dataset.cle] || {}).nom || 'cette mannequin';
    if (!v || !confirm('Retirer ' + nom + ' de ses passages et la remplacer ?')) return;
    const fixes = parPassage(), cle = el.dataset.cle;
    Object.keys(fixes).forEach((id) => { fixes[id] = fixes[id].filter((c) => c !== cle); });
    const r = repartirDefile(ecran.passages, vivierDisponible(v.id), fixes, { ecartMinutes: ecartChoisi() });
    const placees = await enregistrerRepartition(r, fixes);
    const manque = placesVides(r);
    P.message(nom + ' est retirée de ses passages : ' + P.pluriel(placees, 'remplaçante placée', 'remplaçantes placées') + (manque ? ' ; ⚠️ ' + P.pluriel(manque, 'place reste vide', 'places restent vides') : '') + '. Pensez à prévenir les remplaçantes (Convocations).');
    return P.afficher();
  };
  // programme à imprimer (coulisses) : jour par jour, chaque passage avec les noms ; « Enregistrer
  // en PDF » dans la fenêtre d'impression du téléphone ou de l'ordinateur
  P.actions['defile-imprimer'] = () => {
    const p = ecran.projet, places = parPassage();
    let html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Programme — ' + P.esc(p.titre) + '</title><style>' +
      'body{font-family:Arial,sans-serif;margin:24px;color:#1b1817}h1{margin:0 0 4px}h2{margin:22px 0 8px;text-transform:capitalize;border-bottom:2px solid #B00E28}' +
      '.p{break-inside:avoid;margin:0 0 12px;padding:10px;border:1px solid #ccc;border-radius:8px}.p b{display:block;margin-bottom:6px}.n{display:inline-block;margin:2px 10px 2px 0}.doux{color:#666}</style></head><body>' +
      '<h1>' + P.esc(p.titre) + '</h1><p class="doux">' + P.esc(resumeProjet(p)) + '</p>';
    let jour = null;
    ecran.passages.forEach((x) => {
      if (x.jour !== jour) { jour = x.jour; html += '<h2>' + P.esc(jourLong(jour)) + '</h2>'; }
      const noms = (places[x.id] || []).map((c) => ({ nom: (ecran.personnes[c] || {}).nom || '?', sexe: vivierDe(c).sexe })).sort((a, b) => a.sexe.localeCompare(b.sexe)).map((v) => '<span class="n">' + (v.sexe === 'homme' ? '♂ ' : '♀ ') + P.esc(v.nom) + '</span>').join('');
      html += '<div class="p"><b>' + P.esc([heure(x.debut), x.salle, x.theme].filter(Boolean).join(' · ')) + '</b>' + (noms || '<span class="doux">Personne pour le moment</span>') + '</div>';
    });
    const w = window.open('', '_blank');
    if (!w) { P.message('La fenêtre d’impression a été bloquée par le navigateur : autorisez les fenêtres pour ce site, puis réessayez.'); return; }
    w.document.write(html + '</body></html>'); w.document.close(); w.focus(); w.print();
  };

  P.espaces.site.pages[PAGE] = (args) => (args && args[0] ? fiche(decodeURIComponent(args[0])) : liste());
})();
