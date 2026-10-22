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
# Photos d'essai très difficiles pour la lisibilité des textes posés sur une photo (test-lisibilite-photos.js)
[ -f medias/photo-blanche.jpg ] || python3 -c "
from PIL import Image, ImageDraw
Image.new('RGB', (900, 1200), (18, 16, 15)).save('medias/photo-sombre.jpg', quality=90)
im = Image.new('RGB', (900, 1200), (255, 255, 255)); d = ImageDraw.Draw(im)
for x in range(0, 900, 24): d.rectangle([x, 0, x + 11, 1200], fill=(0, 0, 0))
im.save('medias/photo-rayures.jpg', quality=90)
Image.new('RGB', (900, 1200), (205, 200, 192)).save('medias/photo-claire.jpg', quality=90)
Image.new('RGB', (900, 1200), (255, 255, 255)).save('medias/photo-blanche.jpg', quality=90)"
[ -f medias/video.mp4 ] || ffmpeg -loglevel error -y -f lavfi -i testsrc=size=480x854:rate=25 -f lavfi -i sine=frequency=440 -t 6 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest medias/video.mp4
[[ -f medias/verticale.webm ]] || ffmpeg -loglevel error -y -f lavfi -i testsrc=size=360x640:rate=25 -f lavfi -i sine=frequency=330 -t 5 -c:v libvpx-vp9 -deadline realtime -c:a libopus -shortest medias/verticale.webm
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
# Paquets des fonctions serveur (api/) utilisés par test-note-integration.js : installés s'ils
# manquent (nouvelle copie du dépôt), sans rien changer à package.json
[[ -d ../../node_modules/@aws-sdk/client-s3 ]] || (cd ../.. && npm install --no-audit --no-fund --no-save >/dev/null || echo "⚠️ paquets non installés : test-note-integration.js échouera")
# Lecture des Excel et PDF téléchargés (test-comptabilite-documents.js)
python3 -c "import openpyxl, pypdf" 2>/dev/null || pip install --quiet openpyxl pypdf >/dev/null 2>&1 || echo "⚠️ openpyxl/pypdf non installés : test-comptabilite-documents.js échouera"
# Scripts et styles appelés avec leur dernier numéro de version (?v=), sinon les visiteurs
# gardent l'ancienne version en mémoire (14/10/2026, rapidité)
echo "########## versions des fichiers"; python3 ../versionner.py --verifier
for t in test-visiteur.js test-inscription.js test-contact-recruteur.js test-admin.js test-pages-publiques.js test-espace-experiences.js test-boutique.js test-publications.js test-journal.js test-tri-photos.js test-video-accueil.js test-espace-enregistrement.js test-photos-webp.js test-photos-directes.js test-tableau-protege.js test-note-integration.js test-code-permanent.js test-journal-fichier.js test-affichage-stable.js test-couverture-accueil.js test-surveillance-zoom.js test-tableau-largeur.js test-retour-fenetres.js test-whatsapp-discret.js test-texte-articles.js test-ecran-entree.js test-lien-marche.js test-convocations-serveur.js test-convocations.js test-retour-invitation.js test-apercus.js test-middleware-apercus.mjs test-recherche-book.js test-administration.js test-espace1-cadre.js test-admin-hors-ligne.js test-nouvelle-admin.js test-nouvelle-admin-castings.js test-nouvelle-admin-convocations.js test-nouvelle-admin-mannequins.js test-nouvelle-admin-pilotage.js test-nouvelle-admin-contenu.js test-nouvelle-admin-outils.js test-tableau-du-mois.js test-matrice-mois.js test-recapitulatif.js test-messages.js test-parametres.js test-correction-paiement.js test-suivi-paiements.js test-codes-espace.js test-mensualites.js test-comptabilite.js test-comptabilite-documents.js test-cachets.js test-lisibilite-photos.js test-visuel.js; do
  echo "########## $t"
  if [[ "$t" = test-lisibilite-photos.js ]]; then
    # en petits morceaux (une page, ou 4 pages, à la fois) : d'un seul tenant, le test dépassait
    # 4 minutes et son petit serveur ou son navigateur finissait par ne plus répondre (20/10/2026)
    for c in index.html en/index.html actualites.html en/actualites.html evenements.html en/evenements.html; do
      CIBLES="$c" timeout 600 node "$t"
    done
    for g in $(node -e "const {pages}=require('./pages-publiques');for(let i=0;i<pages.length;i+=4)console.log(pages.slice(i,i+4).join(','))"); do
      PAGES="$g" timeout 600 node "$t"
    done
    continue
  fi
  # le test visuel parcourt 42 pages × 2 écrans : il a sa propre limite de 600 s
  timeout "$([[ "$t" = test-visuel.js ]] && echo 1500 || echo 400)" node "$t"
done
