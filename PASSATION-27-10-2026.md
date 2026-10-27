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
Reste à faire :
1. Ajouter `test-contraste-applis.js` à la liste de `scripts/tests-visiteur/lancer.sh`.
2. Dans `test-app-mannequin.js`, faire contrôler la lisibilité à chaque écran
   (`lirePageEntiere` de `lisibilite.js`, dans la fonction `capture`).
3. Ajouter `/css/applis-rouge-mat.css` à la liste INTERFACE de `app/sw.js` (hors connexion)
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
- 27/10 : **vidéo v3 écrite** : `outils/video-installation/film3.html` (68 s ; WhatsApp → barre rouge →
  iPhone : aide « 3 touches » réelle (iphone-guide.png) puis Partager / Sur l'écran d'accueil / Ajouter ;
  Android : captures RÉELLES de la propriétaire (android-*-reel*.png) ; Ensuite ; fin). Fabrication :
  `IMAGES=<dossier> node outils/video-installation/rendu3.js` puis
  `ffmpeg -framerate 30 -i <dossier>/f%05d.jpg -stream_loop 1 -i outils/video-installation/musique-32.wav -filter_complex "[0:v]scale=720:1280[v];[1:a]atrim=0:68,volume=0.4,afade=t=in:d=1,afade=t=out:st=65:d=3[a]" -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -crf 25 -preset slow -movflags +faststart -c:a aac -b:a 96k -shortest video.mp4`.
  Les écrans de l'application y sont DÉJÀ en rouge mat (chantier 1) : le dire à la propriétaire.
