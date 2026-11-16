#!/usr/bin/env python3
"""Montage du film « Répétitions du défilé » (16/11/2026), d'après plans.py.

Vraies images des rushes (aucun mouvement de corps inventé) : caméra simulée (zoom, travelling, léger flottement),
ralentis fluides (images intermédiaires calculées par ffmpeg minterpolate), étalonnage sombre et doré, vignettage,
halo des lumières, grain, transitions (fondu, noir, flash, balayage de caméra) et cartes titres dessinées ici.

  python3 monter.py preparer            # calcule les ralentis une fois (dossier cache/)
  python3 monter.py planche             # images de contrôle : début, milieu, fin de chaque plan
  python3 monter.py images 12.5 40 …    # quelques images précises
  python3 monter.py film                # rendu complet → sortie/film-muet.mp4 et sortie/evenements.json
"""
import json, math, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from plans import PLANS, DUREE

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.abspath(os.path.join(ICI, '..', '..', '..'))
W, H, FPS = 1080, 1920, 30
OR = np.array([216, 184, 120], np.float32) / 255
IVOIRE = np.array([245, 238, 227], np.float32) / 255
POL = os.path.join(ICI, 'polices')

def lisse(x):
    x = min(1.0, max(0.0, x)); return x * x * (3 - 2 * x)

def doux(x):
    x = min(1.0, max(0.0, x)); return 0.5 - 0.5 * math.cos(math.pi * x)

# ------------------------------------------------------------------ découpage en temps
def chronologie():
    plans, t = [], None
    for p in PLANS:
        if isinstance(p, tuple):
            _, nom, debut, duree = p
            assert t is None or abs(t - debut) < 1e-6, f'carte {nom} : {debut} au lieu de {t}'
            plans.append(dict(carte=nom, S=debut, d=duree)); t = debut + duree
        else:
            p = dict(p)
            if t is None: t = p.get('debut', 0.0)
            p['S'] = t; t += p['d']; plans.append(p)
    assert abs(t - DUREE) < 1e-6, f'durée totale {t}'
    for i, p in enumerate(plans):
        tr = p.get('tr', 'cut')
        p['pre'] = tr[1] / 2 if isinstance(tr, tuple) and tr[0] == 'fondu' else 0.0
        nxt = plans[i + 1] if i + 1 < len(plans) else None
        ntr = nxt.get('tr', 'cut') if nxt else 'cut'
        p['post'] = ntr[1] / 2 if isinstance(ntr, tuple) and ntr[0] == 'fondu' else 0.0
        p['tr_suivant'] = ntr
    return plans

def vitesse(p, tau):
    v = p.get('v', 1.0)
    if not isinstance(v, tuple): return v
    a, b = v; x = min(1.0, max(0.0, tau / p['d'])); return a + (b - a) * doux(x)

def source(p, tau):
    """Instant du rush montré à tau secondes du début du plan (tau peut être négatif pendant un fondu)."""
    v = p.get('v', 1.0)
    if not isinstance(v, tuple): return p['t'] + v * tau
    if tau <= 0: return p['t'] + v[0] * tau
    n = max(2, int(tau * 60)); us = np.linspace(0, tau, n + 1)
    vs = np.array([vitesse(p, u) for u in us])
    return p['t'] + float(np.trapezoid(vs, us))

def plage(p):
    a, b = source(p, -p['pre']), source(p, p['d'] + p['post'])
    lent = min(p['v']) if isinstance(p['v'], tuple) else p['v']
    ips = 60 if lent < 0.9 else 30
    return max(0.0, a - 0.25), (b - max(0.0, a - 0.25)) + 0.4, ips

# ------------------------------------------------------------------ lecture des rushes
def rush(r): return os.path.join(ICI, 'rushes', r + '.mp4')

def taille(r):
    o = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', rush(r)]).decode().split(',')
    return int(o[0]), int(o[1])

def fichier_cache(p):
    a, d, ips = plage(p)
    return os.path.join(ICI, 'cache', f"{p['r']}_{a:.2f}_{d:.2f}_{ips}.mkv"), a, d, ips

def preparer_un(p):
    f, a, d, ips = fichier_cache(p)
    if os.path.exists(f): return
    vf = 'fps=30' + (',minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1' if ips == 60 else '')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{a:.3f}', '-t', f'{d:.3f}', '-i', rush(p['r']), '-vf', vf, '-an',
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '8', '-pix_fmt', 'yuv420p', f + '.part.mkv'], check=True)
    os.replace(f + '.part.mkv', f)

def lire(p):
    f, a, d, ips = fichier_cache(p)
    if not os.path.exists(f): preparer_un(p)
    w, h = taille(p['r'])
    brut = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', f, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
    n = len(brut) // (w * h * 3)
    return dict(images=np.frombuffer(brut, np.uint8)[: n * w * h * 3].reshape(n, h, w, 3), debut=a, ips=ips, w=w, h=h)

# ------------------------------------------------------------------ étalonnage
def courbes(expo):
    """Courbe sombre et douce : murs blancs ramenés vers un gris chaud profond, peau préservée, noirs denses."""
    x = np.arange(256, dtype=np.float32) / 255 * expo
    y = np.interp(x, [0, 0.06, 0.2, 0.35, 0.5, 0.7, 0.85, 1.0, 1.6], [0, 0.015, 0.13, 0.27, 0.38, 0.48, 0.54, 0.585, 0.7]).astype(np.float32)
    hi = np.clip((y - 0.3) / 0.3, 0, 1); lo = np.clip((0.25 - y) / 0.25, 0, 1)
    r = np.clip(y + 0.028 * hi - 0.010 * lo, 0, 1)                      # hautes lumières chaudes (dorées)
    g = np.clip(y + 0.008 * hi - 0.002 * lo, 0, 1)
    b = np.clip(y - 0.040 * hi + 0.014 * lo, 0, 1)                      # ombres légèrement froides
    return [np.round(k * 255).astype(np.uint8) for k in (r, g, b)]

_LUT = {}
def lut(expo):
    k = round(expo, 3)
    if k not in _LUT: _LUT[k] = courbes(k)
    return _LUT[k]

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
_rx, _ry = (xx - W / 2) / (W / 2), (yy - H * 0.47) / (H / 2)
RAYON = np.sqrt(_rx ** 2 * 0.9 + _ry ** 2 * 1.05)
def vignette(force):
    v = 1 - force * np.clip((RAYON - 0.32) / 0.85, 0, 1) ** 1.35
    haut = 0.62 + 0.38 * np.clip(yy / (H * 0.2), 0, 1) ** 0.8          # le plafond et ses lampes s'éteignent
    return (v * haut)[..., None].astype(np.float32)
VIG = {}
def vig(force):
    k = round(force, 2)
    if k not in VIG: VIG[k] = vignette(k)
    return VIG[k]

rng = np.random.default_rng(3)
GRAIN = [cv2.resize(rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32), (W, H), interpolation=cv2.INTER_LINEAR)[..., None] for _ in range(10)]

def etalonner(img, expo, i):
    l = lut(expo)
    img = cv2.merge([cv2.LUT(img[..., k], l[k]) for k in range(3)])
    f = img.astype(np.float32) / 255
    gris = f @ np.array([0.299, 0.587, 0.114], np.float32)
    f = gris[..., None] + 0.88 * (f - gris[..., None])                 # couleurs un peu retenues, peau naturelle
    petit = cv2.resize(f, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    halo = np.clip(petit.max(axis=2) - 0.50, 0, None)
    halo = cv2.GaussianBlur(halo, (0, 0), 9)
    halo = cv2.resize(halo, (W, H), interpolation=cv2.INTER_LINEAR)[..., None] * OR * 0.55
    f = f + halo
    f = f * vig(0.80 if expo > 0.7 else 0.92)
    f = f + GRAIN[i % len(GRAIN)] * 0.018
    return f

# ------------------------------------------------------------------ caméra (voir camera() plus bas)
def image_du_plan(p, lu, T, i):
    tau = T - p['S']
    s = source(p, tau)
    k = int(round((s - lu['debut']) * lu['ips']))
    k = min(max(k, 0), len(lu['images']) - 1)
    src = lu['images'][k]
    decal, flou, sens = (0.0, 0.0), 0, 'd'
    D = 0.22                                                              # balayage : 0,22 s de chaque côté de la coupe
    tr = p.get('tr', 'cut'); ntr = p['tr_suivant']
    if isinstance(tr, tuple) and tr[0] == 'balaye' and tau < D:
        x = 1 - tau / D; sens = tr[1]
        a = x ** 2 * 0.55
        decal = {'d': (-a * W, 0), 'g': (a * W, 0), 'h': (0, a * H), 'b': (0, -a * H)}[sens]; flou = x * 160
    if isinstance(ntr, tuple) and ntr[0] == 'balaye' and tau > p['d'] - D:
        x = 1 - (p['d'] - tau) / D; sens = ntr[1]
        a = x ** 2 * 0.55
        decal = {'d': (a * W, 0), 'g': (-a * W, 0), 'h': (0, -a * H), 'b': (0, a * H)}[sens]; flou = x * 160
    img = camera(p, src, lu['w'], lu['h'], tau, decal, flou, sens)
    f = etalonner(img, p.get('expo', 0.95), i)
    # fondus au noir
    a = 1.0
    if isinstance(tr, tuple) and tr[0] == 'noir': a *= lisse(tau / (tr[1] / 2))
    if isinstance(ntr, tuple) and ntr[0] == 'noir': a *= lisse((p['d'] - tau) / (ntr[1] / 2))
    if p.get('sortie_noir'): a *= lisse((p['d'] - tau) / p['sortie_noir'])
    if tr == 'flash':
        e = math.exp(-max(tau, 0) / 0.16) * 0.95
        f = f * (1 + 1.6 * e) + e * (0.35 * OR + 0.25)
    if ntr == 'flash' and tau > p['d'] - 2 / FPS:
        f = f * 1.35 + 0.08
    return f * a

def camera(p, src, w, h, tau, decal=(0.0, 0.0), flou=0, sens='d'):
    (z0, x0, y0), (z1, x1, y1) = p['cam']
    k = doux(tau / p['d'])
    z, cx, cy = z0 + (z1 - z0) * k, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k
    s = W / w * z
    cxp, cyp = cx * w, cy * h
    cxp += 2.2 * math.sin(0.9 * (p['S'] + tau) + p['t']) / z
    cyp += 1.6 * math.sin(0.7 * (p['S'] + tau) + 1.3 * p['t']) / z
    demi_w, demi_h = w / (2 * z), h / (2 * z)
    cxp = min(max(cxp, demi_w), w - demi_w); cyp = min(max(cyp, demi_h), h - demi_h)
    M = np.float32([[s, 0, W / 2 - s * cxp + decal[0]], [0, s, H / 2 - s * cyp + decal[1]]])
    img = cv2.warpAffine(src, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    img = cv2.addWeighted(img, 1.35, cv2.GaussianBlur(img, (0, 0), 1.6), -0.35, 0)   # netteté douce après l'agrandissement
    if flou > 1:
        img = cv2.blur(img, (int(flou), 1) if sens in 'gd' else (1, int(flou)))
    return img

# ------------------------------------------------------------------ cartes titres
def police(nom, taille):
    return ImageFont.truetype(os.path.join(POL, nom + '.ttf'), taille)
F_TITRE = 'cormorant-garamond-latin-600-normal'; F_SERIF = 'cormorant-garamond-latin-500-normal'
F_ITAL = 'cormorant-garamond-latin-400-italic'; F_CAPS = 'work-sans-latin-500-normal'; F_CAPS4 = 'work-sans-latin-400-normal'

def texte(calque, txt, nom, taille, y, couleur, alpha=1.0, espace=0.0, flou=0.0, x=None):
    """Écrit txt centré (ou à partir de x) sur un calque RGBA float (H, W, 4), avec un espacement des lettres."""
    if alpha <= 0.003: return
    f = police(nom, taille)
    largeurs = [f.getlength(c) for c in txt]
    total = sum(largeurs) + espace * taille * (len(txt) - 1)
    marge = int(taille * 0.6 + flou * 3)
    im = Image.new('L', (int(total) + 2 * marge, int(taille * 1.6) + 2 * marge), 0)
    d = ImageDraw.Draw(im); cx = marge
    for c, lw in zip(txt, largeurs):
        d.text((cx, marge), c, font=f, fill=255); cx += lw + espace * taille
    if flou > 0.3: im = im.filter(ImageFilter.GaussianBlur(flou))
    m = np.asarray(im, np.float32) / 255 * alpha
    x0 = int(round((W - total) / 2 - marge)) if x is None else int(x - marge)
    y0 = int(round(y - marge - taille * 0.2))
    poser(calque, m, couleur, x0, y0)

def poser(calque, m, couleur, x0, y0):
    h, w = m.shape
    a0, b0 = max(0, -y0), max(0, -x0)
    a1, b1 = min(h, H - y0), min(w, W - x0)
    if a1 <= a0 or b1 <= b0: return
    m = m[a0:a1, b0:b1]
    zone = calque[y0 + a0:y0 + a1, x0 + b0:x0 + b1]
    al = m[..., None]
    zone[..., :3] = zone[..., :3] * (1 - al) + couleur * al
    zone[..., 3:] = 1 - (1 - zone[..., 3:]) * (1 - al)

LOGO = cv2.cvtColor(cv2.imread(os.path.join(RACINE, 'assets', 'logo-intro.png'), cv2.IMREAD_UNCHANGED), cv2.COLOR_BGRA2RGBA).astype(np.float32) / 255

def logo(f, cx, cy, largeur, alpha, flou=0.0, reflet=None):
    if alpha <= 0.003: return f
    h = int(round(LOGO.shape[0] * largeur / LOGO.shape[1])); w = int(round(largeur))
    im = cv2.resize(LOGO, (w, h), interpolation=cv2.INTER_AREA)
    if flou > 0.3: im = cv2.GaussianBlur(im, (0, 0), flou)
    rgb, a = im[..., :3], im[..., 3:] * alpha
    if reflet is not None:                                             # bande de lumière qui traverse le logo
        xs = np.arange(w, dtype=np.float32)[None, :] + 0.35 * np.arange(h, dtype=np.float32)[:, None]
        bande = np.exp(-((xs - reflet * (w + h * 0.35)) / (w * 0.06)) ** 2)[..., None]
        rgb = np.clip(rgb + bande * 0.9 * (OR * 0.5 + 0.5), 0, 1.4)
    x0, y0 = int(cx - w / 2), int(cy - h / 2)
    ya, yb, xa, xb = max(0, y0), min(H, y0 + h), max(0, x0), min(W, x0 + w)
    sl = (slice(ya - y0, yb - y0), slice(xa - x0, xb - x0))
    f[ya:yb, xa:xb] = f[ya:yb, xa:xb] * (1 - a[sl]) + rgb[sl] * a[sl]
    return f

class Poussiere:
    def __init__(self, n=150, graine=5):
        g = np.random.default_rng(graine)
        self.x, self.y = g.uniform(0, W, n), g.uniform(0, H, n)
        self.v, self.r, self.ph = g.uniform(8, 30, n), g.uniform(0.8, 2.6, n), g.uniform(0, 6.28, n)
    def dessiner(self, f, t, force):
        if force <= 0.01: return f
        c = np.zeros((H // 2, W // 2), np.float32)
        y = (self.y - self.v * t) % H; x = self.x + 14 * np.sin(0.3 * t + self.ph)
        b = 0.5 + 0.5 * np.sin(2.1 * t + self.ph * 3)
        for xi, yi, ri, bi in zip(x, y, self.r, b):
            cv2.circle(c, (int(xi / 2), int(yi / 2)), max(1, int(ri / 2 + 0.5)), float(bi), -1, cv2.LINE_AA)
        c = cv2.GaussianBlur(c, (0, 0), 1.2)
        c = cv2.resize(c, (W, H))[..., None]
        return f + c * OR * 0.55 * force
POUSSIERE = Poussiere()

def halo(f, cy, force, rayon=0.55):
    r = np.sqrt(((xx - W / 2) / (W * rayon)) ** 2 + ((yy - cy) / (W * rayon)) ** 2)
    return f + (np.exp(-r ** 2 * 2.2)[..., None] * OR * force).astype(np.float32)

def apparition(T, a, duree):
    return lisse((T - a) / duree)

def carte_ouverture(u, T):
    """21 → 30 s : le logo sort du noir, une lumière le traverse, puis le nom de l'agence."""
    f = np.zeros((H, W, 3), np.float32)
    f = halo(f, 900, 0.10 * lisse(u / 2.5) * (1 - lisse((u - 7.6) / 1.2)) * (0.85 + 0.15 * math.sin(u * 1.4)))
    f = POUSSIERE.dessiner(f, T, lisse(u / 2) * (1 - lisse((u - 7.8) / 1.0)))
    a = apparition(u, 0.8, 2.4) * (1 - apparition(u, 5.0, 0.9))
    k = apparition(u, 0.8, 2.6)
    f = logo(f, W / 2, 900 - 30 * apparition(u, 5.0, 0.9), 860 * (1.07 - 0.07 * k), a, flou=14 * (1 - k),
             reflet=(u - 3.5) / 1.1 if 3.3 < u < 4.8 else None)
    cal = np.zeros((H, W, 4), np.float32)
    b = apparition(u, 5.4, 1.6) * (1 - apparition(u, 8.2, 0.75))
    texte(cal, 'MAÎTRE AKESSE', F_TITRE, 104, 820, IVOIRE, b, espace=0.14 + 0.25 * (1 - apparition(u, 5.4, 2.2)), flou=4 * (1 - apparition(u, 5.4, 1.4)))
    lg = 380 * doux((u - 6.1) / 1.1) * (1 - apparition(u, 8.2, 0.75))
    if lg > 1: cal[958:960, int(W / 2 - lg / 2):int(W / 2 + lg / 2)] = np.r_[OR, 1.0]
    texte(cal, 'MODEL MANAGEMENT', F_CAPS, 30, 1000, OR, apparition(u, 6.5, 1.0) * (1 - apparition(u, 8.2, 0.75)), espace=0.55)
    texte(cal, 'les répétitions du défilé', F_ITAL, 46, 1092, IVOIRE * 0.85, apparition(u, 7.0, 1.0) * (1 - apparition(u, 8.2, 0.75)), espace=0.02)
    return composer(f, cal)

def composer(f, cal):
    a = cal[..., 3:]
    return f * (1 - a) + cal[..., :3] * a

def carte_signature(u, T):
    """181 → 198 s : logo, nom et devise, coordonnées, puis le logo seul qui s'éteint dans le noir."""
    f = np.zeros((H, W, 3), np.float32)
    fin = 1 - lisse((u - 16.0) / 1.0)
    f = halo(f, 900, 0.11 * lisse(u / 2.0) * (0.85 + 0.15 * math.sin(u * 1.2)) * fin)
    f = POUSSIERE.dessiner(f, T, lisse(u / 2) * fin)
    # 1) le logo (0 → 4,6 s)
    a = apparition(u, 0.3, 2.2) * (1 - apparition(u, 4.0, 0.8)); k = apparition(u, 0.3, 2.5)
    f = logo(f, W / 2, 900, 860 * (1.07 - 0.07 * k), a, flou=12 * (1 - k), reflet=(u - 2.4) / 1.1 if 2.2 < u < 3.7 else None)
    cal = np.zeros((H, W, 4), np.float32)
    # 2) nom et devise (4,4 → 10,2 s)
    b = 1 - apparition(u, 9.6, 0.6)
    texte(cal, 'MAÎTRE AKESSE', F_TITRE, 104, 700, IVOIRE, apparition(u, 4.4, 1.4) * b, espace=0.14 + 0.25 * (1 - apparition(u, 4.4, 2.0)), flou=4 * (1 - apparition(u, 4.4, 1.2)))
    lg = 380 * doux((u - 5.0) / 1.0) * b
    if lg > 1: cal[838:840, int(W / 2 - lg / 2):int(W / 2 + lg / 2)] = np.r_[OR, 1.0]
    texte(cal, 'MODEL MANAGEMENT', F_CAPS, 30, 880, OR, apparition(u, 5.3, 1.0) * b, espace=0.55)
    texte(cal, "L'élégance se travaille.", F_ITAL, 70, 1040, IVOIRE, apparition(u, 6.2, 1.2) * b, flou=3 * (1 - apparition(u, 6.2, 1.0)))
    texte(cal, 'Le talent se révèle.', F_ITAL, 70, 1130, OR * 1.08, apparition(u, 7.2, 1.2) * b, flou=3 * (1 - apparition(u, 7.2, 1.0)))
    # 3) coordonnées (10,2 → 15 s)
    c = 1 - apparition(u, 14.4, 0.6)
    lignes = [
        ('www.maitreakessemodelmanagement.com', F_SERIF, 50, IVOIRE, 0.01, 560),
        ('TÉLÉPHONE', F_CAPS, 24, OR, 0.5, 700),
        ('+225 27 22 23 11 76', F_SERIF, 54, IVOIRE, 0.06, 744),
        ('+225 07 11 25 03 20', F_SERIF, 54, IVOIRE, 0.06, 812),
        ('WHATSAPP', F_CAPS, 24, OR, 0.5, 930),
        ('+225 05 45 65 66 87', F_SERIF, 54, IVOIRE, 0.06, 974),
        ('RÉSEAUX', F_CAPS, 24, OR, 0.5, 1092),
        ('Instagram · YouTube', F_CAPS4, 26, IVOIRE * 0.75, 0.2, 1140),
        ('@maitreakessemodelmanagement', F_SERIF, 46, IVOIRE, 0.02, 1180),
        ('TikTok', F_CAPS4, 26, IVOIRE * 0.75, 0.2, 1266),
        ('@agencemaitreakessemodel', F_SERIF, 46, IVOIRE, 0.02, 1306),
        ('Facebook', F_CAPS4, 26, IVOIRE * 0.75, 0.2, 1392),
        ('Maître Akesse Model Management', F_SERIF, 46, IVOIRE, 0.02, 1432),
    ]
    for j, (t_, fo, ta, co, es, y) in enumerate(lignes):
        al = apparition(u, 10.2 + 0.13 * j, 0.7) * c
        texte(cal, t_, fo, ta, y + 18 * (1 - apparition(u, 10.2 + 0.13 * j, 0.8)), co, al, espace=es)
    lg = 300 * doux((u - 10.5) / 0.9) * c
    if lg > 1: cal[648:650, int(W / 2 - lg / 2):int(W / 2 + lg / 2)] = np.r_[OR, 1.0]
    f = composer(f, cal)
    # 4) le logo seul, qui s'éteint
    a = apparition(u, 14.9, 1.0) * fin; k = apparition(u, 14.9, 1.6)
    f = logo(f, W / 2, 900, 760 * (1.0 + 0.03 * k), a, flou=6 * (1 - k))
    return f

CARTES = dict(ouverture=carte_ouverture, signature=carte_signature)

# ------------------------------------------------------------------ rendu
class Monteur:
    def __init__(self):
        self.plans = chronologie(); self.lus = {}
    def actifs(self, T):
        return [p for p in self.plans if p['S'] - p['pre'] - 1e-9 <= T < p['S'] + p['d'] + p['post'] - 1e-9]
    def lu(self, p):
        cle = id(p)
        if cle not in self.lus: self.lus[cle] = lire(p)
        return self.lus[cle]
    def oublier(self, T):
        for p in self.plans:
            if id(p) in self.lus and T >= p['S'] + p['d'] + p['post']: del self.lus[id(p)]
    def image(self, i):
        T = i / FPS
        act = self.actifs(T)
        if not act: return np.zeros((H, W, 3), np.float32)
        couches = []
        for p in act:
            if 'carte' in p: f = CARTES[p['carte']](T - p['S'], T)
            else: f = image_du_plan(p, self.lu(p), T, i)
            tau = T - p['S']
            if p['pre'] > 0 and tau < p['pre']: w = lisse((tau + p['pre']) / (2 * p['pre']))
            elif p['post'] > 0 and tau > p['d'] - p['post']: w = 1 - lisse((tau - (p['d'] - p['post'])) / (2 * p['post']))
            else: w = 1.0
            couches.append((f, w))
        if len(couches) == 1: return couches[0][0]
        tot = sum(w for _, w in couches)
        return sum(f * (w / tot) for f, w in couches)

def en_octets(f):
    return (np.clip(f, 0, 1) * 255 + 0.5).astype(np.uint8)

def evenements(plans):
    ev = []
    for p in plans:
        tr = p.get('tr', 'cut')
        if 'carte' in p: continue
        if tr == 'flash': ev.append(dict(t=p['S'], son='impact'))
        elif isinstance(tr, tuple) and tr[0] == 'balaye': ev.append(dict(t=p['S'], son='whoosh'))
        elif isinstance(tr, tuple) and tr[0] == 'noir' and p['S'] < 30: ev.append(dict(t=p['S'], son='souffle'))
        elif tr == 'cut' and p['S'] > 30: ev.append(dict(t=p['S'], son='coupe'))
    return ev

def main():
    m = Monteur(); act = sys.argv[1] if len(sys.argv) > 1 else 'film'
    os.makedirs(os.path.join(ICI, 'cache'), exist_ok=True); os.makedirs(os.path.join(ICI, 'sortie'), exist_ok=True)
    if act == 'preparer':
        vrais = [p for p in m.plans if 'carte' not in p]
        with ThreadPoolExecutor(4) as ex: list(ex.map(preparer_un, vrais))
        print('ralentis prêts :', len(vrais), 'plans')
    elif act == 'images':
        for t in sys.argv[2:]:
            i = int(round(float(t) * FPS)); m.lus = {}
            cv2.imwrite(os.path.join(ICI, 'sortie', f'img_{float(t):07.2f}.jpg'), cv2.cvtColor(en_octets(m.image(i)), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])
    elif act == 'planche':
        dos = os.path.join(ICI, 'sortie', 'planche'); os.makedirs(dos, exist_ok=True)
        for n, p in enumerate(m.plans):
            if 'carte' in p: ts = [p['S'] + p['d'] * x for x in (0.15, 0.35, 0.55, 0.75, 0.9)]
            else: ts = [p['S'] + 0.05, p['S'] + p['d'] / 2, p['S'] + p['d'] - 0.05]
            m.lus = {}
            for j, t in enumerate(ts):
                im = en_octets(m.image(int(round(t * FPS))))
                im = cv2.resize(im, (270, 480), interpolation=cv2.INTER_AREA)
                cv2.putText(im, f"{n} {p.get('r', p.get('carte'))} {t:.1f}", (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1, cv2.LINE_AA)
                cv2.imwrite(os.path.join(dos, f'{n:02d}_{j}.jpg'), cv2.cvtColor(im, cv2.COLOR_RGB2BGR))
        print('planche écrite')
    elif act == 'film':
        sortie = os.path.join(ICI, 'sortie', 'film-muet.mp4')
        enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                                '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-tune', 'film', sortie], stdin=subprocess.PIPE)
        n = int(round(DUREE * FPS))
        for i in range(n):
            enc.stdin.write(en_octets(m.image(i)).tobytes()); m.oublier(i / FPS)
            if i % 300 == 0: print(f'{i / FPS:6.1f} s', flush=True)
        enc.stdin.close(); enc.wait()
        json.dump(evenements(m.plans), open(os.path.join(ICI, 'sortie', 'evenements.json'), 'w'), indent=1)
        print('film muet :', sortie)

if __name__ == '__main__':
    main()
