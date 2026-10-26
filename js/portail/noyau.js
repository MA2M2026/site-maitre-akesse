// Portail d'administration /admin — cœur de l'application (cahier des charges v2.3).
// Connexion (mot de passe + double authentification obligatoire), coque (menu sombre à
// gauche), écran des trois tuiles, navigation, outils d'affichage partagés par les espaces
// (js/admin/site.js et ses pièces, espace-paiements.js, espace-compta.js, securite.js).
// Toutes les données viennent de Supabase (client `sb`, js/supabase-config.js) ; les droits
// sont vérifiés par la base elle-même (RLS, fonctions de supabase-portail.sql) : l'écran ne
// fait que masquer ce qui serait de toute façon refusé.
(function () {
  'use strict';
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const ROLES = { principal: 'Administrateur principal', site: 'Administrateur du site', caisse: 'Responsable des encaissements', compta: 'Comptable' };
  const ESPACES = { site: 'Administration du site', paiements: 'Suivi des paiements et des inscriptions', compta: 'Comptabilité' };
  const SESSION_MAX_MS = window.SESSION_MAX_PORTAIL_MS; // session de 8 heures au plus (js/portail/inactivite.js)

  const P = window.Portail = {
    MOIS, ROLES, ESPACES,
    espaces: {},        // rempli par les fichiers d'espace : { nav: [[page, libellé]], pages: { page: async () => html } }
    actions: {},        // data-action="nom" → P.actions.nom(élément, évènement)
    formulaires: {},    // data-form="nom" → P.formulaires.nom(FormData, formulaire)
    changements: {},    // data-change="nom" → P.changements.nom(élément)
    moi: null,
    etat: {}
  };
  const app = () => document.getElementById('app');

  // ---------- outils d'affichage ----------
  P.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Logo de l'agence (version claire, pour les fonds sombres) à la place du texte « M A 2 M »
  P.logo = (classe) => '<img class="logo-portail ' + classe + '" src="/assets/logo-header.png" width="600" height="182" alt="Maître Akesse Model Management">';
  P.fcfa = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  // Âge en années à partir d'une date 'AAAA-MM-JJ' (null si absente)
  P.age = (d) => window.ageMannequin(d);  // js/messages-mensualites.js
  P.date = (d) => { if (!d) return '—'; const s = String(d).slice(0, 10).split('-'); return s[2] + '/' + s[1] + '/' + s[0]; };
  P.dateHeure = (d) => d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'short', timeStyle: 'short' }) : '—';
  P.mois = (d) => { const s = String(d).slice(0, 7).split('-'); return MOIS[Number(s[1]) - 1] + ' ' + s[0]; };
  P.moisCourant = () => new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Abidjan' }).slice(0, 7) + '-01';
  P.aujourdhui = () => new Date().toLocaleDateString('fr-CA', { timeZone: 'Africa/Abidjan' });
  // Une partie pas encore activée dans Supabase (table ou fonction absente) : motif = noms propres à
  // cette partie ; toute autre erreur (connexion…) reste une vraie erreur
  P.pasActivee = (motif) => (e) => new RegExp(motif + '|42P01|PGRST20[25]').test(String((e && (e.message || e.code)) || e));
  // Choix d'une période : 'AAAA-MM' (un mois) ou 'AAAA' (une année) → bornes [debut, fin[ ('AAAA-MM-JJ')
  P.bornesPeriode = (c) => {
    if (/^\d{4}$/.test(c)) return { debut: c + '-01-01', fin: (Number(c) + 1) + '-01-01', titre: 'année ' + c };
    const [a, m] = c.split('-').map(Number);
    return { debut: c + '-01', fin: (m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0')) + '-01', titre: P.mois(c + '-01') };
  };
  // … et la liste à proposer : les 12 derniers mois et les 2 dernières années
  P.choixPeriodes = () => {
    const l = [], d = new Date(P.moisCourant() + 'T00:00:00Z');
    for (let i = 0; i < 12; i++) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)); l.push([x.toISOString().slice(0, 7), P.mois(x.toISOString())]); }
    const an = d.getUTCFullYear();
    l.push([String(an), 'Toute l’année ' + an], [String(an - 1), 'Toute l’année ' + (an - 1)]);
    return l;
  };
  P.pastille = (texte, ton) => '<span class="pastille ' + (ton || 'neutre') + '">' + P.esc(texte) + '</span>';
  P.chiffre = (libelle, valeur, couleur) => '<div class="carte chiffre"><div class="l">' + P.esc(libelle) + '</div><div class="v ' + (couleur || '') + '">' + valeur + '</div></div>';
  P.barre = (libelle, valeur, max, rouge, texte) => '<div class="barre"><div class="t"><span>' + P.esc(libelle) + '</span><span>' + (texte || P.fcfa(valeur)) +
    '</span></div><div class="piste"><div class="rempli' + (rouge ? ' rouge' : '') + '" style="width:' + Math.max(2, Math.round(valeur / Math.max(max, 1) * 100)) + '%"></div></div></div>';
  // en-têtes commençant par « # » : colonne de nombres alignés à droite
  P.tableau = (entetes, lignes, classe) => '<div class="tableau"><table class="' + (classe || '') + '"><thead><tr>' +
    entetes.map((h) => '<th' + (h.charAt(0) === '#' ? ' class="nombre"' : '') + '>' + P.esc(h.replace(/^#/, '')) + '</th>').join('') +
    '</tr></thead><tbody>' + (lignes.length ? lignes.join('') : '<tr><td colspan="' + entetes.length + '" class="vide">Rien pour le moment.</td></tr>') + '</tbody></table></div>';
  // avant : ce qui précède le titre (photo de la mannequin d'une fiche…)
  P.entete = (titre, extra, avant) => '<div class="entete"><div><a class="retour" href="#/">← Retour au portail</a><h1>' + (avant || '') + P.esc(titre).replace(/ · /g, '\u00a0· ') + '</h1></div><div class="ligne">' + (extra || '') + '</div></div>';
  P.refuse = () => '<div class="carte"><h2>Accès refusé</h2><p class="doux">Votre rôle (' + P.esc(ROLES[P.moi && P.moi.role] || 'aucun') +
    ') ne donne pas accès à cette page. Le serveur et la base de données refusent aussi la demande.</p></div>';
  P.erreurTexte = (e) => {
    const m = String((e && (e.message || e.error_description || e.error)) || e || '');
    if (/AUTH_RECENTE/.test(m)) return 'Pour cette action, confirmez d\'abord votre code de l\'application d\'authentification.';
    if (/row-level security|permission denied|Accès refusé/i.test(m)) return 'Action refusée : votre rôle ne le permet pas.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Connexion impossible. Vérifiez votre connexion internet puis réessayez.';
    return m.replace(/^.*?ERROR:\s*/, '') || 'Une erreur est survenue.';
  };
  let minuteurMessage = 0;
  P.message = (texte) => {
    const c = document.getElementById('calque');
    c.innerHTML = '<div class="message-ephemere" role="status" title="Toucher pour fermer">' + P.esc(texte) + '</div>';
    clearTimeout(minuteurMessage);
    // un toucher le ferme ; sinon il part tout seul (un peu plus tard pour un texte long)
    c.firstChild.addEventListener('click', () => { clearTimeout(minuteurMessage); c.innerHTML = ''; });
    minuteurMessage = setTimeout(() => { c.innerHTML = ''; }, String(texte).length > 90 ? 6000 : 4500);
  };
  P.fenetre = (html) => { document.getElementById('fenetre').innerHTML = html ? '<div class="voile"><div class="boite" role="dialog" aria-modal="true">' + html + '</div></div>' : ''; };
  P.telecharger = (contenu, nom, type) => {
    const url = URL.createObjectURL(new Blob([contenu], { type: type || 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  // export CSV lisible par Excel (séparateur « ; », accents)
  P.csv = (entetes, lignes) => '﻿' + [entetes].concat(lignes).map((l) => l.map((v) => {
    const t = String(v == null ? '' : v);
    return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }).join(';')).join('\n');

  // ---------- accès aux données ----------
  // Réponse Supabase → données, ou exception avec un message compréhensible
  P.bd = async (requete) => {
    const { data, error } = await requete;
    if (error) throw error;
    return data;
  };
  // Action sensible : si la base exige un code récent, on le demande puis on recommence une fois
  P.sensible = async (faire) => {
    try { return await faire(); } catch (e) {
      if (!/AUTH_RECENTE/.test(String(e && e.message))) throw e;
      const ok = await P.confirmerCode('Action sensible : saisissez le code à 6 chiffres de votre application d\'authentification.');
      if (!ok) throw new Error('Action annulée.');
      return faire();
    }
  };
  P.rpc = (nom, params) => P.bd(sb.rpc(nom, params || {}));

  // déjà ouverte comme application (écran d'accueil) : plus besoin du bouton
  P.installee = () => window.MA2M_INSTALLATION.installee();  // (js/app.js)

  // ---------- connexion ----------
  function ecranConnexion(etape, extra) {
    const gauche = '<div class="g"><div>' + P.logo('logo-connexion') + '</div>' +
      '<div><div class="trait"></div><h1 style="font-size:32px">Espace d’administration</h1><p class="doux-sombre">Accès réservé à l’équipe de l’agence. Chaque personne a son propre compte et ne voit que ce qui relève de son rôle.</p></div>' +
      '<div class="petit-texte" style="color:var(--sombre-encre-douce)">Application installable sur téléphone et ordinateur' + (P.installee() ? '' : ' · <button class="btn petit clair" data-action="installer">Installer l’application</button>') + '</div></div>';
    let droite = '';
    if (etape === 'motdepasse') {
      droite = '<form data-form="connexion" class="grille" style="gap:14px"><div><div class="etape">Étape 1 sur 2</div><h2 style="font-size:22px">Connexion</h2></div>' +
        '<label class="fl" for="cx-mail">Adresse e-mail<input id="cx-mail" name="email" type="email" autocomplete="username" required></label>' +
        '<label class="fl" for="cx-mdp">Mot de passe<input id="cx-mdp" name="motdepasse" type="password" autocomplete="current-password" required></label>' +
        (extra ? '<div class="note erreur" role="alert">' + P.esc(extra) + '</div>' : '') +
        '<button class="btn rouge" type="submit">Continuer</button>' +
        '<button class="retour" type="button" data-action="oubli">Mot de passe oublié ?</button></form>';
    } else if (etape === 'code') {
      droite = '<form data-form="code" class="grille" style="gap:14px"><div><div class="etape">Étape 2 sur 2</div><h2 style="font-size:22px">Double authentification</h2></div>' +
        '<label class="fl" for="cx-code">Code de l’application d’authentification (6 chiffres)<input id="cx-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></label>' +
        (extra ? '<div class="note erreur" role="alert">' + P.esc(extra) + '</div>' : '') +
        '<button class="btn rouge" type="submit">Se connecter</button>' +
        '<details><summary class="petit-texte">Téléphone perdu ?</summary><p class="petit-texte doux" style="margin-top:8px">Un collaborateur demande à l’administrateur principal de réinitialiser sa double authentification. L’administrateur principal utilise un de ses codes de secours :</p>' +
        '<label class="fl" for="cx-secours" style="margin-top:8px">Code de secours<input id="cx-secours" name="secours" autocomplete="off"></label><button class="btn petit" type="button" data-action="secours" style="margin-top:8px">Utiliser le code de secours</button></details>' +
        '<button class="retour" type="button" data-action="deconnexion">Changer de compte</button></form>';
    } else if (etape === 'inscrire-code') {
      droite = '<div class="grille" style="gap:14px"><div><div class="etape">Première connexion</div><h2 style="font-size:22px">Activer la double authentification</h2></div>' +
        '<p class="doux">Obligatoire pour tous les comptes. Installez une application d’authentification (Google Authenticator, Microsoft Authenticator…), puis scannez ce code :</p>' +
        '<div id="qr-zone" class="chargement">Préparation…</div>' +
        '<form data-form="activer-code" class="grille" style="gap:12px"><label class="fl" for="cx-nouveau">Code à 6 chiffres affiché par l’application<input id="cx-nouveau" name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code"></label>' +
        (extra ? '<div class="note erreur" role="alert">' + P.esc(extra) + '</div>' : '') +
        '<button class="btn rouge" type="submit">Activer</button></form></div>';
    } else if (etape === 'verrou') {
      droite = '<form data-form="deverrouiller" class="grille" style="gap:14px"><div><div class="etape">Écran verrouillé</div><h2 style="font-size:22px">Votre code à 4 chiffres</h2></div>' +
        '<p class="doux">L’écran s’est verrouillé après 15 minutes sans activité. Saisissez le code de cet appareil.</p>' +
        '<label class="fl" for="cx-pin">Code à 4 chiffres<input id="cx-pin" name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]{4}" required></label>' +
        (extra ? '<div class="note erreur" role="alert">' + P.esc(extra) + '</div>' : '') +
        '<button class="btn rouge" type="submit">Déverrouiller</button>' +
        '<button class="retour" type="button" data-action="deconnexion">Code oublié ? Se reconnecter complètement</button></form>';
    } else if (etape === 'choisir-pin') {
      droite = '<form data-form="choisir-pin" class="grille" style="gap:14px"><div><div class="etape">Cet appareil</div><h2 style="font-size:22px">Choisissez un code à 4 chiffres</h2></div>' +
        '<p class="doux">Après 15 minutes sans activité, l’écran se verrouille. Ce code suffira alors pour revenir, sans l’application d’authentification. ' +
        'Toutes les 8 heures, ou après 5 codes faux, la connexion complète sera de nouveau demandée.</p>' +
        '<label class="fl" for="cx-pin1">Code à 4 chiffres<input id="cx-pin1" name="pin1" type="password" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]{4}" required></label>' +
        '<label class="fl" for="cx-pin2">Le même, une seconde fois<input id="cx-pin2" name="pin2" type="password" inputmode="numeric" autocomplete="off" maxlength="4" pattern="[0-9]{4}" required></label>' +
        (extra ? '<div class="note erreur" role="alert">' + P.esc(extra) + '</div>' : '') +
        '<button class="btn rouge" type="submit">Enregistrer le code</button>' +
        '<button class="retour" type="button" data-action="pin-plus-tard">Plus tard</button></form>';
    } else if (etape === 'nouveau-mdp') {
      droite = '<form data-form="nouveau-mdp" class="grille" style="gap:14px"><div><div class="etape">Bienvenue</div><h2 style="font-size:22px">Choisissez votre mot de passe</h2></div>' +
        '<p class="doux">12 caractères au moins. Évitez un mot de passe déjà utilisé ailleurs.</p>' +
        '<label class="fl" for="cx-m1">Nouveau mot de passe<input id="cx-m1" name="m1" type="password" minlength="12" autocomplete="new-password" required></label>' +
        '<label class="fl" for="cx-m2">Le même, une seconde fois<input id="cx-m2" name="m2" type="password" minlength="12" autocomplete="new-password" required></label>' +
        (extra ? '<div class="note erreur" role="alert">' + P.esc(extra) + '</div>' : '') +
        '<button class="btn rouge" type="submit">Enregistrer</button></form>';
    } else {
      droite = '<div class="grille" style="gap:14px"><h2 style="font-size:22px">' + P.esc(etape) + '</h2>' + (extra || '') +
        '<button class="btn" data-action="deconnexion">Retour à la connexion</button></div>';
    }
    app().innerHTML = '<div class="connexion">' + gauche + '<div class="d">' + droite + '</div></div>';
    const champ = app().querySelector('input');
    if (champ) champ.focus();
  }

  // Mots de passe trop courants : refusés d'emblée (la base Supabase vérifie aussi les fuites connues)
  const COURANTS = /^(123456|motdepasse|password|azerty|qwerty|ma2m|akesse|admin)/i;
  P.motDePasseValable = (m) => m.length >= 12 && !COURANTS.test(m) && !/^(.)\1+$/.test(m);

  P.formulaires.connexion = async (f) => {
    const email = String(f.get('email')).trim().toLowerCase(), motdepasse = String(f.get('motdepasse'));
    try {
      const rep = await fetch('/api/connexion-protegee', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: motdepasse, espace: 'portail', appareil: identifiantAppareilPortail() })
      });
      const corps = await rep.json().catch(() => ({}));
      if (rep.status === 429) return ecranConnexion('motdepasse', 'Trop d’essais : accès bloqué pendant ' + (corps.minutesRestantes || 15) + ' minutes. Une alerte a été envoyée.');
      if (rep.status === 403) return ecranConnexion('motdepasse', corps.error || 'Ce compte n’a pas accès au portail.');
      if (!rep.ok) return ecranConnexion('motdepasse', 'E-mail ou mot de passe incorrect.' + (corps.essaisRestants != null ? ' Essais restants : ' + corps.essaisRestants + '.' : ''));
      await P.bd(sb.auth.setSession({ access_token: corps.access_token, refresh_token: corps.refresh_token }));
          await demarrer();
    } catch (e) {
      ecranConnexion('motdepasse', P.erreurTexte(e));
    }
  };

  async function facteurTotp() {
    const r = await P.bd(sb.auth.mfa.listFactors());
    return (r.totp || []).find((x) => x.status === 'verified') || null;
  }
  P.formulaires.code = async (f) => {
    try {
      const facteur = await facteurTotp();
      await P.bd(sb.auth.mfa.challengeAndVerify({ factorId: facteur.id, code: String(f.get('code')).trim() }));
      await demarrer();
    } catch (e) {
      ecranConnexion('code', 'Code incorrect ou expiré. Réessayez avec le code affiché maintenant.');
    }
  };
  async function preparerInscriptionCode() {
    try {
      const anciens = await P.bd(sb.auth.mfa.listFactors());
      for (const x of (anciens.all || []).filter((y) => y.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: x.id });
      const r = await P.bd(sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Administration MA2M ' + new Date().toISOString().slice(0, 10) }));
      P.etat.facteurEnCours = r.id;
      document.getElementById('qr-zone').innerHTML = '<img class="qr" alt="Code QR à scanner avec l’application d’authentification" src="' + P.esc(r.totp.qr_code) + '">' +
        '<details><summary class="petit-texte">Impossible de scanner ?</summary><p class="petit-texte">Saisissez cette clé dans l’application : <b style="word-break:break-all">' + P.esc(r.totp.secret) + '</b></p></details>';
    } catch (e) {
      document.getElementById('qr-zone').innerHTML = '<div class="note erreur">' + P.esc(P.erreurTexte(e)) + '</div>';
    }
  }
  P.formulaires['activer-code'] = async (f) => {
    try {
      await P.bd(sb.auth.mfa.challengeAndVerify({ factorId: P.etat.facteurEnCours, code: String(f.get('code')).trim() }));
      // 8 codes de secours, montrés une seule fois (stockés hachés par le serveur)
      P.montrerCodesSecours(await appelServeur('codes_secours_creer', {}), 'fermer-fenetre-demarrer');
    } catch (e) {
      ecranConnexion('inscrire-code', 'Code incorrect. Vérifiez l’heure du téléphone puis réessayez.');
      preparerInscriptionCode().catch((e) => P.message(P.erreurTexte(e)));
    }
  };
  // fenêtre des 8 codes (à l'activation, et depuis « Mes codes de secours » de la page Sécurité)
  P.montrerCodesSecours = (reponse, actionFermer) => {
    P.fenetre('<h2>Vos 8 codes de secours</h2><p class="doux">Recopiez-les et gardez-les hors ligne (papier, coffre). Chacun ne sert qu’une fois, si vous perdez votre téléphone. Ils ne seront plus affichés.</p>' +
      '<div class="codes-secours">' + (reponse.codes || []).map((c) => '<span>' + P.esc(c) + '</span>').join('') + '</div>' +
      '<button class="btn rouge" data-action="' + actionFermer + '">Je les ai notés</button>');
  };
  P.actions['fermer-fenetre-demarrer'] = () => { P.fenetre(''); return demarrer(); };
  // Code à 4 chiffres de l'appareil (verrouillage après 15 minutes, supabase-portail.sql)
  P.formulaires.deverrouiller = async (f) => {
    try {
      const r = await P.rpc('portail_code_appareil_verifier', { p_appareil: identifiantAppareilPortail(), p_code: String(f.get('pin')).trim() });
      if (r.ok) return demarrer();
      if (r.bloque) { await P.actions.deconnexion(); return ecranConnexion('motdepasse', 'Trop de codes faux : reconnectez-vous avec votre mot de passe et l’application d’authentification.'); }
      ecranConnexion('verrou', 'Code incorrect. Essais restants : ' + r.restants + '.');
    } catch (e) { ecranConnexion('verrou', P.erreurTexte(e)); }
  };
  P.formulaires['choisir-pin'] = async (f) => {
    const a = String(f.get('pin1')).trim(), b = String(f.get('pin2')).trim();
    if (a !== b) return ecranConnexion('choisir-pin', 'Les deux codes ne sont pas identiques.');
    try {
      await P.rpc('portail_code_appareil_definir', { p_appareil: identifiantAppareilPortail(), p_code: a });
      P.message('Code enregistré pour cet appareil.');
    } catch (e) {
      return ecranConnexion('choisir-pin', /AUTH_RECENTE/.test(String(e && e.message)) ? 'Reconnectez-vous complètement pour choisir le code.' : P.erreurTexte(e));
    }
    await demarrer();
  };
  P.actions['pin-plus-tard'] = () => { sessionStorage.setItem('ma2m_pin_plus_tard', '1'); return demarrer(); };
  P.formulaires['nouveau-mdp'] = async (f) => {
    const m1 = String(f.get('m1')), m2 = String(f.get('m2'));
    if (m1 !== m2) return ecranConnexion('nouveau-mdp', 'Les deux mots de passe ne sont pas identiques.');
    if (!P.motDePasseValable(m1)) return ecranConnexion('nouveau-mdp', '12 caractères au moins, et pas un mot de passe courant.');
    try {
      await P.bd(sb.auth.updateUser({ password: m1, data: { portail_mdp_choisi: true } }));
      history.replaceState(null, '', '/admin/');
      await demarrer();
    } catch (e) {
      ecranConnexion('nouveau-mdp', P.erreurTexte(e));
    }
  };
  P.actions.oubli = async () => {
    const champ = document.getElementById('cx-mail');
    const email = champ && champ.value.trim();
    if (!email) { P.message('Saisissez d’abord votre adresse e-mail.'); return; }
    try {
      // retour par le site principal (seule adresse acceptée par la base), qui renvoie vers
      // l'Administration en gardant la clé du lien (même règle que les invitations, api/portail.js)
      await P.bd(sb.auth.resetPasswordForEmail(email, { redirectTo: 'https://www.maitreakessemodelmanagement.com/admin/#/nouveau-mot-de-passe' }));
    } catch (e) { /* même réponse dans tous les cas : ne dit pas si le compte existe */ }
    P.message('Si ce compte existe, un e-mail de réinitialisation vient de partir.');
  };
  P.actions.secours = async () => {
    const code = (document.getElementById('cx-secours') || {}).value || '';
    try {
      await appelServeur('code_secours_utiliser', { code: code.trim() });
      P.message('Code de secours accepté : activez à nouveau la double authentification.');
      await demarrer();
    } catch (e) { P.message(P.erreurTexte(e)); }
  };
  P.actions.deconnexion = async () => {
    try { await sb.auth.signOut(); } catch (e) { /* déjà déconnecté */ }
    sessionStorage.removeItem('ma2m_pin_plus_tard');
    window.arreterInactivitePortail();
    // (clé de l'ancien « mode administration » des pages publiques, démoli le 23/10/2026 : effacée des appareils)
    try { localStorage.removeItem('ma2m_mode_administration'); } catch (e) { /* stockage bloqué */ }
    // clé d'accès aux pièces réservées de l'Administration effacée aussi
    fetch('/api/acces-tableau', { method: 'DELETE', credentials: 'same-origin' }).catch(() => { /* hors ligne : elle expire seule */ });
    P.moi = null;
    location.hash = '#/';
    ecranConnexion('motdepasse');
  };

  // Confirmation d'un code (action sensible) : renvoie true si le code est bon
  P.confirmerCode = (texte) => new Promise((resolve) => {
    P.etat.finConfirmation = resolve;
    P.fenetre('<form data-form="confirmer-code" class="grille" style="gap:12px"><h2>Confirmation</h2><p class="doux">' + P.esc(texte) + '</p>' +
      '<label class="fl" for="cf-code">Code à 6 chiffres<input id="cf-code" name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code"></label>' +
      '<div class="ligne"><button class="btn rouge" type="submit">Confirmer</button><button class="btn" type="button" data-action="annuler-code">Annuler</button></div></form>');
    document.getElementById('cf-code').focus();
  });
  P.formulaires['confirmer-code'] = async (f) => {
    try {
      const facteur = await facteurTotp();
      await P.bd(sb.auth.mfa.challengeAndVerify({ factorId: facteur.id, code: String(f.get('code')).trim() }));
      P.fenetre('');
      P.etat.finConfirmation(true);
    } catch (e) { P.message('Code incorrect.'); }
  };
  P.actions['annuler-code'] = () => { P.fenetre(''); if (P.etat.finConfirmation) P.etat.finConfirmation(false); };

  // Fonction serveur du portail (api/portail.js) : invitations, codes de secours, etc.
  async function appelServeur(action, donnees) {
    const session = (await sb.auth.getSession()).data.session;
    const rep = await fetch('/api/portail', {
      method: 'POST',
      // identifiant de l'appareil (js/supabase-config.js) : le serveur le transmet à la base
      headers: Object.assign({ 'Content-Type': 'application/json', 'x-appareil': identifiantAppareilPortail() }, session ? { Authorization: 'Bearer ' + session.access_token } : {}),
      body: JSON.stringify(Object.assign({ action }, donnees || {}))
    });
    const corps = await rep.json().catch(() => ({}));
    if (!rep.ok) throw new Error(corps.error || 'Erreur serveur.');
    if (corps.session) await sb.auth.setSession(corps.session);
    return corps;
  }
  P.serveur = appelServeur;

  // ---------- démarrage : qui est là, avec quel niveau ----------
  async function demarrer() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return ecranConnexion('motdepasse');
    const dernierCode = dernierCodeApplication(data.session);
    if (dernierCode && Date.now() - dernierCode > SESSION_MAX_MS) {
      await P.actions.deconnexion();
      return ecranConnexion('motdepasse', 'Session de 8 heures terminée : reconnectez-vous.');
    }
    const u = data.session.user;
    // lien d'invitation ou de réinitialisation : choisir son mot de passe d'abord
    if (/type=(invite|recovery)/.test(location.hash) || location.hash === '#/nouveau-mot-de-passe' ||
        (u.user_metadata && u.user_metadata.portail_invite && !u.user_metadata.portail_mdp_choisi)) {
      return ecranConnexion('nouveau-mdp');
    }
    const niveau = await P.bd(sb.auth.mfa.getAuthenticatorAssuranceLevel());
    if (niveau.currentLevel !== 'aal2') {
      if (niveau.nextLevel === 'aal2') return ecranConnexion('code');
      ecranConnexion('inscrire-code');
      return preparerInscriptionCode();
    }
    // écran verrouillé (15 minutes sans activité) : code à 4 chiffres, ou connexion complète
    const pin = await P.rpc('portail_code_appareil_etat', { p_appareil: identifiantAppareilPortail() }).catch(() => null);
    P.etat.pinDefini = !!(pin && pin.defini);
    if (pin && pin.verrouille) {
      if (pin.defini) return ecranConnexion('verrou');
      await P.actions.deconnexion();
      return ecranConnexion('motdepasse', 'Trop de codes faux : reconnectez-vous avec votre mot de passe et l’application d’authentification.');
    }
    P.moi = await P.rpc('portail_moi');
    if (!P.moi.membre) return ecranConnexion('Compte sans accès', '<p class="doux">Ce compte n’a pas de rôle dans le portail. L’administrateur principal doit vous inviter.</p>');
    if (!P.moi.actif || !P.moi.role) return ecranConnexion('Accès coupé', '<p class="doux">Votre accès a été coupé par l’administrateur principal, ou cet appareil a été révoqué.</p>');
    const appareil = await P.rpc('portail_enregistrer_appareil', { p_appareil: identifiantAppareilPortail(), p_libelle: libelleAppareil() });
    if (!appareil.ok) return ecranConnexion('Appareil révoqué', '<p class="doux">Cet appareil n’a plus accès au portail.</p>');
    if (appareil.nouveau) alerteNouvelAppareil(appareil);
    // juste après une connexion complète, sur un appareil sans code : proposer le code à 4 chiffres
    if (pin && !pin.defini && dernierCode && Date.now() - dernierCode < 9 * 60 * 1000 && !sessionStorage.getItem('ma2m_pin_plus_tard')) {
      return ecranConnexion('choisir-pin');
    }
    surveillerInactivite();
    // une personne qui n'a droit qu'à un espace arrive directement dedans
    const permis = Object.keys(ESPACES).filter((k) => P.moi.espaces[k]);
    if ((location.hash === '' || location.hash === '#/') && permis.length === 1 && P.moi.role !== 'principal') {
      location.hash = '#/' + permis[0] + '/' + premierePage(P.espaces[permis[0]]);
      return;
    }
    afficher().catch((e) => P.message(P.erreurTexte(e)));
  }
  // Alerte de connexion depuis un nouvel appareil : e-mail à la personne et à l'administrateur principal
  function alerteNouvelAppareil(a) {
    if (typeof envoyerEmailCandidat !== 'function' || !a.moi) return;
    const texte = 'Connexion au portail d’administration MA2M depuis un nouvel appareil (' + libelleAppareil() + ') le ' +
      new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan' }) + ', compte de ' + a.moi.nom + '. Si ce n’est pas vous, prévenez l’administrateur principal : il peut révoquer cet appareil.';
    [a.moi.email, a.principal].filter((x, i, l) => x && l.indexOf(x) === i).forEach((adresse) => {
      Promise.resolve(envoyerEmailCandidat({ to_email: adresse, to_name: a.moi.nom, message: texte })).catch(() => { /* alerte au mieux */ });
    });
  }
  function libelleAppareil() {
    const ua = navigator.userAgent;
    const sys = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Autre';
    const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'navigateur';
    return sys + ', ' + nav + (matchMedia('(display-mode: standalone)').matches ? ' (application installée)' : '');
  }
  // (15 minutes sans geste : js/portail/inactivite.js, partagé avec les écrans de l'espace 1)
  function surveillerInactivite() {
    window.surveillerInactivitePortail({ actif: () => !!P.moi, pinDefini: () => !!P.etat.pinDefini, verrouiller });
  }

  async function verrouiller() {
    if (!P.etat.pinDefini) {
      P.message('Session fermée après 15 minutes sans activité.');
      return P.actions.deconnexion();
    }
    await P.rpc('portail_code_appareil_verrouiller', { p_appareil: identifiantAppareilPortail() }).catch(() => { /* le serveur verrouille de lui-même */ });
    P.fenetre('');
    ecranConnexion('verrou');
  }
  const dernierCodeApplication = (session) => window.dernierCodeApplicationPortail(session);  // js/portail/inactivite.js

  // ---------- coque et pages ----------
  // première rubrique d'un espace (le menu peut commencer par un titre de groupe)
  const premierePage = P.premierePage = (esp) => esp.nav.find((n) => n[0])[0];  // (aussi pour js/admin/coque.js)
  // Menu des rubriques d'un espace ; une entrée sans adresse (null) est un titre de groupe : chaque
  // groupe est un compartiment bien séparé (24/10/2026, demande de la propriétaire : tout ce qui va
  // ensemble au même endroit). Partagé avec la coque de l'Administration (js/admin/coque.js).
  P.menuRubriques = (esp, module, page) => {
    let nav = '', ouvert = false;
    esp.nav.filter((n) => !n[2] || n[2]()).forEach((n) => {
      if (!n[0]) { nav += (ouvert ? '</div>' : '') + '<div class="compartiment" role="group" aria-label="' + P.esc(n[1]) + '"><div class="titre-menu sous-titre-menu">' + P.esc(n[1]) + '</div>'; ouvert = true; return; }
      nav += '<a class="nav' + (n[0] === page ? ' actif' : '') + '" href="#/' + module + '/' + n[0] + '"' + (n[0] === page ? ' aria-current="page"' : '') + '><span>' + P.esc(n[1]) + '</span>' +
        (esp.compteur && esp.compteur[n[0]] ? '<span class="compteur">' + esp.compteur[n[0]] + '</span>' : '') + '</a>';
    });
    if (ouvert) nav += '</div>';
    return nav;
  };
  P.coque = (module, page, html) => {
    const esp = P.espaces[module];
    const nav = P.menuRubriques(esp, module, page);
    // écran étroit (téléphone, tablette en vertical) : barre « ☰ Menu », le menu glisse depuis la gauche
    return '<div class="coque"><div class="barre-menu">' + P.logo('logo-barre') +
      '<button class="btn petit clair" data-action="menu-ouvrir" aria-controls="menu-lateral" aria-expanded="false">☰ Menu</button></div>' +
      '<div class="voile-menu" data-action="menu-fermer"></div>' +
      '<nav class="lateral" id="menu-lateral" aria-label="' + P.esc(ESPACES[module]) + '"><div class="marque">' + P.logo('logo-menu') + '</div>' +
      '<div class="qui"><b>' + P.esc(P.moi.nom) + '</b>' + P.esc(ROLES[P.moi.role]) + '</div>' +
      '<div class="titre-menu">' + P.esc(ESPACES[module]) + '</div>' + nav +
      '<div class="lateral-pied"><a class="btn petit clair" href="#/">Retour au portail</a><button class="btn petit clair" data-action="deconnexion">Déconnexion</button></div></nav>' +
      '<main class="contenu" id="contenu">' + html + '</main></div>';
  };

  // Écran d'accueil (les tuiles) ; la nouvelle Administration (admin/index.html, js/admin/coque.js)
  // remplace P.vuePortail et P.coque par sa propre décoration — la connexion et l'aiguillage restent ici.
  P.vuePortail = function () {
    const tuiles = [
      ['site', 'Mannequins, candidatures, actualités. Aucune donnée financière.', '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18M8 21h8M12 18v3"/>'],
      ['paiements', 'Qui a payé, qui est en retard, paiements à rapprocher, messages.', '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11h20M6 15h4"/>'],
      ['compta', 'Recettes, factures, dépenses, impôts, clôture.', '<path d="M5 3h11l3 3v15H5z"/><path d="M8 10h8M8 14h8M8 18h5"/>']
    ].filter((t) => P.moi.espaces[t[0]] && P.espaces[t[0]]);
    const phrase = {
      principal: 'Vous voyez les trois espaces et la sécurité du portail.',
      site: 'Vous gérez le site au quotidien. Aucune donnée financière ni coordonnée privée ne vous est visible.',
      caisse: 'Vous suivez les paiements des mannequins, rapprochez les « J’ai payé » et envoyez les messages.',
      compta: 'Vous tenez la comptabilité. Sur les mannequins, vous ne voyez que des totaux, jamais de noms.'
    }[P.moi.role];
    return '<div class="coque sans-menu"><main class="contenu" style="padding:0">' +
      '<div class="bandeau-portail">' + P.logo('logo-bandeau') + '<div class="ligne">' +
      P.pastille(ROLES[P.moi.role], 'neutre') +
      (P.moi.role === 'principal' ? '<a class="btn petit clair" href="#/securite/comptes">Sécurité et journal</a>' : '<a class="btn petit clair" href="#/securite/codes">Mes codes de secours</a>') +
      (P.installee() ? '' : '<button class="btn petit clair" data-action="installer">Installer l’application</button>') +
      '<button class="btn petit clair" data-action="deconnexion">Déconnexion</button></div></div>' +
      '<div style="padding:30px 28px;display:flex;flex-direction:column;gap:22px"><div><h1>Bonjour, ' + P.esc(P.moi.nom) + '</h1><p class="doux" style="max-width:720px">' + P.esc(phrase) + '</p></div>' +
      '<div class="tuiles">' + tuiles.map((t) => '<a class="tuile" href="#/' + t[0] + '/' + premierePage(P.espaces[t[0]]) + '"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t[2] + '</svg>' +
        '<div><div class="tt">' + P.esc(ESPACES[t[0]]) + '</div><div class="ts">' + P.esc(t[1]) + '</div></div></a>').join('') + '</div>' +
      '<div class="pied-portail"><span>Une tuile n’apparaît que si votre rôle y donne accès.</span><a href="/" class="retour">Voir le site public</a></div></div></main></div>';
  };

  let rendu = 0;
  async function afficher() {
    if (!P.moi || !P.moi.role) return demarrer();
    const morceaux = location.hash.replace(/^#\/?/, '').split('/');
    const module = morceaux[0], page = morceaux[1];
    const n = ++rendu;
    document.documentElement.classList.remove('menu-ouvert'); // une rubrique choisie referme le menu
    if (!module) {
      app().dataset.module = '';
      const html = await P.vuePortail();
      if (n !== rendu) return; // l'utilisateur est déjà ailleurs
      app().innerHTML = html;
      if (P.apresPortail) P.apresPortail();
      return;
    }
    const esp = P.espaces[module];
    if (!esp) { location.hash = '#/'; return; }
    const pageValide = esp.pages[page] ? page : premierePage(esp);
    // Sécurité : réservée à l'administrateur principal, sauf « Mes codes de secours » (chacun)
    const autorise = module === 'securite' ? P.moi.role === 'principal' || pageValide === 'codes' : P.moi.espaces[module];
    if (!autorise) { app().innerHTML = P.coque(module, pageValide, P.refuse()); return; }
    app().dataset.module = module;
    app().innerHTML = P.coque(module, pageValide, '<div class="chargement">Chargement…</div>');
    try {
      if (esp.avant) await esp.avant();
      const html = await esp.pages[pageValide](morceaux.slice(2));
      if (n !== rendu) return; // l'utilisateur est déjà ailleurs
      app().innerHTML = P.coque(module, pageValide, html);
      if (esp.apres && esp.apres[pageValide]) esp.apres[pageValide]();
    } catch (e) {
      if (n !== rendu) return;
      app().innerHTML = P.coque(module, pageValide, '<div class="carte"><h2>Impossible d’afficher cette page</h2><p class="doux">' + P.esc(P.erreurTexte(e)) + '</p>' +
        '<button class="btn" data-action="recharger" style="margin-top:12px">Réessayer</button></div>');
    }
  }
  P.afficher = afficher;
  P.actions.recharger = () => afficher();
  P.actions['fermer-fenetre'] = () => P.fenetre('');
  function menuOuvert(oui) {
    document.documentElement.classList.toggle('menu-ouvert', oui);
    const b = document.querySelector('[data-action="menu-ouvrir"]');
    if (b) b.setAttribute('aria-expanded', String(oui));
    if (oui) { const actif = document.querySelector('.lateral .nav.actif, .lateral .nav'); if (actif) actif.focus(); }
  }
  P.actions['menu-ouvrir'] = () => menuOuvert(true);
  P.actions['menu-fermer'] = () => menuOuvert(false);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.documentElement.classList.contains('menu-ouvert')) menuOuvert(false); });
  // la rubrique déjà ouverte ne change pas l'adresse : on referme quand même le menu
  document.addEventListener('click', (e) => { if (e.target.closest('.lateral a')) menuOuvert(false); });

  // ---------- évènements (un seul écouteur par type) ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const f = P.actions[el.getAttribute('data-action')];
    if (f) { e.preventDefault(); Promise.resolve(f(el, e)).catch((err) => P.message(P.erreurTexte(err))); }
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const f = P.formulaires[form.getAttribute('data-form')];
    if (!f) return;
    const bouton = form.querySelector('[type="submit"]');
    if (bouton) bouton.disabled = true;
    Promise.resolve(f(new FormData(form), form)).catch((err) => P.message(P.erreurTexte(err)))
      .finally(() => { if (bouton && bouton.isConnected) bouton.disabled = false; });
  });
  // (data-direct : aussi à chaque frappe, pas seulement en quittant le champ — ex. calcul affiché)
  ['change', 'input'].forEach((sorte) => document.addEventListener(sorte, (e) => {
    const el = e.target.closest('[data-change]');
    if (!el || (sorte === 'input' && !el.hasAttribute('data-direct'))) return;
    const f = P.changements[el.getAttribute('data-change')];
    if (f) Promise.resolve(f(el, e)).catch((err) => P.message(P.erreurTexte(err)));
  }));
  addEventListener('hashchange', () => { if (P.moi && P.moi.role) afficher().catch((e) => P.message(P.erreurTexte(e))); });

  // ---------- application installable ----------
  // même installation que la bande « Télécharger l'application » (js/app.js, partagée avec le site
  // et l'application des mannequins)
  P.actions.installer = () => window.MA2M_INSTALLATION.installer();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => { /* l'application marche aussi sans */ });
  }

  // Démarrage une fois tous les fichiers d'espace chargés
  addEventListener('DOMContentLoaded', () => {
    if (typeof sb === 'undefined' || !sb) {
      app().innerHTML = '<div class="carte"><h2>Connexion impossible</h2><p class="doux">Le service de données n’a pas pu être chargé. Vérifiez la connexion internet puis rechargez la page.</p></div>';
      return;
    }
    sb.auth.onAuthStateChange((evenement) => {
      if (evenement === 'SIGNED_OUT' && P.moi) { P.moi = null; ecranConnexion('motdepasse'); }
    });
    demarrer().catch((e) => ecranConnexion('motdepasse', P.erreurTexte(e)));
  });
})();
