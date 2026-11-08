# Rapport des films (phase 3, V2 — 08/11/2026)

Méthode : signaux mesurés par `ffprobe`/`ffmpeg` (coupes `scene>0.3`, noirs `blackdetect d=0.1 pix_th=0.10`, images
figées `freezedetect -60dB 0.5 s`, silences `silencedetect -35dB 0.5 s`) + planches d'images (1 image/s) **regardées**.
Ce qui relève du goût (rythme, émotion, accord avec la musique) demande l'œil de la propriétaire.
Planches : `evidence/videos/*-planche.jpg` (hors dépôt). Script : voir l'historique de la session (analyse.sh).

## Le film de l'accueil (R2 `site/video-accueil/1792496017733.mp4`)
| Mesure | Valeur | Avis |
|---|---|---|
| Durée, format | 90 s, 370 × 640, **60 images/s**, son AAC | 60 images/s inutile pour un petit format vertical |
| Poids | **18,3 Mo** (1,6 Mbit/s) | très lourd pour un téléphone en 4G |
| Démarrage rapide (`moov` en tête) | oui | ✅ |
| Noirs (0,1 s) | 14 passages (3,8 s ; 11,3 ; 26,5 ; 32,1 ; 37,9 ; 51,3 ; 52,3 ; 60,9 ; 62,9 ; 65,9 ; 69,0 ; 71,1 ; 76,3 ; 82,4) | transitions entre plans, courtes : acceptables |
| Silence | 0 – 0,8 s | début muet très court : acceptable |
| Images figées | aucune | ✅ |
| Ouverture (vue) | 0 – 3,8 s : une personne assise avec un nom en surimpression | **ouverture faible** : les plus belles images (défilé, tenues finales) arrivent à la fin |

**Proposition 1 (objective, sans rien couper)** : réencodage 30 images/s, H.264 CRF 27, `+faststart` →
**6,8 Mo (−63 %)**, image comparée à 30 s : identique à l'œil (`evidence/videos/comparaison-30s.jpg`).
**Proposition 2 (à valider)** : commencer par un plan fort du défilé (vers 4 – 7 s ou les tenues finales), garder
45 – 60 s au lieu de 90 s.

## Films des réseaux (`assets/reseaux/`, non utilisés par le site)
| Film | Durée, format, poids | Signaux | Avis |
|---|---|---|---|
| ma2m-film-motion (+ vertical) | 60 s, 1080p, 51 / 48 Mo | noir 0 – 1,07 s ; noirs 20,2 / 26,2 s (0,27 s) ; figé 42,9 – 43,5 et 56 – 57,2 s | ouverture : 1 s de noir avant « FORMER » ; fin « Parlons de » + logo ~5 s : couper le noir du début |
| ma2m-film-hd (+ musique) | 60 s, 1080p, 32 / 34 Mo | noirs 13,2 – 13,8 s ; 20,6 – 20,9 ; 43,6 – 44,0 | noir de 0,67 s à 13,2 s : à raccourcir |
| ma2m-film-vertical (+ musique) | 31 s, vertical, 5–6 Mo | figé 0 – 0,6 s puis 16,7 – 19,8 s (≈ 3 s en 4 morceaux) ; silence final 30,8 – 31,3 s | **3 s figées au milieu** : à couper |
| osiris-n-goran-motion | 30 s, vertical, 17,6 Mo | figé 11,3 – 13,2 s et 16,9 – 17,8 s ; fin figée 28 s + silence 29 – 30 s | images figées ≈ 3 s : à couper (fichier à ne pas modifier sans accord) |
| sensuella-kante-motion | 31,5 s, vertical, 19,6 Mo | noirs 16,9 – 17,3 s ; figé 21,9 – 24,4 s et 29,1 – 31,2 s | fin figée 2 s : raccourcir |

## Livraison sur le site (règles)
Affiche (image) d'abord, vidéo jamais l'élément le plus grand mesuré ; `muted playsinline` ; pas de lecture
automatique en économie de données ; `+faststart` ; une version ≤ 720p pour téléphone.

## Décisions attendues de la propriétaire (STOP S6)
1. Remplacer le film de l'accueil par la version allégée (même contenu, 6,8 Mo) ? Rien n'est remplacé sans accord.
2. Raccourcir / changer l'ouverture du film de l'accueil ? (je prépare les versions et les planches avant / après)
