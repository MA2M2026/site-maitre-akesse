#!/usr/bin/env python3
"""Musique ORIGINALE du film « Répétitions du défilé » (16/11/2026), composée ici : aucun droit d'auteur.

Ré mineur, 120 battements par minute, accords Ré m – Si♭ – Sol m – La (2 mesures chacun), calée sur plans.py :
  0-30 s   l'éveil : grondement, souffle, battements de cœur, montée vers le logo (impact à 21 s et à 30 s)
  30-58 s  la préparation : pulsation à demi-temps, basse en croches, nappe de cordes
  58-100 s la marche : rythme de défilé (grosse caisse à chaque temps, claquements, charleston, cordes piquées)
  100-126 s la maîtrise : tambours graves, mélodie
  126-130 s respiration, puis 130-163 s l'énergie collective (tout l'orchestre), roulement et silence
  163-181 s le final : cordes larges à demi-temps, puis decrescendo ; 181-198 s accord majeur, logo, extinction
Les effets sonores ElevenLabs déjà achetés (../sons) sont posés sur les transitions (sortie/evenements.json).

  python3 musique.py            → sortie/musique.wav (48 kHz stéréo)
"""
import json, os, subprocess
import numpy as np
from scipy.signal import butter, sosfilt, oaconvolve

ICI = os.path.dirname(os.path.abspath(__file__))
SR = 48000
DUREE = 198.0
N = int(SR * DUREE)
BPM = 120; B = 60 / BPM; MES = 4 * B
rng = np.random.default_rng(11)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)

pistes = {k: np.zeros((N, 2), np.float32) for k in ('nappe', 'basse', 'cordes', 'batterie', 'peaux', 'piano', 'lead', 'ambiance', 'effets')}

def poser(piste, son, t, pan=0.0, vol=1.0):
    i = int(round(t * SR))
    if son.ndim == 1: son = np.stack([son * np.sqrt(0.5 * (1 - pan)), son * np.sqrt(0.5 * (1 + pan))], 1)
    if i < 0: son, i = son[-i:], 0
    if i >= N: return
    son = son[: N - i]
    pistes[piste][i:i + len(son)] += son * vol

def filtre(x, f, type_='low', ordre=2):
    f = np.atleast_1d(f) / (SR / 2)
    return sosfilt(butter(ordre, f if len(f) > 1 else f[0], btype=type_, output='sos'), x, axis=0)

def scie(f, n, desacc=0.0):
    t = np.arange(n) / SR
    ph = (f * (1 + desacc) * t + rng.random()) % 1.0
    return 2 * ph - 1

def enveloppe(n, a, r, sustain=True):
    t = np.arange(n) / SR; d = n / SR
    e = np.minimum(1, t / max(a, 1e-4))
    return e * np.clip((d - t) / max(r, 1e-4), 0, 1) if sustain else e

# ---------------------------------------------------------------- instruments
def nappe(notes, t, d, vol=0.12, coupure=1700, a=1.2, r=1.8):
    n = int((d + r) * SR); son = np.zeros((n, 2))
    for m in notes:
        for k, de in enumerate((-0.004, 0.0, 0.0045)):
            s = scie(hz(m), n, de); pan = (-0.6, 0.0, 0.6)[k]
            son[:, 0] += s * np.sqrt(0.5 * (1 - pan)); son[:, 1] += s * np.sqrt(0.5 * (1 + pan))
    son = filtre(son, coupure) * enveloppe(n, a, r)[:, None] / (len(notes) * 2.2)
    poser('nappe', son, t, vol=vol)

def basse(m, t, d=0.22, vol=0.35):
    n = int(d * SR); tt = np.arange(n) / SR
    s = 0.7 * filtre(scie(hz(m), n), 520) + 0.6 * np.sin(2 * np.pi * hz(m) * tt)
    poser('basse', s * np.exp(-tt / (d * 0.55)) * np.minimum(1, tt / 0.004), t, vol=vol)

def corde_piquee(m, t, vol=0.07, pan=0.0):
    n = int(0.16 * SR); tt = np.arange(n) / SR
    s = filtre(scie(hz(m), n, 0.002) + scie(hz(m), n, -0.003), 3200)
    poser('cordes', s * np.exp(-tt / 0.05) * np.minimum(1, tt / 0.003), t, pan, vol)

def grosse_caisse(t, vol=0.9):
    n = int(0.45 * SR); tt = np.arange(n) / SR
    f = 46 + 110 * np.exp(-tt / 0.035)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.17)
    s += 0.25 * filtre(rng.normal(0, 1, n), 3000) * np.exp(-tt / 0.004)
    poser('batterie', s, t, vol=vol)

def claquement(t, vol=0.32):
    n = int(0.35 * SR); tt = np.arange(n) / SR
    s = filtre(rng.normal(0, 1, n), [900, 6000], 'band') * (np.exp(-tt / 0.09) + 0.6 * np.exp(-np.abs(tt - 0.012) / 0.004))
    s += 0.35 * np.sin(2 * np.pi * 185 * tt) * np.exp(-tt / 0.06)
    poser('batterie', s, t, vol=vol)

def charleston(t, vol=0.05, ouvert=False, pan=0.25):
    n = int((0.25 if ouvert else 0.05) * SR); tt = np.arange(n) / SR
    s = filtre(rng.normal(0, 1, n), 7500, 'high') * np.exp(-tt / (0.09 if ouvert else 0.014))
    poser('batterie', s, t, pan, vol)

def tambour_grave(t, vol=0.55, f0=88):
    n = int(1.1 * SR); tt = np.arange(n) / SR
    f = f0 * (0.72 + 0.28 * np.exp(-tt / 0.08))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.42)
    s += 0.5 * filtre(rng.normal(0, 1, n), [80, 900], 'band') * np.exp(-tt / 0.05)
    poser('peaux', s, t, vol=vol)

def piano(m, t, vol=0.16, d=3.5, pan=0.0):
    n = int(d * SR); tt = np.arange(n) / SR; f = hz(m)
    s = sum(a * np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * tt) * np.exp(-tt * (1.4 + 0.8 * k)) for k, a in enumerate([1, 0.45, 0.2, 0.1, 0.05], 1))
    poser('piano', s * np.minimum(1, tt / 0.005) * np.exp(-tt * 0.4), t, pan, vol)

def lead(m, t, d, vol=0.06):
    n = int((d + 0.6) * SR); tt = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * tt) * np.minimum(1, tt / 0.8)
    ph = np.cumsum(hz(m) * vib) / SR
    s = (2 * (ph % 1) - 1) + 0.6 * (2 * ((ph * 1.0035) % 1) - 1)
    s = filtre(s, 1400) * enveloppe(n, 0.35, 0.6)
    poser('lead', s, t, vol=vol)

def montee(t_fin, d, vol=0.22):
    n = int(d * SR); tt = np.arange(n) / SR; x = tt / d
    bruit = rng.normal(0, 1, n)
    s = np.zeros(n)
    for k in range(8):                                                   # bruit filtré qui monte, par tranches
        a, b = k * n // 8, (k + 1) * n // 8
        fc = 250 * (2 ** (k * 0.6))
        s[a:b] = filtre(bruit[max(0, a - 2000):b], [fc, fc * 2.2], 'band')[-(b - a):]
    s += 0.3 * np.sin(2 * np.pi * np.cumsum(120 + 900 * x ** 2) / SR)
    poser('effets', s * x ** 2.2, t_fin - d, vol=vol)

def impact(t, vol=0.9):
    n = int(3.5 * SR); tt = np.arange(n) / SR
    f = 30 + 45 * np.exp(-tt / 0.15)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.9)
    s += 0.5 * filtre(rng.normal(0, 1, n), 1800) * np.exp(-tt / 0.12)
    poser('effets', s, t, vol=vol)

def coeur(t, vol=0.4):
    for dt, v in ((0, 1.0), (0.24, 0.65)):
        n = int(0.4 * SR); tt = np.arange(n) / SR
        poser('ambiance', np.sin(2 * np.pi * 52 * tt) * np.exp(-tt / 0.09) * np.minimum(1, tt / 0.01), t + dt, vol=vol * v)

# ---------------------------------------------------------------- harmonie
ACC = [  # (basse, accord de la nappe, notes des cordes piquées)
    (38, [62, 65, 69, 74], [62, 65, 69, 65]),          # Ré m
    (34, [58, 62, 65, 70], [58, 62, 65, 62]),          # Si♭
    (31, [55, 58, 62, 67], [55, 58, 62, 58]),          # Sol m
    (33, [57, 61, 64, 69], [57, 61, 64, 61]),          # La
]
MELODIE = [(69, 2), (72, 2), (70, 4), (67, 2), (69, 2), (68, 2), (69, 2)]   # par cycle de 16 s (en mesures)

def accord_a(t, origine):
    return ACC[int((t - origine + 1e-6) // (2 * MES)) % 4]

def section(a, b, origine, kick='4', clap=True, hats='16', cordes=True, peaux=False, mel=False, basse_vol=0.33, nappe_vol=0.12, nappe_oct=0):
    t = a
    while t < b - 1e-6:                                                  # par mesure
        bas, acc, arp = accord_a(t, origine)
        idx = round((t - origine) / MES)
        if nappe_vol > 0 and (idx % 2 == 0 or abs(t - a) < 1e-6):
            fin = origine + (idx // 2 + 1) * 2 * MES
            nappe([m + nappe_oct for m in acc], t, min(fin, b) - t + 0.3, vol=nappe_vol)
        for k in range(4):
            tb = t + k * B
            if tb >= b: break
            if kick == '4' or (kick == '2' and k in (0, 2)): grosse_caisse(tb)
            if clap and k in (1, 3) and kick == '4': claquement(tb)
            if clap and kick == '2' and k == 2: claquement(tb, 0.4)
            for c in range(2): basse(bas, tb + c * B / 2, vol=basse_vol * (1.0 if c == 0 else 0.7))
            if hats == '16':
                for c in range(4): charleston(tb + c * B / 4, 0.05 if c % 2 == 0 else 0.03, ouvert=(c == 2 and k == 3))
            elif hats == '8':
                for c in range(2): charleston(tb + c * B / 2, 0.04)
            if cordes:
                for c in range(4): corde_piquee(arp[c] + 12, tb + c * B / 4, 0.06 if c == 0 else 0.04, pan=(-0.35, 0.35)[c % 2])
            if peaux and k == 0: tambour_grave(tb, 0.5)
            if peaux and k == 2 and peaux == 'plein': tambour_grave(tb, 0.35, 110)
        t += MES
    if mel:
        t = a; j = 0
        while t < b - 1e-6:
            m, mes = MELODIE[j % len(MELODIE)]
            lead(m, t, min(mes * MES, b - t) - 0.1); t += mes * MES; j += 1

# ---------------------------------------------------------------- partition
# Acte I : l'éveil
n = int(30 * SR); tt = np.arange(n) / SR
vent = filtre(rng.normal(0, 1, (n, 2)), [120, 700], 'band') * (0.5 + 0.5 * np.sin(2 * np.pi * tt / 7.0))[:, None]
drone = (np.sin(2 * np.pi * hz(26) * tt) + 0.5 * np.sin(2 * np.pi * hz(33) * tt) + 0.25 * np.sin(2 * np.pi * hz(38) * tt * 1.001))
monte = np.clip(tt / 6, 0, 1) * (1 - 0.4 * np.clip((tt - 21) / 1, 0, 1)) * np.clip((30 - tt) / 0.4, 0, 1)
poser('ambiance', (vent * 0.06 + drone[:, None] * 0.09) * monte[:, None], 0)
for k, t in enumerate(np.arange(6.0, 20.5, 2.0)): coeur(t, 0.15 + 0.02 * k)
for t, m in ((4.0, 74), (9.6, 69), (13.0, 77), (16.4, 72)): piano(m, t, 0.07, pan=rng.uniform(-0.4, 0.4))
montee(21.0, 4.0, 0.2)
impact(21.0, 0.9)
nappe([50, 57, 62, 65], 21.0, 9.0, vol=0.10, a=2.0, r=1.0)
for t, m in ((22.2, 74), (24.0, 69), (25.6, 77), (27.0, 76), (28.0, 74)): piano(m, t, 0.10, pan=rng.uniform(-0.4, 0.4))
for t in (23.0, 25.0, 27.0): coeur(t, 0.22)
montee(30.0, 3.0, 0.26)

# Acte II
impact(30.0, 0.85)
section(30.0, 44.0, 30.0, kick='2', clap=False, hats=None, cordes=False, basse_vol=0.28, nappe_vol=0.10)
section(44.0, 58.0, 30.0, kick='2', clap=True, hats='8', cordes=True, basse_vol=0.30, nappe_vol=0.11)
montee(58.0, 2.0, 0.18)
impact(58.0, 0.55)
section(58.0, 100.0, 30.0, kick='4', clap=True, hats='16', cordes=True)
impact(100.0, 0.6)
section(100.0, 126.0, 30.0, kick='4', clap=True, hats='16', cordes=True, peaux=True, mel=True, nappe_vol=0.13)
# respiration
nappe([62, 65, 69, 74], 126.0, 4.0, vol=0.12, a=0.3, r=0.6)
for t, m in ((126.0, 74), (127.0, 69), (128.0, 77), (129.0, 76)): piano(m, t, 0.13)
montee(130.0, 3.0, 0.24)
impact(130.0, 0.85)
section(130.0, 160.0, 30.0, kick='4', clap=True, hats='16', cordes=True, peaux='plein', mel=True, nappe_vol=0.14)
# roulement final avant le silence
for k in range(24):
    t = 160.0 + k * (2.75 / 24) ** 1.0
    claquement(t, 0.12 + 0.2 * k / 24);
    if k % 3 == 0: tambour_grave(t, 0.25 + 0.3 * k / 24, 100)
section(160.0, 162.75, 30.0, kick='4', clap=False, hats='16', cordes=True, nappe_vol=0.0)
montee(162.75, 2.6, 0.3)

# Acte III : le final, à demi-temps, cordes larges
impact(163.0, 1.0)
section(163.0, 177.0, 163.0, kick='2', clap=True, hats='8', cordes=True, peaux='plein', mel=True, nappe_vol=0.17, nappe_oct=12)
nappe([50, 57, 62, 65, 69], 163.0, 14.0, vol=0.08, a=0.8, r=1.0)
nappe([62, 65, 69, 74], 177.0, 4.0, vol=0.13, a=0.2, r=1.2)
for t, m in ((177.0, 74), (178.0, 77), (179.0, 76), (180.0, 73)): piano(m, t, 0.13)
montee(181.0, 2.0, 0.18)
# Signature : accord de Ré majeur, logo, extinction
impact(181.0, 0.9)
nappe([50, 54, 57, 62, 66, 69], 181.0, 16.2, vol=0.13, a=1.5, r=1.6)
for t, m in ((181.4, 74), (183.0, 78), (184.6, 81), (186.5, 78), (188.5, 74), (191.0, 69), (193.0, 74), (196.0, 62)): piano(m, t, 0.11, d=4.0, pan=rng.uniform(-0.3, 0.3))
impact(195.9, 0.45)

# ---------------------------------------------------------------- effets ElevenLabs
def son(nom):
    brut = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', os.path.join(ICI, '..', 'sons', nom), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'])
    return np.frombuffer(brut, np.float32).reshape(-1, 2)
ev = json.load(open(os.path.join(ICI, 'sortie', 'evenements.json')))
for e in ev:
    if e['son'] == 'impact': poser('effets', son('a-impact.mp3'), e['t'] - 0.05, vol=0.45)
    elif e['son'] == 'whoosh': poser('effets', son('whoosh.mp3'), e['t'] - 0.3, vol=0.5)
    elif e['son'] == 'souffle': poser('effets', son('a-souffle-doux.mp3'), e['t'] - 0.4, vol=0.5)
for t in (21.0, 181.0):
    poser('effets', son('a-grave.mp3'), t, vol=0.55)
    poser('effets', son('a-revelation.mp3'), t + 0.7, vol=0.5)
    poser('effets', son('shine.mp3'), t + (3.4 if t < 100 else 2.3), vol=0.35)      # reflet de lumière sur le logo

# ---------------------------------------------------------------- mixage
def reverb(x, duree=2.6, mouille=0.35):
    n = int(duree * SR); tt = np.arange(n) / SR
    ir = rng.normal(0, 1, (n, 2)) * np.exp(-tt / (duree / 6.9))[:, None]
    ir = filtre(ir, 5000); ir[: int(0.012 * SR)] *= 0
    ir /= np.sqrt((ir ** 2).sum(0))
    w = np.stack([oaconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x + mouille * w

# pompe : la nappe et la basse s'effacent légèrement sous la grosse caisse
k = np.abs(pistes['batterie'][:, 0]); env = filtre(k, 8.0) * 6
pompe = (1 - np.clip(env, 0, 0.45))[:, None]
mix = (reverb(pistes['nappe'], 3.2, 0.5) * pompe + pistes['basse'] * pompe + reverb(pistes['cordes'], 1.8, 0.3)
       + reverb(pistes['batterie'], 1.4, 0.18) + reverb(pistes['peaux'], 2.4, 0.45) + reverb(pistes['piano'], 3.0, 0.55)
       + reverb(pistes['lead'], 2.6, 0.5) + reverb(pistes['ambiance'], 2.0, 0.3) + reverb(pistes['effets'], 3.0, 0.4))
mix = filtre(mix, 28, 'high')
# fin : extinction douce
tt = np.arange(N) / SR
mix *= np.clip((DUREE - tt) / 1.6, 0, 1)[:, None]
mix = np.tanh(mix * 1.2) / 1.2
mix /= np.abs(mix).max() / 0.89
sortie = os.path.join(ICI, 'sortie', 'musique.wav')
import wave
with wave.open(sortie, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('musique :', sortie)
