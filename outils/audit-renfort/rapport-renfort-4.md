# Mission MA2M — Rapport de l'agent 4 (15/11/2026)

Angle principal : **sécurité**, **performances mesurées**, **référencement (SEO) et accessibilité**, et le site vu par
deux **visiteurs professionnels** (promoteur d'événements sur iPhone, marque partenaire sur ordinateur).
Audit fait sur le site en ligne (version `665f03d`, puis `3da0139` mise en ligne pendant l'audit, vers 21 h 40) et sur
le code de la branche `mission-15-11-agent-4` (créée depuis `origin/main` = `665f03d`).

**Règles respectées** : aucune écriture réelle (dans le navigateur simulé, tout envoi autre qu'une lecture vers
Supabase, EmailJS et `/api/` était bloqué ; Lighthouse lancé en bloquant `page_views`, le journal des erreurs et les
mesures d'audience) ; vers la base, uniquement des **lectures** (GET) avec la clé publique, comme n'importe quel
visiteur ; aucun essai de mot de passe ; aucun test de charge ; aucune correction ; rien de poussé.
Mesures, scripts et captures : dossier de la mission, sous-dossier `agent-4/` (scratchpad, hors dépôt).

---

## 1. Résumé exécutif

Le site est **solide sur les bases de sécurité** (TLS A+, Observatory A+, base fermée table par table, clés secrètes
absentes du dépôt, contrôle d'accès sérieux des fonctions serveur, double authentification de l'équipe) et **rapide sur
ordinateur** (Lighthouse 95 à 100). Les vrais points faibles sont ailleurs :

1. **Les protections des formulaires publics sont plus faibles qu'annoncé** : l'anti-robots Cloudflare est **désactivé
   en pratique** depuis le 01/11 (`ANTI_ROBOTS_STRICT = false`), et la fonction de base qui enregistre les formulaires
   accepte **n'importe quelle colonne** envoyée par le visiteur (dates, champs internes) ; la création publique de
   comptes « équipe » crée des comptes **confirmés pour n'importe quelle adresse e-mail**, sans anti-robots.
2. **Des documents internes sont publiés sur le site** (`/docs/*.md`, `/GUIDE-DE-SECOURS.md`, `/DECISIONS.md`,
   `/AGENTS.md`, `/CONVENTIONS.md`) : la matrice des droits de la base, la procédure en cas de falsification… et
   **les rapports de cette mission le seront aussi** dès leur fusion si rien ne change (`.vercelignore`).
3. **Mobile : correct mais pas excellent.** Lighthouse mobile 81 à 98 ; LCP 3,6 s (accueil), 4,1 s (fiche), 4,9 s
   (Actualités, 1,4 Mo) ; sur Android moyen + réseau lent, The Book affiche sa grande image à **6,7 s**. Causes
   mesurées : pages HTML jamais mises en cache (chaque visite interroge la base), photos gardées **4 h seulement**,
   photos d'actualités en JPEG trop grands, ~220 Ko de JavaScript et ~120–250 Ko de CSS sur chaque page.
4. **Décalages de mise en page pendant la lecture sur téléphone** (CLS 0,11 à 0,27 sur Candidature, Services,
   Partenaires, Contact), causés par les feuilles de style complètes chargées en différé.
5. **Pour un client professionnel, le site parle surtout aux mannequins.** L'accueil ne propose rien aux marques et
   promoteurs (aucun « Réserver des mannequins / Demander une proposition »), les deux adresses e-mail sont des
   adresses Gmail, la page Services n'a qu'un lien « Nous contacter », le formulaire de contact n'a pas de choix
   « Promoteur / organisateur ». Le parcours « sélectionner des mannequins dans The Book puis envoyer la sélection »
   existe et marche bien, mais il n'est expliqué nulle part au client.

Décompte : **0 critique, 7 hautes, 10 moyennes, 15 basses** (32 problèmes, détail §15).

---

## 2. Points forts (vérifiés : comportement réel + code responsable)

| # | Point fort | Preuve (mesure) | Code responsable |
|---|---|---|---|
| F1 | TLS moderne | SSL Labs : **A+** (216.198.79.1), TLS 1.2/1.3 seulement, confidentialité persistante, aucune faille connue | Vercel |
| F2 | En-têtes de sécurité | Mozilla Observatory : **A+ (130)** sur www, admin, mannequin et domaine nu ; HSTS 2 ans + sous-domaines, `nosniff`, `X-Frame-Options`, `frame-ancestors`, `Permissions-Policy`, COOP/CORP | `vercel.json` l. 50-63 |
| F3 | CSP stricte réelle sur les pages publiques | chaque page publique porte un `<meta http-equiv="Content-Security-Policy">` sans `'unsafe-inline'` pour les scripts (118 pages sur 127 testées) ; admin/app : en-tête sans `'unsafe-inline'` (Observatory 12/12) | `vercel.json` l. 85-90, meta par page, `scripts/verifier-csp.py` |
| F4 | Base fermée à un visiteur anonyme | 127 tables/vues testées en lecture avec la clé publique : **aucune donnée personnelle privée lisible** (candidatures, messages, paiements, comptabilité, équipe, journaux : 0 ligne ou refus 401) ; schéma de l'API fermé (401) ; liste des espaces de stockage vide ; `model_profiles` lisible seulement pour les **28 profils publiés** et seulement certaines colonnes (téléphone, date de naissance, Instagram : refus 401) | RLS + droits par colonne (cf. `docs/rls-matrix.md`) |
| F5 | Contrôle d'accès des fonctions serveur | `api/r2-presigner.js` : le chemin doit commencer par l'identifiant du mannequin, pas de `..`, types d'image seulement, taille signée dans l'adresse d'envoi (5 min), limite 600/min ; actions d'administration : jeton **aal2** (double authentification) + appareil en règle (`adminVerifie`) ; tâche planifiée protégée par `CRON_SECRET` (GET anonyme → 401 vérifié) ; autres points d'entrée en GET anonyme : 401/403/405 | `api/_commun.js` l. 160-175, `api/_r2.js` |
| F6 | Aucun secret dans le dépôt public | recherche de clés (AWS, Stripe, GitHub, Google, Meta, clés privées) : rien ; les 4 jetons Supabase présents sont **tous** la clé publique `anon` ; clés R2, EmailJS privée, VAPID, Turnstile secret : variables d'environnement | `js/supabase-config.js`, `.vercelignore` |
| F7 | Dépendances | `npm audit` : **0 vulnérabilité** (avec et sans outils de développement) | `package.json` |
| F8 | Échappement HTML | les données de la base sont échappées avant `innerHTML` (`echapperHtml`), et les données injectées par le serveur dans la page passent par `jsonSur` (`<`, `>`, `&` encodés) — pas de XSS trouvée | `js/app.js:107`, `middleware.js:418` |
| F9 | Ordinateur rapide | Lighthouse ordinateur : performance 95-100, LCP 0,5-1,0 s sur les 6 pages | rendu serveur (`middleware.js`) + CSS critique |
| F10 | Accessibilité de base | Lighthouse accessibilité **100/100** sur les 12 passages ; lien d'évitement « Aller au contenu » en 1re tabulation ; pas de défilement horizontal sur 30 mesures (3 appareils × 10 pages) ; menu iPhone ouvert en 0,4 s | gabarits |
| F11 | SEO technique | 116 adresses dans le plan du site (fabriqué depuis la base), titres et descriptions présents partout, canonical sur toutes les pages publiques, hreflang FR/EN/x-default sur les pages FR, données structurées (accueil, fiches, actualités, événements) ; W3C : **0 erreur HTML** sur l'accueil FR/EN et Actualités ; pages privées en `noindex` | `middleware.js` (sitemap l. 609), gabarits |
| F12 | Cookies et consentement | Google Analytics en « mode consentement » refusé par défaut ; cookie d'accès admin `HttpOnly; Secure; SameSite=Lax`, signé HMAC, vérifié à durée constante | `js/analytics-config.js`, `api/_commun.js` l. 200-215 |
| F13 | Sélection « recruteur » | sur ordinateur, 2 clics « Sélectionner » dans The Book → panier « 2 profils sélectionnés — Demander un casting » → page Sélection avec les 2 profils → formulaire (envoi bloqué : message clair « Erreur lors de l'envoi. Réessayez ou contactez-nous directement. ») | `js/selection.js`, `js/demande-recruteur.js` |
| F14 | Grande photo de fiche | miniature floue affichée d'abord puis photo moyenne en `fetchpriority="high"` : pas d'écran noir observé | `js/rendu-fiche.js` |

---

## 3. Points faibles (vue d'ensemble)

- Protections anti-abus des formulaires publics affaiblies (A4-01, A4-02, A4-03, A4-12).
- Documents internes servis par le site (A4-04).
- Pages HTML jamais en cache + photos en cache 4 h (A4-05, A4-06) → lenteur sur mobile et réseau africain.
- Images d'actualités lourdes et non converties (A4-07).
- Décalages de mise en page sur téléphone (A4-08).
- Parcours client professionnel peu mis en avant (A4-09, A4-10, A4-11).
- Petits défauts SEO / accessibilité (A4-16, A4-17, A4-28 à A4-32).

---

## 4. Bugs fonctionnels

### A4-16 — Les fiches anglaises n'annoncent pas leur version française (hreflang) — **moyenne**
- **Localisation** : `/en/book/<nom>` (28 fiches) ; `en/mannequin.html` (en-tête), `middleware.js:537-539`.
- **Cause** : le serveur **remplace** les balises `<link rel="alternate" hreflang=…>` du gabarit ; or `en/mannequin.html`
  n'en contient aucune, le remplacement ne fait donc rien.
- **Preuve** : `curl /en/book/cleopatre-maria` → seulement `<link rel="canonical">` ; la version FR a bien ses trois
  `hreflang` (fr, en, x-default). 28 pages EN sur 28 concernées.
- **Conséquence** : Google peut traiter les fiches EN comme du contenu en double et montrer la mauvaise langue.
- **Solution** : copier dans `en/mannequin.html` les trois lignes `alternate` de `mannequin.html` (l. 17-19).
- **Risque de régression** : nul. **Vérification** : `curl -s …/en/book/<slug> | grep hreflang` → 3 lignes.

### A4-17 — Adresses sans contenu indexables (« soft 404 ») — **basse**
- `/mannequin` sans identifiant répond **200** « Profil mannequin » sans `h1` ni `noindex` ; `/book/inexistant` répond
  **302** vers `/mannequins` (Google le traite comme une page introuvable déguisée).
- **Solution** : `/mannequin` sans identifiant → `noindex` (ou 404) ; slug inconnu → 404 avec lien vers The Book.
- **Risque** : faible. **Vérification** : `curl -I` sur ces adresses.

### A4-25 — Bug « bloquant » SonarCloud, note de fiabilité tombée à E — **basse**
- `maquettes/essai-medias-drive.sql:283` (arrivé avec `3da0139`) : `update medias_drive_reglage set …` sans `where`.
  C'est un essai annulé sur une table d'une ligne (fausse alerte au fond), mais la note **Fiabilité passe à 5.0 (E)**
  sur sonarcloud.io (relevé 15/11, 21 h 40) — règle n° 8 du projet.
- **Solution** : ajouter `where true` (ou exclure `maquettes/` de l'analyse). **Risque** : nul.
  **Vérification** : API `measures`, `reliability_rating` = 1.0.

---

## 5. UX / UI — les deux visiteurs professionnels

### Promoteur d'événements, iPhone (390×844)
Mesuré : premier écran = logo, EN, Menu, « MA2M », « Les nouveaux visages d'Abidjan », « 28 mannequins à découvrir »,
« Devenir mannequin », bandeau cookies, bulle WhatsApp. Mots sur tout l'accueil : *booking* 1, *défilé* 2,
*devis / tarif / prestation / réserver / clients / références / plaquette* : **0**.
Menu : s'ouvre en 0,4 s (vérifié sur 3 pages). Services : contenu riche (« Défilés & événements »,
« Chorégraphie mode », « Mannequins pour vos projets »), mais **un seul bouton** « Nous contacter ».
Contact : formulaire complet ; envoi (bloqué) → après 9 s « Une erreur est survenue. Réessayez, ou contactez-nous
directement par téléphone. » (message clair, la saisie reste). WhatsApp : lien `wa.me` visible partout.

### Marque partenaire, ordinateur (1440×900)
The Book : 28 profils, 4 filtres, bouton « Sélectionner » sur chaque carte ; panier flottant ; page Sélection ;
formulaire ; envoi (bloqué) → message d'erreur clair après 12 s. Fiche : mesures, compcard, bouton « + Sélectionner
ce mannequin ». **Le parcours marche**, mais rien n'explique au client qu'il peut composer une sélection.

### A4-09 — Aucune porte d'entrée « clients » sur l'accueil — **haute** (enjeu commercial)
- **Localisation** : accueil FR/EN (`index.html`, `js/accueil.js`).
- **Cause** : l'accueil « magazine » s'adresse aux mannequins et au public ; aucun bloc « Vous organisez un défilé,
  une campagne ? » ; aucune référence client sur le premier écran.
- **Conséquence** : un promoteur qui arrive depuis Instagram ne voit pas en 5 s que l'agence fournit des mannequins
  pour son événement ; il repart, ou écrit sur WhatsApp sans contexte.
- **Solution** : un bloc court « Pour les marques et organisateurs » (3 prestations, logos partenaires, deux boutons :
  « Composer ma sélection dans The Book » et « Demander une proposition ») ; à valider par la propriétaire.
- **Risque** : faible (ajout). **Vérification** : parcours promoteur rejoué (`pros.js`) : bouton visible sans défiler.

### A4-10 — Confiance : adresses Gmail, pas d'adresse physique, pas de plaquette agence — **moyenne**
- **Preuve** : page Contact = deux adresses `@gmail.com` ; pied de page « Abidjan, Côte d'Ivoire » sans adresse ni
  horaires ; `/plaquette` (5,9 Mo) est la plaquette des **cours de talons** et n'est liée nulle part.
- **Conséquence** : une marque ou une institution juge souvent le sérieux à l'adresse e-mail et à l'existence d'un
  dossier de présentation.
- **Solution** : adresse e-mail au nom de domaine du site (redirigée vers la boîte actuelle), quartier et horaires,
  plaquette « agence » (PDF < 2 Mo) liée depuis Services et Contact.
- **Risque** : nul. **Vérification** : relire Contact et Services sur iPhone.

### A4-11 — Formulaire de contact : pas de choix « Promoteur / organisateur », pas de date ni de nombre — **basse**
- `contact.html:184-191` : choix Marque, Média, Mannequin, Particulier, Autre. Le promoteur doit prendre « Autre ».
- **Solution** : ajouter « Promoteur / organisateur d'événement », et deux champs facultatifs « Date de l'événement »
  et « Nombre de mannequins » (comme la page Sélection). **Vérification** : test visiteur du formulaire.

### A4-26 — La bulle WhatsApp cache le titre de l'accueil sur iPhone — **basse**
- **Preuve** : capture `agent-4/captures/promoteur-1-accueil.png` : la bulle verte couvre le début de « …D'ABIDJAN ».
- **Solution** : décaler la bulle ou réserver une marge au titre. **Vérification** : capture iPhone.

### A4-27 — Longue attente sans solution de repli quand l'envoi échoue — **basse**
- Envoi bloqué : le message d'erreur arrive après **9 s** (contact) et **12 s** (sélection) ; pendant ce temps, un
  seul « Envoi en cours… ». Sur réseau faible, un client peut cliquer plusieurs fois ou partir.
- **Solution** : proposer dès l'échec un bouton « Envoyer par WhatsApp » pré-rempli avec le texte saisi.

---

## 6. Performance (mesurée)

### Lighthouse 12.2.1 (laboratoire, mobile simulé « 4G lente » et ordinateur)

| Page | Mobile perf | LCP mobile | TBT | Poids | Ordinateur perf | LCP | CLS |
|---|---|---|---|---|---|---|---|
| Accueil | 87 | 3,6 s | 149 ms | 825 Ko | 98 | 0,9 s | 0,053 |
| The Book | 95 | 2,6 s | 142 ms | 808 Ko | 95 | 1,0 s | **0,120** |
| Fiche (Traoré Maria) | 85 | 4,1 s | 159 ms | 895 Ko | 100 | 0,7 s | 0,007 |
| Actualités | **81** | **4,9 s** | 65 ms | **1 447 Ko** | 98 | 1,0 s | 0,063 (2,2 Mo) |
| Candidature | 98 | 2,3 s | 54 ms | 808 Ko | 100 | 0,5 s | 0,042 |
| Contact | 92 | 3,1 s | 134 ms | 536 Ko | 100 | 0,7 s | 0,040 |

Accessibilité, bonnes pratiques et SEO : **100** partout. Gains signalés sur chaque page : JavaScript inutilisé
~91 Ko, CSS inutilisé ~44 Ko, JS non minifié ~55 Ko, CSS non minifié ~19 Ko.

### Navigateur réel (Playwright), 3 appareils, 10 pages
- iPhone : LCP 0,6-1,6 s, chargement 2,1-3,2 s, ~450-770 Ko, 49-74 requêtes.
- **Android moyen, 1,6 Mbit/s, 150 ms, processeur ÷4** : LCP accueil 2,7 s, fiche 1,9 s, Actualités 2,1 s,
  **The Book 6,7 s**, accueil EN 3,0 s ; chargement complet 5,7 à 9,0 s.
- Temps de réponse du serveur (TTFB, 15 essais depuis l'hébergeur de l'audit) : accueil 0,16-0,38 s,
  The Book 0,18-0,76 s, **fiche 0,45-0,63 s**. Compression Brotli active sur le HTML, le JS et le CSS.

### A4-05 — Les pages publiques ne sont jamais servies depuis le cache — **haute**
- **Localisation** : `middleware.js:585-587` (en-têtes), `middleware.js:161` (lecture de la base à chaque page).
- **Cause** : les pages sont fabriquées par le *middleware* à chaque visite. Vercel ne met pas en cache les réponses
  du middleware : l'en-tête `s-maxage=60` est sans effet (aucun `x-vercel-cache` dans les réponses), et
  `Vary: User-Agent, Cookie` fragmenterait de toute façon le cache par modèle de téléphone.
- **Preuve** : 15 relevés `curl` : `x-ma2m-render: ssr`, jamais d'en-tête de cache ; TTFB de la fiche jamais sous 0,44 s.
- **Conséquence** : chaque visite = plusieurs requêtes Supabase (latence en plus pour Abidjan, consommation des
  quotas gratuits Vercel/Supabase, page lente si la base est lente).
- **Solution (à comparer entre agents)** : (a) faire fabriquer les pages par une fonction mise en cache (ISR /
  `s-maxage` respecté) et garder le middleware pour la seule redirection ; ou (b) mettre en cache les lectures
  Supabase du middleware ; retirer `User-Agent` de `Vary` (garder `Sec-CH-UA-Mobile`).
- **Risque** : moyen (rendu des pages publiques, variante « site vivant », limite de 12 fonctions).
  **Vérification** : `x-vercel-cache: HIT` au 2e appel, TTFB < 100 ms, test visiteur complet.

### A4-06 — Photos gardées 4 h seulement par les téléphones — **haute**
- **Localisation** : domaine `photos.maitreakessemodelmanagement.com` (Cloudflare R2).
- **Preuve** : `cache-control: max-age=14400` sur les photos (Lighthouse : 13 à 26 ressources « cache court » par
  page), alors que leurs noms contiennent un horodatage et ne changent jamais (`…/moyennes/1792635937419-kmhofi-w.webp`).
  À comparer : le relais `/book-photos/` du site a, lui, `max-age=31536000, immutable` (`vercel.json:118-124`).
- **Conséquence** : une visiteuse qui revient le lendemain retélécharge toutes les photos (coût data, lenteur).
- **Solution** : règle Cloudflare de cache navigateur = 1 an + `immutable` sur ce domaine (aucun code).
- **Risque** : nul tant que les noms restent uniques. **Vérification** : `curl -I` → `max-age=31536000`.

### A4-07 — Photos des actualités en JPEG trop grands — **moyenne**
- **Preuve** : Lighthouse mobile Actualités : images surdimensionnées **511 Ko** à gagner, formats modernes **314 Ko** ;
  ex. `/site/actualites/f0f360c3…/1791326234480-119801.jpg` = 421 Ko pour une vignette (286 Ko de trop). Fiche :
  262 Ko à gagner. Ordinateur : Actualités 2,2 Mo.
- **Cause** : photos d'actualités servies en original JPEG (pas de versions « petites/moyennes » WebP comme le Book).
- **Solution** : réutiliser la préparation des photos du Book (versions 480/800/1600 WebP + `srcset`) pour les
  actualités et événements (fonction partagée, règle n° 5).
- **Risque** : moyen (anciennes actualités à reconvertir). **Vérification** : Lighthouse mobile Actualités ≥ 90.

### A4-13 — JavaScript et CSS communs lourds et non minifiés — **moyenne**
- **Preuve** : `js/app.js` 230 Ko (78 Ko compressé), `css/style.css` 214 Ko (52 Ko), `supabase-js` 207 Ko chargés sur
  toutes les pages ; Lighthouse : ~91 Ko de JS et ~44 Ko de CSS inutilisés par page, ~75 Ko de minification possible.
- **Solution** : minifier à la publication puis découper `app.js` par page.
- **Risque** : moyen (empreintes CSP à recalculer si des scripts en ligne changent). **Vérification** : Lighthouse.

### A4-14 — Images sans dimensions réservées — **basse**
- Mesuré : 8 à 36 images par page sans `width/height` (The Book : 36/37), 29 images sur 37 plus grandes que
  nécessaire sur The Book (ordinateur). Contribue au CLS ordinateur de The Book (0,12).
- **Solution** : `width`/`height` (ou `aspect-ratio`) dans les gabarits de cartes. **Vérification** : Lighthouse CLS.

---

## 7. Images et médias

- Fond pendant le chargement : pas d'écran noir sur la fiche (F14). Book en WebP (bien), actualités en JPEG (A4-07).
  Cache : A4-06. `/plaquette` : 5,9 Mo, à alléger si elle est envoyée sur WhatsApp.
- 500 photos de mannequins lisibles via l'API publique (normal pour un book public), mais avec des **commentaires
  internes** (A4-15).

---

## 8. Responsive

- 30 mesures (iPhone, Android, ordinateur × 10 pages) : **aucun défilement horizontal**, un seul `h1` par page.
- A4-26 (bulle WhatsApp sur le titre), A4-08 (décalages pendant la lecture).

### A4-08 — La page bouge pendant la lecture sur téléphone (CLS) — **moyenne**
- **Preuve** (iPhone, navigateur réel, défilement après 2,5 s) : CLS Candidature **0,273** (Android lent 0,241),
  Services 0,167, Partenaires 0,162, Contact 0,112 (bon : < 0,1). Sources : `.lx-promesse` + images (Candidature),
  `SECTION .u-mt-1-2` (Services), `.u-pt-1 .reveal` (Partenaires), `.contact-bloc` (Contact), entre 2,4 et 3,1 s.
  Lighthouse ne le voit pas (il ne défile pas).
- **Cause probable** : `js/css-differe.js` ajoute les feuilles de style **complètes** après la grande photo (ou 1,5 s) ;
  le CSS critique ne couvre que le haut de l'écran ; quand le reste arrive, les blocs plus bas changent de taille.
- **Solution** : réserver les hauteurs des blocs sous la ligne de flottaison dans le CSS critique, ou charger les
  feuilles complètes plus tôt (dès le premier affichage).
- **Risque** : moyen (vitesse du premier affichage). **Vérification** : script `cls.js` → CLS < 0,1 sur les 4 pages.

---

## 9. Code et architecture (sous l'angle sécurité/performance)

- `api/` : 11 fonctions + modules `_commun.js`, `_r2.js` ; contrôle d'accès cohérent (F5).
- **A4-18 — Fonction d'échappement HTML recopiée** (basse) : `echapper` redéfinie dans au moins 7 fichiers
  (`js/messages-groupes.js:53`, `js/parcours.js:21`, `js/partage.js:237`, `js/rendu-agenda.js:9`, `js/rendu-book.js:7`,
  `js/gabarit.js:122`, `middleware.js:127`) au lieu de `echapperHtml` (`js/app.js:107`) — règle n° 5.
  Solution : une seule fonction partagée. Vérification : `grep -n "function echapper"`.
- **A4-19 — Dépendance inutile** (basse) : `@anthropic-ai/sdk` dans `package.json`, utilisée nulle part.
  Solution : la retirer. Vérification : `npm ls`, fonctions toujours déployées.
- **A4-20 — Bibliothèques recopiées non surveillées** (basse) : `js/vendor/` (EmailJS 3.12.1, pdf-lib 1.17.1 —
  bibliothèque plus maintenue —, jsPDF 4.2.1, DOMPurify 3.4.16, Quill 2.0.3) échappent à `npm audit`.
  Solution : liste des versions dans `README-TECHNIQUE.md` et contrôle mensuel.
- Chemin de secours dangereux dans `api/portail.js:313-319` : voir A4-12.

---

## 10. Sécurité (angle principal)

### Ce qu'un visiteur anonyme lit dans la base (clé publique, lectures GET seulement)
Relevé du 15/11 sur 127 tables/vues (liste issue des fichiers SQL et du code) :
- **Lisibles et non vides** : `actualites` (10), `actualite_photos` (21), `actualite_partenaires` (1), `evenements` (5),
  `evenement_photos` (152), `partenaires` (5), `bandeau_annonce`, `mot_responsable`, `reglages_site` (2),
  `instagram_posts_cache`, `notifications_reglages` (9, clés + actif), `cours_talons_programme` (7),
  `formation_programme` (27), `model_profiles` (28 publiés, colonnes publiques), `model_photos` (500, toutes des 28
  publiés), `model_projects` (72, tous des publiés). Fonctions : `agenda_public` (5 projets avec mannequins),
  `vitrine_eligibles` (22 identifiants), `moyens_paiement_publics` (1 moyen : numéro, titulaire — voulu pour payer).
- **Lisibles mais vides pour lui (RLS)** : 46 tables, dont `admins`, `casting_applications`, `messages_contact`,
  `recruiter_requests`, `journal_erreurs`, `connexion_tentatives_*`, `invite_codes`, `liens_wave`.
- **Refusées (401)** : 64 tables, dont paiements, comptabilité, équipe, contacts parents, présences, bulletins.
- **Conclusion** : aucune donnée personnelle privée exposée. Deux remarques : A4-15 et A4-23.

### A4-01 — L'anti-robots des formulaires publics ne bloque rien — **haute**
- **Localisation** : `api/portail.js:293` (`const ANTI_ROBOTS_STRICT = false;`), l. 300-303.
- **Cause** : depuis le 01/11 (« tant que la cause n'est pas connue »), un jeton Turnstile absent ou faux est
  **accepté** ; seule une note part au journal.
- **Conséquence** : un robot peut envoyer candidatures, messages, demandes recruteur et inscriptions aux cours sans
  passer l'anti-robots ; seules les limites par adresse IP (3 à 6 par minute et par IP, contournables avec plusieurs
  adresses) protègent : boîte de l'agence noyée, notifications push en rafale, fausses données.
- **Solution** : lire le journal (`[Anti-robots] vérification non aboutie : …`) pour connaître la cause des refus,
  la corriger (domaine déclaré chez Cloudflare, clé), puis repasser à `true`.
- **Risque** : vrais candidats refusés si la cause n'est pas corrigée → passer à `true` seulement après 7 jours sans
  refus légitime au journal. **Vérification** : envoi d'essai avec l'accord de la propriétaire.

### A4-02 — L'enregistrement des formulaires accepte toutes les colonnes envoyées — **haute**
- **Localisation** : `supabase-cours-talons.sql:69-113` (`formulaire_public_enregistrer`), appelée par
  `api/portail.js:305`.
- **Cause** : la fonction (`security definer`, au-dessus des droits RLS) insère **toute colonne existante** présente
  dans l'objet envoyé (`information_schema.columns … where ligne ? c.column_name`). Seul `status` est contrôlé, et
  seulement pour `casting_applications` et `recruiter_requests` ; rien pour `messages_contact`.
- **Conséquence** : un visiteur peut choisir lui-même `id`, `created_at` (passer en tête ou au fond de la liste),
  `statut_change_at`, `candidature_id`, le statut d'un message de contact, etc. Pas de fuite de données, mais les
  listes de l'Administration ne sont plus fiables.
- **Solution** : une **liste blanche** de colonnes par formulaire (celles que le site envoie réellement :
  `js/formulaire-candidature.js`, `js/contact.js`, `js/demande-recruteur.js`, `js/cours-talons.js`) ; forcer
  `created_at = now()`.
- **Risque** : un champ oublié dans la liste serait perdu → tests visiteur. **Vérification** : base d'essai
  (`scripts/base-essai/`) avec une colonne interdite → ignorée.

### A4-03 — « Créer mon compte » de l'équipe : comptes confirmés pour n'importe quelle adresse, sans anti-robots — **haute**
- **Localisation** : `api/portail.js:333-360` (`demandeAcces`).
- **Cause** : action publique ; crée un compte Supabase avec `email_confirm: true` **sans vérifier que la personne
  possède l'adresse** ; pas de Turnstile ; limite **globale** de 10 demandes par heure.
- **Conséquences** : (1) quelqu'un peut « réserver » l'adresse d'une future employée ou d'une mannequin : à son tour,
  elle reçoit « Un compte existe déjà avec cette adresse » ; (2) 10 demandes factices par heure suffisent à bloquer
  toute vraie demande (« Trop de demandes en ce moment ») ; (3) ces comptes sont des comptes « connectés » : tous les
  droits RLS « personne connectée » doivent tenir face à eux (non testé ici : création interdite pendant l'audit).
- **Solution** : Turnstile obligatoire sur cette action + compte **non confirmé** (lien de confirmation) ou demande
  stockée sans compte tant que l'administratrice n'a pas accepté ; limite par IP en plus.
- **Risque** : moyen (incident du 04-11/10 sur « Créer mon compte ») → essai réel avec compte de test et accord de la
  propriétaire (règle n° 3). **Vérification** : même adresse deux fois, 11 demandes, adresse non confirmée.

### A4-04 — Documents internes servis publiquement par le site — **haute**
- **Preuve** (`curl`, 200) : `/docs/rls-matrix.md`, `/docs/falsification.md`, `/docs/runbook-rollback.md`,
  `/docs/routes.md`, `/docs/admin-report.md`, `/docs/code-report.md`, `/docs/balayage-09-11.md`,
  `/docs/visitor-report.md`, `/docs/etat-fin-seance-08-11.md`, `/GUIDE-DE-SECOURS.md`, `/DECISIONS.md`, `/AGENTS.md`,
  `/CONVENTIONS.md`. (À l'inverse `*.sql`, `README-TECHNIQUE.md`, `scripts/`, `maquettes/` : 404, bien exclus.)
- **Cause** : `.vercelignore` n'exclut pas `docs/` ni ces fichiers.
- **Conséquence** : la carte des droits de la base et les faiblesses connues sont sur le domaine de l'agence ; **les
  rapports de cette mission (`docs/mission-15-11/`) y seraient publiés dès leur fusion**. Le dépôt GitHub est public
  (vérifié : `visibility: public`), ce qui limite l'effet, mais personne n'a même besoin de chercher.
- **Solution** : ajouter `docs/`, `DECISIONS.md`, `GUIDE-DE-SECOURS.md`, `AGENTS.md`, `CONVENTIONS.md` à
  `.vercelignore` **avant** de fusionner les rapports ; envisager de rendre le dépôt privé.
- **Risque** : nul. **Vérification** : `curl -I /docs/rls-matrix.md` → 404.

### A4-12 — Chemin de secours qui contourne limites et contrôles — **moyenne**
- **Localisation** : `api/portail.js:313-319`.
- **Cause** : si l'erreur de la base contient « does not exist » (ou PGRST202), le serveur réinsère la ligne
  **directement avec la clé secrète** (sans limite par IP, sans contrôle « casting ouvert », toutes colonnes sauf
  `status`). Ce secours servait avant l'installation de l'Extension 152, aujourd'hui en place.
- **Solution** : supprimer ce secours (garder seulement le cas `cours_talons` des l. 309-312).
- **Risque** : faible. **Vérification** : relecture + test visiteur des formulaires.

### A4-15 — Commentaires internes du tri des photos lisibles par tous — **moyenne**
- **Preuve** : `model_photos` expose `tri_raison`, `tri_confiance`, `tri_statut`, `tri_manuel` ; ex. lu en anonyme :
  « Proposée à la suppression : Trop proche des photos 3 et 4 de la même série, avec un rendu moins fort et un visage
  peu lisible. » (226 photos sur 500 ont un commentaire).
- **Conséquence** : jugements internes sur les photos des mannequins lisibles par n'importe qui (et par elles).
- **Solution** : `revoke select (tri_raison, tri_confiance, tri_manuel, tri_date) on model_photos from anon` (après
  avoir vérifié que les pages publiques ne les lisent pas : `js/fiche-mannequin.js:49` lit seulement `tri_statut`).
- **Risque** : faible. **Vérification** : GET anonyme `model_photos?select=tri_raison` → 401.

### A4-21 — En-tête CSP global encore avec `'unsafe-inline'` — **moyenne**
- **Localisation** : `vercel.json:59-60`.
- **Preuve** : Observatory www : 1 test échoué (CSP) contre 0 pour admin/app ; 9 pages sans meta CSP propre, donc
  protégées seulement par l'en-tête permissif : `/places`, `/recu`, `/confirmer`, `/accord-parent`,
  `/programme-talons` (pages à **lien personnel**), pages 404 FR/EN. Aucune n'a de script en ligne (`grep` = 0).
- **Solution** : retirer `'unsafe-inline'` de `script-src` dans l'en-tête global (toutes les pages sont migrées,
  `README-TECHNIQUE.md:2084`).
- **Risque** : faible (essayer les 5 pages dans un navigateur). **Vérification** : Observatory 12/12.

### A4-22 — Réception WhatsApp : sans clé Meta, n'importe qui peut écrire dans le journal WhatsApp — **moyenne** (à vérifier)
- **Localisation** : `api/whatsapp-webhook.js:85-103`.
- **Cause** : si `WHATSAPP_APP_SECRET` est absente, la signature n'est pas vérifiée ; il suffit alors de mettre
  l'identifiant du compte WhatsApp de l'agence, **écrit en clair dans le dépôt public** (l. 17).
- **Conséquence** : faux statuts « échec » / faux messages reçus dans l'Administration.
- **Solution** : refuser (401) toute réception non signée ; vérifier dans Vercel que la variable existe.
- **Risque** : nul si la variable existe. **Vérification** : liste des noms de variables Vercel (agent ayant les accès).

### A4-23 — Messages d'erreur trop bavards — **basse**
- `api/portail.js:507`, `api/r2-presigner.js:79` renvoient `e.message` brut au navigateur ; l'API de la base répond
  « Perhaps you meant the function public.agenda_public » (révèle des noms de fonctions) et `GRANT SELECT ON
  public.<table>` (confirme l'existence des tables). Solution : message neutre côté serveur.

### A4-24 — Divers sécurité — **basse**
- HSTS annonce `preload` mais le domaine n'est **pas** dans la liste de préchargement (SSL Labs : `absent`) : l'inscrire
  sur hstspreload.org (après vérification du domaine nu) ou retirer le mot.
- La 2e adresse IP de Vercel (64.29.17.1) répond **403** à SSL Labs (pare-feu Vercel), d'où la note A au lieu de A+ ;
  sans conséquence pour les visiteurs, mais vérifier que Google et les aperçus WhatsApp ne sont pas bloqués de même.
- `access-control-allow-origin: *` sur les pages HTML (réglage Vercel par défaut) : sans risque tant que les pages à
  lien personnel restent `private, no-store` (vérifié dans le code, `middleware.js:585`).
- La signature du cookie admin utilise la clé `service_role` comme secret HMAC (`api/_commun.js:203`) : une clé, deux
  usages ; prévoir une clé dédiée.
- `x-ma2m-build` révèle la version (sans effet, dépôt public).
- Scripts `js/portail/*` (comptabilité, paiements) téléchargeables sans connexion ; les données restent protégées par
  la base, et la « protection des scripts » de `middleware.js` n'a guère d'effet avec un dépôt public.

---

## 11. SEO et accessibilité

- Lighthouse SEO et accessibilité : **100** sur les 12 passages. W3C : 0 à 3 erreurs par page (9 pages).
- A4-16 (hreflang EN), A4-17 (soft 404).
- Clavier : 12 tabulations sur l'accueil — ordre logique (évitement, logo, EN, Menu, cookies, contenu).

### A4-28 — Le nom du mannequin (h1) est caché aux lecteurs d'écran sur la fiche — **moyenne**
- **Localisation** : `js/rendu-fiche.js` (bloc `profil-hero-fullbleed`), HTML servi l. 123-129.
- **Preuve** : W3C « h1 must not appear as a descendant of an element with role=button » ; Lighthouse
  `label-content-name-mismatch` en échec. Le bloc `role="button" aria-label="Ouvrir la galerie photo"` contient le `h1`
  « TRAORÉ MARIA » : un lecteur d'écran annonce « Ouvrir la galerie photo, bouton » et perd le titre de la page.
- **Solution** : sortir le texte (`h1`, catégorie, ville) du bouton ; le bouton ne couvre que la photo.
- **Risque** : faible (mise en page du haut de fiche). **Vérification** : W3C sans erreur sur la fiche.

### A4-29 — Petites erreurs W3C — **basse**
- `candidature` : `<img alt="Aperçu de votre vidéo">` sans `src` (l. 310) ; premier `option` d'un `select required`
  (indicatif) sans valeur vide (l. 167) ; propriété CSS `mask` non reconnue dans le CSS critique (l. 29-32).

### A4-30 — Titres et descriptions trop longs — **basse**
- Titres > 65 caractères : Actualités (67), Cours de talons (76/73), une fiche (70). Descriptions de 190 à 255
  caractères sur les 20 pages `?actu=` et `?evenement=` (coupées dans Google ; viser 150-160).

### A4-31 — Adresse de fiche différente du nom affiché — **basse**
- `/book/cleopatre-maria` affiche « TRAORÉ MARIA ». Si le nom a changé : nouvelle adresse + redirection 301.

### A4-32 — Pages privées sans `og:image` — **basse**
- `/programme-talons`, `/confirmer`, `/accord-parent`, `/reinitialiser-mot-de-passe`, `/selection` : `noindex` déjà
  posé (bien) ; ajouter `og:image` pour un aperçu propre quand ces liens sont envoyés sur WhatsApp.

---

## 12. Infrastructure

- Vercel (offre gratuite, fonctions en `iad1` – Washington), Supabase, Cloudflare R2 (photos), Cloudflare Turnstile,
  Google Analytics, Sentry. Mise en ligne automatique depuis `main` (`3da0139` est arrivée pendant l'audit).
- Le middleware tourne à **chaque** page publique (A4-05) : consommation du quota gratuit.
- Photos : deux chemins (`photos.` Cloudflare et `/book-photos/` Vercel) avec deux politiques de cache (A4-06).
- SonarCloud : sécurité A, maintenabilité A, **fiabilité E** (A4-25), 6 926 « odeurs de code », 504 remarques
  critiques (surtout des textes répétés dans les SQL), 0 point chaud de sécurité à revoir.

---

## 13. Risques

| Risque | Probabilité | Impact | Lié à |
|---|---|---|---|
| Vague de spam sur les formulaires et notifications | moyenne | moyen | A4-01, A4-02, A4-12 |
| Blocage de « Créer mon compte » ou adresse « réservée » par un tiers | faible à moyenne | moyen | A4-03 |
| Rapports de sécurité publiés sur le site | **élevée** si fusion sans changement | moyen | A4-04 |
| Lenteur ressentie sur téléphone à Abidjan | élevée | moyen (image de marque) | A4-05, A4-06, A4-07 |
| Clients professionnels qui ne trouvent pas l'offre | élevée | élevé (chiffre d'affaires) | A4-09, A4-10 |

---

## 14. Recommandations (dans l'ordre)

1. **Avant toute fusion des rapports** : `.vercelignore` complété (A4-04).
2. Anti-robots en mode strict une fois sa cause trouvée (A4-01) ; liste blanche des colonnes (A4-02) ; retirer le
   secours (A4-12).
3. Sécuriser « Créer mon compte » (A4-03), avec essai réel autorisé.
4. Cache des photos 1 an (A4-06, sans code) puis cache des pages (A4-05).
5. Actualités en WebP redimensionné (A4-07) ; minification (A4-13) ; CLS (A4-08).
6. Bloc « Clients » sur l'accueil + confiance (A4-09, A4-10, A4-11).
7. Colonnes de tri retirées des lectures publiques (A4-15) ; CSP globale stricte (A4-21).
8. Corrections SEO/accessibilité rapides (A4-16, A4-28, A4-29, A4-30).

---

## 15. Priorités de correction (liste complète)

| ID | Gravité | Sujet | Effort |
|---|---|---|---|
| A4-01 | haute | Anti-robots non bloquant | petit (après diagnostic) |
| A4-02 | haute | Formulaires : toutes colonnes acceptées | moyen (SQL) |
| A4-03 | haute | Création de compte équipe ouverte | moyen |
| A4-04 | haute | Documents internes publiés | très petit |
| A4-05 | haute | Pages jamais en cache | gros |
| A4-06 | haute | Photos en cache 4 h | très petit (Cloudflare) |
| A4-09 | haute | Aucune entrée « clients » sur l'accueil | moyen (décision propriétaire) |
| A4-07 | moyenne | Photos d'actualités lourdes | moyen |
| A4-08 | moyenne | CLS pendant la lecture | moyen |
| A4-10 | moyenne | Confiance (Gmail, adresse, plaquette) | petit |
| A4-12 | moyenne | Secours qui contourne les contrôles | petit |
| A4-13 | moyenne | JS/CSS lourds non minifiés | moyen |
| A4-15 | moyenne | Commentaires de tri publics | petit (SQL) |
| A4-16 | moyenne | hreflang absents des fiches EN | très petit |
| A4-21 | moyenne | CSP globale `'unsafe-inline'` | petit |
| A4-22 | moyenne | Réception WhatsApp non signée possible | petit |
| A4-28 | moyenne | h1 de la fiche dans un bouton | petit |
| A4-11 | basse | Choix « Promoteur » au contact | très petit |
| A4-14 | basse | Images sans dimensions | petit |
| A4-17 | basse | Soft 404 | petit |
| A4-18 | basse | Échappement recopié | petit |
| A4-19 | basse | Dépendance inutile | très petit |
| A4-20 | basse | Bibliothèques recopiées non suivies | petit |
| A4-23 | basse | Messages d'erreur bavards | petit |
| A4-24 | basse | Divers sécurité (HSTS preload, 403 Vercel, clé HMAC…) | petit |
| A4-25 | basse | Bug SonarCloud / fiabilité E | très petit |
| A4-26 | basse | Bulle WhatsApp sur le titre | très petit |
| A4-27 | basse | Attente de 9-12 s sans repli | petit |
| A4-29 | basse | Erreurs W3C | très petit |
| A4-30 | basse | Titres/descriptions trop longs | petit |
| A4-31 | basse | Slug ≠ nom affiché | petit |
| A4-32 | basse | og:image des pages privées | très petit |

Total : **0 critique, 7 hautes, 10 moyennes, 15 basses = 32 problèmes.**

---

## Annexe — méthode et preuves

- Scripts (scratchpad `mission/agent-4/scripts/`) : `seo.py` (127 pages), `anon.py`, `anon2.py`, `anon-rpc.py`
  (lecture anonyme de la base), `mesures.js` (30 mesures navigateur), `lh.sh` (12 Lighthouse), `w3c.py`,
  `pros.js` (parcours promoteur / marque), `menu.js`, `cls.js`, `candidate.js`.
- Résultats bruts : `seo.jsonl`, `anon-tables.jsonl`, `mesures.jsonl`, `lh/*.json`, captures `captures/*.png`.
- Limites : mesures faites depuis un centre de données (pas depuis Abidjan) ; polices Google bloquées par le proxy
  de l'audit pendant les mesures navigateur (poids légèrement sous-estimés) ; poids des photos du domaine `photos.`
  non comptés par l'API du navigateur (Lighthouse, lui, les compte) ; aucun casting ouvert le 15/11, le formulaire
  de candidature était donc caché (parcours candidate laissé aux autres agents) ; rien d'écrit, donc A4-02, A4-03 et
  A4-22 sont démontrés par le code, pas par un essai.
