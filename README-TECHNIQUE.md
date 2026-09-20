# README-TECHNIQUE.md — Maître Akesse Model Management (MA2M)

Documentation pour tout développeur (humain ou IA) qui reprendrait ce
projet.

## Vue d'ensemble

Site statique (HTML / CSS / JavaScript, aucun framework, aucune étape de
build) pour une agence de mannequins à Abidjan. Aucun serveur applicatif :
Supabase joue le rôle de backend (base de données PostgreSQL,
authentification, stockage de fichiers), appelé directement depuis le
navigateur.

- **Hébergement** : Vercel, déployé automatiquement depuis GitHub (dépôt
  `MA2M2026/site-maitre-akesse`). Le propriétaire du site n'est pas
  développeur : il pousse les fichiers modifiés directement sur GitHub
  (interface web, pas de ligne de commande) et Vercel redéploie tout seul.
  **Ne jamais proposer de repasser au dépôt-par-zip sur Vercel** — c'était
  l'ancienne méthode, abandonnée.
- **Backend** : Supabase (projet `dfhghgmwmxiguhtxtsle`)
- **E-mails automatiques** : deux systèmes distincts, pour deux usages différents —
  ne jamais les confondre ni essayer d'en supprimer un au profit de l'autre :
  - **EmailJS** (`js/emailjs-config.js`) : notifie l'agence quand un visiteur
    remplit un formulaire (candidature, contact...). Site → agence.
  - **Resend**, branché comme fournisseur SMTP personnalisé dans Supabase
    (Authentication → Emails → SMTP Settings) : envoie les e-mails
    d'authentification de Supabase lui-même (réinitialisation de mot de passe,
    pour les mannequins comme pour l'admin). Sans lui, Supabase utilise son
    service gratuit interne, limité à quelques e-mails/heure pour tout le
    site — largement insuffisant, déjà rencontré en production. Le domaine
    `maitreakessemodelmanagement.com` est vérifié côté Resend (DKIM/SPF/DMARC,
    enregistrements DNS ajoutés chez Spaceship). Les adresses
    `.../tableau-de-bord.html` et `.../espace-mannequin.html` (en version
    normale ET en version "www.") doivent rester dans Supabase →
    Authentication → URL Configuration → Redirect URLs, sinon le lien de
    réinitialisation renvoie vers la page d'accueil au lieu du bon écran.
- **Domaine** : maitreakessemodelmanagement.com (DNS via Spaceship)
- **Analytics** : Google Analytics (gtag.js, ID `G-1BX5MPZ6WE`), installé à
  l'identique sur les 14 pages réelles du site. Google Search Console est
  aussi vérifié (fichier `google5acb001b6b29c80f.html` à la racine — ne
  jamais le supprimer, c'est la preuve de propriété du site) et le
  sitemap (`sitemap.xml`) y est soumis.

## Avant toute modification

1. Lire `SECURITY.md` en entier. Les règles qui y figurent ne sont pas
   optionnelles.
2. Toute modification touchant les droits d'accès (qui peut voir/modifier
   quoi) doit passer par une policy RLS dans `supabase-extension.sql`, pas
   uniquement par une condition JavaScript.
3. Ne jamais modifier `supabase-setup.sql` rétroactivement — ce fichier
   représente l'état initial. Toute évolution se fait en ajoutant une
   nouvelle "Extension N" à la fin de `supabase-extension.sql`, numérotée
   à la suite des précédentes, avec un commentaire expliquant son but.
4. **Le propriétaire du site n'est pas technique et n'a accès qu'à un
   téléphone.** Formuler les instructions de déploiement étape par étape,
   en évitant tout jargon non expliqué. Toujours préciser clairement :
   quel(s) fichier(s) remplacer, s'il y a du SQL à exécuter et dans quel
   ordre (le SQL passe toujours par Supabase → SQL Editor, indépendamment
   du dépôt des fichiers sur GitHub).
5. Avant d'affirmer qu'un correctif fonctionne, le vérifier en conditions
   réelles quand c'est possible (rendu live via un navigateur, pas
   seulement une relecture du code) — voir l'historique de ce projet : des
   bugs bloquants (inscriptions de mannequins impossibles) ont déjà été
   introduits par du code jamais vérifié en conditions réelles.

## Structure des fichiers

```
index.html                       Page d'accueil
services.html                     Présentation des services + valeurs
mannequins.html                    "The Book" — répertoire des mannequins
mannequin.html                      Fiche publique d'un mannequin (+ génération Compcard PDF)
actualites.html                      Actualités de l'agence (+ admin)
partenaires.html                      "Nos partenaires" (+ admin)
candidature.html                       Candidature casting (photos compressées, jamais publiées)
inscription-mannequin.html              Page d'inscription (redirige en pratique vers espace-mannequin.html)
espace-mannequin.html                    Espace personnel du mannequin (connexion, inscription par
                                           code d'invitation, mode guidé pour la 1ère publication,
                                           gestion du profil/projets/photos)
selection.html                            Sélection recruteur (localStorage + envoi par e-mail)
contact.html                               Formulaire de contact (enregistré en base)
tableau-de-bord.html                        Admin : statistiques, listes, modération, journal d'erreurs
mentions-legales.html / politique-confidentialite.html   Pages légales
google5acb001b6b29c80f.html                  Fichier de vérification Google Search Console — ne pas toucher

evenements.html                    "Nos Événements" — albums photo par événement (+ admin)
outils/carte-visite.html / qr-generateur.html / scannez-moi.html   Outils internes agence (cartes de visite, QR codes)

en/                                Version anglaise de chaque page publique (structure identique,
                                     PAS de version EN pour tableau-de-bord.html / espace-mannequin.html)

css/style.css                     Toutes les feuilles de style du site (fichier unique, ~1800 lignes)

js/app.js                          Fonctions partagées (voir plus bas), surveillance globale des
                                     erreurs, verrou de défilement (menu/modales), filet retour arrière
js/menu.js                          Ouverture/fermeture du menu plein écran
js/accueil.js / accueil-en.js         Logique de la page d'accueil (porte d'entrée, carrousel hero,
                                        mannequin à la une, mot du fondateur, stats...)
js/mannequins.js / mannequins-en.js     Logique de "The Book" (filtres, sélection recruteur)
js/actualites.js                    Logique de la page Actualités (admin publication/édition inclus)
js/selection.js                      Logique de la page selection.html
js/indicatifs-pays.js                 Liste des indicatifs téléphoniques (formulaires)
js/analytics-config.js               Initialise Google Analytics (dataLayer/gtag)
js/copyright-annee.js                 Remplit l'année du copyright dans le pied de page
js/supabase-config.js                 Connexion au projet Supabase (clé publique)
js/emailjs-config.js                   Connexion EmailJS (clé publique)

supabase-setup.sql                Schéma initial (tables, RLS de base) — ne jamais modifier
supabase-extension.sql              Toutes les évolutions, par "Extension N" numérotées et commentées
                                      — c'est ici qu'il faut regarder pour comprendre l'état actuel
                                      exact de la base (dernière extension = état le plus récent)

vercel.json                       En-têtes de sécurité HTTP (CSP, HSTS...) — inclut désormais les
                                    domaines Google Analytics dans le CSP
manifest.json / service-worker.js   PWA (installation sur écran d'accueil)
sitemap.xml / robots.txt             Référencement
assets/ , icons/                      Logos et icônes
```

## Fonctions JavaScript partagées à connaître

Définies dans `js/app.js`, chargées sur (presque) chaque page :

- **`echapperHtml(texte)`** — à utiliser systématiquement avant d'insérer
  une donnée saisie par un utilisateur dans le HTML, y compris dans un
  attribut (`src="${echapperHtml(url)}"`). Ne jamais insérer de donnée
  utilisateur brute dans un `innerHTML`.
- **`nomFichierSur(nom)`** — nettoie un nom de fichier avant de l'utiliser
  dans un chemin de stockage Supabase.
- **`ouvrirGalerieLightbox(urls, indexDepart)`** — ouvre le plein écran
  photo partagé (avec balayage tactile), réutilisé sur toutes les pages
  qui affichent des photos.
- **`convertirSiHeic(fichier)`** — convertit une photo iPhone (HEIC) en
  JPEG avant l'envoi, quand nécessaire (dupliquée dans plusieurs pages).
- **Surveillance globale des erreurs** (IIFE en tête de fichier) — capte
  silencieusement toute erreur JavaScript réelle (`error` et
  `unhandledrejection`) survenue chez un visiteur et l'enregistre dans la
  table `journal_erreurs` (voir plus bas). Ne capte **pas** les erreurs
  Supabase renvoyées normalement (`const { error } = await sb.from(...)`),
  seulement les exceptions non interceptées — pour ces erreurs "métier",
  chaque écran doit afficher lui-même un message clair incluant
  `error.message`.

⚠️ **Piège récurrent** : `js/supabase-config.js` définit
`const sb = (...) ? supabase.createClient(...) : null;` — si le CDN
Supabase ne charge pas (connexion mobile capricieuse), `sb` vaut `null`.
Tout code qui appelle `sb.xxx` sans avoir vérifié `if (!sb) return;` avant
provoque une exception non gérée. Plusieurs bugs de ce type ont déjà été
trouvés et corrigés dans ce projet — toujours vérifier ce garde-fou avant
d'ajouter un nouvel appel `sb.` en haut d'un script.

## Déploiement

1. Faire les modifications nécessaires aux fichiers concernés.
2. S'il y a des changements de base de données, les ajouter comme une
   nouvelle "Extension N" à la fin de `supabase-extension.sql`.
3. Donner au propriétaire du site, dans l'ordre où il doit les exécuter :
   - le SQL (à coller dans Supabase → SQL Editor → Run) — **toujours en
     premier**, c'est l'habitude prise ;
   - puis le(s) fichier(s) modifiés, à remplacer sur le dépôt GitHub
     `MA2M2026/site-maitre-akesse` (il les dépose via l'interface web de
     GitHub, pas en ligne de commande).
4. Vercel redéploie automatiquement dès que GitHub reçoit les fichiers —
   aucune action manuelle supplémentaire n'est nécessaire côté Vercel.
5. Toujours préciser explicitement le nombre exact de fichiers envoyés et
   ce qu'ils remplacent : le propriétaire du site tient une comptabilité
   stricte de ce qu'il a déployé et le vérifie à chaque fois.

### Méthode actuelle quand l'assistant IA a accès à git/GitHub (depuis fin
### septembre 2026) — à préférer à la méthode manuelle ci-dessus

Le propriétaire du site reste non-technique et ne passe jamais par la ligne
de commande — mais quand l'assistant IA a lui-même accès à git et à
l'API GitHub (`$GITHUB_TOKEN`), la méthode retenue avec lui est :

1. Toujours synchroniser sur `origin/main` d'abord, puis créer **une
   branche isolée par correctif/fonctionnalité** (jamais commiter
   directement sur `main`, jamais empiler plusieurs sujets différents sur
   la même branche/PR) — il tient à pouvoir tester et valider chaque
   changement indépendamment des autres.
2. Committer avec un message clair expliquant le POURQUOI (pas juste le
   quoi), pousser la branche, ouvrir une Pull Request via l'API GitHub.
3. **Vérifier le diff réel de la PR** (`GET /pulls/{n}/files`) — ne jamais
   se fier uniquement au message de commit.
4. Attendre/vérifier que le déploiement Vercel de la PR (preview) réussit
   (`GET /commits/{sha}/status`), puis donner au propriétaire le lien de la
   PR **et** le lien direct de l'aperçu Vercel (`https://<projet>-git-
   <branche>-<org>.vercel.app`, retrouvable dans les commentaires du bot
   Vercel sur la PR) pour qu'il teste avant de merger.
5. **C'est lui qui merge**, depuis l'interface GitHub — l'assistant ne
   merge jamais lui-même.
6. Après confirmation du merge, `git fetch`/`git merge --ff-only
   origin/main` pour resynchroniser la copie locale, et **vérifier
   concrètement** que le fichier mergé contient bien le changement
   (`git show origin/main:<fichier> | grep <repère>`), pas seulement se
   fier au message de fusion GitHub.

**Piège récurrent à connaître** : un lien d'aperçu Vercel de PR (`*-git-
<branche>-*.vercel.app`) reste **figé sur le dernier commit de cette
branche au moment du merge** — il ne se met JAMAIS à jour avec des
correctifs mergés séparément après coup, même sur `main`. Si le
propriétaire du site reteste sur un vieux lien d'aperçu après avoir dit
qu'un bug persiste, vérifier d'abord si ce lien correspond bien à la
dernière version de `main`, ou lui redonner le lien de production
(`maitreakessemodelmanagement.com`) pour un test fiable.

## Mode guidé pour les nouveaux mannequins

Colonne `model_profiles.premiere_publication_faite` (Extension 43). Tant
qu'une personne n'a jamais publié son profil avec succès une première
fois, seul le bouton final "Enregistrer mon profil" (bloc 5,
`form-publication`) est visible — les boutons d'enregistrement autonomes
des blocs 1 et 3 restent cachés, pour forcer à tout remplir en une fois
avant la première publication. Une fois la première publication réussie,
ces boutons réapparaissent définitivement (`appliquerModeGuide()` dans
`espace-mannequin.html`). Les blocs "Mes réalisations" (projets) et "Mes
photos" restent, eux, toujours autonomes (ajout/suppression possibles à
tout moment, même en mode guidé) — **il faut ajouter au moins un projet et
une photo avant de pouvoir publier**, la validation finale du bloc 5 le
vérifie.

## "New Face" et types de projet

Dans "Mes réalisations" (`espace-mannequin.html`), le champ "Type de projet"
inclut une option **"New Face"** destinée aux mannequins qui n'ont encore
aucune expérience réelle (défilé, shoot, pub, casting) — sans elle, un
débutant n'aurait aucun moyen de satisfaire l'exigence "au moins un projet"
requise pour publier son profil. Choisir "New Face" fait disparaître les
champs annexes (nom du projet, période, pays, ville, promoteur), qui n'ont
pas de sens dans ce cas. Une option "Autre" existe aussi, avec un champ
libre, pour tout type de projet non prévu dans la liste fixe.

## Mot de passe oublié (mannequins ET admin)

Implémenté à l'identique sur `tableau-de-bord.html` (écran de connexion
admin) et `espace-mannequin.html` (écran de connexion mannequin) :
`sb.auth.resetPasswordForEmail()` envoie le lien, et
`sb.auth.onAuthStateChange()` écoute l'événement `PASSWORD_RECOVERY` pour
afficher l'écran "nouveau mot de passe" sur la même page (pas de page dédiée
séparée). Un drapeau (`recuperationMdpEnCours` / `recuperationMdpEnCoursMannequin`)
empêche la reconnexion automatique habituelle (session déjà active) de
court-circuiter cet écran pendant qu'une récupération est en cours — sans
lui, l'ordre d'exécution entre les deux traitements asynchrones n'est pas
garanti. Dépend entièrement du SMTP personnalisé Resend (voir plus haut) et
des Redirect URLs Supabase correctement configurées.

## Miniatures des photos (consommation Supabase)

Le plan gratuit Supabase limite le "Cached Egress" (bande passante servie
aux visiteurs) à 5 Go/mois, renouvelés chaque mois — contrairement au
stockage réel des photos (1 Go), qui lui ne se remet jamais à zéro. Le book
public (`mannequins.html`) et la galerie de chaque fiche (`mannequin.html`)
affichaient jusqu'ici les photos en pleine résolution même en petite
vignette, ce qui a fait dépasser cette limite (222% constaté un mois).

Solution mise en place en deux temps :

1. **Extension 45** : chaque photo uploadée génère désormais, à côté de
   l'originale, une miniature légère (`model_photos.url_miniature` /
   `chemin_miniature`, ~500px, JPEG qualité 0.75) stockée dans un
   sous-dossier `miniatures/` du même dossier utilisateur. Utilisée
   uniquement pour l'affichage en grille (book public, galerie de la fiche).
   Un outil admin dans `tableau-de-bord.html` ("🖼️ Miniatures des photos")
   permet de rattraper les photos déjà en ligne qui n'ont pas encore de
   miniature ; ce rattrapage peut lui-même échouer si le quota mensuel est
   déjà dépassé (télécharger l'originale pour la réduire consomme de la
   bande passante) — dans ce cas, attendre le renouvellement du cycle
   (visible dans Supabase → Usage) avant de relancer l'outil.

2. **`compresserPhotoOrigine()`** (`espace-mannequin.html`) : contrairement
   à ce qui avait été décidé initialement (photos du book jamais
   compressées, pour préserver la qualité Compcard), l'originale elle-même
   est désormais compressée modérément à l'envoi — 3000px de côté maximum,
   JPEG qualité 0.90, uniquement si le fichier dépasse 900 Ko. Ces réglages
   restent largement supérieurs à ce qu'il faut pour imprimer net à 400 DPI
   sur la plus grande case du Compcard (~2050px), donc aucune perte visible
   attendue, tout en réduisant nettement le poids de chaque photo (stockage
   ET bande passante). Ne s'applique qu'aux nouveaux envois — les photos
   déjà en ligne avant ce changement restent à leur poids d'origine (aucun
   rattrapage automatique prévu sur les originales, contrairement aux
   miniatures : modifier une originale déjà publiée est plus risqué qu'en
   ajouter une copie réduite à côté).

## Surveillance des erreurs réelles (alternative aux audits manuels)

Table `journal_erreurs` (Extension 44) + capture globale dans `js/app.js`
+ section "🔴 Erreurs réelles du site" dans `tableau-de-bord.html`.
Écriture ouverte à tout visiteur anonyme (comme pour les autres tables
d'analytics du site), lecture réservée aux admins. Le propriétaire du site
consulte cette section régulièrement plutôt que de demander un audit
manuel complet à chaque doute — c'est la méthode retenue avec lui pour
détecter les bugs réels en production sans re-vérifier tout le code à
chaque fois.

## Ce qui a été audité pour la sécurité (état à ce jour)

Voir `SECURITY.md` pour le détail. En résumé : RLS activé et vérifié sur
toutes les tables, protection XSS systématique, statuts métier verrouillés
par triggers SQL, buckets de stockage restreints par type/taille de
fichier, en-têtes de sécurité HTTP en place, dépendances externes figées à
une version précise.

## Limites connues

Voir la section "Limites connues" de `SECURITY.md` — notamment l'absence
de vérification approfondie du contenu réel des fichiers uploadés (au-delà
du type déclaré), qui demanderait une fonction serveur supplémentaire non
mise en place à ce jour.

## Porte d'entrée / verrou de scroll (accueil et superpositions du site)

`index.html`/`en/index.html` bloquent le scroll tant que le bouton "Entrer"
n'a pas été cliqué, pour forcer l'utilisateur à voir l'écran d'accueil avant
de naviguer. Le même mécanisme verrouille aussi le menu plein écran, les
fiches actualité/partenaire, la galerie photo, et les modales/tiroir du
tableau de bord.

**⚠️ Piège déjà rencontré, ne pas répéter** : `overflow: hidden` sur
`body`/`html` (ancienne méthode, retirée) **ne bloque PAS le défilement
tactile sur iOS Safari** — limitation connue et documentée d'iOS, pas un bug
ponctuel. Un visiteur pouvait faire défiler la page À TRAVERS la porte
d'entrée sans jamais cliquer "Entrer", ce qui cassait tout le mécanisme
(sessionStorage jamais posé, la porte revenait sans cesse). Découvert et
corrigé fin septembre 2026 après plusieurs itérations infructueuses avec
`overflow:hidden`.

**Méthode actuelle, seule fiable sur tous les appareils** : figer la page en
`position:fixed` à sa position de scroll exacte (`document.body.style.top =
'-' + scrollY + 'px'`), restaurée à l'identique au déverrouillage — plus un
blocage direct du geste tactile (`touchmove`, `preventDefault()`) en
seconde ligne de défense pour les navigateurs/WebViews embarqués les plus
récalcitrants. Fonctions partagées `window.verrouillerDefilement()` /
`window.deverrouillerDefilement()` (avec compteur, pour empiler plusieurs
verrous sans conflit) :

- Définies **au tout début de `<body>`** dans `index.html`/`en/index.html`
  (avant tout le reste de la page) — **et non dans `js/app.js`**, qui
  charge trop tard (fin de page). Un deuxième bug a été trouvé pour cette
  raison précise : sur une connexion lente ou avec un visiteur rapide, le
  temps que `js/app.js` charge, l'utilisateur pouvait déjà faire défiler
  avant que le verrou ne s'active, et se retrouvait bloqué au milieu de la
  page au lieu du haut. Toute page avec un élément à verrouiller **dès le
  chargement** (pas juste au clic d'un bouton) doit définir/activer le
  verrou le plus tôt possible dans `<body>`, jamais compter sur `js/app.js`.
- `js/app.js` ne redéfinit ces fonctions **que si elles n'existent pas déjà**
  (`if (!window.verrouillerDefilement) (function(){...})();`) — pour toutes
  les autres pages (qui n'ont besoin du verrou qu'au clic d'un bouton, donc
  sans le même problème de timing). Ne jamais retirer ce garde-fou : sans
  lui, une redéfinition écraserait un verrou déjà posé et le laisserait
  bloqué en permanence (compteur désynchronisé).
- Zones avec leur propre défilement interne légitime (à ne jamais bloquer) :
  `.menu-overlay, .news-modal-contenu, .modal-overlay, .tdb-menu-panel,
  .projets-liste-scroll` — liste vérifiée via `e.target.closest(...)` dans
  le blocage tactile.

**Règle de sécurité impérative, toujours valable** : le verrou doit
TOUJOURS pouvoir se libérer tout seul, même si Supabase ne répond jamais
(connexion coupée, quota dépassé, etc.). Le clic sur "Entrer" attend au
maximum 4 secondes (`Promise.race` avec un `setTimeout`) le chargement du
mannequin à la une, puis débloque la page dans tous les cas. Ne jamais
retirer ce filet de sécurité.

## `100vh` à bannir — toujours utiliser `100dvh`

Plusieurs bugs de ce projet (bandeau d'annonce qui dépassait de l'écran
verrouillé, grand vide noir après rotation d'écran sur tablette/mobile,
piste probable d'un blocage au scroll signalé par le client) viennent tous
de la même cause : `100vh` ne suit pas la barre d'outils dynamique des
navigateurs mobiles (elle apparaît/disparaît pendant le scroll), donc la
hauteur réelle visible change sans que `100vh` se mette à jour. **Toujours
utiliser `100dvh`** (avec un repli `100vh` juste avant, pour les très
vieux navigateurs) pour toute hauteur pleine page — jamais `100vh` seul,
et jamais de solution en JavaScript (`--vh` recalculé sur un listener
`resize`), qui peut elle-même provoquer une boucle resize↔scroll sur
mobile. `100dvh` est natif, se recalcule sans JS, donc sans ce risque.

## Fond de page en photo — tenté puis abandonné (ne pas refaire à l'identique)

Une tentative d'utiliser une photo comme fond de page globale (au lieu du
dégradé + texture bruit actuel) a été testée puis annulée à la demande du
client. Deux causes techniques ont empêché que ça fonctionne, à connaître
avant de retenter l'expérience :

1. **Les sections de contenu recouvrent le fond du `body`.** La quasi-
   totalité des sections (`.fond-noir`/`.fond-anthracite`, la porte
   d'entrée, le pied de page...) ont leur propre fond opaque — le fond du
   `body` n'est donc jamais visible derrière, sauf dans de rares zones sans
   fond propre. Rendre ces fonds semi-transparents (`rgba(...)` à ~86%
   d'opacité) résout ce point sans nuire à la lisibilité du texte.
2. **`background-size: cover` sur `body` se calcule sur la page entière,
   pas sur l'écran, dès que `background-attachment` n'est pas `fixed`.**
   Sur mobile, `background-attachment: fixed` a volontairement été
   désactivé (coûteux au scroll sur Safari iOS), ce qui repasse en
   `scroll` — et dans ce mode, `cover` dimensionne l'image sur la hauteur
   totale du document (potentiellement plusieurs milliers de pixels), pas
   sur le viewport. Résultat : l'image apparaît écrasée/quasi invisible
   sur mobile, même après avoir réglé le point 1.

   La bonne approche pour une prochaine tentative n'est **pas**
   `background-image` sur `body`, mais un pseudo-élément dédié :
   `body::before { position: fixed; inset: 0; z-index: -1;
   background-image: url(...); background-size: cover; }` — un élément
   `position: fixed` se dimensionne nativement sur le viewport (jamais sur
   le document), et les navigateurs mobiles le composent bien plus
   efficacement qu'un `background-attachment: fixed` classique, donc pas
   besoin non plus de désactiver quoi que ce soit sur mobile.

## Durcissement CSP page par page (chantier en cours)

`vercel.json` pose un en-tête CSP global qui inclut `'unsafe-inline'` (pour
ne casser aucune page pas encore migrée). L'objectif à terme est de retirer
`'unsafe-inline'` **partout**, page par page, en isolé — jamais tout d'un
coup, le propriétaire du site veut pouvoir tester/valider chaque page
migrée indépendamment avant de passer à la suivante.

**Méthode** : chaque page migrée reçoit son propre
`<meta http-equiv="Content-Security-Policy" content="script-src 'self'
https://cdn.jsdelivr.net https://www.googletagmanager.com 'sha256-...';
style-src 'self' https://fonts.googleapis.com https://cdn.jsdelivr.net;">`
dans `<head>` — additif au header global (intersection des deux, jamais un
remplacement), donc chaque migration reste isolée et réversible. Les scripts
`<script>` inline restants sur une page migrée (filet de sécurité "reveal",
JSON-LD) doivent avoir leur hash SHA-256 exact dans ce meta CSP — calculé en
Python : `hashlib.sha256(texte_exact_du_script.encode('utf-8')).digest()`
puis encodé en base64. Le texte à hasher est EXACTEMENT le contenu entre
`<script>` et `</script>`, espaces/retours à la ligne compris — toute
modification ultérieure de ce script change son hash et casse la page tant
que le meta CSP n'est pas mis à jour en conséquence.

Tous les `style=""` inline doivent être remplacés par une classe utilitaire
(voir section suivante) avant de retirer `'unsafe-inline'` de `style-src` —
sinon la mise en forme concernée disparaît silencieusement.

**⚠️ Piège déjà rencontré** : du JS qui génère du `style=""` via
`innerHTML`/template literal est LUI AUSSI bloqué par un CSP strict (alors
que `element.style.propriete = valeur` en JS classique ne l'est PAS) —
plusieurs bugs de ce type ont déjà été trouvés en migrant des pages
(bouton de sélection sur "The Book", message "Profils bientôt disponibles",
instructions d'installation PWA, intégration vidéo des actualités) : la
correction a toujours été de remplacer le style calculé par une classe CSS
togglée via `classList`.

**État à ce jour (fin septembre 2026)** — déjà migrées (plus
`'unsafe-inline'` du tout) : `index.html`, `mannequins.html`,
`mentions-legales.html`, `politique-confidentialite.html`, `services.html`,
`actualites.html` (FR uniquement) + leurs équivalents `en/` sauf
`en/actualites.html`. Pas encore migrées : `candidature.html`,
`contact.html`, `en/actualites.html`, `espace-mannequin.html`,
`evenements.html`, `inscription-mannequin.html`, `mannequin.html`,
`partenaires.html`, `selection.html`, `tableau-de-bord.html` + leurs
équivalents `en/` — prévues en dernier pour `tableau-de-bord.html` et
`espace-mannequin.html`, les plus riches en JavaScript du site.

## Classes utilitaires CSS (`.u-*`)

Ajoutées au fil du durcissement CSP ci-dessus, pour remplacer les
`style=""` inline sans dupliquer de CSS : `.u-hidden`, `.u-tc`,
`.u-flex-center`, `.u-mt-*` / `.u-mb-*` / `.u-ml-*` / `.u-pt-*` / `.u-pb-*`
/ `.u-py-*` (espacements, suffixe = valeur en rem avec `-` pour la
décimale, ex. `.u-mt-1-5` = `margin-top: 1.5rem`), `.u-maxw-520` /
`.u-maxw-60ch` / `.u-maxw-60ch-texte`, `.u-texte-doux` / `.u-c-texte-doux`
/ `.u-texte-gris`, `.u-border-y-gris`, `.u-cta-row`, `.u-icone-partage` et
variantes `.u-ic-*`. Toutes définies en fin de `css/style.css`, section
"Classes utilitaires". Avant d'ajouter une nouvelle classe utilitaire,
vérifier qu'une existante ne convient pas déjà — l'objectif est d'éviter
la prolifération de variantes quasi identiques.

## Nettoyage de code mort — méthode à respecter

Un audit de nettoyage (fin septembre 2026) a retiré du CSS/JS mort
confirmé (ancien système de menu mobile, ancien header, blocs "Hero
ancienne mise en page"/"Équipe" jamais utilisés, classes isolées jamais
référencées). **Ne jamais supprimer un sélecteur/une fonction en le
supposant inutilisé** — vérifier systématiquement par recherche exhaustive
sur TOUT le repo (`.html` ET `.js`, racine + `en/` + `outils/`), y compris
les classes ajoutées dynamiquement (`classList.add(...)`, `className =
...`) qui n'apparaîtront jamais dans un simple grep sur le HTML statique.

## Fonctionnalités majeures ajoutées récemment (repères pour s'orienter)

- **`evenements.html`** — "Nos Événements", albums photo par événement,
  admin de publication inclus (même schéma que les actualités/partenaires).
- **Refonte visuelle premium de "The Book"** (`mannequins.html`).
- **Éditeur de texte enrichi** (Quill) pour les champs
  commentaire/description des actualités, événements et partenaires — voir
  `creerEditeurRiche()`/`rendreContenuRiche()` dans `js/app.js`, qui gèrent
  aussi la conversion des anciens textes bruts déjà enregistrés.
- **Validation admin à deux facteurs (2FA)**, avec récupération par e-mail,
  pour l'accès à `tableau-de-bord.html`.
- **Refonte de la navigation du tableau de bord** en 3 blocs + menu mobile
  dédié (`.tdb-menu-panel`/`.tdb-menu-toggle`) — voir aussi la section
  verrou de défilement plus haut, ce tiroir en fait partie.
