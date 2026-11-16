#!/usr/bin/env python3
"""Musique ORIGINALE techno du film « On répète » (version 3 de la musique, 16/11/2026), composée ici, libre de droits.
Demande de la propriétaire : « une musique techno dynamique » (l'afro-house de la version 2 n'a pas plu).

120 battements par minute (calé sur le montage de plans2.py), La mineur. Grosse caisse lourde à chaque temps, basse
roulante en doubles croches, ligne « acid » (oscillateur en dents de scie et filtre résonant), charleston, ride,
claps, accords percutants, montées et silences sur les moments forts du film :
  0-16 s  la grosse caisse étouffée et l'acid montent ; 15,5-16 silence ; 16 s : tout s'ouvre
  44-52 s break (acid seule, montée), 52 s : retour, 64-68 s un coup par pose, 72-84 s fin qui se referme

  python3 musique3.py      → sortie/v3-musique.wav
"""
import json, os, subprocess, wave
import numpy as np
from scipy.signal import butter, sosfilt, oaconvolve, lfilter

ICI = os.path.dirname(os.path.abspath(__file__))
SR = 48000; DUREE = 84.0; N = int(SR * DUREE)
B = 0.5; MES = 2.0; DC = B / 4
rng = np.random.default_rng(31)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
pistes = {k: np.zeros((N, 2), np.float32) for k in ('kick', 'basse', 'acid', 'hats', 'perc', 'stab', 'fx', 'nappe')}

def poser(p, son, t, pan=0.0, vol=1.0):
    i = int(round(t * SR))
    if son.ndim == 1: son = np.stack([son * np.sqrt(0.5 * (1 - pan)), son * np.sqrt(0.5 * (1 + pan))], 1)
    if i < 0: son, i = son[-i:], 0
    if i >= N: return
    son = son[: N - i]; pistes[p][i:i + len(son)] += son * vol

def filtre(x, f, t='low', o=2):
    f = np.atleast_1d(f) / (SR / 2)
    return sosfilt(butter(o, f if len(f) > 1 else f[0], btype=t, output='sos'), x, axis=0)

def passe_bas_resonant(x, fc, q):
    w = 2 * np.pi * min(fc, 18000) / SR; al = np.sin(w) / (2 * q); c = np.cos(w)
    b = np.array([(1 - c) / 2, 1 - c, (1 - c) / 2]); a = np.array([1 + al, -2 * c, 1 - al])
    return lfilter(b / a[0], a / a[0], x)

def tt(d): return np.arange(int(d * SR)) / SR

# ---------------------------------------------------------------- sons
def kick(t, v=1.0, etouffe=0.0):
    x = tt(0.42); f = 47 + 150 * np.exp(-x / 0.025)
    s = np.tanh(1.8 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-x / 0.2)
    s += 0.35 * filtre(rng.normal(0, 1, len(x)), 5000) * np.exp(-x / 0.0025)
    if etouffe > 0: s = filtre(s, 120 + 3000 * (1 - etouffe))
    poser('kick', s, t, vol=v)

def basse_roulante(t, m, v=0.28, ouvert=1.0):
    x = tt(DC * 0.95); ph = (hz(m) * x) % 1
    s = filtre(2 * ph - 1, 180 + 600 * ouvert) * np.exp(-x / 0.06) * np.minimum(1, x / 0.003)
    s += 0.6 * np.sin(2 * np.pi * hz(m) * x) * np.exp(-x / 0.07)
    poser('basse', s, t, vol=v)

def acid(t, m, coupure, v=0.11, accent=False, glisse=None):
    d = DC * (1.0 if glisse else 0.85); x = tt(d)
    f = np.full(len(x), hz(m)) if glisse is None else hz(glisse) + (hz(m) - hz(glisse)) * np.minimum(1, x / 0.04)
    ph = np.cumsum(f) / SR % 1
    s = 2 * ph - 1
    out = np.zeros(len(x))
    for k in range(4):                                                  # filtre qui se referme pendant la note
        a, b = k * len(x) // 4, (k + 1) * len(x) // 4
        fc = coupure * (2.6 if accent else 1.7) * np.exp(-(a / SR) / 0.05) + coupure * 0.5
        out[a:b] = passe_bas_resonant(s[max(0, a - 500):b], fc, 7 if accent else 5)[-(b - a):]
    out = np.tanh(out * (2.4 if accent else 1.6)) * np.minimum(1, x / 0.002) * np.clip((d - x) / 0.006, 0, 1)
    poser('acid', out, t, 0.1, v)

def charleston(t, v=0.05, ouvert=False, pan=0.25):
    x = tt(0.22 if ouvert else 0.04)
    s = filtre(rng.normal(0, 1, len(x)), 8000, 'high') * np.exp(-x / (0.06 if ouvert else 0.011))
    poser('hats', s, t, pan, v)

def ride(t, v=0.03):
    x = tt(0.4); s = filtre(rng.normal(0, 1, len(x)), [5000, 12000], 'band') * np.exp(-x / 0.18)
    s += 0.2 * np.sin(2 * np.pi * 3900 * x) * np.exp(-x / 0.1)
    poser('hats', s, t, -0.3, v)

def clap(t, v=0.32):
    x = tt(0.35); s = filtre(rng.normal(0, 1, len(x)), [900, 6500], 'band')
    e = np.exp(-x / 0.08) + sum(0.8 * np.exp(-np.abs(x - d) / 0.003) for d in (0.0, 0.01, 0.021))
    poser('perc', s * e, t, vol=v)

def tom(t, f0=120, v=0.2):
    x = tt(0.3); f = f0 * (1 + 0.4 * np.exp(-x / 0.03))
    poser('perc', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.12), t, 0.2, v)

def stab(t, notes, v=0.09, d=0.3, coupure=3000):
    x = tt(d + 0.3); s = np.zeros(len(x))
    for m in notes:
        for de in (-0.006, 0.0, 0.006):
            s += 2 * ((hz(m) * (1 + de) * x + rng.random()) % 1) - 1
    s = filtre(s, coupure) * np.exp(-x / (d * 0.5)) * np.minimum(1, x / 0.003) / (len(notes) * 2)
    poser('stab', s, t, rng.uniform(-0.25, 0.25), v)

def nappe(notes, t, d, v=0.05):
    x = tt(d + 1.0); s = np.zeros((len(x), 2))
    for m in notes:
        for k, de in enumerate((-0.005, 0.005)): s[:, k] += 2 * ((hz(m) * (1 + de) * x + rng.random()) % 1) - 1
    e = np.minimum(1, x / 1.0) * np.clip((d + 1.0 - x) / 1.0, 0, 1)
    poser('nappe', filtre(s, 1300) * e[:, None] / len(notes), t, vol=v)

def montee(t_fin, d, v=0.22):
    x = tt(d); u = x / d; br = rng.normal(0, 1, len(x)); s = np.zeros(len(x))
    for k in range(10):
        a, b = k * len(x) // 10, (k + 1) * len(x) // 10; fc = 250 * 2 ** (k * 0.5)
        s[a:b] = filtre(br[max(0, a - 2000):b], [fc, fc * 2], 'band')[-(b - a):]
    s += 0.25 * np.sin(2 * np.pi * np.cumsum(200 + 1400 * u ** 2) / SR)
    poser('fx', s * u ** 2, t_fin - d, vol=v)

def impact(t, v=0.85):
    x = tt(2.4); f = 32 + 60 * np.exp(-x / 0.1)
    s = np.tanh(1.5 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-x / 0.6) + 0.4 * filtre(rng.normal(0, 1, len(x)), 2500) * np.exp(-x / 0.15)
    poser('fx', s, t, vol=v)

def rembobine(t, d, v=0.28):
    x = tt(d); u = x / d
    f = 1600 * (1 - 0.8 * u) + 300 * np.sin(2 * np.pi * 37 * x)
    s = 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * filtre(rng.normal(0, 1, len(x)), [800, 5000], 'band')
    poser('fx', s * np.sin(np.pi * u) ** 0.5, t, vol=v)

# ---------------------------------------------------------------- motifs
ACID = [(0, 45, True), (2, 57, False), (3, 45, False), (5, 55, True), (6, 45, False), (8, 60, True), (10, 45, False),
        (11, 57, False), (12, 52, True), (14, 45, False), (15, 55, False)]
ACCORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 64]]
BASSE = [33, 29, 31, 28]

def mesure(t, n, kick_v=1.0, etouffe=0.0, basse_on=True, acid_c=900, acid_v=0.11, hats=True, clap_on=True, ride_on=False, stabs=False, toms=False):
    for k in range(4):
        tb = t + k * B
        if kick_v > 0: kick(tb, kick_v, etouffe)
        if hats:
            charleston(tb + B / 2, 0.07, ouvert=True)
            for c in range(4): charleston(tb + c * DC, 0.045 if c % 2 else 0.03, pan=-0.2 + 0.4 * (c % 2))
        if clap_on and k in (1, 3): clap(tb)
        if ride_on: ride(tb + B / 2, 0.035)
        if basse_on:
            for c in (1, 2, 3): basse_roulante(tb + c * DC, BASSE[n % 4], ouvert=0.6 if c == 2 else 0.3)
        if toms and k == 3: tom(tb + 2 * DC, 140); tom(tb + 3 * DC, 110)
    if acid_v > 0:
        for c, m, acc in ACID:
            acid(t + c * DC, m + (BASSE[n % 4] - 33), acid_c, acid_v, acc)
    if stabs: stab(t + 3 * DC, ACCORDS[n % 4], 0.09); stab(t + 2 * B + 3 * DC, ACCORDS[n % 4], 0.06)

# ---------------------------------------------------------------- partition (coupure de l'acid qui s'ouvre au fil du film)
for k in range(4): mesure(k * MES, k, kick_v=0.85, etouffe=0.85, basse_on=False, acid_c=350 + 120 * k, acid_v=0.09, clap_on=False, hats=(k >= 1))
for k in range(2): mesure(8.0 + k * MES, k, kick_v=0.9, etouffe=0.6, basse_on=True, acid_c=900 + 300 * k, acid_v=0.1, clap_on=True)
mesure(12.0, 2, kick_v=0.9, etouffe=0.35, acid_c=1700, acid_v=0.1, clap_on=False)
mesure(14.0, 3, kick_v=0.0, acid_c=2300, acid_v=0.1, clap_on=False, basse_on=False)
for j in range(24): clap(12.0 + 3.5 * (j / 24) ** 0.85, 0.05 + 0.2 * j / 24)
for j in range(7): kick(14.0 + j * 0.25, 0.5 + 0.06 * j, 0.3)
montee(15.5, 4.0, 0.25)
SILENCE = (15.5, 16.0)
impact(16.0, 0.9)
for k in range(14):
    mesure(16.0 + k * MES, k, acid_c=1500 + 120 * (k % 8), acid_v=0.11, ride_on=(k >= 4), stabs=(k % 2 == 0), toms=(k % 4 == 3))
for k in range(4):                                                     # break : sans grosse caisse
    mesure(44.0 + k * MES, k, kick_v=0.0, basse_on=(k >= 2), acid_c=900 + 700 * k, acid_v=0.26, hats=True, clap_on=(k == 3))
nappe([57, 60, 64, 69], 44.0, 8.0, 0.14)
for j in range(16): clap(50.0 + 2.0 * (j / 16) ** 0.9, 0.06 + 0.2 * j / 16)
montee(52.0, 4.0, 0.25)
impact(52.0, 0.9)
for k in range(6): mesure(52.0 + k * MES, k, acid_c=2600, acid_v=0.12, ride_on=True, stabs=True, toms=(k % 2 == 1))
for j in range(8):                                                     # 64-68 : une pose par temps
    kick(64.0 + j * B, 1.0); stab(64.0 + j * B, ACCORDS[j // 2 % 4], 0.11, 0.35); charleston(64.0 + j * B + B / 2, 0.07, True)
    for c in (1, 2, 3): basse_roulante(64.0 + j * B + c * DC, BASSE[j // 2 % 4])
for j in range(2):                                                     # 68-72 : demi-temps
    t = 68.0 + 2 * j; kick(t, 0.9); clap(t + 1.0, 0.28)
    for c in range(16): charleston(t + c * DC, 0.03)
    for c, m, acc in ACID: acid(t + c * DC, m, 1400 - 300 * j, 0.2, acc)
    for c in (1, 2, 3, 5, 6, 7): basse_roulante(t + c * DC * 2, 33)
nappe([57, 60, 64, 67], 68.0, 4.0, 0.07)
impact(72.0, 0.9)
for k in range(5):                                                     # fin : la techno se referme
    mesure(72.0 + k * MES, k, kick_v=(1.0 if k < 4 else 0.0), etouffe=0.2 * k, basse_on=(k < 4), acid_c=1800 - 300 * k, acid_v=0.1, ride_on=(k < 3), stabs=(k < 4))
nappe([57, 60, 64, 71], 72.0, 11.0, 0.06)

# ---------------------------------------------------------------- effets
def son(nom):
    brut = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', os.path.join(ICI, '..', 'sons', nom), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'])
    return np.frombuffer(brut, np.float32).reshape(-1, 2)
for e in json.load(open(os.path.join(ICI, 'sortie', 'v2-evenements.json'))):
    if e['son'] == 'impact': poser('fx', son('a-impact.mp3'), e['t'] - 0.03, vol=0.5)
    elif e['son'] == 'declic': poser('fx', son('photo.mp3'), e['t'] - 0.02, vol=0.45)
    elif e['son'] == 'whoosh': poser('fx', son('whoosh.mp3'), e['t'] - 0.3, vol=0.45)
    elif e['son'] == 'rembobine': rembobine(e['t'], e['d'], 0.3)
    elif e['son'] == 'logo': poser('fx', son('shine.mp3'), e['t'] + 0.2, vol=0.3)

# ---------------------------------------------------------------- mixage
def reverb(x, d=1.6, m=0.25):
    n = int(d * SR); ir = rng.normal(0, 1, (n, 2)) * np.exp(-tt(d) / (d / 6.9))[:, None]
    ir = filtre(ir, 6000); ir[: int(0.01 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum(0))
    return x + m * np.stack([oaconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)

def echo(x, retard=3 * DC, retour=0.35, m=0.3):
    y = x.copy(); n = int(retard * SR); acc = x.copy()
    for k in range(1, 5):
        acc = np.roll(acc, n, axis=0) * retour; acc[:n] = 0
        y += m * np.roll(acc, 0, axis=1)[:, ::(-1 if k % 2 else 1)]
    return y

env = filtre(np.abs(pistes['kick'][:, 0]), 12.0) * 5
pompe = (1 - np.clip(env, 0, 0.55))[:, None]
mix = (pistes['kick'] * 1.1 + pistes['basse'] * pompe + reverb(echo(pistes['acid']), 1.4, 0.2) * pompe + pistes['hats']
       + reverb(pistes['perc'], 1.4, 0.22) + reverb(echo(pistes['stab'], 3 * DC, 0.4, 0.35), 2.2, 0.35) * pompe
       + reverb(pistes['nappe'], 3.0, 0.5) * pompe + reverb(pistes['fx'], 2.4, 0.35))
x = np.arange(N) / SR
a, b = SILENCE
dans = (x >= a) & (x < b)
mix *= np.where(dans, np.exp(-(x - a) / 0.04), 1.0)[:, None]
mix = filtre(mix, 28, 'high')
mix *= np.clip((DUREE - x) / 1.5, 0, 1)[:, None]
mix = np.tanh(mix * 1.5) / 1.5
mix /= np.abs(mix).max() / 0.89
sortie = os.path.join(ICI, 'sortie', 'v3-musique.wav')
with wave.open(sortie, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('musique :', sortie)
