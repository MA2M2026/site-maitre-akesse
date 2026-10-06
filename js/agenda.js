// Agenda MA2M (06/10/2026, Extension 124) : le programme de l'agence montré aux clients.
// Lit agenda_public() (jamais d'heure ni d'adresse : seulement le jour et la ville), puis
// remplit, selon la page :
//  - sur la page Agenda : un calendrier mensuel (#agenda-calendrier) ; un clic sur un jour
//    affiche son programme dans #agenda-avenir ; puis la liste des projets réalisés ;
//  - #agenda-accueil (les 3 prochains projets) sur l'accueil.
// Partagé par les pages françaises et anglaises.
(function () {
  const enAnglais = document.documentElement.lang === 'en';
  const T = enAnglais ? {
    photographe: 'Photographer', partenaires: 'Partners', mannequins: 'Models',
    vide: 'Our upcoming projects will appear here very soon.',
    videPasses: 'Our completed projects will appear here.',
    erreur: 'The agenda could not be loaded. Please try again later.',
    precedent: 'Previous month', suivant: 'Next month', aujourdhui: 'Today',
    aVenir: 'Upcoming', programmeDu: 'Schedule for ', rienCeJour: 'No project on this day.', jour: 'day', jours: 'days'
  } : {
    photographe: 'Photographe', partenaires: 'Partenaires', mannequins: 'Mannequins',
    vide: 'Nos prochains projets seront affichés ici très bientôt.',
    videPasses: 'Nos projets réalisés seront affichés ici.',
    erreur: 'L’agenda n’a pas pu être chargé. Réessayez dans un instant.',
    precedent: 'Mois précédent', suivant: 'Mois suivant', aujourdhui: 'Aujourd’hui',
    aVenir: 'À venir', programmeDu: 'Programme du ', rienCeJour: 'Aucun projet ce jour-là.', jour: 'jour', jours: 'jours'
  };
  const LANGUE = enAnglais ? 'en-GB' : 'fr-FR';

  function el(tag, cls, txt) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  // Grand bloc de date : jour en chiffres, mois abrégé.
  function blocDate(p) {
    const d = new Date(p.date_debut + 'T12:00:00');
    const bloc = el('div', 'agenda-jour');
    bloc.appendChild(el('span', 'agenda-jour-num', String(d.getDate())));
    bloc.appendChild(el('span', 'agenda-jour-mois', d.toLocaleDateString(enAnglais ? 'en-GB' : 'fr-FR', { month: 'short' }).replace('.', '')));
    return bloc;
  }

  function lienMannequin(m) {
    const a = el('a', 'agenda-puce', m.nom);
    a.href = m.slug ? 'book/' + encodeURIComponent(m.slug) : 'mannequin.html?id=' + encodeURIComponent(m.id);
    return a;
  }

  function lienPartenaire(pa) {
    const a = el('a', 'agenda-puce agenda-puce-partenaire');
    a.href = 'partenaires.html';
    if (pa.logo_url) {
      const img = document.createElement('img');
      img.src = pa.logo_url; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      img.addEventListener('error', () => img.remove());
      a.appendChild(img);
    }
    a.appendChild(document.createTextNode(pa.nom));
    return a;
  }

  function groupe(titre, elements) {
    const g = el('div', 'agenda-groupe');
    g.appendChild(el('span', 'agenda-groupe-titre', titre));
    const liste = el('div', 'agenda-puces');
    elements.forEach(e => liste.appendChild(e));
    g.appendChild(liste);
    return g;
  }

  function carte(p, compacte) {
    const art = el('article', 'agenda-carte reveal');
    art.appendChild(blocDate(p));
    const corps = el('div', 'agenda-corps');
    const meta = el('p', 'agenda-meta');
    meta.appendChild(el('span', 'agenda-type-public', libelleTypeAgenda(p.type, enAnglais)));
    meta.appendChild(document.createTextNode(' · ' + dateAgenda(p.date_debut, p.date_fin, enAnglais) + (p.ville ? ' · ' + p.ville : '')));
    corps.appendChild(meta);
    corps.appendChild(el('h3', 'agenda-titre', p.titre));
    if (!compacte) {
      if (p.description) corps.appendChild(el('p', 'agenda-description', p.description));
      if (p.photographe) corps.appendChild(groupe(T.photographe, [el('span', 'agenda-puce agenda-puce-simple', p.photographe)]));
      const partenaires = Array.isArray(p.partenaires) ? p.partenaires : [];
      if (partenaires.length) corps.appendChild(groupe(T.partenaires, partenaires.map(lienPartenaire)));
    }
    const mannequins = Array.isArray(p.mannequins) ? p.mannequins : [];
    if (mannequins.length) corps.appendChild(groupe(T.mannequins, mannequins.map(lienMannequin)));
    art.appendChild(corps);
    return art;
  }

  function remplir(boite, projets, vide, compacte) {
    if (!boite) return;
    boite.textContent = '';
    if (!projets.length) { boite.appendChild(el('p', 'agenda-vide', vide)); return; }
    projets.forEach(p => boite.appendChild(carte(p, compacte)));
  }


  // ---------- Agenda en ligne (modèle fourni par la propriétaire, 06/10/2026) ----------
  // Vues Année / Mois / Semaine / Jour, numéros de semaine, projets écrits dans les cases,
  // et un panneau avec le jour choisi en grand et les prochains projets (« dans 2 jours »).
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const majuscule = t => t.charAt(0).toUpperCase() + t.slice(1);
  const dateDe = t => new Date(t + 'T12:00:00');
  const ajouterJours = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
  const debutSemaine = d => ajouterJours(d, -d.getDay()); // la semaine commence le dimanche, comme le modèle
  const VUES = enAnglais ? [['annee', 'Year'], ['mois', 'Month'], ['semaine', 'Week'], ['jour', 'Day']]
    : [['annee', 'Année'], ['mois', 'Mois'], ['semaine', 'Semaine'], ['jour', 'Jour']];

  // Numéro de semaine ISO (celui des agendas européens).
  function numeroSemaine(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const j = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - j);
    const debutAnnee = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - debutAnnee) / 86400000 + 1) / 7);
  }

  // Projets du jour donné (un projet sur plusieurs jours apparaît chaque jour).
  function projetsDuJour(projets, jour) {
    return projets.filter(p => p.date_debut <= jour && (p.date_fin || p.date_debut) >= jour);
  }

  function pastille(p, complete) {
    const e = el('span', 'cal-evt cal-evt-' + (p.type || 'autre'), p.titre);
    if (complete && p.ville) e.appendChild(el('small', null, p.ville));
    return e;
  }

  function calendrier(boite, projets, montrerJour) {
    const aujIso = iso(new Date());
    let vue = 'mois';
    let choisi = aujIso;
    // Sans projet ce mois-ci, on ouvre sur le mois du prochain projet.
    const prochain = projets.find(p => (p.date_fin || p.date_debut) >= aujIso);
    let repere = dateDe(aujIso);
    if (prochain && !projets.some(p => p.date_debut.slice(0, 7) === aujIso.slice(0, 7))) repere = dateDe(prochain.date_debut);

    function choisir(jour) {
      choisi = jour;
      repere = dateDe(jour);
      dessiner();
      montrerJour(jour, projetsDuJour(projets, jour));
      // Sur téléphone, le panneau est sous le calendrier : on l'amène à l'écran.
      if (window.matchMedia('(max-width: 900px)').matches) {
        const cote = boite.querySelector('.cal-panneau');
        if (cote) cote.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function cellule(d, classeMois) {
      const jour = iso(d);
      const ceJour = projetsDuJour(projets, jour);
      const c = el('button', 'cal-jour');
      c.type = 'button';
      if (classeMois && d.getMonth() !== repere.getMonth()) c.classList.add('hors-mois');
      if (jour === aujIso) c.classList.add('aujourdhui');
      if (jour === choisi) c.classList.add('choisi');
      if (jour < aujIso) c.classList.add('passe');
      if (d.getDay() === 0 || d.getDay() === 6) c.classList.add('week-end');
      if (ceJour.length) c.classList.add('occupe');
      c.setAttribute('aria-label', d.toLocaleDateString(LANGUE, { weekday: 'long', day: 'numeric', month: 'long' })
        + (ceJour.length ? ' : ' + ceJour.map(p => p.titre).join(', ') : ''));
      c.appendChild(el('span', 'cal-num', String(d.getDate())));
      c.addEventListener('click', () => choisir(jour));
      return { c, ceJour };
    }

    function vueMois(zone) {
      const grille = el('div', 'cal-grille cal-grille-mois');
      grille.appendChild(el('div', 'cal-entete cal-num-semaine'));
      for (let i = 0; i < 7; i++) grille.appendChild(el('div', 'cal-entete', ajouterJours(new Date(2024, 0, 7), i).toLocaleDateString(LANGUE, { weekday: 'short' }).replace('.', '')));
      const premier = new Date(repere.getFullYear(), repere.getMonth(), 1, 12);
      let d = debutSemaine(premier);
      while (d.getMonth() === premier.getMonth() || d < premier) {
        grille.appendChild(el('div', 'cal-num-semaine', String(numeroSemaine(ajouterJours(d, 1)))));
        for (let i = 0; i < 7; i++) {
          const { c, ceJour } = cellule(ajouterJours(d, i), true);
          ceJour.slice(0, 3).forEach(p => c.appendChild(pastille(p)));
          if (ceJour.length > 3) c.appendChild(el('span', 'cal-plus', '+' + (ceJour.length - 3)));
          if (ceJour.length) {
            const points = el('span', 'cal-points');
            ceJour.slice(0, 3).forEach(p => points.appendChild(el('i', 'cal-evt-' + (p.type || 'autre'))));
            c.appendChild(points);
          }
          grille.appendChild(c);
        }
        d = ajouterJours(d, 7);
      }
      zone.appendChild(grille);
    }

    function vueSemaine(zone) {
      const grille = el('div', 'cal-grille cal-grille-semaine');
      const d0 = debutSemaine(repere);
      for (let i = 0; i < 7; i++) {
        const d = ajouterJours(d0, i);
        const { c, ceJour } = cellule(d, false);
        c.insertBefore(el('span', 'cal-jour-nom', d.toLocaleDateString(LANGUE, { weekday: 'short' }).replace('.', '')), c.firstChild);
        ceJour.forEach(p => c.appendChild(pastille(p, true)));
        grille.appendChild(c);
      }
      zone.appendChild(grille);
    }

    function vueJour(zone) {
      const ceJour = projetsDuJour(projets, iso(repere));
      const liste = el('div', 'cal-vue-jour');
      if (!ceJour.length) liste.appendChild(el('p', 'agenda-vide', T.rienCeJour));
      ceJour.forEach(p => liste.appendChild(carte(p, false)));
      zone.appendChild(liste);
    }

    function vueAnnee(zone) {
      const grille = el('div', 'cal-annee');
      for (let m = 0; m < 12; m++) {
        const premier = new Date(repere.getFullYear(), m, 1, 12);
        const bloc = el('button', 'cal-mini');
        bloc.type = 'button';
        bloc.appendChild(el('span', 'cal-mini-titre', majuscule(premier.toLocaleDateString(LANGUE, { month: 'long' }))));
        const mini = el('span', 'cal-mini-grille');
        for (let i = 0; i < premier.getDay(); i++) mini.appendChild(el('i'));
        for (let j = 1; j <= new Date(repere.getFullYear(), m + 1, 0).getDate(); j++) {
          const jour = iso(new Date(repere.getFullYear(), m, j, 12));
          const n = projetsDuJour(projets, jour);
          const e = el('i', (n.length ? 'occupe cal-evt-' + (n[0].type || 'autre') : '') + (jour === aujIso ? ' aujourdhui' : ''), String(j));
          mini.appendChild(e);
        }
        bloc.appendChild(mini);
        bloc.addEventListener('click', () => { repere = premier; vue = 'mois'; dessiner(); });
        grille.appendChild(bloc);
      }
      zone.appendChild(grille);
    }

    function panneau(zone) {
      const d = dateDe(choisi);
      const tete = el('div', 'cal-panneau-tete');
      tete.appendChild(el('span', 'cal-panneau-num', String(d.getDate())));
      tete.appendChild(el('span', 'cal-panneau-jour', d.toLocaleDateString(LANGUE, { weekday: 'long' }) + ' · ' + d.toLocaleDateString(LANGUE, { month: 'long', year: 'numeric' })));
      zone.appendChild(tete);
      const ceJour = projetsDuJour(projets, choisi);
      const liste = el('div', 'cal-panneau-liste');
      if (!ceJour.length) liste.appendChild(el('p', 'cal-panneau-rien', T.rienCeJour));
      ceJour.forEach(p => liste.appendChild(lignePanneau(p, null)));
      zone.appendChild(liste);
      const suivants = projets.filter(p => p.date_debut > aujIso && !ceJour.includes(p)).slice(0, 4);
      if (suivants.length) {
        zone.appendChild(el('h3', 'cal-panneau-sous-titre', T.aVenir));
        const l2 = el('div', 'cal-panneau-liste');
        suivants.forEach(p => l2.appendChild(lignePanneau(p, Math.round((dateDe(p.date_debut) - dateDe(aujIso)) / 86400000))));
        zone.appendChild(l2);
      }
    }

    function lignePanneau(p, dans) {
      const b = el('button', 'cal-panneau-ligne');
      b.type = 'button';
      const txt = el('span', 'cal-panneau-texte');
      txt.appendChild(el('strong', 'cal-panneau-titre', p.titre));
      txt.appendChild(el('span', 'cal-panneau-meta', libelleTypeAgenda(p.type, enAnglais) + ' | ' + dateAgenda(p.date_debut, p.date_fin, enAnglais) + (p.ville ? ' | ' + p.ville : '')));
      b.appendChild(el('i', 'cal-panneau-couleur cal-evt-' + (p.type || 'autre')));
      b.appendChild(txt);
      if (dans != null) {
        const c = el('span', 'cal-compte');
        if (dans <= 0) c.appendChild(el('span', 'cal-compte-mot', T.aujourdhui));
        else {
          c.appendChild(el('span', 'cal-compte-num', String(dans)));
          c.appendChild(el('span', 'cal-compte-mot', dans > 1 ? T.jours : T.jour));
        }
        b.appendChild(c);
      }
      b.addEventListener('click', () => choisir(p.date_debut));
      return b;
    }

    function titre() {
      if (vue === 'annee') return String(repere.getFullYear());
      if (vue === 'jour') return majuscule(repere.toLocaleDateString(LANGUE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
      if (vue === 'semaine') {
        const d0 = debutSemaine(repere), d6 = ajouterJours(d0, 6);
        return (enAnglais ? 'Week ' : 'Semaine ') + numeroSemaine(ajouterJours(d0, 1)) + ' · ' + d0.getDate() + ' – ' + d6.toLocaleDateString(LANGUE, { day: 'numeric', month: 'short' });
      }
      return (repere.getMonth() + 1) + ' / ' + repere.getFullYear();
    }

    function deplacer(sens) {
      if (vue === 'annee') repere = new Date(repere.getFullYear() + sens, repere.getMonth(), 1, 12);
      else if (vue === 'mois') repere = new Date(repere.getFullYear(), repere.getMonth() + sens, 1, 12);
      else if (vue === 'semaine') repere = ajouterJours(repere, 7 * sens);
      else { repere = ajouterJours(repere, sens); choisi = iso(repere); }
      dessiner();
    }

    function dessiner() {
      boite.textContent = '';
      const tete = el('div', 'cal-tete');
      const t = el('h2', 'cal-titre', titre());
      t.setAttribute('aria-live', 'polite');
      const vues = el('div', 'cal-vues');
      vues.setAttribute('role', 'tablist');
      VUES.forEach(([cle, nom]) => {
        const b = el('button', 'cal-vue' + (vue === cle ? ' actif' : ''), nom);
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', vue === cle ? 'true' : 'false');
        b.addEventListener('click', () => { vue = cle; if (cle === 'jour' || cle === 'semaine') repere = dateDe(choisi); dessiner(); });
        vues.appendChild(b);
      });
      const nav = el('div', 'cal-actions');
      const prec = el('button', 'cal-nav', '‹'); prec.type = 'button'; prec.setAttribute('aria-label', T.precedent);
      const ajd = el('button', 'cal-aujourdhui', T.aujourdhui); ajd.type = 'button';
      const suiv = el('button', 'cal-nav', '›'); suiv.type = 'button'; suiv.setAttribute('aria-label', T.suivant);
      prec.addEventListener('click', () => deplacer(-1));
      suiv.addEventListener('click', () => deplacer(1));
      ajd.addEventListener('click', () => choisir(aujIso));
      nav.appendChild(prec); nav.appendChild(ajd); nav.appendChild(suiv);
      tete.appendChild(t); tete.appendChild(vues); tete.appendChild(nav);
      boite.appendChild(tete);

      const corps = el('div', 'cal-corps');
      const principal = el('div', 'cal-principal');
      ({ annee: vueAnnee, mois: vueMois, semaine: vueSemaine, jour: vueJour })[vue](principal);
      const cote = el('aside', 'cal-panneau');
      panneau(cote);
      corps.appendChild(principal);
      corps.appendChild(cote);
      boite.appendChild(corps);

      const types = [...new Set(projets.map(p => p.type || 'autre'))];
      if (types.length) {
        const legende = el('div', 'cal-legende');
        types.forEach(ty => {
          const l = el('span', 'cal-legende-item');
          l.appendChild(el('i', 'cal-evt-' + ty));
          l.appendChild(document.createTextNode(libelleTypeAgenda(ty, enAnglais)));
          legende.appendChild(l);
        });
        boite.appendChild(legende);
      }
    }
    dessiner();
    return { effacerChoix: () => { choisi = aujIso; dessiner(); } };
  }

  async function charger() {
    const avenirBoite = document.getElementById('agenda-avenir');
    const passesBoite = document.getElementById('agenda-passes');
    const accueil = document.getElementById('agenda-accueil');
    if (!avenirBoite && !passesBoite && !accueil) return;
    if (typeof sb === 'undefined' || !sb) return;
    // L'accueil ne demande que les 3 prochains projets (moins de données sur mobile).
    const seulAccueil = !avenirBoite && !passesBoite;
    const { data, error } = await sb.rpc('agenda_public', seulAccueil ? { seulement_a_venir: true, limite: 3 } : {});
    if (error) {
      // PGRST202 : fonction introuvable, l'agenda n'est pas encore activé (Extension 124).
      console.warn('Agenda non chargé', error);
      remplir(avenirBoite, [], error.code === 'PGRST202' ? T.vide : T.erreur, false);
      remplir(passesBoite, [], error.code === 'PGRST202' ? T.videPasses : '', false);
      // Le calendrier reste affiché (vide) pour que la page garde son aspect d'agenda.
      const boiteVide = document.getElementById('agenda-calendrier');
      if (boiteVide) calendrier(boiteVide, [], () => {});
      return;
    }
    const { avenir, passes } = separerAgenda(data);
    remplir(avenirBoite, avenir, T.vide, false);
    const boiteCal = document.getElementById('agenda-calendrier');
    if (boiteCal) {
      const titreListe = document.getElementById('agenda-liste-titre');
      const toutVoir = document.getElementById('agenda-tout-voir');
      const tous = (data || []).slice().sort((x, y) => (x.date_debut < y.date_debut ? -1 : x.date_debut > y.date_debut ? 1 : 0));
      const cal = calendrier(boiteCal, tous, (jour, ceJour) => {
        const d = new Date(jour + 'T12:00:00');
        if (titreListe) titreListe.textContent = T.programmeDu + d.toLocaleDateString(LANGUE, { weekday: 'long', day: 'numeric', month: 'long' });
        remplir(avenirBoite, ceJour, T.rienCeJour, false);
        if (toutVoir) toutVoir.hidden = false;
      });
      if (toutVoir) toutVoir.addEventListener('click', () => {
        if (titreListe) titreListe.textContent = T.aVenir;
        remplir(avenirBoite, avenir, T.vide, false);
        toutVoir.hidden = true;
        cal.effacerChoix();
      });
    }
    remplir(passesBoite, passes, T.videPasses, false);
    if (accueil) {
      // Sur l'accueil, l'encart n'apparaît que s'il y a des projets à venir.
      const bloc = accueil.closest('[data-agenda-accueil]');
      if (!avenir.length) return;
      remplir(accueil, avenir.slice(0, 3), '', true);
      if (bloc) bloc.hidden = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    charger().catch(e => console.warn('Agenda non chargé', e));
  });
})();
