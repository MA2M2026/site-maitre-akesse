# Plan « Cours de talons » — Atelier Talons & Élégance (décisions de la propriétaire, 08/11/2026)

Nouvelle page publique pour les personnes qui veulent seulement **apprendre à marcher en talons** (préparer un concours
de Miss ou de beauté, gagner en élégance et en prestance, ou simplement marcher en talons), **sans intégrer l'agence**.
Rien n'est construit. Une étape à la fois ; tests (base d'essai + tests visiteur) avant toute mise en ligne ; prévenir
l'autre conversation avant chaque mise en ligne.

## Décisions
- **Menu** : « Cours de talons » + étiquette « Ouvert à toutes ». **Page** : « Atelier Talons & Élégance » (sous-titre :
  apprendre à marcher en talons, ouvert à toutes, sans intégrer l'agence). Ne doit jamais être confondu avec « Intégrer l'agence ».
- **Cours en groupe** : chaque dimanche de 15 h à 18 h — **30 000 FCFA pour 4 séances (4 dimanches)**.
- **Cours privé (séance de 2 h)** : **25 000 FCFA en salle chez nous** ; **30 000 à 35 000 FCFA à l'extérieur** (chez la
  personne ou au lieu de son choix).
- **Salle** : Riviera Faya (Abidjan) — la même salle que les cours de l'agence (repère précis à demander pour la page).
- **Paiement** : le même Wave que pour les mensualités des mannequins.
- **Vidéo** : elle doit DONNER ENVIE (« qu'en la regardant, elle ait envie d'apprendre à marcher tout de suite ») : d'abord le rêve et la transformation, les infos pratiques à la fin.

## La page
1. Vidéo motion design premium (≈ 80 s) avec **voix off** douce, élégante, bonne diction (voix à régler : gratuite améliorée
   ou ElevenLabs). Illustrations avec les photos des mannequins du site (gros plans jambes/talons, silhouettes en pied).
2. Deux cartes : Cours en groupe / Cours privé (en salle ou ailleurs), avec les prix.
3. Questions fréquentes : faut-il savoir marcher en talons (non, tous niveaux) ; quoi apporter (talons + tenue confortable) ;
   où (adresse) ; est-ce que je rejoins l'agence (non → « Intégrer l'agence ») ; mineure (accord d'un parent).

## L'inscription (4 étapes, barre de progression)
1. Formule : groupe / privé en salle / privé ailleurs (privé : disponibilités + adresse si hors salle).
2. Identité : nom, WhatsApp, âge, quartier ; objectif (concours de Miss, de beauté, élégance au quotidien, mariage/événement ;
   si concours : nom + date) ; niveau actuel en talons.
3. 2 à 3 photos + 1 vidéo de marche (60 s max) — « seulement pour évaluer votre niveau, jamais publiées ».
4. « Finaliser l'inscription et payer maintenant ? » — **Oui** : paiement Wave (montant exact), « paiement envoyé, nous
   validons et confirmons sur WhatsApp » ; **Plus tard** : demande enregistrée, « nous vous enverrons votre lien de paiement ».

## Administration : nouvel espace « Cours de talons »
- Liste des demandes (photo, objectif, formule) et états : nouvelle · plus tard · paiement envoyé (à valider) · inscrite · terminée.
- Actions : voir photos/vidéo, envoyer le lien de paiement, valider le paiement, WhatsApp, fixer date/lieu d'une séance privée.
- Liste du dimanche (places, présences) pour les cours en groupe.
- Automatique : message de confirmation (date, heure, lieu, quoi apporter), rappel la veille, reçu, recette « Cours de talons » en Compta.

## Texte de la voix off (VALIDÉ par la propriétaire le 08/11/2026)
| Temps | Voix | Écran |
|---|---|---|
| 0–8 s | « Bonjour… et bienvenue à l'Atelier Talons & Élégance de Maître Akesse Model Management. » | Talon qui se pose au ralenti, titre |
| 8–20 s | « Vous préparez un concours de Miss ou de beauté ? Vous voulez gagner en élégance, en prestance… ou simplement apprendre, enfin, à marcher en talons avec assurance ? Vous êtes au bon endroit. » | 3 médaillons (Miss, silhouette, jambes en talons) |
| 20–35 s | « Ici, nous vous apprenons la posture, le port de tête, l'équilibre, une démarche fluide… et cette confiance qui se voit dès votre premier pas. Quel que soit votre niveau. » | Mots un par un sur gros plans pieds/jambes |
| 35–50 s | « Deux formules s'offrent à vous. Les cours en groupe : chaque dimanche, de quinze à dix-huit heures. Trente mille francs CFA pour quatre séances. » | Carte « Cours en groupe », calendrier des dimanches |
| 50–62 s | « Ou les cours privés, de deux heures : vingt-cinq mille francs dans notre salle… ou de trente à trente-cinq mille francs, chez vous ou à l'endroit de votre choix. » | Carte « Cours privé » en deux options |
| 62–75 s | « Pour vous inscrire, c'est simple : choisissez votre formule, envoyez-nous deux ou trois photos et une courte vidéo de votre marche… puis réglez votre participation par Wave. » | 3 étapes, barre de progression, logo Wave |
| 75–82 s | « Votre élégance commence ici. Cliquez sur « Je m'inscris ». » | Mannequin en pied, bouton « Je m'inscris » |

## Conception technique (08/11/2026) — branche de travail `cours-talons`
- **Base** (`supabase-cours-talons.sql`, ajout seulement, rejouable) : table `cours_talons` (formule groupe / prive_salle /
  prive_exterieur ; nom, téléphone, âge, quartier, objectif, concours + date, niveau, disponibilités, adresse ; parent si
  mineure ; photos (liens Drive) + vidéo ; `decision` maintenant / plus_tard ; `reference_wave` ; `statut` nouvelle ·
  plus_tard · paiement_envoye · inscrite · terminee · annulee ; montant ; notes ; validée le / par). RLS : lecture et
  modification réservées à l'équipe du site (`portail_peut('site')`) ; AUCUNE écriture directe des visiteurs : l'inscription
  passe par `/api/portail` action `formulaire` (anti-robots Turnstile) → `formulaire_public_enregistrer` étendue à
  `cours_talons` (limite par minute et par adresse, statut imposé nouvelle / plus_tard / paiement_envoye).
  Validation du paiement : RPC `cours_talons_valider` (statut inscrite + recette « Cours de talons » en Compta).
- **Photos et vidéo** : même chemin que la candidature (`envoyerPhotosVersDrive` / `envoyerVideoVersDrive`, js/app.js).
- **Paiement** : lien Wave de l'agence `https://pay.wave.com/m/M_ci_5eXs19LXWW_D/c/ci/?amount=<montant>` (le même que les
  mensualités) ; groupe 30 000 ; privé salle 25 000 ; privé extérieur 30 000 (35 000 selon la distance, ajusté par l'agence).
- **Pages** : `cours-talons.html` (+ `en/cours-talons.html`), menu « Cours de talons » + étiquette « Ouvert à toutes »
  (js/gabarit.js), vidéo verticale en haut (assets/cours-talons/atelier-talons.mp4), cartes, questions fréquentes,
  encadré « Vous voulez intégrer l'agence ? », formulaire en 4 étapes.
- **Administration** : nouvelle pièce `js/admin/site-cours-talons.js` (menu « Cours de talons ») : liste par état, fiche
  (photos, vidéo), boutons Valider le paiement / Envoyer le lien de paiement (WhatsApp prérempli) / Terminée / Annuler.
- **Tests** : `essais-cours-talons.sql`, `test-cours-talons.js` (visiteur : 4 étapes, photos, vidéo, maintenant / plus
  tard, mineure ; administration : liste, validation), batterie complète, /code-review, mise en ligne par la conversation
  de la propriétaire (prévenir l'autre conversation avant).
