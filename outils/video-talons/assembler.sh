#!/bin/bash
# Assemblage final d'un film (13/11/2026, vidéos d'Alicia Kouadio) : les images f00000.jpg… (30 i/s) et la piste
# son.m4a d'un dossier rendu par fabrique-talons.js → MP4 H.264 haute qualité (crf 16, profil high, couleurs BT.709).
#   bash assembler.sh <dossier d'images> <sortie.mp4> <largeur:hauteur>   (1080:1920 vertical, 1920:1080 YouTube)
# Toujours un dossier d'images NEUF par rendu : des images restées d'un rendu plus long s'ajouteraient à la fin.
set -euo pipefail
D="${1:?dossier des images}"; SORTIE="${2:?fichier de sortie}"; TAILLE="${3:?largeur:hauteur}"
nice -n 5 ffmpeg -loglevel error -y -framerate 30 -i "$D/f%05d.jpg" -i "$D/son.m4a" \
  -vf "scale=$TAILLE:flags=lanczos:out_color_matrix=bt709,format=yuv420p" -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:v libx264 -preset slow -crf 16 -profile:v high -level 4.2 -tune film -c:a copy -movflags +faststart "$SORTIE"
