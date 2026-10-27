# ➜ MISSION DE LA PROCHAINE CONVERSATION (à lire en premier) — chantier 3 : le site public

État au 27/10/2026 (nuit) : la vidéo est validée (chantier 2 fini) ; l'Administration et l'application
des mannequins sont EN LIGNE en rouge et blanc (chantier 1 fini, main c76a622). Reste le SITE PUBLIC.

Décisions de la propriétaire (ne pas les rediscuter) :
- **Uniquement deux couleurs de fond : rouge très mat #7C2128 et blanc.** Plus de beige, plus de noir.
  Rouge profond #5A141B autorisé pour ce qui doit ressortir (bouton choisi, carte importante, messages).
  L'écriture reste foncée (#1B1817) dans les blocs blancs et blanche sur le rouge (lisibilité).
- **Pas de superposition** : à la fin, le noir et le beige doivent être SUPPRIMÉS DÉFINITIVEMENT du code,
  pas cachés par une couche par-dessus.
- **Ne rien casser, ne rien supprimer d'autre que ces deux couleurs** (aucune page, aucune fonction,
  aucun texte, aucune photo, aucun réglage de sécurité).

Étapes, UNE À LA FOIS, en écrivant en français à la propriétaire (CLAUDE.md) :
1. **Ménage à la source** (sur une branche, rien en ligne) :
   - `css/jetons.css` (partagé site + applications) : remplacer les valeurs beiges (papier #F1ECE5,
     carte #F8F5F1, papier foncé #E6DFD6, lignes #D3C9BD, scène #CFC6BB, etc.) et noires (encre utilisée
     comme FOND, #1B1817 / #141110 / dégradés sombres) par le rouge #7C2128 / rouge profond #5A141B /
     blanc #FFFFFF / gris très clair #F2F2F2 ; garder l'encre #1B1817 seulement comme COULEUR D'ÉCRITURE.
   - Puis `css/style.css`, `css/magazine.css`, `css/admin-vivante.css`, `css/mannequin-app.css` et les
     autres feuilles (`grep -n "background" css/*.css`) : même règle pour chaque fond beige ou noir.
   - Reprendre dans ces fichiers ce que fait `css/applis-rouge-mat.css` (écriture claire sur le rouge,
     foncée dans les blocs blancs), puis **supprimer `css/applis-rouge-mat.css`**, ses `<link>` dans
     admin/index.html et app/*.html et ses entrées dans admin/sw.js et app/sw.js (changer leurs VERSION).
   - Garder les couleurs d'ÉTAT (vert « payé », orange « à payer », etc.) et les photos/vidéos telles quelles.
2. **Test gardien** `scripts/tests-visiteur/test-couleurs-autorisees.js` (ajouté à lancer.sh ET
   lancer-complet.sh, ce dernier est une copie locale ignorée par git) : parcourt les pages du site (FR+EN),
   de l'Administration et de l'application, échoue si un fond visible n'est ni rouge, ni rouge profond,
   ni blanc/gris très clair (exceptions : photos, vidéos, pastilles d'état, logos des partenaires).
3. **Vérifier que rien n'est cassé** : `node --check` des JS touchés, `python3 scripts/versionner.py`,
   `python3 scripts/verifier-csp.py`, `bash scripts/base-essai/lancer.sh`,
   `bash scripts/tests-visiteur/lancer-complet.sh` (≈ 1 h ; doit finir à 0 échec ; test-visuel.js,
   test-contraste-applis.js et test-app-mannequin.js contrôlent la lisibilité). Comparer avec avant :
   même nombre de pages, de parcours et de vérifications (aujourd'hui : 70 parcours, 3 405 vérifications).
   `git diff --stat` : seuls des fichiers CSS (+ liens/versions, tests, README) doivent changer.
4. **Captures à la propriétaire** (accueil FR/EN, Book, fiche mannequin, actualités, formulaires,
   Administration, application ; téléphone + ordinateur) et **attendre son accord**.
5. Puis : /code-review, README-TECHNIQUE.md (section « Couleurs »), UNE mise en ligne (main), vérifier en
   ligne, SonarCloud (notes au maximum), et mettre à jour CE fichier.

Repères : la propriétaire n'est pas technique, une seule chose à la fois, jamais de mise en ligne sans
son accord, jamais de suppression de photos de mannequins. Le site est sur Vercel (offre gratuite :
peu de mises en ligne par jour). Une autre conversation peut aussi pousser sur main : toujours
`git fetch origin main` et se mettre à jour avant d'envoyer.

---

# Passation du 27/10/2026 (session précédente bloquée jusqu'à dimanche)

Lire d'abord CLAUDE.md (français, une chose à la fois, tests visiteur, relecture, pas de mise en
ligne sans accord). Ce fichier est sur la branche `chantier-rouge-mat` (PAS sur main, rien n'est en ligne).

## ORDRE DÉCIDÉ PAR LA PROPRIÉTAIRE (27/10/2026, feu vert donné)
1. **D'abord la vidéo d'installation** (chantier 2 ci-dessous), jusqu'à ce qu'elle la valide.
2. **Ensuite les couleurs des deux applications** (chantier 1), captures → son accord → mise en ligne.
3. **Puis le site public** avec les mêmes couleurs (rouge très mat + blocs blancs), après son accord.
Tenir CE fichier à jour à chaque étape (la session peut s'arrêter à tout moment) et le pousser sur la branche.

## Chantier 1 — Couleurs des deux applications (EN COURS, pas en ligne)
Choix validé par la propriétaire : **fond rouge très mat #7C2128, blocs blancs, écriture noire dans
les blocs, blanche sur le rouge, SANS effet brillant** (elle a refusé l'essai brillant). D'abord
l'Administration + l'application des mannequins ; le site public PLUS TARD, après son accord.
Fait sur cette branche :
- `css/applis-rouge-mat.css` (nouveau, chargé en dernier par admin/index.html et app/*.html).
- `scripts/tests-visiteur/test-contraste-applis.js` (nouveau) : 67 pages de l'Administration,
  ordinateur + téléphone + menu ouvert, tous les textes lisibles → **passe** (0 texte pâle).
- Vérifié à part : l'application des mannequins, tous les écrans : 0 texte pâle.
Reste à faire (1 à 3 FAITS le 27/10 au soir) :
1. [FAIT] Ajouter `test-contraste-applis.js` à la liste de `scripts/tests-visiteur/lancer.sh`.
2. [FAIT] Dans `test-app-mannequin.js`, faire contrôler la lisibilité à chaque écran
   (`lirePageEntiere` de `lisibilite.js`, dans la fonction `capture`).
3. [FAIT, versions administration-v17 et mannequin-app-v6] Ajouter `/css/applis-rouge-mat.css` à la liste INTERFACE de `app/sw.js` (hors connexion)
   et vérifier la liste équivalente de l'Administration (service worker admin).
4. Logo : sur le rouge il est passé en blanc par filtre CSS (`.logo-portail, .ap-logo`) ;
   vérifier l'icône carrée de connexion (elle reste noire, c'est voulu).
5. Envoyer à la propriétaire des captures (Administration ordinateur + téléphone, application
   connexion/accueil/événements/paiements), attendre son accord.
6. Puis : versionner.py, verifier-csp.py, batterie complète `lancer-complet.sh`, /code-review,
   README-TECHNIQUE.md, une seule mise en ligne (fusion sur main), vérification en ligne, SonarCloud.

## Chantier 2 — Vidéo « Installer l'appli » (EN COURS)
Sources : `outils/video-installation/` (film2.html = animation, `window.rendre(t)` ; rendu2.js
= images 1080×1920 à 30 i/s dans frames/ ; puis ffmpeg en 720×1280, musique-32.wav en boucle).
Elle suit le message WhatsApp de la propriétaire (lien https://mannequin.maitreakessemodelmanagement.com,
tutoiement, iPhone puis Android, « Ensuite », « Pas de panique… 💪 »). Version actuelle : 81 s.
Demandes de la propriétaire pour la prochaine version :
- **Fond rouge mat** (#7C2128 retenu pour les applis ; vérifier avec elle pour la vidéo), numéros
  d'étape en rond blanc.
- **Commencer dans WhatsApp** : on touche le lien dans la conversation (on ne tape pas l'adresse).
  Android (ses captures) : la page s'ouvre dans l'onglet de WhatsApp/Chrome, barre rouge
  « Télécharger l'application » en bas → on la touche → fenêtre « Installer l'application »
  (MA2M Mannequin, Annuler / Installer) → « Installer ». iPhone : le lien s'ouvre dans Safari, barre
  rouge en bas → on la touche → fenêtre d'aide du site « Installer en 3 touches » (Partager →
  « Sur l'écran d'accueil » → « Ajouter ») ; capturer cette vraie fenêtre (guideIOS dans js/app.js,
  agent utilisateur iPhone).
- **Motion design plus poussé** (elle a donné 7/10) : plus rythmé, plus dynamique, compréhensible par
  des ados. Version légère 720p pour WhatsApp (pas besoin de HD).

## En attente de réponse de la propriétaire
- Révision automatique du site chaque lundi à 8h (heure d'Abidjan) : proposée, pas encore confirmée.

## Rappels déjà programmés
- 16/11 : retirer les renvois temporaires des anciennes pages mannequin (vercel.json, test-app-mannequin.js, README).

## Journal de la reprise (à compléter au fur et à mesure)
- 27/10 : passation écrite, branche poussée. Début de la vidéo v3 (fond rouge mat, départ WhatsApp).
- 27/10 : **vidéo v3 VALIDÉE par la propriétaire (« top, rien à dire »)**, fichier final : outils/video-installation/Installer-application-MA2M-v3.mp4 (à envoyer aux mannequins APRÈS la mise en ligne des couleurs rouge mat des applications). Chantier 2 TERMINÉ. : `outils/video-installation/film3.html` (68 s ; WhatsApp → barre rouge →
  iPhone : aide « 3 touches » réelle (iphone-guide.png) puis Partager / Sur l'écran d'accueil / Ajouter ;
  Android : captures RÉELLES de la propriétaire (android-*-reel*.png) ; Ensuite ; fin). Fabrication :
  `IMAGES=<dossier> node outils/video-installation/rendu3.js` puis
  `ffmpeg -framerate 30 -i <dossier>/f%05d.jpg -stream_loop 2 -i outils/video-installation/musique-32.wav -filter_complex "[0:v]scale=720:1280[v];[1:a]atrim=0:68,volume=0.4,afade=t=in:d=1,afade=t=out:st=65:d=3[a]" -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -crf 25 -preset slow -movflags +faststart -c:a aac -b:a 96k -shortest video.mp4`.
  Les écrans de l'application y sont DÉJÀ en rouge mat (chantier 1) : le dire à la propriétaire.
- 27/10 : chantier 1, étapes 1 à 3 faites (tests de lisibilité dans la batterie, copies hors connexion). Prochaine étape : captures à la propriétaire.
- 27/10 (soir) : la propriétaire a précisé : **UNIQUEMENT rouge et blanc** (plus de beige, plus de noir).
  Fait dans css/applis-rouge-mat.css (fonds beiges → blanc / gris très clair #F2F2F2 ; fonds noirs → rouge
  profond #5A141B ; écran de connexion de l'Administration rouge + blanc). L'écriture des blocs blancs reste
  foncée (lisibilité). Contrôles de lisibilité : tout passe. Accord de mise en ligne donné → batterie complète,
  puis mise en ligne (fusion de la branche sur main, sans PASSATION ni outils/ : exclus par .vercelignore).
- Pour le SITE public (chantier 3, plus tard) : même règle rouge très mat #7C2128 + blanc, rouge profond
  #5A141B pour ce qui ressort ; s'inspirer de css/applis-rouge-mat.css (variables) et vérifier avec
  scripts/tests-visiteur/test-visuel.js (contraste de 34 pages) ; captures à la propriétaire AVANT toute mise en ligne.
- **IMPORTANT, demande de la propriétaire (27/10)** : PAS de superposition de couleurs à long terme.
  `css/applis-rouge-mat.css` est une couche posée par-dessus les anciennes couleurs (beige/noir) : au
  chantier du site, PREMIÈRE ÉTAPE = changer les couleurs À LA SOURCE (css/jetons.css, partagé site +
  applis ; puis css/admin-vivante.css et css/mannequin-app.css), supprimer les anciennes valeurs beige/noir
  et SUPPRIMER `css/applis-rouge-mat.css` (et ses <link> dans admin/index.html et app/*.html, ses entrées
  dans admin/sw.js et app/sw.js). Une seule définition des couleurs pour tout. Garder les tests de lisibilité.
- **Gardien promis à la propriétaire (27/10)** : lors du ménage à la source, écrire un test
  `scripts/tests-visiteur/test-couleurs-autorisees.js` (dans lancer.sh et lancer-complet.sh) qui parcourt
  toutes les pages des deux applications (et du site après son passage en rouge) et ÉCHOUE si un fond
  visible n'est ni rouge (#7C2128, #5A141B et leurs transparences), ni blanc/gris très clair (#FFFFFF,
  #F2F2F2), hors photos, vidéos, pastilles d'état (vert/orange) et boutons rouges du site. Elle craint
  qu'une mauvaise manipulation (humaine ou IA) mélange les couleurs : ce test doit l'empêcher.
- 27/10 (nuit) : **CHANTIER 1 EN LIGNE** (main 99cd051 puis c76a622) : Administration + application
  des mannequins en rouge et blanc. Batterie complète : 70 parcours, 3 405 vérifications, 0 échec.
  Vérifié en ligne (fond #7C2128, aucune erreur). SonarCloud : outils/ exclu (.sonarcloud.properties),
  notes revenues au maximum (0 bug, 0 faille). La vidéo peut maintenant être envoyée aux mannequins.
  **PROCHAIN CHANTIER : le site public** (voir plus haut : ménage des couleurs À LA SOURCE d'abord,
  test gardien des couleurs autorisées, captures à la propriétaire, son accord, puis mise en ligne).
