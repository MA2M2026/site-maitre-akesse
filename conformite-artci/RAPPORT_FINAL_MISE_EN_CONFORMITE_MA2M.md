# Rapport d'avancement de la mise en conformité — MA2M (mis à jour le 23/11/2026)

**Ce rapport ne déclare pas le site « conforme »** : seules l'ARTCI ou un professionnel compétent peuvent se prononcer, après les formalités.

## Décisions de la propriétaire (22/11/2026)
- Candidatures (casting, intégrer l'agence) et cours de talons : **plus de date de naissance ni d'âge**, seulement « 18 ans ou plus / moins de 18 ans » ; **plus de quartier, de situation scolaire ni de niveau d'études**.
- **Date de naissance gardée à l'inscription** (personnes retenues) : elle décide de l'accord du parent.
- **Poids facultatif** partout et **retiré de l'affichage public** ; niveau d'études facultatif dans l'Espace mannequin.
- **Téléphone gardé** (WhatsApp), avec la raison affichée ; question posée à l'ARTCI.
- La page **Inscription** redevient une page du site (même apparence, FR/EN).

## Changements du 22/11/2026 — **en ligne et vérifiés** (mise en ligne n° 461)
| Changement | Essais |
|---|---|
| Formulaire de candidature (FR/EN, téléphone/ordinateur) : choix « 18 ans ou plus / moins de 18 ans », sans date de naissance, quartier, scolarité, niveau d'études ; poids facultatif ; raisons et conseils affichés | `test-visiteur.js` : 4 pages, 0 échec |
| Cours de talons : choix majeure/mineure à la place de l'âge ; plus de quartier | `test-cours-talons.js` : tout passe |
| Administration : reconnaît une mineure par son choix (candidatures et cours de talons) | séries de l'Administration : tout passe |
| Serveur : les champs retirés sont refusés même si une ancienne page les envoie | — |
| Espace mannequin : poids et niveau d'études facultatifs, plus réclamés dans l'analyse du profil | séries Espace mannequin : tout passe |
| Fiche publique The Book : poids retiré | séries des fiches : tout passe |
| Page Inscription du site (FR/EN) | `test-inscription-site.js` : 0 échec |

## Fichiers SQL — **collés par la propriétaire et vérifiés** (22/11/2026)
1. `supabase-artci-majeure-mineure.sql` — colonnes « mineur / mineure », code d'inscription sans date de naissance dans la candidature (contrôle : 7 éléments sur 7) [VÉRIFIÉ dans la base le 23/11].
2. `supabase-artci-poids-prive.sql` — le poids n'est plus lisible par les visiteurs [VÉRIFIÉ dans la base le 23/11].

## Changements du 23/11/2026 (en ligne) — sans nouvelle donnée collectée
| Changement | Effet sur les données personnelles |
|---|---|
| Pages « Intégrer l'agence », « Postuler à un casting », « Cours de talons » présentées **écran par écran** (FR/EN) | aucune donnée en plus ; le grand bas de page est remplacé, **sur chaque écran**, par une petite ligne « Mentions légales · Confidentialité » (l'information reste accessible à tout moment, y compris pendant le formulaire) |
| Formulaire des cours de talons en **petits écrans** (une question à la fois) | mêmes données qu'avant ; l'écran du **parent** n'apparaît que pour une mineure ; la **case de confidentialité est sur le même écran que le bouton « Envoyer »** |
| Nouvelle police (site, application, Administration, compcard, CV, carte) | aucun effet |
| Bouton **« Supprimer »** des cours de talons (administrateur principal) | actif [VÉRIFIÉ dans la base] : l'inscription, ses séances et ses photos Cloudflare sont effacées ; son dossier Google Drive part à la **corbeille** (récupérable 30 jours) |

## Décision de la propriétaire sur la mention de l'ARTCI (23/11/2026)
La politique de confidentialité en ligne cite la loi n° 2013-450 et, pour l'Europe, le RGPD. Tant que la déclaration n'est pas faite, **elle ne cite pas l'ARTCI** et n'annonce **aucune autorisation ni numéro**. Après l'acceptation de la déclaration, on ajoutera en une fois : le nom du responsable (la société une fois constituée), l'ARTCI comme autorité de protection des données et le numéro de déclaration.

## Reste à faire
- Enregistrer les preuves de consentement (date, version) — voir REGISTRE.
- Automatiser les durées non encore appliquées — voir CONSERVATION.
- Mettre à jour la politique de confidentialité — voir le brouillon (avec la mention de l'ARTCI **après** la déclaration).
- Compléter les informations du responsable et des prestataires [À COMPLÉTER].
- Poser les questions à l'ARTCI, puis choisir et accomplir la formalité.
