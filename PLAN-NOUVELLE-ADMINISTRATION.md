# Nouvelle Administration « vivante » (chantier lancé le 22/10/2026)

Décision de la propriétaire (22/10/2026) : reconstruire **à neuf** l'Administration en « motion design »,
aux couleurs du site, avec les vrais visages des mannequins (style choisi : « Studio minimal » sur
papier crème, maquette `maquette-vivante.html`). Les **3 blocs** restent (Administration du site,
Paiements, Comptabilité), reconstruits pièce par pièce. **Aucun morceau de l'ancien tableau de bord
n'est posé dedans** (plus de cadre `tableau-de-bord.html`). La base de données, les liens des photos,
la connexion sécurisée et les envois d'e-mails sont **raccordés** tels quels (« l'eau et le courant »).

Feu vert de la propriétaire pour : construire les 3 blocs, les visiter soi-même « comme un patron
d'agence qui veut acheter », faire une grande visite d'ensemble, corriger, **déménager** (la nouvelle
prend l'adresse /admin/) puis **démolir** l'ancien tableau de bord.

## Architecture

- **Fondations gardées** : `js/portail/noyau.js` (connexion, double authentification, code
  d'appareil, rôles, aiguillage `#/espace/page`, évènements `data-action` / `data-form`),
  `js/portail/inactivite.js`, `api/*`, base Supabase et ses droits (RLS), `js/messages-*.js`.
- **Nouvelle maison construite à côté** : `admin/nouvelle/index.html` (adresse d'essai, même
  connexion, mêmes données). L'Administration actuelle `/admin/` continue de marcher pendant le
  chantier.
- **Décoration neuve** : `css/admin-vivante.css` (couleurs et polices du site : papier `--mag-papier`,
  encre `--mag-encre`, rouge `--rouge-ma2m`, titres `--mag-titre`, texte `--mag-texte`), animations
  douces (`prefers-reduced-motion` respecté), vignettes légères des photos (`urlLegere`).
- **Bloc 1 natif** : `js/admin/…` (une rubrique = un fichier ou un petit groupe), pages rendues dans
  la coque du portail comme les espaces 2 et 3 — plus d'iframe.
- **Blocs 2 et 3** : leur logique (déjà native) est gardée ; nouvelle décoration et visages.

## Règle pendant le chantier

Une pièce qui sert aux deux maisons (ancienne et nouvelle) n'est jamais recopiée : son écran est
sorti dans un fichier « gabarit » partagé et sa logique démarre à la demande
(`window.demarrer…`). Une pièce reconstruite à neuf (nouvelle présentation) vit dans
`js/admin/site-*.js` ; l'ancienne version disparaît à la démolition.

## Étapes (une à la fois, essais « comme un visiteur » à chaque étape)

1. Fondations visibles : décoration, entrée (connexion), menu des 3 blocs, accueil vivant.
2. Bloc 1 — Castings (candidatures, projets, messages groupés, convocations).
3. Bloc 1 — Mannequins (liste, validations, à la une, photos triées, rapport, fiches événement).
4. Bloc 1 — Pilotage (vue d'ensemble, à traiter, classements, graphiques).
5. Bloc 1 — Relations (recruteurs, contacts).
6. Bloc 1 — Contenu du site (actualités, événements, partenaires, mot du fondateur, agenda, vidéo, Instagram).
7. Bloc 1 — Accès et outils (codes, accès bloqués, Drive, nettoyage, erreurs).
8. Bloc 2 — Paiements (nouvelle décoration, visages).
9. Bloc 3 — Comptabilité (nouvelle décoration).
10. Grande visite « patron d'agence exigeant », corrections.
11. Déménagement (`/admin/` = nouvelle maison), vérifications.
12. Démolition : `tableau-de-bord.html`, ses scripts et styles, le mode administration des pages
    publiques, les essais devenus inutiles ; README-TECHNIQUE.md mis à jour.

## État

| Étape | État |
|---|---|
| 1. Fondations visibles | faite (22/10) : `css/admin-vivante.css`, `js/admin/coque.js` (coque, accueil vivant, visages, mur de la connexion), `js/admin/site.js` (menu du bloc 1), `admin/nouvelle/index.html`, `js/photos.js` (outils photo sortis de `js/app.js`, partagés). Essai : `test-nouvelle-admin.js` (données : `donnees-nouvelle-admin.js`). Inventaire de l'ancien bloc 1 : `INVENTAIRE-BLOC1.md`. |
| 2. Castings | faite (22/10) : Candidatures et Demandes recruteurs (`js/admin/site-dossiers.js`, reconstruites, visages, fiche pleine page), Projets (`js/admin/site-projets.js`, reconstruit), Convocations et Messages groupés (écrans partagés `js/convocations-gabarit.js`, `js/messages-groupes-gabarit.js` : même logique pour les deux maisons, démarrage à la demande ; mur de visages). Pièces réservées chargées après la clé d'accès (`js/admin/site.js`, `middleware.js`). Essais : `test-nouvelle-admin-castings.js`, `test-nouvelle-admin-convocations.js`. |
| 3. Mannequins | faite (22/10) : Mannequins, Validations, À la une (`js/admin/site-mannequins.js`, reconstruits, visages, CV en image) ; Photos mises de côté, Rapport des profils, Fiches événement (écrans partagés `*-gabarit.js`, `js/admin/site-outils-mannequins.js`). Essai : `test-nouvelle-admin-mannequins.js`. |
| 4. Pilotage et Relations | en cours |
