"""Suivi du mannequin qui marche (16/11/2026) : pour chaque image d'un morceau de rush, la position horizontale de la
personne la plus proche de la caméra, pour que le cadre et les panneaux restent centrés sur elle.

Sans rien télécharger : détecteur de silhouettes HOG et détecteur de visages (Haar) fournis avec OpenCV 4.
Visage assez grand → on centre sur le visage ; sinon → sur la plus grande silhouette. Les sauts aberrants sont
écartés, les trous comblés, puis la courbe est lissée (pas de cadre qui tremble). Résultat gardé dans cache/.
"""
import os
import numpy as np, cv2

_hog = cv2.HOGDescriptor(); _hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
_visage = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml'))

def position(img):
    """(x, fiabilité) de la personne principale dans une image RGB, x de 0 à 1 ; None si rien."""
    h, w = img.shape[:2]
    petit = cv2.resize(img, (360, int(360 * h / w)))
    gris = cv2.cvtColor(petit, cv2.COLOR_RGB2GRAY)
    faces = _visage.detectMultiScale(gris, 1.1, 5, minSize=(22, 22))
    if len(faces):
        x, y, fw, fh = max(faces, key=lambda f: f[2])
        if fw > 30: return (x + fw / 2) / 360, 2.0
    corps, poids = _hog.detectMultiScale(gris, winStride=(6, 6), padding=(8, 8), scale=1.06)
    if len(corps):
        j = int(np.argmax([c[3] * (0.5 + float(p)) for c, p in zip(corps, np.ravel(poids))]))
        x, y, cw, ch = corps[j]
        return (x + cw / 2) / 360, 1.0
    return None

def courbe(images, ips=30, pas=3, defaut=0.5):
    n = len(images)
    xs = np.full(n, np.nan)
    for i in range(0, n, pas):
        r = position(images[i])
        if r: xs[i] = r[0]
    idx = np.where(~np.isnan(xs))[0]
    if len(idx) == 0: return np.full(n, defaut)
    # écarter les sauts aberrants (autre personne détectée un instant)
    bons = []
    for k, i in enumerate(idx):
        voisins = xs[idx[max(0, k - 3):k + 4]]
        if abs(xs[i] - np.median(voisins)) < 0.12: bons.append(i)
    if not bons: bons = list(idx)
    bons = np.array(bons)
    c = np.interp(np.arange(n), bons, xs[bons])
    sigma = max(2, int(0.3 * ips))
    noyau = np.exp(-0.5 * (np.arange(-3 * sigma, 3 * sigma + 1) / sigma) ** 2); noyau /= noyau.sum()
    c = np.convolve(np.pad(c, 3 * sigma, mode='edge'), noyau, mode='valid')
    return np.clip(c, 0.15, 0.85)

def suivre(cle, images, dossier, ips=30):
    f = os.path.join(dossier, 'suivi_' + cle + '.npy')
    if os.path.exists(f):
        c = np.load(f)
        if len(c) == len(images): return c
    c = courbe(images, ips)
    np.save(f, c)
    return c
