// « Sa carte de mannequin » dans l'Administration (15/11/2026, retours de la propriétaire sur sa tablette) : dans la
// fiche de la mannequin de « Mannequins ». COHÉRENCE (demande de la propriétaire) : une seule source, deux questions qu'on
// touche — son parcours à l'arrivée (débutante chez nous / déjà formée ou expérimentée ailleurs) et sa position dans
// la formation (le mois en cours) — et TOUT le reste est calculé par la base et seulement affiché : catégorie,
// « membre depuis » (en remontant ses mois de cours), formation écrite sur la carte, validité. Plus de catégorie ni de
// formation choisies à la main : elles ne peuvent plus se contredire. Le choix en cours est en rouge plein avec ✓.
// Aperçu de SA carte (recto/verso), « Télécharger », « Imprimer (PDF) ».
// Base : carte_mannequin_par_fiche et carte_mannequin_regler (supabase-carte-mannequin.sql) ; dessin et calcul :
// js/carte-mannequin.js (le même que dans son application).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P) return;
  let etat = null, face = 'recto';   // { fiche, agence, carte, programme, profil, photos, apercu }
  const pas = P.pasActivee ? P.pasActivee('carte_mannequin_par_fiche') : () => false;

  const puce = (reglage, valeur, actuel, texte, sous) => {
    const choisi = valeur === actuel;
    return '<button type="button" class="ce-puce' + (choisi ? ' choisi' : '') + '" data-bouton-libre data-action="carte-regler" data-reglage="' + reglage + '" data-valeur="' +
      P.esc(valeur === null ? '' : String(valeur)) + '" aria-pressed="' + choisi + '">' + (choisi ? '<i aria-hidden="true">✓</i>' : '') + '<span>' + P.esc(texte) +
      (sous ? '<small>' + P.esc(sous) + '</small>' : '') + '</span></button>';
  };
  const resume = () => (typeof resumeProgrammeFormation === 'function' ? resumeProgrammeFormation(etat.programme) : null);
  const formationAuto = () => window.CarteMannequin ? window.CarteMannequin.formation(resume(), Object.assign({}, etat.carte, { formation: null }), true, 'selon son programme') : '';

  // Programme de formation (14/11/2026 ; rangé dans « Mannequins » le 15/11/2026, demande de la propriétaire) : le mois
  // en cours, les mois faits, et les mois en colonnes (un niveau par colonne)
  function blocProgramme(programme) {
    const r = typeof resumeProgrammeFormation === 'function' ? resumeProgrammeFormation(programme) : null;
    if (!r) return '';
    const x = r.enCours || r.prochain;
    const nomMois = (iso) => P.esc(P.libelleMois(iso));
    // (14/11/2026) formation finie : la Révision (thème du mois de mars à novembre)
    const y = r.termine ? r.revProchain : null;
    return '<div class="carte pf-programme"><h2>Programme de formation</h2>' +
      (r.termine ? '<p><b>Formation terminée ✓</b>' + (y ? ' <span class="doux">· Révision, ' + (r.revEnCours ? 'ce mois-ci' : 'prochain thème (' + nomMois(y.date) + ')') + ' : ' + P.esc(y.theme) + ' (mois ' + y.mois_niveau + ' sur 9)</span>' : '') + '</p>' :
      !x ? '' : '<p><b>' + (r.enCours ? 'Ce mois-ci' : 'Prochain thème (' + nomMois(x.date) + ')') + ' : ' + P.esc(x.theme) + '</b>' +
      (x ? ' <span class="doux">· niveau ' + x.niveau + ' (' + P.esc(MA2M_NIVEAUX_FORMATION[x.niveau]) + '), mois ' + x.mois_niveau + ' sur 9</span>' : '') + '</p>') +
      '<p class="doux petit-texte">' + r.faits + ' mois faits sur ' + r.total + '.</p>' +
      // (15/11/2026, demande de la propriétaire) les mois en colonnes : un niveau par colonne, plus court à lire
      '<details><summary>Voir les ' + r.total + ' mois</summary><div class="pf-colonnes">' + [...new Set(r.mois.map((m) => m.niveau))].map((n) =>
        '<div><h3>Niveau ' + n + ' · ' + P.esc(MA2M_NIVEAUX_FORMATION[n] || '') + '</h3><ol class="pf-mois">' + r.mois.filter((m) => m.niveau === n).map((m) => '<li class="' + P.esc(m.etat) + '"><b>' + m.mois_niveau + '</b><span>' + P.esc(m.theme) +
          '<small>' + (m.etat === 'en_cours' ? 'ce mois-ci' : m.date ? nomMois(m.date) : 'fait avant la reprise') + (m.etat === 'fait' ? ' ✓' : '') + '</small></span></li>').join('') + '</ol></div>').join('') + '</div></details></div>';
  }
  // ---- l'encart (HTML) ; null : rien à montrer (pas de compte au registre, fichier SQL pas collé)
  async function html(fiche) {
    etat = null;
    let r;
    try { r = await P.rpc('carte_mannequin_par_fiche', { p_fiche: fiche }); } catch (e) { if (pas(e)) return ''; throw e; }
    if (!r || !r.carte) return '<section class="carte ce-carte"><h2>Sa carte de mannequin</h2><p class="doux">Elle n’est pas encore au registre de l’agence : sa carte sera possible dès qu’elle y sera.</p></section>';
    etat = { fiche, agence: r.agence_id, carte: r.carte, programme: r.programme };
    return blocProgramme(r.programme) + dessiner();
  }
  function dessiner() {
    const c = etat.carte, r = resume(), formee = c.parcours === 'formee';
    const peutFormation = !!(P.moi && P.moi.espaces && P.moi.espaces.paiements);   // (parcours et position : équipe des paiements ou principal)
    const mois = (iso) => P.libelleMois(iso, '—');
    const aujourdhui = new Date().toISOString().slice(0, 10), expiree = c.valable && c.valable < aujourdhui;
    // position actuelle : le rang du mois en cours (ou du prochain) ; formation finie : niveaux × 9 + 1
    const x = r && (r.enCours || r.prochain), total = r ? r.total : (formee ? 9 : 18);
    const rang = r && r.termine ? total + 1 : x ? x.rang : null;
    const p = (reglage, valeur, actuel, texte, sous) => peutFormation ? puce(reglage, valeur, actuel, texte, sous)
      : '<span class="ce-puce' + (valeur === actuel ? ' choisi' : '') + ' ce-fige">' + (valeur === actuel ? '<i aria-hidden="true">✓</i>' : '') + '<span>' + P.esc(texte) + '</span></span>';
    const grilles = [];
    for (let n = 1; n <= total / 9; n++) {
      grilles.push('<div class="ce-col"><b>' + (formee ? 'Recyclage' : 'Niveau ' + n) + ' · mois</b>' +
        Array.from({ length: 9 }, (_, k) => p('position', String((n - 1) * 9 + k + 1), rang === null ? null : String(rang), String(k + 1))).join('') + '</div>');
    }
    const categorie = window.CarteMannequin ? window.CarteMannequin.categorieCarte(c.categorie) : c.categorie;
    const pourquoi = formee ? 'déjà formée ou expérimentée à son arrivée' : c.categorie === 'Professionnel' ? '2 ans de formation ou d’expérience' : 'moins de 2 ans de formation, sans expérience avant';
    return '<section class="carte ce-carte" id="ce-carte"><div class="ce-tete"><h2>Sa carte de mannequin</h2>' +
        P.pastille(c.active ? 'Activée ✓' : 'Pas encore activée', c.active ? 'ok' : 'alerte') + '</div>' +
      '<div class="ce-apercu"><img class="ca-carte-img" alt="Sa carte de mannequin (' + face + ')" width="1012" height="638">' +
        '<div class="ce-apercu-btns"><button type="button" class="btn petit" data-action="carte-face">↻ ' + (face === 'recto' ? 'Verso' : 'Recto') + '</button>' +
        '<button type="button" class="btn petit" data-action="carte-fichier" data-valeur="image">⬇️ Télécharger</button>' +
        '<button type="button" class="btn petit" data-action="carte-fichier" data-valeur="pdf">🖨️ Imprimer</button></div></div>' +
      // ce que la carte dit, calculé (rien à choisir ici)
      '<dl class="ce-resume"><div><dt>Catégorie</dt><dd>' + P.esc(categorie) + '<small>' + P.esc(pourquoi) + '</small></dd></div>' +
        '<div><dt>Formation</dt><dd>' + P.esc(formationAuto() || '—') + '</dd></div>' +
        '<div><dt>Membre depuis</dt><dd>' + P.esc(mois(c.depuis)) + '<small>le début de sa formation chez nous</small></dd></div>' +
        '<div><dt>Valable jusqu’en</dt><dd' + (expiree ? ' class="ce-expiree"' : '') + '>' + P.esc(mois(c.valable)) + (expiree ? '<small>expirée : renouvelez-la</small>' : '') + '</dd></div></dl>' +
      '<div class="ce-reglage"><h3><em>1</em>Carte</h3><p class="doux">Activée : elle la voit et la télécharge dans son application.</p><div class="ce-puces">' +
        puce('active', 'false', String(!!c.active), 'Pas activée') + puce('active', 'true', String(!!c.active), 'Activée') + '</div></div>' +
      '<div class="ce-reglage"><h3><em>2</em>Son parcours à son arrivée</h3><p class="doux">Déjà formée ou expérimentée ailleurs : elle est Professionnelle tout de suite et fait le recyclage de 9 mois.</p><div class="ce-puces">' +
        p('parcours', 'debutante', formee ? 'formee' : 'debutante', 'Débutante chez nous', '2 niveaux · 18 mois') + p('parcours', 'formee', formee ? 'formee' : 'debutante', 'Déjà formée ou expérimentée', 'recyclage · 9 mois') + '</div></div>' +
      '<div class="ce-reglage"><h3><em>3</em>Où en est-elle ?</h3><p class="doux">Touchez le mois de formation qu’elle suit en ce moment : la date « membre depuis » et sa catégorie se recalculent.</p>' +
        '<div class="ce-cols">' + grilles.join('') + '</div><div class="ce-puces ce-fin">' + p('position', String(total + 1), rang === null ? null : String(rang), 'Formation terminée') + '</div>' +
        (peutFormation ? '' : '<p class="doux petit-texte">Seule l’équipe des paiements (ou l’administrateur principal) change le parcours et la position : ils comptent aussi pour ses mensualités.</p>') + '</div>' +
      '<div class="ce-reglage"><h3><em>4</em>Validité</h3><p class="doux">Durée du contrat, à partir du début de sa formation, renouvelable.</p><div class="ce-puces">' +
        [3, 4, 5].map((n) => puce('validite_ans', String(n), String(c.validite_ans), n + ' ans')).join('') +
        '<button type="button" class="ce-puce ce-renouveler" data-bouton-libre data-action="carte-regler" data-reglage="renouveler" data-valeur="1"><span>↻ Renouveler<small>à partir d’aujourd’hui</small></span></button></div></div>' +
      '<div class="ce-reglage ce-numero"><h3>N° de mannequin</h3><b>' + P.esc(c.matricule || 'Donné à l’activation') + '</b></div></section>';
  }
  // ---- après l'affichage : l'aperçu (profil et photos lus une fois)
  async function apres() {
    const img = document.querySelector('#ce-carte .ca-carte-img');
    if (!img || !etat || !window.CarteMannequin) return;
    try {
      if (!etat.apercu) {
        const [p, ph] = await Promise.all([P.bd(sb.from('model_profiles').select('full_name, height_cm, chest_cm, waist_cm, hips_cm').eq('id', etat.fiche).maybeSingle()).catch(() => null),
          P.bd(sb.from('model_photos').select('url, url_miniature, url_petite, principale, photo_couverture, tri_statut').eq('model_id', etat.fiche)).catch(() => [])]);
        etat.profil = p || {}; etat.photos = (ph || []).filter((x) => x.tri_statut !== 'ecartee');
      }
      etat.apercu = window.CarteMannequin.donnees({ carte: etat.carte, profil: etat.profil, photos: etat.photos, programme: etat.programme });
      img.src = (await window.CarteMannequin.dessiner(face, etat.apercu)).toDataURL('image/png');
    } catch (e) { console.warn(e); P.message('L’aperçu de la carte n’a pas pu être dessiné : rechargez la page.'); }
  }
  // l'encart redessiné sur place (sans recharger toute la fiche)
  function rafraichir() {
    const ancien = document.getElementById('ce-carte');
    if (!ancien || !etat) return;
    const t = document.createElement('div'); t.innerHTML = dessiner();
    ancien.replaceWith(t.firstElementChild);
    void apres();
  }
  P.actions['carte-regler'] = async (el) => {
    if (!etat) return;
    const reglage = el.getAttribute('data-reglage'), v = el.getAttribute('data-valeur');
    if (reglage === 'renouveler' && !confirm('Renouveler sa carte : le contrat repart d’aujourd’hui pour la durée choisie ?')) return;
    if (reglage === 'parcours' && !confirm('Changer son parcours ? Sa formation repart du bon nombre de mois (18 ou 9) : vérifiez ensuite « Où en est-elle ? ».')) return;
    const valeur = reglage === 'active' ? v === 'true' : reglage === 'validite_ans' || reglage === 'position' ? Number(v) : v === '' ? null : v;
    el.disabled = true;
    try {
      etat.carte = await P.sensible(() => P.rpc('carte_mannequin_regler', { p_agence: etat.agence, p_reglages: { [reglage]: valeur } }));
      // parcours et position : son programme, « membre depuis » et sa catégorie changent → relus
      if (reglage === 'parcours' || reglage === 'position') { const r = await P.rpc('carte_mannequin_par_fiche', { p_fiche: etat.fiche }); if (r && r.carte) { etat.carte = r.carte; etat.programme = r.programme; } }
      P.message(reglage === 'active' ? (valeur ? 'Carte activée : elle la voit dans son application ✓' : 'Carte désactivée ✓') : reglage === 'renouveler' ? 'Carte renouvelée à partir d’aujourd’hui ✓' : 'C’est noté ✓');
      rafraichir();
    } finally { el.disabled = false; }
  };
  P.actions['carte-face'] = () => { face = face === 'recto' ? 'verso' : 'recto'; rafraichir(); };
  P.actions['carte-fichier'] = async (el) => {
    if (!etat || !etat.apercu) { P.message('L’aperçu de la carte n’est pas encore prêt : patientez un instant.'); return; }
    el.disabled = true;
    try { if (el.getAttribute('data-valeur') === 'pdf') await window.CarteMannequin.telechargerPdf(etat.apercu); else await window.CarteMannequin.telechargerImage(etat.apercu); }
    catch (e) { P.message('La carte n’a pas pu être préparée : réessayez.'); }
    finally { el.disabled = false; }
  };
  P.carteEncart = { html, apres };
})();
