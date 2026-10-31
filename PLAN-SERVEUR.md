# Passer le site « aux normes dynamiques » : état des lieux et choix (31/10/2026)

Aucun secret dans ce fichier (dépôt public ; il n'est pas publié sur le site : `.vercelignore`).
Rien n'est codé : la propriétaire choisit, puis on avance étape par étape, chaque étape essayée et mise en
ligne avec son accord, avec un retour en arrière possible.

## 1. En simple

**Le site est déjà en partie dynamique.** Les mannequins, actualités, événements, castings, paiements… viennent
d'une vraie base de données (Supabase), et une partie tourne déjà sur un serveur : l'accueil est préparé
par le serveur, les aperçus WhatsApp aussi, ainsi que la connexion protégée, l'envoi des photos et les
notifications. Ce qui manque surtout, c'est que **les pages publiques (Book, fiche d'un mannequin, actualités)
soient préparées par le serveur** au lieu d'être remplies dans le téléphone du visiteur, et quelques
protections qui ne peuvent exister que sur un serveur.

Trois chemins possibles :

| | A. Renforcer le site actuel (conseillé) | B. Tout reconstruire (Next.js) | C. Le produit à vendre |
|---|---|---|---|
| Ce que c'est | ajouter le serveur là où il apporte quelque chose, page par page | réécrire tout le site dans un outil « dynamique » complet | une application séparée, pensée dès le départ pour plusieurs agences clientes |
| Risque pour le site actuel | faible (petites étapes, retour en arrière) | élevé (des centaines d'écrans et d'essais à refaire) | nul (projet à part) |
| Durée | quelques semaines, au fil de l'eau | plusieurs mois | plusieurs mois, après A |
| Gain visible | pages plus rapides, mieux trouvées sur Google, formulaires protégés | le même que A, plus tard | une offre commerciale |

**Ma recommandation : A maintenant, puis C comme un vrai projet à part.** Reconstruire le site actuel (B)
coûterait beaucoup pour un gain que A donne déjà, et casserait des choses qui marchent. Pour vendre
l'application à d'autres agences, il vaut mieux un produit neuf, propre, prévu pour plusieurs clients
(chaque agence ne voit que ses données, son logo, ses couleurs, son abonnement) : on le construit en
reprenant tout ce qu'on a appris ici, sans mettre en danger le site de l'agence.

Deux points à savoir avant de décider :
- **Hébergement** : l'offre gratuite de Vercel est réservée à un usage non commercial, et limite le nombre
  de fonctions serveur (11 aujourd'hui, toutes prises) et de mises en ligne. Pour un site d'entreprise, et
  plus encore pour une application vendue, l'offre payante (environ 20 $ par mois) deviendra nécessaire.
- **Données personnelles** : vendre une application qui garde des données de mannequins (dont des mineures)
  demande de respecter la loi ivoirienne sur les données personnelles (déclaration à l'ARTCI) : à prévoir
  avec un juriste avant la première vente.

**Décision de la propriétaire (31/10/2026) : chemin A — on rend le site dynamique en renforçant le site
actuel, étape par étape (section 4). Passage à l'offre Vercel Pro au moment de la commercialisation (C).**

## 2. Ce qui est déjà protégé côté serveur

- Connexion de l'Administration : mot de passe vérifié par le serveur avec blocage après trop d'erreurs
  (`api/connexion-protegee.js`), double authentification obligatoire, code à 4 chiffres par appareil,
  appareils révocables, droits contrôlés par la base (RLS, `portail_appareil_ok`).
- Envoi des photos vers R2 : adresse d'envoi signée par le serveur, dossier et taille contrôlés
  (`api/r2-site-images.js`, `api/r2-presigner.js`).
- Accueil préparé par le serveur et aperçus des liens (`middleware.js`), scripts de l'Administration
  réservés, en-têtes de sécurité (`vercel.json`).
- Suppression d'un mannequin, notifications, WhatsApp, codes : fonctions serveur (`api/`).

## 3. Ce qui manque (d'après `SECURITY.md` et l'audit)

| Manque | Solution la plus simple | Risque | Limite gratuite |
|---|---|---|---|
| Pages publiques remplies dans le navigateur (Book, fiche, actualités, événements) : plus lent, moins bien lu par Google | les préparer dans `middleware.js` comme l'accueil (même méthode, déjà éprouvée) | faible | aucune nouvelle fonction |
| Formulaires publics (candidature, contact recruteur) sans limite de débit ni anti-robot | Cloudflare Turnstile (gratuit) + compteur par adresse dans la base, vérifiés par une action de `api/portail.js` | moyen (ne pas bloquer de vraies candidates : essais réels) | pas de nouvelle fonction |
| Contenu réel des fichiers envoyés non vérifié (seul le type annoncé l'est) | lire les premiers octets du fichier côté serveur avant de signer l'envoi R2 | faible | — |
| Appareil de confiance | chantier 6 (`PLAN-APPAREIL-CONFIANCE.md`) | à essayer pour de vrai | — |
| Surveillance | journal des erreurs serveur + alerte e-mail si une fonction échoue souvent | faible | — |
| Limite de 11 fonctions | regrouper par actions (déjà fait pour `api/portail.js`) ou offre payante | — | bloquant à terme |

## 4. Étapes proposées pour A (une à la fois, chacune avec essais et accord)

1. Fiche d'un mannequin préparée par le serveur (la page la plus partagée) ; mesure avant / après.
2. Book et actualités / événements préparés par le serveur.
3. Formulaires publics : anti-robot et limite de débit (essai réel avec une vraie candidature de test).
4. Vérification du contenu des fichiers envoyés.
5. Surveillance des fonctions serveur.

## 5. Pour C (le produit à vendre), quand A sera fait

Un cahier des charges d'abord (qui achète, quel prix, quelles fonctions, quelles données), puis une
maquette ; base de données « multi-agences » dès le départ (chaque ligne appartient à une agence, règles
RLS par agence), personnalisation (logo, couleurs, nom de domaine), abonnements, conditions d'utilisation
et protection des données. Rien ne sera lancé sans la décision de la propriétaire.
