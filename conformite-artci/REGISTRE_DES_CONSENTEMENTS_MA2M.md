# Registre des consentements — MA2M

## Situation actuelle [VÉRIFIÉ]
- Formulaires (candidature, cours de talons, contact) : une case « J'ai pris connaissance de la politique de confidentialité » doit être cochée. **Depuis le 23/11/2026**, chaque candidature, inscription aux cours de talons, message de contact et demande de recruteur garde la **version** de la politique acceptée (ajoutée par le serveur du site) et la **date** de l'accord (posée par la base elle-même) ; ces deux valeurs ne peuvent plus être modifiées ensuite (colonnes `politique_version` et `consentement_le`). Les fiches plus anciennes restent sans preuve : on n'en fabrique pas après coup.
- Depuis le 23/11/2026, sur les pages en écrans, cette case est sur le **dernier écran**, à côté du bouton d'envoi, et un lien « Confidentialité » est visible sur chaque écran [VÉRIFIÉ].
- Cookies : le choix (accepter / refuser) est gardé **dans le navigateur** du visiteur seulement. Google Analytics est refusé par défaut.
- Candidature d'une personne mineure (depuis le 24/11/2026) : le **parent confirme lui-même** la candidature avec un lien personnel envoyé par l'agence ; son nom, la date et sa réponse (confirmée ou refusée) sont enregistrés et ne se modifient pas ensuite. Le site refuse les coordonnées de l'enfant recopiées à la place de celles du parent.
- Accord parental : **enregistré** dans `accords_parents` (demande, nom du parent, date d'acceptation, date de retrait) [VÉRIFIÉ].
- Règlement de l'agence à l'inscription : date d'acceptation enregistrée (`reglement_accepte_le`) [VÉRIFIÉ].

## Proposition pour aller plus loin [À VALIDER]
En plus de la date et de la version (déjà enregistrées), on pourrait enregistrer :
| Champ | Exemple |
|---|---|
| date et heure | 2026-11-22 14:05 |
| version de la politique acceptée | « politique du 22/11/2026 » |
| finalité | « étude de ma candidature » |
| choix exprimé | accepté |

Et **séparer** les autorisations qui ne sont pas nécessaires à la candidature (ex. publication dans The Book, communication) : elles seraient demandées plus tard, à l'inscription, chacune par une case distincte, non précochée.
**[JURISTE]** : le consentement n'est pas la base juridique par défaut de tous les traitements (voir CARTOGRAPHIE).
