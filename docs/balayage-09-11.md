# Grand balayage du site — nuit du 08 au 09/11/2026

Demandé par la propriétaire : « nettoyer tous les doublons, déceler toutes les erreurs et cassures, sans précipitation,
puis les contrôles extérieurs pour viser A+ ». Rien de nouveau n'a été ajouté : seulement du nettoyage et des
corrections, sans changer ce que voient les visiteurs.

## 1. Ce qui a été cherché, et trouvé

| Recherche | Résultat |
|---|---|
| Code recopié (SonarCloud + relecture) | 3 recopies réelles trouvées → réunies (voir 2) |
| Fichiers qui ne servent plus | aucun : chaque fichier sert encore (site, Administration ou outils de l'agence) |
| Liens cassés (114 pages, 264 adresses, FR + EN) | 0 |
| Erreurs réelles du journal (7 jours) | 1 vraie erreur de programme → corrigée ; le reste vient des connexions des visiteurs (réseau coupé, photos Cloudflare injoignables : le secours prend le relais) ou d'anciennes versions gardées par un téléphone le jour d'une mise en ligne |
| Validateur W3C | 2 vraies erreurs sur les fiches des mannequins → corrigées ; 1 fausse alerte connue (« mask », propriété que le validateur ne connaît pas encore) |
| Conseillers Supabase | aucune alerte grave ; voir 4 |

## 2. Ce qui a été nettoyé et corrigé

1. **Traductions anglaises** : deux fonctions (empreinte d'un texte) étaient écrites deux fois, une pour les pages et une
   pour le serveur. Réunies dans un seul fichier partagé (js/partage.js) ; résultat identique au caractère près.
2. **Pages Actualités et Événements** : leur chargement (environ 40 lignes) était recopié d'une page à l'autre. Réuni
   (js/publications-lecture.js) ; nouvel essai : un lien direct vers une actualité ou un événement (depuis l'accueil
   ou un partage) ouvre bien la fiche.
3. **Appels au serveur** : la ligne d'en-têtes (session + appareil) était recopiée 7 fois (envoi des photos, images du
   site, suppression d'une mannequin…). Une seule fonction maintenant (js/supabase-config.js).
4. **Fiches des mannequins (W3C)** : la photo annoncée en avance passait devant une balise qui doit être la première
   de la page. Corrigé (invisible pour les visiteurs). La 2e remarque du validateur (le nom de la mannequin est dans
   la zone qui ouvre la galerie) n'a PAS été changée : voir « À décider par la propriétaire ».
5. **Application des mannequins** : un compte sans fiche de mannequin pouvait provoquer une erreur (trouvée dans le
   journal). Corrigé : l'écran « Ce compte n'est pas un compte mannequin » reste affiché.
6. **SonarCloud** : les styles du haut de chaque page sont des copies générées automatiquement des fichiers de styles ;
   leurs remarques étaient comptées deux fois (3 038 sur 6 348). Elles ne sont plus comptées qu'une fois, dans les
   fichiers d'origine.

## 3. Mise en ligne et vérification

- Mise en ligne le 09/11/2026 vers 9h15 GMT (version d3dea6f), après :
  - la batterie complète d'essais : tous verts ;
  - la base d'essai ;
  - la relecture ;
  - le contrôle de SonarCloud sur la demande de mise en ligne : 2 fautes de prudence trouvées par lui, corrigées avant.
- **Vérifié en ligne :**
  - contrôle complet du site : 180 vérifications sur 180 ;
  - photos présentes sur l'accueil (FR/EN), le Book, une fiche, Actualités, Événements et Contact ;
  - Cours de talons et Intégrer l'agence : les pages répondent ;
  - Administration : elle répond.
- **Actualités et Événements, dans un vrai navigateur** (FR et EN, téléphone et ordinateur) :
  - cartes affichées ;
  - fiche ouverte au toucher ;
  - lien direct vers une publication : la fiche s'ouvre ;
  - 0 erreur.

## 4. À décider par la propriétaire

- **Le mot « Femme » / « Homme » sur la grande photo des fiches** : en essayant de corriger la 2e remarque du
  validateur, l'essai de lisibilité a mesuré ce petit mot pour la première fois (il était caché à l'essai). Sur une
  photo très claire à cet endroit, il se lit mal (contraste 2,5 à 3,6 ; il faut 4,5). Proposition : un léger fond sombre
  derrière ce mot seulement, ou un voile un peu plus foncé en bas de la photo. Cela change un peu l'aspect des fiches :
  rien n'a été fait sans votre accord, la fiche est restée exactement comme avant.

## 5. Ce qui n'a PAS été fait, volontairement

- **Rapidité de la base (conseiller Supabase)** : 89 règles de sécurité « pourraient être plus rapides » et 85 index
  manquent. Les tables sont petites (à l'échelle de l'agence) : le gain serait invisible, et réécrire 89 règles de
  sécurité est risqué (la panne des photos du 08/11 venait d'une réécriture de règles). À reconsidérer seulement si la
  base grossit beaucoup.
- **Vérification des mots de passe volés** : réservée à l'offre payante de Supabase. À la place : 8 caractères au moins.
- **Intégrité des scripts extérieurs (Mozilla Observatory, −5 points)** : Google Analytics et Sentry changent leurs
  fichiers sans prévenir ; leur imposer une empreinte casserait la mesure des visites. La note reste A+.

## 6. Notes des contrôles extérieurs (après la mise en ligne)

| Contrôle | Note |
|---|---|
| Mozilla Observatory (sécurité des en-têtes) | **A+** (130 points) |
| SSL Labs (connexion sécurisée) | **A+** sur le 1er serveur, A sur le 2e (serveur de Vercel, réglage hors de notre portée) |
| SonarCloud (qualité du code) | **A / A / A** : 0 bug, 0 faille, doublons 1,8 % → **1,7 %** |
| Lighthouse, ordinateur (accueil, Book, fiche, contact) | rapidité **94 à 98**, accessibilité **100**, référencement **100** |
| Lighthouse, téléphone (mêmes pages) | rapidité **89 à 98**, accessibilité **100**, référencement **100** |
| Lighthouse « bonnes pratiques » | 96 mesuré ici, **100 en réalité** : les 4 points perdus viennent de la machine de contrôle, dont le réseau bloque Google Analytics et Sentry |
| Validateur W3C | 0 erreur sur l'accueil (FR/EN) ; une seule fausse alerte connue ailleurs (« mask ») ; la balise d'en-tête des fiches est corrigée. Les autres pages n'ont pas pu être revérifiées : le validateur a limité le nombre de vérifications depuis cette machine |

**À savoir** : le réglage qui devait empêcher SonarCloud de compter deux fois les remarques des styles copiés n'a pas été
pris en compte (l'analyse automatique de SonarCloud ne lit pas ce réglage dans le fichier). Cela ne change pas la note
(A). Pour l'appliquer, il faut cocher ce réglage dans le site de SonarCloud (Administration → Analysis Scope).
