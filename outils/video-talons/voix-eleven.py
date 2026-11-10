#!/usr/bin/env python3
"""Voix naturelle de la vidéo « Atelier Talons & Élégance » (10/11/2026) : ElevenLabs, voix « Charlotte », modèle
« eleven_v3 » (le plus humain, choix de la propriétaire après écoute). Le texte est lu PAR PARAGRAPHES, d'un trait,
comme une vraie voix off ; ElevenLabs renvoie l'instant de chaque lettre (with-timestamps), d'où l'instant de chaque
phrase et de chaque mot : les animations du film apparaissent pile quand la voix les dit.
Prononciation guidée dans voix-talons.json : « Akessé », « Faïa », « céfa » (CFA en un seul mot).

  python3 voix-eleven.py <dossier de sortie> [--refaire 0,2]
  (--refaire : seulement ces paragraphes, numérotés à partir de 0 ; les autres sont repris tels qu'enregistrés,
   avec leurs instants, depuis <sortie>/p<n>.mp3 et <sortie>/p<n>.json)
→ <sortie>/voix.wav (toute la voix, paragraphes séparés par une respiration) et <sortie>/mots.json :
  { "phrases": { clé: [début, fin] }, "mots": { clé: [[mot, début, fin], …] }, "duree": secondes }

La clé ElevenLabs n'est jamais dans ce fichier : le proxy de la session l'ajoute aux appels vers api.elevenlabs.io
(secret réseau de l'environnement) ; en dehors, mettre la clé dans la variable ELEVENLABS_API_KEY."""
import base64, json, os, re, subprocess, sys, urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
VOIX = 'XB0fDUnXU5powFXDhCwa'  # Charlotte
REGLAGES = {'stability': 0.5, 'similarity_boost': 0.8, 'style': 0.0, 'use_speaker_boost': True, 'speed': 1.0}
CLE = os.environ.get('ELEVENLABS_API_KEY', 'proxy-injected')
# paragraphes (clés de voix-talons.json lues d'un trait) et respiration après chacun (secondes)
PARAGRAPHES = [(['intro'], 1.0), (['questions', 'endroit', 'demarche', 'p1', 'p2', 'p3', 'p4', 'confiance'], 1.1),
               (['niveau', 'groupe', 'prive', 'domicile', 'nombre'], 1.1), (['inscrire', 'e1', 'e2', 'e3', 'e4'], 1.1),
               (['toutes', 'but', 'agence'], 1.2), (['fin1', 'fin2'], 0.0)]
DEBUT = 1.2  # la voix commence après l'ouverture
os.makedirs(SORTIE, exist_ok=True)
textes = dict(json.load(open(os.path.join(ICI, 'voix-talons.json'), encoding='utf-8')))
phrases, mots, morceaux, t0 = {}, {}, [], DEBUT
REFAIRE = [int(x) for x in sys.argv[sys.argv.index('--refaire') + 1].split(',')] if '--refaire' in sys.argv else None
for n, (cles, pause) in enumerate(PARAGRAPHES):
    texte = ' '.join(textes[c] for c in cles)
    mp3, jsn = os.path.join(SORTIE, 'p%d.mp3' % n), os.path.join(SORTIE, 'p%d.json' % n)
    if REFAIRE is not None and n not in REFAIRE and os.path.exists(mp3) and os.path.exists(jsn):
        a = json.load(open(jsn))   # paragraphe validé : repris tel quel
    else:
        corps = {'text': texte, 'model_id': 'eleven_v3', 'language_code': 'fr', 'voice_settings': REGLAGES}
        req = urllib.request.Request('https://api.elevenlabs.io/v1/text-to-speech/' + VOIX + '/with-timestamps?output_format=mp3_44100_128',
                                     data=json.dumps(corps).encode(), headers={'xi-api-key': CLE, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=300) as r:
            d = json.load(r)
        open(mp3, 'wb').write(base64.b64decode(d['audio_base64']))
        a = d.get('normalized_alignment') if d.get('alignment') is None else d['alignment']
        json.dump(a, open(jsn, 'w'), ensure_ascii=False)
    car, deb, fin = a['characters'], a['character_start_times_seconds'], a['character_end_times_seconds']
    lu = ''.join(car)
    duree = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]))
    # chaque phrase : retrouvée dans le texte lu (indices de lettres) → instants
    pos = 0
    for c in cles:
        i = lu.find(textes[c], pos)
        if i < 0: sys.exit('phrase introuvable dans la lecture : ' + c)
        j = i + len(textes[c]) - 1
        phrases[c] = [round(t0 + deb[i], 3), round(t0 + fin[j], 3)]
        mots[c] = [[m.group(0), round(t0 + deb[i + m.start()], 3), round(t0 + fin[i + m.end() - 1], 3)]
                   for m in re.finditer(r"[\wÀ-ÿ'’-]+", textes[c])]
        pos = j + 1
    morceaux.append((mp3, t0))
    print('✓ paragraphe', n + 1, round(duree, 1), 's')
    t0 += duree + pause
# toute la voix, chaque paragraphe à sa place
entrees, filtres = [], []
for k, (mp3, t) in enumerate(morceaux):
    entrees += ['-i', mp3]
    filtres.append('[%d:a]aresample=48000,adelay=%d|%d,apad[a%d]' % (k, round(t * 1000), round(t * 1000), k))
filtres.append(''.join('[a%d]' % k for k in range(len(morceaux))) + 'amix=inputs=%d:normalize=0,atrim=0:%.3f[v]' % (len(morceaux), t0))
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *entrees, '-filter_complex', ';'.join(filtres), '-map', '[v]', os.path.join(SORTIE, 'voix.wav')], check=True)
json.dump({'phrases': phrases, 'mots': mots, 'duree': round(t0, 3)}, open(os.path.join(SORTIE, 'mots.json'), 'w'), ensure_ascii=False)
print('voix totale', round(t0, 1), 's')
