// Agenda MA2M (06/10/2026, Extension 124) : le programme de l'agence montré aux clients.
// Lit agenda_public() (jamais d'heure ni d'adresse : seulement le jour et la ville), puis
// remplit, selon la page :
//  - #agenda-avenir et #agenda-passes sur la page Agenda ;
//  - #agenda-accueil (les 3 prochains projets) sur l'accueil.
// Partagé par les pages françaises et anglaises.
(function () {
  const enAnglais = document.documentElement.lang === 'en';
  const T = enAnglais ? {
    photographe: 'Photographer', partenaires: 'Partners', mannequins: 'Models',
    vide: 'Our upcoming projects will appear here very soon.',
    videPasses: 'Our completed projects will appear here.',
    erreur: 'The agenda could not be loaded. Please try again later.'
  } : {
    photographe: 'Photographe', partenaires: 'Partenaires', mannequins: 'Mannequins',
    vide: 'Nos prochains projets seront affichés ici très bientôt.',
    videPasses: 'Nos projets réalisés seront affichés ici.',
    erreur: 'L’agenda n’a pas pu être chargé. Réessayez dans un instant.'
  };

  function aujourdhui() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

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

  async function charger() {
    const avenirBoite = document.getElementById('agenda-avenir');
    const passesBoite = document.getElementById('agenda-passes');
    const accueil = document.getElementById('agenda-accueil');
    if (!avenirBoite && !passesBoite && !accueil) return;
    if (typeof sb === 'undefined' || !sb) return;
    const { data, error } = await sb.rpc('agenda_public');
    if (error) {
      // Agenda pas encore activé (Extension 124) ou souci réseau : message neutre pour le client.
      console.warn('Agenda non chargé', error);
      remplir(avenirBoite, [], /PGRST202|agenda_public/.test(error.code + ' ' + error.message) ? T.vide : T.erreur, false);
      return;
    }
    const jour = aujourdhui();
    const projets = data || [];
    const avenir = projets.filter(p => (p.date_fin || p.date_debut) >= jour);
    const passes = projets.filter(p => (p.date_fin || p.date_debut) < jour).reverse();
    remplir(avenirBoite, avenir, T.vide, false);
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
