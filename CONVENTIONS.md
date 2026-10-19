# CONVENTIONS.md — règles courtes du code du site MA2M

À lire avec `CLAUDE.md` et `README-TECHNIQUE.md`.

1. **Aucune couleur en dur.** Les couleurs, polices, rayons et ombres sont écrits une seule fois,
   dans `css/jetons.css`. Partout ailleurs : `var(--fond)`, `var(--encre)`, `var(--rouge-ma2m)`…
2. **Un bloc = un seul endroit.** Le bouton n'existe que dans `css/bouton-ma2m.css` ; une fonction
   utile à plusieurs pages n'existe que dans un fichier partagé (`js/app.js`, `api/_commun.js`…).
   Ne jamais recopier du code.
3. **Un écran superposé déclare son contexte.** Le site est clair ; une zone sombre (étiquette sur
   une photo) porte la classe `contexte-sombre`, qui inverse les variables de texte.
4. **Pas de `style="…"` dans le HTML ni dans le HTML produit par JavaScript** sur les pages à CSP
   stricte : la règle de sécurité les bloque en silence. Utiliser une classe.
5. **Pas de `<style>` dans les pages** (en cours de nettoyage) : un fichier CSS par page si besoin.
6. **Tout changement est testé comme un visiteur** (`bash scripts/tests-visiteur/lancer.sh`) et,
   s'il touche la base, sur la base d'essai locale (`bash scripts/base-essai/lancer.sh`). Un
   nouveau parcours = un nouveau test.
7. **La base se change par un fichier SQL rejouable**, jamais à la main ; une table n'est utilisée
   qu'une fois ses règles d'accès (RLS) écrites et essayées.
