# Rapport de l'agent 2 — Mission MA2M du 15/11/2026

Angle principal : **le parcours d'une candidate** (jeune femme de 19 ans, Android moyen, 4G instable), **les images
sur téléphone**, **le responsive**. Site en ligne audité (version `665f03d`), lecture seule : toutes les écritures
(Supabase, `/api/`, EmailJS, Google Apps Script) bloquées ou **imitées dans le navigateur** (`route.fulfill`) —
rien n'est parti vers l'agence. Rapport écrit après une interruption (limite d'utilisation) : il reprend ce qui a été
mesuré ; les points non vérifiés sont signalés comme tels.

Méthode : Playwright (Chromium), Android 412×915 + 1,6 Mbit/s, 150 ms, processeur ×4 ; iPhone 390×844 ; tablette
800×1200 ; ordinateur 1440×900 ; FR et EN. Octets réels mesurés par le protocole du navigateur (CDP), car l'API
`performance` compte à 0 les photos du domaine `photos.` (pas d'en-tête `Timing-Allow-Origin`). Scripts et captures :
dossier `scratchpad/mission/agent-2/` (hors dépôt) : `mesures.js`, `octets.js`, `parcours.js`, `envoi-simule.js`,
`sous-doigt.js`, `captures/`.

Non fait faute de temps : Lighthouse, SSL Labs / Observatory / SonarCloud (laissés aux autres agents), audit de
sécurité approfondi du serveur, application mannequin et administration (pas d'accès réel).

## 1. Résumé exécutif

Le parcours candidate est **sérieusement construit** (étapes, résumé modifiable, brouillon, photos préparées dès le
choix, reprise d'un envoi coupé, jauges, anti-robots) et fonctionne en FR comme en EN. Mais sur **Android**, au moment
le plus important, **le bouton flottant « Appli MA2M » recouvre la moitié droite de « Envoyer ma candidature »** : un
appui à cet endroit n'envoie rien. Le formulaire **accepte n'importe quel fichier comme photo** (PDF, HEIC illisible)
et **n'importe quel fichier comme vidéo**, et garde un PNG de 13 Mo tel quel pour l'envoi. Côté confiance, la page
« Intégrer l'agence » annonce 9 mois d'Académie **sans jamais parler de coût**, alors que des mensualités existent.
Images : fiches et Book bien optimisés (WebP, tailles adaptées) ; **Actualités et Événements envoient des JPEG jusqu'à
515 Ko** pour une vignette de 371×464.

| Gravité | Nombre |
|---|---|
| Critique | 0 |
| Haute | 4 |
| Moyenne | 9 |
| Basse | 7 |

## 2. Points forts (vérifiés : comportement réel + code)

1. **Formulaire en 4 étapes + résumé « Changer »** (`js/candidature-etapes.js`) : chaque étape vérifiée avant de
   passer ; message clair « L'agence accepte les candidatures à partir de 14 ans » (date 2015 testée) ; tailles
   proposées adaptées (femme : 175 à 210 cm).
2. **Brouillon automatique** (`js/brouillon.js`) : après rechargement en plein envoi, nom/ville/mesures restaurés,
   bandeau honnête « Les photos et la vidéo sont à ajouter à nouveau ».
3. **Photos préparées dès le choix** (`preparerPhotosEnvoi`, `js/app.js:3010`) : JPEG 4000×6000 de 12 Mo → 0,17 Mo
   en 1,5 s sur Android ralenti ; données GPS retirées (`sansDonneesCachees`).
4. **Vidéo trop longue refusée tout de suite** (3 min 20 → « Vidéo trop longue (3 min 20) : 3 minutes maximum »).
5. **Envoi réussi (serveur imité)** : jauge par photo, puis vidéo, puis « Merci ! Votre candidature a bien été
   envoyée » ; envoi en 5 s pour 4 photos + vidéo 0,25 Mo.
6. **Reprise d'un envoi coupé** (`EnvoiFiable`, `js/app.js:3029`) : dossier gardé dans le téléphone, verrou d'onglet.
7. **Fiches mannequin et Book** : WebP, version « moyenne » 1120×1400 pour un affichage 412 px ×2,6 (adapté),
   grande photo en `fetchpriority=high`, vignettes `lazy` ; LCP fiche 1,9 s en 4G lente, CLS 0,02.
8. **Accueil sans écran noir** : image de couverture affichée dès ~1 s (capture à 1 s), complète à 3,9 s en 4G lente.
9. **Aucun débordement horizontal** sur les 6 pages × 4 appareils mesurés ; EN complet (liens de l'accueil EN vers
   `/en/integrer-agence`).
10. **Cache** : JS/CSS versionnés `max-age=31536000, immutable` ; photos servies par Cloudflare (`cf-cache-status: HIT`).

## 3. Points faibles et bugs

### A2-01 — Haute — « Appli MA2M » recouvre « Envoyer ma candidature » (Android)
- **Où** : `/integrer-agence` (et sans doute `/candidature`, `/cours-talons`), résumé, bouton `#btn-envoyer`.
- **Preuve** : Android 412×915, bouton défilé en bas d'écran (y=783) ; `elementFromPoint` au centre du bouton =
  `IMG` dans `.ma2m-installer-ouvrir` (bandeau fixe 178,795, 222×46). Un appui tactile au centre **n'envoie rien**
  (0 requête). Capture `captures/sous-doigt-android.png`. Sur iPhone et tablette : pas de recouvrement (bandeau absent
  ou bouton ailleurs). La bulle WhatsApp et la flèche « haut de page » recouvrent aussi « ← Retour ». Déjà signalé
  le 08/11 (`docs/visitor-report.md`, faiblesse 5 : « jamais sur un formulaire ») : **toujours présent**.
- **Cause** : le bandeau d'installation (`ma2m-installer--site`) et les boutons flottants ignorent les formulaires.
- **Conséquence** : la candidate croit avoir envoyé, ou ouvre l'installation de l'appli au lieu d'envoyer.
- **Solution** : ne pas afficher le bandeau d'installation ni la bulle WhatsApp sur les pages de formulaire (ou les
  cacher dès qu'un champ a le focus / dès l'étape 2) ; à défaut, marge basse réservée sous les boutons d'étape.
- **Régression** : faible (affichage seulement). **Vérifier** : `elementFromPoint` au centre de `#btn-envoyer` sur
  Android/iPhone, toutes positions de défilement ; ajouter ce contrôle à `scripts/tests-visiteur`.

### A2-02 — Haute — N'importe quel fichier accepté comme « photo »
- **Où** : `js/app.js:3004` `preparerPhotoEnvoi`, `js/formulaire-candidature.js:322`.
- **Preuve** : `document.pdf` + `faux.heic` (octets au hasard) choisis → « 2 photos sélectionnées », 2 vignettes
  cassées, aucun message. Avec 1 vraie photo de plus, le minimum (3) est atteint avec 2 fichiers inutilisables.
- **Cause** : un fichier non JPEG qui ne se décode pas est simplement recopié (`new File([...])`) au lieu d'être
  refusé ; `accept="image/*"` n'empêche pas « Fichiers » sur Android.
- **Conséquence** : dossier incomplet découvert seulement par l'agence ; un vrai HEIC d'iPhone ouvert sur Android
  (Chrome ne le décode pas) passe aussi sans prévenir.
- **Solution** : tenter le décodage (`createImageBitmap`/`Image`) ; s'il échoue, ranger le fichier dans
  `illisibles` (le message « choisissez-la à nouveau » existe déjà) ; refuser tout type non `image/*`.
- **Régression** : moyenne (bien tester HEIC sur iPhone réel). **Vérifier** : PDF, HEIC sur Chrome Android, JPEG,
  PNG, WebP → seuls les décodables comptent.

### A2-03 — Haute — Coût de la formation absent des pages de candidature
- **Où** : `integrer-agence.html` (« 9 mois à l'Académie… + 9 mois à l'agence »), `candidature.html`, EN.
- **Preuve** : aucune occurrence de « FCFA », « frais », « mensualité », « payant » dans ces pages ; or le système gère
  des **mensualités de formation** (`js/messages-mensualites.js:28`, `app/mes-paiements.html`).
- **Conséquence** : une candidate (ou son parent) découvre le coût après le casting : perte de confiance, image
  d'« agence qui fait payer », risque de réclamation. Les grandes agences affichent clairement « gratuit » ou le coût.
- **Solution (décision de la propriétaire)** : une ligne claire « Formation : X FCFA/mois pendant 9 mois » ou « coût
  annoncé au casting, aucun paiement demandé avant » + FAQ. **Vérifier** : relecture des pages FR/EN.

### A2-04 — Haute — Photo PNG/WebP lourde envoyée telle quelle, toutes les photos en UN seul envoi
- **Où** : `js/app.js:2968` `redimensionnerImage` (ne réduit que les JPEG) ; `envoyerPhotosVersDrive` (`js/app.js:3112`).
- **Preuve** : `capture.png` 1080×2400 de 13,1 Mo gardé à 13,11 Mo pour l'envoi (le JPEG de 12 Mo, lui, passe à
  0,17 Mo). Toutes les photos partent encodées en base64 (+37 %) dans **une seule** requête : ici ~18 Mo, soit plus de
  3 minutes à 0,75 Mbit/s montant, avec échec total à la moindre coupure (2 essais, puis « photos non envoyées »).
- **Solution** : réduire aussi PNG/WebP sans transparence en JPEG 1600 px (les captures d'écran n'en ont pas) ;
  envoyer les photos une par une (ou par 2) vers le programme Google pour qu'une coupure ne perde pas tout.
- **Régression** : moyenne (programme Google à adapter : un dossier par candidature, déjà géré pour la vidéo).
- **Vérifier** : PNG 13 Mo → < 0,5 Mo ; coupure réseau au milieu → seules les photos manquantes repartent.

### A2-05 — Moyenne — N'importe quel fichier accepté comme « vidéo »
- **Preuve** : `fausse.mp4` (200 Ko au hasard) → « ✓ Vidéo prête (0,2 Mo) » alors que la jauge reste à
  « Préparation de votre vidéo… 0 % ». **Cause** : `js/formulaire-candidature.js:203` ne vérifie que le type/nom ;
  si l'allègement échoue, l'original part (`:239`). **Solution** : exiger une durée lisible (`dureeVideo` ou
  `examinerVideo`) sinon message « vidéo illisible, choisissez-la à nouveau » ; cacher la jauge en cas d'échec.

### A2-06 — Moyenne — Messages d'erreur trompeurs à l'étape « Vous »
- **Preuve** : e-mail `awa.essai` → « Merci de compléter : E-mail. » (le champ est rempli, mais faux) ; téléphone
  `07 OO 12 34 56` (lettres O) → « Merci de compléter : le champ indiqué. » (le champ n'a pas de `<label>`, seulement
  `aria-label`). **Où** : `js/candidature-etapes.js` `valide()`. **Solution** : distinguer vide / invalide
  (`validity.valueMissing` vs `typeMismatch`/`patternMismatch`) : « Adresse e-mail incomplète (il manque @) »,
  « Numéro : chiffres seulement » ; lire `aria-label` si pas de label.

### A2-07 — Moyenne — Envoi impossible : message sans issue ni explication
- **Preuve** : réseau coupé (ou serveur injoignable) → « Erreur lors de l'envoi. Réessayez ou contactez-nous
  directement. » ; au retour du réseau rien ne repart, aucun lien de contact. Hors ligne, la candidate ne sait pas que
  c'est sa connexion. **Solution** : si `navigator.onLine === false` → « Pas de connexion internet : vos réponses sont
  gardées, réessayez dès que le réseau revient » + relance automatique à l'événement `online` ; ajouter un bouton
  WhatsApp de l'agence dans le message d'erreur.

### A2-08 — Moyenne — Double appui très rapide : deux candidatures possibles
- **Où** : `js/formulaire-candidature.js:570` (garde) et `:622` (bouton désactivé seulement APRÈS
  `await photosEnPreparation` et l'attente vidéo).
- **Preuve** : iPhone, réseau coupé, deux appuis rapprochés → **2 requêtes** `POST /api/portail` (28 451 et
  28 478 ms). Avec des appuis à 150 ms d'écart sur Android, une seule. Si les deux passent en ligne : deux dossiers
  (identifiants différents), photos et e-mail en double.
- **Solution** : désactiver le bouton (ou poser un drapeau `envoiEnCours`) en toute première ligne du gestionnaire,
  et le relâcher sur chaque `return` d'erreur. **Régression** : faible. **Vérifier** : deux `click()` synchrones →
  une seule requête.

### A2-09 — Moyenne — Images d'Actualités et d'Événements trop lourdes, en JPEG
- **Preuve** (octets réels, Android) : `/evenements` : JPEG **1706×2560, 504 Ko** affiché 371×464 ; 1365×2048 240 Ko ;
  1,5 Mo au premier écran, 1,75 Mo après défilement. `/actualites` : JPEG 1439×1144 421 Ko, 313 Ko… → **1,8 Mo
  d'images** après défilement (2,3 Mo au total). Pas de `srcset`, pas de WebP. En comparaison, la fiche mannequin
  utilise des WebP 38-123 Ko.
- **Cause** : les photos de publications (`/site/actualites/`, `/site/evenements/`) sont envoyées telles quelles, sans
  version réduite. **Solution** : même chaîne que les mannequins (versions 480/800/1400 px WebP à l'envoi + `srcset`),
  ou `/_vercel/image` déjà utilisé pour la photo du responsable. **Vérifier** : `octets.js` → < 600 Ko d'images.

### A2-10 — Moyenne — `/candidature` saute au chargement (CLS)
- **Preuve** : CLS 0,238 (Android), 0,278 (iPhone), **0,689 (tablette)**, 0,162 (ordinateur) ; seuil 0,1.
  LCP = un paragraphe (pas d'image). **Cause probable** : cartes des castings et barre d'étapes insérées après coup
  (`js/candidature-etapes.js`, `dessinerCastings` après l'événement `ma2m:castings`). **Solution** : réserver la
  hauteur (le bloc `ca-chargement` existe : lui donner la hauteur finale), ou écrire les cartes côté serveur
  (`page-donnees` contient déjà la liste). **Vérifier** : CLS < 0,1 sur les 4 appareils.

### A2-11 — Moyenne — Fiche mannequin : les boutons « Réserver / Compcard » couvrent le nom
- **Preuve** : capture Android à 2,5 s : la barre fixe « Réserver | ↓ Compcard » est posée sur « KOUADIO ALICIA »
  (planche `planche-fiche-form.png`). **Solution** : marge basse sous le bloc du nom égale à la hauteur de la barre,
  ou barre affichée seulement après défilement. (Non mesuré sur les autres fiches.)

### A2-12 — Moyenne — Aucune confirmation pour la candidate, aucun délai annoncé
- **Preuve** : écran final « Merci !… Notre équipe vous recontactera si votre profil est retenu. » ; l'e-mail
  (`envoyerNotificationEmail`) ne part qu'à l'agence. Pas de numéro de dossier, pas d'e-mail/WhatsApp de confirmation,
  pas de délai (« sous 15 jours »), et « si votre profil est retenu » laisse entendre un silence en cas de refus.
- **Solution (décision de la propriétaire)** : délai indicatif, numéro de dossier, e-mail de confirmation, et réponse
  aussi en cas de refus (pratique des grandes agences).

### A2-13 — Moyenne — Cibles tactiles trop petites
- **Preuve** : boutons « + » de The Book **32×28 px** (sélection), filtres Actualités 35 px de haut, liens de pied de
  page 37 px, « ← Nos mannequins » 15 px de haut, logo 92×28 ; 24 à 51 cibles < 44 px par page. Textes de 9,9 à
  11,5 px sur la fiche (« Taille », « Poitrine »). **Solution** : zone touchable ≥ 44×44 (padding), textes ≥ 12 px.

### A2-14 — Basse — Texte doublé « (connexion instable ?) »
- `js/formulaire-candidature.js:553` met déjà « (connexion instable ?) » dans `soucis`, et `:556` le rajoute :
  « …reviendrez sur cette page (connexion instable ?). » précédé de « (connexion instable ?) ». Observé (envoi imité où
  le rattachement de la vidéo échouait). Écran contradictoire : jauges toutes vertes « envoyée ✓ » + « l'envoi n'est
  pas terminé ».

### A2-15 — Basse — `else` mal rattaché après l'ajout de la vidéo
- `js/formulaire-candidature.js:519-520` : le `else { etat.videoFaite = true }` dépend de
  `erreurVideo && window.signalerErreur` ; si l'ajout échoue et que `signalerErreur` manque, la vidéo est notée
  « faite ». Solution : `if (erreurVideo) { signaler } else { videoFaite }`.

### A2-16 — Basse — Double point dans le message d'accord
- « Merci de compléter : J'ai pris connaissance de la politique de confidentialité.. » (FR et EN).

### A2-17 — Basse — Brouillon personnel gardé 7 jours sur l'appareil
- `js/brouillon.js` : nom, téléphone, e-mail, date de naissance et contacts du parent d'une mineure restent 7 jours
  en clair dans le navigateur (téléphones souvent partagés). Proposition : 48 h, et effacement proposé à l'écran final.

### A2-18 — Basse — Photos : cache navigateur de 4 h seulement
- `photos.maitreakessemodelmanagement.com` : `cache-control: max-age=14400` alors que les noms sont uniques
  (horodatés) : une visiteuse qui revient le lendemain retélécharge tout. Proposition : `max-age=31536000, immutable`
  (règle Cloudflare).

### A2-19 — Basse — Rechargement : retour à l'étape 1
- Après rechargement, les réponses reviennent mais l'affichage repart à l'étape 1 (4 « Suivant » à refaire).
  Proposition : rouvrir la première étape incomplète.

### A2-20 — Basse — Envoi des photos vers Google sans contrôle anti-robots
- Le programme Google (URL et clé dans `js/app.js`, donc publiques) accepte des envois sans jeton Turnstile : n'importe
  qui peut remplir le Drive de l'agence. À confirmer côté programme Google (non vu dans ce dépôt) ; proposition : jeton
  à usage unique délivré par `/api/portail` après l'enregistrement de la candidature.

## 4. UX/UI — regard de professionnelle

- **Donne envie** : accueil « magazine » fort (couverture, « Les nouveaux visages d'Abidjan »), critères clairs
  (1,75 m / 1,85 m, 14+ avec accord parental), deux parcours lisibles (« Je débute » / « Déjà mannequin »), programme
  mois par mois, formulaire guidé et rassurant.
- **Inquiète** : coût de l'Académie non dit (A2-03) ; pas de délai de réponse ni de réponse en cas de refus (A2-12) ;
  aucune mention « l'agence ne demande jamais d'argent pour un casting » (arnaques fréquentes) ; bandeaux flottants
  (cookies, WhatsApp, Appli) qui s'empilent sur un petit écran pendant qu'on remplit.
- **Manque par rapport aux grandes agences** (Elite, IMG…) : exemples de « polas » attendues (portrait, profil, pied,
  sans maquillage — l'agence le demande mais ne montre pas d'exemple), FAQ candidates, page « sécurité / mineures »,
  confirmation par e-mail.

## 5. Performance (Android, 1,6 Mbit/s, 150 ms, CPU ×4)

| Page | LCP | Image principale visible | CLS | Chargement complet | Octets 1er écran (réels) |
|---|---|---|---|---|---|
| / | 3,9 s | 3,9 s (aperçu dès ~1 s) | 0,007 | 7,3 s | 846 Ko (1,23 Mo après défilement) |
| /mannequins | 5,9 s | — (grille sous la ligne de flottaison) | 0,007 | 8,3 s | 785 Ko |
| /book/kouadio-alicia | 1,9 s | 1,9 s | 0,024 | 7,9 s | 1,34 Mo |
| /actualites | 2,6 s | 2,5 s | 0,038 | 9,0 s | 1,29 Mo (2,34 Mo après défilement) |
| /evenements | 2,9 s | 2,9 s | 0,029 | 9,6 s | 1,49 Mo |
| /integrer-agence | 2,2 s | 2,2 s | 0,002 | 10,6 s | 1,02 Mo (dont vidéo) |
| /candidature | 1,9 s (texte) | — | **0,238** | 9,6 s | 804 Ko |
| /en/ | 2,9 s | 2,9 s | 0,022 | 6,6 s | — |

Scripts : ~250 Ko par page (app.js 78 Ko + Supabase 55 Ko chargés partout), polices 130-210 Ko. iPhone/tablette/
ordinateur sans ralentissement : LCP 0,6 à 1,7 s, sauf `/mannequins` tablette 3,5 s.

## 6. Images et médias — synthèse
Mannequins (Book, fiche, accueil) : WebP, 3 tailles, `lazy` + `fetchpriority`, bon. Publications (actualités,
événements, partenaires de l'accueil 108 Ko JPEG) : JPEG d'origine, trop lourds (A2-09). Pas de fond noir observé :
les zones vides sont du rouge de la charte. Pas d'attributs `width/height` sur la plupart des `<img>` des photos (la
place est tenue par le CSS : CLS faible, sauf `/candidature`).

## 7. Responsive
0 débordement horizontal (6 pages × iPhone, Android, tablette, ordinateur). Problèmes : recouvrements par les
éléments fixes (A2-01, A2-11), cibles < 44 px (A2-13), CLS tablette `/candidature` 0,689.

## 8. Code et architecture (parcours candidate)
Formulaire partagé par 4 pages (bon, plus de copies). Logique répartie entre `formulaire-candidature.js` (envoi),
`candidature-etapes.js` (affichage, qui lit des variables globales `photosSelectionnees`, `videoChoisie`… : couplage
fort), `brouillon.js`, `app.js` (3 300+ lignes). Ordre d'envoi : candidature enregistrée AVANT les médias → dossier
sans photos possible (géré par la reprise et `photos_upload_echouees`). Bugs : A2-08, A2-14, A2-15.

## 9. Sécurité (constats limités)
Anti-robots Turnstile sur l'enregistrement (`/api/portail`) ; photos sans GPS ; CSP présente. Points : A2-20 (Drive),
A2-17 (données locales). Le reste (en-têtes, TLS, RLS) n'a pas été revérifié par cet agent.

## 10. SEO et accessibilité
Liens « Aller au contenu », `legend` lisibles par lecteur d'écran dans chaque étape, `role=alert` sur les messages.
Champ téléphone sans `<label>` visible (A2-06), petites cibles (A2-13).

## 11. Infrastructure
Vercel (pages, JS immuables), Cloudflare R2 (photos, HIT, 4 h navigateur : A2-18), Google Apps Script (médias des
candidatures), EmailJS (alerte agence). Observé : `app.js?v=6fd64a75` sur les fiches et `?v=d6df9e5d` sur les autres
pages au même moment (pages écrites par le serveur vs pages fixes) — à vérifier par l'équipe.

## 12. Risques
1. Candidatures perdues ou incomplètes sur Android (A2-01, A2-02, A2-04, A2-05).
2. Perte de confiance des familles (A2-03, A2-12).
3. Doublons de dossiers (A2-08).

## 13. Recommandations et priorités
| Priorité | IDs | Effort |
|---|---|---|
| 1 (avant tout) | A2-01 (bandeau sur les formulaires) | faible |
| 2 | A2-02, A2-05, A2-08 (fichiers et double appui) | faible à moyen |
| 3 | A2-04 (PNG + envoi photo par photo) | moyen |
| 4 (décision propriétaire) | A2-03, A2-12 (coût, confirmation, délai) | texte |
| 5 | A2-09, A2-10, A2-11, A2-07, A2-06 | moyen |
| 6 | A2-13 à A2-20 | faible |
