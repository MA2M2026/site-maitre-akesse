# Inventaire des prestataires et des transferts — MA2M

**Règle suivie :** le lieu de stockage n'est jamais déduit de la nationalité du fournisseur. Seul ce qui a été vu est marqué [VÉRIFIÉ].

| Prestataire | Rôle | Données concernées | Lieu / région | Statut |
|---|---|---|---|---|
| **Supabase** | base de données, comptes, authentification, double authentification, ancien stockage de fichiers | toutes les fiches (candidatures, mannequins, élèves, contacts, paiements, journaux) | **eu-west-3 (Paris, France)** | [VÉRIFIÉ] région ; sauvegardes et sous-traitants [À COMPLÉTER : offre souscrite] |
| **Cloudflare R2** | stockage des photos (book, candidatures, cours de talons, images du site) | photos | [À COMPLÉTER : région du compartiment] | utilisation [VÉRIFIÉ] |
| **Cloudflare (réseau, Turnstile, règles)** | protection anti-robots, règle « Photos privées des candidatures » | adresse IP, signaux du navigateur | mondial [À COMPLÉTER] | [VÉRIFIÉ] utilisation |
| **Vercel** | hébergement du site, fonctions serveur, journaux | requêtes, IP dans les journaux techniques | [À COMPLÉTER : région des fonctions, durée des journaux] | [VÉRIFIÉ] utilisation |
| **Google Drive / Apps Script** | copie (archive) des photos et vidéos des candidatures et des cours de talons | photos, vidéos, nom du dossier | [À COMPLÉTER : type de compte, propriétaire, partage] | [VÉRIFIÉ] utilisation |
| **Google Analytics** (`G-1BX5MPZ6WE`) | mesure d'audience | identifiant de cookie, pages vues | [À COMPLÉTER] | [VÉRIFIÉ] **refusé par défaut**, actif seulement avec l'accord du visiteur |
| **EmailJS** | envoi des e-mails des formulaires et des messages automatiques | nom, contacts, contenu des messages | [À COMPLÉTER] | [VÉRIFIÉ] utilisation |
| **Sentry** | détection des pannes | messages d'erreur techniques, navigateur | serveur « de » (Allemagne) d'après l'adresse du script [HYPOTHÈSE à confirmer] | [VÉRIFIÉ] utilisation |
| **Meta – WhatsApp Business** | messages et statuts d'envoi | numéros, contenu des messages | [À COMPLÉTER] | [VÉRIFIÉ] `api/whatsapp-webhook.js` |
| **Services de notifications des navigateurs** (Google, Apple, Mozilla) | notifications push | adresse technique d'abonnement | [À COMPLÉTER] | [VÉRIFIÉ] utilisation |
| **Wave et autres moyens de paiement** | liens de paiement | montant, référence ; le paiement se fait chez eux | [À COMPLÉTER] | [VÉRIFIÉ] liens |
| **api.qrserver.com** | image d'un code QR | seulement le lien public d'une fiche The Book | [À COMPLÉTER] | [VÉRIFIÉ] aucune donnée privée |
| **Google Fonts** | polices | IP du visiteur au chargement [HYPOTHÈSE : les polices principales sont servies par le site lui-même] | — | à vérifier |

## Transferts hors de Côte d'Ivoire / CEDEAO
La base est à Paris (France) [VÉRIFIÉ]. D'autres prestataires peuvent traiter des données ailleurs (Europe, États-Unis) [À COMPLÉTER].
**[ARTCI / JURISTE]** : formalités et garanties exigées pour ces transferts.

_Relu le 23/11/2026 : aucun nouveau prestataire. Google Drive reçoit désormais aussi les demandes de mise à la corbeille des dossiers supprimés par l'agence (même prestataire, même rôle)._
