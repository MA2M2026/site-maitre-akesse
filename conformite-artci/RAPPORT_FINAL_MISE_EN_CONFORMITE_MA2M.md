# Rapport d'avancement de la mise en conformité — MA2M (22/11/2026)

**Ce rapport ne déclare pas le site « conforme »** : seules l'ARTCI ou un professionnel compétent peuvent se prononcer, après les formalités.

## Décisions de la propriétaire (22/11/2026)
- Candidatures (casting, intégrer l'agence) et cours de talons : **plus de date de naissance ni d'âge**, seulement « 18 ans ou plus / moins de 18 ans » ; **plus de quartier, de situation scolaire ni de niveau d'études**.
- **Date de naissance gardée à l'inscription** (personnes retenues) : elle décide de l'accord du parent.
- **Poids facultatif** partout et **retiré de l'affichage public** ; niveau d'études facultatif dans l'Espace mannequin.
- **Téléphone gardé** (WhatsApp), avec la raison affichée ; question posée à l'ARTCI.
- La page **Inscription** redevient une page du site (même apparence, FR/EN).

## Changements préparés (branche `audit/artci-formulaires`, pas encore en ligne)
| Changement | Essais |
|---|---|
| Formulaire de candidature (FR/EN, téléphone/ordinateur) : choix « 18 ans ou plus / moins de 18 ans », sans date de naissance, quartier, scolarité, niveau d'études ; poids facultatif ; raisons et conseils affichés | `test-visiteur.js` : 4 pages, 0 échec |
| Cours de talons : choix majeure/mineure à la place de l'âge ; plus de quartier | `test-cours-talons.js` : tout passe |
| Administration : reconnaît une mineure par son choix (candidatures et cours de talons) | séries de l'Administration [en cours] |
| Serveur : les champs retirés sont refusés même si une ancienne page les envoie | — |
| Espace mannequin : poids et niveau d'études facultatifs, plus réclamés dans l'analyse du profil | séries Espace mannequin [en cours] |
| Fiche publique The Book : poids retiré | séries des fiches [en cours] |
| Page Inscription du site (FR/EN) | `test-inscription-site.js` : 0 échec |

## Fichiers SQL à coller par la propriétaire
1. `supabase-artci-majeure-mineure.sql` — **AVANT** la mise en ligne (colonnes « mineur », code d'inscription sans date de naissance dans la candidature).
2. `supabase-artci-poids-prive.sql` — **APRÈS** la mise en ligne (ferme la lecture du poids aux visiteurs).

## Reste à faire
- Enregistrer les preuves de consentement (date, version) — voir REGISTRE.
- Automatiser les durées non encore appliquées — voir CONSERVATION.
- Mettre à jour la politique de confidentialité — voir le brouillon.
- Compléter les informations du responsable et des prestataires [À COMPLÉTER].
- Poser les questions à l'ARTCI, puis choisir et accomplir la formalité.
