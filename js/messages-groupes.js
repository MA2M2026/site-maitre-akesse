// ================== Messages groupés (tableau de bord) ==================
// Demande de la propriétaire (30/09/2026) : après le premier message automatique
// (« votre candidature est retenue… »), pouvoir envoyer UN message à tout un groupe
// (ex. les 100 candidates retenues d'un casting : convocation, rappel…), chaque
// personne le recevant SÉPARÉMENT (personne ne voit les autres, aucun groupe créé).
//
//   - E-mail : envoi automatique, l'un après l'autre (EmailJS, même modèle que les
//     messages de statut). Pause d'une seconde entre deux envois (limite du service).
//   - WhatsApp : l'envoi entièrement automatique n'existe qu'avec l'offre payante de
//     WhatsApp pour les entreprises. Ici, gratuit : chaque appui ouvre WhatsApp avec le
//     message déjà écrit pour la personne suivante ; il reste à appuyer sur « Envoyer ».
//   - Candidatures : « Quel message ? » propose les messages du statut choisi (relance,
//     convocation, rappel… ; le 1er message part tout seul au changement de statut), les mêmes que sur la fiche d'une personne
//     (catalogue commun : js/messages-candidats.js). On coche une, plusieurs ou toutes
//     les personnes.
//   - « {prénom} », « {candidature} » et « {casting} » sont remplacés pour chaque personne ;
//     « {date} », « {heure} » et « {lieu} » par les cases au-dessus du message (convocation
//     au casting en présentiel de l'agence, demande de la propriétaire du 07/10/2026).
//   - Le message est écrit pour WhatsApp (*gras*, _italique_) : l'e-mail reçoit le même
//     texte sans ces signes, et sans la phrase « Un e-mail de confirmation… » (retirée aussi
//     du WhatsApp des personnes sans e-mail). Textes et outils : js/messages-candidats.js.
//   - Les envois déjà faits sont notés sur cet appareil (on peut s'arrêter et reprendre
//     plus tard sans renvoyer en double).
(function () {
  const $ = (id) => document.getElementById(id);
  if (!$('mg-source')) return;

  const CHAMPS = {
    casting: 'id, full_name, email, phone, status, type_candidature, projet_nom, created_at',
    inscription: 'id, full_name, email, phone, statut, created_at'
  };
  let destinataires = [];
  // « Qui ? » : agence et casting précis sont deux sortes de candidatures (même table).
  function table() { return $('mg-source').value === 'inscription' ? 'inscription' : 'casting'; }
  function conf() { return DOSSIERS[table()]; }
  // {date}, {heure}, {lieu} : mêmes pour tout le groupe (cases au-dessus du message).
  const A_COMPLETER = '[à compléter]';
  const INFOS_RDV = /\{(date|heure|lieu)\}/i;
  function rdv() { return { date: $('mg-date').value, heure: $('mg-heure').value, lieu: $('mg-lieu').value }; }
  function remplirInfos(texte) { return remplirRdv(texte, rdv(), () => A_COMPLETER); }
  // Message prêt pour une personne : fonction commune à la fiche (js/messages-candidats.js).
  function personnaliser(texte, d) { return personnaliserMessage(texte, d, rdv(), () => A_COMPLETER); }
  function echapper(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // Suivi des envois déjà faits pour CE message (même texte = même envoi), sur cet appareil.
  // Date, heure et lieu comptent : la convocation de la semaine suivante est un nouvel envoi.
  function cleSuivi(canal) {
    const t = remplirInfos($('mg-message').value.trim());
    let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    return 'ma2m_mg_' + canal + '_' + h;
  }
  // Envois mémorisés avec leur date : { id: 'AAAA-MM-JJTHH:MM…' }. (Ancien format :
  // simple liste d'identifiants — toujours compris.)
  function datesEnvoi(canal) {
    try {
      const v = JSON.parse(localStorage.getItem(cleSuivi(canal)) || '{}');
      if (Array.isArray(v)) { const o = {}; v.forEach(id => { o[id] = ''; }); return o; }
      return v || {};
    } catch (e) { return {}; }
  }
  function dejaFaits(canal) { return new Set(Object.keys(datesEnvoi(canal))); }
  function noterFait(canal, id) { const o = datesEnvoi(canal); o[id] = new Date().toISOString(); try { localStorage.setItem(cleSuivi(canal), JSON.stringify(o)); } catch (e) {} }
  function dateCourte(iso) { return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; }

  // Date, heure et lieu proposés : dimanche suivant, puis les dernières valeurs saisies.
  function initialiserInfos() {
    const m = infosRdvMemorisees();
    $('mg-date').value = dimancheSuivantISO(); $('mg-heure').value = m.heure; $('mg-lieu').value = m.lieu;
  }
  function retenirInfos() { memoriserInfosRdv($('mg-heure').value, $('mg-lieu').value); }
  // Les cases n'apparaissent que si le message les utilise.
  function majInfos() { $('mg-infos-rdv').style.display = INFOS_RDV.test($('mg-message').value) ? '' : 'none'; }

  // Messages proposés d'office pour CHAQUE groupe (demande de la propriétaire, 04/10/2026 :
  // « il faut bien structurer, bien rédiger »). Même présentation partout : en-tête de
  // l'agence, une idée par paragraphe, contact, signature. Toujours modifiables avant envoi.
  const ENTETE = '✨ MAÎTRE AKESSE MODEL MANAGEMENT ✨';
  const CONTACT = '📞 Une question ? Écrivez-nous sur WhatsApp au 05 45 65 66 87.';
  const SIGNATURE = "Bien cordialement,\nL'équipe Maître Akesse Model Management";
  function message(corps) { return `${ENTETE}\n\nBonjour {prénom},\n\n${corps}\n\n${CONTACT}\n\n${SIGNATURE}`; }
  // Inscriptions : un message par statut (les candidatures utilisent le catalogue commun,
  // js/messages-candidats.js, avec le choix « Quel message ? »).
  function modelePour(qui, statut) {
    if (qui === 'inscription') {
      return ({
        'en attente de paiement': message(`Nous avons bien reçu votre inscription auprès de Maître Akesse Model Management. Merci pour votre confiance !\n\n🔎 Votre paiement est en cours de vérification par notre équipe. Cette étape peut prendre un peu de temps.\n\nDès que votre paiement sera confirmé, nous vous enverrons un nouveau message pour la suite de votre inscription.`),
        'dossier en vérification': message(`Votre paiement a bien été reçu ✅\n\n🔎 Votre dossier d'inscription est maintenant en cours de vérification par notre équipe (informations et photos).\n\nNous reviendrons vers vous très prochainement avec la réponse et les prochaines étapes.`),
        'payée': message(`Félicitations ! 🎉 Votre inscription auprès de Maître Akesse Model Management est validée.\n\nBienvenue dans l'agence ! Nous sommes ravis de vous compter parmi nos mannequins.\n\n📌 Prochaine étape : nous vous contacterons très prochainement pour vous présenter le déroulement de la suite (formation, séances photo et castings).`),
        'annulée': message(`Nous vous remercions pour l'intérêt que vous portez à Maître Akesse Model Management.\n\nAprès étude, nous ne sommes malheureusement pas en mesure de valider votre inscription pour le moment.\n\nSi vous pensez qu'il s'agit d'une erreur, ou pour connaître les raisons de cette décision, n'hésitez pas à nous contacter.`)
      })[statut] || '';
    }
    const m = messageCandidatParCle($('mg-type').value);
    return m && m.statut === statut ? m.modele(qui === 'casting' ? 'projet' : 'agence') : '';
  }
  let dernierModele = '';
  function proposerModele() {
    const zone = $('mg-message');
    const actuel = zone.value.trim();
    const modele = modelePour($('mg-source').value, $('mg-statut').value);
    // Un message écrit à la main n'est jamais remplacé sans accord.
    if (actuel && actuel !== dernierModele.trim() && actuel !== modele.trim()
      && !confirm('Remplacer le message que vous avez modifié par le message choisi ?')) return;
    zone.value = modele; dernierModele = modele;
    majInfos(); majApercu(); majBoutons();
  }

  // « Quel message ? » (candidatures) : tous les messages du statut choisi, les mêmes que
  // sur la fiche d'une personne. Proposé d'office : celui marqué « groupe ».
  function remplirTypes() {
    const candidatures = $('mg-source').value !== 'inscription';
    $('mg-champ-type').style.display = candidatures ? '' : 'none';
    if (!candidatures) { $('mg-type').innerHTML = ''; return; }
    const liste = MESSAGES_CANDIDATS.filter(m => m.statut === $('mg-statut').value && !m.premier);
    $('mg-type').innerHTML = liste.map(m => `<option value="${m.cle}">${echapper(m.libelle)}</option>`).join('');
    const defaut = liste.find(m => m.groupe) || liste[0];
    if (defaut) $('mg-type').value = defaut.cle;
  }

  // Pas de second message après un refus (décision de la propriétaire, 07/10/2026) ; le
  // 1er message part tout seul au changement de statut, il n'est pas proposé ici.
  const SANS_SECOND_MESSAGE = ['refusée', 'annulée'];
  function remplirStatuts() {
    const c = conf();
    $('mg-statut').innerHTML = c.statuts.filter(s => !SANS_SECOND_MESSAGE.includes(s)).map(s => `<option value="${echapper(s)}">${echapper(c.libellesStatut[s] || s)}</option>`).join('');
    $('mg-statut').value = c.statuts.includes('retenue') ? 'retenue' : c.statuts.includes('payée') ? 'payée' : c.statuts[0];
    $('mg-champ-casting').style.display = $('mg-source').value === 'casting' ? '' : 'none';
    remplirTypes();
    proposerModele();
    viderListe();
  }

  // Liste des castings : ceux créés dans « Projets & Castings » (actifs ou non) + ceux
  // pour lesquels des candidatures existent déjà (nom saisi par la candidate).
  async function chargerCastings() {
    const noms = new Set();
    const [{ data: projets }, { data: cands }] = await Promise.all([
      sb.from('casting_projets').select('nom').order('created_at', { ascending: false }),
      sb.from('casting_applications').select('projet_nom').eq('type_candidature', 'projet').not('projet_nom', 'is', null).limit(5000)
    ]);
    (projets || []).forEach(p => p.nom && noms.add(p.nom.trim()));
    (cands || []).forEach(c => c.projet_nom && noms.add(c.projet_nom.trim()));
    const liste = [...noms].sort((a, b) => a.localeCompare(b, 'fr'));
    $('mg-casting').innerHTML = liste.length
      ? '<option value="">— Choisissez le casting —</option>' + liste.map(n => `<option value="${echapper(n)}">${echapper(n)}</option>`).join('')
      : '<option value="">Aucun casting pour l’instant</option>';
  }

  function viderListe() {
    destinataires = [];
    $('mg-liste').innerHTML = '';
    $('mg-resume').textContent = 'Choisissez le groupe puis appuyez sur « Afficher les destinataires ».';
    majApercu(); majBoutons();
  }

  async function charger() {
    const c = conf();
    const qui = $('mg-source').value;
    if (qui === 'casting' && !$('mg-casting').value) { $('mg-resume').textContent = 'Choisissez d’abord le casting.'; return; }
    $('mg-resume').textContent = 'Chargement…';
    const { data: lignes, error } = await lireToutesLignes(() => {
      let q = sb.from(c.table).select(CHAMPS[table()]).eq(c.statutChamp, $('mg-statut').value);
      if (qui === 'agence') q = q.eq('type_candidature', 'agence');
      if (qui === 'casting') q = q.eq('type_candidature', 'projet').eq('projet_nom', $('mg-casting').value);
      return q.order('created_at', { ascending: true }).order('id');
    });
    if (error) { $('mg-resume').textContent = 'Erreur : ' + error.message; return; }
    destinataires = lignes.map(d => Object.assign(d, { choisi: true }));
    afficherListe();
  }

  function afficherListe() {
    $('mg-resume').textContent = destinataires.length ? '' : 'Personne dans ce groupe.';
    const mails = datesEnvoi('email'), was = datesEnvoi('wa');
    $('mg-liste').innerHTML = destinataires.map((d, i) => {
      const envois = [
        d.id in mails ? '✉️ e-mail envoyé' + (mails[d.id] ? ' le ' + dateCourte(mails[d.id]) : '') : '',
        d.id in was ? '💬 WhatsApp ouvert' + (was[d.id] ? ' le ' + dateCourte(was[d.id]) : '') : ''
      ].filter(Boolean).join(' · ');
      return `
      <label class="mg-personne">
        <input type="checkbox" data-i="${i}" ${d.choisi ? 'checked' : ''}>
        <span class="mg-nom">${echapper(d.full_name || '—')}</span>
        <span class="mg-infos">${echapper([d.email, d.phone].filter(Boolean).join(' · ') || 'aucun contact')}
          <span class="mg-date">Postulé le ${dateCourte(d.created_at)}</span>${envois ? `<span class="mg-envoye">${envois}</span>` : ''}</span>
      </label>`;
    }).join('');
    majApercu(); majBoutons();
  }

  function choisis() { return destinataires.filter(d => d.choisi); }

  function majApercu() {
    const t = $('mg-message').value.trim();
    const premier = choisis()[0];
    $('mg-apercu').textContent = t && premier ? 'Aperçu pour ' + (premier.full_name || '') + ' :\n\n' + personnaliser(t, premier) : '';
    $('mg-apercu').style.display = $('mg-apercu').textContent ? 'block' : 'none';
  }

  function majBoutons() {
    const t = $('mg-message').value.trim();
    const liste = choisis();
    // Toujours dire clairement pourquoi un bouton ne marche pas (constaté le 30/09 :
    // message vide = boutons bloqués, sans aucune explication visible).
    if (destinataires.length) {
      $('mg-resume').textContent = `${liste.length} personne(s) cochée(s) sur ${destinataires.length} — ${liste.filter(d => d.email).length} avec e-mail, ${liste.filter(d => numeroWhatsApp(d.phone)).length} avec numéro WhatsApp. Décochez celles à qui vous ne voulez pas écrire.`;
    }
    $('mg-consigne').textContent = !destinataires.length ? ''
      : !liste.length ? '☝️ Cochez au moins une personne dans la liste.'
      : !t ? '✍️ La case « Message » est vide : écrivez votre message, les boutons d’envoi s’activeront.'
      : '';
    const faitsMail = dejaFaits('email'), faitsWa = dejaFaits('wa');
    const restantMail = liste.filter(d => d.email && !faitsMail.has(d.id)).length;
    const restantWa = liste.filter(d => numeroWhatsApp(d.phone) && !faitsWa.has(d.id));
    $('mg-email').disabled = !t || !restantMail;
    $('mg-email').textContent = restantMail ? `📧 Envoyer par e-mail à ${restantMail} personne(s)` : '📧 Envoyer par e-mail';
    $('mg-wa-copier').disabled = !liste.some(d => numeroWhatsApp(d.phone));
    const suivant = restantWa[0];
    $('mg-wa-suivant').disabled = !t || !suivant;
    $('mg-wa-suivant').textContent = suivant
      ? `💬 Ouvrir WhatsApp pour ${suivant.full_name || suivant.phone} — personne ${liste.filter(d => numeroWhatsApp(d.phone)).length - restantWa.length + 1} sur ${liste.filter(d => numeroWhatsApp(d.phone)).length}`
      : (liste.some(d => numeroWhatsApp(d.phone)) && t ? '✓ WhatsApp : tout le monde a été fait' : '💬 Ouvrir WhatsApp pour la personne suivante');
  }

  function resteACompleter() {
    if (remplirInfos($('mg-message').value).indexOf(A_COMPLETER) === -1) return false;
    alert('Le message contient encore « ' + A_COMPLETER + ' » : remplissez les cases date, heure et lieu, ou remplacez ces passages par les vraies informations, avant d\'envoyer.');
    return true;
  }

  async function envoyerEmails() {
    if (resteACompleter()) return;
    const t = $('mg-message').value.trim();
    const faits = dejaFaits('email');
    const liste = choisis().filter(d => d.email && !faits.has(d.id));
    if (!liste.length) return;
    if (!confirm(`Envoyer ce message par e-mail à ${liste.length} personne(s) ?\n\nChacune le recevra séparément.`)) return;
    const etat = $('mg-email-etat');
    $('mg-email').disabled = true;
    let ok = 0; const echecs = [];
    for (let i = 0; i < liste.length; i++) {
      const d = liste[i];
      etat.className = 'form-msg ok';
      etat.textContent = `Envoi ${i + 1} / ${liste.length}… (gardez la page ouverte)`;
      try {
        await envoyerEmailCandidat({ to_email: d.email, to_name: prenomDe(d.full_name), message: messagePourEmail(personnaliser(t, d)) });
        noterFait('email', d.id); ok++;
      } catch (e) {
        echecs.push((d.full_name || d.email) + (e && e.text ? ' (' + e.text + ')' : ''));
      }
      if (i < liste.length - 1) await new Promise(r => setTimeout(r, 1100));
    }
    etat.className = echecs.length ? 'form-msg err' : 'form-msg ok';
    etat.style.whiteSpace = 'pre-line';
    afficherListe();
    etat.textContent = `✓ ${ok} e-mail(s) envoyé(s).` + (echecs.length ? `\n${echecs.length} échec(s) — vous pouvez rappuyer pour réessayer uniquement ceux-là :\n` + echecs.join('\n') : '');
    majBoutons();
  }

  function whatsappSuivant() {
    if (resteACompleter()) return;
    const t = $('mg-message').value.trim();
    const faits = dejaFaits('wa');
    const d = choisis().find(x => numeroWhatsApp(x.phone) && !faits.has(x.id));
    if (!d || !t) return;
    window.open('https://wa.me/' + numeroWhatsApp(d.phone) + '?text=' + encodeURIComponent(personnaliser(t, d)), '_blank', 'noopener');
    noterFait('wa', d.id);
    afficherListe();
    $('mg-wa-etat').textContent = `Ouvert pour ${d.full_name || d.phone}. Appuyez sur « Envoyer » dans WhatsApp, puis revenez ici pour la personne suivante.`;
    majBoutons();
  }

  async function copierNumeros() {
    const nums = choisis().map(d => d.phone).filter(p => numeroWhatsApp(p));
    try { await navigator.clipboard.writeText(nums.join('\n')); $('mg-wa-etat').textContent = `${nums.length} numéro(s) copié(s).`; }
    catch (e) { $('mg-wa-etat').textContent = nums.join(', '); }
  }

  $('mg-source').addEventListener('change', remplirStatuts);
  $('mg-statut').addEventListener('change', () => { remplirTypes(); proposerModele(); viderListe(); });
  $('mg-type').addEventListener('change', proposerModele);
  $('mg-casting').addEventListener('change', () => { if ($('mg-casting').value) void charger(); else viderListe(); });
  $('mg-charger').addEventListener('click', () => void charger());
  $('mg-liste').addEventListener('change', (e) => { const i = e.target.dataset.i; if (i !== undefined) { destinataires[i].choisi = e.target.checked; majApercu(); majBoutons(); } });
  $('mg-message').addEventListener('input', () => { majInfos(); majApercu(); majBoutons(); });
  ['mg-date', 'mg-heure', 'mg-lieu'].forEach(id => $(id).addEventListener('input', () => { retenirInfos(); if (destinataires.length) afficherListe(); else { majApercu(); majBoutons(); } }));
  $('mg-email').addEventListener('click', envoyerEmails);
  $('mg-wa-suivant').addEventListener('click', whatsappSuivant);
  $('mg-wa-copier').addEventListener('click', copierNumeros);
  $('mg-tout').addEventListener('click', () => { const tous = !choisis().length || choisis().length < destinataires.length; destinataires.forEach(d => { d.choisi = tous; }); afficherListe(); });

  function demarrer() { if (typeof DOSSIERS === 'undefined' || typeof sb === 'undefined') return setTimeout(demarrer, 300); initialiserInfos(); remplirStatuts(); void chargerCastings(); }
  demarrer();
})();
