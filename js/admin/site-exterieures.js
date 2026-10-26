// Nouvelle Administration — « Mannequins extérieures » (23/10/2026, demande de la propriétaire) :
// les partenaires extérieures (carnet des Convocations sans lien avec le registre de l'agence :
// contacts_externes.mannequin_id vide), jamais comptées avec nos mannequins. Pour une période, les
// projets faits avec chacune (convoquée, ou invitée aux Places limitées), pour les retrouver et
// leur écrire facilement. Lecture seule. Ajout : « ＋ Ajouter une personne » des Places limitées
// et des Convocations (champsPersonne, js/agenda-outils.js).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const PAGE = 'b2-exterieures';
  let choix = '';  // '' (toujours), 'AAAA' ou 'AAAA-MM'

  // la période choisie : bornes [debut, fin[ des dates de projet (P.bornesPeriode, js/portail/noyau.js)
  const periode = (c) => (c ? P.bornesPeriode(c) : null);
  const choixPossibles = () => [['', 'Depuis toujours']].concat(P.choixPeriodes());
  // lecture par paquets de 200 identifiants (P.parPaquets, js/admin/coque.js)
  const parPaquets = (ids, lire) => P.parPaquets(ids, 200, (l) => P.bd(lire(l)));
  // Places limitées pas encore activées (supabase-places.sql) : aucune invitation ; toute autre
  // erreur (connexion…) s'affiche
  const placesAbsentes = P.pasActivee('places_invitations');

  async function page() {
    const contacts = await P.bd(sb.from('contacts_externes').select('id, civilite, nom, telephone, email').is('mannequin_id', null).order('nom'));
    const ids = contacts.map((c) => c.id);
    const [convoques, invitees] = await Promise.all([
      parPaquets(ids, (l) => sb.from('convocation_participants').select('contact_id, projet_id').in('contact_id', l)),
      parPaquets(ids, (l) => sb.from('places_invitations').select('contact_id, projet_id, statut').in('contact_id', l)).catch((e) => { if (placesAbsentes(e)) return []; throw e; })
    ]);
    // un projet compte s'il a été convoqué, ou si la personne a pris une place
    const liens = convoques.concat(invitees.filter((i) => i.statut === 'pris'));
    const parContact = new Map();  // contact → ses projets (un seul passage)
    liens.forEach((x) => { if (!parContact.has(x.contact_id)) parContact.set(x.contact_id, new Set()); parContact.get(x.contact_id).add(x.projet_id); });
    const projetIds = [...new Set(liens.map((x) => x.projet_id))];
    const projets = {};
    (await parPaquets(projetIds, (l) => sb.from('agenda_projets').select('id, titre, type, date_debut, date_fin, annule').in('id', l))).forEach((p) => { projets[p.id] = p; });
    const per = periode(choix);
    const dansPeriode = (p) => p && !p.annule && (!per || (p.date_debut >= per.debut && p.date_debut < per.fin));
    const fiches = contacts.map((c) => {
      const siens = [...(parContact.get(c.id) || [])].map((id) => projets[id]).filter(dansPeriode)
        .sort((a, b) => String(b.date_debut).localeCompare(String(a.date_debut)));
      return { c, projets: siens };
    }).filter((f) => !per || f.projets.length);
    const nbProjets = new Set(fiches.flatMap((f) => f.projets.map((p) => p.id))).size;

    const selecteur = '<label class="fl" for="ext-periode">Période<select id="ext-periode" data-change="exterieures-periode">' +
      choixPossibles().map((o) => '<option value="' + o[0] + '"' + (o[0] === choix ? ' selected' : '') + '>' + P.esc(o[1]) + '</option>').join('') + '</select></label>';
    const carte = (f) => {
      const nom = [f.c.civilite, f.c.nom].filter(Boolean).join(' '), wa = numeroWhatsApp(f.c.telephone);
      return '<article class="carte ext-fiche"><div class="ext-tete">' + P.visage('', f.c.nom, 'rond-vis') + '<div><h2>' + P.esc(nom) + '</h2>' +
        '<p class="doux">' + [f.c.telephone ? P.esc(f.c.telephone) : '', f.c.email ? P.esc(f.c.email) : ''].filter(Boolean).join(' · ') + '</p></div></div>' +
        (f.projets.length ? '<ul class="ext-projets">' + f.projets.map((p) => '<li><span>' + P.esc(p.titre) + '</span> <span class="doux">' + P.esc(P.date(p.date_debut)) + '</span></li>').join('') + '</ul>'
          : '<p class="doux">Aucun projet pour le moment.</p>') +
        (wa ? '<div class="ligne"><a class="btn petit" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">💬 WhatsApp</a></div>' : '') + '</article>';
    };
    return P.entete('Mannequins extérieures') +
      '<p class="doux">Partenaires extérieures (majeures), gardées à part : elles ne comptent jamais avec les mannequins de l’agence. On les ajoute avec « ＋ Ajouter une personne » dans les Places limitées ou les Convocations.</p>' +
      '<div class="carte f">' + selecteur + '</div>' +
      '<div class="chiffres">' + P.chiffre(per ? 'Avec qui on a travaillé' : 'Mannequins extérieures', String(fiches.length)) + P.chiffre('Projets', String(nbProjets)) + '</div>' +
      (fiches.length ? '<div class="ext-liste">' + fiches.map(carte).join('') + '</div>'
        : '<div class="carte vide">' + (per ? 'Aucune mannequin extérieure sur un projet de cette période.' : 'Aucune mannequin extérieure pour le moment.') + '</div>');
  }

  P.changements['exterieures-periode'] = (el) => { choix = el.value; return P.afficher(); };
  P.espaces.site.pages[PAGE] = page;
})();
