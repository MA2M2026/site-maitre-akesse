// Portail — Espace 1 : Administration du site (cahier v2.3, section 6). Aucun montant,
// aucun lien de paiement, aucun contact privé : les listes passent par les vues
// v_site_mannequins, v_site_candidatures et v_site_dossiers (supabase-portail.sql).
(function () {
  'use strict';
  const P = window.Portail;
  const NAV = [
    ['vue', 'Vue d’ensemble'], ['mannequins', 'Mannequins'], ['candidatures', 'Candidatures casting'],
    ['recruteurs', 'Demandes recruteurs'], ['dossiers', 'Dossiers d’inscription'], ['codes', 'Codes d’accès'],
    ['outils', 'Outils et gestion détaillée']
  ];
  const STATUTS_CANDIDATURE = { nouvelle: 'Nouvelle', vue: 'Vue', 'en étude': 'En étude', 'en attente': 'En attente', retenue: 'Retenue', 'refusée': 'Refusée', inscrite: 'Inscrite' };
  const TON_CANDIDATURE = { nouvelle: 'info', vue: 'neutre', 'en étude': 'alerte', 'en attente': 'alerte', retenue: 'ok', 'refusée': 'erreur', inscrite: 'ok' };
  const TON_DOSSIER = { 'en cours': 'alerte', 'validé': 'ok', 'refusé': 'erreur' };
  const TON_CODE = { genere: 'info', utilise: 'ok', expire: 'neutre', bloque: 'erreur', annule: 'neutre' };
  const LIBELLE_CODE = { genere: 'Code généré', utilise: 'Utilisé', expire: 'Expiré', bloque: 'Bloqué', annule: 'Annulé' };
  const compter = async (table, filtre) => {
    let q = sb.from(table).select('*', { count: 'exact', head: true });
    if (filtre) q = filtre(q);
    const { count, error } = await q;
    return error ? '—' : count;
  };
  const masque = () => !(P.moi.contacts_prives);

  async function vue() {
    const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
    const [publies, candidatures, aTraiter, recruteurs, actus, photos, visites, dossiers] = await Promise.all([
      compter('v_site_mannequins', (q) => q.eq('published', true)),
      compter('v_site_candidatures'),
      compter('v_site_candidatures', (q) => q.in('status', ['nouvelle', 'vue'])),
      compter('recruiter_requests', (q) => q.eq('status', 'nouvelle')),
      compter('actualites'),
      compter('model_photos'),
      sb.from('page_views').select('page, created_at').gte('created_at', depuis).limit(20000),
      P.bd(sb.from('v_site_dossiers').select('statut'))
    ]);
    const lignes = (visites.data || []);
    const parJour = {}, parPage = {};
    for (let i = 29; i >= 0; i--) parJour[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] = 0;
    lignes.forEach((v) => {
      const j = String(v.created_at).slice(0, 10);
      if (j in parJour) parJour[j]++;
      const p = String(v.page || '/').replace(/\.html$/, '') || '/';
      parPage[p] = (parPage[p] || 0) + 1;
    });
    const max = Math.max(1, ...Object.values(parJour));
    const jours = Object.keys(parJour);
    const top = Object.entries(parPage).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const enCours = dossiers.filter((d) => d.statut === 'en cours').length;
    return P.entete('Vue d’ensemble', P.pastille('Aucune donnée financière dans cet espace', 'ok')) +
      '<div class="grille chiffres">' + P.chiffre('Mannequins publiés', publies) + P.chiffre('Candidatures reçues', candidatures) +
      P.chiffre('Candidatures à traiter', aTraiter) + P.chiffre('Dossiers d’inscription en cours', enCours) +
      P.chiffre('Demandes recruteurs nouvelles', recruteurs) + P.chiffre('Actualités', actus) + P.chiffre('Photos', photos) + '</div>' +
      '<div class="grille deux"><div class="carte"><h2>Visites des 30 derniers jours</h2><p class="petit-texte doux">' + lignes.length + ' pages vues au total</p>' +
      '<div class="colonnes" role="img" aria-label="Visites par jour">' + jours.map((j, i) => '<div' + (i === jours.length - 1 ? ' class="rouge"' : '') + ' style="height:' + Math.round(parJour[j] / max * 100) + '%" title="' + P.date(j) + ' : ' + parJour[j] + '"></div>').join('') + '</div>' +
      '<div class="ligne ecartee petit-texte doux" style="margin-top:6px"><span>' + P.date(jours[0]) + '</span><span>Aujourd’hui</span></div></div>' +
      '<div class="carte"><h2>Pages les plus vues</h2><div class="barres" style="margin-top:14px">' +
      (top.length ? top.map((t, i) => P.barre(t[0], t[1], top[0][1], i === 0, t[1] + ' vues')).join('') : '<p class="doux">Pas encore de visites.</p>') + '</div></div></div>';
  }

  async function mannequins() {
    const liste = await P.bd(sb.from('v_site_mannequins').select('*').order('created_at', { ascending: false }).limit(500));
    return P.entete('Mannequins', '<a class="btn petit" href="/mannequins.html" target="_blank" rel="noopener">Voir The Book</a>') +
      (masque() ? '<div class="note">Les téléphones et e-mails privés sont masqués pour votre rôle.</div>' : '') +
      P.tableau(['Mannequin', 'Âge', 'Catégorie', 'Ville', 'Photos', 'Contact', 'Publication', 'Action'], liste.map((m) => {
        const age = P.age(m.date_naissance);
        const etat = m.desactive ? P.pastille('En sourdine', 'neutre') : m.published ? P.pastille('Publié', 'ok') : m.en_attente_validation ? P.pastille('À valider', 'alerte') : P.pastille('Brouillon', 'neutre');
        return '<tr><td><b>' + P.esc(m.full_name || 'Sans nom') + '</b></td><td>' + (age != null ? age + ' ans' : '—') + '</td><td>' + P.esc(m.category || '—') + '</td><td>' + P.esc(m.city || '—') +
          '</td><td class="nombre">' + m.photos + '</td><td>' + (masque() ? '<span class="doux">•••• ••• •••</span>' : P.esc(m.phone || m.contact_email || '—')) + '</td><td>' + etat + '</td><td class="ligne">' +
          '<button class="btn petit" data-action="site-publier" data-id="' + m.id + '" data-publie="' + (m.published ? '1' : '0') + '">' + (m.published ? 'Retirer' : 'Publier') + '</button>' +
          (m.slug ? '<a class="btn petit" href="/mannequin.html?id=' + m.id + '" target="_blank" rel="noopener">Fiche</a>' : '') + '</td></tr>';
      })) + '<p class="petit-texte doux">Mensurations, photos et vidéos se modifient dans « Outils et gestion détaillée ».</p>';
  }
  P.actions['site-publier'] = async (el) => {
    const publier = el.getAttribute('data-publie') !== '1';
    await P.bd(sb.from('model_profiles').update({ published: publier }).eq('id', el.getAttribute('data-id')));
    P.message(publier ? 'Fiche publiée.' : 'Fiche retirée du site.');
    P.afficher();
  };

  async function candidatures() {
    const liste = await P.bd(sb.from('v_site_candidatures').select('*').order('created_at', { ascending: false }).limit(300));
    return P.entete('Candidatures casting', '<button class="btn rouge petit" data-action="site-casting-direct">Casting direct</button>') +
      '<div class="note info">« Générer le code » crée le code individuel d’inscription (usage unique, ' +
      'valable 30 jours). Il ne s’affiche qu’une fois : donnez-le au mannequin (ou au parent si mineur).</div>' +
      P.tableau(['Candidat', 'Âge', 'Origine', 'Reçue le', 'Statut', 'Code', 'Action'], liste.map((c) => {
        const age = P.age(c.date_naissance);
        return '<tr><td><b>' + P.esc(c.full_name) + '</b><div class="petit-texte doux">' + P.esc([c.genre, c.city, c.height_cm ? c.height_cm + ' cm' : ''].filter(Boolean).join(' · ')) + '</div>' +
          (masque() ? '' : '<div class="petit-texte">' + P.esc(c.phone || '') + ' ' + P.esc(c.email || '') + '</div>') + '</td>' +
          '<td>' + (age != null ? age + ' ans' + (age < 18 ? ' ' + P.pastille('mineur', 'neutre') : '') : '—') + '</td>' +
          '<td>' + (c.source === 'direct' ? P.pastille('Casting direct', 'info') + (c.lieu_casting ? '<div class="petit-texte doux">' + P.esc(c.lieu_casting) + '</div>' : '') : 'En ligne') + '</td>' +
          '<td>' + P.date(c.created_at) + '</td>' +
          '<td><select data-change="site-statut-candidature" data-id="' + c.id + '" aria-label="Statut de ' + P.esc(c.full_name) + '"' + (c.status === 'inscrite' ? ' disabled' : '') + '>' +
          Object.keys(STATUTS_CANDIDATURE).filter((k) => k !== 'inscrite' || c.status === 'inscrite').map((k) => '<option value="' + P.esc(k) + '"' + (k === c.status ? ' selected' : '') + '>' + STATUTS_CANDIDATURE[k] + '</option>').join('') + '</select></td>' +
          '<td>' + (c.code_statut ? P.pastille(LIBELLE_CODE[c.code_statut] + (c.code_indice ? ' · …' + c.code_indice : ''), TON_CODE[c.code_statut]) : '—') + '</td>' +
          '<td>' + (c.status !== 'inscrite' && c.status !== 'refusée' ? '<button class="btn petit" data-action="site-code" data-id="' + c.id + '">' + (c.code_statut ? 'Nouveau code' : 'Générer le code') + '</button>' : '') + '</td></tr>';
      }));
  }
  P.changements['site-statut-candidature'] = async (el) => {
    await P.bd(sb.rpc('portail_statut_candidature', { p_id: el.getAttribute('data-id'), p_statut: el.value }));
    P.message('Statut mis à jour.');
  };
  function montrerCode(code, nom) {
    P.fenetre('<h2>Code d’inscription de ' + P.esc(nom || 'ce mannequin') + '</h2><p class="doux">Notez-le maintenant : pour des raisons de sécurité, il ne sera plus affiché. Le mannequin le saisit avec sa date de naissance sur la page d’inscription.</p>' +
      '<div class="carte" style="text-align:center;font-size:28px;font-weight:800;letter-spacing:3px">' + P.esc(code) + '</div>' +
      '<div class="ligne"><button class="btn rouge" data-action="copier" data-texte="' + P.esc(code) + '">Copier</button><button class="btn" data-action="fermer-fenetre-afficher">Fermer</button></div>');
  }
  P.actions['fermer-fenetre-afficher'] = () => { P.fenetre(''); P.afficher(); };
  P.actions.copier = async (el) => {
    try { await navigator.clipboard.writeText(el.getAttribute('data-texte')); P.message('Copié.'); } catch (e) { P.message('Sélectionnez le texte pour le copier.'); }
  };
  P.actions['site-code'] = async (el) => {
    const nom = el.closest('tr').querySelector('b').textContent;
    const code = await P.rpc('generer_code_inscription', { p_candidature: el.getAttribute('data-id') });
    montrerCode(code, nom);
  };
  P.actions['site-casting-direct'] = () => {
    P.fenetre('<form data-form="site-casting-direct" class="f"><h2>Casting direct</h2><p class="doux large">Fiche minimale créée par l’agence. Elle est retenue d’office et le code est généré tout de suite. Les photos pourront être ajoutées plus tard.</p>' +
      '<label class="fl large" for="cd-nom">Nom et prénoms<input id="cd-nom" name="nom" required></label>' +
      '<label class="fl" for="cd-nais">Date de naissance<input id="cd-nais" name="naissance" type="date" required></label>' +
      '<label class="fl" for="cd-tel">Téléphone<input id="cd-tel" name="telephone" type="tel" required></label>' +
      '<label class="fl" for="cd-genre">Genre<select id="cd-genre" name="genre"><option value="">—</option><option value="femme">Femme</option><option value="homme">Homme</option></select></label>' +
      '<label class="fl" for="cd-lieu">Lieu du casting (facultatif)<input id="cd-lieu" name="lieu"></label>' +
      '<label class="fl" for="cd-pnom">Nom du parent (obligatoire si mineur)<input id="cd-pnom" name="parent_nom"></label>' +
      '<label class="fl" for="cd-ptel">Téléphone du parent<input id="cd-ptel" name="parent_tel" type="tel"></label>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">Créer la fiche et le code</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
  };
  P.formulaires['site-casting-direct'] = async (f) => {
    const age = P.age(f.get('naissance'));
    if (age != null && age < 18 && (!String(f.get('parent_nom')).trim() || !String(f.get('parent_tel')).trim())) {
      P.message('Mannequin mineur : le nom et le téléphone du parent sont obligatoires.');
      return;
    }
    const r = await P.rpc('casting_direct', {
      p_nom: f.get('nom'), p_naissance: f.get('naissance'), p_telephone: f.get('telephone'), p_lieu: f.get('lieu'),
      p_parent_nom: f.get('parent_nom'), p_parent_tel: f.get('parent_tel'), p_genre: f.get('genre') || null
    });
    montrerCode(r.code, f.get('nom'));
    if (r.doublon_possible) P.message('Attention : une candidature avec le même téléphone ou le même nom et la même date existe déjà.');
  };

  async function recruteurs() {
    const liste = await P.bd(sb.from('recruiter_requests').select('*').order('created_at', { ascending: false }).limit(200));
    return P.entete('Demandes recruteurs') + P.tableau(['Demande', 'Projet', 'Date souhaitée', 'Coordonnées', 'Statut'], liste.map((r) =>
      '<tr><td><b>' + P.esc(r.company || r.contact_name) + '</b><div class="petit-texte doux">' + P.esc(r.contact_name) + ' · reçue le ' + P.date(r.created_at) + '</div></td>' +
      '<td>' + P.esc(r.project_type || '—') + '<div class="petit-texte doux">' + P.esc((r.message || '').slice(0, 120)) + '</div></td><td>' + P.date(r.event_date) + '</td>' +
      '<td class="petit-texte">' + P.esc(r.email) + '<br>' + P.esc(r.phone || r.whatsapp || '') + '</td>' +
      '<td><select data-change="site-statut-recruteur" data-id="' + r.id + '" aria-label="Statut">' + ['nouvelle', 'vue', 'traitée'].map((s) => '<option' + (s === r.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></td></tr>'));
  }
  P.changements['site-statut-recruteur'] = async (el) => {
    await P.bd(sb.from('recruiter_requests').update({ status: el.value }).eq('id', el.getAttribute('data-id')));
    P.message('Statut mis à jour.');
  };

  async function dossiers() {
    const [nouveaux, anciens] = await Promise.all([
      P.bd(sb.from('v_site_dossiers').select('*').order('date_entree', { ascending: false })),
      sb.from('inscriptions_mannequins').select('id, full_name, statut, created_at').order('created_at', { ascending: false }).limit(200)
    ]);
    const neutre = (s) => /pay|valid/i.test(s) ? 'validé' : /annul|refus/i.test(s) ? 'refusé' : 'en cours';
    const lignes = nouveaux.map((d) => '<tr><td><b>' + P.esc(d.nom) + '</b></td><td>' + P.esc(d.categorie || '—') + '</td><td>' + P.date(d.date_entree) + '</td><td>' + P.pastille(d.statut, TON_DOSSIER[d.statut]) + '</td></tr>')
      .concat((anciens.data || []).map((d) => '<tr><td><b>' + P.esc(d.full_name) + '</b><div class="petit-texte doux">ancienne inscription</div></td><td>—</td><td>' + P.date(d.created_at) + '</td><td>' + P.pastille(neutre(d.statut), TON_DOSSIER[neutre(d.statut)]) + '</td></tr>'));
    return P.entete('Dossiers d’inscription') + '<div class="note">Statut neutre seulement (en cours, validé, refusé) : le paiement relève de l’espace « Suivi des paiements ».</div>' +
      P.tableau(['Dossier', 'Catégorie', 'Date', 'Statut'], lignes);
  }

  async function codes() {
    const [portail, invitations, individuels] = await Promise.all([
      sb.from('code_portail_mannequin').select('*').limit(5),
      sb.from('invite_codes').select('*').order('created_at', { ascending: false }).limit(50),
      P.bd(sb.from('v_site_candidatures').select('full_name, code_statut, code_indice').not('code_statut', 'is', null).limit(300))
    ]);
    const parStatut = {};
    individuels.forEach((c) => { parStatut[c.code_statut] = (parStatut[c.code_statut] || 0) + 1; });
    return P.entete('Codes d’accès') +
      '<div class="grille chiffres">' + Object.keys(LIBELLE_CODE).map((k) => P.chiffre('Codes ' + LIBELLE_CODE[k].toLowerCase(), parStatut[k] || 0)).join('') + '</div>' +
      '<div class="carte"><h2>Codes individuels d’inscription</h2><p class="doux">Un code par mannequin retenu, généré depuis « Candidatures casting ». Le code général d’inscription (MA2M2026) est remplacé par ces codes.</p></div>' +
      P.tableau(['Mannequin', 'Code'], individuels.map((c) => '<tr><td>' + P.esc(c.full_name) + '</td><td>' + P.pastille(LIBELLE_CODE[c.code_statut] + (c.code_indice ? ' · …' + c.code_indice : ''), TON_CODE[c.code_statut]) + '</td></tr>')) +
      '<div class="carte"><h2>Code d’invitation de l’espace mannequin</h2><p class="doux">' + ((portail.data || []).length ? 'Un code est en place. Il se change dans « Outils et gestion détaillée ».' : 'Aucun code en place.') + '</p>' +
      '<p class="petit-texte doux">' + ((invitations.data || []).length) + ' code(s) d’invitation enregistré(s).</p></div>';
  }

  async function outils() {
    return P.entete('Outils et gestion détaillée') +
      '<div class="grille deux"><div class="carte"><h2>Gestion détaillée du site</h2><p class="doux">Fiches complètes des mannequins (mensurations, photos, vidéos), actualités et événements, agenda, partenaires, couverture de l’accueil, messages groupés, bandeau d’annonce, réglages. Aucune donnée de paiement n’y figure.</p>' +
      '<a class="btn rouge" href="/tableau-de-bord?depuis=portail" style="margin-top:12px">Ouvrir la gestion détaillée</a></div>' +
      '<div class="carte"><h2>QR code avec logo</h2><p class="doux">Générateur de QR code à l’image de l’agence.</p><a class="btn" href="/outils/qr-generateur.html" target="_blank" rel="noopener" style="margin-top:12px">Ouvrir</a></div>' +
      '<div class="carte"><h2>Carte de visite</h2><p class="doux">Carte de visite de l’agence avec QR code.</p><a class="btn" href="/outils/carte-visite.html" target="_blank" rel="noopener" style="margin-top:12px">Ouvrir</a></div></div>';
  }

  P.espaces.site = { nav: NAV, pages: { vue, mannequins, candidatures, recruteurs, dossiers, codes, outils } };
})();
