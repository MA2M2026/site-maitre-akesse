# Découpage du film « Répétitions du défilé » (brief de la propriétaire, 16/11/2026) : 3 min 18 s, vertical 1080 × 1920.
# Chaque plan : rush (WAxxxx), t = instant du rush au début du plan, d = durée à l'écran (s),
# v = vitesse (0.5 = ralenti ×2 ; (a, b) = vitesse qui glisse de a à b), cam = ((zoom, cx, cy) début, (zoom, cx, cy) fin)
# (zoom 1 = image entière ; cx, cy = centre visé, de 0 à 1 dans l'image du rush), expo = lumière (1 = normale),
# tr = transition d'entrée : 'cut', ('noir', durée), ('fondu', durée), 'flash', ('balaye', 'g'|'d'|'h'|'b').
# Les cartes (titres, logo, coordonnées) sont dessinées par monter.py : ('carte', nom, début, durée).

ACTE1, ACTE2, ACTE3 = 30.0, 163.0, 181.0
DUREE = 198.0

PLANS = [
    # ---------- ACTE I — L'ÉVEIL (0 → 30 s) : fragments sombres, puis le logo ----------
    dict(r='WA0048', t=3.0, d=3.6, v=0.5, cam=((2.3, 0.50, 0.74), (2.0, 0.50, 0.70)), expo=0.34, tr=('noir', 2.4), debut=3.0),
    dict(r='WA0061', t=16.4, d=3.0, v=0.5, cam=((1.7, 0.50, 0.56), (1.95, 0.50, 0.58)), expo=0.40, tr=('noir', 0.8)),
    dict(r='WA0053', t=10.6, d=3.4, v=0.5, cam=((3.0, 0.68, 0.26), (2.6, 0.66, 0.27)), expo=0.42, tr=('noir', 0.8)),
    dict(r='WA0059', t=14.2, d=2.6, v=0.5, cam=((2.4, 0.42, 0.47), (2.6, 0.44, 0.45)), expo=0.45, tr=('noir', 0.6)),
    dict(r='WA0050', t=9.2, d=2.6, v=0.5, cam=((2.2, 0.50, 0.30), (2.5, 0.50, 0.28)), expo=0.48, tr=('noir', 0.6)),
    dict(r='WA0056', t=9.0, d=2.8, v=0.6, cam=((1.35, 0.50, 0.55), (1.5, 0.50, 0.52)), expo=0.55, tr=('fondu', 0.6), sortie_noir=1.2),
    ('carte', 'ouverture', 21.0, 9.0),

    # ---------- ACTE II — LE TRAVAIL, LE MOUVEMENT ET L'ÉLÉGANCE (30 → 163 s) ----------
    # Séquence A — la préparation
    dict(r='WA0063', t=1.0, d=6.0, v=1.0, cam=((1.25, 0.50, 0.56), (1.6, 0.50, 0.56)), expo=0.85, tr='flash'),
    dict(r='WA0063', t=21.0, d=4.0, v=1.0, cam=((2.0, 0.26, 0.60), (2.0, 0.42, 0.60)), expo=0.85, tr=('balaye', 'd')),
    dict(r='WA0055', t=16.2, d=2.0, v=1.0, cam=((1.1, 0.5, 0.5), (1.15, 0.5, 0.5)), expo=0.85, tr='cut'),
    dict(r='WA0049', t=1.0, d=5.0, v=1.0, cam=((2.1, 0.50, 0.48), (1.6, 0.50, 0.50)), expo=0.9, tr='cut'),
    dict(r='WA0047', t=1.5, d=5.5, v=1.0, cam=((1.9, 0.50, 0.50), (1.3, 0.50, 0.53)), expo=0.9, tr=('fondu', 0.5)),
    dict(r='WA0052', t=6.0, d=5.5, v=0.75, cam=((2.5, 0.50, 0.80), (1.6, 0.50, 0.46)), expo=0.9, tr=('balaye', 'h')),
    # Séquence B — la marche
    dict(r='WA0053', t=7.5, d=4.0, v=(1.0, 0.5), cam=((1.6, 0.50, 0.45), (1.9, 0.52, 0.36)), expo=0.95, tr='flash'),
    dict(r='WA0057', t=9.5, d=4.0, v=1.0, cam=((1.5, 0.50, 0.48), (1.6, 0.50, 0.34)), expo=0.95, tr='cut'),
    dict(r='WA0059', t=10.5, d=4.0, v=0.8, cam=((1.5, 0.50, 0.50), (1.6, 0.48, 0.34)), expo=0.95, tr=('balaye', 'g')),
    dict(r='WA0061', t=10.5, d=4.0, v=0.8, cam=((1.5, 0.50, 0.50), (1.6, 0.50, 0.34)), expo=0.95, tr='cut'),
    dict(r='WA0051', t=6.5, d=4.0, v=1.0, cam=((1.5, 0.50, 0.50), (1.6, 0.50, 0.35)), expo=0.95, tr='cut'),
    dict(r='WA0055', t=8.0, d=4.0, v=0.8, cam=((1.5, 0.50, 0.50), (1.6, 0.50, 0.34)), expo=0.95, tr=('fondu', 0.4)),
    dict(r='WA0047', t=172.0, d=4.0, v=0.8, cam=((1.5, 0.50, 0.50), (1.6, 0.50, 0.34)), expo=0.95, tr='cut'),
    dict(r='WA0047', t=63.5, d=4.0, v=0.8, cam=((1.5, 0.50, 0.50), (1.6, 0.50, 0.34)), expo=0.95, tr=('balaye', 'd')),
    dict(r='WA0050', t=6.0, d=4.0, v=1.0, cam=((1.5, 0.50, 0.50), (1.6, 0.50, 0.34)), expo=0.95, tr='cut'),
    dict(r='WA0052', t=8.5, d=2.0, v=0.7, cam=((2.6, 0.50, 0.80), (2.6, 0.50, 0.76)), expo=0.95, tr='cut'),
    dict(r='WA0048', t=3.5, d=4.0, v=0.9, cam=((1.5, 0.50, 0.50), (1.6, 0.50, 0.34)), expo=0.95, tr='cut'),
    # Séquence C — la maîtrise
    dict(r='WA0056', t=8.0, d=5.0, v=1.0, cam=((1.3, 0.50, 0.55), (1.5, 0.50, 0.50)), expo=0.95, tr='flash'),
    dict(r='WA0054', t=6.0, d=4.0, v=1.0, cam=((1.3, 0.50, 0.55), (1.5, 0.50, 0.50)), expo=0.95, tr='cut'),
    dict(r='WA0061', t=15.5, d=4.0, v=0.6, cam=((1.5, 0.50, 0.50), (1.3, 0.50, 0.55)), expo=0.95, tr=('balaye', 'g')),
    dict(r='WA0058', t=8.5, d=4.0, v=1.0, cam=((1.3, 0.50, 0.55), (1.5, 0.50, 0.50)), expo=0.95, tr='cut'),
    dict(r='WA0060', t=11.0, d=4.0, v=1.0, cam=((1.3, 0.50, 0.55), (1.6, 0.50, 0.45)), expo=0.95, tr='cut'),
    dict(r='WA0047', t=19.0, d=5.0, v=1.0, cam=((1.4, 0.50, 0.55), (1.6, 0.50, 0.52)), expo=0.95, tr=('fondu', 0.5), sortie_noir=0.8),
    dict(r='WA0063', t=8.0, d=4.0, v=0.5, cam=((1.3, 0.50, 0.56), (1.5, 0.50, 0.56)), expo=0.55, tr=('noir', 0.8)),
    # Séquence D — l'énergie collective
    dict(r='WA0063', t=24.0, d=3.0, v=1.6, cam=((1.5, 0.50, 0.58), (1.25, 0.50, 0.56)), expo=0.95, tr='flash'),
    dict(r='WA0062', t=18.5, d=3.0, v=1.0, cam=((1.6, 0.50, 0.48), (1.9, 0.50, 0.38)), expo=0.95, tr='cut'),
    dict(r='WA0047', t=150.0, d=3.0, v=1.0, cam=((1.4, 0.50, 0.55), (1.6, 0.50, 0.50)), expo=0.95, tr='cut'),
    dict(r='WA0047', t=88.5, d=3.0, v=1.0, cam=((1.5, 0.50, 0.48), (1.6, 0.50, 0.34)), expo=0.95, tr=('balaye', 'd')),
    dict(r='WA0047', t=125.0, d=3.0, v=1.0, cam=((1.5, 0.50, 0.50), (1.6, 0.50, 0.35)), expo=0.95, tr='cut'),
    dict(r='WA0047', t=118.5, d=3.0, v=1.0, cam=((1.5, 0.50, 0.48), (1.6, 0.50, 0.36)), expo=0.95, tr='cut'),
    dict(r='WA0047', t=43.5, d=3.0, v=1.0, cam=((1.5, 0.50, 0.50), (1.6, 0.50, 0.35)), expo=0.95, tr='cut'),
    dict(r='WA0064', t=15.0, d=3.0, v=1.2, cam=((1.6, 0.50, 0.55), (1.6, 0.50, 0.45)), expo=0.95, tr=('balaye', 'h')),
    dict(r='WA0047', t=142.5, d=3.0, v=1.0, cam=((1.5, 0.50, 0.50), (1.6, 0.50, 0.35)), expo=0.95, tr='cut'),
    dict(r='WA0047', t=96.5, d=3.0, v=1.0, cam=((1.5, 0.50, 0.48), (1.6, 0.50, 0.36)), expo=0.95, tr=('balaye', 'g')),
    dict(r='WA0047', t=136.0, d=3.0, v=1.0, cam=((1.4, 0.50, 0.50), (1.2, 0.50, 0.50)), expo=0.95, tr='cut'),

    # ---------- ACTE III — LA SIGNATURE (163 → 198 s) ----------
    dict(r='WA0064', t=18.5, d=4.5, v=0.45, cam=((1.5, 0.50, 0.40), (1.85, 0.50, 0.33)), expo=0.95, tr='flash'),
    dict(r='WA0060', t=13.5, d=3.5, v=0.45, cam=((1.5, 0.50, 0.40), (1.8, 0.50, 0.33)), expo=0.95, tr=('fondu', 0.6)),
    dict(r='WA0047', t=173.5, d=3.5, v=0.45, cam=((1.5, 0.50, 0.40), (1.8, 0.50, 0.33)), expo=0.95, tr=('fondu', 0.6)),
    dict(r='WA0061', t=13.5, d=3.0, v=0.45, cam=((1.6, 0.50, 0.40), (1.8, 0.50, 0.36)), expo=0.95, tr=('fondu', 0.6)),
    dict(r='WA0047', t=19.0, d=3.5, v=0.7, cam=((1.6, 0.50, 0.52), (1.0, 0.50, 0.50)), expo=0.9, tr=('fondu', 0.6), sortie_noir=1.4),
    ('carte', 'signature', 181.0, 17.0),
]
