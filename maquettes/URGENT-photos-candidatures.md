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
