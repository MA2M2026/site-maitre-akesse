#!/usr/bin/env python3
"""Voix fournie par la propriétaire (10/11/2026 : « Nicolas – Narrator », créée par elle sur ElevenLabs) : on ne la
régénère pas, on retrouve l'instant de chaque mot pour caler le film dessus.
La clé ElevenLabs de la session n'a pas le droit « speech_to_text » ni « forced_alignment » : la reconnaissance est
faite ici par faster-whisper (pip install faster-whisper ; modèle « medium », hors ligne une fois téléchargé),
puis chaque mot du texte (voix-talons.json) est apparié au mot entendu ; les mots non reconnus tels quels (chiffres :
« 15h », « 30 000 »…) prennent un instant interpolé entre leurs voisins appariés.

  python3 aligner-voix.py <enregistrement .mp3/.wav> <dossier de sortie>
→ <sortie>/voix.wav (1,2 s de silence d'ouverture + l'enregistrement) et <sortie>/mots.json (même forme que
  voix-eleven.py : { "phrases": {clé: [début, fin]}, "mots": {clé: [[mot, début, fin], …]}, "duree": s })."""
import difflib, json, os, re, subprocess, sys, unicodedata, wave
import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 3: sys.exit(__doc__)
SOURCE, SORTIE = sys.argv[1], sys.argv[2]
DEBUT = 1.2  # la voix commence après l'ouverture du film
os.makedirs(SORTIE, exist_ok=True)
wav16 = os.path.join(SORTIE, 'source16.wav')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', SOURCE, '-ar', '16000', '-ac', '1', wav16], check=True)

ecoute = os.path.join(SORTIE, 'entendu.json')
if not os.path.exists(ecoute):
    from faster_whisper import WhisperModel
    w = wave.open(wav16); a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768
    segs, _ = WhisperModel('medium', device='cpu', compute_type='int8').transcribe(a, language='fr', word_timestamps=True, beam_size=5)
    json.dump([[x.word.strip(), x.start, x.end] for s in segs for x in s.words], open(ecoute, 'w'), ensure_ascii=False)
entendu = json.load(open(ecoute))

def normal(m):
    m = unicodedata.normalize('NFD', m.lower()).encode('ascii', 'ignore').decode()
    m = re.sub(r"^(?:[ldjmnstc]|qu)['’]", '', m.replace('’', "'"))
    return re.sub(r'[^a-z0-9]', '', m)

textes = json.load(open(os.path.join(ICI, 'voix-talons.json'), encoding='utf-8'))
ecrits = [(cle, m.group(0)) for cle, t in textes for m in re.finditer(r"[\wÀ-ÿ'’-]+", t)]
a = [normal(m) for _, m in ecrits]
b = [normal(m) for m, _, _ in entendu]
inst = [None] * len(a)
for bloc in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
    for k in range(bloc.size):
        inst[bloc.a + k] = (entendu[bloc.b + k][1], entendu[bloc.b + k][2])
# mots non appariés : répartis entre les voisins appariés, au prorata de leur longueur
i = 0
while i < len(a):
    if inst[i] is not None: i += 1; continue
    j = i
    while j < len(a) and inst[j] is None: j += 1
    t0 = inst[i - 1][1] if i > 0 else 0.0
    t1 = inst[j][0] if j < len(a) else entendu[-1][2]
    poids = [max(1, len(ecrits[k][1])) for k in range(i, j)]; tot, acc = sum(poids), 0
    for k in range(i, j):
        d = t0 + (t1 - t0) * acc / tot; acc += poids[k - i]
        inst[k] = (d, t0 + (t1 - t0) * acc / tot)
    i = j
apparies = sum(1 for x, y in zip(a, inst) if y is not None)
phrases, mots = {}, {}
for (cle, m), (d, f) in zip(ecrits, inst):
    mots.setdefault(cle, []).append([m, round(DEBUT + d, 3), round(DEBUT + f, 3)])
for cle, l in mots.items():
    phrases[cle] = [l[0][1], l[-1][2]]
duree = round(DEBUT + float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', SOURCE])), 3)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', SOURCE, '-af', 'aresample=48000,adelay=%d|%d' % (DEBUT * 1000, DEBUT * 1000), '-ac', '2',
                os.path.join(SORTIE, 'voix.wav')], check=True)
json.dump({'phrases': phrases, 'mots': mots, 'duree': duree}, open(os.path.join(SORTIE, 'mots.json'), 'w'), ensure_ascii=False)
exacts = sum(1 for bl in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks() for _ in range(bl.size))
print('mots du texte :', len(a), '; reconnus tels quels :', exacts, '; durée', duree, 's')
