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
[[ -f medias/verticale.webm ]] || ffmpeg -loglevel error -y -f lavfi -i testsrc=size=360x640:rate=25 -f lavfi -i sine=frequency=330 -t 5 -c:v libvpx-vp9 -deadline realtime -c:a libopus -shortest medias/verticale.webm
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
# Paquets des fonctions serveur (api/) utilisés par test-note-integration.js : installés s'ils
# manquent (nouvelle copie du dépôt), sans rien changer à package.json
[[ -d ../../node_modules/@aws-sdk/client-s3 ]] || (cd ../.. && npm install --no-audit --no-fund --no-save >/dev/null || echo "⚠️ paquets non installés : test-note-integration.js échouera")
# Scripts et styles appelés avec leur dernier numéro de version (?v=), sinon les visiteurs
# gardent l'ancienne version en mémoire (14/10/2026, rapidité)
echo "########## versions des fichiers"; python3 ../versionner.py --verifier
for t in test-visiteur.js test-inscription.js test-contact-recruteur.js test-admin.js test-pages-publiques.js test-espace-experiences.js test-boutique.js test-publications.js test-journal.js test-tri-photos.js test-video-accueil.js test-espace-enregistrement.js test-photos-webp.js test-photos-directes.js test-tableau-protege.js test-note-integration.js test-code-permanent.js test-journal-fichier.js test-affichage-stable.js test-apercus.js test-middleware-apercus.mjs test-recherche-book.js test-visuel.js; do
  echo "########## $t"
  # le test visuel parcourt 42 pages × 2 écrans : il a sa propre limite de 600 s
  timeout "$([[ "$t" = test-visuel.js ]] && echo 700 || echo 400)" node "$t"
done
