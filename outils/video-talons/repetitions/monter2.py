#!/usr/bin/env python3
"""Montage du film libre « On répète » (version 2, 16/11/2026), d'après plans2.py.

Vraies images des rushes seulement (aucun corps inventé). Début en noir et blanc sombre, puis couleur lumineuse
« studio blanc » ; caméra simulée, coups de zoom sur le rythme, rampes de vitesse, rembobinages, panneaux côte à
côte, lettres « MA2M » remplies d'images qu'on traverse, éclairs rouges (rouge du logo) et blancs, textes en
Big Shoulders Display (la police des titres du site).

  python3 monter2.py preparer | planche | images 12 30 … | film   → sortie/v2-muet.mp4, sortie/v2-evenements.json
"""
import json, math, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from plans2 import P, TEXTES, DUREE, FIN

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, '..', '..', '..'))
W, H, FPS = 1080, 1920, 30
ROUGE = np.array([200, 16, 46], np.float32) / 255
BLANC = np.ones(3, np.float32)
POL = os.path.join(ICI, 'polices')

def lisse(x):
    x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)
def doux(x):
    x = min(1.0, max(0.0, x)); return 0.5 - 0.5 * math.cos(math.pi * x)
def sortie_rapide(x):
    x = min(1.0, max(0.0, x)); return 1 - (1 - x) ** 3

# ------------------------------------------------------------------ rushes
def rush(r): return os.path.join(ICI, 'rushes', r + '.mp4')
_TAILLES = {}
def taille(r):
    if r not in _TAILLES:
        o = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', rush(r)]).decode().split(',')
        _TAILLES[r] = int(o[0]), int(o[1])
    return _TAILLES[r]

def besoin(s):
    """Plage du rush à décoder et cadence (60 i/s s'il y a un ralenti)."""
    ts = [x for _, x in s['k']]
    pentes = [abs((b[1] - a[1]) / (b[0] - a[0])) for a, b in zip(s['k'], s['k'][1:]) if b[0] > a[0]]
    ips = 60 if any(0.05 < p < 0.9 for p in pentes) else 30
    a = max(0.0, min(ts) - 0.1)
    return a, max(ts) - a + 0.3, ips

def fichier_cache(s):
    a, d, ips = besoin(s)
    return os.path.join(ICI, 'cache', f"{s['r']}_{a:.2f}_{d:.2f}_{ips}.mkv"), a, d, ips

def preparer_un(s):
    f, a, d, ips = fichier_cache(s)
    if os.path.exists(f): return
    vf = 'fps=30' + (',minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1' if ips == 60 else '')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a:.3f}', '-t', f'{d:.3f}', '-i', rush(s['r']), '-vf', vf, '-an',
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '8', '-pix_fmt', 'yuv420p', f + '.part.mkv'], check=True)
    os.replace(f + '.part.mkv', f)

def lire(s):
    f, a, d, ips = fichier_cache(s)
    if not os.path.exists(f): preparer_un(s)
    w, h = taille(s['r'])
    brut = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', f, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    n = len(brut) // (w * h * 3)
    return dict(images=np.frombuffer(brut, np.uint8)[: n * w * h * 3].reshape(n, h, w, 3), debut=a, ips=ips, w=w, h=h)

def temps_source(s, tau):
    k = s['k']; xs = [x for x, _ in k]; ys = [y for _, y in k]
    return float(np.interp(tau, xs, ys))

# ------------------------------------------------------------------ étalonnage
def courbe(nb):
    x = np.arange(256, dtype=np.float32) / 255
    if nb:   # noir et blanc sombre et dense : la répétition, avant la lumière
        return np.interp(x, [0, 0.12, 0.3, 0.5, 0.7, 0.88, 1], [0, 0.03, 0.16, 0.34, 0.52, 0.66, 0.74]).astype(np.float32)
    # couleur « studio blanc » : murs lumineux et propres, noirs francs, contraste
    return np.interp(x, [0, 0.08, 0.25, 0.5, 0.72, 0.88, 1], [0, 0.025, 0.19, 0.50, 0.78, 0.93, 0.98]).astype(np.float32)
LUTS = {nb: np.round(courbe(nb) * 255).astype(np.uint8) for nb in (False, True)}

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
_r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 * 0.85 + ((yy - H * 0.48) / (H / 2)) ** 2)
PLAFOND = (0.22 + 0.78 * np.clip(yy / (H * 0.22), 0, 1) ** 1.1)
VIG = {nb: ((1 - (0.55 if nb else 0.28) * np.clip((_r - 0.45) / 0.85, 0, 1) ** 1.5) * PLAFOND)[..., None].astype(np.float32) for nb in (False, True)}
rng = np.random.default_rng(3)
GRAIN = [cv2.resize(rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32), (W, H))[..., None] for _ in range(10)]

def etalonner(img, nb, i):
    img = cv2.LUT(img, LUTS[nb])
    f = img.astype(np.float32) / 255
    gris = f @ np.array([0.299, 0.587, 0.114], np.float32)
    if nb: f = np.repeat(gris[..., None], 3, 2) * np.array([1.0, 0.99, 0.97], np.float32)
    else: f = gris[..., None] + 1.12 * (f - gris[..., None])
    f = f * VIG[nb] + GRAIN[i % 10] * (0.03 if nb else 0.014)
    return f

# ------------------------------------------------------------------ caméra
def camera(s, src, w, h, tau, d, punch=0.0):
    (z0, x0, y0), (z1, x1, y1) = s['cam']
    k = doux(tau / d)
    z, cx, cy = z0 + (z1 - z0) * k, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k
    z *= 1 + punch
    sc = W / w * z
    cxp, cyp = cx * w, cy * h
    demi_w, demi_h = w / (2 * z), h / (2 * z)
    cxp = min(max(cxp, demi_w), w - demi_w); cyp = min(max(cyp, demi_h), h - demi_h)
    M = np.float32([[sc, 0, W / 2 - sc * cxp], [0, sc, H / 2 - sc * cyp]])
    img = cv2.warpAffine(src, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    return cv2.addWeighted(img, 1.4, cv2.GaussianBlur(img, (0, 0), 1.6), -0.4, 0)

def image_source(s, lu, tau):
    t = temps_source(s, tau)
    k = int(round((t - lu['debut']) * lu['ips']))
    return lu['images'][min(max(k, 0), len(lu['images']) - 1)]

# ------------------------------------------------------------------ textes
_POL = {}
def police(poids, taille):
    if (poids, taille) not in _POL: _POL[poids, taille] = ImageFont.truetype(os.path.join(POL, f'big-shoulders-display-{poids}.ttf'), taille)
    return _POL[poids, taille]

_MASQUES = {}
def masque_texte(txt, poids, taille):
    cle = (txt, poids, taille)
    if cle not in _MASQUES:
        f = police(poids, taille)
        l, t, r, b = f.getbbox(txt)
        im = Image.new('L', (r + 20, b + 20), 0)
        ImageDraw.Draw(im).text((10, 10), txt, font=f, fill=255)
        _MASQUES[cle] = (np.asarray(im, np.float32) / 255, t + 10)
    return _MASQUES[cle]

def poser(f, m, couleur, x0, y0, clip=None):
    """Pose le masque m (couleur) en (x0, y0) ; clip = (haut, bas) limite verticale (révélation par le bas)."""
    h, w = m.shape
    ya, yb, xa, xb = max(0, y0), min(H, y0 + h), max(0, x0), min(W, x0 + w)
    if clip: ya, yb = max(ya, clip[0]), min(yb, clip[1])
    if yb <= ya or xb <= xa: return f
    a = m[ya - y0:yb - y0, xa - x0:xb - x0][..., None]
    f[ya:yb, xa:xb] = f[ya:yb, xa:xb] * (1 - a) + couleur * a
    return f

TAILLE_TEXTE = 236
def textes(f, T):
    for a, b, lignes in TEXTES:
        if not (a <= T < b): continue
        ta = TAILLE_TEXTE
        while max(police(900, ta).getlength(l) for l in lignes) > W - 128: ta -= 6
        hl = int(ta * 0.98)
        y_bas = 1700
        y0 = y_bas - hl * len(lignes)
        # ombre douce sous le texte pour qu'il se lise sur toutes les images
        zone = slice(max(0, y0 - 160), H)
        grad = np.clip((yy[zone] - (y0 - 160)) / 420, 0, 1)[..., None] * 0.55
        f[zone] = f[zone] * (1 - grad)
        for j, ligne in enumerate(lignes):
            m, haut = masque_texte(ligne, 900, ta)
            depart = a + 0.5 * j if len(lignes) > 1 else a
            if T < depart: continue
            x = sortie_rapide((T - depart) / 0.28)
            yl = y0 + j * hl
            poser(f, m, BLANC, 64, int(yl - haut + (1 - x) * hl * 0.9), clip=(yl - 8, yl + hl + 10))
    return f

# ------------------------------------------------------------------ cartes de fin
LOGO = cv2.cvtColor(cv2.imread(os.path.join(RACINE, 'assets', 'logo-intro.png'), cv2.IMREAD_UNCHANGED), cv2.COLOR_BGRA2RGBA).astype(np.float32) / 255
def logo(f, cx, cy, largeur, alpha):
    if alpha <= 0.003: return f
    w = int(largeur); h = int(LOGO.shape[0] * largeur / LOGO.shape[1])
    im = cv2.resize(LOGO, (w, h), interpolation=cv2.INTER_AREA)
    x0, y0 = int(cx - w / 2), int(cy - h / 2)
    a = im[..., 3:] * alpha
    f[y0:y0 + h, x0:x0 + w] = f[y0:y0 + h, x0:x0 + w] * (1 - a) + im[..., :3] * a
    return f

def signature(u):
    """72 → 84 s (u = 0 → 12) : logo sur le temps, devise en très grand, puis où nous trouver."""
    f = np.zeros((H, W, 3), np.float32)
    if u < 3.5:
        k = sortie_rapide(u / 0.35)
        f = logo(f, W / 2, H / 2, 900 * (1.12 - 0.12 * k), min(1, u / 0.12))
        return f
    if u < 7.5:
        for j, ligne in enumerate(['L’élégance', 'se travaille.', 'Le talent', 'se révèle.']):
            depart = 3.5 + 0.5 * j
            if u < depart: continue
            m, haut = masque_texte(ligne, 900, 205)
            x = sortie_rapide((u - depart) / 0.28)
            yl = 560 + j * 200 + (40 if j >= 2 else 0)
            poser(f, m, BLANC, 64, int(yl - haut + (1 - x) * 190), clip=(yl - 8, yl + 205))
        return f
    al = lisse((12.0 - u) / 0.9)
    f = logo(f, W / 2, 640, 760, al)
    for j, (ligne, poids, ta) in enumerate([('maitreakessemodelmanagement.com', 700, 76), ('WhatsApp +225 05 45 65 66 87', 500, 70),
                                             ('Téléphone +225 27 22 23 11 76', 500, 70), ('@maitreakessemodelmanagement', 500, 70)]):
        depart = 7.6 + 0.25 * j
        if u < depart: continue
        m, haut = masque_texte(ligne, poids, ta)
        x = sortie_rapide((u - depart) / 0.3)
        yl = 960 + j * 124
        poser(f, m * al, BLANC, int((W - m.shape[1]) / 2), int(yl - haut + (1 - x) * 60), clip=(yl - 8, yl + ta + 30))
    return f

# ------------------------------------------------------------------ fenêtre « MA2M »
def masque_fenetre(txt):
    f = police(900, 900)
    l, t, r, b = f.getbbox(txt)
    im = Image.new('L', (r - l, b - t), 0)
    ImageDraw.Draw(im).text((-l, -t), txt, font=f, fill=255)
    m = np.asarray(im, np.float32) / 255
    sc = (W - 90) / m.shape[1]
    return cv2.resize(m, (int(m.shape[1] * sc), int(m.shape[0] * sc)), interpolation=cv2.INTER_AREA)
FEN = {}
APPUI = {}
def appui(m):
    ys, xs = np.nonzero(m[:, : m.shape[1] // 6] > 0.99)
    j = np.argmin((ys - m.shape[0] * 0.6) ** 2 + (xs - np.median(xs)) ** 2)
    return float(xs[j]), float(ys[j])

# ------------------------------------------------------------------ rendu d'une image
class Monteur:
    def __init__(self):
        self.plans = sorted(P, key=lambda p: p['a']); self.lus = {}
    def lu(self, s):
        cle = (s['r'], tuple(s['k']))
        if cle not in self.lus: self.lus[cle] = lire(s)
        return self.lus[cle]
    def oublier(self, T):
        garder = set()
        for p in self.plans:
            if p['a'] + p['d'] > T - 0.5:
                for s in p.get('panneaux', [p]):
                    if 'r' in s: garder.add((s['r'], tuple(s['k'])))
        self.lus = {k: v for k, v in self.lus.items() if k in garder}

    def plan_simple(self, p, tau, i):
        lu = self.lu(p)
        punch = 0.07 * math.exp(-tau / 0.14) if p.get('coup') else 0.0
        img = camera(p, image_source(p, lu, tau), lu['w'], lu['h'], tau, p['d'], punch)
        f = etalonner(img, p.get('nb', False), i)
        if p.get('rembobine'):                                         # pendant le rembobinage : lignes de bande
            v = (temps_source(p, tau + 0.02) - temps_source(p, tau - 0.02)) / 0.04
            if v < -0.5:
                bandes = (np.sin(yy[:, :1] * 0.05 + i * 3.1) > 0.85).astype(np.float32)[..., None] * 0.07
                f = np.roll(f, int(18 * math.sin(i * 1.7)), axis=1) * 0.92 + bandes
        return f

    def image(self, i):
        T = i / FPS
        if T >= FIN: return signature(T - FIN)
        act = [p for p in self.plans if p['a'] <= T < p['a'] + p['d']]
        if not act:
            f = np.zeros((H, W, 3), np.float32)
        else:
            p = act[-1]; tau = T - p['a']
            if 'panneaux' in p:
                n = len(p['panneaux']); lw = W // n
                f = np.zeros((H, W, 3), np.float32)
                for j, s in enumerate(p['panneaux']):
                    lu = self.lu(s)
                    decal = int((1 - sortie_rapide((tau - 0.12 * j) / 0.35)) * H) * (1 if j % 2 else -1)
                    img = etalonner(camera(s, image_source(s, lu, tau), lu['w'], lu['h'], tau, p['d']), False, i)
                    bande = img[:, W // 2 - lw // 2: W // 2 - lw // 2 + lw]
                    if decal:
                        b2 = np.zeros_like(bande)
                        if decal > 0: b2[decal:] = bande[:H - decal]
                        else: b2[:H + decal] = bande[-decal:]
                        bande = b2
                    f[:, j * lw:(j + 1) * lw] = bande
                    if j: f[:, j * lw - 4:j * lw + 4] = 0
            elif 'fenetre' in p:
                f = self.plan_simple(p, tau, i)
                if p['fenetre'] not in FEN: FEN[p['fenetre']] = masque_fenetre(p['fenetre'])
                m = FEN[p['fenetre']]
                z = 1.0 if tau < 1.0 else math.exp(4.2 * sortie_rapide((tau - 1.0) / 0.75) * ((tau - 1.0) / 0.75) ** 0.6)
                z *= 1 + 0.04 * tau
                # point d'appui choisi dans le jambage gauche du premier « M » : on traverse la lettre
                ox, oy = (W - m.shape[1]) / 2, (H - m.shape[0]) / 2
                APPUI.setdefault(p['fenetre'], appui(m)); ax, ay = APPUI[p['fenetre']]
                M = np.float32([[z, 0, ox + ax - z * ax], [0, z, oy + ay - z * ay]])
                masque = cv2.warpAffine(m, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=0)[..., None]
                if z > 25: masque[:] = 1
                f = f * masque
            else:
                f = self.plan_simple(p, tau, i)
            if p.get('noir_fin'): f = f * lisse((p['d'] - tau) / p['noir_fin'])
            fl = p.get('flash')
            if fl == 'rouge' and tau < 3 / FPS: f = f * 0 + ROUGE
            elif fl == 'rouge' and tau < 0.3: f = f + ROUGE * 0.6 * (1 - tau / 0.3)
            elif fl == 'blanc': f = f + (1 - f) * 0.85 * math.exp(-tau / 0.06)
        return textes(f, T)

def en_octets(f): return (np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8)

def tous_les_morceaux():
    for p in P:
        for s in p.get('panneaux', [p]):
            if 'r' in s: yield s

def evenements():
    ev = []
    for p in P:
        if p.get('flash') == 'rouge': ev.append(dict(t=p['a'], son='impact'))
        if p.get('flash') == 'blanc': ev.append(dict(t=p['a'], son='declic'))
        if p.get('rembobine'):
            k = p['k']
            for a, b in zip(k, k[1:]):
                if b[1] < a[1]: ev.append(dict(t=p['a'] + a[0], son='rembobine', d=b[0] - a[0]))
        if 'panneaux' in p: ev.append(dict(t=p['a'], son='whoosh'))
    ev.append(dict(t=FIN, son='logo'))
    return ev

def main():
    m = Monteur(); act = sys.argv[1] if len(sys.argv) > 1 else 'film'
    os.makedirs(os.path.join(ICI, 'cache'), exist_ok=True); os.makedirs(os.path.join(ICI, 'sortie'), exist_ok=True)
    if act == 'preparer':
        with ThreadPoolExecutor(4) as ex: list(ex.map(preparer_un, list(tous_les_morceaux())))
        print('prêt')
    elif act == 'images':
        for t in sys.argv[2:]:
            cv2.imwrite(os.path.join(ICI, 'sortie', f'v2_{float(t):06.2f}.jpg'), cv2.cvtColor(en_octets(m.image(int(round(float(t) * FPS)))), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
    elif act == 'planche':
        dos = os.path.join(ICI, 'sortie', 'planche2'); os.makedirs(dos, exist_ok=True)
        ts = sorted(set([round(p['a'] + p['d'] * x, 2) for p in m.plans for x in (0.1, 0.6)] + [72.5, 76.5, 80.5]))
        for n, t in enumerate(ts):
            im = cv2.resize(en_octets(m.image(int(round(t * FPS)))), (216, 384), interpolation=cv2.INTER_AREA)
            cv2.putText(im, f'{t:.2f}', (5, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1, cv2.LINE_AA)
            cv2.imwrite(os.path.join(dos, f'{n:03d}.jpg'), cv2.cvtColor(im, cv2.COLOR_RGB2BGR))
        print(len(ts), 'images')
    elif act == 'film':
        sortie = os.path.join(ICI, 'sortie', 'v2-muet.mp4')
        enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                                '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', sortie], stdin=subprocess.PIPE)
        for i in range(int(round(DUREE * FPS))):
            enc.stdin.write(en_octets(m.image(i)).tobytes()); m.oublier(i / FPS)
            if i % 300 == 0: print(f'{i / FPS:5.1f} s', flush=True)
        enc.stdin.close(); enc.wait()
        json.dump(evenements(), open(os.path.join(ICI, 'sortie', 'v2-evenements.json'), 'w'), indent=1)
        print('fini :', sortie)

if __name__ == '__main__':
    main()
