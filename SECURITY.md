# SECURITY.md — Maître Akesse Model Management (MA2M)

Ce document explique comment la sécurité du site est organisée, et surtout
**ce qu'il ne faut jamais faire** en le modifiant — pour un humain ou une IA.

## Principe fondamental

**Le frontend (le code que le navigateur exécute) n'est jamais une frontière
de sécurité.** Toute personne peut lire le JavaScript, voir les noms de
tables, deviner des identifiants, et appeler directement l'API Supabase en
contournant complètement l'interface du site.

La seule vraie protection est **Row Level Security (RLS)**, activée sur
chaque table PostgreSQL, dans `supabase-setup.sql` et
`supabase-extension.sql`. Une vérification uniquement faite en JavaScript
(`if (user.id === profile.id)`) n'est jamais suffisante — elle doit être
répétée dans une policy RLS côté base de données.

## Modèle de menace retenu

1. **Visiteur anonyme** — aucun compte. Peut seulement lire les données
   publiques (profils publiés, actualités, partenaires) et envoyer les
   formulaires publics (candidature, inscription, contact, sélection).
2. **Mannequin authentifié** — peut gérer uniquement ses propres données
   (`auth.uid() = model_id`), jamais celles d'un autre mannequin.
3. **Attaquant authentifié malveillant** — connaît les noms de tables, les
   identifiants, les endpoints. Doit être bloqué uniquement par les
   policies RLS, jamais par l'absence de bouton dans l'interface.
4. **Attaquant externe** — inspecte le réseau, appelle Supabase
   directement, teste des identifiants au hasard, teste l'upload de
   fichiers dangereux.

## Ce qui protège chaque type de donnée

| Donnée | Qui peut lire | Qui peut écrire |
|---|---|---|
| Profils mannequins publiés | Tout le monde | Le mannequin lui-même (RLS `auth.uid() = id`) |
| Téléphone/e-mail privé du mannequin | Personne côté client, y compris un autre compte connecté (colonnes retirées des rôles `anon` **et** `authenticated` — lecture uniquement via la fonction `mon_contact_prive()`, réservée au propriétaire de la fiche) | Le mannequin lui-même |
| Photos du book | Tout le monde (si profil publié) | Le mannequin, uniquement dans son propre dossier de stockage |
| Candidatures, inscriptions, demandes recruteurs, messages de contact | Uniquement les comptes listés dans la table `admins` | Tout le monde en écriture seule (insert), jamais en lecture |
| Statut d'une candidature/inscription (nouvelle, traitée...) | — | **Forcé par un trigger SQL**, impossible à falsifier depuis le formulaire |
| `featured` (mannequin à la une) | Tout le monde en lecture | **Uniquement l'admin**, verrouillé par un trigger SQL même si un mannequin tente de le modifier sur son propre profil |
| Compte admin | — | Déterminé uniquement par la présence dans la table `admins`, jamais par une variable JavaScript |

## Règles à ne JAMAIS enfreindre

- Ne jamais désactiver RLS sur une table pour résoudre un bug rapidement.
- Ne jamais rendre un bucket de stockage public sans avoir vérifié qu'il ne
  contient aucune donnée privée (candidatures et inscriptions doivent
  rester dans des buckets privés).
- Ne jamais mettre la clé `service_role` de Supabase dans le code du site
  (frontend). Seule la clé `anon` (publique par nature, protégée par RLS)
  doit s'y trouver.
- Ne jamais faire confiance à un `user_id` ou `model_id` envoyé par le
  navigateur sans le vérifier côté base (`auth.uid() = ...`).
- Ne jamais considérer qu'une vérification JavaScript remplace une policy
  RLS.
- Ne jamais créer une policy `with check (true)` sur une colonne sensible
  (statut, rôle admin, mise en avant) sans un trigger qui la verrouille.
- Ne jamais insérer une donnée saisie par un visiteur dans le HTML sans
  passer par `echapperHtml()` (définie dans `js/app.js`) — y compris dans
  les attributs (`src`, `alt`, `data-*`), pas seulement le texte visible.
- Ne jamais afficher un lien cliquable (`href`) construit à partir d'une
  donnée saisie sans vérifier qu'il s'agit bien d'une adresse `http(s)`
  (voir `urlHttpSure()` dans `actualites.html`) — sinon un lien du type
  `javascript:...` pourrait s'exécuter au clic.
- Ne jamais supprimer une policy de sécurité simplement parce qu'elle
  bloque une fonctionnalité en cours de développement — comprendre
  pourquoi elle bloque, et corriger la vraie cause.

## Protection des fichiers uploadés

- Chaque bucket (`model-photos`, `actualites-images`, `partenaires-logos`,
  `casting-applications`, `inscriptions-photos`) limite les fichiers
  acceptés aux vrais formats image (JPEG/PNG/WEBP/GIF) et à 10 Mo maximum
  (voir Extension 18 de `supabase-extension.sql`).
- Les noms de fichiers originaux sont nettoyés avant d'être utilisés dans
  un chemin de stockage (fonction `nomFichierSur()` dans `js/app.js`), pour
  éviter tout caractère spécial imprévu.
- **Limite connue** : la vérification du type de fichier se fait sur le
  type déclaré par le navigateur (MIME), pas sur le contenu réel décodé du
  fichier. Une vérification plus poussée (ouvrir réellement l'image pour
  confirmer qu'elle en est une) demanderait une fonction serveur
  supplémentaire (Edge Function Supabase), pas encore mise en place —
  voir la section "Limites connues" plus bas.

## Codes d'inscription mannequin

Les codes sont **volontairement réutilisables** par plusieurs mannequins
(décision du propriétaire de l'agence, pas une faille) : l'agence
distribue un même code à plusieurs personnes et vérifie manuellement
chaque inscription avant validation. Ne pas transformer ce système en
codes à usage unique sans demande explicite.

## Limites connues (honnêteté totale)

Ce qui n'est **pas** garanti par l'architecture actuelle (site statique +
Supabase, sans serveur applicatif dédié) :

- Vérification approfondie du contenu réel d'un fichier uploadé (pas
  seulement son type déclaré).
- Limitation de débit (rate limiting) dédiée sur les formulaires publics
  au-delà de ce que Supabase applique par défaut au niveau de la
  plateforme.
- Protection anti-bot avancée (captcha) sur les formulaires publics.

Aucun de ces points n'est une faille critique aujourd'hui, mais ce sont
des axes d'amélioration si le site venait à subir des abus constatés.

## En résumé

**Aucun système exposé sur Internet ne peut être garanti invulnérable.**
Ce document décrit les protections mises en place et vérifiées à ce jour,
pas une garantie absolue.
