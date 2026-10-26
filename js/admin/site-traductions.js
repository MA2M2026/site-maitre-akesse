// Nouvelle Administration — « Traductions anglaises » (26/10/2026, demande de la propriétaire).
// Les textes saisis dans l'Administration (actualités, événements, agenda, partenaires, mot du
// fondateur, présentations des mannequins) ont leur version anglaise, affichée sur les pages
// anglaises du site (versAnglais, js/app.js ; table traductions_en, supabase-traductions.sql).
// Ici : la liste des textes, ceux qui restent à traduire d'abord, et l'écran pour écrire ou
// corriger l'anglais (même éditeur que les actualités pour les textes mis en forme).
(function () {
  'use strict';
  const P = window.Portail;
  if (!P || !P.espaces.site) return;
  const PAGE = 'b3c-traductions';
  const PAS_ACTIVE = '<div class="carte vide">Les traductions anglaises ne sont pas encore activées : exécutez une fois le fichier supabase-traductions.sql dans Supabase.</div>';
  const nonActive = P.pasActivee('traductions_en|traduction_');  // (js/portail/noyau.js)
  // d'où viennent les textes : [table, champs, libellé, sélection, titre de la ligne]
  const SOURCES = [
    ['actualites', ['titre', 'commentaire'], 'Actualité', (q) => q.order('created_at', { ascending: false }), (l) => l.titre],
    ['evenements', ['titre', 'lieu', 'description'], 'Événement', (q) => q.order('created_at', { ascending: false }), (l) => l.titre],
    ['agenda_projets', ['titre', 'lieu', 'description'], 'Agenda', (q) => q.eq('visible', true).order('date_debut', { ascending: false }).limit(60), (l) => l.titre],
    ['partenaires', ['structure', 'evenement', 'role', 'description'], 'Partenaire', (q) => q.order('created_at', { ascending: false }), (l) => l.structure || l.nom],
    ['mot_responsable', ['titre', 'message'], 'Mot du fondateur', (q) => q, () => 'Mot du fondateur'],
    ['model_profiles', ['bio'], 'Présentation', (q) => q.eq('published', true).order('full_name'), (l) => l.full_name],
    ['model_projects', ['type_projet'], 'Type d’expérience', (q) => q.limit(1000), () => 'Fiches des mannequins']
  ];
  const NOMS_CHAMPS = { titre: 'titre', commentaire: 'texte', lieu: 'lieu', description: 'texte', structure: 'nom', evenement: 'événement', role: 'rôle', message: 'message', bio: 'présentation', type_projet: 'type' };
  const miseEnForme = (t) => /<\/?(p|h[1-6]|strong|em|ol|ul|li|br)\b/i.test(t);
  let textes = null;   // [{ fr, cle, en, origine, champ }]
  let ecrit = null;    // { t, editeur }

  async function charger() {
    const lectures = await Promise.all(SOURCES.map(([table, champs, , choix]) =>
      P.bd(choix(sb.from(table).select('*'))).catch(() => [])));
    const vus = new Map();
    lectures.forEach((lignes, i) => {
      const [, champs, libelle, , titre] = SOURCES[i];
      lignes.forEach((l) => champs.forEach((c) => {
        const fr = typeof l[c] === 'string' ? l[c] : '';  // (texte exact : même empreinte que la page anglaise)
        if (!fr.trim() || vus.has(fr)) return;
        vus.set(fr, { fr, origine: libelle + ' · ' + (titre(l) || ''), champ: NOMS_CHAMPS[c] || c });
      }));
    });
    const liste = [...vus.values()];
    const en = await window.traductionsDe(liste.map((t) => t.fr));  // (js/app.js, comme les pages anglaises)
    await Promise.all(liste.map(async (t) => { t.cle = await window.empreinteTexte(t.fr); t.en = en.get(t.fr) || ''; }));
    // à traduire d'abord
    textes = liste.sort((a, b) => (a.en ? 1 : 0) - (b.en ? 1 : 0));
  }

  const apercu = (t) => { const d = document.createElement('div'); d.innerHTML = rendreContenuRiche(t); return d.textContent.replace(/\s+/g, ' ').trim(); };  // (js/app.js)
  async function liste() {
    await charger();
    const reste = textes.filter((t) => !t.en).length;
    return P.entete('Traductions anglaises') +
      '<p class="doux">Les textes de l’Administration s’affichent en anglais sur les pages anglaises du site. Sans traduction, le français reste. ' +
      (reste ? '<b>' + P.pluriel(reste, 'texte', 'textes') + ' à traduire.</b>' : '<b>Tout est traduit ✅</b>') + '</p>' +
      P.tableau(['Texte', 'Français', 'État', ''], textes.map((t) =>
        '<tr><td><b>' + P.esc(t.origine) + '</b><div class="petit-texte doux">' + P.esc(t.champ) + '</div></td>' +
        '<td class="petit-texte">' + P.esc(apercu(t.fr).slice(0, 110)) + '</td>' +
        '<td>' + (t.en ? P.pastille('Traduit', 'ok') : P.pastille('À traduire', 'alerte')) + '</td>' +
        '<td><a class="btn" href="#/site/' + PAGE + '/' + t.cle + '">' + (t.en ? 'Corriger' : 'Traduire') + '</a></td></tr>'));
  }

  async function fiche(cle) {
    if (!textes) await charger();
    const t = textes.find((x) => x.cle === cle);
    if (!t) return P.entete('Traductions anglaises') + '<div class="carte vide">Ce texte n’existe plus. <a href="#/site/' + PAGE + '">Retour à la liste</a></div>';
    ecrit = { t, editeur: null };
    const riche = miseEnForme(t.fr);
    return P.entete('Traduire en anglais', '<a class="btn" href="#/site/' + PAGE + '">← Tous les textes</a>') +
      '<div class="carte"><p class="sur-titre">' + P.esc(t.origine) + ' · ' + P.esc(t.champ) + '</p><h3>Français</h3><div class="contenu-riche">' + rendreContenuRiche(t.fr) + '</div></div>' +
      '<form class="carte f" data-form="traduction-enregistrer"><h3 class="large">Anglais</h3>' +
      (riche ? '<div class="large"><div id="tr-editeur" class="editeur-riche"></div></div>'
        : '<label class="fl large" for="tr-en">Texte anglais<textarea id="tr-en" name="en" rows="' + Math.min(14, 3 + Math.ceil(t.fr.length / 90)) + '" maxlength="20000">' + P.esc(t.en) + '</textarea></label>') +
      '<div class="ligne large"><button class="btn rouge" type="submit">Enregistrer</button>' +
      (t.en ? '<button class="btn" type="button" data-action="traduction-retirer">Retirer la traduction</button>' : '') + '</div></form>';
  }
  async function apresFiche() {
    if (!ecrit || !document.getElementById('tr-editeur')) return;
    await P.outilsRedaction();  // (Quill et DOMPurify, js/admin/site-contenu.js)
    ecrit.editeur = creerEditeurRiche('tr-editeur', 'Écrivez ici la version anglaise…');  // (js/app.js)
    if (ecrit.t.en) chargerContenuDansEditeur(ecrit.editeur, ecrit.t.en);
  }

  async function enregistrer(en) {
    await P.rpc('traduction_enregistrer', { p_fr: ecrit.t.fr, p_en: en });
    ecrit.t.en = en;
    P.message(en ? 'Traduction enregistrée : la page anglaise l’affiche déjà.' : 'Traduction retirée : la page anglaise affiche le français.');
    location.hash = '#/site/' + PAGE;
  }
  P.formulaires['traduction-enregistrer'] = async (champs) => {
    if (!ecrit) return;
    const en = ecrit.editeur ? lireContenuEditeur(ecrit.editeur) : String(champs.get('en') || '');
    if (!apercu(en)) { P.message('Écrivez la version anglaise (ou utilisez « Retirer la traduction »).'); return; }
    await enregistrer(en.trim());
  };
  P.actions['traduction-retirer'] = async () => {
    if (ecrit && confirm('Retirer cette traduction ? La page anglaise affichera le texte français.')) await enregistrer('');
  };

  P.espaces.site.pages[PAGE] = (m) => ((m && m[0]) ? fiche(decodeURIComponent(m[0])) : liste()).catch((e) => {
    if (nonActive(e)) return P.entete('Traductions anglaises') + PAS_ACTIVE;
    throw e;
  });
  P.espaces.site.apres[PAGE] = () => apresFiche();
})();
