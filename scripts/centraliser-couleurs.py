#!/usr/bin/env python3
# Chantier A du cahier « Architecture » : centralise les couleurs écrites en dur dans les feuilles
# de style. Chaque couleur (#abc, #aabbcc, rgb(), rgba()) trouvée dans une VALEUR de déclaration est
# remplacée par une variable ; la variable est définie UNE fois dans css/jetons.css, avec EXACTEMENT
# la même valeur : le rendu ne change donc pas d'un pixel.
# Ne touche ni aux commentaires, ni aux sélecteurs (#identifiant), ni aux adresses url(…).
# Rejouable : une couleur déjà remplacée n'est plus trouvée.
#   python3 scripts/centraliser-couleurs.py          (écrit les fichiers)
#   python3 scripts/centraliser-couleurs.py --essai   (affiche seulement ce qui serait fait)
import glob, re, sys

ESSAI = '--essai' in sys.argv
COULEUR = re.compile(r'#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\([^)]*\)')
DECLARATION = re.compile(r'(?P<debut>(?:^|[;{}\s])(?:--[\w-]+|[a-zA-Z-]+)\s*:\s*)(?P<valeur>[^;{}]+)(?P<fin>(?=[;}]))')
PARTIES_A_GARDER = re.compile(r'url\([^)]*\)|"[^"]*"|\'[^\']*\'')


def nom(couleur):
    c = couleur.strip().lower()
    if c.startswith('#'):
        return '--c-' + c[1:]
    nombres = re.findall(r'[\d.]+', c)
    base = 'rgba' if c.startswith('rgba') else 'rgb'
    return '--c-' + base + '-' + '-'.join(n.replace('.', '_') for n in nombres)


def valeur_canonique(couleur):
    c = couleur.strip()
    if c.startswith('#'):
        return c.lower()
    return re.sub(r'\s+', '', c.lower()).replace(',', ', ')


trouvees = {}
total = 0


def remplacer_valeur(valeur):
    global total
    morceaux, dernier = [], 0
    for garde in PARTIES_A_GARDER.finditer(valeur):
        morceaux.append((False, valeur[dernier:garde.start()]))
        morceaux.append((True, garde.group(0)))
        dernier = garde.end()
    morceaux.append((False, valeur[dernier:]))
    sortie = []
    for protege, texte in morceaux:
        if protege:
            sortie.append(texte)
            continue

        def sub(m):
            global total
            c = m.group(0)
            n = nom(c)
            trouvees.setdefault(n, valeur_canonique(c))
            total += 1
            return 'var(' + n + ')'
        sortie.append(COULEUR.sub(sub, texte))
    return ''.join(sortie)


def traiter(texte):
    # on isole les commentaires pour ne pas les modifier
    morceaux = re.split(r'(/\*.*?\*/)', texte, flags=re.S)
    for i, m in enumerate(morceaux):
        if i % 2 == 1:
            continue
        morceaux[i] = DECLARATION.sub(lambda d: d.group('debut') + remplacer_valeur(d.group('valeur')), m)
    return ''.join(morceaux)


for f in sorted(glob.glob('css/*.css')):
    if f.endswith('jetons.css'):
        continue
    avant = open(f, encoding='utf-8').read()
    apres = traiter(avant)
    if apres != avant and not ESSAI:
        open(f, 'w', encoding='utf-8').write(apres)

print(total, 'couleurs remplacées,', len(trouvees), 'variables distinctes', '(essai)' if ESSAI else '')
if not ESSAI and trouvees:
    jetons = open('css/jetons.css', encoding='utf-8').read()
    marque_debut = '/* ===== Palette centralisée (chantier A) — générée par scripts/centraliser-couleurs.py ===== */'
    marque_fin = '/* ===== Fin de la palette centralisée ===== */'
    existantes = {}
    if marque_debut in jetons:
        bloc = jetons.split(marque_debut)[1].split(marque_fin)[0]
        existantes = dict(re.findall(r'(--c-[\w-]+):\s*([^;]+);', bloc))
        jetons = jetons.split(marque_debut)[0].rstrip() + '\n' + (jetons.split(marque_fin)[1] if marque_fin in jetons else '')
    existantes.update(trouvees)
    lignes = [marque_debut,
              '/* Valeurs identiques à celles qui étaient écrites en dur dans les feuilles : à regrouper et nommer',
              '   par usage au fil du temps ; changer une valeur ici la change partout. */',
              ':root {']
    for n in sorted(existantes):
        lignes.append('  ' + n + ': ' + existantes[n] + ';')
    lignes.append('}')
    lignes.append(marque_fin)
    open('css/jetons.css', 'w', encoding='utf-8').write(jetons.rstrip() + '\n\n' + '\n'.join(lignes) + '\n')
