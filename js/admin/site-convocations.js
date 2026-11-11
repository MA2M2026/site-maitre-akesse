// Nouvelle Administration — Convocations (bloc 1, étape 2). Même écran et même logique que
// l'ancien tableau de bord, sans recopie : l'écran vient de js/convocations-gabarit.js, la
// logique de js/convocations-page.js (projet, mannequins choisies sur un mur de visages) et de
// js/convocations-admin.js (participants, aperçu, envoi, suivi, réponses, relances, rappels).
// (11/11/2026, maquette validée par la propriétaire : « trop touffu ») ce fichier ajoute le PARCOURS :
// les projets à venir en billets (date, visages, jauge des réponses), puis, pour un projet, deux onglets
// « Convoquer » (4 étapes : Projet, Mannequins, Message, Envoi — une seule à l'écran) et « Réponses ».
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const MOIS_COURTS = ['JANV.', 'FÉVR.', 'MARS', 'AVR.', 'MAI', 'JUIN', 'JUIL.', 'AOÛT', 'SEPT.', 'OCT.', 'NOV.', 'DÉC.'];
  const ecran = async () => '<div class="ecran-partage ecran-convocations" id="ecran-convocations" data-vue="liste" data-etape="1" data-onglet="convoquer">' + window.GABARIT_CONVOCATIONS + '</div>';

  // ---------- les billets des projets à venir ----------
  async function dessinerBillets(racine) {
    const zone = racine.querySelector('#cv-billets'), C = window.ConvocationsPage;
    const auj = P.aujourdhui();
    const projets = (C ? C.projets() : []).filter((p) => !p.annule && (p.date_fin || p.date_debut) >= auj);
    if (!projets.length) { zone.innerHTML = '<p class="cv-vide">Aucun projet à venir. Touchez « ＋ Nouveau projet » pour en créer un.</p>'; return; }
    const ids = projets.map((p) => p.id);
    const parts = await P.essai(P.bd(sb.from('convocation_participants').select('projet_id, model_id, contact_id, parent, reponse').in('projet_id', ids))) || [];
    const visagesIds = [];
    projets.forEach((p) => (p.mannequin_ids || []).slice(0, 4).forEach((id) => visagesIds.push(id)));
    const photos = await P.essai(P.photosCouverture(visagesIds.filter((x, i, l) => l.indexOf(x) === i))) || {};
    zone.innerHTML = projets.map((p) => {
      // une mannequin et son parent : une seule personne (la réponse de l'un vaut pour les deux)
      const siens = {}; parts.filter((x) => x.projet_id === p.id).forEach((x) => { const g = x.model_id || x.contact_id || Math.random(); if (!siens[g] || (!siens[g].reponse && x.reponse)) siens[g] = x; });
      const l = Object.values(siens), conf = l.filter((x) => x.reponse === 'confirme').length, sans = l.filter((x) => !x.reponse).length;
      const j = String(p.date_debut).slice(0, 10).split('-');
      const visages = (p.mannequin_ids || []).filter((id) => photos[id]).slice(0, 4).map((id) => P.visage(photos[id], '')).join('');
      const etat = l.length ? conf + ' confirmée' + (conf > 1 ? 's' : '') + ' sur ' + l.length + (sans ? ' · ' + sans + ' sans réponse' : '')
        : (p.mannequin_ids || []).length ? 'Pas encore convoquées' : 'Aucune mannequin choisie';
      return '<button type="button" class="cv-billet" data-cv-projet="' + P.esc(p.id) + '"><span class="cv-billet-date" aria-hidden="true"><b>' + Number(j[2]) + '</b><small>' + MOIS_COURTS[Number(j[1]) - 1] + '</small></span>' +
        '<span class="cv-billet-t"><small>' + P.esc(libelleTypeAgenda(p.type)) + '</small><b>' + P.esc(p.titre) + '</b>' +
        (visages ? '<span class="cv-billet-vis">' + visages + '</span>' : '') +
        (l.length ? '<span class="cv-jauge"><i style="width:' + Math.round(100 * conf / l.length) + '%"></i></span>' : '') +
        '<span class="cv-billet-etat">' + P.esc(etat) + '</span></span></button>';
    }).join('');
  }

  // ---------- le parcours ----------
  function parcours(racine) {
    const $ = (id) => racine.querySelector('#' + id);
    const C = window.ConvocationsPage;
    const panneauOuvert = () => !$('convoc-panneau').hidden;
    function majEtapes() {
      const e = Number(racine.dataset.etape);
      racine.querySelectorAll('.cv-etapes [data-aller-etape]').forEach((b) => {
        const n = Number(b.dataset.allerEtape);
        b.classList.toggle('fait', n < e); b.classList.toggle('actif', n === e);
        b.disabled = n > 2 && !panneauOuvert();   // Message et Envoi : une fois le projet enregistré
        if (n === e) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      });
      if (e === 4) resume();
    }
    function etape(n) {
      if (n > 2 && !panneauOuvert()) n = 2;
      racine.dataset.etape = String(n); racine.dataset.onglet = 'convoquer';
      racine.querySelectorAll('[data-cv-onglet]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cvOnglet === 'convoquer')));
      majEtapes();
      racine.scrollIntoView({ block: 'start' });
    }
    function onglet(o) {
      racine.dataset.onglet = o;
      racine.querySelectorAll('[data-cv-onglet]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.cvOnglet === o)));
    }
    function vue(v) { racine.dataset.vue = v; if (v === 'liste') dessinerBillets(racine).catch(() => {}); window.scrollTo(0, 0); }
    function titre(p) {
      $('cv-titre-projet').textContent = p ? p.titre : 'Nouveau projet';
      $('cv-onglet-reponses').disabled = !p;
    }
    // un projet ouvert : le formulaire rempli ; déjà enregistré, son panneau d'envoi aussi (Message, Envoi, Réponses)
    function ouvrir(p) {
      titre(p);
      // « Plus de détails » ouvert d'office quand le projet en a déjà
      $('cv-details').open = !!(p && (p.date_fin || p.heure_evenement || p.adresse || (p.deroule || []).length || p.a_prevoir || p.message_modele));
      $('cv-affiche-bloc').open = false;
      vue('parcours');
      if (p) Promise.resolve(window.ouvrirConvocations(p)).then(() => { majEtapes(); }).catch(() => {});
      etape(1);
    }
    // l'affiche jointe : visible dans le titre de la case repliée
    new MutationObserver(() => { $('cv-affiche-titre').textContent = '🖼️ Affiche ou photo (facultatif)' + ($('cv-affiche').querySelector('.ij-choisie') ? ' · jointe ✓' : ''); })
      .observe($('cv-affiche'), { childList: true, subtree: true });
    new MutationObserver(majEtapes).observe($('convoc-panneau'), { attributes: true, attributeFilter: ['hidden'] });
    // le projet enregistré (« Enregistrer · suivant », js/convocations-page.js) ouvre son panneau : on passe au Message
    let enregistre = false;
    $('cv-form').addEventListener('submit', () => { enregistre = true; });
    const ouvrirPanneau = window.ouvrirConvocations;
    window.ouvrirConvocations = async function (p) {
      const r = await ouvrirPanneau.apply(this, arguments);
      if (enregistre && racine.isConnected && racine.dataset.vue === 'parcours') { enregistre = false; titre(p); etape(3); }
      return r;
    };
    // l'onglet « Réponses · 8/12 »
    new MutationObserver(() => { const b = $('convoc-reponses').dataset.bilan; $('cv-onglet-reponses').textContent = 'Réponses' + (b ? ' · ' + b : ''); })
      .observe($('convoc-reponses'), { attributes: true, attributeFilter: ['data-bilan'] });
    // le résumé avant l'envoi
    function resume() {
      const n = $('convoc-participants').querySelectorAll('input[type=checkbox]:checked').length;
      const sorte = $('convoc-sorte').selectedOptions[0] ? $('convoc-sorte').selectedOptions[0].textContent.replace(/\s*\(.*\)$/, '') : '';
      const canaux = [$('convoc-canal-email').checked ? '📧 E-mail ✓' : '', $('convoc-canal-whatsapp').checked ? '💬 WhatsApp ✓' : ''].filter(Boolean).join('   ');
      const quand = $('convoc-quand').selectedOptions[0] ? $('convoc-quand').selectedOptions[0].textContent : '';
      const affiche = !!$('cv-affiche').querySelector('.ij-choisie');
      $('cv-resume-envoi').innerHTML = '<p><b>' + P.esc(sorte) + '</b> à <b>' + P.pluriel(n, 'personne', 'personnes') + '</b></p><p>' + (canaux || 'Aucun moyen d’envoi choisi') + '</p>' +
        '<p>🕒 ' + P.esc(quand) + '</p>' + (affiche ? '<p>🖼️ Avec l’affiche</p>' : '');
    }
    $('convoc-panneau').addEventListener('change', () => { if (racine.dataset.etape === '4') resume(); });
    racine.addEventListener('click', (e) => {
      const b = e.target.closest('[data-aller-etape]');
      if (b) {
        const n = Number(b.dataset.allerEtape);
        if (n === 2 && racine.dataset.etape === '1' && (!$('cv-titre').value.trim() || !$('cv-date').value)) { $('cv-etat').className = 'form-msg err'; $('cv-etat').textContent = 'Indiquez au moins un titre et une date.'; return; }
        etape(n); return;
      }
      const o = e.target.closest('[data-cv-onglet]');
      if (o) { onglet(o.dataset.cvOnglet); return; }
      const billet = e.target.closest('[data-cv-projet]');
      if (billet) { ouvrir(C.choisir(billet.dataset.cvProjet)); return; }
      if (e.target.closest('#cv-nouveau')) { C.choisir(''); ouvrir(null); $('cv-titre').focus(); return; }
      if (e.target.closest('#cv-retour') || e.target.closest('#convoc-fermer')) { vue('liste'); }
    });
    // la rubrique touchée dans le menu alors qu'un projet est ouvert (même adresse : la page ne se redessine pas) : retour aux billets
    const memeRubrique = (e) => {
      if (!racine.isConnected) { document.removeEventListener('click', memeRubrique); return; }
      const a = e.target.closest('a[href^="#/site/"]');
      if (a && a.getAttribute('href') === location.hash && racine.dataset.vue === 'parcours') vue('liste');
    };
    document.addEventListener('click', memeRubrique);
    // projets chargés : les billets ; un projet demandé (Agenda, Places, « Convoquer la sélection ») s'ouvre directement
    C.pret().then(() => {
      const demande = C.choisi();
      if (demande) ouvrir(demande); else vue('liste');
    });
  }

  // « Annoncer la sélection » (23/10/2026, demande de la propriétaire) : sa propre ligne dans le
  // menu ; c'est le même écran, avec le message de sélection déjà choisi.
  // « Rappeler l'information » (23/10/2026, demande de la propriétaire) : sa ligne dans le menu,
  // même écran, avec le rappel (date, heure, lieu) déjà choisi.
  const demarrer = (sorte) => () => {
    const selection = sorte === 'selection';
    window.convocationSorteImposee = sorte;
    const racine = document.getElementById('ecran-convocations');
    if (sorte === 'rappel_avant') {
      racine.querySelector('h2').textContent = '🔔 Rappeler l’information';
      racine.querySelector('h2 + p').textContent = 'Touchez le projet, puis envoyez le rappel quand vous le voulez (par exemple 3 jours avant) : chaque personne déjà prévenue reçoit la date, l’heure de convocation et le lieu. Celles qui n’ont pas encore répondu reçoivent aussi leur lien pour confirmer. Rien à voir avec les relances.';
    }
    if (selection) {
      racine.querySelector('h2').textContent = '🎉 Annoncer la sélection';
      racine.querySelector('h2 + p').textContent = 'Touchez le projet, choisissez les mannequins sélectionnées, puis envoyez : chacune reçoit un message de félicitations avec la date, l’heure, le lieu et son lien « Confirmez votre participation ». La convocation détaillée se fait ensuite dans « Convocations ».';
    }
    window.demarrerConvocationsPanneau();
    window.demarrerConvocationsPage(racine);
    parcours(racine);
  };
  P.espaces.site.pages['b2-selection'] = ecran;
  P.espaces.site.apres['b2-selection'] = demarrer('selection');
  P.espaces.site.pages['b2-convocations'] = ecran;
  P.espaces.site.apres['b2-convocations'] = demarrer(null);
  P.espaces.site.pages['b2-rappel'] = ecran;
  P.espaces.site.apres['b2-rappel'] = demarrer('rappel_avant');
})();
