# Qui peut lire et écrire quoi dans la base (état relevé sur la vraie base le 07/11/2026)

Toutes les tables du schéma `public` ont la sécurité par ligne (RLS) activée. Un visiteur (`anon`) peut avoir le droit
SQL de lire une table, mais la règle RLS décide ligne par ligne. « Fermé sauf serveur » = aucune règle : seuls les
programmes du serveur (clé secrète) et les fonctions `security definer` y touchent.
Relevé à refaire après chaque extension SQL : requête en bas de page.

| Groupe | Tables | Visiteur | Mannequin connectée | Agence |
|---|---|---|---|---|
| Vitrine publique | actualites, actualite_photos, actualite_partenaires, evenements, evenement_photos, partenaires, contenu_a_la_une, mot_responsable, bandeau_annonce, reglages_site, notifications_reglages, instagram_posts_cache, textes_pages, traductions_en | lit tout | lit tout | écrit (table `admins`) |
| Book | model_profiles, model_photos, model_projects | lit les profils visibles (`profil_visible_public` : publiés, non en sourdine, mesures à jour) et leurs photos non écartées | lit et modifie SON profil, SES photos, SES projets | lit et modifie tout |
| Formulaires publics | casting_applications, casting_photos, inscriptions_mannequins, inscriptions_photos, recruiter_requests, recruiter_request_models, messages_contact, journal_erreurs, page_views, photos_upload_echouees | envoie seulement (limites par minute et par adresse : `limiter_soumissions_publiques_ip`, anti-robots) ; ne relit rien | idem | lit, traite, supprime |
| Agenda, convocations, défilés, cartes, places | agenda_projets, convocation_*, defile_*, cartes_photos, places_* | rien (liens personnels via fonctions : `convocation_lire`, `places_lire`, `defile_programme`) | rien en direct (application : fonctions `app_*`) | tout |
| Espace Paiements | agence_mannequins, paiements_mannequins, mensualites_appels, rapprochements, recaps_mensuels, recus_paiements, sorties_mannequins, codes_espace, liens_wave, reglages_paiements, modeles_messages, messages_envoyes, reglages_reprise | rien | rien en direct (`mes_mensualites`, `mes_recus`) | rôle Paiements (`portail_peut('paiements')`) ; réglages et liens Wave : administrateur principal |
| Comptabilité | compta_* , cachets_mannequins | rien | rien (reçu de cachet par lien : `cachet_recu_lire`) | rôle Compta (`portail_peut('compta')`) ; le comptable ne voit aucun nom de mannequin |
| Équipe et sécurité | staff_*, admins, audit_log, blocages_connexion, connexion_*, tentatives_*, admin_securite, code_portail_mannequin, invite_codes, staff_backup_codes, reglages_prives | rien | rien | SA fiche ; l'administrateur principal voit l'équipe et le journal |
| Boutique | boutique_* | lit le catalogue quand la boutique est ouverte ; commande par `boutique_passer_commande` | idem | gestion (`boutique_est_admin`) |
| Suivi des mannequins | presences, bulletins, documents_mannequins, mensurations_historique, mannequin_du_mois, app_messages, app_push_abonnements, fiche_evenement, contacts_parents | rien | les siens, par les fonctions de l'application | tout |

Fonctions `security definer` appelables par un visiteur : seulement celles des pages publiques (agenda, âges, parcours,
mannequin du mois, likes, castings ouverts), des formulaires (`soumettre_inscription_mannequin`, limites) et des liens
personnels à jeton (convocation, places, défilé, reçu de cachet, suivi de commande). Fermées le 07/11/2026 (Extension
155) : `boutique_emettre_billets`, `boutique_prochain_numero`, et aux visiteurs `boutique_annuler_expirees`,
`nettoyer_photos_traitees_anciennes`. Règle : Supabase donne d'office le droit d'appel à `anon` et `authenticated` ;
pour fermer une fonction, `revoke execute … from public, anon, authenticated` (puis `grant` au seul rôle voulu).

Relevé :
```sql
select c.relname, c.relrowsecurity, (select string_agg(p.cmd || ' ' || coalesce(p.qual, p.with_check, 'true'), ' | ')
  from pg_policies p where p.tablename = c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;
```
