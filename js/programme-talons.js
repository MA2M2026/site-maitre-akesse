// Page « Mon programme » d'une élève de l'Atelier Talons & Élégance (programme.html, 13/11/2026, maquette validée par
// la propriétaire). Le lien personnel (?j=jeton) envoyé sur WhatsApp montre, sans compte : sa photo, un calendrier du
// mois avec ses jours de cours, ses séances (date, heure, thème, lieu), le lieu avec l'itinéraire, ce qu'il faut
// prévoir, et « Ajouter à mon calendrier » (fichier .ics : toutes les séances, avec un rappel la veille).
// Lecture : talons_programme_lire (supabase-talons-programme.sql) — seulement une inscription payée. Rien de la base
// n'est lu comme du HTML (textContent).
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const jeton = new URLSearchParams(location.search).get('j') || '';
  const FUSEAU = { timeZone: 'Africa/Abidjan' };
  const FORMULES = { groupe: 'En groupe', prive_salle: 'Cours privés en salle', prive_exterieur: 'Cours privés à domicile' };
  const el = (tag, classe, texte) => { const e = document.createElement(tag); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; };
  // « 15 h », « 15 h 30 » (Abidjan : heure universelle)
  const heure = (iso) => { const d = new Date(iso), h = d.getUTCHours(), m = d.getUTCMinutes(); return h + ' h' + (m ? ' ' + String(m).padStart(2, '0') : ''); };
  const jourCle = (iso) => new Date(iso).toISOString().slice(0, 10);  // (Abidjan : heure universelle)
  function introuvable() {
    $('pg-etat').textContent = 'Ce programme est introuvable ou pas encore prêt : vérifiez le lien, ou écrivez à l’agence sur WhatsApp (+225 05 45 65 66 87).';
  }
  if (!/^[0-9a-f-]{36}$/.test(jeton) || typeof SUPABASE_URL === 'undefined') { introuvable(); return; }

  fetch(SUPABASE_URL + '/rest/v1/rpc/talons_programme_lire', {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_jeton: jeton })
  }).then((r) => (r.ok ? r.json() : null)).then((p) => {
    if (!p || !p.prenom) { introuvable(); return; }
    afficher(p);
  }).catch(introuvable);

  function afficher(p) {
    const seances = Array.isArray(p.seances) ? p.seances : [];
    $('pg-etat').hidden = true; $('pg-contenu').hidden = false;
    $('pg-titre').textContent = 'Bienvenue, ' + p.prenom;
    $('pg-formule').textContent = (FORMULES[p.formule] || 'Atelier') + ' · ' + seances.length + ' séance' + (seances.length > 1 ? 's' : '');
    $('pg-ini').textContent = String(p.nom || p.prenom).split(/\s+/).map((m) => m.charAt(0)).join('').slice(0, 2).toUpperCase();
    if (typeof p.photo === 'string' && /^https:\/\//.test(p.photo)) {
      const img = new Image(); img.alt = ''; img.referrerPolicy = 'no-referrer';
      img.onload = () => $('pg-portrait').appendChild(img);
      img.src = p.photo;
    }
    // le calendrier de chaque mois qui a des séances
    const parJour = {}; seances.forEach((s) => { parJour[jourCle(s.debut)] = s; });
    const mois = [...new Set(seances.map((s) => s.debut.slice(0, 7)))];
    const zone = $('pg-calendriers');
    const aujourdhui = new Date().toISOString().slice(0, 10);
    mois.forEach((m) => {
      const [a, mo] = m.split('-').map(Number);
      const bloc = el('div', 'pg-mois');
      const tete = el('div', 'pg-cal-tete');
      tete.appendChild(el('b', '', new Date(Date.UTC(a, mo - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })));
      const nb = seances.filter((s) => s.debut.slice(0, 7) === m).length;
      tete.appendChild(el('span', '', nb + ' séance' + (nb > 1 ? 's' : '')));
      bloc.appendChild(tete);
      const cal = el('div', 'pg-cal');
      ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].forEach((j) => cal.appendChild(el('div', 'j', j)));
      const premier = (new Date(Date.UTC(a, mo - 1, 1)).getUTCDay() + 6) % 7, derniers = new Date(Date.UTC(a, mo, 0)).getUTCDate();
      for (let i = 0; i < premier; i++) cal.appendChild(el('div', 'd vide'));
      for (let d = 1; d <= derniers; d++) {
        const cle = m + '-' + String(d).padStart(2, '0'), s = parJour[cle];
        const c = el('div', 'd' + (s ? ' cours' : '') + (s && s.statut === 'faite' ? ' faite' : '') + (cle === aujourdhui ? ' auj' : ''), String(d));
        if (s) c.title = heure(s.debut) + ' – ' + heure(s.fin);
        cal.appendChild(c);
      }
      bloc.appendChild(cal); zone.appendChild(bloc);
    });
    const plages = [...new Set(seances.map((s) => heure(s.debut) + ' – ' + heure(s.fin)))];
    $('pg-heures').textContent = plages.length === 1 ? '👠 ' + plages[0] : '';
    // les séances
    const liste = $('pg-seances');
    seances.forEach((s, i) => {
      const d = new Date(s.debut);
      const ligne = el('div', 'pg-seance' + (s.statut === 'faite' ? ' faite' : ''));
      const date = el('div', 'pg-date');
      date.appendChild(el('small', '', d.toLocaleDateString('fr-FR', Object.assign({ weekday: 'short' }, FUSEAU)).replace('.', '')));
      date.appendChild(el('b', '', d.toLocaleDateString('fr-FR', Object.assign({ day: 'numeric' }, FUSEAU))));
      date.appendChild(el('small', '', d.toLocaleDateString('fr-FR', Object.assign({ month: 'short' }, FUSEAU)).replace('.', '')));
      const t = el('div', 't');
      t.appendChild(el('b', '', 'Séance ' + (i + 1) + (s.theme ? ' · ' + s.theme : '')));
      t.appendChild(el('span', '', heure(s.debut) + ' – ' + heure(s.fin) + (s.lieu ? ' · ' + s.lieu : '')));
      ligne.appendChild(date); ligne.appendChild(t); liste.appendChild(ligne);
    });
    if (!seances.length) liste.appendChild(el('p', '', 'Vos dates arrivent très bientôt : l’agence vous les confirme sur WhatsApp.'));
    // les lieux (la salle, ou l'adresse convenue)
    const lieux = [...new Set(seances.map((s) => s.lieu).filter(Boolean))];
    if (!lieux.length) lieux.push([p.salle_nom, p.salle_adresse].filter(Boolean).join(', '));
    lieux.forEach((l) => {
      const b = el('div', 'pg-lieu'); b.appendChild(el('div', 'ic', '📍'));
      const txt = el('div'); txt.appendChild(el('b', '', l)); txt.appendChild(el('br'));
      const salle = p.salle_maps && l.indexOf(p.salle_nom) === 0;
      const a = el('a', 'pg-lien', 'Itinéraire Google Maps ↗');
      a.href = salle ? p.salle_maps : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l + ', Abidjan');
      a.target = '_blank'; a.rel = 'noopener';
      txt.appendChild(a); b.appendChild(txt); $('pg-lieux').appendChild(b);
    });
    (Array.isArray(p.a_prevoir) ? p.a_prevoir : []).forEach((x) => $('pg-prevoir').appendChild(el('span', '', x)));
    $('pg-ajouter').hidden = !seances.length;
    $('pg-ajouter').addEventListener('click', () => telechargerCalendrier(p, seances));
  }

  // ---------- « Ajouter à mon calendrier » : un fichier .ics (iPhone, Android, Google Agenda, Outlook) ----------
  const ics = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const echap = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
  function telechargerCalendrier(p, seances) {
    const maintenant = ics(new Date().toISOString());
    const evts = seances.filter((s) => s.statut !== 'faite').map((s, i) => [
      'BEGIN:VEVENT', 'UID:talons-' + jeton + '-' + i + '@maitreakessemodelmanagement.com', 'DTSTAMP:' + maintenant,
      'DTSTART:' + ics(s.debut), 'DTEND:' + ics(s.fin),
      'SUMMARY:' + echap('👠 Cours de talons' + (s.theme ? ' · ' + s.theme : '') + ' (MA2M)'),
      'LOCATION:' + echap(s.lieu || p.salle_adresse || ''),
      'DESCRIPTION:' + echap('Atelier Talons & Élégance, Maître Akesse Model Management. À prévoir : ' + (p.a_prevoir || []).join(', ') + '. Votre programme : ' + location.href),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + echap('Cours de talons demain'), 'TRIGGER:-P1D', 'END:VALARM',
      'END:VEVENT'].join('\r\n'));
    const texte = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Maitre Akesse Model Management//Atelier Talons//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'].concat(evts, ['END:VCALENDAR']).join('\r\n');
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([texte], { type: 'text/calendar;charset=utf-8' }));
    lien.download = 'cours-de-talons-ma2m.ics';
    document.body.appendChild(lien); lien.click(); lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
  }
})();
