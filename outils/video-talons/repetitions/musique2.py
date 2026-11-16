#!/usr/bin/env python3
"""Musique ORIGINALE afro-house du film libre « On répète » (version 2, 16/11/2026), composée ici, libre de droits.

La mineur, 120 battements par minute (1 mesure = 2 s), accords La m9 – Fa maj7 – Ré m9 – Mi m7 :
  0-16 s  percussions seules (shaker, congas, rimshot), accords étouffés ; 12-15,5 roulement, 15,5-16 silence
  16-44 s la marche : grosse caisse, « log drum », claquements, kalimba à partir de 22 s
  44-52 s respiration (sans grosse caisse), 52-64 s deuxième élan, 64-68 s une pose par temps (déclic photo)
  68-72 s à demi-temps, 72-84 s signature : accord, logo, extinction
Effets : impacts et whoosh de ../sons (ElevenLabs), déclic photo, rembobinage de bande synthétisé.

  python3 musique2.py      → sortie/v2-musique.wav
"""
import json, os, subprocess, wave
import numpy as np
from scipy.signal import butter, sosfilt, oaconvolve

ICI = os.path.dirname(os.path.abspath(__file__))
SR = 48000; DUREE = 84.0; N = int(SR * DUREE)
B = 0.5; MES = 2.0; DC = B / 4
rng = np.random.default_rng(21)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
pistes = {k: np.zeros((N, 2), np.float32) for k in ('perc', 'kick', 'log', 'acc', 'kal', 'fx', 'nappe')}

def poser(p, son, t, pan=0.0, vol=1.0):
    i = int(round(t * SR))
    if son.ndim == 1: son = np.stack([son * np.sqrt(0.5 * (1 - pan)), son * np.sqrt(0.5 * (1 + pan))], 1)
    if i < 0: son, i = son[-i:], 0
    if i >= N: return
    son = son[: N - i]; pistes[p][i:i + len(son)] += son * vol

def filtre(x, f, t='low', o=2):
    f = np.atleast_1d(f) / (SR / 2)
    return sosfilt(butter(o, f if len(f) > 1 else f[0], btype=t, output='sos'), x, axis=0)

def tt(d): return np.arange(int(d * SR)) / SR

# ---------------------------------------------------------------- sons
def kick(t, v=1.0):
    x = tt(0.4); f = 44 + 120 * np.exp(-x / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.16) + 0.2 * filtre(rng.normal(0, 1, len(x)), 4000) * np.exp(-x / 0.003)
    poser('kick', s, t, vol=v)

def clap(t, v=0.3):
    x = tt(0.3); s = filtre(rng.normal(0, 1, len(x)), [1000, 7000], 'band')
    e = np.exp(-x / 0.07) + sum(0.7 * np.exp(-np.abs(x - d) / 0.003) for d in (0.0, 0.011, 0.022))
    poser('perc', s * e, t, vol=v)

def shaker(t, v=0.05, pan=0.3):
    x = tt(0.07); s = filtre(rng.normal(0, 1, len(x)), 6500, 'high') * np.sin(np.pi * np.clip(x / 0.06, 0, 1)) ** 2
    poser('perc', s, t, pan, v)

def conga(t, f0, v=0.22, pan=0.0):
    x = tt(0.25); f = f0 * (1 + 0.12 * np.exp(-x / 0.01))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.09) + 0.3 * filtre(rng.normal(0, 1, len(x)), [1500, 5000], 'band') * np.exp(-x / 0.008)
    poser('perc', s, t, pan, v)

def rim(t, v=0.08, pan=-0.3):
    x = tt(0.06); s = (np.sin(2 * np.pi * 1700 * x) + 0.6 * np.sin(2 * np.pi * 2650 * x)) * np.exp(-x / 0.008)
    poser('perc', s, t, pan, v)

def hat_ouvert(t, v=0.05):
    x = tt(0.25); poser('perc', filtre(rng.normal(0, 1, len(x)), 8000, 'high') * np.exp(-x / 0.07), t, 0.2, v)

def log_drum(t, m, v=0.32, d=0.32):
    x = tt(d); f = hz(m) * (1 + 1.0 * np.exp(-x / 0.018))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.tanh(2.2 * (np.sin(ph) + 0.25 * np.sin(2 * ph))) * np.exp(-x / (d * 0.45)) * np.minimum(1, x / 0.002)
    poser('log', s, t, vol=v)

def accord(t, notes, d=0.22, v=0.07, coupure=2400):
    x = tt(d + 0.2); s = np.zeros(len(x))
    for m in notes:
        for de in (-0.003, 0.003):
            ph = (hz(m) * (1 + de) * x + rng.random()) % 1; s += 2 * ph - 1
    s = filtre(s, coupure) * np.exp(-x / (d * 0.6)) * np.minimum(1, x / 0.004) / len(notes)
    poser('acc', s, t, rng.uniform(-0.2, 0.2), v)

def nappe(notes, t, d, v=0.06, a=0.8, r=1.2):
    x = tt(d + r); s = np.zeros((len(x), 2))
    for m in notes:
        for k, de in enumerate((-0.004, 0.004)):
            ph = (hz(m) * (1 + de) * x + rng.random()) % 1; s[:, k] += 2 * ph - 1
    e = np.minimum(1, x / a) * np.clip((d + r - x) / r, 0, 1)
    poser('nappe', filtre(s, 1500) * e[:, None] / len(notes), t, vol=v)

def kalimba(t, m, v=0.12, pan=0.0):
    x = tt(1.2); f = hz(m)
    s = (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * f * 5.4 * x) * np.exp(-x / 0.03)) * np.exp(-x / 0.35) * np.minimum(1, x / 0.002)
    poser('kal', s, t, pan, v)

def montee(t_fin, d, v=0.2):
    x = tt(d); u = x / d; br = rng.normal(0, 1, len(x)); s = np.zeros(len(x))
    for k in range(8):
        a, b = k * len(x) // 8, (k + 1) * len(x) // 8; fc = 300 * 2 ** (k * 0.55)
        s[a:b] = filtre(br[max(0, a - 2000):b], [fc, fc * 2], 'band')[-(b - a):]
    poser('fx', s * u ** 2, t_fin - d, vol=v)

def impact_grave(t, v=0.8):
    x = tt(2.5); f = 32 + 50 * np.exp(-x / 0.12)
    poser('fx', np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.7), t, vol=v)

def rembobine(t, d, v=0.25):
    x = tt(d); u = x / d
    f = 1800 * (1 - 0.8 * u) + 300 * np.sin(2 * np.pi * 37 * x)
    s = 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * filtre(rng.normal(0, 1, len(x)), [800, 5000], 'band')
    poser('fx', s * np.sin(np.pi * u) ** 0.5, t, vol=v)

# ---------------------------------------------------------------- motifs (en doubles croches, 16 par mesure)
ACC = [([57, 60, 64, 67, 71], 33), ([53, 57, 60, 64], 29), ([50, 53, 57, 60, 64], 26), ([52, 55, 59, 62], 28)]
CONGA_H = [0, 3, 6, 10, 11, 14]; CONGA_B = [2, 8, 12]
LOG = [(0, 0), (3, 0), (6, 7), (10, 12), (12, 0), (14, 3)]
STAB = [2, 7, 10, 13]
KAL = [69, 72, 76, 74, 72, 69, 67, 69]

def mesure(t, n, kickon=True, logon=True, stabs=True, kal=False, clapon=True, coupure=2400, swing=0.06):
    notes, basse = ACC[n % 4]
    for c in range(16):
        tc = t + c * DC + (swing * DC if c % 2 else 0)
        shaker(tc, 0.045 if c % 2 else 0.06, pan=0.35)
        if c in CONGA_H: conga(tc, 330, 0.16, pan=-0.25)
        if c in CONGA_B: conga(tc, 215, 0.2, pan=0.15)
        if c in (4, 12): rim(tc)
        if kickon and c % 4 == 0: kick(tc)
        if kickon and c % 4 == 2: hat_ouvert(tc)
        if clapon and kickon and c in (4, 12): clap(tc)
        if stabs and c in STAB: accord(tc, notes, v=0.075, coupure=coupure)
    if logon:
        for c, dm in LOG: log_drum(t + c * DC, basse + dm, 0.3)
    if kal:
        for j in range(8):
            if (n + j) % 3 != 2: kalimba(t + j * B / 2 + B / 4, KAL[(j + 2 * n) % 8], 0.1, pan=(-0.3, 0.3)[j % 2])

# ---------------------------------------------------------------- partition
for k in range(6): mesure(k * MES, k, kickon=False, logon=False, coupure=700)          # 0-12 : percussions, accords étouffés
nappe([57, 64, 67, 72], 0.0, 12.0, 0.05, a=3)
mesure(12.0, 6, kickon=False, logon=True, coupure=1200)
mesure(14.0, 7, kickon=False, logon=False, coupure=1800)
for j in range(16): clap(12.0 + 3.5 * (j / 16) ** 0.8, 0.06 + 0.16 * j / 16)              # roulement qui s'accélère
montee(15.5, 3.5, 0.22)
pistes_silence = (15.5, 16.0)
impact_grave(16.0, 0.9)
for k in range(14): mesure(16.0 + k * MES, k, kal=(k >= 3))                                  # 16-44
for k in range(4): mesure(44.0 + k * MES, k, kickon=False, logon=(k >= 2), stabs=True, kal=True, coupure=1400)   # 44-52
nappe([57, 60, 64, 71], 44.0, 8.0, 0.06)
montee(52.0, 2.0, 0.2)
impact_grave(52.0, 0.8)
for k in range(6): mesure(52.0 + k * MES, k, kal=True)                                        # 52-64
for k in range(2): mesure(64.0 + k * MES, k, kal=False, stabs=False)                          # 64-68 : poses
for j in range(8): kick(64.0 + j * B, 0.9); accord(64.0 + j * B, ACC[j // 2 % 4][0], d=0.3, v=0.09)
# 68-72 : demi-temps
for j in range(2):
    t = 68.0 + 2 * j; kick(t, 0.8); clap(t + 1.0, 0.25); log_drum(t, 33 + (0, -4)[j], 0.3, 0.6)
    for c in range(16): shaker(t + c * DC, 0.035)
nappe([57, 60, 64, 67], 68.0, 4.0, 0.07)
for j, m in enumerate([76, 74, 72, 69]): kalimba(68.0 + j, m, 0.12)
# 72-84 : signature
impact_grave(72.0, 0.9); kick(72.0, 1.0)
nappe([57, 60, 64, 71, 76], 72.0, 10.5, 0.08, a=0.3, r=1.4)
for k in range(5): mesure(72.0 + k * MES, k, kickon=(k in (2, 3)), logon=(k in (2, 3)), stabs=(k >= 1), kal=(k >= 1), coupure=1600)
for t, m in ((72.2, 81), (73.0, 76), (74.0, 72)): kalimba(t, m, 0.12)

# ---------------------------------------------------------------- effets
def son(nom):
    brut = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', os.path.join(ICI, '..', 'sons', nom), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'])
    return np.frombuffer(brut, np.float32).reshape(-1, 2)
for e in json.load(open(os.path.join(ICI, 'sortie', 'v2-evenements.json'))):
    if e['son'] == 'impact': poser('fx', son('a-impact.mp3'), e['t'] - 0.03, vol=0.5)
    elif e['son'] == 'declic': poser('fx', son('photo.mp3'), e['t'] - 0.02, vol=0.45)
    elif e['son'] == 'whoosh': poser('fx', son('whoosh.mp3'), e['t'] - 0.3, vol=0.45)
    elif e['son'] == 'rembobine': rembobine(e['t'], e['d'], 0.28)
    elif e['son'] == 'logo': poser('fx', son('a-impact.mp3'), e['t'] - 0.03, vol=0.45); poser('fx', son('shine.mp3'), e['t'] + 0.2, vol=0.3)

# ---------------------------------------------------------------- mixage
def reverb(x, d=1.8, m=0.25):
    n = int(d * SR); ir = rng.normal(0, 1, (n, 2)) * np.exp(-tt(d) / (d / 6.9))[:, None]
    ir = filtre(ir, 6000); ir[: int(0.01 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum(0))
    return x + m * np.stack([oaconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)

env = filtre(np.abs(pistes['kick'][:, 0]), 10.0) * 5
pompe = (1 - np.clip(env, 0, 0.5))[:, None]
mix = (pistes['kick'] + pistes['log'] * pompe + reverb(pistes['perc'], 1.2, 0.2) + reverb(pistes['acc'], 2.0, 0.35) * pompe
       + reverb(pistes['kal'], 2.2, 0.45) + reverb(pistes['nappe'], 3.0, 0.5) * pompe + reverb(pistes['fx'], 2.4, 0.35))
x = np.arange(N) / SR
a, b = pistes_silence
mix *= np.where((x >= a) & (x < b), 0.0, 1.0)[:, None] + np.where((x >= a) & (x < b), np.exp(-(x - a) / 0.05), 0)[:, None]
mix = filtre(mix, 30, 'high')
mix *= np.clip((DUREE - x) / 1.5, 0, 1)[:, None]
mix = np.tanh(mix * 1.3) / 1.3
mix /= np.abs(mix).max() / 0.89
sortie = os.path.join(ICI, 'sortie', 'v2-musique.wav')
with wave.open(sortie, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('musique :', sortie)
