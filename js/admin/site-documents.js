// Nouvelle Administration — « Documents des mannequins » (chantier 14, partie 3, 01/11/2026 ; idée gardée par la
// propriétaire le 31/10/2026). Pour chaque mannequin du registre : autorisation parentale, pièce d'identité,
// contrat… avec leur date de fin. La liste est triée par urgence : expiré en rouge, moins de 30 jours en orange,
// valable en vert. Ajouter, corriger (une nouvelle date relance les alertes), supprimer. Chaque matin, le serveur
// envoie à l'agence un e-mail pour les documents qui arrivent à leur fin (api/portail.js, documentsDuJour).
// Base : supabase-documents.sql (Extension 147).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const PAGE = 'b2-documents';
  const SORTES = [['autorisation_parentale', 'Autorisation parentale'], ['piece_identite', 'Pièce d’identité'], ['contrat', 'Contrat'], ['autre', 'Autre document']];
  const nomSorte = (s) => (SORTES.find((x) => x[0] === s) || [s, 'Document'])[1];
  const pasActivee = P.pasActivee('documents_liste');
  let edite = null;  // id du document en cours de correction

  function jourIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  // jours restants avant la fin (négatif : expiré depuis)
  function joursRestants(fin, aujourdhui) { return Math.round((Date.parse(fin + 'T00:00:00Z') - Date.parse(aujourdhui + 'T00:00:00Z')) / 86400000); }
  function etat(fin, aujourdhui) {
    const j = joursRestants(fin, aujourdhui);
    if (j <= 0) return { ton: 'rouge', texte: j === 0 ? 'Expire aujourd’hui' : 'Expiré depuis ' + -j + ' jour' + (j < -1 ? 's' : '') };
    if (j <= 30) return { ton: 'orange', texte: 'Expire dans ' + j + ' jour' + (j > 1 ? 's' : '') };
    return { ton: 'vert', texte: 'Valable' };
  }
  const dateFr = (iso) => { const [a, m, j] = String(iso || '').split('-'); return j + '/' + m + '/' + a; };

  function formulaire(d, mannequins) {
    const doc = d || {};
    const options = mannequins.map((m) => '<option value="' + P.esc(m.id) + '"' + (m.id === doc.mannequin ? ' selected' : '') + '>' + P.esc(m.nom) + '</option>').join('') +
      (doc.mannequin && !mannequins.some((m) => m.id === doc.mannequin) ? '<option value="' + P.esc(doc.mannequin) + '" selected>' + P.esc(doc.nom) + '</option>' : '');
    return '<form class="carte f doc-form" data-form="document-enregistrer"' + (doc.id ? ' data-id="' + P.esc(doc.id) + '"' : '') + '>' +
      '<h2 class="large">' + (doc.id ? 'Corriger le document' : 'Ajouter un document') + '</h2>' +
      '<label class="fl">Mannequin<select name="mannequin" required><option value="">Choisir…</option>' + options + '</select></label>' +
      '<label class="fl">Type de document<select name="sorte" required>' + SORTES.map(([k, n]) => '<option value="' + k + '"' + (k === doc.sorte ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      '<label class="fl">Précision (facultatif)<input name="libelle" maxlength="120" value="' + P.esc(doc.libelle || '') + '" placeholder="ex. passeport, contrat 2026"></label>' +
      '<label class="fl">Date de fin<input type="date" name="expire_le" required value="' + P.esc(doc.expire_le || '') + '"></label>' +
      '<label class="fl large">Note (facultatif)<input name="note" maxlength="300" value="' + P.esc(doc.note || '') + '"></label>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">' + (doc.id ? 'Enregistrer la correction' : 'Ajouter') + '</button>' +
      (doc.id ? '<button class="btn" type="button" data-action="document-annuler">Annuler</button>' : '') + '</div></form>';
  }

  async function page() {
    let d;
    try { d = await P.rpc('documents_liste'); } catch (e) {
      if (pasActivee(e)) return P.entete('Documents des mannequins') + '<div class="carte vide">Les documents ne sont pas encore activés : il faut d’abord coller le fichier <b>supabase-documents.sql</b> dans Supabase.</div>';
      throw e;
    }
    const aujourdhui = jourIso(new Date());
    const docs = (d.documents || []).slice().sort((a, b) => a.expire_le.localeCompare(b.expire_le) || String(a.nom).localeCompare(String(b.nom), 'fr'));
    const enEdition = edite && docs.find((x) => x.id === edite);
    if (!enEdition) edite = null;
    const compte = { rouge: 0, orange: 0 };
    const lignes = docs.map((x) => {
      const e = etat(x.expire_le, aujourdhui);
      if (compte[e.ton] !== undefined) compte[e.ton]++;
      return '<li class="doc-ligne ' + e.ton + '"><div class="doc-quoi"><b>' + P.esc(x.nom) + '</b><span>' + P.esc(nomSorte(x.sorte)) + (x.libelle ? ' · ' + P.esc(x.libelle) : '') + '</span>' +
        (x.note ? '<span class="doux">' + P.esc(x.note) + '</span>' : '') + '</div>' +
        '<div class="doc-fin"><span class="pr-badge ' + e.ton + '">' + P.esc(e.texte) + '</span><span class="doux">fin le ' + P.esc(dateFr(x.expire_le)) + '</span></div>' +
        '<div class="doc-boutons"><button class="btn petit" type="button" data-action="document-modifier" data-id="' + P.esc(x.id) + '">Modifier</button>' +
        '<button class="btn petit" type="button" data-action="document-supprimer" data-id="' + P.esc(x.id) + '">Supprimer</button></div></li>';
    }).join('');
    const resume = docs.length ? '<p class="doc-resume">' + (compte.rouge ? '<span class="pr-badge rouge">' + compte.rouge + ' expiré' + (compte.rouge > 1 ? 's' : '') + '</span> ' : '') +
      (compte.orange ? '<span class="pr-badge orange">' + compte.orange + ' bientôt</span> ' : '') +
      (!compte.rouge && !compte.orange ? '<span class="pr-badge vert">Tout est à jour</span>' : '') + '</p>' : '';
    return P.entete('Documents des mannequins') +
      '<p class="doux petit-texte">Les documents les plus urgents en premier. Chaque matin, l’agence reçoit un e-mail 30 jours avant la fin d’un document, puis le jour où il expire. Une fois renouvelé, corrigez la date de fin.</p>' +
      formulaire(enEdition, d.mannequins || []) +
      '<div class="carte"><h2>Documents enregistrés</h2>' + resume +
      (lignes ? '<ul class="doc-liste">' + lignes + '</ul>' : '<p class="vide">Aucun document enregistré pour l’instant.</p>') + '</div>';
  }

  P.formulaires['document-enregistrer'] = async (f, form) => {
    try {
      await P.rpc('document_enregistrer', { p_id: form.dataset.id || null, p_mannequin: String(f.get('mannequin') || ''), p_sorte: String(f.get('sorte') || ''),
        p_libelle: String(f.get('libelle') || ''), p_expire_le: String(f.get('expire_le') || ''), p_note: String(f.get('note') || '') });
    } catch (e) { P.message('Non enregistré : ' + P.erreurTexte(e)); return; }
    P.message(form.dataset.id ? 'Document corrigé.' : 'Document ajouté.');
    edite = null;
    return P.afficher();
  };
  P.actions['document-modifier'] = (el) => { edite = el.dataset.id; return P.afficher().then(() => { const f = document.querySelector('.doc-form'); if (f) f.scrollIntoView({ block: 'start' }); }); };
  P.actions['document-annuler'] = () => { edite = null; return P.afficher(); };
  P.actions['document-supprimer'] = async (el) => {
    if (!confirm('Supprimer ce document de la liste ?')) return;
    try { await P.rpc('document_supprimer', { p_id: el.dataset.id }); } catch (e) { P.message('Non supprimé : ' + P.erreurTexte(e)); return; }
    if (edite === el.dataset.id) edite = null;
    P.message('Document supprimé.');
    return P.afficher();
  };

  P.espaces.site.pages[PAGE] = page;
})();
