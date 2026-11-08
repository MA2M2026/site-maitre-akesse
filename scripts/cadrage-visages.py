#!/usr/bin/env python3
"""Cadrage automatique des grandes photos des fiches (08/11/2026, demande de la propriétaire : « que ça prenne au moins
le visage », automatique, rien à gérer dans l'Administration).

La grande photo d'une fiche occupe tout l'écran (object-fit: cover) : sur ordinateur, une photo en portrait est
recadrée en hauteur, et le visage pouvait tomber sous le nom ou hors de l'écran. Ce programme lit la grande photo de
chaque fiche du site en ligne (lecture seule), y repère le visage (détecteur YuNet d'OpenCV, licence MIT, téléchargé
depuis huggingface.co/opencv/face_detection_yunet) et écrit js/cadrages-photos.js : pour chaque photo, la hauteur
(0 à 100 %, par pas de 5) qui place le visage vers le tiers haut de l'écran, au-dessus du nom. Photo sans visage
trouvé, ou visage déjà tout en haut : rien (cadrage d'avant, le haut de la photo).

  pip install opencv-python-headless numpy
  python3 scripts/cadrage-visages.py            (puis versionner.py, et une mise en ligne)

À relancer quand de nouvelles photos principales sont publiées (une photo inconnue garde le cadrage d'avant).
"""
import json, os, re, sys, urllib.request
import cv2, numpy as np

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://www.maitreakessemodelmanagement.com'
# (modèle gardé dans un dossier du projet ignoré par git, pas dans un dossier temporaire partagé — SonarCloud)
MODELE = os.path.join(RACINE, '.cache', 'yunet-2023mar.onnx')
URL_MODELE = 'https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx'
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126 MA2M-cadrage'}
# écrans d'ordinateur de référence (largeur, hauteur de la grande photo : 86 % de l'écran, 820 px au plus)
FENETRES = [(1440, 774), (1366, 660), (1920, 820), (1280, 640)]
HAUTEUR_VISEE = 0.33  # le visage vers le tiers haut de la photo à l'écran (le nom est en bas à gauche)


def lire(u, binaire=False):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r:
        d = r.read()
        return d if binaire else d.decode('utf-8', 'replace')


def visage(img, det):
    h, w = img.shape[:2]
    for echelle in (1.0, 0.5, 1.5):
        im2 = cv2.resize(img, (int(w * echelle), int(h * echelle)))
        det.setInputSize((im2.shape[1], im2.shape[0]))
        _, faces = det.detect(im2)
        if faces is not None and len(faces):
            f = max(faces, key=lambda f: float(f[2] * f[3] * f[14]))
            return (float(f[1]) + float(f[3]) / 2) / echelle / h
    return None


def cadrage(fy, w, h):
    ps = []
    for W, H in FENETRES:
        hs = W * h / w
        if hs <= H:
            ps.append(50.0)
            continue
        ps.append(max(0.0, min(1.0, (fy * hs - HAUTEUR_VISEE * H) / (hs - H))) * 100)
    return int(round(sum(ps) / len(ps) / 5) * 5)


def main():
    os.makedirs(os.path.dirname(MODELE), exist_ok=True)
    if not os.path.exists(MODELE):
        open(MODELE, 'wb').write(lire(URL_MODELE, True))
    det = cv2.FaceDetectorYN.create(MODELE, '', (320, 320), 0.6, 0.3, 5000)
    plan = lire(BASE + '/sitemap.xml')
    fiches = sorted(set(re.findall(r'<loc>https?://[^/]+(/book/[a-z0-9-]+)</loc>', plan)))
    resultat = {}
    for f in fiches:
        m = re.search(r'<img data-couv-img src="([^"]+)"', lire(BASE + f))
        cle = m and re.search(r'/([0-9]{10,}-[a-z0-9]+)-w\.(?:webp|jpg)', m.group(1))
        if not cle:
            print(f, ': pas de grande photo reconnue'); continue
        img = cv2.imdecode(np.frombuffer(lire(m.group(1).replace('&amp;', '&'), True), np.uint8), cv2.IMREAD_COLOR)
        fy = visage(img, det)
        c = cadrage(fy, img.shape[1], img.shape[0]) if fy is not None else None
        print(f.ljust(48), 'visage à %d %%' % (fy * 100) if fy is not None else 'aucun visage', '→ cadrage', c)
        if c:
            resultat[cle.group(1)] = c
    lignes = ',\n'.join("    '%s': %d" % (k, v) for k, v in sorted(resultat.items()))
    js = ("// Cadrage automatique des grandes photos des fiches : FICHIER ÉCRIT PAR scripts/cadrage-visages.py (ne pas modifier\n"
          "// à la main). Pour chaque photo (repère de son nom), la hauteur du cadrage (0 à 100 %) qui place le visage au-dessus\n"
          "// du nom ; photo absente de la liste : cadrage d'avant (le haut). Lu par js/rendu-fiche.js (page et serveur).\n"
          "(function (racine) {\n  'use strict';\n  const CADRAGES = {\n" + lignes + "\n  };\n"
          "  // hauteur de cadrage d'une adresse de photo (null si inconnue)\n"
          "  function cadragePhoto(url) {\n    const m = /\\/([0-9]{10,}-[a-z0-9]+)-w\\.(?:webp|jpg)/.exec(String(url || ''));\n"
          "    return m && CADRAGES[m[1]] ? CADRAGES[m[1]] : null;\n  }\n"
          "  racine.CadragesPhotos = { cadragePhoto };\n})(typeof window !== 'undefined' ? window : globalThis);\n")
    open(os.path.join(RACINE, 'js', 'cadrages-photos.js'), 'w').write(js)
    print(len(resultat), 'photos recadrées → js/cadrages-photos.js')


if __name__ == '__main__':
    sys.exit(main())
