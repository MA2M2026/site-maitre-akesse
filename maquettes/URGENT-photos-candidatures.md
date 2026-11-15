# URGENT (15/11/2026) : photos des candidatures absentes dans l'Administration

Constat de la propriétaire : les photos des candidates arrivent bien dans Google Drive, mais l'Administration ne les
montre pas toujours (cartes « IL », « SM », « DS » sans photo).

Mesuré dans la base (lecture seule, 15/11) : sur les 15 candidatures des 20 derniers jours, **3 seulement** ont des
lignes dans `casting_photos` (14/11 AKAMA : 3, 11/11 Tivoli : 3) ; les 12 autres en ont **0**, alors que leurs photos
sont dans Drive.

Piste (js/formulaire-candidature.js, autour de la ligne 450) : `envoyerPhotosVersDrive` renvoie `echec` ou une liste
`liens` vide, même quand le script Google a bien rangé les photos. Dans ce cas, AUCUNE ligne `casting_photos` n'est
écrite. Il n'y a pas d'erreur « DIAGNOSTIC casting_photos insert » au journal : l'enregistrement n'est donc jamais
tenté. Une seule trace au journal : « POST script.google.com … Load failed » (2 fois, 10/11).
À vérifier :
- la réponse du script (lien du dossier, liens des photos) : est-elle lisible ? est-elle trop lente (délai dépassé) ?
- les cas « Photo n : illisible » vus dans les jauges.

Correction souhaitée :
1. Ne plus perdre les liens : le script Google écrit lui-même les lignes, ou la page réessaie de lire la réponse.
2. Rattraper les 12 candidatures déjà touchées : retrouver leurs photos dans Drive (dossier au nom de la personne) et
   créer les lignes `casting_photos`, avec l'accord de la propriétaire.
3. Un essai visiteur : réponse du script lente ou incomplète → les photos apparaissent quand même dans l'Administration.

## Exigence de la propriétaire (15/11/2026) : une solution DÉFINITIVE

« Au début ça s'affichait, maintenant ça s'affiche une fois sur deux. Il faut que ce soit réglé une fois pour toutes. »
Cela vaut pour TOUS les envois d'images et de vidéos vers Drive :
- candidatures aux castings ;
- « Intégrer l'agence » ;
- inscriptions au cours de talons.

Attendu :
1. **Ne plus dépendre de la réponse renvoyée au téléphone de la candidate.** Le lien de chaque photo doit être
   enregistré côté serveur (par le script Google lui-même, ou par une fonction api/ qui le vérifie), même si la
   connexion de la candidate coupe juste après l'envoi.
2. **Un seul outil partagé** pour les trois formulaires, au lieu de trois copies (règle 5 de CLAUDE.md).
3. **Un filet de sécurité dans l'Administration** : une candidature sans photo affiche « Photos dans Drive » avec le
   lien du dossier, et un bouton « Récupérer les photos depuis Drive » qui rattache les fichiers trouvés.
4. **Rattrapage** de toutes les candidatures et inscriptions déjà touchées.
5. **Un contrôle qui prévient** : une candidature arrivée sans photo enregistrée → une alerte dans le journal des erreurs
   et une notification, pour ne plus le découvrir par hasard.
6. **Des essais visiteur** pour chaque formulaire : réponse de Google lente, coupée ou incomplète → les photos
   apparaissent quand même dans l'Administration.
