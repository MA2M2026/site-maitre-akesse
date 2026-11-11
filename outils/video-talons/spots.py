#!/usr/bin/env python3
"""Spots réseaux sociaux du cours de talons (11/11/2026, vertical 1080 × 1920, ~35–40 s) : écrit film-spot1.html à
film-spot5.html. Version « grands plans » : images IA générées par la propriétaire (dossier ia/, aucun droit d'auteur
d'un tiers), plein écran, ouvertes sur le mot dit par la voix (effet « plan » de moteur-film.js), textes et boutons
du site par-dessus, rouge mat. Les parties communes (en-tête, cours privé, carte de fin) sont écrites UNE fois ici.
Voix « Victoria » enregistrées par la propriétaire, calées par aligner-voix.py (textes voix-spotN.json).
  python3 spots.py
  HD=1 FILM=film-spotN.html NOM=… VOIX=<dossier> MUSIQUE=<wav> IMAGES=<dossier> node fabrique-talons.js vertical"""
import os
ICI = os.path.dirname(os.path.abspath(__file__))
PAS = '<svg viewBox="0 0 40 90"><ellipse cx="20" cy="27" rx="14" ry="25"/><circle cx="20" cy="79" r="8"/></svg>'


def ia(n):
    return 'ia/ia-%02d.jpg' % n


def tete(n, titre, desc):
    return f'''<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<!-- Spot {n} : {desc} — fabriqué par spots.py (ne pas modifier à la main) -->
<title>{titre}</title>
<script src="timing-spot{n}.js"></script>
<link rel="stylesheet" href="moteur-film.css">
<link rel="stylesheet" href="spot-commun.css">
</head>
<body class="mat">
<div id="film">
'''


def pied(etiquette='Atelier'):
    return f'''  <div id="poussiere"></div>
  <div id="lueur"></div>
  <div id="barres"></div>
  <div id="fuite"></div>
  <div id="flash"></div>
  <div id="grain"></div>
  <div id="eclat"></div>
  <div id="cadre"></div>
  <div id="marque"><img src="../../assets/logo-header.png" alt=""><span>{etiquette}</span></div>
  <p id="site">maitreakessemodelmanagement.com</p>
</div>
<script src="moteur-film.js"></script>
</body></html>
'''


def plan(cle, img, mot='', entree='zoom', camera='avance', retard=None, fin=None, clair=False):
    """Grand plan plein écran ouvert sur le mot ; en relief 2.5D (décor + personnage détouré, dossier ia/couches)
    quand les couches existent. fin = (clé, mot) où il s'efface (pour enchaîner plusieurs plans)."""
    dep = f' data-mot="{mot}"' if mot else ''
    if retard is not None: dep += f' data-retard="{retard}"'
    f = f' data-finvoix="{fin[0]}" data-finmot="{fin[1]}" data-finretard="0.6"' if fin else ''
    base = img[:-4].replace('ia/', 'ia/couches/')
    if os.path.exists(os.path.join(ICI, base + '-sujet.png')):
        sens = 'gauche' if camera in ('recule', 'glisse', 'descend') else 'droite'
        return (f'    <div class="p25" data-voix="{cle}"{dep} data-anim="p25" data-entree="{entree}" data-camera="{sens}"{f}>'
                f'<img class="fond" src="{base}-fond.jpg"><img class="sujet" src="{base}-sujet.png"></div>\n')
    return f'    <div class="plan{" clair" if clair else ""}" data-voix="{cle}"{dep} data-anim="plan" data-entree="{entree}" data-camera="{camera}"{f}><img src="{img}"></div>\n'


def suite(cle, items, haut=False):
    """Plusieurs plans qui se succèdent dans une scène, chacun avec son mot géant (ou son étiquette-bouton) :
    items = [(mot dit, image, texte affiché, entrée, caméra)] ; haut=True : étiquette-bouton au lieu du mot géant."""
    h = ''
    for k, (mot, img, texte, en, cam) in enumerate(items):
        nxt = items[k + 1][0] if k + 1 < len(items) else None
        h += plan(cle, img, mot, 'fouet' if k else en, cam, None if mot else -0.5)  # coupes suivantes : coup de fouet
        dep = f'data-mot="{mot}"' if mot else 'data-retard="-0.2"'
        fin = f' data-finvoix="{cle}" data-finmot="{nxt}" data-finretard="-0.05"' if nxt else ''
        if haut:
            h += f'    <div class="abs etiquette-plan" data-voix="{cle}" {dep} data-anim="reveal"{fin}><span class="legende-luxe">{texte}</span></div>\n'
        else:
            h += f'    <div class="abs mot-plan" data-voix="{cle}" {dep} data-anim="reveal"{fin}>{texte}</div>\n'
    return h


def empreintes(cle, mot, y=1150):
    pos = [(180 + 120 * i, y + (60 if i % 2 else 0)) for i in range(6)]
    return ''.join(f'<div class="empreinte" data-voix="{cle}" data-mot="{mot}" data-retard="{i * 0.18 - 0.3:.2f}" data-anim="pop" style="--xv:{x}px;--yv:{yy}px;--r:{76 if i % 2 == 0 else 104}deg">{PAS}</div>' for i, (x, yy) in enumerate(pos)) + '\n'


def mois_pilules(cle, mots=('décembre', 'janvier', 'février'), haut=1240):
    noms = ('Décembre', 'Janvier', 'Février')
    return f'    <div class="abs pastilles-bas" style="top:{haut}px;bottom:auto;flex-direction:column;align-items:center;gap:22px">' + ''.join(
        f'<span class="bouton" data-voix="{cle}" data-mot="{m}" data-anim="monte">{n} · 4 dimanches</span>' for m, n in zip(mots, noms)) + '</div>\n'


def prive(cle, img=23):
    """Cours privé : la coach à domicile, en grand plan, avec l'épingle « ou au lieu de votre choix »."""
    return f'''  <section class="scene" data-de="{cle}" data-transition="rideau">
{plan(cle, ia(img), '', 'droite', 'recule', -0.3)}    <div class="texte sur-plan"><p class="surtitre" data-voix="{cle}" data-anim="reveal">Cours privé</p>
      <p class="grand"><span data-voix="{cle}" data-mot="chez" data-anim="reveal">Nous venons chez vous</span></p></div>
    <div class="abs lieu" style="left:90px;top:1720px" data-voix="{cle}" data-mot="lieu" data-anim="monte"><svg viewBox="0 0 100 100"><path d="M50 90 C50 90 22 60 22 40 C22 22 35 10 50 10 C65 10 78 22 78 40 C78 60 50 90 50 90 Z"/><circle cx="50" cy="40" r="10"/></svg>ou au lieu de votre choix</div>
  </section>
'''


# ---------- Motion design (11/11/2026, « trop diaporama ») : plusieurs couches qui bougent ensemble
def panneaux(cle, img, mot='', n=6, retard=None, fin=None):
    """Photo qui arrive en n bandes verticales glissant du haut et du bas, en cascade."""
    dep = f' data-mot="{mot}"' if mot else ''
    if retard is not None: dep += f' data-retard="{retard}"'
    f = f' data-finvoix="{fin[0]}" data-finmot="{fin[1]}" data-finretard="0.6"' if fin else ''
    w = 1080 / n
    lames = ''.join(f'<div class="lame"><img src="{img}" style="left:{-k * w:.1f}px"></div>' for k in range(n))
    return f'    <div class="panneaux" data-voix="{cle}"{dep} data-anim="panneaux"{f}>{lames}</div>\n'


def tiers(cle, items):
    """Écran partagé : une colonne par mot, qui coulisse du haut ou du bas ; items = [(mot, image, légende)]."""
    n, h = len(items), ''
    for k, (mot, img, leg) in enumerate(items):
        w = 1080 / n
        h += (f'    <div class="tiers plan" style="inset:auto;top:0;bottom:0;left:{k * w:.0f}px;width:{w + 2:.0f}px" data-voix="{cle}" data-mot="{mot}" data-anim="plan" '
              f'data-entree="{"bas" if k % 2 else "haut"}" data-camera="{"monte" if k % 2 else "descend"}"><img src="{img}"><b>{leg}</b></div>\n')
    return h


def carte(cle, img, mot, x, y, w, h, rot, dx, dy, retard=0):
    """Photo encadrée lancée de loin, qui se pose de biais par-dessus le fond puis flotte."""
    return (f'    <div class="carte-photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px" data-voix="{cle}" data-mot="{mot}" data-retard="{retard}" '
            f'data-anim="nuage" data-rot="{rot}" data-dx="{dx}" data-dy="{dy}"><img src="{img}"></div>\n')


def bandeau(cle, texte, top, vitesse=110, plein=False, mot=''):
    """Bandeau de texte qui défile en continu (texte répété)."""
    dep = f' data-mot="{mot}"' if mot else ' data-retard="-0.6"'
    return f'    <div class="bandeau{" plein" if plein else ""}" style="top:{top}px" data-voix="{cle}"{dep} data-anim="defile" data-vitesse="{vitesse}">{(texte + " · ") * 8}</div>\n'


def traverse(cle, mot, texte, top, sens=1, duree=2.6, fin=None):
    """Mot géant qui traverse l'écran sur le mot dit ; fin = mot (même phrase) où il s'efface."""
    x0, x1 = (1100, -900) if sens > 0 else (-1400, 300)
    f = f' data-finvoix="{cle}" data-finmot="{fin}" data-finretard="-0.1"' if fin else ''
    return f'    <div class="mot-traverse" style="top:{top}px" data-voix="{cle}" data-mot="{mot}" data-anim="deplace" data-x0="{x0}" data-x1="{x1}" data-duree="{duree}"{f}>{texte}</div>\n'


MUR = [1, 2, 5, 6, 10, 12, 14, 15, 17, 18, 19, 20, 21, 22, 24, 25, 27, 30, 31, 4, 9, 11, 13, 16, 26, 28, 29, 3, 7, 8]


def fin(cle, mot_site='site', sous='Décembre · Janvier · Février', bouton='Je m’inscris'):
    murs = ''.join(f'<div class="photo-m"><img src="{ia(MUR[i % len(MUR)])}"></div>' for i in range(54))
    return f'''  <section class="scene" data-de="{cle}" data-transition="cercle">
    <div class="mosaique mur" data-pas="0.02">{murs}</div>
    <div class="texte centre milieu" style="margin-top:-120px"><img class="logo-spot" data-voix="{cle}" data-anim="reveal" src="../../assets/logo-intro.png" alt="">
      <p class="surtitre" data-voix="{cle}" data-anim="reveal">Atelier Talons &amp; Élégance</p>
      <p class="moyen"><em data-voix="{cle}" data-retard="0.3" data-anim="reveal">{sous}</em></p>
      <span class="bouton" data-voix="{cle}" data-retard="0.5" data-anim="monte">{bouton}<i></i></span></div>
    <div class="abs fin-url" data-voix="{cle}" data-mot="{mot_site}" data-anim="reveal">maitreakessemodelmanagement.com</div>
    <div class="abs fin-tel" data-voix="{cle}" data-mot="{mot_site}" data-retard="0.3" data-anim="reveal"><small>Tél. / WhatsApp</small><span>05 45 65 66 87</span></div>
  </section>
'''


def texte(cle, haut, bas, mot1, mot2, surtitre=''):
    st = f'<p class="surtitre" data-voix="{cle}" data-anim="reveal">{surtitre}</p>' if surtitre else ''
    return f'''    <div class="texte sur-plan">{st}<p class="grand"><span data-voix="{cle}" data-mot="{mot1}" data-anim="reveal">{haut}</span><em data-voix="{cle}" data-mot="{mot2}" data-anim="reveal">{bas}</em></p></div>\n'''


def scene(cle, corps, tr='barres', demot=None):
    """Une scène ; demot : elle commence sur ce mot de la phrase (pas de temps mort avant le premier élément)."""
    dm = f' data-demot="{demot}"' if demot else ''
    return f'  <section class="scene" data-de="{cle}"{dm} data-transition="{tr}">\n{corps}  </section>\n\n'


def mois(cle, mots=('décembre', 'janvier', 'février')):
    """Trois calendriers (décembre, janvier, février) qui se lèvent sur les mots dits."""
    return ('    <div class="abs mois">' + ''.join(f'<div class="agenda" data-voix="{cle}" data-mot="{m}" data-anim="leve"><b>{n}</b><span>4 dimanches</span></div>'
            for m, n in zip(mots, ('DÉCEMBRE', 'JANVIER', 'FÉVRIER'))) + '</div>\n')


# ---------- Spot 1 : « Votre allure parle avant vous » — style « Intégrer l'agence » (scènes illustrées, images IA dedans)
def polar(cle, mot, img, leg, x, y, w, h, rot, dx, dy):
    return (f'    <div class="polar" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px" data-voix="{cle}" data-mot="{mot}" data-anim="nuage" data-rot="{rot}" '
            f'data-dx="{dx}" data-dy="{dy}"><img src="{img}"><b>{leg}</b></div>\n')


def rdv(cle, mot, heure, titre, img):
    return f'<div class="rdv" data-voix="{cle}" data-mot="{mot}" data-anim="monte"><img src="{img}"><div><b>{heure}</b><span>{titre}</span></div><i data-voix="{cle}" data-mot="{mot}" data-retard="0.5" data-anim="pop"></i></div>'


s1 = tete(1, 'Spot 1 Allure', '« Votre allure parle avant vous », femmes de bureau et de pouvoir') \
    + scene('s1', '    <div class="abs legende-tel"><p class="surtitre" data-voix="s1" data-retard="-0.6" data-anim="reveal">Votre journée</p></div>\n'
            + '    <div class="abs agenda-jour" data-voix="s1" data-retard="-0.5" data-anim="leve"><h5>Mercredi · Abidjan</h5>'
            + rdv('s1', 'réunion', '09 H 00', 'Réunion', ia(1)) + rdv('s1', 'présentation', '11 H 30', 'Présentation', ia(2)) + rdv('s1', 'rendez', '15 H 00', 'Rendez-vous important', ia(9)) + '</div>\n'
            + '    <div class="abs centre-x" style="top:1430px"><p class="grand sur-plan" style="font-size:92px"><em data-voix="s1" data-mot="important" data-anim="reveal">Tout se joue avant<br>de parler.</em></p></div>\n', 'fondu') \
    + scene('s2', '    <div class="carte-photo" style="left:150px;top:260px;width:780px;height:1040px" data-voix="s2" data-retard="-0.4" data-anim="leve"><img src="' + ia(10) + '"></div>\n'
            + '    <div class="abs bulle-parole" style="left:600px;top:330px" data-voix="s2" data-retard="-0.1" data-anim="pop" data-finvoix="s2" data-finmot="allure" data-finretard="-0.1">• • •</div>\n'
            + '    <div class="abs tampon" style="left:520px;top:880px" data-voix="s2" data-mot="parle" data-anim="tampon" data-rot="-8">ALLURE</div>\n'
            + texte('s2', 'Votre allure', 'parle pour vous.', 'allure', 'parle'), 'pousse') \
    + scene('s3', '    <div class="abs legende-tel"><p class="surtitre" data-voix="s3" data-mot="élégance" data-anim="reveal">L’élégance des femmes qui décident</p></div>\n'
            + polar('s3', 'démarche', ia(11), 'Une démarche assurée', 70, 330, 520, 700, -7, -700, 300)
            + polar('s3', 'posture', ia(12), 'Une posture droite', 480, 560, 520, 700, 6, 700, -200)
            + polar('s3', 'talons', ia(16), 'Des talons maîtrisés', 230, 950, 560, 640, -3, 0, 900), 'volet') \
    + scene('s4', '    <div class="abs legende-tel"><p class="surtitre" data-voix="s4" data-anim="reveal">Cette saison</p></div>\n'
            + mois('s4')
            + '    <div class="abs dimanches" style="top:1030px"><b data-voix="s5" data-mot="consacre" data-anim="reveal">4 dimanches</b><span data-voix="s5" data-mot="mois" data-anim="reveal">par mois, pour marcher avec</span></div>\n', 'cercle') \
    + scene('s5', '    <div class="abs" style="left:90px;right:90px;top:380px;display:flex;flex-direction:column;gap:30px;z-index:6">'
            + ''.join(f'<div class="qualite" data-voix="s5" data-mot="{m}" data-anim="leve"><img src="{ia(n)}"><span>{t}</span></div>' for m, t, n in [('aisance', 'Aisance', 24), ('prestance', 'Prestance', 21), ('autorité', 'Autorité', 25)]) + '</div>\n', 'barres', 'aisance') \
    + scene('s6', '    <div class="abs legende-tel"><p class="surtitre" data-voix="s6" data-anim="reveal">Cours privé</p><p class="grand"><span data-voix="s6" data-mot="chez" data-anim="reveal">Chez vous</span></p></div>\n'
            + '    <svg class="abs maison" viewBox="0 0 100 100" style="left:90px;top:560px;width:420px;height:420px"><path d="M12 48 L50 14 L88 48" data-voix="s6" data-mot="chez" data-anim="trace" data-duree="0.8"/><path d="M22 40 L22 88 L78 88 L78 40" data-voix="s6" data-mot="chez" data-retard="0.4" data-anim="trace" data-duree="0.8"/><path d="M42 88 L42 64 L58 64 L58 88" data-voix="s6" data-mot="lieu" data-anim="trace" data-duree="0.6"/></svg>\n'
            + carte('s6', ia(23), 'chez', 520, 520, 470, 640, 5, 600, -200)
            + '    <div class="abs lieu" style="left:150px;top:1290px" data-voix="s6" data-mot="lieu" data-anim="monte"><svg viewBox="0 0 100 100"><path d="M50 90 C50 90 22 60 22 40 C22 22 35 10 50 10 C65 10 78 22 78 40 C78 60 50 90 50 90 Z"/><circle cx="50" cy="40" r="10"/></svg>ou au lieu de votre choix</div>\n', 'rideau') \
    + scene('s7', '    <div class="carte-photo" style="left:250px;top:240px;width:580px;height:800px" data-voix="s7" data-retard="-0.3" data-anim="leve"><img src="' + ia(25) + '"></div>\n'
            + empreintes('s7', 'premier', 1120)
            + '    <div class="abs centre-x" style="top:1330px"><p class="grand"><span data-voix="s7" data-mot="puissante" data-anim="reveal">Une femme puissante</span><em data-voix="s7" data-mot="premier" data-anim="reveal">dès son premier pas.</em></p></div>\n', 'pousse') \
    + fin('s8') + pied()

# ---------- Parties communes du style « Intégrer l'agence »
def prive_ag(cle):
    """Cours privé : maison qui se dessine, photo de la coach à domicile, épingle « ou au lieu de votre choix »."""
    return scene(cle, carte(cle, ia(23), '', 520, 520, 470, 640, 5, 600, -200).replace(f'data-mot="" data-retard="0"', 'data-retard="-0.4"')
                 + f'    <div class="abs legende-tel"><p class="surtitre" data-voix="{cle}" data-retard="-0.2" data-anim="reveal">Cours privé</p><p class="grand"><span data-voix="{cle}" data-mot="chez" data-anim="reveal">Chez vous</span></p></div>\n'
                 + f'    <svg class="abs maison" viewBox="0 0 100 100" style="left:90px;top:560px;width:420px;height:420px"><path d="M12 48 L50 14 L88 48" data-voix="{cle}" data-mot="chez" data-anim="trace" data-duree="0.8"/><path d="M22 40 L22 88 L78 88 L78 40" data-voix="{cle}" data-mot="chez" data-retard="0.4" data-anim="trace" data-duree="0.8"/><path d="M42 88 L42 64 L58 64 L58 88" data-voix="{cle}" data-mot="lieu" data-anim="trace" data-duree="0.6"/></svg>\n'
                 + f'    <div class="abs lieu" style="left:150px;top:1290px" data-voix="{cle}" data-mot="lieu" data-anim="monte"><svg viewBox="0 0 100 100"><path d="M50 90 C50 90 22 60 22 40 C22 22 35 10 50 10 C65 10 78 22 78 40 C78 60 50 90 50 90 Z"/><circle cx="50" cy="40" r="10"/></svg>ou au lieu de votre choix</div>\n', 'rideau')


def leg(cle, txt, mot=''):
    dep = f'data-mot="{mot}"' if mot else 'data-retard="-0.3"'
    return f'    <div class="abs legende-tel"><p class="surtitre" data-voix="{cle}" {dep} data-anim="reveal">{txt}</p></div>\n'


def grand_bas(cle, l1, m1, l2='', m2='', top=1330, taille=None):
    st = f';font-size:{taille}px' if taille else ''
    em = f'<em data-voix="{cle}" data-mot="{m2}" data-anim="reveal">{l2}</em>' if l2 else ''
    return f'    <div class="abs centre-x" style="top:{top}px;padding:0 60px"><p class="grand" style="margin:0{st}"><span data-voix="{cle}" data-mot="{m1}" data-anim="reveal">{l1}</span>{em}</p></div>\n'


def photo(cle, img, x, y, w, h, mot=''):
    dep = f'data-mot="{mot}"' if mot else 'data-retard="-0.4"'
    return f'    <div class="carte-photo" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px" data-voix="{cle}" {dep} data-anim="leve"><img src="{img}"></div>\n'


def liste(cle, titre, lignes, top=300):
    """Carte blanche façon agenda : lignes = [(clé, mot, petit titre, titre, image, coche)]."""
    h = f'    <div class="abs agenda-jour" style="top:{top}px" data-voix="{cle}" data-retard="-0.4" data-anim="leve"><h5>{titre}</h5>'
    for c, m, petit, t, img, coche in lignes:
        h += (f'<div class="rdv" data-voix="{c}" data-mot="{m}" data-anim="monte"><img src="{img}"><div><b>{petit}</b><span>{t}</span></div>'
              + (f'<i data-voix="{c}" data-mot="{m}" data-retard="0.5" data-anim="pop"></i>' if coche else '') + '</div>')
    return h + '</div>\n'


# ---------- Spot 2 : « Mes premiers talons » (jeunes femmes, débutantes)
s2 = tete(2, 'Spot 2 Premiers talons', '« Mes premiers talons », jeunes femmes et débutantes') \
    + scene('s1', polar('s1', 'aimez', ia(13), 'Vous aimez les talons…', 90, 260, 560, 760, -6, -700, 200).replace('data-mot="aimez"', 'data-retard="-0.5"')
            + polar('s1', 'pieds', ia(16), '…vos pieds un peu moins', 470, 700, 520, 700, 7, 700, 300)
            + grand_bas('s1', 'Les talons ?', 'talons', top=1480), 'fondu') \
    + scene('s2', photo('s2', ia(14), 140, 250, 800, 1000)
            + '    <div class="abs bulle-parole" style="left:560px;top:300px;font-size:56px;letter-spacing:0.02em" data-voix="s2" data-retard="-0.1" data-anim="pop">Hésitante ?</div>\n'
            + '    <div class="abs tampon" style="left:120px;top:900px" data-voix="s2" data-mot="chancelez" data-anim="tampon" data-rot="-8">ÇA CHANCELLE ?</div>\n'
            + grand_bas('s2', 'Vous hésitez,', 'hésitez', 'vous chancelez ?', 'chancelez'), 'pousse') \
    + scene('s3', photo('s3', ia(4), 140, 250, 800, 1000)
            + '    <div class="abs tampon" style="left:200px;top:980px" data-voix="s3" data-mot="apprend" data-anim="tampon" data-rot="-8">ÇA S’APPREND !</div>\n'
            + grand_bas('s3', 'Bonne nouvelle', 'bonne', top=1360), 'cercle') \
    + scene('s4', leg('s4', 'On commence par les bases')
            + polar('s4', 'équilibre', ia(24), 'L’équilibre', 70, 330, 520, 700, -7, -700, 300)
            + polar('s4', 'posture', ia(12), 'La posture', 480, 560, 520, 700, 6, 700, -200)
            + polar('s4', 'pas', ia(11), 'Le bon pas', 230, 950, 560, 640, -3, 0, 900), 'volet') \
    + scene('s5', liste('s5', 'Vos dimanches', [('s5', 'dimanche', 'DIMANCHE 1', 'Les bases', ia(4), True), ('s5', 'après', 'DIMANCHE 2', 'La démarche', ia(11), True),
                                               ('s5', 'confiance', 'DIMANCHE 3', 'La prestance', ia(24), True)])
            + '    <div class="abs tampon" style="left:240px;top:1250px" data-voix="s5" data-mot="arrive" data-anim="tampon" data-rot="-6">CONFIANCE</div>\n', 'barres') \
    + scene('s6', mois('s6').replace('data-mot="décembre" ', 'data-retard="-0.4" ')
            + polar('s6', 'ambiance', ia(15), 'Une ambiance bienveillante', 300, 1040, 480, 560, 5, 600, 400), 'cercle') \
    + prive_ag('s7') \
    + scene('s8', photo('s8', ia(21), 140, 220, 800, 1060) + grand_bas('s8', 'Bientôt, c’est vous', 'bientôt', 'qu’on regarde passer.', 'regarde', 1360), 'pousse') \
    + fin('s9') + pied()

# ---------- Spot 3 : « Prête pour les grands jours » (fêtes, mariages, galas)
s3 = tete(3, 'Spot 3 Grands jours', '« Prête pour les grands jours », fêtes, mariages, galas') \
    + scene('s1', polar('s1', 'réveillon', ia(17), 'Réveillon', 60, 260, 470, 620, -8, -700, 0).replace('data-mot="réveillon"', 'data-retard="-0.5"')
            + polar('s1', 'mariage', ia(18), 'Mariage', 540, 330, 470, 620, 6, 700, 0)
            + polar('s1', 'gala', ia(19), 'Gala', 90, 900, 470, 620, 5, -700, 500)
            + polar('s1', 'saint', ia(20), 'Saint-Valentin', 520, 980, 470, 620, -6, 700, 500), 'fondu') \
    + scene('s2', liste('s2', 'Votre saison', [('s2', 'décembre', '31 DÉCEMBRE', 'Réveillon', ia(17), True), ('s2', 'occasions', 'SAMEDI', 'Mariage', ia(18), True),
                                               ('s2', 'enchaînent', '14 FÉVRIER', 'Saint-Valentin', ia(20), True)])
            + grand_bas('s2', 'Les grandes occasions', 'grandes', top=1380, taille=90), 'barres') \
    + scene('s3', photo('s3', ia(22), 140, 240, 800, 1000)
            + '    <div class="abs pastilles-bas" style="top:1290px;bottom:auto"><span class="bouton" data-voix="s3" data-mot="robe" data-anim="monte">La robe ✓</span><span class="bouton" data-voix="s3" data-mot="talons" data-anim="monte">Les talons ✓</span></div>\n'
            + '    <div class="abs tampon" style="left:140px;top:1440px;font-size:84px" data-voix="s3" data-mot="démarche" data-anim="tampon" data-rot="-6">ET LA DÉMARCHE ?</div>\n', 'pousse') \
    + scene('s4', leg('s4', 'À l’Atelier')
            + polar('s4', 'robe', ia(24), 'Marcher en robe longue', 70, 330, 520, 700, -7, -700, 300)
            + polar('s4', 'escalier', ia(5), 'Descendre un escalier', 480, 560, 520, 700, 6, 700, -200)
            + polar('s4', 'briller', ia(17), 'Briller toute la soirée', 230, 950, 560, 640, -3, 0, 900), 'volet') \
    + scene('s5', mois('s5', ('quatre', 'dimanches', 'mois')).replace('data-mot="quatre" ', 'data-retard="-0.4" ')
            + '    <div class="abs dimanches" style="top:1030px"><b data-voix="s5" data-mot="trois" data-anim="reveal">12 dimanches</b><span data-voix="s5" data-mot="trois" data-anim="reveal">pendant trois mois</span></div>\n', 'cercle') \
    + prive_ag('s6') \
    + scene('s7', photo('s7', ia(21), 140, 220, 800, 1060)
            + '    <div class="abs tampon" style="left:160px;top:960px" data-voix="s7" data-mot="entrée" data-anim="tampon" data-rot="-6">ENTRÉE REMARQUÉE</div>\n'
            + grand_bas('s7', 'Cette saison,', 'saison', top=1400), 'pousse') \
    + fin('s8') + pied()

# ---------- Spot 4 : « Trois mois, douze dimanches » (le programme)
def mois_scene(cle, mot, nom, contenu, img, tr):
    return scene(cle, f'    <div class="abs mois"><div class="agenda" data-voix="{cle}" data-retard="-0.4" data-anim="leve"><b>{nom}</b><span>4 dimanches</span></div></div>\n'
                 + polar(cle, mot, img, contenu, 240, 560, 600, 780, -4, 0, 900).replace(f'data-mot="{mot}"', 'data-retard="0.1"'), tr)


s4 = tete(4, 'Spot 4 Programme', '« Trois mois, douze dimanches », le programme') \
    + scene('s1', photo('s1', ia(26), 140, 240, 800, 900)
            + '    <div class="abs dimanches" style="top:1180px"><b data-voix="s1" data-mot="trois" data-anim="reveal">3 mois</b><b style="font-size:110px" data-voix="s1" data-mot="douze" data-anim="reveal">12 dimanches</b><span data-voix="s1" data-mot="nouvelle" data-anim="reveal">une nouvelle démarche</span></div>\n', 'fondu') \
    + mois_scene('s2', 'bases', 'DÉCEMBRE', 'Posture, équilibre, port de tête', ia(4), 'barres') \
    + mois_scene('s3', 'fluidité', 'JANVIER', 'Fluidité & assurance', ia(24), 'volet') \
    + mois_scene('s4', 'élégance', 'FÉVRIER', 'Élégance & présence', ia(5), 'rideau') \
    + scene('s5', photo('s5', ia(25), 250, 240, 580, 800) + empreintes('s5', 'rapproche', 1100)
            + grand_bas('s5', 'Chaque dimanche vous rapproche', 'rapproche', 'de la femme que vous voulez être.', 'femme', 1300, 84), 'pousse') \
    + scene('s6', leg('s6', 'Une place pour vous', 'place')
            + polar('s6', 'débutante', ia(13), 'Débutante', 70, 330, 520, 760, -6, -700, 200).replace('data-mot="débutante"', 'data-retard="-0.4"')
            + polar('s6', 'aise', ia(10), 'Déjà à l’aise', 490, 640, 520, 760, 6, 700, 200), 'volet') \
    + prive_ag('s7') \
    + fin('s8') + pied()

# ---------- Spot 5 : « L'élégance au travail » (offre Entreprises : dans leurs locaux, sur devis, site et WhatsApp)
s5 = tete(5, 'Spot 5 Entreprises', '« L\'élégance au travail », offre Entreprises') \
    + scene('s1', photo('s1', ia(30), 140, 240, 800, 1000) + leg('s1', 'Offre Entreprises')
            + grand_bas('s1', 'Vos collaboratrices,', 'collaboratrices', 'votre première image.', 'image', 1330), 'fondu') \
    + scene('s2', leg('s2', 'Leur allure parle pour vous', 'allure')
            + polar('s2', 'accueil', ia(6), 'À l’accueil', 70, 330, 520, 700, -7, -700, 300).replace('data-mot="accueil"', 'data-retard="-0.4"')
            + polar('s2', 'réunion', ia(7), 'En réunion', 480, 560, 520, 700, 6, 700, -200)
            + polar('s2', 'clients', ia(29), 'Face aux clients', 230, 950, 560, 640, -3, 0, 900), 'volet') \
    + scene('s3', photo('s3', ia(8), 140, 240, 800, 900) + leg('s3', 'Dans vos locaux')
            + '    <div class="abs lieu" style="left:220px;top:1200px" data-voix="s3" data-mot="mesure" data-anim="monte"><svg viewBox="0 0 100 100"><path d="M20 50 L42 72 L82 28"/></svg>Programme sur mesure</div>\n'
            + grand_bas('s3', 'Nous venons à vous.', 'locaux', top=1380), 'pousse') \
    + scene('s4', liste('s4', 'Programme sur mesure', [('s4', 'un', 'MODULE 1', 'Posture & port de tête', ia(3), True), ('s5', 'deux', 'MODULE 2', 'Démarche en talons', ia(28), True),
                                                       ('s6', 'trois', 'MODULE 3', 'Prestance', ia(27), True), ('s7', 'quatre', 'MODULE 4', 'Confiance en soi', ia(12), True)], 260), 'cercle') \
    + scene('s8', '    <div class="abs" style="left:90px;right:90px;top:380px;display:flex;flex-direction:column;gap:30px;z-index:6">'
            + ''.join(f'<div class="qualite" data-voix="s8" data-mot="{m}" data-anim="leve"><img src="{ia(n)}"><span>{t}</span></div>' for m, t, n in [('équipes', 'Équipes assurées', 31), ('accueil', 'Accueil soigné', 6), ('image', 'Image renforcée', 12)])
            + '</div>\n' + grand_bas('s8', 'Résultat', 'résultat', top=1380), 'barres', 'résultat') \
    + fin('s9', mot_site='whatsapp', sous='Offre Entreprises · sur devis', bouton='Demander un devis') + pied('Entreprises')

for n, h in [(1, s1), (2, s2), (3, s3), (4, s4), (5, s5)]:
    open(os.path.join(ICI, f'film-spot{n}.html'), 'w', encoding='utf-8').write(h)
print('spots 1 à 5 écrits')
