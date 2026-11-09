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
4. **Fiches des mannequins (W3C)** : la photo annoncée en avance passait devant une balise qui doit être la première ;
   et le nom (titre) était à l'intérieur d'un « bouton ». C'est maintenant la grande photo elle-même qui est le bouton
   de la galerie : même aspect, même geste (toucher, clic ou clavier), vérifié dans un vrai navigateur.
5. **Application des mannequins** : un compte sans fiche de mannequin pouvait provoquer une erreur (trouvée dans le
   journal). Corrigé : l'écran « Ce compte n'est pas un compte mannequin » reste affiché.
6. **SonarCloud** : les styles du haut de chaque page sont des copies générées automatiquement des fichiers de styles ;
   leurs remarques étaient comptées deux fois (3 038 sur 6 348). Elles ne sont plus comptées qu'une fois, dans les
   fichiers d'origine.

## 3. Mise en ligne et vérification

(complété après la mise en ligne)

## 4. Ce qui n'a PAS été fait, volontairement

- **Rapidité de la base (conseiller Supabase)** : 89 règles de sécurité « pourraient être plus rapides » et 85 index
  manquent. Les tables sont petites (à l'échelle de l'agence) : le gain serait invisible, et réécrire 89 règles de
  sécurité est risqué (la panne des photos du 08/11 venait d'une réécriture de règles). À reconsidérer seulement si la
  base grossit beaucoup.
- **Vérification des mots de passe volés** : réservée à l'offre payante de Supabase. À la place : 8 caractères au moins.
- **Intégrité des scripts extérieurs (Mozilla Observatory, −5 points)** : Google Analytics et Sentry changent leurs
  fichiers sans prévenir ; leur imposer une empreinte casserait la mesure des visites. La note reste A+.

## 5. Notes des contrôles extérieurs

(complété après la mise en ligne)
