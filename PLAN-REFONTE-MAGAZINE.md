# Plan de la refonte « magazine » du site MA2M

**À lire en premier par toute nouvelle conversation qui reprend ce travail**, après `CLAUDE.md`
(règles obligatoires : écrire en français, une chose à la fois, tests visiteur, une mise en ligne
par jour au plus, relecture, vérification du site en ligne, SonarQube).

Phrase à donner à une nouvelle conversation :
> « Lis le fichier PLAN-REFONTE-MAGAZINE.md et continue la refonte du site là où elle s'est arrêtée. »

## Ce que la propriétaire a choisi (20/10/2026)

Plusieurs styles lui ont été montrés en maquettes (styles « Épure », « Magazine », « Abidjan
nuit » en vert/jaune puis bordeaux puis rouge, styles « Index », « Cinéma », « Lookbook »).
Son choix final, avec ses mots : **« Le 3 est exactement ce que je veux »**, c'est-à-dire le
**Magazine 3** :

- La page d'accueil se lit **comme un magazine qu'on feuillette** : 8 pages au format magazine
  (3:4), centrées à l'écran ; **en descendant, chaque page vient se poser sur la précédente**
  (pages « collantes » qui s'empilent).
- **Papier beige clair** `#F1ECE5` sur un fond de scène `#CFC6BB`, encre `#1B1817`, gris
  `#655D56` (légendes), **rouge MA2M `#C8102E`** (grand titre, rubriques, boutons, dos du magazine).
  Elle a refusé le bordeaux (« pas beau ») et le jaune : **le rouge reste la couleur de la marque**.
- Lettres : titres **Big Shoulders Display** (800/900, capitales), texte **Work Sans**.
  Elle n'aimait pas la police fine type Cormorant pour « MA2M ».
- **Français et anglais** (`index.html` et `en/index.html`, puis les autres pages).
- Le **tableau de bord** et le portail `/admin` **ne changent pas**.

Maquette de référence : **`maquettes/accueil-magazine.html`** (ouvrir dans un navigateur ; les
photos viennent du site en ligne). Les 8 pages : 1 Couverture (mannequin en couverture, grand
« MA2M » rouge, « Numéro 01 · Abidjan · Octobre 2026 », titres de couverture) · 2 Sommaire ·
3 Édito (« Chaque grand parcours commence par un rêve… ») · 4 Les visages – Femmes (6 photos) ·
5 Les visages – Hommes · 6 À la une (une mannequin en grand) · 7 L'agence (Formation, Casting et
booking, Événements) · 8 Dos de couverture rouge (« Casting ouvert », bouton « Postuler à un
casting », contact). Les petits textes (sommaire, numéro, phrase « À la une ») sont des exemples
à valider avec elle.

Le dossier `maquettes/` et ce fichier ne sont pas publiés (`.vercelignore`).

## Étapes (une à la fois, chacune testée, mise en ligne, vérifiée en ligne)

- [~] **Étape 1 — Page d'accueil en magazine (FR + EN) : CONSTRUITE, PAS ENCORE EN LIGNE** (voir « Où on en est » plus bas). Remplacer le contenu de `index.html`
  et `en/index.html` par les 8 pages de la maquette, **remplies automatiquement** avec les
  données déjà gérées dans le tableau de bord : mannequins publiés (`model_profiles` avec
  `published = true` + fonction `photos_couverture_mannequins`, comme `js/mannequins.js`) pour
  les pages Femmes / Hommes, le « Mannequin à la une » existant pour la couverture et la page
  « À la une ». Garder ce qui doit rester sur l'accueil (en-tête et menu, bouton WhatsApp, bandeau
  cookies, statistiques Google, surveillance des erreurs) ; demander à la propriétaire, une
  question à la fois, ce qu'on fait des autres blocs actuels (agenda, vidéo, mot du fondateur,
  Instagram, partenaires) — par exemple en faire des pages du magazine.
  Respecter `CONVENTIONS.md` : couleurs et polices dans `css/jetons.css` (nouveau bloc), pas de
  `<style>` ni de `style="…"` dans les pages, un fichier CSS dédié, CSP (`scripts/verifier-csp.py`),
  `scripts/versionner.py`, tests visiteur (ajouter un test de l'accueil magazine).
- [ ] **Étape 2 — Habillage des autres pages publiques (FR + EN, boutique comprise)** : fond beige,
  Big Shoulders Display + Work Sans, boutons rouges. Les couleurs de base se changent dans
  `css/jetons.css` et sont branchées sur le site public par `css/charte-ma2m.css` (le tableau de
  bord et `/admin` ne chargent pas cette feuille).
- [ ] **Étape 3 — Pages « Mannequins » (book) et fiche d'un mannequin** dans le même esprit
  magazine (à proposer en maquette avant).

## Où on en est (20/10/2026, fin de session)

**Étape 1 construite sur la branche `claude/charming-faraday-liokxb`, PAS encore mise en ligne
(rien n'a été fusionné dans `main`).** Ce qui est fait :
- `index.html` et `en/index.html` : la porte d'entrée et les anciennes sections sont remplacées
  par `<main id="magazine">` : pages `<article class="mag-page">` sœurs, toutes « collantes »
  (sticky) au même endroit, la suivante monte par-dessus. Pages : couverture (= mannequin à la
  une : ids `vedette-*`), sommaire (`data-sommaire`), édito, mot de Maître Akesse
  (`#mot-responsable`, cachée si vide), les visages (`#medaillons-accueil`, 6 derniers
  mannequins), agenda (`data-agenda-accueil`, cachée si vide), l'agence, partenaires
  (`#ils-nous-font-confiance`), Instagram (`#flux-instagram`), dos « Casting ouvert ». La vidéo
  d'accueil reste sous le magazine. Intro animée, en-tête, bande défilante, pied de page gardés.
- `css/magazine-accueil.css` (mise en page, tailles en `cqw` avec minimum lisible),
  `js/magazine-accueil.js` (numéros de page, sommaire, mois), jetons `--mag-…` dans
  `css/jetons.css`, polices Big Shoulders Display + Work Sans ajoutées au lien Google Fonts des
  deux accueils.
- `js/accueil.js` : porte d'entrée et carrousel retirés ; `chargerPhotosMagazine` (photos au
  hasard pour `img[data-photo-aleatoire]`) ; les pages se montrent en retirant `u-hidden`.
  `js/accueil-debut.js` : plus de verrou de défilement (plus de porte).
- Tests : nouveau `scripts/tests-visiteur/test-accueil-magazine.js` (ajouté à `lancer.sh`) —
  **passe entièrement** ; `test-lisibilite-photos.js` adapté à la couverture — **passe** (avec
  `PAGES=index.html,en/index.html`) ; `test-affichage-stable.js` adapté. Les photos d'essai de ce
  test (`medias/photo-sombre.jpg`, `-rayures`, `-claire`, `-blanche`) ne sont pas dans le dépôt :
  les refaire (900×1200 : sombre, rayures noir/blanc de 20 px, beige clair, blanc).
- `versionner.py` et `verifier-csp.py` passés.

**À faire ensuite, dans l'ordre :**
1. Batterie `bash scripts/tests-visiteur/lancer.sh` lancée en fin de session : tout est passé
   jusqu'à `test-affichage-stable.js`, qui échoue sur l'accueil (« au retour, le visiteur revoit le
   même endroit » : le texte vu au milieu de l'écran est vide, sans doute parce que le repère
   `closest('.medaillon-carte, section, article, footer')` tombe sur une page de la pile ou sur
   rien) ; `lancer.sh` s'arrête au premier échec, donc les tests suivants n'ont PAS tourné.
   → CORRIGÉ : c'était l'intro du logo (7 s) qui couvrait l'écran pendant la mesure ; le test la
   marque comme déjà vue (comme les autres tests). Ensuite : relancer toute la batterie et corriger
   ce qui casse (en particulier `test-visuel.js`, `test-visiteur.js`,
   `test-pages-publiques.js`, `test-video-accueil.js` qui connaissaient l'ancien accueil).
2. Relecture `/code-review` du changement, puis montrer le rendu à la propriétaire.
3. Avec son accord écrit : mise en ligne (fusion dans `main`), vérification du site en ligne,
   SonarQube.
4. **Étape 2 — demande de la propriétaire à la fin de la session : « tu changes tout au style du
   nouveau style 3 »** : TOUTES les pages publiques FR + EN (et la boutique) prennent l'habillage
   Magazine 3 (fond beige, Big Shoulders Display + Work Sans, rouge MA2M, pages/cartes façon
   magazine). Passer par `css/charte-ma2m.css` (site public seulement), jamais par le tableau de
   bord ni `/admin`.

## Journal

- 20/10/2026 : choix du Magazine 3 ; maquette rangée dans `maquettes/accueil-magazine.html`.
  Rien n'a encore été changé sur le site en ligne.
