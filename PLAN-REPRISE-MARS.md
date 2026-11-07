# Plan « Reprise de mars » : paiements et comptabilité sur de nouvelles bases

Décisions de la propriétaire (07/11/2026). À lire avant tout travail sur Paiements ou Compta. Aucune étape ne se fait
sans son accord ; une étape à la fois ; tests (base d'essai + tests visiteur) avant toute mise en ligne.

## 1. Décisions prises

| Sujet | Décision |
|---|---|
| Septembre à novembre 2026 | **Période de rodage.** Rien n'est effacé : ces mois sont fermés, en lecture seule, rangés dans « Archives – période de rodage », et n'apparaissent plus dans les écrans de tous les jours. Les impayés de cette période ne sont **jamais réclamés** (une note l'explique). Une copie Excel/PDF de cette période est aussi remise à la propriétaire (choix A). |
| Congés | Décembre 2026, janvier et février 2027 : agence fermée. Aucune mensualité attendue, aucune relance, ces mois ne comptent pas dans la formation. |
| Reprise | **1er mars 2027.** À partir de là, tous les chiffres sont les vrais chiffres. |
| Chaque mois | Les **compteurs du mois** (recettes, dépenses, résultat, à jour / non payé) repartent à zéro le 1er. **L'argent** (caisse, Wave) se **reporte** : solde de fin de mois = solde du début du mois suivant. Un mois passé reste consultable, en lecture seule, une fois clôturé. |
| Formation | **2 niveaux de 9 mois** (niveau 1 puis niveau 2). On peut s'arrêter après le niveau 1. |
| Mois déjà faits | La propriétaire les **saisit elle-même** pour chaque mannequin, dans l'assistant de reprise. |
| Montants | **10 000 FCFA par mois** et **15 000 FCFA d'inscription**, pour toutes. |
| Fin de formation | La mannequin **reste à l'agence** (Book, application, castings), mais ne paie plus de mensualité. |
| Règle comptable | On n'efface jamais une écriture (règles OHADA ; pièces gardées 10 ans) : on corrige par une nouvelle écriture. Une recette n'existe que si l'argent est réellement entré (caisse ou Wave), avec un reçu. |

## 2. État actuel (relevé en lecture seule le 07/11/2026)

- Registre : 29 mannequins (25 actives, 3 suspendues, 1 sortie), 18 « suivies » ; mensualité 10 000 pour toutes.
- Dates d'entrée = jour de la saisie (septembre à novembre 2026), pas la vraie date de début de formation.
- **Manque** : durée de formation, niveau, mois déjà faits ; calendrier des fermetures ; solde d'ouverture des comptes ;
  comptage de caisse à la clôture ; report de solde ; arriérés séparés du mois en cours.
- Inscriptions : 2 seulement enregistrées (30 000 FCFA) alors que 29 mannequins sont inscrites ; l'argent des autres
  n'est jamais passé par le système (d'où l'écart entre la caisse réelle et la caisse du système).
- Aucun mois clôturé (`compta_clotures` vide). Trésorerie au 07/11 : caisse 40 000, Wave 130 000 (oct. 55 000 + nov. 115 000).
- Existe déjà : choix du mois (Compta), clôture mensuelle et « mois figés » (à compléter), accès du comptable en lecture
  seule, reçus numérotés, paiement à l'avance (jusqu'à 3 mois), sorties et suspensions.

## 3. Ce qu'il faut construire (étapes, dans l'ordre)

### Étape 1 — Base de données (fichier `supabase-reprise-mars.sql`, ajout seulement, rejouable)
- **Fiche de formation** par mannequin : niveau (1 ou 2), mois déjà faits dans le niveau, mois de début dans le système,
  statut calculé : *en formation (reste N mois)*, *niveau 1 terminé*, *formation terminée*, *suspendue*, *sortie*.
- **Calendrier des fermetures** de l'agence (mois fermés : décembre, janvier, février).
- **Période de rodage** : marque « archivée » sur septembre–novembre 2026 ; impayés de cette période jamais réclamés.
- **Comptes** : solde d'ouverture daté (bilan d'ouverture du 1er mars) ; écriture « écart constaté à la reprise » avec motif.
- **Clôture** : comptage réel de la caisse et solde Wave saisis, écart et explication, solde reporté, mois verrouillé.
- Règle « attendu du mois » = mannequins en formation, mois non fermé, mois restants > 0 (une seule fonction, utilisée
  partout : Administration, application des mannequins, relances).
- Essais : `essais-reprise-mars.sql` (base d'essai locale, jamais la vraie).

### Étape 2 — Assistant de reprise (Administration › Paiements), pas à pas
1. Compter la caisse (montant réel) ; 2. saisir le solde Wave ; 3. passer chaque mannequin : statut, niveau, mois déjà
faits → le système affiche « il reste N mois » ; 4. confirmer les inscriptions réellement encaissées (les autres vont dans
« Ce qu'on nous doit » ou sont abandonnées, au choix) ; 5. ouvrir mars. Réutilisable pour installer le logiciel chez un client.

### Étape 3 — Paiements : le mois propre
- Tableau du mois calculé avec la règle ci-dessus ; **Arriérés** à part (jamais mélangés au mois en cours).
- Relances : jamais pendant un mois fermé, jamais pour la période de rodage, jamais après la fin de formation.

### Étape 4 — Compta : bilan mensuel et clôture guidée
- Trésorerie en 4 lignes par compte : solde au 1er, + entrées, − sorties, = solde au dernier jour (reporté).
- Clôture en 4 étapes : compter la caisse, comparer Wave, rien en suspens, fermer → **bilan du mois en PDF + Excel**
  pour le comptable, mois verrouillé, solde reporté. Rappel automatique en fin de mois.
- Bilan de l'année (mars à février). Justificatif (photo) obligatoire pour chaque dépense. Reçu automatique pour chaque paiement.
- « Archives – période de rodage » : consultable, en lecture seule, + export Excel/PDF (choix A).

### Étape 5 — Application des mannequins
- « Ma formation : niveau 1, mois 7 sur 9, il reste 2 mois ; prochaine mensualité : mars. » Pendant les congés :
  « Agence fermée jusqu'au 1er mars, aucune mensualité. »

### Étape 6 — Tests et mise en ligne
- Tests visiteur pour chaque parcours (assistant de reprise, mois fermé, fin de formation, clôture, archives, application),
  batterie complète, `/code-review`, puis mise en ligne avec l'accord de la propriétaire, et vérification en ligne.

## 4. Calendrier proposé
- **Novembre 2026** : construire et tester les étapes 1 à 6 ; mise en ligne avant le 30/11.
- **Fin novembre** : la propriétaire reçoit la copie Excel/PDF du rodage ; septembre–novembre passent en archives.
- **Décembre–février** : agence fermée, rien n'est réclamé.
- **1er mars 2027** : la propriétaire fait l'assistant de reprise (caisse comptée, Wave, chaque mannequin) → départ propre.
