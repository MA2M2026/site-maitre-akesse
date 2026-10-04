// Brouillon automatique des formulaires de candidature et d'inscription (cahier des
// charges, étape 6). Pendant que le candidat remplit le formulaire, ses réponses sont
// gardées sur SON appareil (localStorage, rien n'est envoyé) : s'il quitte la page —
// appel, coupure, onglet fermé — il les retrouve en revenant.
//   - Fichiers (photos, vidéo), mots de passe et codes ne sont jamais gardés.
//   - Le brouillon est effacé dès que l'envoi a réussi (formulaire vidé ou masqué
//     par la page) ou avec le bouton « Tout effacer ». Il expire après 7 jours.
// Formulaires concernés : #form-casting (casting, intégrer l'agence) et
// #form-inscription (inscription), en français et en anglais.
(function () {
  const FORMULAIRES = ['form-casting', 'form-inscription'];
  const DUREE_MAX = 7 * 24 * 3600 * 1000;
  const anglais = (document.documentElement.lang || '').indexOf('en') === 0;
  const T = anglais
    ? { retrouve: 'Your previous answers have been restored (draft saved on this device). Photos and video need to be added again.', effacer: 'Clear all' }
    : { retrouve: 'Vos réponses précédentes ont été retrouvées (brouillon gardé sur cet appareil). Les photos et la vidéo sont à ajouter à nouveau.', effacer: 'Tout effacer' };

  function lire(cle) { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (e) { return null; } }
  function ecrire(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) {} }
  function supprimer(cle) { try { localStorage.removeItem(cle); } catch (e) {} }

  // Champs gardés : tout sauf fichiers, mots de passe, codes et champs sans identifiant.
  function champsGardes(form) {
    return Array.from(form.querySelectorAll('input, select, textarea')).filter(c =>
      c.id && !/^(file|password|submit|button|hidden)$/i.test(c.type || '') &&
      !/code/i.test(c.id) && c.autocomplete !== 'one-time-code');
  }

  function valeur(c) { return c.type === 'checkbox' || c.type === 'radio' ? (c.checked ? '1' : '') : c.value; }
  function appliquer(c, v) {
    if (c.type === 'checkbox' || c.type === 'radio') {
      if (c.disabled) return false;
      c.checked = v === '1';
    } else {
      if (c.tagName === 'SELECT' && v !== '' && !Array.from(c.options).some(o => o.value === v)) return false;
      c.value = v;
    }
    c.dispatchEvent(new Event('input', { bubbles: true }));
    c.dispatchEvent(new Event('change', { bubbles: true }));
    return (c.type === 'checkbox' || c.type === 'radio') ? true : c.value === v;
  }

  function demarrer(form) {
    const cle = 'ma2m_brouillon_' + location.pathname.replace(/\.html$/, '') + '_' + form.id;
    let restauration = true;   // pendant la restauration, on n'écrase pas le brouillon
    let envoye = false;
    // Valeurs de départ (indicatif +225 déjà choisi, etc.) : seul ce que le visiteur a
    // réellement changé compte — sinon un formulaire jamais touché créerait un brouillon.
    const depart = {};
    champsGardes(form).forEach(c => { depart[c.id] = valeur(c); });

    function sauver() {
      if (restauration || envoye) return;
      const donnees = {};
      let rempli = false;
      champsGardes(form).forEach(c => {
        const v = valeur(c);
        if (v === '' || (c.id in depart && v === depart[c.id] && !(c.id in (dernier || {})))) return;
        donnees[c.id] = v;
        if (c.type !== 'checkbox' && c.type !== 'radio' && v !== depart[c.id]) rempli = true;
      });
      if (rempli) ecrire(cle, { t: Date.now(), d: donnees }); else supprimer(cle);
    }
    let minuteur = null;
    function sauverBientot() { clearTimeout(minuteur); minuteur = setTimeout(sauver, 400); }
    form.addEventListener('input', sauverBientot);
    form.addEventListener('change', sauverBientot);
    window.addEventListener('pagehide', sauver);

    // Envoi réussi : la page vide le formulaire (reset) ou le masque → brouillon effacé.
    function effacer() { clearTimeout(minuteur); supprimer(cle); const b = document.getElementById(form.id + '-brouillon'); if (b) b.remove(); }
    form.addEventListener('submit', () => {
      const surveiller = new MutationObserver(() => {
        if (form.style.display === 'none') { envoye = true; effacer(); surveiller.disconnect(); }
      });
      surveiller.observe(form, { attributes: true, attributeFilter: ['style', 'class'] });
      setTimeout(() => surveiller.disconnect(), 10 * 60 * 1000);
    });
    form.addEventListener('reset', () => { envoye = true; effacer(); setTimeout(() => { envoye = false; }, 1500); });

    // Restauration (dans l'ordre de la page, pour que les listes qui dépendent d'un
    // autre choix — commune, classe, taille… — soient remplies avant d'être relues).
    const brouillon = lire(cle);
    var dernier = brouillon && brouillon.d;
    if (!brouillon || !brouillon.d || Date.now() - brouillon.t > DUREE_MAX) {
      if (brouillon) supprimer(cle);
      restauration = false;
      return;
    }
    let restants = Object.assign({}, brouillon.d);
    function passe() {
      champsGardes(form).forEach(c => {
        if (!(c.id in restants)) return;
        if (appliquer(c, restants[c.id])) delete restants[c.id];
      });
    }
    passe();
    // Certaines listes se remplissent plus tard (castings ouverts, indicatifs…).
    [800, 2000, 4500].forEach(ms => setTimeout(() => { if (Object.keys(restants).length) passe(); }, ms));
    setTimeout(() => { restauration = false; sauver(); }, 5000);

    const bandeau = document.createElement('div');
    bandeau.id = form.id + '-brouillon';
    bandeau.className = 'brouillon-bandeau';
    bandeau.setAttribute('role', 'status');
    const texte = document.createElement('span');
    texte.textContent = '📝 ' + T.retrouve;
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'btn brouillon-effacer';
    bouton.textContent = T.effacer;
    bouton.addEventListener('click', () => { envoye = true; effacer(); location.reload(); });
    bandeau.appendChild(texte);
    bandeau.appendChild(bouton);
    form.insertBefore(bandeau, form.firstChild);
  }

  function lancer() { FORMULAIRES.forEach(id => { const f = document.getElementById(id); if (f) { try { demarrer(f); } catch (e) {} } }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer); else lancer();
})();
