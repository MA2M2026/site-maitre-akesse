#!/usr/bin/env python3
# Compare les captures du test visuel (captures/actuelles) aux captures de référence
# (captures/reference) et écrit captures/rapport.html : pour chaque capture, la part de l'image
# qui a changé, avec une image où les changements sont en rouge. Rapport NON bloquant : un
# changement voulu (nouveau texte, nouvelle photo) est normal ; il sert à repérer d'un coup
# d'œil une page déformée par erreur.
#   python3 comparer-captures.py scripts/tests-visiteur/captures
import html, os, shutil, sys
from PIL import Image, ImageChops

dossier = sys.argv[1]
ref, act, diff = (os.path.join(dossier, d) for d in ('reference', 'actuelles', 'differences'))
shutil.rmtree(diff, ignore_errors=True)  # images de la fois précédente
os.makedirs(diff)
lignes, changees = [], 0
for nom in sorted(set(os.listdir(ref)) | set(os.listdir(act))):
    a, b = os.path.join(ref, nom), os.path.join(act, nom)
    if not os.path.exists(a) or not os.path.exists(b):
        lignes.append((100.0, nom, 'nouvelle capture' if os.path.exists(b) else 'capture disparue', None))
        continue
    ia, ib = Image.open(a).convert('RGB'), Image.open(b).convert('RGB')
    largeur, hauteur = max(ia.width, ib.width), max(ia.height, ib.height)
    fa, fb = Image.new('RGB', (largeur, hauteur), 'white'), Image.new('RGB', (largeur, hauteur), 'white')
    fa.paste(ia); fb.paste(ib)
    # petits écarts de lissage des lettres ignorés (seuil 40 sur 255)
    r, g, b = ImageChops.difference(fa, fb).split()  # plus grand écart des trois couleurs
    masque = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v > 40 else 0)
    part = 100.0 * masque.histogram()[255] / (largeur * hauteur)
    if part >= 0.5:
        changees += 1
        vue = Image.blend(fb, Image.new('RGB', fb.size, 'white'), 0.6)
        vue.paste(Image.new('RGB', fb.size, (220, 0, 0)), mask=masque)
        vue.save(os.path.join(diff, nom))
    lignes.append((part, nom, 'taille changée' if ia.size != ib.size else '', nom if part >= 0.5 else None))
lignes.sort(reverse=True)
with open(os.path.join(dossier, 'rapport.html'), 'w', encoding='utf-8') as f:
    f.write('<!doctype html><meta charset="utf-8"><title>Test visuel</title><h1>Test visuel : changements par rapport à la référence</h1>'
            '<p>%d capture(s) changée(s) de plus de 0,5 %% sur %d. En rouge : ce qui a changé.</p><table border="1" cellpadding="6">' % (changees, len(lignes)))
    for part, nom, note, image in lignes:
        f.write('<tr><td>%s</td><td>%.1f %%</td><td>%s</td><td>%s</td></tr>' % (html.escape(nom), part, html.escape(note),
                '<a href="differences/%s">voir</a>' % html.escape(image) if image else ''))
    f.write('</table>')
print('ℹ️ comparaison avec la référence : %d capture(s) changée(s) sur %d (rapport : captures/rapport.html, non bloquant)' % (changees, len(lignes)))
