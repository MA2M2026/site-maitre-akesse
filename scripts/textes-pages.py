#!/usr/bin/env python3
"""Textes des pages modifiables depuis l'Administration (étape C du site dynamique, 01/11/2026).

Chaque texte simple des 5 pages (titres, paragraphes, éléments de liste) porte un repère
data-texte="page-N", le même sur la page française et sur la page anglaise. Le serveur
(middleware.js, poserTextes) remplace le texte d'un repère par celui enregistré dans
Administration › Textes des pages ; sans texte enregistré, la page reste telle qu'écrite ici.

Seuls les textes SANS lien ni mise en forme reçoivent un repère (un texte avec un lien, un
e-mail ou du gras reste écrit dans le code) ; un titre suivi de son point rouge
(<span class="oeil">) reçoit le repère sur le texte seul, le point rouge reste.
Jamais dans les parties remplies par la page elle-même (PARTIES_DE_LA_PAGE, élément avec id, cartes
d'événements, formulaires, parties cachées).

  python3 scripts/textes-pages.py --marquer    pose les repères manquants (FR et EN)
  python3 scripts/textes-pages.py --verifier   vérifie que FR et EN ont les mêmes repères
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
PAGES = ['services', 'qui-sommes-nous', 'integrer-agence', 'mentions-legales', 'politique-confidentialite']
BALISES = {'h1', 'h2', 'h3', 'h4', 'p', 'li', 'dt', 'dd', 'blockquote', 'figcaption'}
VIDES = {'br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'wbr', 'area', 'base', 'col', 'embed', 'track'}
# contenu accepté : du texte (et des retours à la ligne), éventuellement suivi du point rouge
TEXTE = re.compile(r'^([^<]*(?:<br\s*/?>[^<]*)*?)(\s*<span class="oeil">[^<]*</span>)?$')
# parties remplies ou changées par la page elle-même : rien n'y est modifiable (tout ce qu'elles contiennent)
PARTIES_DE_LA_PAGE = {'qsn-evenements', 'qsn-visages-piste', 'qsn-diaporama', 'qsn-progression', 'form-casting',
                      'ca-bloc-agence-info', 'ca-experience'}
REPERE = re.compile(r' data-texte="([a-z-]+-\d+)"')


class Lecteur(HTMLParser):
    """Repère, dans <main>, les éléments simples (offsets dans le texte de la page)."""

    def __init__(self, html):
        super().__init__(convert_charrefs=False)
        self.html = html
        self.debuts = [0]
        for ligne in html.splitlines(keepends=True):
            self.debuts.append(self.debuts[-1] + len(ligne))
        self.pile = []      # [balise, début de la balise ouvrante, fin de la balise ouvrante, exclu]
        self.trouves = []   # (balise, début ouvrante, fin ouvrante, début fermante)
        self.dans_main = False

    def position(self):
        ligne, col = self.getpos()
        return self.debuts[ligne - 1] + col

    def handle_starttag(self, balise, attrs):
        debut = self.position()
        fin = debut + len(self.get_starttag_text())
        if balise == 'main':
            self.dans_main = True
        if balise in VIDES:
            return
        a = dict(attrs)
        # (exclu : 'sous' = l'élément et tout son contenu ; 'seul' = l'élément lui-même, rempli par la page)
        sous = bool(self.pile and self.pile[-1][3] == 'sous') or a.get('id') in PARTIES_DE_LA_PAGE \
            or 'data-evenement' in a or 'hidden' in a or a.get('aria-hidden') == 'true' or balise == 'form'
        exclu = 'sous' if sous else ('seul' if ('id' in a or 'data-texte' in a) else '')
        self.pile.append([balise, debut, fin, exclu])

    def handle_endtag(self, balise):
        if balise == 'main':
            self.dans_main = False
        if balise in VIDES:
            return
        while self.pile:
            b, debut, fin, exclu = self.pile.pop()
            if b == balise:
                if self.dans_main and balise in BALISES and not exclu:
                    self.trouves.append((balise, debut, fin, self.position()))
                return


def zones(html):
    """Éléments simples de la page, dans l'ordre : (balise, début ouvrante, fin ouvrante, fin du texte)."""
    lecteur = Lecteur(html)
    lecteur.feed(html)
    resultat = []
    for balise, debut, fin, fermante in sorted(lecteur.trouves, key=lambda z: z[1]):
        m = TEXTE.match(html[fin:fermante])
        if m and m.group(1).strip():
            resultat.append((balise, debut, fin, fin + len(m.group(1)), bool(m.group(2))))
    return resultat


def repere_existants(html):
    return REPERE.findall(html)


def marquer(chemin, page):
    # (seulement les 5 pages prévues, dans le dossier du site : SonarCloud S2083)
    # (SonarCloud, 07/11/2026) le fichier lu et écrit est TOUJOURS l'un des deux chemins fabriqués ici à partir de la
    # liste PAGES, jamais celui reçu : aucune autre adresse ne peut être atteinte
    permis = {str(RACINE / (p_ + '.html')): RACINE / (p_ + '.html') for p_ in PAGES}
    permis.update({str(RACINE / 'en' / (p_ + '.html')): RACINE / 'en' / (p_ + '.html') for p_ in PAGES})
    cible = permis.get(str(chemin.resolve()))
    if page not in PAGES or cible is None or cible.stem != page:
        raise ValueError('page non prévue : %s' % chemin)
    chemin = cible
    html = chemin.read_text(encoding='utf-8')
    if repere_existants(html):
        return len(repere_existants(html))
    morceaux, dernier = [], 0
    for n, (balise, debut, fin, fin_texte, oeil) in enumerate(zones(html), 1):
        cle = '%s-%d' % (page, n)
        if oeil:
            # le texte seul dans une <span data-texte>, le point rouge reste après
            morceaux += [html[dernier:fin], '<span data-texte="%s">' % cle, html[fin:fin_texte], '</span>']
            dernier = fin_texte
        else:
            ouvrante = html[debut:fin]
            morceaux += [html[dernier:debut], ouvrante[:-1] + ' data-texte="%s">' % cle]
            dernier = fin
    morceaux.append(html[dernier:])
    chemin.write_text(''.join(morceaux), encoding='utf-8')
    return len(repere_existants(''.join(morceaux)))


def balises_reperees(html):
    """Pour chaque repère : la balise qui le porte (pour comparer FR et EN)."""
    return [(m.group(2), m.group(1)) for m in re.finditer(r'<(\w+)[^>]*? data-texte="([a-z-]+-\d+)"', html)]


def verifier():
    ko = 0
    for page in PAGES:
        fr = (RACINE / (page + '.html')).read_text(encoding='utf-8')
        en = (RACINE / 'en' / (page + '.html')).read_text(encoding='utf-8')
        rf, re_ = balises_reperees(fr), balises_reperees(en)
        if not rf:
            print('❌ %s : aucun repère data-texte' % page)
            ko += 1
        elif rf != re_:
            print('❌ %s : repères différents entre français (%d) et anglais (%d)' % (page, len(rf), len(re_)))
            ko += 1
        elif len(set(c for c, _ in rf)) != len(rf):
            print('❌ %s : repère en double' % page)
            ko += 1
        else:
            print('✓ %s : %d textes modifiables, mêmes repères en français et en anglais' % (page, len(rf)))
    return ko


if __name__ == '__main__':
    if '--marquer' in sys.argv:
        for page in PAGES:
            for chemin in (RACINE / (page + '.html'), RACINE / 'en' / (page + '.html')):
                print('%s : %d repères' % (chemin.relative_to(RACINE), marquer(chemin, page)))
    sys.exit(1 if verifier() else 0)
