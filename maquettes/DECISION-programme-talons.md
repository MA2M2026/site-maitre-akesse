# Maquette « Mon programme » : décision de la propriétaire (14/11/2026)

- **VALIDÉE** : « C'est bien, on part sur cette maquette. C'est exactement ça. »
- **Demande en plus** : la rendre « encore plus belle, plus chic, plus clean, plus classe, vraiment premium ». Cela vaut
  pour la page de l'élève ET pour son dossier dans l'Administration (même esprit que les « Paiements premium »).
- **À garder absolument** : le bouton « Ajouter à mon calendrier ». Toutes les séances s'ajoutent d'un coup dans
  l'agenda du téléphone de l'élève (fichier .ics : iPhone et Android), avec un rappel la veille.
- **Suite prévue** (plan validé dans la conversation « Réorganisation ») :
  - étape 2 : messages WhatsApp tout prêts (inscription reçue, lien de paiement, paiement validé + programme, rappel) ;
  - étape 3 : cours privés (lieu, créneaux libres seulement, 1h30 d'écart, ou « dates à convenir ensemble », créneaux
    réservés 48 h) ;
  - étape 4 : dossier de l'élève, planning jour par jour, notification 24 h avant chaque séance.
- **Avant tout** : montrer à la propriétaire la maquette retravaillée (plus premium), puis construire, une étape à la
  fois.
- **Pas encore en ligne sur cette branche** (à mettre en ligne avec le reste, après la batterie complète) :
  - fiche des cours de talons rangée ;
  - inscriptions classées par jour ;
  - Atelier talons avec uniquement des femmes ;
  - bande de photos qui défile toute seule.

## Maquette retravaillée « plus premium » (14/11/2026, à montrer à la propriétaire)

- `maquettes/programme-talons.html` v2 (aperçus : `apercu-programme-eleve.png`, `apercu-programme-admin.png`) :
  grande photo en haut, « carte d'élève » façon Paiements premium (`css/paiements-premium.css` réutilisé), prochaine
  séance mise en avant, calendrier épuré, séances en frise, icônes fines à la place des émojis, fond blanc.
- « Ajouter à mon calendrier » fabrique déjà un vrai fichier .ics (4 séances, rappel la veille) dans la maquette.
- Dossier de l'Administration : carte rouge (nom, paiement, séances, montant, fin), rappel de demain, programme en
  relevé, messages WhatsApp en tuiles (envoyé / à envoyer).
- **14/11/2026 : v2 validée** (« C'est parfaitement ça »), avec le **vouvoiement** (« Bienvenue, Madame Koné » :
  des dames, des femmes responsables viennent). « Applique et lance-toi. »
- **Étape 1 construite** (14/11/2026) : vraie page `programme-talons.html`, base `supabase-programme-talons.sql`
  (À COLLER par la propriétaire), « Son programme » dans la fiche de l'élève (Administration). Détails :
  README-TECHNIQUE.md, section « Mon programme ». Prochaine étape : 2, les messages WhatsApp tout prêts.
- **14/11/2026, ajouts demandés** : civilité choisie à l'inscription (« si la personne met Madame, on met Madame ; si
  elle a mis Mademoiselle, on met Mademoiselle ») ; groupe sur plusieurs mois (ex. 10 mois) : **les deux au choix**
  (1 mois renouvelable OU plusieurs mois dès l'inscription), **30 000 F × nombre de mois**, payé **en une fois ou mois
  par mois au choix de l'élève**. Fait le même jour (voir README-TECHNIQUE.md).
- **14/11/2026, programme sur plusieurs mois validé** (« Parfait, j'aime bien ton architecture ») : 1 Les bases, 2
  L'assurance, 3 La prestance, 4 Le podium, 5 Les tenues, 6 Miss et concours, puis Perfectionnement (le dernier dimanche
  de chaque mois reste un défilé). Fait (table cours_talons_programme).
- **Demandes suivantes de la propriétaire (14/11/2026, à faire une à la fois)** :
  1. montrer ce programme en premium sur la page publique des cours de talons (inscription) ;
  2. un programme du même genre pour les mannequins de l'agence, et ce style premium dans l'Administration,
     l'application, l'inscription, « Postuler à un casting », « Intégrer l'agence », la candidature.
