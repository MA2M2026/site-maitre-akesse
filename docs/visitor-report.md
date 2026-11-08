# Rapport « le site vu par ses visiteurs » — phase 3 V1 (08/11/2026)

Site en ligne : https://www.maitreakessemodelmanagement.com (version `7b3ea54`). Lecture seule : aucun formulaire
envoyé, écritures bloquées (seule la statistique de visite `page_views` a été arrêtée, rien d'écrit).

## Méthode

- `scripts/visiteur/parcours.mjs` : 6 visiteurs × iPhone, Android, iPad, ordinateur ; 4G lente (+ 3G rapide sur
  iPhone) ; FR et EN ; capture à chaque étape, erreurs de la page, requêtes en échec, LCP / CLS / TTFB.
  iPhone et iPad : moteur Chrome en mode iPhone / iPad (le moteur Safari, WebKit, ne peut pas être téléchargé dans
  cet environnement : le domaine de téléchargement de Playwright est bloqué).
- `scripts/visiteur/liens.mjs` : tous les liens internes du plan du site (110 pages, 250 adresses).
- Lighthouse (téléphone, 4G lente simulée), médiane de 5 mesures par page.

## Résultats

| Contrôle | Résultat |
|---|---|
| Parcours (styliste, jeune mannequin, recruteur, promoteur, marque, directeur artistique) | 30/30 PASS (après correction de 2 erreurs de l'outil) |
| Erreurs de page (console, programmes) | 0 |
| Requêtes en échec | 0 |
| Liens cassés | 1 / 250 (corrigé, en attente de mise en ligne : `test-fiche-video.mjs`) |

Lighthouse, téléphone 4G lente (budget LCP ≤ 2,5 s, CLS ≤ 0,1) :

| Page | LCP médian | CLS | Verdict |
|---|---|---|---|
| /mannequins | 1,94 s | 0,052 | PASS |
| /agenda | 2,46 s | 0,086 | PASS (juste) |
| /book/assoa-marie-france | 2,65 s | 0,000 | FAIL (léger) |
| /contact | 2,92 s | 0,036 | FAIL |
| /qui-sommes-nous | 4,72 s | 0,000 | FAIL |
| / | 5,30 s | 0,001 | FAIL |
| /en/mannequins | 5,84 s | 0,070 | FAIL (bandeau des cookies affiché après tous les programmes) |

## Forces

1. Chaque visiteur trouve ce qu'il cherche, sur tous les appareils, en FR et EN (30/30).
2. Pages écrites par le serveur : contenu complet sans attendre la base ; 0 erreur de page ; 180/180 au contrôle dynamique.
3. The Book et les fiches rapides (1,4 à 2,3 s en 4G lente) ; liens quasi parfaits (1 cassé sur 250).
4. Accueil vivant (V4) en place, mineures protégées.

## Faiblesses (de la plus grave à la moins grave)

| # | Gravité | Page | Appareil | Constat | Capture | Correction proposée |
|---|---|---|---|---|---|---|
| 1 | Majeure | /selection | tous | la page saute beaucoup (CLS 1,2 à 1,6) et s'affiche tard (LCP 5,3 s ; 12,5 s en 3G) | recruteur_*_page-sélection.png | réserver la place de la liste et du formulaire ; liste écrite tout de suite depuis la mémoire du téléphone |
| 2 | Majeure | /evenements | téléphone | 7,9 à 8,3 s en 4G lente, 15,5 s en 3G | promoteur_iPhone_*_événements.png | photo principale annoncée et réduite ; feuille de style du haut dans la page |
| 3 | Majeure | / et /qui-sommes-nous | téléphone | 4,7 à 5,3 s (Lighthouse) | — | même méthode que The Book (styles du haut, photo annoncée) |
| 4 | Majeure | /en/mannequins (et autres EN) | téléphone | bandeau des cookies = plus grand élément, affiché après tous les programmes (5,8 s) | — | bandeau écrit plus tôt (ou plus discret) |
| 5 | Majeure | fiche, sélection, formulaires | téléphone | « Télécharger l'application » + bulle WhatsApp cachent le nom de la mannequin et des champs | directeur-artistique_iPhone_*_fiche-photos-.png | bandeau plus bas / plus petit, ou seulement après un défilement ; jamais sur un formulaire |
| 6 | Mineure | /agenda, /services, /partenaires, /integrer-agence | téléphone | sauts de page 0,15 à 0,30 (surtout en 3G) | — | place réservée aux blocs remplis tard |
| 7 | Mineure | fiche | téléphone | grand vide rouge sous le menu, avant « Nos mannequins » | idem 5 | marge réduite |
| 8 | Mineure | /selection | — | pas de zone principale (`<main>`) : moins bien lue par les lecteurs d'écran | — | ajouter `<main>` |
| 9 | Mineure | fiche | — | phrase dans la case « lien vidéo » → lien cassé | — | CORRIGÉ (en attente de mise en ligne) |

## Suite

Corriger 1 → 8 dans cet ordre, mesurer avant / après (même méthode), puis mise en ligne groupée.
