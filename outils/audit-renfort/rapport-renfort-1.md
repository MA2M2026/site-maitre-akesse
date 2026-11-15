# Rapport de l'agent 1 — testeur avec accès réels (15/11/2026)

Rôle (§16 de la mission) : seul agent avec un accès réel, **en lecture**, à la base de production (connecteur
Supabase). Aucune écriture. Limite honnête : je n'ai **pas** le mot de passe ni le code à deux facteurs du compte
d'essai de l'équipe (il existe : vu dans le journal) ; je n'ai donc pas pu me connecter à l'Administration
ni à l'application comme une personne. L'Administration et l'application sont jugées par la base réelle, le
journal des vraies visites et le code. Une consultation supplémentaire de la base a été refusée par la
propriétaire : je m'en suis tenu là.

## Résumé
La base est saine (aucune fiche publiée sans photo, sans adresse ni taille ; toutes les photos ont leurs versions
légères ; 28 mannequins publiés, 508 photos, 22 candidatures en 30 jours). La sécurité de la base est bonne :
les fonctions appelables par un visiteur sont toutes protégées (rôle vérifié, clé secrète ou lien personnel).
Le journal des vraies visites (233 signalements en 7 jours) montre quelques vrais défauts, détaillés ci-dessous.

## Points forts (vérifiés)
- F1. **Données des fiches complètes** : 0 fiche publiée sans photo / adresse (slug) / taille ; 0 photo sans
  miniature ni version moyenne (requête directe sur la base).
- F2. **Fonctions de la base protégées** : 60 fonctions « security definer » appelables par un visiteur ; celles
  qui touchent des données privées vérifient le rôle (portail_admin_ok, portail_peut…) ou exigent une clé :
  `photos_a_sauvegarder` (clé de 32+ caractères comparée par empreinte), `media_drive_*` (secret),
  `places_*`, `programme_talons_*`, `convocation_*` (jeton de 36 caractères). Lu dans le corps des fonctions.
- F3. **Sécurité des actions sensibles** : modifier le rôle d'un compte exige une confirmation récente du code
  à deux facteurs (AUTH_RECENTE, vu deux fois dans le journal le 11 et le 12/11) et l'écran l'explique
  (js/portail/noyau.js:116).
- F4. **Surveillance des erreurs en place partout** (site, application, Administration) : c'est elle qui permet
  ce rapport.
- F5. Conseiller Supabase : aucune alerte de niveau « ERROR ».

## Problèmes

| ID | Gravité | Où | Cause | Conséquence | Solution proposée | Risque | Vérification |
|----|---------|----|-------|-------------|-------------------|--------|--------------|
| A1-01 | moyenne | Administration, CV d'une mannequin (`/admin/#/site/…/cv`) ; `js/app.js:256` et `:269` | logo appelé par un chemin relatif `assets/logo-header.png` : depuis `/admin/` il devient `/admin/assets/…` (introuvable) | le CV ouvert dans l'Administration n'a pas le logo de l'agence (2 signalements, 13/11) | chemin absolu `/assets/logo-header.png` (comme js/admin/coque.js:528) | très faible | ouvrir le CV dans l'Administration et sur le site ; journal sans « Image du site non chargée » |
| A1-02 | moyenne | fiches `/book/…` sur téléphone : `div.fiche-telecharger` | la rangée « Compcard PDF JPEG » est plus large que l'écran de 12 px | défilement de côté sur certaines fiches (2 fiches, 4 signalements) | autoriser le retour à la ligne / réduire l'écart de cette rangée sous 400 px | faible | essai fiche à 360 et 390 px, aucun débordement |
| A1-03 | moyenne | `/integrer-agence` (tablette Android 8.1, Chrome 101) | « Identifier 'enMo' has already been declared » : `js/app.js` exécuté deux fois sur cet appareil (cause exacte à confirmer : gabarit.js est appelé deux fois volontairement, app.js une seule fois dans le HTML) | si app.js est rejoué, la page peut s'arrêter ; 2 signalements | reproduire avec ce navigateur ; protéger app.js contre une double exécution | moyen | essai Chrome 101 Android sur la page |
| A1-04 | moyenne | `/integrer-agence`, `/cours-talons`, `/mannequins` | chargement complet mesuré chez de vrais visiteurs : 14 à 70 s sur /integrer-agence, 44 s sur /cours-talons, 18 s sur /mannequins ; « affichage qui saute » sur les deux premières | page d'inscription (la plus importante pour recruter) lente en 3G/4G | à recouper avec les mesures des agents 2 et 4 (poids des diaporamas et photos), puis alléger | moyen | Lighthouse mobile + journal |
| A1-05 | basse | `/`, `/admin/`, `/mannequins`, `/candidature` | « Photos directes Cloudflare injoignables → relais Vercel » (18 en 7 jours) | le secours fonctionne, mais chaque bascule coûte du temps et du quota Vercel | suivre la cause côté réseau des visiteurs ; garder le secours | faible | journal |
| A1-06 | basse | `/app/` et `/` avec Chrome 45 (2015, Windows 7) | syntaxe moderne non comprise → page vide | très vieux navigateur (probablement un robot) ; rien à faire sauf un message « navigateur trop ancien » | facultatif | — | — |
| A1-07 | basse | base (conseiller Supabase) | 3 fonctions sans chemin fixe (`compta_type_du_mode`, `cours_talons_prix_mois`, `cours_talons_module`) | faible risque théorique de détournement de fonction | ajouter `set search_path = public` | très faible | conseiller Supabase |
| A1-08 | basse | base (conseiller performance) | 95 règles qui relisent `auth.uid()` à chaque ligne, 100 doubles règles permissives, 87 clés étrangères sans index | lenteur seulement si les tables grossissent beaucoup | plus tard, par lots, sur la base d'essai | moyen | conseiller + essais base |
| A1-09 | info | Supabase, réglage | protection « mots de passe volés » coupée (offre payante) | déjà compensée : 8 caractères minimum (décision du 08/11) | rien | — | — |

## Limites et suite
- Pour la visite humaine de l'Administration et de l'application (§17), il faut que la propriétaire me donne
  l'accès au compte d'essai par un moyen sûr, ou qu'elle fasse elle-même la visite guidée.
- A1-03 et A1-04 sont à recouper avec les mesures des agents 2 et 4.
