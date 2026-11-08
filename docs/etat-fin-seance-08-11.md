# État au 08/11/2026 (fin de séance) — branche `phase3-v1` (poussée sur GitHub)

En ligne : main `7b3ea54` (site vivant + relief du Book v1 + cache), Extension 157 collée (✅ mineures sans accord hors de l'accueil).

Prêt sur `phase3-v1`, PAS encore en ligne (une seule mise en ligne, après la batterie verte + relecture /code-review) :
1. Vitesse/sauts : Actualités 8,4→1,5 s, Événements 8,3→1,6–2,9 s, Ma sélection CLS 1,3→0,02, bandeau cookies tôt (Partenaires, Book EN 5,8→1,5 s), lien « Aller au contenu » dans les styles du haut, Qui sommes-nous (photo annoncée).
2. Bande de l'application compacte (validée), fiche téléphone sans vide rouge.
3. Normes : outil css-critique réparé (W3C), calendrier aria-pressed, h2 fiche, textes ≥ 12 px, alt.
4. Relief du Book v2 (validé sur vidéo).
5. Cadrage automatique des photos des fiches (validé).
6. Sécurité Extension 158 (supabase-securite-appareils.sql) : à coller APRÈS la mise en ligne, avec essai réel sur le téléphone de la propriétaire (accord donné : « préparez la sécurité »).
7. Lien vidéo cassé (fiche) corrigé ; suppression de supabase-paiements-zero.sql (déjà collé).

Ensuite : mesurer en ligne (Lighthouse + scripts/visiteur/geste-menu.mjs), puis analyse du code et de l'Administration.
