# Consignes de communication avec la propriétaire du site

- **Une seule chose à la fois.** Ne pas enchaîner plusieurs actions ou
  plusieurs informations d'un coup. Proposer une étape, attendre sa
  confirmation, puis passer à la suivante.
- **Si une phrase n'est pas claire, demander avant d'agir** — ne jamais
  supposer et exécuter quelque chose qui n'a pas été confirmé.
- La propriétaire n'est pas technique. Éviter le jargon, expliquer
  simplement, sans empiler les explications.
- Ne pas répéter des formules du type "à partir de maintenant je ferai
  ça" sans que ça se traduise réellement dans le comportement — le
  changement doit être visible dans la façon de travailler, pas juste
  annoncé.
- Toujours répondre en français.

# Règles de qualité du code (décision de la propriétaire, 06/10/2026)

Aucun développeur humain ne relit le code : ces règles remplacent cette
relecture et s'appliquent à chaque modification, sans exception.

1. **Une modification à la fois, une mise en ligne par jour au plus**
   quand c'est possible (regrouper). L'offre gratuite Vercel limite le
   nombre de mises en ligne par jour (blocage du 05/10/2026), et chaque
   envoi sur la branche en compte une.
2. **Relecture avant chaque mise en ligne** : relire soi-même tout le
   changement comme le ferait un relecteur exigeant (bugs, sécurité,
   cas oubliés) — utiliser `/code-review` sur le changement — et corriger
   avant de publier.
3. **Tester avant de publier** : syntaxe (`node --check`), empreintes CSP
   (`scripts/verifier-csp.py`), et essai dans un vrai navigateur des pages
   touchées, sur téléphone et ordinateur, sans écriture réelle.
4. **Vérifier après la mise en ligne** que le site en ligne contient bien
   le changement et fonctionne.
5. **Ne jamais recopier du code** : une fonction utile à plusieurs pages
   va dans un fichier partagé (ex. `convertirSiHeic` dans `js/app.js`).
   Nettoyage de l'existant en cours, étape par étape (étape 1 faite le
   05/10/2026 ; étape 2 : préparation des photos et vérification des
   administrateurs).
6. **Jamais de suppression de photos de mannequins sans le clic de
   l'agence.**
7. **Tenir `README-TECHNIQUE.md` à jour**, pour qu'une autre personne
   puisse reprendre le site un jour.
8. **Contrôle extérieur SonarQube Cloud** (décision de la propriétaire,
   06/10/2026) : après chaque mise en ligne, attendre la nouvelle analyse
   automatique du projet `MA2M2026_site-maitre-akesse` sur sonarcloud.io
   (API publique, par ex. `api/measures/component` et `api/issues/search`),
   vérifier que les notes ne baissent pas et qu'aucun nouveau problème de
   sécurité ou de fiabilité n'apparaît, et corriger les vrais problèmes
   (en expliquant simplement les fausses alertes).
