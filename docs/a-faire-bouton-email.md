# À faire en premier (décision de la propriétaire, 09/11/2026)

**Bouton « Changer l'e-mail de connexion » sur la fiche d'une mannequin (Administration).**
Besoin : des mannequins inscrites ont perdu l'e-mail ET le mot de passe de leur compte (compte actif).

Plan :
- Où :
  - fiche mannequin, js/admin/site-mannequins.js ;
  - serveur : api/portail.js, nouvelle action, par exemple `changer_email_mannequin`.
- Le serveur doit :
  1. vérifier l'administratrice avec `adminVerifie` (aal2 + appareil, Extension 158) ;
  2. vérifier que la cible est une mannequin (model_profiles), jamais un membre de l'équipe ;
  3. appeler `adminAuth('admin/users/' + id, 'PUT', { email, email_confirm: true })` ;
  4. le journaliser.
- La mannequin fait ensuite « Mot de passe oublié » avec la nouvelle adresse.
- Essais :
  - test visiteur Administration (base simulée) ;
  - essai serveur ;
  - puis essai RÉEL avec un compte de test, avec l'accord de la propriétaire (règle 3, CLAUDE.md).
- Ne rien supprimer : le compte, la fiche et les photos restent.

Rappel donné à la propriétaire pour les mannequins de l'agence sans compte : « Ajouter une personne » → « Mannequin de
l'agence », puis « code de l'espace » sur sa fiche du registre → « Créer mon compte » (déjà en place).
