# Audit initial des données personnelles — Maître Akesse Model Management (MA2M)

**Date :** 22/11/2026, complété le 23/11/2026 · **Auteur :** assistant technique (Claude Code), à la demande de la propriétaire de MA2M
**Statut :** document préparatoire. Ce n'est ni une déclaration déposée auprès de l'ARTCI, ni une autorisation, ni une certification.
**Référence :** loi ivoirienne n° 2013-450 du 19 juin 2013.

Légende utilisée dans tout le dossier :
- **[VÉRIFIÉ]** constaté dans le code du site, sa configuration ou la base de données (lecture seule) ;
- **[MA2M]** information donnée par la propriétaire ;
- **[HYPOTHÈSE]** déduction à confirmer ;
- **[À COMPLÉTER]** information manquante ;
- **[ARTCI / JURISTE]** point à faire confirmer par l'ARTCI ou un professionnel compétent.

---

## 1. Périmètre examiné [VÉRIFIÉ]

- Site public `www.maitreakessemodelmanagement.com` (pages, formulaires, serveur `middleware.js`, fonctions `api/`).
- Application des mannequins `mannequin.maitreakessemodelmanagement.com/app/` (inscription, Espace mannequin, paiements).
- Administration `/admin/` (rôles, double authentification).
- Base de données Supabase (projet `dfhghgmwmxiguhtxtsle`, **région eu-west-3 = Paris**), ~150 tables, toutes avec des règles d'accès (RLS) activées.
- Stockages : Cloudflare R2 (photos), Google Drive (copies et vidéos, via un programme Google Apps Script), Supabase Storage (anciens fichiers).
- Services tiers : Vercel (hébergement), EmailJS (e-mails), Google Analytics (avec consentement), Sentry (pannes), Cloudflare Turnstile (anti-robots), WhatsApp Business de Meta (messages et statuts), notifications « push » des navigateurs, Wave et autres moyens de paiement (liens de paiement).

## 2. Formulaires publics et données collectées

### 2.1 « Postuler à un casting » et « Intégrer l'agence » (FR et EN) — `casting_applications`

| Donnée | Champ technique | Obligatoire | Finalité |
|---|---|---|---|
| Nom complet | `full_name` | oui | identifier la candidature |
| E-mail | `email` | oui | recontacter la personne |
| Téléphone / WhatsApp | `phone` | oui | recontacter la personne (canal principal de l'agence) |
| Ville (+ commune si Abidjan) | `city` | oui | organisation des castings |
| Genre, civilité | `genre`, `civilite` | oui | adresser les messages, catégories de casting |
| **18 ans ou plus / moins de 18 ans** | `mineur` | oui | déclencher l'accord du parent |
| Taille, vêtements, pointure, poitrine, tour de taille, bassin | `height_cm`… | oui | casting |
| Poids | `weight_kg` | **facultatif** (depuis le 22/11/2026) | casting |
| Message libre | `message` | facultatif | présentation |
| Parent / tuteur (civilité, nom, WhatsApp, e-mail) | `parent_*` | oui si mineur(e) | accord du parent |
| Photos (3 à 12) et vidéo (3 min) | `casting_photos`, `video_url` | oui | étude de la candidature |

**Retirés le 22/11/2026 (décision de la propriétaire, minimisation)** : date de naissance, quartier, situation scolaire, niveau d'études. Les anciennes candidatures gardent ces informations (rien n'est effacé).

### 2.2 « Cours de talons » — `cours_talons`
Nom, téléphone/WhatsApp, **18 ans ou plus / moins de 18 ans** (`mineure`, depuis le 22/11/2026, à la place de l'âge), objectif (concours, date), niveau en talons, formule, créneaux ou disponibilités, adresse (seulement pour un cours privé à l'extérieur), parent (nom, téléphone) si mineure, 2 à 5 photos et une vidéo de marche, référence de paiement. **Retiré le 22/11/2026** : quartier, âge.

### 2.3 « Contact » — `messages_contact`
Civilité, nom, téléphone, e-mail, type de contact, structure (facultatif), ville (facultatif), message.

### 2.4 Demande de recruteur — `recruiter_requests`
Entreprise, nom du contact, e-mail, téléphone, WhatsApp, ville, type de projet, date souhaitée, message, sélection de mannequins.

### 2.5 Inscription (personnes retenues) — page du site et de l'application
Code personnel envoyé par l'agence + **date de naissance** (gardée ici, décision de la propriétaire : elle décide de l'accord du parent), nom, téléphone, e-mail, ville, parent (nom, téléphone, e-mail, accord), acceptation du règlement, moyen de paiement et numéro payeur.

### 2.6 Espace mannequin (mannequins de l'agence) — `model_profiles`, `model_photos`…
Identité (nom, date, ville et lieu de naissance, nationalité, ville, quartier, téléphone, e-mail, sexe), mensurations (poids **facultatif** depuis le 22/11/2026 et **plus affiché publiquement**), formation (niveau d'études **facultatif** depuis le 22/11/2026), expériences, langues, Instagram, photos du book, CV et Compcard, paiements (mensualités).

## 3. Données collectées automatiquement [VÉRIFIÉ]

| Donnée | Où | Remarque |
|---|---|---|
| Visites de pages | `page_views` (page, date, **empreinte d'adresse IP**, fiche vue) | statistiques internes ; l'IP est transformée (hachée) |
| « J'aime » sur les photos | `photo_likes` (empreinte IP) | |
| Adresse IP | `soumissions_formulaires_publics_ip`, `connexion_tentatives_ip`, `audit_log.ip` | anti-abus, sécurité, journal des actions de l'équipe |
| Navigateur (user agent), page, message d'erreur | `journal_erreurs` | suivi des pannes |
| Erreurs techniques | Sentry | pannes, sans le contenu des formulaires [MA2M : déclaré dans la politique] |
| Mesure d'audience | Google Analytics `G-1BX5MPZ6WE` | **seulement avec l'accord** (mode consentement : refusé par défaut) |
| Abonnements aux notifications | `push_abonnements`, `app_push_abonnements` | adresse technique du navigateur |
| Statuts WhatsApp | `whatsapp_evenements` (Meta) | messages envoyés/lus, réponses |
| Journal des copies Drive | `medias_drive` | liens des fichiers |

## 4. Protections constatées [VÉRIFIÉ]

- RLS activée sur **toutes** les tables publiques ; les colonnes privées des mannequins (téléphone, e-mail, date de naissance…) ne sont pas lisibles par les visiteurs.
- Photos de candidature jamais publiques (adresses de lecture signées d'1 heure, réservées à l'équipe).
- Administration : comptes nominatifs, rôles, double authentification, appareils de confiance, blocage après tentatives.
- Formulaires publics : anti-robots (Turnstile), limite par adresse IP, liste blanche des champs acceptés côté serveur.
- Mineurs : accord du parent enregistré (`accords_parents` : demande, acceptation, retrait) ; publication d'un profil mineur bloquée sans accord (`bloquer_publication_mineur`).
- Conservation : effacement automatique des candidatures après 2 ans (tâche `effacement-candidatures-2-ans`, chaque nuit) ; photos des candidatures traitées effacées 5 jours après la décision (`nettoyer_photos_traitees_anciennes`).

## 5. Écarts et risques relevés

| # | Constat | Gravité | Proposition |
|---|---|---|---|
| 1 | Le **poids** des mannequins était lisible par tout visiteur (colonne ouverte) et affiché sur la fiche publique | moyenne | **fait** : n'est plus affiché ni lu par les pages publiques ; SQL `supabase-artci-poids-prive.sql` collé et vérifié le 22/11/2026. **Limite restante** : un compte mannequin connecté peut encore lire le poids des autres fiches publiées (à fermer par une fonction dédiée) |
| 2 | Date de naissance, quartier, scolarité, niveau d'études demandés à toutes les candidates | moyenne | **fait** : retirés des candidatures et des cours de talons (majeure/mineure à la place) |
| 3 | **Aucune preuve de consentement** enregistrée (case cochée, mais ni date ni version du texte) | moyenne | à faire : enregistrer date + version de la politique acceptée (voir REGISTRE) |
| 4 | Durées annoncées non automatisées : messages de contact, demandes de recruteurs (3 ans), fiches de mannequins (3 ans après la fin) | moyenne | à faire : tâches automatiques, après validation des durées |
| 5 | La politique de confidentialité ne cite pas : cours de talons, Turnstile, WhatsApp Business (Meta), notifications push, statistiques internes `page_views` | faible | à faire : brouillon prêt (POLITIQUE_DE_CONFIDENTIALITE_MA2M.md) |
| 6 | **Numéros de téléphone** collectés partout (WhatsApp) | à qualifier | [ARTCI / JURISTE] formalité préalable éventuelle (voir QUESTIONS) |
| 7 | Lieux d'hébergement de Vercel, EmailJS, Cloudflare R2, Google Drive, Sentry, Meta non confirmés | à qualifier | [À COMPLÉTER] vérifier dans les comptes et contrats |
| 8 | Journaux techniques (`journal_erreurs`, `audit_log`, IP) sans durée de conservation définie | faible | proposer une durée (ex. 12 mois) [À VALIDER] |

## 6. Ce qui n'a pas pu être vérifié
- Paramètres de partage réels des dossiers Google Drive et propriétaire des fichiers [À COMPLÉTER].
- Régions et contrats de Vercel, EmailJS, Sentry, Cloudflare, Meta, Google [À COMPLÉTER].
- Sauvegardes Supabase (durée, restauration) selon l'offre souscrite [À COMPLÉTER].
- Statut juridique exact du responsable du traitement [MA2M / ARTCI].

## 7. Mise à jour du 23/11/2026
- Écarts 1 et 2 : **corrigés et en ligne** (vérifié dans la base et sur le site).
- Présentation des formulaires en écrans (casting, intégrer l'agence, cours de talons) : **aucune nouvelle donnée** ; les liens « Mentions légales · Confidentialité » sont visibles sur chaque écran ; la case de confidentialité est à côté du bouton d'envoi.
- Bouton « Supprimer » des cours de talons et mise à la corbeille des dossiers Google Drive : **actifs** (vérifié) — utile pour le droit à l'effacement.
- Écarts 3 à 8 : inchangés (voir RAPPORT_FINAL, « Reste à faire »).
