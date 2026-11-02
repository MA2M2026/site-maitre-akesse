// Agenda MA2M (06/10/2026, Extension 124) : le programme de l'agence montré aux clients.
// Lit agenda_public() (jamais d'heure ni d'adresse : seulement le jour et la ville), puis
// remplit, selon la page :
//  - sur la page Agenda : un calendrier mensuel (#agenda-calendrier) ; un clic sur un jour
//    affiche son programme dans #agenda-avenir ; puis la liste des projets réalisés ;
//  - #agenda-accueil (les 3 prochains projets) sur l'accueil.
// Partagé par les pages françaises et anglaises.
(function () {
  const enAnglais = document.documentElement.lang === 'en';
  // (dessin : js/rendu-agenda.js, partagé avec le serveur ; phase 2, 02/11/2026)
  const R = window.RenduAgenda.creer({ doc: document, en: enAnglais, urlLegere });
  const { T, PAQUET, remplir, calendrier, evenementsDuSite, ajouterJours, dateDe } = R;
  const LANGUE = enAnglais ? 'en-GB' : 'fr-FR';
  // Événements déjà enregistrés sur la page « Événements » : repris dans l'agenda (sans les
  // photos). Les jours consécutifs d'un même événement forment une seule entrée ; un
  // événement déjà saisi dans l'agenda (même titre, mêmes dates) n'est pas doublé.
  // Lecture lancée en même temps que l'agenda (12 derniers mois, comme agenda_public).
  function lireEvenementsDuSite() {
    const depuis = dateDuJour(ajouterJours(new Date(), -365));
    return lireToutesLignes(() => sb.from('evenements').select('id, titre, date_evenement, lieu')
      .gte('date_evenement', depuis).order('date_evenement').order('id'));
  }
  // Calendrier de la page Agenda : un clic sur un jour remplit la liste détaillée.
  function brancherCalendrier(avenirBoite, avenir, passes) {
    const boiteCal = document.getElementById('agenda-calendrier');
    if (!boiteCal) return;
    const titreListe = document.getElementById('agenda-liste-titre');
    const toutVoir = document.getElementById('agenda-tout-voir');
    const tous = passes.slice().reverse().concat(avenir);
    const toutAfficher = () => {
      if (titreListe) titreListe.textContent = T.aVenir;
      remplir(avenirBoite, avenir, T.vide, false, PAQUET);
      if (toutVoir) toutVoir.hidden = true;
    };
    const cal = calendrier(boiteCal, tous, (jour, ceJour) => {
      if (!jour) { toutAfficher(); return; }
      const d = dateDe(jour);
      if (titreListe) titreListe.textContent = T.programmeDu + d.toLocaleDateString(LANGUE, { weekday: 'long', day: 'numeric', month: 'long' });
      remplir(avenirBoite, ceJour, T.rienCeJour, false);
      if (toutVoir) toutVoir.hidden = false;
    });
    if (toutVoir) toutVoir.addEventListener('click', () => { toutAfficher(); cal.effacerChoix(); });
  }

  async function charger() {
    const avenirBoite = document.getElementById('agenda-avenir');
    const passesBoite = document.getElementById('agenda-passes');
    const accueil = document.getElementById('agenda-accueil');
    if (!avenirBoite && !passesBoite && !accueil) return;
    // L'accueil ne demande que les 3 prochains projets (moins de données sur mobile).
    const seulAccueil = !avenirBoite && !passesBoite;
    // page Agenda préparée par le serveur (middleware.js, 01/11/2026) : les deux lectures déjà dans la page
    // (accueil : les 3 prochains projets posés par le serveur avec l'accueil, 100 % dynamique, 01/11/2026)
    const dAccueil = seulAccueil ? donneesServeur('accueil-donnees') : null;
    const d = seulAccueil ? (dAccueil && Array.isArray(dAccueil.agenda) ? { agenda: dAccueil.agenda, evenements: [] } : null) : donneesServeur('agenda-donnees');  // (js/app.js)
    const serveur = d && Array.isArray(d.agenda) && Array.isArray(d.evenements) ? d : null;
    if (!serveur && (typeof sb === 'undefined' || !sb)) return;
    const [{ data, error }, lectureEvenements] = serveur ? [{ data: serveur.agenda, error: null }, { data: serveur.evenements, error: null }] : await Promise.all([
      sb.rpc('agenda_public', seulAccueil ? { seulement_a_venir: true, limite: 3 } : {}),
      seulAccueil ? Promise.resolve(null) : lireEvenementsDuSite().catch(() => null)
    ]);
    // PGRST202 : fonction introuvable, l'agenda n'est pas encore activé (Extension 124) ;
    // la page s'affiche quand même, avec les événements de la page « Événements ».
    if (error) console.warn('Agenda non chargé', error);
    const enPanne = error && error.code !== 'PGRST202';
    let projets = data || [];
    // (page anglaise : textes de l'agence en anglais, js/app.js)
    await versAnglais(projets.concat((lectureEvenements && lectureEvenements.data) || []), ['titre', 'lieu', 'description']);
    if (!seulAccueil) projets = projets.concat(evenementsDuSite(lectureEvenements, projets));
    const { avenir, passes } = separerAgenda(projets);
    remplir(avenirBoite, avenir, enPanne ? T.erreur : T.vide, false, PAQUET);
    brancherCalendrier(avenirBoite, avenir, passes);
    remplir(passesBoite, passes, T.videPasses, false, PAQUET);
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
