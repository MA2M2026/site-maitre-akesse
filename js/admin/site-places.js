// Nouvelle Administration — « Places limitées » (23/10/2026, demande de la propriétaire).
// Pour un projet de l'agenda (existant ou créé ici : il s'ajoute à l'agenda), l'agence ouvre un
// nombre de places par sexe ; chaque mannequin reçoit SON lien sur WhatsApp, un message à la
// fois (bouton « Envoyer le lien suivant », comme les convocations) ; une mineure et son parent
// reçoivent le même lien. Premier arrivé, premier servi (page publique places.html) ; la grille
// des places se remplit avec les visages. Une place libérée (désistement) peut être annoncée
// à celles qui n'en ont pas. Les sélectionnées sont ajoutées au projet : « Convocations » pour
// l'annonce de la sélection, la convocation et les relances.
// Base : supabase-places.sql. Textes : messagePlaces (js/messages-convocations.js).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const PAGE = 'b2-places';
  const lienFiche = (id) => '#/site/b2-mannequins-publies/' + encodeURIComponent(id);
  // une invitation vise un profil du site (model_id) ou une mannequin du registre de l'agence sans
  // compte (mannequin_id, 23/10/2026) : cle() les distingue dans les listes de noms et de contacts
  const cle = (i) => i.model_id || 'r:' + i.mannequin_id;
  // le visage (photo du profil, sinon initiales) devant le nom, partout ; lien vers la fiche
  // seulement pour un profil du site
  function visageNom(i, noms, photos) {
    const nom = noms[cle(i)] || '?', vis = P.visage((i.model_id && photos[i.model_id]) || '', nom, 'rond-vis');
    return i.model_id ? '<a class="visage-lien" href="' + P.esc(lienFiche(i.model_id)) + '" tabindex="-1" aria-hidden="true">' + vis + '</a> <a href="' + P.esc(lienFiche(i.model_id)) + '">' + P.esc(nom) + '</a>'
      : vis + ' <span>' + P.esc(nom) + '</span>';
  }
  const aujourdhui = () => new Date().toISOString().slice(0, 10);
  const passe = (p) => !p || p.annule || (p.date_fin || p.date_debut) < aujourdhui();
  const nonActive = (e) => /places_(appels|invitations|preparer)|42P01|PGRST20[25]/.test(String((e && (e.message || e.code)) || e));
  const PAS_ACTIVE = '<div class="carte vide">Les Places limitées ne sont pas encore activées : exécutez une fois le fichier supabase-places.sql dans Supabase.</div>';
  let ecran = null;  // fiche affichée : { appel, projet, invitations, contacts, photos }
  let choixOuvert = false;  // « Qui reçoit le lien ? » reste ouvert pendant qu'on coche

  // places prises par sexe, et ce qui reste
  function comptes(appel, invitations) {
    const pris = (s) => invitations.filter((i) => i.sexe === s && i.statut === 'pris').length;
    return { femmes: pris('femme'), hommes: pris('homme'),
      libres: { femme: Math.max(0, appel.places_femmes - pris('femme')), homme: Math.max(0, appel.places_hommes - pris('homme')) } };
  }
  // la grille : une case par place, le visage de qui l'a prise (clic : sa fiche)
  function grille(titre, total, prises, noms, photos) {
    if (!total) return '';
    let cases = '';
    for (let i = 0; i < total; i++) {
      const x = prises[i];
      const vis = x && P.visage((x.model_id && photos[x.model_id]) || '', noms[cle(x)] || '?', 'rond-vis');
      cases += x ? '<li class="pl-case prise">' + (x.model_id ? '<a href="' + P.esc(lienFiche(x.model_id)) + '" title="' + P.esc(noms[cle(x)] || '') + '">' + vis + '</a>' : '<span title="' + P.esc(noms[cle(x)] || '') + '">' + vis + '</span>') + '</li>'
        : '<li class="pl-case" aria-label="Place libre"></li>';
    }
    return '<h3 class="pl-titre-grille">' + P.esc(titre) + ' : ' + prises.length + ' / ' + total + '</h3><ul class="pl-grille">' + cases + '</ul>';
  }
  const etatAppel = (appel, projet) => passe(projet) ? P.pastille('Terminé', 'neutre') : appel.ouvert ? P.pastille('Ouvert', 'ok') : P.pastille('Fermé', 'neutre');
  const resume = (p) => [P.date(p.date_debut), p.heure_evenement ? p.heure_evenement.replace(':', 'h') : '', [p.lieu, p.ville].filter(Boolean).join(', ')].filter(Boolean).join(' · ');

  // ---------- Liste des appels ----------
  async function liste() {
    const bouton = '<button type="button" class="btn rouge" data-action="places-nouveau">＋ Nouvel appel à places</button>';
    let appels;
    try { appels = await P.bd(sb.from('places_appels').select('*')); } catch (e) { if (nonActive(e)) return P.entete('Places limitées') + PAS_ACTIVE; throw e; }
    const ids = appels.map((a) => a.projet_id);
    const [projets, pris] = ids.length ? await Promise.all([
      P.bd(sb.from('agenda_projets').select('id, type, titre, date_debut, date_fin, heure_evenement, lieu, ville, annule').in('id', ids)),
      P.bd(sb.from('places_invitations').select('*').in('projet_id', ids).eq('statut', 'pris').order('pris_le'))
    ]) : [[], []];
    const modeles = [...new Set(pris.map((x) => x.model_id).filter(Boolean))];
    const [noms, photos, registre] = await Promise.all([nomsDe(modeles), P.photosCouverture(modeles), contactsRegistre([...new Set(pris.map((x) => x.mannequin_id).filter(Boolean))])]);
    registre.forEach((c) => { noms['r:' + c.mannequin_id] = c.full_name; });
    const cartes = appels.map((a) => ({ a, p: projets.find((x) => x.id === a.projet_id) })).filter((x) => x.p)
      .sort((x, y) => String(y.p.date_debut).localeCompare(String(x.p.date_debut)))
      .map(({ a, p }, i) => {
        const siens = pris.filter((x) => x.projet_id === a.projet_id);
        return '<article class="projet-carte apparait" style="--i:' + Math.min(i, 10) + '"><div class="projet-tete"><h2>' + P.esc(p.titre) + '</h2>' + etatAppel(a, p) + '</div>' +
          '<p class="doux">' + P.esc(resume(p)) + '</p>' +
          grille('Femmes', a.places_femmes, siens.filter((x) => x.sexe === 'femme'), noms, photos) +
          grille('Hommes', a.places_hommes, siens.filter((x) => x.sexe === 'homme'), noms, photos) +
          '<div class="ligne"><a class="btn rouge" href="#/site/' + PAGE + '/' + P.esc(a.projet_id) + '">Ouvrir</a></div></article>';
      }).join('');
    return P.entete('Places limitées', bouton) +
      '<p class="doux">Premier arrivé, premier servi : chaque mannequin reçoit son lien personnel sur WhatsApp (le même pour une mineure et son parent). Les sélectionnées sont ajoutées au projet, pour la convocation.</p>' +
      (cartes ? '<div class="projets-liste">' + cartes + '</div>' : '<div class="carte vide">Aucun appel à places pour le moment.</div>');
  }
  // coordonnées des mannequins invitées, par paquets (la base renvoie au plus 1 000 lignes à la fois)
  async function contactsDe(ids) {
    let tous = [];
    for (let i = 0; i < ids.length; i += 500) tous = tous.concat(await P.rpc('convocation_contacts_mannequins', { p_ids: ids.slice(i, i + 500) }));
    return tous;
  }
  // coordonnées des mannequins du registre sans compte (fonction ajoutée le 23/10/2026 : avant
  // l'exécution de supabase-places.sql, aucune)
  async function contactsRegistre(ids) {
    let tous = [];
    try {
      for (let i = 0; i < ids.length; i += 500) tous = tous.concat(await P.rpc('places_contacts_registre', { p_ids: ids.slice(i, i + 500) }));
    } catch (e) { if (!/places_contacts_registre|PGRST202|42883/.test(String((e && (e.message || e.code)) || e))) throw e; }
    return tous;
  }
  // noms des mannequins (par paquets : une longue liste d'identifiants ne tient pas dans une adresse)
  async function nomsDe(ids) {
    const noms = {};
    for (let i = 0; i < ids.length; i += 100) {
      (await P.bd(sb.from('model_profiles').select('id, full_name').in('id', ids.slice(i, i + 100)))).forEach((m) => { noms[m.id] = m.full_name; });
    }
    return noms;
  }

  // ---------- Nouvel appel ----------
  P.actions['places-nouveau'] = async () => {
    const [projets, appels] = await Promise.all([
      P.bd(sb.from('agenda_projets').select('id, titre, date_debut, date_fin, annule').gte('date_debut', aujourdhui()).eq('annule', false).order('date_debut')),
      P.bd(sb.from('places_appels').select('projet_id'))
    ]);
    const libres = projets.filter((p) => !appels.some((a) => a.projet_id === p.id));
    const types = typeof MA2M_TYPES_AGENDA === 'object' ? Object.keys(MA2M_TYPES_AGENDA) : ['defile', 'shooting', 'casting', 'formation', 'evenement', 'autre'];
    P.fenetre('<form class="f" data-form="places-creer"><h2>Nouvel appel à places</h2>' +
      '<label class="fl large" for="pl-projet">Projet<select id="pl-projet" name="projet" data-change="places-projet" data-direct><option value="">➕ Nouveau projet (ajouté à l’agenda)</option>' +
      libres.map((p) => '<option value="' + P.esc(p.id) + '">' + P.esc(P.date(p.date_debut) + ' — ' + p.titre) + '</option>').join('') + '</select></label>' +
      '<div id="pl-nouveau" class="large f-sous">' +
      '<label class="fl" for="pl-titre">Titre<input id="pl-titre" name="titre" maxlength="160" placeholder="ex : Défilé Africa in Rhythm"></label>' +
      '<label class="fl" for="pl-type">Type<select id="pl-type" name="type">' + types.map((t) => '<option value="' + t + '"' + (t === 'defile' ? ' selected' : '') + '>' + P.esc(typeof libelleTypeAgenda === 'function' ? libelleTypeAgenda(t) : t) + '</option>').join('') + '</select></label>' +
      '<label class="fl" for="pl-date">Date<input id="pl-date" name="date" type="date" min="' + aujourdhui() + '"></label>' +
      '<label class="fl" for="pl-heure">Heure de l’événement<input id="pl-heure" name="heure" type="time"></label>' +
      '<label class="fl" for="pl-lieu">Lieu<input id="pl-lieu" name="lieu" maxlength="160"></label>' +
      '<label class="fl" for="pl-ville">Ville<input id="pl-ville" name="ville" maxlength="80" value="Abidjan"></label>' +
      '<label class="fl large"><span><input type="checkbox" name="visible" checked> Montrer ce projet sur l’agenda du site (sans les noms)</span></label></div>' +
      '<label class="fl" for="pl-femmes">Places pour les femmes<input id="pl-femmes" name="femmes" type="number" min="0" max="500" value="0" inputmode="numeric"></label>' +
      '<label class="fl" for="pl-hommes">Places pour les hommes<input id="pl-hommes" name="hommes" type="number" min="0" max="500" value="0" inputmode="numeric"></label>' +
      '<p class="doux large">Un lien personnel est préparé pour chaque mannequin du sexe concerné. Rien n’est envoyé tout de suite : vous enverrez les messages un par un.</p>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">Créer l’appel et préparer les liens</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
  };
  P.changements['places-projet'] = (el) => { const b = document.getElementById('pl-nouveau'); if (b) b.hidden = !!el.value; };
  P.formulaires['places-creer'] = async (f) => {
    const femmes = Math.max(0, Math.min(500, parseInt(f.get('femmes'), 10) || 0)), hommes = Math.max(0, Math.min(500, parseInt(f.get('hommes'), 10) || 0));
    if (!femmes && !hommes) { P.message('Indiquez au moins une place (femmes ou hommes).'); return; }
    let id = f.get('projet'), nouveau = false;
    if (!id) {
      const titre = String(f.get('titre') || '').trim(), date = f.get('date');
      if (!titre || !date) { P.message('Indiquez au moins le titre et la date du nouveau projet.'); return; }
      if (date < aujourdhui()) { P.message('Cette date est déjà passée.'); return; }
      const cree = await P.bd(sb.from('agenda_projets').insert({ titre, type: f.get('type') || 'defile', date_debut: date, heure_evenement: f.get('heure') || null,
        lieu: String(f.get('lieu') || '').trim() || null, ville: String(f.get('ville') || '').trim() || null, visible: f.get('visible') === 'on' }).select('id'));
      if (!cree || !cree.length) { P.message('Le projet n’a pas pu être créé : reconnectez-vous puis réessayez.'); return; }
      id = cree[0].id;
      nouveau = true;
    }
    // l'appel n'a pas pu être enregistré : le projet tout juste créé est retiré de l'agenda
    // (sinon il resterait seul, et un nouvel essai le créerait une seconde fois)
    const retirer = () => nouveau ? P.bd(sb.from('agenda_projets').delete().eq('id', id).select('id')).catch(() => null) : null;
    let r;
    try { r = await P.bd(sb.from('places_appels').insert({ projet_id: id, places_femmes: femmes, places_hommes: hommes, ouvert: true }).select('projet_id')); }
    catch (e) { await retirer(); throw e; }
    if (!r || !r.length) { await retirer(); P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    const n = await P.rpc('places_preparer', { p_projet: id });
    P.fenetre('');
    P.message('Appel créé : ' + n + ' lien' + (n > 1 ? 's' : '') + ' personnel' + (n > 1 ? 's' : '') + ' prêt' + (n > 1 ? 's' : '') + '.');
    location.hash = '#/site/' + PAGE + '/' + id;
  };

  // ---------- Fiche d'un appel ----------
  // destinataires WhatsApp d'une invitation : la mannequin (si elle a un numéro, ou si elle est
  // majeure) et, pour une mineure, son parent — même lien, avec &p=1
  function destinataires(inv) {
    const c = ecran.contacts[cle(inv)];
    if (!c) return [];
    const nom = nomAvecCivilite({ full_name: c.full_name, category: c.category }), liste = [];
    const mineure = estMineurDossier({ date_naissance: c.date_naissance });
    if (numeroWhatsApp(c.phone)) liste.push({ inv, cle: inv.id, parent: false, nom, tel: c.phone, envoye: inv.envoye_le });
    if (mineure && numeroWhatsApp(c.parent_telephone)) liste.push({ inv, cle: inv.id + '-p', parent: true, nom, parent_nom: c.parent_nom, tel: c.parent_telephone, envoye: inv.parent_envoye_le });
    return liste;
  }
  const lienWa = (d, sorte) => 'https://wa.me/' + numeroWhatsApp(d.tel) + '?text=' + encodeURIComponent(messagePlaces(ecran.projet, ecran.appel,
    { nom: d.nom, sexe: d.inv.sexe, parent: d.parent, parent_nom: d.parent_nom, jeton: d.inv.jeton }, sorte));
  const visageBouton = (d) => P.visage((d.inv.model_id && ecran.photos[d.inv.model_id]) || '', d.nom, 'rond-vis pl-btn-vis');
  const nomDe = (d) => d.parent ? d.nom + ' (parent : ' + (d.parent_nom || 'Madame, Monsieur') + ')' : d.nom;
  // annonce d'une place libérée : qui a déjà été prévenu, retenu le temps de la session
  const cleLibre = () => 'ma2m_places_libre_' + ecran.appel.projet_id;
  function annonceLibre() { try { return JSON.parse(sessionStorage.getItem(cleLibre()) || 'null'); } catch (e) { return null; } }
  function noterLibre(v) { try { if (v) sessionStorage.setItem(cleLibre(), JSON.stringify(v)); else sessionStorage.removeItem(cleLibre()); } catch (e) { /* stockage bloqué */ } }

  // envoi des liens, un par un (mannequins choisies seulement), et annonce d'une place libérée
  function blocEnvoi(invitations, n, noms) {
    const choisies = invitations.filter((i) => i.statut !== 'exclu');
    const tous = choisies.flatMap(destinataires);
    const sansNumero = choisies.filter((i) => !destinataires(i).length);
    const aEnvoyer = tous.filter((d) => !d.envoye && d.inv.statut !== 'pris' && n.libres[d.inv.sexe] > 0);
    const libres = n.libres.femme + n.libres.homme;
    const envoyes = tous.filter((d) => d.envoye).length;
    const pluriel = (k, mot) => k + ' ' + mot + (k > 1 ? 's' : '');
    let html = '<p>' + pluriel(envoyes, 'message') + ' ' + (envoyes > 1 ? 'envoyés' : 'envoyé') + ' sur ' + tous.length + '.</p>';
    if (aEnvoyer.length) {
      html += '<a class="btn rouge" target="_blank" rel="noopener" data-places-wa="' + P.esc(aEnvoyer[0].cle) + '" href="' + P.esc(lienWa(aEnvoyer[0], 'appel')) + '">' + visageBouton(aEnvoyer[0]) + '💬 Envoyer le lien suivant : ' + P.esc(nomDe(aEnvoyer[0])) + ' (' + pluriel(aEnvoyer.length, 'restant') + ')</a>';
    } else {
      html += '<p class="doux">' + (libres ? 'Tous les liens ont été envoyés.' : 'Toutes les places sont prises : plus de lien à envoyer.') + '</p>';
    }
    if (tous.length) html += ' <button type="button" class="btn petit" data-action="places-apercu">👁️ Voir le message</button>';
    // place libérée : prévenir celles qui n'ont pas de place (après le premier envoi)
    const sansPlace = (d) => d.envoye && d.inv.statut !== 'pris' && n.libres[d.inv.sexe] > 0;
    const annonce = annonceLibre();
    if (annonce) {
      const restantes = tous.filter((d) => sansPlace(d) && !annonce.faits[d.cle]);
      let suite;
      if (restantes.length && libres) suite = '<a class="btn rouge" target="_blank" rel="noopener" data-places-libre="' + P.esc(restantes[0].cle) + '" href="' + P.esc(lienWa(restantes[0], 'place_libre')) + '">' + visageBouton(restantes[0]) + '💬 Prévenir la suivante : ' + P.esc(nomDe(restantes[0])) + ' (' + pluriel(restantes.length, 'restante') + ')</a>';
      else suite = '<p class="doux">' + (libres ? 'Tout le monde a été prévenu.' : 'La place a été reprise.') + '</p>';
      html += '<h3 class="pl-titre-grille">📣 Annonce d’une place libre</h3>' + suite + ' <button type="button" class="btn petit" data-action="places-libre-fin">Terminer l’annonce</button>';
    } else if (libres && tous.some(sansPlace) && invitations.some((i) => i.statut === 'desiste')) {
      html += '<p><button type="button" class="btn" data-action="places-libre">📣 Annoncer une place libre</button></p>';
    }
    if (sansNumero.length) html += '<details class="pl-sans"><summary>Sans numéro WhatsApp (' + sansNumero.length + ')</summary><ul class="pl-noms">' + sansNumero.map((i) => '<li>' + visageNom(i, noms, ecran.photos) + '</li>').join('') + '</ul></details>';
    return html;
  }
  // « Qui reçoit le lien ? » : une case par mannequin ; décochée, elle ne reçoit rien et ne peut
  // pas prendre de place (statut « exclu », même si on lui transfère un lien)
  function blocChoix(invitations, noms, photos) {
    const ordre = invitations.slice().sort((a, b) => String(noms[cle(a)] || '').localeCompare(String(noms[cle(b)] || ''), 'fr'));
    const choisies = invitations.filter((i) => i.statut !== 'exclu').length;
    const ligne = (i) => {
      const pris = i.statut === 'pris' || i.statut === 'desiste';
      return '<li><label class="pl-choix"><input type="checkbox" data-change="places-choix" data-id="' + P.esc(i.id) + '"' + (i.statut === 'exclu' ? '' : ' checked') + (pris ? ' disabled' : '') + '> ' +
        P.visage((i.model_id && photos[i.model_id]) || '', noms[cle(i)] || '?', 'rond-vis') + ' <span>' + P.esc(noms[cle(i)] || '?') + (!i.model_id ? ' <small class="doux">(sans compte sur le site)</small>' : '') + (pris ? ' <small class="doux">(' + (i.statut === 'pris' ? 'place prise' : 'désistée') + ')</small>' : '') + '</span></label></li>';
    };
    return '<details class="carte pl-qui"' + (choixOuvert ? ' open' : '') + '><summary><h2>Qui reçoit le lien ? (' + choisies + ' sur ' + invitations.length + ')</h2></summary>' +
      '<p class="doux">Décochez les mannequins qui ne doivent pas recevoir ce projet : elles ne reçoivent rien et ne peuvent pas prendre de place.</p>' +
      '<div class="ligne"><button type="button" class="btn petit" data-action="places-tous" data-valeur="invite">Tout cocher</button><button type="button" class="btn petit" data-action="places-tous" data-valeur="exclu">Tout décocher</button></div>' +
      '<ul class="pl-noms pl-liste-choix">' + ordre.map(ligne).join('') + '</ul></details>';
  }

  async function fiche(id) {
    let appel;
    try { appel = (await P.bd(sb.from('places_appels').select('*').eq('projet_id', id)))[0]; } catch (e) { if (nonActive(e)) return P.entete('Places limitées') + PAS_ACTIVE; throw e; }
    const retour = '<a class="btn" href="#/site/' + PAGE + '">← Tous les appels</a>';
    if (!appel) return P.entete('Places limitées', retour) + '<div class="carte vide">Cet appel à places n’existe plus.</div>';
    const [projets, invitations] = await Promise.all([
      P.bd(sb.from('agenda_projets').select('*').eq('id', id)),
      lireToutesLignes(() => sb.from('places_invitations').select('*').eq('projet_id', id).order('id')).then((r) => { if (r.error) throw r.error; return r.data; })
    ]);
    const projet = projets[0];
    if (!projet) return P.entete('Places limitées', retour) + '<div class="carte vide">Le projet de cet appel a été supprimé de l’agenda.</div>';
    const ids = invitations.map((i) => i.model_id).filter(Boolean);
    const [contacts, photos, registre] = await Promise.all([
      contactsDe(ids),
      P.photosCouverture(ids),
      contactsRegistre(invitations.map((i) => i.mannequin_id).filter(Boolean))
    ]);
    ecran = { appel, projet, invitations, photos, contacts: {} };
    contacts.forEach((c) => { ecran.contacts[c.model_id] = c; });
    // registre : mêmes champs que convocation_contacts_mannequins (genre → category)
    registre.forEach((c) => { ecran.contacts['r:' + c.mannequin_id] = Object.assign({}, c, { category: c.genre }); });
    const noms = {};
    Object.keys(ecran.contacts).forEach((k) => { const c = ecran.contacts[k]; noms[k] = nomAvecCivilite({ full_name: c.full_name, category: c.category }); });
    const n = comptes(appel, invitations), fini = passe(projet);
    const prises = (s) => invitations.filter((i) => i.sexe === s && i.statut === 'pris').sort((a, b) => String(a.pris_le).localeCompare(String(b.pris_le)));

    const envoi = fini || !appel.ouvert ? '' : blocEnvoi(invitations, n, noms);
    const ligneNom = (i) => '<li>' + visageNom(i, noms, photos) +
      ' <span class="doux">' + (i.statut === 'pris' ? (i.pris_par === 'parent' ? 'place prise par le parent' : 'place prise') + ' le ' + P.esc(new Date(i.pris_le).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : 'désistement') + '</span></li>';
    const selectionnees = [...prises('femme'), ...prises('homme')], desistees = invitations.filter((i) => i.statut === 'desiste');
    return P.entete('Places limitées · ' + projet.titre, retour + '<button type="button" class="btn" data-action="places-actualiser">🔄 Actualiser</button>') +
      '<p class="doux">' + P.esc(resume(projet)) + ' ' + etatAppel(appel, projet) + '</p>' +
      '<section class="carte">' + grille('Femmes', appel.places_femmes, prises('femme'), noms, photos) + grille('Hommes', appel.places_hommes, prises('homme'), noms, photos) +
      (fini ? '' : '<div class="ligne"><button type="button" class="btn petit" data-action="places-modifier">✏️ Nombre de places</button>' +
        '<button type="button" class="btn petit" data-action="places-ouvrir">' + (appel.ouvert ? 'Fermer l’appel' : 'Rouvrir l’appel') + '</button>' +
        '<button type="button" class="btn petit" data-action="places-preparer">Ajouter les nouvelles mannequins</button></div>') +
      '<div class="ligne"><button type="button" class="btn petit" data-action="places-supprimer">🗑️ Supprimer cet appel</button></div></section>' +
      (fini ? '' : blocChoix(invitations, noms, photos)) +
      (envoi ? '<section class="carte"><h2>Envoi des liens</h2>' + envoi + '</section>' : '') +
      '<section class="carte"><h2>Sélectionnées (' + selectionnees.length + ')</h2>' + (selectionnees.length ? '<ul class="pl-noms">' + selectionnees.map(ligneNom).join('') + '</ul>' : '<p class="doux">Personne pour le moment.</p>') +
      (selectionnees.length && !fini ? '<p class="doux">Elles sont ajoutées au projet de l’agenda. Ensuite : annonce de la sélection, convocation et relances.</p><button type="button" class="btn rouge" data-action="places-convoquer">📨 Convoquer les sélectionnées</button>' : '') +
      (desistees.length ? '<h3 class="pl-titre-grille">Désistements (' + desistees.length + ')</h3><ul class="pl-noms">' + desistees.map(ligneNom).join('') + '</ul>' : '') + '</section>';
  }

  // un appui sur le lien WhatsApp : WhatsApp s'ouvre (lien normal), l'envoi est noté, la personne suivante s'affiche
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-places-wa], a[data-places-libre]');
    if (!a || !ecran) return;
    if (a.dataset.placesLibre) {
      const annonce = annonceLibre() || { faits: {} };
      annonce.faits[a.dataset.placesLibre] = true;
      noterLibre(annonce);
      setTimeout(() => P.afficher(), 0);
      return;
    }
    const cle = a.dataset.placesWa, parent = /-p$/.test(cle), id = cle.replace(/-p$/, '');
    const maj = parent ? { parent_envoye_le: new Date().toISOString() } : { envoye_le: new Date().toISOString() };
    P.bd(sb.from('places_invitations').update(maj).eq('id', id).select('id'))
      .then((r) => { if (!r || !r.length) P.message('L’envoi n’a pas pu être noté : reconnectez-vous puis réessayez.'); return P.afficher(); })
      .catch((err) => P.message(P.erreurTexte(err)));
  });
  P.actions['places-actualiser'] = () => P.afficher();
  // cocher / décocher une mannequin (jamais une place déjà prise ou rendue)
  async function choisir(colonne, valeur, statut) {
    choixOuvert = true;
    const r = await P.bd(sb.from('places_invitations').update({ statut }).eq(colonne, valeur).in('statut', ['invite', 'exclu']).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    return P.afficher();
  }
  P.changements['places-choix'] = (el) => choisir('id', el.dataset.id, el.checked ? 'invite' : 'exclu');
  P.actions['places-tous'] = (el) => choisir('projet_id', ecran.appel.projet_id, el.dataset.valeur === 'exclu' ? 'exclu' : 'invite');
  // le message tel qu'il partira, sans l'envoyer ni rien noter
  P.actions['places-apercu'] = () => {
    const d = ecran.invitations.filter((i) => i.statut !== 'exclu').flatMap(destinataires)[0];
    if (!d) return;
    const texte = (sorte) => messagePlaces(ecran.projet, ecran.appel, { nom: d.nom, sexe: d.inv.sexe, parent: d.parent, parent_nom: d.parent_nom, jeton: d.inv.jeton }, sorte);
    P.fenetre('<h2>Aperçu du message</h2><p class="doux">Exemple pour ' + P.esc(nomDe(d)) + ' : rien n’est envoyé.</p><pre class="pl-apercu">' + P.esc(texte('appel')) + '</pre>' +
      '<h3 class="pl-titre-grille">Quand une place se libère</h3><pre class="pl-apercu">' + P.esc(texte('place_libre')) + '</pre>' +
      '<div class="ligne"><button class="btn" type="button" data-action="fermer-fenetre">Fermer</button></div>');
  };
  // effacer un appel (un essai, par exemple) : liens et places supprimés, le projet reste dans l'agenda
  P.actions['places-supprimer'] = async () => {
    const pris = ecran.invitations.filter((i) => i.statut === 'pris').length;
    if (!confirm('Supprimer cet appel à places ? Les liens envoyés ne marcheront plus.' + (pris ? ' ' + pris + ' personne(s) ont déjà pris une place : elles restent dans le projet de l’agenda.' : '') + ' Le projet reste dans l’agenda.')) return;
    const r = await P.bd(sb.from('places_appels').delete().eq('projet_id', ecran.appel.projet_id).select('projet_id'));
    if (!r || !r.length) { P.message('Rien n’a été supprimé : reconnectez-vous puis réessayez.'); return; }
    P.message('Appel supprimé.');
    location.hash = '#/site/' + PAGE;
  };
  P.actions['places-libre'] = () => { noterLibre({ debut: Date.now(), faits: {} }); return P.afficher(); };
  P.actions['places-libre-fin'] = () => { noterLibre(null); return P.afficher(); };
  P.actions['places-convoquer'] = () => { if (ecran) window.convoquerProjet(ecran.projet.id); };
  P.actions['places-preparer'] = async () => {
    const avant = ecran.invitations.length, n = await P.rpc('places_preparer', { p_projet: ecran.appel.projet_id });
    P.message(n > avant ? (n - avant) + ' nouvelle(s) mannequin(s) ajoutée(s) à l’envoi.' : n < avant ? 'Liste mise à jour (fiche sans nom retirée).' : 'Toutes les mannequins ont déjà leur lien.');
    return P.afficher();
  };
  P.actions['places-ouvrir'] = async () => {
    const ouvert = !ecran.appel.ouvert;
    if (!ouvert && !confirm('Fermer l’appel ? Plus personne ne pourra prendre de place (les places prises restent).')) return;
    const r = await P.bd(sb.from('places_appels').update({ ouvert }).eq('projet_id', ecran.appel.projet_id).select('projet_id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    P.message(ouvert ? 'Appel rouvert.' : 'Appel fermé.');
    return P.afficher();
  };
  P.actions['places-modifier'] = () => {
    const a = ecran.appel;
    P.fenetre('<form class="f" data-form="places-nombre"><h2>Nombre de places</h2>' +
      '<label class="fl" for="pl-femmes">Places pour les femmes<input id="pl-femmes" name="femmes" type="number" min="0" max="500" value="' + a.places_femmes + '" inputmode="numeric"></label>' +
      '<label class="fl" for="pl-hommes">Places pour les hommes<input id="pl-hommes" name="hommes" type="number" min="0" max="500" value="' + a.places_hommes + '" inputmode="numeric"></label>' +
      '<p class="doux large">Les places déjà prises restent prises. Un sexe qui passe de 0 à plusieurs places : appuyez ensuite sur « Ajouter les nouvelles mannequins ».</p>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">Enregistrer</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
  };
  P.formulaires['places-nombre'] = async (f) => {
    const femmes = Math.max(0, Math.min(500, parseInt(f.get('femmes'), 10) || 0)), hommes = Math.max(0, Math.min(500, parseInt(f.get('hommes'), 10) || 0));
    const n = comptes(ecran.appel, ecran.invitations);
    if (femmes < n.femmes || hommes < n.hommes) { P.message('Il y a déjà ' + n.femmes + ' femme(s) et ' + n.hommes + ' homme(s) sélectionné(s) : le nombre de places ne peut pas être plus petit.'); return; }
    const r = await P.bd(sb.from('places_appels').update({ places_femmes: femmes, places_hommes: hommes }).eq('projet_id', ecran.appel.projet_id).select('projet_id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    P.fenetre('');
    P.message('Nombre de places enregistré.');
    return P.afficher();
  };

  P.espaces.site.pages[PAGE] = (args) => {
    if (!ecran || !args || args[0] !== ecran.appel.projet_id) choixOuvert = false;  // autre appel : liste refermée
    return args && args[0] ? fiche(decodeURIComponent(args[0])) : liste();
  };
})();
