// Nouvelle Administration — groupe « Accès et outils » (bloc 1, étape 6), reconstruit à neuf
// (PLAN-NOUVELLE-ADMINISTRATION.md). Mêmes données et mêmes règles que l'ancien tableau de bord
// (inventaire du 22/10/2026, retiré à la démolition : historique git) :
//  - Codes d'accès : casting direct (fiche minimale « Retenue » + son code, casting_direct_creer),
//    codes disponibles et déjà utilisés, note d'intégration (écran partagé js/note-integration.js) ;
//  - Accès bloqués : /api/connexion-admin (débloquer, liste blanche des adresses de confiance) ;
//  - Drive et transferts : seulement des chiffres réels (rien d'inventé) ;
//  - Nettoyage des photos : nettoyer_photos_traitees_anciennes, et l'outil partagé
//    js/nettoyage-supabase.js (les photos des mannequins ne sont jamais touchées).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const msg = (id, classe, texte) => { const m = document.getElementById(id); if (m) { m.className = 'form-msg large ' + classe; m.textContent = texte; } };
  const nb = P.nombre;  // js/admin/coque.js

  // ---------- Codes d'accès ----------
  let dernierCode = null;  // code créé à l'instant (montré en haut de la page)
  function carteCode(c) {
    const nom = c.candidature && c.candidature.full_name;
    // le nom ouvre la candidature, sa photo vient se placer devant (js/admin/coque.js)
    const qui = nom && c.candidature_id ? '<a href="#/site/b2-candidatures/' + P.esc(c.candidature_id) + '">' + P.esc(nom) + '</a>' : nom ? P.esc(nom) : '<span class="doux">Ancien code sans nom</span>';
    return '<div class="code-ligne"><span class="code-valeur">' + P.esc(c.code) + '</span><span class="t">' + qui +
      '<small>' + (c.utilise ? 'utilisé le ' + P.date(c.utilise_le || c.created_at) : 'créé le ' + P.date(c.created_at)) + '</small></span>' +
      (c.utilise ? P.pastille('Utilisé', 'neutre') : '<button type="button" class="btn petit" data-action="code-copier" data-code="' + P.esc(c.code) + '">Copier</button>') + '</div>';
  }
  async function pageCodes() {
    const codes = await P.bd(sb.from('codes_inscription').select('code, utilise, utilise_le, created_at, candidature_id, candidature:casting_applications(full_name)').order('created_at', { ascending: false }).limit(200));
    const libres = codes.filter((c) => !c.utilise), utilises = codes.filter((c) => c.utilise);
    const nouveau = dernierCode ? '<section class="carte nouveau-code"><span class="surtitre">Code créé pour ' + P.esc(dernierCode.nom) + '</span><p class="code-grand">' + P.esc(dernierCode.code) + '</p>' +
      '<div class="ligne"><button type="button" class="btn" data-action="code-copier" data-code="' + P.esc(dernierCode.code) + '">Copier</button>' +
      (dernierCode.wa ? '<a class="btn rouge" href="' + P.esc(dernierCode.wa) + '" target="_blank" rel="noopener">💬 Envoyer par WhatsApp</a>' : '') + '</div></section>' : '';
    dernierCode = null;
    return P.entete('Codes d’accès') +
      '<p class="doux">Un code par personne retenue, valable une seule fois, créé seulement quand elle veut s’inscrire. Candidature reçue sur le site : ouvrez sa fiche (statut « Retenue »). Personne venue directement à l’agence : « Casting direct » ci-dessous.</p>' + nouveau +
      '<form class="carte f" data-form="casting-direct"><h2 class="large">Casting direct</h2>' +
      '<label class="fl" for="cd-nom">Nom et prénoms<input id="cd-nom" name="nom" required maxlength="160" autocomplete="off"></label>' +
      '<label class="fl" for="cd-telephone">Téléphone (WhatsApp)<input id="cd-telephone" name="telephone" type="tel" required autocomplete="off"></label>' + boutonContactTelephone('cd-telephone', 'cd-nom') +
      '<label class="fl" for="cd-genre">Genre<select id="cd-genre" name="genre" required><option value="">Choisir…</option><option value="femme">Femme</option><option value="homme">Homme</option></select></label>' +
      '<label class="fl" for="cd-naissance">Date de naissance<input id="cd-naissance" name="naissance" type="date" required></label>' +
      '<p class="form-msg large" id="cd-msg" role="status"></p><div class="large"><button class="btn rouge" type="submit">Créer la fiche et son code</button></div></form>' +
      '<section class="carte"><h2>Codes disponibles <span class="doux">(' + libres.length + ')</span></h2>' + (libres.map(carteCode).join('') || '<p class="doux">Aucun code disponible pour le moment.</p>') +
      '<details class="section-ouverte"><summary>Anciens codes déjà utilisés (' + utilises.length + ')</summary>' + (utilises.map(carteCode).join('') || '<p class="doux">Aucun code déjà utilisé.</p>') + '</details></section>' +
      '<section class="carte f"><h2 class="large">Note d’intégration (PDF)</h2><p class="doux large">Le document « Note d’information et procédure d’intégration », montré aux mannequins uniquement après la validation de leur code d’inscription. Il n’est jamais public : son adresse est secrète. Un nouveau dépôt remplace l’ancien document.</p>' +
      '<div class="large" id="ni-etat">Chargement…</div><label class="fl large" for="ni-fichier">Choisir le document (PDF)<input accept="application/pdf" id="ni-fichier" type="file"></label>' +
      '<div class="large"><button class="btn rouge" id="ni-envoyer-btn" type="button" disabled>Déposer ce document</button></div><p class="form-msg large" id="ni-msg" role="status"></p></section>';
  }
  P.formulaires['casting-direct'] = async (f) => {
    const v = (k) => String(f.get(k) || '').trim();
    const { data, error } = await sb.rpc('casting_direct_creer', { p_nom: v('nom'), p_telephone: v('telephone'), p_genre: v('genre'), p_naissance: v('naissance') || null });
    if (error || !data) { msg('cd-msg', 'err', error && /obligatoires/.test(error.message) ? error.message : 'La fiche n’a pas pu être créée : reconnectez-vous puis réessayez.'); return; }
    const d = { full_name: v('nom').toUpperCase(), phone: v('telephone'), genre: v('genre'), date_naissance: v('naissance'), type_candidature: 'direct' };
    dernierCode = { code: data.code, nom: d.full_name, wa: lienWhatsAppCode(d, data.code) };  // js/messages-candidats.js
    P.message('Fiche « Casting direct » créée (statut Retenue) : son code est prêt à envoyer.');
    return P.afficher();
  };
  P.actions['code-copier'] = (el) => {
    const texte = el.textContent;
    navigator.clipboard.writeText(el.dataset.code).then(() => { el.textContent = 'Copié !'; }, () => { el.textContent = 'Copie impossible'; });
    setTimeout(() => { if (el.isConnected) el.textContent = texte; }, 1600);
  };

  // ---------- Accès bloqués ----------
  const ESPACES = { admin: 'Connexion admin', 'admin-code': 'Code de validation admin', mannequin: 'Connexion mannequin', 'inscription-code': 'Code d’inscription', 'portail-code': 'Code d’invitation mannequin', '*': 'Même téléphone (tout le site)' };
  async function api(corps) {
    const session = (await sb.auth.getSession()).data.session;
    if (!session) throw new Error('Session expirée : reconnectez-vous.');
    const rep = await fetch('/api/connexion-admin', corps
      ? { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify(corps) }
      : { headers: { Authorization: 'Bearer ' + session.access_token } });
    if (!rep.ok) throw new Error('Le serveur a refusé la demande (' + rep.status + ').');
    return rep.json();
  }
  async function pageBlocages() {
    const d = await api(null);
    const lignes = [].concat((d.ipBloquees || []).map((b) => ({ type: 'ip', valeur: b.ip, espace: b.espace, jusqua: b.bloque_jusqua })),
      (d.comptesBloques || []).map((b) => ({ type: 'compte', valeur: b.identifiant, espace: b.espace, jusqua: b.bloque_jusqua })));
    const heure = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return P.entete('Accès bloqués', '<span class="doux">' + (lignes.length ? P.pluriel(lignes.length, 'blocage en cours', 'blocages en cours') : 'Aucun blocage') + '</span>') +
      '<p class="doux">Après 5 codes ou mots de passe erronés, l’accès est bloqué 1 h (2 h en cas de récidive). Une personne bloquée par erreur peut être débloquée ici.</p>' +
      '<section class="carte">' + (lignes.length ? lignes.map((l) => '<div class="code-ligne"><span class="t">' + P.esc(l.type === 'ip' ? 'Adresse ' + l.valeur : l.valeur) + '<small>' + P.esc(ESPACES[l.espace] || l.espace) + ' · jusqu’à ' + heure(l.jusqua) + '</small></span>' +
        '<button type="button" class="btn petit" data-action="debloquer" data-type="' + l.type + '" data-valeur="' + P.esc(l.valeur) + '" data-espace="' + P.esc(l.espace) + '">Débloquer</button></div>').join('') :
        '<p class="doux">✅ Aucun accès bloqué actuellement.</p>') + '</section>' +
      '<form class="carte f" data-form="liste-blanche"><h2 class="large">Adresses de confiance (jamais bloquées)</h2>' +
      ((d.listeBlanche || []).map((w) => '<div class="code-ligne large"><span class="t">' + P.esc(w.ip) + (w.note ? '<small>' + P.esc(w.note) + '</small>' : '') + '</span><button type="button" class="btn petit" data-action="liste-blanche-retirer" data-ip="' + P.esc(w.ip) + '">Retirer</button></div>').join('')) +
      '<label class="fl" for="lb-ip">Ajouter l’adresse internet d’un appareil<input id="lb-ip" name="ip" placeholder="ex. 90.12.34.56" autocomplete="off" maxlength="45"></label><div class="large"><button class="btn" type="submit">Ajouter à la liste</button></div></form>';
  }
  P.actions.debloquer = async (el) => {
    await api(el.dataset.type === 'ip' ? { action: 'debloquer_ip', ip: el.dataset.valeur, espace: el.dataset.espace } : { action: 'debloquer_compte', identifiant: el.dataset.valeur, espace: el.dataset.espace });
    P.message('Accès débloqué.');
    return P.afficher();
  };
  P.actions['liste-blanche-retirer'] = async (el) => { await api({ action: 'liste_blanche_retirer', ip: el.dataset.ip }); return P.afficher(); };
  P.formulaires['liste-blanche'] = async (f) => {
    const ip = String(f.get('ip') || '').trim();
    if (!ip) return;
    await api({ action: 'liste_blanche_ajouter', ip });
    P.message('Adresse ajoutée : elle ne sera jamais bloquée.');
    return P.afficher();
  };

  // ---------- Drive et transferts ----------
  async function pageDrive() {
    const [photosBook, publies, photosCandidatures] = await Promise.all([
      nb(sb.from('model_photos').select('id', { count: 'exact', head: true })),
      nb(sb.from('model_profiles').select('id', { count: 'exact', head: true }).eq('published', true)),
      nb(sb.from('casting_photos').select('id', { count: 'exact', head: true })).catch(() => null)
    ]);
    const carte = (l, v, s) => '<div class="carte-pilotage"><span class="l">' + P.esc(l) + '</span><span class="v">' + (v == null ? '—' : P.compte(v)) + '</span><span class="s">' + P.esc(s) + '</span></div>';
    return P.entete('Drive et transferts') + '<div class="cartes-pilotage">' + carte('Photos du Book', photosBook, 'en ligne sur le site') + carte('Mannequins publiés', publies, 'dans The Book') +
      carte('Photos de candidature', photosCandidatures, 'liens vers Google Drive') + '</div>' +
      '<p class="doux petit-texte">Les photos de candidature sont rangées dans Google Drive ; ici, le nombre de photos enregistrées.</p>';
  }

  // ---------- Nettoyage des photos ----------
  async function pageNettoyage() {
    return P.entete('Nettoyage des photos') +
      '<section class="carte"><h2>Photos des dossiers traités</h2><p class="doux">Une fois une candidature ou une inscription définitivement traitée, ses photos sont retirées de l’Administration après 5 jours (les fichiers restent dans Google Drive). Ce nettoyage tourne chaque nuit ; ce bouton le lance tout de suite.</p>' +
      '<button class="btn" type="button" data-action="nettoyer-traitees">Lancer le nettoyage maintenant</button><p class="form-msg" id="nt-msg" role="status"></p></section>' +
      '<section class="carte"><h2>Anciennes photos de l’ancien stockage</h2><p class="doux">Libère de la place en effaçant les anciennes copies qui ne servent plus. <b>Les photos des mannequins ne sont jamais touchées</b>, et rien ne change sur le site. Une confirmation est demandée avant d’effacer.</p>' +
      '<button class="btn" id="nettoyage-supabase-btn" type="button">Vérifier et nettoyer</button><p class="form-msg" id="nettoyage-supabase-msg" role="status"></p></section>';
  }
  P.actions['nettoyer-traitees'] = async (el) => {
    el.disabled = true;
    try {
      const n = await P.rpc('nettoyer_photos_traitees_anciennes');
      const m = document.getElementById('nt-msg');
      if (!m) { P.message(n > 0 ? P.pluriel(n, 'photo retirée', 'photos retirées') + ' des dossiers traités.' : 'Rien à nettoyer pour le moment.'); return; }  // (rubrique quittée entre-temps)
      m.className = 'form-msg ok';
      m.textContent = n > 0 ? P.pluriel(n, 'photo retirée', 'photos retirées') + ' (dossiers traités depuis plus de 5 jours). Les fichiers restent dans Google Drive.' : 'Rien à nettoyer pour le moment : aucun dossier traité depuis plus de 5 jours.';
    } finally { if (el.isConnected) el.disabled = false; }
  };

  Object.assign(P.espaces.site.pages, { 'b3b-codes-inscription': pageCodes, 'b3b-acces-bloques': pageBlocages, 'b3a-drive': pageDrive, 'b3a-nettoyage': pageNettoyage });
  P.espaces.site.apres['b3b-codes-inscription'] = () => window.demarrerNoteIntegration();
  P.espaces.site.apres['b3a-nettoyage'] = () => window.demarrerNettoyageSupabase();
  P.espaces.site.apres['b3a-drive'] = () => P.animerChiffres(document.getElementById('contenu'));
})();
