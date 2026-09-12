# README-TECHNIQUE.md — Maître Akesse Model Management (MA2M)

Documentation pour tout développeur (humain ou IA) qui reprendrait ce
projet.

## Vue d'ensemble

Site statique (HTML / CSS / JavaScript, aucun framework) pour une agence
de mannequins à Abidjan. Aucun serveur applicatif : Supabase joue le rôle
de backend (base de données PostgreSQL, authentification, stockage de
fichiers), appelé directement depuis le navigateur.

- **Hébergement** : Vercel (déploiement par dépôt d'une archive .zip)
- **Backend** : Supabase (projet `dfhghgmwmxiguhtxtsle`)
- **E-mails automatiques** : EmailJS
- **Domaine** : maitreakessemodelmanagement.com (DNS via Spaceship)

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

## Structure des fichiers

```
index.html                 Page d'accueil
services.html               Présentation des services + valeurs
mannequins.html              "The Book" — répertoire des mannequins
mannequin.html                Fiche publique d'un mannequin
actualites.html                Actualités de l'agence (+ admin)
partenaires.html                 "Nos partenaires" (+ admin)
candidature.html                  Candidature casting
inscription-mannequin.html         Inscription mannequin (avec code + paiement)
espace-mannequin.html               Espace personnel du mannequin (connecté)
selection.html                       Sélection recruteur (localStorage + envoi)
contact.html                          Formulaire de contact (enregistré en base)
tableau-de-bord.html                  Admin : statistiques et listes

css/style.css                Toutes les feuilles de style du site
js/app.js                     Fonctions partagées (échappement HTML, lightbox
                                globale, menu, PWA, WhatsApp flottant...)
js/menu.js                     Ouverture/fermeture du menu
js/supabase-config.js            Connexion au projet Supabase (clé publique)
js/emailjs-config.js               Connexion EmailJS (clé publique)

supabase-setup.sql            Schéma initial (tables, RLS de base)
supabase-extension.sql          Toutes les évolutions, par "Extension N"
                                  numérotées et commentées

vercel.json                    En-têtes de sécurité HTTP (CSP, HSTS...)
manifest.json / service-worker.js   PWA (installation sur écran d'accueil)
```

## Fonctions JavaScript partagées à connaître

Toutes définies dans `js/app.js`, chargées sur chaque page :

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

## Déploiement

1. Faire les modifications nécessaires.
2. Générer un fichier .zip du dossier complet du site.
3. Sur Vercel : glisser-déposer le .zip pour créer un nouveau déploiement.
4. **Chaque nouveau déploiement crée un nouveau projet Vercel** — il faut
   reconnecter le domaine (Vercel → Domains → Add Existing) à chaque fois,
   sauf si le projet est relié à GitHub (non fait à ce jour).
5. Si des changements SQL sont nécessaires (nouvelle "Extension N"), les
   exécuter dans Supabase → SQL Editor **avant ou après** le déploiement
   du site (l'ordre n'a pas d'importance entre les deux, sauf mention
   contraire explicite).

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
