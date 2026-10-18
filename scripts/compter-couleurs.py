#!/usr/bin/env python3
# Compte, par fichier de style, les couleurs écrites en dur (#… , rgb(…), rgba(…)) et les règles
# « !important » (chantier A du cahier « Architecture »). Les couleurs ne doivent vivre que dans
# css/jetons.css. À lancer avant et après chaque lot :  python3 scripts/compter-couleurs.py
import glob, re, sys
COULEUR = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)')
total_c = total_i = 0
lignes = []
for f in sorted(glob.glob('css/*.css')):
    if f.endswith('jetons.css'):
        continue
    t = re.sub(r'/\*.*?\*/', '', open(f, encoding='utf-8').read(), flags=re.S)  # sans les commentaires
    c, i = len(COULEUR.findall(t)), t.count('!important')
    total_c += c; total_i += i
    lignes.append((c, i, f))
for c, i, f in sorted(lignes, reverse=True):
    print(f'{c:6d} couleurs en dur  {i:5d} !important   {f}')
print(f'{total_c:6d} couleurs en dur  {total_i:5d} !important   TOTAL (hors css/jetons.css)')
