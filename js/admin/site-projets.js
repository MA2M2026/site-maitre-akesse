// Nouvelle Administration — Projets et castings (bloc 1, étape 2), reconstruit à neuf. Mêmes
// données que l'ancien tableau de bord (casting_projets) : ajouter, modifier (nom, description,
// date, lieu), activer / désactiver, ordre d'affichage (▲ ▼), supprimer. Les castings actifs
// alimentent le formulaire public « Postuler à un casting » et les Messages groupés. Nouveau :
// le nombre de candidatures reçues par casting (resume_candidatures_par_projet).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  let projets = [];

  async function charger() {
    const [liste, resume] = await Promise.all([
      P.bd(sb.from('casting_projets').select('id, nom, description, actif, created_at, date_casting, lieu, ordre_affichage')
        .order('ordre_affichage', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })),
      P.rpc('resume_candidatures_par_projet').catch(() => [])
    ]);
    const parNom = {};
    (resume || []).forEach((r) => { if (r.projet_nom) parNom[String(r.projet_nom).trim().toLowerCase()] = (parNom[String(r.projet_nom).trim().toLowerCase()] || 0) + Number(r.total || 0); });
    projets = liste.map((p) => Object.assign({ candidatures: parNom[String(p.nom).trim().toLowerCase()] || 0 }, p));
  }
  const champs = (p) => '<label class="fl" for="pj-nom">Nom du casting<input id="pj-nom" name="nom" required maxlength="160" value="' + P.esc(p ? p.nom : '') + '"></label>' +
    '<label class="fl" for="pj-date">Date du casting<input id="pj-date" name="date" type="date" value="' + P.esc(p && p.date_casting ? p.date_casting : '') + '"></label>' +
    '<label class="fl" for="pj-lieu">Lieu<input id="pj-lieu" name="lieu" maxlength="200" value="' + P.esc(p && p.lieu ? p.lieu : '') + '"></label>' +
    '<label class="fl large" for="pj-description">Description (visible par les candidates)<textarea id="pj-description" name="description" rows="3" maxlength="2000">' + P.esc(p && p.description ? p.description : '') + '</textarea></label>';
  const ligne = (f) => ({ nom: String(f.get('nom')).trim(), description: String(f.get('description') || '').trim() || null, date_casting: f.get('date') || null, lieu: String(f.get('lieu') || '').trim() || null });

  async function page() {
    await charger();
    const cartes = projets.map((p, i) => '<article class="projet-carte apparait' + (p.actif ? '' : ' inactif') + '" style="--i:' + Math.min(i, 10) + '">' +
      '<div class="projet-tete"><h2>' + P.esc(p.nom) + '</h2>' + P.pastille(p.actif ? 'Actif : visible sur le site' : 'Inactif', p.actif ? 'ok' : 'neutre') + '</div>' +
      '<p class="doux">' + P.esc([p.date_casting ? P.date(p.date_casting) : 'Date à préciser', p.lieu].filter(Boolean).join(' · ')) + '</p>' +
      (p.description ? '<p class="projet-description">' + P.esc(p.description) + '</p>' : '') +
      '<p class="projet-chiffre"><b>' + p.candidatures + '</b> candidature' + (p.candidatures > 1 ? 's' : '') + ' reçue' + (p.candidatures > 1 ? 's' : '') + '</p>' +
      '<div class="ligne"><button type="button" class="btn petit" data-action="projet-modifier" data-id="' + P.esc(p.id) + '">✏️ Modifier</button>' +
      '<button type="button" class="btn petit" data-action="projet-actif" data-id="' + P.esc(p.id) + '">' + (p.actif ? 'Désactiver' : 'Réactiver') + '</button>' +
      '<span class="fleches"><button type="button" class="btn petit" data-action="projet-monter" data-id="' + P.esc(p.id) + '"' + (i === 0 ? ' disabled' : '') + ' aria-label="Monter « ' + P.esc(p.nom) + ' »">▲</button>' +
      '<button type="button" class="btn petit" data-action="projet-descendre" data-id="' + P.esc(p.id) + '"' + (i === projets.length - 1 ? ' disabled' : '') + ' aria-label="Descendre « ' + P.esc(p.nom) + ' »">▼</button></span>' +
      '<button type="button" class="btn petit" data-action="projet-supprimer" data-id="' + P.esc(p.id) + '">Supprimer</button></div></article>').join('');
    return P.entete('Projets et castings', '<button type="button" class="btn rouge" data-action="projet-nouveau">＋ Nouveau casting</button><span class="doux">' + projets.filter((p) => p.actif).length + ' ' + (projets.filter((p) => p.actif).length > 1 ? 'actifs' : 'actif') + ' sur ' + projets.length + '</span>') +
      '<p class="doux">Les castings actifs apparaissent dans le formulaire public « Postuler à un casting », dans cet ordre.</p>' +
      (cartes ? '<div class="projets-liste">' + cartes + '</div>' : '<div class="carte vide">Aucun casting pour le moment.</div>');
  }
  P.actions['projet-nouveau'] = () => {
    P.fenetre('<form class="f" data-form="projet-ajouter"><h2>Nouveau casting</h2>' + champs(null) +
      '<div class="ligne large"><button class="btn rouge" type="submit">＋ Ajouter</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
    document.getElementById('pj-nom').focus();
  };
  P.formulaires['projet-ajouter'] = async (f) => {
    const l = ligne(f);
    if (!l.nom) { P.message('Indiquez au moins le nom du casting.'); return; }
    const r = await P.bd(sb.from('casting_projets').insert(l).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    P.message('Casting « ' + l.nom + ' » ajouté.');
    P.fenetre('');
    return P.afficher();
  };
  const trouver = (el) => projets.find((p) => String(p.id) === el.dataset.id);
  async function maj(id, valeurs, message) {
    const r = await P.bd(sb.from('casting_projets').update(valeurs).eq('id', id).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return false; }
    if (message) P.message(message);
    return true;
  }
  P.actions['projet-modifier'] = (el) => {
    const p = trouver(el);
    if (!p) return;
    P.fenetre('<form class="f" data-form="projet-enregistrer" data-id="' + P.esc(p.id) + '"><h2>Modifier le casting</h2>' + champs(p) +
      '<div class="ligne large"><button class="btn rouge" type="submit">Enregistrer</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
    document.getElementById('pj-nom').focus();
  };
  P.formulaires['projet-enregistrer'] = async (f, form) => {
    const l = ligne(f);
    if (!l.nom) { P.message('Le nom ne peut pas être vide.'); return; }
    if (await maj(form.dataset.id, l, 'Casting enregistré.')) { P.fenetre(''); return P.afficher(); }
  };
  P.actions['projet-actif'] = async (el) => {
    const p = trouver(el);
    if (p && await maj(p.id, { actif: !p.actif }, p.actif ? 'Casting désactivé : il n’apparaît plus sur le site.' : 'Casting réactivé : il apparaît de nouveau sur le site.')) return P.afficher();
  };
  // Ordre : on échange deux voisins puis on renumérote toute la liste de 0 à n
  // (un seul déplacement à la fois : deux appuis rapides ne mélangent plus l'ordre)
  let enCours = false;
  async function deplacer(el, sens) {
    const i = projets.findIndex((p) => String(p.id) === el.dataset.id), j = i + sens;
    if (enCours || i < 0 || j < 0 || j >= projets.length) return;
    enCours = true;
    document.querySelectorAll('[data-action="projet-monter"], [data-action="projet-descendre"]').forEach((b) => { b.disabled = true; });
    try {
      const ordre = projets.slice();
      [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
      const changes = ordre.map((p, k) => [p, k]).filter(([p, k]) => p.ordre_affichage !== k);
      await Promise.all(changes.map(([p, k]) => P.bd(sb.from('casting_projets').update({ ordre_affichage: k }).eq('id', p.id))));
    } finally { enCours = false; }
    return P.afficher();
  }
  P.actions['projet-monter'] = (el) => deplacer(el, -1);
  P.actions['projet-descendre'] = (el) => deplacer(el, 1);
  P.actions['projet-supprimer'] = async (el) => {
    const p = trouver(el);
    if (!p || !confirm('Supprimer le casting « ' + p.nom + ' » ? Les candidatures déjà reçues gardent son nom.')) return;
    const r = await P.bd(sb.from('casting_projets').delete().eq('id', p.id).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été supprimé : reconnectez-vous puis réessayez.'); return; }
    P.message('Casting supprimé.');
    return P.afficher();
  };
  P.espaces.site.pages['b2-projets'] = page;
})();
