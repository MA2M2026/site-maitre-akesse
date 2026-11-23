# Politique de conservation des données — MA2M (brouillon)

**Statut :** propositions motivées **[À VALIDER]** par la propriétaire, et par un juriste pour les durées légales. Aucune durée légale n'est inventée ici.

| Catégorie | Durée proposée | Motif | Automatique aujourd'hui ? |
|---|---|---|---|
| Candidature non retenue ou sans suite | 2 ans après la réponse | pouvoir reprendre contact pour un prochain casting | **oui** : tâche nocturne `effacement-candidatures-2-ans` [VÉRIFIÉ] |
| Photos d'une candidature traitée (retenue ou refusée) | gardées tant que la fiche existe | décision de la propriétaire (17/11/2026) | **non** : effacées seulement avec la fiche, au clic de l'agence (`nettoyer_photos_traitees_anciennes` désactivée) [VÉRIFIÉ] |
| Candidature en attente | jusqu'à la réponse, puis règle ci-dessus | | oui |
| Mannequin de l'agence (fiche, profil, documents) | durée de la collaboration + 3 ans | suivi, litiges éventuels | **non** [À FAIRE] |
| Profil publié dans The Book | jusqu'au retrait de publication | | retrait au clic de l'agence |
| Élève des cours de talons | [À DÉFINIR] (proposition : 2 ans après la dernière séance) | suivi pédagogique | **non** ; suppression au clic de l'administrateur principal possible depuis le 23/11/2026 [VÉRIFIÉ] (inscription, séances, photos ; dossier Drive à la corbeille 30 jours) |
| Message de contact, demande de recruteur | 3 ans après le dernier échange | relation | **non** [À FAIRE] |
| Comptes de l'équipe | durée de la fonction, supprimés au départ | sécurité | au clic |
| Adresses IP des formulaires et des connexions | 12 mois (une IP encore bloquée est gardée jusqu'à la fin du blocage) | enquête en cas d'incident | **oui** depuis le 23/11/2026 : `effacer_traces_techniques`, chaque nuit à 3 h 47 [VÉRIFIÉ en base d'essai] |
| Journal des actions de l'équipe (`audit_log`) | gardé | personne ne doit pouvoir effacer la trace d'une action (écriture seule) | **non**, volontairement [JURISTE : durée maximale ?] |
| Journal des erreurs techniques | 6 mois | réparation des pannes | **oui** depuis le 23/11/2026 (même tâche) |
| Statistiques internes (`page_views`, empreinte IP) | 14 mois | comme Google Analytics | **oui** depuis le 23/11/2026 (même tâche) |
| Google Analytics | 14 mois (réglage Google) | | réglage chez Google [À VÉRIFIER] |
| Preuves de consentement et accords parentaux | durée du traitement concerné + délai de prescription [JURISTE] | preuve | gardées avec la fiche (date et version enregistrées depuis le 23/11/2026) |
| Pièces comptables (paiements, reçus) | durée légale [JURISTE] | obligation comptable | **non** |
| Sauvegardes Supabase | selon l'offre [À COMPLÉTER] | | chez Supabase |
| Copies Google Drive d'une fiche supprimée par l'agence | 30 jours dans la corbeille de Google Drive, puis effacement par Google | pouvoir annuler une erreur | **oui** [VÉRIFIÉ] |

**Règle :** une suppression ne sert jamais à dissimuler une collecte passée ; les éléments utiles à la sécurité, aux obligations légales et à la défense des droits sont gardés dans les limites applicables.
