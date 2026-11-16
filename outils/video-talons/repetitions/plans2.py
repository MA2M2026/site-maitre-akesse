# Film libre « On répète » (version 2, 16/11/2026) : 1 min 24, vertical 1080 × 1920, 120 battements par minute
# (1 temps = 0,5 s, 1 mesure = 2 s). Idée : des répétitions, c'est répéter. On répète, on corrige, on recommence
# (l'image rembobine et rejoue le même pas), jusqu'à la marche juste, puis le défilé éclate en couleur.
#
# Un plan : r = rush, a = début (s), d = durée, k = correspondance temps du plan → temps du rush [(tau, s), …]
# (pente 1 = vitesse normale, 0,4 = ralenti, 0 = image figée, négative = rembobinage), cam = ((zoom, cx, cy) début,
# (zoom, cx, cy) fin), nb = noir et blanc, flash = 'rouge' | 'blanc' au début, coup = petit zoom de rythme au début.
# Les panneaux ('panneaux') posent 2 ou 3 plans côte à côte ; les textes sont des lignes posées sur les temps.

def lin(t, d, v=1.0):
    return [(0.0, t), (d, t + v * d)]

def rampe(t, d, normal, lent=0.4):
    """Vitesse normale pendant `normal` secondes, puis ralenti sur la pose."""
    return [(0.0, t), (normal, t + normal), (d, t + normal + lent * (d - normal))]

DUREE = 84.0
P = []
def plan(r, a, d, k, cam=((1.0, 0.5, 0.5), (1.12, 0.5, 0.5)), **x):
    P.append(dict(r=r, a=a, d=d, k=k, cam=cam, **x))

# ---------------- 0 → 16 s : la répétition, en noir et blanc
NB = dict(nb=True)
plan('WA0063', 0.0, 2.0, lin(1.0, 2.0), ((1.35, 0.5, 0.56), (1.6, 0.5, 0.56)), **NB)
plan('WA0047', 2.0, 1.0, lin(14.2, 1.0), ((2.3, 0.5, 0.80), (2.3, 0.5, 0.76)), coup=True, **NB)
plan('WA0063', 3.0, 1.0, lin(21.0, 1.0), ((2.0, 0.26, 0.60), (2.0, 0.36, 0.60)), coup=True, **NB)
plan('WA0063', 4.0, 2.0, lin(12.0, 2.0), ((1.9, 0.52, 0.55), (2.1, 0.52, 0.52)), coup=True, **NB)
plan('WA0055', 6.0, 1.0, lin(16.4, 1.0), ((1.1, 0.5, 0.5), (1.15, 0.5, 0.5)), **NB)
plan('WA0049', 7.0, 1.0, lin(1.5, 1.0), ((2.3, 0.5, 0.48), (2.1, 0.5, 0.48)), coup=True, **NB)
# « On recommence » : le même pas, joué, rembobiné, rejoué, de plus en plus vite
plan('WA0059', 8.0, 4.0, [(0.0, 13.2), (1.0, 14.2), (1.25, 13.2), (2.0, 13.95), (2.2, 13.2), (2.7, 13.7), (2.85, 13.2),
                           (3.15, 13.5), (3.25, 13.2), (4.0, 13.6)], ((1.6, 0.46, 0.45), (1.9, 0.44, 0.40)), rembobine=True, **NB)
plan('WA0052', 12.0, 1.0, lin(3.5, 1.0), ((2.4, 0.5, 0.52), (2.2, 0.5, 0.52)), coup=True, **NB)
plan('WA0057', 13.0, 1.0, lin(7.5, 1.0), ((1.9, 0.5, 0.50), (1.8, 0.5, 0.50)), coup=True, **NB)
plan('WA0053', 14.0, 0.5, lin(7.6, 0.5), ((1.7, 0.5, 0.48), (1.7, 0.5, 0.48)), coup=True, **NB)
plan('WA0061', 14.5, 0.5, lin(9.5, 0.5), ((1.7, 0.5, 0.48), (1.7, 0.5, 0.48)), coup=True, **NB)
plan('WA0050', 15.0, 0.25, lin(7.5, 0.25), ((1.7, 0.5, 0.45), (1.7, 0.5, 0.45)), coup=True, **NB)
plan('WA0060', 15.25, 0.25, lin(12.5, 0.25), ((1.7, 0.5, 0.45), (1.7, 0.5, 0.45)), coup=True, **NB)
# 15,5 → 16 : noir, la musique retient son souffle

# ---------------- 16 s : le défilé éclate (MA2M rempli d'images, puis on traverse les lettres)
P.append(dict(fenetre='MA2M', a=16.0, d=2.0, r='WA0047', k=lin(55.0, 2.0), cam=((1.3, 0.5, 0.55), (1.45, 0.5, 0.55)), flash='rouge', suivi=False))
P.append(dict(panneaux=[dict(r='WA0052', k=lin(6.3, 4.0), cam=((1.25, 0.5, 0.50), (1.6, 0.5, 0.42))),
                        dict(r='WA0064', k=lin(14.6, 4.0), cam=((1.25, 0.5, 0.50), (1.6, 0.5, 0.42))),
                        dict(r='WA0061', k=lin(9.0, 4.0), cam=((1.25, 0.5, 0.50), (1.6, 0.5, 0.42)))], a=18.0, d=4.0))

# ---------------- 22 → 44 s : la marche, une silhouette par mesure, ralenti sur la pose
for i, (r, t, cy) in enumerate([('WA0064', 17.4, 0.36), ('WA0057', 10.4, 0.36), ('WA0059', 12.0, 0.36), ('WA0051', 7.6, 0.38),
                                ('WA0055', 8.6, 0.36), ('WA0047', 170.8, 0.36), ('WA0050', 7.2, 0.36), ('WA0061', 11.2, 0.36),
                                ('WA0062', 19.4, 0.36), ('WA0048', 4.0, 0.36), ('WA0047', 64.0, 0.36)]):
    plan(r, 22.0 + 2 * i, 2.0, rampe(t, 2.0, 1.25), ((1.35, 0.5, 0.50), (1.7, 0.5, cy)), coup=True,
         flash='blanc' if i in (0, 6) else None)

# ---------------- 44 → 52 s : respiration, ralentis
plan('WA0061', 44.0, 3.0, lin(15.4, 3.0, 0.5), ((1.55, 0.5, 0.42), (1.35, 0.5, 0.50)))
plan('WA0053', 47.0, 3.0, lin(10.6, 3.0, 0.45), ((2.0, 0.66, 0.30), (1.7, 0.66, 0.34)), suivi=False)
plan('WA0060', 50.0, 1.0, lin(13.6, 1.0, 0.5), ((1.7, 0.5, 0.36), (1.8, 0.5, 0.34)))
for j, (r, t) in enumerate([('WA0052', 10.3), ('WA0047', 135.8), ('WA0059', 13.9), ('WA0064', 19.6)]):
    plan(r, 51.0 + 0.25 * j, 0.25, lin(t, 0.25, 0.3), ((1.8, 0.5, 0.34), (1.85, 0.5, 0.34)), coup=True)

# ---------------- 52 → 68 s : deuxième élan, à deux, à plusieurs
plan('WA0054', 52.0, 2.0, lin(6.4, 2.0), ((1.25, 0.5, 0.52), (1.5, 0.5, 0.46)), flash='rouge', coup=True, suivi=False)
plan('WA0056', 54.0, 2.0, lin(9.2, 2.0), ((1.25, 0.5, 0.52), (1.5, 0.5, 0.46)), coup=True, suivi=False)
P.append(dict(panneaux=[dict(r='WA0049', k=lin(6.0, 2.0), cam=((1.4, 0.5, 0.48), (1.7, 0.5, 0.38))),
                        dict(r='WA0050', k=lin(6.6, 2.0), cam=((1.4, 0.5, 0.48), (1.7, 0.5, 0.38)))], a=56.0, d=2.0))
P.append(dict(panneaux=[dict(r='WA0052', k=lin(7.4, 2.0), cam=((1.4, 0.5, 0.48), (1.7, 0.5, 0.38))),
                        dict(r='WA0064', k=lin(17.6, 2.0), cam=((1.4, 0.5, 0.48), (1.7, 0.5, 0.38)))], a=58.0, d=2.0))
plan('WA0058', 60.0, 2.0, lin(8.6, 2.0), ((1.3, 0.5, 0.52), (1.55, 0.5, 0.46)), coup=True, suivi=False)
plan('WA0047', 62.0, 2.0, lin(19.2, 2.0), ((1.35, 0.5, 0.52), (1.6, 0.5, 0.48)), coup=True, suivi=False)
# poses figées, une par temps
for j, (r, t, cy) in enumerate([('WA0053', 11.0, 0.32), ('WA0059', 14.6, 0.34), ('WA0047', 66.6, 0.34), ('WA0064', 20.6, 0.32),
                                ('WA0060', 15.4, 0.34), ('WA0047', 173.6, 0.34), ('WA0061', 13.4, 0.32), ('WA0055', 10.6, 0.32)]):
    plan(r, 64.0 + 0.5 * j, 0.5, [(0.0, t), (0.5, t + 0.04)], ((1.75, 0.5, cy), (1.85, 0.5, cy)), flash='blanc', coup=True)

# ---------------- 68 → 72 s : la dernière pose, au ralenti, qui s'éteint
plan('WA0064', 68.0, 4.0, lin(18.9, 4.0, 0.4), ((1.9, 0.5, 0.32), (1.25, 0.5, 0.45)), noir_fin=1.2)

# ---------------- 72 → 84 s : signature
FIN = 72.0

# Textes posés sur les temps : (début, fin, [lignes]) — lignes alignées à gauche, en bas de l'image
TEXTES = [
    (0.5, 3.75, ['On répète.']),
    (4.0, 7.75, ['On corrige.']),
    (8.0, 11.75, ['On', 'recommence.']),
    (12.0, 15.5, ['Jusqu’à la', 'marche', 'juste.']),
]
