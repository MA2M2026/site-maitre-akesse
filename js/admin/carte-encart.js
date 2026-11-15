// « Sa carte de mannequin » dans l'Administration (15/11/2026, retours de la propriétaire sur sa tablette) : rangée
// dans la fiche de la mannequin de « Mannequins » (Administration du site), plus dans les Paiements. Une seule carte
// claire, en 4 réglages qu'on TOUCHE (rien à écrire) : 1. carte activée, 2. catégorie (Automatique = la règle des
// 2 ans), 3. validité, 4. formation écrite sur la carte (Automatique, Recyclage, Révision, Formation terminée, ou un
// niveau et un mois, rangés en colonnes). Le choix en cours est en rouge plein avec ✓ ; chaque toucher est enregistré
// tout de suite et l'encart se redessine. Aperçu de SA carte (recto/verso), « Télécharger », « Imprimer (PDF) ».
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

  // ---- l'encart (HTML) ; null : rien à montrer (pas de compte au registre, fichier SQL pas collé)
  async function html(fiche) {
    etat = null;
    let r;
    try { r = await P.rpc('carte_mannequin_par_fiche', { p_fiche: fiche }); } catch (e) { if (pas(e)) return ''; throw e; }
    if (!r || !r.carte) return '<section class="carte ce-carte"><h2>Sa carte de mannequin</h2><p class="doux">Elle n’est pas encore au registre de l’agence : sa carte sera possible dès qu’elle y sera.</p></section>';
    etat = { fiche, agence: r.agence_id, carte: r.carte, programme: r.programme };
    return dessiner();
  }
  function dessiner() {
    const c = etat.carte, auto = !c.categorie_manuelle;
    const r = resume(), niveaux = r ? Math.max(1, Math.round(r.total / 9)) : 2;
    const aujourdhui = new Date().toISOString().slice(0, 10), expiree = c.valable && c.valable < aujourdhui;
    const mois = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? P.MOIS[+m[2] - 1] + ' ' + m[1] : ''; };
    // 4. formation : les choix généraux, puis les mois du programme en colonnes (un niveau par colonne)
    const colonnes = [];
    for (let n = 1; n <= niveaux; n++) {
      colonnes.push('<div class="ce-col"><b>Niveau ' + n + ' · mois</b>' + Array.from({ length: 9 }, (_, i) => puce('formation', 'Niveau ' + n + ' · mois ' + (i + 1), c.formation || null, String(i + 1))).join('') + '</div>');
    }
    return '<section class="carte ce-carte" id="ce-carte"><div class="ce-tete"><h2>Sa carte de mannequin</h2>' +
        P.pastille(c.active ? 'Activée ✓' : 'Pas encore activée', c.active ? 'ok' : 'alerte') + '</div>' +
      '<div class="ce-apercu"><img class="ca-carte-img" alt="Sa carte de mannequin (' + face + ')" width="1012" height="638">' +
        '<div class="ce-apercu-btns"><button type="button" class="btn petit" data-action="carte-face">↻ ' + (face === 'recto' ? 'Verso' : 'Recto') + '</button>' +
        '<button type="button" class="btn petit" data-action="carte-fichier" data-valeur="image">⬇️ Télécharger</button>' +
        '<button type="button" class="btn petit" data-action="carte-fichier" data-valeur="pdf">🖨️ Imprimer</button></div></div>' +
      '<div class="ce-reglage"><h3><em>1</em>Carte</h3><p class="doux">Activée : elle la voit et la télécharge dans son application.</p><div class="ce-puces">' +
        puce('active', 'false', String(!!c.active), 'Pas activée') + puce('active', 'true', String(!!c.active), 'Activée') + '</div></div>' +
      '<div class="ce-reglage"><h3><em>2</em>Catégorie</h3><p class="doux">Automatique : la règle des 2 ans (2 ans à l’agence ou 2 ans d’expérience → Professionnelle). Aujourd’hui : <b>' +
        P.esc(window.CarteMannequin ? window.CarteMannequin.categorieCarte(c.categorie) : c.categorie) + '</b>.</p><div class="ce-puces">' +
        puce('categorie', null, c.categorie_manuelle || null, 'Automatique') + puce('categorie', 'New Face', c.categorie_manuelle || null, 'New Face') +
        puce('categorie', 'Professionnel', c.categorie_manuelle || null, 'Professionnelle') + '</div></div>' +
      '<div class="ce-reglage"><h3><em>3</em>Validité</h3><p class="doux">Durée du contrat, renouvelable. ' + (expiree ? '<b class="ce-expiree">Expirée depuis ' : 'Valable jusqu’en <b>') +
        P.esc(mois(c.valable) || '—') + '</b>.</p><div class="ce-puces">' + [3, 4, 5].map((n) => puce('validite_ans', String(n), String(c.validite_ans), n + ' ans')).join('') +
        '<button type="button" class="ce-puce ce-renouveler" data-bouton-libre data-action="carte-regler" data-reglage="renouveler" data-valeur="1"><span>↻ Renouveler<small>à partir d’aujourd’hui</small></span></button></div></div>' +
      '<div class="ce-reglage"><h3><em>4</em>Formation écrite sur la carte</h3><p class="doux">Touchez ce qui doit paraître.</p><div class="ce-puces">' +
        puce('formation', null, c.formation || null, 'Automatique', formationAuto()) + puce('formation', 'Recyclage', c.formation || null, 'Recyclage') +
        puce('formation', 'Révision', c.formation || null, 'Révision') + puce('formation', 'Formation terminée', c.formation || null, 'Formation terminée') + '</div>' +
        '<div class="ce-cols">' + colonnes.join('') + '</div></div>' +
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
    const valeur = reglage === 'active' ? v === 'true' : reglage === 'validite_ans' ? Number(v) : v === '' ? null : v;
    el.disabled = true;
    try {
      etat.carte = await P.sensible(() => P.rpc('carte_mannequin_regler', { p_agence: etat.agence, p_reglages: { [reglage]: valeur } }));
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
