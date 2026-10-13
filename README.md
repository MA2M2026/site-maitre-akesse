# Maître Akesse Model Management (MA2M) — site www.maitreakessemodelmanagement.com

> [!CAUTION]
> **À LIRE AVANT TOUTE MODIFICATION — personne ou intelligence artificielle.**
>
> Ce dépôt est le site **en production** de l'agence. Tout ce qui arrive sur la branche
> `main` est **mis en ligne automatiquement** sur le vrai site (Vercel), sans autre
> vérification.
>
> **Avant d'écrire la moindre ligne, de créer une branche ou d'ouvrir une demande de
> fusion, lire en entier, dans cet ordre :**
>
> 1. [`CLAUDE.md`](CLAUDE.md) : les **règles obligatoires de la propriétaire**
>    (communication en français, une chose à la fois, tests « comme un visiteur »,
>    relecture, une mise en ligne par jour au plus, jamais de suppression de photos sans
>    l'accord de l'agence…). Elles s'appliquent à **toute** IA et à toute personne, pas
>    seulement à Claude.
> 2. [`SECURITY.md`](SECURITY.md) : **ce qu'il ne faut jamais faire** pour la sécurité
>    (droits de la base, clés secrètes, règles de sécurité des pages).
> 3. [`README-TECHNIQUE.md`](README-TECHNIQUE.md) : le **mode d'emploi technique
>    complet** (services connectés, méthode de mise en ligne, pièges déjà rencontrés).

> [!WARNING]
> **Interdits absolus sans l'accord écrit de la propriétaire :** mettre en ligne (fusionner
> dans `main`), supprimer des données ou des photos, modifier `vercel.json` ou les règles
> de sécurité, toucher à la création de compte ou à la connexion, écrire dans la vraie
> base de données pendant des essais. Ne jamais demander ni écrire de mot de passe, de
> code ou de clé secrète dans une conversation : les clés sont dans Vercel
> (Settings → Environment Variables).

**Méthode de travail obligatoire :** travailler sur une branche à part → tester
(`bash scripts/tests-visiteur/lancer.sh`, `python3 scripts/verifier-csp.py`, `node --check`)
→ relire → montrer le résultat à la propriétaire sur une version d'essai → mettre en ligne
seulement avec son accord → vérifier le site en ligne.

## Pour la propriétaire

- **Gérer le contenu au quotidien** : le tableau de bord du site
  (www.maitreakessemodelmanagement.com/tableau-de-bord.html), sans code ni IA.
- **En cas de problème** (site cassé, photos absentes, retour à une ancienne version,
  confier le site à quelqu'un) : [`GUIDE-DE-SECOURS.md`](GUIDE-DE-SECOURS.md).
