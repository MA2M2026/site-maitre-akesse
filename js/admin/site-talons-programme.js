// Nouvelle Administration — programme des élèves de l'Atelier Talons & Élégance (13/11/2026, maquette validée par la
// propriétaire, maquettes/programme-talons.html). Base : supabase-talons-programme.sql.
//  - dans chaque fiche (js/admin/site-cours-talons.js) : le DOSSIER de l'élève (sa photo, ses séances modifiables,
//    « Ajouter une séance » avec les créneaux libres) et les messages WhatsApp tout prêts (inscription reçue, son
//    programme avec le lien de sa page « Mon programme », rappel de la prochaine séance) ;
//  - page « Planning des cours de talons » : la séance de demain en tête, toutes les séances à venir jour par jour,
//    puis les réglages de l'atelier (salle, horaires du groupe, à prévoir, thèmes) et les disponibilités pour le privé.
// Le groupe : les 4 dimanches se créent tout seuls à la validation du paiement (déclencheur de la base).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const PAGE = 'b2-talons-planning';
  const SITE = 'https://www.maitreakessemodelmanagement.com';
  const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const FUSEAU = { timeZone: 'Africa/Abidjan' };
  const T = (P.talons = P.talons || {});
  T.seances = {};      // inscription → ses séances (triées)
  T.installe = true;   // faux tant que supabase-talons-programme.sql n'est pas collé
  T.reglages = null;
  const pasInstalle = P.pasActivee('talons_seances');

  // ---------- outils de dates (Abidjan = UTC, sans heure d'été) ----------
  // « 15 h », « 15 h 30 » (Abidjan : heure universelle)
  const heure = (iso) => { const d = new Date(iso), h = d.getUTCHours(), m = d.getUTCMinutes(); return h + ' h' + (m ? ' ' + String(m).padStart(2, '0') : ''); };
  const jourLong = (iso) => new Date(iso).toLocaleDateString('fr-FR', Object.assign({ weekday: 'long', day: 'numeric', month: 'long' }, FUSEAU));
  const jourCourt = (iso) => new Date(iso).toLocaleDateString('fr-FR', Object.assign({ weekday: 'short', day: 'numeric', month: 'short' }, FUSEAU));
  const plage = (s) => heure(s.debut) + ' – ' + heure(s.fin);
  const enIso = (date, h) => new Date(date + 'T' + h + ':00Z').toISOString();
  const pourChamp = (iso) => new Date(iso).toISOString().slice(0, 10);
  const pourHeure = (iso) => new Date(iso).toISOString().slice(11, 16);
  const prenomDe = (d) => String(d.nom || '').trim().split(/\s+/)[0] || '';
  const lienProgramme = (d) => SITE + '/programme?j=' + encodeURIComponent(d.programme_jeton || '');

  // ---------- lecture ----------
  T.charger = async (lignes) => {
    T.seances = {};
    if (!lignes.length) return;
    try {
      const [l, r] = await Promise.all([
        P.bd(sb.from('talons_seances').select('*').in('inscription_id', lignes.map((d) => d.id)).neq('statut', 'annulee').order('debut')),
        T.reglages ? Promise.resolve([T.reglages]) : P.bd(sb.from('talons_reglages').select('*').eq('id', 1))
      ]);
      l.forEach((s) => { (T.seances[s.inscription_id] = T.seances[s.inscription_id] || []).push(s); });
      T.reglages = r && r[0] ? r[0] : null;
      T.installe = true;
    } catch (e) {
      if (!pasInstalle(e)) throw e;
      T.installe = false;
    }
  };

  // ---------- messages WhatsApp ----------
  T.messages = {
    recue: (d) => 'Bonjour ' + prenomDe(d) + ',\n\nNous avons bien reçu votre demande d’inscription à l’Atelier Talons & Élégance de Maître Akesse Model Management. Merci pour votre confiance !\n\n' +
      'Notre équipe a étudié votre profil et vous attend avec plaisir. Dès que vous souhaitez confirmer votre place, répondez simplement à ce message : nous vous enverrons votre lien de paiement et votre programme.\n\nÀ très bientôt,\nMaître Akesse Model Management',
    programme: (d) => {
      const l = T.seances[d.id] || [];
      return 'Bonjour ' + prenomDe(d) + ',\n\nVotre paiement est bien validé : bienvenue à l’Atelier Talons & Élégance ! 👠\n\n' +
        (l.length ? 'Votre programme :\n' + l.map((s, i) => '• Séance ' + (i + 1) + ' : ' + jourLong(s.debut) + ', ' + plage(s)).join('\n') + '\n\n' : '') +
        'Votre page personnelle (calendrier, lieu, ce qu’il faut prévoir, et ajout à votre téléphone) :\n' + lienProgramme(d) + '\n\nÀ très bientôt,\nMaître Akesse Model Management';
    },
    rappel: (d, s) => 'Bonjour ' + prenomDe(d) + ',\n\nPetit rappel : votre cours de talons a lieu demain, ' + jourLong(s.debut) + ', de ' + plage(s) + (s.lieu ? ', ' + s.lieu : '') + '.\n\n' +
      'Pensez à vos talons et à une tenue près du corps. C’est toujours bon pour vous ? Répondez « Oui » pour confirmer.\n\nÀ demain !\nMaître Akesse Model Management'
  };
  const wa = (d, texte) => {
    const n = typeof numeroWhatsApp === 'function' ? numeroWhatsApp(d.telephone) : String(d.telephone || '').replace(/\D/g, '');
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(texte) : '';
  };
  const boutonWa = (d, texte, libelle, plein) => { const u = wa(d, texte); return u ? '<a class="btn petit' + (plein ? ' rouge' : '') + '" target="_blank" rel="noopener" href="' + P.esc(u) + '">' + libelle + '</a>' : ''; };
  // les messages à envoyer selon l'avancement de l'inscription (le lien Wave reste dans la fiche)
  T.boutonsMessages = (d) => {
    const payee = d.statut === 'inscrite' || d.statut === 'terminee';
    const prochaine = (T.seances[d.id] || []).find((s) => new Date(s.fin) > new Date() && s.statut !== 'faite');
    return [
      !payee ? boutonWa(d, T.messages.recue(d), '✓ Inscription reçue') : '',
      payee && T.installe ? boutonWa(d, T.messages.programme(d), '📅 Son programme', true) : '',
      payee && prochaine ? boutonWa(d, T.messages.rappel(d, prochaine), '⏰ Rappel de la prochaine séance') : ''
    ].join('');
  };

  // ---------- le dossier de l'élève dans sa fiche ----------
  T.dossier = (d) => {
    if (!T.installe) return '<p class="doux petit-texte">Programme des séances : collez <strong>supabase-talons-programme.sql</strong> dans Supabase pour l’activer.</p>';
    const l = T.seances[d.id] || [];
    const payee = d.statut === 'inscrite' || d.statut === 'terminee';
    if (!payee && !l.length) return '';
    const faites = l.filter((s) => s.statut === 'faite').length;
    const id = P.esc(d.id);
    const ligne = (s, i) => '<tr class="' + (s.statut === 'faite' ? 'faite' : s.statut === 'reservee' ? 'reservee' : '') + '"><td>' + (i + 1) + '</td><td><b>' + P.esc(jourCourt(s.debut)) + '</b><br><span class="doux">' + P.esc(plage(s)) + '</span></td>' +
      '<td>' + P.esc(s.theme || '') + (s.lieu ? '<br><span class="doux">' + P.esc(s.lieu) + '</span>' : '') + (s.statut === 'reservee' ? '<br>' + P.pastille('Réservée 48 h, en attente du paiement', 'orange') : '') + '</td>' +
      '<td class="tp-gestes">' + (s.statut !== 'faite' ? '<button type="button" class="btn petit" data-action="talons-seance-faite" data-id="' + P.esc(s.id) + '" title="Séance faite">✓</button>' : '<span class="tp-ok">✓ faite</span>') +
      '<button type="button" class="btn petit" data-action="talons-seance-modifier" data-id="' + P.esc(s.id) + '" title="Modifier">✎</button>' +
      '<button type="button" class="btn petit" data-action="talons-seance-retirer" data-id="' + P.esc(s.id) + '" title="Retirer">✕</button></td></tr>';
    const lieuDefaut = d.formule === 'prive_exterieur' ? (d.adresse || '') : (T.reglages ? T.reglages.salle_nom + ', ' + T.reglages.salle_adresse : '');
    return '<section class="tp-dossier" aria-label="Programme">' +
      '<div class="tp-tete"><h3>Son programme</h3><div class="tp-mini"><span><small>Séances</small><b>' + faites + ' / ' + (d.formule === 'groupe' ? 4 : d.nb_seances) + '</b></span>' +
        (d.programme_envoye_le ? '<span><small>Envoyé</small><b>' + P.esc(P.date(d.programme_envoye_le)) + '</b></span>' : '') + '</div></div>' +
      (l.length ? '<table class="tp-table"><thead><tr><th>N°</th><th>Quand</th><th>Thème et lieu</th><th></th></tr></thead><tbody>' + l.map(ligne).join('') + '</tbody></table>'
        : '<p class="doux">Aucune séance pour le moment. ' + (d.formule === 'groupe' ? 'Le groupe : les 4 dimanches se remplissent à la validation du paiement.' : 'Ajoutez ses séances ci-dessous, une fois les dates convenues.') + '</p>') +
      '<details class="tp-ajout"><summary>＋ Ajouter une séance</summary><form class="f" data-form="talons-seance" data-id="' + id + '">' +
        '<label class="fl" for="tp-date-' + id + '">Date<input id="tp-date-' + id + '" name="date" type="date" required></label>' +
        '<label class="fl" for="tp-debut-' + id + '">De<input id="tp-debut-' + id + '" name="debut" type="time" required value="' + (d.formule === 'groupe' && T.reglages ? T.reglages.groupe_debut.slice(0, 5) : '10:00') + '"></label>' +
        '<label class="fl" for="tp-fin-' + id + '">À<input id="tp-fin-' + id + '" name="fin" type="time" required value="' + (d.formule === 'groupe' && T.reglages ? T.reglages.groupe_fin.slice(0, 5) : '12:00') + '"></label>' +
        '<label class="fl large" for="tp-lieu-' + id + '">Lieu<input id="tp-lieu-' + id + '" name="lieu" maxlength="300" value="' + P.esc(lieuDefaut) + '"></label>' +
        '<label class="fl large" for="tp-theme-' + id + '">Thème (facultatif)<input id="tp-theme-' + id + '" name="theme" maxlength="120" placeholder="ex. : Démarche et port de tête"></label>' +
        '<div class="ligne large"><button class="btn rouge" type="submit">Ajouter la séance</button><button class="btn" type="button" data-action="talons-creneaux" data-id="' + id + '">Voir mes créneaux libres</button></div>' +
        '<div class="tp-creneaux large" id="tp-creneaux-' + id + '"></div>' +
      '</form></details>' +
      (payee ? '<p class="tp-lien"><a href="' + P.esc(lienProgramme(d)) + '" target="_blank" rel="noopener">Voir sa page « Mon programme » ↗</a></p>' : '') +
      '</section>';
  };

  // ---------- gestes sur les séances ----------
  const seanceDe = (id) => Object.values(T.seances).flat().find((s) => s.id === id);
  P.formulaires['talons-seance'] = async (f, form) => {
    const id = form.dataset.id, date = f.get('date'), debut = f.get('debut'), fin = f.get('fin');
    if (!date || !debut || !fin || fin <= debut) return P.message('Indiquez la date, l’heure de début et l’heure de fin (après le début).');
    const r = await P.bd(sb.from('talons_seances').insert({ inscription_id: id, debut: enIso(date, debut), fin: enIso(date, fin), lieu: String(f.get('lieu') || '').trim() || null,
      theme: String(f.get('theme') || '').trim() || null, statut: 'prevue' }).select('id'));
    if (!r || !r.length) return P.message('La séance n’a pas été ajoutée : reconnectez-vous puis réessayez.');
    P.message('Séance ajoutée.');
    return P.afficher();
  };
  P.actions['talons-creneaux'] = async (el) => {
    const zone = document.getElementById('tp-creneaux-' + el.dataset.id);
    const l = await P.rpc('talons_creneaux_libres', { p_jours: 21 });
    zone.innerHTML = l && l.length ? '<p class="doux petit-texte">Vos créneaux encore libres (1 h 30 d’écart gardé) : touchez-en un pour remplir la séance.</p><div class="tp-puces">' +
      l.slice(0, 24).map((c) => '<button type="button" class="btn petit" data-action="talons-creneau-choisir" data-id="' + P.esc(el.dataset.id) + '" data-debut="' + P.esc(c.debut) + '" data-fin="' + P.esc(c.fin) + '">' +
        P.esc(jourCourt(c.debut) + ' · ' + heure(c.debut)) + '</button>').join('') + '</div>'
      : '<p class="doux petit-texte">Aucun créneau libre : ajoutez vos disponibilités dans « Planning des cours de talons ».</p>';
  };
  P.actions['talons-creneau-choisir'] = (el) => {
    const id = el.dataset.id, $ = (x) => document.getElementById(x + id);
    $('tp-date-').value = pourChamp(el.dataset.debut); $('tp-debut-').value = pourHeure(el.dataset.debut); $('tp-fin-').value = pourHeure(el.dataset.fin);
  };
  P.actions['talons-seance-faite'] = async (el) => {
    const r = await P.bd(sb.from('talons_seances').update({ statut: 'faite' }).eq('id', el.dataset.id).select('id'));
    if (!r || !r.length) return P.message('Rien n’a été changé : reconnectez-vous puis réessayez.');
    return P.afficher();
  };
  P.actions['talons-seance-retirer'] = async (el) => {
    const s = seanceDe(el.dataset.id);
    if (!confirm('Retirer cette séance' + (s ? ' du ' + jourLong(s.debut) : '') + ' ? Le créneau redevient libre.')) return;
    const r = await P.bd(sb.from('talons_seances').update({ statut: 'annulee' }).eq('id', el.dataset.id).select('id'));
    if (!r || !r.length) return P.message('Rien n’a été changé : reconnectez-vous puis réessayez.');
    return P.afficher();
  };
  P.actions['talons-seance-modifier'] = async (el) => {
    const s = seanceDe(el.dataset.id);
    if (!s) return;
    const date = prompt('Nouvelle date (AAAA-MM-JJ) :', pourChamp(s.debut)); if (!date) return;
    const debut = prompt('Heure de début (HH:MM) :', pourHeure(s.debut)); if (!debut) return;
    const fin = prompt('Heure de fin (HH:MM) :', pourHeure(s.fin)); if (!fin) return;
    if (!/^\d{4}-\d\d-\d\d$/.test(date) || !/^\d\d:\d\d$/.test(debut) || !/^\d\d:\d\d$/.test(fin) || fin <= debut) return P.message('Date ou heures non comprises : AAAA-MM-JJ et HH:MM.');
    const lieu = prompt('Lieu :', s.lieu || ''); if (lieu === null) return;
    const r = await P.bd(sb.from('talons_seances').update({ debut: enIso(date, debut), fin: enIso(date, fin), lieu: lieu.trim() || null, rappel_le: null }).eq('id', s.id).select('id'));
    if (!r || !r.length) return P.message('Rien n’a été changé : reconnectez-vous puis réessayez.');
    P.message('Séance modifiée. Pensez à renvoyer son programme.');
    return P.afficher();
  };
  // programme envoyé : la date est notée (le lien WhatsApp s'ouvre normalement)
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('.ct-fiche a[href*="programme%3Fj%3D"]');
    const fiche = a && a.closest('.ct-fiche');
    if (fiche) void P.bd(sb.from('cours_talons').update({ programme_envoye_le: new Date().toISOString() }).eq('id', fiche.dataset.id).select('id')).catch(() => {});
  });

  // ---------- page « Planning des cours de talons » ----------
  async function page() {
    let seances, inscriptions, dispo, bloques, r;
    try {
      [seances, inscriptions, dispo, bloques, r] = await Promise.all([
        P.bd(sb.from('talons_seances').select('*').neq('statut', 'annulee').gte('fin', new Date(Date.now() - 864e5).toISOString()).order('debut').limit(300)),
        P.bd(sb.from('cours_talons').select('id, nom, telephone, photos, formule, statut, programme_jeton').limit(500)),
        P.bd(sb.from('talons_disponibilites').select('*').order('jour').order('debut')),
        P.bd(sb.from('talons_indisponibles').select('*').gte('jour', new Date().toISOString().slice(0, 10)).order('jour')),
        P.bd(sb.from('talons_reglages').select('*').eq('id', 1))
      ]);
    } catch (e) {
      if (!pasInstalle(e)) throw e;
      return P.entete('Planning des cours de talons') + '<div class="carte"><h2>Pas encore activé</h2><p class="doux">Collez le fichier <strong>supabase-talons-programme.sql</strong> dans Supabase (SQL Editor, puis le bouton orange « Run without RLS »).</p></div>';
    }
    T.reglages = r[0] || null;
    const qui = {}; inscriptions.forEach((d) => { qui[d.id] = d; });
    const demain = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
    const deDemain = seances.filter((s) => s.debut.slice(0, 10) === demain && s.statut !== 'faite');
    const carte = (s) => {
      const d = qui[s.inscription_id] || {};
      return '<article class="tp-seance"><button type="button" class="photo-ouvrir tp-visage" aria-hidden="true" tabindex="-1">' + P.visageDistant((d.photos || [])[0], d.nom) + '</button>' +
        '<div class="tp-texte"><b>' + P.esc(d.nom || '') + '</b><span>' + P.esc(plage(s)) + (s.theme ? ' · ' + P.esc(s.theme) : '') + '</span>' + (s.lieu ? '<span class="doux">📍 ' + P.esc(s.lieu) + '</span>' : '') +
        (s.statut === 'reservee' ? P.pastille('Réservée, paiement attendu', 'orange') : s.statut === 'faite' ? P.pastille('Faite', 'vert') : '') + '</div>' +
        '<div class="tp-bouton">' + (s.statut === 'prevue' ? boutonWa(d, T.messages.rappel(d, s), '⏰ Rappel') : '') + '</div></article>';
    };
    const alerte = deDemain.length ? '<div class="carte tp-alerte"><div class="tp-cloche" aria-hidden="true">🔔</div><div><b>Demain : ' + deDemain.length + ' séance' + (deDemain.length > 1 ? 's' : '') + '</b><span>' +
      deDemain.map((s) => P.esc((qui[s.inscription_id] || {}).nom || '') + ' à ' + P.esc(heure(s.debut))).join(' · ') + '</span></div></div>' : '';
    const parJour = P.parJour(seances, (s) => s.debut).map((g) => '<section class="jour-groupe"><h2 class="jour-titre">' + P.esc(g.titre) + ' <span class="nb">' + g.elements.length + '</span></h2>' +
      '<div class="carte tp-liste">' + g.elements.map(carte).join('') + '</div></section>').join('');
    return P.entete('Planning des cours de talons', '<a class="btn petit" href="#/site/b2-cours-talons">Les inscriptions</a>') + alerte +
      (parJour || '<div class="carte vide">Aucune séance à venir pour le moment.</div>') + blocDisponibilites(dispo, bloques) + blocReglages(T.reglages);
  }

  function blocDisponibilites(dispo, bloques) {
    return '<section class="carte"><h2>Mes disponibilités pour les cours privés</h2><p class="doux">Les visiteuses ne voient que vos créneaux encore libres (séances de ' +
      (T.reglages ? T.reglages.duree_prive : 120) + ' min, ' + (T.reglages ? T.reglages.ecart_minutes : 90) + ' min d’écart gardé entre deux élèves).</p>' +
      (dispo.length ? '<ul class="tp-dispo">' + dispo.map((x) => '<li><b>' + JOURS[x.jour] + '</b> de ' + P.esc(x.debut.slice(0, 5).replace(':', ' h ')) + ' à ' + P.esc(x.fin.slice(0, 5).replace(':', ' h ')) +
        ' <button type="button" class="btn petit" data-action="talons-dispo-retirer" data-id="' + P.esc(x.id) + '" aria-label="Retirer">✕</button></li>').join('') + '</ul>' : '<p class="doux">Aucune disponibilité : les visiteuses choisiront « dates à convenir ».</p>') +
      '<form class="f" data-form="talons-dispo"><label class="fl" for="tp-jour">Jour<select id="tp-jour" name="jour">' + JOURS.slice(1).map((j, i) => '<option value="' + (i + 1) + '">' + j + '</option>').join('') + '</select></label>' +
        '<label class="fl" for="tp-dd">De<input id="tp-dd" name="debut" type="time" value="10:00" required></label><label class="fl" for="tp-df">À<input id="tp-df" name="fin" type="time" value="13:00" required></label>' +
        '<div class="ligne large"><button class="btn rouge" type="submit">Ajouter ce créneau</button></div></form>' +
      '<h3>Jours bloqués</h3>' + (bloques.length ? '<ul class="tp-dispo">' + bloques.map((b) => '<li><b>' + P.esc(P.date(b.jour)) + '</b>' + (b.motif ? ' · ' + P.esc(b.motif) : '') +
        ' <button type="button" class="btn petit" data-action="talons-bloque-retirer" data-id="' + P.esc(b.jour) + '" aria-label="Débloquer">✕</button></li>').join('') + '</ul>' : '<p class="doux">Aucun jour bloqué.</p>') +
      '<form class="f" data-form="talons-bloque"><label class="fl" for="tp-bj">Jour<input id="tp-bj" name="jour" type="date" required></label><label class="fl" for="tp-bm">Motif (facultatif)<input id="tp-bm" name="motif" maxlength="160" placeholder="ex. : défilé, voyage"></label>' +
        '<div class="ligne large"><button class="btn" type="submit">Bloquer ce jour</button></div></form></section>';
  }
  function blocReglages(r) {
    if (!r) return '';
    const v = (x) => P.esc(x == null ? '' : x);
    return '<section class="carte"><h2>Réglages de l’atelier</h2><form class="f" data-form="talons-reglages">' +
      '<label class="fl" for="tr-salle">Nom de la salle<input id="tr-salle" name="salle_nom" maxlength="120" value="' + v(r.salle_nom) + '" required></label>' +
      '<label class="fl" for="tr-adr">Adresse de la salle<input id="tr-adr" name="salle_adresse" maxlength="300" value="' + v(r.salle_adresse) + '"></label>' +
      '<label class="fl large" for="tr-maps">Lien Google Maps (facultatif)<input id="tr-maps" name="salle_maps" type="url" placeholder="https://maps.app.goo.gl/…" value="' + v(r.salle_maps) + '"></label>' +
      '<label class="fl" for="tr-gd">Groupe : de<input id="tr-gd" name="groupe_debut" type="time" value="' + v(String(r.groupe_debut).slice(0, 5)) + '"></label>' +
      '<label class="fl" for="tr-gf">à<input id="tr-gf" name="groupe_fin" type="time" value="' + v(String(r.groupe_fin).slice(0, 5)) + '"></label>' +
      '<label class="fl" for="tr-duree">Durée d’une séance privée (min)<input id="tr-duree" name="duree_prive" type="number" min="30" max="300" step="15" value="' + v(r.duree_prive) + '"></label>' +
      '<label class="fl" for="tr-ecart">Écart entre deux élèves (min)<input id="tr-ecart" name="ecart_minutes" type="number" min="0" max="300" step="15" value="' + v(r.ecart_minutes) + '"></label>' +
      '<label class="fl large" for="tr-prevoir">À prévoir (une ligne par élément)<textarea id="tr-prevoir" name="a_prevoir" rows="5">' + v((r.a_prevoir || []).join('\n')) + '</textarea></label>' +
      '<label class="fl large" for="tr-themes">Thèmes des 4 dimanches du groupe (une ligne par séance)<textarea id="tr-themes" name="themes_groupe" rows="4">' + v((r.themes_groupe || []).join('\n')) + '</textarea></label>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">Enregistrer les réglages</button></div></form></section>';
  }
  const lignesDe = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12);
  P.formulaires['talons-reglages'] = async (f) => {
    const maps = String(f.get('salle_maps') || '').trim();
    if (maps && !/^https:\/\//.test(maps)) return P.message('Le lien Google Maps doit commencer par https://');
    const maj = { salle_nom: String(f.get('salle_nom') || '').trim(), salle_adresse: String(f.get('salle_adresse') || '').trim(), salle_maps: maps || null,
      groupe_debut: f.get('groupe_debut'), groupe_fin: f.get('groupe_fin'), duree_prive: parseInt(f.get('duree_prive'), 10), ecart_minutes: parseInt(f.get('ecart_minutes'), 10),
      a_prevoir: lignesDe(f.get('a_prevoir')), themes_groupe: lignesDe(f.get('themes_groupe')), modifie_le: new Date().toISOString() };
    const r = await P.bd(sb.from('talons_reglages').update(maj).eq('id', 1).select('id'));
    if (!r || !r.length) return P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.');
    T.reglages = null;
    P.message('Réglages enregistrés.');
    return P.afficher();
  };
  P.formulaires['talons-dispo'] = async (f) => {
    if (!(f.get('fin') > f.get('debut'))) return P.message('L’heure de fin doit être après le début.');
    const r = await P.bd(sb.from('talons_disponibilites').insert({ jour: parseInt(f.get('jour'), 10), debut: f.get('debut'), fin: f.get('fin') }).select('id'));
    if (!r || !r.length) return P.message('Rien n’a été ajouté : reconnectez-vous puis réessayez.');
    return P.afficher();
  };
  P.actions['talons-dispo-retirer'] = async (el) => {
    await P.bd(sb.from('talons_disponibilites').delete().eq('id', el.dataset.id));
    return P.afficher();
  };
  P.formulaires['talons-bloque'] = async (f) => {
    const r = await P.bd(sb.from('talons_indisponibles').upsert({ jour: f.get('jour'), motif: String(f.get('motif') || '').trim() || null }).select('jour'));
    if (!r || !r.length) return P.message('Rien n’a été ajouté : reconnectez-vous puis réessayez.');
    return P.afficher();
  };
  P.actions['talons-bloque-retirer'] = async (el) => {
    await P.bd(sb.from('talons_indisponibles').delete().eq('jour', el.dataset.id));
    return P.afficher();
  };
  P.espaces.site.pages[PAGE] = page;
})();
