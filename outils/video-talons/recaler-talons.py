#!/usr/bin/env python3
"""Vidéo « Atelier Talons & Élégance » : la PREMIÈRE vidéo du site (08/11/2026) gardée, recalée sur la voix naturelle
validée par la propriétaire (ElevenLabs v3, voix-eleven.py, 10/11/2026) et améliorée : chacune de ses 15 scènes
commence pile quand la voix aborde son sujet (instant du mot, mots.json) ; sa durée s'adapte sans ralenti visible
(ralenti limité à ×1,3, puis l'image tient avec une lente avancée de caméra) ; enchaînements en fondu doux entre les
scènes ; musique originale (musique-talons.py) en fond, plus douce sous la voix. Les deux formats (vertical et
horizontal) suivent le même découpage.

  python3 recaler-talons.py <dossier de voix-eleven.py> <musique .wav> <dossier de sortie>
→ <sortie>/atelier-talons-elegance.mp4 et atelier-talons-elegance-large.mp4"""
import json, os, subprocess, sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(os.path.dirname(ICI))
if len(sys.argv) < 4: sys.exit(__doc__)
VOIX, MUSIQUE, SORTIE = sys.argv[1:4]
os.makedirs(SORTIE, exist_ok=True)
M = json.load(open(os.path.join(VOIX, 'mots.json'), encoding='utf-8'))
P = M['phrases']
def mot(cle, debut):
    """instant du premier mot de la phrase « cle » qui commence par « debut »"""
    for m, t, _ in M['mots'][cle]:
        if m.lower().startswith(debut.lower()): return t
    sys.exit('mot introuvable : %s / %s' % (cle, debut))
FIN = M['duree'] + 3.0  # la dernière image reste 3 s après la voix

# les 15 scènes de la vidéo d'origine (secondes, coupes mesurées) et l'instant de la voix où chacune commence
ORIGINE = [0, 3.9, 9.7, 13.033, 16.3, 20.933, 23.0, 29.133, 34.167, 36.5, 44.267, 50.567, 59.4, 70.767, 83.833, 91.7]
DEBUTS = [0.0,                       # A mur de photos « Atelier Talons & Élégance »
          mot('intro', 'Bienvenue') + 0.4,  # B logo, « Bienvenue à l'Atelier »
          mot('questions', 'concours') - 0.5,  # C « Miss · Beauté »
          mot('questions', 'élégance') - 0.4,  # D « Élégance · Prestance »
          mot('questions', 'marcher') - 0.4,   # E « Marcher en talons »
          P['endroit'][0] - 0.3,       # F « au bon endroit »
          P['demarche'][0] - 0.2,      # G posture, port de tête, équilibre, démarche (01-04)
          P['confiance'][0] - 0.3,     # H « La confiance dès le premier pas » + niveaux
          mot('niveau', 'nous') - 0.3, # I « 2 formules »
          P['groupe'][0] - 0.3,        # J En groupe 30 000
          P['prive'][0] - 0.3,         # K En privé 25 000
          P['domicile'][0] - 0.3,      # L Chez vous 30 000 – 35 000, ×3
          P['inscrire'][0] - 0.3,      # M S'inscrire (téléphone, 4 étapes, Wave)
          P['toutes'][0] - 0.3,        # N « Pas un casting », ouvert à toutes, Intégrer l'agence
          P['fin1'][0] - 0.4]          # O « Votre élégance commence ici », Je m'inscris
assert all(a < b for a, b in zip(DEBUTS, DEBUTS[1:])), DEBUTS
FONDU, RALENTI_MAX, IPS = 0.4, 1.3, 30

def fabriquer(nom, largeur, hauteur):
    source = os.path.join(RACINE, 'assets', 'cours-talons', nom + '.mp4')
    filtres, n = [], len(ORIGINE) - 1
    for i in range(n):
        a, b = ORIGINE[i], ORIGINE[i + 1]
        voulu = (DEBUTS[i + 1] if i + 1 < n else FIN) - DEBUTS[i] + (FONDU if i + 1 < n else 0)
        f = min(RALENTI_MAX, max(0.75, voulu / (b - a)))  # ralenti limité (ou léger accéléré)
        reste = max(0.0, voulu - (b - a) * f)
        k = 'v%d' % i
        # lente avancée de caméra sur toute la scène (2,5 % à 5 %, selon sa durée), image nette (agrandie puis recadrée)
        zoom = 0.025 + min(0.025, voulu * 0.002)
        filtres.append('[0:v]trim=%.3f:%.3f,setpts=(PTS-STARTPTS)*%.4f,fps=%d%s,'
                       'scale=%d:%d,zoompan=z=\'1+%.4f*on/%d\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=1:s=%dx%d:fps=%d,'
                       'trim=0:%.3f,setpts=PTS-STARTPTS,format=yuv420p[%s]'
                       % (a, b, f, IPS, (',tpad=stop_mode=clone:stop_duration=%.3f' % reste) if reste > 0 else '',
                          largeur * 2, hauteur * 2, zoom, max(1, round(voulu * IPS)), largeur, hauteur, IPS, voulu, k))
    # enchaînements en fondu : la scène i+1 arrive à DEBUTS[i+1]
    prec = 'v0'
    for i in range(1, n):
        filtres.append('[%s][v%d]xfade=transition=fade:duration=%.2f:offset=%.3f[x%d]' % (prec, i, FONDU, DEBUTS[i], i))
        prec = 'x%d' % i
    # son : la voix, et la musique plus douce pendant que la voix parle
    filtres.append('[1:a]aresample=48000,apad,atrim=0:%.3f,asplit=2[voix][cle]' % FIN)
    filtres.append('[2:a]aresample=48000,atrim=0:%.3f,volume=0.5,afade=t=in:d=2,afade=t=out:st=%.3f:d=3.5[mus]' % (FIN, FIN - 3.5))
    filtres.append('[mus][cle]sidechaincompress=threshold=0.025:ratio=5:attack=30:release=600[musd]')
    filtres.append('[voix][musd]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]')
    sortie = os.path.join(SORTIE, nom + '.mp4')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', source, '-i', os.path.join(VOIX, 'voix.wav'), '-i', MUSIQUE,
                    '-filter_complex', ';'.join(filtres), '-map', '[%s]' % prec, '-map', '[a]', '-t', '%.3f' % FIN,
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', sortie], check=True)
    print('✓', sortie, round(os.path.getsize(sortie) / 1048576, 1), 'Mo')

# ---------- format horizontal : panneau de gauche reconstruit (nouveau texte mot à mot) + vidéo verticale à droite ----------
import re
TEXTES = dict(json.load(open(os.path.join(ICI, 'voix-talons.json'), encoding='utf-8')))
ORDRE = [c for c, _ in json.load(open(os.path.join(ICI, 'voix-talons.json'), encoding='utf-8'))]
# à l'écran, écriture normale (la voix a été guidée avec une orthographe phonétique)
FUSIONS = [(['Talons', 'et', 'Élégance,'], 'Talons & Élégance,'), (['Talons', 'et', 'Élégance'], 'Talons & Élégance'), (['trente-cinq', 'mille'], '35 000'), (['vingt-cinq', 'mille'], '25 000'), (['trente', 'mille'], '30 000'),
           (['quinze', 'heures'], '15 h'), (['dix-huit', 'heures'], '18 h'), (['deux', 'heures,'], '2 heures,'), (['deux', 'heures'], '2 heures')]
ECRIT = {'céfa': 'CFA', 'céfa,': 'CFA,', 'céfa.': 'CFA.', 'Akessé,': 'Akesse', 'Akessé': 'Akesse', 'Faïa.': 'Faya.', 'Faïa': 'Faya'}
def jetons(cle):
    """mots affichés de la phrase et instant où chacun est dit"""
    mots = M['mots'][cle]; res, k = [], 0
    for j in TEXTES[cle].split():
        n = len(re.findall(r"[\wÀ-ÿ'’-]+", j))
        res.append([j, mots[k][1] if n and k < len(mots) else (res[-1][1] if res else P[cle][0])]); k += n
    i, sortie_ = 0, []
    while i < len(res):
        for motif, rempl in FUSIONS:
            if [x[0] for x in res[i:i + len(motif)]] == motif: sortie_.append([rempl, res[i][1]]); i += len(motif); break
        else: sortie_.append([ECRIT.get(res[i][0], res[i][0]), res[i][1]]); i += 1
    return sortie_
morceaux, courant = [], []
for cle in ORDRE:
    for j in jetons(cle):
        courant.append(j)
        long = len(' '.join(x[0] for x in courant))
        if re.search(r'[.?!]$', j[0]) or (long > 30 and j[0].endswith(':')) or (long > 70 and j[0].endswith(',')) or long > 118: morceaux.append(courant); courant = []
    if courant and len(' '.join(x[0] for x in courant)) > 60: morceaux.append(courant); courant = []
if courant: morceaux.append(courant)
blocs = []
for n, m in enumerate(morceaux):
    debut = m[0][1] - 0.15
    suivant = morceaux[n + 1][0][1] - 0.15 if n + 1 < len(morceaux) else FIN
    blocs.append({'debut': round(debut, 3), 'fin': round(min(suivant, m[-1][1] + 2.6), 3), 'mots': m})
CARTES = [(0.0, '✨', 'Atelier Talons &amp; Élégance', 'Ouvert à toutes'), (DEBUTS[2], '👑', 'Miss ou beauté ?', 'Préparez votre concours'),
          (DEBUTS[3], '💎', 'Élégance · Prestance', 'Gagnez en assurance'), (DEBUTS[4], '👠', 'Marcher en talons', 'Avec assurance'),
          (DEBUTS[5], '📍', 'Au bon endroit', 'Riviera Faya, Abidjan'), (DEBUTS[6], '🧍‍♀️', 'Posture · Port de tête', 'Équilibre · démarche fluide'),
          (DEBUTS[7], '🚶‍♀️', 'Dès le premier pas', 'Quel que soit votre niveau'), (DEBUTS[8], '2️⃣', 'Deux formules', 'En groupe ou en privé'),
          (DEBUTS[9], '👯‍♀️', 'En groupe', 'Chaque dimanche · 30 000 FCFA les 4 séances'), (DEBUTS[10], '🏛️', 'En privé · En salle', '25 000 FCFA la séance de 2 h'),
          (DEBUTS[11], '🏠', 'En privé · Chez vous', '30 000 – 35 000 FCFA la séance'), (DEBUTS[12], '📱', 'S’inscrire', 'Formule · photos · vidéo'),
          (P['e4'][0] - 0.3, '💳', 'Paiement Wave', 'Maintenant ou plus tard'), (DEBUTS[13], '⚠️', 'Pas un casting', 'Ouvert à toutes · pour apprendre à marcher'),
          (DEBUTS[14], '❤️', 'Votre élégance commence ici', 'Je m’inscris')]
open(os.path.join(ICI, 'timing-recale.js'), 'w', encoding='utf-8').write('// fabriqué par recaler-talons.py : cartes du panneau horizontal et texte mot à mot (secondes)\nwindow.D = ' + json.dumps(
    {'scenes': [{'debut': round(d, 3), 'icone': i, 'titre': t, 'sous': s} for d, i, t, s in CARTES], 'morceaux': blocs, 'duree': round(FIN, 3)}, ensure_ascii=False) + ';\n')
if '--apercu-panneau' in sys.argv: sys.exit(0)

fabriquer('atelier-talons-elegance', 720, 1280)
# images du panneau (Chromium), puis la vidéo verticale posée dans le cadre de droite, et le son de la verticale
PANNEAU = os.path.join(SORTIE, 'panneau'); os.makedirs(PANNEAU, exist_ok=True)
subprocess.run(['node', os.path.join(ICI, 'rendre-panneau.js'), PANNEAU, '%.3f' % FIN], check=True)
verticale = os.path.join(SORTIE, 'atelier-talons-elegance.mp4'); large = os.path.join(SORTIE, 'atelier-talons-elegance-large.mp4')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(IPS), '-i', os.path.join(PANNEAU, 'p%05d.jpg'), '-i', verticale,
                '-filter_complex', '[1:v]scale=390:694:flags=lanczos[v];[0:v][v]overlay=878:13,format=yuv420p[o]', '-map', '[o]', '-map', '1:a',
                '-t', '%.3f' % FIN, '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-c:a', 'copy', '-movflags', '+faststart', large], check=True)
print('✓', large, round(os.path.getsize(large) / 1048576, 1), 'Mo')
