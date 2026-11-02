# Inventaire des adresses (phase 2, 02/11/2026)

Mesure : `node scripts/verify-dynamic.mjs --url <site>` (texte et images visibles avec programmes ⊆ sans programme,
6 navigateurs/robots identiques, en-tête complet, cache). Exceptions justifiées : `tests/js-only-whitelist.json`.
Écrites par : `middleware.js` (aiguillage), avec les dessins partagés `js/gabarit.js`, `js/partage.js`,
`js/rendu-book.js`, `js/rendu-publications.js`, `js/rendu-agenda.js`, `js/parcours.js`, `js/rendu-fiche.js`,
`js/formulaire-candidature-champs.js`, `js/tailles.js`.

| Adresse (FR et /en/…) | Public / réservé | Écrite par le serveur | Fonction serveur | Reste fait par le navigateur (interaction seulement) |
|---|---|---|---|---|
| `/` | public | oui (local 6/6) | accueilRempli + magazineComplet | défilement de la couverture, son du film, coupe de l'édito à la largeur |
| `/mannequins` | public | oui | bookRempli | filtres, sélection |
| `/book/:nom`, `/mannequin?id=` | public | oui | ficheRemplie (RenduFiche) | galerie plein écran, compcard, sélection |
| `/agenda` | public | oui | agendaRempli (RenduAgenda) | changement de vue du calendrier, « Voir plus » |
| `/parcours` | public | oui | parcoursRempli (RenduParcours) | choix du mois, filtres, détail d'une mannequin |
| `/qui-sommes-nous` | public | oui | quiSommesNousRempli | diaporamas, défilement des visages |
| `/actualites`, `/evenements` (+ `?actu=`, `?evenement=`) | public | oui | publicationsRemplies | filtres, lecture d'un article |
| `/partenaires` (+ `?partenaire=`) | public | oui | partenairesRemplis | — |
| `/services`, `/integrer-agence`, `/mentions-legales`, `/politique-confidentialite` | public | oui | textesRemplis | formulaire (envoi, anti-robots) |
| `/contact`, `/candidature` | public | oui | formulairesRemplis | formulaire (envoi, anti-robots) |
| `/recu`, `/places` | lien personnel | oui, `private, no-store` | recuRempli, placesRempli | — |
| `/selection` | public (liste du visiteur) | non : la sélection est gardée dans le navigateur du visiteur | — | tout (données du visiteur) |
| `/admin/*`, `admin.…` | réservé | non (coque de l'application) | api/* + RLS | tout |
| `/app/*`, `mannequin.…` | réservé | non (coque de l'application) | api/* + RLS | tout |
| `/api/*` | serveur | — | api/*.js | — |
| `/sitemap.xml`, `/robots.txt` | public | fichiers fixes (sitemap à générer depuis la base : W2, reste) | — | — |
