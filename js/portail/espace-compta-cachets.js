// Espace 3 — « Payer les mannequins » (22/10/2026, choix de la propriétaire) : cachets après une
// prestation, pour les mannequins du registre (inscrites ou non) comme pour des personnes
// extérieures. Base : cachets_mannequins, cachet_payer(), cachet_annuler() (supabase-cachets.sql).
// Tant que l'agence n'a pas sa clé Wave Business (pas encore constituée), l'envoi se fait depuis
// le téléphone Wave, puis « Marquer payé » : la dépense « Cachets reversés aux mannequins » entre
// toute seule dans la comptabilité. Seul l'administrateur principal marque payé (code récent).
// Outils communs : P.compta (js/portail/espace-compta.js, à charger avant).
(function () {
  'use strict';
  const P = window.Portail, C = P.compta;
  if (!P || !C) return;
  const t = C.champ;
  const ABSENTE = '<div class="note info">Cette rubrique n’est pas encore activée. <span class="petit-texte doux">(Étape d’installation : « supabase-cachets.sql » à exécuter dans la base.)</span></div>';
  const tableAbsente = (e) => /cachets_mannequins|PGRST205|42P01|does not exist/.test(String((e && (e.code + ' ' + e.message)) || e));
  const principal = () => P.moi && P.moi.role === 'principal';
  // numéro saisi → chiffres seuls avec l'indicatif ivoirien (numeroWhatsApp, js/app.js)
  const numero = (x) => (typeof numeroWhatsApp === 'function' ? numeroWhatsApp(x) : String(x || '').replace(/\D/g, ''));
  const joli = (n) => '+' + String(n).replace(/^(\d{3})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5 $6');
  let cachets = [];

  async function page() {
    let liste;
    try { liste = await P.bd(sb.from('cachets_mannequins').select('*').order('cree_le', { ascending: false }).limit(300)); }
    catch (e) { if (tableAbsente(e)) return P.entete('Payer les mannequins') + ABSENTE; throw e; }
    cachets = liste;
    const [registre, projets] = await Promise.all([
      P.bd(sb.from('agence_mannequins').select('id, full_name, telephone, statut').eq('statut', 'actif').order('full_name')).catch(() => []),
      P.bd(sb.from('agenda_projets').select('id, titre, date_debut').eq('annule', false).gte('date_debut', new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10)).order('date_debut', { ascending: false }).limit(40)).catch(() => [])
    ]);
    P.etat.cachetsRegistre = registre;
    const aPayer = liste.filter((c) => c.statut === 'a_payer'), payes = liste.filter((c) => c.statut === 'paye').slice(0, 60);
    const total = aPayer.reduce((s, c) => s + c.montant, 0);
    const carte = (c) => '<div class="cachet' + (c.statut === 'a_payer' ? '' : ' fait') + '"><div class="t"><b>' + P.esc(c.beneficiaire) + '</b>' +
      '<small>' + P.esc(c.prestation) + ' · ' + joli(c.telephone) + '</small></div><span class="cachet-montant">' + P.fcfa(c.montant) + '</span>' +
      (c.statut === 'a_payer' ? '<div class="ligne"><button class="btn petit" type="button" data-action="cachet-copier" data-numero="' + P.esc(c.telephone) + '">Copier le numéro</button>' +
        (principal() ? '<button class="btn petit rouge" type="button" data-action="cachet-payer" data-id="' + c.id + '">Marquer payé</button>' +
          '<button class="btn petit" type="button" data-action="cachet-annuler" data-id="' + c.id + '">Annuler</button>' : '') + '</div>'
        : '<small class="doux">Payé le ' + P.date(c.paye_le) + (c.reference_wave ? ' · réf. ' + P.esc(c.reference_wave) : '') + '</small>') + '</div>';
    return P.entete('Payer les mannequins', '<button class="btn rouge" type="button" data-action="cachet-nouveau">＋ Nouveau cachet</button>') +
      '<div class="note info">Envoi direct par Wave : disponible quand l’agence aura sa clé Wave Business. En attendant, payez depuis votre téléphone Wave, puis touchez « Marquer payé » : la dépense entre toute seule dans la comptabilité.</div>' +
      '<section class="carte"><h2>À payer <span class="doux">(' + aPayer.length + (aPayer.length ? ' · ' + P.fcfa(total) : '') + ')</span></h2>' +
      (aPayer.length ? aPayer.map(carte).join('') : '<p class="doux">Rien à payer pour le moment.</p>') + '</section>' +
      '<section class="carte"><h2>Déjà payés</h2>' + (payes.length ? payes.map(carte).join('') : '<p class="doux">Aucun cachet payé pour le moment.</p>') + '</section>' +
      // (projets de l'agenda pour la fenêtre « Nouveau cachet »)
      '<template id="cachet-projets">' + projets.map((p) => '<option value="' + p.id + '">' + P.esc(p.titre + ' · ' + P.date(p.date_debut)) + '</option>').join('') + '</template>';
  }

  P.actions['cachet-nouveau'] = () => {
    const registre = P.etat.cachetsRegistre || [], tpl = document.getElementById('cachet-projets');
    P.fenetre('<form class="f" data-form="cachet-ajouter"><h2 class="large">Nouveau cachet à payer</h2>' +
      '<label class="fl large" for="ca-qui">Qui ?<select id="ca-qui" name="qui" data-change="cachet-qui"><option value="">— Personne extérieure (nom et numéro) —</option>' +
      registre.map((m) => '<option value="' + m.id + '">' + P.esc(m.full_name) + '</option>').join('') + '</select></label>' +
      '<label class="fl" for="ca-nom">Nom et prénoms<input id="ca-nom" name="nom" maxlength="160" required></label>' +
      '<label class="fl" for="ca-tel">Numéro Wave<input id="ca-tel" name="telephone" type="tel" inputmode="tel" required placeholder="07 07 07 07 07"></label>' +
      '<label class="fl" for="ca-projet">Projet de l’agenda (facultatif)<select id="ca-projet" name="projet"><option value="">—</option>' + (tpl ? tpl.innerHTML : '') + '</select></label>' +
      '<label class="fl" for="ca-prestation">Prestation (sinon : le projet choisi)<input id="ca-prestation" name="prestation" maxlength="200" placeholder="ex. : défilé du 5 décembre"></label>' +
      '<label class="fl" for="ca-montant">Montant (FCFA)<input id="ca-montant" name="montant" type="number" inputmode="numeric" min="1" max="5000000" step="1" required></label>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">Ajouter à payer</button><button class="btn" type="button" data-action="fermer-fenetre">Annuler</button></div></form>');
    document.getElementById('ca-qui').focus();
  };
  // une mannequin du registre : nom et numéro remplis d'office (modifiables)
  P.changements['cachet-qui'] = (el) => {
    const m = (P.etat.cachetsRegistre || []).find((x) => x.id === el.value);
    document.getElementById('ca-nom').value = m ? m.full_name : '';
    document.getElementById('ca-tel').value = m ? (m.telephone || '') : '';
  };
  P.formulaires['cachet-ajouter'] = async (f) => {
    const tel = numero(t(f, 'telephone')), montant = Math.round(Number(f.get('montant')));
    if (!/^\d{8,15}$/.test(tel)) { P.message('Ce numéro Wave n’est pas valable.'); return; }
    if (!(montant > 0)) { P.message('Indiquez le montant.'); return; }
    const projet = t(f, 'projet'), sel = document.getElementById('ca-projet');
    const prestation = t(f, 'prestation') || (projet && sel ? sel.selectedOptions[0].textContent : '');
    if (!prestation) { P.message('Indiquez la prestation, ou choisissez le projet de l’agenda.'); return; }
    const r = await P.bd(sb.from('cachets_mannequins').insert({ beneficiaire: t(f, 'nom'), telephone: tel, montant, prestation, projet_id: projet, agence_mannequin_id: t(f, 'qui'), statut: 'a_payer', cree_le: new Date().toISOString() }).select('id'));
    if (!r || !r.length) { P.message('Rien n’a été enregistré : reconnectez-vous puis réessayez.'); return; }
    await C.actualiser('Cachet ajouté à la liste « À payer ».');
  };
  P.actions['cachet-copier'] = (el) => {
    const texte = el.textContent;
    navigator.clipboard.writeText(el.dataset.numero.replace(/^225/, '')).then(() => { el.textContent = 'Copié !'; }, () => { el.textContent = el.dataset.numero; });
    setTimeout(() => { if (el.isConnected) el.textContent = texte; }, 1600);
  };
  P.actions['cachet-payer'] = async (el) => {
    const c = cachets.find((x) => x.id === el.dataset.id);
    if (!c) return;
    const comptes = (await C.comptes()).sort((a, b) => (b.type === 'wave') - (a.type === 'wave'));
    P.fenetre('<form class="f" data-form="cachet-confirmer" data-id="' + c.id + '"><h2 class="large">Confirmer le paiement</h2>' +
      '<p class="large recap-cachet"><b>' + P.fcfa(c.montant) + '</b> à <b>' + P.esc(c.beneficiaire) + '</b> (' + joli(c.telephone) + ')<br><span class="doux">' + P.esc(c.prestation) + '</span></p>' +
      '<label class="fl" for="cp-compte">Payé depuis<select id="cp-compte" name="compte" required>' + C.optionsComptes(comptes) + '</select></label>' +
      '<label class="fl" for="cp-ref">Référence de la transaction Wave (facultatif)<input id="cp-ref" name="reference" maxlength="80" autocomplete="off"></label>' +
      '<p class="doux petit-texte large">Ne touchez « J’ai payé » qu’après l’envoi réussi dans Wave. La dépense entre dans la comptabilité.</p>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">J’ai payé</button><button class="btn" type="button" data-action="fermer-fenetre">Retour</button></div></form>');
  };
  P.formulaires['cachet-confirmer'] = async (f, form) => {
    await P.sensible(() => P.rpc('cachet_payer', { p_id: form.dataset.id, p_compte: t(f, 'compte'), p_reference: t(f, 'reference') }));
    await C.actualiser('Paiement enregistré : la dépense est dans la comptabilité.');
  };
  P.actions['cachet-annuler'] = (el) => {
    P.fenetre('<form class="f" data-form="cachet-annuler" data-id="' + el.dataset.id + '"><h2 class="large">Annuler ce cachet</h2>' +
      '<label class="fl large" for="cn-motif">Motif<input id="cn-motif" name="motif" maxlength="300" required placeholder="ex. : prestation annulée"></label>' +
      '<div class="ligne large"><button class="btn rouge" type="submit">Annuler le cachet</button><button class="btn" type="button" data-action="fermer-fenetre">Retour</button></div></form>');
  };
  P.formulaires['cachet-annuler'] = async (f, form) => {
    await P.sensible(() => P.rpc('cachet_annuler', { p_id: form.dataset.id, p_motif: t(f, 'motif') }));
    await C.actualiser('Cachet annulé (gardé dans l’historique).');
  };

  P.espaces.compta.pages.cachets = page;
  P.espaces.compta.nav.push(['cachets', 'Payer les mannequins']);  // (rangé par js/portail/espace-compta-dossier.js)
})();
