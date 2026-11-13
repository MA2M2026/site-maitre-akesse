# Guide de fabrication des vidéos MA2M (modèle validé par la propriétaire, 13/11/2026)

**À suivre pour TOUTE nouvelle vidéo** (présentation d'une mannequin, teaser, annonce, événement…), et à pousser
encore plus loin en dynamisme. Modèles de référence, validés par la propriétaire (« j'adore tes vidéos ») :

- **`film-alicia.html`** : la grande vidéo « Alicia Kouadio — La juste mesure ». Motion design de luxe : une histoire
  racontée en 23 scènes, chaque phrase de la voix illustrée.
- **`film-teaser-v1.html`** : le teaser, façon bande-annonce de film de mode. C'est la version gardée par la
  propriétaire : mystère, fragments, lumière qui monte, silence, révélation du nom, signature.

On écrit en français à la propriétaire, une chose à la fois, sans jargon (voir `CLAUDE.md`).

---

## 1. La méthode, étape par étape

1. **Le texte de la voix d'abord.** Proposer une histoire et la faire valider avant toute image.
   - Le ton doit **valoriser** la mannequin, jamais la rabaisser (première version refusée : « on lui a dit que les
     podiums appartenaient aux plus grandes… »).
   - Partir de ses forces (« 1,69 m, la juste mesure »).
   - N'utiliser que des faits vrais : sa fiche du site, ses propres mots, ce que dit la propriétaire. Ne jamais
     inventer de biographie.
   - Donner ensuite à la propriétaire le texte avec les **indications de ton ElevenLabs v3** à coller, par exemple
     `[softly]`, `[pause]`, `[rising, inspired]`, `[slow, elegant]` (en anglais : ElevenLabs ne lit que ça).
2. **La voix : c'est la propriétaire qui la crée** sur ElevenLabs (voix « Victoria – Content Creator » pour Alicia,
   « Nicolas » pour l'agence), puis elle envoie le fichier `.mp3`. Elle peut aussi modifier le texte : on suit TOUJOURS
   le texte entendu dans son fichier final.
3. **Caler chaque mot.**
   - Écrire le texte entendu dans `voix-<nom>.json`, une scène par clé : `[["cle", "phrase…"], …]`.
   - Lancer `python3 aligner-voix.py <voix.mp3> <dossier> voix-<nom>.json`. On obtient `mots.json`, avec l'instant de
     chaque mot et 1,2 s de silence d'ouverture.
   - Les nombres collés (« 1m69 ») sont mal entendus : corriger leurs instants à la main dans `mots.json`, en
     s'aidant de `entendu.json`.
4. **Les photos.**
   - Prendre le book de la fiche publique : table `model_photos`, colonne `url` en lecture publique.
   - Les réduire à 1 600 px au plus et les ranger dans `outils/video-talons/<nom>/p00…p13.jpg`.
   - Détourer les photos en pied avec **rembg** (`isnet-general-use`), vers `<nom>/d-*.png`. Vérifier le résultat sur
     fond sombre avant de s'en servir.
   - **Jamais** de mineur·e à l'image, jamais KAPO Ainhoa ni AKASSOU.
5. **La compcard officielle** : la télécharger depuis la fiche publique avec Playwright (menu `#btn-compcard`, puis
   `#btn-telecharger-jpeg`).
6. **La musique et les effets, avec ElevenLabs.** La clé est injectée par le proxy : envoyer `xi-api-key: x`.
   - Musique : `POST /v1/music` avec un `composition_plan` découpé en sections (durée de 3 s au moins chacune), calé
     sur la voix.
   - Silence avant une révélation : le creuser soi-même avec un `volume=…:eval=frame` de ffmpeg (voir
     `alicia/musique-teaser.wav`).
   - Effets : `POST /v1/sound-generation`, rangés en `sons/a-<nom>.mp3`.
7. **Le film.**
   - Copier `film-alicia.html` (récit animé) ou `film-teaser-v1.html` (bande-annonce) vers `film-<nom>.html`, puis
     réécrire les scènes.
   - Le **contrat** lu par `fabrique-talons.js` :
     - `window.rendre(t)` dessine l'image exacte de l'instant `t` ;
     - `window.EFFETS` liste les effets sonores : `[{t, son: 'a-…', vol}]` ;
     - `window.MANQUES` liste les mots introuvables, et doit rester vide ;
     - `window.PRET` est une promesse qui attend que toutes les images soient chargées ET décodées ;
     - les scènes se calent sur les mots avec `w('cle', 'mot')`.
8. **Les images d'essai, AVANT le long rendu.**
   - Créer le minutage : `FILM=film-<nom>.html VOIX=<dossier> IMAGES=<dossier> node fabrique-talons.js vertical --minutage`.
   - Prendre des images d'essai : `node apercu.js film-<nom>.html vertical <dossier> 3.5 11.9 …`, puis faire la même
     chose en `large`.
   - Les regarder en planche (ImageMagick `montage`) et corriger : cadrages, textes qui débordent, photos cachées.
9. **Le rendu**, une fois pour chaque format, dans un **dossier d'images NEUF** :
   - commande : `FILM=… NOM=… SONS=1 HD=1 VOIX=… MUSIQUE=… IMAGES=<dossier neuf> node fabrique-talons.js vertical` ;
   - puis la même avec `large` à la place de `vertical` ;
   - assemblage final : `bash assembler.sh <dossier> <sortie>.mp4 1080:1920`, et `1920:1080` pour YouTube.
10. **Vérifier avant d'envoyer** :
    - la durée : le son va jusqu'au bout ;
    - le volume, autour de -13 LUFS (`ffmpeg -af ebur128`) ;
    - quelques images extraites ;
    - une réécoute par faster-whisper des passages modifiés.
11. **La livraison.**
    - Envoyer **les 4 vidéos directement**, sans zip, nommées par réseau : teaser vertical, teaser YouTube, grande
      vidéo verticale, grande vidéo YouTube.
    - Pour regarder tout de suite, envoyer en plus un aperçu léger (720p) de chaque vidéo, en précisant que ces
      aperçus ne sont pas à publier.
    - Limite d'envoi : 400 Mo par fichier.
    - Fournir aussi les **textes des publications** (Facebook, Instagram, TikTok, YouTube) et les rappels de qualité
      à l'import : TikTok « haute qualité », Instagram « qualité maximale », Facebook « HD ».
    - Pas de 4K : la propriétaire la juge inutile, la HD suffit.

## 2. La direction artistique attendue

**Pour tous les films :**
- **Luxe, jamais « PowerPoint »** : pas de photos carrées qui se posent l'une après l'autre. Chaque élément cité
  doit être illustré par une vraie animation, avec de belles transitions et des effets sonores. Il faut que ça fasse
  « waouh ».
- **Palette** : noir profond, or champagne `#D8B878`, ivoire `#F5EEE3`. Polices **Cormorant Garamond** (titres,
  italiques) et **Work Sans** (petites capitales espacées). Le logo à utiliser sur fond sombre est
  `assets/logo-intro.png`.

**Pour la grande vidéo (`film-alicia.html`), des idées qui ont plu :**
- fente de lumière qui s'ouvre ;
- halo doré ;
- nom en lettres remplies de photo ;
- **toise dorée** qui monte jusqu'à sa taille ;
- croquis de mode qui se dessine puis devient la photo ;
- triptyque qui se déplie ;
- podium en perspective avec lumières qui défilent ;
- iris d'objectif ;
- viseur de caméra (REC, mise au point) ;
- noir et blanc qui passe en couleur avec un éclat d'or ;
- mots géants remplis de photos ;
- icônes dessinées au trait ;
- lamelles qui glissent ;
- cartes des métiers en 3D (couverture de magazine, planche-contact, affiche) ;
- porte de lumière avec signature manuscrite ;
- compcard animée (compteurs des mesures) ;
- mur de cadres qui se retournent ;
- carte de fin « Réservez Alicia » avec le WhatsApp de l'agence.

Les autres éléments de la grande vidéo :
- sous-titres discrets mot à mot, placés au-dessus de la zone des boutons de TikTok ;
- poussière d'or ;
- grain ;
- fin cadre doré.

**Pour le teaser (`film-teaser-v1.html`)**, d'après le scénario de la propriétaire :
- cinématique, sobre, sombre, bandes de cinéma en horizontal ;
- au début, le **noir s'efface lentement** jusqu'à voir son visage ;
- puis des fragments : le regard dans une fente, la silhouette en ombre bordée de lumière, un mouvement ;
- la lumière monte ;
- **silence**, puis la **révélation du nom** ;
- signature : « New Face », puis le logo, puis les réseaux un par un ;
- textes à l'écran réduits à l'essentiel, aucun effet gadget, silences de la voix respectés.

**Les décisions de la propriétaire (à respecter) :**
- **pas l'âge** des mannequins : ni dans la voix, ni à l'écran, ni dans les textes ;
- pas de photo en maillot dans le teaser ;
- la taille reste un atout, jamais une excuse.

## 3. Les pièges déjà rencontrés (à éviter)

- **Ne pas lier `moteur-film.css` à un nouveau film.** Ses classes `.abs` (z-index 6), `.carte`, `.trait` et
  `.etiquette` cachent des photos derrière les fonds. Les films d'Alicia ont leurs propres styles.
- Les images doivent être **préchargées et décodées** (`window.PRET`). Sinon, les premières images de chaque photo
  sortent vides.
- `mask-image: url(...)` est refusé en `file://` (CORS). Ne pas l'utiliser.
- Le son de `fabrique-talons.js` se terminait 3 s trop tôt. C'est corrigé (`apad` + `atrim`), mais vérifier quand
  même la durée finale.
- Ne jamais `rm -rf $VARIABLE` (refusé par la sécurité) : prendre un nouveau dossier, ou un chemin écrit en entier.
- `pgrep -f` dans une boucle d'attente se trouve lui-même : utiliser `pgrep -x node`.
- Couper un mot dans une voix (l'âge, par exemple) : mesurer les silences (RMS par tranches de 40 ms), couper entre
  deux silences avec `atrim` et `acrossfade=d=0.02`, puis réaligner.

## 4. Fichiers de référence

| Fichier | Rôle |
| --- | --- |
| `film-alicia.html` | grande vidéo, modèle « récit animé » (23 scènes) |
| `film-teaser-v1.html` | teaser gardé, modèle « bande-annonce » |
| `film-teaser-alicia.html` | variante du teaser (plus sombre, sans maillot), non retenue |
| `carrousel-alicia.html` | carrousel Instagram et Facebook 1080 × 1350 (`?n=1…8`) |
| `fabrique-talons.js` | rendu image par image et piste son (`HD=1`, `SONS=1`, `ECHELLE=2` pour la 4K) |
| `aligner-voix.py` | instant de chaque mot de la voix |
| `apercu.js` | images d'essai |
| `assembler.sh` | MP4 final de haute qualité |
| `voix-alicia.json`, `voix-teaser.json` | textes calés des deux voix |
| `alicia/` | photos, détourages, compcard, musiques |
| `sons/a-*.mp3` | effets sonores ElevenLabs |
