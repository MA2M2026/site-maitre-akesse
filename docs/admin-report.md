# Analyse de l'Administration (08/11/2026, soir)

Mesures : batterie d'essais (4 553 contrôles), test-rapidite-admin.js, journal_erreurs (30 jours),
conseiller de sécurité Supabase, essai réel de la propriétaire après l'Extension 158.

## Forces
1. **Sécurité** : deux facteurs, verrou de l'écran (code à 4 chiffres après 15 minutes), téléphone révoqué → tout fermé,
   y compris les anciennes règles (Extension 158, essayée pour de vrai le 08/11). Aucune alerte « ERROR » du conseiller
   Supabase.
2. **Rapidité** : chaque rubrique s'ouvre en 0,9 à 1,5 s (Candidatures, Mannequins, Convocations, Places, Paiements, Compta).
3. **Téléphone** : chaque écran essayé sur téléphone et ordinateur ; textes lisibles sur les 79 pages des applications
   (contraste) ; rien ne dépasse.
4. **Rien d'écrit par erreur** : les suppressions demandent une confirmation (taper SUPPRIMER pour une mannequin), les
   photos ne sont jamais supprimées sans le clic de l'agence.

## Faiblesses
1. **Les erreurs de l'Administration ne sont pas enregistrées.** La surveillance (js/surveillance.js) est sur les 44 pages
   du site et de l'application des mannequins, mais pas dans l'Administration : 0 erreur au journal en 30 jours, non pas
   parce qu'il n'y en a pas, mais parce qu'elles ne sont pas notées. Le bloc « Accueil du site » cassé ce soir n'a été
   vu que par la propriétaire. → La plus importante à corriger.
2. **Mots de passe déjà volés acceptés** : la vérification Supabase « mots de passe compromis » (HaveIBeenPwned) est
   coupée. Un réglage dans Supabase (Authentication → Sign In / Providers → Email) ; peut demander l'offre payante.
3. **Poids au démarrage** : 31 scripts, 284 Ko compressés avant le premier écran (le reste est chargé après, une fois).
   Correct en Wi-Fi/4G (mesuré 0,9 à 1,5 s), plus lent en 3G.
4. Remarques du conseiller sans gravité (voulues) : 34 tables sans règle de lecture (tables lues seulement par le
   serveur : personne d'autre ne peut les lire) ; fonctions sécurisées appelables (chacune vérifie elle-même le rôle).
   Une fonction neuve (cours_talons_montant) sans chemin fixe : signalée à la conversation « Cours de talons ».

## Corrections proposées, une à la fois
1. ✅ (en ligne le 08/11/2026) Mettre la surveillance des erreurs dans l'Administration (sans envoyer d'information personnelle : seulement la
   rubrique, le message et l'appareil).
2. ~~Vérification des mots de passe compromis~~ : réservée à l'offre payante de Supabase (« Only available on Pro plan »).
   À la place (08/11/2026, par la propriétaire) : longueur minimale des mots de passe passée de 6 à 8 dans Supabase
   (Authentication → Sign In / Providers → Email), comme les formulaires du site (8 au moins, 12 pour l'équipe).
   Ne PAS allumer « Captcha protection » dans Supabase : la connexion et la création de compte seraient bloquées.
3. Plus tard : alléger le démarrage (charger les scripts Paiements/Compta seulement à l'ouverture de ces rubriques).
