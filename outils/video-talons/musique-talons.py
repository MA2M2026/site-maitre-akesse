#!/usr/bin/env python3
"""Musique ORIGINALE de la vidéo « Atelier Talons & Élégance » (10/11/2026) : douce, chic, apaisante, composée ici
(aucun droit d'auteur) : piano léger en arpèges, nappe chaude, basse ronde, réverbération ample ; 66 battements par
minute, accords Fa maj7 – Mi m7 – Ré m9 – Do maj7 (couleur « mode / élégance »). Stéréo 48 kHz.

  python3 musique-talons.py <fichier .wav> [durée en secondes, 130 par défaut]"""
import sys, numpy as np, wave

SORTIE = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
DUREE = float(sys.argv[2]) if len(sys.argv) > 2 else 130.0
SR = 48000
N = int(SR * DUREE)
rng = np.random.default_rng(7)
g = np.zeros((N, 2))
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def ajoute(son, debut, pan=0.0):
    i = int(debut * SR)
    if i >= N: return
    son = son[: N - i]
    gauche, droite = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    g[i:i + len(son), 0] += son * gauche
    g[i:i + len(son), 1] += son * droite

def piano(m, duree, force):
    t = np.arange(int(SR * duree)) / SR
    f = hz(m)
    s = sum(a * np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * np.exp(-t * (1.6 + 0.9 * k)) for k, a in enumerate([1, 0.42, 0.2, 0.11, 0.06], 1))
    attaque = np.minimum(1, t / 0.006)
    return force * s * attaque * np.exp(-t * 0.35)

def nappe(ms, duree, force):
    t = np.arange(int(SR * duree)) / SR
    s = np.zeros_like(t)
    for m in ms:
        for d in (-0.07, 0.0, 0.07):  # trois voix légèrement désaccordées : douceur, ampleur
            f = hz(m) * 2 ** (d / 12)
            s += np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    env = np.minimum(1, t / 2.2) * np.minimum(1, (duree - t) / 2.2).clip(0)
    return force * s / (3 * len(ms)) * env

def basse(m, duree, force):
    t = np.arange(int(SR * duree)) / SR
    f = hz(m)
    return force * (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(4 * np.pi * f * t)) * np.minimum(1, t / 0.03) * np.exp(-t * 0.5)

TEMPS = 60 / 66
MESURE = 4 * TEMPS
# (fondamentale de basse, notes de la nappe, arpège du piano)
ACCORDS = [(41, [53, 57, 60, 64], [65, 69, 72, 76, 79, 76, 72, 69]),     # Fa maj7
           (40, [52, 55, 59, 62], [64, 67, 71, 74, 76, 74, 71, 67]),     # Mi m7
           (38, [50, 53, 57, 60, 64], [62, 65, 69, 72, 76, 72, 69, 65]), # Ré m9
           (36, [48, 52, 55, 59], [60, 64, 67, 71, 74, 71, 67, 64])]     # Do maj7
mesure, t = 0, 0.0
while t < DUREE:
    b, ns, arp = ACCORDS[mesure % 4]
    partie = mesure // 4
    ajoute(nappe(ns, MESURE + 2.0, 0.16), t, 0.0)
    if mesure >= 2: ajoute(basse(b, MESURE * 0.95, 0.20), t, 0.0)
    for k, note in enumerate(arp):  # croches, légèrement humanisées
        if partie == 0 and k % 2: continue  # début plus dépouillé
        decal = (rng.random() - 0.5) * 0.02
        ajoute(piano(note, 3.5, 0.11 * (0.85 + 0.3 * rng.random())), t + k * TEMPS / 2 + decal, -0.35 + 0.1 * k)
    if partie >= 1 and mesure % 2 == 1:  # petite mélodie aiguë, une note par mesure
        ajoute(piano(arp[4] + 12, 4.5, 0.07), t + 2 * TEMPS, 0.4)
    mesure += 1; t += MESURE

# réverbération (réponse de salle : bruit qui s'éteint en 3 s), filtrage doux des aigus
ir_t = np.arange(int(SR * 3.0)) / SR
ir = rng.standard_normal((len(ir_t), 2)) * np.exp(-ir_t * 2.3)[:, None]
noyau = np.ones(24) / 24
for c in range(2):
    ir[:, c] = np.convolve(ir[:, c], noyau, mode='same')
ir /= np.abs(ir).sum(axis=0) / 6
def convo(x, h):
    n = len(x) + len(h) - 1
    taille = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, taille) * np.fft.rfft(h, taille), taille)[:len(x)]
humide = np.stack([convo(g[:, c], ir[:, c]) for c in range(2)], axis=1)
mix = 0.72 * g + 0.45 * humide
mix = np.stack([np.convolve(mix[:, c], np.ones(6) / 6, mode='same') for c in range(2)], axis=1)
fondu = np.minimum(1, np.arange(N) / (SR * 3.0)) * np.minimum(1, (N - np.arange(N)) / (SR * 5.0))
mix *= fondu[:, None]
mix /= np.abs(mix).max() / 0.85
with wave.open(SORTIE, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('✓', SORTIE, round(DUREE, 1), 's')
