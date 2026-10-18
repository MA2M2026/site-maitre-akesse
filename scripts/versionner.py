#!/usr/bin/env python3
"""Numéro de version des scripts et styles du site (14/10/2026, rapidité).

Chaque page HTML appelle ses fichiers js/ et css/ avec ?v=<empreinte du fichier>
(8 caractères). vercel.json garde ces fichiers UN AN dans le navigateur quand l'adresse
porte ?v= : le visiteur ne les redemande plus à chaque page (avant : une question au
serveur par fichier et par page, très lent depuis Abidjan). Quand un fichier change,
son empreinte change, donc son adresse aussi : le navigateur prend tout de suite la
nouvelle version.

  python3 scripts/versionner.py            met à jour les ?v= de toutes les pages
  python3 scripts/versionner.py --verifier signale les pages à mettre à jour (tests)

À lancer après TOUTE modification d'un fichier js/ ou css/ (comme verifier-csp.py).
Les fichiers chargés par un script (jsPDF, QR, outil vidéo) ne sont pas concernés :
ils restent revérifiés à chaque fois (pas de ?v=).
"""
import hashlib, os, re, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCLUS = {'node_modules', 'scripts', 'outils', '.git'}
REF = re.compile(r'((?:src|href)=")((?:\.\./)*|/)((?:js|css)/[^"?#]+\.(?:js|css))(\?v=[0-9a-f]*)?(")')


def empreinte(chemin, memo={}):
    if chemin not in memo:
        with open(chemin, 'rb') as f:
            memo[chemin] = hashlib.sha1(f.read()).hexdigest()[:8]
    return memo[chemin]


def pages():
    for dossier, sous, fichiers in os.walk(RACINE):
        sous[:] = [d for d in sous if d not in EXCLUS]
        for f in fichiers:
            if f.endswith('.html'):
                yield os.path.join(dossier, f)


def traiter(page):
    with open(page, encoding='utf-8') as f:
        html = f.read()
    manquants = []

    def remplacer(m):
        debut, prefixe, chemin, _ancien, fin = m.groups()
        base = RACINE if prefixe == '/' else os.path.dirname(page)
        fichier = os.path.normpath(os.path.join(base, prefixe if prefixe != '/' else '', chemin))
        if not os.path.isfile(fichier):
            manquants.append(chemin)
            return m.group(0)
        return debut + prefixe + chemin + '?v=' + empreinte(fichier) + fin

    nouveau = REF.sub(remplacer, html)
    return html, nouveau, manquants


def main():
    verifier = '--verifier' in sys.argv
    a_jour, problemes = 0, []
    for page in sorted(pages()):
        html, nouveau, manquants = traiter(page)
        nom = os.path.relpath(page, RACINE)
        problemes += [nom + ' : fichier introuvable ' + m for m in manquants]
        if html != nouveau:
            if verifier:
                problemes.append(nom + ' : numéros de version à mettre à jour (python3 scripts/versionner.py)')
            else:
                with open(page, 'w', encoding='utf-8') as f:
                    f.write(nouveau)
                a_jour += 1
    for p in problemes:
        print('❌ ' + p)
    if verifier:
        print('❌ Versions à mettre à jour.' if problemes else '✅ Toutes les pages appellent la dernière version de leurs scripts et styles.')
    else:
        print('✅ ' + str(a_jour) + ' page(s) mise(s) à jour.')
    sys.exit(1 if problemes else 0)


if __name__ == '__main__':
    main()
