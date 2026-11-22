# Registre des consentements — MA2M

## Situation actuelle [VÉRIFIÉ]
- Formulaires (candidature, cours de talons, contact) : une case « J'ai pris connaissance de la politique de confidentialité » doit être cochée. **Rien n'est enregistré** : ni la date, ni la version du texte, ni le choix.
- Cookies : le choix (accepter / refuser) est gardé **dans le navigateur** du visiteur seulement. Google Analytics est refusé par défaut.
- Accord parental : **enregistré** dans `accords_parents` (demande, nom du parent, date d'acceptation, date de retrait) [VÉRIFIÉ].
- Règlement de l'agence à l'inscription : date d'acceptation enregistrée (`reglement_accepte_le`) [VÉRIFIÉ].

## Proposition [À VALIDER]
Pour chaque formulaire public, enregistrer avec la fiche :
| Champ | Exemple |
|---|---|
| date et heure | 2026-11-22 14:05 |
| version de la politique acceptée | « politique du 22/11/2026 » |
| finalité | « étude de ma candidature » |
| choix exprimé | accepté |

Et **séparer** les autorisations qui ne sont pas nécessaires à la candidature (ex. publication dans The Book, communication) : elles seraient demandées plus tard, à l'inscription, chacune par une case distincte, non précochée.
**[JURISTE]** : le consentement n'est pas la base juridique par défaut de tous les traitements (voir CARTOGRAPHIE).
