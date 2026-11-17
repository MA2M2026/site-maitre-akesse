# Rapport de sécurité — 17 novembre 2026

Mission demandée par la propriétaire : vérifier point par point que le site et l'application résistent aux pirates,
corriger ce qui manque, tester les protections. Méthode : lecture du code, base de données **en lecture seule**,
site en ligne visité comme un visiteur, diagnostic de sécurité de Supabase, historique complet du code (2 101 versions).

## En résumé

**Aucune faille grave trouvée.** Les protections principales étaient déjà en place depuis l'audit des 15–17/11 et
ont été prouvées une à une. Quatre petits renforcements ont été faits ; deux réglages restent à faire par la
propriétaire (5 minutes).

## Les 28 points demandés

| Point demandé | État | Preuve |
|---|---|---|
| Vraie authentification | ✅ en place | Comptes Supabase ; Administration : double authentification (code de l'application) + appareil de confiance |
| Cacher les clés d'API | ✅ en place | Aucune clé secrète dans le code : seule la clé publique de la base (faite pour être visible) ; secrets rangés dans Vercel, marqués « sensibles » |
| Sécuriser la base de données | ✅ en place | Toutes les tables protégées (règles RLS) ; un visiteur anonyme ne lit rien de privé (testé en ligne : réponse vide ou refus sur candidatures, photos, contacts, comptabilité, administrateurs…) |
| Imposer le HTTPS | ✅ en place | En-tête HSTS 2 ans, sous-domaines compris, préchargement navigateurs |
| Hacher les mots de passe | ✅ en place | Mots de passe gérés par Supabase (bcrypt) ; codes de l'Administration et de l'espace mannequin stockés hachés |
| Valider les formulaires côté serveur | ✅ en place | Le serveur garde seulement les champs autorisés, impose le statut « nouvelle », limite les envois par adresse |
| Protection XSS | ✅ en place | Règle stricte : l'Administration et l'espace mannequin n'acceptent que leurs propres scripts ; textes échappés avant affichage |
| Enregistrer et surveiller les activités suspectes | ✅ en place | Journal des erreurs, tentatives de connexion par compte et par adresse, blocages, journal des écritures de l'agence, étiquette « À vérifier » |
| Verrouiller les routes admin | ✅ en place | Pièces de l'Administration introuvables (404) sans la clé posée après double authentification |
| Requêtes paramétrées | ✅ en place | Aucune requête construite en collant du texte de visiteur (seule requête dynamique : noms de colonnes tirés du catalogue, valeurs passées à part) |
| Variables d'environnement | ✅ vérifiées | Les 14 réglages attendus par le serveur sont présents ; une clé inutile à retirer (voir plus bas) |
| Limite de requêtes | ✅ en place | Limites par minute et par adresse sur les formulaires, les connexions, les envois de photos |
| Réglages CORS | ✅ en place | Le serveur n'autorise aucun autre site à lire ses réponses |
| En-têtes de sécurité | ✅ en place | HSTS, CSP, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP/CORP |
| Cookies de session | ✅ en place | Cookie de l'Administration : HttpOnly, Secure, SameSite, signé, vérifié en temps constant |
| Protection CSRF | ✅ en place | Les actions passent par un jeton dans l'en-tête qu'un autre site ne peut pas envoyer ; cookies SameSite |
| Expiration des liens de réinitialisation | ✅ en place | Code de l'Administration : 30 minutes ; mot de passe : lien Supabase (1 heure) |
| Type et taille des fichiers envoyés | ✅ en place | Photos : JPEG, PNG, WebP seulement, 15 Mo au plus, nombre limité par dossier, adresse d'envoi signée |
| Prix et paiements | ✅ en place | Prix calculés par la base (catalogue, cours de talons) : un client ne peut pas choisir son prix ; paiements validés par l'agence |
| Mode débogage en production | 🔧 corrigé | Plus aucun mode débogage actif ; un vieux journal de mise au point (348 lignes, illisible depuis le site) supprimé |
| Dépendances vulnérables | ✅ aucune | `npm audit` : 0 faille |
| Paquets inutilisés | 🔧 corrigé | `@anthropic-ai/sdk` retiré |
| Fichiers exposés | ✅ aucun | `.env`, `.git`, fichiers SQL, documentation, programme Google, code serveur : tous introuvables en ligne |
| Secrets dans l'historique Git | ✅ aucun | 2 101 versions fouillées : aucune clé de paiement, Google, GitHub, Amazon, Anthropic ni clé administrateur de la base |
| Révoquer les clés compromises | ✅ rien à révoquer | Aucune clé n'a fuité |
| Audit de sécurité complet | ✅ fait | Ce rapport + diagnostic Supabase |
| Tester les protections | ✅ fait | Lectures anonymes refusées, Administration fermée (404), photo privée sans signature refusée (403) |
| Rapport | ✅ | Ce document |

## Corrections faites

| Faille / point faible | Gravité | Correction |
|---|---|---|
| Bibliothèque `@anthropic-ai/sdk` installée mais inutilisée | Basse | Retirée (moins de code embarqué) |
| 3 fonctions de calcul sans chemin de recherche fixe (avertissement Supabase) | Très basse (fonctions de calcul pur) | Chemin fixé (`supabase-securite-17-11.sql` + fichiers d'origine) |
| Vieux journal de débogage en production | Basse (illisible depuis le site) | Supprimé avec l'accord de la propriétaire |
| Photos des candidatures retirées chaque nuit (trouvé le même jour) | Moyenne (perte d'affichage) | Règle arrêtée, seule la règle des 2 ans de la politique de confidentialité reste |

## À faire par la propriétaire

1. **Vercel** : supprimer la clé `ANTHROPIC_API_KEY` (Settings › Environment Variables), le site ne s'en sert plus.
   Une clé inutile est une clé de trop si un jour le compte était piraté.
2. **Supabase** : Authentication › Attack Protection (ou Policies) › activer « Prevent use of leaked passwords »
   si l'offre le permet : refuse les mots de passe déjà fuités sur Internet.

## Pour plus tard (non urgent)

- Les fonctions réservées à l'agence vérifient déjà elles-mêmes qui les appelle ; on pourrait en plus interdire leur
  appel aux visiteurs anonymes (défense en profondeur), avec des essais.
- Les liens personnels (convocation, accord du parent) n'expirent pas : ils sont impossibles à deviner (144 bits),
  mais on pourrait les limiter dans le temps.
- Petite erreur sans risque au journal : un comptage de la page « Toute la tuile » (codes d'inscription) échoue.
