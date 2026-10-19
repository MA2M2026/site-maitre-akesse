// Portail — Sécurité (administrateur principal seul, cahier v2.3, sections 4 et 5) :
// comptes nominatifs et invitations, rôles, délégations datées, appareils, journal d'audit.
(function () {
  'use strict';
  const P = window.Portail;
  // (« Mes codes de secours » : ouvert à chacun ; le reste à l'administrateur principal seul)
  const principal = () => P.moi && P.moi.role === 'principal';
  const NAV = [['comptes', 'Comptes et rôles', principal], ['delegations', 'Délégations', principal], ['appareils', 'Appareils et sessions', principal], ['journal', 'Journal d’audit', principal], ['codes', 'Mes codes de secours']];
  const MODULES = { site: 'Administration du site', paiements: 'Suivi des paiements', compta: 'Comptabilité', noms_payeurs: 'Noms des payeurs (comptable)', contacts_prives: 'Contacts privés des mannequins' };

  async function comptes() {
    const liste = await P.bd(sb.from('staff_profiles').select('*').order('cree_le'));
    return P.entete('Comptes et rôles', P.pastille('Administrateur principal seul', 'neutre')) +
      '<div class="carte"><h2>Inviter une personne</h2><p class="doux">Elle reçoit un lien d’invitation par e-mail (valable 24 heures), choisit son mot de passe (12 caractères au moins) et active sa double authentification. Aucune inscription libre n’est possible.</p>' +
      '<form class="f" data-form="securite-inviter" style="margin-top:12px"><label class="fl" for="iv-nom">Nom<input id="iv-nom" name="nom" required></label>' +
      '<label class="fl" for="iv-mail">E-mail<input id="iv-mail" name="email" type="email" required></label>' +
      '<label class="fl" for="iv-role">Rôle<select id="iv-role" name="role"><option value="site">Administrateur du site</option><option value="caisse">Responsable des encaissements</option><option value="compta">Comptable</option></select></label>' +
      '<button class="btn rouge" type="submit">Envoyer l’invitation</button></form></div>' +
      P.tableau(['Personne', 'Rôle', 'Accès', 'Depuis', 'Actions'], liste.map((s) => '<tr><td><b>' + P.esc(s.nom) + '</b><div class="petit-texte doux">' + P.esc(s.email) + '</div></td>' +
        '<td>' + (s.role === 'principal' ? P.esc(P.ROLES.principal) : '<select data-change="securite-role" data-id="' + s.user_id + '" aria-label="Rôle de ' + P.esc(s.nom) + '">' +
          ['site', 'caisse', 'compta'].map((r) => '<option value="' + r + '"' + (r === s.role ? ' selected' : '') + '>' + P.esc(P.ROLES[r]) + '</option>').join('') + '</select>') + '</td>' +
        '<td>' + P.pastille(s.actif ? 'Actif' : 'Coupé', s.actif ? 'ok' : 'erreur') + '</td><td>' + P.date(s.cree_le) + '</td><td class="ligne">' +
        (s.role === 'principal' ? '<span class="doux petit-texte">compte unique, non supprimable</span>' :
          '<button class="btn petit" data-action="securite-actif" data-id="' + s.user_id + '" data-actif="' + (s.actif ? '1' : '0') + '">' + (s.actif ? 'Couper l’accès' : 'Rétablir') + '</button>' +
          '<button class="btn petit" data-action="securite-mfa" data-id="' + s.user_id + '" data-nom="' + P.esc(s.nom) + '">Réinitialiser la double authentification</button>') + '</td></tr>'));
  }
  P.formulaires['securite-inviter'] = async (f) => {
    await P.sensible(() => P.serveur('inviter', { nom: String(f.get('nom')).trim(), email: String(f.get('email')).trim().toLowerCase(), role: f.get('role') }));
    P.message('Invitation envoyée à ' + f.get('email') + '.');
    P.afficher();
  };
  P.changements['securite-role'] = async (el) => {
    try {
      await P.sensible(() => P.bd(sb.from('staff_profiles').update({ role: el.value }).eq('user_id', el.getAttribute('data-id'))));
      P.message('Rôle modifié.');
    } catch (e) { P.message(P.erreurTexte(e)); }
    P.afficher();
  };
  P.actions['securite-actif'] = async (el) => {
    const actif = el.getAttribute('data-actif') !== '1';
    await P.sensible(() => P.bd(sb.from('staff_profiles').update({ actif, desactive_le: actif ? null : new Date().toISOString() }).eq('user_id', el.getAttribute('data-id'))));
    // coupe aussi les sessions ouvertes (la base refuse déjà tout dès maintenant) ; un échec se
    // dit, au lieu d'être tu (relecture du 19/10/2026)
    let sessions = true;
    await P.serveur('acces', { user_id: el.getAttribute('data-id'), actif }).catch(() => { sessions = false; });
    P.message(!sessions ? (actif ? 'Accès rétabli dans le portail, mais la connexion n’a pas pu être débloquée : recommencez dans un instant.'
      : 'Accès coupé dans le portail, mais ses sessions ouvertes n’ont pas pu être fermées : recommencez dans un instant.')
      : (actif ? 'Accès rétabli.' : 'Accès coupé immédiatement.'));
    P.afficher();
  };
  P.actions['securite-mfa'] = async (el) => {
    if (!confirm('Réinitialiser la double authentification de ' + el.getAttribute('data-nom') + ' ? À sa prochaine connexion, il devra l’activer à nouveau.')) return;
    await P.sensible(() => P.serveur('reinitialiser_mfa', { user_id: el.getAttribute('data-id') }));
    P.message('Double authentification réinitialisée.');
  };

  async function delegations() {
    const [liste, personnes] = await Promise.all([
      P.bd(sb.from('staff_module_grants').select('*, personne:staff_profiles!staff_module_grants_user_id_fkey(nom, role)').order('cree_le', { ascending: false })),
      P.bd(sb.from('staff_profiles').select('user_id, nom, role').neq('role', 'principal').eq('actif', true))
    ]);
    const enCours = (g) => !g.revoque_le && (!g.fin || new Date(g.fin) > new Date());
    return P.entete('Délégations') + '<div class="note info">Cumul de rôles : accordez explicitement un second espace (ou un droit précis) à une personne. La délégation est datée, peut avoir une date de fin, figure dans le journal et se révoque en un clic.</div>' +
      '<form class="carte f" data-form="securite-deleguer"><label class="fl" for="dl-qui">Personne<select id="dl-qui" name="user_id">' + personnes.map((p) => '<option value="' + p.user_id + '">' + P.esc(p.nom) + ' (' + P.esc(P.ROLES[p.role]) + ')</option>').join('') + '</select></label>' +
      '<label class="fl" for="dl-mod">Accès accordé<select id="dl-mod" name="module">' + Object.keys(MODULES).map((k) => '<option value="' + k + '">' + P.esc(MODULES[k]) + '</option>').join('') + '</select></label>' +
      '<label class="fl" for="dl-fin">Date de fin (facultative)<input id="dl-fin" name="fin" type="date"></label><button class="btn rouge" type="submit">Accorder</button></form>' +
      P.tableau(['Personne', 'Accès', 'Depuis', 'Jusqu’au', 'État', ''], liste.map((g) => '<tr><td><b>' + P.esc(g.personne ? g.personne.nom : '—') + '</b></td><td>' + P.esc(MODULES[g.module]) + '</td><td>' + P.date(g.debut) + '</td><td>' + (g.fin ? P.date(g.fin) : '—') + '</td>' +
        '<td>' + P.pastille(enCours(g) ? 'En cours' : 'Terminée', enCours(g) ? 'ok' : 'neutre') + '</td><td>' + (enCours(g) ? '<button class="btn petit" data-action="securite-revoquer" data-id="' + g.id + '">Révoquer</button>' : '') + '</td></tr>'));
  }
  P.formulaires['securite-deleguer'] = async (f) => {
    const moi = (await sb.auth.getUser()).data.user.id;
    await P.sensible(() => P.bd(sb.from('staff_module_grants').insert({ user_id: f.get('user_id'), module: f.get('module'), fin: f.get('fin') || null, accorde_par: moi })));
    P.message('Délégation accordée.');
    P.afficher();
  };
  P.actions['securite-revoquer'] = async (el) => {
    await P.sensible(() => P.bd(sb.from('staff_module_grants').update({ revoque_le: new Date().toISOString() }).eq('id', el.getAttribute('data-id'))));
    P.message('Délégation révoquée.');
    P.afficher();
  };

  async function appareils() {
    const liste = await P.bd(sb.from('staff_devices').select('*, personne:staff_profiles(nom)').order('derniere_activite', { ascending: false }));
    return P.entete('Appareils et sessions') + '<div class="note info">Chaque appareil où le portail est utilisé apparaît ici. Révoquer un appareil coupe son accès immédiatement, même si l’application reste installée. Les sessions se verrouillent après 15 minutes sans activité et durent 8 heures au plus.</div>' +
      P.tableau(['Personne', 'Appareil', 'Première utilisation', 'Dernière activité', 'État', ''], liste.map((a) => '<tr><td><b>' + P.esc(a.personne ? a.personne.nom : '—') + '</b></td><td>' + P.esc(a.libelle || a.appareil.slice(0, 8)) + '</td><td>' + P.dateHeure(a.installe_le) + '</td><td>' + P.dateHeure(a.derniere_activite) + '</td>' +
        '<td>' + P.pastille(a.revoque ? 'Révoqué' : 'Autorisé', a.revoque ? 'erreur' : 'ok') + '</td><td><button class="btn petit" data-action="securite-appareil" data-id="' + a.id + '" data-revoque="' + (a.revoque ? '1' : '0') + '">' + (a.revoque ? 'Rétablir' : 'Révoquer') + '</button></td></tr>'));
  }
  P.actions['securite-appareil'] = async (el) => {
    await P.sensible(() => P.bd(sb.from('staff_devices').update({ revoque: el.getAttribute('data-revoque') !== '1' }).eq('id', el.getAttribute('data-id'))));
    P.afficher();
  };

  async function journal() {
    const filtre = P.etat.filtreJournal || '';
    let q = sb.from('audit_log').select('*').order('cree_le', { ascending: false }).limit(200);
    if (filtre) q = q.or('action.ilike.%' + filtre.replace(/[%,()]/g, '') + '%,objet.ilike.%' + filtre.replace(/[%,()]/g, '') + '%,acteur_nom.ilike.%' + filtre.replace(/[%,()]/g, '') + '%');
    const liste = await P.bd(q);
    return P.entete('Journal d’audit', P.pastille('Écriture seule', 'neutre')) + '<div class="note">Le journal est en écriture seule : aucune ligne ne peut être modifiée ni supprimée. Qui, quoi, quand, depuis quelle adresse, avec l’ancienne et la nouvelle valeur.</div>' +
      '<form data-form="securite-filtre" class="ligne"><label class="fl" for="jr-f" style="flex:1">Rechercher<input id="jr-f" name="filtre" value="' + P.esc(filtre) + '" placeholder="Paiement, sortie, rôle…"></label><button class="btn" type="submit">Filtrer</button></form>' +
      P.tableau(['Quand', 'Qui', 'Action', 'Objet', 'Adresse', 'Détail'], liste.map((a) => '<tr><td>' + P.dateHeure(a.cree_le) + '</td><td>' + P.esc(a.acteur_nom || 'Système') + '<div class="petit-texte doux">' + P.esc(P.ROLES[a.acteur_role] || a.acteur_role || '') + '</div></td>' +
        '<td><b>' + P.esc(a.action) + '</b></td><td>' + P.esc(a.objet || '') + '</td><td class="petit-texte">' + P.esc(a.ip || '') + '</td><td>' + (a.avant || a.apres ? '<details><summary class="petit-texte">Voir</summary><pre class="journal">' +
        P.esc(JSON.stringify({ avant: a.avant, apres: a.apres }, null, 1)) + '</pre></details>' : '') + '</td></tr>'));
  }
  P.formulaires['securite-filtre'] = (f) => { P.etat.filtreJournal = String(f.get('filtre')).trim(); P.afficher(); };

  // Codes de secours de la personne connectée : à refaire si elle ne les a jamais reçus (double
  // authentification activée avant le portail, 19/10/2026) ou les a perdus
  function codes() {
    return P.entete('Mes codes de secours') + '<div class="carte"><p>Les codes de secours servent si vous perdez votre téléphone : chacun remplace une fois le code de l’application d’authentification.</p>' +
      '<p class="doux">Créer de nouveaux codes annule les anciens. Votre code d’authentification vous sera demandé.</p>' +
      '<button class="btn rouge" data-action="securite-codes" style="margin-top:12px">Créer mes 8 codes de secours</button></div>';
  }
  P.actions['securite-codes'] = async () => {
    if (!confirm('Créer 8 nouveaux codes de secours ? Les anciens ne marcheront plus.')) return;
    try {
      P.montrerCodesSecours(await P.sensible(() => P.serveur('codes_secours_creer', {})), 'fermer-fenetre');
    } catch (e) { P.message(P.erreurTexte(e)); }
  };

  P.espaces.securite = { nav: NAV, pages: { comptes, delegations, appareils, journal, codes } };
  P.ESPACES.securite = 'Sécurité du portail';
})();
