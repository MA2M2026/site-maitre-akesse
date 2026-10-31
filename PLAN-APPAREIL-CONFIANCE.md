# Chantier 6 : appareil de confiance pour l'Administration (plan, 31/10/2026)

Aucun secret dans ce fichier (dépôt public). Rien n'est encore codé : ce plan attend l'accord de la propriétaire.

## Pour la propriétaire (en simple)

| Situation | Aujourd'hui | Avec l'appareil de confiance |
|---|---|---|
| Nouveau téléphone ou navigateur | e-mail, mot de passe, code de l'application d'authentification, code à 4 chiffres | pareil ; ensuite l'appareil est « de confiance » 30 jours |
| 15 minutes sans rien faire | code à 4 chiffres | pareil |
| 1 h 30 sans rien faire | code à 4 chiffres (puis tout refaire au bout de 8 h) | e-mail, mot de passe et code à 4 chiffres, **sans** le code de l'application |
| « Se déconnecter » | tout est à refaire | sur un appareil de confiance : mot de passe et code à 4 chiffres seulement |
| 30 jours passés, ou « Oublier cet appareil », ou appareil retiré dans « Sécurité » | — | tout est à refaire (avec le code de l'application) |

L'adresse internet n'est jamais utilisée (elle change sans arrêt sur un téléphone). Tout est contrôlé par la
base de données elle-même, pas seulement par l'écran : quelqu'un qui contournerait l'écran est refusé pareil.

Ce qu'il faudra de vous, le moment venu (un pas à la fois) :
1. coller un fichier SQL dans Supabase (je vous le donnerai en premier) ;
2. un **compte de test** de l'équipe pour l'essai réel (une adresse e-mail à vous, invitée depuis « Sécurité »),
   avec son application d'authentification sur votre téléphone ; je ne vous demanderai jamais un mot de passe ;
3. vérifier avec moi que votre propre accès à l'Administration marche toujours avant la mise en ligne.
Mise en ligne à part (lot D), avec une version de retour prête.

## Partie technique

Constat (31/10/2026) : la base n'accepte l'Administration qu'avec une session `aal2` (code TOTP) dont le
dernier code a moins de 8 h (`portail_appareil_ok`, `portail_code_appareil_verifier` dans
`supabase-administration.sql`, `api/acces-tableau.js`, `js/portail/inactivite.js`). Une nouvelle connexion
par mot de passe donne une session `aal1` : impossible d'obtenir `aal2` sans refaire le TOTP. Donc :
**sur un appareil de confiance, on garde la session `aal2` (jeton de rafraîchissement) au lieu de la
fermer**, et on la protège par des verrous contrôlés par la base.

1. **SQL** `supabase-appareil-confiance.sql` (Extension 142, rejouable ; jamais `supabase-setup.sql`) :
   - `staff_devices` : `confiance_jusqua timestamptz` (posé à 30 jours après une connexion complète avec
     TOTP sur cet appareil), `mdp_verifie_le timestamptz` ;
   - `portail_appareil_ok()` et `portail_code_appareil_verifier()` : la limite « dernier code < 8 h »
     devient « < 8 h, OU appareil de confiance non expiré ET dernier code < 30 jours » ;
   - verrou fort : si l'appareil est resté plus de 90 min sans signe de vie (`derniere_activite`) ou a été
     « déconnecté », la base exige un mot de passe vérifié APRÈS ce moment (`mdp_verifie_le`) en plus du
     code à 4 chiffres ;
   - « Oublier cet appareil » / appareil révoqué / `sessions_valides_apres` : confiance retirée.
2. **Serveur** : nouvelle action dans `api/portail.js` (pas de nouveau fichier : limite de 11 fonctions)
   « vérifier le mot de passe » : contrôle auprès de Supabase Auth avec le même compteur d'erreurs que
   `api/connexion-protegee.js`, puis remplit `mdp_verifie_le` pour l'appareil (clé serveur). Le jeton
   obtenu n'est pas gardé. `api/acces-tableau.js` : même règle des 30 jours.
3. **Écran** (`js/portail/noyau.js`, `js/portail/inactivite.js`) : écran de verrou fort (e-mail prérempli,
   mot de passe, code à 4 chiffres) ; « Se déconnecter » = verrou fort sur un appareil de confiance ;
   bouton « Oublier cet appareil » (déconnexion complète) ; dans « Sécurité », la date de fin de confiance
   de chaque appareil.
4. **Essais** : simulés dans `scripts/tests-visiteur` (nouvel appareil, 15 min, 90 min, déconnexion, 30 jours,
   oubli, révocation, contournement de l'écran refusé par la base) ; base d'essai `scripts/base-essai`
   pour le SQL ; puis essai réel avec le compte de test (accord de la propriétaire).
