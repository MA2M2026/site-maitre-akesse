#!/usr/bin/env python3
"""Spots réseaux sociaux du cours de talons (11/11/2026, vertical, ~35 s chacun) : écrit film-spot2.html à
film-spot5.html. Les parties communes (en-tête, cours privé, carte de fin, mur de photos) sont écrites UNE fois ici ;
chaque spot ne décrit que ses scènes propres. Voix « Victoria » enregistrées par la propriétaire, calées par
aligner-voix.py (textes voix-spotN.json). Rendu : FILM=film-spotN.html NOM=spotN-… node fabrique-talons.js vertical
Femmes majeures seulement, jamais KAPO Ainhoa ni AKASSOU, jamais d'homme.
  python3 spots.py"""
import os
ICI = os.path.dirname(os.path.abspath(__file__))
V, M = 'vignettes/', 'medaillons/'
PAS = '<svg viewBox="0 0 40 90"><ellipse cx="20" cy="27" rx="14" ry="25"/><circle cx="20" cy="79" r="8"/></svg>'
MUR = ['005', '054', '106', '003', '042', '103', '027', '043', '146', '149', '088', '016', '162', '084', '107', '131', '014', '059']


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
  <div id="eclat"></div>
  <div id="cadre"></div>
  <div id="marque"><img src="../../assets/logo-header.png" alt=""><span>{etiquette}</span></div>
  <p id="site">maitreakessemodelmanagement.com</p>
</div>
<script src="moteur-film.js"></script>
</body></html>
'''


def prive(cle, transition='rideau'):
    """Cours privé : maison qui se dessine et épingle « ou au lieu de votre choix »."""
    return f'''  <section class="scene" data-de="{cle}" data-transition="{transition}">
    <div class="abs legende-tel"><p class="surtitre" data-voix="{cle}" data-anim="glisse">Cours privé</p><p class="grand"><span data-voix="{cle}" data-mot="chez" data-anim="lettres">Chez vous</span></p></div>
    <svg class="abs maison" viewBox="0 0 100 100"><path d="M12 48 L50 14 L88 48" data-voix="{cle}" data-mot="chez" data-anim="trace" data-duree="0.8"/><path d="M22 40 L22 88 L78 88 L78 40" data-voix="{cle}" data-mot="chez" data-retard="0.4" data-anim="trace" data-duree="0.8"/><path d="M42 88 L42 64 L58 64 L58 88" data-voix="{cle}" data-mot="lieu" data-anim="trace" data-duree="0.6"/></svg>
    <div class="abs lieu" data-voix="{cle}" data-mot="lieu" data-anim="pop"><svg viewBox="0 0 100 100"><path d="M50 90 C50 90 22 60 22 40 C22 22 35 10 50 10 C65 10 78 22 78 40 C78 60 50 90 50 90 Z"/><circle cx="50" cy="40" r="10"/></svg>ou au lieu de votre choix</div>
  </section>
'''


def mur(n=54):
    return ''.join(f'<div class="photo-m"><img src="{V}{MUR[i % len(MUR)]}.jpg"></div>' for i in range(n))


def fin(cle, mot_site='site', sous='Décembre · Janvier · Février', bouton='Je m’inscris', bas='maitreakessemodelmanagement.com'):
    return f'''  <section class="scene" data-de="{cle}" data-transition="cercle">
    <div class="mosaique mur" data-pas="0.02">{mur()}</div>
    <div class="texte centre milieu" style="margin-top:-120px"><img class="logo-spot" data-voix="{cle}" data-anim="pop" src="../../assets/logo-intro.png" alt="">
      <p class="surtitre" data-voix="{cle}" data-anim="glisse">Atelier Talons &amp; Élégance</p>
      <p class="moyen"><em data-voix="{cle}" data-retard="0.3" data-anim="mots">{sous}</em></p>
      <span class="bouton" data-voix="{cle}" data-retard="0.5" data-anim="pop">{bouton}<i></i></span></div>
    <div class="abs fin-url" data-voix="{cle}" data-mot="{mot_site}" data-anim="pop">{bas}</div>
    <div class="abs fin-tel" data-voix="{cle}" data-mot="{mot_site}" data-retard="0.3" data-anim="pop"><small>Tél. / WhatsApp</small><span>05 45 65 66 87</span></div>
  </section>
'''


def mots_geants(cle, liste):
    """Mots géants qui se succèdent sur la voix, chacun avec sa photo : liste de (mot dit, texte affiché, image)."""
    h = ''
    for k, (mot, texte, img) in enumerate(liste):
        suite = liste[k + 1][0] if k + 1 < len(liste) else None
        fin_ = f' data-finvoix="{cle}" data-finmot="{suite}" data-finretard="-0.1"' if suite else ''
        dep = f'data-mot="{mot}"' if mot else 'data-retard="-0.5"'
        h += f'    <div class="abs carre photo-mot" data-voix="{cle}" {dep} data-anim="leve"{fin_}><img src="{img}"></div>\n'
        h += f'    <div class="abs mot-geant" data-voix="{cle}" {dep} data-anim="pop"{fin_}>{texte}</div>\n'
    return h


def empreintes(cle, mot, pos):
    return ''.join(f'<div class="empreinte" data-voix="{cle}" data-mot="{mot}" data-retard="{i * 0.2 - 0.4:.2f}" data-anim="pop" style="--xv:{x}px;--yv:{y}px;--r:{76 if i % 2 == 0 else 104}deg">{PAS}</div>' for i, (x, y) in enumerate(pos))


def mois(cle, mots=('décembre', 'janvier', 'février')):
    return f'''    <div class="abs mois">
      <div class="agenda" data-voix="{cle}" data-mot="{mots[0]}" data-anim="leve"><b>DÉCEMBRE</b><span>4 dimanches</span></div>
      <div class="agenda" data-voix="{cle}" data-mot="{mots[1]}" data-anim="leve"><b>JANVIER</b><span>4 dimanches</span></div>
      <div class="agenda" data-voix="{cle}" data-mot="{mots[2]}" data-anim="leve"><b>FÉVRIER</b><span>4 dimanches</span></div></div>
'''


TRAIT = [(180, 1170), (300, 1230), (420, 1170), (540, 1230), (660, 1170), (780, 1230)]  # en ligne, sous la photo
MARCHE = ['042', '034', '138', '149', '148', '146', '151', '182', '188', '144', '001', '009']


def diapo(liste, cle, mot='', pas=0.38):
    dep = f'data-mot="{mot}"' if mot else 'data-retard="-0.4"'
    return f'    <div class="abs marche-spot" data-voix="{cle}" {dep} data-anim="diapo" data-pas="{pas}">' + ''.join(f'<div><img src="{V}{n}.jpg"></div>' for n in liste) + '</div>\n'


def trip(cle, items, haut=''):
    s = f'    <div class="abs legende-tel"><p class="surtitre" data-voix="{cle}" data-anim="glisse">{haut}</p></div>\n' if haut else ''
    return s + '    <div class="abs triptyque">' + ''.join(f'<div data-voix="{cle}" data-mot="{m}" data-anim="leve"><img src="{img}"><b>{t}</b></div>' for m, t, img in items) + '</div>\n'


# ---------- Spot 2 : « Mes premiers talons » (jeunes femmes, débutantes)
s2 = tete(2, 'Spot 2 Premiers talons', '« Mes premiers talons », jeunes femmes et débutantes') + f'''
  <section class="scene" data-de="s1" data-transition="fondu">
    <div class="abs carre photo-mot" data-voix="s1" data-retard="-0.6" data-anim="leve"><img src="{M}t-048.jpg"></div>
    <div class="abs mot-geant" data-voix="s1" data-mot="talons" data-anim="pop">Les talons ?</div>
    <div class="abs centre-x" style="top:1420px"><p class="moyen"><em data-voix="s1" data-mot="pieds" data-anim="mots">mais vos pieds, un peu moins…</em></p></div>
  </section>

  <section class="scene" data-de="s2" data-transition="barres">
{mots_geants('s2', [('', 'Vous hésitez ?', M + 't-104.jpg'), ('chancelez', 'Vous chancelez ?', M + 't-138.jpg')])}  </section>

  <section class="scene" data-de="s3" data-transition="cercle">
    <div class="texte centre milieu"><p class="surtitre" data-voix="s3" data-anim="glisse">Bonne nouvelle</p>
      <div class="tampon" style="display:inline-block" data-voix="s3" data-mot="apprend" data-anim="tampon" data-rot="-8">ÇA S’APPREND !</div></div>
  </section>

  <section class="scene" data-de="s4" data-transition="volet">
{trip('s4', [('équilibre', 'L’équilibre', M + 't-145.jpg'), ('posture', 'La posture', V + '103.jpg'), ('pas', 'Le bon pas', V + '138.jpg')], 'On commence par les bases')}  </section>

  <section class="scene" data-de="s5" data-transition="rideau">
{diapo(MARCHE, 's5')}    {empreintes('s5', 'confiance', TRAIT)}
    <div class="texte"><p class="grand"><span data-voix="s5" data-mot="dimanche" data-anim="lettres">Dimanche après dimanche,</span><br><em data-voix="s5" data-mot="confiance" data-anim="lettres">la confiance arrive.</em></p></div>
  </section>

  <section class="scene" data-de="s6" data-transition="cercle">
{mois('s6')}    <div class="abs dimanches"><b data-voix="s6" data-mot="quatre" data-anim="pop">4 dimanches</b><span data-voix="s6" data-mot="mois" data-anim="mots">par mois</span></div>
    <div class="abs pastilles-bas"><span class="bouton" data-voix="s6" data-mot="ambiance" data-anim="pop">Une ambiance bienveillante</span></div>
  </section>

{prive('s7')}
  <section class="scene" data-de="s8" data-transition="barres">
{diapo(['149', '146', '182', '188', '042', '151'], 's8', pas=0.45)}    <div class="texte"><p class="grand"><span data-voix="s8" data-mot="bientôt" data-anim="lettres">Bientôt, c’est vous</span><br><em data-voix="s8" data-mot="regarde" data-anim="lettres">qu’on regarde passer.</em></p></div>
  </section>

{fin('s9')}''' + pied()

# ---------- Spot 3 : « Prête pour les grands jours » (fêtes, mariages, galas)
s3 = tete(3, 'Spot 3 Grands jours', '« Prête pour les grands jours », fêtes, mariages, galas') + f'''
  <section class="scene" data-de="s1" data-transition="fondu">
{mots_geants('s1', [('', 'Réveillon', V + '096.jpg'), ('mariage', 'Mariage', V + '014.jpg'), ('gala', 'Gala', V + '107.jpg'), ('saint', 'Saint-Valentin', V + '093.jpg')])}  </section>

  <section class="scene" data-de="s2" data-transition="barres">
{mois('s2', ('décembre', 'occasions', 'février'))}    <div class="abs dimanches"><b data-voix="s2" data-mot="grandes" data-anim="pop">Les grands jours</b><span data-voix="s2" data-mot="enchaînent" data-anim="mots">s’enchaînent</span></div>
  </section>

  <section class="scene" data-de="s3" data-transition="volet">
    <div class="abs duo-photos">
      <div class="carre" style="position:relative" data-voix="s3" data-mot="robe" data-anim="leve"><img src="{V}131.jpg"><span class="bouton">La robe ✓</span></div>
      <div class="carre" style="position:relative" data-voix="s3" data-mot="talons" data-anim="leve"><img src="{M}t-168.jpg"><span class="bouton">Les talons ✓</span></div></div>
    <div class="abs grande-question"><p class="grand"><em data-voix="s3" data-mot="démarche" data-anim="lettres">Et la démarche ?</em></p></div>
  </section>

  <section class="scene" data-de="s4" data-transition="cercle">
{trip('s4', [('robe', 'Marcher en robe longue', V + '043.jpg'), ('escalier', 'Descendre un escalier', V + '146.jpg'), ('briller', 'Briller toute la soirée', V + '107.jpg')], 'À l’Atelier')}  </section>

  <section class="scene" data-de="s5" data-transition="barres">
{mois('s5', ('quatre', 'dimanches', 'mois'))}    <div class="abs dimanches"><b data-voix="s5" data-mot="trois" data-anim="pop">12 dimanches</b><span data-voix="s5" data-mot="trois" data-anim="mots">pendant trois mois</span></div>
  </section>

{prive('s6')}
  <section class="scene" data-de="s7" data-transition="barres">
{diapo(['107', '096', '014', '093', '043', '131'], 's7', pas=0.45)}    <div class="texte"><p class="grand"><span data-voix="s7" data-mot="saison" data-anim="lettres">Cette saison,</span><br><em data-voix="s7" data-mot="entrée" data-anim="lettres">une entrée remarquée.</em></p></div>
  </section>

{fin('s8')}''' + pied()

# ---------- Spot 4 : « Trois mois, douze dimanches » (le programme)
s4 = tete(4, 'Spot 4 Programme', '« Trois mois, douze dimanches », le programme') + f'''
  <section class="scene" data-de="s1" data-transition="fondu">
    <div class="abs mot-geant" style="top:420px;font-size:260px" data-voix="s1" data-mot="trois" data-anim="pop">3 mois</div>
    <div class="abs mot-geant" style="top:760px;font-size:200px" data-voix="s1" data-mot="douze" data-anim="pop">12 dimanches</div>
    <div class="abs centre-x" style="top:1100px"><p class="grand"><em data-voix="s1" data-mot="nouvelle" data-anim="lettres">une nouvelle démarche</em></p></div>
  </section>

  <section class="scene" data-de="s2" data-transition="barres">
    <svg class="chemin-mois" viewBox="0 0 1080 1920"><path d="M240 640 C 120 760, 900 700, 820 880" data-voix="s3" data-anim="trace" data-duree="0.8"/><path d="M820 1240 C 900 1380, 160 1320, 260 1480" data-voix="s4" data-anim="trace" data-duree="0.8"/></svg>
    <div class="abs etape-mois" style="top:250px" data-voix="s2" data-mot="décembre" data-anim="leve"><div class="carre"><img src="{V}103.jpg"></div><div><b>Décembre</b><span>Les bases : posture, équilibre, port de tête</span></div></div>
    <div class="abs etape-mois" style="top:860px;flex-direction:row-reverse;text-align:right" data-voix="s3" data-mot="janvier" data-anim="leve"><div class="carre"><img src="{V}059.jpg"></div><div><b>Janvier</b><span>La fluidité et l’assurance</span></div></div>
    <div class="abs etape-mois" style="top:1440px" data-voix="s4" data-mot="février" data-anim="leve"><div class="carre"><img src="{V}149.jpg"></div><div><b>Février</b><span>L’élégance et la présence</span></div></div>
  </section>

  <section class="scene" data-de="s5" data-transition="cercle">
    <div class="photo gauche" data-mouvement="avance"><img src="{V}088.jpg"></div>
    {empreintes('s5', 'rapproche', TRAIT)}
    <div class="texte droite"><p class="surtitre" data-voix="s5" data-mot="chaque" data-anim="glisse">Chaque dimanche</p>
      <p class="grand"><span data-voix="s5" data-mot="rapproche" data-anim="lettres">vous rapproche</span><br><em data-voix="s5" data-mot="femme" data-anim="lettres">de la femme que vous voulez être.</em></p></div>
  </section>

  <section class="scene" data-de="s6" data-transition="volet">
    <div class="abs duo-photos">
      <div class="carre" style="position:relative" data-voix="s6" data-mot="débutante" data-anim="leve"><img src="{V}102.jpg"><span class="bouton">Débutante</span></div>
      <div class="carre" style="position:relative" data-voix="s6" data-mot="aise" data-anim="leve"><img src="{V}149.jpg"><span class="bouton">Déjà à l’aise</span></div></div>
    <div class="abs grande-question"><p class="grand"><em data-voix="s6" data-mot="place" data-anim="lettres">Une place pour vous</em></p></div>
  </section>

{prive('s7')}
{fin('s8')}''' + pied()

# ---------- Spot 5 : « L'élégance au travail » (offre Entreprises)
modules = [('s4', 'un', 'Module 1', 'La posture et le port de tête', V + '103.jpg'), ('s5', 'deux', 'Module 2', 'La démarche en talons', M + 't-145.jpg'),
           ('s6', 'trois', 'Module 3', 'La prestance, l’art de se présenter', V + '054.jpg'), ('s7', 'quatre', 'Module 4', 'La confiance en soi', '../../assets/cours-talons/galerie-tailleur.jpg')]
s5 = tete(5, 'Spot 5 Entreprises', '« L\'élégance au travail », offre Entreprises (dans leurs locaux, sur devis, site et WhatsApp)') + f'''
  <section class="scene" data-de="s1" data-transition="fondu">
    <div class="abs carre portrait" data-voix="s1" data-retard="-0.5" data-anim="leve"><img src="{V}005.jpg"></div>
    <div class="texte"><p class="surtitre" data-voix="s1" data-anim="glisse">Offre Entreprises</p><p class="grand"><span data-voix="s1" data-mot="collaboratrices" data-anim="lettres">Vos collaboratrices,</span><br><em data-voix="s1" data-mot="image" data-anim="lettres">votre première image.</em></p></div>
  </section>

  <section class="scene" data-de="s2" data-transition="barres">
{trip('s2', [('accueil', 'À l’accueil', V + '054.jpg'), ('réunion', 'En réunion', V + '106.jpg'), ('clients', 'Face aux clients', V + '003.jpg')], 'Leur allure parle pour vous')}  </section>

  <section class="scene" data-de="s3" data-transition="cercle">
    <svg class="abs maison" viewBox="0 0 100 100"><path d="M14 88 L14 30 L46 14 L46 88 M46 40 L86 40 L86 88 M8 88 L92 88 M22 36 L22 40 M30 36 L30 40 M22 52 L22 56 M30 52 L30 56 M22 68 L22 72 M30 68 L30 72 M58 54 L58 58 M70 54 L70 58 M58 70 L58 74 M70 70 L70 74" data-voix="s3" data-mot="locaux" data-anim="trace" data-duree="1.2"/></svg>
    <div class="abs legende-tel"><p class="surtitre" data-voix="s3" data-anim="glisse">Atelier Talons &amp; Élégance</p><p class="grand"><span data-voix="s3" data-mot="locaux" data-anim="lettres">Dans vos locaux</span></p></div>
    <div class="abs lieu" data-voix="s3" data-mot="mesure" data-anim="pop"><svg viewBox="0 0 100 100"><path d="M20 50 L42 72 L82 28"/></svg>Programme sur mesure</div>
  </section>
''' + ''.join(f'''
  <section class="scene" data-de="{c}" data-transition="{'volet' if k % 2 else 'rideau'}">
    <div class="abs carre portrait" data-voix="{c}" data-anim="leve"><img src="{img}"></div>
    <div class="texte"><div class="tampon" style="display:inline-block;font-size:90px" data-voix="{c}" data-mot="{m}" data-anim="tampon" data-rot="-6">{t}</div>
      <p class="grand" style="margin-top:30px"><em data-voix="{c}" data-retard="0.4" data-anim="lettres">{d}</em></p></div>
  </section>
''' for k, (c, m, t, d, img) in enumerate(modules)) + f'''
  <section class="scene" data-de="s8" data-transition="barres">
    <div class="abs pastilles-bas" style="top:520px;bottom:auto;flex-direction:column;align-items:center;gap:30px"><span class="bouton" data-voix="s8" data-mot="équipes" data-anim="pop">Des équipes plus assurées</span><span class="bouton" data-voix="s8" data-mot="accueil" data-anim="pop">Un accueil plus professionnel</span><span class="bouton" data-voix="s8" data-mot="image" data-anim="pop">Une image renforcée</span></div>
    <div class="abs centre-x" style="top:260px"><p class="grand"><span data-voix="s8" data-mot="résultat" data-anim="lettres">Résultat</span></p></div>
  </section>

{fin('s9', mot_site='whatsapp', sous='Offre Entreprises · sur devis', bouton='Demander un devis', bas='maitreakessemodelmanagement.com')}''' + pied('Entreprises')

for n, h in [(2, s2), (3, s3), (4, s4), (5, s5)]:
    open(os.path.join(ICI, f'film-spot{n}.html'), 'w', encoding='utf-8').write(h)
print('spots 2 à 5 écrits')
