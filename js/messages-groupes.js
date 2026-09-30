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
//   - « {prénom} » et « {casting} » dans le message sont remplacés pour chaque personne.
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

  function conf() { return DOSSIERS[$('mg-source').value]; }
  function prenom(d) { return String(d.full_name || '').trim().split(/\s+/)[0] || ''; }
  function casting(d) {
    if (d.type_candidature === 'projet') return d.projet_nom || 'notre casting';
    if (d.type_candidature === 'agence') return "l'intégration de l'agence";
    return 'notre agence';
  }
  function personnaliser(texte, d) {
    return texte.replace(/\{pr[ée]nom\}/gi, prenom(d) || 'Madame, Monsieur').replace(/\{casting\}/gi, casting(d));
  }
  function echapper(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function numeroWa(tel) { return String(tel || '').replace(/[^\d]/g, ''); }

  // Suivi des envois déjà faits pour CE message (même texte = même envoi), sur cet appareil.
  function cleSuivi(canal) {
    const t = $('mg-message').value.trim();
    let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    return 'ma2m_mg_' + canal + '_' + h;
  }
  function dejaFaits(canal) { try { return new Set(JSON.parse(localStorage.getItem(cleSuivi(canal)) || '[]')); } catch (e) { return new Set(); } }
  function noterFait(canal, id) { const s = dejaFaits(canal); s.add(id); try { localStorage.setItem(cleSuivi(canal), JSON.stringify([...s])); } catch (e) {} }

  function remplirStatuts() {
    const c = conf();
    $('mg-statut').innerHTML = c.statuts.map(s => `<option value="${echapper(s)}">${echapper(c.libellesStatut[s] || s)}</option>`).join('');
    $('mg-statut').value = c.statuts.includes('retenue') ? 'retenue' : c.statuts.includes('payée') ? 'payée' : c.statuts[0];
    $('mg-champ-casting').style.display = $('mg-source').value === 'casting' ? '' : 'none';
    $('mg-casting').innerHTML = '<option value="">Tous les castings</option>';
    viderListe();
  }

  function viderListe() {
    destinataires = [];
    $('mg-liste').innerHTML = '';
    $('mg-resume').textContent = 'Choisissez le groupe puis appuyez sur « Afficher les destinataires ».';
    majApercu(); majBoutons();
  }

  async function charger() {
    const c = conf();
    $('mg-resume').textContent = 'Chargement…';
    const lignes = [];
    for (let depart = 0; ; depart += 1000) {
      const { data, error } = await sb.from(c.table).select(CHAMPS[$('mg-source').value])
        .eq(c.statutChamp, $('mg-statut').value).order('created_at', { ascending: true }).range(depart, depart + 999);
      if (error) { $('mg-resume').textContent = 'Erreur : ' + error.message; return; }
      lignes.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    // Liste des castings présents dans ce groupe (pour filtrer par casting).
    if ($('mg-source').value === 'casting') {
      const choixActuel = $('mg-casting').value;
      const noms = [...new Set(lignes.map(casting))].sort();
      $('mg-casting').innerHTML = '<option value="">Tous les castings</option>' + noms.map(n => `<option value="${echapper(n)}">${echapper(n)}</option>`).join('');
      if (noms.includes(choixActuel)) $('mg-casting').value = choixActuel;
    }
    const filtreCasting = $('mg-source').value === 'casting' ? $('mg-casting').value : '';
    destinataires = lignes.filter(d => !filtreCasting || casting(d) === filtreCasting).map(d => Object.assign(d, { choisi: true }));
    afficherListe();
  }

  function afficherListe() {
    const avecEmail = destinataires.filter(d => d.email).length;
    const avecWa = destinataires.filter(d => numeroWa(d.phone)).length;
    $('mg-resume').textContent = destinataires.length
      ? `${destinataires.length} personne(s) — ${avecEmail} avec e-mail, ${avecWa} avec numéro WhatsApp. Décochez celles à qui vous ne voulez pas écrire.`
      : 'Personne dans ce groupe.';
    $('mg-liste').innerHTML = destinataires.map((d, i) => `
      <label class="mg-personne">
        <input type="checkbox" data-i="${i}" ${d.choisi ? 'checked' : ''}>
        <span class="mg-nom">${echapper(d.full_name || '—')}</span>
        <span class="mg-infos">${echapper([d.email, d.phone].filter(Boolean).join(' · ') || 'aucun contact')}</span>
      </label>`).join('');
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
    const faitsMail = dejaFaits('email'), faitsWa = dejaFaits('wa');
    const restantMail = liste.filter(d => d.email && !faitsMail.has(d.id)).length;
    const restantWa = liste.filter(d => numeroWa(d.phone) && !faitsWa.has(d.id));
    $('mg-email').disabled = !t || !restantMail;
    $('mg-email').textContent = restantMail ? `📧 Envoyer par e-mail à ${restantMail} personne(s)` : '📧 Envoyer par e-mail';
    $('mg-wa-copier').disabled = !liste.some(d => numeroWa(d.phone));
    const suivant = restantWa[0];
    $('mg-wa-suivant').disabled = !t || !suivant;
    $('mg-wa-suivant').textContent = suivant
      ? `💬 Ouvrir WhatsApp pour ${suivant.full_name || suivant.phone} (${liste.filter(d => numeroWa(d.phone)).length - restantWa.length + 1}/${liste.filter(d => numeroWa(d.phone)).length})`
      : (liste.some(d => numeroWa(d.phone)) && t ? '✓ WhatsApp : tout le monde a été fait' : '💬 Ouvrir WhatsApp pour la personne suivante');
  }

  async function envoyerEmails() {
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
        await envoyerEmailCandidat({ to_email: d.email, to_name: prenom(d), message: personnaliser(t, d) });
        noterFait('email', d.id); ok++;
      } catch (e) {
        echecs.push((d.full_name || d.email) + (e && e.text ? ' (' + e.text + ')' : ''));
      }
      if (i < liste.length - 1) await new Promise(r => setTimeout(r, 1100));
    }
    etat.className = echecs.length ? 'form-msg err' : 'form-msg ok';
    etat.style.whiteSpace = 'pre-line';
    etat.textContent = `✓ ${ok} e-mail(s) envoyé(s).` + (echecs.length ? `\n${echecs.length} échec(s) — vous pouvez rappuyer pour réessayer uniquement ceux-là :\n` + echecs.join('\n') : '');
    majBoutons();
  }

  function whatsappSuivant() {
    const t = $('mg-message').value.trim();
    const faits = dejaFaits('wa');
    const d = choisis().find(x => numeroWa(x.phone) && !faits.has(x.id));
    if (!d || !t) return;
    window.open('https://wa.me/' + numeroWa(d.phone) + '?text=' + encodeURIComponent(personnaliser(t, d)), '_blank', 'noopener');
    noterFait('wa', d.id);
    $('mg-wa-etat').textContent = `Ouvert pour ${d.full_name || d.phone}. Appuyez sur « Envoyer » dans WhatsApp, puis revenez ici pour la personne suivante.`;
    majBoutons();
  }

  async function copierNumeros() {
    const nums = choisis().map(d => d.phone).filter(p => numeroWa(p));
    try { await navigator.clipboard.writeText(nums.join('\n')); $('mg-wa-etat').textContent = `${nums.length} numéro(s) copié(s).`; }
    catch (e) { $('mg-wa-etat').textContent = nums.join(', '); }
  }

  $('mg-source').addEventListener('change', remplirStatuts);
  $('mg-statut').addEventListener('change', viderListe);
  $('mg-casting').addEventListener('change', () => { if (destinataires.length || $('mg-casting').value) charger(); });
  $('mg-charger').addEventListener('click', charger);
  $('mg-liste').addEventListener('change', (e) => { const i = e.target.dataset.i; if (i !== undefined) { destinataires[i].choisi = e.target.checked; majApercu(); majBoutons(); } });
  $('mg-message').addEventListener('input', () => { majApercu(); majBoutons(); });
  $('mg-email').addEventListener('click', envoyerEmails);
  $('mg-wa-suivant').addEventListener('click', whatsappSuivant);
  $('mg-wa-copier').addEventListener('click', copierNumeros);
  $('mg-tout').addEventListener('click', () => { const tous = !choisis().length || choisis().length < destinataires.length; destinataires.forEach(d => { d.choisi = tous; }); afficherListe(); });

  function demarrer() { if (typeof DOSSIERS === 'undefined') return setTimeout(demarrer, 300); remplirStatuts(); }
  demarrer();
})();
