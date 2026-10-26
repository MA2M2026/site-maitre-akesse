// Nouvelle Administration — « Informations agence » (26/10/2026, demande de la propriétaire).
// Relayer une information aux mannequins choisies : un casting, un défilé, un remerciement après
// un événement, ou une information générale. On choisit le type (et, si on veut, le projet de
// l'agenda : tout se remplit, et pour un remerciement les mannequins convoquées sont cochées),
// on joint une photo et la fiche ; le système rédige un beau message, qu'on peut retoucher.
// Envoi par les 3 voies : dans l'application des mannequins tout de suite (avec notification sur
// le téléphone), puis par e-mail (automatique) et WhatsApp (un message à la fois, comme les
// Messages groupés). Une mineure : WhatsApp et e-mail vont à son parent, l'application à elle.
// Base : infos_agence et app_messages_envoyer (supabase-app-messages.sql).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const PAGE = 'b2-infos';
  const SORTES = { casting: ['📣', 'Casting'], defile: ['👠', 'Défilé'], remerciement: ['🙏', 'Remerciement'], info: ['📢', 'Information'] };
  const nonActive = (e) => /infos_agence|app_messages|42P01|PGRST20[25]/.test(String((e && (e.message || e.code)) || e));
  const PAS_ACTIVE = '<div class="carte vide">Les Informations agence ne sont pas encore activées : exécutez une fois le fichier supabase-app-messages.sql dans Supabase.</div>';
  const aujourdhui = () => new Date().toISOString().slice(0, 10);
  let brouillon = null;  // nouvelle information en cours : { sorte, projet, titre, date, heure, lieu, client, precisions, image, fiche, message, retouche, choisis:Set }
  let personnes = null;  // P.personnesPossibles(true)

  // ---------- Le beau message (WhatsApp ; l'e-mail en est la version sans *gras*) ----------
  function details(b) {
    return [b.date ? '📅 ' + dateLongueFr(b.date) : '', b.heure ? '🕒 ' + b.heure : '', b.lieu ? '📍 ' + b.lieu : '',  // (js/messages-candidats.js)
      b.client ? '🤝 Avec ' + b.client : ''].filter(Boolean).join('\n');
  }
  // corps du message (sans « Bonjour » ni signature), pour la mannequin
  function corps(b) {
    const t = '*' + String(b.titre || '…').trim() + '*', d = details(b), plus = String(b.precisions || '').trim();
    const fiche = b.fiche ? '\n\n📄 La fiche est jointe : ' + b.fiche : '';
    const textes = {
      casting: '📣 *Information casting* : ' + t + '\n\n' + (d ? d + '\n\n' : '') + 'Veuillez vous préparer à participer à ce casting : tenue soignée, ponctualité et sourire. ✨',
      defile: '👠 *Information défilé* : ' + t + '\n\n' + (d ? d + '\n\n' : '') + 'Préparez-vous : l’agence vous donnera très vite tous les détails (programme, passages, convocation).',
      remerciement: '🙏 *Merci !*\n\nMerci pour votre participation à ' + t + (b.date ? ' (' + dateLongueFr(b.date) + ')' : '') + (b.client ? ', avec ' + b.client : '') +
        '. Votre professionnalisme et votre énergie font la fierté de l’agence. Bravo et à très bientôt pour de nouveaux projets ! 👏',
      info: '📢 *Information de l’agence* : ' + t + (d ? '\n\n' + d : '')
    };
    return textes[b.sorte] + (plus ? '\n\n' + plus : '') + fiche;
  }
  const messageMannequin = (b) => messageCandidat(corps(b));  // (js/messages-candidats.js)
  // (le cœur d'un message, même retouché : coeurMessage, js/messages-candidats.js)
  const messageParentDe = (texte) => messageParent('Voici une information de l’agence pour votre enfant *{prénom}* :\n\n' + coeurMessage(texte));

  // ---------- Coordonnées des personnes choisies (pour WhatsApp et e-mail) ----------
  async function coordonnees(cles) {
    const de = (prefixe) => cles.filter((c) => c.indexOf(prefixe) === 0).map((c) => c.slice(2));
    const [profils, registre, carnet] = await Promise.all([
      P.parPaquets(de('m:'), 500, (l) => P.rpc('convocation_contacts_mannequins', { p_ids: l })),
      P.parPaquets(de('r:'), 500, (l) => P.rpc('places_contacts_registre', { p_ids: l })).catch(() => []),
      de('c:').length ? P.bd(sb.from('contacts_externes').select('id, civilite, nom, telephone, email').in('id', de('c:'))) : []
    ]);
    const c = {};
    profils.forEach((x) => { c['m:' + x.model_id] = { full_name: x.full_name, genre: x.category, phone: x.phone, email: x.contact_email, date_naissance: x.date_naissance, parent_nom: x.parent_nom, parent_telephone: x.parent_telephone, parent_email: x.parent_email }; });
    registre.forEach((x) => { c['r:' + x.mannequin_id] = { full_name: x.full_name, genre: x.genre, phone: x.phone, email: x.contact_email, date_naissance: x.date_naissance, parent_nom: x.parent_nom, parent_telephone: x.parent_telephone, parent_email: x.parent_email }; });
    carnet.forEach((x) => { c['c:' + x.id] = { full_name: x.nom, civilite: x.civilite, phone: x.telephone, email: x.email }; });
    return c;
  }
  // le message prêt pour UNE personne (au parent d'une mineure)
  const pourPersonne = (info, d) => personnaliserMessage(contactsEnvoi(d).parent ? (info.message_parent || info.message) : info.message, d, null, () => '');

  // ---------- Liste ----------
  async function liste() {
    let infos;
    try { infos = await P.bd(sb.from('infos_agence').select('id, sorte, titre, date_info, destinataires, faits_wa, faits_email, dans_app, cree_le').order('cree_le', { ascending: false }).limit(60)); }
    catch (e) { if (nonActive(e)) return P.entete('Informations agence') + PAS_ACTIVE; throw e; }
    const cartes = infos.map((x, i) => '<article class="projet-carte apparait" style="--i:' + Math.min(i, 10) + '"><div class="projet-tete"><h2>' + SORTES[x.sorte][0] + ' ' + P.esc(x.titre) + '</h2>' +
      P.pastille(SORTES[x.sorte][1], 'neutre') + '</div><p class="doux">Écrite le ' + P.esc(P.dateHeure(x.cree_le)) + (x.date_info ? ' · ' + P.esc(P.date(x.date_info)) : '') + '</p>' +
      '<p>' + P.pluriel(x.destinataires.length, 'mannequin', 'mannequins') + ' · 📱 ' + x.dans_app + ' dans l’application · ✉️ ' + x.faits_email.length + ' e-mail(s) · 💬 ' + x.faits_wa.length + ' WhatsApp</p>' +
      '<div class="ligne"><a class="btn rouge" href="#/site/' + PAGE + '/' + P.esc(x.id) + '">Ouvrir</a></div></article>').join('');
    return P.entete('Informations agence', '<a class="btn rouge" href="#/site/' + PAGE + '/nouvelle">＋ Nouvelle information</a>') +
      '<p class="doux">Un casting, un défilé, un remerciement ou une information à passer : le système rédige le message, vous choisissez les mannequins, et il part par les 3 voies (application, e-mail, WhatsApp).</p>' +
      (cartes ? '<div class="projets-liste">' + cartes + '</div>' : '<div class="carte vide">Aucune information envoyée pour le moment.</div>');
  }

  // ---------- Nouvelle information ----------
  async function formulaire() {
    if (!personnes) personnes = await P.personnesPossibles(true);
    if (!brouillon) brouillon = { sorte: 'casting', projet: '', titre: '', date: '', heure: '', lieu: '', client: '', precisions: '', image: '', fiche: '', message: '', retouche: false, choisis: new Set() };
    const b = brouillon;
    if (!b.retouche) b.message = messageMannequin(b);
    const projets = await P.bd(sb.from('agenda_projets').select('id, titre, type, date_debut').eq('annule', false).gte('date_debut', new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)).order('date_debut', { ascending: false }).limit(60)).catch(() => []);
    const gens = Object.values(personnes).filter((x) => x && x.cle);
    const groupe = (titre, filtre) => {
      const l = gens.filter(filtre).sort((x, y) => String(x.nom).localeCompare(String(y.nom)));
      return l.length ? '<h3>' + P.esc(titre) + ' <span class="doux">(' + l.length + ')</span></h3><div class="df-choix">' + l.map((x) =>
        '<label class="df-choix-carte"><input type="checkbox" data-change="infos-choix" value="' + P.esc(x.cle) + '"' + (b.choisis.has(x.cle) ? ' checked' : '') + '>' + P.visage(x.photo, x.nom, 'df-vis') + '<span>' + P.esc(x.nom) + '</span></label>').join('') + '</div>' : '';
    };
    const champ = (nom, libelle, type, extra) => '<label class="fl" for="if-' + nom + '">' + libelle + '<input id="if-' + nom + '" name="' + nom + '" type="' + (type || 'text') + '" value="' + P.esc(b[nom]) + '" data-change="infos-champ" data-direct' + (extra || '') + '></label>';
    return P.entete('Nouvelle information', '<a class="btn" href="#/site/' + PAGE + '">← Toutes les informations</a>') +
      '<form class="carte f" data-form="infos-envoyer">' +
      '<fieldset class="large if-sortes"><legend>Quelle information ?</legend>' + Object.keys(SORTES).map((s) =>
        '<label class="if-sorte"><input type="radio" name="sorte" value="' + s + '" data-change="infos-champ"' + (b.sorte === s ? ' checked' : '') + '> ' + SORTES[s][0] + ' ' + SORTES[s][1] + '</label>').join('') + '</fieldset>' +
      '<label class="fl large" for="if-projet">Projet de l’agenda (facultatif : remplit tout)<select id="if-projet" name="projet" data-change="infos-projet"><option value="">— Aucun —</option>' +
      projets.map((p) => '<option value="' + P.esc(p.id) + '"' + (b.projet === p.id ? ' selected' : '') + '>' + P.esc(P.date(p.date_debut) + ' — ' + p.titre) + '</option>').join('') + '</select></label>' +
      champ('titre', 'Titre', 'text', ' maxlength="160" required placeholder="ex : Casting Kouroukan Mode"') + champ('date', 'Date', 'date') + champ('heure', 'Heure', 'text', ' maxlength="20" placeholder="ex : 15 h 00"') +
      champ('lieu', 'Lieu', 'text', ' maxlength="200"') + champ('client', 'Client ou partenaire', 'text', ' maxlength="160"') +
      '<label class="fl large" for="if-precisions">Précisions (facultatif)<textarea id="if-precisions" name="precisions" rows="3" maxlength="1200" data-change="infos-champ" data-direct>' + P.esc(b.precisions) + '</textarea></label>' +
      '<label class="fl" for="if-photo">Photo (affiche, visuel…)<input id="if-photo" type="file" accept="image/*" data-change="infos-fichier" data-quoi="image"></label>' +
      '<label class="fl" for="if-fiche">Fiche jointe (PDF ou image)<input id="if-fiche" type="file" accept="application/pdf,image/*" data-change="infos-fichier" data-quoi="fiche"></label>' +
      '<p class="doux large" id="if-pieces">' + [b.image ? '🖼️ Photo jointe' : '', b.fiche ? '📄 Fiche jointe' : ''].filter(Boolean).join(' · ') + '</p>' +
      '<label class="fl large" for="if-message">Le message (rédigé pour vous, à retoucher si besoin)<textarea id="if-message" name="message" rows="12" maxlength="4000" data-change="infos-message" data-direct>' + P.esc(b.message) + '</textarea></label>' +
      '<p class="doux large">« {prénom} » est remplacé par le nom de chaque mannequin. Une mineure : WhatsApp et e-mail partent à son parent ; l’application, à elle.</p>' +
      '<div class="large"><h2>À qui ?</h2><div class="ligne"><button class="btn petit" type="button" data-action="infos-tout" data-valeur="1">Toutes</button><button class="btn petit" type="button" data-action="infos-tout" data-valeur="0">Aucune</button>' +
      (b.projet ? '<button class="btn petit" type="button" data-action="infos-du-projet">Celles du projet</button>' : '') + '<span class="doux" id="if-compte">' + P.pluriel(b.choisis.size, 'mannequin choisie', 'mannequins choisies') + '</span></div>' +
      groupe('Mannequins de l’agence', (x) => x.origine === 'agence') + groupe('Mannequins extérieures', (x) => x.origine === 'exterieure') + '</div>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">Envoyer dans l’application et préparer e-mail et WhatsApp</button></div></form>';
  }
  const redessinerMessage = () => {
    const b = brouillon, zone = document.getElementById('if-message');
    if (!b.retouche) { b.message = messageMannequin(b); if (zone) zone.value = b.message; }
  };
  P.changements['infos-champ'] = (el) => {
    if (!brouillon) return;
    brouillon[el.name] = el.value;
    if (el.name === 'sorte') brouillon.retouche = false;
    redessinerMessage();
  };
  P.changements['infos-message'] = (el) => { if (brouillon) { brouillon.message = el.value; brouillon.retouche = true; } };
  P.changements['infos-choix'] = (el) => {
    if (!brouillon) return;
    if (el.checked) brouillon.choisis.add(el.value); else brouillon.choisis.delete(el.value);
    const n = document.getElementById('if-compte');
    if (n) n.textContent = P.pluriel(brouillon.choisis.size, 'mannequin choisie', 'mannequins choisies');
  };
  // projet de l'agenda : tout se remplit (titre, date, heure, lieu, client)
  P.changements['infos-projet'] = async (el) => {
    const b = brouillon;
    b.projet = el.value;
    if (b.projet) {
      const p = (await P.bd(sb.from('agenda_projets').select('*').eq('id', b.projet)))[0];
      if (p) Object.assign(b, { titre: p.titre || '', date: p.date_debut || '', heure: p.heure_evenement ? String(p.heure_evenement).replace(':', ' h ') : '', lieu: [p.lieu, p.ville].filter(Boolean).join(', '), client: p.client || '',
        sorte: b.sorte === 'info' && ['casting', 'defile'].includes(p.type) ? p.type : b.sorte });
      // remerciement : les mannequins convoquées à ce projet sont cochées
      if (b.sorte === 'remerciement') await cocherDuProjet();
    }
    return P.afficher();
  };
  // les mannequins convoquées au projet (pas les lignes des parents ; celles qui ont dit « absente » non plus)
  async function cocherDuProjet() {
    const b = brouillon;
    const l = await P.bd(sb.from('convocation_participants').select('model_id, contact_id, parent, reponse').eq('projet_id', b.projet).eq('parent', false));
    l.filter((x) => x.reponse !== 'absent').forEach((x) => {
      const cle = x.model_id ? 'm:' + x.model_id : x.contact_id ? (personnes.carnetRegistre[x.contact_id] ? 'r:' + personnes.carnetRegistre[x.contact_id] : 'c:' + x.contact_id) : '';
      if (cle && personnes[cle]) b.choisis.add(cle);
    });
    P.message(P.pluriel(b.choisis.size, 'mannequin cochée', 'mannequins cochées') + ' (convoquées au projet).');
  }
  P.actions['infos-du-projet'] = async () => { await cocherDuProjet(); return P.afficher(); };
  P.actions['infos-tout'] = (el) => {
    const b = brouillon;
    if (el.dataset.valeur === '1') Object.values(personnes).forEach((x) => { if (x && x.cle && x.origine === 'agence') b.choisis.add(x.cle); }); else b.choisis.clear();
    return P.afficher();
  };
  // photo et fiche : envoyées tout de suite (Cloudflare R2, dossier « infos »)
  P.changements['infos-fichier'] = async (el) => {
    const f = el.files && el.files[0];
    if (!f) return;
    const quoi = el.dataset.quoi, ext = (f.name.match(/\.([a-z0-9]{2,5})$/i) || ['', f.type === 'application/pdf' ? 'pdf' : 'jpg'])[1].toLowerCase();
    P.message('Envoi de ' + (quoi === 'image' ? 'la photo' : 'la fiche') + '…');
    try {
      const fichier = quoi === 'image' && typeof convertirSiHeic === 'function' ? await convertirSiHeic(f) : f;  // (js/app.js)
      brouillon[quoi] = await envoyerImageSite('infos', 'site/infos/' + crypto.randomUUID() + '.' + ext, fichier);  // (js/app.js)
      if (quoi === 'fiche') redessinerMessage();
      const z = document.getElementById('if-pieces');
      if (z) z.textContent = [brouillon.image ? '🖼️ Photo jointe' : '', brouillon.fiche ? '📄 Fiche jointe' : ''].filter(Boolean).join(' · ');
      P.message(quoi === 'image' ? 'Photo jointe.' : 'Fiche jointe.');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.formulaires['infos-envoyer'] = async () => {
    const b = brouillon;
    if (!String(b.titre).trim()) { P.message('Indiquez un titre.'); return; }
    if (!b.choisis.size) { P.message('Choisissez au moins une mannequin.'); return; }
    const message = String(b.message).trim();
    if (!message) { P.message('Le message est vide.'); return; }
    if (!confirm('Envoyer « ' + b.titre + ' » à ' + P.pluriel(b.choisis.size, 'mannequin', 'mannequins') + ' ?\n\nElles le reçoivent tout de suite dans l’application ; l’e-mail et WhatsApp se préparent ensuite.')) return;
    const destinataires = [...b.choisis];
    const cree = await P.bd(sb.from('infos_agence').insert({ sorte: b.sorte, titre: String(b.titre).trim(), date_info: b.date || null, heure: b.heure || null, lieu: b.lieu || null, client: b.client || null,
      projet_id: b.projet || null, image: b.image || null, fiche: b.fiche || null, message, message_parent: messageParentDe(message), message_app: texteApplication(message), destinataires }).select('id'));
    const id = cree && cree[0] && cree[0].id;
    if (!id) { P.message('L’information n’a pas pu être enregistrée : reconnectez-vous puis réessayez.'); return; }
    const n = await P.rpc('app_messages_envoyer', { p_cles: destinataires, p_sorte: b.sorte, p_titre: SORTES[b.sorte][0] + ' ' + String(b.titre).trim(), p_texte: texteApplication(message), p_image: b.image || null, p_fiche: b.fiche || null, p_lien: null });
    await P.bd(sb.from('infos_agence').update({ dans_app: n || 0 }).eq('id', id).select('id'));
    brouillon = null;
    P.message('📱 Reçue dans l’application par ' + P.pluriel(n || 0, 'mannequin', 'mannequins') + '. Envoyez maintenant l’e-mail et WhatsApp.');
    location.hash = '#/site/' + PAGE + '/' + id;
  };

  // ---------- Une information : où en sont l'e-mail et WhatsApp ----------
  let ouverte = null;  // { info, contacts }
  async function fiche(id) {
    const info = (await P.bd(sb.from('infos_agence').select('*').eq('id', id)))[0];
    if (!info) return P.entete('Information introuvable') + '<div class="carte vide">Cette information n’existe plus.</div>';
    if (!personnes) personnes = await P.personnesPossibles(true);
    const contacts = await coordonnees(info.destinataires);
    ouverte = { info, contacts };
    const emailFaits = new Set(info.faits_email), waFaits = new Set(info.faits_wa);
    const avecEmail = info.destinataires.filter((c) => contacts[c] && contactsEnvoi(contacts[c]).email);
    const avecWa = info.destinataires.filter((c) => contacts[c] && numeroWhatsApp(contactsEnvoi(contacts[c]).phone));
    const restantEmail = avecEmail.filter((c) => !emailFaits.has(c)).length, restantWa = avecWa.filter((c) => !waFaits.has(c)).length;
    const ligne = (c) => {
      const x = personnes[c] || { nom: (contacts[c] && contacts[c].full_name) || '?' }, d = contacts[c] || {}, k = contactsEnvoi(d);
      return '<li>' + P.visage(x.photo, x.nom, 'rond-vis') + ' <span>' + P.esc(x.nom) + (k.parent ? ' <small class="doux">(parent : ' + P.esc(k.nom || '?') + ')</small>' : '') + '</span> ' +
        (emailFaits.has(c) ? P.pastille('✉️ envoyé', 'ok') : k.email ? '' : P.pastille('pas d’e-mail', 'neutre')) + ' ' +
        (waFaits.has(c) ? P.pastille('💬 envoyé', 'ok') : numeroWhatsApp(k.phone) ? '' : P.pastille('pas de WhatsApp', 'neutre')) + '</li>';
    };
    return P.entete(SORTES[info.sorte][0] + ' ' + info.titre, '<a class="btn" href="#/site/' + PAGE + '">← Toutes les informations</a>') +
      '<div class="carte"><p class="doux">Écrite le ' + P.esc(P.dateHeure(info.cree_le)) + ' · ' + P.pluriel(info.destinataires.length, 'mannequin', 'mannequins') + '</p>' +
      (info.image ? '<img class="if-image" src="' + P.esc(info.image) + '" alt="">' : '') + (info.fiche ? '<p><a href="' + P.esc(info.fiche) + '" target="_blank" rel="noopener">📄 Voir la fiche jointe</a></p>' : '') +
      '<details><summary>Voir le message</summary><pre class="if-message">' + P.esc(info.message) + '</pre></details></div>' +
      '<div class="carte"><h2>📱 Application</h2><p>Reçue par ' + P.pluriel(info.dans_app, 'mannequin', 'mannequins') + ' (celles qui ont un compte), avec une notification sur leur téléphone si elles l’ont acceptée.</p></div>' +
      '<div class="carte"><h2>✉️ E-mail</h2><p>' + (avecEmail.length - restantEmail) + ' / ' + avecEmail.length + ' envoyé(s).</p>' +
      (restantEmail ? '<button class="btn rouge" type="button" data-action="infos-emails">Envoyer les e-mails (' + restantEmail + ')</button>' : '') + '<p class="doux" id="if-email-etat"></p></div>' +
      '<div class="carte"><h2>💬 WhatsApp</h2><p>' + (avecWa.length - restantWa) + ' / ' + avecWa.length + ' envoyé(s). Chaque appui ouvre WhatsApp avec le message prêt pour la personne suivante : appuyez sur « Envoyer », puis revenez ici.</p>' +
      (restantWa ? '<button class="btn rouge" type="button" data-action="infos-wa">Ouvrir WhatsApp pour la suivante (' + restantWa + ')</button>' : '') + '</div>' +
      '<div class="carte"><h2>Destinataires</h2><ul class="if-liste">' + info.destinataires.map(ligne).join('') + '</ul></div>';
  }
  // (noter un envoi fait : relu puis complété, pour ne rien perdre si deux appareils envoient)
  async function noterFait(champ, cle) {
    const l = (await P.bd(sb.from('infos_agence').select(champ).eq('id', ouverte.info.id)))[0];
    const deja = new Set((l && l[champ]) || []);
    deja.add(cle);
    await P.bd(sb.from('infos_agence').update({ [champ]: [...deja] }).eq('id', ouverte.info.id).select('id'));
    ouverte.info[champ] = [...deja];
  }
  P.actions['infos-emails'] = async (el) => {
    const { info, contacts } = ouverte, faits = new Set(info.faits_email);
    const liste = info.destinataires.filter((c) => contacts[c] && contactsEnvoi(contacts[c]).email && !faits.has(c));
    if (!liste.length || !confirm('Envoyer cette information par e-mail à ' + P.pluriel(liste.length, 'personne', 'personnes') + ' ?')) return;
    el.disabled = true;
    const etat = document.getElementById('if-email-etat'), echecs = [];
    for (let i = 0; i < liste.length; i++) {
      const d = contacts[liste[i]], k = contactsEnvoi(d);
      if (etat) etat.textContent = 'Envoi ' + (i + 1) + ' / ' + liste.length + '… (gardez la page ouverte)';
      try {
        await envoyerEmailCandidat({ to_email: k.email, to_name: k.parent ? salutationParent(d.parent_nom) : nomAvecCivilite(d), message: messagePourEmail(pourPersonne(info, d)) });  // (js/emailjs-config.js, js/messages-candidats.js)
        await noterFait('faits_email', liste[i]);
      } catch (e) { echecs.push(d.full_name || k.email); }
      if (i < liste.length - 1) await new Promise((r) => setTimeout(r, 1100));  // (limite du service d'e-mail)
    }
    P.message(echecs.length ? echecs.length + ' e-mail(s) non envoyé(s) : ' + echecs.join(', ') + '. Rappuyez pour réessayer.' : 'E-mails envoyés.');
    return P.afficher();
  };
  P.actions['infos-wa'] = async () => {
    const { info, contacts } = ouverte, faits = new Set(info.faits_wa);
    const c = info.destinataires.find((x) => contacts[x] && numeroWhatsApp(contactsEnvoi(contacts[x]).phone) && !faits.has(x));
    if (!c) return;
    const d = contacts[c];
    window.open('https://wa.me/' + numeroWhatsApp(contactsEnvoi(d).phone) + '?text=' + encodeURIComponent(pourPersonne(info, d)), '_blank', 'noopener');
    await noterFait('faits_wa', c);
    return P.afficher();
  };

  P.espaces.site.pages[PAGE] = (args) => {
    const a = args && args[0];
    if (a === 'nouvelle') return formulaire().catch((e) => { if (nonActive(e)) return P.entete('Informations agence') + PAS_ACTIVE; throw e; });
    if (a) return fiche(decodeURIComponent(a)).catch((e) => { if (nonActive(e)) return P.entete('Informations agence') + PAS_ACTIVE; throw e; });
    return liste();
  };
})();
