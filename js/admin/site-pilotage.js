// Nouvelle Administration — groupe « Pilotage » et « Messages de contact » du bloc 1 (étape 4),
// reconstruits à neuf (PLAN-NOUVELLE-ADMINISTRATION.md). Mêmes chiffres que l'ancien tableau de
// bord (INVENTAIRE-BLOC1.md), rien d'inventé :
//  - Vue d'ensemble : 8 cartes et la liste des alertes (fiches à valider, prochain casting,
//    nouvelles candidatures, demandes recruteurs) ; raccourcis Messages groupés, Nouveau casting ;
//  - À traiter : seulement ce qui attend (nombre > 0), chaque ligne ouvre sa rubrique ; aussi en
//    pastille dans le menu (P.espaces.site.compteur) ;
//  - Top 3 et classement : les 10 fiches les plus visitées sur 7 jours, avec leurs visages ;
//  - Répartition des profils : femmes, hommes, enfants (moins de 18 ans) parmi les candidatures ;
//  - Évolution des candidatures : 6 dernières semaines ;
//  - Messages de contact : les derniers messages reçus, WhatsApp en un appui.
// Aucun chiffre d'argent ici (bloc 1).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const nb = async (requete) => { const { count, error } = await requete; if (error) throw error; return count || 0; };
  const tete = (table) => sb.from(table).select('id', { count: 'exact', head: true });
  const essai = (x) => Promise.resolve(x).catch(() => null);
  const pluriel = P.pluriel;
  function lundi() { const d = new Date(); const j = (d.getDay() + 6) % 7; d.setDate(d.getDate() - j); d.setHours(0, 0, 0, 0); return d.toISOString(); }
  function debutMois() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); }
  function quandCasting(date) {
    const auj = P.aujourdhui(), demain = new Date(Date.now() + 864e5).toLocaleDateString('fr-CA', { timeZone: 'Africa/Abidjan' });
    if (date === auj) return 'aujourd’hui';
    if (date === demain) return 'demain';
    return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ---------- À traiter (aussi en pastilles dans le menu) ----------
  async function aTraiter() {
    const [validations, candidatures, recruteurs] = await Promise.all([
      essai(nb(tete('model_profiles').eq('en_attente_validation', true))),
      essai(nb(tete('casting_applications').eq('status', 'nouvelle'))),
      essai(nb(tete('recruiter_requests').eq('status', 'nouvelle')))
    ]);
    return { validations: validations || 0, candidatures: candidatures || 0, recruteurs: recruteurs || 0 };
  }
  // pastilles du menu : mises à jour sans faire attendre la page
  P.rafraichirCompteursSite = async () => {
    const t = await aTraiter();
    const total = t.validations + t.candidatures + t.recruteurs;
    P.espaces.site.compteur = { 'b1-a-traiter': total, 'b2-candidatures': t.candidatures, 'b2-validations': t.validations, 'b2-recruteurs': t.recruteurs };
    document.querySelectorAll('#menu-lateral a.nav').forEach((a) => {
      const cle = (a.getAttribute('href') || '').split('/')[2], n = P.espaces.site.compteur[cle];
      let pastille = a.querySelector('.compteur');
      if (!n) { if (pastille) pastille.remove(); return; }
      if (!pastille) { pastille = document.createElement('span'); pastille.className = 'compteur'; a.appendChild(pastille); }
      pastille.textContent = n > 99 ? '99+' : String(n);
    });
  };
  async function pageATraiter() {
    const t = await aTraiter();
    const lignes = [['#/site/b2-validations', 'Fiches mannequins à valider', 'Espace mannequin', t.validations],
      ['#/site/b2-candidatures', 'Nouvelles candidatures', 'Casting et agence', t.candidatures],
      ['#/site/b2-recruteurs', 'Demandes recruteurs non lues', 'Marques et organisateurs', t.recruteurs]].filter((l) => l[3] > 0);
    const total = lignes.reduce((s, l) => s + l[3], 0);
    return P.entete('À traiter', '<span class="doux">' + (total ? pluriel(total, 'action en attente', 'actions en attente') : 'Tout est à jour') + '</span>') +
      (lignes.length ? '<div class="taches">' + lignes.map((l) => '<a class="tache" href="' + l[0] + '"><span class="point chaud"></span><span class="t">' + P.esc(l[1]) + '<small>' + P.esc(l[2]) + '</small></span><b>' + P.compte(l[3]) + '</b></a>').join('') + '</div>' :
        '<div class="carte vide">✅ Rien à traiter pour le moment.</div>');
  }

  // ---------- Vue d'ensemble ----------
  async function pageEnsemble() {
    const auj = P.aujourdhui();
    const [publies, nouveauxMois, candidatures, nouvelles, castings, prochain, visitesJour, visitesSemaine, recruteurs, recruteursNouveaux, contactsSemaine, aValider] = await Promise.all([
      essai(nb(tete('model_profiles').eq('published', true))),
      essai(nb(tete('model_profiles').eq('published', true).gte('created_at', debutMois()))),
      essai(nb(tete('casting_applications'))),
      essai(nb(tete('casting_applications').eq('status', 'nouvelle'))),
      essai(nb(tete('casting_projets').eq('actif', true))),
      essai(P.bd(sb.from('casting_projets').select('nom, date_casting, lieu').eq('actif', true).gte('date_casting', auj).order('date_casting', { ascending: true }).limit(1))),
      essai(P.rpc('stats_visites_reelles_site', { depuis: new Date(new Date().setHours(0, 0, 0, 0)).toISOString() })),
      essai(P.rpc('stats_visites_reelles_site', { depuis: new Date(Date.now() - 7 * 864e5).toISOString() })),
      essai(nb(tete('recruiter_requests'))),
      essai(nb(tete('recruiter_requests').eq('status', 'nouvelle'))),
      essai(nb(tete('messages_contact').gte('created_at', lundi()))),
      essai(nb(tete('model_profiles').eq('en_attente_validation', true)))
    ]);
    const visites = (v) => (v == null ? null : typeof v === 'number' ? v : Array.isArray(v) ? (v[0] && (v[0].total || v[0].nb_visites || v[0].count)) || 0 : v.total || 0);
    const cartes = [
      ['#/site/b2-mannequins-publies', 'Mannequins au Book', publies, nouveauxMois ? '+' + nouveauxMois + ' ce mois-ci' : 'Book public'],
      ['#/site/b2-candidatures', 'Candidatures', candidatures, nouvelles ? pluriel(nouvelles, 'nouvelle', 'nouvelles') : 'aucune nouvelle'],
      ['#/site/b2-projets', 'Castings actifs', castings, prochain && prochain[0] ? 'prochain : ' + quandCasting(prochain[0].date_casting) : 'aucun à venir'],
      ['#/site/v2-top3', 'Visites aujourd’hui', visites(visitesJour), 'visiteurs réels du site'],
      ['#/site/v2-top3', 'Visites sur 7 jours', visites(visitesSemaine), 'visiteurs réels du site'],
      ['#/site/b2-recruteurs', 'Demandes recruteurs', recruteurs, recruteursNouveaux ? pluriel(recruteursNouveaux, 'non lue', 'non lues') : 'toutes lues'],
      ['#/site/b2-contacts', 'Messages de contact', contactsSemaine, 'cette semaine'],
      ['#/site/b2-validations', 'Fiches à valider', aValider, aValider ? 'à vérifier' : 'aucune']
    ];
    const alertes = [];
    if (aValider) alertes.push(['#/site/b2-validations', pluriel(aValider, 'fiche mannequin à valider', 'fiches mannequins à valider')]);
    if (prochain && prochain[0]) alertes.push(['#/site/b2-messages-groupes', 'Casting « ' + prochain[0].nom + ' » ' + quandCasting(prochain[0].date_casting) + (prochain[0].lieu ? ' (' + prochain[0].lieu + ')' : '') + ' : penser à envoyer le rappel']);
    if (nouvelles) alertes.push(['#/site/b2-candidatures', pluriel(nouvelles, 'nouvelle candidature', 'nouvelles candidatures')]);
    if (recruteursNouveaux) alertes.push(['#/site/b2-recruteurs', pluriel(recruteursNouveaux, 'demande recruteur non lue', 'demandes recruteurs non lues')]);
    return P.entete('Vue d’ensemble', '<a class="btn" href="#/site/b2-messages-groupes">📣 Messages groupés</a><a class="btn rouge" href="#/site/b2-projets">＋ Nouveau casting</a>') +
      '<div class="cartes-pilotage">' + cartes.map((c, i) => '<a class="carte-pilotage apparait" style="--i:' + i + '" href="' + c[0] + '"><span class="l">' + P.esc(c[1]) + '</span>' +
        '<span class="v">' + (c[2] == null ? '—' : P.compte(c[2])) + '</span><span class="s">' + P.esc(c[3]) + '</span></a>').join('') + '</div>' +
      '<section class="carte"><h2>À surveiller</h2>' + (alertes.length ? '<div class="alertes">' + alertes.map((a) => '<a class="alerte-ligne" href="' + a[0] + '"><span class="point chaud"></span>' + P.esc(a[1]) + '<span aria-hidden="true">→</span></a>').join('') + '</div>' :
        '<p class="doux">✅ Rien à traiter.</p>') + '</section>';
  }

  // ---------- Top 3 et classement (visites des fiches sur 7 jours) ----------
  async function pageTop() {
    const stats = await P.rpc('stats_classement_mannequins', { depuis: new Date(Date.now() - 7 * 864e5).toISOString() }).catch(() => []);
    const tri = (stats || []).slice().sort((a, b) => (b.nb_visites || 0) - (a.nb_visites || 0));
    const top = tri.slice(0, 10), ids = top.map((s) => s.model_id);
    if (!top.length) return P.entete('Top 3 et classement') + '<div class="carte vide">Pas encore de visites de fiches cette semaine.</div>';
    const [profils, photos] = await Promise.all([P.bd(sb.from('model_profiles').select('id, full_name').in('id', ids)), P.photosCouverture(ids).catch(() => ({}))]);
    const nom = {}; profils.forEach((p) => { nom[p.id] = p.full_name; });
    const max = Math.max(1, top[0].nb_visites || 0);
    const PRIX = ['✦ 1re place', '✦ 2e place', '✦ 3e place'];
    const podium = top.slice(0, 3).map((s, i) => '<div class="podium-place place-' + (i + 1) + ' apparait" style="--i:' + i + '">' + P.visage(photos[s.model_id], nom[s.model_id], 'podium-visage') +
      '<span class="podium-prix">' + PRIX[i] + '</span><b>' + P.esc(nom[s.model_id] || 'Mannequin') + '</b><span class="doux">' + pluriel(s.nb_visites || 0, 'visite', 'visites') + '</span></div>').join('');
    const classement = top.map((s, i) => '<div class="classement-ligne apparait" style="--i:' + i + '"><span class="rang">' + (i + 1) + '</span>' + P.visage(photos[s.model_id], nom[s.model_id], 'rond-vis classement-visage') +
      '<span class="classement-nom">' + P.esc(nom[s.model_id] || 'Mannequin') + '<span class="piste"><i style="width:' + Math.max(4, Math.round(100 * (s.nb_visites || 0) / max)) + '%"></i></span></span><b>' + (s.nb_visites || 0) + '</b></div>').join('');
    return P.entete('Top 3 et classement', '<span class="doux">Visites des fiches sur 7 jours</span>') + '<div class="podium">' + podium + '</div>' +
      '<section class="carte"><h2>Les 10 fiches les plus visitées</h2><div class="classement">' + classement + '</div>' +
      (tri.length > 10 ? '<p class="doux petit-texte">+' + (tri.length - 10) + ' autres mannequins</p>' : '') + '</section>';
  }

  // ---------- Répartition des profils ----------
  async function pageRepartition() {
    const [c, i] = await Promise.all([
      P.bd(sb.from('casting_applications').select('id, genre, date_naissance').limit(5000)),
      essai(P.bd(sb.from('inscriptions_mannequins').select('id, genre, date_naissance').limit(5000)))
    ]);
    const tous = c.concat(i || []);
    let f = 0, h = 0, e = 0;
    tous.forEach((d) => { const a = P.age(d.date_naissance); if (a !== null && a !== undefined && a < 18) e++; else if (d.genre === 'homme') h++; else if (d.genre === 'femme') f++; });
    const total = f + h + e, pc = (n) => (total ? Math.round(100 * n / total) : 0);
    const pf = pc(f), ph = pc(h), pe = total ? 100 - pf - ph : 0;
    return P.entete('Répartition des profils', '<span class="doux">' + P.pluriel(c.length, 'candidature', 'candidatures') + ' + ' + P.pluriel((i || []).length, 'inscription', 'inscriptions') + '</span>') +
      '<section class="carte repartition"><div class="donut" style="background:conic-gradient(var(--av-rouge) 0 ' + pf + '%, #8D7C7F ' + pf + '% ' + (pf + ph) + '%, #E8A83D ' + (pf + ph) + '% 100%)" role="img" aria-label="Femmes ' + pf + ' %, hommes ' + ph + ' %, enfants ' + pe + ' %"><span>' + total + '</span></div>' +
      '<ul class="legende-donut"><li><i class="f"></i>Femmes <b>' + pf + ' %</b> <span class="doux">(' + f + ')</span></li><li><i class="h"></i>Hommes <b>' + ph + ' %</b> <span class="doux">(' + h + ')</span></li>' +
      '<li><i class="e"></i>Enfants (moins de 18 ans) <b>' + pe + ' %</b> <span class="doux">(' + e + ')</span></li></ul></section>' +
      '<p class="doux petit-texte">Compte les candidatures et les inscriptions reçues, pas seulement les mannequins publiées.</p>';
  }

  // ---------- Évolution des candidatures (6 semaines) ----------
  async function pageEvolution() {
    const depuis = new Date(Date.now() - 42 * 864e5);
    const lignes = await P.bd(sb.from('casting_applications').select('created_at').gte('created_at', depuis.toISOString()).limit(20000));
    const sem = [0, 0, 0, 0, 0, 0];
    lignes.forEach((l) => { const k = Math.min(5, Math.floor((new Date(l.created_at) - depuis) / (7 * 864e5))); if (k >= 0) sem[k]++; });
    const max = Math.max(1, ...sem), L = window.innerWidth < 600 ? 340 : 600, H = window.innerWidth < 600 ? 230 : 200;  // téléphone : dessin plus étroit, donc lisible
    const points = sem.map((v, i) => [Math.round(40 + i * (L - 80) / 5), Math.round(H - 30 - (H - 60) * v / max)]);
    const total = sem.reduce((a, b) => a + b, 0);
    return P.entete('Évolution des candidatures', '<span class="doux">' + pluriel(total, 'candidature', 'candidatures') + ' en 6 semaines</span>') +
      '<section class="carte">' + (total ? '<svg class="courbe" viewBox="0 0 ' + L + ' ' + H + '" role="img" aria-label="Candidatures par semaine : ' + sem.join(', ') + '">' +
        '<polyline class="aire" points="' + points[0][0] + ',' + (H - 30) + ' ' + points.map((p) => p.join(',')).join(' ') + ' ' + points[5][0] + ',' + (H - 30) + '"/>' +
        '<polyline class="ligne-courbe" points="' + points.map((p) => p.join(',')).join(' ') + '"/>' +
        points.map((p, i) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5"/><text x="' + p[0] + '" y="' + (p[1] - 12) + '" text-anchor="middle">' + sem[i] + '</text><text class="sem" x="' + p[0] + '" y="' + (H - 8) + '" text-anchor="middle">' + new Date(depuis.getTime() + i * 7 * 864e5).toLocaleDateString('fr-FR', L < 600 ? { day: '2-digit', month: '2-digit' } : { day: 'numeric', month: 'short' }) + '</text>').join('') + '</svg>' :
        '<p class="doux">Aucune candidature ces 6 dernières semaines.</p>') + '</section>';
  }

  // ---------- Messages de contact ----------
  async function pageContacts() {
    const msgs = await P.bd(sb.from('messages_contact').select('nom, type_contact, telephone, created_at').order('created_at', { ascending: false }).limit(30));
    return P.entete('Messages de contact', '<span class="doux">les ' + msgs.length + ' derniers</span>') +
      (msgs.length ? '<div class="taches">' + msgs.map((m) => {
        const n = numeroWhatsApp(m.telephone);
        return '<div class="tache"><span class="point"></span><span class="t">' + P.esc(m.nom || 'Sans nom') + '<small>' + P.esc([m.type_contact, P.dateHeure(m.created_at)].filter(Boolean).join(' · ')) + '</small></span>' +
          (n ? '<a class="btn petit" href="https://wa.me/' + n + '" target="_blank" rel="noopener">WhatsApp ↗</a>' : '<span class="doux petit-texte">' + P.esc(m.telephone || '') + '</span>') + '</div>';
      }).join('') + '</div>' : '<div class="carte vide">Aucun message pour le moment.</div>');
  }

  Object.assign(P.espaces.site.pages, { 'v2-ensemble': pageEnsemble, 'b1-a-traiter': pageATraiter, 'v2-top3': pageTop, 'b1-repartition': pageRepartition, 'b1-evolution': pageEvolution, 'b2-contacts': pageContacts });
  ['v2-ensemble', 'b1-a-traiter'].forEach((k) => { P.espaces.site.apres[k] = () => P.animerChiffres(document.getElementById('contenu')); });
})();
