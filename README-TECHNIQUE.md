# README-TECHNIQUE.md — Maître Akesse Model Management (MA2M)

Documentation pour tout développeur (humain ou IA) qui reprendrait ce
projet.

**Pour la propriétaire du site : si tu n'arrives plus à te connecter à
cette session Claude Code (compte perdu, session expirée, etc.), tu peux
ouvrir Claude Code sur n'importe quel autre compte, lui donner accès à ce
même dépôt GitHub (`MA2M2026/site-maitre-akesse`) et lui demander de lire
ce fichier en entier avant de continuer.** Il contient tout ce dont un
nouvel assistant a besoin pour reprendre le travail sans rien perdre :
la liste de tous les services connectés au site (Supabase, Vercel,
Cloudflare R2, Resend, EmailJS, Google Analytics/Search Console, le
domaine chez Spaceship), la méthode de déploiement à suivre, les pièges
déjà rencontrés et corrigés (pour ne pas les refaire), et où se trouve
chaque fonctionnalité dans le code. Rien d'important n'est stocké
uniquement "dans la tête" de cette conversation — tout ce qui compte est
écrit ici, dans `SECURITY.md`, et dans les commentaires du code lui-même.
Ce fichier est mis à jour à chaque changement important : le relire en
cas de doute donne toujours l'état le plus récent.

## ⚠️ HISTORIQUE DU 27-28 SEPTEMBRE 2026 — architecture photos revue
## À LIRE avant de retoucher à R2, au domaine personnalisé ou à `vercel.json`

**Nouvelle architecture (28 septembre 2026, nuit) : les photos passent
maintenant par le domaine du site lui-même, plus jamais directement par un
domaine Cloudflare.** Après l'échec du domaine personnalisé R2 (incident
détaillé ci-dessous), plutôt que de re-tenter un nouveau sous-domaine, le
choix a été de faire de Vercel un relais : le navigateur du visiteur ne
contacte jamais R2 ni `r2.dev` directement, il contacte uniquement
`www.maitreakessemodelmanagement.com`, qui va lui-même chercher la photo
côté serveur.

- **`vercel.json`** : ajout d'une règle `rewrites` — toute requête vers
  `/book-photos/:path*` est transmise (proxy serveur-à-serveur, invisible
  pour le visiteur) vers
  `https://pub-bd96e72b6ed2444cab7b06f170bfe206.r2.dev/:path*`.
- **Pourquoi ça règle le bug mobile** : le problème d'origine
  (`ERR_CONNECTION_ABORTED` sur Android/iPhone) semble spécifique à la
  façon dont les navigateurs MOBILES contactent le domaine partagé
  `r2.dev`. En passant par Vercel (un serveur, pas un téléphone), c'est
  Vercel qui contacte `r2.dev` — jamais l'appareil du visiteur — donc ce
  problème ne peut plus se produire, quel que soit l'appareil ou le réseau
  du visiteur.
- **Avantage supplémentaire** : plus besoin d'un domaine personnalisé
  séparé, donc plus aucun risque de DNS/propagation comme celui rencontré
  cette nuit avec `photos.maitreakessemodelmanagement.com`. Pas de
  changement de CSP nécessaire non plus : les photos étant désormais
  servies par le même domaine que le site (`img-src 'self'`), l'ancienne
  règle CSP autorisant `*.r2.dev` reste seulement utile pour les mises en
  ligne (upload direct par URL signée), pas pour l'affichage.
- **`R2_PUBLIC_URL`** (Vercel, projet `site-maitre-akesse-kiw2`) doit
  valoir `https://www.maitreakessemodelmanagement.com/book-photos` — plus
  jamais une adresse `r2.dev` ni `photos.maitreakessemodelmanagement.com`
  directement.
- **Point à surveiller** : ce relais fait transiter le trafic des photos
  par le quota Vercel ("Fast Data Transfer", 100 Go/mois gratuits, 1 To
  sur le plan Pro à 20 $/mois). Vérifier périodiquement Vercel → Usage →
  "Transfert de données rapide". Le 28 septembre 2026, le site utilisait
  2,1 Go/100 Go avant même d'ajouter les photos — large marge, mais à
  re-vérifier si le nombre de mannequins ou de visites augmente fortement.

**Ce qui reste vrai de l'ancien diagnostic (voir aussi plus bas, section
"Photos du Book sur Cloudflare R2") :** le domaine partagé `r2.dev` en
lui-même n'est toujours pas fiable pour un accès DIRECT depuis un
navigateur (raison pour laquelle il ne faut jamais redonner cette adresse
brute à un visiteur) — mais il reste parfaitement utilisable comme
destination d'un appel serveur-à-serveur, ce que fait justement ce relais
Vercel.

**Chronologie de l'incident, pour comprendre le contexte :**
1. DNS du domaine migré de Spaceship vers Cloudflare, domaine personnalisé
   R2 connecté et affiché "Actif", variable Vercel `R2_PUBLIC_URL` et les
   276 lignes de `model_photos` basculées vers le nouveau domaine
   (Extension 90). Tout semblait correct côté configuration.
2. Le nouveau domaine `photos.maitreakessemodelmanagement.com` s'est mis à
   répondre `DNS_PROBE_FINISHED_NXDOMAIN` pour la propriétaire ET des tiers
   sans lien avec elle, sur wifi ET 4G, sur plusieurs appareils —
   **alors que dnschecker.org (sondes US, type A et CNAME) montrait une
   résolution mondiale normale, en vert, vers des IP Cloudflare
   classiques**. Contradiction jamais élucidée pendant cette session.
3. Peu après, le SITE PRINCIPAL (`www.maitreakessemodelmanagement.com`,
   qui ne passe pourtant pas par R2 ni par le domaine personnalisé — DNS
   uniquement chez Cloudflare, pointant vers Vercel) a présenté le même
   genre de symptôme pour au moins un utilisateur iPhone ("Safari n'a pas
   pu ouvrir la page car le serveur ne répondait plus"), avec le même
   paradoxe (dnschecker.org vert partout). La propriétaire, elle,
   gardait un accès normal au site — donc portée exacte de ce
   second symptôme non confirmée (un seul utilisateur rapporté, pas
   vérifié comme généralisé).
4. Pistes vérifiées et écartées pendant le diagnostic : DNSSEC désactivé
   à la fois chez Cloudflare et chez Spaceship (donc pas de conflit de
   clés DNSSEC) ; pas de VPN/filtre DNS côté utilisateurs concernés ; pas
   un problème de cache navigateur (testé en navigation privée) ; pas un
   problème de box/routeur (reproduit aussi en 4G, sur un réseau
   totalement différent).
5. Décision prise avec la propriétaire : revenir en arrière plutôt que de
   continuer à chercher en pleine nuit. Exécution de l'Extension 91
   (inverse de l'Extension 90, remet `r2.dev` dans `model_photos`) +
   remise de `R2_PUBLIC_URL` sur `r2.dev` sur Vercel (projet
   `site-maitre-akesse-kiw2`) + redéploiement. Confirmé fonctionnel par la
   propriétaire après coup.

**Pour la suite (prochain assistant, ou reprise plus tard) :**
- **Le domaine personnalisé R2 (`photos.maitreakessemodelmanagement.com`)
  n'est plus le plan retenu.** Il reste techniquement en place côté
  Cloudflare (rien supprimé), mais le site ne l'utilise plus du tout — la
  solution adoptée est le relais Vercel décrit plus haut, qui évite
  complètement le problème de fond (un nouveau nom de domaine à faire
  reconnaître mondialement). Ne pas y revenir sans raison précise.
- Si jamais le relais Vercel montrait à son tour un problème inattendu, la
  piste du domaine personnalisé reste documentée ici en dernier recours,
  avec la contradiction jamais élucidée à garder en tête : résolution
  mondiale confirmée OK (dnschecker) mais `NXDOMAIN` réel pour la
  propriétaire et des tiers en Côte d'Ivoire, y compris sur le site
  principal (indépendant de R2) au même moment — donc peut-être pas un
  problème spécifique à R2, plutôt un souci propre à la zone Cloudflare de
  ce compte à ce moment-là. Pistes déjà écartées : DNSSEC (désactivé des
  deux côtés), VPN/filtre, cache navigateur, box/routeur. À noter : les
  "domaines personnalisés R2" de Cloudflare ont un historique documenté de
  bugs discrets (ex. un bug HTTP/3 fin août/début septembre 2026, réglé le
  3 septembre — donc pas la cause directe de notre incident du 27-28, mais
  ça montre que cette fonctionnalité précise mérite prudence).
- **Décision de la propriétaire (28 septembre 2026) : on reste sur le
  relais Vercel, on ne retente pas le domaine personnalisé R2 pour
  l'instant.** Revoir cette décision seulement si le relais Vercel pose
  un problème réel (fiabilité ou coût de bande passante), pas par
  précaution préventive.
- L'Extension 90 (SQL, bascule vers l'ancien domaine personnalisé) et
  l'Extension 91 (retour à `r2.dev`) restent toutes les deux dans
  l'historique (`supabase-extension.sql`) à titre de référence, mais
  aucune des deux ne doit être ré-exécutée : la bonne adresse actuelle
  pour `model_photos` est désormais
  `https://www.maitreakessemodelmanagement.com/book-photos/...` (voir
  Extension 92).

## 🖼️ Photos des mannequins : cadrage validé (29 septembre 2026)

- **Ronds de l'accueil, vignettes du Book, photo ronde de la fiche** :
  `object-position: center top` : on garde le haut de la photo (le visage).
- **Couverture de la fiche** : plein cadre sur tous les écrans, haut de la
  photo gardé quand elle est plus étroite que le cadre (tablette, ordinateur).
  Dôme d'ombre qui monte du bas. L'essai « photo entière sur fond flou » a été
  refusé par la propriétaire : ne pas le remettre.
- **Vérifier qu'une mise en ligne est bien en Production** : sur Vercel →
  Deployments, la ligne du commit de `main` doit porter l'étiquette
  « Production ». Le 29/09, une fusion n'a produit qu'un « Aperçu » (limite
  quotidienne probable) : il a fallu une nouvelle fusion pour relancer.

## 📐 « Affichage qui saute » (29 septembre 2026)

- Actualités / Événements (FR/EN) : la hauteur du bloc « À la une » est réservée
  par la classe `.une-reservee` (css/style.css), posée dans le HTML et retirée par
  js/app.js dès que le bloc est rempli, que le message « Aucune… » s'affiche, ou
  après 12 s. Choix de la propriétaire : une règle comprise par TOUS les
  navigateurs, y compris anciens (remplace la version `:empty:not(:has(...))` du
  même jour, ignorée par les navigateurs d'avant 2023).
- Reste à traiter si la propriétaire le souhaite : le même défaut sur l'accueil,
  quand le « Mot de Maître Akesse » apparaît.

## 📝 À faire plus tard (demandé par la propriétaire — à lui rappeler)

- **Nettoyer les anciennes copies de photos sur Supabase Storage** (noté le 28
  septembre 2026). Les outils « Migration des photos vers R2 » du tableau de bord
  ont COPIÉ les photos vers Cloudflare R2 sans les effacer de Supabase. Vérifié le
  28/09 : « Aucune photo à migrer — tout est déjà sur R2 » pour le Book ET pour
  les images du site. Les copies Supabase ne servent donc plus (aucune bande
  passante consommée, seulement de la place de stockage). Idée validée avec la
  propriétaire, à faire quand elle le demandera : un bouton « Nettoyer les
  anciennes copies sur Supabase » dans le tableau de bord, qui supprime
  uniquement dans les buckets `model-photos`, `actualites-images`,
  `evenements-images`, `partenaires-logos` les fichiers qu'AUCUNE fiche ne
  référence plus — sans jamais toucher `casting-applications` ni
  `inscriptions-photos` (anciennes photos de dossiers encore affichées).
- **Rendre le code de validation admin (2FA) obligatoire côté serveur** — voir
  la section « Audit complet du 28 septembre 2026 » en bas de ce fichier.

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
- **Domaine** : maitreakessemodelmanagement.com — bureau d'enregistrement
  (registrar) : Spaceship. **DNS géré par Cloudflare depuis fin septembre
  2026** (nameservers Cloudflare configurés chez Spaceship ; les
  enregistrements DNS eux-mêmes se gèrent désormais dans Cloudflare, plus
  chez Spaceship), condition nécessaire pour connecter le domaine
  personnalisé R2 (`photos.maitreakessemodelmanagement.com`, voir plus
  bas). Tous les enregistrements existants (Vercel, Resend/e-mail) ont été
  reportés en mode "DNS uniquement" (non proxié) dans Cloudflare pour ne
  rien changer à leur comportement.
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
6. **Toute modification d'un script inline sur une page au CSP durci**
   (`index.html`/`en/index.html` notamment — repérable au commentaire
   d'avertissement juste avant le meta CSP) : lancer ensuite
   `python3 scripts/verifier-csp.py` avant de proposer le correctif comme
   fonctionnel. Sans ça, le script peut être bloqué en silence par le
   navigateur sans qu'aucune erreur ne le signale — voir la section
   "Porte d'entrée / verrou de scroll" plus bas pour l'incident qui a
   motivé ce garde-fou.

## Structure des fichiers

```
index.html                       Page d'accueil
services.html                     Présentation des services + valeurs
mannequins.html                    "The Book" — répertoire des mannequins
mannequin.html                      Fiche publique d'un mannequin (+ génération Compcard PDF)
actualites.html                      Actualités de l'agence (+ admin)
evenements.html                       "Nos Événements" — même architecture qu'actualites.html
                                        (bloc "à la une" + grille magazine + fiche modale avec
                                        galerie photo adaptative + admin), depuis fin septembre
                                        2026 — l'ancienne version (grille d'albums + page de
                                        détail séparée) a été entièrement remplacée à la demande
                                        du client, qui la trouvait moins belle qu'Actualités.
partenaires.html                      "Nos partenaires" (+ admin)
candidature.html                       Candidature casting (photos compressées, jamais publiées)
inscription-mannequin.html              Page d'inscription (redirige en pratique vers espace-mannequin.html)
espace-mannequin.html                    Espace personnel du mannequin (connexion, inscription par
                                           code d'invitation, mode guidé pour la 1ère publication,
                                           gestion du profil/projets/photos)
selection.html                            Sélection recruteur (localStorage + envoi par e-mail)
contact.html                               Formulaire de contact (enregistré en base)
tableau-de-bord.html                        Admin : statistiques, listes, modération, journal d'erreurs
reinitialiser-mot-de-passe.html            Page dédiée de "nouveau mot de passe" (lien reçu par e-mail)
mentions-legales.html / politique-confidentialite.html   Pages légales
google5acb001b6b29c80f.html                  Fichier de vérification Google Search Console — ne pas toucher

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
js/evenements.js                      Logique de la page Nos Événements (même schéma que
                                        js/actualites.js — champs date/lieu au lieu de
                                        catégorie/vidéo). Les versions en/ ont leur propre
                                        logique en script inline (comme en/actualites.html),
                                        pas ce fichier.
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
api/supprimer-mannequin.js          Fonction serveur Vercel (clé secrète Supabase) — supprime
                                      définitivement le compte de connexion d'un mannequin
api/r2-presigner.js                  Fonction serveur Vercel (clés R2) — URL signées pour
                                      envoyer/supprimer les photos du Book sur Cloudflare R2
api/creer-admin.js                  Fonction serveur Vercel (clé secrète Supabase) — crée un
                                      nouveau compte admin, réservé aux admins déjà connectés
package.json                     Dépendances npm des fonctions api/ (@aws-sdk/*) — Vercel les
                                   installe automatiquement, aucune étape manuelle
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
- **`construireHtmlCv(donnees)`** — gabarit du "Model CV" (icônes, libellés
  de compétences, regroupement des expériences par catégorie), partagé
  entre l'aperçu personnel du mannequin (`espace-mannequin.html`, bouton
  "Voir mon CV") et l'outil admin du tableau de bord ("📄 Voir le CV" sur
  chaque mannequin publié, dans "Mannequins publiés — gérer les photos").
  Prend un objet de données simple (voir commentaire au-dessus de la
  fonction dans `js/app.js`) — chaque page construit cet objet à partir de
  sa propre source (état local pour le mannequin, requêtes Supabase directes
  pour l'admin) et affiche le résultat dans son propre conteneur `.cv-sheet`
  (styles CSS dupliqués dans les deux pages, qui ont chacune leur propre
  système de variables CSS — voir plus bas, "Durcissement CSP page par
  page"). Téléchargement en PDF via l'impression du navigateur
  (`window.print()`), pas de génération PDF côté serveur.
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

### Deux clients Supabase : `sb` (lecture publique) et `sbAdmin` (admin) — piège déjà rencontré

`js/supabase-config.js` définit **deux** clients, pas un seul :

- **`sb`** — utilisé pour toutes les lectures publiques (afficher les
  actualités, événements, partenaires, profils...). Sur les pages qui ne
  définissent pas `window.MA2M_SESSION_REQUISE = true` avant de charger ce
  script (actualités, événements, partenaires — pages publiques avec un
  panneau admin caché), `sb` est créé avec `persistSession: false` : il
  **ignore volontairement** toute session déjà connectée dans le
  navigateur, pour qu'une session périmée laissée par une connexion
  précédente au tableau de bord ne fasse jamais échouer les lectures
  publiques d'un simple visiteur (401 systématique — bug réel déjà
  rencontré, voir plus bas "profils invisibles").
- **`sbAdmin`** — utilisé UNIQUEMENT pour détecter qu'un admin est déjà
  connecté (`verifierAdmin()`) et pour les actions d'écriture admin
  (publier/modifier/supprimer une actualité, un événement, un partenaire).
  Sur ces mêmes pages publiques, `sbAdmin` est un second client créé avec
  `persistSession: true` : lui seul relit la session déjà posée dans le
  `localStorage` par une connexion faite depuis `tableau-de-bord.html`
  (même origine, même clé de stockage par défaut). Sur les pages qui
  définissent déjà `MA2M_SESSION_REQUISE = true` (`tableau-de-bord.html`,
  `espace-mannequin.html`), `sbAdmin` vaut simplement `sb` (même client,
  pas de doublon) puisque `sb` y persiste déjà la session normalement.

**Piège déjà rencontré (fin septembre 2026)** : un correctif du bug des
"profils invisibles" (voir plus bas) avait fait passer `sb` en
`persistSession: false` sur `actualites.html`/`evenements.html`/
`partenaires.html` sans introduire `sbAdmin` en remplacement pour les
usages admin — résultat, `verifierAdmin()` (qui appelait encore `sb.auth.
getUser()`) ne retrouvait plus jamais aucune session, même pour un admin
réellement connecté depuis le tableau de bord : le panneau de publication
et les boutons Modifier/Supprimer disparaissaient totalement, sans aucune
erreur visible (le `catch (e) {}` de `verifierAdmin()` avale l'échec en
silence, par design, pour ne jamais planter la page pour un visiteur
normal). **Règle à retenir** : toute lecture/écriture qui a besoin de
savoir si l'utilisateur est l'admin, ou d'agir en tant qu'admin, doit
utiliser `sbAdmin` — jamais `sb` — sur une page qui n'a pas
`MA2M_SESSION_REQUISE`. Les lectures purement publiques (visibles par
n'importe quel visiteur) continuent, elles, d'utiliser `sb`.

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

## Variable d'environnement Vercel : `SUPABASE_SERVICE_ROLE_KEY`

Utilisée par `api/supprimer-mannequin.js`, ajoutée pour permettre à
l'agence de supprimer définitivement le profil ET le compte de connexion
d'un mannequin depuis le tableau de bord, par `api/r2-presigner.js`
(voir section suivante) pour vérifier qu'une demande d'envoi/suppression de
photo vient bien du mannequin propriétaire ou d'un admin, et par
`api/creer-admin.js` (bouton "Créer un compte admin", tableau de bord →
Bloc 3 → 3B — Sécurité & accès) pour créer un nouveau compte admin sans
passer par la manipulation manuelle dans Supabase (Authentication > Add
user, puis Table Editor > admins > Insert row) — réservé aux admins déjà
connectés (même contrôle que les deux fonctions précédentes), avec
annulation automatique du compte de connexion si l'ajout dans la table
`admins` échoue (jamais de compte orphelin sans rôle). Cette clé
**secrète** Supabase (jamais la clé publique déjà utilisée dans
`js/supabase-config.js`) ne doit jamais apparaître dans un fichier du
dépôt — elle se configure uniquement dans Vercel :

1. Sur Supabase : Project Settings → API → repérer la clé secrète /
   `service_role` (à ne jamais coller ailleurs que dans Vercel).
2. Sur Vercel : Project Settings → Environment Variables → ajouter
   `SUPABASE_SERVICE_ROLE_KEY` avec cette valeur, puis redéployer.

Sans cette variable, le bouton "🗑 Supprimer" du tableau de bord et l'envoi
de nouvelles photos échouent proprement (message d'erreur explicite), sans
jamais bloquer le reste du site.

## Photos du Book sur Cloudflare R2 (plus sur Supabase Storage)

Le plan gratuit Supabase limite la bande passante ("Cached Egress") à
5 Go/mois — dépassé deux fois (222%, puis 291%) à cause des photos du Book,
consultées en boucle par les visiteurs. Cloudflare R2 ne facture **aucune**
bande passante de sortie ; les photos du Book (bucket `model-photos` côté
DB, colonnes `model_photos.url` / `url_miniature` / `url_moyenne`
inchangées) y sont désormais envoyées à la place. Supabase reste utilisé
pour tout le reste (connexion, base de données) et pour les photos de
candidature/inscription (toujours vers Google Drive, sans rapport avec ce
quota — voir plus bas).

**Important — le quota n'était pas la seule cause des "profils invisibles" :**
deux bugs distincts, sans lien avec la bande passante, produisaient le même
symptôme (fiche mannequin vide) et ont été corrigés séparément :
1. `js/supabase-config.js` utilisait le nouveau format de clé Supabase
   (`sb_publishable_...`), rejeté par ce projet pour les appels REST directs
   (401 systématique) — remplacé par la clé "anon" historique (format JWT,
   récupérable dans Supabase → Settings → API → "Legacy anon, service_role
   API keys").
2. Extension 51 (verrouillage colonne par colonne pour `anon`, voir plus
   bas) n'avait jamais été mise à jour après l'ajout de la colonne
   `niveau_mannequin` à `model_profiles` — `mannequin.html`/`en/mannequin.html`
   la sélectionnent pour toute fiche individuelle, et PostgREST refuse la
   requête ENTIÈRE (401) dès qu'une seule colonne demandée n'a pas de droit
   de lecture pour `anon`, même si les autres colonnes sont autorisées. Le
   Book et l'accueil ne demandent pas cette colonne, d'où leur affichage
   normal pendant que les fiches individuelles échouaient (voir Extension 89).

**`api/r2-presigner.js`** — fonction serveur partagée par
`espace-mannequin.html` et `tableau-de-bord.html` : génère une URL R2
signée temporaire (5 minutes) pour un envoi (`PutObjectCommand`) ou une
suppression (`DeleteObjectCommand`), après avoir vérifié que l'appelant est
bien le mannequin propriétaire du dossier ciblé ou un admin — jamais les
clés R2 elles-mêmes côté navigateur. Utilise le SDK AWS officiel (R2 est
compatible S3), d'où le nouveau `package.json` du dépôt (`@aws-sdk/client-s3`,
`@aws-sdk/s3-request-presigner` — première fois que ce site a des
dépendances npm, Vercel les installe automatiquement au déploiement).

Variables d'environnement Vercel requises : `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
`R2_PUBLIC_URL` (Cloudflare → R2 → compartiment `ma2m-photos` → jeton API
de type Account, lecture/écriture, scopé à ce compartiment).

**`R2_PUBLIC_URL` = domaine personnalisé, jamais `r2.dev` (fin septembre
2026) :** `R2_PUBLIC_URL` pointait au départ vers l'URL publique de
développement de Cloudflare (`https://pub-<hash>.r2.dev`), activée en
urgence lors de la migration initiale depuis Supabase Storage. Cloudflare
documente explicitement ce domaine comme non destiné à la production, et
c'est la cause réelle trouvée d'un bug signalé début : les photos du Book
étaient invisibles pour TOUS les mannequins, mais seulement sur
navigateurs mobiles (Android ET iPhone, sur wifi comme en données
mobiles) — desktop et tablette n'étaient jamais concernés. Symptôme
navigateur : `ERR_CONNECTION_ABORTED`. Corrigé en migrant vers un domaine
personnalisé R2 dédié (`photos.maitreakessemodelmanagement.com`,
Cloudflare → R2 → compartiment `ma2m-photos` → Paramètres → Domaines
personnalisés), ce qui a nécessité au préalable de faire gérer le DNS du
domaine principal par Cloudflare (voir section suivante) — un domaine
personnalisé R2 exige que la zone DNS soit déjà chez Cloudflare. Après
connexion du domaine personnalisé, `R2_PUBLIC_URL` a été mis à jour vers
`https://photos.maitreakessemodelmanagement.com` sur Vercel (redéploiement
nécessaire pour prise en compte) et les URLs déjà enregistrées dans
`model_photos` (`url` / `url_miniature` / `url_moyenne`) ont été réécrites
en une fois via SQL (Extension 90). **Ne jamais repasser `R2_PUBLIC_URL`
sur une URL `r2.dev`**, même temporairement pour dépanner : le bug mobile
reviendrait.

**CORS obligatoire sur le compartiment R2** (Paramètres → Politique CORS),
sinon le navigateur ne peut pas envoyer directement vers l'URL signée :

```json
[
  {
    "AllowedOrigins": ["https://www.maitreakessemodelmanagement.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

**Migration des photos déjà en ligne** : outil admin dans le tableau de
bord ("☁️ Migration des photos vers R2", Bloc 3 → 3A) — télécharge chaque
photo encore hébergée sur Supabase Storage depuis le navigateur de l'admin,
la renvoie vers R2 au même chemin, puis met à jour la fiche. Relançable
sans risque (une photo déjà migrée est ignorée). Les nouveaux envois
passent déjà par R2 dès ce déploiement ; cet outil ne concerne que
l'historique.

## Images du site (actualités, événements, partenaires) sur R2 également (28 septembre 2026)

Même cause, même remède que pour les photos du Book ci-dessus, mais
découvert plus tard : les images des actualités (`actualites-images`), des
événements (`evenements-images`), des logos de partenaires
(`partenaires-logos`) et de la photo du mot du fondateur (également dans
`partenaires-logos`, chemin `responsable/...`) restaient hébergées
directement sur Supabase Storage. Chaque visite d'une page publique les
rechargeait depuis Supabase, consommant le même quota gratuit de bande
passante ("Cached Egress") — repéré cette fois via un avertissement de
facturation Supabase (organisation restreinte à partir du 15 octobre 2026,
quota à 293%).

**`api/r2-site-images.js`** — même principe que `api/r2-presigner.js`
(URL R2 signée temporaire, jamais les clés côté navigateur), mais réservé
aux admins uniquement (ces images n'appartiennent à aucun mannequin).
Catégories autorisées : `actualites`, `evenements`, `partenaires`,
`responsable`. Chaque chemin envoyé doit commencer par
`site/<categorie>/` — vérifié côté serveur avant toute opération.

**`js/app.js`** — trois fonctions partagées par toutes les pages
concernées :
- `envoyerImageSite(categorie, chemin, fichier)` : upload avec 3 tentatives
  (délai croissant) avant d'abandonner.
- `supprimerImageSite(categorie, chemin)` : suppression sur R2, échoue en
  silence (une image déjà supprimée ou introuvable ne doit jamais bloquer
  la suppression de la fiche qui la référence).
- `supprimerCheminsImagesSite(categorie, bucketSupabase, chemins)` :
  aiguille chaque chemin vers R2 ou vers l'ancien Supabase Storage selon
  qu'il commence par `site/<categorie>/` ou non — nécessaire pendant la
  période de transition où une même actualité/événement peut avoir des
  photos encore anciennes (Supabase) et des photos nouvelles (R2).

Toutes ces images sont servies via le même relais Vercel `/book-photos/`
déjà en place pour le Book (voir plus haut) — aucune nouvelle variable
Vercel, aucun nouveau réglage DNS ou CORS nécessaire, le compartiment R2
est le même (`ma2m-photos`), seul le préfixe de chemin change
(`site/<categorie>/...` au lieu de `<model_id>/...`).

**Migration des images déjà en ligne : faite.** Outil admin « ☁️ Migration
des images du site vers R2 » (tableau de bord, section Migration des photos
vers R2, PR #192) — lancé par la propriétaire le 28 septembre 2026, réponse
« Aucune image à migrer — tout est déjà sur R2 ». Rien à faire avant la
restriction Supabase du 15 octobre 2026.

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
5. ~~C'est lui qui merge~~ — **changé le 28 septembre 2026** : la
   propriétaire demande désormais que l'assistant **merge et publie
   directement lui-même** une fois le travail terminé et l'aperçu Vercel
   au vert (squash merge), sans attendre son clic.
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

`sb.auth.resetPasswordForEmail()` est appelé depuis `tableau-de-bord.html`
(écran de connexion admin) et `espace-mannequin.html` (écran de connexion
mannequin), avec `redirectTo` pointant vers **`reinitialiser-mot-de-passe.html`**
— une page dédiée, à usage unique, séparée du tableau de bord et de l'espace
mannequin.

Ce choix vient d'un bug réel : quand le lien de récupération ramenait
l'utilisateur directement sur `tableau-de-bord.html`/`espace-mannequin.html`,
une course entre deux traitements asynchrones au démarrage de la page
(la reconnexion automatique habituelle vs. l'événement `PASSWORD_RECOVERY`,
qui attend une validation réseau du jeton) pouvait faire gagner la
reconnexion automatique et sauter complètement l'écran "nouveau mot de
passe". Plutôt que de continuer à rustiner cette logique de démarrage
partagée, `reinitialiser-mot-de-passe.html` n'a aucune autre logique au
chargement : elle détecte `type=recovery` directement dans l'URL (test
synchrone, sans attendre aucun appel réseau), affiche le formulaire de
nouveau mot de passe si présent, appelle `sb.auth.updateUser({ password })`
à la soumission, puis propose des liens vers le tableau de bord et l'espace
mannequin. Aucune course possible : rien d'autre ne dispute l'écran.

Dépend entièrement du SMTP personnalisé Resend (voir plus haut) et des
Redirect URLs Supabase correctement configurées.

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
   `chemin_miniature`, ~500px, JPEG qualité 0.70) stockée dans un
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
   est désormais compressée modérément à l'envoi — 2200px de côté maximum,
   JPEG qualité 0.85, uniquement si le fichier dépasse 900 Ko. Ce réglage
   reste supérieur à ce qu'il faut pour imprimer net à 400 DPI sur la plus
   grande case du Compcard (~2050px), donc aucune perte visible attendue,
   tout en réduisant nettement le poids de chaque photo (stockage ET bande
   passante) — resserré depuis 3000px/0.90 (un excédent bien au-delà du
   besoin réel d'impression) après un second dépassement de quota (291%).
   La version "moyenne" (grandes photos plein écran de l'accueil,
   `url_moyenne`/`chemin_moyenne`) est passée de 1600px/0.82 à 1400px/0.78
   pour la même raison. Ne s'applique qu'aux nouveaux envois — les photos
   déjà en ligne avant ce changement restent à leur poids d'origine (aucun
   rattrapage automatique prévu sur les originales, contrairement aux
   miniatures : modifier une originale déjà publiée est plus risqué qu'en
   ajouter une copie réduite à côté).

3. **`cacheControl` sur chaque upload Storage** : les photos ne changent
   jamais après leur envoi, mais étaient mises en cache seulement 1 heure
   (valeur par défaut de `supabase-js`) — un visiteur qui revient (même le
   jour même) retéléchargeait donc la même image. Chaque `.upload(...)` de
   `model-photos` passe désormais `{ cacheControl: '31536000' }` (1 an),
   pour que le navigateur ET le CDN Supabase réutilisent l'image déjà
   servie au lieu de la retélécharger. Ne s'applique, là aussi, qu'aux
   nouveaux envois (une valeur de cache ne se change pas rétroactivement
   sans réenvoyer le fichier).

## Surveillance des erreurs réelles (alternative aux audits manuels)

**Depuis le 28 septembre 2026 : `js/surveillance.js`**, chargé tout en haut de
chaque page (juste après Sentry). La propriétaire veut que le site détecte TOUT
dysfonctionnement, pas seulement les plantages — les bugs du jour (QR code du CV
bloqué par le CSP, photos absentes depuis Facebook) étaient silencieux. Il signale,
dans `journal_erreurs` ET dans Sentry, avec une catégorie entre crochets : erreurs
JS, images/scripts/styles non chargés, blocages CSP (`securitypolicyviolation`),
requêtes réseau en échec (fetch surveillé ; 401/403/404/406/409 ignorés car
normaux), `console.error`, page très lente (> 12 s, avec les fichiers les plus
longs), supabase-js jamais chargé. L'appli d'origine (Facebook, Instagram…) et le
type de réseau sont ajoutés en première ligne de `pile` et affichés dans le tableau
de bord. Envoi direct par fetch à l'API REST (clé anon), indépendant de supabase-js.
Anti-doublon par session, 25 signalements max par page. Depuis le code :
`window.signalerErreur(catégorie, message, détail)` (ou `signalerProbleme()` dans
`js/app.js`) pour tout échec rattrapé sans planter.

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
togglée via `classList`. Quand la valeur elle-même est vraiment calculée
(largeur de barre en %, ex. le classement Top 10 du tableau de bord) : ne
JAMAIS l'écrire dans une chaîne de gabarit `style="width:${valeur}%"`
(bloqué) — poser un `data-*` dans le gabarit, puis juste après l'injection
du HTML, boucler sur les éléments et faire `el.style.largeur =
el.dataset.xxx + '%'` (assignation JS classique, autorisée).

**⚠️ Autre piège rencontré (attributs `onXxx=""`)** : un attribut
`onclick=""`/`onerror=""`/... inline est bloqué par un `script-src` strict
même avec les bonnes empreintes de `<script>` — le message d'erreur du
navigateur le précise explicitement ("hashes do not apply to event
handlers... unless the 'unsafe-hashes' keyword is present"). Trouvé sur
`mannequin.html`/`en/mannequin.html` (bouton "Réessayer" du profil, corrigé
en hotfix après coup) et sur `tableau-de-bord.html` (deux `onerror=""`
d'aperçus photo). Correction : retirer l'attribut du gabarit, ajouter un
`addEventListener` (ou une assignation `img.onerror = ...`) juste après
l'injection du HTML dans le DOM — jamais dans le HTML lui-même. Avant de
considérer une page comme migrée : `grep -noE '\son[a-z]+=' fichier.html`
doit être vide (en excluant les faux positifs dans les commentaires).

**⚠️ Piège rencontré sur une page à plusieurs `<style>`** : `style-src`
exige une empreinte par bloc `<style>...</style>` PRIS SÉPARÉMENT — sur
`tableau-de-bord.html`, qui a 11 blocs `<style>` distincts accumulés au fil
des refontes, n'avoir haché QUE le nouveau bloc ajouté a bloqué en silence
les 10 autres (`violatedDirective: style-src-elem` dans
`securitypolicyviolation`, repéré uniquement par test navigateur). Un
fichier avec plusieurs `<style>` doit avoir TOUTES leurs empreintes dans le
meta CSP, pas seulement celle du dernier ajouté. `scripts/verifier-csp.py`
vérifie maintenant aussi les `<style>` (pas seulement les `<script>`)
pour détecter ce cas automatiquement.

**État à ce jour (fin septembre 2026)** — **les 28 pages du site sont
migrées** (plus `'unsafe-inline'` du tout) : toutes les pages FR
(`index.html`, `mannequins.html`, `mentions-legales.html`,
`politique-confidentialite.html`, `services.html`, `actualites.html`,
`candidature.html`, `contact.html`, `evenements.html`, `mannequin.html`,
`partenaires.html`, `selection.html`, `inscription-mannequin.html`,
`espace-mannequin.html`, `tableau-de-bord.html`) + leurs équivalents `en/`
existants (13 pages, `espace-mannequin.html`/`tableau-de-bord.html` n'ont
pas de version anglaise). `espace-mannequin.html` et `tableau-de-bord.html`
ont été migrées séparément et en dernier, une à la fois, avec des tests
dédiés plus poussés (navigateur headless + écoute de l'événement
`securitypolicyviolation` pour repérer précisément quel bloc pose
problème) — ce sont les deux pages les plus riches en JavaScript du site
(respectivement ~80 et ~163 `style=""` inline avant migration, des blocs
`<script>` de plusieurs dizaines de milliers de caractères, et pour
`tableau-de-bord.html` plusieurs générations de scripts "patch" empilées
qui se recouvrent partiellement — toutes ont dû être corrigées, pas
seulement la version qui semble "active").

`vercel.json` garde son `'unsafe-inline'` global par prudence (une page qui
serait ajoutée sans meta CSP dédié doit continuer à fonctionner), mais
n'a plus aucun effet protecteur réel puisque toutes les pages existantes
ont désormais leur propre CSP restrictif qui prime.

Pour les pages avec un formulaire dont le JavaScript génère lui-même du
HTML via `innerHTML`/template literal (aperçus photo, listes filtrées,
etc.) : les `style=""` qui apparaissent DANS ce JavaScript (pas seulement
dans le HTML statique) doivent aussi être remplacés par des classes,
sinon ils sont bloqués en silence exactement comme un `<script>` non
haché — voir le piège déjà rencontré ci-dessus. Chaque page migrée reçoit
ses propres classes utilitaires dans un `<style>` posé dans son
`<head>` (nommées `<prefixe>-1`, `<prefixe>-2`, ... — préfixe court propre
à la page), pour rester page par page et isolé sans gonfler
`css/style.css` de classes à usage unique ; seules les valeurs qui
correspondent exactement à une classe `.u-*` déjà existante sont
réutilisées telles quelles.

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

- **heic2any retiré (28 septembre 2026)** — ~90 % du journal d'erreurs était
  une « EvalError » : heic2any (conversion des photos HEIC d'iPhone) utilise
  `new Function`, interdit par le CSP (pas de `'unsafe-eval'`, à ne pas
  ajouter). Il plantait à chaque chargement des 12 pages d'envoi de photos,
  sans jamais pouvoir convertir, et pesait 1,3 Mo par page. Remplacé par une
  conversion faite par le navigateur (`window.heic2any` défini dans
  `js/app.js`, même signature) : fonctionne là où le HEIC est lisible
  (Safari iPhone/Mac) ; ailleurs les pages envoient le fichier d'origine,
  comme avant. Le tableau de bord affiche aussi désormais le détail technique
  de chaque erreur (fichier/ligne/adresse), pour diagnostiquer depuis une
  simple capture d'écran.
- **Cases photo du CV et de la compcard remplies automatiquement**
  (28 septembre 2026) : si le mannequin n'a pas choisi sa photo de CV ou
  une photo pour une case de la compcard, la case est complétée avec ses
  photos du Book (photo de profil en premier), sans doublon tant qu'il en
  reste d'autres — `completerEmplacementsPhotos()` / `photosCvCompletees()`
  dans `js/app.js`, utilisés par le CV (HTML + fichier), la compcard
  (fichier FR/EN + aperçu de l'espace mannequin). Le choix du mannequin
  reste prioritaire ; rien n'est écrit en base (c'est un remplissage à
  l'affichage, qui disparaît dès qu'il choisit lui-même).
- **Allègement du site (28 septembre 2026)** — plainte de la propriétaire :
  site très lourd depuis le navigateur intégré de Facebook, photos qui ne
  s'affichent pas. Constats et corrections :
  - `vercel.json` posait `Cache-Control: no-cache, must-revalidate` sur
    TOUT (`/(.*)`), y compris les photos du relais `/book-photos/*` : le
    téléphone ne gardait jamais une photo, chaque visite repassait par le
    relais Vercel → r2.dev. Ajout de règles plus bas dans `headers` (la
    dernière règle correspondante l'emporte) : `/book-photos/*` en cache
    1 an `immutable` (chaque photo a un nom unique horodaté, elle ne change
    jamais) + `CDN-Cache-Control` pour que Vercel la garde aussi ;
    `/assets/*` et `/icons/*` en cache 1 jour. HTML/JS/CSS inchangés
    (toujours revalidés, pour que les mises à jour se voient tout de suite).
  - `assets/logo-header.png` (bandeau de toutes les pages) : 492 Ko → 20 Ko,
    `assets/logo-dark-bg.png` : 840 Ko → 34 Ko (redimensionnés à 600 et
    800 px + palette 256 couleurs, rendu identique ; restent assez grands
    pour la compcard 400 dpi et le CV 300 dpi).
  - Fiche mannequin : couverture en `url_moyenne`, médaillon en
    `url_miniature` au lieu de l'originale.
- **CV téléchargé (PDF/JPEG, `construireCanvasCv()` dans `js/app.js`)** —
  28 septembre 2026 : hauteur exacte (le dessin est fait deux fois, d'abord
  « à blanc » pour mesurer, plus aucune estimation qui laissait un grand
  vide en bas) ; bas de page réorganisé (compétences sur deux colonnes, puis
  portfolio en une rangée de photos, puis « En ligne » : Instagram + lien
  vers la fiche + QR code, cliquables dans le PDF). Le QR code est désormais
  calculé localement (`js/qrcode-generator.js`, copie de qrcode-generator
  1.4.4) : l'ancien appel à api.qrserver.com était bloqué par `connect-src`
  du CSP et le QR disparaissait en silence du fichier.
- **Fiche mannequin publique (`mannequin.html` / `en/mannequin.html`) en
  mise en page « profil » façon Facebook/Instagram** (28 septembre 2026) :
  couverture plein écran cliquable (ouvre la galerie du Book), photo de
  profil en médaillon à gauche qui chevauche le bas de la couverture,
  mensurations en liste aérée à sa droite, boutons « Sélectionner » et
  « Compcard » (un seul bouton → menu PDF / JPEG) juste dessous, puis cartes
  À propos + Contact / Parcours (frise) + Vidéo, sur deux colonnes dès
  900px. Styles : classes `.fiche-*` en fin de `css/style.css`. Le CV reste
  privé (espace mannequin et tableau de bord uniquement).
  2e passe le même jour : boutons dans la typographie de « MENU » (pilules
  fines), barre d'onglets (À propos / Parcours / Photos / Contact, simples
  ancres), et contact officiel déplacé tout en bas, après le Book
  (`#fiche-contact-bas`, rempli en JS) — objectif de la propriétaire : qu'on
  ait l'impression d'être sur la page Facebook du mannequin, sans copier
  Facebook.
- **`evenements.html`** — "Nos Événements", reconstruite fin septembre 2026
  sur exactement la même architecture qu'`actualites.html` (bloc "à la
  une", grille magazine, fiche modale, galerie photo adaptative, éditeur
  plein écran) — voir `js/evenements.js` et la section dédiée plus haut.
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

## Diagnostic sécurité du 28 septembre 2026 (nuit)

Revue complète de la sécurité et des connexions, à la demande de la
propriétaire, faite pendant que le site tournait normalement (lecture et
vérification uniquement, aucune modification risquée). Rapport complet :
https://claude.ai/artifact/6VhrViMnZ8cRxJvsnnrNtD

**Résumé** : fondations déjà solides — RLS activé sur les 36 tables sans
exception, les 43 fonctions `SECURITY DEFINER` ont `set search_path`
(protection contre le détournement de chemin de recherche), aucun secret
dans le code, aucun lien mort, endpoints d'administration (créer admin,
supprimer mannequin) correctement vérifiés côté serveur.

Deux points mineurs relevés sur le tout nouveau système de cœurs
(Extension 93 de la même nuit) ont été corrigés dans la foulée
(Extension 95) : limite anti-spam par visiteur (réutilise
`limiter_soumissions_publiques`, Extension 75) et cœurs désormais
réservés aux profils publiés.

Recommandations restantes (aucune urgente) : confirmer Resend par un
envoi réel, envisager une vérification plus poussée du contenu des
fichiers uploadés (limite déjà documentée dans `SECURITY.md`), faire
tourner Mozilla Observatory / SSL Labs pour un second avis extérieur.

## Audit complet du 28 septembre 2026 (soir) — demandé par la propriétaire

Revue de bout en bout (analyse statique de tout le code + chargement de chaque
page FR/EN en navigateur réel, mobile et ordinateur, avec base simulée — vide,
absente, puis remplie de fausses données contenant du code malveillant pour
vérifier qu'aucun texte n'est jamais exécuté). Corrigé :

- **Faille d'envoi de fichiers** (`api/r2-presigner.js`, `api/r2-site-images.js`) :
  le type de fichier n'était pas vérifié. Un compte mannequin pouvait envoyer un
  fichier HTML/SVG « déguisé » en photo, servi ensuite depuis le domaine du site
  (relais `/book-photos`) → exécution de code possible, vol de session. Désormais
  seules les vraies images sont acceptées (JPEG, PNG, WebP, GIF, HEIC, AVIF), les
  remontées de dossier (`..`) sont refusées, et `vercel.json` sert tout
  `/book-photos/*` avec un CSP `sandbox` (aucun code ne peut s'y exécuter, même
  si un mauvais fichier y était déjà). Conséquence : un logo partenaire en SVG est
  désormais refusé à l'envoi (message clair) — utiliser PNG.
- **Comptage des visites** (`js/app.js`) : toutes les fiches mannequin
  partageaient la même clé de session → seule la première fiche vue était
  comptée, le classement « Top 10 » était faussé. Clé désormais par fiche.
- **Page « nouveau mot de passe »** : formulaire affiché trop tôt (attribut
  `style="display:none"` bloqué en silence par le CSP) → règle déplacée dans
  `css/style.css`.
- **espace-mannequin-ancien.html** (filet de secours) : entièrement cassé
  (constantes redéclarées, déjà fournies par `js/app.js`) → réparé ; heic2any
  retiré aussi.
- Bouton « Sélectionner » : ne plante plus si le stockage du navigateur est
  indisponible. Liens Instagram de l'accueil limités à `https://`.
- Surveillance : ignore les `<img src="">` en attente et les services d'audience
  bloqués par les bloqueurs de pub (ipify, Google Analytics) — sinon bruit inutile.
- `robots.txt` : chemins sans `.html` (le site utilise `cleanUrls`).
- **Suppressions dans le bon ordre** (photo du Book côté mannequin et admin,
  photo de dossier, actualité, événement, partenaire — FR/EN) : la fiche en base
  est supprimée d'abord, les fichiers ensuite seulement si la base a accepté.
  Avant, les fichiers partaient en premier et l'erreur de base était ignorée →
  élément toujours listé mais image cassée. En cas d'échec : message clair.
- Types `image/jpg` et `image/pjpeg` (certains Android) acceptés par les `/api`.
- **espace-mannequin-ancien.html supprimé** (même soir, sur conseil de l'assistant
  et accord de la propriétaire) : doublon inutilisé du nouvel espace, encore basé
  sur Supabase Storage, et une page de connexion de plus à protéger. Redirection
  permanente vers `/espace-mannequin` dans `vercel.json`. Récupérable à tout
  moment dans l'historique git si besoin. Les mentions qui restent dans les
  commentaires du code sont historiques.
- **Aucun flux photo vers Supabase** (règle de la propriétaire, restriction
  Supabase du 15 octobre 2026) : `espace-mannequin-ancien.html` envoyait encore
  les photos vers Supabase Storage → envoi et suppression de photos désactivés sur
  cette page de secours (message renvoyant vers le nouvel espace). Restent
  seulement, côté tableau de bord, des suppressions (libèrent de la place, sans
  bande passante) et l'affichage des très anciennes photos de candidatures d'avant
  Google Drive (URL signées, uniquement à l'ouverture de ces vieux dossiers).
- Outils internes (`outils/`) : logos introuvables (mauvais chemin) corrigés.

**Recommandation non appliquée (demande une décision + du SQL)** : le code de
validation admin (2ᵉ facteur) n'est vérifié que dans le navigateur
(`sessionStorage`). Quelqu'un qui aurait le mot de passe d'un admin pourrait
appeler directement Supabase et les `/api` sans le code. Le rendre vraiment
obligatoire suppose de le vérifier côté base (RLS) et côté `/api` — chantier à
part, à préparer avec soin pour ne pas bloquer l'accès de la propriétaire.

### Vérification espace mannequin / envoi de photos (28 septembre 2026, suite)

Demande de la propriétaire (« les mannequins disent que télécharger des images
c'est compliqué »). Simulation complète en navigateur (session simulée, envoi réel
jusqu'à `/api/r2-presigner` + PUT + insertion en base) sur iPhone SE, iPhone 12,
Galaxy S9+, iPad et ordinateur — NB : moteur Chromium uniquement (Safari/WebKit
indisponible dans l'environnement de l'assistant), d'où en plus une vérification
statique de compatibilité iOS. Corrigé :
- `crypto.randomUUID` (iOS ≥ 15.4 seulement) utilisé par candidature, sélection,
  actualités/événements/partenaires : équivalent ajouté en tête de `js/app.js`
  pour les iPhone plus anciens (l'envoi plantait sans message).
- `??` dans `espace-mannequin.html` (iOS ≥ 13.4) : remplacé — sur un iPhone plus
  ancien, tout le script de l'espace mannequin ne se chargeait pas.
- Photos lourdes non-JPEG (captures PNG, WebP > 900 Ko) désormais compressées en
  JPEG avant envoi (avant : envoyées telles quelles, parfois 10-20 Mo).
- Envoi de plusieurs photos : message « Envoi de la photo 2 sur 5… » puis bilan.
- Coupure réseau : message en français au lieu de « Failed to fetch » /
  « Load failed ».
Résultat : 0 appel au stockage Supabase, 3 versions par photo vers R2, fiche en
base ; Book, fiche mannequin FR/EN et accueil : toutes les images chargées sur les
5 appareils, sans erreur ni débordement.

### Journal d'erreurs du 28 septembre 2026 (soir) — analyse et corrections

- **Sentry ne fonctionnait pas** : le chargeur (`js-de.sentry-cdn.com`) télécharge
  ensuite le SDK complet depuis `browser.sentry-cdn.com`, absent du CSP → bloqué
  partout, Sentry n'a jamais rien enregistré. Ajouté à `script-src` (vercel.json +
  meta CSP des 29 pages) et à `connect-src`.
- Navigateurs intégrés Instagram/Facebook : ils injectent leur propre code
  (`iabjs://…`, « Java object is gone ») et re-téléchargent par `fetch` les
  scripts/polices de la page → faux signalements. `connect-src` autorise
  désormais `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com` ;
  `js/surveillance.js` ignore les erreurs de code étranger (`codeEtranger()`) et
  les réponses « opaques » (statut 0, ex. Google Analytics).
- Aucune erreur du journal ne venait d'une page du site ni d'une photo non
  affichée (y compris depuis Facebook).


## 🔗 Aperçu des liens partagés + boutons Partager (29 septembre 2026)

- Ouvrir une actualité ou un événement met son adresse précise dans le navigateur
  (`?actu=ID` / `?evenement=ID`), et la fiche propose **Partager** (téléphone),
  **WhatsApp** et **Copier le lien** (`window.ficheOuverte` / `window.ficheFermee`
  dans `js/app.js`, appelés par `js/actualites.js`, `js/evenements.js` et les
  pages anglaises).
- `middleware.js` (Routing Middleware Vercel) : **seuls les robots d'aperçu**
  (WhatsApp, Facebook, Telegram, X, LinkedIn…) reçoivent une petite page avec les
  balises `og:` de la fiche (titre, texte, photo). Les visiteurs ne sont jamais
  concernés ; au moindre problème, le robot reçoit la page normale.
- La photo d'aperçu passe par l'optimiseur d'images de Vercel
  (`/_vercel/image?...&w=1080`, réglé par la clé `images` de `vercel.json`) :
  WhatsApp n'affiche pas les photos trop lourdes.
- Ne pas ajouter les navigateurs intégrés des applis (Instagram, « FBAN »,
  Snapchat, LINE…) à la liste des robots : ce sont de vraies personnes.

## 🛍️ Marketplace — Boutique MA2M (29 septembre 2026 — construite, fermée au public)

- **Cahier des charges** validé par la propriétaire (boutique de l'agence, paiement
  Wave / Orange Money / MTN avec référence, livraison à domicile).
- **Base de données** : Extension 98 (`supabase-extension.sql`), lancée dans Supabase
  le 29/09. Tables `boutique_*`, prix calculés par la base, stock verrouillé,
  factures numérotées sans trou, annulation automatique des commandes non payées.
  Testée sur PostgreSQL 16 avant envoi (y compris l'achat simultané du dernier article).
- **FERMÉE au public** tant que `boutique_reglages.ouverte = false` : les règles RLS
  ne laissent rien lire à un non-admin ; les pages `marketplace/` affichent alors
  « Page introuvable ». Ne PAS passer `ouverte` à true avant la fin de la construction,
  la relecture des CGV et l'accord de la propriétaire.
- **Nom retenu : « La Maison MA2M ».** Règle de la propriétaire : la boutique réutilise les composants du site officiel (eyebrow, titres capitales + point rouge, .btn, .filtre-btn, .form-champ, .fil-ariane, .vedette-fullbleed, .btn-mini-admin) et des textes naturels — pas d’interface ni de phrases « génériques IA ».
- **Pages** : `marketplace/index.html` (vitrine), `produit.html?p=<slug>` (fiche),
  `gestion.html` (tableau de bord de la boutique : exige un admin connecté ET le code
  de validation saisi dans cet onglet). Code : `js/marketplace-commun.js` (accès,
  prix, panier), `js/marketplace-vitrine.js`, `js/marketplace-gestion.js`, styles
  `css/marketplace.css` (préfixe `mp-` / `mpg-`, aucun effet sur le reste du site).
  Aucun script en ligne : CSP stricte sans empreinte à maintenir.
- **Photos produits** : Cloudflare R2, dossier `site/boutique/<produit>/`, catégorie
  `boutique` ajoutée à `api/r2-site-images.js`. Allégées dans le navigateur avant
  envoi (1800 px + miniature 640 px). Jamais de photo sur Supabase.
- **Lien « Marketplace »** (js/menu.js) : visible seulement pour un admin connecté ;
  dans la barre du haut sur ordinateur/tablette, en tête du menu sur téléphone (sur
  téléphone, un 4e bouton écrasait le logo).
- **Direction artistique (29/09, version « affiche »)** : ouverture reprise de
  l'affiche FORM choisie par la propriétaire (nuit laquée, filets de lumière, grand
  « M A 2 M » espacé, trait, accroche, ornement trait-point-trait), **rouge et noir
  uniquement — aucun doré** (`--or` est redéfini en rouge dans `.mp-corps`).
  **Tous les boutons** ont la forme ronde des boutons de l'en-tête (EN / Admin /
  Marketplace). Polices de la boutique : Bodoni Moda (titres) + Tenor Sans (textes).
- **Adresses absolues partout** (`/marketplace/gestion`, `/css/…`) : avec les
  adresses propres de Vercel, `/marketplace` sans « / » final cassait les liens
  relatifs (page 404 signalée le 29/09). Pages générées par un script (même
  en-tête, barre, panier, pied) : garder cette règle en cas d'ajout.
- **Trois univers** (colonne `type` des produits) : Articles (`physique`, livrés),
  Billets (`billet` : date, lieu, « stock » = places ; un billet à code + QR par
  place, émis à la validation du paiement), Services (`service` : modalités,
  rendez-vous après paiement). Vitrine : section « Trois portes », puis filtres
  univers → catégories.
- **Parcours client complet** : `commande.html` (coordonnées, zone de livraison
  seulement s'il y a un article, CGV obligatoires) → `suivi.html?n=&j=` (paiement :
  numéro Wave/OM/MTN + saisie de la référence ; puis étapes, livreur, billets QR,
  facture) → `facture.html?n=&j=` (imprimable / PDF, numéro F-AAAA-NNNNN). Suivi
  aussi par numéro + téléphone. `cgv.html` = **projet à faire valider par un juriste**.
- **Gestion** : onglet Commandes (« À vérifier » en tête ; confirmer / refuser le
  paiement, préparer, remettre au livreur, terminer, rembourser ; WhatsApp client ;
  historique), onglet Billets (contrôle à l'entrée ; le QR ouvre
  `/marketplace/gestion?billet=CODE`, un billet ne sert qu'une fois), Réglages
  (identité légale du vendeur imprimée sur les factures : RCCM, NCC, mention fiscale
  à valider avec le comptable).
- **Base** : Extension 99 (colonnes événement/service, `type_produit` des lignes,
  table `boutique_billets`, fonctions `boutique_emettre_billets`,
  `boutique_controler_billet`, suivi enrichi, « payée → terminée » pour billets et
  services). Testée sur PostgreSQL 16 (installée deux fois, billets sans doublon,
  refus d'un événement passé, contrôle réservé aux admins).
- **Rayons** (Extension 100) : chaque catégorie appartient à une porte
  (`boutique_categories.univers`). Rayons de départ : Articles (Vêtements,
  Accessoires, Objets de l'agence), Billets (Défilés, Galas et soirées, Castings,
  Ateliers et masterclass), Services (Shooting photo, Formation privée, Coaching et
  accompagnement, Autres services). Tous visibles dans la boutique, « bientôt »
  quand ils sont vides ; l'éditeur de produit ne propose que les rayons de la porte
  choisie.
- **Bandeau défilant** (Extension 101) : message réglable dans Gestion → Réglages
  (`bandeau_texte`, `bandeau_actif`) ; désactivé ou vide = texte habituel.

## 🧭 Confort de navigation et cookies (29 septembre 2026)

Liste de la propriétaire, triée avec elle : ajouté ce qui manquait et avait du sens.
- **Bandeau cookies** (`js/analytics-config.js`) : Google Analytics en « mode
  consentement » — refusé par défaut, accordé seulement après « Accepter »
  (`localStorage.ma2m_cookies` = oui / non). Bouton « Modifier mon choix » sur la
  page Confidentialité (`[data-cookies-modifier]`), dont le paragraphe Cookies a été
  corrigé (il disait à tort « aucun traceur tiers »).
- **`js/confort.js`** (chargé après app.js sur toutes les pages, et sur
  reinitialiser-mot-de-passe) : œil sur chaque champ mot de passe (y compris ajoutés
  plus tard), bouton « retour en haut » (coin droit, rehaussé au-dessus de « Ma
  sélection »), lien « Aller au contenu » visible seulement au clavier.
- **Liens partagés marqués (UTM)** : actualités / événements partagés par WhatsApp,
  lien copié ou partage du téléphone → `utm_source`, `utm_medium=partage`,
  `utm_campaign=actualite|evenement` (sans effet sur les aperçus, middleware.js).
- **Date de dernière mise à jour** en bas des mentions légales et de la
  confidentialité (FR + EN) — à changer à chaque modification de ces pages.
- Écartés avec la propriétaire : mode sombre (le site est noir), barre de progression,
  bouton copier sur les textes, recherche globale ; FAQ en attente de ses questions.

## ⚖️ Conformité et sécurité (30 septembre 2026)

Audit à partir d'une liste générale fournie par la propriétaire (beaucoup de points
déjà en place ou sans objet : pas d'IA, pas de connexion Google, pas de paiement
par carte). Corrigé :
- **Case d'accord obligatoire** (`.form-consentement`, `required`) sur les formulaires
  d'inscription, de contact et de sélection (FR + EN) ; la candidature l'avait déjà.
- **Plus d'appel à ipify** : l'adresse IP des visiteurs n'est plus envoyée à un tiers.
  `empreinteVisiteur()` (js/app.js) = identifiant aléatoire, gardé dans le navigateur
  seulement si les cookies de mesure sont acceptés, sinon pour la visite en cours.
  `api.ipify.org` retiré du CSP (vercel.json).
- **Prestataires déclarés** dans la politique de confidentialité (#prestataires).
- **jsDelivr retiré** de tous les CSP : plus aucun code chargé depuis ce CDN (jsPDF de
  en/mannequin.html passé en copie locale, empreinte CSP mise à jour).
- **Accessibilité** : audit axe-core (WCAG 2 A/AA) sur toutes les pages — seuls défauts :
  étiquettes non reliées à leur champ (connexion admin, espace mannequin, codes du
  tableau de bord) → corrigées. Contrastes et textes alternatifs : conformes.
- Déjà en place : limite anti-spam des formulaires publics
  (`limiter_soumissions_publiques`), code de validation admin vérifié par la base avec
  limite de tentatives, aucune redirection ouverte.
- **Reste** : documents légaux de l'entreprise (CGU, page cookies, remboursement des
  droits d'inscription) — en attente des documents de la propriétaire (rappel le 04/10).
  Le « code validé » de l'administration n'est gardé que dans l'onglet (les règles de
  la base ne le vérifient pas) : pour une vraie double authentification, activer le MFA
  de Supabase Auth.

## 💾 Sauvegardes de la base (30 septembre 2026)

Supabase est en offre **gratuite** (choix de la propriétaire) : aucune sauvegarde
fournie. D'où `.github/workflows/sauvegarde-base.yml` + `scripts/sauvegarde-base.sh` :
- chaque **dimanche à 3 h UTC** (et à la demande : onglet Actions → « Run workflow »),
  copie du schéma `public` (structure + données + règles RLS) et de `auth.users`
  (données), compressée puis **chiffrée AES-256** (gpg) avec la phrase secrète de la
  propriétaire ; gardée **90 jours** en « Artifact » de l'exécution ;
- secrets GitHub requis : `SUPABASE_DB_URL` (adresse « Session pooler » de Supabase →
  bouton Connect, mot de passe compris ; les machines GitHub n'ont pas d'IPv6, la
  connexion directe ne marcherait pas) et `BACKUP_PASSPHRASE` ;
- échec (secret faux, base injoignable, fichier < 2 Ko) → e-mail automatique de GitHub.
- **Restauration testée** le 30/09 sur une base locale : données et 16 règles RLS
  identiques. Procédure :
  `gpg --decrypt ma2m-base-AAAA-MM-JJ.sql.gz.gpg | gunzip | psql "<base vide>" -v ON_ERROR_STOP=1`
  (la base cible doit déjà avoir les schémas Supabase `auth`, `storage` — c'est le cas
  d'un nouveau projet Supabase).
- Les photos ne sont pas dans la base (Cloudflare R2).
