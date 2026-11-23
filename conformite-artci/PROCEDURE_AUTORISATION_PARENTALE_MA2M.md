# Procédure d'autorisation parentale — MA2M

## Ce qui existe [VÉRIFIÉ]
1. **Candidature** (casting, intégrer l'agence, cours de talons) : la personne choisit « moins de 18 ans » → le formulaire exige le nom et le téléphone/WhatsApp du parent ou tuteur (e-mail en plus pour les candidatures). L'agence accepte les candidatures à partir de 14 ans (annoncé dans le choix). Depuis le 23/11/2026, sur le formulaire des cours de talons en écrans, le parent est demandé sur **un écran à part**, qui n'apparaît que pour une mineure, et l'inscription ne peut pas avancer sans lui [VÉRIFIÉ par les essais].
2. **Messages** : pour une personne mineure, l'Administration propose d'écrire au parent.
3. **Inscription** (personne retenue) : la **date de naissance** est demandée ; si elle a moins de 18 ans, le nom, le téléphone et l'**accord écrit du parent** sont obligatoires (contrôlé par la base, `inscription_simplifiee_payer`). Une personne qui se serait dite majeure à tort est donc rattrapée ici.
4. **Accord parental en ligne** : page `accord-parent` et table `accords_parents` (date de la demande, nom du parent, date d'acceptation, date de retrait).
5. **Publication** : un profil de mineur ne peut pas être publié dans The Book sans accord (`bloquer_publication_mineur`).

## Limites (à dire honnêtement)
- « 18 ans ou plus » est une **déclaration** : elle ne prouve pas l'âge. Le contrôle se fait à l'inscription (date de naissance) et par l'agence, qui voit les photos et la vidéo.
- L'accord en ligne prouve qu'une personne a cliqué au nom du parent, pas son identité.

## À faire valider [ARTCI / JURISTE]
- La méthode de preuve de l'accord parental est-elle suffisante ? Faut-il une pièce, une signature ?
- Distinguer **l'accord au traitement des données** de **l'accord à la publication des photos** (aujourd'hui un seul accord).
- Faut-il suspendre les candidatures de mineurs tant que la méthode n'est pas validée ? (possible techniquement en retirant le choix « moins de 18 ans »).
