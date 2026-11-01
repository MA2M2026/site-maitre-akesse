// Nouvelle Administration — « Bulletins trimestriels » (chantier 14, partie 3, 01/11/2026 ; idée gardée par la
// propriétaire le 31/10/2026). Pour le trimestre choisi, une fiche par mannequin du registre : ses présences aux
// cours du dimanche (liste de présence, calcul partagé js/presences-calcul.js), cinq notes sur 5 (marche,
// posture, photo, expression, attitude), une appréciation. « Enregistrer » garde le bulletin pour l'agence ;
// « Publier » le montre à la mannequin dans son application (et lui envoie un message) ; « Imprimer » donne un
// bulletin propre à remettre au parent. Base : supabase-bulletins.sql (Extension 145).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site || !window.Presences) return;
  const PAGE = 'b2-bulletins';
  const C = window.Presences;
  const pasActivee = P.pasActivee('bulletins_trimestre');
  let choisi = C.trimestre(C.jourIso(new Date()));

  async function page() {
    let d, periode;
    try {
      [d, periode] = await Promise.all([P.rpc('bulletins_trimestre', { p_trimestre: choisi.cle }), P.rpc('presences_periode', { p_debut: choisi.debut + '-01', p_fin: choisi.fin + '-01' }).catch(() => null)]);
    } catch (e) {
      if (pasActivee(e)) return P.entete('Bulletins trimestriels') + '<div class="carte vide">Les bulletins ne sont pas encore activés : il faut d’abord coller le fichier <b>supabase-bulletins.sql</b> dans Supabase.</div>';
      throw e;
    }
    const visages = await P.photosCouverture(d.mannequins.map((m) => m.compte).filter(Boolean)).catch(() => ({}));
    const parId = new Map((d.bulletins || []).map((b) => [b.mannequin, b]));
    const pres = new Map(), annulees = periode ? (periode.annulees || []).map((a) => a.dimanche) : [];
    (periode ? periode.presences : []).forEach((p) => { if (!pres.has(p.mannequin)) pres.set(p.mannequin, {}); pres.get(p.mannequin)[p.dimanche] = p.etat; });
    const aujourdhui = C.jourIso(new Date()), estFutur = choisi.debut > aujourdhui.slice(0, 7);
    const fiches = d.mannequins.map((m) => {
      const b = parId.get(m.id) || { notes: {}, appreciation: '', publie: false };
      const s = C.synthese(C.moisEntre(choisi.debut, choisi.fin), pres.get(m.id), annulees, m.date_entree, aujourdhui).bilan;
      const ment = s.mention ? C.MENTIONS[s.mention] : null, moy = C.moyenne(b.notes);
      const choix = (k) => '<select name="' + k + '" aria-label="' + P.esc(C.COMPETENCES.find((x) => x[0] === k)[1]) + ' (sur 5)"><option value="">—</option>' +
        [1, 2, 3, 4, 5].map((n) => '<option' + ((b.notes || {})[k] === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
      return '<form class="carte f bul-carte" data-form="bulletin-enregistrer" data-mannequin="' + P.esc(m.id) + '" data-publie="' + (b.publie ? '1' : '') + '">' +
        '<div class="bul-tete">' + P.visage(visages[m.compte], m.nom, 'pr-vis') + '<div><h2>' + P.esc(m.nom) + '</h2>' +
        '<p class="doux">' + P.esc(choisi.nom) + (m.mineur && m.parent_nom ? ' · parent : ' + P.esc(m.parent_nom) : '') + '</p></div>' +
        '<span class="bul-etat ' + (b.publie ? 'publie' : '') + '">' + (b.publie ? 'Publié' : parId.has(m.id) ? 'Brouillon' : 'À remplir') + '</span></div>' +
        '<p class="bul-presences"><b>Cours du dimanche :</b> ' + (s.comptees ? s.presents + ' sur ' + s.comptees + (s.excuses ? ' (+ ' + s.excuses + ' excusée' + (s.excuses > 1 ? 's' : '') + ')' : '') +
          (ment ? ' <span class="pr-badge ' + ment.ton + '">' + P.esc(ment.agence) + '</span>' : '') : '<span class="doux">aucune séance comptée</span>') + '</p>' +
        '<div class="bul-notes">' + C.COMPETENCES.map(([k, nom]) => '<label class="fl">' + P.esc(nom) + choix(k) + '</label>').join('') + '</div>' +
        (moy !== null ? '<p class="bul-moyenne">Moyenne : <b>' + String(moy).replace('.', ',') + ' / 5</b></p>' : '') +
        '<label class="fl large">Appréciation de l’agence<textarea name="appreciation" rows="3" maxlength="1500">' + P.esc(b.appreciation || '') + '</textarea></label>' +
        '<input type="hidden" name="publier" value="' + (b.publie ? '1' : '') + '">' +
        '<div class="ligne large bul-boutons">' + (estFutur ? '' : (b.publie ? '<button class="btn rouge" type="submit">Enregistrer (reste publié)</button>'
          : '<button class="btn" type="submit">Enregistrer</button><button class="btn rouge" type="button" data-action="bulletin-publier">Enregistrer et publier</button>')) +
        '<button class="btn" type="button" data-action="bulletin-imprimer">Imprimer</button></div></form>';
    }).join('');
    return P.entete('Bulletins trimestriels') +
      '<div class="carte pr-barre"><button type="button" class="btn petit" data-action="bulletins-trimestre" data-pas="-1" aria-label="Trimestre précédent">‹</button>' +
      '<h2><span class="pr-mois">' + P.esc(choisi.nom) + '</span></h2>' +
      '<button type="button" class="btn petit" data-action="bulletins-trimestre" data-pas="1" aria-label="Trimestre suivant">›</button></div>' +
      '<p class="doux petit-texte">Notes sur 5 ; les présences viennent de la liste de présence. Un bulletin « publié » apparaît dans l’application de la mannequin (elle reçoit un message) ; elle ne peut pas le modifier.</p>' +
      (fiches || '<div class="carte vide">Aucune mannequin active au registre.</div>');
  }

  // « Enregistrer et publier » : le même formulaire, avec publier = 1
  P.actions['bulletin-publier'] = (el) => {
    const form = el.closest('form');
    if (!confirm('Publier ce bulletin ? La mannequin le verra dans son application et recevra un message.')) return;
    form.elements.publier.value = '1';
    form.requestSubmit();
  };
  P.formulaires['bulletin-enregistrer'] = async (f, form) => {
    const publier = f.get('publier') === '1';
    const notes = {};
    C.COMPETENCES.forEach(([k]) => { const v = f.get(k); if (v) notes[k] = Number(v); });
    try {
      await P.rpc('bulletin_enregistrer', { p_mannequin: form.dataset.mannequin, p_trimestre: choisi.cle, p_notes: notes, p_appreciation: String(f.get('appreciation') || ''), p_publier: publier });
    } catch (e) {
      // (échec : « publier » revient à l'état du bulletin, pour qu'un simple « Enregistrer » ne publie jamais)
      form.elements.publier.value = form.dataset.publie || '';
      P.message('Non enregistré : ' + P.erreurTexte(e)); return;
    }
    P.message(publier ? 'Bulletin enregistré et publié : la mannequin le voit dans son application.' : 'Bulletin enregistré (pas encore publié).');
    return P.afficher();
  };
  P.actions['bulletins-trimestre'] = (el) => { choisi = C.trimestreVoisin(choisi, Number(el.dataset.pas)); return P.afficher(); };
  // impression d'un seul bulletin (les autres fiches et les boutons sont cachés à l'impression)
  P.actions['bulletin-imprimer'] = (el) => {
    const carte = el.closest('.bul-carte');
    document.querySelectorAll('.bul-carte').forEach((c) => c.classList.toggle('a-imprimer', c === carte));
    document.documentElement.classList.add('impression-bulletin');
    const fin = () => { document.documentElement.classList.remove('impression-bulletin'); removeEventListener('afterprint', fin); };
    addEventListener('afterprint', fin);
    window.print();
  };

  P.espaces.site.pages[PAGE] = page;
})();
