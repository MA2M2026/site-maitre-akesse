#!/bin/bash
# Tests « comme un visiteur » (décision de la propriétaire, 07/10/2026) : à lancer AVANT
# chaque mise en ligne. Ils remplissent les formulaires et cliquent dans le tableau de bord
# comme une vraie personne, sur téléphone et ordinateur, en français et en anglais.
# La base Supabase, EmailJS et Google Drive sont SIMULÉS : rien n'est écrit pour de vrai.
#   bash scripts/tests-visiteur/lancer.sh
set -e
cd "$(dirname "$0")"
mkdir -p medias
# Photos et petite vidéo d'essai (fabriquées ici, jamais publiées)
[ -f medias/photo3.jpg ] || python3 -c "
from PIL import Image, ImageDraw
for i in range(5):
    im = Image.new('RGB', (900, 1200), (60 + i * 30, 40, 80)); ImageDraw.Draw(im).ellipse((250, 200, 650, 700), fill=(200, 160, 120)); im.save('medias/photo%d.jpg' % i, quality=85)"
[ -f medias/video.mp4 ] || ffmpeg -loglevel error -y -f lavfi -i testsrc=size=480x854:rate=25 -f lavfi -i sine=frequency=440 -t 6 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest medias/video.mp4
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
for t in test-visiteur.js test-inscription.js test-admin.js; do
  echo "########## $t"
  timeout 400 node "$t"
done
