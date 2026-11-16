# « On répète » — principe du film validé par la propriétaire (16/11/2026)

Film de l'agence fait à partir des vidéos WhatsApp des répétitions du défilé. **Validé** (« Excellent, ça me
convient ») après trois versions. À reprendre comme modèle pour tout film fait de vraies vidéos (répétition,
casting, coulisses, événement).

## L'idée

Des répétitions, c'est répéter. Le film joue sur ce mot :
« On répète. » → « On corrige. » → « On recommence. » (l'image rembobine et rejoue le même pas) →
« Jusqu'à la marche juste. » → silence → le défilé éclate en couleur.

Une idée simple, tirée du sujet lui-même, qui donne une histoire en 15 secondes.

## Le déroulé (1 min 24, vertical 1080 × 1920, HD)

| Temps | Ce qu'on voit |
| --- | --- |
| 0-16 s | Noir et blanc sombre : la salle, les consignes, les pieds, l'attente. Les quatre phrases en très grand. |
| 15,5 s | Une demi-seconde de noir et de silence. |
| 16 s | Éclair rouge (rouge du logo), traînée de lumière, les lettres « MA2M » remplies d'images, puis on traverse la lettre. |
| 18-22 s | Trois mannequins côte à côte (écran partagé en trois), qui glissent en place. |
| 22-44 s | Une silhouette par mesure : marche à vitesse normale, puis ralenti sur la pose, petit coup de zoom au début. |
| 44-52 s | Respiration : grands ralentis (robe à traîne qui tourne, pose mains sur les hanches), puis coupes très rapides. |
| 52-64 s | Deuxième élan : duos, écran partagé en deux, groupes. |
| 64-68 s | Une pose figée par temps, avec éclair blanc et bruit d'appareil photo. |
| 68-72 s | La dernière pose au ralenti, qui s'éteint. |
| 72-84 s | Logo, devise « L'élégance se travaille. Le talent se révèle. » en très grand, puis site, WhatsApp, téléphone, réseaux. |

## Ce qui a plu, et ce qui n'a pas plu

- **Refusé (version 1)** : film lent, sombre, polices Cormorant dorées et petites capitales espacées, jugées
  « trop IA ». Musique orchestrale lente.
- **Refusé** : la musique afro-house (version 2). **Gardée** : une **techno dynamique** (`musique3.py`), qui pousse
  dès la première seconde.
- **Demandé et fait** : cadrage qui suit le mannequin (les cases des écrans partagés tombaient à côté), rendu plus
  « studio de cinéma », **logo transparent en haut à gauche pendant tout le film** pour qu'on ne puisse pas
  s'approprier la vidéo en la recadrant.
- **Refusé** : le logo dans un médaillon rond. On pose le logo tel quel, en transparence, comme une signature.
- **Pas nécessaire** : découper la silhouette pour flouter tout le fond ; le flou des bords suffit.

## La direction artistique

- **Police** : Big Shoulders Display (la police des titres du site), très grande, serrée, alignée à gauche, en blanc.
  Pas de mot isolé d'une autre couleur, pas de petites capitales espacées, pas de doré.
- **Couleurs** : noir et blanc sombre au début ; ensuite couleur « studio blanc » (murs lumineux, noirs francs,
  ombres un peu froides, lumières un peu chaudes, halo doux). Rouge du logo `#C8102E` seulement pour les éclairs.
- **Mouvement** : chaque coupe tombe sur un temps de la musique (120 battements par minute : 0,5 s par temps, 2 s
  par mesure). Rampes de vitesse, coups de zoom, coupes « filées », traînées de lumière sur les grands moments.
- **Rien d'inventé** : seulement les vraies images, recadrées, ralenties (images intermédiaires calculées),
  accélérées ou rembobinées. Aucun corps ni mouvement fabriqué.

## Les outils (dans ce dossier)

| Fichier | Rôle |
| --- | --- |
| `plans2.py` | le découpage : chaque plan (rush, moment, durée, vitesse, cadrage, effets) et les textes |
| `monter2.py` | le montage image par image (`preparer`, `planche`, `images 12 30 …`, `film`) |
| `suivi.py` | suivi automatique du mannequin (détecteurs de silhouettes et de visages d'OpenCV 4, rien à télécharger) |
| `musique3.py` | la musique techno originale, libre de droits (composée par le programme) |
| `polices/` | Big Shoulders Display (licence libre SIL OFL) |

Les versions refusées restent à côté pour mémoire (`plans.py`, `monter.py`, `musique.py`, `musique2.py`).

Pour refaire le film :

```
python3 monter2.py preparer      # ralentis fluides (quelques minutes)
python3 monter2.py planche       # images de contrôle : TOUJOURS les regarder avant le long rendu
python3 monter2.py film          # → sortie/v2-muet.mp4 (environ 15 minutes)
python3 musique3.py              # → sortie/v3-musique.wav
ffmpeg -i sortie/v3-musique.wav -af loudnorm=I=-13:TP=-1:LRA=11 sortie/v3-musique-norm.wav
ffmpeg -i sortie/v2-muet.mp4 -i sortie/v3-musique-norm.wav -map 0:v -map 1:a -c:v libx264 -crf 18 -c:a aac -b:a 256k -shortest film.mp4
```

Il faut OpenCV **4** (`pip install opencv-python-headless==4.10.0.84`), car la version 5 n'a plus les détecteurs.

## Règles importantes

- **Les vidéos ne vont jamais sur GitHub** (`.gitignore`) : le dépôt est public et des mineurs sont à l'image.
- Pour ce film, la propriétaire a autorisé la présence de mineurs (exception écrite dans `../GUIDE-VIDEOS.md`).
- Livrer la version HD (moins de 400 Mo) et un aperçu léger en 720p marqué « ne pas publier ».
- Volume final : -13 LUFS.
