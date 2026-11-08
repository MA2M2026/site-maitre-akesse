# Analyse du code — forces, faiblesses, cohérence avec le site (08/11/2026)

Mesures : SonarCloud (projet MA2M2026_site-maitre-akesse, analyse du 08/11 16:15), comptage du dépôt.

| Mesure | Valeur |
|---|---|
| Lignes de code | 50 645 (js 22 058, admin 4 369, portail 3 891, api 2 048, css 8 192, middleware 1 263) |
| Doublons (SonarCloud) | 1,8 % (bon) |
| Maintenabilité (SonarCloud) | A |
| Fiabilité | C (1 « bug » : outil d'analyse geste-menu.mjs, corrigé sur `phase3-suite`) |
| Sécurité | E (3 alertes : 2 dans l'outil cadrage-visages.py, corrigées sur `phase3-suite` ; 1 fausse alerte connue, textes-pages.py) |
| « Odeurs » de code | 6 285 (3 020 la veille : +2 672 « !important » comptés dans les styles du haut de page copiés dans chaque page — copies générées, pas du code écrit) |
| Essais | 109 essais visiteur, 29 fichiers d'essais de base, batterie 4 552 contrôles verts |

## Forces
1. Une seule façon de dessiner chaque bloc, partagée serveur / page (js/rendu-*.js) : le site est le même avec ou sans programme (180/180 au contrôle dynamique).
2. Sécurité en profondeur : RLS sur toutes les tables, deux facteurs, verrous des téléphones (Extension 158 prête), limites de débit, CSP par page.
3. Essais nombreux et réalistes (navigateur, téléphone et ordinateur, FR/EN, base simulée ; base d'essai Postgres pour le SQL).
4. Peu de doublons (1,8 %) ; notice technique tenue à jour (README-TECHNIQUE.md, DECISIONS.md).

## Faiblesses
1. Fichiers très longs : js/app.js 3 544 lignes, js/espace-mannequin.js 1 954 → difficiles à relire ; à découper par thème (photos, installation, sélection…).
2. Complexité cognitive élevée (16 344) : quelques fonctions très imbriquées (SonarCloud S3776 : 97 fonctions).
3. En-têtes des appels au serveur recopiés 7 fois (enTeteAppareil) : à réunir dans une fonction partagée (règle 5 de CLAUDE.md).
4. actualites.js et evenements.js presque identiques : à réunir (même dessin, même ouverture des détails).
5. Les styles du haut de page copiés dans 40 pages gonflent les alertes SonarCloud : à exclure de l'analyse (fichiers générés) plutôt que de les corriger un par un.

## Cohérence site / code
- Le geste réel (menu → page) n'était pas mesuré : ajouté (scripts/visiteur/geste-menu.mjs).
- La mémoire « photos par le secours » est dans le téléphone seulement ; le serveur écrit toujours l'adresse Cloudflare (sans gravité mesurée : la page s'affiche en 1,2 à 2,3 s quand Cloudflare ne répond pas).
- Mesures Lighthouse de la fiche variables (2,9 à 4,4 s) alors qu'un vrai navigateur en 4G affiche en 1,4 s : à suivre.

## Prochaines étapes proposées
1. Exclure les styles générés de l'analyse SonarCloud ; mettre en ligne les deux petites corrections d'outils.
2. Réunir les en-têtes du serveur et actualites/evenements dans des fichiers partagés.
3. Découper js/app.js en fichiers par thème, une étape à la fois, avec la batterie à chaque étape.
